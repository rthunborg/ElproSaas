-- Story 12.1 / Decision 8A: a fourth delivery attempt is an explicit renewal,
-- never an automatic resend. The normal-JWT operator and the HMAC attestation
-- remain the only authority; the request's approval generation is the durable
-- replay barrier for that renewal.
create or replace function public.provision_tenant(p_action text, p_request jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_att jsonb := p_request->'attestation'; v_actor uuid; v_key text; v_secret text;
  v_issued timestamptz; v_expires timestamptz; v_signature text := p_request->>'attestation_signature';
  v_expected text; v_req jsonb := p_request->'request'; v_request_id uuid; v_hash text; v_org text;
  v_baseline public.tenant_provisioning_baselines; v_existing public.tenant_provisioning_requests;
  v_tenant uuid; v_membership uuid; v_invite public.tenant_provisioning_invites; v_reservation uuid;
  v_token_hash text; v_dispatch integer; v_state text; v_is_renewal boolean := false;
begin
  begin
    v_actor := (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
  exception when others then
    raise exception 'provisioning denied' using errcode='42501';
  end;
  if v_actor is null or not public.is_platform_operator()
     or p_action not in ('provision','reserve_dispatch','record_requested','record_unknown','record_failed')
     or v_att is null or v_signature !~ '^[0-9a-f]{64}$' then
    raise exception 'provisioning denied' using errcode='42501';
  end if;
  begin
    v_issued := (v_att->>'issuedAt')::timestamptz;
    v_expires := (v_att->>'expiresAt')::timestamptz;
  exception when others then
    raise exception 'provisioning denied' using errcode='42501';
  end;
  if v_att->>'action' is distinct from p_action
     or v_att->>'actorUserId' is distinct from v_actor::text
     or v_issued > statement_timestamp()+interval '5 seconds'
     or v_expires <= statement_timestamp()
     or v_expires > v_issued + interval '2 minutes' then
    raise exception 'provisioning denied' using errcode='42501';
  end if;
  v_key := v_att->>'keyId';
  v_secret := public.provisioning_attestation_secret(v_key);
  if v_secret is null then raise exception 'provisioning denied' using errcode='42501'; end if;
  v_expected := encode(extensions.hmac(public.provisioning_attestation_payload(
    p_action,v_actor,(v_att->>'requestId')::uuid,v_att->>'requestHash',v_att->>'organizationNumber',
    v_att->>'previewHash',v_att->>'baselineId',(v_att->>'baselineVersion')::integer,
    v_att->>'baselineContentHash',v_att->>'tokenHash',nullif(v_att->>'reservationId','')::uuid,
    (v_att->>'dispatchGeneration')::integer,(v_att->>'approvalGeneration')::integer,v_att->>'outcome',
    v_key,v_att->>'issuedAt',v_att->>'expiresAt'),convert_to(v_secret,'UTF8'),'sha256'),'hex');
  if v_expected is distinct from v_signature then raise exception 'provisioning denied' using errcode='42501'; end if;

  if p_action='provision' then
    if v_req is null or p_request->>'explicit_approval' <> 'true' then raise exception 'provisioning denied' using errcode='42501'; end if;
    v_request_id := (v_req->>'request_id')::uuid; v_hash := v_att->>'requestHash'; v_org := v_att->>'organizationNumber';
    if v_req->>'country_code' <> 'SE' or v_org !~ '^[0-9]{10}$' or v_att->>'previewHash' is distinct from p_request->>'preview_hash' then raise exception 'provisioning denied' using errcode='42501'; end if;
    select * into v_existing from public.tenant_provisioning_requests where request_id=v_request_id for update;
    if found then
      if v_existing.canonical_request_hash <> v_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
      return jsonb_build_object('tenantId',v_existing.tenant_id,'provisioningState',v_existing.provisioning_state,'reconciliationAction','observed');
    end if;
    select * into v_baseline from public.tenant_provisioning_baselines
      where baseline_id=v_att->>'baselineId' and version=(v_att->>'baselineVersion')::integer and content_hash=v_att->>'baselineContentHash';
    if not found then raise exception 'PREVIEW_STALE'; end if;
    insert into public.tenants(name,country_code,normalized_organization_number,provisioning_state,provisioning_baseline_id,provisioning_baseline_version,provisioning_baseline_content_hash)
      values(v_req->>'legal_name','SE',v_org,'pending_first_admin_invite',v_baseline.baseline_id,v_baseline.version,v_baseline.content_hash) returning id into v_tenant;
    insert into public.tenant_memberships(tenant_id,role,status,invited_email,invited_at,invitation_expires_at)
      values(v_tenant,'tenant_admin','invited',lower(v_req->>'first_admin_email'),statement_timestamp(),statement_timestamp()+interval '24 hours') returning id into v_membership;
    insert into public.membership_roles(tenant_id,membership_id,role) values(v_tenant,v_membership,'tenant_admin');
    insert into public.tenant_provisioning_invites(tenant_id,membership_id,token_hash,normalized_email,role)
      values(v_tenant,v_membership,'',lower(v_req->>'first_admin_email'),'tenant_admin');
    insert into public.tenant_provisioning_requests(request_id,canonical_request_hash,tenant_id,actor_user_id,preview_hash,baseline_content_hash,provisioning_state,approval_generation)
      values(v_request_id,v_hash,v_tenant,v_actor,v_att->>'previewHash',v_baseline.content_hash,'pending_first_admin_invite',1);
    insert into public.audit_events(tenant_id,actor_user_id,command,event_type,target_type,target_id,correlation_id,metadata)
      values(v_tenant,v_actor,'provisioning.approve','tenant_provisioned','tenant',v_tenant,v_request_id,
        jsonb_build_object('requestId',v_request_id,'previewHash',v_att->>'previewHash','baselineId',v_baseline.baseline_id,'baselineVersion',v_baseline.version,'baselineContentHash',v_baseline.content_hash,'approvalGeneration',1));
    return jsonb_build_object('tenantId',v_tenant,'provisioningState','pending_first_admin_invite','reconciliationAction','created');
  end if;

  v_tenant := (p_request->>'tenant_id')::uuid;
  select * into v_invite from public.tenant_provisioning_invites where tenant_id=v_tenant for update;
  select * into v_existing from public.tenant_provisioning_requests where tenant_id=v_tenant for update;
  if not found or v_invite.tenant_id is null then raise exception 'provisioning denied' using errcode='42501'; end if;
  if v_att->>'requestId' is distinct from v_existing.request_id::text
     or v_att->>'requestHash' is distinct from v_existing.canonical_request_hash then
    raise exception 'provisioning denied' using errcode='42501';
  end if;

  if p_action='reserve_dispatch' then
    v_token_hash := p_request->>'token_hash';
    if v_token_hash !~ '^[0-9a-f]{64}$' or v_att->>'tokenHash' is distinct from v_token_hash then raise exception 'provisioning denied' using errcode='42501'; end if;
    if v_invite.dispatch_generation >= 3 then
      -- A renewal must include a fresh preview confirmation and an HMAC-bound
      -- approval generation strictly newer than the durable approval.
      if p_request->>'explicit_approval' <> 'true'
         or p_request->>'preview_hash' is distinct from v_att->>'previewHash'
         or v_att->>'previewHash' is distinct from v_existing.preview_hash
         or (v_att->>'approvalGeneration')::integer <= v_existing.approval_generation then
        raise exception 'PREVIEW_STALE';
      end if;
      v_is_renewal := true;
      v_dispatch := 1;
      update public.tenant_provisioning_requests
        set approval_generation=(v_att->>'approvalGeneration')::integer
        where tenant_id=v_tenant;
    else
      if (v_att->>'approvalGeneration')::integer is distinct from v_existing.approval_generation then
        raise exception 'provisioning denied' using errcode='42501';
      end if;
      v_dispatch := v_invite.dispatch_generation+1;
    end if;
    v_reservation := gen_random_uuid();
    update public.tenant_provisioning_invites
      set revoked_token_hash=nullif(token_hash,''), token_hash=v_token_hash,
          reservation_id=v_reservation, dispatch_generation=v_dispatch,
          approval_generation=(v_att->>'approvalGeneration')::integer,
          outcome=null, updated_at=statement_timestamp()
      where tenant_id=v_tenant;
    insert into public.audit_events(tenant_id,actor_user_id,command,event_type,target_type,target_id,correlation_id,metadata)
      values(v_tenant,v_actor,'provisioning.invite','first_admin_invite_reserved','tenant',v_tenant,v_reservation,
        jsonb_build_object('dispatchGeneration',v_dispatch,'approvalGeneration',(v_att->>'approvalGeneration')::integer,'renewal',v_is_renewal));
    return jsonb_build_object('tenantId',v_tenant,'normalizedEmail',v_invite.normalized_email,'membershipId',v_invite.membership_id,
      'reservationId',v_reservation,'dispatchGeneration',v_dispatch,'role','tenant_admin','expiresAt',v_invite.expires_at,
      'requestId',v_att->>'requestId','requestHash',v_att->>'requestHash','organizationNumber',v_att->>'organizationNumber',
      'previewHash',v_att->>'previewHash','baselineId',v_att->>'baselineId','baselineVersion',v_att->>'baselineVersion',
      'baselineContentHash',v_att->>'baselineContentHash');
  end if;
  if v_att->>'reservationId' is distinct from v_invite.reservation_id::text
     or (v_att->>'dispatchGeneration')::integer is distinct from v_invite.dispatch_generation
     or (v_att->>'approvalGeneration')::integer is distinct from v_invite.approval_generation then
    raise exception 'provisioning denied' using errcode='42501';
  end if;
  v_state := case p_action when 'record_requested' then 'first_admin_invite_requested' when 'record_unknown' then 'first_admin_invite_unknown' else 'first_admin_invite_failed' end;
  update public.tenant_provisioning_invites set outcome=replace(p_action,'record_',''),updated_at=statement_timestamp() where tenant_id=v_tenant;
  update public.tenants set provisioning_state=v_state where id=v_tenant;
  update public.tenant_provisioning_requests set provisioning_state=v_state where tenant_id=v_tenant;
  insert into public.audit_events(tenant_id,actor_user_id,command,event_type,target_type,target_id,correlation_id,metadata)
    values(v_tenant,v_actor,'provisioning.invite','first_admin_invite_transition','tenant',v_tenant,v_invite.reservation_id,
      jsonb_build_object('dispatchGeneration',v_invite.dispatch_generation,'approvalGeneration',v_invite.approval_generation,'outcome',replace(p_action,'record_','')));
  return jsonb_build_object('tenantId',v_tenant,'provisioningState',v_state,'attemptNumber',v_invite.dispatch_generation,'reconciliationAction','recorded');
exception when unique_violation then raise exception 'ALREADY_PROVISIONED'; end $$;

alter function public.provision_tenant(text,jsonb) owner to provisioning_function_owner;
revoke all on function public.provision_tenant(text,jsonb) from public, anon, authenticator, service_role;
grant execute on function public.provision_tenant(text,jsonb) to authenticated;
