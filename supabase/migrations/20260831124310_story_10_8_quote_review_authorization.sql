-- Story 10.8: attributable quote review authorizations and atomic quote provenance.
--
-- The authorization is an authenticated tenant-admin self-attestation to the exact
-- server-validated payload/source facts. It is deliberately not evidence that the
-- actor visually read every field. Authorizations expire after 15 minutes, are
-- one-time, and are invalidated by any source-row change before consumption.

create table if not exists public.quote_review_authorizations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  purpose text not null check (
    purpose in ('initial_creation', 'successor_creation', 'final_send')
  ),
  calculation_id uuid,
  quote_id uuid,
  source_quote_version_id uuid,
  target_quote_version_id uuid,
  customer_id uuid,
  facility_id uuid,
  contact_id uuid,
  captured_at timestamptz,
  snapshot_payload jsonb,
  lines_payload jsonb,
  attachments_payload jsonb,
  reviewed_quote_capture_date date,
  reviewed_calculation_status text,
  reviewed_readiness_rows jsonb,
  supersede_prior boolean,
  source_revision jsonb not null,
  correlation_id uuid not null,
  issued_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_target_id uuid,
  constraint quote_review_authorizations_expiry_exact
    check (expires_at = issued_at + interval '15 minutes'),
  constraint quote_review_authorizations_consumption_pair
    check ((consumed_at is null) = (consumed_target_id is null)),
  constraint quote_review_authorizations_purpose_shape check (
    (purpose = 'initial_creation'
      and calculation_id is not null and quote_id is null
      and source_quote_version_id is null and target_quote_version_id is null
      and customer_id is not null and captured_at is not null
      and snapshot_payload is not null and lines_payload is not null
      and attachments_payload is not null
      and reviewed_quote_capture_date is not null
      and reviewed_calculation_status is not null
      and reviewed_readiness_rows is not null
      and supersede_prior is null)
    or
    (purpose = 'successor_creation'
      and calculation_id is not null and quote_id is not null
      and source_quote_version_id is not null and target_quote_version_id is null
      and customer_id is not null and captured_at is not null
      and snapshot_payload is not null and lines_payload is not null
      and attachments_payload is not null
      and reviewed_quote_capture_date is null
      and reviewed_calculation_status is null
      and reviewed_readiness_rows is null
      and supersede_prior is not null)
    or
    (purpose = 'final_send'
      and calculation_id is null and quote_id is not null
      and source_quote_version_id is null and target_quote_version_id is not null
      and customer_id is null and facility_id is null and contact_id is null
      and captured_at is null and snapshot_payload is null
      and lines_payload is null and attachments_payload is null
      and reviewed_quote_capture_date is null
      and reviewed_calculation_status is null
      and reviewed_readiness_rows is null and supersede_prior is null)
  )
);

comment on table public.quote_review_authorizations is
  'Tenant-owned, short-lived quote-review self-attestations. The authenticated actor attests to the exact server-validated payload/source facts; no claim of visual-reading proof is made. Each row is valid for exactly 15 minutes, source-change invalidated and one-time consumed. Historical quote V1/V2 rows require no backfill.';

create index if not exists quote_review_authorizations_tenant_actor_idx
  on public.quote_review_authorizations (tenant_id, actor_user_id, issued_at desc);

create or replace function public.enforce_quote_review_authorization_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.consumed_at is not null
     or new.consumed_at is null
     or new.consumed_target_id is null
     or (to_jsonb(new) - array['consumed_at', 'consumed_target_id'])
        is distinct from
        (to_jsonb(old) - array['consumed_at', 'consumed_target_id']) then
    raise exception 'quote review authorization is immutable and one-time'
      using errcode = 'QV401';
  end if;
  return new;
end;
$$;

drop trigger if exists quote_review_authorizations_immutable
  on public.quote_review_authorizations;
create trigger quote_review_authorizations_immutable
  before update on public.quote_review_authorizations
  for each row execute function public.enforce_quote_review_authorization_immutability();

alter table public.quote_review_authorizations enable row level security;
alter table public.quote_review_authorizations force row level security;

drop policy if exists quote_review_authorizations_select_own_tenant
  on public.quote_review_authorizations;
create policy quote_review_authorizations_select_own_tenant
  on public.quote_review_authorizations
  for select to authenticated
  using (public.is_tenant_admin(tenant_id));

revoke all on table public.quote_review_authorizations from public, anon, authenticated, service_role;
grant select on table public.quote_review_authorizations to authenticated;
grant select, insert on table public.quote_review_authorizations to service_role;

