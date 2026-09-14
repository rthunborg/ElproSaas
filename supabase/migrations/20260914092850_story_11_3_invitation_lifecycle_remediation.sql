-- Story 11.3 lifecycle remediation. Expiry is a terminal membership state;
-- a resend creates a fresh membership/attempt rather than reviving it.
create or replace function public.admin_manage_membership(p_tenant_id uuid,p_membership_id uuid,p_action text,p_roles text[],p_reason text,p_operation_id uuid,p_token_hash text default null,p_expiry timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_member public.tenant_memberships; v_existing public.membership_admin_operations; v_admins integer;
begin
 if auth.uid() is null or p_action not in ('revoke','reset','disable','reactivate','re_role','end')
    or (p_action = 're_role' and coalesce(array_length(p_roles,1),0)=0) then raise exception 'admin user action denied' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text,0));
 if not public.is_tenant_admin(p_tenant_id) then raise exception 'admin user action denied' using errcode='42501'; end if;
 select * into v_existing from public.membership_admin_operations where id=p_operation_id and tenant_id=p_tenant_id and actor_user_id=auth.uid();
 if found then return jsonb_build_object('membershipId',v_existing.membership_id,'outcome',v_existing.outcome,'replayed',true); end if;
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
   -- Expiry may be persisted by a failed acceptance. It is still recoverable
   -- administratively only by a fresh resend or this terminal revocation.
   if v_member.status not in ('invited','expired') then raise exception 'admin user action denied' using errcode='42501'; end if;
   update public.tenant_memberships set status='revoked',revoked_at=statement_timestamp() where id=v_member.id;
 elsif p_action='reset' then
   if v_member.status <> 'active' then raise exception 'admin user action denied' using errcode='42501'; end if;
 end if;
 insert into public.membership_admin_operations(id,tenant_id,actor_user_id,membership_id,action,outcome,invitation_token_hash,invitation_expires_at,completed_at)
 values(p_operation_id,p_tenant_id,auth.uid(),v_member.id,p_action,case when p_action = 'reset' then 'pending' else 'succeeded' end,p_token_hash,p_expiry,case when p_action = 'reset' then null else statement_timestamp() end);
 perform public.story_11_2_record_audit_event_internal(p_tenant_id,auth.uid(),'admin-users.'||p_action,'membership_'||p_action,'tenant_membership',v_member.id,p_operation_id,jsonb_build_object('reason',p_reason));
 return jsonb_build_object('membershipId',v_member.id,'outcome',case when p_action='reset' then 'pending' else 'succeeded' end);
end $$;
revoke execute on function public.admin_manage_membership(uuid,uuid,text,text[],text,uuid,text,timestamptz) from public;
grant execute on function public.admin_manage_membership(uuid,uuid,text,text[],text,uuid,text,timestamptz) to authenticated;
