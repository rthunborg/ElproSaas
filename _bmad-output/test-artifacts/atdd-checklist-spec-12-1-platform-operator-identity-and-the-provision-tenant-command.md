---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-09-19'
storyId: '12.1'
storyKey: 'spec-12-1-platform-operator-identity-and-the-provision-tenant-command'
storyFile: 'C:\DEV\ElproSaas\_bmad-output\implementation-artifacts\spec-12-1-platform-operator-identity-and-the-provision-tenant-command.md'
atddChecklistPath: 'C:\DEV\ElproSaas\_bmad-output\test-artifacts\atdd-checklist-spec-12-1-platform-operator-identity-and-the-provision-tenant-command.md'
generatedTestFiles:
  - 'tests/unit/provisioning/provisioning-contract.test.ts'
  - 'tests/integration/commands/provision-tenant.int.test.ts'
  - 'tests/integration/rls/platform-operators.rls.test.ts'
  - 'tests/integration/rls/provisioning-migration-reset.int.test.ts'
  - 'tests/integration/rls/security-definer-search-path.rls.test.ts'
  - 'tests/unit/scope/manifest-invariants.test.ts'
inputDocuments:
  - '_bmad-output/implementation-artifacts/spec-12-1-platform-operator-identity-and-the-provision-tenant-command.md'
  - '_bmad-output/implementation-artifacts/epic-12-context.md'
  - '_bmad-output/test-artifacts/test-design-epic-12.md'
  - '_bmad/tea/config.yaml'
  - 'package.json'
  - 'playwright.config.ts'
  - 'vitest.config.ts'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/library-integration-mandate.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/playwright-utils-mandate.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/data-factories.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/component-tdd.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/test-quality.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/test-healing-patterns.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/selector-resilience.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/timing-debugging.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/overview.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/api-request.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/network-recorder.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/auth-session.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/intercept-network-call.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/recurse.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/log.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/file-utils.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/network-error-monitor.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/fixtures-composition.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/fixture-architecture.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/network-first.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/playwright-cli.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/confidence-gate.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/pact-mcp.md'
---

# ATDD Checklist: Story 12.1 — Platform Operator Identity and the Provision-Tenant Command

## Preflight and Context

- Mode: Create
- Detected stack: frontend (Next.js/React with configured Playwright and Vitest test frameworks)
- Story approval: `ready-for-dev`; ten explicit acceptance criteria are present under `## Tasks & Acceptance`.
- Test framework: `playwright.config.ts` and `vitest.config.ts` are present.
- Primary generated-test runner: Vitest, matching the story's unit, command-integration, and RLS targets.
- Playwright Utils: configured `true`, but `@seontechnologies/playwright-utils` is not installed; the two-gate mandate does not bind and no imports from that package will be generated.
- Pact relevance: not relevant to this monolithic Next.js/Supabase story; no Pact artifacts, Pact dependency, OpenAPI service contract, or microservice boundary was found.
- Pact broker: unreachable (SmartBear MCP tools not available). No contract artifact is generated, so provider-state fallback does not apply.
- Browser exploration: not needed because Story 12.1 has no UI acceptance surface and its test targets are explicitly named.

### Confidence Gate

Confidence: 9/10

Rationale: The story names the exact unit/integration/RLS scaffold paths and binds every acceptance behavior in `_bmad-output/implementation-artifacts/spec-12-1-platform-operator-identity-and-the-provision-tenant-command.md`; `_bmad-output/test-artifacts/test-design-epic-12.md` supplies the 12.1 test IDs and repository-native levels.

Unknowns:

- Decision 8A production authority, signer, database catalogue, owner/grants, and enforcement migration do not exist yet. Existing Decision 7C code is historical/incomplete evidence; red-phase scaffolds must assert the superseding catalogue/RPC/attestation behavior and removal of legacy/service-role authority.
- Local Supabase availability is not assumed during generation; required DB evidence is deferred to the implementation phase with `SUPABASE_TEST_REQUIRED=1`.

