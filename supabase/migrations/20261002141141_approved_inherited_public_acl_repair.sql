-- ADR-B012 owner-approved repair for the observed inherited PUBLIC ACL set.
-- Preserve explicit authenticated and service_role grants, column grants, RLS
-- policies, wrappers, and function ownership. membership_roles is excluded.
revoke all privileges on table
  public.tenants, public.tenant_memberships,
  public.company_settings, public.quote_terms,
  public.work_roles, public.articles,
  public.calculations, public.calculation_sections, public.calculation_rows,
  public.tenant_counters, public.quotes, public.quote_versions,
  public.quote_version_lines, public.quote_version_attachments, public.quote_events,
  public.quote_acceptances, public.quote_lost_reasons,
  public.jobs, public.job_events,
  public.files, public.file_links,
  public.membership_admin_operations
from public, anon;

revoke execute on function public.is_active_tenant_member(uuid) from public, anon;
revoke execute on function public.is_tenant_admin(uuid) from public, anon;