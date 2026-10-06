-- Internal booking foundation. Contract C gates user-facing entry on Story 14.3.
alter table public.contacts add constraint contacts_id_tenant_unique_booking unique (id, tenant_id);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz not null,
  all_day boolean not null default false,
  work_role_id uuid, job_id uuid, customer_id uuid, facility_id uuid, contact_id uuid,
  description text not null default '' check (length(description) <= 4000),
  status text not null default 'planned' check (status in ('planned','cancelled')),
  series_id uuid, occurrence_index integer, is_exception boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  create_command_id uuid not null,
  create_payload_digest text not null,
  create_result jsonb not null,
  update_outcomes jsonb not null default '{}'::jsonb check (jsonb_typeof(update_outcomes)='object'),
  unique(id,tenant_id), unique(tenant_id,create_command_id),
  check (isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at),
  check (not all_day or ((starts_at at time zone 'Europe/Stockholm')::time = time '00:00'
    and (ends_at at time zone 'Europe/Stockholm')::time = time '00:00')),
  check ((series_id is null and occurrence_index is null and not is_exception)
    or (series_id is not null and occurrence_index >= 0)),
  foreign key(work_role_id,tenant_id) references public.work_roles(id,tenant_id) on delete restrict,
  foreign key(job_id,tenant_id) references public.jobs(id,tenant_id) on delete restrict,
  foreign key(customer_id,tenant_id) references public.customers(id,tenant_id) on delete restrict,
  foreign key(facility_id,tenant_id) references public.facilities(id,tenant_id) on delete restrict,
  foreign key(contact_id,tenant_id) references public.contacts(id,tenant_id) on delete restrict
);

create table public.booking_assignees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  booking_id uuid not null, person_profile_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique(booking_id,person_profile_id), unique(id,tenant_id),
  foreign key(booking_id,tenant_id) references public.bookings(id,tenant_id) on delete restrict,
  foreign key(person_profile_id,tenant_id) references public.person_profiles(id,tenant_id) on delete restrict
);

create table public.booking_conflicts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  booking_id uuid not null, related_booking_id uuid, affected_person_profile_id uuid,
  conflict_type text not null check(conflict_type in ('double_booking','over_capacity','outside_work_hours','outside_access_window','competence_missing')),
  starts_at timestamptz not null, ends_at timestamptz not null,
  natural_key text not null check(length(btrim(natural_key)) between 1 and 1000),
  status text not null default 'open' check(status in ('open','accepted','resolved')),
  acceptance_reason text, accepted_by_membership_id uuid, accepted_at timestamptz,
  resolution_outcome text, resolved_by_membership_id uuid, resolved_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(tenant_id,natural_key), unique(id,tenant_id),
  check(isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at),
  check ((acceptance_reason is null and accepted_by_membership_id is null and accepted_at is null)
    or (acceptance_reason is not null and length(btrim(acceptance_reason)) > 0 and accepted_by_membership_id is not null and accepted_at is not null)),
  check ((resolution_outcome is null and resolved_by_membership_id is null and resolved_at is null)
    or (resolution_outcome is not null and length(btrim(resolution_outcome)) > 0 and resolved_by_membership_id is not null and resolved_at is not null)),
  check(status <> 'accepted' or (acceptance_reason is not null and accepted_by_membership_id is not null and accepted_at is not null)),
  check(status <> 'resolved' or (resolution_outcome is not null and resolved_by_membership_id is not null and resolved_at is not null)),
  foreign key(booking_id,tenant_id) references public.bookings(id,tenant_id) on delete restrict,
  foreign key(related_booking_id,tenant_id) references public.bookings(id,tenant_id) on delete restrict,
  foreign key(affected_person_profile_id,tenant_id) references public.person_profiles(id,tenant_id) on delete restrict,
  foreign key(accepted_by_membership_id,tenant_id) references public.tenant_memberships(id,tenant_id) on delete restrict,
  foreign key(resolved_by_membership_id,tenant_id) references public.tenant_memberships(id,tenant_id) on delete restrict
);

create index bookings_tenant_range_idx on public.bookings(tenant_id,starts_at,ends_at);

create index booking_assignees_person_idx on public.booking_assignees(tenant_id,person_profile_id,booking_id);

