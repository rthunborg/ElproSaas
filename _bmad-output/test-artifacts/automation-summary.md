---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-identify-targets'
  - 'step-03c-aggregate'
  - 'step-04-validate-and-summarize'
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-09-24'
workflowType: testarch-automate
story: 10.6 Tax-Answer Reconciliation; 11.1 Role Storage and Permission-Matrix Mechanism; 11.2 Non-Admin Access to the Phase A Surface; 11.3 Admin User Management; 11.4 Roles Surface, Effective Permissions, and the Per-Role Test Harness; 12.1 Platform Operator Identity and the Provision-Tenant Command; 12.2 Operator Console; 12.3 First-Admin Onboarding Checklist; 13.2 In-App Notifications — Bell, Center, and Preferences; 13.3 Email Outbox Pipeline (Queued, Non-Sending); 13.4 Email Sending Activation (latest)
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
  - _bmad-output/implementation-artifacts/spec-11-3-admin-user-management.md
  - _bmad-output/test-artifacts/atdd-checklist-11-3-admin-user-management.md
  - _bmad-output/test-artifacts/atdd-checklist-11-4-roles-surface-effective-permissions-and-the-per-role-test-harness.md
  - _bmad-output/test-artifacts/automation-summary-11-4-roles-surface-effective-permissions-and-the-per-role-test-harness.md
  - _bmad-output/implementation-artifacts/spec-11-4-roles-surface-effective-permissions-and-the-per-role-test-harness.md
  - _bmad-output/test-artifacts/gate-decision.json
  - _bmad-output/test-artifacts/traceability-matrix.md
  - package.json
  - src/features/admin-users/read.ts
  - tests/integration/rls/admin-user-management.rls.test.ts
  - tests/integration/rls/role-harness.atdd.int.test.ts
  - _bmad-output/implementation-artifacts/spec-12-1-platform-operator-identity-and-the-provision-tenant-command.md
  - _bmad-output/test-artifacts/atdd-checklist-spec-12-1-platform-operator-identity-and-the-provision-tenant-command.md
  - _bmad-output/test-artifacts/tea-atdd-summary-spec-12-1-2026-09-19.json
  - _bmad-output/test-artifacts/tea-atdd-api-tests-2026-09-19T12-18-15-228Z.json
  - _bmad-output/test-artifacts/tea-atdd-e2e-tests-2026-09-19T12-18-15-228Z.json
  - _bmad-output/implementation-artifacts/spec-12-2-operator-console.md
  - _bmad-output/test-artifacts/atdd-checklist-spec-12-2-operator-console.md
  - _bmad-output/test-artifacts/test-design-progress-epic-12.md
  - tests/unit/provisioning/operator-console.test.ts
  - tests/integration/read-models/operator-console.int.test.ts
  - tests/integration/rls/platform-operators.rls.test.ts
  - tests/e2e/auth/operator-console.atdd.e2e.spec.ts
  - scripts/verify/check-operator-console-isolation.mjs
  - tests/unit/scripts/verify/check-operator-console-isolation.test.ts
  - _bmad-output/test-artifacts/test-design-epic-12.md
  - src/server/commands/provisioning/provision-tenant.ts
  - src/server/commands/provisioning/validation.ts
  - src/server/provisioning/attestation.ts
  - src/server/provisioning/baselines.ts
  - tests/unit/provisioning/provisioning-contract.test.ts
  - tests/unit/provisioning/baselines.test.ts
  - tests/integration/commands/provision-tenant.int.test.ts
  - tests/integration/rls/platform-operators.rls.test.ts
  - tests/integration/rls/provisioning-migration-reset.int.test.ts
  - _bmad-output/implementation-artifacts/spec-12-3-first-admin-onboarding-checklist.md
  - _bmad-output/test-artifacts/test-design-epic-12.md
  - tests/unit/onboarding/checklist-state.test.ts
  - tests/integration/read-models/onboarding-checklist.int.test.ts
  - tests/integration/rls/onboarding-checklist.rls.test.ts
  - tests/e2e/onboarding/first-admin-checklist.e2e.spec.ts
  - src/features/onboarding/checklist-state.ts
  - src/server/read-models/onboarding-checklist.ts
  - src/features/onboarding/actions.ts
  - .agents/skills/bmad-testarch-automate/resources/knowledge/playwright-utils-mandate.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/fixture-architecture.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/network-first.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-mandate.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/pact-mcp.md
  - _bmad-output/implementation-artifacts/spec-13-2-in-app-notifications-bell-center-and-preferences.md
  - _bmad-output/test-artifacts/atdd-checklist-13-2.md
  - _bmad-output/implementation-artifacts/spec-13-3-email-outbox-pipeline-queued-non-sending.md
  - _bmad-output/implementation-artifacts/epic-13-context.md
  - _bmad-output/test-artifacts/atdd-checklist-13-3-email-outbox-pipeline-queued-non-sending.md
  - _bmad-output/test-artifacts/tea-atdd-summary-spec-13-3-2026-09-23.json
  - _bmad-output/test-artifacts/test-design-epic-13.md
  - _bmad-output/implementation-artifacts/spec-13-4-email-sending-activation.md
  - _bmad-output/test-artifacts/atdd-checklist-13-4.md
  - _bmad-output/test-artifacts/traceability/epic-13-traceability-report.md
  - _bmad/tea/config.yaml
  - tests/unit/server/notifications/registry.test.ts
  - tests/integration/notifications/notifications.atdd.int.test.ts
  - tests/e2e/notifications/notifications.atdd.e2e.spec.ts
  - src/server/notifications/registry.ts
  - src/server/notifications/read-model.ts
  - src/server/notifications/follow-up-producer.ts
  - src/components/notifications/NotificationBell.tsx
  - src/components/notifications/NotificationsCenter.tsx
  - src/components/notifications/NotificationPreferences.tsx
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

---

# Test Automation Expansion — Story 11.2: Non-Admin Access to the Phase A Surface

## Step 1 — Preflight & Context

- **Stack and mode:** full-stack Next.js/React plus local Supabase. This was a BMad-integrated
  Create run against the completed Story 11.2 specification, its ATDD checklist, Epic 11 test
  design, Vitest configuration, Playwright configuration, and existing test suite.
- **Framework readiness:** `package.json`, `vitest.config.ts`, and `playwright.config.ts` confirm
  the established Node unit, Vitest integration/RLS, and production-server Playwright lanes.
- **Utility and contract posture:** Playwright Utils and Pact.js Utils are configured but their
  packages are not installed, so no dependency or substitute test pattern was introduced. There
  is no independently deployed provider boundary in this story, therefore Pact is not relevant.
  Pact broker: unreachable (SmartBear MCP tools not available). Provider states were not needed.
- **Existing acceptance evidence loaded:** six activated Story 11.2 integration/RLS ATDD cases
  and four activated browser cases already cover the role matrix, catalog agreement, permitted
  and denied RLS paths, command denial without audit, context fail-closed behavior, sensitive
  projections, the jobs-assignment seam, navigation, landing, and generic direct-route denial.

## Step 2 — Identify Targets

The coverage audit deliberately avoided re-adding the already executed role matrix, raw Storage
list/download/sign denials, generic `Files.View` denial, or the Säljare quote-PDF broker success
and audit proof. The final server-only signer change did leave one P0 boundary unproven: two valid
same-tenant generated PDFs must not be interchangeable between quote versions.

| Target | Level | Priority | Acceptance/risk link | Reason |
| --- | --- | --- | --- | --- |
| Säljare requests signed access for quote version A with quote version B's valid generated PDF file ID; access denies with no audit | Integration/command/RPC | P0 | Crafted denial, exact quote-PDF target binding, no target/audit signal | This crosses the new checked-RPC → server-only signer → attested-audit boundary. A unit test cannot verify the generated-file/link/version relationship or the real audit result. |

No browser test was added. A browser preview would only repeat the existing broker-success
integration coverage without adding authorization evidence, while the four Story 11.2 browser
tests remain the thin user-visible acceptance layer.

## Step 3 — Generate and Aggregate Tests

- **Execution mode:** capability-probed subagent dispatch. API, browser, and backend audits ran
  in parallel and their findings were aggregated before editing.
- **Coverage added:** one P0 Vitest integration test in
  `tests/integration/commands/quote-pdf-validity.int.test.ts`. It generates two real Säljare
  quote-PDF artifacts, submits the second file ID for the first version, expects the same generic
  `TENANT_ACCESS_DENIED` response used by the checked RPC, and independently proves that its
  correlation ID wrote no audit event.
- **Fixtures and helpers:** none. The test reuses the existing isolated two-tenant fixture,
  Säljare client, deterministic command clock, quote-PDF generation command, and admin SQL reader.
- **Generated counts:** API 0; browser 0; backend integration 1; fixtures 0. Priority totals:
  P0 1, P1/P2/P3 0.

## Step 4 — Validation and Final Summary

- `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run --maxWorkers=1
  tests/integration/commands/quote-pdf-validity.int.test.ts` — **PASS:** 1 file, 27 tests passed,
  0 failed, 0 skipped. The serial worker setting was retained for the shared local fixture.
- `pnpm exec eslint tests/integration/commands/quote-pdf-validity.int.test.ts` — **PASS**.
- `git diff --check` — **PASS**.
- The preceding focused confirmation of the Story 11.2 RLS ATDD plus quote-PDF suite passed:
  2 files, 32 tests passed, 0 skipped. The supplied final full-suite evidence remains 94
  integration files / 991 tests, 94 unit suites / 1,717 tests, and 126 Playwright passes with
  four historical skips outside this story; those broad suites were not rerun after this focused
  addition.

### Playwright Utils deviations

None. No Playwright test was generated, and the configured package is not installed.

### Pact.js Utils deviations

None. No contract artifact belongs to this in-process application and database boundary.

**Files changed:**

- `C:/DEV/ElproSaas/tests/integration/commands/quote-pdf-validity.int.test.ts`
- `C:/DEV/ElproSaas/_bmad-output/test-artifacts/automation-summary.md`

