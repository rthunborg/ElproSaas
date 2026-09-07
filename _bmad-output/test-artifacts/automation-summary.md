---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-identify-targets'
  - 'step-03c-aggregate'
  - 'step-04-validate-and-summarize'
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-09-07'
workflowType: testarch-automate
story: 10.6 Tax-Answer Reconciliation; 11.1 Role Storage and Permission-Matrix Mechanism (latest)
detectedStack: fullstack
executionMode: BMad-integrated (post-implementation risk-based coverage expansion)
inputDocuments:
  - _bmad-output/implementation-artifacts/10-6-tax-answer-reconciliation.md
  - _bmad-output/project-context.md
  - _bmad-output/test-artifacts/atdd-checklist-10-6-tax-answer-reconciliation.md
  - _bmad-output/test-artifacts/test-design-epic-10.md
  - _bmad-output/planning-artifacts/prd-phase-b.md
  - _bmad-output/planning-artifacts/architecture-phase-b.md
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
  - _bmad-output/implementation-artifacts/spec-11-1-role-storage-and-permission-matrix-mechanism.md
  - _bmad-output/test-artifacts/atdd-checklist-11-1-role-storage-and-permission-matrix-mechanism.md
  - _bmad-output/test-artifacts/test-design-epic-11.md
---

# Test Automation Expansion — Story 10.6 (Tax-Answer Reconciliation)

## Step 1 — Preflight & Context

- **Stack:** full stack Next.js/React + Supabase. Pure money/snapshot/PDF coverage uses the existing
  `node --test` unit lane; DB/RLS behavior uses Vitest; the two user journeys use Playwright.
  `package.json`, `vitest.config.ts`, and `playwright.config.ts` confirm all required framework
  scaffolding and dependencies are present.
- **Mode:** BMad-integrated. Inputs include the approved Story 10.6, its completed ATDD checklist,
  Epic 10 test design, the ratified architecture §12A/§16.6 contract, PRD NFR55, and project context.
- **Risk posture:** P0 money/tax correctness and frozen-commitment integrity. Coverage expansion must
  add non-duplicative value at the lowest trustworthy level and must not mask unavailable Docker,
  Supabase, or browser infrastructure as a pass.
- **Existing contract:** 17 named acceptance scenarios already span six unit, four golden, five
  DB-backed integration, and two browser IDs. The next step audits implementation depth,
  non-vacuity, negative boundaries, deterministic data, and coverage overlap before adding tests.
- **Scope:** tests and test records only. No dependency, schema, module, nav, `.env`, production-data,
  or Phase C change is authorized.

## Step 2 — Identify Targets

The implemented suite already covers the Story 10.6 acceptance contract at the lowest trustworthy
levels: pure unit/golden tests own policy resolution, aggregate VAT, deduction allocation,
compatibility, serialization, and PDF facts; DB integration owns payload constraints, both creation
RPCs, freeze/locking, and acceptance source-of-truth; Playwright owns the two approved user journeys.
The audit therefore selects one security-boundary gap and deliberately avoids duplicating arithmetic
or UI assertions at higher levels.

| Target | Level | Priority | Acceptance/risk link | Why this level |
| --- | --- | --- | --- | --- |
| Tenant B directly invokes `create_quote_version_from_calculation` with Tenant A's complete V2 inputs; reject with no quote/version side effect | DB integration | P0 | AC3/AC5, tenant isolation, fresh-version fail-closed boundary | Only a real authenticated Postgres RPC call exercises `SECURITY INVOKER` + RLS together |
| Tenant B directly invokes `create_new_quote_version` against Tenant A's existing V2 quote; reject with no added version or parent mutation | DB integration | P0 | AC3/AC5, tenant isolation, re-version boundary | Generic table RLS and foreign acceptance coverage do not execute this redefined RPC directly |

These two paths will be one cohesive test because they share the same threat actor, fixture, and
zero-side-effect oracle. Existing command-level cross-tenant tests remain useful but are not a
substitute for direct invocation of the migration-defined functions.

### Acceptance-criteria audit

- **AC1/AC2:** deep unit and golden coverage already drives all inclusion/classification fields,
  aggregate VAT categories, ROT/grön calculations, caps, whole-SEK allocation, mixed schemes,
  reverse charge, safe-integer bounds, and split invariance. No duplicate pure case selected.
