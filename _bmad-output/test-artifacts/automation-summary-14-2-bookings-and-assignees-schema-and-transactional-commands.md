---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests', 'step-03c-aggregate', 'step-04-validate-and-summarize']
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-10-06'
storyId: '14.2'
workflowType: 'testarch-automate'
mode: 'BMad-Integrated'
detected_stack: 'frontend'
selected_effort: 'high'
pact_mcp_reachable: false
inputDocuments:
  - 'AGENTS.md'
  - 'docs/process/agent-model-routing.md'
  - '_bmad/tea/config.yaml'
  - '_bmad-output/implementation-artifacts/spec-14-2-bookings-and-assignees-schema-and-transactional-commands.md'
  - '_bmad-output/test-artifacts/atdd-checklist-spec-14-2-bookings-and-assignees-schema-and-transactional-commands.md'
  - '_bmad-output/test-artifacts/test-design-epic-14.md'
  - 'vitest.config.ts'
  - 'playwright.config.ts'
  - 'package.json'
---

# Story 14.2 automation expansion

## Preflight

Rasmus, Create mode runs autonomously in BMad-integrated mode. Frameworks are ready: Node unit, Vitest integration/RLS, Playwright browser. The project detects as frontend from Next.js; this story exposes internal envelope/checked PostgreSQL RPC only. Source and acceptance authority are the completed spec and Contract C. Existing ATDD provides 18 retained checks plus three review regressions; original scaffold collection is historical discovery evidence, not current GREEN coverage.

Route: Sol 6.1 High for caller reauthorization, RLS and durable transaction integrity. No model change, resource launch, reset, schema/ledger edit, hosted action or spec mutation. Root owns the verified loopback API 55421/database 55422 and lifecycle.

Customization resolver returned native exit 1 because the uv cache is inaccessible. Manual base/team/user merge is permitted by the installed skill: base has empty prepend/append/persistent facts/on_complete; neither override file exists. Configuration loads successfully. Pact tool-list probe found no SmartBear tools. Pact broker: unreachable (SmartBear MCP tools not available). Source is available; no consumer-provider contract needs Pact. Playwright utilities apply to Playwright artifacts, and this story has no UI/HTTP endpoint. Existing Vitest fixtures remain the applicable mechanism.

Knowledge principles loaded: test levels, priorities, data factories, selective testing, CI burn-in, test quality, Playwright utility mandate and Pact MCP relevance/probe rules. Only mandatory or relevant material is applied; browser/contract mechanisms are inapplicable to the internal booking foundation.
## Coverage plan

| AC | Existing evidence | Expansion decision |
| --- | --- | --- |
| 1, 10 | Manifest/H4/exact-policy/matrix gates and author scope evidence | Preserve existing checks and mandatory pending scheduling/detector gate. |
| 2 | INT-001 exact booking/assignee/outcome/audit create | Adequate; avoid duplication. |
| 3 | INT-002 exact mutable replacement and immutable history | Adequate; avoid duplication. |
| 4 | INT-003/004/005 plus timestamp and concurrent-update regressions | Inspect completed UPDATE replay reauthorization after caller role/status revocation; existing INT-003 covers disabled actor CREATE replay only. |
| 5 | INT-006/007 preparation/audit exact rollback | Adequate; avoid duplication. |
| 6 | DB-001..005, INT-009, validation/DST units | Adequate; avoid duplication. |
| 7 | INT-010 unchanged disabled history/new assignment/lock race | Adequate; avoid duplication. |
| 8 | RLS-001 concrete foreign rows/direct writes/checked RPC/existence/privacy | Adequate; avoid duplication. |
| 9 | RLS-002..004 actual assignment scope, secondary-role revocation, fresh RPC authorization | Combine with AC4: real existing outcomes must remain inaccessible after actor role/status revocation. |

Selective coverage: internal command/RPC integration at P1, extending retained 14.2-INT-003/RLS-004 instead of inventing a release obligation. No browser/E2E/component/contract target exists. Worker may return zero added tests if the exact replay variant is already covered. No code-coverage percentage is inferred from assertion counts.

## Execution routing

Requested mode auto; capability probe enabled. Collaboration spawn is available; no distinct native agent-team interface exists. Resolved subagent. API worker Sol 6.1 High (authorization before stored outcomes, transactional integrity). E2E applicability worker Sol 6.1 Low (scope only); separate ownership, no production or spec writes. Synchronous completion barrier precedes aggregation and validation. Workflow worker JSON is retained under test-artifacts using one unique timestamp; no arbitrary temporary artifacts.
## Generated tests and aggregation

Both required workers succeeded. API source scrutiny confirmed completed UPDATE replay lacked actor authority regression evidence. Generated one Vitest file with three separately reported P1 scenarios: role downgrade with secondary grants removed, invited membership, disabled membership. Each commits a real UPDATE, proves its exact key/payload replays through envelope and checked RPC without state change, changes current actor authority, verifies denial through both paths with exact unchanged two-tenant booking/assignee/conflict/outcome/audit state, and restores actor state before fixture cleanup. Existing disabled CREATE replay coverage is preserved and not duplicated.

