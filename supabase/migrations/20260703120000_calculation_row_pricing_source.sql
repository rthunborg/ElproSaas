-- ============================================================================
-- Story 5.3 — pricing-SOURCE snapshot columns on calculation_rows (ADDITIVE).
--
-- This migration ADDITIVELY adds the FROZEN copy-by-value pricing-source snapshot
-- columns to the EXISTING public.calculation_rows table (Story 5.1). It does NOT
-- edit the frozen 5.1 migration (20260702120000_calculation_data_model.sql), does
-- NOT create a new table, and does NOT add any deferred/job/project/field-worker
-- column. The new columns are NULLABLE — a manual/free-text row carries NO source.
--
-- ── SNAPSHOT MODEL (architecture §11) ──────────────────────────────────────
-- The row captures the source's values BY VALUE (a copy-by-value + Object.freeze
-- snapshot built by the Story 3.5 buildWorkRoleSnapshot/buildArticleSnapshot pure
-- builders). It is NOT a live reference / FK to work_roles or articles: a later
-- archive or rate-change of the source MUST NOT change any prior row's stored
-- snapshot (AC3, R-507). There is DELIBERATELY no FK from source_id to
-- work_roles/articles — a live FK would break the freeze when the source is later
-- archived/deleted. `source_id` is a CAPTURED VALUE, not a referential FK.
--
-- ── HARD NO-SUPPLIER-SCOPE (AC2) ───────────────────────────────────────────
-- NONE of the new column names contain supplier/credential/api_key/apikey/sync/
-- import/external/fortnox/mapping — all use the clean `source_*` prefix. A frozen
-- migration-reset guard scans EVERY calc-table column and FAILS on any match.
--
-- ── MONEY DISCIPLINE (architecture §10, AC5) ───────────────────────────────
-- Every new money column is INTEGER ÖRE as `bigint` and ends in `_ore`
-- (source_price_ore, source_cost_ore) with a non-negative DB CHECK — matching the
-- frozen 5.1 öre discipline. The `_ore` suffix keeps them covered by BOTH the
-- every-%_ore-is-bigint guard AND the inherited 5.1 name-suffix money guard. A
-- money column NOT ending in `_ore` (or of a float/numeric type) would be a schema
-- violation.
--
-- No new tenant_id column (rows already carry the resolved tenant_id from 5.1) and
-- no new RLS policy/table — the columns inherit calculation_rows' own-tenant RLS.
-- [Source: epics.md#Story 5.3 AC1/AC2/AC5; architecture.md#10/#11;
--  src/lib/snapshots/types.ts (WorkRoleSnapshot/ArticleSnapshot field set);
--  tests/integration/rls/calc-tables-migration-reset.int.test.ts:219-230/334-345]
-- ============================================================================

alter table public.calculation_rows
  -- The closed source discriminator — mirrors the Story 3.5 SnapshotKind subset that
  -- applies to calc rows (ONLY work_role/article; NOT company_settings/quote_terms).
  add column source_kind text
    check (source_kind is null or source_kind in ('work_role', 'article')),
  -- The captured source row id (a COPY-BY-VALUE, NOT an FK — see the header). Nullable:
  -- a manual/free-text row has no source.
  add column source_id uuid,
  -- The captured source display name/label (work_roles.display_name / articles.name).
  add column source_name text,
  -- The captured source PRICE in INTEGER ÖRE: the work-role SELL rate (sell_rate_ore)
  -- or the article unit price (unit_price_ore). bigint forbids fractional öre; the
  -- CHECK forbids a negative amount (belt-and-braces with the command's isOreAmount).
  add column source_price_ore bigint
    check (source_price_ore is null or source_price_ore >= 0),
  -- OPTIONAL captured COST provenance in INTEGER ÖRE: the work-role cost rate
  -- (cost_rate_ore). NULL for an article (an article has no cost rate). Same öre
  -- discipline: bigint + non-negative CHECK, `_ore`-suffixed so the guards cover it.
  add column source_cost_ore bigint
    check (source_cost_ore is null or source_cost_ore >= 0),
  -- The source row's `updated_at` at capture time — the source "version" (the source
  -- tables carry no explicit version column; updated_at is the version).
  add column source_updated_at timestamptz,
  -- The snapshot BUILD instant (the injected clock's capturedAt), NOT a wall-clock read.
  add column source_captured_at timestamptz,
  -- OPTIONAL captured article number (articles.sku) — a free-text manual label (a plain
  -- article-number string; NOT any vendor/procurement reference). NULL for a work-role row
  -- (and when the article has no sku).
  add column source_sku text,
  -- OPTIONAL captured article unit of measure (articles.unit). NULL for a work-role row.
  add column source_unit text;

comment on column public.calculation_rows.source_kind is
  'Story 5.3 pricing-source snapshot: the closed source discriminator (work_role|article — the Story 3.5 SnapshotKind subset that applies to calc rows). NULL = a manual/free-text row with no source. COPY-BY-VALUE, never a live FK.';
comment on column public.calculation_rows.source_price_ore is
  'Story 5.3 pricing-source snapshot: the captured source PRICE in INTEGER ÖRE (work-role sell_rate_ore / article unit_price_ore), copied by value at selection time (frozen; never a re-read of the mutable source). bigint + non-negative CHECK, `_ore`-suffixed.';
