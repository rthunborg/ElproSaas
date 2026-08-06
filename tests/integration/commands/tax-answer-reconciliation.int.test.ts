/**
 * Story 10.6 integration coverage. Source checks pin the one-migration/no-table
 * contract; DB-backed cases exercise the actual JSON constraints, both creation
 * RPCs, freeze transition, OLD+NEW child locking, concurrency serialization and
 * acceptance source-of-truth against the local Supabase stack.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
import { adminQuery, adminSession } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

const ROOT = process.cwd();
const CAPTURED_AT = "2026-08-05T12:00:00.000Z";
const POLICY_ID = "SE-TAX-2026-v1";
const CLASSIFICATIONS = [
  "NONE",
  "ROT_LABOR",
  "GREEN_SOLAR_LABOR",
  "GREEN_SOLAR_MATERIAL",
  "GREEN_STORAGE_LABOR",
  "GREEN_STORAGE_MATERIAL",
  "GREEN_CHARGING_LABOR",
  "GREEN_CHARGING_MATERIAL",
] as const;

let stackUp = false;
let fixture: TwoTenantFixture;
let client: TestServerClient;
let customerId: string;
let calculationId: string;
let sectionId: string;

function readRepoFile(relativePath: string): string {
  const path = resolve(ROOT, relativePath);
  expect(existsSync(path), `${relativePath} must exist`).toBe(true);
  return readFileSync(path, "utf8");
}

function storyMigration(): string {
  const directory = resolve(ROOT, "supabase/migrations");
  const matches = readdirSync(directory)
    .filter((name) => /tax_answer_reconciliation|tax-answer-reconciliation/i.test(name))
    .sort();
  expect(matches, "Story 10.6 requires exactly one forward-only additive migration").toHaveLength(1);
  return readFileSync(resolve(directory, matches[0]!), "utf8");
}

function expectAll(source: string, tokens: readonly string[], context: string): void {
  for (const token of tokens) {
    expect(source, `${context} must carry ${token}`).toContain(token);
  }
}

function zeroClassifications(): Record<(typeof CLASSIFICATIONS)[number], number> {
  return Object.fromEntries(CLASSIFICATIONS.map((key) => [key, 0])) as Record<
    (typeof CLASSIFICATIONS)[number],
    number
  >;
}

function frozenPolicyValues(): Record<string, unknown> {
  return {
    vat: { standardRateBp: 2500 },
    rot: {
      rateBp: 3000,
      maxPerPersonYearOre: 5_000_000,
      combinedRotRutMaxPerPersonYearOre: 7_500_000,
    },
    green: {
      rateBpByCategory: { SOLAR: 1500, STORAGE: 5000, CHARGING: 5000 },
      maxPerPersonYearOre: 5_000_000,
      defaultBasisMethod: "ACTUAL_ELIGIBLE_COSTS",
      fixedPriceEligibleShareBp: 9700,
    },
  };
}

function validTaxInput(): Record<string, unknown> {
  return {
    schemaVersion: 2,
    documentVatType: "STANDARD_VAT_25",
    buyerVatNumber: null,
    deductionChoice: "NONE",
    paymentDate: null,
    finalPaymentDate: null,
    personAllowanceSlots: [],
    greenBasisMethod: "ACTUAL_ELIGIBLE_COSTS",
    genuineFixedPrice: false,
    fixedPriceOre: null,
    fixedPriceCategorySplitOre: null,
  };
}

async function setCalculationTaxInput(value: Record<string, unknown> = validTaxInput()): Promise<void> {
  await adminQuery(
    `update public.calculations set tax_input_snapshot = $2::jsonb where id = $1`,
    [calculationId, JSON.stringify(value)],
  );
}

function validTaxAnswer(): Record<string, unknown> {
  return {
    schemaVersion: 2,
    taxRuleVersions: [POLICY_ID],
    vatPolicy: {
      id: POLICY_ID,
      validFrom: "2026-01-01",
      validTo: null,
      resolvingDate: "2026-08-05",
      resolvingFact: "QUOTE_CAPTURE_DATE",
      values: frozenPolicyValues(),
    },
    documentVatType: "STANDARD_VAT_25",
    buyerVatNumber: null,
    reverseChargeApplied: false,
    deductionChoice: "NONE",
    categories: [
      {
        vatType: "STANDARD_VAT_25",
        rateBp: 2500,
        netOre: 10_000,
        vatOre: 2_500,
        grossOre: 12_500,
      },
    ],
    netByDeductionClassification: { ...zeroClassifications(), NONE: 10_000 },
    vatByDeductionClassification: { ...zeroClassifications(), NONE: 2_500 },
    summaries: {
      labor: { netOre: 10_000, vatOre: 2_500, grossOre: 12_500 },
      material: { netOre: 0, vatOre: 0, grossOre: 0 },
      other: { netOre: 0, vatOre: 0, grossOre: 0 },
    },
    rot: {
      policy: null,
      basisNetOre: 0,
      allocatedVatOre: 0,
      basisOre: 0,
      calculatedOre: 0,
      claimOre: 0,
      allocations: [],
    },
    green: {
      policy: null,
      basisMethod: "ACTUAL_ELIGIBLE_COSTS",
      categories: {
        SOLAR: { category: "SOLAR", basisOre: 0, calculatedOre: 0, claimOre: 0 },
        STORAGE: { category: "STORAGE", basisOre: 0, calculatedOre: 0, claimOre: 0 },
        CHARGING: { category: "CHARGING", basisOre: 0, calculatedOre: 0, claimOre: 0 },
      },
      calculatedOre: 0,
      claimOre: 0,
      allocations: [],
    },
    netOre: 10_000,
    vatOre: 2_500,
    grossOre: 12_500,
    calculatedDeductionOre: 0,
    claimDeductionOre: 0,
    deductionOre: 0,
    payableOre: 12_500,
  };
}

function validSnapshot(): Record<string, unknown> {
  return {
    companyName: "Elpro Test AB",
    companyOrgNr: "556000-1234",
    companyAddressLine1: null,
    companyAddressLine2: null,
    companyPostalCode: null,
    companyCity: null,
    companyEmail: null,
    companyPhone: null,
    companyLogoUrl: null,
    customerDisplayName: "Taxkund",
    customerType: "private",
    facilityName: null,
    contactName: null,
    quoteNumberDisplay: null,
    validUntil: null,
    introText: null,
    customerNotes: null,
    termsText: null,
    termsApprovedAt: null,
    termsApprovedBy: null,
    baseTotalOre: 10_000,
    optionTotalOre: 0,
    vatTotalOre: 2_500,
    deductionTotalOre: 0,
    acceptedPriceOre: 12_500,
    snapshotSchemaVersion: 2,
    taxRuleVersion: POLICY_ID,
    taxAnswerSnapshot: validTaxAnswer(),
    buyerVatNumber: null,
    calculatedDeductionOre: 0,
    claimDeductionOre: 0,
    payableOre: 12_500,
    vatRateBp: 2500,
    vatDisplay: "company_togglable",
    deductionType: null,
    deductionRateBp: null,
    deductionCapOre: null,
    deductionPersons: null,
    requiresSignOff: true,
    displayMode: "detailed",
    warnings: [],
  };
}

function validLine(): Record<string, unknown> {
  return {
    rowType: "labor",
    sortOrder: 0,
    label: "Arbete",
    description: null,
    quoteNote: null,
    quantity: 1,
    unit: "st",
    unitSellOre: 10_000,
    lineNetOre: 10_000,
    vatRateBp: 2500,
    includedInInvoiceTotal: true,
    deductionClassification: "NONE",
    vatType: "STANDARD_VAT_25",
    isHidden: false,
    isOptional: false,
    isSelected: null,
  };
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

async function createFreshV2(): Promise<{
  quoteId: string;
  versionId: string;
}> {
  await setCalculationTaxInput();
  const { data, error } = await client.rpc("create_quote_version_from_calculation", {
    p_tenant_id: fixture.tenantA.id,
    p_calculation_id: calculationId,
    p_captured_at: CAPTURED_AT,
    p_customer_id: customerId,
    p_facility_id: null,
    p_contact_id: null,
    p_snapshot: validSnapshot(),
    p_lines: [validLine()],
    p_attachments: [],
  });
  if (error) throw new Error(`valid V2 RPC failed: ${error.code} ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") throw new Error("valid V2 RPC returned no row");
  return {
    quoteId: String((row as Record<string, unknown>).quote_id),
    versionId: String((row as Record<string, unknown>).quote_version_id),
  };
}

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  client = await makeAuthedServerClient(fixture.adminA);
  customerId = await adminInsertCustomer({
    tenant_id: fixture.tenantA.id,
    customer_type: "private",
    display_name: "Story 10.6 customer",
  });
  calculationId = await adminInsertCalculation({
    tenant_id: fixture.tenantA.id,
    customer_id: customerId,
    title: "Story 10.6 calculation",
  });
  sectionId = await adminInsertSection({
    tenant_id: fixture.tenantA.id,
    calculation_id: calculationId,
    title: "Story 10.6 tax rows",
  });
  await setCalculationTaxInput();
});

afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
});

describe("Story 10.6 — migration source contract", () => {
  it("[10.6-INT-01][P0] remains one additive migration and both RPCs share the V2 assertion", () => {
    const migration = storyMigration();
    expectAll(
      migration,
      [
        "included_in_invoice_total",
        "deduction_classification",
        "vat_type",
        "ROT_AND_GREEN",
        "is_story_10_6_tax_answer_v2",
        "is_story_10_6_quote_lines_reconciled",
        "is_story_10_6_tax_answer_matches_input",
        "calculation_rows_classification_matches_row_type_check",
        "quote_version_lines_classification_matches_row_type_check",
        "assert_story_10_6_fresh_quote_v2",
        "create_quote_version_from_calculation",
        "create_new_quote_version",
      ],
      "Story 10.6 migration",
    );
    expect(migration.match(/create\s+table/gi) ?? [], "reconciliation adds no tenant table").toHaveLength(0);
    expect(migration.match(/perform\s+public\.assert_story_10_6_fresh_quote_v2/gi) ?? []).toHaveLength(2);
  });

  it("[10.6-INT-02][P0] lock source pins transition-only freeze and OLD+NEW serialized child parents", () => {
    const migration = storyMigration();
    expectAll(
      migration,
      [
        "to_jsonb(new) - array['status', 'updated_at']",
        "only a complete reconciled Story 10.6 V2 quote version may be sent",
        "quote_versions draft updates are limited to presentation and derived PDF state",
        "V2 quote-version child snapshots are immutable after creation",
        "v_old_parent_id",
        "v_new_parent_id",
        "order by qv.id",
        "for update",
        "enforce_quote_acceptance_frozen_source_total",
      ],
      "sent/child/acceptance locks",
    );
  });

  it("[10.6-INT-03][P0] application read/write/PDF paths carry the reconciled fields", () => {
    const source = [
      readRepoFile("src/server/commands/calculations/rows.ts"),
      readRepoFile("src/server/commands/calculations/validation.ts"),
      readRepoFile("src/server/commands/quotes/snapshot-build.ts"),
      readRepoFile("src/lib/quote-pdf/view-model.ts"),
    ].join("\n");
    expectAll(
      source,
      [
        "included_in_invoice_total",
        "deduction_classification",
        "vat_type",
        "taxAnswerSnapshot",
        "payableOre",
        "REVERSE_CHARGE_CONSTRUCTION",
      ],
      "application reconciliation paths",
    );
  });
});

describe("Story 10.6 — local Supabase behavior", () => {
  it("[10.6-INT-04][P0] calculation JSON rejects JSON null/invalid enums and accepts typed ROT+green", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    await expect(
      adminQuery(
        `update public.calculations set tax_input_snapshot = 'null'::jsonb where id = $1`,
        [calculationId],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    const invalid = {
      schemaVersion: 2,
      documentVatType: null,
      buyerVatNumber: null,
      deductionChoice: "NONE",
      paymentDate: null,
      finalPaymentDate: null,
      personAllowanceSlots: [],
      greenBasisMethod: "ACTUAL_ELIGIBLE_COSTS",
      genuineFixedPrice: false,
      fixedPriceOre: null,
      fixedPriceCategorySplitOre: null,
    };
    await expect(
      adminQuery(
        `update public.calculations set tax_input_snapshot = $2::jsonb where id = $1`,
        [calculationId, JSON.stringify(invalid)],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    // Incomplete reverse-charge selection is valid DRAFT state: readiness must be
    // able to show MISSING_BUYER_VAT_NUMBER. Final quote validation remains strict.
    await expect(
      adminQuery(
        `update public.calculations set tax_input_snapshot = $2::jsonb where id = $1`,
        [
          calculationId,
          JSON.stringify({
            ...invalid,
            documentVatType: "REVERSE_CHARGE_CONSTRUCTION",
          }),
        ],
      ),
    ).resolves.toBeDefined();

    await expect(
      adminQuery(
        `update public.calculations set tax_input_snapshot = $2::jsonb where id = $1`,
        [
          calculationId,
          JSON.stringify({
            ...invalid,
            documentVatType: "STANDARD_VAT_25",
            deductionChoice: "ROT",
            paymentDate: "2026-08-05",
            personAllowanceSlots: [
              { slot: "rot_without_combined", remainingRotAllowanceOre: 5_000_000 },
            ],
          }),
        ],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    const validMixed = {
      ...invalid,
      documentVatType: "STANDARD_VAT_25",
      deductionChoice: "ROT_AND_GREEN",
      paymentDate: "2026-08-05",
      finalPaymentDate: "2026-08-06",
      personAllowanceSlots: [
        {
          slot: "rot_person",
          remainingRotAllowanceOre: 5_000_000,
          remainingCombinedRotRutAllowanceOre: 7_500_000,
        },
        {
          slot: "green_person",
          remainingGreenAllowanceOre: 5_000_000,
        },
      ],
    };
    await expect(
      adminQuery(
        `update public.calculations set tax_input_snapshot = $2::jsonb where id = $1`,
        [calculationId, JSON.stringify(validMixed)],
      ),
    ).resolves.toBeDefined();

    await expect(
      adminInsertRow({
        tenant_id: fixture.tenantA.id,
        section_id: sectionId,
        row_type: "material",
        unit_sell_ore: 10_000,
        deduction_classification: "ROT_LABOR",
      }),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      adminInsertRow({
        tenant_id: fixture.tenantA.id,
        section_id: sectionId,
        row_type: "machinery",
        unit_sell_ore: 10_000,
        deduction_classification: "GREEN_SOLAR_LABOR",
      }),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("[10.6-INT-04B][P0] finalized V2 enforces whole-SEK claims and reverse metadata", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const missingVatPolicy = validTaxAnswer();
    delete missingVatPolicy.vatPolicy;
    const missingVatPolicyResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(missingVatPolicy)],
    );
    expect(missingVatPolicyResult[0]?.valid).toBe(false);

    const tamperedPolicy = validTaxAnswer();
    (
      (
        (tamperedPolicy.vatPolicy as Record<string, unknown>).values as Record<string, unknown>
      ).green as { rateBpByCategory: Record<string, number> }
    ).rateBpByCategory.SOLAR = 2000;
    const tamperedPolicyResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(tamperedPolicy)],
    );
    expect(tamperedPolicyResult[0]?.valid).toBe(false);

    const whole = validTaxAnswer();
    whole.deductionChoice = "ROT";
    whole.netByDeductionClassification = { ...zeroClassifications(), ROT_LABOR: 10_000 };
    whole.vatByDeductionClassification = { ...zeroClassifications(), ROT_LABOR: 2_500 };
    whole.summaries = {
      labor: { netOre: 10_000, vatOre: 2_500, grossOre: 12_500 },
      material: { netOre: 0, vatOre: 0, grossOre: 0 },
      other: { netOre: 0, vatOre: 0, grossOre: 0 },
    };
    whole.rot = {
      policy: {
        id: POLICY_ID,
        validFrom: "2026-01-01",
        validTo: null,
        resolvingDate: "2026-08-05",
        resolvingFact: "ROT_PAYMENT_DATE",
        values: frozenPolicyValues(),
      },
      basisNetOre: 10_000,
      allocatedVatOre: 2_500,
      basisOre: 12_500,
      calculatedOre: 3_750,
      claimOre: 3_700,
      allocations: [{ slot: "person_a", ore: 3_700 }],
    };
    whole.calculatedDeductionOre = 3_750;
    whole.claimDeductionOre = 3_700;
    whole.deductionOre = 3_700;
    whole.payableOre = 8_800;
    const wholeResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(whole)],
    );
    expect(wholeResult[0]?.valid).toBe(true);

    const orderedInput = {
      ...validTaxInput(),
      deductionChoice: "ROT",
      paymentDate: "2026-08-05",
      personAllowanceSlots: [
        {
          slot: "first",
          remainingRotAllowanceOre: 2_000,
          remainingCombinedRotRutAllowanceOre: 2_000,
        },
        {
          slot: "second",
          remainingRotAllowanceOre: 2_000,
          remainingCombinedRotRutAllowanceOre: 2_000,
        },
      ],
    };
    const orderedAnswer = structuredClone(whole);
    (orderedAnswer.rot as Record<string, unknown>).allocations = [
      { slot: "first", ore: 2_000 },
      { slot: "second", ore: 1_700 },
    ];
    const orderedMatch = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_matches_input(
         $1::jsonb, $2::jsonb, $3::date
       ) as valid`,
      [JSON.stringify(orderedAnswer), JSON.stringify(orderedInput), "2026-08-05"],
    );
    expect(orderedMatch[0]?.valid).toBe(true);
    (orderedAnswer.rot as Record<string, unknown>).allocations = [
      { slot: "second", ore: 1_700 },
      { slot: "first", ore: 2_000 },
    ];
    const reorderedMatch = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_matches_input(
         $1::jsonb, $2::jsonb, $3::date
       ) as valid`,
      [JSON.stringify(orderedAnswer), JSON.stringify(orderedInput), "2026-08-05"],
    );
    expect(reorderedMatch[0]?.valid).toBe(false);

    const mixed = structuredClone(whole);
    mixed.deductionChoice = "ROT_AND_GREEN";
    (mixed.green as Record<string, unknown>).policy = {
      id: POLICY_ID,
      validFrom: "2026-01-01",
      validTo: null,
      resolvingDate: "2026-08-06",
      resolvingFact: "GREEN_FINAL_PAYMENT_DATE",
      values: frozenPolicyValues(),
    };
    const mixedPayload = {
      ...validSnapshot(),
      taxAnswerSnapshot: mixed,
      calculatedDeductionOre: 3_750,
      claimDeductionOre: 3_700,
      deductionTotalOre: 3_700,
      payableOre: 8_800,
      acceptedPriceOre: 8_800,
      deductionType: "rot_and_green",
    };
    const rotLine = { ...validLine(), deductionClassification: "ROT_LABOR" };
    const mixedInput = {
      ...validTaxInput(),
      deductionChoice: "ROT_AND_GREEN",
      paymentDate: "2026-08-05",
      finalPaymentDate: "2026-08-06",
      personAllowanceSlots: [
        {
          slot: "person_a",
          remainingRotAllowanceOre: 5_000_000,
          remainingCombinedRotRutAllowanceOre: 7_500_000,
          remainingGreenAllowanceOre: 5_000_000,
        },
      ],
    };
    await expect(
      adminQuery(
        `select public.assert_story_10_6_fresh_quote_v2(
           $1::jsonb, $2::jsonb, $3::jsonb, $4::date
         )`,
        [
          JSON.stringify(mixedPayload),
          JSON.stringify([rotLine]),
          JSON.stringify(mixedInput),
          "2026-08-05",
        ],
      ),
    ).resolves.toBeDefined();
    await expect(
      adminQuery(
        `select public.assert_story_10_6_fresh_quote_v2(
           $1::jsonb, $2::jsonb, $3::jsonb, $4::date
         )`,
        [
          JSON.stringify(mixedPayload),
          JSON.stringify([{ ...rotLine, rowType: "material" }]),
          JSON.stringify(mixedInput),
          "2026-08-05",
        ],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    const fixedGreen = validTaxAnswer();
    fixedGreen.deductionChoice = "GREEN";
    fixedGreen.netByDeductionClassification = {
      ...zeroClassifications(),
      GREEN_SOLAR_LABOR: 10_000,
    };
    fixedGreen.vatByDeductionClassification = {
      ...zeroClassifications(),
      GREEN_SOLAR_LABOR: 2_500,
    };
    fixedGreen.summaries = {
      labor: { netOre: 10_000, vatOre: 2_500, grossOre: 12_500 },
      material: { netOre: 0, vatOre: 0, grossOre: 0 },
      other: { netOre: 0, vatOre: 0, grossOre: 0 },
    };
    fixedGreen.green = {
      policy: {
        id: POLICY_ID,
        validFrom: "2026-01-01",
        validTo: null,
        resolvingDate: "2026-08-06",
        resolvingFact: "GREEN_FINAL_PAYMENT_DATE",
        values: frozenPolicyValues(),
      },
      basisMethod: "FIXED_PRICE_97_PERCENT",
      categories: {
        SOLAR: { category: "SOLAR", basisOre: 12_125, calculatedOre: 1_818, claimOre: 1_800 },
        STORAGE: { category: "STORAGE", basisOre: 0, calculatedOre: 0, claimOre: 0 },
        CHARGING: { category: "CHARGING", basisOre: 0, calculatedOre: 0, claimOre: 0 },
      },
      calculatedOre: 1_818,
      claimOre: 1_800,
      allocations: [{ slot: "green_person", ore: 1_800 }],
    };
    fixedGreen.calculatedDeductionOre = 1_818;
    fixedGreen.claimDeductionOre = 1_800;
    fixedGreen.deductionOre = 1_800;
    fixedGreen.payableOre = 10_700;
    const fixedGreenResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(fixedGreen)],
    );
    expect(fixedGreenResult[0]?.valid).toBe(true);
    const mismatchedFixedGreen = structuredClone(fixedGreen);
    (
      (mismatchedFixedGreen.green as Record<string, unknown>).categories as Record<
        string,
        Record<string, unknown>
      >
    ).SOLAR!.basisOre = 12_124;
    const mismatchedFixedResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(mismatchedFixedGreen)],
    );
    expect(mismatchedFixedResult[0]?.valid).toBe(false);

    const fractional = structuredClone(whole);
    (fractional.rot as Record<string, unknown>).claimOre = 3_750;
    (fractional.rot as Record<string, unknown>).allocations = [{ slot: "person_a", ore: 3_750 }];
    fractional.claimDeductionOre = 3_750;
    fractional.deductionOre = 3_750;
    fractional.payableOre = 8_750;
    const fractionalResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(fractional)],
    );
    expect(fractionalResult[0]?.valid).toBe(false);

    const reverse = validTaxAnswer();
    reverse.documentVatType = "REVERSE_CHARGE_CONSTRUCTION";
    reverse.reverseChargeApplied = true;
    reverse.categories = [
      {
        vatType: "REVERSE_CHARGE_CONSTRUCTION",
        rateBp: 2500,
        netOre: 10_000,
        vatOre: 0,
        grossOre: 10_000,
      },
    ];
    reverse.vatByDeductionClassification = zeroClassifications();
    reverse.summaries = {
      labor: { netOre: 0, vatOre: 0, grossOre: 0 },
      material: { netOre: 0, vatOre: 0, grossOre: 0 },
      other: { netOre: 10_000, vatOre: 0, grossOre: 10_000 },
    };
    reverse.vatOre = 0;
    reverse.grossOre = 10_000;
    reverse.payableOre = 10_000;
    const missingBuyer = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(reverse)],
    );
    expect(missingBuyer[0]?.valid).toBe(false);
    reverse.buyerVatNumber = "ZZ1234567890";
    const invalidPrefix = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(reverse)],
    );
    expect(invalidPrefix[0]?.valid).toBe(false);
    reverse.buyerVatNumber = "SE123456789012";
    const completeReverse = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(reverse)],
    );
    expect(completeReverse[0]?.valid).toBe(true);
  });

  it("[10.6-INT-05][P0] both fresh RPCs reject V1/partial V2 and incomplete child keys", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    await setCalculationTaxInput();
    const v1 = { ...validSnapshot(), snapshotSchemaVersion: 1 };
    const initialV1 = await client.rpc("create_quote_version_from_calculation", {
      p_tenant_id: fixture.tenantA.id,
      p_calculation_id: calculationId,
      p_captured_at: CAPTURED_AT,
      p_customer_id: customerId,
      p_facility_id: null,
      p_contact_id: null,
      p_snapshot: v1,
      p_lines: [validLine()],
      p_attachments: [],
    });
    expect(initialV1.error?.code).toBe("23514");

    const incompleteLine = { ...validLine() };
    delete incompleteLine.vatType;
    const initialLine = await client.rpc("create_quote_version_from_calculation", {
      p_tenant_id: fixture.tenantA.id,
      p_calculation_id: calculationId,
      p_captured_at: CAPTURED_AT,
      p_customer_id: customerId,
      p_facility_id: null,
      p_contact_id: null,
      p_snapshot: validSnapshot(),
      p_lines: [incompleteLine],
      p_attachments: [],
    });
    expect(initialLine.error?.code).toBe("23514");

    const falseMathAnswer = validTaxAnswer();
    falseMathAnswer.categories = [
      {
        vatType: "STANDARD_VAT_25",
        rateBp: 2500,
        netOre: 10_000,
        vatOre: 2_000,
        grossOre: 12_000,
      },
    ];
    falseMathAnswer.vatByDeductionClassification = {
      ...zeroClassifications(),
      NONE: 2_000,
    };
    falseMathAnswer.summaries = {
      labor: { netOre: 10_000, vatOre: 2_000, grossOre: 12_000 },
      material: { netOre: 0, vatOre: 0, grossOre: 0 },
      other: { netOre: 0, vatOre: 0, grossOre: 0 },
    };
    falseMathAnswer.vatOre = 2_000;
    falseMathAnswer.grossOre = 12_000;
    falseMathAnswer.payableOre = 12_000;
    const falseMathSnapshot = {
      ...validSnapshot(),
      taxAnswerSnapshot: falseMathAnswer,
      vatTotalOre: 2_000,
      acceptedPriceOre: 12_000,
      payableOre: 12_000,
    };
    const initialFalseMath = await client.rpc("create_quote_version_from_calculation", {
      p_tenant_id: fixture.tenantA.id,
      p_calculation_id: calculationId,
      p_captured_at: CAPTURED_AT,
      p_customer_id: customerId,
      p_facility_id: null,
      p_contact_id: null,
      p_snapshot: falseMathSnapshot,
      p_lines: [validLine()],
      p_attachments: [],
    });
    expect(initialFalseMath.error?.code).toBe("23514");

    const created = await createFreshV2();
    const partialAnswer = validTaxAnswer();
    delete partialAnswer.summaries;
    const newVersion = await client.rpc("create_new_quote_version", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_id: created.quoteId,
      p_calculation_id: calculationId,
      p_captured_at: CAPTURED_AT,
      p_customer_id: customerId,
      p_facility_id: null,
      p_contact_id: null,
      p_snapshot: { ...validSnapshot(), taxAnswerSnapshot: partialAnswer },
      p_lines: [validLine()],
      p_attachments: [],
      p_supersede_prior: false,
    });
    expect(newVersion.error?.code).toBe("23514");

    const falseMathNewVersion = await client.rpc("create_new_quote_version", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_id: created.quoteId,
      p_calculation_id: calculationId,
      p_captured_at: CAPTURED_AT,
      p_customer_id: customerId,
      p_facility_id: null,
      p_contact_id: null,
      p_snapshot: falseMathSnapshot,
      p_lines: [validLine()],
      p_attachments: [],
      p_supersede_prior: false,
    });
    expect(falseMathNewVersion.error?.code).toBe("23514");

    const count = await adminQuery<{ count: string }>(
      `select count(*)::text as count from public.quote_versions where quote_id = $1`,
      [created.quoteId],
    );
    expect(Number(count[0]?.count)).toBe(1);
  });

  it("[10.6-INT-06][P0] historical V1 stays readable but a V1 draft cannot newly send", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const quote = await adminQuery<{ id: string }>(
      `insert into public.quotes (tenant_id, customer_id) values ($1, $2) returning id`,
      [fixture.tenantA.id, customerId],
    );
    // Simulate a row that predates this forward migration. New V1 inserts are
    // intentionally blocked by the INSERT guard, including privileged test writes.
    const version = await adminSession(async ({ query }) => {
      await query("begin");
      try {
        await query(`set local session_replication_role = 'replica'`);
        const rows = await query<{ id: string }>(
          `insert into public.quote_versions
             (tenant_id, quote_id, version_number, quote_number, status,
              calculation_id, captured_at, accepted_price_ore)
           values ($1, $2, 1, 999999, 'draft', $3, $4, 12500)
           returning id`,
          [fixture.tenantA.id, quote[0]!.id, calculationId, CAPTURED_AT],
        );
        await query("commit");
        return rows;
      } catch (error) {
        await query("rollback");
        throw error;
      }
    });

    const before = await adminQuery<{
      status: string;
      snapshot_schema_version: number | null;
      tax_answer_snapshot: unknown;
    }>(
      `select status, snapshot_schema_version, tax_answer_snapshot
         from public.quote_versions where id = $1`,
      [version[0]!.id],
    );
    expect(before[0]).toMatchObject({
      status: "draft",
      snapshot_schema_version: null,
      tax_answer_snapshot: null,
    });
    await expect(
      adminQuery(
        `update public.quote_versions set deduction_type = 'rot_and_green' where id = $1`,
        [version[0]!.id],
      ),
    ).rejects.toMatchObject({ code: "QV409" });
    await expect(
      adminQuery(`update public.quote_versions set intro_text = 'legacy presentation' where id = $1`, [
        version[0]!.id,
      ]),
    ).resolves.toBeDefined();
    await expect(
      adminQuery(`update public.quote_versions set status = 'sent' where id = $1`, [version[0]!.id]),
    ).rejects.toMatchObject({ code: "QV409" });
    const after = await adminQuery<{ status: string }>(
      `select status from public.quote_versions where id = $1`,
      [version[0]!.id],
    );
    expect(after[0]?.status).toBe("draft");
  });

  it("[10.6-INT-07][P0] draft→sent rejects co-mutation and locks child mutation/reparent", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const frozen = await createFreshV2();
    const other = await createFreshV2();
    const line = await adminQuery<{ id: string }>(
      `select id from public.quote_version_lines where quote_version_id = $1`,
      [frozen.versionId],
    );

    await expect(
      adminQuery(
        `update public.quote_versions
            set intro_text = 'Presentation remains editable',
                customer_notes = 'Visible note',
                valid_until = $2,
                display_mode = 'summary'
          where id = $1`,
        [frozen.versionId, "2026-09-01T00:00:00.000Z"],
      ),
    ).resolves.toBeDefined();
    await expect(
      adminQuery(`update public.quote_versions set pdf_status = 'generating' where id = $1`, [
        frozen.versionId,
      ]),
    ).resolves.toBeDefined();
    await expect(
      adminQuery(`update public.quote_versions set vat_total_ore = 2400 where id = $1`, [
        frozen.versionId,
      ]),
    ).rejects.toMatchObject({ code: "QV409" });
    await expect(
      adminQuery(`update public.quote_version_lines set label = 'draft tamper' where id = $1`, [
        line[0]!.id,
      ]),
    ).rejects.toMatchObject({ code: "QV409" });
    await expect(
      adminQuery(
        `update public.quote_version_lines set deduction_classification = 'ROT_LABOR' where id = $1`,
        [line[0]!.id],
      ),
    ).rejects.toMatchObject({ code: "QV409" });

    await expect(
      adminQuery(
        `update public.quote_versions
            set status = 'sent', customer_display_name = 'co-mutated'
          where id = $1`,
        [frozen.versionId],
      ),
    ).rejects.toMatchObject({ code: "QV409" });
    await adminQuery(`update public.quote_versions set status = 'sent' where id = $1`, [
      frozen.versionId,
    ]);

    await expect(
      adminQuery(
        `update public.quote_version_lines set deduction_classification = 'ROT_LABOR' where id = $1`,
        [line[0]!.id],
      ),
    ).rejects.toMatchObject({ code: "QV409" });
    await expect(
      adminQuery(
        `update public.quote_version_lines set quote_version_id = $2 where id = $1`,
        [line[0]!.id, other.versionId],
      ),
    ).rejects.toMatchObject({ code: "QV409" });
  });

  it("[10.6-INT-07B][P0] direct inserts cannot skip draft or send line-inconsistent V2", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    await setCalculationTaxInput();
    const quote = await adminQuery<{ id: string }>(
      `insert into public.quotes (tenant_id, customer_id) values ($1, $2) returning id`,
      [fixture.tenantA.id, customerId],
    );
    const nextNumber = await adminQuery<{ quote_number: string }>(
      `select (coalesce(max(quote_number), 0) + 1000)::text as quote_number
         from public.quote_versions where tenant_id = $1`,
      [fixture.tenantA.id],
    );
    const insertParent = (status: "draft" | "sent") =>
      adminQuery<{ id: string }>(
        `insert into public.quote_versions (
           tenant_id, quote_id, version_number, quote_number, status,
           calculation_id, captured_at,
           base_total_ore, option_total_ore, vat_total_ore,
           deduction_total_ore, accepted_price_ore,
           snapshot_schema_version, tax_rule_version, tax_answer_snapshot,
           buyer_vat_number, calculated_deduction_ore,
           claim_deduction_ore, payable_ore, deduction_type
         ) values (
           $1, $2, 1, $3, $4, $5, $6,
           10000, 0, 2500, 0, 12500,
           2, $7, $8::jsonb, null, 0, 0, 12500, null
         ) returning id`,
        [
          fixture.tenantA.id,
          quote[0]!.id,
          nextNumber[0]!.quote_number,
          status,
          calculationId,
          CAPTURED_AT,
          POLICY_ID,
          JSON.stringify(validTaxAnswer()),
        ],
      );

    await expect(insertParent("sent")).rejects.toMatchObject({ code: "QV409" });
    const direct = await insertParent("draft");
    await adminQuery(
      `insert into public.quote_version_lines (
         tenant_id, quote_version_id, row_type, sort_order, label,
         quantity, unit, unit_sell_ore, line_net_ore, vat_rate_bp,
         included_in_invoice_total, deduction_classification, vat_type,
         is_hidden, is_optional, is_selected
       ) values (
         $1, $2, 'labor', 0, 'malicious mismatch',
         1, 'st', 9000, 9000, 2500,
         true, 'NONE', 'STANDARD_VAT_25', false, false, null
       )`,
      [fixture.tenantA.id, direct[0]!.id],
    );
    await expect(
      adminQuery(`update public.quote_versions set status = 'sent' where id = $1`, [
        direct[0]!.id,
      ]),
    ).rejects.toMatchObject({ code: "QV409" });
    const after = await adminQuery<{ status: string }>(
      `select status from public.quote_versions where id = $1`,
      [direct[0]!.id],
    );
    expect(after[0]?.status).toBe("draft");
  });

  it("[10.6-INT-08][P0] child writes serialize behind an in-flight send and reject after freeze", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const created = await createFreshV2();
    const line = await adminQuery<{ id: string }>(
      `select id from public.quote_version_lines where quote_version_id = $1`,
      [created.versionId],
    );

    let signalParentLocked!: () => void;
    let releaseParent!: () => void;
    const parentLocked = new Promise<void>((resolveLocked) => {
      signalParentLocked = resolveLocked;
    });
    const parentRelease = new Promise<void>((resolveRelease) => {
      releaseParent = resolveRelease;
    });

    const parentTx = adminSession(async ({ query }) => {
      await query("begin");
      try {
        await query(`update public.quote_versions set status = 'sent' where id = $1`, [
          created.versionId,
        ]);
        signalParentLocked();
        await parentRelease;
        await query("commit");
      } catch (error) {
        await query("rollback");
        throw error;
      }
    });
    await parentLocked;

    let signalChildPid!: (pid: number) => void;
    const childPidReady = new Promise<number>((resolvePid) => {
      signalChildPid = resolvePid;
    });
    const childAttempt = adminSession(async ({ query }) => {
      const pid = await query<{ pid: number }>(`select pg_backend_pid() as pid`);
      signalChildPid(pid[0]!.pid);
      await query(`update public.quote_version_lines set label = 'race' where id = $1`, [
        line[0]!.id,
      ]);
    }).then(
      () => ({ ok: true as const, error: null }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    const childPid = await childPidReady;

    let observedParentWait = false;
    try {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const activity = await adminQuery<{ wait_event_type: string | null }>(
          `select wait_event_type from pg_stat_activity where pid = $1`,
          [childPid],
        );
        if (activity[0]?.wait_event_type === "Lock") {
          observedParentWait = true;
          break;
        }
        const finished = await Promise.race([
          childAttempt.then(() => true),
          new Promise<false>((resolveDelay) => setTimeout(() => resolveDelay(false), 10)),
        ]);
        if (finished) break;
      }
      expect(observedParentWait, "child trigger must wait on the parent row lock").toBe(true);
    } finally {
      releaseParent();
      await parentTx;
    }

    const childResult = await childAttempt;
    expect(childResult.ok).toBe(false);
    expect(errorCode(childResult.error)).toBe("QV409");
  }, 10_000);

  it("[10.6-INT-09][P0] acceptance source total must equal frozen V2 payable", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const created = await createFreshV2();
    await adminQuery(`update public.quote_versions set status = 'sent' where id = $1`, [
      created.versionId,
    ]);

    await expect(
      adminQuery(
        `insert into public.quote_acceptances
           (tenant_id, quote_id, quote_version_id, accepted_at,
            accepted_price_ore, source_sent_total_ore, adjustment_reason)
         values ($1, $2, $3, $4, 12000, 12400, 'Test adjustment')`,
        [fixture.tenantA.id, created.quoteId, created.versionId, CAPTURED_AT],
      ),
    ).rejects.toMatchObject({ code: "QV409" });

    await expect(
      adminQuery(
        `insert into public.quote_acceptances
           (tenant_id, quote_id, quote_version_id, accepted_at,
            accepted_price_ore, source_sent_total_ore, adjustment_reason)
         values ($1, $2, $3, $4, 12000, 12500, 'Test adjustment')`,
        [fixture.tenantA.id, created.quoteId, created.versionId, CAPTURED_AT],
      ),
    ).resolves.toBeDefined();
  });
});
