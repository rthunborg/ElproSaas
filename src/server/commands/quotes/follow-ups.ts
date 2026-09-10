/**
 * The Story 10.3 follow-up workflow commands — `planQuoteFollowUp` / `completeQuoteFollowUp` /
 * `annotateQuoteFollowUp` (architecture-phase-b §9.1, §14; UXB-A6; R-1030/R-1032).
 *
 * Three single-row envelope commands backed by checked, command-specific RPCs. Each is a `defineCommand`
 * through the EXISTING envelope (resolve user → resolve active tenant_admin → validate typed input →
 * envelope `ownership` verifies the target is own-tenant-visible → in execute the checked RPC binds
 * its write and fixed audit event in one transaction). The generic audit RPC remains Admin-only;
 * no service-role app path is introduced.
 *
 * ── plan (AC1) ────────────────────────────────────────────────────────────────────────────────────
 * Ownership on `quote_versions`. Loads the anchor version's status + quote_id; asserts the anchor is
 * `sent` (a follow-up is for an OPEN deal); DERIVES quote_id from the LOADED row (never a client
 * value — a mismatched own-tenant quote_id would satisfy its own composite FK yet point the follow-up
 * at the wrong quote); the RPC inserts the open row with the resolved tenant id. The one-open rule is
 * DB-enforced by the partial unique index `(quote_id) WHERE status='open'` → a 23505 is mapped to a
 * CLEAR VALIDATION_FAILED ("En öppen uppföljning finns redan för offerten."), never a raw DB error.
 *
 * ── complete / annotate (AC3) ─────────────────────────────────────────────────────────────────────
 * Ownership on `quote_follow_ups`. The RPC's locked open-row predicate makes complete/annotate a
 * clean no-op-reject on a non-open row. complete sets
 * status='completed' + outcome + completed_at (= the SINGLE injected command clock) on the same row;
 * annotate updates an open row's note. Audit metadata is `{ targetId }` ONLY — never the note/outcome
 * free text (possible PII), matching the lost/lifecycle allow-list discipline.
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import { calendarDayIn } from "@/features/quotes/follow-up-dates";
import {
  asQuoteFollowUpLifecycleRpcClient,
  extractQuoteFollowUpLifecycleId,
  loadQuoteVersionAnchor,
  throwMappedQuoteWriteError,
} from "./quote-db";
import {
  validatePlanQuoteFollowUp,
  validateCompleteQuoteFollowUp,
  validateAnnotateQuoteFollowUp,
  type PlanQuoteFollowUpInput,
  type CompleteQuoteFollowUpInput,
  type AnnotateQuoteFollowUpInput,
} from "./validation";

/** The clear, user-safe message when a second OPEN follow-up on the same quote is rejected (23505). */
const ONE_OPEN_MESSAGE = "En öppen uppföljning finns redan för offerten.";
/** The clear, user-safe message when a complete/annotate targets a non-open (already-completed) row. */
const ALREADY_COMPLETED_MESSAGE = "Uppföljningen är redan avslutad.";

/** Result of the plan command — the NEW follow-up id under `targetId`. */
export interface PlanQuoteFollowUpResult {
  readonly targetId: string;
}
/** Result of the complete command — the completed follow-up id under `targetId`. */
export interface CompleteQuoteFollowUpResult {
  readonly targetId: string;
}
/** Result of the annotate command — the annotated follow-up id under `targetId`. */
export interface AnnotateQuoteFollowUpResult {
  readonly targetId: string;
}

export const planQuoteFollowUp = defineCommand<
  PlanQuoteFollowUpInput,
  PlanQuoteFollowUpResult
>({
  command: "quote.follow_up.plan",
  // The checked RPC owns the write and one audit row atomically.  Do not invoke the Admin-only
  // generic audit RPC afterwards, which would both duplicate the event and reject Projektledare.
  auditable: false,
  eventType: "quote.follow_up.plan",
  targetType: "quote_follow_up",
  validateInput: validatePlanQuoteFollowUp,
  // Ownership: the anchor version must be visible under the caller's RLS (own tenant). A foreign /
  // non-existent id → zero rows → TENANT_ACCESS_DENIED BEFORE execute (nothing is planned).
  ownership: (input) => ({ table: "quote_versions", id: input.quote_version_id }),
  execute: async (ctx): Promise<PlanQuoteFollowUpResult> => {
    const db = ctx.db;
    const versionId = ctx.input.quote_version_id;

    // ── LOAD the anchor version's status + quote_id (ownership proved it visible; null = race). ──
    const anchor = await loadQuoteVersionAnchor(db, versionId);
    if (anchor === null) throw new CommandError("TENANT_ACCESS_DENIED");

    // ── A follow-up is planned only on a SENT version (an OPEN deal). ──
    if (anchor.status !== "sent") throw new CommandError("VALIDATION_FAILED");

    // ── Reject a due date strictly BEFORE "today in Europe/Stockholm" (judged on the SINGLE injected
    // command clock — never Date.now() on this path, matching the 10.3/10.4 date discipline). A past
    // due date would surface as an instantly-overdue "Försenad uppföljning" (10.4 integration review).
    // A DISTINCT stable code (FOLLOW_UP_DUE_DATE_IN_PAST), never a reused generic VALIDATION_FAILED. ──
    const todayStockholm = calendarDayIn(ctx.clock.now(), "Europe/Stockholm");
    if (ctx.input.due_date < todayStockholm) {
      throw new CommandError("FOLLOW_UP_DUE_DATE_IN_PAST");
    }

    // The checked RPC repeats the anchor checks under its row lock, inserts the follow-up, and
    // records its fixed audit event atomically.  `quote_id` remains server-derived there.
    const rpc = asQuoteFollowUpLifecycleRpcClient(db);
    const { data, error } = await rpc.rpc("plan_quote_follow_up_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_quote_version_id: versionId,
      p_due_date: ctx.input.due_date,
      p_note: ctx.input.note ?? null,
    });
    if (error) {
      // The one-open partial unique index (23505) → a CLEAR VALIDATION_FAILED, never a raw DB error.
      if (error.code === "23505") {
        throw new CommandError("VALIDATION_FAILED", ONE_OPEN_MESSAGE);
      }
      throwMappedQuoteWriteError(error);
    }
    const newId = extractQuoteFollowUpLifecycleId(data);
    if (typeof newId !== "string") {
      throw new Error("planQuoteFollowUp: insert returned no id");
    }
    return { targetId: newId };
  },
  // Audit allow-list is `{ targetId }` ONLY (the NEW follow-up id) — NO note/due_date free text.
  auditFields: (_ctx, result) => ({ targetId: result.targetId }),
});

