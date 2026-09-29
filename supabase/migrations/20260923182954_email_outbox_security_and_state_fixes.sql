-- Story 13.3 review fixes: raw operational data is never readable through
-- PostgREST, while the redacted Administrator projection remains available.
revoke select on public.email_outbox, public.email_delivery_events, public.email_suppressions from authenticated;

create or replace function public.read_email_outbox_queue(p_tenant_id uuid)
returns table(subject_type text, subject_id uuid, logical_period date, state text, attempts integer, next_attempt_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_tenant_admin(p_tenant_id) then return; end if;
  return query select o.subject_type, o.subject_id, o.logical_period, o.state, o.attempts, o.next_attempt_at
    from public.email_outbox o where o.tenant_id = p_tenant_id order by o.created_at desc limit 50;
end;
$$;
revoke all on function public.read_email_outbox_queue(uuid) from public, anon;
grant execute on function public.read_email_outbox_queue(uuid) to authenticated, service_role;

create or replace function public.claim_email_outbox(p_tenant_id uuid, p_worker_id text, p_now timestamptz, p_limit integer default 20)
returns table(id uuid, state text, lease_expires_at timestamptz, attempts integer) language plpgsql security definer set search_path = '' as $$
begin
  with recovered as (
    update public.email_outbox o set state='queued', lease_owner=null, lease_expires_at=null, updated_at=p_now
    where o.tenant_id=p_tenant_id and o.state='sending' and o.lease_expires_at <= p_now
    returning o.tenant_id,o.id
  ) insert into public.email_delivery_events (tenant_id,outbox_id,event_type)
    select r.tenant_id,r.id,'lease_recovered' from recovered r;
  return query with candidates as (
    select o.id from public.email_outbox o where o.tenant_id=p_tenant_id and o.state='queued' and o.next_attempt_at <= p_now
    order by o.next_attempt_at,o.created_at for update skip locked limit greatest(1,least(p_limit,100))
  ), claimed as (
    update public.email_outbox o set state='sending', lease_owner=p_worker_id, lease_expires_at=p_now + interval '15 minutes', updated_at=p_now
    from candidates c where o.id=c.id returning o.id,o.tenant_id,o.state,o.lease_expires_at,o.attempts
  ), events as (
    insert into public.email_delivery_events (tenant_id,outbox_id,event_type) select c.tenant_id,c.id,'sending' from claimed c
  ) select c.id,c.state,c.lease_expires_at,c.attempts from claimed c;
end;
$$;

create or replace function public.record_email_outbox_synthetic_failure(p_outbox_id uuid, p_tenant_id uuid, p_worker_id text, p_now timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare v_attempt integer;
begin
  select attempts into v_attempt from public.email_outbox where id=p_outbox_id and tenant_id=p_tenant_id and state='sending' and lease_owner=p_worker_id and lease_expires_at > p_now for update;
  if v_attempt is null then raise exception 'active email outbox claim not found' using errcode='P0002'; end if;
  v_attempt := v_attempt + 1;
  if v_attempt >= 3 then
    update public.email_outbox set state='failed',attempts=v_attempt,lease_owner=null,lease_expires_at=null,updated_at=p_now where id=p_outbox_id;
    insert into public.email_delivery_events(tenant_id,outbox_id,event_type,failure_detail) values (p_tenant_id,p_outbox_id,'failed','Delivery could not be completed.');
  else
    update public.email_outbox set state='queued',attempts=v_attempt,next_attempt_at=p_now + (case v_attempt when 1 then interval '5 minutes' when 2 then interval '10 minutes' else interval '20 minutes' end),lease_owner=null,lease_expires_at=null,updated_at=p_now where id=p_outbox_id;
    insert into public.email_delivery_events(tenant_id,outbox_id,event_type) values (p_tenant_id,p_outbox_id,'retry_scheduled');
  end if;
end;
$$;
revoke all on function public.record_email_outbox_synthetic_failure(uuid,timestamptz) from public, anon, authenticated;
revoke all on function public.record_email_outbox_synthetic_failure(uuid,uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.record_email_outbox_synthetic_failure(uuid,uuid,text,timestamptz) to service_role;