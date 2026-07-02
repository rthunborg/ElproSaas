/**
 * Story 4.1 — ATDD RED-PHASE scaffold: PURE-LOGIC unit tests for the FIRST money
 * calculation engine in the repo, `@/lib/money` (architecture §22). Money is INTEGER
 * ÖRE end-to-end off the presentation boundary; kronor formatting happens ONLY at a
 * single boundary formatter. Runs under `node --test` (`pnpm run test:unit`) — pure, NO
 * DB, NO browser, NO network, NO clock read.
 *
 * 🔴 RED PHASE — `@/lib/money` does NOT exist yet (Story 4.1 dev, Tasks 1-4). Until it
 * lands, the existence gate below SKIPS the whole file so the green `test:unit` baseline
 * is UNPERTURBED (the suite does not error the runner). The dev's GREEN phase:
 *   1. creates `src/lib/money/ore.ts` (or `money.ts`) + `src/lib/money/index.ts`;
 *   2. DELETES the `MONEY_ENGINE_PRESENT` gate below and switches to a top-level
 *      `import { roundToOre, lineNetOre, sumOre, formatOreAsKronor, validateQuantity }
 *      from "@/lib/money"` (mirroring how `money-display.test.ts` went red → green);
 *   3. leaves the assertions BELOW UNCHANGED — they ARE the contract.
 *
 * Expected engine surface (the dev implements this; names may be re-exported from
 * `@/lib/money`):
 *   - roundToOre(value: number): number
 *       The SINGLE rounding primitive. Rounds a real öre value to the nearest whole öre
 *       using ROUND-HALF-AWAY-FROM-ZERO (Math.round on non-negative inputs; x.5 → x+1).
 *       Every rounding in the engine goes through this ONE function.
 *   - lineNetOre(quantity, unitPriceOre): TypedOreResult
 *       roundToOre(quantity × unitPriceOre) — LINE-LEVEL rounding. Validates BOTH inputs
 *       first (isOreAmount(unitPriceOre) + finite non-negative quantity); an invalid
 *       input returns a TYPED FAILURE (never NaN/throw). Output is a validated int öre.
 *   - sumOre(values: readonly number[]): TypedOreResult
 *       Sums ALREADY-ROUNDED int-öre line values → exact int-öre total. SUM-OF-ROUNDED,
 *       never round-of-sum. Guards the accumulator against ORE_AMOUNT_MAX overflow.
 *   - formatOreAsKronor(ore: number): string
 *       The ONLY öre→kronor string seam in the calc path. 85000 → "850,00", 1 → "0,01",
 *       0 → "0,00"; non-finite → "" (no NaN to the UI). NO business calc here.
 *   - validateQuantity(q: unknown): TypedResult  (finite, non-negative decimal)
 *
 * Typed failure shape (Task 3.1): a small typed result — { ok: true; value } |
 * { ok: false } (mirroring KronorParseResult), OR a Result<T, C> with a stable CODE.
 * The primitives NEVER throw a raw error, NEVER echo the raw invalid value, NEVER return
 * NaN/Infinity. The assertions below accept EITHER shape via `isOk`/`isErr` helpers, so
 * the dev picks the failure surface without rewriting the tests.
 *
 * Coverage → test IDs: 4.1-UNIT-01 (int-öre in/out; kr only at boundary),
 * 4.1-UNIT-02 (line net = round(qty×price); fractional qty; sum-of-rounded),
 * 4.1-UNIT-03 (invalid money rejected; no raw echo), 4.1-UNIT-04 (negative/zero/zero-qty
 * semantics), 4.1-UNIT-05 (formatting boundary; internal öre unchanged),
 * 4.1-UNIT-06 (overflow guard at ORE_AMOUNT_MAX), 4.1-UNIT-07 (P3 exploratory).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as money from "@/lib/money";

// ── GREEN PHASE (Story 4.1 dev) ──────────────────────────────────────────────────
// `@/lib/money` now exists (`src/lib/money/{index,ore}.ts`), so the engine is imported at
// the top level and the suite runs unconditionally. The red-phase existence gate + lazy
// `loadEngine()` IIFE were removed; the assertions below are UNCHANGED (they ARE the contract).

// The engine's typed-failure surface is dev's choice (KronorParseResult-style OR
// Result<T,C>). These helpers accept EITHER so the assertions do not pin the shape.
type OkLike = { ok: true } & Record<string, unknown>;
type ErrLike = { ok: false } & Record<string, unknown>;
type TypedResult = OkLike | ErrLike;

function isOk(r: unknown): r is OkLike {
  return typeof r === "object" && r !== null && (r as { ok?: unknown }).ok === true;
}
function isErr(r: unknown): r is ErrLike {
  return typeof r === "object" && r !== null && (r as { ok?: unknown }).ok === false;
}
/** Extract the öre value from an ok result regardless of field name (`value`/`ore`/`data`). */
function okOre(r: OkLike): number {
  const v = (r as Record<string, unknown>).value ?? (r as Record<string, unknown>).ore ?? (r as Record<string, unknown>).data;
  assert.equal(typeof v, "number", "ok result must carry a numeric öre value");
  return v as number;
}
/** A failure must NOT echo the raw invalid input anywhere in its serialization. */
function assertNoRawEcho(r: ErrLike, rawInput: unknown): void {
  const serialized = JSON.stringify(r);
  const raw = String(rawInput);
  // A non-trivial raw token (e.g. "850,00", "-1", "NaN") must not appear in the error.
  if (raw.length > 0 && raw !== "0" && raw !== "true" && raw !== "false") {
    assert.ok(
      !serialized.includes(raw),
      `typed failure must not echo the raw invalid value ${raw}: got ${serialized}`,
    );
  }
  assert.ok(!/NaN|Infinity/.test(serialized), "typed failure must not leak NaN/Infinity");
}

