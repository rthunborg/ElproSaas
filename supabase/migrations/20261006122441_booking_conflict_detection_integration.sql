-- Story 14.3. The TypeScript engine is the sole detector. SQL verifies exact
-- current fact equivalence and signed output, then persists everything atomically.
-- No client GUC, old RPC, or owner helper confers fresh detection authority.

create function public.booking_detection_gate_internal(p_tenant_id uuid,p_actor_id uuid)
returns void language plpgsql volatile security invoker set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_actor_id or p_tenant_id is null then
  raise exception 'booking denied' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text,0));
 -- Deliberately after waiting: current roles, not JWT role claims, are authority.
 if not public.has_tenant_role(p_tenant_id,array['tenant_admin','projektledare']) then
  raise exception 'booking denied' using errcode='42501';
 end if;
end $$;

create function public.booking_detection_digest_internal(p_operation text,p_booking_id uuid,p_payload jsonb)
returns text language sql immutable security invoker set search_path='' as $$
 select encode(extensions.digest(jsonb_build_object('operation',p_operation,'bookingId',p_booking_id,'payload',p_payload)::text,'sha256'),'hex');
$$;

-- Replays need current actor authority but deliberately do not revalidate historical assignees.
create function public.booking_detection_replay_internal(p_tenant_id uuid,p_actor_id uuid,p_command_id uuid,p_booking_id uuid,p_payload jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare v_booking public.bookings; v_digest text;
begin
 perform public.booking_detection_gate_internal(p_tenant_id,p_actor_id);
 if p_command_id is null then raise exception 'booking input invalid' using errcode='23514'; end if;
 v_digest:=public.booking_detection_digest_internal(case when p_booking_id is null then 'create' else 'update' end,p_booking_id,p_payload);
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
 return null;
end $$;

-- Complete unpaginated content, including empty sets and insert/delete-sensitive values.
-- A single statement has one fresh READ COMMITTED snapshot after the first gate.
-- Display text, money, CRM/job depth, audit and transport validity are not detector facts.
create function public.booking_detection_facts_internal(p_tenant_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$
 select jsonb_build_object(
  'bookings',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,
    'startsAt',to_char(b.starts_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'endsAt',to_char(b.ends_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'allDay',b.all_day,'status',b.status,'assigneeIds',coalesce((select jsonb_agg(a.person_profile_id order by a.person_profile_id)
      from public.booking_assignees a where a.tenant_id=b.tenant_id and a.booking_id=b.id),'[]'::jsonb)) order by b.id)
    from public.bookings b where b.tenant_id=p_tenant_id),'[]'::jsonb),
  'profiles',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'membershipId',p.membership_id,
    'defaultWorkRoleId',p.default_work_role_id,'employmentPercentage',p.employment_percentage,
    'archivedAt',p.archived_at) order by p.id) from public.person_profiles p where p.tenant_id=p_tenant_id),'[]'::jsonb),
  'hours',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'personProfileId',h.person_profile_id,
    'entryKind',h.entry_kind,'weekday',h.weekday,'localDate',h.local_date,'exceptionKind',h.exception_kind,
    'startsAt',h.starts_at,'endsAt',h.ends_at) order by h.id) from public.person_work_hours h where h.tenant_id=p_tenant_id),'[]'::jsonb),
  'calendarDays',coalesce((select jsonb_agg(jsonb_build_object('date',c.local_date,'variant',c.variant,
    'reductionPercent',c.reduction_percent) order by c.local_date) from public.tenant_calendar_days c where c.tenant_id=p_tenant_id),'[]'::jsonb),
  'memberships',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'userId',m.user_id,'status',m.status,'role',m.role,
    'roles',coalesce((select jsonb_agg(r.role order by r.role) from public.membership_roles r
      where r.tenant_id=m.tenant_id and r.membership_id=m.id),'[]'::jsonb)) order by m.id)
    from public.tenant_memberships m where m.tenant_id=p_tenant_id),'[]'::jsonb),
  'workRoles',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'isActive',r.is_active) order by r.id)
    from public.work_roles r where r.tenant_id=p_tenant_id),'[]'::jsonb),
  'jobInputs',null,
  'rules',jsonb_build_object('version','stockholm-capacity-v1','timeZone','Europe/Stockholm',
    'planningBufferMinutes',0,'acknowledgmentThresholdMinutes',60,'authorizedOvertime','[]'::jsonb));
