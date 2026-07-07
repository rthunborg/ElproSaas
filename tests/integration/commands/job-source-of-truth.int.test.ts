/**
 * Story 7.3 — 7.3-INT-01 (P1, AC1; R-708): the HEADLINE source-of-truth INT proof. The job/order
 * detail read (`readJobDetail`) surfaces the accepted price, source sent total, evidence, source
 * quote version, and customer/facility/contact from the IMMUTABLE `quote_acceptances` /
 * `quote_versions` references the 7.2 transaction wrote — it NEVER re-derives from the live
 * calc/settings/pricing/customer. A happy-path "the field exists" assertion is NOT this proof: the
 * discriminating test MUTATES an upstream mutable source AFTER job creation and asserts the job
 * detail read is UNCHANGED (the copy-by-value freeze — R-708 is the 7.3 analog of 6.2's R-616).
 *
 *   - 7.3-INT-01 (P1, AC1, R-708): create the acceptance + job via the REAL `mark_quote_version_sent`
 *     then `accept_quote_and_create_job` RPC chain (never a hand-inserted `jobs` row — the source
 *     refs must be authentic). Read the detail (baseline). Then RENAME the live customer + mutate a
 *     live upstream source the job does NOT reference by value. Re-read the detail and assert the
 *     accepted price / source sent total / evidence / the FROZEN commitment display names are
 *     UNCHANGED — proving the read comes from the immutable acceptance/version snapshot, not a live
 *     re-derive. (The `jobs.customer_id` join surfaces the CURRENT customer display name for the
 *     live-CRM link per the 7.2 retro-note; the FROZEN commitment names come from the version
 *     snapshot and must NOT move when the live customer is renamed.)
 *
 * Harness conventions mirror `capture-quote-acceptance.int.test.ts` + `accept-quote-and-create-job.
 * int.test.ts`: per-run unique ids (`crypto.randomUUID()`), raw pg readback via the BYPASSRLS admin
 * helpers (bigint öre → STRING → Number; timestamptz → Date — coerce on readback), runs against the
 * LOCAL Supabase stack ONLY + visibly skips per-test when unreachable. AFTER a `supabase db reset`
 * the runner polls `/auth/v1/health` to 200 before this DB-backed suite (the Kong→GoTrue 502
 * false-green trap — epic-5/6/8 retros). CI (`SUPABASE_TEST_REQUIRED=1`) hard-fails so this proof
 * is never silently skipped.
 *
 * The REAL sent fixture is produced by driving the LANDED Epic-6 `mark_quote_version_sent` RPC (no
 * synthetic `sent` row): seed a version `draft` → add children → flip to `sent`; the seed carries a
 * NON-ZERO frozen `source_sent_total_ore` (the 7.1 zero-frozen residual — the value the detail
 * displays). No PII/orgnr/personnummer in fixtures; every öre value < 10 digits (R-717).
 *
 * ── RED PHASE ─────────────────────────────────────────────────────────────────────────────────
 * `readJobDetail` (`src/features/jobs/read.ts`) does not exist yet. Every test is `.skip`. GREEN
 * PHASE: implement the read layer + command, then remove `.skip` and confirm the invariant holds.
 * These tests assert EXPECTED behavior — they FAIL (compile/import) until 7.3 lands.
 *
 * [Source: test-design-epic-7.md#7.3-INT-01, #Risk R-708/R-717, #Testing standards (7.3-INT-01 is
 *  the highest-value INT proof); story 7.3 AC1 + Task 1 (readJobDetail) + Testing section;
 *  src/features/quotes/read.ts (the "display the immutable ref, never recompute" discipline to
 *  mirror — 6.2's R-616 analog); tests/integration/commands/accept-quote-and-create-job.int.test.ts
 *  (the real RPC chain + fixture pattern); tests/factories/tenants.ts (adminSelectJobRow /
 *  adminSelectJobsForAcceptance — reuse the 7.2 helpers)]
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
import { runCommand } from "@/server/commands/envelope";
import { markQuoteVersionSent, acceptQuoteAndCreateJob } from "@/server/commands/quotes";
// RED PHASE: this module does not exist yet — the import FAILS until 7.3 Task 1 lands it.
import { readJobDetail } from "@/features/jobs/read";
import type { CommandClock } from "@/server/commands/clock";

const ACCEPTED_ISO = "2026-07-10T08:30:00.000Z"; // the EXPLICIT accepted moment (H1 determinism)
const fixedClock: CommandClock = { now: () => new Date("2026-07-10T09:00:00.000Z") };

/** The frozen source sent total (öre) the seeded sent version carries (< 10 digits — R-717). */
const SOURCE_SENT_TOTAL_ORE = 125_000;

