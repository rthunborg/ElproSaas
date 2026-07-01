-- ============================================================================
-- Migration: work_roles_and_articles
-- Story 3.4 — Work Roles And Optional Manual Articles.
--
-- The SIXTH migration in the project and the FIRST to add tenant-owned PRICING
-- tables, and the FIRST to store MONEY (hourly rates / unit prices) as INTEGER
-- ÖRE (architecture §7 v0 list — work_roles IN; articles OPTIONAL → promoted to
-- IN by the owner decision 2026-06-18). Creates two Phase-A pricing collections —
-- `work_roles` (labor pricing source — cost + sell HOURLY RATES in öre) and
-- `articles` (a minimal MANUAL material/article register — unit price in öre).
-- Each carries a DIRECT `tenant_id` (architecture §6 convention),
-- `created_at`/`updated_at` timestamps with the EXISTING `public.set_updated_at()`
-- BEFORE UPDATE trigger, a `tenant_id` index, an `is_active` active/archive
-- lifecycle column, and enable+FORCE RLS with own-tenant SELECT/INSERT/UPDATE
-- policies (NO delete policy — archive over hard delete).
--
-- It REUSES the objects landed by 20260625122433_tenant_foundation.sql:
-- `public.set_updated_at()` (the updated_at trigger fn — NOT redefined here) and
-- the RLS helper `public.is_tenant_admin` (the own-tenant policy predicate).
--
-- ----------------------------------------------------------------------------
-- COLLECTION SHAPE (the ONE difference vs the Story 3.3 settings migration):
-- work_roles and articles are MANY-rows-per-tenant collections — a tenant has
-- MANY work roles and MANY articles. So there is DELIBERATELY NO
-- `unique (tenant_id)` here (the settings tables are one-row-per-tenant and DO
-- carry it). These use the CRM customers create/update/archive command shape, NOT
-- the settings singleton upsert. [architecture §7; Story 3.1 collection shape]
--
-- ----------------------------------------------------------------------------
-- SCOPE DISCIPLINE (architecture §7; Story 3.4 Stop Conditions): work_roles and
-- articles are the ONLY tables this migration creates. NO tenant_counters (Epic 6),
-- NO calculation table (Epic 5), NO snapshot table (Story 3.5 / Epic 6).
--
-- ----------------------------------------------------------------------------
-- INTEGER-ÖRE MONEY DISCIPLINE (NFR9/AR13; architecture §10; epic-3 retro-note):
-- this is the FIRST money-STORING story, but it does NOT build a money/VAT/ROT/
-- grön-teknik CALCULATION engine (Epic 4 owns that). It STORES reusable prices
-- only. The cost/sell hourly rates (`cost_rate_ore`, `sell_rate_ore`) and the
-- article unit price (`unit_price_ore`) are `bigint` INTEGER ÖRE — NEVER a float
-- kronor column (no `numeric`/`double precision`/`real` money field anywhere). A
-- non-negative CHECK belt-and-braces with the command validator (`isOreAmount`);
-- the `bigint` type already forbids fractional öre.
--
-- ----------------------------------------------------------------------------
-- HARD NON-NEGOTIABLE — NO SUPPLIER SCOPE (epic-3 retro-note; epics.md AC2 + Stop
-- Conditions; architecture §7 / §Supplier-Pricing boundary): NEITHER table carries
-- ANY column whose name contains supplier / vendor / sync / import / external /
-- api / fortnox / edi / mapping — NO supplier credential, supplier id, external id,
-- sync/import field, EDI code, or external mapping of any kind. Articles are MANUAL,
-- MINIMAL material rows only (name, optional sku/unit, integer-öre unit price, an
-- active flag). A column-name guard test (tests/integration/rls/
-- pricing-tables-migration-reset.int.test.ts) FAILS LOUD if a future change smuggles
-- supplier scope in. Supplier credentials/IDs/APIs/imports/EDI/sync are deferred —
-- NOT Phase A.
--
-- ----------------------------------------------------------------------------
-- GRANT discipline (mirror the CRM/settings table grants EXACTLY — LOAD-BEARING):
-- New `public` tables are NOT auto-exposed to the Data API roles on this stack,
-- and RLS only NARROWS an already-granted role. The tenant admin DOES create /
-- update pricing rows via the app path, so grant deliberately:
--   * authenticated → SELECT, INSERT, UPDATE. The own-tenant SELECT/INSERT/UPDATE
--     policies narrow these to the caller's tenant. DELETE is NOT granted —
--     pricing rows are archived via an `is_active = false` UPDATE, never hard-deleted.
--   * service_role  → full DML (SELECT/INSERT/UPDATE/DELETE). The TEST-ONLY
--     factory seed/cleanup path (BYPASSRLS); the cascade teardown also relies on it.
--     Never used from an app/client path.
--   * anon          → NOTHING. An unauthenticated caller can touch neither.
--
-- ----------------------------------------------------------------------------
-- RLS (architecture §6, §9): ENABLE + FORCE on both (FORCE so even the table owner
-- is subject to RLS; the factories use the BYPASSRLS service_role for setup).
-- Own-tenant policies are expressed via the EXISTING `is_tenant_admin` helper:
-- SELECT/INSERT/UPDATE only. NO delete policy (archive over hard delete). A
-- cross-tenant write is denied by the WITH CHECK (`42501` new-row-violates-RLS on
-- INSERT); a cross-tenant read/update sees zero rows (RLS USING invisibility), so
-- the foreign row can never be read or mutated.
--
-- ----------------------------------------------------------------------------
-- SNAPSHOT SOURCE (architecture §11; Story 3.5 + Epics 5-6): both tables are
-- MUTABLE SOURCES that Story 3.5's snapshot contract and the Epic 5-6 calculation
-- rows / quote versions will FREEZE into immutable snapshots ("selected values are
-- snapshotted in rows/quotes"). The values are stored cleanly so a later snapshot
-- can capture {source id, display name, monetary öre value, source timestamp,
-- tenant ownership}. This migration does NOT build the snapshot mechanism, a
-- snapshot table, or any recompute/freeze logic — that is Story 3.5 + Epic 4-6.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: work_roles — the tenant-owned labor pricing source (architecture §7).
-- MANY rows per tenant (a tenant has many work roles).
-- ----------------------------------------------------------------------------
create table public.work_roles (
  id uuid primary key default gen_random_uuid(),
  -- Direct tenant ownership (architecture §6). Cascade so removing a tenant
  -- removes its pricing rows (no dangling tenant-orphaned data); the test cleanup
  -- relies on this cascade.
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The presentational role name used on lists / calculations (architecture §11
  -- snapshot source). NOT NULL + non-empty enforced at the command layer too.
  display_name text not null,
  -- The cost HOURLY RATE in INTEGER ÖRE (bigint — NEVER a float kronor column).
  -- Money discipline (architecture §10). A non-negative CHECK belt-and-braces with
  -- the command validator (`isOreAmount`); NO calculation is performed on it here.
  cost_rate_ore bigint not null,
  -- The sell HOURLY RATE in INTEGER ÖRE (bigint — NEVER a float).
  sell_rate_ore bigint not null,
  -- The active/archive lifecycle (the simplest representation matching AC1 "active
  -- state"; archive/reactivate by toggling via the archive/upsert command — never a
  -- hard DELETE). `true` = active; `false` = archived.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- INTEGER-ÖRE integrity: a rate is a non-negative integer number of öre. The
  -- `bigint` type forbids fractional öre; this forbids a NEGATIVE öre amount at the
  -- DB (belt-and-braces with the command validator).
  constraint work_roles_cost_rate_ore_non_negative check (cost_rate_ore >= 0),
  constraint work_roles_sell_rate_ore_non_negative check (sell_rate_ore >= 0)
);

comment on table public.work_roles is
  'Tenant-owned work role / labor pricing source (architecture §7). MANY rows per tenant (NO unique tenant_id — a collection, UNLIKE the Story 3.3 settings singletons). RLS-protected (own-tenant read/insert/update via is_tenant_admin; no delete — archive via is_active=false). cost_rate_ore + sell_rate_ore are the cost + sell HOURLY RATES in INTEGER ÖRE (bigint, CHECK >= 0; never a float, never a calc literal). NO money/VAT/ROT calculation engine here (Epic 4). MUTABLE snapshot source for Story 3.5 / Epics 5-6. NO supplier/vendor/credential/sync/import/external/api/fortnox/edi/mapping field; NO float money field.';

-- ----------------------------------------------------------------------------
-- Table: articles — a tenant-owned MINIMAL MANUAL material/article register
-- (architecture §7; owner decision 2026-06-18 — IN scope, manual rows only). MANY
-- rows per tenant. HARD NON-NEGOTIABLE: NO supplier scope of any kind.
-- ----------------------------------------------------------------------------
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The presentational article/material name used on lists / calculations
  -- (architecture §11 snapshot source). NOT NULL + non-empty at the command layer.
  name text not null,
  -- OPTIONAL article number / stock-keeping unit (a free-text manual label, NOT a
  -- supplier id or external mapping). Nullable.
  sku text,
  -- OPTIONAL unit of measure (e.g. 'st', 'm', 'tim'). A free-text manual label.
  unit text,
  -- The article UNIT PRICE in INTEGER ÖRE (bigint — NEVER a float). Money discipline
  -- (architecture §10). A non-negative CHECK belt-and-braces with `isOreAmount`.
  unit_price_ore bigint not null,
  -- The active/archive lifecycle (same shape as work_roles).
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- INTEGER-ÖRE integrity: a non-negative integer number of öre.
  constraint articles_unit_price_ore_non_negative check (unit_price_ore >= 0)
);

