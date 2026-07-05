/**
 * Quote-version command (Story 6.1, Task 3.2/3.3; architecture §5 command table, §11).
 *
 * `createQuoteVersionFromCalculation` — a `defineCommand` through the EXISTING envelope
 * (resolve user → resolve active tenant_admin → validate typed input → verify ownership
 * of the source calculation → in execute: read the snapshot-source rows under the
 * caller's RLS, verify each selected attachment file is own-tenant, build the FROZEN
 * composite snapshot via the pure builder, then call the narrow atomic RPC on the RLS
 * client → append-only audit → typed Result). No bespoke auth/error/audit mechanism.
 *
 * - The resolved tenant (`ctx.tenantContext.tenantId`) is the ONLY authority for every
 *   `tenant_id`; a client-supplied tenant_id is NEVER read.
 * - Source-calc ownership: the envelope `ownership` verifies the source calc belongs to
 *   the resolved tenant (a Tenant-B calculation_id → invisible under A's RLS →
 *   TENANT_ACCESS_DENIED BEFORE execute). Every selected attachment file id is ALSO
 *   re-validated for ownership in execute (a foreign file id → TENANT_ACCESS_DENIED),
 *   and the composite same-tenant FKs backstop a foreign id at the DB (23503).
 * - Signing/writing runs under the CALLER's request-bound RLS client (`ctx.db`) —
 *   NEVER a service-role key. The narrow SECURITY INVOKER RPC owns the transaction.
 * - The snapshot is built by the PURE `buildQuoteVersionSnapshot` — copy-by-value +
 *   deep Object.freeze + INJECTED capturedAt (the single command clock, never
 *   Date.now()); it CAPTURES state and computes nothing (the totals are engine-produced
 *   via `totals.ts` / `@/lib/money`, never re-derived here — R-505).
 * - Audit metadata carries NO PII/money/customer values: only `{ targetId }`.
 * - NO personnummer enters the snapshot or the RPC (the calc read + customer context
 *   take display/posture only, never PII).
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import {
  computeSectionTotal,
  type TotalsRowInput,
} from "@/features/calculations/totals";
import { classifyReadiness } from "@/features/calculations/readiness";
import { resolveVatDisplayPosture } from "@/features/calculations/vat-posture";
import {
  buildQuoteVersionSnapshot,
  type QuoteAttachmentSource,
  type QuoteLineSource,
  type QuoteVersionSnapshot,
} from "@/lib/quote-snapshot";
import {
  asQuoteRpcClient,
  loadCalcHeader,
  loadCalcRows,
  loadCalcSections,
  loadCompanyIdentity,
  loadCustomerDisplay,
  loadNameById,
  loadOwnedAttachmentFile,
  loadQuoteTerms,
  throwMappedQuoteWriteError,
  type CalcRowRow,
} from "./quote-db";
import {
  validateCreateQuoteVersionFromCalculation,
  type CreateQuoteVersionInput,
} from "./validation";

/** Result of `createQuoteVersionFromCalculation` — the new version id + quote id + number. */
export interface CreateQuoteVersionResult {
  readonly targetId: string;
  readonly quoteId: string;
  readonly quoteNumber: number;
}

/** The totals-engine row shape from a customer-visible calc row. */
function totalsRowOf(row: CalcRowRow): TotalsRowInput {
  return {
    quantity: row.quantity,
    unit_sell_ore: row.unit_sell_ore,
    vat_rate_bp: row.vat_rate_bp,
    is_hidden: row.is_hidden,
    is_optional: row.is_optional,
    is_selected: row.is_selected,
  };
}

/** The frozen line-snapshot SOURCE from a customer-visible calc row (NO cost/internal). */
function lineSourceOf(row: CalcRowRow, lineNetOre: number | null): QuoteLineSource {
  return {
    rowType: row.row_type,
    sortOrder: row.sort_order,
    label: row.label,
    description: row.description,
    // The customer-visible note ONLY — the calc row's internal_note is NEVER read (R-607).
    quoteNote: row.quote_note,
    quantity: row.quantity,
    unit: row.unit,
    unitSellOre: row.unit_sell_ore,
    lineNetOre,
    vatRateBp: row.vat_rate_bp,
    isHidden: row.is_hidden,
    isOptional: row.is_optional,
    isSelected: row.is_selected,
  };
}

