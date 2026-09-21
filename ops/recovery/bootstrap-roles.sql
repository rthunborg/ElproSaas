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

-- Logical schema restores retain `ALTER FUNCTION ... OWNER TO` statements for
-- the Decision 8A owner, but role dumps deliberately stay out of this isolated
-- recovery target. Create the exact production non-login owner before schema
-- restore and permit only the target's restore principal to transfer ownership.
-- The normal recovery runtime roles never receive this membership.
DO $$
DECLARE
  provisioning_owner record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'provisioning_function_owner'
  ) THEN
    CREATE ROLE provisioning_function_owner
      NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;

  SELECT rolcanlogin, rolinherit, rolsuper, rolcreatedb, rolcreaterole, rolreplication
    INTO provisioning_owner
    FROM pg_roles
   WHERE rolname = 'provisioning_function_owner';
  IF provisioning_owner.rolcanlogin
     OR provisioning_owner.rolinherit
     OR provisioning_owner.rolsuper
     OR provisioning_owner.rolcreatedb
     OR provisioning_owner.rolcreaterole
     OR provisioning_owner.rolreplication THEN
    RAISE EXCEPTION 'provisioning_function_owner is not hardened for isolated recovery';
  END IF;

  IF NOT pg_has_role(
    'supabase_admin',
    'provisioning_function_owner',
    'member'
  ) THEN
    GRANT provisioning_function_owner TO supabase_admin;
  END IF;
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
