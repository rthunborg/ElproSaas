-- Story 13.2: recipient-scoped in-app notifications.  Producers are the only
-- writers; authenticated users can select their own rows and acknowledge them.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('quote.follow_up_due', 'quote.accepted')),
  title text not null check (length(title) between 1 and 180),
  body text not null check (length(body) between 1 and 1000),
  route text not null check (route ~ '^/[a-z0-9/_-]*$'),
  logical_subject_id uuid,
  logical_period date,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, tenant_id),
  unique nulls not distinct (tenant_id, recipient_user_id, category, logical_subject_id, logical_period)
);

create index notifications_recipient_created_idx on public.notifications (tenant_id, recipient_user_id, created_at desc);
create index notifications_recipient_unread_idx on public.notifications (tenant_id, recipient_user_id, created_at desc) where read_at is null;

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('quote.follow_up_due', 'quote.accepted')),
  channel text not null check (channel in ('in_app', 'email')),
  enabled boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, user_id, category, channel),
  check (channel <> 'email')
);

revoke all on public.notifications, public.notification_preferences from anon, authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select, insert, update on public.notifications, public.notification_preferences to service_role;

alter table public.notifications enable row level security;
alter table public.notifications force row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_preferences force row level security;

create policy notifications_select_recipient on public.notifications for select to authenticated
  using (recipient_user_id = auth.uid() and public.is_active_tenant_member(tenant_id));
create policy notifications_update_recipient_read_only on public.notifications for update to authenticated
  using (recipient_user_id = auth.uid() and public.is_active_tenant_member(tenant_id))
  with check (recipient_user_id = auth.uid() and public.is_active_tenant_member(tenant_id));
create policy notification_preferences_select_own on public.notification_preferences for select to authenticated
  using (user_id = auth.uid() and public.is_active_tenant_member(tenant_id));
create policy notification_preferences_insert_own on public.notification_preferences for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_tenant_member(tenant_id));
create policy notification_preferences_update_own on public.notification_preferences for update to authenticated
  using (user_id = auth.uid() and public.is_active_tenant_member(tenant_id))
  with check (user_id = auth.uid() and public.is_active_tenant_member(tenant_id));

create or replace function public.notification_preferences_essential_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.category = 'quote.follow_up_due' and not new.enabled then
    raise exception 'essential notification preferences cannot be disabled' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger notification_preferences_essential_guard
  before insert or update on public.notification_preferences
  for each row execute function public.notification_preferences_essential_guard();

create or replace function public.notifications_recipient_update_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.recipient_user_id is distinct from old.recipient_user_id
     or new.category is distinct from old.category
     or new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.route is distinct from old.route
     or new.logical_subject_id is distinct from old.logical_subject_id
     or new.logical_period is distinct from old.logical_period
     or new.created_at is distinct from old.created_at
     or (old.read_at is not null and new.read_at is distinct from old.read_at) then
    raise exception 'notifications permit only one-way read acknowledgement' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger notifications_recipient_update_guard before update on public.notifications
  for each row execute function public.notifications_recipient_update_guard();
