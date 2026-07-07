/**
 * Story 7.1 — ATDD RED-PHASE scaffold: acceptance/job migration-reset proof
 * (AC4/AC5, P0 — 7.1-INT-01 / R-701).
 *
 * Asserts that after `supabase db reset` (empty → migrate → seed) the NEW additive migration
 * (`supabase/migrations/2026070*_acceptance_to_job_model.sql`) created the THREE new tenant-owned
 * commitment tables — `quote_acceptances`, `jobs`, `job_events` — with the exact schema contract
 * that MIRRORS the proven 6.1 `quote_version_model` pattern VERBATIM:
 *   - a DIRECT `tenant_id` NOT NULL FK → public.tenants ON DELETE CASCADE per table;
 *   - COMPOSITE same-tenant parent FKs to (id, tenant_id):
 *       quote_acceptances → quote_versions (id,tenant_id) + quotes (id,tenant_id);
 *       jobs → quote_acceptances (id,tenant_id) [immutable source ref] + quote_versions
 *         (id,tenant_id) [immutable source ref] + customers/facilities/contacts (id,tenant_id);
 *       job_events → jobs (id,tenant_id);
 *   - the prerequisite `<parent>_id_tenant_unique` composite-FK targets: quote_acceptances +
 *     jobs each carry their own `unique (id, tenant_id)`;
 *   - the 7.2 uniqueness BACKSTOPS added NOW: quote_acceptances `unique (quote_version_id)` (one
 *     acceptance per accepted version); jobs `unique (quote_acceptance_id)` (one job source per
 *     acceptance);
 *   - integer-öre money columns (`accepted_price_ore` + `source_sent_total_ore` on
 *     quote_acceptances) as `bigint` with a DB `CHECK (..._ore >= 0)`; NO float/numeric money;
 *   - a closed Phase-A `status` set on `jobs` (e.g. created/in_progress/done/cancelled — a minimal
 *     conservative set, NOT field-worker states) and a closed `event_type` set on job_events
 *     (incl. 'created'); `job_events.occurred_at timestamptz NOT NULL default now()`;
 *   - created_at/updated_at + the REUSED `public.set_updated_at()` BEFORE UPDATE trigger per table;
 *   - RLS ENABLE + FORCE on all three; own-tenant SELECT/INSERT/UPDATE policies on the REUSED
 *     `is_tenant_admin` helper (NO DELETE policy — archive only, `archived_at`);
 *   - explicit role GRANTs (authenticated SELECT/INSERT/UPDATE; service_role full DML; anon NONE);
 *   - `quote_events` is REUSED (Epic 6) — NOT recreated by this migration.
 *   - SCOPE GUARD (AC4): NO field-worker/schedule/time-material/deviation/ÄTA/analytics/invoice/
 *     Fortnox table or column; NO `accept_quote_and_create_job` RPC (7.2); NO acceptance-immutability
 *     trigger (7.4).
 *
 * ── RELATIONSHIP TO THE EXISTING `migration-reset.int.test.ts` ────────────────────────────────
 * That file asserts the COMPLETE `public` policy set as an EXACT enumeration; the three new tables'
 * SELECT/INSERT/UPDATE policies WILL FAIL-LOUD there the moment the migration lands (the same signal
 * 3.1/5.1/6.1 hit). The GREEN phase EXTENDS that file (add the three new tables × SELECT/INSERT/
 * UPDATE to the expected EXACT set + the tables to the exists/RLS-forced checks), keeping the
 * enumeration EXACT — never loosened to a superset. This scaffold pins the acceptance half
 * independently. (Companion to `quote-tables-migration-reset.int.test.ts`.)
 *
 * ── RED PHASE (Story 7.1 not yet implemented) ─────────────────────────────────────────────────
 * The additive migration does NOT exist yet, so the introspection queries below would find nothing.
 * The whole describe block is `describe.skip("... [ATDD red phase — Story 7.1 not implemented]")`;
 * the assertions encode the CONTRACT the green phase must satisfy. GREEN: land the migration, remove
 * the `.skip`, re-label "green", and EXTEND `migration-reset.int.test.ts` in lockstep.
 *
 * Runs against the LOCAL Supabase stack only; skips visibly when unreachable. AFTER a
 * `supabase db reset` the runner polls `/auth/v1/health` to 200 first (the Kong 502 false-green
 * trap — epic-5/6/8 retros).
 *
 * [Source: test-design-epic-7.md#7.1-INT-01, R-701; story 7.1 Task 1 (migration) + AC4/AC5;
 *  supabase/migrations/20260705120000_quote_version_model.sql (the 6.1 pattern to mirror verbatim);
 *  tests/integration/rls/quote-tables-migration-reset.int.test.ts (the introspection harness to copy);
 *  tests/integration/rls/migration-reset.int.test.ts (the exact policy enumeration to EXTEND in green)]
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

const ACCEPTANCE_TABLES = ["quote_acceptances", "jobs", "job_events"] as const;

/** The öre columns that must be `bigint` + `CHECK >= 0` (AC5). */
const ORE_COLUMNS: ReadonlyArray<{ table: string; column: string }> = [
  { table: "quote_acceptances", column: "accepted_price_ore" },
  { table: "quote_acceptances", column: "source_sent_total_ore" },
];

