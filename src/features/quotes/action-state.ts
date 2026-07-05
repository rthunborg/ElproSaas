/**
 * Shared form-action state contract for the quote-detail draft-edit server action (Story 6.2,
 * Task 3.3). Mirrors the calc/CRM `*ActionState` shape (the established `useActionState`
 * pattern) so the draft-edit form reuses the same a11y wiring without reinventing a mechanism.
 *
 * It maps the draft-edit command's typed `Result` to a UI-renderable shape WITHOUT leaking
 * internal detail:
 *   - `ok` → the form shows a saved affordance and the detail path revalidates.
 *   - `VALIDATION_FAILED` → a top-of-form summary; the submitted `values` echo back so the form
 *     PRESERVES input.
 *   - `QUOTE_VERSION_NOT_DRAFT` → the version is no longer a draft (sent since load) → a generic
 *     "create a new version" framed message (never a permanent access denial).
 *   - `TENANT_ACCESS_DENIED` / auth failure → a generic Swedish `formError`.
 *   - a transient `SERVER_ERROR` → a RETRYABLE failure, surfaced as such.
 *
 * NO raw input, stack, SQL, or tenant/user-existence signal is ever put here.
 */
import type { CommandErrorCode } from "@/server/commands/command-errors";

/** The status discriminant of a draft-edit action result. */
export type QuoteActionStatus = "idle" | "success" | "error";

/** The state `useActionState` carries for the draft-edit form. */
export interface QuoteActionState {
  readonly status: QuoteActionStatus;
  /** The stable error code (when status === "error"); null otherwise. */
  readonly code: CommandErrorCode | null;
  /** A generic, user-safe top-of-form message. */
  readonly formError: string | null;
  /** The submitted values echoed back so the form preserves input on failure. */
  readonly values: Readonly<Record<string, string>>;
  /** The affected version id on success. */
  readonly targetId: string | null;
}

/** The initial, pristine action state. */
export const QUOTE_ACTION_INITIAL: QuoteActionState = {
  status: "idle",
  code: null,
  formError: null,
  values: {},
  targetId: null,
};

/** True iff the action result represents a transient, retryable failure. */
export function isRetryableQuoteError(state: QuoteActionState): boolean {
  return state.status === "error" && state.code === "SERVER_ERROR";
}
