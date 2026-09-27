# Epic 13 follow-up gate classification

Date: 2026-09-27  
Source: `83da25fde36a0f6fb44cd29e3c6812532650ff28`  
Purpose: reconcile the completed acceptance trace with the earlier advisory NFR and test-quality reports. This classification does not authorize real-recipient delivery.

## Current sandbox merge gate

The deterministic Epic 13 trace gate is **PASS** at 26/26 P0 acceptance criteria FULL. The approved `quote.delivery` preference remediation keeps the outbox category active, removes the ineffective personal controls, rejects new preference writes at API and database boundaries, and preserves recipient-scoped unsubscribe suppression.

Required CI run [36339205329](https://github.com/rthunborg/ElproSaas/actions/runs/36339205329) passed at the exact source SHA:

- `verify`: 1,896 unit tests passed, 0 failed, 0 skipped; typecheck, lint, build, dependency audit, source containment, and built-bundle containment passed.
- `db`: 1,205 required integration/RLS tests passed; the one explicit skip is the separately isolated recovery-storage proof.
- `recovery-storage-loader`: the isolated proof passed 1/1 with no skip.
- `e2e`: 172 passed, 4 explicit skips, 0 failures. The Epic 13 preference journey now uses one absence case in place of two ineffective-toggle cases.

No acceptance, tenant-isolation, security, data-integrity, or customer-output gap remains open for the authorized sandbox-only release surface.

## Earlier advisory items now resolved

| Earlier concern | Current classification | Evidence |
| --- | --- | --- |
| Story 13.4 recipient correction and fresh authorization | Resolved for the sandbox implementation | `13.4-AC6` has command/RPC and required database evidence for cancellation, reissue, actor authority, tenant scope, and frozen recipient state. |
| Final terminal quote-state recheck before provider submission | Resolved for the sandbox implementation | `13.4-AC7` has the pre-provider validation-RPC test plus five producer-boundary terminal-state cases. |
| Durable orphaned/invalidated recovery truth | Resolved for the sandbox implementation | `13.4-AC8` has rollback, durable recovery-ledger, tenant, and actor evidence. |
| Ineffective personal `quote.delivery` preference | Resolved | Registry projection, UI/API exclusion, the database write guard, and recipient-scoped token suppression are covered by focused unit, required database, RLS, and browser evidence. |
| Vercel scheduler plan and production secret prerequisites | Partly resolved operationally | ADR-B011 records an active Pro plan and a provisioned production-only 32-byte `CRON_SECRET`. The deployed production revision still predates Epic 13 and has no cron definition, so post-merge deployment and scheduled-run verification remain outstanding. |

## Remaining test-maintenance actions

These are test-quality concerns, not failures in the current 26/26 acceptance gate.

| Action | Classification | Why it remains |
| --- | --- | --- |
| Replace the fixed `2026-10-01` previous-secret expiry in `route-auth.test.ts` with an injected or controlled clock | Time-bounded CI maintenance; complete before 2026-10-01 | The current exact-HEAD CI passes, but a later run will produce a false failure when the wall clock reaches the hard-coded date. If the branch is still unmerged then, this becomes a merge blocker. |
| Replace `Date.now()`, `Math.random()`, and `randomInt` shared browser-fixture identifiers with a replayable run UUID or injected seed | Advisory test repeatability | The current E2E job is green. The inputs still make failed fixture state harder to reproduce and can collide across interrupted or concurrent runs. |
| Clean temporary containment scanner roots and decompose shared test-support hotspots when next touched | Advisory maintenance | The temporary roots are uniquely scoped and the broad fixtures currently pass, but the earlier test review's cleanup and maintainability findings remain open. |

## Historical review-evidence gap

The earlier Auto-BMAD story passes record that the configured cross-model reviewer returned no output. That remains an unavailable historical review layer. The 2026-09-27 independent security follow-up reviewed only the `83da25f` preference-removal delta and unresolved serious findings under the post-round-three rule; it does not retroactively validate the whole epic or replace the missing cross-model output.

This is a process-evidence concern rather than an acceptance-coverage failure. The deterministic trace gate rests on the 26 mapped criteria, exact-HEAD required CI, and the scoped security follow-up for the newest change. Keep the historical flag visible in the completion record; do not present it as either a whole-epic review pass or a newly discovered product defect.

## Separate go-live and operational advisory

The following items do not block merge of the sandbox-only implementation. They block claims of production operational readiness or real-recipient delivery:

- Record owner-approved numeric runner runtime, batch-size, fairness, backlog-age, freshness, concurrency, and capacity limits, then measure them with a defined pilot dataset and worker profile.
- Decide delivery-artifact and operational-event retention/cleanup, stale-claim recovery timing, alert thresholds, incident ownership, RTO/RPO, backup/restore evidence, and recovery exercises. The functional recovery mechanics are implemented; the operational objectives remain owner-pending.
- Deploy the merged Epic 13 revision, install the production cron definition, and retain one redacted scheduled-run verification. The Pro plan and `CRON_SECRET` are prerequisites, not runtime evidence.
- Before any real recipient is enabled, satisfy ADR-B011 with the exact deployment, authenticated sender domain/address, tenant Reply-To behavior, provider and secret rollout, enabled flows, unsubscribe/suppression behavior, sandbox evidence, observed delivery, and rollback/disable steps.
- Complete the deferred real-provider contracts for idempotent submission after provider acceptance with failed outcome persistence, and a scoped unsubscribe URL in every non-essential provider-rendered message.

The earlier NFR report's product-gap statements about AC6-AC8 are superseded by the passing trace. Its unmeasured performance, capacity, retention, recovery, deployment, and live-provider findings remain advisory until owners set targets and retain operating evidence.