create index booking_conflicts_booking_idx on public.booking_conflicts(tenant_id,booking_id,status);

-- Nonrecursive ownership lookup. Profile SELECT privileges are deliberately unchanged.
create function public.booking_owned_by_current_user(p_tenant_id uuid,p_booking_id uuid,p_person_profile_id uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
  select 1 from public.booking_assignees a
  join public.person_profiles p on p.id=a.person_profile_id and p.tenant_id=a.tenant_id
  join public.tenant_memberships m on m.id=p.membership_id and m.tenant_id=p.tenant_id
  where a.tenant_id=p_tenant_id and a.booking_id=p_booking_id
    and (p_person_profile_id is null or p.id=p_person_profile_id)
    and m.user_id=auth.uid() and m.status='active' and m.role='montor'
 );
$$;

revoke all on function public.booking_owned_by_current_user(uuid,uuid,uuid) from public,anon,authenticated,service_role;

grant execute on function public.booking_owned_by_current_user(uuid,uuid,uuid) to authenticated;

alter table public.bookings enable row level security;

alter table public.bookings force row level security;

alter table public.booking_assignees enable row level security;

alter table public.booking_assignees force row level security;

alter table public.booking_conflicts enable row level security;

alter table public.booking_conflicts force row level security;

revoke all on public.bookings,public.booking_assignees,public.booking_conflicts from public,anon,authenticated,service_role;

grant select(id,tenant_id,starts_at,ends_at,all_day,work_role_id,job_id,customer_id,facility_id,contact_id,description,status,series_id,occurrence_index,is_exception,created_at,updated_at) on public.bookings to authenticated;

grant select on public.booking_assignees,public.booking_conflicts to authenticated;

create policy bookings_resource_read on public.bookings for select to authenticated using (
 public.has_tenant_role(tenant_id,array['tenant_admin','projektledare']) or public.booking_owned_by_current_user(tenant_id,id));

create policy booking_assignees_resource_read on public.booking_assignees for select to authenticated using (
 public.has_tenant_role(tenant_id,array['tenant_admin','projektledare']) or public.booking_owned_by_current_user(tenant_id,booking_id,person_profile_id));

create policy booking_conflicts_resource_read on public.booking_conflicts for select to authenticated using (
 public.has_tenant_role(tenant_id,array['tenant_admin','projektledare']) or (affected_person_profile_id is not null and public.booking_owned_by_current_user(tenant_id,booking_id,affected_person_profile_id)));

