-- Story 11.2: the SQL mirror of the N-4 seed in
-- src/server/authz/permission-matrix.ts. PostgreSQL cannot import TypeScript;
-- the policy-to-matrix integration suite is the deliberate drift detector.
--
-- Phase A's carried calculation rows contain inline cost/markup and its files
-- lack job-member owner scope. Those modules are closed for Säljare/Montör at
-- the matrix as well as the RLS floor; do not turn either into tenant-wide
-- access until their later companion/assignment schemas exist.

-- Every authenticated member may resolve its own membership and child roles.
-- Tenant administrators retain their existing same-tenant membership visibility.
alter policy tenants_select_own on public.tenants
  using (public.is_active_tenant_member(id));

alter policy tenant_memberships_select_own on public.tenant_memberships
  using (
    (
      user_id = (select auth.uid())
      and status = 'active'
    )
    or public.has_tenant_role(tenant_id, array['tenant_admin']::text[])
  );

alter policy membership_roles_select_own on public.membership_roles
  using (
    exists (
      select 1
      from public.tenant_memberships m
      where m.id = membership_id
        and m.tenant_id = tenant_id
        and m.user_id = (select auth.uid())
    )
    or public.has_tenant_role(tenant_id, array['tenant_admin']::text[])
  );

-- CRM: the N-4 Säljare/Projektledare customer surface is safe at row level.
do $$
declare
  tbl text;
begin
  foreach tbl in array array['customers', 'facilities', 'contacts'] loop
    execute format(
      'alter policy %I on public.%I using (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'', ''saljare'']::text[]))',
      tbl || '_select_own', tbl
    );
    execute format(
      'alter policy %I on public.%I with check (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'', ''saljare'']::text[]))',
      tbl || '_insert_own', tbl
    );
    execute format(
      'alter policy %I on public.%I using (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'', ''saljare'']::text[])) with check (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'', ''saljare'']::text[]))',
      tbl || '_update_own', tbl
    );
  end loop;
end;
$$;

-- Project managers retain calculation/pricing access because they are entitled
-- to the inline cost data. Säljare intentionally is not included.
do $$
declare
  tbl text;
begin
  foreach tbl in array array['work_roles', 'articles', 'calculations', 'calculation_sections', 'calculation_rows'] loop
    execute format(
      'alter policy %I on public.%I using (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'']::text[]))',
      tbl || '_select_own', tbl
    );
    execute format(
      'alter policy %I on public.%I with check (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'']::text[]))',
      tbl || '_insert_own', tbl
    );
    execute format(
      'alter policy %I on public.%I using (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'']::text[])) with check (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'']::text[]))',
      tbl || '_update_own', tbl
    );
  end loop;
end;
$$;

-- Settings remain administrator-only, while the inline-rate pricing tables are
-- available to Projektledare.  Their rows carry cost data, so Säljare is
-- deliberately excluded rather than relying on a response projection.
do $$
declare
  tbl text;
begin
  foreach tbl in array array['company_settings', 'quote_terms'] loop
    execute format(
      'alter policy %I on public.%I using (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'']::text[]))',
      tbl || '_select_own', tbl
    );
    execute format(
      'alter policy %I on public.%I with check (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'']::text[]))',
      tbl || '_insert_own', tbl
    );
    execute format(
      'alter policy %I on public.%I using (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'']::text[])) with check (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'']::text[]))',
      tbl || '_update_own', tbl
    );
  end loop;

  foreach tbl in array array['work_roles', 'articles'] loop
    execute format(
      'alter policy %I on public.%I using (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'']::text[]))',
      tbl || '_select_own', tbl
    );
    execute format(
      'alter policy %I on public.%I with check (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'']::text[]))',
      tbl || '_insert_own', tbl
    );
    execute format(
      'alter policy %I on public.%I using (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'']::text[])) with check (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'']::text[]))',
      tbl || '_update_own', tbl
    );
  end loop;
end;
$$;

-- Quote snapshots are customer-facing and contain no cost/margin columns.
-- Sales therefore gets the N-4 quote scope, while review-authorisation material
-- remains administrator-only under its existing hardened wrapper.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'tenant_counters', 'quotes', 'quote_versions', 'quote_version_lines',
    'quote_version_attachments', 'quote_events', 'quote_acceptances',
    'quote_lost_reasons', 'quote_follow_ups'
  ] loop
    execute format(
      'alter policy %I on public.%I using (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'', ''saljare'']::text[]))',
      tbl || '_select_own', tbl
    );
    execute format(
      'alter policy %I on public.%I with check (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'', ''saljare'']::text[]))',
      tbl || '_insert_own', tbl
    );
    if tbl not in ('quote_lost_reasons') then
      execute format(
        'alter policy %I on public.%I using (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'', ''saljare'']::text[])) with check (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'', ''saljare'']::text[]))',
        tbl || '_update_own', tbl
      );
    end if;
  end loop;
end;
$$;

-- No job_members exists in Phase A: only the explicit ViewAll roles can read
-- or mutate jobs. Files have the same tenant-wide closure until owner scope is
-- represented, so Projectledare is the only non-admin Phase A file role.
do $$
declare
  tbl text;
begin
  foreach tbl in array array['jobs', 'job_events', 'files', 'file_links'] loop
    execute format(
      'alter policy %I on public.%I using (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'']::text[]))',
      tbl || '_select_own', tbl
    );
    execute format(
      'alter policy %I on public.%I with check (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'']::text[]))',
      tbl || '_insert_own', tbl
    );
    execute format(
      'alter policy %I on public.%I using (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'']::text[])) with check (public.is_tenant_admin(tenant_id) or public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'']::text[]))',
      tbl || '_update_own', tbl
    );
  end loop;
end;
$$;

-- Storage is independent of metadata RLS. Keep the same Phase A closure on
-- object reads/writes, including the malformed-path denial guard.
alter policy tenant_files_objects_select_own on storage.objects
  using (
    bucket_id = 'tenant-files'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and (
      public.is_tenant_admin(((storage.foldername(name))[1])::uuid)
      or public.has_tenant_role(((storage.foldername(name))[1])::uuid, array['tenant_admin', 'projektledare']::text[])
    )
  );
alter policy tenant_files_objects_insert_own on storage.objects
  with check (
    bucket_id = 'tenant-files'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and (
      public.is_tenant_admin(((storage.foldername(name))[1])::uuid)
      or public.has_tenant_role(((storage.foldername(name))[1])::uuid, array['tenant_admin', 'projektledare']::text[])
    )
  );
alter policy tenant_files_objects_update_own on storage.objects
  using (
    bucket_id = 'tenant-files'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and (
      public.is_tenant_admin(((storage.foldername(name))[1])::uuid)
      or public.has_tenant_role(((storage.foldername(name))[1])::uuid, array['tenant_admin', 'projektledare']::text[])
    )
    and not exists (
      select 1 from public.files f
       where f.bucket_id = storage.objects.bucket_id
         and f.object_path = storage.objects.name
    )
  )
  with check (
    bucket_id = 'tenant-files'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and (
      public.is_tenant_admin(((storage.foldername(name))[1])::uuid)
      or public.has_tenant_role(((storage.foldername(name))[1])::uuid, array['tenant_admin', 'projektledare']::text[])
    )
    and not exists (
      select 1 from public.files f
       where f.bucket_id = storage.objects.bucket_id
         and f.object_path = storage.objects.name
    )
  );

-- Story 10.9's durable PDF discriminator remains closed to ordinary file
-- creation after the role-aware file policy evolution above.
alter policy files_insert_own on public.files
  with check (
    artifact_kind is null
    and (
      public.is_tenant_admin(tenant_id)
      or public.has_tenant_role(tenant_id, array['tenant_admin', 'projektledare']::text[])
    )
  );

