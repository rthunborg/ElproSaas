/**
 * Story 7.4 — Accepted-state immutability + correction boundary (R-701/R-704/R-714).
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * GREEN as of Story 7.4 dev. The additive migration
 * `supabase/migrations/20260711120000_accepted_record_lock.sql` (the `enforce_quote_acceptance_lock`
 * / `enforce_job_source_ref_lock` BEFORE-UPDATE triggers + custom SQLSTATE `AR704`), the
 * `ACCEPTED_RECORD_LOCKED` command code + the `AR704` mapper branch in `jobs-db.ts` now exist; `.skip`
 * removed. The immutable-field UPDATEs are REJECTED by the trigger; the exempt paths still SUCCEED. A
 * test that only proves the UI disables a control is NOT evidence (architecture §9) — the DB rejection
 * is the load-bearing proof.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * The two-layer immutability proof is the headline (test-design-epic-7.md, story-7.4 rows):
 *   - 7.4-INT-01 (P0, AC1, R-704): the COMMAND layer — the 7.3 `updateJob` command with a crafted
 *     payload attempting to set an immutable field (`quote_version_id` / `customer_id` /
 *     `accepted_price_ore` …) is REJECTED BEFORE the DB with `VALIDATION_FAILED` (the unknown-field
 *     reject — the immutable fields are not part of the input shape), and the row is byte-unchanged.
 *     This proves the command-layer lock. The DB-layer `ACCEPTED_RECORD_LOCKED` (via `AR704`) is
 *     proven by 7.4-INT-02's direct-SQL path (the command cannot smuggle the field, so the command
 *     path returns VALIDATION_FAILED; the trigger is the backstop for the below-the-command attack).
 *     BOTH codes asserted across the two-INT pair.
 *   - 7.4-INT-02 (P0, AC1, R-704 — THE load-bearing DB proof, mirrors 6.4-INT-03): Story 10.8
 *     deliberately revoked authenticated `quote_acceptances` DML, so every app-path UPDATE is denied
 *     with 42501 and leaves the row untouched. The same immutable acceptance probes are repeated via
 *     privileged admin SQL, which bypasses grants/RLS but invokes triggers and therefore proves AR704.
 *     The precise archival exemption is privileged-only; `jobs` remains writable on its allowed fields.
 *   - 7.4-INT-03 (P0, AC2, R-704/R-714): accidental-update regression — an id-only/empty-patch
 *     `updateJob` is a clean no-op (no false TENANT_ACCESS_DENIED, no write, no audit row, immutable
 *     fields byte-unchanged); a status-change appends EXACTLY ONE `job_events` row and never silently
 *     overwrites/hides an event; AND the 7.2 idempotent accept-retry is PRESERVED — a re-run of the
 *     real `accept_quote_and_create_job` on the already-accepted version returns the EXISTING
 *     (acceptanceId, jobId) with NO second acceptance/job (the accepted-lock trigger MUST NOT fire on
 *     the short-circuit — it performs NO immutable-field UPDATE). This is the explicit "7.4 immutability
 *     preserves the relaxed sent-state retry path" retro constraint.
 *   - 7.4-RLS-01 (P0, AC3, R-701/R-704): cross-tenant — tenant A reads a tenant B
 *     `quote_acceptances`/`jobs` row ⇒ zero rows / not-found; tenant A's authenticated acceptance
 *     UPDATE ⇒ 42501 before RLS/trigger evaluation and leaves the row untouched; anon ⇒
 *     UNAUTHENTICATED on the LIVE command path.
 *
 * Harness conventions mirror `mark-quote-version-sent.int.test.ts` (6.4-INT-03 — the direct-SQL
 * UPDATE-rejected-by-trigger structure) + `accept-quote-and-create-job.int.test.ts` (the REAL
 * sent→accept→job chain) + `update-job.int.test.ts`: per-run unique ids (`crypto.randomUUID()`), raw
 * pg readback via the BYPASSRLS admin helpers (bigint öre → STRING; timestamptz → Date/ISO — coerce
 * on readback), the INJECTED `CommandClock` (NO sleeps/wall-clock), runs against the LOCAL Supabase
 * stack ONLY + visibly skips per-test when unreachable. AFTER a `supabase db reset` the runner polls
 * `/auth/v1/health` to 200 before this DB-backed suite (the Kong→GoTrue 502 false-green trap — the
 * epic-5/6/8 retros); CI (`SUPABASE_TEST_REQUIRED=1`) hard-fails so these immutability proofs are
 * never silently skipped. The accepted record is produced by the REAL sent→accept→create-job chain
 * (NEVER a hand-inserted `quote_acceptances`/`jobs` row — the locked fields must be authentic and the
 * trigger proven against a genuine accepted row). Seed a NON-ZERO source sent total /accepted price;
 * NO PII/orgnr in fixtures; every öre value < 10 digits (R-717).
 *
 * [Source: test-design-epic-7.md#7.4-INT-01 (line 511) / #7.4-INT-02 (line 512) / #7.4-INT-03
 *  (line 513) / #7.4-RLS-01 (line 514), R-701/R-704/R-714/R-717, Exit Criteria (lines 451-453);
 *  story 7.4 AC1/AC2/AC3 + Tasks 1/2/4; architecture.md#9 (below-UI trigger enforcement — quote_acceptances
 *  must block updates via triggers);
 *  tests/integration/commands/mark-quote-version-sent.int.test.ts (6.4-INT-03 — the direct-SQL
 *  UPDATE-rejected-by-trigger structure to mirror for 7.4-INT-02);
 *  tests/integration/commands/accept-quote-and-create-job.int.test.ts (the real chain + idempotent
 *  short-circuit); tests/integration/commands/update-job.int.test.ts (the allowed-edit + empty-patch
 *  discipline); tests/factories/tenants.ts (the two-tenant + accepted-chain + admin-select helpers)]
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  makeAnonServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminInsertCalculation,
  adminInsertQuote,
  adminInsertQuoteVersion,
  adminInsertFacility,
  adminInsertContact,
  adminSelectQuoteAcceptanceRow,
  adminSelectAcceptancesForVersion,
  adminSelectJobRow,
  adminSelectJobsForAcceptance,
  adminSelectJobEventsForJob,
  type TwoTenantFixture,
  type TestServerClient,
  type FixtureTenant,
} from "../../factories/tenants";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { establishCurrentQuotePdf } from "../../support/quote-pdf";
import { runCommand } from "@/server/commands/envelope";
import {
  markQuoteVersionSent,
  acceptQuoteAndCreateJob,
} from "@/server/commands/quotes";
import { updateJob } from "@/server/commands/jobs";
import type { CommandClock } from "@/server/commands/clock";

const ACCEPTED_ISO = "2026-07-10T08:30:00.000Z"; // the EXPLICIT accepted moment (≠ command clock)
const fixedClock: CommandClock = { now: () => new Date("2026-07-10T09:00:00.000Z") };
/** The frozen source sent total / accepted price (öre) — NON-ZERO, < 10 digits (R-717). */
const SOURCE_SENT_TOTAL_ORE = 125_000;

