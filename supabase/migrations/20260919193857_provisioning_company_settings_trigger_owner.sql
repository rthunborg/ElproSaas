-- This trigger is reachable only from the provisioning-request insert inside
-- the sole public provisioning RPC. It must run as that RPC's owner: a normal
-- trigger function is SECURITY INVOKER and otherwise falls back to the caller's
-- authenticated role, which has no company_settings authority for a new tenant.
create or replace function public.apply_provisioned_company_settings()
returns trigger language plpgsql security definer set search_path='' as $$
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
grant usage, create on schema public to provisioning_function_owner;
alter function public.apply_provisioned_company_settings() owner to provisioning_function_owner;
revoke create on schema public from provisioning_function_owner;
revoke all on function public.apply_provisioned_company_settings() from public, anon, authenticated, service_role;
