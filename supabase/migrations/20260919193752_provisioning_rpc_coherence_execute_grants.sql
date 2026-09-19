-- The sole SECURITY DEFINER RPC executes as provisioning_function_owner. The
-- v2 attestation and canonical-catalogue helpers remain private to that owner;
-- revoking PUBLIC without this explicit grant caused the RPC itself to fail
-- before it could verify a valid HMAC.
grant execute on function public.provisioning_attestation_payload_v2(
  text,uuid,uuid,text,text,text,text,boolean,text,integer,text,text,uuid,integer,integer,text,text,text,text
) to provisioning_function_owner;
grant execute on function public.provisioning_baseline_canonical_json(jsonb)
  to provisioning_function_owner;
