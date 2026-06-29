-- ============================================================================
-- Migration: audit_events
-- Story 2.3 — Server Command Envelope And Minimal Audit Events.
--
-- The SECOND migration in the project. Creates the append-only operational/
-- security audit substrate `public.audit_events` (architecture §15), the
-- privileged `record_audit_event` SECURITY DEFINER write function (the
-- architecture-blessed audit-write path, §6/ADR-A009 — keeps the anon-key app
-- runtime free of any service-role client), the append-only-enforcing
-- BEFORE UPDATE OR DELETE trigger (architecture §9 — immutable lifecycle tables
-- block updates via trigger/constraint, NOT just UI), the deliberate GRANTs, and
-- RLS enable+force + the own-tenant SELECT policy.
--
-- It REUSES the helpers landed by 20260625122433_tenant_foundation.sql:
-- `public.is_active_tenant_member` (the membership check inside the DEFINER
-- write fn) and `public.is_tenant_admin` (the own-tenant SELECT policy).
--
-- SCOPE DISCIPLINE (architecture §7; Story 2.3 Stop Conditions): `audit_events`
-- is the ONLY table this migration creates. NO tenant_counters, NO CRM/quote/
-- job/file table, NO analytics table/materialized view — those are later stories.
--
-- ----------------------------------------------------------------------------
-- ACTOR FK DECISION (Task 1.2 — documented choice):
-- ----------------------------------------------------------------------------
-- `actor_user_id` references `auth.users(id)` with `on delete set null` and is
-- therefore NULLABLE. Rationale: the audit trail MUST survive a deleted actor
-- (an audit row whose actor account is later removed must NOT silently vanish).
-- A plain no-cascade FK would instead BLOCK deleting an actor while audit rows
-- exist; `on delete set null` preserves the row (and all other columns: command,
-- target, timestamp, correlation id) while nulling only the now-meaningless FK.
-- At INSERT time the column always carries the real authenticated user id (AC3);
-- it only becomes NULL if/when that auth user is later deleted. We deliberately
-- do NOT use `on delete cascade` — that would DELETE audit history, the exact
-- failure mode this column guards against.
--
-- ----------------------------------------------------------------------------
-- GRANT discipline (inherited Story 2.2 gotcha — LOAD-BEARING):
-- ----------------------------------------------------------------------------
-- New `public` tables are NOT auto-exposed to the Data API roles on this stack,
-- and RLS only NARROWS an already-granted role. Grant deliberately:
--   * authenticated → SELECT ONLY. Read own-tenant audit history (AC7) via the
--     SELECT policy. NO INSERT/UPDATE/DELETE grant → the app (anon-key) path can
--     never write or mutate audit rows; append-only is enforced at the privilege
--     layer (absence-of-grant) + absence-of-policy, surfacing as `42501`.
--   * service_role → SELECT, INSERT ONLY. The TEST-ONLY factory seed/read path
--     (and the function's DEFINER owner). Deliberately NO UPDATE/DELETE even for
--     service_role, so the table is append-only at the privilege layer too.
--   * anon → NOTHING.
-- The runtime audit INSERT goes through `record_audit_event` (SECURITY DEFINER),
-- NOT a direct grant to `authenticated` — so the anon-key runtime needs no
-- service-role client (no service-role in app paths, §6 / project rules).
--
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER review note (R-006 — LOAD-BEARING), mirroring the helpers:
-- ----------------------------------------------------------------------------
-- `record_audit_event` is SECURITY DEFINER so the audit INSERT runs with the
-- function-owner's privilege (the app caller, `authenticated`, has no INSERT
-- grant). BECAUSE it is DEFINER it pins `set search_path = ''` and
-- schema-qualifies EVERY reference (`public.audit_events`,
-- `public.is_active_tenant_member`) — a DEFINER fn without a fixed search_path is
-- a hijack vector (an attacker who prepends a schema could shadow a referenced
-- object and forge behaviour). It performs an EXPLICIT
-- `is_active_tenant_member(p_tenant_id)` membership check before inserting, so it
-- can never be used to write a cross-tenant audit row, and it accepts the command
-- timestamp / correlation id / sanitized metadata as EXPLICIT parameters (H1 — it
-- never calls now() itself, so the ONE command timestamp governs created_at).
-- Proven by tests/integration/commands/record-audit-event-search-path.int.test.ts
-- (hijack negative + control) and the anon-EXECUTE negative.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: audit_events — append-only operational/security audit (architecture §15).
-- EXACT snake_case columns from the §15 field list (no updated_at — rows are
-- immutable, there is no UPDATE path).
-- ----------------------------------------------------------------------------
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  -- The resolved tenant the event belongs to. Cascade so removing a tenant
  -- removes its audit history (no dangling tenant-orphaned rows).
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The authenticated actor. on delete set null (nullable) so the audit trail
  -- survives a deleted actor — see the ACTOR FK DECISION note in the header.
  actor_user_id uuid references auth.users (id) on delete set null,
  -- The server-command name (e.g. 'tenant.noop').
  command text not null,
  -- The lifecycle event type (e.g. 'tenant.noop.executed').
  event_type text not null,
  -- The kind of target row (e.g. 'tenant', 'customer', 'quote_version').
  target_type text not null,
  -- The specific target row id. Nullable — some events have no single row target.
  target_id uuid,
  -- The per-request/per-command correlation id (also surfaced to logs).
  correlation_id uuid not null,
  -- Narrow, pre-approved safe JSON ONLY (the metadata allow-list / sanitizer,
  -- AC5 / R-010). NEVER secrets/.env/raw files/service-role/full bodies/broad PII.
  metadata jsonb not null default '{}'::jsonb,
  -- The SINGLE deterministic command timestamp (H1). Defaulted for the privileged
  -- seed path; the command path passes the captured clock value explicitly.
  created_at timestamptz not null default now()
);

