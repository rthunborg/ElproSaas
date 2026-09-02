/**
 * Story 6.1 — the PURE composite quote-version snapshot module barrel
 * (architecture §11/§22: `src/lib/quote-snapshot`). Re-exports the deep-freeze
 * builder + its contract types. PURE — no `src/server` import (the layer-inversion
 * trap; resolved values are passed IN). See `./build.ts` / `./types.ts` for the
 * full module documentation.
 */
export { buildQuoteVersionSnapshot } from "./build";
export {
  adaptQuoteTaxSnapshot,
  parseTaxAnswerSnapshotV2,
  type QuoteTaxCompatibilityResult,
  type QuoteTaxCompatibilitySource,
  type QuoteTaxCompatibilityView,
  type TaxAnswerSnapshotParseResult,
} from "./tax-compat";
export type {
  CompanyIdentitySource,
  QuoteCustomerContextSource,
  QuoteTermsSource,
  QuoteTotalsSource,
  QuoteAssumptionsSource,
  QuoteLineSource,
  QuoteAttachmentSource,
  QuoteWarningSource,
  QuoteHeaderSource,
  QuoteVersionSnapshotInput,
} from "./build";
export type {
  QuoteVersionStatus,
  QuoteDeductionType,
  QuoteVersionLineSnapshot,
  QuoteVersionAttachmentSnapshot,
  QuoteVersionWarningSnapshot,
  QuoteVersionSnapshot,
  QuoteSnapshotBuildOptions,
} from "./types";
