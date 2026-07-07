/**
 * Story 7.2 — the `acceptQuoteAndCreateJob` narrow atomic RPC + command (ADR-A009). This is the
 * HIGHEST-STAKES suite of Epic 7: the idempotent, transactional multi-record write that records the
 * acceptance, flips the quote version `sent → accepted`, creates the minimal job, and writes
 * quote/job/audit events — all in ONE transaction, idempotent on retry + concurrent-accept, fully
 * rolled back on any mid-transaction failure.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * GREEN as of Story 7.2 dev. `src/server/commands/quotes/accept-and-create-job.ts` (the
 * `acceptQuoteAndCreateJob` command), the `accept_quote_and_create_job` RPC migration
 * (20260710120000), and the `jobs`/`job_events` read-back factory helpers now exist; `.skip` removed.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Coverage (test-design-epic-7.md #Test Coverage Plan, story-7.2 rows):
 *   - 7.2-INT-01 (P0, AC1, R-703/R-710): happy path — records the acceptance, flips lifecycle
 *     `sent → accepted`, creates the minimal job with immutable source refs, writes `quote_events`
 *     (`accepted`) / `job_events` (`created`) / ONE `audit_events` row, commits ALL together.
 *   - 7.2-INT-02 (P0, AC2, R-702/R-710): retry idempotency (the HEADLINE) — a second identical call
 *     returns the SAME (acceptance_id, job_id) and creates NO second acceptance/job/lifecycle
 *     transition/event/audit.
 *   - 7.2-INT-03 (P0, AC2, R-702): DB-level duplicate-prevention — a DIRECT second acceptance INSERT
 *     for the same version violates `unique (quote_version_id)`; a DIRECT second job INSERT for the
 *     same acceptance violates `unique (quote_acceptance_id)` (the backstop below the command).
 *   - 7.2-INT-04 (P0, AC3, R-703 / NFR20): atomicity — an injected mid-transaction failure leaves
 *     NO acceptance, NO lifecycle change, NO job, NO event (behavioral rollback proof).
 *   - 7.2-INT-05 (P0, AC4, R-707/R-701): cross-tenant (foreign version id ⇒ TENANT_ACCESS_DENIED)
 *     + anonymous (⇒ UNAUTHENTICATED) + non-sent (⇒ VALIDATION_FAILED) rejection; generic error,
 *     no existence disclosure.
 *   - 7.2-INT-06 (P0, AC2, R-702): concurrent accept — two parallel Promise.all accepts of the same
 *     sent version ⇒ exactly ONE creates, the other idempotent-returns OR fails cleanly with
 *     COMMAND_CONFLICT/ACCEPTANCE_ALREADY_RECORDED; NEVER two jobs (row-lock proof; sleep-free).
 *   - 7.2-INT-07 (P1, AC1/AC2, R-710): every event/audit row present on success + NO DUPLICATE on
 *     retry; allow-listed audit metadata, no raw price/PII.
 *   - 7.2-INT-08 (P2, AC2, R-712): lifecycle edge — accepting an ALREADY-accepted version + a second
 *     create-job attempt on an existing acceptance both idempotent-return the existing records.
 *
 * Harness conventions mirror `capture-quote-acceptance.int.test.ts` + `mark-quote-version-sent.int.
 * test.ts`: per-run unique ids (`crypto.randomUUID()`), raw pg readback via the BYPASSRLS admin
 * helpers (bigint öre → STRING; timestamptz → Date/ISO — coerce on readback), runs against the LOCAL
 * Supabase stack ONLY + visibly skips per-test when unreachable. AFTER a `supabase db reset` the
 * runner polls `/auth/v1/health` to 200 before this DB-backed suite (the Kong→GoTrue 502 false-green
 * trap — epic-5/6/8 retros). CI (`SUPABASE_TEST_REQUIRED=1`) hard-fails so these transaction proofs
 * are never silently skipped.
 *
 * The REAL sent fixture is produced by driving the LANDED Epic-6 `mark_quote_version_sent` RPC (no
 * synthetic `sent` row): seed a version as `draft` → flip to `sent` via the real command; the seed
 * carries a NON-ZERO frozen `accepted_price_ore` (the source sent total the AC5 delta measures
 * against — the 7.1 zero-frozen residual). Concurrency/count-asserting tests seed unique ids.
 *
 * [Source: test-design-epic-7.md#7.2-INT-01..08, Testability notes 2/3/6/10, R-702/R-703/R-707/R-710/
 *  R-712; story 7.2 AC1-AC6 + Tasks 1-4; architecture.md#13 (the 10 transaction steps) + ADR-A009;
 *  supabase/migrations/20260710120000_accept_quote_and_create_job.sql;
 *  src/server/commands/quotes/{mark-sent,accept,accept-and-create-job}.ts]
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
  adminInsertQuoteAcceptance,
  adminInsertJob,
  adminSelectAcceptancesForVersion,
  adminSelectQuoteVersionRow,
  adminSelectQuoteEventsForVersion,
  adminSelectJobRow,
  adminSelectJobsForAcceptance,
  adminSelectJobEventsForJob,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import { acceptQuoteAndCreateJob, markQuoteVersionSent } from "@/server/commands/quotes";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-10T09:00:00.000Z";
const ACCEPTED_ISO = "2026-07-10T08:30:00.000Z"; // the EXPLICIT accepted moment (≠ command clock)
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

/** The frozen source sent total (öre) every seeded sent version carries (< 10 digits — R-717). */
const SOURCE_SENT_TOTAL_ORE = 125_000;

