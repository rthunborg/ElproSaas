/**
 * Canonical closed tax domains for Story 10.6.
 *
 * Runtime arrays and TypeScript unions derive from the same values so consumers
 * never hand-copy tax vocabularies.
 */

export const VAT_TYPES = Object.freeze([
  "STANDARD_VAT_25",
  "REDUCED_VAT",
  "ZERO_RATED",
  "REVERSE_CHARGE_CONSTRUCTION",
] as const);

export type VatType = (typeof VAT_TYPES)[number];

export const DEDUCTION_CLASSIFICATIONS = Object.freeze([
  "NONE",
  "ROT_LABOR",
  "GREEN_SOLAR_LABOR",
  "GREEN_SOLAR_MATERIAL",
  "GREEN_STORAGE_LABOR",
  "GREEN_STORAGE_MATERIAL",
  "GREEN_CHARGING_LABOR",
  "GREEN_CHARGING_MATERIAL",
] as const);

export type DeductionClassification =
  (typeof DEDUCTION_CLASSIFICATIONS)[number];

export const GREEN_CATEGORIES = Object.freeze([
  "SOLAR",
  "STORAGE",
  "CHARGING",
] as const);

export type GreenCategory = (typeof GREEN_CATEGORIES)[number];

/** Customer-facing economic summary buckets, independent of deduction eligibility. */
export const TAX_SUMMARY_CATEGORIES = Object.freeze([
  "labor",
  "material",
  "other",
] as const);

export type TaxSummaryCategory = (typeof TAX_SUMMARY_CATEGORIES)[number];

export const GREEN_BASIS_METHODS = Object.freeze([
  "ACTUAL_ELIGIBLE_COSTS",
  "FIXED_PRICE_97_PERCENT",
] as const);

export type GreenBasisMethod = (typeof GREEN_BASIS_METHODS)[number];

export const TAX_DEDUCTION_CHOICES = Object.freeze([
  "NONE",
  "ROT",
  "GREEN",
  "ROT_AND_GREEN",
] as const);

export type TaxDeductionChoice = (typeof TAX_DEDUCTION_CHOICES)[number];

/**
 * A deliberately PII-free customer-declared allowance slot. `remainingAllowanceOre`
 * is retained as a compatibility alias for already-authored draft fixtures; fresh UI
 * writes the scheme-specific values so a mixed ROT + green project is unambiguous.
 */
export interface TaxPersonAllowanceSlot {
  readonly slot: string;
  readonly remainingAllowanceOre?: number;
  readonly remainingRotAllowanceOre?: number;
  readonly remainingCombinedRotRutAllowanceOre?: number;
  readonly remainingGreenAllowanceOre?: number;
}

export type FixedPriceCategorySplitOre = Readonly<
  Record<GreenCategory, number>
>;

/** The versioned calculation-side inputs from which a fresh V2 quote is resolved. */
export interface TaxInputSnapshotV2 {
  readonly schemaVersion: 2;
  readonly documentVatType: VatType;
  readonly buyerVatNumber: string | null;
  readonly deductionChoice: TaxDeductionChoice;
  /** ROT is resolved by the customer's payment date. */
  readonly paymentDate: string | null;
  /** Green technology is resolved by the customer's final-payment date. */
  readonly finalPaymentDate: string | null;
  readonly personAllowanceSlots: readonly TaxPersonAllowanceSlot[];
  readonly greenBasisMethod: GreenBasisMethod;
  readonly genuineFixedPrice: boolean;
  readonly fixedPriceOre: number | null;
  readonly fixedPriceCategorySplitOre: FixedPriceCategorySplitOre | null;
}

function includesString<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return (
    typeof value === "string" &&
    (values as readonly string[]).includes(value)
  );
}

export function isVatType(value: unknown): value is VatType {
  return includesString(VAT_TYPES, value);
}

export function isDeductionClassification(
  value: unknown,
): value is DeductionClassification {
  return includesString(DEDUCTION_CLASSIFICATIONS, value);
}

export function isGreenCategory(value: unknown): value is GreenCategory {
  return includesString(GREEN_CATEGORIES, value);
}

export function isTaxSummaryCategory(
  value: unknown,
): value is TaxSummaryCategory {
  return includesString(TAX_SUMMARY_CATEGORIES, value);
}

/**
 * Bind a deduction class to the economic kind it can legally describe. `NONE` is valid for
 * every kind; labor and material classes are deliberately disjoint, and an "other" row can
 * never enter a deduction basis.
 */
export function isDeductionClassificationCompatibleWithSummaryCategory(
  classification: DeductionClassification,
  summaryCategory: TaxSummaryCategory,
): boolean {
  if (classification === "NONE") return true;
  if (summaryCategory === "labor") return classification.endsWith("_LABOR");
  if (summaryCategory === "material") return classification.endsWith("_MATERIAL");
  return false;
}

export function isGreenBasisMethod(
  value: unknown,
): value is GreenBasisMethod {
  return includesString(GREEN_BASIS_METHODS, value);
}

export function isTaxDeductionChoice(
  value: unknown,
): value is TaxDeductionChoice {
  return includesString(TAX_DEDUCTION_CHOICES, value);
}
