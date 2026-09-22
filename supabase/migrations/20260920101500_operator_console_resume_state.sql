-- Story 12.2: keep the list DTO fixed while providing a separately bounded,
-- platform-only detail lookup and the non-secret dispatch generation needed by
-- a resumed handoff. Neither function grants base-table access or writes data.
create function public.operator_console_projection_by_identity(p_identity text)
returns table (
  tenant_name text,
  canonical_organisation_identity text,
  provisioning_state text,
  created_at timestamptz,
  first_admin_state text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_operator() or p_identity !~ '^SE:[0-9]{10}$' then
    raise exception 'operator access denied' using errcode = '42501';
  end if;
  return query
    select t.name,
      concat(t.country_code, ':', t.normalized_organization_number),
      t.provisioning_state,
      t.created_at,
      case when t.provisioning_state = 'ready' then 'ready' when i.outcome is not null then i.outcome else 'pending' end
    from public.tenants t
    left join public.tenant_provisioning_invites i on i.tenant_id = t.id
    where concat(t.country_code, ':', t.normalized_organization_number) = p_identity;
end;
$$;

create function public.operator_console_resume_state(p_identity text)
returns table (first_admin_attempt integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_operator() or length(p_identity) > 64 then
    raise exception 'operator access denied' using errcode = '42501';
  end if;
  return query
    select i.dispatch_generation
    from public.tenants t
    join public.tenant_provisioning_invites i on i.tenant_id = t.id
    where t.id::text = p_identity
       or concat(t.country_code, ':', t.normalized_organization_number) = p_identity;
end;
$$;

revoke all on function public.operator_console_projection_by_identity(text) from public, anon, service_role;
revoke all on function public.operator_console_resume_state(text) from public, anon, service_role;
grant execute on function public.operator_console_projection_by_identity(text) to authenticated;
grant execute on function public.operator_console_resume_state(text) to authenticated;
