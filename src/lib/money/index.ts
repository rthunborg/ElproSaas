/**
 * `@/lib/money` — the pure integer-öre money + rounding engine (Story 4.1, architecture §22).
 *
 * Barrel re-export of the öre-arithmetic primitives, the single öre-validity rule, and the
 * presentation-boundary kronor formatter. See `./ore.ts` for the full module documentation
 * (integer-öre-end-to-end invariant, the golden-pinned line-level half-away-from-zero rounding
 * policy, and the pure/no-PII/no-clock discipline).
 *
 * The `@/lib/money` alias resolves to this file (`src/lib/money/index.ts`) for both the
 * `node --test` unit runner (via `tests/support/alias-hook.mjs`) and tsc/Next.
 */
export {
  isCanonicalTaxPersonSlot,
  VAT_TYPES,
  DOCUMENT_VAT_POSTURES,
  CUSTOMER_ELIGIBILITY_POSTURES,
  DEDUCTION_CLASSIFICATIONS,
  GREEN_CATEGORIES,
  TAX_SUMMARY_CATEGORIES,
  GREEN_BASIS_METHODS,
  TAX_DEDUCTION_CHOICES,
  isVatType,
  isDocumentVatPosture,
  isCustomerEligibilityPosture,
  isDeductionClassification,
  isDeductionClassificationCompatibleWithSummaryCategory,
  isGreenCategory,
  isTaxSummaryCategory,
  isGreenBasisMethod,
  isTaxDeductionChoice,
} from "./domain";

export type {
  VatType,
  DocumentVatPosture,
  CustomerEligibilityPosture,
  DeductionClassification,
  GreenCategory,
  TaxSummaryCategory,
  GreenBasisMethod,
  TaxDeductionChoice,
  TaxPersonAllowanceSlot,
  FixedPriceCategorySplitOre,
  TaxInputSnapshotV2,
} from "./domain";

export {
  isIsoCalendarDate,
  normalizeBuyerVatNumber,
  isValidBuyerVatNumber,
  parseTaxInputSnapshot,
} from "./tax-input";

export type {
  TaxInputValidationErrorCode,
  TaxInputValidationResult,
} from "./tax-input";

export {
  TAX_POLICY_2026,
  TAX_POLICY_REGISTRY,
  resolveTaxPolicy,
  aggregateDocumentVat,
  calculateCategoryVatOre,
  isCoherentVatTypeRate,
  allocateCategoryVatByDeductionClassification,
  computeReconciledDocumentTotals,
  truncateClaimToWholeSekOre,
  allocateWholeSekClaimByPerson,
  estimateClassifiedDeductions,
} from "./tax-policy";

export { buildTaxAnswerSnapshotV2 } from "./tax-answer";

export type {
  ResolvedTaxPolicySnapshot,
  FrozenPersonClaimAllocation,
  RotTaxAnswer,
  GreenCategoryTaxAnswer,
  GreenTaxAnswer,
  TaxSummaryBucket,
  TaxAnswerSnapshotV2,
  BuildTaxAnswerInput,
} from "./tax-answer";

export type {
  TaxPolicy,
  TaxPolicyWindow,
  TaxPolicyResolutionErrorCode,
  TaxPolicyResolutionResult,
  ResolveTaxPolicyInput,
  DocumentVatRowInput,
  DocumentVatCategory,
  DocumentVatAggregate,
  TaxAnswerResult,
  VatAllocationBucket,
  ReconciledDocumentTotals,
  PersonAllowanceSlot,
  PersonClaimAllocation,
  ClassifiedDeductionPart,
} from "./tax-policy";

export {
  ORE_AMOUNT_MAX,
  isOreAmount,
  isQuantity,
  validateQuantity,
  roundToOre,
  lineNetOre,
  sumOre,
  formatOreAsKronor,
} from "./ore";

export type { MoneyErrorCode, OreResult } from "./ore";

/**
 * Story 4.2 compatibility/display VAT primitives. Fresh document totals use the Story 10.6
 * `aggregateDocumentVat` category authority exported above; `lineVatOre`/`sumVatOre` are not
 * a quote-total policy.
 * The basis-point-validity rule (`isVatRateBp` + `VAT_RATE_BP_MIN`/`MAX`) is canonical here and
 * re-exported by `src/server/commands/settings/validation.ts` (one bp-validity authority, no fork).
 * See `./vat.ts` for the full module documentation (basis-points-only / no-hidden-25% invariant,
 * the per-line-round + sum-of-rounded policy, presentation-only display views, and the Story 3.5
 * snapshot-freeze discipline the VAT-assumption builder reuses).
 */
export {
  VAT_RATE_BP_MIN,
  VAT_RATE_BP_MAX,
  isVatRateBp,
  lineVatOre,
  sumVatOre,
  vatBreakdown,
  selectVatDisplay,
  buildVatAssumptionSnapshot,
} from "./vat";

export type {
  VatDisplayMode,
  VatBreakdown,
  VatBreakdownResult,
  VatDisplayPosture,
  VatDisplayView,
  VatAssumptionSource,
  VatAssumptionBuildOptions,
  VatAssumptionSnapshot,
  VatAssumptionResult,
} from "./vat";

/**
 * Story 4.3 compatibility-only ROT / grön-teknik estimate surface. Fresh calculations and quote
 * versions use `buildTaxAnswerSnapshotV2`; the legacy profiles below remain readable for frozen
 * V1 fixtures and must not be used as current policy. The named UNAPPROVED deduction profiles, the
 * pure `estimateDeduction` engine — deduction + eligible basis + warnings + `requiresSignOff` +
 * ROT×grön mix-block + cap-clamp — and the frozen `buildTaxAssumptionSnapshot` builder). The
 * deduction rate flows in as BASIS POINTS from a named profile (no hidden percent literal); the
 * output is NEVER approvable without an explicit human sign-off (`requiresSignOff: true` is the
 * structural default); its historical global mix block does not apply to the V2 classified engine,
 * takes a resolved eligibility POSTURE, never a personnummer / PII. See `./tax.ts` for the full
 * module documentation.
 */
export {
  ROT_PROFILE_UNAPPROVED,
  GRON_TEKNIK_PROFILE_UNAPPROVED,
  buildTaxAssumptionSnapshot,
  estimateDeduction,
} from "./tax";

export type {
  DeductionType,
  EligibilityPosture,
  DeductionWarning,
  DeductionWarningCode,
  DeductionProfile,
  TaxAssumptionSnapshot,
  TaxAssumptionResult,
  TaxAssumptionSource,
  TaxAssumptionBuildOptions,
  DeductionInput,
  DeductionEstimate,
  DeductionResult,
} from "./tax";
