-- Revalidate invitation expiry at the actual post-gate instant. The request
-- statement timestamp can precede an arbitrarily long gate/row wait.
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

  if v_membership.invitation_expires_at <= clock_timestamp() then
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
