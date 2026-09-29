-- Repair for already-applied Story 13.1 migrations: the tenant-admin SELECT
-- policy needs a matching table privilege before RLS can evaluate it.
grant select on table public.job_runs to authenticated;
