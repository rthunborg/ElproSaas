/**
 * Story 6.1 — the COMPOSITE QUOTE-VERSION SNAPSHOT contract (types).
 *
 * This is the FIRST composite immutable snapshot in the repo — it spans many source
 * shapes (calc detail, FULL company identity, terms + sign-off, totals, VAT/tax
 * assumptions, selected attachments, readiness warnings) in ONE frozen value. It
 * COMPOSES the three-times-proven freeze discipline (Epic 3 snapshot contract → Epic 4
 * golden freeze → Epic 5 pricing-source row freeze) at quote scale.
 *
 * ── R-603 SNAPSHOT-IMMUTABILITY (load-bearing) ───────────────────────────────────
 * The builder (`build.ts`) COPIES every captured field BY VALUE out of the resolved
 * source inputs and deep-`Object.freeze`s the result — so once a quote version is
 * built, LATER mutating a calculation, setting, price, terms, or CRM record CANNOT
 * reach into the prior snapshot. The build instant is INJECTED via `opts.capturedAt`
 * (NEVER `Date.now()` inside the builder), so the builder is a pure, deterministic
 * function of its inputs (exhaustively unit-testable + golden-pinnable).
 *
 * ── CAPTURES STATE, COMPUTES NOTHING (architecture §11) ──────────────────────────
 * Totals are STORED from the engine-produced calc state (`totals.ts` / `@/lib/money`),
 * never re-derived here; öre stay INTEGER ÖRE; VAT/deduction rates stay BASIS POINTS;
 * terms `approvedAt` is captured VERBATIM (NULL = not-approved) — the builder NEVER
 * derives an `isApproved` flag and NEVER approves/mutates the source.
 *
 * ── FULL COMPANY IDENTITY (deferred-work epic-3 [Med], RESOLVED HERE) ─────────────
 * The Epic-3 `CompanySettingsSnapshot` variant is intentionally identity-PARTIAL
 * (companyName + VAT only). This composite snapshot captures the FULL PDF identity
 * (org_nr/address/postal/city/email/phone/logo/company_name) from the LIVE settings
 * row, because a Swedish quote PDF (Story 6.3) legally/commercially needs all of it.
 *
 * ── R-607 CUSTOMER-VISIBLE ONLY ──────────────────────────────────────────────────
 * The line snapshots carry NO `unitCostOre`, NO margin/markup, NO `internalNote` — the
 * builder drops those calc-row fields by construction (a unit test asserts it).
 *
 * ── DEMO-DATA-ONLY / requiresSignOff (owner decision 2026-07-03) ─────────────────
 * The tax assumptions are UNAPPROVED estimates with the standing `requiresSignOff`
 * marker + non-final framing; 6.1 CAPTURES the posture (never renders it legally-final)
 * so Story 6.4's mark-sent path can be fail-closed by construction.
 *
 * EVERY field is `readonly` (structural immutability); the builder ALSO deep-freezes
 * the returned value so the invariant holds at runtime. PURE TYPES — no I/O, framework-
 * agnostic, no `src/server` dependency (the layer-inversion trap — resolved values are
 * passed IN).
 *
 * [Source: architecture.md#11 (the §11 snapshot field list) / #10 (integer öre; VAT bp);
 *  epics.md#Story 6.1 AC2; ADR-A005 (immutable quote version); src/lib/snapshots/build.ts
 *  + types.ts (the freeze discipline this composes); deferred-work.md#epic-3 (full identity;
 *  terms approvedAt marker), #8-1 (attachment metadata by value); test-design-epic-6.md
 *  #6.1-UNIT-01/02, #6.1-INT-03/04, R-603/R-607.]
 */

import type {
  DeductionClassification,
  TaxAnswerSnapshotV2,
  VatType,
} from "@/lib/money";

/** The closed set of Phase-A quote-version lifecycle statuses (architecture §7). 6.1 creates 'draft'. */
export type QuoteVersionStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "superseded";

/** The closed set of deduction types a quote version can carry (mirrors the engine). */
export type QuoteDeductionType = "rot" | "gron_teknik" | "rot_and_green";

/**
 * A single customer-visible LINE snapshot (R-607). Carries ONLY the customer-visible
 * fields — NO `unitCostOre`, NO margin/markup, NO `internalNote`. Every öre is INTEGER
 * ÖRE; the VAT rate is BASIS POINTS; the line net is CAPTURED from the engine total.
 */
