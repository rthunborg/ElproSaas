---
title: 'Story 10.7: PWA + Offline Field Capability'
type: 'feature'
created: '2026-09-03'
status: 'blocked'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - 'C:/DEV/ElproSaas/_bmad-output/project-context.md'
  - 'C:/DEV/ElproSaas/_bmad-output/planning-artifacts/architecture-phase-b.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Field workers need the existing Next.js application to be installable and able to preserve assigned-job capture through intermittent connectivity. A local save must be durable and visibly distinct from a server-authorized, successful sync.

**Approach:** Add a PWA foundation plus a scoped client queue/sync lifecycle and a server replay boundary that reuses the authenticated command envelope. Concrete field-operation adapters must be selected before development, because their data models and permissions determine the replay ledger, idempotency key, conflict checks, and testable acceptance surface.

## Boundaries & Constraints

**Always:** Keep one Next.js app for browser, desktop, tablet, and phone; no native app or separate field app. Treat offline access as a closed capability of previously downloaded assigned/explicitly selected jobs and their minimal entitlement-projected customer/site fields. Queue writes using device-generated operation IDs; replay each through current membership/capability checks, validation, RLS, and audit semantics. Expose exactly `SavedLocally`, `WaitingForSync`, `Syncing`, `Synced`, `Conflict`, or `Failed`; retain failed work with an actionable explanation and retry. Replay on online availability, reconnect, app open, foreground, and manual retry; Background Sync is optional only. Append-only capture must never duplicate; mutable shared state must use optimistic locking and report `SYNC_OPERATION_CONFLICT`, never last-write-wins. Purge local data on a defined expiry and after a successful logout where feasible; never cache data unavailable online, non-assigned jobs, or withheld money.

**Block If:** The first supported offline write type and its active manifest-owned data/command surface are not selected; the retention window, attachment size limit, or legally/technically permitted offline signature contract is not decided; or the work would activate pending resources/scheduling/field surfaces, introduce a new tenant table without an active manifest owner, or cache data the current user cannot read online.

**Never:** Add a native app, a second deployment, global tenant mirroring, offline administration/economy/settings/user-management, a service-role or direct-browser-write sync bypass, a new navigation route/widget/placeholder field screen for a pending module, silent overwrite, or an online-state indicator presented as sync success.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Durable capture then reconnect | A supported, active-domain capture submitted offline | A locally persisted operation with a device operation ID advances through waiting/syncing to `Synced`; one server record and one audit outcome exist after any number of replays | Keep the operation if transfer fails and expose retryable `Failed` |
| Revoked access before replay | Queued operation targets a job no longer readable by the actor | Server reauthorizes through the normal envelope and rejects without a partial write or target-existence disclosure | Retain the queue item as explained `Failed`; do not retry it automatically as authorized |
| Stale shared change | Queued mutable operation carries an outdated version | Server returns `SYNC_OPERATION_CONFLICT`; neither value is silently overwritten | Preserve the queued data and present `Conflict` for an explicit later resolution |
| Reopen without Background Sync | Unsynced local work exists and the browser never ran Background Sync | App-open lifecycle discovers and processes queued work when connectivity permits | Queue remains durable until `Synced` or an explicit user resolution |
| Shared-device lifecycle | Logout succeeds or cached data reaches expiry | Scoped queue and cached projection are purged | Do not purge merely because an attempted logout failed while the session may still be valid |

</intent-contract>

## Code Map

