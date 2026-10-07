---
stepsCompleted: ['step-01-load-context', 'step-02-define-thresholds', 'step-03-gather-evidence', 'step-04-evaluate-and-score', 'step-04e-aggregate-nfr', 'step-05-generate-report']
lastStep: 'step-05-generate-report'
lastSaved: '2026-10-07'
workflowType: 'testarch-nfr-assess'
mode: 'Create'
epic: 14
advisory: true
overallStatus: 'CONCERNS'
overallRisk: 'MEDIUM'
newProductExecutions: 0
releaseAuthority: false
reviewClearance: false
inputDocuments:
  - '_bmad/tea/config.yaml'
  - '.agents/skills/bmad-testarch-nfr/resources/tea-index.csv'
  - '.agents/skills/bmad-testarch-nfr/resources/knowledge/adr-quality-readiness-checklist.md'
  - '.agents/skills/bmad-testarch-nfr/resources/knowledge/ci-burn-in.md'
  - '.agents/skills/bmad-testarch-nfr/resources/knowledge/test-quality.md'
  - '.agents/skills/bmad-testarch-nfr/resources/knowledge/playwright-config.md'
  - '.agents/skills/bmad-testarch-nfr/resources/knowledge/error-handling.md'
  - '.agents/skills/bmad-testarch-nfr/resources/knowledge/playwright-cli.md'
  - '.agents/skills/bmad-testarch-nfr/resources/knowledge/nfr-criteria.md'
  - '_bmad-output/test-artifacts/test-design-epic-14.md'
  - '_bmad-output/implementation-artifacts/epic-14-context.md'
  - '_bmad-output/planning-artifacts/prd-phase-b.md'
  - '_bmad-output/planning-artifacts/architecture-phase-b.md'
  - '_bmad-output/project-context.md'
  - '_bmad-output/test-artifacts/traceability/epic-14-traceability-report.md'
  - '_bmad-output/test-artifacts/traceability/epic-14/gate-decision.json'
  - '_bmad-output/test-artifacts/epic-14-gate-iter1-evidence.json'
  - '_bmad-output/test-artifacts/story14-4-r2-browser-evidence.json'
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/implementation-artifacts/spec-14-1-scheduling-activation-person-profiles-and-work-hours.md'
  - '_bmad-output/implementation-artifacts/spec-14-2-bookings-and-assignees-schema-and-transactional-commands.md'
  - '_bmad-output/implementation-artifacts/spec-14-3-deterministic-conflict-engine-detection-core.md'
  - '_bmad-output/implementation-artifacts/spec-14-4-booking-editor-with-live-conflict-warnings-and-audited-override.md'
  - '_bmad-output/test-artifacts/story14-3-r2-check-summary.json'
  - '_bmad-output/test-artifacts/story14-4-r2-finalization-manifest.json'
  - '_bmad-output/test-artifacts/story14-4-verification.md'
  - '_bmad-output/test-artifacts/story14-4-r2-security.md'
  - '_bmad-output/test-artifacts/story14-4-r2-artifact-scan.json'
  - 'docs/process/agent-model-routing.md'
---

# NFR Evidence Audit — Epic 14: Resource and Scheduling Foundation

**Date:** 2026-10-07. **Scope:** completed Stories 14.1–14.4; advisory evidence audit only.

## Executive summary

**Overall status: CONCERNS. Overall evidence risk: MEDIUM.** The four automated domain audits contain **11 PASS, 15 CONCERNS, 0 FAIL** findings. Defined Epic 14 security, transaction, deterministic-engine, connected-retry and scope invariants have eligible recorded evidence. No new reachable product defect or critical/high NFR failure was identified by this evidence audit.

Performance/scalability remain **UNKNOWN**, as required by the approved test design; no owner-approved representative load/latency targets or eligible benchmark exist. Manual contrast/daylight and cross-rule exploratory evidence remain unrecorded. The broader ADR readiness checklist scores **11/29 met, 18 CONCERNS, 0 FAIL**: significant operational evidence gaps under the template's scoring bands. That broader readiness score does not replace the fresh **formal trace PASS (36/36 FULL)** or imply 18 product defects.

**Recommendation:** retain the fresh coverage PASS and complete the mandatory empty-database migration chain + seed + REQUIRED integration CI before merge. Keep the existing 14.1/14.2/14.4 follow-up recommendations and draft-PR caveats. Record targeted outstanding evidence before making its corresponding performance, accessibility, operational or compliance claim. This advisory document does not approve merge/release, clear review state, waive CI, certify hosted provisioning or credit pending Story 15.1 calendar entry behavior.

## Step 1 — Context and inputs

Implementation and recorded execution evidence are available. Create mode was selected autonomously under the delegated instructions. The installed template is adapted to the established epic-specific naming convention; the shared `nfr-assessment.md` is preserved. The customization resolver failed with uv cache OS error 5. The documented manual fallback found empty default prepend/append/facts/on-complete configuration and no project or personal override. English communication/output and `tea_browser_automation: auto` apply.

