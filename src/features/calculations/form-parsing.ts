/**
 * PURE FormData → command-input parsing + UX-side field validation for the calc-editor
 * forms (Story 5.2, Task 3.2). I/O-free so it is exhaustively unit-testable (`tests/unit`).
 *
 * CRITICAL boundary note: this is a UX NICETY, not the security/validation boundary. The
 * authority is the 5.1 command's `validateInput` on the server (architecture §5). This
 * mirrors the 5.1 input contracts so a near-miss surfaces as a field-associated message
 * INSTEAD of a generic VALIDATION_FAILED, and so the kronor→öre / percent→bp conversion
 * happens at the boundary (the stored value is never a float). The server RE-VALIDATES.
 *
 * TWO inherited lessons this module MUST honour:
 *   1. `isPresent('')===false` convention (5-1 retro): an EMPTY-STRING title/unit is ABSENT
 *      (dropped — empty-patch-friendly), but a WHITESPACE-ONLY value is present-but-blank
 *      and REJECTED by the server. So `field()` drops empty-string to undefined; a
 *      whitespace-only value is passed through as-is (trimmed to "" would drop it, so we
 *      preserve the raw non-empty string and let the server reject it) — the parser never
 *      "helpfully" drops a whitespace-only value expecting a drop.
 *   2. Flag-off / cleared-binding trap (epic-3 3-2 review): an unchecked HTML checkbox
 *      submits NOTHING and an empty select reads as undefined — so a naive parser can never
 *      turn `is_hidden`/`is_optional`/`is_selected` OFF on UPDATE. Each flag renders a
 *      hidden `false` companion (`<input type="hidden" name="X" value="false">` BEFORE the
 *      checkbox), so the parser reads an EXPLICIT `false`/`true` for every flag on every
 *      submit — a flag can always be turned OFF. `parseFlag` reads the LAST value for the
 *      name (the checkbox overrides its companion when checked).
 */

/** A parsed form: the raw command input + any client-detected field messages + echo. */
export interface ParsedCalcForm {
  readonly input: Record<string, unknown>;
  readonly fieldErrors: Readonly<Record<string, string>>;
  /** The submitted text values, echoed back so the form preserves input on failure. */
  readonly values: Readonly<Record<string, string>>;
}

import {
  kronorStringToOre,
  percentStringToBp,
  percentStringToMarkupBp,
} from "./money-input";
import {
  DEDUCTION_CLASSIFICATIONS,
  GREEN_BASIS_METHODS,
  TAX_DEDUCTION_CHOICES,
  isIsoCalendarDate,
  isValidBuyerVatNumber,
} from "@/lib/money";

const REQUIRED_MSG = "Fältet är obligatoriskt.";
const PRICE_MSG =
  "Ange ett giltigt belopp (t.ex. 850,00). Negativa eller ogiltiga värden tillåts inte.";
const VAT_MSG = "Ange en giltig momssats i procent (0–100).";
const MARKUP_MSG = "Ange ett giltigt påslag i procent.";
const QTY_MSG = "Ange ett giltigt antal (större än 0).";
const ROW_TYPE_MSG = "Välj en giltig radtyp.";

const ROW_TYPES = [
  "labor",
  "material",
  "subcontractor",
  "machinery",
  "other",
] as const;
const DISPLAY_MODES = ["detailed", "summary", "text_only"] as const;
const DOCUMENT_VAT_TYPES = ["STANDARD_VAT_25", "REVERSE_CHARGE_CONSTRUCTION"] as const;

/**
 * Read a FormData entry as a string. Returns undefined ONLY for an absent field or an
 * EMPTY string (the `isPresent('')===false` convention — empty = absent/dropped). A
 * WHITESPACE-ONLY value is returned VERBATIM (non-empty) so the server can reject it as
 * present-but-blank; this parser never silently drops a whitespace-only value.
 */
function rawField(form: FormData, name: string): string | undefined {
  const raw = form.get(name);
  if (typeof raw !== "string") return undefined;
  if (raw === "") return undefined; // empty-string = absent (dropped)
  return raw; // non-empty (incl. whitespace-only) passes through
}

/**
 * Read a TRIMMED string, or undefined when absent/empty/whitespace-only. Used for id and
 * enum fields where surrounding whitespace is never meaningful (a UUID/enum with whitespace
 * would be rejected by the server anyway). This is DISTINCT from `rawField`, which preserves
 * a whitespace-only value so the server can reject a present-but-blank title/unit.
 */
