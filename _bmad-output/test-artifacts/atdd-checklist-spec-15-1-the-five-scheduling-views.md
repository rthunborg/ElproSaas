---
workflowStatus: completed
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: step-05-validate-and-complete
lastSaved: '2026-10-09'
storyId: '15.1'
storyKey: spec-15-1-the-five-scheduling-views
storyFile: _bmad-output/implementation-artifacts/spec-15-1-the-five-scheduling-views.md
atddChecklistPath: _bmad-output/test-artifacts/atdd-checklist-spec-15-1-the-five-scheduling-views.md
generatedTestFiles:
  - tests/integration/scheduling/scheduling-read.atdd.int.test.ts
  - tests/e2e/scheduling-views.atdd.e2e.spec.ts
  - tests/e2e/support/scheduling-views-atdd.ts
  - tests/unit/features/scheduling/views.atdd.test.ts
  - tests/unit/features/scheduling/capacity-view.atdd.test.ts
  - tests/unit/features/scheduling/preferences.atdd.test.ts
inputDocuments:
  - AGENTS.md
  - docs/process/agent-model-routing.md
  - _bmad/tea/config.yaml
  - playwright.config.ts
  - vitest.config.ts
  - _bmad-output/test-artifacts/test-design-epic-15.md
  - _bmad-output/implementation-artifacts/spec-15-1-the-five-scheduling-views.md
---

# ATDD Checklist — Story 15.1: The Five Scheduling Views

## Scope and preflight

Approved ready-for-dev spec has eight Given/When/Then ACs. Detected frontend Next/React stack with request-bound Supabase reads; existing Node pure unit, Vitest integration and configured production Playwright runners. Rasmus's autonomous Create instruction supplies confirmation. AI generation selected: approved semantics are sufficient; no live recording or Lovable inspection needed. Owner disposition uses arbetsroll grouping, no named teams, zero observations and no verified parity claim.

Customization resolver returned empty prepend/append/facts/on_complete. Config execution=auto with capability probe=true; collaboration subagents available, separate agent-team API unavailable, so resolved subagent mode. API worker uses explicit context-free gpt-6.1-sol High for actual auth/RLS/read/integrity assertions; UI worker uses ordinary Sol Low. Route choices recorded before dispatch. Shared fixture/product/manifest/nav/permission/enrollment writes belong to other owners. This run only prepares new 15.1 test/checklist artifacts; spec is deliberately untouched.

## AC trace and primary test levels

| AC | Red scaffold trace | Implementation/verification obligation |
| --- | --- | --- |
| 1 | views.atdd unit half-open/filter/DST/Monday/month cases; E2E-006; INT paging | All five live projections, complete later pages, faithful additional self subset; manager Schema day/week/month and resources day/week |
| 2 | INT-001 sensitive role/tamper/payload/authority matrix | Positive Admin/PL, own-only Montör, denial/union grants, stale permission and cross-tenant negatives; no peer identity/roster/hours/money grant |
| 3 | preferences.atdd scoped/corrupt/unavailable/denied-storage cases; browser failure/restore cases | Versioned user+tenant+view toolbar values, visible valid resets and retry; no booking/draft storage |
| 4 | E2E-001–004 plus pure reverse-slot normalization | Four actual Schema/Resurser mouse click/drag cases with exact person/start/end editor and durable readback after reload; pure prefill is insufficient |
| 5 | E2E-005/007 toolbar, keyboard/dialog, move/resize/cancel/focus | Same existing editor, server-confirmed save/current reviewed warnings; no direct gesture writes |
| 6 | E2E-008 role/no-role lanes and resources; views.atdd lifecycle | Faithful assignee rows and needs-reassignment based on archived/missing profile or inactive membership; no named-team entities |
| 7 | UNIT-001/002 and capacity-view.atdd zero/negative/hidden-demand/unavailable cases; capacity UI | Independent demand/budget/balance goldens, numeric/color presentation, full authorized overbooked drilldown with restrictive filters cleared |
| 8 | Responsive E2E cases and retained editor regression | Connected 360×640 agenda/summary, accessible controls/dialog focus, retained suitable unsent input, honest retry/save status |

Unit adapter contracts describe normalized assertions, not mandated production signatures. They must call final production exports without implementing projection/capacity logic in tests. Browser/INT ports similarly must bind the real UI/authorized reader, not return expected fixtures. No fictitious HTTP endpoint or selectors are presented as shipped contracts.

## RED inventory and evidence

62 skipped red scenarios generated: 18 pure unit, 30 Vitest integration and 14 Playwright browser. `15-1-atdd-api-output.json` and `15-1-atdd-e2e-output.json` retain worker outputs; `15-1-atdd-summary.json` retains aggregate counts. Both workers were awaited. Pure unit discovery: pass=0, fail=0, skipped=18, cancelled=0. Command and revision are retained in `15-1-atdd-unit-output.json`. This is scaffold discovery only: zero product behaviors executed. Integration/browser scenarios were not run. All test bodies intentionally use `test.skip`; explicit unbound ports fail fast when activated before wiring. No runtime service, DB, browser, component rendering, performance or manual accessibility execution occurred.

Node strip-types syntax checks succeeded for the integration spec, browser spec and browser harness. Worktree dependencies are not installed, so TypeScript typecheck, Vitest collection and Playwright collection were not attempted. Syntax checks do not resolve imports or verify types. This limitation does not become feature evidence. Actual RED against production behavior remains to be recorded after wiring; unbound-port failure is not a feature RED result.

Independent expected literals include Stockholm spring/fall local-day instants, Monday/month boundaries, half-open overlap, distinct 1,800/1,770-minute budgets from equal nominal weekly hours but different actual break days, and hidden demand inclusion. They are domain goldens rather than outputs computed from the implementation under test. Capacity reductions fixture requires disjoint windows and actual engine inputs, not sequential blind subtraction.

