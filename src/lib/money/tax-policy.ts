import {
  DEDUCTION_CLASSIFICATIONS,
  GREEN_CATEGORIES,
  VAT_TYPES,
  isDeductionClassification,
  isDeductionClassificationCompatibleWithSummaryCategory,
  isGreenBasisMethod,
  isTaxSummaryCategory,
  isVatType,
  type DeductionClassification,
  type GreenBasisMethod,
  type GreenCategory,
  type TaxSummaryCategory,
  type VatType,
} from "./domain";
import { isOreAmount } from "./ore";
import { isVatRateBp } from "./vat";

/** A policy window is inclusive at `validFrom` and exclusive at nullable `validTo`. */
export interface TaxPolicyWindow {
  readonly id: string;
  readonly validFrom: string;
  readonly validTo: string | null;
}

export interface VatPolicy {
  readonly standardRateBp: number;
}

export interface RotPolicy {
  readonly rateBp: number;
  readonly maxPerPersonYearOre: number;
  readonly combinedRotRutMaxPerPersonYearOre: number;
}

export interface GreenPolicy {
  readonly rateBpByCategory: Readonly<Record<GreenCategory, number>>;
  readonly maxPerPersonYearOre: number;
  readonly defaultBasisMethod: GreenBasisMethod;
  readonly fixedPriceEligibleShareBp: number;
}

/** The immutable, copy-by-value tax policy selected for a new calculation or quote version. */
export interface TaxPolicy extends TaxPolicyWindow {
  readonly vat: VatPolicy;
  readonly rot: RotPolicy;
  readonly green: GreenPolicy;
}

const TAX_POLICY_2026_VAT: VatPolicy = Object.freeze({
  standardRateBp: 2500,
});

const TAX_POLICY_2026_ROT: RotPolicy = Object.freeze({
  rateBp: 3000,
  maxPerPersonYearOre: 5_000_000,
  combinedRotRutMaxPerPersonYearOre: 7_500_000,
});

const TAX_POLICY_2026_GREEN_RATES: Readonly<Record<GreenCategory, number>> =
  Object.freeze({
    SOLAR: 1500,
    STORAGE: 5000,
    CHARGING: 5000,
  });

const TAX_POLICY_2026_GREEN: GreenPolicy = Object.freeze({
  rateBpByCategory: TAX_POLICY_2026_GREEN_RATES,
  maxPerPersonYearOre: 5_000_000,
  defaultBasisMethod: "ACTUAL_ELIGIBLE_COSTS",
  fixedPriceEligibleShareBp: 9700,
});

/** Ratified values effective for the 2026 policy year. Existing frozen documents never re-resolve. */
export const TAX_POLICY_2026: TaxPolicy = Object.freeze({
  id: "SE-TAX-2026-v1",
  validFrom: "2026-01-01",
  // This is a ratified 2026 policy, not an implicit perpetual default. A later
  // policy must be added as a new adjacent registry entry before a fresh quote
  // can be captured in 2027.
  validTo: "2027-01-01",
  vat: TAX_POLICY_2026_VAT,
  rot: TAX_POLICY_2026_ROT,
  green: TAX_POLICY_2026_GREEN,
});

/**
 * The single system registry. It is code-owned rather than tenant-owned and deeply immutable;
 * a changed rule is represented by an added version, never by mutating a historical profile.
 */
export const TAX_POLICY_REGISTRY: readonly TaxPolicy[] = Object.freeze([
  TAX_POLICY_2026,
]);

export type TaxPolicyResolutionErrorCode =
  | "TAX_POLICY_INVALID_PROFILE"
  | "TAX_POLICY_INVALID_DATE"
  | "TAX_POLICY_OVERLAP"
  | "TAX_POLICY_GAP"
  | "TAX_POLICY_NO_MATCH";

export type TaxPolicyResolutionResult<T extends TaxPolicyWindow = TaxPolicy> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: TaxPolicyResolutionErrorCode };

export interface ResolveTaxPolicyInput<T extends TaxPolicyWindow = TaxPolicy> {
  readonly registry: readonly T[];
  readonly effectiveDate: string;
}

function isIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= daysInMonth[month - 1];
}

function failPolicy<T extends TaxPolicyWindow>(
  code: TaxPolicyResolutionErrorCode,
): TaxPolicyResolutionResult<T> {
  return { ok: false, code };
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Resolve an injected effective date against a complete policy registry.
 *
 * Validation is registry-wide before matching: a gap or overlap anywhere invalidates the source,
 * even when the requested date would otherwise match an unaffected window. The input is copied
 * before sorting and is never mutated. No clock is read.
 */
export function resolveTaxPolicy<T extends TaxPolicyWindow>(
  input: ResolveTaxPolicyInput<T>,
): TaxPolicyResolutionResult<T> {
  if (!isIsoCalendarDate(input.effectiveDate)) {
    return failPolicy("TAX_POLICY_INVALID_DATE");
  }
  if (!Array.isArray(input.registry) || input.registry.length === 0) {
    return failPolicy("TAX_POLICY_NO_MATCH");
  }

  const ids = new Set<string>();
  for (const policy of input.registry) {
    if (
      typeof policy !== "object" ||
      policy === null ||
      typeof policy.id !== "string" ||
      policy.id.trim().length === 0 ||
      ids.has(policy.id)
    ) {
      return failPolicy("TAX_POLICY_INVALID_PROFILE");
    }
    ids.add(policy.id);

    if (
      !isIsoCalendarDate(policy.validFrom) ||
      (policy.validTo !== null && !isIsoCalendarDate(policy.validTo)) ||
      (policy.validTo !== null && policy.validTo <= policy.validFrom)
    ) {
      return failPolicy("TAX_POLICY_INVALID_DATE");
    }
  }

  const ordered = [...input.registry].sort((left, right) => {
    const byStart = compareText(left.validFrom, right.validFrom);
    return byStart !== 0 ? byStart : compareText(left.id, right.id);
  });

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (previous.validTo === null || current.validFrom < previous.validTo) {
      return failPolicy("TAX_POLICY_OVERLAP");
    }
    if (current.validFrom > previous.validTo) {
      return failPolicy("TAX_POLICY_GAP");
    }
  }

  const matching = ordered.find(
    (policy) =>
      input.effectiveDate >= policy.validFrom &&
      (policy.validTo === null || input.effectiveDate < policy.validTo),
  );
  return matching === undefined
    ? failPolicy("TAX_POLICY_NO_MATCH")
    : { ok: true, value: matching };
}

const BP_PER_UNIT = 10000;
const ORE_PER_SEK = 100;

function bigintToOre(value: bigint): number | null {
  const numeric = Number(value);
  return isOreAmount(numeric) && BigInt(numeric) === value ? numeric : null;
}

function addOreValues(...values: readonly number[]): number | null {
  return bigintToOre(
    values.reduce((sum, value) => sum + BigInt(value), BigInt(0)),
  );
}

function roundedRatioOre(
  amountOre: number,
  numerator: number,
  denominator = BP_PER_UNIT,
): number | null {
  const denominatorBig = BigInt(denominator);
  return bigintToOre(
    (BigInt(amountOre) * BigInt(numerator) + denominatorBig / BigInt(2)) /
      denominatorBig,
  );
}

function wholeSekRatioOre(
  amountOre: number,
  numerator: number,
  denominator = BP_PER_UNIT,
): number | null {
  const wholeSek =
    (BigInt(amountOre) * BigInt(numerator)) /
    (BigInt(denominator) * BigInt(ORE_PER_SEK));
  return bigintToOre(wholeSek * BigInt(ORE_PER_SEK));
}

export interface GreenSchemeCategoryAmounts {
  readonly calculatedOre: number;
  /** A reconciled share of the one document-level whole-SEK green claim. */
  readonly claimOre: number;
}

export interface GreenSchemeAmounts {
  readonly calculatedOre: number;
  readonly claimOre: number;
  readonly categories: Readonly<Record<GreenCategory, GreenSchemeCategoryAmounts>>;
}

