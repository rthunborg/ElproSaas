-- Forward-only reconciliation of the initial booking migration.
-- The first version is restored from its applied statement ledger; this version
-- durably records the local iteration corrections without editing that ledger.
alter table public.contacts drop constraint if exists contacts_id_tenant_unique_booking;
alter table public.bookings drop constraint if exists bookings_check2;
alter table public.bookings drop constraint if exists bookings_series_coherent;
alter table public.bookings add constraint bookings_series_coherent check (
 (series_id is null and occurrence_index is null and not is_exception)
 or (series_id is not null and occurrence_index is not null and occurrence_index >= 0)
);


create or replace function public.booking_owned_by_current_user(p_tenant_id uuid,p_booking_id uuid,p_person_profile_id uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
  select 1 from public.booking_assignees a
  join public.person_profiles p on p.id=a.person_profile_id and p.tenant_id=a.tenant_id
  join public.tenant_memberships m on m.id=p.membership_id and m.tenant_id=p.tenant_id
  where a.tenant_id=p_tenant_id and a.booking_id=p_booking_id
    and (p_person_profile_id is null or p.id=p_person_profile_id)
    and m.user_id=auth.uid() and m.status='active'
    and (m.role='montor' or exists(select 1 from public.membership_roles mr where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and mr.role='montor'))
 );
$$;

create or replace function public.booking_payload_internal(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_start timestamptz; v_end timestamptz; v_all_day boolean; v_ids uuid[]; v_key text; v_uuid uuid;
 v_description text; v_status text; v_result jsonb;
begin
 if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'booking input invalid' using errcode='23514'; end if;
 if exists(select 1 from jsonb_object_keys(p_payload) k where k <> all(array['startsAt','endsAt','allDay','workRoleId','jobId','customerId','facilityId','contactId','description','status','assigneeIds','seriesId','occurrenceIndex','isException'])) then
  raise exception 'booking input invalid' using errcode='23514'; end if;
 if jsonb_typeof(p_payload->'startsAt') is distinct from 'string' or jsonb_typeof(p_payload->'endsAt') is distinct from 'string'
  or (p_payload->>'startsAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'
  or (p_payload->>'endsAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'
 then raise exception 'booking input invalid' using errcode='23514'; end if;
 v_start := (p_payload->>'startsAt')::timestamptz; v_end := (p_payload->>'endsAt')::timestamptz;
 if not isfinite(v_start) or not isfinite(v_end) or v_end <= v_start then raise exception 'booking input invalid' using errcode='23514'; end if;
 if p_payload ? 'allDay' and jsonb_typeof(p_payload->'allDay') is distinct from 'boolean' then raise exception 'booking input invalid' using errcode='23514'; end if;
 v_all_day:=coalesce((p_payload->>'allDay')::boolean,false);
 if v_all_day and ((v_start at time zone 'Europe/Stockholm')::time <> time '00:00' or (v_end at time zone 'Europe/Stockholm')::time <> time '00:00') then raise exception 'booking input invalid' using errcode='23514'; end if;
 if coalesce(p_payload->'seriesId','null'::jsonb) <> 'null'::jsonb or coalesce(p_payload->'occurrenceIndex','null'::jsonb) <> 'null'::jsonb
  or (p_payload ? 'isException' and p_payload->'isException' <> 'false'::jsonb) then raise exception 'booking input invalid' using errcode='23514'; end if;
 if jsonb_typeof(p_payload->'assigneeIds') is distinct from 'array' or jsonb_array_length(p_payload->'assigneeIds') < 1 then raise exception 'booking input invalid' using errcode='23514'; end if;
 if exists(select 1 from jsonb_array_elements(p_payload->'assigneeIds') i where jsonb_typeof(i) <> 'string' or i#>>'{}' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise exception 'booking input invalid' using errcode='23514'; end if;
 select array_agg(x order by x) into v_ids from (select (value#>>'{}')::uuid x from jsonb_array_elements(p_payload->'assigneeIds')) s;
 if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) x) then raise exception 'booking input invalid' using errcode='23514'; end if;
 if p_payload ? 'description' and jsonb_typeof(p_payload->'description') is distinct from 'string' then raise exception 'booking input invalid' using errcode='23514'; end if;
 v_description:=coalesce(p_payload->>'description','');
 if length(v_description)>4000 then raise exception 'booking input invalid' using errcode='23514'; end if;
 if p_payload ? 'status' and jsonb_typeof(p_payload->'status') is distinct from 'string' then raise exception 'booking input invalid' using errcode='23514'; end if;
 v_status:=coalesce(p_payload->>'status','planned');
 if v_status not in ('planned','cancelled') then raise exception 'booking input invalid' using errcode='23514'; end if;
 v_result:=jsonb_build_object('startsAt',to_char(v_start at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'endsAt',to_char(v_end at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'allDay',v_all_day,
  'assigneeIds',to_jsonb(v_ids),'description',v_description,'status',v_status,'seriesId',null,'occurrenceIndex',null,'isException',false);
 foreach v_key in array array['workRoleId','jobId','customerId','facilityId','contactId'] loop
  v_uuid:=null;
  if coalesce(p_payload->v_key,'null'::jsonb) <> 'null'::jsonb then
   if jsonb_typeof(p_payload->v_key) <> 'string' or p_payload->>v_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'booking input invalid' using errcode='23514'; end if;
   v_uuid:=(p_payload->>v_key)::uuid;
  end if;
  v_result:=v_result || jsonb_build_object(v_key,v_uuid);
 end loop;
 return v_result;
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
 raise exception 'booking input invalid' using errcode='23514';
end $$;
