/**
 * `generateQuotePdf` — the Story 6.3 quote-PDF generation command (architecture §12; R-606/
 * R-611/R-612/R-613).
 *
 * A `defineCommand` through the EXISTING envelope (resolve user → resolve active tenant_admin →
 * validate typed input → envelope `ownership` verifies the quote_version id is own-tenant-visible
 * → in execute: READ the FROZEN snapshot rows under the caller's RLS → build the PURE
 * `QuotePdfViewModel` → render the PDF bytes deterministically (injected timestamp) → reserve the
 * exact draft `files` metadata row on the RLS client → upload the private object to that reserved
 * path without replacement → activate its files/file_links record → write a quote_events row →
 * update the PDF-render columns → append-only audit
 * `{ targetId }`). No bespoke auth/error/audit mechanism.
 *
 * ── THE CANONICAL SOURCE-OF-TRUTH RULE (R-606; AC1 Money/Tax HIGH) ────────────────────────
 * The PDF reads ONLY the frozen `quote_versions` / `quote_version_lines` /
 * `quote_version_attachments` rows — NEVER the mutable `customers`, `company_settings`,
 * `quote_terms`, `calculation_*`, `work_roles`, or `articles`. Mutating any mutable source AFTER
 * the snapshot and regenerating leaves the customer-visible PDF byte/text-comparable. Every
 * money/VAT/total value is READ VERBATIM from the frozen öre and formatted via the single
 * formatter in the pure view model — never recomputed here.
 *
 * ── DETERMINISM (H3 / R-612) ──────────────────────────────────────────────────────────────
 * The render instant is INJECTED from the command's single `ctx.clock.now()` — no wall-clock
 * read in the pipeline. `pdf_generated_at` is set from the SAME instant. Repeated renders of the
 * same snapshot produce byte/text-comparable output (pinned renderer/fonts/locale).
 *
 * ── STORAGE THROUGH THE 8.1 FILE FOUNDATION (R-611/R-614) ─────────────────────────────────
 * The object path is SERVER-derived via `deriveObjectPath({ tenantId, fileId, displayName })`
 * (tenant-first — no client path trusted). The bytes are uploaded to the private `tenant-files`
 * bucket on the RLS client (NEVER service-role — the containment guard). 6.3 is the FIRST story
 * to write actual object BYTES (8.1 was metadata-first; the general upload path is Story 8.2 —
 * recorded as an 8.2-reconcile deferral). Because the object path must contain the SAME file id
 * as the `files` row, the file id is database-issued up front and the complete metadata row
 * (checksum, size, MIME, uploader, draft lifecycle) is reserved with that explicit id BEFORE any
 * Storage write. `create_file_with_link` self-allocates the id and cannot bind the path, so it is
 * not used here. A failed upload is compensated by archiving that reserved draft row.
 *
 * ── CONSISTENCY + RETRY (R-613) ───────────────────────────────────────────────────────────
 * `pdf_status` transitions: not_generated → generating → generated (success) / failed (fault).
 * A mid-pipeline failure sets `pdf_status='failed'` (retryable) — NEVER `generated` over a
 * missing file — and returns a generic retryable SERVER_ERROR (an infra fault is NOT conflated
 * with a not-authorized denial). Retry regenerates from the SAME immutable snapshot (retry is
 * allowed only while the version is draft. Once sent, the exact current PDF is commitment
 * evidence and regeneration requires the new-version flow. A draft retry creates one fresh active
 * `quote_pdf` link while archiving the superseded link/file metadata; bytes remain retained
 * (archive-over-delete — physical reclamation is deferred).
 *
 * Audit metadata is `{ targetId }` ONLY (no PII/money/customer/URL — §15).
 */
import { createHash } from "node:crypto";

