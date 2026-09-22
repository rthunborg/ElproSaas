-- Exact private dependencies of the sole provisioning function owner. No JWT
-- role receives either schema access or execution on the payload constructor.
grant usage on schema extensions to provisioning_function_owner;
grant usage on schema auth to provisioning_function_owner;
grant execute on function public.provisioning_attestation_payload(text,uuid,uuid,text,text,text,text,integer,text,text,uuid,integer,integer,text,text,text,text) to provisioning_function_owner;
