-- Story 12.1 coherence remediation. The database catalogue uses one compact,
-- recursively key-sorted JSON representation, mirrored by
-- src/server/provisioning/baselines.ts. The catalogue's hash is authoritative
-- at execution time; TypeScript is a preview mirror only.
create or replace function public.provisioning_baseline_canonical_json(p_value jsonb)
returns text language plpgsql immutable set search_path='' as $$
declare
  v_kind text := jsonb_typeof(p_value);
  v_result text;
begin
  if v_kind in ('null', 'boolean', 'number', 'string') then
    return p_value::text;
  end if;
  if v_kind = 'array' then
    select '[' || coalesce(string_agg(public.provisioning_baseline_canonical_json(value), ',' order by ordinality), '') || ']'
      into v_result
      from jsonb_array_elements(p_value) with ordinality;
    return v_result;
  end if;
  if v_kind = 'object' then
    select '{' || coalesce(string_agg(to_jsonb(key)::text || ':' || public.provisioning_baseline_canonical_json(value), ',' order by key collate "C"), '') || '}'
      into v_result
      from jsonb_each(p_value);
    return v_result;
  end if;
  raise exception 'invalid provisioning baseline content';
end $$;
revoke all on function public.provisioning_baseline_canonical_json(jsonb) from public, anon, authenticated, service_role;

-- Existing published rows retain their immutable content while adopting the
-- canonical hash. Related durable copies are updated atomically so same-ID
-- reconciliation continues to read the catalogue actually recorded by tenant.
update public.tenant_provisioning_baselines
  set content_hash = encode(extensions.digest(convert_to(public.provisioning_baseline_canonical_json(canonical_content), 'UTF8'), 'sha256'), 'hex');
update public.tenants t
  set provisioning_baseline_content_hash = b.content_hash
  from public.tenant_provisioning_baselines b
  where (t.provisioning_baseline_id, t.provisioning_baseline_version) = (b.baseline_id, b.version);
update public.tenant_provisioning_requests r
  set baseline_content_hash = t.provisioning_baseline_content_hash
  from public.tenants t
  where r.tenant_id = t.id
    and t.provisioning_baseline_content_hash is not null;

-- V2 adds the server-derived canonical first-admin email and explicit approval
-- to the length-prefixed HMAC envelope. Keep v1 private for existing historical
-- rows; the sole RPC below accepts only this v2 payload.
create or replace function public.provisioning_attestation_payload_v2(
  p_action text,p_actor uuid,p_request_id uuid,p_request_hash text,p_org text,p_preview_hash text,
  p_first_admin_email text,p_explicit_approval boolean,p_baseline_id text,p_baseline_version integer,
  p_baseline_hash text,p_token_hash text,p_reservation uuid,p_dispatch integer,p_approval integer,
  p_outcome text,p_key_id text,p_issued text,p_expires text
) returns bytea language plpgsql immutable set search_path='' as $$
declare v text; v_result bytea := ''::bytea;
begin
  foreach v in array array[
    'elpro.provisioning.attestation.v1',p_action,p_actor::text,p_request_id::text,p_request_hash,p_org,p_preview_hash,
    p_first_admin_email,case when p_explicit_approval then 'true' else 'false' end,p_baseline_id,p_baseline_version::text,
    p_baseline_hash,p_token_hash,coalesce(p_reservation::text,''),p_dispatch::text,p_approval::text,p_outcome,p_key_id,p_issued,p_expires
  ] loop
    v_result := v_result || convert_to(octet_length(convert_to(coalesce(v,''),'UTF8'))::text || ':' || coalesce(v,''),'UTF8');
  end loop;
  return v_result;
end $$;
revoke all on function public.provisioning_attestation_payload_v2(text,uuid,uuid,text,text,text,text,boolean,text,integer,text,text,uuid,integer,integer,text,text,text,text) from public, anon, authenticated, service_role;

