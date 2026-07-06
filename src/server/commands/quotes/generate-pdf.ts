/**
 * `generateQuotePdf` — the Story 6.3 quote-PDF generation command (architecture §12; R-606/
 * R-611/R-612/R-613).
 *
 * A `defineCommand` through the EXISTING envelope (resolve user → resolve active tenant_admin →
 * validate typed input → envelope `ownership` verifies the quote_version id is own-tenant-visible
 * → in execute: READ the FROZEN snapshot rows under the caller's RLS → build the PURE
 * `QuotePdfViewModel` → render the PDF bytes deterministically (injected timestamp) → upload the
 * private object on the RLS-client storage surface → persist files/file_links (find-or-create the
 * PDF link) → write a quote_events row → update the PDF-render columns → append-only audit
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
 * as the `files` row, the file id is server-generated up front and the `files` row is inserted
 * with that explicit id on the RLS client (own-tenant WITH CHECK) — `create_file_with_link`
 * self-allocates the id and cannot bind the path, so it is not used here.
 *
 * ── CONSISTENCY + RETRY (R-613) ───────────────────────────────────────────────────────────
 * `pdf_status` transitions: not_generated → generating → generated (success) / failed (fault).
 * A mid-pipeline failure sets `pdf_status='failed'` (retryable) — NEVER `generated` over a
 * missing file — and returns a generic retryable SERVER_ERROR (an infra fault is NOT conflated
 * with a not-authorized denial). Retry regenerates from the SAME immutable snapshot (retry is
 * allowed on draft AND sent versions — the PDF is DERIVED, not commitment data; 6.3 introduces
 * NO sent-lock trigger). A double-submit retry does NOT duplicate the `file_links` row: the ONE
 * `quote_pdf` link per version is FOUND and RE-POINTED to the new file (find-or-create, R-814);
 * the superseded prior object is left/archived (archive-over-delete — 8.1 has no reclamation).
 *
 * Audit metadata is `{ targetId }` ONLY (no PII/money/customer/URL — §15).
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import { deriveObjectPath } from "@/server/storage/object-path";
import { renderQuotePdf } from "@/server/quote-pdf/render";
import { buildQuotePdfViewModel } from "@/lib/quote-pdf";
import type {
  QuoteDeductionType,
  QuoteVersionSnapshot,
} from "@/lib/quote-snapshot";
import {
  asQuotePdfWriteClient,
  findExistingPdfLink,
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

/** Result of `generateQuotePdf` — the version id (targetId) + the generated file id. */
export interface GenerateQuotePdfResult {
  readonly targetId: string;
  readonly fileId: string;
}

/** A deduction type narrowed to the closed snapshot union (else null). */
function deductionTypeOf(v: string | null): QuoteDeductionType | null {
  return v === "rot" || v === "gron_teknik" ? v : null;
}

