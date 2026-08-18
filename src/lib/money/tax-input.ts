import {
  GREEN_CATEGORIES,
  isCanonicalFixedPriceRowId,
  isCanonicalTaxPersonSlot,
  isGreenBasisMethod,
  isTaxDeductionChoice,
  type FixedPriceCategorySplitOre,
  type FixedPriceRowIds,
  type GreenCategory,
  type TaxDeductionChoice,
  type TaxInputSnapshotV2,
  type TaxPersonAllowanceSlot,
} from "./domain";
import { isOreAmount } from "./ore";

export type TaxInputValidationErrorCode =
  | "INVALID_TAX_INPUT"
  | "INVALID_BUYER_VAT_NUMBER"
  | "MISSING_TAX_RESOLVING_DATE"
  | "INVALID_PERSON_ALLOWANCE"
  | "INCOMPLETE_FIXED_PRICE_CATEGORY_SPLIT"
  | "INCOMPLETE_FIXED_PRICE_ROW_SCOPE"
  | "FIXED_PRICE_97_REQUIRES_GENUINE_FIXED_PRICE";

export type TaxInputValidationResult =
  | { readonly ok: true; readonly value: TaxInputSnapshotV2 }
  | { readonly ok: false; readonly code: TaxInputValidationErrorCode };

function fail(code: TaxInputValidationErrorCode): TaxInputValidationResult {
  return { ok: false, code };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Canonical display/storage form; separators and case never become tax facts. */
export function normalizeBuyerVatNumber(value: string): string {
  return value.trim().toUpperCase().replace(/[\s.-]/g, "");
}

const EU_VAT_PREFIXES = Object.freeze([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DE", "DK", "EE", "EL", "ES", "FI", "FR",
  "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
  "XI",
] as const);

/**
 * A structural EU VAT-registration guard. Sweden is deliberately stricter
 * (`SE` + twelve digits); other EU prefixes retain their country-specific
 * alphanumeric payload without pretending this offline check proves registration.
 */
export function isValidBuyerVatNumber(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const normalized = normalizeBuyerVatNumber(value);
  if (/^SE\d{12}$/.test(normalized)) return true;
  const prefix = normalized.slice(0, 2);
  return (
    (EU_VAT_PREFIXES as readonly string[]).includes(prefix) &&
    /^[A-Z]{2}[A-Z0-9]{8,12}$/.test(normalized)
  );
}

function optionalOre(value: unknown): value is number | undefined {
  return value === undefined || isOreAmount(value);
}

function readsRot(choice: TaxDeductionChoice): boolean {
  return choice === "ROT" || choice === "ROT_AND_GREEN";
}

function readsGreen(choice: TaxDeductionChoice): boolean {
  return choice === "GREEN" || choice === "ROT_AND_GREEN";
}

function parsePersonSlots(
  value: unknown,
  choice: TaxDeductionChoice,
): readonly TaxPersonAllowanceSlot[] | null {
  if (!Array.isArray(value) || value.length > 50) return null;
  const seen = new Set<string>();
  const parsed: TaxPersonAllowanceSlot[] = [];
  let hasRotAllowance = false;
  let hasGreenAllowance = false;
  for (const raw of value) {
    if (!isRecord(raw) || !isCanonicalTaxPersonSlot(raw.slot) || seen.has(raw.slot)) return null;
    seen.add(raw.slot);
    if (
      !optionalOre(raw.remainingAllowanceOre) ||
      !optionalOre(raw.remainingRotAllowanceOre) ||
      !optionalOre(raw.remainingCombinedRotRutAllowanceOre) ||
      !optionalOre(raw.remainingGreenAllowanceOre)
    ) {
      return null;
    }
    const legacy = raw.remainingAllowanceOre as number | undefined;
    if (choice === "ROT_AND_GREEN" && legacy !== undefined) return null;
    const hasRot = raw.remainingRotAllowanceOre !== undefined || legacy !== undefined;
    const hasGreen = raw.remainingGreenAllowanceOre !== undefined || legacy !== undefined;
    // A declared ROT slot must also carry the customer's declared remaining combined ROT/RUT
    // ceiling. The legacy one-value alias remains a conservative compatibility value for both.
    if (hasRot && raw.remainingCombinedRotRutAllowanceOre === undefined && legacy === undefined) {
      return null;
    }
    hasRotAllowance ||= hasRot;
    hasGreenAllowance ||= hasGreen;
    parsed.push(
      Object.freeze({
        slot: raw.slot,
        ...(legacy === undefined ? {} : { remainingAllowanceOre: legacy }),
        ...(raw.remainingRotAllowanceOre === undefined
          ? {}
          : { remainingRotAllowanceOre: raw.remainingRotAllowanceOre as number }),
        ...(raw.remainingCombinedRotRutAllowanceOre === undefined
          ? {}
          : {
              remainingCombinedRotRutAllowanceOre:
                raw.remainingCombinedRotRutAllowanceOre as number,
            }),
        ...(raw.remainingGreenAllowanceOre === undefined
          ? {}
          : { remainingGreenAllowanceOre: raw.remainingGreenAllowanceOre as number }),
      }),
    );
  }
  if (readsRot(choice) && !hasRotAllowance) return null;
  if (readsGreen(choice) && !hasGreenAllowance) return null;
  return Object.freeze(parsed);
}

function parseFixedPriceSplit(value: unknown): FixedPriceCategorySplitOre | null {
  if (!isRecord(value)) return null;
  const output = {} as Record<GreenCategory, number>;
  for (const category of GREEN_CATEGORIES) {
    if (!isOreAmount(value[category])) return null;
    output[category] = value[category] as number;
  }
  return Object.freeze(output);
}

function parseFixedPriceRowIds(value: unknown): FixedPriceRowIds | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 500) return null;
  const ids = value.filter(isCanonicalFixedPriceRowId);
  if (ids.length !== value.length || new Set(ids).size !== ids.length) return null;
  return Object.freeze([...ids].sort());
}

