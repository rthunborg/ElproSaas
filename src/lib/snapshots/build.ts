/**
 * Story 3.5 — the PURE snapshot BUILDERS (value-copy + freeze).
 *
 * ── R-008 SNAPSHOT-IMMUTABILITY (score-6, load-bearing) ──────────────────────────
 * Each builder COPIES every captured field BY VALUE (primitives — numbers/strings/null)
 * out of the source row into a fresh `SnapshotSource` object, then returns
 * `Object.freeze(...)`. The result holds NO live reference to the input row — so once a
 * snapshot is built, LATER mutating (or archiving) the source row CANNOT reach into the
 * prior snapshot. A snapshot, once built, NEVER silently recalculates. The builders also
 * never mutate their input row: they capture STATE, they do not approve or edit anything.
 * (The captured payloads are FLAT primitives, so a single top-level freeze is deep enough.)
 *
 * ── PURITY / DETERMINISM ─────────────────────────────────────────────────────────
 * The builders do NO I/O, NO DB access, and NO clock read. The snapshot build instant is
 * SUPPLIED via `opts.capturedAt` (never `Date.now()` inside the builder), so a builder is
 * a pure function of `(row, opts)` — exhaustively unit-testable and golden-pinnable.
 *
 * ── MONEY / VAT DISCIPLINE ───────────────────────────────────────────────────────
 * NO arithmetic on the öre values — `cost_rate_ore` → `costRateOre` is a verbatim copy,
 * never a recompute; `vat_rate_bp` stays basis points. The contract carries NO computed
 * total / VAT amount (Epic 4 owns money/VAT math). Integer öre in, integer öre out.
 *
 * [Source: epics.md#Story 3.5 AC1/AC2; architecture.md#22 (`src/lib/snapshots`) / #11
 *  (immutable customer-commitment snapshot); epic-3 retro-note (R-008 — copy by value,
 *  frozen, no silent recompute); `src/lib/snapshots/types.ts` (the contract shape).]
 */
import type {
  ArticleSnapshot,
  CompanySettingsSnapshot,
  QuoteTermsSnapshot,
  SnapshotBuildOptions,
  SnapshotKind,
  SnapshotSource,
  WorkRoleSnapshot,
} from "./types";

/**
 * The `work_roles` source-row shape the builder consumes (the `readWorkRoles` UI shape
 * extended with the common `tenant_id`/`updated_at` the snapshot needs). Only the fields
 * the contract captures are read.
 */
export interface WorkRoleSourceRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly display_name: string;
  readonly cost_rate_ore: number;
  readonly sell_rate_ore: number;
  readonly is_active: boolean;
  readonly updated_at: string;
}

/** Build the immutable `work_role` snapshot — copy by value, then freeze. */
export function buildWorkRoleSnapshot(
  row: WorkRoleSourceRow,
  opts: SnapshotBuildOptions,
): WorkRoleSnapshot {
  return Object.freeze({
    kind: "work_role",
    sourceId: row.id,
    tenantId: row.tenant_id,
    sourceUpdatedAt: row.updated_at,
    capturedAt: opts.capturedAt,
    displayName: row.display_name,
    costRateOre: row.cost_rate_ore,
    sellRateOre: row.sell_rate_ore,
    isActive: row.is_active,
  } satisfies WorkRoleSnapshot);
}

/**
 * The `articles` source-row shape the builder consumes. HARD no-supplier-scope: there is
 * NO supplier-ish field here (the source table has none).
 */
export interface ArticleSourceRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly name: string;
  readonly sku: string | null;
  readonly unit: string | null;
  readonly unit_price_ore: number;
  readonly is_active: boolean;
  readonly updated_at: string;
}

/** Build the immutable `article` snapshot — copy by value (null sku/unit stay null), freeze. */
export function buildArticleSnapshot(
  row: ArticleSourceRow,
  opts: SnapshotBuildOptions,
): ArticleSnapshot {
  return Object.freeze({
    kind: "article",
    sourceId: row.id,
    tenantId: row.tenant_id,
    sourceUpdatedAt: row.updated_at,
    capturedAt: opts.capturedAt,
    name: row.name,
    sku: row.sku,
    unit: row.unit,
    unitPriceOre: row.unit_price_ore,
    isActive: row.is_active,
  } satisfies ArticleSnapshot);
}

