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
 * Story 4.2 — the VAT + quote-total primitives (per-line VAT from basis points, sum-of-rounded
 * VAT totals, the excl/incl/both display views, and the frozen VAT-assumption snapshot builder).
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
 * Story 4.3 — the ROT / grön-teknik ESTIMATE ENGINE (the named UNAPPROVED deduction profiles, the
 * pure `estimateDeduction` engine — deduction + eligible basis + warnings + `requiresSignOff` +
 * ROT×grön mix-block + cap-clamp — and the frozen `buildTaxAssumptionSnapshot` builder). The
 * deduction rate flows in as BASIS POINTS from a named profile (no hidden percent literal); the
 * output is NEVER approvable without an explicit human sign-off (`requiresSignOff: true` is the
 * structural default); ROT and grön teknik CANNOT be mixed (a blocking typed failure); the engine
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
  TaxAssumptionSource,
  TaxAssumptionBuildOptions,
  DeductionInput,
  DeductionEstimate,
  DeductionResult,
} from "./tax";
