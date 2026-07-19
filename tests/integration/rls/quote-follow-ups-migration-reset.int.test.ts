/**
 * Story 10.3 — ATDD RED-PHASE scaffold: the `quote_follow_ups` table + partial unique index + FULL
 * (SELECT+INSERT+UPDATE, NO DELETE) RLS (10.3-INT-02, P0, AC1/AC3/AC4; test-design-epic-10.md
 * R-1030/R-1031/R-1034).
 *
 * Asserts that after `supabase db reset` the NEW additive migration
 * (`supabase/migrations/<ts>_quote_follow_ups.sql`) landed the exact schema contract from Dev Notes
 * → "The quote_follow_ups table" (mirrors `quote_acceptances`, MINUS money, PLUS the one-open index):
 *   - `public.quote_follow_ups` with a DIRECT `tenant_id` NOT NULL FK to public.tenants ON DELETE
 *     CASCADE, COMPOSITE same-tenant FKs to quotes(id,tenant_id) + quote_versions(id,tenant_id) ON
 *     DELETE CASCADE, `due_date date NOT NULL`, nullable `note`, `status text NOT NULL default 'open'
 *     CHECK (status in ('open','completed'))`, nullable `outcome`, `created_at`, nullable `completed_at`;
 *   - the fail-closed shape CHECK `status <> 'completed' or completed_at is not null`;
 *   - the PARTIAL UNIQUE INDEX `quote_follow_ups_one_open_per_quote on (quote_id) where status='open'`
 *     — the UXB-A6 one-open-per-quote rule (R-1030) — plus a `tenant_id` index;
 *   - UPDATE-able (NOT insert-only): RLS ENABLE + FORCE; EXACTLY the own-tenant SELECT + INSERT + UPDATE
 *     policies (NO DELETE policy — archive-over-delete); the `authenticated` DML GRANT is
 *     SELECT+INSERT+UPDATE only (NO delete). This is the load-bearing contrast with 10.2's insert-only
 *     `quote_lost_reasons` and is what makes the `rls-invisible` cross-tenant UPDATE profile correct;
 *   - NO `updated_at` / `set_updated_at` trigger (the completion UPDATE is explicit; nothing derives);
 *   - SCOPE GUARD: NO money/öre column (no numeric/float), NO supplier/Fortnox/sync/portal column, NO
 *     notification/reminder/email column (Epic 13 owns reminders — the ⚑ scope boundary).
 *
 * ── RELATIONSHIP TO `migration-reset.int.test.ts` (the EXACT policy enumeration) ──────────────────
 * That file asserts the COMPLETE `public` policy set as an EXACT enumeration; the three new
 * quote_follow_ups policies (SELECT + INSERT + UPDATE) WILL FAIL-LOUD there the moment the migration
 * lands. The GREEN phase EXTENDS that file (add quote_follow_ups × SELECT/INSERT/UPDATE to the expected
 * EXACT set + the table to the exists/RLS-forced checks), keeping the enumeration EXACT — never a superset.
 *
 * ── RED PHASE (Story 10.3 not yet implemented) ────────────────────────────────────────────────────
 * The migration does NOT exist yet, so the introspection finds nothing. The whole describe block is
 * `describe.skip`; the assertions encode the CONTRACT the green phase must satisfy. GREEN: land the
 * migration, remove `.skip`, re-label "green", and EXTEND `migration-reset.int.test.ts` in lockstep.
 *
 * Runs against the LOCAL Supabase stack only; skips visibly when unreachable. Mirrors
 * `quote-lost-reasons-migration-reset.int.test.ts` (10.2). CI (`SUPABASE_TEST_REQUIRED=1`) hard-fails so
 * these proofs are never silently skipped.
 *
 * [Source: story 10.3 AC1/AC3/AC4 + Task 1 + Dev Notes "The quote_follow_ups table"; test-design-epic-10
 *  #10.3-INT-02, R-1030/R-1034; supabase/migrations/20260709120000_acceptance_to_job_model.sql +
 *  20260719120000_quote_lost_reasons_and_lost_status.sql (the patterns to mirror)]
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

const TABLE = "quote_follow_ups";
/** Columns/patterns the story's scope guard forbids on the follow-up table. */
const FORBIDDEN_COLUMN_PATTERN = "(fortnox|external|sync|portal|invoice|updated_at|notif|email|remind)";

let stackUp = false;
beforeAll(async () => {
  stackUp = await isLocalStackReachable();
});
afterAll(async () => {
  await closeAdminPool();
});

