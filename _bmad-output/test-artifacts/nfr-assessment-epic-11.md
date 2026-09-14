---
stepsCompleted:
  - step-01-load-context
  - step-02-define-thresholds
  - step-03-gather-evidence
  - step-04-evaluate-and-score
  - step-04e-aggregate-nfr
  - step-05-generate-report
lastStep: step-05-generate-report
lastSaved: '2026-09-11'
workflowType: testarch-nfr-assess
mode: create
advisory: true
inputDocuments:
  - _bmad/tea/config.yaml
  - .agents/skills/bmad-testarch-nfr/resources/knowledge/adr-quality-readiness-checklist.md
  - .agents/skills/bmad-testarch-nfr/resources/knowledge/ci-burn-in.md
  - .agents/skills/bmad-testarch-nfr/resources/knowledge/test-quality.md
  - .agents/skills/bmad-testarch-nfr/resources/knowledge/playwright-config.md
  - .agents/skills/bmad-testarch-nfr/resources/knowledge/error-handling.md
  - .agents/skills/bmad-testarch-nfr/resources/knowledge/playwright-cli.md
  - .agents/skills/bmad-testarch-nfr/resources/knowledge/nfr-criteria.md
  - _bmad-output/test-artifacts/test-design-epic-11.md
  - _bmad-output/test-artifacts/test-design-progress-epic-11.md
  - _bmad-output/implementation-artifacts/epic-11-context.md
  - _bmad-output/implementation-artifacts/spec-11-1-role-storage-and-permission-matrix-mechanism.md
  - _bmad-output/implementation-artifacts/spec-11-2-non-admin-access-to-the-phase-a-surface-matrix-seed-role-aware-rls-nav-and-landing.md
  - _bmad-output/implementation-artifacts/spec-11-3-admin-user-management.md
  - _bmad-output/implementation-artifacts/spec-11-4-roles-surface-effective-permissions-and-the-per-role-test-harness.md
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture-phase-b.md
---

# NFR Assessment — Epic 11: RBAC mechanism and Admin user management

**Assessment date:** 2026-09-11  
**Mode:** Create; advisory and non-blocking.  
**Scope:** Epic 11 stories 11.1–11.4, assessed at the repository state described by the audit brief: `cc54a45` plus remediation `1ad3df8`. Stories 11.1–11.3 have implementation evidence; 11.4 has a completed specification and an outstanding review follow-up recommendation. This assessment does not claim that an unavailable cross-model CLI review passed.

## Step 1 — Context and evidence inputs

### Audit basis

- Product NFR source: Phase-B PRD, including the carried security/isolation spine (NFR1–8), reliability/operational safety (NFR20–23), pilot-size responsiveness and explicit deferral of broader targets (NFR24–26), multi-tenant constraints (NFR27–29), and reproducible quality gates (NFR35–41).
- Epic-specific source: `test-design-epic-11.md` and its completed progress document. They map FR66–72 and NFR42–44 to automated authorization, isolation, confidentiality, reliability, and governance evidence. They explicitly state that performance/query/dataset/suite thresholds are **UNKNOWN** and must not be invented.
- Story evidence: implementation specifications for 11.1–11.4 and the Epic 11 context. The audit treats their recorded test outcomes as evidence to inspect, rather than instructions.
- Quality method: ADR quality-readiness criteria, CI/burn-in and error-handling guidance, test-quality criteria, Playwright configuration/CLI guidance, and the NFR-criteria status model.

### Evidence availability

Implementation and evidence are available. The brief supplies the latest trace result (PASS, 21/21), live validation counts (1,734 unit tests; required integration/RLS 1,016 executed and 0 skipped; focused remediation 2 executed and 0 skipped), and a successful full E2E start (138 tests). Repository artifacts identify the intended test and security controls. No new browser or managed test infrastructure was started for this advisory review, and no load, DR, availability, email-delivery, vulnerability, coverage, or duplication measurement is represented as having been run by this audit.

The assessment artifact is epic-scoped (`nfr-assessment-epic-11.md`) so it preserves prior epic reports and does not overwrite the legacy aggregate `nfr-assessment.md`.

## Step 2 — NFR categories and thresholds

