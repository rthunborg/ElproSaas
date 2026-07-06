/**
 * PURE customer-visible quote view-model builder (Story 6.2, Task 2.4 / 6.2-UNIT-01).
 *
 * The single most important LEAKAGE-BY-CONSTRUCTION guard of this story: the builder maps a
 * quote-version line snapshot into the CUSTOMER-VISIBLE line view-model, PICKING ONLY the
 * customer-visible fields and NEVER carrying an `unit_cost_ore`, a margin/markup, or an
 * `internal_note`. Even if a source row (or a hostile/over-broad fixture) carries those
 * internal fields, the output shape cannot contain them — a UNIT test drives the builder with
 * internal fields present at the SOURCE and asserts they are ABSENT in the output (R-607).
 *
 * The by-construction guarantee is already true at the DATA MODEL (`quote_version_lines` has
 * NO cost/margin/internal column — 6.1 migration), and the frozen `QuoteVersionLineSnapshot`
 * type carries none either. This view-model builder is the SECOND belt: it is the explicit,
 * unit-pinned projection the UI renders, so a future column addition can never silently reach
 * the customer view without a test failing.
 *
 * Framework-agnostic, no I/O, no JSX — sits in a sibling `.ts` (the coverage-shape lesson).
 * [Source: test-design-epic-6.md#6.2-UNIT-01, R-607; src/lib/quote-snapshot/types.ts:64-88;
 *  story Task 2.4/5.1]
 */

/**
 * The customer-visible line view-model — the ONLY line fields the quote detail renders. NO
 * `unitCostOre`, NO margin/markup, NO `internalNote` (R-607 — excluded by construction).
 */
export interface CustomerVisibleLine {
  readonly rowType: string;
  readonly sortOrder: number;
  readonly label: string | null;
  readonly description: string | null;
  /** The CUSTOMER-visible note ONLY (never an internal note). */
  readonly quoteNote: string | null;
  readonly quantity: number | null;
  readonly unit: string | null;
  /** The customer-facing SELL price per unit in INTEGER ÖRE (never a cost). */
  readonly unitSellOre: number | null;
  /** The line net CAPTURED from the frozen snapshot (integer öre, never re-derived here). */
  readonly lineNetOre: number | null;
  readonly vatRateBp: number | null;
  readonly isHidden: boolean;
  readonly isOptional: boolean;
  readonly isSelected: boolean | null;
}

/**
 * A permissive SOURCE line shape: the frozen customer-visible fields PLUS (optionally) any
 * internal fields a hostile/over-broad source might carry. The builder must NEVER copy the
 * internal fields into the output. Typed as an index-permissive record so the 6.2-UNIT-01
 * fixture can pass `unit_cost_ore`/`margin`/`internal_note` at the source.
 */
export interface QuoteLineSource {
  readonly rowType: string;
  readonly sortOrder: number;
  readonly label?: string | null;
  readonly description?: string | null;
  readonly quoteNote?: string | null;
  readonly quantity?: number | null;
  readonly unit?: string | null;
  readonly unitSellOre?: number | null;
  readonly lineNetOre?: number | null;
  readonly vatRateBp?: number | null;
  readonly isHidden?: boolean;
  readonly isOptional?: boolean;
  readonly isSelected?: boolean | null;
  // Internal fields that MUST NOT reach the customer-visible view-model. Optional at the type
  // level so a source that carries them is accepted, but the builder never reads them.
  readonly unitCostOre?: number | null;
  readonly marginBp?: number | null;
  readonly markupBp?: number | null;
  readonly internalNote?: string | null;
  readonly [extra: string]: unknown;
}

/**
 * Project ONE source line into the customer-visible view-model. An EXPLICIT allow-list pick —
 * only the named customer-visible fields are copied; the builder never spreads the source, so
 * no cost/margin/internal field can leak into the output by construction (R-607).
 */
export function toCustomerVisibleLine(src: QuoteLineSource): CustomerVisibleLine {
  return {
    rowType: src.rowType,
    sortOrder: src.sortOrder,
    label: src.label ?? null,
    description: src.description ?? null,
    quoteNote: src.quoteNote ?? null,
    quantity: src.quantity ?? null,
    unit: src.unit ?? null,
    unitSellOre: src.unitSellOre ?? null,
    lineNetOre: src.lineNetOre ?? null,
    vatRateBp: src.vatRateBp ?? null,
    isHidden: src.isHidden ?? false,
    isOptional: src.isOptional ?? false,
    isSelected: src.isSelected ?? null,
  };
}

/**
 * Build the ordered customer-visible line list for a selected version — mapped through the
 * leak-free projection and sorted by `sortOrder`. The returned lines carry NO internal fields.
 */
export function buildCustomerVisibleLines(
  sources: readonly QuoteLineSource[],
): CustomerVisibleLine[] {
  return [...sources]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(toCustomerVisibleLine);
}

/**
 * The exhaustive allow-list of customer-visible line field keys (the leakage-by-construction
 * contract 6.2-UNIT-01 asserts against). A key NOT in this set must never appear on a
 * `CustomerVisibleLine`.
 */
export const CUSTOMER_VISIBLE_LINE_KEYS: readonly (keyof CustomerVisibleLine)[] = [
  "rowType",
  "sortOrder",
  "label",
  "description",
  "quoteNote",
  "quantity",
  "unit",
  "unitSellOre",
  "lineNetOre",
  "vatRateBp",
  "isHidden",
  "isOptional",
  "isSelected",
];

/** The internal field keys that must NEVER appear on a customer-visible line (R-607). */
export const FORBIDDEN_INTERNAL_LINE_KEYS: readonly string[] = [
  "unitCostOre",
  "unit_cost_ore",
  "marginBp",
  "margin_bp",
  "margin",
  "markupBp",
  "markup_bp",
  "internalNote",
  "internal_note",
];
