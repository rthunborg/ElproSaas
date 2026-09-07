-- Story 11.1 deployment follow-up: hosted default ACLs can grant privileges
-- directly to API roles. Revoking PUBLIC alone does not remove those grants.
-- Normalize only these two objects; leave project-wide defaults unchanged.
revoke all privileges on table public.membership_roles
  from public, anon, authenticated, service_role;
grant select on table public.membership_roles to authenticated;
grant select, insert, update, delete on table public.membership_roles to service_role;

revoke all privileges on function public.has_tenant_role(uuid, text[])
  from public, anon, authenticated, service_role;
grant execute on function public.has_tenant_role(uuid, text[])
  to authenticated, service_role;
