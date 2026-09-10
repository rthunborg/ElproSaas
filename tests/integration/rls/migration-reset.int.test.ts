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
           and table_name in ('tenants', 'tenant_memberships', 'membership_roles')`,
    );
    expect(rows.map((r) => r.table_name).sort()).toEqual([
      "membership_roles",
      "tenant_memberships",
      "tenants",
    ]);
  });

  it("[10.8][P0] the complete local audit-failure seed fixture exists after reset", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;

    const tables = await adminQuery<{ relkind: string }>(
      `select c.relkind
         from pg_catalog.pg_class c
         join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'test_support'
          and c.relname = 'forced_audit_failures'`,
    );
    expect(tables).toEqual([{ relkind: "r" }]);

    const functions = await adminQuery<{
      prosecdef: boolean;
      return_type: string;
      proconfig: string[] | null;
    }>(
      `select
         p.prosecdef,
         p.prorettype::regtype::text as return_type,
         p.proconfig
       from pg_catalog.pg_proc p
       join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'test_support'
        and p.proname = 'fail_requested_audit_event'
        and p.pronargs = 0`,
    );
    expect(functions).toHaveLength(1);
    expect(functions[0]?.prosecdef).toBe(true);
    expect(functions[0]?.return_type).toBe("trigger");
    assertSearchPathExactlyEmpty(
      "test_support.fail_requested_audit_event",
      functions[0]?.proconfig ?? null,
    );

    const triggers = await adminQuery<{
      tgname: string;
      tgenabled: string;
      tgtype: number;
      target_schema: string;
      target_table: string;
      function_schema: string;
      function_name: string;
    }>(
      `select
         t.tgname,
         t.tgenabled,
         t.tgtype,
         target_namespace.nspname as target_schema,
         target_class.relname as target_table,
         function_namespace.nspname as function_schema,
         trigger_function.proname as function_name
       from pg_catalog.pg_trigger t
       join pg_catalog.pg_class target_class on target_class.oid = t.tgrelid
       join pg_catalog.pg_namespace target_namespace
         on target_namespace.oid = target_class.relnamespace
       join pg_catalog.pg_proc trigger_function on trigger_function.oid = t.tgfoid
       join pg_catalog.pg_namespace function_namespace
         on function_namespace.oid = trigger_function.pronamespace
      where t.tgname = 'test_only_forced_audit_failure'
        and not t.tgisinternal`,
    );
    expect(triggers).toEqual([{
      tgname: "test_only_forced_audit_failure",
      tgenabled: "O",
      tgtype: 7,
      target_schema: "public",
      target_table: "audit_events",
      function_schema: "test_support",
      function_name: "fail_requested_audit_event",
    }]);
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

  it("[P0] `tenant_memberships.role` CHECK admits the closed five-role set and `status` remains closed", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'public.tenant_memberships'::regclass and contype = 'c'`,
    );
    const defs = rows.map((r) => r.def).join("\n");
    expect(defs).toMatch(/role[\s\S]*'tenant_admin'[\s\S]*'projektledare'[\s\S]*'montor'[\s\S]*'saljare'[\s\S]*'ekonomi'/i);
    expect(defs).toMatch(/status[\s\S]*'active'[\s\S]*'invited'[\s\S]*'disabled'/i);
  });

  it("[P0] RLS is ENABLED and FORCED on foundation authorization tables", async (testCtx) => {
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
          and c.relname in ('tenants', 'tenant_memberships', 'membership_roles')
          and c.relkind = 'r'`,
    );
    expect(rows).toHaveLength(3);
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
    // Story 6.1 EXTENDS it again (NOT loosened) by the 18 new QUOTE policies:
    // quote_events.{S,I,U} + quote_version_attachments.{S,I,U} +
    // quote_version_lines.{S,I,U} + quote_versions.{S,I,U} + quotes.{S,I,U} +
    // tenant_counters.{S,I,U} — SELECT/INSERT/UPDATE per table, NO DELETE (archive over
    // hard delete; a tenant_counters row is upserted/incremented, never deleted). All six
    // are MANY-rows-per-tenant collections. Placed alphabetically. The "no DELETE policy
    // anywhere" assertion below still holds.
    // Story 7.1 EXTENDS it again (NOT loosened) by the 9 new ACCEPTANCE/JOB policies:
    // job_events.{S,I,U} + jobs.{S,I,U} + quote_acceptances.{S,I,U} — SELECT/INSERT/UPDATE
    // per table, NO DELETE (archive over hard delete). All three are MANY-rows-per-tenant
    // collections. Placed alphabetically. The "no DELETE policy anywhere" assertion below
    // still holds; 7.1 adds NO immutability trigger/policy (Story 7.4 locks accepted state).
    // Story 10.2 EXTENDS it again (NOT loosened) by the 2 new INSERT-ONLY LOST-REASON policies:
    // quote_lost_reasons.{SELECT,INSERT} — NO UPDATE, NO DELETE (the insert-only + archive-over-
    // delete discipline; the own-tenant-UPDATE-rejected negative depends on the absent UPDATE
    // grant/policy). Placed alphabetically (between quote_events and quote_terms). This is the ONLY
    // insert-only pair; the "no DELETE policy anywhere" assertion below still holds.
    // Story 10.3 EXTENDS it again (NOT loosened) by the 3 new UPDATE-able FOLLOW-UP policies:
    // quote_follow_ups.{SELECT,INSERT,UPDATE} — NO DELETE (archive-over-delete; the row advances
    // open -> completed, so it carries an UPDATE policy — the load-bearing contrast with 10.2's
    // insert-only quote_lost_reasons that drives the "rls-invisible" cross-tenant UPDATE profile).
    // Placed alphabetically (between quote_events and quote_lost_reasons).
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
      "job_events.INSERT",
      "job_events.SELECT",
      "job_events.UPDATE",
      "jobs.INSERT",
      "jobs.SELECT",
      "jobs.UPDATE",
      "membership_admin_operations.SELECT",
      "membership_roles.SELECT",
      "quote_acceptances.INSERT",
      "quote_acceptances.SELECT",
      "quote_acceptances.UPDATE",
      "quote_events.INSERT",
      "quote_events.SELECT",
      "quote_events.UPDATE",
      "quote_follow_ups.INSERT",
      "quote_follow_ups.SELECT",
      "quote_follow_ups.UPDATE",
      "quote_lost_reasons.INSERT",
      "quote_lost_reasons.SELECT",
      "quote_review_authorizations.SELECT",
      "quote_terms.INSERT",
      "quote_terms.SELECT",
      "quote_terms.UPDATE",
      "quote_version_attachments.INSERT",
      "quote_version_attachments.SELECT",
      "quote_version_attachments.UPDATE",
      "quote_version_lines.INSERT",
      "quote_version_lines.SELECT",
      "quote_version_lines.UPDATE",
      "quote_versions.INSERT",
      "quote_versions.SELECT",
      "quote_versions.UPDATE",
      "quotes.INSERT",
      "quotes.SELECT",
      "quotes.UPDATE",
      "tenant_counters.INSERT",
      "tenant_counters.SELECT",
      "tenant_counters.UPDATE",
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
    const selectOnly = [
      "tenants",
      "tenant_memberships",
      "membership_roles",
      "membership_admin_operations",
      "audit_events",
      "quote_review_authorizations",
    ];
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
      "tenant_counters",
      "quotes",
      "quote_versions",
      "quote_version_lines",
      "quote_version_attachments",
      "quote_events",
      "quote_follow_ups",
      "quote_acceptances",
      "jobs",
      "job_events",
    ];
    for (const t of crmSettingsAndPricingTables) {
      expect((cmdsByTable.get(t) ?? []).sort()).toEqual([
        "INSERT",
        "SELECT",
        "UPDATE",
      ]);
    }
    // Story 10.2 quote_lost_reasons is INSERT-ONLY — SELECT + INSERT policies, NO UPDATE, NO DELETE
    // (the insert-only + archive-over-delete discipline; the absent UPDATE grant/policy is the
    // load-bearing own-tenant-UPDATE-rejected enforcement).
    const insertOnlyTables = ["quote_lost_reasons"];
    for (const t of insertOnlyTables) {
      expect((cmdsByTable.get(t) ?? []).sort()).toEqual(["INSERT", "SELECT"]);
    }
    // No DELETE policy exists anywhere on the app path (archive/upsert over hard delete).
    expect(rows.some((r) => r.cmd === "DELETE")).toBe(false);
  });

  // Story 6.4 — the sent-immutability + append-only triggers + the mark-sent RPC land after
  // reset. The exact POLICY enumeration above is UNCHANGED (6.4 adds no policy — the quote_events
  // reconciliation is an append-only TRIGGER, not a policy/grant removal); this proves the new
  // ENFORCEMENT objects exist so the below-UI immutability + the transaction boundary are present.
  it("[P0] Story 6.4 sent-lock + append-only triggers + the mark_quote_version_sent RPC exist after reset", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // The quote_versions sent-lock trigger + its child-lock triggers + the quote_events
    // append-only trigger are present (BEFORE triggers on the frozen quote tables).
    const trigRows = await adminQuery<{ tgname: string; relname: string }>(
      `select t.tgname, c.relname
         from pg_trigger t
         join pg_class c on c.oid = t.tgrelid
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and not t.tgisinternal
          and t.tgname in (
            'quote_versions_sent_lock',
            'quote_version_lines_sent_lock',
            'quote_version_attachments_sent_lock',
            'quote_events_append_only'
          )`,
    );
    expect(trigRows.map((r) => r.tgname).sort()).toEqual([
      "quote_events_append_only",
      "quote_version_attachments_sent_lock",
      "quote_version_lines_sent_lock",
      "quote_versions_sent_lock",
    ]);

    // The trigger functions + the narrow mark-sent RPC exist and are hardened (empty search_path).
    const fnRows = await adminQuery<{
      proname: string;
      prosecdef: boolean;
      proconfig: string[] | null;
    }>(
      `select proname, prosecdef, proconfig from pg_proc
         where proname in (
           'enforce_quote_version_sent_lock',
           'enforce_quote_version_child_sent_lock',
           'quote_events_block_mutation',
           'mark_quote_version_sent'
         )`,
    );
    expect(fnRows.map((r) => r.proname).sort()).toEqual([
      "enforce_quote_version_child_sent_lock",
      "enforce_quote_version_sent_lock",
      "mark_quote_version_sent",
      "quote_events_block_mutation",
    ]);
    for (const fn of fnRows) {
      expect(fn.prosecdef).toBe(fn.proname === "mark_quote_version_sent");
      assertSearchPathExactlyEmpty(fn.proname, fn.proconfig);
    }
  });

  // Story 6.5 — the new-version + lifecycle-transition RPCs land after reset. This migration adds
  // NO table (H4 untouched — the exact POLICY enumeration above is UNCHANGED, function-only); it
  // proves the two new-version/lifecycle RPCs exist + are hardened so the below-command transaction
  // boundary is present.
  it("[P0] Story 6.5 create_new_quote_version + mark_quote_version_lifecycle RPCs exist after reset (hardened)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const fnRows = await adminQuery<{
      proname: string;
      prosecdef: boolean;
      proconfig: string[] | null;
    }>(
      `select proname, prosecdef, proconfig from pg_proc
         where proname in (
           'create_new_quote_version',
           'mark_quote_version_lifecycle'
         )`,
    );
    expect(fnRows.map((r) => r.proname).sort()).toEqual([
      "create_new_quote_version",
      "mark_quote_version_lifecycle",
    ]);
    for (const fn of fnRows) {
      expect(fn.prosecdef).toBe(true);
      assertSearchPathExactlyEmpty(fn.proname, fn.proconfig);
    }
  });

  it("[P0] 11.1 reset: membership_roles has a composite tenant FK and has_tenant_role is a hardened DEFINER helper", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const tables = await adminQuery<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' and table_name = 'membership_roles'",
    );
    expect(tables).toEqual([{ table_name: "membership_roles" }]);
    const foreignKeys = await adminQuery<{ definition: string }>(
      `select pg_get_constraintdef(oid) as definition
         from pg_constraint
        where conrelid = 'public.membership_roles'::regclass
          and contype = 'f'`,
    );
    expect(foreignKeys.some(({ definition }) =>
      /FOREIGN KEY \(membership_id, tenant_id\) REFERENCES tenant_memberships\(id, tenant_id\) ON UPDATE RESTRICT ON DELETE CASCADE/i.test(definition),
    )).toBe(true);

    const functions = await adminQuery<{
      prosecdef: boolean;
      proconfig: string[] | null;
      anon_can_execute: boolean;
      authenticated_can_execute: boolean;
      service_role_can_execute: boolean;
    }>(
      `select prosecdef,
              proconfig,
              has_function_privilege('anon', oid, 'EXECUTE') as anon_can_execute,
              has_function_privilege('authenticated', oid, 'EXECUTE') as authenticated_can_execute,
              has_function_privilege('service_role', oid, 'EXECUTE') as service_role_can_execute
         from pg_proc
        where oid = 'public.has_tenant_role(uuid,text[])'::regprocedure`,
    );
    expect(functions).toHaveLength(1);
    expect(functions[0]?.prosecdef).toBe(true);
    assertSearchPathExactlyEmpty("has_tenant_role", functions[0]?.proconfig ?? null);
    expect(functions[0]?.anon_can_execute).toBe(false);
    expect(functions[0]?.authenticated_can_execute).toBe(true);
    expect(functions[0]?.service_role_can_execute).toBe(true);
  });
});

// Close this file's admin pool once all migration-reset assertions are done.
afterAll(async () => {
  await closeAdminPool();
});
