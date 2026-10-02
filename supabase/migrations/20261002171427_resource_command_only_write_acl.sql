-- Resource records are read through tenant-scoped RLS, while all mutations go through
-- checked SECURITY DEFINER RPCs so profile/schedule/calendar changes remain auditable.
revoke insert, update on table public.person_profiles, public.person_work_hours, public.tenant_calendar_days from authenticated;

drop policy if exists person_profiles_resource_insert on public.person_profiles;
drop policy if exists person_profiles_resource_update on public.person_profiles;
drop policy if exists person_work_hours_resource_insert on public.person_work_hours;
drop policy if exists person_work_hours_resource_update on public.person_work_hours;
drop policy if exists tenant_calendar_days_resource_insert on public.tenant_calendar_days;
drop policy if exists tenant_calendar_days_resource_update on public.tenant_calendar_days;