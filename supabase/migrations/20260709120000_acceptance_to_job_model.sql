-- ============================================================================
-- Migration: acceptance_to_job_model
-- Story 7.1 — Acceptance Evidence Capture For Sent Quote Versions.
--
-- The FIRST migration in Epic 7 and the acceptance-to-job commitment data model.
-- It creates the THREE new tenant-scoped commitment tables that turn a SENT quote
-- version into an accepted customer commitment and a basic job/order:
--   * quote_acceptances — the off-system acceptance record for a SENT quote version
--     (channel, accepted_at, accepted price + source sent total in integer öre,
--     adjustment reason/evidence, evidence file/reference, notes, planned dates);
--   * jobs             — the minimal accepted-work record derived from an acceptance
--     (immutable source refs to the acceptance + version, customer/facility/contact,
--     title/status, planned dates); CREATED but UNPOPULATED by any live path in 7.1;
--   * job_events       — the job lifecycle event log (mirrors quote_events).
--
-- Each carries a DIRECT `tenant_id` (architecture §6), a soft-delete `archived_at`,
-- created_at/updated_at with the EXISTING `public.set_updated_at()` BEFORE UPDATE
-- trigger, and COMPOSITE same-tenant parent constraints (architecture §6 — a child
-- duplicates `tenant_id` and references its parent on BOTH (id, tenant_id) so a child
-- can only point at a parent IN THE SAME tenant; a bare `references quotes(id)` would
-- be a cross-tenant hole). It MIRRORS the 6.1 quote_version_model + 8.1
-- file_storage_foundation patterns VERBATIM (the closest analogs).
--
-- It REUSES the objects landed by 20260625122433_tenant_foundation.sql:
-- `public.set_updated_at()` (the updated_at trigger fn — NOT redefined here) and the
-- RLS helper `public.is_tenant_admin` (the own-tenant policy predicate). `quote_events`
-- (Epic 6) is REUSED for the acceptance lifecycle event — NOT recreated here.
--
-- ----------------------------------------------------------------------------
-- COMPOSITE-SAME-TENANT-FK PREREQUISITES (architecture §6):
-- The acceptance/job chain references existing composite uniques that are ALREADY
-- frozen:
--   * quotes (id, tenant_id)         — quotes_id_tenant_unique (Story 6.1)
--   * quote_versions (id, tenant_id) — quote_versions_id_tenant_unique (Story 6.1)
--   * customers (id, tenant_id)      — customers_id_tenant_unique (Story 3.1)
--   * facilities (id, tenant_id)     — facilities_id_tenant_unique (Story 3.1)
--   * contacts (id, tenant_id)       — contacts_id_tenant_unique (Story 5.1)
--   * files (id, tenant_id)          — files_id_tenant_unique (Story 8.1)
-- This migration adds the NEW composite uniques its own new parents need:
-- quote_acceptances (id, tenant_id) [the jobs FK target] + jobs (id, tenant_id)
-- [the job_events FK target].
--
-- ----------------------------------------------------------------------------
-- IMMUTABLE ACCEPTED MODEL (architecture §9, ADR-A005): the accepted record + the
-- job source references are captured commitment data — immutable once accepted. 7.1
-- CREATES the tables shaped so Story 7.4 can add the accepted-immutability trigger
-- ADDITIVELY (the same pattern as 6.1 leaving the door open for 6.4). 7.1 adds NO
-- immutability trigger and NO `accept_quote_and_create_job` RPC (that is Story 7.2).
--
-- ----------------------------------------------------------------------------
-- INTEGER-ÖRE MONEY DISCIPLINE (architecture §10; R-705): the money columns on
-- quote_acceptances (`accepted_price_ore` = the accepted commitment gross; and
-- `source_sent_total_ore` = the SENT total at acceptance time, the captured
-- commitment the adjusted-price delta is measured against) are `bigint` INTEGER ÖRE
-- with a non-negative CHECK — NEVER a float kronor column (no numeric/real/double
-- money field anywhere). The accepted price is stored AS GIVEN (7.1 does NOT re-run
-- the ROT/VAT engine — the per-person ROT cap carry does not affect acceptance).
--
-- ----------------------------------------------------------------------------
-- SCOPE DISCIPLINE (architecture §7; Story 7.1 Stop Conditions):
-- quote_acceptances / jobs / job_events are the ONLY tables this migration creates.
-- NO Fortnox/invoice/customer-portal/external-mapping/supplier/sync/credential/api/edi
-- column ANYWHERE. NO field-worker/schedule/time-material/timesheet/deviation/ÄTA/
-- analytics table or column (a HARD non-negotiable Stop Condition; a column-name /
-- table-name guard test FAILS LOUD if a future change smuggles one in). NO
-- acceptance-immutability trigger (Story 7.4). NO accept_quote_and_create_job RPC
-- (Story 7.2). NO customer-portal / public-acceptance mechanism.
--
-- ----------------------------------------------------------------------------
-- GRANT discipline (mirror the quote/file table grants EXACTLY — LOAD-BEARING):
-- New `public` tables are NOT auto-exposed to the Data API roles on this stack, and
-- RLS only NARROWS an already-granted role.
--   * authenticated → SELECT, INSERT, UPDATE. The own-tenant policies narrow these to
--     the caller's tenant. DELETE is NOT granted — archive over hard delete.
--   * service_role  → full DML (SELECT/INSERT/UPDATE/DELETE). TEST-ONLY factory
--     seed/cleanup (BYPASSRLS); the cascade teardown relies on it.
--   * anon          → NOTHING.
--
-- ----------------------------------------------------------------------------
-- RLS (architecture §6, §9): ENABLE + FORCE on ALL THREE new tables. Own-tenant
-- policies via the EXISTING `is_tenant_admin(tenant_id)` helper: SELECT/INSERT/UPDATE
-- only. NO delete policy (archive over hard delete).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: quote_acceptances — the off-system acceptance record for a SENT quote
-- version (architecture §7, §13 step 5). MANY rows per tenant (at most one live per
-- accepted version — the unique (quote_version_id) backstop). Composite same-tenant
-- FKs to quote_versions [the accepted version] + quotes [the parent quote].
-- ----------------------------------------------------------------------------
create table public.quote_acceptances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The parent quote + the ACCEPTED version reference (both NOT NULL — an acceptance
  -- always names the specific version it accepts, on its parent quote).
  quote_id uuid not null,
  quote_version_id uuid not null,
  -- The acceptance channel (free-text closed set at the command layer; the exact
  -- channel constants are an owner Sign-Off residual, R-713 — free-text at the DB so a
  -- future channel needs no migration).
  channel text,
  -- The accepted moment — an EXPLICIT input field (H1 determinism: the accepted moment
  -- is NEVER derived from a wall-clock read; the command clock stamps only the command
  -- instant). NOT NULL — an acceptance always records when it happened.
  accepted_at timestamptz not null,
  -- The accepted commitment gross + the SENT total at acceptance time, both INTEGER
  -- ÖRE (captured commitment data — R-705). The adjusted-price delta is
  -- accepted_price_ore − source_sent_total_ore, computed with @/lib/money (never
  -- re-derived at the DB). Non-negative bigint öre (canonical guard).
  accepted_price_ore bigint not null check (accepted_price_ore >= 0),
  source_sent_total_ore bigint not null check (source_sent_total_ore >= 0),
  -- The adjustment reason/evidence (nullable — REQUIRED at the command layer ONLY when
  -- accepted_price_ore <> source_sent_total_ore; the server re-validates the gate, the
  -- DB stores what the command persisted).
  adjustment_reason text,
  -- Evidence: an OPTIONAL uploaded file (composite same-tenant FK to files) OR a free-
  -- text external reference. The two shapes are exclusive per capture (the command
  -- links a file OR stores a reference — never both). ON DELETE SET NULL so removing
  -- the file detaches the reference (the acceptance survives).
  evidence_file_id uuid,
  evidence_reference text,
  -- Freeform notes + the planned start/end dates (nullable — Phase A minimal).
  notes text,
  planned_start_date date,
  planned_end_date date,
  -- Soft-delete: NULL = active.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- COMPOSITE same-tenant FK to the parent quote (architecture §6).
  constraint quote_acceptances_quote_same_tenant
    foreign key (quote_id, tenant_id)
    references public.quotes (id, tenant_id)
    on delete cascade,
  -- COMPOSITE same-tenant FK to the accepted quote version (the immutable source ref).
  -- ON DELETE RESTRICT — an accepted version cannot be deleted out from under its
  -- acceptance (a foreign version id is rejected at the DB 23503; the command
  -- re-validates ownership first).
  constraint quote_acceptances_version_same_tenant
    foreign key (quote_version_id, tenant_id)
    references public.quote_versions (id, tenant_id)
    on delete restrict,
  -- OPTIONAL composite same-tenant FK to the evidence file (Story 8.1 unique). A
  -- foreign file id is rejected at the DB (23503); the command re-validates ownership
  -- first. ON DELETE SET NULL detaches the reference if the file is removed.
  constraint quote_acceptances_evidence_file_same_tenant
    foreign key (evidence_file_id, tenant_id)
    references public.files (id, tenant_id)
    on delete set null,
  -- The composite UNIQUE the jobs same-tenant FK references.
  constraint quote_acceptances_id_tenant_unique unique (id, tenant_id),
  -- 7.2 BACKSTOP (added NOW): ONE acceptance per accepted quote version. A second
  -- capture of the same version raises 23505 (the 7.1 sent-state gate already blocks
  -- the common case — an already-accepted version has status='accepted', not 'sent'
  -- — so this is the DB-level duplicate-prevention 7.2 relies on).
  constraint quote_acceptances_version_unique unique (quote_version_id)
);

