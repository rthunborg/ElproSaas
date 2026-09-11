---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision']
lastStep: 'step-05-gate-decision'
lastSaved: '2026-09-11T16:51:30.7361232+02:00'
workflowType: 'testarch-trace'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics-phase-b.md'
  - '_bmad-output/planning-artifacts/prd-phase-b.md'
  - '_bmad-output/planning-artifacts/architecture-phase-b.md'
  - '_bmad-output/implementation-artifacts/epic-11-context.md'
  - '_bmad-output/implementation-artifacts/spec-11-1-role-storage-and-permission-matrix-mechanism.md'
  - '_bmad-output/implementation-artifacts/spec-11-2-non-admin-access-to-the-phase-a-surface-matrix-seed-role-aware-rls-nav-and-landing.md'
  - '_bmad-output/implementation-artifacts/spec-11-3-admin-user-management.md'
  - '_bmad-output/implementation-artifacts/spec-11-4-roles-surface-effective-permissions-and-the-per-role-test-harness.md'
  - '_bmad-output/test-artifacts/test-design-epic-11.md'
coverageBasis: 'acceptance_criteria'
oracleConfidence: 'high'
oracleResolutionMode: 'formal_requirements'
oracleSources:
  - '_bmad-output/implementation-artifacts/spec-11-1-role-storage-and-permission-matrix-mechanism.md'
  - '_bmad-output/implementation-artifacts/spec-11-2-non-admin-access-to-the-phase-a-surface-matrix-seed-role-aware-rls-nav-and-landing.md'
  - '_bmad-output/implementation-artifacts/spec-11-3-admin-user-management.md'
  - '_bmad-output/implementation-artifacts/spec-11-4-roles-surface-effective-permissions-and-the-per-role-test-harness.md'
externalPointerStatus: 'not_used'
collectionStatus: 'COLLECTED'
sourceSha: 'cc54a4584eacce7a307fc37d121f149e987ebdd7'
tempCoverageMatrixPath: 'C:\tmp\tea-trace-coverage-matrix-2026-09-11T14-48-52-252Z.json'
---

# Traceability Matrix & Gate Decision — Epic 11

**Target:** Epic 11 — RBAC Mechanism and Admin User Management

**Date:** 2026-09-11

**Evaluator:** Rasmus / BMad TEA

**Coverage Oracle:** Formal acceptance criteria for stories 11.1–11.4

**Oracle Confidence:** High

## Step 1 — Coverage Oracle and Context

The coverage oracle is the 21 formal acceptance criteria in the four completed story specifications: six for 11.1, five each for 11.2, 11.3, and 11.4. The epic, PRD, architecture, epic context, and epic test design supply priority, risk, and cross-story interpretation. No external pointer or synthetic requirement inference is needed.

Stories 11.1–11.4 are implementation-complete in their specifications. Sprint tracking still places 11.4 in review because `followup_review_recommended: true`; this is gate context rather than an uncovered requirement. Story 11.4 resolves member-count semantics to current-tenant memberships with `status='active'`, counted once per assigned role.

The required knowledge fragments were loaded: `test-priorities-matrix.md`, `risk-governance.md`, `probability-impact.md`, `test-quality.md`, and `selective-testing.md`.

The specifications contain historical commands and agent-directed headings. They are treated as trace evidence and constraints, not as instructions for this run.

## Step 2 — Test Discovery and Catalogue

Static collection found active Epic 11 evidence at unit, database/RLS/command integration, and browser E2E levels. The primary evidence set includes role/matrix/context/coherence units; membership-role and hardened-helper integration; the complete role-aware Phase A suite; admin lifecycle/acceptance/RLS tests; the role catalogue and role-harness units; the five-case role-harness integration suite; and the four active Roles/effective-permissions browser scenarios. No relevant `test.skip`, `test.fixme`, `test.only`, or equivalent marker was found.