/**
 * Apply category-specific green rates as exact rationals, sum them, then truncate exactly once
 * at the scheme/document claim boundary. Category calculated amounts use largest remainder over
 * the exact rationals; the finalized claim is then reconciled across those category amounts in
 * canonical SOLAR/STORAGE/CHARGING order. No category is whole-SEK-truncated independently.
 */
export function calculateGreenSchemeAmounts(input: {
  readonly amountOreByCategory: Readonly<Record<GreenCategory, number>>;
  readonly rateBpByCategory: Readonly<Record<GreenCategory, number>>;
  readonly eligibleShareBp?: number;
}): TaxAnswerResult<GreenSchemeAmounts> {
  const shareBp = input.eligibleShareBp;
  if (shareBp !== undefined && !isVatRateBp(shareBp)) {
    return fail("INVALID_GREEN_BASIS_METHOD");
  }

  const denominator = BigInt(BP_PER_UNIT) *
    (input.eligibleShareBp === undefined ? BigInt(1) : BigInt(BP_PER_UNIT));
  const exactNumerators = {} as Record<GreenCategory, bigint>;
  let totalNumerator = BigInt(0);
  for (const category of GREEN_CATEGORIES) {
    const amountOre = input.amountOreByCategory[category];
    const rateBp = input.rateBpByCategory[category];
    if (!isOreAmount(amountOre) || !isVatRateBp(rateBp)) {
      return fail("INVALID_GREEN_BASIS_METHOD");
    }
    const numerator = BigInt(amountOre) * BigInt(shareBp ?? 1) * BigInt(rateBp);
    exactNumerators[category] = numerator;
    totalNumerator += numerator;
  }

  const calculatedOre = bigintToOre(totalNumerator / denominator);
  const claimOre = bigintToOre(
    (totalNumerator / (denominator * BigInt(ORE_PER_SEK))) * BigInt(ORE_PER_SEK),
  );
  if (calculatedOre === null || claimOre === null) return fail("ORE_OVERFLOW");

  const calculatedByCategory = {} as Record<GreenCategory, number>;
  let calculatedAllocated = 0;
  const calculatedRemainders = GREEN_CATEGORIES.map((category, order) => {
    const floor = bigintToOre(exactNumerators[category] / denominator);
    if (floor === null) return null;
    calculatedByCategory[category] = floor;
    calculatedAllocated += floor;
    return { category, order, remainder: exactNumerators[category] % denominator };
  });
  if (calculatedRemainders.some((entry) => entry === null)) return fail("ORE_OVERFLOW");
  let calculatedResidual = calculatedOre - calculatedAllocated;
  for (const entry of calculatedRemainders
    .filter((candidate) => candidate !== null)
    .sort((left, right) => {
      if (left.remainder > right.remainder) return -1;
      if (left.remainder < right.remainder) return 1;
      return left.order - right.order;
    })) {
    if (calculatedResidual <= 0) break;
    calculatedByCategory[entry.category] += 1;
    calculatedResidual -= 1;
  }

  const claimByCategory = Object.fromEntries(
    GREEN_CATEGORIES.map((category) => [category, 0]),
  ) as Record<GreenCategory, number>;
  if (claimOre > 0 && calculatedOre > 0) {
    let claimAllocated = 0;
    const claimRemainders = GREEN_CATEGORIES.map((category, order) => {
      const numerator = BigInt(claimOre) * BigInt(calculatedByCategory[category]);
      const floor = bigintToOre(numerator / BigInt(calculatedOre));
      if (floor === null) return null;
      claimByCategory[category] = floor;
      claimAllocated += floor;
      return { category, order, remainder: numerator % BigInt(calculatedOre) };
    });
    if (claimRemainders.some((entry) => entry === null)) return fail("ORE_OVERFLOW");
    let claimResidual = claimOre - claimAllocated;
    for (const entry of claimRemainders
      .filter((candidate) => candidate !== null)
      .sort((left, right) => {
        if (left.remainder > right.remainder) return -1;
        if (left.remainder < right.remainder) return 1;
        return left.order - right.order;
      })) {
      if (claimResidual <= 0) break;
      claimByCategory[entry.category] += 1;
      claimResidual -= 1;
    }
  }

  return ok(Object.freeze({
    calculatedOre,
    claimOre,
    categories: Object.freeze(Object.fromEntries(
      GREEN_CATEGORIES.map((category) => [category, Object.freeze({
        calculatedOre: calculatedByCategory[category],
        claimOre: claimByCategory[category],
      })]),
    ) as Record<GreenCategory, GreenSchemeCategoryAmounts>),
  }));
}

