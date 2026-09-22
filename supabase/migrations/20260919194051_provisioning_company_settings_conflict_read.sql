-- `ON CONFLICT (tenant_id) DO NOTHING` probes the unique index and therefore
-- also needs the owner to read the target relation under FORCE RLS.
grant select on public.company_settings to provisioning_function_owner;
drop policy if exists provisioning_owner_company_settings_select on public.company_settings;
create policy provisioning_owner_company_settings_select
  on public.company_settings for select to provisioning_function_owner
  using (true);
