-- Story 14.1: resource records are tenant-scoped scheduling inputs. They deliberately
-- contain no booking, assignment, recurrence, or optimisation state.
do $$ begin
  alter table public.work_roles add constraint work_roles_id_tenant_unique unique (id, tenant_id);
exception when duplicate_object then null; end $$;
create table public.person_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  membership_id uuid not null,
  default_work_role_id uuid,
  employment_percentage smallint check (employment_percentage between 1 and 100),
  archived_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (membership_id), unique (id, tenant_id),
  foreign key (membership_id, tenant_id) references public.tenant_memberships(id, tenant_id) on delete restrict,
  foreign key (default_work_role_id, tenant_id) references public.work_roles(id, tenant_id) on delete restrict
);

create table public.person_work_hours (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  person_profile_id uuid,
  entry_kind text not null check (entry_kind in ('weekly_shift','weekly_break','exception')),
  weekday smallint check (weekday between 1 and 7),
  local_date date,
  exception_kind text check (exception_kind in ('absence','sick_leave','leave','training','blocked_time')),
  starts_at time,
  ends_at time,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (id, tenant_id),
  foreign key (person_profile_id, tenant_id) references public.person_profiles(id, tenant_id) on delete restrict,
  check ((starts_at is null and ends_at is null) or (starts_at is not null and ends_at is not null and starts_at < ends_at)),
  check (
    (person_profile_id is null and entry_kind in ('weekly_shift', 'weekly_break') and weekday is not null and local_date is null and exception_kind is null)
    or (person_profile_id is not null and ((entry_kind in ('weekly_shift', 'weekly_break') and weekday is not null and local_date is null and exception_kind is null)
      or (entry_kind = 'exception' and weekday is null and local_date is not null and exception_kind is not null))
  )
);

create table public.tenant_calendar_days (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  local_date date not null,
  variant text not null check (variant in ('closed','reduced_capacity')),
  reduction_percent smallint,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, local_date), unique (id, tenant_id),
  check ((variant = 'closed' and reduction_percent is null) or (variant = 'reduced_capacity' and reduction_percent between 1 and 100))
);
create index person_profiles_tenant_membership_idx on public.person_profiles(tenant_id, membership_id);
create index person_work_hours_profile_idx on public.person_work_hours(tenant_id, person_profile_id, local_date, weekday);

alter table public.person_profiles enable row level security;
alter table public.person_profiles force row level security;
alter table public.person_work_hours enable row level security;
alter table public.person_work_hours force row level security;
alter table public.tenant_calendar_days enable row level security;
alter table public.tenant_calendar_days force row level security;
grant select, insert, update on public.person_profiles, public.person_work_hours, public.tenant_calendar_days to authenticated;
revoke all on public.person_profiles, public.person_work_hours, public.tenant_calendar_days from anon;
create policy person_profiles_resource_read on public.person_profiles for select to authenticated using (public.has_tenant_role(tenant_id, array['tenant_admin','projektledare']));
create policy person_profiles_resource_insert on public.person_profiles for insert to authenticated with check (public.has_tenant_role(tenant_id, array['tenant_admin','projektledare']));
create policy person_profiles_resource_update on public.person_profiles for update to authenticated using (public.has_tenant_role(tenant_id, array['tenant_admin','projektledare'])) with check (public.has_tenant_role(tenant_id, array['tenant_admin','projektledare']));
create policy person_work_hours_resource_read on public.person_work_hours for select to authenticated using (public.has_tenant_role(tenant_id, array['tenant_admin','projektledare']));
create policy person_work_hours_resource_insert on public.person_work_hours for insert to authenticated with check (public.has_tenant_role(tenant_id, array['tenant_admin','projektledare']));
create policy person_work_hours_resource_update on public.person_work_hours for update to authenticated using (public.has_tenant_role(tenant_id, array['tenant_admin','projektledare'])) with check (public.has_tenant_role(tenant_id, array['tenant_admin','projektledare']));
create policy tenant_calendar_days_resource_read on public.tenant_calendar_days for select to authenticated using (public.has_tenant_role(tenant_id, array['tenant_admin','projektledare']));
create policy tenant_calendar_days_resource_insert on public.tenant_calendar_days for insert to authenticated with check (public.has_tenant_role(tenant_id, array['tenant_admin','projektledare']));
create policy tenant_calendar_days_resource_update on public.tenant_calendar_days for update to authenticated using (public.has_tenant_role(tenant_id, array['tenant_admin','projektledare'])) with check (public.has_tenant_role(tenant_id, array['tenant_admin','projektledare']));

