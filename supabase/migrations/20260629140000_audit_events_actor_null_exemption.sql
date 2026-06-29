-- ----------------------------------------------------------------------------
-- Narrow the audit_events append-only guard so the `actor_user_id` FK referential
-- action works.
--
-- BUG (surfaced by test gap G-6, test-design-epic-2-foundation-consolidated.md):
-- `audit_events.actor_user_id` is `references auth.users (id) on delete set null`
-- (migration 20260629121136_audit_events.sql) so the audit row SURVIVES a deleted
-- actor (architecture §15). But the append-only `BEFORE UPDATE OR DELETE` trigger
-- (`audit_events_append_only` -> `audit_events_block_mutation()`) raised on ANY
-- UPDATE, and `on delete set null` is implemented as an internal UPDATE of the
-- referencing row. So deleting an actor who authored any audit row failed with
-- SQLSTATE 23001 instead of nulling the column — the documented behavior did not
-- hold; actor deletion was blocked entirely.
--
-- FIX: PERMIT exactly one operation — an UPDATE whose SOLE change is
-- `actor_user_id` going from non-null to NULL (the FK referential action). Every
-- other UPDATE and every DELETE (including a tenant `on delete cascade`) stays
-- blocked, so the append-only / content-immutability invariant (architecture §9,
-- R-009) is fully intact. The app path additionally has NO UPDATE/DELETE grant, so
-- the only realistic caller of the permitted UPDATE is the FK action itself.
-- ----------------------------------------------------------------------------
create or replace function public.audit_events_block_mutation()
returns trigger
language plpgsql
-- SECURITY INVOKER (default): inspects the operation in flight and raises; needs no
-- elevated privilege. Pin search_path defensively.
set search_path = ''
as $$
declare
  probe public.audit_events;
begin
  -- Allow ONLY the FK `on delete set null` referential action: an UPDATE that nulls
  -- actor_user_id and changes nothing else.
  if tg_op = 'UPDATE'
     and old.actor_user_id is not null
     and new.actor_user_id is null
  then
    -- Confirm actor_user_id -> NULL is the SOLE change: restore it on a probe copy of
    -- NEW and require the probe to be row-identical to OLD. Column-list agnostic, so a
    -- future audit column cannot silently open a tampering path through this branch.
    probe := new;
    probe.actor_user_id := old.actor_user_id;
    if probe is not distinct from old then
      return new;  -- permit ONLY the actor-null referential action
    end if;
  end if;

  raise exception
    'audit_events is append-only: % is not permitted (architecture §9, §15)',
    tg_op
    using errcode = 'restrict_violation';
end;
$$;

comment on function public.audit_events_block_mutation() is
  'Append-only guard (architecture §9, §15). Raises on every UPDATE/DELETE of audit_events EXCEPT the single FK referential action that nulls actor_user_id when the referenced actor is deleted (on delete set null; the audit row must survive a deleted actor). All content mutation and all DELETE (incl. tenant on delete cascade) stay blocked — defense-in-depth beyond absence-of-grant. Proven by the R-009 append-only negative + the G-6 actor-delete persistence test.';
