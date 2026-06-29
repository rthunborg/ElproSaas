/**
 * Story 2.1 — coverage for the `getClaims()` claim-extraction branches inside
 * `resolveTenantContext` (`src/server/auth/resolve-tenant-context.ts`), complementing the
 * primary resolver suite which covers only the well-formed-user and authError paths.
 *
 * The resolver builds its re-validated user ONLY when `claims.sub` is a string, and
 * coerces a non-string `claims.email` to null. A malformed/partial claims payload (no
 * `sub`, a non-string `sub`, an absent `email`) must therefore degrade to UNAUTHENTICATED
 * or a null email — never throw, and never fabricate an authenticated identity. The
 * resolver must also SHORT-CIRCUIT before touching the DB when there is no user (it must
 * not run the membership query for an unauthenticated caller).
 *
 * Pure-logic with a faked Supabase client injected — runs NOW under `node --test`; adds no
 * test framework (tests/README.md).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

/**
 * Fake server client with directly-controlled claims and a membership query that records
 * whether it was reached — so we can assert the unauthenticated short-circuit.
 */
function makeFakeSupabase(opts: {
  claims: Record<string, unknown> | null;
  authError?: boolean;
}) {
  const state = { membershipQueried: false };

  // The resolver fetches the candidate SET and awaits the chain directly after `.order(...)`
  // (no `.maybeSingle()` — Task 7.2). The builder is thenable and returns an array.
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => {
      state.membershipQueried = true;
      return resolve({
        data: [
          {
            tenant_id: TENANT_A,
            role: "tenant_admin",
            status: "active",
            created_at: "2026-01-01T00:00:00Z",
            tenants: { name: "Acme Elektro AB" },
          },
        ],
        error: null,
      });
    },
  };

  const client = {
    auth: {
      getClaims: async () => ({
        data: opts.claims ? { claims: opts.claims } : null,
        error: opts.authError ? { message: "invalid jwt" } : null,
      }),
    },
    from: () => builder,
  } as unknown as NonNullable<Parameters<typeof resolveTenantContext>[0]>["client"];

  return { client, state };
}

test("claims with a non-string `sub` -> UNAUTHENTICATED (no fabricated identity)", async () => {
  const { client } = makeFakeSupabase({ claims: { sub: 12345, email: "x@y.test" } });
  const result = await resolveTenantContext({ client });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "UNAUTHENTICATED");
});

test("claims object with no `sub` at all -> UNAUTHENTICATED", async () => {
  const { client } = makeFakeSupabase({ claims: { email: "x@y.test" } });
  const result = await resolveTenantContext({ client });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "UNAUTHENTICATED");
});

test("unauthenticated caller SHORT-CIRCUITS — the membership query is never run", async () => {
  const { client, state } = makeFakeSupabase({ claims: null });
  const result = await resolveTenantContext({ client });
  assert.equal(result.ok, false);
  assert.equal(
    state.membershipQueried,
    false,
    "no tenant data may be loaded for an unauthenticated user (AC2/AC3)",
  );
});

test("authError with otherwise-present claims still -> UNAUTHENTICATED (error wins, no DB read)", async () => {
  const { client, state } = makeFakeSupabase({
    claims: { sub: USER_ID, email: "x@y.test" },
    authError: true,
  });
  const result = await resolveTenantContext({ client });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "UNAUTHENTICATED");
  assert.equal(state.membershipQueried, false);
});

test("valid `sub` with a non-string email coerces userEmail to null (presentational only)", async () => {
  const { client } = makeFakeSupabase({ claims: { sub: USER_ID, email: 999 } });
  const result = await resolveTenantContext({ client });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.userId, USER_ID);
    assert.equal(result.data.userEmail, null);
  }
});

test("valid `sub` with an absent email resolves with userEmail null", async () => {
  const { client } = makeFakeSupabase({ claims: { sub: USER_ID } });
  const result = await resolveTenantContext({ client });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.userEmail, null);
});
