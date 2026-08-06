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
    }],
    taxInput: taxInput.value,
    quoteCaptureDate: "2026-08-05",
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
      slot: "person_a",
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
  });
  if (!answer.ok) assert.fail(`mixed tax answer failed: ${answer.code}`);
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
});
