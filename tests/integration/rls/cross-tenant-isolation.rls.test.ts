/**
 * Story 2.2 — AUTHORITATIVE cross-tenant RLS negatives (AC2 / R-001, P0).
 *
 * Proves Tenant A's authenticated tenant_admin cannot READ, INSERT (spoof),
 * UPDATE, or DELETE Tenant B rows through the anon-key app path. Data-driven over
 * the SHARED tenant-table inventory (`tenant-table-inventory.ts`) — the single
 * source of truth the H4 inventory gate also reads (Story 2.4, Task 3.1). A new
 * tenant-owned table enlists by enrolling in `TENANT_TABLES` there, NOT by a
 * copy-pasted parallel suite.
 *
 * Story 2.3 enrolled `audit_events` (now part of the shared inventory). A real
 * Tenant B audit row is seeded so the cross-tenant SELECT has a concrete row to be
 * denied. NOTE: `audit_events` differs from tenants/memberships in two ways the
 * spoof/insert path accounts for: (a) `authenticated` HAS a SELECT grant on it
 * (RLS narrows to own-tenant → empty set, no 42501 on read), and (b) the app path
 * has NO INSERT grant (writes go via the record_audit_event DEFINER), so the
 * spoof-INSERT is denied at the privilege layer (42501) exactly like the others.
 *
 * The denial-MECHANISM assertions (42501 + independent re-read) are UNCHANGED from
 * the original suite — Story 2.4 only points the iteration at the shared inventory.
 *
 * Runs against the LOCAL Supabase stack only; skips when unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminInsertAuditEvent } from "../../factories/audit-events";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import {
  TENANT_TABLES,
  spoofedRowFor,
  tenantBFilter,
  hijackMutationFor,
  type InventoryContext,
} from "./tenant-table-inventory";

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key client
let tenantBAuditId: string; // a seeded Tenant B audit row (cross-tenant target)
let ctx: InventoryContext; // shared-inventory context (fixture + the seeded audit id)

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  // Seed a REAL Tenant B audit row via the privileged path so the cross-tenant
  // SELECT/UPDATE/DELETE has a concrete target that must stay invisible to A.
  tenantBAuditId = await adminInsertAuditEvent({
    tenant_id: fixture.tenantB.id,
    actor_user_id: fixture.adminB.id,
    command: "b.command",
    event_type: "b.event",
    target_type: "tenant",
    target_id: fixture.tenantB.id,
    correlation_id: crypto.randomUUID(),
    metadata: { reason: "tenant-b-seed" },
  });
  // VACUITY GUARD (DX#4, epic-2 hardening): the audit_events cross-tenant negatives
  // filter Tenant B's row by `id = tenantBAuditId`. If the seed ever returned without
  // a real id, `.eq("id", undefined/null)` would match NOTHING and the SELECT/UPDATE/
  // DELETE denials would pass VACUOUSLY (a non-existent row trivially denies/empties).
  // Assert the seed produced a real id BEFORE any denial assertion runs, so a broken
  // seed fails loudly here instead of green-by-vacuity. This does NOT weaken the
  // denial mechanism — the per-table tests still assert the 42501 SQLSTATE.
  if (!tenantBAuditId) {
    throw new Error(
      "cross-tenant audit seed produced no id (tenantBAuditId is null/undefined) — " +
        "the audit_events cross-tenant negatives would pass VACUOUSLY against a " +
        "non-existent row. Failing loudly so the seed is fixed, not silently green.",
    );
  }
  ctx = { fixture, tenantBAuditId };
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

describe("Cross-tenant RLS isolation — data-driven over the shared inventory (AC2 / R-001)", () => {
  for (const table of TENANT_TABLES) {
    describe(`table: ${table}`, () => {
      it(`[P0] SELECT: Tenant A admin reads ZERO ${table} rows belonging to Tenant B (no error leak)`, async (testCtx) => {
        if (skipUnlessStack(testCtx, stackUp)) return;
        const { column, value } = tenantBFilter(table, ctx);
        const { data, error } = await a.from(table).select("*").eq(column, value);
        // RLS yields an empty set, NOT an error that confirms existence.
        expect(error).toBeNull();
        expect(data).toEqual([]);
      });

      it(`[P0] INSERT: Tenant A admin cannot INSERT a ${table} row carrying Tenant B ownership (no spoof)`, async (testCtx) => {
        if (skipUnlessStack(testCtx, stackUp)) return;
        const { error } = await a.from(table).insert(spoofedRowFor(table, ctx));
        // Assert the DENIAL MECHANISM, not a bare non-null error. `authenticated` has
        // NO INSERT GRANT on these tables, so the write is denied at the privilege
        // layer with `42501` (permission denied) — NOT a `23505` PK collision (the
        // spoof row uses a fresh id / non-conflicting key, review fix 2026-06-26).
        // This proves the privilege/RLS layer is doing the work, not a unique key.
        expect(error).not.toBeNull();
        expect(error?.code).toBe("42501");
      });

      it(`[P0] UPDATE: Tenant A admin cannot UPDATE Tenant B's ${table} rows`, async (testCtx) => {
        if (skipUnlessStack(testCtx, stackUp)) return;
        const { column, value } = tenantBFilter(table, ctx);
        const { data: affected, error } = await a
          .from(table)
          .update(hijackMutationFor(table))
          .eq(column, value)
          .select();
        // Assert the MECHANISM, not just "no rows": `authenticated` has NO update
        // GRANT on these tables (audit_events included — append-only), so the write
        // is denied at the table-privilege layer (42501) — a future regression that
        // GRANTed UPDATE against a zero-matching USING clause would still produce an
        // empty set and must NOT pass here. `error` is non-null and `data` is null on
        // a denied write. The 42501 assertion was missing for audit_events
        // specifically (review fix 2026-06-26; [Review][Patch][Med] 2026-06-29).
        expect(error).not.toBeNull();
        expect(error?.code).toBe("42501");
        expect(affected).toBeNull();
      });

      it(`[P0] DELETE: Tenant A admin cannot DELETE Tenant B's ${table} rows`, async (testCtx) => {
        if (skipUnlessStack(testCtx, stackUp)) return;
        const { column, value } = tenantBFilter(table, ctx);
        const { data: deleted, error } = await a
          .from(table)
          .delete()
          .eq(column, value)
          .select();
        // No DELETE grant for the app path → denied at the privilege layer (42501).
        // Assert the mechanism (non-null error, the 42501 SQLSTATE, null data), not a
        // vacuous empty set — matching the adjacent UPDATE/INSERT branches so a
        // regression flipping the denial to an empty result set does not pass
        // (review fix 2026-06-26; [Review][Patch][Med] 2026-06-29).
        expect(error).not.toBeNull();
        expect(error?.code).toBe("42501");
        expect(deleted).toBeNull();
      });
    });
  }

  it("[P0] Tenant B's rows are UNCHANGED after Tenant A's attempts (verified as Tenant B)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const b = await makeAuthedServerClient(fixture.adminB);
    // Tenant B still sees its own tenant + its own active membership intact.
    const { data: tenantRows } = await b
      .from("tenants")
      .select("id, name")
      .eq("id", fixture.tenantB.id);
    expect(tenantRows?.length).toBe(1);

    const { data: membershipRows } = await b
      .from("tenant_memberships")
      .select("tenant_id, status")
      .eq("tenant_id", fixture.tenantB.id);
    expect(membershipRows?.length).toBe(1);
    expect(membershipRows?.[0]?.status).toBe("active");

    // The seeded Tenant B audit row is still present and UNCHANGED for Tenant B
    // (Tenant A's denied UPDATE/DELETE attempts above never mutated it).
    const { data: auditRows } = await b
      .from("audit_events")
      .select("id, command, metadata")
      .eq("id", tenantBAuditId);
    expect(auditRows?.length).toBe(1);
    expect(auditRows?.[0]?.command).toBe("b.command");
    expect(auditRows?.[0]?.metadata).toEqual({ reason: "tenant-b-seed" });
  });
});
