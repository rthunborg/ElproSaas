---
runScope: 'epic-level'
runKey: 'epic-19'
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-10-07'
inputDocuments:
  - '_bmad-output/implementation-artifacts/spec-19-1-dashboard-framework-and-quote-pipeline.md'
  - '_bmad-output/planning-artifacts/epics-phase-b.md'
  - '_bmad-output/planning-artifacts/prd-phase-b.md'
  - '_bmad-output/planning-artifacts/architecture-phase-b.md'
  - '_bmad-output/planning-artifacts/ux-design-specification-phase-b.md'
  - '_bmad/tea/config.yaml'
pact_mcp_reachable: false
---

# Epic 19 test-design progress

Create mode selected autonomously under the coordinator's explicit instruction. No prior Epic 19 checkpoint found. Epic requirements and reviewed ready-for-dev Story 19.1 specification are available. Story 19.1 is admitted; Story 19.2 remains backlog/deferred and has no placeholder implementation spec. This run covers both canonical stories as risk planning, with execution admission restricted to 19.1. Route: gpt-6.1-sol / high for tenant, permission and money boundaries. No services launched; no product verification claimed.

## Step 2 — Loaded context

Reviewed spec AC19.1-1 through AC19.1-9 and canonical two-story Epic 19. Loaded relevant FR65/107/108, AC-B1b-8, architecture §11/§15.2 and UX §3.2/§4.10. Inspected existing reader, projection, role matrix, dashboard onboarding branches, manifest coherence, E10 aggregate test names, real quote pipeline RLS cases, role-aware browser/integration baselines and onboarding browser test. Historical Phase A system test designs are contextual, superseded where the current spec/governance differs. Existing coverage includes precise tenant negatives, accepted commitment source, multipage reads and role withholding, but not new dashboard DTO/state/retry paths. No observed flaky test execution is claimed; hydration and shared seeded fixture are documented risks.

Detected stack: frontend by configured auto rules (Next/React/Playwright package), with server-side TypeScript and local Postgres/RLS integration. Test runners: Node unit; Vitest DB/RLS; Playwright production build/start, one serial worker. Both utility flags true, neither utility package installed; mandates' two-gate rule prevents invented utility imports or dependencies. Use established harness; no generated code examples. Contract testing irrelevant: no independently deployed consumer/provider boundary in this slice or existing Pact artifacts/dependency. Pact broker unreachable (SmartBear MCP tools not available); internal read contracts derive from provider source, not broker data. Browser exploration deliberately omitted per coordinator's no-services planning scope; no live selectors/results inferred. Required risk, probability/impact, levels, priorities, NFR, library mandates, Pact fallback and browser knowledge read.

No material missing input for 19.1 risk planning. 19.2 has canonical AC sketch only; detailed future acceptance/authorization/expected-time semantics must be supplied before admission.

## Step 3 — Risk and testability

Probability 1 unlikely / 2 possible / 3 likely; impact 1 minor / 2 degraded / 3 critical disclosure or misleading money/business output. Score=P×I: 1–3 document, 4–5 monitor, 6–8 mitigate, 9 block release until proved mitigated. Priority is assigned independently by business/security criticality. All risk statuses are planned/open, never claimed mitigated by this document.

