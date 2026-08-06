/**
 * PURE editor totals (Story 5.2, Task 2.1 / AC4) — the EXTRACTED, unit-testable
 * total-derivation the client editor island CALLS. This is the coverage-shape lesson made
 * concrete: the money CONTRACT lives here (protected by the fast unit gate), NEVER inline
 * in a `"use client"` component.
 *
 * MONEY DISCIPLINE (architecture §10; R-505): every öre arithmetic op DELEGATES to the
 * frozen `@/lib/money` engine — line nets via `lineNetOre`, document/category VAT via
 * `aggregateDocumentVat`, and display via `selectVatDisplay`.
 * There is NO inline `+`/`*`/`0.25`/`Number(x)*rate` and NO forked öre/rounding/VAT rule in
 * this module. Epic 4 PINNED the original numbers; Story 10.6 moved section VAT to the
 * reconciled document-category authority while preserving rounded line nets.
 *
 * INCLUSION posture: `included_in_invoice_total` is the sole runtime authority. The migration
 * converted legacy option selection once; option commands keep the two fields coherent.
 *
 * PURE / I/O-free so it runs on the `node --test` fast gate. It computes öre only; the
 * öre→kronor DISPLAY is the single `formatOreAsKronor` at the presentation boundary
 * (never a second formatter here).
 */
import {
  aggregateDocumentVat,
  lineNetOre,
  lineVatOre,
  selectVatDisplay,
  type DeductionClassification,
  type VatType,
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
  /** Story 10.6 explicit VAT category type. Defaults to standard for legacy rows. */
  readonly vat_type?: VatType | null;
  /** Story 10.6 sole economic-inclusion authority. */
  readonly included_in_invoice_total?: boolean | null;
  readonly deduction_classification?: DeductionClassification | null;
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
 * Legacy callers supplied only a numeric VAT rate. Preserve that read-model
 * compatibility by deriving the unambiguous reduced category for the two
 * reduced rates; new writes carry `vat_type` explicitly and are validated at
 * the command/database boundary.
 */
function vatTypeForTotal(row: TotalsRowInput): VatType {
  if (row.vat_type !== null && row.vat_type !== undefined) return row.vat_type;
  if (row.vat_rate_bp === 600 || row.vat_rate_bp === 1200) return "REDUCED_VAT";
  return "STANDARD_VAT_25";
}

/**
 * Story 10.6 sole inclusion rule. Legacy optional state was converted once by the
 * migration; runtime totals never re-infer inclusion from option or visibility flags.
 */
export function rowCountsTowardTotal(row: {
  readonly included_in_invoice_total?: boolean | null;
  readonly is_optional: boolean;
  readonly is_selected: boolean | null;
}): boolean {
  return row.included_in_invoice_total !== false;
}

/**
 * Compute a single row's display total through a one-row category aggregation. Document totals
 * still re-aggregate all included row nets by category and never sum these displayed VAT values.
 * A null sell/VAT is treated as 0 (a draft row without a price contributes 0). Returns a
 * typed failure if the engine rejects an input (e.g. overflow) — never a NaN.
 */
export function computeLineTotal(row: TotalsRowInput): TotalsResult<LineTotal> {
  const sellOre = row.unit_sell_ore ?? 0;
  const net = lineNetOre(row.quantity, sellOre);
  if (!net.ok) return { ok: false, code: net.code };
  const breakdown = aggregateDocumentVat({
    rows: [{
      netOre: net.value,
      vatType: vatTypeForTotal(row),
      rateBp: row.vat_rate_bp,
      includedInInvoiceTotal: true,
      deductionClassification: row.deduction_classification ?? "NONE",
    }],
  });
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
 * Compute a section (or whole-calc) total over the INCLUDED rows only. Net is the sum of
 * rounded line nets; VAT is rounded once per `(VatType, rateBp)` document category through
 * the Story 10.6 tax authority; gross is derived. An excluded row contributes to none of them.
 */
export function computeSectionTotal(
  rows: readonly TotalsRowInput[],
): TotalsResult<SectionTotal> {
  const includedRows: {
    readonly netOre: number;
    readonly vatType: VatType;
    readonly rateBp: number;
    readonly includedInInvoiceTotal: true;
    readonly deductionClassification: DeductionClassification;
  }[] = [];
  for (const row of rows) {
    if (!rowCountsTowardTotal(row)) continue;
    const line = computeLineTotal(row);
    if (!line.ok) return { ok: false, code: line.code };
    includedRows.push({
      netOre: line.value.netOre,
      vatType: vatTypeForTotal(row),
      rateBp: row.vat_rate_bp ?? 0,
      includedInInvoiceTotal: true,
      deductionClassification: row.deduction_classification ?? "NONE",
    });
  }
  const aggregate = aggregateDocumentVat({ rows: includedRows });
  if (!aggregate.ok) return { ok: false, code: aggregate.code };
  return {
    ok: true,
    value: {
      netOre: aggregate.value.netOre,
      vatOre: aggregate.value.vatOre,
      grossOre: aggregate.value.grossOre,
    },
  };
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