export const completeQuoteFollowUp = defineCommand<
  CompleteQuoteFollowUpInput,
  CompleteQuoteFollowUpResult
>({
  command: "quote.follow_up.complete",
  // See planQuoteFollowUp: the checked RPC owns the bound audit write.
  auditable: false,
  eventType: "quote.follow_up.complete",
  targetType: "quote_follow_up",
  validateInput: validateCompleteQuoteFollowUp,
  // Ownership: the target follow-up must be own-tenant-visible. A foreign / non-existent id → zero
  // rows → TENANT_ACCESS_DENIED BEFORE execute (nothing is completed).
  ownership: (input) => ({ table: "quote_follow_ups", id: input.follow_up_id }),
  execute: async (ctx): Promise<CompleteQuoteFollowUpResult> => {
    const db = ctx.db;
    const followUpId = ctx.input.follow_up_id;

    // The RPC locks and scopes the open row, writes its completion, and inserts the audit row in the
    // same transaction.  The optional expected quote id retains F5's forged/stale-id defense.
    const rpc = asQuoteFollowUpLifecycleRpcClient(db);
    const { data, error } = await rpc.rpc("complete_quote_follow_up_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_follow_up_id: followUpId,
      p_outcome: ctx.input.outcome,
      p_completed_at: ctx.clock.now().toISOString(),
      p_expected_quote_id: ctx.input.expected_quote_id ?? null,
    });
    // QFU10 deliberately covers both an already-completed row and the server-derived F5 quote
    // scope mismatch.  Neither state is disclosed; both preserve the established clean message.
    if (error?.code === "QFU10") {
      throw new CommandError("VALIDATION_FAILED", ALREADY_COMPLETED_MESSAGE);
    }
    if (error) throwMappedQuoteWriteError(error);
    if (extractQuoteFollowUpLifecycleId(data) === null) {
      throw new CommandError("VALIDATION_FAILED", ALREADY_COMPLETED_MESSAGE);
    }
    return { targetId: followUpId };
  },
  // Audit allow-list is `{ targetId }` ONLY — NO outcome free text (possible PII).
  auditFields: (ctx) => ({ targetId: ctx.input.follow_up_id }),
});

export const annotateQuoteFollowUp = defineCommand<
  AnnotateQuoteFollowUpInput,
  AnnotateQuoteFollowUpResult
>({
  command: "quote.follow_up.annotate",
  // See planQuoteFollowUp: the checked RPC owns the bound audit write.
  auditable: false,
  eventType: "quote.follow_up.annotate",
  targetType: "quote_follow_up",
  validateInput: validateAnnotateQuoteFollowUp,
  // Ownership: the target follow-up must be own-tenant-visible. A foreign / non-existent id → zero
  // rows → TENANT_ACCESS_DENIED BEFORE execute (nothing is annotated).
  ownership: (input) => ({ table: "quote_follow_ups", id: input.follow_up_id }),
  execute: async (ctx): Promise<AnnotateQuoteFollowUpResult> => {
    const db = ctx.db;
    const followUpId = ctx.input.follow_up_id;

    const rpc = asQuoteFollowUpLifecycleRpcClient(db);
    const { data, error } = await rpc.rpc("annotate_quote_follow_up_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_follow_up_id: followUpId,
      p_note: ctx.input.note ?? null,
    });
    if (error?.code === "QFU10") {
      throw new CommandError("VALIDATION_FAILED", ALREADY_COMPLETED_MESSAGE);
    }
    if (error) throwMappedQuoteWriteError(error);
    if (extractQuoteFollowUpLifecycleId(data) === null) {
      throw new CommandError("VALIDATION_FAILED", ALREADY_COMPLETED_MESSAGE);
    }
    return { targetId: followUpId };
  },
  // Audit allow-list is `{ targetId }` ONLY — NO note free text (possible PII).
  auditFields: (ctx) => ({ targetId: ctx.input.follow_up_id }),
});
