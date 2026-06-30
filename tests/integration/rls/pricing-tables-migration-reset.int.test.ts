/**
 * Story 3.4 — ATDD RED-PHASE scaffold: pricing migration-reset proof (AC1/AC2/AC3/AC4,
 * P0). Asserts that after `supabase db reset` (empty → migrate → seed) the new
 * `work_roles_and_articles` migration created `work_roles`/`articles` with the exact
 * schema contract: direct `tenant_id` FK (on delete cascade), the INTEGER-ÖRE money
 * columns (bigint) + their non-negative CHECKs, an `is_active` lifecycle column,
 * timestamps + the EXISTING `set_updated_at` trigger, RLS ENABLE+FORCE, helper-scoped
 * own-tenant SELECT/INSERT/UPDATE policies (NO DELETE — archive over hard delete),
 * explicit role GRANTs (authenticated SELECT/INSERT/UPDATE; service_role full DML;
 * anon NONE of the four DML privileges), the COLLECTION shape (NO unique(tenant_id)),
 * and the HARD no-supplier-scope column-name guard.
 *
 * ── WHY `describe.skip` (RED PHASE) ──────────────────────────────────────────────
 * The migration does not exist yet (Story 3.4 dev Task 1). Until it lands the
 * introspection queries return nothing → these assertions FAIL by design. Kept skipped
 * (project red-phase idiom) so they do not break the green tree before the migration is
 * written; the dev phase removes `.skip`.
 *
 * ── RELATIONSHIP TO `migration-reset.int.test.ts` ────────────────────────────────
 * This is the pricing-specific companion (mirrors `crm-tables-migration-reset.int.test.ts`).
 * The EXISTING `migration-reset.int.test.ts` (lines ~135-181) has the EXACT public-policy
 * enumeration + the `crmAndSettingsTables` "SELECT/INSERT/UPDATE, no DELETE" group that
 * will FAIL-LOUD when these 6 new pricing policies land, BY DESIGN. The dev phase EXTENDS
 * that file (add `articles.{SELECT,INSERT,UPDATE}` + `work_roles.{SELECT,INSERT,UPDATE}`
 * alphabetically — `articles.*` sorts FIRST; add both tables to the group, renamed
 * `crmSettingsAndPricingTables`), keeping it an EXACT enumeration, never a loose superset.
 * This scaffold pins the pricing half of that contract.
 *
 * Runs against the LOCAL Supabase stack only; skips visibly when unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

const PRICING_TABLES = ["work_roles", "articles"] as const;

/** The integer-öre money columns per pricing table (the load-bearing money contract). */
const ORE_COLUMNS: Record<(typeof PRICING_TABLES)[number], readonly string[]> = {
  work_roles: ["cost_rate_ore", "sell_rate_ore"],
  articles: ["unit_price_ore"],
};

let stackUp = false;
beforeAll(async () => {
  stackUp = await isLocalStackReachable();
});
afterAll(async () => {
  await closeAdminPool();
});

