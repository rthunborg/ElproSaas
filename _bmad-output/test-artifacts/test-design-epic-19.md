---
runScope: 'epic-level'
runKey: 'epic-19'
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-10-07'
workflowType: 'testarch-test-design'
epic: 19
admittedStories: ['19.1']
deferredStories: ['19.2']
pact_mcp_reachable: false
route: 'gpt-6.1-sol / high'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - '_bmad-output/implementation-artifacts/spec-19-1-dashboard-framework-and-quote-pipeline.md'
  - '_bmad-output/planning-artifacts/epics-phase-b.md'
  - '_bmad-output/planning-artifacts/prd-phase-b.md'
  - '_bmad-output/planning-artifacts/architecture-phase-b.md'
  - '_bmad-output/planning-artifacts/ux-design-specification-phase-b.md'
  - '_bmad-output/test-artifacts/test-design-architecture.md'
  - '_bmad-output/test-artifacts/test-design-qa.md'
  - 'docs/process/phase-b-second-lane-handoff-2026-10-07.md'
  - 'docs/process/agent-model-routing.md'
  - 'docs/process/local-setup.md'
  - 'docs/quality/ci.md'
  - '.agents/skills/bmad-testarch-test-design/test-design-template.md'
  - '.agents/skills/bmad-testarch-test-design/checklist.md'
  - '.agents/skills/bmad-testarch-test-design/resources/tea-index.csv'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/risk-governance.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/probability-impact.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/test-levels-framework.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/test-priorities-matrix.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/nfr-criteria.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/library-integration-mandate.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/playwright-utils-mandate.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-mandate.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/pact-mcp.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/playwright-cli.md'
---

# Test Design: Epic 19 — Operational Dashboard v1

**Date:** 2026-10-07  
**Author:** TEA delegate for Rasmus  
**Status:** Planning complete; implementation/test execution and release approval pending  
**Inspection revision:** `e0fb33c5ec56e26769208127c065c3118483b6b9` in the dedicated story worktree. No product test was executed during this design.

## Executive Summary

Epic-level risk design covers the two canonical stories. The current lane admits only `19-1-widget-registry-and-dashboard-framework`, using the reviewed ready-for-dev spec for framework plus live `Offertpipeline`. Story `19-2-the-v1-widget-set` remains backlog/deferred: its five widget sketches are recorded as future risk horizons, not runnable requirements or admission. Delivering 19.1 does not close Epic 19 or prove full AC-B1b-8 parity.

The 19.1 slice consumes FR65 and delivers FR107/108 plus framework-only AC-B1b-8. Exactly one live registry/manifest widget is permitted: `quote-pipeline`, owned by already-active `quotes`. The dashboard framework is already active. Permission and accepted-value field entitlement are separate checks. The new result-bearing read entry must distinguish failure from successful empty activity while preserving the existing reader's fallback for old callers.

- **17 risks:** 13 current/cross-story risks and 4 deferred 19.2 risks; 13 score ≥6, including one score-9 release blocker (failure-as-zero). Four score-4 risks require monitoring.
- **30 planned 19.1 scenario groups:** 15 unit, 5 real DB/RLS integration, 10 production-browser; 16 P0 and 14 P1. Parameterization expands executed assertions later. All are unexecuted here.
- **Effort:** P0 ~20–36 hours; P1 ~14–24 hours; harness/reporting ~6–12 hours; total ~40–72 hours, approximately ~1–2 working weeks for one owner. Service waits and 19.2 are excluded.
- **Gate target:** 100% P0, ≥95% P1, all current high risks mitigated by actual evidence and independent High review. With 14 P1 groups, one failure already falls below 95%; all 14 are required. Planning completion is not a release or NFR verdict.

## Not in Scope

| Item | Reason | Mitigation |
| --- | --- | --- |
| 19.2 follow-ups, bookings, conflicts, active jobs and time widgets | Canonical deferred story; detailed downstream source contracts not admitted | Future risk register and admission checklist below; no placeholder specs/cards/test implementation |
| E14 persons/bookings/conflict RPCs, E15 scheduling/time/Min dag, E16–18 workspace depth | Independently owned downstream sources; 19.1 has no dependency | Preserve source ownership and current dashboard/Montör landing; require reviewed contracts before 19.2 |
| New schema/RPC/view/policy/dependency, permission grants, preference storage, quote/follow-up mutations | Explicit 19.1 non-goals | Stop dependent work if required; report concrete scope prerequisite to coordinator |
| Phase C AI, live vendor APIs, portal/signing, non-Fortnox bookkeeping, anonymous suggestion, offline/PWA, self-serve signup and new features | Hard ledger exclusions | Current manifest/scope checks continue; no new surface admission |
| Tax/VAT/ROT changes, full release legal/GDPR program and authoritative tax ownership | Reuses shipped accepted-commitment integer-öre authority only | Existing money regression and containment gates, no new legal or money rule |
| Production/demo/deployment, external data or Lovable code copying | Local synthetic verification scope; behavioral oracle only | Never target demo in tests; no live browser exploration or service launch in this planning run |
| Realtime/polling/charts/custom dates, stress tooling or new CI automation | Reviewed fixed period/read-completion summary and bounded local lane | Preserve query bounds; record measurements without fabricated SLA or scheduling exemptions |

