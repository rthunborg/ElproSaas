---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests', 'step-03c-aggregate', 'step-04-validate-and-summarize']
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-10-07'
workflowType: 'testarch-automate'
mode: 'BMad-Integrated'
gateIteration: 1
maximumGateIterations: 2
inputDocuments:
  - '_bmad/tea/config.yaml'
  - 'vitest.config.ts'
  - '_bmad-output/implementation-artifacts/spec-14-1-scheduling-activation-person-profiles-and-work-hours.md'
  - '_bmad-output/test-artifacts/test-design-epic-14.md'
  - '_bmad-output/test-artifacts/traceability/epic-14-traceability-report.md'
  - '_bmad-output/test-artifacts/traceability/epic-14/mapping-input.json'
  - '_bmad-output/test-artifacts/traceability/epic-14/coverage-matrix.json'
  - '_bmad-output/test-artifacts/traceability/epic-14/gate-decision.json'
  - 'docs/process/agent-model-routing.md'
---

# Epic 14 gate iteration 1 — targeted automation

## Preflight and context

Rasmus / English / Create. Existing Next.js frontend stack uses Playwright for browser verification and Vitest for real local Supabase integration/RLS verification. This authorized run targets only the database API boundary; no browser exploration or product changes are required. Original trace artifacts and approved story intent remain frozen. The customization resolver failed on the existing inaccessible uv cache; documented base/team/user fallback found empty base workflow hooks and no team/user override files.

Knowledge loaded: test-levels-framework, test-priorities-matrix, data-factories, selective-testing, ci-burn-in, test-quality, playwright-utils-mandate and pact-mcp. Vitest/Supabase SQL/RPC suites use the existing tenant/auth factories and runner; Playwright utility mechanisms do not apply to this runner. No external provider contract exists in the target; Pact artifacts and dependencies are outside scope. Pact broker: unreachable (SmartBear MCP tools not available). Provider behavior derived from current repository source.

## Coverage plan

| Scenario | Priority | Formal AC | New boundary |
| --- | --- | --- | --- |
| 14.1-RLS-001 | P0 | 14.1-AC5 | Authorized own-tenant checked resource writes with real foreign membership/profile; deny and exact two-tenant resource/audit no-op |
| 14.1-RLS-002 | P1 | 14.1-AC5 | Actual lower-role resource RPC denials; actual planner positive mutation |
| 14.1-RLS-003 | P1 | 14.1-AC5 | Actual resource reads and checked writes for no-member/invited/disabled actors |
| 14.1-DB-001 | P1 | 14.1-AC2 | Second raw profile INSERT gives 23505; exact count/state unchanged |
| 14.1-DB-002 | P1 | 14.1-AC2 | Foreign/nonexistent default work-role rejected by profile writer; exact no-op |

Selective integration only: existing route/envelope/browser evidence remains separate. No speculative production defect, planner UI, Story 14.4 expansion, performance, contrast, exploratory charter or transferred calendar click/drag credit is claimed. Worker route: API generation Sol 6.1 High (tenant/RLS/schema integrity); UI applicability Sol 6.1 Low (zero UI cases required). Native collaboration supports subagents; selected mode subagent; no agent-team runtime. All workers will be awaited before aggregation.

## Generation and aggregation

Both required frontend-stack workers completed with valid API/E2E output contracts. The API worker supplied one 322-line integration file with exactly five named cases (one P0/four P1); the E2E worker supplied an explicit zero-case output because this authorized scope contains no UI gap. The JSON outputs were read and proposed source written unchanged during aggregation. Existing tenant/Auth factories and SQL helper are reused; an inline scoped fixture deletes its resource rows and then checks no owned tenant/user/resource/audit rows remain after shared cleanup. No new factory module or dependencies are required.

Actual assertion plan: 31 checked resource RPC denials, four planner positive RPC calls, nine negative resource table reads, and one raw unique-constraint failure. All denied writes compare complete rows (timestamps and audit payloads included) across both isolated tenants. Populated-table read positives and same-tenant default-role setup prevent vacuous negatives. These are expected boundary counts, not yet executed pass counts.

