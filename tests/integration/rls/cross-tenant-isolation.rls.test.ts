/**
 * Story 2.2 — AUTHORITATIVE cross-tenant RLS negatives (AC2 / R-001, P0).
 *
 * Proves Tenant A's authenticated tenant_admin cannot READ, INSERT (spoof),
 * UPDATE, or DELETE Tenant B rows on `tenants` and `tenant_memberships` through
 * the anon-key app path. Data-driven over the table inventory so Story 2.4 can
 * generalize it into the inventory-gated parameterized suite (the inventory GATE
 * itself is 2.4's scope).
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
import { isLocalStackReachable } from "../../support/test-env";

const TABLES = ["tenants", "tenant_memberships"] as const;
type TableName = (typeof TABLES)[number];

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key client

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

/** A row that, if it slipped past RLS, would forge Tenant B ownership. */
function spoofedRowFor(table: TableName): Record<string, unknown> {
  if (table === "tenants") {
    // Inserting a tenants row carrying Tenant B's id == claiming Tenant B's root.
    return { id: fixture.tenantB.id, name: "spoofed-by-tenant-a" };
  }
  // A membership row carrying Tenant B's tenant_id == self-grant into Tenant B.
  return {
    tenant_id: fixture.tenantB.id,
    user_id: fixture.adminA.id,
    role: "tenant_admin",
    status: "active",
  };
}

/** The id column to filter Tenant B's existing rows by, per table. */
function tenantBFilter(table: TableName): { column: string; value: string } {
  return table === "tenants"
    ? { column: "id", value: fixture.tenantB.id }
    : { column: "tenant_id", value: fixture.tenantB.id };
}

describe("Cross-tenant RLS isolation — tenants + tenant_memberships (AC2 / R-001)", () => {
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
        // No INSERT policy on the app path → RLS rejects the write.
        expect(error).not.toBeNull();
      });

      it(`[P0] UPDATE: Tenant A admin cannot UPDATE Tenant B's ${table} rows`, async () => {
        if (!stackUp) return;
        const { column, value } = tenantBFilter(table);
        const mutation =
          table === "tenants"
            ? { name: "hijacked-by-tenant-a" }
            : { status: "disabled" };
        const { data: affected, error } = await a
          .from(table)
          .update(mutation)
          .eq(column, value)
          .select();
        // Assert the MECHANISM, not just "no rows": `authenticated` has NO update
        // GRANT on these tables, so the write is denied at the table-privilege
        // layer (42501) — a future regression that GRANTed UPDATE against a
        // zero-matching USING clause would still produce an empty set and must NOT
        // pass here. `error` is non-null and `data` is null on a denied write
        // (review fix 2026-06-26).
        expect(error).not.toBeNull();
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
  });
});
