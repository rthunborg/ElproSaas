-- Story 12.1 request projection. The approved v1 request contains company and
-- commercial facts; retaining only its hash made those accepted facts disappear
-- after an otherwise successful provision. Keep the original canonical request
-- projection with its tenant/idempotency record, and apply the existing company
-- settings fields in the same transaction.
alter table public.tenant_provisioning_requests
  add column request_payload jsonb not null default '{}'::jsonb,
  add constraint tenant_provisioning_requests_request_payload_object
    check (jsonb_typeof(request_payload) = 'object');

comment on column public.tenant_provisioning_requests.request_payload is
  'Canonical v1 tenant/company/commercial request projection committed atomically by provision_tenant; excludes attestations and invitation tokens.';

grant insert on public.company_settings to provisioning_function_owner;
drop policy if exists provisioning_owner_company_settings on public.company_settings;
create policy provisioning_owner_company_settings
  on public.company_settings for insert to provisioning_function_owner
  with check (true);

create or replace function public.apply_provisioned_company_settings()
returns trigger language plpgsql set search_path='' as $$
begin
  insert into public.company_settings(
    tenant_id, company_name, org_nr, address_line1, address_line2,
    postal_code, city, email, phone
  ) values (
    new.tenant_id,
    new.request_payload->>'legal_name',
    new.request_payload->>'organization_number',
    new.request_payload #>> '{address,address_line1}',
    new.request_payload #>> '{address,address_line2}',
    new.request_payload #>> '{address,postal_code}',
    new.request_payload #>> '{address,city}',
    new.request_payload->>'primary_email',
    new.request_payload->>'phone'
  ) on conflict (tenant_id) do nothing;
  return new;
end $$;

revoke all on function public.apply_provisioned_company_settings() from public, anon, authenticated, service_role;

create trigger tenant_provisioning_requests_apply_company_settings
  after insert on public.tenant_provisioning_requests
  for each row execute function public.apply_provisioned_company_settings();

-- Keep the reviewed Decision 8A function body intact. The only replacement is
-- the atomic initial-request insert, which now carries the request projection
-- consumed by the non-callable trigger above. Fail loudly if a prior migration
-- changed that exact insertion seam.
do $$
declare
  v_definition text;
  v_before text := $body$insert into public.tenant_provisioning_requests(request_id,canonical_request_hash,tenant_id,actor_user_id,preview_hash,baseline_content_hash,provisioning_state,approval_generation)
      values(v_request_id,v_hash,v_tenant,v_actor,v_att->>'previewHash',v_baseline.content_hash,'pending_first_admin_invite',1);$body$;
  v_after text := $body$insert into public.tenant_provisioning_requests(request_id,canonical_request_hash,tenant_id,actor_user_id,preview_hash,baseline_content_hash,provisioning_state,approval_generation,request_payload)
      values(v_request_id,v_hash,v_tenant,v_actor,v_att->>'previewHash',v_baseline.content_hash,'pending_first_admin_invite',1,v_req);$body$;
begin
  select pg_get_functiondef('public.provision_tenant(text,jsonb)'::regprocedure) into v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');
  v_before := replace(v_before, E'\r\n', E'\n');
  v_after := replace(v_after, E'\r\n', E'\n');
  if position(v_before in v_definition) = 0 then
    raise exception 'provision_tenant request persistence seam changed';
  end if;
  execute replace(v_definition, v_before, v_after);
end $$;
