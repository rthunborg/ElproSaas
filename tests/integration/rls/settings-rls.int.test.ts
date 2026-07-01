/**
 * Story 3.3 — ATDD RED-PHASE scaffold: H4 enrollment + migration-reset enumeration
 * + cross-tenant / anon-DML negatives for the two NEW tenant-owned settings tables
 * (`company_settings`, `quote_terms`).
 *
 * 🔴 RED PHASE — the suite is `describe.skip(...)` so the green CI baseline is
 * UNPERTURBED until dev (a) ships the migration creating the two tables with
 * enable+FORCE RLS, own-tenant `is_tenant_admin` SELECT/INSERT/UPDATE policies, and
 * `anon → none` grants, and (b) ENROLLS both tables in `tenant-table-inventory.ts`
 * (`TENANT_TABLES` + the cross-tenant AND anon-path metadata seams) and EXTENDS the
 * `migration-reset.int.test.ts` exact-policy enumeration.
 *
 * IMPORTANT — the cross-tenant + anon-path negatives themselves do NOT live here:
 * `cross-tenant-isolation.rls.test.ts` and `anon-path-isolation.rls.test.ts` BOTH
 * iterate `TENANT_TABLES`, so enrolling the two new tables there AUTO-extends those
 * data-driven suites (no per-table copy). This scaffold pins the ENROLLMENT contract
 * and the assert-the-mechanism expectations dev must satisfy, so the work is visible
 * and traceable in the RED phase.
 *
 * The LOAD-BEARING contracts this scaffold pins (the story encodes them):
 *   - H4 single-enrollment (P0, AC3): BOTH new tables present in `TENANT_TABLES`; the
 *     H4 inventory gate's live introspection includes them and the set-difference is
 *     EMPTY; the gate BITES if either is removed (assert-the-mechanism, not vacuous).
 *   - Migration-reset EXACT-policy enumeration EXTENDED, not loosened (P0, AC3): the
 *     public policy set grows by the 6 new entries (company_settings.SELECT/INSERT/
 *     UPDATE + quote_terms.SELECT/INSERT/UPDATE); NO DELETE policy anywhere.
 *   - Cross-tenant denial is "rls-invisible" (P0, AC3): both tables grant
 *     `authenticated` SELECT/INSERT/UPDATE, so a cross-tenant UPDATE matches ZERO rows
 *     (RLS USING) and an independent BYPASSRLS re-read proves Tenant B's row UNCHANGED;
 *     a cross-tenant INSERT spoofing B's tenant_id fails the WITH CHECK with 42501; no
 *     DELETE grant exists on the app path.
 *   - Anon-DML-empty (P0, AC3): anon SELECT/INSERT/UPDATE/DELETE on both tables denied
 *     (anon-DML-empty, NOT anon-grant-empty — Supabase grants every role non-DML
 *     REFERENCES/TRIGGER by default).
 *
 * Runs against LOCAL Supabase only; skips visibly when unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  makeAnonServerClient,
  cleanupFixture,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import {
  TENANT_TABLES,
  findUnenrolledTenantTables,
  introspectTenantOwnedTables,
} from "./tenant-table-inventory";

/**
 * 🔴 RED contract: the two new settings tables MUST be enrolled in `TENANT_TABLES`.
 * Until dev adds them, the membership assertions below FAIL (the names are absent),
 * which is the intended red signal. In GREEN phase these are a no-op tautology.
 */
const NEW_SETTINGS_TABLES = ["company_settings", "quote_terms"] as const;

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key (RLS) client
let anon: TestServerClient; // unauthenticated anon-key client

/**
 * Seed ONE Tenant B settings row of each kind via the privileged BYPASSRLS path.
 * IDEMPOTENT (`on conflict (tenant_id) do update`) because both tables are
 * ONE-row-per-tenant (a `unique (tenant_id)`) — multiple tests in this block seed
 * the SAME Tenant B, so a plain INSERT would violate the unique constraint. The
 * upsert returns the existing/created row id and RESTORES the seed label (so the
 * cross-tenant "unchanged" re-read still has a known baseline value to compare).
 */
async function adminInsertCompanySettings(tenantId: string): Promise<string> {
  const rows = await adminQuery<{ id: string }>(
    `insert into public.company_settings
       (tenant_id, company_name, default_vat_display, vat_rate_bp)
     values ($1, $2, $3, $4)
     on conflict (tenant_id) do update
       set company_name = excluded.company_name
     returning id`,
    [tenantId, "tenant-b-company-seed", "company_togglable", 2500],
  );
  return rows[0].id;
}
async function adminInsertQuoteTerms(tenantId: string): Promise<string> {
  const rows = await adminQuery<{ id: string }>(
    `insert into public.quote_terms (tenant_id, terms_text)
     values ($1, $2)
     on conflict (tenant_id) do update
       set terms_text = excluded.terms_text
     returning id`,
    [tenantId, "tenant-b-terms-seed (platshållartext)"],
  );
  return rows[0].id;
}

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  anon = await makeAnonServerClient();
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
  await closeAdminPool();
});