/** The `company_settings` source-row shape the builder consumes (the VAT-assumptions source). */
export interface CompanySettingsSourceRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly company_name: string | null;
  readonly vat_rate_bp: number;
  readonly default_vat_display: string;
  readonly updated_at: string;
}

/**
 * Build the immutable `company_settings` snapshot — captures the VAT rate (basis points) +
 * display mode AS-IS + a minimal company identity. NO VAT amount is computed (Epic 4).
 */
export function buildCompanySettingsSnapshot(
  row: CompanySettingsSourceRow,
  opts: SnapshotBuildOptions,
): CompanySettingsSnapshot {
  return Object.freeze({
    kind: "company_settings",
    sourceId: row.id,
    tenantId: row.tenant_id,
    sourceUpdatedAt: row.updated_at,
    capturedAt: opts.capturedAt,
    companyName: row.company_name,
    vatRateBp: row.vat_rate_bp,
    defaultVatDisplay: row.default_vat_display,
  } satisfies CompanySettingsSnapshot);
}

/** The `quote_terms` source-row shape the builder consumes (the terms + sign-off source). */
export interface QuoteTermsSourceRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly terms_text: string;
  readonly approved_at: string | null;
  readonly approved_by: string | null;
  readonly updated_at: string;
}

/**
 * Build the immutable `quote_terms` snapshot — captures the terms text + the nullable
 * `approved_at`/`approved_by` sign-off STATE AS-IS (NULL = not-approved). STATE-ONLY: the
 * builder never approves or mutates the source; it copies the sign-off verbatim.
 */
export function buildQuoteTermsSnapshot(
  row: QuoteTermsSourceRow,
  opts: SnapshotBuildOptions,
): QuoteTermsSnapshot {
  return Object.freeze({
    kind: "quote_terms",
    sourceId: row.id,
    tenantId: row.tenant_id,
    sourceUpdatedAt: row.updated_at,
    capturedAt: opts.capturedAt,
    termsText: row.terms_text,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
  } satisfies QuoteTermsSnapshot);
}

/**
 * The union of source-row shapes, keyed by `kind`, the dispatcher accepts. `kind` is a
 * closed union (never client input at the builder boundary), so the mapping is exhaustive.
 */
export type SnapshotSourceRowFor<K extends SnapshotKind> = K extends "work_role"
  ? WorkRoleSourceRow
  : K extends "article"
    ? ArticleSourceRow
    : K extends "company_settings"
      ? CompanySettingsSourceRow
      : K extends "quote_terms"
        ? QuoteTermsSourceRow
        : never;

/**
 * OPTIONAL convenience dispatcher: switch on `kind` and delegate to the per-kind builder.
 * The per-kind builders remain the primary API; this is a convenience for callers that
 * carry the `kind` alongside the row. The `assertNever` default (mirroring the H4 inventory
 * switch discipline) makes adding a future source kind a COMPILE error until it is handled
 * here, so a new kind can never fall through to a silently-wrong branch.
 */
export function buildSnapshotSource<K extends SnapshotKind>(
  kind: K,
  row: SnapshotSourceRowFor<K>,
  opts: SnapshotBuildOptions,
): SnapshotSource {
  switch (kind) {
    case "work_role":
      return buildWorkRoleSnapshot(row as WorkRoleSourceRow, opts);
    case "article":
      return buildArticleSnapshot(row as ArticleSourceRow, opts);
    case "company_settings":
      return buildCompanySettingsSnapshot(row as CompanySettingsSourceRow, opts);
    case "quote_terms":
      return buildQuoteTermsSnapshot(row as QuoteTermsSourceRow, opts);
    default:
      return assertNever(kind);
  }
}

/**
 * Exhaustiveness guard — called from the dispatcher's `default:` arm. Because `kind` is
 * narrowed to `never` once every `SnapshotKind` member is handled, a FUTURE kind added to
 * the union WITHOUT a matching builder branch makes this a TypeScript COMPILE error
 * (fail-loud), never a silently-unhandled source. Mirrors the tenant-table-inventory
 * `assertNever` discipline.
 */
function assertNever(kind: never): never {
  throw new Error(
    `buildSnapshotSource: no builder branch for snapshot kind ${JSON.stringify(kind)}.`,
  );
}
