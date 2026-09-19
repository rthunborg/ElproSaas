-- Story 12.1 / owner Decision 8A. This migration replaces every callable legacy
-- provisioning path with the one normal-JWT + server-attestation boundary.

do $$ begin
  create role provisioning_function_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication;
exception when duplicate_object then null; end $$;
-- The migration executor needs membership solely to transfer object ownership;
-- this does not make any JWT/runtime role a member of the owner role.
grant provisioning_function_owner to postgres;
-- PostgreSQL requires CREATE temporarily when transferring ownership within a
-- schema; revoke it immediately after the two owner assignments below.
grant usage, create on schema public to provisioning_function_owner;

create table if not exists public.tenant_provisioning_baselines (
  baseline_id text not null,
  version integer not null check (version > 0),
  canonical_content jsonb not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  published_at timestamptz not null default statement_timestamp(),
  primary key (baseline_id, version), unique (baseline_id, content_hash)
);
alter table public.tenant_provisioning_baselines enable row level security;
alter table public.tenant_provisioning_baselines force row level security;
insert into public.tenant_provisioning_baselines(baseline_id,version,canonical_content,content_hash)
values ('standard-se',1,'{"id":"standard-se","version":1,"locale":"sv-SE","timeZone":"Europe/Stockholm","currency":"SEK","displayDefaults":"conservative","termsPlaceholder":true}'::jsonb,
 encode(extensions.digest(convert_to('{"id":"standard-se","version":1,"locale":"sv-SE","timeZone":"Europe/Stockholm","currency":"SEK","displayDefaults":"conservative","termsPlaceholder":true}','UTF8'),'sha256'),'hex'))
on conflict do nothing;
revoke all on public.tenant_provisioning_baselines from public, anon, authenticated, service_role;

alter table public.tenant_provisioning_invites add column if not exists reservation_id uuid;
alter table public.tenant_provisioning_invites add column if not exists dispatch_generation integer not null default 0;
alter table public.tenant_provisioning_invites add column if not exists approval_generation integer not null default 0;
alter table public.tenant_provisioning_invites add column if not exists sanitized_failure_code text;
alter table public.tenant_provisioning_invites add column if not exists revoked_token_hash text;
alter table public.tenant_provisioning_requests add column if not exists approval_generation integer not null default 0;
alter table public.tenant_provisioning_requests add column if not exists baseline_content_hash text;
alter table public.tenant_provisioning_requests add column if not exists provisioning_state text;

-- Runtime roles have neither catalogue nor provisioning-table access. The owner
-- gets only the tables and sequences used by the sole RPC.
revoke all on public.tenant_provisioning_requests, public.tenant_provisioning_invites, public.tenant_provisioning_baselines from public, anon, authenticated, service_role;
grant select,insert,update on public.tenant_provisioning_requests, public.tenant_provisioning_invites to provisioning_function_owner;
grant select on public.tenant_provisioning_baselines to provisioning_function_owner;
grant insert on public.tenants, public.tenant_memberships, public.membership_roles, public.membership_admin_operations, public.audit_events to provisioning_function_owner;
grant update(provisioning_state) on public.tenants to provisioning_function_owner;
grant usage on all sequences in schema public to provisioning_function_owner;
-- These policies admit only the non-login function owner. JWT roles remain
-- denied even if a future accidental table grant is introduced.
drop policy if exists provisioning_owner_tenants on public.tenants;
create policy provisioning_owner_tenants on public.tenants for all to provisioning_function_owner using (true) with check (true);
drop policy if exists provisioning_owner_memberships on public.tenant_memberships;
create policy provisioning_owner_memberships on public.tenant_memberships for all to provisioning_function_owner using (true) with check (true);
drop policy if exists provisioning_owner_membership_roles on public.membership_roles;
create policy provisioning_owner_membership_roles on public.membership_roles for all to provisioning_function_owner using (true) with check (true);
drop policy if exists provisioning_owner_operations on public.membership_admin_operations;
create policy provisioning_owner_operations on public.membership_admin_operations for all to provisioning_function_owner using (true) with check (true);
drop policy if exists provisioning_owner_audit on public.audit_events;
create policy provisioning_owner_audit on public.audit_events for all to provisioning_function_owner using (true) with check (true);
drop policy if exists provisioning_owner_requests on public.tenant_provisioning_requests;
create policy provisioning_owner_requests on public.tenant_provisioning_requests for all to provisioning_function_owner using (true) with check (true);
drop policy if exists provisioning_owner_invites on public.tenant_provisioning_invites;
create policy provisioning_owner_invites on public.tenant_provisioning_invites for all to provisioning_function_owner using (true) with check (true);
drop policy if exists provisioning_owner_baselines on public.tenant_provisioning_baselines;
create policy provisioning_owner_baselines on public.tenant_provisioning_baselines for select to provisioning_function_owner using (true);