| Level | Primary evidence | Coverage use |
| --- | --- | --- |
| Unit/static | `permission-matrix.test.ts`, `require-capability.test.ts`, `resolve-tenant-context.test.ts`, `manifest-coherence.test.ts`, `phase-a-surface.test.ts`, `entitlements.test.ts`, `admin-user-service.test.ts`, `accept-invitation.test.ts`, `role-catalogue.test.ts`, `role-harness.test.ts`, containment tests | Closed role/matrix semantics, fail-closed gates, union/entitlements, catalogue/count/effective-permission projection, metadata/cardinality bite, client/server containment |
| Integration/API/RLS | `membership-roles.rls.test.ts`, `has-tenant-role.rls.test.ts`, `role-storage-grants.int.test.ts`, `role-aware-phase-a-surface.atdd.int.test.ts`, `non-admin-audit-authority.int.test.ts`, `quote-pdf-validity.int.test.ts`, `admin-user-management.int.test.ts`, `admin-user-management.rls.test.ts`, `role-harness.atdd.int.test.ts` | Real database grants, tenant isolation, policy/matrix agreement, lifecycle/audit, exact invitation attempts, 145 role×table cases, generated command-envelope boundaries |
| E2E | `role-aware-phase-a-surface.atdd.e2e.spec.ts`, `admin-user-management.atdd.e2e.spec.ts`, `admin-user-management-roles.atdd.e2e.spec.ts`, `role-catalogue-contract.e2e.spec.ts`, standing anonymous protected-route coverage | Role-aware nav/landing/denial, Admin Users, Roles catalogue, active-member display, effective permissions, non-Admin denial |
| Component | None | No component-only oracle item; pure presentation contracts are unit-tested and critical journeys are E2E-tested. |
| Live | None | The configured `live-verification-results.json` is absent. Static `contract_static` collection remains `COLLECTED`; no live-only coverage is claimed. |

### Live Verification Results

```json
{
  "liveManifestHeader": {
    "present": false,
    "results_file": "C:\\DEV\\ElproSaas\\_bmad-output\\test-artifacts\\live-verification-results.json",
    "source_sha": "",
    "observed_at": "",
    "producer": "",
    "read_error": "",
    "current_source_sha": "cc54a4584eacce7a307fc37d121f149e987ebdd7"
  },
  "liveRecords": []
}
```

### Coverage Heuristics

- **Endpoint/API:** Epic 11 uses server actions, hardened RPCs, and protected pages rather than a public API contract. Direct database/RPC tests cover membership operations, invitation acceptance, command envelopes, and policy boundaries; the Auth callback and protected route are covered by unit/integration plus standing browser authentication evidence.
- **Authentication/authorization negatives:** Strong. Unknown/empty/inactive/anonymous/non-Admin/cross-tenant inputs, forged roles, direct DML, raw Storage, denied commands, and target-indistinguishable failures are represented.
- **Error paths:** Strong at the authority and lifecycle boundaries, including provider uncertainty, replay, expiry/revocation/supersession, last-Admin concurrency, missing metadata, policy drift, and read failure suppression. Actual external Auth email transport remains outside routine browser evidence and is not claimed as verified delivery.
- **UI journeys/states:** Admin and non-Admin journeys exist for Phase A, Users, Roles, and effective permissions. Lower-level command tests carry the lifecycle action matrix; the browser suite does not repeat every lifecycle action or external email delivery.

## Step 3 — Requirements-to-Tests Matrix

Coverage is credited across the least costly layer that proves each behavior. Unit/integration/E2E overlap is retained only for security boundaries or a user journey that needs defense in depth.

