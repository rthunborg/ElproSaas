"use client";

/**
 * Archive affordance (Story 3.2, Task 4.3) — soft-delete via the 3.1 archive commands.
 *
 * The UI offers "Arkivera", NEVER "Radera/Delete" (no hard delete exists or is granted —
 * the migration withholds DELETE; archive sets `archived_at`). It confirms the action
 * (it removes the row from the default active list), submits the id-only form to the
 * matching archive server action, and on success calls `onArchived` so the caller can
 * refresh/navigate (the row then leaves the active list).
 *
 * A `SERVER_ERROR` is surfaced as a RETRYABLE failure (not a permanent denial); a
 * denial is a generic message. The mutation authority is the 3.1 envelope command.
 */
import { useActionState, useEffect, useState } from "react";
import {
  archiveContactAction,
  archiveCustomerAction,
  archiveFacilityAction,
} from "@/features/crm/actions";
import { CRM_ACTION_INITIAL } from "@/features/crm/action-state";

type ArchiveKind = "customer" | "facility" | "contact";

const ACTION_BY_KIND = {
  customer: archiveCustomerAction,
  facility: archiveFacilityAction,
  contact: archiveContactAction,
} as const;

export function ArchiveButton({
  kind,
  id,
  customerId,
  label,
  confirmMessage,
  onArchived,
  compact = false,
}: {
  readonly kind: ArchiveKind;
  readonly id: string;
  /** The parent customer id (facility/contact) for revalidation targeting. */
  readonly customerId?: string;
  /** Accessible name for the control (icon-only when compact). */
  readonly label: string;
  readonly confirmMessage: string;
  readonly onArchived: () => void;
  readonly compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    ACTION_BY_KIND[kind],
    CRM_ACTION_INITIAL,
  );
  const [confirming, setConfirming] = useState(false);

  // On a successful archive, hand control back to the caller (which refreshes/navigates,
  // unmounting or re-rendering this control). Only the parent callback runs here — no
  // local setState in the effect body (the row leaves the active list on revalidation).
  useEffect(() => {
    if (state.status === "success") onArchived();
  }, [state.status, onArchived]);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={label}
        className={
          compact
            ? "text-sm font-medium text-red-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
            : "rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
        }
      >
        Arkivera
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      {customerId && <input type="hidden" name="customer_id" value={customerId} />}
      <p role="status" className="text-xs text-zinc-700">
        {confirmMessage}
      </p>
      {state.status === "error" && (
        <p role="alert" className="text-xs text-red-700">
          {state.formError}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Avbryt
        </button>
        <button
          type="submit"
          disabled={pending}
          aria-label={label}
          className="rounded-md bg-red-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-60"
        >
          {pending ? "Arkiverar…" : "Arkivera"}
        </button>
      </div>
    </form>
  );
}
