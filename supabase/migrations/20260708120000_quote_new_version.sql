-- ============================================================================
-- Migration: quote_new_version
-- Story 6.5 — New Quote Version After Customer-Visible Changes.
--
-- The LAST migration of Epic 6 and the new-version + lifecycle-transition flow.
-- Purely ADDITIVE to the (frozen) 6.1 quote model + the 6.4 sent-lock/child-lock/
-- append-only triggers — a frozen prior migration is NEVER edited; every change
-- here is additive (two SECURITY INVOKER RPCs on EXISTING tables; NO new TABLE →
-- the tenant-owned set is UNCHANGED, the H4 RLS-inventory gate is UNTOUCHED [H4
-- covers TABLES, not functions], and the 6.1 RLS/GRANT posture is inherited
-- verbatim).
--
-- It adds:
--   (1) create_new_quote_version — the SIBLING of the 6.1
--       create_quote_version_from_calculation RPC (ADR-A009) for an EXISTING quote.
--       It MIRRORS the 6.1 create RPC EXACTLY (same empty search_path + schema-
--       qualified refs, same SECURITY INVOKER, same returns-table shape, the SAME
--       quote_versions/quote_version_lines/quote_version_attachments INSERT column
--       lists + jsonb key reads, the SAME find-or-create file_links guard) but for
--       an EXISTING quote: instead of allocating a new quote_number + inserting a
--       fresh `quotes` row, it (a) row-locks the PARENT `quotes` row FOR UPDATE
--       (own-tenant RLS narrows it; a foreign quote id → 0 rows → RAISE/abort);
--       (b) computes version_number = max+1 over the quote's versions UNDER the row
--       lock (so concurrent new-version creations on the same quote serialize and
--       get DISTINCT version numbers — R-604-shaped concurrency); (c) inserts the
--       new quote_versions row status='draft', version_number=max+1, quote_number =
--       the PARENT quote's existing number (per-quote SHARED — NO tenant_counters
--       increment); (d) inserts a quote_events 'created' event for the new version;
--       (e) IF p_supersede_prior is true, marks the IMMEDIATELY-PRIOR SENT version
--       'superseded' + appends a quote_events 'superseded' event for it (the
--       sanctioned forward transition the 6.4 sent-lock trigger ALLOWS — it touches
--       ONLY the exempt `status` column). A failure at ANY step rolls back the whole
--       txn.
--   (2) mark_quote_version_lifecycle — the narrow atomic RPC for a standalone
--       rejected/expired/superseded transition on a prior SENT version. In ONE txn
--       it row-locks + loads the target version, VALIDATES the transition is LEGAL
--       from the CURRENT status (a reversal to draft, or a transition off a draft/
--       terminal state RAISES QV409 → QUOTE_VERSION_LOCKED), UPDATEs ONLY `status`
--       (the exempt column the sent-lock trigger allows), and appends the matching
--       quote_events row. The audit_events row is written by the COMMAND envelope
--       (as in the create/mark-sent commands), not the RPC.
--
-- ----------------------------------------------------------------------------
-- THE NEW VERSION SHARES THE PARENT QUOTE'S `quote_number`; ONLY `version_number`
-- INCREMENTS (architecture §7/§11; test-design R-604). `quote_number` is a
-- PER-QUOTE identifier allocated ONCE at 6.1 (via tenant_counters); every version
-- of the same quote shares it. The new version increments `version_number` (unique
-- per quote via quote_versions_quote_version_unique (quote_id, version_number)); it
-- does NOT allocate a new quote_number and does NOT touch tenant_counters. The
-- parent-quote FOR UPDATE row lock serializes concurrent new-version creations so
-- each gets a distinct version_number (the same guarantee 6.1's counter lock gives
-- quote numbers); the (quote_id, version_number) unique is the belt-and-braces
-- backstop (23505 → VALIDATION_FAILED).
--
-- ----------------------------------------------------------------------------
-- THE `superseded` FORWARD TRANSITION IS ALREADY SANCTIONED BY THE 6.4 SENT-LOCK
-- TRIGGER — 6.5 USES IT (does NOT re-open the trigger). The 6.4 trigger's legal-
-- transition guard allows a status change out of a non-draft state ONLY within
-- (sent, accepted, rejected, expired, superseded) and RAISES QV409 on a reversal
-- back to draft. Marking a prior sent version `superseded` when v2 is created — and
-- a standalone sent→rejected/expired — are SANCTIONED transitions that change ONLY
-- the exempt `status` column (the trigger's row-equality check passes). 6.5 does
-- NOT modify the sent-lock trigger; it RELIES on it. The event_types 'created' /
-- 'superseded' / 'rejected' / 'expired' are ALREADY in the quote_events closed
-- CHECK set (6.1) — NO CHECK widening is needed.
--
-- ----------------------------------------------------------------------------
-- INTENTIONAL LOVABLE-ORACLE DELTA (Story 6.5 6.5-DOCS-01, extends 6.4-DOCS-01):
-- Lovable allowed MUTABLE quote versions (editing a sent version in place). Phase A
-- creates a NEW immutable version for a customer-visible change (prior sent versions
-- preserved BYTE-UNCHANGED for audit/comparison; a change spawns a version, it does
-- NOT overwrite one). 6.4 recorded the immutability; 6.5 records the new-version-
-- instead-of-mutate flow that immutability implies. The Lovable app is a behavioral
-- oracle ONLY — the mutable-versions behavior is NEVER copied.
--
-- ----------------------------------------------------------------------------
-- SCOPE DISCIPLINE (architecture §7; Story 6.5 Stop Conditions):
-- Two RPCs on the EXISTING quote_* tables are the ONLY objects. NO new TABLE (H4
-- untouched — the tenant-owned set is unchanged, the 6.1 RLS/GRANT posture is
-- inherited verbatim). NO Fortnox/invoice/customer-portal/external-mapping/supplier/
-- sync/credential/api column or table. NO acceptance/job table (Epic 7 — 6.5 does
-- NOT supersede or transition an `accepted` version, only a sent one). NO email-send/
-- portal/public-acceptance mechanism. NO inline money math / NO recompute of totals/
-- VAT (the new version's totals are CAPTURED from engine-produced calc state exactly
-- as 6.1, never re-derived in SQL). NO service-role app path (both RPCs are SECURITY
-- INVOKER, run under the caller's RLS).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- (1) The narrow atomic new-version RPC (ADR-A009, AC1/AC2). In ONE transaction it:
--   (a) row-locks the PARENT quotes row (own-tenant RLS narrows it; a foreign id →
--       0 rows → RAISE and abort);
--   (b) computes v_version_number = coalesce(max(version_number),0)+1 over the
--       quote's versions UNDER the parent-quote row lock (concurrent creations
--       serialize on the lock → DISTINCT version numbers, R-604);
--   (c) inserts the new quote_versions row (status='draft', the computed
--       version_number, the PARENT quote's existing quote_number) from the pre-
--       frozen p_snapshot/p_lines/p_attachments payloads (identical INSERT column
--       lists + jsonb key reads to the 6.1 create RPC, INCLUDING the find-or-create
--       file_links guard for owner_type='quote_version');
--   (d) inserts a quote_events 'created' event for the new version;
--   (e) IF p_supersede_prior is true AND the IMMEDIATELY-PRIOR version is 'sent',
--       flips its status to 'superseded' + appends a quote_events 'superseded'
--       event for it (the sanctioned forward transition the 6.4 sent-lock trigger
--       allows). An `accepted` prior version is NEVER superseded (Epic 7 scope).
-- A failure at ANY step rolls back the WHOLE txn (no orphaned version, no partial
-- write). SECURITY INVOKER (ADR-A009 default — under the caller's RLS, own-tenant
-- only, no service-role app path) with a fixed empty search_path + schema-qualified
-- refs. The audit_events row is written by the COMMAND envelope, not the RPC. The
-- RESOLVED tenant id is passed explicitly (the own-tenant WITH CHECK narrows every
-- write to the caller anyway; a cross-tenant p_tenant_id fails 42501 and aborts).
-- ----------------------------------------------------------------------------
create or replace function public.create_new_quote_version(
  p_tenant_id uuid,
  p_quote_id uuid,
  p_calculation_id uuid,
  p_captured_at timestamptz,
  p_customer_id uuid,
  p_facility_id uuid,
  p_contact_id uuid,
  p_snapshot jsonb,
  p_lines jsonb,
  p_attachments jsonb,
  p_supersede_prior boolean
)
returns table (quote_version_id uuid, version_number bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version_id uuid;
  v_version_number bigint;
  v_quote_number bigint;
  v_prior_version_id uuid;
  v_prior_status text;
  v_line jsonb;
  v_att jsonb;
  v_att_file_id uuid;
  v_link_exists boolean;
begin
  -- (a) Row-lock the PARENT quote (own-tenant RLS narrows it; a foreign quote id →
  -- 0 rows → not found → RAISE and abort). The FOR UPDATE lock is the PRIMARY
  -- concurrency guard: two concurrent new-version creations on the SAME quote
  -- serialize on this row so each computes a DISTINCT version_number.
  perform 1
    from public.quotes q
   where q.id = p_quote_id
     and q.tenant_id = p_tenant_id
   for update;
  if not found then
    raise exception 'create_new_quote_version: parent quote not found for tenant'
      using errcode = 'QV409';
  end if;

  -- (b) Compute the next version number + read the SHARED per-quote quote_number
  -- UNDER the parent-quote row lock (the quote_number is a per-QUOTE identifier
  -- allocated once at 6.1 — every version of the same quote SHARES it; NO new
  -- tenant_counters increment). A quote with no versions yet → max is null → 1.
  select coalesce(max(qv.version_number), 0) + 1,
         max(qv.quote_number)
    into v_version_number, v_quote_number
    from public.quote_versions qv
   where qv.quote_id = p_quote_id
     and qv.tenant_id = p_tenant_id;

  -- A quote MUST already carry a numbered version (it was created via the 6.1 RPC).
  -- If none exists the shared quote_number is unknown → fail closed rather than
  -- allocate a number here (Story 6.5 does not touch tenant_counters).
  if v_quote_number is null then
    raise exception 'create_new_quote_version: parent quote has no existing version to derive quote_number from'
      using errcode = 'QV409';
  end if;

  -- (c) Insert the new quote_versions row from the pre-frozen snapshot payload —
  -- the IDENTICAL column list + jsonb key reads as the 6.1 create RPC (captures,
  -- computes nothing). status='draft'; the computed version_number; the SHARED
  -- quote_number. The composite same-tenant FK to calculations(id,tenant_id)
  -- rejects a foreign calc id (23503); the own-tenant WITH CHECK narrows tenant_id
  -- to the caller (42501); the (quote_id, version_number) unique is the belt-and-
  -- braces backstop against a raced version number (23505 → VALIDATION_FAILED).
  insert into public.quote_versions (
    tenant_id, quote_id, version_number, quote_number, status,
    calculation_id, captured_at,
    company_name, company_org_nr, company_address_line1, company_address_line2,
    company_postal_code, company_city, company_email, company_phone, company_logo_url,
    customer_display_name, customer_type, facility_name, contact_name,
    quote_number_display, valid_until,
    intro_text, customer_notes, terms_text, terms_approved_at, terms_approved_by,
    base_total_ore, option_total_ore, vat_total_ore, deduction_total_ore, accepted_price_ore,
    vat_rate_bp, vat_display, deduction_type, deduction_rate_bp, deduction_cap_ore,
    deduction_persons, requires_sign_off, display_mode, warnings_snapshot
  )
  values (
    p_tenant_id,
    p_quote_id,
    v_version_number,
    v_quote_number,
    'draft',
    p_calculation_id,
    p_captured_at,
    p_snapshot ->> 'companyName',
    p_snapshot ->> 'companyOrgNr',
    p_snapshot ->> 'companyAddressLine1',
    p_snapshot ->> 'companyAddressLine2',
    p_snapshot ->> 'companyPostalCode',
    p_snapshot ->> 'companyCity',
    p_snapshot ->> 'companyEmail',
    p_snapshot ->> 'companyPhone',
    p_snapshot ->> 'companyLogoUrl',
    p_snapshot ->> 'customerDisplayName',
    p_snapshot ->> 'customerType',
    p_snapshot ->> 'facilityName',
    p_snapshot ->> 'contactName',
    p_snapshot ->> 'quoteNumberDisplay',
    (p_snapshot ->> 'validUntil')::timestamptz,
    p_snapshot ->> 'introText',
    p_snapshot ->> 'customerNotes',
    p_snapshot ->> 'termsText',
    (p_snapshot ->> 'termsApprovedAt')::timestamptz,
    (p_snapshot ->> 'termsApprovedBy')::uuid,
    coalesce((p_snapshot ->> 'baseTotalOre')::bigint, 0),
    coalesce((p_snapshot ->> 'optionTotalOre')::bigint, 0),
    coalesce((p_snapshot ->> 'vatTotalOre')::bigint, 0),
    coalesce((p_snapshot ->> 'deductionTotalOre')::bigint, 0),
    coalesce((p_snapshot ->> 'acceptedPriceOre')::bigint, 0),
    (p_snapshot ->> 'vatRateBp')::integer,
    p_snapshot ->> 'vatDisplay',
    p_snapshot ->> 'deductionType',
    (p_snapshot ->> 'deductionRateBp')::integer,
    (p_snapshot ->> 'deductionCapOre')::bigint,
    (p_snapshot ->> 'deductionPersons')::integer,
    coalesce((p_snapshot ->> 'requiresSignOff')::boolean, true),
    p_snapshot ->> 'displayMode',
    coalesce(p_snapshot -> 'warnings', '[]'::jsonb)
  )
  returning id into v_version_id;

  -- (c cont.) Insert the customer-visible line snapshots — the IDENTICAL loop as the
  -- 6.1 RPC (NO cost/margin/internal-note fields read — R-607). A malformed element
  -- aborts the whole txn.
  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    insert into public.quote_version_lines (
      tenant_id, quote_version_id, row_type, sort_order,
      label, description, quote_note, quantity, unit, unit_sell_ore, line_net_ore,
      vat_rate_bp, is_hidden, is_optional, is_selected
    )
    values (
      p_tenant_id,
      v_version_id,
      coalesce(v_line ->> 'rowType', 'line'),
      coalesce((v_line ->> 'sortOrder')::integer, 0),
      v_line ->> 'label',
      v_line ->> 'description',
      v_line ->> 'quoteNote',
      (v_line ->> 'quantity')::numeric,
      v_line ->> 'unit',
      (v_line ->> 'unitSellOre')::bigint,
      (v_line ->> 'lineNetOre')::bigint,
      (v_line ->> 'vatRateBp')::integer,
      coalesce((v_line ->> 'isHidden')::boolean, false),
      coalesce((v_line ->> 'isOptional')::boolean, false),
      (v_line ->> 'isSelected')::boolean
    );
  end loop;

  -- (c cont.) Insert the selected-attachment metadata snapshots AND materialize the
  -- 8.1 file_links (owner_type='quote_version') per attachment — the IDENTICAL find-
  -- or-create guard as the 6.1 RPC (R-814). The composite same-tenant FK rejects a
  -- foreign file id (23503).
  for v_att in select * from jsonb_array_elements(coalesce(p_attachments, '[]'::jsonb))
  loop
    v_att_file_id := (v_att ->> 'fileId')::uuid;
    insert into public.quote_version_attachments (
      tenant_id, quote_version_id, file_id, display_name, sort_order
    )
    values (
      p_tenant_id,
      v_version_id,
      v_att_file_id,
      v_att ->> 'displayName',
      coalesce((v_att ->> 'sortOrder')::integer, 0)
    );

    select exists(
      select 1 from public.file_links fl
       where fl.tenant_id = p_tenant_id
         and fl.file_id = v_att_file_id
         and fl.owner_type = 'quote_version'
         and fl.owner_id = v_version_id
         and fl.purpose = 'quote_attachment_snapshot'
    ) into v_link_exists;
    if not v_link_exists then
      insert into public.file_links (
        tenant_id, file_id, owner_type, owner_id, purpose
      )
      values (
        p_tenant_id, v_att_file_id, 'quote_version', v_version_id,
        'quote_attachment_snapshot'
      );
    end if;
  end loop;

  -- (d) Insert the lifecycle 'created' event for the NEW version.
  insert into public.quote_events (
    tenant_id, quote_id, quote_version_id, event_type, occurred_at
  )
  values (
    p_tenant_id, p_quote_id, v_version_id, 'created', p_captured_at
  );

  -- (e) OPTIONAL supersede-on-new-version: mark the IMMEDIATELY-PRIOR version
  -- 'superseded' when it is 'sent' (never an accepted/rejected/expired/draft prior
  -- version — only a live SENT commitment is replaced). This keeps "the latest
  -- draft/sent/accepted state clear" (AC2) — a quote never shows two live sent
  -- commitments. The flip touches ONLY the exempt `status` column, so the 6.4 sent-
  -- lock trigger's row-equality check passes; a `superseded` event is appended.
  if p_supersede_prior then
    -- The prior version is the highest version_number STRICTLY BELOW the new one on
    -- the SAME quote (the immediately-prior version, under the same row lock).
    select qv.id, qv.status
      into v_prior_version_id, v_prior_status
      from public.quote_versions qv
     where qv.quote_id = p_quote_id
       and qv.tenant_id = p_tenant_id
       and qv.version_number < v_version_number
     order by qv.version_number desc
     limit 1;

    if v_prior_version_id is not null and v_prior_status = 'sent' then
      update public.quote_versions
         set status = 'superseded'
       where id = v_prior_version_id
         and tenant_id = p_tenant_id;

      insert into public.quote_events (
        tenant_id, quote_id, quote_version_id, event_type, occurred_at
      )
      values (
        p_tenant_id, p_quote_id, v_prior_version_id, 'superseded', p_captured_at
      );
    end if;
  end if;

  return query select v_version_id, v_version_number;
end;
$$;

comment on function public.create_new_quote_version(
  uuid, uuid, uuid, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb, boolean
) is
  'Narrow atomic NEW-VERSION RPC for an EXISTING quote (architecture ADR-A009, Story 6.5) — the SIBLING of create_quote_version_from_calculation. In ONE txn it (a) row-locks the parent quotes row FOR UPDATE (own-tenant RLS narrows it; a foreign id → 0 rows → aborts); (b) computes version_number = max+1 UNDER the lock + reads the SHARED per-quote quote_number (NO tenant_counters increment — the quote number is allocated ONCE at 6.1); (c) inserts the new quote_versions row status=''draft'' from the pre-frozen p_snapshot payload (identical column list + jsonb reads to the 6.1 RPC; captures, computes nothing; NO cost/margin/internal-note — R-607) + the customer-visible lines + the attachments (find-or-creates a file_links owner_type=''quote_version'' row per attachment — R-814); (d) inserts a quote_events ''created'' event for the new version; (e) IF p_supersede_prior the IMMEDIATELY-PRIOR version is flipped ''superseded'' (only when it is ''sent'' — never an accepted version, Epic 7) + a ''superseded'' event appended (the sanctioned forward transition the 6.4 sent-lock trigger allows — it touches ONLY the exempt status column). A failure at ANY step rolls back (no orphaned version — R-604; concurrent creations serialize on the parent-quote lock → DISTINCT version numbers; the (quote_id, version_number) unique is the belt-and-braces backstop). SECURITY INVOKER (under the caller''s RLS — own-tenant only, no service-role app path) with a fixed empty search_path + schema-qualified refs. The audit_events row is written by the COMMAND envelope, not the RPC.';

-- Function privileges: revoke the implicit PUBLIC EXECUTE, then grant ONLY to the
-- app-runtime + test roles (mirror the 6.1 create RPC). anon must NOT execute.
revoke execute on function public.create_new_quote_version(
  uuid, uuid, uuid, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb, boolean
) from public;
grant execute on function public.create_new_quote_version(
  uuid, uuid, uuid, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb, boolean
) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- (2) The narrow atomic lifecycle-transition RPC (ADR-A009, AC3). In ONE txn it:
--   (a) row-locks + loads the target quote_versions row (own-tenant RLS narrows it;
--       a foreign id is invisible → 0 rows → aborts, the command already denied it);
--   (b) VALIDATES the transition is LEGAL from the CURRENT status — the CLOSED
--       transition map mirroring the 6.4 sent-lock trigger's legal-transition guard:
--       ONLY a `sent` version can be transitioned to rejected/expired/superseded (a
--       draft is edited/deleted, not lifecycle-transitioned; accepted is terminal
--       for Epic 6; rejected/expired/superseded are terminal). An illegal transition
--       RAISES QV409 → QUOTE_VERSION_LOCKED;
--   (c) UPDATEs ONLY `status` (the exempt column the sent-lock trigger allows — the
--       row-equality check passes because no customer-visible column changes);
--   (d) appends the matching quote_events row (occurred_at = the injected instant).
-- A failure at ANY step rolls back. SECURITY INVOKER + fixed empty search_path +
-- schema-qualified refs. The audit_events row is written by the COMMAND envelope.
-- The RESOLVED tenant id is passed explicitly (the own-tenant WITH CHECK narrows the
-- write; a cross-tenant p_tenant_id fails 42501 and aborts). The command-layer guard
-- (a closed transition map, VALIDATION_FAILED) is the PRIMARY rejection of an illegal
-- transition; this RPC guard is the below-command belt-and-braces so command + DB
-- agree (R-608).
-- ----------------------------------------------------------------------------
create or replace function public.mark_quote_version_lifecycle(
  p_tenant_id uuid,
  p_quote_version_id uuid,
  p_transition text,
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
    raise exception 'mark_quote_version_lifecycle: target version not found for tenant'
      using errcode = 'QV409';
  end if;

  -- (b) The transition must be one of the closed lifecycle transitions this RPC owns
  -- (rejected/expired/superseded — accepted is Epic 7), and LEGAL from the current
  -- status. ONLY a `sent` version can be lifecycle-transitioned here: a draft is
  -- edited/deleted; a terminal state (accepted/rejected/expired/superseded) cannot
  -- transition further within Epic 6. Anything else RAISES QV409 →
  -- QUOTE_VERSION_LOCKED (mirroring the sent-lock trigger's legal-transition guard).
  if p_transition not in ('rejected', 'expired', 'superseded') then
    raise exception 'mark_quote_version_lifecycle: unsupported transition %', p_transition
      using errcode = 'QV409';
  end if;
  if v_status <> 'sent' then
    raise exception 'mark_quote_version_lifecycle: illegal transition from % to % (only a sent version can be rejected/expired/superseded)', v_status, p_transition
      using errcode = 'QV409';
  end if;

  -- (c) The lifecycle transition — flip ONLY `status` (the sent-lock trigger's exempt
  -- column; the row-equality check passes because no customer-visible column changes).
  update public.quote_versions
     set status = p_transition
   where id = p_quote_version_id
     and tenant_id = p_tenant_id;

  -- (d) Append the matching lifecycle event (occurred_at = the injected instant). The
  -- event_type is already in the quote_events closed CHECK set (6.1) — no widening.
  insert into public.quote_events (
    tenant_id, quote_id, quote_version_id, event_type, occurred_at
  )
  values (
    p_tenant_id, v_quote_id, p_quote_version_id, p_transition, p_occurred_at
  );

  return query select p_quote_version_id;
end;
$$;

comment on function public.mark_quote_version_lifecycle(uuid, uuid, text, timestamptz) is
  'Narrow atomic lifecycle-transition RPC (architecture ADR-A009, Story 6.5, AC3). In ONE txn: (a) row-locks + loads the target quote_versions row (own-tenant RLS narrows it; a foreign id → 0 rows → aborts); (b) VALIDATES the transition is LEGAL from the current status — the closed map mirroring the 6.4 sent-lock legal-transition guard: ONLY a ''sent'' version may be transitioned to rejected/expired/superseded (a draft is edited/deleted; accepted is Epic 7; terminal states do not transition further). An illegal transition RAISES QV409 → QUOTE_VERSION_LOCKED; (c) flips ONLY ''status'' (the exempt column the sent-lock trigger allows — the row-equality check passes, no customer-visible column changes); (d) appends the matching quote_events row (occurred_at = the injected instant). A failure at ANY step rolls back. SECURITY INVOKER (under the caller''s RLS — own-tenant only, no service-role app path) with a fixed empty search_path + schema-qualified refs. The audit_events row is written by the COMMAND envelope. The command-layer transition map (VALIDATION_FAILED) is the primary rejection; this RPC guard is the below-command belt-and-braces (R-608).';

revoke execute on function public.mark_quote_version_lifecycle(
  uuid, uuid, text, timestamptz
) from public;
grant execute on function public.mark_quote_version_lifecycle(
  uuid, uuid, text, timestamptz
) to authenticated, service_role;