| ID | Story/admission | Category | Risk | P | I | Score | Mitigation/owner/deadline |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R19-01 | 19.1 current | SEC | Tenant data reused across users/requests or unscoped app client | 2 | 3 | 6 | Real adapter/result-entry two-tenant negatives, dynamic request and containment; implementation + High security reviewer before 19.1 release |
| R19-02 | 19.1 current | SEC | Dashboard grant incorrectly grants quote reads or client roles widen authority | 2 | 3 | 6 | Matrix seed-role/unknown/multirole test, no-loader negatives, request-bound resolver; implementation + High reviewer before release |
| R19-03 | 19.1 current | SEC | Säljare receives hidden accepted value in HTML/RSC/props | 2 | 3 | 6 | Key absence plus withheld list in real DTO and browser payload, unique sentinel; implementation + High money/security reviewer before release |
| R19-04 | 19.1 current | SEC | Retry retains revoked access or previous values | 2 | 3 | 6 | Same-session role revocation followed by real refresh and no retained secret; implementation + High reviewer before release |
| R19-05 | 19.1 current | DATA | Existing empty fallback makes actual read failure appear fresh successful zero | 3 | 3 | 9 | Shared explicit result entry, every stage/page/batch/throw failures, no partial metrics, legacy compatibility; implementation + High reviewer before card wiring and release |
| R19-06 | 19.1 current | DATA | Event/history/period/hit-rate or adjusted accepted commitment diverges | 2 | 3 | 6 | Reuse pure aggregate and money formatter, exact seeded equality and E10 regressions; implementation + High money reviewer before release |
| R19-07 | 19.1 current | TECH | Actual loaders/components drift from active manifest or capability ownership | 2 | 2 | 4 | Actual registry equality/coherence and fail-closed runtime selector; implementation + coordinator before release |
| R19-08 | 19.1 current | DATA | Missing-unwithheld field/unsafe money becomes fabricated zero | 2 | 3 | 6 | Descriptor/money invalid fixtures yield unavailable, legitimate entitled zero succeeds; implementation + High money reviewer before release |
| R19-09 | 19.1 current | BUS | Pipeline fault/load changes checklist, warning, dismiss/restore or current landing | 2 | 2 | 4 | Existing onboarding browser regression plus component state matrix; implementation before release |
| R19-10 | 19.1 current | BUS | Empty/null-rate/error/withheld states become indistinguishable or unusable at 360×640 | 2 | 2 | 4 | State assertions, accessibility/keyboard and viewport checks, honest read timestamp; implementation before release |
| R19-11 | 19.1 current | PERF | Query pagination/batching loses bounds or dashboard adds polling/unapproved freshness SLA | 2 | 2 | 4 | Reuse bounded query core and count assertions, record durations with no invented threshold; implementation before release |
| R19-12 | 19.1 current | OPS | Mock-only, skipped DB, or browser interception is reported as actual RLS/server-fault evidence | 2 | 3 | 6 | Required stack flag, exact counts/revision, real result path injection, production browser; implementation + test reviewer before release |
| R19-13 | Both; enforce now | TECH | One-story lane exposes 19.2 placeholders or falsely closes Epic 19 | 2 | 3 | 6 | Exactly quote-pipeline runtime set, no pending widget registration, scoped gate accounting; coordinator before dispatch/merge |
| R19-D1 | 19.2 deferred | DATA | Follow-up quick-complete races or bypasses source permission/persistence | 2 | 3 | 6 | Future reviewed spec + source-authorized command, atomic/idempotence and persistence evidence; future 19.2 owner before admission/release |
| R19-D2 | 19.2 deferred | SEC | Mine/team bookings or conflicts/resolver links leak other tenant/person data | 2 | 3 | 6 | E14/E15 source contracts + current authorization + own/team tenant negatives; future 19.2 owner before admission/release |
| R19-D3 | 19.2 deferred | SEC | Active-job status/activity/date summaries reveal unauthorized job details | 2 | 3 | 6 | E16–18 accessible source contract and allowed-field projection tests; future 19.2 owner before admission/release |
| R19-D4 | 19.2 deferred | DATA | Reported/expected hours or economy values gain an invented denominator/unauthorized aggregate | 2 | 3 | 6 | Reviewed time/source/entitlement definitions, exact aggregate fixtures; future 19.2 owner before admission/release |

NFR evidence planned: zero unauthorized fields/rows/loaders; every modeled failure remains card-local without fresh zeros; no changed legacy money/date rules or global onboarding behavior. Numeric dashboard latency/freshness SLA UNKNOWN; no new SLA is required by the reviewed slice, so capture measurements without a fabricated pass threshold. Existing CI browser budget remains authoritative. Full legal/GDPR, stress tooling, offline and vendor programs excluded by approved scope. Browser real server-fault/revocation harness remains an implementation prerequisite, not an invented production fault endpoint. 19.2 source/admission gaps are deferred, not a blocker for bounded 19.1 planning.

## Step 4 — Coverage plan

Thirty planned scenario groups for 19.1: 15 unit, 5 integration/RLS, 10 browser; 16 P0 and 14 P1. Parameterized fixtures expand groups into individual executed assertions, to be reported later. No P2/P3 work added merely for quota. Each case below is planned/unexecuted.

