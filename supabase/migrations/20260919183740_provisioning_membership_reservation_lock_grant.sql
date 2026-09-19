-- `SELECT … FOR UPDATE` on the bound membership takes the same row lock as
-- Epic 11 acceptance, so an old token cannot be accepted while a fresh
-- reservation supersedes it. PostgreSQL requires UPDATE on a column for that
-- lock; the RPC does not otherwise mutate membership status.
grant update(status) on public.tenant_memberships to provisioning_function_owner;
