---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-09-20'
storyId: '12.2'
storyKey: spec-12-2-operator-console
storyFile: C:/DEV/ElproSaas/_bmad-output/implementation-artifacts/spec-12-2-operator-console.md
atddChecklistPath: C:/DEV/ElproSaas/_bmad-output/test-artifacts/atdd-checklist-spec-12-2-operator-console.md
generatedTestFiles:
  - C:/DEV/ElproSaas/tests/unit/provisioning/operator-console.test.ts
  - C:/DEV/ElproSaas/tests/integration/read-models/operator-console.int.test.ts
  - C:/DEV/ElproSaas/tests/integration/rls/platform-operators.rls.test.ts
  - C:/DEV/ElproSaas/tests/unit/scripts/verify/check-operator-console-isolation.test.ts
  - C:/DEV/ElproSaas/tests/e2e/auth/operator-console.atdd.e2e.spec.ts
inputDocuments:
  - C:/DEV/ElproSaas/_bmad-output/implementation-artifacts/spec-12-2-operator-console.md
  - C:/DEV/ElproSaas/_bmad-output/test-artifacts/test-design-progress-epic-12.md
  - C:/DEV/ElproSaas/package.json
  - C:/DEV/ElproSaas/playwright.config.ts
  - C:/DEV/ElproSaas/_bmad/tea/config.yaml
  - C:/DEV/ElproSaas/tests/factories/platform-operators.ts
  - C:/DEV/ElproSaas/tests/integration/commands/provision-tenant.int.test.ts
  - C:/DEV/ElproSaas/tests/integration/rls/platform-operators.rls.test.ts
  - C:/DEV/ElproSaas/tests/e2e/auth/admin-user-management.atdd.e2e.spec.ts
  - C:/DEV/ElproSaas/tests/support/stack-gate.ts
---

# Story 12.2 — Operator Console: ATDD Checklist

## Preflight and context

- Story status is `ready-for-dev`; its acceptance criteria are explicit.
- Detected stack: fullstack (Next.js frontend, Supabase-backed server and integration suites, and configured Playwright E2E).
- Existing fixtures and protocol coverage from Story 12.1 will be reused; no duplicate provisioning-protocol test is planned.
- The application has no `operator/**` implementation at this red phase. Generated tests use approved target paths and semantic contract names from the story; implementation-dependent browser selectors remain assertion targets, not invented observed selectors.
- `tea_use_playwright_utils` is enabled in TEA configuration, but `@seontechnologies/playwright-utils` is absent from `package.json`; its mandate does not bind generated code. No dependency is added in this ATDD phase.
- `tea_use_pactjs_utils` is enabled, but no provider/consumer contract change is in scope. Pact tests are not relevant.
- `tea_pact_mcp` is configured, but no Pact artifact is in scope; no broker query was made.
- Required local Supabase evidence is intentionally not executed before implementation. Any later DB-backed run must use `SUPABASE_TEST_REQUIRED=1`; dynamic skip scaffolds remain visibly skipped when the stack is optional.

## Loaded test conventions

- Unit and integration suites use Vitest. DB-backed tests use `skipUnlessStack` so an unavailable optional local stack is reported as skipped, while `SUPABASE_TEST_REQUIRED=1` hard-fails.
- Browser tests use the configured production build/start server, never `next dev`.
- Existing E2E fixtures are read from `tests/e2e/.auth/fixture.json`; Story 12.2 requires an operator fixture extension during implementation before its browser scaffold can execute.
- Semantic roles, labels, and explicit server-confirmed state are preferred. No hard waits or browser-history-derived assertions are allowed.

## Generation mode

AI generation selected. The acceptance criteria are explicit, while the `operator/**` route and its selectors do not exist yet; browser recording would only invent evidence. Red-phase browser checks will use semantic Swedish names specified by the story and flag implementation-time fixture/selector validation.

## Test strategy

