# ADR-B012 approval plan: inherited PUBLIC privilege repair

## Status

This is an approval plan only. No migration file was created or applied for the
repair described here. The automatic approval guard rejected the attempted
forward migration because it revoked ACLs across a broad table set. The latest
persisted direct Vitest report is the evidence source for the observed entries.

The report names 22 affected tables in failed assertions. `membership_roles` was
the twenty-third table in the rejected candidate because it shares the foundation
baseline, but it has no failed assertion in that report. It has no proposed SQL
until a direct effective-privilege observation justifies it.

## Observed contract map

| Tables | Historical contract source | Observed effective PUBLIC result | Preserved paths if approved |
| --- | --- | --- | --- |
| `tenants`, `tenant_memberships` | `20260625122433_tenant_foundation.sql` | Anonymous SELECT/UPDATE/DELETE and authenticated cross-tenant UPDATE/DELETE returned an empty successful response where the suites require `42501`. | Explicit authenticated SELECT, service-role fixture/provisioning DML, RLS policies, and the column-specific onboarding grant. |
| `company_settings`, `quote_terms` | `20260630130000_company_settings_and_quote_terms.sql` | Anonymous SELECT/UPDATE/DELETE and authenticated cross-tenant DELETE did not fail at the privilege layer. | Authenticated SELECT/INSERT/UPDATE and service-role DML; tenant-admin RLS and audited wrappers. |
| `work_roles`, `articles` | `20260630140000_work_roles_and_articles.sql` | Anonymous SELECT/UPDATE/DELETE and authenticated cross-tenant DELETE did not fail at the privilege layer. | Authenticated SELECT/INSERT/UPDATE and service-role DML; tenant-admin RLS. |
| `calculations`, `calculation_sections`, `calculation_rows` | `20260702120000_calculation_data_model.sql` | Anonymous SELECT/UPDATE/DELETE and authenticated cross-tenant DELETE did not fail at the privilege layer. | Authenticated calculation edit grants, service-role DML, and calculation RLS policies. |
| `tenant_counters`, `quotes`, `quote_versions`, `quote_version_lines`, `quote_version_attachments`, `quote_events` | `20260705120000_quote_version_model.sql` | Anonymous access for the failed verbs did not fail at the privilege layer. | Existing authenticated quote workflow grants, service-role DML, hardened quote RPCs, and RLS policies. |
| `quote_acceptances` | `20260709120000_acceptance_to_job_model.sql` | Anonymous SELECT/INSERT/UPDATE/DELETE did not fail at the privilege layer. | Existing authenticated acceptance workflow grants, service-role DML, acceptance wrappers, and RLS. |
| `quote_lost_reasons` | `20260719120000_quote_lost_reasons_and_lost_status.sql` | Anonymous SELECT/UPDATE/DELETE did not fail at the privilege layer. | Authenticated SELECT/INSERT, service-role DML, insert-only contract, and RLS. |
| `jobs`, `job_events` | `20260709120000_acceptance_to_job_model.sql` | Anonymous SELECT/UPDATE/DELETE and authenticated cross-tenant DELETE did not fail at the privilege layer. | Existing authenticated workflow grants, service-role DML, job wrappers, and RLS. |
| `files`, `file_links` | `20260704120000_file_storage_foundation.sql` | Anonymous SELECT/UPDATE/DELETE and authenticated cross-tenant DELETE did not fail at the privilege layer. | Existing authenticated file workflow grants, service-role DML, storage wrappers, and RLS. |
| `membership_admin_operations` | `20260910165124_admin_user_management.sql` | Anonymous SELECT/UPDATE/DELETE and authenticated cross-tenant UPDATE/DELETE did not fail at the privilege layer. | Explicit authenticated SELECT, service-role DML, admin-management wrapper, and RLS. |
| `membership_roles` | `20260625122433_tenant_foundation.sql` | No failed assertion in the persisted report. It was included only in the rejected candidate's shared-foundation grouping. | No change proposed without direct proof. |

The two helpers `public.is_active_tenant_member(uuid)` and
`public.is_tenant_admin(uuid)` originate in
`20260625122433_tenant_foundation.sql`. The anonymous RPC negatives returned a
successful response rather than the required privilege error, showing inherited
PUBLIC `EXECUTE`. Their existing explicit authenticated and service-role execute
grants, and their use in RLS policies, must remain intact.

## Narrow forward SQL proposed for approval

Only the 22 directly observed tables and two helpers are in this SQL. It revokes
from `PUBLIC` and `anon` only; it does not revoke from `authenticated`,
`service_role`, wrapper owners, or any schema, and it changes no RLS policy.

```sql
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
```

## Verification and limits

The persisted direct Vitest run uses the loopback test harness and reports
`error = null` for the named direct app paths, so it establishes an effective
privilege mismatch. RLS still hid cross-tenant rows in the representative paths;
the evidence does not establish a cross-tenant data disclosure or mutation.

Before applying an approved migration, re-run the two data-driven RLS suites and
their existing independent readbacks, then confirm the affected focused
migration-reset suites. Do not infer coverage for the unobserved
`membership_roles` entry or for any pending/other product table.

### Read-only retained-path provenance — 2026-10-02

A loopback catalog query over the 22 observed tables found a direct ACL entry
for both `authenticated` and `service_role` on every table (44 role/table
combinations, no gaps). The same query found direct `EXECUTE` entries for both
roles on both helpers (4 role/function combinations, no gaps). These entries
are independent of `PUBLIC`; the historical migration sources in the table map
identify their intended operation sets. The proposal therefore must not add
replacement `GRANT` clauses for those roles. This read-only result does not
authorize applying the proposed `REVOKE` statements.
