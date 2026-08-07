/**
 * SHARED quote-version snapshot-build helper (Story 6.5, Task 1.3 / Dev Notes decision).
 *
 * EXTRACTED from the Story 6.1 `createQuoteVersionFromCalculation` execute body so the 6.1
 * create-from-calc command AND the 6.5 `createNewQuoteVersion` command cannot DRIFT — a fork of
 * the "read source rows → engine-totals → VAT posture → classify readiness → build the frozen
 * snapshot" sequence is the exact failure ADR-A009 warns against. Both commands RE-CAPTURE the
 * FRESH composite snapshot from the CURRENT authoritative calc/settings/terms rows via this ONE
 * pure-ish helper (it reads under the caller's RLS client and builds the frozen snapshot; it owns
 * NO transaction and writes NOTHING — the narrow RPC owns the write).
 *
 * ── RE-CAPTURE FRESH (Story 6.5 Dev Notes — the load-bearing design decision) ──────────────────
 * "Customer-visible content must change" means the admin has EDITED the source (calc lines/price/
 * VAT, settings, terms) and then spawns a version that captures the NEW state — so the new
 * version's snapshot is RE-CAPTURED FRESH from the current authoritative rows (source (a)), never a
 * verbatim clone of a prior frozen snapshot (source (b), which is only for a pure lifecycle-
 * supersede with no content change). This is why v2 DIFFERS from v1 (6.5-INT-01) while v1 stays
 * byte-unchanged (6.5-INT-02). The 6.1 create path uses the SAME re-capture; 6.5 reuses it verbatim.
 *
 * The snapshot is built by the PURE `buildQuoteVersionSnapshot` — copy-by-value + deep
 * Object.freeze + INJECTED capturedAt (the single command clock, never Date.now()); it CAPTURES
 * state and computes nothing (totals are engine-produced via `totals.ts` / `@/lib/money`, never
 * re-derived here — R-505). NO cost/margin/internal-note field (R-607); NO personnummer (the calc
 * read + customer context take display/posture only).
 *
 * [Source: src/server/commands/quotes/quotes.ts:112-286 (the 6.1 execute body EXTRACTED here);
 *  src/lib/quote-snapshot/build.ts (the pure builder); architecture.md#11 (freeze; a version
 *  captures current state) + #5 (injected capturedAt) + ADR-A009 (no fork); test-design-epic-6.md
 *  #6.5-INT-01, R-603/R-607/R-609]
 */
import { CommandError } from "../command-errors";
import {
  computeLineTotal,
  computeSectionTotal,
  type TotalsRowInput,
} from "@/features/calculations/totals";
import { classifyReadiness } from "@/features/calculations/readiness";
import { resolveVatDisplayPosture } from "@/features/calculations/vat-posture";
import {
  isRowType,
  taxSummaryCategoryForRowType,
} from "@/server/commands/calculations/validation";
import {
  buildTaxAnswerSnapshotV2,
  isDeductionClassification,
  isCustomerEligibilityPosture,
  isVatType,
  parseTaxInputSnapshot,
  type DeductionClassification,
  type VatType,
} from "@/lib/money";
import {
  buildQuoteVersionSnapshot,
  type QuoteAttachmentSource,
  type QuoteLineSource,
  type QuoteVersionSnapshot,
} from "@/lib/quote-snapshot";
import type { CommandDbClient } from "../envelope";
import {
  loadCalcHeader,
  loadCalcRows,
  loadCalcSections,
  loadCompanyIdentity,
  loadCustomerDisplay,
  loadNameById,
  loadOwnedAttachmentFile,
  loadQuoteTerms,
  type CalcRowRow,
} from "./quote-db";
import {
  buildQuoteReviewDigest,
  quoteReviewDigestsEqual,
} from "./review-token";

/** The totals-engine row shape from a customer-visible calc row. */
function totalsRowOf(row: CalcRowRow): TotalsRowInput {
  return {
    quantity: row.quantity,
    unit_sell_ore: row.unit_sell_ore,
    vat_rate_bp: row.vat_rate_bp,
    vat_type: vatTypeOf(row.vat_type),
    included_in_invoice_total: row.included_in_invoice_total,
    deduction_classification: deductionClassificationOf(row.deduction_classification),
    is_hidden: row.is_hidden,
    is_optional: row.is_optional,
    is_selected: row.is_selected,
  };
}

