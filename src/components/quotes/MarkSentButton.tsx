"use client";

/**
 * Mark-sent affordance (Story 6.4, Task 5.1 / AC1) — rendered ONLY in the DRAFT branch of the
 * quote detail. A real keyboard-operable form button that wires to `markQuoteVersionSentAction`
 * → the `markQuoteVersionSent` command (never a bespoke path). On a successful send the version
 * flips to `sent` and the page re-renders the READ-ONLY branch (the read-only notice +
 * create-new-version placeholder already exist from 6.2).
 *
 * ── UI IS THE MIRROR, NOT THE GUARANTEE (a UI-only lock is a STOP CONDITION) ──────────────────
 * The button is a convenience; the SERVER command guard (`QUOTE_VERSION_LOCKED`) + the DB sent-
 * lock trigger are the enforcement. Only `quote_version_id` (+ the optional recorded
 * channel/reference) is submitted — status/tenant/totals are NEVER accepted from the form.
 *
 * Reuses the 6.2/6.3 `useActionState` + `role="alert"`/`role="status"` banner pattern. Every
 * control has an accessible name + a visible focus ring; the sent state is conveyed as TEXT (the
 * existing text-not-color status badge → "Skickad"), never by color alone.
 */
import { useActionState, useEffect, useState } from "react";
import { markQuoteVersionSentAction } from "@/features/quotes/actions";
import {
  MARK_SENT_ACTION_INITIAL,
  isRetryableMarkSentError,
} from "@/features/quotes/mark-sent-action-state";

export interface MarkSentButtonProps {
  readonly quoteId: string;
  readonly quoteVersionId: string;
}

export function MarkSentButton({ quoteId, quoteVersionId }: MarkSentButtonProps) {
  const [state, formAction, pending] = useActionState(
    markQuoteVersionSentAction,
    MARK_SENT_ACTION_INITIAL,
  );
  const retryable = isRetryableMarkSentError(state);
  const [candidates, setCandidates] = useState<Array<{ sourceType: "customer" | "contact"; sourceId: string; label: string; email: string }>>([]);
  const [recipient, setRecipient] = useState("");
  useEffect(() => { void fetch(`/api/quotes/${quoteVersionId}/delivery-recipients`).then((r) => r.ok ? r.json() : { candidates: [] }).then((data) => setCandidates(data.candidates ?? [])).catch(() => setCandidates([])); }, [quoteVersionId]);
  const selected = candidates.find((candidate) => `${candidate.sourceType}:${candidate.sourceId}` === recipient);

  return (
    <form
      action={formAction}
      data-testid="mark-sent-form"
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4"
      noValidate
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-zinc-900">Skicka offert</h3>
      </div>

      {/* A persistent note: sending LOCKS the version (customer-visible content becomes immutable). */}
      <p
        role="note"
        data-testid="mark-sent-immutable-note"
        className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      >
        När du markerar versionen som skickad låses den — kundens innehåll kan inte längre
        redigeras. Skapa en ny version för att göra ändringar efteråt.
      </p>

      {state.status === "success" && (
        <p role="status" data-testid="mark-sent-status" className="text-sm text-green-800">
          Offertversionen är markerad som skickad.
        </p>
      )}
      {state.status === "error" && state.formError && (
        <p role="alert" data-testid="mark-sent-error" className="text-sm text-red-800">
          {state.formError}
        </p>
      )}
      {retryable && (
        <p role="status" className="text-sm text-amber-800">
          Försök igen.
        </p>
      )}

      <input type="hidden" name="quote_id" value={quoteId} />
      <input type="hidden" name="quote_version_id" value={quoteVersionId} />
      <input type="hidden" name="recipient_source_type" value={selected?.sourceType ?? ""} />
      <input type="hidden" name="recipient_source_id" value={selected?.sourceId ?? ""} />
      <label className="text-sm text-zinc-900">Mottagare
        <select required value={recipient} onChange={(event) => setRecipient(event.target.value)} className="ml-2 rounded border p-1" aria-label="E-postmottagare">
          <option value="">Välj kund eller kontakt</option>
          {candidates.map((candidate) => <option key={`${candidate.sourceType}:${candidate.sourceId}`} value={`${candidate.sourceType}:${candidate.sourceId}`}>{candidate.label} — {candidate.email}</option>)}
        </select>
      </label>
      {candidates.length === 0 && <p role="alert" className="text-sm text-red-800">Ingen giltig e-postadress finns på kunden eller kontakten.</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || !selected}
          data-testid="mark-sent-button"
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
        >
          {pending ? "Skickar…" : "Skicka offert"}
        </button>
      </div>
    </form>
  );
}
