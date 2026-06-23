/**
 * ATDD RED-PHASE SCAFFOLD — Story 2.2, migration-reset green + required-objects-present (AC1 / R-007).
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  GATED ON THE STORY 2.2 DEV PHASE — DOES NOT RUN YET.                     ║
 * ║  Needs: real runner (Vitest), the local Supabase CLI stack, and the       ║
 * ║  tenant_foundation migration. The migration is the dev phase's gated      ║
 * ║  action (story Task 1.1 / Task 2) — NOT created by this ATDD scaffold.    ║
 * ║                                                                          ║
 * ║  Lives under tests/integration/** (already tsconfig-excluded) — NOT under ║
 * ║  supabase/, because creating `supabase/` is the dev phase's gated action. ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * COVERAGE (test-design-epic-2.md P0; AC1):
 *   AC1 / R-007 → `supabase db reset` from an EMPTY DB applies the migration
 *                 cleanly and creates the required objects:
 *                   - tables `tenants`, `tenant_memberships`
 *                   - helper functions `is_active_tenant_member(uuid)`,
 *                     `is_tenant_admin(uuid)`
 *                   - the `role = 'tenant_admin'` CHECK and the
 *                     `status in ('active','invited','disabled')` CHECK
 *                   - RLS enabled (and forced) on both tables
 *                   - `tenants.name` NOT NULL (deferred-work reconciliation)
 *
 * GREEN-PHASE (Story 2.2 dev phase):
 *   1. CI/dev runs `supabase db reset` (empty → migrate → seed) BEFORE this suite;
 *      this suite then introspects `information_schema` / `pg_catalog` via an admin
 *      connection to assert the objects exist with the expected constraints/flags.
 *   2. `import { describe, it, expect } from "vitest";` + an admin SQL query helper.
 *   3. Remove `.skip`, make GREEN.
 */

// Green-phase imports:
// import { describe, it, expect } from "vitest";
// (admin SQL query helper lands with the Story 2.2 dev stack)

function gatedMigrationReset(): never {
  throw new Error(
    "GATED: migration-reset green test runs only inside the Story 2.2 dev phase " +
      "(`supabase db reset` + the tenant_foundation migration). Intentionally skipped " +
      "in the ATDD red phase.",
  );
}

describe.skip("Migration reset green — tenant_foundation objects present (AC1 / R-007) (GATED on Story 2.2 dev stack)", () => {
  it("[P0] tables `tenants` and `tenant_memberships` exist after `supabase db reset` from empty", async () => {
    gatedMigrationReset();
    // const tables = await adminQuery(
    //   `select table_name from information_schema.tables where table_schema='public' and table_name in ('tenants','tenant_memberships')`,
    // );
    // expect(tables.map((r) => r.table_name).sort()).toEqual(["tenant_memberships", "tenants"]);
  });

  it("[P0] helper functions `is_active_tenant_member(uuid)` and `is_tenant_admin(uuid)` exist", async () => {
    gatedMigrationReset();
    // const fns = await adminQuery(
    //   `select proname from pg_proc where proname in ('is_active_tenant_member','is_tenant_admin')`,
    // );
    // expect(fns.map((r) => r.proname).sort()).toEqual(["is_active_tenant_member", "is_tenant_admin"]);
  });

  it("[P0] `tenant_memberships.role` is CHECK-constrained to 'tenant_admin' and `status` to ('active','invited','disabled')", async () => {
    gatedMigrationReset();
    // const checks = await adminQuery(
    //   `select pg_get_constraintdef(oid) as def from pg_constraint
    //      where conrelid = 'public.tenant_memberships'::regclass and contype = 'c'`,
    // );
    // const defs = checks.map((r) => r.def).join("\n");
    // expect(defs).toMatch(/role.*=.*'tenant_admin'/i);
    // expect(defs).toMatch(/status.*in.*\('active',\s*'invited',\s*'disabled'\)/i);
  });

  it("[P0] RLS is ENABLED and FORCED on both `tenants` and `tenant_memberships`", async () => {
    gatedMigrationReset();
    // const rls = await adminQuery(
    //   `select relname, relrowsecurity, relforcerowsecurity from pg_class
    //      where relname in ('tenants','tenant_memberships') and relkind='r'`,
    // );
    // for (const row of rls) {
    //   expect(row.relrowsecurity).toBe(true);  // RLS enabled
    //   expect(row.relforcerowsecurity).toBe(true); // forced (owner-bypass safety)
    // }
  });

  it("[P0] `tenants.name` is NOT NULL (Story 2.1 resolver joins tenants(name); deferred-work reconciliation)", async () => {
    gatedMigrationReset();
    // const col = await adminQuery(
    //   `select is_nullable from information_schema.columns
    //      where table_schema='public' and table_name='tenants' and column_name='name'`,
    // );
    // expect(col[0]?.is_nullable).toBe("NO");
  });
});
