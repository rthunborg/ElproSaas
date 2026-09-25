---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03c-aggregate', 'step-04-validate-and-summarize']
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-09-23'
workflowType: testarch-automate
story: '13.1 Authenticated Background Runner and Producer Registry'
detectedStack: fullstack
executionMode: BMad-integrated (post-implementation risk-based coverage expansion)
inputDocuments:
  - _bmad-output/implementation-artifacts/spec-13-1-authenticated-background-runner-and-producer-registry.md
  - _bmad-output/test-artifacts/atdd-checklist-spec-13-1-authenticated-background-runner-and-producer-registry.md
  - _bmad-output/test-artifacts/tea-atdd-summary-spec-13-1-2026-09-23.json
  - _bmad-output/test-artifacts/test-design-epic-13.md
  - package.json
  - playwright.config.ts
  - vitest.config.ts
  - tests/README.md
  - .agents/skills/bmad-testarch-automate/resources/tea-index.csv
  - .agents/skills/bmad-testarch-automate/resources/knowledge/test-levels-framework.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/test-priorities-matrix.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/data-factories.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/selective-testing.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/ci-burn-in.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/test-quality.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/overview.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/api-request.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/network-recorder.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/auth-session.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/intercept-network-call.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/recurse.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/log.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/file-utils.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/burn-in.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/network-error-monitor.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/fixtures-composition.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/playwright-cli.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-overview.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-consumer-helpers.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-provider-verifier.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-request-filter.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/pact-mcp.md
---

# Test Automation Expansion — Story 13.1: Authenticated Background Runner and Producer Registry

## Step 1 — Preflight & Context

- **Stack:** full stack Next.js/React + Supabase. `package.json`, `playwright.config.ts`, and `vitest.config.ts` confirm the established Node unit, Vitest integration, and Playwright framework scaffolding.
- **Mode:** BMad-integrated post-implementation coverage expansion. The completed specification, Epic 13 design, ATDD checklist, and red-phase summary were loaded. The ATDD baseline defined 13 scenarios (10 route/unit/static and 3 integration); its former explicit skips are no longer present in the implemented Story 13.1 test files.
- **Scope:** the authenticated server-only scheduler lane. The active producer registry is intentionally empty in Story 13.1, so no browser journey, notification category, email, outbox, external provider, or Pact contract is introduced.
- **Knowledge and utilities:** full UI+API Playwright-utils fragments were loaded because the repository has browser tests, but the package is not installed and this server-only scope does not use a browser primitive. Pact.js/Pact MCP references were loaded per configuration; source and package inspection show no Pact boundary, broker, or independently deployed provider in scope, so contract scaffolding is not applicable.
- **Framework readiness:** verified. Existing focused coverage is in `tests/unit/server/jobs/**` and `tests/integration/jobs/job-runs.int.test.ts`; project RLS integration conventions remain applicable. Browser exploration has no relevant user-facing flow, so target discovery will use source and API analysis.

## Step 2 — Identify Targets

### Acceptance-criteria audit

| Acceptance criterion | Existing executable evidence | Selected expansion |
| --- | --- | --- |
| Invalid credentials have one generic 401 and no side effects | Route test covers missing, wrong, JWT-shaped, and forged values before client/runner construction; auth unit covers secret length and rotation parsing. | Add the expired-previous-secret form at the route boundary, proving it retains the same no-side-effect guarantee. |
| Current and eligible previous secrets dispatch once | Auth unit accepts current and an unexpired previous secret; route composition covers the authenticated success path. | No duplicate happy-path test. |
| Active manifest modules alone supply typed producers | Registry unit covers active derivation, pending exclusion, and placeholder rejection. | No duplicate registry test. |
| Deadline/chunk stops are deterministic, resumable, tenant-scoped, fair, and sanitized | Runner unit covers chunk resume/order and failure sanitization; route composition records cursor and null-actor audit correlation. | Add the injected-deadline boundary that stops before the first tenant execution and persists a resumable cursor. |
| Fresh reset `job_runs` has the migration/RLS/H4 contract | Integration test checks FORCE RLS, policy, index, no client mutation grants, and H4 enrollment; broad RLS suites exercise catalog behavior. | Expand the focused catalog assertion with all five check constraints and the authenticated SELECT grant, avoiding a duplicate tenant-RLS journey. |
| Containment guards reject client reachability and forbidden execution/JWT patterns | Dedicated bite test covers an unverified JWT / alternate-lane seed; standing containment suite covers import reachability and bundle checks. | No duplicate static test. |

