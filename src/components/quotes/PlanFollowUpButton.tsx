"use client";

/**
 * Plan-follow-up affordance (Story 10.3, Task 5.1 / AC1) — the `Planera uppföljning` dialog. Rendered
 * on a SENT version (via `FollowUpPanel`) when the quote has NO open follow-up. Opens an
 * explicit-confirm dialog taking a DUE DATE + an optional note; confirm stays disabled until a due
 * date is supplied. Wires to `planQuoteFollowUpAction` → the `planQuoteFollowUp` command (never a
 * bespoke path).
 *
 * ── UI IS THE MIRROR, NOT THE GUARANTEE ───────────────────────────────────────────────────────────
 * The one-open-per-quote rule is DB-enforced (the partial unique index → a clear VALIDATION_FAILED);
 * this dialog is a convenience. Only `quote_version_id` + `due_date` + optional `note` are submitted —
 * tenant/status/quote_id are NEVER accepted from the form (the command derives quote_id from the
 * loaded anchor version). On success the page revalidates and the header renders the next-follow-up
 * chip; the dialog closes.
 *
 * Reuses the shared accessible `Dialog` + the 6.2/10.2 `useActionState` banner pattern. Every control
 * has an accessible name; the note is optional (labelled as such).
 */
import { useActionState, useEffect, useState } from "react";
import { Dialog } from "@/components/crm/Dialog";
import { planQuoteFollowUpAction } from "@/features/quotes/actions";
import {
  FOLLOW_UP_ACTION_INITIAL,
  isRetryableFollowUpError,
} from "@/features/quotes/follow-up-action-state";
import { calendarDayIn } from "@/features/quotes/follow-up-dates";

export interface PlanFollowUpButtonProps {
  readonly quoteId: string;
  readonly quoteVersionId: string;
  /** Optional: the panel is re-planning after a completion ("planera nästa") — auto-open the dialog. */
  readonly autoOpen?: boolean;
  /** Optional: notify the panel when a plan succeeds (so it can leave the "planera nästa" state). */
  readonly onPlanned?: () => void;
}

export function PlanFollowUpButton({
  quoteId,
  quoteVersionId,
  autoOpen = false,
  onPlanned,
}: PlanFollowUpButtonProps) {
  const [open, setOpen] = useState(autoOpen);
  const [dueDate, setDueDate] = useState<string>("");
  // The MINIMUM selectable due date: "today in Europe/Stockholm" (the same boundary the server rejects
  // a past due_date on — FOLLOW_UP_DUE_DATE_IN_PAST). Computed inline (cheap Intl call); the server
  // command is the authority, this `min` is a UX nicety that only fences the picker client-side.
  const minDate = calendarDayIn(new Date(), "Europe/Stockholm");
  const [state, formAction, pending] = useActionState(
    planQuoteFollowUpAction,
    FOLLOW_UP_ACTION_INITIAL,
  );
  // Hide a stale error/retry banner once the dialog is closed so reopening starts clean — the
  // `useActionState` error persists across close/reopen, so without this flag a prior failed plan's
  // banner would re-appear on the next open (iteration-2 review). Re-armed ONLY by a new SUBMIT below.
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const retryable = isRetryableFollowUpError(state);

  // Notify the parent panel on a successful plan (it leaves the "planera nästa" state). The dialog is
  // CLOSED by DERIVING its open state from the success result (no setState-in-effect) — on success the
  // page revalidates and the header renders the next-follow-up chip.
  useEffect(() => {
    if (state.status === "success") onPlanned?.();
  }, [state.status, onPlanned]);

  const dialogOpen = open && state.status !== "success";
  const confirmDisabled = pending || dueDate.length === 0;

  // Close + reset the local due-date field AND retire the stale banner. Cancel-mid-flight is blocked on
  // EVERY path: Avbryt is disabled while `pending`, and the Dialog's Escape/backdrop/X close paths are
  // gated by `busy={pending}` — so no plan request lands after this close.
  const closeDialog = () => {
    setOpen(false);
    setDueDate("");
    setBannerDismissed(true);
  };

  return (
    <div
      data-testid="plan-follow-up-section"
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-zinc-900">Uppföljning</h3>
      </div>
      <p className="text-sm text-zinc-600">
        Planera en uppföljning på den skickade offerten så att affären bearbetas och beslutas i tid.
      </p>

      <div className="flex justify-end">
        <button
          type="button"
          data-testid="plan-follow-up-open"
          onClick={() => setOpen(true)}
          className="rounded-md border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Planera uppföljning
        </button>
      </div>

      <Dialog open={dialogOpen} onClose={closeDialog} busy={pending} title="Planera uppföljning">
        <form
          action={formAction}
          onSubmit={() => setBannerDismissed(false)}
          data-testid="plan-follow-up-form"
          className="flex flex-col gap-4"
          noValidate
        >
          <input type="hidden" name="quote_id" value={quoteId} />
          <input type="hidden" name="quote_version_id" value={quoteVersionId} />

          {/*
           * The error / retry feedback MUST live INSIDE the Dialog form. On a failed submit the
           * dialog stays open (`dialogOpen` is true whenever status !== "success"), and the shared
           * Dialog paints a fixed `inset-0 z-50` overlay over the page. A banner rendered in the
           * section body behind that overlay is in the DOM but occluded — the AC1 "clear message"
           * would be invisible exactly when it matters. Rendering it here keeps it above the overlay
           * (inside the `z-10` panel), so the message is actually seen on error.
           */}
          {!bannerDismissed && state.status === "error" && state.formError && (
            <p role="alert" data-testid="plan-follow-up-error" className="text-sm text-red-800">
              {state.formError}
            </p>
          )}
          {!bannerDismissed && retryable && (
            <p role="status" className="text-sm text-amber-800">
              Försök igen.
            </p>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700">Förfallodatum</span>
            <input
              type="date"
              name="due_date"
              data-testid="plan-follow-up-due-date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={minDate}
              aria-required="true"
              className="rounded-md border border-zinc-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700">Notering (valfritt)</span>
            <textarea
              name="note"
              data-testid="plan-follow-up-note"
              rows={2}
              className="rounded-md border border-zinc-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeDialog}
              disabled={pending}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={confirmDisabled}
              data-testid="plan-follow-up-confirm"
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
            >
              {pending ? "Planerar…" : "Planera"}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