import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import { deriveObjectPath, sanitizeNameSegment } from "@/server/storage/object-path";
import { renderQuotePdf } from "@/server/quote-pdf/render";
import {
  quotePdfAttestationSecretFromEnv,
  signQuotePdfAttestation,
  type QuotePdfAttestationPayload,
} from "@/server/quote-pdf/attestation";
import { buildQuotePdfViewModel } from "@/lib/quote-pdf";
import { isDeductionClassification, isVatType } from "@/lib/money";
import type {
  QuoteDeductionType,
  QuoteVersionSnapshot,
} from "@/lib/quote-snapshot";
import { adaptQuoteTaxSnapshot } from "@/lib/quote-snapshot";
import {
  asQuotePdfWriteClient,
  asQuotePdfRenderRpcClient,
  loadQuotePdfLifecycleState,
  loadQuoteVersionAttachmentSnapshots,
  loadQuoteVersionLineSnapshots,
  loadQuoteVersionSnapshot,
  type QuoteVersionLineSnapshotRow,
  type QuoteVersionSnapshotRow,
} from "./quote-db";
import {
  validateGenerateQuotePdf,
  type GenerateQuotePdfInput,
} from "./validation";

/** The private bucket every Phase A file lives in (single private bucket). */
const TENANT_FILES_BUCKET = "tenant-files";

/**
 * The server-only attestation binds the exact persisted SHA-256 to the render.
 * Story 10.8 reviewer authorization remains a separate authorization decision;
 * Storage is the authority for object existence and size/MIME metadata.
 */
function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Keep the persisted display name identical to the sanitized final Storage path
 * segment while preserving the required `.pdf` suffix inside the 128-code-unit
 * path bound.
 */
export function quotePdfDisplayName(quoteNumber: string | number | null): string {
  const safeStem = sanitizeNameSegment(`offert-${quoteNumber ?? "utkast"}`)
    .slice(0, 124)
    .replace(/[\uD800-\uDBFF]$/, "");
  return `${safeStem}.pdf`;
}

/** Result of `generateQuotePdf` — the version id (targetId) + the generated file id. */
export interface GenerateQuotePdfResult {
  readonly targetId: string;
  readonly fileId: string;
}

/** A deduction type narrowed to the closed snapshot union (else null). */
function deductionTypeOf(v: string | null): QuoteDeductionType | null {
  return v === "rot" || v === "gron_teknik" || v === "rot_and_green" ? v : null;
}

/** Map a frozen line-snapshot DB row into the pure snapshot line shape. */
function lineSnapshotOf(
  row: QuoteVersionLineSnapshotRow,
): QuoteVersionSnapshot["lines"][number] {
  if (
    row.deduction_classification !== null &&
    !isDeductionClassification(row.deduction_classification)
  ) {
    throw new CommandError("VALIDATION_FAILED");
  }
  if (row.vat_type !== null && !isVatType(row.vat_type)) {
    throw new CommandError("VALIDATION_FAILED");
  }
  return {
    sourceRowId: row.source_calculation_row_id,
    rowType: row.row_type,
    sortOrder: row.sort_order,
    label: row.label,
    description: row.description,
    quoteNote: row.quote_note,
    quantity: row.quantity,
    unit: row.unit,
    unitSellOre: row.unit_sell_ore,
    lineNetOre: row.line_net_ore,
    vatRateBp: row.vat_rate_bp,
    includedInInvoiceTotal: row.included_in_invoice_total,
    deductionClassification: row.deduction_classification,
    vatType: row.vat_type,
    isHidden: row.is_hidden,
    isOptional: row.is_optional,
    isSelected: row.is_selected,
  };
}

/**
 * Reconstruct the frozen `QuoteVersionSnapshot` from the DB rows the RLS read returned — the
 * INPUT surface `buildQuotePdfViewModel` consumes. The quote number DISPLAY reads
 * `quote_number_display ?? quote_number` off the row (the persisted truth — no §24 schema
 * invention; deferred-work 6-1). This carries ONLY the frozen customer-visible fields.
 */
