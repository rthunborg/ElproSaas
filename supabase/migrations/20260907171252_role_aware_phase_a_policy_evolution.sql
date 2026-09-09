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
    user_id = (select auth.uid())
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
      'alter policy %I on public.%I using (public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'', ''saljare'']::text[]))',
      tbl || '_select_own', tbl
    );
    execute format(
      'alter policy %I on public.%I with check (public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'', ''saljare'']::text[]))',
      tbl || '_insert_own', tbl
    );
    execute format(
      'alter policy %I on public.%I using (public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'', ''saljare'']::text[])) with check (public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'', ''saljare'']::text[]))',
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
      'alter policy %I on public.%I using (public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'']::text[]))',
      tbl || '_select_own', tbl
    );
    execute format(
      'alter policy %I on public.%I with check (public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'']::text[]))',
      tbl || '_insert_own', tbl
    );
    execute format(
      'alter policy %I on public.%I using (public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'']::text[])) with check (public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'']::text[]))',
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
      'alter policy %I on public.%I using (public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'', ''saljare'']::text[]))',
      tbl || '_select_own', tbl
    );
    execute format(
      'alter policy %I on public.%I with check (public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'', ''saljare'']::text[]))',
      tbl || '_insert_own', tbl
    );
    if tbl not in ('quote_lost_reasons') then
      execute format(
        'alter policy %I on public.%I using (public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'', ''saljare'']::text[])) with check (public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'', ''saljare'']::text[]))',
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
      'alter policy %I on public.%I using (public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'']::text[]))',
      tbl || '_select_own', tbl
    );
    execute format(
      'alter policy %I on public.%I with check (public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'']::text[]))',
      tbl || '_insert_own', tbl
    );
    execute format(
      'alter policy %I on public.%I using (public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'']::text[])) with check (public.has_tenant_role(tenant_id, array[''tenant_admin'', ''projektledare'']::text[]))',
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
    and public.has_tenant_role(((storage.foldername(name))[1])::uuid, array['tenant_admin', 'projektledare']::text[])
  );
alter policy tenant_files_objects_insert_own on storage.objects
  with check (
    bucket_id = 'tenant-files'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.has_tenant_role(((storage.foldername(name))[1])::uuid, array['tenant_admin', 'projektledare']::text[])
  );
alter policy tenant_files_objects_update_own on storage.objects
  using (
    bucket_id = 'tenant-files'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.has_tenant_role(((storage.foldername(name))[1])::uuid, array['tenant_admin', 'projektledare']::text[])
  )
  with check (
    bucket_id = 'tenant-files'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.has_tenant_role(((storage.foldername(name))[1])::uuid, array['tenant_admin', 'projektledare']::text[])
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

-- Once the command uses the wrapper, direct Data API INSERT would be an
-- unaudited bypass. UPDATE remains temporarily granted for the still-unmigrated
-- customer.update/archive paths and is explicitly part of the Phase-5 inventory.
revoke insert on table public.customers from authenticated;
