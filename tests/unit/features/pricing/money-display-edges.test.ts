/**
 * Story 3.4 — supplementary edge tests for the kronor↔öre money boundary helpers
 * (`@/features/pricing/money-display`), covering boundaries the primary suite
 * (`money-display.test.ts`) does not pin: large valid values + format-back symmetry at
 * scale, the öre-fractional padding edges, and the defensive `oreToKronorString` guard
 * against a non-integer/negative öre input. Runs under `node --test` (pure, no I/O).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  kronorStringToOre,
  oreToKronorString,
} from "@/features/pricing/money-display";

// ── kronorStringToOre — large but representable values ───────────────────────────

test("kronorStringToOre: a large multi-digit kronor value parses to the exact öre integer", () => {
  // 1,000,000 kr → 100,000,000 öre. No thousands separator (rejected elsewhere); a plain
  // long integer string is valid and must not lose precision.
  assert.deepEqual(kronorStringToOre("1000000"), { ok: true, ore: 100000000 });
  assert.deepEqual(kronorStringToOre("1000000,99"), { ok: true, ore: 100000099 });
});

test("kronorStringToOre: a single fractional digit pads to two öre digits ('5' → 50, not 5)", () => {
  // "12,5" is twelve kronor fifty öre = 1250 öre, NOT 1205. Pad-to-two is the öre rule.
  assert.deepEqual(kronorStringToOre("12,5"), { ok: true, ore: 1250 });
  assert.deepEqual(kronorStringToOre("0,5"), { ok: true, ore: 50 });
});

test("kronorStringToOre: a trailing comma with no fractional digits is rejected (strict shape)", () => {
  assert.deepEqual(kronorStringToOre("850,"), { ok: false });
});

test("kronorStringToOre: a leading-comma / bare-comma value is rejected", () => {
  assert.deepEqual(kronorStringToOre(",50"), { ok: false });
  assert.deepEqual(kronorStringToOre(","), { ok: false });
});

// ── oreToKronorString — large values + defensive guards ──────────────────────────

test("oreToKronorString: a large öre value formats with the comma decimal and no separators", () => {
  assert.equal(oreToKronorString(100000000), "1000000,00");
  assert.equal(oreToKronorString(100000099), "1000000,99");
});

test("oreToKronorString: a NON-INTEGER öre is truncated toward zero before formatting (defensive)", () => {
  // The öre input should already be an integer (the validator guarantees it). The display
  // helper is defensive: it truncates rather than emit a fractional/NaN string. Pin the
  // documented behaviour so a regression to e.g. toFixed-rounding is caught.
  assert.equal(oreToKronorString(1250.9), "12,50");
  assert.equal(oreToKronorString(1250.1), "12,50");
});

test("oreToKronorString: a negative öre keeps the sign and formats the magnitude", () => {
  // Prices are non-negative (the validator rejects negatives), but the display helper is
  // total: a negative öre keeps its sign rather than producing a malformed string.
  assert.equal(oreToKronorString(-85000), "-850,00");
  assert.equal(oreToKronorString(-1), "-0,01");
});

// ── format-back symmetry at scale ────────────────────────────────────────────────

test("kronor ↔ öre round-trips for large representable prices", () => {
  for (const ore of [100000000, 100000099, 999999999, 12345678]) {
    const display = oreToKronorString(ore);
    assert.deepEqual(kronorStringToOre(display), { ok: true, ore }, `round-trip ${ore}`);
  }
});
