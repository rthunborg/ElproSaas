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
  id?: string;
  tenant_id: string;
  role: string;
  status: string;
  created_at?: string;
  tenants?: { name: string } | null;
} | null;

type FakeScript = {
  user: FakeUser;
  authError?: boolean;
  /** A single membership row (sugar for `memberships: [row]`). */
  membership: FakeMembership;
  /** The full candidate set when a test needs to exercise multi-row selection. */
  memberships?: NonNullable<FakeMembership>[];
  membershipError?: boolean;
  membershipRoles?: string[];
  membershipRolesError?: boolean;
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

  // The resolver now fetches the candidate SET (no `.maybeSingle()`) and selects the
  // preferred row itself (Task 7.2). It issues an ACTIVE-FIRST query (`.eq("status",
  // "active")` — so the active row can never be capped out, review fix 2026-06-26) and ONLY
  // when that returns zero rows falls back to a second, unfiltered capped query. The fake
  // builder below tracks whether the `status='active'` filter was applied per query chain
  // and returns the matching subset, so both the active-first path and the disabled/invited
  // fallback are exercised faithfully.
  const rows = script.memberships ?? (script.membership ? [script.membership] : []);

  // `from()` returns a FRESH builder per call, since the resolver may run two queries.
  function makeBuilder() {
    let activeOnly = false;
    const builder = {
      select: () => builder,
      eq: (column?: string, value?: unknown) => {
        if (column === "status" && value === "active") activeOnly = true;
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => {
        if (script.membershipError) {
          return resolve({ data: null, error: { message: "db error" } });
        }
        const selected = activeOnly
          ? rows.filter((r) => r.status === "active")
          : rows;
        return resolve({ data: selected, error: null });
      },
    };
    return builder;
  }

  return {
    auth: {
      getClaims: async () => ({
        data: claims ? { claims } : null,
        error: script.authError ? { message: "invalid jwt" } : null,
      }),
    },
    from: (table: string) => {
      if (table === "membership_roles") {
        const roleBuilder = {
          select: () => roleBuilder,
          eq: () => roleBuilder,
          then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
            resolve({
              data: script.membershipRolesError ? null : (script.membershipRoles ?? []).map((role) => ({ role })),
              error: script.membershipRolesError ? { message: "role lookup failed" } : null,
            }),
        };
        return roleBuilder;
      }
      return makeBuilder();
    },
  } as unknown as NonNullable<
    Parameters<typeof resolveTenantContext>[0]
  >["client"];
}

const ACTIVE_ADMIN: FakeMembership = {
  id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
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

test("Task 7.1: a TRANSIENT membership query error maps to SERVER_ERROR, NOT TENANT_MEMBERSHIP_REQUIRED (no raw error thrown)", async () => {
  // An infrastructure failure (DB timeout / RLS misconfig / pool exhaustion) must NOT be
  // mislabeled as a permanent "no access" denial — that would mask an outage and mislead a
  // rightful admin. It maps to the distinct, generic, retryable SERVER_ERROR code.
  const client = makeFakeSupabase({
    user: { id: USER_ID },
    membership: null,
    membershipError: true,
  });

  const result = await resolveTenantContext({ client });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "SERVER_ERROR");
    // The message is generic and leaks nothing internal (no stack, no tenant/user signal).
    assert.equal("data" in result, false);
    assert.match(result.message, /tillfälligt fel|försök igen/i);
  }
});