comment on table public.quote_acceptances is
  'Tenant-owned off-system acceptance record for a SENT quote version (architecture §7/§13, ADR-A005). MANY rows per tenant. RLS-protected (own-tenant read/insert/update via is_tenant_admin; no delete — archive via archived_at). Composite same-tenant FKs to quotes(id,tenant_id) + quote_versions(id,tenant_id) [the accepted version] + files(id,tenant_id) [optional evidence]. accepted_at is an EXPLICIT input (H1 — never a wall-clock derivation). accepted_price_ore (the accepted commitment gross) + source_sent_total_ore (the SENT total at acceptance time) are INTEGER ÖRE (bigint, CHECK >= 0; the adjusted-price delta is computed with @/lib/money, never at the DB). adjustment_reason is required at the command layer only when accepted_price_ore <> source_sent_total_ore. Evidence is an OPTIONAL file (evidence_file_id) OR a free-text evidence_reference (exclusive per capture). unique (quote_version_id) is the 7.2 duplicate-prevention backstop (one acceptance per accepted version); unique (id, tenant_id) is the composite-FK target for jobs. NO immutability trigger (Story 7.4). NO Fortnox/invoice/portal/supplier/sync/api column (Story 7.1 Stop Condition).';

-- ----------------------------------------------------------------------------
-- Table: jobs — the minimal accepted-work record derived from an acceptance
-- (architecture §7, §"Field Workflow" SEAM only). CREATED but UNPOPULATED by any live
-- path in 7.1 (the transactional accept_quote_and_create_job RPC that inserts it is
-- Story 7.2). Immutable source refs to the acceptance + version. NO cost/margin/
-- invoice/Fortnox/time-material/deviation column.
-- ----------------------------------------------------------------------------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- IMMUTABLE source references (architecture §13 — the job DISPLAYS from these, never
  -- re-derives). Composite same-tenant FKs; ON DELETE RESTRICT so the source cannot be
  -- deleted out from under a job.
  quote_acceptance_id uuid not null,
  quote_version_id uuid not null,
  -- The parent customer (required) + optional facility/contact (composite same-tenant
  -- FKs; facility/contact ON DELETE SET NULL — the job survives at the customer level).
  customer_id uuid not null,
  facility_id uuid,
  contact_id uuid,
  -- Basic display fields. `status` is a CLOSED Phase-A set — a MINIMAL conservative
  -- order-lifecycle set, NOT field-worker states (no scheduled/dispatched/on-site/etc.).
  title text,
  status text not null default 'created'
    check (status in ('created', 'in_progress', 'done', 'cancelled')),
  planned_start_date date,
  planned_end_date date,
  -- Soft-delete: NULL = active.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- COMPOSITE same-tenant FK to the source acceptance (the immutable source ref).
  constraint jobs_acceptance_same_tenant
    foreign key (quote_acceptance_id, tenant_id)
    references public.quote_acceptances (id, tenant_id)
    on delete restrict,
  -- COMPOSITE same-tenant FK to the source version (the immutable source ref).
  constraint jobs_version_same_tenant
    foreign key (quote_version_id, tenant_id)
    references public.quote_versions (id, tenant_id)
    on delete restrict,
  -- COMPOSITE same-tenant FK to the parent customer (required).
  constraint jobs_customer_same_tenant
    foreign key (customer_id, tenant_id)
    references public.customers (id, tenant_id)
    on delete restrict,
  -- OPTIONAL composite same-tenant FKs (facility/contact). ON DELETE SET NULL.
  constraint jobs_facility_same_tenant
    foreign key (facility_id, tenant_id)
    references public.facilities (id, tenant_id)
    on delete set null,
  constraint jobs_contact_same_tenant
    foreign key (contact_id, tenant_id)
    references public.contacts (id, tenant_id)
    on delete set null,
  -- The composite UNIQUE the job_events same-tenant FK references.
  constraint jobs_id_tenant_unique unique (id, tenant_id),
  -- ONE job source per acceptance (the 7.2 duplicate-prevention backstop — a retry
  -- cannot fork a second job off the same acceptance; raises 23505).
  constraint jobs_acceptance_unique unique (quote_acceptance_id)
);

