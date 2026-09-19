-- auth.uid() is an existing executable dependency; schema USAGE is required
-- for the non-login function owner to resolve it. No Auth table access is granted.
grant usage on schema auth to provisioning_function_owner;
