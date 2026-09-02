"use client";

/**
 * Acceptance-capture form (Story 7.1 → 7.2, Task 6 / AC1/AC2) — rendered ONLY on a SENT version
 * (mirror the MarkSentButton/DraftQuoteEditor gating). Replaces the `quote-acceptance-placeholder`
 * section. A real keyboard-operable form that wires to `captureQuoteAcceptanceAction`, which (Story
 * 7.2, Task 4) now runs the TRANSACTIONAL `acceptQuoteAndCreateJob` command — confirming acceptance
 * on a sent version RECORDS the acceptance AND creates the job in one atomic, idempotent call (never
 * a bespoke path). Captures channel, accepted timestamp, an optional job title, evidence file id /
 * external reference, accepted price (öre input, Swedish comma convention), notes, and planned
 * start/end dates. The admin user is the resolved session user (server-derived, NOT a form field).
 *
 * ── UI IS THE MIRROR, NOT THE GUARANTEE ───────────────────────────────────────────────────────
 * The adjusted-price delta + required reason field appear when the entered price ≠ the frozen sent
 * total — this is a MIRROR of the INT-proven server rule (`computeAcceptanceDelta`, the SAME pure
 * engine the command re-validates). Confirm is disabled until a reason is entered for a non-zero
 * delta. The server re-validates the gate (the client cannot bypass it); a UI-only gate is never
 * the guarantee. This is an authenticated admin-only affordance — NO public / portal / callback route.
 *
 * Reuses the 6.2/6.4 `useActionState` + `role="alert"`/`role="status"` banner pattern. Every
 * control has an accessible name + a visible focus ring; the acceptance status is conveyed as TEXT
 * ("Accepterad"), never by color alone (WCAG 1.4.1). The price input reuses the existing
 * kronor↔öre display helper (`oreToKronorString`) so the shown sent total matches the calc editor.
 */
import { useActionState, useMemo, useState } from "react";
import { captureQuoteAcceptanceAction } from "@/features/quotes/actions";
import {
  ACCEPTANCE_ACTION_INITIAL,
  isRetryableAcceptanceError,
} from "@/features/quotes/acceptance-action-state";
import {
  kronorStringToOre,
  oreToKronorString,
} from "@/features/calculations/money-input";
import { computeAcceptanceDelta } from "@/features/quotes/acceptance-price";
import { localAcceptanceTimeCandidates } from "@/features/quotes/acceptance-time";

function formatUtcOffset(iso: string): string {
  const minutes = -new Date(iso).getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const remainingMinutes = String(absolute % 60).padStart(2, "0");
  return `UTC${sign}${hours}:${remainingMinutes}`;
}

export interface AcceptanceCaptureFormProps {
  readonly quoteId: string;
  readonly quoteVersionId: string;
  /** The frozen source sent total (öre) — the customer-commitment gross the version froze. */
  readonly sourceSentTotalOre: number;
}