/** Deferred-module tables/shapes AC4 forbids this story from creating. */
const FORBIDDEN_TABLE_PATTERN =
  "(fortnox|invoice|external_mapping|customer_portal|schedule|time_material|timesheet|deviation|ata|analytics|field_worker)";

let stackUp = false;
beforeAll(async () => {
  stackUp = await isLocalStackReachable();
});
afterAll(async () => {
  await closeAdminPool();
});

describe("Acceptance/job migration reset — three new commitment tables (AC4/AC5)", () => {
  it("[P0] 7.1-INT-01: the three commitment tables exist after reset (quote_events NOT recreated)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ table_name: string }>(
      `select table_name from information_schema.tables
         where table_schema = 'public' and table_name = any($1::text[])`,
      [[...ACCEPTANCE_TABLES]],
    );
    expect(rows.map((r) => r.table_name).sort()).toEqual([...ACCEPTANCE_TABLES].sort());
  });

  it("[P0/AC4] NO field-worker/schedule/time-material/deviation/invoice/Fortnox table is created", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ table_name: string }>(
      `select table_name from information_schema.tables
         where table_schema = 'public' and table_name ~* $1`,
      [FORBIDDEN_TABLE_PATTERN],
    );
    expect(rows).toEqual([]);
  });

  it("[P0] each new table carries a NOT NULL tenant_id FK to public.tenants ON DELETE CASCADE", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const table of ACCEPTANCE_TABLES) {
      const nn = await adminQuery<{ is_nullable: string }>(
        `select is_nullable from information_schema.columns
           where table_schema = 'public' and table_name = $1 and column_name = 'tenant_id'`,
        [table],
      );
      expect(nn[0]?.is_nullable).toBe("NO");
      const fk = await adminQuery<{ confdeltype: string }>(
        `select con.confdeltype from pg_constraint con
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

  it("[P0] quote_acceptances + jobs carry their own unique (id, tenant_id) (composite-FK targets)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const table of ["quote_acceptances", "jobs"] as const) {
      const rows = await adminQuery<{ def: string }>(
        `select pg_get_constraintdef(oid) as def from pg_constraint
           where conrelid = ('public.' || $1)::regclass and contype = 'u'`,
        [table],
      );
      expect(rows.some((r) => /\(id,\s*tenant_id\)/i.test(r.def))).toBe(true);
    }
  });

  it("[P0] the 7.2 uniqueness backstops exist: one acceptance per version, one job per acceptance", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const accUnique = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'public.quote_acceptances'::regclass and contype = 'u'`,
    );
    expect(accUnique.some((r) => /\(quote_version_id\)/i.test(r.def))).toBe(true);
    const jobUnique = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'public.jobs'::regclass and contype = 'u'`,
    );
    expect(jobUnique.some((r) => /\(quote_acceptance_id\)/i.test(r.def))).toBe(true);
  });

  it("[P0] jobs carry IMMUTABLE composite same-tenant source refs to acceptance + version", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const jobFk = await adminQuery<{ fdef: string }>(
      `select pg_get_constraintdef(con.oid) as fdef from pg_constraint con
         join pg_class c on c.oid = con.conrelid
        where con.contype = 'f' and c.relname = 'jobs'`,
    );
    expect(
      jobFk.some(
        (r) =>
          /\(quote_acceptance_id,\s*tenant_id\)/i.test(r.fdef) &&
          /quote_acceptances\s*\(id,\s*tenant_id\)/i.test(r.fdef),
      ),
    ).toBe(true);
    expect(
      jobFk.some(
        (r) =>
          /\(quote_version_id,\s*tenant_id\)/i.test(r.fdef) &&
          /quote_versions\s*\(id,\s*tenant_id\)/i.test(r.fdef),
      ),
    ).toBe(true);
  });

  it("[P0/AC5] the öre columns are bigint with a CHECK (>= 0); NO float/numeric money", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const { table, column } of ORE_COLUMNS) {
      const col = await adminQuery<{ data_type: string }>(
        `select data_type from information_schema.columns
           where table_schema = 'public' and table_name = $1 and column_name = $2`,
        [table, column],
      );
      expect(col[0]?.data_type).toBe("bigint");
      const check = await adminQuery<{ def: string }>(
        `select pg_get_constraintdef(oid) as def from pg_constraint
           where conrelid = ('public.' || $1)::regclass and contype = 'c'`,
        [table],
      );
      expect(check.some((r) => new RegExp(`${column}\\s*>=\\s*0`).test(r.def))).toBe(true);
    }
    // No numeric/real/double-precision money column smuggled onto the acceptance table.
    const floatMoney = await adminQuery<{ column_name: string }>(
      `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = 'quote_acceptances'
           and data_type in ('numeric','real','double precision')`,
    );
    expect(floatMoney).toEqual([]);
  });

  it("[P0] RLS is ENABLED + FORCED on all three tables", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const table of ACCEPTANCE_TABLES) {
      const rows = await adminQuery<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
        `select relrowsecurity, relforcerowsecurity from pg_class
           where oid = ('public.' || $1)::regclass`,
        [table],
      );
      expect(rows[0]?.relrowsecurity).toBe(true);
      expect(rows[0]?.relforcerowsecurity).toBe(true);
    }
  });

  it("[P0] each table has exactly the own-tenant SELECT/INSERT/UPDATE policies (NO DELETE policy)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const table of ACCEPTANCE_TABLES) {
      const rows = await adminQuery<{ cmd: string }>(
        `select cmd from pg_policies where schemaname = 'public' and tablename = $1`,
        [table],
      );
      const cmds = rows.map((r) => r.cmd).sort();
      // pg_policies cmd values: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL'.
      expect(cmds).toEqual(["INSERT", "SELECT", "UPDATE"]);
    }
  });

  it("[P0/AC4] the accept_quote_and_create_job RPC (7.2) EXISTS AND the accepted-immutability trigger (7.4) EXISTS on quote_acceptances/jobs", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // 7.1 creates the tables; 7.2 adds the transactional RPC; 7.4 locks them (immutability trigger).
    // STORY 7.4 RECONCILIATION: this assertion inverted from the 7.2-era "NO acceptance-immutability
    // trigger exists yet" — 7.4 (20260711120000) now lands the accepted-immutability triggers, so
    // quote_acceptances carries the reused set_updated_at BEFORE UPDATE trigger AND the bespoke
    // `quote_acceptances_accepted_lock` trigger, and jobs carries set_updated_at AND the
    // `jobs_source_ref_lock` trigger. (The RPC inversion the 7.2 comment describes is unchanged — it
    // still exists.)
    const rpc = await adminQuery<{ proname: string }>(
      `select proname from pg_proc where proname = 'accept_quote_and_create_job'`,
    );
    expect(rpc.map((r) => r.proname)).toEqual(["accept_quote_and_create_job"]);
    // quote_acceptances now carries the reused set_updated_at trigger AND the 7.4 accepted-lock
    // trigger — the bespoke immutability trigger MUST now be present (the load-bearing DB proof).
    const accTrg = await adminQuery<{ tgname: string }>(
      `select tgname from pg_trigger
         where tgrelid = 'public.quote_acceptances'::regclass and not tgisinternal
         order by tgname`,
    );
    const accNames = accTrg.map((r) => r.tgname);
    expect(accNames).toContain("quote_acceptances_set_updated_at");
    expect(accNames).toContain("quote_acceptances_accepted_lock");
    // jobs now carries the reused set_updated_at trigger AND the 7.4 source-ref-lock trigger.
    const jobTrg = await adminQuery<{ tgname: string }>(
      `select tgname from pg_trigger
         where tgrelid = 'public.jobs'::regclass and not tgisinternal
         order by tgname`,
    );
    const jobNames = jobTrg.map((r) => r.tgname);
    expect(jobNames).toContain("jobs_set_updated_at");
    expect(jobNames).toContain("jobs_source_ref_lock");
  });
});
