-- The function-owner role intentionally has no Vault schema privilege. A
-- private, filtered reader owned by the migration owner supplies only the
-- named current/previous provisioning keys to the sole provisioning writer.
create or replace function public.provisioning_attestation_secret(p_key_id text)
returns text language sql stable security definer set search_path='' as $$
 select ds.decrypted_secret from vault.decrypted_secrets ds
  where ds.name in (
    'tenant_provisioning_attestation_' || p_key_id,
    'tenant_provisioning_attestation_previous_' || p_key_id
  )
 order by case when ds.name = 'tenant_provisioning_attestation_' || p_key_id then 0 else 1 end
 limit 1
$$;
alter function public.provisioning_attestation_secret(text) owner to postgres;
revoke all on function public.provisioning_attestation_secret(text) from public, anon, authenticated, service_role;
grant execute on function public.provisioning_attestation_secret(text) to provisioning_function_owner;
