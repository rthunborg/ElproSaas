import {
  DEDUCTION_CLASSIFICATIONS,
  GREEN_CATEGORIES,
  TAX_SUMMARY_CATEGORIES,
  type DeductionClassification,
  type CustomerEligibilityPosture,
  type GreenCategory,
  type TaxInputSnapshotV2,
  type TaxSummaryCategory,
} from "./domain";
import { isOreAmount } from "./ore";
import {
  TAX_POLICY_REGISTRY,
  aggregateDocumentVat,
  allocateCategoryVatByDeductionClassification,
  allocateWholeSekClaimByPerson,
  calculateGreenSchemeAmounts,
  resolveTaxPolicy,
  type DocumentVatCategory,
  type DocumentVatRowInput,
  type TaxAnswerResult,
  type TaxPolicy,
} from "./tax-policy";

const BP_PER_UNIT = BigInt(10_000);
const ORE_PER_SEK = BigInt(100);

export interface ResolvedTaxPolicySnapshot {
  readonly id: string;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly resolvingDate: string;
  readonly resolvingFact: "QUOTE_CAPTURE_DATE" | "ROT_PAYMENT_DATE" | "GREEN_FINAL_PAYMENT_DATE";
  /** Complete copy-by-value policy values; readers never consult the mutable/current registry. */
  readonly values: Readonly<{
    vat: Readonly<{ standardRateBp: number }>;
    rot: Readonly<{
      rateBp: number;
      maxPerPersonYearOre: number;
      combinedRotRutMaxPerPersonYearOre: number;
    }>;
    green: Readonly<{
      rateBpByCategory: Readonly<Record<GreenCategory, number>>;
      maxPerPersonYearOre: number;
      defaultBasisMethod: TaxInputSnapshotV2["greenBasisMethod"];
      fixedPriceEligibleShareBp: number;
    }>;
  }>;
}

export interface FrozenPersonClaimAllocation {
  readonly slot: string;
  readonly ore: number;
}

export interface RotTaxAnswer {
  readonly policy: ResolvedTaxPolicySnapshot | null;
  readonly basisNetOre: number;
  readonly allocatedVatOre: number;
  readonly basisOre: number;
  readonly calculatedOre: number;
  readonly claimOre: number;
  readonly allocations: readonly FrozenPersonClaimAllocation[];
}

export interface GreenCategoryTaxAnswer {
  readonly category: GreenCategory;
  readonly basisOre: number;
  readonly calculatedOre: number;
  readonly claimOre: number;
}

export interface GreenTaxAnswer {
  readonly policy: ResolvedTaxPolicySnapshot | null;
  readonly basisMethod: TaxInputSnapshotV2["greenBasisMethod"];
  readonly categories: Readonly<Record<GreenCategory, GreenCategoryTaxAnswer>>;
  readonly calculatedOre: number;
  readonly claimOre: number;
  readonly allocations: readonly FrozenPersonClaimAllocation[];
}

export interface TaxSummaryBucket {
  readonly netOre: number;
  readonly vatOre: number;
  readonly grossOre: number;
}

/** Complete, typed and frozen V2 answer consumed verbatim by PDF and acceptance. */
export interface TaxAnswerSnapshotV2 {
  readonly schemaVersion: 2;
  readonly taxRuleVersions: readonly string[];
  /** Quote-capture/VAT policy, frozen even when no deduction scheme is selected. */
  readonly vatPolicy: ResolvedTaxPolicySnapshot;
  /** Non-PII customer posture used to authorize private-only deductions. */
  readonly customerEligibilityPosture: CustomerEligibilityPosture;
  readonly documentVatType: TaxInputSnapshotV2["documentVatType"];
  readonly buyerVatNumber: string | null;
  readonly reverseChargeApplied: boolean;
  readonly deductionChoice: TaxInputSnapshotV2["deductionChoice"];
  readonly categories: readonly DocumentVatCategory[];
  readonly netByDeductionClassification: Readonly<Record<DeductionClassification, number>>;
  readonly vatByDeductionClassification: Readonly<Record<DeductionClassification, number>>;
  readonly summaries: Readonly<{
    labor: TaxSummaryBucket;
    material: TaxSummaryBucket;
    other: TaxSummaryBucket;
  }>;
  readonly rot: RotTaxAnswer;
  readonly green: GreenTaxAnswer;
  readonly netOre: number;
  readonly vatOre: number;
  readonly grossOre: number;
  readonly calculatedDeductionOre: number;
  readonly claimDeductionOre: number;
  readonly deductionOre: number;
  readonly payableOre: number;
}

