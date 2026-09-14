---
title: 'Story 11.3 follow-up: Invitation lifecycle remediation'
type: 'security-and-correctness-follow-up'
created: '2026-09-14'
status: 'in-review'
baseline_commit: '25fafa5dcd926c16ff39f8df27bc7911d9e21fbc'
context:
  - '_bmad-output/implementation-artifacts/spec-11-3-admin-user-management.md'
  - '_bmad-output/planning-artifacts/owner-decisions-applied-2026-09-10-story-11-3-admin-user-management.md'
  - 'docs/process/review-order.md'
authorization: 'User explicitly authorized the Epic 11 remediation sequence on 2026-09-14.'
---

## Intent

Repair the recorded invitation lifecycle failures without reopening completed Story 11.3 or changing its separate identity-binding security correction. D-11.3-1 requires expiry, revocation, and supersession to remain terminal; D-11.3-2 requires durable operations to make uncertainty recoverable without claiming exactly-once email delivery.

## Acceptance

- An Admin can send a replacement for an expired invitation or revoke the expired record. The original terminal record is never revived, and a replacement has its own membership identity and current token.
- A provider result that cannot be finalized remains explicitly uncertain and reconcilable. A retry uses a fresh operation only after the prior operation is reconciled; neither path promises a single email delivery.
- A recipient who completes the authenticated, database-confirmed acceptance sees a success confirmation and can continue to their permitted landing route.
- Direct authenticated database evidence proves expired recovery and tenant isolation. Browser evidence proves the expired recovery affordances. The security identity-binding regression remains owned by its focused repair.

## Scope

The change is limited to the active RBAC module: the corrective migration, invitation command/service recovery path, Admin users UI, authenticated acceptance confirmation, focused unit/integration/browser tests, and this follow-up artifact. It adds no custom email path, background job, service-role client path, or Phase C capability.

## Suggested Review Order

Author: lifecycle remediation implementation author.
Refreshed against the final working tree based on `25fafa5`.

### Recover expired records without reviving access

The migration permits only a tenant Admin to terminally revoke a persisted expired row. The existing invitation preparation path creates a replacement row, retaining D-11.3-1 history and preventing old credentials from activating it.

- `supabase/migrations/20260914092850_story_11_3_invitation_lifecycle_remediation.sql:33` — `v_member.status not in ('invited','expired')`: allows only terminal revoke of an expired invitation.
- `src/server/commands/admin-users/invite.ts:63` — `includes(data.status)`: admits expired state only for replacement delivery preparation.
- `tests/integration/commands/admin-user-management.int.test.ts:46` — `expired invitation can be superseded`: proves replacement history, terminal revoke, and cross-tenant denial.

### Preserve a reconcilable delivery boundary

Auth delivery remains after the durable preparation. A finalizer failure returns an uncertain result without attempting a second contradictory finalization, then the command reconciles a replay before a deliberate fresh retry.

- `src/server/auth/admin-user-service.ts:49` — `deliveryOutcome`: separates provider execution from operation finalization.
- `src/server/commands/admin-users/invite.ts:39` — `admin_reconcile_membership_operation`: reads the prior durable outcome before exposing a retry.
- `src/components/admin-users/UsersPage.tsx:12` — `form.set("operationId"`: replaces an already reconciled uncertain operation id only on the next user submission.
- `tests/unit/admin-users/admin-user-service.test.ts:132` — `keeps a prepared invitation reconcilable`: verifies a finalizer failure neither throws away the prepared context nor writes a conflicting outcome.
- `tests/integration/commands/admin-invitation-retry-flow.test.ts:79` — `keeps an uncertain durable operation`: exercises the real action and command through mocked I/O: same-id reconciliation makes no second delivery, an observed outcome enables one fresh attempt, and a success replay is delivery-free.

### Show confirmed completion and operator recovery

The invite acceptance form shows confirmation only after its authenticated command reports database success. The detail page exposes recovery actions for the explicit expired projection.

- `src/components/admin-users/InviteAcceptanceForm.tsx:11` — `state.status === "success"`: presents the server-confirmed activation result.
- `src/components/admin-users/UserDetailPanel.tsx:26` — `detail.status === "expired"`: renders fresh-send and revoke controls.
- `tests/e2e/auth/admin-user-management.atdd.e2e.spec.ts:86` — `authenticated acceptance shows confirmation`: browser proof uses a deterministic local database fixture and makes no email-receipt claim.

Evidence: final validation ran three focused files: seven real authenticated database tests and two mocked-I/O action/command recovery tests passed with zero skips. The full unit suite passed 1,736/1,736 with zero skips; changed-file ESLint, typecheck, source containment, bundle containment, and the guarded production browser rerun (5/5, zero skips) passed.
Limits: the browser suite proves the Admin affordance, database-confirmed success message, and permitted continuation route; it does not prove receipt or exactly-once delivery from Supabase Auth. The retry-flow test mocks the RPC/Auth I/O while the separate database suite proves authenticated RPC recovery and tenant isolation. The separate direct-RPC identity-binding repair owns its own migration and authenticated regression.
