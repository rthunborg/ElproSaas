"use client";

/**
 * Mark-lost affordance (Story 10.2, Task 5.1 / AC1/AC2) — rendered ONLY on a SENT version, alongside
 * the acceptance affordance. Opens an explicit-confirm dialog (never undo-based — UX l.432) that
 * requires an OUTCOME (Förlorad / Avböjd) AND a structured reason: a category from the strawman
 * (Pris, Konkurrent, Tidplan, Uteblivet svar, Annat) plus a free-text note — the note is REQUIRED
 * (client-validated) when the category is Annat. Confirm stays disabled until an outcome + a valid
 * reason are supplied. Wires to `markQuoteVersionLostAction` → the `markQuoteVersionLost` command
 * (never a bespoke path).
 *
 * ── UI IS THE MIRROR, NOT THE GUARANTEE ───────────────────────────────────────────────────────────
 * The button + dialog are a convenience; the SERVER command guard (`isLegalLifecycleTransition`) + the
 * DB sent-lock trigger + the reason validator are the enforcement. Only `quote_version_id` + the
 * structured reason are submitted — status/tenant are NEVER accepted from the form. The confirmation
 * copy states plainly that the flip is an APPEND-ONLY lifecycle event, the SENT SNAPSHOT DOES NOT
 * CHANGE, and a NEW VERSION can still revive the deal.
 *
 * Reuses the shared accessible `Dialog` (role="dialog" + focus trap) and the 6.2/6.4 `useActionState`
 * banner pattern. Every control has an accessible name; the lost state is conveyed as TEXT (the
 * text-not-color status badge → "Förlorad/Avböjd"), never by color alone (WCAG 1.4.1).
 */
import { useActionState, useState } from "react";
import { Dialog } from "@/components/crm/Dialog";
import { markQuoteVersionLostAction } from "@/features/quotes/actions";
import {
  LOST_ACTION_INITIAL,
  isRetryableLostError,
} from "@/features/quotes/lost-action-state";

export interface MarkLostButtonProps {
  readonly quoteId: string;
  readonly quoteVersionId: string;
  /**
   * Story 10.3 — the auto-complete-on-lost seam (Task 5.5). When this mark-lost affordance is offered
   * on the FOLLOW-UP surface (a sent version carrying an OPEN follow-up), the open follow-up id is
   * carried as a hidden field so `markQuoteVersionLostAction` auto-completes it with the chosen
   * förlorad/avböjd outcome after the lost flip succeeds. Absent on the standalone lost dialog — 10.2's
   * behavior is byte-unchanged when no follow-up id is carried.
   */
  readonly followUpId?: string;
}

/** The strawman category options (ASCII machine token → Swedish UI label). */
const CATEGORY_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "pris", label: "Pris" },
  { value: "konkurrent", label: "Konkurrent" },
  { value: "tidplan", label: "Tidplan" },
  { value: "uteblivet_svar", label: "Uteblivet svar" },
  { value: "annat", label: "Annat" },
];

export function MarkLostButton({ quoteId, quoteVersionId, followUpId }: MarkLostButtonProps) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [state, formAction, pending] = useActionState(
    markQuoteVersionLostAction,
    LOST_ACTION_INITIAL,
  );
  const retryable = isRetryableLostError(state);

  // NOTE: no explicit "close on success" effect is needed — on a successful flip the page revalidates
  // and this whole affordance (rendered ONLY on a sent version) unmounts as the version becomes `lost`.

  // The note is REQUIRED when the category is `Annat` (mirrors the server validator). Confirm is
  // blocked until an outcome + a valid reason (category + a note when Annat) are supplied.
  const noteRequired = category === "annat";
  const noteMissing = noteRequired && note.trim().length === 0;
  const confirmDisabled =
    pending || outcome.length === 0 || category.length === 0 || noteMissing;

  return (
    <div
      data-testid="mark-lost-section"
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-zinc-900">Förlorad/Avböjd</h3>
      </div>
      <p className="text-sm text-zinc-600">
        Markera den skickade offertversionen som förlorad eller avböjd med en strukturerad
        orsak. Detta ändrar inte det skickade underlaget — det registrerar en livscykelhändelse.
      </p>

      {state.status === "error" && state.formError && (
        <p role="alert" data-testid="mark-lost-error" className="text-sm text-red-800">
          {state.formError}
        </p>
      )}
      {retryable && (
        <p role="status" className="text-sm text-amber-800">
          Försök igen.
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          data-testid="mark-lost-open"
          onClick={() => setOpen(true)}
          className="rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-900 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
        >
          Markera som förlorad/avböjd
        </button>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Markera som förlorad/avböjd"
      >
        <form
          action={formAction}
          data-testid="mark-lost-form"
          className="flex flex-col gap-4"
          noValidate
        >
          <input type="hidden" name="quote_id" value={quoteId} />
          <input type="hidden" name="quote_version_id" value={quoteVersionId} />
          {/* Story 10.3 — carry the OPEN follow-up id so the lost flip auto-completes it (Task 5.5).
              Omitted on the standalone dialog, so 10.2's behavior is byte-unchanged without it. */}
          {followUpId && (
            <input type="hidden" name="follow_up_id" value={followUpId} />
          )}

          {/* Outcome — a required radio group (Förlorad / Avböjd). */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-zinc-800">Utfall</legend>
            <label className="flex items-center gap-2 text-sm text-zinc-900">
              <input
                type="radio"
                name="outcome"
                value="forlorad"
                checked={outcome === "forlorad"}
                onChange={(e) => setOutcome(e.target.value)}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
              />
              Förlorad
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-900">
              <input
                type="radio"
                name="outcome"
                value="avbojd"
                checked={outcome === "avbojd"}
                onChange={(e) => setOutcome(e.target.value)}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
              />
              Avböjd
            </label>
          </fieldset>

          {/* Category — a required select from the strawman list. */}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700">Orsak</span>
            <select
              name="category"
              data-testid="mark-lost-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
            >
              <option value="">Välj orsak…</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          {/* Note — free text; REQUIRED when the category is Annat. */}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700">
              Notering{noteRequired ? " (krävs för Annat)" : " (valfritt)"}
            </span>
            <textarea
              name="note"
              data-testid="mark-lost-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-required={noteRequired ? "true" : undefined}
              className="rounded-md border border-zinc-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
            />
          </label>

          {/* Explicit confirmation copy: append-only, snapshot-unchanged, revive-via-new-version. */}
          <p
            data-testid="mark-lost-confirm-copy"
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            Detta är en spårbar, tilläggsbaserad livscykelhändelse. Det ändrar inte det skickade
            underlaget — offert-snapshoten är oförändrad — och du kan återuppliva affären genom att
            skapa en ny version.
          </p>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={confirmDisabled}
              data-testid="mark-lost-confirm"
              className="rounded-md bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 disabled:opacity-60"
            >
              {pending ? "Markerar…" : "Bekräfta"}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
