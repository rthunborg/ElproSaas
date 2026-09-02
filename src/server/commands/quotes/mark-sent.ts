/**
 * `markQuoteVersionSent` — the Story 6.4 mark-sent lifecycle command (architecture §5, §9, §11;
 * ADR-A009; R-605/R-608).
 *
 * A `defineCommand` through the EXISTING envelope (resolve user → resolve active tenant_admin →
 * validate typed input → envelope `ownership` verifies the quote_version id is own-tenant-visible
 * → in execute: LOAD the version's status + frozen send-gate fields on the RLS client → re-assert
 * `status='draft'` (reject a non-draft with QUOTE_VERSION_LOCKED) → evaluate the SEND GATE from the
 * SAME 5.4 classifier (reject a blocked version with VALIDATION_FAILED) → call the narrow atomic
 * download/hash/sign the current private PDF under the request-bound RLS client → call the
 * attested `mark_quote_version_sent` RPC (the caller timestamp is compatibility-only) → append-only
 * audit `{ targetId }`). No bespoke auth/error/audit mechanism.
 *
 * ── THE LOAD-BEARING ENFORCEMENT (a UI-only lock is a STOP CONDITION; R-605) ──────────────────
 * Immutability is proven at BOTH layers. LAYER 1 (here): the command re-asserts `status='draft'`
 * server-side BEFORE the transition and rejects a sent/accepted/… version with the stable typed
 * `QUOTE_VERSION_LOCKED` (distinct from 6.2's `QUOTE_VERSION_NOT_DRAFT`). LAYER 2 (the migration):
 * a DB trigger REJECTS a DIRECT own-tenant authenticated UPDATE of a locked column on a non-draft
 * row (architecture §9) — the UI read-only state is a convenience, never the guarantee.
 *
 * ── THE SEND GATE (R-608 — no forked rule table) ──────────────────────────────────────────────
 * "A draft that passes blocking readiness checks" is decided by `evaluateSendGate`, which consumes
 * the SAME 5.4 blocker-vs-warning classification frozen in the version's `warnings_snapshot` (the
 * 6.1 create path captured it via `classifyReadiness`). A version carrying ANY blocker-severity
 * issue is UNSENDABLE (→ VALIDATION_FAILED); warnings (incl. `TAX_SIGN_OFF_REQUIRED` /
 * `requires_sign_off`) NEVER gate. The sign-off posture is re-derived as SERVER TRUTH (Task 4.3) —
 * demo-data-only accepted, never a hard terms-approval block.
 *
 * ── THE NARROW ATOMIC RPC (ADR-A009) ──────────────────────────────────────────────────────────
 * The transition (status flip + `sent` event) is a transaction-sensitive multi-write and goes
 * through `mark_quote_version_sent` (checked SECURITY DEFINER, own-tenant tenant-admin only, no
 * service-role client, empty search_path). It consumes the one-time review authority and commits
 * the transition/event/audit atomically. Lifecycle/audit timestamps are database-owned; the
 * legacy caller timestamp is ignored as evidence. The resolved tenant is the only tenant
 * authority. Audit metadata is `{ targetId }` only — no PII/money/customer/channel value.
 */
import { createHash } from "node:crypto";

import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import { evaluateSendGate } from "@/features/quotes/send-gate";
import {
  quotePdfAttestationSecretFromEnv,
  signQuotePdfAttestation,
  type QuotePdfAttestationPayload,
} from "@/server/quote-pdf/attestation";
import {
  asMarkSentRpcClient,
  asQuoteReviewAuthorizationRpcClient,
  extractQuotePdfSendAttestationChallenge,
  extractQuoteReviewAuthorizationId,
  loadQuoteVersionSendGate,
  loadQuoteVersionStatus,
  throwMappedQuoteWriteError,
} from "./quote-db";
import {
  validateMarkQuoteVersionSent,
  type MarkQuoteVersionSentInput,
} from "./validation";

/**
 * Sending a commitment defaults to the real-customer track. Disposable demo deployments must
 * opt in explicitly; an absent or malformed environment value therefore cannot accidentally
 * weaken the tax sign-off gate in production.
 */
function quoteSendCustomerDataTrack(): "demo" | "real_customer" {
  return process.env.ELPRO_QUOTE_SEND_TRACK === "demo" ? "demo" : "real_customer";
}

/** Result of the mark-sent command — the sent version id under `targetId`. */
export interface MarkQuoteVersionSentResult {
  readonly targetId: string;
}

export const markQuoteVersionSent = defineCommand<
  MarkQuoteVersionSentInput,
  MarkQuoteVersionSentResult
