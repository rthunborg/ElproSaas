---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
workflowType: 'testarch-atdd'
lastSaved: '2026-10-07'
storyId: '14.4'
storyKey: 'spec-14-4-booking-editor-with-live-conflict-warnings-and-audited-override'
storyFile: 'C:/DEV/ElproSaas/_bmad-output/implementation-artifacts/spec-14-4-booking-editor-with-live-conflict-warnings-and-audited-override.md'
atddChecklistPath: 'C:/DEV/ElproSaas/_bmad-output/test-artifacts/atdd-checklist-spec-14-4-booking-editor-with-live-conflict-warnings-and-audited-override.md'
generatedTestFiles:
  - 'C:/DEV/ElproSaas/tests/integration/commands/booking-editor.int.test.ts'
  - 'C:/DEV/ElproSaas/tests/e2e/booking-editor.e2e.spec.ts'
  - 'C:/DEV/ElproSaas/tests/integration/components/booking-editor.test.ts'
  - 'C:/DEV/ElproSaas/tests/unit/features/resources/booking-editor-input.test.ts'
  - 'C:/DEV/ElproSaas/tests/unit/scope/booking-editor-scope.test.ts'
inputDocuments:
  - '_bmad-output/implementation-artifacts/spec-14-4-booking-editor-with-live-conflict-warnings-and-audited-override.md'
  - 'docs/decisions/epic-14-story-ownership-contract-d-2026-10-07.md'
  - '_bmad-output/test-artifacts/test-design-epic-14.md'
  - '_bmad/tea/config.yaml'
  - 'docs/process/agent-model-routing.md'
  - 'playwright.config.ts'
  - 'vitest.config.ts'
  - 'tests/support/bookings-atdd.ts'
  - 'tests/support/booking-conflicts-atdd.ts'
---

# Story 14.4 ATDD checklist

## Preflight and generation decision

Create mode; Rasmus's prompts/checkpoints are answered autonomously as authorized. Story is approved ready-for-dev at baseline `5ce4d6b5`; current root checkpoint `1cca8cd3`. Detected stack: frontend/full-stack behavior on Next.js/TypeScript, configured Playwright, Node test and Vitest. AI generation selected because the editor does not yet exist and approved outer behavior is explicit. No browser recording or new resource launch is required. Root confirmed the isolated local stack API 55421/DB 55422 ready; collection alone requires no workload startup.

Customization resolver could not initialize its external uv cache (native exit 1); manual base/team/user merge found default workflow with empty activation/persistent/completion hooks and no team/user files. No workaround altered the environment.

TEA flags: playwright-utils=true, pactjs-utils=true, pact_mcp=mcp, browser_automation=auto, execution_mode=auto, capability_probe=true. Neither integration package is installed; the binding library mandate requires flag AND installed package. Preserve existing project runners/fixtures and add no dependencies. Pact is not relevant to this in-process command/RPC boundary; tool-list probe finds no Pact MCP tools, `pact_mcp_reachable=false`, fallback provider-source. No broker call. Existing command/envelope/checked SQL source supplies the provider contract; no endpoint is invented.

## Acceptance strategy

| AC | Obligation | Level / priority | Observable boundary |
| --- | --- | --- | --- |
| 1 | COMP-001/002, retained E2E-006, E2E-001 | Component P1; browser P0/P1 | Sheet fields/structure and actual toolbar/job/customer create/edit at desktop/360×640 |
| 2 | COMP-003/004 | Component P1; command P0 | Sole-engine candidate projection, latest response wins, failed preview visibly unknown |
| 3 | INT-001/002/003 | Command/RPC P0 | Current explicit review, selected whole groups, no-op denials and atomic attributable commit |
| 4 | INT-004/005, E2E-002 | Command P0; browser P1 | Exact unchanged-key evidence and changed-key reopening; persisted open-only count on reload |
| 5 | E2E-003/007 | Browser P1 | Dirty close/back/Escape cancel/discard, focus return, pending dismissal guard |
| 6 | E2E-004/005 | Browser P0; command P0 | Explicit retry after transient failure/lost response with exact durable one-write state |
| 7 | GOV-001 and retained RLS | Command/RPC P0; scope P0 | Current booking entitlement, own-person read scope, cross-tenant denial, pending scheduling |

Sensitive scenario authoring is routed to context-free `gpt-6.1-sol` High workers for auth/replay/atomic override. No duplicate broad predecessor execution. RED scaffolds remain explicitly skipped under the named skill; skipped assertions are not implementation coverage. Activation must replace any missing binding with actual production adapters, then fail at the intended behavior before implementation; missing module/seam is a preimplementation RED reason, never a claimed behavioral pass.