-- Kept private so a future capability-based reviewer predicate can replace the
-- temporary tenant_admin decision without changing every authority consumer.
create or replace function public.assert_story_10_8_quote_reviewer(
  p_tenant_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null
     or auth.uid() is distinct from p_actor_user_id
     or not public.is_tenant_admin(p_tenant_id) then
    raise exception 'quote review authority denied'
      using errcode = '42501';
  end if;
end;
$$;

-- Canonical revision hashes whole persisted source rows inside PostgreSQL; the raw
-- customer/calculation/file rows (which can include PII or internal-only fields) are
-- never duplicated into the authorization table. The existing 10.6 assertions lock
-- and compare the exact customer-visible payload, while timestamps inside this
-- server-owned SHA-256 input make change-then-revert detectable.
create or replace function public.story_10_8_calculation_source_revision(
  p_tenant_id uuid,
  p_calculation_id uuid,
  p_customer_id uuid,
  p_facility_id uuid,
  p_contact_id uuid,
  p_attachments jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
set timezone = 'UTC'
as $$
  select jsonb_build_object('sourceHash', encode(sha256(convert_to(jsonb_build_object(
    'calculation', (select to_jsonb(c) from public.calculations c
      where c.tenant_id = p_tenant_id and c.id = p_calculation_id),
    'sections', coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order, s.id)
      from public.calculation_sections s
      where s.tenant_id = p_tenant_id and s.calculation_id = p_calculation_id), '[]'::jsonb),
    'rows', coalesce((select jsonb_agg(to_jsonb(r) order by s.sort_order, r.sort_order, r.id)
      from public.calculation_rows r
      join public.calculation_sections s
        on s.tenant_id = r.tenant_id and s.id = r.section_id
      where r.tenant_id = p_tenant_id and s.calculation_id = p_calculation_id), '[]'::jsonb),
    'customer', (select to_jsonb(cu) - 'personnummer' from public.customers cu
      where cu.tenant_id = p_tenant_id and cu.id = p_customer_id),
    'facility', (select to_jsonb(fa) from public.facilities fa
      where fa.tenant_id = p_tenant_id and fa.id = p_facility_id),
    'contact', (select to_jsonb(co) from public.contacts co
      where co.tenant_id = p_tenant_id and co.id = p_contact_id),
    'companySettings', (select to_jsonb(cs) from public.company_settings cs
      where cs.tenant_id = p_tenant_id),
    'quoteTerms', (select to_jsonb(qt) from public.quote_terms qt
      where qt.tenant_id = p_tenant_id),
    'attachmentFiles', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.id)
      from public.files f
      where f.tenant_id = p_tenant_id
        and f.id in (
          select fl.file_id from public.file_links fl
          where fl.tenant_id = p_tenant_id
            and fl.owner_type = 'calculation'
            and fl.owner_id = p_calculation_id
            and fl.purpose = 'calculation_attachment'
        )
    ), '[]'::jsonb),
    'attachmentLinks', coalesce((
      select jsonb_agg(to_jsonb(fl) order by fl.id)
      from public.file_links fl
      where fl.tenant_id = p_tenant_id
        and fl.owner_type = 'calculation'
        and fl.owner_id = p_calculation_id
        and fl.purpose = 'calculation_attachment'
    ), '[]'::jsonb)
  )::text, 'UTF8')), 'hex'));
$$;

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
    'links', coalesce((select jsonb_agg(to_jsonb(fl) order by fl.id)
      from public.file_links fl where fl.tenant_id = p_tenant_id
        and fl.owner_type = 'quote_version' and fl.owner_id = p_quote_version_id), '[]'::jsonb)
  )::text, 'UTF8')), 'hex'));
$$;

