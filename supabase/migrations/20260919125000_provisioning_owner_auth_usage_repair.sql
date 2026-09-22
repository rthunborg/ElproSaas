-- Reassert the exact schema privilege after local role ownership migration.
grant usage on schema auth to provisioning_function_owner;