The Epic 14 test design is the primary NFR plan. Current story/context, Phase B PRD/architecture, manifest governance and recorded trace/evidence refine its implementation status. Its original pre-implementation wording is planning history; actual evidence is separately identified below. No template example thresholds are treated as owner-approved product limits.

`resources` owns active Epic 14 surfaces; `scheduling` remains pending. Contract C's four detector portions belong to 14.3 and have recorded actual passes before 14.4. Contract D transfers only real empty-slot click/drag entry in Schema/Resurser to 15.1; person/time-prefill does not prove calendar behavior. Connected responsive web at 360×640, explicit failure/retry and server-confirmed persistence apply. Phase C/offline/PWA, portal, AI, live vendor APIs, new public surfaces, hosted changes and the full-release legal/GDPR program are excluded.

Fresh formal trace coverage is 36/36 FULL (P0 13/13, P1 23/23); supplementary coverage is 74/77 FULL (P0 8/8, P1 66/66), with three unrecorded P2/P3 obligations. The five former resource-boundary gaps have actual recorded REQUIRED integration evidence. Trace PASS is a coverage gate only; it grants no release authority, review clearance, mandatory CI waiver or transferred calendar execution credit.

This audit performs bounded document/result inspection only. New product, browser, fixture, benchmark, unit and integration executions: **0**. No resource is launched, adopted, stopped or mutated. Existing mandatory empty-database migration chain + seed + REQUIRED integration CI and 14.1/14.2/14.4 review-follow-up caveats remain outstanding.

## Step 2 — Categories and thresholds

The primary Epic 14 test design supplies qualitative invariants and explicitly UNKNOWN performance/scalability limits. The carried PRD NFR1–8, NFR17–18, NFR24–30 and NFR35–41 are read through Phase B amendments; NFR42/43/48/51/53 and current architecture/contracts govern this epic. Historical PWA wording and later recurrence/resolver/feed requirements do not enlarge this audit.

| ADR category | Binding threshold / evidence criterion | Unknown or unassessed portion |
| --- | --- | --- |
| Testability & Automation | One pure clock/I/O-free engine; shared preview/save; deterministic golden/scenario packs; all P0 and at least 95% P1 named planned checks pass; REQUIRED integration/RLS executed, no unexplained skip credit | Numeric coverage target is at least 80% line **and** branch for pure conflict/capacity only once a repository-approved reporter exists; no report exists |
| Test Data Strategy | Synthetic, isolated tenant-aware fixtures; actual Tenant A/B negatives; only fixture-owned cleanup; no hosted/production test target or secret/PII artifacts | Earlier unidentified partial Auth fixtures are not credited as cleaned; no platform-wide data-retention certification |
| Scalability & Availability | Tenant separation and durable database authority; failures do not create partial booking state | Response p95/p99, page-load/TTI, throughput, concurrent users, maximum persons/horizon bookings/assignees/exceptions, CPU/memory/pool limits and availability SLA: UNKNOWN |
| Disaster Recovery | Record backup, restore, failover and recovery evidence separately from transaction rollback | Epic-specific RTO/RPO, immutable-backup restoration and regional failover: UNKNOWN/unrecorded; not an invented Epic 14 implementation requirement |
| Security | Forced tenant RLS/H4 and exact policies; anon/foreign-parent/lower-role/inactive negatives; current authorization plus row scope; no client service role; server/SQL actor/time authority; malformed/forged/stale input denied with exact no-write/audit state | Hosted encryption/MFA/rotation operational verification and full OWASP/penetration/compliance certification unrecorded; full legal/GDPR program is Phase C |
| Monitorability / Debuggability / Manageability | Correlated durable audit for critical commands; rules/config are injected facts/data; sanitized failure feedback | RED metrics, distributed trace propagation, dynamic log levels, operational alert delivery and error-tracker transport: unrecorded; no default numeric alert threshold |
| QoS / QoE | 360×640 connected form; reachable actions, keyboard/dialog/focus/live-region/non-color states, approved touch-target assertions, dirty-state and unsent draft retention, explicit retry, success only after server persistence | Manual contrast/daylight `14.NFR-A11Y-001` unrecorded; latency/rate quotas UNKNOWN; deterministic cases do not replace exploratory `14.EXP-001` |
| Deployability | Clean/typecheck/lint/unit/build/bundle/scope gates and immutable forward migrations; full empty-database chain + seed + REQUIRED integration CI before merge | Exact empty-chain Epic CI pending; hosted canary/rollback/zero-downtime drills unrecorded |

### Four automated audit domain threshold objects

- **Security:** the defined permission, RLS, no-client-secret, input and audit invariants above; zero known critical/high dependency vulnerabilities is the recorded `audit-high` gate, not blanket zero vulnerabilities.
- **Performance:** **UNKNOWN** in every numeric dimension. Functional large-payload success and fixture elapsed time cannot pass an SLO.
- **Reliability:** defined atomicity, replay/current-row recheck, fault rollback, explicit connected retry and server-confirmed persistence. Uptime, error-rate, MTTR and burn-in targets remain UNKNOWN.
- **Maintainability:** shared pure/config-driven engine, scope coherence and recorded canonical gates. Named scenario/golden completeness is the current substitute for a not-yet-approved numeric coverage reporter; duplication threshold/report and operational observability acceptance remain UNKNOWN.

