/**
 * The Story 10.3 follow-up workflow commands — `planQuoteFollowUp` / `completeQuoteFollowUp` /
 * `annotateQuoteFollowUp` (architecture-phase-b §9.1, §14; UXB-A6; R-1030/R-1032).
 *
 * Three SINGLE-ROW ENVELOPE commands (NO RPC — architecture §14). Each is a `defineCommand`
 * through the EXISTING envelope (resolve user → resolve active tenant_admin → validate typed input →
 * envelope `ownership` verifies the target is own-tenant-visible → in execute a direct RLS-client
 * table write with the RESOLVED tenant_id → append-only audit `{ targetId }` ONLY). No bespoke
 * auth/error/audit mechanism; no service-role app path.
 *
 * ── plan (AC1) ────────────────────────────────────────────────────────────────────────────────────
 * Ownership on `quote_versions`. Loads the anchor version's status + quote_id; asserts the anchor is
 * `sent` (a follow-up is for an OPEN deal); DERIVES quote_id from the LOADED row (never a client
 * value — a mismatched own-tenant quote_id would satisfy its own composite FK yet point the follow-up
 * at the wrong quote); INSERTs the open row with the resolved tenant_id. The one-open rule is
 * DB-enforced by the partial unique index `(quote_id) WHERE status='open'` → a 23505 is mapped to a
 * CLEAR VALIDATION_FAILED ("En öppen uppföljning finns redan för offerten."), never a raw DB error.
 *
 * ── complete / annotate (AC3) ─────────────────────────────────────────────────────────────────────
 * Ownership on `quote_follow_ups`. The `where … and status='open'` predicate makes complete/annotate
 * a clean no-op-reject on a non-open row (zero rows → VALIDATION_FAILED). complete sets
 * status='completed' + outcome + completed_at (= the SINGLE injected command clock) on the same row;
 * annotate updates an open row's note. Audit metadata is `{ targetId }` ONLY — never the note/outcome
 * free text (possible PII), matching the lost/lifecycle allow-list discipline.
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import {
  asQuoteFollowUpWriteClient,
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
  auditable: true,
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

    // ── INSERT the open row on the RLS client (never service-role). tenant_id from the resolved ──
    // ── context; quote_id DERIVED from the loaded anchor row (never a client value).            ──
    const w = asQuoteFollowUpWriteClient(db);
    const { data, error } = await w
      .from("quote_follow_ups")
      .insert({
        tenant_id: ctx.tenantContext.tenantId,
        quote_id: anchor.quote_id,
        quote_version_id: versionId,
        due_date: ctx.input.due_date,
        note: ctx.input.note ?? null,
      })
      .select("id");
    if (error) {
      // The one-open partial unique index (23505) → a CLEAR VALIDATION_FAILED, never a raw DB error.
      if (error.code === "23505") {
        throw new CommandError("VALIDATION_FAILED", ONE_OPEN_MESSAGE);
      }
      throwMappedQuoteWriteError(error);
    }
    const newId = (data?.[0] as { id?: string } | undefined)?.id;
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
  auditable: true,
  eventType: "quote.follow_up.complete",
  targetType: "quote_follow_up",
  validateInput: validateCompleteQuoteFollowUp,
  // Ownership: the target follow-up must be own-tenant-visible. A foreign / non-existent id → zero
  // rows → TENANT_ACCESS_DENIED BEFORE execute (nothing is completed).
  ownership: (input) => ({ table: "quote_follow_ups", id: input.follow_up_id }),
  execute: async (ctx): Promise<CompleteQuoteFollowUpResult> => {
    const db = ctx.db;
    const followUpId = ctx.input.follow_up_id;

    // ── UPDATE the open row → completed on the RLS client. completed_at = the SINGLE injected ──
    // ── command clock. The `status='open'` predicate makes an already-completed row a no-op.   ──
    const w = asQuoteFollowUpWriteClient(db);
    const { data, error } = await w
      .from("quote_follow_ups")
      .update({
        status: "completed",
        outcome: ctx.input.outcome,
        completed_at: ctx.clock.now().toISOString(),
      })
      .eq("id", followUpId)
      .eq("tenant_id", ctx.tenantContext.tenantId)
      .eq("status", "open")
      .select("id");
    if (error) throwMappedQuoteWriteError(error);
    // Zero rows: the follow-up is not open (already completed) → a clean no-op-reject.
    if (!data || data.length === 0) {
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
  auditable: true,
  eventType: "quote.follow_up.annotate",
  targetType: "quote_follow_up",
  validateInput: validateAnnotateQuoteFollowUp,
  // Ownership: the target follow-up must be own-tenant-visible. A foreign / non-existent id → zero
  // rows → TENANT_ACCESS_DENIED BEFORE execute (nothing is annotated).
  ownership: (input) => ({ table: "quote_follow_ups", id: input.follow_up_id }),
  execute: async (ctx): Promise<AnnotateQuoteFollowUpResult> => {
    const db = ctx.db;
    const followUpId = ctx.input.follow_up_id;

    const w = asQuoteFollowUpWriteClient(db);
    const { data, error } = await w
      .from("quote_follow_ups")
      .update({ note: ctx.input.note ?? null })
      .eq("id", followUpId)
      .eq("tenant_id", ctx.tenantContext.tenantId)
      .eq("status", "open")
      .select("id");
    if (error) throwMappedQuoteWriteError(error);
    // Zero rows: the follow-up is not open (annotate is open-only) → a clean no-op-reject.
    if (!data || data.length === 0) {
      throw new CommandError("VALIDATION_FAILED", ALREADY_COMPLETED_MESSAGE);
    }
    return { targetId: followUpId };
  },
  // Audit allow-list is `{ targetId }` ONLY — NO note free text (possible PII).
  auditFields: (ctx) => ({ targetId: ctx.input.follow_up_id }),
});
