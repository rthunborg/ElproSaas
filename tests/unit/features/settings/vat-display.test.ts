/**
 * Story 3.3 — unit tests for the PURE VAT display/encoding helpers
 * (`src/features/settings/vat-display.ts`). Pin the bp↔percent boundary conversion
 * (the stored value is INTEGER basis points, never a float) and the display-mode label
 * map, WITHOUT a browser. Runs under `node --test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  VAT_DISPLAY_LABELS,
  VAT_DISPLAY_OPTIONS,
  bpToPercentString,
  percentStringToBp,
} from "@/features/settings/vat-display";
import { VAT_DISPLAY_MODES } from "@/server/commands/settings/validation";

test("bpToPercentString: 2500 → '25'; 0 → '0'; 2550 → '25.5'", () => {
  assert.equal(bpToPercentString(2500), "25");
  assert.equal(bpToPercentString(0), "0");
  assert.equal(bpToPercentString(2550), "25.5");
  assert.equal(bpToPercentString(10000), "100");
});

test("percentStringToBp: '25' → 2500; '25.5' → 2550; '0' → 0; '100' → 10000", () => {
  assert.deepEqual(percentStringToBp("25"), { ok: true, bp: 2500 });
  assert.deepEqual(percentStringToBp("25.5"), { ok: true, bp: 2550 });
  assert.deepEqual(percentStringToBp("0"), { ok: true, bp: 0 });
  assert.deepEqual(percentStringToBp("100"), { ok: true, bp: 10000 });
});

test("percentStringToBp: a Swedish decimal comma is accepted ('25,5' → 2550)", () => {
  assert.deepEqual(percentStringToBp("25,5"), { ok: true, bp: 2550 });
});

test("percentStringToBp: an out-of-range percent (>100) is rejected", () => {
  assert.deepEqual(percentStringToBp("250"), { ok: false });
  assert.deepEqual(percentStringToBp("100.01"), { ok: false });
});

test("percentStringToBp: a negative / non-numeric / blank value is rejected", () => {
  assert.deepEqual(percentStringToBp("-5"), { ok: false });
  assert.deepEqual(percentStringToBp("abc"), { ok: false });
  assert.deepEqual(percentStringToBp(""), { ok: false });
  assert.deepEqual(percentStringToBp("   "), { ok: false });
});

test("percentStringToBp: sub-basis-point precision (>2 decimals) is rejected", () => {
  assert.deepEqual(percentStringToBp("25.555"), { ok: false });
});

test("bp ↔ percent round-trips for representable rates", () => {
  for (const bp of [0, 1200, 2500, 600, 10000]) {
    const pct = bpToPercentString(bp);
    assert.deepEqual(percentStringToBp(pct), { ok: true, bp }, `round-trip ${bp}`);
  }
});

test("VAT_DISPLAY label map + options cover exactly the allowed enum modes", () => {
  for (const mode of VAT_DISPLAY_MODES) {
    assert.ok(VAT_DISPLAY_LABELS[mode], `label for ${mode}`);
  }
  assert.equal(VAT_DISPLAY_OPTIONS.length, VAT_DISPLAY_MODES.length);
  for (const opt of VAT_DISPLAY_OPTIONS) {
    assert.ok(
      (VAT_DISPLAY_MODES as readonly string[]).includes(opt.value),
      `option ${opt.value} is an allowed mode`,
    );
  }
});