comment on table public.audit_events is
  'Append-only operational/security audit (architecture §15), NOT analytics. One row per critical/auditable server command. tenant-owned + RLS-protected (own-tenant read), append-only (no UPDATE/DELETE path through any normal app path — enforced by absence-of-grant + the audit_events_append_only trigger). Written via the record_audit_event SECURITY DEFINER fn so the anon-key runtime needs no service-role client.';

-- Index for the "record context" own-tenant read (AC7): newest-first per tenant.
create index audit_events_tenant_created_idx
  on public.audit_events (tenant_id, created_at desc);

-- Index for correlation-id lookups (tracing a request across rows / logs).
create index audit_events_correlation_idx
  on public.audit_events (correlation_id);

-- ----------------------------------------------------------------------------
-- Append-only enforcement (architecture §9): block UPDATE/DELETE at the TABLE
-- level via a trigger, not just by withholding grants. Defense-in-depth so even
-- a future privileged (service_role / owner) mistake cannot mutate an audit row.
-- This makes append-only a table-level invariant proven by the R-009 negative.
-- ----------------------------------------------------------------------------
create or replace function public.audit_events_block_mutation()
returns trigger
language plpgsql
-- SECURITY INVOKER (default): this guard only inspects the operation in flight
-- and raises; it needs no elevated privilege. Pin search_path defensively.
set search_path = ''
as $$
begin
  raise exception
    'audit_events is append-only: % is not permitted (architecture §9, §15)',
    tg_op
    using errcode = 'restrict_violation';
end;
$$;

comment on function public.audit_events_block_mutation() is
  'Append-only guard (architecture §9). Raises on any UPDATE or DELETE of audit_events so the immutability invariant holds even for a future privileged/owner mutation (defense-in-depth beyond the absence-of-grant). Proven by the R-009 negative.';

create trigger audit_events_append_only
  before update or delete on public.audit_events
  for each row execute function public.audit_events_block_mutation();