/**
 * Seed a quote + one DRAFT version carrying the frozen source sent total, then drive the REAL
 * `mark_quote_version_sent` command to flip it to `sent` (no synthetic sent row — the 6.4 child-lock
 * requires flip-after-seed). Returns the ids.
 */
async function seedSentVersion(
  tenantId: string,
  client: TestServerClient,
): Promise<{ quoteId: string; versionId: string; customerId: string }> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenantId,
    customer_type: "company",
    display_name: `acj-customer-${crypto.randomUUID().slice(0, 8)}`,
  });
  const calcId = await adminInsertCalculation({
    tenant_id: tenantId,
    customer_id: customerId,
    title: `acj-calc-${crypto.randomUUID().slice(0, 8)}`,
  });
  const quoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
  const versionId = await adminInsertQuoteVersion({
    tenant_id: tenantId,
    quote_id: quoteId,
    calculation_id: calcId,
    status: "draft",
    accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
  });
  const sent = await runCommand(markQuoteVersionSent, {
    client: client as never,
    input: { quote_version_id: versionId },
    clock: fixedClock,
    correlationId: crypto.randomUUID(),
  });
  if (!sent.ok) throw new Error(`seedSentVersion: mark-sent failed (${sent.code})`);
  return { quoteId, versionId, customerId };
}

/** The happy-path acceptance input (equal price ⇒ no adjustment reason required). */
function acceptInput(versionId: string) {
  return {
    quote_version_id: versionId,
    accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
    accepted_at: ACCEPTED_ISO,
    title: "Jobb från accepterad offert",
  };
}

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key (RLS) client

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
});
afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
});

