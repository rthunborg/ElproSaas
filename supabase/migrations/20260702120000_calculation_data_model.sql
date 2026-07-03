-- ============================================================================
-- Migration: calculation_data_model
-- Story 5.1 — Tenant-Owned Calculation Schema And Server Commands.
--
-- The SEVENTH migration in the project and the FIRST to add the CALCULATION
-- tables (architecture §7 v0 IN list — calculations / calculation_sections /
-- calculation_rows). Creates the three Phase-A calculation entities — a Kalkyl
-- header (`calculations`), ordered groupings (`calculation_sections`), and the
-- line rows (`calculation_rows`, labor/material/subcontractor/machinery/other) —
-- each carrying a DIRECT `tenant_id` (architecture §6 convention), a soft-delete
-- `archived_at` column (archive over hard delete), `created_at`/`updated_at`
-- timestamps with the EXISTING `public.set_updated_at()` BEFORE UPDATE trigger,
-- and the COMPOSITE same-tenant parent constraints (architecture §6 — a child
-- duplicates `tenant_id` and references its parent on BOTH (id, tenant_id) so a
-- child can only point at a parent IN THE SAME tenant; a bare `references
-- calculations(id)` would let a section point at another tenant's calc).
--
-- It REUSES the objects landed by 20260625122433_tenant_foundation.sql:
-- `public.set_updated_at()` (the updated_at trigger fn — NOT redefined here) and
-- the RLS helper `public.is_tenant_admin` (the own-tenant policy predicate).
--
-- ----------------------------------------------------------------------------
-- MIGRATION-FAILURE TRAP — `contacts` lacked `unique (id, tenant_id)` (AC1):
-- ----------------------------------------------------------------------------
-- The composite same-tenant FK from `calculations.contact_id` to
-- `contacts (id, tenant_id)` requires the referenced `(id, tenant_id)` to be
-- UNIQUE/PK. UNLIKE `customers`/`facilities` (which carry `<t>_id_tenant_unique`
-- from Story 3.1's 20260630120000_crm_data_model.sql), `contacts` was never
-- referenced as a composite parent so it has NO such constraint. This migration
-- ADDITIVELY adds `contacts_id_tenant_unique unique (id, tenant_id)` on the
-- EXISTING `contacts` table (legal additive DDL — the frozen Story 3.1 migration
-- is NOT edited) BEFORE the referencing FK. `calculations` and
-- `calculation_sections` also carry their own `_id_tenant_unique` because they
-- are themselves composite-FK targets of their children.
--
-- ----------------------------------------------------------------------------
-- SCOPE DISCIPLINE (architecture §7; Story 5.1 Stop Conditions):
-- calculations / calculation_sections / calculation_rows are the ONLY tables this
-- migration creates. NO quotes/quote_versions (Epic 6), NO jobs/files (Epics 7-8),
-- and CRITICALLY no deferred-module table (job/project/field-worker) and no
-- supplier / credential / sync / import / external-mapping / API / Fortnox column
-- on ANY calc table — a HARD non-negotiable Stop Condition (the pricing-SOURCE row
-- snapshot columns are Story 5.3, NOT here). A column-name guard test
-- (tests/integration/rls/calc-tables-migration-reset.int.test.ts) FAILS LOUD if a
-- future change smuggles supplier scope in.
--
-- ----------------------------------------------------------------------------
-- INTEGER-ÖRE MONEY DISCIPLINE (NFR9/AR13; architecture §10; epic-3/4 retro-note):
-- calc row money columns (`unit_cost_ore`, `unit_sell_ore`) are `bigint` INTEGER
-- ÖRE — NEVER a float kronor column (no `numeric`/`double precision`/`real` money
-- field anywhere). A non-negative CHECK is belt-and-braces with the command
-- validator (the CANONICAL `isOreAmount` from `@/lib/money`); the `bigint` type
-- already forbids fractional öre. Quantities are explicit `numeric` (decimal) with
-- a CHECK (> 0) plus a free-text `unit` (architecture §10). VAT assumptions are
-- BASIS POINTS (`vat_rate_bp integer`, 2500 = 25.00%). Margin/markup, when stored,
-- is BASIS POINTS (`markup_bp integer`) — never a float percentage. This migration
-- STORES the row inputs; it does NOT build or fork a money/VAT/ROT calculation
-- engine (Epic 4 owns `@/lib/money`; totals are Story 5.2/5.4).
--
-- ----------------------------------------------------------------------------
-- LIFECYCLE + FIXTURE-FRIENDLY FLAGS (Story 5.1 Open Questions 1-3, conservative
-- defaults): `calculations.status` is the small closed set draft/ready/archived
-- (the `status` VALUE is distinct from the `archived_at` soft-delete timestamp).
-- `calculation_sections.display_mode` is detailed/summary/text_only (persisted so
-- Story 5.5 goldens can drive it; the totals-INCLUSION logic is Epic 4/5.4, NOT
-- here). `calculation_rows` persists the visibility/option flags is_hidden /
-- is_optional / is_selected (Story 5.2/5.4 own the owner-pinned INCLUSION rule;
-- THIS migration only PERSISTS them). No inclusion/total column is computed here.
--
-- ----------------------------------------------------------------------------
-- SNAPSHOT SOURCE (architecture §11; Stories 5.3 + Epic 6): the row is left
-- SNAPSHOT-SOURCE-FRIENDLY — Story 5.3 ADDS the frozen pricing-source columns
-- ({source id, name, öre, source updated_at, tenant}) to `calculation_rows`, and
-- Epic 6 references the calc id + display into quote snapshots. This migration does
-- NOT build those columns and does NOT block them.
--
-- ----------------------------------------------------------------------------
-- ATOMIC MULTI-ROW WRITES (ADR-A009): the narrow `reorder_calculation_rows`
-- Postgres RPC at the bottom owns the transaction boundary + row ordering + full
-- rollback for a multi-row reorder — NOT client-side multi-step persistence
-- (explicit 5.1 tech-note prohibition + R-503). It is SECURITY INVOKER (ADR-A009
-- default) so it executes under the CALLER's RLS — ordering/persistence stays
-- tenant-scoped by the own-tenant policies, no service-role app path — with a fixed
-- empty `search_path` (defensive, schema-qualified refs) matching the DEFINER-fn
-- hardening discipline. A SECURITY DEFINER RPC would need separate approval + a
-- membership check + dedicated negative tests; INVOKER is preferred and sufficient.
--
-- ----------------------------------------------------------------------------
-- GRANT discipline (mirror the CRM/pricing table grants EXACTLY — LOAD-BEARING):
-- New `public` tables are NOT auto-exposed to the Data API roles on this stack, and
-- RLS only NARROWS an already-granted role. The tenant admin DOES create / update /
-- archive calc rows via the app path, so grant deliberately:
--   * authenticated → SELECT, INSERT, UPDATE. The own-tenant SELECT/INSERT/UPDATE
--     policies narrow these to the caller's tenant. DELETE is NOT granted — a calc
--     row is archived via an `archived_at` UPDATE, never hard-deleted.
--   * service_role  → full DML (SELECT/INSERT/UPDATE/DELETE). The TEST-ONLY factory
--     seed/cleanup path (BYPASSRLS); the cascade teardown also relies on it. Never
--     used from an app/client path.
--   * anon          → NOTHING. An unauthenticated caller can touch none of these.
--
-- ----------------------------------------------------------------------------
-- RLS (architecture §6, §9): ENABLE + FORCE on all three (FORCE so even the table
-- owner is subject to RLS; the factories use the BYPASSRLS service_role for setup).
-- Own-tenant policies are expressed via the EXISTING `is_tenant_admin` helper:
-- SELECT/INSERT/UPDATE only. NO delete policy (archive over hard delete). A
-- cross-tenant write is denied by the WITH CHECK (`42501` new-row-violates-RLS on
-- INSERT); a cross-tenant read/update sees zero rows (RLS USING invisibility), so
-- the foreign row can never be read or mutated.
--
-- INHERITED-AND-ACCEPTED PHASE-A RLS POSTURE (deferred-work 2-2/2-3, Story 2.4
-- owner): the own-tenant SELECT policy scopes reads by TENANT
-- (`is_tenant_admin(tenant_id)`), not by `user_id = auth.uid()`, so in a multi-admin
-- tenant co-admins read each other's calc rows within their OWN tenant (never across
-- a boundary) — the SAME accepted single-admin Phase-A design as tenant_memberships/
-- audit_events. Least-privilege tightening is the Story 2.4 / RBAC seam, NOT here.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PREREQUISITE: the composite-FK TARGET uniques must exist BEFORE the referencing
-- FKs are created. `customers`/`facilities` already carry
-- `<t>_id_tenant_unique unique (id, tenant_id)` from the Story 3.1 migration
-- (20260630120000_crm_data_model.sql:127,162). `contacts` does NOT — add it here
-- ADDITIVELY (legal DDL on an existing table; the frozen 3.1 migration is untouched).
-- ----------------------------------------------------------------------------
alter table public.contacts
  add constraint contacts_id_tenant_unique unique (id, tenant_id);

-- ----------------------------------------------------------------------------
-- Table: calculations (Kalkyl header) — the tenant-owned calculation root
-- (architecture §7). A calc always belongs to a customer; a facility/contact are
-- OPTIONAL parent links. MANY rows per tenant (a collection — NO unique tenant_id).
-- ----------------------------------------------------------------------------
create table public.calculations (
  id uuid primary key default gen_random_uuid(),
  -- Direct tenant ownership (architecture §6). Cascade so removing a tenant removes
  -- its calc rows (no dangling tenant-orphaned data); the test cleanup relies on this
  -- cascade reaching calculations/sections/rows.
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The parent customer (always present — a calc always has a customer). NOT NULL.
  customer_id uuid not null,
  -- OPTIONAL facility link (a calc may target a specific facility). Nullable.
  facility_id uuid,
  -- OPTIONAL contact link (a calc may reference a specific contact). Nullable.
  contact_id uuid,
  -- The presentational calculation title used on lists / quote snapshots
  -- (architecture §11 snapshot source). NOT NULL + non-empty at the command layer.
  title text not null,
  -- Lifecycle status (Open Question 1 conservative default): the small closed set
  -- draft/ready/archived. Distinct from the `archived_at` soft-delete timestamp —
  -- a legal-transition STATE MACHINE is enforced at the command validation layer.
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'archived')),
  -- Soft-delete: NULL = active; a non-null timestamp = archived (archive over hard
  -- delete, architecture §6). Set via the archive command's UPDATE.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- COMPOSITE same-tenant FK to the parent customer (architecture §6): the calc's
  -- (customer_id, tenant_id) must match an EXISTING customers (id, tenant_id), so a
  -- calc can only reference a same-tenant customer. A bare `references customers(id)`
  -- would let a Tenant A calc point at a Tenant B customer; this composite constraint
  -- makes that a DB-level rejection (23503). Cascade so removing a customer's tenant
  -- removes its calcs.
  constraint calculations_customer_same_tenant
    foreign key (customer_id, tenant_id)
    references public.customers (id, tenant_id)
    on delete cascade,
  -- OPTIONAL composite same-tenant FK to a facility. NULLABLE. When present,
  -- (facility_id, tenant_id) must match a same-tenant facility — a cross-tenant
  -- facility link is a DB-level rejection. ON DELETE SET NULL so removing a facility
  -- detaches the calc from it (the calc survives at the customer level).
  constraint calculations_facility_same_tenant
    foreign key (facility_id, tenant_id)
    references public.facilities (id, tenant_id)
    on delete set null,
  -- OPTIONAL composite same-tenant FK to a contact (requires the ADDITIVE
  -- contacts_id_tenant_unique above). NULLABLE + ON DELETE SET NULL.
  constraint calculations_contact_same_tenant
    foreign key (contact_id, tenant_id)
    references public.contacts (id, tenant_id)
    on delete set null,
  -- The composite UNIQUE the calculation_sections same-tenant FK references.
  constraint calculations_id_tenant_unique unique (id, tenant_id)
);

