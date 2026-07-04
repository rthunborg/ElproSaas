/**
 * Story 2.2 — migration-reset green + required-objects-present (AC1 / R-007).
 *
 * Asserts that after `supabase db reset` (empty → migrate → seed) the
 * tenant_foundation objects exist with the expected constraints, RLS flags, and
 * search_path hardening. Runs against the LOCAL Supabase stack only; skips
 * cleanly when the stack is unreachable (CI sets SUPABASE_TEST_REQUIRED=1 to make
 * a missing stack a hard failure).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { assertSearchPathExactlyEmpty } from "../../support/search-path";

let stackUp = false;
beforeAll(async () => {
  stackUp = await isLocalStackReachable();
});

describe("Migration reset green — tenant_foundation objects present (AC1 / R-007)", () => {
  it("[P0] tables `tenants` and `tenant_memberships` exist after reset", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ table_name: string }>(
      `select table_name from information_schema.tables
         where table_schema = 'public'
           and table_name in ('tenants', 'tenant_memberships')`,
    );
    expect(rows.map((r) => r.table_name).sort()).toEqual([
      "tenant_memberships",
      "tenants",
    ]);
  });

  it("[P0] helper functions `is_active_tenant_member(uuid)` and `is_tenant_admin(uuid)` exist", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ proname: string }>(
      `select proname from pg_proc
         where proname in ('is_active_tenant_member', 'is_tenant_admin')`,
    );
    expect(rows.map((r) => r.proname).sort()).toEqual([
      "is_active_tenant_member",
      "is_tenant_admin",
    ]);
  });

  it("[P0] both helpers are SECURITY DEFINER with an EXACTLY-EMPTY search_path (AC4 hardening)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{
      proname: string;
      prosecdef: boolean;
      proconfig: string[] | null;
    }>(
      `select proname, prosecdef, proconfig from pg_proc
         where proname in ('is_active_tenant_member', 'is_tenant_admin')`,
    );
    expect(rows).toHaveLength(2);
    for (const fn of rows) {
      expect(fn.prosecdef).toBe(true); // SECURITY DEFINER
      // Parse the ACTUAL `search_path` proconfig entry and assert it is EXACTLY empty
      // (`search_path=` / `search_path=""`). A non-empty path (e.g. `pg_catalog`) MUST
      // FAIL — the prior loose `/search_path=("")?$/` would have admitted it. The R-006
      // behavioral hijack negative is the runtime proof; this is assertion-strength.
      // [G-8a, epic-2 hardening; supersedes the 2-2 over-fit deferral]
      assertSearchPathExactlyEmpty(fn.proname, fn.proconfig);
    }
  });

  it("[P0] `tenant_memberships.role` CHECK = 'tenant_admin' and `status` CHECK in (active,invited,disabled)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'public.tenant_memberships'::regclass and contype = 'c'`,
    );
    const defs = rows.map((r) => r.def).join("\n");
    expect(defs).toMatch(/role\s*=\s*'tenant_admin'/i);
    expect(defs).toMatch(/status[\s\S]*'active'[\s\S]*'invited'[\s\S]*'disabled'/i);
  });

  it("[P0] RLS is ENABLED and FORCED on both public tables", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Schema-qualify: an internal `_realtime.tenants` exists too — match only public.
    const rows = await adminQuery<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `select c.relname, c.relrowsecurity, c.relforcerowsecurity
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname in ('tenants', 'tenant_memberships')
          and c.relkind = 'r'`,
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
    }
  });

  it("[P0] `tenants.name` is NOT NULL (deferred-work reconciliation)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ is_nullable: string }>(
      `select is_nullable from information_schema.columns
         where table_schema = 'public' and table_name = 'tenants'
           and column_name = 'name'`,
    );
    expect(rows[0]?.is_nullable).toBe("NO");
  });

  it("[P0] the public policy set is EXACTLY the expected per-table enumeration", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ tablename: string; cmd: string }>(
      `select tablename, cmd from pg_policies where schemaname = 'public'`,
    );
    // EXACT enumeration (NOT a loose superset) so a future STRAY policy on any table —
    // a write policy on the foundation tables, or a DELETE policy on a CRM table — is
    // still caught by this assertion failing.
    //
    // The foundation tables (tenants / tenant_memberships / audit_events) are
    // SELECT-only on the app path — INSERT/UPDATE/DELETE are deny-by-default there
    // (audit writes go via the record_audit_event DEFINER). Story 3.1 ADDS the first
    // app-path WRITE policies: the CRM tables grant `authenticated` SELECT/INSERT/UPDATE
    // (the tenant admin manages CRM via the app path), so customers/facilities/contacts
    // each carry own-tenant SELECT + INSERT + UPDATE policies — and NO DELETE policy
    // (archive over hard delete). This is the documented, expected break of the prior
    // "every policy is SELECT" invariant (Task 5.2): the invariant is REPLACED by this
    // exact per-table expectation rather than weakened to a superset match.
    // Story 3.3 EXTENDS this exact enumeration (NOT loosened to a superset) by the 6
    // new settings policies: company_settings.{SELECT,INSERT,UPDATE} +
    // quote_terms.{SELECT,INSERT,UPDATE} — SELECT/INSERT/UPDATE per table, NO DELETE
    // (upsert over hard delete). Placed alphabetically. The "no DELETE policy anywhere"
    // assertion below still holds.
    // Story 3.4 EXTENDS it again (NOT loosened) by the 6 new PRICING policies:
    // articles.{SELECT,INSERT,UPDATE} (sorts FIRST alphabetically) +
    // work_roles.{SELECT,INSERT,UPDATE} — SELECT/INSERT/UPDATE per table, NO DELETE
    // (archive over hard delete). Both tables are MANY-rows-per-tenant collections.
    // Story 5.1 EXTENDS it again (NOT loosened) by the 9 new CALCULATION policies:
    // calculations.{SELECT,INSERT,UPDATE} + calculation_rows.{SELECT,INSERT,UPDATE} +
    // calculation_sections.{SELECT,INSERT,UPDATE} — SELECT/INSERT/UPDATE per table, NO
    // DELETE (archive over hard delete via archived_at). All three are MANY-rows-per-
    // tenant collections. Placed alphabetically; the "no DELETE policy anywhere"
    // assertion below still holds.
    // Story 8.1 EXTENDS it again (NOT loosened) by the 6 new FILE policies:
    // file_links.{SELECT,INSERT,UPDATE} + files.{SELECT,INSERT,UPDATE} —
    // SELECT/INSERT/UPDATE per table, NO DELETE (archive over hard delete). Both are
    // MANY-rows-per-tenant collections. Placed alphabetically. NOTE: this query is
    // scoped to `schemaname = 'public'`, so the `storage.objects` RLS policies added by
    // 8.1 (tenant_files_objects_{select,insert,update}_own) do NOT appear here — they
    // live in the `storage` schema and are covered by storage-object-isolation.rls.test.ts.
    expect(rows.map((r) => `${r.tablename}.${r.cmd}`).sort()).toEqual([
      "articles.INSERT",
      "articles.SELECT",
      "articles.UPDATE",
      "audit_events.SELECT",
      "calculation_rows.INSERT",
      "calculation_rows.SELECT",
      "calculation_rows.UPDATE",
      "calculation_sections.INSERT",
      "calculation_sections.SELECT",
      "calculation_sections.UPDATE",
      "calculations.INSERT",
      "calculations.SELECT",
      "calculations.UPDATE",
      "company_settings.INSERT",
      "company_settings.SELECT",
      "company_settings.UPDATE",
      "contacts.INSERT",
      "contacts.SELECT",
      "contacts.UPDATE",
      "customers.INSERT",
      "customers.SELECT",
      "customers.UPDATE",
      "facilities.INSERT",
      "facilities.SELECT",
      "facilities.UPDATE",
      "file_links.INSERT",
      "file_links.SELECT",
      "file_links.UPDATE",
      "files.INSERT",
      "files.SELECT",
      "files.UPDATE",
      "quote_terms.INSERT",
      "quote_terms.SELECT",
      "quote_terms.UPDATE",
      "tenant_memberships.SELECT",
      "tenants.SELECT",
      "work_roles.INSERT",
      "work_roles.SELECT",
      "work_roles.UPDATE",
    ]);
    // Per-table command expectation (replaces the blanket "every policy is SELECT"):
    // the three foundation tables are SELECT-only; the three CRM tables are
    // SELECT/INSERT/UPDATE with NO DELETE policy on any table.
    const cmdsByTable = new Map<string, string[]>();
    for (const r of rows) {
      cmdsByTable.set(r.tablename, [...(cmdsByTable.get(r.tablename) ?? []), r.cmd]);
    }
    const selectOnly = ["tenants", "tenant_memberships", "audit_events"];
    for (const t of selectOnly) {
      expect((cmdsByTable.get(t) ?? []).sort()).toEqual(["SELECT"]);
    }
    // The CRM tables (Story 3.1), the settings tables (Story 3.3), the pricing tables
    // (Story 3.4), and the calculation tables (Story 5.1) are all SELECT/INSERT/UPDATE
    // with NO DELETE policy (archive/upsert over hard delete).
    const crmSettingsAndPricingTables = [
      "customers",
      "facilities",
      "contacts",
      "company_settings",
      "quote_terms",
      "work_roles",
      "articles",
      "calculations",
      "calculation_sections",
      "calculation_rows",
      "files",
      "file_links",
    ];
    for (const t of crmSettingsAndPricingTables) {
      expect((cmdsByTable.get(t) ?? []).sort()).toEqual([
        "INSERT",
        "SELECT",
        "UPDATE",
      ]);
    }
    // No DELETE policy exists anywhere on the app path (archive/upsert over hard delete).
    expect(rows.some((r) => r.cmd === "DELETE")).toBe(false);
  });
});

// Close this file's admin pool once all migration-reset assertions are done.
afterAll(async () => {
  await closeAdminPool();
});
