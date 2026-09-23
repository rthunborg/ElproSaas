-- Align pre-13.2 local schemas with the active notification category registry.
-- The original Story 13.2 migration already creates this complete constraint on
-- fresh databases; this additive migration upgrades databases where the table
-- predates the sanctioned quote.accepted category.
alter table public.notifications
  drop constraint notifications_category_check,
  add constraint notifications_category_check
  check (category in ('quote.follow_up_due', 'quote.accepted'));

alter table public.notification_preferences
  drop constraint notification_preferences_category_check,
  add constraint notification_preferences_category_check
  check (category in ('quote.follow_up_due', 'quote.accepted'));

create or replace function public.notification_preferences_essential_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.category = 'quote.follow_up_due' and not new.enabled then
    raise exception 'essential notification preferences cannot be disabled' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists notification_preferences_essential_guard on public.notification_preferences;
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
