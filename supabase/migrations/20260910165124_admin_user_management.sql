-- Story 11.3: the membership row remains the sole authority for tenant access.
alter table public.tenant_memberships alter column user_id drop not null;
alter table public.tenant_memberships drop constraint if exists tenant_memberships_tenant_user_unique;
alter table public.tenant_memberships drop constraint if exists tenant_memberships_status_check;
alter table public.tenant_memberships add column if not exists invited_email text;
alter table public.tenant_memberships add column if not exists invited_at timestamptz;
alter table public.tenant_memberships add column if not exists invitation_expires_at timestamptz;
alter table public.tenant_memberships add column if not exists revoked_at timestamptz;
alter table public.tenant_memberships add column if not exists disabled_at timestamptz;
alter table public.tenant_memberships add column if not exists ended_at timestamptz;
-- Active memberships that predate invitation lifecycle storage still need a
-- canonical address for a later password-reset operation.
update public.tenant_memberships m
   set invited_email = lower(u.email)
  from auth.users u
 where m.user_id = u.id and m.invited_email is null;
do $$ begin
  alter table public.tenant_memberships add constraint tenant_memberships_status_check check (status in ('invited','expired','revoked','active','disabled','ended'));
exception when duplicate_object then null; end $$;
-- Legacy fixtures and pre-existing invited rows may already carry a user id. The
-- acceptance procedure, rather than this compatibility constraint, enforces the
-- stricter new invite-email/token binding before an invited row becomes active.
do $$ begin
  alter table public.tenant_memberships add constraint tenant_memberships_identity_check check (status <> 'active' or user_id is not null);
exception when duplicate_object then null; end $$;
create unique index if not exists tenant_memberships_live_user_unique on public.tenant_memberships(tenant_id, user_id) where status <> 'ended' and user_id is not null;
create unique index if not exists tenant_memberships_live_email_unique on public.tenant_memberships(tenant_id, lower(invited_email)) where status = 'invited';

create table if not exists public.membership_admin_operations (
 id uuid primary key, tenant_id uuid not null references public.tenants(id) on delete cascade,
 actor_user_id uuid not null references auth.users(id), membership_id uuid references public.tenant_memberships(id),
 action text not null check (action in ('invite','resend','revoke','reset','disable','reactivate','re_role','end')),
 outcome text not null default 'pending' check (outcome in ('pending','succeeded','failed','uncertain')),
 invitation_token_hash text, invitation_expires_at timestamptz, superseded_at timestamptz,
 created_at timestamptz not null default statement_timestamp(), completed_at timestamptz
);
alter table public.membership_admin_operations enable row level security;
alter table public.membership_admin_operations force row level security;
grant select on public.membership_admin_operations to authenticated;
grant select, insert, update, delete on public.membership_admin_operations to service_role;
drop policy if exists membership_admin_operations_admin_read on public.membership_admin_operations;
create policy membership_admin_operations_admin_read on public.membership_admin_operations for select to authenticated using (public.is_tenant_admin(tenant_id));

