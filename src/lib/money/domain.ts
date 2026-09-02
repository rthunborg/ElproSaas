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

/**
 * Document posture is deliberately narrower than the per-line VAT category.
 * It answers only whether construction reverse charge applies anywhere on the
 * document; reduced and zero-rated treatment remain row/category facts.
 */
export const DOCUMENT_VAT_POSTURES = Object.freeze([
  "STANDARD_VAT_25",
  "REVERSE_CHARGE_CONSTRUCTION",
] as const);

export type DocumentVatPosture = (typeof DOCUMENT_VAT_POSTURES)[number];

/** Non-PII customer posture frozen with the tax answer. */
export const CUSTOMER_ELIGIBILITY_POSTURES = Object.freeze([
  "private",
  "company",
  "brf",
  "public",
] as const);

export type CustomerEligibilityPosture =
  (typeof CUSTOMER_ELIGIBILITY_POSTURES)[number];

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

/**
 * PII-free allowance identifiers are deliberately positional only. They are not
 * names, initials, customer ids, or personnummer stand-ins, and are bounded by
 * the documented 50-slot calculation contract.
 */
export function isCanonicalTaxPersonSlot(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^PERSON_([1-9]|[1-4]\d|50)$/.test(value)
  );
}

export type FixedPriceCategorySplitOre = Readonly<
  Record<GreenCategory, number>
>;

/** Canonical calculation-row ids that define one green fixed-price contract. */
export type FixedPriceRowIds = readonly string[];

/**
 * Fixed-price scope identifiers are persisted UUIDs, never labels or positions.
 * PostgreSQL emits UUIDs in this lowercase canonical form.
 */
export function isCanonicalFixedPriceRowId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
  );
}

/** The versioned calculation-side inputs from which a fresh V2 quote is resolved. */
export interface TaxInputSnapshotV2 {
  readonly schemaVersion: 2;
  readonly documentVatType: DocumentVatPosture;
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
  /** Included green calculation rows covered by the genuine fixed-price contract. */
  readonly fixedPriceRowIds: FixedPriceRowIds | null;
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

export function isDocumentVatPosture(
  value: unknown,
): value is DocumentVatPosture {
  return includesString(DOCUMENT_VAT_POSTURES, value);
}

export function isCustomerEligibilityPosture(
  value: unknown,
): value is CustomerEligibilityPosture {
  return includesString(CUSTOMER_ELIGIBILITY_POSTURES, value);
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
