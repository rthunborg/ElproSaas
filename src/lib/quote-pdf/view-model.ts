/**
 * Story 6.3 — the PURE, I/O-free `QuotePdfViewModel` builder (6.3-UNIT-01 / AC1).
 *
 * The single most important LEAKAGE-BY-CONSTRUCTION guard of this story: the view model is
 * built SOLELY from the frozen `QuoteVersionSnapshot` rows (`quote_versions` /
 * `quote_version_lines` / `quote_version_attachments`), and its INPUT surface is TYPED as the
 * snapshot-only shape — so it is PROVABLE that no mutable source (customer / company_settings /
 * quote_terms / calculation_* / work_roles / articles) can reach the PDF (R-606). Every
 * money/VAT/total value is READ VERBATIM from the frozen row and formatted öre→kronor via the
 * SINGLE canonical formatter `formatOreAsKronor` (`@/lib/money`) — NO recompute, NO inline
 * `/100`, NO forked money math (R-505).
 *
 * ── R-607 INTERNAL FIELDS EXCLUDED BY CONSTRUCTION ─────────────────────────────────
 * The line projection is an EXPLICIT allow-list pick (never a spread). `unit_cost_ore`,
 * margin/markup, and `internal_note` are NOT on the frozen snapshot rows AND the view model's
 * TYPE forbids them — so even a hostile/over-broad caller shoving internal fields at the source
 * cannot leak them into the PDF (a UNIT test drives the builder with internal fields present and
 * asserts their absence). This mirrors the 6.2 `toCustomerVisibleLine` belt.
 *
 * ── DEMO-DATA-ONLY / requiresSignOff (owner decision 2026-07-03) ────────────────────
 * The view model carries the `requiresSignOff` marker VERBATIM so the PDF renders the non-final
 * "estimate / requires sign-off" framing — the PDF is NEVER a legally-final document.
 *
 * ── REAL ReadinessCode VOCABULARY ───────────────────────────────────────────────────
 * Warnings are DISPLAYED verbatim from the captured snapshot `warnings` array (a disclosure of
 * state — no re-classification). They use the REAL `ReadinessCode` union codes (captured at
 * snapshot time), NEVER the fictional 6.1 golden codes.
 *
 * ── DETERMINISM (H3 / R-612) ────────────────────────────────────────────────────────
 * This module reads NO clock and does NO I/O — it is a pure function of its snapshot input.
 * The render instant is injected DOWNSTREAM (the renderer, Task 3) from the command's single
 * timestamp, mirroring the snapshot builder's injected `capturedAt`.
 *
 * PURE MODULE — no `src/server` import (the layer-inversion trap); consumes only the sibling
 * `@/lib/quote-snapshot` types + the `@/lib/money` formatter. Framework-agnostic, no JSX (the
 * coverage-shape lesson — a sibling `.ts` the `node --test` fast gate protects).
 *
 * [Source: architecture.md#11/#12; test-design-epic-6.md#6.3-UNIT-01, R-606/R-607;
 *  src/lib/quote-snapshot/types.ts (the frozen QuoteVersionSnapshot input surface);
 *  src/lib/money/ore.ts#formatOreAsKronor (the single öre→kronor formatter);
 *  src/features/quotes/view-model.ts (the 6.2 leakage-by-construction precedent);
 *  src/features/calculations/readiness.ts (the REAL ReadinessCode union)]
 */
import { formatOreAsKronor, type GreenCategory } from "@/lib/money";
import type {
  QuoteVersionAttachmentSnapshot,
  QuoteVersionLineSnapshot,
  QuoteVersionSnapshot,
  QuoteVersionWarningSnapshot,
} from "@/lib/quote-snapshot";
import { adaptQuoteTaxSnapshot } from "@/lib/quote-snapshot";

/**
 * A customer-visible PDF line — the ONLY line fields the PDF renders. Money is PRE-FORMATTED to
 * a kronor string at this boundary (via the single formatter) so the renderer prints it
 * verbatim. NO `unitCostOre`, NO margin/markup, NO `internalNote` (R-607 — excluded by
 * construction; the fields are absent from the type, not merely unused).
 */
