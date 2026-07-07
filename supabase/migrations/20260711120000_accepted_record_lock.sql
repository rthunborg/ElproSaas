-- ============================================================================
-- Migration: accepted_record_lock
-- Story 7.4 — Accepted State Immutability And Correction Boundary.
--
-- The DB-LEVEL ACCEPTED-IMMUTABILITY ENFORCEMENT of Epic 7 — the load-bearing
-- proof of the accepted-commitment lock (architecture §9: immutable lifecycle
-- tables — quote_versions when sent, `quote_acceptances`, locked file snapshots,
-- audit events — must block normal updates via triggers/constraints, NOT just UI
-- disabling). Purely ADDITIVE to the (frozen) 7.1 acceptance/jobs/job_events model
-- (20260709120000) + the 7.2 accept RPC (20260710120000) — a frozen prior migration
-- is NEVER edited; every change here is additive (BEFORE-UPDATE triggers/functions
-- on the EXISTING tables; NO new TABLE and NO new COLUMN → the tenant-owned set is
-- UNCHANGED, the H4 RLS-inventory gate is UNTOUCHED, and the 7.1 RLS/GRANT posture is
-- inherited verbatim; the trigger adds NO policy so the migration-reset EXACT per-table
-- policy enumeration on quote_acceptances/jobs stays exactly as 7.1 shipped, mirroring
-- how 6.4's quote_events append-only trigger left the policy enumeration unchanged).
--
-- It adds:
--   (1) the accepted-immutability BEFORE-UPDATE trigger on quote_acceptances — a
--       direct own-tenant authenticated UPDATE of ANY commitment column on an accepted
--       record is REJECTED below the command layer. FAIL-CLOSED BY CONSTRUCTION.
--   (2) the source-ref-lock BEFORE-UPDATE trigger on jobs — a direct own-tenant
--       authenticated UPDATE of the immutable source-ref / identity tuple
--       (quote_acceptance_id / quote_version_id / customer_id + id/tenant_id/created_at)
--       is REJECTED, while the 7.3 allowed edit (title/status/planned dates) is EXEMPT.
--
-- Both use the SAME trigger shape as the 6.4 sent-lock (fail-closed-by-construction,
-- custom SQLSTATE, security invoker, empty search_path, schema-qualified) with a
-- DISTINCT-but-related lock code (`AR704` → command ACCEPTED_RECORD_LOCKED, sibling of
-- 6.4's `QV409` → QUOTE_VERSION_LOCKED). This is the "one model at three scopes, shared
-- lock-code FAMILY not a fork" retro constraint (Epic 6 sent-freeze R-605, Epic 7
-- accepted-lock R-704, Epic 8.4 locked-evidence-file): a FAMILY = related-but-distinct
-- codes with a shared trigger shape, NOT one reused code and NOT a divergent mechanism.
-- The 6.4 sent-lock trigger + the 7.2 accept RPC are NOT modified (relying on the
-- sanctioned sent → accepted transition is the design — a frozen migration is never
-- edited).
--
-- ----------------------------------------------------------------------------
-- DIFFERENCE FROM THE 6.4 SENT-LOCK (Story 7.4 Task 1):
-- The 6.4 trigger keys off `old.status <> 'draft'` (only a NON-draft version is
-- locked, and there is a legal forward-transition allow-list on `status`). A
-- `quote_acceptances` row is ALWAYS immutable once it EXISTS (there is no draft
-- acceptance and no lifecycle status column on the acceptance) — so the acceptance
-- trigger locks on EVERY update with NO status early-return. The `jobs` trigger locks
-- the immutable source-ref + identity tuple on EVERY update but EXEMPTS the four
-- allowed-edit columns (title/status/planned_start_date/planned_end_date) so the 7.3
-- `updateJob` allowed edit is never fought.
--
-- ----------------------------------------------------------------------------
-- LOCKED-VS-EXEMPT DECISION (Story 7.4 Task 1.1/1.2 — recorded here per the story):
--   * quote_acceptances — LOCK EVERYTHING except `archived_at` (soft-delete) and
--     `updated_at` (trigger-owned by set_updated_at). RATIONALE: the acceptance record
--     has NO allowed-edit command (unlike `jobs`, whose planned dates ARE editable via
--     updateJob) — nothing legitimately UPDATEs a quote_acceptances row after creation
--     except archival. `notes`/`planned_start_date`/`planned_end_date` are operational,
--     not commitment data, BUT since no live edit path touches them, locking-by-default
--     is the safest posture (AGREES with the 6.4 fail-closed model), and there is no
--     live edit path to break. So the LOCKED set on quote_acceptances is the full
--     immutable tuple: id, tenant_id, quote_id, quote_version_id, channel, accepted_at,
--     accepted_price_ore, source_sent_total_ore, adjustment_reason, evidence_file_id,
--     evidence_reference, notes, planned_start_date, planned_end_date, created_at.
--   * jobs — LOCK the immutable source-ref + identity tuple: id, tenant_id,
--     quote_acceptance_id, quote_version_id, customer_id, created_at. LEAVE
--     facility_id / contact_id UNLOCKED (they are ON DELETE SET NULL — locking them
--     would FIGHT the FK cascade that must be able to null them, and they are NOT
--     AC-named commitment fields). `jobs` has no accepted-price column (the money lives
--     on quote_acceptances), so the job lock is purely the source-ref + identity lock.
--     The four allowed-edit columns (title/status/planned_start_date/planned_end_date)
--     + archived_at + updated_at are simply NOT in the locked tuple, so an updateJob
--     edit of them never trips the trigger.
--
-- FAIL-CLOSED BY CONSTRUCTION: each trigger compares the LOCKED immutable tuple
-- (old vs new). A FUTURE additive column on quote_acceptances that is not in the exempt
-- set would need to be added to the locked tuple to be enforced — but since the
-- acceptance trigger locks EVERYTHING except archived_at/updated_at, a future additive
-- column is locked-by-default ONLY if it is added to the tuple. To keep the "future
-- additive column is locked-by-default" guarantee without a trigger edit, the
-- acceptance trigger EXEMPTS archived_at + updated_at explicitly and RAISES if ANY
-- OTHER column changed — implemented by first checking the exempt columns and then
-- comparing the full locked tuple (mirrors the 6.4 exempt-then-tuple technique). The
-- jobs trigger enumerates the locked identity/source tuple; the exempt columns are
-- simply not in it.
--
-- ----------------------------------------------------------------------------
-- CUSTOM SQLSTATE (Story 7.4 Task 1.3): `AR704` (Accepted-Record, R-704) — a
-- distinguishable 5-char SQLSTATE that does NOT collide with the standard classes the
-- write-error mapper branches on (23503/42501 → TENANT_ACCESS_DENIED; 23505/23514/22P02
-- → VALIDATION_FAILED) NOR with 6.4's `QV409` (which maps to QUOTE_VERSION_LOCKED, a
-- DIFFERENT scope). Mapping: `AR704` → command `ACCEPTED_RECORD_LOCKED`
-- (src/server/commands/jobs/jobs-db.ts throwMappedJobWriteError; the AR704 branch).
--
-- ----------------------------------------------------------------------------
-- INTENTIONAL LOVABLE-ORACLE DELTA (Story 7.4 7.4-DOCS-01): Lovable allowed MUTABLE
-- acceptance evidence + a client-side multi-step acceptance. Phase A accepted records +
-- job source refs are IMMUTABLE once accepted (locked at BOTH the command layer
-- [ACCEPTED_RECORD_LOCKED] AND the DB layer [these triggers]); a correction requires an
-- approved audited workflow, NOT a silent edit. This is a DELIBERATE, safer Phase A
-- difference — the Lovable app is a behavioral oracle ONLY (the mutable behavior is
-- NEVER copied; AGENTS.md; ADR-A007).
--
-- ----------------------------------------------------------------------------
-- SCOPE DISCIPLINE (architecture §7; Story 7.4 Stop Conditions):
-- Triggers/functions on the EXISTING quote_acceptances/jobs tables are the ONLY objects.
-- NO new TABLE and NO new COLUMN (H4 + migration-reset per-table policy enumeration
-- untouched). NO trigger on job_events (its append-only-ness is a separate concern; it
-- has no immutable-commitment field and the 7.3 updateJob never UPDATEs a job_events row
-- — it INSERTs). NO modification of the 6.4 sent-lock trigger or the 7.2 accept RPC
-- (relying on the sanctioned sent → accepted transition is the design — a frozen
-- migration is never edited). NO broad correction/edit workflow after acceptance (7.4
-- enforces the immutability BOUNDARY only; the correction WORKFLOW is owner-gated,
-- R-714). NO inline money math / NO recompute of totals/VAT (the trigger only COMPARES
-- old↔new and RAISEs).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- (1) The accepted-immutability trigger function on quote_acceptances.
--
-- Fires BEFORE UPDATE FOR EACH ROW. A quote_acceptances row is ALWAYS immutable once it
-- exists (no draft acceptance, no lifecycle status column) — so there is NO status
-- early-return. The EXEMPT set (columns that MAY change on an accepted row): archived_at
-- (soft-delete flip) and updated_at (trigger-owned by set_updated_at). RAISE (AR704) if
-- ANY OTHER column differs old↔new.
--
-- SECURITY INVOKER (default) — the guard only inspects the operation in flight and
-- raises; it needs no elevated privilege. Pin an empty search_path defensively +
-- schema-qualify (mirror the 6.4 sent-lock / audit_events_block_mutation hardening).
-- ----------------------------------------------------------------------------
create or replace function public.enforce_quote_acceptance_lock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- The row is immutable. Allow ONLY the exempt columns (archived_at, updated_at) to
  -- change; RAISE on any commitment column change (fail-closed: everything not exempt is
  -- locked). First branch: an exempt column changed → verify NOTHING ELSE changed by
  -- comparing the full LOCKED commitment tuple; if it is still distinct, a locked column
  -- was also touched → RAISE.
  if new.archived_at is distinct from old.archived_at
    or new.updated_at is distinct from old.updated_at then
    if row(
         new.id, new.tenant_id, new.quote_id, new.quote_version_id, new.channel,
         new.accepted_at, new.accepted_price_ore, new.source_sent_total_ore,
         new.adjustment_reason, new.evidence_file_id, new.evidence_reference,
         new.notes, new.planned_start_date, new.planned_end_date, new.created_at
       ) is distinct from row(
         old.id, old.tenant_id, old.quote_id, old.quote_version_id, old.channel,
         old.accepted_at, old.accepted_price_ore, old.source_sent_total_ore,
         old.adjustment_reason, old.evidence_file_id, old.evidence_reference,
         old.notes, old.planned_start_date, old.planned_end_date, old.created_at
       ) then
      raise exception
        'quote_acceptances is immutable once accepted: commitment columns cannot be changed (architecture §9; corrections require an approved audited workflow)'
        using errcode = 'AR704';
    end if;
    -- Only exempt columns changed → allow.
    return new;
  end if;

  -- No exempt column changed, so ANY change is to a LOCKED commitment column. Compare the
  -- full commitment tuple; if it changed, RAISE.
  if row(
       new.id, new.tenant_id, new.quote_id, new.quote_version_id, new.channel,
       new.accepted_at, new.accepted_price_ore, new.source_sent_total_ore,
       new.adjustment_reason, new.evidence_file_id, new.evidence_reference,
       new.notes, new.planned_start_date, new.planned_end_date, new.created_at
     ) is distinct from row(
       old.id, old.tenant_id, old.quote_id, old.quote_version_id, old.channel,
       old.accepted_at, old.accepted_price_ore, old.source_sent_total_ore,
       old.adjustment_reason, old.evidence_file_id, old.evidence_reference,
       old.notes, old.planned_start_date, old.planned_end_date, old.created_at
     ) then
    raise exception
      'quote_acceptances is immutable once accepted: commitment columns cannot be changed (architecture §9; corrections require an approved audited workflow)'
      using errcode = 'AR704';
  end if;

  return new;
