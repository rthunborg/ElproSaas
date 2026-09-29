-- Quote delivery uses a frozen CRM-recipient hash, while notification
-- preferences are keyed by an authenticated user's UUID hash. The old personal
-- quote.delivery controls could never affect delivery, so preserve any legacy
-- rows for auditability but block every new direct or API-backed write.
create or replace function public.notification_preferences_preference_eligibility_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.category = 'quote.delivery' then
    raise exception 'quote delivery does not have personal notification preferences' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger notification_preferences_preference_eligibility_guard
  before insert or update on public.notification_preferences
  for each row execute function public.notification_preferences_preference_eligibility_guard();