export function AcceptanceCaptureForm({
  quoteId,
  quoteVersionId,
  sourceSentTotalOre,
}: AcceptanceCaptureFormProps) {
  const [state, formAction, pending] = useActionState(
    captureQuoteAcceptanceAction,
    ACCEPTANCE_ACTION_INITIAL,
  );
  const retryable = isRetryableAcceptanceError(state);

  // The entered kronor price string (the UI mirror computes the delta from it). Empty = not yet
  // entered → no delta shown, confirm allowed (the server re-validates the öre shape on submit).
  const [priceInput, setPriceInput] = useState<string>(() =>
    oreToKronorString(sourceSentTotalOre),
  );
  const [reasonInput, setReasonInput] = useState<string>("");
  const [acceptedAtLocal, setAcceptedAtLocal] = useState<string>("");
  const [acceptedAtOccurrence, setAcceptedAtOccurrence] = useState<string>("");
  const acceptedAtCandidates = useMemo(
    () => localAcceptanceTimeCandidates(acceptedAtLocal),
    [acceptedAtLocal],
  );
  const acceptedAtIso =
    acceptedAtCandidates.length === 1
      ? acceptedAtCandidates[0]!
      : acceptedAtCandidates.length > 1 && acceptedAtOccurrence !== ""
        ? (acceptedAtCandidates[Number(acceptedAtOccurrence)] ?? null)
        : null;

  // Mirror the server rule with the SAME pure engine: parse the entered kronor → öre, compute the
  // delta, decide whether a reason is required. A malformed price parses to null → treated as "no
  // delta shown yet" (the server owns the hard reject); this is a UX nicety only.
  const decision = useMemo(() => {
    const parsed = kronorStringToOre(priceInput);
    if (!parsed.ok) {
      return { valid: false, deltaOre: 0, reasonRequired: false };
    }
    const res = computeAcceptanceDelta(parsed.ore, sourceSentTotalOre);
    if (!res.ok) return { valid: false, deltaOre: 0, reasonRequired: false };
    return { valid: true, deltaOre: res.deltaOre, reasonRequired: res.reasonRequired };
  }, [priceInput, sourceSentTotalOre]);

  const reasonMissing =
    decision.reasonRequired && reasonInput.trim().length === 0;
  const confirmDisabled = pending || reasonMissing || acceptedAtIso === null;

  return (
    <form
      action={formAction}
      data-testid="acceptance-form"
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4"
      noValidate
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-zinc-900">Registrera acceptans</h3>
      </div>

      <p className="text-sm text-zinc-600">
        Registrera kundens acceptans av den skickade offertversionen. Ingen kundportal
        eller publik acceptans skapas — detta är en intern registrering.
      </p>

      {state.status === "success" && (
        <p
          role="status"
          data-testid="acceptance-status"
          className="text-sm text-green-800"
        >
          Accepterad. Acceptansen är registrerad.
        </p>
      )}
      {state.status === "error" && state.formError && (
        <p role="alert" data-testid="acceptance-error" className="text-sm text-red-800">
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
      <input type="hidden" name="accepted_at" value={acceptedAtIso ?? ""} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Kanal</span>
          <input
            name="channel"
            data-testid="acceptance-channel"
            type="text"
            placeholder="t.ex. e-post, telefon"
            className="rounded-md border border-zinc-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
        </label>

        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="acceptance-accepted-at" className="text-zinc-700">
            Accepterad (datum/tid)
          </label>
          <input
            id="acceptance-accepted-at"
            name="accepted_at_local"
            data-testid="acceptance-accepted-at"
            type="datetime-local"
            required
            value={acceptedAtLocal}
            onChange={(event) => {
              setAcceptedAtLocal(event.target.value);
              setAcceptedAtOccurrence("");
            }}
            aria-invalid={
              acceptedAtLocal !== "" && acceptedAtCandidates.length === 0
                ? "true"
                : undefined
            }
            aria-describedby={
              acceptedAtLocal !== "" && acceptedAtCandidates.length === 0
                ? "acceptance-accepted-at-error"
                : acceptedAtCandidates.length > 1
                  ? "acceptance-accepted-at-overlap"
                : undefined
            }
            className="rounded-md border border-zinc-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
          {acceptedAtLocal !== "" && acceptedAtCandidates.length === 0 ? (
            <span id="acceptance-accepted-at-error" role="alert" className="text-xs text-red-800">
              Datumet eller tiden finns inte i din lokala tidszon.
            </span>
          ) : null}
          {acceptedAtCandidates.length > 1 ? (
            <fieldset
              id="acceptance-accepted-at-overlap"
              data-testid="acceptance-accepted-at-overlap"
              className="mt-1 flex flex-col gap-1 rounded-md border border-amber-300 bg-amber-50 p-2"
            >
              <legend className="px-1 text-xs font-medium text-amber-950">
                Tiden inträffar två gånger – välj rätt tillfälle
              </legend>
              {acceptedAtCandidates.map((candidate, index) => (
                <label
                  key={candidate}
                  className="flex items-center gap-2 text-xs text-amber-950"
                >
                  <input
                    type="radio"
                    name="accepted_at_occurrence"
                    value={String(index)}
                    checked={acceptedAtOccurrence === String(index)}
                    onChange={(event) => setAcceptedAtOccurrence(event.target.value)}
                  />
                  {index === 0 ? "Första tillfället" : "Andra tillfället"} (
                  {formatUtcOffset(candidate)})
                </label>
              ))}
            </fieldset>
          ) : null}
        </div>

        {/* Optional job title (Story 7.2) — the job created from the acceptance carries this as its
            display title; absent = the server leaves it null (a nullable Phase-A field). */}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Jobbtitel (valfritt)</span>
          <input
            name="title"
            data-testid="acceptance-job-title"
            type="text"
            placeholder="t.ex. jobb från offert"
            className="rounded-md border border-zinc-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Accepterat pris (kr)</span>
          <input
            name="accepted_price_ore"
            data-testid="acceptance-price-ore"
            type="text"
            inputMode="decimal"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
          <span className="text-xs text-zinc-500">
            Skickat totalbelopp: {oreToKronorString(sourceSentTotalOre)} kr
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Bevisreferens (extern)</span>
          <input
            name="evidence_reference"
            data-testid="acceptance-evidence-reference"
            type="text"
            placeholder="t.ex. kundmail, ärendenummer"
            className="rounded-md border border-zinc-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Bevisfil (id, valfritt)</span>
          <input
            name="evidence_file_id"
            data-testid="acceptance-evidence-file-id"
            type="text"
            placeholder="Redan uppladdad fil (id)"
            className="rounded-md border border-zinc-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Planerad start</span>
          <input
            name="planned_start_date"
            data-testid="acceptance-planned-start"
            type="date"
            className="rounded-md border border-zinc-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Planerat slut</span>
          <input
            name="planned_end_date"
            data-testid="acceptance-planned-end"
            type="date"
            className="rounded-md border border-zinc-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Anteckningar</span>
          <textarea
            name="notes"
            data-testid="acceptance-notes"
            rows={2}
            className="rounded-md border border-zinc-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
        </label>
      </div>

      {/* The adjusted-price delta + REQUIRED reason field — appear ONLY when the entered price ≠
          the sent total (a non-zero delta). Text, not color, conveys the direction. */}
      {decision.valid && decision.reasonRequired && (
        <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
          <p data-testid="acceptance-price-delta" className="text-sm text-amber-900">
            Prisjustering:{" "}
            {decision.deltaOre >= 0 ? "+" : "−"}
            {oreToKronorString(Math.abs(decision.deltaOre))} kr jämfört med det skickade
            totalbeloppet. En motivering krävs innan du bekräftar.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700">Motivering för prisjustering</span>
            <input
              name="adjustment_reason"
              data-testid="acceptance-adjustment-reason"
              type="text"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              aria-required="true"
              className="rounded-md border border-zinc-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
          </label>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={confirmDisabled}
          data-testid="acceptance-confirm"
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
        >
          {pending ? "Registrerar…" : "Bekräfta acceptans"}
        </button>
      </div>
    </form>
  );
}
