/**
 * Story 7.3 — the `updateJob` allowed-edit command: the Phase-A-safe edit surface (AC4), the
 * immutable-refs-cannot-be-mutated gate (AC4), the audit-hygiene + job_events lifecycle append
 * (AC4), and the tenant-isolation negatives on the LIVE command (AC3). These are the load-bearing
 * behavioral proofs — a UI mirror is NOT the guarantee (the client cannot bypass the server
 * re-validation; architecture §9).
 *
 *   - 7.3-INT-02 (P1, AC4, R-708/R-711): an allowed edit (title / status / planned dates) persists
 *     through the audited `updateJob` command — EXACTLY ONE `audit_events` row with ALLOW-LISTED
 *     `{ targetId }` metadata (NO PII/price/customer/title), and a `job_events` lifecycle row is
 *     appended WHEN the status changes. An attempt to smuggle an immutable/commitment field
 *     (`quote_version_id` / `quote_acceptance_id` / `customer_id` / `accepted_price_ore` /
 *     `evidence_*` / `accepted_at` / `channel` / `tenant_id`) is REJECTED with VALIDATION_FAILED
 *     (unknown field — the immutable fields are NOT part of the input shape; a client cannot smuggle
 *     them). Client-supplied `tenant_id` is NEVER read (the resolved tenant is the only authority).
 *   - AC3 (cross-tenant + anon, LIVE command negatives): `updateJob` on a foreign-tenant job id ⇒
 *     TENANT_ACCESS_DENIED BEFORE execute (RLS invisibility → envelope verifyOwnership; NO existence
 *     disclosure). An anon (unauthenticated) caller ⇒ UNAUTHENTICATED. The three tables' H4/enrollment
 *     cross-tenant negatives are 7.1's (already green) — 7.3 adds the live-command negatives.
 *
 * The `updateJob` UPDATE targets `jobs` ONLY, touching ONLY the four Phase-A-safe columns, so the
 * COMING 7.4 `jobs` immutability trigger does not fire on an allowed edit (7.3 adds NO immutability
 * trigger and NO migration — same 6.1→6.4 additive pattern). The empty-patch short-circuit (epic-3/
 * epic-5 deferral fix) returns the target id unchanged rather than issuing `.update({})`.
 *
 * Harness conventions mirror `crm-customer-commands.int.test.ts` (the updateCustomer allowed-edit +
 * foreign-id TENANT_ACCESS_DENIED pattern) and `accept-quote-and-create-job.int.test.ts` (the real
 * RPC chain that produces the job): per-run unique ids (`crypto.randomUUID()`), raw pg readback via
 * the BYPASSRLS admin helpers, the injected `ctx.clock.now()` for the job_events `occurred_at`, runs
 * against the LOCAL Supabase stack ONLY + visibly skips when unreachable. AFTER a `supabase db reset`
 * the runner polls `/auth/v1/health` to 200 first. CI (`SUPABASE_TEST_REQUIRED=1`) hard-fails so
 * these proofs are never silently skipped. The job is produced by the REAL sent→accept→create-job
 * chain (never a hand-inserted `jobs` row) so the source refs are authentic. No PII/orgnr in
 * fixtures; every öre value < 10 digits (R-717).
 *
 * ── RED PHASE ─────────────────────────────────────────────────────────────────────────────────
 * `updateJob` (`src/server/commands/jobs`) does not exist yet. Every test is `.skip`. GREEN PHASE:
 * implement the command (mirror `updateCustomer`) + the read layer, then remove `.skip`. These tests
 * assert EXPECTED behavior — they FAIL (compile/import) until 7.3 lands.
 *
 * [Source: test-design-epic-7.md#7.3-INT-02 + #Cross-tenant/anon (AC3, target the LIVE path), #Risk
 *  R-708/R-710/R-711; story 7.3 AC3/AC4 + Task 4 (updateJob) + Testing section; src/server/commands/
 *  crm/customers.ts (the defineCommand + ownership + empty-patch + allow-listed audit pattern to
 *  mirror); tests/integration/commands/crm-customer-commands.int.test.ts (the negative-first proof
 *  layout); tests/factories/tenants.ts (adminSelectJobRow / adminSelectJobEventsForJob — reuse the
 *  7.2 helpers); tests/factories/audit-events.ts (adminSelectAuditEvents)]
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
} from "../../factories/tenants";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import { markQuoteVersionSent, acceptQuoteAndCreateJob } from "@/server/commands/quotes";
// RED PHASE: this module does not exist yet — the import FAILS until 7.3 Task 4 lands it.
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
    clientA = await makeAuthedServerClient(fx.tenantA.adminUserId);
  });

  afterAll(async () => {
    if (stackUp && fx) await cleanupFixture(fx);
  });

  /** Seed a REAL sent→accepted→job chain in the given tenant; return the created job id. */
  async function seedJob(
    tenant: TwoTenantFixture["tenantA"],
    client: TestServerClient,
  ): Promise<string> {
    const customerId = await adminInsertCustomer({
      tenantId: tenant.tenantId,
      displayName: "Jobbkund",
      customerType: "company",
    });
    const calcId = await adminInsertCalculation({ tenantId: tenant.tenantId });
    const quoteId = await adminInsertQuote({
      tenantId: tenant.tenantId,
      customerId,
      calculationId: calcId,
    });
    const versionId = await adminInsertQuoteVersion({
      tenantId: tenant.tenantId,
      quoteId,
      status: "draft",
      acceptedPriceOre: SOURCE_SENT_TOTAL_ORE,
    });
    await runCommand(markQuoteVersionSent, {
      actor: { tenantId: tenant.tenantId, userId: tenant.adminUserId },
      client,
      clock: fixedClock,
      input: { id: versionId },
    });
    await runCommand(acceptQuoteAndCreateJob, {
      actor: { tenantId: tenant.tenantId, userId: tenant.adminUserId },
      client,
      clock: fixedClock,
      input: {
        quoteVersionId: versionId,
        acceptedAt: ACCEPTED_ISO,
        acceptedPriceOre: SOURCE_SENT_TOTAL_ORE,
        channel: "verbal",
      },
    });
    const jobs = await adminSelectJobsForAcceptance(versionId);
    expect(jobs.length).toBe(1);
    return jobs[0].id;
  }

  // ── AC3: LIVE-command tenant-isolation negatives (negatives BEFORE positives) ────────────────

  it.skip("[P0] AC3: updateJob on a foreign-tenant job id ⇒ TENANT_ACCESS_DENIED (RLS invisible, no existence disclosure)", async () => {
    if (!stackUp) return skipUnlessStack();
    // Seed the job in tenant B; attempt the edit AS tenant A → the ownership gate sees zero rows.
    const clientB = await makeAuthedServerClient(fx.tenantB.adminUserId);
    const foreignJobId = await seedJob(fx.tenantB, clientB);
    const result = await runCommand(updateJob, {
      actor: { tenantId: fx.tenantA.tenantId, userId: fx.tenantA.adminUserId },
      client: clientA,
      clock: fixedClock,
      input: { id: foreignJobId, title: "hijack attempt" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
  });

  it.skip("[P0] AC3: an anon (unauthenticated) caller ⇒ UNAUTHENTICATED", async () => {
    if (!stackUp) return skipUnlessStack();
    const jobId = await seedJob(fx.tenantA, clientA);
    const anon = await makeAnonServerClient();
    const result = await runCommand(updateJob, {
      actor: { tenantId: fx.tenantA.tenantId, userId: fx.tenantA.adminUserId },
      client: anon,
      clock: fixedClock,
      input: { id: jobId, title: "anon attempt" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNAUTHENTICATED");
  });

  // ── AC4: immutable/commitment fields cannot be smuggled through the command ──────────────────

  it.skip("[P1] 7.3-INT-02: an unknown/immutable field (quote_version_id) ⇒ VALIDATION_FAILED (not part of the input shape)", async () => {
    if (!stackUp) return skipUnlessStack();
    const jobId = await seedJob(fx.tenantA, clientA);
    const result = await runCommand(updateJob, {
      actor: { tenantId: fx.tenantA.tenantId, userId: fx.tenantA.adminUserId },
      client: clientA,
      clock: fixedClock,
      // The immutable ref is NOT a valid input key — the validator rejects the unknown field.
      input: { id: jobId, quote_version_id: crypto.randomUUID() } as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it.skip("[P1] 7.3-INT-02: an accepted-price / customer_id smuggle attempt ⇒ VALIDATION_FAILED (commitment data is not editable)", async () => {
    if (!stackUp) return skipUnlessStack();
    const jobId = await seedJob(fx.tenantA, clientA);
    const result = await runCommand(updateJob, {
      actor: { tenantId: fx.tenantA.tenantId, userId: fx.tenantA.adminUserId },
      client: clientA,
      clock: fixedClock,
      input: { id: jobId, accepted_price_ore: 1, customer_id: crypto.randomUUID() } as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it.skip("[P1] 7.3-INT-02: a status outside the closed created|in_progress|done|cancelled set ⇒ VALIDATION_FAILED", async () => {
    if (!stackUp) return skipUnlessStack();
    const jobId = await seedJob(fx.tenantA, clientA);
    const result = await runCommand(updateJob, {
      actor: { tenantId: fx.tenantA.tenantId, userId: fx.tenantA.adminUserId },
      client: clientA,
      clock: fixedClock,
      // "scheduled"/"dispatched" are field-worker states — NOT part of the Phase-A order lifecycle.
      input: { id: jobId, status: "dispatched" as never },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  // ── AC4: allowed edits persist, are audited once, and append a job_events row on status change ──

  it.skip("[P1] 7.3-INT-02: a title-only edit persists and writes EXACTLY ONE audit row with allow-listed { targetId } metadata (no status change ⇒ NO job_events row)", async () => {
    if (!stackUp) return skipUnlessStack();
    const jobId = await seedJob(fx.tenantA, clientA);
    const eventsBefore = await adminSelectJobEventsForJob(jobId);

    const result = await runCommand(updateJob, {
      actor: { tenantId: fx.tenantA.tenantId, userId: fx.tenantA.adminUserId },
      client: clientA,
      clock: fixedClock,
      input: { id: jobId, title: "Uppdaterad jobbtitel" },
    });
    expect(result.ok).toBe(true);

    const row = await adminSelectJobRow(jobId);
    expect(row?.title).toBe("Uppdaterad jobbtitel");

    // EXACTLY ONE audit row for this update, allow-listed metadata (no PII/price/customer/title).
    const audits = await adminSelectAuditEvents({
      tenantId: fx.tenantA.tenantId,
      targetType: "job",
      targetId: jobId,
    });
    const updateAudits = audits.filter((a) => a.eventType === "job.updated");
    expect(updateAudits.length).toBe(1);
    expect(updateAudits[0].metadata).toEqual({ targetId: jobId });
    // A non-status edit must NOT append a lifecycle event.
    const eventsAfter = await adminSelectJobEventsForJob(jobId);
    expect(eventsAfter.length).toBe(eventsBefore.length);
  });

  it.skip("[P1] 7.3-INT-02: a status change persists, is audited, AND appends ONE job_events lifecycle row with occurred_at = the injected clock", async () => {
    if (!stackUp) return skipUnlessStack();
    const jobId = await seedJob(fx.tenantA, clientA);
    const eventsBefore = await adminSelectJobEventsForJob(jobId);

    const result = await runCommand(updateJob, {
      actor: { tenantId: fx.tenantA.tenantId, userId: fx.tenantA.adminUserId },
      client: clientA,
      clock: fixedClock,
      input: { id: jobId, status: "in_progress" },
    });
    expect(result.ok).toBe(true);

    const row = await adminSelectJobRow(jobId);
    expect(row?.status).toBe("in_progress");

    // A lifecycle row is appended for the new status, timestamped by the INJECTED clock (H1).
    const eventsAfter = await adminSelectJobEventsForJob(jobId);
    expect(eventsAfter.length).toBe(eventsBefore.length + 1);
    const newest = eventsAfter[eventsAfter.length - 1];
    expect(newest.eventType).toBe("in_progress");
    expect(new Date(newest.occurredAt).toISOString()).toBe(fixedClock.now().toISOString());
  });

  it.skip("[P1] 7.3-INT-02: an empty patch (id only, no editable fields) short-circuits — no false TENANT_ACCESS_DENIED, no audit row", async () => {
    if (!stackUp) return skipUnlessStack();
    const jobId = await seedJob(fx.tenantA, clientA);
    const auditsBefore = await adminSelectAuditEvents({
      tenantId: fx.tenantA.tenantId,
      targetType: "job",
      targetId: jobId,
    });
    // The epic-3/epic-5 empty-patch guard: no editable field supplied ⇒ return target id unchanged.
    const result = await runCommand(updateJob, {
      actor: { tenantId: fx.tenantA.tenantId, userId: fx.tenantA.adminUserId },
      client: clientA,
      clock: fixedClock,
      input: { id: jobId },
    });
    expect(result.ok).toBe(true);
    const auditsAfter = await adminSelectAuditEvents({
      tenantId: fx.tenantA.tenantId,
      targetType: "job",
      targetId: jobId,
    });
    // No mutation ⇒ no audit row written for the no-op.
    expect(auditsAfter.filter((a) => a.eventType === "job.updated").length).toBe(
      auditsBefore.filter((a) => a.eventType === "job.updated").length,
    );
  });
});
