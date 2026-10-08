-- Story 14.1 corrective migration: preserve valid PostgreSQL time precision from the read model.
-- Browser submissions remain minute-granular; stored seconds and microseconds may round-trip unchanged.

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
      or (v_shift->>'start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9]([.][0-9]{1,6})?)?$'
      or (v_shift->>'end') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9]([.][0-9]{1,6})?)?$'
      or (v_shift->>'start')::time >= (v_shift->>'end')::time
      or jsonb_typeof(coalesce(v_shift->'breaks', '[]'::jsonb)) <> 'array'
    then raise exception 'resource schedule invalid' using errcode = '23514'; end if;
    for v_break in select value from jsonb_array_elements(coalesce(v_shift->'breaks', '[]'::jsonb)) loop
      if jsonb_typeof(v_break) <> 'object'
        or (v_break->>'start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9]([.][0-9]{1,6})?)?$'
        or (v_break->>'end') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9]([.][0-9]{1,6})?)?$'
        or (v_break->>'start')::time >= (v_break->>'end')::time
        or (v_break->>'start')::time < (v_shift->>'start')::time
        or (v_break->>'end')::time > (v_shift->>'end')::time
      then raise exception 'resource schedule invalid' using errcode = '23514'; end if;
    end loop;
    for v_other in select value from jsonb_array_elements(p_schedule) loop
      if v_other <> v_shift and (v_other->>'weekday') = (v_shift->>'weekday')
        and (v_other->>'start') ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9]([.][0-9]{1,6})?)?$'
        and (v_other->>'end') ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9]([.][0-9]{1,6})?)?$'
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

-- A blank field is an explicit clear only for inputs the panel renders. This keeps
-- partial input invalid, preserves hidden exception history, and audits each write.
create or replace function public.save_resource_profile_form_with_audit(
  p_tenant_id uuid, p_actor_user_id uuid, p_correlation_id uuid, p_membership_id uuid,
  p_work_role_id uuid, p_employment_percentage smallint, p_schedule jsonb,
  p_exceptions jsonb, p_calendar_day jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_exception jsonb;
  v_calendar_date date;
  v_calendar_variant text;
  v_calendar_reduction smallint;
  v_calendar_clear boolean := false;
  v_calendar_id uuid;
  v_had_exceptions boolean := false;
begin
  if auth.uid() is null or auth.uid() <> p_actor_user_id or not public.has_tenant_role(p_tenant_id, array['tenant_admin','projektledare']) then
    raise exception 'resource profile denied' using errcode='42501';
  end if;
  if jsonb_typeof(p_schedule) <> 'array' or jsonb_typeof(p_exceptions) <> 'array' then
    raise exception 'resource form invalid' using errcode='23514';
  end if;
  for v_exception in select value from jsonb_array_elements(p_exceptions) loop
    if jsonb_typeof(v_exception) <> 'object' or (v_exception->>'kind') not in ('absence','sick_leave','leave','training','blocked_time')
      or (v_exception->>'date') !~ '^\d{4}-\d{2}-\d{2}$'
      or ((v_exception ? 'start') <> (v_exception ? 'end'))
      or ((v_exception ? 'start') and ((v_exception->>'start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9]([.][0-9]{1,6})?)?$' or (v_exception->>'end') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9]([.][0-9]{1,6})?)?$' or (v_exception->>'start')::time >= (v_exception->>'end')::time))
    then raise exception 'resource exception invalid' using errcode='23514'; end if;
  end loop;
  if p_calendar_day is not null then
    if jsonb_typeof(p_calendar_day) <> 'object' or (p_calendar_day->>'date') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'resource calendar invalid' using errcode='23514';
    end if;
    v_calendar_date := (p_calendar_day->>'date')::date;
    if (p_calendar_day->>'variant') = 'clear' then
      v_calendar_clear := true;
    elsif (p_calendar_day->>'variant') = 'reduced_capacity' and (p_calendar_day->>'reductionPercent') ~ '^(100|[1-9][0-9]?)$' then
      v_calendar_variant := 'reduced_capacity';
      v_calendar_reduction := (p_calendar_day->>'reductionPercent')::smallint;
    else
      raise exception 'resource calendar invalid' using errcode='23514';
    end if;
  end if;
  v_id := public.upsert_person_profile_with_audit(p_tenant_id,p_actor_user_id,p_correlation_id,p_membership_id,p_work_role_id,p_employment_percentage);
  if jsonb_array_length(p_schedule) > 0 then
    perform public.save_person_schedule_with_audit(p_tenant_id,p_actor_user_id,p_correlation_id,v_id,p_schedule);
  else
    delete from public.person_work_hours where tenant_id=p_tenant_id and person_profile_id=v_id and entry_kind in ('weekly_shift','weekly_break');
    perform public.story_11_2_record_audit_event_internal(p_tenant_id,auth.uid(),'resources.schedule.save','resource_schedule_cleared','person_profile',v_id,p_correlation_id,jsonb_build_object('targetId',v_id));
  end if;
  select exists(select 1 from public.person_work_hours where tenant_id=p_tenant_id and person_profile_id=v_id and entry_kind='exception') into v_had_exceptions;
  delete from public.person_work_hours where tenant_id=p_tenant_id and person_profile_id=v_id and entry_kind='exception';
  for v_exception in select value from jsonb_array_elements(p_exceptions) loop
    insert into public.person_work_hours(tenant_id,person_profile_id,entry_kind,local_date,exception_kind,starts_at,ends_at)
    values(p_tenant_id,v_id,'exception',(v_exception->>'date')::date,v_exception->>'kind',nullif(v_exception->>'start','')::time,nullif(v_exception->>'end','')::time);
  end loop;
  if jsonb_array_length(p_exceptions) > 0 or v_had_exceptions then
    perform public.story_11_2_record_audit_event_internal(p_tenant_id,auth.uid(),'resources.exception.save','resource_exception_saved','person_profile',v_id,p_correlation_id,jsonb_build_object('targetId',v_id));
  end if;
  if p_calendar_day is not null then
    if v_calendar_clear then
      delete from public.tenant_calendar_days where tenant_id=p_tenant_id and local_date=v_calendar_date returning id into v_calendar_id;
      if v_calendar_id is not null then
        perform public.story_11_2_record_audit_event_internal(p_tenant_id,auth.uid(),'resources.calendar_day.clear','tenant_calendar_day_cleared','tenant_calendar_day',v_calendar_id,p_correlation_id,jsonb_build_object('targetId',v_calendar_id));
      end if;
    else
      perform public.upsert_tenant_calendar_day_with_audit(p_tenant_id,p_actor_user_id,p_correlation_id,v_calendar_date,v_calendar_variant,v_calendar_reduction);
    end if;
  end if;
  return v_id;
end $$;

revoke execute on function public.save_resource_profile_form_with_audit(uuid,uuid,uuid,uuid,uuid,smallint,jsonb,jsonb,jsonb) from public;
grant execute on function public.save_resource_profile_form_with_audit(uuid,uuid,uuid,uuid,uuid,smallint,jsonb,jsonb,jsonb) to authenticated;