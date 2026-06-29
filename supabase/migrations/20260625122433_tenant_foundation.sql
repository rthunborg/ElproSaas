-- ============================================================================
-- Migration: tenant_foundation
-- Story 2.2 — Tenant Membership Schema, RLS Helpers, And Two-Tenant Fixtures.
--
-- The FIRST migration in the project. Creates the two tenant-owned root tables
-- (`tenants`, `tenant_memberships`), the two RLS helper predicates
-- (`is_active_tenant_member`, `is_tenant_admin`), enables + FORCES Row Level
-- Security on both tables, and writes the baseline SELECT/INSERT/UPDATE/DELETE
-- policies (architecture §6, §8, §9).
--
-- This schema is the authoritative DDL behind the shape Story 2.1's live
-- resolver (`src/server/auth/resolve-tenant-context.ts`) already queries:
--   .select("tenant_id, role, status, tenants(name)")
--   .eq("user_id", …).eq("role", 'tenant_admin')
-- so `tenant_id`, `user_id`, `role`, `status`, `created_at`, and the FK to
-- `tenants(name)` MUST exist by those exact snake_case names — changing any
-- column name would break Story 2.1 in production.
--
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER review note (AC4 / R-006 — LOAD-BEARING):
-- ----------------------------------------------------------------------------
-- `is_active_tenant_member` and `is_tenant_admin` are declared SECURITY DEFINER
-- ON PURPOSE. They read `public.tenant_memberships`, which itself has RLS whose
-- SELECT policy is expressed *in terms of these helpers*. A SECURITY INVOKER
-- helper would re-enter the same RLS policy on every call → infinite recursion
-- (Postgres error 42P17). Making the helpers DEFINER lets them read the
-- membership table without re-triggering RLS, breaking the recursion. This is
-- the canonical Supabase RLS-helper pattern.
--
-- BECAUSE they are DEFINER, each helper pins `set search_path = ''` (empty) and
-- schema-qualifies EVERY object reference (`public.tenant_memberships`,
-- `auth.uid()`). A DEFINER function without a fixed search_path is a
-- function-hijacking / privilege-bypass vector: an attacker who can prepend a
-- schema to `search_path` could shadow `tenant_memberships` with a hostile
-- object and forge a positive authorization result. The empty, schema-qualified
-- search_path makes that impossible — proven by the negative test in
-- tests/integration/rls/security-definer-search-path.rls.test.ts.
-- The helpers are also marked STABLE (no writes) and revoked from PUBLIC; only
-- `authenticated` (and `service_role` for tests) may call them inside policies.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: tenants — the pooled tenant/company root (architecture §7, §8).
-- ----------------------------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  -- NOT NULL: the Story 2.1 resolver joins `tenants(name)` for the top-bar
  -- display, and the deferred-work ledger calls for this constraint so the
  -- AppShell both-null tenant indicator can be reconciled. (Story 2.2 lands the
  -- constraint; the AppShell display fix itself is a later shell pass.)
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tenants is
  'Pooled tenant/company root (architecture §8). Every business record belongs to one tenant. RLS-protected: readable only by its own active tenant_admin members.';

-- ----------------------------------------------------------------------------
-- Table: tenant_memberships — the authorization source (architecture §8).
--
-- EXACT shape the Story 2.1 resolver queries (do NOT diverge — 2.1 is the live
-- consumer). Phase A constrains `role` to 'tenant_admin' (no full RBAC) and
-- `status` to the three-value lifecycle union the resolver coerces against.
-- ----------------------------------------------------------------------------
create table public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- References Supabase Auth users. on delete cascade so removing an auth user
  -- removes their memberships (no dangling authorization rows).
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Phase A: ONLY 'tenant_admin'. Any other role value is rejected by the DB
  -- (AC1). Full RBAC is explicitly out of scope for this story.
  role text not null check (role = 'tenant_admin'),
  -- The membership lifecycle union the resolver narrows against (architecture
  -- §8). Only 'active' grants access; 'invited'/'disabled' are no-access.
  status text not null check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One membership per user per tenant. A user therefore has AT MOST one row per
  -- tenant — the multi-row "prefer active first" case the resolver guards is
  -- only reachable ACROSS tenants (Task 7.2).
  constraint tenant_memberships_tenant_user_unique unique (tenant_id, user_id)
);

-- Index for the resolver lookup (`.eq("user_id", …)`).
create index tenant_memberships_user_id_idx
  on public.tenant_memberships (user_id);

comment on table public.tenant_memberships is
  'User-to-tenant authorization source (architecture §8). role constrained to tenant_admin (Phase A, no RBAC); status in (active|invited|disabled), only active grants access. Provisioned by admin/service-role only — never self-granted through the anon app path (RLS denies it).';

-- ----------------------------------------------------------------------------
-- Keep updated_at honest on UPDATE (audit timestamps, architecture §8/§22).
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
-- SECURITY INVOKER (default): this trigger only touches the NEW row in flight,
-- needs no elevated privilege, and writes nothing outside the row being saved.
-- Still pin search_path defensively.
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

create trigger tenant_memberships_set_updated_at
  before update on public.tenant_memberships
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS helper predicates (architecture §9 / AR9). SECURITY DEFINER + fixed
-- search_path (see the review note in the file header). STABLE: no writes.
-- ----------------------------------------------------------------------------