function vatTypeOf(value: string): VatType {
  if (!isVatType(value)) throw new CommandError("VALIDATION_FAILED");
  return value;
}

function deductionClassificationOf(value: string): DeductionClassification {
  if (!isDeductionClassification(value)) throw new CommandError("VALIDATION_FAILED");
  return value;
}

function summaryCategoryOf(rowType: string): "labor" | "material" | "other" {
  if (!isRowType(rowType)) throw new CommandError("VALIDATION_FAILED");
  return taxSummaryCategoryForRowType(rowType);
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
    includedInInvoiceTotal: row.included_in_invoice_total,
    deductionClassification: deductionClassificationOf(row.deduction_classification),
    vatType: vatTypeOf(row.vat_type),
    isHidden: row.is_hidden,
    isOptional: row.is_optional,
    isSelected: row.is_selected,
  };
}

/** The header + selected-attachment ids the caller resolved (from the calc or the parent version). */
export interface QuoteSnapshotBuildParams {
  readonly calculationId: string;
  /** The optional re-selected attachment file ids — each re-validated own-tenant here (R-802). */
  readonly attachmentFileIds: readonly string[];
  /** The build instant — the SINGLE injected command clock (ISO string), never Date.now(). */
  readonly capturedAt: string;
  readonly reviewedSnapshotDigest?: string | null;
  readonly reviewedQuoteCaptureDate?: string | null;
}

/** The resolved snapshot + the header ids the RPC needs (customer/facility/contact). */
export interface QuoteSnapshotBuildResult {
  readonly snapshot: QuoteVersionSnapshot;
  readonly customerId: string;
  readonly facilityId: string | null;
  readonly contactId: string | null;
}

/**
 * RE-CAPTURE the FRESH composite snapshot from the CURRENT source calc + settings + terms rows
 * under the caller's RLS client, EXACTLY as the 6.1 create path does. Throws a typed `CommandError`
 * on a null source (race → TENANT_ACCESS_DENIED), a foreign attachment (TENANT_ACCESS_DENIED), or
 * an uncomputable total (VALIDATION_FAILED). Returns the frozen snapshot + the header ids.
 */
