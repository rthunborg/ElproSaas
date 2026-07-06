/**
 * `markQuoteVersionLifecycle` — the Story 6.5 standalone lifecycle-transition command (architecture
 * §5, §9, §11; ADR-A009; R-608). Applies a Phase-A lifecycle event (rejected / expired / superseded)
 * to a prior SENT version, tenant-scoped + audited, WITHOUT mutating any prior sent content.
 *
 * A `defineCommand` through the EXISTING envelope (resolve user → resolve active tenant_admin →
 * validate typed input → envelope `ownership` verifies the quote_version id is own-tenant-visible →
 * in execute: LOAD the version's CURRENT status on the RLS client → VALIDATE the transition is
 * LEGAL from that status via the SHARED `isLegalLifecycleTransition` predicate (the command-layer
 * guard mirroring the DB trigger — reject an illegal transition with VALIDATION_FAILED BEFORE any
 * write) → call the narrow atomic `mark_quote_version_lifecycle` RPC on the RLS client with the
 * INJECTED clock → append-only audit `{ targetId }`). No bespoke auth/error/audit mechanism.
 *
 * ── THE STATE MACHINE AT BOTH LAYERS (R-608) ──────────────────────────────────────────────────
 * The command guard (`isLegalLifecycleTransition`) and the DB (the 6.4 sent-lock trigger + the
 * `mark_quote_version_lifecycle` RPC guard) enforce the SAME closed transition map — a drift is the
 * failure this prevents. An illegal transition (`sent→draft`, `superseded→sent`, a `draft`
 * rejected/expired) is rejected at the command layer (VALIDATION_FAILED) AND, if a race ever slips
 * past, at the DB (QV409 → QUOTE_VERSION_LOCKED via `throwMappedQuoteWriteError`).
 *
 * ── ONLY `status` CHANGES; NO PRIOR CONTENT MUTATES (R-609) ────────────────────────────────────
 * The RPC UPDATEs ONLY the exempt `status` column (the 6.4 sent-lock trigger's row-equality check
 * passes) + appends the matching `quote_events` row (the append-only trigger blocks any mutation of
 * an existing event). Audit metadata is `{ targetId }` ONLY — no PII/money/customer/status value.
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import {
  isLegalLifecycleTransition,
  type QuoteVersionStatus,
} from "@/features/quotes/lifecycle";
import {
  asQuoteLifecycleRpcClient,
  loadQuoteVersionStatus,
  throwMappedQuoteWriteError,
} from "./quote-db";
import {
  validateMarkQuoteVersionLifecycle,
  type MarkQuoteVersionLifecycleInput,
} from "./validation";

/** Result of the lifecycle-transition command — the transitioned version id under `targetId`. */
export interface MarkQuoteVersionLifecycleResult {
  readonly targetId: string;
}

export const markQuoteVersionLifecycle = defineCommand<
  MarkQuoteVersionLifecycleInput,
  MarkQuoteVersionLifecycleResult
>({
  command: "quote.version.lifecycle",
  auditable: true,
  eventType: "quote.version.lifecycle",
  targetType: "quote_version",
  validateInput: validateMarkQuoteVersionLifecycle,
  // Ownership: the target version must be visible under the caller's RLS (own tenant). A foreign /
  // non-existent id → zero rows → TENANT_ACCESS_DENIED BEFORE execute (nothing is transitioned).
  ownership: (input) => ({ table: "quote_versions", id: input.quote_version_id }),
  execute: async (ctx): Promise<MarkQuoteVersionLifecycleResult> => {
    const db = ctx.db;
    const versionId = ctx.input.quote_version_id;
    const transition = ctx.input.transition;

    // ── LOAD the version's REAL current status (ownership proved it visible; null = race). ──
    const status = await loadQuoteVersionStatus(db, versionId);
    if (status === null) throw new CommandError("TENANT_ACCESS_DENIED");

    // ── THE COMMAND-LAYER GUARD (R-608) — the transition must be LEGAL from the current status. ──
    // Mirrors the DB trigger's legal-transition guard (they are the SAME state machine). An illegal
    // transition (a draft rejected/expired, a reversal to draft, a terminal-state move) →
    // VALIDATION_FAILED BEFORE any write. The validator already narrowed `transition` to the closed
    // set (rejected/expired/superseded); this proves it is legal FROM the current status.
    if (!isLegalLifecycleTransition(status as QuoteVersionStatus, transition)) {
      throw new CommandError("VALIDATION_FAILED");
    }

    // ── The narrow atomic transition on the RLS client (never service-role). Only `status` flips + ──
    // ── the matching event is appended; occurred_at = the SINGLE injected command clock.           ──
    const rpc = asQuoteLifecycleRpcClient(db);
    const { error } = await rpc.rpc("mark_quote_version_lifecycle", {
      p_tenant_id: ctx.tenantContext.tenantId, // resolved tenant, never a client id
      p_quote_version_id: versionId,
      p_transition: transition,
      p_occurred_at: ctx.clock.now().toISOString(),
    });
    // Map the RPC's QV409 (an illegal transition slipped past the command guard, a race) →
    // QUOTE_VERSION_LOCKED; other codes per the mapper.
    if (error) throwMappedQuoteWriteError(error);

    return { targetId: versionId };
  },
  // Audit allow-list is `{ targetId }` ONLY — NO transition/status/customer/money value.
  auditFields: (ctx) => ({ targetId: ctx.input.quote_version_id }),
});