## Risk Assessment

Probability: **1 unlikely**, **2 possible**, **3 likely**, based on changed integration seams and inspected behavior rather than invented incident rates. Impact: **1 minor**, **2 degraded workflow**, **3 critical disclosure or misleading business/money output**. Score=P×I: 1–3 document; 4–5 monitor; 6–8 mitigate; 9 block release until mitigation is verified. Priority is a separate business-criticality decision.

All rows remain **Planned/Open**. Test design alone does not lower residual risk. Deadlines are story-relative checkpoints; no calendar release date was supplied. Deferred scores are preliminary and must be reassessed against a reviewed 19.2 spec. Categories: TECH architecture/scope; SEC authorization/disclosure; DATA integrity/aggregation; PERF bounded resource use; BUS user workflow; OPS evidence/execution.

### High-priority risks (score ≥6)

| ID | Story/admission | Category | Risk | P | I | Score | Mitigation/owner/deadline |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R19-01 | 19.1 current | SEC | Tenant data reused across users/requests or unscoped app client | 2 | 3 | 6 | Real adapter/result-entry two-tenant negatives, dynamic request and containment; implementation + High security reviewer before 19.1 release |
| R19-02 | 19.1 current | SEC | Dashboard grant incorrectly grants quote reads or client roles widen authority | 2 | 3 | 6 | Matrix seed-role/unknown/multirole test, no-loader negatives, request-bound resolver; implementation + High reviewer before release |
| R19-03 | 19.1 current | SEC | Säljare receives hidden accepted value in HTML/RSC/props | 2 | 3 | 6 | Key absence plus withheld list in real DTO and browser payload, unique sentinel; implementation + High money/security reviewer before release |
| R19-04 | 19.1 current | SEC | Retry retains revoked access or previous values | 2 | 3 | 6 | Same-session role revocation followed by real refresh and no retained secret; implementation + High reviewer before release |
| R19-05 | 19.1 current | DATA | Existing empty fallback makes actual read failure appear fresh successful zero | 3 | 3 | 9 | Shared explicit result entry, every stage/page/batch/throw failures, no partial metrics, legacy compatibility; implementation + High reviewer before card wiring and release |
| R19-06 | 19.1 current | DATA | Event/history/period/hit-rate or adjusted accepted commitment diverges | 2 | 3 | 6 | Reuse pure aggregate and money formatter, exact seeded equality and E10 regressions; implementation + High money reviewer before release |
| R19-08 | 19.1 current | DATA | Missing-unwithheld field/unsafe money becomes fabricated zero | 2 | 3 | 6 | Descriptor/money invalid fixtures yield unavailable, legitimate entitled zero succeeds; implementation + High money reviewer before release |
| R19-12 | 19.1 current | OPS | Mock-only, skipped DB, or browser interception is reported as actual RLS/server-fault evidence | 2 | 3 | 6 | Required stack flag, exact counts/revision, real result path injection, production browser; implementation + test reviewer before release |
| R19-13 | Both; enforce now | TECH | One-story lane exposes 19.2 placeholders or falsely closes Epic 19 | 2 | 3 | 6 | Exactly quote-pipeline runtime set, no pending widget registration, scoped gate accounting; coordinator before dispatch/merge |
| R19-D1 | 19.2 deferred | DATA | Follow-up quick-complete races or bypasses source permission/persistence | 2 | 3 | 6 | Future reviewed spec + source-authorized command, atomic/idempotence and persistence evidence; future 19.2 owner before admission/release |
| R19-D2 | 19.2 deferred | SEC | Mine/team bookings or conflicts/resolver links leak other tenant/person data | 2 | 3 | 6 | E14/E15 source contracts + current authorization + own/team tenant negatives; future 19.2 owner before admission/release |
| R19-D3 | 19.2 deferred | SEC | Active-job status/activity/date summaries reveal unauthorized job details | 2 | 3 | 6 | E16–18 accessible source contract and allowed-field projection tests; future 19.2 owner before admission/release |
| R19-D4 | 19.2 deferred | DATA | Reported/expected hours or economy values gain an invented denominator/unauthorized aggregate | 2 | 3 | 6 | Reviewed time/source/entitlement definitions, exact aggregate fixtures; future 19.2 owner before admission/release |
### Monitored risks (score 4–5)

