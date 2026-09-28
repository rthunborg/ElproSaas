# Epic 13 follow-up gate classification

Date: 2026-09-27; final closure refreshed 2026-09-28

Product source: `8b2093374b73a1b419b51be1068a2263e0e11f2f`

Test-only head: `88eadaf9df5e26f753dfd1a3197f7124cb882208`; docs evidence head: `ccd780dc885faeba96e4e66d211dae40d3e202f4`

Fresh full CI checkpoint: `0a7afbee954ca2e70e7a1f9039b4a547ff761851` via run `36423047278`; product source remains `8b209337`, with test-only repair `88eadaf` and docs closure `ccd780d`.
Purpose: reconcile the completed acceptance trace with the earlier advisory NFR and test-quality reports. This classification does not authorize real-recipient delivery.

## Current sandbox merge gate

The deterministic Epic 13 trace gate is **PASS** at 26/26 P0 acceptance criteria FULL. The final source additionally closes stable keyset continuation, atomic run/audit persistence, missing-HMAC durable recovery, Bell mutation-plus-reload rollback, Stockholm business dates, static multi-schedule crossover, and exhausted legacy continuation. The mapped inventory is 73 cases across 20 files; the containing static inventory is 199 declarations across 34 files.

Current-source focused verification at `8b209337` passed:

- primary focused selection: 37 passed, 0 failed, 0 skipped;
- final runner selection: 23 passed, 0 failed, 0 skipped;
- typecheck and changed-file ESLint: passed;
- review-order validation for Stories 13.1/13.2/13.4: 11/5/8 references, 0 errors;
- the native Luna/xhigh finding on exhausted legacy continuation was fixed; final changed-line Sol closure found no unresolved serious defect.

