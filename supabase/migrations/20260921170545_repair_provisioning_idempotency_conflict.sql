-- Story 12.1 AC3: a concurrent loser can reach the function's unique-violation
-- handler before its initial request-id lookup sees the winner. Restore the
-- owner-approved idempotency precedence after that wait: request ID/hash first,
-- canonical organisation identity second. This preserves same-request replay,
-- returns IDEMPOTENCY_CONFLICT for changed content, and reserves
-- ALREADY_PROVISIONED for a different request ID using an existing identity.
do $migration$
declare
  v_definition text;
  v_identity_old text := E'select r.* into v_existing from public.tenant_provisioning_requests r join public.tenants t on t.id=r.tenant_id where t.country_code=''SE'' and t.normalized_organization_number=v_org limit 1;\n    if found then\n      return jsonb_build_object(''resultCode'',''ALREADY_PROVISIONED'',''tenantId'',v_existing.tenant_id,''provisioningState'',v_existing.provisioning_state,''attemptNumber'',(select dispatch_generation from public.tenant_provisioning_invites where tenant_id=v_existing.tenant_id),''reconciliationAction'',''observed'');\n    end if;\n    select * into v_baseline';
  v_identity_new text := E'select r.* into v_existing from public.tenant_provisioning_requests r join public.tenants t on t.id=r.tenant_id where t.country_code=''SE'' and t.normalized_organization_number=v_org limit 1;\n    if found then\n      if v_existing.request_id = v_request_id then\n        if v_existing.canonical_request_hash <> v_hash then raise exception ''IDEMPOTENCY_CONFLICT''; end if;\n        return jsonb_build_object(''resultCode'',''REPLAYED'',''tenantId'',v_existing.tenant_id,''provisioningState'',v_existing.provisioning_state,''attemptNumber'',(select dispatch_generation from public.tenant_provisioning_invites where tenant_id=v_existing.tenant_id),''reconciliationAction'',''observed'');\n      end if;\n      return jsonb_build_object(''resultCode'',''ALREADY_PROVISIONED'',''tenantId'',v_existing.tenant_id,''provisioningState'',v_existing.provisioning_state,''attemptNumber'',(select dispatch_generation from public.tenant_provisioning_invites where tenant_id=v_existing.tenant_id),''reconciliationAction'',''observed'');\n    end if;\n    select * into v_baseline';
  v_old text := E'exception when unique_violation then\n  select r.* into v_existing from public.tenant_provisioning_requests r join public.tenants t on t.id=r.tenant_id where t.country_code=''SE'' and t.normalized_organization_number=v_org limit 1;\n  if found then\n    return jsonb_build_object(''resultCode'',''ALREADY_PROVISIONED'',''tenantId'',v_existing.tenant_id,''provisioningState'',v_existing.provisioning_state,''attemptNumber'',(select dispatch_generation from public.tenant_provisioning_invites where tenant_id=v_existing.tenant_id),''reconciliationAction'',''observed'');\n  end if;\n  raise;';
  v_new text := E'exception when unique_violation then\n  select r.* into v_existing from public.tenant_provisioning_requests r where r.request_id=v_request_id for update;\n  if found then\n    if v_existing.canonical_request_hash <> v_hash then raise exception ''IDEMPOTENCY_CONFLICT''; end if;\n    return jsonb_build_object(''resultCode'',''REPLAYED'',''tenantId'',v_existing.tenant_id,''provisioningState'',v_existing.provisioning_state,''attemptNumber'',(select dispatch_generation from public.tenant_provisioning_invites where tenant_id=v_existing.tenant_id),''reconciliationAction'',''observed'');\n  end if;\n  select r.* into v_existing from public.tenant_provisioning_requests r join public.tenants t on t.id=r.tenant_id where t.country_code=''SE'' and t.normalized_organization_number=v_org limit 1;\n  if found then\n    return jsonb_build_object(''resultCode'',''ALREADY_PROVISIONED'',''tenantId'',v_existing.tenant_id,''provisioningState'',v_existing.provisioning_state,''attemptNumber'',(select dispatch_generation from public.tenant_provisioning_invites where tenant_id=v_existing.tenant_id),''reconciliationAction'',''observed'');\n  end if;\n  raise;';
begin
  select pg_get_functiondef('public.provision_tenant(text,jsonb)'::regprocedure)
    into v_definition;
  if position(v_identity_old in v_definition) = 0 then
    raise exception 'provision_tenant identity-conflict seam changed';
  end if;
  v_definition := replace(v_definition, v_identity_old, v_identity_new);
  if position(v_old in v_definition) = 0 then
    raise exception 'provision_tenant unique-conflict seam changed';
  end if;
  execute replace(v_definition, v_old, v_new);
end $migration$;

alter function public.provision_tenant(text,jsonb) owner to provisioning_function_owner;
revoke all on function public.provision_tenant(text,jsonb) from public, anon, authenticator, service_role;
grant execute on function public.provision_tenant(text,jsonb) to authenticated;
