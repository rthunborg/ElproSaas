---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
  - 'step-04c-aggregate'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-09-02'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/spec-10-5-quote-table-db-hardening-and-read-model-pagination.md'
  - '_bmad/tea/config.yaml'
  - '_bmad/bmm/config.yaml'
  - 'package.json'
  - 'playwright.config.ts'
  - 'vitest.config.ts'
  - 'tests/integration/commands/quote-follow-ups.int.test.ts'
  - 'tests/integration/rls/quote-follow-ups.rls.test.ts'
  - 'tests/integration/rls/quote-pipeline-read-model.rls.test.ts'
  - 'tests/unit/server/read-models/quote-pipeline-aggregate-atdd.test.ts'
  - 'tests/integration/rls/quote-table-db-hardening.atdd.int.test.ts'
  - 'tests/e2e/quotes/quote-lost-reason-retry-safety.e2e.spec.ts'
  - 'tests/e2e/quotes/quote-follow-up-retry-safety.e2e.spec.ts'
---

# ATDD Checklist: Story 10.5 — Quote-Table DB Hardening and Read-Model Pagination

## Step 1 — Preflight and context

- **Story readiness:** `ready-for-dev`; five clear acceptance criteria are present under `## Tasks & Acceptance`.
- **Detected stack:** fullstack (Next.js/React, Supabase/Postgres, Vitest integration suites, and Playwright E2E configuration).
- **Configured runners:** `node --test` for pure units, Vitest for local-Supabase integration/RLS, and Playwright for browser journeys.
- **Prerequisites:** satisfied. `playwright.config.ts`, `vitest.config.ts`, a populated `tests/` tree, and the local test-stack conventions are present.
- **Constraints carried forward:** retain RLS-scoped reads; do not add routes, RPCs, service-role paths, product surface, or a new table; use the canonical `sumOre` safety guard; preserve Story 10.8's checked lifecycle/audit boundary.
- **Knowledge loaded:** data factories, component TDD, test-quality, healing, selector resilience, timing, test levels/priorities/CI, Playwright utilities/CLI, and Pact/contract references. Pact is not applicable: this story changes in-process DB/read-model behavior and exposes no inter-service HTTP contract.

## Step 2 — Generation mode

**AI generation.** The acceptance criteria are concrete and database/read-model heavy; existing tests establish the source-compatible helper, fixture, and selector patterns. No live browser recording is required: Story 10.5 has no new UI flow, and its E2E work makes existing lifecycle retry setup idempotent.

## Step 3 — Test strategy

| AC | Scenarios | Primary level | Priority | Red-phase intent |
| --- | --- | --- | --- | --- |
| AC1 | Same-tenant direct writes reject mismatched/draft/non-sent anchors, invalid Stockholm dates, forbidden completion shapes, identity mutation, and reopen without consuming an open slot | INT/RLS | P0 | New trigger/schema invariant proofs |
| AC2 | Planning racing a terminal transition commits no open follow-up | INT | P0 | Concurrent transaction/race proof |
| AC3 | >1,000 RLS-visible events, versions, quotes, reasons, and follow-ups yield complete pipeline/list/detail facts and remain tenant-isolated | INT/RLS | P0 | Multi-page fixtures with exact counts/statuses |
| AC4 | `sumOre` succeeds at safe boundary and fails closed on overflow/invalid accepted values | Unit | P0 | Pure aggregate boundary proof |
| AC5 | Story 10.8 denies direct event/lost-reason mutation and rolls back a checked transition when audit persistence faults | INT/RLS | P0 | Regression proof of authoritative wrapper/audit boundary |
| Existing lifecycle retry safety | Re-running E2E setup preserves the business assertion rather than skipping/tolerating it | E2E | P1 | Retry-safe fixture/state scaffold |

All generated acceptance tests remain skipped in the RED phase; active existing regression tests are not weakened.

## Step 4 — Red-phase generation and aggregation

**Execution mode:** `subagent` (requested `auto`; capability probe found parallel subagents available).
Both workers completed before aggregation. No HTTP endpoint exists and no CDC/Pact consumer contract is
appropriate: the production surface is RLS-scoped database queries and server command wrappers.

### Generated RED scaffolds

