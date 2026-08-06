/**
 * Story 5.2 — UNIT tests for the PURE calc-editor FormData parsers
 * (`src/features/calculations/form-parsing.ts`). 5.2-UNIT-03 (P2, AC3): flag persistence +
 * form-parse round-trip incl. the FLAG-TURN-OFF fix (epic-3 trap) and the
 * `isPresent('')===false` convention (empty title/unit dropped; whitespace-only preserved for
 * the server to reject). Runs under `node --test`.
 *
 * The server `validateInput` is the AUTHORITY; these guard the form so a near-miss surfaces
 * as a field-associated message and the kronor→öre / percent→bp conversion never leaks a float.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseArchiveForm,
  parseCreateCalculationForm,
  parseCreateRowForm,
  parseCreateSectionForm,
  parseReorderRowsForm,
  parseReorderSectionsForm,
  parseUpdateCalculationForm,
  parseUpdateRowForm,
  parseUpdateSectionForm,
  parseUpdateTaxInputForm,
} from "@/features/calculations/form-parsing";

const CUST = "11111111-1111-1111-1111-111111111111";
const SECT = "22222222-2222-2222-2222-222222222222";
const ROW = "33333333-3333-3333-3333-333333333333";

/** Build a FormData. A flag with a hidden `false` companion is modelled by appending both. */
function fd(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(entries)) form.set(k, v);
  return form;
}

/** Append a flag as the browser would with the hidden-companion pattern. */
function withFlag(form: FormData, name: string, checked: boolean): FormData {
  form.append(name, "false"); // the hidden companion (always submitted)
  if (checked) form.append(name, "true"); // the checkbox (only when checked)
  return form;
}

// ── Calculation create/update ────────────────────────────────────────────────────

test("createCalculation: a valid form parses customer_id + title", () => {
  const parsed = parseCreateCalculationForm(fd({ customer_id: CUST, title: "Villa Ek" }));
  assert.deepEqual(parsed.fieldErrors, {});
  assert.equal(parsed.input.customer_id, CUST);
  assert.equal(parsed.input.title, "Villa Ek");
});

test("createCalculation: a missing title is a field error; input preserved for echo", () => {
  const parsed = parseCreateCalculationForm(fd({ customer_id: CUST, title: "" }));
  assert.ok(parsed.fieldErrors.title);
});

test("updateCalculation: an EMPTY-STRING title is DROPPED (id-only no-op update)", () => {
  // isPresent('')===false convention: empty string = absent → not sent (empty-patch-safe).
  const parsed = parseUpdateCalculationForm(fd({ id: CUST, title: "" }));
  assert.equal("title" in parsed.input, false);
  assert.equal(parsed.input.id, CUST);
});

test("updateCalculation: a WHITESPACE-ONLY title is PRESERVED (server rejects present-but-blank)", () => {
  const parsed = parseUpdateCalculationForm(fd({ id: CUST, title: "   " }));
  assert.equal(parsed.input.title, "   "); // forwarded verbatim; the server rejects it
});

test("updateCalculation: a status is forwarded when present", () => {
  const parsed = parseUpdateCalculationForm(fd({ id: CUST, status: "ready" }));
  assert.equal(parsed.input.status, "ready");
});

// ── Section create/update ────────────────────────────────────────────────────────

test("createSection: parses calculation_id; an EMPTY title is dropped to undefined", () => {
  const parsed = parseCreateSectionForm(fd({ calculation_id: CUST, title: "" }));
  assert.equal(parsed.input.calculation_id, CUST);
  // An empty-string title is dropped to undefined (the command's optional-field guard then
  // omits it) — the isPresent('')===false convention.
  assert.equal(parsed.input.title, undefined);
});

test("updateSection: an omitted title is NOT included (only changed fields)", () => {
  const parsed = parseUpdateSectionForm(fd({ id: SECT }));
  assert.equal("title" in parsed.input, false);
  assert.equal(parsed.input.id, SECT);
});

test("updateSection: a display_mode is forwarded", () => {
  const parsed = parseUpdateSectionForm(fd({ id: SECT, display_mode: "summary" }));
  assert.equal(parsed.input.display_mode, "summary");
});

// ── Row create: money boundary + required fields ─────────────────────────────────

