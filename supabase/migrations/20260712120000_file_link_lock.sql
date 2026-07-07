-- ============================================================================
-- Migration: file_link_lock
-- Story 8.4 — Quote / PDF / Attachment, And Acceptance Evidence Evidence Locks.
--
-- The FILE-SIDE DB-LEVEL IMMUTABILITY ENFORCEMENT — the THIRD and final scope of
-- the shared lock-code FAMILY (Epic 6 sent-freeze `QV409` → QUOTE_VERSION_LOCKED,
-- Epic 7 accepted-lock `AR704` → ACCEPTED_RECORD_LOCKED, Epic 8.4 locked-evidence-file
-- `FL823` → FILE_LINK_LOCKED). A FAMILY = related-but-distinct codes with a SHARED
-- trigger SHAPE (fail-closed-by-construction, custom SQLSTATE, SECURITY INVOKER, empty
-- search_path, schema-qualified, exempt-then-tuple), NOT one reused code and NOT a
-- divergent mechanism (R-822 — the "one model at three scopes" retro constraint). This
-- migration REUSES the 6.4 sent-lock / 7.4 accepted-lock trigger shape VERBATIM with a
-- NEW sibling code.
--
-- Story 8.1 PERSISTED the lock fields (`file_links.is_locked`/`locked_at`,
-- `files.lifecycle_state='locked'`) but shipped NO enforcement trigger (its comment:
-- "the lock-ENFORCEMENT trigger is Story 8.4"). Today a locked-shaped `file_links` row
-- is fully mutable/deletable at the DB and NOTHING ever sets the lock. This migration
-- closes both halves — it APPLIES the lock at the correct lifecycle moment AND ENFORCES
-- it two-layer.
--
-- Purely ADDITIVE to the (frozen) 8.1 file model (20260704120000), the 6.x quote model,
-- and the 7.x acceptance/job model — a frozen prior migration is NEVER edited; every
-- object here is additive (BEFORE INSERT/UPDATE/DELETE triggers/functions on the EXISTING
-- `files`/`file_links` tables; NO new TABLE, NO new COLUMN, NO new POLICY → the H4
-- RLS-inventory gate is UNTOUCHED and the migration-reset EXACT per-table policy
-- enumeration on files/file_links stays exactly as 8.1 shipped, mirroring how 6.4's
-- quote_events append-only trigger and 7.4's accepted-lock left the enumeration
-- unchanged). No frozen RPC (`create_file_with_link`, `link_existing_file`,
-- `mark_quote_version_sent`, `accept_quote_and_create_job`) and no frozen lock migration
-- is modified.
--
-- It adds:
--   (1) the LOCK-APPLY BEFORE INSERT OR UPDATE trigger on `file_links`
--       (`apply_file_link_lock`) — the PARENT-STATE-KEYED lock apply (mirrors 6.4's
--       `enforce_quote_version_child_sent_lock` parent-status lookup). Because the RPCs
--       that CREATE the evidence/PDF links are FROZEN, the lock is applied BY
--       CONSTRUCTION regardless of which create path inserts the link: a `quote_pdf` /
--       `quote_attachment_snapshot` link whose parent `quote_versions.status <> 'draft'`,
--       or an `acceptance_evidence` link whose parent `quote_acceptances` row EXISTS
--       (AR704 has no draft state), is set `is_locked=true`/`locked_at=now()` and its
--       referenced `files` row is flipped to `lifecycle_state='locked'`.
--   (2) the file-link IMMUTABILITY BEFORE UPDATE OR DELETE trigger on `file_links`
--       (`enforce_file_link_lock`) — when `OLD.is_locked = true`, a change to ANY
--       commitment column (a `file_id` re-point [the 6.3-retry hazard], owner/purpose, or
--       an attempt to flip `is_locked`/`locked_at` back off) RAISES (`FL823`); a DELETE of
--       a locked link RAISES (archive-over-delete). EXEMPT: `archived_at` (soft-delete)
--       and `updated_at` (trigger-owned by set_updated_at).
--   (3) the file IMMUTABILITY BEFORE UPDATE OR DELETE trigger on `files`
--       (`enforce_file_lock`) — when `OLD.lifecycle_state = 'locked'`, a change to ANY
--       object-identity/metadata column (bucket_id/object_path/display_name/mime_type/
--       checksum/size_bytes/uploaded_by/tenant_id/id/created_at) RAISES (`FL823`); a
--       DELETE RAISES. The ONLY sanctioned transition out of `locked` is `locked →
--       archived` (the archive-only soft-delete, AC3), guarded like the 6.4 sent-lock
--       guards `status` — `locked → draft`/`linked`/`deleted` (a DISARMING move) RAISES.
--       EXEMPT: `archived_at` + the guarded `lifecycle_state` transition + `updated_at`.
--
-- ----------------------------------------------------------------------------
-- THE PRE-SEND-vs-POST-SEND RE-POINT BOUNDARY (Story 8.4 Task 2.1 — the load-bearing
-- 6.3 edge case, recorded here per the story):
-- `generateQuotePdf` (6.3) RE-POINTS the `quote_pdf` link's `file_id` on a retry. A PDF
-- can be generated on a DRAFT version (preview) — at that point the parent is draft, so
-- `apply_file_link_lock` leaves the link UNLOCKED and the 6.3 retry re-point is ALLOWED
-- (the 6.3 suites stay green). Once the version is SENT, `apply_file_link_lock` (fired by
-- the draft→children→sent flip's downstream link write, OR proactively on any link write
-- after send) locks the link, and a subsequent re-point attempt is REJECTED by
-- `enforce_file_link_lock` (`FL823`). Note the asymmetry vs `QV409`: the 6.4 sent-lock
-- EXEMPTS the VERSION's derived `pdf_*` render columns (a sent version's PDF stays
-- regenerable), but the file-LINK carries commitment identity once sent — so the link is
-- locked. A post-send regenerate needs a new-version flow (6.5), not an in-place re-point.
--
-- ----------------------------------------------------------------------------
-- CUSTOM SQLSTATE (Story 8.4 Task 1.3): `FL823` (File-Link, R-823 lock scope) — a
-- distinguishable 5-char SQLSTATE that does NOT collide with the standard classes the
-- write-error mapper branches on (23503/42501 → TENANT_ACCESS_DENIED;
-- 23505/23514/22P02 → VALIDATION_FAILED) NOR with 6.4's `QV409` (QUOTE_VERSION_LOCKED)
-- NOR 7.4's `AR704` (ACCEPTED_RECORD_LOCKED) — a DISTINCT-but-related SIBLING (the shared
-- family). Mapping: `FL823` → command `FILE_LINK_LOCKED`
-- (src/server/commands/files/file-db.ts throwMappedFileWriteError; the FL823 branch).
--
-- ----------------------------------------------------------------------------
-- INTENTIONAL LOVABLE-ORACLE DELTA (Story 8.4 8.4-DOCS-01): Lovable allowed silently
-- REPLACING / mutating quote attachments + acceptance evidence. Phase A LOCKS them at
-- BOTH layers (the command `FILE_LINK_LOCKED` AND these DB triggers) once the parent
-- version is sent / the acceptance exists; deletion of a locked file is ARCHIVE-ONLY.
-- This is a DELIBERATE, SAFER Phase A difference — the Lovable app is a behavioral oracle
-- ONLY (the mutable behavior is NEVER copied; AGENTS.md; ADR-A007). No Lovable code is
-- copied.
--
-- ----------------------------------------------------------------------------
-- SCOPE DISCIPLINE (architecture §7/§14; Story 8.4 Stop Conditions):
-- Triggers/functions on the EXISTING files/file_links tables are the ONLY objects. NO new
-- TABLE and NO new COLUMN and NO new POLICY (H4 + migration-reset per-table policy
-- enumeration untouched). NO storage-plane trigger (the storage.objects isolation is
-- 8.1's; a locked file's BYTES are not reclaimed by the app path — archive-over-delete; a
-- hard-delete retention workflow for locked customer evidence is a STOP requiring legal
-- sign-off, R-818 — NOT built here). NO file_events table / NO DB audit trigger (a trigger
-- has no envelope context; audit goes through the COMMAND envelope's writeAuditEvent —
-- §15). NO edit to any frozen RPC or frozen lock migration. NO inline money math (the
-- triggers only COMPARE old↔new / look up a parent status and RAISE or set the lock flag).
-- NO function grant (the triggers run only as row triggers — mirror 6.4/7.4 which add none).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- (1) The parent-state-keyed LOCK-APPLY trigger function on file_links.
--
-- Fires BEFORE INSERT OR UPDATE FOR EACH ROW. The RPCs that CREATE the evidence/PDF links
-- are FROZEN and cannot be edited, so the lock is applied HERE by construction. It keys
-- off the PARENT lifecycle state (mirroring 6.4's `enforce_quote_version_child_sent_lock`
-- parent-status lookup):
--   * a `quote_version` owner with purpose in ('quote_pdf','quote_attachment_snapshot')
--     whose parent `quote_versions.status <> 'draft'` (sent/accepted/…) → LOCK;
--   * a `quote_acceptance` owner with purpose 'acceptance_evidence' whose parent
--     `quote_acceptances` row EXISTS (AR704 has no draft state — always immutable) → LOCK.
-- All OTHER owner/purpose combinations (calculation_attachment / crm_document / job_evidence
-- / a draft-parent PDF link) are LEFT UNLOCKED — the lock is precise, not a blanket flip.
--
-- IDEMPOTENT (Task 2.3): the lock fields are set ONLY when the row is not ALREADY locked
-- (`coalesce(new.is_locked, false) = false`), so a same-value re-run / a concurrent write
-- / a later exempt-only UPDATE (e.g. flipping `archived_at`) preserves the ORIGINAL
-- `locked_at` and does not overwrite it with a fresh now() — which would otherwise make
-- the immutability trigger (2) see a `locked_at` tuple change and falsely RAISE. `now()`
-- is a lifecycle stamp (like set_updated_at), not a determinism-sensitive money/accepted
-- instant.
--
-- The companion `files.lifecycle_state = 'locked'` flip is a nested UPDATE inside the SAME
-- trigger (so the file + link lock in ONE transaction — AC4 atomic-by-construction). It is
-- GUARDED: a `files` row that is `archived`/`deleted` must NOT be forced back to `locked`
-- (only draft/linked → locked). The nested UPDATE runs under the caller's RLS (the trigger
-- is SECURITY INVOKER); a same-tenant file is visible; the `files` immutability trigger (3)
-- ALLOWS the draft/linked → locked flip (it only guards a row that is ALREADY locked).
--
-- SECURITY INVOKER + empty search_path + schema-qualified (mirror the frozen family).
-- ----------------------------------------------------------------------------
create or replace function public.apply_file_link_lock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_should_lock boolean := false;
  v_parent_status text;
  v_acceptance_exists boolean;