create or replace function public.provisioning_attestation_payload(
  p_action text,p_actor uuid,p_request_id uuid,p_request_hash text,p_org text,p_preview_hash text,
  p_baseline_id text,p_baseline_version integer,p_baseline_hash text,p_token_hash text,p_reservation uuid,
  p_dispatch integer,p_approval integer,p_outcome text,p_key_id text,p_issued text,p_expires text
) returns bytea language plpgsql immutable set search_path='' as $$
declare v text; v_result bytea := ''::bytea;
begin
  foreach v in array array['elpro.provisioning.attestation.v1',p_action,p_actor::text,p_request_id::text,p_request_hash,p_org,p_preview_hash,p_baseline_id,p_baseline_version::text,p_baseline_hash,p_token_hash,coalesce(p_reservation::text,''),p_dispatch::text,p_approval::text,p_outcome,p_key_id,p_issued,p_expires] loop
    v_result := v_result || convert_to(octet_length(convert_to(coalesce(v,''),'UTF8'))::text || ':' || coalesce(v,''),'UTF8');
  end loop;
  return v_result;
end $$;
revoke all on function public.provisioning_attestation_payload(text,uuid,uuid,text,text,text,text,integer,text,text,uuid,integer,integer,text,text,text,text) from public, anon, authenticated, service_role;

create or replace function public.provisioning_attestation_secret(p_key_id text)
returns text language sql stable security definer set search_path='' as $$
 select ds.decrypted_secret from vault.decrypted_secrets ds
  where ds.name = 'tenant_provisioning_attestation_' || p_key_id
  union all
 select ds.decrypted_secret from vault.decrypted_secrets ds
  where ds.name = 'tenant_provisioning_attestation_previous_' || p_key_id
 limit 1
$$;
alter function public.provisioning_attestation_secret(text) owner to provisioning_function_owner;
revoke all on function public.provisioning_attestation_secret(text) from public, anon, authenticated, service_role;