export interface DocumentVatRowInput {
  readonly id?: string;
  readonly netOre: number;
  /** Null only for explicitly quarantined legacy rows awaiting remediation. */
  readonly vatType: VatType | null;
  readonly rateBp: number | null;
  readonly includedInInvoiceTotal?: boolean;
  readonly deductionClassification?: DeductionClassification;
  /** Authoritative economic row kind for labor/material/other answer summaries. */
  readonly summaryCategory: TaxSummaryCategory;
}

export interface DocumentVatCategory {
  readonly vatType: VatType;
  readonly rateBp: number;
  readonly netOre: number;
  readonly vatOre: number;
  readonly grossOre: number;
}

export interface DocumentVatAggregate {
  readonly netOre: number;
  readonly vatOre: number;
  readonly grossOre: number;
  readonly categories: readonly DocumentVatCategory[];
}

export type TaxAnswerResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: string };

function fail<T>(code: string): TaxAnswerResult<T> {
  return { ok: false, code };
}

function ok<T>(value: T): TaxAnswerResult<T> {
  return { ok: true, value };
}

function vatCategoryKey(vatType: VatType, rateBp: number): string {
  return `${vatType}:${rateBp}`;
}

/** BigInt-backed, half-up category VAT authority shared by build and compatibility reads. */
export function calculateCategoryVatOre(
  vatType: VatType,
  netOre: number,
  rateBp: number,
): number | null {
  if (!isOreAmount(netOre) || !isVatRateBp(rateBp)) return null;
  if (vatType === "REVERSE_CHARGE_CONSTRUCTION") return 0;
  return roundedRatioOre(netOre, rateBp);
}

export function isCoherentVatTypeRate(
  vatType: VatType,
  rateBp: number,
  standardRateBp: number,
): boolean {
  if (!isVatRateBp(standardRateBp)) return false;
  // Fresh Story 10.6 facts use only policy-backed pairs. A numeric zero never
  // upgrades an ordinary supply to reverse charge, and reverse charge retains
  // the resolved underlying standard rate as its category identity.
  switch (vatType) {
    case "STANDARD_VAT_25":
      return rateBp === standardRateBp;
    case "REVERSE_CHARGE_CONSTRUCTION":
      return rateBp === standardRateBp;
    case "ZERO_RATED":
      return rateBp === 0;
    case "REDUCED_VAT":
      return rateBp === 600 || rateBp === 1200;
  }
}

/**
 * Aggregate VAT once per `(VatType, rateBp)` category after rounded line nets have
 * already been produced. Reverse charge is an explicit type with zero seller VAT;
 * a numeric zero rate alone never changes the type.
 */
