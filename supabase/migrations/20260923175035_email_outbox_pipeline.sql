-- Story 13.3: durable, tenant-isolated dark email outbox. Story 13.4 alone may
-- introduce any delivery provider or public unsubscribe capability.
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  recipient_hash text not null check (recipient_hash ~ '^[0-9a-f]{64}$'),
  category text not null check (length(category) between 1 and 120),
  subject_type text not null check (length(subject_type) between 1 and 80),
  subject_id uuid not null,
  logical_period date not null,
  template_key text not null check (length(template_key) between 1 and 120),
  template_version integer not null check (template_version > 0),
  template_params jsonb not null check (jsonb_typeof(template_params) = 'object'),
  state text not null default 'queued' check (state in ('queued','sending','sent','failed','suppressed')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  next_attempt_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, category, subject_type, subject_id, logical_period),
  check ((state <> 'sending') or (lease_owner is not null and lease_expires_at is not null)),
  check ((state <> 'sent') or provider_message_id is not null)
);
create index email_outbox_claim_idx on public.email_outbox (tenant_id, next_attempt_at, created_at) where state = 'queued';
create index email_outbox_stale_lease_idx on public.email_outbox (tenant_id, lease_expires_at) where state = 'sending';

create table public.email_delivery_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  outbox_id uuid not null,
  event_type text not null check (event_type in ('queued','sending','sent','failed','suppressed','retry_scheduled','lease_recovered')),
  failure_detail text check (failure_detail is null or length(failure_detail) <= 256),
  created_at timestamptz not null default now(),
  foreign key (outbox_id, tenant_id) references public.email_outbox(id, tenant_id) on delete cascade
);
create index email_delivery_events_outbox_idx on public.email_delivery_events (tenant_id, outbox_id, created_at);

create table public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  recipient_hash text not null check (recipient_hash ~ '^[0-9a-f]{64}$'),
  category text not null check (length(category) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, recipient_hash, category)
);

revoke all on public.email_outbox, public.email_delivery_events, public.email_suppressions from anon, authenticated;
grant select on public.email_outbox, public.email_delivery_events, public.email_suppressions to authenticated;
grant select, insert, update on public.email_outbox, public.email_delivery_events, public.email_suppressions to service_role;
alter table public.email_outbox enable row level security;
alter table public.email_outbox force row level security;
alter table public.email_delivery_events enable row level security;
alter table public.email_delivery_events force row level security;
alter table public.email_suppressions enable row level security;
alter table public.email_suppressions force row level security;
create policy email_outbox_admin_read on public.email_outbox for select to authenticated using (public.is_tenant_admin(tenant_id));
create policy email_delivery_events_admin_read on public.email_delivery_events for select to authenticated using (public.is_tenant_admin(tenant_id));
create policy email_suppressions_admin_read on public.email_suppressions for select to authenticated using (public.is_tenant_admin(tenant_id));

create or replace function public.email_outbox_transition_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.state = 'queued' and new.state not in ('queued','sending','suppressed') then raise exception 'invalid email outbox transition' using errcode = '23514'; end if;
  if old.state = 'sending' and new.state not in ('queued','sent','failed') then raise exception 'invalid email outbox transition' using errcode = '23514'; end if;
  if old.state in ('sent','failed','suppressed') and new is distinct from old then raise exception 'terminal email outbox state is immutable' using errcode = '42501'; end if;
  return new;
end;
$$;
create trigger email_outbox_transition_guard before update on public.email_outbox for each row execute function public.email_outbox_transition_guard();
create or replace function public.email_delivery_events_append_only()
returns trigger language plpgsql set search_path = '' as $$ begin raise exception 'email delivery events are append-only' using errcode = '42501'; end; $$;
create trigger email_delivery_events_no_update before update or delete on public.email_delivery_events for each row execute function public.email_delivery_events_append_only();

create or replace function public.enqueue_email_outbox(p_tenant_id uuid, p_recipient_hash text, p_category text, p_subject_type text, p_subject_id uuid, p_logical_period date, p_template_key text, p_template_version integer, p_template_params jsonb)
returns table(id uuid, state text, lease_expires_at timestamptz) language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.email_outbox (tenant_id, recipient_hash, category, subject_type, subject_id, logical_period, template_key, template_version, template_params)
  values (p_tenant_id, p_recipient_hash, p_category, p_subject_type, p_subject_id, p_logical_period, p_template_key, p_template_version, p_template_params)
  on conflict (tenant_id, category, subject_type, subject_id, logical_period) do nothing returning email_outbox.id into v_id;
  if v_id is not null then insert into public.email_delivery_events (tenant_id, outbox_id, event_type) values (p_tenant_id, v_id, 'queued');
  else select o.id into v_id from public.email_outbox o where o.tenant_id=p_tenant_id and o.category=p_category and o.subject_type=p_subject_type and o.subject_id=p_subject_id and o.logical_period=p_logical_period; end if;
  return query select o.id, o.state, o.lease_expires_at from public.email_outbox o where o.id=v_id;