| ID | Story/admission | Category | Risk | P | I | Score | Mitigation/owner/deadline |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R19-07 | 19.1 current | TECH | Actual loaders/components drift from active manifest or capability ownership | 2 | 2 | 4 | Actual registry equality/coherence and fail-closed runtime selector; implementation + coordinator before release |
| R19-09 | 19.1 current | BUS | Pipeline fault/load changes checklist, warning, dismiss/restore or current landing | 2 | 2 | 4 | Existing onboarding browser regression plus component state matrix; implementation before release |
| R19-10 | 19.1 current | BUS | Empty/null-rate/error/withheld states become indistinguishable or unusable at 360×640 | 2 | 2 | 4 | State assertions, accessibility/keyboard and viewport checks, honest read timestamp; implementation before release |
| R19-11 | 19.1 current | PERF | Query pagination/batching loses bounds or dashboard adds polling/unapproved freshness SLA | 2 | 2 | 4 | Reuse bounded query core and count assertions, record durations with no invented threshold; implementation before release |
### Low risks (score 1–3)

None separately identified. Cosmetic/layout details are included under R19-10 rather than inventing low-priority work.

## NFR Planning

| Category | Requirement / threshold | Risk | Planned validation | Evidence for later assessment |
| --- | --- | --- | --- | --- |
| Security / tenant isolation | Zero unauthorized tenant rows, quote loader invocations or sensitive browser fields; current server membership authority on every request/retry | R19-01–04 | UNIT003–004; INT001–004; E2E001/003/007; current source and built-bundle containment | Executed RLS/role reports, actual DTO/key assertions, sanitized HTML/RSC evidence and containment logs |
| Reliability / honest recovery | Every modeled query/page/batch/throw/unsafe-aggregate failure is generic and card-local; no partial totals/fresh zeros; retry success only after server read | R19-05/08/09/12 | UNIT007–014; E2E005–008 | Fault matrix with named stage/page, real server-path browser trace, retry/revocation state evidence, checklist regression report |
| Data/money correctness | Existing distinct-version history, Stockholm period, accepted/(accepted+lost), null no-decided rate and frozen adjusted accepted commitment retained | R19-06/08 | UNIT005/006/009/010/011; INT002/005; E2E002/004 | Exact integer-öre/source fixtures and unchanged E10 regression results |
| Bounded scale/performance | Retain existing pagination/chunk bounds and dynamic per-request reads; no polling. Numeric dashboard latency/freshness SLA **UNKNOWN** | R19-11 | UNIT015 and real multipage/batch INT005; record request/test durations | Query-count/limit assertions and measured durations; existing CI budgets, no invented SLA pass |
| Maintainability / governance | Actual registry equals active manifest; no pending/orphan capabilities; same query core and compatible old API; no skipped evidence counted as coverage | R19-07/12/13 | UNIT001/002/012/015 plus full required project CI | Registry/coherence unit results, legacy regressions, required install/audit/static/build/containment and count reports |
| Accessibility / responsive use | Required content/link/retry/mask accessible; 360×640/tablet/desktop without horizontal overflow; read time has honest meaning | R19-10 | UNIT013; E2E009/010 | Accessibility-tree/keyboard assertions and responsive screenshots tied to exact revision |

**Unknown thresholds:** No story-specific numeric load/freshness SLA was approved. Record durations and any regression concern under R19-11, without inventing a latency target. A new SLA is not a blocker for this reviewed slice. If later scope requires one, obtain a concrete owner decision. Full NFR evidence decisions belong to the later `nfr-assess` workflow.

## Entry Criteria

- Reviewed 19.1 ready-for-dev spec and canonical split are present in the configured execution base; coordinator verifies handoff/ownership gates.
- Shared manifest/coherence and any new shared primitive/fixture path are reserved with the coordinator. E14 paths and pending owner choices remain excluded.
- Required existing E10 aggregate/projection/role authorities remain usable without new schema/grants/dependencies. A contrary discovery stops dependent scope.
- Synthetic per-run tenant/role/lifecycle fixtures are available. Authenticated app reads use the actual request/RLS seam; privileged fixture setup stays test-only.
- Before DB/browser execution, isolated guard-owned stack/webserver are ready, `SUPABASE_TEST_REQUIRED=1` is set, and the production Playwright server is used. No demo target.
- A contained harness can fail the actual server result path and revoke authority in the same session. No production fault endpoint/env bypass. If absent, record an explicit AC6/7 evidence gap and resolve it before completion.