comment on table public.jobs is
  'Tenant-owned minimal accepted-work record derived from an acceptance (architecture §7, §"Field Workflow" SEAM only). MANY rows per tenant. CREATED but UNPOPULATED by any live path in Story 7.1 — the transactional accept_quote_and_create_job RPC that inserts it is Story 7.2. RLS-protected (own-tenant read/insert/update via is_tenant_admin; no delete — archive via archived_at). IMMUTABLE composite same-tenant source refs to quote_acceptances(id,tenant_id) + quote_versions(id,tenant_id) (ON DELETE RESTRICT). Composite same-tenant FKs to customers(id,tenant_id) [required] + facilities/contacts(id,tenant_id) [optional]. status in (created|in_progress|done|cancelled) — a MINIMAL conservative order-lifecycle set, NOT field-worker states. unique (quote_acceptance_id) is the 7.2 one-job-per-acceptance backstop; unique (id, tenant_id) is the composite-FK target for job_events. NO cost/margin/invoice/Fortnox/time-material/deviation/ÄTA/schedule/analytics column (Story 7.1 Stop Condition).';

-- ----------------------------------------------------------------------------
-- Table: job_events — the job lifecycle event log (architecture §7; mirrors
-- quote_events). Append-friendly events (created/…) with a timestamp + optional
-- channel/reference. Many-per-job.
-- ----------------------------------------------------------------------------
create table public.job_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The parent job. NOT NULL.
  job_id uuid not null,
  -- The event type (a closed set at the command/RPC layer). 7.2 writes 'created'.
  event_type text not null
    check (event_type in ('created', 'in_progress', 'done', 'cancelled')),
  -- When the event occurred (the injected command instant when written by 7.2).
  occurred_at timestamptz not null default now(),
  -- OPTIONAL delivery channel + external reference (nullable — Phase A minimal).
  channel text,
  reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- COMPOSITE same-tenant FK to the parent job (architecture §6).
  constraint job_events_job_same_tenant
    foreign key (job_id, tenant_id)
    references public.jobs (id, tenant_id)
    on delete cascade
);