create or replace function public.admin_manage_membership(p_tenant_id uuid,p_membership_id uuid,p_action text,p_roles text[],p_reason text,p_operation_id uuid,p_token_hash text default null,p_expiry timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_member public.tenant_memberships; v_existing public.membership_admin_operations; v_admins integer;
begin
 if auth.uid() is null or p_action not in ('revoke','reset','disable','reactivate','re_role','end')
    or (p_action = 're_role' and coalesce(array_length(p_roles,1),0)=0) then raise exception 'admin user action denied' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text,0));
 if not public.is_tenant_admin(p_tenant_id) then raise exception 'admin user action denied' using errcode='42501'; end if;
 select * into v_existing from public.membership_admin_operations where id=p_operation_id and tenant_id=p_tenant_id and actor_user_id=auth.uid();
 if found then
   return jsonb_build_object('membershipId',v_existing.membership_id,'outcome',v_existing.outcome,'replayed',true);
 end if;
 select * into v_member from public.tenant_memberships where id=p_membership_id and tenant_id=p_tenant_id for update;
 if not found then raise exception 'admin user action denied' using errcode='42501'; end if;
 select count(*) into v_admins from public.tenant_memberships m where m.tenant_id=p_tenant_id and m.status='active' and (m.role='tenant_admin' or exists(select 1 from public.membership_roles r where r.membership_id=m.id and r.role='tenant_admin'));
 if p_action in ('disable','end','re_role') and (v_member.role='tenant_admin' or exists(select 1 from public.membership_roles r where r.membership_id=v_member.id and r.role='tenant_admin')) and v_admins <= 1 and (p_action <> 're_role' or not ('tenant_admin'=any(p_roles))) then raise exception 'admin user action denied' using errcode='42501'; end if;
 if p_action='re_role' and coalesce(nullif(trim(p_reason),''),'')='' then raise exception 'admin user action denied' using errcode='42501'; end if;
 if p_action='re_role' then
   if v_member.status <> 'active' then raise exception 'admin user action denied' using errcode='42501'; end if;
   delete from public.membership_roles where membership_id=v_member.id; insert into public.membership_roles(tenant_id,membership_id,role) select p_tenant_id,v_member.id,unnest(p_roles); update public.tenant_memberships set role=case when 'tenant_admin'=any(p_roles) then 'tenant_admin' else p_roles[1] end where id=v_member.id;
 elsif p_action='disable' then
   if v_member.status <> 'active' then raise exception 'admin user action denied' using errcode='42501'; end if;
   update public.tenant_memberships set status='disabled',disabled_at=statement_timestamp() where id=v_member.id;
 elsif p_action='reactivate' then
   if v_member.status <> 'disabled' then raise exception 'admin user action denied' using errcode='42501'; end if;
   update public.tenant_memberships set status='active',disabled_at=null where id=v_member.id;
 elsif p_action='end' then
   if v_member.status not in ('active','disabled','revoked') then raise exception 'admin user action denied' using errcode='42501'; end if;
   update public.tenant_memberships set status='ended',ended_at=statement_timestamp() where id=v_member.id;
 elsif p_action='revoke' then
   if v_member.status <> 'invited' then raise exception 'admin user action denied' using errcode='42501'; end if;
   update public.tenant_memberships set status='revoked',revoked_at=statement_timestamp() where id=v_member.id;
 elsif p_action='reset' then
   if v_member.status <> 'active' then raise exception 'admin user action denied' using errcode='42501'; end if;
 end if;
 insert into public.membership_admin_operations(id,tenant_id,actor_user_id,membership_id,action,outcome,invitation_token_hash,invitation_expires_at,completed_at)
 values(p_operation_id,p_tenant_id,auth.uid(),v_member.id,p_action,
   case when p_action = 'reset' then 'pending' else 'succeeded' end,
   p_token_hash,p_expiry,case when p_action = 'reset' then null else statement_timestamp() end);
 perform public.story_11_2_record_audit_event_internal(p_tenant_id,auth.uid(),'admin-users.'||p_action,'membership_'||p_action,'tenant_membership',v_member.id,p_operation_id,jsonb_build_object('reason',p_reason));
 return jsonb_build_object('membershipId',v_member.id,'outcome',case when p_action='reset' then 'pending' else 'succeeded' end);
end $$;
revoke execute on function public.admin_manage_membership(uuid,uuid,text,text[],text,uuid,text,timestamptz) from public;
grant execute on function public.admin_manage_membership(uuid,uuid,text,text[],text,uuid,text,timestamptz) to authenticated;

-- The invitation row and its operation/audit are committed before Auth delivery.
create or replace function public.admin_prepare_membership_invitation(
  p_tenant_id uuid, p_email text, p_roles text[], p_operation_id uuid,
  p_token_hash text, p_expiry timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_membership_id uuid := gen_random_uuid(); v_existing public.membership_admin_operations; v_action text := 'invite';
begin
  if auth.uid() is null or coalesce(array_length(p_roles, 1), 0) = 0
     or nullif(lower(trim(p_email)), '') is null
     or nullif(p_token_hash, '') is null or p_expiry <= statement_timestamp() then
    raise exception 'admin user action denied' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 0));
  if not public.is_tenant_admin(p_tenant_id) then raise exception 'admin user action denied' using errcode = '42501'; end if;
  -- Operation ids are durable idempotency keys. A retry must observe the first
  -- mutation, never create a second live invitation after a lost Auth response.
  select * into v_existing from public.membership_admin_operations
    where id = p_operation_id and tenant_id = p_tenant_id and actor_user_id = auth.uid();
  if found then
    return jsonb_build_object('membershipId', v_existing.membership_id, 'outcome', v_existing.outcome, 'fresh', false);
  end if;
  -- A resend makes the previous attempt terminal before inserting the replacement.
  update public.membership_admin_operations set superseded_at = statement_timestamp()
   where membership_id in (select id from public.tenant_memberships where tenant_id = p_tenant_id and status = 'invited' and lower(invited_email) = lower(trim(p_email)))
     and superseded_at is null;
  update public.tenant_memberships set status = 'revoked', revoked_at = statement_timestamp()
   where tenant_id = p_tenant_id and status = 'invited' and lower(invited_email) = lower(trim(p_email));
  if found then v_action := 'resend'; end if;
  insert into public.tenant_memberships(id, tenant_id, user_id, role, status, invited_email, invited_at, invitation_expires_at)
  values (v_membership_id, p_tenant_id, null,
    case when 'tenant_admin' = any(p_roles) then 'tenant_admin' else p_roles[1] end,
    'invited', lower(trim(p_email)), statement_timestamp(), p_expiry);
  insert into public.membership_roles(tenant_id, membership_id, role)
    select p_tenant_id, v_membership_id, unnest(p_roles);
  insert into public.membership_admin_operations(id, tenant_id, actor_user_id, membership_id, action, outcome, invitation_token_hash, invitation_expires_at)
    values (p_operation_id, p_tenant_id, auth.uid(), v_membership_id, v_action, 'pending', p_token_hash, p_expiry);
  perform public.story_11_2_record_audit_event_internal(p_tenant_id, auth.uid(), 'admin-users.' || v_action, 'membership_' || v_action, 'tenant_membership', v_membership_id, p_operation_id, '{}'::jsonb);
  return jsonb_build_object('membershipId', v_membership_id, 'outcome', 'pending', 'fresh', true);
