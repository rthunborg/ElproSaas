-- ============================================================================
-- Migration: quote_version_model
-- Story 6.1 — Quote Snapshot Schema And Server-Side Version Creation.
--
-- The FIRST migration in Epic 6 and the first COMPOSITE immutable-snapshot data
-- model. It creates the tenant-scoped quote-number counter plus the five quote
-- tables (architecture §7 v0 IN list — tenant_counters / quotes / quote_versions /
-- quote_version_lines / quote_version_attachments / quote_events), each carrying a
-- DIRECT `tenant_id` (architecture §6 convention), a soft-delete `archived_at`
-- (archive over hard delete, where a lifecycle applies), created_at/updated_at
-- timestamps with the EXISTING `public.set_updated_at()` BEFORE UPDATE trigger, and
-- the COMPOSITE same-tenant parent constraints (architecture §6 — a child duplicates
-- `tenant_id` and references its parent on BOTH (id, tenant_id) so a child can only
-- point at a parent IN THE SAME tenant; a bare `references quotes(id)` would be a
-- cross-tenant hole).
--
-- It REUSES the objects landed by 20260625122433_tenant_foundation.sql:
-- `public.set_updated_at()` (the updated_at trigger fn — NOT redefined here) and the
-- RLS helper `public.is_tenant_admin` (the own-tenant policy predicate).
--
-- ----------------------------------------------------------------------------
-- COMPOSITE-SAME-TENANT-FK PREREQUISITES (architecture §6):
-- The quote chain references existing composite uniques that are ALREADY frozen:
--   * customers (id, tenant_id)  — customers_id_tenant_unique (Story 3.1)
--   * facilities (id, tenant_id) — facilities_id_tenant_unique (Story 3.1)
--   * contacts (id, tenant_id)   — contacts_id_tenant_unique (Story 5.1, additive)
--   * calculations (id, tenant_id) — calculations_id_tenant_unique (Story 5.1)
--   * files (id, tenant_id)      — files_id_tenant_unique (Story 8.1)
-- All FIVE exist, so THIS migration adds NO additive parent unique — it only creates
-- the NEW composite uniques its own new parents need (quotes / quote_versions).
--
-- ----------------------------------------------------------------------------
-- IMMUTABLE COMPOSITE SNAPSHOT (architecture §11, ADR-A005): `quote_versions` is the
-- customer-commitment snapshot — a COMPLETE copy-by-value freeze of everything
-- customer-visible (FULL company identity, customer/facility/contact display, terms
-- text + sign-off state VERBATIM, totals in integer öre, VAT/tax assumptions in basis
-- points, warnings-at-snapshot, source calc id + captured_at). The frozen values are
-- SUPPLIED pre-built by the pure snapshot builder (src/lib/quote-snapshot) + the RPC;
-- this migration stores them. 6.1 creates DRAFT versions only — the sent-immutability
-- TRIGGER (§9) is Story 6.4, so NO update-blocking trigger here.
--
-- ----------------------------------------------------------------------------
-- INTEGER-ÖRE MONEY + BASIS-POINT VAT DISCIPLINE (architecture §10; R-603/R-607):
-- Every money column is `bigint` INTEGER ÖRE with a non-negative CHECK — NEVER a
-- float kronor column (no `numeric`/`double precision`/`real` money field anywhere).
-- VAT/deduction rates are BASIS POINTS (`*_bp integer`, 2500 = 25.00%). The totals are
-- CAPTURED from the engine-produced calc state (never re-derived here — Epic 4 owns
-- `@/lib/money`; the pure builder captures, computes nothing). The customer-visible
-- `quote_version_lines` carry NO cost/margin/internal-note columns (R-607) — only the
-- customer-visible label/description/note + qty/unit + sell öre + VAT bp.
--
-- ----------------------------------------------------------------------------
-- SCOPE DISCIPLINE (architecture §7; Story 6.1 Stop Conditions):
-- tenant_counters / quotes / quote_versions / quote_version_lines /
-- quote_version_attachments / quote_events are the ONLY tables this migration creates.
-- NO Fortnox/invoice/customer-portal/external-mapping/supplier/sync/credential/api/edi
-- column ANYWHERE (a HARD non-negotiable Stop Condition; a column-name guard test
-- FAILS LOUD if a future change smuggles it in). NO sent-immutability trigger (6.4),
-- NO PDF generation (6.3), NO acceptance/job table (Epic 7).
--
-- ----------------------------------------------------------------------------
-- GRANT discipline (mirror the calc/file table grants EXACTLY — LOAD-BEARING):
-- New `public` tables are NOT auto-exposed to the Data API roles on this stack, and
-- RLS only NARROWS an already-granted role.
--   * authenticated → SELECT, INSERT, UPDATE. The own-tenant policies narrow these to
--     the caller's tenant. DELETE is NOT granted — archive over hard delete. The
--     tenant_counters writes flow through the RPC under the caller's RLS (a counter
--     row is upserted/incremented, never deleted).
--   * service_role  → full DML (SELECT/INSERT/UPDATE/DELETE). TEST-ONLY factory
--     seed/cleanup (BYPASSRLS); the cascade teardown relies on it.
--   * anon          → NOTHING.
--
-- ----------------------------------------------------------------------------
-- RLS (architecture §6, §9): ENABLE + FORCE on ALL SIX new tables (incl.
-- tenant_counters). Own-tenant policies via the EXISTING `is_tenant_admin(tenant_id)`
-- helper: SELECT/INSERT/UPDATE only. NO delete policy (archive over hard delete).
--
-- INHERITED-AND-ACCEPTED PHASE-A RLS POSTURE (deferred-work 2-2/2-3, Story 2.4 owner):
-- the own-tenant SELECT policy scopes reads by TENANT (`is_tenant_admin(tenant_id)`),
-- not by `user_id = auth.uid()`, so in a multi-admin tenant co-admins read each
-- other's quote rows within their OWN tenant (never across a boundary) — the SAME
-- accepted single-admin Phase-A design. Least-privilege tightening is the Story 2.4 /
-- RBAC seam, NOT here.
--
-- ----------------------------------------------------------------------------
-- ATOMIC MULTI-ROW WRITE (ADR-A009): the narrow `create_quote_version_from_calculation`
-- RPC at the bottom owns the transaction boundary + full rollback for the combined
-- counter-increment + quote + version + lines + event write — NOT client-side
-- multi-step persistence. It is SECURITY INVOKER (ADR-A009 default) so it executes
-- under the CALLER's RLS — the INSERTs stay tenant-scoped by the own-tenant WITH CHECK
-- policies, no service-role app path — with a fixed empty search_path + schema-
-- qualified refs (defensive hardening matching reorder_calculation_rows /
-- create_file_with_link). A SECURITY DEFINER design would need separate ADR approval.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: tenant_counters — the tenant-scoped, race-safe server counter (architecture
-- §7, §24). MANY rows per tenant (one per named counter, e.g. 'quote_number'). It is
-- tenant-owned STATE and enrolls in the H4 gate like any other table. The composite
-- unique (tenant_id, counter_name) is the on-conflict target the atomic increment uses.
-- ----------------------------------------------------------------------------
create table public.tenant_counters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The named counter (a closed set at the command layer; free-text at the DB so a
  -- future counter needs no migration). Phase A uses 'quote_number'.
  counter_name text not null,
  -- The current allocated value (a monotonically-increasing bigint; the RPC returns
  -- the next value after an atomic increment). CHECK >= 0 belt-and-braces.
  current_value bigint not null default 0 check (current_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One counter row per (tenant, counter_name) — the atomic-increment on-conflict key.
  constraint tenant_counters_tenant_name_unique unique (tenant_id, counter_name)
);