comment on table public.job_events is
  'Tenant-owned job lifecycle event log (architecture §7; mirrors quote_events). Many-per-job. RLS-protected (own-tenant read/insert/update via is_tenant_admin; no delete). Composite same-tenant FK to jobs(id,tenant_id). event_type in (created|in_progress|done|cancelled) — 7.2 writes ''created''. occurred_at is the injected command instant. channel/reference are optional Phase-A minimal fields. NO field-worker/schedule/time-material/deviation/supplier/sync/api column (Story 7.1 Stop Condition).';

-- ----------------------------------------------------------------------------
-- updated_at triggers — REUSE the EXISTING public.set_updated_at() (landed by
-- 20260625122433_tenant_foundation.sql). Do NOT redefine the function.
-- ----------------------------------------------------------------------------
create trigger quote_acceptances_set_updated_at
  before update on public.quote_acceptances
  for each row execute function public.set_updated_at();
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();
create trigger job_events_set_updated_at
  before update on public.job_events
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Indexes for the command/RLS access paths (architecture §22; mirror the quote/file
-- index pattern).
-- ----------------------------------------------------------------------------
create index quote_acceptances_tenant_id_idx
  on public.quote_acceptances (tenant_id);
create index quote_acceptances_tenant_version_idx
  on public.quote_acceptances (tenant_id, quote_version_id);