export interface QuotePdfLine {
  readonly rowType: string;
  readonly sortOrder: number;
  readonly label: string | null;
  readonly description: string | null;
  /** The CUSTOMER-visible note ONLY (never an internal note). */
  readonly quoteNote: string | null;
  readonly quantity: number | null;
  readonly unit: string | null;
  /** The unit SELL price, formatted kronor (null when absent) — never a cost. */
  readonly unitSellKronor: string | null;
  /** The line net total, formatted kronor (null when absent) — READ from the frozen row. */
  readonly lineNetKronor: string | null;
  /** The row VAT rate as a percent string (from the frozen basis points). */
  readonly vatRatePercent: string | null;
  readonly includedInInvoiceTotal?: boolean | null;
  readonly deductionClassification?: string | null;
  readonly vatType?: string | null;
  readonly isHidden: boolean;
  readonly isOptional: boolean;
  readonly isSelected: boolean | null;
}

/** The PDF totals block — every value READ VERBATIM from the frozen row + formatted kronor. */
export interface QuotePdfTotals {
  readonly baseKronor: string;
  readonly optionKronor: string;
  readonly vatKronor: string;
  readonly deductionKronor: string;
  /** The customer-commitment gross the version froze (the accepted-price basis). */
  readonly acceptedPriceKronor: string;
}

/** The PDF VAT / tax-assumption block (the non-final ROT/grön framing). */
export interface QuotePdfTaxAssumptions {
  /** The VAT rate as a percent string (from the frozen basis points), or null. */
  readonly vatRatePercent: string | null;
  /** The frozen VAT display posture (`company_excl`/`company_togglable`/`private`/null). */
  readonly vatDisplay: string | null;
  /** The deduction type captured at snapshot time (`rot`/`gron_teknik`/null). */
  readonly deductionType: string | null;
  /** The deduction rate as a percent string (from the frozen basis points), or null. */
  readonly deductionRatePercent: string | null;
  /** The deduction cap formatted kronor (or null when absent). */
  readonly deductionCapKronor: string | null;
  /**
   * The flat-cap person count captured at snapshot time (a PLACEHOLDER — `persons` does NOT
   * scale the cap; the view model NEVER implies a per-person-scaled cap). Null when absent.
   */
  readonly deductionPersons: number | null;
}

export interface QuotePdfTaxCategory {
  readonly vatType: string;
  readonly label: string;
  readonly ratePercent: string;
  readonly netKronor: string;
  readonly vatKronor: string;
  readonly grossKronor: string;
}

export interface QuotePdfTaxSummary {
  readonly netKronor: string;
  readonly vatKronor: string;
  readonly grossKronor: string;
}

export interface QuotePdfResolvedPolicy {
  readonly id: string;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly resolvingDate: string;
  readonly resolvingFact: string;
}

export interface QuotePdfPersonAllocation {
  readonly slot: string;
  readonly kronor: string;
}

type QuotePdfTaxAnswerCommon = Readonly<{
  vatKronor: string;
  deductionKronor: string;
  payableKronor: string;
}>;

/** V1 exposes only scalars that were literally frozen; unavailable derived facts stay null. */
export type QuotePdfTaxAnswer = QuotePdfTaxAnswerCommon & (
  | Readonly<{
      source: "legacy-v1";
      deductionChoice: null;
      netKronor: null;
      grossKronor: null;
      calculatedDeductionKronor: null;
      claimDeductionKronor: null;
      categories: readonly [];
      summaries: null;
      rot: null;
      green: null;
    }>
  | Readonly<{
      source: "v2";
      deductionChoice: string;
      netKronor: string;
      grossKronor: string;
      calculatedDeductionKronor: string;
      claimDeductionKronor: string;
      categories: readonly QuotePdfTaxCategory[];
      summaries: Readonly<{
        labor: QuotePdfTaxSummary;
        material: QuotePdfTaxSummary;
        other: QuotePdfTaxSummary;
      }>;
      rot: Readonly<{
        policy: QuotePdfResolvedPolicy | null;
        basisNetKronor: string;
        allocatedVatKronor: string;
        basisKronor: string;
        calculatedKronor: string;
        claimKronor: string;
        allocations: readonly QuotePdfPersonAllocation[];
      }>;
      green: Readonly<{
        policy: QuotePdfResolvedPolicy | null;
        basisMethod: string;
        categories: Readonly<Record<GreenCategory, Readonly<{
          basisKronor: string;
          calculatedKronor: string;
          claimKronor: string;
        }>>>;
        calculatedKronor: string;
        claimKronor: string;
        allocations: readonly QuotePdfPersonAllocation[];
      }>;
    }>
);

