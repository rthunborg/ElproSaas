-- Story 14.4: browser review is separate from detector output, and all writes
-- share the existing tenant gate and atomic booking/assignee/conflict/audit commit.
create function public.booking_editor_decision_internal(p_decision jsonb)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare v_reviewed jsonb; v_selected jsonb; v_reason text; v_ack boolean;
begin
 if p_decision is null then return jsonb_build_object('acknowledged',false,'reviewedLogicalIds','[]'::jsonb,'selectedLogicalIds','[]'::jsonb,'reason',''); end if;
 if jsonb_typeof(p_decision)<>'object' or (select count(*) from jsonb_object_keys(p_decision))<>4
  or not(p_decision ?& array['acknowledged','reviewedLogicalIds','selectedLogicalIds','reason'])
  or jsonb_typeof(p_decision->'acknowledged')<>'boolean' or jsonb_typeof(p_decision->'reason')<>'string'
  or jsonb_typeof(p_decision->'reviewedLogicalIds')<>'array' or jsonb_typeof(p_decision->'selectedLogicalIds')<>'array'
  then raise exception 'booking decision invalid' using errcode='23514'; end if;
 if exists(select 1 from jsonb_array_elements(p_decision->'reviewedLogicalIds') x where jsonb_typeof(x)<>'string' or length(x#>>'{}') not between 1 and 4000)
  or exists(select 1 from jsonb_array_elements(p_decision->'selectedLogicalIds') x where jsonb_typeof(x)<>'string' or length(x#>>'{}') not between 1 and 4000)
  or (select count(*)<>count(distinct value) from jsonb_array_elements(p_decision->'reviewedLogicalIds'))
  or (select count(*)<>count(distinct value) from jsonb_array_elements(p_decision->'selectedLogicalIds'))
  then raise exception 'booking decision invalid' using errcode='23514'; end if;
 select coalesce(jsonb_agg(value order by value#>>'{}' collate "C"),'[]'::jsonb) into v_reviewed from jsonb_array_elements(p_decision->'reviewedLogicalIds');
 select coalesce(jsonb_agg(value order by value#>>'{}' collate "C"),'[]'::jsonb) into v_selected from jsonb_array_elements(p_decision->'selectedLogicalIds');
 v_reason:=regexp_replace(p_decision->>'reason','^\s+|\s+$','','g'); v_ack:=(p_decision->>'acknowledged')::boolean;
 if length(v_reason)>2000 or not(v_reviewed @> v_selected)
  or (jsonb_array_length(v_reviewed)>0 and (not v_ack or v_reason=''))
  or (jsonb_array_length(v_reviewed)=0 and (v_ack or v_reason<>'' or jsonb_array_length(v_selected)>0))
  then raise exception 'booking decision invalid' using errcode='23514'; end if;
 return jsonb_build_object('acknowledged',v_ack,'reviewedLogicalIds',v_reviewed,'selectedLogicalIds',v_selected,'reason',v_reason);
end $$;

create function public.booking_editor_digest_internal(p_booking_id uuid,p_proposed_id uuid,p_payload jsonb,p_decision jsonb)
returns text language sql immutable security invoker set search_path='' as $$
 select encode(extensions.digest(jsonb_build_object('version','booking-editor-v1','operation',case when p_booking_id is null then 'create' else 'update' end,
  'bookingId',p_booking_id,'proposedBookingId',case when p_booking_id is null then p_proposed_id else null end,
  'payload',p_payload,'decision',public.booking_editor_decision_internal(p_decision))::text,'sha256'),'hex');
$$;

create function public.booking_editor_replay_internal(p_tenant_id uuid,p_actor_id uuid,p_command_id uuid,p_booking_id uuid,p_proposed_id uuid,p_payload jsonb,p_decision jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare v_booking public.bookings; v_digest text; v_saved text; v_result jsonb;
begin
 perform public.booking_detection_gate_internal(p_tenant_id,p_actor_id);
 if p_command_id is null or p_proposed_id is null then raise exception 'booking input invalid' using errcode='23514'; end if;
 v_digest:=public.booking_editor_digest_internal(p_booking_id,p_proposed_id,p_payload,p_decision);
 if p_booking_id is null then
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_command_id::text,0));
  select * into v_booking from public.bookings where tenant_id=p_tenant_id and create_command_id=p_command_id;
  if not found then return null; end if;
  v_saved:=v_booking.create_payload_digest; v_result:=v_booking.create_result;
 else
  select * into v_booking from public.bookings where tenant_id=p_tenant_id and id=p_booking_id for update;
  if not found then raise exception 'booking denied' using errcode='42501'; end if;
  if not(v_booking.update_outcomes ? p_command_id::text) then return null; end if;
  v_saved:=v_booking.update_outcomes->p_command_id::text->>'digest'; v_result:=v_booking.update_outcomes->p_command_id::text->'result';
 end if;
 -- Preserve historical booking-only outcomes only for explicitly absent editor
 -- decisions. A new reviewed decision can never borrow a historical digest.
 if v_saved<>v_digest and not(p_decision is null and v_saved=public.booking_detection_digest_internal(
  case when p_booking_id is null then 'create' else 'update' end,p_booking_id,p_payload)) then
  raise exception 'booking command conflict' using errcode='BK409';
 end if;
 perform 1 from public.tenant_memberships where tenant_id=p_tenant_id and user_id=p_actor_id order by id for share;
 if not public.has_tenant_role(p_tenant_id,array['tenant_admin','projektledare']) then raise exception 'booking denied' using errcode='42501'; end if;
 return v_result;
end $$;

create function public.snapshot_booking_editor(p_tenant_id uuid,p_actor_id uuid,p_correlation_id uuid,p_command_id uuid,
 p_booking_id uuid,p_proposed_id uuid,p_payload jsonb,p_key_id text,p_decision jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_payload jsonb; v_replay jsonb; v_facts jsonb; v_issued timestamptz; v_id uuid;
begin
 perform public.booking_detection_gate_internal(p_tenant_id,p_actor_id);
 if p_correlation_id is null then raise exception 'booking input invalid' using errcode='23514'; end if;
 v_payload:=public.booking_payload_internal(p_payload);
 v_replay:=public.booking_editor_replay_internal(p_tenant_id,p_actor_id,p_command_id,p_booking_id,p_proposed_id,v_payload,p_decision);
 if v_replay is not null then return jsonb_build_object('kind','replay','result',v_replay); end if;
 perform public.booking_conflict_key_internal(p_key_id);
 v_facts:=public.booking_detection_facts_internal(p_tenant_id); v_id:=coalesce(p_booking_id,p_proposed_id); v_issued:=clock_timestamp();
 if p_booking_id is null and exists(select 1 from public.bookings where id=v_id) then raise exception 'booking denied' using errcode='42501'; end if;
 return jsonb_build_object('kind','snapshot','tenantId',p_tenant_id,'actorId',p_actor_id,'operation',case when p_booking_id is null then 'create' else 'update' end,
  'commandId',p_command_id,'bookingId',v_id,'candidate',v_payload,
  'candidateDigest',public.booking_detection_digest_internal(case when p_booking_id is null then 'create' else 'update' end,p_booking_id,v_payload),
  'canonicalFacts',v_facts::text,'factDigest',encode(extensions.digest(v_facts::text,'sha256'),'hex'),
  'engineVersion','booking-conflicts-v2','configVersion','stockholm-capacity-v1','correlationId',p_correlation_id,'keyId',p_key_id,
  'issuedAt',to_char(v_issued at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'expiresAt',to_char((v_issued+interval '2 minutes') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
end $$;

create function public.booking_editor_proof_bytes_internal(p_claims jsonb,p_groups text)
returns bytea language sql immutable security invoker set search_path='' as $$
 select convert_to('30:elpro.booking-editor.review.v1','UTF8') || public.booking_conflict_proof_bytes_internal(p_claims,p_groups);
$$;

create function public.finalize_booking_editor(p_tenant_id uuid,p_actor_id uuid,p_correlation_id uuid,p_command_id uuid,
 p_booking_id uuid,p_proposed_id uuid,p_payload jsonb,p_claims jsonb,p_output text,p_signature text,
 p_review_claims jsonb,p_review_groups text,p_review_signature text,p_decision jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_payload jsonb; v_replay jsonb; v_secret text; v_facts jsonb; v_output jsonb; v_result jsonb;
 v_issued timestamptz; v_expires timestamptz; v_proposed uuid; v_groups jsonb; v_decision jsonb; v_field text; v_group jsonb;
begin
 perform public.booking_detection_gate_internal(p_tenant_id,p_actor_id);
 if p_correlation_id is null then raise exception 'booking input invalid' using errcode='23514'; end if;
 v_payload:=public.booking_payload_internal(p_payload); v_decision:=public.booking_editor_decision_internal(p_decision);
 v_replay:=public.booking_editor_replay_internal(p_tenant_id,p_actor_id,p_command_id,p_booking_id,p_proposed_id,v_payload,p_decision);
 if v_replay is not null then return jsonb_build_object('kind','committed','bookingId',v_replay->>'bookingId'); end if;
 if p_claims is null or jsonb_typeof(p_claims)<>'object' or p_signature is null or p_signature !~ '^[0-9a-f]{64}$'
  or p_claims->>'tenantId' is distinct from p_tenant_id::text or p_claims->>'actorId' is distinct from p_actor_id::text
  or p_claims->>'operation' is distinct from (case when p_booking_id is null then 'create' else 'update' end)
  or p_claims->>'commandId' is distinct from p_command_id::text or p_claims->>'correlationId' is distinct from p_correlation_id::text
  or p_claims->>'engineVersion' is distinct from 'booking-conflicts-v2' or p_claims->>'configVersion' is distinct from 'stockholm-capacity-v1'
  or p_claims->>'candidateDigest' is distinct from public.booking_detection_digest_internal(case when p_booking_id is null then 'create' else 'update' end,p_booking_id,v_payload)
  then raise exception 'booking proof denied' using errcode='42501'; end if;
 v_proposed:=coalesce(p_booking_id,p_proposed_id);
 if v_proposed is null or p_claims->>'bookingId' is distinct from v_proposed::text
  or (p_booking_id is null and exists(select 1 from public.bookings where id=v_proposed)) then raise exception 'booking proof denied' using errcode='42501'; end if;
 v_issued:=(p_claims->>'issuedAt')::timestamptz; v_expires:=(p_claims->>'expiresAt')::timestamptz;
 if v_issued is null or v_expires is null or not isfinite(v_issued) or not isfinite(v_expires) or v_issued>clock_timestamp()
  or v_expires<=v_issued or v_expires>v_issued+interval '2 minutes' then raise exception 'booking proof denied' using errcode='42501'; end if;
 v_secret:=public.booking_conflict_key_internal(p_claims->>'keyId');
 if p_signature<>encode(extensions.hmac(public.booking_conflict_proof_bytes_internal(p_claims,p_output),convert_to(v_secret,'UTF8'),'sha256'),'hex')
  then raise exception 'booking proof denied' using errcode='42501'; end if;
 v_facts:=public.booking_detection_facts_internal(p_tenant_id);
 if p_claims->>'factDigest' is distinct from encode(extensions.digest(v_facts::text,'sha256'),'hex') or v_expires<=clock_timestamp() then return jsonb_build_object('kind','stale'); end if;
 v_output:=public.booking_conflict_output_internal(p_tenant_id,v_proposed,v_payload,p_output);
 if p_review_claims is null or jsonb_typeof(p_review_claims)<>'object' or p_review_signature is null or p_review_signature !~ '^[0-9a-f]{64}$'
  then raise exception 'booking review required' using errcode='BR428'; end if;
 foreach v_field in array array['tenantId','actorId','operation','commandId','bookingId','candidateDigest','factDigest','engineVersion','configVersion','keyId'] loop
  if p_review_claims->>v_field is distinct from p_claims->>v_field then raise exception 'booking review stale' using errcode='BR409'; end if;
 end loop;
 v_issued:=(p_review_claims->>'issuedAt')::timestamptz; v_expires:=(p_review_claims->>'expiresAt')::timestamptz;
 if v_issued is null or v_expires is null or not isfinite(v_issued) or not isfinite(v_expires) or v_issued>clock_timestamp()
  or v_expires<=v_issued or v_expires>v_issued+interval '2 minutes' then raise exception 'booking review denied' using errcode='42501'; end if;
 if p_review_signature<>encode(extensions.hmac(public.booking_editor_proof_bytes_internal(p_review_claims,p_review_groups),convert_to(v_secret,'UTF8'),'sha256'),'hex')
  then raise exception 'booking review denied' using errcode='42501'; end if;
 if v_expires<=clock_timestamp() then raise exception 'booking review stale' using errcode='BR409'; end if;
 v_groups:=p_review_groups::jsonb;
 if jsonb_typeof(v_groups)<>'array' or (select count(*)<>count(distinct value->>'logicalId') from jsonb_array_elements(v_groups)) then raise exception 'booking review denied' using errcode='42501'; end if;
 if v_decision->'reviewedLogicalIds' is distinct from (select coalesce(jsonb_agg(value->'logicalId' order by value->>'logicalId' collate "C"),'[]'::jsonb) from jsonb_array_elements(v_groups)) then raise exception 'booking review stale' using errcode='BR409'; end if;
 for v_group in select value from jsonb_array_elements(v_groups) loop
  if not(v_group->'bookingIds' ? v_proposed::text) or jsonb_typeof(v_group->'keys')<>'array' or jsonb_array_length(v_group->'keys')=0
   or exists(select 1 from jsonb_array_elements_text(v_group->'keys') k where not exists(select 1 from jsonb_array_elements(v_output) x where x->>'natural_key'=k))
   then raise exception 'booking review denied' using errcode='42501'; end if;
 end loop;
 v_result:=public.booking_commit_editor_internal(p_tenant_id,p_actor_id,p_correlation_id,p_command_id,p_booking_id,v_payload,v_proposed,v_output,v_groups,v_decision);
 return jsonb_build_object('kind','committed','bookingId',v_result->>'bookingId');
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then raise exception 'booking proof denied' using errcode='42501';
end $$;

-- Obsolete authenticated finalization is replay-only. It cannot bypass review
-- even with valid detector signing material from an earlier deployment.
create or replace function public.finalize_booking_conflicts(p_tenant_id uuid,p_actor_id uuid,p_correlation_id uuid,p_command_id uuid,
 p_booking_id uuid,p_payload jsonb,p_claims jsonb,p_output text,p_signature text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_result jsonb;
begin
 perform public.booking_detection_gate_internal(p_tenant_id,p_actor_id);
 v_result:=public.booking_detection_replay_internal(p_tenant_id,p_actor_id,p_command_id,p_booking_id,public.booking_payload_internal(p_payload));
 if v_result is null then raise exception 'booking review required' using errcode='BR428'; end if;
 return jsonb_build_object('kind','committed','bookingId',v_result->>'bookingId');
end $$;

create function public.booking_editor_people(p_tenant_id uuid,p_actor_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 perform public.booking_detection_gate_internal(p_tenant_id,p_actor_id);
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'default_work_role_id',p.default_work_role_id) order by p.id)
  from public.person_profiles p join public.tenant_memberships m on m.id=p.membership_id and m.tenant_id=p.tenant_id
  where p.tenant_id=p_tenant_id and p.archived_at is null and m.status='active'),'[]'::jsonb);
end $$;

revoke all on function public.booking_editor_decision_internal(jsonb),public.booking_editor_digest_internal(uuid,uuid,jsonb,jsonb),
 public.booking_editor_replay_internal(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb),public.booking_editor_proof_bytes_internal(jsonb,text),
 public.snapshot_booking_editor(uuid,uuid,uuid,uuid,uuid,uuid,jsonb,text,jsonb),
 public.finalize_booking_editor(uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,text,jsonb,text,text,jsonb),
 public.booking_editor_people(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.snapshot_booking_editor(uuid,uuid,uuid,uuid,uuid,uuid,jsonb,text,jsonb),
 public.finalize_booking_editor(uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,text,jsonb,text,text,jsonb),public.booking_editor_people(uuid,uuid) to authenticated;
create or replace function public.booking_commit_editor_internal(p_tenant_id uuid,p_actor_id uuid,p_correlation_id uuid,p_command_id uuid,p_booking_id uuid,p_payload jsonb,p_proposed_id uuid,p_conflicts jsonb,p_groups jsonb,p_decision jsonb)
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
 v_digest:=public.booking_editor_digest_internal(p_booking_id,p_proposed_id,v_payload,p_decision);
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
 -- The authenticated group map expands the selected logical decision to every
 -- base/association key. Unselected groups and identical prior evidence survive.
 update public.booking_conflicts c set status='accepted',acceptance_reason=p_decision->>'reason',
  accepted_by_membership_id=(select m.id from public.tenant_memberships m where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'),
  accepted_at=clock_timestamp(),resolved_at=null
 where c.tenant_id=p_tenant_id and c.status='open' and exists(
  select 1 from jsonb_array_elements(p_groups) g, jsonb_array_elements_text(g->'keys') k
  where p_decision->'selectedLogicalIds' ? (g->>'logicalId') and k=c.natural_key);
 perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_id,
  case when p_booking_id is null then 'createBooking' else 'updateBooking' end,
  case when p_booking_id is null then 'booking_created' else 'booking_updated' end,
  'booking',v_id,p_correlation_id,jsonb_build_object('targetId',v_id));
 return v_result;
end $$;
revoke all on function public.booking_commit_editor_internal(uuid,uuid,uuid,uuid,uuid,jsonb,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;

