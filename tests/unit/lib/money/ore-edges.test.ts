/**
 * Story 4.1 — SUPPLEMENTAL edge / branch coverage for the pure `@/lib/money` engine
 * (`src/lib/money/ore.ts`). Mirrors the repo's `*-edges.test.ts` convention (e.g.
 * `money-display-edges.test.ts`, `pricing-validation-edges.test.ts`): the primary
 * `ore.test.ts` + `rounding.golden.test.ts` pin the acceptance-criteria contract; this
 * file expands coverage of the exported surfaces and branches those suites reach only
 * INDIRECTLY, so a silent regression in one of them fails loud.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB / browser / network / clock.
 *
 * Gaps closed here (not asserted, or asserted only indirectly, elsewhere):
 *   - `isQuantity` — direct boundary predicate coverage (only exercised via `lineNetOre`).
 *   - `validateQuantity` — the exported typed-result wrapper (untested elsewhere): its OK
 *     arm carries the finite value, its ERR arm carries the stable `INVALID_QUANTITY` code
 *     with no raw echo.
 *   - canonical `isOreAmount` / `ORE_AMOUNT_MAX` exported DIRECTLY from `@/lib/money`
 *     (pricing-validation exercises the RE-EXPORT; nothing pinned the canonical export or
 *     the ceiling value itself here).
 *   - TYPED-FAILURE CODE specificity — `ore.test.ts` asserts only `ok:false`; a code swap
 *     (`INVALID_QUANTITY` ⇄ `INVALID_ORE_AMOUNT` ⇄ `ORE_OVERFLOW`) would pass there. This
 *     pins WHICH code each rejection carries.
 *   - `sumOre` — a non-öre element MID-ARRAY (float / negative / string) → `INVALID_ORE_AMOUNT`;
 *     empty array → 0; a valid single element boundary.
 *   - `formatOreAsKronor` — the defensive sign / truncate branches (negative sign, non-integer
 *     truncation toward zero, `-0`, exactly `ORE_AMOUNT_MAX`) that back the pricing-UI delegate.
 *   - `roundToOre` — documented non-finite passthrough (validated callers never feed it one).
 *
 * [Source: story 4.1 Tasks 1-4 + Task 5.1; test-design-epic-4.md 4.1-UNIT-03/04/05/06 +
 *  R-401/R-402/R-413; `src/lib/money/ore.ts`.]
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ORE_AMOUNT_MAX,
  isOreAmount,
  isQuantity,
  validateQuantity,
  roundToOre,
  lineNetOre,
  sumOre,
  formatOreAsKronor,
} from "@/lib/money";
import type { MoneyErrorCode, OreResult } from "@/lib/money";

/** Narrow an OreResult err arm, asserting the exact stable code (no raw echo). */
function assertErrCode(r: OreResult, code: MoneyErrorCode, rawInput: unknown): void {
  assert.equal(r.ok, false, `expected typed failure, got ${JSON.stringify(r)}`);
  if (r.ok) return; // type guard for TS below
  assert.equal(r.code, code, `expected code ${code}, got ${r.code}`);
  const serialized = JSON.stringify(r);
  assert.ok(!/NaN|Infinity/.test(serialized), "typed failure must not leak NaN/Infinity");
  const raw = String(rawInput);
  if (raw.length > 0 && raw !== "0" && raw !== "true" && raw !== "false") {
    assert.ok(!serialized.includes(raw), `typed failure must not echo raw value ${raw}: ${serialized}`);
  }
}

