-- Story 12.1: platform-only provisioning authority. No tenant caller can grant this role.
create table public.platform_operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default statement_timestamp(),
  granted_by uuid not null references auth.users(id)
);
alter table public.platform_operators enable row level security;
alter table public.platform_operators force row level security;
grant select on public.platform_operators to authenticated;
grant select,insert,update,delete on public.platform_operators to service_role;
create policy platform_operators_self_read on public.platform_operators for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.is_platform_operator() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.platform_operators p where p.user_id=(select auth.uid()))
$$;
revoke all on function public.is_platform_operator() from public;
grant execute on function public.is_platform_operator() to authenticated, service_role;

alter table public.tenants add column if not exists country_code text;
alter table public.tenants add column if not exists normalized_organization_number text;
alter table public.tenants add column if not exists provisioning_state text;
alter table public.tenants add column if not exists provisioning_baseline_id text;
alter table public.tenants add column if not exists provisioning_baseline_version integer;
alter table public.tenants add column if not exists provisioning_baseline_content_hash text;
alter table public.tenants add constraint tenants_provisioning_state_check check (provisioning_state is null or provisioning_state in ('pending_first_admin_invite','first_admin_invite_unknown','first_admin_invite_requested','first_admin_invite_failed','ready'));
-- Ordinary UNIQUE intentionally permits legacy rows with NULL identity facts,
-- while every provisioned row supplies both canonical columns. This is not an
-- active-only uniqueness rule: archived/inactive provisioned tenants retain it.
create unique index if not exists tenants_country_organization_unique on public.tenants(country_code,normalized_organization_number);

create table public.tenant_provisioning_requests (
 request_id uuid primary key, canonical_request_hash text not null, tenant_id uuid not null references public.tenants(id), actor_user_id uuid not null references auth.users(id), preview_hash text not null, created_at timestamptz not null default statement_timestamp(), unique(request_id,canonical_request_hash)
);
alter table public.tenant_provisioning_requests enable row level security; alter table public.tenant_provisioning_requests force row level security;
grant select,insert,update,delete on public.tenant_provisioning_requests to service_role;

create table public.tenant_provisioning_invites (
 tenant_id uuid primary key references public.tenants(id) on delete cascade,
 membership_id uuid not null references public.tenant_memberships(id), token_hash text not null,
 normalized_email text not null, role text not null default 'tenant_admin' check(role='tenant_admin'),
 expires_at timestamptz not null default statement_timestamp() + interval '24 hours', revoked_at timestamptz,
 attempt_count integer not null default 0 check(attempt_count between 0 and 3),
 outcome text check(outcome is null or outcome in ('requested','unknown','failed')),
 created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp()
);
alter table public.tenant_provisioning_invites enable row level security; alter table public.tenant_provisioning_invites force row level security;
grant select,insert,update,delete on public.tenant_provisioning_invites to service_role;