function trimmedField(form: FormData, name: string): string | undefined {
  const raw = rawField(form, name);
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Collect the raw (string) values for echo-back on failure. */
function collectValues(
  form: FormData,
  names: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of names) {
    // Flag fields carry a hidden `false` followed by an optional checked `true`.
    // Echo the last value just as `parseFlag` does so failed forms preserve the user's toggle.
    const all = form.getAll(name);
    const raw = all[all.length - 1];
    if (typeof raw === "string") out[name] = raw;
  }
  return out;
}

/**
 * Read a boolean flag. With a hidden `false` companion rendered before the checkbox, the
 * FormData carries `["false"]` when unchecked and `["false", "true"]` when checked (the
 * browser submits both the companion and the checked box). Read the LAST value so a checked
 * box wins and an unchecked box is an EXPLICIT `false`. Returns undefined only when the
 * name is entirely absent (a form that does not render the flag at all).
 */
function parseFlag(form: FormData, name: string): boolean | undefined {
  const all = form.getAll(name);
  if (all.length === 0) return undefined;
  const last = all[all.length - 1];
  return last === "true" || last === "on";
}

// ─────────────────────────────────────────────────────────────────────────────
// Calculation (header) forms
// ─────────────────────────────────────────────────────────────────────────────

const CALC_FIELDS = ["id", "customer_id", "facility_id", "contact_id", "title", "status"] as const;

/**
 * Parse a calc CREATE form: `customer_id` + required `title` (+ optional facility/contact).
 */
export function parseCreateCalculationForm(form: FormData): ParsedCalcForm {
  const fieldErrors: Record<string, string> = {};
  const values = collectValues(form, CALC_FIELDS);

  const customerId = trimmedField(form, "customer_id");
  if (!customerId) fieldErrors.customer_id = REQUIRED_MSG;
  const title = rawField(form, "title");
  if (!title || title.trim().length === 0) fieldErrors.title = REQUIRED_MSG;

  const input: Record<string, unknown> = {
    customer_id: customerId,
    facility_id: trimmedField(form, "facility_id"),
    contact_id: trimmedField(form, "contact_id"),
    title,
  };
  return { input, fieldErrors, values };
}

/** Parse a calc UPDATE form: id + optional title/status (only CHANGED fields included). */
export function parseUpdateCalculationForm(form: FormData): ParsedCalcForm {
  const fieldErrors: Record<string, string> = {};
  const values = collectValues(form, CALC_FIELDS);

  const id = trimmedField(form, "id");
  if (!id) fieldErrors.id = REQUIRED_MSG;
  // title: present-but-blank (whitespace-only) is rejected by the server; an empty string
  // is dropped (id-only no-op update). We forward the raw value when present.
  const title = rawField(form, "title");
  const status = trimmedField(form, "status");

  const input: Record<string, unknown> = { id };
  if (title !== undefined) input.title = title;
  if (status !== undefined) input.status = status;
  return { input, fieldErrors, values };
}

const TAX_INPUT_FIELDS = [
  "id",
  "document_vat_type",
  "buyer_vat_number",
  "deduction_choice",
  "payment_date",
  "final_payment_date",
  "green_basis_method",
  "genuine_fixed_price",
  "fixed_price_kronor",
  "fixed_solar_kronor",
  "fixed_storage_kronor",
  "fixed_charging_kronor",
  ...Array.from({ length: 50 }, (_, index) => index + 1).flatMap((number) => [
    `person_${number}_rot_remaining_kronor`,
    `person_${number}_combined_rot_rut_remaining_kronor`,
    `person_${number}_green_remaining_kronor`,
  ]),
] as const;