## Fixture and adapter wiring before GREEN

- [ ] Bind pure projection/period/slot/lifecycle ports to final exports in `view-model.ts` and helpers; preserve start/ID stable order and original editor instants while display clips.
- [ ] Bind preference ports to real storage validation, versioned keys, scope and fixed current date; validate no draft/booking content is persisted.
- [ ] Bind capacity ports through existing engine with real validated rules/calendar/break facts, explicit reductions and full authorized demand. Add overlapping reductions, employment edges, blocked/holiday/half-day and explicit overtime packs without changing engine policy.
- [ ] Coordinate isolated local DB fixtures and typed authenticated reader adapter with shared owner: own/peer and tenant A/B, role unions, membership loss, identity projection absence, paging/fault inputs. Use actual JWT/RLS paths and independent IDs, no privileged result substituted for caller-visible rows.
- [ ] Coordinate UI adapter with actual emitted slot/block locators, dates/person rows, production transport settlement, durable booking+assignee readback, fixture uniqueness and teardown. Existing editor test IDs may be reused; calendar selectors must be verified when product markup exists.
- [ ] Wire later-page faults to real read transport before triggering read; use 501/1001 booking rows and valid 500+ ancillary rows. Calendar facts must remain valid within approved periods; do not invent a widened period just to reach 501 days.
- [ ] Browser/component execution must prove restored unavailable filters reset visibly, read failure retains toolbar, no partial/false-empty/stale fallback, and full-demand drilldown clears restrictive filters.
- [ ] Add/activate 15.1-SCOPE-001 through shared manifest/nav/permission owner. Existing scope suite is not changed here; do not create a second inventory. Same first-nav PR activates scheduling, tables stay owned by resources, no future feed/report surface.

No shared fixtures, package/config/setup, dependencies or enrollment were created. Story-specific fail-fast adapters are test ports awaiting agreed wiring, not usable seeded fixtures. There are no external-provider contract mocks. Pact broker tools were absent on available tool list; no broker calls/provider-state claims. No independent consumer/provider contract is relevant here.

## Playwright Utils deviations

`tea_use_playwright_utils=true`, but `@seontechnologies/playwright-utils` is absent from package.json. The mandate's flag+installed-package gates therefore do not bind; existing Playwright fixture style is used, without unavailable imports or dependency changes. Future framework adoption needs merged fixture/auth/interception wiring by its owner. No timed sleeps or guessed network endpoints are permitted.

## Task activation checklist

- [ ] Task 1: High owner updates authorized shared permission/manifest/nav guards with identical grants.
- [ ] Tasks 2–4: Bind and activate current projection/preferences/capacity/read scenarios. Confirm substantive RED against production first, then implement until GREEN.
- [ ] Tasks 5–6: Wire actual five view hosts, toolbar/read failure/filters/role lanes/phone fallback and activate associated browser/component checks.
- [ ] Task 7: Activate all four real click/drag cases plus keyboard/dialog and move/resize. Require persisted bounds+assignees and focus/cancel/detector regression before exposure/completion.
- [ ] Tasks 8–9: Run required complete integration/RLS and production-server browser suites and retained editor regressions. Replace expected-failure/wiring notes with actual receipts, never relabel skipped scaffolds as coverage.
- [ ] Refactor only after activated behavior remains GREEN; preserve independent goldens and authority regressions. Final implementation author refreshes Suggested Review Order and spec evidence, outside this ATDD ownership.

Execution commands after wiring and managed service setup by the authorized owner:

```powershell
pnpm run test:unit
$env:SUPABASE_TEST_REQUIRED='1'; pnpm run test:int
pnpm run test:e2e -- tests/e2e/scheduling-views.atdd.e2e.spec.ts
```

Then execute authoritative CI order and all story-required containment/build/recovery/browser gates. Do not substitute next dev, use demo as a test target, or count skips. Contract D actual Schema AND Resurser click AND drag and keyboard/dialog remain mandatory release gates, irrespective of scaffold completion.

## Validation and handoff

Manual handoff: implementation owner links this checklist and test paths into the spec when permitted; this run was explicitly forbidden to edit spec. All eight ACs have a scaffold trace or explicit shared-owner/component verification requirement. New pure test files load in bounded Node discovery; no shared/runtime setup was used. Formal feature RED/GREEN, DB/RLS/browser execution, manual assistive technology/daylight/exploration and approved performance certification remain open. Epic 14's 44 advisories remain with their owners.

Effort estimate: no revised estimate beyond approved epic test-design ranges; fixture wiring depends on final product seams. No outcome-changing product ambiguity found. Recommended next workflow is implementation via approved Build lane, with task-by-task activation and exact-head gate evidence.

Confidence: 8/10 for acceptance scaffolds. Rationale: the approved spec's eight ACs and `test-design-epic-15.md` supply exact surface/authority expectations; existing booking-editor E2E establishes editor IDs, current fixture pattern and durable readback; existing scheduling capacity goldens establish engine rules. Unknowns: final exported function signatures, emitted scheduling locators, real paged-reader instrumentation and shared isolated fixture wiring. These unknowns are deliberately unbound test ports, never guessed implementation contracts. No live selector/provider claims are made.

Validation against skill checklist: explicit skipped expected assertions, Given/When/Then descriptive cases, independent constants and isolated fixture intent, no fabricated endpoints/selectors, all eight ACs mapped, typed fail-fast ports and manual spec-link handoff present. Fixtures/factories requiring shared writes are recorded above as an authorized-scope exception; no new dependency was added for faker or library utilities. Unimplemented host binding and deferred rendered fixture execution are clearly distinguished from completed scaffold preparation. Terminal customization hook resolved empty; no completion action ran.