| ID | Priority | Level | Red-phase scenario |
| --- | --- | --- | --- |
| 12.2-UNIT-001 | P0 | Unit/read model | Exact console DTO allow-list keeps tenant name, canonical organisation identity, provisioning state, created time, and first-Admin state while rejecting or discarding business/secret/protocol canaries. |
| 12.2-UNIT-002 | P1 | Unit | Wizard/resume state is derived only from safe durable server state across fresh, previewed, approved, pending/failed/requested/unknown/ready, completed, and replayed states. |
| 12.2-INT-001 | P0 | Integration | Each list, detail, preview, provision, reconciliation, and retry entry independently gates the allow-listed operator; every denied identity receives one generic result with zero read/write/audit/provider side effects. |
| 12.2-INT-002 | P0 | Integration | Projection and response construction exclude tenant A/B customer, quote, file, money, membership, raw hash, token, attestation, audit, aliased, and nested canaries; direct base-table paths disclose no existence signal. |
| 12.2-STATIC-001 | P0 | Static | `operator/**` is outside tenant shell/navigation/context and every entry invokes the operator gate. |
| 12.2-E2E-001 | P1 | Browser | Allow-listed operator reaches isolated `/operator`; tenant Admin and anonymous direct routes receive generic denial, with no tenant shell or business-data output. |
| 12.2-E2E-002 | P1 | Browser | Swedish three-step flow keeps preview zero-write, needs hash-bound explicit approval, and reconstructs reload/new-context/replay status from persisted safe state. |
| 12.2-E2E-003 | P2 | Browser/accessibility | Headings, labels, focus, validation/status feedback, pending state, and keyboard flow remain semantic and server-confirmed. |

The red phase uses deliberately skipped `test.skip()` scaffolds. It creates no active test and no product implementation; an unskipped scenario must fail first before its implementation task turns it green.

## Red-phase scaffolds

All 13 scaffold cases are deliberately skipped. They preserve the required expected assertions while Story 12.2 has no route, read model, server actions, local-Supabase fixtures, or static scanner to import. Each Vitest/node scaffold uses a typed red-phase seam placeholder so skipped tests compile; the implementation task replaces that one placeholder with its public test hook or fixture before activating the corresponding case.

| Path | Cases | State |
| --- | ---: | --- |
| `tests/unit/provisioning/operator-console.test.ts` | 2 | skipped P0/P1 unit contracts |
| `tests/integration/read-models/operator-console.int.test.ts` | 2 | skipped P0 local-Supabase read-model contracts |
| `tests/integration/rls/platform-operators.rls.test.ts` | 2 appended | skipped P0 independent-entry/RLS contracts; existing 12.1 coverage preserved |
| `tests/unit/scripts/verify/check-operator-console-isolation.test.ts` | 2 | skipped P0 static-isolation contracts |
| `tests/e2e/auth/operator-console.atdd.e2e.spec.ts` | 5 | skipped P1/P2 production-server browser contracts |

### Acceptance-criteria traceability

| Acceptance criterion | Scaffold evidence |
| --- | --- |
| Operator-only isolated layout and exact projection | 12.2-UNIT-001, 12.2-INT-001/002, 12.2-STATIC-001, 12.2-E2E-001 |
| Same generic denial and zero effects for every denied identity/entry | 12.2-INT-001, 12.2-E2E-001 |
| Three Swedish steps, preview-only baseline facts, and explicit approval | 12.2-E2E-002 |
| Dry preview is zero-write; malformed/stale input cannot reach approval | 12.2-INT-001 entry probe and 12.2-E2E-002 activation target |
| Server-confirmed provision and replay reconciliation | 12.2-UNIT-002 and 12.2-E2E-002 |
| Reload/new context derives allowed action from durable safe state | 12.2-UNIT-002 and 12.2-E2E-002 |
| Truthful requested/unknown/failed/ready handoff labels and fresh approval on attempt four | 12.2-UNIT-002 and 12.2-E2E-002 |
| No canary in DTO, errors, markup, or browser payload | 12.2-UNIT-001, 12.2-INT-002, 12.2-E2E-001 |

## Implementation activation checklist

1. Implement the isolated `operator/**` boundary, the independent platform gate, and the safe read model. Replace only the matching unit/read-model scaffold placeholders, unskip them, and first observe RED.
2. Extend Story 12.1's test factory with cleanup-aware operator, denied-identity, direct-entry, and tenant A/B nested/aliased canary fixtures. Activate the two integration files with `SUPABASE_TEST_REQUIRED=1`; required DB coverage must report zero skips.
3. Add `scripts/verify/check-operator-console-isolation.mjs`, wire its fixture inputs, and activate the static scanner tests.
4. Add cookie-bound operator and tenant-Admin E2E sessions plus a server-created durable handoff fixture. Verify the final Swedish accessible names against the implemented production build, replace only unresolved semantic locators, and activate the browser cases against the configured Playwright production server.
5. Keep preview transport transient and write-free. After activating a case, make it fail against incomplete implementation, implement the narrow behavior, then make it pass before moving to the next case.

