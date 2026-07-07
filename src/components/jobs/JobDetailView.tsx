/**
 * Job/order detail view (Story 7.3, Task 3 / AC1/AC4/AC5) — the read/traceability UX for one
 * accepted job. A SERVER component: it receives the assembled `JobDetail` (money + frozen commitment
 * names DISPLAYED from the immutable `quote_acceptances`/`quote_versions` refs — never re-derived;
 * R-708) and renders:
 *   - a SOURCE-TRACEABILITY block (AC1): the source quote version (a LINK to
 *     `/quotes/[quoteId]/versions/[versionId]` + quote number), the acceptance evidence (a signed
 *     file link OR the external reference), the accepted price + source sent total (öre → kronor via
 *     the existing `oreToKronorString`), customer/facility/contact, planned dates, files, events;
 *   - the ALLOWED-EDIT affordance (AC4): the `JobEditDialog` exposing ONLY title/status/planned
 *     dates. EVERY immutable field is DISPLAY-ONLY — NO edit control renders for the source refs /
 *     accepted price / source total / evidence / accepted timestamp / channel (UX-DR26; the coming
 *     7.4 trigger is the DB backstop, but 7.3 must not even offer the affordance).
 *
 * SCOPE GUARD (AC2/AC3, R-711): NO deferred-module surface (the `job-non-scope` guardrail enforces
 * the exact forbidden token/route list). Status is a Phase-A order-lifecycle set, NOT field-worker
 * states. NO create/delete affordance (a job is only created by the 7.2 transaction). NO duplicate
 * job / second create affordance / error state on the idempotency deep-link (AC5).
 */
import Link from "next/link";
import { oreToKronorString } from "@/features/calculations/money-input";
import { JOB_STATUS_LABELS, type JobDetail } from "@/features/jobs/types";
import { JobEditDialog } from "./JobEditDialog";
import { JobEvidenceLink } from "./JobEvidenceLink";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleDateString("sv-SE");
}

/** The event-type → Swedish label (the append-friendly job lifecycle events). */
const EVENT_LABELS: Record<string, string> = {
  created: "Skapad",
  in_progress: "Pågår",
  done: "Klar",
  cancelled: "Avbruten",
};