export interface QuoteVersionLineSnapshot {
  /** Internal immutable lineage to the canonical calculation row (never rendered). */
  readonly sourceRowId: string | null;
  /** A display discriminant (a line vs a section-header vs a text row). */
  readonly rowType: string;
  /** Presentation ordering (server-owned, from the calc row order). */
  readonly sortOrder: number;
  readonly label: string | null;
  readonly description: string | null;
  /** The customer-visible note (NEVER the internal note — R-607). */
  readonly quoteNote: string | null;
  readonly quantity: number | null;
  readonly unit: string | null;
  /** The customer-facing SELL price per unit in INTEGER ÖRE (NEVER the cost — R-607). */
  readonly unitSellOre: number | null;
  /** The line net total CAPTURED from the engine (integer öre, never re-derived here). */
  readonly lineNetOre: number | null;
  /** The row VAT assumption in BASIS POINTS. */
  readonly vatRateBp: number | null;
  readonly includedInInvoiceTotal: boolean | null;
  readonly deductionClassification: DeductionClassification | null;
  readonly vatType: VatType | null;
  readonly isHidden: boolean;
  readonly isOptional: boolean;
  readonly isSelected: boolean | null;
}

/** A selected-attachment metadata snapshot (by value — a later file rename does not reach it). */
export interface QuoteVersionAttachmentSnapshot {
  /** The attached file id (from the 8.1 files model — own-tenant-verified by the command). */
  readonly fileId: string;
  /** The display name CAPTURED at snapshot time (verbatim, by value). */
  readonly displayName: string | null;
  readonly sortOrder: number;
}

/** A readiness warning CAPTURED at snapshot time (a disclosure of state — no PII). */
export interface QuoteVersionWarningSnapshot {
  readonly code: string;
  readonly severity: string;
  readonly message: string;
}

/**
 * The COMPOSITE quote-version snapshot — the complete copy-by-value freeze of
 * everything customer-visible (architecture §11). Every field is `readonly`; the
 * builder deep-freezes the value (incl. the nested `lines`/`attachments`/`warnings`).
 */
export interface QuoteVersionSnapshot {
  // ── Source refs + build instant ──────────────────────────────────────────────
  /** The source calculation id (the thing the version snapshots). */
  readonly calculationId: string;
  /** The snapshot BUILD instant (INJECTED via opts.capturedAt — never a clock read). */
  readonly capturedAt: string;

  // ── FULL company identity (from the LIVE company_settings row) ────────────────
  readonly companyName: string | null;
  readonly companyOrgNr: string | null;
  readonly companyAddressLine1: string | null;
  readonly companyAddressLine2: string | null;
  readonly companyPostalCode: string | null;
  readonly companyCity: string | null;
  readonly companyEmail: string | null;
  readonly companyPhone: string | null;
  readonly companyLogoUrl: string | null;

  // ── Customer / facility / contact DISPLAY (display fields ONLY — never a pnr) ──
  readonly customerDisplayName: string | null;
  readonly customerType: string | null;
  readonly facilityName: string | null;
  readonly contactName: string | null;

  // ── Quote number DISPLAY + validity ──────────────────────────────────────────
  /** The presentational quote number form (the §24 display format is captured, not a blocker). */
  readonly quoteNumberDisplay: string | null;
  readonly validUntil: string | null;

  // ── Intro / customer notes / terms + sign-off state (VERBATIM) ────────────────
  readonly introText: string | null;
  readonly customerNotes: string | null;
  readonly termsText: string | null;
  /** From quote_terms.approved_at — captured AS-IS (NULL = not-approved; NEVER derived). */
  readonly termsApprovedAt: string | null;
  /** From quote_terms.approved_by — the raw approver id (not a resolved name). */
  readonly termsApprovedBy: string | null;

  // ── Totals in INTEGER ÖRE (captured from engine state, never re-derived here) ──
  readonly baseTotalOre: number;
  readonly optionTotalOre: number;
  readonly vatTotalOre: number;
  readonly deductionTotalOre: number;
  /** The customer-commitment gross the version freezes (the accepted-price basis). */
  readonly acceptedPriceOre: number;
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

  // ── VAT / tax assumptions (BASIS POINTS — never a float) ──────────────────────
  readonly vatRateBp: number | null;
  readonly vatDisplay: string | null;
  readonly deductionType: QuoteDeductionType | null;
  readonly deductionRateBp: number | null;
  readonly deductionCapOre: number | null;
  readonly deductionPersons: number | null;
  /** The standing sign-off marker (true = an UNAPPROVED estimate — the fail-closed default). */
  readonly requiresSignOff: boolean;

  // ── Presentation posture ──────────────────────────────────────────────────────
  readonly displayMode: string | null;

  // ── Composite children (deep-frozen arrays) ──────────────────────────────────
  readonly lines: readonly QuoteVersionLineSnapshot[];
  readonly attachments: readonly QuoteVersionAttachmentSnapshot[];
  readonly warnings: readonly QuoteVersionWarningSnapshot[];
}

/** The injected-clock options the pure builder takes (the snapshot build instant). */
export interface QuoteSnapshotBuildOptions {
  /**
   * The snapshot build instant (ISO timestamp), supplied by the caller's injected
   * clock. The pure builder NEVER reads the wall clock — this makes it deterministic.
   */
  readonly capturedAt: string;
}