comment on table public.articles is
  'Tenant-owned MINIMAL MANUAL article/material register (architecture §7; owner decision 2026-06-18 — IN scope, manual rows only). MANY rows per tenant (NO unique tenant_id — a collection). RLS-protected (own-tenant read/insert/update via is_tenant_admin; no delete — archive via is_active=false). Columns: name, optional sku/unit, unit_price_ore (the article UNIT PRICE in INTEGER ÖRE — bigint, CHECK >= 0; never a float). MUTABLE snapshot source for Story 3.5 / Epics 5-6. HARD NON-NEGOTIABLE — NO supplier scope: NO supplier/vendor/credential/sync/import/external/api/fortnox/edi/mapping column, NO supplier id / external id / catalog import / EDI / sync field. Manual material rows only (Story 3.4 Stop Condition). NO money/VAT calculation engine (Epic 4).';

-- ----------------------------------------------------------------------------
-- updated_at triggers — REUSE the EXISTING public.set_updated_at() (landed by
-- 20260625122433_tenant_foundation.sql). Do NOT redefine the function.
-- ----------------------------------------------------------------------------
create trigger work_roles_set_updated_at
  before update on public.work_roles
  for each row execute function public.set_updated_at();

create trigger articles_set_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Indexes for the command/RLS access paths (architecture §22). UNLIKE the settings
-- tables, there is NO unique(tenant_id) to provide one, so the explicit btree on
-- tenant_id is the access-path index for the per-tenant list reads.
-- ----------------------------------------------------------------------------
create index work_roles_tenant_id_idx on public.work_roles (tenant_id);
create index articles_tenant_id_idx on public.articles (tenant_id);