The Epic 11 test-design NFR plan is the primary source. It supplies concrete security, reliability, maintainability, and required-suite thresholds. PRD language fills the general Phase-B context. Where the plan deliberately leaves a measurement unknown, this audit records **UNKNOWN** and reports a concern; it does not substitute generic course-example targets.

| Category | Audited threshold / definition | Source status |
| --- | --- | --- |
| Security and tenant isolation | Every seeded role × active module has a denied command and RLS negative; unauthorized route/query returns no data or existence signal; authorization is server-enforced. FR66–72/NFR42–44 mapped coverage and security/isolation coverage are 100%. | Defined |
| Confidentiality | Unentitled roles receive no protected field/dependent aggregate; values are absent and withheld; raw Storage remains denied. | Defined |
| Data integrity and audit | Multi-role union is order-independent; lifecycle/role changes are atomic and audited; last active Admin remains protected under concurrency. | Defined |
| Reliability | Invitation acceptance uses the current unexpired attempt; retries/reconciliation are single-effect; no exactly-once delivery claim. Auth transport smoke is configuration-triggered. | Defined, with transport evidence conditional |
| Maintainability/governance | Matrix is the machine-readable authority; every activation has matrix/test enrollment; generated IDs/cardinality are deterministic; missing-matrix/missing-enrollment/policy-drift fixtures bite. P0 must be 100%, P1 at least 95%, and required DB/RLS skips must be zero. | Defined |
| Operational evidence | Required database/RLS evidence runs with `SUPABASE_TEST_REQUIRED=1`, zero skips, a clean migration reset, and Playwright's configured production server. | Defined |
| Performance/scalability | Roles/effective-permissions latency, query count, representative dataset shape, and suite duration are **UNKNOWN**. A pilot-scale baseline is required before a release threshold can be set. | Explicitly UNKNOWN |
| Availability/DR/monitoring/deployability | No Epic 11 availability SLA, error-rate, RTO/RPO, failover, backup/restore, telemetry, or deployment rollback threshold is set. Existing project controls may provide context, but no epic-specific target is asserted. | UNKNOWN / not separately planned |
| Scope governance | Live surface derives from active manifest only; no custom role builder, database permission table, tenant-wide Arbetsledare, privileged public route, or Phase C capability. | Defined |

The audit will evaluate the four workflow domains (security, performance, reliability, maintainability) against these definitions, while retaining the ADR categories above as recorded context.

## Step 3 — Evidence collected

| Domain | Evidence inspected | Result and limit |
| --- | --- | --- |
| Security | Server-only `PERMISSION_MATRIX`, `requireCapability`, command capability registry/envelope, active-manifest derived role catalogue, RLS/membership/role-harness tests, containment scripts, and the current 21/21 trace matrix. | Strong authorization evidence. The trace records 18/18 P0 and 3/3 P1 criteria FULL, including generic equality for missing versus foreign membership detail reads, role/table/capability harness cardinality, direct RLS negatives, command pre-validation denial, and Admin/non-Admin browser coverage. This audit did not run a new pen-test or dependency scan; CI defines `pnpm audit --audit-level=high` as a blocking check. |
| Performance | Epic test-design records only a future P3 baseline. The repository includes a general auth/RLS baseline test, but no supplied Epic 11 pilot-size measurements for the role catalogue, member counts, effective permissions, or harness duration. | No current Epic 11 performance baseline or target. Browser/live measurement was not collected: there is no audit target URL or approved managed test environment, and the brief prohibits new infrastructure or broad reruns. |
| Reliability | Invitation and member-management code/tests, typed generic server error handling, operation/reconciliation tests, current trace evidence, and the Story 11.3 residual-risk record. | Strong evidence for atomic lifecycle control, current/unexpired invitation attempts, durable single-effect reconciliation, and generic failure mapping. External Supabase Auth delivery/receipt is not exercised by the local browser harness; the test design correctly makes transport smoke configuration-triggered and rejects an exactly-once claim. |
| Maintainability | Closed versioned matrix, active-manifest filtering, role-harness unique-ID/cardinality tests, deliberate matrix/policy/test-enrollment drift evidence, CI workflow, typecheck/lint/unit/build/containment/audit gates, and current trace results. | Strong governance/test-enrollment evidence. CI requires a frozen install, dependency audit, containment checks, typecheck, lint, units, build, local DB reset and integration/RLS, and E2E. No current code-coverage percentage, duplication measurement, production telemetry/error-tracking result, or burn-in result was supplied. |