**Residual risk and next workflow:** the exact binding and no-audit failure path now execute on
the local authenticated stack. The independent full-diff review caveat recorded by the story
remains unchanged; use `bmad-testarch-test-review` only if a new review round is requested.

---

# Test Automation Expansion — Story 11.3: Admin User Management

## Step 1 — Preflight & Context

- **Stack and mode:** full-stack Next.js/React plus local Supabase. This BMad-integrated Create
  run used the completed Story 11.3 specification, its red-phase ATDD checklist, implemented
  command and Auth service code, existing Node unit tests, integration/RLS tests, and Playwright
  smoke tests.
- **Framework readiness:** the established test lanes are Node `node:test` for service behavior,
  Vitest for real database and RLS behavior, and Playwright against the configured production
  server. Playwright Utils and Pact.js Utils are configured but neither package is installed, so
  the repository's established raw Playwright and local mock conventions were retained.
- **Existing evidence reused:** the real DB suite already covers valid, expired, revoked,
  superseded, and wrong-email invitation acceptance; the last-active-Admin invariant; shared
  account tenant-only removal; reconciliation idempotency; and direct RLS denials. The existing
  browser suite covers Admin list/detail/history and direct non-Admin denial. No duplicate
  database cases were generated.

## Step 2 — Identify Targets

| Target | Level | Priority | Acceptance/risk link | Reason |
| --- | --- | --- | --- | --- |
| Existing confirmed Auth account receives a magic link after durable invite preparation | Node unit | P0 | AC4, AC5; retry-safe delivery | Confirms the `already` provider response takes the selected-account path without a second membership mutation. |
| Unrelated invite-provider failure finalizes uncertain and sends no fallback | Node unit | P0 | AC5; no duplicate delivery claim | Distinguishes a real provider failure from the only safe fallback condition. |
| Password reset finalizes succeeded or uncertain without exposing provider detail | Node unit | P0 | AC1, AC5 | Covers both durable terminal outcomes at the Auth boundary. |
| Admin opens invite form, sees role choices, and invalid email remains client-side invalid | Playwright | P1 | AC1 invite action | Adds a user-visible action flow without sending email or mutating a membership. |

API and Pact coverage were not applicable: Story 11.3 has no independently deployed REST/provider
contract boundary, and all command behavior is mediated by the in-process server and local
Supabase RPCs.

## Step 3 — Generate and Aggregate Tests

- **Execution mode:** capability-probed BMad-integrated agent-team dispatch; API, browser, and
  backend findings were aggregated before editing.
- **Coverage added:** three P0 mock-only Node tests in
  `tests/unit/admin-users/admin-user-service.test.ts`, and one P1 Playwright test in
  `tests/e2e/auth/admin-user-management.atdd.e2e.spec.ts`.
- **Fixtures and helpers:** none. The browser journey reuses the Story 11.3 tenant-admin fixture;
  service tests use local dependency doubles and no network provider.
- **Generated counts:** API 0; browser 1; backend unit 3; integration 0; fixtures 0. Priority
  totals: P0 3, P1 1, P2/P3 0.

### Playwright Utils deviations

The configured package is absent. The one browser test uses the repository's current raw
`@playwright/test` locators and assertions; no substitute utility or dependency was introduced.

### Pact.js Utils deviations

No contract artifact applies to this in-process command and database boundary; Pact packages and
broker access are unavailable.

## Step 4 — Validation and Final Summary

- `node --experimental-strip-types --import ./tests/support/register.mjs --test
  tests/unit/admin-users/admin-user-service.test.ts` — **PASS:** 5 tests passed, 0 failed,
  0 skipped.
- `pnpm exec playwright test tests/e2e/auth/admin-user-management.atdd.e2e.spec.ts --workers=1`
  — **PASS:** 3 tests passed, 0 failed, 0 skipped, using the already-running root-owned server.
- `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run
  tests/integration/commands/admin-user-management.int.test.ts
  tests/integration/rls/admin-user-management.rls.test.ts` — **PASS:** 2 files, 6 tests passed,
  0 failed, 0 skipped.
- `pnpm exec eslint tests/unit/admin-users/admin-user-service.test.ts
  tests/e2e/auth/admin-user-management.atdd.e2e.spec.ts` — **PASS**.

**Reachable Phase 7 repair:** the invite dialog's focus contract is broken after opening the form.
`src/components/admin-users/UsersPage.tsx` renders hidden `operationId` before the email input;
`src/components/crm/Dialog.tsx` treats every `input:not([disabled])` as focusable, calls
`.focus()` on that hidden input, and leaves focus on the trigger rather than `E-post`. A browser
assertion reproduced this deterministically. The active validation journey intentionally does not
mask this defect; it records the remaining invite-form behavior while Phase 7 should exclude hidden
controls from the Dialog focus selector and restore the focus assertion.

**Files changed:**

- `C:/DEV/ElproSaas/tests/unit/admin-users/admin-user-service.test.ts`
- `C:/DEV/ElproSaas/tests/e2e/auth/admin-user-management.atdd.e2e.spec.ts`
- `C:/DEV/ElproSaas/_bmad-output/test-artifacts/automation-summary.md`

**Residual risk and next workflow:** Auth email delivery is intentionally not browser-automated.
The local database acceptance, RLS, command, and service boundary evidence are green with no
skips. Repair the dialog focus defect before claiming the invite dialog's documented initial-focus
behavior; run `bmad-testarch-test-review` only if a further test-quality review is requested.

---

# Test Automation Expansion — Story 11.4: Effective-Permissions No-Existence-Signal Remediation

## Step 1 — Preflight & Context

- **Stack and mode:** full-stack Next.js/React plus local Supabase; BMad-integrated Create run.
  `package.json`, `vitest.config.ts`, and `playwright.config.ts` confirm the established Node,
  Vitest, and Playwright framework lanes.
- **Authorized scope:** the sole formal trace gap in `11.4-AC4`: direct missing-membership and
  Tenant A Admin to Tenant B membership calls through `readAdminUserDetail`, with identical generic
  no-data/no-existence-signal results. Production code, the approved spec, trace/gate artifacts,
  sprint status, and broader AC5 raw-write/command-body probes are outside this run.
- **Existing evidence:** pure role-catalogue tests already prove effective-permission union and
  lifecycle behavior; RLS and browser tests already prove shared anonymous, missing-membership,
  cross-tenant, and non-Admin controls. None directly calls the effective-permissions read model for
  both missing and foreign target IDs.
- **Framework and utility posture:** this direct database-backed server read belongs in Vitest.
  Playwright Utils and Pact.js Utils are configured but their packages are absent; no Playwright or
  provider contract test is selected. SmartBear Pact MCP tools are unavailable and provider states
  are irrelevant to this in-process read boundary.
- **Loaded workflow knowledge:** test levels, P0 authorization priority, isolated tenant factories,
  selective execution, burn-in guidance, test quality, Playwright Utils mandate/profile, and Pact
  MCP/browser automation fallback guidance.

## Step 2 — Identify Targets

| ID | Target | Level | Priority | Why this is the required evidence |
| --- | --- | --- | --- | --- |
| `11.4-INT-AC4-001` | A Tenant A Admin requests effective permissions for a missing membership UUID and receives the generic no-data result | Vitest integration / production read model | P0 | Calls `readAdminUserDetail` with a real authenticated RLS client; lower-level RLS or pure DTO tests cannot prove the server read contract. |
| `11.4-INT-AC4-002` | The same Tenant A Admin requests Tenant B's real membership and receives a result exactly equal to the missing-ID result | Vitest integration / production read model | P0 | The independent admin query proves the foreign target exists, while exact result equality proves the read path exposes no target-existence distinction. |

**Coverage decision:** add the two direct cases in one focused Story 11.4 integration file. Reuse the
isolated two-tenant factory, inject its real Tenant A authenticated Supabase client only at the
cookie-bound client factory seam, and keep all membership/audit/effective-permission reads inside
the production `readAdminUserDetail` implementation. The existing role-harness, unit, RLS, and E2E
tests remain unchanged because they cover different layers. Browser exploration was skipped after
`playwright-cli` was not found: a browser cannot observe the missing-versus-foreign server result
more directly than this boundary, and no UI behavior is missing. Pact/provider mapping is not
applicable because the read is in-process and has no consumer-provider contract.

## Step 3 — Generate and Aggregate Tests

- **Execution mode:** capability-probed subagent mode. API and E2E workers ran in parallel; the
  backend worker started as soon as the runtime's available worker slot was released. All three
  returned valid `success: true` JSON at timestamp `2026-09-11T14-59-29-901Z`.
- **API generation:** 0 tests. No HTTP route or consumer-provider contract owns this invariant.
- **E2E generation:** 0 tests. Existing browser coverage already owns the Admin viewer and
  non-Admin route; another journey cannot prove missing-versus-foreign read equality.
- **Backend generation:** 2 P0 Vitest integration tests in
  `tests/integration/rls/admin-user-detail-isolation.rls.test.ts`.
- **Generated behavior:** the first case calls production `readAdminUserDetail` for a random missing
  membership UUID. The second independently proves Tenant B's membership exists, calls the same
  production read as Tenant A Admin for both missing and foreign IDs, and asserts exact result
  equality plus the established generic `{ detail: null, error }` shape.
- **Fixtures/helpers:** none added. The tests reuse the two-tenant factory, a real authenticated
  Supabase client, admin readback, cleanup, and pool teardown. Only the cookie-bound
  `createSupabaseServerClient` factory is mocked so the production read logic and real RLS execute.
- **Totals:** 2 tests, 1 backend file, 0 API files, 0 E2E files, 0 fixtures; P0 2, P1/P2/P3 0.
- **Playwright/Pact deviations:** none. No Playwright or Pact artifact was generated.

## Step 4 — Validate and Summarize

### Validation evidence

