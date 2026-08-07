/**
 * Story 6.1 — the PURE composite quote-version snapshot BUILDER (copy-by-value + deep
 * Object.freeze + injected clock; captures STATE, computes NOTHING).
 *
 * It takes the ALREADY-RESOLVED source inputs (calc detail, FULL company identity from
 * the live settings row, the terms row, the engine-produced totals, the resolved
 * VAT/tax assumptions, the readiness warnings, the selected attachment metadata) and
 * returns a deeply-frozen `QuoteVersionSnapshot`. It does NO I/O, NO DB access, and NO
 * clock read — the build instant is INJECTED via `opts.capturedAt`.
 *
 * ── R-603 FREEZE ─────────────────────────────────────────────────────────────────
 * Every field is copied BY VALUE (primitives / freshly-mapped arrays) out of the
 * source and the whole result is DEEP-frozen (the value + its nested line/attachment/
 * warning arrays + each element), so no later mutation of any source can reach the
 * snapshot, and a post-build mutation attempt throws/no-ops.
 *
 * ── R-607 CUSTOMER-VISIBLE ONLY ──────────────────────────────────────────────────
 * The line builder reads ONLY the customer-visible calc-row fields and NEVER copies
 * `internal_note` / `unit_cost_ore` / `markup_bp` — they are dropped by construction.
 *
 * ── CAPTURE, DON'T COMPUTE ───────────────────────────────────────────────────────
 * Totals are STORED from the engine-produced state the caller passes in (never re-
 * derived here); öre stay integer öre; VAT/deduction rates stay basis points; terms
 * `approvedAt` is captured VERBATIM (NULL = not-approved).
 *
 * PURE MODULE — no `src/server` import (the layer-inversion trap; resolved values are
 * passed IN). Mirrors `src/lib/snapshots/build.ts` exactly.
 *
 * [Source: architecture.md#11; src/lib/snapshots/build.ts (the freeze pattern); project-
 *  context.md#Money/Tax rules (snapshot-source contract: copy-by-value + Object.freeze +
 *  injected capturedAt + captures-state-computes-nothing); test-design-epic-6.md
 *  #6.1-UNIT-01/02, #6.1-INT-03/04, R-603/R-607.]
 */
import type {
  DeductionClassification,
  TaxAnswerSnapshotV2,
  VatType,
} from "@/lib/money";
import {
  adaptQuoteTaxSnapshot,
  parseTaxAnswerSnapshotV2,
} from "./tax-compat";
import type {
  QuoteDeductionType,
  QuoteSnapshotBuildOptions,
  QuoteVersionAttachmentSnapshot,
  QuoteVersionLineSnapshot,
  QuoteVersionSnapshot,
  QuoteVersionWarningSnapshot,
} from "./types";

/** FULL company identity source (the LIVE company_settings row — all PDF fields). */
export interface CompanyIdentitySource {
  readonly company_name: string | null;
  readonly org_nr: string | null;
  readonly address_line1: string | null;
  readonly address_line2: string | null;
  readonly postal_code: string | null;
  readonly city: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly logo_url: string | null;
}

/** Customer/facility/contact DISPLAY source (display fields ONLY — never a personnummer). */
export interface QuoteCustomerContextSource {
  readonly customer_display_name: string | null;
  readonly customer_type: string | null;
  readonly facility_name: string | null;
  readonly contact_name: string | null;
}

/** The terms + sign-off source (captured VERBATIM; NULL approved_at = not-approved). */
export interface QuoteTermsSource {
  readonly terms_text: string | null;
  readonly approved_at: string | null;
  readonly approved_by: string | null;
}

/** The engine-produced totals (integer öre) the snapshot STORES (never re-derives). */
export interface QuoteTotalsSource {
  readonly baseTotalOre: number;
  readonly optionTotalOre: number;
  readonly vatTotalOre: number;
  readonly deductionTotalOre: number;
  readonly acceptedPriceOre: number;
}

