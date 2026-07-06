-- ============================================================================
-- Migration: quote_version_sent_lock
-- Story 6.4 — Mark Quote Version Sent And Enforce Immutability.
--
-- The FIRST DB-LEVEL IMMUTABILITY ENFORCEMENT of Epic 6. Additive to the (frozen)
-- 6.1 quote model + the 6.3 pdf-render column — a frozen prior migration is NEVER
-- edited; every change here is purely ADDITIVE (triggers/functions on EXISTING
-- tables; NO new table → the tenant-owned set is unchanged, the H4 RLS-inventory
-- gate is untouched, the 6.1 RLS/GRANT posture is inherited verbatim).
--
-- It adds:
--   (1) the sent-lock BEFORE UPDATE trigger on quote_versions — a direct own-tenant
--       authenticated UPDATE of a CUSTOMER-VISIBLE / commitment column on a NON-draft
--       (sent/accepted/…) row is REJECTED below the command layer (architecture §9:
--       immutable lifecycle tables block updates via triggers/constraints, NOT just
--       UI disabling). The trigger EXEMPTS the derived PDF-render columns
--       (pdf_status/pdf_file_id/pdf_generated_at — a sent version's PDF stays
--       regenerable/retryable; the 6.3 forward obligation), the allowed append-only
--       lifecycle machinery (status transitions, archived_at, updated_at).
--   (2) the child-snapshot lock trigger on quote_version_lines /
--       quote_version_attachments — a sent version's customer-visible lines +
--       selected attachments are immutable too (architecture §11); an INSERT/UPDATE/
--       DELETE against a child of a NON-draft parent is REJECTED.
--   (3) the append-only trigger on quote_events — reconciles the 6.1 latent
--       event-log integrity seam (quote_events had an own-tenant UPDATE policy + grant;
--       a persisted `sent`/lifecycle event could be MUTATED). Mirrors the audit_events
--       append-only posture (the safest reconciliation; keeps the policy SET stable so
--       the migration-reset EXACT policy enumeration is UNCHANGED — the append-only
--       trigger closes the seam WITHOUT dropping a policy/grant).
--   (4) the narrow atomic `mark_quote_version_sent` RPC (ADR-A009) — the transaction
--       boundary for the draft→sent transition + the `sent` event. SECURITY INVOKER
--       (runs under the caller's RLS — own-tenant only, no service-role app path), a
--       fixed empty search_path + schema-qualified refs, an EXPLICIT sent-timestamp
--       parameter (no wall-clock). The audit row is written by the COMMAND envelope
--       (as in the create/pdf commands), not the RPC.
--
-- ----------------------------------------------------------------------------
-- SENT-FIELD STORAGE SHAPE (Story 6.4 Task 2.1 — the conservative resolution):
-- AC1 records a sent timestamp + optional channel/reference. The `quote_events`
-- `sent` row ALREADY carries occurred_at (= the explicit sent timestamp) + optional
-- channel/reference (frozen 6.1 columns), so the sent metadata is recorded WITHOUT a
-- schema change — the event log IS the lifecycle record. NO denormalized
-- quote_versions.sent_at column is added (avoids a data-model change; the "sent event/
-- channel semantics materially affect data model" STOP condition is resolved
-- conservatively). channel/reference stay OPTIONAL recorded free-text fields
-- ("if supported" per the epic) — NEVER an email-send / delivery integration.
--
-- ----------------------------------------------------------------------------
-- INTENTIONAL LOVABLE-ORACLE DELTA (Story 6.4 6.4-DOCS-01): Lovable allowed MUTABLE
-- quote versions. Phase A quote versions become IMMUTABLE once sent (customer-visible
-- fields / selected attachments / PDF-source data locked at BOTH the command layer
-- [QUOTE_VERSION_LOCKED] AND the DB layer [these triggers]; changes require a new
-- version). This is a DELIBERATE, safer Phase A difference — the Lovable app is a
-- behavioral oracle ONLY (the mutable behavior is NEVER copied).
--
-- ----------------------------------------------------------------------------
-- SCOPE DISCIPLINE (architecture §7; Story 6.4 Stop Conditions):
-- Triggers/functions on the EXISTING quote_* tables + one RPC are the ONLY objects.
-- NO new TABLE (H4 untouched). NO Fortnox/invoice/customer-portal/external-mapping/
-- supplier/sync/credential/api/edi column or table. NO acceptance/job table (Epic 7 —
-- 6.4 proves SENT immutability ONLY, not accepted). NO new-version RPC (Story 6.5).
-- NO email-send/portal/public-acceptance mechanism (channel/reference are optional
-- recorded free-text fields). NO inline money math / NO recompute of totals/VAT (the
-- version is FROZEN — mark-sent only stamps lifecycle). NO service-role app path.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- (1) The sent-lock trigger function on quote_versions.
--
-- Fires BEFORE UPDATE FOR EACH ROW. When the row is ALREADY non-draft (OLD.status <>
-- 'draft' — i.e. it has been sent/accepted/…), any change to a CUSTOMER-VISIBLE /
-- commitment column RAISES. The draft→sent transition itself (OLD.status = 'draft')
-- is ALLOWED — the trigger does not fire on a draft row.
--
-- FAIL-CLOSED BY CONSTRUCTION: rather than enumerating the LOCKED columns (which would
-- let a FUTURE additive customer-visible column be silently mutable), we enumerate the
-- EXEMPT columns and RAISE on a change to ANYTHING else. The exempt set:
--   * pdf_status / pdf_file_id / pdf_generated_at — the DERIVED PDF-render columns
--     (retry regenerates a derived PDF, NOT commitment data — architecture §12; the
--     6.3 forward obligation). A sent version's PDF stays regenerable/retryable.
--   * status — the append-only lifecycle transitions (sent → accepted/rejected/
--     expired/superseded). A same-value status write is a no-op and allowed.
--   * archived_at — the soft-delete flip.
--   * updated_at — trigger-owned (set_updated_at bumps it on every UPDATE).
-- A change to base_total_ore / intro_text / terms_* / company_* / customer_* / any
-- *_total_ore / vat_* / deduction_* / requires_sign_off / display_mode / warnings_
-- snapshot / quote_number / version_number / calculation_id / captured_at / valid_until
-- / customer_notes / … on a non-draft row is REJECTED (locked by default).
--
-- SECURITY INVOKER (default) — the guard only inspects the operation in flight and
-- raises; it needs no elevated privilege. Pin an empty search_path defensively +
-- schema-qualify (mirror audit_events_block_mutation / the DEFINER-fn hardening).
-- The custom SQLSTATE 'QV409' is DISTINGUISHABLE by the write-error mapper (it does
-- not collide with 23503/42501 → TENANT_ACCESS_DENIED nor 23505/23514/22P02 →
-- VALIDATION_FAILED) so it maps to the NEW QUOTE_VERSION_LOCKED command code.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_quote_version_sent_lock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Only a NON-draft row is locked. The draft→sent transition (OLD.status='draft')
  -- is the ALLOWED path — flip status + stamp nothing else on the row.
  if old.status = 'draft' then
    return new;
  end if;

  -- The row is already sent/accepted/rejected/expired/superseded → LOCKED. Allow ONLY
  -- the exempt derived/lifecycle columns to change; RAISE on any customer-visible /
  -- commitment column change (fail-closed: everything not exempt is locked).
  if new.pdf_status is distinct from old.pdf_status
    or new.pdf_file_id is distinct from old.pdf_file_id
    or new.pdf_generated_at is distinct from old.pdf_generated_at
    or new.status is distinct from old.status
    or new.archived_at is distinct from old.archived_at
    or new.updated_at is distinct from old.updated_at then
    -- One or more EXEMPT columns changed. Verify NOTHING ELSE changed by comparing the
    -- two rows with the exempt columns normalized to a common value: if the rows are
    -- still distinct after that, a LOCKED column was also touched → RAISE.
    if row(
         new.quote_number, new.version_number, new.calculation_id, new.captured_at,
         new.company_name, new.company_org_nr, new.company_address_line1,
         new.company_address_line2, new.company_postal_code, new.company_city,
         new.company_email, new.company_phone, new.company_logo_url,
         new.customer_display_name, new.customer_type, new.facility_name,
         new.contact_name, new.quote_number_display, new.valid_until,
         new.intro_text, new.customer_notes, new.terms_text, new.terms_approved_at,
         new.terms_approved_by, new.base_total_ore, new.option_total_ore,
         new.vat_total_ore, new.deduction_total_ore, new.accepted_price_ore,
         new.vat_rate_bp, new.vat_display, new.deduction_type, new.deduction_rate_bp,
         new.deduction_cap_ore, new.deduction_persons, new.requires_sign_off,
         new.display_mode, new.warnings_snapshot
       ) is distinct from row(
         old.quote_number, old.version_number, old.calculation_id, old.captured_at,
         old.company_name, old.company_org_nr, old.company_address_line1,
         old.company_address_line2, old.company_postal_code, old.company_city,
         old.company_email, old.company_phone, old.company_logo_url,
         old.customer_display_name, old.customer_type, old.facility_name,
         old.contact_name, old.quote_number_display, old.valid_until,
         old.intro_text, old.customer_notes, old.terms_text, old.terms_approved_at,
         old.terms_approved_by, old.base_total_ore, old.option_total_ore,
         old.vat_total_ore, old.deduction_total_ore, old.accepted_price_ore,
         old.vat_rate_bp, old.vat_display, old.deduction_type, old.deduction_rate_bp,
         old.deduction_cap_ore, old.deduction_persons, old.requires_sign_off,
         old.display_mode, old.warnings_snapshot
       ) then
      raise exception
        'quote_versions is immutable once sent: customer-visible / commitment columns cannot be changed on a non-draft version (architecture §9, §11)'
        using errcode = 'QV409';
    end if;
    -- Only exempt columns changed → allow.
    return new;
  end if;

  -- No exempt column changed on a non-draft row, so ANY change is to a LOCKED column.
  -- Compare the full customer-visible/commitment tuple; if it changed, RAISE.
  if row(
       new.quote_number, new.version_number, new.calculation_id, new.captured_at,
       new.company_name, new.company_org_nr, new.company_address_line1,
       new.company_address_line2, new.company_postal_code, new.company_city,
       new.company_email, new.company_phone, new.company_logo_url,
       new.customer_display_name, new.customer_type, new.facility_name,
       new.contact_name, new.quote_number_display, new.valid_until,
       new.intro_text, new.customer_notes, new.terms_text, new.terms_approved_at,
       new.terms_approved_by, new.base_total_ore, new.option_total_ore,
       new.vat_total_ore, new.deduction_total_ore, new.accepted_price_ore,
       new.vat_rate_bp, new.vat_display, new.deduction_type, new.deduction_rate_bp,
       new.deduction_cap_ore, new.deduction_persons, new.requires_sign_off,
       new.display_mode, new.warnings_snapshot
     ) is distinct from row(
       old.quote_number, old.version_number, old.calculation_id, old.captured_at,
       old.company_name, old.company_org_nr, old.company_address_line1,
       old.company_address_line2, old.company_postal_code, old.company_city,
       old.company_email, old.company_phone, old.company_logo_url,
       old.customer_display_name, old.customer_type, old.facility_name,
       old.contact_name, old.quote_number_display, old.valid_until,
       old.intro_text, old.customer_notes, old.terms_text, old.terms_approved_at,
       old.terms_approved_by, old.base_total_ore, old.option_total_ore,
       old.vat_total_ore, old.deduction_total_ore, old.accepted_price_ore,
       old.vat_rate_bp, old.vat_display, old.deduction_type, old.deduction_rate_bp,
       old.deduction_cap_ore, old.deduction_persons, old.requires_sign_off,
       old.display_mode, old.warnings_snapshot
     ) then
    raise exception
      'quote_versions is immutable once sent: customer-visible / commitment columns cannot be changed on a non-draft version (architecture §9, §11)'
      using errcode = 'QV409';
  end if;

  return new;
end;
$$;

comment on function public.enforce_quote_version_sent_lock() is
  'Story 6.4 sent-lock guard (architecture §9/§11). BEFORE UPDATE on quote_versions: when OLD.status <> ''draft'' (already sent/accepted/…), a change to ANY customer-visible / commitment column RAISES (SQLSTATE QV409 → command QUOTE_VERSION_LOCKED). FAIL-CLOSED by construction — the EXEMPT set (pdf_status/pdf_file_id/pdf_generated_at [derived PDF render — 6.3 retry], status [lifecycle transitions], archived_at [soft-delete], updated_at [trigger-owned]) is enumerated; everything else is locked-by-default so a FUTURE additive customer-visible column is immutable without a trigger change. The draft→sent transition (OLD.status=''draft'') is ALLOWED. SECURITY INVOKER + empty search_path + schema-qualified (mirrors audit_events_block_mutation).';

create trigger quote_versions_sent_lock
  before update on public.quote_versions
  for each row execute function public.enforce_quote_version_sent_lock();

-- ----------------------------------------------------------------------------
-- (2) The child-snapshot lock trigger on quote_version_lines /
-- quote_version_attachments.
--
-- A sent version's customer-visible LINES + selected ATTACHMENTS are immutable too
-- (architecture §11 "selected attachments are immutable"). Fires BEFORE INSERT OR
-- UPDATE OR DELETE FOR EACH ROW: look up the PARENT quote_versions.status by
-- quote_version_id (from NEW on insert/update, from OLD on delete) and RAISE when the
-- parent is NON-draft. The real exposure is UPDATE (granted) + a crafted INSERT of a
-- new line into a sent version; DELETE is already deny-by-default (no grant/policy on
-- the six tables), so the DELETE arm is belt-and-braces.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_quote_version_child_sent_lock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_parent_id uuid;
  v_parent_status text;
begin
  -- The parent version id: from the surviving row (NEW on insert/update, OLD on delete).
  if tg_op = 'DELETE' then
    v_parent_id := old.quote_version_id;
  else
    v_parent_id := new.quote_version_id;
  end if;

  select qv.status into v_parent_status
    from public.quote_versions qv
   where qv.id = v_parent_id;

  -- A parent that is not visible (null) leaves the FK to reject the write; only RAISE
  -- when the parent EXISTS and is NON-draft (its snapshot is frozen).
  if v_parent_status is not null and v_parent_status <> 'draft' then
    raise exception
      'quote_version child snapshot is immutable once the parent version is sent (architecture §11)'
      using errcode = 'QV409';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function public.enforce_quote_version_child_sent_lock() is
  'Story 6.4 child-snapshot lock (architecture §11). BEFORE INSERT/UPDATE/DELETE on quote_version_lines / quote_version_attachments: RAISES (SQLSTATE QV409 → QUOTE_VERSION_LOCKED) when the PARENT quote_versions.status <> ''draft'' — a sent version''s customer-visible lines + selected attachments are immutable. SECURITY INVOKER + empty search_path + schema-qualified.';

create trigger quote_version_lines_sent_lock
  before insert or update or delete on public.quote_version_lines
  for each row execute function public.enforce_quote_version_child_sent_lock();

create trigger quote_version_attachments_sent_lock
  before insert or update or delete on public.quote_version_attachments
  for each row execute function public.enforce_quote_version_child_sent_lock();

-- ----------------------------------------------------------------------------
-- (3) quote_events append-only reconciliation (deferred-work 6-1 → OWNER: Story 6.4).
--
-- 6.1 gave quote_events an own-tenant UPDATE policy + an `authenticated` UPDATE grant
-- (uniform with the other five tables). A customer-facing lifecycle event log with a
-- live UPDATE path is a latent integrity seam — a persisted `sent` (or any) event could
-- be MUTATED, in tension with the append-only audit_events posture. RECONCILED with the
-- SAFEST option: an append-only BEFORE UPDATE OR DELETE trigger that RAISES (mirrors the
-- audit_events append-only trigger). This keeps the POLICY SET stable — the
-- quote_events.{SELECT,INSERT,UPDATE} policies + the grant are left in place, so the
-- migration-reset EXACT per-table policy enumeration is UNCHANGED (no policy dropped /
-- enumeration adjusted) — the trigger closes the seam by failing loud at the table.
-- Do NOT introduce an event-EDIT UI.
-- ----------------------------------------------------------------------------
create or replace function public.quote_events_block_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception
    'quote_events is append-only: % is not permitted (architecture §9; the lifecycle event log is immutable)',
    tg_op
    using errcode = 'restrict_violation';
end;
$$;

comment on function public.quote_events_block_mutation() is
  'Story 6.4 append-only guard for the quote lifecycle event log (architecture §9; deferred-work 6-1 reconciliation). Raises on any UPDATE or DELETE of quote_events so a persisted lifecycle event (created/draft/sent/accepted/…) can never be mutated — mirrors the audit_events append-only posture. Keeps the 6.1 policy set stable (no policy/grant removed; the migration-reset exact enumeration is unchanged). SECURITY INVOKER + empty search_path.';

create trigger quote_events_append_only
  before update or delete on public.quote_events
  for each row execute function public.quote_events_block_mutation();

-- ----------------------------------------------------------------------------
-- (4) The narrow atomic mark_quote_version_sent RPC (ADR-A009, AC1).
--
-- In ONE transaction it:
--   (a) locks + loads the target quote_versions row (own-tenant WITH CHECK narrows it
--       to the caller; a foreign id is invisible → 0 rows → the command already denied
--       it before execute) FOR UPDATE (a race-safe row lock);
--   (b) ASSERTS status = 'draft' (raise QV409 if not — a race-safe re-check below the
--       command; maps to QUOTE_VERSION_LOCKED);
--   (c) UPDATEs status = 'sent' — the draft→sent transition the sent-lock trigger ALLOWS;
--   (d) inserts a quote_events row event_type='sent', occurred_at = p_sent_at,
--       channel = p_channel, reference = p_reference, referencing the quote + version.
-- A failure at ANY step rolls back the whole txn. SECURITY INVOKER (ADR-A009 default —
-- runs under the caller's RLS, own-tenant only, no service-role app path) with a fixed
-- empty search_path + schema-qualified refs. The audit_events row is written by the
-- COMMAND envelope (as in the create/pdf commands), not the RPC.
-- The RESOLVED tenant id is passed explicitly (the own-tenant WITH CHECK narrows every
-- write to the caller anyway; a cross-tenant p_tenant_id fails 42501 and aborts the txn).
-- ----------------------------------------------------------------------------
create or replace function public.mark_quote_version_sent(
  p_tenant_id uuid,
  p_quote_version_id uuid,
  p_sent_at timestamptz,
  p_channel text,
  p_reference text
)
returns table (quote_version_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quote_id uuid;
  v_status text;
begin
  -- (a) Lock + load the target row (own-tenant RLS narrows it; a foreign id → 0 rows).
  select qv.quote_id, qv.status
    into v_quote_id, v_status
    from public.quote_versions qv
   where qv.id = p_quote_version_id
     and qv.tenant_id = p_tenant_id
   for update;

  -- Not visible under the caller's RLS (or a mismatched tenant) → nothing to send.
  -- Surface as QV409 → the command maps a null-load to a denial before this (loadStatus),
  -- so reaching here with 0 rows is a race; fail closed.
  if not found then
    raise exception 'mark_quote_version_sent: target version not found for tenant'
      using errcode = 'QV409';
  end if;

  -- (b) Race-safe re-assert draft (the command already checked, but re-check under the
  -- row lock so two concurrent sends cannot both flip it).
  if v_status <> 'draft' then
    raise exception 'mark_quote_version_sent: version is not a draft (already %)', v_status
      using errcode = 'QV409';
  end if;

  -- (c) The draft→sent transition (the sent-lock trigger ALLOWS this — only status flips).
  update public.quote_versions
     set status = 'sent'
   where id = p_quote_version_id
     and tenant_id = p_tenant_id;

  -- (d) Append the lifecycle 'sent' event (occurred_at = the injected sent timestamp;
  -- optional channel/reference recorded as free-text). The `sent` event_type is already
  -- in the quote_events closed CHECK set (6.1) — no widening needed.
  insert into public.quote_events (
    tenant_id, quote_id, quote_version_id, event_type, occurred_at, channel, reference
  )
  values (
    p_tenant_id, v_quote_id, p_quote_version_id, 'sent', p_sent_at, p_channel, p_reference
  );

  return query select p_quote_version_id;
end;
$$;

comment on function public.mark_quote_version_sent(uuid, uuid, timestamptz, text, text) is
  'Narrow atomic mark-sent RPC (architecture ADR-A009, Story 6.4). In ONE txn: (a) row-locks + loads the target quote_versions row (own-tenant RLS narrows it; a foreign id → 0 rows → aborts); (b) race-safe re-asserts status=''draft'' (raise QV409 → QUOTE_VERSION_LOCKED if not); (c) flips status to ''sent'' (the draft→sent transition the sent-lock trigger allows); (d) appends a quote_events ''sent'' row with occurred_at = the EXPLICIT injected sent timestamp (no wall-clock) + optional channel/reference. A failure at ANY step rolls back the whole txn. SECURITY INVOKER (runs under the caller''s RLS — own-tenant only, no service-role app path) with a fixed empty search_path + schema-qualified refs. The audit_events row is written by the COMMAND envelope, not the RPC. channel/reference are optional recorded free-text fields — NEVER an email-send/delivery integration.';

-- Function privileges: revoke the implicit PUBLIC EXECUTE, then grant ONLY to the
-- app-runtime + test roles (mirror the 6.1 create RPC). anon must NOT execute.
revoke execute on function public.mark_quote_version_sent(
  uuid, uuid, timestamptz, text, text
) from public;
grant execute on function public.mark_quote_version_sent(
  uuid, uuid, timestamptz, text, text
) to authenticated, service_role;