function snapshotFromRows(
  version: QuoteVersionSnapshotRow,
  lines: readonly QuoteVersionLineSnapshotRow[],
  attachments: readonly { file_id: string; display_name: string | null; sort_order: number }[],
): QuoteVersionSnapshot {
  const quoteNumberDisplay =
    version.quote_number_display ??
    (version.quote_number !== null ? String(version.quote_number) : null);
  const tax = adaptQuoteTaxSnapshot({
    snapshotSchemaVersion: version.snapshot_schema_version,
    taxRuleVersion: version.tax_rule_version,
    taxAnswerSnapshot: version.tax_answer_snapshot,
    buyerVatNumber: version.buyer_vat_number,
    calculatedDeductionOre: version.calculated_deduction_ore,
    claimDeductionOre: version.claim_deduction_ore,
    payableOre: version.payable_ore,
    vatOre: version.vat_total_ore,
    deductionOre: version.deduction_total_ore,
    acceptedPriceOre: version.accepted_price_ore,
  });
  if (!tax.ok) throw new CommandError("VALIDATION_FAILED");
  return {
    calculationId: version.calculation_id,
    capturedAt: version.captured_at ?? "", // the frozen snapshot instant (view model ignores it)
    companyName: version.company_name,
    companyOrgNr: version.company_org_nr,
    companyAddressLine1: version.company_address_line1,
    companyAddressLine2: version.company_address_line2,
    companyPostalCode: version.company_postal_code,
    companyCity: version.company_city,
    companyEmail: version.company_email,
    companyPhone: version.company_phone,
    companyLogoUrl: version.company_logo_url,
    customerDisplayName: version.customer_display_name,
    customerType: version.customer_type,
    facilityName: version.facility_name,
    contactName: version.contact_name,
    quoteNumberDisplay,
    validUntil: version.valid_until,
    introText: version.intro_text,
    customerNotes: version.customer_notes,
    termsText: version.terms_text,
    termsApprovedAt: version.terms_approved_at,
    termsApprovedBy: version.terms_approved_by,
    baseTotalOre: version.base_total_ore,
    optionTotalOre: version.option_total_ore,
    vatTotalOre: version.vat_total_ore,
    deductionTotalOre: version.deduction_total_ore,
    acceptedPriceOre: version.accepted_price_ore,
    snapshotSchemaVersion: version.snapshot_schema_version,
    taxRuleVersion: version.tax_rule_version,
    taxAnswerSnapshot: tax.value.taxAnswer,
    buyerVatNumber: tax.value.buyerVatNumber,
    calculatedDeductionOre: tax.value.calculatedDeductionOre,
    claimDeductionOre: tax.value.claimDeductionOre,
    payableOre: tax.value.payableOre,
    netOre: tax.value.netOre,
    vatOre: tax.value.vatOre,
    grossOre: tax.value.grossOre,
    deductionOre: tax.value.deductionOre,
    vatRateBp: version.vat_rate_bp,
    vatDisplay: version.vat_display,
    deductionType: deductionTypeOf(version.deduction_type),
    deductionRateBp: version.deduction_rate_bp,
    deductionCapOre: version.deduction_cap_ore,
    deductionPersons: version.deduction_persons,
    requiresSignOff: version.requires_sign_off,
    displayMode: version.display_mode,
    lines: lines.map(lineSnapshotOf),
    attachments: attachments.map((a) => ({
      fileId: a.file_id,
      displayName: a.display_name,
      sortOrder: a.sort_order,
    })),
    warnings: version.warnings_snapshot.map((w) => ({
      code: w.code,
      severity: w.severity,
      message: w.message,
    })),
  };
}

export const generateQuotePdf = defineCommand<
  GenerateQuotePdfInput,
  GenerateQuotePdfResult