comment on table public.tenant_counters is
  'Tenant-scoped, race-safe server counter (architecture §7/§24). MANY rows per tenant (one per named counter). RLS-protected (own-tenant read/insert/update via is_tenant_admin; no delete). unique (tenant_id, counter_name) is the atomic-increment on-conflict target. The quote-number allocation increments the (tenant_id, ''quote_number'') row inside the SAME create_quote_version_from_calculation RPC transaction — never client-side, tenant B''s sequence independent of tenant A''s. current_value is a plain server-allocated integer; the DISPLAY format is an open owner question (architecture §24) and must NOT become a data-model blocker.';

-- ----------------------------------------------------------------------------
-- Table: quotes — the logical quote (architecture §7). The tenant-owned root a
-- customer-commitment version hangs off. MANY rows per tenant. Composite same-tenant
-- FK to customers [required] + facilities/contacts [optional, ON DELETE SET NULL].
-- ----------------------------------------------------------------------------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The parent customer (always present). NOT NULL.
  customer_id uuid not null,
  -- OPTIONAL facility/contact links (a quote may target a specific facility/contact).
  facility_id uuid,
  contact_id uuid,
  -- Soft-delete: NULL = active.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- COMPOSITE same-tenant FK to the parent customer (architecture §6): the quote's
  -- (customer_id, tenant_id) must match an EXISTING customers (id, tenant_id).
  constraint quotes_customer_same_tenant
    foreign key (customer_id, tenant_id)
    references public.customers (id, tenant_id)
    on delete cascade,
  -- OPTIONAL composite same-tenant FKs. ON DELETE SET NULL so removing a facility/
  -- contact detaches the quote from it (the quote survives at the customer level).
  constraint quotes_facility_same_tenant
    foreign key (facility_id, tenant_id)
    references public.facilities (id, tenant_id)
    on delete set null,
  constraint quotes_contact_same_tenant
    foreign key (contact_id, tenant_id)
    references public.contacts (id, tenant_id)
    on delete set null,
  -- The composite UNIQUE the quote_versions / quote_events same-tenant FKs reference.
  constraint quotes_id_tenant_unique unique (id, tenant_id)
);

comment on table public.quotes is
  'Tenant-owned logical quote (architecture §7). MANY rows per tenant. RLS-protected (own-tenant read/insert/update via is_tenant_admin; no delete — archive via archived_at). Composite same-tenant FKs to customers(id,tenant_id) [required] + facilities(id,tenant_id)/contacts(id,tenant_id) [optional] so a quote can only reference same-tenant parents (architecture §6). unique (id, tenant_id) is the composite-FK target for quote_versions/quote_events. NO Fortnox/invoice/customer-portal/external-mapping/supplier/sync/credential/api column (Story 6.1 Stop Condition).';

