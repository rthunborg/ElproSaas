-- Story 13.4: lease-bound outcomes and the narrowly scoped ADR-B004 token state.
create table public.email_unsubscribe_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  recipient_hash text not null check (recipient_hash ~ '^[0-9a-f]{64}$'),
  category text not null check (length(category) between 1 and 120),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.email_unsubscribe_rate_limits (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  attempts integer not null default 1 check (attempts between 1 and 100),
  unique (token_hash, ip_hash, window_started_at)
);
revoke all on public.email_unsubscribe_tokens, public.email_unsubscribe_rate_limits from public, anon, authenticated;
grant select, insert, update on public.email_unsubscribe_tokens, public.email_unsubscribe_rate_limits to service_role;
alter table public.email_unsubscribe_tokens enable row level security;
alter table public.email_unsubscribe_tokens force row level security;
alter table public.email_unsubscribe_rate_limits enable row level security;
alter table public.email_unsubscribe_rate_limits force row level security;

create or replace function public.record_email_outbox_delivery(p_outbox_id uuid, p_tenant_id uuid, p_worker_id text, p_provider_message_id text, p_now timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.email_outbox set state='sent', provider_message_id=p_provider_message_id, lease_owner=null, lease_expires_at=null, updated_at=p_now
    where id=p_outbox_id and tenant_id=p_tenant_id and state='sending' and lease_owner=p_worker_id and lease_expires_at > p_now;
  if not found then raise exception 'active email outbox claim not found' using errcode='P0002'; end if;
  insert into public.email_delivery_events(tenant_id,outbox_id,event_type) values(p_tenant_id,p_outbox_id,'sent');
end;
$$;
revoke all on function public.record_email_outbox_delivery(uuid,uuid,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.record_email_outbox_delivery(uuid,uuid,text,text,timestamptz) to service_role;

alter table public.notification_preferences drop constraint notification_preferences_channel_check;
alter table public.notification_preferences add constraint notification_preferences_channel_check check (channel in ('in_app','email'));
alter table public.notification_preferences drop constraint notification_preferences_check;

create or replace function public.consume_email_unsubscribe_token(p_token_hash text, p_ip_hash text, p_reactivate boolean default false)
returns text language plpgsql security definer set search_path = '' as $$
declare v_token public.email_unsubscribe_tokens%rowtype; v_window timestamptz := date_trunc('hour', now()); v_attempts integer;
begin
  insert into public.email_unsubscribe_rate_limits(token_hash,ip_hash,window_started_at) values(p_token_hash,p_ip_hash,v_window)
  on conflict(token_hash,ip_hash,window_started_at) do update set attempts=public.email_unsubscribe_rate_limits.attempts+1 returning attempts into v_attempts;
  if v_attempts > 10 then return 'limited'; end if;
  select * into v_token from public.email_unsubscribe_tokens where token_hash=p_token_hash and revoked_at is null for update;
  if not found then return 'inactive'; end if;
  if p_reactivate then delete from public.email_suppressions where tenant_id=v_token.tenant_id and recipient_hash=v_token.recipient_hash and category=v_token.category;
  else insert into public.email_suppressions(tenant_id,recipient_hash,category) values(v_token.tenant_id,v_token.recipient_hash,v_token.category) on conflict do nothing; end if;
  update public.email_unsubscribe_tokens set revoked_at=now() where id=v_token.id;
  return case when p_reactivate then 'resubscribed' else 'unsubscribed' end;
end;
$$;
revoke all on function public.consume_email_unsubscribe_token(text,text,boolean) from public, authenticated;
grant execute on function public.consume_email_unsubscribe_token(text,text,boolean) to anon;

create or replace function public.issue_email_unsubscribe_token(p_tenant_id uuid, p_recipient_hash text, p_category text, p_token_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin insert into public.email_unsubscribe_tokens(tenant_id,recipient_hash,category,token_hash) values(p_tenant_id,p_recipient_hash,p_category,p_token_hash) returning id into v_id; return v_id; end;
$$;
create or replace function public.revoke_email_unsubscribe_token(p_token_hash text)
returns void language plpgsql security definer set search_path = '' as $$
begin update public.email_unsubscribe_tokens set revoked_at=now() where token_hash=p_token_hash and revoked_at is null; end;
$$;
revoke all on function public.issue_email_unsubscribe_token(uuid,text,text,text), public.revoke_email_unsubscribe_token(text) from public, anon, authenticated;
grant execute on function public.issue_email_unsubscribe_token(uuid,text,text,text), public.revoke_email_unsubscribe_token(text) to service_role;

create or replace function public.suppress_queued_email_outbox(p_tenant_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare count_changed integer;
begin
  with changed as (
    update public.email_outbox o set state='suppressed', updated_at=now() where o.tenant_id=p_tenant_id and o.state='queued' and (
      exists (select 1 from public.email_suppressions s where s.tenant_id=o.tenant_id and s.recipient_hash=o.recipient_hash and s.category=o.category)
      or exists (select 1 from public.notification_preferences p where p.tenant_id=o.tenant_id and p.channel='email' and not p.enabled and p.category=o.category and encode(extensions.digest(p.user_id::text,'sha256'),'hex')=o.recipient_hash)
    ) returning o.tenant_id,o.id
  ) insert into public.email_delivery_events(tenant_id,outbox_id,event_type) select tenant_id,id,'suppressed' from changed;
  get diagnostics count_changed = row_count; return count_changed;
end;
$$;
