import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  TAX_DEDUCTION_CHOICES,
  validateCreateRow,
  validateTaxInputSnapshot,
  validateUpdateRow,
} from "@/server/commands/calculations/validation";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const ROW_ID = "22222222-2222-4222-8222-222222222222";

const baseTaxInput = {
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
} as const;

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    section_id: SECTION_ID,
    row_type: "labor",
    quantity: 1,
    unit: "h",
    vat_rate_bp: 2500,
    ...overrides,
  };
}

describe("Story 10.6 Task 3 tax-input validation", () => {
  test("keeps the deduction choice closed and requires buyer VAT for reverse charge", () => {
    assert.deepEqual(TAX_DEDUCTION_CHOICES, [
      "NONE",
      "ROT",
      "GREEN",
      "ROT_AND_GREEN",
    ]);
    const result = validateTaxInputSnapshot({
      ...baseTaxInput,
      documentVatType: "REVERSE_CHARGE_CONSTRUCTION",
    });
    assert.equal(result.ok, false);
    const resolved = validateTaxInputSnapshot({
      ...baseTaxInput,
      documentVatType: "REVERSE_CHARGE_CONSTRUCTION",
      buyerVatNumber: "SE556677889901",
    });
    assert.equal(resolved.ok, true);
  });

  test("requires a valid resolving date and stable PII-free allowance slots for ROT", () => {
    assert.equal(
      validateTaxInputSnapshot({ ...baseTaxInput, deductionChoice: "ROT" }).ok,
      false,
    );
    assert.equal(
      validateTaxInputSnapshot({
        ...baseTaxInput,
        deductionChoice: "ROT",
        paymentDate: "2026-08-05",
        personAllowanceSlots: [
          {
            slot: "PERSON_1",
            remainingAllowanceOre: 5_000_000,
            remainingCombinedRotRutAllowanceOre: 7_500_000,
          },
        ],
      }).ok,
      true,
    );
    assert.equal(
      validateTaxInputSnapshot({
        ...baseTaxInput,
        deductionChoice: "ROT",
        paymentDate: "2026-02-30",
        personAllowanceSlots: [
          { slot: "19600101-1234", remainingAllowanceOre: 5_000_000 },
        ],
      }).ok,
      false,
    );
  });

  test("requires explicit, reconciling category amounts for the fixed-price 97 percent method", () => {
    const valid = {
      ...baseTaxInput,
      deductionChoice: "GREEN",
      finalPaymentDate: "2026-08-05",
      personAllowanceSlots: [
        { slot: "PERSON_1", remainingAllowanceOre: 5_000_000 },
      ],
      greenBasisMethod: "FIXED_PRICE_97_PERCENT",
      genuineFixedPrice: true,
      fixedPriceOre: 100_000,
      fixedPriceCategorySplitOre: {
        SOLAR: 40_000,
        STORAGE: 30_000,
        CHARGING: 30_000,
      },
    } as const;
    assert.equal(validateTaxInputSnapshot(valid).ok, true);
    assert.equal(
      validateTaxInputSnapshot({
        ...valid,
        genuineFixedPrice: false,
      }).ok,
      false,
    );
    assert.equal(
      validateTaxInputSnapshot({
        ...valid,
        fixedPriceCategorySplitOre: {
          SOLAR: 40_000,
          STORAGE: 30_000,
          CHARGING: 29_999,
        },
      }).ok,
      false,
    );
  });

  test("normalizes a valid buyer VAT number and accepts disjoint ROT plus green inputs", () => {
    const result = validateTaxInputSnapshot({
      ...baseTaxInput,
      buyerVatNumber: " se 5566778899-01 ",
      deductionChoice: "ROT_AND_GREEN",
      paymentDate: "2026-08-05",
      finalPaymentDate: "2026-08-06",
      personAllowanceSlots: [
        {
          slot: "PERSON_1",
          remainingRotAllowanceOre: 5_000_000,
          remainingCombinedRotRutAllowanceOre: 7_500_000,
          remainingGreenAllowanceOre: 5_000_000,
        },
      ],
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.data.buyerVatNumber, "SE556677889901");
  });

  test("mixed deductions allow scheme-specific people but require combined ROT/RUT capacity for each ROT slot", () => {
    const disjointPeople = {
      ...baseTaxInput,
      deductionChoice: "ROT_AND_GREEN",
      paymentDate: "2026-08-05",
      finalPaymentDate: "2026-08-06",
      personAllowanceSlots: [
        {
          slot: "PERSON_1",
          remainingRotAllowanceOre: 5_000_000,
          remainingCombinedRotRutAllowanceOre: 7_500_000,
        },
        { slot: "PERSON_2", remainingGreenAllowanceOre: 5_000_000 },
      ],
    };
    assert.equal(validateTaxInputSnapshot(disjointPeople).ok, true);
    assert.equal(
      validateTaxInputSnapshot({
        ...disjointPeople,
        personAllowanceSlots: [
          { slot: "PERSON_1", remainingRotAllowanceOre: 5_000_000 },
          { slot: "PERSON_2", remainingGreenAllowanceOre: 5_000_000 },
        ],
      }).ok,
      false,
    );
  });

  test("defaults new row economics independently from visibility", () => {
    const result = validateCreateRow(baseRow({ is_hidden: true }));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.is_hidden, true);
    assert.equal(result.data.included_in_invoice_total, true);
    assert.equal(result.data.deduction_classification, "NONE");
    assert.equal(result.data.vat_type, "STANDARD_VAT_25");
  });

  test("accepts explicit exclusion/classification/VAT type and rejects out-of-domain values", () => {
    const valid = validateUpdateRow({
      id: ROW_ID,
      included_in_invoice_total: false,
      deduction_classification: "GREEN_STORAGE_MATERIAL",
      vat_type: "REVERSE_CHARGE_CONSTRUCTION",
      vat_rate_bp: 0,
    });
    assert.equal(valid.ok, true);
    assert.equal(
      validateUpdateRow({ id: ROW_ID, deduction_classification: "ROT_MATERIAL" }).ok,
      false,
    );
    assert.equal(validateUpdateRow({ id: ROW_ID, vat_type: "ZERO_PERCENT" }).ok, false);
  });

  test("rejects impossible row-type and deduction-classification pairs", () => {
    assert.equal(
      validateCreateRow(baseRow({ row_type: "material", deduction_classification: "ROT_LABOR" })).ok,
      false,
    );
    assert.equal(
      validateCreateRow(baseRow({
        row_type: "machinery",
        deduction_classification: "GREEN_STORAGE_MATERIAL",
      })).ok,
      false,
    );
    assert.equal(
      validateCreateRow(baseRow({
        row_type: "material",
        deduction_classification: "GREEN_STORAGE_MATERIAL",
      })).ok,
      true,
    );
    assert.equal(
      validateUpdateRow({
        id: ROW_ID,
        row_type: "material",
        deduction_classification: "ROT_LABOR",
      }).ok,
      false,
    );
    assert.equal(
      validateUpdateRow({
        id: ROW_ID,
        row_type: "other",
        deduction_classification: "GREEN_SOLAR_LABOR",
      }).ok,
      false,
    );
  });
});