// ── isQuantity — the finite non-negative decimal predicate (direct coverage) ──────
describe("isQuantity — finite non-negative decimal predicate", () => {
  test("accepts 0, integers, and fractional quantities", () => {
    for (const q of [0, 1, 5, 0.5, 1.5, 0.333, 2.25, 1000000]) {
      assert.equal(isQuantity(q), true, `expected ${q} to be a valid quantity`);
    }
  });

  test("accepts -0 (negative zero is >= 0)", () => {
    assert.equal(isQuantity(-0), true);
  });

  test("rejects negatives", () => {
    for (const q of [-1, -0.5, -1000]) {
      assert.equal(isQuantity(q), false, `expected ${q} to be rejected`);
    }
  });

  test("rejects NaN / ±Infinity", () => {
    assert.equal(isQuantity(Number.NaN), false);
    assert.equal(isQuantity(Number.POSITIVE_INFINITY), false);
    assert.equal(isQuantity(Number.NEGATIVE_INFINITY), false);
  });

  test("rejects non-numbers (string / null / undefined / object / bigint)", () => {
    for (const q of ["1.5", "0", null, undefined, {}, [], BigInt(1)]) {
      assert.equal(isQuantity(q as unknown), false, `expected ${String(q)} to be rejected`);
    }
  });
});

// ── validateQuantity — the exported typed-result wrapper (untested elsewhere) ─────
describe("validateQuantity — typed-result wrapper", () => {
  test("OK arm carries the finite non-negative value", () => {
    for (const q of [0, 1.5, 0.333, 250]) {
      const r = validateQuantity(q);
      assert.ok(r.ok, `expected ok for ${q}`);
      if (r.ok) assert.equal(r.value, q);
    }
  });

  test("ERR arm carries the stable INVALID_QUANTITY code and never echoes the raw value", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1, "1.5", null, undefined, {}]) {
      assertErrCode(validateQuantity(bad), "INVALID_QUANTITY", bad);
    }
  });

  test("never throws for hostile input", () => {
    assert.doesNotThrow(() => validateQuantity(Symbol("x") as unknown));
  });
});

// ── canonical isOreAmount / ORE_AMOUNT_MAX exported DIRECTLY from @/lib/money ─────
describe("canonical isOreAmount / ORE_AMOUNT_MAX (@/lib/money is the single source)", () => {
  test("ORE_AMOUNT_MAX is exactly Number.MAX_SAFE_INTEGER", () => {
    assert.equal(ORE_AMOUNT_MAX, Number.MAX_SAFE_INTEGER);
    assert.equal(ORE_AMOUNT_MAX, 9_007_199_254_740_991);
  });

  test("accepts the ceiling boundary (== ORE_AMOUNT_MAX) and rejects one past it", () => {
    assert.equal(isOreAmount(ORE_AMOUNT_MAX), true, "the ceiling itself is a valid öre amount");
    assert.equal(isOreAmount(ORE_AMOUNT_MAX + 1), false, "one past the ceiling is rejected");
  });

  test("accepts 0 and rejects a float / negative / string (canonical export matches the re-export)", () => {
    assert.equal(isOreAmount(0), true);
    assert.equal(isOreAmount(850.5), false);
    assert.equal(isOreAmount(-1), false);
    assert.equal(isOreAmount("85000" as unknown), false);
  });
});

// ── typed-failure CODE specificity — WHICH code each rejection carries ────────────
describe("typed-failure code specificity (a code swap fails loud)", () => {
  test("lineNetOre: a bad quantity → INVALID_QUANTITY", () => {
    assertErrCode(lineNetOre(Number.NaN, 85000), "INVALID_QUANTITY", Number.NaN);
    assertErrCode(lineNetOre(-1, 85000), "INVALID_QUANTITY", -1);
  });

  test("lineNetOre: a valid quantity but bad unit price → INVALID_ORE_AMOUNT", () => {
    assertErrCode(lineNetOre(1, 850.5), "INVALID_ORE_AMOUNT", 850.5);
    assertErrCode(lineNetOre(1, -50000), "INVALID_ORE_AMOUNT", -50000);
  });

  test("lineNetOre: quantity is validated BEFORE unit price (both invalid → INVALID_QUANTITY)", () => {
    // Ordering contract: an invalid quantity short-circuits before the unit-price check.
    assertErrCode(lineNetOre(-1, 850.5), "INVALID_QUANTITY", -1);
  });

  test("lineNetOre: a valid-input product that overflows the ceiling → ORE_OVERFLOW", () => {
    assertErrCode(lineNetOre(2, ORE_AMOUNT_MAX), "ORE_OVERFLOW", undefined);
    assertErrCode(lineNetOre(1.5, ORE_AMOUNT_MAX), "ORE_OVERFLOW", undefined);
  });

  test("sumOre: a non-öre element → INVALID_ORE_AMOUNT; a running total past the ceiling → ORE_OVERFLOW", () => {
    assertErrCode(sumOre([1, 2, 850.5]), "INVALID_ORE_AMOUNT", 850.5);
    const half = Math.floor(ORE_AMOUNT_MAX / 2) + 1;
    assertErrCode(sumOre([half, half]), "ORE_OVERFLOW", undefined);
  });
});