## Generation execution and confidence

Capability probe: subagent tools available; no separate agent-team orchestration primitive. Config auto therefore resolves to subagent mode. Two required workers (API, E2E) and a supporting component/input/scope worker have independent artifact ownership and run at High for the actual sensitive decision/replay/transactional scope. All are foreground dependencies and must finish before aggregation. Worker JSON stays under this test-artifacts directory; no `/tmp` handoff is required.

Confidence: 8/10 for contract authoring, 7/10 for fixture composition. Rationale: approved spec Tasks & Acceptance and Contract D define all retained behavior; `bookings-atdd.ts`, `booking-conflicts-atdd.ts`, checked SQL and `resource-cdp-attachment.ts` supply actual command, durable snapshot and browser fixture boundaries. Unknowns: new production export signatures and editor selectors are absent. Test-owned typed bindings/semantic IDs are explicit engineering contracts to wire during GREEN; no proposed names are claimed observed product APIs. Actor/current facts/atomic acceptance/replay denials are P0 because these changes introduce concrete data-integrity and authority boundaries; presentation-only checks are P1.

## Ownership and exclusions

Only tests, fixture adapters, worker JSON, and this checklist may change. Preserve the spec. No migrations, source, dependencies, env, root progress state, sprint state, commits or PRs. Only the empty-slot click/drag portion of 14.4-E2E-006 transfers to Story 15.1 and must pass on real Schema/Resurser hosts before exposure/completion; prefill seam checks give no transferred execution credit. All other 14.4 acceptance remains. Resources active/scheduling pending; ADR-B009 connected web with confirmation, no offline/PWA/Phase C.

## Story summary and handoff

An entitled planner/admin needs the responsive booking editor to create and edit standalone or connected bookings, inspect current authoritative warnings, and deliberately save with selected accepted conflicts and attributable evidence. Success requires confirmed persistence; stale human review cannot survive an automatic detector retry. The primary test level is command/RPC integration, complemented by actual browser journeys and structural component/pure-input checks.

Use the `storyFile`, `atddChecklistPath` and `generatedTestFiles` frontmatter as the implementation handoff. The spec is intentionally unchanged per parent ownership; all artifact links live here. The next workflow is the already-approved official story development, followed by postdevelopment TEA automation. No new story approval is needed for routine adapter signature choices within the approved boundaries.

## RED scaffolds and exact obligations

| Artifact | Scenarios | Lines | Priority | Expected RED before implementation |
| --- | ---: | ---: | --- | --- |
| [Command/RPC](../../tests/integration/commands/booking-editor.int.test.ts) | 58 | 628 | P0 57 / P1 1 | `loadBookingEditorBindings` fails closed; then actual receipt/decision/atomic-acceptance behavior must fail before GREEN |
| [Browser](../../tests/e2e/booking-editor.e2e.spec.ts) | 13 | 370 | P0 5 / P1 8 | `bindBookingEditorHarness` is unbound; future actual editor/entries/transport do not exist yet |
| [Component](../../tests/integration/components/booking-editor.test.ts) | 9 | 120 | P1 9 | Actual Editor, Panel and preview state-transition bindings are absent |
| [Input](../../tests/unit/features/resources/booking-editor-input.test.ts) | 11 | 92 | P0 1 / P1 10 | Actual decision/time-input functions are unbound |
| [Scope](../../tests/unit/scope/booking-editor-scope.test.ts) | 1 | 30 | P0 1 | Actual new editor rendering is absent; existing manifest alone is not new RED evidence |
| **Total** | **92** | | **P0 64 / P1 28** | **All declarations explicitly skipped; no completed acceptance coverage** |

Command cases cover INT-001 current whole-set acknowledgment/reason and stable create UUID; INT-002 complete selected groups including a candidate third in four participants, actor/SQL time/one audit and fault rollback; INT-003 forged/unrelated/partial review, candidate/fact/expiry changes, concurrent writers, separate proof/receipt domains, direct authenticated RPC/obsolete overload gates and cross-tenant denials; INT-004 empty selection/unselected OPEN/read-scope count; INT-005 unchanged acceptance and changed identity reopening. New semantic replay cases cover changed reason/selection versus normalized permutation/trim/transport renewal, historical retry after facts/expiry drift, and revoked current actor. They assert exact two-tenant booking/assignment/conflict/private command-outcome/all-audit state. Checked ACL inventory remains an actual runtime/SQL binding obligation, not a guessed fixed RPC signature.