## Exit Criteria

For 19.1: all nine AC families have executed meaningful assertions; P0=100%, P1≥95%; no unresolved consequential P0/P1 defect or score-9 risk; current high-risk mitigation evidence and independent High review complete; required CI/regressions pass with executed/failed/skipped counts. A skipped stack test is uncovered. Any authorized exception must be explicit with owner, reason and expiry; none exists in this design.

For full Epic 19: future 19.2 must first be admitted through a reviewed detailed spec, deliver its five source-authorized widgets and pass its separate gates. 19.1 completion cannot satisfy that exit. No epic/sprint/aggregate state is changed by this design.

## Project Responsibilities

Implementation/test owner writes and runs the planned cases; High security/money review independently evaluates tenant/permission/amount boundaries; coordinator serializes shared scope seams and retains story/epic admission and release ownership. Concrete assignee names and release dates are not supplied. This design does not fabricate team sign-off.

## Test Coverage Plan

**P0/P1/P2/P3 mean priority, not execution timing.** Case IDs encode level: UNIT=Node pure/fake-transport/state assertions; INT=Vitest real authenticated Postgres/RLS composition; E2E=Playwright against production build/start. All rows are owned by the 19.1 implementation/test owner, with independent High review of sensitive evidence. Each row is one planned scenario group; table/page/role/state variants must be reported as individual assertions when implemented.

Cross-level coverage measures different claims: pure logic and failure discriminants; actual database authorization/source composition; browser delivery/hydration/retry state. Do not repeat arithmetic truth tables through browser tests. E2E005 observes one representative real server failure; exhaustive stage/page faults belong in UNIT007, supplemented by real integration where needed.

### P0 — critical

Criteria: security/data/accepted-money or honest-failure behavior with no safe workaround. Purpose: prevent disclosure, misleading totals and retained revoked access. **16 scenario groups; ~20–36 hours.**

| ID | Priority | AC19.1 | Risk | Atomic scenario / falsifiable assertion |
| --- | --- | --- | --- | --- |
| 19.1-UNIT-003 | P0 | 2 | R19-02 | Every seed role, unknown/empty and role union selects once or none; ineligible path never invokes quote loader; Dashboard.View checked separately |
| 19.1-UNIT-004 | P0 | 4 | R19-03 | Real browser DTO seller key absence+withheld; entitled key present; allowlist omits follow-up counts/raw rows/roles/matrix/client entitlement override |
| 19.1-UNIT-005 | P0 | 3 | R19-06 | New success entry uses shared query core; distinct events/superseded history/adjusted acceptance equal unchanged aggregate and integer-öre formatter |
| 19.1-UNIT-007 | P0 | 6 | R19-05 | Table/page/batch-parameterized query errors including later page/ID chunk yield error without descriptor/partial metrics |
| 19.1-UNIT-008 | P0 | 6 | R19-05 | Client construction/query/aggregation throw yields generic discriminated failure without SQL/stack/metrics |
| 19.1-UNIT-009 | P0 | 3/6 | R19-05/06 | Inject malformed clock/period; unavailable instead of safe-date fresh success; E10 Stockholm boundary regressions retained |
| 19.1-UNIT-010 | P0 | 3/6 | R19-08 | Unsafe accepted sum/malformed money is unavailable; exact MAX_SAFE_INTEGER accepted by existing authority; mark synthetic reachability |
| 19.1-UNIT-011 | P0 | 4/6 | R19-08 | Expected amount absent and not withheld fails presentation descriptor; no zero fill; normal withheld shape remains valid |
| 19.1-INT-001 | P0 | 5 | R19-01 | Actual request-authorized dashboard adapter plus new result entry, B-only fixture => A successful empty, no B values/identity |
| 19.1-INT-002 | P0 | 3 | R19-01/06 | Distinct A/B values: own exact event counts and adjusted accepted commitment through real authed RLS client |
| 19.1-INT-003 | P0 | 2/4 | R19-02/03 | Real role memberships across current roles/multirole: seller withheld, admin/PL allowed, Montör/Ekonomi no widget result despite economy field entitlement |
| 19.1-INT-004 | P0 | 2/7 | R19-01/02/04 | Omitted/forged roles or tenant/entitlement caller input and invalid session cannot widen real adapter access; app read has no privileged client |
| 19.1-E2E-001 | P0 | 2 | R19-02/13 | Real login/current landings and visible eligible one card; ineligible roles none, no 19.2 placeholders; one authorized /quotes deep link |
| 19.1-E2E-003 | P0 | 4 | R19-03 | Unique accepted-value sentinel absent from seller HTML/RSC/client props/attributes and money key absent; mask text accessible; entitled control present |
| 19.1-E2E-005 | P0 | 6 | R19-05/12 | Contained harness fails real server read; generic card error/retry, no fresh zeros/partial values/SQL detail; heading/onboarding usable |
| 19.1-E2E-007 | P0 | 7 | R19-04 | Revoke quote/money authority in same logged-in session before retry; fresh request obeys resolver and previous values/card do not survive; expired session denied safely |
### P1 — high

