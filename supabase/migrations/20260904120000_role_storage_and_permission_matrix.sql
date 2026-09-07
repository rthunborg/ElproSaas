-- Story 11.1: additive multi-role storage.  The scalar role remains the legacy
-- compatibility assignment; no existing membership rows are rewritten.

alter table public.tenant_memberships
  drop constraint tenant_memberships_role_check;

alter table public.tenant_memberships
  add constraint tenant_memberships_role_check
  check (role in ('tenant_admin', 'projektledare', 'montor', 'saljare', 'ekonomi'));

create table public.membership_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  membership_id uuid not null references public.tenant_memberships(id) on delete cascade,
  role text not null check (role in ('tenant_admin', 'projektledare', 'montor', 'saljare', 'ekonomi')),
  created_at timestamptz not null default now(),
  constraint membership_roles_membership_role_unique unique (membership_id, role),
  constraint membership_roles_tenant_membership_unique unique (tenant_id, membership_id)
);

create or replace function public.enforce_membership_role_tenant_match()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.tenant_memberships m
    where m.id = new.membership_id and m.tenant_id = new.tenant_id
  ) then
    raise exception using errcode = '23503', message = 'membership role tenant mismatch';
  end if;
  return new;
end;
$$;

create trigger membership_roles_tenant_match
  before insert or update of tenant_id, membership_id on public.membership_roles
  for each row execute function public.enforce_membership_role_tenant_match();

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