revoke execute on function public.assert_story_10_8_quote_reviewer(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.story_10_8_calculation_source_revision(uuid, uuid, uuid, uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.story_10_8_quote_version_source_revision(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.authorize_quote_initial_review(
  p_tenant_id uuid,
  p_calculation_id uuid,
  p_captured_at timestamptz,
  p_customer_id uuid,
  p_facility_id uuid,
  p_contact_id uuid,
  p_snapshot jsonb,
  p_lines jsonb,
  p_attachments jsonb,
  p_reviewed_quote_capture_date date,
  p_reviewed_calculation_status text,
  p_reviewed_readiness_rows jsonb,
  p_actor_user_id uuid,
  p_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_id uuid;
  v_issued_at timestamptz := statement_timestamp();
  v_tax_input jsonb;
begin
  perform public.assert_story_10_8_quote_reviewer(p_tenant_id, p_actor_user_id);
  perform public.assert_story_10_6_line_sources(p_tenant_id, p_calculation_id, p_lines);
  select c.tax_input_snapshot into v_tax_input from public.calculations c
   where c.tenant_id = p_tenant_id and c.id = p_calculation_id for share;
  if not found then raise exception 'calculation source missing' using errcode = 'QV409'; end if;
  perform public.assert_story_10_6_fresh_quote_v2(
    p_snapshot, p_lines, v_tax_input,
    (p_captured_at at time zone 'Europe/Stockholm')::date
  );
  perform public.assert_story_10_6_reviewed_source(
    p_tenant_id, p_calculation_id, p_customer_id, p_facility_id, p_contact_id,
    p_snapshot, p_attachments, repeat('0', 64), p_reviewed_quote_capture_date,
    p_reviewed_calculation_status, p_reviewed_readiness_rows,
    (p_captured_at at time zone 'Europe/Stockholm')::date
  );
  insert into public.quote_review_authorizations (
    tenant_id, actor_user_id, purpose, calculation_id, customer_id, facility_id,
    contact_id, captured_at, snapshot_payload, lines_payload, attachments_payload,
    reviewed_quote_capture_date, reviewed_calculation_status,
    reviewed_readiness_rows, source_revision, correlation_id, issued_at, expires_at
  ) values (
    p_tenant_id, p_actor_user_id, 'initial_creation', p_calculation_id, p_customer_id,
    p_facility_id, p_contact_id, p_captured_at, p_snapshot, p_lines, p_attachments,
    p_reviewed_quote_capture_date, p_reviewed_calculation_status,
    p_reviewed_readiness_rows,
    public.story_10_8_calculation_source_revision(
      p_tenant_id, p_calculation_id, p_customer_id, p_facility_id, p_contact_id, p_attachments
    ),
    p_correlation_id, v_issued_at, v_issued_at + interval '15 minutes'
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.authorize_quote_successor_review(
  p_tenant_id uuid,
  p_quote_id uuid,
  p_source_quote_version_id uuid,
  p_calculation_id uuid,
  p_captured_at timestamptz,
  p_customer_id uuid,
  p_facility_id uuid,
  p_contact_id uuid,
  p_snapshot jsonb,
  p_lines jsonb,
  p_attachments jsonb,
  p_supersede_prior boolean,
  p_actor_user_id uuid,
  p_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_id uuid;
  v_issued_at timestamptz := statement_timestamp();
  v_tax_input jsonb;
  v_revision jsonb;
  v_source_calculation_id uuid;
begin
  perform public.assert_story_10_8_quote_reviewer(p_tenant_id, p_actor_user_id);
  -- Keep the shared quote-version lock first so successor review follows the
  -- same quote-version -> calculation lock order as successor creation.
  select qv.calculation_id into v_source_calculation_id
    from public.quote_versions qv
   where qv.tenant_id = p_tenant_id and qv.id = p_source_quote_version_id
     and qv.quote_id = p_quote_id
   for share;
  if not found then raise exception 'successor source missing' using errcode = 'QV409'; end if;
  if v_source_calculation_id is distinct from p_calculation_id then
    raise exception 'successor calculation must match the source quote version'
      using errcode = '23514';
  end if;
  perform public.assert_story_10_6_line_sources(p_tenant_id, p_calculation_id, p_lines);
  select c.tax_input_snapshot into v_tax_input from public.calculations c
   where c.tenant_id = p_tenant_id and c.id = p_calculation_id for share;
  if not found then raise exception 'calculation source missing' using errcode = 'QV409'; end if;
  perform public.assert_story_10_6_fresh_quote_v2(
    p_snapshot, p_lines, v_tax_input,
    (p_captured_at at time zone 'Europe/Stockholm')::date
  );
  perform public.assert_story_10_6_snapshot_sources(
    p_tenant_id, p_calculation_id, p_customer_id, p_facility_id, p_contact_id,
    p_snapshot, p_attachments
  );
  v_revision := public.story_10_8_calculation_source_revision(
    p_tenant_id, p_calculation_id, p_customer_id, p_facility_id, p_contact_id, p_attachments
  ) || jsonb_build_object('sourceQuoteVersionHash', (
    select encode(sha256(convert_to(to_jsonb(qv)::text, 'UTF8')), 'hex')
      from public.quote_versions qv
     where qv.tenant_id = p_tenant_id and qv.id = p_source_quote_version_id
  ));
  insert into public.quote_review_authorizations (
    tenant_id, actor_user_id, purpose, calculation_id, quote_id,
    source_quote_version_id, customer_id, facility_id, contact_id, captured_at,
    snapshot_payload, lines_payload, attachments_payload, supersede_prior,
    source_revision, correlation_id, issued_at, expires_at
  ) values (
    p_tenant_id, p_actor_user_id, 'successor_creation', p_calculation_id, p_quote_id,
    p_source_quote_version_id, p_customer_id, p_facility_id, p_contact_id, p_captured_at,
    p_snapshot, p_lines, p_attachments, p_supersede_prior, v_revision,
    p_correlation_id, v_issued_at, v_issued_at + interval '15 minutes'
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.authorize_quote_final_send(
  p_tenant_id uuid,
  p_quote_version_id uuid,
  p_actor_user_id uuid,
  p_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_quote_id uuid;
  v_status text;
  v_issued_at timestamptz := statement_timestamp();
begin
  perform public.assert_story_10_8_quote_reviewer(p_tenant_id, p_actor_user_id);
  select qv.quote_id, qv.status into v_quote_id, v_status
    from public.quote_versions qv
   where qv.tenant_id = p_tenant_id and qv.id = p_quote_version_id for share;
  if not found then raise exception 'send source missing' using errcode = 'QV409'; end if;
  if v_status <> 'draft' then raise exception 'send source is not draft' using errcode = 'QV409'; end if;
  insert into public.quote_review_authorizations (
    tenant_id, actor_user_id, purpose, quote_id, target_quote_version_id,
    source_revision, correlation_id, issued_at, expires_at
  ) values (
    p_tenant_id, p_actor_user_id, 'final_send', v_quote_id, p_quote_version_id,
    public.story_10_8_quote_version_source_revision(p_tenant_id, p_quote_version_id),
    p_correlation_id, v_issued_at, v_issued_at + interval '15 minutes'
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.authorize_quote_initial_review(uuid, uuid, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb, date, text, jsonb, uuid, uuid) from public, anon;
grant execute on function public.authorize_quote_initial_review(uuid, uuid, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb, date, text, jsonb, uuid, uuid) to authenticated;
revoke execute on function public.authorize_quote_successor_review(uuid, uuid, uuid, uuid, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb, boolean, uuid, uuid) from public, anon;
grant execute on function public.authorize_quote_successor_review(uuid, uuid, uuid, uuid, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb, boolean, uuid, uuid) to authenticated;
revoke execute on function public.authorize_quote_final_send(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.authorize_quote_final_send(uuid, uuid, uuid, uuid) to authenticated;

-- Remove the client-payload overloads from PostgREST. The renamed functions retain
-- the byte-compatible V1/V2 storage implementation but are callable only by the
-- checked SECURITY DEFINER wrappers below.
-- Each rename occurs only on the first application. A replay must find the exact
-- internal routine already present; any missing or conflicted pair is an invalid
-- schema state and fails loudly instead of silently routing wrappers incorrectly.
do $$
begin
  if to_regprocedure('public.create_quote_version_from_calculation(uuid,uuid,timestamptz,uuid,uuid,uuid,jsonb,jsonb,jsonb,text,date,text,jsonb)') is not null
     and to_regprocedure('public.story_10_8_create_quote_version_internal(uuid,uuid,timestamptz,uuid,uuid,uuid,jsonb,jsonb,jsonb,text,date,text,jsonb)') is null then
    execute 'alter function public.create_quote_version_from_calculation(uuid,uuid,timestamptz,uuid,uuid,uuid,jsonb,jsonb,jsonb,text,date,text,jsonb) rename to story_10_8_create_quote_version_internal';
  elsif to_regprocedure('public.create_quote_version_from_calculation(uuid,uuid,timestamptz,uuid,uuid,uuid,jsonb,jsonb,jsonb,text,date,text,jsonb)') is null
     and to_regprocedure('public.story_10_8_create_quote_version_internal(uuid,uuid,timestamptz,uuid,uuid,uuid,jsonb,jsonb,jsonb,text,date,text,jsonb)') is not null then
    null;
  else
    raise exception 'Story 10.8 invalid rename state: create_quote_version_from_calculation'
      using errcode = '55000';
  end if;

  if to_regprocedure('public.create_new_quote_version(uuid,uuid,uuid,uuid,timestamptz,uuid,uuid,uuid,jsonb,jsonb,jsonb,boolean)') is not null
     and to_regprocedure('public.story_10_8_create_new_quote_version_internal(uuid,uuid,uuid,uuid,timestamptz,uuid,uuid,uuid,jsonb,jsonb,jsonb,boolean)') is null then
    execute 'alter function public.create_new_quote_version(uuid,uuid,uuid,uuid,timestamptz,uuid,uuid,uuid,jsonb,jsonb,jsonb,boolean) rename to story_10_8_create_new_quote_version_internal';
  elsif to_regprocedure('public.create_new_quote_version(uuid,uuid,uuid,uuid,timestamptz,uuid,uuid,uuid,jsonb,jsonb,jsonb,boolean)') is null
     and to_regprocedure('public.story_10_8_create_new_quote_version_internal(uuid,uuid,uuid,uuid,timestamptz,uuid,uuid,uuid,jsonb,jsonb,jsonb,boolean)') is not null then
    null;
  else
    raise exception 'Story 10.8 invalid rename state: create_new_quote_version'
      using errcode = '55000';
  end if;

  if to_regprocedure('public.mark_quote_version_sent(uuid,uuid,timestamptz,text,text)') is not null
     and to_regprocedure('public.story_10_8_mark_quote_version_sent_internal(uuid,uuid,timestamptz,text,text)') is null then
    execute 'alter function public.mark_quote_version_sent(uuid,uuid,timestamptz,text,text) rename to story_10_8_mark_quote_version_sent_internal';
  elsif to_regprocedure('public.mark_quote_version_sent(uuid,uuid,timestamptz,text,text)') is null
     and to_regprocedure('public.story_10_8_mark_quote_version_sent_internal(uuid,uuid,timestamptz,text,text)') is not null then
    null;
  else
    raise exception 'Story 10.8 invalid rename state: mark_quote_version_sent'
      using errcode = '55000';
  end if;

  if to_regprocedure('public.mark_quote_version_lifecycle(uuid,uuid,text,timestamptz)') is not null
     and to_regprocedure('public.story_10_8_mark_quote_version_lifecycle_internal(uuid,uuid,text,timestamptz)') is null then
    execute 'alter function public.mark_quote_version_lifecycle(uuid,uuid,text,timestamptz) rename to story_10_8_mark_quote_version_lifecycle_internal';
  elsif to_regprocedure('public.mark_quote_version_lifecycle(uuid,uuid,text,timestamptz)') is null
     and to_regprocedure('public.story_10_8_mark_quote_version_lifecycle_internal(uuid,uuid,text,timestamptz)') is not null then
    null;
  else
    raise exception 'Story 10.8 invalid rename state: mark_quote_version_lifecycle'
      using errcode = '55000';
  end if;

  if to_regprocedure('public.mark_quote_version_lost(uuid,uuid,text,text,text,timestamptz)') is not null
     and to_regprocedure('public.story_10_8_mark_quote_version_lost_internal(uuid,uuid,text,text,text,timestamptz)') is null then
    execute 'alter function public.mark_quote_version_lost(uuid,uuid,text,text,text,timestamptz) rename to story_10_8_mark_quote_version_lost_internal';
  elsif to_regprocedure('public.mark_quote_version_lost(uuid,uuid,text,text,text,timestamptz)') is null
     and to_regprocedure('public.story_10_8_mark_quote_version_lost_internal(uuid,uuid,text,text,text,timestamptz)') is not null then
    null;
  else
    raise exception 'Story 10.8 invalid rename state: mark_quote_version_lost'
      using errcode = '55000';
  end if;

  if to_regprocedure('public.accept_quote_and_create_job(uuid,uuid,timestamptz,bigint,bigint,text,text,uuid,text,text,date,date,text,text)') is not null
     and to_regprocedure('public.story_10_8_accept_quote_and_create_job_internal(uuid,uuid,timestamptz,bigint,bigint,text,text,uuid,text,text,date,date,text,text)') is null then
    execute 'alter function public.accept_quote_and_create_job(uuid,uuid,timestamptz,bigint,bigint,text,text,uuid,text,text,date,date,text,text) rename to story_10_8_accept_quote_and_create_job_internal';
  elsif to_regprocedure('public.accept_quote_and_create_job(uuid,uuid,timestamptz,bigint,bigint,text,text,uuid,text,text,date,date,text,text)') is null
     and to_regprocedure('public.story_10_8_accept_quote_and_create_job_internal(uuid,uuid,timestamptz,bigint,bigint,text,text,uuid,text,text,date,date,text,text)') is not null then
    null;
  else
    raise exception 'Story 10.8 invalid rename state: accept_quote_and_create_job'
      using errcode = '55000';
  end if;
end;
$$;

revoke execute on function public.story_10_8_create_quote_version_internal(uuid, uuid, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb, text, date, text, jsonb) from public, anon, authenticated, service_role;
revoke execute on function public.story_10_8_create_new_quote_version_internal(uuid, uuid, uuid, uuid, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb, boolean) from public, anon, authenticated, service_role;
revoke execute on function public.story_10_8_mark_quote_version_sent_internal(uuid, uuid, timestamptz, text, text) from public, anon, authenticated, service_role;
revoke execute on function public.story_10_8_mark_quote_version_lifecycle_internal(uuid, uuid, text, timestamptz) from public, anon, authenticated, service_role;
revoke execute on function public.story_10_8_mark_quote_version_lost_internal(uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated, service_role;
revoke execute on function public.story_10_8_accept_quote_and_create_job_internal(uuid, uuid, timestamptz, bigint, bigint, text, text, uuid, text, text, date, date, text, text) from public, anon, authenticated, service_role;

-- The original audit helper predates the attributable quote wrappers and accepts a
-- command-clock argument.  That value is not evidence: authenticated callers can
-- invoke an executable SECURITY DEFINER function directly.  Keep its signature for
-- every existing command, but make the persisted creation time transaction-owned.
create or replace function public.record_audit_event(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_command text,
  p_event_type text,
  p_target_type text,
  p_target_id uuid,
  p_correlation_id uuid,
  p_metadata jsonb,
  p_created_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_created_at timestamptz := statement_timestamp();
begin
  if auth.uid() is null or auth.uid() <> p_actor_user_id then
    raise exception 'record_audit_event: actor must match the authenticated caller'
      using errcode = 'insufficient_privilege';
  end if;

  if not public.is_active_tenant_member(p_tenant_id) then
    raise exception 'record_audit_event: caller is not an active member of the target tenant'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.audit_events (
    tenant_id, actor_user_id, command, event_type, target_type, target_id,
    correlation_id, metadata, created_at
  ) values (
    p_tenant_id, p_actor_user_id, p_command, p_event_type, p_target_type, p_target_id,
    p_correlation_id, coalesce(p_metadata, '{}'::jsonb), v_created_at
  ) returning id into v_id;

  return v_id;
end;
$$;

comment on function public.record_audit_event(uuid, uuid, text, text, text, uuid, uuid, jsonb, timestamptz) is
  'Privileged append-only audit write. The actor must equal auth.uid() and be an active member of the target tenant. The legacy p_created_at parameter is retained for RPC compatibility but deliberately ignored: audit creation time is database-owned via statement_timestamp(). SECURITY DEFINER with fixed empty search_path.';

revoke execute on function public.record_audit_event(uuid, uuid, text, text, text, uuid, uuid, jsonb, timestamptz)
  from public, anon, service_role;
grant execute on function public.record_audit_event(uuid, uuid, text, text, text, uuid, uuid, jsonb, timestamptz)
  to authenticated;

create or replace function public.create_quote_version_from_calculation(
  p_tenant_id uuid,
  p_authorization_id uuid,
  p_captured_at timestamptz,
  p_actor_user_id uuid,
  p_correlation_id uuid
)
returns table (quote_id uuid, quote_version_id uuid, quote_number bigint)
language plpgsql security definer set search_path = ''
as $$
declare
  a public.quote_review_authorizations%rowtype;
  v_revision jsonb;
  v_quote_id uuid;
  v_version_id uuid;
  v_quote_number bigint;
  v_recorded_at timestamptz := statement_timestamp();
begin
  perform public.assert_story_10_8_quote_reviewer(p_tenant_id, p_actor_user_id);
  select * into a from public.quote_review_authorizations qra
   where qra.id = p_authorization_id for update;
  if not found or a.tenant_id <> p_tenant_id or a.actor_user_id <> p_actor_user_id
     or a.purpose <> 'initial_creation' or a.consumed_at is not null
     or a.expires_at <= statement_timestamp() or a.captured_at is distinct from p_captured_at
     or a.correlation_id <> p_correlation_id then
    raise exception 'invalid or expired quote review authorization' using errcode = 'QV401';
  end if;
  perform public.assert_story_10_6_line_sources(a.tenant_id, a.calculation_id, a.lines_payload);
  perform public.assert_story_10_6_reviewed_source(
    a.tenant_id, a.calculation_id, a.customer_id, a.facility_id, a.contact_id,
    a.snapshot_payload, a.attachments_payload, repeat('0', 64),
    a.reviewed_quote_capture_date, a.reviewed_calculation_status,
    a.reviewed_readiness_rows, (a.captured_at at time zone 'Europe/Stockholm')::date
  );
  v_revision := public.story_10_8_calculation_source_revision(
    a.tenant_id, a.calculation_id, a.customer_id, a.facility_id, a.contact_id, a.attachments_payload
  );
  if v_revision is distinct from a.source_revision then
    raise exception 'quote review authorization source changed' using errcode = 'QV401';
  end if;
  select x.quote_id, x.quote_version_id, x.quote_number
    into v_quote_id, v_version_id, v_quote_number
    from public.story_10_8_create_quote_version_internal(
      -- captured_at is the attested snapshot-capture fact, not a lifecycle/audit
      -- creation timestamp. The legacy internal validates it against the reviewed
      -- V2 snapshot capture date, so preserve this already-bound authorization value.
      a.tenant_id, a.calculation_id, a.captured_at, a.customer_id, a.facility_id,
      a.contact_id, a.snapshot_payload, a.lines_payload, a.attachments_payload,
      repeat('0', 64), a.reviewed_quote_capture_date,
      a.reviewed_calculation_status, a.reviewed_readiness_rows
    ) x;
  update public.quote_review_authorizations set consumed_at = statement_timestamp(),
    consumed_target_id = v_version_id where id = a.id;
  perform public.record_audit_event(
    p_tenant_id, p_actor_user_id, 'quote.version.create', 'quote.version.created',
    'quote_version', v_version_id, p_correlation_id, '{}'::jsonb, v_recorded_at
  );
  return query select v_quote_id, v_version_id, v_quote_number;
end;
$$;

create or replace function public.create_new_quote_version(
  p_tenant_id uuid,
  p_authorization_id uuid,
  p_captured_at timestamptz,
  p_actor_user_id uuid,
  p_correlation_id uuid
)
returns table (quote_version_id uuid, version_number bigint)
language plpgsql security definer set search_path = ''
set timezone = 'UTC'
as $$
declare
  a public.quote_review_authorizations%rowtype;
  v_revision jsonb;
  v_version_id uuid;
  v_version_number bigint;
  v_recorded_at timestamptz := statement_timestamp();
begin
  perform public.assert_story_10_8_quote_reviewer(p_tenant_id, p_actor_user_id);
  select * into a from public.quote_review_authorizations qra
   where qra.id = p_authorization_id for update;
  if not found or a.tenant_id <> p_tenant_id or a.actor_user_id <> p_actor_user_id
     or a.purpose <> 'successor_creation' or a.consumed_at is not null
     or a.expires_at <= statement_timestamp() or a.captured_at is distinct from p_captured_at
     or a.correlation_id <> p_correlation_id then
    raise exception 'invalid or expired quote review authorization' using errcode = 'QV401';
  end if;

  -- Serialize successor consumption on the same parent quote before revalidating
  -- its source. The legacy writer takes this same lock, so the winning request
  -- creates the next version and commits before a concurrent loser continues.
  perform 1
    from public.quotes q
   where q.tenant_id = a.tenant_id
     and q.id = a.quote_id
   for update;
  if not found then
    raise exception 'successor parent quote missing' using errcode = 'QV409';
  end if;

  -- A successor must branch from the latest version. Re-check this only after
  -- taking the parent lock: if another reviewed request already created v+1,
  -- this authorization's source is now stale and must not create v+2. Keep this
  -- distinct from QV401 below, which still signals changed reviewed source facts.
  perform 1
    from public.quote_versions source_qv
   where source_qv.tenant_id = a.tenant_id
     and source_qv.quote_id = a.quote_id
     and source_qv.id = a.source_quote_version_id
     and not exists (
       select 1
         from public.quote_versions newer_qv
        where newer_qv.tenant_id = source_qv.tenant_id
          and newer_qv.quote_id = source_qv.quote_id
          and newer_qv.version_number > source_qv.version_number
     )
   for update of source_qv;
  if not found then
    raise exception 'successor source is stale' using errcode = 'QV409';
  end if;

  perform public.assert_story_10_6_line_sources(a.tenant_id, a.calculation_id, a.lines_payload);
  perform public.assert_story_10_6_snapshot_sources(
    a.tenant_id, a.calculation_id, a.customer_id, a.facility_id, a.contact_id,
    a.snapshot_payload, a.attachments_payload
  );
  v_revision := public.story_10_8_calculation_source_revision(
    a.tenant_id, a.calculation_id, a.customer_id, a.facility_id, a.contact_id, a.attachments_payload
  ) || jsonb_build_object('sourceQuoteVersionHash', (
    select encode(sha256(convert_to(to_jsonb(qv)::text, 'UTF8')), 'hex')
      from public.quote_versions qv
     where qv.tenant_id = a.tenant_id and qv.id = a.source_quote_version_id
  ));
  if v_revision is distinct from a.source_revision then
    raise exception 'quote review authorization source changed' using errcode = 'QV401';
  end if;
  select x.quote_version_id, x.version_number into v_version_id, v_version_number
    from public.story_10_8_create_new_quote_version_internal(
      a.tenant_id, a.quote_id, a.source_quote_version_id, a.calculation_id,
      a.captured_at, a.customer_id, a.facility_id, a.contact_id,
      a.snapshot_payload, a.lines_payload, a.attachments_payload, a.supersede_prior
    ) x;
  update public.quote_review_authorizations set consumed_at = statement_timestamp(),
    consumed_target_id = v_version_id where id = a.id;
  perform public.record_audit_event(
    p_tenant_id, p_actor_user_id, 'quote.version.new', 'quote.version.created',
    'quote_version', v_version_id, p_correlation_id, '{}'::jsonb, v_recorded_at
  );
  return query select v_version_id, v_version_number;
end;
$$;

create or replace function public.mark_quote_version_sent(
  p_tenant_id uuid,
  p_quote_version_id uuid,
  p_authorization_id uuid,
  p_sent_at timestamptz,
  p_channel text,
  p_reference text,
  p_actor_user_id uuid,
  p_correlation_id uuid
)
returns table (quote_version_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  a public.quote_review_authorizations%rowtype;
  v_status text;
  v_recorded_at timestamptz := statement_timestamp();
begin
  perform public.assert_story_10_8_quote_reviewer(p_tenant_id, p_actor_user_id);
  select * into a from public.quote_review_authorizations qra
   where qra.id = p_authorization_id for update;
  if not found or a.tenant_id <> p_tenant_id or a.actor_user_id <> p_actor_user_id
     or a.purpose <> 'final_send' or a.target_quote_version_id <> p_quote_version_id
     or a.consumed_at is not null or a.expires_at <= statement_timestamp()
     or a.correlation_id <> p_correlation_id then
    raise exception 'invalid or expired quote review authorization' using errcode = 'QV401';
  end if;
  select qv.status into v_status from public.quote_versions qv
   where qv.tenant_id = p_tenant_id and qv.id = p_quote_version_id for update;
  if not found then raise exception 'send target missing' using errcode = 'QV409'; end if;
  if v_status <> 'draft' then raise exception 'send target is not draft' using errcode = 'QV409'; end if;
  if public.story_10_8_quote_version_source_revision(p_tenant_id, p_quote_version_id)
       is distinct from a.source_revision then
    raise exception 'quote review authorization source changed' using errcode = 'QV401';
  end if;
  -- Defined by the immediately-following Story 10.9 migration. PL/pgSQL resolves
  -- the dependency at execution, after the full migration chain is installed.
  perform public.assert_quote_pdf_current_for_send(p_quote_version_id);
  -- p_sent_at is intentionally retained for PostgREST/client compatibility, but
  -- a caller-provided timestamp is not lifecycle evidence.
  perform * from public.story_10_8_mark_quote_version_sent_internal(
    p_tenant_id, p_quote_version_id, v_recorded_at, p_channel, p_reference
  );
  update public.quote_review_authorizations set consumed_at = statement_timestamp(),
    consumed_target_id = p_quote_version_id where id = a.id;
  perform public.record_audit_event(
    p_tenant_id, p_actor_user_id, 'quote.version.mark_sent', 'quote.version.sent',
    'quote_version', p_quote_version_id, p_correlation_id, '{}'::jsonb, v_recorded_at
  );
  return query select p_quote_version_id;
end;
$$;

create or replace function public.mark_quote_version_lifecycle(
  p_tenant_id uuid, p_quote_version_id uuid, p_transition text,
  p_occurred_at timestamptz, p_actor_user_id uuid, p_correlation_id uuid
)
returns table (quote_version_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  v_recorded_at timestamptz := statement_timestamp();
begin
  perform public.assert_story_10_8_quote_reviewer(p_tenant_id, p_actor_user_id);
  -- Retained only for compatible RPC signatures; lifecycle evidence is DB-owned.
  perform * from public.story_10_8_mark_quote_version_lifecycle_internal(
    p_tenant_id, p_quote_version_id, p_transition, v_recorded_at
  );
  perform public.record_audit_event(
    p_tenant_id, p_actor_user_id, 'quote.version.lifecycle', 'quote.version.lifecycle',
    'quote_version', p_quote_version_id, p_correlation_id, '{}'::jsonb, v_recorded_at
  );
  return query select p_quote_version_id;
end;
$$;

create or replace function public.mark_quote_version_lost(
  p_tenant_id uuid, p_quote_version_id uuid, p_outcome text, p_category text,
  p_note text, p_occurred_at timestamptz, p_actor_user_id uuid, p_correlation_id uuid
)
returns table (quote_version_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  v_recorded_at timestamptz := statement_timestamp();
begin
  perform public.assert_story_10_8_quote_reviewer(p_tenant_id, p_actor_user_id);
  -- Retained only for compatible RPC signatures; lifecycle evidence is DB-owned.
  perform * from public.story_10_8_mark_quote_version_lost_internal(
    p_tenant_id, p_quote_version_id, p_outcome, p_category, p_note, v_recorded_at
  );
  perform public.record_audit_event(
    p_tenant_id, p_actor_user_id, 'quote.version.lost', 'quote.version.lost',
    'quote_version', p_quote_version_id, p_correlation_id, '{}'::jsonb, v_recorded_at
  );
  return query select p_quote_version_id;
end;
$$;

create or replace function public.accept_quote_and_create_job(
  p_tenant_id uuid, p_quote_version_id uuid, p_accepted_at timestamptz,
  p_accepted_price_ore bigint, p_source_sent_total_ore bigint, p_channel text,
  p_adjustment_reason text, p_evidence_file_id uuid, p_evidence_reference text,
  p_notes text, p_planned_start_date date, p_planned_end_date date, p_title text,
  p_fault_inject text, p_actor_user_id uuid, p_correlation_id uuid
)
returns table (acceptance_id uuid, job_id uuid, was_existing boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_acceptance_id uuid;
  v_job_id uuid;
  v_was_existing boolean;
  v_recorded_at timestamptz := statement_timestamp();
begin
  perform public.assert_story_10_8_quote_reviewer(p_tenant_id, p_actor_user_id);
  -- accepted_at is an explicit customer/evidence fact, unlike the audit/event
  -- creation time. A future acceptance is not plausible; historical acceptance
  -- remains supported for delayed entry and migration-compatible workflows.
  if p_accepted_at > v_recorded_at then
    raise exception 'accepted_at cannot be in the future' using errcode = '23514';
  end if;
  if p_evidence_file_id is not null and p_evidence_reference is not null then
    raise exception 'acceptance evidence must use a file or an external reference, not both'
      using errcode = '23514';
  end if;
  select x.acceptance_id, x.job_id, x.was_existing
    into v_acceptance_id, v_job_id, v_was_existing
    from public.story_10_8_accept_quote_and_create_job_internal(
      p_tenant_id, p_quote_version_id, p_accepted_at, p_accepted_price_ore,
      p_source_sent_total_ore, p_channel, p_adjustment_reason, p_evidence_file_id,
      p_evidence_reference, p_notes, p_planned_start_date, p_planned_end_date,
      p_title, p_fault_inject
    ) x;
  if not v_was_existing then
    perform public.record_audit_event(
      p_tenant_id, p_actor_user_id, 'quote.acceptance.accept_and_create_job',
      'quote.acceptance.accepted_and_job_created', 'quote_acceptance',
      v_acceptance_id, p_correlation_id, '{}'::jsonb, v_recorded_at
    );
  end if;
  return query select v_acceptance_id, v_job_id, v_was_existing;
end;
$$;

create or replace function public.update_draft_quote_version(
  p_tenant_id uuid, p_quote_version_id uuid, p_patch jsonb,
  p_occurred_at timestamptz, p_actor_user_id uuid, p_correlation_id uuid
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_status text;
  v_recorded_at timestamptz := statement_timestamp();
begin
  perform public.assert_story_10_8_quote_reviewer(p_tenant_id, p_actor_user_id);
  if p_patch is null or jsonb_typeof(p_patch) <> 'object'
     or (p_patch - array['intro_text', 'customer_notes', 'valid_until', 'display_mode']) <> '{}'::jsonb
     or p_patch = '{}'::jsonb then
    raise exception 'invalid draft patch' using errcode = '23514';
  end if;
  if p_patch ? 'display_mode'
     and p_patch ->> 'display_mode' is not null
     and p_patch ->> 'display_mode' not in ('detailed', 'summary', 'text_only') then
    raise exception 'invalid display mode' using errcode = '23514';
  end if;
  -- Keep the direct RPC boundary in lockstep with validation.ts: free-text
  -- values are nullable strings, and 5,000 characters is inclusive.
  if (p_patch ? 'intro_text'
        and jsonb_typeof(p_patch -> 'intro_text') not in ('string', 'null'))
     or (p_patch ? 'customer_notes'
        and jsonb_typeof(p_patch -> 'customer_notes') not in ('string', 'null'))
     or (p_patch ? 'intro_text' and length(p_patch ->> 'intro_text') > 5000)
     or (p_patch ? 'customer_notes' and length(p_patch ->> 'customer_notes') > 5000) then
    raise exception 'invalid draft text' using errcode = '23514';
  end if;
  select qv.status into v_status from public.quote_versions qv
   where qv.tenant_id = p_tenant_id and qv.id = p_quote_version_id for update;
  if not found then raise exception 'draft target missing' using errcode = '42501'; end if;
  if v_status <> 'draft' then raise exception 'draft target is locked' using errcode = 'QV409'; end if;
  update public.quote_versions qv set
    intro_text = case when p_patch ? 'intro_text' then p_patch ->> 'intro_text' else qv.intro_text end,
    customer_notes = case when p_patch ? 'customer_notes' then p_patch ->> 'customer_notes' else qv.customer_notes end,
    valid_until = case when p_patch ? 'valid_until' then (p_patch ->> 'valid_until')::timestamptz else qv.valid_until end,
    display_mode = case when p_patch ? 'display_mode' then p_patch ->> 'display_mode' else qv.display_mode end
   where qv.tenant_id = p_tenant_id and qv.id = p_quote_version_id;
  perform public.record_audit_event(
    p_tenant_id, p_actor_user_id, 'quote.version.update_draft',
    'quote.version.draft_updated', 'quote_version', p_quote_version_id,
    p_correlation_id, '{}'::jsonb, v_recorded_at
  );
  return p_quote_version_id;
end;
$$;

-- Only the narrow, attributable functions remain executable by the app role.
revoke execute on function public.create_quote_version_from_calculation(uuid, uuid, timestamptz, uuid, uuid) from public, anon;
grant execute on function public.create_quote_version_from_calculation(uuid, uuid, timestamptz, uuid, uuid) to authenticated;
revoke execute on function public.create_new_quote_version(uuid, uuid, timestamptz, uuid, uuid) from public, anon;
grant execute on function public.create_new_quote_version(uuid, uuid, timestamptz, uuid, uuid) to authenticated;
revoke execute on function public.mark_quote_version_sent(uuid, uuid, uuid, timestamptz, text, text, uuid, uuid) from public, anon;
grant execute on function public.mark_quote_version_sent(uuid, uuid, uuid, timestamptz, text, text, uuid, uuid) to authenticated;
revoke execute on function public.mark_quote_version_lifecycle(uuid, uuid, text, timestamptz, uuid, uuid) from public, anon;
grant execute on function public.mark_quote_version_lifecycle(uuid, uuid, text, timestamptz, uuid, uuid) to authenticated;
revoke execute on function public.mark_quote_version_lost(uuid, uuid, text, text, text, timestamptz, uuid, uuid) from public, anon;
grant execute on function public.mark_quote_version_lost(uuid, uuid, text, text, text, timestamptz, uuid, uuid) to authenticated;
revoke execute on function public.accept_quote_and_create_job(uuid, uuid, timestamptz, bigint, bigint, text, text, uuid, text, text, date, date, text, text, uuid, uuid) from public, anon;
grant execute on function public.accept_quote_and_create_job(uuid, uuid, timestamptz, bigint, bigint, text, text, uuid, text, text, date, date, text, text, uuid, uuid) to authenticated;
revoke execute on function public.update_draft_quote_version(uuid, uuid, jsonb, timestamptz, uuid, uuid) from public, anon;
grant execute on function public.update_draft_quote_version(uuid, uuid, jsonb, timestamptz, uuid, uuid) to authenticated;

-- Provenance-sensitive quote lifecycle rows can no longer be written directly by
-- an authenticated same-tenant user. SELECT/RLS remains unchanged. Story 10.9's
-- PDF start/complete/fail functions are SECURITY DEFINER and remain compatible.
revoke insert, update, delete on table public.tenant_counters from authenticated;
revoke insert, update, delete on table public.quotes from authenticated;
revoke insert, update, delete on table public.quote_versions from authenticated;
revoke insert, update, delete on table public.quote_version_lines from authenticated;
revoke insert, update, delete on table public.quote_version_attachments from authenticated;
revoke insert, update, delete on table public.quote_events from authenticated;
revoke insert, update, delete on table public.quote_lost_reasons from authenticated;
revoke insert, update, delete on table public.quote_acceptances from authenticated;

-- Acceptance evidence is a single immutable capture fact. Older records may have been created
-- before this correction, so the check is NOT VALID for those historical rows while PostgreSQL
-- still enforces it for every new INSERT/UPDATE from this migration onward.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'quote_acceptances_one_evidence_form'
       and conrelid = 'public.quote_acceptances'::regclass
  ) then
    alter table public.quote_acceptances
      add constraint quote_acceptances_one_evidence_form
      check (num_nonnulls(evidence_file_id, evidence_reference) <= 1) not valid;
  end if;
end;
$$;

-- A quote acceptance has no draft phase. Its evidence link may be created exactly once as the
-- materialization of its already-captured evidence_file_id; it may never be appended, repointed,
-- or deleted afterwards. This trigger sorts before the generic file-link lock so evidence attacks
-- return the stable accepted-record lock code (AR704) rather than a generic file-link outcome.
create or replace function public.enforce_quote_acceptance_evidence_link_lock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_evidence_file_id uuid;
  v_evidence_reference text;
  v_existing_link boolean;
begin
  if tg_op = 'DELETE' then
    if old.owner_type = 'quote_acceptance' and old.purpose = 'acceptance_evidence' then
      raise exception 'acceptance evidence is immutable once accepted'
        using errcode = 'AR704';
    end if;
    return old;
  end if;

  if new.owner_type <> 'quote_acceptance' or new.purpose <> 'acceptance_evidence' then
    return new;
  end if;

  -- Serialize the entire duplicate-check transaction without requiring UPDATE privilege on the
  -- immutable acceptance row. A concurrent inserter resumes only after the first link commits,
  -- then observes that link below. Hash collisions only over-serialize unrelated acceptances.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('quote_acceptance_evidence:' || new.owner_id::text, 0)
  );
  select qa.evidence_file_id, qa.evidence_reference
    into v_evidence_file_id, v_evidence_reference
    from public.quote_acceptances qa
   where qa.id = new.owner_id and qa.tenant_id = new.tenant_id;
  if not found
     or v_evidence_file_id is null
     or v_evidence_reference is not null
     or v_evidence_file_id is distinct from new.file_id then
    raise exception 'acceptance evidence does not match the immutable acceptance capture'
      using errcode = 'AR704';
  end if;

  if tg_op = 'INSERT' then
    select exists(
      select 1 from public.file_links fl
       where fl.tenant_id = new.tenant_id
         and fl.owner_type = 'quote_acceptance'
         and fl.owner_id = new.owner_id
         and fl.purpose = 'acceptance_evidence'
    ) into v_existing_link;
    if v_existing_link then
      raise exception 'acceptance evidence cannot be appended after acceptance'
        using errcode = 'AR704';
    end if;
  elsif row(new.file_id, new.owner_type, new.owner_id, new.purpose, new.tenant_id)
      is distinct from row(old.file_id, old.owner_type, old.owner_id, old.purpose, old.tenant_id) then
    raise exception 'acceptance evidence cannot be relinked after acceptance'
      using errcode = 'AR704';
  end if;
  return new;
end;
$$;

drop trigger if exists file_links_0_acceptance_evidence_record_lock on public.file_links;
create trigger file_links_0_acceptance_evidence_record_lock
  before insert or update or delete on public.file_links
  for each row execute function public.enforce_quote_acceptance_evidence_link_lock();