Criteria: core/complex visible workflow, governance or regression with material user impact. Purpose: preserve usable truthful dashboard states and integration contracts. **14 scenario groups; ~14–24 hours.**

| ID | Priority | AC19.1 | Risk | Atomic scenario / falsifiable assertion |
| --- | --- | --- | --- | --- |
| 19.1-UNIT-001 | P1 | 1 | R19-07/13 | Actual production component/loader keys equal active manifest widget union; exactly quote-pipeline on quotes |
| 19.1-UNIT-002 | P1 | 1 | R19-07 | Parameterized missing/orphan/duplicate owner/registration/pending/platform/unknown-capability fixtures fail coherence |
| 19.1-UNIT-006 | P1 | 5 | R19-10 | Empty successful period carries zeros/null rate; sent-only activity is not called empty; entitled zero remains success |
| 19.1-UNIT-012 | P1 | 6 | R19-05 | Legacy reader signature and historical empty fallback remain compatible while dashboard uses result entry |
| 19.1-UNIT-013 | P1 | 4/5/6/9 | R19-10 | Loading/empty/null-rate/error/withheld/entitled-zero state copy and read-completion timestamp are distinct; failure has no fresh timestamp |
| 19.1-UNIT-014 | P1 | 6/8 | R19-09 | Inject successful/failed card outcomes alongside sibling fixture and checklist/reminder/hidden states; sibling/page survives; no fake shipped widget |
| 19.1-UNIT-015 | P1 | 6/7 | R19-11 | Shared pagination/chunk bounds retained, no duplicate query core/health preflight/polling; retry does reads only |
| 19.1-INT-005 | P1 | 3/6 | R19-06/11 | Real pagination/batch fixture exceeds first row/ID limits, new result remains complete; preserve existing E10 large-fixture suite |
| 19.1-E2E-002 | P1 | 3/9 | R19-06 | Seeded real source matches visible counts/rate/accepted value and Stockholm dates; denominator visible; timestamp is read completion |
| 19.1-E2E-004 | P1 | 5 | R19-10 | Successful empty period and sent-only/zero-decided periods render correct distinct copy, no assertion that tenant has no quotes |
| 19.1-E2E-006 | P1 | 7 | R19-05/10 | From observed failure, retry yields accessible loading then real persisted server result/new completion time; repeated failure/clicks has no mutation or fake success |
| 19.1-E2E-008 | P1 | 8 | R19-09 | Existing first-admin warning/dismiss/restore across reload/completion plus hidden/non-admin; success/error card cannot change checklist branch |
| 19.1-E2E-009 | P1 | 9 | R19-10 | Keyboard and accessibility tree reach heading/content/mask/deep link/retry; loading/result announcements, readable time meaning |
| 19.1-E2E-010 | P1 | 9 | R19-10 | 360×640/tablet/desktop: single full-width 12-column row → one-column, all loading/error/empty/masked states without horizontal overflow |
### P2 / P3

No additional scenarios admitted; no separate effort allocation. Secondary/cosmetic or exploratory work can be proposed only if a concrete gap appears, not to dilute the P0 share. The P0 ratio is intentionally higher than generic guidance because the slice crosses tenant, permission, browser-money and failure-integrity boundaries.

### AC traceability

| AC19.1 | Planned primary evidence |
| --- | --- |
| 1 registry completeness | UNIT001/002; E2E001 runtime no-placeholder proof |
| 2 role/server selection | UNIT003; INT003/004; E2E001 |
| 3 source/period/money | UNIT005/009/010; INT002/005; E2E002 |
| 4 withholding | UNIT004/011/013; INT003; E2E003 |
| 5 successful empty | UNIT006; INT001; E2E004 |
| 6 honest failures/isolation | UNIT007–015; E2E005 |
| 7 retry/current authority | INT004; E2E006/007 |
| 8 onboarding preserved | UNIT014; E2E008 and existing onboarding regression |
| 9 accessible responsive card | UNIT013; E2E002/009/010 |