/** The resolved VAT/tax assumptions (basis points; the UNAPPROVED estimate posture). */
export interface QuoteAssumptionsSource {
  readonly vatRateBp: number | null;
  readonly vatDisplay: string | null;
  readonly deductionType: QuoteDeductionType | null;
  readonly deductionRateBp: number | null;
  readonly deductionCapOre: number | null;
  readonly deductionPersons: number | null;
  /** The standing sign-off marker — defaults to `true` (an UNAPPROVED estimate). */
  readonly requiresSignOff: boolean;
}

/**
 * A calc row as the line builder reads it — the CUSTOMER-VISIBLE fields only. It
 * DELIBERATELY does NOT declare `internal_note` / `unit_cost_ore` / `markup_bp`, so a
 * consumer passing the full calc row cannot leak them into the snapshot (they are not
 * read). `lineNetOre` is the engine-produced net for the row (passed in, not computed).
 */
export interface QuoteLineSource {
  readonly rowType: string;
  readonly sortOrder: number;
  readonly label: string | null;
  readonly description: string | null;
  /** The customer-visible note (the calc row's `quote_note` — NEVER `internal_note`). */
  readonly quoteNote: string | null;
  readonly quantity: number | null;
  readonly unit: string | null;
  readonly unitSellOre: number | null;
  /** The engine-produced line net (integer öre — CAPTURED, never re-derived here). */
  readonly lineNetOre: number | null;
  readonly vatRateBp: number | null;
  readonly includedInInvoiceTotal?: boolean | null;
  readonly deductionClassification?: DeductionClassification | null;
  readonly vatType?: VatType | null;
  readonly isHidden: boolean;
  readonly isOptional: boolean;
  readonly isSelected: boolean | null;
}

/** A selected-attachment metadata source (an own-tenant-verified file + its display name). */
export interface QuoteAttachmentSource {
  readonly fileId: string;
  readonly displayName: string | null;
  readonly sortOrder: number;
}

/** A readiness warning source (the classifier code/severity/message). */
export interface QuoteWarningSource {
  readonly code: string;
  readonly severity: string;
  readonly message: string;
}

/** Presentation + quote-number fields resolved by the caller (never a schema blocker). */
export interface QuoteHeaderSource {
  /** The presentational quote number form (§24 display format — captured as a string). */
  readonly quoteNumberDisplay: string | null;
  readonly validUntil: string | null;
  readonly introText: string | null;
  readonly customerNotes: string | null;
  readonly displayMode: string | null;
}

/** The full set of already-resolved inputs the pure composite builder consumes. */
export interface QuoteVersionSnapshotInput {
  readonly calculationId: string;
  readonly company: CompanyIdentitySource;
  readonly customer: QuoteCustomerContextSource;
  readonly terms: QuoteTermsSource | null;
  readonly totals: QuoteTotalsSource;
  readonly assumptions: QuoteAssumptionsSource;
  readonly header: QuoteHeaderSource;
  readonly lines: readonly QuoteLineSource[];
  readonly attachments: readonly QuoteAttachmentSource[];
  readonly warnings: readonly QuoteWarningSource[];
  readonly snapshotSchemaVersion?: number | null;
  readonly taxRuleVersion?: string | null;
  readonly taxAnswerSnapshot?: TaxAnswerSnapshotV2 | null;
  readonly buyerVatNumber?: string | null;
  readonly calculatedDeductionOre?: number | null;
  readonly claimDeductionOre?: number | null;
  readonly payableOre?: number | null;
  readonly netOre?: number | null;
  readonly vatOre?: number | null;
  readonly grossOre?: number | null;
  readonly deductionOre?: number | null;
}