### Recorded execution evidence

- Current trace at `1ad3df8`: **PASS**, 21/21 formal criteria; P0 18/18 and P1 3/3 fully mapped.
- Latest live validation in the brief: **1,734** unit tests; **1,016** required integration/RLS tests with **0 skips**; focused remediation **2/2** with **0 skips**; full E2E **138** started/passed.
- CI configuration makes `SUPABASE_TEST_REQUIRED=1` mandatory for the local database job and runs a fresh migration reset before integration/RLS; E2E uses the configured production server rather than `next dev`.
- Two historical cross-model CLI review runs returned empty output. They are unavailable evidence and are excluded from the assessment.
- Story 11.2 controlled hosted evidence is a narrow runtime proof for the Seller PDF/signing path; it is not routine regression evidence. Story 11.1 hosted ACL follow-up documents an object-grant correction and focused regression evidence.

### Evidence gaps

1. No Epic 11 performance baseline, dataset profile, query count, latency, or suite-duration measurement exists; targets remain UNKNOWN.
2. No external Auth email delivery/receipt proof is part of the local/browser evidence. This is a configuration-triggered operational check, not a claim of exactly-once delivery.
3. No Epic 11 availability SLO, error-rate/MTTR target, DR exercise, backup/restore evidence, production observability/error-tracking output, code-coverage percentage, or duplication measurement was supplied.

## Step 4 — Domain audit execution

`tea_execution_mode` is `auto` and capability probing is enabled. The runtime resolved the audit to **subagent** execution: four required domain workers completed, with worker scheduling constrained by the available agent slots. Their structured outputs were read from `C:\tmp\tea-nfr-{security,performance,reliability,maintainability}-2026-09-11T17-22-25.json`.

| Domain | Risk | Aggregated status | Basis |
| --- | --- | --- | --- |
| Security | HIGH | **FAIL** | A granted `authenticated` SECURITY DEFINER invitation-acceptance RPC has a direct caller-identity binding bypass. Strong RBAC/RLS and containment evidence does not cover or prevent it. |
| Performance | MEDIUM | CONCERNS | Every Epic 11 target and corresponding baseline is explicitly UNKNOWN/unmeasured. |
| Reliability | MEDIUM | CONCERNS | Durable lifecycle/reconciliation and zero-skip DB CI evidence are strong; invitation identity binding, external Auth delivery, and operational reliability evidence remain incomplete. |
| Maintainability | MEDIUM | CONCERNS | Matrix/harness/CI governance is strong; coverage/duplication metrics, current dependency-audit result, and operational observability are not supplied. |

## Step 4E — Aggregate NFR result

### Overall risk: HIGH

The overall risk is HIGH because security contains a FAIL. This is an advisory evidence audit; it records the result and does not change code, tests, specifications, process state, or release gates.

### Security FAIL — direct invitation-acceptance RPC bypass

**Caller and reachability.** Any user with an authenticated Supabase session can call `public.admin_accept_membership_invitation(uuid, text, uuid, text)` through PostgREST because the migration grants EXECUTE to `authenticated`. The function is `SECURITY DEFINER`. It accepts `p_user_id` and `p_email` from that caller, checks only `auth.uid() = p_user_id`, and checks `tenant_memberships.invited_email` against the caller-supplied `p_email`. It then sets `user_id = auth.uid()` and activates the membership.

**Invariant bypass.** An authenticated account other than the invitee that possesses a valid membership ID and raw invitation attempt token can supply its own UUID as `p_user_id` and the intended invitee address as `p_email`. The token hash, expiry, and supersession checks still pass, allowing the caller's account to be attached to and activate the invitee's membership. The normal Next.js route passes session-derived values, but it cannot constrain a direct RPC caller.

**Downstream controls checked.** The function itself is the privileged authorization boundary: its only identity check is `auth.uid() = p_user_id`; no RLS policy applies to its SECURITY DEFINER membership update, and no database constraint binds `auth.uid()` to `p_email` or binds the supplied email to a JWT claim. The existing test proves matching supplied email, token/hash, expiry, revoked status, and supersession, but not an authenticated different-user / supplied-invitee-email mismatch. Therefore no enforced downstream validator or constraint blocks this path.