Status rules: undefined thresholds/evidence → CONCERNS; demonstrated breach/control absence → FAIL; eligible evidence meets a defined invariant → PASS; an excluded standard/capability → N/A. Template examples such as 500ms, 99.9%, 5% duplication or automatic retries/circuit-breaker counts are not product defaults.

## Step 3 — Recorded evidence inventory

| Evidence | Actual recorded result and provenance | Eligible use / limit |
| --- | --- | --- |
| Fresh resource-boundary correction | `epic-14-gate-iter1-evidence.json`: focused 5/5/0/0, affected 47/47/0/0, REQUIRED full 1466 total/1465 passed/0 failed/1 skipped across 135 files; all native 0; source SHA-256 `2f653b1dd3c63a5776556307cd7d8764b6ed70df10000e13b9b69a8810e340b9` | Concrete foreign membership/profile, 31 checked RPC denials, four planner mutation positives, nine actor/status reads, raw 23505, exact two-tenant resource/audit no-op and final fixture cleanup; no new audit execution |
| Fresh trace | `traceability/epic-14/gate-decision.json`, matrix and summary: formal 36/36 FULL; supplementary 74 FULL/0 PARTIAL/3 NONE; mapped 297 identities in 38 files, discovery 342 in 44; mapped skip/fixme/pending 0 | Coverage PASS; named P0 8/8 and P1 66/66; identity inventory is not global execution percentage or line/branch coverage |
| 14.3 current actual gates | `story14-3-r2-check-summary.json`: focused 145 pass/0 fail/0 skip, required full 1368/1367/0/1; 62 conflict cases; identity-only two actual passes (60 filtered, no credit); UTC/Los_Angeles/Tokyo each 14/14/0/0 | Determinism/DST, shared preview/save, current rows, all four Contract C transfers and transaction/replay/identity-lock assertions; historical failures are retained |
| 14.3 canonical engineering gates | Same check summary: typecheck/lint/build/source+bundle containment/lockfiles/audit-high native 0; units 1993/1992/0/1; lint 0 errors/13 inherited warnings; audit 0 high/2 moderate | Historical recorded evidence with sharp 0.35.5 repair; no fresh dependency scan, whole-ecosystem security guarantee or numeric coverage |
| 14.4 command/component/units | `story14-4-r2-finalization-manifest.json`: full REQUIRED INT 1461/1460/0/1, affected 172/172/0/0, units 2036/2035/0/1, final component/read 27/27/0/0 | Whole logical-group selective acceptance, current auth/replay, actor/reason/SQL-time/audit, rollback and scope; structural/mocked read tests are separate from SQL authority |
| 14.4 final production browser | `story14-4-r2-browser-evidence.json`: build `ZtvjBbekFSgZQChOruaeT`, diagnostic 18 passed/1 failed/0 skipped/0 flaky; separate same-build targeted run 1/1/0/0 | 18 successful mounted bodies plus separate corrected large case; **not** one 19-pass run; diagnostic failed before HTTP response at inherited 15s interceptor bound |
| Large actual browser save | Targeted case: 1,000 logical groups, select one; POST 1,120,245 bytes, HTTP 200, one booking/audit, one accepted/999 open; runner elapsed 40.545s, bounded 90s interceptor | Durable functional transport proof only; not HTTP duration, p95, load benchmark, representative volume or scale certification. Earlier different-build 900/select300 HTTP 500 has unknown cause |
| Transport bound | 14.4 author/review evidence: bounded 4MiB Server Action transport, 3MiB human review envelope and pre-attempt rejection guards | Payload envelope/functional boundary, never latency limit or scheduling scale promise |
| Source/build/result integrity | Final source/test/config fingerprint `f34ee23dc52a0f92f6de0ea24b0328946c5dbe96d1c6a34986abcef20e94712a`, 53 files; correction evidence retains those hashes and records only added tests/TEA metadata; captured stdout cosmetic corrections retain prior/current hash and unchanged structured native results | Source identity and immutable 99-record SQL ledger/max 20261007131222 are recorded historical facts, not current live DB inspection or empty-chain proof |
| Artifact handling | `story14-4-r2-artifact-scan.json`: 28 captured reports checked with no additional redactions; independent scan and correction scan separately recorded; credential/cookie/proof values redacted before commit | Scoped artifact proof only; existing public synthetic fixture defaults are not claimed as a private incident; no credential values inspected or printed here |
| Clock diagnosis and correction | 14.3 author evidence records owner disabling competing Ubuntu timesyncd; bounded 55s observation, 2,734 samples, zero backward steps; subsequent actual gates green | Supports that bounded observation only; no indefinite stability, attribution of every old failure, or agent-permitted WSL/host change |

No new browser collection is necessary: stopped managed server/browser/database resources are unavailable and recorded bodies/results cover the advisory audit. Runtime browser tooling is not launched merely to replace an unknown metric with unrelated page timings. Storage physical-loader (CI-only) and Windows xattr skips remain excluded from acceptance coverage; populated-stack schema checks do not prove an empty migration chain.

