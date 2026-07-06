/**
 * Story 6.5 — the new-version server-action state contract (Task 4.2).
 *
 * The `useActionState` shape for the "Skapa ny version" affordance on a READ-ONLY (sent/…)
 * version. Maps the `createNewQuoteVersion` command's typed `Result` to a UI-renderable shape
 * WITHOUT leaking internal detail:
 *   - `ok` → a NEW draft version is created on the same quote; the parent detail + the NEW version
 *     subroute revalidate; the returned `targetId` is the NEW draft version id so the UI can land
 *     the admin on the editable new draft (a success banner is announced via role="status").
 *   - `VALIDATION_FAILED` → the parent was a draft (a new version off a draft is a no-op) or the
 *     re-captured source was uncomputable → a generic non-final message.
 *   - `QUOTE_VERSION_LOCKED` → an illegal below-command state slipped through → a generic message.
 *   - `TENANT_ACCESS_DENIED` / auth failure → a generic Swedish `formError`.
 *   - a transient `SERVER_ERROR` → a RETRYABLE failure.
 *
 * Mirrors `mark-sent-action-state.ts` so the affordance reuses the same a11y/error wiring without
 * inventing a mechanism. NO raw input, stack, SQL, or tenant/user-existence signal here.
 */
import type { CommandErrorCode } from "@/server/commands/command-errors";

/** The status discriminant of a new-version action result. */
export type NewVersionActionStatus = "idle" | "success" | "error";

/** The state `useActionState` carries for the new-version affordance. */
export interface NewVersionActionState {
  readonly status: NewVersionActionStatus;
  /** The stable error code (when status === "error"); null otherwise. */
  readonly code: CommandErrorCode | null;
  /** A generic, user-safe message. */
  readonly formError: string | null;
  /** The NEW draft version id on success (the version to land the admin on). */
  readonly targetId: string | null;
}

/** The initial, pristine new-version state. */
export const NEW_VERSION_ACTION_INITIAL: NewVersionActionState = {
  status: "idle",
  code: null,
  formError: null,
  targetId: null,
};

/** True iff the new-version result is a transient, retryable failure. */
export function isRetryableNewVersionError(state: NewVersionActionState): boolean {
  return state.status === "error" && state.code === "SERVER_ERROR";
}
