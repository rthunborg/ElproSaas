-- Story 12.3 review hardening: direct Data API dismissal is valid only for ready tenants.
drop policy if exists tenant_memberships_update_own_onboarding_dismissal on public.tenant_memberships;
create policy tenant_memberships_update_own_onboarding_dismissal
  on public.tenant_memberships for update to authenticated
  using (user_id=(select auth.uid()) and status='active' and role='tenant_admin'
    and public.is_tenant_admin(tenant_id)
    and exists (select 1 from public.tenants t where t.id=tenant_id and t.provisioning_state='ready'))
  with check (user_id=(select auth.uid()) and status='active' and role='tenant_admin'
    and public.is_tenant_admin(tenant_id)
    and exists (select 1 from public.tenants t where t.id=tenant_id and t.provisioning_state='ready'));
