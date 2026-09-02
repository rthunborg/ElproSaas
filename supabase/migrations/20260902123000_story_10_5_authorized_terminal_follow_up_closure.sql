-- Story 10.5 review follow-up: terminal commands that are authorised to accept or
-- supersede a sent version close its anchored open follow-up inside the same database
-- transaction. Direct client DML remains governed by the existing grants and RLS.

create or replace function public.enforce_quote_version_terminal_follow_up_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status
     and new.status in ('accepted', 'superseded') then
    -- `accept_quote_and_create_job` and `create_new_quote_version` already own a
    -- transaction and row-lock the target/parent. Complete the anchored follow-up
    -- before allowing their terminal state update. If either this UPDATE or the
    -- caller's subsequent work fails, PostgreSQL rolls back the entire transaction.
    update public.quote_follow_ups qfu
       set status = 'completed',
           outcome = new.status,
           completed_at = statement_timestamp()
     where qfu.tenant_id = new.tenant_id
       and qfu.quote_id = new.quote_id
       and qfu.quote_version_id = new.id
       and qfu.status = 'open';
  end if;

  if old.status is distinct from new.status
     and new.status in ('accepted', 'rejected', 'expired', 'superseded', 'lost')
     and exists (
       select 1 from public.quote_follow_ups qfu
        where qfu.tenant_id = new.tenant_id
          and qfu.quote_id = new.quote_id
          and qfu.quote_version_id = new.id
          and qfu.status = 'open'
     ) then
    raise exception 'terminal quote transition requires completing its open follow-up first'
      using errcode = 'QV409';
  end if;
  return new;
end;
$$;

comment on function public.enforce_quote_version_terminal_follow_up_guard() is
  'Story 10.5 serialization backstop: authorised accepted and superseded transitions atomically complete an anchored open follow-up; other terminal transitions still reject an open follow-up.';

revoke execute on function public.enforce_quote_version_terminal_follow_up_guard() from public, anon, authenticated, service_role;
