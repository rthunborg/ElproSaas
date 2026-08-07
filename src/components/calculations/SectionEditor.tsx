"use client";

/**
 * Section editor (Story 5.2, Task 4.2/4.3 / AC2) — one section: rename, reorder (move
 * up/down via the atomic reorder command), add rows, edit/delete rows, and the destructive
 * archive-with-confirmation when the section still has rows.
 *
 * DESTRUCTIVE CONFIRM (AC2/Task 4.3): archiving a section that still has rows (rows would be
 * removed) requires an explicit confirmation step before the archive command fires; a single
 * row may be deleted directly. Ordering is SERVER-owned: move-up/down computes the new
 * ordered-id array (pure `ordering.ts`) and sends it to `reorderRows` (R-503) — never a
 * client loop of single UPDATEs.
 */
import { useActionState, useState } from "react";
import { FormErrorSummary, SelectField, TextField } from "@/components/crm/FormField";
import { RowEditor } from "./RowEditor";
import {
  archiveRowAction,
  archiveSectionAction,
  reorderRowsAction,
  updateSectionAction,
} from "@/features/calculations/actions";
import {
  CALC_ACTION_INITIAL,
  isRetryableCalcError,
} from "@/features/calculations/action-state";
import { moveDown, moveUp, toOrderedIds } from "@/features/calculations/ordering";
import { computeSectionTotal } from "@/features/calculations/totals";
import { oreToKronorString } from "@/features/calculations/money-input";
import type {
  CalculationRowRow,
  CalculationSectionRow,
} from "@/features/calculations/read";
import type { RowSourceLists } from "@/features/calculations/source-options";
import type { VatDisplayPosture } from "@/lib/money";

const DISPLAY_MODE_OPTIONS = [
  { value: "detailed", label: "Detaljerad" },
  { value: "summary", label: "Sammanfattad" },
  { value: "text_only", label: "Endast text" },
] as const;