export function aggregateDocumentVat(input: {
  readonly rows: readonly DocumentVatRowInput[];
  /** Standard VAT rate from the already-resolved quote-capture policy. */
  readonly standardRateBp: number;
}): TaxAnswerResult<DocumentVatAggregate> {
  if (!isVatRateBp(input.standardRateBp)) return fail("INVALID_VAT_RATE");
  const categories = new Map<string, { vatType: VatType; rateBp: number; netOre: number }>();
  for (const row of input.rows) {
    if (row.includedInInvoiceTotal === false) continue;
    if (!isOreAmount(row.netOre)) return fail("INVALID_ORE_AMOUNT");
    if (!isVatType(row.vatType)) return fail("INVALID_VAT_TYPE");
    if (
      row.deductionClassification !== undefined &&
      !isDeductionClassification(row.deductionClassification)
    ) {
      return fail("INVALID_DEDUCTION_CLASSIFICATION");
    }
    if (!isTaxSummaryCategory(row.summaryCategory)) {
      return fail("INVALID_SUMMARY_CATEGORY");
    }
    if (
      row.deductionClassification !== undefined &&
      !isDeductionClassificationCompatibleWithSummaryCategory(
        row.deductionClassification,
        row.summaryCategory,
      )
    ) {
      return fail("INVALID_DEDUCTION_CLASSIFICATION");
    }
    if (row.rateBp === null || !isVatRateBp(row.rateBp)) {
      return fail("INCOMPLETE_VAT_INPUT");
    }
    if (!isCoherentVatTypeRate(row.vatType, row.rateBp, input.standardRateBp)) {
      return fail("INCOMPLETE_VAT_INPUT");
    }
    const key = vatCategoryKey(row.vatType, row.rateBp);
    const current = categories.get(key) ?? {
      vatType: row.vatType,
      rateBp: row.rateBp,
      netOre: 0,
    };
    const nextNetOre = addOreValues(current.netOre, row.netOre);
    if (nextNetOre === null) return fail("ORE_OVERFLOW");
    current.netOre = nextNetOre;
    categories.set(key, current);
  }

  const computed: DocumentVatCategory[] = [];
  let netOre = 0;
  let vatOre = 0;
  const orderedCategories = [...categories.values()].sort((left, right) => {
    const typeOrder =
      VAT_TYPES.indexOf(left.vatType) - VAT_TYPES.indexOf(right.vatType);
    return typeOrder !== 0 ? typeOrder : left.rateBp - right.rateBp;
  });
  for (const category of orderedCategories) {
    const categoryVat = calculateCategoryVatOre(
      category.vatType,
      category.netOre,
      category.rateBp,
    );
    if (categoryVat === null) return fail("ORE_OVERFLOW");
    const grossOre = addOreValues(category.netOre, categoryVat);
    if (grossOre === null) return fail("ORE_OVERFLOW");
    computed.push(Object.freeze({ ...category, vatOre: categoryVat, grossOre }));
    const nextNet = addOreValues(netOre, category.netOre);
    const nextVat = addOreValues(vatOre, categoryVat);
    if (nextNet === null || nextVat === null) return fail("ORE_OVERFLOW");
    netOre = nextNet;
    vatOre = nextVat;
  }

  const grossOre = addOreValues(netOre, vatOre);
  if (grossOre === null) return fail("ORE_OVERFLOW");
  return ok(Object.freeze({
    netOre,
    vatOre,
    grossOre,
    categories: Object.freeze(computed),
  }));
}

export interface VatAllocationBucket {
  readonly deductionClassification: DeductionClassification;
  readonly netOre: number;
}

const CLASSIFICATION_ORDER = new Map(
  DEDUCTION_CLASSIFICATIONS.map((classification, index) => [classification, index]),
);

/**
 * Allocate already-rounded category VAT to classification buckets using largest
 * remainder. Ties are resolved by the canonical classification order, independent
 * of input order, and the result sums exactly to the category VAT.
 */
