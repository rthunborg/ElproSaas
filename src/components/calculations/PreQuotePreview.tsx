"use client";

/**
 * Pre-quote snapshot PREVIEW + the gated create-quote affordance + the new-version-after-send
 * message (Story 5.4, Task 3.2 / 3.3 — AC2 / AC3).
 *
 * This is the gated preview/confirmation surface. The first affordance opens the reconciled
 * preview; the explicit confirmation submits through Epic 6's shared create-version command.
 * Both remain disabled by the centralized readiness blockers.
 *
 * The preview shows the AC2 content: customer/facility/contact, sections (respecting each
 * `display_mode`: detailed / summary / text_only), VISIBLE vs HIDDEN row handling, options/tillval
 * (selected vs unselected), totals (net/VAT/gross from `totals.ts` via the resolved posture), VAT
 * display (the resolved posture), tax assumptions (unapproved + sign-off framing — from the warnings
 * captured at snapshot time), terms (from the tenant quote-terms read), selected attachments (a
 * DOCUMENTED deferral — Story 8.1/8.2 file foundation has not landed, R-513), and the WARNINGS
 * captured at snapshot time. It is a faithful, non-lossy view of the calc so Epic 6 can freeze it
 * forward (the preview shape aligns with Epic 6's quote-version snapshot).
 *
 * [Source: epics.md#Story 5.4 AC2/AC3 + Technical Notes (prepares inputs, does not create versions);
 *  test-design-epic-5.md#5.4-E2E-01/02/03, R-513/R-514; ux-design-specification.md#Calculation
 *  readiness review (pre-quote checkpoint) + #Readiness and safety; src/features/calculations/
 *  totals.ts]
 */
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { oreToKronorString } from "@/features/calculations/money-input";
import type { ReadinessReport } from "@/features/calculations/readiness";
import type { CalculationDetail } from "@/features/calculations/read";
import type { SectionTotal } from "@/features/calculations/totals";
import type { VatDisplayView } from "@/lib/money";
import type { TaxAnswerSnapshotV2 } from "@/lib/money";
import { createQuoteVersionFromCalculationAction } from "@/features/quotes/actions";
import {
  CREATE_QUOTE_ACTION_INITIAL,
  isRetryableCreateQuoteError,
} from "@/features/quotes/create-quote-action-state";

/** The tenant quote-terms slice the preview surfaces (never any approval enforcement — Epic 6). */
export interface PreQuoteTerms {
  readonly termsText: string;
  readonly approved: boolean;
}

const SECTION_MODE_LABELS: Record<string, string> = {
  detailed: "detaljerad",
  summary: "sammanfattning",
  text_only: "endast text",
};

const ROW_TYPE_LABELS: Record<string, string> = {
  labor: "Arbete",
  material: "Material",
  subcontractor: "Underentreprenör",
  machinery: "Maskin",
  other: "Övrigt",
};