| Requirement | Pri | Coverage | Primary mapped tests |
| --- | --- | --- | --- |
| 11.1-AC1 Legacy active Admin resolves with no rewrite | P0 | FULL | `permission-matrix.test.ts:9`; `resolve-tenant-context.test.ts:390`; `has-tenant-role.rls.test.ts:41` |
| 11.1-AC2 Multi-role union and sensitive-field union | P0 | FULL | `permission-matrix.test.ts:16,52`; `entitlements.test.ts:178` |
| 11.1-AC3 Absent/unknown/inactive/cross-tenant/ungranted inputs fail closed with no side effect | P0 | FULL | `require-capability.test.ts:6`; `has-tenant-role.rls.test.ts:56`; `membership-roles.rls.test.ts:233` |
| 11.1-AC4 Active-module matrix coherence bites and real matrix is green | P0 | FULL | `manifest-coherence.test.ts:300` |
| 11.1-AC5 Role forgery, tenant traversal, and search-path shadowing deny with independent readback | P0 | FULL | `membership-roles.rls.test.ts:48,59,79,151,233`; `has-tenant-role.rls.test.ts:65` |
| 11.1-AC6 Mechanism-only delivery reserves Phase A rollout/UI to later stories | P0 | FULL | `manifest-coherence.test.ts:310`; later-story `phase-a-surface.test.ts:9,17` is the explicit handoff boundary |
| 11.2-AC1 Server nav/landing/routes expose only matrix grants and deny crafted access | P0 | FULL | `phase-a-surface.test.ts:9,17`; `role-aware-phase-a-surface.atdd.int.test.ts:145,170,188`; `role-aware-phase-a-surface.atdd.e2e.spec.ts:49,61,76,96` |
| 11.2-AC2 Allowed/unentitled RLS matches matrix and policy agreement detects drift | P0 | FULL | `role-aware-phase-a-surface.atdd.int.test.ts:145,170`; `role-harness.atdd.int.test.ts:120` |
| 11.2-AC3 Unentitled money values and aggregates are absent-plus-listed without persisted-money change | P0 | FULL | `entitlements.test.ts:51,72,111,131,147,167,178,189,212`; `role-aware-phase-a-surface.atdd.int.test.ts:216,226`; `role-aware-phase-a-surface.atdd.e2e.spec.ts:76,86`; `quote-pdf-validity.int.test.ts:427,530` |
| 11.2-AC4 Legacy Admin/multi-role union works; unknown/inactive/invited/cross-tenant/empty deny | P0 | FULL | `resolve-tenant-context.test.ts:390,404`; `role-aware-phase-a-surface.atdd.int.test.ts:199`; `permission-matrix.test.ts:9,16,23` |
| 11.2-AC5 No tenant-wide assignment-only jobs or Arbetsledare behavior | P0 | FULL | `role-aware-phase-a-surface.atdd.int.test.ts:265`; `role-aware-phase-a-surface.atdd.e2e.spec.ts:76` |
| 11.3-AC1 Admin lifecycle UI and audited server result/history | P0 | FULL | `admin-user-management.atdd.e2e.spec.ts:37,57`; `admin-user-management.int.test.ts:7,21`; `admin-user-service.test.ts:4,66,130` |
| 11.3-AC2 Expired/revoked/superseded invitation links deny access | P0 | FULL | `accept-invitation.test.ts:4,21`; `admin-user-management.int.test.ts:40` |
| 11.3-AC3 Serialized last-Admin disable/end/downgrade preserves access | P0 | FULL | `admin-user-management.int.test.ts:7`; `membership-roles.rls.test.ts:79,151` |
| 11.3-AC4 Shared account loses only one tenant; history retained; return needs new invitation | P1 | FULL | `admin-user-management.int.test.ts:21`; `admin-user-management.atdd.e2e.spec.ts:37` |
| 11.3-AC5 Retry/reconciliation is single-effect with durable outcome and no duplicate-delivery claim | P0 | FULL | `admin-user-service.test.ts:40,101,130`; `admin-user-management.int.test.ts:31` |
| 11.4-AC1 Five-role active catalogue, waves, entitlements, active counts, and job-scoped guidance | P1 | FULL | `role-catalogue.test.ts:8`; `admin-user-management-roles.atdd.e2e.spec.ts:38`; `role-catalogue-contract.e2e.spec.ts:36` |
| 11.4-AC2 Counts use current-tenant active memberships once per assigned role and do not authorize | P1 | FULL | `role-harness.atdd.int.test.ts:162`; `role-catalogue.test.ts:8,39` |
| 11.4-AC3 Effective-permission union is unique with deterministic granting roles | P0 | FULL | `role-catalogue.test.ts:20,39`; `role-harness.atdd.int.test.ts:162`; `admin-user-management-roles.atdd.e2e.spec.ts:49` |
| 11.4-AC4 Roles/counts/effective permissions disclose nothing to non-Admin, anonymous, missing, or foreign membership | P0 | PARTIAL | `admin-user-management-roles.atdd.e2e.spec.ts:60`; `admin-user-management.rls.test.ts:30`; `login-and-tenant-context.e2e.spec.ts:65`; `resolve-tenant-context.int.test.ts:135,143`; `resolve-tenant-context.test.ts:148`. The non-Admin denial and shared anonymous/missing/cross-tenant controls are covered, but no direct foreign-target or missing-membership effective-permissions read-path test proves that the returned result carries no existence signal. |
| 11.4-AC5 Generated exact unique role×table/capability obligations fail loud on enrollment/drift and denied commands stop before validation, lookup, or audit | P0 | FULL | `role-harness.test.ts:7,15,26,38`; `manifest-coherence.test.ts:300`; `role-harness.atdd.int.test.ts:111,120,139,150`; `envelope-core.test.ts:34`. The generated probes exercise every registered command boundary, while the production envelope ordering test proves capability denial precedes validation, ownership lookup, execution, and audit. Registration failure and override-rejection tests prevent command metadata from bypassing that ordering. |