begin
  -- On an UPDATE of an ALREADY-locked row, DO NOT re-apply (idempotent): leave NEW exactly as
  -- the caller submitted it so the immutability trigger (2) sees the true old↔new delta and
  -- REJECTS any disarm/mutation (a re-apply here would overwrite is_locked/locked_at and could
  -- mask a `is_locked=false` disarm as a same-tuple no-op). The lock is applied ONLY on the
  -- transition INTO locked (an INSERT, or the parent-side triggers), never re-applied on an
  -- already-locked row's UPDATE.
  if tg_op = 'UPDATE' and coalesce(old.is_locked, false) = true then
    return new;
  end if;

  -- An INSERT already carrying is_locked=true (a pre-locked seed) needs no re-apply either.
  if coalesce(new.is_locked, false) = true then
    return new;
  end if;

  -- Parent-state-keyed lock decision.
  if new.owner_type = 'quote_version'
     and new.purpose in ('quote_pdf', 'quote_attachment_snapshot') then
    select qv.status into v_parent_status
      from public.quote_versions qv
     where qv.id = new.owner_id;
    -- Lock once the parent version is non-draft (sent/accepted/…); a draft parent (or a
    -- not-yet-visible parent → null) leaves the link unlocked so the 6.3 preview-on-draft
    -- retry re-point stays allowed.
    if v_parent_status is not null and v_parent_status <> 'draft' then
      v_should_lock := true;
    end if;
  elsif new.owner_type = 'quote_acceptance'
        and new.purpose = 'acceptance_evidence' then
    select exists(
             select 1 from public.quote_acceptances qa where qa.id = new.owner_id
           )
      into v_acceptance_exists;
    -- The acceptance is ALWAYS immutable once it exists (no draft acceptance) → lock the
    -- evidence link the moment the acceptance exists.
    if v_acceptance_exists then
      v_should_lock := true;
    end if;
  end if;

  if not v_should_lock then
    return new;
  end if;

  -- Apply the lock on the link row (BEFORE trigger → mutate NEW in place).
  new.is_locked := true;
  new.locked_at := now();

  -- Companion: flip the referenced files row to 'locked' (same txn — atomic). GUARD the
  -- transition: only a draft/linked file may become locked; an archived/deleted file must
  -- NOT be forced back to locked (the files immutability trigger would also block that).
  update public.files f
     set lifecycle_state = 'locked'
   where f.id = new.file_id
     and f.tenant_id = new.tenant_id
     and f.lifecycle_state in ('draft', 'linked');

  return new;
