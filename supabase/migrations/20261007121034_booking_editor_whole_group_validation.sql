-- Exact workflow identity verification, not a second detector. A signed group
-- must expand to the entire v1/v2 projection of its complete engine identity.
create function public.booking_editor_groups_internal(p_groups jsonb,p_output jsonb,p_candidate uuid)
returns void language plpgsql immutable security invoker set search_path='' as $$
declare g jsonb; identity jsonb; logical jsonb; v_raw text; v_person text; v_expected jsonb; v_key text; v_booking text; v_base jsonb;
begin
 for g in select value from jsonb_array_elements(p_groups) loop
  if jsonb_typeof(g)<>'object' or (select count(*) from jsonb_object_keys(g))<>7
   or not(g ?& array['logicalId','keys','personId','bookingIds','rule','startsAt','endsAt'])
   then raise exception 'booking review denied' using errcode='42501'; end if;
  logical:=(g->>'logicalId')::jsonb;
  if jsonb_typeof(logical)<>'array' or jsonb_array_length(logical)<>2 then raise exception 'booking review denied' using errcode='42501'; end if;
  v_raw:=logical->>0; v_person:=logical->>1; identity:=v_raw::jsonb;
  if jsonb_typeof(identity)<>'array' or jsonb_array_length(identity)<>5 or jsonb_typeof(identity->1)<>'array' or jsonb_typeof(identity->2)<>'array'
   or g->>'logicalId' is distinct from '[' || to_json(v_raw)::text || ',' || to_json(v_person)::text || ']'
   or g->>'personId' is distinct from v_person or not(identity->2 ? v_person)
   or g->'bookingIds' is distinct from identity->1 or not(identity->1 ? p_candidate::text)
   or jsonb_array_length(identity->1)=0 or g->>'rule' is distinct from identity->>0
   or g->>'startsAt' is distinct from identity->>3 or g->>'endsAt' is distinct from identity->>4
   then raise exception 'booking review denied' using errcode='42501'; end if;
  v_key:='v1:' || encode(extensions.digest(g->>'logicalId','sha256'),'hex');
  v_expected:=jsonb_build_array(v_key);
  v_base:=jsonb_build_object('booking_id',identity->1->0,'related_booking_id',coalesce(identity->1->1,'null'::jsonb),
   'affected_person_profile_id',v_person,'conflict_type',identity->0,'starts_at',identity->3,'ends_at',identity->4,'natural_key',v_key);
  if not(p_output @> jsonb_build_array(v_base)) then raise exception 'booking review denied' using errcode='42501'; end if;
  for v_booking in select value#>>'{}' from jsonb_array_elements(identity->1) with ordinality a(value,n) where n>=3 loop
   v_key:='v2:' || encode(extensions.digest(left(g->>'logicalId',-1) || ',' || to_json(v_booking)::text || ']','sha256'),'hex');
   v_expected:=v_expected || jsonb_build_array(v_key);
   if not(p_output @> jsonb_build_array(v_base || jsonb_build_object('booking_id',v_booking,'related_booking_id',identity->1->0,'natural_key',v_key)))
    then raise exception 'booking review denied' using errcode='42501'; end if;
  end loop;
  select jsonb_agg(value order by value#>>'{}' collate "C") into v_expected from jsonb_array_elements(v_expected);
  if g->'keys' is distinct from v_expected then raise exception 'booking review denied' using errcode='42501'; end if;
 end loop;
 -- Every candidate-related persistence row needs its whole reviewed identity,
 -- including the candidate's v2 association when it sorts third or later.
 if exists(select 1 from jsonb_array_elements(p_output) x where (x->>'booking_id'=p_candidate::text or x->>'related_booking_id'=p_candidate::text)
  and not exists(select 1 from jsonb_array_elements(p_groups) g where g->'keys' ? (x->>'natural_key')))
  then raise exception 'booking review required' using errcode='BR428'; end if;
end $$;
revoke all on function public.booking_editor_groups_internal(jsonb,jsonb,uuid) from public,anon,authenticated,service_role;
create or replace function public.booking_editor_decision_internal(p_decision jsonb)
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
  or (jsonb_array_length(v_reviewed)>0 and v_ack and v_reason='')
  or (jsonb_array_length(v_reviewed)=0 and (v_ack or v_reason<>'' or jsonb_array_length(v_selected)>0))
  then raise exception 'booking decision invalid' using errcode='23514'; end if;
 return jsonb_build_object('acknowledged',v_ack,'reviewedLogicalIds',v_reviewed,'selectedLogicalIds',v_selected,'reason',v_reason);
end $$;

create or replace function public.finalize_booking_editor(p_tenant_id uuid,p_actor_id uuid,p_correlation_id uuid,p_command_id uuid,
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
 perform public.booking_editor_groups_internal(v_groups,v_output,v_proposed);
 if jsonb_array_length(v_groups)>0 and (not (v_decision->>'acknowledged')::boolean or v_decision->>'reason'='') then
  raise exception 'booking review required' using errcode='BR428';
 end if;
 v_result:=public.booking_commit_editor_internal(p_tenant_id,p_actor_id,p_correlation_id,p_command_id,p_booking_id,v_payload,v_proposed,v_output,v_groups,v_decision);
 return jsonb_build_object('kind','committed','bookingId',v_result->>'bookingId');
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then raise exception 'booking proof denied' using errcode='42501';
end $$;

