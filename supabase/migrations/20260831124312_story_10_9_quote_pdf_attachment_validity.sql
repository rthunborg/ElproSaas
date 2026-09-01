-- Story 10.9 — quote PDF freshness and draft attachment validity.
--
-- A rendered PDF is a customer-visible derivative of a DRAFT snapshot.  It is only
-- current when the fingerprint captured at render completion equals the current
-- customer-visible snapshot fingerprint.  The functions below deliberately reuse
-- the existing files/file_links archive lifecycle: stale bytes are retained, while
-- their metadata becomes ineligible for normal signed access.

alter table public.quote_versions
  add column if not exists pdf_content_fingerprint text,
  add column if not exists pdf_render_fingerprint text,
  add column if not exists pdf_render_file_id uuid,
  add column if not exists pdf_render_correlation_id uuid,
  add column if not exists pdf_render_started_at timestamptz,
  add column if not exists pdf_render_lease_expires_at timestamptz,
  add column if not exists pdf_render_attestation_key_id text,
  add column if not exists pdf_render_attestation_issued_at timestamptz,
  add column if not exists pdf_render_attestation_expires_at timestamptz,
  add column if not exists pdf_generated_correlation_id uuid;

-- A durable artifact discriminator closes the gap between a database-issued render
-- id and the later metadata reservation. Generic Phase-B files remain NULL; only
-- the narrow reservation RPC below may create a typed quote-PDF row.
alter table public.files
  add column if not exists artifact_kind text;
alter table public.files
  drop constraint if exists files_artifact_kind_check;
alter table public.files
  add constraint files_artifact_kind_check
    check (artifact_kind is null or artifact_kind = 'quote_pdf');

comment on column public.files.artifact_kind is
  'Nullable durable artifact discriminator. NULL remains the generic file model; quote_pdf is reserved only by Story 10.9 reserve_quote_pdf_file and is immutable thereafter.';

-- The Story 10.6 parent lock compares the complete row and deliberately allow-lists
-- derived PDF bookkeeping. Extend that existing fail-closed definition for all
-- three new derived columns; otherwise a render start/completion or a stale-PDF
-- invalidation would be rejected by the older trigger before it could persist.
create or replace function public.enforce_quote_version_sent_lock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_stored_lines jsonb;
  v_tax_input jsonb;
  v_calculation_found boolean;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft'
       or new.snapshot_schema_version is distinct from 2
       or new.tax_rule_version is null
       or not public.is_story_10_6_tax_answer_v2(new.tax_answer_snapshot)
       or new.tax_rule_version
          is distinct from public.story_10_6_tax_rule_version(new.tax_answer_snapshot)
       or new.accepted_price_ore is distinct from new.payable_ore then
      raise exception
        'new quote versions must start as complete Story 10.6 V2 drafts'
        using errcode = 'QV409';
    end if;
    select c.tax_input_snapshot
      into v_tax_input
      from public.calculations c
     where c.id = new.calculation_id
       and c.tenant_id = new.tenant_id
     for share;
    v_calculation_found := found;
    if not v_calculation_found
       or not public.is_story_10_6_tax_answer_matches_input(
         new.tax_answer_snapshot,
         v_tax_input,
         (new.captured_at at time zone 'Europe/Stockholm')::date
       ) then
      raise exception
        'new quote version tax answer must match its calculation tax input'
        using errcode = 'QV409';
    end if;
    return new;
  end if;

  if old.status = 'draft' then
    if new.status is not distinct from old.status then
      if (
        to_jsonb(new) - array[
          'intro_text', 'customer_notes', 'valid_until', 'display_mode',
          'pdf_status', 'pdf_file_id', 'pdf_generated_at',
          'pdf_content_fingerprint', 'pdf_render_fingerprint', 'pdf_render_file_id',
          'pdf_render_correlation_id', 'pdf_render_started_at', 'pdf_render_lease_expires_at',
          'pdf_render_attestation_key_id', 'pdf_render_attestation_issued_at', 'pdf_render_attestation_expires_at',
          'pdf_generated_correlation_id',
          'updated_at'
        ]
      ) is distinct from (
        to_jsonb(old) - array[
          'intro_text', 'customer_notes', 'valid_until', 'display_mode',
          'pdf_status', 'pdf_file_id', 'pdf_generated_at',
          'pdf_content_fingerprint', 'pdf_render_fingerprint', 'pdf_render_file_id',
          'pdf_render_correlation_id', 'pdf_render_started_at', 'pdf_render_lease_expires_at',
          'pdf_render_attestation_key_id', 'pdf_render_attestation_issued_at', 'pdf_render_attestation_expires_at',
          'pdf_generated_correlation_id',
          'updated_at'
        ]
      ) then
        raise exception
          'quote_versions draft updates are limited to presentation and derived PDF state'
          using errcode = 'QV409';
      end if;
      return new;
    end if;
    if new.status <> 'sent' then
      raise exception
        'quote_versions draft may only advance to sent: illegal transition % -> % (architecture §9, §11)',
        old.status, new.status
        using errcode = 'QV409';
    end if;

    if (to_jsonb(new) - array['status', 'updated_at']) is distinct from
       (to_jsonb(old) - array['status', 'updated_at']) then
      raise exception
        'quote_versions draft-to-sent must not co-mutate frozen snapshot fields'
        using errcode = 'QV409';
    end if;

    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'sourceRowId', qvl.source_calculation_row_id,
                 'rowType', qvl.row_type,
                 'lineNetOre', qvl.line_net_ore,
                 'vatRateBp', qvl.vat_rate_bp,
                 'includedInInvoiceTotal', qvl.included_in_invoice_total,
                 'deductionClassification', qvl.deduction_classification,
                 'vatType', qvl.vat_type
               )
               order by qvl.sort_order, qvl.id
             ),
             '[]'::jsonb
           )
      into v_stored_lines
      from public.quote_version_lines qvl
     where qvl.quote_version_id = new.id;

    if new.snapshot_schema_version is distinct from 2
       or new.tax_rule_version is null
       or not public.is_story_10_6_tax_answer_v2(new.tax_answer_snapshot)
       or not public.is_story_10_6_quote_lines_reconciled(
         new.tax_answer_snapshot, v_stored_lines
       )
       or new.calculated_deduction_ore is null
       or new.claim_deduction_ore is null
       or new.payable_ore is null
       or new.accepted_price_ore <> new.payable_ore
       or new.claim_deduction_ore % 100 <> 0
       or exists (
         select 1
           from public.quote_version_lines qvl
          where qvl.quote_version_id = new.id
            and (
              qvl.included_in_invoice_total is null
              or qvl.source_calculation_row_id is null
              or qvl.deduction_classification is null
              or qvl.vat_type is null
            )
       ) then
      raise exception
        'only a complete reconciled Story 10.6 V2 quote version may be sent'
        using errcode = 'QV409';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if old.status <> 'sent'
       or new.status not in ('accepted', 'rejected', 'expired', 'superseded', 'lost') then
      raise exception
        'quote_versions status is irreversible once sent: illegal transition % -> % on a non-draft version (architecture §9, §11)',
        old.status, new.status
        using errcode = 'QV409';
    end if;
  end if;

  if (
    to_jsonb(new) - array[
      'pdf_status', 'pdf_file_id', 'pdf_generated_at',
      'pdf_content_fingerprint', 'pdf_render_fingerprint', 'pdf_render_file_id',
      'pdf_render_correlation_id', 'pdf_render_started_at', 'pdf_render_lease_expires_at',
      'pdf_render_attestation_key_id', 'pdf_render_attestation_issued_at', 'pdf_render_attestation_expires_at',
      'pdf_generated_correlation_id',
      'status', 'archived_at', 'updated_at'
    ]
  ) is distinct from (
    to_jsonb(old) - array[
      'pdf_status', 'pdf_file_id', 'pdf_generated_at',
      'pdf_content_fingerprint', 'pdf_render_fingerprint', 'pdf_render_file_id',
      'pdf_render_correlation_id', 'pdf_render_started_at', 'pdf_render_lease_expires_at',
      'pdf_render_attestation_key_id', 'pdf_render_attestation_issued_at', 'pdf_render_attestation_expires_at',
      'pdf_generated_correlation_id',
      'status', 'archived_at', 'updated_at'
    ]
  ) then
    raise exception
      'quote_versions is immutable once sent: customer-visible / commitment columns cannot be changed on a non-draft version (architecture §9, §11)'
      using errcode = 'QV409';
  end if;

  return new;
end;
$$;

comment on function public.enforce_quote_version_sent_lock() is
  'Story 10.6 fail-closed quote-version lock, reconciled by Story 10.9 so its derived-PDF allow-list includes content/render fingerprints and the DB-issued in-flight render identity.';

-- A deterministic, database-owned fingerprint.  Keep the projection explicit: it
-- is both an allow-list of customer-visible fields and a fail-loud reminder to add
-- future customer-visible snapshot fields here.
create or replace function public.quote_version_content_fingerprint(
  p_quote_version_id uuid
)
returns text
language sql
security invoker
stable
set search_path = ''
set timezone = 'UTC'
as $$
  select encode(sha256(convert_to(
    jsonb_build_object(
      -- Bump in the same migration as any customer-visible renderer/template
      -- change so already-generated artifacts become stale deterministically.
      'rendererVersion', 'quote-pdf-v2-2026-08-31',
      'version', jsonb_build_object(
        'company_name', qv.company_name,
        'company_org_nr', qv.company_org_nr,
        'company_address_line1', qv.company_address_line1,
        'company_address_line2', qv.company_address_line2,
        'company_postal_code', qv.company_postal_code,
        'company_city', qv.company_city,
        'company_email', qv.company_email,
        'company_phone', qv.company_phone,
        'company_logo_url', qv.company_logo_url,
        'customer_display_name', qv.customer_display_name,
        'customer_type', qv.customer_type,
        'facility_name', qv.facility_name,
        'contact_name', qv.contact_name,
        'quote_number_display', qv.quote_number_display,
        'valid_until', qv.valid_until,
        'intro_text', qv.intro_text,
        'customer_notes', qv.customer_notes,
        'terms_text', qv.terms_text,
        'terms_approved_at', qv.terms_approved_at,
        'terms_approved_by', qv.terms_approved_by,
        'base_total_ore', qv.base_total_ore,
        'option_total_ore', qv.option_total_ore,
        'vat_total_ore', qv.vat_total_ore,
        'deduction_total_ore', qv.deduction_total_ore,
        'accepted_price_ore', qv.accepted_price_ore,
        'calculation_id', qv.calculation_id,
        'captured_at', qv.captured_at,
        'quote_number', qv.quote_number,
        'snapshot_schema_version', qv.snapshot_schema_version,
        'tax_rule_version', qv.tax_rule_version,
        'tax_answer_snapshot', qv.tax_answer_snapshot,
        'buyer_vat_number', qv.buyer_vat_number,
        'calculated_deduction_ore', qv.calculated_deduction_ore,
        'claim_deduction_ore', qv.claim_deduction_ore,
        'payable_ore', qv.payable_ore,
        'vat_rate_bp', qv.vat_rate_bp,
        'vat_display', qv.vat_display,
        'deduction_type', qv.deduction_type,
        'deduction_rate_bp', qv.deduction_rate_bp,
        'deduction_cap_ore', qv.deduction_cap_ore,
        'deduction_persons', qv.deduction_persons,
        'requires_sign_off', qv.requires_sign_off,
        'display_mode', qv.display_mode,
        'warnings_snapshot', qv.warnings_snapshot
      ),
      'lines', coalesce((
        select jsonb_agg(to_jsonb(qvl) - 'id' - 'tenant_id' - 'quote_version_id' - 'created_at' - 'updated_at'
                         order by qvl.sort_order, qvl.id)
          from public.quote_version_lines qvl
         where qvl.quote_version_id = qv.id
      ), '[]'::jsonb),
      'attachments', coalesce((
        select jsonb_agg(jsonb_build_object(
          'file_id', qva.file_id,
          'display_name', qva.display_name,
          'sort_order', qva.sort_order
        ) order by qva.sort_order, qva.id)
          from public.quote_version_attachments qva
         where qva.quote_version_id = qv.id
      ), '[]'::jsonb)
    )::text,
    'UTF8'
  )), 'hex')
    from public.quote_versions qv
   where qv.id = p_quote_version_id;