function fail<T>(code: string): TaxAnswerResult<T> {
  return { ok: false, code };
}

function toSafeOre(value: bigint): number | null {
  const numeric = Number(value);
  return isOreAmount(numeric) && BigInt(numeric) === value ? numeric : null;
}

function addOre(...values: readonly number[]): number | null {
  return toSafeOre(values.reduce((sum, value) => sum + BigInt(value), BigInt(0)));
}

function multiplyFloorOre(amountOre: number, numerator: bigint, denominator: bigint): number | null {
  return toSafeOre((BigInt(amountOre) * numerator) / denominator);
}

function multiplyClaimOre(amountOre: number, numerator: bigint, denominator: bigint): number | null {
  return toSafeOre(
    ((BigInt(amountOre) * numerator) / (denominator * ORE_PER_SEK)) * ORE_PER_SEK,
  );
}

function frozenPolicy(
  policy: TaxPolicy,
  resolvingDate: string,
  resolvingFact: ResolvedTaxPolicySnapshot["resolvingFact"],
): ResolvedTaxPolicySnapshot {
  return Object.freeze({
    id: policy.id,
    validFrom: policy.validFrom,
    validTo: policy.validTo,
    resolvingDate,
    resolvingFact,
    values: Object.freeze({
      vat: Object.freeze({ standardRateBp: policy.vat.standardRateBp }),
      rot: Object.freeze({
        rateBp: policy.rot.rateBp,
        maxPerPersonYearOre: policy.rot.maxPerPersonYearOre,
        combinedRotRutMaxPerPersonYearOre: policy.rot.combinedRotRutMaxPerPersonYearOre,
      }),
      green: Object.freeze({
        rateBpByCategory: Object.freeze({ ...policy.green.rateBpByCategory }),
        maxPerPersonYearOre: policy.green.maxPerPersonYearOre,
        defaultBasisMethod: policy.green.defaultBasisMethod,
        fixedPriceEligibleShareBp: policy.green.fixedPriceEligibleShareBp,
      }),
    }),
  });
}

function emptyClassificationRecord(): Record<DeductionClassification, number> {
  return Object.fromEntries(
    DEDUCTION_CLASSIFICATIONS.map((classification) => [classification, 0]),
  ) as Record<DeductionClassification, number>;
}

function summaryCategoryOf(row: DocumentVatRowInput): TaxSummaryCategory {
  return row.summaryCategory;
}

/** Allocate one already-rounded VAT category across economic summary buckets exactly. */
function allocateCategoryVatBySummary(input: {
  readonly vatOre: number;
  readonly rows: readonly DocumentVatRowInput[];
}): TaxAnswerResult<Record<TaxSummaryCategory, number>> {
  const output = Object.fromEntries(
    TAX_SUMMARY_CATEGORIES.map((category) => [category, 0]),
  ) as Record<TaxSummaryCategory, number>;
  const net = Object.fromEntries(
    TAX_SUMMARY_CATEGORIES.map((category) => [category, 0]),
  ) as Record<TaxSummaryCategory, number>;
  for (const row of input.rows) {
    const category = summaryCategoryOf(row);
    const next = addOre(net[category], row.netOre);
    if (next === null) return fail("ORE_OVERFLOW");
    net[category] = next;
  }
  const totalNet = TAX_SUMMARY_CATEGORIES.reduce(
    (sum, category) => sum + BigInt(net[category]),
    BigInt(0),
  );
  if (input.vatOre === 0 || totalNet === BigInt(0)) {
    return { ok: true, value: Object.freeze(output) };
  }

  const shares = TAX_SUMMARY_CATEGORIES.filter((category) => net[category] > 0).map(
    (category, order) => {
      const exactNumerator = BigInt(input.vatOre) * BigInt(net[category]);
      return {
        category,
        order,
        floor: exactNumerator / totalNet,
        remainder: exactNumerator % totalNet,
      };
    },
  );
  let allocated = BigInt(0);
  for (const share of shares) {
    const floor = toSafeOre(share.floor);
    if (floor === null) return fail("ORE_OVERFLOW");
    output[share.category] = floor;
    allocated += share.floor;
  }
  let remainderOre = BigInt(input.vatOre) - allocated;
  for (const share of [...shares].sort((left, right) => {
    if (left.remainder > right.remainder) return -1;
    if (left.remainder < right.remainder) return 1;
    return left.order - right.order;
  })) {
    if (remainderOre === BigInt(0)) break;
    output[share.category] += 1;
    remainderOre -= BigInt(1);
  }
  if (remainderOre !== BigInt(0)) return fail("ORE_OVERFLOW");
  return { ok: true, value: Object.freeze(output) };
}

