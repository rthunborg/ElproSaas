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