end;
$$;

comment on function public.enforce_quote_acceptance_lock() is
  'Story 7.4 accepted-immutability guard (architecture §9, ADR-A005). BEFORE UPDATE on quote_acceptances: a change to ANY commitment column RAISES (SQLSTATE AR704 → command ACCEPTED_RECORD_LOCKED). FAIL-CLOSED by construction — the EXEMPT set (archived_at [soft-delete], updated_at [trigger-owned]) is enumerated; EVERYTHING else — including the identity/source columns id/tenant_id/quote_id/quote_version_id, the money accepted_price_ore/source_sent_total_ore, channel/accepted_at/adjustment_reason/evidence_*/notes/planned dates/created_at — is locked-by-default. An acceptance is ALWAYS immutable once it exists (no draft acceptance, no lifecycle status), so there is no status early-return (unlike the 6.4 sent-lock). SECURITY INVOKER + empty search_path + schema-qualified. AR704 → ACCEPTED_RECORD_LOCKED is a DISTINCT-but-related sibling of 6.4 QV409 → QUOTE_VERSION_LOCKED (the shared lock-code FAMILY, not a fork). Corrections require an approved audited workflow (owner-gated, R-714) — NOT a silent edit.';

create trigger quote_acceptances_accepted_lock
  before update on public.quote_acceptances
  for each row execute function public.enforce_quote_acceptance_lock();

