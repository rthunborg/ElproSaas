-- Exact workflow identity verification, not a second detector. A signed group
-- must expand to the entire v1/v2 projection of its complete engine identity.
create or replace function public.booking_editor_groups_internal(p_groups jsonb,p_output jsonb,p_candidate uuid)
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
  and not exists(select 1 from jsonb_array_elements(p_groups) covered where covered->'keys' ? (x->>'natural_key')))
  then raise exception 'booking review required' using errcode='BR428'; end if;
end $$;
revoke all on function public.booking_editor_groups_internal(jsonb,jsonb,uuid) from public,anon,authenticated,service_role;
