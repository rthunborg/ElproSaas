/**
 * Story 5.2 — UNIT tests for the PURE editor totals (`src/features/calculations/totals.ts`).
 *
 * 5.2-UNIT-01 (P0, AC4): the editor totals EQUAL the `@/lib/money` engine totals for
 * representative rows (line net, section subtotal, VAT, gross) — asserting byte-equality
 * with DIRECT engine calls, proving there is NO inline math and NO forked öre/VAT rule.
 *
 * 5.2-UNIT-04 (P2, AC4): `resolveTotalDisplay` (via `selectVatDisplay`) is presentation-only
 * — the source totals are unchanged by the excl/incl/both selection.
 *
 * Story 10.6 inclusion: `included_in_invoice_total` is the sole authority; option
 * commands write it coherently with selection. Runs under `node --test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeLineTotal,
  computeLineVat,
  computeSectionTotal,
  computeCalcTotal,
  resolveTotalDisplay,
  rowCountsTowardTotal,
} from "@/features/calculations/totals";
import {
  aggregateDocumentVat,
  lineNetOre,
  lineVatOre,
  vatBreakdown,
  selectVatDisplay,
  ORE_AMOUNT_MAX,
} from "@/lib/money";

function row(overrides: Partial<{
  quantity: number;
  unit_sell_ore: number | null;
  vat_rate_bp: number | null;
  included_in_invoice_total: boolean;
  is_hidden: boolean;
  is_optional: boolean;
  is_selected: boolean | null;
}> = {}) {
  return {
    quantity: overrides.quantity ?? 1,
    unit_sell_ore: overrides.unit_sell_ore ?? 0,
    vat_rate_bp: overrides.vat_rate_bp ?? 2500,
    included_in_invoice_total: overrides.included_in_invoice_total ?? true,
    is_hidden: overrides.is_hidden ?? false,
    is_optional: overrides.is_optional ?? false,
    is_selected: overrides.is_selected ?? null,
  };
}

// ── 5.2-UNIT-01: totals EQUAL the engine (no inline math, no fork) ───────────────

test("5.2-UNIT-01: a line total equals a DIRECT lineNetOre + vatBreakdown engine call", () => {
  const q = 3;
  const sell = 85000; // 850,00 kr
  const vatBp = 2500;

  const line = computeLineTotal(row({ quantity: q, unit_sell_ore: sell, vat_rate_bp: vatBp }));
  assert.equal(line.ok, true);

  const engineNet = lineNetOre(q, sell);
  assert.equal(engineNet.ok, true);
  const engineBreakdown = vatBreakdown(engineNet.ok ? engineNet.value : -1, vatBp);
  assert.equal(engineBreakdown.ok, true);

  if (line.ok && engineBreakdown.ok) {
    assert.equal(line.value.netOre, engineBreakdown.value.netOre);
    assert.equal(line.value.vatOre, engineBreakdown.value.vatOre);
    assert.equal(line.value.grossOre, engineBreakdown.value.grossOre);
  }
});

test("5.2-UNIT-01: a section total equals the engine document-category VAT aggregate", () => {
  const rows = [
    row({ quantity: 2, unit_sell_ore: 12345, vat_rate_bp: 2500 }),
    row({ quantity: 1, unit_sell_ore: 99999, vat_rate_bp: 1200 }),
    row({ quantity: 3.5, unit_sell_ore: 5000, vat_rate_bp: 600 }),
  ];

  const section = computeSectionTotal(rows);
  assert.equal(section.ok, true);

  // Build the engine's rounded line nets, then aggregate VAT once per document category.
  const aggregateRows: {
    readonly netOre: number;
    readonly vatType: "STANDARD_VAT_25" | "REDUCED_VAT";
    readonly rateBp: number;
  }[] = [];
  for (const r of rows) {
    const net = lineNetOre(r.quantity, r.unit_sell_ore ?? 0);
    assert.equal(net.ok, true);
    if (!net.ok) return;
    aggregateRows.push({
      netOre: net.value,
      vatType: r.vat_rate_bp === 600 || r.vat_rate_bp === 1200
        ? "REDUCED_VAT"
        : "STANDARD_VAT_25",
      rateBp: r.vat_rate_bp ?? 0,
    });
  }
  const aggregate = aggregateDocumentVat({ rows: aggregateRows });
  assert.equal(aggregate.ok, true);
  if (section.ok && aggregate.ok) {
    assert.equal(section.value.netOre, aggregate.value.netOre);
    assert.equal(section.value.vatOre, aggregate.value.vatOre);
    assert.equal(section.value.grossOre, aggregate.value.grossOre);
  }
});

test("5.2-UNIT-01: same-category VAT is rounded once at document-category level", () => {
  // Two lines whose per-line VAT would total 50 öre. Story 10.6 makes the document-category
  // VAT authority round the combined STANDARD_VAT_25 net once, yielding 51 öre.
  const rows = [
    row({ quantity: 1, unit_sell_ore: 101, vat_rate_bp: 2500 }), // VAT of 101 = 25.25 → 25
    row({ quantity: 1, unit_sell_ore: 101, vat_rate_bp: 2500 }),
  ];
  const section = computeSectionTotal(rows);
  assert.equal(section.ok, true);
  const v1 = lineVatOre(101, 2500);
  assert.equal(v1.ok, true);
  const perLine = v1.ok ? v1.value : -1;
  const aggregate = aggregateDocumentVat({
    rows: rows.map((r) => ({
      netOre: r.unit_sell_ore ?? 0,
      vatType: "STANDARD_VAT_25" as const,
      rateBp: r.vat_rate_bp ?? 0,
    })),
  });
  assert.equal(aggregate.ok, true);
  if (section.ok && aggregate.ok) {
    assert.equal(perLine * 2, 50);
    assert.equal(section.value.vatOre, aggregate.value.vatOre);
    assert.equal(section.value.vatOre, 51);
  }
});

test("5.2-UNIT-01: computeCalcTotal flattens sections and matches a single section sum", () => {
  const rowsA = [row({ quantity: 2, unit_sell_ore: 10000, vat_rate_bp: 2500 })];
  const rowsB = [row({ quantity: 1, unit_sell_ore: 20000, vat_rate_bp: 1200 })];
  const calc = computeCalcTotal([{ rows: rowsA }, { rows: rowsB }]);
  const flat = computeSectionTotal([...rowsA, ...rowsB]);
  assert.equal(calc.ok, true);
  assert.equal(flat.ok, true);
  if (calc.ok && flat.ok) {
    assert.deepEqual(calc.value, flat.value);
  }
});

// ── Inclusion pin: hidden + selected COUNT; unselected option does NOT ────────────

test("inclusion: a plain row and a HIDDEN row both count when explicitly included", () => {
  assert.equal(rowCountsTowardTotal({ included_in_invoice_total: true, is_optional: false, is_selected: null }), true);
  assert.equal(rowCountsTowardTotal({ included_in_invoice_total: true, is_optional: false, is_selected: false }), true);
  // A hidden row is not optional → it counts (hidden ≠ excluded).
});

test("inclusion: explicit invoice inclusion, not option state, is authoritative", () => {
  assert.equal(rowCountsTowardTotal({ included_in_invoice_total: true, is_optional: true, is_selected: true }), true);
  assert.equal(rowCountsTowardTotal({ included_in_invoice_total: false, is_optional: true, is_selected: false }), false);
  assert.equal(rowCountsTowardTotal({ included_in_invoice_total: false, is_optional: true, is_selected: null }), false);
});

test("inclusion: an UNSELECTED option is excluded from BOTH net and VAT sums", () => {
  const included = row({ quantity: 1, unit_sell_ore: 10000, vat_rate_bp: 2500 });
  const excludedOption = row({
    quantity: 1,
    unit_sell_ore: 50000,
    vat_rate_bp: 2500,
    is_optional: true,
    is_selected: false,
    included_in_invoice_total: false,
  });
  const withOption = computeSectionTotal([included, excludedOption]);
  const withoutOption = computeSectionTotal([included]);
  assert.equal(withOption.ok, true);
  assert.equal(withoutOption.ok, true);
  if (withOption.ok && withoutOption.ok) {
    // The unselected option contributes nothing → the totals are identical.
    assert.deepEqual(withOption.value, withoutOption.value);
  }
});

test("inclusion: a SELECTED option DOES contribute to the total", () => {
  const included = row({ quantity: 1, unit_sell_ore: 10000, vat_rate_bp: 2500 });
  const selectedOption = row({
    quantity: 1,
    unit_sell_ore: 50000,
    vat_rate_bp: 2500,
    is_optional: true,
    is_selected: true,
    included_in_invoice_total: true,
  });
  const total = computeSectionTotal([included, selectedOption]);
  const baseline = computeSectionTotal([included]);
  assert.equal(total.ok, true);
  assert.equal(baseline.ok, true);
  if (total.ok && baseline.ok) {
    assert.ok(total.value.netOre > baseline.value.netOre);
  }
});

// ── 5.2-UNIT-04: display selection is presentation-only ──────────────────────────

test("5.2-UNIT-04: resolveTotalDisplay is presentation-only — source totals unchanged", () => {
  const total = { netOre: 100000, vatOre: 25000, grossOre: 125000 };
  const excl = resolveTotalDisplay(total, "company_excl");
  const togglable = resolveTotalDisplay(total, "company_togglable");
  const priv = resolveTotalDisplay(total, "private");

  // The engine selector is the authority — parity with a direct call.
  assert.deepEqual(excl, selectVatDisplay("company_excl", total));
  assert.deepEqual(togglable, selectVatDisplay("company_togglable", total));
  assert.deepEqual(priv, selectVatDisplay("private", total));

  // Every view re-derives the SAME source öre (net/vat/gross unchanged).
  for (const view of [excl, togglable, priv]) {
    assert.equal(view.netOre, total.netOre);
    assert.equal(view.vatOre, total.vatOre);
    assert.equal(view.grossOre, total.grossOre);
  }
  // excl → primary is net; togglable/private → primary is gross.
  assert.equal(excl.primaryOre, total.netOre);
  assert.equal(togglable.primaryOre, total.grossOre);
  assert.equal(priv.primaryOre, total.grossOre);
  assert.equal(priv.togglable, false);
});

test("a null sell/VAT is treated as 0 (a draft row without a price contributes 0)", () => {
  const line = computeLineTotal(row({ quantity: 5, unit_sell_ore: null, vat_rate_bp: null }));
  assert.equal(line.ok, true);
  if (line.ok) {
    assert.equal(line.value.netOre, 0);
    assert.equal(line.value.vatOre, 0);
    assert.equal(line.value.grossOre, 0);
  }
});

// ── Engine-failure propagation: a rejected öre op is a typed failure, NEVER a NaN ──

test("computeLineTotal PROPAGATES an engine overflow as a typed failure (never NaN)", () => {
  // qty × sell overflows ORE_AMOUNT_MAX → the engine's lineNetOre rejects; the editor must
  // surface a typed { ok:false, code } rather than coerce a NaN/Infinity into a total.
  const line = computeLineTotal(
    row({ quantity: 2, unit_sell_ore: ORE_AMOUNT_MAX, vat_rate_bp: 2500 }),
  );
  assert.equal(line.ok, false);
  if (!line.ok) {
    assert.equal(line.code, "ORE_OVERFLOW");
  }
});

test("computeLineTotal PROPAGATES a malformed quantity as a typed failure", () => {
  // A non-finite quantity is an engine INVALID_QUANTITY — never a silent 0 or NaN total.
  const line = computeLineTotal(
    row({ quantity: Number.POSITIVE_INFINITY, unit_sell_ore: 10000, vat_rate_bp: 2500 }),
  );
  assert.equal(line.ok, false);
  if (!line.ok) {
    assert.equal(typeof line.code, "string");
    assert.ok(line.code.length > 0);
  }
});

test("computeSectionTotal short-circuits to a typed failure when ANY included line fails", () => {
  const good = row({ quantity: 1, unit_sell_ore: 10000, vat_rate_bp: 2500 });
  const overflowing = row({ quantity: 2, unit_sell_ore: ORE_AMOUNT_MAX, vat_rate_bp: 2500 });
  const section = computeSectionTotal([good, overflowing]);
  assert.equal(section.ok, false);
  if (!section.ok) {
    assert.equal(section.code, "ORE_OVERFLOW");
  }
});

test("computeSectionTotal SKIPS an unselected-option overflow (excluded rows never fail the sum)", () => {
  // An UNSELECTED option is excluded BEFORE the line is computed — so an over-large
  // (but excluded) option must NOT poison an otherwise-valid section total.
  const good = row({ quantity: 1, unit_sell_ore: 10000, vat_rate_bp: 2500 });
  const excludedOverflow = row({
    quantity: 2,
    unit_sell_ore: ORE_AMOUNT_MAX,
    vat_rate_bp: 2500,
    is_optional: true,
    is_selected: false,
    included_in_invoice_total: false,
  });
  const section = computeSectionTotal([good, excludedOverflow]);
  assert.equal(section.ok, true);
});

// ── Empty inputs: zero total, never a failure ────────────────────────────────────

test("computeSectionTotal over an EMPTY row list is a zero total (not a failure)", () => {
  const section = computeSectionTotal([]);
  assert.equal(section.ok, true);
  if (section.ok) {
    assert.deepEqual(section.value, { netOre: 0, vatOre: 0, grossOre: 0 });
  }
});

test("computeCalcTotal over sections with NO rows is a zero total", () => {
  const calc = computeCalcTotal([{ rows: [] }, { rows: [] }]);
  assert.equal(calc.ok, true);
  if (calc.ok) {
    assert.deepEqual(calc.value, { netOre: 0, vatOre: 0, grossOre: 0 });
  }
});

// ── Inclusion pin, integrated into a SUM: a hidden row's öre actually lands ───────

test("inclusion: a HIDDEN row's öre CONTRIBUTES to the section total (hidden ≠ excluded)", () => {
  const visible = row({ quantity: 1, unit_sell_ore: 10000, vat_rate_bp: 2500 });
  const hidden = row({
    quantity: 1,
    unit_sell_ore: 40000,
    vat_rate_bp: 2500,
    is_hidden: true,
  });
  const withHidden = computeSectionTotal([visible, hidden]);
  const visibleOnly = computeSectionTotal([visible]);
  assert.equal(withHidden.ok, true);
  assert.equal(visibleOnly.ok, true);
  if (withHidden.ok && visibleOnly.ok) {
    // The hidden row's 40000 öre net is added — hidden counts toward the total.
    assert.equal(withHidden.value.netOre, visibleOnly.value.netOre + 40000);
    assert.ok(withHidden.value.vatOre > visibleOnly.value.vatOre);
  }
});

// ── computeLineVat: the direct per-line VAT helper (byte-parity with the engine) ──

test("computeLineVat equals a direct lineVatOre engine call and propagates its failure", () => {
  const ok = computeLineVat(10000, 2500);
  const engine = lineVatOre(10000, 2500);
  assert.equal(ok.ok, true);
  assert.equal(engine.ok, true);
  if (ok.ok && engine.ok) {
    assert.equal(ok.value, engine.value);
  }
  // A malformed VAT rate is a typed failure, not a NaN.
  const bad = computeLineVat(10000, -1);
  assert.equal(bad.ok, false);
});