### Deferred 19.2 coverage horizon

This table covers the canonical story sketch only. It grants no execution admission and creates no placeholder spec, registry IDs, fixture sources or runnable tests.

| Canonical widget | Risk | Future assertions after source/spec readiness | Admission prerequisites |
| --- | --- | --- | --- |
| Uppföljningar | R19-D1 | Due/overdue semantics from E10; quick-complete authorized, persisted and race/idempotence safe; no false success | Detailed 19.2 acceptance/command/authorization contract; real E10 source and permission review |
| Veckans bokningar | R19-D2 | Mine/team toggle only at current entitlement; own/team/other-tenant exact visibility and authorized deep link | Reviewed E14/E15 source/role contracts and current owner decisions |
| Konflikter | R19-D2 | Open-by-type counts and resolver link equal authorized source; inaccessible records not disclosed | Reviewed E14 conflict/resolver contracts and source readiness |
| Aktiva jobb | R19-D3 | Status/recent activity/missing dates match only accessible jobs; field projections respect grants | Reviewed E16–18 live job source/fields and applicable read-model |
| Tidläget | R19-D4 | Reported/expected hours use reviewed period/denominator; source-authorized sums and sensitive fields withheld | Reviewed E15+ time/expected-hours definition and entitlement contract |

Shared future admission: producing modules active, actual manifest/registry coherence, no placeholder surfaces, reviewed 19.2 acceptance criteria, fixed role defaults, card-local states and current money mechanism. Later readiness may change these preliminary risk scores; refresh before dispatch. Current Montör dashboard fallback remains until the approved E15 landing change; this plan does not implement `/my-day`.

## Execution Strategy

| Cadence | Plan |
| --- | --- |
| PR | Run everything in PRs if <15 minutes; defer only expensive/long work after measured evidence and approved gate scheduling. Current 19.1 functional/security cases and relevant regressions remain required PR evidence. Fail fast on P0 then P1; use normal authoritative CI ordering. No new CI exemptions. |
| Nightly | No new automation or suite scheduled. Existing required large pagination fixtures remain required; reassess only if measurements justify scheduling changes. |
| Weekly | No new stress/chaos/manual program. Deferred 19.2 is not made runnable by a cadence label. |

Playwright currently uses one serial worker and shared seeded fixture; do not enable broad parallelism by copying generic throughput claims. Use unique fixtures and guard isolation if future concurrency changes are approved. No execution-duration promise is made here. Existing source CI budgets inspected include unit 180 seconds and browser reporter 300,000 ms; these are suite budgets, not a new dashboard SLA.

Before evidence collection, run focused cases with existing runners, then required `pnpm typecheck`, `pnpm lint`, `pnpm run test:unit`, `pnpm build`, source/bundle containment, frozen install/lockfile/audit and current CI DB/migration/inventory gates. Source CI workflow is authoritative over historical documentation. Required DB runs set `SUPABASE_TEST_REQUIRED=1`; production Playwright must not use `next dev`. Record exact commands/revision and executed/failed/skipped counts. A browser request interception alone is not proof of server-side database failure.

## Resource Estimates and Prerequisites

| Work | Planned count | Effort range |
| --- | --- | --- |
| P0 test development | 16 scenario groups | ~20–36 hours |
| P1 test development | 14 scenario groups | ~14–24 hours |
| Synthetic fixture, contained fault/revocation harness and evidence reporting | Shared setup | ~6–12 hours |
| P2/P3 | None admitted | No separate allocation |
| Total 19.1 | 30 groups plus shared setup | ~40–72 hours / ~1–2 working weeks |

These are planning ranges, not measured agent speed or release commitments. 19.2 and resource waits are excluded; do not apply this total to the full epic.

Fixtures: two independent synthetic tenants with different money sentinels and lifecycle counts; B-only empty control; current seed roles and multi-role membership; repeated events/superseded version/adjusted acceptance; out-of-period and Stockholm month-end/leap/DST cases via existing E10 authority; overflow/invalid-descriptor synthetic unit cases; onboarding first-admin dismissed/undismissed/completed/invisible states. Privileged fixture writes may set up evidence but are never the app read path. Real schema constraints must be recorded when malformed synthetic cases are unreachable in the database.

Reuse `tests/factories/`, `tests/support/stack-gate.ts`, role fixtures and existing production Playwright global setup; coordinate any shared fixture edit. Resolve hydration through observed readiness/state, not fixed sleeps. Managed services use only the actor's trusted resource-guard context and lifecycle IDs. Acceptance is not readiness. Stop owned resources at completion and preserve saved data; no reset/delete/prune as teardown. No managed services were launched by this plan.