// ── sumOre — element-level validation, empty array, ordering ──────────────────────
describe("sumOre — element validation and empty-array identity", () => {
  test("empty array sums to 0 (additive identity)", () => {
    const r = sumOre([]);
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.value, 0);
  });

  test("a single valid element sums to itself", () => {
    const r = sumOre([85000]);
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.value, 85000);
  });

  test("rejects on the FIRST invalid element, mid-array", () => {
    for (const bad of [850.5, -1, Number.NaN, "5" as unknown, null as unknown]) {
      const r = sumOre([100, bad as number, 200]);
      assert.equal(r.ok, false, `expected rejection for mid-array element ${String(bad)}`);
    }
  });

  test("exactly ORE_AMOUNT_MAX total is accepted (boundary, not overflow)", () => {
    const r = sumOre([ORE_AMOUNT_MAX]);
    assert.ok(r.ok, "a total equal to the ceiling is valid, not an overflow");
    if (r.ok) assert.equal(r.value, ORE_AMOUNT_MAX);
  });
});

// ── formatOreAsKronor — defensive sign / truncate branches (backs the UI delegate) ─
describe("formatOreAsKronor — defensive sign / truncation branches", () => {
  test("a negative öre keeps its sign", () => {
    assert.equal(formatOreAsKronor(-85000), "-850,00");
    assert.equal(formatOreAsKronor(-1), "-0,01");
  });

  test("a non-integer öre is truncated toward zero (never a fractional / NaN string)", () => {
    assert.equal(formatOreAsKronor(1250.9), "12,50");
    assert.equal(formatOreAsKronor(1250.1), "12,50");
    assert.equal(formatOreAsKronor(-1250.9), "-12,50");
  });

  test("-0 formats as the positive zero string (no '-0,00')", () => {
    assert.equal(formatOreAsKronor(-0), "0,00");
  });

  test("the öre remainder pads to exactly two digits", () => {
    assert.equal(formatOreAsKronor(5), "0,05");
    assert.equal(formatOreAsKronor(50), "0,50");
    assert.equal(formatOreAsKronor(105), "1,05");
    assert.equal(formatOreAsKronor(100099), "1000,99");
  });

  test("formats a large valid öre value exactly (ORE_AMOUNT_MAX)", () => {
    // 9_007_199_254_740_991 öre → 90_071_992_547_409,91 kr
    assert.equal(formatOreAsKronor(ORE_AMOUNT_MAX), "90071992547409,91");
  });
});

// ── roundToOre — documented non-finite passthrough (callers validate first) ───────
describe("roundToOre — non-finite passthrough (documented; validated callers never feed one)", () => {
  test("NaN / ±Infinity pass through unchanged (returned as-is, not coerced)", () => {
    assert.ok(Number.isNaN(roundToOre(Number.NaN)));
    assert.equal(roundToOre(Number.POSITIVE_INFINITY), Number.POSITIVE_INFINITY);
    assert.equal(roundToOre(Number.NEGATIVE_INFINITY), Number.NEGATIVE_INFINITY);
  });

  test("round-half-away-from-zero holds across additional non-negative boundaries", () => {
    assert.equal(roundToOre(0.5), 1);
    assert.equal(roundToOre(1.5), 2);
    assert.equal(roundToOre(100.5), 101);
    assert.equal(roundToOre(1000000.5), 1000001);
    assert.equal(roundToOre(2.49999), 2);
    assert.equal(roundToOre(2.50001), 3);
  });
});
