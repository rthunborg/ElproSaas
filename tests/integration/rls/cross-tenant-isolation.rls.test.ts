/**
 * ATDD RED-PHASE SCAFFOLD — Story 2.2, AUTHORITATIVE cross-tenant RLS negatives.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  GATED ON THE STORY 2.2 DEV PHASE — DOES NOT RUN YET.                     ║
 * ║                                                                          ║
 * ║  This is the epic's load-bearing coverage: it proves Tenant A cannot     ║
 * ║  READ, INSERT, UPDATE, DELETE, or SPOOF ownership of Tenant B rows on     ║
 * ║  `tenants` and `tenant_memberships`. It CANNOT execute until the         ║
 * ║  Story 2.2 DEV phase lands:                                               ║
 * ║    - the real test runner (TEA `testarch-framework` → Vitest),            ║
 * ║    - the local Supabase stack (`supabase start` / `supabase db reset`),   ║
 * ║    - the `tenant_foundation` migration (tables + RLS enabled & forced),   ║
 * ║    - the two-tenant factories (`tests/factories/tenants.ts`, B1).         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * COVERAGE (test-design-epic-2.md P0; AC2):
 *   AC2 / R-001 → cross-tenant SELECT denied (zero rows, not an error leak)
 *   AC2 / R-001 → cross-tenant INSERT denied (no spoofed Tenant B ownership)
 *   AC2 / R-001 → cross-tenant UPDATE denied
 *   AC2 / R-001 → cross-tenant DELETE denied
 *
 * DATA-DRIVEN ON PURPOSE: the verb × table matrix is iterated from `TABLES`.
 *   Story 2.4 GENERALIZES this into the inventory-gated parameterized suite —
 *   write it so 2.4 can drive it off the schema table inventory, but the
 *   inventory GATE itself is 2.4's scope, NOT this story's.
 *
 * GREEN-PHASE INSTRUCTIONS (Story 2.2 dev phase):
 *   1. `import { describe, it, expect } from "vitest";` (or the chosen runner).
 *   2. Replace the `gatedCrossTenant()` guards with real factory + client calls.
 *   3. For each table × verb: as adminA (Tenant A's authed anon-key client),
 *      attempt the operation against a Tenant B row and assert RLS denies it —
 *      SELECT returns ZERO rows (silent, not a 500), and INSERT/UPDATE/DELETE
 *      either error or affect ZERO rows. Confirm the Tenant B row is unchanged
 *      by re-reading it as adminB.
 *   4. Remove `.skip`, run after `supabase db reset`, make GREEN.
 */

// Green-phase imports (land with the Story 2.2 dev runner + stack):
// import { describe, it, expect } from "vitest";
// import { createTwoTenantFixture, makeAuthedServerClient } from "../../factories/tenants";

function gatedCrossTenant(): never {
  throw new Error(
    "GATED: cross-tenant RLS negatives run only inside the Story 2.2 dev phase " +
      "(local Supabase stack + tenant_foundation migration + two-tenant factories). " +
      "Intentionally skipped in the ATDD red phase.",
  );
}

/** The two tenant-owned tables created by this story. Story 2.4 widens this to the inventory. */
const TABLES = ["tenants", "tenant_memberships"] as const;

describe.skip("Cross-tenant RLS isolation — tenants + tenant_memberships (GATED on Story 2.2 dev stack)", () => {
  for (const table of TABLES) {
    describe(`table: ${table}`, () => {
      it(`[P0] SELECT: Tenant A admin reads ZERO ${table} rows belonging to Tenant B (no error leak)`, async () => {
        gatedCrossTenant();
        // const { tenantB, adminA } = await createTwoTenantFixture();
        // const a = await makeAuthedServerClient(adminA);
        // const { data, error } = await a.from(table).select("*").eq("tenant_id", tenantB.id);
        // // RLS yields an empty set, NOT an error that confirms existence.
        // expect(error).toBeNull();
        // expect(data).toEqual([]);
      });

      it(`[P0] INSERT: Tenant A admin cannot INSERT a ${table} row carrying Tenant B's tenant_id (no spoofed ownership)`, async () => {
        gatedCrossTenant();
        // const { tenantB, adminA } = await createTwoTenantFixture();
        // const a = await makeAuthedServerClient(adminA);
        // const { error } = await a.from(table).insert(rowFor(table, { tenant_id: tenantB.id }));
        // expect(error).not.toBeNull(); // RLS WITH CHECK rejects the spoofed ownership.
        // // And as adminB, no such injected row is visible.
      });

      it(`[P0] UPDATE: Tenant A admin cannot UPDATE Tenant B's ${table} rows`, async () => {
        gatedCrossTenant();
        // const { tenantB, adminA, adminB } = await createTwoTenantFixture();
        // const a = await makeAuthedServerClient(adminA);
        // const { data: affected } = await a.from(table).update({ /* mutated field */ }).eq("tenant_id", tenantB.id).select();
        // expect(affected ?? []).toEqual([]); // RLS USING clause matches zero of B's rows.
        // // Re-read as adminB: the row is unchanged.
      });

      it(`[P0] DELETE: Tenant A admin cannot DELETE Tenant B's ${table} rows`, async () => {
        gatedCrossTenant();
        // const { tenantB, adminA, adminB } = await createTwoTenantFixture();
        // const a = await makeAuthedServerClient(adminA);
        // const { data: deleted } = await a.from(table).delete().eq("tenant_id", tenantB.id).select();
        // expect(deleted ?? []).toEqual([]); // Zero of B's rows deletable by A.
        // // Re-read as adminB: the row still exists.
      });
    });
  }
});