$$;

-- Archive the currently active PDF metadata without deleting its storage object.
create or replace function public.invalidate_quote_version_pdf()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    return new;
  end if;

  -- Derived render bookkeeping alone is not an edit. A mixed customer-visible +
  -- bookkeeping update still invalidates: never let a crafted combined UPDATE bypass
  -- freshness by adding a pdf_* assignment.
  if (to_jsonb(new) - array[
        'id', 'tenant_id', 'quote_id', 'status', 'created_at', 'updated_at', 'archived_at',
        'pdf_status', 'pdf_file_id', 'pdf_generated_at',
        'pdf_content_fingerprint', 'pdf_render_fingerprint', 'pdf_render_file_id',
        'pdf_render_correlation_id', 'pdf_render_started_at', 'pdf_render_lease_expires_at',
        'pdf_render_attestation_key_id', 'pdf_render_attestation_issued_at', 'pdf_render_attestation_expires_at',
        'pdf_generated_correlation_id'
      ]) is distinct from
     (to_jsonb(old) - array[
        'id', 'tenant_id', 'quote_id', 'status', 'created_at', 'updated_at', 'archived_at',
        'pdf_status', 'pdf_file_id', 'pdf_generated_at',
        'pdf_content_fingerprint', 'pdf_render_fingerprint', 'pdf_render_file_id',
        'pdf_render_correlation_id', 'pdf_render_started_at', 'pdf_render_lease_expires_at',
        'pdf_render_attestation_key_id', 'pdf_render_attestation_issued_at', 'pdf_render_attestation_expires_at',
        'pdf_generated_correlation_id'
      ]) then
    -- Legacy previews can have active quote_pdf links even when both durable
    -- version references are NULL. Archive every such same-tenant link and its
    -- file as well as either current/in-flight reference, retaining Storage bytes.
    with archived_links as (
      update public.file_links
         set archived_at = coalesce(archived_at, now())
       where tenant_id = old.tenant_id
         and owner_type = 'quote_version'
         and owner_id = old.id
         and purpose = 'quote_pdf'
         and archived_at is null
       returning file_id
    ), affected_files as (
      select file_id from archived_links
      union
      select unnest(array[old.pdf_file_id, old.pdf_render_file_id])
    )
    update public.files
       set lifecycle_state = 'archived',
           archived_at = coalesce(archived_at, now())
     where tenant_id = old.tenant_id
       and id in (select file_id from affected_files where file_id is not null)
       and lifecycle_state <> 'archived';
    new.pdf_status := 'not_generated';
    new.pdf_file_id := null;
    new.pdf_generated_at := null;
    new.pdf_content_fingerprint := null;
    new.pdf_render_fingerprint := null;
    new.pdf_render_file_id := null;
    new.pdf_render_correlation_id := null;
    new.pdf_render_started_at := null;
    new.pdf_render_lease_expires_at := null;
    new.pdf_render_attestation_key_id := null;
    new.pdf_render_attestation_issued_at := null;
    new.pdf_render_attestation_expires_at := null;
    new.pdf_generated_correlation_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists quote_versions_invalidate_stale_pdf on public.quote_versions;
create trigger quote_versions_invalidate_stale_pdf
  before update on public.quote_versions
  for each row execute function public.invalidate_quote_version_pdf();

-- Child edits (including attachment selection) are customer-visible changes too.
-- Updating the parent makes the preceding trigger archive/unlink the old active PDF.
create or replace function public.invalidate_quote_version_pdf_for_child()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_file_id uuid;
  v_changed boolean;
