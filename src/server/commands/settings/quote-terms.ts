/**
 * Quote-terms commands (Story 3.3, Task 2.3; architecture §5) — the SIGN-OFF
 * mechanics that enforce the epic-3 HARD STOP-CONDITION: customer-facing
 * tax/legal/quote-terms wording must NEVER be silently or automatically approved by
 * the implementation.
 *
 * Two commands through the EXISTING envelope (no bespoke auth/error/audit mechanism):
 *
 *   - `updateQuoteTerms` — upsert the tenant's single terms set (`unique
 *     (tenant_id)` → `onConflict: "tenant_id"`). CRITICAL: creating/updating terms
 *     text NEVER sets approval; on EVERY write it EXPLICITLY RESETS `approved_at =
 *     null` + `approved_by = null` — a fresh record is not-approved by construction,
 *     and editing an already-approved record INVALIDATES the prior sign-off (the
 *     wording changed, so the old approval no longer applies). There is NO
 *     auto-approve / default-approved path anywhere in this command.
 *
 *   - `approveQuoteTerms` — the ONLY path that sets approval. A DELIBERATE
 *     human-triggered command (the UI "Markera som godkänd" button), never an
 *     implicit step inside the edit path. It sets `approved_at = ctx.clock.now()`
 *     (the single deterministic command instant — never `Date.now()`) and
 *     `approved_by = ctx.tenantContext.userId` (the RESOLVED acting admin, never a
 *     client-supplied id). Ownership is verified by the envelope (a foreign/other-
 *     tenant id is invisible under RLS → TENANT_ACCESS_DENIED).
 *
 * The resolved tenant (`ctx.tenantContext.tenantId`) is the ONLY authority for the
 * row's `tenant_id`; a client-supplied tenant_id is ignored. The write runs on the
 * request-bound RLS client (`ctx.db`). Audit metadata carries NO terms text / PII —
 * only `{ targetId }`.
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import { asSettingsAuditRpcClient, throwMappedWriteError } from "./settings-db";
import { type SettingsCommandResult } from "./company-settings";
import {
  validateApproveQuoteTerms,
  validateUpdateQuoteTerms,
  type ApproveQuoteTermsInput,
  type UpdateQuoteTermsInput,
} from "./validation";

export const updateQuoteTerms = defineCommand<
  UpdateQuoteTermsInput,
  SettingsCommandResult
>({
  command: "quote_terms.update",
  auditable: false,
  eventType: "quote_terms.updated",
  targetType: "quote_terms",
  validateInput: validateUpdateQuoteTerms,
  // No ownership target — the row is keyed on the resolved tenant via the unique
  // (tenant_id) upsert; the own-tenant WITH CHECK keeps it in-tenant.
  execute: async (ctx) => {
    const db = asSettingsAuditRpcClient(ctx.db);
    const { data, error } = await db.rpc("upsert_quote_terms_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId, p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId, p_terms_text: ctx.input.terms_text,
    });
    if (error) throwMappedWriteError(error);
    if (typeof data !== "string") {
      throw new Error("updateQuoteTerms: no id returned");
    }
    return { targetId: data };
  },
  auditFields: (_ctx, result) => ({ targetId: result.targetId }),
});

export const approveQuoteTerms = defineCommand<
  ApproveQuoteTermsInput,
  SettingsCommandResult
>({
  command: "quote_terms.approve",
  auditable: false,
  eventType: "quote_terms.approved",
  targetType: "quote_terms",
  validateInput: validateApproveQuoteTerms,
  // Ownership: the target terms row must be visible under the caller's RLS (own
  // tenant). A foreign id → zero rows → TENANT_ACCESS_DENIED (envelope verify) BEFORE
  // any approval is set.
  ownership: (input) => ({ table: "quote_terms", id: input.id }),
  execute: async (ctx) => {
    const db = asSettingsAuditRpcClient(ctx.db);
    // The DELIBERATE human sign-off — the ONLY path that sets approval. Use the
    // SINGLE deterministic command instant (injected clock — never Date.now()) and
    // the RESOLVED acting admin id (never a client-supplied id).
    const approvedAt = ctx.clock.now().toISOString();
    const { data, error } = await db.rpc("approve_quote_terms_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId, p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId, p_quote_terms_id: ctx.input.id, p_approved_at: approvedAt,
    });
    if (error) throwMappedWriteError(error);
    // Ownership already proved the row is visible; a zero-row update here would be a
    // race (row removed between verify and update) → deny rather than 500.
    if (typeof data !== "string") {
      throw new CommandError("TENANT_ACCESS_DENIED");
    }
    return { targetId: data };
  },
  auditFields: (ctx) => ({ targetId: ctx.input.id }),
});
