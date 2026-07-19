-- ============================================================================
-- Migration: quote_follow_ups
-- Story 10.3 — Quote Follow-Up Workflow.
--
-- The THIRD delivered Phase B story. Purely ADDITIVE to the (frozen) Epic 6/7 + 10.2
-- quote model — a frozen prior migration is NEVER edited; every change here is additive:
--   (1) ONE new tenant-owned table `quote_follow_ups` — UPDATE-able (SELECT + INSERT +
--       UPDATE policies/grants; NO DELETE — archive-over-delete). Mirrors the 7.1
--       `quote_acceptances` RLS/GRANT/composite-same-tenant-FK pattern MINUS the money
--       columns + the updated_at trigger, PLUS a PARTIAL UNIQUE INDEX enforcing at most
--       ONE open follow-up per quote (UXB-A6). The load-bearing contrast with 10.2's
--       insert-only `quote_lost_reasons`: this table's rows ADVANCE state on their own row
--       (open → completed; annotate), so it carries an UPDATE policy/grant.
--
-- ----------------------------------------------------------------------------
-- THE SETTLED FOLLOW-UP MODEL (story ⚑ — do NOT re-litigate): one open follow-up per QUOTE
-- (not per version), DB-enforced by the partial unique index `(quote_id) WHERE status='open'`.
-- Planning a second open follow-up raises 23505, which the command maps to a clear
-- VALIDATION_FAILED. A NEW open follow-up is allowed once the prior is completed. A follow-up
-- ADVANCES its own row (status open → completed, outcome/completed_at written on completion);
-- the completion + annotate are single-row envelope commands (architecture-phase-b §14 — NO RPC).
--
-- ----------------------------------------------------------------------------
-- SENT-IMMUTABILITY PRESERVED (NFR11 / FR63): follow-ups are WORKFLOW METADATA on a SEPARATE
-- table — they NEVER touch any `quote_versions` snapshot column. No sent-snapshot content is
-- ever mutated by any follow-up path.
--
-- ----------------------------------------------------------------------------
-- SCOPE DISCIPLINE (AGENTS.md; Story 10.3 Stop Conditions): `quote_follow_ups` is the ONLY
-- table this migration creates. NO RPC (single-row envelope commands). NO money/tax/rounding
-- column (NO float/numeric/öre column). NO Fortnox/invoice/customer-portal/external-mapping/
-- supplier/sync/api/portal column. NO notification/reminder/email column (Epic 13 owns the
-- quote.follow_up_due producer — the ⚑ scope boundary). NO `updated_at`/`set_updated_at`
-- trigger (nothing derives from the row; the completion UPDATE is explicit). NO service-role
-- app path (commands run under the caller's RLS). NO pipeline read-model / hit-rate aggregation
-- (Story 10.4).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- (1) Table: quote_follow_ups — the UPDATE-able tenant-owned follow-up workflow row for a SENT
-- quote version (architecture-phase-b §9.1). MANY rows per tenant, at most ONE OPEN per quote
-- (the partial unique index below — UXB-A6). Composite same-tenant FKs to quotes [the parent
-- quote] + quote_versions [the anchor version]. Mirrors quote_acceptances (20260709120000) MINUS
-- the money columns + the updated_at trigger, PLUS the one-open partial unique index.
-- ----------------------------------------------------------------------------
create table public.quote_follow_ups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The parent quote + the anchor version reference (both NOT NULL — a follow-up always names
  -- the specific sent version it was planned on, on its parent quote).
  quote_id uuid not null,
  quote_version_id uuid not null,
  -- The planned due date (a `date`, no time — timezone-robust; overdue is computed against
  -- "today in Europe/Stockholm" from the injected instant in the pure classifier, so the column
  -- stores no tz).
  due_date date not null,
  -- The planning note (optional free text).
  note text,
  -- The follow-up lifecycle status. Advances open → completed via the complete command.
  status text not null default 'open' check (status in ('open', 'completed')),
  -- The completion outcome note (set on completion; on the lost-from-follow-up path it carries
  -- the chosen förlorad/avböjd). NULL while open.
  outcome text,
  created_at timestamptz not null default now(),
  -- The completion instant (the injected command clock). NULL while open.
  completed_at timestamptz,
  -- COMPOSITE same-tenant FK to the parent quote (architecture §6). ON DELETE CASCADE.
  constraint quote_follow_ups_quote_same_tenant
    foreign key (quote_id, tenant_id)
    references public.quotes (id, tenant_id)
    on delete cascade,
  -- COMPOSITE same-tenant FK to the anchor quote version. ON DELETE CASCADE.
  constraint quote_follow_ups_version_same_tenant
    foreign key (quote_version_id, tenant_id)
    references public.quote_versions (id, tenant_id)
    on delete cascade,
  -- Fail-closed shape: a completed follow-up must carry a completion instant.
  constraint quote_follow_ups_completed_shape
    check (status <> 'completed' or completed_at is not null)
);

