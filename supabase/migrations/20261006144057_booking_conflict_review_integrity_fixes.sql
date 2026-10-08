-- Story 14.3 first-review integrity repairs. Prior migrations remain immutable.
-- Version v2 requires complete aggregate participant associations; historical replay remains authorized.
create or replace function public.snapshot_booking_conflicts(p_tenant_id uuid,p_actor_id uuid,p_correlation_id uuid,p_command_id uuid,
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
  'engineVersion','booking-conflicts-v2','configVersion','stockholm-capacity-v1','correlationId',p_correlation_id,'keyId',p_key_id,
  'issuedAt',to_char(v_issued at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'expiresAt',to_char((v_issued+interval '2 minutes') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
end $$;

create or replace function public.finalize_booking_conflicts(p_tenant_id uuid,p_actor_id uuid,p_correlation_id uuid,p_command_id uuid,
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
  or p_claims->>'engineVersion' is distinct from 'booking-conflicts-v2' or p_claims->>'configVersion' is distinct from 'stockholm-capacity-v1'
  or p_claims->>'candidateDigest' is distinct from public.booking_detection_digest_internal(case when p_booking_id is null then 'create' else 'update' end,p_booking_id,v_payload)
  then raise exception 'booking proof denied' using errcode='42501'; end if;
 v_proposed:=(p_claims->>'bookingId')::uuid;
 if v_proposed is null or (p_booking_id is not null and v_proposed<>p_booking_id)
  or (p_booking_id is null and exists(select 1 from public.bookings where id=v_proposed)) then raise exception 'booking proof denied' using errcode='42501'; end if;
 v_issued:=(p_claims->>'issuedAt')::timestamptz; v_expires:=(p_claims->>'expiresAt')::timestamptz;
 if v_issued is null or v_expires is null or not isfinite(v_issued) or not isfinite(v_expires)
  or v_issued>clock_timestamp()  or v_expires<=v_issued or v_expires>v_issued+interval '2 minutes'
  then raise exception 'booking proof denied' using errcode='42501'; end if;
 v_secret:=public.booking_conflict_key_internal(p_claims->>'keyId');
 if p_signature<>encode(extensions.hmac(public.booking_conflict_proof_bytes_internal(p_claims,p_output),convert_to(v_secret,'UTF8'),'sha256'),'hex')
  then raise exception 'booking proof denied' using errcode='42501'; end if;
 v_facts:=public.booking_detection_facts_internal(p_tenant_id);
 if p_claims->>'factDigest' is distinct from encode(extensions.digest(v_facts::text,'sha256'),'hex') then return jsonb_build_object('kind','stale'); end if;
 v_output:=public.booking_conflict_output_internal(p_tenant_id,v_proposed,v_payload,p_output);
 -- Only authenticated, bound, correctly signed, otherwise valid expiry is stale.
 -- Invalid chronology/future issuance/oversized lifetime/HMAC remains denied.
 if v_expires<=clock_timestamp() then return jsonb_build_object('kind','stale'); end if;
 v_result:=public.booking_commit_conflicts_internal(p_tenant_id,p_actor_id,p_correlation_id,p_command_id,p_booking_id,v_payload,v_proposed,v_output);
 return jsonb_build_object('kind','committed','bookingId',v_result->>'bookingId');
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
 raise exception 'booking proof denied' using errcode='42501';
end $$;

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

  -- The operation FOR UPDATE can wait without the tenant gate in its writer.
  -- Revalidate confirmed identity and current expiry after all blocking locks.
  select lower(trim(u.email)) into v_authenticated_email from auth.users u
   where u.id=v_authenticated_user_id and u.email_confirmed_at is not null;
  if v_authenticated_email is null or lower(trim(v_membership.invited_email)) <> v_authenticated_email then
    return false;
  end if;

  if v_membership.invitation_expires_at <= clock_timestamp() then
    update public.tenant_memberships
       set status = 'expired'
     where id = p_membership_id;
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