>({
  command: "quote.pdf.generate",
  // PDF lifecycle RPCs atomically record the actor/correlation audit.  Do not add a
  // second, post-transaction envelope audit that could survive a failed lifecycle.
  auditable: false,
  eventType: "quote.pdf.generated",
  targetType: "quote_version",
  validateInput: validateGenerateQuotePdf,
  // Envelope ownership: the target version must be visible under the caller's RLS (own tenant).
  // A foreign / non-existent id → zero rows → TENANT_ACCESS_DENIED, BEFORE execute (nothing is
  // rendered, uploaded, or persisted).
  ownership: (input) => ({ table: "quote_versions", id: input.quote_version_id }),
  execute: async (ctx): Promise<GenerateQuotePdfResult> => {
    const db = ctx.db;
    const tenantId = ctx.tenantContext.tenantId;
    const versionId = ctx.input.quote_version_id;
    // The SINGLE injected command instant (no wall-clock read anywhere in the pipeline).
    const nowIso = ctx.clock.now().toISOString();
    const writer = asQuotePdfWriteClient(db);
    const renderRpc = asQuotePdfRenderRpcClient(db);
    // Resolve this before reserving any metadata so a missing server secret fails
    // before a render can be left in flight. The DB independently requires the
    // matching Vault entry for this public key id.
    const attestationConfig = quotePdfAttestationSecretFromEnv();
    // Bind this render to the exact draft state BEFORE reading its snapshot. A later
    // customer-visible edit clears that binding; completion then refuses activation.
    // The database, rather than a caller-provided id, allocates the sole file UUID
    // that this render may ever activate or compensate.
    const startArgs: PdfRenderStartArgs = {
      p_tenant_id: tenantId,
      p_quote_version_id: versionId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_started_at: nowIso,
      p_attestation_key_id: attestationConfig.keyId,
    };
    let render: PdfRenderStart;
    try {
      // A committed start is idempotently recoverable with the SAME correlation.
      // Replay once when the first response is lost or malformed; a different
      // correlation would collide with the still-active five-minute lease.
      render = await startQuotePdfRenderWithRecovery(renderRpc, startArgs);
    } catch (error) {
      // If both response attempts were ambiguous, recover only this command's
      // database-issued identity and fail-compensate it. Never disturb a render
      // owned by another correlation, and preserve the original start failure.
      let compensationError: Error | null = null;
      try {
        const recovered = await loadQuotePdfLifecycleState(db, versionId);
        if (
          recovered?.pdf_status === "generating" &&
          recovered.pdf_render_file_id !== null &&
          recovered.pdf_render_correlation_id === ctx.correlationId
        ) {
          compensationError = await tryCompensateFailed(
            renderRpc, tenantId, versionId, recovered.pdf_render_file_id, nowIso,
            ctx.tenantContext.userId, ctx.correlationId,
          );
        }
      } catch (recoveryError) {
        compensationError = recoveryError instanceof Error
          ? recoveryError
          : new Error("PDF start-response recovery failed");
      }
      if (compensationError) {
        console.error("quote PDF render start-response compensation failed", {
          compensationError: compensationError.message,
        });
      }
      throw error;
    }
    if (render.completedFileId !== null) {
      return { targetId: versionId, fileId: render.completedFileId };
    }
    const generatedFileId = render.expectedFileId;

    try {
      // Everything after a successful start is under compensation, including all
      // snapshot reads. This ensures no retryable fault leaves `generating` behind.
      const version = await loadQuoteVersionSnapshot(db, versionId);
      if (version === null) throw new CommandError("TENANT_ACCESS_DENIED");
      if (version.status !== "draft") {
        throw new CommandError("VALIDATION_FAILED");
      }
      const lines = await loadQuoteVersionLineSnapshots(db, versionId);
      const attachments = await loadQuoteVersionAttachmentSnapshots(db, versionId);
      // ── Build the PURE view model (snapshot-only) + render deterministically. ──
      const viewModel = buildQuotePdfViewModel(
        snapshotFromRows(version, lines, attachments),
      );
      const bytes = await renderQuotePdf({ viewModel, renderedAt: nowIso });
      const checksum = sha256Hex(bytes);

      const fileId = generatedFileId;
      const displayName = quotePdfDisplayName(
        version.quote_number_display ?? version.quote_number,
      );
      const objectPath = deriveObjectPath({ tenantId, fileId, displayName });

      // ── Reserve exact DRAFT metadata through the narrow authenticated RPC FIRST. ──
      // It validates the database-issued render id, tenant/version binding, derived path, display,
      // byte size, SHA-256, fixed PDF MIME type, and uploader. No service-role or direct client
      // INSERT is involved; Storage only sees a path after its compensable draft row exists.
      const reservation = await renderRpc.rpc("reserve_quote_pdf_file", {
        p_tenant_id: tenantId,
        p_quote_version_id: versionId,
        p_file_id: fileId,
        p_object_path: objectPath,
        p_display_name: displayName,
        p_size_bytes: bytes.byteLength,
        p_checksum: checksum,
        p_actor_user_id: ctx.tenantContext.userId,
      });
      if (reservation.error) throwMappedPdfWriteError(reservation.error);
      const reservedFileId = extractReservedPdfFileId(reservation.data);
      if (reservedFileId !== fileId) {
        throw new Error("reserveQuotePdfFile: RPC did not return the expected file id");
      }

      // The private key is server-only and is never persisted, returned, or logged.
      // All provenance fields used below were issued/recomputed by the database or
      // reserved into the immutable metadata row before this signature is created.
      const { keyId, secret } = attestationConfig;
      if (keyId !== render.keyId) {
        throw new Error("quote PDF attestation key id changed during render");
      }
      const attestation: QuotePdfAttestationPayload = {
        tenantId,
        actorUserId: ctx.tenantContext.userId,
        quoteVersionId: versionId,
        renderFileId: fileId,
        contentFingerprint: render.contentFingerprint,
        bucketId: TENANT_FILES_BUCKET,
        objectPath,
        checksumSha256: checksum,
        sizeBytes: bytes.byteLength,
        mimeType: "application/pdf",
        correlationId: ctx.correlationId,
        keyId,
        issuedAt: render.issuedAt,
        expiresAt: render.expiresAt,
        generationStartedAt: render.generationStartedAt,
      };
      const signature = signQuotePdfAttestation(attestation, secret);

      // ── Upload the private object to the reserved path (NEVER service-role). ──
      // ── Storage RLS re-checks the tenant path prefix; a cross-tenant/spoof path is denied. ──
      const upload = await writer.storage
        .from(TENANT_FILES_BUCKET)
        .upload(objectPath, bytes, {
          contentType: "application/pdf",
          // Every render receives a database-issued fresh id/path. Never replace an object: the
          // draft metadata reservation makes its identity immutable before this upload begins.
          upsert: false,
        });
      if (upload.error) {
        // The catch below calls the atomic failure RPC, which archives this reserved draft metadata
        // (and a stale binding if present) before surfacing a retryable SERVER_ERROR.
        throw new Error(`quote pdf upload failed: ${upload.error.message ?? "?"}`);
      }

      // Atomically prove that the render binding still equals current draft content,
      // then archive/unlink the prior active PDF and activate this metadata/link.
      let completionError: { readonly code?: string; readonly message?: string } | null = null;
      try {
        const completion = await renderRpc.rpc(
          "complete_quote_pdf_render",
          {
            p_tenant_id: tenantId,
            p_quote_version_id: versionId,
            p_file_id: fileId,
            p_generated_at: nowIso,
            p_actor_user_id: ctx.tenantContext.userId,
            p_correlation_id: ctx.correlationId,
            p_attestation_key_id: keyId,
            p_attestation_issued_at: render.issuedAt,
            p_attestation_expires_at: render.expiresAt,
            p_attestation_signature: signature,
          },
        );
        completionError = completion.error;
      } catch (error) {
        // A network/response loss after the DB commit is not a failed render. Read
        // the authoritative state before compensating so we never archive the PDF
        // that is already current/generated.
        const recovered = await loadQuotePdfLifecycleState(db, versionId);
        if (recovered?.pdf_status === "generated" && recovered.pdf_file_id === fileId) {
          return { targetId: versionId, fileId };
        }
        throw error;
      }
      if (completionError) {
        const recovered = await loadQuotePdfLifecycleState(db, versionId);
        if (recovered?.pdf_status === "generated" && recovered.pdf_file_id === fileId) {
          return { targetId: versionId, fileId };
        }
        throwMappedPdfWriteError(completionError);
      }

      return { targetId: versionId, fileId };
    } catch (error) {
      // ── VERIFIED-COMPENSATED CONSISTENCY: any mid-pipeline fault leaves a RETRYABLE state. ──
      // The failure RPC atomically archives any expected metadata/link, sets the retryable state,
      // appends the lifecycle event, and records actor/correlation provenance. If the render was
      // invalidated concurrently, that checked RPC rejects its now-stale identity. Do not perform
      // a direct archive fallback: the failure may instead be a lost response AFTER completion,
      // in which case the current PDF must remain linked. A reserved quote-PDF draft is never
      // signable, so a stale failed reservation remains protected without a second writer.
      const compensationError = await tryCompensateFailed(
        renderRpc, tenantId, versionId, generatedFileId, nowIso,
        ctx.tenantContext.userId, ctx.correlationId,
      );
      // Preserve the primary failure, but never silently pretend cleanup succeeded.
      // Attach secondary diagnostics without changing the stable command mapping.
      if (compensationError) {
        console.error("quote PDF render compensation failed", {
          compensationError: compensationError?.message,
        });
      }
      // A CommandError (a deterministic authorization outcome) crosses as its stable code; a
      // plain Error (a transient render/upload/DB fault) maps to a retryable SERVER_ERROR at
      // the envelope — an infra fault is NEVER conflated with a not-authorized denial.
      throw error;
    }
  },
  auditFields: (ctx, result) => ({ targetId: result.targetId ?? ctx.input.quote_version_id }),
});

