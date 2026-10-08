-- ADR-B012: Quote follow-up writes must enter through checked/audited command
-- wrappers. Remove every inherited table privilege before restoring the narrow
-- authenticated read capability. service_role DML and function grants are
-- intentionally unchanged.
revoke all privileges on table public.quote_follow_ups from public, anon, authenticated;
grant select on table public.quote_follow_ups to authenticated;