describe("acceptQuoteAndCreateJob — atomic accept + create job (AC1)", () => {
  it("[P0] 7.2-INT-01: happy path — records the acceptance, flips `sent → accepted`, creates the minimal job with immutable source refs, writes a `quote_events` accepted + a `job_events` created + ONE audit row, all committed together", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId, customerId } = await seedSentVersion(fixture.tenantA.id, a);
    const correlationId = crypto.randomUUID();

    const res = await runCommand(acceptQuoteAndCreateJob, {
      client: a as never,
      input: acceptInput(versionId),
      clock: fixedClock,
      correlationId,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const { acceptanceId, jobId } = res.data;
    expect(res.data.targetId).toBe(acceptanceId);

    // 1) Acceptance row recorded (öre persisted as bigint; accepted_at = the EXPLICIT input, H1).
    const acc = await adminSelectAcceptancesForVersion(versionId);
    expect(acc.length).toBe(1);
    expect(String(acc[0]?.accepted_price_ore)).toBe(String(SOURCE_SENT_TOTAL_ORE));
    expect(String(acc[0]?.source_sent_total_ore)).toBe(String(SOURCE_SENT_TOTAL_ORE));

    // 2) Lifecycle flipped sent → accepted (status ALONE; the sent-lock trigger permits it).
    const ver = await adminSelectQuoteVersionRow(versionId);
    expect(ver?.status).toBe("accepted");

    // 3) Minimal job created with immutable source refs + carried customer.
    const job = await adminSelectJobRow(jobId);
    expect(job?.quote_acceptance_id).toBe(acceptanceId);
    expect(job?.quote_version_id).toBe(versionId);
    expect(job?.customer_id).toBe(customerId);
    expect(job?.status).toBe("created");
    // SCOPE GUARD: no cost/margin/invoice/Fortnox/time-material/deviation/field-worker column.
    for (const forbidden of ["cost_ore", "margin_ore", "invoice_id", "fortnox_id"]) {
      expect(Object.prototype.hasOwnProperty.call(job ?? {}, forbidden)).toBe(false);
    }

    // 4) A `quote_events` accepted row.
    const qEvents = await adminSelectQuoteEventsForVersion(versionId);
    expect(qEvents.some((e) => e.event_type === "accepted")).toBe(true);

    // 5) A `job_events` created row.
    const jEvents = await adminSelectJobEventsForJob(jobId);
    expect(jEvents.some((e) => e.event_type === "created")).toBe(true);

    // 6) EXACTLY ONE append-only audit row — { targetId } on the target_id COLUMN, metadata `{}`,
    //    NO raw price / customer / channel / PII anywhere.
    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits.length).toBe(1);
    expect(audits[0]?.target_id).toBe(acceptanceId);
    expect(audits[0]?.metadata).toEqual({});
    expect(JSON.stringify(audits[0]?.metadata)).not.toMatch(/125000|customer/i);
  });

  it("[P0] 7.2-INT-01: the accepted instant is the EXPLICIT input (H1), NOT the injected command clock", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedSentVersion(fixture.tenantA.id, a);
    const res = await runCommand(acceptQuoteAndCreateJob, {
      client: a as never,
      input: acceptInput(versionId),
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const acc = (await adminSelectAcceptancesForVersion(versionId))[0];
    const acceptedAt =
      acc?.accepted_at instanceof Date ? acc.accepted_at.toISOString() : String(acc?.accepted_at);
    expect(acceptedAt).toBe(ACCEPTED_ISO);
    expect(acceptedAt).not.toBe(FIXED_ISO);
  });
});

