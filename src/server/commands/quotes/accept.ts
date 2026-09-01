/**
 * `captureQuoteAcceptance` — the Story 7.1 off-system acceptance-capture command (architecture §13
 * steps 1/3/5/6; ADR-A005; R-705/R-706/R-707/R-709).
 *
 * A `defineCommand` through the EXISTING envelope (resolve user → resolve active tenant_admin →
 * validate typed input → envelope `ownership` verifies the quote_version id is own-tenant-visible
 * → in execute: LOAD the version's real status + parent quote + frozen source sent total on the RLS
 * client → re-assert `status='sent'` (reject a non-sent with VALIDATION_FAILED) → re-validate the
 * adjusted-price + reason/evidence gate server-side via the PURE Task-3 `evaluateAcceptancePriceGate`
 * authority → call the same narrow, attributable `accept_quote_and_create_job` SECURITY DEFINER
 * RPC as the live acceptance action. That one atomic transaction persists the acceptance, flips
 * `sent → accepted`, creates the authoritative job, links evidence, and writes its single audit row.
 * This compatibility command intentionally preserves the historic `{ targetId }` result shape while
 * it no longer offers a direct-table-write bypass.
 *
 * ── THE SENT-STATE GATE (AC3, R-706) ──────────────────────────────────────────────────────────
 * Acceptance is legal ONLY on `status = 'sent'` (matrix FINALIZED against the landed Epic 6 state
 * machine: draft/sent/accepted/rejected/expired/superseded). Ownership proves the row is visible;
 * the command loads its REAL current status and rejects any non-'sent' state with a GENERIC
 * `VALIDATION_FAILED` (a user-safe message that does NOT leak the exact status). A cross-tenant /
 * foreign version id ⇒ `TENANT_ACCESS_DENIED` at the ownership gate BEFORE execute (no existence
 * disclosure). Do NOT reuse `QUOTE_VERSION_LOCKED` (the sent-immutability lock — a different meaning).
 *
 * ── THE ADJUSTED-PRICE GATE (AC2, R-705 — server truth, the UI mirrors it) ─────────────────────
 * The frozen source sent total (the customer-commitment gross the version froze) is loaded
 * server-side and fed to the SINGLE authority `evaluateAcceptancePriceGate` — the PURE Task-3 module
 * the command CONSUMES (it internally computes the delta = accepted_price_ore − source_sent_total_ore
 * via `computeAcceptanceDelta` and applies the reason rule; the command never re-derives either ad
 * hoc). If the delta is non-zero and NEITHER an `adjustment_reason` NOR evidence (a file id or an
 * external reference) is supplied ⇒ `VALIDATION_FAILED` (the client cannot bypass — a missing reason
 * is rejected even if omitted client-side). The delta is CAPTURED (both öre values persist).
 *
 * ── ÖRE DISCIPLINE + PERSISTENCE (AC5, 7.1 Decision (a)) ───────────────────────────────────────
 * `accepted_price_ore` (validated `isOreAmount`) + `source_sent_total_ore` (the frozen commitment
 * gross) persist as integer öre in the atomic RPC. `accepted_at` is an EXPLICIT input (H1
 * determinism — the accepted moment is never a wall-clock read). The resolved tenant, actor, and
 * correlation id are the ONLY authorities threaded to the RPC (never client supplied).
 *
 * ── EVIDENCE-LINK ACTIVATION (AC6, R-709/R-814) ───────────────────────────────────────────────
 * An OPTIONAL uploaded evidence file id is re-validated as own-tenant-visible here; the atomic RPC
 * then creates and locks the `quote_acceptance`/`acceptance_evidence` link together with its parent
 * rows. An EXTERNAL reference persists without a link (the two evidence shapes are exclusive).
 *
 * ── AUDIT ALLOW-LIST (AC5) ────────────────────────────────────────────────────────────────────
 * The RPC writes a SINGLE audit row with `{ targetId }` ONLY — NO accepted price / channel /
 * customer / evidence PII in metadata. This command is deliberately not envelope-auditable, so it
 * cannot add a second audit row after the atomic transaction commits.
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import { evaluateAcceptancePriceGate } from "@/features/quotes/acceptance-price";
import {
  asAcceptAndCreateJobRpcClient,
  extractAcceptAndCreateJobResult,
  loadQuoteVersionAcceptanceSource,
  throwMappedQuoteWriteError,
} from "./quote-db";
import { ownerRecordVisible } from "../files/file-db";
import {
  validateCaptureQuoteAcceptance,
  type CaptureQuoteAcceptanceInput,
} from "./validation";

/** Result of the capture command — the created acceptance id under `targetId`. */
export interface CaptureQuoteAcceptanceResult {
  readonly targetId: string;
}

