-- The sole provisioning SECURITY DEFINER function inserts a tenant and returns
-- its generated id. PostgreSQL requires column SELECT privilege for RETURNING.
grant select(id) on public.tenants to provisioning_function_owner;