test("createRow: kronor→öre and percent→bp conversions happen at the boundary", () => {
  const parsed = parseCreateRowForm(
    fd({
      section_id: SECT,
      row_type: "labor",
      quantity: "2",
      unit: "h",
      unit_cost_kronor: "300,00",
      unit_sell_kronor: "600,00",
      markup_percent: "100",
      vat_percent: "25",
    }),
  );
  assert.deepEqual(parsed.fieldErrors, {});
  assert.equal(parsed.input.unit_cost_ore, 30000);
  assert.equal(parsed.input.unit_sell_ore, 60000);
  assert.equal(parsed.input.markup_bp, 10000);
  assert.equal(parsed.input.vat_rate_bp, 2500);
  assert.equal(parsed.input.quantity, 2);
  assert.equal(parsed.input.row_type, "labor");
});

test("createRow: a Swedish-comma quantity (1,5) parses to 1.5", () => {
  const parsed = parseCreateRowForm(
    fd({ section_id: SECT, row_type: "material", quantity: "1,5", unit: "st", vat_percent: "25" }),
  );
  assert.deepEqual(parsed.fieldErrors, {});
  assert.equal(parsed.input.quantity, 1.5);
});

test("createRow: a NEGATIVE / malformed price is a FIELD error, not a coerced float", () => {
  const parsed = parseCreateRowForm(
    fd({
      section_id: SECT,
      row_type: "labor",
      quantity: "1",
      unit: "h",
      unit_sell_kronor: "-50",
      vat_percent: "25",
    }),
  );
  assert.ok(parsed.fieldErrors.unit_sell_kronor);
  assert.equal("unit_sell_ore" in parsed.input, false);
});

test("createRow: a missing VAT is a field error (VAT is required on create)", () => {
  const parsed = parseCreateRowForm(
    fd({ section_id: SECT, row_type: "labor", quantity: "1", unit: "h" }),
  );
  assert.ok(parsed.fieldErrors.vat_percent);
});

test("createRow: an out-of-set row_type is a field error", () => {
  const parsed = parseCreateRowForm(
    fd({ section_id: SECT, row_type: "bogus", quantity: "1", unit: "h", vat_percent: "25" }),
  );
  assert.ok(parsed.fieldErrors.row_type);
});

test("createRow: a zero/negative quantity is a field error", () => {
  const parsed = parseCreateRowForm(
    fd({ section_id: SECT, row_type: "labor", quantity: "0", unit: "h", vat_percent: "25" }),
  );
  assert.ok(parsed.fieldErrors.quantity);
});

// ── Row flags: the epic-3 turn-OFF fix ───────────────────────────────────────────

test("5.2-UNIT-03: a CHECKED flag (companion + checkbox) parses to TRUE", () => {
  const form = fd({ id: ROW });
  withFlag(form, "is_hidden", true);
  const parsed = parseUpdateRowForm(form);
  assert.equal(parsed.input.is_hidden, true);
});

test("5.2-UNIT-03: an UNCHECKED flag (companion only) parses to an EXPLICIT FALSE (turn-OFF)", () => {
  // This is the epic-3 trap fix: an unchecked box submits only its hidden `false` companion,
  // so the parser reads an EXPLICIT false — a flag can be turned OFF on update.
  const form = fd({ id: ROW });
  withFlag(form, "is_hidden", false);
  withFlag(form, "is_optional", false);
  withFlag(form, "is_selected", false);
  const parsed = parseUpdateRowForm(form);
  assert.equal(parsed.input.is_hidden, false);
  assert.equal(parsed.input.is_optional, false);
  assert.equal(parsed.input.is_selected, false);
});

test("5.2-UNIT-03: mixed flags — selected ON while hidden/optional OFF", () => {
  const form = fd({ id: ROW });
  withFlag(form, "is_hidden", false);
  withFlag(form, "is_optional", true);
  withFlag(form, "is_selected", true);
  const parsed = parseUpdateRowForm(form);
  assert.equal(parsed.input.is_hidden, false);
  assert.equal(parsed.input.is_optional, true);
  assert.equal(parsed.input.is_selected, true);
});

test("5.2-UNIT-03: a flag entirely ABSENT from the form is not included (undefined)", () => {
  const parsed = parseUpdateRowForm(fd({ id: ROW }));
  assert.equal("is_hidden" in parsed.input, false);
});

test("updateRow: an EMPTY unit is dropped; a whitespace-only unit is preserved", () => {
  const dropped = parseUpdateRowForm(fd({ id: ROW, unit: "" }));
  assert.equal("unit" in dropped.input, false);
  const preserved = parseUpdateRowForm(fd({ id: ROW, unit: "  " }));
  assert.equal(preserved.input.unit, "  ");
});

// ── Archive + reorder ────────────────────────────────────────────────────────────