/** The custom SQLSTATE the 7.4 trigger RAISEs (mapped → command ACCEPTED_RECORD_LOCKED). */
const ACCEPTED_LOCK_SQLSTATE = "AR704";
/** Authenticated roles deliberately have no quote_acceptances UPDATE grant (Story 10.8). */
const QUOTE_ACCEPTANCE_DML_REVOKED_SQLSTATE = "42501";

let stackUp = false;
let fx: TwoTenantFixture;
let clientA: TestServerClient;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fx = await createTwoTenantFixture();
  clientA = await makeAuthedServerClient(fx.adminA);
});

afterAll(async () => {
  if (stackUp && fx) await cleanupFixture(fx);
});

/**
 * Seed a REAL sent→accepted→job chain in the given tenant via the LANDED Epic-6/7.2 commands
 * (NEVER a hand-inserted acceptance/job — the locked fields must be authentic). Returns the created
 * acceptance + job ids + the source version id.
 */
async function seedAcceptedChain(
  tenant: FixtureTenant,
  client: TestServerClient,
): Promise<{ versionId: string; acceptanceId: string; jobId: string }> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenant.id,
    customer_type: "company",
    display_name: `lock-customer-${crypto.randomUUID().slice(0, 8)}`,
  });
  const calcId = await adminInsertCalculation({
    tenant_id: tenant.id,
    customer_id: customerId,
    title: `lock-calc-${crypto.randomUUID().slice(0, 8)}`,
  });
  const quoteId = await adminInsertQuote({ tenant_id: tenant.id, customer_id: customerId });
  const versionId = await adminInsertQuoteVersion({
    tenant_id: tenant.id,
    quote_id: quoteId,
    calculation_id: calcId,
    status: "draft",
    accepted_price_ore: SOURCE_SENT_TOTAL_ORE, // NON-ZERO frozen source sent total (R-717 seed)
  });
  await establishCurrentQuotePdf({
    client, tenantId: tenant.id, quoteVersionId: versionId,
    actorUserId: tenant.id === fx.tenantA.id ? fx.adminA.id : fx.adminB.id,
    occurredAt: fixedClock.now().toISOString(),
  });
  const sent = await runCommand(markQuoteVersionSent, {
    client: client as never,
    clock: fixedClock,
    correlationId: crypto.randomUUID(),
    input: { quote_version_id: versionId },
  });
  if (!sent.ok) throw new Error(`seedAcceptedChain: mark-sent failed (${sent.code})`);
  const accepted = await runCommand(acceptQuoteAndCreateJob, {
    client: client as never,
    clock: fixedClock,
    correlationId: crypto.randomUUID(),
    input: {
      quote_version_id: versionId,
      accepted_at: ACCEPTED_ISO,
      accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
      channel: "verbal",
    },
  });
  if (!accepted.ok) throw new Error(`seedAcceptedChain: accept failed (${accepted.code})`);
  const jobs = await adminSelectJobsForAcceptance(accepted.data.acceptanceId);
  if (jobs.length !== 1) throw new Error("seedAcceptedChain: expected exactly one job");
  return {
    versionId,
    acceptanceId: accepted.data.acceptanceId,
    jobId: String(jobs[0]?.id),
  };
}