function greenCategoryOf(classification: DeductionClassification): GreenCategory | null {
  if (classification.startsWith("GREEN_SOLAR_")) return "SOLAR";
  if (classification.startsWith("GREEN_STORAGE_")) return "STORAGE";
  if (classification.startsWith("GREEN_CHARGING_")) return "CHARGING";
  return null;
}

function policyFor(
  effectiveDate: string,
  fact: ResolvedTaxPolicySnapshot["resolvingFact"],
): TaxAnswerResult<{ readonly policy: TaxPolicy; readonly frozen: ResolvedTaxPolicySnapshot }> {
  const resolved = resolveTaxPolicy({ registry: TAX_POLICY_REGISTRY, effectiveDate });
  if (!resolved.ok) return fail(resolved.code);
  return {
    ok: true,
    value: {
      policy: resolved.value,
      frozen: frozenPolicy(resolved.value, effectiveDate, fact),
    },
  };
}

function allocationsFor(
  input: TaxInputSnapshotV2,
  scheme: "ROT" | "GREEN",
  candidateClaimOre: number,
  policy: TaxPolicy,
): TaxAnswerResult<readonly FrozenPersonClaimAllocation[]> {
  // The input is an explicitly ordered frozen fact. Preserve that order so residual SEK follows
  // the customer's captured slot sequence rather than a locale-dependent label sort.
  const persons = input.personAllowanceSlots.map((person) => ({
      slot: person.slot,
      remainingAllowanceOre:
        scheme === "ROT"
          ? (person.remainingRotAllowanceOre ?? person.remainingAllowanceOre ?? 0)
          : (person.remainingGreenAllowanceOre ?? person.remainingAllowanceOre ?? 0),
      ...(scheme === "ROT"
        ? {
            remainingCombinedRotRutAllowanceOre:
              person.remainingCombinedRotRutAllowanceOre ??
              policy.rot.combinedRotRutMaxPerPersonYearOre,
          }
        : {}),
    }));
  const allocated = allocateWholeSekClaimByPerson({
    candidateClaimOre,
    perPersonCapOre:
      scheme === "ROT" ? policy.rot.maxPerPersonYearOre : policy.green.maxPerPersonYearOre,
    ...(scheme === "ROT"
      ? { combinedRotRutCapOre: policy.rot.combinedRotRutMaxPerPersonYearOre }
      : {}),
    persons,
  });
  return allocated.ok ? { ok: true, value: allocated.value.allocations } : allocated;
}

function rowsForCategory(
  rows: readonly DocumentVatRowInput[],
  category: DocumentVatCategory,
): readonly DocumentVatRowInput[] {
  return rows.filter(
    (row) =>
      row.includedInInvoiceTotal !== false &&
      row.vatType === category.vatType &&
      row.rateBp === category.rateBp,
  );
}

export interface BuildTaxAnswerInput {
  readonly rows: readonly DocumentVatRowInput[];
  readonly taxInput: TaxInputSnapshotV2;
  /** Explicit fallback for a no-deduction document; never read from the ambient clock. */
  readonly quoteCaptureDate: string;
  /** Authoritative customer type resolved server-side; never inferred from names or ids. */
  readonly customerEligibilityPosture: CustomerEligibilityPosture;
}

/**
 * Reconcile VAT, eligible bases, claim truncation, person caps, and payable once.
 * Callers persist the returned value and all downstream consumers read it verbatim.
 */
