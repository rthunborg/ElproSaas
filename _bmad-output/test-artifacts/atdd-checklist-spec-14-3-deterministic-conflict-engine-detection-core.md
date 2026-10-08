---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-10-06'
storyId: '14.3'
storyKey: 'spec-14-3-deterministic-conflict-engine-detection-core'
storyFile: '_bmad-output/implementation-artifacts/spec-14-3-deterministic-conflict-engine-detection-core.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-spec-14-3-deterministic-conflict-engine-detection-core.md'
generatedTestFiles: ["tests/integration/commands/booking-conflicts.int.test.ts", "tests/unit/features/scheduling/conflicts.test.ts", "tests/unit/features/scheduling/capacity.golden.test.ts", "tests/unit/features/scheduling/dst.golden.test.ts"]
inputDocuments: ['AGENTS.md', 'docs/process/agent-model-routing.md', 'docs/decisions/epic-14-story-ownership-contract-c-2026-10-06.md', '_bmad-output/implementation-artifacts/spec-14-3-deterministic-conflict-engine-detection-core.md', '_bmad-output/test-artifacts/test-design-epic-14.md', '_bmad/tea/config.yaml', 'package.json', 'vitest.config.ts', 'playwright.config.ts', 'tests/support/bookings-atdd.ts']
---
# ATDD checklist: Story 14.3

Rasmus, this autonomous Create run uses the approved ready-for-dev spec and Contract C. All 9 tasks and 12 ACs remain unchanged. The Next/React repository detects as frontend, while this story is a backend foundation; use the existing Node test runner for pure engine/golden checks and Vitest for real command/database cases. No browser or UI entry is in scope.

## Preflight and generation mode

Framework and environment are available. Root owns the verified local Compose stack at API 55421 / DB 55422. No launch, migration, reset, hosted service or secret change is authorized here. AI generation is selected because the requirements describe pure functions and authoritative transaction boundaries. Existing booking command/envelope, tenant factories and exact durable snapshot helpers supply provider source evidence. New engine/snapshot/finalize exports and signed-proof binding must be aligned to the final author implementation; no guessed HTTP endpoint is needed.

Playwright Utils: configured true, dependency absent, and no generated suite uses Playwright; mandate is inapplicable. Pact relevance: closed (internal SQL command boundary, no microservice consumer contract); no Pact artifacts. Tool-list probe once: SmartBear/Pact MCP absent; pact_mcp_reachable=false, fallback=provider-source. No broker call.

Core knowledge read: data-factories, component-tdd, test-quality, test-healing-patterns, confidence-gate, evidence-integrity. Also reviewed selector-resilience, timing-debugging, playwright-utils-mandate, overview, api-request, auth-session, recurse, fixture-architecture, network-first, pact-mcp, pactjs-utils-mandate and playwright-cli. Browser knowledge is not used to invent a journey.

## Strategy

Preserve all 14.3-UNIT-001..014 and 14.3-INT-001..006 IDs and original priorities. AC1-4 map to pure/golden checks; AC5-9 map to the six real-command integration obligations; AC10-11 require additional current-fact writer race, replay authority, attestation and ACL negatives; AC12 requires named immutable regression fixtures and retained scope gates. Tests assert expected domain output and exact durable state rather than mocked detector output. New golden values are labelled new-expected, never attributed to Lovable.

Transferred gate: 14.3-INT-003 (P0 create conflict atomicity), 004 (P1 replacement/peer refresh), 005 (P1 post-conflict rollback), 006 (P0 post-preview current-fact detection) all execute and pass before any 14.4 work or Epic PR. Skipped scaffolds never satisfy this gate.

Each scaffold stays test.skip until its implementation task activates it. Focused collection proves discovery only; no executed RED or GREEN acceptance claim. Missing production behavior provides the expected RED upon activation; fixture binding or infrastructure failures are missing evidence, not RED domain coverage.

## Dispatch routes

Capability probe: collaboration subagent tools are exposed, no agent-team tool; auto resolves to subagent if launch succeeds. API/transaction worker: gpt-6.1-sol High (tenant/actor proof, RLS, current-fact gate, atomic commit/rollback). Pure unit generation and E2E applicability were classified ordinary; the second Low child launch was refused by the host completed-thread limit. Root confirmed this current delegate was explicitly gpt-6.1-sol High and authorized sequential fallback; actual execution remains High, no session reconfiguration claimed. No timing or parallel gain estimate is fabricated.


## Acceptance traceability