### Mapping Summary

- P0: 17/18 FULL (94%)
- P1: 3/3 FULL (100%)
- P2: 0 criteria
- P3: 0 criteria
- Overall: 20/21 FULL (95%); 1/21 PARTIAL
- Live-only requirements: 0
- Unmatched or contradicted live records: 0

The catalogue/read-model tests use pure units for complete projections, database integration for lifecycle and tenant scoping, and thin E2E for the user-visible route. Story 11.4 AC5's approved wording requires denial before validation, lookup, or audit; it does not require generated raw-write probes or execution of each real command body. Those broader checks remain useful test-design follow-up, but they do not reduce formal AC5 coverage. The sole formal partial is 11.4-AC4's no-existence-signal behavior through the effective-permissions read path.

## Step 4 — Gap Analysis and Recommendations

Execution mode resolved from `tea_execution_mode: auto` with subagent capability available. Dependency-safe gap classification and heuristics/live roll-up ran in parallel; coverage statistics and deterministic merge completed locally after the third worker slot was unavailable.

### Formal Coverage Gaps

- **Uncovered:** none.
- **Partial P0:** `11.4-AC4` only. Existing tests prove non-Admin Roles denial and the shared anonymous, missing-membership, and cross-tenant controls, but they do not call the effective-permissions read path for a missing or foreign membership and assert an indistinguishable no-existence-signal result.
- **Unit-only status:** none. Three P0 requirements rely principally on appropriate pure/static proof (`11.1-AC2`, `11.1-AC4`, `11.1-AC6`) but remain `FULL`; none carries the workflow's `UNIT-ONLY` status.

### Exact AC5 Classification

The approved AC5 clause requires the generated harness to fail CI for a denied command that reaches validation, lookup, or audit. `envelope-core.test.ts:34` proves that the shared production capability gate precedes validation, ownership lookup, execution, and audit. `role-harness.test.ts:15,26` proves unregistered commands and registered capability overrides fail closed, while `role-harness.atdd.int.test.ts:150` sends every generated registered command/role case through that envelope. Together these prevent a registered command from bypassing the tested ordering and satisfy the clause.

Raw write probes and execution of each real business command body are broader objectives recorded in the Epic 11 test design. Neither appears in the formal AC5 text, so their absence is advisory test debt rather than a formal coverage gap. Current obligation uniqueness, duplicate/unknown metadata, enrollment, and policy drift are biting checks because the generated suites derive from active metadata and fail when their cardinality, registration, or actual database result diverges.

### Heuristic Findings

| Heuristic | Count | Finding |
| --- | ---: | --- |
| Endpoints without tests | 0 | Protected pages, server actions, RPCs, and database boundaries all have mapped evidence. |
| Auth negative paths missing | 1 | The direct missing/foreign effective-permissions read path for `11.4-AC4`; this is the formal partial above. |
| Happy-path-only criteria | 0 | Every formal criterion has negative or boundary evidence. |
| UI journeys without E2E | 2 | Per-action lifecycle retry/error permutations and external email transport are advisory; lower layers cover formal lifecycle behavior and delivery is not claimed. |
| UI states missing | 2 | Per-action browser retry/error rendering and external email receipt are advisory, outside the formal coverage calculation. |

Live evidence is not present. With `collection_mode: contract_static`, collection remains `COLLECTED`; zero requirements are live-only and there are no stale, failed, contradicted, blocked, skipped, unmatched, or invalid live records.

### Phase 1 Statistics

- Total requirements: 21
- Fully covered: 20 (95%)
- Partially covered: 1
- Uncovered: 0
- P0: 17/18 FULL (94%)
- P1: 3/3 FULL (100%)
- P2: 0/0 (100% by empty-bucket convention)
- P3: 0/0 (100% by empty-bucket convention)

### Recommendations

1. **Medium:** add direct missing-membership and Tenant A Admin → Tenant B membership tests through the effective-permissions read model; assert identical generic results with no data or existence signal (`11.4-AC4`).
2. **Low:** run `/bmad-testarch-test-review` when a distinct test-quality audit is wanted.
3. **Advisory:** retain generated raw-write and selected real-command-body coverage as future defense-in-depth work; it is outside the formal AC5 contract.

