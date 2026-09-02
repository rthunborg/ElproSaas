/**
 * Story 7.3 — 7.3-INT-01 (P1, AC1; R-708): the HEADLINE source-of-truth INT proof. The job/order
 * detail read (`readJobDetail`) surfaces the accepted price, source sent total, evidence, source
 * quote version, and the FROZEN commitment customer name from the IMMUTABLE `quote_acceptances` /
 * `quote_versions` references the 7.2 transaction wrote — it NEVER re-derives from the live
 * calc/settings/pricing/customer. A happy-path "the field exists" assertion is NOT this proof: the
 * discriminating test MUTATES an upstream mutable source AFTER job creation and asserts the FROZEN
 * commitment name + money are UNCHANGED (the copy-by-value freeze — R-708 is the 7.3 analog of
 * 6.2's R-616), while the live-CRM link (jobs.customer_id join) DOES track the rename.
 *
 * The REAL sent fixture is produced by driving the LANDED Epic-6 `mark_quote_version_sent` command
 * (no synthetic `sent` row): seed a version `draft` (carrying a NON-ZERO frozen `accepted_price_ore`
 * = the source sent total, and the FROZEN `customer_display_name`) → flip to `sent` via the real
 * command, then the REAL 7.2 `acceptQuoteAndCreateJob` command to produce the acceptance + job (never
 * a hand-inserted `jobs` row — the source refs must be authentic). No PII/orgnr/personnummer in
 * fixtures; every öre value < 10 digits (R-717).
 *
 * Harness conventions mirror `accept-quote-and-create-job.int.test.ts`: per-run unique ids, raw pg
 * readback via the BYPASSRLS admin helpers, runs against the LOCAL Supabase stack ONLY + visibly
 * skips per-test when unreachable (`skipUnlessStack`). CI (`SUPABASE_TEST_REQUIRED=1`) hard-fails.
 *
 * [Source: test-design-epic-7.md#7.3-INT-01, #Risk R-708/R-717; story 7.3 AC1 + Task 1 (readJobDetail)
 *  + Testing; src/features/quotes/read.ts (the "display the immutable ref, never recompute"
 *  discipline); tests/integration/commands/accept-quote-and-create-job.int.test.ts (the real chain)]
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminInsertCalculation,
  adminInsertQuote,
  adminInsertQuoteVersion,
  adminUpdateCustomerDisplayName,
  adminSelectJobsForAcceptance,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { establishCurrentQuotePdf } from "../../support/quote-pdf";
import { runCommand } from "@/server/commands/envelope";
import {
  markQuoteVersionSent,
  acceptQuoteAndCreateJob,
} from "@/server/commands/quotes";
import { readJobDetail, type JobReadClient } from "@/features/jobs/read";
import type { CommandClock } from "@/server/commands/clock";

const ACCEPTED_ISO = "2026-07-10T08:30:00.000Z"; // the EXPLICIT accepted moment (H1 determinism)
const FIXED_ISO = "2026-07-10T09:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

/** The frozen source sent total (öre) the seeded sent version carries (< 10 digits — R-717). */
const SOURCE_SENT_TOTAL_ORE = 125_000;
/** The frozen commitment customer display name captured onto the version snapshot at send time. */
const FROZEN_COMMITMENT_NAME = "Ursprungligt Kundnamn";

