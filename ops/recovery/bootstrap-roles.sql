-- The pinned image creates exactly the three login roles used by this recovery
-- stack: PostgREST (authenticator), GoTrue (supabase_auth_admin), and Storage
-- (supabase_storage_admin). pgbouncer and supabase_functions_admin are not
-- recovery services; the latter is conditional on pg_net, which this target disables.
DO $$
DECLARE
  required_role text;
BEGIN
  FOREACH required_role IN ARRAY ARRAY['authenticator', 'supabase_auth_admin', 'supabase_storage_admin']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = required_role) THEN
      RAISE EXCEPTION 'required isolated recovery runtime role is absent';
    END IF;
  END LOOP;
END
$$;

-- ALTER ROLE is repeatable and keeps the generated recovery credential out of logs.
\set pgpass `echo "$POSTGRES_PASSWORD"`
ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';

-- The image's orchestration normally writes these database settings. Apply them
-- again after the logical restore because a source role/database dump may reset
-- them before PostgREST starts.
\set jwtsecret `echo "$JWT_SECRET"`
ALTER DATABASE postgres SET "app.settings.jwt_secret" TO :'jwtsecret';
ALTER DATABASE postgres SET "app.settings.jwt_exp" TO '3600';