- `C:/DEV/ElproSaas/src/app/layout.ts` -- root metadata only; PWA manifest/installability has no existing implementation.
- `C:/DEV/ElproSaas/next.config.ts` and `C:/DEV/ElproSaas/package.json` -- no current service-worker, PWA, or durable-browser-storage configuration/dependency; choose a compatible implementation only after the unresolved platform decisions are made.
- `C:/DEV/ElproSaas/src/components/app-shell/SignOutButton.tsx` -- successful sign-out redirect is the client purge integration seam; it currently clears no application storage.
- `C:/DEV/ElproSaas/src/server/commands/envelope.ts` and `C:/DEV/ElproSaas/src/server/commands/envelope-core.ts` -- authorization, validation, RLS ownership, and audit sequence that server replay must preserve.
- `C:/DEV/ElproSaas/src/server/commands/correlation.ts` -- tracing correlation IDs are not durable offline operation-idempotency keys; do not reuse as a replay ledger.
- `C:/DEV/ElproSaas/src/features/jobs/actions.ts` and `C:/DEV/ElproSaas/src/server/commands/jobs/jobs.ts` -- currently active job command seam; `updateJob` lacks an optimistic-lock version contract.
- `C:/DEV/ElproSaas/src/scope/manifest.ts` and `C:/DEV/ElproSaas/src/scope/manifest-schema.ts` -- jobs/files are active, while resources/scheduling and field surfaces remain pending; manifest-derived live-surface checks forbid unapproved expansion.
- `C:/DEV/ElproSaas/tests/integration/commands/update-job.int.test.ts` -- closest tenant/RLS/audit command proof pattern.
- `C:/DEV/ElproSaas/tests/factories/tenants.ts`, `C:/DEV/ElproSaas/tests/support/stack-gate.ts`, and `C:/DEV/ElproSaas/playwright.config.ts` -- two-tenant integration fixture and local-stack/production-build test foundations; no offline or service-worker harness exists yet.

## Tasks & Acceptance

Execution is blocked pending the owner/product decision below; no implementation task is safely actionable without choosing the active data surface and operation contract.

**Acceptance Criteria once unblocked:**

- Given a selected active field-capture operation, when it is submitted offline and replayed repeatedly, then it creates exactly one authorized, audited server result using its device-generated operation ID.
- Given a previously assigned job and an entitlement-projected cache, when access is revoked or cache expiry/logout applies, then replay is denied without partial write and local data is absent according to the lifecycle rule.
- Given the same application in a browser or installed form, when connectivity changes or the app is reopened, foregrounded, or manually retried, then queued work visibly follows the closed sync-state model without relying on Background Sync.
- Given a stale shared mutable operation, when it reaches the server, then it reports `SYNC_OPERATION_CONFLICT` and preserves both values for an explicit resolution rather than overwriting.

## Design Notes

ADR-B007 assigns Story 10.7 the platform capability, but its Story 10.7 acceptance list names field writes (time, material, checklist, deviation, attachment, start/complete, signature) whose authoritative data schemas, assigned-job policy, Montör capability model, and routes belong to pending E14–E18 work. The current repository has only `tenant_admin`, active jobs/files, server actions for online requests, and no generic operation ledger or optimistic-lock version. A platform-only build is compatible with the ADR, but cannot truthfully demonstrate the required per-write replay guarantees until an active first operation is designated. Selecting a pending field surface would violate the manifest governance rule.

## Verification

After the scope/operation decision, use pure queue-state tests, local-stack two-tenant integration tests under `tests/integration/sync/`, and Playwright coverage for installability, offline/reopen retry, failed-transfer retention, and successful logout purge. The required proofs are replay idempotency for every supported write type, authorization-on-sync with no partial write, scope and entitlement containment, expiry/logout purge, no-data-loss on transfer failure, and reprocess-on-open without Background Sync.

## Auto Run Result

Status: blocked
Blocking condition: intent gap

Unanswered questions and evidence:

- Which first concrete offline write type and currently active manifest-owned command/data surface must Story 10.7 implement? The story requires field writes, while resources, scheduling, assignment, Montör capabilities, and the corresponding E14–E18 field surfaces are pending (`C:/DEV/ElproSaas/src/scope/manifest.ts`; `C:/DEV/ElproSaas/_bmad-output/planning-artifacts/architecture-phase-b.md` §§8A.3, 8A.7).
- What defined retention duration and attachment/photo size limit govern durable device storage? N-3 requires both but specifies neither (`C:/DEV/ElproSaas/docs/discovery/phase-b-owner-answers-2026-07-26.md` §§N-3).
- What offline signature/confirmation payload and legal criterion are permitted? The owner and ADR require it only where technically and legally sound, without selecting a contract (`C:/DEV/ElproSaas/_bmad-output/planning-artifacts/architecture-phase-b.md` §8A.3).
- Is Story 10.7 intentionally limited to PWA/queue/replay platform seams, with the named field-operation acceptance evidence delivered by E14–E18, or is it authorized to activate/introduce the missing field data and capability surfaces now? ADR-B007 says Story 10.7 owns platform-level capability while the epics document states AC2 as concrete capture; those readings lead to materially different schema, scope-manifest, security, and test work.