Evidence gaps carried to evaluation: `14.NFR-PERF-001`, `14.NFR-A11Y-001`, `14.EXP-001`; numeric coverage/duplication; runtime metrics/tracing/error tracking; hosting encryption/rotation verification; availability/error rate/MTTR/burn-in; DR/hosted deployment drills. Unknowns are evidence limits and do not manufacture new Epic 14 obligations or code defects. Exact empty-chain + seed + REQUIRED Epic CI remains a genuine pre-merge gate.

## Step 4 — Domain audit and aggregation

Configuration requested `auto` execution with capability probing. `collaboration.list_agents` succeeded and a worker API was exposed; the **actual first High security worker launch returned `agent thread limit reached`**. No child launched. The documented runtime fallback resolved **sequential**, with the single primary retaining High for security/RLS/authorization/secrets/transactional integrity. All four domain steps completed with their specified structured JSON contracts. No independent-child review or parallel speedup is credited. Requested routes and actual fallback are retained in `nfr/epic-14/execution-context.json`.

The timestamp is `2026-10-07T15-40-26-879Z`. Windows TEMP replaces POSIX `/tmp`; security/performance/reliability/maintainability and aggregate summary JSON each have a `C:/Users/Rasmus/AppData/Local/Temp/tea-nfr-{domain}-2026-10-07T15-40-26-879Z.json` mirror. Durable counterparts are `nfr/epic-14/{security,performance,reliability,maintainability,summary}.json`. Every expected file was read and parsed before aggregation.

| Domain | PASS | CONCERNS | FAIL | Overall / risk | Interpretation |
| --- | ---: | ---: | ---: | --- | --- |
| Security | 5 | 3 | 0 | CONCERNS / MEDIUM | Defined current auth, RLS/row permissions, acceptance input, scoped secret handling and recorded audit-high pass; operational encryption, API breadth/abuse and MFA/rotation evidence incomplete |
| Performance | 0 | 4 | 0 | CONCERNS / MEDIUM | Latency, representative scale/throughput, resource and optimization targets/evidence UNKNOWN |
| Reliability | 3 | 5 | 0 | CONCERNS / MEDIUM | Actual atomic rollback/replay, pure/current-row determinism and connected failure/retry pass; operational monitoring, uptime, error-rate, MTTR and burn-in unknown |
| Maintainability | 3 | 3 | 0 | CONCERNS / MEDIUM | Shared-engine/scope, named high-priority completeness and recorded engineering gates pass; numeric coverage/duplication and runtime observability unmeasured |
| **Finding total** | **11** | **15** | **0** | **CONCERNS / MEDIUM** | **26 domain findings**, not acceptance criteria or product-defect counts |

UNKNOWN-default enforcement was checked: all performance findings remain CONCERNS; a mixed domain's known qualitative invariant cannot certify its unmeasured numeric/hosting subdimension. Overall risk is the maximum MEDIUM domain risk. Findings are aggregated without another review round or reassessment. Shared compliance entries use the most conservative status; excluded SOC2/HIPAA/PCI/ISO and full GDPR program remain **N/A**, never promoted to PASS by the illustrative aggregation pseudocode. This audit certifies no organization standard.

Two cross-domain MEDIUM evidence risks are retained: (1) reliability/maintainability lack runtime metrics, structured operational log/error delivery and trend evidence; durable business audit rows do not replace those signals; (2) performance/reliability cannot establish capacity/error-rate behavior without approved load and measurement targets. Neither is a newly demonstrated production vulnerability. All priority recommendations are retained in the aggregate JSON. No high/critical new NFR defect or waiver is claimed.

## Step 5 — Completed assessment report

### Performance assessment

| Dimension | Threshold | Actual / evidence | Status |
| --- | --- | --- | --- |
| HTTP/engine/save response p95/p99, page load, TTI | UNKNOWN | No eligible benchmark; large case 40.545s is runner elapsed, HTTP200 is functional outcome; `performance.json`, Step 3 browser evidence | CONCERNS |
| Throughput/concurrent users/representative tenant volume | UNKNOWN | No load profile; synthetic 1000 groups/select one establishes only that functional boundary | CONCERNS |
| CPU/memory/DB connection/query budgets | UNKNOWN | No accepted profile or current pool/CPU/memory telemetry | CONCERNS |
| Optimization/bottleneck measurement | UNKNOWN | Shared engine/config and payload guards are recorded design facts, no measured optimization impact | CONCERNS |

No default numeric target, counterfactual failure attribution, caching/indexing/CDN requirement or scale certification is created. `14.NFR-PERF-001` stays NONE in the trace and CONCERNS here.

### Security assessment

Authentication strength is assessed against the defined current authenticated-active-member/trusted-actor requirement, which passes the recorded SQL/command evidence. Authorization controls pass the defined FORCE RLS/H4/role/row boundary with actual foreign-parent, direct RPC/status negatives and planner positives. Input/acceptance authority passes the actual current-facts, complete logical-group, reason/actor/time and atomic-audit cases. Scoped client-secret/privileged-path containment and artifact redaction pass the recorded checks. The recorded zero-critical/high `audit-high` threshold passes with **two moderate advisories disclosed**; this audit ran no current vulnerability scanner.