/**
 * Like `seedAcceptedChain`, but the parent quote also carries a facility + contact so the 7.2 accept
 * RPC copies them onto the created `jobs` row. Needed for the 7.4-INT-02b exempt-precision proof: the
 * lock deliberately LEAVES `facility_id`/`contact_id` UNLOCKED (they are ON DELETE SET NULL and NOT
 * AC-named commitment fields), so a direct own-tenant UPDATE of them must SUCCEED — which can only be
 * proven against a job that actually HAS a facility/contact to re-point. Returns the two alternate
 * own-tenant facility/contact ids the exempt UPDATE re-points to.
 */
async function seedAcceptedChainWithFacility(
  tenant: FixtureTenant,
  client: TestServerClient,
): Promise<{ jobId: string; altFacilityId: string; altContactId: string }> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenant.id,
    customer_type: "company",
    display_name: `lock-fac-customer-${crypto.randomUUID().slice(0, 8)}`,
  });
  const facilityId = await adminInsertFacility({
    tenant_id: tenant.id,
    customer_id: customerId,
    name: `Anläggning ${crypto.randomUUID().slice(0, 8)}`,
  });
  const contactId = await adminInsertContact({
    tenant_id: tenant.id,
    customer_id: customerId,
    facility_id: facilityId,
    name: `Kontakt ${crypto.randomUUID().slice(0, 8)}`,
  });
  const calcId = await adminInsertCalculation({
    tenant_id: tenant.id,
    customer_id: customerId,
    title: `lock-fac-calc-${crypto.randomUUID().slice(0, 8)}`,
  });
  const quoteId = await adminInsertQuote({
    tenant_id: tenant.id,
    customer_id: customerId,
    facility_id: facilityId,
    contact_id: contactId,
  });
  const versionId = await adminInsertQuoteVersion({
    tenant_id: tenant.id,
    quote_id: quoteId,
    calculation_id: calcId,
    status: "draft",
    accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
  });
  await establishCurrentQuotePdf({
    client, tenantId: tenant.id, quoteVersionId: versionId,
    actorUserId: tenant.id === fx.tenantA.id ? fx.adminA.id : fx.adminB.id,
    occurredAt: fixedClock.now().toISOString(),
  });
  const sent = await runCommand(markQuoteVersionSent, {
    client: client as never,
    clock: fixedClock,
    correlationId: crypto.randomUUID(),
    input: { quote_version_id: versionId },
  });
  if (!sent.ok) throw new Error(`seedAcceptedChainWithFacility: mark-sent failed (${sent.code})`);
  const accepted = await runCommand(acceptQuoteAndCreateJob, {
    client: client as never,
    clock: fixedClock,
    correlationId: crypto.randomUUID(),
    input: {
      quote_version_id: versionId,
      accepted_at: ACCEPTED_ISO,
      accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
      channel: "verbal",
    },
  });
  if (!accepted.ok) throw new Error(`seedAcceptedChainWithFacility: accept failed (${accepted.code})`);
  const jobs = await adminSelectJobsForAcceptance(accepted.data.acceptanceId);
  if (jobs.length !== 1) throw new Error("seedAcceptedChainWithFacility: expected exactly one job");
  // Alternate own-tenant facility/contact the exempt UPDATE re-points to (same tenant ⇒ RLS-visible).
  const altFacilityId = await adminInsertFacility({
    tenant_id: tenant.id,
    customer_id: customerId,
    name: `Anläggning ${crypto.randomUUID().slice(0, 8)}`,
  });
  const altContactId = await adminInsertContact({
    tenant_id: tenant.id,
    customer_id: customerId,
    facility_id: altFacilityId,
    name: `Kontakt ${crypto.randomUUID().slice(0, 8)}`,
  });
  return { jobId: String(jobs[0]?.id), altFacilityId, altContactId };
}