-- ----------------------------------------------------------------------------
-- Table: quote_versions — the customer-commitment SNAPSHOT (architecture §7, §11,
-- ADR-A005). A COMPLETE copy-by-value freeze of everything customer-visible. 6.1
-- creates DRAFT versions; the sent-immutability trigger is Story 6.4 (the lifecycle
-- `status` field is persisted here, but nothing blocks updates yet).
-- ----------------------------------------------------------------------------
create table public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The parent quote. NOT NULL.
  quote_id uuid not null,
  -- The per-quote version number (1 for the first version 6.1 creates).
  version_number integer not null check (version_number >= 1),
  -- The tenant-scoped allocated quote number (from tenant_counters, server-side).
  quote_number bigint not null check (quote_number >= 1),
  -- Lifecycle status (a closed set — Phase A). 6.1 creates 'draft'. The state machine
  -- + sent-immutability enforcement is Story 6.4.
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'superseded')),
  -- SNAPSHOT SOURCE: the source calculation + the snapshot build instant (captured_at
  -- is the INJECTED builder clock, never Date.now()).
  calculation_id uuid not null,
  captured_at timestamptz not null,
  -- FULL company identity snapshot (architecture §11 — the FULL identity, NOT the
  -- Epic-3 identity-PARTIAL variant; a Swedish quote PDF needs all of it). Copied
  -- VERBATIM from the live company_settings row at snapshot time.
  company_name text,
  company_org_nr text,
  company_address_line1 text,
  company_address_line2 text,
  company_postal_code text,
  company_city text,
  company_email text,
  company_phone text,
  company_logo_url text,
  -- Customer/facility/contact DISPLAY snapshot (display fields ONLY — NEVER a
  -- personnummer; the calc read + engine take display/posture only).
  customer_display_name text,
  customer_type text,
  facility_name text,
  contact_name text,
  -- Quote number DISPLAY + validity. quote_number_display is the presentational form
  -- (the DISPLAY format is an open owner question §24 — captured as a plain string,
  -- never a schema blocker). valid_until is nullable (a validity date, Phase A optional).
  quote_number_display text,
  valid_until timestamptz,
  -- Intro / customer-notes / terms text + the terms sign-off state captured VERBATIM
  -- (approved_at NULL = not-approved; the builder NEVER derives an isApproved flag and
  -- NEVER mutates the source). The send-time terms-approval GATE is Story 6.4.
  intro_text text,
  customer_notes text,
  terms_text text,
  terms_approved_at timestamptz,
  terms_approved_by uuid,
  -- Totals in INTEGER ÖRE (captured from engine-produced calc state, never re-derived).
  -- base = the base line total; option = the selected-tillval total; vat = the VAT
  -- total; deduction = the ROT/grön estimate; accepted-price basis is the customer-
  -- commitment gross the version freezes. All non-negative bigint öre.
  base_total_ore bigint not null default 0 check (base_total_ore >= 0),
  option_total_ore bigint not null default 0 check (option_total_ore >= 0),
  vat_total_ore bigint not null default 0 check (vat_total_ore >= 0),
  deduction_total_ore bigint not null default 0 check (deduction_total_ore >= 0),
  accepted_price_ore bigint not null default 0 check (accepted_price_ore >= 0),
  -- VAT / tax assumptions (BASIS POINTS — never a float). vat_rate_bp is the captured
  -- VAT rate; vat_display is the captured display posture. The deduction assumption is
  -- an UNAPPROVED estimate with a requires_sign_off marker (fail-closed for Story 6.4).
  vat_rate_bp integer check (vat_rate_bp is null or (vat_rate_bp >= 0 and vat_rate_bp <= 10000)),
  vat_display text,
  deduction_type text check (deduction_type is null or deduction_type in ('rot', 'gron_teknik')),
  deduction_rate_bp integer check (deduction_rate_bp is null or (deduction_rate_bp >= 0 and deduction_rate_bp <= 10000)),
  deduction_cap_ore bigint check (deduction_cap_ore is null or deduction_cap_ore >= 0),
  deduction_persons integer check (deduction_persons is null or deduction_persons >= 0),
  requires_sign_off boolean not null default true,
  -- Display mode (the presentation posture captured at snapshot time).
  display_mode text,
  -- PDF render metadata + generated file reference (nullable — Story 6.3 fills them).
  pdf_file_id uuid,
  pdf_generated_at timestamptz,
  -- Warnings captured at snapshot time (the readiness classifier codes/messages,
  -- frozen as a jsonb array; a disclosure of state, no PII).
  warnings_snapshot jsonb not null default '[]'::jsonb,
  -- Soft-delete: NULL = active.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- COMPOSITE same-tenant FK to the parent quote (architecture §6).
  constraint quote_versions_quote_same_tenant
    foreign key (quote_id, tenant_id)
    references public.quotes (id, tenant_id)
    on delete cascade,
  -- COMPOSITE same-tenant FK to the source calculation (Story 5.1 unique). A foreign
  -- calc id is rejected at the DB (23503) — the command re-validates ownership first.
  constraint quote_versions_calculation_same_tenant
    foreign key (calculation_id, tenant_id)
    references public.calculations (id, tenant_id)
    on delete restrict,
  -- OPTIONAL composite same-tenant FK to the generated PDF file (Story 6.3 fills it).
  -- ON DELETE SET NULL so removing the file detaches the reference.
  constraint quote_versions_pdf_file_same_tenant
    foreign key (pdf_file_id, tenant_id)
    references public.files (id, tenant_id)
    on delete set null,
  -- The composite UNIQUE the quote_version_lines / quote_version_attachments same-tenant
  -- FKs reference.
  constraint quote_versions_id_tenant_unique unique (id, tenant_id),
  -- One version number per quote (belt-and-braces; the RPC allocates sequentially).
  constraint quote_versions_quote_version_unique unique (quote_id, version_number)
);