// The engine module, loaded lazily so the file parses even while it is absent.
type MoneyEngine = {
  roundToOre: (value: number) => number;
  lineNetOre: (quantity: number, unitPriceOre: number) => TypedResult;
  sumOre: (values: readonly number[]) => TypedResult;
  formatOreAsKronor: (ore: number) => string;
  validateQuantity?: (q: unknown) => TypedResult;
  ORE_AMOUNT_MAX?: number;
};

// The engine is imported at the top level; `loadEngine()` is kept as a trivial async accessor
// so the assertions below (which `await loadEngine()`) remain UNCHANGED from the red scaffold.
const engine = money as unknown as MoneyEngine;
async function loadEngine(): Promise<MoneyEngine> {
  return engine;
}

const ORE_AMOUNT_MAX = Number.MAX_SAFE_INTEGER; // mirrors @/lib/money ORE_AMOUNT_MAX

describe("Story 4.1 — @/lib/money öre-arithmetic + rounding primitives (RED → GREEN)", () => {
  // ── 4.1-UNIT-01: integer öre in → integer öre out; kr only at the boundary (AC1) ──
  describe("4.1-UNIT-01 — integer öre end-to-end (R-401)", () => {
    test("lineNetOre returns an integer öre for integer öre inputs", async () => {
      const m = await loadEngine();
      const r = m.lineNetOre(2, 85000); // 2 × 850,00 kr
      assert.ok(isOk(r), "expected ok result");
      const ore = okOre(r as OkLike);
      assert.ok(Number.isInteger(ore), "line net must be an integer öre");
      assert.equal(ore, 170000);
    });

    test("sumOre returns an integer öre total for integer öre line values", async () => {
      const m = await loadEngine();
      const r = m.sumOre([170000, 33300, 3]);
      assert.ok(isOk(r), "expected ok result");
      assert.equal(okOre(r as OkLike), 203303);
    });

    test("no float kronor crosses a boundary — the only kronor value is the formatter's string", async () => {
      const m = await loadEngine();
      const line = m.lineNetOre(1, 85000);
      assert.ok(isOk(line));
      const ore = okOre(line as OkLike);
      assert.equal(typeof ore, "number");
      assert.ok(Number.isInteger(ore), "the crossing value is öre, never float kronor");
      // The ONLY place a kronor STRING appears:
      assert.equal(m.formatOreAsKronor(ore), "850,00");
    });
  });

  // ── 4.1-UNIT-02: line net = round(qty × unitPriceÖre); fractional qty; totals (AC2) ──
  describe("4.1-UNIT-02 — line-level rounding + sum-of-rounded totals (R-401, R-402)", () => {
    test("roundToOre uses round-half-away-from-zero on non-negative inputs (x.5 → x+1)", async () => {
      const m = await loadEngine();
      assert.equal(m.roundToOre(2.5), 3); // NOT 2 (banker's)
      assert.equal(m.roundToOre(22.5), 23); // NOT 22 (banker's)
      assert.equal(m.roundToOre(0.5), 1);
      assert.equal(m.roundToOre(1.4), 1);
      assert.equal(m.roundToOre(1.6), 2);
      assert.equal(m.roundToOre(0), 0);
    });

    test("lineNetOre with a fractional quantity yields the exact rounded öre", async () => {
      const m = await loadEngine();
      // 0.333 × 100000 = 33300 (exact); 2.25 × 333 = 749.25 → 749; 0.5 × 5 = 2.5 → 3.
      assert.equal(okOre(await okResult(m.lineNetOre(0.333, 100000))), 33300);
      assert.equal(okOre(await okResult(m.lineNetOre(2.25, 333))), 749);
      assert.equal(okOre(await okResult(m.lineNetOre(0.5, 5))), 3);
    });

    test("lineNetOre with a large value stays exact integer öre", async () => {
      const m = await loadEngine();
      assert.equal(okOre(await okResult(m.lineNetOre(3, 79000))), 237000);
    });

    test("sumOre is SUM-OF-ROUNDED, never round-of-sum", async () => {
      const m = await loadEngine();
      // Three lines of 0.5 × 45 = 22.5 → 23 each. Sum-of-rounded = 69; round-of-sum = 68.
      const a = okOre(await okResult(m.lineNetOre(0.5, 45)));
      const b = okOre(await okResult(m.lineNetOre(0.5, 45)));
      const c = okOre(await okResult(m.lineNetOre(0.5, 45)));
      assert.equal(a, 23);
      const total = okOre(await okResult(m.sumOre([a, b, c])));
      assert.equal(total, 69, "totals SUM the already-rounded line values, not round the raw sum (68)");
    });

    async function okResult(r: TypedResult): Promise<OkLike> {
      assert.ok(isOk(r), `expected ok result, got ${JSON.stringify(r)}`);
      return r as OkLike;
    }
  });

  // ── 4.1-UNIT-03: invalid money rejected; user-safe typed failure; no raw echo (AC3) ──
  describe("4.1-UNIT-03 — invalid money rejected via reused isOreAmount (R-401, R-413)", () => {
    const invalidUnitPrices: ReadonlyArray<[string, unknown]> = [
      ["a float öre (850.5)", 850.5],
      ["a negative öre (-1)", -1],
      ["NaN", Number.NaN],
      ["+Infinity", Number.POSITIVE_INFINITY],
      ["-Infinity", Number.NEGATIVE_INFINITY],
      ["overflow (> ORE_AMOUNT_MAX)", ORE_AMOUNT_MAX + 1],
      ["a locale-comma string ('850,00')", "850,00"],
      ["a decimal string ('850.00')", "850.00"],
      ["a plain numeric string ('85000')", "85000"],
      ["null", null],
      ["undefined", undefined],
      ["an object", { ore: 85000 }],
    ];

    for (const [label, bad] of invalidUnitPrices) {
      test(`lineNetOre rejects ${label} with a typed failure and no raw echo`, async () => {
        const m = await loadEngine();
        const r = m.lineNetOre(1, bad as number);
        assert.ok(isErr(r), `expected typed failure for ${label}, got ${JSON.stringify(r)}`);
        assertNoRawEcho(r as ErrLike, bad);
      });
    }

    test("a malformed quantity is rejected the same way (finite non-negative decimal only)", async () => {
      const m = await loadEngine();
      for (const badQty of [Number.NaN, Number.POSITIVE_INFINITY, -1, "1.5", null, undefined, {}]) {
        const r = m.lineNetOre(badQty as number, 85000);
        assert.ok(isErr(r), `expected typed failure for quantity ${String(badQty)}`);
        assertNoRawEcho(r as ErrLike, badQty);
      }
    });

    test("a rejected input never returns NaN and never throws", async () => {
      const m = await loadEngine();
      let threw = false;
      let result: TypedResult | null = null;
      try {
        result = m.lineNetOre(Number.NaN, Number.NaN);
      } catch {
        threw = true;
      }
      assert.equal(threw, false, "primitive must not throw a raw error");
      assert.ok(isErr(result), "primitive returns a typed failure, not NaN");
    });
  });

  // ── 4.1-UNIT-04: negative / zero / zero-quantity semantics (AC3) ──────────────────
  describe("4.1-UNIT-04 — negative/zero/zero-quantity semantics (R-413)", () => {
    test("a zero öre unit price is VALID → line net 0 (not a rejection)", async () => {
      const m = await loadEngine();
      const r = m.lineNetOre(5, 0);
      assert.ok(isOk(r));
      assert.equal(okOre(r as OkLike), 0);
    });

    test("a zero quantity is VALID → line net 0 (not a rejection)", async () => {
      const m = await loadEngine();
      const r = m.lineNetOre(0, 85000);
      assert.ok(isOk(r));
      assert.equal(okOre(r as OkLike), 0);
    });

    test("a negative öre amount is REJECTED (money is non-negative in Phase A; no discount semantics)", async () => {
      const m = await loadEngine();
      const r = m.lineNetOre(1, -50000);
      assert.ok(isErr(r), "negative money is rejected — 4.1 invents NO discount/negative-amount semantics");
    });

    test("sumOre of all-zero lines is 0", async () => {
      const m = await loadEngine();
      const r = m.sumOre([0, 0, 0]);
      assert.ok(isOk(r));
      assert.equal(okOre(r as OkLike), 0);
    });
  });

  // ── 4.1-UNIT-05: formatting boundary preserves exact öre; non-finite → "" (AC1) ──
  describe("4.1-UNIT-05 — presentation-boundary kronor formatter (R-401)", () => {
    test("formatOreAsKronor renders Swedish comma decimal with exactly two decimals", async () => {
      const m = await loadEngine();
      assert.equal(m.formatOreAsKronor(85000), "850,00");
      assert.equal(m.formatOreAsKronor(1), "0,01");
      assert.equal(m.formatOreAsKronor(0), "0,00");
      assert.equal(m.formatOreAsKronor(1250), "12,50");
    });

    test("a non-finite öre yields '' — no NaN ever leaks to the UI", async () => {
      const m = await loadEngine();
      assert.equal(m.formatOreAsKronor(Number.NaN), "");
      assert.equal(m.formatOreAsKronor(Number.POSITIVE_INFINITY), "");
      assert.equal(m.formatOreAsKronor(Number.NEGATIVE_INFINITY), "");
    });

    test("formatting does not mutate the internal öre value it is given", async () => {
      const m = await loadEngine();
      const ore = okOre(await (async () => {
        const r = m.lineNetOre(2, 42500);
        assert.ok(isOk(r));
        return r as OkLike;
      })());
      const before = ore;
      m.formatOreAsKronor(ore);
      assert.equal(ore, before, "the öre value is unchanged by presentation formatting");
      assert.equal(m.formatOreAsKronor(ore), "850,00");
    });
  });

  // ── 4.1-UNIT-06: overflow guard at ORE_AMOUNT_MAX (AC1) ───────────────────────────
  describe("4.1-UNIT-06 — overflow guard at ORE_AMOUNT_MAX (R-401)", () => {
    test("lineNetOre rejects a product that would exceed ORE_AMOUNT_MAX", async () => {
      const m = await loadEngine();
      // quantity 2 × (MAX) overflows the safe-integer ceiling.
      const r = m.lineNetOre(2, ORE_AMOUNT_MAX);
      assert.ok(isErr(r), "an overflowing line net must be a typed failure, not an unsafe integer");
    });

    test("sumOre guards the accumulator against exceeding ORE_AMOUNT_MAX", async () => {
      const m = await loadEngine();
      const half = Math.floor(ORE_AMOUNT_MAX / 2) + 1;
      const r = m.sumOre([half, half, half]);
      assert.ok(isErr(r), "a sum past ORE_AMOUNT_MAX must be a typed failure");
    });
  });

  // ── 4.1-UNIT-07: exploratory property/round-trip (P3, non-gating) (AC1/AC2) ──────
  describe("4.1-UNIT-07 — exploratory property/round-trip (P3, non-gating)", () => {
    test("lineNetOre(1, x) === x for representative valid öre x", async () => {
      const m = await loadEngine();
      for (const x of [0, 1, 99, 85000, 12345678]) {
        const r = m.lineNetOre(1, x);
        assert.ok(isOk(r));
        assert.equal(okOre(r as OkLike), x, `identity failed for x=${x}`);
      }
    });
  });
});
