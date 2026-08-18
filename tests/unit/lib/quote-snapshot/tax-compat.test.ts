import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildTaxAnswerSnapshotV2,
  parseTaxInputSnapshot,
  type TaxAnswerSnapshotV2,
} from "@/lib/money";
import {
  adaptQuoteTaxSnapshot,
  parseTaxAnswerSnapshotV2,
} from "@/lib/quote-snapshot";

function answerFor(netOre = 100_000): TaxAnswerSnapshotV2 {
  const taxInput = parseTaxInputSnapshot({
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
  });
  if (!taxInput.ok) assert.fail(`tax input failed: ${taxInput.code}`);
  const answer = buildTaxAnswerSnapshotV2({
    rows: [{
      id: "row-1",
      netOre,
      vatType: "STANDARD_VAT_25",
      rateBp: 2_500,
      includedInInvoiceTotal: true,
      deductionClassification: "NONE",
      summaryCategory: "other",
    }],
    taxInput: taxInput.value,
    quoteCaptureDate: "2026-08-05",
    customerEligibilityPosture: "private",
  });
  if (!answer.ok) assert.fail(`tax answer failed: ${answer.code}`);
  return answer.value;
}

function mixedAnswer(): TaxAnswerSnapshotV2 {
  const taxInput = parseTaxInputSnapshot({
    schemaVersion: 2,
    documentVatType: "STANDARD_VAT_25",
    buyerVatNumber: null,
    deductionChoice: "ROT_AND_GREEN",
    paymentDate: "2026-08-05",
    finalPaymentDate: "2026-08-06",
    personAllowanceSlots: [{
      slot: "PERSON_1",
      remainingRotAllowanceOre: 5_000_000,
      remainingCombinedRotRutAllowanceOre: 7_500_000,
      remainingGreenAllowanceOre: 5_000_000,
    }],
    greenBasisMethod: "ACTUAL_ELIGIBLE_COSTS",
    genuineFixedPrice: false,
    fixedPriceOre: null,
    fixedPriceCategorySplitOre: null,
  });
  if (!taxInput.ok) assert.fail(`mixed tax input failed: ${taxInput.code}`);
  const answer = buildTaxAnswerSnapshotV2({
    rows: [
      {
        id: "rot-labor",
        netOre: 100_000,
        vatType: "STANDARD_VAT_25",
        rateBp: 2_500,
        includedInInvoiceTotal: true,
        deductionClassification: "ROT_LABOR",
        summaryCategory: "labor",
      },
      {
        id: "green-solar-material",
        netOre: 100_000,
        vatType: "STANDARD_VAT_25",
        rateBp: 2_500,
        includedInInvoiceTotal: true,
        deductionClassification: "GREEN_SOLAR_MATERIAL",
        summaryCategory: "material",
      },
    ],
    taxInput: taxInput.value,
    quoteCaptureDate: "2026-08-05",
    customerEligibilityPosture: "private",
  });
  if (!answer.ok) assert.fail(`mixed tax answer failed: ${answer.code}`);
  return answer.value;
}

function fixedPriceAnswer(): TaxAnswerSnapshotV2 {
  const taxInput = parseTaxInputSnapshot({
    schemaVersion: 2,
    documentVatType: "STANDARD_VAT_25",
    buyerVatNumber: null,
    deductionChoice: "GREEN",
    paymentDate: null,
    finalPaymentDate: "2026-08-06",
    personAllowanceSlots: [{
      slot: "PERSON_1",
      remainingGreenAllowanceOre: 5_000_000,
    }],
    greenBasisMethod: "FIXED_PRICE_97_PERCENT",
    genuineFixedPrice: true,
    fixedPriceOre: 7,
    fixedPriceCategorySplitOre: { SOLAR: 7, STORAGE: 0, CHARGING: 0 },
  });
  if (!taxInput.ok) assert.fail(`fixed-price tax input failed: ${taxInput.code}`);
  const answer = buildTaxAnswerSnapshotV2({
    rows: [{
      id: "green-solar-material",
      netOre: 7,
      vatType: "ZERO_RATED",
      rateBp: 0,
      includedInInvoiceTotal: true,
      deductionClassification: "GREEN_SOLAR_MATERIAL",
      summaryCategory: "material",
    }],
    taxInput: taxInput.value,
    quoteCaptureDate: "2026-08-05",
    customerEligibilityPosture: "private",
  });
  if (!answer.ok) assert.fail(`fixed-price tax answer failed: ${answer.code}`);
  return answer.value;
}