end $$;
revoke execute on function public.admin_prepare_membership_invitation(uuid,text,text[],uuid,text,timestamptz) from public;
grant execute on function public.admin_prepare_membership_invitation(uuid,text,text[],uuid,text,timestamptz) to authenticated;

create or replace function public.admin_finalize_membership_operation(p_operation_id uuid, p_outcome text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_operation public.membership_admin_operations;
begin
  select * into v_operation from public.membership_admin_operations where id = p_operation_id for update;
  if not found or auth.uid() is null or not public.is_tenant_admin(v_operation.tenant_id)
     or p_outcome not in ('succeeded', 'failed', 'uncertain') then
    raise exception 'admin user action denied' using errcode = '42501';
  end if;
  update public.membership_admin_operations set outcome = p_outcome, completed_at = statement_timestamp()
    where id = p_operation_id and outcome = 'pending';
  return true;
end $$;
revoke execute on function public.admin_finalize_membership_operation(uuid,text) from public;
grant execute on function public.admin_finalize_membership_operation(uuid,text) to authenticated;

create or replace function public.admin_reconcile_membership_operation(p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_operation public.membership_admin_operations;
begin
  select * into v_operation from public.membership_admin_operations where id = p_operation_id;
  if not found or auth.uid() is null or not public.is_tenant_admin(v_operation.tenant_id) then
    raise exception 'admin user action denied' using errcode='42501';
  end if;
  return jsonb_build_object('operationId', v_operation.id, 'outcome', v_operation.outcome);
end $$;
revoke execute on function public.admin_reconcile_membership_operation(uuid) from public;
grant execute on function public.admin_reconcile_membership_operation(uuid) to authenticated;

create or replace function public.admin_accept_membership_invitation(
  p_membership_id uuid, p_token_hash text, p_user_id uuid, p_email text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_membership public.tenant_memberships; v_operation public.membership_admin_operations;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then return false; end if;
  select * into v_membership from public.tenant_memberships where id = p_membership_id for update;
  if not found or v_membership.status <> 'invited'
     or lower(v_membership.invited_email) <> lower(trim(p_email)) then return false; end if;
  if v_membership.invitation_expires_at <= statement_timestamp() then
    update public.tenant_memberships set status='expired' where id=p_membership_id;
    return false;
  end if;
  select * into v_operation from public.membership_admin_operations
    where membership_id = p_membership_id and action in ('invite', 'resend') and outcome in ('succeeded', 'uncertain')
      and superseded_at is null and invitation_token_hash = p_token_hash
    order by created_at desc limit 1 for update;
  if not found then return false; end if;
  update public.tenant_memberships set user_id = auth.uid(), status = 'active', updated_at = statement_timestamp()
    where id = p_membership_id;
  perform public.story_11_2_record_audit_event_internal(v_membership.tenant_id, auth.uid(), 'admin-users.accept-invite', 'membership_activated', 'tenant_membership', p_membership_id, v_operation.id, '{}'::jsonb);
  return true;
end $$;
revoke execute on function public.admin_accept_membership_invitation(uuid,text,uuid,text) from public;
grant execute on function public.admin_accept_membership_invitation(uuid,text,uuid,text) to authenticated;
