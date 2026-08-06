"use client";

/**
 * Row editor (Story 5.2, Task 4.4 / AC3; Story 5.3, Task 3.3 / AC1/AC2/AC3/AC6) — the
 * per-row form exposing the five row types and the fields quantity, unit, unit cost (kr),
 * unit sell (kr), markup (%), VAT (%), the visibility/option flags, quote-visible label +
 * description, internal note, quote note — EACH mapping 1:1 to `CreateRowInput`/
 * `UpdateRowInput`.
 *
 * PRICING-SOURCE SELECTION (Story 5.3): a LABOR row offers a WORK-ROLE `<select>`; a MATERIAL
 * row offers an ARTICLE `<select>` (from the tenant's ACTIVE sources). A "manual / no source"
 * option is always available (the default). Selecting a source PREFILLS the row's kronor price
 * from the source rate (still editable — the row price is authoritative; the snapshot only
 * EXPLAINS provenance) and shows a small provenance line ("Källa: <name> · <rate> kr · v.
 * <captured date>") read from the FROZEN `source_*` columns. Swedish labels; NO "öre"/supplier/
 * import jargon (AC6). The `<select>` submits `source_kind`+`source_id` (via hidden fields the
 * client state drives); the server RE-RESOLVES + freezes the source (the client name/rate are
 * never trusted). Switching back to manual submits an explicit clear.
 *
 * Money at the input boundary is KRONOR/percent (Swedish comma), converted to öre/bp by the
 * form parser; the LINE TOTAL is rendered from the pure `totals.ts` (never inline math). NO
 * "öre"/"basis points" jargon in the row editor (AC6).
 *
 * FLAG-OFF FIX (epic-3 trap): each flag renders a hidden `false` companion BEFORE its
 * checkbox so an unchecked box submits an EXPLICIT `false` (a flag can always be turned OFF).
 *
 * Validation errors PRESERVE unsaved input (the parent echoes `values` back via the action
 * state), and are field-associated (aria-invalid/aria-describedby). Fields are keyboard-
 * editable and the form submits via its own action.
 */
import { useMemo, useState } from "react";
import { useActionState } from "react";
import { FormErrorSummary, SelectField, TextField } from "@/components/crm/FormField";
import {
  createRowAction,
  updateRowAction,
} from "@/features/calculations/actions";
import {
  CALC_ACTION_INITIAL,
  isRetryableCalcError,
} from "@/features/calculations/action-state";
import {
  bpToPercentString,
  markupBpToPercentString,
  oreToKronorString,
} from "@/features/calculations/money-input";
import { computeLineTotal, resolveTotalDisplay } from "@/features/calculations/totals";
import {
  MANUAL_SOURCE_VALUE,
  decodeSourceValue,
  encodeSourceValue,
  kindForRowType,
  sourcesForRowType,
} from "@/features/calculations/source-select";
import type { CalculationRowRow } from "@/features/calculations/read";
import type { RowSourceLists } from "@/features/calculations/source-options";
import {
  DEDUCTION_CLASSIFICATIONS,
  VAT_TYPES,
  isDeductionClassification,
  isDeductionClassificationCompatibleWithSummaryCategory,
  type DeductionClassification,
  type TaxSummaryCategory,
  type VatDisplayPosture,
  type VatType,
} from "@/lib/money";

const ROW_TYPE_OPTIONS = [
  { value: "labor", label: "Arbete" },
  { value: "material", label: "Material" },
  { value: "subcontractor", label: "Underentreprenör" },
  { value: "machinery", label: "Maskin" },
  { value: "other", label: "Övrigt" },
] as const;

const VAT_TYPE_LABELS: Record<VatType, string> = {
  STANDARD_VAT_25: "Standardmoms",
  REDUCED_VAT: "Reducerad moms",
  ZERO_RATED: "Momsfri (0 %)",
  REVERSE_CHARGE_CONSTRUCTION: "Omvänd betalningsskyldighet, bygg",
};
const VAT_TYPE_OPTIONS = VAT_TYPES.map((value) => ({
  value,
  label: VAT_TYPE_LABELS[value],
}));

