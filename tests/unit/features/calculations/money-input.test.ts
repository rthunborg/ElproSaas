/**
 * Story 5.2 — UNIT tests for the calc-editor kronor↔öre / percent↔bp money boundary
 * (`src/features/calculations/money-input.ts`). Confirms the REUSED pricing/settings seams
 * behave as expected at this boundary AND pins the markup-specific percent→bp parse (a
 * markup can exceed 100%, unlike a VAT rate). Runs under `node --test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bpToPercentString,
  kronorStringToOre,
  markupBpToPercentString,
  oreToKronorString,
  percentStringToBp,
  percentStringToMarkupBp,
} from "@/features/calculations/money-input";
import { MARKUP_BP_MAX } from "@/server/commands/calculations/validation";

// ── kronor↔öre (reused pricing seam) ─────────────────────────────────────────────

test("kronor→öre accepts a Swedish comma decimal and a plain integer", () => {
  assert.deepEqual(kronorStringToOre("850,00"), { ok: true, ore: 85000 });
  assert.deepEqual(kronorStringToOre("850"), { ok: true, ore: 85000 });
  assert.deepEqual(kronorStringToOre("0,01"), { ok: true, ore: 1 });
});

test("kronor→öre REJECTS negatives / dot decimals / sub-öre / non-numeric", () => {
  assert.equal(kronorStringToOre("-5").ok, false);
  assert.equal(kronorStringToOre("850.00").ok, false);
  assert.equal(kronorStringToOre("850,005").ok, false);
  assert.equal(kronorStringToOre("abc").ok, false);
  assert.equal(kronorStringToOre("").ok, false);
});

test("öre→kronor formats via the single formatter (comma decimal, two decimals)", () => {
  assert.equal(oreToKronorString(85000), "850,00");
  assert.equal(oreToKronorString(1), "0,01");
  assert.equal(oreToKronorString(0), "0,00");
});

// ── VAT percent↔bp (reused settings seam) ────────────────────────────────────────

test("VAT percent→bp accepts 0..100 and rejects out-of-range / sub-bp", () => {
  assert.deepEqual(percentStringToBp("25"), { ok: true, bp: 2500 });
  assert.deepEqual(percentStringToBp("25,5"), { ok: true, bp: 2550 });
  assert.deepEqual(percentStringToBp("0"), { ok: true, bp: 0 });
  assert.deepEqual(percentStringToBp("100"), { ok: true, bp: 10000 });
  assert.equal(percentStringToBp("250").ok, false); // > 100%
  assert.equal(percentStringToBp("25.555").ok, false); // sub-bp
});

test("VAT bp→percent trims a trailing .00", () => {
  assert.equal(bpToPercentString(2500), "25");
  assert.equal(bpToPercentString(2550), "25.5");
});

// ── markup percent↔bp (calc-specific — can exceed 100%) ──────────────────────────

test("markup percent→bp accepts values ABOVE 100% (a markup is not a VAT rate)", () => {
  assert.deepEqual(percentStringToMarkupBp("0"), { ok: true, bp: 0 });
  assert.deepEqual(percentStringToMarkupBp("25"), { ok: true, bp: 2500 });
  assert.deepEqual(percentStringToMarkupBp("150"), { ok: true, bp: 15000 });
  assert.deepEqual(percentStringToMarkupBp("12,5"), { ok: true, bp: 1250 });
});

test("markup percent→bp REJECTS negatives / sub-bp / non-numeric / blank", () => {
  assert.equal(percentStringToMarkupBp("-5").ok, false);
  assert.equal(percentStringToMarkupBp("25.555").ok, false);
  assert.equal(percentStringToMarkupBp("abc").ok, false);
  assert.equal(percentStringToMarkupBp("").ok, false);
});

test("markup bp→percent renders without a trailing .00", () => {
  assert.equal(markupBpToPercentString(15000), "150");
  assert.equal(markupBpToPercentString(1250), "12.5");
});

test("markup percent→bp ACCEPTS the exact MARKUP_BP_MAX ceiling and REJECTS above it", () => {
  // The parser shares the 5.1 isMarkupBp ceiling (MARKUP_BP_MAX). The value AT the ceiling
  // is accepted; one bp above is rejected — the boundary matches the server authority.
  const ceilingPercent = String(MARKUP_BP_MAX / 100); // e.g. "10000"
  assert.deepEqual(percentStringToMarkupBp(ceilingPercent), { ok: true, bp: MARKUP_BP_MAX });
  const abovePercent = String(MARKUP_BP_MAX / 100 + 1);
  assert.equal(percentStringToMarkupBp(abovePercent).ok, false);
});

test("markup bp→percent on a non-finite bp yields an empty string (never 'NaN')", () => {
  assert.equal(markupBpToPercentString(Number.NaN), "");
  assert.equal(markupBpToPercentString(Number.POSITIVE_INFINITY), "");
});

test("markup percent→bp tolerates surrounding whitespace around a valid value", () => {
  assert.deepEqual(percentStringToMarkupBp("  25  "), { ok: true, bp: 2500 });
});