| Test ID | Level / runner | AC | P | Artifact |
| --- | --- | --- | --- | --- |
| 10.5-UNIT-01 | Unit / `node --test` | AC4 | P0 | `tests/unit/server/read-models/quote-pipeline-aggregate-atdd.test.ts` |
| 10.5-UNIT-02 | Unit / `node --test` | AC4 | P0 | `tests/unit/server/read-models/quote-pipeline-aggregate-atdd.test.ts` |
| 10.5-INT-01 | INT/RLS / Vitest | AC1 | P0 | `tests/integration/rls/quote-table-db-hardening.atdd.int.test.ts` |
| 10.5-INT-02 | INT/RLS / Vitest | AC1 | P0 | `tests/integration/rls/quote-table-db-hardening.atdd.int.test.ts` |
| 10.5-INT-03 | INT/RLS / Vitest | AC2 | P0 | `tests/integration/rls/quote-table-db-hardening.atdd.int.test.ts` |
| 10.5-INT-04 | INT/RLS / Vitest | AC3 | P0 | `tests/integration/rls/quote-table-db-hardening.atdd.int.test.ts` |
| 10.5-INT-05 | INT / Vitest | AC3 | P0 | `tests/integration/rls/quote-table-db-hardening.atdd.int.test.ts` |
| 10.5-INT-06 | INT/RLS / Vitest | AC5 | P0 | `tests/integration/rls/quote-table-db-hardening.atdd.int.test.ts` |
| 10.5-E2E-01 | E2E / Playwright | Retry-safe lost-reason setup | P1 | `tests/e2e/quotes/quote-lost-reason-retry-safety.e2e.spec.ts` |
| 10.5-E2E-02 | E2E / Playwright | Retry-safe plan-follow-up setup | P1 | `tests/e2e/quotes/quote-follow-up-retry-safety.e2e.spec.ts` |
| 10.5-E2E-03 | E2E / Playwright | Retry-safe complete-follow-up setup | P1 | `tests/e2e/quotes/quote-follow-up-retry-safety.e2e.spec.ts` |

All 11 scopes use `test.skip` or `describe.skip`, have concrete expected assertions or a precise
`expect.fail` implementation sentinel, and contain no placeholder `expect(true).toBe(true)` assertion.
The skipped Vitest scaffold intentionally uses the existing two-tenant/local-stack conventions only
when greenified; it neither creates a service-role app path nor changes a production privilege.

### Fixture and implementation handoff

- Reuse `createTwoTenantFixture`, authenticated RLS clients, `adminQuery` test readback, local-stack
  gating, cleanup, and UUID-tagged/batched seed patterns. The direct-write/race proof must use two
  independently authenticated sessions and release them in `finally`.
- Add page-size-plus-one batches with the asserted Tenant-A row intentionally after the first 1,000
  deterministic sort positions; tenant-B sentinels must remain absent from every RLS-scoped result.
- Seed one immutable lifecycle target per Playwright attempt in `tests/e2e/global-setup.ts`, exposing
  `markLostQuoteAttempts`, `followUpQuoteAttempts`, and `completeFollowUpQuoteAttempts` in fixture JSON.
  When unskipping, refactor the matching mutating E2E tests to consume `testInfo.retry`; do not tolerate
  already-mutated singleton state.
- No browser large-list/detail scaffold was authored. AC3 is correctly proven at integration/RLS level,
  where >1,000 records can be seeded and exact complete read-model/list/detail projections observed
  without inventing a new browser-visible contract.

## Step 5 — Validation and next actions

### RED-phase validation

- [x] The approved story and clear acceptance criteria were loaded.
- [x] The files match the configured Node/Vitest/Playwright runners and use their discoverable naming
      conventions (`*.test.ts` or `*.e2e.spec.ts`).
- [x] Every new acceptance scope is skipped; no existing green regression was disabled or weakened.
- [x] Every AC is covered: AC1/AC2 database lifecycle guards and race, AC3 complete RLS pagination,
      AC4 guarded money overflow, AC5 Story 10.8 DML/audit atomicity.
- [x] No browser session was opened, so no browser cleanup is required. No temporary output remains;
      the durable checklist and test scaffolds are all under the repository test-artifact/test trees.

### Green-phase checklist

1. Land the additive migration and pagination helper, then replace each `expect.fail` sentinel with
   bounded-batch seeds, exact row assertions, and the existing command/read-model entry points.
2. Remove the `test.skip`/`describe.skip` markers only for the behavior implemented in the same change.
3. Extend the existing focused suites named in the story once helpers exist; retain the standalone
   scaffold as a traceable checklist until its cases have migrated into the canonical suites.
4. Run the story's specified typecheck, lint, focused unit, local-Supabase integration/RLS, and quote
   E2E commands. A missing local stack is not evidence of green behavior.

**Key risks:** trigger/race behavior must preserve the sanctioned command contract; pagination must
filter in PostgREST before capped reads and finish every page; overflow must propagate the canonical
`sumOre` failure rather than return an imprecise JavaScript number; E2E retries must retain their real
post-mutation assertion.
