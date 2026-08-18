import {
  DEDUCTION_CLASSIFICATIONS,
  GREEN_CATEGORIES,
  calculateGreenSchemeAmounts,
  calculateCategoryVatOre,
  isOreAmount,
  isCustomerEligibilityPosture,
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

const BP_PER_UNIT = BigInt(10_000);
const ORE_PER_SEK = BigInt(100);

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

function floorRatioOre(
  amountOre: number,
  numerator: bigint,
  denominator = BP_PER_UNIT,
): number | null {
  const value = (BigInt(amountOre) * numerator) / denominator;
  const numeric = Number(value);
  return isOreAmount(numeric) && BigInt(numeric) === value ? numeric : null;
}

function wholeSekRatioOre(
  amountOre: number,
  numerator: bigint,
  denominator = BP_PER_UNIT,
): number | null {
  const value =
    ((BigInt(amountOre) * numerator) / (denominator * ORE_PER_SEK)) * ORE_PER_SEK;
  const numeric = Number(value);
  return isOreAmount(numeric) && BigInt(numeric) === value ? numeric : null;
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
    raw.id.length === 0 ||
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

interface HistoricalClaimAllocation {
  readonly sourceSlot: string;
  readonly ore: number;
}

/** The bounded identifier shape accepted by the original V2 allocation writer. */
function isHistoricalAllocationSlot(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value);
}

function parseHistoricalAllocations(value: unknown): readonly HistoricalClaimAllocation[] | null {
  if (!Array.isArray(value) || value.length > 50) return null;
  const seen = new Set<string>();
  const result: HistoricalClaimAllocation[] = [];
  for (const candidate of value) {
    const raw = recordOf(candidate);
    const amount = raw === null ? null : ore(raw.ore);
    if (
      raw === null ||
      !isHistoricalAllocationSlot(raw.slot) ||
      seen.has(raw.slot) ||
      amount === null ||
      amount % 100 !== 0
    ) {
      return null;
    }
    seen.add(raw.slot);
    result.push({ sourceSlot: raw.slot, ore: amount });
  }
  return result;
}

/**
 * Historic V2 JSON could carry a bounded opaque/name-like allocation id. Never expose that value
 * downstream: reserve existing canonical positions, then map every other shared ROT/green identity
 * to the next free `PERSON_n` slot. The two arrays retain their original order and amounts.
 */
function normalizeAllocationSlots(
  rot: readonly HistoricalClaimAllocation[],
  green: readonly HistoricalClaimAllocation[],
): Readonly<{
  rot: readonly FrozenPersonClaimAllocation[];
  green: readonly FrozenPersonClaimAllocation[];
}> | null {
  const all = [...rot, ...green];
  const slotBySource = new Map<string, string>();
  const reservedCanonicalSlots = new Set<string>();

  for (const allocation of all) {
    if (!isCanonicalTaxPersonSlot(allocation.sourceSlot)) continue;
    slotBySource.set(allocation.sourceSlot, allocation.sourceSlot);
    reservedCanonicalSlots.add(allocation.sourceSlot);
  }

  let nextCanonicalIndex = 1;
  for (const allocation of all) {
    if (slotBySource.has(allocation.sourceSlot)) continue;
    while (
      nextCanonicalIndex <= 50 &&
      reservedCanonicalSlots.has(`PERSON_${nextCanonicalIndex}`)
    ) {
      nextCanonicalIndex += 1;
    }
    if (nextCanonicalIndex > 50) return null;
    const canonicalSlot = `PERSON_${nextCanonicalIndex}`;
    slotBySource.set(allocation.sourceSlot, canonicalSlot);
    reservedCanonicalSlots.add(canonicalSlot);
    nextCanonicalIndex += 1;
  }

  const normalize = (
    allocations: readonly HistoricalClaimAllocation[],
  ): readonly FrozenPersonClaimAllocation[] => Object.freeze(
    allocations.map((allocation) => Object.freeze({
      slot: slotBySource.get(allocation.sourceSlot)!,
      ore: allocation.ore,
    })),
  );

  return Object.freeze({ rot: normalize(rot), green: normalize(green) });
}

function parseSummary(value: unknown): TaxSummaryBucket | null {
  const raw = recordOf(value);
  if (raw === null) return null;
  const netOre = ore(raw.netOre);
  const vatOre = ore(raw.vatOre);
  const grossOre = ore(raw.grossOre);
  if (
    netOre === null ||
    vatOre === null ||
    grossOre === null ||
    sumOre([netOre, vatOre]) !== grossOre
  ) {
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

function parseCategory(value: unknown, standardRateBp: number): DocumentVatCategory | null {
  const raw = recordOf(value);
  if (raw === null || !isVatType(raw.vatType)) return null;
  const rate = rateBp(raw.rateBp);
  const netOre = ore(raw.netOre);
  const vatOre = ore(raw.vatOre);
  const grossOre = ore(raw.grossOre);
  const calculatedVatOre =
    rate === null || netOre === null
      ? null
      : calculateCategoryVatOre(raw.vatType, netOre, rate);
  if (
    rate === null ||
    netOre === null ||
    vatOre === null ||
    grossOre === null ||
    sumOre([netOre, vatOre]) !== grossOre ||
    !isCoherentVatTypeRate(raw.vatType, rate, standardRateBp) ||
    calculatedVatOre === null ||
    vatOre !== calculatedVatOre
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
    claimOre === null
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
    !isCustomerEligibilityPosture(raw.customerEligibilityPosture) ||
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
    (raw.reverseChargeApplied ? buyerVatNumber === null : buyerVatNumber !== null)
  ) {
    return invalid();
  }
  if (!Array.isArray(raw.categories)) return invalid();
  const categories: DocumentVatCategory[] = [];
  const categoryKeys = new Set<string>();
  for (const candidate of raw.categories) {
    const category = parseCategory(candidate, vatPolicy.values.vat.standardRateBp);
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
  const historicalRotAllocations =
    rotRaw === null ? null : parseHistoricalAllocations(rotRaw.allocations);
  if (
    rotRaw === null ||
    rotPolicy === undefined ||
    rotBasisNetOre === null ||
    rotAllocatedVatOre === null ||
    rotBasisOre === null ||
    rotCalculatedOre === null ||
    rotClaimOre === null ||
    historicalRotAllocations === null ||
    sumOre([rotBasisNetOre, rotAllocatedVatOre]) !== rotBasisOre ||
    rotClaimOre % 100 !== 0
  ) {
    return invalid();
  }

  const greenRaw = recordOf(raw.green);
  const greenPolicy = greenRaw === null ? undefined : parsePolicy(greenRaw.policy);
  const greenBasisMethod = greenRaw?.basisMethod;
  if (
    greenRaw === null ||
    greenPolicy === undefined ||
    (greenBasisMethod !== "ACTUAL_ELIGIBLE_COSTS" &&
      greenBasisMethod !== "FIXED_PRICE_97_PERCENT")
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
  const historicalGreenAllocations = parseHistoricalAllocations(greenRaw.allocations);
  if (
    greenCalculatedOre === null ||
    greenClaimOre === null ||
    greenClaimOre % 100 !== 0 ||
    historicalGreenAllocations === null
  ) {
    return invalid();
  }
  const normalizedAllocations = normalizeAllocationSlots(
    historicalRotAllocations,
    historicalGreenAllocations,
  );
  if (normalizedAllocations === null) return invalid();
  const rotAllocations = normalizedAllocations.rot;
  const greenAllocations = normalizedAllocations.green;

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
    sumOre([netOre, vatOre]) !== grossOre ||
    sumOre([payableOre, deductionOre]) !== grossOre ||
    claimDeductionOre !== deductionOre ||
    sumOre([rotCalculatedOre, greenCalculatedOre]) !== calculatedDeductionOre ||
    sumOre([rotClaimOre, greenClaimOre]) !== claimDeductionOre
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
  const expectedRotCalculatedOre =
    usesRot && rotPolicy !== null
      ? floorRatioOre(rotBasisOre, BigInt(rotPolicy.values.rot.rateBp))
      : 0;
  const expectedRotClaimOre =
    usesRot && rotPolicy !== null
      ? wholeSekRatioOre(rotBasisOre, BigInt(rotPolicy.values.rot.rateBp))
      : 0;
  const rotAllocationCapOre = rotPolicy === null
    ? null
    : Math.min(
        rotPolicy.values.rot.maxPerPersonYearOre,
        rotPolicy.values.rot.combinedRotRutMaxPerPersonYearOre,
      );
  const rotMathMatches =
    (!usesRot ||
      (rotPolicy !== null &&
        rotBasisNetOre === netBy.ROT_LABOR &&
        rotAllocatedVatOre === vatBy.ROT_LABOR &&
        expectedRotCalculatedOre === rotCalculatedOre &&
        expectedRotClaimOre === rotClaimOre)) &&
    (rotAllocationCapOre === null ||
      rotAllocations.every((allocation) => allocation.ore <= rotAllocationCapOre));

  let greenMathMatches = true;
  if (usesGreen) {
    if (greenPolicy === null) {
      greenMathMatches = false;
    } else {
      const greenGrossByCategory = {} as Record<GreenCategory, number>;
      for (const category of GREEN_CATEGORIES) {
        const laborClassification = `GREEN_${category}_LABOR` as DeductionClassification;
        const materialClassification = `GREEN_${category}_MATERIAL` as DeductionClassification;
        const classifiedGrossOre = sumOre([
          netBy[laborClassification],
          vatBy[laborClassification],
          netBy[materialClassification],
          vatBy[materialClassification],
        ]);
        if (classifiedGrossOre === null) {
          greenMathMatches = false;
          break;
        }
        greenGrossByCategory[category] = classifiedGrossOre;
        const policyGreen = greenPolicy.values.green;
        const isFixedPrice = greenBasisMethod === "FIXED_PRICE_97_PERCENT";
        const expectedBasisOre = isFixedPrice
          ? floorRatioOre(classifiedGrossOre, BigInt(policyGreen.fixedPriceEligibleShareBp))
          : classifiedGrossOre;
        const frozenCategory = greenCategories[category];
        if (expectedBasisOre !== frozenCategory.basisOre) {
          greenMathMatches = false;
          break;
        }
      }
      const policyGreen = greenPolicy.values.green;
      const expectedGreenAmounts = calculateGreenSchemeAmounts({
        amountOreByCategory: greenGrossByCategory,
        rateBpByCategory: policyGreen.rateBpByCategory,
        ...(greenBasisMethod === "FIXED_PRICE_97_PERCENT"
          ? { eligibleShareBp: policyGreen.fixedPriceEligibleShareBp }
          : {}),
      });
      if (!expectedGreenAmounts.ok) {
        greenMathMatches = false;
      } else {
        greenMathMatches &&= expectedGreenAmounts.value.calculatedOre === greenCalculatedOre &&
          expectedGreenAmounts.value.claimOre === greenClaimOre;
        for (const category of GREEN_CATEGORIES) {
          const expected = expectedGreenAmounts.value.categories[category];
          const frozen = greenCategories[category];
          if (
            expected.calculatedOre !== frozen.calculatedOre ||
            expected.claimOre !== frozen.claimOre
          ) {
            greenMathMatches = false;
            break;
          }
        }
      }
      if (
        greenAllocations.some(
          (allocation) => allocation.ore > greenPolicy.values.green.maxPerPersonYearOre,
        )
      ) {
        greenMathMatches = false;
      }
    }
  }
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
    !rotMathMatches ||
    !greenMathMatches ||
    (raw.reverseChargeApplied && (usesRot || usesGreen)) ||
    ((usesRot || usesGreen) && raw.customerEligibilityPosture !== "private") ||
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
    !sameRuleVersionSet(ruleVersions, vatPolicy, rotPolicy, greenPolicy)
  ) {
    return invalid();
  }

  const answer: TaxAnswerSnapshotV2 = Object.freeze({
    schemaVersion: 2,
    taxRuleVersions: Object.freeze([...(raw.taxRuleVersions as string[])]),
    vatPolicy,
    customerEligibilityPosture: raw.customerEligibilityPosture,
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
      basisMethod: greenBasisMethod,
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