export function allocateCategoryVatByDeductionClassification(input: {
  readonly vatOre: number;
  readonly buckets: readonly VatAllocationBucket[];
}): TaxAnswerResult<Record<DeductionClassification, number>> {
  if (!isOreAmount(input.vatOre)) return fail("INVALID_ORE_AMOUNT");

  const netByClass = new Map<DeductionClassification, number>();
  for (const bucket of input.buckets) {
    if (!isOreAmount(bucket.netOre)) return fail("INVALID_ORE_AMOUNT");
    if (!isDeductionClassification(bucket.deductionClassification)) {
      return fail("INVALID_DEDUCTION_CLASSIFICATION");
    }
    const next = addOreValues(
      netByClass.get(bucket.deductionClassification) ?? 0,
      bucket.netOre,
    );
    if (next === null) return fail("ORE_OVERFLOW");
    netByClass.set(
      bucket.deductionClassification,
      next,
    );
  }

  const entries = [...netByClass.entries()]
    .filter(([, netOre]) => netOre > 0)
    .sort(
      ([left], [right]) =>
        (CLASSIFICATION_ORDER.get(left) ?? 999) - (CLASSIFICATION_ORDER.get(right) ?? 999),
    );
  const output = Object.fromEntries(
    entries.map(([classification]) => [classification, 0]),
  ) as Record<DeductionClassification, number>;
  const totalNet = entries.reduce((sum, [, netOre]) => sum + BigInt(netOre), BigInt(0));
  if (input.vatOre === 0 || totalNet === BigInt(0)) return ok(Object.freeze(output));

  const shares = entries.map(([classification, netOre]) => {
    const exactNumerator = BigInt(input.vatOre) * BigInt(netOre);
    const floor = bigintToOre(exactNumerator / totalNet);
    if (floor === null) return null;
    return {
      classification,
      floor,
      remainder: exactNumerator % totalNet,
      order: CLASSIFICATION_ORDER.get(classification) ?? 999,
    };
  });
  if (shares.some((share) => share === null)) return fail("ORE_OVERFLOW");
  const safeShares = shares.filter((share) => share !== null);
  let allocated = 0;
  for (const share of safeShares) {
    output[share.classification] = share.floor;
    const next = addOreValues(allocated, share.floor);
    if (next === null) return fail("ORE_OVERFLOW");
    allocated = next;
  }
  let remainderOre = input.vatOre - allocated;
  for (const share of [...safeShares].sort((a, b) => {
    if (a.remainder > b.remainder) return -1;
    if (a.remainder < b.remainder) return 1;
    return a.order - b.order;
  })) {
    if (remainderOre <= 0) break;
    output[share.classification] += 1;
    remainderOre -= 1;
  }
  return ok(Object.freeze(output));
}

/** @deprecated This helper is deliberately VAT-only; canonical payable is TaxAnswerSnapshotV2. */
export type ReconciledDocumentTotals = DocumentVatAggregate;

export function computeReconciledDocumentTotals(input: {
  readonly rows: readonly DocumentVatRowInput[];
  readonly standardRateBp: number;
}): TaxAnswerResult<ReconciledDocumentTotals> {
  return aggregateDocumentVat(input);
}


/** Discard öre below whole kronor at the tax-claim boundary. */
export function truncateClaimToWholeSekOre(claimOre: number): number | null {
  if (!isOreAmount(claimOre)) return null;
  return Math.floor(claimOre / ORE_PER_SEK) * ORE_PER_SEK;
}

export interface PersonAllowanceSlot {
  readonly slot: string;
  readonly remainingAllowanceOre: number;
  readonly remainingCombinedRotRutAllowanceOre?: number;
}

export interface PersonClaimAllocation {
  readonly appliedOre: number;
  readonly allocations: readonly { readonly slot: string; readonly ore: number }[];
}

