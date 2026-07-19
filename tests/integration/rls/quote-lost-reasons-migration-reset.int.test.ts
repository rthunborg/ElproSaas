/**
 * Story 10.2 — ATDD RED-PHASE scaffold: the `quote_lost_reasons` table + insert-only RLS + the DB
 * half of the 5-layer `lost` widening + the narrow RPC (10.2-INT-04, P0, AC2/AC3/AC5, R-1011/R-1013).
 *
 * Asserts that after `supabase db reset` the NEW additive migration
 * (`supabase/migrations/<ts>_quote_lost_reasons_and_lost_status.sql`) landed the exact schema
 * contract from Dev Notes → "The `quote_lost_reasons` table" (mirrors `quote_acceptances` verbatim,
 * MINUS the UPDATE policy/grant — insert-only):
 *   - `public.quote_lost_reasons` with a DIRECT `tenant_id` NOT NULL FK → public.tenants ON DELETE
 *     CASCADE, COMPOSITE same-tenant FKs to quotes(id,tenant_id) + quote_versions(id,tenant_id),
 *     `outcome text CHECK (outcome in ('forlorad','avbojd'))`, `category text CHECK (category in
 *     ('pris','konkurrent','tidplan','uteblivet_svar','annat'))`, nullable `note`, `created_at`;
 *   - **`unique (quote_version_id)`** (one reason per version — R-1013);
 *   - INSERT-ONLY: RLS ENABLE + FORCE; EXACTLY the own-tenant SELECT + INSERT policies (NO UPDATE
 *     policy, NO DELETE policy); `authenticated` GRANT is SELECT+INSERT ONLY (no update/delete) —
 *     this is what makes 10.2-RLS-01's own-tenant-UPDATE-rejected negative pass; a `tenant_id` index;
 *   - NO `updated_at` / `set_updated_at` trigger (insert-only — nothing updates it);
 *   - DB LAYERS 1-3 of the widening: `quote_versions.status` CHECK + `quote_events.event_type` CHECK
 *     now BOTH include `'lost'` (and still include the legacy set); the sent-lock trigger's allowed
 *     forward-status set now includes `'lost'` while the immutability tuple is UNWEAKENED;
 *   - DB LAYER 4: the `mark_quote_version_lost` RPC EXISTS (SECURITY INVOKER, EXECUTE revoked from
 *     public, granted to authenticated + service_role) — §14 widening.
 *   - SCOPE GUARD: NO supplier/Fortnox/sync/portal column, NO float/numeric money column, NO
 *     `updated_at` column on quote_lost_reasons.
 *
 * ── RELATIONSHIP TO `migration-reset.int.test.ts` (the EXACT policy enumeration) ──────────────────
 * That file asserts the COMPLETE `public` policy set as an EXACT enumeration; the two new
 * quote_lost_reasons policies (SELECT + INSERT) WILL FAIL-LOUD there the moment the migration lands.
 * The GREEN phase EXTENDS that file (add quote_lost_reasons × SELECT/INSERT to the expected EXACT set
 * + the table to the exists/RLS-forced checks), keeping the enumeration EXACT — never a superset.
 *
 * ── RED PHASE (Story 10.2 not yet implemented) ────────────────────────────────────────────────────
 * The migration does NOT exist yet, so the introspection finds nothing. The whole describe block is
 * `describe.skip`; the assertions encode the CONTRACT the green phase must satisfy. GREEN: land the
 * migration, remove `.skip`, re-label "green", and EXTEND `migration-reset.int.test.ts` in lockstep.
 *
 * Runs against the LOCAL Supabase stack only; skips visibly when unreachable. Mirrors
 * `acceptance-tables-migration-reset.int.test.ts` (7.1). CI (`SUPABASE_TEST_REQUIRED=1`) hard-fails so
 * these proofs are never silently skipped.
 *
 * [Source: story 10.2 AC2/AC3/AC5 + Task 1 + Dev Notes "The quote_lost_reasons table" / "The
 *  mark_quote_version_lost RPC" / "The 5-layer widening"; test-design-epic-10.md#10.2-INT-04, R-1013;
 *  supabase/migrations/20260709120000_acceptance_to_job_model.sql (the pattern to mirror);
 *  supabase/migrations/20260705120000_quote_version_model.sql (the CHECK sets to widen);
 *  supabase/migrations/20260707120000_quote_version_sent_lock.sql:129 (the allow-set to widen)]
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

const TABLE = "quote_lost_reasons";
/** Columns/patterns the story's scope guard forbids on the insert-only reason table. */
const FORBIDDEN_COLUMN_PATTERN = "(fortnox|external|sync|portal|invoice|updated_at)";

let stackUp = false;
beforeAll(async () => {
  stackUp = await isLocalStackReachable();
});
afterAll(async () => {
  await closeAdminPool();
});

