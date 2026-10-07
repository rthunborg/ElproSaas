---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-10-07'
storyId: '19.1'
storyKey: 'spec-19-1-dashboard-framework-and-quote-pipeline'
storyFile: 'C:/Users/Rasmus/.codex/worktrees/story19-1-dashboard/ElproSaas/_bmad-output/implementation-artifacts/spec-19-1-dashboard-framework-and-quote-pipeline.md'
atddChecklistPath: 'C:/Users/Rasmus/.codex/worktrees/story19-1-dashboard/ElproSaas/_bmad-output/test-artifacts/atdd-checklist-spec-19-1-dashboard-framework-and-quote-pipeline.md'
generatedTestFiles:
  - 'C:/Users/Rasmus/.codex/worktrees/story19-1-dashboard/ElproSaas/tests/unit/scope/widget-registry.test.ts'
  - 'C:/Users/Rasmus/.codex/worktrees/story19-1-dashboard/ElproSaas/tests/unit/server/read-models/quote-pipeline-result.test.ts'
  - 'C:/Users/Rasmus/.codex/worktrees/story19-1-dashboard/ElproSaas/tests/unit/server/read-models/dashboard.test.ts'
  - 'C:/Users/Rasmus/.codex/worktrees/story19-1-dashboard/ElproSaas/tests/integration/rls/dashboard-pipeline.rls.test.ts'
  - 'C:/Users/Rasmus/.codex/worktrees/story19-1-dashboard/ElproSaas/tests/e2e/dashboard/dashboard-pipeline.e2e.spec.ts'
  - 'C:/Users/Rasmus/.codex/worktrees/story19-1-dashboard/ElproSaas/tests/unit/components/dashboard/widget-state.test.ts'
inputDocuments:
  - '_bmad-output/implementation-artifacts/spec-19-1-dashboard-framework-and-quote-pipeline.md'
  - '_bmad-output/test-artifacts/test-design-epic-19.md'
  - '_bmad/tea/config.yaml'
  - 'playwright.config.ts'
  - 'package.json'
  - 'docs/process/agent-model-routing.md'
  - 'docs/process/local-setup.md'
pact_mcp_reachable: false
pact_fallback_source: 'provider-source'
workflowType: 'testarch-atdd'
workflowStatus: 'completed'
route: 'gpt-6.1-sol / high'
inspectionRevision: 'a97c11bf6a646bfb5cd435fe1599351433ceae0c'
---

# ATDD Checklist — Story 19.1 Dashboard Framework and Live Quote Pipeline

**Date:** 2026-10-07. **Author:** TEA delegate for Rasmus. **Primary acceptance level:** production-browser composition, supported by Node sensitive-boundary units and real Vitest/RLS composition.

## Story summary and admission

Dashboard-entitled users need one live `Offertpipeline` card backed by the shipped E10 lifecycle source. Eligible current server roles receive counts/rate and only permitted accepted value; failed reads remain unavailable with retry. This is the reviewed 19.1 framework plus pipeline slice, not 19.2 or full Epic 19 acceptance.

Ready-for-dev spec, nine testable ACs, existing Node/Vitest/Playwright framework and isolated worktree were loaded. Next/React indicators resolve frontend with server/RLS tests. Frozen pnpm install completed without dependency/lockfile changes. AI generation used the approved contract and existing provider/fixture patterns. No browser recording was needed before the new UI exists. Prompts were answered autonomously under delegated instruction.

`uv` resolver encountered restricted cache access; direct Python resolution confirmed empty prepend/append/facts/on_complete. English/Rasmus config applies. Native subagent capability exists; persistent agent-team API is absent, so auto resolved subagent. Both required workers used explicit Sol6.1 High for tenant, permission, money and failure boundaries and completed synchronously. Parallel performance gain was not measured.

## Acceptance criteria and risk mapping