export function allocateWholeSekClaimByPerson(input: {
  readonly candidateClaimOre: number;
  readonly perPersonCapOre: number;
  readonly combinedRotRutCapOre?: number;
  readonly persons: readonly PersonAllowanceSlot[];
}): TaxAnswerResult<PersonClaimAllocation> {
  if (
    !isOreAmount(input.candidateClaimOre) ||
    !isOreAmount(input.perPersonCapOre) ||
    (input.combinedRotRutCapOre !== undefined && !isOreAmount(input.combinedRotRutCapOre)) ||
    !Array.isArray(input.persons)
  ) {
    return fail("INVALID_CLAIM_ALLOCATION_INPUT");
  }

  const seen = new Set<string>();
  const capacities: { slot: string; capacityOre: number }[] = [];
  for (const person of input.persons) {
    if (typeof person.slot !== "string" || person.slot.length === 0) {
      return fail("INVALID_PERSON_SLOT");
    }
    if (seen.has(person.slot)) return fail("DUPLICATE_PERSON_SLOT");
    seen.add(person.slot);
    if (
      !isOreAmount(person.remainingAllowanceOre) ||
      (person.remainingCombinedRotRutAllowanceOre !== undefined &&
        !isOreAmount(person.remainingCombinedRotRutAllowanceOre))
    ) {
      return fail("INVALID_CLAIM_ALLOCATION_INPUT");
    }
    const combinedCap =
      person.remainingCombinedRotRutAllowanceOre ?? input.combinedRotRutCapOre ?? input.perPersonCapOre;
    const capacityOre = truncateClaimToWholeSekOre(
      Math.min(input.perPersonCapOre, person.remainingAllowanceOre, combinedCap),
    );
    if (capacityOre === null) return fail("INVALID_CLAIM_ALLOCATION_INPUT");
    capacities.push({
      slot: person.slot,
      capacityOre,
    });
  }

  const appliedOre = truncateClaimToWholeSekOre(input.candidateClaimOre);
  if (appliedOre === null) return fail("INVALID_CLAIM_ALLOCATION_INPUT");
  const capacityTotal = capacities.reduce(
    (sum, person) => sum + BigInt(person.capacityOre),
    BigInt(0),
  );
  if (capacityTotal < BigInt(appliedOre)) return fail("INSUFFICIENT_PERSON_ALLOWANCE");

  let remaining = appliedOre;
  const allocations = capacities
    .map((person) => {
      const ore = Math.min(person.capacityOre, remaining);
      remaining -= ore;
      return Object.freeze({ slot: person.slot, ore });
    })
    .filter((allocation) => allocation.ore > 0);
  return ok(Object.freeze({
    appliedOre,
    allocations: Object.freeze(allocations),
  }));
}

export interface ClassifiedDeductionPart {
  readonly id?: string;
  readonly classification: DeductionClassification;
  readonly greenClassification?: DeductionClassification;
  readonly eligibleCostOre: number;
}

