-- Story 12.3: only a presentation timestamp is durable. Checklist completion stays a server projection.
alter table public.tenant_memberships
  add column if not exists onboarding_checklist_dismissed_at timestamptz;

-- Do not reopen membership lifecycle management: authenticated callers can update only this column.
grant update (onboarding_checklist_dismissed_at) on public.tenant_memberships to authenticated;

create policy tenant_memberships_update_own_onboarding_dismissal
  on public.tenant_memberships
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and status = 'active'
    and role = 'tenant_admin'
    and public.is_tenant_admin(tenant_id)
  )
  with check (
    user_id = (select auth.uid())
    and status = 'active'
    and role = 'tenant_admin'
    and public.is_tenant_admin(tenant_id)
  );

-- Every presentation-state mutation is attributable while role/status/tenant facts remain protected by column grants.
create or replace function public.audit_onboarding_checklist_dismissal()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.onboarding_checklist_dismissed_at is distinct from old.onboarding_checklist_dismissed_at then
    insert into public.audit_events(tenant_id, actor_user_id, command, event_type, target_type, target_id, correlation_id, metadata)
    values (new.tenant_id, (select auth.uid()), 'onboarding.checklist_presentation', 'onboarding_checklist_presentation_changed', 'tenant_membership', new.id, gen_random_uuid(), jsonb_build_object('dismissed', new.onboarding_checklist_dismissed_at is not null));
  end if;
  return new;
end;
$$;
revoke all on function public.audit_onboarding_checklist_dismissal() from public;
create trigger tenant_memberships_audit_onboarding_checklist_dismissal
  after update of onboarding_checklist_dismissed_at on public.tenant_memberships
  for each row execute function public.audit_onboarding_checklist_dismissal();
