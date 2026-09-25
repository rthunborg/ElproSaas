"use client";

import { useActionState, useEffect, useState } from "react";
import { correctPendingQuoteDeliveryRecipientAction } from "@/features/quotes/actions";
import {
  MARK_SENT_ACTION_INITIAL,
  isRetryableMarkSentError,
} from "@/features/quotes/mark-sent-action-state";

type Candidate = {
  readonly sourceType: "customer" | "contact";
  readonly sourceId: string;
  readonly label: string;
  readonly email: string;
};

/** A correction is offered only while the frozen delivery has not been claimed. */
export function CorrectQuoteDeliveryRecipient({ quoteId, quoteVersionId }: {
  readonly quoteId: string;
  readonly quoteVersionId: string;
}) {
  const [state, formAction, pending] = useActionState(
    correctPendingQuoteDeliveryRecipientAction,
    MARK_SENT_ACTION_INITIAL,
  );
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [available, setAvailable] = useState(false);
  const [recipient, setRecipient] = useState("");
  useEffect(() => {
    void fetch(`/api/quotes/${quoteVersionId}/delivery-recipients`)
      .then((response) => response.ok ? response.json() : { candidates: [], pendingDelivery: false })
      .then((data) => {
        setCandidates(data.candidates ?? []);
        setAvailable(data.pendingDelivery === true);
      })
      .catch(() => setAvailable(false));
  }, [quoteVersionId]);
  const selected = candidates.find((candidate) => `${candidate.sourceType}:${candidate.sourceId}` === recipient);

  if (!available) return null;
  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4" data-testid="correct-quote-delivery-recipient-form">
      <p className="text-sm text-amber-950">
        Leveransen väntar fortfarande. Välj en annan mottagare för att avbryta den väntande leveransen och skapa en ny.
      </p>
      {state.status === "success" && <p role="status" className="text-sm text-green-800">Mottagaren har uppdaterats. Den nya leveransen väntar på behandling.</p>}
      {state.status === "error" && state.formError && <p role="alert" className="text-sm text-red-800">{state.formError}</p>}
      {isRetryableMarkSentError(state) && <p role="status" className="text-sm text-amber-800">Försök igen.</p>}
      <input type="hidden" name="quote_id" value={quoteId} />
      <input type="hidden" name="quote_version_id" value={quoteVersionId} />
      <input type="hidden" name="recipient_source_type" value={selected?.sourceType ?? ""} />
      <input type="hidden" name="recipient_source_id" value={selected?.sourceId ?? ""} />
      <label className="text-sm text-zinc-900">
        Ny e-postmottagare
        <select required value={recipient} onChange={(event) => setRecipient(event.target.value)} className="ml-2 rounded border p-1" aria-label="Ny e-postmottagare">
          <option value="">Välj kund eller kontakt</option>
          {candidates.map((candidate) => <option key={`${candidate.sourceType}:${candidate.sourceId}`} value={`${candidate.sourceType}:${candidate.sourceId}`}>{candidate.label} — {candidate.email}</option>)}
        </select>
      </label>
      <div className="flex justify-end">
        <button type="submit" disabled={pending || !selected} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60">
          {pending ? "Uppdaterar…" : "Byt mottagare"}
        </button>
      </div>
    </form>
  );
}