-- Owner-only canonicalization rebuilds identity from typed facts, never a caller digest.
create function public.booking_payload_internal(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_start timestamptz; v_end timestamptz; v_all_day boolean; v_ids uuid[]; v_key text; v_uuid uuid;
 v_description text; v_status text; v_result jsonb;
begin
 if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'booking input invalid' using errcode='23514'; end if;
 if exists(select 1 from jsonb_object_keys(p_payload) k where k <> all(array['startsAt','endsAt','allDay','workRoleId','jobId','customerId','facilityId','contactId','description','status','assigneeIds','seriesId','occurrenceIndex','isException'])) then
  raise exception 'booking input invalid' using errcode='23514'; end if;
 if jsonb_typeof(p_payload->'startsAt') is distinct from 'string' or jsonb_typeof(p_payload->'endsAt') is distinct from 'string'
  or (p_payload->>'startsAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'
  or (p_payload->>'endsAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'
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

revoke all on function public.booking_payload_internal(jsonb) from public,anon,authenticated,service_role;

-- This INVOKER primitive runs only under checked owner authority. Extend this same
-- transaction in Story 14.3; no detector or derived-result claim is made here.
create function public.booking_write_internal(p_tenant_id uuid,p_actor_id uuid,p_correlation_id uuid,p_command_id uuid,p_booking_id uuid,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_payload jsonb; v_digest text; v_booking public.bookings; v_id uuid; v_result jsonb;
 v_ids uuid[]; v_member public.tenant_memberships; v_profile public.person_profiles;
 v_job public.jobs; v_facility public.facilities; v_contact public.contacts;
 v_customer_id uuid; v_facility_id uuid; v_contact_id uuid; v_job_id uuid; v_work_role_id uuid;
begin
 if auth.uid() is null or auth.uid() is distinct from p_actor_id or p_command_id is null or p_correlation_id is null
  or not public.has_tenant_role(p_tenant_id,array['tenant_admin','projektledare']) then raise exception 'booking denied' using errcode='42501'; end if;
 v_payload:=public.booking_payload_internal(p_payload);
 v_digest:=encode(extensions.digest((jsonb_build_object('operation',case when p_booking_id is null then 'create' else 'update' end,'bookingId',p_booking_id,'payload',v_payload))::text,'sha256'),'hex');
 if p_booking_id is null then
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_command_id::text,0));
  select * into v_booking from public.bookings where tenant_id=p_tenant_id and create_command_id=p_command_id;
  if found then
   if v_booking.create_payload_digest <> v_digest then raise exception 'booking command conflict' using errcode='BK409'; end if;
   return v_booking.create_result;
  end if;
 else
  select * into v_booking from public.bookings where tenant_id=p_tenant_id and id=p_booking_id for update;
  if not found then raise exception 'booking denied' using errcode='42501'; end if;
  if v_booking.update_outcomes ? p_command_id::text then
   if v_booking.update_outcomes->p_command_id::text->>'digest' <> v_digest then raise exception 'booking command conflict' using errcode='BK409'; end if;
   return v_booking.update_outcomes->p_command_id::text->'result';
  end if;
 end if;
 select array_agg((value#>>'{}')::uuid) into v_ids from jsonb_array_elements(v_payload->'assigneeIds');
 -- SHARE conflicts with membership/profile UPDATE; sorted membership locks avoid
 -- deactivation racing new assignment. Current actor is included in the same order.
 perform 1 from public.tenant_memberships m where m.tenant_id=p_tenant_id
  and (m.user_id=p_actor_id or m.id in (select p.membership_id from public.person_profiles p where p.tenant_id=p_tenant_id and p.id=any(v_ids)))
  order by m.id for share;
 if not public.has_tenant_role(p_tenant_id,array['tenant_admin','projektledare']) then raise exception 'booking denied' using errcode='42501'; end if;
 for v_profile in select * from public.person_profiles where tenant_id=p_tenant_id and id=any(v_ids) order by id for share loop
  select * into v_member from public.tenant_memberships where id=v_profile.membership_id and tenant_id=p_tenant_id;
  if (v_profile.archived_at is not null or v_member.status <> 'active') and not exists (
   select 1 from public.booking_assignees where tenant_id=p_tenant_id and booking_id=p_booking_id and person_profile_id=v_profile.id
  ) then raise exception 'booking denied' using errcode='42501'; end if;
 end loop;
 if (select count(*) from public.person_profiles where tenant_id=p_tenant_id and id=any(v_ids)) <> cardinality(v_ids) then raise exception 'booking denied' using errcode='42501'; end if;
 v_customer_id:=(v_payload->>'customerId')::uuid; v_facility_id:=(v_payload->>'facilityId')::uuid;
 v_contact_id:=(v_payload->>'contactId')::uuid; v_job_id:=(v_payload->>'jobId')::uuid; v_work_role_id:=(v_payload->>'workRoleId')::uuid;
 if v_work_role_id is not null and not exists(select 1 from public.work_roles where tenant_id=p_tenant_id and id=v_work_role_id and is_active) then raise exception 'booking denied' using errcode='42501'; end if;
 if v_customer_id is not null and not exists(select 1 from public.customers where tenant_id=p_tenant_id and id=v_customer_id) then raise exception 'booking denied' using errcode='42501'; end if;
 if v_facility_id is not null then
  select * into v_facility from public.facilities where tenant_id=p_tenant_id and id=v_facility_id for share;
  if not found or (v_customer_id is not null and v_facility.customer_id <> v_customer_id) then raise exception 'booking denied' using errcode='42501'; end if;
 end if;
 if v_contact_id is not null then
  select * into v_contact from public.contacts where tenant_id=p_tenant_id and id=v_contact_id for share;
  if not found or (v_customer_id is not null and v_contact.customer_id <> v_customer_id)
   or (v_facility_id is not null and v_contact.customer_id <> v_facility.customer_id)
   or (v_facility_id is not null and v_contact.facility_id is not null and v_contact.facility_id <> v_facility_id) then raise exception 'booking denied' using errcode='42501'; end if;
 end if;
 if v_job_id is not null then
  select * into v_job from public.jobs where tenant_id=p_tenant_id and id=v_job_id for share;
  if not found or (v_customer_id is not null and v_customer_id <> v_job.customer_id)
   or (v_facility_id is not null and v_facility.customer_id <> v_job.customer_id)
   or (v_contact_id is not null and v_contact.customer_id <> v_job.customer_id)
   or (v_facility_id is not null and v_job.facility_id is not null and v_facility_id <> v_job.facility_id)
   or (v_contact_id is not null and v_job.contact_id is not null and v_contact_id <> v_job.contact_id)
   or (v_contact_id is not null and v_contact.facility_id is not null and v_job.facility_id is not null and v_contact.facility_id <> v_job.facility_id)
  then raise exception 'booking denied' using errcode='42501'; end if;
 end if;
 perform set_config('app.booking_correlation_id',p_correlation_id::text,true);
 perform set_config('app.booking_command_id',p_command_id::text,true);
 v_id:=coalesce(p_booking_id,gen_random_uuid()); v_result:=jsonb_build_object('bookingId',v_id);
 if p_booking_id is null then
  insert into public.bookings(id,tenant_id,starts_at,ends_at,all_day,work_role_id,job_id,customer_id,facility_id,contact_id,description,status,create_command_id,create_payload_digest,create_result)
  values(v_id,p_tenant_id,(v_payload->>'startsAt')::timestamptz,(v_payload->>'endsAt')::timestamptz,(v_payload->>'allDay')::boolean,v_work_role_id,v_job_id,v_customer_id,v_facility_id,v_contact_id,v_payload->>'description',v_payload->>'status',p_command_id,v_digest,v_result);
 else
  update public.bookings set starts_at=(v_payload->>'startsAt')::timestamptz,ends_at=(v_payload->>'endsAt')::timestamptz,all_day=(v_payload->>'allDay')::boolean,
   work_role_id=v_work_role_id,job_id=v_job_id,customer_id=v_customer_id,facility_id=v_facility_id,contact_id=v_contact_id,
   description=v_payload->>'description',status=v_payload->>'status',updated_at=statement_timestamp(),
   update_outcomes=update_outcomes || jsonb_build_object(p_command_id::text,jsonb_build_object('digest',v_digest,'result',v_result))
  where tenant_id=p_tenant_id and id=v_id;
 end if;
 delete from public.booking_assignees where tenant_id=p_tenant_id and booking_id=v_id and not(person_profile_id=any(v_ids));
 insert into public.booking_assignees(tenant_id,booking_id,person_profile_id)
 select p_tenant_id,v_id,x from unnest(v_ids) x where not exists(select 1 from public.booking_assignees a where a.tenant_id=p_tenant_id and a.booking_id=v_id and a.person_profile_id=x);
 perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_id,
  case when p_booking_id is null then 'createBooking' else 'updateBooking' end,
  case when p_booking_id is null then 'booking_created' else 'booking_updated' end,
  'booking',v_id,p_correlation_id,jsonb_build_object('targetId',v_id));
 return v_result;
end $$;

revoke all on function public.booking_write_internal(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;

create function public.create_booking(p_tenant_id uuid,p_actor_id uuid,p_correlation_id uuid,p_command_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_actor_id or not public.has_tenant_role(p_tenant_id,array['tenant_admin','projektledare']) then raise exception 'booking denied' using errcode='42501'; end if;
 return public.booking_write_internal(p_tenant_id,p_actor_id,p_correlation_id,p_command_id,null,p_payload);
end $$;

create function public.update_booking(p_tenant_id uuid,p_actor_id uuid,p_correlation_id uuid,p_command_id uuid,p_booking_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_actor_id or p_booking_id is null or not public.has_tenant_role(p_tenant_id,array['tenant_admin','projektledare']) then raise exception 'booking denied' using errcode='42501'; end if;
 return public.booking_write_internal(p_tenant_id,p_actor_id,p_correlation_id,p_command_id,p_booking_id,p_payload);
end $$;

revoke all on function public.create_booking(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;

revoke all on function public.update_booking(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;

grant execute on function public.create_booking(uuid,uuid,uuid,uuid,jsonb) to authenticated;

grant execute on function public.update_booking(uuid,uuid,uuid,uuid,uuid,jsonb) to authenticated;