const DEDUCTION_CLASSIFICATION_LABELS: Record<DeductionClassification, string> = {
  NONE: "Ingen",
  ROT_LABOR: "ROT – arbete",
  GREEN_SOLAR_LABOR: "Grön teknik – sol, arbete",
  GREEN_SOLAR_MATERIAL: "Grön teknik – sol, material",
  GREEN_STORAGE_LABOR: "Grön teknik – lagring, arbete",
  GREEN_STORAGE_MATERIAL: "Grön teknik – lagring, material",
  GREEN_CHARGING_LABOR: "Grön teknik – laddning, arbete",
  GREEN_CHARGING_MATERIAL: "Grön teknik – laddning, material",
};
const DEDUCTION_CLASSIFICATION_OPTIONS = DEDUCTION_CLASSIFICATIONS.map((value) => ({
  value,
  label: DEDUCTION_CLASSIFICATION_LABELS[value],
}));

function summaryCategoryForRowType(rowType: string): TaxSummaryCategory {
  if (rowType === "labor") return "labor";
  if (rowType === "material") return "material";
  return "other";
}

/** A hidden `false` companion + a checkbox for a row flag (turn-OFF safe). */
function FlagField({
  name,
  label,
  defaultChecked,
}: {
  readonly name: string;
  readonly label: string;
  readonly defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-800">
      {/* Companion submits `false` when the checkbox is unchecked — so a flag can be
          turned OFF on update (the parser reads the LAST value; a checked box wins). */}
      <input type="hidden" name={name} value="false" />
      <input
        type="checkbox"
        name={name}
        value="true"
        defaultChecked={defaultChecked}
        className="size-4 rounded border-zinc-300 text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      />
      {label}
    </label>
  );
}