| ID | Priority | AC19.1 | Risk | Atomic scenario / falsifiable assertion |
| --- | --- | --- | --- | --- |
| 19.1-UNIT-001 | P1 | 1 | R19-07/13 | Actual production component/loader keys equal active manifest widget union; exactly quote-pipeline on quotes |
| 19.1-UNIT-002 | P1 | 1 | R19-07 | Parameterized missing/orphan/duplicate owner/registration/pending/platform/unknown-capability fixtures fail coherence |
| 19.1-UNIT-003 | P0 | 2 | R19-02 | Every seed role, unknown/empty and role union selects once or none; ineligible path never invokes quote loader; Dashboard.View checked separately |
| 19.1-UNIT-004 | P0 | 4 | R19-03 | Real browser DTO seller key absence+withheld; entitled key present; allowlist omits follow-up counts/raw rows/roles/matrix/client entitlement override |
| 19.1-UNIT-005 | P0 | 3 | R19-06 | New success entry uses shared query core; distinct events/superseded history/adjusted acceptance equal unchanged aggregate and integer-öre formatter |
| 19.1-UNIT-006 | P1 | 5 | R19-10 | Empty successful period carries zeros/null rate; sent-only activity is not called empty; entitled zero remains success |
| 19.1-UNIT-007 | P0 | 6 | R19-05 | Table/page/batch-parameterized query errors including later page/ID chunk yield error without descriptor/partial metrics |
| 19.1-UNIT-008 | P0 | 6 | R19-05 | Client construction/query/aggregation throw yields generic discriminated failure without SQL/stack/metrics |
| 19.1-UNIT-009 | P0 | 3/6 | R19-05/06 | Inject malformed clock/period; unavailable instead of safe-date fresh success; E10 Stockholm boundary regressions retained |
| 19.1-UNIT-010 | P0 | 3/6 | R19-08 | Unsafe accepted sum/malformed money is unavailable; exact MAX_SAFE_INTEGER accepted by existing authority; mark synthetic reachability |
| 19.1-UNIT-011 | P0 | 4/6 | R19-08 | Expected amount absent and not withheld fails presentation descriptor; no zero fill; normal withheld shape remains valid |
| 19.1-UNIT-012 | P1 | 6 | R19-05 | Legacy reader signature and historical empty fallback remain compatible while dashboard uses result entry |
| 19.1-UNIT-013 | P1 | 4/5/6/9 | R19-10 | Loading/empty/null-rate/error/withheld/entitled-zero state copy and read-completion timestamp are distinct; failure has no fresh timestamp |
| 19.1-UNIT-014 | P1 | 6/8 | R19-09 | Inject successful/failed card outcomes alongside sibling fixture and checklist/reminder/hidden states; sibling/page survives; no fake shipped widget |
| 19.1-UNIT-015 | P1 | 6/7 | R19-11 | Shared pagination/chunk bounds retained, no duplicate query core/health preflight/polling; retry does reads only |
| 19.1-INT-001 | P0 | 5 | R19-01 | Actual request-authorized dashboard adapter plus new result entry, B-only fixture => A successful empty, no B values/identity |
| 19.1-INT-002 | P0 | 3 | R19-01/06 | Distinct A/B values: own exact event counts and adjusted accepted commitment through real authed RLS client |
| 19.1-INT-003 | P0 | 2/4 | R19-02/03 | Real role memberships across current roles/multirole: seller withheld, admin/PL allowed, Montör/Ekonomi no widget result despite economy field entitlement |
| 19.1-INT-004 | P0 | 2/7 | R19-01/02/04 | Omitted/forged roles or tenant/entitlement caller input and invalid session cannot widen real adapter access; app read has no privileged client |
| 19.1-INT-005 | P1 | 3/6 | R19-06/11 | Real pagination/batch fixture exceeds first row/ID limits, new result remains complete; preserve existing E10 large-fixture suite |
| 19.1-E2E-001 | P0 | 2 | R19-02/13 | Real login/current landings and visible eligible one card; ineligible roles none, no 19.2 placeholders; one authorized /quotes deep link |
| 19.1-E2E-002 | P1 | 3/9 | R19-06 | Seeded real source matches visible counts/rate/accepted value and Stockholm dates; denominator visible; timestamp is read completion |
| 19.1-E2E-003 | P0 | 4 | R19-03 | Unique accepted-value sentinel absent from seller HTML/RSC/client props/attributes and money key absent; mask text accessible; entitled control present |
| 19.1-E2E-004 | P1 | 5 | R19-10 | Successful empty period and sent-only/zero-decided periods render correct distinct copy, no assertion that tenant has no quotes |
| 19.1-E2E-005 | P0 | 6 | R19-05/12 | Contained harness fails real server read; generic card error/retry, no fresh zeros/partial values/SQL detail; heading/onboarding usable |
| 19.1-E2E-006 | P1 | 7 | R19-05/10 | From observed failure, retry yields accessible loading then real persisted server result/new completion time; repeated failure/clicks has no mutation or fake success |
| 19.1-E2E-007 | P0 | 7 | R19-04 | Revoke quote/money authority in same logged-in session before retry; fresh request obeys resolver and previous values/card do not survive; expired session denied safely |
| 19.1-E2E-008 | P1 | 8 | R19-09 | Existing first-admin warning/dismiss/restore across reload/completion plus hidden/non-admin; success/error card cannot change checklist branch |
| 19.1-E2E-009 | P1 | 9 | R19-10 | Keyboard and accessibility tree reach heading/content/mask/deep link/retry; loading/result announcements, readable time meaning |
| 19.1-E2E-010 | P1 | 9 | R19-10 | 360×640/tablet/desktop: single full-width 12-column row → one-column, all loading/error/empty/masked states without horizontal overflow |