export const createQuoteVersionFromCalculation = defineCommand<
  CreateQuoteVersionInput,
  CreateQuoteVersionResult
>({
  command: "quote.version.create",
  auditable: true,
  eventType: "quote.version.created",
  targetType: "quote_version",
  validateInput: validateCreateQuoteVersionFromCalculation,
  // Envelope ownership: the SOURCE calculation must be visible under the caller's RLS
  // (own tenant). A foreign / non-existent calc id → zero rows → TENANT_ACCESS_DENIED,
  // BEFORE execute.
  ownership: (input) => ({ table: "calculations", id: input.calculation_id }),
  execute: async (ctx): Promise<CreateQuoteVersionResult> => {
    const db = ctx.db;
    const tenantId = ctx.tenantContext.tenantId;
    const capturedAt = ctx.clock.now().toISOString();

    // ── Read the calc header (ownership already proved it is visible; null = race). ──
    const header = await loadCalcHeader(db, ctx.input.calculation_id);
    if (header === null) throw new CommandError("TENANT_ACCESS_DENIED");

    // ── Read the source sections + rows + identity + terms + customer context under RLS. ──
    const sections = await loadCalcSections(db, ctx.input.calculation_id);
    const sectionIds = sections.map((s) => s.id);
    const rows = await loadCalcRows(db, sectionIds);
    const identity = await loadCompanyIdentity(db);
    const terms = await loadQuoteTerms(db);
    const customer = await loadCustomerDisplay(db, header.customer_id);
    const facilityName = header.facility_id
      ? await loadNameById(db, "facilities", header.facility_id)
      : null;
    const contactName = header.contact_id
      ? await loadNameById(db, "contacts", header.contact_id)
      : null;

    // ── Re-validate EACH selected attachment file is own-tenant-visible (R-802). ──
    const attachments: QuoteAttachmentSource[] = [];
    let attachmentOrder = 0;
    for (const fileId of ctx.input.attachment_file_ids) {
      const file = await loadOwnedAttachmentFile(db, fileId);
      // A foreign / non-existent file id is invisible under RLS → TENANT_ACCESS_DENIED
      // (before any write; the composite same-tenant FK also backstops it at the DB).
      if (file === null) throw new CommandError("TENANT_ACCESS_DENIED");
      attachments.push({
        fileId: file.id,
        displayName: file.display_name,
        sortOrder: attachmentOrder,
      });
      attachmentOrder += 1;
    }

    // ── Compute the totals via the frozen engine (CAPTURE — never re-derive; R-505). ──
    const totalsRows = rows.map(totalsRowOf);
    const total = computeSectionTotal(totalsRows);
    // A rejected total means the calc cannot produce a valid customer total — a readiness
    // blocker that should not have reached the create-version path. Fail closed.
    if (!total.ok) throw new CommandError("VALIDATION_FAILED");

    // Base = the total NET of the NON-optional counted rows; option = the SELECTED-tillval
    // net; both from the engine (never inline math). An unselected option contributes to
    // neither (the engine's frozen inclusion pin).
    const baseRows = totalsRows.filter((r) => !r.is_optional);
    const optionRows = totalsRows.filter(
      (r) => r.is_optional && r.is_selected === true,
    );
    const baseTotal = computeSectionTotal(baseRows);
    const optionTotal = computeSectionTotal(optionRows);
    if (!baseTotal.ok || !optionTotal.ok) {
      throw new CommandError("VALIDATION_FAILED");
    }

    // Per-row line nets (for the frozen line snapshots) — CAPTURED from the engine.
    const lineNetByRowId = new Map<string, number | null>();
    for (const row of rows) {
      const line = computeSectionTotal([totalsRowOf(row)]);
      lineNetByRowId.set(row.id, line.ok ? line.value.netOre : null);
    }

    // ── Resolve the VAT display posture (presentation-only) + warnings (readiness). ──
    const vatPosture = resolveVatDisplayPosture(
      customer?.customer_type ?? null,
      (identity?.default_vat_display ?? null) as
        | "company_togglable"
        | "company_excl"
        | null,
    );
    // Classify readiness to CAPTURE the warnings at snapshot time (a disclosure of state).
    // The tax context stays demo-data-only (no calc field carries a ROT/grön assumption
    // yet — Epic 6 owns quote-version tax assumptions; captured as an unapproved estimate).
    const readiness = classifyReadiness({
      customer: {
        customer_id: header.customer_id,
        customer_display_name: customer?.display_name ?? null,
        customer_type: customer?.customer_type ?? null,
        facility_name: facilityName,
        contact_name: contactName,
      },
      sections: sections.map((s) => ({
        rows: rows
          .filter((r) => r.section_id === s.id)
          .map((r) => ({
            quantity: r.quantity,
            unit_sell_ore: r.unit_sell_ore,
            vat_rate_bp: r.vat_rate_bp,
            is_hidden: r.is_hidden,
            is_optional: r.is_optional,
            is_selected: r.is_selected,
            row_type: r.row_type as
              | "labor"
              | "material"
              | "subcontractor"
              | "machinery"
              | "other",
            unit_cost_ore: null,
            source_kind: null,
          })),
      })),
      vatPostureResolved: identity !== null,
      tax: { hasDeductionAssumption: false },
    });
    const warnings = [...readiness.blockers, ...readiness.warnings].map((w) => ({
      code: w.code,
      severity: w.severity,
      message: w.message,
    }));

    // ── Build the FROZEN composite snapshot (pure; injected capturedAt; captures state). ──
    const snapshot: QuoteVersionSnapshot = buildQuoteVersionSnapshot(
      {
        calculationId: ctx.input.calculation_id,
        company: {
          company_name: identity?.company_name ?? null,
          org_nr: identity?.org_nr ?? null,
          address_line1: identity?.address_line1 ?? null,
          address_line2: identity?.address_line2 ?? null,
          postal_code: identity?.postal_code ?? null,
          city: identity?.city ?? null,
          email: identity?.email ?? null,
          phone: identity?.phone ?? null,
          logo_url: identity?.logo_url ?? null,
        },
        customer: {
          customer_display_name: customer?.display_name ?? null,
          customer_type: customer?.customer_type ?? null,
          facility_name: facilityName,
          contact_name: contactName,
        },
        terms: terms
          ? {
              terms_text: terms.terms_text,
              approved_at: terms.approved_at,
              approved_by: terms.approved_by,
            }
          : null,
        totals: {
          baseTotalOre: baseTotal.value.netOre,
          optionTotalOre: optionTotal.value.netOre,
          vatTotalOre: total.value.vatOre,
          deductionTotalOre: 0,
          acceptedPriceOre: total.value.grossOre,
        },
        assumptions: {
          vatRateBp: identity?.vat_rate_bp ?? null,
          vatDisplay: vatPosture,
          deductionType: null,
          deductionRateBp: null,
          deductionCapOre: null,
          deductionPersons: null,
          // The standing UNAPPROVED-estimate marker (demo-data-only accept) so Story 6.4's
          // mark-sent path is fail-closed by construction.
          requiresSignOff: true,
        },
        header: {
          // The DISPLAY format is an open owner question (§24) — captured as null here (a
          // later story resolves the presentational form); the ALLOCATION is server-side.
          quoteNumberDisplay: null,
          validUntil: null,
          introText: null,
          customerNotes: null,
          displayMode: sections[0]?.display_mode ?? null,
        },
        lines: rows.map((r) => lineSourceOf(r, lineNetByRowId.get(r.id) ?? null)),
        attachments,
        warnings,
      },
      { capturedAt },
    );

    // ── Call the narrow atomic RPC on the RLS client (never service-role). ──
    // Serialize the frozen snapshot to a plain jsonb payload (the RPC reads it by key).
    const rpc = asQuoteRpcClient(db);
    const { data, error } = await rpc.rpc(
      "create_quote_version_from_calculation",
      {
        p_tenant_id: tenantId, // resolved tenant, never client id
        p_calculation_id: ctx.input.calculation_id,
        p_captured_at: capturedAt,
        p_customer_id: header.customer_id,
        p_facility_id: header.facility_id,
        p_contact_id: header.contact_id,
        p_snapshot: snapshotToPayload(snapshot),
        p_lines: linesToPayload(snapshot),
        p_attachments: attachmentsToPayload(snapshot),
      },
    );
    if (error) throwMappedQuoteWriteError(error);

    const parsed = extractRpcResult(data);
    if (parsed === null) {
      throw new Error("createQuoteVersionFromCalculation: RPC returned no result");
    }
    return {
      targetId: parsed.quoteVersionId,
      quoteId: parsed.quoteId,
      quoteNumber: parsed.quoteNumber,
    };
  },
  auditFields: (_ctx, result) => ({ targetId: result.targetId }),
});