Local execution wrapper reads the approved private fixture without modifying it and passes sensitive values only through inherited environment. API/database ports are fixed to loopback 55421/55422 and REQUIRED=1. Binding verification passed natively with API HTTP 200 and SQL 99/latest 20261007131222. No new managed process, browser, stack, hosted service, migration or reset was launched. Root owns the existing database lifecycle.

## Actual assertion mapping

All anchors below are in `tests/integration/commands/resources-boundaries.int.test.ts`. Full-row snapshots at line 25 include every `person_profiles`, `person_work_hours`, `tenant_calendar_days` and `audit_events` row for both fixture tenants. Cleanup at line 97 checks zero owned tenant, membership, secondary-role, resource, work-role, audit and Auth-user rows.

| Scenario / formal AC | Anchor | Actual assertions and why they are non-vacuous |
| --- | --- | --- |
| 14.1-RLS-001 / AC5 | 121 | Authenticated active admin A supplies own tenant/actor and concrete active foreign membership B to both profile writers, then concrete foreign profile B to schedule writer. Three 42501/null responses and exact resource/audit equality after each; setup successfully creates both populated tenants first. |
| 14.1-RLS-002 / AC5 | 146 | Delete secondary grants, set/confirm active Montör/Säljare/Ekonomi in real DB, invoke all four resource writers under actual JWT:12 checked denials and exact no-op. Set/confirm active Projektledare using the same JWT and call all four writers successfully: exact final profile, shift/break/exception/calendar values, seven correctly attributed/correlated target-only audit entries, foreign tenant unchanged. |
| 14.1-RLS-003 / AC5 | 225 | Confirm populated reads under active planner and no membership rows for orphan. Actual no-member/invited/disabled JWT callers query each of three populated resource tables: 9 empty result sets. Status variants retain planner entitlement, excluding a role-based false positive. All four checked writers deny for each actor: 12 checked denials and exact resource/audit no-op. |
| 14.1-DB-001 / AC2 | 268 | Existing profile is confirmed before second privileged raw INSERT with a new primary key, valid own membership and valid own default role. Rejection explicitly 23505/person_profiles_membership_id_key, membership profile count exactly 1, all resource/audit rows unchanged. It bypasses command/upsert prechecks and tests the durable uniqueness constraint. |
| 14.1-DB-002 / AC2 | 291 | Confirm real foreign active work role B, nonexistent candidate absence and valid own profile default role A. Invoke both actual profile writers with each bad default role: 4 checked 42501/null denials and exact resource/audit no-op. This exercises person_profiles.default_work_role_id, separately from booking-role negatives. |

These five executed cases complete the narrow missing paths for formal 14.1-AC2/AC5 when composed with retained existing route/envelope/raw-RLS/H4/anon/browser evidence. This automate run does not alter the formal matrix or declare a new gate decision. Root must checkpoint, re-map the affected rows, and re-evaluate the deterministic epic gate.

## New execution evidence

| Run | Native exit | Total / passed / failed / skipped | Boundary |
| --- | --- | --- | --- |
| Focused new pack | 0 | 5 /5 /0 /0 | All five discoverable scenario IDs; REQUIRED=1 |
| Affected integration | 0 | 47 /47 /0 /0 | Seven actual files: boundaries5, resources commands6, resource RLS2, role harness9, has-tenant-role3, helper semantics9, schema13; REQUIRED=1 |
| Full required integration | 0 | 1466 /1465 /0 /1 | All five new IDs pass; unchanged CI-only recovery-storage physical-loader case skips without acceptance credit; REQUIRED=1 |
| Typecheck | 0 | N/A | tsc --noEmit |
| Targeted lint | 0 | 0 errors /0 warnings | New integration test file |

All required executions completed natively with exit 0. Focused bodies completed in 421–841 ms; 41 source expect sites include fixture/control assertions. The 31 checked denial branches, 4 planner positive branches, 9 empty resource-read branches and 1 raw unique rejection all execute in each successful new-pack run. No stability percentage, numeric line/branch coverage, performance certification or burn-in claim is inferred. Full-row no-op and scoped fixture cleanup assertions passed; no user-owned data was cleaned. Post-run binding verification remains SQL 99/latest 20261007131222 and API HTTP 200.

