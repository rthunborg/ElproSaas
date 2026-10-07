---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision']
lastStep: 'step-05-gate-decision'
lastSaved: '2026-10-07'
workflowType: 'testarch-trace'
tempCoverageMatrixPath: 'C:/Users/Rasmus/AppData/Local/Temp/tea-trace-coverage-matrix-epic14-20261007T150430Z.json'
coverageBasis: 'acceptance_criteria'
oracleConfidence: 'high'
oracleResolutionMode: 'formal_requirements'
oracleSources:
  - '_bmad-output/implementation-artifacts/spec-14-1-scheduling-activation-person-profiles-and-work-hours.md'
  - '_bmad-output/implementation-artifacts/spec-14-2-bookings-and-assignees-schema-and-transactional-commands.md'
  - '_bmad-output/implementation-artifacts/spec-14-3-deterministic-conflict-engine-detection-core.md'
  - '_bmad-output/implementation-artifacts/spec-14-4-booking-editor-with-live-conflict-warnings-and-audited-override.md'
  - '_bmad-output/test-artifacts/test-design-epic-14.md'
  - 'docs/decisions/epic-14-story-ownership-contract-c-2026-10-06.md'
  - 'docs/decisions/epic-14-story-ownership-contract-d-2026-10-07.md'
externalPointerStatus: 'not_used'
collectionStatus: 'COLLECTED'
sourceSha: '0d1ff3a3577f8f4fc742b13cf92fb28ff598eb62'
---

# Traceability Matrix & Gate Decision — Epic 14

**Target:** Epic 14 — Resource and Scheduling Foundation. **Evaluator:** Rasmus / BMad TEA. **Mode:** Create. **Date:** 2026-10-07.

## Step 1 — Oracle and configuration

The formal oracle is the 36 final story acceptance criteria (7 + 10 + 12 + 7), supplemented by all 77 named test-design obligations (8 P0, 66 P1, 2 P2, 1 P3). Contract C governs the foundation/detector split. Contract D governs selected whole-group acceptance and transfers only real calendar empty-slot click/drag to Story 15.1. Final story wording takes precedence over historical planning and review tables. Confidence is high; no synthetic requirements or external pointer resolution is needed.

Resolved run inputs: gate_type=epic, allow_gate=true, collection_mode=contract_static, decision_mode=deterministic; coverage_levels=e2e,api,component,unit,live. The skill customization resolver failed because the existing uv cache was inaccessible (OS error 5); its documented fallback found only the base customization (no prepend/append/persistent facts/on-complete overrides). TEA config supplies English, Rasmus, and auto execution. Output paths are scoped to Epic 14 to preserve unrelated historical trace artifacts.

The TEA priority, risk governance, probability/impact, quality and selective-testing knowledge fragments guide mapping. Step 5's coverage-only decision tree is authoritative; illustrative risk engines and release-oriented template language do not grant merge/release authority. This run creates trace artifacts only, executes no product gates, and preserves story review caveats.

## Step 2 — Discovery and evidence

Static discovery resolves exact declarations, and recorded Vitest/Playwright reports expand parameterized cases. The inventory records stable file/title identity, line when resolvable, level, execution flags and report provenance. Unit declaration counts are declaration identities, not inner golden-loop row counts. Resource browser4/4 is author-recorded evidence; booking browser results are the two actual R2 runs. Full integration supplies current populated-stack evidence for predecessor suites. No new product test ran in this trace.

