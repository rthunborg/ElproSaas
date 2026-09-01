"use client";

/**
 * Create-new-version affordance (Story 6.5, Task 4.1 / AC1) — rendered ONLY in the READ-ONLY branch
 * of the quote detail (a sent/accepted/… version). A real keyboard-operable form button that wires
 * to `createNewQuoteVersionAction` → the `createNewQuoteVersion` command (never a bespoke path).
 * This ACTIVATES the button 6.2 rendered DISABLED (`data-testid="create-new-version"`) — the
 * affordance THIS story owns. On success a NEW draft version is created on the SAME quote and the
 * admin is navigated to the editable new draft (the DraftQuoteEditor + MarkSentButton branch).
 *
 * ── UI IS THE MIRROR, NOT THE GUARANTEE (a UI-only versioning rule is a STOP CONDITION) ────────
 * The button is a convenience; the SERVER command + the DB (the sent-lock trigger's immutability +
 * the version-number uniqueness) are the enforcement. Only `quote_version_id` (the parent) +
 * optional re-selected `attachment_file_ids` are submitted — status/tenant/totals are NEVER
 * accepted from the form. The prior sent version is PRESERVED (a change spawns a version).
 *
 * Reuses the 6.2/6.3/6.4 `useActionState` + `role="alert"`/`role="status"` banner pattern. Every
 * control has an accessible name + a visible focus ring; the version/status is conveyed as TEXT.
 */
import { useEffect } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createNewQuoteVersionAction } from "@/features/quotes/actions";
import {
  NEW_VERSION_ACTION_INITIAL,
  isRetryableNewVersionError,
} from "@/features/quotes/new-version-action-state";

export interface CreateNewVersionButtonProps {
  readonly quoteId: string;
  readonly quoteVersionId: string;
  /** Frozen predecessor attachments; the server keeps only currently eligible calc files. */
  readonly predecessorAttachments?: readonly {
    readonly fileId: string;
    readonly displayName: string | null;
  }[];
  /** Count only: the UI deliberately does not reveal which predecessor attachments were omitted. */
  readonly omittedPredecessorAttachmentCount?: number;
}

export function CreateNewVersionButton({
  quoteId,
  quoteVersionId,
  predecessorAttachments = [],
  omittedPredecessorAttachmentCount = 0,
}: CreateNewVersionButtonProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createNewQuoteVersionAction,
    NEW_VERSION_ACTION_INITIAL,
  );
  const retryable = isRetryableNewVersionError(state);

  // On success, navigate to the NEW draft version subroute so the admin lands on the editable new
  // draft (the action already revalidated BOTH the parent path + the new version subroute). The
  // new version id is the action's `targetId` (NOT the parent).
  useEffect(() => {
    if (state.status === "success" && state.targetId) {
      router.push(`/quotes/${quoteId}/versions/${state.targetId}`);
    }
  }, [state.status, state.targetId, quoteId, router]);

  return (
    <form
      action={formAction}
      data-testid="create-new-version-form"
      className="flex flex-col gap-3"
      noValidate
    >
      {state.status === "success" && (
        <p
          role="status"
          data-testid="create-new-version-status"
          className="text-sm text-green-800"
        >
          En ny version har skapats. Öppnar det redigerbara utkastet…
        </p>
      )}
      {state.status === "error" && state.formError && (
        <p
          role="alert"
          data-testid="create-new-version-error"
          className="text-sm text-red-800"
        >
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
      {predecessorAttachments.length > 0 && (
        <input type="hidden" name="attachment_selection_present" value="1" />
      )}

      {predecessorAttachments.length > 0 && (
        <fieldset className="rounded-md border border-zinc-200 p-3 text-sm">
          <legend className="px-1 font-medium text-zinc-800">Bilagor till den nya versionen</legend>
          <p className="mb-2 text-zinc-600">
            Bilagor som fortfarande kan följa med är förvalda.
          </p>
          {predecessorAttachments.map((attachment) => (
            <label key={attachment.fileId} className="flex items-center gap-2 py-1 text-zinc-800">
              <input
                type="checkbox"
                name="attachment_file_ids"
                value={attachment.fileId}
                defaultChecked
              />
              {attachment.displayName ?? "Bilaga"}
            </label>
          ))}
        </fieldset>
      )}
      {omittedPredecessorAttachmentCount > 0 && (
        <p
          data-testid="create-new-version-attachments-omitted"
          role="note"
          className="text-sm text-amber-800"
        >
          En eller flera tidigare bilagor är inte längre tillgängliga och följer inte med i den nya versionen.
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          data-testid="create-new-version"
          className="rounded-md border border-blue-700 bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
        >
          {pending ? "Skapar…" : "Skapa ny version"}
        </button>
      </div>
    </form>
  );
}