**CONCERNS:** hosted encryption-at-rest/TLS operational attestation; broad OWASP/API-abuse quota evidence; operational MFA/key-rotation lifecycle. These are unknown evidence dimensions, not a claimed bypass or absence of enforced product controls. Full-release legal/GDPR program, SOC2, HIPAA, PCI-DSS and ISO 27001 certification are **N/A to this Epic 14 audit**, with no compliance certification. The domain JSON records the exact evidence and recommendations for all eight findings.

### Reliability assessment

**PASS:** transactional fault tolerance/rollback and authorized replay; pure/shared/current-row deterministic detection with UTC/Stockholm/DST golden evidence; actual connected 360×640 draft retention, explicit retry and confirmed persistence without duplicates. Required integration executed; named critical/high acceptance is unskipped. Neither the physical Storage skip nor Windows xattr skip is credited.

**CONCERNS:** availability SLA/uptime, operational error rate, MTTR/infrastructure recovery, runtime monitoring/alert delivery and consecutive CI burn-in. All numeric thresholds and eligible observation windows are UNKNOWN. No circuit-breaker count or automatic retry policy is inferred from generic examples; this epic uses the approved explicit user retry. Disaster recovery is separately unassessed below, and transaction rollback is not backup restore. Historical failures and the two-run browser result are retained without a stability percentage.

### Maintainability assessment

**PASS:** shared pure/config-driven rules and manifest/Contract C/D scope ownership; named high-priority scenario/golden completeness; recorded canonical typecheck/lint/unit/build/lockfile/containment and audit-high gates. Current formal and named P0/P1 completeness is 100%; it is not code coverage. The recorded 13 inherited lint warnings and two moderate advisories remain visible; targeted correction lint has zero warnings.

**CONCERNS:** no numeric line/branch report against the conditionally planned ≥80% pure conflict/capacity target; no approved duplication threshold/jscpd-equivalent report/trend; no validated operational structured-log/error-tracker delivery. The original author review trail exists; its validated stops do not grant independent review clearance. Story follow-up recommendations and exact empty-chain CI remain separate.

### Custom NFR evidence audits

| Custom dimension | Defined requirement and evidence | Verdict |
| --- | --- | --- |
| Responsive/accessibility automation | Actual 360×640 bounds, keyboard/dialog parity, focus/dirty guards, live regions, non-color text and approved touch-target assertions in retained browser cases | PASS for this automated scope |
| Manual contrast/daylight (`14.NFR-A11Y-001`) | No manual visual review record; semantics/bounds do not prove daylight/contrast | CONCERNS; trace NONE |
| Cross-rule exploratory charter (`14.EXP-001`) | No charter outcome; named deterministic work-hour/DST/access/retry tests do not become exploratory evidence | CONCERNS; trace NONE |
| Contract D calendar entry | Actual empty-slot click/drag in both Schema and Resurser, selected interval/person and keyboard parity required at receiving Story 15.1 before exposure/completion | N/A to current retained Epic 14 denominator; TRANSFERRED/PENDING, zero execution credit |
| Full organization legal/privacy and hosted enablement | Phase C legal/GDPR program and separately gated hosted provisioning/distribution | N/A; no approval or certification |

### ADR readiness findings summary — all 29 criteria

Each PASS below is scoped to recorded Epic 14 evidence. CONCERNS means insufficient operational/quantitative evidence, not a newly introduced defect. Unknown targets are never guessed. The checklist is broader than the epic's acceptance inventory.