## Scope and provenance limits

Only tests and this iteration's TEA artifacts change. Existing applied migrations, frozen story intent, original trace matrix/gate, dependencies, environment files, product sources, root orchestration/sprint state and review history stay unmodified. New browser/unit/build executions:0. Trusted prior 14.4 evidence remains separate: full INT 1461/1460/0/1, affected 172/172/0/0, units 2036/2035/0/1, components/read 27/27/0/0; browser 18 successful of 19 diagnostic bodies plus a separate same-build 1/1 targeted pass (ZtvjBbekFSgZQChOruaeT, 1,120,245 bytes/HTTP 200), not one 19-pass run. Existing recovery-Storage and Windows-xattr skips are not coverage credit.

All four genuine Contract C transfers passed before14.4 and require no new cases here. Contract D's actual 14.4-E2E-006 empty-slot click/drag remains mandatory receiving-owner work at 15.1 before calendar exposure/completion. No PhaseC/E15 host is added. Unrecorded approved performance thresholds/certification, contrast/daylight review and exploratory charter remain disclosed. Story 14.1/14.2/14.4 follow-up recommendations and draft-PR caveats remain; testing grants no review, merge, release or hosted approval. Empty-DB migration chain + seed + REQUIRED integration Epic CI remains mandatory before merge and has not been substituted by this retained-schema run.

## Validation and next workflow

Framework/config readiness, exact AC/scenario mapping, deterministic full-row assertions, priority/ID discovery, five-case scope, unique fixtures, raw/schema versus checked-writer separation, explicit owned cleanup, and absence of focused/skipped/todo/mock/hard-wait tests are checked. Existing guarded stack-gate conditional is the project fail-loud REQUIRED contract; status setup branching selects fixture state, not a skipped assertion path. The authorized integration runner and UUID factories are retained rather than introducing an unsupported test runner or dependency.

Original trace/report/mapping/matrix/gate and Story 14.1 spec SHA256 hashes remain unchanged. All 53 prior product/test/config file hashes still match the trusted fingerprint `f34ee23dc52a0f92f6de0ea24b0328946c5dbe96d1c6a34986abcef20e94712a`. New-test SHA256, actual runner titles/durations/statuses, native exits, preserved inputs and artifact hashes are in `epic-14-gate-iter1-evidence.json`. Git diff-check and direct whitespace/sensitive-literal scan are mechanical artifact validation only. The initial scanner's short-password substring check matched non-secret SQL username/documentation path text; contextual password-assignment matching removed those false positives without emitting the private value. No credential or proof value is emitted.

The official automate checklist is complete for applicable prerequisites/context, coverage planning, both worker outputs, aggregation, generated-test quality, fixture cleanup, execution, output polishing and artifact hygiene. Browser/CDC/component/unit generation, healing, and performance gain are explicitly N/A for this scope. No CLI browser session was opened. Required workers completed; only bounded runner processes were created and ended.

Next workflow: root-owned trace after the mechanical checkpoint. No broad code review or automatic Round 3 is started. No production defect was exposed by the new cases. Outcome: done; open questions/blockers: none. Root retains commit/gate/release ownership. Terminal customization resolver failed natively on the same inaccessible existing uv cache; the skill explicitly skips its terminal hook after resolver failure, and the documented base fallback hook is empty.

Reference verification: current official [Supabase RPC](https://supabase.com/docs/reference/javascript/rpc) and [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) documentation were checked for the existing RPC/read mechanism. The changelog Markdown endpoint required a plain HTTP-fetch fallback after the web reader rejected its content type; 43 breaking-tag lines were fetched. No Supabase feature, dependency, schema or configuration implementation is changed in this test-only run.

## Playwright Utils deviations

`tests/integration/commands/resources-boundaries.int.test.ts:10`: Existing Vitest SQL/checked-RPC integration runner and existing real local Auth tenant factories; this is outside the Playwright runner mandate and its package is not installed. No Playwright, auth-session, network-recorder, webhook or burn-in wiring is needed for this focused pack. Mechanism change/dependency installation is outside scope. Pact.js Utils: N/A, no consumer/provider contract artifacts generated.
