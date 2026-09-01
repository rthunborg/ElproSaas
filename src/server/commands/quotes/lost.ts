/**
 * `markQuoteVersionLost` — the Story 10.2 Förlorad/Avböjd lifecycle command (architecture-phase-b §9.1,
 * §14; ADR-A005; R-1010/R-1011/R-1012/R-1013). Marks a SENT quote version lost/declined with a
 * required structured reason, tenant-scoped + audited, WITHOUT ever mutating any sent-snapshot content.
 *
 * A `defineCommand` through the EXISTING envelope (resolve user → resolve active tenant_admin →
 * validate typed input → envelope `ownership` verifies the quote_version id is own-tenant-visible →
 * in execute: LOAD the version's CURRENT status on the RLS client → VALIDATE the `sent → lost`
 * transition is LEGAL via the SHARED `isLegalLifecycleTransition` predicate (the command-layer guard
 * mirroring the DB trigger — reject an illegal transition with VALIDATION_FAILED BEFORE any write) →
 * call the narrow atomic `mark_quote_version_lost` RPC on the RLS client with the INJECTED clock →
 * append-only audit `{ targetId }`). No bespoke auth/error/audit mechanism.
 *
 * ── THE STATE MACHINE AT BOTH LAYERS (R-1011) ─────────────────────────────────────────────────────
 * The command guard (`isLegalLifecycleTransition(status, 'lost')`) and the DB (the 6.4 sent-lock
 * trigger's widened allow-set + the `mark_quote_version_lost` RPC's `assert v_status='sent'`) enforce
 * the SAME single-source transition map — a drift is the exact R-1011 failure this prevents. An
 * illegal lost (a draft/accepted/superseded version, a second lost on an already-lost version) is
 * rejected at the command layer (VALIDATION_FAILED) AND, if a race ever slips past, at the DB
 * (QV409 → QUOTE_VERSION_LOCKED via `throwMappedQuoteWriteError`).
 *
 * ── ONLY `status` CHANGES; NO SENT CONTENT MUTATES (R-1010, AC3) ───────────────────────────────────
 * The RPC UPDATEs ONLY the exempt `status` column (the 6.4 sent-lock trigger's row-equality check
 * passes) + appends one `quote_events` `lost` row + inserts exactly one `quote_lost_reasons` row
 * (`unique (quote_version_id)`). Audit metadata is `{ targetId }` ONLY — the outcome/category/note
 * (free text, possible PII) are NEVER put in `audit_events` (the lifecycle-command allow-list).
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import {
  isLegalLifecycleTransition,
  type QuoteVersionStatus,
} from "@/features/quotes/lifecycle";
import {
  asQuoteLostRpcClient,
  loadQuoteVersionStatus,
  throwMappedQuoteWriteError,
} from "./quote-db";
import {
  validateMarkQuoteVersionLost,
  type MarkQuoteVersionLostInput,
} from "./validation";

/** Result of the lost command — the lost version id under `targetId`. */
export interface MarkQuoteVersionLostResult {
  readonly targetId: string;
}

export const markQuoteVersionLost = defineCommand<
  MarkQuoteVersionLostInput,
  MarkQuoteVersionLostResult
>({
  command: "quote.version.lost",
  auditable: false,
  eventType: "quote.version.lost",
  targetType: "quote_version",
  validateInput: validateMarkQuoteVersionLost,
  // Ownership: the target version must be visible under the caller's RLS (own tenant). A foreign /
  // non-existent id → zero rows → TENANT_ACCESS_DENIED BEFORE execute (nothing is marked lost).
  ownership: (input) => ({ table: "quote_versions", id: input.quote_version_id }),
  execute: async (ctx): Promise<MarkQuoteVersionLostResult> => {
    const db = ctx.db;
    const versionId = ctx.input.quote_version_id;

    // ── LOAD the version's REAL current status (ownership proved it visible; null = race). ──
    const status = await loadQuoteVersionStatus(db, versionId);
    if (status === null) throw new CommandError("TENANT_ACCESS_DENIED");

    // ── THE COMMAND-LAYER GUARD (R-1011) — `sent → lost` must be LEGAL from the current status. ──
    // Mirrors the DB trigger's legal-transition guard (the SAME state machine). Only a `sent` version
    // can be lost; a draft/accepted/superseded/rejected/expired/lost version → VALIDATION_FAILED
    // BEFORE any write (no status flip, no event, no reason row).
    if (!isLegalLifecycleTransition(status as QuoteVersionStatus, "lost")) {
      throw new CommandError("VALIDATION_FAILED");
    }

    // ── The narrow atomic lost flip on the RLS client (never service-role). Only `status` flips + ──
    // ── one lost event + one reason row are written; occurred_at = the SINGLE injected clock.      ──
    const rpc = asQuoteLostRpcClient(db);
    const { error } = await rpc.rpc("mark_quote_version_lost", {
      p_tenant_id: ctx.tenantContext.tenantId, // resolved tenant, never a client id
      p_quote_version_id: versionId,
      p_outcome: ctx.input.outcome,
      p_category: ctx.input.category,
      p_note: ctx.input.note ?? null,
      p_occurred_at: ctx.clock.now().toISOString(),
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
    });
    // Map the RPC's QV409 (a race past the command guard) → QUOTE_VERSION_LOCKED; a duplicate reason
    // (23505 on `unique (quote_version_id)`) → VALIDATION_FAILED; other codes per the mapper.
    if (error) throwMappedQuoteWriteError(error);

    return { targetId: versionId };
  },
  // Audit allow-list is `{ targetId }` ONLY — NO outcome/category/note (free text / possible PII).
});
