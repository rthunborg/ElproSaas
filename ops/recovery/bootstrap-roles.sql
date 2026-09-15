-- The base image supplies Supabase roles. The self-hosted orchestration sets
-- matching login passwords at first init so Auth, REST, and Storage can connect.
\set pgpass `echo "$POSTGRES_PASSWORD"`
ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER pgbouncer WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_functions_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';

-- The image's orchestration normally writes these database settings. Apply them
-- again after the logical restore because a source role/database dump may reset
-- them before PostgREST starts.
\set jwtsecret `echo "$JWT_SECRET"`
ALTER DATABASE postgres SET "app.settings.jwt_secret" TO :'jwtsecret';
ALTER DATABASE postgres SET "app.settings.jwt_exp" TO '3600';
