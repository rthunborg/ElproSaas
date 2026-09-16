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

The 2026-09-11 **FAIL / HIGH** result above remains the historical assessment of the vulnerable revision. The approved merge sequence landed as PR [#57](https://github.com/rthunborg/ElproSaas/pull/57), PR [#58](https://github.com/rthunborg/ElproSaas/pull/58), and PR [#55](https://github.com/rthunborg/ElproSaas/pull/55). Epic merge checkpoint `5cc08d2b15b161e4742ddddc3283be4a3c03a059` passed [post-merge CI run 34839174668](https://github.com/rthunborg/ElproSaas/actions/runs/34839174668): 1,751 unit tests with zero skips, 101 required integration/RLS files / 1,023 tests passed / zero skips, and 136 browser tests passed with four explicit skips. The three approved migrations were applied to the demo project and the deployed invitation function was inspected against the merged corrective definition. The authenticated direct-RPC identity-binding release blocker is therefore **closed**; current security is **PASS** for that finding.

The currently released application is **CONCERNS / MEDIUM** for operational reliability evidence. PR #65 CI [34925739157](https://github.com/rthunborg/ElproSaas/actions/runs/34925739157) passed at its PR head `141d3df`: 1,780 units / zero skips, 1,028 required DB/RLS / zero skips with `SUPABASE_TEST_REQUIRED=1`, and 138 browser tests / four existing explicit skips. Post-merge main CI [34926333592](https://github.com/rthunborg/ElproSaas/actions/runs/34926333592) passed at `93d4901`. The preceding PR #64 deployment `dpl_zt1Xqkvqd9SeB5AqY4fkALNHrYPr` reached READY for `efd87fa` with the canonical alias. The authorized controlled hosted invitation proof passed: a real Google SMTP-delivered message was received, the unmodified mailed link completed hosted confirmation and the application completion page, and the invited user reached the dashboard with only the isolated test-tenant membership. Private verification confirmed active membership, assigned role, and succeeded delivery record. This proved the deployed invitation acceptance leg, not user-facing invitation initiation: setup deliberately used the authenticated backend invitation-operation path and Auth Admin API rather than the Next.js UI/Server Action. A real hosted recovery message also reached Gmail and its unmodified callback reached the password-update page. The existing required local Auth-to-Mailpit browser recovery test covers the password update and fresh sign-in; no further personal hosted exercise is needed. After the proof, pinned private-fixture cleanup ended two memberships, revoked no invitations, and deleted no Auth users. An independent tenant-scoped read verified only two ended memberships and no active or invited membership; Auth users and records were retained, with no existing demo data cleanup. Automated CI remains local-only. PR #61 closed all nine recorded test-maintenance findings. The owner has chosen risk-based regression and traceability gates for the pilot, without a blanket coverage or duplication percentage gate.

| Domain | Candidate status | Evidence and limit |
| --- | --- | --- |
| Security | **PASS** | Identity acceptance is bound to the trusted confirmed Auth user at the database boundary. Required direct-RPC mismatch and legitimate-acceptance regressions executed with zero DB skips; deployed function inspection matched the merged correction. Broader security controls retain their existing evidence and advisory limitations. |
| Performance | **CONCERNS** | The current R-1108 probe uses the approved authenticated profile: Tenant A 120 active memberships, Tenant B 24, five roles with 24 primary assignments each, 40 secondary-role members, and 160 assignments. Local p95 was **45.98/2.00 ms** for read/synthetic permissions; PR #64 CI measured **17.718454/4.241466 ms**. Both used three requests and are regression observations, not a production SLO or capacity limit. |
| Reliability | **CONCERNS** | The corrected local transport smoke preserved multiple callback markers for invite and recovery. PR #62 and #63 are merged, deployed, and covered by required CI. A controlled hosted invitation completed from Google SMTP receipt through the unmodified mailed URL, browser session, application acceptance, and isolated membership/role/delivery-record verification; a real hosted recovery callback reached the password-update page. The required local browser journey verifies password update and fresh sign-in; no further personal hosted exercise is needed. Monitoring and backup/recovery configuration and their required observation windows still lack evidence. |
| Maintainability | **PASS with operational follow-up** | PR #61 closed the nine recorded test-maintenance findings. Required CI on the released state executed 1,780 unit tests, 1,028 required database/RLS tests, and 138 browser tests with four explicit skips. The owner approved risk-based regression and traceability gates for this pilot and declined a blanket percentage threshold for coverage or duplication. |

### R-1108 evidence disposition

The baseline supplies the tenant-projection part of the test design's requested pilot-shaped observation. The initial `5cc08d2` observation (p95 45.72/2.58 ms) had only 39 secondary-role members and 159 assignments, so it is retained as historical context and is not evidence of the approved exact profile. The corrected required probe at current worktree revision `c885185` asserted the approved profile: Tenant A 120 active memberships, Tenant B 24, five roles with 24 primary assignments each, 40 secondary-role members, and 160 assignments. Across 25 measured samples after five warmups, its Admin read p95 was **45.98 ms**, synthetic bulk permissions p95 **2.00 ms**, and it used three authenticated RLS requests per measured read. The final local unit run passed **1,780 tests, zero failures, zero skips**; typechecking, focused lint, and review-order validation passed, and an independent final review found no finding. PR #65 CI [34925739157](https://github.com/rthunborg/ElproSaas/actions/runs/34925739157) passed at `141d3df`, and post-merge main CI [34926333592](https://github.com/rthunborg/ElproSaas/actions/runs/34926333592) passed at `93d4901`. This remains a local regression observation; it does not establish rendering, production capacity, or a production SLO.

### R-1106 evidence disposition

R-1106 is **closed**, independently of the Auth callback action. The owner-approved policy counts only active memberships in the resolved current tenant, once for each assigned role; invited, expired, revoked, disabled, and ended memberships are excluded, and cross-role totals may exceed unique people. Test-design IDs `11.4-UNIT-003`, `11.4-INT-004`, and `11.4-E2E-001` map to `tests/unit/server/authz/role-catalogue.test.ts:8-44`, `tests/integration/rls/role-harness.atdd.int.test.ts:162-179` with lifecycle fixtures in `tests/factories/tenants/core.ts:260-315`, `tests/integration/rls/admin-users-current-tenant-counts.rls.test.ts:25-70`, `tests/integration/rls/admin-user-detail-isolation.rls.test.ts:24-71`, `tests/integration/read-models/admin-users-current-tenant.test.ts`, and `tests/e2e/auth/admin-user-management-roles.atdd.e2e.spec.ts:48-84`. They cover active-only multi-role counts, deterministic granting-role unions, resolved-current-tenant isolation, indistinguishable missing/foreign detail results, and the Admin/non-Admin Roles journey. PR #65 CI `34925739157` at `141d3df` and post-merge main CI `34926333592` at `93d4901` executed the enrolled role-harness (5), current-tenant (1), detail-isolation (2), and read-model (1) tests plus three passing Roles E2E tests, within 1,028 required DB/RLS tests with zero skips and 138 browser tests with four explicit skips. This closure does not establish a performance or operational-reliability result.

### Approved pilot limits and operating criteria

The owner approved the following **IN** criteria on 2026-09-14. They are pilot controls, not a claim that the application has already met a production SLO.

| Area | Approved criterion | Evidence status |
| --- | --- | --- |
| Local performance regression | Tenant A: 120 active memberships; Tenant B: 24; five roles; every third measured member has an additional role. Admin read p95 ≤250 ms; synthetic bulk permissions p95 ≤25 ms; ≤3 authenticated DB/RLS requests per measured read. | Baseline is below the limits; an executable gate is tracked separately. It does not cover full-page rendering or production capacity. |
| CI execution budget | Unit ≤3 minutes; DB/RLS ≤5 minutes; browser ≤5 minutes, excluding dependency installation, build, and test-infrastructure startup. | Current run durations are evidence only until budget-gate verification completes. |
| Monitoring | 99.5% monthly availability; server-error rate <1%; checks every five minutes; alert after three consecutive failures; retain 30 days of operational history. | A bounded three-failure alert notification was received. Two scheduled runs occurred over about eight hours, so the five-minute cadence is not met; no 30-day observation or error-rate denominator exists. |
| Backup and recovery | Daily encrypted backups; retain seven daily copies; maximum loss 24 hours (RPO); recovery ≤4 hours (RTO); monthly restore check. | Approved policy; the local logical rehearsal does not prove hosted backup, Storage-object recovery, RPO, or RTO. |
| Coverage and duplication | Keep current risk-based regressions and traceability gates; no blanket percentage threshold gate for this pilot. | Decision complete; quality remains monitored through the existing focused evidence. |
| Cost | Additional operational spending may not exceed **100 SEK/month**. | Usage and configuration must be checked before enabling any billable service. |

### R-1109 evidence disposition

The first local Mailpit and browser observations remain useful historical RED evidence for the released route: Supabase generated implicit session fragments that the server callback could not read, so ordinary invite and recovery journeys reached login. The original transport helper did not safely prove nested callback-query preservation because it decoded the complete verification URL. The corrected helper decodes HTML entities only, enforces local Supabase and loopback Mailpit before mutation, and verified the actual 303 origin/path plus two fixed context fields and a unique run marker for both flows without logging URLs, tokens, or fragments.

PR #62 moves only the implicit-fragment handoff to a browser completion page. It strips the fragment from history before creating the public Supabase client, persists the explicit access/refresh pair through `setSession`, revalidates the user through `getUser`, and routes only to fixed application destinations. The server callback uses the deployment-owned application origin and fails closed when that origin is absent in production. Independent focused review found no remaining security, identity-binding, same-origin, session-persistence, or privileged-client defect. The replacement guarded Playwright run at 2026-09-14T13:16:05Z–13:16:18Z executed **2/2 passed, 0 skipped** in 12.4 seconds against the earlier candidate: the invite journey activated the exact membership for the mailed Auth user, while recovery persisted a new password and a fresh anon-client sign-in returned the same user. Tracing was disabled for the token-bearing flow. Candidate `b9d533d` adds only the reviewed CI environment requirement needed for those tests to execute in GitHub.

The complete configured local production-browser suite then ran against NFR code head `d94c593907e33c235a7bb7b6165c62a93ddc6055` with only documentation changes uncommitted. From 2026-09-14T13:39:02.620Z to 13:40:58.089Z, at the CI-equivalent port 3100 with `SUPABASE_TEST_REQUIRED=1` and `NEXT_PUBLIC_APP_URL=http://127.0.0.1:3100`, Playwright executed **142 total: 138 passed, four explicitly skipped, zero failed** in 1.9 minutes. This includes both real Auth-mail journeys and all 136 previously passing browser cases. The guarded resource stop was accepted. The ignored raw log and result JSON remain under `tmp/private/`.

Accordingly, the controlled local R-1109 transport-and-callback boundary is **PASS for the reviewed PR #62 code candidate**. The current-head full local browser result is corroborated by passing required CI, and PR #62 has merged and deployed. The required `tests/e2e/auth/auth-mail-callback.e2e.spec.ts` journey uses real local Supabase Auth and Mailpit, reaches `/password/update`, persists the new password, and verifies a fresh anonymous-client sign-in as the same user. The owner authorized a tightly scoped exception for a controlled real-mail proof against the existing demo project and Vercel deployment. That proof established Gmail receipt and the hosted recovery callback to the password-update page; no additional personal hosted password update/fresh sign-in is needed for R-1109 or action 6. Automated CI remains local-only. This document records neither credentials nor recipient details.

### Controlled hosted invitation evidence

At 2026-09-14T18:59:23Z, the approved controlled invitation proof received a real Google SMTP message in the owner-controlled mailbox. The message was found in the mailbox's spam classification; its headers showed DKIM and DMARC pass, with SPF `permerror`. The displayed sender name was not the intended product name.

The owner then inspected the existing `enhancior.se` Cloudflare DNS zone. All 13 existing records were reviewed; Google Workspace MX and DKIM records were present, while the SPF TXT record had a dead include target. The record was replaced through Cloudflare with the Google Workspace provider form `v=spf1 include:_spf.google.com ~all`, preserving the existing soft-fail policy. Cloudflare saved the change and authoritative DNS plus the 1.1.1.1 resolver returned that value. A later controlled recovery message arrived in Gmail at 2026-09-14T19:08:55Z with SPF, DKIM, and DMARC all passing. This is one delivery sample after a scoped DNS repair, not a general deliverability or provider-availability claim. Cloudflare also verified the owner Gmail destination. Free sender operations cannot be configured in the UI without an apex-MX change, so the owner has been asked to choose the existing `thunborg.se` sender on Free or paid operations; no DNS or paid-plan change was made. Sender name Kopplas is intentional future naming; no app, repository, or configuration rename is in scope.

The proof used a dedicated test administrator and isolated fake tenant. It prepared the invitation through the authenticated backend operation and Auth Admin API, then finalized the operation; it intentionally did not use the Next.js invitation UI or Server Action to initiate delivery. The recipient opened the unmodified message URL in the hosted browser. Hosted Auth confirmation reached the application completion page; accepting access displayed the success state and continuing reached the dashboard. Private checks confirmed only the expected isolated membership was active, its assigned role was present, and the delivery operation recorded success. No recipient address, identifier, token, URL, or mailbox content is retained here.

**Disposition:** the deployed invitation callback, browser-session handoff, acceptance, and membership/role activation are **PASS** for this controlled path. The real hosted recovery callback reached the password-update page. The required local Auth-mail browser journey already verifies password update and fresh sign-in, so no further personal hosted exercise is needed and the callback action remains closed.

### Availability, recovery, and operational limits

The demo login probe, bounded callback-route probes, and release-window error-log inspection are useful deployability observations. A Vercel grouped runtime-error query from 2026-09-14T15:35:12.940Z through 18:53Z returned no errors for the then-current Production deployment. It has no request denominator and is not an error-rate, availability, or 30-day monitoring result. A [post-deployment manual monitor sample](https://github.com/rthunborg/ElproSaas/actions/runs/34888737676) returned HTTP 200 in 417 ms at 2026-09-14T19:44:49.911Z. The isolated [alert artifact](https://github.com/rthunborg/ElproSaas/actions/runs/34888299778) recorded `[false, false, true]`; its subsequent owner-approved mailbox receipt establishes that bounded notification path only. GitHub cadence failed the pilot criterion: two scheduled runs occurred over about eight hours, rather than every five minutes. The approved free Cloudflare monitoring setup is in implementation and is not monitoring evidence until it runs with the stated cadence and history. Monitoring therefore remains **CONCERNS**. The backup workflow caps storage at 50 MiB and remains disabled. A private approved Workspace Drive folder was created and `BACKUP_DRIVE_FOLDER_ID` is configured as a GitHub secret; its identifier is not recorded here. A dedicated Google Cloud project has been prepared under the approved organization; billing was linked only because the UI required it, with no paid account activation or paid-resource deployment. Drive API was enabled and verified in the service-details UI on 2026-09-15. The internal OAuth app is prepared through the User Data Policy agreement step, which remains unaccepted; no OAuth client or grant exists. A project-only monthly 100 SEK gross-cost (credits excluded) budget is saved with 50/80/100% actual-cost email alerts to the approved billing/project recipients; current gross cost is 0 SEK and the existing account-wide budget is unchanged. It is alert-only, not a hard cap; [eligible-service coverage](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps) excludes Drive. An owner-only local GPG recovery key exists outside the repository; `BACKUP_GPG_PASSPHRASE` was successfully set at 2026-09-15T09:33:24Z, and a fresh GitHub secret listing confirms four configured backup secrets: `BACKUP_DRIVE_FOLDER_ID`, `BACKUP_GPG_PASSPHRASE`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Independent owner recovery-key escrow and database-password input remain pending. The database URL is also absent. It now has stable pre/post Storage inventory and restore-shaped checksum checks, with an exact direct/shared-session pooler target and rejection of query overrides. These are configuration and local-control facts, not alert-delivery, backup, or hosted restore evidence. A monthly Codex heartbeat (`elpro-monthly-recovery-check`) is configured for the first day of each month at 09:00 local time to check recovery evidence, backup freshness, monitoring gaps, and the 100 SEK/month cap; no heartbeat execution is yet evidence. It does not establish a completed restore, history window, or spending result. The approved monitoring and recovery criteria are recorded above, but no 30-day availability/error observation, compliant scheduled-monitor evidence, hosted backup inventory, or hosted restore exercise has completed. The current demo backup inventory was previously empty and point-in-time recovery disabled; do not infer a changed provider posture until it is inspected. The local logical restore rehearsal remains a scoped PASS only. It supplies neither platform-role bootstrap nor Storage object-byte recovery, a hosted backup policy, or an RPO/RTO claim. Production recovery remains **CONCERNS** until the approved policy is configured and verified within the 100 SEK/month cap.

The owner-approved mailbox received the GitHub failure notification for the isolated three-failure simulation at 2026-09-14T19:40:46Z. This closes the alert-delivery checkpoint for that bounded simulation; it does not establish scheduled-monitor history, availability, an error-rate denominator, or alert performance. The repository now has server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets for the exact demo project. A private approved Workspace Drive folder exists and `BACKUP_DRIVE_FOLDER_ID` is configured as a GitHub secret, without recording its identifier. The owner-only local GPG recovery key remains outside the repository; `BACKUP_GPG_PASSPHRASE` is now set and a fresh secret listing confirms the four configured backup secrets. Independent owner escrow is pending. Database URL also remains absent. `PILOT_BACKUP_ENABLED` remains false and no backup has run.

### Current gate-ready YAML

```yaml
nfr_assessment:
  date: '2026-09-14'
  epic: '11'
  assessed_revision: 'main 93d4901; PR #62 and PR #63 merged and deployed'
  mode: advisory
  overall_status: 'CONCERNS'
  overall_risk: 'MEDIUM'
  released_application_status: 'CONCERNS/MEDIUM: operational monitoring and backup/recovery evidence remain open'
  domains:
    security: 'PASS'
    performance: 'CONCERNS'
    reliability: 'CONCERNS'
    maintainability: 'CONCERNS'
  critical_issues: 0
  high_priority_issues: 0
  closed_release_blocker: 'Authenticated direct-RPC invitation identity binding bypass'
  candidate_closed_issue: 'Local Auth emailed-link callback persists the implicit-flow session and completes invite/recovery journeys'
  advisory_open_issue: 'Implementation and observation of approved monitoring and backup/recovery criteria remain'
  measured_evidence:
    pr65_ci: 'https://github.com/rthunborg/ElproSaas/actions/runs/34925739157 — passed at PR #65 head 141d3df: 1780 unit / 0 skipped; 1028 required integration/RLS / 0 skipped with SUPABASE_TEST_REQUIRED=1; 138 browser passed / 4 explicit skips / 0 failed'
    post_merge_pr65_ci: 'https://github.com/rthunborg/ElproSaas/actions/runs/34926333592 — passed on main 93d4901'
    test_maintenance_closure: '9/9 recorded rows closed; independent focused review 100/100'
    r1108_dataset: 'Tenant A 120 active; Tenant B 24 active; five roles × 24 primary assignments; 40 secondary-role members; 160 assignments'
    r1108_admin_read_p95_ms: 45.98
    r1108_effective_permissions_p95_ms: 2.00
    r1108_authenticated_requests_per_iteration: 3
    r1109_local_transport: 'invite and recovery received; Auth verification redirected to configured callback'
    r1109_local_browser: '2 passed / 0 skipped; invitation activated matching membership; recovery persisted password and fresh sign-in'
    callback_candidate_checks: '3 unit passed; typecheck/build/focused lint passed; review order 14 references/0 errors; independent focused review clear'
    prior_pr62_ci: 'https://github.com/rthunborg/ElproSaas/actions/runs/34848411280 — verify 1756 unit / 0 skipped; DB 1028 / 0 skipped; browser 136 passed / 4 skipped / 2 failed at the missing-required-env guard'
    historical_pr62_ci: 'https://github.com/rthunborg/ElproSaas/actions/runs/34849927884 — verify passed 1756 unit / 0 skipped; db and e2e received no runner and executed no steps because of the then billing/payment/spending-limit condition'
    historical_pr63_ci: 'https://github.com/rthunborg/ElproSaas/actions/runs/34849940369 — verify received no runner because of the then billing/payment/spending-limit condition; dependent db/e2e job-skips are not executed test coverage'
    current_pr62_ci: 'https://github.com/rthunborg/ElproSaas/actions/runs/34851125570 — head 2fb018a passed: 1756 unit / 0 skipped; 1028 required DB/RLS / 0 skipped; 138 browser passed / 4 explicit skips / 0 failed'
    post_merge_pr62_ci: 'https://github.com/rthunborg/ElproSaas/actions/runs/34860862774 — post-merge main CI succeeded across all jobs; detailed counts intentionally not duplicated here'
    pr62_merge_and_deploy: 'a264b54d83471432bf867f403cb4ef1f3d23a44a merged 2026-09-14T15:14:29Z; Production deployment dpl_B5hVF5UajFn9ynE5hCLVk7t3MRpU READY for a264b54 at 2026-09-14T15:15:09.968Z, canonical alias confirmed; bounded route probes: /login 200, /auth/invite/confirm 307 to canonical /auth/invite/complete, completion 200'
    current_pr63_ci: 'https://github.com/rthunborg/ElproSaas/actions/runs/34862069987 — merged head 23b379a passed: 1756 unit / 0 skipped; 1028 required integration/RLS / 0 skipped; 138 browser passed / 4 explicit skips / 0 failed; post-merge main 34863085288 also passed'
    hosted_auth_configuration: '2026-09-14 inspection recorded canonical Site URL, one callback redirect URL, stock {{ .ConfirmationURL }} templates, confirm email on, anonymous sign-ins/manual linking off. Sender name Kopplas is intentional for its future product naming; no app, repository, or configuration rename is in scope.'
    hosted_invitation: '2026-09-14T18:59:23Z controlled isolated-tenant proof: Google SMTP receipt; unmodified mailed URL completed hosted confirmation, browser handoff, application acceptance, and dashboard continuation; private active-membership/role/delivery verification passed. Initiation used authenticated backend operation plus Auth Admin API, not UI/Server Action. A real recovery message later reached Gmail and its unmodified hosted callback reached password update.'
    release_window_runtime_errors: 'Vercel grouped runtime-error query from 2026-09-14T15:35:12.940Z through 18:53Z returned no errors for current Production; no request denominator, so not error-rate, availability, retention, or alert evidence'
    local_dr_rehearsal: '2026-09-14T15:19:22.1563399Z–15:19:45.3195357Z scoped local logical restore passed at 8c6f4e3 plus uncommitted tool fix: 29 migrations, 10 tenants, 1384 memberships, 270 membership roles, 1140 active memberships, equal membership digest, zero remaining UUID scratch databases; not hosted/production recovery evidence'
    current_head_local_browser: '2026-09-14T13:39:02.620Z–13:40:58.089Z; CI-equivalent port 3100; SUPABASE_TEST_REQUIRED=1; 142 total / 138 passed / 4 explicit skips / 0 failed; both real Auth-mail journeys passed'
  approved_pilot_limits:
    r1108_admin_read_p95_ms: 250
    r1108_effective_permissions_p95_ms: 25
    r1108_authenticated_requests_per_iteration: 3
    r1108_dataset: 'Tenant A 120 active; Tenant B 24 active'
    ci_unit_budget_minutes: 3
    ci_database_budget_minutes: 5
    ci_browser_budget_minutes: 5
    monitoring: '99.5% monthly availability; <1% server-error rate; five-minute checks; alert after three failures; 30-day history'
    backup_recovery: 'daily encrypted backup; seven daily copies; RPO 24h; RTO 4h; monthly restore check'
    additional_monthly_spend_sek: 100
    coverage_duplication: 'risk-based regression and traceability gates; no blanket percentage threshold'
  open_evidence:
    - 'Compliant five-minute scheduled-monitor cadence, 30-day operational history, and error-rate denominator'
    - 'Hosted backup configuration that includes Storage bytes, plus a safe restore exercise and RPO/RTO evidence'
    - 'Budget check showing the selected operational configuration remains within 100 SEK/month'
  next_action: 'Configure and verify the approved monitoring and backup/recovery controls before reassessing CONCERNS.'
```

## 2026-09-15 operational evidence update

**Decision.** The historical **FAIL / HIGH** and **Rejected** records remain historical evidence; current NFR status remains **CONCERNS**. PR #67 merged as `6396894`; CI [34974280415](https://github.com/rthunborg/ElproSaas/actions/runs/34974280415), post-merge main CI [34975165329](https://github.com/rthunborg/ElproSaas/actions/runs/34975165329), and Production deployment `dpl_6SY3bJeY7syS4LKG3HqocmJm1th4` provide the current release trail.

**Backup evidence.** All eight backup secrets are configured and owner recovery-key escrow is confirmed. Hosted encrypted backup run [34975181883](https://github.com/rthunborg/ElproSaas/actions/runs/34975181883) captured, encrypted, and uploaded 298,442 encrypted bytes to the private approved Drive folder. A separate local verification downloaded, decrypted, and checksum-verified the uploaded archive. That structural verification is not complete recovery evidence: the actual Auth and Storage managed migration-ledger data were absent; only the table definitions existed. Its aggregate report listed two tenants, seven memberships, seven Auth users, 31 migration records, and one Storage object totaling 4,228 bytes; it did not establish migration-ledger data recovery. This closes neither isolated restore nor RPO/RTO evidence. A new guard-owned local restore launch timed out and then returned `RESOURCE_UNCERTAIN`; stop requests were submitted; no scoped container was observed and no restore executed. PR #68 head is `36cf8f32dbe1100b88a9651a6cd7c3ca7c074b46`. CI [35012539387](https://github.com/rthunborg/ElproSaas/actions/runs/35012539387) passed 1,797 units with zero skips, 1,028 integration/RLS tests with one explicit skip for the dedicated recovery test, and 138 browser tests with four explicit skips. Its dedicated recovery job executed the recovery test (one passed, zero skipped): it restored the synthetic database and ledgers, verified physical Storage GET bytes and metadata, took full database-row snapshots, and confirmed ordinary x-upserts are rejected without mutation. The storage information route is database-backed; this proof does not treat it as a physical-byte assertion. The repair addresses three valid review findings: immutable object upsert, stale backup acceptance, and selection before ownership filtering. The claimed object-info metadata-shape defect was false for the pinned Storage version. The 2026-09-15 backup is still incomplete because the pinned CLI excluded Auth and Storage managed migration-ledger data even with schema flags. PR #68 now captures them through native pinned-client exports plus aggregate JSON, requires positive ledger counts and equality before the restored runtime starts, and fails old archives closed; a fresh main backup is required after merge. This synthetic proof does not establish recovery of the private owner archive or operational RPO/RTO. PR #69 CI [34981672486](https://github.com/rthunborg/ElproSaas/actions/runs/34981672486) passed for documentation only and is not operational proof. Main remains `6396894`; hosted recovery and daily enablement remain false pending a user merge or policy change.

**Availability evidence.** Cloudflare Production deployed worker version `bcf49ba2-63e9-4fce-bc29-5e4ce4607e12` with a five-minute Cron. The 2026-09-15 monitoring UI observation still shows zero Worker/DO invocations and zero bytes despite the configured five-minute schedule; no Gmail delivery has been observed and monitor controls remain open. The controlled delivery-rehearsal Cron was disabled through an official Wrangler-trigger deploy at about 14:24 UTC; its worker/DO data were preserved and the UI subsequently confirmed that no rehearsal Cron triggers remain. Independently reviewed Vercel `allProductionEdgeRequests` data from 2026-09-14T13:00Z through 2026-09-15T13:00Z recorded 176 requests and zero server 5xx responses: an observed server-5xx rate of 0/176 (0%) for that bounded Vercel measurement window. It does not prove the approved 30-day 99.5% availability SLO, a full-month or SLO error-rate result, monitoring retention, or alert delivery.

**2026-09-16 correction:** The preceding PR #68 record is superseded by spec-only head `bb910b16c8fd26c2e6205e14f840a2f400c67c8a`; the unchanged runtime path was tested at `36cf8f32dbe1100b88a9651a6cd7c3ca7c074b46`. CI [35012539387](https://github.com/rthunborg/ElproSaas/actions/runs/35012539387) passed 1,797 units / zero skips, 1,028 integration/RLS tests / one explicit special-test skip, and 138 browser tests / four explicit skips. The dedicated recovery job executed the special test: one passed / zero skipped. It restored synthetic database and ledger state, verified physical Storage GET bytes and metadata, retained full database-row snapshots, and rejected ordinary x-upserts without mutation. The three valid review findings were immutable-object upsert, stale-backup acceptance, and choosing a backup before ownership filtering. The metadata-shape finding was false for the pinned Storage version; its object-info route is database-backed. This synthetic proof does not establish recovery of the private owner archive or operational RPO/RTO. A fresh main backup and actual isolated archive restore remain required.

Post-merge main CI `34975165329` executed 1,782 units / zero skipped, 101 required integration/RLS files / 1,028 tests / zero skipped with `SUPABASE_TEST_REQUIRED=1`, and 138 browser tests / four explicit skips.

## 2026-09-16 operational recovery verification — bounded alert rehearsal verified

**Alert rehearsal:** The separate rehearsal recorded forced failures at 12:20:00Z, 12:25:00Z, and 12:30:00Z. Its isolated Durable Object aggregate recorded three samples, three failures, one alert, one delivered notification, and zero failed delivery attempts; the first two failures produced no alert. The owner-approved inbox received the alert at 12:30:06Z for the 12:30:00Z synthetic incident, with SPF, DKIM, and DMARC pass. No customer data was included. The rehearsal Cron was removed and saved at about 12:31:15Z; the UI confirmed no Cron or unsaved state, while retaining rehearsal Worker/DO data. Production was untouched. `PILOT_BACKUP_ENABLED` was set and read back true at 12:31:31Z. The daily 01:23 UTC schedule begins 2026-09-17; the monthly heartbeat is active for the first day at 09:00 local. Neither has execution evidence yet.

**Post-merge CI:** [35093489403](https://github.com/rthunborg/ElproSaas/actions/runs/35093489403) passed at `cbc4753`: 1,797 units / zero skipped (26.90 s); 101 database files / 1,028 passed / one explicit dedicated-recovery skip with `SUPABASE_TEST_REQUIRED=1` (93.11 s); dedicated recovery one passed / zero skipped; and 138 browser passed / four explicit skips (125.27 s). This is post-merge regression evidence, not alert proof.

After PRs #68 and #69 merged to `main` as `cbc4753`, backup run [35093574844](https://github.com/rthunborg/ElproSaas/actions/runs/35093574844) succeeded from 12:02:32Z to 12:04:56Z, uploaded 303,872 encrypted bytes (two retained, none deleted; the older archive fails closed because it lacks native ledgers), and included explicit Auth and Storage migration ledgers. Actual private-archive rehearsal [35093851115](https://github.com/rthunborg/ElproSaas/actions/runs/35093851115) selected the backup at age 57,989 ms and restored/verified two tenants, seven memberships, seven Auth users, 31 migrations, and one 4,228-byte Storage object. Checksums, the full Storage row, and ledgers matched. Auth/RLS REST verification completed at 12:07:06.235Z, 97.235 seconds after workflow dispatch (111 seconds including cleanup), within the approved RPO/RTO. Independent review cleared this scoped evidence; it does not prove provider, project, DNS, Vercel-session, or full disaster recovery. The production aggregate covers 176 samples from 2026-09-15T21:35:49Z through 2026-09-16T12:05:44Z: 176 HTTP 200 and zero failures, transport errors, missed slots, or alerts — about 14.5 hours, not a 30-day SLO. The bounded alert rehearsal is verified above. `PILOT_BACKUP_ENABLED` is true; daily execution, accumulation of seven valid daily copies, and monthly repetition remain obligations. NFR remains **CONCERNS**.