## Quality Gate Criteria

- P0 pass rate 100%; P1 ≥95%, and all unwaived required AC assertions pass. No critical/security evidence may be substituted by a waiver invented by an agent.
- Planning coverage target ≥80% is strengthened to **100% of the nine admitted AC families**, all security boundary cases and all current high-risk mitigations. No line-coverage percentage is fabricated for runners that do not collect it.
- Current risks score ≥6 require named executed evidence and independent High review; score 9 unresolved prevents 19.1 release. Deferred risks are not mislabeled mitigated and are excluded from current execution denominator only because 19.2 remains unadmitted.
- Existing E10/role/onboarding regression and project CI must pass. Unknown numeric latency/freshness SLA cannot receive a fabricated PASS; bounded-query claims still require evidence.
- NFR and formal trace/release gate outcomes are **NOT_EVALUATED** during planning. Later workflows consume actual reports and record authorized exceptions, if any.

## Mitigation Plans

Use the risk table for owner/deadline; all statuses remain Planned/Open. Current highest-priority order:

1. **R19-05 / R19-08:** expose the shared result-bearing reader before card wiring; inject each real query stage/page/batch failure and exceptions; reject malformed unwithheld amounts; preserve old wrapper regressions. Verify error has no descriptor, partial totals or fresh completion time. Synthetic malformed money tests supplement, not replace, real source constraints.
2. **R19-01 / R19-02 / R19-03 / R19-04:** resolve tenant membership/roles on the server before any eligible loader; project before browser serialization; test real A/B RLS, all seed roles, forged/omitted input, seller sentinel absence and same-session retry after revocation. No client `moneyEntitled`/role override becomes authority. Review app path and source/bundle containment independently at High.
3. **R19-06:** retain aggregate, entitlement and integer-öre source authorities. Assert distinct event history, adjusted accepted commitment, actual Stockholm dates, explicit decided-deal denominator and null rate; real adapter/card values equal source while existing E10 suites remain green.
4. **R19-12 / R19-13:** require actual result-entry/adapter composition and contained server fault evidence; record skipped/mocked limits. Verify exactly one current widget, no downstream files/grants/migrations/sources and no full-epic completion. Coordinator owns serialized scope and status decisions.
5. **R19-D1–D4:** future owner must resolve detailed source/permission/period/command contracts before 19.2 admission; then reassess and execute each canonical widget boundary. The current guard against premature surface exposure mitigates current scope risk, not future widget correctness.

## Assumptions, Dependencies and Open Items

The reviewed spec and current code-owned matrix are the authority for 19.1. Older architecture/UX references describing a future Montör `/my-day` landing and broader widget set do not override the admitted slice. Fixed full-width card and trailing-year period are approved presentation assumptions; no new business metric or SLA.

Dependencies within 19.1: actual request-bound role resolver, E10 source and projection, manifest/coherence reservation, shared UI styles and existing onboarding. Required result-bearing entry is part of 19.1; it is not a reason to add a new data source. No E14 code investigation or product decision is required by this test design.

Open implementation details safely resolved by repository inspection: existing reusable mask/style primitive and a contained production-server test seam for read failure/revocation. If a necessary browser case cannot execute, report its precise AC6/7 gap and resolve it before story completion. If new schema, grants, tax rules or E14 dependency prove necessary, stop dependent work and ask the coordinator a concise evidenced scope question. Continue independent allowed work.

Numeric latency/freshness target is UNKNOWN and not newly required by this slice. Detailed 19.2 expected-hours/command/source semantics are deferred to its future reviewed spec. There is no current human decision needed to finish this plan.

## Interworking & Regression

| Component | Impact | Existing evidence to retain |
| --- | --- | --- |
| E10 pipeline/query/aggregate/projection | Shared result seam changes failure signaling while legacy caller contract remains | `tests/unit/server/read-models/quote-pipeline-aggregate.test.ts`, `quote-pipeline-aggregate-atdd.test.ts`; `tests/integration/rls/quote-pipeline-read-model.rls.test.ts` including accepted commitment and multipage/batch fixtures |
| E11 matrix/role resolution/current landings | New dashboard selector consumes existing grants, no policy changes | `tests/integration/rls/role-aware-phase-a-surface.atdd.int.test.ts`; `tests/e2e/auth/role-aware-phase-a-surface.atdd.e2e.spec.ts` |
| E12 onboarding | Dashboard composition must preserve warning and checklist/reminder/hidden persistence | `tests/e2e/onboarding/first-admin-checklist.e2e.spec.ts` plus existing onboarding unit/integration suites |
| Scope manifest/coherence | Same-PR one widget enrollment with actual registration equality | `tests/unit/scope/manifest-coherence.test.ts`, manifest derivation/invariant/shape/selector suites and current guardrails |
| E10 quote list/detail | Existing reader and status/follow-up presentation stay compatible | `tests/e2e/quotes/quote-pipeline-consistency.e2e.spec.ts` (list/detail evidence, not existing dashboard proof) |
| E14 lane | Shared scope seam requires serialized coordination; no downstream product edits | Coordinator path reservations/handoff; do not execute/change E14 story code or decide its pending choices |