/**
 * Best-effort compensation: set pdf_status='failed' + append a `pdf_failed` quote_events row
 * (the failed→retryable transition). Swallows a secondary fault — the ORIGINAL error is what the
 * caller must see (never a false success). NEVER leaves `generated` over a missing file.
 */
async function tryCompensateFailed(
  rpc: ReturnType<typeof asQuotePdfRenderRpcClient>,
  tenantId: string,
  versionId: string,
  expectedFileId: string,
  nowIso: string,
  actorUserId: string,
  correlationId: string,
): Promise<Error | null> {
  try {
    const result = await rpc.rpc("fail_quote_pdf_render", {
      p_tenant_id: tenantId,
      p_quote_version_id: versionId,
      p_expected_file_id: expectedFileId,
      p_failed_at: nowIso,
      p_actor_user_id: actorUserId,
      p_correlation_id: correlationId,
    });
    return result.error ? new Error(result.error.message ?? "PDF failure compensation rejected") : null;
  } catch (error) {
    return error instanceof Error ? error : new Error("PDF failure compensation failed");
  }
}

interface PdfRenderStart {
  readonly expectedFileId: string;
  readonly completedFileId: string | null;
  readonly contentFingerprint: string;
  readonly keyId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly generationStartedAt: string;
}

interface PdfRenderStartArgs {
  readonly p_tenant_id: string;
  readonly p_quote_version_id: string;
  readonly p_actor_user_id: string;
  readonly p_correlation_id: string;
  readonly p_started_at: string;
  readonly p_attestation_key_id: string;
}

