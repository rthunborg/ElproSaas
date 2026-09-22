-- Story 12.2: read-only, platform-scoped DTO. No base table grants or writers.
create or replace function public.operator_console_projection(p_tenant_id uuid default null)
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
  if not public.is_platform_operator() then
    raise exception 'operator access denied' using errcode = '42501';
  end if;

  return query
    select t.name,
      concat(t.country_code, ':', t.normalized_organization_number),
      t.provisioning_state,
      t.created_at,
      case
        when t.provisioning_state = 'ready' then 'ready'
        when i.outcome is not null then i.outcome
        else 'pending'
      end
    from public.tenants t
    left join public.tenant_provisioning_invites i on i.tenant_id = t.id
    where t.normalized_organization_number is not null
      and (p_tenant_id is null or t.id = p_tenant_id)
    order by t.created_at desc;
end;
$$;

revoke all on function public.operator_console_projection(uuid) from public, anon, service_role;
grant execute on function public.operator_console_projection(uuid) to authenticated;
