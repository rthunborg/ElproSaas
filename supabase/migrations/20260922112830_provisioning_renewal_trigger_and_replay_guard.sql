-- Renewal updates invited/expired memberships under a least-privilege owner.
-- Return before preparing Auth-dependent readiness SQL when activation did not occur.
-- Keep this existing trigger SECURITY INVOKER and retain its activation predicate.
create or replace function public.project_provisioning_ready()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.status is distinct from 'active' or new.user_id is null then
    return new;
  end if;
  if exists (
    select 1 from public.tenant_provisioning_invites i
    join auth.users u on u.id = new.user_id
    where i.tenant_id = new.tenant_id
      and i.membership_id = new.id
      and lower(trim(u.email)) = i.normalized_email
  ) then
    update public.tenants set provisioning_state='ready' where id=new.tenant_id
      and provisioning_state in ('pending_first_admin_invite','first_admin_invite_requested','first_admin_invite_unknown')
      and provisioning_baseline_id is not null and provisioning_baseline_version is not null and provisioning_baseline_content_hash is not null;
  end if;
  return new;
end $$;
revoke all on function public.project_provisioning_ready() from public, anon, authenticated, service_role;

-- A concurrent reuse of a renewal grant must not become an ordinary retry once
-- the winning request has already renewed expiry and reset the dispatch count.
do $migration$
declare
  v_definition text;
  v_old text := $old$if (v_att->>'approvalGeneration')::integer is distinct from v_existing.approval_generation then$old$;
  v_new text := $new$if v_att->>'explicitApproval' = 'true' then
        raise exception 'PREVIEW_STALE';
      end if;
      if (v_att->>'approvalGeneration')::integer is distinct from v_existing.approval_generation then$new$;
begin
  select pg_get_functiondef('public.provision_tenant(text,jsonb)'::regprocedure) into v_definition;
  if position(v_old in v_definition) = 0 then raise exception 'provisioning renewal replay seam changed'; end if;
  execute replace(v_definition, v_old, v_new);
end $migration$;

alter function public.provision_tenant(text,jsonb) owner to provisioning_function_owner;
revoke all on function public.provision_tenant(text,jsonb) from public, anon, authenticator, service_role;
grant execute on function public.provision_tenant(text,jsonb) to authenticated;