/** Map a frozen line-snapshot DB row into the pure snapshot line shape. */
function lineSnapshotOf(
  row: QuoteVersionLineSnapshotRow,
): QuoteVersionSnapshot["lines"][number] {
  return {
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
  auditable: true,
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

    // ── Read the FROZEN snapshot rows under the caller's RLS (ownership proved visibility). ──
    const version = await loadQuoteVersionSnapshot(db, versionId);
    if (version === null) throw new CommandError("TENANT_ACCESS_DENIED");
    const lines = await loadQuoteVersionLineSnapshots(db, versionId);
    const attachments = await loadQuoteVersionAttachmentSnapshots(db, versionId);

    // ── Mark generating (intermediate persist so the UI can show the `generating` state). ──
    // A failure here is a transient fault → SERVER_ERROR (nothing to compensate yet).
    await setPdfStatus(writer, versionId, "generating");

    try {
      // ── Build the PURE view model (snapshot-only) + render deterministically. ──
      const viewModel = buildQuotePdfViewModel(
        snapshotFromRows(version, lines, attachments),
      );
      const bytes = await renderQuotePdf({ viewModel, renderedAt: nowIso });

      // ── Server-generate the file id UP FRONT so the object path binds to the same id. ──
      const fileId = crypto.randomUUID();
      const displayName = `offert-${version.quote_number_display ?? version.quote_number ?? "utkast"}.pdf`;
      const objectPath = deriveObjectPath({ tenantId, fileId, displayName });

      // ── Upload the private object on the RLS client (NEVER service-role). storage.objects ──
      // ── RLS re-checks the tenant path prefix; a cross-tenant/spoof path is denied at the DB. ──
      const upload = await writer.storage
        .from(TENANT_FILES_BUCKET)
        .upload(objectPath, bytes, {
          contentType: "application/pdf",
          // upsert so a retry re-writing the same (fresh-id) path is idempotent.
          upsert: true,
        });
      if (upload.error) {
        // A storage fault is transient — surface as SERVER_ERROR (retryable), never a denial.
        throw new Error(`quote pdf upload failed: ${upload.error.message ?? "?"}`);
      }

      // ── Insert the `files` metadata row (explicit id = the object-path segment). RLS ──
      // ── WITH CHECK narrows to own tenant; a forged tenant_id fails 42501. ──
      const fileInsert = await writer
        .from("files")
        .insert({
          id: fileId,
          tenant_id: tenantId,
          bucket_id: TENANT_FILES_BUCKET,
          object_path: objectPath,
          display_name: displayName,
          mime_type: "application/pdf",
          size_bytes: bytes.byteLength,
          uploaded_by: ctx.tenantContext.userId,
          lifecycle_state: "linked",
        })
        .select("id");
      if (fileInsert.error) throwMappedPdfWriteError(fileInsert.error);

      // ── Find-or-create-or-repoint the ONE `quote_pdf` file_link for the version (R-814). ──
      const existingLink = await findExistingPdfLink(db, versionId);
      if (existingLink === null) {
        const linkInsert = await writer
          .from("file_links")
          .insert({
            tenant_id: tenantId,
            file_id: fileId,
            owner_type: "quote_version",
            owner_id: versionId,
            purpose: "quote_pdf",
          })
          .select("id");
        if (linkInsert.error) throwMappedPdfWriteError(linkInsert.error);
      } else {
        // Retry: RE-POINT the existing link to the new file (one link per version+purpose).
        // The superseded prior object is left/archived (archive-over-delete — 8.1 has no
        // object-reclamation path; a storage-retention story owns that).
        const linkUpdate = await writer
          .from("file_links")
          .update({ file_id: fileId })
          .eq("id", existingLink.id)
          .select("id");
        if (linkUpdate.error) throwMappedPdfWriteError(linkUpdate.error);
      }

      // ── Append a quote_events lifecycle row (pdf_generated). ──
      const eventInsert = await writer
        .from("quote_events")
        .insert({
          tenant_id: tenantId,
          quote_id: version.quote_id,
          quote_version_id: versionId,
          event_type: "pdf_generated",
          occurred_at: nowIso,
        })
        .select("id");
      if (eventInsert.error) throwMappedPdfWriteError(eventInsert.error);

      // ── Update the PDF-render columns to `generated` (pdf_file_id + injected timestamp). ──
      const versionUpdate = await writer
        .from("quote_versions")
        .update({
          pdf_file_id: fileId,
          pdf_generated_at: nowIso,
          pdf_status: "generated",
        })
        .eq("id", versionId)
        .select("id");
      if (versionUpdate.error) throwMappedPdfWriteError(versionUpdate.error);
      if (!versionUpdate.data || versionUpdate.data.length === 0) {
        // Visible under ownership but gone now (race) → deny rather than a false-generated.
        throw new CommandError("TENANT_ACCESS_DENIED");
      }

      return { targetId: versionId, fileId };
    } catch (error) {
      // ── VERIFIED-COMPENSATED CONSISTENCY: any mid-pipeline fault leaves a RETRYABLE state. ──
      // Set pdf_status='failed' so the version is never left `generated` over a missing file
      // (nor a stored object with no metadata), and append a `pdf_failed` quote_events row where
      // meaningful. A best-effort compensation write; if it also fails, the surfaced error is
      // still the original one (never a false success).
      await tryCompensateFailed(writer, tenantId, versionId, version.quote_id, nowIso);
      // A CommandError (a deterministic authorization outcome) crosses as its stable code; a
      // plain Error (a transient render/upload/DB fault) maps to a retryable SERVER_ERROR at
      // the envelope — an infra fault is NEVER conflated with a not-authorized denial.
      throw error;
    }
  },
  auditFields: (ctx, result) => ({ targetId: result.targetId ?? ctx.input.quote_version_id }),
});

/** UPDATE the PDF render-state column under the caller's RLS. */
async function setPdfStatus(
  writer: ReturnType<typeof asQuotePdfWriteClient>,
  versionId: string,
  status: "generating" | "generated" | "failed",
): Promise<void> {
  const { error } = await writer
    .from("quote_versions")
    .update({ pdf_status: status })
    .eq("id", versionId)
    .select("id");
  if (error) throwMappedPdfWriteError(error);
}

/**
 * Best-effort compensation: set pdf_status='failed' + append a `pdf_failed` quote_events row
 * (the failed→retryable transition). Swallows a secondary fault — the ORIGINAL error is what the
 * caller must see (never a false success). NEVER leaves `generated` over a missing file.
 */
async function tryCompensateFailed(
  writer: ReturnType<typeof asQuotePdfWriteClient>,
  tenantId: string,
  versionId: string,
  quoteId: string,
  nowIso: string,
): Promise<void> {
  try {
    await writer
      .from("quote_versions")
      .update({ pdf_status: "failed" })
      .eq("id", versionId)
      .select("id");
    await writer
      .from("quote_events")
      .insert({
        tenant_id: tenantId,
        quote_id: quoteId,
        quote_version_id: versionId,
        event_type: "pdf_failed",
        occurred_at: nowIso,
      })
      .select("id");
  } catch {
    // Swallow: the original error is what the caller must see (never a false success).
  }
}

/**
 * Map a Postgres error from a PDF-pipeline write to a stable command code (mirrors
 * `throwMappedQuoteWriteError`): a same-tenant FK / RLS WITH CHECK violation is an
 * authorization outcome (TENANT_ACCESS_DENIED); a unique/check/malformed-uuid violation is
 * VALIDATION_FAILED; anything else is a transient fault → SERVER_ERROR (retryable). Throw the
 * CODE only — never the raw Postgres message (which can embed the object_path / tenant_id).
 */
function throwMappedPdfWriteError(error: {
  readonly code?: string;
  readonly message?: string;
}): never {
  switch (error.code) {
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
