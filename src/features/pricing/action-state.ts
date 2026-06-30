/**
 * Shared form-action state contract for the pricing server actions (Story 3.4,
 * Task 4.4). Mirrors the settings `SettingsActionState` shape EXACTLY (the established
 * 3.2/3.3 pattern) so the pricing forms reuse the same `useActionState` + FormField a11y
 * wiring without reinventing a mechanism.
 *
 * It maps the pricing command's typed `Result` to a UI-renderable shape WITHOUT leaking
 * internal detail:
 *   - `ok` → the form shows a saved affordance and the page revalidates.
 *   - a `VALIDATION_FAILED` → field-level errors + a top-of-form summary, and the
 *     submitted `values` are echoed back so the form PRESERVES input (AC5).
 *   - a `TENANT_ACCESS_DENIED` / auth failure → a generic Swedish `formError`.
 *   - a transient `SERVER_ERROR` → a RETRYABLE failure, surfaced as such — NEVER a
 *     permanent access denial.
 *
 * NO raw input, stack, SQL, or tenant/user-existence signal is ever put here.
 */
import type { CommandErrorCode } from "@/server/commands/command-errors";

/** The status discriminant of a pricing action result. */
export type PricingActionStatus = "idle" | "success" | "error";

/**
 * Which editor produced the result — so two forms on the one `/settings/pricing` page
 * can share the action-state shape yet each render ONLY its own success/error. (A
 * submit to the work-role form must not light up the article form's saved affordance.)
 */
export type PricingFormKind = "work_role" | "article";

/** The state `useActionState` carries for a pricing form. */
export interface PricingActionState {
  readonly status: PricingActionStatus;
  /** Which form produced this state (null when idle). */
  readonly form: PricingFormKind | null;
  /** The stable error code (when status === "error"); null otherwise. */
  readonly code: CommandErrorCode | null;
  /** A generic, user-safe top-of-form message (blocking error summary). */
  readonly formError: string | null;
  /** Per-field validation messages keyed by form field name (VALIDATION_FAILED only). */
  readonly fieldErrors: Readonly<Record<string, string>>;
  /** The submitted values echoed back so the form preserves input on failure (AC5). */
  readonly values: Readonly<Record<string, string>>;
  /** The affected row id on success (lets the caller refresh/close). */
  readonly targetId: string | null;
}

/** The initial, pristine action state. */
export const PRICING_ACTION_INITIAL: PricingActionState = {
  status: "idle",
  form: null,
  code: null,
  formError: null,
  fieldErrors: {},
  values: {},
  targetId: null,
};

/** True iff the action result represents a transient, retryable failure. */
export function isRetryablePricingError(state: PricingActionState): boolean {
  return state.status === "error" && state.code === "SERVER_ERROR";
}