/** A customer-visible warning DISPLAYED verbatim (the REAL ReadinessCode codes; no PII). */
export interface QuotePdfWarning {
  readonly code: string;
  readonly severity: string;
  readonly message: string;
}

/** A selected-attachment metadata entry (display name captured by value). */
export interface QuotePdfAttachment {
  readonly fileId: string;
  readonly displayName: string | null;
  readonly sortOrder: number;
}

/**
 * The complete customer-visible PDF view model — built SOLELY from the frozen snapshot, carrying
 * NO internal cost/margin/markup/internal-note field by construction. Every money value is a
 * PRE-FORMATTED kronor string (via the single formatter). The `requiresSignOff` marker drives
 * the non-final framing.
 */
export interface QuotePdfViewModel {
  // ── FULL company identity (all customer-visible PDF fields). ──
  readonly companyName: string | null;
  readonly companyOrgNr: string | null;
  readonly companyAddressLine1: string | null;
  readonly companyAddressLine2: string | null;
  readonly companyPostalCode: string | null;
  readonly companyCity: string | null;
  readonly companyEmail: string | null;
  readonly companyPhone: string | null;
  readonly companyLogoUrl: string | null;

  // ── Customer / facility / contact DISPLAY names ONLY (never a personnummer). ──
  readonly customerDisplayName: string | null;
  readonly customerType: string | null;
  readonly facilityName: string | null;
  readonly contactName: string | null;

  // ── Quote number DISPLAY + validity. ──
  readonly quoteNumberDisplay: string | null;
  readonly validUntil: string | null;

  // ── Intro / customer notes / terms text + the terms sign-off state. ──
  readonly introText: string | null;
  readonly customerNotes: string | null;
  readonly termsText: string | null;
  /** From quote_terms.approved_at captured VERBATIM (null = not-approved; never derived). */
  readonly termsApprovedAt: string | null;

  // ── The customer-visible line display model (ordered by sortOrder). ──
  readonly lines: readonly QuotePdfLine[];

  // ── Totals + VAT/tax assumptions (read verbatim; non-final framing). ──
  readonly totals: QuotePdfTotals;
  readonly taxAssumptions: QuotePdfTaxAssumptions;
  readonly snapshotSchemaVersion?: number | null;
  readonly buyerVatNumber?: string | null;
  readonly payableOre?: number | null;
  readonly reverseChargeText?: string | null;
  readonly taxAnswer?: QuotePdfTaxAnswer;

  // ── Selected attachment metadata list. ──
  readonly attachments: readonly QuotePdfAttachment[];

  // ── Customer-visible warnings (verbatim; real ReadinessCode vocabulary). ──
  readonly warnings: readonly QuotePdfWarning[];

  // ── Presentation posture. ──
  readonly displayMode: string | null;

  /**
   * The standing UNAPPROVED-estimate marker (demo-data-only accept). When true the PDF MUST
   * render the non-final "estimate / requires sign-off" framing — it is NEVER a legally-final
   * document (MEMORY: keep the requiresSignOff framing).
   */
  readonly requiresSignOff: boolean;
}

/** Format integer öre as a Swedish kronor string via the SINGLE canonical formatter, or null. */
function kronorOrNull(ore: number | null | undefined): string | null {
  if (ore === null || ore === undefined) return null;
  return formatOreAsKronor(ore);
}

