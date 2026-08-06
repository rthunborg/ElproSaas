/**
 * Story 5.4 — GOLDEN inclusion at the CALC-ROW level (5.4-GOLDEN-01, R-508).
 *
 * The frozen 2026-06-18 legacy pin is migrated onto Story 10.6's explicit inclusion fact: hidden
 * included rows and included tillval count; an explicitly excluded option is never summed. This test EXTENDS the existing money-golden fixture
 * (`tests/fixtures/golden/money/options-tillval.json`) to the CALC-ROW shape — it drives the REAL
 * `totals.ts` (`rowCountsTowardTotal` + `computeSectionTotal`, which delegate every öre op to
 * `@/lib/money`) against the SAME pinned öre the Story 4.4 pack drives through the raw engine.
 *
 * SINGLE NUMERIC AUTHORITY (R-508): this does NOT re-pin the numbers. The `options-tillval.json`
 * fixture remains the ONE authority for the inclusion category; this test REFERENCES its pinned
 * `includedLinesOre` / `expectedIncludedNetOre` / `expectedSectionVatOre` and proves the calc-row
 * totals surface reproduces them (a wrong inclusion decision at the calc-row layer fails LOUD). A
 * DIVERGENCE from the pin is a STOP (needs-human), not a re-pin.
 *
 * NOTE: the FULL calc golden PACK (all row types, fractional qty, margins, section modes, VAT
 * display, ROT/grön, attachment flags) is Story 5.5 — 5.4 lands ONLY this inclusion golden.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII.
 * [Source: test-design-epic-5.md#5.4-GOLDEN-01, R-508; tests/fixtures/golden/money/
 *  options-tillval.json (the frozen inclusion pin); src/features/calculations/totals.ts]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  computeSectionTotal,
  rowCountsTowardTotal,
  type TotalsRowInput,
} from "@/features/calculations/totals";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(
  HERE,
  "../../../fixtures/golden/money/options-tillval.json",
);

interface InclusionCase {
  readonly id: string;
  readonly baseLinesOre?: readonly number[];
  readonly selectedOptionOre?: number;
  readonly unselectedOptionOre?: number;
  readonly includedLinesOre?: readonly number[];
  readonly expectedIncludedNetOre?: number;
  readonly excludedWouldGive?: number;
  readonly vatRateBp?: number;
  readonly expectedSectionVatOre?: number;
}
interface OptionsFixture {
  readonly inclusionCases: readonly InclusionCase[];
}

function loadFixture(): OptionsFixture {
  return JSON.parse(readFileSync(FIXTURE, "utf8")) as OptionsFixture;
}
function findCase(id: string): InclusionCase {
  const c = loadFixture().inclusionCases.find((x) => x.id === id);
  assert.ok(c, `fixture must carry the '${id}' inclusion case`);
  return c!;
}

/** Build a plain (non-optional, visible) calc row at a sell öre + VAT bp. */
function plainRow(sellOre: number, vatBp: number): TotalsRowInput {
  return {
    quantity: 1,
    unit_sell_ore: sellOre,
    vat_rate_bp: vatBp,
    included_in_invoice_total: true,
    is_hidden: false,
    is_optional: false,
    is_selected: null,
  };
}

test("5.4-GOLDEN-01: a SELECTED option COUNTS toward the calc-row section net (matches the pin)", () => {
  const c = findCase("selected-option-counts-toward-net");
  assert.ok(c.baseLinesOre && typeof c.selectedOptionOre === "number");
  // Base rows (plain) + a SELECTED option row → the section total over COUNTED rows.
  const rows: TotalsRowInput[] = [
    ...c.baseLinesOre!.map((ore) => plainRow(ore, 0)),
    {
      quantity: 1,
      unit_sell_ore: c.selectedOptionOre!,
      vat_rate_bp: 0,
      included_in_invoice_total: true,
      is_hidden: false,
      is_optional: true,
      is_selected: true, // SELECTED → counts
    },
  ];
  const total = computeSectionTotal(rows);
  assert.ok(total.ok, "section total must resolve");
  assert.equal(
    total.value.netOre,
    c.expectedIncludedNetOre,
    "the selected option must be summed into the calc-row net (matches the pin)",
  );
});

test("5.4-GOLDEN-01: an UNSELECTED option is NEVER summed into the calc-row net (matches the pin)", () => {
  const c = findCase("unselected-option-excluded-from-net");
  assert.ok(c.baseLinesOre && typeof c.unselectedOptionOre === "number");
  const unselectedOption: TotalsRowInput = {
    quantity: 1,
    unit_sell_ore: c.unselectedOptionOre!,
    vat_rate_bp: 0,
    included_in_invoice_total: false,
    is_hidden: false,
    is_optional: true,
    is_selected: false, // NOT selected → excluded
  };
  // The independent persisted inclusion fact itself excludes it; option state is descriptive here.
  assert.equal(rowCountsTowardTotal(unselectedOption), false);
  const rows: TotalsRowInput[] = [
    ...c.baseLinesOre!.map((ore) => plainRow(ore, 0)),
    unselectedOption,
  ];
  const total = computeSectionTotal(rows);
  assert.ok(total.ok);
  assert.equal(total.value.netOre, c.expectedIncludedNetOre, "base-only net (unselected excluded)");
  if (typeof c.excludedWouldGive === "number") {
    assert.notEqual(
      total.value.netOre,
      c.excludedWouldGive,
      "the unselected option was summed in — inclusion rule violated (STOP)",
    );
  }
});

test("5.4-GOLDEN-01: a SELECTED option's VAT is included in the calc-row section VAT total (sum-of-rounded)", () => {
  const c = findCase("selected-option-counts-toward-vat");
  assert.ok(c.includedLinesOre && typeof c.vatRateBp === "number" && typeof c.expectedSectionVatOre === "number");
  // Model the included lines as plain counted rows at the pinned VAT bp.
  const rows: TotalsRowInput[] = c.includedLinesOre!.map((ore) => plainRow(ore, c.vatRateBp!));
  const total = computeSectionTotal(rows);
  assert.ok(total.ok);
  assert.equal(
    total.value.vatOre,
    c.expectedSectionVatOre,
    "the calc-row section VAT (sum-of-rounded) reproduces the pinned VAT total",
  );
});

test("5.4-GOLDEN-01: a HIDDEN row COUNTS toward the calc-row section total (hidden rows count)", () => {
  // Reuse the pinned base+selected net case but mark one row HIDDEN — a hidden row still counts,
  // so the net is unchanged from the visible case (the frozen inclusion pin). Uses the SAME pinned
  // included öre as the single authority (no new number).
  const c = findCase("selected-option-counts-toward-net");
  assert.ok(c.includedLinesOre && typeof c.expectedIncludedNetOre === "number");
  const rows: TotalsRowInput[] = c.includedLinesOre!.map((ore, i) => ({
    quantity: 1,
    unit_sell_ore: ore,
    vat_rate_bp: 0,
    included_in_invoice_total: true,
    is_hidden: i === c.includedLinesOre!.length - 1, // mark the LAST row hidden
    is_optional: false,
    is_selected: null,
  }));
  const total = computeSectionTotal(rows);
  assert.ok(total.ok);
  assert.equal(
    total.value.netOre,
    c.expectedIncludedNetOre,
    "a hidden row still COUNTS — the net matches the pinned included net",
  );
});
