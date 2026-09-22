-- Decision 8A retry orchestration needs durable, non-secret facts before it
-- can mint a reserve attestation. Keep that read inside the existing sole
-- provisioning RPC: it remains normal-JWT platform-authorized, performs no
-- mutation, and never returns an invitation token, signature, or Vault value.
do $migration$
declare
  v_definition text;
  v_old text := $old$
  if v_actor is null or not public.is_platform_operator()
     or p_action not in ('provision','reserve_dispatch','record_requested','record_unknown','record_failed')
     or v_att is null or v_signature !~ '^[0-9a-f]{64}$' then
    raise exception 'provisioning denied' using errcode='42501';
  end if;
  begin
$old$;
  v_new text := $new$
  if v_actor is null
     or not public.is_platform_operator()
     or p_action not in ('provision','reconcile','reserve_dispatch','record_requested','record_unknown','record_failed') then
    raise exception 'provisioning denied' using errcode='42501';
  end if;

  if p_action = 'reconcile' then
    begin
      v_tenant := (p_request->>'tenant_id')::uuid;
    exception when others then
      raise exception 'provisioning denied' using errcode='42501';
    end;
    select * into v_invite
      from public.tenant_provisioning_invites
      where tenant_id = v_tenant;
    select * into v_existing
      from public.tenant_provisioning_requests
      where tenant_id = v_tenant;
    select t.normalized_organization_number into v_org
      from public.tenants t where t.id = v_tenant;
    select b.* into v_baseline
      from public.tenant_provisioning_baselines b
      join public.tenants t on t.provisioning_baseline_id = b.baseline_id
        and t.provisioning_baseline_version = b.version
        and t.provisioning_baseline_content_hash = b.content_hash
      where t.id = v_tenant;
    if not found or v_invite.tenant_id is null or v_existing.tenant_id is null or v_org is null then
      raise exception 'provisioning denied' using errcode='42501';
    end if;
    return jsonb_build_object(
      'tenantId', v_tenant,
      'requestId', v_existing.request_id,
      'requestHash', v_existing.canonical_request_hash,
      'organizationNumber', v_org,
      'previewHash', v_existing.preview_hash,
      'baselineId', v_baseline.baseline_id,
      'baselineVersion', v_baseline.version,
      'baselineContentHash', v_baseline.content_hash,
      'approvalGeneration', v_existing.approval_generation,
      'dispatchGeneration', v_invite.dispatch_generation
    );
  end if;

  if v_att is null or v_signature !~ '^[0-9a-f]{64}$' then
    raise exception 'provisioning denied' using errcode='42501';
  end if;
  begin
$new$;
begin
  select pg_get_functiondef('public.provision_tenant(text,jsonb)'::regprocedure)
    into v_definition;
  if position(v_old in v_definition) = 0 then
    raise exception 'expected provisioning attestation gate is absent';
  end if;
  execute replace(v_definition, v_old, v_new);
end $migration$;

alter function public.provision_tenant(text,jsonb) owner to provisioning_function_owner;
revoke all on function public.provision_tenant(text,jsonb) from public, anon, authenticator, service_role;
grant execute on function public.provision_tenant(text,jsonb) to authenticated;
