-- Story 13.3 correction: a worker may renew or expire fields while holding a
-- sending lease. The state transition itself remains constrained.
create or replace function public.email_outbox_transition_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.state = 'queued' and new.state not in ('queued','sending','suppressed') then raise exception 'invalid email outbox transition' using errcode = '23514'; end if;
  if old.state = 'sending' and new.state not in ('sending','queued','sent','failed') then raise exception 'invalid email outbox transition' using errcode = '23514'; end if;
  if old.state in ('sent','failed','suppressed') and new is distinct from old then raise exception 'terminal email outbox state is immutable' using errcode = '42501'; end if;
  return new;
end;
$$;