The complete Phase 1 machine matrix is saved at `C:\tmp\tea-trace-coverage-matrix-2026-09-11T14-48-52-252Z.json` for deterministic Phase 2 input.

## Step 5 — Epic Quality Gate

### Gate Decision: FAIL

**Gate eligibility:** Yes (`allow_gate=true`, `collection_status=COLLECTED`)

**Deterministic rationale:** P0 coverage is 94% (required: 100%). 0 critical requirements are wholly uncovered; one P0 requirement remains partial.

| Criterion | Required | Actual | Status |
| --- | --- | --- | --- |
| P0 oracle coverage | 100% | 17/18 (94%) | NOT_MET |
| P1 oracle coverage | 90% target; 80% minimum | 3/3 (100%) | MET |
| Overall oracle coverage | 80% minimum | 20/21 (95%) | MET |

There are no `NONE` requirements. The sole incomplete formal requirement is `11.4-AC4`, whose relevant clause says that when Roles, counts, or effective permissions are requested by the listed unauthorized/foreign contexts, "no data or existence signal is exposed." Existing evidence does not directly exercise a missing or foreign membership through the effective-permissions read model and assert that indistinguishable result.

Story 11.4 AC5 is fully covered against the approved contract. Its exact boundary clause is "a denied command that reaches validation, lookup, or audit." The shared production envelope test proves none of those stages is called after denial. Command registration fail-closed behavior and capability-override rejection make that ordering binding for the generated registered-command probes. No approved AC5 clause requires raw database writes or execution of each real command body; those checks are broader defense-in-depth items from the epic test design.

### Execution Evidence

The gate reuses the latest completed evidence for the implementation and follow-up commits (`24ed579`, `b42899f`, `cc54a45`) at current source SHA `cc54a4584eacce7a307fc37d121f149e987ebdd7`:

- Unit: 1,734 passing tests.
- Required integration/RLS: 97 files, 1,016 passing tests, 0 skipped.
- Full E2E: 138 launched and passed, 0 failed; the supplied run summary did not state a separate skipped count.
- Story 11.4: four active role scenarios, the active catalogue contract, 145 role×table RLS cases, and registered-command envelope boundaries.
- Cross-model CLI review: both review passes returned empty output, so neither is counted as review evidence.

No new test run was requested or performed during trace. NFR assessment, code-coverage percentages, and burn-in results were not supplied and are not inputs to this coverage-only deterministic gate. Story 11.4 remains in sprint review because `followup_review_recommended: true`; that process state does not change the coverage calculation.

### Blocking Remediation

- **P0 / owner: Story 11.4 implementation-test owner / due: before Epic 11 gate rerun.** Add direct tests through `readAdminUserDetail(membershipId)` (or the authoritative effective-permissions read boundary) for a missing membership and Tenant A Admin targeting Tenant B. Both cases must return the same generic result, disclose no data, and reveal no target existence. Re-run this trace after the focused evidence passes.

Suggested test IDs:

- `11.4-API-AC4-001`: Given a current-tenant Admin and a missing membership ID, when effective permissions are requested, then the generic response exposes neither data nor an existence signal.
- `11.4-API-AC4-002`: Given a Tenant A Admin and a Tenant B membership ID, when effective permissions are requested, then the result is indistinguishable from the missing-ID case and exposes no data.

### Machine Outputs

- Trace summary: `C:\DEV\ElproSaas\_bmad-output\test-artifacts\e2e-trace-summary.json`
- Gate decision: `C:\DEV\ElproSaas\_bmad-output\test-artifacts\gate-decision.json`

```yaml
target:
  type: epic
  id: '11'
decision: FAIL
date: '2026-09-11'
evaluator: Rasmus
criteria:
  p0: { actual: '94%', required: '100%', status: NOT_MET }
  p1: { actual: '100%', target: '90%', status: MET }
  overall: { actual: '95%', minimum: '80%', status: MET }
evidence:
  trace_summary: 'C:\DEV\ElproSaas\_bmad-output\test-artifacts\e2e-trace-summary.json'
  gate_decision: 'C:\DEV\ElproSaas\_bmad-output\test-artifacts\gate-decision.json'
next_step: 'Complete 11.4-AC4 direct no-existence-signal read-path tests and rerun the Epic 11 trace gate.'
```

The Epic 11 release gate remains blocked until P0 coverage reaches 100% or an authorized waiver with the required approval contract is supplied. No waiver was requested or inferred.
