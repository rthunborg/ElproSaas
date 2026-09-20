-- Story 12.2: server-only detail actions need the durable tenant key after a
-- canonical-identity route lookup. The browser still receives only the fixed
-- list DTO plus a server-bound action reference, never a hidden retry identity.
create function public.operator_console_resume_target(p_identity text)
returns table (tenant_id uuid, first_admin_attempt integer)
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
    select t.id, i.dispatch_generation
    from public.tenants t
    join public.tenant_provisioning_invites i on i.tenant_id = t.id
    where t.id::text = p_identity
       or concat(t.country_code, ':', t.normalized_organization_number) = p_identity;
end;
$$;
revoke all on function public.operator_console_resume_target(text) from public, anon, service_role;
grant execute on function public.operator_console_resume_target(text) to authenticated;