The inventory is saved in `epic-14/discovered-tests.json`. Cumulative H4, anon, role-harness, schema and policy assertions are inspected separately and will be linked where they materially cover resource obligations. Mocked read-action tests are component boundary evidence; they cannot substitute for SQL/RLS. Shared pure helpers and raw DB assertions are complementary, not duplicate execution credit.

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
    "current_source_sha": "0d1ff3a3577f8f4fc742b13cf92fb28ff598eb62"
  },
  "liveRecords": []
}
```

## Step 3 — Formal acceptance matrix

Final story ACs are the primary, non-duplicated gate denominator. Every named test-design obligation remains in the supplementary matrix. FULL means the complete retained behavior has a substantive assertion at the appropriate boundary; a pure algorithm requirement may be FULL at unit level. PARTIAL is not FULL credit. Shared H4/role/anon evidence is credited only for what its bodies exercise. No source constraint, helper name or adjacent passed test is treated as execution of an absent negative branch.

| Requirement | Priority | Coverage | Actual test anchors | Gap / limit |
| --- | --- | --- | --- | --- |
| 14.1-AC1 — Given the initial E14 migration, when the manifest is evaluated with the permission matrix, then `resources` is active with its three tables and E14 provenance while `scheduling` remains pending with no routes, tables, widgets, categories, public surfaces, or file owner types. | P0 | FULL | `tests/unit/scope/resources-activation.atdd.test.ts:7` |  |
| 14.1-AC2 — Given a tenant membership, when an entitled maintainer creates or edits its person profile, then at most one profile exists for that membership and any default work role is an existing work role from the same tenant. | P1 | PARTIAL | `tests/integration/commands/resources.int.test.ts:6,56`; `tests/e2e/resources-person-profile.e2e.spec.ts:32`; `tests/integration/commands/booking-conflicts.int.test.ts:785` | Second raw person-profile insert for the same membership must reject with constraint failure and exact unchanged count/state; positive upsert and repeated form updates do not exercise the unique rejection. Actual profile default_work_role_id writer must reject concrete foreign and nonexistent work roles and preserve exact state/audit. Booking work_role_id negatives are a different field/writer. |
| 14.1-AC3 — Given two people each recorded as 80 percent, when one has four full scheduled days and the other five shorter scheduled days, then capacity input preserves their different daily availability and never synthesizes hours from the percentage. | P1 | FULL | `tests/unit/features/resources/work-hours.test.ts:7`; `tests/unit/features/scheduling/capacity.golden.test.ts:35` |  |
| 14.1-AC4 — Given valid weekly shifts, breaks, individual absence/blocked-time exceptions, and tenant calendar-day reductions, when they are saved, then each remains data/config driven for later capacity calculation; invalid windows, overlaps, or invalid reductions are rejected with no partial persistence. | P1 | FULL | `tests/integration/commands/resources.int.test.ts:6,23,33`; `tests/unit/features/resources/work-hours.test.ts:38,57`; `tests/unit/features/resources/capacity-inputs.test.ts:53`; `tests/integration/commands/booking-conflicts.int.test.ts:785`; `tests/unit/features/scheduling/conflicts.test.ts:48`; `tests/unit/features/scheduling/capacity.golden.test.ts:35,76` |  |
| 14.1-AC5 — Given a cross-tenant, anonymous, invited, disabled, or role-ineligible caller, when it reads or mutates resource rows directly or through a command/route, then it receives no data or mutation; H4, exact-policy, and matrix-derived negative tests include every new table. | P0 | PARTIAL | `tests/integration/rls/cross-tenant-isolation.rls.test.ts:518,532,544,692`; `tests/integration/rls/resources.rls.test.ts:7,10`; `tests/integration/commands/resources.int.test.ts:81,100`; `tests/integration/rls/role-harness.atdd.int.test.ts:169,178,207,221,233`; `tests/e2e/resources-person-profile.e2e.spec.ts:32`; `tests/integration/rls/anon-path-isolation.rls.test.ts:72,85,98,113`; `tests/integration/rls/has-tenant-role.rls.test.ts:56`; `tests/integration/rls/helper-semantics.rls.test.ts:76,84,91,109,136,143`; `tests/integration/rls/rls-inventory-gate.int.test.ts:56,67,79,91`; `tests/integration/rls/acceptance-tables-migration-reset.int.test.ts:199`; `tests/integration/rls/calc-tables-migration-reset.int.test.ts:209,273`; `tests/integration/rls/crm-tables-migration-reset.int.test.ts:169`; `tests/integration/rls/file-tables-migration-reset.int.test.ts:139,277`; `tests/integration/rls/migration-reset.int.test.ts:209,241`; `tests/integration/rls/pricing-tables-migration-reset.int.test.ts:169`; `tests/integration/rls/quote-follow-ups-migration-reset.int.test.ts:111,140`; `tests/integration/rls/quote-lost-reasons-migration-reset.int.test.ts:117,143`; `tests/integration/rls/quote-review-authorization-migration-reset.int.test.ts:20`; `tests/integration/rls/quote-tables-migration-reset.int.test.ts:337` | Same-tenant authorized caller supplies a concrete foreign membership or person profile to the actual resource command/checked RPC; assert denial and exact unchanged resource/audit state. Existing foreign-tenant-ID and forged-actor cases do not exercise that parent-reference path. Actual authenticated role-ineligible checked resource RPC denial and positive planner mutation are unexecuted. Generic registered command probe deliberately stops at envelope authorization and never calls the business RPC. Existing user-detail host is admin-only; no planner UI is required. Actual no-membership, invited and disabled callers reading resource rows and invoking checked resource RPCs are unexecuted. Disabled has_tenant_role helper evidence exists; invited/no-member helper tests use is_active_tenant_member, a different predicate. |
| 14.1-AC6 — Given an existing deactivated member profile, when an admin opens it, then its historical person and schedule data remains available with an inactive marker and no destructive cascade, booking creation, or reassignment mutation occurs. | P1 | FULL | `tests/e2e/resources-person-profile.e2e.spec.ts:89`; `tests/integration/commands/bookings.int.test.ts:449` |  |
| 14.1-AC7 — Given a successful admin schedule edit at 360×640 or desktop width, when the page reloads, then the persisted server state is rendered; a transient failure retains suitable unsent input, offers retry, and never claims success before the server confirms the write. | P1 | FULL | `tests/e2e/resources-person-profile.e2e.spec.ts:32,100,119` |  |
| 14.2-AC1 — Given migrated resources schema, when the manifest/H4/exact-policy/matrix gates inspect it, then exactly the three new resource-owned tables are enrolled, caller direct writes and private primitive execution are denied, and scheduling has no live surface. | P0 | FULL | `tests/unit/scope/resources-activation.atdd.test.ts:7`; `tests/integration/rls/acceptance-tables-migration-reset.int.test.ts:199`; `tests/integration/rls/calc-tables-migration-reset.int.test.ts:209,273`; `tests/integration/rls/crm-tables-migration-reset.int.test.ts:169`; `tests/integration/rls/file-tables-migration-reset.int.test.ts:139,277`; `tests/integration/rls/migration-reset.int.test.ts:209,241`; `tests/integration/rls/pricing-tables-migration-reset.int.test.ts:169`; `tests/integration/rls/quote-follow-ups-migration-reset.int.test.ts:111,140`; `tests/integration/rls/quote-lost-reasons-migration-reset.int.test.ts:117,143`; `tests/integration/rls/quote-review-authorization-migration-reset.int.test.ts:20`; `tests/integration/rls/quote-tables-migration-reset.int.test.ts:337`; `tests/integration/rls/rls-inventory-gate.int.test.ts:56,67,79,91`; `tests/integration/rls/bookings.rls.test.ts:17`; `tests/unit/scope/booking-editor-scope.test.ts:13` |  |
| 14.2-AC2 — Given an entitled admin/planner invokes the actual create command, when validation succeeds, then one booking, the exact distinct assignee set, durable command outcome and exactly one attributable target-only audit event commit together (14.2-INT-001, P0). | P0 | FULL | `tests/integration/commands/bookings.int.test.ts:122` |  |
| 14.2-AC3 — Given an existing same-tenant booking, when a fresh authorized update completes, then identity/create history is preserved and mutable fields, exact replacement assignments, one update outcome and one new audit event change atomically (14.2-INT-002, P1). | P1 | FULL | `tests/integration/commands/bookings.int.test.ts:155` |  |
| 14.2-AC4 — Given a completed command, when replayed with equivalent canonical input or raced concurrently, then the original target-only outcome is returned with unchanged row/audit counts, including after later update or deactivation; changed canonical content under the same scoped key returns COMMAND_CONFLICT and changes nothing (14.2-INT-003/004/005, P1). | P1 | FULL | `tests/integration/commands/bookings.int.test.ts:19,53,188,214,238` |  |
| 14.2-AC5 — Given fresh create or update, when a booking/assignee preparation fault or audit-write fault occurs, then booking, assignments, command outcomes and audit return exactly to the pre-command snapshot; no durable partial state exists (14.2-INT-006/007, P1). | P1 | FULL | `tests/integration/commands/bookings.int.test.ts:256,273` |  |
| 14.2-AC6 — Given standalone or linked input, when persisted/reloaded, then independently nullable parents remain valid and coherent supplied same-tenant relationships and existing jobs.id are preserved; foreign/mismatched parents, duplicate/foreign assignees, nonpositive time and invalid all-day bounds fail atomically (14.2-DB-001/002/003/004/005 and INT-009, P1). UTC storage round-trips the intended Stockholm interval across both DST boundaries. | P1 | FULL | `tests/integration/commands/bookings.int.test.ts:288,307,345,366,397,418` |  |
| 14.2-AC7 — Given a deactivated profile, when it is newly added, then assignment is denied; when previously assigned history is read or unchanged assignment retained, then it survives without cascade (14.2-INT-010, P1). | P1 | FULL | `tests/integration/commands/bookings.int.test.ts:449` |  |
| 14.2-AC8 — Given cross-tenant callers, when they read or directly/indirectly mutate any booking table, then no foreign rows or existence details are exposed and no business/outcome/audit state changes (14.2-RLS-001, P0). | P0 | FULL | `tests/integration/rls/bookings.rls.test.ts:69` |  |
| 14.2-AC9 — Given an active Montor, when reading own/shared/coworker-only bookings and children or attempting mutation, then only assigned bookings, own assignment rows and own-participation conflicts on visible bookings are readable, and mutation is denied; admin/planner succeeds within tenant while every direct callable wrapper independently rechecks authority (14.2-RLS-002/003/004, P1). | P1 | FULL | `tests/integration/rls/bookings.rls.test.ts:38,115,143,163` |  |
| 14.2-AC10 — Given completion of 14.2, when scope and evidence are inspected, then it provides foundation acceptance only, exposes no booking entry point and preserves the mandatory 14.3 detector integration gate before any 14.4 work and the Epic PR. | P0 | FULL | `tests/unit/scope/resources-activation.atdd.test.ts:7`; `tests/unit/scope/booking-editor-scope.test.ts:13`; `tests/integration/commands/booking-conflicts.int.test.ts:46,71,87,116,159,179` |  |
| 14.3-AC1 — Given shared-assignee overlaps or adjacent half-open bounds, when the pure engine runs, then only real pair/person collisions emit one stable double_booking identity and adjacent intervals emit none (14.3-UNIT-001/002/003). | P1 | FULL | `tests/unit/features/scheduling/conflicts.test.ts:9,17,22` |  |
| 14.3-AC2 — Given actual weekly shifts, breaks, absences, blocked time, holiday/calendar reductions, existing booking demand and optional buffer, when capacity is evaluated, then each formula component changes only its own term, overlapping unavailability is subtracted once, positive overrun warns and outside-work-hours violations preserve their exact windows; employment percentage does not infer a schedule (14.3-UNIT-004/005/006/012). | P1 | FULL | `tests/unit/features/scheduling/capacity.golden.test.ts:7,35`; `tests/unit/features/scheduling/conflicts.test.ts:36,48` |  |
| 14.3-AC3 — Given typed optional job access/required work-role inputs, when supplied or explicitly unavailable, then supplied violations emit outside_access_window/competence_missing and absence emits neither without being misrepresented as verified; authorized overtime is injectable rule data, never default ordinary capacity or a new action (14.3-UNIT-007/008/013). | P1 | FULL | `tests/unit/features/scheduling/conflicts.test.ts:59,70`; `tests/unit/features/scheduling/capacity.golden.test.ts:76` |  |
| 14.3-AC4 — Given Stockholm DST gaps/folds and frozen/permuted inputs, when interpreted and detected, then first-valid spring/earlier fall policy and microseconds hold across timed/all-day multi-day bounds, output is byte-equivalent and inputs unchanged with no I/O/clock (14.3-UNIT-009/010/011). | P1 | FULL | `tests/unit/features/scheduling/dst.golden.test.ts:11,30`; `tests/unit/features/scheduling/conflicts.test.ts:82` |  |
| 14.3-AC5 — Given identical frozen authoritative facts and rules, when the internal preview seam and real save orchestration run, then both call the sole engine and return/persist the same normalized conflicts (14.3-INT-001). No browser preview is claimed before 14.4. | P1 | FULL | `tests/integration/commands/booking-conflicts.int.test.ts:46` |  |
| 14.3-AC6 — Given a preview then another committed booking, when the actual save finalizes, then the stale snapshot cannot suppress the collision: zero stale-attempt writes occur and refreshed authoritative detection persists it (14.3-INT-002 and transferred 14.3-INT-006, P0). | P0 | FULL | `tests/integration/commands/booking-conflicts.int.test.ts:71,179` |  |
| 14.3-AC7 — Given entitled fresh create, when current attested detection finalizes, then exactly one booking, exact assignments and derived conflict rows, one durable outcome and one attributable audit commit atomically (transferred 14.3-INT-003, P0). | P0 | FULL | `tests/integration/commands/booking-conflicts.int.test.ts:87` |  |
| 14.3-AC8 — Given an existing booking and a fresh replacement/cancellation, when saved, then current conflicts rederive across candidate and affected peers, stale peer-owned rows disappear atomically, identical accepted natural keys retain evidence, and changed keys are open without blanket acceptance or invented resolution (transferred 14.3-INT-004, P1). | P1 | FULL | `tests/integration/commands/booking-conflicts.int.test.ts:116` |  |
| 14.3-AC9 — Given a fault after conflict preparation or at audit, when create/update attempts commit, then every booking/assignee/conflict/outcome/audit snapshot equals its pre-command state (transferred 14.3-INT-005, P1). | P1 | FULL | `tests/integration/commands/booking-conflicts.int.test.ts:159` |  |
| 14.3-AC10 — Given concurrent distinct-key bookings or any enrolled consumed-fact writer, when their transactions race with finalize, then a common first gate plus full digest recheck produces a coherent current result without write skew, deadlock inversion or silently truncated facts; actor revocation after a wait denies even replay, while authorized canonical replay returns the historical outcome without added writes/audit. | P0 | FULL | `tests/integration/commands/booking-conflicts.int.test.ts:209,232,559,591,785`; `tests/integration/commands/bookings-replay-authority.int.test.ts:24` |  |
| 14.3-AC11 — Given direct Data API callers or malformed/cross-boundary proof, when snapshot/finalize/legacy/private paths are invoked, then tenant/actor/matrix/ACL/proof enforcement prevents unauthorized facts or mutations, including Montör writes, and existing own-assignment read scope stays intact. | P0 | FULL | `tests/integration/commands/booking-conflicts.int.test.ts:540,756,771`; `tests/integration/rls/bookings.rls.test.ts:17,38,69,115,143,163` |  |
| 14.3-AC12 — Given a corrected missed/phantom conflict or completed story evidence, when regression and scope gates run, then a permanent named fixture protects the correction (14.3-UNIT-014), all 14 unit and six integration IDs execute, every transferred P0/P1 check passes, resources remains active, scheduling pending, and no 14.4/UI/E15/Phase C capability has been exposed. | P0 | FULL | `tests/unit/features/scheduling/conflicts.test.ts:105`; `tests/integration/commands/booking-conflicts.int.test.ts:87,116,159,179` |  |
| 14.4-AC1 — Given an entitled current toolbar/job/customer entry, when opened and edited, then the desktop side sheet or 360×640 full-screen sheet exposes all approved fields, optional standalone connections, availability hints and prefilled context without E15/recurrence controls (COMP-001/002, E2E-001/006). Only empty-slot click/drag transfers to Story 15.1 actual Schema/Resurser hosts; it must pass before calendar entry-point exposure/completion and is not claimed here. | P1 | FULL | `tests/integration/components/booking-editor.test.ts:59,71,86,96`; `tests/e2e/booking-editor.e2e.spec.ts:84,104,151,169,203,231,283` |  |
| 14.4-AC2 — Given changed assignees/time or other detector inputs, when current preview returns, then the visible panel explains every relevant rule/person/window/collision with an accessible mini-timeline, old results cannot overwrite newer warnings, and failures remain visibly unknown (COMP-003/004). | P1 | FULL | `tests/integration/components/booking-editor.test.ts:107,119,130,143,153`; `tests/integration/commands/booking-editor-round2.int.test.ts:8,25`; `tests/e2e/booking-editor.e2e.spec.ts:473` |  |
| 14.4-AC3 — Given current warnings, when saving without explicit acknowledgment or with blank/forged/stale/unauthorized acceptance, then the editor shows the corresponding safe error, retains draft and commits no business/outcome/audit rows; authorized explicit current-set review with nonblank reason atomically accepts selected reviewed candidate-related complete logical groups with actor/time/reason and one audit, leaving other reviewed candidate conflicts open and excluding unrelated tenant conflicts (INT-001/002/003). | P0 | FULL | `tests/integration/commands/booking-editor.int.test.ts:65,92,115,132,146,160,241,254,270,284,307,319,342,363,439,465,483,574`; `tests/integration/commands/booking-editor-review-fixes.int.test.ts:12,47`; `tests/e2e/booking-editor.e2e.spec.ts:135` |  |
| 14.4-AC4 — Given accepted/unaccepted/resolved conflicts and a later collision change, when the booking reloads or is updated, then open-only counts persist, identical acceptance survives and changed identity is open; unrelated conflicts are never accepted by this candidate's action (INT-004/005, E2E-002). | P1 | FULL | `tests/integration/commands/booking-editor.int.test.ts:201,387,417`; `tests/e2e/booking-editor.e2e.spec.ts:310` |  |
| 14.4-AC5 — Given dirty edits, when Escape/back/close is requested, then cancel retains input and deliberate discard closes with predictable focus return; in-flight saves cannot silently dismiss the form (E2E-003/007). | P1 | FULL | `tests/e2e/booking-editor.e2e.spec.ts:328,355,473,511` |  |
| 14.4-AC6 — Given transient failure or lost response after commit at 360×640, when explicit retry occurs, then suitable unsent state remains, success appears only after server confirmation and durable state contains one booking/assignment/conflict set with one attributable audit (E2E-004/005). | P1 | FULL | `tests/e2e/booking-editor.e2e.spec.ts:84,120,391,420`; `tests/unit/features/resources/booking-attempt-transport.test.ts:7,15,20` |  |
| 14.4-AC7 — Given Montör/unauthorized/cross-tenant/direct RPC requests, when read/preview/save/override is attempted, then existing current role/row authority prevents broader visibility/mutation with generic errors; resources stays active and scheduling pending (GOV-001, retained RLS obligations). | P0 | FULL | `tests/unit/scope/booking-editor-scope.test.ts:13`; `tests/integration/commands/booking-editor.int.test.ts:503,531,552,585,613`; `tests/integration/rls/bookings.rls.test.ts:17,38,69,115,143,163`; `tests/integration/features/booking-read-actions.test.ts:61,65,71,81,94,101,107,117,123,127,133,138,144` |  |

### All 77 test-design obligations

| Requirement | Priority | Coverage | Actual test anchors | Gap / limit |
| --- | --- | --- | --- | --- |
| 14.1-RLS-001 — Cross-tenant profile, hours, calendar CRUD and parent-spoof denial. | P0 | PARTIAL | `tests/integration/rls/cross-tenant-isolation.rls.test.ts:518,532,544,692`; `tests/integration/rls/resources.rls.test.ts:7,10`; `tests/integration/commands/resources.int.test.ts:81` | Same-tenant authorized caller supplies a concrete foreign membership or person profile to the actual resource command/checked RPC; assert denial and exact unchanged resource/audit state. Existing foreign-tenant-ID and forged-actor cases do not exercise that parent-reference path. |
| 14.1-GOV-001 — `resources` activates with E14 metadata/tables/permissions and derived guardrails agree. | P0 | FULL | `tests/unit/scope/resources-activation.atdd.test.ts:7` |  |
| 14.1-GOV-002 — `scheduling` remains pending with empty live surfaces. | P0 | FULL | `tests/unit/scope/resources-activation.atdd.test.ts:7` |  |
| 14.2-INT-001 — Create atomically commits one booking, assignees, idempotency outcome and one audit event. | P0 | FULL | `tests/integration/commands/bookings.int.test.ts:122` |  |
| 14.3-INT-003 — Create atomically commits server-derived conflicts with booking, assignees, idempotency outcome and one audit event. | P0 | FULL | `tests/integration/commands/booking-conflicts.int.test.ts:87` |  |
| 14.3-INT-006 — Conflict committed after preview is detected inside authoritative save against current rows. | P0 | FULL | `tests/integration/commands/booking-conflicts.int.test.ts:179` |  |
| 14.2-RLS-001 — Cross-tenant booking, assignee, and conflict reads/writes fail. | P0 | FULL | `tests/integration/rls/bookings.rls.test.ts:69` |  |
| 14.4-INT-002 — Explicit review plus nonblank reason atomically accepts selected candidate-related whole logical conflict groups with actor/reason/audit; never unrelated tenant conflicts. | P0 | FULL | `tests/integration/commands/booking-editor.int.test.ts:160,363,439,483` |  |
| 14.1-GOV-003 — Every new tenant table is in H4 and policy inventory; omission fails. | P1 | FULL | `tests/integration/rls/resources.rls.test.ts:7,10`; `tests/integration/rls/rls-inventory-gate.int.test.ts:56,67,79,91`; `tests/integration/rls/acceptance-tables-migration-reset.int.test.ts:199`; `tests/integration/rls/calc-tables-migration-reset.int.test.ts:209,273`; `tests/integration/rls/crm-tables-migration-reset.int.test.ts:169`; `tests/integration/rls/file-tables-migration-reset.int.test.ts:139,277`; `tests/integration/rls/migration-reset.int.test.ts:209,241`; `tests/integration/rls/pricing-tables-migration-reset.int.test.ts:169`; `tests/integration/rls/quote-follow-ups-migration-reset.int.test.ts:111,140`; `tests/integration/rls/quote-lost-reasons-migration-reset.int.test.ts:117,143`; `tests/integration/rls/quote-review-authorization-migration-reset.int.test.ts:20`; `tests/integration/rls/quote-tables-migration-reset.int.test.ts:337` |  |
| 14.2-INT-003 — Same command key and canonical request replay without duplicates. | P1 | FULL | `tests/integration/commands/bookings.int.test.ts:19,188` |  |
| 14.2-INT-005 — Concurrent identical creates yield one durable booking. | P1 | FULL | `tests/integration/commands/bookings.int.test.ts:53,238` |  |
| 14.2-RLS-002 — Montör sees only bookings joined to their own person. | P1 | FULL | `tests/integration/rls/bookings.rls.test.ts:38,115` |  |
| 14.3-UNIT-001 — Shared-assignee overlap emits one stable double-booking conflict. | P1 | FULL | `tests/unit/features/scheduling/conflicts.test.ts:9` |  |
| 14.3-UNIT-004 — Time above actual-schedule capacity emits over-capacity. | P1 | FULL | `tests/unit/features/scheduling/capacity.golden.test.ts:7` |  |
| 14.3-UNIT-012 — Each term of the six-term capacity formula changes only its named term. | P1 | FULL | `tests/unit/features/scheduling/capacity.golden.test.ts:35` |  |
| 14.3-INT-002 — Concurrent committed booking is added by authoritative save. | P1 | FULL | `tests/integration/commands/booking-conflicts.int.test.ts:71` |  |
| 14.4-E2E-004 — Failed phone save retains suitable draft, marks unsent, offers retry, and shows no success. | P1 | FULL | `tests/e2e/booking-editor.e2e.spec.ts:391` |  |
| 14.4-E2E-005 — Retry produces one server-confirmed booking and one related state set. | P1 | FULL | `tests/e2e/booking-editor.e2e.spec.ts:420` |  |
| 14.4-GOV-001 — No recurrence, E15 nav/views/resolver/time reports/notifications/feed surface ships. | P1 | FULL | `tests/unit/scope/booking-editor-scope.test.ts:13` |  |
| 14.1-UNIT-001 — Capacity follows four full scheduled days for an 80% person. | P1 | FULL | `tests/unit/features/resources/work-hours.test.ts:7`; `tests/unit/features/scheduling/capacity.golden.test.ts:35` |  |
| 14.1-UNIT-002 — Five explicit short days retain their day-level shape. | P1 | FULL | `tests/unit/features/resources/work-hours.test.ts:7`; `tests/unit/features/scheduling/capacity.golden.test.ts:35` |  |
| 14.1-UNIT-003 — Breaks reduce scheduled time exactly once. | P1 | FULL | `tests/unit/features/scheduling/conflicts.test.ts:48`; `tests/unit/features/scheduling/capacity.golden.test.ts:35` |  |
| 14.1-UNIT-004 — Public holiday and tenant-day layers avoid double subtraction. | P1 | FULL | `tests/unit/features/scheduling/conflicts.test.ts:48`; `tests/unit/features/scheduling/capacity.golden.test.ts:35` |  |
| 14.1-UNIT-005 — Vacation, sickness, leave, training, and blocked time subtract overlap only. | P1 | FULL | `tests/unit/features/scheduling/conflicts.test.ts:48`; `tests/unit/features/scheduling/capacity.golden.test.ts:35` |  |
| 14.1-UNIT-006 — Optional planning buffer follows injected configuration. | P1 | FULL | `tests/unit/features/scheduling/conflicts.test.ts:48`; `tests/unit/features/scheduling/capacity.golden.test.ts:35` |  |
| 14.1-UNIT-007 — Overtime adds no ordinary capacity without explicit authorization. | P1 | FULL | `tests/unit/features/scheduling/capacity.golden.test.ts:76` |  |
| 14.1-DB-001 — One membership owns exactly one person profile. | P1 | PARTIAL | `tests/integration/commands/resources.int.test.ts:6,56`; `tests/e2e/resources-person-profile.e2e.spec.ts:32` | Second raw person-profile insert for the same membership must reject with constraint failure and exact unchanged count/state; positive upsert and repeated form updates do not exercise the unique rejection. |
| 14.1-DB-002 — Default work role must exist in the same tenant. | P1 | PARTIAL | `tests/e2e/resources-person-profile.e2e.spec.ts:32`; `tests/integration/commands/booking-conflicts.int.test.ts:785` | Actual profile default_work_role_id writer must reject concrete foreign and nonexistent work roles and preserve exact state/audit. Booking work_role_id negatives are a different field/writer. |
| 14.1-DB-003 — Valid shifts/breaks persist; invalid or overlapping bounds fail. | P1 | FULL | `tests/integration/commands/resources.int.test.ts:6`; `tests/unit/features/resources/work-hours.test.ts:38,57` |  |
| 14.1-DB-004 — Calendar-day variants persist without rule-specific schema expansion. | P1 | FULL | `tests/integration/commands/resources.int.test.ts:23,33`; `tests/unit/features/resources/capacity-inputs.test.ts:53`; `tests/integration/commands/booking-conflicts.int.test.ts:785` |  |
| 14.1-RLS-002 — Entitled maintainers succeed; non-entitled roles fail at DB/command/route. | P1 | PARTIAL | `tests/integration/rls/role-harness.atdd.int.test.ts:169,178,207,221,233`; `tests/e2e/resources-person-profile.e2e.spec.ts:32` | Actual authenticated role-ineligible checked resource RPC denial and positive planner mutation are unexecuted. Generic registered command probe deliberately stops at envelope authorization and never calls the business RPC. Existing user-detail host is admin-only; no planner UI is required. |
| 14.1-RLS-003 — Anon, no-membership, invited, and disabled callers get no data or mutations. | P1 | PARTIAL | `tests/integration/rls/anon-path-isolation.rls.test.ts:72,85,98,113`; `tests/integration/commands/resources.int.test.ts:100`; `tests/integration/rls/has-tenant-role.rls.test.ts:56`; `tests/integration/rls/helper-semantics.rls.test.ts:76,84,91,109,136,143` | Actual no-membership, invited and disabled callers reading resource rows and invoking checked resource RPCs are unexecuted. Disabled has_tenant_role helper evidence exists; invited/no-member helper tests use is_active_tenant_member, a different predicate. |
| 14.1-E2E-001 — Admin edits default role and weekly schedule and sees persisted values after reload. | P1 | FULL | `tests/e2e/resources-person-profile.e2e.spec.ts:32,100,119` |  |
| 14.1-E2E-002 — Deactivated person cannot be newly assigned; history remains and future work needs reassignment. | P1 | FULL | `tests/e2e/resources-person-profile.e2e.spec.ts:89`; `tests/integration/commands/bookings.int.test.ts:449` |  |
| 14.2-DB-001 — Standalone booking with every optional connection null is valid. | P1 | FULL | `tests/integration/commands/bookings.int.test.ts:288` |  |
| 14.2-DB-002 — Optional connections accept same-tenant targets and reject foreign/mismatched parents. | P1 | FULL | `tests/integration/commands/bookings.int.test.ts:307` |  |
| 14.2-DB-003 — End after start is enforced; zero/negative windows write nothing. | P1 | FULL | `tests/integration/commands/bookings.int.test.ts:345` |  |
| 14.2-DB-004 — Timed and all-day bookings store UTC and preserve approved local display interval. | P1 | FULL | `tests/integration/commands/bookings.int.test.ts:366` |  |
| 14.2-DB-005 — Duplicate assignee or foreign-tenant person fails. | P1 | FULL | `tests/integration/commands/bookings.int.test.ts:397` |  |
| 14.2-INT-002 — Update atomically replaces mutable booking fields/assignees with idempotency and audit state. | P1 | FULL | `tests/integration/commands/bookings.int.test.ts:155` |  |
| 14.3-INT-004 — Update re-derives conflicts and replaces stale derived rows atomically with booking/assignees/idempotency/audit. | P1 | FULL | `tests/integration/commands/booking-conflicts.int.test.ts:116` |  |
| 14.2-INT-004 — Reusing a command key with changed canonical content returns stable conflict and no change. | P1 | FULL | `tests/integration/commands/bookings.int.test.ts:214` |  |
| 14.2-INT-006 — Failure after booking insert rolls back all business/idempotency/audit state. | P1 | FULL | `tests/integration/commands/bookings.int.test.ts:256` |  |
| 14.2-INT-007 — Failure after assignee preparation leaves zero partial business/idempotency/audit state. | P1 | FULL | `tests/integration/commands/bookings.int.test.ts:273` |  |
| 14.3-INT-005 — Failure after conflict preparation rolls back booking/assignee/conflict/idempotency/audit state. | P1 | FULL | `tests/integration/commands/booking-conflicts.int.test.ts:159` |  |
| 14.2-RLS-003 — Montör cannot invoke planner/admin create or update unless final matrix grants it. | P1 | FULL | `tests/integration/rls/bookings.rls.test.ts:143` |  |
| 14.2-RLS-004 — Entitled planner/admin succeeds within tenant; direct routes/commands still authorize. | P1 | FULL | `tests/integration/rls/bookings.rls.test.ts:163` |  |
| 14.2-INT-009 — Booking binds to an existing Phase A basic job and preserves its ID. | P1 | FULL | `tests/integration/commands/bookings.int.test.ts:418` |  |
| 14.2-INT-010 — Deactivated person cannot be newly assigned; historical assignment remains. | P1 | FULL | `tests/integration/commands/bookings.int.test.ts:449` |  |
| 14.3-UNIT-002 — Adjacent half-open intervals do not conflict. | P1 | FULL | `tests/unit/features/scheduling/conflicts.test.ts:17` |  |
| 14.3-UNIT-003 — Only the colliding assignee is reported and input order does not matter. | P1 | FULL | `tests/unit/features/scheduling/conflicts.test.ts:22` |  |
| 14.3-UNIT-005 — Candidate wholly or partly outside shift emits outside-work-hours. | P1 | FULL | `tests/unit/features/scheduling/conflicts.test.ts:36` |  |
| 14.3-UNIT-006 — Break or absence emits outside-work-hours without duplicate identity. | P1 | FULL | `tests/unit/features/scheduling/conflicts.test.ts:48` |  |
| 14.3-UNIT-007 — Job access-window conflict applies when supplied; standalone booking has none. | P1 | FULL | `tests/unit/features/scheduling/conflicts.test.ts:59` |  |
| 14.3-UNIT-008 — Missing required role emits competence-missing; matching input clears it. | P1 | FULL | `tests/unit/features/scheduling/conflicts.test.ts:70` |  |
| 14.3-UNIT-009 — Spring nonexistent local time maps to first valid instant. | P1 | FULL | `tests/unit/features/scheduling/dst.golden.test.ts:11` |  |
| 14.3-UNIT-010 — Fall ambiguous local time maps to earlier instant. | P1 | FULL | `tests/unit/features/scheduling/dst.golden.test.ts:30` |  |
| 14.3-UNIT-011 — Repeated frozen input returns byte-equivalent sorted output with no clock/I/O. | P1 | FULL | `tests/unit/features/scheduling/conflicts.test.ts:82` |  |
| 14.3-UNIT-013 — Authorized overtime is injected config and needs no schema-shape change. | P1 | FULL | `tests/unit/features/scheduling/capacity.golden.test.ts:76` |  |
| 14.3-INT-001 — Preview and save given identical frozen facts return the same normalized conflicts. | P1 | FULL | `tests/integration/commands/booking-conflicts.int.test.ts:46` |  |
| 14.3-UNIT-014 — Every corrected miss/phantom becomes a named immutable regression fixture. | P1 | FULL | `tests/unit/features/scheduling/conflicts.test.ts:105` |  |
| 14.4-COMP-001 — Desktop editor is a focus-trapped side sheet with no recurrence controls. | P1 | FULL | `tests/integration/components/booking-editor.test.ts:59` |  |
| 14.4-E2E-001 — At 360×640 editor is full-screen, scrollable, no overflow, actions reachable. | P1 | FULL | `tests/e2e/booking-editor.e2e.spec.ts:283` |  |
| 14.4-COMP-002 — Assignee, role, time, connection, and description edits preserve draft model. | P1 | FULL | `tests/integration/components/booking-editor.test.ts:71,86,96` |  |
| 14.4-COMP-003 — Assignee/time changes refresh ConflictPanel and remove stale warnings. | P1 | FULL | `tests/integration/components/booking-editor.test.ts:130,143,153` |  |
| 14.4-COMP-004 — Conflict panel exposes type/person/window/context/timeline without color-only status. | P1 | FULL | `tests/integration/components/booking-editor.test.ts:107,119` |  |
| 14.4-INT-001 — Conflict save without explicit proof returns BOOKING_CONFLICT_UNACKNOWLEDGED. | P1 | FULL | `tests/integration/commands/booking-editor.int.test.ts:65,92,115,132,146` |  |
| 14.4-INT-003 — Blank reason, forged IDs, stale preview, or unauthorized override changes nothing. | P1 | FULL | `tests/integration/commands/booking-editor.int.test.ts:241,254,270,284,307,319,342,465,574` |  |
| 14.4-INT-004 — Reviewed but unselected candidate conflicts stay open; open count excludes accepted/resolved; unrelated conflicts do not inherit acceptance. | P1 | FULL | `tests/integration/commands/booking-editor.int.test.ts:201` |  |
| 14.4-INT-005 — Changed collision natural key reopens detection. | P1 | FULL | `tests/integration/commands/booking-editor.int.test.ts:387,417` |  |
| 14.4-E2E-002 — Conflict count after reload reflects persisted open conflicts only. | P1 | FULL | `tests/e2e/booking-editor.e2e.spec.ts:310` |  |
| 14.4-E2E-003 — Dirty Escape/back/close warns; cancel retains and confirm discards intentionally. | P1 | FULL | `tests/e2e/booking-editor.e2e.spec.ts:328,355` |  |
| 14.4-E2E-006 — Current toolbar/job/customer entries prefill context without E15 Planering/nav. Only empty-slot click/drag portion transfers to Story 15.1 actual Schema/Resurser hosts. | P1 | FULL | `tests/e2e/booking-editor.e2e.spec.ts:203,231` |  |
| 14.4-E2E-007 — Keyboard use, focus, live regions, and touch targets meet approved requirements. | P1 | FULL | `tests/e2e/booking-editor.e2e.spec.ts:473,511` |  |
| 14.NFR-PERF-001 — Benchmark engine and save path at owner-approved representative volumes and latency thresholds. | P2 | NONE | None | No owner-approved representative volume/latency thresholds or eligible performance certification exists. Declared local fixture elapsed times do not satisfy this requirement. |
| 14.NFR-A11Y-001 — Review contrast and daylight readability for conflict states and primary actions. | P2 | NONE | None | No recorded contrast/daylight review found. Automated accessible semantics and touch-target bounds do not provide that manual visual review. |
| 14.EXP-001 — Explore multi-assignee edits across work-hour, DST, access-window, and retry boundaries. | P3 | NONE | None | No recorded cross-rule exploratory charter outcome found; deterministic named cases are retained but not relabeled as exploratory evidence. |

### Binding transfer ledger

Contract C: original14.2 INT001 conflict portion→14.3 INT003(P0); INT002 conflict refresh→INT004(P1); INT007 conflict-preparation fault→INT005(P1); originalINT008 current-row detection→INT006(P0). All four actual raw named cases passed before14.4. Story14.2 foundation portions remain separately mapped.

Contract D: retained14.4 E2E006 toolbar/standalone/job/customer entry is mapped to actual browser persistence; **14.4-E2E-006(empty-slot click/drag portion)** remains TRANSFERRED/PENDING at15.1, no execution credit and outside this Epic14 denominator. Both real Schema and Resurser click and drag, selected interval and supplied person context, plus keyboard/dialog parity, must pass before applicable calendar exposure and15.1 completion. The component person/time prefill seam is no calendar evidence.

## Step 4 — Coverage gaps and Phase 1 completion

The narrow High delegate inspected actual assertions, source-enforced downstream boundaries and raw reports. It found no identified production bypass. Profile uniqueness/composite FKs and current role/status/actor/route checks exist. Missing assertion paths remain coverage gaps; generic envelope authorization deliberately never invokes a resource business RPC. The actual is_active_tenant_member invited/no-member tests exercise a different helper from resource has_tenant_role. Existing parent-spoof insert denial is42501 on a foreign tenant ID; it does not supply a concrete foreign parent under an otherwise valid own-tenant checked resource request.

| Priority | Primary formal AC total | FULL | Coverage | Supplementary scenario total | FULL | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| P0 | 13 | 12 | 92% | 8 | 7 | 88% |
| P1 | 23 | 22 | 96% | 66 | 62 | 94% |
| P2 | 0 | 0 | 100% | 2 | 0 | 0% |
| P3 | 0 | 0 | 100% | 1 | 0 | 0% |

Primary: 34/36 FULL,2 PARTIAL,0 NONE; rounded FULL coverage94%. Supplementary: 69/77 FULL,5 PARTIAL,3 NONE; rounded FULL coverage90%. The5 partial named rows are RLS001(P0), RLS002/003 and DB001/002(P1) in14.1. NFR performance, manual contrast/daylight and exploratory charter are3 disclosed low-priority evidence gaps, not invented successful runs. Empty calendar click/drag is a separate receiving-owner obligation, not counted in either denominator.

Deduplicated mapped inventory:292 stable case/declaration identities across37 files; skipped/fixme/pending0/0/0. Detailed titles, source lines, flags, levels and report provenance are in the coverage matrix. Some parameterized source lines are null when no exact declaration line can be resolved; no line is invented. These are inventory identities, not a global pass-rate denominator.

### Quality and duplication assessment

Mapped engine/editor test bodies contain substantive literal/durable assertions. The inspected main editor/conflict/browser files are637/862/532 lines, contain no committed focus/fixme or waitForTimeout, and the final affected large HTTP case took40.545s. Browser18/19 diagnostic+separate1/1 same-build rerun is preserved; timeout adjustment is bounded90s and does not remove any HTTP/durable assertion. No repeated burn-in/stability percentage is available. No blanket all-tests quality certification or numeric code coverage is claimed. Resource/browser history includes unidentified partial fixtures from earlier Auth setup; those were not deleted or credited. Unit, actual SQL and browser layers protect different boundaries; no removal of distinct overlap is recommended.

Endpoint inventory is existing server actions plus checked RPCs, without an external provider contract. Missing resource RPC caller/parent negatives produce one auth heuristic gap; missing profile constraint branches produce one error heuristic gap. Retained UI journeys and loading/error/permission/unsent states have component/browser evidence. Mocked read tests and SSR/prefill structure do not claim SQL authority or real calendar execution.

Phase1 complete: the full matrix was saved to the exact temp path in frontmatter and a durable companion `epic-14/coverage-matrix.json`; Step5 must consume that unchanged matrix.

## Step 5 — Actual quality gate decision

**Gate type:** epic. **Eligibility:** true, allow_gate=true and COLLECTED. **Decision mode:** deterministic. **Decision: FAIL**.

P0 coverage is 92% (required:100%). One critical acceptance criterion,14.1-AC5, is PARTIAL. The concrete foreign-parent checked-resource path14.1-RLS-001(P0) is unexercised; caller/RPC negatives also remain partial. No waiver is applied.

| Gate criterion | Threshold | Actual | Status |
| --- | --- | --- | --- |
| P0 formal AC coverage |100%|12/13,92%|NOT_MET|
| P1 formal AC coverage |target90%,minimum80%|22/23,96%|MET|
| Overall formal AC coverage |minimum80%|34/36,94%|MET|

The named-design cross-check independently fails P0 coverage:7/8 FULL,88%. P1 named rows are62/66 FULL,94%; all77 rows are69 FULL,5 PARTIAL,3 NONE,90%. No PARTIAL, skip, unexecuted scaffold or transferred calendar portion was credited FULL. Rounded percentages follow the installed workflow; exact fractions are retained. The actual decision is coverage-driven; no gate waiver, release approval, review clearance or merged/hosted result is implied.

### Recorded execution evidence, not new executions

| Evidence | Recorded terminal counts / boundary |
| --- | --- |
| Current14.4 required integration |1461 total,1460 passed,0 failed,1 existing recovery Storage physical-loader skip; raw story14-4-r2-full-int.json; SUPABASE_TEST_REQUIRED=1|
| Current affected command/predecessor/RLS/schema subset |172 passed,0 failed,0 skipped; editor58,R1 fixes2,R2 fixes3,conflicts62,foundation16,replay12,bookingRLS6,schema13|
| Current14.4 units |2036 total,2035 passed,0 failed,1 existing Windows xattr skip|
| Final component/read boundary |27 passed,0 failed,0 skipped;14 structural component,13 mocked read action; independent SQL evidence separate|
| Same final build browser diagnostic |19 bodies,18 passed,1 failed,0 skipped,0 flaky;107.570s; inherited15s interceptor timeout before response|
| Same final build targeted large-review rerun |1 passed,0 failed,0 skipped,0 flaky;40.545s; bounded90s save interceptor;1120245bytes,HTTP200,1000 groups,select1,accepted1,open999,one booking/audit|
| Current14.3 full/affected |1368 total,1367 passed,0 failed,1 existing recovery skip;145 focused passed,including62 conflict cases;14 unit IDs,31 literal anchors,seven frozen matrix rows and allfour Contract C transfers pass|
|14.1 current cumulative boundary evidence|resources commands6,RLS2,cross-tenant189,anon191,role-harness9,H4inventory4 andschema13 files pass in current R2 report; only substantive mapped assertions receive coverage|
|14.1 recorded guarded browser |4 passed,0 failed/skipped; actual profile persistence, inactive history,phone failure/retry,precision/hidden shift preservation; older author-recorded evidence reused|

New product executions in this trace:0. Bounded reads, matrix generation and JSON validation are the only new commands. Static rerunnable artifacts are the evidence source; no live-results manifest exists. Current trace source is0d1ff3a3577f8f4fc742b13cf92fb28ff598eb62. Final14.4 source/test/config fingerprint f34ee23dc52a0f92f6de0ea24b0328946c5dbe96d1c6a34986abcef20e94712a over53 files and buildZtvjBbekFSgZQChOruaeT establish recorded build provenance. Post-build test-only bounded wait correction and later documentation corrections do not claim a new build/run. Full integration preceded a UI effect removal; final affected component/read and actual browser execution followed it.

Historical14.2 final report1305/1302/2/1 and14.3 earlier full/focused failures remain historical, not overwritten green. Earlier14.4 build900/select300 HTTP500 is a different input/build and its cause remains unknown; no identical-input counterfactual or19-pass single-run claim is made. Actual Next server actions serialize preview; reversed arrival is exercised in the production-state helper component boundary, separately from actual browser obsolete-response rejection. Local synthetic facts/signing do not prove hosted provisioning. No numeric line/branch coverage, approved performance/scalability or multi-run burn-in result is available.

### Required focused remediation

1. **14.1-AC5 /14.1-RLS-001(P0):** valid own-tenant authorized caller supplies a concrete foreign membership/profile to actual resource command/checkedRPC; denial and exact unchanged resource/audit snapshot.
2. **14.1-AC5 /14.1-RLS-002/003(P1):** direct authenticated lower-role RPC negatives; actual no-member/invited/disabled resource reads and checked writes; actual planner mutation positive. Retain existing generic envelope/route tests. No planner route/UI is required.
3. **14.1-AC2 /14.1-DB-001/002(P1):** duplicate raw person-profile insertion rejection; foreign/nonexistent default work-role writer rejection; exact count/state/audit no-op. Existing unique/composite FK guards are present; this requests assertion coverage, not speculative product fixes.

After those actual tests pass, re-map only the affected acceptance/test-design rows and evaluate this same deterministic gate. Mandatory empty-DB migration+seed+required integration Epic CI remains a separate pre-merge requirement and has not executed locally. Both existing skips are excluded from acceptance credit. Story14.1/14.2/14.4 follow-up review recommendations and draft-PR predicate remain unchanged by this trace. Review rounds are not restarted and no independent review clearance is claimed.

### Deferred evidence and receiving-owner work

Performance/scalability remain UNKNOWN pending approved thresholds/volumes; manual contrast/daylight and exploratory charter are unrecorded. Story15.1 retains actual calendar click/drag obligation with no execution credit. Resources remains active and scheduling pending; no PhaseC/E15 host or hosted action is authorized by this gate.

### Outputs and workflow validation

The exact Phase1 temp matrix was read, not regenerated, by Step5. Schema0.2.0 summary and schema0.1.0 gate JSON are parseable, contain all required buckets/decision fields, and link to this report. The full matrix and stable inventory are retained for deterministic re-gating. The terminal customization resolver succeeded and returned an empty workflow.on_complete; no terminal hook is configured.

**Displayed gate summary:FAIL — P0 coverage92%/required100%; P1 coverage96%; overall94%; one critical partialAC and one high partialAC; focused remediation above.**
