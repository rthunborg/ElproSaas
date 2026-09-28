# Epic 13 follow-up gate classification

Date: 2026-09-27; final closure refreshed 2026-09-28

Product source: `ed439335c585bcb80e97b808d35b2378e7525e6e`

Metadata head: `54181ab7cf352b1255c61f57f859c9db9a19e977` (Story 13.1 specification and convergence evidence only after the product source)

Latest prior full CI checkpoint: `71fa10a` via run `36398591011`; full CI for `ed43933` remains the later root gate.
Purpose: reconcile the completed acceptance trace with the earlier advisory NFR and test-quality reports. This classification does not authorize real-recipient delivery.

## Current sandbox merge gate

The deterministic Epic 13 trace gate is **PASS** at 26/26 P0 acceptance criteria FULL. The final source additionally closes byte-unsafe cron-secret comparison, Stockholm business-date handoff, fresh due-schedule enforcement, carried due-work continuation, and the confirmed off-schedule cursor-scan budget bypass while preserving the earlier bounded producer progress, recovery-HMAC, UUID, exact-role, and request-bound PDF repairs. The mapped inventory is 63 executing cases across 20 files; the containing static inventory is 189 declarations across 34 files.

Current-source focused verification at `ed43933` passed:

- route/auth/runner selection: 30 passed, 0 failed, 0 skipped;
- typecheck and changed-file ESLint: passed;
- Story 13.1 review-order validation: 12 references, 0 errors;
- final narrowed post-fix review: PASS with no remaining consequential finding.

