/**
 * Story 2.1 — coverage for the `tenants(name)` relation normalization inside
 * `resolveTenantContext` (`src/server/db/resolve-tenant-context.ts` → `extractTenantName`).
 *
 * The embedded PostgREST `tenants(name)` join may come back as an OBJECT or as a
 * single-element ARRAY depending on the inferred relationship cardinality, and a
 * defensive resolver must also survive a malformed/absent relation without throwing.
 * `tenantName` is PRESENTATIONAL ONLY (top-bar display) and is never an authority input —
 * so a missing/garbled name must degrade to `null`, never deny access and never leak. The
 * existing resolver suite only feeds the object form; these tests drive the
 * array/malformed/absent branches through the PUBLIC resolver (the helper is private), so
 * the real normalization path is exercised, not a copy of it.
 *
 * Pure-logic with a faked Supabase client injected — runs NOW under `node --test`; adds no
 * test framework (tests/README.md). The DB-backed shape is owned by Story 2.2's stack.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

/**
 * Faked `@supabase/ssr` server client whose membership row carries an arbitrarily-shaped
 * `tenants` relation, so the `extractTenantName` object/array/malformed branches can be
 * driven through the public resolver.
 */
function makeFakeSupabaseWithTenantsRelation(tenants: unknown) {
  // The resolver fetches the candidate SET and awaits the chain after `.order(...)` (no
  // `.maybeSingle()` — Task 7.2). The builder is thenable and returns a one-row array.
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      resolve({
        data: [
          {
            tenant_id: TENANT_A,
            role: "tenant_admin",
            status: "active",
            created_at: "2026-01-01T00:00:00Z",
            tenants,
          },
        ],
        error: null,
      }),
  };

  return {
    auth: {
      getClaims: async () => ({
        data: { claims: { sub: USER_ID, email: "admin@example.test" } },
        error: null,
      }),
    },
    from: () => builder,
  } as unknown as NonNullable<
    Parameters<typeof resolveTenantContext>[0]
  >["client"];
}

test("object-form `tenants: { name }` relation resolves the display name", async () => {
  const client = makeFakeSupabaseWithTenantsRelation({ name: "Acme Elektro AB" });
  const result = await resolveTenantContext({ client });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.tenantName, "Acme Elektro AB");
});

test("array-form `tenants: [{ name }]` relation (PostgREST cardinality) resolves the first name", async () => {
  const client = makeFakeSupabaseWithTenantsRelation([{ name: "Beta Elektro AB" }]);
  const result = await resolveTenantContext({ client });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.tenantName, "Beta Elektro AB");
});

test("null `tenants` relation degrades tenantName to null — access still granted", async () => {
  const client = makeFakeSupabaseWithTenantsRelation(null);
  const result = await resolveTenantContext({ client });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.tenantName, null);
});

test("empty-array `tenants: []` relation degrades tenantName to null without throwing", async () => {
  const client = makeFakeSupabaseWithTenantsRelation([]);
  const result = await resolveTenantContext({ client });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.tenantName, null);
});

test("malformed `tenants` with a non-string name degrades tenantName to null (presentational, never trusted)", async () => {
  const client = makeFakeSupabaseWithTenantsRelation({ name: 42 });
  const result = await resolveTenantContext({ client });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.tenantName, null);
});

test("`tenants` object missing the `name` key degrades to null without throwing", async () => {
  const client = makeFakeSupabaseWithTenantsRelation({ id: "x" });
  const result = await resolveTenantContext({ client });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.tenantName, null);
});

test("a tenantName quirk NEVER affects the resolved tenantId — authority stays membership-derived", async () => {
  // Even with a garbage display relation, the membership-derived tenant id is authoritative.
  const client = makeFakeSupabaseWithTenantsRelation({ name: { nested: "spoof" } });
  const result = await resolveTenantContext({ client });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.tenantId, TENANT_A);
    assert.equal(result.data.tenantName, null);
  }
});
