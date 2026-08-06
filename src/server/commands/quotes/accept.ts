/**
 * `captureQuoteAcceptance` — the Story 7.1 off-system acceptance-capture command (architecture §13
 * steps 1/3/5/6; ADR-A005; R-705/R-706/R-707/R-709).
 *
 * A `defineCommand` through the EXISTING envelope (resolve user → resolve active tenant_admin →
 * validate typed input → envelope `ownership` verifies the quote_version id is own-tenant-visible
 * → in execute: LOAD the version's real status + parent quote + frozen source sent total on the RLS
 * client → re-assert `status='sent'` (reject a non-sent with VALIDATION_FAILED) → re-validate the
 * adjusted-price + reason/evidence gate server-side via the PURE Task-3 `evaluateAcceptancePriceGate`
 * authority → persist the `quote_acceptances` row via an own-tenant RLS INSERT (a single-row
 * write — NOT the 7.2 RPC) → optionally link the evidence file → append-only audit `{ targetId }`).
 * No bespoke auth/error/audit mechanism. Patterned EXACTLY on `mark-sent.ts`.
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
 * gross) persist as integer öre. 7.1 persists via a plain own-tenant RLS INSERT (a single-row
 * write does not need the RPC — ADR-A009's narrow RPC is for the multi-record 7.2 transaction).
 * `accepted_at` is an EXPLICIT input (H1 determinism — the accepted moment is never a wall-clock
 * read); the injected `ctx.clock.now()` anchors only the command instant. The resolved
 * `ctx.tenantContext.tenantId` is the ONLY tenant authority (a client tenant id is never read).
 *
 * ── EVIDENCE-LINK ACTIVATION (AC6, R-709/R-814) ───────────────────────────────────────────────
 * An OPTIONAL uploaded evidence file id activates the `quote_acceptance` owner type +
 * `acceptance_evidence` purpose on the EXISTING 8.1 file model (find-or-create is NOT needed — 7.1
 * capture is single-shot, so exactly ONE link row is created). A foreign evidence file id ⇒
 * `TENANT_ACCESS_DENIED` (own-tenant RLS + the composite same-tenant FK). An EXTERNAL reference
 * (free text) goes into `quote_acceptances.evidence_reference` with NO file link (the two evidence
 * shapes are exclusive per capture). NO competing evidence-storage model is invented (R-814).
 *
 * ── AUDIT ALLOW-LIST (AC5) ────────────────────────────────────────────────────────────────────
 * A SINGLE audit row with `{ targetId }` ONLY — NO accepted price / channel / customer / evidence
 * PII in the metadata.
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import { evaluateAcceptancePriceGate } from "@/features/quotes/acceptance-price";
import {
  asQuoteAcceptanceWriteClient,
  loadQuoteVersionAcceptanceSource,
  throwMappedQuoteWriteError,
} from "./quote-db";
import {
  asFileRpcClient,
  ownerRecordVisible,
  throwMappedFileWriteError,
} from "../files/file-db";
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
  auditable: true,
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

    // ── PERSIST the acceptance via an own-tenant RLS INSERT (a single-row write — NOT the 7.2 RPC).
    // ── The resolved tenant is the ONLY tenant authority; `accepted_at` is the EXPLICIT input (H1).
    const writer = asQuoteAcceptanceWriteClient(db);
    const { data, error } = await writer
      .from("quote_acceptances")
      .insert({
        tenant_id: ctx.tenantContext.tenantId, // resolved tenant, never a client id
        quote_id: source.quote_id,
        quote_version_id: versionId,
        channel: input.channel ?? null,
        accepted_at: input.accepted_at, // explicit input instant (H1)
        accepted_price_ore: input.accepted_price_ore,
        source_sent_total_ore: source.source_sent_total_ore,
        adjustment_reason: input.adjustment_reason ?? null,
        evidence_file_id: input.evidence_file_id ?? null,
        evidence_reference: input.evidence_reference ?? null,
        notes: input.notes ?? null,
        planned_start_date: input.planned_start_date ?? null,
        planned_end_date: input.planned_end_date ?? null,
      })
      .select("id");
    // A duplicate capture of the same version raises 23505 → VALIDATION_FAILED (the sent-state gate
    // already blocks the common already-accepted case); a cross-tenant/FK/RLS reject → the mapper.
    if (error) throwMappedQuoteWriteError(error);
    const acceptanceId = extractAcceptanceId(data);
    if (acceptanceId === null) {
      throw new Error("captureQuoteAcceptance: INSERT returned no acceptance id");
    }

    // ── EVIDENCE LINK (AC6) — for an uploaded evidence file, materialize the 8.1 file_links row
    // ── (owner_type='quote_acceptance', purpose='acceptance_evidence') via the narrow RPC. Capture
    // ── is single-shot, so exactly ONE link is created (no find-or-create needed — R-814 reuse).
    if (typeof input.evidence_file_id === "string" && input.evidence_file_id.length > 0) {
      const rpc = asFileRpcClient(db);
      const { error: linkError } = await rpc.rpc("link_existing_file", {
        p_tenant_id: ctx.tenantContext.tenantId,
        p_file_id: input.evidence_file_id,
        p_owner_type: "quote_acceptance",
        p_owner_id: acceptanceId,
        p_purpose: "acceptance_evidence",
      });
      if (linkError) throwMappedFileWriteError(linkError);
    }

    return { targetId: acceptanceId };
  },
  // Audit allow-list is `{ targetId }` ONLY — NO price/channel/customer/evidence value.
  auditFields: (_ctx, result) => ({ targetId: result.targetId }),
});

/** Extract the created acceptance id from the INSERT result (row array or single object). */
function extractAcceptanceId(data: unknown): string | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (row && typeof row === "object" && "id" in row) {
    const id = (row as { id: unknown }).id;
    if (typeof id === "string") return id;
  }
  return null;
}