Fresh full CI run [36423047278](https://github.com/rthunborg/ElproSaas/actions/runs/36423047278) at `0a7afbee` passed the complete current Epic 13 surface:

- `verify`: 1,923 unit tests passed with zero failures or skips; typecheck, lint, build, dependency audit, source containment, and built-bundle containment passed.
- `db`: 1,208 required integration/RLS tests passed under `SUPABASE_TEST_REQUIRED=1`; the one explicit skip is the separately isolated recovery-storage proof.
- `recovery-storage-loader`: the isolated proof passed 1/1 with no skip.
- `e2e`: 174 passed, 4 explicit skips, 0 failures. The corrected mark-all POST-plus-reload rollback scenario passed in 836 ms at 12:44:42 UTC.
- Vercel deployment and preview checks succeeded.

Earlier CI `36421169336` remains historical with 173 E2E passes, one shared-finance-fixture failure, and four skips; `88eadaf` repaired that test-only state leak. The initial local integration selection also remains historical at 8 tests, 5 passed, 3 failed, and 0 skipped because the RPCs were absent and the pre-existing `email_outbox_delivery_identity_key` history mismatch prevented applying them. Fresh CI `36423047278` now proves atomic rollback, missing-secret tenant/actor denial and non-admin success, both Bell double-failure journeys, and the complete unchanged matrix.

No acceptance, tenant-isolation, security, data-integrity, or customer-output gap remains open for the authorized sandbox-only release surface.

Current story parsing reports all four stories and Epic 13 `done`. The accepted 2026-09-28 retrospective records zero new action items; its earlier source/count snapshot remains historical and does not override this `8b209337` trace refresh.

## Earlier advisory items now resolved

| Earlier concern | Current classification | Evidence |
| --- | --- | --- |
| Story 13.4 recipient correction and fresh authorization | Resolved for the sandbox implementation | `13.4-AC6` has command/RPC and required database evidence for cancellation, reissue, actor authority, tenant scope, and frozen recipient state. |
| Final terminal quote-state recheck before provider submission | Resolved for the sandbox implementation | `13.4-AC7` has the pre-provider validation-RPC test plus five producer-boundary terminal-state cases. |
| Durable orphaned/invalidated recovery truth | Resolved for the sandbox implementation | `13.4-AC8` retains signed rollback/recovery evidence and adds the service-only missing-secret writer, exact `Quotes.Send` actors, and direct/cross-tenant/spoofed-actor denials. Fresh required-database CI passed. |
| Ineffective personal `quote.delivery` preference | Resolved | Registry projection, UI/API exclusion, the database write guard, and recipient-scoped token suppression are covered by focused unit, required database, RLS, and browser evidence. |
| Unbounded active follow-up traversal and lost failed-page checkpoint | Resolved | Route, runner, producer, and fresh-schema cases prove an internal deadline, bounded nested pages and writes, exact tenant/producer resume, retained failed cursor, later-tenant progress, and coherent partial/failed/completed cursor states. |
| Recovery role mismatch and caller-forgeable recovery evidence | Resolved | Required command integration covers all three `Quotes.Send` roles; unit and database evidence bind recovery provenance to a short-lived server HMAC and deny spoofed actor, cross-tenant, and invalid-signature writes. |
| UUID text mismatch across Node/PostgreSQL HMAC inputs | Resolved | Validation and real-command integration canonicalize uppercase quote-version and recipient UUIDs before PDF/recovery signatures. |
| PDF send-role and broker fallback regressions | Resolved | Exact send roles reach the command; the request-bound exact-object read remains primary, the server broker is limited to classified denial on the database-issued path, and raw/general/arbitrary/cross-tenant salesperson access stays denied. |
| Fixed 2026-10-01 scheduler rotation clock | Resolved | The route-auth test freezes time and derives past/future expiry values relative to that clock; checkpoint CI passed after the repair. |
| Cron authentication, Stockholm date, keyset/due-window continuation, and cursor budget | Resolved | Current-source unit evidence covers byte-safe authentication, Stockholm date handoff, exact UTC due selection, keyset insert/delete behavior, static multi-schedule crossover, repeated deadlines, newly due tenant-zero restart, exhausted legacy targets, and later-tenant fairness. The final runner selection passed 23/23. |
| Vercel scheduler plan and production secret prerequisites | Partly resolved operationally | ADR-B011 records an active Pro plan and a provisioned production-only 32-byte `CRON_SECRET`. The deployed production revision still predates Epic 13 and has no cron definition, so post-merge deployment and scheduled-run verification remain outstanding. |

## Remaining test-maintenance actions

These are test-quality concerns, not failures in the current 26/26 acceptance gate.

| Action | Classification | Why it remains |
| --- | --- | --- |
| Replace `Date.now()`, `Math.random()`, and `randomInt` shared browser-fixture identifiers with a replayable run UUID or injected seed | Advisory test repeatability | The current E2E job is green. The inputs still make failed fixture state harder to reproduce and can collide across interrupted or concurrent runs. |
| Clean temporary containment scanner roots and decompose shared test-support hotspots when next touched | Advisory maintenance | The temporary roots are uniquely scoped and the broad fixtures currently pass, but the earlier test review's cleanup and maintainability findings remain open. |

## Historical review-evidence gap

The configured external Luna CLI exited 1 without output and is not reclassified as a pass. The authorized native Luna/xhigh fallback reviewed only the latest follow-up boundaries and found the exhausted legacy-cursor replay; it was fixed in `8b209337`. The final changed-line Sol closure found no unresolved serious defect.

No unavailable whole-epic review is invented. The deterministic trace gate rests on 26 mapped criteria, 73 mapped cases across 20 files, current-source focused evidence, and fresh CI `36423047278`, which passed all required checks.

## Separate go-live and operational advisory

The following items do not block merge of the sandbox-only implementation. They block claims of production operational readiness or real-recipient delivery:

- Record owner-approved numeric runner runtime, batch-size, fairness, backlog-age, freshness, concurrency, and capacity limits, then measure them with a defined pilot dataset and worker profile.
- Decide delivery-artifact and operational-event retention/cleanup, stale-claim recovery timing, alert thresholds, incident ownership, RTO/RPO, backup/restore evidence, and recovery exercises. The functional recovery mechanics are implemented; the operational objectives remain owner-pending.
- Deploy the merged Epic 13 revision, install the production cron definition, and retain one redacted scheduled-run verification. The Pro plan and `CRON_SECRET` are prerequisites, not runtime evidence.
- Before any real recipient is enabled, satisfy ADR-B011 with the exact deployment, authenticated sender domain/address, tenant Reply-To behavior, provider and secret rollout, enabled flows, unsubscribe/suppression behavior, sandbox evidence, observed delivery, and rollback/disable steps.
- Complete the deferred real-provider contracts for idempotent submission after provider acceptance with failed outcome persistence, and a scoped unsubscribe URL in every non-essential provider-rendered message.

The earlier NFR report's product-gap statements about AC6-AC8 are superseded by the passing trace. Its unmeasured performance, capacity, retention, recovery, deployment, and live-provider findings remain advisory until owners set targets and retain operating evidence.