The 13 expanded browser cases are toolbar standalone create; job create/reopen/edit; customer create/reopen/edit; phone full-screen/scroll/target measurement; persistent OPEN count after reload; dirty Escape; dirty close; dirty back; pending dismissal guard; transient phone failure/explicit retry; lost committed phone response/one durable result; newest-preview/unknown failure; keyboard focus/live timeline. These cover all retained E2E-001…007. No real empty-slot click/drag, calendar host, navigation or recurrence scaffold is introduced.

Component cases map COMP-001 modal structure/no recurrence, COMP-002 fields/optional connections/prefill, COMP-003 real preview-state race/invalidation, and COMP-004 explanations/timeline/unknown retry semantics. SSR establishes structure only. Browser tests remain responsible for actual focus trapping, viewport, changes and persistence. Pure input cases separately cover normalization, duplicate/unknown-authority input, empty subset, untouched microseconds, Stockholm fold/gap and 23/25-hour all-day bounds; they do not duplicate the sole conflict detector.

## Factories, fixtures and required bindings

| Fixture contract | Created helpers / setup and cleanup responsibility |
| --- | --- |
| [Command adapter](../../tests/support/booking-editor-atdd.ts) | Typed `EditorBindings` and fail-closed loader. Reuses `withConflictFixture`, `bookingInput`, exact `bookingSnapshot` and real commands/checked SQL; mixed peers/control groups must derive expected identities independently from seeded facts. Real signed attacks and transaction barriers must preserve validation, authorization, detection and replies. Fault hooks must prove acceptance was reached, be correlation-scoped/private, and clean up in finally. |
| [Browser adapter](../../tests/e2e/support/booking-editor-atdd.ts) | Composes existing guarded `resourcePage`; typed per-test `bookingEditor` harness. Scoped execution-only setup with existing `.auth/fixture.json` and local admin-SQL; deterministic fixed Stockholm ranges and unique descriptions/IDs. Actual Next action transport observation/hold/failure/response-loss precedes actions; dispose releases all holds/listeners/routes and owned rows. No synthetic durable result or fake detector. |
| [Component/input adapter](../../tests/support/booking-editor-contract.ts) | Fresh pure `booking`, `warning`, `editor`, `decision` factories with overrides and typed bindings for actual Editor/Panel/parser/time preparation/preview state. No DB/network setup or behavior implementation in the adapter. Fixed IDs are intentional deterministic identity/order fixtures, never shared persistent rows. |

Three typed fixture contracts and four component/input factories are created. Actual production binding implementations are intentionally deferred, so setup/teardown behavior has not executed. Existing `crypto.randomUUID` factories provide persistent-fixture uniqueness; no new faker dependency is added. The command and component fixture DTOs normalize actual production signatures only and must never become a second product implementation or detector.

Duplicate selected logical IDs currently expect validation failure, matching existing assignee validation and the approved duplicate-free contract. Canonical deduplication is an acceptable engineering alternative if the development author records its rationale and proves the same business decision identity; this is not a new owner decision. Semantic decisions exclude receipt/signature/issued/expiry/correlation transport. The command fixture's receipt field is a test-owned transport association; the pure decision contract deliberately excludes it.

## Mock and selector requirements

External service mocks: **0**. Pact: N/A to this in-process boundary. No new HTTP endpoint is guessed. Real Next action save/preview transport needs narrow observers, deterministic hold/release, transient prewrite error, and response loss only after durable commit. Expected errors remain safe `{ok:false,code,message}` command results; checked SQL uses existing generic authority/validation errors plus approved stale/unacknowledged contracts. No response schema exists yet for the new preview; assertions cover the story's fields and browser exclusions only.

Planned selectors are contracts to bind during development, not live observations. The browser uses semantic roles/labels and these test IDs:

- Editor/form: `booking-editor`, `booking-editor-scroll-body`, `booking-description`, `booking-start`, `booking-end`, `booking-work-role`, `booking-status`, `booking-all-day`, `booking-job`, `booking-customer`, `booking-facility`, `booking-contact`, `booking-availability`, `booking-assignee-option-<personId>`.
- Entries/readback: `booking-entry-toolbar`, `booking-entry-job`, `booking-entry-customer`, `booking-summary-<bookingId>`, `booking-edit`, `booking-open-conflict-count`.
- Save/close/retry: `booking-save`, `booking-save-status`, `booking-save-error`, `booking-unsent`, `booking-retry`, `booking-close`, `booking-discard-confirmation`, `booking-keep-editing`, `booking-discard`.
- Warnings/review: `booking-conflict-panel`, `booking-review-current-warnings`, `booking-select-logical-<logicalId>`, `booking-override-reason`, `booking-preview-error`, `booking-preview-unknown`, `booking-conflict-free`.
- Structural-only contracts additionally use `booking-editor-sheet`, `booking-work-role-filter`, `booking-conflict-timeline`. Signature/markup translation may unify these with actual browser contracts; no extra product controls are authorized by an ID.

