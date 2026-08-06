import assert from "node:assert/strict";
import { describe, test } from "node:test";

import * as money from "@/lib/money";

type UnknownFunction = (...args: never[]) => unknown;

function requireFunction(name: string): UnknownFunction {
  const value = (money as Record<string, unknown>)[name];
  assert.equal(
    typeof value,
    "function",
    `Story 10.6 Task 1 requires the canonical ${name} export`,
  );
  return value as UnknownFunction;
}

function okValue<T>(result: unknown): T {
  assert.equal(typeof result, "object");
  assert.notEqual(result, null);
  const typed = result as { readonly ok?: unknown; readonly value?: unknown };
  assert.equal(typed.ok, true, `expected success, got ${JSON.stringify(result)}`);
  assert.ok("value" in typed, "a successful result must carry value");
  return typed.value as T;
}

function errorCode(result: unknown): string {
  assert.equal(typeof result, "object");
  assert.notEqual(result, null);
  const typed = result as { readonly ok?: unknown; readonly code?: unknown };
  assert.equal(typed.ok, false, `expected failure, got ${JSON.stringify(result)}`);
  assert.equal(typeof typed.code, "string");
  return typed.code as string;
}

describe("Story 10.6 Task 1 — canonical tax domain and policy authority", () => {
  test("exports the exact closed tax domains from one runtime authority", () => {
    assert.deepEqual(money.VAT_TYPES, [
      "STANDARD_VAT_25",
      "REDUCED_VAT",
      "ZERO_RATED",
      "REVERSE_CHARGE_CONSTRUCTION",
    ]);
    assert.deepEqual(money.DEDUCTION_CLASSIFICATIONS, [
      "NONE",
      "ROT_LABOR",
      "GREEN_SOLAR_LABOR",
      "GREEN_SOLAR_MATERIAL",
      "GREEN_STORAGE_LABOR",
      "GREEN_STORAGE_MATERIAL",
      "GREEN_CHARGING_LABOR",
      "GREEN_CHARGING_MATERIAL",
    ]);
    assert.deepEqual(money.GREEN_CATEGORIES, ["SOLAR", "STORAGE", "CHARGING"]);
    assert.deepEqual(money.GREEN_BASIS_METHODS, [
      "ACTUAL_ELIGIBLE_COSTS",
      "FIXED_PRICE_97_PERCENT",
    ]);

    const isVatType = requireFunction("isVatType");
    const isClassification = requireFunction("isDeductionClassification");
    assert.equal(isVatType("ZERO_RATED" as never), true);
    assert.equal(isVatType("REVERSE_CHARGE_CONSTRUCTION" as never), true);
    assert.equal(isVatType("NOT_A_VAT_TYPE" as never), false);
    assert.equal(isClassification("ROT_LABOR" as never), true);
    assert.equal(isClassification("ROT_MATERIAL" as never), false);
  });

  test("resolves the immutable ratified 2026 profile with every policy value", () => {
    const resolveTaxPolicy = requireFunction("resolveTaxPolicy");
    const registry = (money as Record<string, unknown>).TAX_POLICY_REGISTRY;
    assert.ok(Array.isArray(registry), "the system policy registry must be a runtime export");
    assert.equal(Object.isFrozen(registry), true, "the registry array is immutable");

    const policy = okValue<Record<string, unknown>>(
      resolveTaxPolicy({ registry, effectiveDate: "2026-08-05" } as never),
    );
    assert.deepEqual(policy, {
      id: "SE-TAX-2026-v1",
      validFrom: "2026-01-01",
    validTo: "2027-01-01",
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
    });
    assert.equal(Object.isFrozen(policy), true);
    assert.equal(Object.isFrozen(policy.vat), true);
    assert.equal(Object.isFrozen(policy.rot), true);
    assert.equal(Object.isFrozen(policy.green), true);
    assert.equal(
      Object.isFrozen((policy.green as { rateBpByCategory: object }).rateBpByCategory),
      true,
    );
  });

  test("uses inclusive validFrom and exclusive validTo boundaries without reading a clock", () => {
    const resolveTaxPolicy = requireFunction("resolveTaxPolicy");
    const registry = [
      { id: "p1", validFrom: "2025-01-01", validTo: "2026-01-01" },
      { id: "p2", validFrom: "2026-01-01", validTo: null },
    ];

    assert.equal(
      okValue<{ id: string }>(
        resolveTaxPolicy({ registry, effectiveDate: "2025-12-31" } as never),
      ).id,
      "p1",
    );
    assert.equal(
      okValue<{ id: string }>(
        resolveTaxPolicy({ registry, effectiveDate: "2026-01-01" } as never),
      ).id,
      "p2",
    );
  });

  test("validates the complete registry and fails typed on invalid dates, overlap, and gap", () => {
    const resolveTaxPolicy = requireFunction("resolveTaxPolicy");
    const valid = [
      { id: "p1", validFrom: "2025-01-01", validTo: "2026-01-01" },
      { id: "p2", validFrom: "2026-01-01", validTo: "2027-01-01" },
      { id: "p3", validFrom: "2027-01-01", validTo: null },
    ];

    assert.equal(
      errorCode(resolveTaxPolicy({ registry: valid, effectiveDate: "2026-02-30" } as never)),
      "TAX_POLICY_INVALID_DATE",
    );
    assert.equal(
      errorCode(
        resolveTaxPolicy({
          registry: [{ ...valid[0], validFrom: "2025/01/01" }, valid[1], valid[2]],
          effectiveDate: "2026-06-01",
        } as never),
      ),
      "TAX_POLICY_INVALID_DATE",
    );
    assert.equal(
      errorCode(
        resolveTaxPolicy({
          registry: [{ ...valid[0], validTo: "2025-01-01" }, valid[1], valid[2]],
          effectiveDate: "2026-06-01",
        } as never),
      ),
      "TAX_POLICY_INVALID_DATE",
    );
    assert.equal(
      errorCode(
        resolveTaxPolicy({
          registry: [valid[0], valid[1], { ...valid[2], validFrom: "2026-12-31" }],
          effectiveDate: "2025-06-01",
        } as never),
      ),
      "TAX_POLICY_OVERLAP",
      "an overlap outside the effective window still invalidates the complete registry",
    );
    assert.equal(
      errorCode(
        resolveTaxPolicy({
          registry: [valid[0], valid[1], { ...valid[2], validFrom: "2027-01-02" }],
          effectiveDate: "2025-06-01",
        } as never),
      ),
      "TAX_POLICY_GAP",
      "a gap outside the effective window still invalidates the complete registry",
    );
  });

  test("fails typed when no policy matches an otherwise coherent registry", () => {
    const resolveTaxPolicy = requireFunction("resolveTaxPolicy");
    const registry = [
      { id: "p1", validFrom: "2025-01-01", validTo: "2026-01-01" },
      { id: "p2", validFrom: "2026-01-01", validTo: "2027-01-01" },
    ];
    assert.equal(
      errorCode(resolveTaxPolicy({ registry, effectiveDate: "2024-12-31" } as never)),
      "TAX_POLICY_NO_MATCH",
    );
    assert.equal(
      errorCode(resolveTaxPolicy({ registry, effectiveDate: "2027-01-01" } as never)),
      "TAX_POLICY_NO_MATCH",
    );
    assert.equal(
      errorCode(resolveTaxPolicy({ registry: [], effectiveDate: "2026-01-01" } as never)),
      "TAX_POLICY_NO_MATCH",
    );
  });

  test("truncates a claim downward to whole SEK through a separately named primitive", () => {
    const truncate = requireFunction("truncateClaimToWholeSekOre");
    assert.equal(truncate(12_399 as never), 12_300);
    assert.equal(truncate(99 as never), 0);
    assert.equal(truncate(100 as never), 100);
    assert.equal(truncate(6_000_099 as never), 6_000_000);
    assert.equal(truncate(Number.NaN as never), null, "invalid money never launders into zero");
  });

  test("allocates a truncated claim greedily in stable slot order and respects every cap", () => {
    const allocate = requireFunction("allocateWholeSekClaimByPerson");
    const result = okValue<{
      readonly appliedOre: number;
      readonly allocations: readonly { readonly slot: string; readonly ore: number }[];
    }>(
      allocate({
        candidateClaimOre: 6_000_099,
        perPersonCapOre: 5_000_000,
        combinedRotRutCapOre: 7_500_000,
        persons: [
          { slot: "PERSON_1", remainingAllowanceOre: 4_000_099 },
          { slot: "PERSON_2", remainingAllowanceOre: 2_500_000 },
        ],
      } as never),
    );

    assert.deepEqual(result, {
      appliedOre: 6_000_000,
      allocations: [
        { slot: "PERSON_1", ore: 4_000_000 },
        { slot: "PERSON_2", ore: 2_000_000 },
      ],
    });
    assert.equal(result.allocations.reduce((sum, item) => sum + item.ore, 0), result.appliedOre);
    assert.ok(result.allocations.every((item) => item.ore % 100 === 0));
    assert.equal(Object.isFrozen(result.allocations), true);
    assert.ok(result.allocations.every(Object.isFrozen));
  });

  test("applies a customer-declared remaining combined ROT/RUT allowance per person", () => {
    const allocate = requireFunction("allocateWholeSekClaimByPerson");
    const result = okValue<{
      readonly appliedOre: number;
      readonly allocations: readonly { readonly slot: string; readonly ore: number }[];
    }>(
      allocate({
        candidateClaimOre: 2_500_000,
        perPersonCapOre: 5_000_000,
        combinedRotRutCapOre: 7_500_000,
        persons: [
          {
            slot: "PERSON_1",
            remainingAllowanceOre: 5_000_000,
            remainingCombinedRotRutAllowanceOre: 1_500_000,
          },
          {
            slot: "PERSON_2",
            remainingAllowanceOre: 5_000_000,
            remainingCombinedRotRutAllowanceOre: 1_000_000,
          },
        ],
      } as never),
    );
    assert.deepEqual(result.allocations, [
      { slot: "PERSON_1", ore: 1_500_000 },
      { slot: "PERSON_2", ore: 1_000_000 },
    ]);
  });

  test("fails typed instead of returning a partial allocation when declared capacity is insufficient", () => {
    const allocate = requireFunction("allocateWholeSekClaimByPerson");
    assert.equal(
      errorCode(
        allocate({
          candidateClaimOre: 2_000_000,
          perPersonCapOre: 5_000_000,
          persons: [{ slot: "PERSON_1", remainingAllowanceOre: 1_000_000 }],
        } as never),
      ),
      "INSUFFICIENT_PERSON_ALLOWANCE",
    );
  });

  test("fails typed on malformed money inputs and duplicate or empty person slots", () => {
    const allocate = requireFunction("allocateWholeSekClaimByPerson");
    assert.equal(
      errorCode(
        allocate({
          candidateClaimOre: 1_000_000.5,
          perPersonCapOre: 5_000_000,
          persons: [{ slot: "PERSON_1", remainingAllowanceOre: 1_000_000 }],
        } as never),
      ),
      "INVALID_CLAIM_ALLOCATION_INPUT",
    );
    assert.equal(
      errorCode(
        allocate({
          candidateClaimOre: 100,
          perPersonCapOre: 5_000_000,
          persons: [
            { slot: "PERSON_1", remainingAllowanceOre: 100 },
            { slot: "PERSON_1", remainingAllowanceOre: 100 },
          ],
        } as never),
      ),
      "DUPLICATE_PERSON_SLOT",
    );
    assert.equal(
      errorCode(
        allocate({
          candidateClaimOre: 100,
          perPersonCapOre: 5_000_000,
          persons: [{ slot: "", remainingAllowanceOre: 100 }],
        } as never),
      ),
      "INVALID_PERSON_SLOT",
    );
  });
});
