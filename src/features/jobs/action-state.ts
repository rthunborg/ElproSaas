/**
 * Shared form-action state contract for the job allowed-edit server action (Story 7.3, Task 4.5).
 * Mirrors the quote/CRM `*ActionState` shape (the established `useActionState` pattern) so the
 * job edit form reuses the same a11y wiring without reinventing a mechanism.
 *
 * It maps the `updateJob` command's typed `Result` to a UI-renderable shape WITHOUT leaking
 * internal detail:
 *   - `ok` → the form shows a saved affordance and the detail + list paths revalidate.
 *   - `VALIDATION_FAILED` → a top-of-form summary; the submitted `values` echo back so the form
 *     PRESERVES input.
 *   - `TENANT_ACCESS_DENIED` / auth failure → a generic Swedish `formError`.
 *   - a transient `SERVER_ERROR` → a RETRYABLE failure, surfaced as such.
 *
 * NO raw input, stack, SQL, or tenant/user-existence signal is ever put here.
 */
import type { CommandErrorCode } from "@/server/commands/command-errors";

/** The status discriminant of a job-edit action result. */
export type JobActionStatus = "idle" | "success" | "error";

/** The state `useActionState` carries for the job edit form. */
export interface JobActionState {
  readonly status: JobActionStatus;
  /** The stable error code (when status === "error"); null otherwise. */
  readonly code: CommandErrorCode | null;
  /** A generic, user-safe top-of-form message. */
  readonly formError: string | null;
  /** The submitted values echoed back so the form preserves input on failure. */
  readonly values: Readonly<Record<string, string>>;
  /** The affected job id on success. */
  readonly targetId: string | null;
}

/** The initial, pristine action state. */
export const JOB_ACTION_INITIAL: JobActionState = {
  status: "idle",
  code: null,
  formError: null,
  values: {},
  targetId: null,
};

/** True iff the action result represents a transient, retryable failure. */
export function isRetryableJobError(state: JobActionState): boolean {
  return state.status === "error" && state.code === "SERVER_ERROR";
}