end;
$$;

create or replace function public.claim_email_outbox(p_tenant_id uuid, p_worker_id text, p_now timestamptz, p_limit integer default 20)
returns table(id uuid, state text, lease_expires_at timestamptz, attempts integer) language plpgsql security definer set search_path = '' as $$
begin
  update public.email_outbox o set state='queued', lease_owner=null, lease_expires_at=null, updated_at=p_now
    where o.tenant_id=p_tenant_id and o.state='sending' and o.lease_expires_at <= p_now;
  insert into public.email_delivery_events (tenant_id,outbox_id,event_type)
    select o.tenant_id,o.id,'lease_recovered' from public.email_outbox o where o.tenant_id=p_tenant_id and o.state='queued' and o.updated_at=p_now;
  return query with candidates as (select o.id from public.email_outbox o where o.tenant_id=p_tenant_id and o.state='queued' and o.next_attempt_at <= p_now order by o.next_attempt_at,o.created_at for update skip locked limit greatest(1,least(p_limit,100))), claimed as (update public.email_outbox o set state='sending', lease_owner=p_worker_id, lease_expires_at=p_now + interval '15 minutes', updated_at=p_now from candidates c where o.id=c.id returning o.id,o.state,o.lease_expires_at,o.attempts)
  select * from claimed;
end;
$$;

create or replace function public.suppress_queued_email_outbox(p_tenant_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare count_changed integer;
begin
  with changed as (update public.email_outbox o set state='suppressed', updated_at=now() from public.email_suppressions s where o.tenant_id=p_tenant_id and o.state='queued' and s.tenant_id=o.tenant_id and s.recipient_hash=o.recipient_hash and s.category=o.category returning o.tenant_id,o.id)
  insert into public.email_delivery_events (tenant_id,outbox_id,event_type) select tenant_id,id,'suppressed' from changed;
  get diagnostics count_changed = row_count; return count_changed;
end;
$$;

create or replace function public.record_email_outbox_synthetic_failure(p_outbox_id uuid, p_now timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare v_attempt integer;
begin
  select attempts into v_attempt from public.email_outbox where id=p_outbox_id for update;
  if v_attempt is null then raise exception 'outbox row not found' using errcode='P0002'; end if;
  v_attempt := v_attempt + 1;
  if v_attempt >= 3 then update public.email_outbox set state='failed',attempts=v_attempt,lease_owner=null,lease_expires_at=null,updated_at=p_now where id=p_outbox_id;
    insert into public.email_delivery_events(tenant_id,outbox_id,event_type,failure_detail) select tenant_id,id,'failed','Delivery could not be completed.' from public.email_outbox where id=p_outbox_id;
  else update public.email_outbox set state='queued',attempts=v_attempt,next_attempt_at=p_now + (case v_attempt when 1 then interval '5 minutes' when 2 then interval '10 minutes' else interval '20 minutes' end),lease_owner=null,lease_expires_at=null,updated_at=p_now where id=p_outbox_id;
    insert into public.email_delivery_events(tenant_id,outbox_id,event_type) select tenant_id,id,'retry_scheduled' from public.email_outbox where id=p_outbox_id;
  end if;
end;
$$;
revoke all on function public.enqueue_email_outbox(uuid,text,text,text,uuid,date,text,integer,jsonb), public.claim_email_outbox(uuid,text,timestamptz,integer), public.suppress_queued_email_outbox(uuid), public.record_email_outbox_synthetic_failure(uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.enqueue_email_outbox(uuid,text,text,text,uuid,date,text,integer,jsonb), public.claim_email_outbox(uuid,text,timestamptz,integer), public.suppress_queued_email_outbox(uuid), public.record_email_outbox_synthetic_failure(uuid,timestamptz) to service_role;

comment on table public.email_outbox is 'Story 13.3 dark queue: Legacy P79 inspired queue/log/suppression structure; no legacy-equivalence claim.';
