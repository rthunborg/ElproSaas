---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-09-23'
storyId: '13.1'
storyKey: spec-13-1-authenticated-background-runner-and-producer-registry
storyFile: C:/DEV/ElproSaas/_bmad-output/implementation-artifacts/spec-13-1-authenticated-background-runner-and-producer-registry.md
atddChecklistPath: C:/DEV/ElproSaas/_bmad-output/test-artifacts/atdd-checklist-spec-13-1-authenticated-background-runner-and-producer-registry.md
generatedTestFiles:
  - C:/DEV/ElproSaas/tests/unit/server/jobs/route-auth.test.ts
  - C:/DEV/ElproSaas/tests/unit/server/jobs/producer-registry.test.ts
  - C:/DEV/ElproSaas/tests/unit/server/jobs/runner.test.ts
  - C:/DEV/ElproSaas/tests/integration/jobs/job-runs.int.test.ts
  - C:/DEV/ElproSaas/tests/unit/scripts/verify/jobs-service-role-containment.test.ts
inputDocuments:
  - C:/DEV/ElproSaas/_bmad-output/implementation-artifacts/spec-13-1-authenticated-background-runner-and-producer-registry.md
  - C:/DEV/ElproSaas/package.json
  - C:/DEV/ElproSaas/playwright.config.ts
  - C:/DEV/ElproSaas/_bmad/tea/config.yaml
  - C:/DEV/ElproSaas/src/scope/manifest.ts
  - C:/DEV/ElproSaas/tests/integration/rls/tenant-table-inventory.ts
  - C:/DEV/ElproSaas/tests/unit/scripts/verify/service-role-containment.test.ts
  - C:/Users/Rasmus/.agents/skills/bmad-testarch-atdd/resources/knowledge/data-factories.md
  - C:/Users/Rasmus/.agents/skills/bmad-testarch-atdd/resources/knowledge/test-quality.md
  - C:/Users/Rasmus/.agents/skills/bmad-testarch-atdd/resources/knowledge/test-levels-framework.md
  - C:/Users/Rasmus/.agents/skills/bmad-testarch-atdd/resources/knowledge/test-priorities-matrix.md
---

# Story 13.1 — Authenticated Background Runner and Producer Registry: ATDD Checklist

## Preflight and context

- Story status is `ready-for-dev`; the five acceptance criteria are explicit.
- Detected stack: fullstack. The repository has a Next.js application, Supabase-backed integration suites, Node/Vitest unit and integration coverage, and configured Playwright E2E.
- The sole proposed entry point is `POST /api/jobs/run`. It is a server-only scheduler lane authenticated by a current or eligible previous `CRON_SECRET`; there is no user-facing surface in this story.
- `tea_use_playwright_utils`, `tea_use_pactjs_utils`, and Pact MCP are enabled in TEA configuration. Playwright utilities are not a project dependency and the story changes no external consumer/provider contract, so no utilities or Pact tests were introduced. Pact broker access was not needed.
- Required database evidence is deferred until implementation. When the integration scaffold is activated, it must run with `SUPABASE_TEST_REQUIRED=1`; explicit red-phase skips do not count as RLS coverage.

## Generation mode

AI generation selected. The acceptance criteria specify the route, security boundary, operational log, and deterministic runner behavior while the route, jobs runtime, and `job_runs` migration do not exist. Browser recording was not used because Story 13.1 intentionally has no UI, selector, or user journey to record.

## Test strategy

| ID | Priority | Level | Red-phase scenario |
| --- | --- | --- | --- |
| 13.1-UNIT-001 | P0 | Unit/route | Missing, wrong, JWT-shaped, forged, and `alg:none` credentials return the same generic 401 before dispatch, DB creation, audit, run-log, notification, or outbox effects. |
| 13.1-UNIT-002 | P0 | Unit/route | Current and eligible previous secrets dispatch exactly once; expired previous value is rejected without effects and success output contains no secret. |
| 13.1-UNIT-003 | P0 | Unit/registry | Typed producer declarations derive only from active manifest modules; pending modules and placeholder categories produce no live registry/category. |
| 13.1-UNIT-004 | P0 | Unit/runner | Injected deadline/chunk persist resumable progress, scope every operation to the current tenant, and preserve deterministic round-robin fairness. |
| 13.1-UNIT-005 | P1 | Unit/runner | Producer failure is isolated in a failed/partial outcome with bounded, sanitized error information. |
| 13.1-INT-001 | P0 | Integration/RLS | Fresh reset verifies `job_runs` force-RLS, explicit grants, constraints, index, and H4/manifest enrollment. |
| 13.1-INT-002 | P0 | Integration | Contained service writes create an attributable run plus a null-actor, producer-named, correlated system audit; client mutations remain forbidden. |
| 13.1-INT-003 | P1 | Integration/RLS | Tenant A cannot read or mutate Tenant B's job run or related system audit. |
| 13.1-STATIC-001 | P0 | Static | The permanent containment scanner rejects a client-reachable `src/server/jobs/service-client` import. |
| 13.1-STATIC-002 | P0 | Static | The scanner rejects unverified JWT claim reads and alternate runner lanes such as Edge Functions or `pg_cron`. |

The red phase has 13 deliberately skipped cases. Each case uses a typed red-phase seam that throws only when the case is activated; this lets the scaffold compile before implementation without manufacturing a client, migration, route, or database fixture. During implementation, replace only the matching seam with the real public test hook, remove that case's `test.skip`, observe RED, then implement the narrow behavior to GREEN.

## Red-phase scaffolds