## Implementation activation checklist

- [ ] Task 1: bind actual closed input/canonical human decision/time preparation, typed safe stale/unacknowledged errors; activate pure input cases and prove behavioral RED before implementation, then GREEN.
- [ ] Task 2: bind the sole-engine sanitized preview and full logical-group map, stable proposed-create identity and distinct authenticated browser receipt; activate preview/receipt/candidate-fact-race cases. Never synthesize warnings or proof verification in tests.
- [ ] Task 3: implement the approved forward migration and current first-gate/fresh-review/whole-group atomic acceptance; bind actual checked SQL inventory, semantic replay and correlation-scoped failure barriers. Activate INT-001…005, direct RPC/ACL/RLS/replay cases and record exact no-op versus attributable commit evidence.
- [ ] Task 4: bind checked read/action/pickers and entitlement; assert own-person scope and generic foreign denials, exact original microseconds, host-scoped persistent OPEN count and confirmed-only revalidation.
- [ ] Task 5: bind actual Editor/Panel/preview state and existing hosts, semantic selectors, dirty/pending protection and connected error/retry. Activate component structure/state then browser toolbar/job/customer/phone/keyboard flows against the configured production server with root-owned lifecycle.
- [ ] Task 6: remove skips task-by-task; confirm the intended behavior fails before its implementation and passes after it. All 92 retained scenarios must execute for completion, with explicit failure/skip counts and required integration gates. Do not accept missing-binding probes as behavioral RED evidence.
- [ ] Task 7: development author records actual revision/commands/AC mapping and final Suggested Review Order; parent owns story/workflow state/Git/PR. ATDD never marks implementation done.

Estimate: use the approved story's oversized implementation plan; this workflow does not manufacture hours/story points or performance targets. Numeric performance gating and manual contrast/daylight readability remain N/A to RED scaffold generation.

## Running and red-green-refactor

Run from `C:/DEV/ElproSaas`, using the privately loaded owner-approved isolated test profile (API 55421 / DB 55422) and `SUPABASE_TEST_REQUIRED=1`. Do not print credentials or put database URLs on argv. Ordinary `pnpm` commands below assume that private environment is already loaded:

```text
pnpm exec vitest run tests/integration/commands/booking-editor.int.test.ts tests/integration/components/booking-editor.test.ts
node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/features/resources/booking-editor-input.test.ts tests/unit/scope/booking-editor-scope.test.ts
pnpm exec playwright test tests/e2e/booking-editor.e2e.spec.ts --list
pnpm run typecheck
pnpm exec eslint tests/integration/commands/booking-editor.int.test.ts tests/e2e/booking-editor.e2e.spec.ts tests/integration/components/booking-editor.test.ts tests/unit/features/resources/booking-editor-input.test.ts tests/unit/scope/booking-editor-scope.test.ts tests/support/booking-editor-atdd.ts tests/e2e/support/booking-editor-atdd.ts tests/support/booking-editor-contract.ts
```

The saved [bounded validator](story14-4-atdd-validate.mjs) runs equivalent configured tool binaries with the private profile read only, explicit REQUIRED=1 and no secret argv. `verify` records registration/typecheck/lint; `probe` records missing-binding failures. `aggregate` refuses existing test files rather than overwriting another author's work.

After binding/activation and root-managed production server readiness, run `pnpm exec playwright test tests/e2e/booking-editor.e2e.spec.ts`; optional `--headed` or `--debug` requires a user-approved interactive browser/lifecycle. The configured production Playwright server applies; never use Next dev or allow unmanaged webServer launch. Run the story's required broader integration/RLS/empty-DB Epic CI sequence during development before merge. No unchanged full predecessor test run was performed by ATDD.

RED scaffold generation is complete; behavioral RED/ GREEN are next. Wire a thin actual adapter, activate one current task's scenario, demonstrate failing expected behavior, implement minimally and prove GREEN; then refactor with the same behavioral assertions. Keep failures visible; do not weaken the invariants or leave unexecuted skips as completion evidence.