- `SUPABASE_TEST_REQUIRED=1` with canonical Node
  `C:/Users/Rasmus/AppData/Local/nvm/v22.23.2/node.exe`, running
  `node_modules/vitest/vitest.mjs run
  tests/integration/rls/admin-user-detail-isolation.rls.test.ts` — **PASS:** 1 file, 2 tests
  passed, 0 failed, 0 skipped; 1.21 seconds. Both cases executed against the reachable local
  Supabase stack.
- Canonical Node running `node_modules/eslint/bin/eslint.js
  tests/integration/rls/admin-user-detail-isolation.rls.test.ts` — **PASS**.
- Canonical Node running `node_modules/typescript/bin/tsc --noEmit` — **PASS**.
- `git diff --check` scoped to the generated test and this artifact — **PASS**; the only output is
  Git's existing LF-to-CRLF working-copy warning for this markdown artifact.
- Static scan of the generated test found no committed focus/skip, hard waits, or debug logging.

### Definition of done

- The two P0 scenarios call the production effective-permissions read boundary with a real Tenant A
  authenticated client and real RLS; they do not mock the read result or database.
- The missing target returns no detail and the established generic error. The independently proven
  real Tenant B target returns a deeply equal result, so neither effective permissions nor a target
  existence distinction is exposed.
- Each test creates unique two-tenant data, cleans it in `finally`, resets its client-factory mock,
  and closes the shared admin pool. There are no hard waits, external services, conditional
  assertions, new fixtures, or test interdependencies.
- Coverage expansion remains selective: 2 backend integration tests (P0 2; P1/P2/P3 0), with no
  duplicate API, browser, contract, raw-write, or real-command-body cases.

### Files changed

- `C:/DEV/ElproSaas/tests/integration/rls/admin-user-detail-isolation.rls.test.ts`
- `C:/DEV/ElproSaas/_bmad-output/test-artifacts/automation-summary.md`

### Playwright Utils deviations

None. No Playwright artifact was generated, and no Playwright utility capability applies to the
Vitest server/database integration file.

### Pact.js Utils deviations

None. Story 11.4's effective-permissions read is an in-process application/database boundary, not a
consumer-provider contract.

### Coverage status and next workflow

The specific `11.4-AC4` missing/foreign effective-permissions read-path gap is addressed by executed,
zero-skip evidence. The existing `traceability-matrix.md` and `gate-decision.json` intentionally
remain unchanged under this run's ownership boundary. Re-run `bmad-testarch-trace` for Epic 11 to
fold this evidence into the formal 21/21, P0 18/18 gate decision.

---

# Test Automation Expansion — Story 12.1: Platform Operator Identity and the Provision-Tenant Command

## Step 1 — Preflight & Context

- **Stack and mode:** detected as a full-stack Next.js/React and Supabase repository: the Next server
  command layer and Supabase migrations are the backend alongside the browser application, with established
  Node `node:test` unit, Vitest local-Supabase integration/RLS, and production-server
  Playwright lanes. This is a BMad-integrated Create run using the supplied Story 12.1 specification.
  `package.json`, `vitest.config.ts`, and `playwright.config.ts` confirm the required framework
  scaffolding is present.
- **Acceptance inputs:** the owner-approved Story 12.1 contract, its completed ATDD checklist and
  generated API/E2E summaries, and the Epic 12 test design were loaded alongside the implementation,
  migrations, existing unit tests, and integration/RLS suites. The ATDD artifacts already map the
  privileged database authority, canonicalisation, idempotency, reservation/outcome, token, recovery,
  audit, and scope cases; expansion will only select an uncovered, independently meaningful assertion.
- **Utility posture:** Playwright Utils is configured but its package is absent, so its mandate does
  not bind generated code. Pact.js is not relevant: this in-process server and Supabase RPC boundary
  has no independent consumer/provider contract. Pact broker: unreachable (SmartBear MCP tools not
  available). Provider states were not needed.
- **Knowledge loaded:** test-level selection, priority matrix, data factories, selective execution,
  CI/burn-in and quality guidance; the configured Playwright utility profile and traditional principles;
  and Pact MCP fallback guidance. Browser tests are present elsewhere in the repository, but no Story
  12.1 operator UI surface exists to justify a new browser journey.
- **Scope:** tests and this TEA record only. The approved specification, implementation, migrations,
  manifest, sprint/auto-BMAD state, environment configuration, and the existing ATDD output remain
  outside this coverage-expansion run.

## Step 2 — Identify Targets

The ATDD output already covers all Story 12.1 acceptance groups at their authoritative levels:
strict schema and canonicalisation; preview/approval; hardened function, grants, manifest and RLS;
atomic transaction and all-status identity/idempotency; concurrent creation; token reservation and
provider outcomes; audit; and Epic 11 readiness activation. Its integration helpers call the real
RPC for retry behavior, but they do not directly exercise the production server command's
fail-closed retry-orchestration branches. Browser coverage is inapplicable because Story 12.1 has
no operator UI acceptance surface, and no HTTP/Pact boundary exists.

| Target | Level | Priority | Acceptance/risk link | Reason |
| --- | --- | --- | --- | --- |
| An unfinalized durable reservation is recorded as `unknown` and returns before fresh reservation/provider invocation | Node unit (production command seam) | P0 | AC recovery, R-1202 | Proves the command cannot duplicate an uncertain provider attempt; the existing database test proves state, but not this server-side call ordering. |
| The fourth dispatch rejects absent or content-mismatched fresh renewal data before reserve/provider work | Node unit (production command seam) | P0 | AC bounded retry/approval, R-1202 | Covers the fail-closed handoff gate between durable facts and the HMAC-backed reserve action without duplicating real RPC lifecycle assertions. |

Coverage is selective: two P0 unit assertions in the existing provisioning-contract suite. They will
reuse the existing dependency-injection hooks and fake authenticated client, make call ordering
observable, and add no fixture, migration, browser, API, or provider contract artifact.

## Step 3 — Generate and Aggregate Tests

- **Execution:** agent-team worker dispatch completed with three workers. API and E2E workers
  independently generated zero tests after confirming that this story exposes no HTTP contract or
  browser route. The backend worker generated two P0 Node unit cases.
- **Coverage added:** `12.1-UNIT-007` drives the production retry seam with a durable unfinished
  reservation and proves its only calls are `reconcile` then `record_unknown`; delivery and a fresh
  reservation cannot occur. `12.1-UNIT-008` sets the durable dispatch generation to three and proves
  both missing and content-mismatched renewal evidence return `PREVIEW_STALE` after reconciliation,
  before reserve or provider delivery.
- **Fixtures:** none. The cases use the existing authenticated client/dependency injection seam and
  restore their test-only attestation environment values in `finally`.
- **Generation totals:** 2 P0 backend unit tests in one existing file; 0 API tests, 0 E2E tests,
  0 fixture files, and no Playwright or Pact deviations.

## Step 4 — Validation and Final Summary

### Validation evidence

- `pnpm exec node --experimental-strip-types --import ./tests/support/register.mjs --test
  tests/unit/provisioning/provisioning-contract.test.ts` — **PASS:** 16 tests passed, 0 failed,
  skipped, or todo. This includes the two generated retry-orchestration cases.
- `pnpm exec eslint tests/unit/provisioning/provisioning-contract.test.ts` — **PASS**.
- `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/commands/provision-tenant.int.test.ts
  tests/integration/rls/platform-operators.rls.test.ts tests/integration/rls/provisioning-migration-reset.int.test.ts
  tests/integration/rls/security-definer-search-path.rls.test.ts` — **PASS:** 4 files, 18 tests
  passed, 0 failed, 0 skipped.
- `git diff --check` on the test and workflow record — **PASS**. The working-copy LF-to-CRLF notices
  are Git warnings only. Static quality scan found no focus/skip/fixme, hard waits, debug output, or
  browser interception patterns in the generated Node tests.
- The full repository typecheck was not rerun: the known unrelated `tmp/private/**` and
  `tmp/worktrees/**` failures remain outside this scoped change. The focused test executes and lint
  validates the edited file.

### Definition of done

- Two deterministic P0 tests execute the production command seam with an authenticated fake client;
  neither mocks the decision under test nor depends on database or provider availability.
- The outstanding-reservation path proves exact `reconcile` → `record_unknown` ordering and fails if
  delivery or fresh reservation is attempted. The generation-three path proves both rejected renewal
  variants stop before those actions.
- No browser, API, contract, fixture, helper, production, migration, or specification file changed.
  Worker temporary JSON files were removed after aggregation.

### Playwright Utils deviations

None. No Playwright-runner test was generated, and the configured package is not installed.

### Pact.js Utils deviations

None. Story 12.1 has no consumer-provider contract boundary, and no Pact artifact was generated.

**Recommended next workflow:** `bmad-testarch-test-review` for independent review of the expanded
unit coverage, or `bmad-testarch-trace` if formal Story 12.1 traceability must be refreshed.

# Test Automation Expansion — Story 12.2 (Operator Console)

## Step 1 — Preflight & Context

- **Stack:** fullstack. The repository has Next.js, Vitest DB-backed integration suites, Node
  unit tests, and Playwright browser acceptance tests; `playwright.config.ts`, `vitest.config.ts`,
  and package scripts are present, so the test framework is ready.
- **Mode:** BMad-Integrated Create. Loaded the approved Story 12.2 specification, its ATDD
  checklist, Epic 12 test design, relevant implementation, and the existing unit, integration,
  static, and browser suites. The existing ATDD material already maps the full intended surface.
- **Configuration:** `tea_use_playwright_utils=true`, but
  `@seontechnologies/playwright-utils` is not a project dependency, so its mandate does not bind
  generated tests. `tea_use_pactjs_utils=true`, but no Pact package/configuration or service
  contract boundary exists, so no Pact suite is relevant. `tea_pact_mcp=mcp` and SmartBear tools
  are unavailable in this session: **Pact broker: unreachable (SmartBear MCP tools not available).
  Provider states derived from provider source.**
- **Knowledge:** loaded the core test-level, priority, data-factory, selective-testing, CI/burn-in,
  quality, Playwright utility, traditional fixture/network, CLI, and Pact MCP guidance. The
  Playwright utility package is not installed; no utility-specific imports may be emitted.