Latest prior full CI run [36398591011](https://github.com/rthunborg/ElproSaas/actions/runs/36398591011) at `71fa10a` passed the unchanged wider Epic 13 surface:

- `verify`: 1,904 unit tests passed; typecheck, lint, build, dependency audit, source containment, and built-bundle containment passed.
- `db`: 1,206 required integration/RLS tests passed; the one explicit skip is the separately isolated recovery-storage proof.
- `recovery-storage-loader`: the isolated proof passed 1/1 with no skip.
- `e2e`: 172 passed, 4 explicit skips, 0 failures. The Epic 13 preference journey now uses one absence case in place of two ineffective-toggle cases.
- Vercel deployment and preview checks succeeded.

This prior run is historical regression evidence. It is not represented as full CI at `ed43933`; that current-source CI run remains the separate root gate.

No acceptance, tenant-isolation, security, data-integrity, or customer-output gap remains open for the authorized sandbox-only release surface.

Current story parsing reports all four stories and Epic 13 `done`. The accepted 2026-09-28 retrospective records zero new action items; its earlier source/count snapshot remains historical and does not override this final `ed43933` trace refresh.

## Earlier advisory items now resolved

| Earlier concern | Current classification | Evidence |
| --- | --- | --- |
| Story 13.4 recipient correction and fresh authorization | Resolved for the sandbox implementation | `13.4-AC6` has command/RPC and required database evidence for cancellation, reissue, actor authority, tenant scope, and frozen recipient state. |
| Final terminal quote-state recheck before provider submission | Resolved for the sandbox implementation | `13.4-AC7` has the pre-provider validation-RPC test plus five producer-boundary terminal-state cases. |
| Durable orphaned/invalidated recovery truth | Resolved for the sandbox implementation | `13.4-AC8` has rollback, durable recovery-ledger, tenant, and actor evidence. |
| Ineffective personal `quote.delivery` preference | Resolved | Registry projection, UI/API exclusion, the database write guard, and recipient-scoped token suppression are covered by focused unit, required database, RLS, and browser evidence. |
| Unbounded active follow-up traversal and lost failed-page checkpoint | Resolved | Route, runner, producer, and fresh-schema cases prove an internal deadline, bounded nested pages and writes, exact tenant/producer resume, retained failed cursor, later-tenant progress, and coherent partial/failed/completed cursor states. |
| Recovery role mismatch and caller-forgeable recovery evidence | Resolved | Required command integration covers all three `Quotes.Send` roles; unit and database evidence bind recovery provenance to a short-lived server HMAC and deny spoofed actor, cross-tenant, and invalid-signature writes. |
| UUID text mismatch across Node/PostgreSQL HMAC inputs | Resolved | Validation and real-command integration canonicalize uppercase quote-version and recipient UUIDs before PDF/recovery signatures. |
| PDF send-role and broker fallback regressions | Resolved | Exact send roles reach the command; the request-bound exact-object read remains primary, the server broker is limited to classified denial on the database-issued path, and raw/general/arbitrary/cross-tenant salesperson access stays denied. |
| Fixed 2026-10-01 scheduler rotation clock | Resolved | The route-auth test freezes time and derives past/future expiry values relative to that clock; checkpoint CI passed after the repair. |
| Cron authentication byte mismatch, Stockholm date, due-window continuation, and off-schedule cursor-scan budget | Resolved | Current-source unit evidence covers UTF-8 byte-length mismatch at verifier and route boundaries, winter/summer/DST date handoff, exact UTC due selection, global/partial/failed continuation, repeated deadlines, budgeted scan progress, newly due tenant-zero restart, and later-tenant fairness. The final narrow review returned PASS. |
| Vercel scheduler plan and production secret prerequisites | Partly resolved operationally | ADR-B011 records an active Pro plan and a provisioned production-only 32-byte `CRON_SECRET`. The deployed production revision still predates Epic 13 and has no cron definition, so post-merge deployment and scheduled-run verification remain outstanding. |

## Remaining test-maintenance actions

These are test-quality concerns, not failures in the current 26/26 acceptance gate.

| Action | Classification | Why it remains |
| --- | --- | --- |
| Replace `Date.now()`, `Math.random()`, and `randomInt` shared browser-fixture identifiers with a replayable run UUID or injected seed | Advisory test repeatability | The current E2E job is green. The inputs still make failed fixture state harder to reproduce and can collide across interrupted or concurrent runs. |
| Clean temporary containment scanner roots and decompose shared test-support hotspots when next touched | Advisory maintenance | The temporary roots are uniquely scoped and the broad fixtures currently pass, but the earlier test review's cleanup and maintainability findings remain open. |

## Historical review-evidence gap

The earlier Auto-BMAD story passes record that configured cross-model reviewer attempts returned no output. That remains historical fact. The persisted independent Luna/xhigh review at `d770780` rechecked the then-final fixes and unresolved serious boundaries for all four stories. The 2026-09-28 bounded ReviewBot convergence then rechecked only the changed Story 13.1 authentication/date/schedule/budget boundaries and their direct regressions at `ed43933`; it recorded PASS with no remaining consequential defect.

The missing historical output is not reclassified as a pass and no unavailable whole-epic review is invented. The deterministic trace gate rests on 26 mapped criteria, 63 executing mapped cases across 20 files, current-source focused convergence evidence, and the prior complete CI evidence for unchanged surfaces. Full CI at `ed43933` remains the root's later gate.

## Separate go-live and operational advisory

The following items do not block merge of the sandbox-only implementation. They block claims of production operational readiness or real-recipient delivery:

- Record owner-approved numeric runner runtime, batch-size, fairness, backlog-age, freshness, concurrency, and capacity limits, then measure them with a defined pilot dataset and worker profile.
- Decide delivery-artifact and operational-event retention/cleanup, stale-claim recovery timing, alert thresholds, incident ownership, RTO/RPO, backup/restore evidence, and recovery exercises. The functional recovery mechanics are implemented; the operational objectives remain owner-pending.
- Deploy the merged Epic 13 revision, install the production cron definition, and retain one redacted scheduled-run verification. The Pro plan and `CRON_SECRET` are prerequisites, not runtime evidence.
- Before any real recipient is enabled, satisfy ADR-B011 with the exact deployment, authenticated sender domain/address, tenant Reply-To behavior, provider and secret rollout, enabled flows, unsubscribe/suppression behavior, sandbox evidence, observed delivery, and rollback/disable steps.
- Complete the deferred real-provider contracts for idempotent submission after provider acceptance with failed outcome persistence, and a scoped unsubscribe URL in every non-essential provider-rendered message.

The earlier NFR report's product-gap statements about AC6-AC8 are superseded by the passing trace. Its unmeasured performance, capacity, retention, recovery, deployment, and live-provider findings remain advisory until owners set targets and retain operating evidence.