comment on table public.quote_versions is
  'Tenant-owned customer-commitment SNAPSHOT (architecture §7/§11, ADR-A005). A COMPLETE copy-by-value freeze of everything customer-visible: FULL company identity (org_nr/address/postal/city/email/phone/logo — NOT the Epic-3 identity-PARTIAL variant), customer/facility/contact display, quote number + validity, intro/customer-notes/terms text + terms approved_at/approved_by captured VERBATIM (NULL = not-approved; the send-time terms-approval gate is Story 6.4), base/option/VAT/deduction totals + accepted_price in INTEGER ÖRE (bigint, CHECK >= 0; captured from engine state, never re-derived), VAT/tax assumptions in BASIS POINTS (never a float), display mode, PDF render metadata (nullable — Story 6.3), warnings-at-snapshot. status in (draft|sent|accepted|rejected|expired|superseded) — 6.1 creates ''draft'' only; the sent-immutability trigger is Story 6.4. Composite same-tenant FKs to quotes(id,tenant_id) + calculations(id,tenant_id) + files(id,tenant_id) [pdf]. NO cost/margin/internal-note column (R-607). NO Fortnox/invoice/portal/external-mapping/supplier/sync/api column (Story 6.1 Stop Condition).';

-- ----------------------------------------------------------------------------
-- Table: quote_version_lines — the normalized, immutable customer-visible line
-- snapshot (architecture §11; R-607). NO cost/margin/internal-note columns — ONLY the
-- customer-visible fields (label/description/quote_note, quantity+unit, sell öre, VAT
-- bp). Many-per-version.
-- ----------------------------------------------------------------------------
create table public.quote_version_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The parent quote version. NOT NULL.
  quote_version_id uuid not null,
  -- The row/line type captured at snapshot time (a display discriminant; a section-
  -- header vs a line vs a text row). Free-text closed set at the command layer.
  row_type text not null,
  -- Presentation ordering (server-owned, from the calc row order).
  sort_order integer not null default 0,
  -- The customer-visible label/description/note (NO internal_note — R-607).
  label text,
  description text,
  quote_note text,
  -- Quantity + unit (decimal quantity + free-text unit, mirroring the calc row model).
  quantity numeric,
  unit text,
  -- The customer-facing SELL price per unit in INTEGER ÖRE (NO unit_cost_ore — R-607).
  unit_sell_ore bigint check (unit_sell_ore is null or unit_sell_ore >= 0),
  -- The line net total captured from engine state (integer öre).
  line_net_ore bigint check (line_net_ore is null or line_net_ore >= 0),
  -- The row VAT assumption in BASIS POINTS.
  vat_rate_bp integer check (vat_rate_bp is null or (vat_rate_bp >= 0 and vat_rate_bp <= 10000)),
  -- Visibility/option flags captured at snapshot time (a hidden row still counts; an
  -- unselected option does not — the inclusion is already resolved in the totals).
  is_hidden boolean not null default false,
  is_optional boolean not null default false,
  is_selected boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- COMPOSITE same-tenant FK to the parent version (architecture §6).
  constraint quote_version_lines_version_same_tenant
    foreign key (quote_version_id, tenant_id)
    references public.quote_versions (id, tenant_id)
    on delete cascade
);

comment on table public.quote_version_lines is
  'Tenant-owned normalized, immutable customer-visible line snapshot (architecture §11; R-607). Many-per-version. RLS-protected (own-tenant; no delete policy). Composite same-tenant FK quote_version_lines(quote_version_id,tenant_id) -> quote_versions(id,tenant_id). Carries ONLY the customer-visible fields: label/description/quote_note, quantity+unit, unit_sell_ore + line_net_ore (INTEGER ÖRE, bigint CHECK >= 0), vat_rate_bp (BASIS POINTS), visibility/option flags. NO unit_cost_ore, NO margin/markup, NO internal_note (R-607 — the calc row carries them; the snapshot drops them by construction). NO supplier/sync/api column.';

-- ----------------------------------------------------------------------------
-- Table: quote_version_attachments — immutable selected-attachment metadata
-- (architecture §11, §14). References a `files` row from the 8.1 foundation. The
-- linkage is materialized in file_links (owner_type='quote_version') by the RPC; this
-- table snapshots the attachment METADATA by value. Many-per-version.
-- ----------------------------------------------------------------------------
create table public.quote_version_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The parent quote version. NOT NULL.
  quote_version_id uuid not null,
  -- The attached file (from the 8.1 files model). Composite same-tenant FK below.
  file_id uuid not null,
  -- The attachment metadata snapshotted by VALUE (display name captured verbatim so a
  -- later rename of the file does not reach the frozen snapshot).
  display_name text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- COMPOSITE same-tenant FK to the parent version (architecture §6).
  constraint quote_version_attachments_version_same_tenant
    foreign key (quote_version_id, tenant_id)
    references public.quote_versions (id, tenant_id)
    on delete cascade,
  -- COMPOSITE same-tenant FK to the referenced file (Story 8.1 unique). A foreign file
  -- id is rejected at the DB (23503) — the command re-validates ownership first.
  constraint quote_version_attachments_file_same_tenant
    foreign key (file_id, tenant_id)
    references public.files (id, tenant_id)
    on delete restrict
);