comment on table public.calculations is
  'Tenant-owned calculation header (Kalkyl, architecture §7). MANY rows per tenant (a collection — NO unique tenant_id). RLS-protected (own-tenant read/insert/update via is_tenant_admin; no delete — archive via archived_at). status in (draft|ready|archived), a command-layer lifecycle state machine (distinct from the archived_at soft-delete timestamp). Composite same-tenant FKs to customers(id,tenant_id) [required] + facilities(id,tenant_id) + contacts(id,tenant_id) [optional] so a calc can only reference same-tenant parents (architecture §6). Snapshot source for Epic 6 (source calculation id). NO money/VAT/ROT engine here (Epic 4). NO deferred job/project/field-worker or supplier/credential/sync/import/external/api/fortnox/mapping column (Story 5.1 Stop Condition).';

-- ----------------------------------------------------------------------------
-- Table: calculation_sections (ordered grouping) — many-per-calc.
-- ----------------------------------------------------------------------------
create table public.calculation_sections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The parent calculation. NOT NULL — a section always belongs to a calc.
  calculation_id uuid not null,
  -- OPTIONAL section title (a section may be untitled). Nullable.
  title text,
  -- Section display MODE (Open Question 2 conservative default): detailed/summary/
  -- text_only per the golden pack. PERSISTED so Story 5.5 goldens can drive it; the
  -- totals-INCLUSION logic is Epic 4/5.4, NOT this story.
  display_mode text not null default 'detailed'
    check (display_mode in ('detailed', 'summary', 'text_only')),
  -- Server-owned ordering column (see the reorder_calculation_rows RPC + Task 4).
  -- The command/RPC owns this — never a client-persisted consistency boundary.
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- COMPOSITE same-tenant FK to the parent calc (architecture §6): a section can
  -- only reference a same-tenant calculation. Cascade so removing a calc removes its
  -- sections. (Requires calculations_id_tenant_unique above.)
  constraint calculation_sections_calc_same_tenant
    foreign key (calculation_id, tenant_id)
    references public.calculations (id, tenant_id)
    on delete cascade,
  -- The composite UNIQUE the calculation_rows same-tenant FK references.
  constraint calculation_sections_id_tenant_unique unique (id, tenant_id)
);