-- ----------------------------------------------------------------------------
-- Privileged audit-write function (architecture §6, §15, ADR-A009).
-- SECURITY DEFINER + fixed empty search_path + explicit membership check, so the
-- anon-key app path can write its own-tenant audit row WITHOUT a service-role
-- client. See the SECURITY DEFINER review note in the header.
--
-- H1: it accepts the command timestamp explicitly (p_created_at) and never calls
-- now() — the ONE command clock value governs created_at.
-- ----------------------------------------------------------------------------
create or replace function public.record_audit_event(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_command text,
  p_event_type text,
  p_target_type text,
  p_target_id uuid,
  p_correlation_id uuid,
  p_metadata jsonb,
  p_created_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- Tenant-ownership gate: the CURRENT authenticated user must be an active
  -- member of p_tenant_id. This prevents a cross-tenant audit write even though
  -- the function runs with definer privilege (it can NOT be used to write under
  -- a tenant the caller does not belong to). Schema-qualified (fixed search_path).
  if not public.is_active_tenant_member(p_tenant_id) then
    raise exception 'record_audit_event: caller is not an active member of the target tenant'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.audit_events (
    tenant_id,
    actor_user_id,
    command,
    event_type,
    target_type,
    target_id,
    correlation_id,
    metadata,
    created_at
  )
  values (
    p_tenant_id,
    p_actor_user_id,
    p_command,
    p_event_type,
    p_target_type,
    p_target_id,
    p_correlation_id,
    coalesce(p_metadata, '{}'::jsonb),
    p_created_at
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.record_audit_event(uuid, uuid, text, text, text, uuid, uuid, jsonb, timestamptz) is
  'Privileged append-only audit-write (architecture §6/§15, ADR-A009). SECURITY DEFINER with fixed empty search_path (R-006): inserts ONE audit_events row after an explicit is_active_tenant_member(p_tenant_id) check (no cross-tenant write). Accepts the command timestamp explicitly (H1 — never calls now()). Lets the anon-key runtime write audit without a service-role client.';

-- ----------------------------------------------------------------------------
-- Function privileges. Revoke the implicit PUBLIC EXECUTE, then grant ONLY to
-- authenticated (the app-runtime write path). anon must NOT be able to write
-- audit (assert 42501 — anon-isolation negative). service_role can call it too
-- (test factory path); it is BYPASSRLS but the membership check still gates the
-- tenant.
-- ----------------------------------------------------------------------------
revoke execute on function public.record_audit_event(uuid, uuid, text, text, text, uuid, uuid, jsonb, timestamptz) from public;
grant execute on function public.record_audit_event(uuid, uuid, text, text, text, uuid, uuid, jsonb, timestamptz) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Base table privileges (GRANTs) — see the GRANT discipline note in the header.
--   authenticated → SELECT only (read own-tenant audit; no write/mutate path).
--   service_role  → SELECT, INSERT only (TEST-ONLY seed/read; NO UPDATE/DELETE
--                   even here → append-only at the privilege layer).
--   anon          → NOTHING.
-- ----------------------------------------------------------------------------
grant select on public.audit_events to authenticated;
grant select, insert on public.audit_events to service_role;

-- ----------------------------------------------------------------------------
-- Row Level Security: ENABLE + FORCE (architecture §6, §9). FORCE so even the
-- table owner is subject to RLS; the test factories use service_role (BYPASSRLS)
-- for the privileged seed/read.
-- ----------------------------------------------------------------------------
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;

-- ----------------------------------------------------------------------------
-- Policies: audit_events
--
-- SELECT: a user may read audit rows ONLY for a tenant where they are an active
-- tenant_admin (own-tenant audit history, AC7). Reuses is_tenant_admin (the
-- established helper). This mirrors the tenant_memberships co-member-read shape:
-- any active admin can read every audit row in their OWN tenant — acceptable,
-- intended Phase A single-admin design; the user_id-scoped least-privilege
-- tightening is a Story 2.4 / RBAC-seam follow-up (disclosed in the PR
-- Security/RLS impact statement; deferred-work.md). It NEVER widens across
-- tenants.
--
-- INSERT/UPDATE/DELETE: NO policy → DENY-by-default for the app (anon-key) path.
-- The app NEVER writes audit directly (writes go through record_audit_event);
-- UPDATE/DELETE are additionally blocked by the absence of grant AND the
-- append-only trigger. This is the load-bearing AC4 property.
-- ----------------------------------------------------------------------------
create policy audit_events_select_own
  on public.audit_events
  for select
  to authenticated
  using (public.is_tenant_admin(tenant_id));

-- INTENTIONALLY NOT EXPOSED to the app path (documented per Task 1.4):
--   * audit_events INSERT — the app writes ONLY via record_audit_event (DEFINER);
--     no direct INSERT grant/policy for authenticated.
--   * audit_events UPDATE/DELETE — append-only; no grant, no policy, AND the
--     audit_events_append_only trigger raises for any UPDATE/DELETE (even
--     privileged). These verbs deny by default under RLS and raise at the table.