test("Task 7.2: with both a disabled and an active admin row (across tenants), the ACTIVE one is selected (no lexicographic-sort dependence)", async () => {
  // Build a candidate set where the disabled row sorts FIRST lexicographically by status
  // ('disabled' < 'invited' but > 'active'), to prove selection is active-FIRST, not sort-
  // order-first. The active row is for TENANT_B.
  const client = makeFakeSupabase({
    user: { id: USER_ID },
    membership: null,
    memberships: [
      {
        tenant_id: TENANT_A,
        role: "tenant_admin",
        status: "disabled",
        created_at: "2026-01-01T00:00:00Z",
        tenants: { name: "Old Disabled Tenant" },
      },
      {
        tenant_id: TENANT_B,
        role: "tenant_admin",
        status: "active",
        created_at: "2026-02-01T00:00:00Z",
        tenants: { name: "Active Tenant" },
      },
    ],
  });

  const result = await resolveTenantContext({ client });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.tenantId, TENANT_B); // the ACTIVE membership, not the first row
    assert.equal(result.data.status, "active");
    assert.equal(result.data.tenantName, "Active Tenant");
  }
});

test("Review fix: a >10-tenant admin whose ONLY active row would be the 11th-oldest still resolves it (active-first SQL query, never capped out)", async () => {
  // Regression for the `.limit(10)` truncation finding (2026-06-26): the resolver fetches
  // `status='active'` rows FIRST at the SQL layer, so the active membership can never be
  // truncated by the blast-radius cap — even for an admin who belongs to many tenants and
  // whose active row sorts LAST by `created_at`. Build 12 disabled rows (older) + 1 active
  // row (newest); the active-first query returns only the active row, so it resolves.
  const ACTIVE_TENANT = "33333333-3333-3333-3333-333333333333";
  const manyMemberships: NonNullable<FakeMembership>[] = [];
  for (let i = 0; i < 12; i++) {
    manyMemberships.push({
      tenant_id: `00000000-0000-0000-0000-0000000000${(i + 10).toString()}`,
      role: "tenant_admin",
      status: "disabled",
      // Disabled rows are OLDER; the active row (below) is the newest, so a naive
      // `created_at`-ascending `.limit(10)` over the FULL set would truncate it.
      created_at: `2026-01-${(i + 1).toString().padStart(2, "0")}T00:00:00Z`,
      tenants: { name: `Disabled Tenant ${i}` },
    });
  }
  manyMemberships.push({
    tenant_id: ACTIVE_TENANT,
    role: "tenant_admin",
    status: "active",
    created_at: "2026-12-31T00:00:00Z", // newest → would be capped out without active-first
    tenants: { name: "The One Active Tenant" },
  });

  const client = makeFakeSupabase({
    user: { id: USER_ID },
    membership: null,
    memberships: manyMemberships,
  });

  const result = await resolveTenantContext({ client });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.tenantId, ACTIVE_TENANT);
    assert.equal(result.data.status, "active");
    assert.equal(result.data.tenantName, "The One Active Tenant");
  }
});

test("Task 7.2: when NO row is active, the resolver denies (TENANT_MEMBERSHIP_REQUIRED) rather than granting a disabled row", async () => {
  const client = makeFakeSupabase({
    user: { id: USER_ID },
    membership: null,
    memberships: [
      {
        tenant_id: TENANT_A,
        role: "tenant_admin",
        status: "disabled",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        tenant_id: TENANT_B,
        role: "tenant_admin",
        status: "invited",
        created_at: "2026-02-01T00:00:00Z",
      },
    ],
  });

  const result = await resolveTenantContext({ client });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "TENANT_MEMBERSHIP_REQUIRED");
});

test("[P0] 11.1 resolver: active context includes legacy tenant_admin plus de-duplicated active child roles", async () => {
  const result = await resolveTenantContext({
    client: makeFakeSupabase({
      user: { id: USER_ID },
      membership: ACTIVE_ADMIN,
      membershipRoles: ["projektledare", "saljare", "saljare"],
    }),
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(new Set(result.data.roles), new Set(["tenant_admin", "projektledare", "saljare"]));
  }
});

test("[P0] 11.1 resolver: a child-role lookup failure is a generic server failure", async () => {
  const result = await resolveTenantContext({
    client: makeFakeSupabase({
      user: { id: USER_ID },
      membership: ACTIVE_ADMIN,
      membershipRolesError: true,
    }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "SERVER_ERROR");
});
