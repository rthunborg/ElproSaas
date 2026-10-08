-- ADR-B012: the CRM command wrappers now own all writes, while audit writes
-- enter through record_audit_event. Remove effective PUBLIC/bootstrap access
-- before restoring their authenticated tenant-scoped read paths. service_role
-- grants, RLS policies, and function authorization remain unchanged.
revoke all privileges on table public.customers, public.facilities, public.contacts
  from public, anon, authenticated;
grant select on table public.customers, public.facilities, public.contacts to authenticated;

revoke all privileges on table public.audit_events from public, anon, authenticated;
grant select on table public.audit_events to authenticated;
