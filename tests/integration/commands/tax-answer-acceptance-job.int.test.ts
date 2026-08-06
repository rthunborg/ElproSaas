/**
 * Story 10.6 acceptance -> job proof over the real command/RPC chain.
 *
 * The golden deliberately freezes category-rounded VAT at 5_001 ore for two
 * 10_001-ore lines (the former per-line sum would be 5_000), then changes the
 * mutable calculation after send. `acceptQuoteAndCreateJob` must still use the
 * frozen V2 payable as `source_sent_total_ore`, enforce the adjusted-price reason
 * gate, and expose the adjusted agreed amount on the job only through its
 * immutable acceptance/version references. A foreign tenant cannot reach either
 * the command execution or the underlying SECURITY INVOKER RPC.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import acceptanceGoldenJson from "../../fixtures/golden/acceptance/tax-answer-v2-acceptance-job.json";
import {
  adminInsertCalculation,
  adminInsertCustomer,
  adminInsertRow,
  adminInsertSection,
  cleanupFixture,
  createTwoTenantFixture,
  makeAuthedServerClient,
  type TestServerClient,
  type TwoTenantFixture,
} from "../../factories/tenants";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { readJobDetail, type JobReadClient } from "@/features/jobs/read";
import type { CommandClock } from "@/server/commands/clock";
import { runCommand } from "@/server/commands/envelope";
import {
  acceptQuoteAndCreateJob,
  markQuoteVersionSent,
} from "@/server/commands/quotes";

type QuoteLineGolden = {
  readonly rowType: "other";
  readonly sortOrder: number;
  readonly label: string;
  readonly quantity: number;
  readonly unit: string;
  readonly unitSellOre: number;
  readonly lineNetOre: number;
  readonly vatRateBp: number;
  readonly includedInInvoiceTotal: boolean;
  readonly deductionClassification: "NONE";
  readonly vatType: "STANDARD_VAT_25";
};

type ExpectedProjectionGolden = {
  readonly status: "accepted";
  readonly snapshotSchemaVersion: 2;
  readonly taxRuleVersion: string;
  readonly frozenNetOre: number;
  readonly frozenVatOre: number;
  readonly legacyPerLineVatOre: number;
  readonly frozenPayableOre: number;
  readonly quoteAcceptedPriceMirrorOre: number;
  readonly liveCalculationUnitSellOreAfterFreeze: number;
  readonly acceptanceAcceptedPriceOre: number;
  readonly acceptanceSourceSentTotalOre: number;
  readonly adjustmentDeltaOre: number;
  readonly jobAgreedAmountOre: number;
  readonly jobSourceSentTotalOre: number;
  readonly quoteAcceptanceRefMatches: true;
  readonly quoteVersionRefMatches: true;
};

type AcceptanceGolden = {
  readonly capturedAt: string;
  readonly commandAt: string;
  readonly acceptedAt: string;
  readonly calculationTaxInput: Readonly<Record<string, unknown>>;
  readonly quoteSnapshot: Record<string, unknown>;
  readonly quoteLines: readonly QuoteLineGolden[];
  readonly acceptance: {
    readonly adjustedPriceOre: number;
    readonly adjustmentReason: string;
    readonly channel: string;
    readonly jobTitle: string;
  };
  readonly sourceMutation: {
    readonly unitSellOre: number;
    readonly vatRateBp: number;
    readonly vatType: "ZERO_RATED";
  };
  readonly expectedProjection: ExpectedProjectionGolden;
};

const golden = acceptanceGoldenJson as unknown as AcceptanceGolden;
const fixedClock: CommandClock = { now: () => new Date(golden.commandAt) };

type SeededV2 = {
  readonly customerId: string;
  readonly calculationId: string;
  readonly mutableRowId: string;
  readonly quoteId: string;
  readonly versionId: string;
};

type FrozenVersionRow = {
  readonly status: string;
  readonly snapshot_schema_version: number;
  readonly tax_rule_version: string;
  readonly tax_answer_snapshot: Record<string, unknown>;
  readonly vat_total_ore: string | number;
  readonly accepted_price_ore: string | number;
  readonly payable_ore: string | number;
};

type AcceptanceRow = {
  readonly id: string;
  readonly quote_id: string;
  readonly quote_version_id: string;
  readonly accepted_price_ore: string | number;
  readonly source_sent_total_ore: string | number;
  readonly adjustment_reason: string | null;
};

type JobRow = {
  readonly id: string;
  readonly quote_acceptance_id: string;
  readonly quote_version_id: string;
  readonly customer_id: string;
};

function ore(value: string | number | unknown): number {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new Error(`Expected a non-negative integer ore value, received ${String(value)}`);
  }
  return normalized;
}

async function seedSentV2(
  tenantId: string,
  client: TestServerClient,
  label: string,
): Promise<SeededV2> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenantId,
    customer_type: "company",
    display_name: `synthetic-v2-${label}`,
  });
  const calculationId = await adminInsertCalculation({
    tenant_id: tenantId,
    customer_id: customerId,
    title: `synthetic-v2-calculation-${label}`,
    tax_input_snapshot: golden.calculationTaxInput,
  });
  const sectionId = await adminInsertSection({
    tenant_id: tenantId,
    calculation_id: calculationId,
    title: "Synthetic acceptance source",
  });

  const sourceRows: string[] = [];
  for (const line of golden.quoteLines) {
    sourceRows.push(
      await adminInsertRow({
        tenant_id: tenantId,
        section_id: sectionId,
        row_type: line.rowType,
        quantity: line.quantity,
        unit: line.unit,
        unit_sell_ore: line.unitSellOre,
        vat_rate_bp: line.vatRateBp,
        included_in_invoice_total: line.includedInInvoiceTotal,
        deduction_classification: line.deductionClassification,
        vat_type: line.vatType,
        label: line.label,
        sort_order: line.sortOrder,
      }),
    );
  }
  expect(sourceRows).toHaveLength(2);

  const { data, error } = await client.rpc("create_quote_version_from_calculation", {
    p_tenant_id: tenantId,
    p_calculation_id: calculationId,
    p_captured_at: golden.capturedAt,
    p_customer_id: customerId,
    p_facility_id: null,
    p_contact_id: null,
    p_snapshot: golden.quoteSnapshot,
    p_lines: golden.quoteLines,
    p_attachments: [],
  });
  if (error) {
    throw new Error(`seedSentV2: V2 quote RPC failed (${error.code} ${error.message})`);
  }
  const created = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!created?.quote_id || !created.quote_version_id) {
    throw new Error("seedSentV2: V2 quote RPC returned no ids");
  }
  const quoteId = String(created.quote_id);
  const versionId = String(created.quote_version_id);

  const sent = await runCommand(markQuoteVersionSent, {
    client: client as never,
    input: { quote_version_id: versionId },
    clock: fixedClock,
    correlationId: crypto.randomUUID(),
  });
  if (!sent.ok) {
    throw new Error(`seedSentV2: mark sent failed (${sent.code})`);
  }

  return {
    customerId,
    calculationId,
    mutableRowId: sourceRows[0]!,
    quoteId,
    versionId,
  };
}

function adjustedAcceptanceInput(versionId: string, includeReason: boolean) {
  return {
    quote_version_id: versionId,
    accepted_at: golden.acceptedAt,
    accepted_price_ore: golden.acceptance.adjustedPriceOre,
    channel: golden.acceptance.channel,
    title: golden.acceptance.jobTitle,
    ...(includeReason
      ? { adjustment_reason: golden.acceptance.adjustmentReason }
      : {}),
  };
}

let stackUp = false;
let fixture: TwoTenantFixture;
let clientA: TestServerClient;
let clientB: TestServerClient;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  [clientA, clientB] = await Promise.all([
    makeAuthedServerClient(fixture.adminA),
    makeAuthedServerClient(fixture.adminB),
  ]);
});

afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
});

describe("Story 10.6 V2 acceptance -> job frozen-payable boundary", () => {
  it("[10.6-INT-10][P0] consumes frozen category-rounded payable, gates an adjustment, and pins the job's agreed amount/source refs without tax recomputation", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const seeded = await seedSentV2(fixture.tenantA.id, clientA, "tenant-a");

    // Move a live calculation price/type after the quote was sent. This is the
    // discriminating no-recompute fact: acceptance must keep using V2 payable.
    await adminQuery(
      `update public.calculation_rows
          set unit_sell_ore = $2, vat_rate_bp = $3, vat_type = $4
        where id = $1`,
      [
        seeded.mutableRowId,
        golden.sourceMutation.unitSellOre,
        golden.sourceMutation.vatRateBp,
        golden.sourceMutation.vatType,
      ],
    );
    const liveRows = await adminQuery<{
      unit_sell_ore: string | number;
      vat_rate_bp: number;
      vat_type: string;
    }>(
      `select unit_sell_ore, vat_rate_bp, vat_type
         from public.calculation_rows where id = $1`,
      [seeded.mutableRowId],
    );
    expect(ore(liveRows[0]?.unit_sell_ore)).toBe(golden.sourceMutation.unitSellOre);
    expect(liveRows[0]?.vat_rate_bp).toBe(golden.sourceMutation.vatRateBp);
    expect(liveRows[0]?.vat_type).toBe(golden.sourceMutation.vatType);

    // Adjusted acceptance is rejected without a reason/evidence and writes nothing.
    const missingReason = await runCommand(acceptQuoteAndCreateJob, {
      client: clientA as never,
      input: adjustedAcceptanceInput(seeded.versionId, false),
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(missingReason.ok).toBe(false);
    if (!missingReason.ok) expect(missingReason.code).toBe("VALIDATION_FAILED");
    const afterGate = await adminQuery<{
      acceptance_count: string;
      job_count: string;
      status: string;
    }>(
      `select
         (select count(*)::text from public.quote_acceptances
           where quote_version_id = qv.id) as acceptance_count,
         (select count(*)::text from public.jobs
           where quote_version_id = qv.id) as job_count,
         qv.status
       from public.quote_versions qv where qv.id = $1`,
      [seeded.versionId],
    );
    expect(afterGate[0]).toEqual({
      acceptance_count: "0",
      job_count: "0",
      status: "sent",
    });

    // The reason-backed call traverses the real command and atomic
    // accept_quote_and_create_job RPC.
    const accepted = await runCommand(acceptQuoteAndCreateJob, {
      client: clientA as never,
      input: adjustedAcceptanceInput(seeded.versionId, true),
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;

    const versions = await adminQuery<FrozenVersionRow>(
      `select status, snapshot_schema_version, tax_rule_version,
              tax_answer_snapshot, vat_total_ore, accepted_price_ore, payable_ore
         from public.quote_versions where id = $1`,
      [seeded.versionId],
    );
    const acceptances = await adminQuery<AcceptanceRow>(
      `select id, quote_id, quote_version_id, accepted_price_ore,
              source_sent_total_ore, adjustment_reason
         from public.quote_acceptances where id = $1`,
      [accepted.data.acceptanceId],
    );
    const jobs = await adminQuery<JobRow>(
      `select id, quote_acceptance_id, quote_version_id, customer_id
         from public.jobs where id = $1`,
      [accepted.data.jobId],
    );
    expect(versions).toHaveLength(1);
    expect(acceptances).toHaveLength(1);
    expect(jobs).toHaveLength(1);
    const version = versions[0]!;
    const acceptance = acceptances[0]!;
    const job = jobs[0]!;

    expect(acceptance.quote_id).toBe(seeded.quoteId);
    expect(acceptance.adjustment_reason).toBe(golden.acceptance.adjustmentReason);
    expect(job.customer_id).toBe(seeded.customerId);

    const detail = await readJobDetail(
      clientA as unknown as JobReadClient,
      accepted.data.jobId,
    );
    expect(detail).not.toBeNull();

    // Golden projection: dynamic UUIDs collapse to explicit ref-match booleans.
    const observedProjection = {
      status: version.status,
      snapshotSchemaVersion: version.snapshot_schema_version,
      taxRuleVersion: version.tax_rule_version,
      frozenNetOre: ore(version.tax_answer_snapshot.netOre),
      frozenVatOre: ore(version.vat_total_ore),
      legacyPerLineVatOre: golden.quoteLines.reduce(
        (sum, line) => sum + Math.round((line.lineNetOre * line.vatRateBp) / 10_000),
        0,
      ),
      frozenPayableOre: ore(version.payable_ore),
      quoteAcceptedPriceMirrorOre: ore(version.accepted_price_ore),
      liveCalculationUnitSellOreAfterFreeze: ore(liveRows[0]?.unit_sell_ore),
      acceptanceAcceptedPriceOre: ore(acceptance.accepted_price_ore),
      acceptanceSourceSentTotalOre: ore(acceptance.source_sent_total_ore),
      adjustmentDeltaOre:
        ore(acceptance.accepted_price_ore) - ore(acceptance.source_sent_total_ore),
      jobAgreedAmountOre: detail!.acceptedPriceOre,
      jobSourceSentTotalOre: detail!.sourceSentTotalOre,
      quoteAcceptanceRefMatches:
        job.quote_acceptance_id === accepted.data.acceptanceId &&
        detail!.quoteAcceptanceId === accepted.data.acceptanceId,
      quoteVersionRefMatches:
        job.quote_version_id === seeded.versionId &&
        detail!.quoteVersionId === seeded.versionId,
    };
    expect(observedProjection).toEqual(golden.expectedProjection);
    expect(observedProjection.frozenVatOre).not.toBe(
      observedProjection.legacyPerLineVatOre,
    );

    // V2 quote tax facts, acceptance money, and job source refs all stay frozen.
    await expect(
      adminQuery(
        `update public.quote_versions set payable_ore = payable_ore + 1 where id = $1`,
        [seeded.versionId],
      ),
    ).rejects.toMatchObject({ code: "QV409" });
    for (const field of ["accepted_price_ore", "source_sent_total_ore"] as const) {
      await expect(
        adminQuery(
          `update public.quote_acceptances set ${field} = ${field} + 1 where id = $1`,
          [accepted.data.acceptanceId],
        ),
      ).rejects.toMatchObject({ code: "AR704" });
    }
    for (const field of ["quote_acceptance_id", "quote_version_id"] as const) {
      await expect(
        adminQuery(`update public.jobs set ${field} = $2 where id = $1`, [
          accepted.data.jobId,
          crypto.randomUUID(),
        ]),
      ).rejects.toMatchObject({ code: "AR704" });
    }

    const immutableAcceptance = await adminQuery<AcceptanceRow>(
      `select id, quote_id, quote_version_id, accepted_price_ore,
              source_sent_total_ore, adjustment_reason
         from public.quote_acceptances where id = $1`,
      [accepted.data.acceptanceId],
    );
    const immutableJob = await adminQuery<JobRow>(
      `select id, quote_acceptance_id, quote_version_id, customer_id
         from public.jobs where id = $1`,
      [accepted.data.jobId],
    );
    expect(immutableAcceptance[0]).toEqual(acceptance);
    expect(immutableJob[0]).toEqual(job);
  });

  it("[10.6-INT-11][P0] denies a concrete foreign V2 version at both the command boundary and the SECURITY INVOKER RPC", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const foreign = await seedSentV2(fixture.tenantB.id, clientB, "tenant-b");

    const commandResult = await runCommand(acceptQuoteAndCreateJob, {
      client: clientA as never,
      input: adjustedAcceptanceInput(foreign.versionId, true),
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(commandResult.ok).toBe(false);
    if (!commandResult.ok) {
      expect(commandResult.code).toBe("TENANT_ACCESS_DENIED");
      expect(commandResult.message).not.toMatch(/tenant b|foreign|exists/i);
    }

    // Bypass the envelope deliberately and try the same concrete Tenant-B id as
    // Tenant A. SECURITY INVOKER + RLS must still make the row unreachable.
    const directRpc = await clientA.rpc("accept_quote_and_create_job", {
      p_tenant_id: fixture.tenantB.id,
      p_quote_version_id: foreign.versionId,
      p_accepted_at: golden.acceptedAt,
      p_accepted_price_ore: golden.acceptance.adjustedPriceOre,
      p_source_sent_total_ore: golden.expectedProjection.frozenPayableOre,
      p_channel: golden.acceptance.channel,
      p_adjustment_reason: golden.acceptance.adjustmentReason,
      p_evidence_file_id: null,
      p_evidence_reference: null,
      p_notes: null,
      p_planned_start_date: null,
      p_planned_end_date: null,
      p_title: golden.acceptance.jobTitle,
      p_fault_inject: null,
    });
    expect(directRpc.data).toBeNull();
    expect(directRpc.error?.code).toBe("QV409");

    const untouched = await adminQuery<{
      status: string;
      acceptance_count: string;
      job_count: string;
    }>(
      `select qv.status,
         (select count(*)::text from public.quote_acceptances qa
           where qa.quote_version_id = qv.id) as acceptance_count,
         (select count(*)::text from public.jobs j
           where j.quote_version_id = qv.id) as job_count
       from public.quote_versions qv where qv.id = $1`,
      [foreign.versionId],
    );
    expect(untouched[0]).toEqual({
      status: "sent",
      acceptance_count: "0",
      job_count: "0",
    });
  });
});