- **Scope:** Story 12.2 tests and this TEA record only. The specification remains unchanged.

## Step 2 — Identify Targets

The shipped ATDD material already gives every Story 12.2 acceptance criterion primary coverage:
P0 projection/isolation through unit, required RLS/read-model, and static suites; P1 direct-route,
wizard, approval/replay, and durable-reload coverage through production E2E; and P2 keyboard/focus
coverage through production E2E. The implementation evidence reports 24 focused unit/static tests,
16 required integration tests, and five production E2E cases, all passing with zero skips. Repeating
those browser and database scenarios would be duplicate coverage.

| Target | Level | Priority | Acceptance/risk link | Reason |
| --- | --- | --- | --- | --- |
| Closed wizard request ignores client-supplied authority, catalog, commercial, and request identity fields | Node unit | P0 | Preview/approval authority, R-1202/R-1204 | The existing valid-preview test proves zero writes but not that the narrow FormData adapter discards browser attempts to override server-owned facts. |
| Equivalent formatted organisation identities produce the same request identity while a different identity does not | Node unit | P1 | Replay/idempotency, R-1203 | Pins the adapter contract needed for preview/replay to retain one server request identity without re-running the command protocol already covered by Story 12.1. |
| Durable `ready` state derives the completed wizard view | Node unit | P1 | Resume/reload, R-1211 | Completes the missing successful durable-state branch of the existing state-derivation coverage. |

Coverage is selective: three deterministic additions in the existing Node unit suite. No API/Pact
target exists, and no new browser or DB case is warranted because those layers already exercise the
same acceptance paths with required zero-skip evidence. The test body will use only public pure
helpers, no fixtures, no mocks, no clock, and no production or specification change.

## Step 3 — Generate and Aggregate Tests

- **Execution:** capability probe resolved the configured `auto` mode to parallel subagents. The
  API worker generated zero tests: Story 12.2 has no HTTP endpoint or consumer/provider boundary.
  The E2E worker generated zero tests: the shipped production suite already covers all mapped
  journeys with five passing zero-skip cases. The backend worker supplied one existing Node unit
  file with three additions.
- **Coverage added:** `12.2-UNIT-006` compares a clean request with a FormData payload that tries
  to override server-owned request, catalogue, commercial, and country facts; both must result in
  the same closed request. `12.2-UNIT-007` proves equivalent organisation formatting retains the
  request identity while a different canonical organisation does not. `12.2-UNIT-008` covers the
  durable `ready` state as the completed wizard step.
- **Fixtures:** none. The additions use only FormData and the existing public pure helpers.
- **Generation totals:** 3 tests in one existing backend/unit file (P0: 1, P1: 2); 0 API tests, 0
  E2E tests, 0 fixture files, and no Playwright or Pact deviations. The aggregation summary is
  retained in this document; all agent-created temporary worker outputs were removed after
  aggregation.

## Step 4 — Validation and Final Summary

### Validation evidence

- `pnpm exec node --experimental-strip-types --import ./tests/support/register.mjs --test
  tests/unit/provisioning/operator-console.test.ts` — **PASS:** 8 tests passed, 0 failed,
  cancelled, skipped, or todo. This includes all three generated cases.
- `pnpm exec eslint tests/unit/provisioning/operator-console.test.ts` — **PASS with one existing
  warning:** `ConsoleDto` at line 11 is unused. The generated test additions introduce no lint
  errors or warnings.
- `git diff --check` — **PASS.** Git reports only LF-to-CRLF working-copy notices.

### Definition of done

- Three focused deterministic Node tests close the remaining request-boundary and durable-state
  gaps without duplicating the existing required RLS/read-model or production-browser evidence.
- `12.2-UNIT-006` verifies browser FormData cannot override server-owned facts; `12.2-UNIT-007`
  verifies the intended canonical-input/idempotency behavior; `12.2-UNIT-008` verifies the
  completed state derived from durable `ready` data.
- No fixture, helper, API, browser, contract, production, migration, environment, or specification
  file changed. The temporary worker JSON documents were removed after aggregation.

### Playwright Utils deviations

None. The package is not installed and no Playwright test was generated.

### Pact.js Utils deviations

None. Story 12.2 has no consumer-provider boundary or Pact artifact.

**Recommended next workflow:** `bmad-testarch-test-review` for the independent review already
recommended by the story's follow-up review record.

# Test Automation Expansion — Story 12.3 (First-Admin Onboarding Checklist)

## Step 1 — Preflight & Context

- **Stack:** fullstack. Next.js, Node's built-in unit runner, Vitest integration/RLS suites, and
  Playwright browser acceptance tests are configured in `package.json`, `vitest.config.ts`, and
  `playwright.config.ts`; the framework is ready.
- **Mode:** BMad-Integrated Create. Loaded the approved Story 12.3 specification, Epic 12 test
  design, onboarding implementation, and existing unit, integration/RLS, and browser evidence.
  There is no Story 12.3 ATDD checklist artifact to reuse; the specification and test design map
  its acceptance criteria directly.
- **Configuration:** `tea_use_playwright_utils=true`, but
  `@seontechnologies/playwright-utils` is not installed, so its code-level mandate does not bind
  generated tests. `tea_use_pactjs_utils=true`, but no Pact dependency, broker configuration, or
  consumer/provider contract boundary is present. Pact MCP tools are unavailable in this session;
  provider states, if needed, would be derived from source. No Pact artifact is relevant here.
- **Knowledge:** loaded the required test-level, priority, data-factory, selective-execution,
  CI/burn-in, quality, Playwright utility, traditional fixture/network, CLI, and Pact guidance.
- **Scope:** Story 12.3 test automation and this workflow record only. The specification is
  immutable for this run.

## Step 2 — Identify Targets

The Story 12.3 specification and Epic 12 design map every primary acceptance path. No Story 12.3
ATDD output exists. The shipped suites already cover the fixed ordered Swedish DTO, the five normal
predicate red boundaries, all-green aggregate, terms-warning separation, canonical company identity,
active/invited/expired role-bearing membership behavior, cross-tenant fact isolation, self-only
dismissal privilege, ready-tenant persistence policy, two-Admin dismissal independence, static scope,
and the browser dismissal/reload/reminder/deep-link journey. Repeating those browser or database
scenarios would duplicate verified zero-skip evidence.

| Target | Level | Priority | Acceptance/risk link | Reason |
| --- | --- | --- | --- | --- |
| Malformed persisted fact values cannot make the five-item projection green | Node unit | P0 | AC2/AC5; R-1207/R-1208 | The pure evaluator is the final fail-closed boundary for malformed database/read-model values. Existing units cover only a subset of malformed values; this focused decision table will pin invalid tenant identity, VAT display/rate, and non-integer count values without repeating the persisted integration paths. |

Coverage is selective: one P0 Node unit test in the existing onboarding evaluator suite. There is no
HTTP provider endpoint, OpenAPI contract, or Pact-relevant boundary. Browser exploration was skipped
because `playwright-cli` is not installed and no managed test server is active; code, stable browser
tests, and production E2E configuration provide the relevant surface evidence.

## Step 3 — Generate and Aggregate Tests

- **Execution mode:** requested `auto`; capability probe resolved to **subagent** because parallel
  subagents are available and agent-team dispatch is not. API, browser, and backend workers completed
  successfully and their required temporary JSON records were validated.
- **Coverage added:** `12.3-UNIT-004` is a P0 decision-table test in the existing evaluator suite.
  It proves malformed resolved tenant identity, unsupported or non-numeric VAT facts, and fractional
  active-role/additional-member counts each leave their corresponding item incomplete and the aggregate
  non-working.
- **No duplicate artifacts:** API worker generated zero tests because the story has no application
  HTTP/provider contract. E2E worker generated zero tests because the existing browser journey already
  covers ready-admin login, fixed links, warning, dismissal, reload, reminder restore, and server truth.
- **Fixtures and deviations:** no fixtures/helpers were needed. No Playwright Utils or Pact.js
  deviations were produced; neither library is installed and neither test type was generated.
- **Generation totals:** 1 P0 backend/unit test in one existing file; 0 API tests, 0 E2E tests, and
  0 fixture files. Aggregated record: `C:/tmp/tea-automate-summary-2026-09-21T13-42-28-123.json`.

## Step 4 — Validate and Summarize

### Validation evidence

- `node --experimental-strip-types --import ./tests/support/register.mjs --test
  ./tests/unit/onboarding/checklist-state.test.ts` — **PASS:** 6 tests passed, 0 failed, 0 skipped,
  cancelled, or todo. The one added P0 decision-table test is included.
- `pnpm exec eslint tests/unit/onboarding/checklist-state.test.ts` — **PASS:** no lint output.
- `git diff --check` — **PASS:** no whitespace errors. Git emitted only the workspace's LF-to-CRLF
  notice for the edited Markdown and TypeScript files.
- Focused quality scan found no committed focus/skip/fixme, debug logging, browser synchronization,
  or network-interception patterns in the generated Node unit suite.

### Definition of done

- The added test is pure, deterministic, and isolated. It exercises malformed runtime fact values
  at the projection boundary and asserts an observable false item plus false aggregate for every
  case; it does not mock or restate the implementation internals.
- Existing verified required integration/RLS and production browser evidence was retained rather
  than rerun for this test-only delta. No service, browser session, fixture, factory, production
  source, migration, or specification file changed.
- The run leaves no unresolved Story 12.3 automation defect. The Node runner reports its existing
  `MODULE_TYPELESS_PACKAGE_JSON` performance warning because the package lacks `"type": "module"`;
  it is not introduced by this test and does not affect execution.

### Playwright Utils deviations

None. No Playwright test was generated, and `@seontechnologies/playwright-utils` is not installed.

### Pact.js Utils deviations

Not applicable. Story 12.3 has no consumer-provider contract boundary and no Pact artifact was
generated.

