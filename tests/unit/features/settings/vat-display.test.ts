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

test("VAT_DISPLAY: the option order is STABLE and mirrors VAT_DISPLAY_MODES exactly", () => {
  // The control's option order is a presentation contract — pin it 1:1 to the enum so
  // a reorder/insert is a deliberate, test-visible change.
  assert.deepEqual(
    VAT_DISPLAY_OPTIONS.map((o) => o.value),
    [...VAT_DISPLAY_MODES],
  );
  for (const opt of VAT_DISPLAY_OPTIONS) {
    assert.equal(opt.label, VAT_DISPLAY_LABELS[opt.value]);
  }
});

test("VAT_DISPLAY: every mode's label encodes the OWNER display-assumption rule", () => {
  // The owner rule (decision 2026-06-18): private customers ALWAYS show incl-VAT (not
  // togglable); only COMPANY-customer display is configurable. Every label must state
  // the private-always-incl-VAT invariant so the admin cannot misread the setting as
  // affecting private customers. This is the display-assumption contract, in copy.
  for (const mode of VAT_DISPLAY_MODES) {
    const label = VAT_DISPLAY_LABELS[mode];
    assert.match(
      label,
      /privatkunder.*alltid.*inkl\. moms/i,
      `${mode} label must state private-always-incl-VAT`,
    );
    assert.match(label, /företagskunder/i, `${mode} label must address company customers`);
  }
});

test("VAT_DISPLAY: the two modes differ in their COMPANY-customer assumption (togglable vs excl)", () => {
  // company_togglable = incl-VAT display can be toggled; company_excl = default excl-VAT.
  // The two labels must be distinct and each carry its company-side semantics.
  assert.notEqual(
    VAT_DISPLAY_LABELS.company_togglable,
    VAT_DISPLAY_LABELS.company_excl,
  );
  assert.match(VAT_DISPLAY_LABELS.company_togglable, /visas\/döljas/i);
  assert.match(VAT_DISPLAY_LABELS.company_excl, /exkl\. moms/i);
});

test("bpToPercentString: a non-finite bp (NaN / Infinity) yields an empty string (no NaN leaks to the UI)", () => {
  assert.equal(bpToPercentString(Number.NaN), "");
  assert.equal(bpToPercentString(Number.POSITIVE_INFINITY), "");
  assert.equal(bpToPercentString(Number.NEGATIVE_INFINITY), "");
});

test("percentStringToBp: the [0,10000] bp boundaries are inclusive at the percent boundary", () => {
  // 0 % → 0 bp (min) and 100 % → 10000 bp (max) are accepted; just past each is rejected.
  assert.deepEqual(percentStringToBp("0"), { ok: true, bp: 0 });
  assert.deepEqual(percentStringToBp("100"), { ok: true, bp: 10000 });
  assert.deepEqual(percentStringToBp("100.01"), { ok: false });
});

test("percentStringToBp: a sub-basis-point value rounds-free — exactly two decimals map cleanly", () => {
  // Two decimals = whole basis points (no rounding). 6.25 % → 625 bp; 0.01 % → 1 bp.
  assert.deepEqual(percentStringToBp("6.25"), { ok: true, bp: 625 });
  assert.deepEqual(percentStringToBp("0.01"), { ok: true, bp: 1 });
});

test("percentStringToBp: leading/trailing whitespace is tolerated around a valid percent", () => {
  assert.deepEqual(percentStringToBp("  25  "), { ok: true, bp: 2500 });
});

test("percentStringToBp: a sign or thousands separator is rejected (strict numeric shape)", () => {
  assert.deepEqual(percentStringToBp("+25"), { ok: false });
  assert.deepEqual(percentStringToBp("1,000"), { ok: false });
  assert.deepEqual(percentStringToBp("25%"), { ok: false });
});
