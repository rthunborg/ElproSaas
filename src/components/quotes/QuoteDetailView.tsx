"use client";

/**
 * Quote detail island (Story 6.2, Task 2.3 / AC1-AC3) — the quote-detail + version-timeline UX.
 *
 * Renders (all from the FROZEN snapshot props — NO recompute; R-616):
 *   (a) a LIFECYCLE HEADER — quote status (latest version state) + customer display + a link to
 *       the source calculation;
 *   (b) a VERSION TIMELINE — every version with a TEXT status badge (WCAG 1.4.1: the status is
 *       the badge word, color is redundant). The timeline is a keyboard-operable list; the
 *       selected version is marked `aria-current`;
 *   (c) the SELECTED version's IMMUTABLE snapshot block — customer/facility/contact display, the
 *       line/section display model (from `quote_version_lines`), totals + VAT/tax assumptions
 *       (öre → kronor via the SINGLE existing `oreToKronorString`), terms + the non-final /
 *       `requiresSignOff` framing, the selected attachments/files list, the PDF status, an
 *       acceptance-state PLACEHOLDER (Epic 7 owns real acceptance), and the events list.
 *
 * A DRAFT selected version shows the `DraftQuoteEditor` (customer-visible presentational edit);
 * a SENT/ACCEPTED (or other non-draft) version renders READ-ONLY with a "Skapa ny version"
 * affordance directing to the Story 6.5 new-version path (6.2 surfaces the message only).
 *
 * Version selection is a client-side URL param change (the version subroute) — the page re-reads
 * the selected version. The ordering / current-commitment / selection logic is the PURE
 * `@/features/quotes/timeline` helpers (unit-pinned; never inline here).
 */
import Link from "next/link";
import { oreToKronorString } from "@/features/calculations/money-input";
import {
  currentCommitmentVersion,
  type QuoteVersionStatus,
} from "@/features/quotes/timeline";
import { buildCustomerVisibleLines } from "@/features/quotes/view-model";
import type {
  QuoteDetail,
  QuoteVersionRow,
} from "@/features/quotes/read";
import { StatusBadge } from "./StatusBadge";
import { quoteStatusLabel } from "./status";
import { DraftQuoteEditor } from "./DraftQuoteEditor";
import { MarkSentButton } from "./MarkSentButton";
import { QuotePdfPanel } from "./QuotePdfPanel";

