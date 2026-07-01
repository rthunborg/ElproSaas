/**
 * Shared form-action state contract for the settings server actions (Story 3.3,
 * Task 4.4). Mirrors the CRM `CrmActionState` shape EXACTLY (the established 3.2
 * pattern) so the settings forms reuse the same `useActionState` + FormField a11y
 * wiring without reinventing a mechanism.
 *
 * It maps the settings command's typed `Result` to a UI-renderable shape WITHOUT
 * leaking internal detail:
 *   - `ok` → the form shows a saved affordance and the page revalidates.
 *   - a `VALIDATION_FAILED` → field-level errors + a top-of-form summary, and the
 *     submitted `values` are echoed back so the form PRESERVES input (AC4).
 *   - a `TENANT_ACCESS_DENIED` / auth failure → a generic Swedish `formError` (never
 *     reveals another tenant's data).
 *   - a transient `SERVER_ERROR` → a RETRYABLE failure, surfaced as such — NEVER a
 *     permanent access denial.
 *
 * NO raw input, stack, SQL, or tenant/user-existence signal is ever put here.
 */
import type { CommandErrorCode } from "@/server/commands/command-errors";

/** The status discriminant of a settings action result. */
export type SettingsActionStatus = "idle" | "success" | "error";

/** The state `useActionState` carries for a settings form. */
export interface SettingsActionState {
  readonly status: SettingsActionStatus;
  /** The stable error code (when status === "error"); null otherwise. */
  readonly code: CommandErrorCode | null;
  /** A generic, user-safe top-of-form message (blocking error summary). */
  readonly formError: string | null;
  /** Per-field validation messages keyed by form field name (VALIDATION_FAILED only). */
  readonly fieldErrors: Readonly<Record<string, string>>;
  /** The submitted values echoed back so the form preserves input on failure (AC4). */
  readonly values: Readonly<Record<string, string>>;
  /** The affected row id on success (lets the caller refresh/close). */
  readonly targetId: string | null;
}

/** The initial, pristine action state. */
export const SETTINGS_ACTION_INITIAL: SettingsActionState = {
  status: "idle",
  code: null,
  formError: null,
  fieldErrors: {},
  values: {},
  targetId: null,
};

/** True iff the action result represents a transient, retryable failure. */
export function isRetryableSettingsError(state: SettingsActionState): boolean {
  return state.status === "error" && state.code === "SERVER_ERROR";
}

/**
 * The inputs to the quote-terms SIGN-OFF precedence resolution. The three signals are
 * the server-read approval state and the two in-session action outcomes (a terms TEXT
 * save and a deliberate APPROVE). This is the load-bearing state machine for the HARD
 * STOP-CONDITION (AC2), pulled out of the React component so it can be exhaustively
 * unit-tested WITHOUT a browser.
 */
export interface SignoffInputs {
  /** The server-read approval instant (null = not approved when the page loaded). */
  readonly serverApprovedAt: string | null;
  /** True iff a terms TEXT save succeeded this session (it RESETS approval). */
  readonly justSavedText: boolean;
  /** True iff the deliberate APPROVE action succeeded this session. */
  readonly justApproved: boolean;
}

/**
 * Resolve whether the quote-terms editor should render the APPROVED status (true) or
 * the not-approved WARNING (false), from the three sign-off signals.
 *
 * The precedence is LOAD-BEARING (a fixed regression — pin it so it can't drift):
 *   1. A successful deliberate APPROVE ALWAYS wins — it is the ONLY path to approved,
 *      so it takes precedence over EVERYTHING, including a prior in-session text save.
 *   2. Otherwise a terms TEXT save this session resets approval to not-approved (the
 *      command resets `approved_at`), so it SUPPRESSES a stale server-approved state.
 *   3. Otherwise fall back to the server-read approval state.
 *
 * The regression this guards: server-approved → edit (text save) → approve must render
 * APPROVED. A naive `justSavedText` guard that ran AFTER the approve check would let a
 * lingering text-save success suppress the freshly-approved view — that is forbidden.
 */
export function resolveTermsApproved(inputs: SignoffInputs): boolean {
  if (inputs.justApproved) return true;
  if (inputs.justSavedText) return false;
  return inputs.serverApprovedAt !== null;
}
