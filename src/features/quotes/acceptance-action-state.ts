/**
 * Story 7.1 — the acceptance-capture server-action state contract (Task 6).
 *
 * The `useActionState` shape for the acceptance-capture form on a SENT version. Maps the
 * `captureQuoteAcceptance` command's typed `Result` to a UI-renderable shape WITHOUT leaking
 * internal detail:
 *   - `ok` → the acceptance is recorded; the detail + version subroute revalidate and re-render
 *     (a success banner is announced via role="status").
 *   - `VALIDATION_FAILED` → the version is not sendable-for-acceptance (non-sent state), OR an
 *     adjusted price was confirmed without an adjustment reason/evidence (the server re-validated
 *     the gate). A generic non-leaking message.
 *   - `TENANT_ACCESS_DENIED` → a foreign version / evidence file id → a generic Swedish message.
 *   - a transient `SERVER_ERROR` → a RETRYABLE failure.
 *
 * Mirrors the 6.4 `mark-sent-action-state.ts` shape so the affordance reuses the same a11y/error
 * wiring without inventing a mechanism. NO raw input, stack, SQL, or tenant/user-existence signal.
 */
import type { CommandErrorCode } from "@/server/commands/command-errors";

/** The status discriminant of an acceptance-capture action result. */
export type AcceptanceActionStatus = "idle" | "success" | "error";

/** The state `useActionState` carries for the acceptance-capture affordance. */
export interface AcceptanceActionState {
  readonly status: AcceptanceActionStatus;
  /** The stable error code (when status === "error"); null otherwise. */
  readonly code: CommandErrorCode | null;
  /** A generic, user-safe message. */
  readonly formError: string | null;
  /** The created acceptance id on success. */
  readonly targetId: string | null;
}

/** The initial, pristine acceptance-capture state. */
export const ACCEPTANCE_ACTION_INITIAL: AcceptanceActionState = {
  status: "idle",
  code: null,
  formError: null,
  targetId: null,
};

/** True iff the acceptance-capture result is a transient, retryable failure. */
export function isRetryableAcceptanceError(state: AcceptanceActionState): boolean {
  return state.status === "error" && state.code === "SERVER_ERROR";
}
