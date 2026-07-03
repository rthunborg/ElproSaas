"use client";

/**
 * Calculation editor island (Story 5.2, Task 4.2 / AC1-AC6) — the heart of this story.
 *
 * Desktop layout (UX §5): a record header (title + status), a customer-context block, a
 * section/row workspace, and a persistent totals/readiness summary panel on the right. On a
 * narrow viewport the summary becomes an INLINE block BELOW the editor and controls stack
 * without overlap (responsive via Tailwind `lg:` breakpoints — NO horizontal-precision
 * dragging for core work).
 *
 * Every displayed total comes from the pure `totals.ts` (engine-backed) — NEVER inline math
 * in this island. Section/row create/edit/archive/reorder wire to the Task 3 server actions
 * via `useActionState` on the child forms. NO deferred-workflow label/control, NO pricing-
 * source selection UI (5.3), NO readiness classifier (5.4) — only the section/VAT/gross
 * totals summary. Kronor/percent at the input boundary; öre/rounding wording only in the
 * totals summary (AC6).
 */
import { useActionState, useState } from "react";
import Link from "next/link";
import { FormErrorSummary, TextField } from "@/components/crm/FormField";
import { SectionEditor } from "./SectionEditor";
import { TotalsSummary } from "./TotalsSummary";
import {
  archiveCalculationAction,
  createSectionAction,
  updateCalculationAction,
} from "@/features/calculations/actions";
import {
  CALC_ACTION_INITIAL,
  isRetryableCalcError,
} from "@/features/calculations/action-state";
import {
  computeCalcTotal,
  resolveTotalDisplay,
} from "@/features/calculations/totals";
import type { CalculationDetail } from "@/features/calculations/read";
import type { VatDisplayPosture } from "@/lib/money";

const STATUS_LABELS: Record<string, string> = {
  draft: "Utkast",
  ready: "Klar",
  archived: "Arkiverad",
};