/** The flat snapshot payload the RPC reads by key (the frozen fields, camelCase). */
function snapshotToPayload(s: QuoteVersionSnapshot): Record<string, unknown> {
  return {
    companyName: s.companyName,
    companyOrgNr: s.companyOrgNr,
    companyAddressLine1: s.companyAddressLine1,
    companyAddressLine2: s.companyAddressLine2,
    companyPostalCode: s.companyPostalCode,
    companyCity: s.companyCity,
    companyEmail: s.companyEmail,
    companyPhone: s.companyPhone,
    companyLogoUrl: s.companyLogoUrl,
    customerDisplayName: s.customerDisplayName,
    customerType: s.customerType,
    facilityName: s.facilityName,
    contactName: s.contactName,
    quoteNumberDisplay: s.quoteNumberDisplay,
    validUntil: s.validUntil,
    introText: s.introText,
    customerNotes: s.customerNotes,
    termsText: s.termsText,
    termsApprovedAt: s.termsApprovedAt,
    termsApprovedBy: s.termsApprovedBy,
    baseTotalOre: s.baseTotalOre,
    optionTotalOre: s.optionTotalOre,
    vatTotalOre: s.vatTotalOre,
    deductionTotalOre: s.deductionTotalOre,
    acceptedPriceOre: s.acceptedPriceOre,
    vatRateBp: s.vatRateBp,
    vatDisplay: s.vatDisplay,
    deductionType: s.deductionType,
    deductionRateBp: s.deductionRateBp,
    deductionCapOre: s.deductionCapOre,
    deductionPersons: s.deductionPersons,
    requiresSignOff: s.requiresSignOff,
    displayMode: s.displayMode,
    warnings: s.warnings,
  };
}