describe("7.3-INT-01: job detail reads from IMMUTABLE acceptance/version refs, never re-derives (R-708)", () => {
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
   * Seed a REAL sent→accepted→job chain in tenant A and return the created job id + the seeded
   * customer id. Drives the landed commands — no synthetic `jobs`/`quote_acceptances` row.
   */
  async function seedAcceptedJob(): Promise<{
    jobId: string;
    acceptanceId: string;
    customerId: string;
    versionId: string;
  }> {
    const customerId = await adminInsertCustomer({
      tenant_id: fx.tenantA.id,
      display_name: FROZEN_COMMITMENT_NAME,
      customer_type: "company",
      org_nr: "556000-0001",
    });
    const calcId = await adminInsertCalculation({
      tenant_id: fx.tenantA.id,
      customer_id: customerId,
    });
    const quoteId = await adminInsertQuote({
      tenant_id: fx.tenantA.id,
      customer_id: customerId,
    });
    const versionId = await adminInsertQuoteVersion({
      tenant_id: fx.tenantA.id,
      quote_id: quoteId,
      calculation_id: calcId,
      status: "draft",
      // The FROZEN commitment display name captured at send time (the version snapshot's copy).
      customer_display_name: FROZEN_COMMITMENT_NAME,
      accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
    });
    // Flip draft → sent via the REAL command (freezes the snapshot the job later references).
    await establishCurrentQuotePdf({
      client: clientA,
      tenantId: fx.tenantA.id,
      quoteVersionId: versionId,
      actorUserId: fx.adminA.id,
      occurredAt: FIXED_ISO,
    });
    const sent = await runCommand(markQuoteVersionSent, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { quote_version_id: versionId },
    });
    expect(sent.ok).toBe(true);
    // Accept + create the job atomically via the REAL 7.2 transaction.
    const accepted = await runCommand(acceptQuoteAndCreateJob, {
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
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new Error("seedAcceptedJob: accept failed");
    const jobs = await adminSelectJobsForAcceptance(accepted.data.acceptanceId);
    expect(jobs.length).toBe(1);
    return {
      jobId: String(jobs[0]?.id),
      acceptanceId: accepted.data.acceptanceId,
      customerId,
      versionId,
    };
  }

  it("[P1] 7.3-INT-01: the detail surfaces the accepted price + source sent total + frozen commitment name from the immutable refs (baseline)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { jobId } = await seedAcceptedJob();
    const detail = await readJobDetail(clientA as unknown as JobReadClient, jobId);
    expect(detail).not.toBeNull();
    // Money is DISPLAYED from the immutable quote_acceptances row, coerced to a JS number (öre).
    expect(detail!.acceptedPriceOre).toBe(SOURCE_SENT_TOTAL_ORE);
    expect(detail!.sourceSentTotalOre).toBe(SOURCE_SENT_TOTAL_ORE);
    // The frozen commitment customer display name comes from the version snapshot (not a live join).
    expect(detail!.commitmentCustomerName).toBe(FROZEN_COMMITMENT_NAME);
    // The source quote version + acceptance references are present (display-only, surfaced by ref).
    expect(detail!.quoteVersionId).toBeTruthy();
    expect(detail!.quoteAcceptanceId).toBeTruthy();
  });

  it("[P1] 7.3-INT-01: renaming the LIVE customer after job creation leaves the FROZEN commitment name + accepted price UNCHANGED (the source-of-truth invariant)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { jobId, customerId } = await seedAcceptedJob();
    const before = await readJobDetail(clientA as unknown as JobReadClient, jobId);
    expect(before).not.toBeNull();

    // MUTATE an upstream mutable source the acceptance/version snapshot does NOT reference by value.
    await adminUpdateCustomerDisplayName(customerId, "OMDÖPT Kundnamn EFTER acceptans");

    const after = await readJobDetail(clientA as unknown as JobReadClient, jobId);
    expect(after).not.toBeNull();
    // The FROZEN commitment name (from the version snapshot) must NOT move — the whole point of R-708.
    expect(after!.commitmentCustomerName).toBe(before!.commitmentCustomerName);
    expect(after!.commitmentCustomerName).toBe(FROZEN_COMMITMENT_NAME);
    // Money is copy-by-value from the immutable acceptance row — never re-derived from live sources.
    expect(after!.acceptedPriceOre).toBe(before!.acceptedPriceOre);
    expect(after!.sourceSentTotalOre).toBe(before!.sourceSentTotalOre);
    expect(after!.evidenceReference ?? null).toBe(before!.evidenceReference ?? null);
  });

  it("[P1] 7.3-INT-01: the CURRENT-CRM customer link surfaces the live display name (the jobs.customer_id join is the live link, distinct from the frozen commitment name)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Per the 7.2 retro-note, jobs.customer_id is the AUTHORITATIVE id for the live-CRM link; the
    // detail joins it for the current display name. This is the ONE value that SHOULD track a live
    // rename — proving the read distinguishes the live link from the frozen commitment snapshot.
    const { jobId, customerId } = await seedAcceptedJob();
    await adminUpdateCustomerDisplayName(customerId, "Nuvarande CRM-namn");
    const detail = await readJobDetail(clientA as unknown as JobReadClient, jobId);
    expect(detail).not.toBeNull();
    expect(detail!.currentCustomerName).toBe("Nuvarande CRM-namn");
    // …but the frozen commitment name stays put (belt-and-suspenders on the previous assertion).
    expect(detail!.commitmentCustomerName).toBe(FROZEN_COMMITMENT_NAME);
  });

  it("[P1] AC3: readJobDetail for a FOREIGN-tenant job id returns null (RLS invisible — no existence leak)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Seed a job in tenant B; read it AS tenant A → RLS narrows it to zero rows → null (not-found).
    const clientB = await makeAuthedServerClient(fx.adminB);
    const customerId = await adminInsertCustomer({
      tenant_id: fx.tenantB.id,
      display_name: "Tenant B kund",
      customer_type: "company",
      org_nr: "556000-0002",
    });
    const calcId = await adminInsertCalculation({
      tenant_id: fx.tenantB.id,
      customer_id: customerId,
    });
    const quoteId = await adminInsertQuote({
      tenant_id: fx.tenantB.id,
      customer_id: customerId,
    });
    const versionId = await adminInsertQuoteVersion({
      tenant_id: fx.tenantB.id,
      quote_id: quoteId,
      calculation_id: calcId,
      status: "draft",
      customer_display_name: "Tenant B kund",
      accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
    });
    await establishCurrentQuotePdf({
      client: clientB,
      tenantId: fx.tenantB.id,
      quoteVersionId: versionId,
      actorUserId: fx.adminB.id,
      occurredAt: FIXED_ISO,
    });
    const sent = await runCommand(markQuoteVersionSent, {
      client: clientB as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { quote_version_id: versionId },
    });
    expect(sent.ok).toBe(true);
    const accepted = await runCommand(acceptQuoteAndCreateJob, {
      client: clientB as never,
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
    if (!accepted.ok) return;
    const foreignJobId = String(
      (await adminSelectJobsForAcceptance(accepted.data.acceptanceId))[0]?.id,
    );
    // Read AS tenant A — RLS-invisible → null, never a cross-tenant existence disclosure.
    const detail = await readJobDetail(clientA as unknown as JobReadClient, foreignJobId);
    expect(detail).toBeNull();
  });
});