-- True iff the CURRENT authenticated user has an ACTIVE membership in the target
-- tenant (any role). Reads tenant_memberships under definer rights so it does
-- not re-enter that table's RLS (recursion break).
create or replace function public.is_active_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_memberships m
    where m.tenant_id = target_tenant_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

comment on function public.is_active_tenant_member(uuid) is
  'RLS helper (architecture §9). SECURITY DEFINER with fixed empty search_path (AC4/R-006): reads public.tenant_memberships without re-entering its RLS (recursion break) and resists search_path hijack via the empty, schema-qualified path. True iff auth.uid() has an active membership in target_tenant_id.';

-- True iff the CURRENT authenticated user is an ACTIVE tenant_admin of the
-- target tenant. In Phase A role is always 'tenant_admin', so this is currently
-- equivalent to is_active_tenant_member; it is kept as a DISTINCT predicate so
-- future role expansion (deferred) localizes the role check here, per
-- architecture §21 (RBAC seam).
create or replace function public.is_tenant_admin(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_memberships m
    where m.tenant_id = target_tenant_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = 'tenant_admin'
  );
$$;

comment on function public.is_tenant_admin(uuid) is
  'RLS helper (architecture §9). SECURITY DEFINER with fixed empty search_path (AC4/R-006). True iff auth.uid() is an active tenant_admin of target_tenant_id. RBAC role check is localized here (architecture §21 seam).';

-- Least privilege: only authenticated callers (inside policies) need these.
-- Revoke the implicit PUBLIC EXECUTE grant, then grant to authenticated +
-- service_role (factories/tests). anon must NOT be able to probe membership.
revoke execute on function public.is_active_tenant_member(uuid) from public;
revoke execute on function public.is_tenant_admin(uuid) from public;
grant execute on function public.is_active_tenant_member(uuid) to authenticated, service_role;
grant execute on function public.is_tenant_admin(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Base table privileges (GRANTs).
--
-- RLS only NARROWS what a role with a base GRANT may touch — it never grants
-- access on its own. New tables in `public` are NOT auto-exposed to the Data API
-- roles on this stack, so without explicit GRANTs `authenticated` (and even the
-- BYPASSRLS `service_role`) get "permission denied". Grant deliberately:
--   * authenticated → SELECT only. Combined with the SELECT policies + the absence
--     of write policies, this realizes "read your own tenant, write nothing via
--     the app path" (AC3). INSERT/UPDATE/DELETE are intentionally NOT granted.
--   * service_role  → full DML. It is BYPASSRLS and is the TEST-ONLY factory path
--     (and the future server-command path) that provisions tenants/memberships.
--   * anon          → NOTHING. An unauthenticated caller can touch neither table.
-- ----------------------------------------------------------------------------
grant select on public.tenants to authenticated;
grant select on public.tenant_memberships to authenticated;
grant select, insert, update, delete on public.tenants to service_role;
grant select, insert, update, delete on public.tenant_memberships to service_role;

-- ----------------------------------------------------------------------------
-- Row Level Security: ENABLE + FORCE on both tables (architecture §6, §9).
-- FORCE so even the table owner is subject to RLS (owner-bypass safety); the
-- factories deliberately use the service_role, which is BYPASSRLS, for setup.
-- ----------------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.tenants force row level security;
alter table public.tenant_memberships enable row level security;
alter table public.tenant_memberships force row level security;

-- ----------------------------------------------------------------------------
-- Policies: tenants
--
-- SELECT: a user may read a tenant row ONLY for a tenant where they are an
-- active tenant_admin. No INSERT/UPDATE/DELETE policy is defined for the
-- anon/authenticated app path → those verbs are DENY-by-default (no policy =
-- no rows pass). Tenant provisioning is an admin/service-role operation
-- (factories), NOT exposed to the app path in Phase A.
-- ----------------------------------------------------------------------------
create policy tenants_select_own
  on public.tenants
  for select
  to authenticated
  using (public.is_tenant_admin(id));

-- ----------------------------------------------------------------------------
-- Policies: tenant_memberships
--
-- SELECT: a user may read membership rows ONLY for tenants where they are an
-- active tenant_admin (the resolver reads its OWN row this way). This also lets
-- an admin see other memberships within their OWN tenant — acceptable for Phase
-- A (single-admin tenants); it never widens across tenants.
--
-- INSERT/UPDATE/DELETE: NO policy → DENY-by-default for the app (anon-key) path.
-- This is the load-bearing AC3 / R-005 property: a user CANNOT self-grant a
-- membership, CANNOT escalate their own role/status, CANNOT move their own
-- tenant_id — because there is no write policy exposing those mutations to the
-- authenticated app path at all. Membership provisioning is admin/service-role
-- only (the factories' test-only path), which is BYPASSRLS.
-- ----------------------------------------------------------------------------
create policy tenant_memberships_select_own
  on public.tenant_memberships
  for select
  to authenticated
  using (public.is_tenant_admin(tenant_id));

-- INTENTIONALLY NOT EXPOSED to the app path in Phase A (documented per Task 3.4):
--   * tenant_memberships INSERT  — self-grant denied (admin/service-role only)
--   * tenant_memberships UPDATE  — role/status/tenant_id self-escalation denied
--   * tenant_memberships DELETE  — membership removal is an admin-only operation
--   * tenants INSERT/UPDATE/DELETE — tenant lifecycle is admin/service-role only
-- These verbs have no policy and therefore deny by default under RLS.