export function PreQuotePreview({
  detail,
  report,
  total,
  view,
  quoteTerms,
  taxAnswer,
}: {
  readonly detail: CalculationDetail;
  readonly report: ReadinessReport;
  /** The whole-calc total (present only when the engine resolved it OK). */
  readonly total: SectionTotal | null;
  /** The resolved display view (present only when the total resolved OK). */
  readonly view: VatDisplayView | null;
  /** The tenant's quote-terms (or null when none/unread — the preview shows the not-approved note). */
  readonly quoteTerms: PreQuoteTerms | null;
  /** Canonical reconciled preview; null exactly when readiness carries a tax blocker. */
  readonly taxAnswer: TaxAnswerSnapshotV2 | null;
}) {
  const { customer, sections } = detail;
  const [open, setOpen] = useState(false);
  const [reviewedRevision, setReviewedRevision] = useState<string | null>(null);
  const router = useRouter();
  const [createState, createAction, createPending] = useActionState(
    createQuoteVersionFromCalculationAction,
    CREATE_QUOTE_ACTION_INITIAL,
  );
  useEffect(() => {
    if (
      createState.status === "success" &&
      createState.quoteId &&
      createState.targetId
    ) {
      router.push(`/quotes/${createState.quoteId}/versions/${createState.targetId}`);
    }
  }, [createState.status, createState.quoteId, createState.targetId, router]);
  const previewStale = reviewedRevision !== null && reviewedRevision !== detail.header.updated_at;
  const gated = !report.canCreateQuote || taxAnswer === null;
  const confirmationDisabled =
    gated ||
    previewStale ||
    createPending ||
    createState.status === "success";
  // Compute the tax sign-off warning ONCE and branch on truthiness (never a `.some(...)` +
  // `.find(...)!` double-scan whose non-null assertion would crash the whole preview if the two
  // predicate strings ever drifted).
  const taxSignOffWarning = report.warnings.find(
    (w) => w.code === "TAX_SIGN_OFF_REQUIRED",
  );

  const vatPostureLabel =
    view === null
      ? "kunde inte fastställas"
      : view.posture === "company_excl"
        ? "exkl. moms"
        : view.togglable
          ? "kan visas in-/exkl. moms"
          : "inkl. moms";

  return (
    <section
      data-testid="pre-quote"
      aria-label="Skapa offertversion"
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-zinc-900">Skapa offert</h2>

      {/* AC3 — the "a new version is required after send" forward-seam message. Rendered where
          the create-quote affordance lives; a PRESENT static explanatory affordance (Epic 6 owns
          the actual sent-state detection + immutability enforcement). Owner-pending final copy. */}
      <p
        role="note"
        data-testid="new-version-after-send-message"
        className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900"
      >
        Obs: När en offert har skickats till kund kräver ändringar som påverkar det kunden ser en
        NY offertversion — den skickade versionen ändras inte. (Preliminär text; hanteras när
        offertversioner införs.)
      </p>

      {gated ? (
        <p
          role="status"
          data-testid="create-quote-gated-note"
          className="text-sm text-red-800"
        >
          Åtgärda de blockerande problemen ovan innan du kan skapa en offertversion.
        </p>
      ) : null}

      <button
        type="button"
        data-testid="create-quote"
        disabled={gated}
        aria-disabled={gated ? "true" : "false"}
        onClick={() => {
          setReviewedRevision(detail.header.updated_at);
          setOpen((v) => !v);
        }}
        className="self-start rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {open ? "Dölj förhandsvisning" : "Skapa offertversion"}
      </button>

      {open && !gated && (
        <div
          data-testid="pre-quote-preview"
          className="flex flex-col gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-4"
        >
          {/* Customer / facility / contact. */}
          <div data-testid="preview-customer" className="text-sm">
            <h3 className="font-semibold text-zinc-900">Kund</h3>
            <p className="text-zinc-800">{customer.customer_display_name ?? "—"}</p>
            <p className="text-zinc-600">
              Anläggning: {customer.facility_name ?? "—"} · Kontakt:{" "}
              {customer.contact_name ?? "—"}
            </p>
          </div>

          {/* Sections — respecting each display_mode; visible vs hidden + options/tillval. */}
          <div data-testid="preview-sections" className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-zinc-900">Sektioner</h3>
            {sections.length === 0 ? (
              <p className="text-sm text-zinc-600">Inga sektioner.</p>
            ) : (
              sections.map((section) => (
                <div
                  key={section.id}
                  data-testid="preview-section"
                  data-display-mode={section.display_mode}
                  className="rounded border border-zinc-200 bg-white p-3 text-sm"
                >
                  <p className="font-medium text-zinc-900">
                    {section.title ?? "(namnlös sektion)"}{" "}
                    <span className="text-xs font-normal text-zinc-500">
                      ({SECTION_MODE_LABELS[section.display_mode] ?? section.display_mode})
                    </span>
                  </p>
                  {section.display_mode === "text_only" ? (
                    <p className="text-zinc-600">Endast text — rader visas inte i offerten.</p>
                  ) : section.display_mode === "summary" ? (
                    <p className="text-zinc-600">
                      Sammanfattning — raderna summeras utan radvis specifikation.
                    </p>
                  ) : (
                    <ul className="mt-1 flex flex-col gap-1">
                      {section.rows.map((row) => {
                        const unselectedOption = row.is_optional && row.is_selected !== true;
                        return (
                          <li
                            key={row.id}
                            data-testid="preview-row"
                            data-hidden={row.is_hidden ? "true" : "false"}
                            data-optional={row.is_optional ? "true" : "false"}
                            data-selected={row.is_selected === true ? "true" : "false"}
                            className="flex items-center justify-between gap-2 text-zinc-700"
                          >
                            <span>
                              {ROW_TYPE_LABELS[row.row_type] ?? row.row_type}
                              {row.label ? ` · ${row.label}` : ""}
                              {row.is_hidden ? (
                                <span
                                  data-testid="preview-row-hidden-badge"
                                  className="ml-2 rounded bg-zinc-200 px-1 text-xs text-zinc-700"
                                >
                                  dold (räknas med)
                                </span>
                              ) : null}
                              {row.is_optional ? (
                                <span
                                  data-testid="preview-row-option-badge"
                                  className="ml-2 rounded bg-zinc-200 px-1 text-xs text-zinc-700"
                                >
                                  tillval ({unselectedOption ? "ej vald" : "vald"})
                                </span>
                              ) : null}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Totals + VAT display (from totals.ts / the resolved posture). Which figure is the
              PRIMARY (emphasized) one mirrors the resolved posture — the same posture-aware
              treatment shipped for the per-row line-total label (Task 2.3, RowEditor): a resolved
              `company_excl` tenant foregrounds NET (exkl. moms); every other posture (private /
              company_togglable) foregrounds GROSS (inkl. moms). All three engine-derived amounts
              stay visible so the preview never drops a figure — only the emphasis follows posture,
              so a `company_excl` preview stops contradicting the resolved posture. */}
          {(() => {
            const netPrimary = view?.posture === "company_excl";
            const netEmphasis = netPrimary ? "flex justify-between font-semibold" : "flex justify-between";
            const netDt = netPrimary ? "text-zinc-900" : "text-zinc-600";
            const grossEmphasis = netPrimary ? "flex justify-between" : "flex justify-between font-semibold";
            const grossDt = netPrimary ? "text-zinc-600" : "text-zinc-900";
            return (
          <div data-testid="preview-totals" className="text-sm">
            <h3 className="font-semibold text-zinc-900">Summering</h3>
            {total && taxAnswer ? (
              <dl className="flex flex-col gap-1">
                {(["labor", "material", "other"] as const).map((summaryKey) => {
                  const summary = taxAnswer.summaries[summaryKey];
                  const label = summaryKey === "labor"
                    ? "Arbete"
                    : summaryKey === "material"
                      ? "Material"
                      : "Övrigt";
                  return (
                    <div key={summaryKey} className="flex justify-between gap-3">
                      <dt className="text-zinc-600">{label}</dt>
                      <dd data-testid={`preview-summary-${summaryKey}`} className="text-right">
                        {oreToKronorString(summary.netOre)} + {oreToKronorString(summary.vatOre)} moms
                        = {oreToKronorString(summary.grossOre)} kr
                      </dd>
                    </div>
                  );
                })}
                <div className={netEmphasis}>
                  <dt className={netDt}>Netto (exkl. moms)</dt>
                  <dd data-testid="preview-net">{oreToKronorString(taxAnswer.netOre)} kr</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-600">Moms</dt>
                  <dd data-testid="preview-vat">{oreToKronorString(taxAnswer.vatOre)} kr</dd>
                </div>
                <div className={grossEmphasis}>
                  <dt className={grossDt}>Totalt (inkl. moms)</dt>
                  <dd data-testid="preview-gross">{oreToKronorString(taxAnswer.grossOre)} kr</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-600">Skatteavdrag</dt>
                  <dd data-testid="preview-deduction">
                    −{oreToKronorString(taxAnswer.deductionOre)} kr
                  </dd>
                </div>
                <div className="flex justify-between font-semibold">
                  <dt>Att betala</dt>
                  <dd data-testid="preview-payable">{oreToKronorString(taxAnswer.payableOre)} kr</dd>
                </div>
              </dl>
            ) : (
              <p className="text-red-800">Totalsumman kunde inte beräknas.</p>
            )}
            <p data-testid="preview-vat-display" className="mt-1 text-xs text-zinc-500">
              Momsvisning: {vatPostureLabel}.
            </p>
            {taxAnswer ? (
              <ul className="mt-2 flex flex-col gap-1 text-xs text-zinc-700">
                {taxAnswer.categories.map((category) => {
                  const suffix =
                    category.vatType === "STANDARD_VAT_25"
                      ? "standard"
                      : category.vatType === "REVERSE_CHARGE_CONSTRUCTION"
                        ? "reverse-charge"
                        : category.vatType === "REDUCED_VAT"
                          ? "reduced"
                          : "zero";
                  return (
                    <li
                      key={`${category.vatType}-${category.rateBp}`}
                      data-testid={`preview-vat-category-${suffix}`}
                    >
                      {category.vatType === "REVERSE_CHARGE_CONSTRUCTION"
                        ? `Omvänd betalningsskyldighet · ${oreToKronorString(category.netOre)} kr`
                        : `${category.rateBp / 100} % moms · ${oreToKronorString(category.vatOre)} kr`}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
            );
          })()}

          {/* Tax assumptions — surfaced from the warnings captured at snapshot time (unapproved +
              sign-off framing; never rendered final). */}
          <div data-testid="preview-tax-assumptions" className="text-sm">
            <h3 className="font-semibold text-zinc-900">Skatteantaganden</h3>
            {taxSignOffWarning ? (
              <p className="text-amber-900">{taxSignOffWarning.message}</p>
            ) : (
              <p className="text-zinc-600">Inga ROT-/grön teknik-antaganden på kalkylen.</p>
            )}
          </div>

          {/* Terms (from the tenant quote-terms read; approval enforcement is Epic 6). */}
          <div data-testid="preview-terms" className="text-sm">
            <h3 className="font-semibold text-zinc-900">Offertvillkor</h3>
            {quoteTerms ? (
              <>
                <p className="whitespace-pre-wrap text-zinc-700">{quoteTerms.termsText}</p>
                {!quoteTerms.approved && (
                  <p
                    role="status"
                    data-testid="preview-terms-unapproved"
                    className="mt-1 text-amber-900"
                  >
                    Villkoren är inte godkända ännu och kräver godkännande innan de skickas.
                  </p>
                )}
              </>
            ) : (
              <p className="text-zinc-600">
                Inga offertvillkor angivna ännu. Lägg till villkor i Inställningar.
              </p>
            )}
          </div>

          {/* Selected attachments — a DOCUMENTED deferral (Story 8.1/8.2 file foundation
              has not landed, R-513). Surfaced, never silently omitted. */}
          <div data-testid="preview-attachments" className="text-sm">
            <h3 className="font-semibold text-zinc-900">Bifogade filer</h3>
            <p className="text-zinc-600">
              Bilagor är ännu inte tillgängliga — funktionen för filer är inte på plats än.
            </p>
          </div>

          {/* Warnings captured at snapshot time. */}
          <div data-testid="preview-warnings" className="text-sm">
            <h3 className="font-semibold text-zinc-900">Anmärkningar vid tidpunkten</h3>
            {report.warnings.length === 0 ? (
              <p className="text-zinc-600">Inga anmärkningar.</p>
            ) : (
              <ul className="flex list-disc flex-col gap-1 pl-5 text-amber-900">
                {report.warnings.map((w, i) => (
                  <li
                    key={`${w.code}-${i}`}
                    data-testid={`preview-warning-${w.code}-${i}`}
                  >
                    {w.message}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form action={createAction} className="flex flex-col gap-2">
            <input type="hidden" name="calculation_id" value={detail.header.id} />
            {createState.status === "error" ? (
              <p role="alert" className="text-sm text-red-800">
                {createState.formError}
                {isRetryableCreateQuoteError(createState) ? " Försök igen." : ""}
              </p>
            ) : null}
            <button
              type="submit"
              data-testid="confirm-create-quote-version"
              disabled={confirmationDisabled}
              className="self-start rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {createPending
                ? "Skapar…"
                : createState.status === "success"
                  ? "Offertversion skapad"
                  : previewStale
                    ? "Förhandsvisningen är inaktuell"
                    : "Bekräfta och skapa offertversion"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
