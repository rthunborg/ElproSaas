-- The provisioning RPC inserts the first membership and returns its generated
-- id. Keep this column privilege confined to its non-login function owner.
grant select(id) on public.tenant_memberships to provisioning_function_owner;
