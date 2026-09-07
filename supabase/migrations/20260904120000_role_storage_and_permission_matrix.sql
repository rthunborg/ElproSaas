-- Story 11.1: additive multi-role storage.  The scalar role remains the legacy
-- compatibility assignment; no existing membership rows are rewritten.

alter table public.tenant_memberships
  drop constraint tenant_memberships_role_check;

alter table public.tenant_memberships
  add constraint tenant_memberships_role_check
  check (role in ('tenant_admin', 'projektledare', 'montor', 'saljare', 'ekonomi'));

-- The composite parent key is the concurrency-safe tenancy authority for child
-- assignments.  A child FK check takes a KEY SHARE lock on this key, which
-- conflicts with a concurrent parent update that changes `tenant_id`.
alter table public.tenant_memberships
  add constraint tenant_memberships_id_tenant_unique unique (id, tenant_id);

create table public.membership_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  membership_id uuid not null,
  role text not null check (role in ('tenant_admin', 'projektledare', 'montor', 'saljare', 'ekonomi')),
  created_at timestamptz not null default now(),
  -- A membership can hold MORE THAN ONE additional role; only an identical role
  -- may not be assigned twice.
  constraint membership_roles_membership_role_unique unique (membership_id, role),
  -- One declarative constraint enforces the tenant match and serializes a child
  -- write against any parent tenant move.  Trigger-only existence checks leave a
  -- READ COMMITTED write-skew race; the FK's key locks close that gap.
  constraint membership_roles_membership_tenant_fk
    foreign key (membership_id, tenant_id)
    references public.tenant_memberships (id, tenant_id)
    on update restrict
    on delete cascade
);

alter table public.membership_roles enable row level security;
alter table public.membership_roles force row level security;

grant select on public.membership_roles to authenticated;
grant select, insert, update, delete on public.membership_roles to service_role;

create policy membership_roles_select_own on public.membership_roles
  for select to authenticated using (public.is_tenant_admin(tenant_id));

create or replace function public.has_tenant_role(target_tenant_id uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(array_length(allowed_roles, 1), 0) > 0 and exists (
    select 1
    from public.tenant_memberships m
    where m.tenant_id = target_tenant_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and (
        m.role = any(allowed_roles)
        or exists (
          select 1 from public.membership_roles mr
          where mr.membership_id = m.id
            and mr.tenant_id = m.tenant_id
            and mr.role = any(allowed_roles)
        )
      )
  );
$$;

revoke execute on function public.has_tenant_role(uuid, text[]) from public;
grant execute on function public.has_tenant_role(uuid, text[]) to authenticated, service_role;

-- Phase A's existing command/write surface remains tenant-admin-only until Story
-- 11.2 deliberately declares per-role capabilities.  `record_audit_event` is a
-- directly executable SECURITY DEFINER RPC, so its former active-member check
-- would otherwise let a newly-valid non-admin scalar membership forge same-tenant
-- audit records outside the command envelope.
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
  v_created_at timestamptz := statement_timestamp();
begin
  if auth.uid() is null or auth.uid() <> p_actor_user_id then
    raise exception 'record_audit_event: actor must match the authenticated caller'
      using errcode = 'insufficient_privilege';
  end if;

  if not public.is_tenant_admin(p_tenant_id) then
    raise exception 'record_audit_event: caller is not an active tenant admin of the target tenant'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.audit_events (
    tenant_id, actor_user_id, command, event_type, target_type, target_id,
    correlation_id, metadata, created_at
  ) values (
    p_tenant_id, p_actor_user_id, p_command, p_event_type, p_target_type, p_target_id,
    p_correlation_id, coalesce(p_metadata, '{}'::jsonb), v_created_at
  ) returning id into v_id;

  return v_id;
end;
$$;

comment on function public.record_audit_event(uuid, uuid, text, text, text, uuid, uuid, jsonb, timestamptz) is
  'Privileged append-only audit write. The actor must equal auth.uid() and be an active tenant admin of the target tenant until Story 11.2 declares role capabilities. The legacy p_created_at parameter is retained for RPC compatibility but deliberately ignored: audit creation time is database-owned via statement_timestamp(). SECURITY DEFINER with fixed empty search_path.';