| Check | Priority | AC | Required assertion |
| --- | --- | --- | --- |
| 14.3-UNIT-001 | P0 | 1 | Exact shared-person pair/window, stable key |
| 14.3-UNIT-002 | P1 | 1,4 | Half-open adjacency and microsecond overlap |
| 14.3-UNIT-003 | P1 | 1,4 | Only colliding people; permutation bytes |
| 14.3-UNIT-004 | P0 | 2,3 | Positive overrun warns regardless of injected threshold |
| 14.3-UNIT-005 | P1 | 2 | Exact out-of-shift windows, empty/malformed schedule |
| 14.3-UNIT-006 | P1 | 2 | Split shifts/breaks and overlap identity |
| 14.3-UNIT-007 | P1 | 3 | Supplied/absent access windows |
| 14.3-UNIT-008 | P1 | 3 | Required/matching work-role input |
| 14.3-UNIT-009 | P1 | 4 | Spring first-valid,23/71-hour bounds |
| 14.3-UNIT-010 | P1 | 4 | Fall earlier-fold,microseconds,25/73-hour bounds |
| 14.3-UNIT-011 | P1 | 4 | Frozen repeated sorted bytes, no common clock/I/O |
| 14.3-UNIT-012 | P0 | 2 | Six terms,union subtraction,holiday layers,actual80%schedule |
| 14.3-UNIT-013 | P1 | 3 | Explicit overtime rule data |
| 14.3-UNIT-014 | P1 | 12 | Immutable named synthetic miss/phantom regression pack |
| 14.3-INT-001 | P1 | 5 | Internal preview/actual-save sole-engine equivalence |
| 14.3-INT-002 | P1 | 6 | Stale finalize no-op; refreshed digest/collision |
| 14.3-INT-003 | P0 | 7,11 | Exact create/conflicts/assignments/outcome/one audit; proof/ACL matrices |
| 14.3-INT-004 | P1 | 8 | Peer refresh,accepted key preservation,new open keys,cancellation |
| 14.3-INT-005 | P1 | 9 | Create/update post-conflict/audit exact rollback |
| 14.3-INT-006 | P0 | 6,10 | Same UUID current-fact refresh; writer/race/replay/revocation matrices |

AC10/11 remain nested under named INT006/003: 14 race/current-authority and 29 proof/schema/ACL subcases. Collection counts only six top-level integration scaffolds; author records every nested scenario executed separately. Exactly20 named obligations remain.

## Generated files and provider bindings

Three Node unit files hold14 skipped checks; one Vitest file holds6. Four golden packs are synthetic new-expected data. `scheduling-atdd.ts` contains pure data factories, freeze/golden reading and fail-loud production imports; it implements no engine. `booking-conflicts-atdd.ts` contains lazy real fixtures, writer calls, exact readbacks, lock barriers and correlation-scoped owner-only local faults. No app path imports these helpers.

Author binds actual typed detectConflicts/calculateCapacity/Stockholm/holiday exports and output fields. Integration loadConflictBindings throws ATDD_BINDING_REQUIRED until actual snapshot/finalize/preview/signing/command observation and SQL inventory are bound. Instrumentation must observe actual command calls without replacing RPCs, facts, detector, signatures or responses. Final new RPC signatures and invitation verified-email fixture come from actual source. Work-role display-name-only edits excluded from facts may coherently finalize; consumed fact edits require stale rejection. Optional unavailable job inputs imply no verified competence/access. Regression packs describe expected boundaries, not previously fixed production defects.

## Implementation checklist and activation

- [ ] Task1: bind frozen contracts and sole pure detector/capacity/time/central holiday helpers; activate UNIT001..013 RED then GREEN.
- [ ] Task2: preserve four golden packs, exact UTC fractions, actual schedules, union subtraction and permanent named UNIT014 regressions.
- [ ] Tasks3-4: checked attested snapshot/finalize, full digest and common first gate for every consumed writer; seal legacy fresh paths; preserve current authority.
- [ ] Task5: real create/update and internal preview share one engine, at most3 stale attempts under original command UUID.
- [ ] Task6: bootstrap matching explicitly synthetic private local/CI key/Vault via existing setup, missing-key fail-closed. ATDD edits no actual.env/seed/productionsecret.
- [ ] Task7: activate six INT checks and all nested matrices; exact full durable readbacks, no mock detector/provider success.
- [ ] Task8: retain32 booking/authority/RLS cases, new exact ACL/search-path inventory and scope/policy gates. Resources active; scheduling pending; no14.4/UI/E15/PhaseC.
- [ ] Task9: author records executed/passed/failed/skipped at tested revision and final Suggested Review Order. All four transfers003/004/005/006 pass before14.4/EpicPR.

