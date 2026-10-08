# ADR-B012 approval plan: inherited PUBLIC privilege repair

## Status

The owner explicitly approved the exact 22-table/two-helper SQL below on 2026-10-02. Forward migration `20261002141141_approved_inherited_public_acl_repair.sql` was applied to the guarded loopback stack without reset or ledger action. Focused required evidence passed: the matrix plus affected cross-tenant/anonymous RLS suites passed 359/359, and the matrix plus focused migration-reset suites passed 27/27. The approval does not extend to `membership_roles`, unobserved tables, schema changes, RLS-policy changes, or grant changes. The latest persisted direct Vitest report is the evidence source for the observed entries.

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

### Successor diagnostic and approval boundary — 2026-10-02

The approved matrix is applied. The normal required gate then completed with 10
failed files and 15 failed assertions. Seven stale ACL/RLS regressions were
corrected without changing a database contract: retained direct authenticated
DELETE/UPDATE ACLs reach RLS, return zero visible affected rows, and independent
privileged readbacks prove no mutation. The persisted root-bound seven-file
reconciliation (`C:\Users\Rasmus\AppData\Local\Temp\elpro-prereq-seven-reconciliation-20261002.json`)
passed 6 files and 68 assertions; its only failed file/assertion is the
deliberately red ready-tenant `disabled_at` PATCH regression (1/1).
The reviewer separately supplied a direct `.cmd` command at approximately
17:13:29 CEST and declared 55421/55422 for a 59-pass/10-fail result, but lacked
a durable report and resolved runtime binding; it is withdrawn and superseded
by the persisted reconciliation.

Two quote-wrapper assertions are not stale. The current checked signatures are
`public.create_quote_version_from_calculation(uuid, uuid, timestamptz, uuid, uuid)`
and `public.mark_quote_version_lifecycle(uuid, uuid, text, timestamptz, uuid, uuid)`.
Loopback catalog evidence finds a direct `service_role` EXECUTE grant on each,
although `20260831124310_story_10_8_quote_review_authorization.sql:908-915`
documents the intended public surface as authenticated-only after `PUBLIC` and
`anon` revocation. Both functions are SECURITY DEFINER wrappers. Each calls
`assert_story_10_8_quote_reviewer` (`20260831124310_story_10_8_quote_review_authorization.sql:123-140`),
which requires `auth.uid() = p_actor_user_id` and `is_tenant_admin(p_tenant_id)`;
the creation wrapper also consumes a bound, unexpired review authorization
(`:558-609`), and the lifecycle wrapper calls the internal state-machine writer
and audit writer (`:764-783`). Application callers use an RLS request client
through the command envelope and resolved tenant/actor fields:
`src/server/commands/quotes/quotes.ts:105-181` and
`src/server/commands/quotes/lifecycle.ts:38-93`. No live source caller uses a
service-role client. This is ACL contract drift in the named-role matrix, not a
demonstrated request-client capability bypass: a service-role invocation does
not carry `auth.uid()` and is rejected by the wrapper predicate. The observed
grant therefore requires an owner decision on the recorded ACL contract.

The smallest forward repair, if approved, is:

```sql
revoke execute on function public.create_quote_version_from_calculation(uuid, uuid, timestamptz, uuid, uuid) from service_role;
revoke execute on function public.mark_quote_version_lifecycle(uuid, uuid, text, timestamptz, uuid, uuid) from service_role;
```

It preserves the intended authenticated application path. Regressions should
prove exact-signature authenticated success, anon and service-role denial, and
the existing foreign-tenant/forged-actor/state-machine negatives. The owner may
instead retain the named-role grants only with a documented privileged caller,
its boundary enforcement, and an execution test. This prerequisite authorizes
neither option.

Two multi-page quote read regressions remain unmodified. A diagnostic-only
loopback reproduction proved the pipeline's `quote_events` request succeeds
with 102 rows, but the exact 101-ID `quote_acceptances` `.in()` request returns
Kong HTTP 502 with the body `An invalid response was received from the upstream
server`; the otherwise identical 50-ID request succeeds with 50 rows.
`readQuotePipeline` receives that error through `readPipelineBatches` and
returns its empty aggregate (`src/server/read-models/quote-pipeline.ts:84-104,
185-196`), causing `acceptedCount` to be zero. The 501-quote list test returns
zero rows, not partial/null statuses: its 100-ID `quote_versions` batch fault
causes `readQuoteList` to return `{ rows: [], error: GENERIC_READ_ERROR }`
(`src/features/quotes/read.ts:194-220,328-330`). The shared `RLS_ID_BATCH_SIZE`
is 100 (`src/server/read-models/pagination.ts:11-46`), which is the observed
failure boundary; the gateway exposes no deeper PostgREST detail in its filtered
REST logs. This is a reachable product query/reliability defect, with the
status-loss mechanism now identified. The smallest justified repair is reducing
the shared `.in()` batch constant from 100 to 50, followed by the existing
101-ID pipeline and 501-root list regressions plus a 50-ID success proof. A
transport-specific alternative needs evidence that it preserves current RLS
read-model callers. This prerequisite authorizes neither product change.

Separately, the retained `authenticated` UPDATE grant and
`20260921090000_onboarding_dismissal_ready_gate.sql:4-10` form a concrete
ready-tenant own-membership PATCH surface. The policy is row-based and its
`WITH CHECK` does not constrain changed columns, so a ready active tenant admin
can update `invited_email`, `invitation_expires_at`, `disabled_at`, or `ended_at`;
`invited_email` feeds reset dispatch. The corrected protected-column tests at
`tests/integration/rls/membership-self-grant.rls.test.ts:69-120` do not prove
general UPDATE denial. `tests/integration/rls/onboarding-checklist.rls.test.ts:59-94`
now reproduces the `disabled_at` PATCH without any delivery-triggering field;
it is deliberately red on the current database because the direct update
returns no error. This is a separate reachable authorization defect, not a
stale test expectation. The smallest proposed forward ACL repair is:

```sql
revoke update on table public.tenant_memberships from authenticated;
grant update (onboarding_checklist_dismissed_at) on table public.tenant_memberships to authenticated;
```

It preserves SELECT, service-role behavior, the existing RLS predicate, and the
intended ready-tenant dismissal path. Required successor evidence is the
ready-state setup and successful set/clear dismissal path at
`tests/integration/rls/onboarding-checklist.rls.test.ts:4-57`, then failed/no-
persist protected `disabled_at` PATCH at `:59-94`; add equivalent checks for
other protected columns if their write paths are claimed. The owner must
approve this ACL change, the two exact wrapper revokes, and the batch-constant
repair as one successor scope before any SQL or product patch.