/** The line payload array the RPC reads (camelCase; NO cost/internal fields — R-607). */
function linesToPayload(s: QuoteVersionSnapshot): unknown[] {
  return s.lines.map((l) => ({
    rowType: l.rowType,
    sortOrder: l.sortOrder,
    label: l.label,
    description: l.description,
    quoteNote: l.quoteNote,
    quantity: l.quantity,
    unit: l.unit,
    unitSellOre: l.unitSellOre,
    lineNetOre: l.lineNetOre,
    vatRateBp: l.vatRateBp,
    isHidden: l.isHidden,
    isOptional: l.isOptional,
    isSelected: l.isSelected,
  }));
}

/** The attachment payload array the RPC reads (camelCase). */
function attachmentsToPayload(s: QuoteVersionSnapshot): unknown[] {
  return s.attachments.map((a) => ({
    fileId: a.fileId,
    displayName: a.displayName,
    sortOrder: a.sortOrder,
  }));
}

/** Extract the RPC result (row array or single object) into a typed shape. */
function extractRpcResult(
  data: unknown,
): { quoteId: string; quoteVersionId: string; quoteNumber: number } | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const r = row as {
    quote_id?: unknown;
    quote_version_id?: unknown;
    quote_number?: unknown;
  };
  if (typeof r.quote_id !== "string" || typeof r.quote_version_id !== "string") {
    return null;
  }
  // Raw pg / PostgREST can return a bigint as a string — coerce defensively.
  const num = Number(r.quote_number);
  if (!Number.isFinite(num)) return null;
  return {
    quoteId: r.quote_id,
    quoteVersionId: r.quote_version_id,
    quoteNumber: num,
  };
}