test("archive: the id-only parse requires an id", () => {
  assert.deepEqual(parseArchiveForm(fd({ id: ROW })).input, { id: ROW });
  assert.ok(parseArchiveForm(fd({})).fieldErrors.id);
});

test("reorderRows: a comma-separated id list splits into a trimmed array", () => {
  const parsed = parseReorderRowsForm(
    fd({ section_id: SECT, ordered_row_ids: `${ROW}, ${CUST} ,${SECT}` }),
  );
  assert.deepEqual(parsed.fieldErrors, {});
  assert.deepEqual(parsed.input.ordered_row_ids, [ROW, CUST, SECT]);
});

test("reorderSections: an empty id list is a field error", () => {
  const parsed = parseReorderSectionsForm(fd({ calculation_id: CUST, ordered_section_ids: "" }));
  assert.ok(parsed.fieldErrors.ordered_section_ids);
});

test("reorderSections: a valid id list parses to the ordered array", () => {
  const parsed = parseReorderSectionsForm(
    fd({ calculation_id: CUST, ordered_section_ids: `${SECT},${ROW}` }),
  );
  assert.deepEqual(parsed.fieldErrors, {});
  assert.deepEqual(parsed.input.ordered_section_ids, [SECT, ROW]);
  assert.equal(parsed.input.calculation_id, CUST);
});

test("reorderRows: trailing commas / blank entries are FILTERED out of the id array", () => {
  const parsed = parseReorderRowsForm(
    fd({ section_id: SECT, ordered_row_ids: `${ROW}, , ,${CUST},` }),
  );
  assert.deepEqual(parsed.input.ordered_row_ids, [ROW, CUST]);
});

test("reorderRows: a missing section_id is a field error", () => {
  const parsed = parseReorderRowsForm(fd({ ordered_row_ids: ROW }));
  assert.ok(parsed.fieldErrors.section_id);
});

// ── AC2: values echo-back — the form PRESERVES input on a validation failure ──────

test("AC2: a failed createRow echoes back the submitted values verbatim (preserve input)", () => {
  const parsed = parseCreateRowForm(
    fd({
      section_id: SECT,
      row_type: "labor",
      quantity: "2",
      unit: "h",
      unit_sell_kronor: "-50", // malformed → a field error
      vat_percent: "25",
      label: "Framdragning",
    }),
  );
  // The parse failed (bad price)…
  assert.ok(parsed.fieldErrors.unit_sell_kronor);
  // …but every submitted value is echoed back so the form never clears the admin's input.
  assert.equal(parsed.values.unit_sell_kronor, "-50");
  assert.equal(parsed.values.quantity, "2");
  assert.equal(parsed.values.unit, "h");
  assert.equal(parsed.values.label, "Framdragning");
});

test("AC2: a failed createCalculation echoes back the title/customer values", () => {
  const parsed = parseCreateCalculationForm(fd({ customer_id: "", title: "Villa Ek" }));
  assert.ok(parsed.fieldErrors.customer_id);
  assert.equal(parsed.values.title, "Villa Ek");
  assert.equal(parsed.values.customer_id, "");
});

// ── updateRow: the money boundary + malformed rejection also apply on UPDATE ──────

test("updateRow: kronor→öre / percent→bp conversions happen on UPDATE too", () => {
  const parsed = parseUpdateRowForm(
    fd({
      id: ROW,
      unit_cost_kronor: "300,00",
      unit_sell_kronor: "600,00",
      markup_percent: "50",
      vat_percent: "12",
      quantity: "4",
    }),
  );
  assert.deepEqual(parsed.fieldErrors, {});
  assert.equal(parsed.input.unit_cost_ore, 30000);
  assert.equal(parsed.input.unit_sell_ore, 60000);
  assert.equal(parsed.input.markup_bp, 5000);
  assert.equal(parsed.input.vat_rate_bp, 1200);
  assert.equal(parsed.input.quantity, 4);
});

test("updateRow: a malformed price is a FIELD error and is NOT included in the input", () => {
  const parsed = parseUpdateRowForm(fd({ id: ROW, unit_sell_kronor: "12.34" })); // dot decimal
  assert.ok(parsed.fieldErrors.unit_sell_kronor);
  assert.equal("unit_sell_ore" in parsed.input, false);
});

test("updateRow: an OMITTED money field is not included (empty-patch friendly)", () => {
  const parsed = parseUpdateRowForm(fd({ id: ROW }));
  assert.equal("unit_sell_ore" in parsed.input, false);
  assert.equal("vat_rate_bp" in parsed.input, false);
  assert.equal("quantity" in parsed.input, false);
  assert.deepEqual(parsed.input, { id: ROW });
});