describe.skip("Pricing migration reset green — work_roles/articles (AC1/AC2/AC3)", () => {
  it("[P0] the two pricing tables exist after reset", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ table_name: string }>(
      `select table_name from information_schema.tables
         where table_schema = 'public' and table_name = any($1::text[])`,
      [[...PRICING_TABLES]],
    );
    expect(rows.map((r) => r.table_name).sort()).toEqual([...PRICING_TABLES].sort());
  });

  it("[P0] each pricing table carries a NOT NULL tenant_id FK to public.tenants ON DELETE CASCADE", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const table of PRICING_TABLES) {
      const nn = await adminQuery<{ is_nullable: string }>(
        `select is_nullable from information_schema.columns
           where table_schema = 'public' and table_name = $1 and column_name = 'tenant_id'`,
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
      expect(fk.some((r) => r.confdeltype === "c")).toBe(true); // ON DELETE CASCADE
    }
  });

  it("[P0/AC2] the money columns are INTEGER öre (bigint), NEVER a float/numeric kronor type", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const table of PRICING_TABLES) {
      for (const col of ORE_COLUMNS[table]) {
        const rows = await adminQuery<{ data_type: string; is_nullable: string }>(
          `select data_type, is_nullable from information_schema.columns
             where table_schema = 'public' and table_name = $1 and column_name = $2`,
          [table, col],
        );
        expect(rows).toHaveLength(1);
        // bigint == the öre integer money contract. A `numeric`/`double precision`/`real`
        // kronor column is a HARD violation (Money discipline, architecture §10).
        expect(rows[0].data_type).toBe("bigint");
        expect(rows[0].is_nullable).toBe("NO");
      }
    }
  });

  it("[P0/AC2] each money column has a non-negative CHECK (belt-and-braces with the validator)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const table of PRICING_TABLES) {
      const rows = await adminQuery<{ def: string }>(
        `select pg_get_constraintdef(oid) as def from pg_constraint
           where conrelid = ('public.' || $1)::regclass and contype = 'c'`,
        [table],
      );
      const defs = rows.map((r) => r.def).join("\n");
      for (const col of ORE_COLUMNS[table]) {
        // A `col >= 0` CHECK must exist (forbids a negative öre amount at the DB).
        expect(defs).toMatch(new RegExp(`${col}\\s*>=\\s*0`, "i"));
      }
    }
  });

  it("[P0] each pricing table has an is_active lifecycle column + created_at/updated_at + set_updated_at trigger", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const table of PRICING_TABLES) {
      const cols = await adminQuery<{ column_name: string }>(
        `select column_name from information_schema.columns
           where table_schema = 'public' and table_name = $1
             and column_name = any($2::text[])`,
        [table, ["is_active", "created_at", "updated_at"]],
      );
      expect(cols.map((c) => c.column_name).sort()).toEqual([
        "created_at",
        "is_active",
        "updated_at",
      ]);
      const trig = await adminQuery<{ tgname: string }>(
        `select t.tgname from pg_trigger t
           join pg_class c on c.oid = t.tgrelid
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = $1 and not t.tgisinternal`,
        [table],
      );
      expect(trig.length).toBeGreaterThan(0); // BEFORE UPDATE → public.set_updated_at()
    }
  });

  it("[P0] COLLECTION shape — NO unique(tenant_id) on either table (many rows per tenant, UNLIKE Story 3.3 settings)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const table of PRICING_TABLES) {
      // Enumerate UNIQUE constraints + unique indexes; assert NONE is keyed on
      // exactly (tenant_id). A `unique (tenant_id)` would (wrongly) make the table a
      // one-row-per-tenant singleton — the opposite of the AC1 collection contract.
      const rows = await adminQuery<{ def: string }>(
        `select pg_get_constraintdef(con.oid) as def
           from pg_constraint con
          where con.conrelid = ('public.' || $1)::regclass and con.contype = 'u'
         union all
         select pg_get_indexdef(ix.indexrelid) as def
           from pg_index ix
           join pg_class c on c.oid = ix.indrelid
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = $1 and ix.indisunique`,
        [table],
      );
      const singletonUnique = rows.filter((r) => /UNIQUE[\s\S]*\(\s*tenant_id\s*\)/i.test(r.def));
      expect(singletonUnique).toEqual([]);
    }
  });

  it("[P0/AC4] RLS is ENABLED and FORCED on both pricing tables", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `select c.relname, c.relrowsecurity, c.relforcerowsecurity
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relname = any($1::text[])`,
      [[...PRICING_TABLES]],
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
    }
  });

  it("[P0/AC4] each pricing table has own-tenant SELECT/INSERT/UPDATE policies (no DELETE policy — archive only)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ tablename: string; cmd: string }>(
      `select tablename, cmd from pg_policies
         where schemaname = 'public' and tablename = any($1::text[])`,
      [[...PRICING_TABLES]],
    );
    for (const table of PRICING_TABLES) {
      const cmds = rows.filter((r) => r.tablename === table).map((r) => r.cmd).sort();
      expect(cmds).toContain("SELECT");
      expect(cmds).toContain("INSERT");
      expect(cmds).toContain("UPDATE");
      expect(cmds).not.toContain("DELETE");
    }
  });

  it("[P0/AC4] GRANTs: authenticated SELECT/INSERT/UPDATE (no DELETE); anon holds NONE of the four DML privileges", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ grantee: string; privilege_type: string }>(
      `select grantee, privilege_type from information_schema.role_table_grants
         where table_schema = 'public' and table_name = any($1::text[])`,
      [[...PRICING_TABLES]],
    );
    const authed = rows.filter((r) => r.grantee === "authenticated").map((r) => r.privilege_type);
    expect(authed).toContain("SELECT");
    expect(authed).toContain("INSERT");
    expect(authed).toContain("UPDATE");
    expect(authed).not.toContain("DELETE");
    // anon-DML-empty (NOT anon-grant-empty): Supabase grants every role the non-DML
    // REFERENCES/TRIGGER/TRUNCATE by default, so assert anon holds NONE of the four
    // DATA-access privileges, not zero grants overall.
    const DML = ["SELECT", "INSERT", "UPDATE", "DELETE"];
    const anonDml = rows
      .filter((r) => r.grantee === "anon")
      .map((r) => r.privilege_type)
      .filter((p) => DML.includes(p));
    expect(anonDml).toEqual([]);
  });

  it("[P0/AC3] HARD no-supplier-scope — NO supplier/credential/sync/import/external/api/fortnox/edi/mapping column on either pricing table", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Mirrors the CRM no-supplier-scope assertion (crm-tables-migration-reset). FAILS
    // LOUD if a future change smuggles supplier scope into work_roles/articles.
    const rows = await adminQuery<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
         where table_schema = 'public' and table_name = any($1::text[])`,
      [[...PRICING_TABLES]],
    );
    const forbidden = /(supplier|credential|api_key|api|sync|import|external|fortnox|edi|mapping|vendor)/i;
    const offenders = rows.filter((r) => forbidden.test(r.column_name));
    expect(offenders).toEqual([]);
  });
});
