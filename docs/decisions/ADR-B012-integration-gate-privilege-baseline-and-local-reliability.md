# ADR-B012: Integration Gate Privilege Baseline and Local Reliability

Status: decided for implementation — 2026-10-02.

Scope: inherited effective database privileges and local required integration/RLS reliability that block Story 14.1 completion. This is a prerequisite repair, not a change to Story 14.1 product scope, acceptance status, or the Phase B manifest.

## Owner approval

The owner approved a narrowly bounded repair after the corrected-target required gate recorded 1,081 passed, 156 failed, and 1 skipped across 124 files. The approved work may repair confirmed inherited effective privileges on the quote-follow-up, CRM, and audit paths, and local integration runner reliability, so `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` can provide valid evidence. Each affected table must first have its intended callers, checked wrappers, grants, and RLS invariants verified; this approval does not authorize blanket all-table revocation or unrelated product behavior changes. It may use only the existing verified loopback stack and forward migrations. It must not reset the database, edit migration history, rewrite applied migrations, remove or skip tests, weaken RLS/grant assertions, access hosted services, or change app/browser product behavior.

## Decision

`public.quote_follow_ups`, the confirmed CRM table with inherited authenticated DELETE, and the confirmed audit path with anonymous SELECT access must each be examined against their actual caller, checked-wrapper, and RLS contracts. Where a table has no authorized direct DML or anonymous read path, a forward migration must establish the least-privilege effective ACL without changing service-role, checked-wrapper, or intended read paths. `public.quote_follow_ups` is readable by authenticated tenant members through its existing RLS policy but has no authorized direct DML path. A forward migration must establish the effective ACL, including inherited `PUBLIC` privileges: revoke all table privileges from `PUBLIC`, `anon`, and `authenticated`, then grant only `SELECT` to `authenticated`. Existing `service_role` DML, RLS policies, checked/audited command wrappers, and function grants remain unchanged.

Each affected migration-reset regression must inspect effective privileges with `has_table_privilege`, rather than relying only on `information_schema.role_table_grants`, because that view does not establish whether a role inherits a privilege through `PUBLIC`. The test continues to require authenticated select-only access and anon denial, together with existing direct-DML and cross-tenant RLS negatives.

The required integration runner may disable cross-file parallelism only if a corrected-target serial run proves that this resolves the observed independent two-second readiness-probe failures. It retains in-file test concurrency and every test file. The chosen setting belongs in the shared Vitest configuration so local and CI invocations execute the same reliable gate.

## Consequences

The database privilege baseline becomes explicit and forward-applicable on already-migrated environments. A serial file runner can increase wall time, but makes the required gate reliable while shared local Auth/PostgREST bootstrap capacity is bounded. No reset-dependent claim is created: the retained stack is used solely for forward application and execution evidence.

## Implementation record

The forward migration `20261002121425_quote_follow_ups_privilege_baseline.sql` revokes all table privileges from `PUBLIC`, `anon`, and `authenticated`, then grants only `SELECT` to `authenticated`. `20261002122535_crm_and_audit_privilege_baseline.sql` applies the same narrow effective-ACL repair to `customers`, `facilities`, `contacts`, and `audit_events` after provenance confirmed CRM's checked/audited wrappers and audit's authenticated-only `record_audit_event` writer. Both leave `service_role` DML, RLS policies, checked/audited command wrappers, and function grants unchanged. The focused regressions use `has_table_privilege` for both `authenticated` and `anon`, so inherited `PUBLIC` privileges are part of the asserted effective ACL. SQL-only loopback application succeeded without reset or ledger repair; focused quote-follow-up evidence passed 10/10 and CRM/audit evidence passed 14/14. The corrected-target full gate reported 106 passed, 17 failed, and 1 skipped files, with 1,116 passed, 122 failed, and 1 skipped tests, but a literal pnpm `--` prevented it from proving requested serialization or JSON reporting.

## References