describe("7.3-INT-01: job detail reads from IMMUTABLE acceptance/version refs, never re-derives (R-708)", () => {
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

  /**
   * Seed a REAL sent→accepted→job chain in tenant A and return the created job id + the seeded
   * customer id. Drives the landed RPCs — no synthetic `jobs`/`quote_acceptances` row.
   */
  async function seedAcceptedJob(): Promise<{ jobId: string; customerId: string; versionId: string }> {
    const customerId = await adminInsertCustomer({
      tenantId: fx.tenantA.tenantId,
      displayName: "Ursprungligt Kundnamn", // frozen into the version snapshot at send time
      customerType: "company",
    });
    const calcId = await adminInsertCalculation({ tenantId: fx.tenantA.tenantId });
    const quoteId = await adminInsertQuote({
      tenantId: fx.tenantA.tenantId,
      customerId,
      calculationId: calcId,
    });
    const versionId = await adminInsertQuoteVersion({
      tenantId: fx.tenantA.tenantId,
      quoteId,
      status: "draft",
      acceptedPriceOre: SOURCE_SENT_TOTAL_ORE,
    });
    // Flip draft → sent via the REAL command (freezes the snapshot the job later references).
    const sent = await runCommand(markQuoteVersionSent, {
      actor: { tenantId: fx.tenantA.tenantId, userId: fx.tenantA.adminUserId },
      client: clientA,
      clock: fixedClock,
      input: { id: versionId },
    });
    expect(sent.ok).toBe(true);
    // Accept + create the job atomically via the REAL 7.2 transaction.
    const accepted = await runCommand(acceptQuoteAndCreateJob, {
      actor: { tenantId: fx.tenantA.tenantId, userId: fx.tenantA.adminUserId },
      client: clientA,
      clock: fixedClock,
      input: {
        quoteVersionId: versionId,
        acceptedAt: ACCEPTED_ISO,
        acceptedPriceOre: SOURCE_SENT_TOTAL_ORE,
        channel: "verbal",
      },
    });
    expect(accepted.ok).toBe(true);
    const jobs = await adminSelectJobsForAcceptance(versionId);
    expect(jobs.length).toBe(1);
    return { jobId: jobs[0].id, customerId, versionId };
  }

  it.skip("[P1] 7.3-INT-01: the detail surfaces the accepted price + source sent total + frozen commitment names from the immutable refs (baseline)", async () => {
    if (!stackUp) return skipUnlessStack();
    const { jobId } = await seedAcceptedJob();
    const detail = await readJobDetail(clientA, jobId);
    expect(detail).not.toBeNull();
    // Money is DISPLAYED from the immutable quote_acceptances row, coerced to a JS number (öre).
    expect(detail!.acceptedPriceOre).toBe(SOURCE_SENT_TOTAL_ORE);
    expect(detail!.sourceSentTotalOre).toBe(SOURCE_SENT_TOTAL_ORE);
    // The frozen commitment customer display name comes from the version snapshot (not a live join).
    expect(detail!.commitmentCustomerName).toBe("Ursprungligt Kundnamn");
    // The source quote version + acceptance references are present (display-only, surfaced by ref).
    expect(detail!.quoteVersionId).toBeTruthy();
    expect(detail!.quoteAcceptanceId).toBeTruthy();
  });

  it.skip("[P1] 7.3-INT-01: renaming the LIVE customer after job creation leaves the FROZEN commitment name + accepted price UNCHANGED (the source-of-truth invariant)", async () => {
    if (!stackUp) return skipUnlessStack();
    const { jobId, customerId } = await seedAcceptedJob();
    const before = await readJobDetail(clientA, jobId);
    expect(before).not.toBeNull();

    // MUTATE an upstream mutable source the acceptance/version snapshot does NOT reference by value.
    await adminUpdateCustomerDisplayName(customerId, "OMDÖPT Kundnamn EFTER acceptans");

    const after = await readJobDetail(clientA, jobId);
    expect(after).not.toBeNull();
    // The FROZEN commitment name (from the version snapshot) must NOT move — the whole point of R-708.
    expect(after!.commitmentCustomerName).toBe(before!.commitmentCustomerName);
    expect(after!.commitmentCustomerName).toBe("Ursprungligt Kundnamn");
    // Money is copy-by-value from the immutable acceptance row — never re-derived from live sources.
    expect(after!.acceptedPriceOre).toBe(before!.acceptedPriceOre);
    expect(after!.sourceSentTotalOre).toBe(before!.sourceSentTotalOre);
    expect(after!.evidenceReference ?? null).toBe(before!.evidenceReference ?? null);
  });

  it.skip("[P1] 7.3-INT-01: the CURRENT-CRM customer link surfaces the live display name (the jobs.customer_id join is the live link, distinct from the frozen commitment name)", async () => {
    if (!stackUp) return skipUnlessStack();
    // Per the 7.2 retro-note, jobs.customer_id is the AUTHORITATIVE id for the live-CRM link; the
    // detail joins it for the current display name. This is the ONE value that SHOULD track a live
    // rename — proving the read distinguishes the live link from the frozen commitment snapshot.
    const { jobId, customerId } = await seedAcceptedJob();
    await adminUpdateCustomerDisplayName(customerId, "Nuvarande CRM-namn");
    const detail = await readJobDetail(clientA, jobId);
    expect(detail).not.toBeNull();
    expect(detail!.currentCustomerName).toBe("Nuvarande CRM-namn");
    // …but the frozen commitment name stays put (belt-and-suspenders on the previous assertion).
    expect(detail!.commitmentCustomerName).toBe("Ursprungligt Kundnamn");
  });
});