## Generation Mode

AI generation is selected. Story 12.1 exposes no operator UI; the acceptance surface is pure provisioning logic plus command/database/RLS behavior, and the spec and Epic 12 test design provide the intended module, migration, and test paths. Browser recording would not add evidence for these criteria.

## Test Strategy

All Story 12.1 scenarios are P0 because they govern privileged tenant creation, authorization, tenant isolation, invitation capability safety, or durable recovery with no safe workaround. Pure schema/canonicalization/state predicates are unit-level. Transaction, catalog, RLS, concurrency, Auth-handoff, and audit behavior remain integration-level. No browser or component coverage is generated for this story.

| AC | Primary red-phase coverage | Level | Priority | Non-duplicated responsibility |
| --- | --- | --- | --- | --- |
| AC1 — complete stateless preview and zero writes | 12.1-INT-005 | Command/DB integration | P0 | Asserts the full preview contract and byte-for-byte DB/audit/Auth invariance; unit schema cases do not duplicate persistence evidence. |
| AC2 — approved atomic provisioning before Auth | 12.1-INT-003, 12.1-INT-004 | Command/DB + fault integration | P0 | Proves exact persisted facts, write ordering, and rollback at the transactional boundary. |
| AC3 — request/identity replay, archived collision, race | 12.1-INT-006, 12.1-INT-007 | Command/DB + concurrency integration | P0 | Proves durable uniqueness and exact replay/conflict outcomes against real constraints. |
| AC4 — strict validation, canonical identity, stale preview, no writes | 12.1-UNIT-001, 12.1-UNIT-002, 12.1-INT-005 | Unit + command/DB integration | P0 | Units own the decision table; integration owns mismatch/staleness and zero-write effects. |
| AC5 — truthful provider states, reconciliation, bounded retry | 12.1-UNIT-003, 12.1-INT-008, 12.1-INT-009 | Unit state machine + command/Auth integration | P0 | Unit owns legal transitions/readiness; integration owns call count, attempt persistence, and response-loss recovery. |
| AC6 — hash-only bound invitation token lifecycle | 12.1-INT-009, 12.1-INT-012 | Command/Auth + audit integration | P0 | Proves fresh 32-byte token generation per dispatch, SHA-256-only persistence, atomic prior-hash revocation, old-link rejection, current-binding acceptance, and absence of raw token from persisted and outward surfaces. |
| AC7 — exact readiness predicate | 12.1-UNIT-003, 12.1-INT-009 | Unit + command/Auth integration | P0 | Unit enumerates each predicate fact; integration proves the Epic 11 activation seam. |
| AC8 — non-granting platform permission classification | 12.1-STATIC-001, existing manifest/authz guardrails | Static/unit/catalog | P0 | Scaffolds assert the explicit row and absence from tenant consumers without introducing UI coverage. |
| AC9 — generic denial, hostile search path, no leakage/effects | 12.1-INT-001, 12.1-INT-002, 12.1-INT-010, 12.1-INT-011 | RLS/catalog/authorization integration | P0 | Separates allow-list visibility, DEFINER hardening, caller denial, and foreign-tenant invariance. |
| AC10 — reset/catalog/grants/owner/search path/PUBLIC/audit/inventory | 12.1-INT-002, 12.1-INT-013 | Catalog + migration-reset integration | P0 | Catalog test owns function hardening; reset test owns empty-database shape and manifest inventory. |
| AC11 — dual JWT/HMAC authority, DB catalogue, exact reservation/outcome | 12.1-INT-002, 12.1-INT-003, 12.1-INT-005, 12.1-INT-008..010, 12.1-INT-013 | Catalog + command/DB/Auth integration | P0 | Proves least-privilege owner/grants, full attestation negative matrix, DB/TypeScript catalogue coherence, durable-fact provider input, exact-generation outcomes, and zero legacy/service-role fallback. |