-- Direct table writes remain RLS-gated for entitled maintainers, so integrity has
-- to live in the database as well as the command validator. A break must be
-- contained by one shift and neither shifts nor breaks may overlap on a weekday.
create or replace function public.validate_person_work_hour() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.entry_kind = 'weekly_shift' and exists (
    select 1 from public.person_work_hours existing
    where existing.id <> new.id and existing.tenant_id = new.tenant_id
      and existing.person_profile_id is not distinct from new.person_profile_id
      and existing.entry_kind = 'weekly_shift' and existing.weekday = new.weekday
      and existing.starts_at < new.ends_at and new.starts_at < existing.ends_at
  ) then raise exception 'overlapping weekly shifts' using errcode = '23514'; end if;
  if new.entry_kind = 'weekly_break' and (
    not exists (
      select 1 from public.person_work_hours shift
      where shift.tenant_id = new.tenant_id and shift.person_profile_id is not distinct from new.person_profile_id
        and shift.entry_kind = 'weekly_shift' and shift.weekday = new.weekday
        and shift.starts_at <= new.starts_at and shift.ends_at >= new.ends_at
    ) or exists (
      select 1 from public.person_work_hours existing
      where existing.id <> new.id and existing.tenant_id = new.tenant_id
        and existing.person_profile_id is not distinct from new.person_profile_id
        and existing.entry_kind = 'weekly_break' and existing.weekday = new.weekday
        and existing.starts_at < new.ends_at and new.starts_at < existing.ends_at
    )
  ) then raise exception 'invalid weekly break' using errcode = '23514'; end if;
  if new.entry_kind = 'exception' and exists (
    select 1 from public.person_work_hours existing
    where existing.id <> new.id and existing.tenant_id = new.tenant_id
      and existing.person_profile_id = new.person_profile_id and existing.entry_kind = 'exception'
      and existing.local_date = new.local_date and (
        existing.starts_at is null or new.starts_at is null
        or (existing.starts_at < new.ends_at and new.starts_at < existing.ends_at)
      )
  ) then raise exception 'overlapping exceptions' using errcode = '23514'; end if;
  return new;
end $$;
create trigger person_work_hours_validate
  before insert or update on public.person_work_hours
  for each row execute function public.validate_person_work_hour();