| Criterion | Verdict | Evidence / limitation |
| --- | --- | --- |
| 1.1 Isolation | PASS | Pure no-I/O engine, mocked read/component seam and separate real SQL/RLS fixtures; Step 3 evidence |
| 1.2 Headless business interaction | PASS | Core rules/booking writes are actual engine/checked commands/RPCs, separately exercised from UI |
| 1.3 State control | PASS | Synthetic two-tenant factories and actual edge-state/fault fixtures with targeted cleanup |
| 1.4 Valid/invalid documented sample requests | CONCERNS | Executable fixture requests exist; no complete design-document JSON/cURL sample catalogue is credited |
| 2.1 Segregation | PASS | Local synthetic tenant A/B evidence, H4/RLS/authorized endpoint scoping; no production metric claim |
| 2.2 Synthetic generation | PASS | Deterministic synthetic factories; no customer data/hosted fixture target |
| 2.3 Teardown mechanism | PASS | Current new boundary cases have final fixture cleanup and browser successful fixtures cleanup; earlier unidentified partial Auth fixtures not certified removed |
| 3.1 Stateless scaling/restart | CONCERNS | Pure engine and durable DB state are known; horizontal/restart under load not measured |
| 3.2 Bottleneck identification | CONCERNS | No approved load/query/resource profile |
| 3.3 Availability SLA/redundancy | CONCERNS | UNKNOWN SLA and observation window; no redundancy drill |
| 3.4 Dependency circuit breaker/fail-fast operational behavior | CONCERNS | Friendly explicit retry/atomic rollback known; broader dependency hang/reset envelope unmeasured, no generic breaker mandate |
| 4.1 RTO/RPO | CONCERNS | UNKNOWN recovery targets and exercise |
| 4.2 Regional/zone failover | CONCERNS | No drill or measured failover evidence |
| 4.3 Immutable backup restoration | CONCERNS | No backup integrity/restore measurement; rollback tests are not backup restore |
| 5.1 Authentication/least-privilege authorization | PASS | Actual current auth/role/row/RLS and direct RPC negative/positive boundaries |
| 5.2 At-rest/transit encryption operational proof | CONCERNS | Local fixture evidence cannot attest hosted encryption/TLS/key custody |
| 5.3 Complete secret-store/rotation lifecycle | CONCERNS | Scoped containment/artifact redaction pass; complete hosted key-store/rotation lifecycle unverified |
| 5.4 Input validation | PASS | Actual schema/checked-command malformed/foreign/stale/substitution/reason/group negatives; not full OWASP certification |
| 6.1 Trace/correlation propagation | CONCERNS | Durable business correlation/audit known; runtime distributed propagation not measured |
| 6.2 Dynamic structured operational logs | CONCERNS | No validated dynamic level/format/transport sample |
| 6.3 RED metrics | CONCERNS | No operational rate/error/duration series or delivery evidence |
| 6.4 Externalized behavior configuration | PASS | Actual work-hour/calendar/capacity input writers and injected configurable rule/golden packs |
| 7.1 p95/p99 latency | CONCERNS | UNKNOWN threshold; no eligible timing distribution |
| 7.2 Noisy-neighbor rate limit | CONCERNS | UNKNOWN applicable quota/throughput target and abuse evidence |
| 7.3 Perceived pending/loading feedback | PASS | Actual held preview/save, pending state and honest unsent/server-confirmed feedback; no premature optimistic persistence |
| 7.4 Graceful user-facing degradation | PASS | Real injected failure/lost-response, retained draft, visible failure/explicit retry, exact durable outcome |
| 8.1 Zero-downtime/canary | CONCERNS | No hosted deployment drill; not undertaken by this audit |
| 8.2 N−1/deployment compatibility | CONCERNS | Immutable forward SQL recorded; separate old/new schema deploy proof and exact empty-chain CI are not claimed |
| 8.3 Automated post-deploy rollback | CONCERNS | No health-trigger/rollback drill or approved RTO |

| ADR category | Met | PASS | CONCERNS | FAIL | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| Testability & Automation | 3/4 | 3 | 1 | 0 | CONCERNS |
| Test Data Strategy | 3/3 | 3 | 0 | 0 | PASS |
| Scalability & Availability | 0/4 | 0 | 4 | 0 | CONCERNS |
| Disaster Recovery | 0/3 | 0 | 3 | 0 | CONCERNS |
| Security | 2/4 | 2 | 2 | 0 | CONCERNS |
| Monitorability/Debuggability/Manageability | 1/4 | 1 | 3 | 0 | CONCERNS |
| QoS/QoE | 2/4 | 2 | 2 | 0 | CONCERNS |
| Deployability | 0/3 | 0 | 3 | 0 | CONCERNS |
| **Total** | **11/29 (37.9%)** | **11** | **18** | **0** | **CONCERNS** |

Template scoring bands: ≥26/29 strong foundation; 20–25/29 room for improvement; <20/29 significant gaps. The latter applies to this broader evidence checklist, with no escalation of unmeasured dimensions into critical defects. Four-domain finding counts (26 total) and checklist counts (29 total) are independent denominators.

### Quick wins

These are advisory planning estimates and suggested owners, not assigned commitments or work executed in this audit.

1. **Target decision record — MEDIUM; 30–60 minutes; product/architecture + test owner.** Define representative people/horizon/booking/assignee/exception workload and explicit engine/HTTP/save latency, throughput/error and resource limits. This makes performance evidence falsifiable without a code change.
2. **Manual visual record — MEDIUM; 30–60 minutes; UX/accessibility + test owner.** Record viewport/device/light conditions, contrast readings and daylight observations for conflict states/primary actions against an approved criterion; this closes only the manual evidence gap if passed.
3. **Evidence index and operational applicability — MEDIUM; 30–60 minutes; engineering/operations/security owners.** Attach existing approved coverage/log/error/hosting/DR/deploy records where they exist; mark applicability/UNKNOWN where they do not. No hosted setup or new product feature is prescribed.

### Recommended actions