comment on table public.calculation_sections is
  'Tenant-owned calculation section (ordered grouping, architecture §7). Many-per-calc. RLS-protected (own-tenant; archive via archived_at, no delete policy). Composite same-tenant FK calculation_sections(calculation_id,tenant_id) -> calculations(id,tenant_id) so a section can only reference a same-tenant calc (architecture §6). display_mode in (detailed|summary|text_only) — PERSISTED for Story 5.5 goldens; the totals-inclusion logic is Epic 4/5.4, NOT here. sort_order is SERVER-owned (the reorder RPC owns the transaction boundary + ordering — ADR-A009). NO supplier/credential/sync/import/external/api/fortnox/mapping column.';

-- ----------------------------------------------------------------------------
-- Table: calculation_rows (labor/material/subcontractor/machinery/other) — the
-- line rows. Many-per-section. Integer-öre money; decimal quantity + unit; VAT bp.
-- ----------------------------------------------------------------------------
create table public.calculation_rows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The parent section. NOT NULL — a row always belongs to a section.
  section_id uuid not null,
  -- The closed row-type union (architecture §7). Any other value is rejected by the
  -- DB (belt-and-braces with the command validator's closed union).
  row_type text not null
    check (row_type in ('labor', 'material', 'subcontractor', 'machinery', 'other')),
  -- Explicit DECIMAL quantity (architecture §10 — NOT integer) + a free-text unit.
  -- CHECK (> 0) belt-and-braces with the command validator; `unit` NOT NULL + non-
  -- empty at the command layer.
  quantity numeric not null check (quantity > 0),
  unit text not null,
  -- Money columns in INTEGER ÖRE (bigint — NEVER a float kronor column). Both
  -- NULLABLE per row type (a free-text/`other` row may carry only a sell price). A
  -- non-negative CHECK belt-and-braces with the canonical `isOreAmount`; the `bigint`
  -- type forbids fractional öre.
  unit_cost_ore bigint,
  unit_sell_ore bigint,
  -- OPTIONAL margin/markup in BASIS POINTS (Open Question 3 conservative default) —
  -- integer bp, never a float percentage. The money authority stays in öre.
  markup_bp integer,
  -- The row's VAT assumption in BASIS POINTS (2500 = 25.00%). The command validator
  -- requires it present + bp-shaped; nullable at the DB so a partial draft can persist
  -- before validation, but the create path always supplies it.
  vat_rate_bp integer,
  -- Phase A quote-visibility + tillval (option) flags. PERSISTED here; the owner-
  -- pinned INCLUSION semantics are Epic 4/5.4's owner — THIS story does NOT compute
  -- totals. is_selected is nullable (unset until a tillval is chosen).
  is_hidden boolean not null default false,
  is_optional boolean not null default false,
  is_selected boolean,
  -- Quote-visible label/description + internal note + quote-visible note text.
  -- (pricing-SOURCE snapshot columns are Story 5.3, NOT here — the row is left
  -- snapshot-source-friendly but those columns are not built now.)
  label text,
  description text,
  internal_note text,
  quote_note text,
  -- Server-owned ordering column (see the reorder_calculation_rows RPC).
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- COMPOSITE same-tenant FK to the parent section (architecture §6): a row can only
  -- reference a same-tenant section. Cascade so removing a section removes its rows.
  -- (Requires calculation_sections_id_tenant_unique above.)
  constraint calculation_rows_section_same_tenant
    foreign key (section_id, tenant_id)
    references public.calculation_sections (id, tenant_id)
    on delete cascade,
  -- INTEGER-ÖRE integrity: a price is a non-negative integer number of öre when
  -- present. `bigint` forbids fractional öre; these forbid a NEGATIVE öre amount at
  -- the DB (belt-and-braces with the command validator's canonical isOreAmount).
  constraint calculation_rows_unit_cost_ore_non_negative
    check (unit_cost_ore is null or unit_cost_ore >= 0),
  constraint calculation_rows_unit_sell_ore_non_negative
    check (unit_sell_ore is null or unit_sell_ore >= 0)
);

comment on table public.calculation_rows is
  'Tenant-owned calculation row (line item, architecture §7). Many-per-section. row_type in (labor|material|subcontractor|machinery|other). RLS-protected (own-tenant; archive via archived_at, no delete policy). Composite same-tenant FK calculation_rows(section_id,tenant_id) -> calculation_sections(id,tenant_id) so a row can only reference a same-tenant section (architecture §6). Money: unit_cost_ore/unit_sell_ore are INTEGER ÖRE (bigint, CHECK >= 0; never a float, never a calc literal); quantity is explicit numeric (CHECK > 0) + a unit; vat_rate_bp + markup_bp are BASIS POINTS (integer, never a float percentage). Visibility/option flags is_hidden/is_optional/is_selected are PERSISTED; the owner-pinned inclusion semantics are Epic 4/5.4. Snapshot-source-friendly (Story 5.3 adds frozen pricing-source columns). NO money/VAT/ROT engine here (Epic 4). NO supplier/credential/sync/import/external/api/fortnox/mapping column (Story 5.1 Stop Condition).';

-- ----------------------------------------------------------------------------
-- updated_at triggers — REUSE the EXISTING public.set_updated_at() (landed by
-- 20260625122433_tenant_foundation.sql). Do NOT redefine the function.
-- ----------------------------------------------------------------------------
create trigger calculations_set_updated_at
  before update on public.calculations
  for each row execute function public.set_updated_at();

create trigger calculation_sections_set_updated_at
  before update on public.calculation_sections
  for each row execute function public.set_updated_at();

create trigger calculation_rows_set_updated_at
  before update on public.calculation_rows
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Indexes for the command/RLS/ordering access paths (architecture §22; mirror the
-- CRM/pricing index pattern).
-- ----------------------------------------------------------------------------
create index calculations_tenant_id_idx
  on public.calculations (tenant_id);
create index calculations_tenant_customer_idx
  on public.calculations (tenant_id, customer_id);
create index calculation_sections_tenant_calc_sort_idx
  on public.calculation_sections (tenant_id, calculation_id, sort_order);
create index calculation_rows_tenant_section_sort_idx
  on public.calculation_rows (tenant_id, section_id, sort_order);

-- ----------------------------------------------------------------------------
-- Base table privileges (GRANTs) — see the GRANT discipline note in the header.
--   authenticated → SELECT, INSERT, UPDATE (the admin manages calc via the app
--                   path; DELETE withheld — archive via archived_at UPDATE).
--   service_role  → full DML (TEST-ONLY factory seed/cleanup; BYPASSRLS).
--   anon          → NOTHING.
-- ----------------------------------------------------------------------------
grant select, insert, update on public.calculations to authenticated;
grant select, insert, update on public.calculation_sections to authenticated;
grant select, insert, update on public.calculation_rows to authenticated;
grant select, insert, update, delete on public.calculations to service_role;
grant select, insert, update, delete on public.calculation_sections to service_role;
grant select, insert, update, delete on public.calculation_rows to service_role;

-- ----------------------------------------------------------------------------
-- Row Level Security: ENABLE + FORCE on all three (architecture §6, §9).
-- ----------------------------------------------------------------------------
alter table public.calculations enable row level security;
alter table public.calculations force row level security;
alter table public.calculation_sections enable row level security;
alter table public.calculation_sections force row level security;
alter table public.calculation_rows enable row level security;
alter table public.calculation_rows force row level security;

-- ----------------------------------------------------------------------------
-- Policies: own-tenant SELECT / INSERT / UPDATE via the EXISTING is_tenant_admin
-- helper. NO delete policy (archive over hard delete). 9 new policies (3 per table).
--
-- SELECT  using  is_tenant_admin(tenant_id)  — read only own-tenant rows.
-- INSERT  with check is_tenant_admin(tenant_id) — a row carrying another tenant's
--         tenant_id fails the WITH CHECK (42501 new-row-violates-RLS).
-- UPDATE  using + with check is_tenant_admin(tenant_id) — a cross-tenant row is
--         invisible (USING) so it can't be selected for update; an attempt to move
--         a row to another tenant fails the WITH CHECK.
-- ----------------------------------------------------------------------------

-- calculations
create policy calculations_select_own
  on public.calculations
  for select
  to authenticated
  using (public.is_tenant_admin(tenant_id));

create policy calculations_insert_own
  on public.calculations
  for insert
  to authenticated
  with check (public.is_tenant_admin(tenant_id));

create policy calculations_update_own
  on public.calculations
  for update
  to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- calculation_sections
create policy calculation_sections_select_own
  on public.calculation_sections
  for select
  to authenticated
  using (public.is_tenant_admin(tenant_id));

create policy calculation_sections_insert_own
  on public.calculation_sections
  for insert
  to authenticated
  with check (public.is_tenant_admin(tenant_id));

create policy calculation_sections_update_own
  on public.calculation_sections
  for update
  to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- calculation_rows
create policy calculation_rows_select_own
  on public.calculation_rows
  for select
  to authenticated
  using (public.is_tenant_admin(tenant_id));

create policy calculation_rows_insert_own
  on public.calculation_rows
  for insert
  to authenticated
  with check (public.is_tenant_admin(tenant_id));

create policy calculation_rows_update_own
  on public.calculation_rows
  for update
  to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- INTENTIONALLY NOT EXPOSED to the app path (archive-over-delete discipline):
--   * calculations/calculation_sections/calculation_rows DELETE — no grant to
--     authenticated AND no delete policy → DENY-by-default. Archival is an UPDATE of
--     archived_at.

-- ----------------------------------------------------------------------------
-- Narrow atomic reorder RPC (ADR-A009). Reorders the rows of ONE section in a
-- SINGLE DB-side transaction: it assigns a new server-owned sort_order to each row
-- in the supplied order, in one statement set that either fully commits or fully
-- rolls back. If ANY supplied id does not belong to the section (or is not visible
-- under the caller's RLS), the whole reorder is REJECTED (23514 check_violation) —
-- no partial ordering is committed (R-503).
--
-- SECURITY INVOKER (ADR-A009 default): it runs under the CALLER's RLS, so it can
-- only touch the caller's own-tenant rows (the own-tenant UPDATE policy narrows it).
-- No service-role path from the app. A fixed empty search_path + schema-qualified
-- refs are defensive hardening (matching the DEFINER-fn discipline), even though an
-- INVOKER fn does not have the same hijack surface.
-- ----------------------------------------------------------------------------
create or replace function public.reorder_calculation_rows(
  p_section_id uuid,
  p_ordered_row_ids uuid[]
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected integer;
  v_matched integer;
  v_updated integer;
begin
  -- How many DISTINCT ids were supplied. A duplicate id in the payload is a bad
  -- request — reject the whole reorder rather than silently collapsing it.
  select count(*) into v_expected from unnest(p_ordered_row_ids) as t(id);
  if v_expected <> (
    select count(distinct id) from unnest(p_ordered_row_ids) as t(id)
  ) then
    raise exception 'reorder_calculation_rows: duplicate row id in payload'
      using errcode = 'check_violation';
  end if;

  -- How many of the supplied ids are REAL rows of THIS section that are visible
  -- under the caller's RLS. If any supplied id is not one of them, the counts
  -- differ → the whole reorder aborts (no partial order committed). This is the
  -- R-503 rollback guarantee: a single failing item rolls back the entire txn.
  select count(*) into v_matched
    from public.calculation_rows r
   where r.section_id = p_section_id
     and r.id = any (p_ordered_row_ids);

  if v_matched <> v_expected then
    raise exception
      'reorder_calculation_rows: one or more row ids do not belong to the section'
      using errcode = 'check_violation';
  end if;

  -- Assign the new server-owned sort_order by array position. A single UPDATE ...
  -- FROM over the unnested ordinal set — one atomic statement, so a fault leaves no
  -- partial order. RLS narrows the UPDATE to the caller's own-tenant rows.
  with ordered as (
    select id, ord
      from unnest(p_ordered_row_ids) with ordinality as t(id, ord)
  )
  update public.calculation_rows r
     set sort_order = ordered.ord
    from ordered
   where r.id = ordered.id
     and r.section_id = p_section_id;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

comment on function public.reorder_calculation_rows(uuid, uuid[]) is
  'Narrow atomic reorder RPC (architecture ADR-A009). Reassigns the server-owned sort_order of ONE section''s rows in a SINGLE DB-side transaction (fully commits or fully rolls back — R-503). Rejects the WHOLE reorder (23514 check_violation) if any supplied id is not a same-section row visible under the caller''s RLS, or if the payload has a duplicate id — so no partial order is committed. SECURITY INVOKER (runs under the caller''s RLS — own-tenant only, no service-role app path) with a fixed empty search_path. The Next.js server command handles auth/session/membership/validation, then calls this; the RPC owns the transaction boundary + ordering + rollback — NOT client-side multi-step persistence.';

-- Function privileges: revoke the implicit PUBLIC EXECUTE, then grant ONLY to the
-- app-runtime + test roles. anon must NOT be able to reorder.
revoke execute on function public.reorder_calculation_rows(uuid, uuid[]) from public;
grant execute on function public.reorder_calculation_rows(uuid, uuid[]) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Narrow atomic reorder RPC for SECTIONS (ADR-A009). The symmetric parent-level
-- reorder: reassigns the server-owned sort_order of ONE calculation's sections in a
-- SINGLE DB-side transaction (fully commits or fully rolls back — R-503). Identical
-- SECURITY INVOKER + fixed-search_path discipline as reorder_calculation_rows; the
-- parent is the calculation, the children are its sections.
-- ----------------------------------------------------------------------------
create or replace function public.reorder_calculation_sections(
  p_calculation_id uuid,
  p_ordered_section_ids uuid[]
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected integer;
  v_matched integer;
  v_updated integer;
begin
  -- A duplicate id in the payload is a bad request — reject the whole reorder.
  select count(*) into v_expected from unnest(p_ordered_section_ids) as t(id);
  if v_expected <> (
    select count(distinct id) from unnest(p_ordered_section_ids) as t(id)
  ) then
    raise exception 'reorder_calculation_sections: duplicate section id in payload'
      using errcode = 'check_violation';
  end if;

  -- Every supplied id must be a REAL section of THIS calculation visible under the
  -- caller's RLS. Any mismatch aborts the whole reorder (no partial order — R-503).
  select count(*) into v_matched
    from public.calculation_sections s
   where s.calculation_id = p_calculation_id
     and s.id = any (p_ordered_section_ids);

  if v_matched <> v_expected then
    raise exception
      'reorder_calculation_sections: one or more section ids do not belong to the calculation'
      using errcode = 'check_violation';
  end if;

  -- One atomic UPDATE ... FROM over the unnested ordinal set. RLS narrows it to the
  -- caller's own-tenant sections.
  with ordered as (
    select id, ord
      from unnest(p_ordered_section_ids) with ordinality as t(id, ord)
  )
  update public.calculation_sections s
     set sort_order = ordered.ord
    from ordered
   where s.id = ordered.id
     and s.calculation_id = p_calculation_id;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

comment on function public.reorder_calculation_sections(uuid, uuid[]) is
  'Narrow atomic reorder RPC for SECTIONS (architecture ADR-A009). Reassigns the server-owned sort_order of ONE calculation''s sections in a SINGLE DB-side transaction (fully commits or fully rolls back — R-503). Rejects the WHOLE reorder (23514 check_violation) if any supplied id is not a same-calculation section visible under the caller''s RLS, or if the payload has a duplicate id. SECURITY INVOKER (own-tenant only, no service-role app path) with a fixed empty search_path. Symmetric to reorder_calculation_rows at the calculation→section level.';

revoke execute on function public.reorder_calculation_sections(uuid, uuid[]) from public;
grant execute on function public.reorder_calculation_sections(uuid, uuid[]) to authenticated, service_role;
