/**
 * Story 10.6 acceptance contract. These tests are intentionally active before implementation:
 * every scenario asserts a missing or currently incorrect canonical behavior and must turn green
 * through product code, never through a skip/expected-failure wrapper.
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
  });
});
