/**
 * PURE editor totals (Story 5.2, Task 2.1 / AC4) — the EXTRACTED, unit-testable
 * total-derivation the client editor island CALLS. This is the coverage-shape lesson made
 * concrete: the money CONTRACT lives here (protected by the fast unit gate), NEVER inline
 * in a `"use client"` component.
 *
 * MONEY DISCIPLINE (architecture §10; R-505): every öre arithmetic op DELEGATES to the
 * frozen `@/lib/money` engine — `lineNetOre` / `lineVatOre` / `sumOre` / `sumVatOre` /
 * `vatBreakdown` / `selectVatDisplay`. There is NO inline `+`/`*`/`0.25`/`Number(x)*rate`
 * and NO forked öre/rounding/VAT rule in this module. Epic 4 PINNED the numbers; this
 * story asserts ROUTING, and the 5.2-UNIT-01 test proves byte-equality with a direct
 * engine call.
 *
 * INCLUSION posture (Task 2.2): this story SHOWS totals and PERSISTS the flags, but the
 * owner-pinned totals-INCLUSION rule is Epic 4's frozen pin (2026-06-18) — do NOT
 * re-decide it. When summing, apply the ALREADY-PINNED rule: a SELECTED option
 * (`is_selected === true`) and a HIDDEN row (`is_hidden === true`) COUNT toward
 * basis/net/VAT; an UNSELECTED option (`is_optional === true && is_selected !== true`)
 * does NOT. A row that is neither optional nor selected always counts. If a DIFFERENT
 * inclusion rule is ever required, that is a STOP (needs-human), not a local invention.
 *
 * PURE / I/O-free so it runs on the `node --test` fast gate. It computes öre only; the
 * öre→kronor DISPLAY is the single `formatOreAsKronor` at the presentation boundary
 * (never a second formatter here).
 */
import {
  lineNetOre,
  lineVatOre,
  selectVatDisplay,
  sumOre,
  sumVatOre,
  vatBreakdown,
  type VatDisplayPosture,
  type VatDisplayView,
} from "@/lib/money";

/** The minimal row shape the totals engine needs (a subset of the read/row model). */
export interface TotalsRowInput {
  readonly quantity: number;
  /** The customer-facing sell price per unit, in integer öre (null → treated as 0). */
  readonly unit_sell_ore: number | null;
  /** The row VAT assumption in basis points (null → treated as 0, i.e. VAT-exempt). */
  readonly vat_rate_bp: number | null;
  readonly is_hidden: boolean;
  readonly is_optional: boolean;
  readonly is_selected: boolean | null;
}

/** A computed per-row line total (net + VAT + gross, all integer öre). */
export interface LineTotal {
  readonly netOre: number;
  readonly vatOre: number;
  readonly grossOre: number;
}

/** A computed section (or whole-calc) total. */
export interface SectionTotal {
  readonly netOre: number;
  readonly vatOre: number;
  readonly grossOre: number;
}

/** A typed totals failure (mirrors the engine's discriminated result). */
export type TotalsResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: string };

/**
 * The frozen 2026-06-18 INCLUSION rule (Task 2.2): a row COUNTS toward the total unless it
 * is an UNSELECTED option. A hidden row still counts; a selected option counts; a plain
 * row counts. This is applied identically to net and VAT so a row never contributes to one
 * total but not the other.
 */
export function rowCountsTowardTotal(row: {
  readonly is_optional: boolean;
  readonly is_selected: boolean | null;
}): boolean {
  if (row.is_optional) {
    return row.is_selected === true;
  }
  return true;
}

/**
 * Compute a single row's line total (net → rounded, VAT from the rounded net + bp → rounded,
 * gross = net + VAT). Delegates every öre op to the engine (`lineNetOre` + `vatBreakdown`).
 * A null sell/VAT is treated as 0 (a draft row without a price contributes 0). Returns a
 * typed failure if the engine rejects an input (e.g. overflow) — never a NaN.
 */
export function computeLineTotal(row: TotalsRowInput): TotalsResult<LineTotal> {
  const sellOre = row.unit_sell_ore ?? 0;
  const vatBp = row.vat_rate_bp ?? 0;
  const net = lineNetOre(row.quantity, sellOre);
  if (!net.ok) return { ok: false, code: net.code };
  const breakdown = vatBreakdown(net.value, vatBp);
  if (!breakdown.ok) return { ok: false, code: breakdown.code };
  return {
    ok: true,
    value: {
      netOre: breakdown.value.netOre,
      vatOre: breakdown.value.vatOre,
      grossOre: breakdown.value.grossOre,
    },
  };
}

/**
 * Compute a section (or whole-calc) total over the INCLUDED rows only (the 2026-06-18
 * inclusion pin). Net = `sumOre` of the rounded line nets; VAT = `sumVatOre` of the rounded
 * line VATs; gross = net + VAT (derived). Uses the engine's sum-of-rounded primitives —
 * NEVER a round-of-sum. An UNSELECTED option is excluded from BOTH sums.
 */
export function computeSectionTotal(
  rows: readonly TotalsRowInput[],
): TotalsResult<SectionTotal> {
  const includedNets: number[] = [];
  const includedVats: number[] = [];
  for (const row of rows) {
    if (!rowCountsTowardTotal(row)) continue;
    const line = computeLineTotal(row);
    if (!line.ok) return { ok: false, code: line.code };
    includedNets.push(line.value.netOre);
    includedVats.push(line.value.vatOre);
  }
  const net = sumOre(includedNets);
  if (!net.ok) return { ok: false, code: net.code };
  const vat = sumVatOre(includedVats);
  if (!vat.ok) return { ok: false, code: vat.code };
  const grossOre = net.value + vat.value;
  return { ok: true, value: { netOre: net.value, vatOre: vat.value, grossOre } };
}

/**
 * Compute the whole-calculation total across all sections' rows (the totals-summary
 * figure). Flattens the sections' included rows and sums via the engine — a single
 * sum-of-rounded over every included line (never a round-of-section-subtotals).
 */
export function computeCalcTotal(
  sections: ReadonlyArray<{ readonly rows: readonly TotalsRowInput[] }>,
): TotalsResult<SectionTotal> {
  const allRows: TotalsRowInput[] = [];
  for (const section of sections) {
    for (const row of section.rows) allRows.push(row);
  }
  return computeSectionTotal(allRows);
}

/**
 * Resolve the presentation-only excl/incl/both display VIEW for a computed total via the
 * engine's `selectVatDisplay`. Presentation ONLY — it re-derives from the same source öre
 * and NEVER mutates them (5.2-UNIT-04). The source total is unchanged by the display mode.
 */
export function resolveTotalDisplay(
  total: SectionTotal,
  posture: VatDisplayPosture,
): VatDisplayView {
  return selectVatDisplay(posture, {
    netOre: total.netOre,
    vatOre: total.vatOre,
    grossOre: total.grossOre,
  });
}

/** Direct per-line VAT (exposed for callers that need only the VAT öre). */
export function computeLineVat(
  netOre: number,
  vatRateBp: number,
): TotalsResult<number> {
  const vat = lineVatOre(netOre, vatRateBp);
  if (!vat.ok) return { ok: false, code: vat.code };
  return { ok: true, value: vat.value };
}