begin
  v_id := case when tg_op = 'DELETE' then old.quote_version_id else new.quote_version_id end;
  v_changed := tg_op = 'INSERT'
    or tg_op = 'DELETE'
    or (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at');
  if v_changed then
    select pdf_file_id into v_file_id
      from public.quote_versions
     where id = v_id and status = 'draft'
     for update;
    if found then
      with archived_links as (
        update public.file_links
           set archived_at = coalesce(archived_at, now())
         where tenant_id = (select tenant_id from public.quote_versions where id = v_id)
           and owner_type = 'quote_version'
           and owner_id = v_id
           and purpose = 'quote_pdf'
           and archived_at is null
         returning file_id
      ), affected_files as (
        select file_id from archived_links
        union
        select v_file_id
      )
      update public.files
         set lifecycle_state = 'archived', archived_at = coalesce(archived_at, now())
       where id in (select file_id from affected_files where file_id is not null)
         and lifecycle_state <> 'archived';
      update public.quote_versions
        set pdf_status = 'not_generated',
             pdf_file_id = null,
             pdf_generated_at = null,
             pdf_content_fingerprint = null,
             pdf_render_fingerprint = null
       where id = v_id;
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke execute on function public.quote_version_content_fingerprint(uuid)
  from public, anon, authenticated, service_role;

drop trigger if exists quote_version_lines_invalidate_stale_pdf on public.quote_version_lines;
create trigger quote_version_lines_invalidate_stale_pdf
  after insert or update or delete on public.quote_version_lines
  for each row execute function public.invalidate_quote_version_pdf_for_child();

drop trigger if exists quote_version_attachments_invalidate_stale_pdf on public.quote_version_attachments;
create trigger quote_version_attachments_invalidate_stale_pdf
  after insert or update or delete on public.quote_version_attachments
  for each row execute function public.invalidate_quote_version_pdf_for_child();

-- Starting a render binds it to the exact content state.  Completion is only legal
-- while that bound fingerprint still equals the current state.
create or replace function public.bind_quote_pdf_render_fingerprint()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.pdf_status = 'generating' and old.pdf_status is distinct from 'generating' then
    new.pdf_render_fingerprint := public.quote_version_content_fingerprint(new.id);
  elsif new.pdf_status in ('not_generated', 'failed') then
    new.pdf_render_fingerprint := null;
  elsif new.pdf_status = 'generated' then
    if old.pdf_render_fingerprint is null
       or old.pdf_render_fingerprint is distinct from public.quote_version_content_fingerprint(new.id) then
      raise exception 'quote PDF no longer matches the current draft content'
        using errcode = 'PFD10';
    end if;
    new.pdf_content_fingerprint := old.pdf_render_fingerprint;
    new.pdf_render_fingerprint := null;
  end if;
  return new;
end;
$$;

drop trigger if exists quote_versions_bind_pdf_render_fingerprint on public.quote_versions;
create trigger quote_versions_bind_pdf_render_fingerprint
  before update on public.quote_versions
  for each row execute function public.bind_quote_pdf_render_fingerprint();

revoke execute on function public.invalidate_quote_version_pdf() from public;
revoke execute on function public.invalidate_quote_version_pdf_for_child() from public;
revoke execute on function public.bind_quote_pdf_render_fingerprint() from public;

-- The atomic completion operation does not expose a direct table-write path to the
-- app.  It only makes a freshly uploaded file active after its render fingerprint is
-- still current; stale uploads are archived and never linked.
create or replace function public.complete_quote_pdf_render(
  p_tenant_id uuid,
  p_quote_version_id uuid,
  p_file_id uuid,
  p_generated_at timestamptz
)
returns table (quote_version_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote_id uuid;
  v_status text;
  v_fingerprint text;
  v_old_file_id uuid;
begin
  if auth.uid() is null or not public.is_tenant_admin(p_tenant_id) then
    raise exception 'quote PDF completion is not authorized' using errcode = 'PFD10';
  end if;
  select qv.quote_id, qv.status, qv.pdf_render_fingerprint, qv.pdf_file_id
    into v_quote_id, v_status, v_fingerprint, v_old_file_id
    from public.quote_versions qv
   where qv.id = p_quote_version_id and qv.tenant_id = p_tenant_id
   for update;
  if not found then
    raise exception 'quote PDF completion target not found' using errcode = 'PFD10';
  end if;

  if v_status <> 'draft'
     or v_fingerprint is null
     or v_fingerprint is distinct from public.quote_version_content_fingerprint(p_quote_version_id) then
    update public.files
       set lifecycle_state = 'archived', archived_at = coalesce(archived_at, p_generated_at)
     where id = p_file_id and tenant_id = p_tenant_id;
    raise exception 'quote PDF no longer matches the current draft content' using errcode = 'PFD10';
  end if;

  if v_old_file_id is not null and v_old_file_id <> p_file_id then
    update public.files
       set lifecycle_state = 'archived', archived_at = coalesce(archived_at, p_generated_at)
     where id = v_old_file_id and tenant_id = p_tenant_id;
  end if;

  update public.file_links
     set archived_at = coalesce(archived_at, p_generated_at)
   where tenant_id = p_tenant_id
     and owner_type = 'quote_version'
     and owner_id = p_quote_version_id
     and purpose = 'quote_pdf'
     and archived_at is null;

  update public.files set lifecycle_state = 'linked'
   where id = p_file_id and tenant_id = p_tenant_id and lifecycle_state = 'draft';

  insert into public.file_links (tenant_id, file_id, owner_type, owner_id, purpose)
  values (p_tenant_id, p_file_id, 'quote_version', p_quote_version_id, 'quote_pdf');

  update public.quote_versions
     set pdf_file_id = p_file_id,
         pdf_generated_at = p_generated_at,
         pdf_status = 'generated'
   where id = p_quote_version_id and tenant_id = p_tenant_id;

  insert into public.quote_events (tenant_id, quote_id, quote_version_id, event_type, occurred_at)
  values (p_tenant_id, v_quote_id, p_quote_version_id, 'pdf_generated', p_generated_at);

  return query select p_quote_version_id;
end;
$$;

revoke execute on function public.complete_quote_pdf_render(uuid, uuid, uuid, timestamptz) from public;
grant execute on function public.complete_quote_pdf_render(uuid, uuid, uuid, timestamptz)
  to authenticated, service_role;

-- Keep the render-state/event provenance inside narrow tenant-authorized RPCs.
drop function if exists public.start_quote_pdf_render(uuid, uuid);
create or replace function public.start_quote_pdf_render(
  p_tenant_id uuid,
  p_quote_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_tenant_admin(p_tenant_id) then
    raise exception 'quote PDF generation is not authorized' using errcode = 'PFD10';
  end if;
  update public.quote_versions
     set pdf_status = 'generating'
   where id = p_quote_version_id
     and tenant_id = p_tenant_id
     and status = 'draft';
  if not found then
    raise exception 'quote PDF generation target not found' using errcode = 'PFD10';
  end if;
end;
$$;

create or replace function public.fail_quote_pdf_render(
  p_tenant_id uuid,
  p_quote_version_id uuid,
  p_failed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_quote_id uuid;
declare v_had_render boolean;
begin
  if auth.uid() is null or not public.is_tenant_admin(p_tenant_id) then
    raise exception 'quote PDF failure recording is not authorized' using errcode = 'PFD10';
  end if;
  select quote_id, pdf_render_fingerprint is not null
    into v_quote_id, v_had_render
    from public.quote_versions
   where id = p_quote_version_id and tenant_id = p_tenant_id
   for update;
  if not found then return; end if;
  if v_had_render then
    update public.quote_versions set pdf_status = 'failed'
     where id = p_quote_version_id and tenant_id = p_tenant_id;
    insert into public.quote_events (tenant_id, quote_id, quote_version_id, event_type, occurred_at)
    values (p_tenant_id, v_quote_id, p_quote_version_id, 'pdf_failed', p_failed_at);
  end if;
end;
$$;

revoke execute on function public.start_quote_pdf_render(uuid, uuid) from public;
revoke execute on function public.fail_quote_pdf_render(uuid, uuid, timestamptz) from public;
grant execute on function public.start_quote_pdf_render(uuid, uuid) to authenticated, service_role;
grant execute on function public.fail_quote_pdf_render(uuid, uuid, timestamptz)
  to authenticated, service_role;

-- A newly governed version cannot be sent with a missing/stale PDF.  Historical sent
-- rows are intentionally not rewritten; the gate only applies on the draft -> sent RPC.
create or replace function public.assert_quote_pdf_current_for_send(p_quote_version_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare v_current text;
declare v_stored text;
declare v_status text;
declare v_file_id uuid;
begin
  select pdf_status, pdf_file_id, pdf_content_fingerprint
    into v_status, v_file_id, v_stored
    from public.quote_versions where id = p_quote_version_id;
  v_current := public.quote_version_content_fingerprint(p_quote_version_id);
  if v_status <> 'generated' or v_file_id is null or v_stored is null or v_stored is distinct from v_current then
    raise exception 'current PDF is required before sending a governed quote version' using errcode = 'PFD10';
  end if;
end;
$$;

revoke execute on function public.assert_quote_pdf_current_for_send(uuid)
  from public, anon, authenticated, service_role;

-- Round-1 hardening: deterministic trigger order, database-issued render identity,
-- and attributable lifecycle RPCs.  Recreate rather than alter triggers so replaying
-- a reset migration cannot retain an earlier alphabetical ordering.
drop trigger if exists quote_versions_invalidate_stale_pdf on public.quote_versions;
drop trigger if exists quote_versions_bind_pdf_render_fingerprint on public.quote_versions;
drop trigger if exists a10_quote_versions_bind_pdf_render on public.quote_versions;
drop trigger if exists z10_quote_versions_invalidate_pdf on public.quote_versions;
drop trigger if exists a10_quote_versions_invalidate_pdf on public.quote_versions;
drop trigger if exists z10_quote_versions_bind_pdf_render on public.quote_versions;
create trigger a10_quote_versions_invalidate_pdf
  before update on public.quote_versions
  for each row execute function public.invalidate_quote_version_pdf();
create trigger z10_quote_versions_bind_pdf_render
  before update on public.quote_versions
  for each row execute function public.bind_quote_pdf_render_fingerprint();

create or replace function public.invalidate_quote_version_pdf_for_child()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_file_id uuid; v_render_file_id uuid; v_old_id uuid; v_new_id uuid; v_changed boolean;
begin
  v_old_id := case when tg_op in ('UPDATE', 'DELETE') then old.quote_version_id else null end;
  v_new_id := case when tg_op in ('UPDATE', 'INSERT') then new.quote_version_id else null end;
  v_changed := tg_op <> 'UPDATE'
    or (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at');
  if not v_changed then return case when tg_op = 'DELETE' then old else new end; end if;
  -- Reparenting changes both customer-visible snapshots. Lock in UUID order to avoid
  -- update-vs-reparent deadlocks and invalidate each distinct draft parent.
  for v_id in
    select distinct x.id from unnest(array[v_old_id, v_new_id]) as x(id)
     where x.id is not null order by x.id
  loop
    select qv.pdf_file_id, qv.pdf_render_file_id into v_file_id, v_render_file_id
      from public.quote_versions qv
     where qv.id = v_id and qv.status = 'draft' for update;
    if found then
      -- Also follow legacy active links when the version references are NULL;
      -- every affected metadata row is archived while its Storage bytes remain.
      with archived_links as (
        update public.file_links
           set archived_at = coalesce(archived_at, statement_timestamp())
         where tenant_id = (select tenant_id from public.quote_versions where id = v_id)
           and owner_type = 'quote_version'
           and owner_id = v_id
           and purpose = 'quote_pdf'
           and archived_at is null
         returning file_id
      ), affected_files as (
        select file_id from archived_links
        union
        select unnest(array[v_file_id, v_render_file_id])
      )
      update public.files
         set lifecycle_state = 'archived',
             archived_at = coalesce(archived_at, statement_timestamp())
       where id in (select file_id from affected_files where file_id is not null)
         and lifecycle_state <> 'archived';
      update public.quote_versions set pdf_status = 'not_generated', pdf_file_id = null,
        pdf_generated_at = null, pdf_content_fingerprint = null,
        pdf_render_fingerprint = null, pdf_render_file_id = null,
        pdf_render_correlation_id = null, pdf_render_started_at = null,
        pdf_render_lease_expires_at = null, pdf_render_attestation_key_id = null,
        pdf_render_attestation_issued_at = null, pdf_render_attestation_expires_at = null,
        pdf_generated_correlation_id = null
       where id = v_id;
    end if;
  end loop;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.bind_quote_pdf_render_fingerprint()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.pdf_status = 'generating' and old.pdf_status is distinct from 'generating' then
    if new.pdf_render_file_id is null then raise exception 'PDF render identity is required' using errcode = 'PFD10'; end if;
    new.pdf_render_fingerprint := public.quote_version_content_fingerprint(new.id);
  elsif new.pdf_status in ('not_generated', 'failed') then
    new.pdf_render_fingerprint := null; new.pdf_render_file_id := null;
  elsif new.pdf_status = 'generated' and old.pdf_status is distinct from 'generated' then
    if old.pdf_render_fingerprint is null or old.pdf_render_file_id is null
       or new.pdf_file_id is distinct from old.pdf_render_file_id
       or old.pdf_render_fingerprint is distinct from public.quote_version_content_fingerprint(new.id) then
      raise exception 'quote PDF no longer matches the current draft content' using errcode = 'PFD10';
    end if;
    new.pdf_content_fingerprint := old.pdf_render_fingerprint;
    new.pdf_render_fingerprint := null;
    new.pdf_render_file_id := null;
  end if;
  return new;
end;
$$;

drop function if exists public.start_quote_pdf_render(uuid, uuid);
create or replace function public.start_quote_pdf_render(
  p_tenant_id uuid, p_quote_version_id uuid, p_actor_user_id uuid,
  p_correlation_id uuid, p_started_at timestamptz
) returns table (expected_file_id uuid)
language plpgsql security definer set search_path = '' as $$
declare v_file_id uuid := gen_random_uuid();
begin
  perform public.assert_story_10_8_quote_reviewer(p_tenant_id, p_actor_user_id);
  update public.quote_versions set pdf_render_file_id = v_file_id, pdf_status = 'generating'
   where id = p_quote_version_id and tenant_id = p_tenant_id and status = 'draft'
     and pdf_status is distinct from 'generating';
  if not found then raise exception 'quote PDF generation target not found' using errcode = 'PFD10'; end if;
  perform public.record_audit_event(p_tenant_id, p_actor_user_id, 'quote.pdf.render.start',
    'quote.pdf.render_started', 'quote_version', p_quote_version_id, p_correlation_id, '{}'::jsonb, v_now);
  return query select v_file_id;
end;
$$;

-- Signature changes are intentional: old broad variants must not remain callable.
drop function if exists public.complete_quote_pdf_render(uuid, uuid, uuid, timestamptz);
drop function if exists public.complete_quote_pdf_render(uuid, uuid, uuid, timestamptz, uuid, uuid);
create function public.complete_quote_pdf_render(
  p_tenant_id uuid, p_quote_version_id uuid, p_file_id uuid, p_generated_at timestamptz,
  p_actor_user_id uuid, p_correlation_id uuid
) returns table (quote_version_id uuid)
language plpgsql security definer set search_path = '' as $$
declare v_quote_id uuid; v_fingerprint text; v_expected uuid; v_old_file_id uuid; v_rows integer;
begin
  perform public.assert_story_10_8_quote_reviewer(p_tenant_id, p_actor_user_id);
  select qv.quote_id, qv.pdf_render_fingerprint, qv.pdf_render_file_id, qv.pdf_file_id
    into v_quote_id, v_fingerprint, v_expected, v_old_file_id from public.quote_versions qv
   where qv.id = p_quote_version_id and qv.tenant_id = p_tenant_id and qv.status = 'draft'
     and qv.pdf_status = 'generating' for update;
  if not found or v_expected is distinct from p_file_id or v_fingerprint is null
     or v_fingerprint is distinct from public.quote_version_content_fingerprint(p_quote_version_id) then
    raise exception 'quote PDF completion is stale or unauthorized' using errcode = 'PFD10';
  end if;
  -- The expected identity is not enough: prove this is the actor's new PDF draft,
  -- with its durable quote_pdf kind, exact tenant-first object path, and no
  -- pre-existing link.
  perform 1 from public.files f where f.id = p_file_id and f.tenant_id = p_tenant_id
    and f.archived_at is null and f.lifecycle_state = 'draft' and f.bucket_id = 'tenant-files'
    and f.artifact_kind = 'quote_pdf' and f.mime_type = 'application/pdf' and f.uploaded_by = p_actor_user_id
    and f.object_path like p_tenant_id::text || '/' || p_file_id::text || '/%'
    and not exists (select 1 from public.file_links fl where fl.file_id = p_file_id) for update;
  if not found then raise exception 'quote PDF file is not the expected unlinked upload' using errcode = 'PFD10'; end if;
  -- The tenant reviewer authorizes the exact application-computed SHA-256 stored on
  -- `files`. Storage is the authority for object existence and system metadata;
  -- PostgreSQL deliberately does not claim to recompute a SHA-256 from Storage bytes.
  perform public.assert_quote_pdf_storage_object(p_tenant_id, p_file_id);
  update public.files set lifecycle_state = 'linked' where id = p_file_id and tenant_id = p_tenant_id
    and lifecycle_state = 'draft' and archived_at is null;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'quote PDF file lifecycle transition failed' using errcode = 'PFD10'; end if;
  -- A legacy preview can have an active quote_pdf link while `pdf_file_id` is
  -- NULL. Archive the files behind every link superseded here as well as the
  -- explicit current reference below, so an obsolete PDF cannot retain
  -- accessible metadata merely because the legacy reference was incomplete.
  with archived_quote_pdf_links as (
    update public.file_links
       set archived_at = coalesce(archived_at, p_generated_at)
     where tenant_id = p_tenant_id
       and owner_type = 'quote_version'
       and owner_id = p_quote_version_id
       and purpose = 'quote_pdf'
       and archived_at is null
     returning file_id
  )
  update public.files
     set lifecycle_state = 'archived',
         archived_at = coalesce(archived_at, p_generated_at)
   where tenant_id = p_tenant_id
     and id in (select file_id from archived_quote_pdf_links)
     and id <> p_file_id
     and lifecycle_state <> 'archived';
  if v_old_file_id is not null and v_old_file_id <> p_file_id then
    update public.files set lifecycle_state = 'archived', archived_at = coalesce(archived_at, p_generated_at)
     where id = v_old_file_id and tenant_id = p_tenant_id and lifecycle_state <> 'archived';
  end if;
  insert into public.file_links (tenant_id, file_id, owner_type, owner_id, purpose)
    values (p_tenant_id, p_file_id, 'quote_version', p_quote_version_id, 'quote_pdf');
  update public.quote_versions set pdf_file_id = p_file_id, pdf_generated_at = p_generated_at,
    pdf_status = 'generated' where id = p_quote_version_id and tenant_id = p_tenant_id;
  insert into public.quote_events (tenant_id, quote_id, quote_version_id, event_type, occurred_at)
    values (p_tenant_id, v_quote_id, p_quote_version_id, 'pdf_generated', p_generated_at);
  perform public.record_audit_event(p_tenant_id, p_actor_user_id, 'quote.pdf.render.complete',
    'quote.pdf.generated', 'quote_version', p_quote_version_id, p_correlation_id, '{}'::jsonb, p_generated_at);
  return query select p_quote_version_id;
end;
$$;

drop function if exists public.fail_quote_pdf_render(uuid, uuid, timestamptz);
drop function if exists public.fail_quote_pdf_render(uuid, uuid, uuid, timestamptz, uuid, uuid);
create function public.fail_quote_pdf_render(
  p_tenant_id uuid, p_quote_version_id uuid, p_expected_file_id uuid, p_failed_at timestamptz,
  p_actor_user_id uuid, p_correlation_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare v_quote_id uuid;
begin
  perform public.assert_story_10_8_quote_reviewer(p_tenant_id, p_actor_user_id);
  select quote_id into v_quote_id from public.quote_versions where id = p_quote_version_id
    and tenant_id = p_tenant_id and pdf_status = 'generating' and pdf_render_file_id = p_expected_file_id for update;
  if not found then raise exception 'quote PDF failure target is stale or unauthorized' using errcode = 'PFD10'; end if;
  -- Retain any uploaded bytes, but make their metadata and links ineligible for
  -- normal signed access in the same transaction as the failed state and audit.
  update public.files set lifecycle_state = 'archived', archived_at = coalesce(archived_at, p_failed_at)
   where id = p_expected_file_id and tenant_id = p_tenant_id and lifecycle_state <> 'archived';
  update public.file_links set archived_at = coalesce(archived_at, p_failed_at)
   where file_id = p_expected_file_id and tenant_id = p_tenant_id and archived_at is null;
  update public.quote_versions set pdf_status = 'failed' where id = p_quote_version_id and tenant_id = p_tenant_id;
  insert into public.quote_events (tenant_id, quote_id, quote_version_id, event_type, occurred_at)
    values (p_tenant_id, v_quote_id, p_quote_version_id, 'pdf_failed', p_failed_at);
  perform public.record_audit_event(p_tenant_id, p_actor_user_id, 'quote.pdf.render.fail',
    'quote.pdf.failed', 'quote_version', p_quote_version_id, p_correlation_id, '{}'::jsonb, p_failed_at);
end;
$$;

create or replace function public.assert_quote_pdf_current_for_send(p_quote_version_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_tenant_id uuid; v_file_id uuid; v_stored text; v_current text;
begin
  select tenant_id, pdf_file_id, pdf_content_fingerprint into v_tenant_id, v_file_id, v_stored
    from public.quote_versions where id = p_quote_version_id and pdf_status = 'generated' for update;
  v_current := public.quote_version_content_fingerprint(p_quote_version_id);
  if not found or v_file_id is null or v_stored is null or v_stored is distinct from v_current then
    raise exception 'current PDF is required before sending a governed quote version' using errcode = 'PFD10'; end if;
  perform 1 from public.files f where f.id = v_file_id and f.tenant_id = v_tenant_id
    and f.archived_at is null and f.lifecycle_state in ('linked','locked') for update;
  if not found then raise exception 'active PDF file is required before sending' using errcode = 'PFD10'; end if;
  perform public.assert_quote_pdf_storage_object(v_tenant_id, v_file_id);
  perform 1 from public.file_links fl where fl.tenant_id = v_tenant_id and fl.file_id = v_file_id
    and fl.owner_type = 'quote_version' and fl.owner_id = p_quote_version_id and fl.purpose = 'quote_pdf'
    and fl.archived_at is null for update;
  if not found then raise exception 'active PDF link is required before sending' using errcode = 'PFD10'; end if;
end;
$$;

revoke execute on function public.start_quote_pdf_render(uuid, uuid, uuid, uuid, timestamptz)
  from public, anon, service_role;
revoke execute on function public.complete_quote_pdf_render(uuid, uuid, uuid, timestamptz, uuid, uuid)
  from public, anon, service_role;
revoke execute on function public.fail_quote_pdf_render(uuid, uuid, uuid, timestamptz, uuid, uuid)
  from public, anon, service_role;
grant execute on function public.start_quote_pdf_render(uuid, uuid, uuid, uuid, timestamptz) to authenticated;
grant execute on function public.complete_quote_pdf_render(uuid, uuid, uuid, timestamptz, uuid, uuid) to authenticated;
grant execute on function public.fail_quote_pdf_render(uuid, uuid, uuid, timestamptz, uuid, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- PDF object integrity. The command hashes the exact rendered bytes before upload
-- and persists that SHA-256 in `files.checksum`. This function proves that the
-- corresponding private Storage object still exists and has the expected MIME and
-- byte size before activation or send. Storage exposes object metadata, not a
-- server-side SHA-256 of its bytes, so this deliberately does not pretend to
-- recompute the digest in PostgreSQL. A database-issued render identity reserves a
-- quote-PDF before any Storage write; once its `files` row exists, the late
-- `enforce_file_lock` definition below freezes that metadata/object identity as well.
-- ----------------------------------------------------------------------------
create or replace function public.assert_quote_pdf_storage_object(
  p_tenant_id uuid,
  p_file_id uuid
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_bucket_id text;
  v_object_path text;
  v_mime_type text;
  v_size_bytes bigint;
  v_checksum text;
begin
  select f.bucket_id, f.object_path, f.mime_type, f.size_bytes, f.checksum
    into v_bucket_id, v_object_path, v_mime_type, v_size_bytes, v_checksum
    from public.files f
   where f.id = p_file_id and f.tenant_id = p_tenant_id and f.artifact_kind = 'quote_pdf'
   for update;

  if not found or v_bucket_id <> 'tenant-files' or v_mime_type <> 'application/pdf'
     or v_size_bytes is null or v_size_bytes < 0 or v_checksum is null
     or v_checksum !~ '^[0-9a-f]{64}$' then
    raise exception 'quote PDF file integrity metadata is invalid' using errcode = 'PFD10';
  end if;

  perform 1
    from storage.objects o
   where o.bucket_id = v_bucket_id
     and o.name = v_object_path
     and o.metadata ->> 'mimetype' = v_mime_type
     and o.metadata ->> 'size' ~ '^[0-9]+$'
     and (o.metadata ->> 'size')::bigint = v_size_bytes
   for key share;
  if not found then
    raise exception 'quote PDF Storage object is missing or does not match its metadata' using errcode = 'PFD10';
  end if;
end;
$$;

revoke execute on function public.assert_quote_pdf_storage_object(uuid, uuid)
  from public, anon, authenticated, service_role;

-- Storage RLS governs ordinary tenant paths, but Storage implements an SDK
-- `upsert` through its own insert/conflict path. An UPDATE policy alone is therefore
-- not a sufficient byte-integrity boundary for a reserved quote-PDF object. Keep the
-- generic policy unchanged and enforce the typed artifact's one-write lifecycle in a
-- storage-row trigger: a draft reservation may receive its first object, while an
-- existing, archived, current, or historical quote-PDF object can never be replaced.
create or replace function public.enforce_quote_pdf_storage_object_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quote_pdf boolean := false;
  v_lifecycle_state text;
begin
  if tg_op = 'UPDATE' then
    select exists (
      select 1 from public.files f
       where f.bucket_id = old.bucket_id
         and f.object_path = old.name
         and f.artifact_kind = 'quote_pdf'
    ) into v_quote_pdf;
  end if;

  select coalesce(v_quote_pdf, false) or exists (
    select 1 from public.files f
     where f.bucket_id = new.bucket_id
       and f.object_path = new.name
       and f.artifact_kind = 'quote_pdf'
  ), (
    select f.lifecycle_state
      from public.files f
     where f.bucket_id = new.bucket_id
       and f.object_path = new.name
       and f.artifact_kind = 'quote_pdf'
     limit 1
  ) into v_quote_pdf, v_lifecycle_state;

  if not v_quote_pdf then
    return new;
  end if;

  if tg_op = 'UPDATE' or v_lifecycle_state is distinct from 'draft' or exists (
    select 1 from storage.objects o
     where o.bucket_id = new.bucket_id and o.name = new.name
  ) then
    raise exception 'quote PDF Storage bytes are immutable after reservation' using errcode = 'PFD10';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_quote_pdf_storage_object_immutability()
  from public, anon, authenticated, service_role;

drop trigger if exists quote_pdf_storage_object_immutability on storage.objects;
create trigger quote_pdf_storage_object_immutability
  before insert or update on storage.objects
  for each row execute function public.enforce_quote_pdf_storage_object_immutability();

comment on function public.enforce_quote_pdf_storage_object_immutability() is
  'Story 10.9 Storage byte-integrity guard. Allows exactly the first object insert for a draft quote_pdf reservation; rejects all update/conflict-upsert paths, late archived uploads, and path rewrites for reserved/current/historical quote PDFs. Generic tenant-files uploads remain governed only by the ordinary Storage RLS policies.';

-- The ordinary update policy keeps generic metadata-backed object behavior intact.
drop policy if exists tenant_files_objects_update_own on storage.objects;
create policy tenant_files_objects_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'tenant-files'
    and (storage.foldername(name))[1] ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.is_tenant_admin(((storage.foldername(name))[1])::uuid)
    and not exists (
      select 1 from public.files f
       where f.bucket_id = storage.objects.bucket_id
         and f.object_path = storage.objects.name
    )
  )
  with check (
    bucket_id = 'tenant-files'
    and (storage.foldername(name))[1] ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.is_tenant_admin(((storage.foldername(name))[1])::uuid)
    and not exists (
      select 1 from public.files f
       where f.bucket_id = storage.objects.bucket_id
         and f.object_path = storage.objects.name
    )
  );

-- Final-send authorization must change if the generated PDF's persisted checksum
-- changes. The prior function already hashes attachment file rows; add the derived
-- quote-PDF file row as a separate stable field without changing existing inputs.
create or replace function public.story_10_8_quote_version_source_revision(
  p_tenant_id uuid,
  p_quote_version_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
set timezone = 'UTC'
as $$
  select jsonb_build_object('sourceHash', encode(sha256(convert_to(jsonb_build_object(
    'version', (select to_jsonb(qv) from public.quote_versions qv
      where qv.tenant_id = p_tenant_id and qv.id = p_quote_version_id),
    'lines', coalesce((select jsonb_agg(to_jsonb(qvl) order by qvl.sort_order, qvl.id)
      from public.quote_version_lines qvl
      where qvl.tenant_id = p_tenant_id and qvl.quote_version_id = p_quote_version_id), '[]'::jsonb),
    'attachments', coalesce((select jsonb_agg(to_jsonb(qva) order by qva.sort_order, qva.id)
      from public.quote_version_attachments qva
      where qva.tenant_id = p_tenant_id and qva.quote_version_id = p_quote_version_id), '[]'::jsonb),
    'attachmentFiles', coalesce((select jsonb_agg(to_jsonb(f) order by f.id)
      from public.files f where f.tenant_id = p_tenant_id and f.id in (
        select qva.file_id from public.quote_version_attachments qva
        where qva.tenant_id = p_tenant_id and qva.quote_version_id = p_quote_version_id
      )), '[]'::jsonb),
    'quotePdfFile', (select to_jsonb(f) from public.files f
      join public.quote_versions qv on qv.pdf_file_id = f.id
      where qv.tenant_id = p_tenant_id and qv.id = p_quote_version_id
        and f.tenant_id = p_tenant_id),
    'links', coalesce((select jsonb_agg(to_jsonb(fl) order by fl.id)
      from public.file_links fl where fl.tenant_id = p_tenant_id
        and fl.owner_type = 'quote_version' and fl.owner_id = p_quote_version_id), '[]'::jsonb)
  )::text, 'UTF8')), 'hex'));
$$;

-- Backfill the durable discriminator before installing the final immutable guard.
-- `files_lock` already exists from Story 8.4; it cannot yet know about the new
-- column, so disable only that exact trigger for this one trusted migration write.
alter table public.files disable trigger files_lock;
update public.files f
   set artifact_kind = 'quote_pdf'
 where f.artifact_kind is null
   and (
     exists (
       select 1 from public.quote_versions qv
        where qv.tenant_id = f.tenant_id
          and (qv.pdf_render_file_id = f.id or qv.pdf_file_id = f.id)
     )
     or exists (
       select 1 from public.file_links fl
        where fl.tenant_id = f.tenant_id
          and fl.file_id = f.id
          and fl.purpose = 'quote_pdf'
     )
   );
alter table public.files enable trigger files_lock;

-- Generic authenticated file creation remains tenant-scoped, but it cannot mint a
-- quote-PDF artifact. The reservation RPC below is the sole authenticated route for
-- that discriminator and validates the already-issued quote render identity.
drop policy if exists files_insert_own on public.files;
create policy files_insert_own
  on public.files
  for insert
  to authenticated
  with check (
    artifact_kind is null
    and public.is_tenant_admin(tenant_id)
  );

create or replace function public.reserve_quote_pdf_file(
  p_tenant_id uuid,
  p_quote_version_id uuid,
  p_file_id uuid,
  p_object_path text,
  p_display_name text,
  p_size_bytes bigint,
  p_checksum text,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_expected_file_id uuid;
  v_render_fingerprint text;
  v_file_id uuid;
begin
  perform public.assert_story_10_8_quote_reviewer(p_tenant_id, p_actor_user_id);

  select qv.status, qv.pdf_render_file_id, qv.pdf_render_fingerprint
    into v_status, v_expected_file_id, v_render_fingerprint
    from public.quote_versions qv
   where qv.tenant_id = p_tenant_id and qv.id = p_quote_version_id
   for update;
  if not found
     or v_status <> 'draft'
     or v_expected_file_id is distinct from p_file_id
     or v_render_fingerprint is null then
    raise exception 'quote PDF reservation is stale or unauthorized' using errcode = 'PFD10';
  end if;

  -- The path is canonical rather than merely prefix-checked. A PDF display name is
  -- one safe, non-empty path segment with no traversal/control characters or outer
  -- whitespace; it is retained verbatim in the canonical third path segment.
  if p_display_name is null
     or char_length(p_display_name) <= 4
     or char_length(p_display_name) > 128
     or lower(right(p_display_name, 4)) <> '.pdf'
     or p_display_name <> btrim(p_display_name)
     or position('/' in p_display_name) > 0
     or position(chr(92) in p_display_name) > 0
     or p_display_name ~ '[[:cntrl:]]'
     or position('..' in p_display_name) > 0
     or p_object_path is distinct from
        p_tenant_id::text || '/' || p_file_id::text || '/' || p_display_name
     or p_size_bytes is null
     or p_size_bytes <= 0
     or p_checksum is null
     or p_checksum !~ '^[0-9a-f]{64}$' then
    raise exception 'quote PDF reservation metadata is invalid' using errcode = 'PFD10';
  end if;

  insert into public.files (
    id, tenant_id, bucket_id, object_path, display_name, mime_type, size_bytes,
    checksum, uploaded_by, lifecycle_state, artifact_kind
  ) values (
    p_file_id, p_tenant_id, 'tenant-files', p_object_path, p_display_name,
    'application/pdf', p_size_bytes, p_checksum, p_actor_user_id, 'draft', 'quote_pdf'
  ) returning id into v_file_id;

  return v_file_id;
end;
$$;

revoke execute on function public.reserve_quote_pdf_file(uuid, uuid, uuid, text, text, bigint, text, uuid)
  from public, anon, service_role;
grant execute on function public.reserve_quote_pdf_file(uuid, uuid, uuid, text, text, bigint, text, uuid)
  to authenticated;

comment on function public.reserve_quote_pdf_file(uuid, uuid, uuid, text, text, bigint, text, uuid) is
  'Story 10.9 narrow authenticated quote-PDF metadata reservation. Requires the authenticated tenant reviewer/actor and an in-flight DB-issued render identity; inserts only the fixed tenant-files/application-pdf/draft/quote_pdf metadata shape. No generic direct INSERT can create artifact_kind=quote_pdf.';

-- ----------------------------------------------------------------------------
-- Quote-PDF identity hardening. Story 8.4's existing `files_lock` trigger invokes
-- this function; redefine it late so the same guard also covers a file as soon as
-- Story 10.9 reserves its database-issued render id. `artifact_kind='quote_pdf'`
-- is the durable arm; render/current references and `quote_pdf` links remain
-- defense-in-depth arms for backfilled or anomalous historical rows.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_file_lock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quote_pdf boolean;
begin
  v_quote_pdf := coalesce(old.artifact_kind = 'quote_pdf', false);
  select v_quote_pdf or exists (
    select 1
      from public.quote_versions qv
     where qv.tenant_id = old.tenant_id
       and (qv.pdf_render_file_id = old.id or qv.pdf_file_id = old.id)
  ) or exists (
    select 1
      from public.file_links fl
     where fl.tenant_id = old.tenant_id
       and fl.file_id = old.id
       and fl.purpose = 'quote_pdf'
  ) into v_quote_pdf;

  -- Archive-over-delete remains mandatory for Story 8.4 locked files and now for
  -- all reserved/current/historically-linked quote PDFs as well.
  if tg_op = 'DELETE' then
    if old.lifecycle_state = 'locked' or v_quote_pdf then
      raise exception
        'files is immutable once locked or reserved as a quote PDF: deletion is forbidden (archive-only)'
        using errcode = 'FL823';
    end if;
    return old;
  end if;

  -- The discriminator is write-once. The migration backfill is the sole legacy
  -- exception and runs with this trigger disabled above; a generic authenticated
  -- file cannot be retagged into a quote PDF after insertion.
  if new.artifact_kind is distinct from old.artifact_kind then
    raise exception
      'files artifact kind is immutable once inserted'
      using errcode = 'FL823';
  end if;

  -- Preserve Story 8.4 behavior for ordinary files: only locked files enter this
  -- immutability guard. Quote-PDF rows enter it as soon as their identity is known.
  if old.lifecycle_state <> 'locked' and not v_quote_pdf then
    return new;
  end if;

  -- Object identity and uploaded-content assertions are immutable for both kinds
  -- of protected rows. The permitted lifecycle/archive fields are checked below.
  if row(
       new.id, new.tenant_id, new.bucket_id, new.object_path, new.display_name,
       new.mime_type, new.size_bytes, new.checksum, new.uploaded_by, new.created_at,
       new.artifact_kind
     ) is distinct from row(
       old.id, old.tenant_id, old.bucket_id, old.object_path, old.display_name,
       old.mime_type, old.size_bytes, old.checksum, old.uploaded_by, old.created_at,
       old.artifact_kind
     ) then
    raise exception
      'files is immutable once locked or reserved as a quote PDF: object identity/metadata cannot be changed'
      using errcode = 'FL823';
  end if;

  -- No protected row can be deleted/revived. Model the only legal monotonic paths
  -- explicitly rather than merely forbidding a few known reversals:
  -- draft -> draft|linked|locked|archived
  -- linked -> linked|locked|archived
  -- locked -> locked|archived
  -- archived -> archived
  if (old.lifecycle_state = 'draft' and new.lifecycle_state not in ('draft', 'linked', 'locked', 'archived'))
     or (old.lifecycle_state = 'linked' and new.lifecycle_state not in ('linked', 'locked', 'archived'))
     or (old.lifecycle_state = 'locked' and new.lifecycle_state not in ('locked', 'archived'))
     or (old.lifecycle_state = 'archived' and new.lifecycle_state <> 'archived')
     or old.lifecycle_state = 'deleted' then
    raise exception
      'files lifecycle is irreversible once locked or reserved as a quote PDF: illegal transition % -> %',
      old.lifecycle_state, new.lifecycle_state
      using errcode = 'FL823';
  end if;

  -- `files` has no mutable non-identity business columns. Keep the original
  -- locked-file allow-list exact: only lifecycle/archive bookkeeping and the
  -- trigger-owned timestamp may change after protection is armed.
  if (to_jsonb(new) - array['archived_at', 'lifecycle_state', 'updated_at'])
       is distinct from
     (to_jsonb(old) - array['archived_at', 'lifecycle_state', 'updated_at']) then
    raise exception
      'files is immutable once locked or reserved as a quote PDF: only lifecycle/archive bookkeeping may change'
      using errcode = 'FL823';
  end if;

  return new;
end;
$$;

comment on function public.enforce_file_lock() is
  'Story 8.4 file immutability guard, hardened by Story 10.9. BEFORE UPDATE OR DELETE on files: retains the locked-file FL823 archive-only rules and additionally protects durable artifact_kind=''quote_pdf'' rows (with quote_versions.pdf_render_file_id/pdf_file_id and quote_pdf link checks retained as defense in depth). Protected file identity/metadata (id, tenant_id, bucket_id, object_path, display_name, mime_type, size_bytes, checksum, uploaded_by, created_at, artifact_kind) is immutable. Lifecycle is monotonic only: draft -> draft|linked|locked|archived; linked -> linked|locked|archived; locked -> locked|archived; archived -> archived. DELETE and revival are forbidden (FL823). SECURITY INVOKER + empty search_path.';

-- ---------------------------------------------------------------------------
-- Story 10.9 provenance attestation and recoverable render lease.
-- This is deliberately a second, server-only proof after the separate Story
-- 10.8 reviewer authorization. It is not a browser capability and does not
-- grant review authority. Node signs exact bytes; PostgreSQL reconstructs the
-- same length-prefixed UTF-8 payload and verifies it with pgcrypto + Vault.
-- ---------------------------------------------------------------------------
create or replace function public.quote_pdf_attestation_iso(p_value timestamptz)
returns text language sql stable security invoker set search_path = '' set timezone = 'UTC' as $$
  select to_char(p_value at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

create or replace function public.quote_pdf_attestation_payload(
  p_tenant_id uuid, p_actor_user_id uuid, p_quote_version_id uuid, p_render_file_id uuid,
  p_content_fingerprint text, p_bucket_id text, p_object_path text, p_checksum text,
  p_size_bytes bigint, p_mime_type text, p_correlation_id uuid, p_key_id text,
  p_issued_at timestamptz, p_expires_at timestamptz, p_generation_started_at timestamptz
) returns bytea
language sql stable security invoker set search_path = '' as $$
  select string_agg(
    convert_to(octet_length(convert_to(value, 'UTF8'))::text || ':', 'UTF8') || convert_to(value, 'UTF8'),
    ''::bytea order by ordinality
  )
  from unnest(array[
    'elpro.quote-pdf.attestation.v1', p_tenant_id::text, p_actor_user_id::text,
    p_quote_version_id::text, p_render_file_id::text, p_content_fingerprint, p_bucket_id,
    p_object_path, p_checksum, p_size_bytes::text, p_mime_type, p_correlation_id::text,
    p_key_id, public.quote_pdf_attestation_iso(p_issued_at),
    public.quote_pdf_attestation_iso(p_expires_at), public.quote_pdf_attestation_iso(p_generation_started_at)
  ]) with ordinality as fields(value, ordinality)
$$;

create or replace function public.quote_pdf_attestation_vault_secret(p_key_id text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_count integer; v_secret text;
begin
  if p_key_id is null or p_key_id !~ '^[A-Za-z0-9_-]{1,64}$' then
    raise exception 'quote PDF attestation key is unavailable' using errcode = 'PFD10';
  end if;
  select count(*), min(decrypted_secret) into v_count, v_secret
    from vault.decrypted_secrets
   where name = 'quote_pdf_attestation_' || p_key_id;
  if v_count <> 1 or v_secret is null or octet_length(convert_to(v_secret, 'UTF8')) = 0 then
    raise exception 'quote PDF attestation key is unavailable' using errcode = 'PFD10';
  end if;
  return v_secret;
end;
$$;

revoke execute on function public.quote_pdf_attestation_iso(timestamptz),
  public.quote_pdf_attestation_payload(uuid, uuid, uuid, uuid, text, text, text, text, bigint, text, uuid, text, timestamptz, timestamptz, timestamptz),
  public.quote_pdf_attestation_vault_secret(text) from public, anon, authenticated, service_role;

-- The bind trigger keeps all in-flight provenance internally coherent. Generated
-- state retains only the completed correlation; secret/key/signature never enter
-- ordinary tables or audit payloads.
create or replace function public.bind_quote_pdf_render_fingerprint()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.pdf_status = 'generating' and old.pdf_status is distinct from 'generating' then
    if new.pdf_render_file_id is null or new.pdf_render_correlation_id is null
       or new.pdf_render_started_at is null or new.pdf_render_lease_expires_at is null
       or new.pdf_render_attestation_key_id is null or new.pdf_render_attestation_issued_at is null
       or new.pdf_render_attestation_expires_at is null then
      raise exception 'PDF render provenance is required' using errcode = 'PFD10';
    end if;
    new.pdf_render_fingerprint := public.quote_version_content_fingerprint(new.id);
  elsif new.pdf_status in ('not_generated', 'failed') then
    new.pdf_render_fingerprint := null; new.pdf_render_file_id := null;
    new.pdf_render_correlation_id := null; new.pdf_render_started_at := null;
    new.pdf_render_lease_expires_at := null; new.pdf_render_attestation_key_id := null;
    new.pdf_render_attestation_issued_at := null; new.pdf_render_attestation_expires_at := null;
  elsif new.pdf_status = 'generated' and old.pdf_status is distinct from 'generated' then
    if old.pdf_render_fingerprint is null or old.pdf_render_file_id is null
       or new.pdf_file_id is distinct from old.pdf_render_file_id
       or old.pdf_render_fingerprint is distinct from public.quote_version_content_fingerprint(new.id) then
      raise exception 'quote PDF no longer matches the current draft content' using errcode = 'PFD10';
    end if;
    new.pdf_content_fingerprint := old.pdf_render_fingerprint;
    new.pdf_generated_correlation_id := old.pdf_render_correlation_id;
    new.pdf_render_fingerprint := null; new.pdf_render_file_id := null;
    new.pdf_render_correlation_id := null; new.pdf_render_started_at := null;
    new.pdf_render_lease_expires_at := null; new.pdf_render_attestation_key_id := null;
    new.pdf_render_attestation_issued_at := null; new.pdf_render_attestation_expires_at := null;
  end if;
  return new;
end;
$$;

drop function if exists public.start_quote_pdf_render(uuid, uuid, uuid, uuid, timestamptz);
drop function if exists public.start_quote_pdf_render(uuid, uuid, uuid, uuid, timestamptz, text);
create function public.start_quote_pdf_render(
  p_tenant_id uuid, p_quote_version_id uuid, p_actor_user_id uuid,
  p_correlation_id uuid, p_started_at timestamptz, p_attestation_key_id text
) returns table (
  expected_file_id uuid, completed_file_id uuid, render_fingerprint text,
  attestation_key_id text, attestation_issued_at text, attestation_expires_at text,
  generation_started_at text
)
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := statement_timestamp(); v_file_id uuid := gen_random_uuid();
  v_existing_file_id uuid; v_existing_correlation uuid; v_lease timestamptz;
  v_completed_file_id uuid; v_completed_correlation uuid; v_status text; v_quote_id uuid;
  v_fingerprint text; v_started timestamptz; v_expires timestamptz;
begin
  perform public.assert_story_10_8_quote_reviewer(p_tenant_id, p_actor_user_id);
  -- A missing/duplicate/inaccessible Vault key fails before any state mutation.
  perform public.quote_pdf_attestation_vault_secret(p_attestation_key_id);
  select pdf_status, pdf_render_file_id, pdf_render_correlation_id, pdf_render_lease_expires_at,
         pdf_file_id, pdf_generated_correlation_id, quote_id
    into v_status, v_existing_file_id, v_existing_correlation, v_lease,
         v_completed_file_id, v_completed_correlation, v_quote_id
    from public.quote_versions
   where id = p_quote_version_id and tenant_id = p_tenant_id and status = 'draft'
   for update;
  if not found then raise exception 'quote PDF generation target not found' using errcode = 'PFD10'; end if;
  if v_status = 'generated' and v_completed_correlation = p_correlation_id and v_completed_file_id is not null then
    return query select v_completed_file_id, v_completed_file_id, null::text, null::text,
      null::text, null::text, null::text;
    return;
  end if;
  if v_status = 'generating' then
    if v_existing_correlation = p_correlation_id and v_lease > v_now then
      return query select qv.pdf_render_file_id, null::uuid, qv.pdf_render_fingerprint,
        qv.pdf_render_attestation_key_id, public.quote_pdf_attestation_iso(qv.pdf_render_attestation_issued_at),
        public.quote_pdf_attestation_iso(qv.pdf_render_attestation_expires_at),
        public.quote_pdf_attestation_iso(qv.pdf_render_started_at)
      from public.quote_versions qv where qv.id = p_quote_version_id;
      return;
    end if;
    if v_lease > v_now then
      raise exception 'quote PDF render is already in progress' using errcode = 'PFD10';
    end if;
    -- Bounded stale lease recovery: archive only the stale reservation/link, retain bytes.
    update public.file_links set archived_at = coalesce(archived_at, v_now)
      where tenant_id = p_tenant_id and file_id = v_existing_file_id and archived_at is null;
    update public.files set lifecycle_state = 'archived', archived_at = coalesce(archived_at, v_now)
      where tenant_id = p_tenant_id and id = v_existing_file_id and lifecycle_state <> 'archived';
    -- Force the bind trigger through its failed state before issuing a new identity;
    -- a generating -> generating UPDATE would otherwise retain the stale fingerprint.
    update public.quote_versions set pdf_status = 'failed'
      where id = p_quote_version_id and tenant_id = p_tenant_id;
  end if;
  v_started := v_now; v_expires := v_now + interval '5 minutes';
  update public.quote_versions set pdf_render_file_id = v_file_id, pdf_status = 'generating',
    pdf_render_correlation_id = p_correlation_id, pdf_render_started_at = v_started,
    pdf_render_lease_expires_at = v_expires, pdf_render_attestation_key_id = p_attestation_key_id,
    pdf_render_attestation_issued_at = v_started, pdf_render_attestation_expires_at = v_expires
   where id = p_quote_version_id and tenant_id = p_tenant_id;
  select pdf_render_fingerprint into v_fingerprint from public.quote_versions where id = p_quote_version_id;
  perform public.record_audit_event(p_tenant_id, p_actor_user_id, 'quote.pdf.render.start',
    'quote.pdf.render_started', 'quote_version', p_quote_version_id, p_correlation_id, '{}'::jsonb, p_started_at);
  return query select v_file_id, null::uuid, v_fingerprint, p_attestation_key_id,
    public.quote_pdf_attestation_iso(v_started), public.quote_pdf_attestation_iso(v_expires),
    public.quote_pdf_attestation_iso(v_started);
end;
$$;

drop function if exists public.complete_quote_pdf_render(uuid, uuid, uuid, timestamptz, uuid, uuid);
drop function if exists public.complete_quote_pdf_render(uuid, uuid, uuid, timestamptz, uuid, uuid, text, text, text, text);
create function public.complete_quote_pdf_render(
  p_tenant_id uuid, p_quote_version_id uuid, p_file_id uuid, p_generated_at timestamptz,
  p_actor_user_id uuid, p_correlation_id uuid, p_attestation_key_id text,
  p_attestation_issued_at text, p_attestation_expires_at text, p_attestation_signature text
) returns table (quote_version_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_quote_id uuid; v_fingerprint text; v_expected uuid; v_old_file_id uuid;
  v_correlation uuid; v_key_id text; v_issued timestamptz; v_expires timestamptz; v_started timestamptz;
  v_bucket text; v_path text; v_checksum text; v_size bigint; v_mime text; v_secret text; v_expected_signature text;
  v_now timestamptz := statement_timestamp();
begin
  perform public.assert_story_10_8_quote_reviewer(p_tenant_id, p_actor_user_id);
  select qv.quote_id, qv.pdf_render_fingerprint, qv.pdf_render_file_id, qv.pdf_file_id,
         qv.pdf_render_correlation_id, qv.pdf_render_attestation_key_id,
         qv.pdf_render_attestation_issued_at, qv.pdf_render_attestation_expires_at, qv.pdf_render_started_at
    into v_quote_id, v_fingerprint, v_expected, v_old_file_id, v_correlation, v_key_id, v_issued, v_expires, v_started
    from public.quote_versions qv where qv.id = p_quote_version_id and qv.tenant_id = p_tenant_id
      and qv.status = 'draft' and qv.pdf_status = 'generating' for update;
  if not found or v_expected is distinct from p_file_id or v_fingerprint is null
     or v_correlation is distinct from p_correlation_id
     or v_fingerprint is distinct from public.quote_version_content_fingerprint(p_quote_version_id)
     or v_expires <= statement_timestamp() or v_expires > v_started + interval '5 minutes'
     or p_attestation_key_id is distinct from v_key_id
     or p_attestation_issued_at is distinct from public.quote_pdf_attestation_iso(v_issued)
     or p_attestation_expires_at is distinct from public.quote_pdf_attestation_iso(v_expires)
     or p_attestation_signature is null or p_attestation_signature !~ '^[0-9a-f]{64}$' then
    raise exception 'quote PDF completion provenance is invalid' using errcode = 'PFD10';
  end if;
  select f.bucket_id, f.object_path, f.checksum, f.size_bytes, f.mime_type
    into v_bucket, v_path, v_checksum, v_size, v_mime from public.files f
   where f.id = p_file_id and f.tenant_id = p_tenant_id and f.archived_at is null
     and f.lifecycle_state = 'draft' and f.artifact_kind = 'quote_pdf'
     and f.uploaded_by = p_actor_user_id and not exists (select 1 from public.file_links fl where fl.file_id = p_file_id)
   for update;
  if not found or v_bucket <> 'tenant-files' or v_mime <> 'application/pdf'
     or v_checksum !~ '^[0-9a-f]{64}$' or v_size <= 0 then
    raise exception 'quote PDF file is not the expected unlinked upload' using errcode = 'PFD10';
  end if;
  v_secret := public.quote_pdf_attestation_vault_secret(v_key_id);
  v_expected_signature := encode(extensions.hmac(public.quote_pdf_attestation_payload(
    p_tenant_id, p_actor_user_id, p_quote_version_id, p_file_id, v_fingerprint, v_bucket, v_path,
    v_checksum, v_size, v_mime, v_correlation, v_key_id, v_issued, v_expires, v_started
  ), convert_to(v_secret, 'UTF8'), 'sha256'), 'hex');
  if v_expected_signature is distinct from p_attestation_signature then
    raise exception 'quote PDF completion provenance is invalid' using errcode = 'PFD10';
  end if;
  perform public.assert_quote_pdf_storage_object(p_tenant_id, p_file_id);
  update public.files set lifecycle_state = 'linked' where id = p_file_id and tenant_id = p_tenant_id
    and lifecycle_state = 'draft' and archived_at is null;
  if not found then raise exception 'quote PDF file lifecycle transition failed' using errcode = 'PFD10'; end if;
  -- Archive every superseded active link's metadata, including legacy previews
  -- whose quote_version.pdf_file_id was NULL. The new file is not linked until
  -- after this CTE, so it can never be selected/archived here.
  with archived_quote_pdf_links as (
    update public.file_links set archived_at = coalesce(archived_at, v_now)
      where tenant_id = p_tenant_id and owner_type = 'quote_version' and owner_id = p_quote_version_id
        and purpose = 'quote_pdf' and archived_at is null
      returning file_id
  ), superseded_file_ids as (
    select file_id from archived_quote_pdf_links
    union
    select v_old_file_id
  )
  update public.files set lifecycle_state = 'archived', archived_at = coalesce(archived_at, v_now)
    where tenant_id = p_tenant_id and id in (select file_id from superseded_file_ids where file_id is not null)
      and id <> p_file_id and lifecycle_state <> 'archived';
  insert into public.file_links (tenant_id, file_id, owner_type, owner_id, purpose)
    values (p_tenant_id, p_file_id, 'quote_version', p_quote_version_id, 'quote_pdf');
  update public.quote_versions set pdf_file_id = p_file_id, pdf_generated_at = v_now,
    pdf_status = 'generated' where id = p_quote_version_id and tenant_id = p_tenant_id;
  insert into public.quote_events (tenant_id, quote_id, quote_version_id, event_type, occurred_at)
    values (p_tenant_id, v_quote_id, p_quote_version_id, 'pdf_generated', v_now);
  perform public.record_audit_event(p_tenant_id, p_actor_user_id, 'quote.pdf.render.complete',
    'quote.pdf.generated', 'quote_version', p_quote_version_id, p_correlation_id, '{}'::jsonb, v_now);
  return query select p_quote_version_id;
end;
$$;

drop function if exists public.fail_quote_pdf_render(uuid, uuid, uuid, timestamptz, uuid, uuid);
create function public.fail_quote_pdf_render(
  p_tenant_id uuid, p_quote_version_id uuid, p_expected_file_id uuid, p_failed_at timestamptz,
  p_actor_user_id uuid, p_correlation_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare v_quote_id uuid; v_now timestamptz := statement_timestamp();
begin
  perform public.assert_story_10_8_quote_reviewer(p_tenant_id, p_actor_user_id);
  select quote_id into v_quote_id from public.quote_versions where id = p_quote_version_id
    and tenant_id = p_tenant_id and pdf_status = 'generating' and pdf_render_file_id = p_expected_file_id
    and pdf_render_correlation_id = p_correlation_id for update;
  if not found then raise exception 'quote PDF failure target is stale or unauthorized' using errcode = 'PFD10'; end if;
  update public.file_links set archived_at = coalesce(archived_at, v_now)
    where file_id = p_expected_file_id and tenant_id = p_tenant_id and archived_at is null;
  update public.files set lifecycle_state = 'archived', archived_at = coalesce(archived_at, v_now)
    where id = p_expected_file_id and tenant_id = p_tenant_id and lifecycle_state <> 'archived';
  update public.quote_versions set pdf_status = 'failed' where id = p_quote_version_id and tenant_id = p_tenant_id;
  insert into public.quote_events (tenant_id, quote_id, quote_version_id, event_type, occurred_at)
    values (p_tenant_id, v_quote_id, p_quote_version_id, 'pdf_failed', v_now);
  perform public.record_audit_event(p_tenant_id, p_actor_user_id, 'quote.pdf.render.fail',
    'quote.pdf.failed', 'quote_version', p_quote_version_id, p_correlation_id, '{}'::jsonb, v_now);
end;
$$;

revoke execute on function public.start_quote_pdf_render(uuid, uuid, uuid, uuid, timestamptz, text),
  public.complete_quote_pdf_render(uuid, uuid, uuid, timestamptz, uuid, uuid, text, text, text, text),
  public.fail_quote_pdf_render(uuid, uuid, uuid, timestamptz, uuid, uuid) from public, anon, service_role;
grant execute on function public.start_quote_pdf_render(uuid, uuid, uuid, uuid, timestamptz, text),
  public.complete_quote_pdf_render(uuid, uuid, uuid, timestamptz, uuid, uuid, text, text, text, text),
  public.fail_quote_pdf_render(uuid, uuid, uuid, timestamptz, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Final-send byte attestation. Story 10.8's one-time review authorization is
-- deliberately still a separate, non-HMAC authority. This Story 10.9 proof
-- binds a short-lived server signature to the exact current private PDF bytes:
-- the request-bound server downloads and hashes the object, signs the canonical
-- database-issued metadata, and this transaction re-verifies it through Vault
-- immediately before consuming review authority and recording the commitment.
-- ---------------------------------------------------------------------------
create or replace function public.prepare_quote_pdf_send_attestation(
  p_tenant_id uuid,
  p_quote_version_id uuid,
  p_actor_user_id uuid,
  p_correlation_id uuid,
  p_attestation_key_id text
) returns table (
  file_id uuid,
  content_fingerprint text,
  bucket_id text,
  object_path text,
  checksum_sha256 text,
  size_bytes bigint,
  mime_type text,
  attestation_key_id text,
  attestation_issued_at text,
  attestation_expires_at text,
  generation_started_at text
)
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := statement_timestamp();
begin
  perform public.assert_story_10_8_quote_reviewer(p_tenant_id, p_actor_user_id);
  perform public.quote_pdf_attestation_vault_secret(p_attestation_key_id);
  perform public.assert_quote_pdf_current_for_send(p_quote_version_id);

  return query
  select qv.pdf_file_id,
         qv.pdf_content_fingerprint,
         f.bucket_id,
         f.object_path,
         f.checksum,
         f.size_bytes,
         f.mime_type,
         p_attestation_key_id,
         public.quote_pdf_attestation_iso(v_now),
         public.quote_pdf_attestation_iso(v_now + interval '5 minutes'),
         public.quote_pdf_attestation_iso(qv.pdf_generated_at)
    from public.quote_versions qv
    join public.files f
      on f.id = qv.pdf_file_id
     and f.tenant_id = qv.tenant_id
   where qv.id = p_quote_version_id
     and qv.tenant_id = p_tenant_id
     and qv.status = 'draft'
     and qv.pdf_status = 'generated'
     and qv.pdf_generated_at is not null
     and f.artifact_kind = 'quote_pdf'
     and f.lifecycle_state in ('linked', 'locked')
     and f.archived_at is null;

  if not found then
    raise exception 'current PDF send attestation could not be prepared' using errcode = 'PFD10';
  end if;
end;
$$;

create or replace function public.assert_quote_pdf_send_attestation(
  p_tenant_id uuid,
  p_quote_version_id uuid,
  p_actor_user_id uuid,
  p_correlation_id uuid,
  p_attestation_key_id text,
  p_attestation_issued_at text,
  p_attestation_expires_at text,
  p_attestation_signature text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_file_id uuid;
  v_fingerprint text;
  v_generated_at timestamptz;
  v_bucket text;
  v_path text;
  v_checksum text;
  v_size bigint;
  v_mime text;
  v_issued timestamptz;
  v_expires timestamptz;
  v_secret text;
  v_expected_signature text;
  v_now timestamptz := statement_timestamp();
begin
  perform public.assert_story_10_8_quote_reviewer(p_tenant_id, p_actor_user_id);
  perform public.assert_quote_pdf_current_for_send(p_quote_version_id);

  begin
    v_issued := p_attestation_issued_at::timestamptz;
    v_expires := p_attestation_expires_at::timestamptz;
  exception when others then
    raise exception 'quote PDF send attestation is invalid' using errcode = 'PFD10';
  end;

  select qv.pdf_file_id, qv.pdf_content_fingerprint, qv.pdf_generated_at,
         f.bucket_id, f.object_path, f.checksum, f.size_bytes, f.mime_type
    into v_file_id, v_fingerprint, v_generated_at,
         v_bucket, v_path, v_checksum, v_size, v_mime
    from public.quote_versions qv
    join public.files f
      on f.id = qv.pdf_file_id
     and f.tenant_id = qv.tenant_id
   where qv.id = p_quote_version_id
     and qv.tenant_id = p_tenant_id
     and qv.status = 'draft'
     and qv.pdf_status = 'generated'
     and qv.pdf_generated_at is not null
     and f.artifact_kind = 'quote_pdf'
     and f.lifecycle_state in ('linked', 'locked')
     and f.archived_at is null
   for update of qv, f;

  if not found
     or p_attestation_issued_at is distinct from public.quote_pdf_attestation_iso(v_issued)
     or p_attestation_expires_at is distinct from public.quote_pdf_attestation_iso(v_expires)
     or v_issued > v_now
     or v_expires <= v_now
     or v_expires is distinct from v_issued + interval '5 minutes'
     or p_attestation_signature is null
     or p_attestation_signature !~ '^[0-9a-f]{64}$' then
    raise exception 'quote PDF send attestation is invalid' using errcode = 'PFD10';
  end if;

  perform public.assert_quote_pdf_storage_object(p_tenant_id, v_file_id);
  v_secret := public.quote_pdf_attestation_vault_secret(p_attestation_key_id);
  v_expected_signature := encode(extensions.hmac(public.quote_pdf_attestation_payload(
    p_tenant_id, p_actor_user_id, p_quote_version_id, v_file_id, v_fingerprint,
    v_bucket, v_path, v_checksum, v_size, v_mime, p_correlation_id,
    p_attestation_key_id, v_issued, v_expires, v_generated_at
  ), convert_to(v_secret, 'UTF8'), 'sha256'), 'hex');

  if v_expected_signature is distinct from p_attestation_signature then
    raise exception 'quote PDF send attestation is invalid' using errcode = 'PFD10';
  end if;
end;
$$;

-- Replace Story 10.8's compatible transition wrapper with the Story 10.9
-- attested signature. The internal lifecycle function remains non-executable.
drop function if exists public.mark_quote_version_sent(
  uuid, uuid, uuid, timestamptz, text, text, uuid, uuid
);
create or replace function public.mark_quote_version_sent(
  p_tenant_id uuid,
  p_quote_version_id uuid,
  p_authorization_id uuid,
  p_sent_at timestamptz,
  p_channel text,
  p_reference text,
  p_actor_user_id uuid,
  p_correlation_id uuid,
  p_attestation_key_id text,
  p_attestation_issued_at text,
  p_attestation_expires_at text,
  p_attestation_signature text
) returns table (quote_version_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  a public.quote_review_authorizations%rowtype;
  v_status text;
  v_recorded_at timestamptz := statement_timestamp();
begin
  perform public.assert_story_10_8_quote_reviewer(p_tenant_id, p_actor_user_id);
  select * into a
    from public.quote_review_authorizations qra
   where qra.id = p_authorization_id
   for update;
  if not found or a.tenant_id <> p_tenant_id or a.actor_user_id <> p_actor_user_id
     or a.purpose <> 'final_send' or a.target_quote_version_id <> p_quote_version_id
     or a.consumed_at is not null or a.expires_at <= statement_timestamp()
     or a.correlation_id <> p_correlation_id then
    raise exception 'invalid or expired quote review authorization' using errcode = 'QV401';
  end if;

  select qv.status into v_status
    from public.quote_versions qv
   where qv.tenant_id = p_tenant_id and qv.id = p_quote_version_id
   for update;
  if not found then raise exception 'send target missing' using errcode = 'QV409'; end if;
  if v_status <> 'draft' then raise exception 'send target is not draft' using errcode = 'QV409'; end if;
  if public.story_10_8_quote_version_source_revision(p_tenant_id, p_quote_version_id)
       is distinct from a.source_revision then
    raise exception 'quote review authorization source changed' using errcode = 'QV401';
  end if;

  perform public.assert_quote_pdf_send_attestation(
    p_tenant_id, p_quote_version_id, p_actor_user_id, p_correlation_id,
    p_attestation_key_id, p_attestation_issued_at, p_attestation_expires_at,
    p_attestation_signature
  );

  -- p_sent_at is retained for PostgREST/client compatibility only. Lifecycle
  -- and audit evidence use the database-owned statement timestamp.
  perform * from public.story_10_8_mark_quote_version_sent_internal(
    p_tenant_id, p_quote_version_id, v_recorded_at, p_channel, p_reference
  );
  update public.quote_review_authorizations
     set consumed_at = statement_timestamp(), consumed_target_id = p_quote_version_id
   where id = a.id;
  perform public.record_audit_event(
    p_tenant_id, p_actor_user_id, 'quote.version.mark_sent', 'quote.version.sent',
    'quote_version', p_quote_version_id, p_correlation_id, '{}'::jsonb, v_recorded_at
  );
  return query select p_quote_version_id;
end;
$$;

revoke execute on function public.prepare_quote_pdf_send_attestation(uuid, uuid, uuid, uuid, text)
  from public, anon, service_role;
grant execute on function public.prepare_quote_pdf_send_attestation(uuid, uuid, uuid, uuid, text)
  to authenticated;
revoke execute on function public.assert_quote_pdf_send_attestation(uuid, uuid, uuid, uuid, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.mark_quote_version_sent(uuid, uuid, uuid, timestamptz, text, text, uuid, uuid, text, text, text, text)
  from public, anon, service_role;
grant execute on function public.mark_quote_version_sent(uuid, uuid, uuid, timestamptz, text, text, uuid, uuid, text, text, text, text)
  to authenticated;

comment on function public.prepare_quote_pdf_send_attestation(uuid, uuid, uuid, uuid, text) is
  'Story 10.9 server-only send challenge. Returns only current immutable quote-PDF metadata plus a DB-issued five-minute signing window; never returns review authority, a signature, or Vault secret material.';
comment on function public.assert_quote_pdf_send_attestation(uuid, uuid, uuid, uuid, text, text, text, text) is
  'Story 10.9 private final-send verifier. Reconstructs the canonical current quote-PDF payload and verifies its HMAC-SHA256 through Vault immediately before commitment.';
comment on function public.mark_quote_version_sent(uuid, uuid, uuid, timestamptz, text, text, uuid, uuid, text, text, text, text) is
  'Story 10.8 one-time non-HMAC review authority consumption plus Story 10.9 server-only current-PDF byte attestation, lifecycle transition, event, and accountable audit in one transaction. Caller timestamps are ignored as evidence.';
