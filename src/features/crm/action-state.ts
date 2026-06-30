/**
 * Shared form-action state contract for the CRM server actions (Story 3.2, Task 4.2).
 *
 * The React 19 `useActionState` + Next 16 server-action pattern returns this typed
 * state on every submit. It maps the 3.1 command's typed `Result` to a UI-renderable
 * shape WITHOUT leaking internal detail:
 *
 *   - `ok` → the dialog closes and the list/detail revalidates.
 *   - a `VALIDATION_FAILED` → field-level errors + a top-of-form summary, and the
 *     submitted `values` are echoed back so the form PRESERVES the user's input
 *     (AC3: never clear the form on a validation failure).
 *   - a `TENANT_ACCESS_DENIED` / `SERVER_ERROR` / auth failure → a generic Swedish
 *     `formError` (the command's user-safe message). A transient `SERVER_ERROR` is a
 *     RETRYABLE failure, surfaced as such — NEVER a permanent access denial.
 *
 * The error `code` is carried through so the client can present a retryable failure
 * (`SERVER_ERROR`) differently from a denial without re-deriving it. NO raw input,
 * stack, SQL, or tenant/user-existence signal is ever put here.
 */
import type { CommandErrorCode } from "@/server/commands/command-errors";

/** The status discriminant of a CRM action result. */
export type CrmActionStatus = "idle" | "success" | "error";

/** The state `useActionState` carries for a CRM create/update/archive form. */
export interface CrmActionState {
  readonly status: CrmActionStatus;
  /** The stable error code (when status === "error"); null otherwise. */
  readonly code: CommandErrorCode | null;
  /** A generic, user-safe top-of-form message (blocking error summary). */
  readonly formError: string | null;
  /**
   * Per-field validation messages keyed by the form field name. Only populated for a
   * VALIDATION_FAILED; the message is generic plain-Swedish (the command never echoes
   * the raw value). Drives `aria-invalid` + `aria-describedby` on each field.
   */
  readonly fieldErrors: Readonly<Record<string, string>>;
  /**
   * The submitted values echoed back so the form preserves input on a failed submit
   * (AC3). Keyed by field name; never carries a value the form did not submit.
   */
  readonly values: Readonly<Record<string, string>>;
  /** The created/updated/archived row id on success (lets the caller refresh/close). */
  readonly targetId: string | null;
}

/** The initial, pristine action state. */
export const CRM_ACTION_INITIAL: CrmActionState = {
  status: "idle",
  code: null,
  formError: null,
  fieldErrors: {},
  values: {},
  targetId: null,
};

/** True iff the action result represents a transient, retryable failure. */
export function isRetryableError(state: CrmActionState): boolean {
  return state.status === "error" && state.code === "SERVER_ERROR";
}
