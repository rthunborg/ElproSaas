/**
 * Shared form-action state contract for the calculation editor server actions (Story 5.2,
 * Task 3.2). Mirrors the CRM/pricing `*ActionState` shape EXACTLY (the established
 * `useActionState` pattern) so the editor forms reuse the same FormField a11y wiring
 * without reinventing a mechanism.
 *
 * It maps the 5.1 command's typed `Result` to a UI-renderable shape WITHOUT leaking
 * internal detail:
 *   - `ok` → the form shows a saved affordance and the editor path revalidates.
 *   - a `VALIDATION_FAILED` → field-level errors + a top-of-form summary, and the
 *     submitted `values` are echoed back so the form PRESERVES input (AC2 — never clear
 *     the form on a validation failure).
 *   - a `TENANT_ACCESS_DENIED` / auth failure → a generic Swedish `formError`.
 *   - a transient `SERVER_ERROR` → a RETRYABLE failure, surfaced as such — NEVER a
 *     permanent access denial.
 *
 * NO raw input, stack, SQL, or tenant/user-existence signal is ever put here.
 */
import type { CommandErrorCode } from "@/server/commands/command-errors";

/** The status discriminant of a calc-editor action result. */
export type CalcActionStatus = "idle" | "success" | "error";

/**
 * Which editor sub-form produced the result — so the many forms on the one editor page can
 * share the action-state shape yet each render ONLY its own success/error. A section save
 * must not light up a row form's saved affordance.
 */
export type CalcFormKind =
  | "calculation"
  | "tax_input"
  | "section"
  | "row"
  | "reorder_sections"
  | "reorder_rows"
  | "archive_calculation"
  | "archive_section"
  | "archive_row";

/** The state `useActionState` carries for a calc-editor form. */
export interface CalcActionState {
  readonly status: CalcActionStatus;
  /** Which form produced this state (null when idle). */
  readonly form: CalcFormKind | null;
  /** The stable error code (when status === "error"); null otherwise. */
  readonly code: CommandErrorCode | null;
  /** A generic, user-safe top-of-form message (blocking error summary). */
  readonly formError: string | null;
  /** Per-field validation messages keyed by form field name (VALIDATION_FAILED only). */
  readonly fieldErrors: Readonly<Record<string, string>>;
  /** The submitted values echoed back so the form preserves input on failure (AC2). */
  readonly values: Readonly<Record<string, string>>;
  /** The affected row id on success (lets the caller refresh/close). */
  readonly targetId: string | null;
}

/** The initial, pristine action state. */
export const CALC_ACTION_INITIAL: CalcActionState = {
  status: "idle",
  form: null,
  code: null,
  formError: null,
  fieldErrors: {},
  values: {},
  targetId: null,
};

/** True iff the action result represents a transient, retryable failure. */
export function isRetryableCalcError(state: CalcActionState): boolean {
  return state.status === "error" && state.code === "SERVER_ERROR";
}