create index quote_acceptances_tenant_quote_idx
  on public.quote_acceptances (tenant_id, quote_id);
create index jobs_tenant_id_idx
  on public.jobs (tenant_id);
create index jobs_tenant_acceptance_idx
  on public.jobs (tenant_id, quote_acceptance_id);
create index jobs_tenant_customer_idx
  on public.jobs (tenant_id, customer_id);
create index job_events_tenant_job_idx
  on public.job_events (tenant_id, job_id);

-- ----------------------------------------------------------------------------
-- Base table privileges (GRANTs) — see the GRANT discipline note in the header.
--   authenticated → SELECT, INSERT, UPDATE (DELETE withheld — archive over delete).
--   service_role  → full DML (TEST-ONLY factory seed/cleanup; BYPASSRLS).
--   anon          → NOTHING.
-- ----------------------------------------------------------------------------
grant select, insert, update on public.quote_acceptances to authenticated;
grant select, insert, update on public.jobs to authenticated;
grant select, insert, update on public.job_events to authenticated;
grant select, insert, update, delete on public.quote_acceptances to service_role;
grant select, insert, update, delete on public.jobs to service_role;
grant select, insert, update, delete on public.job_events to service_role;

-- ----------------------------------------------------------------------------
-- Row Level Security: ENABLE + FORCE on all three (architecture §6, §9).
-- ----------------------------------------------------------------------------
alter table public.quote_acceptances enable row level security;
alter table public.quote_acceptances force row level security;
alter table public.jobs enable row level security;
alter table public.jobs force row level security;
alter table public.job_events enable row level security;
alter table public.job_events force row level security;

-- ----------------------------------------------------------------------------
-- Policies: own-tenant SELECT / INSERT / UPDATE via the EXISTING is_tenant_admin
-- helper. NO delete policy (archive over hard delete). 9 new policies (3 per table).
-- ----------------------------------------------------------------------------

-- quote_acceptances
create policy quote_acceptances_select_own
  on public.quote_acceptances for select to authenticated
  using (public.is_tenant_admin(tenant_id));
create policy quote_acceptances_insert_own
  on public.quote_acceptances for insert to authenticated
  with check (public.is_tenant_admin(tenant_id));
create policy quote_acceptances_update_own
  on public.quote_acceptances for update to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- jobs
create policy jobs_select_own
  on public.jobs for select to authenticated
  using (public.is_tenant_admin(tenant_id));
create policy jobs_insert_own
  on public.jobs for insert to authenticated
  with check (public.is_tenant_admin(tenant_id));
create policy jobs_update_own
  on public.jobs for update to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- job_events
create policy job_events_select_own
  on public.job_events for select to authenticated
  using (public.is_tenant_admin(tenant_id));
create policy job_events_insert_own
  on public.job_events for insert to authenticated
  with check (public.is_tenant_admin(tenant_id));
create policy job_events_update_own
  on public.job_events for update to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- INTENTIONALLY NOT EXPOSED to the app path (archive-over-delete discipline):
--   * DELETE on any of the three tables — no grant to authenticated AND no delete
--     policy → DENY-by-default. Archival is an UPDATE of archived_at.
--
-- INTENTIONALLY NOT CREATED IN 7.1 (documented Stop Conditions):
--   * NO acceptance-immutability trigger on quote_acceptances/jobs (Story 7.4 locks
--     the accepted state additively — 7.1 only shapes the schema for that).
--   * NO accept_quote_and_create_job RPC (Story 7.2 owns the atomic multi-record
--     transaction — 7.1 leaves `jobs`/`job_events` created but unpopulated by any
--     live path, and persists the single-row `quote_acceptances` write through the
--     own-tenant RLS INSERT in the captureQuoteAcceptance command).
--   * NO Fortnox/invoice/portal/external-mapping/supplier/sync/credential/api/edi
--     column or table; NO field-worker/schedule/time-material/deviation/ÄTA/analytics
--     column or table.
