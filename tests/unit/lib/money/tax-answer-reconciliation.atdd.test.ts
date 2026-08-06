/**
 * Story 10.6 executable acceptance contract. Every scenario exercises the implemented canonical
 * behavior directly, without a skip, expected-failure wrapper, or surface-presence gate.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import * as calculationTotals from "@/features/calculations/totals";
import * as money from "@/lib/money";

type UnknownFunction = (...args: unknown[]) => unknown;

const surface = { ...money, ...calculationTotals } as Record<string, unknown>;

function requireFunction(name: string): UnknownFunction {
  const value = surface[name];
  assert.equal(
    typeof value,
    "function",
    `Story 10.6 requires the canonical ${name} export; missing implementation must fail loud`,
  );
  return value as UnknownFunction;
}

function okValue<T>(result: unknown): T {
  assert.equal(typeof result, "object", `expected a typed result, got ${String(result)}`);
  assert.notEqual(result, null, "expected a non-null typed result");
  const typed = result as { readonly ok?: unknown; readonly value?: unknown };
  assert.equal(typed.ok, true, `expected ok result, got ${JSON.stringify(result)}`);
  assert.ok("value" in typed, "ok result must carry value");
  return typed.value as T;
}

function errorCode(result: unknown): string {
  assert.equal(typeof result, "object");
  assert.notEqual(result, null);
  const typed = result as { readonly ok?: unknown; readonly code?: unknown };
  assert.equal(typed.ok, false, `expected typed failure, got ${JSON.stringify(result)}`);
  assert.equal(typeof typed.code, "string");
  return typed.code as string;
}

const standard = (netOre: number, overrides: Record<string, unknown> = {}) => ({
  id: `standard-${netOre}`,
  netOre,
  vatType: "STANDARD_VAT_25",
  rateBp: 2500,
  isHidden: false,
  includedInInvoiceTotal: true,
  deductionClassification: "NONE",
  ...overrides,
});

describe("Story 10.6 — tax answer reconciliation", () => {
  test("[10.6-UNIT-01][P0][AC1] VAT rounds once per (VatType, rateBp) and same-category splitting is invariant", () => {
    const aggregate = requireFunction("aggregateDocumentVat");
    const reconcile = requireFunction("computeReconciledDocumentTotals");

    const unsplitRows = [standard(2), { ...standard(10_000), id: "reduced", vatType: "REDUCED_VAT", rateBp: 1200 }];
    const splitRows = [standard(1, { id: "split-a" }), standard(1, { id: "split-b" }), { ...standard(10_000), id: "reduced", vatType: "REDUCED_VAT", rateBp: 1200 }];

    const unsplitVat = okValue<{ categories: readonly Record<string, unknown>[]; vatOre: number }>(
      aggregate({ rows: unsplitRows }),
    );
    const splitVat = okValue<{ categories: readonly Record<string, unknown>[]; vatOre: number }>(
      aggregate({ rows: splitRows }),
    );

    assert.deepEqual(splitVat, unsplitVat, "same-category line splitting must not change category/document VAT");
    assert.deepEqual(unsplitVat.categories[0], {
      vatType: "STANDARD_VAT_25",
      rateBp: 2500,
      netOre: 2,
      vatOre: 1,
      grossOre: 3,
    });

    const a = okValue<Record<string, unknown>>(reconcile({ rows: unsplitRows }));
    const b = okValue<Record<string, unknown>>(reconcile({ rows: splitRows }));
    for (const key of ["netOre", "vatOre", "grossOre", "deductionBasisOre", "deductionOre", "payableOre"]) {
      assert.equal(b[key], a[key], `${key} must be split invariant`);
    }
  });

  test("[10.6-UNIT-02][P0][AC2] visibility, invoice inclusion, and deduction classification are independent", () => {
    assert.deepEqual(
      surface.DEDUCTION_CLASSIFICATIONS,
      [
        "NONE",
        "ROT_LABOR",
        "GREEN_SOLAR_LABOR",
        "GREEN_SOLAR_MATERIAL",
        "GREEN_STORAGE_LABOR",
        "GREEN_STORAGE_MATERIAL",
        "GREEN_CHARGING_LABOR",
        "GREEN_CHARGING_MATERIAL",
      ],
      "the canonical classification domain is exact and closed",
    );
    const reconcile = requireFunction("computeReconciledDocumentTotals");
    const hiddenIncluded = standard(10_000, {
      id: "hidden-included-labor",
      isHidden: true,
      deductionClassification: "ROT_LABOR",
    });
    const visibleExcluded = standard(20_000, {
      id: "visible-excluded-green",
      includedInInvoiceTotal: false,
      deductionClassification: "GREEN_SOLAR_MATERIAL",
    });
    const base = okValue<Record<string, unknown>>(reconcile({ rows: [hiddenIncluded, visibleExcluded] }));
    const visible = okValue<Record<string, unknown>>(reconcile({ rows: [{ ...hiddenIncluded, isHidden: false }, visibleExcluded] }));
    assert.equal(visible.netOre, base.netOre, "visibility alone cannot change economic totals");
    assert.equal(visible.vatOre, base.vatOre, "visibility alone cannot change VAT");
    assert.equal(base.netOre, 10_000, "excluded rows count nowhere in customer totals");
    assert.equal(base.rotBasisNetOre, 10_000, "hidden billable ROT labor remains eligible");
    assert.equal(base.greenBasisNetOre, 0, "excluded green material feeds no deduction basis");
  });

  test("[10.6-UNIT-02][P0][AC2] impossible summary-kind/classification pairs fail closed", () => {
    const aggregate = requireFunction("aggregateDocumentVat");
    assert.equal(
      errorCode(aggregate({
        rows: [standard(10_000, {
          summaryCategory: "material",
          deductionClassification: "ROT_LABOR",
        })],
      })),
      "INVALID_DEDUCTION_CLASSIFICATION",
    );
    assert.equal(
      errorCode(aggregate({
        rows: [standard(10_000, {
          summaryCategory: "other",
          deductionClassification: "GREEN_CHARGING_MATERIAL",
        })],
      })),
      "INVALID_DEDUCTION_CLASSIFICATION",
    );
  });

  test("[10.6-UNIT-02][P0][AC2/AC4/AC5] every deduction class feeds only its exact answer bucket", () => {
    const cases = [
      { classification: "NONE", summary: "other", choice: "NONE", greenCategory: null },
      { classification: "ROT_LABOR", summary: "labor", choice: "ROT", greenCategory: null },
      { classification: "GREEN_SOLAR_LABOR", summary: "labor", choice: "GREEN", greenCategory: "SOLAR" },
      { classification: "GREEN_SOLAR_MATERIAL", summary: "material", choice: "GREEN", greenCategory: "SOLAR" },
      { classification: "GREEN_STORAGE_LABOR", summary: "labor", choice: "GREEN", greenCategory: "STORAGE" },
      { classification: "GREEN_STORAGE_MATERIAL", summary: "material", choice: "GREEN", greenCategory: "STORAGE" },
      { classification: "GREEN_CHARGING_LABOR", summary: "labor", choice: "GREEN", greenCategory: "CHARGING" },
      { classification: "GREEN_CHARGING_MATERIAL", summary: "material", choice: "GREEN", greenCategory: "CHARGING" },
    ] as const;

    for (const entry of cases) {
      const parsed = money.parseTaxInputSnapshot({
        schemaVersion: 2,
        documentVatType: "STANDARD_VAT_25",
        buyerVatNumber: null,
        deductionChoice: entry.choice,
        paymentDate: entry.choice === "ROT" ? "2027-02-03" : null,
        finalPaymentDate: entry.choice === "GREEN" ? "2028-04-05" : null,
        personAllowanceSlots: entry.choice === "NONE"
          ? []
          : [{
              slot: "declared_slot",
              ...(entry.choice === "ROT"
                ? {
                    remainingRotAllowanceOre: 5_000_000,
                    remainingCombinedRotRutAllowanceOre: 7_500_000,
                  }
                : { remainingGreenAllowanceOre: 5_000_000 }),
            }],
        greenBasisMethod: "ACTUAL_ELIGIBLE_COSTS",
        genuineFixedPrice: false,
        fixedPriceOre: null,
        fixedPriceCategorySplitOre: null,
      });
      assert.equal(parsed.ok, true, entry.classification);
      if (!parsed.ok) continue;
      const answer = money.buildTaxAnswerSnapshotV2({
        rows: [standard(10_000, {
          deductionClassification: entry.classification,
          summaryCategory: entry.summary,
        }) as money.DocumentVatRowInput],
        taxInput: parsed.value,
        quoteCaptureDate: "2026-01-02",
      });
      assert.equal(answer.ok, true, entry.classification);
      if (!answer.ok) continue;
      assert.equal(answer.value.netByDeductionClassification[entry.classification], 10_000);
      assert.equal(answer.value.vatByDeductionClassification[entry.classification], 2_500);
      assert.equal(answer.value.summaries[entry.summary].grossOre, 12_500);
      if (entry.classification === "ROT_LABOR") {
        assert.equal(answer.value.rot.basisOre, 12_500);
        assert.equal(answer.value.green.calculatedOre, 0);
      } else if (entry.greenCategory !== null) {
        assert.equal(answer.value.green.categories[entry.greenCategory].basisOre, 12_500);
        assert.equal(answer.value.rot.basisOre, 0);
      } else {
        assert.equal(answer.value.calculatedDeductionOre, 0);
      }
    }
  });

  test("[10.6-UNIT-03][P0][AC1/AC4] category VAT allocation reconciles by canonical largest remainder", () => {
    const allocate = requireFunction("allocateCategoryVatByDeductionClassification");
    const first = okValue<Record<string, number>>(
      allocate({
        vatOre: 1,
        buckets: [
          { deductionClassification: "ROT_LABOR", netOre: 2 },
          { deductionClassification: "NONE", netOre: 2 },
        ],
      }),
    );
    const reversed = okValue<Record<string, number>>(
      allocate({
        vatOre: 1,
        buckets: [
          { deductionClassification: "NONE", netOre: 2 },
          { deductionClassification: "ROT_LABOR", netOre: 2 },
        ],
      }),
    );
    assert.deepEqual(first, reversed, "input order must not change canonical tie-breaking");
    assert.deepEqual(first, { NONE: 1, ROT_LABOR: 0 });
    assert.equal(Object.values(first).reduce((sum, value) => sum + value, 0), 1);
  });

  test("[10.6-UNIT-04][P0][AC4] claims truncate to whole SEK and date-window/person allocation fails loud", () => {
    const truncate = requireFunction("truncateClaimToWholeSekOre");
    const resolvePolicy = requireFunction("resolveTaxPolicy");
    const allocate = requireFunction("allocateWholeSekClaimByPerson");

    assert.equal(truncate(12_399), 12_300);
    assert.equal(truncate(99), 0);
    assert.equal(truncate(100), 100);

    const registry = [
      { id: "tax-2025", validFrom: "2025-01-01", validTo: "2026-01-01" },
      { id: "tax-2026", validFrom: "2026-01-01", validTo: "2027-01-01" },
    ];
    assert.equal(okValue<{ id: string }>(resolvePolicy({ registry, effectiveDate: "2026-01-01" })).id, "tax-2026");
    assert.equal(errorCode(resolvePolicy({ registry: [registry[0], { ...registry[1], validFrom: "2025-12-31" }], effectiveDate: "2025-12-31" })), "TAX_POLICY_OVERLAP");
    assert.equal(errorCode(resolvePolicy({ registry: [registry[0], { ...registry[1], validFrom: "2026-01-02" }], effectiveDate: "2026-01-01" })), "TAX_POLICY_GAP");

    const allocation = okValue<{ appliedOre: number; allocations: readonly { slot: string; ore: number }[] }>(
      allocate({
        candidateClaimOre: 6_000_099,
        perPersonCapOre: 5_000_000,
        combinedRotRutCapOre: 7_500_000,
        persons: [
          { slot: "PERSON_1", remainingAllowanceOre: 4_000_000 },
          { slot: "PERSON_2", remainingAllowanceOre: 2_000_000 },
        ],
      }),
    );
    assert.equal(allocation.appliedOre, 6_000_000);
    assert.equal(allocation.allocations.reduce((sum, item) => sum + item.ore, 0), allocation.appliedOre);
    assert.ok(allocation.allocations.every((item) => item.ore % 100 === 0));
  });

  test("[10.6-UNIT-04][P0][AC4] frozen person allocation preserves explicit input slot order", () => {
    const parsed = money.parseTaxInputSnapshot({
      schemaVersion: 2,
      documentVatType: "STANDARD_VAT_25",
      buyerVatNumber: null,
      deductionChoice: "ROT",
      paymentDate: "2026-08-05",
      finalPaymentDate: null,
      personAllowanceSlots: [
        {
          slot: "slot_z_first",
          remainingRotAllowanceOre: 10_000,
          remainingCombinedRotRutAllowanceOre: 10_000,
        },
        {
          slot: "slot_a_second",
          remainingRotAllowanceOre: 10_000,
          remainingCombinedRotRutAllowanceOre: 10_000,
        },
      ],
      greenBasisMethod: "ACTUAL_ELIGIBLE_COSTS",
      genuineFixedPrice: false,
      fixedPriceOre: null,
      fixedPriceCategorySplitOre: null,
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const answer = money.buildTaxAnswerSnapshotV2({
      rows: [{
        id: "ordered-allocation",
        netOre: 40_100,
        vatType: "STANDARD_VAT_25",
        rateBp: 2_500,
        includedInInvoiceTotal: true,
        deductionClassification: "ROT_LABOR",
      }],
      taxInput: parsed.value,
      quoteCaptureDate: "2026-08-05",
    });
    assert.equal(answer.ok, true);
    if (!answer.ok) return;
    assert.deepEqual(answer.value.rot.allocations, [
      { slot: "slot_z_first", ore: 10_000 },
      { slot: "slot_a_second", ore: 5_000 },
    ]);
  });

  test("[10.6-UNIT-05][P0][AC5] green bases default to actual costs; 97% is explicit; disjoint ROT+green is allowed", () => {
    const estimate = requireFunction("estimateClassifiedDeductions");
    const actual = okValue<Record<string, unknown>>(
      estimate({
        parts: [
          { id: "solar", classification: "GREEN_SOLAR_MATERIAL", eligibleCostOre: 100_000 },
          { id: "storage", classification: "GREEN_STORAGE_MATERIAL", eligibleCostOre: 100_000 },
          { id: "charging", classification: "GREEN_CHARGING_LABOR", eligibleCostOre: 100_000 },
        ],
        effectiveDate: "2026-08-05",
      }),
    );
    assert.equal(actual.basisMethod, "ACTUAL_ELIGIBLE_COSTS");
    assert.equal(actual.greenSolarDeductionOre, 15_000);
    assert.equal(actual.greenStorageDeductionOre, 50_000);
    assert.equal(actual.greenChargingDeductionOre, 50_000);

    assert.equal(
      errorCode(estimate({ basisMethod: "FIXED_PRICE_97_PERCENT", genuineFixedPrice: false, fixedPriceOre: 100_000 })),
      "FIXED_PRICE_97_REQUIRES_GENUINE_FIXED_PRICE",
    );
    assert.equal(
      errorCode(estimate({ parts: [{ id: "same-part", classification: "ROT_LABOR", greenClassification: "GREEN_SOLAR_LABOR", eligibleCostOre: 100_000 }] })),
      "DOUBLE_DEDUCTION_FEED",
    );
  });

  test("[10.6-UNIT-06][P0][AC3] reverse charge is explicit and zero rate never infers it", () => {
    const vatTypes = surface.VAT_TYPES;
    assert.ok(Array.isArray(vatTypes), "Story 10.6 requires one canonical VAT_TYPES authority");
    assert.ok(vatTypes.includes("STANDARD_VAT_25"));
    assert.ok(vatTypes.includes("REVERSE_CHARGE_CONSTRUCTION"));

    const aggregate = requireFunction("aggregateDocumentVat");
    const mixed = okValue<{ netOre: number; vatOre: number; grossOre: number; categories: readonly Record<string, unknown>[] }>(
      aggregate({
        rows: [
          standard(10_000),
          standard(20_000, { id: "reverse", vatType: "REVERSE_CHARGE_CONSTRUCTION", rateBp: 0 }),
        ],
      }),
    );
    assert.deepEqual({ netOre: mixed.netOre, vatOre: mixed.vatOre, grossOre: mixed.grossOre }, { netOre: 30_000, vatOre: 2_500, grossOre: 32_500 });
    assert.equal(mixed.categories.length, 2, "reverse charge remains a distinct VAT category at rate zero");
    const ordinaryZero = okValue<{ categories: readonly Record<string, unknown>[] }>(
      aggregate({ rows: [standard(10_000, { rateBp: 0 })] }),
    );
    assert.equal(ordinaryZero.categories[0]?.vatType, "STANDARD_VAT_25");
    assert.equal(ordinaryZero.categories[0]?.vatOre, 0);
    const reverseAtUnderlyingRate = okValue<{ categories: readonly Record<string, unknown>[] }>(
      aggregate({
        rows: [standard(10_000, { vatType: "REVERSE_CHARGE_CONSTRUCTION", rateBp: 2_500 })],
      }),
    );
    assert.deepEqual(reverseAtUnderlyingRate.categories[0], {
      vatType: "REVERSE_CHARGE_CONSTRUCTION",
      rateBp: 2_500,
      netOre: 10_000,
      vatOre: 0,
      grossOre: 10_000,
    });
  });

  test("[10.6-UNIT-07][P0][AC4/AC5] exact rational claims truncate only at the final whole-SEK boundary", () => {
    const estimate = requireFunction("estimateClassifiedDeductions");
    const rot = okValue<Record<string, number | string>>(
      estimate({
        effectiveDate: "2026-08-05",
        parts: [{ id: "rot-small", classification: "ROT_LABOR", eligibleCostOre: 333 }],
      }),
    );
    assert.equal(rot.rotDeductionOre, 0, "99.9 öre is discarded, never rounded to one krona");

    const fixed = okValue<Record<string, number | string>>(
      estimate({
        effectiveDate: "2026-08-05",
        basisMethod: "FIXED_PRICE_97_PERCENT",
        genuineFixedPrice: true,
        fixedPriceOre: 1_375,
        fixedPriceCategorySplitOre: { SOLAR: 1_375, STORAGE: 0, CHARGING: 0 },
      }),
    );
    assert.equal(fixed.greenSolarDeductionOre, 200, "the 97% basis is not itself truncated");
  });

  test("[10.6-UNIT-08][P0][AC1/AC4] large safe operands use exact category VAT arithmetic", () => {
    const aggregate = requireFunction("aggregateDocumentVat");
    const result = okValue<{ vatOre: number }>(
      aggregate({
        rows: [standard(1_000_000_000_000_015, { rateBp: 333 })],
      }),
    );
    assert.equal(result.vatOre, 33_300_000_000_000);
  });

  test("[10.6-UNIT-09][P0][AC4/AC5] the finalized answer composes disjoint ROT and green through payable", () => {
    const build = requireFunction("buildTaxAnswerSnapshotV2");
    const result = okValue<{
      claimDeductionOre: number;
      payableOre: number;
      vatPolicy: {
        resolvingDate: string;
        resolvingFact: string;
        values: { vat: { standardRateBp: number } };
      };
      summaries: {
        labor: { netOre: number; vatOre: number; grossOre: number };
        material: { netOre: number; vatOre: number; grossOre: number };
        other: { netOre: number; vatOre: number; grossOre: number };
      };
      rot: {
        claimOre: number;
        allocations: readonly { slot: string; ore: number }[];
        policy: { values: { rot: { rateBp: number; maxPerPersonYearOre: number; combinedRotRutMaxPerPersonYearOre: number } } };
      };
      green: {
        claimOre: number;
        allocations: readonly { slot: string; ore: number }[];
        policy: { values: { green: { rateBpByCategory: { SOLAR: number; STORAGE: number; CHARGING: number }; maxPerPersonYearOre: number; defaultBasisMethod: string; fixedPriceEligibleShareBp: number } } };
      };
    }>(
      build({
        quoteCaptureDate: "2026-08-05",
        rows: [
          standard(100_000, {
            id: "rot",
            deductionClassification: "ROT_LABOR",
            summaryCategory: "labor",
          }),
          standard(200_000, {
            id: "solar",
            deductionClassification: "GREEN_SOLAR_MATERIAL",
            summaryCategory: "material",
          }),
        ],
        taxInput: {
          schemaVersion: 2,
          documentVatType: "STANDARD_VAT_25",
          buyerVatNumber: null,
          deductionChoice: "ROT_AND_GREEN",
          paymentDate: "2026-08-05",
          finalPaymentDate: "2026-08-05",
          personAllowanceSlots: [
            {
              slot: "PERSON_1",
              remainingRotAllowanceOre: 5_000_000,
              remainingCombinedRotRutAllowanceOre: 7_500_000,
              remainingGreenAllowanceOre: 5_000_000,
            },
          ],
          greenBasisMethod: "ACTUAL_ELIGIBLE_COSTS",
          genuineFixedPrice: false,
          fixedPriceOre: null,
          fixedPriceCategorySplitOre: null,
        },
      }),
    );
    assert.equal(result.rot.claimOre, 37_500);
    assert.equal(result.green.claimOre, 37_500);
    assert.equal(result.claimDeductionOre, 75_000);
    assert.equal(result.payableOre, 300_000);
    assert.equal(result.rot.allocations[0]?.ore, 37_500);
    assert.equal(result.green.allocations[0]?.ore, 37_500);
    assert.deepEqual(
      {
        resolvingDate: result.vatPolicy.resolvingDate,
        resolvingFact: result.vatPolicy.resolvingFact,
        standardRateBp: result.vatPolicy.values.vat.standardRateBp,
      },
      {
        resolvingDate: "2026-08-05",
        resolvingFact: "QUOTE_CAPTURE_DATE",
        standardRateBp: 2_500,
      },
    );
    assert.deepEqual(result.rot.policy.values.rot, {
      rateBp: 3000,
      maxPerPersonYearOre: 5_000_000,
      combinedRotRutMaxPerPersonYearOre: 7_500_000,
    });
    assert.deepEqual(result.green.policy.values.green, {
      rateBpByCategory: { SOLAR: 1500, STORAGE: 5000, CHARGING: 5000 },
      maxPerPersonYearOre: 5_000_000,
      defaultBasisMethod: "ACTUAL_ELIGIBLE_COSTS",
      fixedPriceEligibleShareBp: 9700,
    });
    assert.deepEqual(result.summaries, {
      labor: { netOre: 100_000, vatOre: 25_000, grossOre: 125_000 },
      material: { netOre: 200_000, vatOre: 50_000, grossOre: 250_000 },
      other: { netOre: 0, vatOre: 0, grossOre: 0 },
    });
  });

  test("[10.6-UNIT-09][P0][AC4] each product freezes its own resolving date authority", () => {
    const parsed = money.parseTaxInputSnapshot({
      schemaVersion: 2,
      documentVatType: "STANDARD_VAT_25",
      buyerVatNumber: null,
      deductionChoice: "ROT_AND_GREEN",
      paymentDate: "2027-02-03",
      finalPaymentDate: "2028-04-05",
      personAllowanceSlots: [{
        slot: "dated_slot",
        remainingRotAllowanceOre: 5_000_000,
        remainingCombinedRotRutAllowanceOre: 7_500_000,
        remainingGreenAllowanceOre: 5_000_000,
      }],
      greenBasisMethod: "ACTUAL_ELIGIBLE_COSTS",
      genuineFixedPrice: false,
      fixedPriceOre: null,
      fixedPriceCategorySplitOre: null,
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const answer = money.buildTaxAnswerSnapshotV2({
      quoteCaptureDate: "2026-01-02",
      rows: [
        standard(10_000, {
          deductionClassification: "ROT_LABOR",
          summaryCategory: "labor",
        }) as money.DocumentVatRowInput,
        standard(10_000, {
          id: "dated-green",
          deductionClassification: "GREEN_SOLAR_MATERIAL",
          summaryCategory: "material",
        }) as money.DocumentVatRowInput,
      ],
      taxInput: parsed.value,
    });
    assert.equal(answer.ok, true);
    if (!answer.ok) return;
    assert.deepEqual(
      [answer.value.vatPolicy.resolvingFact, answer.value.vatPolicy.resolvingDate],
      ["QUOTE_CAPTURE_DATE", "2026-01-02"],
    );
    assert.deepEqual(
      [answer.value.rot.policy?.resolvingFact, answer.value.rot.policy?.resolvingDate],
      ["ROT_PAYMENT_DATE", "2027-02-03"],
    );
    assert.deepEqual(
      [answer.value.green.policy?.resolvingFact, answer.value.green.policy?.resolvingDate],
      ["GREEN_FINAL_PAYMENT_DATE", "2028-04-05"],
    );
  });

  test("[10.6-UNIT-10][P0][AC3/AC4] finalized answers fail closed on reverse-charge metadata and allowance", () => {
    const build = requireFunction("buildTaxAnswerSnapshotV2");
    const baseTaxInput = {
      schemaVersion: 2,
      documentVatType: "REVERSE_CHARGE_CONSTRUCTION",
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
    assert.equal(
      errorCode(
        build({
          quoteCaptureDate: "2026-08-05",
          rows: [standard(100_000, { vatType: "REVERSE_CHARGE_CONSTRUCTION", rateBp: 0 })],
          taxInput: baseTaxInput,
        }),
      ),
      "MISSING_BUYER_VAT_NUMBER",
    );
    assert.equal(
      errorCode(
        build({
          quoteCaptureDate: "2026-08-05",
          rows: [standard(100_000)],
          taxInput: {
            ...baseTaxInput,
            buyerVatNumber: "SE556677889901",
          },
        }),
      ),
      "REVERSE_CHARGE_SELECTION_MISMATCH",
    );

    assert.equal(
      errorCode(
        build({
          quoteCaptureDate: "2026-08-05",
          rows: [standard(100_000_000, { deductionClassification: "GREEN_SOLAR_MATERIAL" })],
          taxInput: {
            ...baseTaxInput,
            documentVatType: "STANDARD_VAT_25",
            deductionChoice: "GREEN",
            finalPaymentDate: "2026-08-05",
            personAllowanceSlots: [{ slot: "PERSON_1", remainingGreenAllowanceOre: 5_000_000 }],
          },
        }),
      ),
      "INSUFFICIENT_PERSON_ALLOWANCE",
    );
  });

  test("[10.6-UNIT-11][P0][AC4] labor/material/other summaries follow row economics, not deduction eligibility", () => {
    const build = requireFunction("buildTaxAnswerSnapshotV2");
    const result = okValue<{
      summaries: {
        labor: { netOre: number; vatOre: number; grossOre: number };
        material: { netOre: number; vatOre: number; grossOre: number };
        other: { netOre: number; vatOre: number; grossOre: number };
      };
    }>(
      build({
        quoteCaptureDate: "2026-08-05",
        rows: [
          standard(2, { id: "plain-labor", summaryCategory: "labor" }),
          standard(2, { id: "plain-material", summaryCategory: "material" }),
        ],
        taxInput: {
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
        },
      }),
    );
    assert.deepEqual(result.summaries, {
      labor: { netOre: 2, vatOre: 1, grossOre: 3 },
      material: { netOre: 2, vatOre: 0, grossOre: 2 },
      other: { netOre: 0, vatOre: 0, grossOre: 0 },
    });
  });

  test("[10.6-UNIT-12][P0][AC5] fixed-price green splits reconcile to green-classified work and cannot overlap ROT", () => {
    const build = requireFunction("buildTaxAnswerSnapshotV2");
    const fixedTaxInput = {
      schemaVersion: 2,
      documentVatType: "STANDARD_VAT_25",
      buyerVatNumber: null,
      deductionChoice: "GREEN",
      paymentDate: null,
      finalPaymentDate: "2026-08-05",
      personAllowanceSlots: [
        { slot: "PERSON_GREEN", remainingGreenAllowanceOre: 5_000_000 },
      ],
      greenBasisMethod: "FIXED_PRICE_97_PERCENT",
      genuineFixedPrice: true,
      fixedPriceOre: 1_375,
      fixedPriceCategorySplitOre: { SOLAR: 1_375, STORAGE: 0, CHARGING: 0 },
    };
    const answer = okValue<{
      green: { categories: { SOLAR: { basisOre: number; calculatedOre: number; claimOre: number } } };
      payableOre: number;
    }>(build({
      quoteCaptureDate: "2026-08-05",
      rows: [standard(1_100, {
        id: "fixed-solar",
        deductionClassification: "GREEN_SOLAR_MATERIAL",
        summaryCategory: "material",
      })],
      taxInput: fixedTaxInput,
    }));
    assert.deepEqual(answer.green.categories.SOLAR, {
      category: "SOLAR",
      basisOre: 1_333,
      calculatedOre: 200,
      claimOre: 200,
    });
    assert.equal(answer.payableOre, 1_175);

    assert.equal(
      errorCode(build({
        quoteCaptureDate: "2026-08-05",
        rows: [standard(1_100, {
          id: "rot-cannot-feed-fixed-green",
          deductionClassification: "ROT_LABOR",
          summaryCategory: "labor",
        })],
        taxInput: {
          ...fixedTaxInput,
          deductionChoice: "ROT_AND_GREEN",
          paymentDate: "2026-08-05",
          personAllowanceSlots: [{
            slot: "PERSON_BOTH",
            remainingRotAllowanceOre: 5_000_000,
            remainingCombinedRotRutAllowanceOre: 7_500_000,
            remainingGreenAllowanceOre: 5_000_000,
          }],
        },
      })),
      "FIXED_PRICE_CLASSIFICATION_MISMATCH",
    );
  });
});
