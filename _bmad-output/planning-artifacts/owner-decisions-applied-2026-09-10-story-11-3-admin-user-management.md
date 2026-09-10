---
created: 2026-09-10
project: ElproSaas
phase: Phase B - Legacy Parity Release
purpose: Record the owner decisions that resolved the Story 11.3 admin-user-management planning halt.
source_documents:
  - _bmad-output/implementation-artifacts/bmad-build-auto-result-11-3-admin-user-management.md
  - _bmad-output/planning-artifacts/epics-phase-b.md
  - _bmad-output/planning-artifacts/architecture-phase-b.md
---

# Owner Decisions Applied (2026-09-10): Story 11.3 Admin User Management

## D-11.3-1 — Membership lifecycle and re-entry

Membership lifecycle uses explicit `invited`, `expired`, `revoked`, `active`,
`disabled`, and `ended` states with their state timestamps. Expiry is checked
when the recipient accepts an invitation. A disabled membership denies access
only for that tenant and remains the reversible deactivation state. An ended
membership preserves its identity and history; a former member returns only by
a fresh invitation with an explicit new role selection, never by restoring old
privileges. Resend supersedes the prior invitation attempt. A revoked or
superseded attempt can never activate access, even if its email is delivered or
opened later. The database remains authoritative for tenant access.

## D-11.3-2 — Auth-administration operation contract

For every Auth-affecting action, the system first validates the acting tenant
Admin and target, then durably records a tenant-scoped operation and audit event
in one database transaction before calling Supabase Auth. The operation records
success, failure, or uncertain outcome. Retry and reconciliation are explicit;
repeated requests do not duplicate membership mutations, but email delivery is
not promised exactly once. Access removal remains effective if Auth cleanup
fails. The implementation may add only the narrowly scoped operation persistence
needed for these flows; it must not introduce a general background-job system or
custom email infrastructure.

## D-11.3-3 — Shared Auth accounts and UI wording

Deactivation and removal are tenant-scoped. They must never globally ban or
delete a shared Supabase Auth account. User-facing copy must say that access is
removed for the company while history is retained, rather than claiming the
person cannot log in everywhere.