| AC19.1 | Expected behavior / principal scaffold | Design risks and regression authority |
|---|---|---|
| 1 | Actual registry equals active manifest union; missing/orphan/duplicate registration, pending owner, unknown/foreign/platform capability and absent loader/component fail (`widget-registry`) | R19-07/13; existing manifest duplicate ownership/declaration and pending-live guard regressions reused |
| 2 | Current server role resolver before reader; admin/PL/seller one card; Montör/Ekonomi/unknown/empty none; valid union deduplicates (`dashboard`, RLS, E2E001) | R19-01/02; current matrix/resolver and role-aware landing suites |
| 3 | Shared result entry equals E10 distinct-history/adjusted accepted commitment and Stockholm authority; real RLS/source/card equality (`quote-pipeline-result`, INT002/005, E2E002) | R19-06; existing pure aggregate/projection/pipeline/list suites |
| 4 | Browser DTO key absent + withheld for seller; entitled value and zero distinct; raw metadata excluded; HTML/RSC/DOM sentinel absent; accessible Dold (`dashboard`, RLS, SSR, E2E003) | R19-03/08; existing sensitive-field matrix/projection |
| 5 | Successful empty/null-rate and sent-only period states; B-only fixture gives A empty without B identity/value (`quote-pipeline-result`, INT001, SSR, E2E004) | R19-01/10 |
| 6 | All reachable query stages/later pages/batches/throws, malformed clock/period/unsafe money unavailable; generic error with no partial metrics/completion; legacy wrapper compatible; healthy sibling/heading/onboarding retained | R19-05/08/09/12; reader units, actual grid SSR and E2E005 |
| 7 | Re-resolve current authority on repeated read/retry, revoke quote/money or lose session; no retained value/stamp or mutation; accessible loading/recovery (`dashboard`, INT004, E2E006/007) | R19-04/05/12; actual authenticated resolver and contained server path |
| 8 | Undismissed/dismissed/completed/non-admin/invisible/read-failure onboarding with success/error card; warning and existing persistence regression retained (E2E008) | R19-09; `first-admin-checklist.e2e.spec.ts` and onboarding lifecycle suites |
| 9 | Accessible title/content/mask/link/retry/time; one authorized quotes link; skeleton/error/empty/masked/live states at 360×640, tablet and desktop (SSR, E2E009/010) | R19-10; existing shared styles |

These are expanded variants of the design's scenario groups, not additional product scope or a coverage percentage. The actual driver verifies the intended behavior; no source-string or implementation-copy oracle was introduced. Pure failure variants prove different transport stages; DB tests prove RLS; browser tests prove delivery/hydration/user behavior. Existing arithmetic/matrix/dismiss-restore truth tables are reused rather than copied.

## Red-phase scaffold inventory

All committed new cases remain `test.skip()` / `it.skip()` per the named skill. Activation belongs to implementation. Counts below are reconciled to actual Node collection; browser count comes from actual Playwright listing. RLS count is authored/planned only.

| File | Cases | Lines | Priority | Current status / expected red cause |
|---|---:|---:|---|---|
| `tests/unit/scope/widget-registry.test.ts` | 11 | 107 | P0 0, P1 11 | Skipped scaffold; Missing widget-registry module/actual registry export; after present, new registry options must reject each mutated fixture. |
| `tests/unit/server/read-models/quote-pipeline-result.test.ts` | 43 | 414 | P0 34, P1 9 | Skipped scaffold; Existing quote-pipeline module lacks readQuotePipelineResult; local headers resolution keeps failure focused on the target seam. |
| `tests/unit/server/read-models/dashboard.test.ts` | 25 | 384 | P0 24, P1 1 | Skipped scaffold; Missing dashboard module/readDashboard export; later failures target current authority and actual filtered DTO behavior. |
| `tests/integration/rls/dashboard-pipeline.rls.test.ts` | 11 | 289 | P0 10, P1 1 | Skipped scaffold; When required local stack is provided, missing new result-entry/dashboard module is the intended red; unavailable DB is an explicit skip/hard-fail, not coverage. |
| `tests/e2e/dashboard/dashboard-pipeline.e2e.spec.ts` | 48 | 398 | P0 12, P1 36 | Skipped scaffold; new card and documented contained scenario prerequisites absent |
| `tests/unit/components/dashboard/widget-state.test.ts` | 8 | 183 | P0 0, P1 8 | Skipped scaffold; actual product components absent |

**Total:** 146 planned scaffold variants: 87 Node, 11 RLS and 48 browser; P0 80, P1 66. Quantity is not executed coverage. The worker's initial dashboard count was corrected from 26 to the actual 25 cases. No scenario was dropped by that metadata correction.

## Data factories, fixtures and mocks

No new dependency or shared fixture file was added. Node files contain typed per-case override factories and a filter/order/range-aware fake PostgREST transport; the actual product query core, aggregate and entitlement implementation remain the tested source. Page size 500 and ID chunk 100 follow existing pagination authority. Local Node module hooks resolve only the real factory's `next/headers.js`, and compile actual TSX with installed TypeScript inside activated callbacks. Product imports are deferred, so skipped collection succeeds without invented modules.

RLS scaffolds reuse `createRoleAwarePhaseAFixture`, authed anon-key clients, lifecycle seed helpers and paired cleanup in `finally`. Each activated case owns a fresh isolated tenant graph. Privileged setup/oracle queries stay test-only; application reads use the actual result entry and default adapter/current resolver. No DB fixture was created in this run.

Browser baseline role/layout/keyboard cases reuse existing per-run credentials. Additional `dashboard19` metadata in the existing gitignored fixture artifact is an explicit setup requirement, not a current fixture or fault-injection capability. Reconcile the scenario metadata names with the real harness during activation. No new HTTP endpoint or independently deployed consumer/provider boundary exists; external service mocks and Pact tests are N/A.

