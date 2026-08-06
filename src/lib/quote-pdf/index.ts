/**
 * Story 6.3 — the pure quote-PDF view-model domain barrel (`src/lib/quote-pdf/**`).
 *
 * Re-exports the pure `buildQuotePdfViewModel` + the `QuotePdfViewModel` types so the renderer
 * (server-only) and the tests import from one place. PURE — no `src/server` dependency (the
 * layer-inversion trap); consumes only the sibling `@/lib/quote-snapshot` + `@/lib/money`.
 */
export {
  buildQuotePdfViewModel,
  QUOTE_PDF_LINE_KEYS,
  type QuotePdfViewModel,
  type QuotePdfLine,
  type QuotePdfTotals,
  type QuotePdfTaxAssumptions,
  type QuotePdfTaxAnswer,
  type QuotePdfTaxCategory,
  type QuotePdfTaxSummary,
  type QuotePdfResolvedPolicy,
  type QuotePdfPersonAllocation,
  type QuotePdfWarning,
  type QuotePdfAttachment,
} from "./view-model";