E2E applicability worker emits zero tests: no approved browser journey or booking entry exists. No backend worker is required for the detected frontend matrix; internal command/RPC scenarios use the established API-level Vitest mechanism. Zero new fixtures, mocks, packages, scripts or infrastructure. Existing UUID factories, snapshot helpers and cleanup are reused. Generated source was copied from validated worker JSON, not regenerated. No test execution occurred before aggregation.

Counts: 3 integration/API tests in one file; P0=0, P1=3, P2=0, P3=0; E2E/components/units=0 added. No coverage-percentage or performance-gain claim. Worker and aggregate JSON remain under test-artifacts for audit.
## Validation evidence

Final targeted command (with privately supplied SUPABASE_TEST_URL=http://127.0.0.1:55421, SUPABASE_TEST_DB_URL using loopback port 55422, dedicated test keys and SUPABASE_TEST_REQUIRED=1):

```powershell
pnpm exec vitest run tests/integration/commands/bookings-replay-authority.int.test.ts --reporter=json --outputFile=_bmad-output/test-artifacts/story14-2-automate-replay-authority-results.json
pnpm exec tsc --noEmit --incremental false
pnpm exec eslint tests/integration/commands/bookings-replay-authority.int.test.ts
```

Final focused run: **3 executed, 3 passed, 0 failed, 0 skipped/pending**, native exit **0**. TypeScript compile: native exit **0**. Targeted lint: native exit **0**. All three scenarios restore membership scalar role/status and any removed secondary role rows in finally before factory cleanup. This is real local command/RPC and durable database evidence, not a mock or schema-shape check.

Validation repair: initial focused run passed 3/3, but initial TypeScript compilation returned native exit 1: test.each did not expose the test context in the callback's second argument. Replaced only the declaration with the project's existing test.for pattern and synchronized generated worker JSON. The affected file was rerun once after that concrete change; all three passed, followed by clean TypeScript/lint. No assertions or stack gate were weakened, and no acceptance skip was added.

No full integration/unit/browser suite or optional burn-in was repeated in this phase. Root-provided earlier evidence is historical input: full integration 1293 passed/0 failed/1 intentional recovery Storage-loader skip, unit 1962 passed/0 failed/1 Windows-xattr skip. Those totals are not new runs of the expanded tree. Root continues required independent follow-up review and cumulative/epic gates.

## Files created

- tests/integration/commands/bookings-replay-authority.int.test.ts
- _bmad-output/test-artifacts/automation-summary-14-2-bookings-and-assignees-schema-and-transactional-commands.md
- _bmad-output/test-artifacts/tea-automate-api-tests-2026-10-06T-replay-authority.json
- _bmad-output/test-artifacts/tea-automate-e2e-tests-2026-10-06T-replay-authority.json
- _bmad-output/test-artifacts/tea-automate-summary-2026-10-06T-replay-authority.json
- _bmad-output/test-artifacts/story14-2-automate-replay-authority-results.json

## Assumptions and evidence limits

Existing isolated local schema/seed readiness is root-verified, with incrementally applied SQL. No new database, reset, migration history or resource was created; no actor adopts or stops the root's resources. The exact empty-schema migration/seed/required-integration CI chain remains mandatory at Epic finalization and is not claimed here. Scheduling stays pending; no detector, UI, entry point or stub was introduced. Story 14.3 retains derived-conflict create/update/refresh/current-row detection and conflict-stage rollback; transferred 14.3-INT-003/004/005/006 must pass before 14.4 or Epic PR. Performance/volume remain unmeasured. Historical quote-send time-current incidents remain unconfirmed despite the root's later full-green report; no repaired-cause claim is made.

The supplied spec and Suggested Review Order were not modified: the author owns its refresh. Optional scaffold skips in original ATDD collection are historical and are not counted as acceptance coverage. Coverage percentages are not measured.

## Playwright Utils deviations

None. This phase emits Vitest internal-command/RPC tests, with no Playwright artifact and no installed playwright-utils dependency. No auth-session, HAR/network-recorder, webhook or burn-in wiring is needed for these targets. Future browser workflows should apply the configured utilities when their runner/package relevance gates are satisfied.

## Pact.js Utils deviations

None; no contract artifacts or independent consumer/provider target exists.

## Definition of done and handoff

- [x] Framework/configuration/approved story and current ATDD inspected; AC mapping and meaningful uncovered variant recorded.
- [x] Sensitive nested API route uses Sol 6.1 High; scope-only E2E applicability uses Sol 6.1 Low; both outputs succeeded before aggregation.
- [x] Three separately reported P1 UPDATE replay tests generated, with real positive controls, stale-client denials, exact durable snapshots and actor restoration.
- [x] Existing UUID-isolated cleanup/factories reused; zero new fixtures, packages, scripts, mocks or resources.
- [x] Final focused run executed all three with zero skips; compile and targeted lint passed; no hard waits or debug logging.
- [x] Generated source and worker/aggregate/result JSON retained under test-artifacts; no browser session was opened.
- [x] Completed summary polished; no spec/product/Git changes or unrelated broad tests.

Outcome: automation expansion complete. Open questions and blockers: none. Recommended next workflow: root's required independent follow-up review, with author-owned review trail/evidence refresh if needed; continue Story 14.3 under Contract C and retain exact empty-chain CI as the Epic gate. No additional test expansion is recommended for this phase.