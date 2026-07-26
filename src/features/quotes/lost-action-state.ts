/**
 * Story 10.2 — the mark-lost server-action state contract (Task 5.2).
 *
 * The `useActionState` shape for the "Markera som förlorad/avböjd" dialog on a SENT version. Maps
 * the `markQuoteVersionLost` command's typed `Result` to a UI-renderable shape WITHOUT leaking
 * internal detail:
 *   - `ok` → the version flips to `lost`; the detail + version subroute revalidate and re-render
 *     the terminal Förlorad/Avböjd state (a success banner is announced via role="status").
 *   - `QUOTE_VERSION_LOCKED` → the version is no longer sent (already lost/terminal, a race) → a
 *     generic "create a new version" framed message.
 *   - `VALIDATION_FAILED` → the version is not in a state that can be marked lost, OR the reason was
 *     malformed (missing outcome/category, or an empty note on `Annat`) — a generic non-leaking message.
 *   - `TENANT_ACCESS_DENIED` / auth failure → a generic Swedish `formError`.
 *   - a transient `SERVER_ERROR` → a RETRYABLE failure.
 *
 * Mirrors the 6.4 `mark-sent-action-state.ts` shape so the affordance reuses the same a11y/error
 * wiring without inventing a mechanism. NO raw input, stack, SQL, or tenant/user-existence signal
 * here — and NEVER the outcome/category/note free text (possible PII).
 */
import type { CommandErrorCode } from "@/server/commands/command-errors";

/** The status discriminant of a mark-lost action result. */
export type LostActionStatus = "idle" | "success" | "error";

/** The state `useActionState` carries for the mark-lost affordance. */
export interface LostActionState {
  readonly status: LostActionStatus;
  /** The stable error code (when status === "error"); null otherwise. */
  readonly code: CommandErrorCode | null;
  /** A generic, user-safe message. */
  readonly formError: string | null;
  /** The affected version id on success. */
  readonly targetId: string | null;
}

/** The initial, pristine mark-lost state. */
export const LOST_ACTION_INITIAL: LostActionState = {
  status: "idle",
  code: null,
  formError: null,
  targetId: null,
};

/** True iff the mark-lost result is a transient, retryable failure. */
export function isRetryableLostError(state: LostActionState): boolean {
  return state.status === "error" && state.code === "SERVER_ERROR";
}