end;
$$;

comment on function public.apply_file_link_lock() is
  'Story 8.4 parent-state-keyed lock APPLY (architecture §14, R-812). BEFORE INSERT OR UPDATE on file_links: sets is_locked=true / locked_at=now() and flips the referenced files row to lifecycle_state=''locked'' WHEN the link is a commitment file whose parent is locked — a quote_version quote_pdf/quote_attachment_snapshot link whose parent quote_versions.status <> ''draft'', or a quote_acceptance acceptance_evidence link whose parent quote_acceptances row exists (AR704 has no draft state). IDEMPOTENT (skips an already-locked row so locked_at is never overwritten). The files flip is guarded (only draft/linked → locked; an archived/deleted file is never forced back). SECURITY INVOKER + empty search_path + schema-qualified. Mirrors 6.4 enforce_quote_version_child_sent_lock''s parent-status lookup. Because the frozen create RPCs cannot be edited, this trigger locks the link BY CONSTRUCTION regardless of which create path wrote it.';

-- The lock-apply trigger name is prefixed so it fires BEFORE the immutability trigger (2)
-- (Postgres fires BEFORE-ROW triggers in alphabetical order): `file_links_a_apply_lock`
-- (apply) sorts before `file_links_b_lock` (enforce). On the write that TRANSITIONS a
-- link to locked, the enforce trigger sees OLD.is_locked=false (its guard is off) and
-- allows it; on a later mutation of an already-locked row, apply is a no-op (idempotent)
-- and enforce blocks the change.
drop trigger if exists file_links_a_apply_lock on public.file_links;
create trigger file_links_a_apply_lock
  before insert or update on public.file_links
  for each row execute function public.apply_file_link_lock();

