import {
  DEDUCTION_CLASSIFICATIONS,
  GREEN_CATEGORIES,
  isOreAmount,
  isGreenBasisMethod,
  isCanonicalTaxPersonSlot,
  isCoherentVatTypeRate,
  isTaxDeductionChoice,
  isVatType,
  isValidBuyerVatNumber,
  isIsoCalendarDate,
  normalizeBuyerVatNumber,
  type DeductionClassification,
  type DocumentVatCategory,
  type FrozenPersonClaimAllocation,
  type GreenCategory,
  type GreenCategoryTaxAnswer,
  type ResolvedTaxPolicySnapshot,
  type TaxAnswerSnapshotV2,
  type TaxSummaryBucket,
} from "@/lib/money";
import { TAX_POLICY_REGISTRY } from "@/lib/money";

/** A fail-closed parse result for JSONB-loaded V2 tax answers. */
export type TaxAnswerSnapshotParseResult =
  | { readonly ok: true; readonly value: TaxAnswerSnapshotV2 }
  | { readonly ok: false; readonly code: "INVALID_V2_TAX_SNAPSHOT" };

/** The downstream-compatible view over a literal legacy row or a complete V2 answer. */
export type QuoteTaxCompatibilityView =
  | Readonly<{
      source: "legacy-v1";
      schemaVersion: 1;
      netOre: null;
      vatOre: number;
      /** V1 never froze a gross total independently of its payable scalar. */
      grossOre: null;
      /** V1 stored one deduction scalar, not the distinct calculated/claim facts. */
      calculatedDeductionOre: null;
      claimDeductionOre: null;
      deductionOre: number;
      payableOre: number;
      buyerVatNumber: null;
      reverseChargeApplied: false;
      categories: readonly [];
      summaries: null;
      taxAnswer: null;
    }>
  | Readonly<{
      source: "v2";
      schemaVersion: 2;
      netOre: number;
      vatOre: number;
      grossOre: number;
      calculatedDeductionOre: number;
      claimDeductionOre: number;
      deductionOre: number;
      payableOre: number;
      buyerVatNumber: string | null;
      reverseChargeApplied: boolean;
      categories: readonly DocumentVatCategory[];
      summaries: TaxAnswerSnapshotV2["summaries"];
      taxAnswer: TaxAnswerSnapshotV2;
    }>;

export interface QuoteTaxCompatibilitySource {
  readonly snapshotSchemaVersion?: number | null;
  readonly taxRuleVersion?: string | null;
  readonly taxAnswerSnapshot?: unknown;
  readonly buyerVatNumber?: string | null;
  readonly calculatedDeductionOre?: number | null;
  readonly claimDeductionOre?: number | null;
  readonly payableOre?: number | null;
  readonly vatOre: number;
  readonly deductionOre: number;
  readonly acceptedPriceOre: number;
}

export type QuoteTaxCompatibilityResult =
  | { readonly ok: true; readonly value: QuoteTaxCompatibilityView }
  | { readonly ok: false; readonly code: "INVALID_V2_TAX_SNAPSHOT" };

