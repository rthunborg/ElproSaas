import assert from "node:assert/strict";
import { test } from "node:test";

import {
  resolveTaxReadiness,
  taxReadinessBlockerForFailure,
} from "@/features/calculations/tax-readiness";

const standardRow = {
  id: "row-1",
  netOre: 100_000,
  vatType: "STANDARD_VAT_25" as const,
  rateBp: 2500,
  includedInInvoiceTotal: true,
  deductionClassification: "NONE" as const,
  summaryCategory: "other" as const,
};

const baseInput = {
  schemaVersion: 2 as const,
  documentVatType: "STANDARD_VAT_25" as const,
  buyerVatNumber: null,
  deductionChoice: "NONE" as const,
  paymentDate: null,
  finalPaymentDate: null,
  personAllowanceSlots: [],
  greenBasisMethod: "ACTUAL_ELIGIBLE_COSTS" as const,
  genuineFixedPrice: false,
  fixedPriceOre: null,
  fixedPriceCategorySplitOre: null,
};

test("10.6 tax readiness blocks a missing versioned header instead of assuming defaults", () => {
  const resolution = resolveTaxReadiness({ taxInput: null, rows: [standardRow], quoteCaptureDate: "2026-08-06", customerEligibilityPosture: "private" });
  assert.deepEqual(resolution.blockingCodes, ["MISSING_TAX_INPUT"]);
  assert.equal(resolution.answer, null);
});
test("10.6 tax readiness maps reverse-charge buyer metadata failures", () => {
  const resolution = resolveTaxReadiness({
    taxInput: { ...baseInput, documentVatType: "REVERSE_CHARGE_CONSTRUCTION" },
    rows: [
      {
        ...standardRow,
        vatType: "REVERSE_CHARGE_CONSTRUCTION",
        rateBp: 2500,
      },
    ],
    quoteCaptureDate: "2026-08-06",
    customerEligibilityPosture: "private",
  });
  assert.deepEqual(resolution.blockingCodes, ["MISSING_BUYER_VAT_NUMBER"]);
});

test("10.6 tax readiness returns the exact reconciled answer when inputs are complete", () => {
  const resolution = resolveTaxReadiness({ taxInput: baseInput, rows: [standardRow], quoteCaptureDate: "2026-08-06", customerEligibilityPosture: "private" });
  assert.deepEqual(resolution.blockingCodes, []);
  assert.equal(resolution.answer?.netOre, 100_000);
  assert.equal(resolution.answer?.vatOre, 25_000);
  assert.equal(resolution.answer?.payableOre, 125_000);
});

test("10.6 tax readiness maps fixed-price row-scope failures to actionable fixed-price guidance", () => {
  assert.equal(
    taxReadinessBlockerForFailure("INCOMPLETE_FIXED_PRICE_ROW_SCOPE"),
    "INCOMPLETE_FIXED_PRICE_CATEGORY_SPLIT",
  );
  assert.equal(
    taxReadinessBlockerForFailure("FIXED_PRICE_SCOPE_MISMATCH"),
    "INCOMPLETE_FIXED_PRICE_CATEGORY_SPLIT",
  );
});