/**
 * Validate and normalize the complete versioned calculation tax input. This is
 * the shared authority used by commands, readiness, and fresh quote creation.
 */
export function parseTaxInputSnapshot(raw: unknown): TaxInputValidationResult {
  if (!isRecord(raw) || raw.schemaVersion !== 2) return fail("INVALID_TAX_INPUT");
  // This header field is solely the explicit reverse-charge applicability
  // choice. Category rows continue to carry the actual standard/zero/reduced
  // tax treatment, including the sanctioned standard+reverse mixed case.
  if (
    (raw.documentVatType !== "STANDARD_VAT_25" &&
      raw.documentVatType !== "REVERSE_CHARGE_CONSTRUCTION") ||
    !isTaxDeductionChoice(raw.deductionChoice)
  ) {
    return fail("INVALID_TAX_INPUT");
  }
  if (!isGreenBasisMethod(raw.greenBasisMethod) || typeof raw.genuineFixedPrice !== "boolean") {
    return fail("INVALID_TAX_INPUT");
  }

  let buyerVatNumber: string | null = null;
  if (raw.buyerVatNumber !== null && raw.buyerVatNumber !== undefined && raw.buyerVatNumber !== "") {
    if (!isValidBuyerVatNumber(raw.buyerVatNumber)) return fail("INVALID_BUYER_VAT_NUMBER");
    buyerVatNumber = normalizeBuyerVatNumber(raw.buyerVatNumber as string);
  }
  if (raw.documentVatType === "REVERSE_CHARGE_CONSTRUCTION" && buyerVatNumber === null) {
    return fail("INVALID_BUYER_VAT_NUMBER");
  }
  // Canonical persistence is exact: a buyer VAT identifier is a reverse-charge fact.
  // The form boundary clears stale UI values before calling this parser.
  if (raw.documentVatType !== "REVERSE_CHARGE_CONSTRUCTION" && buyerVatNumber !== null) {
    return fail("INVALID_TAX_INPUT");
  }
  if (
    raw.documentVatType === "REVERSE_CHARGE_CONSTRUCTION" &&
    raw.deductionChoice !== "NONE"
  ) {
    return fail("INVALID_TAX_INPUT");
  }

  const choice = raw.deductionChoice;
  const paymentDate = raw.paymentDate === null || raw.paymentDate === undefined
    ? null
    : raw.paymentDate;
  const finalPaymentDate = raw.finalPaymentDate === null || raw.finalPaymentDate === undefined
    ? null
    : raw.finalPaymentDate;
  if (
    (paymentDate !== null && !isIsoCalendarDate(paymentDate)) ||
    (finalPaymentDate !== null && !isIsoCalendarDate(finalPaymentDate))
  ) {
    return fail("MISSING_TAX_RESOLVING_DATE");
  }
  if (readsRot(choice) && paymentDate === null) return fail("MISSING_TAX_RESOLVING_DATE");
  if (readsGreen(choice) && finalPaymentDate === null) return fail("MISSING_TAX_RESOLVING_DATE");
  if (!readsRot(choice) && paymentDate !== null) return fail("INVALID_TAX_INPUT");
  if (!readsGreen(choice) && finalPaymentDate !== null) return fail("INVALID_TAX_INPUT");

  const personAllowanceSlots = parsePersonSlots(raw.personAllowanceSlots, choice);
  if (personAllowanceSlots === null) return fail("INVALID_PERSON_ALLOWANCE");
  if (choice !== "NONE" && personAllowanceSlots.length === 0) {
    return fail("INVALID_PERSON_ALLOWANCE");
  }
  if (choice === "NONE" && personAllowanceSlots.length !== 0) {
    return fail("INVALID_PERSON_ALLOWANCE");
  }
  for (const slot of personAllowanceSlots) {
    if (
      choice === "ROT" &&
      slot.remainingGreenAllowanceOre !== undefined
    ) {
      return fail("INVALID_PERSON_ALLOWANCE");
    }
    if (
      choice === "GREEN" &&
      (slot.remainingRotAllowanceOre !== undefined ||
        slot.remainingCombinedRotRutAllowanceOre !== undefined)
    ) {
      return fail("INVALID_PERSON_ALLOWANCE");
    }
  }

  const fixedPriceOre = raw.fixedPriceOre === null || raw.fixedPriceOre === undefined
    ? null
    : raw.fixedPriceOre;
  if (fixedPriceOre !== null && !isOreAmount(fixedPriceOre)) return fail("INVALID_TAX_INPUT");
  const fixedPriceCategorySplitOre = raw.fixedPriceCategorySplitOre === null ||
    raw.fixedPriceCategorySplitOre === undefined
    ? null
    : parseFixedPriceSplit(raw.fixedPriceCategorySplitOre);
  if (raw.fixedPriceCategorySplitOre !== null && raw.fixedPriceCategorySplitOre !== undefined && fixedPriceCategorySplitOre === null) {
    return fail("INCOMPLETE_FIXED_PRICE_CATEGORY_SPLIT");
  }
  const fixedPriceRowIds = raw.fixedPriceRowIds === null ||
    raw.fixedPriceRowIds === undefined
    ? null
    : parseFixedPriceRowIds(raw.fixedPriceRowIds);
  if (
    raw.fixedPriceRowIds !== null &&
    raw.fixedPriceRowIds !== undefined &&
    fixedPriceRowIds === null
  ) {
    return fail("INCOMPLETE_FIXED_PRICE_ROW_SCOPE");
  }

  if (raw.greenBasisMethod === "FIXED_PRICE_97_PERCENT") {
    if (!readsGreen(choice)) return fail("INVALID_TAX_INPUT");
    if (raw.genuineFixedPrice !== true) {
      return fail("FIXED_PRICE_97_REQUIRES_GENUINE_FIXED_PRICE");
    }
    if (!isOreAmount(fixedPriceOre) || fixedPriceCategorySplitOre === null) {
      return fail("INCOMPLETE_FIXED_PRICE_CATEGORY_SPLIT");
    }
    if (fixedPriceRowIds === null) {
      return fail("INCOMPLETE_FIXED_PRICE_ROW_SCOPE");
    }
    let splitTotal = 0;
    for (const category of GREEN_CATEGORIES) {
      splitTotal += fixedPriceCategorySplitOre[category];
      if (!Number.isSafeInteger(splitTotal)) {
        return fail("INCOMPLETE_FIXED_PRICE_CATEGORY_SPLIT");
      }
    }
    if (splitTotal !== fixedPriceOre) {
      return fail("INCOMPLETE_FIXED_PRICE_CATEGORY_SPLIT");
    }
  } else if (
    raw.genuineFixedPrice !== false ||
    fixedPriceOre !== null ||
    fixedPriceCategorySplitOre !== null ||
    fixedPriceRowIds !== null
  ) {
    return fail("INVALID_TAX_INPUT");
  }
  if (!readsGreen(choice) && raw.greenBasisMethod !== "ACTUAL_ELIGIBLE_COSTS") {
    return fail("INVALID_TAX_INPUT");
  }

  return {
    ok: true,
    value: Object.freeze({
      schemaVersion: 2,
      documentVatType: raw.documentVatType,
      buyerVatNumber,
      deductionChoice: choice,
      paymentDate: paymentDate as string | null,
      finalPaymentDate: finalPaymentDate as string | null,
      personAllowanceSlots,
      greenBasisMethod: raw.greenBasisMethod,
      genuineFixedPrice: raw.genuineFixedPrice,
      fixedPriceOre: fixedPriceOre as number | null,
      fixedPriceCategorySplitOre,
      fixedPriceRowIds,
    }),
  };
}
