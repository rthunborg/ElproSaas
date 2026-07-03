"use client";

/**
 * Row editor (Story 5.2, Task 4.4 / AC3) — the per-row form exposing the five row types and
 * the fields quantity, unit, unit cost (kr), unit sell (kr), markup (%), VAT (%), the
 * visibility/option flags (hidden/optional/selected), quote-visible label + description,
 * internal note, quote note — EACH mapping 1:1 to `CreateRowInput`/`UpdateRowInput`.
 *
 * Money at the input boundary is KRONOR/percent (Swedish comma), converted to öre/bp by the
 * form parser; the LINE TOTAL is rendered from the pure `totals.ts` (never inline math). NO
 * "öre"/"basis points" jargon in the row editor (AC6); NO supplier/source control (source-
 * based pricing is Story 5.3 — rows are MANUAL here).
 *
 * FLAG-OFF FIX (epic-3 trap): each flag renders a hidden `false` companion BEFORE its
 * checkbox so an unchecked box submits an EXPLICIT `false` (a flag can always be turned OFF).
 *
 * Validation errors PRESERVE unsaved input (the parent echoes `values` back via the action
 * state), and are field-associated (aria-invalid/aria-describedby). Fields are keyboard-
 * editable and the form submits via its own action.
 */
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
import { computeLineTotal } from "@/features/calculations/totals";
import type { CalculationRowRow } from "@/features/calculations/read";

const ROW_TYPE_OPTIONS = [
  { value: "labor", label: "Arbete" },
  { value: "material", label: "Material" },
  { value: "subcontractor", label: "Underentreprenör" },
  { value: "machinery", label: "Maskin" },
  { value: "other", label: "Övrigt" },
] as const;

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
  onArchive,
}: {
  readonly sectionId: string;
  readonly calculationId: string;
  /** When provided the form is an UPDATE (id present); absent → a CREATE. */
  readonly row?: CalculationRowRow;
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
  const err = (field: string): string | undefined =>
    mine ? state.fieldErrors[field] : undefined;
  const retryable = mine && isRetryableCalcError(state);

  // The LINE TOTAL — computed by the PURE totals engine (never inline math here).
  const lineTotal = row
    ? computeLineTotal({
        quantity: row.quantity,
        unit_sell_ore: row.unit_sell_ore,
        vat_rate_bp: row.vat_rate_bp,
        is_hidden: row.is_hidden,
        is_optional: row.is_optional,
        is_selected: row.is_selected,
      })
    : null;

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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          name="row_type"
          label="Radtyp"
          required
          defaultValue={v("row_type", row?.row_type ?? "labor")}
          error={err("row_type")}
          options={[...ROW_TYPE_OPTIONS]}
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
          name="unit_sell_kronor"
          label="Pris (kr)"
          defaultValue={v(
            "unit_sell_kronor",
            row?.unit_sell_ore != null ? oreToKronorString(row.unit_sell_ore) : "",
          )}
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
      </div>

      <fieldset className="flex flex-wrap gap-4">
        <legend className="sr-only">Synlighet och tillval</legend>
        <FlagField name="is_hidden" label="Dold rad" defaultChecked={row?.is_hidden ?? false} />
        <FlagField
          name="is_optional"
          label="Tillval (valfri)"
          defaultChecked={row?.is_optional ?? false}
        />
        <FlagField
          name="is_selected"
          label="Vald (tillval)"
          defaultChecked={row?.is_selected ?? false}
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

      {lineTotal && lineTotal.ok && (
        <p className="text-sm text-zinc-700">
          Radsumma:{" "}
          <span data-testid="row-line-total" className="font-medium">
            {oreToKronorString(lineTotal.value.grossOre)} kr
          </span>{" "}
          <span className="text-xs text-zinc-500">(inkl. moms)</span>
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