-- ----------------------------------------------------------------------------
-- (2) The file-link IMMUTABILITY trigger function on file_links.
--
-- Fires BEFORE UPDATE OR DELETE FOR EACH ROW. When OLD.is_locked = true, the row is a
-- locked commitment file-link. FAIL-CLOSED BY CONSTRUCTION: allow ONLY the exempt columns
-- (archived_at [soft-delete], updated_at [trigger-owned]) to change; RAISE (FL823) on any
-- other column change — including a file_id re-point (the 6.3-retry hazard),
-- owner_type/owner_id/purpose, or an attempt to flip is_locked/locked_at back off. A
-- DELETE of a locked link RAISES (archive-over-delete; AC3) — belt-and-braces since
-- `authenticated` has no delete grant/policy on file_links (deny-by-default already), but
-- the trigger makes it fail LOUD for any privileged path.
--
-- Uses the exempt-then-tuple technique from `enforce_quote_acceptance_lock` verbatim.
--
-- SECURITY INVOKER + empty search_path + schema-qualified.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_file_link_lock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- A DELETE of a locked link is archive-over-delete → RAISE. (OLD carries the row.)
  if tg_op = 'DELETE' then
    if coalesce(old.is_locked, false) = true then
      raise exception
        'file_links is immutable once locked: a locked commitment file-link cannot be deleted (archive-only; architecture §14)'
        using errcode = 'FL823';
    end if;
    return old;
  end if;

  -- UPDATE arm. Only an ALREADY-locked row is guarded; the draft→locked transition write
  -- (OLD.is_locked=false, NEW.is_locked=true set by the apply trigger) passes here.
  if coalesce(old.is_locked, false) = false then
    return new;
  end if;

  -- The row is locked. Allow ONLY the exempt columns (archived_at, updated_at) to change;
  -- RAISE on any commitment column change. First branch: an exempt column changed → verify
  -- NOTHING ELSE changed by comparing the full LOCKED tuple; if still distinct, a locked
  -- column was also touched → RAISE.
  if new.archived_at is distinct from old.archived_at
    or new.updated_at is distinct from old.updated_at then
    if row(
         new.id, new.tenant_id, new.file_id, new.owner_type, new.owner_id,
         new.purpose, new.is_locked, new.locked_at, new.created_at
       ) is distinct from row(
         old.id, old.tenant_id, old.file_id, old.owner_type, old.owner_id,
         old.purpose, old.is_locked, old.locked_at, old.created_at
       ) then
      raise exception
        'file_links is immutable once locked: commitment columns cannot be changed (architecture §14; the file-link carries the sent/accepted commitment identity)'
        using errcode = 'FL823';
    end if;
    -- Only exempt columns changed → allow.
    return new;
  end if;

  -- No exempt column changed, so ANY change is to a LOCKED commitment column. Compare the
  -- full locked tuple; if it changed, RAISE.
  if row(
       new.id, new.tenant_id, new.file_id, new.owner_type, new.owner_id,
       new.purpose, new.is_locked, new.locked_at, new.created_at
     ) is distinct from row(
       old.id, old.tenant_id, old.file_id, old.owner_type, old.owner_id,
       old.purpose, old.is_locked, old.locked_at, old.created_at
     ) then
    raise exception
      'file_links is immutable once locked: commitment columns cannot be changed (architecture §14; the file-link carries the sent/accepted commitment identity)'
      using errcode = 'FL823';
  end if;

  return new;