## Fixture and selector requirements

- `allowListedPlatformOperatorSession`: cookie-bound identity revalidated through `is_platform_operator()`.
- `tenantAdminWithoutPlatformOperatorSession`: a tenant role with no platform allow-list row.
- `persistedOperatorProvisioningState`: a cleanup-aware safe detail URL backed by server-confirmed provisioning/handoff state.
- `operatorConsoleEntryProbe`: direct list/detail/preview/provision/reconcile/retry and base-table attempts with validation, audit, provider, mutation, and existence counters.
- Finalize the generic-denial accessible name, console heading, detail/resume route, company/contact labels, baseline preview/approval control, reconciliation control, and pending text from the shipped UI. The three supplied step headings are already asserted: `Företagsuppgifter`, `Baslinje`, and `Bjud in första Admin`.

## Library and contract decisions

- Playwright Utils: configuration flag is true but `@seontechnologies/playwright-utils` is not installed, so the two-gate mandate does not apply. The E2E scaffold uses the project’s existing `@playwright/test` convention and has no application transport to intercept yet.
- Pact: N/A. Story 12.2 adds server actions/read models around the existing Story 12.1 command, not a consumer/provider HTTP contract.
- No data factory, Playwright fixture, mock transport, browser session, database resource, or product code was created in this red phase. Requirements are recorded above for the corresponding activation task.

## Execution and evidence

Run after each activation:

```powershell
pnpm vitest run tests/integration/read-models/operator-console.int.test.ts tests/integration/rls/platform-operators.rls.test.ts
$env:SUPABASE_TEST_REQUIRED = '1'; pnpm vitest run tests/integration/read-models/operator-console.int.test.ts tests/integration/rls/platform-operators.rls.test.ts
pnpm run test:e2e -- tests/e2e/auth/operator-console.atdd.e2e.spec.ts
pnpm lint; pnpm typecheck; pnpm run verify:service-role-containment
```

The first integration command is only a local scaffold/listing aid. Required DB evidence is exclusively the second command with `SUPABASE_TEST_REQUIRED=1`; record passed, failed, and skipped counts. Run the E2E command only after the operator fixture and route exist; configured Playwright starts the production build/server, never `next dev`.

## Validation status

- TDD structural check: PASS. The five generated/extended files contain 13 `test.skip()` cases (2 unit, 2 read-model integration, 2 appended RLS, 2 static, 5 E2E); no `expect(true).toBe(true)`, `page.waitForTimeout`, or application `page.route` pattern was emitted.
- Focused node runners: `tests/unit/provisioning/operator-console.test.ts` and `tests/unit/scripts/verify/check-operator-console-isolation.test.ts` each reported 0 passed, 0 failed, 2 skipped. These skips are deliberate red-phase scaffolds.
- Focused integration runner: `pnpm vitest run tests/integration/read-models/operator-console.int.test.ts` reported 0 passed, 0 failed, 2 skipped. The required-mode rerun with `SUPABASE_TEST_REQUIRED=1` reported the same 0 passed, 0 failed, 2 skipped because both cases remain explicitly skipped before a DB call. It is not DB/RLS coverage evidence.
- Browser runner: `pnpm exec playwright test --list tests/e2e/auth/operator-console.atdd.e2e.spec.ts` discovered five red-phase cases. No browser/server was launched and no E2E body executed, because all five retain `test.skip()` until the `/operator` surface and safe fixtures exist.
- Executed Story 12.2 product-test bodies: 0 passed, 0 failed. Deliberately skipped scaffolds: 13. No skipped scaffold is counted as coverage.
- Story linking: intentionally omitted. The task requires artifact links only in this checklist; the ready-for-dev story specification was not modified.

## Completion handoff

Primary levels are unit/integration/static for P0 isolation and data-exposure invariants, with thin P1/P2 production-server E2E coverage for the operator journey and accessibility. The next workflow is the Story 12.2 implementation task: activate the matching scaffold in small increments, observe its expected RED failure, implement the narrow behavior, and retain the result as GREEN evidence. Estimated activation effort is governed by the implementation story; no estimate is invented by this test-design phase.