/**
 * Execute the below-app acceptance-lock probe as postgres. This deliberately bypasses table grants
 * and RLS, but does not disable triggers: it is the load-bearing AR704 evidence after Story 10.8
 * revoked authenticated quote_acceptances DML.
 */
async function expectPrivilegedAcceptanceUpdateLocked(
  acceptanceId: string,
  field: string,
  value: unknown,
): Promise<void> {
  await expect(
    adminQuery(
      `update public.quote_acceptances set ${field} = $2 where id = $1 returning id`,
      [acceptanceId, value],
    ),
  ).rejects.toMatchObject({ code: ACCEPTED_LOCK_SQLSTATE });
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 7.4-INT-01 (P0, AC1) — the COMMAND layer: a smuggled immutable field ⇒ VALIDATION_FAILED, byte-unchanged
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe("7.4-INT-01: accepted-record immutability at the COMMAND layer (AC1, R-704)", () => {
  // The `updateJob` command already unknown-field-rejects, so a smuggled immutable field returns
  // VALIDATION_FAILED BEFORE the DB. The DB-layer ACCEPTED_RECORD_LOCKED (via AR704) is proven by
  // 7.4-INT-02's direct-SQL path — BOTH codes are asserted across the pair.

  const IMMUTABLE_JOB_FIELDS: readonly { field: string; value: unknown }[] = [
    { field: "quote_version_id", value: crypto.randomUUID() },
    { field: "quote_acceptance_id", value: crypto.randomUUID() },
    { field: "customer_id", value: crypto.randomUUID() },
    { field: "accepted_price_ore", value: 1 },
  ];

  for (const { field, value } of IMMUTABLE_JOB_FIELDS) {
    it(`[P0] 7.4-INT-01: updateJob smuggling the immutable field \`${field}\` ⇒ VALIDATION_FAILED (row byte-unchanged)`, async (testCtx) => {
      if (skipUnlessStack(testCtx, stackUp)) return;
      const { jobId } = await seedAcceptedChain(fx.tenantA, clientA);
      const before = await adminSelectJobRow(jobId);

      const res = await runCommand(updateJob, {
        client: clientA as never,
        clock: fixedClock,
        correlationId: crypto.randomUUID(),
        input: { id: jobId, [field]: value } as never,
      });

      expect(res.ok).toBe(false);
      if (res.ok) return;
      // The immutable field is not part of the input shape → the validator rejects it BEFORE the DB.
      expect(res.code).toBe("VALIDATION_FAILED");
      // Generic message — never echoes the smuggled column/value or a raw SQLSTATE.
      expect(res.message).not.toMatch(new RegExp(`${field}|AR704|${String(value)}`, "i"));
      // The row is byte-unchanged (the command rejected before any write).
      const after = await adminSelectJobRow(jobId);
      expect(after?.quote_version_id).toBe(before?.quote_version_id);
      expect(after?.quote_acceptance_id).toBe(before?.quote_acceptance_id);
      expect(after?.customer_id).toBe(before?.customer_id);
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 7.4-INT-02 (P0, AC1) — authenticated denial plus privileged trigger proof
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe("7.4-INT-02: accepted-record immutability BELOW the command — the DB trigger (AC1, R-704)", () => {
  // Story 10.8 revoked authenticated quote_acceptances DML. The app path must therefore fail at the
  // table privilege boundary (42501), while the privileged SQL probe below still invokes the trigger
  // and proves AR704. Keeping both assertions prevents a grant change from masking a weak trigger.

  const IMMUTABLE_ACCEPTANCE_UPDATES: readonly { field: string; value: unknown }[] = [
    { field: "accepted_price_ore", value: 999_999 },
    { field: "accepted_at", value: "2020-01-01T00:00:00.000Z" },
    { field: "evidence_reference", value: "tampered-evidence" },
    { field: "channel", value: "email" },
    { field: "source_sent_total_ore", value: 1 },
    { field: "quote_version_id", value: crypto.randomUUID() },
  ];

  for (const { field, value } of IMMUTABLE_ACCEPTANCE_UPDATES) {
    it(`[P0] 7.4-INT-02: an authenticated UPDATE of quote_acceptances.\`${field}\` is denied (42501), while privileged SQL proves AR704`, async (testCtx) => {
      if (skipUnlessStack(testCtx, stackUp)) return;
      const { acceptanceId } = await seedAcceptedChain(fx.tenantA, clientA);
      const before = await adminSelectQuoteAcceptanceRow(acceptanceId);

      const { error } = await clientA
        .from("quote_acceptances")
        .update({ [field]: value })
        .eq("id", acceptanceId)
        .select();

      // Authenticated application paths cannot mutate acceptances at all.
      expect(error).not.toBeNull();
      expect(error?.code).toBe(QUOTE_ACCEPTANCE_DML_REVOKED_SQLSTATE);
      const afterAppAttempt = await adminSelectQuoteAcceptanceRow(acceptanceId);
      // bigint öre reads back as a STRING via raw pg — compare by representation.
      expect(String(afterAppAttempt?.[field])).toBe(String(before?.[field]));

      // postgres bypasses the revoked grant/RLS but still runs the BEFORE UPDATE trigger.
      await expectPrivilegedAcceptanceUpdateLocked(acceptanceId, field, value);
      const afterTriggerAttempt = await adminSelectQuoteAcceptanceRow(acceptanceId);
      expect(String(afterTriggerAttempt?.[field])).toBe(String(before?.[field]));
    });
  }

  const IMMUTABLE_JOB_UPDATES: readonly { field: string; value: unknown }[] = [
    { field: "quote_acceptance_id", value: crypto.randomUUID() },
    { field: "quote_version_id", value: crypto.randomUUID() },
    { field: "customer_id", value: crypto.randomUUID() },
  ];

  for (const { field, value } of IMMUTABLE_JOB_UPDATES) {
    it(`[P0] 7.4-INT-02: a DIRECT own-tenant UPDATE of jobs.\`${field}\` is REJECTED by the trigger (AR704)`, async (testCtx) => {
      if (skipUnlessStack(testCtx, stackUp)) return;
      const { jobId } = await seedAcceptedChain(fx.tenantA, clientA);
      const before = await adminSelectJobRow(jobId);

      const { error } = await clientA
        .from("jobs")
        .update({ [field]: value })
        .eq("id", jobId)
        .select();

      expect(error).not.toBeNull();
      expect(error?.code).toBe(ACCEPTED_LOCK_SQLSTATE);
      const after = await adminSelectJobRow(jobId);
      expect(after?.[field]).toBe(before?.[field]);
    });
  }

  // ── EXEMPT paths STILL work (the lock is precise, not a blanket freeze) ─────────────────────────

  it("[P0] 7.4-INT-02: an authenticated `archived_at` soft-delete is denied (42501); the precise privileged archival exemption succeeds", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { acceptanceId } = await seedAcceptedChain(fx.tenantA, clientA);

    const before = await adminSelectQuoteAcceptanceRow(acceptanceId);
    const archivedAt = fixedClock.now().toISOString();
    const { error } = await clientA
      .from("quote_acceptances")
      .update({ archived_at: archivedAt })
      .eq("id", acceptanceId)
      .select();

    expect(error?.code).toBe(QUOTE_ACCEPTANCE_DML_REVOKED_SQLSTATE);
    const afterAppAttempt = await adminSelectQuoteAcceptanceRow(acceptanceId);
    expect(afterAppAttempt?.archived_at ?? null).toBe(before?.archived_at ?? null);

    const rows = await adminQuery<{ archived_at: string }>(
      "update public.quote_acceptances set archived_at = $2 where id = $1 returning archived_at",
      [acceptanceId, archivedAt],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.archived_at).not.toBeNull();
  });

  it("[P0] 7.4-INT-02: an updateJob-shaped title/status/planned-date UPDATE on jobs SUCCEEDS (the 7.3 allowed edit is not fought by the lock)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { jobId } = await seedAcceptedChain(fx.tenantA, clientA);

    // The four Phase-A-safe columns are EXEMPT — a direct own-tenant UPDATE of them still succeeds.
    const { error } = await clientA
      .from("jobs")
      .update({
        title: "Uppdaterad jobbtitel",
        status: "in_progress",
        planned_start_date: "2026-08-01",
        planned_end_date: "2026-08-15",
      })
      .eq("id", jobId)
      .select();

    expect(error).toBeNull();
    const after = await adminSelectJobRow(jobId);
    expect(after?.title).toBe("Uppdaterad jobbtitel");
    expect(after?.status).toBe("in_progress");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 7.4-INT-02b (automate expansion, AC1/R-704) — the FULL fail-closed-by-construction DB surface
//
// The migration (20260711120000_accepted_record_lock.sql) locks EVERYTHING on quote_acceptances
// except archived_at/updated_at, and the whole source-ref/identity tuple on jobs. The headline
// 7.4-INT-02 block above proves the AC-NAMED subset (6 acceptance + 3 job columns). This block
// closes the fail-closed guarantee end-to-end: (1) the REMAINING locked acceptance columns —
// including the operational-not-commitment ones (notes/planned dates) that are deliberately
// locked-by-default; (2) the exempt-THEN-tuple combined-mutation branch (an archived_at flip that
// ALSO touches a locked column must RAISE, not slip through the exempt short-circuit — the trickiest
// path of enforce_quote_acceptance_lock); (3) jobs.created_at (the one job identity column INT-02
// omits); (4) the exempt PRECISION on jobs — facility_id/contact_id are deliberately UNLOCKED (ON
// DELETE SET NULL), so a direct own-tenant re-point of them SUCCEEDS (the lock is precise, not a
// blanket freeze). Acceptance app-path attempts use the anon-key RLS client and assert 42501; their
// AR704 trigger probes use privileged admin SQL. All run against a REAL accepted chain.
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe("7.4-INT-02b: the FULL fail-closed DB surface — every locked column + the exempt precision (AC1, R-704)", () => {
  // (1) The remaining LOCKED quote_acceptances columns beyond the AC-named subset in 7.4-INT-02.
  // notes/planned dates are operational (not commitment) yet locked-by-default — the fail-closed
  // posture; adjustment_reason/evidence_file_id/quote_id complete the identity+evidence surface.
  const REMAINING_LOCKED_ACCEPTANCE_UPDATES: readonly { field: string; value: unknown }[] = [
    { field: "quote_id", value: crypto.randomUUID() },
    { field: "adjustment_reason", value: "tampered-reason" },
    { field: "evidence_file_id", value: crypto.randomUUID() },
    { field: "notes", value: "tampered-notes" },
    { field: "planned_start_date", value: "2030-01-01" },
    { field: "planned_end_date", value: "2030-02-01" },
  ];

  for (const { field, value } of REMAINING_LOCKED_ACCEPTANCE_UPDATES) {
    it(`[P0] 7.4-INT-02b: an authenticated UPDATE of quote_acceptances.\`${field}\` is denied (42501), while privileged SQL proves locked-by-default AR704`, async (testCtx) => {
      if (skipUnlessStack(testCtx, stackUp)) return;
      const { acceptanceId } = await seedAcceptedChain(fx.tenantA, clientA);
      const before = await adminSelectQuoteAcceptanceRow(acceptanceId);

      const { error } = await clientA
        .from("quote_acceptances")
        .update({ [field]: value })
        .eq("id", acceptanceId)
        .select();

      expect(error).not.toBeNull();
      expect(error?.code).toBe(QUOTE_ACCEPTANCE_DML_REVOKED_SQLSTATE);
      const afterAppAttempt = await adminSelectQuoteAcceptanceRow(acceptanceId);
      expect(String(afterAppAttempt?.[field])).toBe(String(before?.[field]));

      await expectPrivilegedAcceptanceUpdateLocked(acceptanceId, field, value);
      const afterTriggerAttempt = await adminSelectQuoteAcceptanceRow(acceptanceId);
      expect(String(afterTriggerAttempt?.[field])).toBe(String(before?.[field]));
    });
  }

  // (2) The exempt-THEN-tuple combined-mutation branch: an archived_at flip that ALSO mutates a
  // locked column in the SAME UPDATE must RAISE. A naive exempt short-circuit would let the locked
  // column through; the fail-closed trigger re-compares the full commitment tuple inside the exempt
  // branch and RAISEs. This is the single most important branch of enforce_quote_acceptance_lock.
  it("[P0] 7.4-INT-02b: an archived_at flip COMBINED with a locked-column change in the SAME UPDATE is REJECTED (the exempt branch does NOT let a locked column slip through)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { acceptanceId } = await seedAcceptedChain(fx.tenantA, clientA);
    const before = await adminSelectQuoteAcceptanceRow(acceptanceId);

    const { error } = await clientA
      .from("quote_acceptances")
      .update({ archived_at: fixedClock.now().toISOString(), accepted_price_ore: 999_999 })
      .eq("id", acceptanceId)
      .select();

    // Authenticated code is denied before trigger/RLS; no part of the mutation is written.
    expect(error).not.toBeNull();
    expect(error?.code).toBe(QUOTE_ACCEPTANCE_DML_REVOKED_SQLSTATE);
    const afterAppAttempt = await adminSelectQuoteAcceptanceRow(acceptanceId);
    // The whole row is byte-unchanged — neither the exempt NOR the locked column was written.
    expect(afterAppAttempt?.archived_at ?? null).toBe(before?.archived_at ?? null);
    expect(String(afterAppAttempt?.accepted_price_ore)).toBe(String(before?.accepted_price_ore));

    // The privileged path is the precise trigger proof: an archive flip cannot smuggle a lock change.
    await expect(
      adminQuery(
        "update public.quote_acceptances set archived_at = $2, accepted_price_ore = $3 where id = $1",
        [acceptanceId, fixedClock.now().toISOString(), 999_999],
      ),
    ).rejects.toMatchObject({ code: ACCEPTED_LOCK_SQLSTATE });
    const afterTriggerAttempt = await adminSelectQuoteAcceptanceRow(acceptanceId);
    expect(afterTriggerAttempt?.archived_at ?? null).toBe(before?.archived_at ?? null);
    expect(String(afterTriggerAttempt?.accepted_price_ore)).toBe(String(before?.accepted_price_ore));
  });

  // (3) jobs.created_at — the one job identity column 7.4-INT-02 omits — is in the locked tuple.
  it("[P0] 7.4-INT-02b: a DIRECT own-tenant UPDATE of jobs.`created_at` is REJECTED by the trigger (AR704)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { jobId } = await seedAcceptedChain(fx.tenantA, clientA);
    const before = await adminSelectJobRow(jobId);

    const { error } = await clientA
      .from("jobs")
      .update({ created_at: "2020-01-01T00:00:00.000Z" })
      .eq("id", jobId)
      .select();

    expect(error).not.toBeNull();
    expect(error?.code).toBe(ACCEPTED_LOCK_SQLSTATE);
    const after = await adminSelectJobRow(jobId);
    expect(String(after?.created_at)).toBe(String(before?.created_at));
  });

  // (4) Exempt PRECISION on jobs: facility_id/contact_id are deliberately UNLOCKED (ON DELETE SET
  // NULL, not AC-named commitment fields), so a direct own-tenant re-point SUCCEEDS. Proves the job
  // lock is the source-ref tuple ONLY, not a blanket freeze — the migration's explicit decision.
  it("[P0] 7.4-INT-02b: a DIRECT own-tenant UPDATE of jobs.`facility_id`/`contact_id` SUCCEEDS (deliberately UNLOCKED for the ON DELETE SET NULL cascade)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { jobId, altFacilityId, altContactId } = await seedAcceptedChainWithFacility(
      fx.tenantA,
      clientA,
    );

    const { error } = await clientA
      .from("jobs")
      .update({ facility_id: altFacilityId, contact_id: altContactId })
      .eq("id", jobId)
      .select();

    // The exempt SET-NULL columns are not in the locked tuple ⇒ the re-point is allowed.
    expect(error).toBeNull();
    const after = await adminSelectJobRow(jobId);
    expect(after?.facility_id).toBe(altFacilityId);
    expect(after?.contact_id).toBe(altContactId);
  });

  // Companion: nulling facility_id/contact_id (the actual ON DELETE SET NULL shape) also SUCCEEDS —
  // the cascade the lock must never fight.
  it("[P0] 7.4-INT-02b: a DIRECT own-tenant UPDATE nulling jobs.`facility_id`/`contact_id` SUCCEEDS (the SET NULL cascade is never fought)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { jobId } = await seedAcceptedChainWithFacility(fx.tenantA, clientA);

    const { error } = await clientA
      .from("jobs")
      .update({ facility_id: null, contact_id: null })
      .eq("id", jobId)
      .select();

    expect(error).toBeNull();
    const after = await adminSelectJobRow(jobId);
    expect(after?.facility_id).toBeNull();
    expect(after?.contact_id).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 7.4-INT-03 (P0, AC2) — accidental-update regression + the 7.2 idempotent-retry preservation
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe("7.4-INT-03: accidental-update regression + retry-path preservation (AC2, R-704/R-714)", () => {
  it("[P0] 7.4-INT-03: an id-only `updateJob` (empty patch) is a clean no-op — no false TENANT_ACCESS_DENIED, no write, no audit row, immutable fields byte-unchanged", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { jobId } = await seedAcceptedChain(fx.tenantA, clientA);
    const before = await adminSelectJobRow(jobId);
    const correlationId = crypto.randomUUID();

    const res = await runCommand(updateJob, {
      client: clientA as never,
      clock: fixedClock,
      correlationId,
      input: { id: jobId },
    });

    expect(res.ok).toBe(true);
    // No mutation ⇒ no audit row for the no-op (the empty-patch short-circuit — epic-3/5 discipline).
    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits.filter((a) => a.event_type === "job.updated").length).toBe(0);
    // The immutable source refs are byte-unchanged.
    const after = await adminSelectJobRow(jobId);
    expect(after?.quote_acceptance_id).toBe(before?.quote_acceptance_id);
    expect(after?.quote_version_id).toBe(before?.quote_version_id);
    expect(after?.customer_id).toBe(before?.customer_id);
  });

  it("[P0] 7.4-INT-03: a status-change `updateJob` appends EXACTLY ONE job_events row and never silently overwrites/hides an event; immutable fields byte-unchanged", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { jobId } = await seedAcceptedChain(fx.tenantA, clientA);
    const before = await adminSelectJobRow(jobId);
    const eventsBefore = await adminSelectJobEventsForJob(jobId);

    const res = await runCommand(updateJob, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { id: jobId, status: "in_progress" },
    });
    expect(res.ok).toBe(true);

    // EXACTLY ONE new append-only lifecycle row (never a silent overwrite/hide of an event).
    const eventsAfter = await adminSelectJobEventsForJob(jobId);
    expect(eventsAfter.length).toBe(eventsBefore.length + 1);
    expect(eventsAfter[eventsAfter.length - 1]?.event_type).toBe("in_progress");
    // The immutable source refs are byte-unchanged by the allowed status edit.
    const after = await adminSelectJobRow(jobId);
    expect(after?.quote_acceptance_id).toBe(before?.quote_acceptance_id);
    expect(after?.customer_id).toBe(before?.customer_id);
  });

  it("[P0] 7.4-INT-03: the 7.2 idempotent accept-retry is PRESERVED — a re-run on the already-accepted version returns the EXISTING (acceptanceId, jobId) with NO write (the accepted-lock trigger does NOT fire on the short-circuit)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // The RELAXED sent-state gate → idempotent short-circuit that 7.4 immutability MUST preserve
    // (the 7.2 retro headline). A re-run with IDENTICAL input on the already-accepted version must
    // idempotent-return, NOT raise — the trigger fires on UPDATE of quote_acceptances/jobs, and the
    // short-circuit performs NO immutable-field UPDATE (it SELECTs-and-returns).
    const { versionId, acceptanceId, jobId } = await seedAcceptedChain(fx.tenantA, clientA);

    const retry = await runCommand(acceptQuoteAndCreateJob, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: {
        quote_version_id: versionId,
        accepted_at: ACCEPTED_ISO,
        accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
        channel: "verbal",
      },
    });

    // The retry SUCCEEDS (not a lock error) and returns the SAME records — the short-circuit path.
    expect(retry.ok).toBe(true);
    if (!retry.ok) return;
    expect(retry.data.acceptanceId).toBe(acceptanceId);
    expect(retry.data.jobId).toBe(jobId);
    // NO second acceptance / NO second job was created (the idempotent return, not a new write).
    expect((await adminSelectAcceptancesForVersion(versionId)).length).toBe(1);
    expect((await adminSelectJobsForAcceptance(acceptanceId)).length).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 7.4-RLS-01 (P0, AC3) — cross-tenant attack on the accepted record (read + denied mutation)
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe("7.4-RLS-01: cross-tenant attack on accepted records (AC3, R-701/R-704)", () => {
  it("[P0] 7.4-RLS-01: tenant A reading a tenant B quote_acceptances/jobs row via its own RLS client ⇒ zero rows (no existence disclosure)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const clientB = await makeAuthedServerClient(fx.adminB);
    const { acceptanceId: bAcceptanceId, jobId: bJobId } = await seedAcceptedChain(fx.tenantB, clientB);

    // Tenant A's own RLS client cannot SEE a tenant B row — a foreign id ⇒ zero rows (not an error,
    // not an existence signal). This is RLS invisibility, identical to a not-found id.
    const { data: acc } = await clientA
      .from("quote_acceptances")
      .select("id")
      .eq("id", bAcceptanceId);
    expect(acc).toEqual([]);
    const { data: job } = await clientA.from("jobs").select("id").eq("id", bJobId);
    expect(job).toEqual([]);
  });

  it("[P0] 7.4-RLS-01: tenant A's authenticated UPDATE of a tenant B acceptance is denied (42501 before RLS), row untouched", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const clientB = await makeAuthedServerClient(fx.adminB);
    const { acceptanceId: bAcceptanceId } = await seedAcceptedChain(fx.tenantB, clientB);
    const before = await adminSelectQuoteAcceptanceRow(bAcceptanceId);

    // UPDATE privilege is revoked before RLS can apply. The foreign row remains untouched.
    const { error } = await clientA
      .from("quote_acceptances")
      .update({ accepted_price_ore: 1 })
      .eq("id", bAcceptanceId)
      .select();

    expect(error?.code).toBe(QUOTE_ACCEPTANCE_DML_REVOKED_SQLSTATE);
    const after = await adminSelectQuoteAcceptanceRow(bAcceptanceId);
    expect(String(after?.accepted_price_ore)).toBe(String(before?.accepted_price_ore));
  });

  it("[P0] 7.4-RLS-01: an anon (unauthenticated) caller on the LIVE updateJob command path ⇒ UNAUTHENTICATED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { jobId } = await seedAcceptedChain(fx.tenantA, clientA);
    const anon = await makeAnonServerClient();

    const res = await runCommand(updateJob, {
      client: anon as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { id: jobId, title: "anon attempt" },
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("UNAUTHENTICATED");
  });
});