**Evidence.** `supabase/migrations/20260910165124_admin_user_management.sql:160-184`; `src/server/commands/admin-users/accept-invitation.ts:23-33`; `tests/integration/commands/admin-user-management.int.test.ts:41-75`. The finding predates Story 11.4 and is whole-epic open work. No demo or real-user exploit was performed.

**Severity and remediation.** Advisory **HIGH / FAIL**. Derive the invitation recipient identity from a verified Auth JWT/session within the database boundary and compare that verified value to `invited_email`; do not authorize from `p_email` or `p_user_id`. Add a required `SUPABASE_TEST_REQUIRED=1` direct-RPC regression: valid token + different authenticated user + invitee email must return false and leave membership/audit rows unchanged. Rerun the relevant required integration/RLS evidence after a future remediation.

### Compliance roll-up

| Area | Result |
| --- | --- |
| Authentication and authorization | **FAIL** — direct-RPC invitation identity bypass |
| RBAC/test governance | PASS — closed matrix, active-manifest derivation, deterministic harness, trace 21/21, required CI gates |
| Performance targets and baseline | PARTIAL — all unknown/unmeasured |
| Lifecycle durability | PASS — durable operation/reconciliation evidence, subject to the separate acceptance identity defect |
| External Auth delivery / availability / DR / observability | PARTIAL — evidence or owner thresholds absent |
| Coverage/duplication/dependency-observability measurements | PARTIAL — governance/audit gate exists, current measurements/results absent |

### Cross-domain risks

1. **Security + reliability — critical impact:** the invitation identity bypass can attach the wrong authenticated account to a tenant membership, defeating the lifecycle boundary whose replay/reconciliation behavior is otherwise sound.
2. **Reliability + maintainability — high impact:** absent telemetry, availability/DR targets, and operational error evidence can conceal faults in privileged membership operations.
3. **Performance + maintainability — medium impact:** no baseline for role/catalogue/query/harness growth means the test suite and Admin read paths cannot be judged at a representative tenant size.

### Prioritized follow-up

1. **Urgent:** remediate the invitation RPC identity binding and add the zero-side-effect direct-RPC regression.
2. Record the planned R-1108 pilot-scale performance/query/suite baseline, then let the Architect/Product owner set targets.
3. Perform a bounded Auth transport smoke when templates, redirect allow-list, or provider-facing delivery changes.
4. Before a release-level NFR sign-off, establish availability/DR/observability evidence and decide whether quantitative coverage/duplication measurements are required.

## Final report

**Overall status: FAIL (advisory).** The finding is a release-relevant authorization defect, but this NFR workflow is advisory and does not halt the Epic 11 workflow. Its recorded outcome is complete; the root epic/PR process owns needs-attention tracking and remediation planning.

**Assessment count:** 3 PASS areas, 9 CONCERNS areas, 1 FAIL area. These counts group related evidence rather than claiming a measured score for all 29 ADR readiness criteria.

| Template category | Status | Threshold / actual / evidence |
| --- | --- | --- |
| Performance — response time, throughput, CPU/memory | CONCERNS | Threshold and actual: **UNKNOWN**. No role/catalogue/read/harness load metric or resource measurement; test-design R-1108 plans the first pilot-scale baseline. |
| Security — authentication and authorization | **FAIL** | Authenticated direct RPC must bind membership activation to the verified invitee identity. Actual: caller-controlled `p_email` authorizes the SECURITY DEFINER function. Evidence: migration lines 160–184 and existing direct-RPC test gap. |
| Security — data protection, vulnerability management, compliance | CONCERNS | RLS, hash storage, server-only key containment, and a blocking CI high-severity audit gate exist; current scan output, encryption/TLS/key-rotation, CORS/header, and broader compliance evidence are not supplied. Full-release legal/GDPR work remains out of scope. |
| Reliability — fault tolerance and lifecycle | CONCERNS | Durable operation/reconciliation and generic failure behavior pass their tested boundaries, but invitation identity binding fails and Auth transport receipt remains unproven. |
| Reliability — availability, error rate, MTTR, DR, burn-in | CONCERNS | Threshold/actual: **UNKNOWN**. No availability/error/MTTR targets, DR drill, backup/restore, or burn-in evidence supplied. |
| Maintainability — test coverage and duplication | CONCERNS | 21/21 traceability and zero-skip required DB evidence are strong, but no percentage/trend/threshold for code coverage or duplication exists. |
| Maintainability — dependency health and observability | CONCERNS | CI gate exists, but no current audit result, structured-log schema/validation, or error-tracking evidence was supplied. |
| Deployability and scope governance | PASS | Frozen lockfile, CI build/reset/containment gates, active-manifest enforcement, and Phase-C exclusions are represented; no zero-downtime/rollback target was set for this epic. |

