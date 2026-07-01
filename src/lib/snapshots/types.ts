/**
 * Story 3.5 — the SNAPSHOT-SOURCE CONTRACT (types).
 *
 * This is the SMALL, documented shared contract that Epic 5 (Story 5.3 pricing-source
 * row snapshots) and Epic 6 (Story 6.1 quote-version snapshot) FREEZE into their
 * immutable rows/quotes. It captures — BY VALUE — exactly what the FOUR Phase-A
 * mutable source tables ship (work_roles + articles from Story 3.4; company_settings +
 * quote_terms from Story 3.3):
 *   - the SOURCE id + a `kind` discriminator + the tenant ownership,
 *   - the display name/content,
 *   - MONETARY values as INTEGER ÖRE (never a float kronor, never a re-derived value),
 *   - the VAT ASSUMPTIONS (rate in basis points + display mode) where the source has them,
 *   - the source TIMESTAMP/VERSION (`updated_at` of the source row),
 *   - the terms SIGN-OFF STATE (`approved_at`/`approved_by`, captured AS-IS incl. NULL),
 *   - the snapshot BUILD TIME (`capturedAt`, supplied by the caller's injected clock).
 *
 * DELIBERATELY SMALL + aligned with the ACTUAL columns those four tables ship (see the
 * two Story 3.3/3.4 migrations):
 *   - NO invented fields, NO new columns, NO calculation. The contract CAPTURES source
 *     values; it never COMPUTES a total / VAT amount / net-gross (Epic 4 owns money/VAT
 *     math; Epic 5 owns calculation rows; Epic 6 owns quote-version freeze).
 *   - Money stays INTEGER ÖRE; VAT rate stays BASIS POINTS (2500 = 25.00%).
 *   - HARD NON-NEGOTIABLE (carried forward from Story 3.4): the `article` variant carries
 *     NO supplier/vendor/sync/import/external/api/fortnox/edi/mapping field — the source
 *     table has none and the contract must not invent one.
 *   - The terms sign-off is the nullable `approved_at` captured VERBATIM (NULL =
 *     not-approved). The contract does NOT derive an `isApproved` flag and NEVER approves
 *     or mutates the source — it captures STATE only.
 *
 * EVERY field is `readonly` (structural immutability); the builder ALSO deep-freezes the
 * returned value (`src/lib/snapshots/build.ts`) so the R-008 SNAPSHOT-IMMUTABILITY
 * invariant holds at runtime, not just in the type system.
 *
 * PURE TYPES — no I/O, framework-agnostic, safe to import anywhere.
 *
 * [Source: architecture.md#11 (snapshot source list) / #22 (`src/lib/snapshots`) / #10
 *  (integer öre; VAT basis points); epics.md#Story 3.5 AC1/AC4; epic-3 retro-note (capture
 *  the REAL 3-3/3-4 fields, keep it small, do NOT invent); the Story 3.3/3.4 migrations.]
 */

/** The closed set of Phase-A mutable sources this contract can snapshot. */
export type SnapshotKind =
  | "work_role"
  | "article"
  | "company_settings"
  | "quote_terms";

/**
 * The COMMON fields every snapshot variant carries.
 *
 * - `sourceId`        — the source row's `id` (the thing a later quote points at).
 * - `tenantId`        — the resolved-tenant ownership (the RESOLVED row's `tenant_id`,
 *                       never a client-supplied value — see the resolver).
 * - `sourceUpdatedAt` — the source row's `updated_at` ISO timestamp, used as the source
 *                       "version" (the four tables carry no explicit version column;
 *                       `updated_at` is stamped by `set_updated_at` on every UPDATE).
 * - `capturedAt`      — the snapshot BUILD instant, supplied by the caller's injected
 *                       clock (NEVER read from the wall clock inside the pure builder).
 */
interface SnapshotCommon<K extends SnapshotKind> {
  readonly kind: K;
  readonly sourceId: string;
  readonly tenantId: string;
  readonly sourceUpdatedAt: string;
  readonly capturedAt: string;
}

/**
 * `work_role` variant — the labor pricing source (Story 3.4 `work_roles`). Captures ONLY
 * the real columns: `display_name`, the cost + sell HOURLY RATES in INTEGER ÖRE, and the
 * `is_active` lifecycle state AT capture time. Work roles carry NO VAT fields.
 */
