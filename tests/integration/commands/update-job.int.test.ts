/**
 * Story 7.3 — the `updateJob` allowed-edit command: the Phase-A-safe edit surface (AC4), the
 * immutable-refs-cannot-be-mutated gate (AC4), the audit-hygiene + job_events lifecycle append
 * (AC4), and the tenant-isolation negatives on the LIVE command (AC3). These are the load-bearing
 * behavioral proofs — a UI mirror is NOT the guarantee (the client cannot bypass the server
 * re-validation; architecture §9).
 *
 *   - 7.3-INT-02 (P1, AC4, R-708/R-711): an allowed edit (title / status / planned dates) persists
 *     through the audited `updateJob` command — EXACTLY ONE `audit_events` row with `{ targetId }` on
 *     the `target_id` COLUMN + `metadata` `{}` (NO PII/price/customer/title), and a `job_events`
 *     lifecycle row is appended WHEN the status changes. An attempt to smuggle an immutable/commitment
 *     field (`quote_version_id` / `quote_acceptance_id` / `customer_id` / `accepted_price_ore` /
 *     `evidence_*` / `accepted_at` / `channel` / `tenant_id`) is REJECTED with VALIDATION_FAILED
 *     (unknown field — the immutable fields are NOT part of the input shape; a client cannot smuggle
 *     them). Client-supplied `tenant_id` is NEVER read (the resolved tenant is the only authority).
 *   - AC3 (cross-tenant + anon, LIVE command negatives): `updateJob` on a foreign-tenant job id ⇒
 *     TENANT_ACCESS_DENIED BEFORE execute (RLS invisibility → envelope verifyOwnership; NO existence
 *     disclosure). An anon (unauthenticated) caller ⇒ UNAUTHENTICATED.
 *
 * The `updateJob` UPDATE targets `jobs` ONLY, touching ONLY the four Phase-A-safe columns, so the
 * COMING 7.4 `jobs` immutability trigger does not fire on an allowed edit. The empty-patch short-
 * circuit (epic-3/epic-5 deferral fix) returns the target id unchanged rather than issuing
 * `.update({})` AND writes NO audit row for the no-op.
 *
 * Harness conventions mirror `accept-quote-and-create-job.int.test.ts`: per-run unique ids, raw pg
 * readback via the BYPASSRLS admin helpers, the injected `ctx.clock.now()` for the job_events
 * `occurred_at`, runs against the LOCAL Supabase stack ONLY + visibly skips per-test when unreachable.
 * The job is produced by the REAL sent→accept→create-job chain (never a hand-inserted `jobs` row).
 * No PII/orgnr in fixtures; every öre value < 10 digits (R-717).
 *
 * [Source: test-design-epic-7.md#7.3-INT-02 + #Cross-tenant/anon (AC3); story 7.3 AC3/AC4 + Task 4;
 *  src/server/commands/crm/customers.ts (the defineCommand + ownership + empty-patch pattern);
 *  tests/integration/commands/accept-quote-and-create-job.int.test.ts (the real chain + audit shape)]
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
  adminSelectJobRow,
  adminSelectJobsForAcceptance,
  adminSelectJobEventsForJob,
  type TwoTenantFixture,
  type TestServerClient,
  type FixtureTenant,
} from "../../factories/tenants";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import {
  markQuoteVersionSent,
  acceptQuoteAndCreateJob,
} from "@/server/commands/quotes";
import { updateJob } from "@/server/commands/jobs";
import type { CommandClock } from "@/server/commands/clock";

const ACCEPTED_ISO = "2026-07-10T08:30:00.000Z";
const fixedClock: CommandClock = { now: () => new Date("2026-07-10T09:00:00.000Z") };
const SOURCE_SENT_TOTAL_ORE = 125_000; // < 10 digits (R-717)

describe("7.3-INT-02 + AC3: updateJob — allowed edits audited, immutable refs non-editable, tenant-isolated (R-708/R-710/R-711)", () => {
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

  /** Seed a REAL sent→accepted→job chain in the given tenant; return the created job id. */
  async function seedJob(
    tenant: FixtureTenant,
    client: TestServerClient,
    orgNr: string,
  ): Promise<string> {
    const customerId = await adminInsertCustomer({
      tenant_id: tenant.id,
      display_name: "Jobbkund",
      customer_type: "company",
      org_nr: orgNr,
    });
    const calcId = await adminInsertCalculation({
      tenant_id: tenant.id,
      customer_id: customerId,
    });
    const quoteId = await adminInsertQuote({
      tenant_id: tenant.id,
      customer_id: customerId,
    });
    const versionId = await adminInsertQuoteVersion({
      tenant_id: tenant.id,
      quote_id: quoteId,
      calculation_id: calcId,
      status: "draft",
      accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
    });
    const sent = await runCommand(markQuoteVersionSent, {
      client: client as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { quote_version_id: versionId },
    });
    expect(sent.ok).toBe(true);
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
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new Error("seedJob: accept failed");
    const jobs = await adminSelectJobsForAcceptance(accepted.data.acceptanceId);
    expect(jobs.length).toBe(1);
    return String(jobs[0]?.id);
  }

  // ── AC3: LIVE-command tenant-isolation negatives (negatives BEFORE positives) ────────────────

  it("[P0] AC3: updateJob on a foreign-tenant job id ⇒ TENANT_ACCESS_DENIED (RLS invisible, no existence disclosure)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const clientB = await makeAuthedServerClient(fx.adminB);
    const foreignJobId = await seedJob(fx.tenantB, clientB, "556100-0001");
    const result = await runCommand(updateJob, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { id: foreignJobId, title: "hijack attempt" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
  });

  it("[P0] AC3: an anon (unauthenticated) caller ⇒ UNAUTHENTICATED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const jobId = await seedJob(fx.tenantA, clientA, "556100-0002");
    const anon = await makeAnonServerClient();
    const result = await runCommand(updateJob, {
      client: anon as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { id: jobId, title: "anon attempt" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNAUTHENTICATED");
  });

  // ── AC4: immutable/commitment fields cannot be smuggled through the command ──────────────────

  it("[P1] 7.3-INT-02: an unknown/immutable field (quote_version_id) ⇒ VALIDATION_FAILED (not part of the input shape)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const jobId = await seedJob(fx.tenantA, clientA, "556100-0003");
    const result = await runCommand(updateJob, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { id: jobId, quote_version_id: crypto.randomUUID() } as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("[P1] 7.3-INT-02: an accepted-price / customer_id smuggle attempt ⇒ VALIDATION_FAILED (commitment data is not editable)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const jobId = await seedJob(fx.tenantA, clientA, "556100-0004");
    const result = await runCommand(updateJob, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: {
        id: jobId,
        accepted_price_ore: 1,
        customer_id: crypto.randomUUID(),
      } as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("[P1] 7.3-INT-02: a status outside the closed created|in_progress|done|cancelled set ⇒ VALIDATION_FAILED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const jobId = await seedJob(fx.tenantA, clientA, "556100-0005");
    const result = await runCommand(updateJob, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      // "scheduled"/"dispatched" are field-worker states — NOT part of the Phase-A order lifecycle.
      input: { id: jobId, status: "dispatched" as never },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  // ── AC4: allowed edits persist, are audited once, and append a job_events row on status change ──

  it("[P1] 7.3-INT-02: a title-only edit persists and writes EXACTLY ONE audit row with { targetId } on the target_id column + empty metadata (no status change ⇒ NO job_events row)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const jobId = await seedJob(fx.tenantA, clientA, "556100-0006");
    const eventsBefore = await adminSelectJobEventsForJob(jobId);
    const correlationId = crypto.randomUUID();

    const result = await runCommand(updateJob, {
      client: clientA as never,
      clock: fixedClock,
      correlationId,
      input: { id: jobId, title: "Uppdaterad jobbtitel" },
    });
    expect(result.ok).toBe(true);

    const row = await adminSelectJobRow(jobId);
    expect(row?.title).toBe("Uppdaterad jobbtitel");

    // EXACTLY ONE audit row for this update — target on the target_id COLUMN, empty allow-listed
    // metadata (no PII/price/customer/title).
    const audits = await adminSelectAuditEvents({ correlationId });
    const updateAudits = audits.filter((a) => a.event_type === "job.updated");
    expect(updateAudits.length).toBe(1);
    expect(updateAudits[0]?.target_id).toBe(jobId);
    expect(updateAudits[0]?.metadata).toEqual({});
    expect(JSON.stringify(updateAudits[0]?.metadata)).not.toMatch(
      /Uppdaterad|125000|customer/i,
    );
    // A non-status edit must NOT append a lifecycle event.
    const eventsAfter = await adminSelectJobEventsForJob(jobId);
    expect(eventsAfter.length).toBe(eventsBefore.length);
  });

  it("[P1] 7.3-INT-02: a status change persists, is audited, AND appends ONE job_events lifecycle row with occurred_at = the injected clock", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const jobId = await seedJob(fx.tenantA, clientA, "556100-0007");
    const eventsBefore = await adminSelectJobEventsForJob(jobId);

    const result = await runCommand(updateJob, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { id: jobId, status: "in_progress" },
    });
    expect(result.ok).toBe(true);

    const row = await adminSelectJobRow(jobId);
    expect(row?.status).toBe("in_progress");

    // A lifecycle row is appended for the new status, timestamped by the INJECTED clock (H1).
    const eventsAfter = await adminSelectJobEventsForJob(jobId);
    expect(eventsAfter.length).toBe(eventsBefore.length + 1);
    const newest = eventsAfter[eventsAfter.length - 1];
    expect(newest?.event_type).toBe("in_progress");
    expect(new Date(newest!.occurred_at).toISOString()).toBe(
      fixedClock.now().toISOString(),
    );
  });

  it("[P1] 7.3-INT-02: an empty patch (id only, no editable fields) short-circuits — no false TENANT_ACCESS_DENIED, no audit row", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const jobId = await seedJob(fx.tenantA, clientA, "556100-0008");
    const correlationId = crypto.randomUUID();
    // The epic-3/epic-5 empty-patch guard: no editable field supplied ⇒ return target id unchanged.
    const result = await runCommand(updateJob, {
      client: clientA as never,
      clock: fixedClock,
      correlationId,
      input: { id: jobId },
    });
    expect(result.ok).toBe(true);
    // No mutation ⇒ no audit row written for the no-op (this command self-audits ONLY on a change).
    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits.filter((a) => a.event_type === "job.updated").length).toBe(0);
  });
});