/**
 * Recover an ambiguous start response by replaying the idempotent RPC once with
 * the exact same correlation. A successful first commit returns the existing
 * render identity; a first call that never committed safely starts it on replay.
 */
export async function startQuotePdfRenderWithRecovery(
  rpc: ReturnType<typeof asQuotePdfRenderRpcClient>,
  args: PdfRenderStartArgs,
): Promise<PdfRenderStart> {
  let lastFailure: Error = new Error("startQuotePdfRender: RPC returned no expected file id");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let start: Awaited<ReturnType<typeof rpc.rpc>>;
    try {
      start = await rpc.rpc("start_quote_pdf_render", args);
    } catch (error) {
      lastFailure = error instanceof Error
        ? error
        : new Error("startQuotePdfRender: RPC response was lost");
      continue;
    }

    if (start.error) {
      // Postgres-coded denials are deterministic and cannot have committed.
      // A code-less transport/PostgREST response is ambiguous and safe to replay
      // because the same correlation is idempotent inside the start RPC.
      if (attempt === 0 && !start.error.code) {
        lastFailure = new Error(start.error.message ?? "startQuotePdfRender: RPC failed");
        continue;
      }
      throwMappedPdfWriteError(start.error);
    }

    const render = extractPdfRenderStart(start.data);
    if (render !== null) return render;
    lastFailure = new Error("startQuotePdfRender: RPC returned no expected file id");
  }

  throw lastFailure;
}

