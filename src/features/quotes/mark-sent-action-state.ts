/**
 * Story 6.4 — the mark-sent server-action state contract (Task 5.1/5.2).
 *
 * The `useActionState` shape for the "Markera som skickad" affordance on a DRAFT version. Maps
 * the `markQuoteVersionSent` command's typed `Result` to a UI-renderable shape WITHOUT leaking
 * internal detail:
 *   - `ok` → the version flips to `sent`; the detail + version subroute revalidate and re-render
 *     the read-only branch (a success banner is announced via role="status").
 *   - `QUOTE_VERSION_LOCKED` → the version is already sent (locked since load) → a generic
 *     "create a new version" framed message.
 *   - `VALIDATION_FAILED` → the version has BLOCKING readiness issues (unsendable) → a generic
 *     non-final message (never a leaked blocker detail).
 *   - `TENANT_ACCESS_DENIED` / auth failure → a generic Swedish `formError`.
 *   - a transient `SERVER_ERROR` → a RETRYABLE failure.
 *
 * Mirrors the 6.3 `pdf-action-state.ts` shape so the affordance reuses the same a11y/error wiring
 * without inventing a mechanism. NO raw input, stack, SQL, or tenant/user-existence signal here.
 */
import type { CommandErrorCode } from "@/server/commands/command-errors";

/** The status discriminant of a mark-sent action result. */
export type MarkSentActionStatus = "idle" | "success" | "error";

/** The state `useActionState` carries for the mark-sent affordance. */
export interface MarkSentActionState {
  readonly status: MarkSentActionStatus;
  /** The stable error code (when status === "error"); null otherwise. */
  readonly code: CommandErrorCode | null;
  /** A generic, user-safe message. */
  readonly formError: string | null;
  /** The affected version id on success. */
  readonly targetId: string | null;
}

/** The initial, pristine mark-sent state. */
export const MARK_SENT_ACTION_INITIAL: MarkSentActionState = {
  status: "idle",
  code: null,
  formError: null,
  targetId: null,
};

/** True iff the mark-sent result is a transient, retryable failure. */
export function isRetryableMarkSentError(state: MarkSentActionState): boolean {
  return state.status === "error" && state.code === "SERVER_ERROR";
}