### Recommended actions

**Immediate — owner: Epic 11 developer/security reviewer.** Fix the authenticated direct-RPC invitation acceptance boundary. The function must obtain recipient identity from a verified Auth claim/session inside the database boundary; the normal route may continue to pass incidental values, but those values cannot carry authority. Add a required integration/RLS negative test and verify no membership status, `user_id`, or audit event changes. This finding is estimated as a focused migration/function plus integration-test remediation; estimate is intentionally not quantified by this audit.

**Next milestone — owner: QA + Architect/Product.** Capture the planned R-1108 baseline for representative Roles/Admin-user reads and role-harness execution, documenting dataset shape, query count/plan, latency, environment, and unit/DB/E2E duration. Set performance thresholds only after reviewing that baseline. On any Auth template, redirect, or provider-boundary change, retain a bounded delivery smoke. Establish release-appropriate availability/DR/observability criteria before promoting operational reliability to PASS.

**Backlog — owner: QA/Platform.** Decide whether code-coverage, duplication, dependency-age, structured logging, and error-tracking measurements are release criteria; if so, define measurable thresholds and attach their evidence to the relevant release audit.

### Monitoring and fail-fast controls

- Preserve the existing CI fail-fast controls: frozen lockfile, high-severity dependency audit, source/bundle service-role containment, typecheck, lint, unit, local migration reset, required zero-skip DB/RLS, and E2E.
- Add the invitation direct-RPC mismatch as a required negative control. It must prove a direct authenticated caller cannot exchange another recipient's valid attempt for membership access.
- No new generic circuit breaker, rate-limit, or monitoring product surface is prescribed: targets and operational ownership are not defined for Epic 11.

### Validation checklist disposition

| Check | Disposition |
| --- | --- |
| Implementation and relevant evidence available | PASS — repository implementation, trace, CI configuration, and recorded execution counts inspected. |
| PRD, story/spec, test design, and required knowledge loaded | PASS. No standalone `tech-spec.md` exists; current Epic 11 specifications are the feature-level source. |
| Four domains assessed with defined or UNKNOWN thresholds | PASS — unknowns are explicitly marked CONCERNS. |
| New test/CI/browser sessions created | N/A — none were needed or started; no orphaned browser session exists. |
| Evidence gaps and actions documented | PASS. |
| Advisory release conclusion unambiguous | PASS — advisory FAIL due to one authorization defect. |

### Gate-ready YAML

```yaml
nfr_assessment:
  date: '2026-09-11'
  epic: '11'
  feature_name: 'RBAC mechanism and Admin user management'
  mode: advisory
  overall_status: 'FAIL'
  overall_risk: 'HIGH'
  domains:
    security: 'FAIL'
    performance: 'CONCERNS'
    reliability: 'CONCERNS'
    maintainability: 'CONCERNS'
  critical_issues: 0
  high_priority_issues: 1
  blockers: false
  advisory_open_issue: 'Authenticated direct-RPC invitation identity binding bypass'
  measured_evidence:
    traceability: '21/21 PASS'
    units: 1734
    required_integration_rls: '1016 passed; 0 skipped'
    focused_remediation: '2 passed; 0 skipped'
    e2e: '138 passed'
  unknowns:
    - 'Epic 11 performance/query/dataset/suite targets and measurements'
    - 'Availability, error/MTTR, DR, backup/restore, and production observability targets/evidence'
    - 'Code-coverage and duplication measurements'
  next_action: 'Record remediation in epic/PR needs-attention, fix the RPC boundary, and rerun required integration/RLS evidence.'
```

## Completion

The NFR evidence audit is complete. Its next recommended workflow after remediation is a targeted required integration/RLS validation followed by a fresh NFR assessment; the existing trace gate remains a separate coverage result and does not validate this NFR finding.

## 2026-09-14 pre-release reassessment (historical)