Proposed new test files follow the reviewed ownership map: `tests/unit/scope/widget-registry.test.ts`; `tests/unit/server/read-models/quote-pipeline-result.test.ts` and `dashboard.test.ts`; `tests/unit/components/dashboard/widget-state.test.ts`; `tests/integration/rls/dashboard-pipeline.rls.test.ts`; `tests/e2e/dashboard/dashboard-pipeline.e2e.spec.ts`. Author must adjust names through recorded ownership amendment if inspection requires it. This plan creates none of those tests.

## Workflow Configuration and Evidence Limits

Create epic-level mode, `epic-19`, single worker for one artifact; no nested worker needed. Config `auto`/capability probe does not require parallelizing a single epic output. Route Sol 6.1 / High was selected by the coordinator for actual tenant/permission/money boundaries; any later sensitive implementation/review handoff must explicitly select High again. No model/effort inheritance claim is made.

Detected stack is frontend under configured auto indicators (Next/React/Playwright), with TypeScript server and local DB/RLS verification. Runners remain Node unit, Vitest DB and Playwright browser. Flags for Playwright/Pact utilities are true, but packages are absent from inspected `package.json`; the mandates' second gate is unsatisfied. Do not add utility dependencies/imports in this bounded slice. A future explicit framework workflow can establish utility wiring; no test-code examples were emitted here.

Pact broker: unreachable (SmartBear MCP tools not available). Internal read contracts derive from provider source (`quote-pipeline.ts`, `entitlements.ts`, matrix), not broker data. No independently deployed consumer/provider boundary exists in this slice and no Pact artifacts/dependencies were found; no contract scaffolding is introduced. Browser exploration omitted under the explicit no-services planning scope. No selectors, screenshots, live results or flaky run statistics are invented.

Historical Phase A system designs supply context only; current Phase B/spec/resource rules supersede their old CLI-reset/dependency recommendations. Required inputs and relevant knowledge are listed in frontmatter. Resolver's `uv` attempt encountered restricted cache access; direct Python resolver and base customization inspection confirmed empty activation hooks/facts/on_complete. No commit, branch, PR, migration, app, aggregate or status mutation is required by this skill run.

## Validation and Approval

Epic-level checklist applied: canonical scope and all AC mappings, unique risks/scenarios, correct P×I, explicit priority separate from timing, owners/deadlines, current/deferred split, NFR unknowns and future evidence, range estimates, entry/exit gates, regressions and dependencies are represented. System-level dual-output/handoff items are N/A. Quality & Testing Progress is recorded in this epic's checkpoint; no aggregate/sprint state edit is permitted by delegated ownership. No browser/CLI/service sessions or random temporary artifacts were created.

This is author validation of a planning artifact, not stakeholder approval or executed implementation review. Product/technical release sign-off remains pending with the existing coordinator process. The implementation author must later supply its own verified `Suggested Review Order`; this test plan is not that section.

## Follow-on Workflows (Manual)

The coordinator may explicitly run `bmad-testarch-atdd` for the admitted 19.1 P0 cases and later `automate`/`trace`/`nfr-assess` against actual evidence. They are separate workflows, not auto-run here. No 19.2 or E20 selection is implied.

## Appendix — References

Primary contract: `_bmad-output/implementation-artifacts/spec-19-1-dashboard-framework-and-quote-pipeline.md`. Canonical epic: `epics-phase-b.md` Epic 19. PRD: FR65/107/108 and AC-B1b-8. Architecture: §11 projection, §12A money, §15.2 registry; UX: §3.2 masking, §4.10 card/grid and fixed defaults. Handoff/routing/local setup/CI sources are listed in frontmatter.

Knowledge applied: risk-governance; probability-impact; test-levels-framework; test-priorities-matrix; nfr-criteria; library/Playwright/Pact mandates and Pact broker fallback. Scores use current knowledge thresholds (monitor 4–5), correcting the generic template's older medium/low labels. No speculative release standards or external research were added.

**Generated by:** BMad TEA delegate  
**Workflow:** `bmad-testarch-test-design` — Create, epic-level, five steps