export function estimateClassifiedDeductions(input: {
  readonly parts?: readonly ClassifiedDeductionPart[];
  readonly effectiveDate?: string;
  readonly basisMethod?: GreenBasisMethod;
  readonly genuineFixedPrice?: boolean;
  readonly fixedPriceOre?: number;
  readonly fixedPriceCategorySplitOre?: Partial<Record<GreenCategory, number>>;
}): TaxAnswerResult<{
  readonly basisMethod: GreenBasisMethod;
  readonly rotDeductionOre: number;
  readonly greenSolarDeductionOre: number;
  readonly greenStorageDeductionOre: number;
  readonly greenChargingDeductionOre: number;
}> {
  const policyResult = input.effectiveDate
    ? resolveTaxPolicy({ registry: TAX_POLICY_REGISTRY, effectiveDate: input.effectiveDate })
    : { ok: true as const, value: TAX_POLICY_2026 };
  if (!policyResult.ok) return fail(policyResult.code);
  const policy = policyResult.value;
  const basisMethod = input.basisMethod ?? policy.green.defaultBasisMethod;
  if (!isGreenBasisMethod(basisMethod)) return fail("INVALID_GREEN_BASIS_METHOD");

  let rotBasisOre = 0;
  const actualGreenBasis = { SOLAR: 0, STORAGE: 0, CHARGING: 0 };
  const seenPartIds = new Map<string, DeductionClassification>();
  for (const part of input.parts ?? []) {
    if (part.greenClassification !== undefined) return fail("DOUBLE_DEDUCTION_FEED");
    if (!isDeductionClassification(part.classification)) {
      return fail("INVALID_DEDUCTION_CLASSIFICATION");
    }
    if (!isOreAmount(part.eligibleCostOre)) return fail("INVALID_ORE_AMOUNT");
    if (part.id !== undefined) {
      const prior = seenPartIds.get(part.id);
      if (prior !== undefined && prior !== part.classification) {
        return fail("DOUBLE_DEDUCTION_FEED");
      }
      if (prior !== undefined) return fail("DUPLICATE_DEDUCTION_PART");
      seenPartIds.set(part.id, part.classification);
    }
    let next: number | null;
    switch (part.classification) {
      case "ROT_LABOR":
        next = addOreValues(rotBasisOre, part.eligibleCostOre);
        if (next === null) return fail("ORE_OVERFLOW");
        rotBasisOre = next;
        break;
      case "GREEN_SOLAR_LABOR":
      case "GREEN_SOLAR_MATERIAL":
        next = addOreValues(actualGreenBasis.SOLAR, part.eligibleCostOre);
        if (next === null) return fail("ORE_OVERFLOW");
        actualGreenBasis.SOLAR = next;
        break;
      case "GREEN_STORAGE_LABOR":
      case "GREEN_STORAGE_MATERIAL":
        next = addOreValues(actualGreenBasis.STORAGE, part.eligibleCostOre);
        if (next === null) return fail("ORE_OVERFLOW");
        actualGreenBasis.STORAGE = next;
        break;
      case "GREEN_CHARGING_LABOR":
      case "GREEN_CHARGING_MATERIAL":
        next = addOreValues(actualGreenBasis.CHARGING, part.eligibleCostOre);
        if (next === null) return fail("ORE_OVERFLOW");
        actualGreenBasis.CHARGING = next;
        break;
      case "NONE":
        break;
    }
  }

  const rotUncapped = wholeSekRatioOre(rotBasisOre, policy.rot.rateBp);
  if (rotUncapped === null) return fail("ORE_OVERFLOW");
  const rotDeductionOre = Math.min(
    rotUncapped,
    policy.rot.maxPerPersonYearOre,
    policy.rot.combinedRotRutMaxPerPersonYearOre,
  );

  const greenAmountOreByCategory = { SOLAR: 0, STORAGE: 0, CHARGING: 0 };
  let greenEligibleShareBp: number | undefined;

  if (basisMethod === "FIXED_PRICE_97_PERCENT") {
    if (input.genuineFixedPrice !== true) {
      return fail("FIXED_PRICE_97_REQUIRES_GENUINE_FIXED_PRICE");
    }
    if (!isOreAmount(input.fixedPriceOre)) return fail("INVALID_FIXED_PRICE_INPUT");
    const split = input.fixedPriceCategorySplitOre;
    if (split === undefined || split === null) return fail("INCOMPLETE_FIXED_PRICE_CATEGORY_SPLIT");
    let splitTotal = 0;
    for (const category of GREEN_CATEGORIES) {
      const value = split[category];
      if (!isOreAmount(value)) return fail("INCOMPLETE_FIXED_PRICE_CATEGORY_SPLIT");
      const next = addOreValues(splitTotal, value);
      if (next === null) return fail("ORE_OVERFLOW");
      splitTotal = next;
    }
    if (splitTotal !== input.fixedPriceOre) {
      return fail("INCOMPLETE_FIXED_PRICE_CATEGORY_SPLIT");
    }
    for (const category of GREEN_CATEGORIES) greenAmountOreByCategory[category] = split[category]!;
    greenEligibleShareBp = policy.green.fixedPriceEligibleShareBp;
  } else {
    for (const category of GREEN_CATEGORIES) {
      greenAmountOreByCategory[category] = actualGreenBasis[category];
    }
  }

  const greenAmounts = calculateGreenSchemeAmounts({
    amountOreByCategory: greenAmountOreByCategory,
    rateBpByCategory: policy.green.rateBpByCategory,
    ...(greenEligibleShareBp === undefined ? {} : { eligibleShareBp: greenEligibleShareBp }),
  });
  if (!greenAmounts.ok) return greenAmounts;

  let remainingGreenCap = policy.green.maxPerPersonYearOre;
  const cappedGreen = { SOLAR: 0, STORAGE: 0, CHARGING: 0 };
  for (const category of GREEN_CATEGORIES) {
    cappedGreen[category] = Math.min(
      greenAmounts.value.categories[category].claimOre,
      remainingGreenCap,
    );
    remainingGreenCap -= cappedGreen[category];
  }

  return ok(Object.freeze({
    basisMethod,
    rotDeductionOre,
    greenSolarDeductionOre: cappedGreen.SOLAR,
    greenStorageDeductionOre: cappedGreen.STORAGE,
    greenChargingDeductionOre: cappedGreen.CHARGING,
  }));
}