**Recommended next workflow:** `bmad-testarch-test-review` if an independent review of the final
Story 12.3 test additions is required.

# Test Automation Expansion — Epic 12 Trace-Gate Remediation Iteration 1

## Step 1 — Preflight & Context

- **Mode:** BMad-Integrated Create. Loaded the final Story 12.3 specification, Epic 12 context,
  Epic 12 test design, current traceability matrix and gate signal, existing Story 12.3 automation
  record, framework configuration, implemented onboarding boundaries, and the directly relevant
  unit, integration/RLS, and production-browser suites. Final specification files are read-only for
  this run.
- **Framework:** Next.js/TypeScript with Node test for pure unit/static suites, Vitest for required
  local Supabase integration/RLS evidence, and Playwright against the configured production server.
  Required framework scaffolding is present. The repository is treated as full-stack because the
  Next.js server/read-model/action boundaries and the local database suites are both in scope.
- **Configured libraries:** `tea_use_playwright_utils=true`, but
  `@seontechnologies/playwright-utils` is absent from `package.json`; the two-gate mandate therefore
  does not bind and this remediation preserves the established vanilla Playwright conventions.
  Pact testing is irrelevant to this monolithic Next.js/Supabase boundary. One tool-list probe found
  no SmartBear Pact MCP tools (`pact_mcp_reachable=false`); no broker call was made.
- **Loaded guidance:** test levels, priorities, data factories, selective execution, CI/burn-in,
  test quality, the Playwright-utils mandate and full UI/API profile, fixture/network principles,
  Playwright CLI, and Pact MCP fallback guidance.
- **Trace-gate scope:** only `12.3-AC3` composed same-tenant provisioning-to-working-state evidence,
  `12.3-AC5` direct active-non-admin/anonymous production-boundary denial evidence, and the stale plus
  skipped P0 provisioning manifest invariant. Existing separate operator/onboarding evidence will be
  reused without duplicating its already-covered assertions.
- **Execution constraints:** edits stay in tests, fixtures/support, and this TEA output. Root retains
  ownership of specs, state files, git snapshots/commits, PR work, and the guarded production server.

## Step 2 — Identify Targets

The trace gate identifies three bounded P0 deficiencies. Existing operator-console tests, ready-tenant
onboarding tests, predicate units, RLS isolation tests, and browser dismissal coverage remain valid but
do not compose the missing evidence, so this run adds only the scenarios below.

| Target | Level | Priority | Acceptance/risk link | Coverage intent |
| --- | --- | --- | --- | --- |
| Same newly provisioned tenant from operator approval through first-Admin acceptance, five real configuration/user operations, and a fresh working-state projection | Supabase-backed integration journey | P0 | 12.3-AC3; R-1201/R-1202/R-1204/R-1205 | Exercise production provisioning and invitation-acceptance RPCs, command-envelope settings/pricing writes, a real invited role-bearing membership, then reload the production checklist read model. Capture a separate existing tenant before and after and require identical protected-row state. |
| Active non-admin and anonymous callers cross the production onboarding read and dismissal-action boundaries | Supabase-backed integration boundary | P0 | 12.3-AC5; R-1205/R-1206/R-1207 | Call the real tenant resolver, checklist read model, and dismiss/restore action using real local-stack clients; require identical generic/no-data responses, unchanged membership/checklist facts and audit rows, and no tenant-existence signal. |
| Provisioning manifest activation and non-granting platform-only capability remain coherent | Node unit/static invariant | P0 | 12.1 static invariant cited by the Epic 12 gate | Replace the stale pending-state expectation with the active state and execute the currently skipped combined manifest/capability invariant. |

No public HTTP/provider contract is introduced, so no HTTP or Pact contract artifact is added. The
API/action worker covers AC5 directly at the production server-action/read-model boundary. No new browser
scenario is needed: the missing composition and authorization proof sits at authenticated RPC,
command-envelope, read-model, action, and database boundaries and can be verified deterministically on
the required local Supabase stack. Browser exploration remains unavailable because `playwright-cli` is
not installed and no guarded production server is active.

## Step 3 — Generate and Aggregate Tests

- **Execution mode:** requested `auto`; capability probing resolved to **subagent**. The runtime allowed
  two parallel delegates for AC3 and AC5. A third backend launch hit the agent-thread limit, so the
  bounded manifest worker contract was completed locally while the two delegates ran; all three required
  worker JSON outputs are valid and contain the exact generated file contents.
- **12.3-AC3:** one P0 local-Supabase integration journey now captures an existing tenant before operator
  provisioning, provisions and activates a different tenant through the real signed RPC/invitation
  boundaries, executes five successful production operations (company identity, VAT display, quote
  terms, active work role, and role-bearing invitation), reloads through the production checklist read
  model, and compares the existing tenant's protected rows byte-for-byte after the lifecycle.
- **12.3-AC5:** one P0 integration boundary test injects real active-non-admin and anonymous clients while
  retaining the real tenant resolver. Both callers cross the production read and dismiss/restore action
  boundaries, receive indistinguishable generic/no-data results, produce no revalidation, and leave
  membership presentation state, checklist facts, and onboarding audit counts unchanged.
- **Manifest invariant:** the stale pending-provisioning expectation now pins the active platform module,
  and the former skipped P0 combined permission invariant executes against the full current metadata,
  including the empty global-role and tenant-role grants.
- **Generated scope:** 4 P0 assertions/scenarios across 3 test files, plus one retained-first-admin fixture
  extension. No production source, migration, specification, browser test, or Pact artifact changed.
- **Aggregation record:** `C:/tmp/tea-automate-summary-2026-09-21T15-24-46-279Z.json`.

## Step 4 — Validate and Summarize

### Validation evidence

- `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run
  tests/integration/read-models/onboarding-authorization-boundaries.int.test.ts
  tests/integration/journeys/first-admin-onboarding-lifecycle.int.test.ts` — **PASS** in the clean
  verification checkout: 2 files passed, 2 tests executed, 2 passed, 0 failed, 0 skipped.
- `node --experimental-strip-types --import ./tests/support/register.mjs --test
  ./tests/unit/scope/manifest-invariants.test.ts` — **PASS:** 8 tests executed, 8 passed, 0 failed,
  0 skipped, 0 cancelled, 0 todo. The runner emitted only the repository's existing typeless-package
  performance warning.
- `pnpm run typecheck` — **PASS** with no diagnostics in applied verification tree
  `3a781267f407251f83283b6503acdca70eebc0e7`.
- Focused ESLint over the factory and three test files — **PASS** with no output.
- `git diff --check` in the clean verification checkout — **PASS** with no output.
- Focused quality scan — **PASS:** no committed `skip`, `fixme`, focused test, debug logging, hard wait,
  or Playwright network-interception pattern in the generated tests.

### Files created or updated

- `tests/integration/journeys/first-admin-onboarding-lifecycle.int.test.ts` — one P0 composed AC3
  journey at real operator RPC, first-Admin acceptance, command, invitation, and fresh read-model
  boundaries.
- `tests/integration/read-models/onboarding-authorization-boundaries.int.test.ts` — one P0 AC5
  production-boundary denial/non-mutation scenario for active non-admin and anonymous callers.
- `tests/unit/scope/manifest-invariants.test.ts` — two executable P0 static/permission invariants; the
  stale pending assertion and skip are removed.
- `tests/factories/platform-operators.ts` — retained accepted-first-admin fixture with pre-provisioning
  observation and scoped cleanup for its provisioned tenant, request, audit rows, Auth user, and platform
  fixture.
- `_bmad-output/test-artifacts/automation-summary.md` — durable TEA workflow output.

### Definition of done

- Both trace-gate gaps now have direct, deterministic production-boundary coverage without duplicating
  the existing ready-tenant browser, predicate unit, operator-console, or RLS tests.
- The AC3 test does not seed past any claimed transition: provisioning and first-Admin activation use
  their real authenticated boundaries, all five checklist facts come from successful production writes,
  and working state is read again from a fresh production projection.
- The existing-tenant snapshot begins before provisioning and is compared after the complete lifecycle.
  The fixture's teardown was executed by the green database run and preserves FK cascades.
- AC5 uses real active-non-admin and anonymous clients plus the real tenant resolver. Both identities
  receive the same generic results for read, dismiss, and restore and leave the independently queried
  membership, checklist, and audit state unchanged.
- No production source, migration, dependency, specification, browser suite, or external email path
  changed. No browser or server resource was launched.

### Playwright Utils deviations

- `tests/integration/journeys/first-admin-onboarding-lifecycle.int.test.ts:1`: this required proof runs
  under Vitest at local Supabase RPC/command/read-model boundaries; the Playwright utilities package is
  not installed and no browser primitive is used.
- `tests/integration/read-models/onboarding-authorization-boundaries.int.test.ts:1`: this is a Vitest
  server-boundary authorization test; the Playwright utilities package is not installed and no HTTP or
  browser request fixture is involved.

### Pact.js Utils deviations

None. No consumer-provider contract artifact exists in this scope.

**Recommended next workflow:** rerun `bmad-testarch-trace` for Epic 12 against this executed evidence and
refresh the deterministic gate decision.

---

## Story 13.3 — Step 1: Preflight and context

**Execution mode:** BMad-integrated, post-implementation coverage expansion.

**Detected stack:** fullstack. The repository contains Next.js, a configured Playwright suite, and Vitest integration/RLS coverage; the separate Node test runner covers unit contracts. Both frontend and backend framework prerequisites are present.

**Loaded inputs:** Story 13.3 specification; Epic 13 context; Epic 13 test design; the Story 13.3 ATDD checklist and API/E2E worker handoffs; `_bmad/tea/config.yaml`; `package.json`; `playwright.config.ts`; `vitest.config.ts`; existing Story 13.3 email/outbox, jobs, containment, RLS, manifest, and notifications tests; and the current server outbox, read model, producer, and queue component sources.