-- ----------------------------------------------------------------------------
-- Base table privileges (GRANTs) — see the GRANT discipline note in the header.
--   authenticated → SELECT, INSERT, UPDATE (the admin manages pricing via the app
--                   path; DELETE withheld — archive via is_active=false UPDATE).
--   service_role  → full DML (TEST-ONLY factory seed/cleanup; BYPASSRLS).
--   anon          → NOTHING.
-- ----------------------------------------------------------------------------
grant select, insert, update on public.work_roles to authenticated;
grant select, insert, update on public.articles to authenticated;
grant select, insert, update, delete on public.work_roles to service_role;
grant select, insert, update, delete on public.articles to service_role;

-- ----------------------------------------------------------------------------
-- Row Level Security: ENABLE + FORCE on both (architecture §6, §9).
-- ----------------------------------------------------------------------------
alter table public.work_roles enable row level security;
alter table public.work_roles force row level security;
alter table public.articles enable row level security;
alter table public.articles force row level security;

-- ----------------------------------------------------------------------------
-- Policies: own-tenant SELECT / INSERT / UPDATE via the EXISTING is_tenant_admin
-- helper. NO delete policy (archive over hard delete). 6 new policies (3 per table).
--
-- SELECT  using  is_tenant_admin(tenant_id)  — read only own-tenant rows.
-- INSERT  with check is_tenant_admin(tenant_id) — a row carrying another tenant's
--         tenant_id fails the WITH CHECK (42501 new-row-violates-RLS).
-- UPDATE  using + with check is_tenant_admin(tenant_id) — a cross-tenant row is
--         invisible (USING) so it can't be selected for update; an attempt to move
--         a row to another tenant fails the WITH CHECK.
-- ----------------------------------------------------------------------------

-- work_roles
create policy work_roles_select_own
  on public.work_roles
  for select
  to authenticated
  using (public.is_tenant_admin(tenant_id));

create policy work_roles_insert_own
  on public.work_roles
  for insert
  to authenticated
  with check (public.is_tenant_admin(tenant_id));

create policy work_roles_update_own
  on public.work_roles
  for update
  to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- articles
create policy articles_select_own
  on public.articles
  for select
  to authenticated
  using (public.is_tenant_admin(tenant_id));

create policy articles_insert_own
  on public.articles
  for insert
  to authenticated
  with check (public.is_tenant_admin(tenant_id));

create policy articles_update_own
  on public.articles
  for update
  to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- INTENTIONALLY NOT EXPOSED to the app path (archive-over-delete discipline):
--   * work_roles/articles DELETE — no grant to authenticated AND no delete policy
--     → DENY-by-default. Archival is an UPDATE of is_active = false.