// ── createRow: missing required fields surface as field errors ────────────────────

test("createRow: a missing section_id and unit are both field errors", () => {
  const parsed = parseCreateRowForm(fd({ row_type: "labor", quantity: "1", vat_percent: "25" }));
  assert.ok(parsed.fieldErrors.section_id);
  assert.ok(parsed.fieldErrors.unit);
});

// ── Row free-text fields: attach when present, drop an empty string ───────────────

test("createRow: free-text fields (label/description/notes) attach when present", () => {
  const parsed = parseCreateRowForm(
    fd({
      section_id: SECT,
      row_type: "material",
      quantity: "1",
      unit: "st",
      vat_percent: "25",
      label: "Kabel",
      description: "5x2,5",
      internal_note: "lager B",
      quote_note: "ingår",
    }),
  );
  assert.equal(parsed.input.label, "Kabel");
  assert.equal(parsed.input.description, "5x2,5");
  assert.equal(parsed.input.internal_note, "lager B");
  assert.equal(parsed.input.quote_note, "ingår");
});

test("createRow: an EMPTY free-text field is dropped (isPresent('')===false)", () => {
  const parsed = parseCreateRowForm(
    fd({
      section_id: SECT,
      row_type: "material",
      quantity: "1",
      unit: "st",
      vat_percent: "25",
      label: "",
      quote_note: "",
    }),
  );
  assert.equal("label" in parsed.input, false);
  assert.equal("quote_note" in parsed.input, false);
});

// ── updateCalculation / updateSection: a missing id is a field error ──────────────

test("updateCalculation: a missing id is a field error", () => {
  const parsed = parseUpdateCalculationForm(fd({ title: "X" }));
  assert.ok(parsed.fieldErrors.id);
});

test("updateSection: a missing id is a field error", () => {
  const parsed = parseUpdateSectionForm(fd({ title: "X" }));
  assert.ok(parsed.fieldErrors.id);
});

// ── Story 5.3: pricing-source pair round-trip + the cleared-source case ────────────

test("createRow: a source pair (source_kind+source_id) round-trips onto the input", () => {
  const parsed = parseCreateRowForm(
    fd({
      section_id: SECT,
      row_type: "labor",
      quantity: "1",
      unit: "h",
      vat_percent: "25",
      source_kind: "work_role",
      source_id: ROW,
    }),
  );
  assert.deepEqual(parsed.fieldErrors, {});
  assert.equal(parsed.input.source_kind, "work_role");
  assert.equal(parsed.input.source_id, ROW);
});

test("createRow: an EMPTY-STRING source pair is DROPPED (manual row — isPresent('')===false)", () => {
  const parsed = parseCreateRowForm(
    fd({
      section_id: SECT,
      row_type: "labor",
      quantity: "1",
      unit: "h",
      vat_percent: "25",
      source_kind: "",
      source_id: "",
    }),
  );
  // Empty-string source fields are dropped → a manual row (no source carried).
  assert.equal("source_kind" in parsed.input, false);
  assert.equal("source_id" in parsed.input, false);
});

test("updateRow: a source pair round-trips onto the update input", () => {
  const parsed = parseUpdateRowForm(
    fd({ id: ROW, source_kind: "article", source_id: SECT }),
  );
  assert.equal(parsed.input.source_kind, "article");
  assert.equal(parsed.input.source_id, SECT);
});

test("updateRow: an EXPLICIT source_clear companion maps to source_clear=true (cleared-binding)", () => {
  // The row editor renders a hidden `source_clear=true` when the admin switches a sourced row
  // back to manual — the parser forwards it so ALL source_* columns clear together.
  const form = fd({ id: ROW });
  form.append("source_clear", "true");
  const parsed = parseUpdateRowForm(form);
  assert.equal(parsed.input.source_clear, true);
  assert.equal("source_kind" in parsed.input, false);
  assert.equal("source_id" in parsed.input, false);
});

test("updateRow: a source PAIR present suppresses the clear companion (pair wins)", () => {
  const form = fd({ id: ROW, source_kind: "work_role", source_id: SECT });
  form.append("source_clear", "true");
  const parsed = parseUpdateRowForm(form);
  // With a real pair present the parser does NOT also emit source_clear (the pair is the
  // intent; the validator would reject a contradictory clear+pair anyway).
  assert.equal(parsed.input.source_kind, "work_role");
  assert.equal("source_clear" in parsed.input, false);
});