-- Do not hand-copy another long-lived authority surface. Rewrite the existing
-- sole RPC definition in place, guarding every replacement so a changed prior
-- migration fails loudly at migration time.
do $migration$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.provision_tenant(text,jsonb)'::regprocedure) into v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');

  v_old := 'public.provisioning_attestation_payload(';
  v_new := 'public.provisioning_attestation_payload_v2(';
  if position(v_old in v_definition) = 0 then raise exception 'provisioning RPC v1 payload call is absent'; end if;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := 'v_att->>''previewHash'',v_att->>''baselineId'',(v_att->>''baselineVersion'')::integer,';
  v_new := 'v_att->>''previewHash'',v_att->>''firstAdminEmail'',(v_att->>''explicitApproval'')::boolean,v_att->>''baselineId'',(v_att->>''baselineVersion'')::integer,';
  if position(v_old in v_definition) = 0 then raise exception 'provisioning RPC v1 payload fields are absent'; end if;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := E'or v_att->>''actorUserId'' is distinct from v_actor::text\n     or v_issued';
  v_new := E'or v_att->>''actorUserId'' is distinct from v_actor::text\n     or jsonb_typeof(v_att->''explicitApproval'') is distinct from ''boolean''\n     or v_issued';
  if position(v_old in v_definition) = 0 then raise exception 'provisioning RPC attestation gate is absent'; end if;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := 'if v_req is null or p_request->>''explicit_approval'' <> ''true'' then raise exception ''provisioning denied'' using errcode=''42501''; end if;';
  v_new := 'if v_req is null or p_request->>''explicit_approval'' <> ''true'' or v_att->>''explicitApproval'' <> ''true'' or nullif(v_att->>''firstAdminEmail'','''') is null then raise exception ''provisioning denied'' using errcode=''42501''; end if;';
  if position(v_old in v_definition) = 0 then raise exception 'provision explicit approval gate is absent'; end if;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := E'if p_request->>''explicit_approval'' <> ''true''\n         or p_request->>''preview_hash'' is distinct from v_att->>''previewHash''';
  v_new := E'if p_request->>''explicit_approval'' <> ''true''\n         or v_att->>''explicitApproval'' <> ''true''\n         or p_request->>''preview_hash'' is distinct from v_att->>''previewHash''';
  if position(v_old in v_definition) = 0 then raise exception 'renewal explicit approval gate is absent'; end if;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := 'lower(v_req->>''first_admin_email'')';
  v_new := 'v_att->>''firstAdminEmail''';
  if position(v_old in v_definition) = 0 then raise exception 'first-admin email persistence is absent'; end if;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := E'if not found then raise exception ''PREVIEW_STALE''; end if;\n    insert into public.tenants';
  v_new := E'if not found\n       or v_baseline.content_hash is distinct from encode(extensions.digest(convert_to(public.provisioning_baseline_canonical_json(v_baseline.canonical_content), ''UTF8''), ''sha256''), ''hex'')\n       or v_baseline.canonical_content->>''id'' is distinct from v_baseline.baseline_id\n       or v_baseline.canonical_content->>''version'' is distinct from v_baseline.version::text then raise exception ''PREVIEW_STALE''; end if;\n    insert into public.tenants';
  if position(v_old in v_definition) = 0 then raise exception 'catalogue execution check is absent'; end if;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := E'return jsonb_build_object(''tenantId'',v_existing.tenant_id,''provisioningState'',v_existing.provisioning_state,''reconciliationAction'',''observed'');\n    end if;\n    select * into v_baseline';
  v_new := E'return jsonb_build_object(''resultCode'',''REPLAYED'',''tenantId'',v_existing.tenant_id,''provisioningState'',v_existing.provisioning_state,''attemptNumber'',(select dispatch_generation from public.tenant_provisioning_invites where tenant_id=v_existing.tenant_id),''reconciliationAction'',''observed'');\n    end if;\n    select r.* into v_existing from public.tenant_provisioning_requests r join public.tenants t on t.id=r.tenant_id where t.country_code=''SE'' and t.normalized_organization_number=v_org limit 1;\n    if found then\n      return jsonb_build_object(''resultCode'',''ALREADY_PROVISIONED'',''tenantId'',v_existing.tenant_id,''provisioningState'',v_existing.provisioning_state,''attemptNumber'',(select dispatch_generation from public.tenant_provisioning_invites where tenant_id=v_existing.tenant_id),''reconciliationAction'',''observed'');\n    end if;\n    select * into v_baseline';
  if position(v_old in v_definition) = 0 then raise exception 'provisioning replay result seam is absent'; end if;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := 'exception when unique_violation then raise exception ''ALREADY_PROVISIONED'';';
  v_new := E'exception when unique_violation then\n  select r.* into v_existing from public.tenant_provisioning_requests r join public.tenants t on t.id=r.tenant_id where t.country_code=''SE'' and t.normalized_organization_number=v_org limit 1;\n  if found then\n    return jsonb_build_object(''resultCode'',''ALREADY_PROVISIONED'',''tenantId'',v_existing.tenant_id,''provisioningState'',v_existing.provisioning_state,''attemptNumber'',(select dispatch_generation from public.tenant_provisioning_invites where tenant_id=v_existing.tenant_id),''reconciliationAction'',''observed'');\n  end if;\n  raise;';
  if position(v_old in v_definition) = 0 then raise exception 'provisioning unique identity result seam is absent'; end if;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := '''tenantId'',v_tenant,''requestId'',v_existing.request_id,''requestHash'',v_existing.canonical_request_hash,';
  v_new := '''resultCode'',''RECONCILED'',''tenantId'',v_tenant,''provisioningState'',v_existing.provisioning_state,''attemptNumber'',v_invite.dispatch_generation,''reconciliationAction'',''observed'',''requestId'',v_existing.request_id,''requestHash'',v_existing.canonical_request_hash,';
  if position(v_old in v_definition) = 0 then raise exception 'reconciliation result seam is absent'; end if;
  v_definition := replace(v_definition, v_old, v_new);

  execute v_definition;
end $migration$;

-- The ready projection must compare two canonical stored values. Provisioning
-- persists the HMAC-bound email above; the Auth email is trimmed/lowercased
-- before comparison, preserving the product policy's plus-addressing.
create or replace function public.project_provisioning_ready()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.status = 'active' and new.user_id is not null and exists (
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

alter function public.provision_tenant(text,jsonb) owner to provisioning_function_owner;
revoke all on function public.provision_tenant(text,jsonb) from public, anon, authenticator, service_role;
grant execute on function public.provision_tenant(text,jsonb) to authenticated;