function extractPdfRenderStart(data: unknown): PdfRenderStart | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const value = row as Record<string, unknown>;
  const expectedFileId = value.expected_file_id;
  const completedFileId = value.completed_file_id;
  if (typeof completedFileId === "string") {
    return {
      expectedFileId: typeof expectedFileId === "string" ? expectedFileId : completedFileId,
      completedFileId,
      contentFingerprint: "",
      keyId: "",
      issuedAt: "",
      expiresAt: "",
      generationStartedAt: "",
    };
  }
  const values = [
    value.render_fingerprint,
    value.attestation_key_id,
    value.attestation_issued_at,
    value.attestation_expires_at,
    value.generation_started_at,
  ];
  if (typeof expectedFileId !== "string" || values.some((item) => typeof item !== "string")) {
    return null;
  }
  return {
    expectedFileId,
    completedFileId: null,
    contentFingerprint: value.render_fingerprint as string,
    keyId: value.attestation_key_id as string,
    issuedAt: value.attestation_issued_at as string,
    expiresAt: value.attestation_expires_at as string,
    generationStartedAt: value.generation_started_at as string,
  };
}

/** The reservation RPC returns its persisted file UUID as a scalar (PostgREST may wrap it once). */
function extractReservedPdfFileId(data: unknown): string | null {
  const value = Array.isArray(data) ? data[0] : data;
  return typeof value === "string" ? value : null;
}

/**
 * Map a Postgres error from a PDF-pipeline write to a stable command code (mirrors
 * `throwMappedQuoteWriteError`): the Story 8.4 file-lock RAISE (`FL823`) is a stable
 * FILE_LINK_LOCKED outcome — a protected `quote_pdf` link cannot be repointed. Story 10.9 makes
 * generation draft-only because the exact PDF becomes commitment evidence at send; subsequent
 * changes use the new-version flow. A same-tenant FK / RLS WITH CHECK violation is an
 * authorization outcome (TENANT_ACCESS_DENIED); a unique/check/malformed-uuid violation is
 * VALIDATION_FAILED; anything else is a transient fault → SERVER_ERROR (retryable). Throw the
 * CODE only — never the raw Postgres message (which can embed the object_path / tenant_id).
 */
function throwMappedPdfWriteError(error: {
  readonly code?: string;
  readonly message?: string;
}): never {
  switch (error.code) {
    // The Story 8.4 file-side lock RAISE — a protected quote_pdf link re-point surfaces the
    // stable FILE_LINK_LOCKED code (the shared family), not an opaque SERVER_ERROR.
    case "FL823":
      throw new CommandError("FILE_LINK_LOCKED");
    case "PFD10":
      throw new CommandError("VALIDATION_FAILED");
    case "23503":
    case "42501":
      throw new CommandError("TENANT_ACCESS_DENIED");
    case "23505":
    case "23514":
    case "22P02":
      throw new CommandError("VALIDATION_FAILED");
    default:
      throw new Error(`quote pdf write failed: ${error.code ?? "?"}`);
  }
}