| Fixture need | Required implementation before browser activation |
|---|---|
| source-history, seller/entitled sentinel, empty-entitled/withheld, sent-only, entitled-zero | Real isolated constrained lifecycle fixtures, unique accepted sentinel unequal to frozen sent total; actual server period/completion clocks bound by contained test harness |
| failure-isolation, retry-recovery/failure, revoke-quote/money, retry-session-lost | Harness controls the actual `readQuotePipelineResult` dependency for unique tenant/user, holds/releases reads through observable loading, sequences failure/result; no production env flag/public fault endpoint/browser interception |
| onboarding-state × success/error | Current onboarding reader facts for undismissed/dismissed/completed/non-admin/invisible/read failure; existing terms warning and first-admin authorization retained |
| layout-loading/error/empty/withheld | Actual held read/outcomes through all three viewports; metadata cannot fabricate loading |

Unit synthetic NULL/fractional/nonfinite/malformed money/date fixtures supplement valid DB constraints; they are not claims of reachable malformed DB rows. Unsafe bigint öre/overflow still requires real validation. Unique acceptance per version + maximum 100-ID chunk makes a >500-row acceptance page unreachable in a coherent schema; later acceptance ID batches and later event/follow-up/version pages are covered. Do not fabricate an impossible acceptance-page fixture.

## Provisional seams and selectors

Confidence: **8/10 browser, 7/10 SSR; ≥9/10 source/registry/RLS contracts**, grounded in the reviewed spec, actual provider/aggregate/matrix and existing role/onboarding/pipeline fixtures. Unknowns: absent product callable/prop names, new DOM, contained production-server failure/clock/hold-release harness and scenario seed metadata. They are implementation details to resolve by repository inspection, not new owner policy or permission grants.

Provisional callable shapes in tests are `readQuotePipelineResult(period, entitlementInput, deps) -> Result<{descriptor, completedAt}>`, `readDashboard` with server/test-only injected current resolver/reader, and actual `WIDGET_REGISTRY` plus coherence integration. Presentation uses `QuotePipelineWidget({state,descriptor?,completedAt?,onRetry?})`, `DashboardGrid({children})`, `WidgetCard({title,href,children})`. Align names/shapes with the implementation while retaining behavior; no browser role/moneyEntitled becomes authority.

No data-testid is required by these scaffolds. Proposed accessible seams: region/heading `Offertpipeline`; labels `Skickade`, `Accepterade`, `Förlorade`, `Träffgrad`, `Accepterat värde`; one link `Visa offerter`; retry `Försök igen`; status with polite live announcement/busy state; alert on failure; `<time datetime>` for server completion; mask `Dold`, SR `Dolt för din roll` and tooltip `Din roll ser inte belopp`. Binding copy is the spec; other semantic names are provisional. Selectors were not observed in a live browser.

## Implementation checklist / handoff

- [ ] Activate focused reader cases and confirm red, add shared result core with projected success/completion and generic unavailable failure; preserve existing wrapper and pagination.
- [ ] Activate registry negatives and real-set equality; enroll only `quote-pipeline` on already-active quotes with coordinator-serialized manifest/coherence changes. Preserve existing duplicate/pending regressions.
- [ ] Activate dashboard units/RLS; implement current server authority × active registry × existing capabilities, eligible loaders only, allowlisted DTO and withheld boundary. No cached cross-request result/client authority.
- [ ] Activate actual card/grid SSR cases; implement honest loading/loaded/empty/error/withheld states, useful dimensions, one authorized deep link and completion semantics.
- [ ] Resolve contained browser fault/clock/hold-release + isolated scenario seeding; activate real production-browser payload/retry/revocation/onboarding/accessibility/layout cases. No false server-fault claim from request interception.
- [ ] Run required local isolated RLS with `SUPABASE_TEST_REQUIRED=1`, production Playwright and relevant E10/E11/E12 regression; record actual executed/failed/skipped counts and all nine AC families.
- [ ] Complete required CI/static/build/containment gates and independent High money/tenant review. Implementation author supplies final Suggested Review Order. No mandatory acceptance may remain skipped at story completion.

Estimate: the existing test-design's 40–72 hour whole-slice planning range includes implementation/test/harness work; no new speed or elapsed-work promise is made here. ATDD does not implement any product seam. Story/sprint/aggregate files are outside this delegate's ownership; the spec was intentionally not edited. Manual handoff is this checklist's frontmatter and six generated test paths. Coordinator links these artifacts into the development context.

## Running / red-green-refactor

From this exact isolated worktree, use the existing Node runner/import hook for activated unit files:

```powershell
Set-Location -LiteralPath 'C:/Users/Rasmus/.codex/worktrees/story19-1-dashboard/ElproSaas'
node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/scope/widget-registry.test.ts tests/unit/server/read-models/quote-pipeline-result.test.ts tests/unit/server/read-models/dashboard.test.ts tests/unit/components/dashboard/widget-state.test.ts
```

After managed isolated stack/server readiness, set `SUPABASE_TEST_REQUIRED=1` and run `pnpm exec vitest run tests/integration/rls/dashboard-pipeline.rls.test.ts` plus relevant pipeline/role regressions. Browser: `pnpm exec playwright test tests/e2e/dashboard/dashboard-pipeline.e2e.spec.ts`; append `--headed` or `--debug` for normal interactive investigation. Use configured production webServer, never next dev. No extra coverage command is invented for runners without configured instrumentation.

For each implementation task, remove skip on its cases, confirm real RED, implement minimal behavior, run GREEN, then refactor retaining assertions. All required cases and regressions must eventually execute; skipped scaffolds are uncovered. Managed workloads require the actor's own trusted resourceGuardContext and isolated lifecycle IDs; this run launched none. Do not reuse E14 data, demo, native CLI lifecycle or global cleanup.

## Status and actual execution evidence

Revision at validation: `a97c11bf6a646bfb5cd435fe1599351433ceae0c` in the dedicated worktree; concurrent coordinator state change was preserved. All new tests were restored byte-for-byte after temporary activation and independently recollected skipped.

| Check | Actual outcome | Evidentiary limit |
|---|---|---|
| `pnpm install --frozen-lockfile` | Exit 0; 397 existing locked packages installed | Setup, no new dependency/lockfile |
| Focused Node skipped collection above | Exit 0; 87 tests, 0 pass, 0 fail, 87 skipped | Collection only; no acceptance coverage |
| Same command with temporary skip removal, restored in finally | **Native exit 1; 87 tests, 0 pass, 87 fail, 0 skipped** | Missing target modules/result entry and new registry guard failures. Later branch assertions behind absent entries not reached; not exhaustive failure-path evidence |
| Per-file Node recollection after restoration | Exit 0; registry11, reader43, dashboard25, SSR8 all skipped | Confirms final skip state and counters |
| `node node_modules/@playwright/test/cli.js test tests/e2e/dashboard/dashboard-pipeline.e2e.spec.ts --list` | Exit 0; 48 cases listed | No browser, server, global fixture setup or assertions executed |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | Exit 0 | Static validation only |
| `node node_modules/eslint/bin/eslint.js` on six generated files | Exit 0 | Focused lint only |
| New 11 RLS cases; production-browser cases; E10/E11/E12 regressions; full unit/build/containment/DB gates | **Not executed in ATDD** | Mandatory implementation-stage evidence remains outstanding |

Logs: `tmp/atdd19-unit-scaffold-collection.log`, `tmp/atdd19-unit-activated-red.log`, `tmp/atdd19-browser-collection.log`. Structured source outputs and final execution summary are under `tmp/tea-atdd-*-story-19-1.json`. None contains live credentials or external data. Bounded red wrapper itself returns success only after expected native red exit and restores original bytes; its wrapper exit must not be mislabeled native test exit.

## Knowledge, mandates and validation

Applied story/test-design, fixture/data-factory, component TDD, test-quality/healing, selector/timing/network-first principles, library/Playwright mandates, confidence gate and Pact fallback. Config flags are true, but both utility packages are absent from package.json: second mandate gate is unsatisfied. Existing Node/Vitest/vanilla Playwright patterns are permitted; no library dependency or nonexistent import was added. A separately authorized framework workflow may wire the intended utilities later. Playwright Utils deviations: N/A because mandate is inactive; no browser route stubbing or sleeps emitted. Pact broker: unreachable (SmartBear MCP tools not available); contracts derive from provider source, not broker states.

Workflow checklist applied: approved prerequisites; every AC mapped; meaningful positive/negative assertions; actual source/DTO/component entry rather than shadow behavior; per-run fixture ownership/cleanup; no active/focused committed tests or assertion placeholders; complete paths/counters/activation guidance; no random temp locations or orphan browser/service sessions. Baseline duplicate-manifest behavior is retained as regression, not another copied guard. Author fixture correction gives legacy and new reader failures independent transports. Output was consolidated and static checks passed. This is ATDD author validation, not independent implementation review or release approval.

**Outcome:** ATDD done. **Open human questions:** none. **Build prerequisites:** absent product seams and controlled browser scenario harness above. **Deferred:** 19.2 and full Epic 19. **Blockers to this workflow:** none. Completion hook resolves empty; no commit/branch/PR/spec/product/state/migration/grant change by this delegate.