-- ----------------------------------------------------------------------------
-- (2) The source-ref-lock trigger function on jobs.
--
-- Fires BEFORE UPDATE FOR EACH ROW. The IMMUTABLE source-ref + identity tuple
-- (id, tenant_id, quote_acceptance_id, quote_version_id, customer_id, created_at) is
-- locked on EVERY update; a change to ANY of them RAISEs (AR704). The four allowed-edit
-- columns (title, status, planned_start_date, planned_end_date) + archived_at +
-- updated_at are NOT in the locked tuple, so the 7.3 `updateJob` allowed edit never trips
-- the trigger. facility_id / contact_id are ON DELETE SET NULL and NOT AC-named
-- commitment fields — deliberately LEFT OUT of the locked tuple so the FK cascade can
-- null them (locking them would fight the cascade).
--
-- SECURITY INVOKER + empty search_path + schema-qualified (same hardening as (1)).
-- ----------------------------------------------------------------------------
create or replace function public.enforce_job_source_ref_lock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Lock the immutable source-ref + identity tuple. The exempt columns
  -- (title/status/planned dates/archived_at/updated_at + the SET-NULL facility_id/
  -- contact_id) are simply NOT in this tuple, so an allowed edit of them passes; a change
  -- to any immutable source ref RAISEs.
  if row(
       new.id, new.tenant_id, new.quote_acceptance_id, new.quote_version_id,
       new.customer_id, new.created_at
     ) is distinct from row(
       old.id, old.tenant_id, old.quote_acceptance_id, old.quote_version_id,
       old.customer_id, old.created_at
     ) then
    raise exception
      'jobs source references are immutable once accepted: the immutable source/identity linkage cannot be changed (architecture §9; corrections require an approved audited workflow)'
      using errcode = 'AR704';
  end if;

  return new;