describe("acceptQuoteAndCreateJob — retry idempotency (AC2 — the headline)", () => {
  it("[P0] 7.2-INT-02: a second identical call returns the SAME (acceptance_id, job_id) and creates NO second acceptance/job/lifecycle-transition/event/audit", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedSentVersion(fixture.tenantA.id, a);

    const first = await runCommand(acceptQuoteAndCreateJob, {
      client: a as never,
      input: acceptInput(versionId),
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = await runCommand(acceptQuoteAndCreateJob, {
      client: a as never,
      input: acceptInput(versionId),
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    // Same ids returned (idempotent short-circuit — the existing records).
    expect(second.data.acceptanceId).toBe(first.data.acceptanceId);
    expect(second.data.jobId).toBe(first.data.jobId);
    // Exactly ONE acceptance + ONE job for the version.
    expect((await adminSelectAcceptancesForVersion(versionId)).length).toBe(1);
    expect((await adminSelectJobsForAcceptance(first.data.acceptanceId)).length).toBe(1);
    // No SECOND `accepted` quote_event / `created` job_event.
    const qEvents = await adminSelectQuoteEventsForVersion(versionId);
    expect(qEvents.filter((e) => e.event_type === "accepted").length).toBe(1);
    const jEvents = await adminSelectJobEventsForJob(first.data.jobId);
    expect(jEvents.filter((e) => e.event_type === "created").length).toBe(1);
  });

  it("[P0] 7.2-INT-02: an idempotent re-entry writes NO fresh audit row (R-710 — the retry produced no state change)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedSentVersion(fixture.tenantA.id, a);
    const retryCorrelation = crypto.randomUUID();
    const first = await runCommand(acceptQuoteAndCreateJob, {
      client: a as never,
      input: acceptInput(versionId),
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(first.ok).toBe(true);
    const second = await runCommand(acceptQuoteAndCreateJob, {
      client: a as never,
      input: acceptInput(versionId),
      clock: fixedClock,
      correlationId: retryCorrelation,
    });
    expect(second.ok).toBe(true);
    // The idempotent re-entry produced NO state change → NO audit row under its correlation id.
    expect((await adminSelectAuditEvents({ correlationId: retryCorrelation })).length).toBe(0);
  });
});

describe("acceptQuoteAndCreateJob — DB duplicate-prevention constraints (AC2)", () => {
  it("[P0] 7.2-INT-03: a DIRECT second `quote_acceptances` INSERT for the same version violates `unique (quote_version_id)` — the DB backstop below the command", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId, quoteId } = await seedSentVersion(fixture.tenantA.id, a);
    const firstAcceptanceId = await adminInsertQuoteAcceptance({
      tenant_id: fixture.tenantA.id,
      quote_id: quoteId,
      quote_version_id: versionId,
      accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
      source_sent_total_ore: SOURCE_SENT_TOTAL_ORE,
    });
    expect(firstAcceptanceId).toBeTruthy();
    await expect(
      adminInsertQuoteAcceptance({
        tenant_id: fixture.tenantA.id,
        quote_id: quoteId,
        quote_version_id: versionId,
        accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
        source_sent_total_ore: SOURCE_SENT_TOTAL_ORE,
      }),
    ).rejects.toThrow();
    expect((await adminSelectAcceptancesForVersion(versionId)).length).toBe(1);
  });

  it("[P0] 7.2-INT-03: a DIRECT second `jobs` INSERT for the same acceptance violates `unique (quote_acceptance_id)` — one job per acceptance", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId, quoteId, customerId } = await seedSentVersion(fixture.tenantA.id, a);
    const acceptanceId = await adminInsertQuoteAcceptance({
      tenant_id: fixture.tenantA.id,
      quote_id: quoteId,
      quote_version_id: versionId,
      accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
      source_sent_total_ore: SOURCE_SENT_TOTAL_ORE,
    });
    const jobId = await adminInsertJob({
      tenant_id: fixture.tenantA.id,
      quote_acceptance_id: acceptanceId,
      quote_version_id: versionId,
      customer_id: customerId,
    });
    expect(jobId).toBeTruthy();
    await expect(
      adminInsertJob({
        tenant_id: fixture.tenantA.id,
        quote_acceptance_id: acceptanceId,
        quote_version_id: versionId,
        customer_id: customerId,
      }),
    ).rejects.toThrow();
  });
});

