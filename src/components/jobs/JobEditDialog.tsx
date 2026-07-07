"use client";

/**
 * Job allowed-edit dialog (Story 7.3, Task 3.2 / AC4) — the minimal edit affordance exposing ONLY
 * the four Phase-A-safe fields: `title`, `status` (the CLOSED `created|in_progress|done|cancelled`
 * set — a select), `planned_start_date`, `planned_end_date`. NO edit control for any immutable
 * source/commitment field (UX-DR26). Wires to `updateJobAction` (the ONLY job write path).
 *
 * ── A11Y (AC2/AC4, epic-6 pattern) ─────────────────────────────────────────────────────────────
 * A native modal-ish dialog: opening moves focus INTO the dialog (the title input), closing removes
 * the dialog and RESTORES focus to the trigger button (predictable focus). Escape/Cancel closes.
 * Status is conveyed as TEXT (the select option labels), never color alone (WCAG 1.4.1). The status
 * select offers ONLY the closed Phase-A order lifecycle (created|in_progress|done|cancelled) — NO
 * field-worker states are present by construction.
 */
import { useActionState, useEffect, useRef, useState } from "react";
import { updateJobAction } from "@/features/jobs/actions";
import {
  JOB_ACTION_INITIAL,
  isRetryableJobError,
} from "@/features/jobs/action-state";
import {
  JOB_STATUSES,
  JOB_STATUS_LABELS,
  type JobStatus,
} from "@/features/jobs/types";

export interface JobEditDialogProps {
  readonly jobId: string;
  readonly title: string | null;
  readonly status: JobStatus;
  readonly plannedStartDate: string | null;
  readonly plannedEndDate: string | null;
}

export function JobEditDialog({
  jobId,
  title,
  status,
  plannedStartDate,
  plannedEndDate,
}: JobEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateJobAction,
    JOB_ACTION_INITIAL,
  );
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  // Move focus INTO the dialog on open (the title field) — predictable focus (epic-6 pattern).
  useEffect(() => {
    if (open) firstFieldRef.current?.focus();
  }, [open]);

  // On a successful save, close the dialog (the server-revalidated detail re-renders the new values).
  useEffect(() => {
    if (state.status === "success" && open) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  function close(): void {
    setOpen(false);
    // Restore focus to the trigger (predictable focus on close).
    triggerRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        ref={triggerRef}
        type="button"
        data-testid="job-edit-open"
        onClick={() => setOpen(true)}
        className="inline-flex w-fit items-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        Redigera jobb
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="job-edit-heading"
          data-testid="job-edit-dialog"
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
          className="flex flex-col gap-3 rounded-lg border border-zinc-300 bg-white p-4 shadow-sm"
        >
          <h3 id="job-edit-heading" className="text-sm font-semibold text-zinc-900">
            Redigera jobb
          </h3>

          {state.status === "error" && state.formError && (
            <p
              role="alert"
              data-testid="job-edit-error"
              className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {state.formError}
              {isRetryableJobError(state) ? " Försök igen." : ""}
            </p>
          )}

          <form action={formAction} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={jobId} />

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-700">Titel</span>
              <input
                ref={firstFieldRef}
                type="text"
                name="title"
                data-testid="job-edit-title"
                defaultValue={state.values.title ?? title ?? ""}
                className="rounded-md border border-zinc-300 px-2 py-1.5"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-700">Status</span>
              <select
                name="status"
                data-testid="job-edit-status"
                defaultValue={state.values.status ?? status}
                className="rounded-md border border-zinc-300 px-2 py-1.5"
              >
                {JOB_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {JOB_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-700">Planerat startdatum</span>
              <input
                type="date"
                name="planned_start_date"
                data-testid="job-edit-planned-start"
                defaultValue={state.values.planned_start_date ?? plannedStartDate ?? ""}
                className="rounded-md border border-zinc-300 px-2 py-1.5"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-700">Planerat slutdatum</span>
              <input
                type="date"
                name="planned_end_date"
                data-testid="job-edit-planned-end"
                defaultValue={state.values.planned_end_date ?? plannedEndDate ?? ""}
                className="rounded-md border border-zinc-300 px-2 py-1.5"
              />
            </label>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                data-testid="job-edit-save"
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                {pending ? "Sparar…" : "Spara"}
              </button>
              <button
                type="button"
                data-testid="job-edit-cancel"
                onClick={close}
                className="inline-flex items-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                Avbryt
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