**Automation configuration:** Playwright utilities are enabled, browser automation is `auto`, Pact utilities/MCP are configured, and stack detection is `auto`. Browser coverage exists, so the full UI+API Playwright-utils profile applies. Pact/provider-contract generation does not apply: Story 13.3 explicitly prohibits a provider boundary, and no provider endpoint exists.

**Core knowledge applied:** test-level selection, risk priority, factory isolation, selective execution, CI burn-in, and quality criteria. The current ATDD output already maps all six acceptance criteria and created 20 red-phase tests. This expansion will inspect their implemented green coverage before adding only uncovered regression tests.

## Story 13.3 — Step 2: Automation targets and coverage plan

Browser exploration was skipped: `playwright-cli` is not installed, and no running local target may be adopted under the task constraints. Source analysis covers the existing authenticated `/notifications` route, the sole `/api/jobs/run` lane, migration/RPC boundary, server read model, and containment guard. No OpenAPI/Swagger document or provider endpoint exists. Pact generation is therefore inapplicable because Story 13.3 intentionally has no external provider contract.

| Acceptance area | Existing green coverage | Expansion target | Level / priority |
| --- | --- | --- | --- |
| AC1 tenant-local dedupe | Unit + real PostgreSQL concurrent reconciliation | Template recipient must match the enqueue recipient, and the persisted RPC parameter must contain only the entitlement projection | Unit / P0 |
| AC2 claims, lease, backoff | Unit + PostgreSQL `SKIP LOCKED`, stale lease, fixed retries | Covered; do not duplicate | — |
| AC3 suppression scope | Unit + integration/RLS matching and non-matching scope | Covered; do not duplicate | — |
| AC4 dark posture and containment | Unit/integration dark no-send plus source-graph bites | Verify projection normalization cannot persist Admin/raw source fields | Unit / P0 |
| AC5 Admin queue isolation | RLS and four Playwright journeys | Covered; do not duplicate | — |
| AC6 schema/manifest/H4 | RLS inventory and migration-reset evidence | Covered; do not duplicate | — |

The plan is selective and regression-focused. One P0 unit scenario closes the only identified gap between the stated projection boundary and its persisted RPC input; database, browser, and static tests already cover the other acceptance outcomes at their appropriate levels.

## Story 13.3 — Step 3: Generated coverage and aggregation

Execution used the configured capability probe and the supported subagent path. API and E2E workers found no non-duplicative test target. The backend worker generated one P0 Node unit regression in `tests/unit/server/email/outbox.test.ts`; the aggregation wrote that test without creating fixtures.

| Generated level | Tests | Files | Fixture needs |
| --- | ---: | ---: | ---: |
| API | 0 | 0 | none |
| E2E | 0 | 0 | none |
| Backend unit | 1 | 1 | none |

**Added test:** `13.3-UNIT-PROJECTION-001` verifies that a mismatch between the recipient and template recipient stops before the outbox RPC, and that extra raw/Admin source fields are stripped from the persisted template parameters.

Worker outputs and aggregated counts are recorded in `C:/tmp/tea-automate-*-2026-09-23T20-42-24-919.json`. The API and E2E workers correctly produced zero tests because the existing ATDD green suite already covers those surfaces.

## Story 13.3 — Step 4: Validation and final summary

**Validation checklist:** framework and test structure are present; BMad-integrated AC mapping and the existing ATDD outputs were reviewed; the generated Node unit test is isolated, deterministic, dependency-free, and has a P0/AC/test-ID label; no fixture or helper is required; no browser CLI session was opened; no CDC interaction applies. Existing project test conventions intentionally use the Node runner and focused in-memory stubs for this server boundary.

**Executed evidence:**

```powershell
node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/server/email/outbox.test.ts
# 3 passed, 0 failed, 0 skipped

pnpm typecheck
# passed
```

**Coverage outcome:** Story 13.3 now has a regression check for AC1/AC4 recipient consistency and persistence allow-listing in addition to its existing ATDD-derived unit, real-PostgreSQL/RLS, containment, and browser coverage. No API, E2E, fixture, factory, or helper change was justified.

**Files updated:** `tests/unit/server/email/outbox.test.ts`; this automation summary. The story specification was not modified.

**Assumptions and residual risk:** the pre-13.4 provider prohibition makes external contract coverage inapplicable. Required PostgreSQL and browser suites were already present and were not rerun because this change is isolated to a Node unit boundary; their existing green evidence remains recorded in the Story 13.3 specification.

**Recommended next workflow:** a targeted `bmad-testarch-test-review` or implementation review may use this updated automation evidence; no additional automation expansion is currently indicated.

# Test Automation Expansion — Story 13.2 (In-App Notifications — Bell, Center, and Preferences)

## Step 1 — Preflight & Context

- **Stack:** fullstack. `package.json`, `vitest.config.ts`, and `playwright.config.ts` establish the existing Node unit, Vitest integration/RLS, and Playwright browser lanes; framework scaffolding is present.
- **Mode:** BMad-integrated Create. The supplied Story 13.2 specification, its completed ATDD checklist, and Epic 13 test design were loaded with the notification implementation and existing tests.
- **ATDD duplicate check:** the checklist and implementation already cover the primary emission, dedupe, all-role bell, read/retry, filtering/deep link, preferences, keyboard/focus, empty, never-run, and stale-state scenarios. The target audit will select only a materially unproven boundary.
- **TEA configuration:** Playwright Utils, Pact.js Utils, Pact MCP, and browser automation are enabled in configuration. Browser tests exist, so the full UI+API utility profile was loaded. The project has no Pact indicators or consumer/provider boundary for this same-deployment story, the configured utility packages are absent, and SmartBear Pact tools are unavailable; no dependency or contract artifact will be invented.
- **Resource posture:** this workflow will not start, stop, reset, or adopt local services. DB-backed evidence remains executable only where an already-running authorized local stack is available; an unavailable required lane is recorded as skipped or blocked rather than passed.

## Step 2 — Identify Targets

### Acceptance-criteria audit

| Acceptance criterion | Existing ATDD/implementation evidence | Target decision |
| --- | --- | --- |
| AC1 entitled projection and stored route | `13.2-INT-001` exercises emitted recipient rows, safe content, unread state, and stored routes. | Covered; no duplicate. |
| AC2 retry/concurrency dedupe and terminal suppression | `13.2-INT-002` runs six concurrent scans and checks an accepted terminal quote. | Covered; no duplicate. |
| AC3 all-role bell and personal RLS | Integration covers own/foreign/anonymous/raw-write negatives; five P0 browser role journeys prove `9+` bell behavior and no nav entry. | Covered at appropriate levels. |
| AC4 personal read, persisted route, filters, rollback | Integration proves idempotent acknowledgement; browser coverage owns deep-link, combined filters, one/all read, and injected rollback. | Covered at appropriate levels. |
| AC5 preferences | Integration owns database constraints; browser coverage owns grouping, persisted allowed preference, required essential control, and inactive Swedish email copy. | Covered at appropriate levels. |
| AC6 schema, accessibility, and honest states | Integration asserts forced RLS; browser coverage covers keyboard/focus plus empty, never-run, and stale copy. | Covered except for the planned pure view-model allocation below. |

### Selected coverage target

| Target | Level | Priority | Acceptance/risk link | Why this level |
| --- | --- | --- | --- | --- |
| `13.2-UNIT-002`: deterministic notification presentation helpers cap unread display at `9+`, order latest rows, apply module/category/read/date filters, and format hidden/never/failed/elapsed scan status. | Unit | P1 | AC3, AC4, AC6; R-1315 | The Epic 13 test design allocates these pure view-model facts to a unit lane. Existing browser tests validate the journey but do not make deterministic sorting, filtering, or copy branches cheap to diagnose. |

The test will introduce a small pure view-model module and consume it from the existing bell and center components. It will not duplicate database authority, RLS, producer dedupe, route persistence, preference enforcement, or browser accessibility assertions. No API/provider contract exists: the application and Supabase persistence form one deployment boundary, there is no OpenAPI/Pact configuration, and no Pact test is selected.

### Exploration and source analysis

- `playwright-cli` is not installed. Following the configured fallback, browser discovery was skipped and selectors/contracts were read from the green ATDD Playwright suite rather than guessed.
- Source analysis found Next route handlers for personal reads, read-all, preference GET/PUT, and the authenticated job runner. The producer remains server-contained; no external consumer/provider or message-queue contract belongs to this story.

## Step 3 — Generate and Aggregate Tests

- **Execution mode:** requested `auto`; capability probe enabled; runtime supports subagents but has no agent-team capability; resolved to **subagent**. The API, E2E, and backend workers were dispatched and all returned valid successful JSON outputs.
- **API worker:** 0 tests. Existing route and integration coverage owns the API/RLS surface; no Pact consumer/provider boundary or provider endpoint map applies.
- **E2E worker:** 0 tests. The 16 existing browser scenarios cover the full personal bell/center/preferences journey, including the required failure and accessibility paths. Playwright CLI was unavailable, so no browser was launched.
- **Backend worker:** generated one unit file containing four P1 assertions for `13.2-UNIT-002`. The aggregate added the pure `src/components/notifications/notification-presentation.ts` helper and adopted it in the bell and center, then wrote `tests/unit/components/notifications/notification-presentation.test.ts`.
- **Fixtures:** 0. The new helper is deterministic and I/O-free, so no DB, HTTP, browser, or shared fixture was created.
- **Coverage added:** unread count/cap, non-mutating latest-first ordering, combined module/category/read/date filtering, and hidden/never/failed/elapsed Swedish scan-status copy. Integration/RLS, producer, preference, stored-route, and browser coverage remain in their existing suites.
- **Priority distribution:** P0 0; P1 4; P2 0; P3 0. Total generated: 4 assertions in 1 unit file.

## Step 4 — Validation and Final Summary

### Validation evidence