>({
  command: "quote.version.mark_sent",
  auditable: false,
  eventType: "quote.version.sent",
  targetType: "quote_version",
  validateInput: validateMarkQuoteVersionSent,
  // Ownership: the target version must be visible under the caller's RLS (own tenant). A foreign
  // / non-existent id → zero rows → TENANT_ACCESS_DENIED BEFORE execute (nothing is sent).
  ownership: (input) => ({ table: "quote_versions", id: input.quote_version_id }),
  execute: async (ctx): Promise<MarkQuoteVersionSentResult> => {
    const db = ctx.db;
    const versionId = ctx.input.quote_version_id;

    // ── LAYER 1 — the command-side sent-immutability guard (R-605). Ownership proved the row is ──
    // ── visible; load its REAL current status and reject anything but a draft.                  ──
    const status = await loadQuoteVersionStatus(db, versionId);
    // Visible under ownership but gone now (race) → deny rather than 500.
    if (status === null) throw new CommandError("TENANT_ACCESS_DENIED");
    // A sent/accepted/rejected/expired/superseded version is LOCKED — cannot be (re)sent.
    if (status !== "draft") throw new CommandError("QUOTE_VERSION_LOCKED");

    // ── THE SEND GATE (R-608) — consume the SAME 5.4 classifier frozen in warnings_snapshot; a ──
    // ── blocked draft is UNSENDABLE. Re-derive the sign-off posture as server truth (Task 4.3). ──
    const gateRow = await loadQuoteVersionSendGate(db, versionId);
    if (gateRow === null) throw new CommandError("TENANT_ACCESS_DENIED");
    const gate = evaluateSendGate({
      warningsSnapshot: gateRow.warnings_snapshot,
      signOff: {
        requiresSignOff: gateRow.requires_sign_off,
        termsApprovedAt: gateRow.terms_approved_at,
        customerDataTrack: quoteSendCustomerDataTrack(),
      },
    });
    // A blocked draft cannot be sent — a generic VALIDATION_FAILED (no leaked blocker detail).
    if (!gate.canSend) throw new CommandError("VALIDATION_FAILED");

    // A governed draft may only become a customer commitment with the PDF that was
    // rendered from its current customer-visible content. The matching DB invariant
    // in Story 10.9 is the race-safe authority; this preflight gives normal callers
    // the stable validation result before invoking the lifecycle RPC. Historical
    // already-sent versions are never routed through this draft-only command.
    if (
      gateRow.pdf_status !== "generated" ||
      gateRow.pdf_file_id === null ||
      gateRow.pdf_content_fingerprint === null
    ) {
      throw new CommandError("VALIDATION_FAILED");
    }

    // Obtain a short-lived, database-issued description of the exact current PDF. The
    // server then downloads those bytes through the SAME request-bound RLS client and
    // independently checks the immutable size/SHA-256 metadata before signing. Neither
    // the Vault secret nor the resulting HMAC is review authority; the separate one-time
    // Story 10.8 authorization below remains the human-review decision.
    const rpc = asMarkSentRpcClient(db);
    const attestationConfig = quotePdfAttestationSecretFromEnv();
    const prepared = await rpc.rpc("prepare_quote_pdf_send_attestation", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_quote_version_id: versionId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_attestation_key_id: attestationConfig.keyId,
    });
    if (prepared.error) throwMappedQuoteWriteError(prepared.error);
    const challenge = extractQuotePdfSendAttestationChallenge(prepared.data);
    if (
      challenge === null ||
      challenge.fileId !== gateRow.pdf_file_id ||
      challenge.contentFingerprint !== gateRow.pdf_content_fingerprint ||
      challenge.keyId !== attestationConfig.keyId
    ) {
      throw new CommandError("VALIDATION_FAILED");
    }
    const downloaded = await rpc.storage
      .from(challenge.bucketId)
      .download(challenge.objectPath);
    if (downloaded.error || downloaded.data === null) {
      throw new Error("quote PDF download failed before final send");
    }
    const pdfBytes = new Uint8Array(await downloaded.data.arrayBuffer());
    if (
      pdfBytes.byteLength !== challenge.sizeBytes ||
      createHash("sha256").update(pdfBytes).digest("hex") !== challenge.checksumSha256
    ) {
      throw new CommandError("VALIDATION_FAILED");
    }
    const attestation: QuotePdfAttestationPayload = {
      tenantId: ctx.tenantContext.tenantId,
      actorUserId: ctx.tenantContext.userId,
      quoteVersionId: versionId,
      renderFileId: challenge.fileId,
      contentFingerprint: challenge.contentFingerprint,
      bucketId: challenge.bucketId,
      objectPath: challenge.objectPath,
      checksumSha256: challenge.checksumSha256,
      sizeBytes: challenge.sizeBytes,
      mimeType: challenge.mimeType,
      correlationId: ctx.correlationId,
      keyId: challenge.keyId,
      issuedAt: challenge.issuedAt,
      expiresAt: challenge.expiresAt,
      generationStartedAt: challenge.generationStartedAt,
    };
    const signature = signQuotePdfAttestation(attestation, attestationConfig.secret);

    // Issue the distinct one-time reviewer authority only after byte verification,
    // then consume both proofs in the same database transaction as the commitment.
    const authorityRpc = asQuoteReviewAuthorizationRpcClient(db);
    const authorization = await authorityRpc.rpc("authorize_quote_final_send", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_quote_version_id: versionId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
    });
    if (authorization.error) throwMappedQuoteWriteError(authorization.error);
    const authorizationId = extractQuoteReviewAuthorizationId(authorization.data);
    if (authorizationId === null) {
      throw new Error("authorizeQuoteFinalSend: RPC returned no authorization id");
    }

    const { error } = await rpc.rpc("mark_quote_version_sent", {
      p_tenant_id: ctx.tenantContext.tenantId, // resolved tenant, never a client id
      p_quote_version_id: versionId,
      p_authorization_id: authorizationId,
      p_sent_at: ctx.clock.now().toISOString(),
      p_channel: ctx.input.channel ?? null,
      p_reference: ctx.input.reference ?? null,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_attestation_key_id: challenge.keyId,
      p_attestation_issued_at: challenge.issuedAt,
      p_attestation_expires_at: challenge.expiresAt,
      p_attestation_signature: signature,
    });
    // Map the RPC's not-draft assertion (a race) → QUOTE_VERSION_LOCKED; other codes per the mapper.
    if (error) throwMappedQuoteWriteError(error);

    return { targetId: versionId };
  },
  // Audit allow-list is `{ targetId }` ONLY — NO channel/reference/customer/money value.
});