$$;

-- Shared Node/Postgres canonical proof: UTF-8 byte length + ':' + exact value.
create function public.booking_conflict_proof_bytes_internal(p_claims jsonb,p_output text)
returns bytea language plpgsql immutable security invoker set search_path='' as $$
declare v_field text; v_value text; v_text text := '38:elpro.booking-conflicts.attestation.v1';
begin
 foreach v_field in array array['tenantId','actorId','operation','commandId','bookingId','candidateDigest','factDigest',
   'engineVersion','configVersion','correlationId','keyId','issuedAt','expiresAt'] loop
  v_value:=p_claims->>v_field;
  if v_value is null then raise exception 'booking proof denied' using errcode='42501'; end if;
  v_text:=v_text || octet_length(v_value)::text || ':' || v_value;
 end loop;
 if p_output is null then raise exception 'booking proof denied' using errcode='42501'; end if;
 return convert_to(v_text || octet_length(p_output)::text || ':' || p_output,'UTF8');
end $$;

create function public.booking_conflict_key_internal(p_key_id text)
returns text language plpgsql volatile security invoker set search_path='' as $$
declare v_secret text;
begin
 if p_key_id is null or p_key_id !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'booking proof denied' using errcode='42501'; end if;
 select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name='booking_conflict_attestation_' || p_key_id;
 if v_secret is null or v_secret='' then raise exception 'booking proof denied' using errcode='42501'; end if;
 return v_secret;
end $$;