- `supabase/migrations/20260719130000_quote_follow_ups.sql`
- `supabase/migrations/20260907171252_role_aware_phase_a_policy_evolution.sql`
- `tests/integration/rls/quote-follow-ups-migration-reset.int.test.ts`
- `tests/support/test-env.ts`
- `vitest.config.ts`
- `_bmad-output/implementation-artifacts/spec-14-1-scheduling-activation-person-profiles-and-work-hours.md`

### Owner scope amendment — 2026-10-02

The owner clarified that inherited privilege expectations and integration-test reliability are the approved prerequisite task generally. quote_follow_ups was the first representative repair, not a table-level authorization boundary. Confirmed next classifications are a CRM table whose authenticated effective grant includes DELETE and an audit path where anonymous SELECT succeeds. Repair only the verified affected ACLs after confirming their historical migration, RLS, caller, and wrapper invariants; do not use an all-table revoke or alter unrelated product or financial behavior. Preserve the isolated-recovery skip, data, migration history, and required full gate.

### Owner scope amendment — integration inventory — 2026-10-02

The owner further confirmed that inherited baseline ACL expectations generally are in scope for this prerequisite. The author must derive the affected set from the documented active tenant-table inventory and its allowed anonymous/authenticated/service callers, then repair only demonstrated effective-grant or RLS mismatches with narrow forward migrations and effective-privilege tests. The 72 anon-path and 23 cross-tenant classifications require representative target, JWT, fixture, policy, wrapper, and downstream-validator checks before any conclusion of leakage or bypass. This does not authorize schema-wide revocation, changes to sanctioned anonymous surfaces, or unrelated product and financial behavior.
### Owner approval — exact observed matrix — 2026-10-02

The owner explicitly approved the exact SQL in
`ADR-B012-public-inheritance-repair-approval-plan.md`: revoke table privileges
from `PUBLIC` and `anon` for the 22 observed tables and revoke `EXECUTE` from
those roles for `is_active_tenant_member(uuid)` and `is_tenant_admin(uuid)`.
The approval excludes `membership_roles`, every unobserved table or helper,
RLS-policy changes, replacement grant changes, reset/ledger operations, and
hosted work. The forward migration must preserve the catalog-proven direct
`authenticated` and `service_role` grants, including retained column grants.

### Owner-approved successor completion — 2026-10-02

The owner approved three additional, exact successor repairs: revoke
`service_role` EXECUTE only for
`create_quote_version_from_calculation(uuid, uuid, timestamptz, uuid, uuid)`
and `mark_quote_version_lifecycle(uuid, uuid, text, timestamptz, uuid, uuid)`;
replace authenticated table-wide `tenant_memberships` UPDATE with
`UPDATE (onboarding_checklist_dismissed_at)` only; and reduce the shared RLS
ID batch size from 100 to 50 for the demonstrated 101-ID pipeline and 501-ID
list failures. The approved forward migration preserves SELECT, service-role
table access, RLS, and checked wrappers.

The local readiness repair retains each two-second health request cap and
required-gate fail-closed behavior. It adds one timeout-only retry after a
50 ms backoff, inside a 4.25-second total probe budget; successful probes are
worker-local cached and failed probes are never cached. Diagnostics contain
only surface, method, target origin, HTTP status, elapsed time, reason, and
attempt count. It does not change Vitest file parallelism or test concurrency.

On the verified root loopback stack, successor focused regressions and the
concurrent readiness suite passed. The final
`SUPABASE_TEST_REQUIRED=1 pnpm run test:int` completed with native exit 0:
124 passed and one intentionally skipped file, with 1,242 passed and one
intentionally skipped test. Private persisted metadata confirms API
`127.0.0.1:55421`, database loopback `127.0.0.1:55422`, and PostgreSQL server
`10.240.8.2:5432`. This resolves the integration/RLS prerequisite only; Story
14.1 product acceptance and browser evidence remain unchanged.