-- ---------------------------------------------------------------------------
-- Audited non-admin mutation pattern
-- ---------------------------------------------------------------------------
-- `record_audit_event` deliberately remains an authenticated, Admin-only RPC.
-- Widening it to every active member would let a caller forge an otherwise-valid
-- actor/command/target audit row without performing the command. Non-admin
-- mutations instead use checked, command-specific wrappers that own the domain
-- write and audit insert in one PostgreSQL transaction (the ADR-B008 precedent).
--
-- This internal writer is callable only by its owner. It is SECURITY INVOKER so
-- it gains audit-table INSERT authority only while nested inside one of those
-- checked SECURITY DEFINER wrappers. Keeping the primitive separate avoids
-- duplicating the actor/member checks and DB-owned timestamp discipline in each
-- wrapper without exposing a generic audit-write capability to the Data API.
create or replace function public.story_11_2_record_audit_event_internal(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_command text,
  p_event_type text,
  p_target_type text,
  p_target_id uuid,
  p_correlation_id uuid,
  p_metadata jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null
     or auth.uid() is distinct from p_actor_user_id
     or not public.is_active_tenant_member(p_tenant_id) then
    raise exception 'audited command actor denied'
      using errcode = '42501';
  end if;

  insert into public.audit_events (
    tenant_id, actor_user_id, command, event_type, target_type, target_id,
    correlation_id, metadata, created_at
  ) values (
    p_tenant_id, p_actor_user_id, p_command, p_event_type, p_target_type,
    p_target_id, p_correlation_id, coalesce(p_metadata, '{}'::jsonb),
    statement_timestamp()
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.story_11_2_record_audit_event_internal(
  uuid, uuid, text, text, text, uuid, uuid, jsonb
) from public, anon, authenticated, service_role;

comment on function public.story_11_2_record_audit_event_internal(
  uuid, uuid, text, text, text, uuid, uuid, jsonb
) is
  'Owner-only audit primitive for Story 11.2 checked command wrappers. SECURITY INVOKER with fixed empty search_path; verifies auth.uid/active membership and owns the DB timestamp. It is not a Data API endpoint and has no PUBLIC/anon/authenticated/service_role EXECUTE grant.';

-- Story 11.2 signed-file access audit recovery.
--
-- Add this fragment to 20260907171252_role_aware_phase_a_policy_evolution.sql
-- after story_11_2_record_audit_event_internal is created.  The Storage signing
-- request continues to run with the caller's authenticated RLS client.  These
-- functions only attest the successful server-side response and write the fixed
-- audit event; they never issue a URL and never expose the HMAC/Vault material.

create or replace function public.file_signed_access_attestation_iso(p_value timestamptz)
returns text
language sql
stable
security invoker
set search_path = ''
set timezone = 'UTC'
as $$
  select to_char(p_value at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

create or replace function public.file_signed_access_attestation_payload(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_file_id uuid,
  p_bucket_id text,
  p_object_path text,
  p_correlation_id uuid,
  p_signed_url_sha256 text,
  p_signed_url_expires_at timestamptz,
  p_attestation_key_id text,
  p_attestation_issued_at timestamptz,
  p_attestation_expires_at timestamptz
)
returns bytea
language sql
stable
security invoker
set search_path = ''
as $$
  select string_agg(
    convert_to(octet_length(convert_to(value, 'UTF8'))::text || ':', 'UTF8') ||
      convert_to(value, 'UTF8'),
    ''::bytea order by ordinality
  )
  from unnest(array[
    'elpro.file-signed-access.audit-attestation.v1',
    'file.signedAccess.create',
    'file.signed_access.created',
    'file',
    'record-success-after-storage-signing',
    p_tenant_id::text,
    p_actor_user_id::text,
    p_file_id::text,
    p_bucket_id,
    p_object_path,
    p_correlation_id::text,
    p_signed_url_sha256,
    public.file_signed_access_attestation_iso(p_signed_url_expires_at),
    p_attestation_key_id,
    public.file_signed_access_attestation_iso(p_attestation_issued_at),
    public.file_signed_access_attestation_iso(p_attestation_expires_at)
  ]) with ordinality as fields(value, ordinality)
$$;

-- The quote-PDF Vault secret is the already-sanctioned server attestation root.
-- Deriving a file-specific binary subkey gives this command cryptographic domain
-- separation without adding another production credential or Vault record.
create or replace function public.file_signed_access_attestation_derived_key(p_key_id text)
returns bytea
language sql
stable
security definer
set search_path = ''
as $$
  select extensions.hmac(
    convert_to('elpro.file-signed-access.audit-key.v1', 'UTF8'),
    convert_to(public.quote_pdf_attestation_vault_secret(p_key_id), 'UTF8'),
    'sha256'
  )
$$;

revoke execute on function public.file_signed_access_attestation_iso(timestamptz),
  public.file_signed_access_attestation_payload(
    uuid, uuid, uuid, text, text, uuid, text, timestamptz, text, timestamptz, timestamptz
  ),
  public.file_signed_access_attestation_derived_key(text)
from public, anon, authenticated, service_role;

create or replace function public.prepare_file_signed_access_audit_attestation(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_file_id uuid,
  p_correlation_id uuid,
  p_attestation_key_id text
)
returns table (
  bucket_id text,
  object_path text,
  attestation_key_id text,
  attestation_issued_at text,
  attestation_expires_at text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_bucket text;
  v_path text;
  v_lifecycle text;
  v_artifact_kind text;
begin
  if auth.uid() is null
     or auth.uid() is distinct from p_actor_user_id
     or p_tenant_id is null
     or p_file_id is null
     or p_correlation_id is null
     or not public.has_tenant_role(
       p_tenant_id,
       array['tenant_admin', 'projektledare']::text[]
     ) then
    raise exception 'file signed-access authority denied' using errcode = '42501';
  end if;

  -- Fail before Storage signing when the existing server/Vault attestation pair is
  -- missing, duplicated, malformed, or inaccessible.
  perform public.file_signed_access_attestation_derived_key(p_attestation_key_id);

  select f.bucket_id, f.object_path, f.lifecycle_state, f.artifact_kind
    into v_bucket, v_path, v_lifecycle, v_artifact_kind
    from public.files f
   where f.tenant_id = p_tenant_id
     and f.id = p_file_id
     and f.archived_at is null;

  if not found then
    raise exception 'file signed-access target denied' using errcode = '42501';
  end if;

  if v_bucket <> 'tenant-files'
     or v_lifecycle not in ('draft', 'linked', 'locked')
     or (v_artifact_kind = 'quote_pdf' and v_lifecycle = 'draft')
     or v_path is null
     or octet_length(convert_to(v_path, 'UTF8')) = 0
     or octet_length(convert_to(v_path, 'UTF8')) > 1024
     or split_part(v_path, '/', 1) <> p_tenant_id::text
     or split_part(v_path, '/', 2) <> p_file_id::text
     or split_part(v_path, '/', 3) = ''
     or v_path like '/%'
     or v_path like '%//%'
     or ('/' || v_path || '/') like '%/../%'
     or ('/' || v_path || '/') like '%/./%'
     or v_path ~ '[[:cntrl:]]'
     or not exists (
       select 1
         from storage.objects o
        where o.bucket_id = v_bucket
          and o.name = v_path
     ) then
    raise exception 'file signed-access target is ineligible' using errcode = 'FSA10';
  end if;

  return query select
    v_bucket,
    v_path,
    p_attestation_key_id,
    public.file_signed_access_attestation_iso(v_now),
    public.file_signed_access_attestation_iso(v_now + interval '5 minutes');
end;
$$;

create or replace function public.record_file_signed_access_audit_attested(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_file_id uuid,
  p_bucket_id text,
  p_object_path text,
  p_correlation_id uuid,
  p_signed_url_sha256 text,
  p_signed_url_expires_at text,
  p_attestation_key_id text,
  p_attestation_issued_at text,
  p_attestation_expires_at text,
  p_attestation_signature text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_bucket text;
  v_path text;
  v_lifecycle text;
  v_artifact_kind text;
  v_url_expires timestamptz;
  v_issued timestamptz;
  v_expires timestamptz;
  v_expected_signature text;
  v_audit_id uuid;
begin
  if auth.uid() is null
     or auth.uid() is distinct from p_actor_user_id
     or p_tenant_id is null
     or p_file_id is null
     or p_correlation_id is null
     or not public.has_tenant_role(
       p_tenant_id,
       array['tenant_admin', 'projektledare']::text[]
     ) then
    raise exception 'file signed-access authority denied' using errcode = '42501';
  end if;

  if p_signed_url_sha256 is null
     or p_signed_url_sha256 !~ '^[0-9a-f]{64}$'
     or p_attestation_key_id is null
     or p_attestation_key_id !~ '^[A-Za-z0-9_-]{1,64}$'
     or p_attestation_signature is null
     or p_attestation_signature !~ '^[0-9a-f]{64}$'
     or p_signed_url_expires_at is null
     or p_signed_url_expires_at !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
     or p_attestation_issued_at is null
     or p_attestation_issued_at !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
     or p_attestation_expires_at is null
     or p_attestation_expires_at !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$' then
    raise exception 'file signed-access attestation is invalid' using errcode = 'FSA10';
  end if;

  begin
    v_url_expires := p_signed_url_expires_at::timestamptz;
    v_issued := p_attestation_issued_at::timestamptz;
    v_expires := p_attestation_expires_at::timestamptz;
  exception when others then
    raise exception 'file signed-access attestation is invalid' using errcode = 'FSA10';
  end;

  if p_signed_url_expires_at is distinct from public.file_signed_access_attestation_iso(v_url_expires)
     or p_attestation_issued_at is distinct from public.file_signed_access_attestation_iso(v_issued)
     or p_attestation_expires_at is distinct from public.file_signed_access_attestation_iso(v_expires)
     or v_issued > v_now + interval '5 seconds'
     or v_expires is distinct from v_issued + interval '5 minutes'
     or v_expires <= v_now
     or v_url_expires <= v_now
     or v_url_expires <= v_issued
     or v_url_expires > v_issued + interval '24 hours 1 minute' then
    raise exception 'file signed-access attestation is expired or invalid' using errcode = 'FSA10';
  end if;

  select f.bucket_id, f.object_path, f.lifecycle_state, f.artifact_kind
    into v_bucket, v_path, v_lifecycle, v_artifact_kind
    from public.files f
   where f.tenant_id = p_tenant_id
     and f.id = p_file_id
     and f.archived_at is null
   for key share;

  if not found
     or v_bucket <> 'tenant-files'
     or v_lifecycle not in ('draft', 'linked', 'locked')
     or (v_artifact_kind = 'quote_pdf' and v_lifecycle = 'draft')
     or p_bucket_id is distinct from v_bucket
     or p_object_path is distinct from v_path
     or v_path is null
     or octet_length(convert_to(v_path, 'UTF8')) = 0
     or octet_length(convert_to(v_path, 'UTF8')) > 1024
     or split_part(v_path, '/', 1) <> p_tenant_id::text
     or split_part(v_path, '/', 2) <> p_file_id::text
     or split_part(v_path, '/', 3) = ''
     or v_path like '/%'
     or v_path like '%//%'
     or ('/' || v_path || '/') like '%/../%'
     or ('/' || v_path || '/') like '%/./%'
     or v_path ~ '[[:cntrl:]]'
     or not exists (
       select 1
         from storage.objects o
        where o.bucket_id = v_bucket
          and o.name = v_path
     ) then
    raise exception 'file signed-access target is ineligible' using errcode = 'FSA10';
  end if;

  v_expected_signature := encode(
    extensions.hmac(
      public.file_signed_access_attestation_payload(
        p_tenant_id,
        p_actor_user_id,
        p_file_id,
        v_bucket,
        v_path,
        p_correlation_id,
        p_signed_url_sha256,
        v_url_expires,
        p_attestation_key_id,
        v_issued,
        v_expires
      ),
      public.file_signed_access_attestation_derived_key(p_attestation_key_id),
      'sha256'
    ),
    'hex'
  );
  if v_expected_signature is distinct from p_attestation_signature then
    raise exception 'file signed-access attestation is invalid' using errcode = 'FSA10';
  end if;

  -- Serialise the exact proof identity, then reject an existing fixed event.  The
  -- action/event/target type are constants below, and the identity omits actor, so
  -- callers cannot replay by varying a user-selectable action or actor.  A fresh
  -- correlation denotes a fresh signing operation and therefore requires a fresh
  -- server attestation.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'elpro.file-signed-access.audit-replay.v1:' ||
        p_tenant_id::text || ':' || p_file_id::text || ':' || p_correlation_id::text,
      0
    )
  );
  if exists (
    select 1
      from public.audit_events ae
     where ae.tenant_id = p_tenant_id
       and ae.correlation_id = p_correlation_id
       and ae.command = 'file.signedAccess.create'
       and ae.event_type = 'file.signed_access.created'
       and ae.target_type = 'file'
       and ae.target_id = p_file_id
  ) then
    raise exception 'file signed-access attestation was already consumed' using errcode = 'FSA10';
  end if;

  v_audit_id := public.story_11_2_record_audit_event_internal(
    p_tenant_id,
    p_actor_user_id,
    'file.signedAccess.create',
    'file.signed_access.created',
    'file',
    p_file_id,
    p_correlation_id,
    '{}'::jsonb
  );
  return v_audit_id;
end;
$$;

revoke execute on function public.prepare_file_signed_access_audit_attestation(
  uuid, uuid, uuid, uuid, text
) from public, anon, service_role;
revoke execute on function public.record_file_signed_access_audit_attested(
  uuid, uuid, uuid, text, text, uuid, text, text, text, text, text, text
) from public, anon, service_role;
grant execute on function public.prepare_file_signed_access_audit_attestation(
  uuid, uuid, uuid, uuid, text
) to authenticated;
grant execute on function public.record_file_signed_access_audit_attested(
  uuid, uuid, uuid, text, text, uuid, text, text, text, text, text, text
) to authenticated;

comment on function public.prepare_file_signed_access_audit_attestation(
  uuid, uuid, uuid, uuid, text
) is
  'Authenticated Admin/Projektledare pre-signing challenge. Rechecks actor, tenant, file lifecycle/path, Storage-object existence, and the existing Vault attestation root before caller-RLS Storage signing. Read-only and emits no audit row.';
comment on function public.record_file_signed_access_audit_attested(
  uuid, uuid, uuid, text, text, uuid, text, text, text, text, text, text
) is
  'Authenticated Admin/Projektledare post-signing audit finalizer. Verifies a short-lived file-specific HMAC over the exact Storage URL hash/expiry and DB file identity, consumes the fixed tenant/file/correlation proof once, and writes only file.signedAccess.create/file.signed_access.created/file with empty metadata. It never accepts caller-selected audit semantics or a raw signed URL.';


-- First concrete caller: customer.create. The wrapper binds the N-4
-- Customers.Create role set, actor, tenant, command/event/target values and the
-- INSERT itself. A raw caller can supply customer fields, but cannot select a
-- different command, event, actor, target or tenant outside its role authority.
create or replace function public.create_customer_with_audit(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_correlation_id uuid,
  p_customer_type text,
  p_display_name text,
  p_personnummer text,
  p_org_nr text,
  p_contact_name text,
  p_email text,
  p_phone text,
  p_address_line1 text,
  p_address_line2 text,
  p_postal_code text,
  p_city text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
begin
  if auth.uid() is null
     or auth.uid() is distinct from p_actor_user_id
     or not public.has_tenant_role(
       p_tenant_id,
       array['tenant_admin', 'projektledare', 'saljare']::text[]
     ) then
    raise exception 'customer create authority denied'
      using errcode = '42501';
  end if;

  if p_correlation_id is null
     or p_customer_type is null
     or p_customer_type not in ('private', 'company', 'brf', 'public')
     or p_display_name is null
     or btrim(p_display_name) = ''
     or length(p_display_name) > 256
     or (p_customer_type = 'private' and (
       p_personnummer is null or btrim(p_personnummer) = ''
       or length(p_personnummer) > 256 or p_org_nr is not null
     ))
     or (p_customer_type <> 'private' and (
       p_org_nr is null or btrim(p_org_nr) = ''
       or length(p_org_nr) > 256 or p_personnummer is not null
     ))
     or (p_contact_name is not null and (p_contact_name = '' or length(p_contact_name) > 256))
     or (p_email is not null and (
       p_email = '' or length(p_email) > 256
       or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     ))
     or (p_phone is not null and (
       length(p_phone) < 5 or length(p_phone) > 32
       or p_phone !~ '^[+() 0-9-]+$'
     ))
     or (p_address_line1 is not null and (p_address_line1 = '' or length(p_address_line1) > 512))
     or (p_address_line2 is not null and (p_address_line2 = '' or length(p_address_line2) > 512))
     or (p_postal_code is not null and (p_postal_code = '' or length(p_postal_code) > 256))
     or (p_city is not null and (p_city = '' or length(p_city) > 256)) then
    raise exception 'invalid customer create payload'
      using errcode = '23514';
  end if;

  insert into public.customers (
    tenant_id, customer_type, display_name, personnummer, org_nr,
    contact_name, email, phone, address_line1, address_line2,
    postal_code, city
  ) values (
    p_tenant_id, p_customer_type, btrim(p_display_name), p_personnummer, p_org_nr,
    p_contact_name, p_email, p_phone, p_address_line1, p_address_line2,
    p_postal_code, p_city
  ) returning id into v_customer_id;

  perform public.story_11_2_record_audit_event_internal(
    p_tenant_id,
    p_actor_user_id,
    'customer.create',
    'customer.created',
    'customer',
    v_customer_id,
    p_correlation_id,
    '{}'::jsonb
  );

  return v_customer_id;
end;
$$;

revoke execute on function public.create_customer_with_audit(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text
) from public, anon, service_role;
grant execute on function public.create_customer_with_audit(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;

comment on function public.create_customer_with_audit(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text
) is
  'Story 11.2 checked Customers.Create wrapper. SECURITY DEFINER with fixed empty search_path; binds auth.uid, the matrix-authored role set, resolved tenant, customer insert and one DB-timestamped audit row in the same transaction.';

-- Command-specific quote wrappers cannot reuse Story 10.8's former broad
-- reviewer assertion: Quotes.Edit is available to Säljare while Quotes.Approve
-- is not.  This private assertion keeps that distinction in each wrapper.
create or replace function public.story_11_2_assert_quote_roles(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_allowed_roles text[]
) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null
     or auth.uid() is distinct from p_actor_user_id
     or p_allowed_roles is null
     or not public.has_tenant_role(p_tenant_id, p_allowed_roles) then
    raise exception 'quote command authority denied' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.story_11_2_assert_quote_roles(uuid, uuid, text[])
  from public, anon, authenticated, service_role;

-- Keep the established public RPC signatures so callers and review-authority
-- tokens remain compatible.  Only authority and the audit sink change.
create or replace function public.mark_quote_version_lifecycle(
  p_tenant_id uuid, p_quote_version_id uuid, p_transition text,
  p_occurred_at timestamptz, p_actor_user_id uuid, p_correlation_id uuid
) returns table (quote_version_id uuid)
language plpgsql security definer set search_path = '' as $$
declare v_recorded_at timestamptz := statement_timestamp();
begin
  perform public.story_11_2_assert_quote_roles(
    p_tenant_id, p_actor_user_id,
    array['tenant_admin', 'projektledare', 'saljare']::text[]
  );
  perform * from public.story_10_8_mark_quote_version_lifecycle_internal(
    p_tenant_id, p_quote_version_id, p_transition, v_recorded_at
  );
  perform public.story_11_2_record_audit_event_internal(
    p_tenant_id, p_actor_user_id, 'quote.version.lifecycle',
    'quote.version.lifecycle', 'quote_version', p_quote_version_id,
    p_correlation_id, '{}'::jsonb
  );
  return query select p_quote_version_id;
end;
$$;

create or replace function public.mark_quote_version_lost(
  p_tenant_id uuid, p_quote_version_id uuid, p_outcome text, p_category text,
  p_note text, p_occurred_at timestamptz, p_actor_user_id uuid, p_correlation_id uuid
) returns table (quote_version_id uuid)
language plpgsql security definer set search_path = '' as $$
declare v_recorded_at timestamptz := statement_timestamp();
begin
  perform public.story_11_2_assert_quote_roles(
    p_tenant_id, p_actor_user_id,
    array['tenant_admin', 'projektledare', 'saljare']::text[]
  );
  perform * from public.story_10_8_mark_quote_version_lost_internal(
    p_tenant_id, p_quote_version_id, p_outcome, p_category, p_note, v_recorded_at
  );
  perform public.story_11_2_record_audit_event_internal(
    p_tenant_id, p_actor_user_id, 'quote.version.lost',
    'quote.version.lost', 'quote_version', p_quote_version_id,
    p_correlation_id, '{}'::jsonb
  );
  return query select p_quote_version_id;
end;
$$;

create or replace function public.update_draft_quote_version(
  p_tenant_id uuid, p_quote_version_id uuid, p_patch jsonb,
  p_occurred_at timestamptz, p_actor_user_id uuid, p_correlation_id uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  perform public.story_11_2_assert_quote_roles(
    p_tenant_id, p_actor_user_id,
    array['tenant_admin', 'projektledare', 'saljare']::text[]
  );
  if p_patch is null or jsonb_typeof(p_patch) <> 'object'
     or (p_patch - array['intro_text', 'customer_notes', 'valid_until', 'display_mode']) <> '{}'::jsonb
     or p_patch = '{}'::jsonb then
    raise exception 'invalid draft patch' using errcode = '23514';
  end if;
  if p_patch ? 'display_mode' and p_patch ->> 'display_mode' is not null
     and p_patch ->> 'display_mode' not in ('detailed', 'summary', 'text_only') then
    raise exception 'invalid display mode' using errcode = '23514';
  end if;
  if (p_patch ? 'intro_text' and jsonb_typeof(p_patch -> 'intro_text') not in ('string', 'null'))
     or (p_patch ? 'customer_notes' and jsonb_typeof(p_patch -> 'customer_notes') not in ('string', 'null'))
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
  perform public.story_11_2_record_audit_event_internal(
    p_tenant_id, p_actor_user_id, 'quote.version.update_draft',
    'quote.version.draft_updated', 'quote_version', p_quote_version_id,
    p_correlation_id, '{}'::jsonb
  );
  return p_quote_version_id;
end;
$$;

create or replace function public.authorize_quote_final_send(
  p_tenant_id uuid, p_quote_version_id uuid, p_actor_user_id uuid, p_correlation_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_quote_id uuid; v_status text; v_issued_at timestamptz := statement_timestamp();
begin
  perform public.story_11_2_assert_quote_roles(p_tenant_id, p_actor_user_id,
    array['tenant_admin','projektledare','saljare']::text[]);
  select qv.quote_id, qv.status into v_quote_id, v_status from public.quote_versions qv
   where qv.tenant_id=p_tenant_id and qv.id=p_quote_version_id for share;
  if not found then raise exception 'send source missing' using errcode='QV409'; end if;
  if v_status <> 'draft' then raise exception 'send source is not draft' using errcode='QV409'; end if;
  insert into public.quote_review_authorizations (
    tenant_id,actor_user_id,purpose,quote_id,target_quote_version_id,source_revision,correlation_id,issued_at,expires_at
  ) values (
    p_tenant_id,p_actor_user_id,'final_send',v_quote_id,p_quote_version_id,
    public.story_10_8_quote_version_source_revision(p_tenant_id,p_quote_version_id),p_correlation_id,v_issued_at,v_issued_at+interval '15 minutes'
  ) returning id into v_id;
  return v_id;
end;
$$;

-- Once the command uses the wrapper, direct Data API INSERT would be an
-- unaudited bypass. UPDATE remains temporarily granted for the still-unmigrated
-- customer.update/archive paths and is explicitly part of the Phase-5 inventory.
revoke insert on table public.customers from authenticated;

-- Final send remains the existing one-time review and PDF-attestation transaction,
-- but it is now a Quotes.Send command rather than an implicit Admin-only path.
-- Keeping the complete wrapper here (rather than widening its former assertion)
-- makes the authorization and its non-forgeable audit sink explicit at this seam.
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
  perform public.story_11_2_assert_quote_roles(
    p_tenant_id, p_actor_user_id,
    array['tenant_admin', 'projektledare', 'saljare']::text[]
  );
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
  perform * from public.story_10_8_mark_quote_version_sent_internal(
    p_tenant_id, p_quote_version_id, v_recorded_at, p_channel, p_reference
  );
  update public.quote_review_authorizations
     set consumed_at = statement_timestamp(), consumed_target_id = p_quote_version_id
   where id = a.id;
  perform public.story_11_2_record_audit_event_internal(
    p_tenant_id, p_actor_user_id, 'quote.version.mark_sent', 'quote.version.sent',
    'quote_version', p_quote_version_id, p_correlation_id, '{}'::jsonb
  );
  return query select p_quote_version_id;
end;
$$;

-- Acceptance is a Quotes.Approve operation. Preserve the existing idempotent
-- acceptance/job transaction and its conditional audit (only a newly-created
-- acceptance is audited), while letting Projektledare use the approved path.
create or replace function public.accept_quote_and_create_job(
  p_tenant_id uuid, p_quote_version_id uuid, p_accepted_at timestamptz,
  p_accepted_price_ore bigint, p_source_sent_total_ore bigint, p_channel text,
  p_adjustment_reason text, p_evidence_file_id uuid, p_evidence_reference text,
  p_notes text, p_planned_start_date date, p_planned_end_date date, p_title text,
  p_fault_inject text, p_actor_user_id uuid, p_correlation_id uuid
)
returns table (acceptance_id uuid, job_id uuid, was_existing boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_acceptance_id uuid;
  v_job_id uuid;
  v_was_existing boolean;
  v_recorded_at timestamptz := statement_timestamp();
begin
  perform public.story_11_2_assert_quote_roles(
    p_tenant_id, p_actor_user_id,
    array['tenant_admin', 'projektledare']::text[]
  );
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
    perform public.story_11_2_record_audit_event_internal(
      p_tenant_id, p_actor_user_id, 'quote.acceptance.accept_and_create_job',
      'quote.acceptance.accepted_and_job_created', 'quote_acceptance',
      v_acceptance_id, p_correlation_id, '{}'::jsonb
    );
  end if;
  return query select v_acceptance_id, v_job_id, v_was_existing;
end;
$$;

-- Initial reviewed quote creation is a Quotes.Create operation. The wrapper
-- keeps the review authorization's source-revision proof and atomic consumption.
create or replace function public.create_quote_version_from_calculation(
  p_tenant_id uuid, p_authorization_id uuid, p_captured_at timestamptz,
  p_actor_user_id uuid, p_correlation_id uuid
)
returns table (quote_id uuid, quote_version_id uuid, quote_number bigint)
language plpgsql security definer set search_path = '' as $$
declare
  a public.quote_review_authorizations%rowtype;
  v_revision jsonb; v_quote_id uuid; v_version_id uuid; v_quote_number bigint;
begin
  perform public.story_11_2_assert_quote_roles(p_tenant_id, p_actor_user_id,
    array['tenant_admin', 'projektledare', 'saljare']::text[]);
  select * into a from public.quote_review_authorizations qra
   where qra.id = p_authorization_id for update;
  if not found or a.tenant_id <> p_tenant_id or a.actor_user_id <> p_actor_user_id
     or a.purpose <> 'initial_creation' or a.consumed_at is not null
     or a.expires_at <= statement_timestamp() or a.captured_at is distinct from p_captured_at
     or a.correlation_id <> p_correlation_id then
    raise exception 'invalid or expired quote review authorization' using errcode = 'QV401';
  end if;
  perform public.assert_story_10_6_line_sources(a.tenant_id, a.calculation_id, a.lines_payload);
  perform public.assert_story_10_6_reviewed_source(a.tenant_id, a.calculation_id,
    a.customer_id, a.facility_id, a.contact_id, a.snapshot_payload,
    a.attachments_payload, repeat('0', 64), a.reviewed_quote_capture_date,
    a.reviewed_calculation_status, a.reviewed_readiness_rows,
    (a.captured_at at time zone 'Europe/Stockholm')::date);
  v_revision := public.story_10_8_calculation_source_revision(a.tenant_id,
    a.calculation_id, a.customer_id, a.facility_id, a.contact_id, a.attachments_payload);
  if v_revision is distinct from a.source_revision then
    raise exception 'quote review authorization source changed' using errcode = 'QV401';
  end if;
  select x.quote_id, x.quote_version_id, x.quote_number
    into v_quote_id, v_version_id, v_quote_number
    from public.story_10_8_create_quote_version_internal(a.tenant_id,
      a.calculation_id, a.captured_at, a.customer_id, a.facility_id, a.contact_id,
      a.snapshot_payload, a.lines_payload, a.attachments_payload, repeat('0', 64),
      a.reviewed_quote_capture_date, a.reviewed_calculation_status,
      a.reviewed_readiness_rows) x;
  update public.quote_review_authorizations set consumed_at = statement_timestamp(),
    consumed_target_id = v_version_id where id = a.id;
  perform public.story_11_2_record_audit_event_internal(p_tenant_id, p_actor_user_id,
    'quote.version.create', 'quote.version.created', 'quote_version', v_version_id,
    p_correlation_id, '{}'::jsonb);
  return query select v_quote_id, v_version_id, v_quote_number;
end;
$$;

-- ---------------------------------------------------------------------------
-- CRM audited command wrappers
-- ---------------------------------------------------------------------------
-- All CRM writes below bind command/event/target in the database so callers
-- cannot forge audit authority.  The wrappers are the only authenticated write
-- path once the direct DML grants are revoked at the end of this block.
create or replace function public.story_11_2_assert_crm_roles(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_allowed_roles text[]
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null
     or auth.uid() is distinct from p_actor_user_id
     or p_allowed_roles is null
     or not public.has_tenant_role(p_tenant_id, p_allowed_roles) then
    raise exception 'crm command authority denied' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.story_11_2_assert_crm_roles(uuid, uuid, text[])
  from public, anon, authenticated, service_role;

create or replace function public.update_customer_with_audit(
  p_tenant_id uuid, p_actor_user_id uuid, p_correlation_id uuid,
  p_customer_id uuid, p_patch jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.story_11_2_assert_crm_roles(p_tenant_id, p_actor_user_id,
    array['tenant_admin','projektledare','saljare']::text[]);
  if p_correlation_id is null or p_customer_id is null or p_patch is null
     or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb
     or (p_patch - array['display_name','personnummer','org_nr','contact_name','email','phone','address_line1','address_line2','postal_code','city']) <> '{}'::jsonb
     or (p_patch ? 'display_name' and (jsonb_typeof(p_patch->'display_name') <> 'string' or btrim(p_patch->>'display_name') = '' or length(p_patch->>'display_name') > 256))
     or (p_patch ? 'personnummer' and (jsonb_typeof(p_patch->'personnummer') <> 'string' or btrim(p_patch->>'personnummer') = '' or length(p_patch->>'personnummer') > 256))
     or (p_patch ? 'org_nr' and (jsonb_typeof(p_patch->'org_nr') <> 'string' or btrim(p_patch->>'org_nr') = '' or length(p_patch->>'org_nr') > 256))
     or (p_patch ? 'contact_name' and (jsonb_typeof(p_patch->'contact_name') <> 'string' or btrim(p_patch->>'contact_name') = '' or length(p_patch->>'contact_name') > 256))
     or (p_patch ? 'email' and (jsonb_typeof(p_patch->'email') <> 'string' or btrim(p_patch->>'email') = '' or length(p_patch->>'email') > 256 or p_patch->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
     or (p_patch ? 'phone' and (jsonb_typeof(p_patch->'phone') <> 'string' or length(p_patch->>'phone') < 5 or length(p_patch->>'phone') > 32 or p_patch->>'phone' !~ '^[+() 0-9-]+$'))
     or (p_patch ? 'address_line1' and (jsonb_typeof(p_patch->'address_line1') <> 'string' or btrim(p_patch->>'address_line1') = '' or length(p_patch->>'address_line1') > 512))
     or (p_patch ? 'address_line2' and (jsonb_typeof(p_patch->'address_line2') <> 'string' or btrim(p_patch->>'address_line2') = '' or length(p_patch->>'address_line2') > 512))
     or (p_patch ? 'postal_code' and (jsonb_typeof(p_patch->'postal_code') <> 'string' or btrim(p_patch->>'postal_code') = '' or length(p_patch->>'postal_code') > 256))
     or (p_patch ? 'city' and (jsonb_typeof(p_patch->'city') <> 'string' or btrim(p_patch->>'city') = '' or length(p_patch->>'city') > 256)) then
    raise exception 'invalid customer patch' using errcode = '23514';
  end if;
  update public.customers c set
    display_name = case when p_patch ? 'display_name' then btrim(p_patch->>'display_name') else c.display_name end,
    personnummer = case when p_patch ? 'personnummer' then btrim(p_patch->>'personnummer') else c.personnummer end,
    org_nr = case when p_patch ? 'org_nr' then btrim(p_patch->>'org_nr') else c.org_nr end,
    contact_name = case when p_patch ? 'contact_name' then btrim(p_patch->>'contact_name') else c.contact_name end,
    email = case when p_patch ? 'email' then btrim(p_patch->>'email') else c.email end,
    phone = case when p_patch ? 'phone' then btrim(p_patch->>'phone') else c.phone end,
    address_line1 = case when p_patch ? 'address_line1' then btrim(p_patch->>'address_line1') else c.address_line1 end,
    address_line2 = case when p_patch ? 'address_line2' then btrim(p_patch->>'address_line2') else c.address_line2 end,
    postal_code = case when p_patch ? 'postal_code' then btrim(p_patch->>'postal_code') else c.postal_code end,
    city = case when p_patch ? 'city' then btrim(p_patch->>'city') else c.city end
   where c.tenant_id = p_tenant_id and c.id = p_customer_id returning c.id into v_id;
  if not found then raise exception 'customer target missing' using errcode = '42501'; end if;
  perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_user_id,'customer.update','customer.updated','customer',v_id,p_correlation_id,'{}'::jsonb);
  return v_id;
end; $$;

create or replace function public.archive_customer_with_audit(
  p_tenant_id uuid, p_actor_user_id uuid, p_correlation_id uuid, p_customer_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.story_11_2_assert_crm_roles(p_tenant_id,p_actor_user_id,array['tenant_admin']::text[]);
  if p_correlation_id is null or p_customer_id is null then raise exception 'invalid customer archive payload' using errcode='23514'; end if;
  update public.customers set archived_at = statement_timestamp() where tenant_id=p_tenant_id and id=p_customer_id returning id into v_id;
  if not found then raise exception 'customer target missing' using errcode='42501'; end if;
  perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_user_id,'customer.archive','customer.archived','customer',v_id,p_correlation_id,'{}'::jsonb);
  return v_id;
end; $$;

create or replace function public.create_facility_with_audit(
  p_tenant_id uuid, p_actor_user_id uuid, p_correlation_id uuid, p_customer_id uuid,
  p_name text, p_address_line1 text, p_address_line2 text, p_postal_code text, p_city text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.story_11_2_assert_crm_roles(p_tenant_id,p_actor_user_id,array['tenant_admin','projektledare','saljare']::text[]);
  if p_correlation_id is null or p_customer_id is null or p_name is null or btrim(p_name)='' or length(p_name)>256
     or (p_address_line1 is not null and (btrim(p_address_line1)='' or length(p_address_line1)>512))
     or (p_address_line2 is not null and (btrim(p_address_line2)='' or length(p_address_line2)>512))
     or (p_postal_code is not null and (btrim(p_postal_code)='' or length(p_postal_code)>256))
     or (p_city is not null and (btrim(p_city)='' or length(p_city)>256)) then raise exception 'invalid facility payload' using errcode='23514'; end if;
  if not exists(select 1 from public.customers where tenant_id=p_tenant_id and id=p_customer_id) then raise exception 'facility customer missing' using errcode='42501'; end if;
  insert into public.facilities(tenant_id,customer_id,name,address_line1,address_line2,postal_code,city)
  values(p_tenant_id,p_customer_id,btrim(p_name),nullif(btrim(p_address_line1),''),nullif(btrim(p_address_line2),''),nullif(btrim(p_postal_code),''),nullif(btrim(p_city),'')) returning id into v_id;
  perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_user_id,'facility.create','facility.created','facility',v_id,p_correlation_id,'{}'::jsonb);
  return v_id;
end; $$;

create or replace function public.update_facility_with_audit(
  p_tenant_id uuid,p_actor_user_id uuid,p_correlation_id uuid,p_facility_id uuid,p_patch jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.story_11_2_assert_crm_roles(p_tenant_id,p_actor_user_id,array['tenant_admin','projektledare','saljare']::text[]);
  if p_correlation_id is null or p_facility_id is null or p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb
     or (p_patch-array['name','address_line1','address_line2','postal_code','city'])<>'{}'::jsonb
     or (p_patch ? 'name' and (jsonb_typeof(p_patch->'name')<>'string' or btrim(p_patch->>'name')='' or length(p_patch->>'name')>256))
     or (p_patch ? 'address_line1' and (jsonb_typeof(p_patch->'address_line1')<>'string' or btrim(p_patch->>'address_line1')='' or length(p_patch->>'address_line1')>512))
     or (p_patch ? 'address_line2' and (jsonb_typeof(p_patch->'address_line2')<>'string' or btrim(p_patch->>'address_line2')='' or length(p_patch->>'address_line2')>512))
     or (p_patch ? 'postal_code' and (jsonb_typeof(p_patch->'postal_code')<>'string' or btrim(p_patch->>'postal_code')='' or length(p_patch->>'postal_code')>256))
     or (p_patch ? 'city' and (jsonb_typeof(p_patch->'city')<>'string' or btrim(p_patch->>'city')='' or length(p_patch->>'city')>256)) then raise exception 'invalid facility patch' using errcode='23514'; end if;
  update public.facilities f set name=case when p_patch?'name' then btrim(p_patch->>'name') else f.name end,address_line1=case when p_patch?'address_line1' then btrim(p_patch->>'address_line1') else f.address_line1 end,address_line2=case when p_patch?'address_line2' then btrim(p_patch->>'address_line2') else f.address_line2 end,postal_code=case when p_patch?'postal_code' then btrim(p_patch->>'postal_code') else f.postal_code end,city=case when p_patch?'city' then btrim(p_patch->>'city') else f.city end where f.tenant_id=p_tenant_id and f.id=p_facility_id returning f.id into v_id;
  if not found then raise exception 'facility target missing' using errcode='42501'; end if;
  perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_user_id,'facility.update','facility.updated','facility',v_id,p_correlation_id,'{}'::jsonb); return v_id;
end; $$;

create or replace function public.archive_facility_with_audit(
  p_tenant_id uuid,p_actor_user_id uuid,p_correlation_id uuid,p_facility_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.story_11_2_assert_crm_roles(p_tenant_id,p_actor_user_id,array['tenant_admin']::text[]);
  if p_correlation_id is null or p_facility_id is null then raise exception 'invalid facility archive payload' using errcode='23514'; end if;
  update public.facilities set archived_at=statement_timestamp() where tenant_id=p_tenant_id and id=p_facility_id returning id into v_id;
  if not found then raise exception 'facility target missing' using errcode='42501'; end if;
  perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_user_id,'facility.archive','facility.archived','facility',v_id,p_correlation_id,'{}'::jsonb); return v_id;
end; $$;

create or replace function public.create_contact_with_audit(
  p_tenant_id uuid,p_actor_user_id uuid,p_correlation_id uuid,p_customer_id uuid,p_facility_id uuid,p_name text,p_email text,p_phone text,p_role_label text,p_is_primary boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.story_11_2_assert_crm_roles(p_tenant_id,p_actor_user_id,array['tenant_admin','projektledare','saljare']::text[]);
  if p_correlation_id is null or p_customer_id is null or p_name is null or btrim(p_name)='' or length(p_name)>256 or (p_email is not null and (btrim(p_email)='' or length(p_email)>256 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) or (p_phone is not null and (length(p_phone)<5 or length(p_phone)>32 or p_phone !~ '^[+() 0-9-]+$')) or (p_role_label is not null and (btrim(p_role_label)='' or length(p_role_label)>256)) or p_is_primary is null then raise exception 'invalid contact payload' using errcode='23514'; end if;
  if not exists(select 1 from public.customers where tenant_id=p_tenant_id and id=p_customer_id) or (p_facility_id is not null and not exists(select 1 from public.facilities where tenant_id=p_tenant_id and id=p_facility_id and customer_id=p_customer_id)) then raise exception 'contact parent missing' using errcode='42501'; end if;
  insert into public.contacts(tenant_id,customer_id,facility_id,name,email,phone,role_label,is_primary) values(p_tenant_id,p_customer_id,p_facility_id,btrim(p_name),nullif(btrim(p_email),''),nullif(btrim(p_phone),''),nullif(btrim(p_role_label),''),p_is_primary) returning id into v_id;
  perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_user_id,'contact.create','contact.created','contact',v_id,p_correlation_id,'{}'::jsonb); return v_id;
end; $$;

create or replace function public.update_contact_with_audit(
  p_tenant_id uuid,p_actor_user_id uuid,p_correlation_id uuid,p_contact_id uuid,p_patch jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_customer_id uuid; v_facility_id uuid;
begin
  perform public.story_11_2_assert_crm_roles(p_tenant_id,p_actor_user_id,array['tenant_admin','projektledare','saljare']::text[]);
  if p_correlation_id is null or p_contact_id is null or p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb or (p_patch-array['facility_id','name','email','phone','role_label','is_primary'])<>'{}'::jsonb or (p_patch?'facility_id' and jsonb_typeof(p_patch->'facility_id')<>'string') or (p_patch?'name' and (jsonb_typeof(p_patch->'name')<>'string' or btrim(p_patch->>'name')='' or length(p_patch->>'name')>256)) or (p_patch?'email' and (jsonb_typeof(p_patch->'email')<>'string' or btrim(p_patch->>'email')='' or length(p_patch->>'email')>256 or p_patch->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) or (p_patch?'phone' and (jsonb_typeof(p_patch->'phone')<>'string' or length(p_patch->>'phone')<5 or length(p_patch->>'phone')>32 or p_patch->>'phone' !~ '^[+() 0-9-]+$')) or (p_patch?'role_label' and (jsonb_typeof(p_patch->'role_label')<>'string' or btrim(p_patch->>'role_label')='' or length(p_patch->>'role_label')>256)) or (p_patch?'is_primary' and jsonb_typeof(p_patch->'is_primary')<>'boolean') then raise exception 'invalid contact patch' using errcode='23514'; end if;
  select customer_id, facility_id into v_customer_id,v_facility_id from public.contacts where tenant_id=p_tenant_id and id=p_contact_id for update;
  if not found then raise exception 'contact target missing' using errcode='42501'; end if;
  if p_patch?'facility_id' then v_facility_id := (p_patch->>'facility_id')::uuid; if not exists(select 1 from public.facilities where tenant_id=p_tenant_id and id=v_facility_id and customer_id=v_customer_id) then raise exception 'contact facility missing' using errcode='42501'; end if; end if;
  update public.contacts c set facility_id=case when p_patch?'facility_id' then v_facility_id else c.facility_id end,name=case when p_patch?'name' then btrim(p_patch->>'name') else c.name end,email=case when p_patch?'email' then btrim(p_patch->>'email') else c.email end,phone=case when p_patch?'phone' then btrim(p_patch->>'phone') else c.phone end,role_label=case when p_patch?'role_label' then btrim(p_patch->>'role_label') else c.role_label end,is_primary=case when p_patch?'is_primary' then (p_patch->>'is_primary')::boolean else c.is_primary end where c.tenant_id=p_tenant_id and c.id=p_contact_id returning c.id into v_id;
  perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_user_id,'contact.update','contact.updated','contact',v_id,p_correlation_id,'{}'::jsonb); return v_id;
end; $$;

create or replace function public.archive_contact_with_audit(
  p_tenant_id uuid,p_actor_user_id uuid,p_correlation_id uuid,p_contact_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.story_11_2_assert_crm_roles(p_tenant_id,p_actor_user_id,array['tenant_admin']::text[]);
  if p_correlation_id is null or p_contact_id is null then raise exception 'invalid contact archive payload' using errcode='23514'; end if;
  update public.contacts set archived_at=statement_timestamp() where tenant_id=p_tenant_id and id=p_contact_id returning id into v_id;
  if not found then raise exception 'contact target missing' using errcode='42501'; end if;
  perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_user_id,'contact.archive','contact.archived','contact',v_id,p_correlation_id,'{}'::jsonb); return v_id;
end; $$;

revoke execute on function public.update_customer_with_audit(uuid,uuid,uuid,uuid,jsonb), public.archive_customer_with_audit(uuid,uuid,uuid,uuid), public.create_facility_with_audit(uuid,uuid,uuid,uuid,text,text,text,text,text), public.update_facility_with_audit(uuid,uuid,uuid,uuid,jsonb), public.archive_facility_with_audit(uuid,uuid,uuid,uuid), public.create_contact_with_audit(uuid,uuid,uuid,uuid,uuid,text,text,text,text,boolean), public.update_contact_with_audit(uuid,uuid,uuid,uuid,jsonb), public.archive_contact_with_audit(uuid,uuid,uuid,uuid) from public, anon, service_role;
grant execute on function public.update_customer_with_audit(uuid,uuid,uuid,uuid,jsonb), public.archive_customer_with_audit(uuid,uuid,uuid,uuid), public.create_facility_with_audit(uuid,uuid,uuid,uuid,text,text,text,text,text), public.update_facility_with_audit(uuid,uuid,uuid,uuid,jsonb), public.archive_facility_with_audit(uuid,uuid,uuid,uuid), public.create_contact_with_audit(uuid,uuid,uuid,uuid,uuid,text,text,text,text,boolean), public.update_contact_with_audit(uuid,uuid,uuid,uuid,jsonb), public.archive_contact_with_audit(uuid,uuid,uuid,uuid) to authenticated;
revoke insert, update on table public.customers, public.facilities, public.contacts from authenticated;

-- Story 11.2 pricing audited-command fragment
--
-- Append this to 20260907171252_role_aware_phase_a_policy_evolution.sql. It is
-- deliberately a fragment rather than a migration: the parent owns integration
-- of the shared Phase-5 migration. The four public wrappers correspond exactly
-- to src/server/commands/pricing/pricing-db.ts.

create or replace function public.story_11_2_assert_pricing_roles(
  p_tenant_id uuid,
  p_actor_user_id uuid
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null
     or auth.uid() is distinct from p_actor_user_id
     or not public.has_tenant_role(
       p_tenant_id,
       array['tenant_admin', 'projektledare']::text[]
     ) then
    raise exception 'pricing command authority denied' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.story_11_2_assert_pricing_roles(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.upsert_work_role_with_audit(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_correlation_id uuid,
  p_work_role_id uuid,
  p_display_name text,
  p_cost_rate_ore bigint,
  p_sell_rate_ore bigint
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.story_11_2_assert_pricing_roles(p_tenant_id, p_actor_user_id);
  if p_correlation_id is null
     or p_display_name is null
     or btrim(p_display_name) = ''
     or length(btrim(p_display_name)) > 256
     or p_cost_rate_ore is null
     or p_cost_rate_ore < 0
     or p_cost_rate_ore > 9007199254740991
     or p_sell_rate_ore is null
     or p_sell_rate_ore < 0
     or p_sell_rate_ore > 9007199254740991 then
    raise exception 'invalid work role payload' using errcode = '23514';
  end if;

  if p_work_role_id is null then
    insert into public.work_roles (
      tenant_id, display_name, cost_rate_ore, sell_rate_ore
    ) values (
      p_tenant_id, btrim(p_display_name), p_cost_rate_ore, p_sell_rate_ore
    ) returning id into v_id;
  else
    update public.work_roles
       set display_name = btrim(p_display_name),
           cost_rate_ore = p_cost_rate_ore,
           sell_rate_ore = p_sell_rate_ore
     where tenant_id = p_tenant_id
       and id = p_work_role_id
     returning id into v_id;
    if not found then
      raise exception 'work role target missing' using errcode = '42501';
    end if;
  end if;

  perform public.story_11_2_record_audit_event_internal(
    p_tenant_id, p_actor_user_id, 'work_role.upsert', 'work_role.upserted',
    'work_role', v_id, p_correlation_id, '{}'::jsonb
  );
  return v_id;
end;
$$;

create or replace function public.set_work_role_active_with_audit(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_correlation_id uuid,
  p_work_role_id uuid,
  p_is_active boolean
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.story_11_2_assert_pricing_roles(p_tenant_id, p_actor_user_id);
  if p_correlation_id is null or p_work_role_id is null or p_is_active is null then
    raise exception 'invalid work role lifecycle payload' using errcode = '23514';
  end if;
  update public.work_roles
     set is_active = p_is_active
   where tenant_id = p_tenant_id
     and id = p_work_role_id
   returning id into v_id;
  if not found then
    raise exception 'work role target missing' using errcode = '42501';
  end if;
  perform public.story_11_2_record_audit_event_internal(
    p_tenant_id, p_actor_user_id,
    case when p_is_active then 'work_role.reactivate' else 'work_role.archive' end,
    case when p_is_active then 'work_role.reactivated' else 'work_role.archived' end,
    'work_role', v_id, p_correlation_id, '{}'::jsonb
  );
  return v_id;
end;
$$;

create or replace function public.upsert_article_with_audit(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_correlation_id uuid,
  p_article_id uuid,
  p_name text,
  p_sku text,
  p_unit text,
  p_unit_price_ore bigint
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.story_11_2_assert_pricing_roles(p_tenant_id, p_actor_user_id);
  if p_correlation_id is null
     or p_name is null
     or btrim(p_name) = ''
     or length(btrim(p_name)) > 256
     or (p_sku is not null and (btrim(p_sku) = '' or length(btrim(p_sku)) > 256))
     or (p_unit is not null and (btrim(p_unit) = '' or length(btrim(p_unit)) > 256))
     or p_unit_price_ore is null
     or p_unit_price_ore < 0
     or p_unit_price_ore > 9007199254740991 then
    raise exception 'invalid article payload' using errcode = '23514';
  end if;

  if p_article_id is null then
    insert into public.articles (tenant_id, name, sku, unit, unit_price_ore)
    values (
      p_tenant_id, btrim(p_name),
      case when p_sku is null then null else btrim(p_sku) end,
      case when p_unit is null then null else btrim(p_unit) end,
      p_unit_price_ore
    ) returning id into v_id;
  else
    update public.articles
       set name = btrim(p_name),
           sku = case when p_sku is null then null else btrim(p_sku) end,
           unit = case when p_unit is null then null else btrim(p_unit) end,
           unit_price_ore = p_unit_price_ore
     where tenant_id = p_tenant_id
       and id = p_article_id
     returning id into v_id;
    if not found then
      raise exception 'article target missing' using errcode = '42501';
    end if;
  end if;

  perform public.story_11_2_record_audit_event_internal(
    p_tenant_id, p_actor_user_id, 'article.upsert', 'article.upserted',
    'article', v_id, p_correlation_id, '{}'::jsonb
  );
  return v_id;
end;
$$;

create or replace function public.set_article_active_with_audit(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_correlation_id uuid,
  p_article_id uuid,
  p_is_active boolean
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.story_11_2_assert_pricing_roles(p_tenant_id, p_actor_user_id);
  if p_correlation_id is null or p_article_id is null or p_is_active is null then
    raise exception 'invalid article lifecycle payload' using errcode = '23514';
  end if;
  update public.articles
     set is_active = p_is_active
   where tenant_id = p_tenant_id
     and id = p_article_id
   returning id into v_id;
  if not found then
    raise exception 'article target missing' using errcode = '42501';
  end if;
  perform public.story_11_2_record_audit_event_internal(
    p_tenant_id, p_actor_user_id,
    case when p_is_active then 'article.reactivate' else 'article.archive' end,
    case when p_is_active then 'article.reactivated' else 'article.archived' end,
    'article', v_id, p_correlation_id, '{}'::jsonb
  );
  return v_id;
end;
$$;

revoke execute on function public.upsert_work_role_with_audit(
  uuid, uuid, uuid, uuid, text, bigint, bigint
) from public, anon, service_role;
grant execute on function public.upsert_work_role_with_audit(
  uuid, uuid, uuid, uuid, text, bigint, bigint
) to authenticated;

revoke execute on function public.set_work_role_active_with_audit(
  uuid, uuid, uuid, uuid, boolean
) from public, anon, service_role;
grant execute on function public.set_work_role_active_with_audit(
  uuid, uuid, uuid, uuid, boolean
) to authenticated;

revoke execute on function public.upsert_article_with_audit(
  uuid, uuid, uuid, uuid, text, text, text, bigint
) from public, anon, service_role;
grant execute on function public.upsert_article_with_audit(
  uuid, uuid, uuid, uuid, text, text, text, bigint
) to authenticated;

revoke execute on function public.set_article_active_with_audit(
  uuid, uuid, uuid, uuid, boolean
) from public, anon, service_role;
grant execute on function public.set_article_active_with_audit(
  uuid, uuid, uuid, uuid, boolean
) to authenticated;

-- Once all six callers above use their checked wrappers, ordinary authenticated
-- DML would be an unaudited bypass of their atomic audit invariant.
revoke insert, update on table public.work_roles from authenticated;
revoke insert, update on table public.articles from authenticated;

-- ---------------------------------------------------------------------------
-- Calculation lifecycle audited-command wrappers
-- ---------------------------------------------------------------------------
-- Calculation headers are the three low-churn audited lifecycle operations.
-- They are deliberately distinct from row/section/reorder editing, which remains
-- unaudited under ordinary RLS.  Projectledare has the lifecycle capability, so
-- direct DML plus the Admin-only generic audit RPC would otherwise create an
-- unaudited committed write before the envelope's audit step is denied.
create or replace function public.story_11_2_assert_calculation_roles(
  p_tenant_id uuid, p_actor_user_id uuid
) returns void language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_user_id
     or not public.has_tenant_role(p_tenant_id,array['tenant_admin','projektledare']::text[]) then
    raise exception 'calculation command authority denied' using errcode='42501';
  end if;
end;
$$;
revoke execute on function public.story_11_2_assert_calculation_roles(uuid,uuid)
  from public,anon,authenticated,service_role;

create or replace function public.create_calculation_with_audit(
  p_tenant_id uuid, p_actor_user_id uuid, p_correlation_id uuid,
  p_customer_id uuid, p_facility_id uuid, p_contact_id uuid, p_title text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  perform public.story_11_2_assert_calculation_roles(p_tenant_id,p_actor_user_id);
  if p_correlation_id is null or p_customer_id is null or p_title is null
     or btrim(p_title)='' or length(p_title)>256 then
    raise exception 'invalid calculation create payload' using errcode='23514';
  end if;
  if not exists(select 1 from public.customers where tenant_id=p_tenant_id and id=p_customer_id)
     or (p_facility_id is not null and not exists(select 1 from public.facilities where tenant_id=p_tenant_id and id=p_facility_id))
     or (p_contact_id is not null and not exists(select 1 from public.contacts where tenant_id=p_tenant_id and id=p_contact_id)) then
    raise exception 'calculation parent missing' using errcode='42501';
  end if;
  insert into public.calculations(tenant_id,customer_id,facility_id,contact_id,title)
  values(p_tenant_id,p_customer_id,p_facility_id,p_contact_id,btrim(p_title)) returning id into v_id;
  perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_user_id,
    'calculation.create','calculation.created','calculation',v_id,p_correlation_id,'{}'::jsonb);
  return v_id;
end;
$$;

create or replace function public.update_calculation_with_audit(
  p_tenant_id uuid, p_actor_user_id uuid, p_correlation_id uuid,
  p_calculation_id uuid, p_patch jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_current_status text; v_target_status text;
begin
  perform public.story_11_2_assert_calculation_roles(p_tenant_id,p_actor_user_id);
  if p_correlation_id is null or p_calculation_id is null or p_patch is null
     or jsonb_typeof(p_patch) <> 'object' or p_patch='{}'::jsonb
     or (p_patch-array['title','status','tax_input_snapshot']) <> '{}'::jsonb
     or (p_patch ? 'title' and (jsonb_typeof(p_patch->'title') <> 'string' or btrim(p_patch->>'title')='' or length(p_patch->>'title')>256))
     or (p_patch ? 'status' and (jsonb_typeof(p_patch->'status') <> 'string' or p_patch->>'status' not in ('draft','ready','archived')))
     or (p_patch ? 'tax_input_snapshot' and (jsonb_typeof(p_patch->'tax_input_snapshot') <> 'object' or not public.is_story_10_6_tax_input_v2(p_patch->'tax_input_snapshot'))) then
    raise exception 'invalid calculation update payload' using errcode='23514';
  end if;
  select status into v_current_status from public.calculations
   where tenant_id=p_tenant_id and id=p_calculation_id for update;
  if not found then raise exception 'calculation target missing' using errcode='42501'; end if;
  if p_patch ? 'status' then
    v_target_status := p_patch->>'status';
    if not (
      (v_current_status='draft' and v_target_status in ('draft','ready','archived'))
      or (v_current_status='ready' and v_target_status in ('ready','draft','archived'))
      or (v_current_status='archived' and v_target_status='archived')
    ) then
      raise exception 'invalid calculation lifecycle transition' using errcode='23514';
    end if;
  end if;
  update public.calculations c set
    title=case when p_patch?'title' then btrim(p_patch->>'title') else c.title end,
    status=case when p_patch?'status' then p_patch->>'status' else c.status end,
    archived_at=case when p_patch?'status' and p_patch->>'status'='archived' then coalesce(c.archived_at,statement_timestamp()) else c.archived_at end,
    tax_input_snapshot=case when p_patch?'tax_input_snapshot' then p_patch->'tax_input_snapshot' else c.tax_input_snapshot end
  where c.tenant_id=p_tenant_id and c.id=p_calculation_id returning c.id into v_id;
  perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_user_id,
    'calculation.update','calculation.updated','calculation',v_id,p_correlation_id,'{}'::jsonb);
  return v_id;
end;
$$;

create or replace function public.archive_calculation_with_audit(
  p_tenant_id uuid, p_actor_user_id uuid, p_correlation_id uuid,
  p_calculation_id uuid, p_archived_at timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  perform public.story_11_2_assert_calculation_roles(p_tenant_id,p_actor_user_id);
  if p_correlation_id is null or p_calculation_id is null or p_archived_at is null then
    raise exception 'invalid calculation archive payload' using errcode='23514';
  end if;
  update public.calculations set archived_at=p_archived_at,status='archived'
  where tenant_id=p_tenant_id and id=p_calculation_id returning id into v_id;
  if not found then raise exception 'calculation target missing' using errcode='42501'; end if;
  perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_user_id,
    'calculation.archive','calculation.archived','calculation',v_id,p_correlation_id,'{}'::jsonb);
  return v_id;
end;
$$;

revoke execute on function public.create_calculation_with_audit(uuid,uuid,uuid,uuid,uuid,uuid,text)
  from public,anon,service_role;
revoke execute on function public.update_calculation_with_audit(uuid,uuid,uuid,uuid,jsonb)
  from public,anon,service_role;
revoke execute on function public.archive_calculation_with_audit(uuid,uuid,uuid,uuid,timestamptz)
  from public,anon,service_role;
grant execute on function public.create_calculation_with_audit(uuid,uuid,uuid,uuid,uuid,uuid,text) to authenticated;
grant execute on function public.update_calculation_with_audit(uuid,uuid,uuid,uuid,jsonb) to authenticated;
grant execute on function public.archive_calculation_with_audit(uuid,uuid,uuid,uuid,timestamptz) to authenticated;

-- Header INSERT is wrapper-only. Header UPDATE retains its table privilege solely
-- because the existing row-limit trigger locks the parent calculation `FOR UPDATE`
-- while editing rows; the policy's false WITH CHECK still rejects every direct
-- header UPDATE. SECURITY DEFINER lifecycle wrappers bypass this RLS gate.
revoke insert on table public.calculations from authenticated;
grant update on table public.calculations to authenticated;
alter policy calculations_update_own on public.calculations
  with check (false);

-- Story 11.2 checked Jobs.Create/Jobs.Edit wrappers.  Job assignment remains
-- closed: only the matrix's tenant-wide admin/project-manager role set is used.
create or replace function public.story_11_2_assert_job_roles(p_tenant_id uuid,p_actor_user_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_actor_user_id
    or not public.has_tenant_role(p_tenant_id,array['tenant_admin','projektledare']::text[]) then
   raise exception 'job command authority denied' using errcode='42501';
 end if;
end; $$;
revoke execute on function public.story_11_2_assert_job_roles(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.create_job_with_audit(
 p_tenant_id uuid,p_actor_user_id uuid,p_correlation_id uuid,p_customer_id uuid,
 p_title text,p_planned_start_date date,p_planned_end_date date,p_occurred_at timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 perform public.story_11_2_assert_job_roles(p_tenant_id,p_actor_user_id);
 if p_correlation_id is null or p_customer_id is null
    or (p_title is not null and (btrim(p_title)='' or length(p_title)>256))
    or (p_planned_start_date is not null and p_planned_end_date is not null and p_planned_end_date<p_planned_start_date) then
  raise exception 'invalid job create payload' using errcode='23514';
 end if;
 if not exists(select 1 from public.customers where tenant_id=p_tenant_id and id=p_customer_id) then
  raise exception 'job customer missing' using errcode='42501';
 end if;
 insert into public.jobs(tenant_id,customer_id,status,title,planned_start_date,planned_end_date)
 values(p_tenant_id,p_customer_id,'created',nullif(btrim(p_title),''),p_planned_start_date,p_planned_end_date) returning id into v_id;
 insert into public.job_events(tenant_id,job_id,event_type,occurred_at) values(p_tenant_id,v_id,'created',statement_timestamp());
 perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_user_id,'job.create','job.created','job',v_id,p_correlation_id,'{}'::jsonb);
 return v_id;
end; $$;

create or replace function public.update_job_with_audit(
 p_tenant_id uuid,p_actor_user_id uuid,p_correlation_id uuid,p_job_id uuid,p_patch jsonb,p_occurred_at timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_old_status text; v_new_status text; v_start date; v_end date;
begin
 perform public.story_11_2_assert_job_roles(p_tenant_id,p_actor_user_id);
 if p_correlation_id is null or p_job_id is null or p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb
    or (p_patch-array['title','status','planned_start_date','planned_end_date'])<>'{}'::jsonb
    or (p_patch?'title' and jsonb_typeof(p_patch->'title') not in ('string','null'))
    or (p_patch?'title' and jsonb_typeof(p_patch->'title')='string' and (btrim(p_patch->>'title')='' or length(p_patch->>'title')>256))
    or (p_patch?'status' and (jsonb_typeof(p_patch->'status')<>'string' or p_patch->>'status' not in ('created','in_progress','done','cancelled')))
    or (p_patch?'planned_start_date' and (jsonb_typeof(p_patch->'planned_start_date') not in ('string','null') or (jsonb_typeof(p_patch->'planned_start_date')='string' and (p_patch->>'planned_start_date') !~ '^\d{4}-\d{2}-\d{2}$')))
    or (p_patch?'planned_end_date' and (jsonb_typeof(p_patch->'planned_end_date') not in ('string','null') or (jsonb_typeof(p_patch->'planned_end_date')='string' and (p_patch->>'planned_end_date') !~ '^\d{4}-\d{2}-\d{2}$'))) then
  raise exception 'invalid job patch' using errcode='23514';
 end if;
 select status, case when p_patch?'planned_start_date' then nullif(p_patch->>'planned_start_date','')::date else planned_start_date end,
        case when p_patch?'planned_end_date' then nullif(p_patch->>'planned_end_date','')::date else planned_end_date end
   into v_old_status,v_start,v_end from public.jobs where tenant_id=p_tenant_id and id=p_job_id for update;
 if not found then raise exception 'job target missing' using errcode='42501'; end if;
 if v_start is not null and v_end is not null and v_end<v_start then raise exception 'invalid job patch' using errcode='23514'; end if;
 update public.jobs j set title=case when p_patch?'title' then nullif(btrim(p_patch->>'title'),'') else j.title end,
  status=case when p_patch?'status' then p_patch->>'status' else j.status end,
  planned_start_date=case when p_patch?'planned_start_date' then nullif(p_patch->>'planned_start_date','')::date else j.planned_start_date end,
  planned_end_date=case when p_patch?'planned_end_date' then nullif(p_patch->>'planned_end_date','')::date else j.planned_end_date end
  where j.tenant_id=p_tenant_id and j.id=p_job_id returning id,status into v_id,v_new_status;
 if v_new_status is distinct from v_old_status then insert into public.job_events(tenant_id,job_id,event_type,occurred_at) values(p_tenant_id,v_id,v_new_status,statement_timestamp()); end if;
 perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_user_id,'job.update','job.updated','job',v_id,p_correlation_id,'{}'::jsonb);
 return v_id;
end; $$;
revoke execute on function public.create_job_with_audit(uuid,uuid,uuid,uuid,text,date,date,timestamptz),public.update_job_with_audit(uuid,uuid,uuid,uuid,jsonb,timestamptz) from public,anon,service_role;
grant execute on function public.create_job_with_audit(uuid,uuid,uuid,uuid,text,date,date,timestamptz),public.update_job_with_audit(uuid,uuid,uuid,uuid,jsonb,timestamptz) to authenticated;
revoke insert,update on table public.jobs,public.job_events from authenticated;

-- Checked file archive/link commands retain storage tenant-prefix enforcement:
-- bytes remain written through caller-RLS storage policies; only metadata/link/audit
-- move into this atomic database transaction.
create or replace function public.story_11_2_assert_file_roles(p_tenant_id uuid,p_actor_user_id uuid)
returns void language plpgsql security invoker set search_path='' as $$ begin
 if auth.uid() is null or auth.uid() is distinct from p_actor_user_id or not public.has_tenant_role(p_tenant_id,array['tenant_admin','projektledare']::text[]) then raise exception 'file command authority denied' using errcode='42501'; end if;
end; $$;
revoke execute on function public.story_11_2_assert_file_roles(uuid,uuid) from public,anon,authenticated,service_role;
create or replace function public.archive_file_with_audit(p_tenant_id uuid,p_actor_user_id uuid,p_correlation_id uuid,p_file_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$ declare v_id uuid; v_state text; v_kind text;
begin
 perform public.story_11_2_assert_file_roles(p_tenant_id,p_actor_user_id);
 if p_correlation_id is null or p_file_id is null then raise exception 'invalid file archive payload' using errcode='23514'; end if;
 select lifecycle_state,artifact_kind into v_state,v_kind from public.files where tenant_id=p_tenant_id and id=p_file_id for update;
 if not found then raise exception 'file target missing' using errcode='42501'; end if;
 if v_state='archived' then return p_file_id; end if;
 if v_kind='quote_pdf' and v_state<>'locked' then raise exception 'file link locked' using errcode='FL823'; end if;
 update public.files set lifecycle_state='archived',archived_at=statement_timestamp() where tenant_id=p_tenant_id and id=p_file_id returning id into v_id;
 perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_user_id,'file.archive','file.archived','file',v_id,p_correlation_id,jsonb_strip_nulls(jsonb_build_object('reason',p_reason)));
 return v_id;
end; $$;
revoke execute on function public.archive_file_with_audit(uuid,uuid,uuid,uuid,text) from public,anon,service_role;
grant execute on function public.archive_file_with_audit(uuid,uuid,uuid,uuid,text) to authenticated;
revoke update on table public.files from authenticated;

create or replace function public.create_uploaded_file_with_audit(
 p_tenant_id uuid,p_actor_user_id uuid,p_correlation_id uuid,p_file_id uuid,p_object_path text,p_display_name text,p_mime_type text,p_size_bytes bigint,p_owner_type text,p_owner_id uuid,p_purpose text
) returns uuid language plpgsql security definer set search_path='' as $$ declare v_link uuid;
begin
 perform public.story_11_2_assert_file_roles(p_tenant_id,p_actor_user_id);
 if p_correlation_id is null or p_file_id is null or p_object_path is null or p_display_name is null or p_mime_type is null or p_size_bytes is null or p_owner_id is null or p_owner_type not in ('customer','facility','contact','calculation','quote_acceptance','job') or p_purpose is null or not ((p_owner_type in ('customer','facility','contact') and p_purpose='crm_document') or (p_owner_type='calculation' and p_purpose='calculation_attachment') or (p_owner_type='quote_acceptance' and p_purpose='acceptance_evidence') or (p_owner_type='job' and p_purpose='job_evidence')) then raise exception 'invalid file upload payload' using errcode='23514'; end if;
 if p_object_path !~ ('^' || p_tenant_id::text || '/' || p_file_id::text || '/[^/]+$') or not exists(select 1 from storage.objects so where so.bucket_id='tenant-files' and so.name=p_object_path) then raise exception 'file object missing' using errcode='42501'; end if;
 if not ((p_owner_type='customer' and exists(select 1 from public.customers where tenant_id=p_tenant_id and id=p_owner_id)) or (p_owner_type='facility' and exists(select 1 from public.facilities where tenant_id=p_tenant_id and id=p_owner_id)) or (p_owner_type='contact' and exists(select 1 from public.contacts where tenant_id=p_tenant_id and id=p_owner_id)) or (p_owner_type='calculation' and exists(select 1 from public.calculations where tenant_id=p_tenant_id and id=p_owner_id)) or (p_owner_type='quote_acceptance' and exists(select 1 from public.quote_acceptances where tenant_id=p_tenant_id and id=p_owner_id)) or (p_owner_type='job' and exists(select 1 from public.jobs where tenant_id=p_tenant_id and id=p_owner_id))) then raise exception 'file owner missing' using errcode='42501'; end if;
 insert into public.files(id,tenant_id,bucket_id,object_path,display_name,mime_type,size_bytes,uploaded_by,lifecycle_state) values(p_file_id,p_tenant_id,'tenant-files',p_object_path,p_display_name,p_mime_type,p_size_bytes,p_actor_user_id,'linked');
 insert into public.file_links(tenant_id,file_id,owner_type,owner_id,purpose) values(p_tenant_id,p_file_id,p_owner_type,p_owner_id,p_purpose) returning id into v_link;
 perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_user_id,'file.upload','file.uploaded','file',p_file_id,p_correlation_id,'{}'::jsonb);
 return v_link;
end; $$;
revoke execute on function public.create_uploaded_file_with_audit(uuid,uuid,uuid,uuid,text,text,text,bigint,text,uuid,text) from public,anon,service_role;
grant execute on function public.create_uploaded_file_with_audit(uuid,uuid,uuid,uuid,text,text,text,bigint,text,uuid,text) to authenticated;
revoke insert on table public.files,public.file_links from authenticated;

create or replace function public.link_file_with_audit(
 p_tenant_id uuid,p_actor_user_id uuid,p_correlation_id uuid,p_file_id uuid,p_owner_type text,p_owner_id uuid,p_purpose text
) returns uuid language plpgsql security definer set search_path='' as $$ declare v_link uuid;
begin
 perform public.story_11_2_assert_file_roles(p_tenant_id,p_actor_user_id);
 if p_correlation_id is null or p_file_id is null or p_owner_id is null or p_owner_type not in ('customer','facility','contact','calculation','quote_acceptance','job') or p_purpose is null or not ((p_owner_type in ('customer','facility','contact') and p_purpose='crm_document') or (p_owner_type='calculation' and p_purpose='calculation_attachment') or (p_owner_type='quote_acceptance' and p_purpose='acceptance_evidence') or (p_owner_type='job' and p_purpose='job_evidence')) then raise exception 'invalid file link payload' using errcode='23514'; end if;
 if not exists(select 1 from public.files where tenant_id=p_tenant_id and id=p_file_id) then raise exception 'file target missing' using errcode='42501'; end if;
 if not ((p_owner_type='customer' and exists(select 1 from public.customers where tenant_id=p_tenant_id and id=p_owner_id)) or (p_owner_type='facility' and exists(select 1 from public.facilities where tenant_id=p_tenant_id and id=p_owner_id)) or (p_owner_type='contact' and exists(select 1 from public.contacts where tenant_id=p_tenant_id and id=p_owner_id)) or (p_owner_type='calculation' and exists(select 1 from public.calculations where tenant_id=p_tenant_id and id=p_owner_id)) or (p_owner_type='quote_acceptance' and exists(select 1 from public.quote_acceptances where tenant_id=p_tenant_id and id=p_owner_id)) or (p_owner_type='job' and exists(select 1 from public.jobs where tenant_id=p_tenant_id and id=p_owner_id))) then raise exception 'file owner missing' using errcode='42501'; end if;
 insert into public.file_links(tenant_id,file_id,owner_type,owner_id,purpose) values(p_tenant_id,p_file_id,p_owner_type,p_owner_id,p_purpose) returning id into v_link;
 perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_user_id,'file.link.create','file.linked','file_link',v_link,p_correlation_id,'{}'::jsonb);
 return v_link;
end; $$;
revoke execute on function public.link_file_with_audit(uuid,uuid,uuid,uuid,text,uuid,text) from public,anon,service_role;
grant execute on function public.link_file_with_audit(uuid,uuid,uuid,uuid,text,uuid,text) to authenticated;
revoke insert,update on table public.file_links from authenticated;

-- Story 11.2 audited settings / quote-terms commands.
create or replace function public.upsert_company_settings_with_audit(
  p_tenant_id uuid, p_actor_user_id uuid, p_correlation_id uuid,
  p_company_name text, p_org_nr text, p_address_line1 text, p_address_line2 text,
  p_postal_code text, p_city text, p_email text, p_phone text, p_logo_url text,
  p_logo_url_present boolean, p_default_vat_display text, p_vat_rate_bp integer
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  perform public.story_11_2_assert_crm_roles(p_tenant_id,p_actor_user_id,array['tenant_admin']::text[]);
  if p_correlation_id is null or p_company_name is null or btrim(p_company_name)='' or length(btrim(p_company_name))>256
     or (p_org_nr is not null and (btrim(p_org_nr)='' or length(p_org_nr)>256))
     or (p_address_line1 is not null and (btrim(p_address_line1)='' or length(p_address_line1)>512))
     or (p_address_line2 is not null and (btrim(p_address_line2)='' or length(p_address_line2)>512))
     or (p_postal_code is not null and (btrim(p_postal_code)='' or length(p_postal_code)>256))
     or (p_city is not null and (btrim(p_city)='' or length(p_city)>256))
     or (p_email is not null and (btrim(p_email)='' or length(p_email)>256 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
     or (p_phone is not null and (length(p_phone)<5 or length(p_phone)>32 or p_phone !~ '^[+() 0-9-]+$'))
     or (p_logo_url is not null and (btrim(p_logo_url)='' or length(p_logo_url)>512))
     or p_logo_url_present is null
     or p_default_vat_display not in ('company_togglable','company_excl')
     or p_vat_rate_bp is null or p_vat_rate_bp<0 or p_vat_rate_bp>10000 then
    raise exception 'invalid company settings payload' using errcode='23514';
  end if;
  insert into public.company_settings as cs(tenant_id,company_name,org_nr,address_line1,address_line2,postal_code,city,email,phone,logo_url,default_vat_display,vat_rate_bp)
  values(p_tenant_id,btrim(p_company_name),p_org_nr,p_address_line1,p_address_line2,p_postal_code,p_city,p_email,p_phone,p_logo_url,p_default_vat_display,p_vat_rate_bp)
  on conflict (tenant_id) do update set
    company_name=excluded.company_name, org_nr=excluded.org_nr, address_line1=excluded.address_line1,
    address_line2=excluded.address_line2, postal_code=excluded.postal_code, city=excluded.city,
    email=excluded.email, phone=excluded.phone,
    logo_url=case when p_logo_url_present then excluded.logo_url else cs.logo_url end,
    default_vat_display=excluded.default_vat_display, vat_rate_bp=excluded.vat_rate_bp
  returning id into v_id;
  perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_user_id,'company_settings.update','company_settings.updated','company_settings',v_id,p_correlation_id,'{}'::jsonb);
  return v_id;
end; $$;

create or replace function public.upsert_quote_terms_with_audit(
  p_tenant_id uuid,p_actor_user_id uuid,p_correlation_id uuid,p_terms_text text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  perform public.story_11_2_assert_crm_roles(p_tenant_id,p_actor_user_id,array['tenant_admin']::text[]);
  if p_correlation_id is null or p_terms_text is null or btrim(p_terms_text)='' or length(p_terms_text)>20000 then
    raise exception 'invalid quote terms payload' using errcode='23514';
  end if;
  insert into public.quote_terms(tenant_id,terms_text,approved_at,approved_by)
  values(p_tenant_id,btrim(p_terms_text),null,null)
  on conflict (tenant_id) do update set terms_text=excluded.terms_text,approved_at=null,approved_by=null
  returning id into v_id;
  perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_user_id,'quote_terms.update','quote_terms.updated','quote_terms',v_id,p_correlation_id,'{}'::jsonb);
  return v_id;
end; $$;

create or replace function public.approve_quote_terms_with_audit(
  p_tenant_id uuid,p_actor_user_id uuid,p_correlation_id uuid,p_quote_terms_id uuid,p_approved_at timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  perform public.story_11_2_assert_crm_roles(p_tenant_id,p_actor_user_id,array['tenant_admin']::text[]);
  if p_correlation_id is null or p_quote_terms_id is null or p_approved_at is null then
    raise exception 'invalid quote terms approval payload' using errcode='23514';
  end if;
  update public.quote_terms set approved_at=p_approved_at,approved_by=p_actor_user_id
  where tenant_id=p_tenant_id and id=p_quote_terms_id returning id into v_id;
  if not found then raise exception 'quote terms target missing' using errcode='42501'; end if;
  perform public.story_11_2_record_audit_event_internal(p_tenant_id,p_actor_user_id,'quote_terms.approve','quote_terms.approved','quote_terms',v_id,p_correlation_id,'{}'::jsonb);
  return v_id;
end; $$;

revoke execute on function public.upsert_company_settings_with_audit(uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,boolean,text,integer), public.upsert_quote_terms_with_audit(uuid,uuid,uuid,text), public.approve_quote_terms_with_audit(uuid,uuid,uuid,uuid,timestamptz) from public,anon,service_role;
grant execute on function public.upsert_company_settings_with_audit(uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,boolean,text,integer), public.upsert_quote_terms_with_audit(uuid,uuid,uuid,text), public.approve_quote_terms_with_audit(uuid,uuid,uuid,uuid,timestamptz) to authenticated;
revoke insert,update on table public.company_settings,public.quote_terms from authenticated;

-- Story 11.2 — checked, audited quote-follow-up lifecycle wrappers.
--
-- Append after public.story_11_2_assert_quote_roles and
-- public.story_11_2_record_audit_event_internal in the shared Story 11.2 migration.

create or replace function public.plan_quote_follow_up_with_audit(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_correlation_id uuid,
  p_quote_version_id uuid,
  p_due_date date,
  p_note text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_quote_id uuid;
  v_status text;
begin
  perform public.story_11_2_assert_quote_roles(
    p_tenant_id, p_actor_user_id,
    array['tenant_admin', 'projektledare', 'saljare']::text[]
  );
  if p_correlation_id is null or p_quote_version_id is null or p_due_date is null
     or length(coalesce(p_note, '')) > 4000 then
    raise exception 'invalid quote follow-up plan payload' using errcode = '23514';
  end if;
  select qv.quote_id, qv.status into v_quote_id, v_status
    from public.quote_versions qv
   where qv.tenant_id = p_tenant_id and qv.id = p_quote_version_id
   for share;
  if not found then
    raise exception 'quote version missing' using errcode = '42501';
  end if;
  if v_status <> 'sent' then
    raise exception 'quote version is not sent' using errcode = 'QV409';
  end if;
  if p_due_date < (statement_timestamp() at time zone 'Europe/Stockholm')::date then
    raise exception 'quote follow-up due date is in the past' using errcode = '22007';
  end if;
  insert into public.quote_follow_ups (
    tenant_id, quote_id, quote_version_id, due_date, note, status
  ) values (
    p_tenant_id, v_quote_id, p_quote_version_id, p_due_date, p_note, 'open'
  ) returning id into v_id;
  perform public.story_11_2_record_audit_event_internal(
    p_tenant_id, p_actor_user_id, 'quote.follow_up.plan', 'quote.follow_up.plan',
    'quote_follow_up', v_id, p_correlation_id, '{}'::jsonb
  );
  return v_id;
end;
$$;

create or replace function public.complete_quote_follow_up_with_audit(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_correlation_id uuid,
  p_follow_up_id uuid,
  p_outcome text,
  p_completed_at timestamptz,
  p_expected_quote_id uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_quote_id uuid;
  v_status text;
begin
  perform public.story_11_2_assert_quote_roles(
    p_tenant_id, p_actor_user_id,
    array['tenant_admin', 'projektledare', 'saljare']::text[]
  );
  if p_correlation_id is null or p_follow_up_id is null or p_completed_at is null
     or p_outcome is null or btrim(p_outcome) = '' or length(p_outcome) > 4000 then
    raise exception 'invalid quote follow-up completion payload' using errcode = '23514';
  end if;
  select qfu.id, qfu.quote_id, qfu.status into v_id, v_quote_id, v_status
    from public.quote_follow_ups qfu
   where qfu.tenant_id = p_tenant_id and qfu.id = p_follow_up_id
   for update;
  if not found then
    raise exception 'quote follow-up missing' using errcode = '42501';
  end if;
  if v_status <> 'open'
     or (p_expected_quote_id is not null and p_expected_quote_id <> v_quote_id) then
    raise exception 'quote follow-up is no longer eligible' using errcode = 'QFU10';
  end if;
  update public.quote_follow_ups
     set status = 'completed', outcome = p_outcome, completed_at = p_completed_at
   where id = v_id;
  perform public.story_11_2_record_audit_event_internal(
    p_tenant_id, p_actor_user_id, 'quote.follow_up.complete', 'quote.follow_up.complete',
    'quote_follow_up', v_id, p_correlation_id, '{}'::jsonb
  );
  return v_id;
end;
$$;

create or replace function public.annotate_quote_follow_up_with_audit(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_correlation_id uuid,
  p_follow_up_id uuid,
  p_note text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_status text;
begin
  perform public.story_11_2_assert_quote_roles(
    p_tenant_id, p_actor_user_id,
    array['tenant_admin', 'projektledare', 'saljare']::text[]
  );
  if p_correlation_id is null or p_follow_up_id is null
     or length(coalesce(p_note, '')) > 4000 then
    raise exception 'invalid quote follow-up annotation payload' using errcode = '23514';
  end if;
  select qfu.id, qfu.status into v_id, v_status
    from public.quote_follow_ups qfu
   where qfu.tenant_id = p_tenant_id and qfu.id = p_follow_up_id
   for update;
  if not found then
    raise exception 'quote follow-up missing' using errcode = '42501';
  end if;
  if v_status <> 'open' then
    raise exception 'quote follow-up is no longer eligible' using errcode = 'QFU10';
  end if;
  update public.quote_follow_ups set note = p_note where id = v_id;
  perform public.story_11_2_record_audit_event_internal(
    p_tenant_id, p_actor_user_id, 'quote.follow_up.annotate', 'quote.follow_up.annotate',
    'quote_follow_up', v_id, p_correlation_id, '{}'::jsonb
  );
  return v_id;
end;
$$;

revoke execute on function public.plan_quote_follow_up_with_audit(uuid,uuid,uuid,uuid,date,text)
  from public, anon, service_role;
revoke execute on function public.complete_quote_follow_up_with_audit(uuid,uuid,uuid,uuid,text,timestamptz,uuid)
  from public, anon, service_role;
revoke execute on function public.annotate_quote_follow_up_with_audit(uuid,uuid,uuid,uuid,text)
  from public, anon, service_role;
grant execute on function public.plan_quote_follow_up_with_audit(uuid,uuid,uuid,uuid,date,text)
  to authenticated;
grant execute on function public.complete_quote_follow_up_with_audit(uuid,uuid,uuid,uuid,text,timestamptz,uuid)
  to authenticated;
grant execute on function public.annotate_quote_follow_up_with_audit(uuid,uuid,uuid,uuid,text)
  to authenticated;

-- All plan/complete/annotate app writes are now audited in the same database transaction.
revoke insert, update on table public.quote_follow_ups from authenticated;

-- Story 11.2 successor quote completion.
--
-- Replace the currently embedded successor block in
-- `20260907171252_role_aware_phase_a_policy_evolution.sql` (from the duplicate
-- `Story 11.2 quote-successor completion fragment` marker through the successor
-- ACLs) with this fragment.  Keep the preceding role-aware
-- `lock_story_10_6_tenant_snapshot_parent` replacement: it is still required by
-- the Story 10.6 assertions reached below.
--
-- This fragment intentionally retains the existing public successor-review and
-- consumption signatures. It adds the narrow Sales source projection and fixes
-- the stale LOW_MARGIN warning check without exposing cost, markup, or a margin
-- row/count/delta oracle.

create or replace function public.read_quote_successor_source(
  p_tenant_id uuid,
  p_source_quote_version_id uuid,
  p_requested_attachment_ids uuid[],
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.quote_versions%rowtype;
  v_calculation public.calculations%rowtype;
  v_customer public.customers%rowtype;
  v_facility_name text;
  v_contact_name text;
  v_attachment_ids uuid[];
  v_rows jsonb;
  v_sections jsonb;
  v_attachments jsonb;
  v_has_low_margin boolean;
begin
  perform public.story_11_2_assert_quote_roles(
    p_tenant_id,
    p_actor_user_id,
    array['tenant_admin', 'projektledare', 'saljare']::text[]
  );

  -- Bind the projection to this tenant and source version. The parent/authoritative
  -- latest-version assertion remains in the authorization/consumption pair.
  select * into v_source
    from public.quote_versions qv
   where qv.tenant_id = p_tenant_id
     and qv.id = p_source_quote_version_id
   for share;
  if not found then
    raise exception 'successor source missing' using errcode = 'QV409';
  end if;

  select * into v_calculation
    from public.calculations c
   where c.tenant_id = p_tenant_id
     and c.id = v_source.calculation_id
   for share;
  if not found then
    raise exception 'calculation source missing' using errcode = 'QV409';
  end if;

  select * into v_customer
    from public.customers c
   where c.tenant_id = p_tenant_id
     and c.id = v_calculation.customer_id
   for share;
  if not found then
    raise exception 'customer source missing' using errcode = 'QV409';
  end if;

  select f.name into v_facility_name
    from public.facilities f
   where f.tenant_id = p_tenant_id and f.id = v_calculation.facility_id;
  select c.name into v_contact_name
    from public.contacts c
   where c.tenant_id = p_tenant_id and c.id = v_calculation.contact_id;

  -- NULL means the predecessor-default selection, not all calculation files. An
  -- explicit array retains caller order and must be exactly valid; duplicate,
  -- foreign, missing, archived, unlinked, or ineligible IDs never degrade into a
  -- partial selection.
  if p_requested_attachment_ids is null then
    select coalesce(array_agg(selected.file_id order by selected.sort_order, selected.id), array[]::uuid[])
      into v_attachment_ids
      from (
        select qva.file_id, qva.sort_order, qva.id
          from public.quote_version_attachments qva
          join public.files f
            on f.tenant_id = qva.tenant_id
           and f.id = qva.file_id
         where qva.tenant_id = p_tenant_id
           and qva.quote_version_id = p_source_quote_version_id
           and f.archived_at is null
           and f.lifecycle_state not in ('archived', 'deleted')
           and exists (
             select 1
               from public.file_links fl
              where fl.tenant_id = p_tenant_id
                and fl.file_id = qva.file_id
                and fl.owner_type = 'calculation'
                and fl.owner_id = v_calculation.id
                and fl.purpose = 'calculation_attachment'
                and fl.archived_at is null
           )
      ) selected;
  else
    if cardinality(p_requested_attachment_ids) is distinct from (
      select count(distinct requested.file_id)::integer
        from unnest(p_requested_attachment_ids) requested(file_id)
    ) then
      raise exception 'successor attachment selection is invalid' using errcode = '42501';
    end if;
    if exists (
      select 1
        from unnest(p_requested_attachment_ids) requested(file_id)
       where not exists (
         select 1
           from public.files f
           join public.file_links fl
             on fl.tenant_id = f.tenant_id
            and fl.file_id = f.id
          where f.tenant_id = p_tenant_id
            and f.id = requested.file_id
            and f.archived_at is null
            and f.lifecycle_state not in ('archived', 'deleted')
            and fl.owner_type = 'calculation'
            and fl.owner_id = v_calculation.id
            and fl.purpose = 'calculation_attachment'
            and fl.archived_at is null
       )
    ) then
      raise exception 'successor attachment selection is invalid' using errcode = '42501';
    end if;
    v_attachment_ids := p_requested_attachment_ids;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'section_id', r.section_id,
    'row_type', r.row_type,
    'quantity', r.quantity,
    'unit', r.unit,
    'unit_sell_ore', r.unit_sell_ore,
    'vat_rate_bp', r.vat_rate_bp,
    'included_in_invoice_total', r.included_in_invoice_total,
    'deduction_classification', r.deduction_classification,
    'vat_type', r.vat_type,
    'is_hidden', r.is_hidden,
    'is_optional', r.is_optional,
    'is_selected', r.is_selected,
    'label', r.label,
    'description', r.description,
    'quote_note', r.quote_note,
    'sort_order', r.sort_order,
    -- Quote-line provenance is customer-facing classification, not cost/TB data.
    'source_kind', r.source_kind
  ) order by s.sort_order, s.id, r.sort_order, r.id), '[]'::jsonb)
    into v_rows
    from public.calculation_rows r
    join public.calculation_sections s
      on s.id = r.section_id and s.tenant_id = r.tenant_id
   where r.tenant_id = p_tenant_id
     and s.calculation_id = v_calculation.id
     and s.archived_at is null
     and r.archived_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'title', s.title,
    'display_mode', s.display_mode,
    'sort_order', s.sort_order
  ) order by s.sort_order, s.id), '[]'::jsonb)
    into v_sections
    from public.calculation_sections s
   where s.tenant_id = p_tenant_id
     and s.calculation_id = v_calculation.id
     and s.archived_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'file_id', f.id,
    'display_name', f.display_name,
    'sort_order', requested.ordinality - 1
  ) order by requested.ordinality), '[]'::jsonb)
    into v_attachments
    from unnest(v_attachment_ids) with ordinality requested(file_id, ordinality)
    join public.files f
      on f.tenant_id = p_tenant_id and f.id = requested.file_id;

  -- The only cost-derived datum released to the Sales command is this non-invertible
  -- aggregate. It has no row id/count/delta/amount and uses the existing fixed 15% pilot
  -- threshold and the same included-in-invoice predicate as readiness.
  select exists (
    select 1
      from public.calculation_rows r
      join public.calculation_sections s
        on s.id = r.section_id and s.tenant_id = r.tenant_id
     where r.tenant_id = p_tenant_id
       and s.calculation_id = v_calculation.id
       and s.archived_at is null
       and r.archived_at is null
       and r.included_in_invoice_total is distinct from false
       and r.unit_cost_ore is not null
       and r.unit_sell_ore is not null
       and r.unit_sell_ore > 0
       and ((r.unit_sell_ore - r.unit_cost_ore)::numeric / r.unit_sell_ore) < 0.15
  ) into v_has_low_margin;

  return jsonb_build_object(
    'calculation', jsonb_build_object(
      'id', v_calculation.id,
      'customer_id', v_calculation.customer_id,
      'facility_id', v_calculation.facility_id,
      'contact_id', v_calculation.contact_id,
      'title', v_calculation.title,
      'status', v_calculation.status,
      'tax_input_snapshot', v_calculation.tax_input_snapshot
    ),
    'customer', jsonb_build_object(
      'display_name', v_customer.display_name,
      'customer_type', v_customer.customer_type,
      'facility_name', v_facility_name,
      'contact_name', v_contact_name
    ),
    'company', (
      select jsonb_build_object(
        'company_name', cs.company_name, 'org_nr', cs.org_nr,
        'address_line1', cs.address_line1, 'address_line2', cs.address_line2,
        'postal_code', cs.postal_code, 'city', cs.city, 'email', cs.email,
        'phone', cs.phone, 'logo_url', cs.logo_url,
        'default_vat_display', cs.default_vat_display, 'vat_rate_bp', cs.vat_rate_bp
      ) from public.company_settings cs where cs.tenant_id = p_tenant_id
    ),
    'terms', (
      select jsonb_build_object(
        'terms_text', qt.terms_text, 'approved_at', qt.approved_at,
        'approved_by', qt.approved_by
      ) from public.quote_terms qt where qt.tenant_id = p_tenant_id
    ),
    'sections', v_sections,
    'rows', v_rows,
    'attachments', v_attachments,
    'low_margin_warning', jsonb_build_object(
      'present', v_has_low_margin,
      'threshold_percent', case when v_has_low_margin then 15 else null end
    )
  );
end;
$$;

revoke execute on function public.read_quote_successor_source(uuid, uuid, uuid[], uuid)
  from public, anon, service_role;
grant execute on function public.read_quote_successor_source(uuid, uuid, uuid[], uuid)
  to authenticated;

-- Story 11.2 role-aware replacement for the Story 10.6 tenant-singleton lock.
-- Insert once before the successor authorization/read-source block.
create or replace function public.lock_story_10_6_tenant_snapshot_parent(
  p_tenant_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_tenant_role(
       p_tenant_id,
       array['tenant_admin', 'projektledare', 'saljare']::text[]
     )
     and coalesce(auth.role()::text, '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'tenant snapshot parent lock is not authorized'
      using errcode = '42501';
  end if;

  perform 1
    from public.tenants tenant
   where tenant.id = p_tenant_id
   for update;
  if not found then
    raise exception 'tenant snapshot parent is missing'
      using errcode = '23514';
  end if;
end;
$$;

revoke execute on function public.lock_story_10_6_tenant_snapshot_parent(uuid)
  from public;
grant execute on function public.lock_story_10_6_tenant_snapshot_parent(uuid)
  to authenticated, service_role;

comment on function public.lock_story_10_6_tenant_snapshot_parent(uuid) is
  'Narrow Story 10.6 lock primitive. Admin/Projektledare/Säljare own-tenant authorization plus a tenant-row UPDATE lock serializes first inserts into tenant-singleton quote snapshot sources; it returns and mutates no tenant data.';


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
  v_has_low_margin boolean;
  v_expected_low_margin_warning jsonb;
  v_supplied_low_margin_warnings jsonb;
begin
  perform public.story_11_2_assert_quote_roles(
    p_tenant_id,
    p_actor_user_id,
    array['tenant_admin', 'projektledare', 'saljare']::text[]
  );
  if p_correlation_id is null or p_supersede_prior is null then
    raise exception 'invalid successor review request' using errcode = '23514';
  end if;

  select qv.calculation_id into v_source_calculation_id
    from public.quote_versions qv
   where qv.tenant_id = p_tenant_id
     and qv.id = p_source_quote_version_id
     and qv.quote_id = p_quote_id
   for share;
  if not found then
    raise exception 'successor source missing' using errcode = 'QV409';
  end if;
  if v_source_calculation_id is distinct from p_calculation_id then
    raise exception 'successor calculation must match the source quote version'
      using errcode = '23514';
  end if;

  perform public.assert_story_10_6_line_sources(p_tenant_id, p_calculation_id, p_lines);
  select c.tax_input_snapshot into v_tax_input
    from public.calculations c
   where c.tenant_id = p_tenant_id and c.id = p_calculation_id
   for share;
  if not found then
    raise exception 'calculation source missing' using errcode = 'QV409';
  end if;

  -- Recompute the permitted aggregate while the calculation source is locked. This
  -- is a stale-preview check, not a raw cost comparison oracle: no private facts
  -- are returned and the only accepted public representation is the exact warning.
  select exists (
    select 1
      from public.calculation_rows r
      join public.calculation_sections s
        on s.id = r.section_id and s.tenant_id = r.tenant_id
     where r.tenant_id = p_tenant_id
       and s.calculation_id = p_calculation_id
       and s.archived_at is null
       and r.archived_at is null
       and r.included_in_invoice_total is distinct from false
       and r.unit_cost_ore is not null
       and r.unit_sell_ore is not null
       and r.unit_sell_ore > 0
       and ((r.unit_sell_ore - r.unit_cost_ore)::numeric / r.unit_sell_ore) < 0.15
  ) into v_has_low_margin;
  v_expected_low_margin_warning := case when v_has_low_margin then
    jsonb_build_object(
      'code', 'LOW_MARGIN',
      'severity', 'warning',
      'message', 'En eller flera rader har ett täckningsbidrag under 15 %. Kontrollera marginalen innan du skapar en offert.'
    ) else null end;
  if jsonb_typeof(p_snapshot -> 'warnings') is distinct from 'array' then
    raise exception 'successor warning preview is stale' using errcode = '23514';
  end if;
  select coalesce(jsonb_agg(warning), '[]'::jsonb)
    into v_supplied_low_margin_warnings
    from jsonb_array_elements(p_snapshot -> 'warnings') warning
   where warning ->> 'code' = 'LOW_MARGIN';
  if (v_expected_low_margin_warning is null and v_supplied_low_margin_warnings <> '[]'::jsonb)
     or (v_expected_low_margin_warning is not null and v_supplied_low_margin_warnings <> jsonb_build_array(v_expected_low_margin_warning)) then
    raise exception 'successor warning preview is stale' using errcode = '23514';
  end if;

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

revoke execute on function public.authorize_quote_successor_review(
  uuid, uuid, uuid, uuid, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb, boolean, uuid, uuid
) from public, anon, service_role;
grant execute on function public.authorize_quote_successor_review(
  uuid, uuid, uuid, uuid, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb, boolean, uuid, uuid
) to authenticated;

-- Successor consumption must use the same Quotes.Create role set as issuance. The
-- fixed audit writer is nested here so a failed audit rolls back the inserted
-- version, source transition, authorization consumption, and quote event together.
create or replace function public.create_new_quote_version(
  p_tenant_id uuid,
  p_authorization_id uuid,
  p_captured_at timestamptz,
  p_actor_user_id uuid,
  p_correlation_id uuid
)
returns table (quote_version_id uuid, version_number bigint)
language plpgsql
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  a public.quote_review_authorizations%rowtype;
  v_revision jsonb;
  v_version_id uuid;
  v_version_number bigint;
begin
  perform public.story_11_2_assert_quote_roles(
    p_tenant_id,
    p_actor_user_id,
    array['tenant_admin', 'projektledare', 'saljare']::text[]
  );
  select * into a
    from public.quote_review_authorizations qra
   where qra.id = p_authorization_id
   for update;
  if not found or a.tenant_id <> p_tenant_id or a.actor_user_id <> p_actor_user_id
     or a.purpose <> 'successor_creation' or a.consumed_at is not null
     or a.expires_at <= statement_timestamp() or a.captured_at is distinct from p_captured_at
     or a.correlation_id <> p_correlation_id then
    raise exception 'invalid or expired quote review authorization' using errcode = 'QV401';
  end if;

  perform 1
    from public.quotes q
   where q.tenant_id = a.tenant_id and q.id = a.quote_id
   for update;
  if not found then
    raise exception 'successor parent quote missing' using errcode = 'QV409';
  end if;

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
  update public.quote_review_authorizations
     set consumed_at = statement_timestamp(), consumed_target_id = v_version_id
   where id = a.id;
  perform public.story_11_2_record_audit_event_internal(
    p_tenant_id, p_actor_user_id, 'quote.version.new', 'quote.version.created',
    'quote_version', v_version_id, p_correlation_id, '{}'::jsonb
  );
  return query select v_version_id, v_version_number;
end;
$$;

revoke execute on function public.create_new_quote_version(uuid, uuid, timestamptz, uuid, uuid)
  from public, anon, service_role;
grant execute on function public.create_new_quote_version(uuid, uuid, timestamptz, uuid, uuid)
  to authenticated;

-- Story 11.2 Seller-only initial quote projection. Append after review.
-- The production version must retain this command-specific surface; it is not a generic calculation reader.
create or replace function public.read_quote_initial_customer_visible_source(p_tenant_id uuid,p_calculation_id uuid,p_requested_attachment_ids uuid[],p_actor_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.calculations%rowtype; cust public.customers%rowtype; rows jsonb; secs jsonb; files jsonb; low boolean; begin
 perform public.story_11_2_assert_quote_roles(p_tenant_id,p_actor_user_id,array['tenant_admin','projektledare','saljare']::text[]);
 select * into c from public.calculations x where x.tenant_id=p_tenant_id and x.id=p_calculation_id for share; if not found then raise exception 'source missing' using errcode='42501'; end if;
 select * into cust from public.customers x where x.tenant_id=p_tenant_id and x.id=c.customer_id for share; if not found then raise exception 'source missing' using errcode='42501'; end if;
 if p_requested_attachment_ids is not null and (cardinality(p_requested_attachment_ids)<>cardinality(array(select distinct x from unnest(p_requested_attachment_ids)x)) or exists(select 1 from unnest(p_requested_attachment_ids)x(id) where not exists(select 1 from public.files f join public.file_links l on l.file_id=f.id and l.tenant_id=f.tenant_id where f.tenant_id=p_tenant_id and f.id=x.id and f.archived_at is null and f.lifecycle_state not in('archived','deleted') and l.owner_type='calculation' and l.owner_id=c.id and l.purpose='calculation_attachment' and l.archived_at is null))) then raise exception 'attachment denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'section_id',r.section_id,'row_type',r.row_type,'quantity',r.quantity,'unit',r.unit,'unit_sell_ore',r.unit_sell_ore,'vat_rate_bp',r.vat_rate_bp,'included_in_invoice_total',r.included_in_invoice_total,'deduction_classification',r.deduction_classification,'vat_type',r.vat_type,'is_hidden',r.is_hidden,'is_optional',r.is_optional,'is_selected',r.is_selected,'label',r.label,'description',r.description,'quote_note',r.quote_note,'sort_order',r.sort_order,'source_kind',r.source_kind) order by r.sort_order,r.id),'[]'::jsonb) into rows from public.calculation_rows r join public.calculation_sections s on s.id=r.section_id and s.tenant_id=r.tenant_id where r.tenant_id=p_tenant_id and s.calculation_id=c.id and s.archived_at is null and r.archived_at is null;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'display_mode',s.display_mode,'sort_order',s.sort_order) order by s.sort_order,s.id),'[]'::jsonb) into secs from public.calculation_sections s where s.tenant_id=p_tenant_id and s.calculation_id=c.id and s.archived_at is null;
 select coalesce(jsonb_agg(jsonb_build_object('file_id',f.id,'display_name',f.display_name,'sort_order',u.ord-1) order by u.ord),'[]'::jsonb) into files from unnest(coalesce(p_requested_attachment_ids,array[]::uuid[])) with ordinality u(id,ord) join public.files f on f.tenant_id=p_tenant_id and f.id=u.id;
 select exists(select 1 from public.calculation_rows r join public.calculation_sections s on s.id=r.section_id and s.tenant_id=r.tenant_id where r.tenant_id=p_tenant_id and s.calculation_id=c.id and s.archived_at is null and r.archived_at is null and r.included_in_invoice_total is not false and r.unit_cost_ore is not null and coalesce(r.unit_sell_ore,0)>0 and (r.unit_sell_ore-r.unit_cost_ore)*100<r.unit_sell_ore*15) into low;
 return jsonb_build_object('calculation',jsonb_build_object('id',c.id,'customer_id',c.customer_id,'facility_id',c.facility_id,'contact_id',c.contact_id,'title',c.title,'status',c.status,'tax_input_snapshot',c.tax_input_snapshot),'customer',jsonb_build_object('display_name',cust.display_name,'customer_type',cust.customer_type,'facility_name',(select name from public.facilities where tenant_id=p_tenant_id and id=c.facility_id),'contact_name',(select name from public.contacts where tenant_id=p_tenant_id and id=c.contact_id)),'company',(select jsonb_build_object('company_name',x.company_name,'org_nr',x.org_nr,'address_line1',x.address_line1,'address_line2',x.address_line2,'postal_code',x.postal_code,'city',x.city,'email',x.email,'phone',x.phone,'logo_url',x.logo_url,'default_vat_display',x.default_vat_display,'vat_rate_bp',x.vat_rate_bp)from public.company_settings x where x.tenant_id=p_tenant_id),'terms',(select jsonb_build_object('terms_text',x.terms_text,'approved_at',x.approved_at,'approved_by',x.approved_by)from public.quote_terms x where x.tenant_id=p_tenant_id),'sections',secs,'rows',rows,'attachments',files,'low_margin_warning',jsonb_build_object('present',low,'threshold_percent',case when low then 15 else null end)); end $$;
revoke execute on function public.read_quote_initial_customer_visible_source(uuid,uuid,uuid[],uuid) from public,anon,service_role; grant execute on function public.read_quote_initial_customer_visible_source(uuid,uuid,uuid[],uuid) to authenticated;

-- Keep the legacy Admin/PM review contract, but reject Seller before any caller
-- JSON is inspected or private readiness facts are compared.
create or replace function public.authorize_quote_initial_review(
  p_tenant_id uuid, p_calculation_id uuid, p_captured_at timestamptz,
  p_customer_id uuid, p_facility_id uuid, p_contact_id uuid, p_snapshot jsonb,
  p_lines jsonb, p_attachments jsonb, p_reviewed_quote_capture_date date,
  p_reviewed_calculation_status text, p_reviewed_readiness_rows jsonb,
  p_actor_user_id uuid, p_correlation_id uuid
) returns uuid language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare v_id uuid; v_issued_at timestamptz := statement_timestamp(); v_tax_input jsonb;
begin
  perform public.story_11_2_assert_quote_roles(
    p_tenant_id, p_actor_user_id, array['tenant_admin','projektledare']::text[]
  );
  if p_correlation_id is null then
    raise exception 'invalid initial review request' using errcode = '23514';
  end if;
  perform public.assert_story_10_6_line_sources(p_tenant_id, p_calculation_id, p_lines);
  select c.tax_input_snapshot into v_tax_input from public.calculations c
   where c.tenant_id=p_tenant_id and c.id=p_calculation_id for share;
  if not found then raise exception 'calculation source missing' using errcode='QV409'; end if;
  perform public.assert_story_10_6_fresh_quote_v2(
    p_snapshot, p_lines, v_tax_input, (p_captured_at at time zone 'Europe/Stockholm')::date
  );
  perform public.assert_story_10_6_reviewed_source(
    p_tenant_id,p_calculation_id,p_customer_id,p_facility_id,p_contact_id,
    p_snapshot,p_attachments,repeat('0',64),p_reviewed_quote_capture_date,
    p_reviewed_calculation_status,p_reviewed_readiness_rows,
    (p_captured_at at time zone 'Europe/Stockholm')::date
  );
  insert into public.quote_review_authorizations(
    tenant_id,actor_user_id,purpose,calculation_id,customer_id,facility_id,contact_id,
    captured_at,snapshot_payload,lines_payload,attachments_payload,
    reviewed_quote_capture_date,reviewed_calculation_status,reviewed_readiness_rows,
    source_revision,correlation_id,issued_at,expires_at
  ) values (
    p_tenant_id,p_actor_user_id,'initial_creation',p_calculation_id,p_customer_id,
    p_facility_id,p_contact_id,p_captured_at,p_snapshot,p_lines,p_attachments,
    p_reviewed_quote_capture_date,p_reviewed_calculation_status,p_reviewed_readiness_rows,
    public.story_10_8_calculation_source_revision(
      p_tenant_id,p_calculation_id,p_customer_id,p_facility_id,p_contact_id,p_attachments
    ),p_correlation_id,v_issued_at,v_issued_at+interval '15 minutes'
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.authorize_quote_initial_review(uuid,uuid,timestamptz,uuid,uuid,uuid,jsonb,jsonb,jsonb,date,text,jsonb,uuid,uuid)
  from public,anon,service_role;
grant execute on function public.authorize_quote_initial_review(uuid,uuid,timestamptz,uuid,uuid,uuid,jsonb,jsonb,jsonb,date,text,jsonb,uuid,uuid)
  to authenticated;

-- This command-specific Seller authority receives no cost-bearing readiness rows.
-- It obtains them only after it has locked the current calculation, so the stored
-- authorization remains compatible with the existing atomic initial creation RPC.
create or replace function public.authorize_quote_initial_customer_visible_review(
  p_tenant_id uuid, p_calculation_id uuid, p_captured_at timestamptz,
  p_customer_id uuid, p_facility_id uuid, p_contact_id uuid, p_snapshot jsonb,
  p_lines jsonb, p_attachments jsonb, p_reviewed_quote_capture_date date,
  p_reviewed_calculation_status text, p_actor_user_id uuid, p_correlation_id uuid
) returns uuid language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare
  v_id uuid;
  v_issued_at timestamptz := statement_timestamp();
  v_tax_input jsonb;
  v_readiness_rows jsonb;
  v_has_low_margin boolean;
  v_expected_low_margin_warning jsonb;
  v_supplied_low_margin_warnings jsonb;
  v_canonical_warnings jsonb;
  v_snapshot jsonb;
begin
  perform public.story_11_2_assert_quote_roles(
    p_tenant_id,p_actor_user_id,array['tenant_admin','projektledare','saljare']::text[]
  );
  if p_correlation_id is null then
    raise exception 'invalid initial review request' using errcode = '23514';
  end if;

  -- This obtains the same row -> section -> calculation locks used by initial
  -- creation before deriving private readiness or the permitted aggregate.
  perform public.assert_story_10_6_line_sources(p_tenant_id,p_calculation_id,p_lines);
  select c.tax_input_snapshot into v_tax_input from public.calculations c
   where c.tenant_id=p_tenant_id and c.id=p_calculation_id for share;
  if not found then raise exception 'calculation source missing' using errcode='QV409'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'sourceRowId',r.id,'unitCostOre',r.unit_cost_ore,'sourceKind',r.source_kind
  ) order by s.sort_order,s.id,r.sort_order,r.id),'[]'::jsonb)
    into v_readiness_rows
    from public.calculation_rows r join public.calculation_sections s
      on s.id=r.section_id and s.tenant_id=r.tenant_id
   where r.tenant_id=p_tenant_id and s.calculation_id=p_calculation_id
     and s.archived_at is null and r.archived_at is null;

  select exists(
    select 1 from public.calculation_rows r join public.calculation_sections s
      on s.id=r.section_id and s.tenant_id=r.tenant_id
     where r.tenant_id=p_tenant_id and s.calculation_id=p_calculation_id
       and s.archived_at is null and r.archived_at is null
       and r.included_in_invoice_total is distinct from false
       and r.unit_cost_ore is not null and r.unit_sell_ore is not null
       and r.unit_sell_ore>0
       and ((r.unit_sell_ore-r.unit_cost_ore)::numeric/r.unit_sell_ore)<0.15
  ) into v_has_low_margin;
  v_expected_low_margin_warning := case when v_has_low_margin then jsonb_build_object(
    'code','LOW_MARGIN','severity','warning',
    'message','En eller flera rader har ett täckningsbidrag under 15 %. Kontrollera marginalen innan du skapar en offert.'
  ) else null end;
  if jsonb_typeof(p_snapshot -> 'warnings') is distinct from 'array' then
    raise exception 'initial warning preview is stale' using errcode='23514';
  end if;
  select coalesce(jsonb_agg(warning),'[]'::jsonb) into v_supplied_low_margin_warnings
    from jsonb_array_elements(p_snapshot -> 'warnings') warning
   where warning ->> 'code'='LOW_MARGIN';
  if (v_expected_low_margin_warning is null and v_supplied_low_margin_warnings<>'[]'::jsonb)
     or (v_expected_low_margin_warning is not null
       and v_supplied_low_margin_warnings<>jsonb_build_array(v_expected_low_margin_warning)) then
    raise exception 'initial warning preview is stale' using errcode='23514';
  end if;

  -- Validate before canonicalizing: a mismatched reviewed warning is rejected,
  -- never silently rewritten. Store exactly the current permitted aggregate.
  select coalesce(jsonb_agg(item.warning order by item.ordinality),'[]'::jsonb)
    into v_canonical_warnings
    from jsonb_array_elements(p_snapshot -> 'warnings') with ordinality item(warning,ordinality)
   where item.warning ->> 'code'<>'LOW_MARGIN';
  v_canonical_warnings := v_canonical_warnings || case when v_expected_low_margin_warning is null
    then '[]'::jsonb else jsonb_build_array(v_expected_low_margin_warning) end;
  v_snapshot := jsonb_set(p_snapshot,'{warnings}',v_canonical_warnings,false);

  perform public.assert_story_10_6_fresh_quote_v2(
    v_snapshot,p_lines,v_tax_input,(p_captured_at at time zone 'Europe/Stockholm')::date
  );
  perform public.assert_story_10_6_reviewed_source(
    p_tenant_id,p_calculation_id,p_customer_id,p_facility_id,p_contact_id,
    v_snapshot,p_attachments,repeat('0',64),p_reviewed_quote_capture_date,
    p_reviewed_calculation_status,v_readiness_rows,
    (p_captured_at at time zone 'Europe/Stockholm')::date
  );
  insert into public.quote_review_authorizations(
    tenant_id,actor_user_id,purpose,calculation_id,customer_id,facility_id,contact_id,
    captured_at,snapshot_payload,lines_payload,attachments_payload,
    reviewed_quote_capture_date,reviewed_calculation_status,reviewed_readiness_rows,
    source_revision,correlation_id,issued_at,expires_at
  ) values (
    p_tenant_id,p_actor_user_id,'initial_creation',p_calculation_id,p_customer_id,
    p_facility_id,p_contact_id,p_captured_at,v_snapshot,p_lines,p_attachments,
    p_reviewed_quote_capture_date,p_reviewed_calculation_status,v_readiness_rows,
    public.story_10_8_calculation_source_revision(
      p_tenant_id,p_calculation_id,p_customer_id,p_facility_id,p_contact_id,p_attachments
    ),p_correlation_id,v_issued_at,v_issued_at+interval '15 minutes'
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.authorize_quote_initial_customer_visible_review(uuid,uuid,timestamptz,uuid,uuid,uuid,jsonb,jsonb,jsonb,date,text,uuid,uuid)
  from public,anon,service_role;
grant execute on function public.authorize_quote_initial_customer_visible_review(uuid,uuid,timestamptz,uuid,uuid,uuid,jsonb,jsonb,jsonb,date,text,uuid,uuid)
  to authenticated;




-- Story 11.2: PDF rendering is an export operation. Keep review-authorization
-- authority separate: this helper is used only by the attested render lifecycle.
create or replace function public.story_11_2_assert_quote_pdf_roles(
  p_tenant_id uuid,
  p_actor_user_id uuid
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform public.story_11_2_assert_quote_roles(
    p_tenant_id, p_actor_user_id,
    array['tenant_admin', 'projektledare', 'saljare']::text[]
  );
end;
$$;
create or replace function public.start_quote_pdf_render(
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
  perform public.story_11_2_assert_quote_pdf_roles(p_tenant_id, p_actor_user_id);
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
  perform public.story_11_2_record_audit_event_internal(p_tenant_id, p_actor_user_id, 'quote.pdf.render.start',
    'quote.pdf.render_started', 'quote_version', p_quote_version_id, p_correlation_id, '{}'::jsonb);
  return query select v_file_id, null::uuid, v_fingerprint, p_attestation_key_id,
    public.quote_pdf_attestation_iso(v_started), public.quote_pdf_attestation_iso(v_expires),
    public.quote_pdf_attestation_iso(v_started);
end;
$$;

create or replace function public.complete_quote_pdf_render(
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
  perform public.story_11_2_assert_quote_pdf_roles(p_tenant_id, p_actor_user_id);
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
  perform public.story_11_2_record_audit_event_internal(p_tenant_id, p_actor_user_id, 'quote.pdf.render.complete',
    'quote.pdf.generated', 'quote_version', p_quote_version_id, p_correlation_id, '{}'::jsonb);
  return query select p_quote_version_id;
end;
$$;

create or replace function public.fail_quote_pdf_render(
  p_tenant_id uuid, p_quote_version_id uuid, p_expected_file_id uuid, p_failed_at timestamptz,
  p_actor_user_id uuid, p_correlation_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare v_quote_id uuid; v_now timestamptz := statement_timestamp();
begin
  perform public.story_11_2_assert_quote_pdf_roles(p_tenant_id, p_actor_user_id);
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
  perform public.story_11_2_record_audit_event_internal(p_tenant_id, p_actor_user_id, 'quote.pdf.render.fail',
    'quote.pdf.failed', 'quote_version', p_quote_version_id, p_correlation_id, '{}'::jsonb);
end;
$$;

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
  perform public.story_11_2_assert_quote_pdf_roles(p_tenant_id, p_actor_user_id);

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
revoke execute on function public.story_11_2_assert_quote_pdf_roles(uuid, uuid) from public, anon, service_role;
revoke execute on function public.start_quote_pdf_render(uuid, uuid, uuid, uuid, timestamptz, text),
  public.complete_quote_pdf_render(uuid, uuid, uuid, timestamptz, uuid, uuid, text, text, text, text),
  public.fail_quote_pdf_render(uuid, uuid, uuid, timestamptz, uuid, uuid),
  public.reserve_quote_pdf_file(uuid, uuid, uuid, text, text, bigint, text, uuid) from public, anon, service_role;
grant execute on function public.start_quote_pdf_render(uuid, uuid, uuid, uuid, timestamptz, text),
  public.complete_quote_pdf_render(uuid, uuid, uuid, timestamptz, uuid, uuid, text, text, text, text),
  public.fail_quote_pdf_render(uuid, uuid, uuid, timestamptz, uuid, uuid),
  public.reserve_quote_pdf_file(uuid, uuid, uuid, text, text, bigint, text, uuid) to authenticated;

-- A Säljare may upload only the first object for a database-reserved, in-flight
-- quote PDF that it owns. This does not widen ordinary tenant file uploads.
create or replace function public.story_11_2_can_upload_reserved_quote_pdf(
  p_tenant_id uuid,
  p_file_id uuid,
  p_object_path text
) returns boolean language sql security definer set search_path = '' as $$
  select auth.uid() is not null
    and public.has_tenant_role(p_tenant_id, array['tenant_admin','projektledare','saljare']::text[])
    and p_object_path ~ ('^' || p_tenant_id::text || '/' || p_file_id::text || '/[^/]+$')
    and exists (
      select 1 from public.files f
      join public.quote_versions qv on qv.tenant_id = f.tenant_id
        and qv.pdf_render_file_id = f.id and qv.pdf_status = 'generating'
      where f.id = p_file_id and f.tenant_id = p_tenant_id
        and f.artifact_kind = 'quote_pdf' and f.lifecycle_state = 'draft'
        and f.archived_at is null and f.uploaded_by = auth.uid()
    );
$$;
revoke execute on function public.story_11_2_can_upload_reserved_quote_pdf(uuid,uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.story_11_2_can_upload_reserved_quote_pdf(uuid,uuid,text) to authenticated;

alter policy tenant_files_objects_insert_own on storage.objects
  with check (
    bucket_id = 'tenant-files'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and (
      public.is_tenant_admin(((storage.foldername(name))[1])::uuid)
      or public.has_tenant_role(((storage.foldername(name))[1])::uuid, array['tenant_admin', 'projektledare']::text[])
      or public.story_11_2_can_upload_reserved_quote_pdf(
        ((storage.foldername(name))[1])::uuid,
        ((storage.foldername(name))[2])::uuid,
        name
      )
    )
  );

-- Story 11.2: a quote-export signer is intentionally distinct from generic Files.View.
-- It permits only the active generated PDF bound to an accessible quote version, and
-- preserves the existing post-Storage HMAC audit proof (the generic file signer remains
-- Admin/Projektledare only).
create or replace function public.story_11_2_quote_pdf_signed_access_target(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_quote_version_id uuid,
  p_file_id uuid
) returns table(bucket_id text, object_path text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or auth.uid() is distinct from p_actor_user_id
     or p_tenant_id is null
     or p_quote_version_id is null
     or p_file_id is null
     or not public.has_tenant_role(
       p_tenant_id,
       array['tenant_admin','projektledare','saljare']::text[]
     ) then
    raise exception 'quote PDF access denied' using errcode = '42501';
  end if;

  return query
    select f.bucket_id, f.object_path
      from public.quote_versions qv
      join public.files f
        on f.tenant_id = qv.tenant_id
       and f.id = qv.pdf_file_id
      join public.file_links fl
        on fl.tenant_id = f.tenant_id
       and fl.file_id = f.id
       and fl.owner_type = 'quote_version'
       and fl.owner_id = qv.id
       and fl.purpose = 'quote_pdf'
       and fl.archived_at is null
     where qv.tenant_id = p_tenant_id
       and qv.id = p_quote_version_id
       and qv.pdf_file_id = p_file_id
       and qv.pdf_status = 'generated'
       and f.archived_at is null
       and f.lifecycle_state in ('linked','locked')
       and f.artifact_kind = 'quote_pdf'
       and f.bucket_id = 'tenant-files'
       and f.object_path ~ ('^' || p_tenant_id::text || '/' || p_file_id::text || '/[^/]+$')
       and exists (
         select 1 from storage.objects o
          where o.bucket_id = f.bucket_id and o.name = f.object_path
       )
     for key share of qv, f;

  if not found then
    raise exception 'quote PDF access denied' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.story_11_2_can_read_generated_quote_pdf(
  p_tenant_id uuid,
  p_file_id uuid,
  p_object_path text
) returns boolean
language sql
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and public.has_tenant_role(
      p_tenant_id,
      array['tenant_admin','projektledare','saljare']::text[]
    )
    and exists (
      select 1
        from public.quote_versions qv
        join public.files f
          on f.tenant_id = qv.tenant_id and f.id = qv.pdf_file_id
        join public.file_links fl
          on fl.tenant_id = f.tenant_id and fl.file_id = f.id
         and fl.owner_type = 'quote_version' and fl.owner_id = qv.id
         and fl.purpose = 'quote_pdf' and fl.archived_at is null
       where qv.tenant_id = p_tenant_id
         and qv.pdf_file_id = p_file_id
         and qv.pdf_status = 'generated'
         and f.archived_at is null
         and f.lifecycle_state in ('linked','locked')
         and f.artifact_kind = 'quote_pdf'
         and f.bucket_id = 'tenant-files'
         and f.object_path = p_object_path
         and p_object_path ~ ('^' || p_tenant_id::text || '/' || p_file_id::text || '/[^/]+$')
    );
$$;

create or replace function public.prepare_quote_pdf_signed_access_audit_attestation(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_quote_version_id uuid,
  p_file_id uuid,
  p_correlation_id uuid,
  p_attestation_key_id text
) returns table (
  bucket_id text,
  object_path text,
  attestation_key_id text,
  attestation_issued_at text,
  attestation_expires_at text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_bucket text;
  v_path text;
begin
  if p_correlation_id is null then
    raise exception 'quote PDF access denied' using errcode = '42501';
  end if;
  select t.bucket_id, t.object_path into v_bucket, v_path
    from public.story_11_2_quote_pdf_signed_access_target(
      p_tenant_id, p_actor_user_id, p_quote_version_id, p_file_id
    ) t;
  perform public.file_signed_access_attestation_derived_key(p_attestation_key_id);
  return query select v_bucket, v_path, p_attestation_key_id,
    public.file_signed_access_attestation_iso(v_now),
    public.file_signed_access_attestation_iso(v_now + interval '5 minutes');
end;
$$;

create or replace function public.record_quote_pdf_signed_access_audit_attested(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_quote_version_id uuid,
  p_file_id uuid,
  p_bucket_id text,
  p_object_path text,
  p_correlation_id uuid,
  p_signed_url_sha256 text,
  p_signed_url_expires_at text,
  p_attestation_key_id text,
  p_attestation_issued_at text,
  p_attestation_expires_at text,
  p_attestation_signature text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_bucket text;
  v_path text;
  v_url_expires timestamptz;
  v_issued timestamptz;
  v_expires timestamptz;
  v_expected_signature text;
  v_audit_id uuid;
begin
  if p_correlation_id is null
     or p_signed_url_sha256 is null or p_signed_url_sha256 !~ '^[0-9a-f]{64}$'
     or p_attestation_key_id is null or p_attestation_key_id !~ '^[A-Za-z0-9_-]{1,64}$'
     or p_attestation_signature is null or p_attestation_signature !~ '^[0-9a-f]{64}$'
     or p_signed_url_expires_at is null or p_signed_url_expires_at !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
     or p_attestation_issued_at is null or p_attestation_issued_at !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
     or p_attestation_expires_at is null or p_attestation_expires_at !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$' then
    raise exception 'quote PDF signed-access attestation is invalid' using errcode = 'FSA10';
  end if;
  begin
    v_url_expires := p_signed_url_expires_at::timestamptz;
    v_issued := p_attestation_issued_at::timestamptz;
    v_expires := p_attestation_expires_at::timestamptz;
  exception when others then
    raise exception 'quote PDF signed-access attestation is invalid' using errcode = 'FSA10';
  end;
  if p_signed_url_expires_at is distinct from public.file_signed_access_attestation_iso(v_url_expires)
     or p_attestation_issued_at is distinct from public.file_signed_access_attestation_iso(v_issued)
     or p_attestation_expires_at is distinct from public.file_signed_access_attestation_iso(v_expires)
     or v_issued > v_now + interval '5 seconds'
     or v_expires is distinct from v_issued + interval '5 minutes'
     or v_expires <= v_now or v_url_expires <= v_now or v_url_expires <= v_issued
     or v_url_expires > v_issued + interval '24 hours 1 minute' then
    raise exception 'quote PDF signed-access attestation is expired or invalid' using errcode = 'FSA10';
  end if;

  select t.bucket_id, t.object_path into v_bucket, v_path
    from public.story_11_2_quote_pdf_signed_access_target(
      p_tenant_id, p_actor_user_id, p_quote_version_id, p_file_id
    ) t;
  if p_bucket_id is distinct from v_bucket or p_object_path is distinct from v_path then
    raise exception 'quote PDF signed-access target denied' using errcode = '42501';
  end if;

  v_expected_signature := encode(extensions.hmac(
    public.file_signed_access_attestation_payload(
      p_tenant_id, p_actor_user_id, p_file_id, v_bucket, v_path,
      p_correlation_id, p_signed_url_sha256, v_url_expires,
      p_attestation_key_id, v_issued, v_expires
    ), public.file_signed_access_attestation_derived_key(p_attestation_key_id), 'sha256'
  ), 'hex');
  if v_expected_signature is distinct from p_attestation_signature then
    raise exception 'quote PDF signed-access attestation is invalid' using errcode = 'FSA10';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'elpro.quote-pdf-signed-access.audit-replay.v1:' || p_tenant_id::text || ':' || p_file_id::text || ':' || p_correlation_id::text, 0));
  if exists (
    select 1 from public.audit_events ae
     where ae.tenant_id = p_tenant_id and ae.correlation_id = p_correlation_id
       and ae.command = 'quote.pdf.signedAccess.create'
       and ae.event_type = 'quote.pdf.signed_access.created'
       and ae.target_type = 'quote_version' and ae.target_id = p_quote_version_id
  ) then
    raise exception 'quote PDF signed-access attestation was already consumed' using errcode = 'FSA10';
  end if;
  v_audit_id := public.story_11_2_record_audit_event_internal(
    p_tenant_id, p_actor_user_id, 'quote.pdf.signedAccess.create',
    'quote.pdf.signed_access.created', 'quote_version', p_quote_version_id,
    p_correlation_id, '{}'::jsonb);
  return v_audit_id;
end;
$$;

revoke execute on function public.story_11_2_quote_pdf_signed_access_target(uuid,uuid,uuid,uuid),
  public.story_11_2_can_read_generated_quote_pdf(uuid,uuid,text)
from public, anon, authenticated, service_role;
grant execute on function public.story_11_2_can_read_generated_quote_pdf(uuid,uuid,text) to authenticated;
revoke execute on function public.prepare_quote_pdf_signed_access_audit_attestation(uuid,uuid,uuid,uuid,uuid,text),
  public.record_quote_pdf_signed_access_audit_attested(uuid,uuid,uuid,uuid,text,text,uuid,text,text,text,text,text,text)
from public, anon, service_role;
grant execute on function public.prepare_quote_pdf_signed_access_audit_attestation(uuid,uuid,uuid,uuid,uuid,text),
  public.record_quote_pdf_signed_access_audit_attested(uuid,uuid,uuid,uuid,text,text,uuid,text,text,text,text,text,text)
to authenticated;

alter policy tenant_files_objects_select_own on storage.objects
  using (
    bucket_id = 'tenant-files'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and (
      public.is_tenant_admin(((storage.foldername(name))[1])::uuid)
      or public.has_tenant_role(((storage.foldername(name))[1])::uuid, array['tenant_admin','projektledare']::text[])
    )
  );
