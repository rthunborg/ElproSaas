/**
 * Story 10.3 — the follow-up server-action state contract (Task 5.4).
 *
 * The `useActionState` shape shared by the plan / complete / annotate follow-up affordances. Maps a
 * follow-up command's typed `Result` to a UI-renderable shape WITHOUT leaking internal detail:
 *   - `ok` → the follow-up was planned/completed/annotated; the detail + version subroute revalidate
 *     and re-render (the chip / completion sheet update).
 *   - `VALIDATION_FAILED` → a clear, command-supplied message (e.g. "En öppen uppföljning finns redan
 *     för offerten." on a second-open, or "Uppföljningen är redan avslutad." on an already-completed
 *     row) — never a raw DB error.
 *   - `TENANT_ACCESS_DENIED` / auth failure → a generic Swedish `formError`.
 *   - a transient `SERVER_ERROR` → a RETRYABLE failure.
 *
 * Mirrors the 10.2 `lost-action-state.ts` shape so the affordance reuses the same a11y/error wiring
 * without inventing a mechanism. NO raw input, stack, SQL, or tenant/user-existence signal here — and
 * NEVER the note/outcome free text (possible PII).
 */
import type { CommandErrorCode } from "@/server/commands/command-errors";

/** The status discriminant of a follow-up action result. */
export type FollowUpActionStatus = "idle" | "success" | "error";

/** The state `useActionState` carries for the plan / complete / annotate affordances. */
export interface FollowUpActionState {
  readonly status: FollowUpActionStatus;
  /** The stable error code (when status === "error"); null otherwise. */
  readonly code: CommandErrorCode | null;
  /** A generic (or command-supplied clear) user-safe message. */
  readonly formError: string | null;
  /** The affected follow-up id on success. */
  readonly targetId: string | null;
}

/** The initial, pristine follow-up action state. */
export const FOLLOW_UP_ACTION_INITIAL: FollowUpActionState = {
  status: "idle",
  code: null,
  formError: null,
  targetId: null,
};

/** True iff the follow-up result is a transient, retryable failure. */
export function isRetryableFollowUpError(state: FollowUpActionState): boolean {
  return state.status === "error" && state.code === "SERVER_ERROR";
}