- **AC3:** integration tests already reject V1/partial/false-math payloads, enforce exact child keys,
  lock fresh snapshots, preserve legacy V1 readability, and bind acceptance to frozen `payable_ore`.
  Direct cross-tenant coverage of both creation RPC entry points is the remaining targeted boundary.
- **AC4:** the existing browser journeys assert readiness/save, quote preview, version creation,
  signed PDF text, and independent visibility/inclusion/classification controls. No browser test is
  added. `playwright-cli` is unavailable and the local Supabase stack is unreachable, so browser
  exploration was skipped under the workflow fallback rather than represented as a pass.
- **AC5/AC6:** fail-loud compatibility, the one-migration/no-new-table contract, source-path tokens,
  and deferred-scope containment already have standing coverage.

### Backend/API analysis and scope

The relevant public boundary is the authenticated Supabase RPC surface implemented in
`supabase/migrations/20260805120000_tax_answer_reconciliation.sql` and called by the quote command
layer. There is no third-party provider/OpenAPI contract or message-queue path in Story 10.6; Pact is
disabled, so a provider endpoint map is not applicable. Scope is **selective**: add the two missing
negative RPC paths only, using the existing two-tenant factory and exact before/after DB oracles.

## Step 3 — Generate and Aggregate Tests

- **Execution:** agent-team mode (auto-selected after the enabled capability probe confirmed agent
  team and subagent support). API, E2E, and backend roles used the stable timestamp
  `2026-08-06T18-00-48-945Z` and all returned valid successful JSON.
- **API role:** 0 tests, intentionally. No HTTP route/provider contract was selected; Pact is off.
- **E2E role:** 0 tests, intentionally. Existing E2E-01/E2E-02 own the browser journeys; the new
  target cannot be proven through UI selectors.
- **Backend role:** 1 P0 Vitest integration test (`10.6-INT-12`) added to
  `tests/integration/commands/tax-answer-reconciliation.int.test.ts`.
- **Coverage added:** an authenticated Tenant B directly calls both Story 10.6 quote-version RPCs
  against concrete Tenant A data. Each call must fail, and an admin readback proves the Tenant A
  quote/version/line/event/counter footprint plus the existing frozen parent and line are exactly
  unchanged.
- **Fixtures/helpers:** 0 added. The test reuses the standing two-tenant factory, authenticated
  server client, V2 snapshot/line builders, admin SQL helper, and explicit local-stack gate.
- **Priority distribution:** P0 1; P1/P2/P3 0. Total generated: 1 backend test in 1 existing file.
- **Performance:** generation roles completed in roughly three minutes with parallel scheduling.
  Temporary worker and aggregation artifacts were removed after validation.

## Step 4 — Validation and Final Summary

### Validation evidence

- `pnpm exec vitest run tests/integration/commands/tax-answer-reconciliation.int.test.ts` —
  **PASS in skip-aware mode:** 1 file; 3 source-contract tests passed; 9 DB-backed tests skipped
  because local Supabase was unreachable. The new `10.6-INT-12` is a DB-backed skip, not a pass.
- `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run
  tests/integration/commands/tax-answer-reconciliation.int.test.ts` — **expected hard failure** in
  global setup with the explicit local-stack-unreachable error. CI/release remains fail-closed.
- `pnpm run test:unit` — **PASS:** 1,606 passed; 0 failed, skipped, or todo.
- `pnpm exec eslint tests/integration/commands/tax-answer-reconciliation.int.test.ts` — **PASS**.
- `pnpm run typecheck` — **PASS**.
- The generated test file compiled and its three source-only neighbors executed; it has a P0 tag,
  deterministic factory data, no hard wait, no conditional assertion path, no debug output, and
  cleanup through the standing two-tenant fixture. No browser session was opened, so no orphaned
  CLI session exists.

### Files updated

- `tests/integration/commands/tax-answer-reconciliation.int.test.ts` — one P0 integration scenario.
- `_bmad-output/implementation-artifacts/10-6-tax-answer-reconciliation.md` — Phase 6 evidence,
  coverage note, file list, and explicit 11-case DB verification gap.
- `_bmad-output/test-artifacts/automation-summary.md` — this completed workflow record.

### Assumptions, risks, and next workflow

- No production testability correction was needed; no `src/**`, migration, dependency, fixture,
  environment, scope-manifest, nav, or external-service artifact changed.
- The new test is structurally validated but its RPC/RLS assertions cannot be claimed green until a
  reset local Supabase stack or CI executes it. Required command:
  `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run
  tests/integration/commands/tax-answer-reconciliation.int.test.ts`.
