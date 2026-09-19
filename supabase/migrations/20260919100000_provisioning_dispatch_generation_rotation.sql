-- Story 12.1 / Decision 7C. Keep the original provision_tenant implementation
-- private and add the only new action variants to the existing public boundary.
alter function public.provision_tenant(text, jsonb) rename to provision_tenant_legacy;
revoke all on function public.provision_tenant_legacy(text, jsonb) from public;
revoke all on function public.provision_tenant_legacy(text, jsonb) from authenticated, service_role;

alter table public.tenant_provisioning_requests
  add column if not exists dispatch_approval_generation integer not null default 0;

create or replace function public.provision_tenant(p_action text, p_request jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_tenant_id uuid;
  v_invite public.tenant_provisioning_invites;
  v_state text;
  v_next_attempt integer;
  v_fresh_approval boolean;
begin
  if p_action not in ('reserve_dispatch','record_requested','record_unknown','record_failed') then
    return public.provision_tenant_legacy(p_action, p_request);
  end if;

  if not public.is_platform_operator() then
    raise exception 'provisioning denied' using errcode='42501';
  end if;
  v_tenant_id := (p_request->>'tenant_id')::uuid;
  select * into v_invite from public.tenant_provisioning_invites
    where tenant_id=v_tenant_id for update;
  if not found then raise exception 'provisioning denied' using errcode='42501'; end if;

  if p_action = 'reserve_dispatch' then
    if coalesce(p_request->>'invitation_token_hash','') !~ '^[0-9a-f]{64}$' then
      raise exception 'provisioning denied' using errcode='42501';
    end if;
    v_fresh_approval := coalesce((p_request->>'fresh_approval')::boolean, false);
    if v_invite.attempt_count >= 3 and not v_fresh_approval then
      raise exception 'PREVIEW_STALE';
    end if;
    if v_invite.attempt_count >= 3 and v_fresh_approval and not exists (
      select 1 from public.tenant_provisioning_requests r
       where r.tenant_id=v_tenant_id and r.preview_hash=p_request->>'preview_hash'
    ) then
      raise exception 'PREVIEW_STALE';
    end if;
    update public.membership_admin_operations set superseded_at=statement_timestamp()
      where membership_id=v_invite.membership_id and action in ('invite','resend')
        and superseded_at is null;
    v_next_attempt := case when v_invite.attempt_count >= 3 then 1 else v_invite.attempt_count + 1 end;
    update public.tenant_provisioning_invites set token_hash=p_request->>'invitation_token_hash',
      revoked_at=null, attempt_count=v_next_attempt, outcome=null, updated_at=statement_timestamp()
      where tenant_id=v_tenant_id;
    insert into public.membership_admin_operations(
      id,tenant_id,actor_user_id,membership_id,action,outcome,invitation_token_hash,invitation_expires_at
    ) values (
      gen_random_uuid(),v_tenant_id,auth.uid(),v_invite.membership_id,'resend','uncertain',
      p_request->>'invitation_token_hash',v_invite.expires_at
    );
    if v_fresh_approval then
      update public.tenant_provisioning_requests set dispatch_approval_generation=dispatch_approval_generation+1
        where tenant_id=v_tenant_id;
    end if;
    insert into public.audit_events(tenant_id,actor_user_id,command,event_type,target_type,target_id,correlation_id,metadata)
      values(v_tenant_id,auth.uid(),'provisioning.retry','first_admin_invite_reserved','tenant',v_tenant_id,
        gen_random_uuid(),jsonb_build_object('attemptNumber',v_next_attempt,'freshApproval',v_fresh_approval));
    return jsonb_build_object('tenantId',v_tenant_id,'attemptNumber',v_next_attempt,
      'reconciliationAction','reserved','provisioningState',(select provisioning_state from public.tenants where id=v_tenant_id));
  end if;

  v_state := case p_action when 'record_requested' then 'first_admin_invite_requested'
    when 'record_unknown' then 'first_admin_invite_unknown' else 'first_admin_invite_failed' end;
  update public.tenant_provisioning_invites set outcome=case p_action when 'record_requested' then 'requested'
    when 'record_unknown' then 'unknown' else 'failed' end, updated_at=statement_timestamp()
    where tenant_id=v_tenant_id;
  update public.membership_admin_operations set outcome=case p_action when 'record_requested' then 'succeeded'
    when 'record_unknown' then 'uncertain' else 'failed' end, completed_at=statement_timestamp()
    where membership_id=v_invite.membership_id and superseded_at is null and action='resend';
  update public.tenants set provisioning_state=v_state where id=v_tenant_id;
  insert into public.audit_events(tenant_id,actor_user_id,command,event_type,target_type,target_id,correlation_id,metadata)
    values(v_tenant_id,auth.uid(),'provisioning.retry','first_admin_invite_transition','tenant',v_tenant_id,
      gen_random_uuid(),jsonb_build_object('attemptNumber',v_invite.attempt_count,'outcome',p_action));
  return jsonb_build_object('tenantId',v_tenant_id,'provisioningState',v_state,'attemptNumber',v_invite.attempt_count,
    'reconciliationAction','recorded');
end $$;

revoke all on function public.provision_tenant(text,jsonb) from public;
grant execute on function public.provision_tenant(text,jsonb) to authenticated;