comment on table public.quote_version_attachments is
  'Tenant-owned immutable selected-attachment metadata (architecture §11/§14). Many-per-version. RLS-protected (own-tenant; no delete policy). Composite same-tenant FKs to quote_versions(id,tenant_id) + files(id,tenant_id) so an attachment can only reference a same-tenant version + a same-tenant file (a cross-tenant file id is a 23503 DB rejection). display_name is snapshotted BY VALUE (a later file rename does not reach the frozen snapshot). The link is ALSO materialized in file_links (owner_type=''quote_version'', purpose=''quote_attachment_snapshot'') by the create_quote_version_from_calculation RPC (the 8.1 quote_version owner_type becomes LIVE here). NO raw file content, NO supplier/sync/api column.';

-- ----------------------------------------------------------------------------
-- Table: quote_events — the lifecycle event log (architecture §7). Append-friendly
-- events (created/draft/sent/accepted/rejected/expired/superseded) with a timestamp +
-- optional channel/reference. Many-per-quote. 6.1 writes the 'created'/'draft' event.
-- ----------------------------------------------------------------------------
create table public.quote_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The parent quote. NOT NULL.
  quote_id uuid not null,
  -- OPTIONAL parent version (an event may reference a specific version).
  quote_version_id uuid,
  -- The event type (a closed set at the command layer). 6.1 writes 'created'.
  event_type text not null
    check (event_type in ('created', 'draft', 'sent', 'accepted', 'rejected', 'expired', 'superseded')),
  -- When the event occurred (the injected command instant).
  occurred_at timestamptz not null default now(),
  -- OPTIONAL delivery channel + external reference (nullable — Phase A minimal).
  channel text,
  reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- COMPOSITE same-tenant FK to the parent quote (architecture §6).
  constraint quote_events_quote_same_tenant
    foreign key (quote_id, tenant_id)
    references public.quotes (id, tenant_id)
    on delete cascade,
  -- OPTIONAL composite same-tenant FK to the referenced version.
  constraint quote_events_version_same_tenant
    foreign key (quote_version_id, tenant_id)
    references public.quote_versions (id, tenant_id)
    on delete cascade
);

comment on table public.quote_events is
  'Tenant-owned quote lifecycle event log (architecture §7). Many-per-quote. RLS-protected (own-tenant; no delete policy). Composite same-tenant FKs to quotes(id,tenant_id) + quote_versions(id,tenant_id). event_type in (created|draft|sent|accepted|rejected|expired|superseded) — 6.1 writes ''created''. occurred_at is the injected command instant. channel/reference are optional Phase-A minimal fields. NO email-send/portal/public-acceptance mechanism here (deferred). NO supplier/sync/api column.';

-- ----------------------------------------------------------------------------
-- updated_at triggers — REUSE the EXISTING public.set_updated_at() (landed by
-- 20260625122433_tenant_foundation.sql). Do NOT redefine the function.
-- ----------------------------------------------------------------------------
create trigger tenant_counters_set_updated_at
  before update on public.tenant_counters
  for each row execute function public.set_updated_at();
create trigger quotes_set_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();
create trigger quote_versions_set_updated_at
  before update on public.quote_versions
  for each row execute function public.set_updated_at();
create trigger quote_version_lines_set_updated_at
  before update on public.quote_version_lines
  for each row execute function public.set_updated_at();
create trigger quote_version_attachments_set_updated_at
  before update on public.quote_version_attachments
  for each row execute function public.set_updated_at();
create trigger quote_events_set_updated_at
  before update on public.quote_events
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Indexes for the command/RLS access paths (architecture §22; mirror the calc/file
-- index pattern).
-- ----------------------------------------------------------------------------
create index tenant_counters_tenant_id_idx
  on public.tenant_counters (tenant_id);
create index quotes_tenant_id_idx
  on public.quotes (tenant_id);
create index quotes_tenant_customer_idx
  on public.quotes (tenant_id, customer_id);
create index quote_versions_tenant_quote_idx
  on public.quote_versions (tenant_id, quote_id);
create index quote_versions_tenant_calc_idx
  on public.quote_versions (tenant_id, calculation_id);
create index quote_version_lines_tenant_version_sort_idx
  on public.quote_version_lines (tenant_id, quote_version_id, sort_order);
create index quote_version_attachments_tenant_version_idx
  on public.quote_version_attachments (tenant_id, quote_version_id);
create index quote_version_attachments_tenant_file_idx
  on public.quote_version_attachments (tenant_id, file_id);
create index quote_events_tenant_quote_idx
  on public.quote_events (tenant_id, quote_id);