/** Build ONE frozen customer-visible line snapshot (drops cost/margin/internal by construction). */
function buildLineSnapshot(row: QuoteLineSource): QuoteVersionLineSnapshot {
  return Object.freeze({
    rowType: row.rowType,
    sortOrder: row.sortOrder,
    label: row.label,
    description: row.description,
    quoteNote: row.quoteNote,
    quantity: row.quantity,
    unit: row.unit,
    unitSellOre: row.unitSellOre,
    lineNetOre: row.lineNetOre,
    vatRateBp: row.vatRateBp,
    includedInInvoiceTotal: row.includedInInvoiceTotal ?? null,
    deductionClassification: row.deductionClassification ?? null,
    vatType: row.vatType ?? null,
    isHidden: row.isHidden,
    isOptional: row.isOptional,
    isSelected: row.isSelected,
  } satisfies QuoteVersionLineSnapshot);
}

/** Build ONE frozen attachment metadata snapshot (display name captured by value). */
function buildAttachmentSnapshot(
  att: QuoteAttachmentSource,
): QuoteVersionAttachmentSnapshot {
  return Object.freeze({
    fileId: att.fileId,
    displayName: att.displayName,
    sortOrder: att.sortOrder,
  } satisfies QuoteVersionAttachmentSnapshot);
}

/** Build ONE frozen warning snapshot (the disclosure of readiness state — no PII). */
function buildWarningSnapshot(w: QuoteWarningSource): QuoteVersionWarningSnapshot {
  return Object.freeze({
    code: w.code,
    severity: w.severity,
    message: w.message,
  } satisfies QuoteVersionWarningSnapshot);
}

/**
 * Build the immutable COMPOSITE `QuoteVersionSnapshot` — copy every field by value out
 * of the resolved inputs, freeze each nested element, then deep-freeze the whole value
 * (the value + its `lines`/`attachments`/`warnings` arrays are all frozen). The build
 * instant is INJECTED via `opts.capturedAt` — the builder reads no clock and mutates no
 * source (it CAPTURES state and COMPUTES nothing new; totals are stored from the
 * engine-produced state the caller passes in).
 */