// ─────────────────────────────────────────────────────────────────────────────
// H4 enrollment — both new tables are in the single-source-of-truth inventory and
// the live H4 gate covers them. (Auto-extends cross-tenant + anon-path suites.)
// ─────────────────────────────────────────────────────────────────────────────

describe("Story 3.3 — H4 enrollment of company_settings + quote_terms (AC3)", () => {
  it("[P0] both new settings tables are enrolled in TENANT_TABLES (the single source of truth)", () => {
    for (const t of NEW_SETTINGS_TABLES) {
      expect(TENANT_TABLES as readonly string[]).toContain(t);
    }
  });

  it("[P0] the H4 live introspection includes both tables AND the set-difference is EMPTY (gate passes)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const owned = await introspectTenantOwnedTables(adminQuery);
    for (const t of NEW_SETTINGS_TABLES) {
      expect(owned.has(t)).toBe(true); // RLS-protected, direct tenant_id → tenant-owned
    }
    const unenrolled = findUnenrolledTenantTables(owned, TENANT_TABLES);
    expect(unenrolled).toEqual([]); // every tenant-owned table is enrolled
  });

  it("[P0/AC3] the gate BITES: removing a new settings table from the enrolled set surfaces it (not vacuous)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const owned = await introspectTenantOwnedTables(adminQuery);
    const shrunk = (TENANT_TABLES as readonly string[]).filter(
      (t) => t !== "company_settings",
    );
    const unenrolled = findUnenrolledTenantTables(owned, shrunk);
    expect(unenrolled).toContain("company_settings");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Migration-reset exact-policy enumeration — EXTENDED by the 6 new policies, NOT
// loosened. The canonical assertion lives in migration-reset.int.test.ts; this
// scaffold pins the delta dev must add there so the RED phase is explicit.
// ─────────────────────────────────────────────────────────────────────────────

describe("Story 3.3 — migration-reset exact-policy enumeration extension (AC3)", () => {
  it("[P0] the public policy set includes the 6 NEW settings policies and STILL no DELETE", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ tablename: string; cmd: string }>(
      `select tablename, cmd from pg_policies where schemaname = 'public'`,
    );
    const set = new Set(rows.map((r) => `${r.tablename}.${r.cmd}`));
    // EXACTLY SELECT/INSERT/UPDATE per new table — the upsert path; NO DELETE policy.
    for (const t of NEW_SETTINGS_TABLES) {
      expect(set.has(`${t}.SELECT`)).toBe(true);
      expect(set.has(`${t}.INSERT`)).toBe(true);
      expect(set.has(`${t}.UPDATE`)).toBe(true);
      expect(set.has(`${t}.DELETE`)).toBe(false);
    }
    // The standing invariant: no DELETE policy exists anywhere on the app path.
    expect(rows.some((r) => r.cmd === "DELETE")).toBe(false);
  });

  it("[P0] both tables have RLS ENABLED and FORCED (enable + force)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `select c.relname, c.relrowsecurity, c.relforcerowsecurity
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname in ('company_settings', 'quote_terms')
          and c.relkind = 'r'`,
    );
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.relrowsecurity).toBe(true);
      expect(r.relforcerowsecurity).toBe(true);
    }
  });

  it("[P0] vat_rate_bp is an INTEGER column with a [0,10000] CHECK (basis points, never float)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const cols = await adminQuery<{ data_type: string }>(
      `select data_type from information_schema.columns
         where table_schema = 'public' and table_name = 'company_settings'
           and column_name = 'vat_rate_bp'`,
    );
    // An integer type (integer / smallint / bigint) — NEVER numeric/real/double.
    expect(cols[0]?.data_type).toMatch(/^(integer|smallint|bigint)$/);
    const checks = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'public.company_settings'::regclass and contype = 'c'`,
    );
    const defs = checks.map((c) => c.def).join("\n");
    expect(defs).toMatch(/vat_rate_bp/);
    expect(defs).toMatch(/10000/);
  });

  it("[P0] quote_terms.approved_at is NULLABLE with NO default (not-approved is the absence of a sign-off)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{
      is_nullable: string;
      column_default: string | null;
    }>(
      `select is_nullable, column_default from information_schema.columns
         where table_schema = 'public' and table_name = 'quote_terms'
           and column_name = 'approved_at'`,
    );
    expect(rows[0]?.is_nullable).toBe("YES"); // NULL = not approved
    expect(rows[0]?.column_default).toBeNull(); // NO default — schema cannot auto-approve
    // CRITICAL: there is NO `approved`/`status` boolean column that could default to a
    // truthy/approved value — approval is representable ONLY as a set approved_at.
    const approvedCol = await adminQuery<{ n: string }>(
      `select count(*)::int as n from information_schema.columns
         where table_schema = 'public' and table_name = 'quote_terms'
           and column_name in ('approved', 'status', 'is_approved')`,
    );
    expect(Number(approvedCol[0]?.n)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-tenant assert-the-mechanism (rls-invisible) for both tables. These mirror
// the data-driven cross-tenant suite; once enrolled, that suite covers them too —
// this block makes the per-table mechanism explicit for the new tables.
// ─────────────────────────────────────────────────────────────────────────────

describe("Story 3.3 — cross-tenant denial for company_settings + quote_terms (AC3)", () => {
  it("[P0] SELECT: Tenant A reads ZERO of Tenant B's company_settings / quote_terms (no error leak)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    await adminInsertCompanySettings(fixture.tenantB.id);
    await adminInsertQuoteTerms(fixture.tenantB.id);
    for (const table of NEW_SETTINGS_TABLES) {
      const { data, error } = await a
        .from(table)
        .select("*")
        .eq("tenant_id", fixture.tenantB.id);
      expect(error).toBeNull();
      expect(data).toEqual([]); // RLS USING invisibility — empty set, not an error
    }
  });

  it("[P0] INSERT spoofing Tenant B's tenant_id fails the WITH CHECK (42501)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const spoofCompany = await a.from("company_settings").insert({
      tenant_id: fixture.tenantB.id, // forged ownership
      company_name: "spoof-by-a",
      default_vat_display: "company_togglable",
      vat_rate_bp: 2500,
    });
    expect(spoofCompany.error?.code).toBe("42501");
    const spoofTerms = await a.from("quote_terms").insert({
      tenant_id: fixture.tenantB.id,
      terms_text: "spoof terms by a",
    });
    expect(spoofTerms.error?.code).toBe("42501");
  });

  it("[P0] UPDATE: Tenant A's cross-tenant UPDATE affects ZERO rows; B's row is UNCHANGED (independent re-read)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const bCompanyId = await adminInsertCompanySettings(fixture.tenantB.id);

    const { data: affected, error } = await a
      .from("company_settings")
      .update({ company_name: "hijacked-by-a" })
      .eq("id", bCompanyId)
      .select();
    // rls-invisible: zero rows affected, NO error (foreign row hidden by RLS USING).
    expect(error).toBeNull();
    expect(affected).toEqual([]);

    // Independent BYPASSRLS re-read proves Tenant B's row was NOT overwritten.
    const rows = await adminQuery<{ company_name: string }>(
      `select company_name from public.company_settings where id = $1`,
      [bCompanyId],
    );
    expect(rows[0].company_name).toBe("tenant-b-company-seed");
  });

  it("[P0] DELETE: there is NO app-path DELETE grant — Tenant A's DELETE is denied at the privilege layer (42501)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const bTermsId = await adminInsertQuoteTerms(fixture.tenantB.id);
    const { data: deleted, error } = await a
      .from("quote_terms")
      .delete()
      .eq("id", bTermsId)
      .select();
    expect(error?.code).toBe("42501"); // no DELETE grant anywhere on the app path
    expect(deleted).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Anon-DML-empty: an unauthenticated anon-key client cannot SELECT/INSERT/UPDATE/
// DELETE either table. anon → NONE on the four DML privileges (NOT anon-grant-empty,
// which would wrongly assert the non-DML REFERENCES/TRIGGER grants Supabase issues).
// ─────────────────────────────────────────────────────────────────────────────

describe("Story 3.3 — anon-DML-empty for company_settings + quote_terms (AC3)", () => {
  it("[P0] anon SELECT reads ZERO rows (RLS + no grant)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const table of NEW_SETTINGS_TABLES) {
      const { data } = await anon.from(table).select("*");
      expect(data ?? []).toEqual([]);
    }
  });

  it("[P0] anon INSERT is denied at the privilege layer (42501)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const company = await anon.from("company_settings").insert({
      tenant_id: fixture.tenantA.id,
      company_name: "anon-spoof",
      default_vat_display: "company_togglable",
      vat_rate_bp: 2500,
    });
    expect(company.error?.code).toBe("42501");
    const terms = await anon.from("quote_terms").insert({
      tenant_id: fixture.tenantA.id,
      terms_text: "anon-spoof terms",
    });
    expect(terms.error?.code).toBe("42501");
  });

  it("[P0] anon UPDATE and DELETE are both denied at the privilege layer (42501)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const table of NEW_SETTINGS_TABLES) {
      const upd = await anon
        .from(table)
        .update({ tenant_id: fixture.tenantA.id })
        .eq("tenant_id", fixture.tenantA.id)
        .select();
      expect(upd.error?.code).toBe("42501");
      const del = await anon
        .from(table)
        .delete()
        .eq("tenant_id", fixture.tenantA.id)
        .select();
      expect(del.error?.code).toBe("42501");
    }
  });
});
