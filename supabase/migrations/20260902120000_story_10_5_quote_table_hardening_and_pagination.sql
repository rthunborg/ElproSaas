-- Story 10.5: additive quote-follow-up integrity backstops.
--
-- The command surface remains RLS-client/envelope based. These triggers close the remaining
-- same-tenant direct-write and plan-versus-terminal-transition gaps without reopening the Story
-- 10.8 quote-event/lost-reason grants or changing the established quote lifecycle wrappers.

create index if not exists quote_follow_ups_quote_created_at_idx
  on public.quote_follow_ups (quote_id, created_at);

create or replace function public.enforce_quote_follow_up_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote_id uuid;
  v_status text;
  v_today date := (statement_timestamp() at time zone 'Europe/Stockholm')::date;
begin
  -- The local superuser-only factory path seeds legacy/terminal fixtures, including intentionally
  -- stranded historical rows used by read-model negatives. App sessions are PostgREST's
  -- `authenticator` session user and always take the enforcement path below.
  if session_user = 'postgres' then return new; end if;

  -- BEFORE triggers run before an INSERT policy's WITH CHECK. Do not use this DEFINER function to
  -- inspect a tenant the caller cannot administer: return the submitted row untouched and let the
  -- table's existing RLS policy issue its ordinary 42501 denial. This keeps relationship/status
  -- facts for another tenant non-observable while retaining the privileged lock/check below for
  -- own-tenant direct writes.
  if not public.is_tenant_admin(new.tenant_id) then return new; end if;

  if tg_op = 'INSERT' then
    -- FOR SHARE conflicts with a terminal status UPDATE (which takes FOR NO KEY UPDATE), so an
    -- insert and a sent->terminal transition serialize and cannot both leave an open row behind.
    select qv.quote_id, qv.status into v_quote_id, v_status
      from public.quote_versions qv
     where qv.id = new.quote_version_id and qv.tenant_id = new.tenant_id
     for share;

    if not found or v_quote_id <> new.quote_id or v_status <> 'sent' then
      raise exception 'quote follow-up requires its own sent quote version'
        using errcode = 'QV409';
    end if;
    if new.due_date < v_today then
      raise exception 'quote follow-up due date cannot be before today in Europe/Stockholm'
        using errcode = '22007';
    end if;
    if new.status <> 'open' or new.outcome is not null or new.completed_at is not null
       or length(coalesce(new.note, '')) > 4000 then
      raise exception 'new quote follow-up must be open with no completion fields'
        using errcode = '23514';
    end if;
    return new;
  end if;

  -- Follow-up identity/anchor/date is immutable. A row has only two sanctioned write shapes:
  -- an open-note edit, or one open -> completed transition. Completed rows can never reopen.
  if row(new.id, new.tenant_id, new.quote_id, new.quote_version_id, new.due_date, new.created_at)
     is distinct from row(old.id, old.tenant_id, old.quote_id, old.quote_version_id, old.due_date, old.created_at) then
    raise exception 'quote follow-up identity and anchor are immutable'
      using errcode = 'QV409';
  end if;
  if old.status <> 'open' then
    raise exception 'completed quote follow-up cannot be changed or reopened'
      using errcode = 'QV409';
  end if;
  if new.status = 'open' then
    if new.outcome is distinct from old.outcome
       or new.completed_at is distinct from old.completed_at
       or length(coalesce(new.note, '')) > 4000 then
      raise exception 'open quote follow-up may only change its note'
        using errcode = 'QV409';
    end if;
    return new;
  end if;
  if new.status = 'completed'
     and new.outcome is not null
     and length(btrim(new.outcome)) > 0
     and length(new.outcome) <= 4000
     and new.completed_at is not null
     and new.note is not distinct from old.note then
    return new;
  end if;
  raise exception 'quote follow-up may only advance from open to completed'
    using errcode = 'QV409';
end;
$$;

drop trigger if exists quote_follow_ups_write_guard on public.quote_follow_ups;
create trigger quote_follow_ups_write_guard
  before insert or update on public.quote_follow_ups
  for each row execute function public.enforce_quote_follow_up_write();

-- A terminal quote cannot be committed while an open follow-up still anchors it. This is paired
-- with the FOR SHARE anchor lock above: whoever wins the race commits, and the other operation
-- deterministically rejects rather than stranding an uncompletable follow-up.
create or replace function public.enforce_quote_version_terminal_follow_up_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status
     and new.status in ('accepted', 'rejected', 'expired', 'superseded', 'lost') then
    if exists (
      select 1 from public.quote_follow_ups qfu
       where qfu.tenant_id = new.tenant_id
         and qfu.quote_id = new.quote_id
         and qfu.quote_version_id = new.id
         and qfu.status = 'open'
    ) then
      raise exception 'terminal quote transition requires completing its open follow-up first'
        using errcode = 'QV409';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists quote_versions_a_terminal_follow_up_guard on public.quote_versions;
create trigger quote_versions_a_terminal_follow_up_guard
  before update of status on public.quote_versions
  for each row execute function public.enforce_quote_version_terminal_follow_up_guard();

comment on function public.enforce_quote_follow_up_write() is
  'Story 10.5 direct-write backstop: follow-up inserts must anchor their own sent version and a non-past Stockholm date; only open-note edits and one open-to-completed transition are mutable.';

comment on function public.enforce_quote_version_terminal_follow_up_guard() is
  'Story 10.5 serialization backstop: a sent quote version cannot take a terminal transition while an open follow-up anchors it.';

revoke execute on function public.enforce_quote_follow_up_write() from public, anon, authenticated, service_role;
revoke execute on function public.enforce_quote_version_terminal_follow_up_guard() from public, anon, authenticated, service_role;