describe("quote_lost_reasons migration reset — insert-only reason table + lost widening (AC2/AC3/AC5)", () => {
  it("[P0] 10.2-INT-04: the quote_lost_reasons table exists after reset", async (testCtx) => {
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
        (r) =>
          /\(quote_id,\s*tenant_id\)/i.test(r.fdef) && /quotes\s*\(id,\s*tenant_id\)/i.test(r.fdef),
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

  it("[P0] enforces unique (quote_version_id) — one reason per version (R-1013)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = ('public.' || $1)::regclass and contype = 'u'`,
      [TABLE],
    );
    expect(rows.some((r) => /\(quote_version_id\)/i.test(r.def))).toBe(true);
  });

  it("[P0] outcome + category carry the closed CHECK vocabularies (ASCII machine tokens)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const checks = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = ('public.' || $1)::regclass and contype = 'c'`,
      [TABLE],
    );
    const blob = checks.map((r) => r.def).join(" ");
    for (const tok of ["forlorad", "avbojd"]) {
      expect(blob).toMatch(new RegExp(`'${tok}'`));
    }
    for (const tok of ["pris", "konkurrent", "tidplan", "uteblivet_svar", "annat"]) {
      expect(blob).toMatch(new RegExp(`'${tok}'`));
    }
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

  it("[P0] INSERT-ONLY: EXACTLY the own-tenant SELECT + INSERT policies (NO UPDATE, NO DELETE policy)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ cmd: string }>(
      `select cmd from pg_policies where schemaname = 'public' and tablename = $1`,
      [TABLE],
    );
    expect(rows.map((r) => r.cmd).sort()).toEqual(["INSERT", "SELECT"]);
  });

  it("[P0] INSERT-ONLY: the authenticated DML GRANT is SELECT+INSERT only (NO update/delete privilege)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // The Supabase local baseline grants `authenticated` the STRUCTURAL privileges REFERENCES /
    // TRIGGER / TRUNCATE (and SELECT) on EVERY public table; migrations ADD the DML privileges. The
    // insert-only property is about the DML grants — so scope the assertion to {SELECT, INSERT,
    // UPDATE, DELETE} and prove they are EXACTLY {INSERT, SELECT} (no UPDATE, no DELETE). This is the
    // load-bearing insert-only enforcement (the own-tenant-UPDATE-rejected negative depends on it).
    const rows = await adminQuery<{ privilege_type: string }>(
      `select privilege_type from information_schema.role_table_grants
         where table_schema = 'public' and table_name = $1 and grantee = 'authenticated'
           and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')`,
      [TABLE],
    );
    expect(rows.map((r) => r.privilege_type).sort()).toEqual(["INSERT", "SELECT"]);
  });

  it("[P0/scope] NO forbidden column (supplier/Fortnox/sync/portal/invoice) AND NO updated_at + NO float money", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const forbidden = await adminQuery<{ column_name: string }>(
      `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = $1 and column_name ~* $2`,
      [TABLE, FORBIDDEN_COLUMN_PATTERN],
    );
    expect(forbidden).toEqual([]);
    const floatMoney = await adminQuery<{ column_name: string }>(
      `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = $1
           and data_type in ('numeric','real','double precision')`,
      [TABLE],
    );
    expect(floatMoney).toEqual([]);
  });

  // ── DB layers 1-2 of the 5-layer widening: the CHECK sets now include 'lost' ────────────────
  it("[P0/R-1011] quote_versions.status CHECK now admits 'lost' (and keeps the legacy set)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const checks = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'public.quote_versions'::regclass and contype = 'c'`,
    );
    const statusCheck = checks.find((r) => /status/i.test(r.def) && /'sent'/i.test(r.def));
    expect(statusCheck).toBeDefined();
    for (const tok of ["draft", "sent", "accepted", "rejected", "expired", "superseded", "lost"]) {
      expect(statusCheck?.def).toMatch(new RegExp(`'${tok}'`));
    }
  });

  it("[P0/R-1011] quote_events.event_type CHECK now admits 'lost' (and keeps the legacy set)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const checks = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'public.quote_events'::regclass and contype = 'c'`,
    );
    const evCheck = checks.find((r) => /event_type/i.test(r.def) && /'sent'/i.test(r.def));
    expect(evCheck).toBeDefined();
    expect(evCheck?.def).toMatch(/'lost'/);
  });

  // ── DB layer 4: the narrow RPC exists (SECURITY INVOKER; §14 widening) ──────────────────────
  it("[P0] the mark_quote_version_lost RPC exists (SECURITY INVOKER, EXECUTE not granted to public)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rpc = await adminQuery<{ prosecdef: boolean }>(
      `select prosecdef from pg_proc where proname = 'mark_quote_version_lost'`,
    );
    expect(rpc.length).toBe(1);
    expect(rpc[0]?.prosecdef).toBe(false); // SECURITY INVOKER (not DEFINER)
    const publicExec = await adminQuery<{ has: boolean }>(
      `select has_function_privilege('public', p.oid, 'execute') as has
         from pg_proc p where p.proname = 'mark_quote_version_lost'`,
    );
    expect(publicExec[0]?.has).toBe(false);
  });
});
