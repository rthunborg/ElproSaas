---
title: 'Story 11.3 follow-up: Password-reset retry remediation'
type: 'security-and-correctness-follow-up'
created: '2026-09-14'
status: 'in-review'
baseline_commit: '5cc08d2b15b161e4742ddddc3283be4a3c03a059'
context:
  - '_bmad-output/implementation-artifacts/epic-11-context.md'
  - '_bmad-output/implementation-artifacts/spec-11-3-admin-user-management.md'
  - '_bmad-output/implementation-artifacts/spec-11-3-invitation-lifecycle-remediation.md'
  - 'docs/process/review-order.md'
authorization: 'User explicitly authorized all remaining Epic 11 remediation work, including implementation and verification, on 2026-09-14.'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A password-reset operation records a durable pending database operation before Auth delivery, but a provider or finalizer failure is currently returned as a generic denial. Repeating the same operation ID either duplicates a delivery attempt while still pending or prevents a recoverable retry after uncertainty.

**Approach:** Apply the invitation recovery protocol to reset delivery: separate provider execution from outcome recording, reconcile every replay before delivery, acknowledge known success without a resend, and enable a deliberate fresh operation only after an observed uncertain result.

## Boundaries & Constraints

**Always:** Keep membership access and tenant authorization database-authoritative. Use the existing authenticated `admin_manage_membership`, `admin_finalize_membership_operation`, and `admin_reconcile_membership_operation` RPCs; preserve their audit and tenant-scoping behavior. Do not claim exactly-once email delivery, expose Auth/provider details, or send a reset on a replayed operation. Retain the existing client operation identity until reconciliation explicitly permits a new one.

**Ask First:** Stop if the existing authenticated RPCs cannot represent the required pending, uncertain, and succeeded recovery states without a database contract change; do not invent a separate operation store or delivery channel.

**Never:** Do not alter invitation acceptance, identity binding, membership roles, permission enforcement, Auth configuration, email templates, service-role containment, or Phase C capability scope. Do not send test emails to the hosted demo; integration evidence runs only against local Supabase.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Fresh reset | Tenant Admin, active same-tenant membership, new operation ID | Commit one pending operation/audit, make one Auth reset request, finalize `succeeded` | Generic success only after finalization confirms |
| Provider failure | Fresh pending operation; provider rejects or response is lost | Persist or retain an uncertain/reconcilable operation; no provider detail leaks | Same ID first reconciles; observed uncertainty enables one fresh ID on the next submission |
| Finalizer response loss | Provider request completed; outcome write result is unavailable | Return uncertainty while preserving the durable operation | Same ID reconciliation acknowledges a stored success with no new Auth request |
| Replay or isolation attempt | Reused succeeded/pending/uncertain ID, non-Admin, or another tenant | Success replay is delivery-free; replayed pending/uncertain is reconciliation-only; unauthorized RPC is denied without a tenant-A audit | No fresh ID or delivery until an authorized observed uncertain result |

</frozen-after-approval>

## Code Map

- `src/server/auth/admin-user-service.ts:61` -- `reset` currently puts provider and finalizer in one catch path, then may throw while attempting a second finalization; split the durable outcome boundary as `invite` already does at lines 24–55.
- `src/server/commands/admin-users/lifecycle.ts:29` -- `changeMembershipLifecycle` receives the authoritative operation outcome from `admin_manage_membership`; use its replay flag and `admin_reconcile_membership_operation` before any reset provider call.
- `src/features/admin-users/actions.ts:26` and `src/features/admin-users/action-state.ts:12` -- server action already preserves/replaces an operation ID only when `retryWithNewOperation` is returned; add reset-specific safe recovery text without changing that protocol.
- `src/components/admin-users/UserDetailPanel.tsx:11` -- the active-user reset control already retains one lifecycle operation ID and calls `operationIdForAdminUsersSubmit`; no new control or client-side authorization is needed.
- `supabase/migrations/20260910165124_admin_user_management.sql:44`, `:131`, `:147` and `20260914092850_story_11_3_invitation_lifecycle_remediation.sql:7` -- existing authenticated database wrappers create/reset/reconcile the durable operation and audit; read-only contract evidence, not a migration target.
- `tests/unit/admin-users/admin-user-service.test.ts` -- service boundary tests can simulate provider and finalizer response loss without claiming database coverage.
- `tests/integration/commands/admin-invitation-retry-flow.test.ts` -- existing real server-action/command seam harness provides the operation-ID/UI retry behavior; extend it for reset delivery using mocked Auth transport only.
- `tests/integration/commands/admin-user-management.int.test.ts` -- real authenticated local clients and admin SQL fixtures prove reset RPC authorization, tenant isolation, durable outcome, and audit effects.