comment on table public.quote_follow_ups is
  'Tenant-owned UPDATE-able follow-up workflow row for a SENT quote version (architecture-phase-b §9.1, Story 10.3). MANY rows per tenant, at most ONE OPEN per quote (partial unique index quote_follow_ups_one_open_per_quote on (quote_id) WHERE status=''open'' — UXB-A6). RLS-protected (own-tenant SELECT + INSERT + UPDATE via is_tenant_admin; NO delete — archive-over-delete). Composite same-tenant FKs to quotes(id,tenant_id) + quote_versions(id,tenant_id). status advances open → completed (the completion UPDATE sets outcome + completed_at on the same row); an open row''s note can be annotated. Written/updated ONLY by the plan/complete/annotate single-row envelope commands (NO RPC — architecture §14). NO money/tax/öre column, NO updated_at/set_updated_at trigger, NO Fortnox/supplier/sync/portal column, NO notification/reminder/email column (Epic 13 owns follow-up reminders — the ⚑ scope boundary). Story 10.3 Stop Conditions.';

-- ----------------------------------------------------------------------------
-- Partial unique index (UXB-A6, R-1030): at most ONE OPEN follow-up per quote. A second open
-- follow-up on the same quote raises 23505, which the plan command maps to a clear
-- VALIDATION_FAILED ("En öppen uppföljning finns redan för offerten."). A completed row is
-- exempt from the index, so a NEW open follow-up is allowed once the prior is completed.
-- ----------------------------------------------------------------------------
create unique index quote_follow_ups_one_open_per_quote
  on public.quote_follow_ups (quote_id) where status = 'open';

-- Index for the command/RLS access path (mirror the quote index pattern).
create index quote_follow_ups_tenant_id_idx
  on public.quote_follow_ups (tenant_id);

-- ----------------------------------------------------------------------------
-- Base table privileges (GRANTs) — UPDATE-able on the app path:
--   authenticated → SELECT, INSERT, UPDATE (NO delete — archive over delete; the absent
--     DELETE grant is what makes 10.3-RLS-01's own-tenant-DELETE-rejected negative pass).
--   service_role  → full DML (TEST-ONLY factory seed/cleanup; BYPASSRLS).
--   anon          → NOTHING.
-- ----------------------------------------------------------------------------
grant select, insert, update on public.quote_follow_ups to authenticated;
grant select, insert, update, delete on public.quote_follow_ups to service_role;

-- ----------------------------------------------------------------------------
-- Row Level Security: ENABLE + FORCE.
-- ----------------------------------------------------------------------------
alter table public.quote_follow_ups enable row level security;
alter table public.quote_follow_ups force row level security;

-- ----------------------------------------------------------------------------
-- Policies: own-tenant SELECT + INSERT + UPDATE via the EXISTING is_tenant_admin helper. NO
-- delete policy (archive-over-delete). 3 new policies. This is the load-bearing contrast with
-- 10.2's insert-only quote_lost_reasons (which has NO update policy): the UPDATE policy makes
-- the cross-tenant UPDATE denial the RLS-USING "rls-invisible" mechanism (zero rows + unchanged
-- re-read), mirroring quote_acceptances — NOT the privilege-layer 42501 of the insert-only case.
-- ----------------------------------------------------------------------------
create policy quote_follow_ups_select_own
  on public.quote_follow_ups for select to authenticated
  using (public.is_tenant_admin(tenant_id));
create policy quote_follow_ups_insert_own
  on public.quote_follow_ups for insert to authenticated
  with check (public.is_tenant_admin(tenant_id));
create policy quote_follow_ups_update_own
  on public.quote_follow_ups for update to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- INTENTIONALLY NOT CREATED (archive-over-delete discipline):
--   * NO DELETE policy / grant on quote_follow_ups — an own-tenant DELETE is deny-by-default at
--     the privilege layer (no DELETE grant). This is the load-bearing archive-over-delete rule.
--   * NO updated_at column / set_updated_at trigger (nothing derives from the row; the completion
--     UPDATE is explicit).
--   * NO RPC (architecture-phase-b §14 — plan/complete/annotate are single-row envelope commands).