function invalid(): { readonly ok: false; readonly code: "INVALID_V2_TAX_SNAPSHOT" } {
  return { ok: false, code: "INVALID_V2_TAX_SNAPSHOT" };
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringOrNull(value: unknown): string | null | undefined {
  return value === null ? null : typeof value === "string" ? value : undefined;
}

function ore(value: unknown): number | null {
  return isOreAmount(value) ? value : null;
}

function sumOre(values: readonly number[]): number | null {
  const sum = values.reduce((total, value) => total + BigInt(value), BigInt(0));
  const numeric = Number(sum);
  return isOreAmount(numeric) && BigInt(numeric) === sum ? numeric : null;
}

function rateBp(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 10_000
    ? (value as number)
    : null;
}

function parsePolicy(value: unknown): ResolvedTaxPolicySnapshot | null | undefined {
  if (value === null) return null;
  const raw = recordOf(value);
  const values = raw === null ? null : recordOf(raw.values);
  const vat = values === null ? null : recordOf(values.vat);
  const rot = values === null ? null : recordOf(values.rot);
  const green = values === null ? null : recordOf(values.green);
  const greenRates = green === null ? null : recordOf(green.rateBpByCategory);
  const standardRateBp = vat === null ? null : rateBp(vat.standardRateBp);
  const rotRateBp = rot === null ? null : rateBp(rot.rateBp);
  const rotCapOre = rot === null ? null : ore(rot.maxPerPersonYearOre);
  const combinedRotRutCapOre = rot === null ? null : ore(rot.combinedRotRutMaxPerPersonYearOre);
  const greenCapOre = green === null ? null : ore(green.maxPerPersonYearOre);
  const fixedPriceEligibleShareBp = green === null
    ? null
    : rateBp(green.fixedPriceEligibleShareBp);
  const greenRateBpByCategory = {} as Record<GreenCategory, number>;
  if (greenRates !== null) {
    for (const category of GREEN_CATEGORIES) {
      const categoryRate = rateBp(greenRates[category]);
      if (categoryRate === null) return undefined;
      greenRateBpByCategory[category] = categoryRate;
    }
  }
  if (
    raw === null ||
    typeof raw.id !== "string" ||
    !isIsoCalendarDate(raw.validFrom) ||
    (raw.validTo !== null && !isIsoCalendarDate(raw.validTo)) ||
    !isIsoCalendarDate(raw.resolvingDate) ||
    (raw.validTo !== null && raw.validTo <= raw.validFrom) ||
    raw.resolvingDate < raw.validFrom ||
    (raw.validTo !== null && raw.resolvingDate >= raw.validTo) ||
    (raw.resolvingFact !== "QUOTE_CAPTURE_DATE" &&
      raw.resolvingFact !== "ROT_PAYMENT_DATE" &&
      raw.resolvingFact !== "GREEN_FINAL_PAYMENT_DATE") ||
    standardRateBp === null ||
    rotRateBp === null ||
    rotCapOre === null ||
    combinedRotRutCapOre === null ||
    greenCapOre === null ||
    fixedPriceEligibleShareBp === null ||
    greenRates === null ||
    !isGreenBasisMethod(green?.defaultBasisMethod)
  ) {
    return undefined;
  }
  const canonical = TAX_POLICY_REGISTRY.find((policy) => policy.id === raw.id);
  if (
    canonical === undefined ||
    canonical.validFrom !== raw.validFrom ||
    // Existing V2 drafts created before the finite-horizon correction froze a
    // nullable end. They remain readable as historic commitments; fresh writes
    // always use the finite canonical window.
    (canonical.validTo !== raw.validTo &&
      !(canonical.id === "SE-TAX-2026-v1" && raw.validTo === null)) ||
    canonical.vat.standardRateBp !== standardRateBp ||
    canonical.rot.rateBp !== rotRateBp ||
    canonical.rot.maxPerPersonYearOre !== rotCapOre ||
    canonical.rot.combinedRotRutMaxPerPersonYearOre !== combinedRotRutCapOre ||
    canonical.green.maxPerPersonYearOre !== greenCapOre ||
    canonical.green.defaultBasisMethod !== green?.defaultBasisMethod ||
    canonical.green.fixedPriceEligibleShareBp !== fixedPriceEligibleShareBp ||
    GREEN_CATEGORIES.some(
      (category) => canonical.green.rateBpByCategory[category] !== greenRateBpByCategory[category],
    )
  ) {
    return undefined;
  }
  return Object.freeze({
    id: raw.id,
    validFrom: raw.validFrom,
    validTo: raw.validTo as string | null,
    resolvingDate: raw.resolvingDate,
    resolvingFact: raw.resolvingFact,
    values: Object.freeze({
      vat: Object.freeze({ standardRateBp }),
      rot: Object.freeze({
        rateBp: rotRateBp,
        maxPerPersonYearOre: rotCapOre,
        combinedRotRutMaxPerPersonYearOre: combinedRotRutCapOre,
      }),
      green: Object.freeze({
        rateBpByCategory: Object.freeze(greenRateBpByCategory),
        maxPerPersonYearOre: greenCapOre,
        defaultBasisMethod: green.defaultBasisMethod,
        fixedPriceEligibleShareBp,
      }),
    }),
  });
}

function parseAllocations(value: unknown): readonly FrozenPersonClaimAllocation[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const result: FrozenPersonClaimAllocation[] = [];
  for (const candidate of value) {
    const raw = recordOf(candidate);
    const amount = raw === null ? null : ore(raw.ore);
    if (
      raw === null ||
      !isCanonicalTaxPersonSlot(raw.slot) ||
      seen.has(raw.slot) ||
      amount === null ||
      amount % 100 !== 0
    ) {
      return null;
    }
    seen.add(raw.slot);
    result.push(Object.freeze({ slot: raw.slot, ore: amount }));
  }
  return Object.freeze(result);
}

function parseSummary(value: unknown): TaxSummaryBucket | null {
  const raw = recordOf(value);
  if (raw === null) return null;
  const netOre = ore(raw.netOre);
  const vatOre = ore(raw.vatOre);
  const grossOre = ore(raw.grossOre);
  if (netOre === null || vatOre === null || grossOre === null || netOre + vatOre !== grossOre) {
    return null;
  }
  return Object.freeze({ netOre, vatOre, grossOre });
}

function parseClassificationRecord(
  value: unknown,
): Readonly<Record<DeductionClassification, number>> | null {
  const raw = recordOf(value);
  if (raw === null) return null;
  const result = {} as Record<DeductionClassification, number>;
  for (const classification of DEDUCTION_CLASSIFICATIONS) {
    const amount = ore(raw[classification]);
    if (amount === null) return null;
    result[classification] = amount;
  }
  return Object.freeze(result);
}

function parseCategory(value: unknown): DocumentVatCategory | null {
  const raw = recordOf(value);
  if (raw === null || !isVatType(raw.vatType)) return null;
  const rate = rateBp(raw.rateBp);
  const netOre = ore(raw.netOre);
  const vatOre = ore(raw.vatOre);
  const grossOre = ore(raw.grossOre);
  if (
    rate === null ||
    netOre === null ||
    vatOre === null ||
    grossOre === null ||
    netOre + vatOre !== grossOre ||
    !isCoherentVatTypeRate(raw.vatType, rate) ||
    (raw.vatType === "REVERSE_CHARGE_CONSTRUCTION" && vatOre !== 0) ||
    (raw.vatType !== "REVERSE_CHARGE_CONSTRUCTION" &&
      vatOre !== Math.floor((netOre * rate + 5_000) / 10_000))
  ) {
    return null;
  }
  return Object.freeze({ vatType: raw.vatType, rateBp: rate, netOre, vatOre, grossOre });
}

function parseGreenCategory(
  value: unknown,
  expected: GreenCategory,
): GreenCategoryTaxAnswer | null {
  const raw = recordOf(value);
  if (raw === null || raw.category !== expected) return null;
  const basisOre = ore(raw.basisOre);
  const calculatedOre = ore(raw.calculatedOre);
  const claimOre = ore(raw.claimOre);
  if (
    basisOre === null ||
    calculatedOre === null ||
    claimOre === null ||
    claimOre % 100 !== 0
  ) {
    return null;
  }
  return Object.freeze({ category: expected, basisOre, calculatedOre, claimOre });
}

/**
 * Parse JSONB into a complete typed V2 answer. The function copies every nested value and
 * deep-freezes the copy, so mutable DB-driver objects cannot mutate a quote commitment later.
 */
export function parseTaxAnswerSnapshotV2(rawValue: unknown): TaxAnswerSnapshotParseResult {
  const raw = recordOf(rawValue);
  if (
    raw === null ||
    raw.schemaVersion !== 2 ||
    !Array.isArray(raw.taxRuleVersions) ||
    raw.taxRuleVersions.length === 0 ||
    !raw.taxRuleVersions.every((value) => typeof value === "string" && value.length > 0) ||
    !isVatType(raw.documentVatType) ||
    !isTaxDeductionChoice(raw.deductionChoice) ||
    typeof raw.reverseChargeApplied !== "boolean"
  ) {
    return invalid();
  }
  const vatPolicy = parsePolicy(raw.vatPolicy);
  if (vatPolicy === null || vatPolicy === undefined || vatPolicy.resolvingFact !== "QUOTE_CAPTURE_DATE") {
    return invalid();
  }
  const buyerVatNumber = stringOrNull(raw.buyerVatNumber);
  if (
    buyerVatNumber === undefined ||
    (buyerVatNumber !== null &&
      (!isValidBuyerVatNumber(buyerVatNumber) ||
        normalizeBuyerVatNumber(buyerVatNumber) !== buyerVatNumber)) ||
    (raw.reverseChargeApplied && buyerVatNumber === null)
  ) {
    return invalid();
  }
  if (!Array.isArray(raw.categories)) return invalid();
  const categories: DocumentVatCategory[] = [];
  const categoryKeys = new Set<string>();
  for (const candidate of raw.categories) {
    const category = parseCategory(candidate);
    if (category === null) return invalid();
    const key = `${category.vatType}:${category.rateBp}`;
    if (categoryKeys.has(key)) return invalid();
    categoryKeys.add(key);
    categories.push(category);
  }
  const hasReverse = categories.some(
    (category) => category.vatType === "REVERSE_CHARGE_CONSTRUCTION",
  );
  if (
    hasReverse !== raw.reverseChargeApplied ||
    (raw.documentVatType !== "STANDARD_VAT_25" &&
      raw.documentVatType !== "REVERSE_CHARGE_CONSTRUCTION") ||
    (raw.documentVatType === "REVERSE_CHARGE_CONSTRUCTION") !== hasReverse
  ) return invalid();

  const netBy = parseClassificationRecord(raw.netByDeductionClassification);
  const vatBy = parseClassificationRecord(raw.vatByDeductionClassification);
  const summariesRaw = recordOf(raw.summaries);
  const labor = summariesRaw === null ? null : parseSummary(summariesRaw.labor);
  const material = summariesRaw === null ? null : parseSummary(summariesRaw.material);
  const other = summariesRaw === null ? null : parseSummary(summariesRaw.other);
  if (netBy === null || vatBy === null || labor === null || material === null || other === null) {
    return invalid();
  }

  const rotRaw = recordOf(raw.rot);
  const rotPolicy = rotRaw === null ? undefined : parsePolicy(rotRaw.policy);
  const rotBasisNetOre = rotRaw === null ? null : ore(rotRaw.basisNetOre);
  const rotAllocatedVatOre = rotRaw === null ? null : ore(rotRaw.allocatedVatOre);
  const rotBasisOre = rotRaw === null ? null : ore(rotRaw.basisOre);
  const rotCalculatedOre = rotRaw === null ? null : ore(rotRaw.calculatedOre);
  const rotClaimOre = rotRaw === null ? null : ore(rotRaw.claimOre);
  const rotAllocations = rotRaw === null ? null : parseAllocations(rotRaw.allocations);
  if (
    rotRaw === null ||
    rotPolicy === undefined ||
    rotBasisNetOre === null ||
    rotAllocatedVatOre === null ||
    rotBasisOre === null ||
    rotCalculatedOre === null ||
    rotClaimOre === null ||
    rotAllocations === null ||
    rotBasisNetOre + rotAllocatedVatOre !== rotBasisOre ||
    rotClaimOre % 100 !== 0
  ) {
    return invalid();
  }

  const greenRaw = recordOf(raw.green);
  const greenPolicy = greenRaw === null ? undefined : parsePolicy(greenRaw.policy);
  if (
    greenRaw === null ||
    greenPolicy === undefined ||
    (greenRaw.basisMethod !== "ACTUAL_ELIGIBLE_COSTS" &&
      greenRaw.basisMethod !== "FIXED_PRICE_97_PERCENT")
  ) {
    return invalid();
  }
  const greenCategoriesRaw = recordOf(greenRaw.categories);
  if (greenCategoriesRaw === null) return invalid();
  const greenCategories = {} as Record<GreenCategory, GreenCategoryTaxAnswer>;
  for (const category of GREEN_CATEGORIES) {
    const parsed = parseGreenCategory(greenCategoriesRaw[category], category);
    if (parsed === null) return invalid();
    greenCategories[category] = parsed;
  }
  const greenCalculatedOre = ore(greenRaw.calculatedOre);
  const greenClaimOre = ore(greenRaw.claimOre);
  const greenAllocations = parseAllocations(greenRaw.allocations);
  if (
    greenCalculatedOre === null ||
    greenClaimOre === null ||
    greenClaimOre % 100 !== 0 ||
    greenAllocations === null
  ) {
    return invalid();
  }

  const netOre = ore(raw.netOre);
  const vatOre = ore(raw.vatOre);
  const grossOre = ore(raw.grossOre);
  const calculatedDeductionOre = ore(raw.calculatedDeductionOre);
  const claimDeductionOre = ore(raw.claimDeductionOre);
  const deductionOre = ore(raw.deductionOre);
  const payableOre = ore(raw.payableOre);
  if (
    netOre === null ||
    vatOre === null ||
    grossOre === null ||
    calculatedDeductionOre === null ||
    claimDeductionOre === null ||
    deductionOre === null ||
    payableOre === null ||
    netOre + vatOre !== grossOre ||
    grossOre - deductionOre !== payableOre ||
    claimDeductionOre !== deductionOre ||
    rotCalculatedOre + greenCalculatedOre !== calculatedDeductionOre ||
    rotClaimOre + greenClaimOre !== claimDeductionOre
  ) {
    return invalid();
  }
  const categoryNet = sumOre(categories.map((category) => category.netOre));
  const categoryVat = sumOre(categories.map((category) => category.vatOre));
  const categoryGross = sumOre(categories.map((category) => category.grossOre));
  const classifiedNet = sumOre(
    DEDUCTION_CLASSIFICATIONS.map((classification) => netBy[classification]),
  );
  const classifiedVat = sumOre(
    DEDUCTION_CLASSIFICATIONS.map((classification) => vatBy[classification]),
  );
  const summaryNet = sumOre([labor.netOre, material.netOre, other.netOre]);
  const summaryVat = sumOre([labor.vatOre, material.vatOre, other.vatOre]);
  const summaryGross = sumOre([labor.grossOre, material.grossOre, other.grossOre]);
  const rotAllocationTotal = sumOre(rotAllocations.map((allocation) => allocation.ore));
  const greenAllocationTotal = sumOre(greenAllocations.map((allocation) => allocation.ore));
  const greenCategoryCalculated = sumOre(
    GREEN_CATEGORIES.map((category) => greenCategories[category].calculatedOre),
  );
  const greenCategoryClaim = sumOre(
    GREEN_CATEGORIES.map((category) => greenCategories[category].claimOre),
  );
  const usesRot = raw.deductionChoice === "ROT" || raw.deductionChoice === "ROT_AND_GREEN";
  const usesGreen = raw.deductionChoice === "GREEN" || raw.deductionChoice === "ROT_AND_GREEN";
  const ruleVersions = raw.taxRuleVersions as string[];
  const uniqueSortedRuleVersions = [...new Set(ruleVersions)].sort();
  const unusedRotHasFacts =
    rotBasisNetOre !== 0 ||
    rotAllocatedVatOre !== 0 ||
    rotBasisOre !== 0 ||
    rotCalculatedOre !== 0 ||
    rotClaimOre !== 0 ||
    rotAllocations.length !== 0;
  const unusedGreenHasFacts =
    greenCalculatedOre !== 0 ||
    greenClaimOre !== 0 ||
    greenAllocations.length !== 0 ||
    GREEN_CATEGORIES.some((category) => {
      const value = greenCategories[category];
      return value.basisOre !== 0 || value.calculatedOre !== 0 || value.claimOre !== 0;
    });
  if (
    categoryNet !== netOre ||
    categoryVat !== vatOre ||
    categoryGross !== grossOre ||
    classifiedNet !== netOre ||
    classifiedVat !== vatOre ||
    summaryNet !== netOre ||
    summaryVat !== vatOre ||
    summaryGross !== grossOre ||
    rotAllocationTotal !== rotClaimOre ||
    greenAllocationTotal !== greenClaimOre ||
    greenCategoryCalculated !== greenCalculatedOre ||
    greenCategoryClaim !== greenClaimOre ||
    ruleVersions.length !== uniqueSortedRuleVersions.length ||
    ruleVersions.some((version, index) => version !== uniqueSortedRuleVersions[index]) ||
    !ruleVersions.includes(vatPolicy.id) ||
    (usesRot
      ? rotPolicy === null || rotPolicy.resolvingFact !== "ROT_PAYMENT_DATE"
      : rotPolicy !== null || unusedRotHasFacts) ||
    (usesGreen
      ? greenPolicy === null || greenPolicy.resolvingFact !== "GREEN_FINAL_PAYMENT_DATE"
      : greenPolicy !== null || unusedGreenHasFacts) ||
    (raw.reverseChargeApplied && raw.documentVatType !== "REVERSE_CHARGE_CONSTRUCTION") ||
    (rotPolicy !== null && !ruleVersions.includes(rotPolicy.id)) ||
    (greenPolicy !== null && !ruleVersions.includes(greenPolicy.id)) ||
    ruleVersions.some((id) => !TAX_POLICY_REGISTRY.some((policy) => policy.id === id)) ||
    !sameRuleVersionSet(ruleVersions, vatPolicy, rotPolicy, greenPolicy)
  ) {
    return invalid();
  }

  const answer: TaxAnswerSnapshotV2 = Object.freeze({
    schemaVersion: 2,
    taxRuleVersions: Object.freeze([...(raw.taxRuleVersions as string[])]),
    vatPolicy,
    documentVatType: raw.documentVatType,
    buyerVatNumber,
    reverseChargeApplied: raw.reverseChargeApplied,
    deductionChoice: raw.deductionChoice,
    categories: Object.freeze(categories),
    netByDeductionClassification: netBy,
    vatByDeductionClassification: vatBy,
    summaries: Object.freeze({ labor, material, other }),
    rot: Object.freeze({
      policy: rotPolicy,
      basisNetOre: rotBasisNetOre,
      allocatedVatOre: rotAllocatedVatOre,
      basisOre: rotBasisOre,
      calculatedOre: rotCalculatedOre,
      claimOre: rotClaimOre,
      allocations: rotAllocations,
    }),
    green: Object.freeze({
      policy: greenPolicy,
      basisMethod: greenRaw.basisMethod,
      categories: Object.freeze(greenCategories),
      calculatedOre: greenCalculatedOre,
      claimOre: greenClaimOre,
      allocations: greenAllocations,
    }),
    netOre,
    vatOre,
    grossOre,
    calculatedDeductionOre,
    claimDeductionOre,
    deductionOre,
    payableOre,
  });
  return { ok: true, value: answer };
}

function sameRuleVersionSet(
  ruleVersions: readonly string[],
  vatPolicy: ResolvedTaxPolicySnapshot,
  rotPolicy: ResolvedTaxPolicySnapshot | null,
  greenPolicy: ResolvedTaxPolicySnapshot | null,
): boolean {
  const expected = new Set([vatPolicy.id]);
  if (rotPolicy !== null) expected.add(rotPolicy.id);
  if (greenPolicy !== null) expected.add(greenPolicy.id);
  return ruleVersions.length === expected.size && ruleVersions.every((id) => expected.has(id));
}

/**
 * Explicit compatibility boundary. Legacy rows are returned literally from their frozen scalar
 * columns; V2 rows require the complete typed answer and matching duplicated scalar columns.
 */
export function adaptQuoteTaxSnapshot(
  source: QuoteTaxCompatibilitySource,
): QuoteTaxCompatibilityResult {
  const version = source.snapshotSchemaVersion ?? 1;
  if (version === 1) {
    if (
      !isOreAmount(source.vatOre) ||
      !isOreAmount(source.deductionOre) ||
      !isOreAmount(source.acceptedPriceOre)
    ) {
      return invalid();
    }
    return {
      ok: true,
      value: Object.freeze({
        source: "legacy-v1",
        schemaVersion: 1,
        netOre: null,
        vatOre: source.vatOre,
        grossOre: null,
        calculatedDeductionOre: null,
        claimDeductionOre: null,
        deductionOre: source.deductionOre,
        payableOre: source.acceptedPriceOre,
        buyerVatNumber: null,
        reverseChargeApplied: false,
        categories: Object.freeze([]) as readonly [],
        summaries: null,
        taxAnswer: null,
      }),
    };
  }
  if (version !== 2) return invalid();
  const parsed = parseTaxAnswerSnapshotV2(source.taxAnswerSnapshot);
  if (!parsed.ok) return parsed;
  const answer = parsed.value;
  const taxRuleVersion = source.taxRuleVersion ?? null;
  if (
    !isOreAmount(source.vatOre) ||
    !isOreAmount(source.deductionOre) ||
    !isOreAmount(source.acceptedPriceOre) ||
    source.payableOre === null ||
    source.payableOre === undefined ||
    source.calculatedDeductionOre === null ||
    source.calculatedDeductionOre === undefined ||
    source.claimDeductionOre === null ||
    source.claimDeductionOre === undefined ||
    source.vatOre !== answer.vatOre ||
    source.deductionOre !== answer.deductionOre ||
    source.acceptedPriceOre !== answer.payableOre ||
    source.payableOre !== answer.payableOre ||
    source.calculatedDeductionOre !== answer.calculatedDeductionOre ||
    source.claimDeductionOre !== answer.claimDeductionOre ||
    (source.buyerVatNumber ?? null) !== answer.buyerVatNumber ||
    taxRuleVersion !== answer.taxRuleVersions.join("+")
  ) {
    return invalid();
  }
  return {
    ok: true,
    value: Object.freeze({
      source: "v2",
      schemaVersion: 2,
      netOre: answer.netOre,
      vatOre: answer.vatOre,
      grossOre: answer.grossOre,
      calculatedDeductionOre: answer.calculatedDeductionOre,
      claimDeductionOre: answer.claimDeductionOre,
      deductionOre: answer.deductionOre,
      payableOre: answer.payableOre,
      buyerVatNumber: answer.buyerVatNumber,
      reverseChargeApplied: answer.reverseChargeApplied,
      categories: answer.categories,
      summaries: answer.summaries,
      taxAnswer: answer,
    }),
  };
}