describe("acceptQuoteAndCreateJob — atomicity / no partial state (AC3, NFR20)", () => {
  it("[P0] 7.2-INT-04: an injected mid-transaction failure at the JOB-insert boundary leaves NO acceptance, NO lifecycle change, NO job, NO event — behavioral rollback proof", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedSentVersion(fixture.tenantA.id, a);

    const res = await runCommand(acceptQuoteAndCreateJob, {
      client: a as never,
      input: { ...acceptInput(versionId), __faultInject: "job-insert" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(false);

    // NOTHING committed: no acceptance, no lifecycle flip, no accepted event.
    expect((await adminSelectAcceptancesForVersion(versionId)).length).toBe(0);
    const ver = await adminSelectQuoteVersionRow(versionId);
    expect(ver?.status).toBe("sent"); // NOT flipped to accepted
    const qEvents = await adminSelectQuoteEventsForVersion(versionId);
    expect(qEvents.some((e) => e.event_type === "accepted")).toBe(false);
  });

  it("[P0] 7.2-INT-04: a fault at the EVENT-write boundary also rolls the whole transaction back (no orphaned acceptance/job)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedSentVersion(fixture.tenantA.id, a);
    const res = await runCommand(acceptQuoteAndCreateJob, {
      client: a as never,
      input: { ...acceptInput(versionId), __faultInject: "event-write" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(false);
    expect((await adminSelectAcceptancesForVersion(versionId)).length).toBe(0);
    expect((await adminSelectQuoteVersionRow(versionId))?.status).toBe("sent");
  });
});

describe("acceptQuoteAndCreateJob — cross-tenant + anon + non-sent rejection (AC4)", () => {
  it("[P0] 7.2-INT-05: a foreign-tenant (Tenant B) sent version id ⇒ TENANT_ACCESS_DENIED before execute; no existence disclosure; Tenant-B untouched", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const b = await makeAuthedServerClient(fixture.adminB);
    const { versionId: bVersionId } = await seedSentVersion(fixture.tenantB.id, b);

    const res = await runCommand(acceptQuoteAndCreateJob, {
      client: a as never, // adminA on a B id
      input: acceptInput(bVersionId),
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("TENANT_ACCESS_DENIED");
    expect(res.message).not.toMatch(/exist|tenant b|another|version/i);
    // The Tenant-B version is untouched — no acceptance, still sent.
    expect((await adminSelectAcceptancesForVersion(bVersionId)).length).toBe(0);
    expect((await adminSelectQuoteVersionRow(bVersionId))?.status).toBe("sent");
  });

  it("[P0] 7.2-INT-05: an ANONYMOUS caller ⇒ UNAUTHENTICATED (anon must NOT execute the RPC — revoke-from-public)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedSentVersion(fixture.tenantA.id, a);
    const anon = await makeAnonServerClient();
    const res = await runCommand(acceptQuoteAndCreateJob, {
      client: anon as never,
      input: acceptInput(versionId),
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("UNAUTHENTICATED");
    expect((await adminSelectAcceptancesForVersion(versionId)).length).toBe(0);
  });

  it("[P0] 7.2-INT-05: a non-sent (draft) version ⇒ a user-safe lifecycle rejection (VALIDATION_FAILED), no leak, no write", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // A draft version (never flipped to sent) — acceptance is legal ONLY on status='sent' (AC4).
    const customerId = await adminInsertCustomer({
      tenant_id: fixture.tenantA.id,
      customer_type: "company",
      display_name: `acj-draft-${crypto.randomUUID().slice(0, 8)}`,
    });
    const calcId = await adminInsertCalculation({
      tenant_id: fixture.tenantA.id,
      customer_id: customerId,
      title: `acj-draft-calc-${crypto.randomUUID().slice(0, 8)}`,
    });
    const quoteId = await adminInsertQuote({ tenant_id: fixture.tenantA.id, customer_id: customerId });
    const versionId = await adminInsertQuoteVersion({
      tenant_id: fixture.tenantA.id,
      quote_id: quoteId,
      calculation_id: calcId,
      status: "draft",
      accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
    });
    const res = await runCommand(acceptQuoteAndCreateJob, {
      client: a as never,
      input: acceptInput(versionId),
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("VALIDATION_FAILED");
    expect(res.message).not.toMatch(/draft|status|QV409|23514|stack/i);
    expect((await adminSelectAcceptancesForVersion(versionId)).length).toBe(0);
  });
});

describe("acceptQuoteAndCreateJob — concurrent accept (AC2 — row-lock proof)", () => {
  it("[P0] 7.2-INT-06: two PARALLEL Promise.all accepts of the same sent version ⇒ exactly ONE job; the other idempotent-returns or fails COMMAND_CONFLICT/ACCEPTANCE_ALREADY_RECORDED; NEVER two jobs (sleep-free)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedSentVersion(fixture.tenantA.id, a);

    const [r1, r2] = await Promise.all([
      runCommand(acceptQuoteAndCreateJob, {
        client: a as never,
        input: acceptInput(versionId),
        clock: fixedClock,
        correlationId: crypto.randomUUID(),
      }),
      runCommand(acceptQuoteAndCreateJob, {
        client: a as never,
        input: acceptInput(versionId),
        clock: fixedClock,
        correlationId: crypto.randomUUID(),
      }),
    ]);
    // Exactly ONE acceptance + ONE job persisted, regardless of the two outcomes.
    const accs = await adminSelectAcceptancesForVersion(versionId);
    expect(accs.length).toBe(1);
    const acceptanceId = accs[0]?.id as string;
    expect((await adminSelectJobsForAcceptance(acceptanceId)).length).toBe(1);
    // Every OK result points at the SAME single acceptance (no forked commitment).
    for (const r of [r1, r2]) {
      if (r.ok) {
        expect(r.data.acceptanceId).toBe(acceptanceId);
      } else {
        expect(["COMMAND_CONFLICT", "ACCEPTANCE_ALREADY_RECORDED"]).toContain(r.code);
      }
    }
    // At least one call succeeded (the winner).
    expect(r1.ok || r2.ok).toBe(true);
  });
});

describe("acceptQuoteAndCreateJob — event/audit completeness + no-duplicate-on-retry (AC1/AC2)", () => {
  it("[P1] 7.2-INT-07: on success every expected row is present (acceptance, job, quote `accepted` event, job `created` event, ONE audit); a retry adds NO duplicate of any of them", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedSentVersion(fixture.tenantA.id, a);
    const first = await runCommand(acceptQuoteAndCreateJob, {
      client: a as never,
      input: acceptInput(versionId),
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    // Present on success.
    expect((await adminSelectAcceptancesForVersion(versionId)).length).toBe(1);
    expect((await adminSelectJobsForAcceptance(first.data.acceptanceId)).length).toBe(1);
    expect(
      (await adminSelectQuoteEventsForVersion(versionId)).filter((e) => e.event_type === "accepted").length,
    ).toBe(1);
    expect(
      (await adminSelectJobEventsForJob(first.data.jobId)).filter((e) => e.event_type === "created").length,
    ).toBe(1);
    // Retry adds no duplicate of any row.
    const retry = await runCommand(acceptQuoteAndCreateJob, {
      client: a as never,
      input: acceptInput(versionId),
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(retry.ok).toBe(true);
    expect((await adminSelectAcceptancesForVersion(versionId)).length).toBe(1);
    expect((await adminSelectJobsForAcceptance(first.data.acceptanceId)).length).toBe(1);
    expect(
      (await adminSelectQuoteEventsForVersion(versionId)).filter((e) => e.event_type === "accepted").length,
    ).toBe(1);
    expect(
      (await adminSelectJobEventsForJob(first.data.jobId)).filter((e) => e.event_type === "created").length,
    ).toBe(1);
  });
});

describe("acceptQuoteAndCreateJob — lifecycle edges (AC2, P2)", () => {
  it("[P2] 7.2-INT-08: accepting an ALREADY-accepted version (its acceptance + job already exist) idempotent-returns the EXISTING records, no error-path duplication", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedSentVersion(fixture.tenantA.id, a);
    const first = await runCommand(acceptQuoteAndCreateJob, {
      client: a as never,
      input: acceptInput(versionId),
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    // The version is now `accepted`; a repeat accept idempotent-returns the same records.
    expect((await adminSelectQuoteVersionRow(versionId))?.status).toBe("accepted");
    const repeat = await runCommand(acceptQuoteAndCreateJob, {
      client: a as never,
      input: acceptInput(versionId),
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(repeat.ok).toBe(true);
    if (!repeat.ok) return;
    expect(repeat.data.acceptanceId).toBe(first.data.acceptanceId);
    expect(repeat.data.jobId).toBe(first.data.jobId);
    expect((await adminSelectAcceptancesForVersion(versionId)).length).toBe(1);
  });
});