function aggregateGreenAnswer(): TaxAnswerSnapshotV2 {
  const taxInput = parseTaxInputSnapshot({
    schemaVersion: 2,
    documentVatType: "STANDARD_VAT_25",
    buyerVatNumber: null,
    deductionChoice: "GREEN",
    paymentDate: null,
    finalPaymentDate: "2026-08-06",
    personAllowanceSlots: [{ slot: "PERSON_1", remainingGreenAllowanceOre: 5_000_000 }],
    greenBasisMethod: "ACTUAL_ELIGIBLE_COSTS",
    genuineFixedPrice: false,
    fixedPriceOre: null,
    fixedPriceCategorySplitOre: null,
  });
  if (!taxInput.ok) assert.fail(`aggregate-green tax input failed: ${taxInput.code}`);
  const answer = buildTaxAnswerSnapshotV2({
    rows: [
      {
        id: "solar",
        netOre: 160,
        vatType: "STANDARD_VAT_25",
        rateBp: 2_500,
        includedInInvoiceTotal: true,
        deductionClassification: "GREEN_SOLAR_LABOR",
        summaryCategory: "labor",
      },
      {
        id: "storage",
        netOre: 112,
        vatType: "STANDARD_VAT_25",
        rateBp: 2_500,
        includedInInvoiceTotal: true,
        deductionClassification: "GREEN_STORAGE_LABOR",
        summaryCategory: "labor",
      },
    ],
    taxInput: taxInput.value,
    quoteCaptureDate: "2026-08-05",
    customerEligibilityPosture: "private",
  });
  if (!answer.ok) assert.fail(`aggregate-green tax answer failed: ${answer.code}`);
  return answer.value;
}

function sourceOf(answer: TaxAnswerSnapshotV2) {
  return {
    snapshotSchemaVersion: 2,
    taxRuleVersion: answer.taxRuleVersions.join("+"),
    taxAnswerSnapshot: answer,
    buyerVatNumber: answer.buyerVatNumber,
    calculatedDeductionOre: answer.calculatedDeductionOre,
    claimDeductionOre: answer.claimDeductionOre,
    payableOre: answer.payableOre,
    vatOre: answer.vatOre,
    deductionOre: answer.deductionOre,
    acceptedPriceOre: answer.payableOre,
  } as const;
}