export function SectionEditor({
  section,
  calculationId,
  sources,
  posture,
  canAddRow,
}: {
  readonly section: CalculationSectionRow;
  readonly calculationId: string;
  /** The ACTIVE pricing-source lists for the row-editor selection affordance (Story 5.3). */
  readonly sources: RowSourceLists;
  /** The resolved VAT display posture (Story 5.4 — drives the posture-aware line-total label). */
  readonly posture: VatDisplayPosture;
  /** Whole-calculation row cap; the server and DB independently enforce the same invariant. */
  readonly canAddRow: boolean;
}) {
  const [renameState, renameAction, renamePending] = useActionState(
    updateSectionAction,
    CALC_ACTION_INITIAL,
  );
  const [archiveState, archiveAction] = useActionState(
    archiveSectionAction,
    CALC_ACTION_INITIAL,
  );
  const [reorderState, reorderAction] = useActionState(
    reorderRowsAction,
    CALC_ACTION_INITIAL,
  );
  const [rowArchiveState, rowArchiveAction] = useActionState(
    archiveRowAction,
    CALC_ACTION_INITIAL,
  );
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [showAddRow, setShowAddRow] = useState(false);

  const hasRows = section.rows.length > 0;

  const renameMine = renameState.form === "section";
  const rv = (field: string, fallback: string): string =>
    (renameMine && renameState.values[field]) || fallback;
  const rerr = (field: string): string | undefined =>
    renameMine ? renameState.fieldErrors[field] : undefined;

  const lifecycleError =
    (archiveState.status === "error" && archiveState.formError) ||
    (reorderState.status === "error" && reorderState.formError) ||
    (rowArchiveState.status === "error" && rowArchiveState.formError) ||
    null;
  const lifecycleRetryable =
    isRetryableCalcError(archiveState) ||
    isRetryableCalcError(reorderState) ||
    isRetryableCalcError(rowArchiveState);

  const sectionTotal = computeSectionTotal(
    section.rows.map((r) => ({
      quantity: r.quantity,
      unit_sell_ore: r.unit_sell_ore,
      vat_rate_bp: r.vat_rate_bp,
      is_hidden: r.is_hidden,
      is_optional: r.is_optional,
      is_selected: r.is_selected,
    })),
  );

  const orderedIds = toOrderedIds(section.rows as CalculationRowRow[]);

  return (
    <section
      data-testid="section-editor"
      aria-label={section.title ?? "Namnlös sektion"}
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4"
    >
      <h2 data-testid="section-title" className="text-base font-semibold text-zinc-900">
        {section.title ?? "Namnlös sektion"}
      </h2>

      {lifecycleError && (
        <p
          role="alert"
          data-testid="section-lifecycle-error"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {lifecycleError}
          {lifecycleRetryable ? " Försök igen." : ""}
        </p>
      )}

      {/* Rename / display-mode form. */}
      <form action={renameAction} className="flex flex-col gap-3" noValidate>
        <input type="hidden" name="id" value={section.id} />
        <input type="hidden" name="calculation_id" value={calculationId} />
        <FormErrorSummary message={renameMine ? renameState.formError : null} />
        {renameMine && renameState.status === "success" && (
          <p role="status" className="text-sm text-green-800">
            Sektionen har sparats.
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            name="title"
            label="Sektionstitel"
            defaultValue={rv("title", section.title ?? "")}
            error={rerr("title")}
          />
          <SelectField
            name="display_mode"
            label="Visningsläge"
            defaultValue={rv("display_mode", section.display_mode)}
            error={rerr("display_mode")}
            options={[...DISPLAY_MODE_OPTIONS]}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={renamePending}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
          >
            Spara sektion
          </button>
        </div>
      </form>

      {/* Rows. */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-zinc-700">Rader</h3>
        {!hasRows ? (
          <p className="text-sm text-zinc-600">Inga rader ännu i den här sektionen.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {section.rows.map((row, index) => (
              <li key={row.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <form action={reorderAction}>
                    <input type="hidden" name="section_id" value={section.id} />
                    <input type="hidden" name="calculation_id" value={calculationId} />
                    <input
                      type="hidden"
                      name="ordered_row_ids"
                      value={moveUp(orderedIds, index).join(",")}
                    />
                    <button
                      type="submit"
                      aria-label="Flytta upp"
                      data-testid="row-move-up"
                      disabled={index === 0}
                      className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      ↑
                    </button>
                  </form>
                  <form action={reorderAction}>
                    <input type="hidden" name="section_id" value={section.id} />
                    <input type="hidden" name="calculation_id" value={calculationId} />
                    <input
                      type="hidden"
                      name="ordered_row_ids"
                      value={moveDown(orderedIds, index).join(",")}
                    />
                    <button
                      type="submit"
                      aria-label="Flytta ned"
                      data-testid="row-move-down"
                      disabled={index === section.rows.length - 1}
                      className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      ↓
                    </button>
                  </form>
                </div>
                <RowEditor
                  sectionId={section.id}
                  calculationId={calculationId}
                  row={row}
                  sources={sources}
                  posture={posture}
                  onArchive={(r) => {
                    const fd = new FormData();
                    fd.set("id", r.id);
                    fd.set("calculation_id", calculationId);
                    rowArchiveAction(fd);
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        {sectionTotal.ok && (
          <p className="text-sm text-zinc-700">
            Sektionssumma:{" "}
            <span data-testid="section-total" className="font-medium">
              {oreToKronorString(sectionTotal.value.grossOre)} kr
            </span>
          </p>
        )}

        {showAddRow && canAddRow ? (
          <RowEditor
            sectionId={section.id}
            calculationId={calculationId}
            sources={sources}
            posture={posture}
          />
        ) : (
          <button
            type="button"
            data-testid="add-row"
            disabled={!canAddRow}
            onClick={() => setShowAddRow(true)}
            className="self-start rounded-md border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Lägg till rad
          </button>
        )}
      </div>

      {/* Destructive archive — CONFIRMATION required when rows would be removed. */}
      <div className="flex items-center justify-end gap-2 border-t border-zinc-200 pt-3">
        {!confirmArchive ? (
          <button
            type="button"
            data-testid="archive-section"
            onClick={() => {
              if (hasRows) {
                setConfirmArchive(true);
              } else {
                const fd = new FormData();
                fd.set("id", section.id);
                fd.set("calculation_id", calculationId);
                archiveAction(fd);
              }
            }}
            className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            Ta bort sektion
          </button>
        ) : (
          <div
            data-testid="archive-section-confirm"
            role="alertdialog"
            aria-label="Bekräfta borttagning"
            className="flex flex-col gap-2 rounded-md border border-red-300 bg-red-50 p-3"
          >
            <p className="text-sm text-red-800">
              Sektionen innehåller {section.rows.length} rad
              {section.rows.length === 1 ? "" : "er"} som tas bort. Vill du fortsätta?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                data-testid="archive-section-cancel"
                onClick={() => setConfirmArchive(false)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                Avbryt
              </button>
              <button
                type="button"
                data-testid="archive-section-confirm-button"
                onClick={() => {
                  const fd = new FormData();
                  fd.set("id", section.id);
                  fd.set("calculation_id", calculationId);
                  archiveAction(fd);
                  setConfirmArchive(false);
                }}
                className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              >
                Ta bort
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
