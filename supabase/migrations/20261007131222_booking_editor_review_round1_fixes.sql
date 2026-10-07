-- Story 14.4 Round1: authenticated logical identities have no unrelated description-size limit.
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
 if exists(select 1 from jsonb_array_elements(p_decision->'reviewedLogicalIds') x where jsonb_typeof(x)<>'string' or length(x#>>'{}') < 1)
  or exists(select 1 from jsonb_array_elements(p_decision->'selectedLogicalIds') x where jsonb_typeof(x)<>'string' or length(x#>>'{}') < 1)
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

-- Only recognizable staff identity, under the unchanged checked management gate.
create or replace function public.booking_editor_people(p_tenant_id uuid,p_actor_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 perform public.booking_detection_gate_internal(p_tenant_id,p_actor_id);
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'default_work_role_id',p.default_work_role_id,
  'label',coalesce(nullif(btrim(m.invited_email),''),nullif(btrim(u.email),''))) order by p.id)
  from public.person_profiles p join public.tenant_memberships m on m.id=p.membership_id and m.tenant_id=p.tenant_id
  left join auth.users u on u.id=m.user_id
  where p.tenant_id=p_tenant_id and p.archived_at is null and m.status='active'),'[]'::jsonb);
end $$;
revoke all on function public.booking_editor_decision_internal(jsonb),public.booking_editor_people(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.booking_editor_people(uuid,uuid) to authenticated;