"use client";

/**
 * Story 6.3, Task 5 — the six-state PDF render panel (AC2/AC3).
 *
 * Surfaces the PDF render states on the quote detail (extends the 6.2 `quote-pdf-status`
 * placeholder region): `not_generated` (a "Generera PDF" action), `generating` (in-progress),
 * `generated` (preview + download affordances), `failed` (a retry action). The `retry` and
 * `preview`/`download` affordances are DERIVED from `failed`/`generated` (not DB states).
 *
 * ── A11Y (AC2/AC3; 6.3-E2E-01/02) ────────────────────────────────────────────────────────
 * Every control is a REAL keyboard-operable button/link with an accessible name; the status is
 * conveyed with a NON-COLOR cue (a text label — WCAG 1.4.1), consistent with 6.2's text-not-color
 * badge discipline. `role="status"`/`role="alert"` banners announce success/failure. The download
 * link is the ACCESSIBLE FALLBACK for the inline preview so a screen-reader/keyboard user can
 * still obtain the PDF. `focus-visible` rings on every control.
 *
 * ── SIGNED ACCESS (AC3) ───────────────────────────────────────────────────────────────────
 * Preview + download go through the SIGNED-ACCESS funnel (`previewQuotePdfAction` →
 * `createSignedFileAccess`) — a SHORT-LIVED signed URL, never a public URL, never the raw object
 * path. The affordance is shown only for a `generated` version. The generate/retry actions wire
 * to `generateQuotePdfAction` → the `generateQuotePdf` command (never a bespoke path).
 */
import { useActionState } from "react";
import {
  generateQuotePdfAction,
  previewQuotePdfAction,
} from "@/features/quotes/actions";
import {
  QUOTE_PDF_ACTION_INITIAL,
  QUOTE_PDF_PREVIEW_INITIAL,
  isRetryableQuotePdfError,
} from "@/features/quotes/pdf-action-state";

/** The frozen PDF-render props the panel renders (from the read layer). */
export interface QuotePdfPanelProps {
  readonly quoteId: string;
  readonly quoteVersionId: string;
  /** not_generated | generating | generated | failed (the DB render state). */
  readonly pdfStatus: string;
  readonly pdfFileId: string | null;
  readonly pdfGeneratedAt: string | null;
}

/** The Swedish label for each render state (the NON-COLOR text status cue — WCAG 1.4.1). */
function statusLabel(status: string): string {
  switch (status) {
    case "generating":
      return "PDF genereras…";
    case "generated":
      return "PDF genererad";
    case "failed":
      return "PDF-generering misslyckades";
    default:
      return "Ingen PDF genererad ännu";
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString("sv-SE");
}

export function QuotePdfPanel(props: QuotePdfPanelProps) {
  const [genState, genAction, genPending] = useActionState(
    generateQuotePdfAction,
    QUOTE_PDF_ACTION_INITIAL,
  );
  const [previewState, previewAction, previewPending] = useActionState(
    previewQuotePdfAction,
    QUOTE_PDF_PREVIEW_INITIAL,
  );

  // The effective render state: `generating` while a generate/retry submit is pending so the
  // in-progress state is visible even before the server round-trip lands.
  const status = genPending ? "generating" : props.pdfStatus;
  const isGenerated = status === "generated" && props.pdfFileId !== null;
  const isFailed = status === "failed";
  const isNotGenerated = status === "not_generated";
  const retryableGen = isRetryableQuotePdfError(genState);

  return (
    <section data-testid="quote-pdf-status" data-pdf-status={status} className="text-sm">
      <h3 className="mb-1 font-medium text-zinc-800">PDF</h3>

      {/* NON-COLOR text status cue (WCAG 1.4.1) — the status is the WORD, not a color. */}
      <p data-testid="quote-pdf-status-label" className="text-zinc-700">
        {statusLabel(status)}
        {isGenerated && props.pdfGeneratedAt
          ? ` (${formatDate(props.pdfGeneratedAt)})`
          : ""}
      </p>

      {/* Generate/retry error + retryable banners (announced). */}
      {genState.status === "error" && genState.formError && (
        <p role="alert" data-testid="quote-pdf-error" className="mt-1 text-red-800">
          {genState.formError}
        </p>
      )}
      {retryableGen && (
        <p role="status" className="mt-1 text-amber-800">
          Försök igen.
        </p>
      )}

      {/* ── not_generated → a "Generera PDF" action. ── */}
      {isNotGenerated && (
        <form action={genAction} className="mt-2">
          <input type="hidden" name="quote_id" value={props.quoteId} />
          <input type="hidden" name="quote_version_id" value={props.quoteVersionId} />
          <button
            type="submit"
            disabled={genPending}
            data-testid="quote-pdf-generate"
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
          >
            {genPending ? "Genererar…" : "Generera PDF"}
          </button>
        </form>
      )}

      {/* ── generating → an in-progress announcement (no action). ── */}
      {status === "generating" && (
        <p role="status" data-testid="quote-pdf-generating" className="mt-2 text-zinc-600">
          PDF genereras…
        </p>
      )}

      {/* ── failed → a retry action (regenerates from the same frozen snapshot). ── */}
      {isFailed && (
        <form action={genAction} className="mt-2">
          <input type="hidden" name="quote_id" value={props.quoteId} />
          <input type="hidden" name="quote_version_id" value={props.quoteVersionId} />
          <button
            type="submit"
            disabled={genPending}
            data-testid="quote-pdf-retry"
            className="rounded-md border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 disabled:opacity-60"
          >
            {genPending ? "Försöker igen…" : "Försök igen"}
          </button>
        </form>
      )}

      {/* ── generated → preview + download via a short-lived signed URL. ── */}
      {isGenerated && (
        <div className="mt-2 flex flex-col gap-2">
          <form action={previewAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="file_id" value={props.pdfFileId ?? ""} />
            <button
              type="submit"
              disabled={previewPending}
              data-testid="quote-pdf-preview"
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
            >
              {previewPending ? "Hämtar…" : "Förhandsgranska"}
            </button>
          </form>

          {previewState.status === "error" && previewState.formError && (
            <p role="alert" data-testid="quote-pdf-preview-error" className="text-red-800">
              {previewState.formError}
            </p>
          )}

          {/* The download link is the ACCESSIBLE FALLBACK for the inline preview (6.3-E2E-02):
              a keyboard-operable link with an accessible name, shown after a successful sign. */}
          {previewState.status === "success" && previewState.signedUrl && (
            <a
              href={previewState.signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="quote-pdf-download"
              className="inline-flex w-fit rounded-md border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Ladda ner PDF
            </a>
          )}
        </div>
      )}
    </section>
  );
}
