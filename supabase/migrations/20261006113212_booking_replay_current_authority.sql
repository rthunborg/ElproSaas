-- Forward correction: recheck current actor authority after replay serialization waits.
-- Existing applied migrations and historical outcomes remain immutable.
create or replace function public.booking_write_internal(p_tenant_id uuid,p_actor_id uuid,p_correlation_id uuid,p_command_id uuid,p_booking_id uuid,p_payload jsonb)
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
   -- Replay takes only the actor lock after command serialization. Fresh writes
   -- retain the combined sorted actor/assignee locks below; replay never locks
   -- or revalidates mutable assignees. Admin role changes lock this same parent.
   perform 1 from public.tenant_memberships m
    where m.tenant_id=p_tenant_id and m.user_id=p_actor_id order by m.id for share;
   if not public.has_tenant_role(p_tenant_id,array['tenant_admin','projektledare']) then raise exception 'booking denied' using errcode='42501'; end if;
   if v_booking.create_payload_digest <> v_digest then raise exception 'booking command conflict' using errcode='BK409'; end if;
   return v_booking.create_result;
  end if;
 else
  select * into v_booking from public.bookings where tenant_id=p_tenant_id and id=p_booking_id for update;
  if not found then raise exception 'booking denied' using errcode='42501'; end if;
  if v_booking.update_outcomes ? p_command_id::text then
   -- Replay takes only the actor lock after command serialization. Fresh writes
   -- retain the combined sorted actor/assignee locks below; replay never locks
   -- or revalidates mutable assignees. Admin role changes lock this same parent.
   perform 1 from public.tenant_memberships m
    where m.tenant_id=p_tenant_id and m.user_id=p_actor_id order by m.id for share;
   if not public.has_tenant_role(p_tenant_id,array['tenant_admin','projektledare']) then raise exception 'booking denied' using errcode='42501'; end if;
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

