-- Adapted from Supabase's official self-hosted Docker roles initialization.
-- The guarded test stack supplies POSTGRES_PASSWORD from its ignored .env file.
\set pgpass `echo "$POSTGRES_PASSWORD"`

SELECT format('ALTER USER %I WITH PASSWORD %L;', rolname, :'pgpass')
FROM pg_roles
WHERE rolname IN (
  'authenticator',
  'pgbouncer',
  'supabase_auth_admin',
  'supabase_functions_admin',
  'supabase_storage_admin'
)
\gexec