NFR coverage: security INT001–004/E2E001,003,007 plus source/bundle containment; reliability UNIT007–014/E2E005–008; bounded scale/performance UNIT015/INT005 with recorded duration, no invented dashboard SLA; maintainability registry equality/shared-core/legacy regression and current CI; accessibility E2E009–010. Report actual revision, executed/failed/skipped counts, fixture limits and browser payload/trace/screenshot artifacts with secrets excluded.

Deferred Story 19.2 planning only: future follow-up due/overdue/quick-complete persistence+permission test; mine/team booking tenant/role projection; conflict count by type and authorized resolver link; active-job status/activity/missing-date projection; reported-vs-expected hour semantics and entitlement. All require reviewed detailed source/AC admission first. No runnable tests, fake data sources, widget IDs, grants or placeholder spec are generated for 19.2.

Execution: P0 first then P1 at PR; keep all current functional checks in required PR gates, not a speculative night-only exemption. No new nightly/weekly automation requested. Large E10 fixtures keep existing gate until measured duration justifies an approved scheduling change. Node pure/fake-transport tests prove logic; Vitest real authenticated DB proves RLS; production Playwright proves rendered/request/retry paths. Browser-only interception cannot establish server DB failure. Required local DB flag SUPABASE_TEST_REQUIRED=1; unavailable/skipped means uncovered, not pass. Use guard-owned isolated services when implementing; never target demo and never use resource reset/deletion as teardown.

Estimate: P0 ~20–36 engineer hours; P1 ~14–24 hours; fixture/fault-harness/reporting ~6–12 hours; total ~40–72 hours (~5–9 working days for one owner), excludes service waits and 19.2. Estimates are planning ranges, not measured throughput or new deadline.

Entry: reviewed admitted spec + verified base/ownership, unchanged source authorities, reserved shared scope seam, synthetic fixtures, contained server-read fault/revocation seam and isolated service readiness before DB/browser use. Exit: 100% required AC scenario families mapped, P0 100% pass, P1 minimum 95% (this plan's 14 P1 groups means all 14 pass); unwaived current story failures prevent completion. General minimum planning coverage 80% is stricter here at 100% AC mapping, with no invented line coverage metric. All current high risks mitigated with executed evidence and independent High review before release; no score9 unresolved. Formal release/trace/NFR assessment not evaluated in this planning run. Full Epic 19 exit additionally requires future reviewed 19.2 and all five widgets/gates.


## Step 5 — Generation and validation

Completed at 2026-10-07T14:14:49Z. Epic-level single-worker output persisted at _bmad-output/test-artifacts/test-design-epic-19.md. Seventeen unique correctly scored risks (13 high, 4 monitored), thirty unique scenario groups (16 P0, 14 P1), all nine admitted AC families mapped. Canonical 19.2 remains deferred with five widget planning horizons; no placeholder spec or execution admission. Applicable checklist self-validation and artifact structural/risk/count checks passed; template fields populated and current/deferred metadata verified. No actual product tests, service/browser sessions, status/aggregate changes or release/NFR approval claimed. Terminal on_complete resolver returned empty hook; no terminal action required.

## Quality & Testing Progress

Epic 19 test design complete; 19.1 implementation evidence pending; 19.2 deferred and Epic 19 incomplete. No human question blocks this planning output. Resolve primitive/fault-harness details during bounded implementation; downstream detailed specs/owner decisions remain future admission dependencies. Planning route: gpt-6.1-sol / high; no nested dispatch.