- `pnpm exec node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/server/notifications/registry.test.ts tests/unit/components/notifications/notification-presentation.test.ts` — **PASS:** 6 tests, 0 failed, skipped, todo, or cancelled. This includes all four new `13.2-UNIT-002` assertions and the existing category-registry guard.
- `pnpm exec eslint src/components/notifications/notification-presentation.ts src/components/notifications/NotificationBell.tsx src/components/notifications/NotificationsCenter.tsx tests/unit/components/notifications/notification-presentation.test.ts` — **PASS.**
- `pnpm typecheck` — **PASS.**
- `git diff --check` — **PASS.**

### Quality and checklist result

- Framework readiness, BMad-integrated inputs, acceptance mapping, existing ATDD review, level/priority selection, and duplicate-coverage avoidance are complete.
- The generated unit suite is deterministic, isolated, I/O-free, priority-tagged, and has no hard waits, network dependency, conditional assertions, or shared state. No fixture/factory/helper infrastructure was needed beyond the pure presentation module.
- API, CDC/Pact, and new E2E generation are **N/A** for the selected unit target. No CLI browser session was created; the temporary subagent JSON records and aggregate summary were removed after successful aggregation.
- The test plan deliberately does not claim a local DB/RLS or Playwright run. Those existing acceptance suites require the authorized local Supabase and production-mode browser environment; no service was started, stopped, reset, or adopted.

### Files created or updated

- `src/components/notifications/notification-presentation.ts` — shared pure presentation helpers.
- `src/components/notifications/NotificationBell.tsx` — uses deterministic unread formatting and latest-first ordering.
- `src/components/notifications/NotificationsCenter.tsx` — uses shared sorting, combined filtering, and honest scan-status copy.
- `tests/unit/components/notifications/notification-presentation.test.ts` — four P1 `13.2-UNIT-002` assertions.
- `_bmad-output/test-artifacts/automation-summary.md` — this completed workflow record.

**Recommended next workflow:** `bmad-testarch-test-review` for an independent quality review, then `bmad-testarch-trace` if the Story 13.2 acceptance matrix needs refreshed evidence after the final required DB and browser lanes run.

---

# Test Automation Expansion — Story 13.4: Email Sending Activation

## Step 1 — Preflight and Context

- **Mode and stack:** BMad-integrated Create mode for a full-stack Next.js application. Node's test runner covers unit/static suites; Vitest covers required local-Supabase integration/RLS suites; Playwright covers browser journeys. `package.json`, `vitest.config.ts`, and `playwright.config.ts` confirm framework readiness.
- **Inputs:** Story 13.4 specification, ADR-B011, Epic 13 test design, the completed Story 13.4 ATDD checklist, `_bmad/tea/config.yaml`, current source/migrations, and the existing email/provider/outbox/unsubscribe/quote tests.
- **Automation settings:** Playwright utilities, Pact utilities, Pact MCP, and browser automation are configured. The application has browser tests, so the full UI/API utility profile applies. No Pact/OpenAPI or external consumer-provider contract exists; the sandbox adapter is a local injected seam, so CDC generation is inapplicable.
- **Knowledge applied:** test-level selection, P0 prioritization for delivery and recipient integrity, fixture cleanup, selective execution, CI burn-in hygiene, and deterministic test-quality criteria.

## Step 2 — Acceptance Mapping and Coverage Plan

| Acceptance area | Existing ATDD/green coverage | Automation decision |
| --- | --- | --- |
| AC1 sandbox provider outcome | Provider unit contract and artifact-backed outbox integration | Covered; no duplicate API/E2E test. |
| AC2 closed release posture | Unit release-control matrix and integration no-call assertion | Covered. |
| AC3 claims, retries, dedupe, suppression | Existing outbox integration/RLS suites | Covered. |
| AC4 preferences and unsubscribe scope | Preference browser journey plus unsubscribe RLS cases | Covered. |
| AC5 uniform public token response and shell isolation | Public unsubscribe browser journey and containment test | Covered. |
| AC6 quote delivery authority and recipient snapshot | Existing tests cover PDF/artifact authority and terminal reminder states; no test preserved the selected recipient after a later CRM edit | Add one P0 local-Supabase integration regression. |

The coverage plan is selective. API generation found no separately hosted provider endpoint, OpenAPI document, or nonduplicative app route target. Browser generation found the existing authenticated preference and anonymous unsubscribe suites already own the relevant user journeys. The selected P0 test uses the real authenticated quote-send command and database boundary because recipient freezing and its persistence are transactional behavior.

## Step 3 — Adaptive Generation and Aggregation

- **Execution resolution:** configuration requested `auto`; capability probing found subagents available and no agent-team capability, so three subagents ran in parallel.
- **API worker:** 0 tests; no external provider/API contract and current route coverage is sufficient.
- **E2E worker:** 0 tests; existing preference and public-token suites cover all browser-suitable Story 13.4 paths.
- **Backend worker:** 1 P0 integration test in `tests/integration/email/quote-delivery-recipient-snapshot.int.test.ts`.
- **Fixtures/helpers:** 0 created. The test reuses the two-tenant fixture, authenticated server client, current-PDF helper, local-stack gate, and cleanup conventions.
- **Generated regression:** after an authorized sender selects a customer and the command queues the quote delivery, a later CRM email update cannot change `recipient_normalized`, `recipient_hash`, or the selected customer source persisted on the outbox row.

## Step 4 — Validation and Final Summary

### Validation evidence

- `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/email/quote-delivery-recipient-snapshot.int.test.ts` — **PASS:** 1 file, 1 executed test, 1 passed, 0 skipped.
- `pnpm exec eslint tests/integration/email/quote-delivery-recipient-snapshot.int.test.ts` — **PASS.**
- `pnpm run typecheck` — **PASS.**
- `git diff --check` — **PASS.**

### Definition of done

- All six Story 13.4 acceptance criteria were mapped against the existing ATDD-derived green suite.
- The new test closes the AC6 gap without duplicating the existing provider, release posture, RLS, PDF-authority, terminal-reminder, or browser evidence.
- The test has a P0 tag, unique fixture data, real local-Supabase command/persistence boundaries, deterministic assertions, and cleanup in `finally`; it uses no external provider, hard wait, browser session, conditional UI flow, or shared state.
- Pact/CDC is explicitly N/A because no external provider endpoint, provider contract, OpenAPI definition, or Pact configuration exists in this scope.

### Files created or updated

- `tests/integration/email/quote-delivery-recipient-snapshot.int.test.ts` — P0 AC6 recipient-snapshot immutability regression.
- `_bmad-output/test-artifacts/automation-summary.md` — completed workflow record.

**Recommended next workflow:** run `bmad-testarch-test-review` for an independent test-quality review, then refresh Story 13.4 traceability evidence with `bmad-testarch-trace`.

---

# Test Automation Expansion — Epic 13 Trace-Gate Remediation for Story 13.4

## Step 1 — Preflight and Context

- **Mode and stack:** BMad-integrated Create mode for the full-stack Next.js application. The Node test runner, Vitest integration/RLS lane, and Playwright browser lane are configured and present.
- **Remediation oracle:** the blocking Epic 13 trace report records 23/26 P0 requirements as FULL and identifies only `13.4-AC6`, `13.4-AC7`, and `13.4-AC8` as PARTIAL. This run targets their named executing branches without duplicating already credited recipient-freeze, artifact-currentness, provider-gate, suppression, or browser coverage.
- **Inputs loaded:** Story 13.4 specification; Epic 13 test design; Story 13.4 ATDD checklist; Epic 13 traceability report; TEA configuration; test-runner configuration; current migrations/source; and existing quote-delivery, outbox, reminder, recovery, and transaction tests.
- **Automation settings:** the full UI/API Playwright profile was reviewed because browser tests exist. The Playwright utilities flag is enabled but `@seontechnologies/playwright-utils` is not installed, so its mandate does not bind generated files. The selected gaps are database/producer transaction boundaries, so no new Playwright file is planned.
- **Pact posture:** contract testing is not relevant to this same-deployment Supabase/Next.js boundary. SmartBear Pact MCP tools are not available (`pact_mcp_reachable: false`); no broker data or provider states are claimed.
- **Quality posture:** all three gaps are P0 data-integrity/delivery-truth branches. Tests must execute against the real local database boundary, keep assertions falsifiable, preserve required-suite skips as missing evidence, and report any absent reachable implementation instead of weakening the acceptance criterion.

## Step 2 — Automation Targets and Coverage Plan

Browser exploration was skipped because `playwright-cli` is unavailable and the trace gaps are database/producer transaction boundaries with no selector uncertainty. Source and migration analysis found no OpenAPI/Pact boundary.

| Requirement | Existing credited evidence | Selected P0 automation target | Reachability finding |
| --- | --- | --- | --- |
| `13.4-AC6` recipient change | Sender selection validation and immutable snapshot after later CRM edit | Exercise a pending-delivery recipient replacement that cancels the old delivery and creates a fresh authorized delivery | No cancel/reissue command, RPC, route, or state transition exists. A passing executing test cannot be authored without product behavior; no skipped or hollow test will be counted. |
| `13.4-AC7` five reminder stops | Current/private PDF checks and a five-state in-memory processor seam | Expand the real database producer case from one terminal status to five independently visible statuses at enqueue; require a claimed-send database recheck before adapter submission | The due-follow-up producer can prove the enqueue boundary for stored states `accepted`, `rejected`, `lost` (withdrawal/lost), `superseded`, and `expired`. The activated email outbox processor has no reminder quote linkage or terminal-state recheck, so the provider-boundary half is unreachable. |
| `13.4-AC8` preparation/finalization failures | Success path, artifact claim/consume, and missing-artifact retry | Inject malformed artifact preparation and forced audit failure inside finalization/enqueue; assert the quote remains draft and no outbox, artifact, queued/sent event, provider ID, or sent state survives | Database rollback is reachable. Artifact preparation currently occurs inside the same transaction and no code writes `orphaned`/`invalidated` recovery state or a recovery audit event, so the required durable recovery evidence is absent. |

The scope is selective: modify the existing producer integration case rather than add duplicate reminder coverage, and add one focused email transaction-failure integration file. No API, browser, fixture-library, or contract test is justified. The run will preserve PARTIAL status wherever required product behavior is absent.