| Priority / timing | Suggested owner | Action / validation | Planning effort |
| --- | --- | --- | --- |
| HIGH existing gate, before merge | Root + CI maintainer | Run existing exact empty-database migration chain, minimal seed and `SUPABASE_TEST_REQUIRED=1` full Epic CI; retain native result and executed/skipped counts, plus physical Storage/Linux native proof under their configured gates | Existing pipeline duration; no new estimate or local rerun required by this audit |
| Existing review authority, before merge/release decision | Root / independent-review owner | Preserve 14.1/14.2/14.4 follow-up recommendations, draft PR and the configured one-follow-up/story history. Decide through existing epic release process; this NFR result cannot clear state or start broad R3 | Existing workflow, unestimated |
| MEDIUM, before performance/scalability PASS claim | Product/architecture + test owner | Approve thresholds/volumes, then record separately timed engine/HTTP/save benchmark distributions, throughput/resource/query-plan profile under declared setup; `14.NFR-PERF-001` must remain uncredited until eligible evidence | Target record 0.5–1h; measurement effort TBD after profile approval |
| MEDIUM, before manual accessibility claim | UX/accessibility + test owner | Record contrast/daylight review of retained conflict states/actions; preserve automated semantics/bounds evidence separately | 0.5–1h initial review, follow-up TBD |
| LOW, planned exploratory milestone | Test owner | Execute/record `14.EXP-001` cross-rule charter and observations after deterministic suites; never rename deterministic passes as exploration | 1–2h initial charter, follow-up TBD |
| MEDIUM, before quantitative maintainability/operational claims | Engineering + operations/test owners | Record reporter approval and real line/branch coverage; define duplication criterion; attach structured runtime log/error-tracker/metrics samples and trend window | 0.5–1h applicability/index; implementation/drill effort TBD |
| MEDIUM, before corresponding hosting/security/recovery/deploy certification | Operations/security owner | Define applicable availability/error/MTTR/RTO/RPO/abuse/key lifecycle thresholds and attach uptime/incident/restore/failover/rollback evidence; no mandatory Epic 14 feature expansion or Phase C legal program | 0.5–1h applicability; operational measurements TBD |
| Receiving-owner mandatory gate, before calendar entry exposure and 15.1 completion | Story 15.1 dev/test owner | Actual Schema **and** Resurser click **and** drag open this editor with selected interval/supplied person plus keyboard/dialog parity. Contract D remains pending and uncredited here | Owned by 15.1 planning; not estimated/implemented here |

### Monitoring hooks

Recommended hooks remain **proposed and unconfigured**. Operations/test owners should correlate sanitized request/command IDs with engine/HTTP/save duration, outcome and error classes under the approved profile. Use existing durable audit/authorization-failure evidence without recording secrets, proofs, personal data or free-text reasons in metrics. Validate operational error-tracker/alert transport with a non-sensitive probe before claiming delivery. Request rate/error/duration and repeat-run trend denominators/windows must be declared. Alert on an approved threshold breach or existing mandatory CI failure; **numeric alert thresholds remain UNKNOWN**. Deadline: before each corresponding operational claim; no new monitor, automation or hosted change is authorized here.

### Fail-fast mechanisms

- **Security/data validation:** retain current checked RPC authorization, FORCE RLS/composite constraints, reason/current-review/full-group verification and exact transaction rollback; recorded cases already exercise them.
- **Transport:** retain the bounded 4MiB action transport, 3MiB human review envelope and pre-attempt guards. These are payload controls, not runtime SLOs or scheduling scale limits.
- **Reliability:** retain explicit connected retry, authoritative idempotent outcome and stale-review renewal. A generic circuit-breaker/automatic retry policy is **N/A as a new prescription** without a measured dependency need and approved scope.
- **Performance:** rate-limit/load targets remain UNKNOWN; gather applicable approved abuse/capacity evidence before proposing changes, rather than adding quotas from template examples.
- **Maintainability/deployment:** retain current scope/containment/typecheck/lint/unit/build and mandatory empty-chain CI. Numeric coverage/duplication enforcement waits for its approved reporter/criterion; no new gate is installed by this audit.

### Evidence gaps checklist

Suggested owners and relative deadlines below identify when claims can become eligible; they do not grant permission to execute hosted or Phase C work.

| ID | Missing evidence | Suggested owner / deadline | Eligible evidence / impact |
| --- | --- | --- | --- |
| G1 | `14.NFR-PERF-001`: approved latency/volume/load/resource profile | Product/architecture + test / before performance PASS | Approved target record + separately timed measured distributions/query/resource reports; current performance/scalability UNKNOWN |
| G2 | `14.NFR-A11Y-001`: manual contrast/daylight | UX/accessibility + test / before manual visual claim | Actual contrast/conditions/observations; automated semantics alone insufficient |
| G3 | `14.EXP-001`: cross-rule charter | Test owner / planned exploratory milestone | Recorded charter/outcomes; current deterministic coverage preserved |
| G4 | Numeric ≥80% pure engine/capacity line/branch report | Engineering/test / once reporter approved, before numeric claim | Reporter approval and actual coverage report/trend; formal trace100% is separate |
| G5 | Duplication threshold/report | Engineering/test / before duplication claim | Approved applicable threshold + jscpd-equivalent measurements; no percentage invented |
| G6 | Runtime logs/RED/tracing/error/alert delivery | Operations/engineering / before operational observability claim | Sanitized structured sample/schema/assertion + actual delivery/window; audits alone insufficient |
| G7 | Uptime/error/MTTR/burn-in thresholds and history | Operations/test / before stability/SLA claim | Declared observation windows and actual telemetry/repeated runs; one corrected targeted pass is not burn-in |
| G8 | Hosted encryption/API-abuse/MFA/key lifecycle evidence | Security/operations / before corresponding security certification | Approved applicability and hosting/rotation/abuse records; no inferred private-secret incident |
| G9 | DR and deployed canary/compatibility/rollback evidence | Operations / before corresponding recovery/deployability claim | Approved RTO/RPO plus actual restore/failover/deployment drill; not a new Epic 14 feature or Phase C program |
| G10 | Exact empty-database chain + seed + REQUIRED Epic CI | Root/CI / **before merge** | Native CI proof of full chain/seed/executed/skipped gates; populated local result does not substitute |

