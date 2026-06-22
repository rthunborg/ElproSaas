/**
 * Story 2.1 — pure-logic acceptance tests for the server tenant-resolution authority
 * `resolveTenantContext`, exercising ACs 1-4 WITHOUT a live database: the Supabase server
 * client (`auth.getClaims()` + the `tenant_memberships` query) is FAKED, so the only thing
 * under test is the resolver's own logic (claims re-validation → membership read → typed
 * Result). This is the coverage that is testable NOW; the authoritative DB-backed INT/RLS
 * tests are owned by Story 2.2's local stack (tests/integration, GATED).
 *
 * Ported from the red-phase Vitest-style scaffold to the platform `node --test` runner
 * (dependency-free; no gated framework added — see tests/README.md). The resolver injects
 * its Supabase client via `options.client`, so the fake below drives it directly.
 *
 * COVERAGE (test-design-epic-2.md):
 *   AC1 → active membership resolves correct, membership-derived tenant context
 *   AC2 → no membership / disabled / invited / non-admin role → TENANT_MEMBERSHIP_REQUIRED
 *   AC3 → no user / failed JWT re-validation → UNAUTHENTICATED (never getSession-based)
 *   AC4 → client-supplied tenant_id mismatch never widens access
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

type FakeUser = { id: string; email?: string | null } | null;
type FakeMembership = {
  tenant_id: string;
  role: string;
  status: string;
  tenants?: { name: string } | null;
} | null;

type FakeScript = {
  user: FakeUser;
  authError?: boolean;
  membership: FakeMembership;
  membershipError?: boolean;
};

/**
 * Build a fake `@supabase/ssr` server client matching exactly the surface the resolver
 * uses: `auth.getClaims()` and the chained `tenant_memberships` query terminating in
 * `.maybeSingle()`. `getClaims()` re-validates the JWT (never `getSession()`) — the
 * resolver only ever calls `getClaims()`, which this fake asserts implicitly by exposing
 * no `getSession`.
 */
function makeFakeSupabase(script: FakeScript) {
  const claims = script.user
    ? { sub: script.user.id, email: script.user.email ?? null }
    : null;

  const queryResult = {
    data: script.membership,
    error: script.membershipError ? { message: "db error" } : null,
  };

  // Chainable query builder; every link returns `this`, and the chain is awaited at
  // `.maybeSingle()`.
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => queryResult,
  };

  return {
    auth: {
      getClaims: async () => ({
        data: claims ? { claims } : null,
        error: script.authError ? { message: "invalid jwt" } : null,
      }),
    },
    from: () => builder,
  } as unknown as NonNullable<
    Parameters<typeof resolveTenantContext>[0]
  >["client"];
}

const ACTIVE_ADMIN: FakeMembership = {
  tenant_id: TENANT_A,
  role: "tenant_admin",
  status: "active",
  tenants: { name: "Acme Elektro AB" },
};

test("AC1: an active tenant_admin membership resolves the membership-derived tenant context", async () => {
  const client = makeFakeSupabase({
    user: { id: USER_ID, email: "admin@example.test" },
    membership: ACTIVE_ADMIN,
  });

  const result = await resolveTenantContext({ client });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.userId, USER_ID);
    assert.equal(result.data.tenantId, TENANT_A);
    assert.equal(result.data.role, "tenant_admin");
    assert.equal(result.data.status, "active");
    assert.equal(result.data.tenantName, "Acme Elektro AB");
    assert.equal(result.data.userEmail, "admin@example.test");
  }
});

test("AC2: an authenticated user with NO membership row is denied with TENANT_MEMBERSHIP_REQUIRED", async () => {
  const client = makeFakeSupabase({ user: { id: USER_ID }, membership: null });

  const result = await resolveTenantContext({ client });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "TENANT_MEMBERSHIP_REQUIRED");
    // No tenant context is leaked on denial: a failure Result carries no `data`.
    assert.equal("data" in result, false);
  }
});

test("AC2 (distinct case): a 'disabled' membership is treated as no-access, not granted", async () => {
  const client = makeFakeSupabase({
    user: { id: USER_ID },
    membership: { ...ACTIVE_ADMIN, status: "disabled" },
  });

  const result = await resolveTenantContext({ client });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "TENANT_MEMBERSHIP_REQUIRED");
});

test("AC2 (distinct case): an 'invited' membership is treated as no-access", async () => {
  const client = makeFakeSupabase({
    user: { id: USER_ID },
    membership: { ...ACTIVE_ADMIN, status: "invited" },
  });

  const result = await resolveTenantContext({ client });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "TENANT_MEMBERSHIP_REQUIRED");
});

test("AC2 (edge): an UNKNOWN DB status string is coerced to a denying status -> TENANT_MEMBERSHIP_REQUIRED", async () => {
  // The DB can return a status outside the known union (a future value, a typo). The DB-edge
  // normalizer (`normalizeMembershipStatus`) must fail closed and map it to a denying value,
  // so it can never be treated as `active`.
  const client = makeFakeSupabase({
    user: { id: USER_ID },
    membership: { ...ACTIVE_ADMIN, status: "suspended" },
  });

  const result = await resolveTenantContext({ client });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "TENANT_MEMBERSHIP_REQUIRED");
});

test("AC2 (role guard): a non-tenant_admin role is rejected even when status is active", async () => {
  const client = makeFakeSupabase({
    user: { id: USER_ID },
    membership: { ...ACTIVE_ADMIN, role: "viewer" },
  });

  const result = await resolveTenantContext({ client });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "TENANT_MEMBERSHIP_REQUIRED");
});

test("AC3: no authenticated user -> UNAUTHENTICATED (getClaims is used, never getSession)", async () => {
  const client = makeFakeSupabase({ user: null, membership: null });

  const result = await resolveTenantContext({ client });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "UNAUTHENTICATED");
});

test("AC3: a token that fails re-validation (authError) -> UNAUTHENTICATED, not a thrown error", async () => {
  const client = makeFakeSupabase({
    user: null,
    authError: true,
    membership: null,
  });

  const result = await resolveTenantContext({ client });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "UNAUTHENTICATED");
});

test("AC4: a mismatched client tenant_id NEVER widens access — it is IGNORED, resolution stays membership-derived", async () => {
  const client = makeFakeSupabase({
    user: { id: USER_ID },
    membership: ACTIVE_ADMIN, // membership says Tenant A
  });

  // The caller forges a client tenant_id pointing at Tenant B.
  const result = await resolveTenantContext({ client, clientTenantId: TENANT_B });

  // This resolver implements the AC4 "ignored" path (architecture §5 step 4): the spoofed
  // value is ignored and the tenant is resolved from the membership row. Access is NEVER
  // widened to Tenant B, and a rightful admin is never locked out of Tenant A.
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.tenantId, TENANT_A);
    assert.notEqual(result.data.tenantId, TENANT_B);
  }
});

test("AC4: a matching client tenant_id is accepted and still resolves to the membership tenant", async () => {
  const client = makeFakeSupabase({
    user: { id: USER_ID },
    membership: ACTIVE_ADMIN,
  });

  const result = await resolveTenantContext({ client, clientTenantId: TENANT_A });

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.tenantId, TENANT_A);
});

test("AC2: a membership query error degrades to TENANT_MEMBERSHIP_REQUIRED (no raw error thrown)", async () => {
  const client = makeFakeSupabase({
    user: { id: USER_ID },
    membership: null,
    membershipError: true,
  });

  const result = await resolveTenantContext({ client });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "TENANT_MEMBERSHIP_REQUIRED");
});