create function public.snapshot_booking_conflicts(p_tenant_id uuid,p_actor_id uuid,p_correlation_id uuid,p_command_id uuid,
 p_booking_id uuid,p_payload jsonb,p_key_id text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_payload jsonb; v_replay jsonb; v_facts jsonb; v_issued timestamptz; v_id uuid;
begin
 perform public.booking_detection_gate_internal(p_tenant_id,p_actor_id);
 if p_correlation_id is null then raise exception 'booking input invalid' using errcode='23514'; end if;
 v_payload:=public.booking_payload_internal(p_payload);
 v_replay:=public.booking_detection_replay_internal(p_tenant_id,p_actor_id,p_command_id,p_booking_id,v_payload);
 if v_replay is not null then return jsonb_build_object('kind','replay','result',v_replay); end if;
 perform public.booking_conflict_key_internal(p_key_id);
 v_facts:=public.booking_detection_facts_internal(p_tenant_id);
 v_id:=coalesce(p_booking_id,gen_random_uuid()); v_issued:=clock_timestamp();
 return jsonb_build_object('kind','snapshot','tenantId',p_tenant_id,'actorId',p_actor_id,
  'operation',case when p_booking_id is null then 'create' else 'update' end,'commandId',p_command_id,'bookingId',v_id,
  'candidate',v_payload,'candidateDigest',public.booking_detection_digest_internal(case when p_booking_id is null then 'create' else 'update' end,p_booking_id,v_payload),
  'canonicalFacts',v_facts::text,'factDigest',encode(extensions.digest(v_facts::text,'sha256'),'hex'),
  'engineVersion','booking-conflicts-v1','configVersion','stockholm-capacity-v1','correlationId',p_correlation_id,'keyId',p_key_id,
  'issuedAt',to_char(v_issued at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'expiresAt',to_char((v_issued+interval '2 minutes') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
end $$;

-- Validates persistence schema and references, never detection rules. Output is
-- derived data only: workflow status/reason/acceptance/resolver fields are forbidden.
create function public.booking_conflict_output_internal(p_tenant_id uuid,p_booking_id uuid,p_payload jsonb,p_output text)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare v_output jsonb; v_row jsonb; v_booking uuid; v_related uuid; v_person uuid;
 v_start timestamptz; v_end timestamptz; v_bounds jsonb; v_first timestamptz; v_last timestamptz;
begin
 v_output:=p_output::jsonb;
 if v_output is null or jsonb_typeof(v_output) <> 'array' then raise exception 'booking proof denied' using errcode='42501'; end if;
 if (select count(*) from jsonb_array_elements(v_output)) <>
    (select count(distinct value->>'natural_key') from jsonb_array_elements(v_output)) then raise exception 'booking proof denied' using errcode='42501'; end if;
 for v_row in select value from jsonb_array_elements(v_output) loop
  if jsonb_typeof(v_row) <> 'object' or (select count(*) from jsonb_object_keys(v_row))<>7
   or not(v_row ?& array['booking_id','related_booking_id','affected_person_profile_id','conflict_type','starts_at','ends_at','natural_key'])
   or v_row->>'conflict_type' not in ('double_booking','over_capacity','outside_work_hours','outside_access_window','competence_missing')
   or jsonb_typeof(v_row->'natural_key') is distinct from 'string' or length(btrim(v_row->>'natural_key')) not between 1 and 1000
   or jsonb_typeof(v_row->'starts_at') is distinct from 'string' or jsonb_typeof(v_row->'ends_at') is distinct from 'string'
   or jsonb_typeof(v_row->'booking_id') is distinct from 'string' or jsonb_typeof(v_row->'affected_person_profile_id') is distinct from 'string'
   or jsonb_typeof(v_row->'related_booking_id') not in ('string','null') then raise exception 'booking proof denied' using errcode='42501'; end if;
  v_booking:=(v_row->>'booking_id')::uuid; v_related:=(v_row->>'related_booking_id')::uuid; v_person:=(v_row->>'affected_person_profile_id')::uuid;
  v_start:=(v_row->>'starts_at')::timestamptz; v_end:=(v_row->>'ends_at')::timestamptz;
  if v_booking is null or v_person is null or not isfinite(v_start) or not isfinite(v_end) or v_end<=v_start
    or v_related=v_booking or not exists(select 1 from public.person_profiles where tenant_id=p_tenant_id and id=v_person)
    then raise exception 'booking proof denied' using errcode='42501'; end if;
  if v_booking=p_booking_id then v_bounds:=p_payload;
  else
   select jsonb_build_object('startsAt',b.starts_at,'endsAt',b.ends_at) into v_bounds
    from public.bookings b where b.tenant_id=p_tenant_id and b.id=v_booking and b.status<>'cancelled';
   if not found then raise exception 'booking proof denied' using errcode='42501'; end if;
  end if;
  if (v_booking=p_booking_id and (p_payload->>'status'='cancelled' or not(p_payload->'assigneeIds' ? v_person::text)))
   or (v_booking<>p_booking_id and not exists(select 1 from public.booking_assignees a where a.tenant_id=p_tenant_id and a.booking_id=v_booking and a.person_profile_id=v_person))
   then raise exception 'booking proof denied' using errcode='42501'; end if;
  if v_related is not null and (
   (v_related=p_booking_id and (p_payload->>'status'='cancelled' or not(p_payload->'assigneeIds' ? v_person::text)))
   or (v_related<>p_booking_id and not exists(select 1 from public.bookings b join public.booking_assignees a on a.tenant_id=b.tenant_id and a.booking_id=b.id
     where b.tenant_id=p_tenant_id and b.id=v_related and b.status<>'cancelled' and a.person_profile_id=v_person)))
   then raise exception 'booking proof denied' using errcode='42501'; end if;
  -- Capacity covers the touched local calendar day. Other windows must be within
  -- the owning booking; SQL does not recreate shift/overlap/competence rules.
  v_first:=(v_bounds->>'startsAt')::timestamptz; v_last:=(v_bounds->>'endsAt')::timestamptz;
  if v_row->>'conflict_type'='over_capacity' then
   v_first:=date_trunc('day',v_first at time zone 'Europe/Stockholm') at time zone 'Europe/Stockholm';
   v_last:=(date_trunc('day',(v_last-interval '1 microsecond') at time zone 'Europe/Stockholm')+interval '1 day') at time zone 'Europe/Stockholm';
  end if;
  if v_start<v_first or v_end>v_last then raise exception 'booking proof denied' using errcode='42501'; end if;
 end loop;
 return v_output;
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
 raise exception 'booking proof denied' using errcode='42501';
end $$;

create function public.finalize_booking_conflicts(p_tenant_id uuid,p_actor_id uuid,p_correlation_id uuid,p_command_id uuid,
 p_booking_id uuid,p_payload jsonb,p_claims jsonb,p_output text,p_signature text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_payload jsonb; v_replay jsonb; v_secret text; v_facts jsonb; v_output jsonb; v_result jsonb;
 v_issued timestamptz; v_expires timestamptz; v_proposed uuid;
begin
 perform public.booking_detection_gate_internal(p_tenant_id,p_actor_id);
 if p_correlation_id is null then raise exception 'booking input invalid' using errcode='23514'; end if;
 v_payload:=public.booking_payload_internal(p_payload);
 v_replay:=public.booking_detection_replay_internal(p_tenant_id,p_actor_id,p_command_id,p_booking_id,v_payload);
 if v_replay is not null then return jsonb_build_object('kind','committed','bookingId',v_replay->>'bookingId'); end if;
 if p_claims is null or jsonb_typeof(p_claims)<>'object' or p_signature is null or p_signature !~ '^[0-9a-f]{64}$'
  or p_claims->>'tenantId' is distinct from p_tenant_id::text or p_claims->>'actorId' is distinct from p_actor_id::text
  or p_claims->>'operation' is distinct from (case when p_booking_id is null then 'create' else 'update' end)
  or p_claims->>'commandId' is distinct from p_command_id::text or p_claims->>'correlationId' is distinct from p_correlation_id::text
  or p_claims->>'engineVersion' is distinct from 'booking-conflicts-v1' or p_claims->>'configVersion' is distinct from 'stockholm-capacity-v1'
  or p_claims->>'candidateDigest' is distinct from public.booking_detection_digest_internal(case when p_booking_id is null then 'create' else 'update' end,p_booking_id,v_payload)
  then raise exception 'booking proof denied' using errcode='42501'; end if;
 v_proposed:=(p_claims->>'bookingId')::uuid;
 if v_proposed is null or (p_booking_id is not null and v_proposed<>p_booking_id)
  or (p_booking_id is null and exists(select 1 from public.bookings where id=v_proposed)) then raise exception 'booking proof denied' using errcode='42501'; end if;
 v_issued:=(p_claims->>'issuedAt')::timestamptz; v_expires:=(p_claims->>'expiresAt')::timestamptz;
 if v_issued is null or v_expires is null or not isfinite(v_issued) or not isfinite(v_expires)
  or v_issued>clock_timestamp() or v_expires<=clock_timestamp() or v_expires<=v_issued or v_expires>v_issued+interval '2 minutes'
  then raise exception 'booking proof denied' using errcode='42501'; end if;
 v_secret:=public.booking_conflict_key_internal(p_claims->>'keyId');
 if p_signature<>encode(extensions.hmac(public.booking_conflict_proof_bytes_internal(p_claims,p_output),convert_to(v_secret,'UTF8'),'sha256'),'hex')
  then raise exception 'booking proof denied' using errcode='42501'; end if;
 v_facts:=public.booking_detection_facts_internal(p_tenant_id);
 if p_claims->>'factDigest' is distinct from encode(extensions.digest(v_facts::text,'sha256'),'hex') then return jsonb_build_object('kind','stale'); end if;
 v_output:=public.booking_conflict_output_internal(p_tenant_id,v_proposed,v_payload,p_output);
 v_result:=public.booking_commit_conflicts_internal(p_tenant_id,p_actor_id,p_correlation_id,p_command_id,p_booking_id,v_payload,v_proposed,v_output);
 return jsonb_build_object('kind','committed','bookingId',v_result->>'bookingId');
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
 raise exception 'booking proof denied' using errcode='42501';
end $$;

-- The old compatibility RPCs may replay an authorized durable outcome; no fresh write.
create or replace function public.booking_write_internal(p_tenant_id uuid,p_actor_id uuid,p_correlation_id uuid,p_command_id uuid,p_booking_id uuid,p_payload jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare v_result jsonb;
begin
 perform public.booking_detection_gate_internal(p_tenant_id,p_actor_id);
 if p_correlation_id is null then raise exception 'booking input invalid' using errcode='23514'; end if;
 v_result:=public.booking_detection_replay_internal(p_tenant_id,p_actor_id,p_command_id,p_booking_id,public.booking_payload_internal(p_payload));
 if v_result is null then raise exception 'booking detection required' using errcode='42501'; end if;
 return v_result;
end $$;

revoke all on function public.booking_detection_gate_internal(uuid,uuid),
 public.booking_detection_digest_internal(text,uuid,jsonb),public.booking_detection_replay_internal(uuid,uuid,uuid,uuid,jsonb),
 public.booking_detection_facts_internal(uuid),public.booking_conflict_proof_bytes_internal(jsonb,text),
 public.booking_conflict_key_internal(text),public.booking_conflict_output_internal(uuid,uuid,jsonb,text)
 from public,anon,authenticated,service_role;
revoke all on function public.snapshot_booking_conflicts(uuid,uuid,uuid,uuid,uuid,jsonb,text),
 public.finalize_booking_conflicts(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,text) from public,anon,authenticated,service_role;
grant execute on function public.snapshot_booking_conflicts(uuid,uuid,uuid,uuid,uuid,jsonb,text),
 public.finalize_booking_conflicts(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,text) to authenticated;

create or replace function public.booking_commit_conflicts_internal(p_tenant_id uuid,p_actor_id uuid,p_correlation_id uuid,p_command_id uuid,p_booking_id uuid,p_payload jsonb,p_proposed_id uuid,p_conflicts jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_payload jsonb; v_digest text; v_booking public.bookings; v_id uuid; v_result jsonb;
 v_ids uuid[]; v_member public.tenant_memberships; v_profile public.person_profiles;
 v_job public.jobs; v_facility public.facilities; v_contact public.contacts;
 v_customer_id uuid; v_facility_id uuid; v_contact_id uuid; v_job_id uuid; v_work_role_id uuid;
begin
 perform public.booking_detection_gate_internal(p_tenant_id,p_actor_id);
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
 v_id:=coalesce(p_booking_id,p_proposed_id); v_result:=jsonb_build_object('bookingId',v_id);
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
 -- Full post-command derived set refreshes peers too. Keep workflow evidence
 -- only for an identical natural identity; new keys are open by table default.
 delete from public.booking_conflicts c where c.tenant_id=p_tenant_id
  and not exists(select 1 from jsonb_array_elements(p_conflicts) x where x->>'natural_key'=c.natural_key);
 insert into public.booking_conflicts(tenant_id,booking_id,related_booking_id,affected_person_profile_id,conflict_type,starts_at,ends_at,natural_key)
 select p_tenant_id,(x->>'booking_id')::uuid,(x->>'related_booking_id')::uuid,(x->>'affected_person_profile_id')::uuid,
  x->>'conflict_type',(x->>'starts_at')::timestamptz,(x->>'ends_at')::timestamptz,x->>'natural_key'
 from jsonb_array_elements(p_conflicts) x
 on conflict(tenant_id,natural_key) do nothing;
 perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_id,
  case when p_booking_id is null then 'createBooking' else 'updateBooking' end,
  case when p_booking_id is null then 'booking_created' else 'booking_updated' end,
  'booking',v_id,p_correlation_id,jsonb_build_object('targetId',v_id));
 return v_result;
end $$;
revoke all on function public.booking_commit_conflicts_internal(uuid,uuid,uuid,uuid,uuid,jsonb,uuid,jsonb) from public,anon,authenticated,service_role;

-- Exhaustive normal-tenant consumed writers: resource schedule, profile, calendar,
-- combined form (including clears), catalogue upsert/active, existing admin lifecycle/
-- roles and invitation preparation, invitation acceptance. Existing admin writers
-- already gate first; direct authenticated DML and private helper ACLs remain revoked.

create or replace function public.save_person_schedule_with_audit(
  p_tenant_id uuid, p_actor_user_id uuid, p_correlation_id uuid,
  p_person_profile_id uuid, p_schedule jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_profile public.person_profiles; v_shift jsonb; v_break jsonb; v_other jsonb; v_first_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text,0));
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

create or replace function public.upsert_person_profile_with_audit(p_tenant_id uuid,p_actor_user_id uuid,p_correlation_id uuid,p_membership_id uuid,p_work_role_id uuid,p_employment_percentage smallint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_profile public.person_profiles; v_member public.tenant_memberships; v_id uuid; v_is_new boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text,0));
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

create or replace function public.upsert_tenant_calendar_day_with_audit(p_tenant_id uuid,p_actor_user_id uuid,p_correlation_id uuid,p_local_date date,p_variant text,p_reduction_percent smallint)
returns uuid language plpgsql security definer set search_path = '' as $$ declare v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text,0));
 if auth.uid() is null or auth.uid() <> p_actor_user_id or not public.has_tenant_role(p_tenant_id,array['tenant_admin','projektledare']) then raise exception 'resource calendar denied' using errcode='42501'; end if;
 insert into public.tenant_calendar_days(tenant_id,local_date,variant,reduction_percent) values(p_tenant_id,p_local_date,p_variant,p_reduction_percent)
 on conflict(tenant_id,local_date) do update set variant=excluded.variant,reduction_percent=excluded.reduction_percent,updated_at=statement_timestamp() returning id into v_id;
 perform public.story_11_2_record_audit_event_internal(p_tenant_id,auth.uid(),'resources.calendar_day.save','resource_calendar_day_saved','tenant_calendar_day',v_id,p_correlation_id,jsonb_build_object('targetId',v_id)); return v_id;
end $$;

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
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text,0));
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

