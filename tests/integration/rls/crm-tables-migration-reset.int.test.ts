/**
 * Story 3.1 — ATDD RED-PHASE scaffold: CRM migration-reset proof (AC1/AC2/AC5/AC7, P0).
 *
 * Asserts that after `supabase db reset` (empty → migrate → seed) the new
 * `crm_data_model` migration created `customers`/`facilities`/`contacts` with the
 * exact schema contract: direct `tenant_id` FK (on delete cascade), archive column,
 * timestamps + `set_updated_at` trigger, the COMPOSITE same-tenant parent FKs, the
 * customer_type CHECK + identifier-by-type CHECK, RLS ENABLE+FORCE, helper-scoped
 * own-tenant policies, explicit role GRANTs (authenticated SELECT/INSERT/UPDATE;
 * service_role full DML; anon none), and NO personnummer leakage beyond the single
 * `private` field / NO supplier-scope fields (AC7 guardrail).
 *
 * ── WHY `describe.skip` (RED PHASE) ─────────────────────────────────────────────
 * The migration does not exist yet (Story 3.1 dev Task 1). Until it lands, the
 * introspection queries below return nothing → these assertions FAIL by design. Kept
 * skipped (project red-phase idiom) so they do not break the green tree before the
 * migration is written; the dev phase removes `.skip`.
 *
 * ── RELATIONSHIP TO THE EXISTING `migration-reset.int.test.ts` ───────────────────
 * This is the CRM-specific companion. The EXISTING `migration-reset.int.test.ts`
 * (lines ~112-130) has TWO assertions hardcoded to the tenant_foundation/audit set
 * that WILL FAIL-LOUD when CRM lands, BY DESIGN (Task 5.2): (1) the EXACT
 * public-policy enumeration `["audit_events.SELECT","tenant_memberships.SELECT",
 * "tenants.SELECT"]` + the "every policy is SELECT" invariant — both broken by the
 * CRM INSERT/UPDATE policies; (2) it does not yet assert the three new tables. The
 * dev phase EXTENDS that file (add the CRM INSERT/UPDATE/SELECT policies to the
 * expected set, REPLACE the blanket "every policy is SELECT" with a per-table
 * expectation, add the three tables to the exists + RLS-forced checks) — keeping it
 * an EXACT enumeration, never a loose superset. This scaffold pins the CRM half of
 * that contract.
 *
 * Runs against the LOCAL Supabase stack only; skips visibly when unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

const CRM_TABLES = ["customers", "facilities", "contacts"] as const;

let stackUp = false;
beforeAll(async () => {
  stackUp = await isLocalStackReachable();
});
afterAll(async () => {
  await closeAdminPool();
});

// Un-gated (Story 3.1 dev): the crm_data_model migration has landed (Task 1).
describe("CRM migration reset green — customers/facilities/contacts (AC1/AC5)", () => {
  it("[P0] the three CRM tables exist after reset", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ table_name: string }>(
      `select table_name from information_schema.tables
         where table_schema = 'public'
           and table_name = any($1::text[])`,
      [[...CRM_TABLES]],
    );
    expect(rows.map((r) => r.table_name).sort()).toEqual([...CRM_TABLES].sort());
  });

  it("[P0] each CRM table carries a NOT NULL tenant_id FK to public.tenants ON DELETE CASCADE", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const table of CRM_TABLES) {
      const nn = await adminQuery<{ is_nullable: string }>(
        `select is_nullable from information_schema.columns
           where table_schema = 'public' and table_name = $1
             and column_name = 'tenant_id'`,
        [table],
      );
      expect(nn[0]?.is_nullable).toBe("NO");

      const fk = await adminQuery<{ confdeltype: string; fdef: string }>(
        `select con.confdeltype, pg_get_constraintdef(con.oid) as fdef
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

  it("[P0] facilities + contacts have a COMPOSITE same-tenant FK to the parent (id, tenant_id)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // facilities(customer_id, tenant_id) → customers(id, tenant_id)
    const facFk = await adminQuery<{ fdef: string }>(
      `select pg_get_constraintdef(con.oid) as fdef
         from pg_constraint con
         join pg_class c on c.oid = con.conrelid
        where con.contype = 'f' and c.relname = 'facilities'`,
    );
    expect(
      facFk.some(
        (r) =>
          /\(customer_id,\s*tenant_id\)/i.test(r.fdef) &&
          /customers\s*\(id,\s*tenant_id\)/i.test(r.fdef),
      ),
    ).toBe(true);

    // contacts(customer_id, tenant_id) → customers(id, tenant_id) AND an OPTIONAL
    // contacts(facility_id, tenant_id) → facilities(id, tenant_id).
    const conFk = await adminQuery<{ fdef: string }>(
      `select pg_get_constraintdef(con.oid) as fdef
         from pg_constraint con
         join pg_class c on c.oid = con.conrelid
        where con.contype = 'f' and c.relname = 'contacts'`,
    );
    expect(
      conFk.some(
        (r) =>
          /\(customer_id,\s*tenant_id\)/i.test(r.fdef) &&
          /customers\s*\(id,\s*tenant_id\)/i.test(r.fdef),
      ),
    ).toBe(true);
    expect(
      conFk.some(
        (r) =>
          /\(facility_id,\s*tenant_id\)/i.test(r.fdef) &&
          /facilities\s*\(id,\s*tenant_id\)/i.test(r.fdef),
      ),
    ).toBe(true);
  });

  it("[P0] customers has the customer_type CHECK (private,company,brf,public) + identifier-by-type CHECK", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'public.customers'::regclass and contype = 'c'`,
    );
    const defs = rows.map((r) => r.def).join("\n");
    expect(defs).toMatch(/customer_type[\s\S]*'private'[\s\S]*'company'[\s\S]*'brf'[\s\S]*'public'/i);
    // identifier-by-type: a private customer never carries org_nr; a non-private
    // never carries personnummer (the table CHECK; requiredness is command-layer).
    expect(defs).toMatch(/personnummer/i);
    expect(defs).toMatch(/org_nr/i);
  });

  it("[P0] each CRM table has a soft-delete archive column + created_at/updated_at + set_updated_at trigger", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const table of CRM_TABLES) {
      const cols = await adminQuery<{ column_name: string }>(
        `select column_name from information_schema.columns
           where table_schema = 'public' and table_name = $1
             and column_name = any($2::text[])`,
        [table, ["archived_at", "created_at", "updated_at"]],
      );
      expect(cols.map((c) => c.column_name).sort()).toEqual([
        "archived_at",
        "created_at",
        "updated_at",
      ]);
      // A BEFORE UPDATE trigger wired to the EXISTING public.set_updated_at().
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

  it("[P0] RLS is ENABLED and FORCED on all three CRM tables", async (testCtx) => {
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
      [[...CRM_TABLES]],
    );
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
    }
  });

  it("[P0] each CRM table has own-tenant SELECT/INSERT/UPDATE policies (no DELETE policy — archive only)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ tablename: string; cmd: string }>(
      `select tablename, cmd from pg_policies
         where schemaname = 'public' and tablename = any($1::text[])`,
      [[...CRM_TABLES]],
    );
    for (const table of CRM_TABLES) {
      const cmds = rows
        .filter((r) => r.tablename === table)
        .map((r) => r.cmd)
        .sort();
      // SELECT/INSERT/UPDATE present; DELETE absent (archive over hard delete).
      expect(cmds).toContain("SELECT");
      expect(cmds).toContain("INSERT");
      expect(cmds).toContain("UPDATE");
      expect(cmds).not.toContain("DELETE");
    }
  });

  it("[P0][11.2] GRANTs: authenticated SELECT only; audited wrappers own writes; anon NOTHING", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ grantee: string; privilege_type: string }>(
      `select grantee, privilege_type from information_schema.role_table_grants
         where table_schema = 'public' and table_name = any($1::text[])`,
      [[...CRM_TABLES]],
    );
    const authed = rows
      .filter((r) => r.grantee === "authenticated")
      .map((r) => r.privilege_type);
    expect(authed).toContain("SELECT");
    expect(authed).not.toContain("INSERT");
    expect(authed).not.toContain("UPDATE");
    expect(authed).not.toContain("DELETE");
    // anon has NO DML grant (SELECT/INSERT/UPDATE/DELETE) on the CRM tables — the
    // load-bearing isolation contract. NOTE: Supabase's default privileges grant
    // every role (anon included) the non-DML REFERENCES/TRIGGER/TRUNCATE on new
    // `public` tables (the foundation tables tenants/tenant_memberships/audit_events
    // carry the same anon REFERENCES/TRIGGER/TRUNCATE), so assert specifically that
    // anon holds NONE of the four data-access privileges, not that it has zero rows.
    const DML = ["SELECT", "INSERT", "UPDATE", "DELETE"];
    const anonDml = rows
      .filter((r) => r.grantee === "anon")
      .map((r) => r.privilege_type)
      .filter((p) => DML.includes(p));
    expect(anonDml).toEqual([]);
  });

  it("[P0/AC7] no supplier/credential/sync/import/external-mapping column appears on any CRM table", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
         where table_schema = 'public' and table_name = any($1::text[])`,
      [[...CRM_TABLES]],
    );
    const forbidden = /(supplier|credential|api_key|sync|import|external|fortnox|mapping)/i;
    const offenders = rows.filter((r) => forbidden.test(r.column_name));
    expect(offenders).toEqual([]);
  });

  it("[P0/AC2] personnummer exists ONLY on customers, on no other CRM table", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ table_name: string }>(
      `select table_name from information_schema.columns
         where table_schema = 'public' and column_name = 'personnummer'
           and table_name = any($1::text[])`,
      [[...CRM_TABLES]],
    );
    expect(rows.map((r) => r.table_name).sort()).toEqual(["customers"]);
  });
});