-- ----------------------------------------------------------------------------
-- Base table privileges (GRANTs) — see the GRANT discipline note in the header.
--   authenticated → SELECT, INSERT, UPDATE (the admin manages quotes via the app
--                   path incl. the RPC counter increment; DELETE withheld).
--   service_role  → full DML (TEST-ONLY factory seed/cleanup; BYPASSRLS).
--   anon          → NOTHING.
-- ----------------------------------------------------------------------------
grant select, insert, update on public.tenant_counters to authenticated;
grant select, insert, update on public.quotes to authenticated;
grant select, insert, update on public.quote_versions to authenticated;
grant select, insert, update on public.quote_version_lines to authenticated;
grant select, insert, update on public.quote_version_attachments to authenticated;
grant select, insert, update on public.quote_events to authenticated;
grant select, insert, update, delete on public.tenant_counters to service_role;
grant select, insert, update, delete on public.quotes to service_role;
grant select, insert, update, delete on public.quote_versions to service_role;
grant select, insert, update, delete on public.quote_version_lines to service_role;
grant select, insert, update, delete on public.quote_version_attachments to service_role;
grant select, insert, update, delete on public.quote_events to service_role;

-- ----------------------------------------------------------------------------
-- Row Level Security: ENABLE + FORCE on all six (architecture §6, §9).
-- ----------------------------------------------------------------------------
alter table public.tenant_counters enable row level security;
alter table public.tenant_counters force row level security;
alter table public.quotes enable row level security;
alter table public.quotes force row level security;
alter table public.quote_versions enable row level security;
alter table public.quote_versions force row level security;
alter table public.quote_version_lines enable row level security;
alter table public.quote_version_lines force row level security;
alter table public.quote_version_attachments enable row level security;
alter table public.quote_version_attachments force row level security;
alter table public.quote_events enable row level security;
alter table public.quote_events force row level security;

-- ----------------------------------------------------------------------------
-- Policies: own-tenant SELECT / INSERT / UPDATE via the EXISTING is_tenant_admin
-- helper. NO delete policy (archive over hard delete). 18 new policies (3 per table).
-- ----------------------------------------------------------------------------

-- tenant_counters
create policy tenant_counters_select_own
  on public.tenant_counters for select to authenticated
  using (public.is_tenant_admin(tenant_id));
create policy tenant_counters_insert_own
  on public.tenant_counters for insert to authenticated
  with check (public.is_tenant_admin(tenant_id));
create policy tenant_counters_update_own
  on public.tenant_counters for update to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- quotes
create policy quotes_select_own
  on public.quotes for select to authenticated
  using (public.is_tenant_admin(tenant_id));
create policy quotes_insert_own
  on public.quotes for insert to authenticated
  with check (public.is_tenant_admin(tenant_id));
create policy quotes_update_own
  on public.quotes for update to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- quote_versions
create policy quote_versions_select_own
  on public.quote_versions for select to authenticated
  using (public.is_tenant_admin(tenant_id));
create policy quote_versions_insert_own
  on public.quote_versions for insert to authenticated
  with check (public.is_tenant_admin(tenant_id));
create policy quote_versions_update_own
  on public.quote_versions for update to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- quote_version_lines
create policy quote_version_lines_select_own
  on public.quote_version_lines for select to authenticated
  using (public.is_tenant_admin(tenant_id));
create policy quote_version_lines_insert_own
  on public.quote_version_lines for insert to authenticated
  with check (public.is_tenant_admin(tenant_id));
create policy quote_version_lines_update_own
  on public.quote_version_lines for update to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- quote_version_attachments
create policy quote_version_attachments_select_own
  on public.quote_version_attachments for select to authenticated
  using (public.is_tenant_admin(tenant_id));
create policy quote_version_attachments_insert_own
  on public.quote_version_attachments for insert to authenticated
  with check (public.is_tenant_admin(tenant_id));
create policy quote_version_attachments_update_own
  on public.quote_version_attachments for update to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- quote_events
create policy quote_events_select_own
  on public.quote_events for select to authenticated
  using (public.is_tenant_admin(tenant_id));
create policy quote_events_insert_own
  on public.quote_events for insert to authenticated
  with check (public.is_tenant_admin(tenant_id));
create policy quote_events_update_own
  on public.quote_events for update to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- INTENTIONALLY NOT EXPOSED to the app path (archive-over-delete discipline):
--   * DELETE on any of the six tables — no grant to authenticated AND no delete policy
--     → DENY-by-default. Archival is an UPDATE of archived_at (where a lifecycle
--     applies); a tenant_counters row is upserted/incremented, never deleted.