export function RowEditor({
  sectionId,
  calculationId,
  row,
  sources,
  posture,
  onArchive,
}: {
  readonly sectionId: string;
  readonly calculationId: string;
  /** When provided the form is an UPDATE (id present); absent → a CREATE. */
  readonly row?: CalculationRowRow;
  /** The ACTIVE pricing-source lists (labor → work roles, material → articles). */
  readonly sources: RowSourceLists;
  /** The resolved VAT display posture (Story 5.4 — drives the posture-aware line-total label). */
  readonly posture: VatDisplayPosture;
  /** Render the archive/delete control for an existing row (direct — a single row). */
  readonly onArchive?: (row: CalculationRowRow) => void;
}) {
  const isUpdate = Boolean(row);
  const [state, formAction, pending] = useActionState(
    isUpdate ? updateRowAction : createRowAction,
    CALC_ACTION_INITIAL,
  );

  // Only THIS form's own row result (the target id matches an existing row, or a create).
  const mine =
    state.form === "row" &&
    (isUpdate ? state.targetId === row?.id || state.status === "error" : true);
  const v = (field: string, fallback: string): string =>
    (mine && state.values[field]) || fallback;
  const checked = (field: string, fallback: boolean): boolean =>
    v(field, String(fallback)) === "true";
  const err = (field: string): string | undefined =>
    mine ? state.fieldErrors[field] : undefined;
  const retryable = mine && isRetryableCalcError(state);

  // Row type drives WHICH source list is offered (labor → work roles, material → articles).
  const [rowType, setRowType] = useState<string>(row?.row_type ?? "labor");

  // The currently-selected source `<select>` value ("<kind>:<id>", or "" for manual). Seed
  // from the row's FROZEN captured source (if any) so an already-sourced row shows its pick.
  const initialSourceValue =
    row?.source_kind && row?.source_id
      ? encodeSourceValue(row.source_kind, row.source_id)
      : MANUAL_SOURCE_VALUE;
  const [sourceValue, setSourceValue] = useState<string>(initialSourceValue);

  // The price PREFILL value: the row's stored sell öre initially, overwritten when the admin
  // picks a source. This is ONLY the prefill seed; the echoed submitted value (below) takes
  // precedence so a validation failure PRESERVES the admin's typed input (the 5.2 contract).
  const [prefillValue, setPrefillValue] = useState<string>(
    row?.unit_sell_ore != null ? oreToKronorString(row.unit_sell_ore) : "",
  );
  // Bumped ONLY on a source pick so the uncontrolled price input remounts with the prefill
  // (a source pick re-seeds the field without locking it — it stays user-editable).
  const [priceKey, setPriceKey] = useState(0);
  // The effective price field value: the ECHOED submitted value on a failed submit (input
  // preservation) wins; otherwise the current prefill. Never inline math — just a string pick.
  const priceFieldValue = v("unit_sell_kronor", prefillValue);

  const offeredSources = useMemo(
    () => sourcesForRowType(rowType, sources),
    [rowType, sources],
  );
  const deductionClassificationOptions = DEDUCTION_CLASSIFICATION_OPTIONS.filter((option) =>
    isDeductionClassificationCompatibleWithSummaryCategory(
      option.value,
      summaryCategoryForRowType(rowType),
    ),
  );
  const echoedDeductionClassification = v(
    "deduction_classification",
    row?.deduction_classification ?? "NONE",
  );
  const deductionClassificationValue =
    isDeductionClassification(echoedDeductionClassification) &&
    isDeductionClassificationCompatibleWithSummaryCategory(
      echoedDeductionClassification,
      summaryCategoryForRowType(rowType),
    )
      ? echoedDeductionClassification
      : "NONE";

  // The decoded current source pair (null = manual).
  const selectedPair = decodeSourceValue(sourceValue);
  // The matching offered option (for the just-picked provenance) — falls back to the
  // FROZEN captured columns on an existing sourced row whose source may now be archived
  // (so it is not in the ACTIVE offered list).
  const selectedOption = selectedPair
    ? offeredSources.find((o) => o.id === selectedPair.id)
    : undefined;

  // The provenance to render: prefer the FROZEN captured columns on an existing row (AC3 —
  // explainable from the row's OWN fields, never a live re-read), else the just-picked option.
  const provenance =
    row?.source_kind && row?.source_id && sourceValue === initialSourceValue
      ? {
          name: row.source_name ?? "",
          priceOre: row.source_price_ore,
          capturedAt: row.source_captured_at,
        }
      : selectedOption
        ? { name: selectedOption.name, priceOre: selectedOption.priceOre, capturedAt: null }
        : null;

  // The source options for the current row type + a "manual / no source" default.
  const sourceSelectOptions = [
    { value: MANUAL_SOURCE_VALUE, label: "Manuell rad (ingen källa)" },
    ...offeredSources.map((o) => ({
      value: encodeSourceValue(kindForRowType(rowType) ?? "work_role", o.id),
      label: o.name,
    })),
  ];

  /** On a row-type change: switch the offered source list; a stale pick resets to manual. */
  function onRowTypeChange(value: string): void {
    setRowType(value);
    // A source picked for the old type is not valid for the new type's list → back to manual.
    if (value !== "labor" && value !== "material") {
      setSourceValue(MANUAL_SOURCE_VALUE);
    } else {
      const pair = decodeSourceValue(sourceValue);
      const stillOffered =
        pair && sourcesForRowType(value, sources).some((o) => o.id === pair.id);
      if (!stillOffered) setSourceValue(MANUAL_SOURCE_VALUE);
    }
  }

  /** On a source pick: prefill the price from the source rate (via the öre→kronor boundary). */
  function onSourceChange(value: string): void {
    setSourceValue(value);
    const pair = decodeSourceValue(value);
    if (!pair) return; // manual → keep the current (editable) price
    const opt = sourcesForRowType(rowType, sources).find((o) => o.id === pair.id);
    if (opt) {
      setPrefillValue(oreToKronorString(opt.priceOre));
      setPriceKey((k) => k + 1); // remount the price input so it re-seeds with the prefill
    }
  }

  // The hidden source fields the parser reads. A picked source submits the pair; the manual
  // option on an already-sourced row submits an explicit clear (source_clear=true) so ALL
  // source columns are cleared together (Task 2.4 — never a half-cleared source).
  const clearingExistingSource =
    isUpdate &&
    Boolean(row?.source_kind) &&
    sourceValue === MANUAL_SOURCE_VALUE;

  // The LINE TOTAL — computed by the PURE totals engine (never inline math here).
  const lineTotal = row
    ? computeLineTotal({
        quantity: row.quantity,
        unit_sell_ore: row.unit_sell_ore,
        vat_rate_bp: row.vat_rate_bp,
        vat_type: row.vat_type,
        included_in_invoice_total: row.included_in_invoice_total,
        deduction_classification: row.deduction_classification,
        is_hidden: row.is_hidden,
        is_optional: row.is_optional,
        is_selected: row.is_selected,
      })
    : null;

  // Story 5.4 (the paired 5.2 Low deferral) — the line-total qualifier is now POSTURE-AWARE.
  // For a `company_excl` posture the PRIMARY figure is NET (exkl. moms), not gross; for every
  // incl-primary posture (`private` / `company_togglable`) it stays gross (inkl. moms). Resolve
  // the primary öre + the qualifier from the engine's `selectVatDisplay` (via `resolveTotalDisplay`)
  // so the label never contradicts a resolved `company_excl` tenant. Cosmetic — corrupts no stored öre.
  const lineDisplay =
    lineTotal && lineTotal.ok ? resolveTotalDisplay(lineTotal.value, posture) : null;

  return (
    <form
      action={formAction}
      data-testid={isUpdate ? "row-edit-form" : "row-create-form"}
      className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3"
      noValidate
    >
      {/* Hidden routing fields so the action can target the section + revalidate the calc. */}
      {isUpdate && <input type="hidden" name="id" value={row!.id} />}
      {!isUpdate && <input type="hidden" name="section_id" value={sectionId} />}
      <input type="hidden" name="calculation_id" value={calculationId} />

      <FormErrorSummary message={mine ? state.formError : null} />
      {mine && state.status === "success" && (
        <p role="status" data-testid="row-saved" className="text-sm text-green-800">
          Raden har sparats.
        </p>
      )}
      {retryable && (
        <p role="status" className="text-sm text-amber-800">
          Ett tillfälligt fel inträffade. Försök igen.
        </p>
      )}

      {/* Hidden source fields the form parser reads (Story 5.3). Driven by the client
          source `<select>` state so the server RE-RESOLVES the pair (name/rate never
          trusted from the client). A cleared source on an existing row submits an
          explicit `source_clear` so ALL source columns clear together (Task 2.4). */}
      {selectedPair && (
        <>
          <input type="hidden" name="source_kind" value={selectedPair.kind} />
          <input type="hidden" name="source_id" value={selectedPair.id} />
        </>
      )}
      {clearingExistingSource && (
        <input type="hidden" name="source_clear" value="true" />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          name="row_type"
          label="Radtyp"
          required
          defaultValue={v("row_type", row?.row_type ?? "labor")}
          error={err("row_type")}
          options={[...ROW_TYPE_OPTIONS]}
          onChange={onRowTypeChange}
        />
        <TextField
          name="quantity"
          label="Antal"
          required
          defaultValue={v("quantity", row ? String(row.quantity) : "")}
          error={err("quantity")}
        />
        <TextField
          name="unit"
          label="Enhet"
          required
          defaultValue={v("unit", row?.unit ?? "")}
          error={err("unit")}
        />
        <TextField
          name="unit_cost_kronor"
          label="Kostnad (kr)"
          defaultValue={v(
            "unit_cost_kronor",
            row?.unit_cost_ore != null ? oreToKronorString(row.unit_cost_ore) : "",
          )}
          error={err("unit_cost_kronor")}
        />
        <TextField
          key={`price-${priceKey}`}
          name="unit_sell_kronor"
          label="Pris (kr)"
          defaultValue={priceFieldValue}
          error={err("unit_sell_kronor")}
        />
        <TextField
          name="markup_percent"
          label="Påslag (%)"
          defaultValue={v(
            "markup_percent",
            row?.markup_bp != null ? markupBpToPercentString(row.markup_bp) : "",
          )}
          error={err("markup_percent")}
        />
        <TextField
          name="vat_percent"
          label="Moms (%)"
          required
          defaultValue={v(
            "vat_percent",
            row?.vat_rate_bp != null ? bpToPercentString(row.vat_rate_bp) : "25",
          )}
          error={err("vat_percent")}
        />
        <SelectField
          name="vat_type"
          label="Momstyp"
          defaultValue={v("vat_type", row?.vat_type ?? "STANDARD_VAT_25")}
          error={err("vat_type")}
          options={[...VAT_TYPE_OPTIONS]}
        />
        <SelectField
          key={`deduction-classification-${rowType}`}
          name="deduction_classification"
          label="Avdragsklassificering"
          defaultValue={deductionClassificationValue}
          error={err("deduction_classification")}
          options={deductionClassificationOptions}
        />
      </div>

      {/* Pricing-source selection (Story 5.3, AC1/AC2/AC6). Offered for labor (work roles)
          and material (articles); "manual / no source" is always available + the default.
          Picking a source prefills the price above; the provenance line explains where the
          price came from (read from the row's FROZEN captured columns, never a live re-read).
          Swedish labels only — NO öre/supplier/import jargon. */}
      {(rowType === "labor" || rowType === "material") && (
        <div className="flex flex-col gap-2">
          <SelectField
            key={`source-${rowType}`}
            name="row_source_ref"
            testId="row-source-select"
            label={rowType === "labor" ? "Prislista (arbetsroll)" : "Prislista (artikel)"}
            defaultValue={sourceValue}
            options={sourceSelectOptions}
            onChange={onSourceChange}
          />
          {provenance && provenance.name && (
            <p
              data-testid="row-source-provenance"
              className="text-xs text-zinc-600"
            >
              Källa: <span className="font-medium">{provenance.name}</span>
              {provenance.priceOre != null && (
                <> · {oreToKronorString(provenance.priceOre)} kr</>
              )}
              {provenance.capturedAt && (
                <> · v. {provenance.capturedAt.slice(0, 10)}</>
              )}
            </p>
          )}
        </div>
      )}

      <fieldset className="flex flex-wrap gap-4">
        <legend className="sr-only">Synlighet, fakturainkludering och tillval</legend>
        <FlagField name="is_hidden" label="Dold rad" defaultChecked={checked("is_hidden", row?.is_hidden ?? false)} />
        <FlagField
          name="included_in_invoice_total"
          label="Ingår i fakturasumman"
          defaultChecked={checked("included_in_invoice_total", row?.included_in_invoice_total ?? true)}
        />
        <FlagField
          name="is_optional"
          label="Tillval (valfri)"
          defaultChecked={checked("is_optional", row?.is_optional ?? false)}
        />
        <FlagField
          name="is_selected"
          label="Vald (tillval)"
          defaultChecked={checked("is_selected", row?.is_selected ?? false)}
        />
      </fieldset>

      <TextField
        name="label"
        label="Etikett (visas i offert)"
        defaultValue={v("label", row?.label ?? "")}
        error={err("label")}
      />
      <TextField
        name="description"
        label="Beskrivning (visas i offert)"
        defaultValue={v("description", row?.description ?? "")}
        error={err("description")}
      />
      <TextField
        name="internal_note"
        label="Intern notering"
        defaultValue={v("internal_note", row?.internal_note ?? "")}
        error={err("internal_note")}
      />
      <TextField
        name="quote_note"
        label="Notering i offert"
        defaultValue={v("quote_note", row?.quote_note ?? "")}
        error={err("quote_note")}
      />

      {lineTotal && lineTotal.ok && lineDisplay && (
        <p className="text-sm text-zinc-700">
          Radsumma:{" "}
          <span data-testid="row-line-total" className="font-medium">
            {oreToKronorString(lineDisplay.primaryOre)} kr
          </span>{" "}
          <span data-testid="row-line-total-qualifier" className="text-xs text-zinc-500">
            {posture === "company_excl" ? "(exkl. moms)" : "(inkl. moms)"}
          </span>
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
        >
          {pending ? "Sparar…" : isUpdate ? "Spara rad" : "Lägg till rad"}
        </button>
        {isUpdate && onArchive && (
          <button
            type="button"
            data-testid="row-delete"
            onClick={() => onArchive(row!)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Ta bort rad
          </button>
        )}
      </div>
    </form>
  );
}
