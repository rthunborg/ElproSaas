/**
 * Story 5.1 — ATDD RED-PHASE scaffold: calculation migration-reset proof
 * (AC1/AC4/AC6/AC7, P0 — 5.1-INT-01/05).
 *
 * Asserts that after `supabase db reset` (empty → migrate → seed) the new
 * `calculation_data_model` migration created `calculations`/`calculation_sections`/
 * `calculation_rows` with the exact schema contract:
 *   - a DIRECT `tenant_id` NOT NULL FK → public.tenants ON DELETE CASCADE per table;
 *   - the COMPOSITE same-tenant parent FKs (calc→customers/facilities/contacts (id,tenant_id);
 *     section→calculations (id,tenant_id); row→calculation_sections (id,tenant_id)) —
 *     with the prerequisite `<t>_id_tenant_unique` UNIQUE targets (incl. the ADDITIVE
 *     `contacts_id_tenant_unique` that did NOT exist before this story);
 *   - lifecycle/status fields + a soft-delete `archived_at` (NULL = active);
 *   - ordering columns (`sort_order`);
 *   - integer-öre money columns (`bigint`) with a DB `CHECK (..._ore >= 0)`;
 *   - a decimal `quantity` (numeric) with `CHECK (quantity > 0)` + a `unit`;
 *   - `row_type` CHECK over the closed 5-value union;
 *   - created_at/updated_at + the REUSED `public.set_updated_at()` BEFORE UPDATE trigger;
 *   - RLS ENABLE + FORCE; own-tenant SELECT/INSERT/UPDATE policies (NO DELETE policy);
 *   - explicit role GRANTs (authenticated SELECT/INSERT/UPDATE; service_role full DML;
 *     anon NONE);
 *   - NO deferred job/project/field-worker table; NO supplier/credential/sync/import/
 *     external-mapping/API column on any calc table (AC7 guardrail); NO `numeric`/`double
 *     precision`/`real` money field (öre is `bigint`).
 *
 * ── WHY `describe.skip` (RED PHASE) ─────────────────────────────────────────────
 * The migration does not exist yet (Story 5.1 dev Task 1). Until it lands, the
 * introspection queries below return nothing → these assertions FAIL by design. Kept
 * skipped (project red-phase idiom — Story 3.1 used the same) so they do not break the
 * green tree before the migration is written; the dev phase removes `.skip`.
 *
 * ── RELATIONSHIP TO THE EXISTING `migration-reset.int.test.ts` ───────────────────
 * This is the calc-specific companion. The EXISTING `migration-reset.int.test.ts`
 * asserts the COMPLETE `public` policy set as an EXACT enumeration; the calc
 * SELECT/INSERT/UPDATE policies WILL FAIL-LOUD there the moment the migration lands
 * (Task 6.1 — the same signal Story 3.1 hit). The dev phase EXTENDS that file (add the
 * three calc tables × SELECT/INSERT/UPDATE to the expected EXACT set + the tables to the
 * exists/RLS-forced checks), keeping the enumeration EXACT — never loosened to a
 * superset. This scaffold pins the calc half of that contract independently.
 *
 * Runs against the LOCAL Supabase stack only; skips visibly when unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

const CALC_TABLES = [
  "calculations",
  "calculation_sections",
  "calculation_rows",
] as const;

// The deferred-module tables AC1/AC7 forbid this story from creating. NOTE (Story 7.1
// reconcile): `jobs` was a DEFERRED table at Epic-5 time (Story 5.1 must not create it), but
// Epic 7 SANCTIONS it — `jobs` is now a real tenant-owned commitment table created by
// `20260709120000_acceptance_to_job_model.sql`. It is removed from this Epic-5 forbidden list
// (this test proves the CALC migration did not smuggle it; the query is schema-wide, so once
// `jobs` legitimately lands it can no longer appear here). `projects`/`field_workers` remain
// deferred (no epic creates them in Phase A).
const FORBIDDEN_TABLES = ["projects", "field_workers"] as const;

let stackUp = false;
beforeAll(async () => {
  stackUp = await isLocalStackReachable();
});
afterAll(async () => {
  await closeAdminPool();
});

// Green as of Story 5.1 dev — the calculation_data_model migration has landed (Task 1).
describe("Calc migration reset green — calculations/sections/rows (AC1)", () => {
  it("[P0] the three calc tables exist after reset", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ table_name: string }>(
      `select table_name from information_schema.tables
         where table_schema = 'public' and table_name = any($1::text[])`,
      [[...CALC_TABLES]],
    );
    expect(rows.map((r) => r.table_name).sort()).toEqual([...CALC_TABLES].sort());
  });

  it("[P0/AC1] NO deferred job/project/field-worker table is created", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ table_name: string }>(
      `select table_name from information_schema.tables
         where table_schema = 'public' and table_name = any($1::text[])`,
      [[...FORBIDDEN_TABLES]],
    );
    expect(rows).toEqual([]);
  });

  it("[P0] each calc table carries a NOT NULL tenant_id FK to public.tenants ON DELETE CASCADE", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const table of CALC_TABLES) {
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
      // a tenant_id → tenants(id) FK with ON DELETE CASCADE ('c') must exist.
      expect(fk.some((r) => r.confdeltype === "c")).toBe(true);
    }
  });

  it("[P0] contacts additively gained contacts_id_tenant_unique (composite-FK prerequisite)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // The MIGRATION-FAILURE TRAP: contacts had NO unique (id, tenant_id) before 5.1.
    // A composite same-tenant FK from calculations.contact_id REQUIRES it — the new
    // migration must additively add it or the reset fails to apply.
    const rows = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'public.contacts'::regclass and contype = 'u'`,
    );
    expect(rows.some((r) => /\(id,\s*tenant_id\)/i.test(r.def))).toBe(true);
  });

  it("[P0] calculations + calculation_sections carry their own unique (id, tenant_id)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Needed as the composite-FK target for their children (section/row).
    for (const table of ["calculations", "calculation_sections"] as const) {
      const rows = await adminQuery<{ def: string }>(
        `select pg_get_constraintdef(oid) as def from pg_constraint
           where conrelid = ('public.' || $1)::regclass and contype = 'u'`,
        [table],
      );
      expect(rows.some((r) => /\(id,\s*tenant_id\)/i.test(r.def))).toBe(true);
    }
  });

  it("[P0] calc parent links use COMPOSITE same-tenant FKs to (id, tenant_id)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // calculations(customer_id,tenant_id) → customers(id,tenant_id); optional
    // facility_id/contact_id composite FKs to facilities/contacts (id,tenant_id).
    const calcFk = await adminQuery<{ fdef: string }>(
      `select pg_get_constraintdef(con.oid) as fdef
         from pg_constraint con join pg_class c on c.oid = con.conrelid
        where con.contype = 'f' and c.relname = 'calculations'`,
    );
    expect(
      calcFk.some(
        (r) =>
          /\(customer_id,\s*tenant_id\)/i.test(r.fdef) &&
          /customers\s*\(id,\s*tenant_id\)/i.test(r.fdef),
      ),
    ).toBe(true);
    expect(
      calcFk.some(
        (r) =>
          /\(contact_id,\s*tenant_id\)/i.test(r.fdef) &&
          /contacts\s*\(id,\s*tenant_id\)/i.test(r.fdef),
      ),
    ).toBe(true);

    // calculation_sections(calculation_id,tenant_id) → calculations(id,tenant_id)
    const secFk = await adminQuery<{ fdef: string }>(
      `select pg_get_constraintdef(con.oid) as fdef
         from pg_constraint con join pg_class c on c.oid = con.conrelid
        where con.contype = 'f' and c.relname = 'calculation_sections'`,
    );
    expect(
      secFk.some(
        (r) =>
          /\(calculation_id,\s*tenant_id\)/i.test(r.fdef) &&
          /calculations\s*\(id,\s*tenant_id\)/i.test(r.fdef),
      ),
    ).toBe(true);

    // calculation_rows(section_id,tenant_id) → calculation_sections(id,tenant_id)
    const rowFk = await adminQuery<{ fdef: string }>(
      `select pg_get_constraintdef(con.oid) as fdef
         from pg_constraint con join pg_class c on c.oid = con.conrelid
        where con.contype = 'f' and c.relname = 'calculation_rows'`,
    );
    expect(
      rowFk.some(
        (r) =>
          /\(section_id,\s*tenant_id\)/i.test(r.fdef) &&
          /calculation_sections\s*\(id,\s*tenant_id\)/i.test(r.fdef),
      ),
    ).toBe(true);
  });

  it("[P0] calculation_rows has the row_type CHECK over the closed 5-value union", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'public.calculation_rows'::regclass and contype = 'c'`,
    );
    const defs = rows.map((r) => r.def).join("\n");
    expect(defs).toMatch(
      /row_type[\s\S]*'labor'[\s\S]*'material'[\s\S]*'subcontractor'[\s\S]*'machinery'[\s\S]*'other'/i,
    );
  });

  it("[P0] calculation_rows enforces quantity > 0 and integer-öre money CHECK (..._ore >= 0)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'public.calculation_rows'::regclass and contype = 'c'`,
    );
    const defs = rows.map((r) => r.def).join("\n");
    // Postgres normalizes the CHECK body via pg_get_constraintdef — a bare `0` in the
    // source becomes `(0)::numeric` for the numeric `quantity` column. Tolerate the
    // parenthesized/cast form so the assertion pins the SEMANTICS (quantity > 0), not
    // the exact source text.
    expect(defs).toMatch(/quantity\s*>\s*\(?0\)?(?:::numeric)?/i);
    // At least one öre money column carries a `>= 0` CHECK (bigint keeps the bare 0).
    expect(defs).toMatch(/_ore\s*>=\s*\(?0\)?/i);
  });

  it("[P0] money columns are bigint integer öre — NO numeric/double/real money field", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ column_name: string; data_type: string }>(
      `select column_name, data_type from information_schema.columns
         where table_schema = 'public' and table_name = any($1::text[])
           and column_name like '%\\_ore'`,
      [[...CALC_TABLES]],
    );
    // there IS at least one öre money column, and EVERY öre column is bigint.
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.data_type).toBe("bigint");
  });

  it("[P0] each calc table has archive/timestamp columns + a set_updated_at trigger", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const table of CALC_TABLES) {
      const cols = await adminQuery<{ column_name: string }>(
        `select column_name from information_schema.columns
           where table_schema = 'public' and table_name = $1
             and column_name = any($2::text[])`,
        [table, ["archived_at", "created_at", "updated_at", "sort_order"]],
      );
      const names = cols.map((c) => c.column_name);
      expect(names).toContain("archived_at");
      expect(names).toContain("created_at");
      expect(names).toContain("updated_at");
      // A BEFORE UPDATE trigger wired to the REUSED public.set_updated_at().
      const trig = await adminQuery<{ tgname: string }>(
        `select t.tgname from pg_trigger t
           join pg_class c on c.oid = t.tgrelid
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = $1 and not t.tgisinternal`,
        [table],
      );
      expect(trig.length).toBeGreaterThan(0);
    }
    // ordering columns live on sections + rows (not the calc header).
    for (const table of ["calculation_sections", "calculation_rows"] as const) {
      const so = await adminQuery<{ column_name: string }>(
        `select column_name from information_schema.columns
           where table_schema = 'public' and table_name = $1
             and column_name = 'sort_order'`,
        [table],
      );
      expect(so.length).toBe(1);
    }
  });

  it("[P0] RLS is ENABLED and FORCED on all three calc tables", async (testCtx) => {
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
      [[...CALC_TABLES]],
    );
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
    }
  });

  it("[P0/AC7] each calc table has own-tenant SELECT/INSERT/UPDATE policies — NO DELETE policy (archive only)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ tablename: string; cmd: string; qual: string | null }>(
      `select tablename, cmd, qual::text as qual from pg_policies
         where schemaname = 'public' and tablename = any($1::text[])`,
      [[...CALC_TABLES]],
    );
    for (const table of CALC_TABLES) {
      const forTable = rows.filter((r) => r.tablename === table);
      const cmds = forTable.map((r) => r.cmd).sort();
      expect(cmds).toContain("SELECT");
      expect(cmds).toContain("INSERT");
      expect(cmds).toContain("UPDATE");
      expect(cmds).not.toContain("DELETE"); // archive over hard delete
      // own-tenant policies are built on the REUSED is_tenant_admin helper.
      expect(forTable.some((r) => (r.qual ?? "").includes("is_tenant_admin"))).toBe(true);
    }
  });

  it("[P0] GRANTs: authenticated SELECT/INSERT/UPDATE (no DELETE); anon NOTHING", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ grantee: string; privilege_type: string }>(
      `select grantee, privilege_type from information_schema.role_table_grants
         where table_schema = 'public' and table_name = any($1::text[])`,
      [[...CALC_TABLES]],
    );
    const authed = rows
      .filter((r) => r.grantee === "authenticated")
      .map((r) => r.privilege_type);
    expect(authed).toContain("SELECT");
    expect(authed).toContain("INSERT");
    expect(authed).toContain("UPDATE");
    expect(authed).not.toContain("DELETE"); // DELETE not granted — archive via archived_at
    // anon has NO DML grant (SELECT/INSERT/UPDATE/DELETE) on the calc tables — the
    // migrations never grant anon any DML. Supabase's default schema privileges DO
    // hand every role (anon included) the non-DML REFERENCES/TRIGGER/TRUNCATE on new
    // public tables (the existing CRM/pricing tables carry the same), so assert
    // specifically that anon holds NONE of the four data-access privileges, not that
    // it has zero rows — matching crm-tables-migration-reset.int.test.ts.
    const DML = ["SELECT", "INSERT", "UPDATE", "DELETE"];
    const anonDml = rows
      .filter((r) => r.grantee === "anon")
      .map((r) => r.privilege_type)
      .filter((p) => DML.includes(p));
    expect(anonDml).toEqual([]);
  });

  it("[P0/AC7] no supplier/credential/sync/import/external-mapping/API column on any calc table", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
         where table_schema = 'public' and table_name = any($1::text[])`,
      [[...CALC_TABLES]],
    );
    const forbidden =
      /(supplier|credential|api_key|apikey|sync|import|external|fortnox|mapping)/i;
    const offenders = rows.filter((r) => forbidden.test(r.column_name));
    expect(offenders).toEqual([]);
  });
});