end;
$$;

comment on function public.enforce_job_source_ref_lock() is
  'Story 7.4 job source-ref lock (architecture §9, ADR-A005). BEFORE UPDATE on jobs: a change to the IMMUTABLE source/identity tuple (id, tenant_id, quote_acceptance_id, quote_version_id, customer_id, created_at) RAISES (SQLSTATE AR704 → command ACCEPTED_RECORD_LOCKED). The 7.3 allowed-edit columns (title/status/planned_start_date/planned_end_date) + archived_at + updated_at are NOT in the locked tuple, so an updateJob edit never trips it. facility_id/contact_id are ON DELETE SET NULL (NOT AC-named commitment fields) and deliberately UNLOCKED so the FK cascade can null them. SECURITY INVOKER + empty search_path + schema-qualified. Sibling of the 6.4 sent-lock (the shared lock-code FAMILY, not a fork).';

create trigger jobs_source_ref_lock
  before update on public.jobs
  for each row execute function public.enforce_job_source_ref_lock();

-- ----------------------------------------------------------------------------
-- NOTE (Story 7.4 Task 1.4): NO trigger on job_events. Its append-only-ness is a
-- separate concern — job_events has no immutable-commitment field, and the 7.3 updateJob
-- never UPDATEs a job_events row (it INSERTs a lifecycle row on a status change). The AC
-- does NOT name job_events. A job_events append-only trigger (the analog of 6.4's
-- quote_events append-only guard) is DEFERRED with its own owner (the same later owner as
-- the 6.4 quote_events INSERT-ability item) — NOT silently expanded into this scope.
--
-- Function privileges: the triggers are NOT directly callable (they run only as row
-- triggers), so 7.4 adds NO function grant — mirroring the 6.4 sent-lock trigger
-- functions (which likewise add no grant). The implicit PUBLIC EXECUTE on a trigger
-- function is harmless (it cannot be invoked as a plain function to bypass anything; it
-- only inspects the trigger context and raises).
-- ============================================================================