export function JobDetailView({ detail }: { readonly detail: JobDetail }) {
  const versionHref = detail.quoteId
    ? `/quotes/${detail.quoteId}/versions/${detail.quoteVersionId}`
    : null;

  return (
    <section
      data-testid="job-detail"
      aria-labelledby="job-detail-heading"
      className="flex flex-col gap-6 p-6"
    >
      {/* ── HEADER ─────────────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <h1 id="job-detail-heading" className="text-2xl font-semibold text-zinc-900">
            {detail.title ?? detail.currentCustomerName ?? "Jobb"}
          </h1>
          {/* Status as TEXT (a11y — never color alone). */}
          <span
            data-testid="job-status"
            className="rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-sm font-medium text-zinc-800"
          >
            {JOB_STATUS_LABELS[detail.status]}
          </span>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-zinc-600">Kund:</dt>
            <dd data-testid="job-customer" className="font-medium text-zinc-900">
              {detail.currentCustomerName ?? "—"}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-zinc-600">Planerat:</dt>
            <dd data-testid="job-planned-dates" className="text-zinc-900">
              {formatDate(detail.plannedStartDate)} – {formatDate(detail.plannedEndDate)}
            </dd>
          </div>
        </dl>
      </header>

      {/* ── SOURCE TRACEABILITY (AC1, read-only immutable refs) ────────────────── */}
      <div
        data-testid="job-source-traceability"
        className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4"
      >
        <h2 className="text-lg font-semibold text-zinc-900">Ursprung och åtagande</h2>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {/* Source quote version — a LINK to the version (display-only ref). */}
          <div className="flex flex-col gap-1">
            <dt className="text-zinc-600">Källoffert (version):</dt>
            <dd>
              {versionHref ? (
                <Link
                  href={versionHref}
                  data-testid="job-source-quote-version"
                  className="font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  {detail.quoteNumber
                    ? `Offert #${detail.quoteNumber}`
                    : "Öppna offertversion"}
                </Link>
              ) : (
                <span data-testid="job-source-quote-version" className="text-zinc-900">
                  {detail.quoteNumber ? `Offert #${detail.quoteNumber}` : "—"}
                </span>
              )}
            </dd>
          </div>

          {/* FROZEN commitment names (from the version snapshot — display only). */}
          <div className="flex flex-col gap-1">
            <dt className="text-zinc-600">Kund (vid acceptans):</dt>
            <dd data-testid="job-commitment-customer" className="text-zinc-900">
              {detail.commitmentCustomerName ?? "—"}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-zinc-600">Anläggning:</dt>
            <dd className="text-zinc-900">{detail.commitmentFacilityName ?? "—"}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-zinc-600">Kontakt:</dt>
            <dd className="text-zinc-900">{detail.commitmentContactName ?? "—"}</dd>
          </div>

          {/* Accepted price + source sent total — DISPLAYED from the immutable acceptance row. */}
          <div className="flex flex-col gap-1">
            <dt className="text-zinc-600">Accepterat pris:</dt>
            <dd data-testid="job-accepted-price" className="font-semibold text-zinc-900">
              {oreToKronorString(detail.acceptedPriceOre)} kr
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-zinc-600">Ursprunglig offertsumma:</dt>
            <dd data-testid="job-source-sent-total" className="text-zinc-900">
              {oreToKronorString(detail.sourceSentTotalOre)} kr
            </dd>
          </div>

          {detail.channel && (
            <div className="flex flex-col gap-1">
              <dt className="text-zinc-600">Kanal:</dt>
              <dd className="text-zinc-900">{detail.channel}</dd>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <dt className="text-zinc-600">Accepterad:</dt>
            <dd className="text-zinc-900">{formatDate(detail.acceptedAt)}</dd>
          </div>
        </dl>

        {/* Acceptance evidence (a signed file link OR the external reference). */}
        <div className="border-t border-zinc-200 pt-3">
          <h3 className="mb-1 text-sm font-medium text-zinc-800">Bevis för acceptans</h3>
          <JobEvidenceLink
            evidenceFileId={detail.evidenceFileId}
            evidenceReference={detail.evidenceReference}
            evidenceFileName={
              detail.files.find((f) => f.fileId === detail.evidenceFileId)?.displayName ??
              null
            }
          />
        </div>

        {detail.adjustmentReason && (
          <p className="text-sm text-zinc-700">
            <span className="text-zinc-600">Justeringsskäl: </span>
            {detail.adjustmentReason}
          </p>
        )}

        {/* ── CORRECTION-BOUNDARY NOTICE (Story 7.4, AC1) ─────────────────────── */}
        {/* The accepted commitment (accepted price, source sent total, evidence, source version, */}
        {/* acceptance timestamp/channel) + the job's immutable source refs are LOCKED at BOTH the */}
        {/* command and DB layers (7.4-INT-01/02). This notice EXPLAINS the boundary as TEXT (a11y — */}
        {/* not color alone): corrections require an approved audited workflow, NOT a silent edit. */}
        {/* SCOPE GUARD (R-714 STOP): explanatory ONLY — NO "request correction" action, NO edit */}
        {/* affordance for any immutable field (none renders — every immutable field is display-only */}
        {/* above; the 7.3 allowed-edit dialog exposes ONLY title/status/planned dates below). */}
        <div
          data-testid="job-accepted-lock-notice"
          role="note"
          className="border-t border-zinc-200 pt-3 text-sm text-zinc-700"
        >
          <p>
            Det accepterade åtagandet är{" "}
            <span className="font-medium text-zinc-900">låst</span> — accepterat pris,
            ursprunglig offertsumma, bevis, källoffertversion samt tidpunkt och kanal för
            acceptansen kan inte redigeras här. Korrigeringar kräver ett{" "}
            <span className="font-medium text-zinc-900">godkänt granskat arbetsflöde</span>,
            inte en tyst ändring.
          </p>
        </div>
      </div>

      {/* ── LINKED FILES (owner_type='job') ────────────────────────────────────── */}
      <section
        data-testid="job-files"
        className="rounded-lg border border-zinc-200 bg-white p-4 text-sm"
      >
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Filer</h2>
        {detail.files.length === 0 ? (
          <p className="text-zinc-600">Inga kopplade filer.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {detail.files.map((f) => (
              <li key={f.id} data-testid="job-file" className="text-zinc-800">
                {f.displayName ?? "Fil"}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── ALLOWED-EDIT AFFORDANCE (AC4) — title / status / planned dates ONLY ── */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Redigera</h2>
        <JobEditDialog
          jobId={detail.id}
          title={detail.title}
          status={detail.status}
          plannedStartDate={detail.plannedStartDate}
          plannedEndDate={detail.plannedEndDate}
        />
      </div>

      {/* ── EVENT HISTORY (READ only) ──────────────────────────────────────────── */}
      <section
        data-testid="job-event-history"
        className="rounded-lg border border-zinc-200 bg-white p-4 text-sm"
      >
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Händelser</h2>
        {detail.events.length === 0 ? (
          <p className="text-zinc-600">Inga händelser.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {detail.events.map((e) => (
              <li
                key={e.id}
                data-testid="job-event"
                className="flex items-center justify-between gap-3 text-zinc-800"
              >
                <span>{EVENT_LABELS[e.eventType] ?? e.eventType}</span>
                <span className="text-xs text-zinc-500">
                  {formatDate(e.occurredAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