/** Parse the complete versioned document tax form into one atomic header snapshot. */
export function parseUpdateTaxInputForm(form: FormData): ParsedCalcForm {
  const fieldErrors: Record<string, string> = {};
  const values = collectValues(form, TAX_INPUT_FIELDS);
  const id = trimmedField(form, "id");
  if (!id) fieldErrors.id = REQUIRED_MSG;

  const documentVatType = trimmedField(form, "document_vat_type");
  if (!documentVatType || !(DOCUMENT_VAT_TYPES as readonly string[]).includes(documentVatType)) {
    fieldErrors.document_vat_type = "Välj en giltig momshantering.";
  }
  const deductionChoice = trimmedField(form, "deduction_choice");
  if (!deductionChoice || !(TAX_DEDUCTION_CHOICES as readonly string[]).includes(deductionChoice)) {
    fieldErrors.deduction_choice = "Välj ett giltigt skatteavdrag.";
  }
  const greenBasisMethod = trimmedField(form, "green_basis_method");
  if (!greenBasisMethod || !(GREEN_BASIS_METHODS as readonly string[]).includes(greenBasisMethod)) {
    fieldErrors.green_basis_method = "Välj en giltig beräkningsgrund.";
  }
  // The buyer identifier is a reverse-charge fact, not reusable customer master data. A stale
  // browser value must be discarded as soon as standard VAT is selected.
  const buyerVatNumber =
    documentVatType === "REVERSE_CHARGE_CONSTRUCTION"
      ? (trimmedField(form, "buyer_vat_number") ?? null)
      : null;
  if (buyerVatNumber !== null && !isValidBuyerVatNumber(buyerVatNumber)) {
    fieldErrors.buyer_vat_number = "Ange ett giltigt momsregistreringsnummer.";
  }
  if (documentVatType === "REVERSE_CHARGE_CONSTRUCTION" && buyerVatNumber === null) {
    fieldErrors.buyer_vat_number = "Ange köparens momsregistreringsnummer vid omvänd betalningsskyldighet.";
  }
  const readsRot = deductionChoice === "ROT" || deductionChoice === "ROT_AND_GREEN";
  const readsGreen = deductionChoice === "GREEN" || deductionChoice === "ROT_AND_GREEN";
  const paymentDate = readsRot ? (trimmedField(form, "payment_date") ?? null) : null;
  const finalPaymentDate = readsGreen
    ? (trimmedField(form, "final_payment_date") ?? null)
    : null;
  if ((readsRot && paymentDate === null) || (paymentDate !== null && !isIsoCalendarDate(paymentDate))) {
    fieldErrors.payment_date = "Ange ett giltigt betalningsdatum för ROT.";
  }
  if (
    (readsGreen && finalPaymentDate === null) ||
    (finalPaymentDate !== null && !isIsoCalendarDate(finalPaymentDate))
  ) {
    fieldErrors.final_payment_date = "Ange ett giltigt slutbetalningsdatum för grön teknik.";
  }

  const fixedPriceOre = optionalTaxPrice(form, "fixed_price_kronor", fieldErrors);
  const fixedSolarOre = optionalTaxPrice(form, "fixed_solar_kronor", fieldErrors);
  const fixedStorageOre = optionalTaxPrice(form, "fixed_storage_kronor", fieldErrors);
  const fixedChargingOre = optionalTaxPrice(form, "fixed_charging_kronor", fieldErrors);

  const personAllowanceSlots: Record<string, unknown>[] = [];
  let rotAllowanceCount = 0;
  let greenAllowanceCount = 0;
  for (let personNumber = 1; personNumber <= 50; personNumber += 1) {
    const prefix = `person_${personNumber}`;
    const rot = optionalTaxPrice(form, `${prefix}_rot_remaining_kronor`, fieldErrors);
    const combined = optionalTaxPrice(
      form,
      `${prefix}_combined_rot_rut_remaining_kronor`,
      fieldErrors,
    );
    const green = optionalTaxPrice(form, `${prefix}_green_remaining_kronor`, fieldErrors);
    if (readsRot && rot !== null) {
      rotAllowanceCount += 1;
      if (combined === null) {
        fieldErrors[`${prefix}_combined_rot_rut_remaining_kronor`] =
          "Ange personens återstående gemensamma ROT/RUT-utrymme.";
      }
    }
    if (readsGreen && green !== null) greenAllowanceCount += 1;
    if ((readsRot && (rot !== null || combined !== null)) || (readsGreen && green !== null)) {
      personAllowanceSlots.push({
        slot: `PERSON_${personNumber}`,
        ...(!readsRot || rot === null ? {} : { remainingRotAllowanceOre: rot }),
        ...(!readsRot || combined === null
          ? {}
          : { remainingCombinedRotRutAllowanceOre: combined }),
        ...(!readsGreen || green === null ? {} : { remainingGreenAllowanceOre: green }),
      });
    }
  }
  if (readsRot && rotAllowanceCount === 0) {
    fieldErrors.person_1_rot_remaining_kronor = "Ange återstående ROT-utrymme för minst en person.";
  }
  if (readsGreen && greenAllowanceCount === 0) {
    fieldErrors.person_1_green_remaining_kronor =
      "Ange återstående utrymme för grön teknik för minst en person.";
  }

  const fixedSplitComplete =
    fixedSolarOre !== null && fixedStorageOre !== null && fixedChargingOre !== null;
  const anyFixedSplit =
    fixedSolarOre !== null || fixedStorageOre !== null || fixedChargingOre !== null;
  const usesFixedPrice = readsGreen && greenBasisMethod === "FIXED_PRICE_97_PERCENT";
  const genuineFixedPrice = usesFixedPrice
    ? (parseFlag(form, "genuine_fixed_price") ?? false)
    : false;
  if (usesFixedPrice && anyFixedSplit && !fixedSplitComplete) {
    if (fixedSolarOre === null) fieldErrors.fixed_solar_kronor = "Ange solandelen.";
    if (fixedStorageOre === null) fieldErrors.fixed_storage_kronor = "Ange lagringsandelen.";
    if (fixedChargingOre === null) fieldErrors.fixed_charging_kronor = "Ange laddningsandelen.";
  }
  if (usesFixedPrice) {
    if (!genuineFixedPrice) {
      fieldErrors.genuine_fixed_price = "Bekräfta att avtalet är ett äkta fastprisavtal.";
    }
    if (fixedPriceOre === null) fieldErrors.fixed_price_kronor = "Ange fastpriset.";
    if (!fixedSplitComplete) {
      if (fixedSolarOre === null) fieldErrors.fixed_solar_kronor = "Ange solandelen.";
      if (fixedStorageOre === null) fieldErrors.fixed_storage_kronor = "Ange lagringsandelen.";
      if (fixedChargingOre === null) fieldErrors.fixed_charging_kronor = "Ange laddningsandelen.";
    } else if (
      fixedPriceOre !== null &&
      fixedSolarOre + fixedStorageOre + fixedChargingOre !== fixedPriceOre
    ) {
      fieldErrors.fixed_price_kronor = "Fastpriset måste motsvara summan av kategoriandelarna.";
    }
  }
  const taxInputSnapshot = {
    schemaVersion: 2,
    documentVatType,
    buyerVatNumber,
    deductionChoice,
    paymentDate,
    finalPaymentDate,
    personAllowanceSlots,
    greenBasisMethod: readsGreen ? greenBasisMethod : "ACTUAL_ELIGIBLE_COSTS",
    genuineFixedPrice,
    fixedPriceOre: usesFixedPrice ? fixedPriceOre : null,
    fixedPriceCategorySplitOre: usesFixedPrice && fixedSplitComplete
      ? { SOLAR: fixedSolarOre, STORAGE: fixedStorageOre, CHARGING: fixedChargingOre }
      : null,
  };
  return {
    input: { id, tax_input_snapshot: taxInputSnapshot },
    fieldErrors,
    values,
  };
}