describe.skip("quote_follow_ups migration reset — updatable one-open-per-quote table + full RLS (AC1/AC3/AC4)", () => {
  it("[P0] 10.3-INT-02: the quote_follow_ups table exists after reset", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ table_name: string }>(
      `select table_name from information_schema.tables
         where table_schema = 'public' and table_name = $1`,
      [TABLE],
    );
    expect(rows.map((r) => r.table_name)).toEqual([TABLE]);
  });

  it("[P0] carries a NOT NULL tenant_id FK to public.tenants ON DELETE CASCADE", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const nn = await adminQuery<{ is_nullable: string }>(
      `select is_nullable from information_schema.columns
         where table_schema = 'public' and table_name = $1 and column_name = 'tenant_id'`,
      [TABLE],
    );
    expect(nn[0]?.is_nullable).toBe("NO");
    const fk = await adminQuery<{ confdeltype: string }>(
      `select con.confdeltype from pg_constraint con
         join pg_class c on c.oid = con.conrelid
         join pg_namespace n on n.oid = c.relnamespace
         join pg_class fc on fc.oid = con.confrelid
        where con.contype = 'f' and n.nspname = 'public'
          and c.relname = $1 and fc.relname = 'tenants'`,
      [TABLE],
    );
    expect(fk.some((r) => r.confdeltype === "c")).toBe(true);
  });

  it("[P0] carries COMPOSITE same-tenant FKs to quotes(id,tenant_id) + quote_versions(id,tenant_id)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const fk = await adminQuery<{ fdef: string }>(
      `select pg_get_constraintdef(con.oid) as fdef from pg_constraint con
         join pg_class c on c.oid = con.conrelid
        where con.contype = 'f' and c.relname = $1`,
      [TABLE],
    );
    expect(
      fk.some(
        (r) => /\(quote_id,\s*tenant_id\)/i.test(r.fdef) && /quotes\s*\(id,\s*tenant_id\)/i.test(r.fdef),
      ),
    ).toBe(true);
    expect(
      fk.some(
        (r) =>
          /\(quote_version_id,\s*tenant_id\)/i.test(r.fdef) &&
          /quote_versions\s*\(id,\s*tenant_id\)/i.test(r.fdef),
      ),
    ).toBe(true);
  });

  it("[P0] 10.3-INT-02: the PARTIAL unique index enforces one OPEN follow-up per quote (R-1030)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ indexdef: string }>(
      `select indexdef from pg_indexes where schemaname = 'public' and tablename = $1`,
      [TABLE],
    );
    const partial = rows.find(
      (r) => /\(quote_id\)/i.test(r.indexdef) && /unique/i.test(r.indexdef) && /where\s*\(?status\s*=\s*'open'/i.test(r.indexdef),
    );
    expect(partial, "expected a UNIQUE index on (quote_id) WHERE status='open'").toBeDefined();
    // A tenant_id index is present (the tenant-scoped read path).
    expect(rows.some((r) => /\(tenant_id\)/i.test(r.indexdef))).toBe(true);
  });

  it("[P0] status carries the closed CHECK vocabulary + the fail-closed completed-shape CHECK", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const checks = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = ('public.' || $1)::regclass and contype = 'c'`,
      [TABLE],
    );
    const blob = checks.map((r) => r.def).join(" ");
    for (const tok of ["open", "completed"]) {
      expect(blob).toMatch(new RegExp(`'${tok}'`));
    }
    // The fail-closed shape: a completed row must carry completed_at.
    expect(blob).toMatch(/completed_at\s+is\s+not\s+null/i);
  });

  it("[P0] RLS is ENABLED + FORCED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `select relrowsecurity, relforcerowsecurity from pg_class
         where oid = ('public.' || $1)::regclass`,
      [TABLE],
    );
    expect(rows[0]?.relrowsecurity).toBe(true);
    expect(rows[0]?.relforcerowsecurity).toBe(true);
  });

  it("[P0] UPDATABLE (not insert-only): EXACTLY the own-tenant SELECT + INSERT + UPDATE policies (NO DELETE policy)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ cmd: string }>(
      `select cmd from pg_policies where schemaname = 'public' and tablename = $1`,
      [TABLE],
    );
    expect(rows.map((r) => r.cmd).sort()).toEqual(["INSERT", "SELECT", "UPDATE"]);
  });

  it("[P0] the authenticated DML GRANT is SELECT+INSERT+UPDATE only (NO delete privilege)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Scope to the DML privileges {SELECT, INSERT, UPDATE, DELETE} and prove they are EXACTLY
    // {INSERT, SELECT, UPDATE} — the archive-over-delete rule (no app-path DELETE grant).
    const rows = await adminQuery<{ privilege_type: string }>(
      `select privilege_type from information_schema.role_table_grants
         where table_schema = 'public' and table_name = $1 and grantee = 'authenticated'
           and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')`,
      [TABLE],
    );
    expect(rows.map((r) => r.privilege_type).sort()).toEqual(["INSERT", "SELECT", "UPDATE"]);
  });

  it("[P0] anon has NO privileges on quote_follow_ups", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ privilege_type: string }>(
      `select privilege_type from information_schema.role_table_grants
         where table_schema = 'public' and table_name = $1 and grantee = 'anon'
           and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')`,
      [TABLE],
    );
    expect(rows).toEqual([]);
  });

  it("[P0/scope] NO forbidden column (supplier/Fortnox/sync/portal/notification/reminder/email/updated_at) AND NO float money", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const forbidden = await adminQuery<{ column_name: string }>(
      `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = $1 and column_name ~* $2`,
      [TABLE, FORBIDDEN_COLUMN_PATTERN],
    );
    expect(forbidden).toEqual([]);
    const money = await adminQuery<{ column_name: string }>(
      `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = $1
           and data_type in ('numeric','real','double precision')`,
      [TABLE],
    );
    expect(money).toEqual([]);
  });

  it("[P0/scope] NO set_updated_at trigger on quote_follow_ups (the completion UPDATE is explicit)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const trg = await adminQuery<{ tgname: string }>(
      `select tgname from pg_trigger
         where tgrelid = ('public.' || $1)::regclass and not tgisinternal`,
      [TABLE],
    );
    expect(trg.map((t) => t.tgname).filter((n) => /updated_at/i.test(n))).toEqual([]);
  });
});
