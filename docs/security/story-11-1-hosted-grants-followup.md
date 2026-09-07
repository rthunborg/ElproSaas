# Story 11.1 hosted grant correction

Owner authorized this narrow follow-up on 2026-09-07 after the merged
[Story 11.1](../../_bmad-output/implementation-artifacts/spec-11-1-role-storage-and-permission-matrix-mechanism.md)
migration was applied to the demo project.

## Finding and scope

The hosted database's default ACLs explicitly granted privileges to `anon`,
`authenticated`, and `service_role` on new public objects. The original migration's
`REVOKE EXECUTE ... FROM PUBLIC` did not remove the separate `anon` grant on
`has_tenant_role(uuid, text[])`. Likewise, its additive table grants did not
restrict the inherited grants on `membership_roles` to the intended operations.
The isolated test database did not reproduce these hosted defaults.

The helper still rejected calls without a session, and the table still had forced
RLS and its admin-only SELECT policy. These safeguards do not substitute for the
intended object-level grant boundary, particularly for privileges such as TRUNCATE.

Migration `20260907161230_role_storage_explicit_grants.sql` normalizes only these
two objects to the following contract (owner privileges are retained):

| Object | PUBLIC / anon | authenticated | service_role |
| --- | --- | --- | --- |
| membership_roles | None | SELECT | SELECT, INSERT, UPDATE, DELETE |
| has_tenant_role(uuid, text[]) | None | EXECUTE | EXECUTE |

It does not change rows, RLS policies, function bodies, foreign keys, project-wide
default privileges, or any other helper. No new Phase B surface or Phase C scope
is introduced. Story 11.2 remains unstarted.

## Verification and deployment

The focused integration regression checks the reset ACLs and recreates excessive
explicit grants inside a local-only transaction. It runs the actual correction
migration twice, checks the exact grants, and exercises anonymous helper and
authenticated write denials. It always rolls back, including on failure.
Existing Story 11.1 RLS and migration-reset tests cover the unchanged row and
tenant integrity boundaries. Isolated CI must run the database tests; the demo
project must never be used as a test fixture.

After the follow-up PR passes CI and is merged, apply the canonical migration to
demo using the documented repo-to-demo process with `--skip-vault`. First verify
the dry run includes only the approved migration. Then inspect the effective
table/function privileges and security advisor results. The warning for anonymous
execution of `has_tenant_role` must disappear; unrelated pre-existing advisor
warnings are outside this patch. The migration is re-runnable; do not roll back
by restoring excessive grants.