function mutableRecord(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

function mutableArray(value: unknown): unknown[] {
  assert.ok(Array.isArray(value));
  return value;
}

describe("Story 10.6 — quote-tax compatibility boundary", () => {
  test("deep-copies and freezes a JSONB V2 answer so later source mutation cannot move the commitment", () => {
    const mutable = JSON.parse(JSON.stringify(answerFor())) as Record<string, unknown>;
    const parsed = parseTaxAnswerSnapshotV2(mutable);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    const sourceCategories = mutable.categories as Array<Record<string, unknown>>;
    sourceCategories[0].netOre = 1;
    (mutable.summaries as Record<string, Record<string, unknown>>).labor.netOre = 999;

    assert.equal(parsed.value.categories[0].netOre, 100_000);
    assert.equal(parsed.value.summaries.labor.netOre, 0);
    assert.equal(Object.isFrozen(parsed.value), true);
    assert.equal(Object.isFrozen(parsed.value.categories), true);
    assert.equal(Object.isFrozen(parsed.value.categories[0]), true);
    assert.equal(Object.isFrozen(parsed.value.summaries.labor), true);
  });

  test("legacy V1 reads literal frozen scalar values and never invents unavailable net/category facts", () => {
    const adapted = adaptQuoteTaxSnapshot({
      snapshotSchemaVersion: 1,
      vatOre: 12_345,
      deductionOre: 6_700,
      acceptedPriceOre: 88_888,
    });
    assert.equal(adapted.ok, true);
    if (!adapted.ok) return;
    assert.deepEqual(adapted.value, {
      source: "legacy-v1",
      schemaVersion: 1,
      netOre: null,
      vatOre: 12_345,
      grossOre: null,
      calculatedDeductionOre: null,
      claimDeductionOre: null,
      deductionOre: 6_700,
      payableOre: 88_888,
      buyerVatNumber: null,
      reverseChargeApplied: false,
      categories: [],
      summaries: null,
      taxAnswer: null,
    });
  });

  test("V1 and V2 preserve the same payable/VAT truth for an equivalent no-deduction quote", () => {
    const answer = answerFor();
    const legacy = adaptQuoteTaxSnapshot({
      snapshotSchemaVersion: 1,
      vatOre: answer.vatOre,
      deductionOre: answer.deductionOre,
      acceptedPriceOre: answer.payableOre,
    });
    const v2 = adaptQuoteTaxSnapshot(sourceOf(answer));
    assert.equal(legacy.ok, true);
    assert.equal(v2.ok, true);
    if (!legacy.ok || !v2.ok) return;
    assert.equal(v2.value.payableOre, legacy.value.payableOre);
    assert.equal(v2.value.vatOre, legacy.value.vatOre);
    assert.equal(v2.value.deductionOre, legacy.value.deductionOre);
  });

  test("malformed, unsupported, or scalar-divergent V2 snapshots fail closed", () => {
    const answer = answerFor();
    const missingSummary = JSON.parse(JSON.stringify(answer)) as Record<string, unknown>;
    delete missingSummary.summaries;
    assert.deepEqual(parseTaxAnswerSnapshotV2(missingSummary), {
      ok: false,
      code: "INVALID_V2_TAX_SNAPSHOT",
    });
    assert.deepEqual(
      adaptQuoteTaxSnapshot({ ...sourceOf(answer), payableOre: answer.payableOre + 100 }),
      { ok: false, code: "INVALID_V2_TAX_SNAPSHOT" },
    );
    const unexpectedBuyerVat = mutableRecord(JSON.parse(JSON.stringify(answer)));
    unexpectedBuyerVat.buyerVatNumber = "SE556677889901";
    assert.equal(parseTaxAnswerSnapshotV2(unexpectedBuyerVat).ok, false);
    assert.deepEqual(
      adaptQuoteTaxSnapshot({
        snapshotSchemaVersion: 3,
        vatOre: 0,
        deductionOre: 0,
        acceptedPriceOre: 0,
      }),
      { ok: false, code: "INVALID_V2_TAX_SNAPSHOT" },
    );
  });

  test("accepts a complete mixed ROT + green answer with distinct resolving dates and allocations", () => {
    const source = mixedAnswer();
    const parsed = parseTaxAnswerSnapshotV2(JSON.parse(JSON.stringify(source)));
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.deductionChoice, "ROT_AND_GREEN");
    assert.equal(parsed.value.rot.policy?.resolvingDate, "2026-08-05");
    assert.equal(parsed.value.green.policy?.resolvingDate, "2026-08-06");
    assert.equal(
      parsed.value.rot.allocations.reduce((sum, allocation) => sum + allocation.ore, 0),
      parsed.value.rot.claimOre,
    );
    assert.equal(
      parsed.value.green.allocations.reduce((sum, allocation) => sum + allocation.ore, 0),
      parsed.value.green.claimOre,
    );
  });

  test("reads a structurally complete retired frozen policy without consulting today's registry", () => {
    const retired = mutableRecord(JSON.parse(JSON.stringify(answerFor())));
    retired.taxRuleVersions = ["SE-TAX-RETIRED-24-v1"];

    const vatPolicy = mutableRecord(retired.vatPolicy);
    vatPolicy.id = "SE-TAX-RETIRED-24-v1";
    const policyVat = mutableRecord(mutableRecord(vatPolicy.values).vat);
    policyVat.standardRateBp = 2_400;

    const category = mutableRecord(mutableArray(retired.categories)[0]);
    category.rateBp = 2_400;
    category.vatOre = 24_000;
    category.grossOre = 124_000;
    mutableRecord(retired.vatByDeductionClassification).NONE = 24_000;
    const other = mutableRecord(mutableRecord(retired.summaries).other);
    other.vatOre = 24_000;
    other.grossOre = 124_000;
    retired.vatOre = 24_000;
    retired.grossOre = 124_000;
    retired.payableOre = 124_000;

    const parsed = parseTaxAnswerSnapshotV2(retired);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.vatPolicy.id, "SE-TAX-RETIRED-24-v1");
    assert.equal(parsed.value.vatPolicy.values.vat.standardRateBp, 2_400);
    assert.equal(parsed.value.vatOre, 24_000);
  });

  test("uses exact BigInt-backed category VAT arithmetic near MAX_SAFE_INTEGER", () => {
    const answer = answerFor(7_205_759_403_692_794);
    assert.equal(answer.vatOre, 1_801_439_850_923_199);
    assert.equal(answer.grossOre, 9_007_199_254_615_993);
    assert.equal(parseTaxAnswerSnapshotV2(JSON.parse(JSON.stringify(answer))).ok, true);

    const drifted = mutableRecord(JSON.parse(JSON.stringify(answer)));
    const category = mutableRecord(mutableArray(drifted.categories)[0]);
    category.vatOre = (category.vatOre as number) + 1;
    category.grossOre = (category.grossOre as number) + 1;
    mutableRecord(drifted.vatByDeductionClassification).NONE = answer.vatOre + 1;
    const other = mutableRecord(mutableRecord(drifted.summaries).other);
    other.vatOre = answer.vatOre + 1;
    other.grossOre = answer.grossOre + 1;
    drifted.vatOre = answer.vatOre + 1;
    drifted.grossOre = answer.grossOre + 1;
    drifted.payableOre = answer.payableOre + 1;

    assert.deepEqual(parseTaxAnswerSnapshotV2(drifted), {
      ok: false,
      code: "INVALID_V2_TAX_SNAPSHOT",
    });
  });

  test("rejects ROT facts that drift from frozen classifications or frozen-policy arithmetic", () => {
    const source = mixedAnswer();

    const basisDrift = mutableRecord(JSON.parse(JSON.stringify(source)));
    const basisRot = mutableRecord(basisDrift.rot);
    basisRot.basisNetOre = (basisRot.basisNetOre as number) + 100;
    basisRot.allocatedVatOre = (basisRot.allocatedVatOre as number) - 100;
    assert.equal(parseTaxAnswerSnapshotV2(basisDrift).ok, false);

    const calculationDrift = mutableRecord(JSON.parse(JSON.stringify(source)));
    const calculationRot = mutableRecord(calculationDrift.rot);
    calculationRot.calculatedOre = (calculationRot.calculatedOre as number) + 1;
    calculationDrift.calculatedDeductionOre = source.calculatedDeductionOre + 1;
    assert.equal(parseTaxAnswerSnapshotV2(calculationDrift).ok, false);
  });

  test("rejects green facts that drift from classified gross or frozen-policy arithmetic", () => {
    const source = mixedAnswer();

    const basisDrift = mutableRecord(JSON.parse(JSON.stringify(source)));
    const basisSolar = mutableRecord(mutableRecord(mutableRecord(basisDrift.green).categories).SOLAR);
    basisSolar.basisOre = (basisSolar.basisOre as number) + 1;
    assert.equal(parseTaxAnswerSnapshotV2(basisDrift).ok, false);

    const calculationDrift = mutableRecord(JSON.parse(JSON.stringify(source)));
    const calculationGreen = mutableRecord(calculationDrift.green);
    const calculationSolar = mutableRecord(mutableRecord(calculationGreen.categories).SOLAR);
    calculationSolar.calculatedOre = (calculationSolar.calculatedOre as number) + 1;
    calculationGreen.calculatedOre = (calculationGreen.calculatedOre as number) + 1;
    calculationDrift.calculatedDeductionOre = source.calculatedDeductionOre + 1;
    assert.equal(parseTaxAnswerSnapshotV2(calculationDrift).ok, false);
  });

  test("accepts only the reconciled document-level green claim allocation", () => {
    const source = aggregateGreenAnswer();
    assert.equal(source.green.claimOre, 100);
    assert.deepEqual(
      [
        source.green.categories.SOLAR.claimOre,
        source.green.categories.STORAGE.claimOre,
        source.green.categories.CHARGING.claimOre,
      ],
      [30, 70, 0],
    );
    assert.equal(parseTaxAnswerSnapshotV2(JSON.parse(JSON.stringify(source))).ok, true);

    const independentlyTruncated = mutableRecord(JSON.parse(JSON.stringify(source)));
    const green = mutableRecord(independentlyTruncated.green);
    const categories = mutableRecord(green.categories);
    mutableRecord(categories.SOLAR).claimOre = 0;
    mutableRecord(categories.STORAGE).claimOre = 0;
    green.claimOre = 0;
    green.allocations = [];
    independentlyTruncated.claimDeductionOre = 0;
    independentlyTruncated.deductionOre = 0;
    independentlyTruncated.payableOre = independentlyTruncated.grossOre;
    assert.equal(parseTaxAnswerSnapshotV2(independentlyTruncated).ok, false);
  });

  test("validates fixed-price green math as one exact rational, not from its floored display basis", () => {
    const source = fixedPriceAnswer();
    assert.equal(source.green.categories.SOLAR.basisOre, 6);
    assert.equal(source.green.categories.SOLAR.calculatedOre, 1);
    assert.equal(parseTaxAnswerSnapshotV2(JSON.parse(JSON.stringify(source))).ok, true);

    const stagedIntermediate = mutableRecord(JSON.parse(JSON.stringify(source)));
    const green = mutableRecord(stagedIntermediate.green);
    const solar = mutableRecord(mutableRecord(green.categories).SOLAR);
    solar.calculatedOre = 0;
    green.calculatedOre = 0;
    stagedIntermediate.calculatedDeductionOre = 0;

    assert.deepEqual(parseTaxAnswerSnapshotV2(stagedIntermediate), {
      ok: false,
      code: "INVALID_V2_TAX_SNAPSHOT",
    });
  });

  test("normalizes historical allocation ids across ROT and green without emitting the raw ids", () => {
    const historical = mutableRecord(JSON.parse(JSON.stringify(mixedAnswer())));
    const rot = mutableRecord(historical.rot);
    const green = mutableRecord(historical.green);
    const rotClaimOre = rot.claimOre as number;
    const greenClaimOre = green.claimOre as number;
    rot.allocations = [
      { slot: "LegacyCustomer", ore: rotClaimOre - 100 },
      { slot: "PERSON_1", ore: 100 },
    ];
    green.allocations = [
      { slot: "PERSON_1", ore: 100 },
      { slot: "LegacyCustomer", ore: greenClaimOre - 100 },
    ];

    const parsed = parseTaxAnswerSnapshotV2(historical);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(parsed.value.rot.allocations, [
      { slot: "PERSON_2", ore: rotClaimOre - 100 },
      { slot: "PERSON_1", ore: 100 },
    ]);
    assert.deepEqual(parsed.value.green.allocations, [
      { slot: "PERSON_1", ore: 100 },
      { slot: "PERSON_2", ore: greenClaimOre - 100 },
    ]);
    assert.equal(JSON.stringify(parsed.value).includes("LegacyCustomer"), false);
  });

  test("keeps duplicate, malformed, and over-50 historical allocation identities fail-closed", () => {
    const duplicate = mutableRecord(JSON.parse(JSON.stringify(mixedAnswer())));
    const duplicateRot = mutableRecord(duplicate.rot);
    const duplicateClaimOre = duplicateRot.claimOre as number;
    duplicateRot.allocations = [
      { slot: "LegacyCustomer", ore: duplicateClaimOre },
      { slot: "LegacyCustomer", ore: 0 },
    ];
    assert.equal(parseTaxAnswerSnapshotV2(duplicate).ok, false);

    const malformed = mutableRecord(JSON.parse(JSON.stringify(mixedAnswer())));
    const malformedRot = mutableRecord(malformed.rot);
    malformedRot.allocations = [{ slot: "Legacy Customer", ore: malformedRot.claimOre }];
    assert.equal(parseTaxAnswerSnapshotV2(malformed).ok, false);

    const tooMany = mutableRecord(JSON.parse(JSON.stringify(mixedAnswer())));
    const tooManyRot = mutableRecord(tooMany.rot);
    const tooManyGreen = mutableRecord(tooMany.green);
    const tooManyRotClaimOre = tooManyRot.claimOre as number;
    const tooManyGreenClaimOre = tooManyGreen.claimOre as number;
    tooManyRot.allocations = Array.from({ length: 26 }, (_, index) => ({
      slot: `LegacyRot_${index + 1}`,
      ore: index === 0 ? tooManyRotClaimOre : 0,
    }));
    tooManyGreen.allocations = Array.from({ length: 25 }, (_, index) => ({
      slot: `LegacyGreen_${index + 1}`,
      ore: index === 0 ? tooManyGreenClaimOre : 0,
    }));
    assert.equal(parseTaxAnswerSnapshotV2(tooMany).ok, false);
  });
});
