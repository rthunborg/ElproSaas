-- Story 13.4 follow-up: quote artifacts are mandatory only for quote delivery,
-- and an anonymous unsubscribe token can only add a suppression.

create or replace function public.record_email_outbox_delivery(p_outbox_id uuid, p_tenant_id uuid, p_worker_id text, p_provider_message_id text, p_now timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare v_category text; v_artifact_id uuid; v_consumed uuid;
begin
  select category, delivery_artifact_id into v_category, v_artifact_id
    from public.email_outbox
    where id=p_outbox_id and tenant_id=p_tenant_id and state='sending' and lease_owner=p_worker_id and lease_expires_at > p_now
    for update;
  if not found then raise exception 'active email outbox claim not found' using errcode='P0002'; end if;
  if v_category = 'quote.delivery' then
    update public.email_delivery_artifacts set recovery_state='consumed'
      where id=v_artifact_id and tenant_id=p_tenant_id and outbox_id=p_outbox_id and recovery_state='prepared'
      returning id into v_consumed;
    if v_consumed is null then raise exception 'prepared delivery artifact not found' using errcode='P0002'; end if;
  end if;
  update public.email_outbox set state='sent', provider_message_id=p_provider_message_id, lease_owner=null, lease_expires_at=null, updated_at=p_now
    where id=p_outbox_id and tenant_id=p_tenant_id;
  insert into public.email_delivery_events(tenant_id,outbox_id,event_type) values(p_tenant_id,p_outbox_id,'sent');
end;
$$;

drop function public.claim_email_outbox(uuid, text, timestamptz, integer);
create function public.claim_email_outbox(p_tenant_id uuid, p_worker_id text, p_now timestamptz, p_limit integer default 20)
returns table(id uuid, state text, category text, lease_expires_at timestamptz, attempts integer) language plpgsql security definer set search_path = '' as $$
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
    from candidates c where o.id=c.id returning o.id,o.tenant_id,o.state,o.category,o.lease_expires_at,o.attempts
  ), events as (
    insert into public.email_delivery_events (tenant_id,outbox_id,event_type) select c.tenant_id,c.id,'sending' from claimed c
  ) select c.id,c.state,c.category,c.lease_expires_at,c.attempts from claimed c;
end;
$$;
revoke all on function public.claim_email_outbox(uuid, text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(uuid, text, timestamptz, integer) to service_role;

create or replace function public.consume_email_unsubscribe_token(p_token_hash text, p_ip_hash text, p_reactivate boolean default false)
returns text language plpgsql security definer set search_path = '' as $$
declare v_token public.email_unsubscribe_tokens%rowtype; v_window timestamptz := date_trunc('hour',now()); v_attempts integer;
begin
  select * into v_token from public.email_unsubscribe_tokens where token_hash=p_token_hash for update;
  if not found or v_token.revoked_at is not null then return 'inactive'; end if;
  insert into public.email_unsubscribe_rate_limits(tenant_id,token_hash,ip_hash,window_started_at) values(v_token.tenant_id,p_token_hash,p_ip_hash,v_window)
  on conflict(tenant_id,token_hash,ip_hash,window_started_at) do update set attempts=public.email_unsubscribe_rate_limits.attempts+1 returning attempts into v_attempts;
  if v_attempts > 10 then return 'limited'; end if;
  insert into public.email_suppressions(tenant_id,recipient_hash,category) values(v_token.tenant_id,v_token.recipient_hash,v_token.category) on conflict do nothing;
  update public.email_unsubscribe_tokens set revoked_at=now() where id=v_token.id;
  return 'unsubscribed';
end;
$$;