Remove test.skip only for the current task. Bind real source, observe missing-domain RED, implement GREEN, then refactor preserving assertions. Fixture binding/service failure is missing evidence, never domain RED. The spec stays unchanged by this delegate; its author manually links this checklist/generatedTestFiles. No historic author trail is backfilled. Estimates are author planning work; no invented hours/points.

## Verification commands and remaining gates

```powershell
node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/features/scheduling/conflicts.test.ts tests/unit/features/scheduling/capacity.golden.test.ts tests/unit/features/scheduling/dst.golden.test.ts
pnpm exec vitest run tests/integration/commands/booking-conflicts.int.test.ts --reporter=json --outputFile=_bmad-output/test-artifacts/atdd-story14-3-integration-collection-results.json
pnpm exec tsc --noEmit --incremental false
```

Integration command requires explicit private SUPABASE_TEST_URL/DB_URL/ANON_KEY/SERVICE_ROLE_KEY for verified loopback55421/55422 and REQUIRED=1. No inherited54321/hosted target. Focused skipped collection executes zero acceptance. Implementation later runs activated/cumulative integration/RLS/unit/type/lint/build/containment gates. Empty-chain migration CI remains mandatory at Epic finalization; no new local reset/ledger change here. Functional scaffolds imply no performance certification.

UI/component/E2E/selectors/data-testid/headed/debug browser commands: N/A (foundation). HTTP/Pact/external mocks: N/A (internal real Postgres commands). Playwright merged fixtures/Faker: N/A (Node/Vitest and existing crypto UUID factories); no packages added. No browser/server/resource started, no teardown needed; root retains shared lifecycle.

## Aggregation validation

- [x] Approved spec/ContractC/framework/provider knowledge loaded; metadata/handoff populated.
- [x] API/E2E/unit outputs succeed; all20 named IDs and20 test.skip declarations; meaningful expected-domain assertions.
- [x] Worker source content matches metadata after normal CRLF normalization; no active placebo test.
- [x] APIHigh worker completed; second-child host refusal and root-confirmed currentHigh sequential fallback recorded.
- [x] Focused collection/typecheck evidence recorded below.
- [ ] Executed RED/GREEN and mandatory transfer gate remain implementation work.


## Final verification evidence

HEAD: ad4642a1317251be2f7ba32a22908d5e656bf4fc. Spec diff empty; only authorized tests/TEA files added. Native Node collection0:14 collected/0 passed/0 failed/14 skipped. Native required Vitest collection0:6 collected/0 passed/0 failed/6 pending, exact explicit local55421/55422. Combined20 skipped scaffolds, zero executed acceptance. File-level runner PASS means successful skipped discovery only. Nested43 authority subcases are not executed by collection.

Typecheck initially native2 with3 scaffold promise typing errors; repair eagerly normalizes the started RPC to Promise<Awaited<RPC>>, preserving real transaction and assertions. Final tsc native0, no output. Initial errors are retained separately. Collection preceded this typing-only repair inside a skipped body; final typecheck validates repaired source. No executed domain RED/GREEN or readiness claim.

Evidence: `atdd-story14-3-unit-collection-results.tap`, `atdd-story14-3-integration-collection-results.json`, `atdd-story14-3-typecheck-initial-errors.txt`, `atdd-story14-3-typecheck-results.txt`, worker API/unit/E2E JSON and `tea-atdd-summary-story14-3-2026-10-06.json`, all under test-artifacts. Summary contains absolute changed paths and exact native counts.

Validation completed against skill checklist: prerequisites, provider/knowledge inputs,20 IDs/priorities, meaningful skipped expected behavior, data fixtures/cleanup, manual story link, activation/refactor guidance, applicable commands and metadata. Browser/component/mock/testid/estimate template sections explicitly N/A. No child still running; no detached work or owned resource created. Independent review and all executed acceptance/cumulative/empty-chain gates belong to subsequent build/automation/review and Epic finalization.

Outcome: complete ATDD scaffold/checklist handoff. Open business questions/blockers: none. Provisional source bindings remain concrete author tasks. Next workflow is the root's Story14.3 build, then automation and independent review. Mandatory transfers003/004/005/006 remain unexecuted and gate14.4/EpicPR.