export function buildQuoteVersionSnapshot(
  input: QuoteVersionSnapshotInput,
  opts: QuoteSnapshotBuildOptions,
): QuoteVersionSnapshot {
  const lines = Object.freeze(input.lines.map(buildLineSnapshot));
  const attachments = Object.freeze(
    input.attachments.map(buildAttachmentSnapshot),
  );
  const warnings = Object.freeze(input.warnings.map(buildWarningSnapshot));
  const isV2 = input.snapshotSchemaVersion === 2;
  const parsedTaxAnswer = input.taxAnswerSnapshot === null || input.taxAnswerSnapshot === undefined
    ? null
    : parseTaxAnswerSnapshotV2(input.taxAnswerSnapshot);
  if (parsedTaxAnswer !== null && !parsedTaxAnswer.ok) {
    throw new TypeError("Invalid V2 quote tax answer snapshot");
  }
  if (isV2 && parsedTaxAnswer === null) {
    throw new TypeError("A V2 quote requires a complete tax answer snapshot");
  }
  if (!isV2 && parsedTaxAnswer !== null) {
    throw new TypeError("A tax answer snapshot requires quote snapshot schema V2");
  }
  const taxAnswerSnapshot = parsedTaxAnswer?.value ?? null;
  if (isV2) {
    const compatible = adaptQuoteTaxSnapshot({
      snapshotSchemaVersion: 2,
      taxRuleVersion: input.taxRuleVersion,
      taxAnswerSnapshot,
      buyerVatNumber: input.buyerVatNumber,
      calculatedDeductionOre: input.calculatedDeductionOre,
      claimDeductionOre: input.claimDeductionOre,
      payableOre: input.payableOre,
      vatOre: input.totals.vatTotalOre,
      deductionOre: input.totals.deductionTotalOre,
      acceptedPriceOre: input.totals.acceptedPriceOre,
    });
    if (!compatible.ok) {
      throw new TypeError("V2 quote scalar totals do not match its frozen tax answer");
    }
    if (
      input.netOre !== undefined && input.netOre !== taxAnswerSnapshot!.netOre ||
      input.vatOre !== undefined && input.vatOre !== taxAnswerSnapshot!.vatOre ||
      input.grossOre !== undefined && input.grossOre !== taxAnswerSnapshot!.grossOre ||
      input.deductionOre !== undefined && input.deductionOre !== taxAnswerSnapshot!.deductionOre ||
      input.payableOre !== undefined && input.payableOre !== taxAnswerSnapshot!.payableOre ||
      input.calculatedDeductionOre !== undefined &&
        input.calculatedDeductionOre !== taxAnswerSnapshot!.calculatedDeductionOre ||
      input.claimDeductionOre !== undefined &&
        input.claimDeductionOre !== taxAnswerSnapshot!.claimDeductionOre
    ) {
      throw new TypeError("V2 duplicate monetary fields must equal the frozen tax answer");
    }
  }

  return Object.freeze({
    calculationId: input.calculationId,
    capturedAt: opts.capturedAt,

    companyName: input.company.company_name,
    companyOrgNr: input.company.org_nr,
    companyAddressLine1: input.company.address_line1,
    companyAddressLine2: input.company.address_line2,
    companyPostalCode: input.company.postal_code,
    companyCity: input.company.city,
    companyEmail: input.company.email,
    companyPhone: input.company.phone,
    companyLogoUrl: input.company.logo_url,

    customerDisplayName: input.customer.customer_display_name,
    customerType: input.customer.customer_type,
    facilityName: input.customer.facility_name,
    contactName: input.customer.contact_name,

    quoteNumberDisplay: input.header.quoteNumberDisplay,
    validUntil: input.header.validUntil,

    introText: input.header.introText,
    customerNotes: input.header.customerNotes,
    termsText: input.terms?.terms_text ?? null,
    // Captured VERBATIM — NULL = not-approved. The builder NEVER derives an isApproved
    // flag and NEVER approves/mutates the source (Story 6.4 owns the send-time gate).
    termsApprovedAt: input.terms?.approved_at ?? null,
    termsApprovedBy: input.terms?.approved_by ?? null,

    baseTotalOre: input.totals.baseTotalOre,
    optionTotalOre: input.totals.optionTotalOre,
    vatTotalOre: input.totals.vatTotalOre,
    deductionTotalOre: input.totals.deductionTotalOre,
    acceptedPriceOre: input.totals.acceptedPriceOre,
    snapshotSchemaVersion: input.snapshotSchemaVersion ?? null,
    taxRuleVersion: isV2 ? input.taxRuleVersion ?? null : null,
    taxAnswerSnapshot,
    buyerVatNumber: isV2 ? taxAnswerSnapshot!.buyerVatNumber : null,
    calculatedDeductionOre: isV2 ? taxAnswerSnapshot!.calculatedDeductionOre : null,
    claimDeductionOre: isV2 ? taxAnswerSnapshot!.claimDeductionOre : null,
    payableOre: isV2 ? taxAnswerSnapshot!.payableOre : null,
    netOre: isV2 ? taxAnswerSnapshot!.netOre : null,
    vatOre: isV2 ? taxAnswerSnapshot!.vatOre : null,
    grossOre: isV2 ? taxAnswerSnapshot!.grossOre : null,
    deductionOre: isV2 ? taxAnswerSnapshot!.deductionOre : null,

    vatRateBp: input.assumptions.vatRateBp,
    vatDisplay: input.assumptions.vatDisplay,
    deductionType: input.assumptions.deductionType,
    deductionRateBp: input.assumptions.deductionRateBp,
    deductionCapOre: input.assumptions.deductionCapOre,
    deductionPersons: input.assumptions.deductionPersons,
    requiresSignOff: input.assumptions.requiresSignOff,

    displayMode: input.header.displayMode,

    lines,
    attachments,
    warnings,
  } satisfies QuoteVersionSnapshot);
}