### Red-Phase Contract

- Every acceptance scaffold is checked in as `test.skip()` so the repository remains runnable before Story 12.1 implementation.
- To activate RED, remove `test.skip()` only for the implementation task currently being developed, run that focused test, and confirm the failure is caused by the missing production contract—not fixture setup—before writing implementation code.
- Unit scaffolds dynamically resolve the owner-approved production module path when activated. Integration scaffolds assert `platform_operators`, the migration-owned insert-only baseline catalogue and TypeScript coherence mirror, `is_platform_operator()`, the sole normal-JWT/server-HMAC `provision_tenant` RPC, dedicated owner/grants/Vault filter, signed reservation/outcome, and provisioning state.
- Assertions are behavior-bearing; none treats a mock call, optional result, or setup-only condition as acceptance evidence.

## Red-Phase Test Scaffolds Created

| Artifact | Change | Tests | Coverage |
| --- | --- | ---: | --- |
| [`tests/unit/provisioning/provisioning-contract.test.ts`](../../tests/unit/provisioning/provisioning-contract.test.ts) | Created (116 lines) | 3 | 12.1-UNIT-001..003: decoder allow-list, Swedish identity canonicalization, transitions/readiness. |
| [`tests/integration/commands/provision-tenant.int.test.ts`](../../tests/integration/commands/provision-tenant.int.test.ts) | Created (208 lines) | 8 | 12.1-INT-003..009 and INT-012: atomicity, rollback, preview, replay/race, Auth handoff, token lifecycle, audit. |
| [`tests/integration/rls/platform-operators.rls.test.ts`](../../tests/integration/rls/platform-operators.rls.test.ts) | Created (57 lines) | 3 | 12.1-INT-001, INT-010, INT-011: allow-list visibility, generic denial, tenant isolation. |
| [`tests/integration/rls/provisioning-migration-reset.int.test.ts`](../../tests/integration/rls/provisioning-migration-reset.int.test.ts) | Created (55 lines) | 1 | 12.1-INT-013: clean-reset catalog, durable identity uniqueness, DEFINER/PUBLIC hardening. |
| [`tests/integration/rls/security-definer-search-path.rls.test.ts`](../../tests/integration/rls/security-definer-search-path.rls.test.ts) | Appended (1 scaffold) | 1 | 12.1-INT-002: hostile search-path negative and approved function inventory. |
| [`tests/unit/scope/manifest-invariants.test.ts`](../../tests/unit/scope/manifest-invariants.test.ts) | Appended (1 scaffold) | 1 | 12.1-STATIC-001: platform activation plus non-granting tenant-RBAC metadata. |

Total: 17 P0 scaffolds (3 unit, 13 integration, 1 static); 0 E2E and 0 component tests because Story 12.1 has no UI surface.

## Data Infrastructure

- [`tests/factories/platform-operators.ts`](../../tests/factories/platform-operators.ts) adds one typed Story 12.1 factory module.
- `createPlatformOperatorFixture()` composes the repository-native two-tenant fixture, inserts one explicit operator allow-list row, exposes operator/tenant-admin/orphan/anonymous identities, and pairs setup with cleanup.
- `createStrictProvisioningRequest()` generates a unique Luhn-valid Swedish organization number, VAT identity, request UUID, and first-Admin email. Its `standard-se` baseline ID/version must be reconciled with the first published immutable catalogue entry when production code lands.
- Command-driver functions are intentional red seams. Wire them to the real server-only provisioning command boundary; do not replace them with behavior mocks.
- No Playwright fixture, merged fixture, browser session, or `data-testid` is required. No browser was launched.

### External Provider Mock Requirements

The command integration harness needs a deterministic server-side Auth Admin adapter with these outcomes; it must never expose or persist the raw invitation token:

| Outcome | Required observation |
| --- | --- |
| accepted | One provider call, `first_admin_invite_requested`, no delivery claim. |
| definitive failure | One provider call, sanitized outcome, `first_admin_invite_failed`. |
| timeout/lost response | One provider call, `first_admin_invite_unknown`, no automatic resend. |
| explicit retry after reconciliation | Replay/reconciliation never rotate or dispatch. Signed `reserve_dispatch` installs the fresh SHA-256/current generation and returns the only permitted provider identity facts; one call follows, then a separately signed exact-reservation outcome. Attempts 1–3 share one signed approval generation; attempt 4 needs fresh preview/approval with a new monotonic generation. |

## Implementation Checklist

- [ ] Publish the migration-owned, insert-only database baseline row (ID/version/canonical content/hash), deny runtime DML, retain `TENANT_PROVISIONING_BASELINES` only as the preview/build-time mirror, and prove exact DB/TypeScript coherence.
- [ ] Implement the strict v1 decoder, canonicalizers, request/preview hashing, transition table, and exact readiness predicate; activate UNIT-001..003 individually.
- [ ] Add the Decision 8A enforcement migration with `platform_operators`, insert-only baseline catalogue, all-status identity uniqueness, persisted request/handoff/reservation/generation facts, dedicated least-privilege `NOLOGIN NOINHERIT` owner, filtered Vault read, exact authenticated EXECUTE, revoked PUBLIC/anon/authenticator/service_role execution/DML, audit writes, and empty DEFINER search paths.
- [ ] Implement the sole narrowly actioned `provision_tenant` RPC under normal operator JWT plus server HMAC; remove the legacy delegate/fallback and broad service-role provisioning DML; prove every invalid proof/fault leaves zero writes.
- [ ] Implement the dedicated 256-bit app/Vault key, length-prefixed Node/Postgres HMAC, key IDs, fail-closed ≤2-minute TTL/current+previous overlap, full bound projection, and absence of attestation/key material from storage/log/audit/browser. Do not commit a secret.
- [ ] Implement stateless preview and approved execution with original-request/hash/database-baseline revalidation, server-minted attestation, signed monotonic approval generation, and zero preview writes; never trust `fresh_approval`.
- [ ] Implement request-id reconciliation, canonical-identity conflict handling, and the equal-identity race path.
- [ ] Wire DB commit → signed `reserve_dispatch` → one server-only Auth call using only durable RPC-returned identity facts → signed sanitized exact-reservation outcome; reject caller retry identity and stale/out-of-order/conflicting outcomes; preserve provider-free reconciliation and raw-token absence from the RPC.
- [ ] Preserve the Epic 11 invitation-token binding and make acceptance project only the exact `ready` predicate.
- [ ] Activate the manifest `provisioning` module and add `Platform.Operator.Access` as platform-scoped, non-tenant-grantable metadata; keep authorization solely in `is_platform_operator()`.
- [ ] Replace each red command-driver seam with the real production boundary, remove that scenario's `test.skip()`, confirm RED, implement to GREEN, and retain fixture cleanup.
- [ ] Run the required local Supabase integration suite with `SUPABASE_TEST_REQUIRED=1` and verify zero skipped required tests.
- [ ] Run unit/regression, lint, and typecheck commands after all focused tests are green.
- [ ] Roll out in order: provision app/Vault key, deploy compatible signer/server, apply enforcement/removal migration, verify bounded current/previous overlap; never commit secrets.

Implementation sizing is intentionally left to the DEV workflow; TEA supplies coverage and activation order, not a delivery estimate.

## Red–Green–Refactor Handoff

1. **RED:** Select one checklist item, replace only its `test.skip()` with `test()`, connect its factory driver to the real boundary, and confirm an assertion fails for the missing behavior.
2. **GREEN:** Implement the smallest production change that satisfies that scenario while preserving transaction, authorization, and non-leakage constraints.
3. **REFACTOR:** Remove duplication without weakening the assertion, rerun the focused test, then rerun all already-activated Story 12.1 tests and affected Epic 11 regressions.