| Path | Cases | State |
| --- | ---: | --- |
| `tests/unit/server/jobs/route-auth.test.ts` | 3 | skipped P0 route authentication contracts |
| `tests/unit/server/jobs/producer-registry.test.ts` | 2 | skipped P0 manifest registry contracts |
| `tests/unit/server/jobs/runner.test.ts` | 3 | skipped P0/P1 runner budget, tenant, and sanitization contracts |
| `tests/integration/jobs/job-runs.int.test.ts` | 3 | skipped P0/P1 migration, audit, and RLS contracts |
| `tests/unit/scripts/verify/jobs-service-role-containment.test.ts` | 2 | skipped P0 permanent-guard bite contracts |

No E2E file was generated: a browser test would invent a live UI surface that the story expressly excludes. Route, unit, integration, catalog, and static containment coverage supply the appropriate acceptance evidence.

### Acceptance-criteria traceability

| Acceptance criterion | Scaffold evidence |
| --- | --- |
| Invalid credential forms yield the same generic 401 with zero effects | 13.1-UNIT-001 |
| Current and eligible previous rotation secrets dispatch once; expired secret fails cleanly | 13.1-UNIT-002 |
| Active-only typed producer registry; no pending or placeholder category | 13.1-UNIT-003 |
| Bounded/resumable deterministic work preserves tenant scope, fairness, audit attribution, and sanitization | 13.1-UNIT-004/005, 13.1-INT-002/003 |
| Fresh reset `job_runs` schema, grants, force-RLS, and H4 catalog contract | 13.1-INT-001 |
| Client-reachable service client and forbidden JWT/execution patterns fail permanent guards | 13.1-STATIC-001/002 |

## Implementation activation checklist

1. Implement the jobs-private service client, constant-behavior secret verifier, and the sole route. Replace the matching route seam, unskip one case at a time, and first observe its expected RED result.
2. Activate the notifications manifest entry with only `job_runs`, add the typed empty producer registry, and activate the registry cases. Do not add a category, notification, preference, outbox, or email surface.
3. Implement injected clock, chunk, deadline, and cursor seams in the runner. Activate the deterministic runner cases with recording fakes before wiring any database work.
4. Add the migration and cleanup-aware two-tenant job-run harness. Activate integration cases with `$env:SUPABASE_TEST_REQUIRED = '1'`; required evidence must show zero required skips.
5. Extend the existing service-role containment scanner and activate the two bite tests using temporary trees. Include built-output scanning where the permanent guard exposes it.
6. Run the matching tests after each activation. Keep each activated test red until the narrow implementation is present, then retain green evidence before activating the next case.

## Fixture requirements

- A route dependency factory with fixed clock and counters for database-client creation, dispatch, audit, run-log, notification, and outbox effects.
- A runner fake that records `tenant_id` for every query and write, tracks persisted cursors, and can fail a named producer with sensitive text.
- A cleanup-aware two-tenant integration harness that can create a contained service context and authenticated tenant clients.
- A fresh-reset catalog inspector for `job_runs` constraints, grants, FORCE ROW LEVEL SECURITY, policies, and indexes.
- A temporary source-tree helper for service-role containment scanner bite tests.

No shared data factory or browser fixture was created in red phase. The existing test factory and stack-gate conventions should be extended only when the activated integration cases need them.

## Library and contract decisions

- Playwright utilities: configuration is enabled but the project does not install the package, and the story has no browser flow.
- Pact: N/A. `POST /api/jobs/run` is an internal application route and the story adds no external consumer/provider integration.
- Pact MCP: N/A. No broker state or contract was required.
- No database resource, route, service client, migration, application code, or deployment configuration was created by this ATDD workflow.

## Execution and evidence

Run after each activation:

```powershell
pnpm test:unit -- tests/unit/server/jobs/route-auth.test.ts tests/unit/server/jobs/producer-registry.test.ts tests/unit/server/jobs/runner.test.ts tests/unit/scripts/verify/jobs-service-role-containment.test.ts
$env:SUPABASE_TEST_REQUIRED = '1'; pnpm vitest run tests/integration/jobs/job-runs.int.test.ts
pnpm run verify:service-role-containment
pnpm lint
pnpm typecheck
```

The integration command supplies required-mode evidence only after cases make actual database calls. Record passed, failed, and skipped counts; skipped red-phase scaffolds are not coverage. No browser command is applicable to this server-only story.

## Validation status

- TDD structural check: PASS. The five generated files contain 13 `test.skip()` cases and no placeholder assertions, sleeps, browser routes, or product implementation.
- API/E2E generation: PASS. API generation returned 13 skipped route/unit/integration/static cases; the E2E branch returned zero cases because the story has no user-facing flow.
- Targeted runner results are recorded below after scaffold creation. They only prove parse/discovery and intentional skips; no product test body ran.
- Targeted node runner: 0 passed, 0 failed, 10 skipped. Targeted Vitest runner: 0 passed, 0 failed, 3 skipped. The required-mode Vitest rerun with `SUPABASE_TEST_REQUIRED=1` also reported 0 passed, 0 failed, 3 skipped because all cases remain explicitly red-phase skipped before any database call. It is not RLS coverage evidence.
- `pnpm typecheck` is currently blocked by pre-existing sources under `tmp/private/**` and `tmp/worktrees/**` (missing Cloudflare worker types and unrelated historical type errors). It reported no error from a Story 13.1 scaffold.
- Story linking: intentionally omitted. This workflow was instructed not to modify the ready-for-dev story specification; artifact links live only in this checklist.

## Completion handoff

Primary P0 evidence is route/unit/integration/static containment coverage. The next workflow is Story 13.1 implementation: activate a matching scaffold in small increments, observe the expected red failure, implement the narrow behavior, and retain green evidence. Numeric runner SLA, batch-size, fairness, backlog-age, and freshness contracts remain owner-pending; tests prove injected deterministic bounds without asserting an unapproved production target.