create or replace function public.upsert_work_role_with_audit(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_correlation_id uuid,
  p_work_role_id uuid,
  p_display_name text,
  p_cost_rate_ore bigint,
  p_sell_rate_ore bigint
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text,0));
  perform public.story_11_2_assert_pricing_roles(p_tenant_id, p_actor_user_id);
  if p_correlation_id is null
     or p_display_name is null
     or btrim(p_display_name) = ''
     or length(btrim(p_display_name)) > 256
     or p_cost_rate_ore is null
     or p_cost_rate_ore < 0
     or p_cost_rate_ore > 9007199254740991
     or p_sell_rate_ore is null
     or p_sell_rate_ore < 0
     or p_sell_rate_ore > 9007199254740991 then
    raise exception 'invalid work role payload' using errcode = '23514';
  end if;

  if p_work_role_id is null then
    insert into public.work_roles (
      tenant_id, display_name, cost_rate_ore, sell_rate_ore
    ) values (
      p_tenant_id, btrim(p_display_name), p_cost_rate_ore, p_sell_rate_ore
    ) returning id into v_id;
  else
    update public.work_roles
       set display_name = btrim(p_display_name),
           cost_rate_ore = p_cost_rate_ore,
           sell_rate_ore = p_sell_rate_ore
     where tenant_id = p_tenant_id
       and id = p_work_role_id
     returning id into v_id;
    if not found then
      raise exception 'work role target missing' using errcode = '42501';
    end if;
  end if;

  perform public.story_11_2_record_audit_event_internal(
    p_tenant_id, p_actor_user_id, 'work_role.upsert', 'work_role.upserted',
    'work_role', v_id, p_correlation_id, '{}'::jsonb
  );
  return v_id;