## Tasks & Acceptance

**Execution:**
- [x] `src/server/auth/admin-user-service.ts` -- makes reset return a reconcilable uncertain result when either provider delivery or outcome recording cannot be confirmed; it never makes a contradictory second finalizer call.
- [x] `src/server/commands/admin-users/lifecycle.ts` -- distinguishes a fresh pending reset from a replayed operation; reconciles every replay, acknowledges known success, surfaces observed/unavailable uncertainty, and only delivers on fresh pending operations.
- [x] `src/features/admin-users/actions.ts` -- maps reset uncertainty to user-safe reset recovery wording and preserves the existing `retryWithNewOperation` gate.
- [x] `tests/unit/admin-users/admin-user-service.test.ts` and `tests/integration/commands/admin-invitation-retry-flow.test.ts` -- cover provider failure then observed uncertainty then one fresh delivery; finalizer response loss then no-send success reconciliation; reconciliation unavailability with no send; and succeeded replay with no send.
- [x] `tests/integration/commands/admin-user-management.int.test.ts` -- adds an authenticated direct-RPC regression proving only the tenant Admin can create/reconcile/finalize a reset operation and audit, with cross-tenant denial and no unauthorized side effect.
- [x] `_bmad-output/implementation-artifacts/spec-11-3-password-reset-retry-remediation.md` -- refreshes this author-owned review order after final lines and verification are known.

**Acceptance Criteria:**
- Given an Admin retries a reset whose delivery state is uncertain, when the same operation ID is submitted, then the command reconciles it before any provider call and only an observed uncertain state permits a later fresh operation ID.
- Given reset finalization succeeded but its response was lost, when the Admin retries the same ID, then the UI confirms success and no second reset request is sent.
- Given a tenant-B Admin attempts to reset or reconcile a tenant-A membership operation, when calling the real authenticated RPC, then the database denies it and tenant-A operation/audit state is unchanged.

## Spec Change Log

## Design Notes

The operation row is the recovery boundary: a pending row is not proof that delivery is safe to repeat. The database wrapper returns whether it created the operation or replayed one, so only a newly-created pending row may call Supabase Auth. Reconciliation is read-only and therefore safe before a user deliberately asks for a fresh attempt. The existing action-state helper provides the UI handoff: the same ID is retained until the server labels uncertainty observed, then the next submit uses one new ID.

## Verification

**Commands:**
- `pnpm exec vitest run tests/unit/admin-users/admin-user-service.test.ts tests/integration/commands/admin-invitation-retry-flow.test.ts` -- expected: provider/finalizer recovery paths pass with no duplicate send assertion failures.
- `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/commands/admin-user-management.int.test.ts` -- expected: all authenticated database tests execute with zero skips.
- `pnpm run typecheck` and `pnpm exec eslint src/server/auth/admin-user-service.ts src/server/commands/admin-users/lifecycle.ts src/features/admin-users/actions.ts tests/unit/admin-users/admin-user-service.test.ts tests/integration/commands/admin-invitation-retry-flow.test.ts tests/integration/commands/admin-user-management.int.test.ts` -- expected: success.
- `node scripts/verify/check-review-order.mjs "_bmad-output/implementation-artifacts/spec-11-3-password-reset-retry-remediation.md"` -- expected: final review stops resolve against the completed change.

## Suggested Review Order

