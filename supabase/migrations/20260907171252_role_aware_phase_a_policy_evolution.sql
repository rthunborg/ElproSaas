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
