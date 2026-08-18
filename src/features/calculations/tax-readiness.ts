import {
  buildTaxAnswerSnapshotV2,
  parseTaxInputSnapshot,
  type DocumentVatRowInput,
  type CustomerEligibilityPosture,
  type TaxAnswerSnapshotV2,
} from "@/lib/money";

import type { TaxReadinessBlockerCode } from "./readiness";

function mapFailure(code: string): TaxReadinessBlockerCode {
  if (code === "MISSING_BUYER_VAT_NUMBER" || code === "INVALID_BUYER_VAT_NUMBER") {
    return "MISSING_BUYER_VAT_NUMBER";
  }
  if (code === "MISSING_TAX_RESOLVING_DATE" || code === "TAX_POLICY_INVALID_DATE") {
    return "MISSING_TAX_RESOLVING_DATE";
  }
  if (code.startsWith("TAX_POLICY_")) return "MISSING_TAX_RESOLVING_PROFILE";
  if (code === "INSUFFICIENT_PERSON_ALLOWANCE" || code === "INVALID_PERSON_ALLOWANCE") {
    return "INSUFFICIENT_PERSON_ALLOWANCE";
  }
  if (
    code === "INCOMPLETE_FIXED_PRICE_CATEGORY_SPLIT" ||
    code === "FIXED_PRICE_CLASSIFICATION_MISMATCH"
  ) {
    return "INCOMPLETE_FIXED_PRICE_CATEGORY_SPLIT";
  }
  if (code === "FIXED_PRICE_97_REQUIRES_GENUINE_FIXED_PRICE") {
    return "INVALID_FIXED_PRICE_SCHABLON";
  }
  if (code === "CUSTOMER_NOT_ELIGIBLE_FOR_DEDUCTION") {
    return "CUSTOMER_NOT_ELIGIBLE_FOR_DEDUCTION";
  }
  if (code === "DEDUCTION_EXCEEDS_GROSS") {
    return "DEDUCTION_EXCEEDS_GROSS";
  }
  if (code === "INVALID_DEDUCTION_CLASSIFICATION" || code === "DOUBLE_DEDUCTION_FEED") {
    return "INVALID_DEDUCTION_CLASSIFICATION";
  }
  return "INCOMPLETE_VAT_INPUT";
}

/** Pure bridge from the canonical tax engine's typed failures to the readiness vocabulary. */
export interface TaxReadinessResolution {
  readonly blockingCodes: readonly TaxReadinessBlockerCode[];
  readonly answer: TaxAnswerSnapshotV2 | null;
}

export function resolveTaxReadiness(input: {
  readonly taxInput: unknown;
  readonly rows: readonly DocumentVatRowInput[];
  /** The quote-capture fact projected by the caller; never a deduction-payment date. */
  readonly quoteCaptureDate: string;
  readonly customerEligibilityPosture: CustomerEligibilityPosture;
  /** Excluded rows still cross the quote RPC and must be computable. */
  readonly hasInvalidRow?: boolean;
}): TaxReadinessResolution {
  if (input.hasInvalidRow === true) {
    return { blockingCodes: Object.freeze(["INCOMPLETE_VAT_INPUT"]), answer: null };
  }
  if (input.taxInput === null || input.taxInput === undefined) {
    return { blockingCodes: Object.freeze(["MISSING_TAX_INPUT"]), answer: null };
  }
  const parsed = parseTaxInputSnapshot(input.taxInput);
  if (!parsed.ok) {
    return { blockingCodes: Object.freeze([mapFailure(parsed.code)]), answer: null };
  }

  const answer = buildTaxAnswerSnapshotV2({
    rows: input.rows,
    taxInput: parsed.value,
    quoteCaptureDate: input.quoteCaptureDate,
    customerEligibilityPosture: input.customerEligibilityPosture,
  });
  return answer.ok
    ? { blockingCodes: Object.freeze([]), answer: answer.value }
    : { blockingCodes: Object.freeze([mapFailure(answer.code)]), answer: null };
}

export function resolveTaxReadinessCodes(input: {
  readonly taxInput: unknown;
  readonly rows: readonly DocumentVatRowInput[];
  readonly quoteCaptureDate: string;
  readonly customerEligibilityPosture: CustomerEligibilityPosture;
  readonly hasInvalidRow?: boolean;
}): readonly TaxReadinessBlockerCode[] {
  return resolveTaxReadiness(input).blockingCodes;
}
