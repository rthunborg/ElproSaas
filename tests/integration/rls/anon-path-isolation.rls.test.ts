/**
 * Story 2.2 — coverage EXPANSION: anonymous (anon-key, no session) path isolation
 * + RLS-helper EXECUTE least-privilege (AC2/AC3/AC4, R-001/R-005/R-006). P0.
 *
 * Story 2.4 (Task 3.1/3.2) GENERALIZES this onto the SHARED tenant-table inventory
 * (`tenant-table-inventory.ts`): the anon SELECT/INSERT/UPDATE/DELETE negatives now
 * iterate the FULL `TENANT_TABLES` set (incl. `audit_events` — closing the 2-3
 * iter-2 LOW that left `audit_events` out of this data-driven seam), and the
 * anon-EXECUTE negative now also covers `record_audit_event` alongside the two RLS
 * helpers. A new tenant-owned table enlists in `TENANT_TABLES` there, not here.
 *
 * The guarantees this file proves:
 *
 *   G1  An UNAUTHENTICATED anon-key client reads ZERO rows from every tenant-owned
 *       table and CANNOT write them — realizing the migrations' `anon → NOTHING`
 *       GRANT + the absence of any policy admitting anon. Asserted by the denial
 *       MECHANISM (`42501`), not a vacuous empty set.
 *   G2  An anonymous caller CANNOT EXECUTE the RLS helper predicates NOR the
 *       privileged `record_audit_event` write fn. Each `REVOKE EXECUTE … FROM
 *       public` then grants only to `authenticated`/`service_role`, so `anon`
 *       cannot turn them into a cross-tenant oracle / audit-write path.
 *
 * NOTE (architecture §20): Phase A has NO public privileged routes/functions/cron/
 * webhooks, so the "protected route inventory" for AC5 REDUCES to the DB surface
 * (tenant-owned tables + the privileged RPCs covered here). The route-level
 * anonymous-access enforcement (the `(app)` layout redirect) is covered by the
 * gated E2E owned by a later E2E task, NOT this harness.
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
import {
  TENANT_TABLES,
  anonRowFor,
  anonFilterFor,
  anonMutationFor,
  type InventoryContext,
} from "./tenant-table-inventory";

let stackUp = false;
let fixture: TwoTenantFixture;
let anon: TestServerClient; // unauthenticated anon-key client (no session)
let ctx: InventoryContext; // shared-inventory context (no audit row needed for anon)

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  anon = await makeAnonServerClient();
  // The anon negatives never read a seeded audit row (anon is denied before any row
  // matches), so a real tenantBAuditId is not needed — a placeholder satisfies the
  // shared-context shape.
  ctx = { fixture, tenantBAuditId: crypto.randomUUID() };
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

describe("Anonymous (no-session) anon-key path is fully isolated — data-driven over the inventory (G1 / R-001)", () => {
  for (const table of TENANT_TABLES) {
    describe(`table: ${table}`, () => {
      it(`[P0] SELECT: an anonymous caller reads ZERO ${table} rows`, async () => {
        if (!stackUp) return;
        const { data, error } = await anon.from(table).select("*");
        // `anon` has NO SELECT grant on these tables (the migrations grant SELECT
        // only to `authenticated`), so the read is denied at the privilege layer
        // (42501 permission denied) — it never reaches RLS. Assert the MECHANISM
        // (non-null error, null data), not a vacuous empty set that a future
        // GRANT-regression would still satisfy (review fix 2026-06-26).
        expect(error).not.toBeNull();
        expect(error?.code).toBe("42501");
        expect(data).toBeNull();
      });

      it(`[P0] INSERT: an anonymous caller CANNOT write a ${table} row`, async () => {
        if (!stackUp) return;
        const { data, error } = await anon
          .from(table)
          .insert(anonRowFor(table, ctx))
          .select();
        // No insert grant for anon → denied at the privilege layer (42501). Assert the
        // mechanism (review fix 2026-06-26).
        expect(error).not.toBeNull();
        expect(error?.code).toBe("42501");
        expect(data).toBeNull();
      });

      it(`[P0] UPDATE: an anonymous caller CANNOT update existing ${table} rows`, async () => {
        if (!stackUp) return;
        const { column, value } = anonFilterFor(table, ctx);
        const { data, error } = await anon
          .from(table)
          .update(anonMutationFor(table))
          .eq(column, value)
          .select();
        // No update grant for anon → denied (42501). Assert the mechanism (review
        // fix 2026-06-26).
        expect(error).not.toBeNull();
        expect(error?.code).toBe("42501");
        expect(data).toBeNull();
      });

      it(`[P0] DELETE: an anonymous caller CANNOT delete ${table} rows`, async () => {
        if (!stackUp) return;
        const { column, value } = anonFilterFor(table, ctx);
        const { data, error } = await anon
          .from(table)
          .delete()
          .eq(column, value)
          .select();
        // No delete grant for anon → denied (42501). Assert the mechanism (review
        // fix 2026-06-26).
        expect(error).not.toBeNull();
        expect(error?.code).toBe("42501");
        expect(data).toBeNull();
      });
    });
  }
});

describe("Privileged functions are NOT anon-callable — no oracle / no audit-write (G2 / R-006 / AC5)", () => {
  it("[P0] is_active_tenant_member: an anonymous caller CANNOT EXECUTE the helper (REVOKE … FROM public)", async () => {
    if (!stackUp) return;
    const { data, error } = await anon.rpc("is_active_tenant_member", {
      target_tenant_id: fixture.tenantA.id,
    });
    assertAnonExecuteDenied(data, error);
  });

  it("[P0] is_tenant_admin: an anonymous caller CANNOT EXECUTE the helper (REVOKE … FROM public)", async () => {
    if (!stackUp) return;
    const { data, error } = await anon.rpc("is_tenant_admin", {
      target_tenant_id: fixture.tenantA.id,
    });
    assertAnonExecuteDenied(data, error);
  });

  it("[P0/AC5] record_audit_event: an anonymous caller has NO EXECUTE on the privileged write fn (42501, not vacuous data===false)", async () => {
    if (!stackUp) return;
    // The SECURITY DEFINER write fn `REVOKE EXECUTE … FROM public`, granted only to
    // authenticated/service_role (migration 20260629121136_audit_events.sql). An anon
    // attempt must be denied at the privilege layer (42501), NOT a `false`/null result
    // with no error (the Story 2.2 G2 lesson). Closes AC5 for the privileged RPC.
    const { data, error } = await anon.rpc("record_audit_event", {
      p_tenant_id: fixture.tenantA.id,
      p_actor_user_id: fixture.adminA.id,
      p_command: "anon.spoof",
      p_event_type: "anon.spoof",
      p_target_type: "tenant",
      p_target_id: fixture.tenantA.id,
      p_correlation_id: crypto.randomUUID(),
      p_metadata: {},
      p_created_at: "2026-06-29T12:00:00.000Z",
    });
    assertAnonExecuteDenied(data, error);
  });
});

/**
 * Assert the DENIAL MECHANISM for an anon EXECUTE attempt: anon has NO EXECUTE on
 * the function (`REVOKE EXECUTE … FROM public`, granted only to
 * authenticated/service_role), so the call MUST fail at the privilege layer
 * (42501). A bare `data === false`/`!error` disjunction would be satisfied by a
 * `false` result with NO error — so a future GRANT to anon (turning the helper into
 * an oracle / the write fn into an anon audit path) would still pass while the test
 * claimed anon lacks EXECUTE. Require the error explicitly + the 42501 SQLSTATE,
 * keeping `data !== true` as a backstop (review fix 2026-06-26).
 */
function assertAnonExecuteDenied(data: unknown, error: { code?: string } | null): void {
  expect(error).not.toBeNull();
  expect(error?.code).toBe("42501");
  expect(data).not.toBe(true);
}