export interface WorkRoleSnapshot extends SnapshotCommon<"work_role"> {
  readonly displayName: string;
  /** From `cost_rate_ore` — INTEGER ÖRE, copied verbatim (never recomputed, never float). */
  readonly costRateOre: number;
  /** From `sell_rate_ore` — INTEGER ÖRE, copied verbatim. */
  readonly sellRateOre: number;
  /** The active/archive lifecycle state at capture time (from `is_active`). */
  readonly isActive: boolean;
}

/**
 * `article` variant — the minimal MANUAL material register (Story 3.4 `articles`).
 * Captures ONLY `name`, optional `sku`/`unit`, the unit price in INTEGER ÖRE, and
 * `is_active`. HARD NON-NEGOTIABLE: NO supplier/vendor/sync/import/external/api/fortnox/
 * edi/mapping field — the source table has none and the contract must not invent one.
 */
export interface ArticleSnapshot extends SnapshotCommon<"article"> {
  readonly name: string;
  /** From `sku` — nullable free-text manual label (NOT a supplier id). NULL stays NULL. */
  readonly sku: string | null;
  /** From `unit` — nullable unit of measure. NULL stays NULL. */
  readonly unit: string | null;
  /** From `unit_price_ore` — INTEGER ÖRE, copied verbatim. */
  readonly unitPriceOre: number;
  readonly isActive: boolean;
}

/**
 * `company_settings` variant — the VAT-assumptions source (Story 3.3 `company_settings`).
 * Captures the VAT rate in BASIS POINTS (2500 = 25.00%) + the owner display-mode enum,
 * plus a MINIMAL company display identity (`companyName`, nullable). The full PDF identity
 * snapshot is Epic 6's quote-version concern — kept minimal here. NO VAT AMOUNT is
 * computed (Epic 4 owns the math); `default_vat_display` is captured AS-IS (the private-
 * side always-incl-VAT presentation rule is Epic 4's, not the snapshot's).
 */
export interface CompanySettingsSnapshot
  extends SnapshotCommon<"company_settings"> {
  /** From `company_name` — nullable minimal display identity. NULL stays NULL. */
  readonly companyName: string | null;
  /** From `vat_rate_bp` — BASIS POINTS (2500 = 25.00%), copied verbatim (NOT a percent). */
  readonly vatRateBp: number;
  /** From `default_vat_display` — the owner display-mode enum, captured AS-IS. */
  readonly defaultVatDisplay: string;
}

/**
 * `quote_terms` variant — the terms + sign-off source (Story 3.3 `quote_terms`). Captures
 * `terms_text` and the nullable `approved_at`/`approved_by` sign-off state VERBATIM
 * (NULL `approvedAt` = not-approved). The contract CAPTURES the state so a later quote can
 * explain WHETHER the captured terms were owner/legal-approved at capture time; it NEVER
 * derives an `isApproved` flag and NEVER approves/mutates the source. `approvedBy` is the
 * raw approver id (NOT a resolved display name).
 */
export interface QuoteTermsSnapshot extends SnapshotCommon<"quote_terms"> {
  readonly termsText: string;
  /** From the nullable `approved_at` — captured AS-IS (NULL = not-approved). */
  readonly approvedAt: string | null;
  /** From the nullable `approved_by` — the raw approver id (not a resolved name). */
  readonly approvedBy: string | null;
}

/**
 * The `SnapshotSource` discriminated union over the FOUR Phase-A mutable sources. A
 * consumer narrows on `kind` to reach the per-variant payload; the exhaustive `kind`
 * union makes adding a future source kind a COMPILE decision, not a silent gap.
 */
export type SnapshotSource =
  | WorkRoleSnapshot
  | ArticleSnapshot
  | CompanySettingsSnapshot
  | QuoteTermsSnapshot;

/** The injected-clock options every pure builder takes (the snapshot build instant). */
export interface SnapshotBuildOptions {
  /**
   * The snapshot build instant (ISO timestamp), supplied by the caller's injected clock.
   * The pure builder NEVER reads the wall clock — this makes it deterministic + testable.
   */
  readonly capturedAt: string;
}