export function buildTaxAnswerSnapshotV2(
  input: BuildTaxAnswerInput,
): TaxAnswerResult<TaxAnswerSnapshotV2> {
  // Resolve the quote-capture policy before authorizing category pairs. A later
  // standard rate must be evaluated against the policy actually frozen here.
  const fallbackPolicy = policyFor(input.quoteCaptureDate, "QUOTE_CAPTURE_DATE");
  if (!fallbackPolicy.ok) return fallbackPolicy;
  const aggregate = aggregateDocumentVat({
    rows: input.rows,
    standardRateBp: fallbackPolicy.value.policy.vat.standardRateBp,
  });
  if (!aggregate.ok) return aggregate;

  const hasReverseChargeCategory = aggregate.value.categories.some(
    (category) => category.vatType === "REVERSE_CHARGE_CONSTRUCTION",
  );
  const reverseChargeSelected =
    input.taxInput.documentVatType === "REVERSE_CHARGE_CONSTRUCTION";
  if (reverseChargeSelected && input.taxInput.buyerVatNumber === null) {
    return fail("MISSING_BUYER_VAT_NUMBER");
  }
  if (hasReverseChargeCategory !== reverseChargeSelected) {
    return fail("REVERSE_CHARGE_SELECTION_MISMATCH");
  }
  const reverseChargeApplied = hasReverseChargeCategory;

  const netByClass = emptyClassificationRecord();
  const vatByClass = emptyClassificationRecord();
  const summaryMutable = {
    labor: { netOre: 0, vatOre: 0, grossOre: 0 },
    material: { netOre: 0, vatOre: 0, grossOre: 0 },
    other: { netOre: 0, vatOre: 0, grossOre: 0 },
  };
  for (const row of input.rows) {
    if (row.includedInInvoiceTotal === false) continue;
    const classification = row.deductionClassification ?? "NONE";
    const next = addOre(netByClass[classification], row.netOre);
    if (next === null) return fail("ORE_OVERFLOW");
    netByClass[classification] = next;
    const summaryCategory = summaryCategoryOf(row);
    const nextSummaryNet = addOre(summaryMutable[summaryCategory].netOre, row.netOre);
    if (nextSummaryNet === null) return fail("ORE_OVERFLOW");
    summaryMutable[summaryCategory].netOre = nextSummaryNet;
  }
  for (const category of aggregate.value.categories) {
    const categoryRows = rowsForCategory(input.rows, category);
    const bucketNet = emptyClassificationRecord();
    for (const row of categoryRows) {
      const classification = row.deductionClassification ?? "NONE";
      const next = addOre(bucketNet[classification], row.netOre);
      if (next === null) return fail("ORE_OVERFLOW");
      bucketNet[classification] = next;
    }
    const allocated = allocateCategoryVatByDeductionClassification({
      vatOre: category.vatOre,
      buckets: DEDUCTION_CLASSIFICATIONS.map((deductionClassification) => ({
        deductionClassification,
        netOre: bucketNet[deductionClassification],
      })),
    });
    if (!allocated.ok) return allocated;
    for (const classification of DEDUCTION_CLASSIFICATIONS) {
      const next = addOre(vatByClass[classification], allocated.value[classification] ?? 0);
      if (next === null) return fail("ORE_OVERFLOW");
      vatByClass[classification] = next;
    }
    const summaryVat = allocateCategoryVatBySummary({
      vatOre: category.vatOre,
      rows: categoryRows,
    });
    if (!summaryVat.ok) return summaryVat;
    for (const summaryCategory of TAX_SUMMARY_CATEGORIES) {
      const next = addOre(
        summaryMutable[summaryCategory].vatOre,
        summaryVat.value[summaryCategory],
      );
      if (next === null) return fail("ORE_OVERFLOW");
      summaryMutable[summaryCategory].vatOre = next;
    }
  }
  for (const key of TAX_SUMMARY_CATEGORIES) {
    const gross = addOre(summaryMutable[key].netOre, summaryMutable[key].vatOre);
    if (gross === null) return fail("ORE_OVERFLOW");
    summaryMutable[key].grossOre = gross;
  }

  const usesRot = input.taxInput.deductionChoice === "ROT" ||
    input.taxInput.deductionChoice === "ROT_AND_GREEN";
  const usesGreen = input.taxInput.deductionChoice === "GREEN" ||
    input.taxInput.deductionChoice === "ROT_AND_GREEN";
  if (reverseChargeApplied && (usesRot || usesGreen)) {
    return fail("INVALID_DEDUCTION_CLASSIFICATION");
  }
  if ((usesRot || usesGreen) && input.customerEligibilityPosture !== "private") {
    return fail("CUSTOMER_NOT_ELIGIBLE_FOR_DEDUCTION");
  }

  let rotPolicy: ReturnType<typeof policyFor> | null = null;
  if (usesRot) {
    if (input.taxInput.paymentDate === null) return fail("MISSING_TAX_RESOLVING_DATE");
    rotPolicy = policyFor(input.taxInput.paymentDate, "ROT_PAYMENT_DATE");
    if (!rotPolicy.ok) return rotPolicy;
  }
  let greenPolicy: ReturnType<typeof policyFor> | null = null;
  if (usesGreen) {
    if (input.taxInput.finalPaymentDate === null) return fail("MISSING_TAX_RESOLVING_DATE");
    greenPolicy = policyFor(input.taxInput.finalPaymentDate, "GREEN_FINAL_PAYMENT_DATE");
    if (!greenPolicy.ok) return greenPolicy;
  }

  const rotBasisNetOre = usesRot ? netByClass.ROT_LABOR : 0;
  const rotAllocatedVatOre = usesRot ? vatByClass.ROT_LABOR : 0;
  const rotBasisOre = addOre(rotBasisNetOre, rotAllocatedVatOre);
  if (rotBasisOre === null) return fail("ORE_OVERFLOW");
  const effectiveRotPolicy = rotPolicy?.ok ? rotPolicy.value.policy : fallbackPolicy.value.policy;
  const rotCalculatedOre = usesRot
    ? multiplyFloorOre(rotBasisOre, BigInt(effectiveRotPolicy.rot.rateBp), BP_PER_UNIT)
    : 0;
  const rotClaimOre = usesRot
    ? multiplyClaimOre(rotBasisOre, BigInt(effectiveRotPolicy.rot.rateBp), BP_PER_UNIT)
    : 0;
  if (rotCalculatedOre === null || rotClaimOre === null) return fail("ORE_OVERFLOW");
  const rotAllocations = usesRot
    ? allocationsFor(input.taxInput, "ROT", rotClaimOre, effectiveRotPolicy)
    : { ok: true as const, value: Object.freeze([]) };
  if (!rotAllocations.ok) return rotAllocations;

  const greenAnswers = {} as Record<GreenCategory, GreenCategoryTaxAnswer>;
  const effectiveGreenPolicy = greenPolicy?.ok
    ? greenPolicy.value.policy
    : fallbackPolicy.value.policy;
  const greenGrossByCategory = {} as Record<GreenCategory, number>;
  const greenBasisByCategory = {} as Record<GreenCategory, number>;
  for (const category of GREEN_CATEGORIES) {
    let classifiedGreenGrossOre = 0;
    for (const classification of DEDUCTION_CLASSIFICATIONS) {
      if (greenCategoryOf(classification) !== category) continue;
      const next = addOre(
        classifiedGreenGrossOre,
        netByClass[classification],
        vatByClass[classification],
      );
      if (next === null) return fail("ORE_OVERFLOW");
      classifiedGreenGrossOre = next;
    }
    let basisOre = classifiedGreenGrossOre;
    if (usesGreen && input.taxInput.greenBasisMethod === "FIXED_PRICE_97_PERCENT") {
      const split = input.taxInput.fixedPriceCategorySplitOre;
      if (!input.taxInput.genuineFixedPrice || split === null) {
        return fail("INCOMPLETE_FIXED_PRICE_CATEGORY_SPLIT");
      }
      const fixedPriceSplitOre = split[category];
      // Fixed-price green facts must reconcile to green-classified document work. This is the
      // no-double-feed proof when a document also contains separately classified ROT labor.
      if (fixedPriceSplitOre !== classifiedGreenGrossOre) {
        return fail("FIXED_PRICE_CLASSIFICATION_MISMATCH");
      }
      const computed = multiplyFloorOre(
        fixedPriceSplitOre,
        BigInt(effectiveGreenPolicy.green.fixedPriceEligibleShareBp),
        BP_PER_UNIT,
      );
      if (computed === null) return fail("ORE_OVERFLOW");
      basisOre = computed;
    } else if (!usesGreen) {
      basisOre = 0;
    }
    greenGrossByCategory[category] = usesGreen ? classifiedGreenGrossOre : 0;
    greenBasisByCategory[category] = basisOre;
  }
  const greenAmounts = calculateGreenSchemeAmounts({
    amountOreByCategory: greenGrossByCategory,
    rateBpByCategory: effectiveGreenPolicy.green.rateBpByCategory,
    ...(usesGreen && input.taxInput.greenBasisMethod === "FIXED_PRICE_97_PERCENT"
      ? { eligibleShareBp: effectiveGreenPolicy.green.fixedPriceEligibleShareBp }
      : {}),
  });
  if (!greenAmounts.ok) return greenAmounts;
  const greenCalculatedOre = usesGreen ? greenAmounts.value.calculatedOre : 0;
  const greenClaimOre = usesGreen ? greenAmounts.value.claimOre : 0;
  for (const category of GREEN_CATEGORIES) {
    greenAnswers[category] = Object.freeze({
      category,
      basisOre: greenBasisByCategory[category],
      calculatedOre: usesGreen ? greenAmounts.value.categories[category].calculatedOre : 0,
      claimOre: usesGreen ? greenAmounts.value.categories[category].claimOre : 0,
    });
  }
  const greenAllocations = usesGreen
    ? allocationsFor(input.taxInput, "GREEN", greenClaimOre, effectiveGreenPolicy)
    : { ok: true as const, value: Object.freeze([]) };
  if (!greenAllocations.ok) return greenAllocations;

  const calculatedDeductionOre = addOre(rotCalculatedOre, greenCalculatedOre);
  const claimDeductionOre = addOre(rotClaimOre, greenClaimOre);
  if (calculatedDeductionOre === null || claimDeductionOre === null) return fail("ORE_OVERFLOW");
  if (claimDeductionOre > aggregate.value.grossOre) return fail("DEDUCTION_EXCEEDS_GROSS");
  const payableOre = aggregate.value.grossOre - claimDeductionOre;
  if (!isOreAmount(payableOre)) return fail("ORE_OVERFLOW");

  const versionIds = new Set<string>([fallbackPolicy.value.policy.id]);
  if (rotPolicy?.ok) versionIds.add(rotPolicy.value.policy.id);
  if (greenPolicy?.ok) versionIds.add(greenPolicy.value.policy.id);
  const answer: TaxAnswerSnapshotV2 = {
    schemaVersion: 2,
    taxRuleVersions: Object.freeze([...versionIds].sort()),
    vatPolicy: fallbackPolicy.value.frozen,
    customerEligibilityPosture: input.customerEligibilityPosture,
    documentVatType: input.taxInput.documentVatType,
    buyerVatNumber: input.taxInput.buyerVatNumber,
    reverseChargeApplied,
    deductionChoice: input.taxInput.deductionChoice,
    categories: aggregate.value.categories,
    netByDeductionClassification: Object.freeze(netByClass),
    vatByDeductionClassification: Object.freeze(vatByClass),
    summaries: Object.freeze({
      labor: Object.freeze(summaryMutable.labor),
      material: Object.freeze(summaryMutable.material),
      other: Object.freeze(summaryMutable.other),
    }),
    rot: Object.freeze({
      policy: rotPolicy?.ok ? rotPolicy.value.frozen : null,
      basisNetOre: rotBasisNetOre,
      allocatedVatOre: rotAllocatedVatOre,
      basisOre: rotBasisOre,
      calculatedOre: rotCalculatedOre,
      claimOre: rotClaimOre,
      allocations: Object.freeze([...rotAllocations.value]),
    }),
    green: Object.freeze({
      policy: greenPolicy?.ok ? greenPolicy.value.frozen : null,
      basisMethod: input.taxInput.greenBasisMethod,
      categories: Object.freeze(greenAnswers),
      calculatedOre: greenCalculatedOre,
      claimOre: greenClaimOre,
      allocations: Object.freeze([...greenAllocations.value]),
    }),
    netOre: aggregate.value.netOre,
    vatOre: aggregate.value.vatOre,
    grossOre: aggregate.value.grossOre,
    calculatedDeductionOre,
    claimDeductionOre,
    deductionOre: claimDeductionOre,
    payableOre,
  };
  return { ok: true, value: Object.freeze(answer) };
}
