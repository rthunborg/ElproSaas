-- ============================================================================
-- Migration: quote_lost_reasons_and_lost_status
-- Story 10.2 — Förlorad/Avböjd Status and Lost-Reason Lifecycle.
--
-- The SECOND delivered Phase B story. Purely ADDITIVE to the (frozen) Epic 6/7 quote
-- model — a frozen prior migration is NEVER edited; every change here is additive:
--   (1) ONE new tenant-owned table `quote_lost_reasons` (INSERT-ONLY: SELECT + INSERT
--       policies/grants ONLY — no UPDATE, no DELETE; archive-over-delete discipline),
--       mirroring the 7.1 `quote_acceptances` RLS/GRANT/composite-same-tenant-FK pattern
--       MINUS the UPDATE policy/grant + the updated_at trigger (insert-only — nothing
--       updates it).
--   (2) the SINGLE new `lost` lifecycle token widened COHERENTLY across the 3 DB layers
--       of the 5-layer widening (R-1011): the `quote_versions.status` CHECK, the
--       `quote_events.event_type` CHECK, and the 6.4 sent-lock trigger's legal-transition
--       allow-set. The pure `LEGAL_TRANSITIONS` map + the timeline union + the label maps
--       are the TS layers (src/features/quotes/*, src/components/quotes/status.ts).
--   (3) the narrow atomic `mark_quote_version_lost` RPC (architecture-phase-b §14 widening
--       of the lifecycle-RPC family) — the transaction boundary that flips ONLY `status`,
--       appends one `lost` event, and inserts exactly one reason row. SECURITY INVOKER,
--       empty search_path, schema-qualified — mirrors `mark_quote_version_lifecycle`.
--
-- ----------------------------------------------------------------------------
-- THE SETTLED LIFECYCLE-TOKEN MODEL (story ⚑ — do NOT re-litigate): ONE new `lost` token
-- (status + event_type). The Förlorad-vs-Avböjd distinction is NOT a status token — it is
-- stored SOLELY in `quote_lost_reasons.outcome ∈ {forlorad, avbojd}`. status='lost' ⟺
-- exactly one reason row (RPC transaction + `unique (quote_version_id)`).
--
-- ----------------------------------------------------------------------------
-- SENT-IMMUTABILITY PRESERVED (NFR11 / FR63 / ADR-A005): the lost flip changes ONLY the
-- exempt `status` column — the 6.4 sent-lock trigger's row-equality check passes because no
-- customer-visible / commitment column changes. The Förlorad/Avböjd terminal is an APPEND-ONLY
-- lifecycle event + reason record; the sent snapshot is NEVER touched.
--
-- ----------------------------------------------------------------------------
-- SCOPE DISCIPLINE (AGENTS.md; Story 10.2 Stop Conditions): `quote_lost_reasons` is the ONLY
-- table this migration creates. NO money/tax/rounding column (NO float/numeric money column,
-- NO öre column). NO Fortnox/invoice/customer-portal/external-mapping/supplier/sync/api/portal
-- column. NO `updated_at`/`set_updated_at` trigger (insert-only). NO pipeline read-model /
-- follow-up / hit-rate aggregation (Stories 10.3/10.4). NO service-role app path (the RPC is
-- SECURITY INVOKER, under the caller's RLS). NO change to any existing rejected/expired/superseded
-- transition (this story only ADDS `lost`).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- (1) Table: quote_lost_reasons — the insert-only structured reason for a lost/declined
-- SENT quote version (architecture-phase-b §9.1). MANY rows per tenant (at most ONE per
-- version — the unique (quote_version_id) backstop, R-1013). Composite same-tenant FKs to
-- quotes [the parent quote] + quote_versions [the lost version]. Mirrors quote_acceptances
-- (20260709120000) MINUS the money columns, the updated_at trigger, and the UPDATE policy/grant.
-- ----------------------------------------------------------------------------
create table public.quote_lost_reasons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The parent quote + the LOST version reference (both NOT NULL — a reason always names the
  -- specific version it declares lost, on its parent quote).
  quote_id uuid not null,
  quote_version_id uuid not null,
  -- The Förlorad-vs-Avböjd flavour (the ONLY place this distinction lives — NOT in status).
  -- ASCII machine tokens; Swedish UI labels (forlorad→"Förlorad", avbojd→"Avböjd").
  outcome text not null check (outcome in ('forlorad', 'avbojd')),
  -- The structured strawman category (UXB-A5). ASCII machine tokens; Swedish UI labels
  -- (pris→"Pris", konkurrent→"Konkurrent", tidplan→"Tidplan", uteblivet_svar→"Uteblivet svar",
  -- annat→"Annat"). Tenant-tunable in a later story; this story hard-codes the strawman.
  category text not null
    check (category in ('pris', 'konkurrent', 'tidplan', 'uteblivet_svar', 'annat')),
  -- The free-text note. REQUIRED at the command layer when category='annat' (the server
  -- re-validates the gate); the DB stores what the command persisted. The optional CHECK
  -- backstop below fails-closed if a future path tries to persist an empty 'annat' note.
  note text,
  created_at timestamptz not null default now(),
  -- COMPOSITE same-tenant FK to the parent quote (architecture §6). ON DELETE CASCADE.
  constraint quote_lost_reasons_quote_same_tenant
    foreign key (quote_id, tenant_id)
    references public.quotes (id, tenant_id)
    on delete cascade,
  -- COMPOSITE same-tenant FK to the lost quote version. ON DELETE CASCADE.
  constraint quote_lost_reasons_version_same_tenant
    foreign key (quote_version_id, tenant_id)
    references public.quote_versions (id, tenant_id)
    on delete cascade,
  -- ONE reason per lost version (R-1013). A second reason on the same version raises 23505,
  -- which the command maps to VALIDATION_FAILED.
  constraint quote_lost_reasons_version_unique unique (quote_version_id),
  -- Fail-closed backstop: a note is required (non-empty after trim) when category='annat'.
  constraint quote_lost_reasons_annat_note_present
    check (category <> 'annat' or (note is not null and length(btrim(note)) > 0))
);

comment on table public.quote_lost_reasons is
  'Tenant-owned INSERT-ONLY structured reason for a lost/declined SENT quote version (architecture-phase-b §9.1, Story 10.2). MANY rows per tenant, at most ONE per version (unique (quote_version_id) — R-1013). RLS-protected (own-tenant SELECT + INSERT via is_tenant_admin; NO update, NO delete — insert-only + archive-over-delete). Composite same-tenant FKs to quotes(id,tenant_id) + quote_versions(id,tenant_id). outcome in (forlorad|avbojd) carries the Förlorad-vs-Avböjd flavour (NOT the status). category in (pris|konkurrent|tidplan|uteblivet_svar|annat) is the strawman (tenant-tunable later). note is required (command layer + a fail-closed CHECK) when category=annat. Written ONLY by the mark_quote_version_lost RPC. NO money/tax/öre column, NO updated_at, NO Fortnox/supplier/sync/portal column (Story 10.2 Stop Conditions).';

-- ----------------------------------------------------------------------------
-- Index for the command/RLS access path (mirror the quote index pattern).
-- ----------------------------------------------------------------------------
create index quote_lost_reasons_tenant_id_idx
  on public.quote_lost_reasons (tenant_id);

-- ----------------------------------------------------------------------------
-- Base table privileges (GRANTs) — INSERT-ONLY on the app path (the insert-only discipline):
--   authenticated → SELECT, INSERT ONLY (NO update, NO delete — archive over delete; the
--     insert-only shape is what makes 10.2-RLS-01's own-tenant-UPDATE-rejected negative pass).
--   service_role  → full DML (TEST-ONLY factory seed/cleanup; BYPASSRLS).
--   anon          → NOTHING.
-- ----------------------------------------------------------------------------
grant select, insert on public.quote_lost_reasons to authenticated;
grant select, insert, update, delete on public.quote_lost_reasons to service_role;

-- ----------------------------------------------------------------------------
-- Row Level Security: ENABLE + FORCE.
-- ----------------------------------------------------------------------------
alter table public.quote_lost_reasons enable row level security;
alter table public.quote_lost_reasons force row level security;

-- ----------------------------------------------------------------------------
-- Policies: own-tenant SELECT + INSERT via the EXISTING is_tenant_admin helper. NO update
-- policy, NO delete policy (insert-only + archive-over-delete). 2 new policies.
-- ----------------------------------------------------------------------------
create policy quote_lost_reasons_select_own
  on public.quote_lost_reasons for select to authenticated
  using (public.is_tenant_admin(tenant_id));
create policy quote_lost_reasons_insert_own
  on public.quote_lost_reasons for insert to authenticated
  with check (public.is_tenant_admin(tenant_id));

-- INTENTIONALLY NOT CREATED (insert-only + archive-over-delete discipline):
--   * NO UPDATE policy / grant on quote_lost_reasons — an own-tenant UPDATE is DENY-by-default
--     at the privilege layer (42501). This is the load-bearing insert-only enforcement.
--   * NO DELETE policy / grant.
--   * NO updated_at column / set_updated_at trigger (nothing updates the row).

-- ----------------------------------------------------------------------------
-- (2) THE 5-LAYER `lost` WIDENING — the 3 DB layers (R-1011).
--
-- LAYER 1 — quote_versions.status CHECK. Re-add the inline check (Postgres named it
-- quote_versions_status_check) with 'lost' ADDED to the existing set (verified live).
-- ----------------------------------------------------------------------------
alter table public.quote_versions
  drop constraint quote_versions_status_check,
  add constraint quote_versions_status_check
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'superseded', 'lost'));

-- ----------------------------------------------------------------------------
-- LAYER 2 — quote_events.event_type CHECK. Re-add with 'lost' ADDED. PRESERVE the FULL
-- existing set INCLUDING the PDF event tokens ('pdf_generated'/'pdf_failed') added by the 6.3
-- PDF migration — the story's enumerated list predated those; dropping them would break PDF
-- events. The re-add is the LIVE set + 'lost'.
-- ----------------------------------------------------------------------------
alter table public.quote_events
  drop constraint quote_events_event_type_check,
  add constraint quote_events_event_type_check
    check (event_type in (
      'created', 'draft', 'sent', 'accepted', 'rejected', 'expired', 'superseded',
      'pdf_generated', 'pdf_failed', 'lost'
    ));

-- ----------------------------------------------------------------------------
-- LAYER 3 — the 6.4 sent-lock trigger's legal-transition allow-set. Re-emit
-- enforce_quote_version_sent_lock() with 'lost' ADDED to the allowed forward-status set at
-- the reversal guard (20260707120000_quote_version_sent_lock.sql:129). Everything else in the
-- trigger body is BYTE-UNCHANGED — the immutability tuple is NOT weakened. `status` stays in the
-- exempt set so the row-equality check passes on a status-only lost flip.
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

  -- LEGAL-TRANSITION GUARD (Review finding — status was wholesale-exempt with no
  -- state-machine check). `status` is in the exempt set so the append-only lifecycle
  -- can advance, but a REVERSAL out of a non-draft state back to 'draft' would disarm
  -- BOTH this trigger (its old.status='draft' early-return) and the child-lock (which
  -- keys off the parent status <> 'draft'), re-opening every frozen customer-visible
  -- column + the lines/attachments to free mutation — defeating the story's central
  -- irreversible-mark-sent guarantee below the command layer. Reject any move back to
  -- 'draft'; allow only the sanctioned FORWARD lifecycle transitions from a non-draft
  -- state (sent/accepted/rejected/expired/superseded/lost → same, or → a later lifecycle
  -- state) — anything else is an illegal reversal. Story 10.2 ADDS 'lost' to this allow-set.
  -- Codex review P1 (x2): this guard previously validated only the DESTINATION status, so ANY
  -- allow-listed destination was reachable from ANY non-draft source. That permitted (a) a TERMINAL
  -- version being rewritten to 'lost' (e.g. accepted -> lost, whose deferred coherence check an
  -- attacker satisfies by pre-inserting the reason row) and (b) transitions OUT of a terminal state
  -- (lost -> sent / accepted), contradicting the TypeScript state machine where lost/accepted/
  -- rejected/expired/superseded are all terminal ([]). Both bypassed the RPC's event + audit writes.
  -- Validate the (old -> new) PAIR against that same state machine instead. Within this trigger the
  -- draft source already returned above, so 'sent' is the ONLY source with legal onward moves.
  if new.status is distinct from old.status then
    if old.status <> 'sent'
       or new.status not in ('accepted', 'rejected', 'expired', 'superseded', 'lost') then
      raise exception
        'quote_versions status is irreversible once sent: illegal transition % -> % on a non-draft version (architecture §9, §11)',
        old.status, new.status
        using errcode = 'QV409';
    end if;
  end if;

  -- The row is already sent/accepted/rejected/expired/superseded/lost → LOCKED. Allow ONLY
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
         new.id, new.tenant_id, new.quote_id, new.created_at,
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
         old.id, old.tenant_id, old.quote_id, old.created_at,
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
       new.id, new.tenant_id, new.quote_id, new.created_at,
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
       old.id, old.tenant_id, old.quote_id, old.created_at,
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

-- ----------------------------------------------------------------------------
-- (3) The narrow atomic mark_quote_version_lost RPC (architecture-phase-b §14 widening;
-- mirror mark_quote_version_lifecycle, 20260708120000_quote_new_version.sql:385). In ONE txn it:
--   (a) row-locks + loads the target quote_versions row (own-tenant RLS narrows it; a foreign
--       id → 0 rows → QV409);
--   (b) ASSERTS v_status = 'sent' (else QV409 — only a sent version can be lost; the command
--       guard is the primary rejection, this is the below-command belt-and-braces);
--   (c) UPDATEs ONLY the exempt `status` column → 'lost' (the sent-lock trigger's row-equality
--       check passes because 'lost' is now in its allowed set);
--   (d) inserts one quote_events row (event_type='lost', occurred_at = p_occurred_at);
--   (e) inserts one quote_lost_reasons row (outcome/category/note) — a duplicate (unique
--       (quote_version_id)) raises 23505 → the command maps it to VALIDATION_FAILED.
-- A failure at ANY step rolls back the whole txn. SECURITY INVOKER (under the caller's RLS —
-- own-tenant only, no service-role app path) + fixed empty search_path + schema-qualified refs.
-- The audit_events row is written by the COMMAND envelope, not the RPC. The RESOLVED tenant id
-- is passed explicitly (the own-tenant WITH CHECK narrows every write; a cross-tenant p_tenant_id
-- fails 42501 and aborts).
-- ----------------------------------------------------------------------------
create or replace function public.mark_quote_version_lost(
  p_tenant_id uuid,
  p_quote_version_id uuid,
  p_outcome text,
  p_category text,
  p_note text,
  p_occurred_at timestamptz
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

  if not found then
    raise exception 'mark_quote_version_lost: target version not found for tenant'
      using errcode = 'QV409';
  end if;

  -- (b) Only a `sent` version can be marked lost (the command guard is the primary rejection;
  -- this is the below-command belt-and-braces so command + DB agree). A draft/accepted/terminal
  -- (incl. an already-lost) version RAISES QV409 → QUOTE_VERSION_LOCKED.
  if v_status <> 'sent' then
    raise exception 'mark_quote_version_lost: illegal transition from % to lost (only a sent version can be marked lost)', v_status
      using errcode = 'QV409';
  end if;

  -- (c) The lost flip — change ONLY `status` (the sent-lock trigger's exempt column; the
  -- row-equality check passes because no customer-visible column changes).
  update public.quote_versions
     set status = 'lost'
   where id = p_quote_version_id
     and tenant_id = p_tenant_id;

  -- (d) Append the `lost` lifecycle event (occurred_at = the injected instant). The 'lost'
  -- event_type is now in the widened quote_events CHECK set.
  insert into public.quote_events (
    tenant_id, quote_id, quote_version_id, event_type, occurred_at
  )
  values (
    p_tenant_id, v_quote_id, p_quote_version_id, 'lost', p_occurred_at
  );

  -- (e) Insert exactly one reason row (outcome/category/note). A duplicate (unique
  -- (quote_version_id)) raises 23505 → the command maps it to VALIDATION_FAILED.
  insert into public.quote_lost_reasons (
    tenant_id, quote_id, quote_version_id, outcome, category, note
  )
  values (
    p_tenant_id, v_quote_id, p_quote_version_id, p_outcome, p_category, p_note
  );

  return query select p_quote_version_id;
end;
$$;

comment on function public.mark_quote_version_lost(uuid, uuid, text, text, text, timestamptz) is
  'Narrow atomic Förlorad/Avböjd RPC (architecture-phase-b §14, Story 10.2). In ONE txn: (a) row-locks + loads the target quote_versions row (own-tenant RLS narrows it; a foreign id → 0 rows → aborts); (b) ASSERTS status=''sent'' (raise QV409 → QUOTE_VERSION_LOCKED if not — only a sent version can be lost); (c) flips ONLY ''status'' → ''lost'' (the exempt column the sent-lock trigger allows — the row-equality check passes, no customer-visible column changes); (d) appends one quote_events ''lost'' row (occurred_at = the injected instant); (e) inserts exactly one quote_lost_reasons row (outcome/category/note — a duplicate raises 23505 → VALIDATION_FAILED). A failure at ANY step rolls back. SECURITY INVOKER (under the caller''s RLS — own-tenant only, no service-role app path) + fixed empty search_path + schema-qualified refs. The audit_events row is written by the COMMAND envelope. The command-layer transition guard (VALIDATION_FAILED) is the primary rejection; this RPC guard is the below-command belt-and-braces (R-1011).';

revoke execute on function public.mark_quote_version_lost(
  uuid, uuid, text, text, text, timestamptz
) from public;
grant execute on function public.mark_quote_version_lost(
  uuid, uuid, text, text, text, timestamptz
) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- (6) Coherence guard: status='lost' ⟺ a quote_lost_reasons row exists (integration-review F5/Codex).
--
-- The sent-lock trigger's status allow-set (§4) lets an authenticated own-tenant admin flip a sent
-- version's `status` to 'lost' via a DIRECT quote_versions UPDATE through the RLS client/PostgREST —
-- bypassing `mark_quote_version_lost` and its required reason/event/audit writes. That would forge a
-- 'lost' version WITHOUT the `quote_lost_reasons` row, breaking the story's central invariant
-- ("status='lost' ⟺ exactly one reason row" — the row is what carries the Förlorad/Avböjd outcome the
-- pipeline reads). Unlike rejected/expired/superseded (no companion row), 'lost' is load-bearing, so the
-- guard is scoped to 'lost' only.
--
-- A DEFERRABLE INITIALLY DEFERRED constraint trigger checks at COMMIT: the RPC inserts the reason row in
-- the SAME transaction, so it passes; a bare status-only UPDATE has no reason row at commit and is
-- rejected with a NEW distinct code (QV422 → mapped to VALIDATION_FAILED at the app boundary if ever
-- reached that way). Deferred so intra-transaction ordering (status flip before reason insert) is fine.
create or replace function public.enforce_lost_version_has_reason()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'lost'
     and not exists (
       select 1 from public.quote_lost_reasons r
       where r.quote_version_id = new.id
     ) then
    raise exception
      'quote_versions %.status=lost requires a quote_lost_reasons row — use mark_quote_version_lost (architecture-phase-b §9.1, §14)',
      new.id
      using errcode = 'QV422';
  end if;
  return null;
end;
$$;

comment on function public.enforce_lost_version_has_reason() is
  'Coherence guard (Story 10.2, integration-review F5): a quote_versions row at status=''lost'' MUST have a companion quote_lost_reasons row. Runs as a DEFERRABLE INITIALLY DEFERRED constraint trigger checked at COMMIT, so the mark_quote_version_lost RPC (which inserts the reason in the same txn) passes, but a direct status-only UPDATE that forges ''lost'' without a reason row is rejected (QV422). Scoped to ''lost'' only — rejected/expired/superseded have no companion-row invariant.';

create constraint trigger enforce_lost_version_has_reason
  after insert or update on public.quote_versions
  deferrable initially deferred
  for each row
  execute function public.enforce_lost_version_has_reason();
