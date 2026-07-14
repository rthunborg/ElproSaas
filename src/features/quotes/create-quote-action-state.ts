/**
 * List-page quote creation (owner decision 2026-07-14) — the server-action state contract for
 * the `/quotes` "Skapa ny offert" affordance.
 *
 * The `useActionState` shape for creating a NEW quote (version 1) from a picked own-tenant
 * calculation via the EXISTING `createQuoteVersionFromCalculation` command (Story 6.1 — reused
 * verbatim, no new command). Maps the command's typed `Result` to a UI-renderable shape WITHOUT
 * leaking internal detail:
 *   - `ok` → a new quote + draft version exists; `quoteId` (the navigation target — the list
 *     island lands the admin on `/quotes/{quoteId}`) + `targetId` (the new version id) are carried.
 *   - `VALIDATION_FAILED` → a generic non-final message (the submitted calc id echoes back so the
 *     picker preserves the selection).
 *   - `TENANT_ACCESS_DENIED` / auth failure → a generic Swedish `formError` (a crafted foreign
 *     calculation id is denied BEFORE execute — no existence disclosure).
 *   - a transient `SERVER_ERROR` → a RETRYABLE failure.
 *
 * Mirrors `new-version-action-state.ts` (the 6.5 sibling) so the affordance reuses the same
 * a11y/error wiring without inventing a mechanism. NO raw input, stack, SQL, or tenant/user-
 * existence signal here.
 */
import type { CommandErrorCode } from "@/server/commands/command-errors";

/** The status discriminant of a create-quote action result. */
export type CreateQuoteActionStatus = "idle" | "success" | "error";

/** The state `useActionState` carries for the list-page create-quote affordance. */
export interface CreateQuoteActionState {
  readonly status: CreateQuoteActionStatus;
  /** The stable error code (when status === "error"); null otherwise. */
  readonly code: CommandErrorCode | null;
  /** A generic, user-safe message. */
  readonly formError: string | null;
  /** The NEW draft version id on success. */
  readonly targetId: string | null;
  /** The parent quote id on success — the `/quotes/{quoteId}` navigation target. */
  readonly quoteId: string | null;
  /** The submitted values echoed back so the picker preserves the selection on failure. */
  readonly values: Readonly<Record<string, string>>;
}

/** The initial, pristine create-quote state. */
export const CREATE_QUOTE_ACTION_INITIAL: CreateQuoteActionState = {
  status: "idle",
  code: null,
  formError: null,
  targetId: null,
  quoteId: null,
  values: {},
};

/** True iff the create-quote result is a transient, retryable failure. */
export function isRetryableCreateQuoteError(state: CreateQuoteActionState): boolean {
  return state.status === "error" && state.code === "SERVER_ERROR";
}
