/**
 * Story 6.1 — ATDD RED-PHASE scaffold: quote migration-reset proof
 * (AC1, P0 — 6.1-INT-01 / R-601).
 *
 * Asserts that after `supabase db reset` (empty → migrate → seed) the new
 * `quote_version_model` migration created the SIX new tenant-owned tables
 * (`tenant_counters`, `quotes`, `quote_versions`, `quote_version_lines`,
 * `quote_version_attachments`, `quote_events`) with the exact schema contract that
 * MIRRORS the proven calc-table pattern verbatim:
 *   - a DIRECT `tenant_id` NOT NULL FK → public.tenants ON DELETE CASCADE per table;
 *   - the COMPOSITE same-tenant parent FKs (quotes→customers/facilities/contacts
 *     (id,tenant_id); quote_versions→quotes (id,tenant_id) + →calculations (id,tenant_id);
 *     quote_version_lines→quote_versions (id,tenant_id); quote_version_attachments→
 *     quote_versions (id,tenant_id); quote_events→quotes (id,tenant_id)) — with the
 *     prerequisite `<parent>_id_tenant_unique` targets, incl. the NEW `quotes` +
 *     `quote_versions` `unique (id, tenant_id)` that this migration must add before
 *     their children reference them (the 5.1 contacts precedent);
 *   - lifecycle/status fields on `quote_versions` (a closed set draft/sent/accepted/
 *     rejected/expired/superseded) + a soft-delete `archived_at` where a lifecycle
 *     applies (NULL = active);
 *   - immutable snapshot fields on `quote_versions` (FULL company identity, terms +
 *     sign-off state, source calculation_id + captured_at);
 *   - `tenant_counters` = tenant-scoped counter keyed by `(tenant_id, counter_name)`
 *     with a `current_value bigint` and a `unique (tenant_id, counter_name)`;
 *   - integer-öre money columns (`*_ore bigint`) with a DB `CHECK (..._ore >= 0)`;
 *     VAT rate columns in BASIS POINTS (`*_bp`);
 *   - created_at/updated_at + the REUSED `public.set_updated_at()` BEFORE UPDATE trigger;
 *   - RLS ENABLE + FORCE on all six tables; own-tenant SELECT/INSERT/UPDATE policies
 *     built on the REUSED `is_tenant_admin` helper (NO DELETE policy — archive only);
 *   - explicit role GRANTs (authenticated SELECT/INSERT/UPDATE; service_role full DML;
 *     anon NONE);
 *   - NO Fortnox/invoice/customer-portal/external-mapping/supplier/credential/sync/
 *     import/api column ANYWHERE (AC1 guardrail); NO `numeric`/`double precision`/`real`
 *     money field (öre is `bigint`).
 *
 * ── GREEN (dev phase) ────────────────────────────────────────────────────────────
 * The 20260705120000_quote_version_model.sql migration has landed (Story 6.1 dev Task
 * 1), so the introspection queries below resolve — the `.skip` is REMOVED and the
 * describe block is re-labelled "green". This scaffold's assertions are now live.
 *
 * ── RELATIONSHIP TO THE EXISTING `migration-reset.int.test.ts` ───────────────────
 * This is the quote-specific companion. The EXISTING `migration-reset.int.test.ts`
 * asserts the COMPLETE `public` policy set as an EXACT enumeration; the six new tables'
 * SELECT/INSERT/UPDATE policies WILL FAIL-LOUD there the moment the migration lands
 * (the same signal 3.1 / 5.1 hit). The dev phase EXTENDS that file (add the six new
 * tables × SELECT/INSERT/UPDATE to the expected EXACT set + the tables to the
 * exists/RLS-forced checks), keeping the enumeration EXACT — never loosened to a
 * superset. This scaffold pins the quote half of that contract independently.
 *
 * Runs against the LOCAL Supabase stack only; skips visibly when unreachable.
 *
 * COVERAGE (test-design-epic-6.md 6.1-INT-01; story AC1 / Tasks 1, 2.2).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { assertSearchPathExactlyEmpty } from "../../support/search-path";

const QUOTE_TABLES = [
  "tenant_counters",
  "quotes",
  "quote_versions",
  "quote_version_lines",
  "quote_version_attachments",
  "quote_events",
] as const;

// The deferred-module tables AC1 forbids this story from creating.
const FORBIDDEN_TABLES = [
  "fortnox_tokens",
  "fortnox_sync",
  "integration_outbox",
  "external_mappings",
  "invoices",
  "customer_portal_sessions",
] as const;

let stackUp = false;
beforeAll(async () => {
  stackUp = await isLocalStackReachable();
});
afterAll(async () => {
  await closeAdminPool();
});

// GREEN as of Story 6.1 dev — the quote_version_model migration has landed (Task 1).
describe("Quote migration reset green — six new tenant-owned tables (AC1)", () => {
  it("[P0] the six quote tables exist after reset", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ table_name: string }>(
      `select table_name from information_schema.tables
         where table_schema = 'public' and table_name = any($1::text[])`,
      [[...QUOTE_TABLES]],
    );
    expect(rows.map((r) => r.table_name).sort()).toEqual([...QUOTE_TABLES].sort());
  });

  it("[P0/AC1] NO Fortnox/invoice/portal/external-mapping table is created", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Also catch any table whose NAME matches the deferred-integration shapes, not just
    // the exact list above (a smuggled `fortnox_*`/`*_external_*` table fails loud).
    const rows = await adminQuery<{ table_name: string }>(
      `select table_name from information_schema.tables
         where table_schema = 'public'
           and (table_name = any($1::text[])
                or table_name ~* '(fortnox|invoice|external_mapping|customer_portal)')`,
      [[...FORBIDDEN_TABLES]],
    );
    expect(rows).toEqual([]);
  });

  it("[P0] each quote table carries a NOT NULL tenant_id FK to public.tenants ON DELETE CASCADE", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const table of QUOTE_TABLES) {
      const nn = await adminQuery<{ is_nullable: string }>(
        `select is_nullable from information_schema.columns
           where table_schema = 'public' and table_name = $1
             and column_name = 'tenant_id'`,
        [table],
      );
      expect(nn[0]?.is_nullable).toBe("NO");

      const fk = await adminQuery<{ confdeltype: string }>(
        `select con.confdeltype
           from pg_constraint con
           join pg_class c on c.oid = con.conrelid
           join pg_namespace n on n.oid = c.relnamespace
           join pg_class fc on fc.oid = con.confrelid
          where con.contype = 'f' and n.nspname = 'public'
            and c.relname = $1 and fc.relname = 'tenants'`,
        [table],
      );
      expect(fk.some((r) => r.confdeltype === "c")).toBe(true);
    }
  });

  it("[P0] quotes + quote_versions carry their own unique (id, tenant_id) (composite-FK targets)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Needed as the composite-FK target for their children (version/line/attachment/event).
    for (const table of ["quotes", "quote_versions"] as const) {
      const rows = await adminQuery<{ def: string }>(
        `select pg_get_constraintdef(oid) as def from pg_constraint
           where conrelid = ('public.' || $1)::regclass and contype = 'u'`,
        [table],
      );
      expect(rows.some((r) => /\(id,\s*tenant_id\)/i.test(r.def))).toBe(true);
    }
  });

  it("[P0] quote parent links use COMPOSITE same-tenant FKs to (id, tenant_id)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // quotes(customer_id,tenant_id) → customers(id,tenant_id) [required]
    const quoteFk = await adminQuery<{ fdef: string }>(
      `select pg_get_constraintdef(con.oid) as fdef
         from pg_constraint con join pg_class c on c.oid = con.conrelid
        where con.contype = 'f' and c.relname = 'quotes'`,
    );
    expect(
      quoteFk.some(
        (r) =>
          /\(customer_id,\s*tenant_id\)/i.test(r.fdef) &&
          /customers\s*\(id,\s*tenant_id\)/i.test(r.fdef),
      ),
    ).toBe(true);

    // quote_versions(quote_id,tenant_id) → quotes(id,tenant_id)
    // quote_versions(calculation_id,tenant_id) → calculations(id,tenant_id)
    const verFk = await adminQuery<{ fdef: string }>(
      `select pg_get_constraintdef(con.oid) as fdef
         from pg_constraint con join pg_class c on c.oid = con.conrelid
        where con.contype = 'f' and c.relname = 'quote_versions'`,
    );
    expect(
      verFk.some(
        (r) =>
          /\(quote_id,\s*tenant_id\)/i.test(r.fdef) &&
          /quotes\s*\(id,\s*tenant_id\)/i.test(r.fdef),
      ),
    ).toBe(true);
    expect(
      verFk.some(
        (r) =>
          /\(calculation_id,\s*tenant_id\)/i.test(r.fdef) &&
          /calculations\s*\(id,\s*tenant_id\)/i.test(r.fdef),
      ),
    ).toBe(true);

    // quote_version_lines(quote_version_id,tenant_id) → quote_versions(id,tenant_id)
    const lineFk = await adminQuery<{ fdef: string }>(
      `select pg_get_constraintdef(con.oid) as fdef
         from pg_constraint con join pg_class c on c.oid = con.conrelid
        where con.contype = 'f' and c.relname = 'quote_version_lines'`,
    );
    expect(
      lineFk.some(
        (r) =>
          /\(quote_version_id,\s*tenant_id\)/i.test(r.fdef) &&
          /quote_versions\s*\(id,\s*tenant_id\)/i.test(r.fdef),
      ),
    ).toBe(true);

    // quote_events(quote_id,tenant_id) → quotes(id,tenant_id)
    const evtFk = await adminQuery<{ fdef: string }>(
      `select pg_get_constraintdef(con.oid) as fdef
         from pg_constraint con join pg_class c on c.oid = con.conrelid
        where con.contype = 'f' and c.relname = 'quote_events'`,
    );
    expect(
      evtFk.some(
        (r) =>
          /\(quote_id,\s*tenant_id\)/i.test(r.fdef) &&
          /quotes\s*\(id,\s*tenant_id\)/i.test(r.fdef),
      ),
    ).toBe(true);
  });

  it("[P0] tenant_counters is keyed by (tenant_id, counter_name) with a bigint current_value", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // MANY-per-tenant-per-counter: a unique (tenant_id, counter_name), NOT unique(tenant_id).
    const uniq = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'public.tenant_counters'::regclass and contype = 'u'`,
    );
    expect(
      uniq.some((r) => /\(tenant_id,\s*counter_name\)/i.test(r.def)),
    ).toBe(true);
    const cv = await adminQuery<{ data_type: string }>(
      `select data_type from information_schema.columns
         where table_schema = 'public' and table_name = 'tenant_counters'
           and column_name = 'current_value'`,
    );
    expect(cv[0]?.data_type).toBe("bigint");
  });

  it("[P0] quote_versions has the lifecycle status CHECK over the closed 6-value union", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'public.quote_versions'::regclass and contype = 'c'`,
    );
    const defs = rows.map((r) => r.def).join("\n");
    expect(defs).toMatch(
      /status[\s\S]*'draft'[\s\S]*'sent'[\s\S]*'accepted'[\s\S]*'rejected'[\s\S]*'expired'[\s\S]*'superseded'/i,
    );
  });

  it("[P0] quote_versions carries immutable snapshot fields (FULL identity + source refs)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const cols = await adminQuery<{ column_name: string }>(
      `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = 'quote_versions'`,
    );
    const names = cols.map((c) => c.column_name);
    // source refs
    expect(names).toContain("calculation_id");
    expect(names).toContain("captured_at");
    // FULL company identity — NOT the identity-partial CompanySettingsSnapshot variant.
    // (Exact column names are the dev's to finalize; assert the identity-bearing set
    //  the PDF/Story 6.3 legally needs is present so a naive partial reuse fails loud.)
    for (const needed of [
      "company_org_nr",
      "company_address_line1",
      "company_postal_code",
      "company_city",
      "company_email",
      "company_phone",
      "company_name",
    ]) {
      expect(names).toContain(needed);
    }
    // terms + sign-off state captured verbatim (NULL approved_at = not-approved).
    expect(names).toContain("terms_approved_at");
  });

  it("[P0] money columns are bigint integer öre + a >= 0 CHECK; VAT in basis points", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const oreCols = await adminQuery<{ column_name: string; data_type: string }>(
      `select column_name, data_type from information_schema.columns
         where table_schema = 'public' and table_name = any($1::text[])
           and column_name like '%\\_ore'`,
      [[...QUOTE_TABLES]],
    );
    expect(oreCols.length).toBeGreaterThan(0);
    for (const r of oreCols) expect(r.data_type).toBe("bigint");

    // at least one öre column carries a >= 0 CHECK on quote_versions.
    const checks = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'public.quote_versions'::regclass and contype = 'c'`,
    );
    expect(checks.map((r) => r.def).join("\n")).toMatch(/_ore\s*>=\s*\(?0\)?/i);

    // NO numeric/double/real money field anywhere (öre stays bigint).
    const badMoney = await adminQuery<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
         where table_schema = 'public' and table_name = any($1::text[])
           and column_name like '%\\_ore'
           and data_type in ('numeric','double precision','real')`,
      [[...QUOTE_TABLES]],
    );
    expect(badMoney).toEqual([]);

    // VAT rate columns are basis points (integer *_bp), never a float rate.
    const bpCols = await adminQuery<{ column_name: string; data_type: string }>(
      `select column_name, data_type from information_schema.columns
         where table_schema = 'public' and table_name = any($1::text[])
           and column_name like '%\\_bp'`,
      [[...QUOTE_TABLES]],
    );
    for (const r of bpCols) expect(r.data_type).toMatch(/^(integer|bigint|smallint)$/);
  });

  it("[P0] each quote table has created_at/updated_at + a set_updated_at trigger", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const table of QUOTE_TABLES) {
      const cols = await adminQuery<{ column_name: string }>(
        `select column_name from information_schema.columns
           where table_schema = 'public' and table_name = $1
             and column_name = any($2::text[])`,
        [table, ["created_at", "updated_at"]],
      );
      const names = cols.map((c) => c.column_name);
      expect(names).toContain("created_at");
      expect(names).toContain("updated_at");
      const trig = await adminQuery<{ tgname: string }>(
        `select t.tgname from pg_trigger t
           join pg_class c on c.oid = t.tgrelid
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = $1 and not t.tgisinternal`,
        [table],
      );
      expect(trig.length).toBeGreaterThan(0);
    }
  });

  it("[P0] RLS is ENABLED and FORCED on all six quote tables", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `select c.relname, c.relrowsecurity, c.relforcerowsecurity
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
          and c.relname = any($1::text[])`,
      [[...QUOTE_TABLES]],
    );
    expect(rows).toHaveLength(QUOTE_TABLES.length);
    for (const row of rows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
    }
  });

  it("[P0/AC1] each quote table has own-tenant SELECT/INSERT/UPDATE policies — NO DELETE policy", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ tablename: string; cmd: string; qual: string | null }>(
      `select tablename, cmd, qual::text as qual from pg_policies
         where schemaname = 'public' and tablename = any($1::text[])`,
      [[...QUOTE_TABLES]],
    );
    for (const table of QUOTE_TABLES) {
      const forTable = rows.filter((r) => r.tablename === table);
      const cmds = forTable.map((r) => r.cmd).sort();
      expect(cmds).toContain("SELECT");
      expect(cmds).toContain("INSERT");
      expect(cmds).toContain("UPDATE");
      expect(cmds).not.toContain("DELETE"); // archive over hard delete
      expect(forTable.some((r) => (r.qual ?? "").includes("is_tenant_admin"))).toBe(true);
    }
  });

  it("[P0] GRANTs: authenticated SELECT/INSERT/UPDATE (no DELETE); anon NOTHING", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ grantee: string; privilege_type: string }>(
      `select grantee, privilege_type from information_schema.role_table_grants
         where table_schema = 'public' and table_name = any($1::text[])`,
      [[...QUOTE_TABLES]],
    );
    const authed = rows
      .filter((r) => r.grantee === "authenticated")
      .map((r) => r.privilege_type);
    expect(authed).toContain("SELECT");
    expect(authed).toContain("INSERT");
    expect(authed).toContain("UPDATE");
    expect(authed).not.toContain("DELETE");
    // anon holds NONE of the four DML privileges (Supabase's default non-DML
    // REFERENCES/TRIGGER/TRUNCATE on new public tables is fine — assert DML-empty).
    const DML = ["SELECT", "INSERT", "UPDATE", "DELETE"];
    const anonDml = rows
      .filter((r) => r.grantee === "anon")
      .map((r) => r.privilege_type)
      .filter((p) => DML.includes(p));
    expect(anonDml).toEqual([]);
  });

  it("[P0/AC1] no supplier/credential/sync/import/external/fortnox/api column on any quote table", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
         where table_schema = 'public' and table_name = any($1::text[])`,
      [[...QUOTE_TABLES]],
    );
    const forbidden =
      /(supplier|credential|api_key|apikey|sync|import|external|fortnox|edi|mapping)/i;
    const offenders = rows.filter((r) => forbidden.test(r.column_name));
    expect(offenders).toEqual([]);
  });

  it("[P0/R-607] quote_version_lines carries NO cost/margin/internal-note column (customer-visible only)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ column_name: string }>(
      `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = 'quote_version_lines'`,
    );
    const cols = rows.map((r) => r.column_name);
    // The customer-visible line snapshot must NOT carry any cost/margin/internal field
    // (R-607 — the calc row carries unit_cost_ore/markup_bp/internal_note; the snapshot
    // drops them by construction).
    const forbidden = /(unit_cost_ore|cost_ore|markup|margin|internal)/i;
    expect(cols.filter((c) => forbidden.test(c))).toEqual([]);
    // It MUST carry the customer-visible sell + net öre + VAT bp.
    expect(cols).toContain("unit_sell_ore");
    expect(cols).toContain("line_net_ore");
    expect(cols).toContain("vat_rate_bp");
  });

  it("[P0/AC2] create_quote_version_from_calculation RPC is SECURITY INVOKER, empty search_path, revoke-from-public", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{
      prosecdef: boolean;
      proconfig: string[] | null;
    }>(
      `select prosecdef, proconfig from pg_proc
         where proname = 'create_quote_version_from_calculation'`,
    );
    expect(rows).toHaveLength(1);
    // SECURITY INVOKER (ADR-A009 default) — runs under the caller's RLS, NOT definer.
    expect(rows[0]?.prosecdef).toBe(false);
    // Fixed EXACTLY-EMPTY search_path (defensive hardening).
    assertSearchPathExactlyEmpty(
      "create_quote_version_from_calculation",
      rows[0]?.proconfig ?? null,
    );
    // anon has NO EXECUTE (revoke-from-public + grant-to-authenticated/service_role only).
    const grants = await adminQuery<{ grantee: string }>(
      `select grantee from information_schema.role_routine_grants
         where routine_name = 'create_quote_version_from_calculation'`,
    );
    const grantees = grants.map((g) => g.grantee);
    expect(grantees).toContain("authenticated");
    expect(grantees).toContain("service_role");
    expect(grantees).not.toContain("anon");
  });
});