- Recommended next workflow after that real DB run: `bmad-testarch-test-review`; use
  `bmad-testarch-trace` if Story 10.6 AC-to-test traceability needs formal refresh.

---

# Test Automation Expansion — Story 11.1 (Role Storage and Permission-Matrix Mechanism)

## Step 1 — Preflight & Context

- **Stack and mode:** full-stack Next.js/React plus Supabase; BMad-integrated Create workflow.
  `node --test` owns pure TypeScript behavior, Vitest owns local Supabase/RLS evidence, and
  Playwright is available for user journeys. The supplied Story 11.1 specification, completed
  ATDD checklist, and Epic 11 design were loaded.
- **Framework/utility posture:** required runners are present. Playwright Utils and Pact.js Utils
  are configured but their packages are not installed; no imports were invented. SmartBear Pact
  MCP tools are unavailable. There is no Story 11.1 HTTP consumer/provider contract, so Pact is
  not applicable. `playwright-cli` was not used: the story deliberately has no UI surface.
- **Database boundary:** local Supabase/Docker is unavailable by authorized constraint. DB/RLS
  coverage is therefore retained for the CI route and is never reported as locally passed.

## Step 2 — Identify Targets

The ATDD and implementation suite already map the six acceptance criteria at the lowest
trustworthy levels: legacy Admin compatibility and role normalization (unit/context), role-union
and sensitive-field entitlement (unit), generic pre-audit capability denial (unit/envelope),
matrix-manifest coherence (unit), and storage/RLS/helper/H4/search-path behavior (integration).
No API or browser journey belongs to this server/database-only mechanism story.

| Target | Level | Priority | Acceptance/risk link | Reason |
| --- | --- | --- | --- | --- |
| Malformed injected permission-matrix rows (`null`, non-object, missing/non-array/unknown role list) deny a known Admin | Unit | P0 | AC3 fail-closed malformed authorization data | `resolveCapability` accepts an injected matrix seam; existing tests covered unknown caller/module/capability inputs but not malformed matrix rows. |

No duplicate integration or E2E coverage was selected. The remaining database tests continue to
prove the schema and authorization boundary with a real local/CI stack; a pure test cannot replace
those facts.

## Step 3 — Generate and Aggregate Tests

- **Execution:** capability-probed worker dispatch. API and E2E workers returned zero tests because
  Story 11.1 has no HTTP or UI scope. The backend worker generated one P0 unit scenario.
- **Coverage added:** `11.1-UNIT-006` passes five malformed injected matrices to a known Admin and
  asserts each denies. This guards `resolveCapability`'s runtime boundary against malformed source
  data rather than asserting only the happy typed matrix.
- **Fixtures:** none. The scenario is pure, deterministic, and reuses no mutable state.
- **Files changed:** `tests/unit/server/authz/permission-matrix.test.ts` and this workflow record.
- **Playwright Utils deviations:** None — no Playwright-runner tests were generated and the package
  is absent.
- **Pact.js Utils deviations:** None — no contract artifacts were in scope. Pact broker: unreachable
  (SmartBear MCP tools not available); no provider-state lookup was needed.

## Step 4 — Validation and Final Summary

- The new test is P0, uses the existing Node test dialect, makes fail-able assertions against the
  system under test, has no hard wait/skip/focus/conditional assertion path, and adds no fixture or
  external-service dependency.
- `pnpm -C C:\DEV\ElproSaas exec node --experimental-strip-types --import
  ./tests/support/register.mjs --test tests/unit/server/authz/permission-matrix.test.ts` — **PASS**
  (5 tests).
- `pnpm -C C:\DEV\ElproSaas exec eslint tests/unit/server/authz/permission-matrix.test.ts` —
  **PASS**.
- `pnpm -C C:\DEV\ElproSaas run typecheck` — **PASS**.
- `pnpm -C C:\DEV\ElproSaas run test:unit` — **PASS** (1,706 tests; 0 failed, skipped, or todo).
- DB/RLS tests are intentionally not claimed as locally executed; the supplied CI run
  `34121027063` passed the clean reset and DB/E2E gates before this pure test addition. A fresh CI
  run remains the required authoritative execution route for the updated branch.

**Recommended next workflow:** `bmad-testarch-test-review` for independent test-quality review, or
`bmad-testarch-trace` if formal Story 11.1 AC-to-test traceability is required.