## Exact execution evidence — final assembled files

| Check | Registered / collected | Executed | Passed | Failed | Skipped | Native exit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Required Vitest command + component | 67 | 0 | 0 | 0 | 67 | 0 |
| Node pure input + scope | 12 | 0 | 0 | 0 | 12 | 0 |
| Configured Playwright `--list` | 13 | 0 | 0 | 0 | N/A listing only | 0 |
| Typecheck | N/A | N/A | N/A | 0 diagnostics | N/A | 0 |
| Focused lint of 8 generated TS files | N/A | N/A | N/A | 0 errors / 0 warnings | N/A | 0 |
| API missing-binding probe | Not a test | 1 bounded call | 0 | 1 expected throw | 0 | 1 expected |
| Component/input missing-binding probe | Not a test | 1 bounded call | 0 | 1 expected throw | 0 | 1 expected |

All 92 test declarations are skip-marked. Native runners reported **79 intentional skips**, while 13 browser cases were only listed. **Zero acceptance test bodies executed; zero activated behavioral RED failures; zero behavioral passes.** Both probes fail with `14.4 RED:` missing actual production binding, so no fake adapter success can be mistaken for coverage. The browser harness is likewise unbound by source inspection; no browser was launched to probe it.

Evidence: [native results](story14-4-atdd-check-results.json), [integration output](story14-4-atdd-registration-integration.txt), [unit output](story14-4-atdd-registration-unit.txt), [browser list](story14-4-atdd-registration-browser.txt), [typecheck](story14-4-atdd-typecheck.txt), [lint](story14-4-atdd-lint.txt), [binding probes](story14-4-atdd-binding-probes.json), [generation summary](tea-atdd-summary-14-4-2026-10-07.json). Worker outputs: [API](tea-atdd-api-tests-14-4-2026-10-07.json), [E2E](tea-atdd-e2e-tests-14-4-2026-10-07.json), [component/input/scope](tea-atdd-component-tests-14-4-2026-10-07.json).

The first lint found five unused destructuring variables. A mechanical projection/typing correction removed them; final typecheck/lint and registrations pass. A transient type error during that mechanical repair was corrected before final verification. Initial attempted checkout `.env.test` loading failed because no such file exists; root supplied the existing approved private fixture path, read only. Final verification uses 55421/55422; no reset/seed/migration or database business write occurred. Resolver activation/completion fails on external uv-cache access; manual merged workflow has no completion hook. Existing Node package-type notices are unchanged runner notices, not generated lint findings.

## Validation, knowledge and limits

Validated against the official ATDD checklist: approved AC/config/framework present; every retained obligation mapped; complete valid JSON from all foreground workers; five test files/three fixture contracts persisted; skips/meaningful assertions/no focus/no invented endpoint checks; metadata/manual story handoff present; commands/actual native counts recorded. Project directory layouts/runners take precedence over template `tests/api`/`tests/component` examples. Multiple assertions concern one invariant/atomic durable state rather than unrelated subjects. N/A: HTTP status tests, external mocks, faker installation, live selector recording and merged-utils wiring (package gates closed). Recommend the framework workflow only if the owner later wants those optional libraries; this story adds none.

Knowledge applied: `library-integration-mandate`, `playwright-utils-mandate`, `pactjs-utils-mandate`, `pact-mcp`, `data-factories`, `fixture-architecture`, `network-first`, `component-tdd`, `test-quality`, `test-healing-patterns`, `selector-resilience`, `timing-debugging`, `confidence-gate`, `test-levels-framework`, `test-priorities-matrix`, `api-testing-patterns`. Inactive package gates require no unavailable utility import or wiring. Pact broker: unreachable (SmartBear MCP tools not available). Provider states derived from provider source; no broker data claimed.

No CLI/browser/resource sessions were opened and none need teardown. Root's shared stack remains root-owned. All ATDD evidence stays in this test-artifacts directory. Performance speedup is unmeasured; no fabricated parallel efficiency claim. Scaffold authoring took foreground parallel workers plus assembly/verification, with no user checkpoint or new owner question.

Outcome: **done for RED scaffolding**. Open questions: **none**. Remaining development gaps are actual production adapter wiring, behavioral RED/GREEN execution, browser selectors/failure seams, required empty-chain Epic CI and all story verification. Transferred 15.1 click/drag remains mandatory and unexecuted. No implementation completion, hosted action, commit, PR, scope activation or predecessor re-review is claimed.
