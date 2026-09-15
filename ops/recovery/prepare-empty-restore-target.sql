-- Refuse to remove image-provided schemas unless this is the expected empty,
-- isolated target. Extensions and platform roles intentionally remain in place.
DO $$
DECLARE
  relation_name text;
  has_rows boolean;
BEGIN
  IF current_database() <> 'postgres' THEN
    RAISE EXCEPTION 'Recovery target database identity is invalid';
  END IF;
  FOREACH relation_name IN ARRAY ARRAY['auth.users', 'storage.objects', 'public.tenants'] LOOP
    IF to_regclass(relation_name) IS NOT NULL THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s LIMIT 1)', relation_name) INTO has_rows;
      IF has_rows THEN RAISE EXCEPTION 'Recovery target is not empty'; END IF;
    END IF;
  END LOOP;
END
$$;

DROP SCHEMA IF EXISTS supabase_migrations CASCADE;
DROP SCHEMA IF EXISTS storage CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
