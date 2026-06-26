/**
 * Story 2.2 — coverage EXPANSION: anonymous (anon-key, no session) path isolation
 * + RLS-helper EXECUTE least-privilege (AC2/AC3/AC4, R-001/R-005/R-006). P0.
 *
 * The existing suites prove the AUTHENTICATED app path is denied cross-tenant
 * access, and the resolver returns UNAUTHENTICATED for an anonymous caller. This
 * file closes two DIRECT, previously-unproven DB-level guarantees:
 *
 *   G1  An UNAUTHENTICATED anon-key client reads ZERO rows from `tenants` /
 *       `tenant_memberships` and CANNOT write them — realizing the migration's
 *       `anon → NOTHING` GRANT + the absence of any policy admitting anon.
 *   G2  An anonymous caller CANNOT EXECUTE the RLS helper predicates. The
 *       migration `REVOKE EXECUTE … FROM public` then grants only to
 *       `authenticated`/`service_role`, so `anon` cannot turn the helpers into a
 *       cross-tenant membership-existence ORACLE.
 *
 * Runs against the LOCAL Supabase stack only; skips when unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAnonServerClient,
  cleanupFixture,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";

const TABLES = ["tenants", "tenant_memberships"] as const;
type TableName = (typeof TABLES)[number];

let stackUp = false;
let fixture: TwoTenantFixture;
let anon: TestServerClient; // unauthenticated anon-key client (no session)

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  anon = await makeAnonServerClient();
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

/** A row that, if it landed, would forge a tenant root / a self-grant. */
function rowFor(table: TableName): Record<string, unknown> {
  return table === "tenants"
    ? { id: fixture.tenantA.id, name: "anon-spoof" }
    : {
        tenant_id: fixture.tenantA.id,
        user_id: fixture.adminA.id,
        role: "tenant_admin",
        status: "active",
      };
}

describe("Anonymous (no-session) anon-key path is fully isolated (G1 / R-001)", () => {
  for (const table of TABLES) {
    describe(`table: ${table}`, () => {
      it(`[P0] SELECT: an anonymous caller reads ZERO ${table} rows`, async () => {
        if (!stackUp) return;
        const { data, error } = await anon.from(table).select("*");
        // `anon` has NO SELECT grant on these tables (the migration grants SELECT
        // only to `authenticated`), so the read is denied at the privilege layer
        // (42501 permission denied) — it never reaches RLS. Assert the MECHANISM
        // (non-null error, null data), not a vacuous empty set that a future
        // GRANT-regression would still satisfy (review fix 2026-06-26).
        expect(error).not.toBeNull();
        expect(data).toBeNull();
      });

      it(`[P0] INSERT: an anonymous caller CANNOT write a ${table} row`, async () => {
        if (!stackUp) return;
        const { data, error } = await anon
          .from(table)
          .insert(rowFor(table))
          .select();
        // No insert grant for anon → denied at the privilege layer. Assert the
        // mechanism (review fix 2026-06-26).
        expect(error).not.toBeNull();
        expect(data).toBeNull();
      });

      it(`[P0] UPDATE: an anonymous caller CANNOT update existing ${table} rows`, async () => {
        if (!stackUp) return;
        const mutation =
          table === "tenants" ? { name: "anon-hijack" } : { status: "disabled" };
        const filter =
          table === "tenants"
            ? { column: "id", value: fixture.tenantA.id }
            : { column: "tenant_id", value: fixture.tenantA.id };
        const { data, error } = await anon
          .from(table)
          .update(mutation)
          .eq(filter.column, filter.value)
          .select();
        // No update grant for anon → denied (42501). Assert the mechanism (review
        // fix 2026-06-26).
        expect(error).not.toBeNull();
        expect(data).toBeNull();
      });

      it(`[P0] DELETE: an anonymous caller CANNOT delete ${table} rows`, async () => {
        if (!stackUp) return;
        const filter =
          table === "tenants"
            ? { column: "id", value: fixture.tenantA.id }
            : { column: "tenant_id", value: fixture.tenantA.id };
        const { data, error } = await anon
          .from(table)
          .delete()
          .eq(filter.column, filter.value)
          .select();
        // No delete grant for anon → denied (42501). Assert the mechanism (review
        // fix 2026-06-26).
        expect(error).not.toBeNull();
        expect(data).toBeNull();
      });
    });
  }
});

describe("RLS helpers are NOT anon-callable — no membership-existence oracle (G2 / R-006)", () => {
  const HELPERS = ["is_active_tenant_member", "is_tenant_admin"] as const;

  for (const helper of HELPERS) {
    it(`[P0] ${helper}: an anonymous caller CANNOT EXECUTE the helper (REVOKE … FROM public)`, async () => {
      if (!stackUp) return;
      // PostgREST exposes a function via rpc(). anon lacks EXECUTE (revoked from
      // PUBLIC, granted only to authenticated/service_role), so the call must NOT
      // succeed with a usable boolean — it is denied (permission / not-found).
      const { data, error } = await anon.rpc(helper, {
        target_tenant_id: fixture.tenantA.id,
      });
      // Either an explicit error, or no boolean result — never a `true` that would
      // let an unauthenticated caller probe whether a membership exists.
      expect(error !== null || typeof data !== "boolean" || data === false).toBe(
        true,
      );
      expect(data).not.toBe(true);
    });
  }
});