function optionalTaxPrice(
  form: FormData,
  name: string,
  fieldErrors: Record<string, string>,
): number | null {
  const raw = form.get(name);
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  const parsed = kronorStringToOre(raw);
  if (!parsed.ok) {
    fieldErrors[name] = PRICE_MSG;
    return null;
  }
  return parsed.ore;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section forms
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_FIELDS = ["id", "calculation_id", "title", "display_mode"] as const;

/** Parse a section CREATE form: calculation_id + optional title/display_mode. */
export function parseCreateSectionForm(form: FormData): ParsedCalcForm {
  const fieldErrors: Record<string, string> = {};
  const values = collectValues(form, SECTION_FIELDS);

  const calculationId = trimmedField(form, "calculation_id");
  if (!calculationId) fieldErrors.calculation_id = REQUIRED_MSG;

  const input: Record<string, unknown> = {
    calculation_id: calculationId,
    title: rawField(form, "title"),
    display_mode: parseDisplayMode(form),
  };
  return { input, fieldErrors, values };
}

/** Parse a section UPDATE form: id + optional title/display_mode. */
export function parseUpdateSectionForm(form: FormData): ParsedCalcForm {
  const fieldErrors: Record<string, string> = {};
  const values = collectValues(form, SECTION_FIELDS);

  const id = trimmedField(form, "id");
  if (!id) fieldErrors.id = REQUIRED_MSG;

  const input: Record<string, unknown> = { id };
  const title = rawField(form, "title");
  if (title !== undefined) input.title = title;
  const displayMode = parseDisplayMode(form);
  if (displayMode !== undefined) input.display_mode = displayMode;
  return { input, fieldErrors, values };
}

function parseDisplayMode(form: FormData): string | undefined {
  const value = trimmedField(form, "display_mode");
  if (value === undefined) return undefined;
  // The server re-validates against the closed set; we forward the value verbatim (an
  // out-of-set value would surface as VALIDATION_FAILED). The client select only offers
  // valid options, so this is a UX-nicety pass-through.
  void DISPLAY_MODES;
  return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Row forms
// ─────────────────────────────────────────────────────────────────────────────

const ROW_FIELDS = [
  "id",
  "section_id",
  "row_type",
  "quantity",
  "unit",
  "unit_cost_kronor",
  "unit_sell_kronor",
  "markup_percent",
  "vat_percent",
  "original_vat_percent",
  "included_in_invoice_total",
  "deduction_classification",
  "original_deduction_classification",
  "vat_type",
  "original_vat_type",
  "is_hidden",
  "is_optional",
  "is_selected",
  "label",
  "description",
  "internal_note",
  "quote_note",
  "source_kind",
  "source_id",
  "source_clear",
] as const;

/**
 * Parse a row CREATE form. section_id + row_type + quantity + unit are required; the money
 * fields are entered as kronor/percent and converted at the boundary (öre / bp). The flags
 * are read via `parseFlag` (hidden-companion aware) so each is an explicit boolean.
 */
export function parseCreateRowForm(form: FormData): ParsedCalcForm {
  const fieldErrors: Record<string, string> = {};
  const values = collectValues(form, ROW_FIELDS);

  const sectionId = trimmedField(form, "section_id");
  if (!sectionId) fieldErrors.section_id = REQUIRED_MSG;

  const rowType = trimmedField(form, "row_type");
  if (!rowType || !(ROW_TYPES as readonly string[]).includes(rowType)) {
    fieldErrors.row_type = ROW_TYPE_MSG;
  }

  const quantity = parseQuantity(form, fieldErrors, /* required */ true);
  const unit = rawField(form, "unit");
  if (!unit || unit.trim().length === 0) fieldErrors.unit = REQUIRED_MSG;

  const unitCost = parsePrice(form, "unit_cost_kronor", fieldErrors, /* required */ false);
  const unitSell = parsePrice(form, "unit_sell_kronor", fieldErrors, /* required */ false);
  const markup = parseMarkup(form, fieldErrors);
  const vat = parseVat(form, fieldErrors, /* required */ true);

  const input: Record<string, unknown> = {
    section_id: sectionId,
    row_type: rowType,
    unit,
  };
  if (quantity !== undefined) input.quantity = quantity;
  if (unitCost !== undefined) input.unit_cost_ore = unitCost;
  if (unitSell !== undefined) input.unit_sell_ore = unitSell;
  if (markup !== undefined) input.markup_bp = markup;
  if (vat !== undefined) input.vat_rate_bp = vat;
  attachFlags(form, input);
  attachRowText(form, input);
  attachSource(form, input);

  return { input, fieldErrors, values };
}

/**
 * Parse a row UPDATE form. id required; every other field optional. Money/percent fields
 * convert at the boundary; the flags are read via `parseFlag` so a flag can be turned OFF
 * (the epic-3 trap fix). Only CHANGED/present fields are included (the server short-circuits
 * an empty patch to a safe id-only no-op).
 */
export function parseUpdateRowForm(form: FormData): ParsedCalcForm {
  const fieldErrors: Record<string, string> = {};
  const values = collectValues(form, ROW_FIELDS);

  const id = trimmedField(form, "id");
  if (!id) fieldErrors.id = REQUIRED_MSG;

  const input: Record<string, unknown> = { id };

  const rowType = trimmedField(form, "row_type");
  if (rowType !== undefined) {
    if (!(ROW_TYPES as readonly string[]).includes(rowType)) {
      fieldErrors.row_type = ROW_TYPE_MSG;
    } else {
      input.row_type = rowType;
    }
  }

  const quantity = parseQuantity(form, fieldErrors, /* required */ false);
  if (quantity !== undefined) input.quantity = quantity;
  const unit = rawField(form, "unit");
  if (unit !== undefined) input.unit = unit;

  const unitCost = parsePrice(form, "unit_cost_kronor", fieldErrors, false);
  if (unitCost !== undefined) input.unit_cost_ore = unitCost;
  const unitSell = parsePrice(form, "unit_sell_kronor", fieldErrors, false);
  if (unitSell !== undefined) input.unit_sell_ore = unitSell;
  const markup = parseMarkup(form, fieldErrors);
  if (markup !== undefined) input.markup_bp = markup;
  const vat = parseVat(form, fieldErrors, /* required */ false);
  const submittedVatPercent = rawField(form, "vat_percent");
  const originalVatPercent = rawField(form, "original_vat_percent");
  if (vat !== undefined && submittedVatPercent !== originalVatPercent) input.vat_rate_bp = vat;

  // Flags: explicit false when the companion is present so a flag can be turned OFF.
  attachFlags(form, input);
  const submittedClassification = rawField(form, "deduction_classification");
  const originalClassification = rawField(form, "original_deduction_classification");
  if (submittedClassification === originalClassification) delete input.deduction_classification;
  const submittedVatType = rawField(form, "vat_type");
  const originalVatType = rawField(form, "original_vat_type");
  if (submittedVatType === originalVatType) delete input.vat_type;
  attachRowText(form, input);
  attachSource(form, input);

  return { input, fieldErrors, values };
}

/** Attach the hidden/optional/selected flags to the input (each an explicit boolean). */
function attachFlags(
  form: FormData,
  input: Record<string, unknown>,
): void {
  const hidden = parseFlag(form, "is_hidden");
  if (hidden !== undefined) input.is_hidden = hidden;
  const included = parseFlag(form, "included_in_invoice_total");
  if (included !== undefined) input.included_in_invoice_total = included;
  const optional = parseFlag(form, "is_optional");
  if (optional !== undefined) input.is_optional = optional;
  const selected = parseFlag(form, "is_selected");
  if (selected !== undefined) input.is_selected = selected;

  const classification = trimmedField(form, "deduction_classification");
  if (classification !== undefined) input.deduction_classification = classification;
  const vatType = trimmedField(form, "vat_type");
  if (vatType !== undefined) input.vat_type = vatType;
  void DEDUCTION_CLASSIFICATIONS;
}

/** Attach the row's free-text fields (label/description/internal_note/quote_note). */
function attachRowText(form: FormData, input: Record<string, unknown>): void {
  const label = rawField(form, "label");
  if (label !== undefined) input.label = label;
  const description = rawField(form, "description");
  if (description !== undefined) input.description = description;
  const internalNote = rawField(form, "internal_note");
  if (internalNote !== undefined) input.internal_note = internalNote;
  const quoteNote = rawField(form, "quote_note");
  if (quoteNote !== undefined) input.quote_note = quoteNote;
}

/**
 * Attach the OPTIONAL pricing-source pair (Story 5.3). Reads the trimmed `source_kind`/
 * `source_id` (empty-string = absent, `isPresent('')===false` — a manual row). The server
 * RE-RESOLVES the source from the id (the client never supplies the captured name/rate).
 * When the row editor submits an EXPLICIT clear (`source_clear=true`), forward it so ALL
 * `source_*` columns clear together on update (Task 2.4 — the cleared-binding trap). A clear
 * is dropped when a source pair is ALSO present (the source pair wins; the validator would
 * reject a contradictory clear+pair anyway).
 */
function attachSource(form: FormData, input: Record<string, unknown>): void {
  const kind = trimmedField(form, "source_kind");
  const id = trimmedField(form, "source_id");
  if (kind !== undefined) input.source_kind = kind;
  if (id !== undefined) input.source_id = id;
  // The explicit clear companion — only meaningful when no source pair is present.
  if (kind === undefined && id === undefined) {
    const clear = parseFlag(form, "source_clear");
    if (clear === true) input.source_clear = true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Archive + reorder forms
// ─────────────────────────────────────────────────────────────────────────────

/** Parse an archive form (calc / section / row) — the target id only. */
export function parseArchiveForm(form: FormData): ParsedCalcForm {
  const fieldErrors: Record<string, string> = {};
  const id = trimmedField(form, "id");
  if (!id) fieldErrors.id = REQUIRED_MSG;
  return { input: { id }, fieldErrors, values: collectValues(form, ["id"]) };
}

/**
 * Parse a section-reorder form: `calculation_id` + `ordered_section_ids` (a
 * comma-separated id list submitted as a single hidden field). Splits + trims into an
 * array the `reorderSections` command consumes.
 */
export function parseReorderSectionsForm(form: FormData): ParsedCalcForm {
  const fieldErrors: Record<string, string> = {};
  const calculationId = trimmedField(form, "calculation_id");
  if (!calculationId) fieldErrors.calculation_id = REQUIRED_MSG;
  const ordered = parseIdList(form, "ordered_section_ids");
  if (ordered.length === 0) fieldErrors.ordered_section_ids = REQUIRED_MSG;
  return {
    input: { calculation_id: calculationId, ordered_section_ids: ordered },
    fieldErrors,
    values: collectValues(form, ["calculation_id", "ordered_section_ids"]),
  };
}

/**
 * Parse a row-reorder form: `section_id` + `ordered_row_ids` (a comma-separated id list).
 */
export function parseReorderRowsForm(form: FormData): ParsedCalcForm {
  const fieldErrors: Record<string, string> = {};
  const sectionId = trimmedField(form, "section_id");
  if (!sectionId) fieldErrors.section_id = REQUIRED_MSG;
  const ordered = parseIdList(form, "ordered_row_ids");
  if (ordered.length === 0) fieldErrors.ordered_row_ids = REQUIRED_MSG;
  return {
    input: { section_id: sectionId, ordered_row_ids: ordered },
    fieldErrors,
    values: collectValues(form, ["section_id", "ordered_row_ids"]),
  };
}

/** Split a comma-separated id field into a trimmed, non-empty id array. */
function parseIdList(form: FormData, name: string): string[] {
  const raw = form.get(name);
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Field parsers (kronor→öre, percent→bp, quantity)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a kronor price field into integer öre. Records a field-associated error (and
 * returns undefined) when malformed — or, for a REQUIRED field, when missing. A blank
 * OPTIONAL field returns undefined with NO error (the field is simply omitted).
 */
function parsePrice(
  form: FormData,
  name: string,
  fieldErrors: Record<string, string>,
  required: boolean,
): number | undefined {
  const raw = form.get(name);
  const str = typeof raw === "string" ? raw : "";
  if (str.trim().length === 0) {
    if (required) fieldErrors[name] = REQUIRED_MSG;
    return undefined;
  }
  const parsed = kronorStringToOre(str);
  if (!parsed.ok) {
    fieldErrors[name] = PRICE_MSG;
    return undefined;
  }
  return parsed.ore;
}

/** Parse the VAT percent field into basis points (required on create). */
function parseVat(
  form: FormData,
  fieldErrors: Record<string, string>,
  required: boolean,
): number | undefined {
  const raw = form.get("vat_percent");
  const str = typeof raw === "string" ? raw : "";
  if (str.trim().length === 0) {
    if (required) fieldErrors.vat_percent = REQUIRED_MSG;
    return undefined;
  }
  const parsed = percentStringToBp(str);
  if (!parsed.ok) {
    fieldErrors.vat_percent = VAT_MSG;
    return undefined;
  }
  return parsed.bp;
}

/** Parse the OPTIONAL markup percent field into basis points. */
function parseMarkup(
  form: FormData,
  fieldErrors: Record<string, string>,
): number | undefined {
  const raw = form.get("markup_percent");
  const str = typeof raw === "string" ? raw : "";
  if (str.trim().length === 0) return undefined; // optional → omit
  const parsed = percentStringToMarkupBp(str);
  if (!parsed.ok) {
    fieldErrors.markup_percent = MARKUP_MSG;
    return undefined;
  }
  return parsed.bp;
}

/** Parse a quantity field into a positive number. */
function parseQuantity(
  form: FormData,
  fieldErrors: Record<string, string>,
  required: boolean,
): number | undefined {
  const raw = form.get("quantity");
  const str = typeof raw === "string" ? raw : "";
  if (str.trim().length === 0) {
    if (required) fieldErrors.quantity = REQUIRED_MSG;
    return undefined;
  }
  // Accept a Swedish comma decimal for the quantity too (e.g. "1,5").
  const normalized = str.trim().replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    fieldErrors.quantity = QTY_MSG;
    return undefined;
  }
  return value;
}