-- ----------------------------------------------------------------------------
-- Narrow atomic quote-version-creation RPC (ADR-A009, AC2/AC3). In ONE transaction it:
--   (a) allocates the next tenant-scoped quote number by atomically upserting/
--       incrementing the tenant_counters (tenant_id, 'quote_number') row (row lock via
--       INSERT ... ON CONFLICT DO UPDATE — the increment and the version insert are in
--       the SAME txn so a number can never be allocated outside the insertion);
--   (b) inserts the quotes row;
--   (c) inserts the quote_versions row with all the pre-frozen snapshot fields;
--   (d) inserts the quote_version_lines from the supplied jsonb array;
--   (e) inserts the quote_version_attachments from the supplied jsonb array AND a
--       file_links row (owner_type='quote_version') per attachment (the 8.1 quote_version
--       owner_type becomes LIVE here); a double-submit is de-duplicated with an
--       on-conflict guard so an identical attachment link is not silently duplicated;
--   (f) inserts a quote_events 'created' event.
-- A failure at ANY step rolls back the WHOLE txn (no orphaned number, no partial
-- version). SECURITY INVOKER (runs under the caller's RLS — own-tenant only, no
-- service-role app path) with a fixed empty search_path + schema-qualified refs. The
-- Next.js command handles auth/session/membership/validation + source-ownership; this
-- RPC owns the transaction boundary + row lock + uniqueness + rollback.
--
-- The frozen snapshot fields are passed pre-built by the pure builder; the RPC stores
-- them verbatim (it CAPTURES, it computes nothing). The RESOLVED tenant id is passed
-- explicitly (the own-tenant WITH CHECK narrows every INSERT to the caller anyway).
-- ----------------------------------------------------------------------------
create or replace function public.create_quote_version_from_calculation(
  p_tenant_id uuid,
  p_calculation_id uuid,
  p_captured_at timestamptz,
  p_customer_id uuid,
  p_facility_id uuid,
  p_contact_id uuid,
  p_snapshot jsonb,
  p_lines jsonb,
  p_attachments jsonb
)
returns table (quote_id uuid, quote_version_id uuid, quote_number bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quote_id uuid;
  v_version_id uuid;
  v_quote_number bigint;
  v_line jsonb;
  v_att jsonb;
  v_att_file_id uuid;
  v_link_exists boolean;
begin
  -- (a) Allocate the next tenant-scoped quote number by an atomic upsert-increment of
  -- the (tenant_id, 'quote_number') counter row. The unique (tenant_id, counter_name)
  -- makes the ON CONFLICT the row lock: two concurrent creations serialize on this row,
  -- so each gets a DISTINCT current_value. The own-tenant WITH CHECK narrows the write
  -- to the caller (a cross-tenant p_tenant_id fails 42501 and aborts the whole txn).
  insert into public.tenant_counters (tenant_id, counter_name, current_value)
  values (p_tenant_id, 'quote_number', 1)
  on conflict (tenant_id, counter_name)
    do update set current_value = public.tenant_counters.current_value + 1
  returning current_value into v_quote_number;

  -- (b) Insert the logical quote (6.1 creates the FIRST version, so a fresh quote).
  insert into public.quotes (tenant_id, customer_id, facility_id, contact_id)
  values (p_tenant_id, p_customer_id, p_facility_id, p_contact_id)
  returning id into v_quote_id;

  -- (c) Insert the quote_versions row from the pre-frozen snapshot payload. Every
  -- field is read from p_snapshot by value (the builder already froze/copied it). The
  -- composite same-tenant FK to calculations(id,tenant_id) rejects a foreign calc id
  -- (23503); the own-tenant WITH CHECK narrows tenant_id to the caller (42501).
  insert into public.quote_versions (
    tenant_id, quote_id, version_number, quote_number, status,
    calculation_id, captured_at,
    company_name, company_org_nr, company_address_line1, company_address_line2,
    company_postal_code, company_city, company_email, company_phone, company_logo_url,
    customer_display_name, customer_type, facility_name, contact_name,
    quote_number_display, valid_until,
    intro_text, customer_notes, terms_text, terms_approved_at, terms_approved_by,
    base_total_ore, option_total_ore, vat_total_ore, deduction_total_ore, accepted_price_ore,
    vat_rate_bp, vat_display, deduction_type, deduction_rate_bp, deduction_cap_ore,
    deduction_persons, requires_sign_off, display_mode, warnings_snapshot
  )
  values (
    p_tenant_id,
    v_quote_id,
    1,
    v_quote_number,
    'draft',
    p_calculation_id,
    p_captured_at,
    p_snapshot ->> 'companyName',
    p_snapshot ->> 'companyOrgNr',
    p_snapshot ->> 'companyAddressLine1',
    p_snapshot ->> 'companyAddressLine2',
    p_snapshot ->> 'companyPostalCode',
    p_snapshot ->> 'companyCity',
    p_snapshot ->> 'companyEmail',
    p_snapshot ->> 'companyPhone',
    p_snapshot ->> 'companyLogoUrl',
    p_snapshot ->> 'customerDisplayName',
    p_snapshot ->> 'customerType',
    p_snapshot ->> 'facilityName',
    p_snapshot ->> 'contactName',
    p_snapshot ->> 'quoteNumberDisplay',
    (p_snapshot ->> 'validUntil')::timestamptz,
    p_snapshot ->> 'introText',
    p_snapshot ->> 'customerNotes',
    p_snapshot ->> 'termsText',
    (p_snapshot ->> 'termsApprovedAt')::timestamptz,
    (p_snapshot ->> 'termsApprovedBy')::uuid,
    coalesce((p_snapshot ->> 'baseTotalOre')::bigint, 0),
    coalesce((p_snapshot ->> 'optionTotalOre')::bigint, 0),
    coalesce((p_snapshot ->> 'vatTotalOre')::bigint, 0),
    coalesce((p_snapshot ->> 'deductionTotalOre')::bigint, 0),
    coalesce((p_snapshot ->> 'acceptedPriceOre')::bigint, 0),
    (p_snapshot ->> 'vatRateBp')::integer,
    p_snapshot ->> 'vatDisplay',
    p_snapshot ->> 'deductionType',
    (p_snapshot ->> 'deductionRateBp')::integer,
    (p_snapshot ->> 'deductionCapOre')::bigint,
    (p_snapshot ->> 'deductionPersons')::integer,
    coalesce((p_snapshot ->> 'requiresSignOff')::boolean, true),
    p_snapshot ->> 'displayMode',
    coalesce(p_snapshot -> 'warnings', '[]'::jsonb)
  )
  returning id into v_version_id;

  -- (d) Insert the customer-visible line snapshots. Each element of p_lines is a frozen
  -- line object; NO cost/margin/internal-note fields are read (R-607 — the builder
  -- already dropped them). A malformed element aborts the whole txn.
  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    insert into public.quote_version_lines (
      tenant_id, quote_version_id, row_type, sort_order,
      label, description, quote_note, quantity, unit, unit_sell_ore, line_net_ore,
      vat_rate_bp, is_hidden, is_optional, is_selected
    )
    values (
      p_tenant_id,
      v_version_id,
      coalesce(v_line ->> 'rowType', 'line'),
      coalesce((v_line ->> 'sortOrder')::integer, 0),
      v_line ->> 'label',
      v_line ->> 'description',
      v_line ->> 'quoteNote',
      (v_line ->> 'quantity')::numeric,
      v_line ->> 'unit',
      (v_line ->> 'unitSellOre')::bigint,
      (v_line ->> 'lineNetOre')::bigint,
      (v_line ->> 'vatRateBp')::integer,
      coalesce((v_line ->> 'isHidden')::boolean, false),
      coalesce((v_line ->> 'isOptional')::boolean, false),
      (v_line ->> 'isSelected')::boolean
    );
  end loop;

  -- (e) Insert the selected-attachment metadata snapshots AND materialize the 8.1
  -- file_links (owner_type='quote_version'). The composite same-tenant FK on
  -- quote_version_attachments.file_id rejects a foreign file id (23503). A double-submit
  -- is de-duplicated: only insert the file_links row when an identical one does not yet
  -- exist for (tenant, file, owner_type, owner_id, purpose) — the R-814 reuse decision
  -- (find-or-create; file_links has no unique constraint, so the RPC guards it).
  for v_att in select * from jsonb_array_elements(coalesce(p_attachments, '[]'::jsonb))
  loop
    v_att_file_id := (v_att ->> 'fileId')::uuid;
    insert into public.quote_version_attachments (
      tenant_id, quote_version_id, file_id, display_name, sort_order
    )
    values (
      p_tenant_id,
      v_version_id,
      v_att_file_id,
      v_att ->> 'displayName',
      coalesce((v_att ->> 'sortOrder')::integer, 0)
    );

    -- Find-or-create the file_links row (owner_type='quote_version'). A double-submit
    -- against the SAME version + file must not silently duplicate the link.
    select exists(
      select 1 from public.file_links fl
       where fl.tenant_id = p_tenant_id
         and fl.file_id = v_att_file_id
         and fl.owner_type = 'quote_version'
         and fl.owner_id = v_version_id
         and fl.purpose = 'quote_attachment_snapshot'
    ) into v_link_exists;
    if not v_link_exists then
      insert into public.file_links (
        tenant_id, file_id, owner_type, owner_id, purpose
      )
      values (
        p_tenant_id, v_att_file_id, 'quote_version', v_version_id,
        'quote_attachment_snapshot'
      );
    end if;
  end loop;

  -- (f) Insert the lifecycle 'created' event.
  insert into public.quote_events (
    tenant_id, quote_id, quote_version_id, event_type, occurred_at
  )
  values (
    p_tenant_id, v_quote_id, v_version_id, 'created', p_captured_at
  );

  return query select v_quote_id, v_version_id, v_quote_number;
end;
$$;

comment on function public.create_quote_version_from_calculation(
  uuid, uuid, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb
) is
  'Narrow atomic quote-version-creation RPC (architecture ADR-A009, Story 6.1). In ONE DB-side transaction it (a) atomically allocates the next tenant-scoped quote number via an upsert-increment of tenant_counters (tenant_id, ''quote_number'') — the unique (tenant_id, counter_name) is the row lock, so concurrent creations serialize and get DISTINCT numbers, tenant B independent of tenant A; (b) inserts the quotes row; (c) inserts the quote_versions row from the pre-frozen p_snapshot payload (captures, computes nothing); (d) inserts the customer-visible quote_version_lines (NO cost/margin/internal-note — R-607); (e) inserts the quote_version_attachments AND find-or-creates a file_links row (owner_type=''quote_version'', purpose=''quote_attachment_snapshot'') per attachment — the 8.1 quote_version owner_type becomes LIVE here, and a double-submit is de-duplicated (R-814); (f) inserts a quote_events ''created'' event. A failure at ANY step rolls back the WHOLE txn (no orphaned number, no partial version — R-604). SECURITY INVOKER (runs under the caller''s RLS — own-tenant only, the composite same-tenant FK rejects a foreign calc/file id 23503 and the own-tenant WITH CHECK rejects a forged tenant_id 42501; no service-role app path) with a fixed empty search_path + schema-qualified refs.';

-- Function privileges: revoke the implicit PUBLIC EXECUTE, then grant ONLY to the
-- app-runtime + test roles. anon must NOT be able to execute.
revoke execute on function public.create_quote_version_from_calculation(
  uuid, uuid, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb
) from public;
grant execute on function public.create_quote_version_from_calculation(
  uuid, uuid, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb
) to authenticated, service_role;