-- The schedule replacement and its audit record commit in one checked transaction.
create or replace function public.save_person_schedule_with_audit(
  p_tenant_id uuid, p_actor_user_id uuid, p_correlation_id uuid,
  p_person_profile_id uuid, p_schedule jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_profile public.person_profiles; v_shift jsonb; v_break jsonb; v_other jsonb; v_first_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_actor_user_id or not public.has_tenant_role(p_tenant_id, array['tenant_admin','projektledare']) then
    raise exception 'resource schedule denied' using errcode = '42501';
  end if;
  select * into v_profile from public.person_profiles where id = p_person_profile_id and tenant_id = p_tenant_id for update;
  if not found then raise exception 'resource schedule denied' using errcode = '42501'; end if;
  if jsonb_typeof(p_schedule) <> 'array' then raise exception 'resource schedule invalid' using errcode = '23514'; end if;
  for v_shift in select value from jsonb_array_elements(p_schedule) loop
    if jsonb_typeof(v_shift) <> 'object'
      or (v_shift->>'weekday') !~ '^[1-7]$'
      or (v_shift->>'start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or (v_shift->>'end') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or (v_shift->>'start')::time >= (v_shift->>'end')::time
      or jsonb_typeof(coalesce(v_shift->'breaks', '[]'::jsonb)) <> 'array'
    then raise exception 'resource schedule invalid' using errcode = '23514'; end if;
    for v_break in select value from jsonb_array_elements(coalesce(v_shift->'breaks', '[]'::jsonb)) loop
      if jsonb_typeof(v_break) <> 'object'
        or (v_break->>'start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or (v_break->>'end') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or (v_break->>'start')::time >= (v_break->>'end')::time
        or (v_break->>'start')::time < (v_shift->>'start')::time
        or (v_break->>'end')::time > (v_shift->>'end')::time
      then raise exception 'resource schedule invalid' using errcode = '23514'; end if;
    end loop;
    for v_other in select value from jsonb_array_elements(p_schedule) loop
      if v_other <> v_shift and (v_other->>'weekday') = (v_shift->>'weekday')
        and (v_other->>'start') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        and (v_other->>'end') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        and (v_other->>'start')::time < (v_shift->>'end')::time
        and (v_shift->>'start')::time < (v_other->>'end')::time
      then raise exception 'overlapping weekly shifts' using errcode = '23514'; end if;
    end loop;
  end loop;
  delete from public.person_work_hours where person_profile_id = p_person_profile_id and tenant_id = p_tenant_id and entry_kind in ('weekly_shift','weekly_break');
  for v_shift in select value from jsonb_array_elements(p_schedule) loop
    insert into public.person_work_hours(tenant_id, person_profile_id, entry_kind, weekday, starts_at, ends_at)
    values (p_tenant_id, p_person_profile_id, 'weekly_shift', (v_shift->>'weekday')::smallint, (v_shift->>'start')::time, (v_shift->>'end')::time)
    returning id into v_first_id;
    for v_break in select value from jsonb_array_elements(coalesce(v_shift->'breaks', '[]'::jsonb)) loop
      insert into public.person_work_hours(tenant_id, person_profile_id, entry_kind, weekday, starts_at, ends_at)
      values (p_tenant_id, p_person_profile_id, 'weekly_break', (v_shift->>'weekday')::smallint, (v_break->>'start')::time, (v_break->>'end')::time);
    end loop;
  end loop;
  if v_first_id is null then raise exception 'resource schedule invalid' using errcode = '23514'; end if;
  perform public.story_11_2_record_audit_event_internal(p_tenant_id, auth.uid(), 'resources.schedule.save', 'resource_schedule_saved', 'person_profile', p_person_profile_id, p_correlation_id, jsonb_build_object('targetId', p_person_profile_id));
  return v_first_id;
end $$;
revoke execute on function public.save_person_schedule_with_audit(uuid,uuid,uuid,uuid,jsonb) from public;
grant execute on function public.save_person_schedule_with_audit(uuid,uuid,uuid,uuid,jsonb) to authenticated;

create or replace function public.upsert_person_profile_with_audit(p_tenant_id uuid,p_actor_user_id uuid,p_correlation_id uuid,p_membership_id uuid,p_work_role_id uuid,p_employment_percentage smallint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_profile public.person_profiles; v_member public.tenant_memberships; v_id uuid; v_is_new boolean;
begin
 if auth.uid() is null or auth.uid() <> p_actor_user_id or not public.has_tenant_role(p_tenant_id,array['tenant_admin','projektledare']) then raise exception 'resource profile denied' using errcode='42501'; end if;
 select * into v_member from public.tenant_memberships where id=p_membership_id and tenant_id=p_tenant_id;
 if not found then raise exception 'resource profile denied' using errcode='42501'; end if;
 select * into v_profile from public.person_profiles where membership_id=p_membership_id and tenant_id=p_tenant_id for update;
 v_is_new := not found;
 if not found and v_member.status <> 'active' then raise exception 'resource profile denied' using errcode='42501'; end if;
 if p_work_role_id is not null and not exists(select 1 from public.work_roles where id=p_work_role_id and tenant_id=p_tenant_id and is_active=true) then raise exception 'resource profile denied' using errcode='42501'; end if;
 if v_is_new then
   insert into public.person_profiles(tenant_id,membership_id,default_work_role_id,employment_percentage)
   values(p_tenant_id,p_membership_id,p_work_role_id,p_employment_percentage)
   returning id into v_id;
   -- Copy shifts before breaks. The row trigger requires a containing profile
   -- shift when a break is inserted, so one unordered INSERT ... SELECT could
   -- reject a valid tenant template when the planner has added breaks.
   insert into public.person_work_hours(tenant_id,person_profile_id,entry_kind,weekday,starts_at,ends_at)
   select tenant_id,v_id,entry_kind,weekday,starts_at,ends_at
   from public.person_work_hours
   where tenant_id=p_tenant_id and person_profile_id is null and entry_kind='weekly_shift';
   insert into public.person_work_hours(tenant_id,person_profile_id,entry_kind,weekday,starts_at,ends_at)
   select tenant_id,v_id,entry_kind,weekday,starts_at,ends_at
   from public.person_work_hours
   where tenant_id=p_tenant_id and person_profile_id is null and entry_kind='weekly_break';
 else
   v_id := v_profile.id;
   update public.person_profiles set default_work_role_id=p_work_role_id,employment_percentage=p_employment_percentage,updated_at=statement_timestamp() where id=v_id;
 end if;
 perform public.story_11_2_record_audit_event_internal(p_tenant_id,auth.uid(),'resources.profile.save','resource_profile_saved','person_profile',v_id,p_correlation_id,jsonb_build_object('targetId',v_id));
 return v_id;
end $$;
revoke execute on function public.upsert_person_profile_with_audit(uuid,uuid,uuid,uuid,uuid,smallint) from public;
grant execute on function public.upsert_person_profile_with_audit(uuid,uuid,uuid,uuid,uuid,smallint) to authenticated;

create or replace function public.upsert_tenant_calendar_day_with_audit(p_tenant_id uuid,p_actor_user_id uuid,p_correlation_id uuid,p_local_date date,p_variant text,p_reduction_percent smallint)
returns uuid language plpgsql security definer set search_path = '' as $$ declare v_id uuid;
begin
 if auth.uid() is null or auth.uid() <> p_actor_user_id or not public.has_tenant_role(p_tenant_id,array['tenant_admin','projektledare']) then raise exception 'resource calendar denied' using errcode='42501'; end if;
 insert into public.tenant_calendar_days(tenant_id,local_date,variant,reduction_percent) values(p_tenant_id,p_local_date,p_variant,p_reduction_percent)
 on conflict(tenant_id,local_date) do update set variant=excluded.variant,reduction_percent=excluded.reduction_percent,updated_at=statement_timestamp() returning id into v_id;
 perform public.story_11_2_record_audit_event_internal(p_tenant_id,auth.uid(),'resources.calendar_day.save','resource_calendar_day_saved','tenant_calendar_day',v_id,p_correlation_id,jsonb_build_object('targetId',v_id)); return v_id;
end $$;
revoke execute on function public.upsert_tenant_calendar_day_with_audit(uuid,uuid,uuid,date,text,smallint) from public;
grant execute on function public.upsert_tenant_calendar_day_with_audit(uuid,uuid,uuid,date,text,smallint) to authenticated;

-- The UI form is deliberately one database transaction: profile creation (including
-- copied template rows), explicit schedule replacement, exceptions, calendar input,
-- and their audit records either all commit or all roll back together.
create or replace function public.save_resource_profile_form_with_audit(
  p_tenant_id uuid, p_actor_user_id uuid, p_correlation_id uuid, p_membership_id uuid,
  p_work_role_id uuid, p_employment_percentage smallint, p_schedule jsonb,
  p_exceptions jsonb, p_calendar_day jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_exception jsonb; v_calendar_date date; v_calendar_variant text; v_calendar_reduction smallint;
begin
  if auth.uid() is null or auth.uid() <> p_actor_user_id or not public.has_tenant_role(p_tenant_id, array['tenant_admin','projektledare']) then raise exception 'resource profile denied' using errcode='42501'; end if;
  if jsonb_typeof(p_schedule) <> 'array' or jsonb_typeof(p_exceptions) <> 'array' then raise exception 'resource form invalid' using errcode='23514'; end if;
  for v_exception in select value from jsonb_array_elements(p_exceptions) loop
    if jsonb_typeof(v_exception) <> 'object' or (v_exception->>'kind') not in ('absence','sick_leave','leave','training','blocked_time')
      or (v_exception->>'date') !~ '^\\d{4}-\\d{2}-\\d{2}$'
      or ((v_exception ? 'start') <> (v_exception ? 'end'))
      or ((v_exception ? 'start') and ((v_exception->>'start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (v_exception->>'end') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (v_exception->>'start')::time >= (v_exception->>'end')::time))
    then raise exception 'resource exception invalid' using errcode='23514'; end if;
  end loop;
  if p_calendar_day is not null then
    if jsonb_typeof(p_calendar_day) <> 'object' or (p_calendar_day->>'date') !~ '^\\d{4}-\\d{2}-\\d{2}$' or (p_calendar_day->>'variant') <> 'reduced_capacity' or (p_calendar_day->>'reductionPercent') !~ '^(100|[1-9][0-9]?)$' then raise exception 'resource calendar invalid' using errcode='23514'; end if;
    v_calendar_date := (p_calendar_day->>'date')::date; v_calendar_variant := p_calendar_day->>'variant'; v_calendar_reduction := (p_calendar_day->>'reductionPercent')::smallint;
  end if;
  v_id := public.upsert_person_profile_with_audit(p_tenant_id,p_actor_user_id,p_correlation_id,p_membership_id,p_work_role_id,p_employment_percentage);
  if jsonb_array_length(p_schedule) > 0 then perform public.save_person_schedule_with_audit(p_tenant_id,p_actor_user_id,p_correlation_id,v_id,p_schedule); end if;
  delete from public.person_work_hours where tenant_id=p_tenant_id and person_profile_id=v_id and entry_kind='exception';
  for v_exception in select value from jsonb_array_elements(p_exceptions) loop
    insert into public.person_work_hours(tenant_id,person_profile_id,entry_kind,local_date,exception_kind,starts_at,ends_at)
    values(p_tenant_id,v_id,'exception',(v_exception->>'date')::date,v_exception->>'kind',nullif(v_exception->>'start','')::time,nullif(v_exception->>'end','')::time);
  end loop;
  if jsonb_array_length(p_exceptions) > 0 then perform public.story_11_2_record_audit_event_internal(p_tenant_id,auth.uid(),'resources.exception.save','resource_exception_saved','person_profile',v_id,p_correlation_id,jsonb_build_object('targetId',v_id)); end if;
  if p_calendar_day is not null then perform public.upsert_tenant_calendar_day_with_audit(p_tenant_id,p_actor_user_id,p_correlation_id,v_calendar_date,v_calendar_variant,v_calendar_reduction); end if;
  return v_id;
end $$;
revoke execute on function public.save_resource_profile_form_with_audit(uuid,uuid,uuid,uuid,uuid,smallint,jsonb,jsonb,jsonb) from public;
grant execute on function public.save_resource_profile_form_with_audit(uuid,uuid,uuid,uuid,uuid,smallint,jsonb,jsonb,jsonb) to authenticated;