test("updateRow: no source fields at all leaves the input empty-patch safe (id only)", () => {
  const parsed = parseUpdateRowForm(fd({ id: ROW }));
  assert.equal("source_kind" in parsed.input, false);
  assert.equal("source_id" in parsed.input, false);
  assert.equal("source_clear" in parsed.input, false);
});

test("10.6 updateRow: inclusion, classification, and VAT type round-trip independently", () => {
  const form = fd({
    id: ROW,
    deduction_classification: "GREEN_STORAGE_MATERIAL",
    vat_type: "REVERSE_CHARGE_CONSTRUCTION",
  });
  withFlag(form, "included_in_invoice_total", false);
  withFlag(form, "is_hidden", true);
  const parsed = parseUpdateRowForm(form);
  assert.equal(parsed.input.included_in_invoice_total, false);
  assert.equal(parsed.input.is_hidden, true);
  assert.equal(parsed.input.deduction_classification, "GREEN_STORAGE_MATERIAL");
  assert.equal(parsed.input.vat_type, "REVERSE_CHARGE_CONSTRUCTION");
});

test("10.6 tax form: mixed deductions, dates, allowances, and kronor split become one V2 snapshot", () => {
  const form = fd({
    id: ROW,
    document_vat_type: "STANDARD_VAT_25",
    buyer_vat_number: "se 556677889901",
    deduction_choice: "ROT_AND_GREEN",
    payment_date: "2026-08-05",
    final_payment_date: "2026-08-06",
    green_basis_method: "FIXED_PRICE_97_PERCENT",
    fixed_price_kronor: "1000,00",
    fixed_solar_kronor: "400,00",
    fixed_storage_kronor: "300,00",
    fixed_charging_kronor: "300,00",
    person_1_rot_remaining_kronor: "50000,00",
    person_1_combined_rot_rut_remaining_kronor: "75000,00",
    person_1_green_remaining_kronor: "50000,00",
  });
  withFlag(form, "genuine_fixed_price", true);
  const parsed = parseUpdateTaxInputForm(form);
  assert.deepEqual(parsed.fieldErrors, {});
  assert.deepEqual(parsed.input.tax_input_snapshot, {
    schemaVersion: 2,
    documentVatType: "STANDARD_VAT_25",
    buyerVatNumber: "se 556677889901",
    deductionChoice: "ROT_AND_GREEN",
    paymentDate: "2026-08-05",
    finalPaymentDate: "2026-08-06",
    personAllowanceSlots: [
      {
        slot: "PERSON_1",
        remainingRotAllowanceOre: 5_000_000,
        remainingCombinedRotRutAllowanceOre: 7_500_000,
        remainingGreenAllowanceOre: 5_000_000,
      },
    ],
    greenBasisMethod: "FIXED_PRICE_97_PERCENT",
    genuineFixedPrice: true,
    fixedPriceOre: 100_000,
    fixedPriceCategorySplitOre: { SOLAR: 40_000, STORAGE: 30_000, CHARGING: 30_000 },
  });
});

test("10.6 tax form: authoritative draft failures are associated with actionable fields", () => {
  const form = fd({
    id: ROW,
    document_vat_type: "REVERSE_CHARGE_CONSTRUCTION",
    buyer_vat_number: "not-a-vat-number",
    deduction_choice: "ROT_AND_GREEN",
    green_basis_method: "FIXED_PRICE_97_PERCENT",
    fixed_price_kronor: "1000,00",
    fixed_solar_kronor: "400,00",
  });
  withFlag(form, "genuine_fixed_price", false);
  const parsed = parseUpdateTaxInputForm(form);
  for (const field of [
    "buyer_vat_number",
    "payment_date",
    "final_payment_date",
    "person_1_rot_remaining_kronor",
    "person_1_green_remaining_kronor",
    "genuine_fixed_price",
    "fixed_storage_kronor",
    "fixed_charging_kronor",
  ]) {
    assert.equal(typeof parsed.fieldErrors[field], "string", `${field} must carry a field error`);
  }
});

test("10.6 tax form: reverse-charge requires a buyer VAT number", () => {
  const parsed = parseUpdateTaxInputForm(fd({
    id: ROW,
    document_vat_type: "REVERSE_CHARGE_CONSTRUCTION",
    deduction_choice: "NONE",
    green_basis_method: "ACTUAL_ELIGIBLE_COSTS",
  }));
  assert.equal(typeof parsed.fieldErrors.buyer_vat_number, "string");
});