Do not unskip the full integration suite before its migration and fixture boundary exist; setup errors are not useful RED evidence.

## Execution Commands

```powershell
pnpm vitest run tests/unit/provisioning/provisioning-contract.test.ts
pnpm vitest run tests/integration/commands/provision-tenant.int.test.ts
pnpm vitest run tests/integration/rls/platform-operators.rls.test.ts tests/integration/rls/provisioning-migration-reset.int.test.ts tests/integration/rls/security-definer-search-path.rls.test.ts
$env:SUPABASE_TEST_REQUIRED='1'; pnpm vitest run tests/integration/commands/provision-tenant.int.test.ts tests/integration/rls/platform-operators.rls.test.ts tests/integration/rls/provisioning-migration-reset.int.test.ts tests/integration/rls/security-definer-search-path.rls.test.ts
pnpm vitest run tests/unit/admin-users/admin-user-service.test.ts tests/integration/commands/admin-user-management.int.test.ts
pnpm lint
pnpm typecheck
```

No headed/debug browser commands apply because no E2E scaffold was generated.

## Assumptions, Deviations, and Handoff

- The owner-approved production exports are not present yet. Function names in the unit and command-driver seams express the story contract and may be adapted once implementation exports exist, without weakening assertions.
- The Auth provider is an external boundary and requires deterministic adapter control; the database and authorization boundary must remain real local Supabase integration.
- Playwright Utils mandate: not applicable because its package is absent and no Playwright test was generated.
- Pact mandate: not applicable because this story has no consumer/provider contract boundary and the configured SmartBear MCP capability was unavailable.
- Story file handoff: intentionally not modified. This checklist is the sole artifact-link record, per the task instruction.
- Next workflow: implement Story 12.1 (`dev-story`/build), activating these scaffolds task by task; run test automation expansion only after implementation is green.

## Generation Evidence

- API/unit/integration worker artifact: `tea-atdd-api-tests-2026-09-19T12-18-15-228Z.json`
- E2E applicability worker artifact: `tea-atdd-e2e-tests-2026-09-19T12-18-15-228Z.json` (0 tests; no UI acceptance surface)
- Aggregation mechanical validation: PASS; 17 unique test-design IDs, all emitted acceptance scenarios use literal `test.skip()`.
- Temp artifacts are stored beside this checklist under `_bmad-output/test-artifacts/`; no browser/CLI session remains open.

## Validation and Completion

- Focused ESLint validation passed with zero errors or warnings for all six scaffold files and the new factory.
- Vitest discovery passed: 16 Vitest acceptance scaffolds were collected as skipped; existing stack-gated coverage remained runnable with the local Supabase stack unavailable.
- Node unit discovery passed: the appended 12.1-STATIC-001 scaffold was collected as skipped while all seven existing manifest invariants passed.
- Mechanical quality gate passed: all 17 expected IDs occur exactly once, all 17 acceptance scenarios use `test.skip()`, and no `.only`, placeholder marker, hard wait, or timer exists in the generated scaffolds.
- Full-project TypeScript validation found no generated-file errors after fixture correction, but the command still exits nonzero on unrelated pre-existing files below `tmp/private/**` and `tmp/worktrees/**` (Cloudflare ambient types and stale review worktrees).
- Prettier is not installed in this repository; targeted ESLint and test-runner parsing provide the available formatting/syntax checks.
- The story SHA-256 remains `480398C2D5C381E7041B693DAB7254CF308836CA887E7FE5D9A24A22792F4051`, identical to the pre-generation hash. The story file was not modified.

Completion summary: Story 12.1 now has 17 P0 red-phase acceptance scaffolds, one typed fixture module, and this implementation handoff. The primary level is command/database integration. The next recommended workflow is Story 12.1 implementation, activating scenarios one task at a time and running required Supabase evidence with `SUPABASE_TEST_REQUIRED=1` once the migration exists.
