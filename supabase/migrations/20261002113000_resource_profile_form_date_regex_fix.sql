-- Story 14.1 corrective migration: PostgreSQL regexes in dollar-quoted strings
-- must use one backslash for the \d digit class. The original composite form RPC
-- used two and therefore rejected ordinary ISO local dates from the browser.
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
      or (v_exception->>'date') !~ '^\d{4}-\d{2}-\d{2}$'
      or ((v_exception ? 'start') <> (v_exception ? 'end'))
      or ((v_exception ? 'start') and ((v_exception->>'start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (v_exception->>'end') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (v_exception->>'start')::time >= (v_exception->>'end')::time))
    then raise exception 'resource exception invalid' using errcode='23514'; end if;
  end loop;
  if p_calendar_day is not null then
    if jsonb_typeof(p_calendar_day) <> 'object' or (p_calendar_day->>'date') !~ '^\d{4}-\d{2}-\d{2}$' or (p_calendar_day->>'variant') <> 'reduced_capacity' or (p_calendar_day->>'reductionPercent') !~ '^(100|[1-9][0-9]?)$' then raise exception 'resource calendar invalid' using errcode='23514'; end if;
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