export const captureQuoteAcceptance = defineCommand<
  CaptureQuoteAcceptanceInput,
  CaptureQuoteAcceptanceResult
>({
  command: "quote.acceptance.capture",
  // The hardened RPC records the one audit row atomically on a fresh acceptance. Enabling the
  // envelope audit here would create a duplicate row after the transaction.
  auditable: false,
  eventType: "quote.acceptance.captured",
  targetType: "quote_acceptance",
  validateInput: validateCaptureQuoteAcceptance,
  // Ownership: the target version must be visible under the caller's RLS (own tenant). A foreign /
  // non-existent id → zero rows → TENANT_ACCESS_DENIED BEFORE execute (no existence disclosure).
  ownership: (input) => ({ table: "quote_versions", id: input.quote_version_id }),
  execute: async (ctx): Promise<CaptureQuoteAcceptanceResult> => {
    const db = ctx.db;
    const input = ctx.input;
    const versionId = input.quote_version_id;

    // ── THE SENT-STATE GATE (AC3) — load the version's REAL status + parent quote + frozen source
    // ── sent total. Ownership proved visibility; a null here is a race → deny.
    const source = await loadQuoteVersionAcceptanceSource(db, versionId);
    if (source === null) throw new CommandError("TENANT_ACCESS_DENIED");
    // Acceptance is legal ONLY on a SENT version — a generic VALIDATION_FAILED (no leaked status).
    if (source.status !== "sent") throw new CommandError("VALIDATION_FAILED");

    // Story 10.6: for snapshotSchemaVersion=2, loadQuoteVersionAcceptanceSource normalizes the
    // frozen payableOre into source_sent_total_ore; V1 rows still fall back to acceptedPriceOre.
    // ── THE ADJUSTED-PRICE GATE (AC2) — the SINGLE authority `evaluateAcceptancePriceGate` folds the
    // ── PURE delta computation (never ad hoc), the REASON_REQUIRED rule, and the `hasReason` (reason
    // ── OR evidence) presence into one OK/typed-failure the command RE-VALIDATES server-side (the
    // ── client cannot bypass by omitting a reason). An INVALID öre input OR a missing-reason failure
    // ── both map to the generic VALIDATION_FAILED.
    const gate = evaluateAcceptancePriceGate({
      acceptedPriceOre: input.accepted_price_ore,
      sourceSentTotalOre: source.source_sent_total_ore,
      hasReason:
        (typeof input.adjustment_reason === "string" &&
          input.adjustment_reason.trim().length > 0) ||
        (typeof input.evidence_reference === "string" &&
          input.evidence_reference.trim().length > 0) ||
        (typeof input.evidence_file_id === "string" &&
          input.evidence_file_id.length > 0),
    });
    if (!gate.ok) throw new CommandError("VALIDATION_FAILED");

    // ── EVIDENCE OWNERSHIP (AC6, R-709) — when an evidence file id is supplied, re-validate it is
    // ── own-tenant-visible BEFORE persisting (a foreign file id ⇒ TENANT_ACCESS_DENIED, the R-802
    // ── file-side check; the composite same-tenant FK re-enforces it at the INSERT too).
    if (typeof input.evidence_file_id === "string" && input.evidence_file_id.length > 0) {
      const visible = await ownerRecordVisible(db, "files", input.evidence_file_id);
      if (!visible) throw new CommandError("TENANT_ACCESS_DENIED");
    }

    // The historic capture symbol is now a compatibility facade over the exact same atomic RPC as
    // `acceptQuoteAndCreateJob`. It deliberately supplies no title/fault injection; those are not
    // part of the old capture contract. The actor and correlation are explicit, trusted envelope
    // values, never form fields.
    const rpc = asAcceptAndCreateJobRpcClient(db);
    const { data, error } = await rpc.rpc("accept_quote_and_create_job", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_quote_version_id: versionId,
      p_accepted_at: input.accepted_at,
      p_accepted_price_ore: input.accepted_price_ore,
      p_source_sent_total_ore: source.source_sent_total_ore,
      p_channel: input.channel ?? null,
      p_adjustment_reason: input.adjustment_reason ?? null,
      p_evidence_file_id: input.evidence_file_id ?? null,
      p_evidence_reference: input.evidence_reference ?? null,
      p_notes: input.notes ?? null,
      p_planned_start_date: input.planned_start_date ?? null,
      p_planned_end_date: input.planned_end_date ?? null,
      p_title: null,
      p_fault_inject: null,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
    });
    if (error) throwMappedQuoteWriteError(error);
    const result = extractAcceptAndCreateJobResult(data);
    if (result === null) {
      throw new Error("captureQuoteAcceptance: RPC returned no result");
    }

    return { targetId: result.acceptanceId };
  },
});
