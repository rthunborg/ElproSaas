-- ADR-B012 owner-approved successor repair. Keep every unrelated ACL, RLS
-- policy, wrapper, and product behavior intact.
revoke execute on function public.create_quote_version_from_calculation(uuid, uuid, timestamptz, uuid, uuid) from service_role;
revoke execute on function public.mark_quote_version_lifecycle(uuid, uuid, text, timestamptz, uuid, uuid) from service_role;

revoke update on table public.tenant_memberships from authenticated;
grant update (onboarding_checklist_dismissed_at) on table public.tenant_memberships to authenticated;