-- The only new DEFINER writer. The server validates/hash-binds the request before invoking it.
create or replace function public.provision_tenant(p_action text, p_request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_membership_id uuid; v_request_id uuid; v_hash text; v_org text; v_existing public.tenant_provisioning_requests; v_state text; v_attempt integer;
begin
 if not public.is_platform_operator() then raise exception 'provisioning denied' using errcode='42501'; end if;
 if p_action not in ('provision','record_requested','record_unknown','record_failed','reconcile') then raise exception 'provisioning denied' using errcode='42501'; end if;
 if p_action <> 'provision' then
   v_id := (p_request->>'tenant_id')::uuid;
   if p_action='reconcile' then
     return (select jsonb_build_object('tenantId',t.id,'provisioningState',t.provisioning_state,'attemptNumber',i.attempt_count,'reconciliationAction','observed') from public.tenants t join public.tenant_provisioning_invites i on i.tenant_id=t.id where t.id=v_id);
   end if;
   update public.tenant_provisioning_invites set attempt_count=attempt_count+1, outcome=case p_action when 'record_requested' then 'requested' when 'record_unknown' then 'unknown' else 'failed' end, updated_at=statement_timestamp()
    where tenant_id=v_id and attempt_count < 3;
   if not found then raise exception 'PREVIEW_STALE'; end if;
   v_state := case p_action when 'record_requested' then 'first_admin_invite_requested' when 'record_unknown' then 'first_admin_invite_unknown' else 'first_admin_invite_failed' end;
   update public.tenants set provisioning_state=v_state where id=v_id;
   select attempt_count into v_attempt from public.tenant_provisioning_invites where tenant_id=v_id;
   insert into public.audit_events(tenant_id,actor_user_id,command,event_type,target_type,target_id,correlation_id,metadata)
     values(v_id,auth.uid(),'provisioning.retry','first_admin_invite_transition','tenant',v_id,gen_random_uuid(),jsonb_build_object('attemptNumber',v_attempt,'outcome',case p_action when 'record_failed' then 'failed' else p_action end));
   return jsonb_build_object('tenantId',v_id,'provisioningState',v_state,'attemptNumber',v_attempt,'reconciliationAction','recorded');
 end if;
 v_request_id := (p_request->>'request_id')::uuid; v_hash := p_request->>'canonical_request_hash'; v_org := p_request->>'normalized_organization_number';
 select * into v_existing from public.tenant_provisioning_requests where request_id=v_request_id;
 if found then if v_existing.canonical_request_hash<>v_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return jsonb_build_object('tenantId',v_existing.tenant_id,'replayed',true); end if;
 insert into public.tenants(name,country_code,normalized_organization_number,provisioning_state,provisioning_baseline_id,provisioning_baseline_version,provisioning_baseline_content_hash)
 values(p_request->>'legal_name','SE',v_org,'pending_first_admin_invite',p_request->>'baseline_profile_id',(p_request->>'baseline_profile_version')::int,p_request->>'baseline_content_hash') returning id into v_id;
 insert into public.tenant_memberships(tenant_id,role,status,invited_email,invited_at,invitation_expires_at) values(v_id,'tenant_admin','invited',p_request->>'first_admin_email',statement_timestamp(),statement_timestamp()+interval '24 hours') returning id into v_membership_id;
 insert into public.membership_roles(tenant_id,membership_id,role) values(v_id,v_membership_id,'tenant_admin');
 insert into public.tenant_provisioning_invites(tenant_id,membership_id,token_hash,normalized_email) values(v_id,v_membership_id,p_request->>'invitation_token_hash',p_request->>'first_admin_email');
 -- Reuse the Epic 11 acceptance capability: the raw token never reaches this
 -- RPC response, while its hash is bound to the invited membership and expiry.
 insert into public.membership_admin_operations(id,tenant_id,actor_user_id,membership_id,action,outcome,invitation_token_hash,invitation_expires_at,completed_at)
 values(gen_random_uuid(),v_id,auth.uid(),v_membership_id,'invite','succeeded',p_request->>'invitation_token_hash',statement_timestamp()+interval '24 hours',statement_timestamp());
 insert into public.tenant_provisioning_requests(request_id,canonical_request_hash,tenant_id,actor_user_id,preview_hash) values(v_request_id,v_hash,v_id,auth.uid(),p_request->>'preview_hash');
 insert into public.audit_events(tenant_id,actor_user_id,command,event_type,target_type,target_id,correlation_id,metadata)
   values(v_id,auth.uid(),'provisioning.approve','tenant_provisioned','tenant',v_id,v_request_id,jsonb_build_object('requestId',v_request_id,'previewHash',p_request->>'preview_hash','baselineId',p_request->>'baseline_profile_id','baselineVersion',p_request->>'baseline_profile_version','baselineContentHash',p_request->>'baseline_content_hash'));
 return jsonb_build_object('tenantId',v_id,'provisioningState','pending_first_admin_invite');
exception when unique_violation then raise exception 'ALREADY_PROVISIONED';
end $$;
revoke all on function public.provision_tenant(text,jsonb) from public; grant execute on function public.provision_tenant(text,jsonb) to authenticated;

-- Acceptance remains Epic 11's authority; this projection only makes readiness truthful.
create or replace function public.project_provisioning_ready() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='active' and new.user_id is not null and exists (
   select 1 from public.tenant_provisioning_invites i join auth.users u on u.id=new.user_id
   where i.tenant_id=new.tenant_id and i.membership_id=new.id and lower(u.email)=i.normalized_email
 ) then
   update public.tenants set provisioning_state='ready' where id=new.tenant_id
     and provisioning_state in ('pending_first_admin_invite','first_admin_invite_requested','first_admin_invite_unknown')
     and provisioning_baseline_id is not null and provisioning_baseline_version is not null and provisioning_baseline_content_hash is not null;
 end if; return new;
end $$;
create trigger tenant_memberships_project_provisioning_ready after update of status,user_id on public.tenant_memberships for each row execute function public.project_provisioning_ready();
revoke all on function public.project_provisioning_ready() from public;