/** The Swedish label for the (frozen) VAT display posture, for the assumptions block. */
function vatDisplayLabel(posture: string | null): string {
  switch (posture) {
    case "company_excl":
      return "exkl. moms";
    case "company_togglable":
      return "kan visas in-/exkl. moms";
    default:
      return "inkl. moms";
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleDateString("sv-SE");
}

/** The event-type → Swedish label (the append-friendly quote lifecycle events). */
const EVENT_LABELS: Record<string, string> = {
  created: "Skapad",
  draft: "Utkast",
  sent: "Skickad",
  accepted: "Accepterad",
  rejected: "Avvisad",
  expired: "Utgången",
  superseded: "Ersatt",
};

export function QuoteDetailView({ detail }: { readonly detail: QuoteDetail }) {
  const { header, versions, selectedVersionId, selectedLines, selectedAttachments, events } =
    detail;

  // Order the read rows by version_number ascending (the read layer already returns them asc;
  // re-sort defensively — the snake_case rows are ordered here, the PURE helpers run on the
  // mapped camelCase TimelineVersion shape).
  const ordered: QuoteVersionRow[] = [...versions].sort(
    (a, b) => a.version_number - b.version_number,
  );
  const selected: QuoteVersionRow =
    versions.find((v) => v.id === selectedVersionId) ?? ordered[ordered.length - 1];
  const commitment = currentCommitmentVersion(
    versions.map((v) => ({
      id: v.id,
      versionNumber: v.version_number,
      status: v.status as QuoteVersionStatus,
    })),
  );
  const latest = ordered[ordered.length - 1];
  const isDraft = selected.status === "draft";

  const lines = buildCustomerVisibleLines(
    selectedLines.map((l) => ({
      rowType: l.row_type,
      sortOrder: l.sort_order,
      label: l.label,
      description: l.description,
      quoteNote: l.quote_note,
      quantity: l.quantity,
      unit: l.unit,
      unitSellOre: l.unit_sell_ore,
      lineNetOre: l.line_net_ore,
      vatRateBp: l.vat_rate_bp,
      isHidden: l.is_hidden,
      isOptional: l.is_optional,
      isSelected: l.is_selected,
    })),
  );

  return (
    <section
      data-testid="quote-detail"
      aria-labelledby="quote-detail-heading"
      className="flex flex-col gap-6 p-6"
    >
      {/* ── (a) LIFECYCLE HEADER ────────────────────────────────────────────── */}
      <header
        data-testid="quote-lifecycle-header"
        className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4"
      >
        <div className="flex items-center justify-between gap-4">
          <h1
            id="quote-detail-heading"
            className="text-2xl font-semibold text-zinc-900"
          >
            {header.customer_display_name ?? "Offert"}
          </h1>
          <StatusBadge status={latest?.status ?? selected.status} />
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-zinc-600">Kund:</dt>
            <dd data-testid="quote-customer" className="font-medium text-zinc-900">
              {header.customer_display_name ?? "—"}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-zinc-600">Senaste versionens status:</dt>
            <dd data-testid="quote-latest-status" className="font-medium text-zinc-900">
              {quoteStatusLabel(latest?.status ?? selected.status)}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-zinc-600">Nuvarande åtagande:</dt>
            <dd data-testid="quote-current-commitment" className="text-zinc-900">
              {commitment
                ? `Version ${commitment.versionNumber} (${quoteStatusLabel(commitment.status)})`
                : "—"}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-zinc-600">Källkalkyl:</dt>
            <dd data-testid="quote-source-calculation">
              {header.calculation_id ? (
                <Link
                  href={`/calculations/${header.calculation_id}`}
                  className="font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  Öppna kalkyl
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_1fr]">
        {/* ── (b) VERSION TIMELINE ──────────────────────────────────────────── */}
        <nav
          data-testid="quote-version-timeline"
          aria-label="Versioner"
          className="rounded-lg border border-zinc-200 bg-white p-4"
        >
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Versioner</h2>
          <ul className="flex flex-col gap-1">
            {ordered.map((v) => {
              const isSelected = v.id === selectedVersionId;
              return (
                <li key={v.id}>
                  <Link
                    href={`/quotes/${header.id}/versions/${v.id}`}
                    data-testid="quote-timeline-item"
                    aria-current={isSelected ? "true" : undefined}
                    className={[
                      "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                      isSelected
                        ? "border-blue-400 bg-blue-50"
                        : "border-zinc-200 hover:bg-zinc-50",
                    ].join(" ")}
                  >
                    <span className="font-medium text-zinc-900">
                      Version {v.version_number}
                    </span>
                    <StatusBadge status={v.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── (c) SELECTED-VERSION IMMUTABLE SNAPSHOT ───────────────────────── */}
        <div className="flex flex-col gap-6">
          <div
            data-testid="quote-version-snapshot"
            data-version-id={selected.id}
            data-status={selected.status}
            className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-zinc-900">
                Version {selected.version_number}
              </h2>
              <StatusBadge status={selected.status} />
            </div>

            {/* Customer / facility / contact display (from the frozen snapshot). */}
            <dl
              data-testid="quote-snapshot-parties"
              className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2"
            >
              <div className="flex gap-2">
                <dt className="text-zinc-600">Kund:</dt>
                <dd className="text-zinc-900">
                  {selected.customer_display_name ?? "—"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-zinc-600">Anläggning:</dt>
                <dd className="text-zinc-900">{selected.facility_name ?? "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-zinc-600">Kontakt:</dt>
                <dd className="text-zinc-900">{selected.contact_name ?? "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-zinc-600">Offertnummer:</dt>
                <dd data-testid="quote-number" className="text-zinc-900">
                  {selected.quote_number_display ?? selected.quote_number ?? "—"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-zinc-600">Giltig till:</dt>
                <dd className="text-zinc-900">{formatDate(selected.valid_until)}</dd>
              </div>
            </dl>

            {/* The line / section display model (from quote_version_lines — customer-visible). */}
            <div data-testid="quote-snapshot-lines" className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-zinc-600">
                    <th className="py-1 pr-2 font-medium">Rad</th>
                    <th className="py-1 pr-2 font-medium">Antal</th>
                    <th className="py-1 pr-2 font-medium">À-pris</th>
                    <th className="py-1 pr-2 font-medium">Netto</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-2 text-zinc-600">
                        Inga rader i denna version.
                      </td>
                    </tr>
                  ) : (
                    lines.map((l, i) => (
                      <tr
                        key={`${l.sortOrder}-${i}`}
                        data-testid="quote-snapshot-line"
                        className="border-b border-zinc-100"
                      >
                        <td className="py-1 pr-2 text-zinc-900">
                          {l.label ?? l.description ?? "—"}
                          {l.isOptional && (
                            <span className="ml-2 text-xs text-zinc-500">(tillval)</span>
                          )}
                        </td>
                        <td className="py-1 pr-2 text-zinc-700">
                          {l.quantity ?? "—"} {l.unit ?? ""}
                        </td>
                        <td className="py-1 pr-2 text-zinc-700">
                          {l.unitSellOre !== null
                            ? `${oreToKronorString(l.unitSellOre)} kr`
                            : "—"}
                        </td>
                        <td className="py-1 pr-2 text-zinc-900">
                          {l.lineNetOre !== null
                            ? `${oreToKronorString(l.lineNetOre)} kr`
                            : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals + VAT/tax assumptions — READ VERBATIM from the frozen row (no recompute). */}
            <dl
              data-testid="quote-snapshot-totals"
              className="flex flex-col gap-1 border-t border-zinc-200 pt-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600">Grundbelopp (netto)</dt>
                <dd className="font-medium text-zinc-900">
                  {oreToKronorString(selected.base_total_ore)} kr
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600">Tillval (valda)</dt>
                <dd className="font-medium text-zinc-900">
                  {oreToKronorString(selected.option_total_ore)} kr
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600">Moms</dt>
                <dd className="font-medium text-zinc-900">
                  {oreToKronorString(selected.vat_total_ore)} kr
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-200 pt-2">
                <dt className="text-zinc-900">Att betala (inkl. moms)</dt>
                <dd
                  data-testid="quote-accepted-price"
                  className="font-semibold text-zinc-900"
                >
                  {oreToKronorString(selected.accepted_price_ore)} kr
                </dd>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Belopp visas från den frysta offertversionen. Standardvy:{" "}
                {vatDisplayLabel(selected.vat_display)}.
              </p>
            </dl>

            {/* Tax / deduction assumption with the NON-FINAL / requiresSignOff framing. */}
            {selected.requires_sign_off && (
              <p
                role="note"
                data-testid="quote-requires-sign-off"
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              >
                Skatte- och momsantaganden är en preliminär uppskattning som kräver
                godkännande — visas inte som ett slutligt juridiskt dokument.
              </p>
            )}

            {/* Terms text (customer-visible; internal notes are NOT interleaved — R-607). */}
            {selected.terms_text && (
              <section data-testid="quote-snapshot-terms" className="text-sm">
                <h3 className="mb-1 font-medium text-zinc-800">Villkor</h3>
                <p className="whitespace-pre-wrap text-zinc-700">{selected.terms_text}</p>
                {selected.terms_approved_at === null && (
                  <p className="mt-1 text-xs text-amber-800">
                    Villkoren är inte godkända ännu.
                  </p>
                )}
              </section>
            )}

            {/* Selected attachments / files. */}
            <section data-testid="quote-snapshot-attachments" className="text-sm">
              <h3 className="mb-1 font-medium text-zinc-800">Bifogade filer</h3>
              {selectedAttachments.length === 0 ? (
                <p className="text-zinc-600">Inga bifogade filer.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {selectedAttachments.map((a) => (
                    <li
                      key={a.id}
                      data-testid="quote-attachment"
                      className="text-zinc-800"
                    >
                      {a.display_name ?? "Fil"}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* PDF render-state panel (Story 6.3) — the six states + preview/download via a
                short-lived signed URL. Wires to the generateQuotePdf / createSignedFileAccess
                commands (never a bespoke path). */}
            <QuotePdfPanel
              quoteId={header.id}
              quoteVersionId={selected.id}
              pdfStatus={selected.pdf_status}
              pdfFileId={selected.pdf_file_id}
              pdfGeneratedAt={selected.pdf_generated_at}
            />

            {/* Acceptance state PLACEHOLDER — real acceptance is Epic 7 (no public affordance). */}
            <section data-testid="quote-acceptance-placeholder" className="text-sm">
              <h3 className="mb-1 font-medium text-zinc-800">Acceptans</h3>
              <p className="text-zinc-600">
                Ej accepterad ännu. Acceptans hanteras i Epic 7.
              </p>
            </section>
          </div>

          {/* ── Draft edit + mark-sent OR read-only + "create new version" ────── */}
          {isDraft ? (
            <>
              <DraftQuoteEditor
                values={{
                  quoteId: header.id,
                  quoteVersionId: selected.id,
                  introText: selected.intro_text,
                  customerNotes: selected.customer_notes,
                  validUntil: selected.valid_until,
                  displayMode: selected.display_mode,
                }}
              />
              {/* Mark-sent affordance (Story 6.4) — flips the draft to a locked sent version.
                  The UI is the MIRROR of the INT-proven server guard + DB trigger, not the
                  guarantee (a UI-only lock is a STOP condition). */}
              <MarkSentButton quoteId={header.id} quoteVersionId={selected.id} />
            </>
          ) : (
            <div
              data-testid="quote-readonly-notice"
              className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4"
            >
              <p className="text-sm text-zinc-700">
                Den här versionen är{" "}
                <strong>{quoteStatusLabel(selected.status)}</strong> och kan inte
                redigeras — kundens innehåll är låst. Skapa en ny version för att göra
                ändringar.
              </p>
              <div>
                <button
                  type="button"
                  disabled
                  data-testid="create-new-version"
                  title="Ny version skapas i ett senare steg (Story 6.5)."
                  className="rounded-md border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-500"
                >
                  Skapa ny version
                </button>
              </div>
            </div>
          )}

          {/* Lifecycle events (READ only — 6.2 never mutates the event log). */}
          <section
            data-testid="quote-events"
            className="rounded-lg border border-zinc-200 bg-white p-4 text-sm"
          >
            <h2 className="mb-2 text-sm font-semibold text-zinc-900">Händelser</h2>
            {events.length === 0 ? (
              <p className="text-zinc-600">Inga händelser.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {events.map((e) => (
                  <li
                    key={e.id}
                    data-testid="quote-event"
                    className="flex items-center justify-between gap-3 text-zinc-800"
                  >
                    <span>{EVENT_LABELS[e.event_type] ?? e.event_type}</span>
                    <span className="text-xs text-zinc-500">
                      {formatDate(e.occurred_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
