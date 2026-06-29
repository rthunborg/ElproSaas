/**
 * Story 2.2 — AUTHORITATIVE cross-tenant RLS negatives (AC2 / R-001, P0).
 *
 * Proves Tenant A's authenticated tenant_admin cannot READ, INSERT (spoof),
 * UPDATE, or DELETE Tenant B rows through the anon-key app path. Data-driven over
 * the table inventory so Story 2.4 can generalize it into the inventory-gated
 * parameterized suite (the inventory GATE itself is 2.4's scope).
 *
 * Story 2.3 ENROLLS `audit_events` in the same data-driven `TABLES` array (Task
 * 5.3b) — a new tenant-owned table enlists here WITHOUT a parallel suite. A real
 * Tenant B audit row is seeded so the cross-tenant SELECT has a concrete row to be
 * denied. NOTE: `audit_events` differs from tenants/memberships in two ways the
 * spoof/insert path accounts for: (a) `authenticated` HAS a SELECT grant on it
 * (RLS narrows to own-tenant → empty set, no 42501 on read), and (b) the app path
 * has NO INSERT grant (writes go via the record_audit_event DEFINER), so the
 * spoof-INSERT is denied at the privilege layer (42501) exactly like the others.
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

const TABLES = ["tenants", "tenant_memberships", "audit_events"] as const;
type TableName = (typeof TABLES)[number];

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key client
let tenantBAuditId: string; // a seeded Tenant B audit row (cross-tenant target)

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
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

/** A row that, if it slipped past RLS, would forge Tenant B ownership. */
function spoofedRowFor(table: TableName): Record<string, unknown> {
  if (table === "tenants") {
    // Insert a NEW tenant root with a FRESH id (review fix 2026-06-26). Reusing
    // Tenant B's existing PK would let the INSERT fail with `23505` (unique_violation)
    // BEFORE the privilege/RLS layer is reached — a green that proves nothing about
    // isolation (it would stay green even if the privilege layer were removed). With a
    // fresh uuid the only thing that can reject the write is the missing INSERT GRANT
    // / RLS, so the test exercises the ACTUAL denial. Tenant A still has no business
    // creating tenant roots through the app path.
    return { id: crypto.randomUUID(), name: "spoofed-by-tenant-a" };
  }
  if (table === "audit_events") {
    // An audit row carrying Tenant B's tenant_id == a forged cross-tenant audit
    // write. FRESH id so the denial is the missing INSERT GRANT (42501), not a PK
    // collision (23505) — the app path has NO direct INSERT grant on audit_events
    // (writes go via the record_audit_event DEFINER).
    return {
      id: crypto.randomUUID(),
      tenant_id: fixture.tenantB.id,
      actor_user_id: fixture.adminA.id,
      command: "spoof.by.a",
      event_type: "spoof.by.a",
      target_type: "tenant",
      target_id: fixture.tenantB.id,
      correlation_id: crypto.randomUUID(),
      metadata: {},
    };
  }
  // A membership row carrying Tenant B's tenant_id == self-grant into Tenant B. Uses
  // adminA's own user_id against Tenant B (a NON-conflicting row), so the denial is
  // the missing INSERT GRANT / RLS, not a unique collision.
  return {
    tenant_id: fixture.tenantB.id,
    user_id: fixture.adminA.id,
    role: "tenant_admin",
    status: "active",
  };
}

/** The id column to filter Tenant B's existing rows by, per table. */
function tenantBFilter(table: TableName): { column: string; value: string } {
  if (table === "tenants") return { column: "id", value: fixture.tenantB.id };
  if (table === "audit_events") return { column: "id", value: tenantBAuditId };
  return { column: "tenant_id", value: fixture.tenantB.id };
}

describe("Cross-tenant RLS isolation — tenants + tenant_memberships + audit_events (AC2 / R-001)", () => {
  for (const table of TABLES) {
    describe(`table: ${table}`, () => {
      it(`[P0] SELECT: Tenant A admin reads ZERO ${table} rows belonging to Tenant B (no error leak)`, async () => {
        if (!stackUp) return;
        const { column, value } = tenantBFilter(table);
        const { data, error } = await a.from(table).select("*").eq(column, value);
        // RLS yields an empty set, NOT an error that confirms existence.
        expect(error).toBeNull();
        expect(data).toEqual([]);
      });

      it(`[P0] INSERT: Tenant A admin cannot INSERT a ${table} row carrying Tenant B ownership (no spoof)`, async () => {
        if (!stackUp) return;
        const { error } = await a.from(table).insert(spoofedRowFor(table));
        // Assert the DENIAL MECHANISM, not a bare non-null error. `authenticated` has
        // NO INSERT GRANT on these tables, so the write is denied at the privilege
        // layer with `42501` (permission denied) — NOT a `23505` PK collision (the
        // spoof row uses a fresh id / non-conflicting key, review fix 2026-06-26).
        // This proves the privilege/RLS layer is doing the work, not a unique key.
        expect(error).not.toBeNull();
        expect(error?.code).toBe("42501");
      });

      it(`[P0] UPDATE: Tenant A admin cannot UPDATE Tenant B's ${table} rows`, async () => {
        if (!stackUp) return;
        const { column, value } = tenantBFilter(table);
        const mutation =
          table === "tenants"
            ? { name: "hijacked-by-tenant-a" }
            : table === "audit_events"
              ? { metadata: { hijacked: true } }
              : { status: "disabled" };
        const { data: affected, error } = await a
          .from(table)
          .update(mutation)
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

      it(`[P0] DELETE: Tenant A admin cannot DELETE Tenant B's ${table} rows`, async () => {
        if (!stackUp) return;
        const { column, value } = tenantBFilter(table);
        const { data: deleted, error } = await a
          .from(table)
          .delete()
          .eq(column, value)
          .select();
        // No DELETE grant for the app path → denied at the privilege layer (42501).
        // Assert the mechanism (non-null error, null data), not a vacuous empty set
        // (review fix 2026-06-26).
        expect(error).not.toBeNull();
        expect(deleted).toBeNull();
      });
    });
  }

  it("[P0] Tenant B's rows are UNCHANGED after Tenant A's attempts (verified as Tenant B)", async () => {
    if (!stackUp) return;
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