### Coverage plan

| Target | Level | Priority | Why this level |
| --- | --- | --- | --- |
| Expired previous rotation credential returns the generic 401 before client/runner effects | Unit/route | P0 | The route dependency seam verifies authentication ordering without creating a privileged client. |
| Injected deadline at the first work boundary preserves cursor zero and skips tenant execution | Unit/runner | P0 | A deterministic clock proves the scheduling invariant with no database or sleep dependency. |
| `job_runs` check constraints and authenticated read privilege match the migration contract | Integration/catalog | P0 | PostgreSQL catalog inspection is the smallest trustworthy evidence for deployed DDL/grants. |

**Scope:** selective. No E2E case is appropriate because this story has no user-facing route or UI. `playwright-cli` is not installed, so browser exploration was skipped using the workflow fallback. No OpenAPI/Swagger file, Pact package/directory, broker variable, external provider source, or independently deployed service boundary exists for this internal route; the Provider Endpoint Map and Pact generation are therefore not applicable.

## Step 3 — Generate and Aggregate Tests

- **Execution mode:** configuration requested `auto` with capability probing enabled. Runtime support for subagents is available; no separate agent-team runtime is available. The workflow resolved to `subagent` and collected API, E2E, and backend generation outputs before aggregation.
- **API worker:** generated 0 tests. The internal route has no separately applicable API/client contract and no Pact boundary.
- **E2E worker:** generated 0 tests. No user-facing Story 13.1 surface exists, so an E2E test would create false coverage of excluded functionality.
- **Backend worker:** generated 3 P0 tests in 3 existing files. No fixtures or helpers were needed: the unit dependency seams and local-stack catalog harness already exist.

| File | Added coverage |
| --- | --- |
| `tests/unit/server/jobs/route.test.ts` | An expired prior rotation secret returns the same `401 Unauthorized` and cannot create a client or invoke the runner. |
| `tests/unit/server/jobs/runner.test.ts` | A deadline reached before the first tenant executes records deterministic cursor zero and performs no producer execution. |
| `tests/integration/jobs/job-runs.int.test.ts` | The migration catalog exposes every named `job_runs` check constraint and the authenticated `SELECT` privilege required for the tenant-admin policy. |

**Aggregate:** 3 tests added (P0: 3; P1/P2/P3: 0), with zero API/E2E files and zero new fixtures. The generated tests use the existing Node/Vitest test idioms and deterministic injected time; no Playwright-utils deviation applies because no Playwright test was added.

## Step 4 — Validation and Completion Summary

### Validation

| Check | Result |
| --- | --- |
| Focused Story 13.1 route/runner units | PASS — 6 tests passed, 0 failed, 0 skipped. |
| Broad jobs/service-role/manifest unit selection | PASS — 1,868 passed, 0 failed, 1 explicit unrelated skip. |
| Required-mode `job_runs` integration evidence | PASS — `SUPABASE_TEST_REQUIRED=1` executed 1 test with 0 skips. |
| Targeted ESLint | PASS — no findings in the three changed test files. |
| Service-role containment guard | PASS — the permanent scanner found no client-reachable service-role reference. |

### Completion checklist

- Framework, BMad-integrated inputs, existing ATDD outputs, source paths, and existing focused tests were reviewed.
- Every Story 13.1 acceptance criterion was mapped to executable evidence; the three additions fill route-rotation, injected-deadline, and DDL/grant catalog gaps without duplicating E2E, Pact, registry, or broad RLS coverage.
- The added tests are deterministic, use no sleep/retry/conditional test flow, create no shared fixture or persistent test data, and retain the project’s Node/Vitest conventions.
- No browser session was opened because `playwright-cli` is unavailable and this server-only story offers no page to inspect. No temporary worker artifact is retained outside the test-artifacts deliverable.

### Assumptions and residual risks

- Production producer behavior remains intentionally absent in Story 13.1 because the active registry is empty; later producer stories must add their own behavior and end-to-end evidence when they introduce a user-facing effect.
- Numeric runner SLA, batch size, fairness, backlog-age, and freshness contracts remain owner-pending. The deadline test proves deterministic stop/resume semantics without asserting an unapproved production threshold.

### Recommended next workflow

Run `bmad-testarch-trace` after the Story 13.1 implementation and this automation evidence are reviewed, then refresh the Epic 13 traceability/gate artifacts with the executed required-mode integration result.