create or replace function public.provision_tenant(p_action text, p_request jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_att jsonb := p_request->'attestation'; v_actor uuid; v_key text; v_secret text;
  v_issued timestamptz; v_expires timestamptz; v_signature text := p_request->>'attestation_signature';
  v_expected text; v_req jsonb := p_request->'request'; v_request_id uuid; v_hash text; v_org text;
  v_baseline public.tenant_provisioning_baselines; v_existing public.tenant_provisioning_requests;
  v_tenant uuid; v_membership uuid; v_invite public.tenant_provisioning_invites; v_reservation uuid;
  v_token_hash text; v_dispatch integer; v_state text;
begin
  begin
    v_actor := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  exception when others then
    raise exception 'provisioning denied' using errcode='42501';
  end;
  if v_actor is null or not public.is_platform_operator() or p_action not in ('provision','reserve_dispatch','record_requested','record_unknown','record_failed')
     or v_att is null or v_signature !~ '^[0-9a-f]{64}$' then raise exception 'provisioning denied' using errcode='42501'; end if;
  begin v_issued := (v_att->>'issuedAt')::timestamptz; v_expires := (v_att->>'expiresAt')::timestamptz; exception when others then raise exception 'provisioning denied' using errcode='42501'; end;
  if v_att->>'action' is distinct from p_action or v_att->>'actorUserId' is distinct from v_actor::text
     or v_issued > statement_timestamp()+interval '5 seconds' or v_expires <= statement_timestamp()
     or v_expires > v_issued + interval '2 minutes' then raise exception 'provisioning denied' using errcode='42501'; end if;
  v_key := v_att->>'keyId'; v_secret := public.provisioning_attestation_secret(v_key);
  if v_secret is null then raise exception 'provisioning denied' using errcode='42501'; end if;
  v_expected := encode(extensions.hmac(public.provisioning_attestation_payload(p_action,v_actor,(v_att->>'requestId')::uuid,v_att->>'requestHash',v_att->>'organizationNumber',v_att->>'previewHash',v_att->>'baselineId',(v_att->>'baselineVersion')::integer,v_att->>'baselineContentHash',v_att->>'tokenHash',nullif(v_att->>'reservationId','')::uuid,(v_att->>'dispatchGeneration')::integer,(v_att->>'approvalGeneration')::integer,v_att->>'outcome',v_key,v_att->>'issuedAt',v_att->>'expiresAt'),convert_to(v_secret,'UTF8'),'sha256'),'hex');
  if v_expected is distinct from v_signature then raise exception 'provisioning denied' using errcode='42501'; end if;

  if p_action='provision' then
    if v_req is null or p_request->>'explicit_approval' <> 'true' then raise exception 'provisioning denied' using errcode='42501'; end if;
    v_request_id := (v_req->>'request_id')::uuid; v_hash := v_att->>'requestHash'; v_org := v_att->>'organizationNumber';
    if v_req->>'country_code' <> 'SE' or v_org !~ '^[0-9]{10}$' or v_att->>'previewHash' is distinct from p_request->>'preview_hash' then raise exception 'provisioning denied' using errcode='42501'; end if;
    select * into v_existing from public.tenant_provisioning_requests where request_id=v_request_id for update;
    if found then if v_existing.canonical_request_hash <> v_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return jsonb_build_object('tenantId',v_existing.tenant_id,'provisioningState',v_existing.provisioning_state,'reconciliationAction','observed'); end if;
    select * into v_baseline from public.tenant_provisioning_baselines where baseline_id=v_att->>'baselineId' and version=(v_att->>'baselineVersion')::integer and content_hash=v_att->>'baselineContentHash';
    if not found then raise exception 'PREVIEW_STALE'; end if;
    insert into public.tenants(name,country_code,normalized_organization_number,provisioning_state,provisioning_baseline_id,provisioning_baseline_version,provisioning_baseline_content_hash) values(v_req->>'legal_name','SE',v_org,'pending_first_admin_invite',v_baseline.baseline_id,v_baseline.version,v_baseline.content_hash) returning id into v_tenant;
    insert into public.tenant_memberships(tenant_id,role,status,invited_email,invited_at,invitation_expires_at) values(v_tenant,'tenant_admin','invited',lower(v_req->>'first_admin_email'),statement_timestamp(),statement_timestamp()+interval '24 hours') returning id into v_membership;
    insert into public.membership_roles(tenant_id,membership_id,role) values(v_tenant,v_membership,'tenant_admin');
    insert into public.tenant_provisioning_invites(tenant_id,membership_id,token_hash,normalized_email,role) values(v_tenant,v_membership,'',lower(v_req->>'first_admin_email'),'tenant_admin');
    insert into public.tenant_provisioning_requests(request_id,canonical_request_hash,tenant_id,actor_user_id,preview_hash,baseline_content_hash,provisioning_state,approval_generation) values(v_request_id,v_hash,v_tenant,v_actor,v_att->>'previewHash',v_baseline.content_hash,'pending_first_admin_invite',1);
    insert into public.audit_events(tenant_id,actor_user_id,command,event_type,target_type,target_id,correlation_id,metadata) values(v_tenant,v_actor,'provisioning.approve','tenant_provisioned','tenant',v_tenant,v_request_id,jsonb_build_object('requestId',v_request_id,'previewHash',v_att->>'previewHash','baselineId',v_baseline.baseline_id,'baselineVersion',v_baseline.version,'baselineContentHash',v_baseline.content_hash,'approvalGeneration',1));
    return jsonb_build_object('tenantId',v_tenant,'provisioningState','pending_first_admin_invite','reconciliationAction','created');
  end if;

  v_tenant := (p_request->>'tenant_id')::uuid; select * into v_invite from public.tenant_provisioning_invites where tenant_id=v_tenant for update;
  if not found then raise exception 'provisioning denied' using errcode='42501'; end if;
  if p_action='reserve_dispatch' then
    v_token_hash := p_request->>'token_hash'; if v_token_hash !~ '^[0-9a-f]{64}$' or v_att->>'tokenHash' is distinct from v_token_hash then raise exception 'provisioning denied' using errcode='42501'; end if;
    if v_invite.dispatch_generation >= 3 then raise exception 'PREVIEW_STALE'; end if;
    v_reservation := gen_random_uuid(); v_dispatch := v_invite.dispatch_generation+1;
    update public.tenant_provisioning_invites set revoked_token_hash=nullif(token_hash,''),token_hash=v_token_hash,reservation_id=v_reservation,dispatch_generation=v_dispatch,outcome=null,updated_at=statement_timestamp() where tenant_id=v_tenant;
    return jsonb_build_object('tenantId',v_tenant,'normalizedEmail',v_invite.normalized_email,'membershipId',v_invite.membership_id,'reservationId',v_reservation,'dispatchGeneration',v_dispatch,'role','tenant_admin','expiresAt',v_invite.expires_at,'requestId',v_att->>'requestId','requestHash',v_att->>'requestHash','organizationNumber',v_att->>'organizationNumber','previewHash',v_att->>'previewHash','baselineId',v_att->>'baselineId','baselineVersion',v_att->>'baselineVersion','baselineContentHash',v_att->>'baselineContentHash');
  end if;
  if v_att->>'reservationId' is distinct from v_invite.reservation_id::text or (v_att->>'dispatchGeneration')::integer is distinct from v_invite.dispatch_generation then raise exception 'provisioning denied' using errcode='42501'; end if;
  v_state := case p_action when 'record_requested' then 'first_admin_invite_requested' when 'record_unknown' then 'first_admin_invite_unknown' else 'first_admin_invite_failed' end;
  update public.tenant_provisioning_invites set outcome=replace(p_action,'record_',''),updated_at=statement_timestamp() where tenant_id=v_tenant;
  update public.tenants set provisioning_state=v_state where id=v_tenant;
  update public.tenant_provisioning_requests set provisioning_state=v_state where tenant_id=v_tenant;
  insert into public.audit_events(tenant_id,actor_user_id,command,event_type,target_type,target_id,correlation_id,metadata) values(v_tenant,v_actor,'provisioning.invite','first_admin_invite_transition','tenant',v_tenant,v_invite.reservation_id,jsonb_build_object('dispatchGeneration',v_invite.dispatch_generation,'outcome',replace(p_action,'record_','')));
  return jsonb_build_object('tenantId',v_tenant,'provisioningState',v_state,'attemptNumber',v_invite.dispatch_generation,'reconciliationAction','recorded');
exception when unique_violation then raise exception 'ALREADY_PROVISIONED'; end $$;

alter function public.provision_tenant(text,jsonb) owner to provisioning_function_owner;
revoke create on schema public from provisioning_function_owner;
revoke all on function public.provision_tenant(text,jsonb) from public, anon, authenticator, service_role;
grant execute on function public.provision_tenant(text,jsonb) to authenticated;
revoke all on function public.provision_tenant_legacy(text,jsonb) from public, anon, authenticated, authenticator, service_role;
