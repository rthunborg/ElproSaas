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
}

export function FollowUpSheet({
  quoteId,
  quoteVersionId,
  followUpId,
  formAction,
  state,
  pending,
}: FollowUpSheetProps) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<string>("");
  const retryable = isRetryableFollowUpError(state);

  // Close the dialog by DERIVING its open state from the success result (no setState-in-effect); on
  // success the parent transitions to the decide-here jumps and this sheet unmounts.
  const dialogOpen = open && state.status !== "success";
  const confirmDisabled = pending || outcome.trim().length === 0;

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

      <Dialog open={dialogOpen} onClose={() => setOpen(false)} title="Klarmarkera uppföljning">
        <form
          action={formAction}
          data-testid="complete-follow-up-form"
          className="flex flex-col gap-4"
          noValidate
        >
          <input type="hidden" name="quote_id" value={quoteId} />
          <input type="hidden" name="quote_version_id" value={quoteVersionId} />
          <input type="hidden" name="follow_up_id" value={followUpId} />

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700">Utfall</span>
            <textarea
              name="outcome"
              data-testid="complete-follow-up-outcome"
              rows={2}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              aria-required="true"
              className="rounded-md border border-zinc-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
          </label>

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