end;
$$;

comment on function public.enforce_file_link_lock() is
  'Story 8.4 file-link immutability guard (architecture §9/§14). BEFORE UPDATE OR DELETE on file_links: when OLD.is_locked = true, a change to ANY commitment column (file_id re-point [the 6.3-retry hazard], owner_type/owner_id/purpose, or a flip of is_locked/locked_at back off) RAISES (SQLSTATE FL823 → command FILE_LINK_LOCKED); a DELETE of a locked link RAISES (archive-over-delete). FAIL-CLOSED by construction — the EXEMPT set (archived_at [soft-delete], updated_at [trigger-owned]) is enumerated; EVERYTHING else — including the identity id/tenant_id/created_at and the lock fields is_locked/locked_at — is locked-by-default. SECURITY INVOKER + empty search_path + schema-qualified. FL823 → FILE_LINK_LOCKED is a DISTINCT-but-related sibling of 6.4 QV409 → QUOTE_VERSION_LOCKED and 7.4 AR704 → ACCEPTED_RECORD_LOCKED (the shared lock-code FAMILY, not a fork).';

-- Fire AFTER the apply trigger (alphabetical: `_b_` > `_a_`). Drop-then-create for replay
-- idempotency (mirror the 7.4 migration's drop-then-create).
drop trigger if exists file_links_b_lock on public.file_links;
create trigger file_links_b_lock
  before update or delete on public.file_links
  for each row execute function public.enforce_file_link_lock();

-- ----------------------------------------------------------------------------
-- (3) The file IMMUTABILITY trigger function on files.
--
-- Fires BEFORE UPDATE OR DELETE FOR EACH ROW. When OLD.lifecycle_state = 'locked', the
-- file's object identity + metadata are frozen. Allow ONLY: archived_at (soft-delete), a
-- GUARDED lifecycle_state transition (locked → archived ONLY — the archive-only path,
-- AC3), and updated_at (trigger-owned). RAISE (FL823) on any object-identity/metadata
-- change (bucket_id/object_path/display_name/mime_type/checksum/size_bytes/uploaded_by/
-- tenant_id/id/created_at) and on a DELETE.
--
-- GUARD the lifecycle transition like 6.4's sent-lock guards `status`: from `locked` allow
-- ONLY `locked → archived` (and a same-value `locked → locked` no-op). A DISARMING move
-- (`locked → draft`/`linked`) that would re-open the file is REJECTED. `locked → deleted`
-- is ALSO rejected in Phase A (a hard-delete retention workflow is a STOP requiring legal
-- sign-off, R-818 — archive-over-delete is the default).
--
-- SECURITY INVOKER + empty search_path + schema-qualified.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_file_lock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- A DELETE of a locked file is archive-over-delete → RAISE. (OLD carries the row.)
  if tg_op = 'DELETE' then
    if old.lifecycle_state = 'locked' then
      raise exception
        'files is immutable once locked: a locked file cannot be deleted (archive-only; architecture §14; a hard-delete retention workflow requires legal sign-off, R-818)'
        using errcode = 'FL823';
    end if;
    return old;
  end if;

  -- UPDATE arm. Only an ALREADY-locked file is guarded; the draft/linked → locked flip
  -- written by apply_file_link_lock (OLD.lifecycle_state in draft/linked) passes here.
  if old.lifecycle_state <> 'locked' then
    return new;
  end if;

  -- LIFECYCLE-TRANSITION GUARD: from 'locked' allow ONLY a move to 'archived' (or a
  -- same-value 'locked'). A move to 'draft'/'linked' would DISARM the lock; a move to
  -- 'deleted' is a hard-delete retention path (R-818 STOP) — both RAISE.
  if new.lifecycle_state is distinct from old.lifecycle_state
     and new.lifecycle_state <> 'archived' then
    raise exception
      'files lifecycle is irreversible once locked: illegal transition locked -> % (only locked -> archived is sanctioned; architecture §14)',
      new.lifecycle_state
      using errcode = 'FL823';
  end if;

  -- The file is locked. Allow ONLY the exempt columns (archived_at, the guarded
  -- lifecycle_state, updated_at) to change; RAISE on any object-identity/metadata change.
  if new.archived_at is distinct from old.archived_at
    or new.lifecycle_state is distinct from old.lifecycle_state
    or new.updated_at is distinct from old.updated_at then
    if row(
         new.id, new.tenant_id, new.bucket_id, new.object_path, new.display_name,
         new.mime_type, new.size_bytes, new.checksum, new.uploaded_by, new.created_at
       ) is distinct from row(
         old.id, old.tenant_id, old.bucket_id, old.object_path, old.display_name,
         old.mime_type, old.size_bytes, old.checksum, old.uploaded_by, old.created_at
       ) then
      raise exception
        'files is immutable once locked: object identity/metadata cannot be changed on a locked file (architecture §14)'
        using errcode = 'FL823';
    end if;
    -- Only exempt columns changed → allow.
    return new;
  end if;

  -- No exempt column changed, so ANY change is to a LOCKED identity/metadata column.
  if row(
       new.id, new.tenant_id, new.bucket_id, new.object_path, new.display_name,
       new.mime_type, new.size_bytes, new.checksum, new.uploaded_by, new.created_at
     ) is distinct from row(
       old.id, old.tenant_id, old.bucket_id, old.object_path, old.display_name,
       old.mime_type, old.size_bytes, old.checksum, old.uploaded_by, old.created_at
     ) then
    raise exception
      'files is immutable once locked: object identity/metadata cannot be changed on a locked file (architecture §14)'
      using errcode = 'FL823';
  end if;

  return new;
end;
$$;

comment on function public.enforce_file_lock() is
  'Story 8.4 file immutability guard (architecture §9/§14). BEFORE UPDATE OR DELETE on files: when OLD.lifecycle_state = ''locked'', a change to ANY object-identity/metadata column (bucket_id/object_path/display_name/mime_type/checksum/size_bytes/uploaded_by/tenant_id/id/created_at) RAISES (SQLSTATE FL823 → command FILE_LINK_LOCKED); a DELETE RAISES. The ONLY sanctioned transition out of ''locked'' is ''locked → archived'' (the archive-only soft-delete, AC3), guarded like the 6.4 sent-lock guards status — ''locked → draft''/''linked'' (a disarming move) and ''locked → deleted'' (a hard-delete retention path, R-818 STOP) RAISE. EXEMPT: archived_at + the guarded lifecycle_state + updated_at. SECURITY INVOKER + empty search_path + schema-qualified. Sibling of the QV409/AR704 family.';

-- Drop-then-create for replay idempotency (mirror the 7.4 migration).
drop trigger if exists files_lock on public.files;
create trigger files_lock
  before update or delete on public.files
  for each row execute function public.enforce_file_lock();

-- ----------------------------------------------------------------------------
-- (4) The PARENT-TRANSITION lock-apply triggers.
--
-- The file_links lock-apply trigger (1) fires only on a file_links INSERT/UPDATE. But a
-- link created while the parent is DRAFT (the 6.3 preview-on-draft PDF link) is NOT
-- re-written when the parent later transitions to non-draft — `mark_quote_version_sent`
-- flips quote_versions.status WITHOUT touching file_links, and the accept RPC flips
-- sent → accepted likewise. So the lock must ALSO apply from the PARENT side, at the
-- exact moment the parent locks — mirroring how 6.4's child-lock keys off the parent
-- status. These AFTER-transition triggers lock the ALREADY-EXISTING child links.
--
-- Shared helper: lock one file_links row + its referenced file (the same idempotent,
-- guarded apply as (1), but invoked from the parent side by id). SECURITY INVOKER + empty
-- search_path + schema-qualified. Runs under the caller's RLS (own-tenant only) — the same
-- tenant that owns the parent owns the child link + file.
-- ----------------------------------------------------------------------------
create or replace function public.lock_file_link_and_file(
  p_tenant_id uuid,
  p_link_id uuid,
  p_file_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Lock the link (idempotent — the file_links immutability trigger allows a false→true
  -- flip; a same-value re-run on an already-locked row would trip it, so guard on is_locked).
  update public.file_links fl
     set is_locked = true, locked_at = now()
   where fl.id = p_link_id
     and fl.tenant_id = p_tenant_id
     and coalesce(fl.is_locked, false) = false;

  -- Flip the referenced file to locked (guarded: only draft/linked → locked).
  update public.files f
     set lifecycle_state = 'locked'
   where f.id = p_file_id
     and f.tenant_id = p_tenant_id
     and f.lifecycle_state in ('draft', 'linked');
end;
$$;

comment on function public.lock_file_link_and_file(uuid, uuid, uuid) is
  'Story 8.4 helper: lock one file_links row (is_locked/locked_at) + flip its referenced files row to lifecycle_state=''locked'' by id. Idempotent (skips an already-locked link) + guarded (only draft/linked → locked). Invoked from the parent-transition lock-apply triggers (quote_versions draft→non-draft, quote_acceptances insert). SECURITY INVOKER + empty search_path + schema-qualified.';

-- (4a) quote_versions: when the version transitions OUT of draft (draft → sent/accepted/…),
-- lock all its quote_pdf / quote_attachment_snapshot child links. AFTER UPDATE so it runs
-- only on a committed transition the 6.4 sent-lock (BEFORE UPDATE) already validated.
create or replace function public.apply_lock_on_quote_version_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r record;
begin
  -- Only act on the draft → non-draft transition (the version's lock moment). A same-value
  -- write or a non-draft → non-draft lifecycle advance re-locks nothing new (idempotent).
  if old.status = 'draft' and new.status <> 'draft' then
    for r in
      select fl.id as link_id, fl.file_id
        from public.file_links fl
       where fl.tenant_id = new.tenant_id
         and fl.owner_type = 'quote_version'
         and fl.owner_id = new.id
         and fl.purpose in ('quote_pdf', 'quote_attachment_snapshot')
    loop
      perform public.lock_file_link_and_file(new.tenant_id, r.link_id, r.file_id);
    end loop;
  end if;
  return new;
end;
$$;

comment on function public.apply_lock_on_quote_version_transition() is
  'Story 8.4 parent-side lock apply (architecture §14, R-812). AFTER UPDATE on quote_versions: on the draft → non-draft transition, locks every existing quote_pdf / quote_attachment_snapshot child link + its file. Complements apply_file_link_lock (which only fires on a file_links write) so a PDF link created while the parent was draft is locked at the send moment even though mark_quote_version_sent never touches file_links. SECURITY INVOKER + empty search_path + schema-qualified.';

drop trigger if exists quote_versions_apply_file_lock on public.quote_versions;
create trigger quote_versions_apply_file_lock
  after update on public.quote_versions
  for each row execute function public.apply_lock_on_quote_version_transition();

-- (4b) quote_acceptances: the acceptance is immutable the moment it exists (AR704 has no
-- draft state). AFTER INSERT, lock its acceptance_evidence child link (if the evidence link
-- was inserted BEFORE the acceptance, apply_file_link_lock already locked it; if AFTER — the
-- 7.2 RPC inserts the acceptance first, then the link — apply_file_link_lock handles it too;
-- this parent-side trigger is belt-and-braces for any ordering).
create or replace function public.apply_lock_on_acceptance_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select fl.id as link_id, fl.file_id
      from public.file_links fl
     where fl.tenant_id = new.tenant_id
       and fl.owner_type = 'quote_acceptance'
       and fl.owner_id = new.id
       and fl.purpose = 'acceptance_evidence'
  loop
    perform public.lock_file_link_and_file(new.tenant_id, r.link_id, r.file_id);
  end loop;
  return new;
end;
$$;

comment on function public.apply_lock_on_acceptance_insert() is
  'Story 8.4 parent-side lock apply (architecture §14, R-812). AFTER INSERT on quote_acceptances: locks any acceptance_evidence child link + its file the moment the acceptance exists (AR704 has no draft state — always immutable). Belt-and-braces for apply_file_link_lock (which locks an evidence link inserted after the acceptance exists). SECURITY INVOKER + empty search_path + schema-qualified.';

drop trigger if exists quote_acceptances_apply_file_lock on public.quote_acceptances;
create trigger quote_acceptances_apply_file_lock
  after insert on public.quote_acceptances
  for each row execute function public.apply_lock_on_acceptance_insert();

-- ----------------------------------------------------------------------------
-- NOTE (Story 8.4 Task 1.4): NO storage-plane trigger (the storage.objects isolation is
-- 8.1's; a locked file's BYTES are not reclaimed by the app path — archive-over-delete).
-- NO file_events table / NO DB audit trigger (a trigger has no envelope context; the audit
-- for a lock/archive/blocked-delete lands through the COMMAND envelope's writeAuditEvent —
-- §15). Function privileges: the triggers are NOT directly callable (they run only as row
-- triggers), so 8.4 adds NO function grant — mirroring the 6.4 sent-lock / 7.4 accepted-lock
-- trigger functions (which likewise add none). The implicit PUBLIC EXECUTE on a trigger
-- function is harmless (it cannot be invoked as a plain function to bypass anything).
-- ============================================================================