export function CalculationEditor({
  detail,
}: {
  readonly detail: CalculationDetail;
}) {
  const { header, sections, customer } = detail;

  const [titleState, titleAction, titlePending] = useActionState(
    updateCalculationAction,
    CALC_ACTION_INITIAL,
  );
  const [sectionState, sectionAction, sectionPending] = useActionState(
    createSectionAction,
    CALC_ACTION_INITIAL,
  );
  const [archiveState, archiveAction] = useActionState(
    archiveCalculationAction,
    CALC_ACTION_INITIAL,
  );
  const [showAddSection, setShowAddSection] = useState(false);

  const titleMine = titleState.form === "calculation";

  // The whole-calc total, computed by the PURE totals engine (never inline math). The
  // display posture defaults to the togglable company view; a private-customer posture
  // forces incl-VAT. The customer type drives it (private → always incl).
  const posture: VatDisplayPosture =
    customer.customer_type === "private" ? "private" : "company_togglable";
  const calcTotal = computeCalcTotal(
    sections.map((s) => ({
      rows: s.rows.map((r) => ({
        quantity: r.quantity,
        unit_sell_ore: r.unit_sell_ore,
        vat_rate_bp: r.vat_rate_bp,
        is_hidden: r.is_hidden,
        is_optional: r.is_optional,
        is_selected: r.is_selected,
      })),
    })),
  );
  const total = calcTotal.ok
    ? calcTotal.value
    : { netOre: 0, vatOre: 0, grossOre: 0 };
  const view = resolveTotalDisplay(total, posture);

  return (
    <div data-testid="calculation-editor" className="flex flex-col gap-6 p-6">
      <Link
        href="/calculations"
        className="text-sm text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        ← Kalkyler
      </Link>

      {/* Record header (title + status) + customer context. */}
      <header
        data-testid="calculation-header"
        className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-zinc-900">{header.title}</h1>
          <span
            data-testid="calculation-status"
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700"
          >
            {STATUS_LABELS[header.status] ?? header.status}
          </span>
        </div>

        <dl
          data-testid="customer-context"
          className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3"
        >
          <div>
            <dt className="text-zinc-500">Kund</dt>
            <dd className="font-medium text-zinc-900">
              {customer.customer_display_name ?? "—"}
            </dd>
          </div>
          {customer.facility_name && (
            <div>
              <dt className="text-zinc-500">Anläggning</dt>
              <dd className="font-medium text-zinc-900">{customer.facility_name}</dd>
            </div>
          )}
          {customer.contact_name && (
            <div>
              <dt className="text-zinc-500">Kontakt</dt>
              <dd className="font-medium text-zinc-900">{customer.contact_name}</dd>
            </div>
          )}
        </dl>

        {/* Rename the calc + change status. */}
        <form action={titleAction} className="flex flex-col gap-3" noValidate>
          <input type="hidden" name="id" value={header.id} />
          <FormErrorSummary message={titleMine ? titleState.formError : null} />
          {titleMine && titleState.status === "success" && (
            <p role="status" className="text-sm text-green-800">
              Kalkylen har sparats.
            </p>
          )}
          {titleMine && isRetryableCalcError(titleState) && (
            <p role="status" className="text-sm text-amber-800">
              Ett tillfälligt fel inträffade. Försök igen.
            </p>
          )}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <TextField
                name="title"
                label="Titel"
                defaultValue={
                  (titleMine && titleState.values.title) || header.title
                }
                error={titleMine ? titleState.fieldErrors.title : undefined}
              />
            </div>
            <button
              type="submit"
              disabled={titlePending}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
            >
              Spara titel
            </button>
          </div>
        </form>
      </header>

      {/* Workspace: sections (left/center) + totals summary (right on desktop). */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex flex-1 flex-col gap-4">
          {sections.length === 0 ? (
            <p data-testid="sections-empty" className="text-sm text-zinc-600">
              Inga sektioner ännu. Lägg till din första sektion nedan.
            </p>
          ) : (
            sections.map((section) => (
              <SectionEditor
                key={section.id}
                section={section}
                calculationId={header.id}
              />
            ))
          )}

          {showAddSection ? (
            <form
              action={sectionAction}
              data-testid="add-section-form"
              className="flex max-w-xl flex-col gap-3 rounded-lg border border-dashed border-zinc-300 bg-white p-4"
              noValidate
            >
              <input type="hidden" name="calculation_id" value={header.id} />
              <FormErrorSummary
                message={sectionState.form === "section" ? sectionState.formError : null}
              />
              <TextField
                name="title"
                label="Sektionstitel (valfritt)"
                defaultValue={
                  (sectionState.form === "section" && sectionState.values.title) || ""
                }
                error={
                  sectionState.form === "section"
                    ? sectionState.fieldErrors.title
                    : undefined
                }
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={sectionPending}
                  className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
                >
                  {sectionPending ? "Skapar…" : "Skapa sektion"}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              data-testid="add-section"
              onClick={() => setShowAddSection(true)}
              className="self-start rounded-md border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Lägg till sektion
            </button>
          )}
        </div>

        {/* Desktop: sticky right-hand summary panel. */}
        <div className="hidden w-80 shrink-0 lg:block">
          <TotalsSummary total={total} view={view} />
        </div>
      </div>

      {/* Narrow viewport: the summary becomes an inline block BELOW the editor. */}
      <div className="lg:hidden">
        <TotalsSummary total={total} view={view} inline />
      </div>

      {/* Archive the whole calculation (soft-archive via the command). */}
      <div className="flex justify-end border-t border-zinc-200 pt-4">
        <form action={archiveAction}>
          <input type="hidden" name="id" value={header.id} />
          <button
            type="submit"
            data-testid="archive-calculation"
            className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            Arkivera kalkyl
          </button>
        </form>
        {archiveState.status === "error" && (
          <p role="alert" className="ml-3 self-center text-sm text-red-700">
            {archiveState.formError}
          </p>
        )}
      </div>
    </div>
  );
}