## Step 3 — Adaptive Generation and Aggregation

- **Execution resolution:** configuration requested `auto`; capability probing resolved to `SUBAGENT`. API, E2E, and backend workers were launched for the full-stack repository and their outputs were aggregated only after all completed.
- **API worker:** 0 tests. The authenticated job route only dispatches the backend producers, and no endpoint can supply the missing transaction or provider-boundary evidence.
- **E2E worker:** 0 tests. There is no recipient-reissue UI or browser journey for the database and provider-submission invariants.
- **Backend worker:** 7 P0 branch cases across two files: five stored terminal states at the real follow-up producer boundary plus malformed-artifact and forced-audit-failure finalization cases.
- **Fixtures/helpers:** 0 created. The generated coverage reuses the tenant factories, local-stack gate, authenticated server client, current-PDF helper, admin SQL helper, and the correlation-scoped forced-audit-failure control table.
- **Mandate deviations:** none. No Playwright or Pact artifact was generated.

### Generated coverage

- `tests/integration/notifications/notifications.atdd.int.test.ts` now runs the existing deduplicating producer case independently against `accepted`, `rejected`, `lost`, `superseded`, and `expired` quote versions and asserts that each produces zero due-follow-up notifications.
- `tests/integration/email/quote-delivery-finalization-failure.int.test.ts` rejects malformed delivery bytes before any write and injects an audit failure after finalization writes would begin, asserting rollback to draft with zero outbox rows, delivery artifacts, or delivery events.

### Deliberately uncovered requirements

- `13.4-AC6`: no reachable pending-delivery recipient cancellation/reissue transition or fresh-authorization workflow exists.
- `13.4-AC7`: the current follow-up producer emits in-app notifications instead of reminder outbox rows, and the outbox worker has no claimed-send terminal quote-status recheck before provider submission.
- `13.4-AC8`: artifact preparation is inside the finalization transaction; no implementation persists an `orphaned`/`invalidated` recovery state or durable recovery audit evidence after failure.

## Step 4 — Validation and Final Summary

### Validation evidence

- `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/notifications/notifications.atdd.int.test.ts tests/integration/email/quote-delivery-finalization-failure.int.test.ts` — **PASS:** 2 files, 13 executed tests, 13 passed, 0 failed, 0 skipped.
- `pnpm exec eslint tests/integration/notifications/notifications.atdd.int.test.ts tests/integration/email/quote-delivery-finalization-failure.int.test.ts` — **PASS.**
- `pnpm run typecheck` — **PASS.**
- `git diff --check` — **PASS.**

The first validation attempt executed eight tests and exposed an invalid direct transition fixture for terminal versions with open follow-ups. The fixture was corrected to follow the database lifecycle: accepted/superseded transitions close their anchored follow-up, rejected/lost/expired transitions first complete it, and lost also receives its required companion reason row. The complete required lane then passed.

### Coverage result

| Requirement | Executing coverage added | Result after this run |
| --- | --- | --- |
| `13.4-AC6` | None; the existing recipient snapshot test remains the only reachable proof | **PARTIAL:** pending-delivery cancellation and fresh authorization cannot be exercised because the transition does not exist. |
| `13.4-AC7` | Five independent P0 database/producer cases for `accepted`, `rejected`, `lost`, `superseded`, and `expired` | **PARTIAL:** enqueue prevention is now executable for all five stored states; claimed-send pre-provider recheck remains absent. |
| `13.4-AC8` | Two P0 cases for malformed bytes and injected finalization/audit failure rollback | **PARTIAL:** rollback and no-false-state behavior are executable; durable orphan/recovery state and recovery audit evidence remain absent. |

### Test and infrastructure summary

- **Targeted P0 cases added/expanded:** 7 (five terminal-state producer cases and two transaction-failure cases).
- **Test levels:** backend/database integration only. API: 0; E2E: 0; Pact/CDC: 0.
- **Files:** one existing integration file updated and one integration file created.
- **Fixtures/factories/helpers created:** 0. Existing self-cleaning tenant factories and database helpers were reused.
- **Playwright Utils deviations:** None. No Playwright artifact was generated, and the configured utility package is not installed.
- **Pact.js Utils deviations:** N/A. No consumer-provider contract boundary or contract artifact is in scope.
- **CLI/browser cleanup:** N/A. No browser session was opened.

### Files created or updated

- `tests/integration/notifications/notifications.atdd.int.test.ts` — five independent terminal-state lifecycle and producer no-enqueue cases while preserving the existing concurrency/deduplication test.
- `tests/integration/email/quote-delivery-finalization-failure.int.test.ts` — malformed artifact preparation and forced finalization/audit-failure rollback coverage.
- `_bmad-output/test-artifacts/automation-summary.md` — completed BMad automate workflow record.

### Definition of done and residual risks

- Framework readiness, BMad-integrated inputs, trace-gap mapping, existing ATDD review, P0 priority selection, and duplicate-coverage avoidance are complete.
- Generated tests use real local-Supabase boundaries, deterministic random identities, required-mode stack gating, existing cleanup, and no external provider or hard waits.
- No failing, skipped, placeholder, or weakened test is counted as coverage. The required run reported zero skips.
- The trace gate should remain PARTIAL for the three specific branches that require product behavior: AC6 cancel/reissue authorization, AC7 send-time terminal recheck, and AC8 durable recovery evidence.

**Recommended next workflow:** implement the three named product gaps under an approved story or ADR-backed task, add their executing tests, then rerun `bmad-testarch-trace` for Epic 13.

---

# Final E8a Test Automation Remediation — Epic 13 Story 13.4

## Step 1 — Preflight and Re-Gate Context

- **Mode and stack:** BMad-integrated Create mode for the full-stack Next.js application. Existing Node, Vitest, and Playwright configurations remain ready.
- **Re-gate oracle:** the first E8a re-gate remains at 23/26 P0 FULL, with exactly `13.4-AC6`, `13.4-AC7`, and `13.4-AC8` PARTIAL. The earlier remediation's five terminal-state producer cases and two finalization-failure cases are already credited and must not be duplicated.
- **Current-source check:** no pending-recipient cancellation/reissue transition, claimed-send terminal quote-state recheck, or durable artifact recovery/audit transition has appeared since the re-gate.
- **Scope:** test and test-artifact work only. No story specification, migration, command, route, worker, or other product code is changed by this pass.

## Step 2 — Final Automation Targets

| Requirement | Exact remaining branch | Executable against current behavior? | Decision |
| --- | --- | --- | --- |
| `13.4-AC6` | Change a pending delivery recipient, cancel the old delivery, and require newly authorized delivery | No command, RPC, route, or state transition exists | Generate no red, skipped, placeholder, or weakened test. |
| `13.4-AC7` | Recheck a claimed reminder's terminal quote state immediately before provider submission | The persisted reminder/outbox pipeline has no quote linkage or pre-adapter terminal recheck | Generate no seam-only duplicate and make no provider-boundary claim. |
| `13.4-AC8` | Persist durable `orphaned`/`invalidated` recovery truth and recovery audit evidence after preparation/finalization failure | Artifact preparation remains inside the rolled-back finalization transaction; no recovery transition or audit writer exists | Preserve the green rollback tests and generate no artificial recovery proof. |

The final plan contains no new API, browser, backend, contract, fixture, factory, or helper target. Product implementation is required before a passing test can prove any remaining branch.

## Step 3 — Adaptive Generation and Aggregation

- **Execution resolution:** `SUBAGENT` for the full-stack repository; API, E2E, and backend workers completed and returned valid structured outputs.
- **API worker:** 0 tests. The linked-recipient endpoint is read-only candidate discovery, the job route only invokes existing producers, and no recovery endpoint exists.
- **E2E worker:** 0 tests. No recipient-change, claimed-send eligibility, or recovery user journey is exposed.
- **Backend worker:** 0 tests. The three exact acceptance branches remain absent from commands, database transitions, and the provider-bound outbox path.
- **Generated files:** 0 test files; 0 fixtures; 0 helpers.
- **Priority coverage added:** P0 0, P1 0, P2 0, P3 0.
- **Playwright Utils deviations:** None. No Playwright artifact was generated.
- **Pact.js Utils deviations:** N/A. No contract artifact or consumer-provider boundary is in scope.

No repository test file was written during aggregation. This is the required fail-honest result: the workflow does not convert absent product behavior into nominal coverage.

## Step 4 — Validation and Final Result

### Validation evidence

- `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/notifications/notifications.atdd.int.test.ts tests/integration/email/quote-delivery-finalization-failure.int.test.ts` — **PASS:** 2 files, 13 executed tests, 13 passed, 0 failed, 0 skipped.
- `git diff --check` — **PASS.**

### Final-pass result

- **Tests generated:** 0.
- **Tests modified:** 0.
- **Tests executed for regression evidence:** 13 passed, 0 skipped.
- **Product behavior preventing new passing coverage:**
  - `13.4-AC6`: pending recipient replacement has no cancellation state transition or fresh-authorization operation.
  - `13.4-AC7`: a claimed reminder is not linked and rechecked against terminal quote state at the final pre-provider boundary.
  - `13.4-AC8`: failure cannot leave durable recovery truth because artifact preparation occurs inside the rolled-back transaction and no orphan/invalidated transition or recovery audit event is written.
- **Coverage claim:** none added. The re-gate remains 23/26 P0 FULL, with these three criteria PARTIAL.
- **Files updated by this final pass:** `_bmad-output/test-artifacts/automation-summary.md` only.

### Definition of done

- The final re-gate branches were mapped against current source and existing tests.
- API, browser, and backend workers all confirmed there is no nonduplicative passing target.
- No red, skipped, placeholder, seam-only, or weakened test was added.
- No story specification or product code was modified.
- The existing focused evidence remains green under required-stack execution with zero skips.

**Next required action:** implement the three missing product branches under approved scope, add executing P0 tests, and rerun the Epic 13 trace gate for 26/26 P0 FULL coverage.