**Decision.** The 2026-09-11 **FAIL / HIGH** result remains historical evidence for the vulnerable revision. At integrated checkpoint candidate `7af45c46054e0c4a54f15f2d2802055f304365c3`, the identity-binding finding is **fixed and verified**. Candidate security therefore **PASS**es for that finding. The candidate overall NFR result is **CONCERNS**, because performance/query/suite, availability/DR/observability, external delivery, and coverage/duplication targets or evidence remain unresolved.

**Proposed dependent approval order and evidence.** PR [#57](https://github.com/rthunborg/ElproSaas/pull/57) targets `main` first for the focused security repair; source CI run [34828698510](https://github.com/rthunborg/ElproSaas/actions/runs/34828698510) passed 1,733 units with zero skips, 96 required DB files / 1,011 passed / 0 skipped, and 130 browser tests with four skipped (134 started). PR [#58](https://github.com/rthunborg/ElproSaas/pull/58) is reviewed atop the security branch; `f804a9573afacdac5df0842864bd610dbbaf425f` is its initial verified source revision, whose CI run [34829912153](https://github.com/rthunborg/ElproSaas/actions/runs/34829912153) passed 1,736 units with zero skips, 97 integration/RLS files / 1,014 passed / 0 skipped, and 132 browser tests with four skipped. PR #55 is reviewed atop the lifecycle branch. After each predecessor lands, retarget the dependent PR to `main` before merging it: PR #58 after #57, then #55 after #58. Live PR checks are authoritative for each latest published head. Integrated candidate `7af45c46054e0c4a54f15f2d2802055f304365c3` remains historical local code evidence: 1,751 units / 0 skipped, 101 required integration/RLS files / 1,023 passed / 0 skipped, including real mismatched-RPC and multi-tenant-admin regressions plus two mocked retry tests; its SQL-only verification did not perform an empty reset. The combined configured production-browser run completed at 2026-09-14T09:52:59Z: 14 passed / 0 skipped across `admin-user-management`, `admin-user-management-roles`, `role-catalogue-contract`, and `role-aware-phase-a-surface`. Typecheck, source and built-bundle service-role containment, and diff checks passed. Independent checkpoint review found no introduced issue in conflict-resolution scope and preserved the role/count/paging/enrollment plus invitation identity/lifecycle coverage. PR #55's earlier focused review at `49394f3c04b8cac6101d3ed007156fd546c3e51d` remains valid for its 13 review stops; historical cross-model CLI output remains unavailable evidence.

**Release and follow-up state at that checkpoint.** `main` and demo remained vulnerable until the security candidate was human-approved, merged, and its migration applied; the release blocker was therefore **IN** at the time of this pre-release assessment. Lifecycle implementation evidence was verified in the candidate, while published-head checks and human approval/merge/deployment were still pending. The reset retry production-command/action seam was tracked separately from test-maintenance debt. The clock-dependent retry fixture, oversized support files, and Roles readiness signals remained deferred advisory quality work.

**Release and follow-up state.** The candidate repairs were approved, merged, and deployed on 2026-09-14; the invitation identity release blocker is **closed as verified and deployed**. Candidate NFR remained **CONCERNS** for the unresolved performance, operational, external-delivery, coverage, and duplication evidence. The reset retry production-command/action seam was **SEAM** at this historical checkpoint: separately tracked, not implemented product-correctness work, not test-maintenance debt. The clock-dependent retry fixture, oversized support files, and Roles readiness signals remained **DEFERRED** advisory quality work. Release evidence and the advisor-warning limitation are recorded in [Epic 11 release verification](../../docs/quality/epic-11-release-verification-2026-09-14.md).

## 2026-09-14 post-release evidence reassessment

### Current decision

The 2026-09-11 **FAIL / HIGH** result above remains the historical assessment of the vulnerable revision. The approved merge sequence landed as PR [#57](https://github.com/rthunborg/ElproSaas/pull/57), PR [#58](https://github.com/rthunborg/ElproSaas/pull/58), and PR [#55](https://github.com/rthunborg/ElproSaas/pull/55). Final `main` revision `5cc08d2b15b161e4742ddddc3283be4a3c03a059` passed [post-merge CI run 34839174668](https://github.com/rthunborg/ElproSaas/actions/runs/34839174668): 1,751 unit tests with zero skips, 101 required integration/RLS files / 1,023 tests passed / zero skips, and 136 browser tests passed with four explicit skips. The three approved migrations were applied to the demo project and the deployed invitation function was inspected against the merged corrective definition. The authenticated direct-RPC identity-binding release blocker is therefore **closed**; current security is **PASS** for that finding.

The current aggregate NFR status is **FAIL**, with **HIGH** risk. There is no remaining critical or high security finding in this reassessment, but the real local Auth transport exposed a high, customer-reachable reliability defect in the application callback. Supabase Auth generated an allowed callback carrying the authenticated session in a URL fragment. Browsers do not send that fragment to the Next server route, while the route accepts only query `code` or `token_hash` plus `type`; the ordinary mailed-link journey therefore redirects to login before the invitation or recovery destination. A focused callback repair and a real mailed-link browser regression are required before this failure can close. Performance has a real local observation but no owner-approved target. Maintainability keeps strong deterministic trace/CI controls, but the recorded test-maintenance items and any quantitative coverage/duplication requirement remain open.

| Domain | Current status | Evidence and limit |
| --- | --- | --- |
| Security | **PASS** | Identity acceptance is bound to the trusted confirmed Auth user at the database boundary. Required direct-RPC mismatch and legitimate-acceptance regressions executed with zero DB skips; deployed function inspection matched the merged correction. Broader security controls retain their existing evidence and advisory limitations. |
| Performance | **CONCERNS** | R-1108 measured the production Admin-members tenant projection through an authenticated Tenant-A client at 120 active memberships, with a separate 24-member Tenant B. Across 25 samples after five warmups, list-read p95 was **45.72 ms**. A separate synthetic bulk effective-permissions calculation over all 120 rows had p95 **2.58 ms** for 2,224 resolved grants; the product computes one selected member's effective permissions rather than this bulk loop. The tenant projection used three authenticated RLS requests per iteration, excluding tenant-context resolution and rendering. These are local observations, not an approved SLO or capacity limit. |
| Reliability | **FAIL** | Real local Supabase Auth produced invite and recovery receipts in Mailpit and generated the configured `/auth/invite/confirm` redirect. The real browser journey fails because the generated implicit-flow session fragment is unavailable to the server-only callback route, which redirects to login when query credentials are absent. The reset-delivery retry follow-up is also still open. External SMTP delivery, availability targets, and recovery proof remain unmeasured. |
| Maintainability | **CONCERNS** | Final-main CI retained frozen install, dependency audit, typecheck, lint, build, containment, required zero-skip DB/RLS, and production-server browser gates. Clock-dependent retry fixtures, oversized support files, Roles-page readiness signals, and the owner decision on quantitative coverage/duplication remain tracked work. |

### R-1108 evidence disposition

The baseline supplies the tenant-projection part of the test design's requested pilot-shaped observation. It does not close R-1108 as a performance PASS until the owner approves the dataset and limits and comparable per-layer suite duration is recorded. It executed locally at `2026-09-14T13:00:07Z` against `5cc08d2b15b161e4742ddddc3283be4a3c03a059` with an intentionally dirty evidence-tool tree, Node `v22.23.2`, Supabase CLI `2.115.0`, and PostgreSQL `17.6`; the full fixture-and-measurement harness took **4,112.333 ms**. The measured Tenant-A path returned all 120 current-tenant memberships and used one membership page plus two child-role batches. Its superuser-only `EXPLAIN (ANALYZE, BUFFERS)` returned 120 rows through a sequential scan, removed **1,377** rows belonging to the pre-existing local database background, and completed in **0.147 ms**. Accordingly, the run measured an added two-tenant profile inside a non-empty local database; it must not be described as an isolated database containing only those two tenants. The plan is evidence of this one local query shape and is not, by itself, an index recommendation or production-scale result.

Candidate pilot acceptance limits proposed for owner review are: the documented 120-member Tenant A / 24-member Tenant B profile, Admin list p95 at or below **250 ms**, synthetic bulk effective-permissions computation p95 at or below **25 ms**, and no more than **three** authenticated RLS requests for this tenant projection. These values remain **proposed**, not accepted, in this assessment. The product Roles catalogue computation, selected-member detail path, tenant-context resolution, rendering, and test-design suite-duration target are outside these measurements.

### R-1109 evidence disposition

The local Mailpit run is meaningful transport evidence: it used real local Supabase Auth invite and recovery calls, inspected actual delivered messages, and followed each one-time Auth verification URL only as far as the generated application callback redirect. It used synthetic `example.test` recipients and did not print the URLs or token values. That manual redirect check did not exercise the application callback. The real browser attempt showed that Supabase placed the authenticated session in the redirect fragment; because fragments are client-side and the current callback is a server route, it receives neither query credential nor the fragment and redirects to login. This is a confirmed normal-flow defect, not missing evidence. R-1109 remains **FAIL** until the callback consumes a supported credential flow, persists the session, and reaches the intended invitation/recovery destination in a real browser regression. After that passes, the proof closes only the controlled local transport/callback boundary. External SMTP deliverability and recipient-mailbox acceptance require an approved non-demo Supabase project plus a controlled mailbox; no such evidence is claimed here.

Before the evidence tools are accepted, the standalone transport script must enforce that `SUPABASE_TEST_MAILPIT_URL` is loopback, matching the browser test's fail-closed check. The Supabase mutation target is already constrained by `assertLocalStack()`, so this is a transport-target correctness gap rather than a hosted service-role mutation path. Because Playwright records a trace on first retry and CI uploads the report, the browser proof should also prevent a consumed one-time verification URL from being retained in an uploaded trace, or explicitly demonstrate that the generated report contains no such URL.

### Availability, recovery, and operational limits

The demo login probe and release-window error-log inspection are useful deployability observations, but no uptime, error-rate, MTTR, retention, or alert threshold is approved. They remain **CONCERNS**, not availability PASS evidence. The current demo backup inventory is empty and point-in-time recovery is disabled. The local logical restore rehearsal has no passing result and deliberately omits platform-owner/ACL equivalence. Its revised tool now requests `supabase_migrations` schema and data and refuses to pass unless that metadata is present and matches, but that revision has not yet produced a successful scoped restore. It therefore supplies neither a production recovery proof nor an RPO/RTO claim. A safe passing local data rehearsal may inform later recovery design, but production recovery remains open until backup policy, hosted recovery method, RPO, and RTO are approved and verified.

### Current gate-ready YAML

```yaml
nfr_assessment:
  date: '2026-09-14'
  epic: '11'
  assessed_revision: '5cc08d2b15b161e4742ddddc3283be4a3c03a059 plus uncommitted focused evidence tools'
  mode: advisory
  overall_status: 'FAIL'
  overall_risk: 'HIGH'
  domains:
    security: 'PASS'
    performance: 'CONCERNS'
    reliability: 'FAIL'
    maintainability: 'CONCERNS'
  critical_issues: 0
  high_priority_issues: 1
  closed_release_blocker: 'Authenticated direct-RPC invitation identity binding bypass'
  advisory_open_issue: 'Real Auth emailed-link callback drops the implicit-flow session fragment and redirects to login'
  measured_evidence:
    final_main_ci: '1751 unit / 0 skipped; 1023 required integration/RLS / 0 skipped; 136 browser passed / 4 skipped'
    r1108_dataset: 'Tenant A 120 active; Tenant B 24 active; 1377 other membership rows observed by plan filter'
    r1108_admin_read_p95_ms: 45.72
    r1108_effective_permissions_p95_ms: 2.58
    r1108_authenticated_requests_per_iteration: 3
    r1109_local_transport: 'invite and recovery received; Auth verification redirected to configured callback'
  proposed_not_approved_limits:
    r1108_admin_read_p95_ms: 250
    r1108_effective_permissions_p95_ms: 25
    r1108_authenticated_requests_per_iteration: 3
    r1108_dataset: 'Tenant A 120 active; Tenant B 24 active'
  open_evidence:
    - 'Focused callback repair plus real mailed-link browser proof of session persistence and invitation/recovery destination'
    - 'Reset-delivery retry follow-up result'
    - 'External SMTP delivery only if an approved non-demo environment is provided'
    - 'Availability/error/MTTR targets, monitoring retention, and alert policy'
    - 'Passing recovery rehearsal plus approved hosted backup policy, RPO, and RTO'
    - 'Owner decision on quantitative coverage and duplication requirements'
    - 'Clock fixture, support-file size, and Roles readiness maintenance items'
  next_action: 'Correct the focused evidence-tool gaps, attach the pending callback/reset/recovery results, obtain owner decisions, then reassess remaining CONCERNS.'
```