Contract D's receiving-owner pending portion and existing review recommendations are tracked separately from these NFR evidence gaps. No current local test is rerun to cosmetically fill G1–G9.

### Gate-ready YAML snippet

```yaml
nfr_assessment:
  date: '2026-10-07'
  epic_id: '14'
  feature_name: 'Resource and Scheduling Foundation'
  advisory: true
  overall_status: 'CONCERNS'
  overall_risk: 'MEDIUM'
  adr_checklist_score: '11/29'
  domain_findings: {pass: 11, concerns: 15, fail: 0}
  adr_criteria: {pass: 11, concerns: 18, fail: 0}
  domains:
    security: 'CONCERNS'
    performance: 'CONCERNS'
    reliability: 'CONCERNS'
    maintainability: 'CONCERNS'
  categories:
    testability_automation: 'CONCERNS'
    test_data_strategy: 'PASS'
    scalability_availability: 'CONCERNS'
    disaster_recovery: 'CONCERNS'
    security: 'CONCERNS'
    monitorability: 'CONCERNS'
    qos_qoe: 'CONCERNS'
    deployability: 'CONCERNS'
  critical_new_nfr_defects: 0
  high_new_nfr_defects: 0
  new_product_executions: 0
  execution_mode: 'sequential'
  child_launches: 0
  nfr_execution_blockers: false
  mandatory_premerge_ci_pending: true
  release_authority: false
  review_clearance: false
  performance_scalability: 'UNKNOWN'
  formal_trace_gate: 'PASS'
  formal_coverage: '36/36 FULL'
  supplementary_coverage: '74/77 FULL; 3 NONE'
  unrecorded: ['14.NFR-PERF-001', '14.NFR-A11Y-001', '14.EXP-001']
  recommendations:
    - 'Complete mandatory empty-chain migration+seed+REQUIRED Epic CI before merge.'
    - 'Retain existing review recommendations and draft-PR caveats.'
    - 'Approve targets and capture eligible performance evidence before PASS claims.'
    - 'Record manual contrast/daylight and exploratory outcomes separately.'
    - 'Preserve Contract D actual calendar click/drag as pending at Story 15.1.'
```

### Related artifacts and validation

Primary plan: `test-design-epic-14.md`; current implementation context/specs, Phase B PRD/architecture and routing policy are listed in frontmatter. Actual results and trace links are identified in Step 3. Durable domain/summary/execution-context JSON under `nfr/epic-14/` preserve the complete output contracts. No deployed uptime/APM/benchmark directory or live-target authority was supplied or fabricated.

Checklist validation: implementation/source and recorded local production-build result evidence are accessible; live deployment accessibility is **N/A to this bounded advisory audit**. All four domain and eight ADR categories/29 criteria are evaluated; unknown metrics/targets, absent scanners/drills and excluded compliance standards are explicitly recorded. All template sections are populated or scoped N/A. Recommendations have suggested owners/relative deadlines/conditional planning estimates. Domain JSON and YAML/report totals are reconciled; source evidence is referenced rather than executed. No story/state/root report is edited. No browser/CLI session was opened; session cleanup is N/A and root-owned Stop acknowledgments require no polling. This is an NFR evidence audit, not another code review.

### Sign-off and next actions

**NFR verdict: CONCERNS, advisory and non-blocking as an audit.** There are zero new critical/high demonstrated NFR defects and no NFR execution blocker. There is still an existing mandatory **pre-merge** CI requirement, existing review recommendations, unmeasured performance/manual/exploratory evidence and pending 15.1 receiving-owner work. No waiver is applied. The current trace coverage PASS remains valid within its stated boundary; release/merge/hosted enablement authority is unchanged.

Next workflow: the root's existing epic gate/release process should consume this advisory report alongside the fresh trace PASS and independent test-quality output, preserving mandatory CI and review authority. Revisit only the corresponding NFR dimensions when eligible target decisions/new evidence arrive; do not reopen a broad review round or rerun unchanged local gates simply because the audit contains UNKNOWN dimensions.

Completion hook: the terminal customization resolver again returned native 1 with the documented uv cache OS error 5. Per the skill's terminal rule, the hook was skipped and the workflow exits normally; the manually loaded default hook is empty. No cache/ACL change or escalation was needed.