export async function buildFreshQuoteSnapshot(
  db: CommandDbClient,
  params: QuoteSnapshotBuildParams,
): Promise<QuoteSnapshotBuildResult> {
  // ── Read the calc header (ownership already proved it visible; null = race). ──
  const header = await loadCalcHeader(db, params.calculationId);
  if (header === null) throw new CommandError("TENANT_ACCESS_DENIED");

  // ── Read the source sections + rows + identity + terms + customer context under RLS. ──
  const sections = await loadCalcSections(db, params.calculationId);
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
  for (const fileId of params.attachmentFileIds) {
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

  const quoteCaptureDate = params.capturedAt.slice(0, 10);
  const currentReviewDigest = buildQuoteReviewDigest({
    quoteCaptureDate,
    calculation: {
      id: header.id,
      status: header.status,
      customerId: header.customer_id,
      facilityId: header.facility_id,
      contactId: header.contact_id,
      taxInput: header.tax_input_snapshot,
    },
    sections: sections.map((section) => ({
      id: section.id,
      title: section.title,
      displayMode: section.display_mode,
      sortOrder: section.sort_order,
    })),
    rows: rows.map((row) => ({
      id: row.id,
      sectionId: row.section_id,
      rowType: row.row_type,
      quantity: row.quantity,
      unit: row.unit,
      unitCostOre: row.unit_cost_ore,
      unitSellOre: row.unit_sell_ore,
      vatRateBp: row.vat_rate_bp,
      includedInInvoiceTotal: row.included_in_invoice_total,
      deductionClassification: row.deduction_classification,
      vatType: row.vat_type,
      isHidden: row.is_hidden,
      isOptional: row.is_optional,
      isSelected: row.is_selected,
      label: row.label,
      description: row.description,
      quoteNote: row.quote_note,
      sortOrder: row.sort_order,
      sourceKind: row.source_kind,
    })),
    customer: {
      displayName: customer?.display_name ?? null,
      customerType: customer?.customer_type ?? null,
      facilityName,
      contactName,
    },
    company: identity === null ? null : {
      companyName: identity.company_name,
      orgNr: identity.org_nr,
      addressLine1: identity.address_line1,
      addressLine2: identity.address_line2,
      postalCode: identity.postal_code,
      city: identity.city,
      email: identity.email,
      phone: identity.phone,
      logoUrl: identity.logo_url,
      defaultVatDisplay: identity.default_vat_display,
      vatRateBp: identity.vat_rate_bp,
    },
    terms: terms === null ? null : {
      text: terms.terms_text,
      approvedAt: terms.approved_at,
      approvedBy: terms.approved_by,
    },
    attachments,
  });
  const reviewedDigest = params.reviewedSnapshotDigest ?? null;
  const reviewedDate = params.reviewedQuoteCaptureDate ?? null;
  if (
    (reviewedDigest !== null || reviewedDate !== null) &&
    (reviewedDigest === null ||
      reviewedDate !== quoteCaptureDate ||
      !quoteReviewDigestsEqual(reviewedDigest, currentReviewDigest))
  ) {
    throw new CommandError(
      "VALIDATION_FAILED",
      "Kalkylen har ändrats – öppna och granska en ny förhandsvisning.",
    );
  }

  // ── Compute the totals via the frozen engine (CAPTURE — never re-derive; R-505). ──
  const totalsRows = rows.map(totalsRowOf);
  const baseRows = totalsRows.filter((r) => !r.is_optional);
  const optionRows = totalsRows.filter((r) => r.is_optional);
  const baseTotal = computeSectionTotal(baseRows);
  const optionTotal = computeSectionTotal(optionRows);
  if (!baseTotal.ok || !optionTotal.ok) {
    throw new CommandError("VALIDATION_FAILED");
  }

  // Per-row line nets (for the frozen line snapshots) — CAPTURED from the engine.
  const lineNetByRowId = new Map<string, number | null>();
  for (const row of rows) {
    const line = computeLineTotal(totalsRowOf(row));
    lineNetByRowId.set(row.id, line.ok ? line.value.netOre : null);
  }

  const parsedTaxInput = parseTaxInputSnapshot(header.tax_input_snapshot);
  if (!parsedTaxInput.ok) throw new CommandError("VALIDATION_FAILED");
  const taxAnswer = buildTaxAnswerSnapshotV2({
    rows: rows.map((row) => ({
      id: row.id,
      netOre: lineNetByRowId.get(row.id) ?? 0,
      vatType: vatTypeOf(row.vat_type),
      rateBp: row.vat_rate_bp ?? 0,
      includedInInvoiceTotal: row.included_in_invoice_total,
      deductionClassification: deductionClassificationOf(row.deduction_classification),
      summaryCategory: summaryCategoryOf(row.row_type),
    })),
    taxInput: parsedTaxInput.value,
    quoteCaptureDate,
    customerEligibilityPosture: isCustomerEligibilityPosture(customer?.customer_type)
      ? customer.customer_type
      : (() => {
          throw new CommandError("VALIDATION_FAILED");
        })(),
  });
  if (!taxAnswer.ok) throw new CommandError("VALIDATION_FAILED");

  // ── Resolve the VAT display posture (presentation-only) + warnings (readiness). ──
  const vatPosture = resolveVatDisplayPosture(
    customer?.customer_type ?? null,
    (identity?.default_vat_display ?? null) as
      | "company_togglable"
      | "company_excl"
      | null,
  );
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
          unit_cost_ore: r.unit_cost_ore,
          unit_sell_ore: r.unit_sell_ore,
          vat_rate_bp: r.vat_rate_bp,
          vat_type: vatTypeOf(r.vat_type),
          included_in_invoice_total: r.included_in_invoice_total,
          deduction_classification: deductionClassificationOf(r.deduction_classification),
          is_hidden: r.is_hidden,
          is_optional: r.is_optional,
          is_selected: r.is_selected,
          row_type: r.row_type as
            | "labor"
            | "material"
            | "subcontractor"
            | "machinery"
            | "other",
          source_kind: r.source_kind as "work_role" | "article" | null,
        })),
    })),
    vatPostureResolved: identity !== null,
    tax: {
      hasDeductionAssumption: parsedTaxInput.value.deductionChoice !== "NONE",
      deductionType:
        parsedTaxInput.value.deductionChoice === "ROT"
          ? "rot"
          : parsedTaxInput.value.deductionChoice === "GREEN"
            ? "gron_teknik"
            : parsedTaxInput.value.deductionChoice === "ROT_AND_GREEN"
              ? "rot_and_gron_teknik"
              : undefined,
      eligibilityPosture: isCustomerEligibilityPosture(customer?.customer_type)
        ? customer.customer_type
        : undefined,
    },
  });
  const warnings = [...readiness.blockers, ...readiness.warnings].map((w) => ({
    code: w.code,
    severity: w.severity,
    message: w.message,
  }));

  // ── Build the FROZEN composite snapshot (pure; injected capturedAt; captures state). ──
  const snapshot: QuoteVersionSnapshot = buildQuoteVersionSnapshot(
    {
      calculationId: params.calculationId,
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
        vatTotalOre: taxAnswer.value.vatOre,
        deductionTotalOre: taxAnswer.value.deductionOre,
        acceptedPriceOre: taxAnswer.value.payableOre,
      },
      assumptions: {
        vatRateBp: identity?.vat_rate_bp ?? null,
        vatDisplay: vatPosture,
        deductionType:
          parsedTaxInput.value.deductionChoice === "ROT"
            ? "rot"
            : parsedTaxInput.value.deductionChoice === "GREEN"
              ? "gron_teknik"
              : parsedTaxInput.value.deductionChoice === "ROT_AND_GREEN"
                ? "rot_and_green"
                : null,
        deductionRateBp: null,
        deductionCapOre: null,
        deductionPersons: null,
        // Customer-declared applicability/allowance facts remain preliminary until externally
        // verified; the complete reconciled answer above is nevertheless frozen verbatim.
        requiresSignOff: true,
      },
      header: {
        // The DISPLAY format is an open owner question (§24) — captured as null here.
        quoteNumberDisplay: null,
        validUntil: null,
        introText: null,
        customerNotes: null,
        displayMode: sections[0]?.display_mode ?? null,
      },
      lines: rows.map((r) => lineSourceOf(r, lineNetByRowId.get(r.id) ?? null)),
      attachments,
      warnings,
      snapshotSchemaVersion: 2,
      taxRuleVersion: taxAnswer.value.taxRuleVersions.join("+"),
      taxAnswerSnapshot: taxAnswer.value,
      buyerVatNumber: taxAnswer.value.buyerVatNumber,
      calculatedDeductionOre: taxAnswer.value.calculatedDeductionOre,
      claimDeductionOre: taxAnswer.value.claimDeductionOre,
      payableOre: taxAnswer.value.payableOre,
      netOre: taxAnswer.value.netOre,
      vatOre: taxAnswer.value.vatOre,
      grossOre: taxAnswer.value.grossOre,
      deductionOre: taxAnswer.value.deductionOre,
    },
    { capturedAt: params.capturedAt },
  );

  return {
    snapshot,
    customerId: header.customer_id,
    facilityId: header.facility_id,
    contactId: header.contact_id,
  };
}

/** The flat snapshot payload the RPC reads by key (the frozen fields, camelCase). */
export function snapshotToPayload(
  s: QuoteVersionSnapshot,
): Record<string, unknown> {
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
    snapshotSchemaVersion: s.snapshotSchemaVersion,
    taxRuleVersion: s.taxRuleVersion,
    taxAnswerSnapshot: s.taxAnswerSnapshot,
    buyerVatNumber: s.buyerVatNumber,
    calculatedDeductionOre: s.calculatedDeductionOre,
    claimDeductionOre: s.claimDeductionOre,
    payableOre: s.payableOre,
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
export function linesToPayload(s: QuoteVersionSnapshot): unknown[] {
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
    includedInInvoiceTotal: l.includedInInvoiceTotal,
    deductionClassification: l.deductionClassification,
    vatType: l.vatType,
    isHidden: l.isHidden,
    isOptional: l.isOptional,
    isSelected: l.isSelected,
  }));
}

/** The attachment payload array the RPC reads (camelCase). */
export function attachmentsToPayload(s: QuoteVersionSnapshot): unknown[] {
  return s.attachments.map((a) => ({
    fileId: a.fileId,
    displayName: a.displayName,
    sortOrder: a.sortOrder,
  }));
}