Author: implementation author.
Refreshed against the final uncommitted `epic11-reset` working tree.

### Recover reset delivery through the durable operation

Reset delivery now separates the Auth call from recording its outcome, matching the recorded recovery boundary. A failed outcome write returns uncertainty without attempting a contradictory second finalization.

- `src/server/auth/admin-user-service.ts:63` — `deliveryOutcome`: retains the only provider result that can be finalized.
- `src/server/auth/admin-user-service.ts:72` — `finalizeOperation`: records that result once after provider execution.
- `tests/unit/admin-users/admin-user-service.test.ts:182` — `finalizer response is lost`: asserts the successful provider result remains reconcilable when recording is unavailable.

### Reconcile every reset replay before delivery

Only a newly created pending reset may call Auth. The first unconfirmed delivery reaches the action as recoverable uncertainty with its original operation ID; a replay then reads durable state, where stored success is acknowledged delivery-free and an observed non-successful state, including an unrecorded pending finalization, enables a deliberate fresh identity. Unavailable reconciliation retains the existing identity.

- `src/server/commands/admin-users/lifecycle.ts:42` — `replayed`: distinguishes an operation replay from a fresh pending reset.
- `src/server/commands/admin-users/lifecycle.ts:49` — `admin_reconcile_membership_operation`: resolves a replay before any provider call.
- `src/server/commands/admin-users/lifecycle.ts:53` — `reconciledOutcome === "pending"`: treats an observed, unrecorded finalizer failure as recoverable uncertainty only after the delivery-free replay.
- `src/server/commands/admin-users/lifecycle.ts:64` — `uncertain(operationId, "not_attempted")`: preserves the original ID while surfacing first-attempt reset uncertainty to the action.
- `src/features/admin-users/actions.ts:33` — `retryWithNewOperation`: permits a new reset identity only after observed uncertainty and presents reset-specific safe recovery text.
- `tests/integration/commands/admin-invitation-retry-flow.test.ts:162` — `reconciles a failed reset`: exercises provider failure → observed uncertainty → one fresh delivery, then a no-send success replay.
- `tests/integration/commands/admin-invitation-retry-flow.test.ts:189` — `unrecorded reset finalizer failure`: proves observed pending reconciliation makes no second Auth call before one deliberate fresh retry.

### Prove reset authorization and recovery boundaries

The direct-RPC regression covers the database-authoritative tenant boundary and audit state; the mocked command/action seam covers provider response-loss paths that the local Auth transport cannot prove.

- `tests/integration/commands/admin-invitation-retry-flow.test.ts:212` — `finalizer response was lost`: proves reconciliation acknowledges stored success with no second Auth reset request.
- `tests/integration/commands/admin-invitation-retry-flow.test.ts:228` — `reconciliation is unavailable`: proves no delivery and no fresh identity while the read is unavailable.
- `tests/integration/commands/admin-user-management.int.test.ts:46` — `only the reset tenant Admin`: proves create/reconcile/finalize authorization, cross-tenant denial, durable outcome, and the single authorized audit event.

Evidence: root's final combined required verification at 12:40:38 UTC ran `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/commands/admin-user-management.int.test.ts tests/integration/commands/admin-invitation-retry-flow.test.ts`: 2 files, 12/12 passed, zero skips, Vitest duration 3.16 seconds. This includes six real authenticated local-RPC tests and six mocked action/command recovery tests. The preceding recovery-result follow-up passed `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/admin-users/admin-user-service.test.ts` 8/8 and `pnpm run typecheck`; changed-file ESLint passed earlier in this working tree.
Independent focused review: both reset recovery findings are fixed. Fresh delivery uncertainty reaches the action while retaining its operation ID, and a replay that observes a pending outcome after a pre-recording finalizer failure permits one later deliberate fresh ID without delivery during reconciliation. No remaining findings were reported.
Limits: provider and finalizer response-loss tests use mocked Auth/RPC transport; the required local integration suite proves the authenticated database wrappers and tenant isolation, not external Auth email receipt or exactly-once delivery. No browser test was run for this focused server-action recovery change.