end;
$$;

create or replace function public.set_work_role_active_with_audit(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_correlation_id uuid,
  p_work_role_id uuid,
  p_is_active boolean
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text,0));
  perform public.story_11_2_assert_pricing_roles(p_tenant_id, p_actor_user_id);
  if p_correlation_id is null or p_work_role_id is null or p_is_active is null then
    raise exception 'invalid work role lifecycle payload' using errcode = '23514';
  end if;
  update public.work_roles
     set is_active = p_is_active
   where tenant_id = p_tenant_id
     and id = p_work_role_id
   returning id into v_id;
  if not found then
    raise exception 'work role target missing' using errcode = '42501';
  end if;
  perform public.story_11_2_record_audit_event_internal(
    p_tenant_id, p_actor_user_id,
    case when p_is_active then 'work_role.reactivate' else 'work_role.archive' end,
    case when p_is_active then 'work_role.reactivated' else 'work_role.archived' end,
    'work_role', v_id, p_correlation_id, '{}'::jsonb
  );
  return v_id;
end;
$$;

create or replace function public.admin_accept_membership_invitation(
  p_membership_id uuid, p_token_hash text, p_user_id uuid, p_email text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_membership public.tenant_memberships;
  v_operation public.membership_admin_operations;
  v_authenticated_user_id uuid := auth.uid();
  v_authenticated_email text;
  v_discovered_tenant uuid;
begin
  -- The supplied user id is retained only to fail closed for stale clients. The
  -- authoritative id and email come from the authenticated, confirmed Auth row.
  if v_authenticated_user_id is null or v_authenticated_user_id <> p_user_id then
    return false;
  end if;

  select lower(trim(u.email))
    into v_authenticated_email
    from auth.users u
   where u.id = v_authenticated_user_id
     and u.email_confirmed_at is not null;
  if v_authenticated_email is null then
    return false;
  end if;

  -- Discover without locking, gate first, then reload/lock and revalidate tenant.
  select tenant_id into v_discovered_tenant from public.tenant_memberships where id=p_membership_id;
  if not found then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_discovered_tenant::text,0));
  -- Revalidate confirmed Auth identity after any tenant-gate wait as well.
  select lower(trim(u.email)) into v_authenticated_email from auth.users u
   where u.id=v_authenticated_user_id and u.email_confirmed_at is not null;
  if v_authenticated_email is null then return false; end if;
  select * into v_membership
    from public.tenant_memberships
   where id = p_membership_id
   for update;
  if not found
     or v_membership.tenant_id is distinct from v_discovered_tenant
     or v_membership.status <> 'invited'
     or v_membership.invited_email is null
     or lower(trim(v_membership.invited_email)) <> v_authenticated_email then
    return false;
  end if;

  if v_membership.invitation_expires_at <= statement_timestamp() then
    update public.tenant_memberships
       set status = 'expired'
     where id = p_membership_id;
    return false;
  end if;

  select * into v_operation
    from public.membership_admin_operations
   where membership_id = p_membership_id
     and action in ('invite', 'resend')
     and outcome in ('succeeded', 'uncertain')
     and superseded_at is null
     and invitation_token_hash = p_token_hash
   order by created_at desc
   limit 1
   for update;
  if not found then
    return false;
  end if;

  update public.tenant_memberships
     set user_id = v_authenticated_user_id,
         status = 'active',
         updated_at = statement_timestamp()
   where id = p_membership_id;
  perform public.story_11_2_record_audit_event_internal(
    v_membership.tenant_id,
    v_authenticated_user_id,
    'admin-users.accept-invite',
    'membership_activated',
    'tenant_membership',
    p_membership_id,
    v_operation.id,
    '{}'::jsonb
  );
  return true;
end $$;