function groupedKronor(ore: number): string {
  const formatted = formatOreAsKronor(ore);
  const [kronor, fraction] = formatted.split(",");
  const grouped = kronor.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped},${fraction ?? "00"}`;
}

function taxSummaryOf(summary: {
  readonly netOre: number;
  readonly vatOre: number;
  readonly grossOre: number;
}): QuotePdfTaxSummary {
  return {
    netKronor: groupedKronor(summary.netOre),
    vatKronor: groupedKronor(summary.vatOre),
    grossKronor: groupedKronor(summary.grossOre),
  };
}

function vatTypeLabel(vatType: string): string {
  switch (vatType) {
    case "STANDARD_VAT_25":
      return "Standardmoms";
    case "REDUCED_VAT":
      return "Reducerad moms";
    case "ZERO_RATED":
      return "Momsfri omsättning";
    case "REVERSE_CHARGE_CONSTRUCTION":
      return "Omvänd betalningsskyldighet";
    default:
      return vatType;
  }
}

/**
 * Format a stored basis-points rate as a percent string for display (VERBATIM from the frozen
 * bp — NOT money math). `2500` → "25", `2550` → "25.5". A null/non-finite bp → null. Kept local
 * (a tiny pure presentation formatter) to avoid a `src/lib`→`src/features` layer inversion; it
 * mirrors the settings `bpToPercentString` shape without importing across the layer boundary.
 */
function bpToPercentOrNull(bp: number | null | undefined): string | null {
  if (bp === null || bp === undefined || !Number.isFinite(bp)) return null;
  return String(bp / 100);
}

/**
 * Project ONE frozen snapshot line into the customer-visible PDF line. An EXPLICIT allow-list
 * pick — only the named customer-visible fields are read (never a spread), so no cost/margin/
 * internal field can leak into the PDF by construction (R-607). Money is pre-formatted kronor.
 */
function toPdfLine(line: QuoteVersionLineSnapshot): QuotePdfLine {
  return {
    rowType: line.rowType,
    sortOrder: line.sortOrder,
    label: line.label,
    description: line.description,
    quoteNote: line.quoteNote,
    quantity: line.quantity,
    unit: line.unit,
    unitSellKronor: kronorOrNull(line.unitSellOre),
    lineNetKronor: kronorOrNull(line.lineNetOre),
    vatRatePercent: bpToPercentOrNull(line.vatRateBp),
    includedInInvoiceTotal: line.includedInInvoiceTotal,
    deductionClassification: line.deductionClassification,
    vatType: line.vatType,
    isHidden: line.isHidden,
    isOptional: line.isOptional,
    isSelected: line.isSelected,
  };
}

/** Project ONE frozen attachment snapshot into the PDF attachment entry (display name by value). */
function toPdfAttachment(
  att: QuoteVersionAttachmentSnapshot,
): QuotePdfAttachment {
  return {
    fileId: att.fileId,
    displayName: att.displayName,
    sortOrder: att.sortOrder,
  };
}

/** Project ONE captured warning into the PDF warning entry (verbatim disclosure — no PII). */
function toPdfWarning(w: QuoteVersionWarningSnapshot): QuotePdfWarning {
  return { code: w.code, severity: w.severity, message: w.message };
}

/**
 * Build the customer-visible `QuotePdfViewModel` from the frozen `QuoteVersionSnapshot`.
 *
 * PURE — no I/O, no clock, no re-read of any mutable source. The INPUT surface is TYPED as the
 * snapshot-only shape, so no customer/settings/terms/calc/pricing value can reach the PDF
 * (R-606, provable at the type level). Money is read VERBATIM from the frozen öre and formatted
 * via the single `formatOreAsKronor`. Internal cost/margin/internal-note fields are excluded by
 * construction (R-607). The `requiresSignOff` marker is carried so the PDF renders non-final
 * framing.
 */
export function buildQuotePdfViewModel(
  snapshot: QuoteVersionSnapshot,
): QuotePdfViewModel {
  const lines = [...snapshot.lines].sort((a, b) => a.sortOrder - b.sortOrder).map(toPdfLine);
  const attachments = [...snapshot.attachments]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(toPdfAttachment);
  const warnings = snapshot.warnings.map(toPdfWarning);
  const tax = adaptQuoteTaxSnapshot({
    snapshotSchemaVersion: snapshot.snapshotSchemaVersion,
    taxRuleVersion: snapshot.taxRuleVersion,
    taxAnswerSnapshot: snapshot.taxAnswerSnapshot,
    buyerVatNumber: snapshot.buyerVatNumber,
    calculatedDeductionOre: snapshot.calculatedDeductionOre,
    claimDeductionOre: snapshot.claimDeductionOre,
    payableOre: snapshot.payableOre,
    vatOre: snapshot.vatTotalOre,
    deductionOre: snapshot.deductionTotalOre,
    acceptedPriceOre: snapshot.acceptedPriceOre,
  });
  if (!tax.ok) throw new TypeError("Invalid V2 quote tax snapshot");
  const frozen = tax.value;
  const pdfTaxAnswer: QuotePdfTaxAnswer = frozen.source === "legacy-v1"
    ? {
        source: "legacy-v1",
        deductionChoice: null,
        netKronor: null,
        vatKronor: groupedKronor(frozen.vatOre),
        grossKronor: null,
        calculatedDeductionKronor: null,
        claimDeductionKronor: null,
        deductionKronor: groupedKronor(frozen.deductionOre),
        payableKronor: groupedKronor(frozen.payableOre),
        categories: [],
        summaries: null,
        rot: null,
        green: null,
      }
    : {
        source: "v2",
        deductionChoice: frozen.taxAnswer.deductionChoice,
        netKronor: groupedKronor(frozen.netOre),
        vatKronor: groupedKronor(frozen.vatOre),
        grossKronor: groupedKronor(frozen.grossOre),
        calculatedDeductionKronor: groupedKronor(frozen.calculatedDeductionOre),
        claimDeductionKronor: groupedKronor(frozen.claimDeductionOre),
        deductionKronor: groupedKronor(frozen.deductionOre),
        payableKronor: groupedKronor(frozen.payableOre),
        categories: frozen.categories.map((category) => ({
          vatType: category.vatType,
          label: vatTypeLabel(category.vatType),
          ratePercent: bpToPercentOrNull(category.rateBp) ?? "0",
          netKronor: groupedKronor(category.netOre),
          vatKronor: groupedKronor(category.vatOre),
          grossKronor: groupedKronor(category.grossOre),
        })),
        summaries: {
          labor: taxSummaryOf(frozen.summaries.labor),
          material: taxSummaryOf(frozen.summaries.material),
          other: taxSummaryOf(frozen.summaries.other),
        },
        rot: {
          policy: frozen.taxAnswer.rot.policy,
          basisNetKronor: groupedKronor(frozen.taxAnswer.rot.basisNetOre),
          allocatedVatKronor: groupedKronor(frozen.taxAnswer.rot.allocatedVatOre),
          basisKronor: groupedKronor(frozen.taxAnswer.rot.basisOre),
          calculatedKronor: groupedKronor(frozen.taxAnswer.rot.calculatedOre),
          claimKronor: groupedKronor(frozen.taxAnswer.rot.claimOre),
          allocations: frozen.taxAnswer.rot.allocations.map((allocation) => ({
            slot: allocation.slot,
            kronor: groupedKronor(allocation.ore),
          })),
        },
        green: {
          policy: frozen.taxAnswer.green.policy,
          basisMethod: frozen.taxAnswer.green.basisMethod,
          categories: {
            SOLAR: {
              basisKronor: groupedKronor(frozen.taxAnswer.green.categories.SOLAR.basisOre),
              calculatedKronor: groupedKronor(frozen.taxAnswer.green.categories.SOLAR.calculatedOre),
              claimKronor: groupedKronor(frozen.taxAnswer.green.categories.SOLAR.claimOre),
            },
            STORAGE: {
              basisKronor: groupedKronor(frozen.taxAnswer.green.categories.STORAGE.basisOre),
              calculatedKronor: groupedKronor(frozen.taxAnswer.green.categories.STORAGE.calculatedOre),
              claimKronor: groupedKronor(frozen.taxAnswer.green.categories.STORAGE.claimOre),
            },
            CHARGING: {
              basisKronor: groupedKronor(frozen.taxAnswer.green.categories.CHARGING.basisOre),
              calculatedKronor: groupedKronor(frozen.taxAnswer.green.categories.CHARGING.calculatedOre),
              claimKronor: groupedKronor(frozen.taxAnswer.green.categories.CHARGING.claimOre),
            },
          },
          calculatedKronor: groupedKronor(frozen.taxAnswer.green.calculatedOre),
          claimKronor: groupedKronor(frozen.taxAnswer.green.claimOre),
          allocations: frozen.taxAnswer.green.allocations.map((allocation) => ({
            slot: allocation.slot,
            kronor: groupedKronor(allocation.ore),
          })),
        },
      };

  return {
    companyName: snapshot.companyName,
    companyOrgNr: snapshot.companyOrgNr,
    companyAddressLine1: snapshot.companyAddressLine1,
    companyAddressLine2: snapshot.companyAddressLine2,
    companyPostalCode: snapshot.companyPostalCode,
    companyCity: snapshot.companyCity,
    companyEmail: snapshot.companyEmail,
    companyPhone: snapshot.companyPhone,
    companyLogoUrl: snapshot.companyLogoUrl,

    customerDisplayName: snapshot.customerDisplayName,
    customerType: snapshot.customerType,
    facilityName: snapshot.facilityName,
    contactName: snapshot.contactName,

    quoteNumberDisplay: snapshot.quoteNumberDisplay,
    validUntil: snapshot.validUntil,

    introText: snapshot.introText,
    customerNotes: snapshot.customerNotes,
    termsText: snapshot.termsText,
    termsApprovedAt: snapshot.termsApprovedAt,

    lines,

    totals: {
      baseKronor: formatOreAsKronor(snapshot.baseTotalOre),
      optionKronor: formatOreAsKronor(snapshot.optionTotalOre),
      vatKronor: formatOreAsKronor(frozen.vatOre),
      deductionKronor: formatOreAsKronor(frozen.deductionOre),
      acceptedPriceKronor: formatOreAsKronor(frozen.payableOre),
    },

    taxAssumptions: {
      vatRatePercent: bpToPercentOrNull(snapshot.vatRateBp),
      vatDisplay: snapshot.vatDisplay,
      deductionType: snapshot.deductionType,
      deductionRatePercent: bpToPercentOrNull(snapshot.deductionRateBp),
      deductionCapKronor: kronorOrNull(snapshot.deductionCapOre),
      deductionPersons: snapshot.deductionPersons,
    },
    snapshotSchemaVersion: snapshot.snapshotSchemaVersion ?? null,
    buyerVatNumber: frozen.buyerVatNumber,
    payableOre: frozen.payableOre,
    reverseChargeText: frozen.reverseChargeApplied ? "Omvänd betalningsskyldighet" : null,
    taxAnswer: pdfTaxAnswer,

    attachments,
    warnings,
    displayMode: snapshot.displayMode,
    requiresSignOff: snapshot.requiresSignOff,
  };
}

/** The exhaustive allow-list of PDF line field keys (the R-607 leakage-by-construction contract). */
export const QUOTE_PDF_LINE_KEYS: readonly (keyof QuotePdfLine)[] = [
  "rowType",
  "sortOrder",
  "label",
  "description",
  "quoteNote",
  "quantity",
  "unit",
  "unitSellKronor",
  "lineNetKronor",
  "vatRatePercent",
  "includedInInvoiceTotal",
  "deductionClassification",
  "vatType",
  "isHidden",
  "isOptional",
  "isSelected",
];
