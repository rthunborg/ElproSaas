"use client";

/**
 * Complete-follow-up affordance (Story 10.3, Task 5.2 / AC3) — the `Klarmarkera` completion sheet.
 * Rendered on a SENT version (via `FollowUpPanel`) when the quote has an OPEN follow-up. Opens an
 * explicit-confirm dialog taking a REQUIRED outcome note; confirm stays disabled until an outcome is
 * supplied.
 *
 * PRESENTATIONAL: the `completeQuoteFollowUpAction` `useActionState` lives in the ALWAYS-MOUNTED
 * `FollowUpPanel` (the parent), which passes `formAction`/`state`/`pending` down. This is load-bearing:
 * on a successful completion the page revalidates and the open follow-up becomes completed, so this
 * sheet UNMOUNTS — if the success detector lived here it would never fire the "show the decide-here
 * jumps" transition. The parent owns that detection so the jumps reliably render.
 *
 * Only `follow_up_id` + `outcome` are submitted — tenant/status are NEVER accepted from the form (the
 * command re-asserts the open-only predicate + stamps completed_at with the injected clock).
 */
import { useState } from "react";
import { Dialog } from "@/components/crm/Dialog";
import {
  isRetryableFollowUpError,
  type FollowUpActionState,
} from "@/features/quotes/follow-up-action-state";

export interface FollowUpSheetProps {
  readonly quoteId: string;
  readonly quoteVersionId: string;
  readonly followUpId: string;
  /** The completion action + state, owned by the always-mounted parent panel. */
  readonly formAction: (formData: FormData) => void;
  readonly state: FollowUpActionState;
  readonly pending: boolean;
  /**
   * Start with the completion dialog already open. Mirrors `PlanFollowUpButton`'s `autoOpen`; the
   * live panel never sets it (the sheet opens on the `Klarmarkera` click), so this is a deterministic
   * render seam for the error-visibility test (which must render the dialog-open error state).
   */
  readonly autoOpen?: boolean;
}

export function FollowUpSheet({
  quoteId,
  quoteVersionId,
  followUpId,
  formAction,
  state,
  pending,
  autoOpen = false,
}: FollowUpSheetProps) {
  const [open, setOpen] = useState(autoOpen);
  const [outcome, setOutcome] = useState<string>("");
  const retryable = isRetryableFollowUpError(state);

  // Close the dialog by DERIVING its open state from the success result (no setState-in-effect); on
  // success the parent transitions to the decide-here jumps and this sheet unmounts.
  const dialogOpen = open && state.status !== "success";
  const confirmDisabled = pending || outcome.trim().length === 0;

  // Close + reset the local outcome field. Cancel-mid-flight is blocked (Avbryt is disabled while
  // `pending`) so no completion request lands after this close.
  const closeDialog = () => {
    setOpen(false);
    setOutcome("");
  };

  return (
    <div
      data-testid="complete-follow-up-section"
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-zinc-900">Uppföljning</h3>
      </div>
      <p className="text-sm text-zinc-600">
        Det finns en öppen uppföljning på offerten. Klarmarkera den med ett utfall när den är avslutad.
      </p>

      <div className="flex justify-end">
        <button
          type="button"
          data-testid="complete-follow-up-open"
          onClick={() => setOpen(true)}
          className="rounded-md border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Klarmarkera
        </button>
      </div>

      <Dialog open={dialogOpen} onClose={closeDialog} title="Klarmarkera uppföljning">
        <form
          action={formAction}
          data-testid="complete-follow-up-form"
          className="flex flex-col gap-4"
          noValidate
        >
          <input type="hidden" name="quote_id" value={quoteId} />
          <input type="hidden" name="quote_version_id" value={quoteVersionId} />
          <input type="hidden" name="follow_up_id" value={followUpId} />

          {/*
           * The error / retry feedback MUST live INSIDE the Dialog form. On a failed completion (the
           * reachable "Uppföljningen är redan avslutad." race, or a transient SERVER_ERROR) the dialog
           * stays open (`dialogOpen` is true whenever status !== "success"), and the shared Dialog
           * paints a fixed `inset-0 z-50` overlay over the page. A banner in the section body behind
           * that overlay is in the DOM but occluded — the AC3 "clear message" would be invisible
           * exactly when it matters. Rendering it here keeps it above the overlay (inside the `z-10`
           * panel), so the message is actually seen on error.
           */}
          {state.status === "error" && state.formError && (
            <p role="alert" data-testid="complete-follow-up-error" className="text-sm text-red-800">
              {state.formError}
            </p>
          )}
          {retryable && (
            <p role="status" className="text-sm text-amber-800">
              Försök igen.
            </p>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700">Utfall</span>
            <textarea
              name="outcome"
              data-testid="complete-follow-up-outcome"
              rows={2}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              maxLength={4000}
              aria-required="true"
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
              data-testid="complete-follow-up-confirm"
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
            >
              {pending ? "Klarmarkerar…" : "Bekräfta"}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
