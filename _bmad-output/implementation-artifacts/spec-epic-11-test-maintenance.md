---
title: Epic 11 test-maintenance follow-up
status: in-review
phase: B
scope: tests-and-test-support-only
baseline_revision: 5cc08d2b15b161e4742ddddc3283be4a3c03a059
---

# Epic 11 test-maintenance follow-up

## Intent

Resolve the concrete maintainability and reliability items recorded in the Epic 11 Wave B1a test-quality review. This follow-up changes test support and assertions only; it does not alter production behavior, schema, permissions, scope-manifest state, dependencies, or environment configuration.

## Acceptance criteria

1. Given a retry-isolated completion fixture, when global setup runs at any month or year boundary, then its due date remains a valid deterministic future date without freezing the application clock.
2. Given the global E2E setup and tenant factory support, when the test registry checks file size, then every resulting support file is at or below 1,000 lines and existing factory imports remain stable.
3. Given an authenticated administrator opens `/admin/users`, when a Roles browser assertion begins, then the successful server document response has been registered and awaited before the Roles content is consumed.
4. Given the role catalogue and harness unit suites, when test results are reported, then each subject has a `describe` group and the named integration cases describe observable outcomes.

## Design notes

- The fixed retry due date is fixture input. It is intentionally isolated in a small module and validated as a UTC calendar date; no runtime/application clock is mocked or frozen.
- `tests/factories/tenants.ts` remains a compatibility facade while domain modules contain the existing helpers. `tests/e2e/global-setup.ts` retains orchestration and delegates quote/file fixture seeding to a focused helper.
- Roles readiness waits for the successful `/admin/users` document response registered before navigation. It does not add timing sleeps or unrelated network interception.

## Verification

- `pnpm exec tsc --noEmit` — passed.
- `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/server/authz/role-catalogue.test.ts tests/unit/server/authz/role-harness.test.ts` — passed: 7 tests, 0 failed, 0 skipped.
- Browser and database suites were not started in this worktree. Browser verification remains required after the coordinated local stack/resource run; integration verification must use `SUPABASE_TEST_REQUIRED=1` and report executed/skipped counts.

## Suggested Review Order

### Deterministic retry fixture data

The completion fixture has a stable future due date that is independently validated as a real calendar date, eliminating the setup-time wall-clock calculation while preserving the production clock.

- `tests/e2e/retry-fixture-clock.ts:8` — `RETRY_FIXTURE_DUE_DATE`: owns the fixed ISO calendar date.
- `tests/e2e/global-setup.ts:770` — `due_date`: uses the fixture date for every retry-isolated completion seed.
- `tests/unit/e2e/retry-fixture-clock.test.ts:5` — `retry fixture due date is a stable valid calendar date`: verifies the year, month, and day representation.

### Support-file boundaries preserve existing fixtures

The public factory import remains stable while helpers are grouped by their seeded domain. Quote/file fixture construction is similarly isolated from the global orchestration body.

- `tests/factories/tenants.ts:7` — `export * from "./tenants/core"`: preserves the established factory facade.
- `tests/factories/tenants/quotes.ts:1` — `adminQuery`: retains quote fixture persistence in the quote domain module.
- `tests/e2e/seed-quote-file-fixtures.ts:36` — `seedQuoteFileFixtures`: contains the isolated quote/file seed sequence.
- `tests/e2e/global-setup.ts:791` — `seedQuoteFileFixtures`: keeps orchestration and the fixture serialization in the global setup.

### Roles checks wait for the requested server content

Both Roles specs register the `/admin/users` document-response predicate before navigation and await it before selecting the server-derived Roles tab. They then wait for the actual interactive control's React hydration marker, without timeouts or unrelated request matching.

- `tests/e2e/auth/admin-user-management-roles.atdd.e2e.spec.ts:37` — `openAdminUsers`: registers and awaits the successful admin-users document response.
- `tests/e2e/auth/admin-user-management-roles.atdd.e2e.spec.ts:54` — `waitForHydrated(rolesTab)`: waits for the Roles interaction to be hydrated before clicking it.
- `tests/e2e/auth/role-catalogue-contract.e2e.spec.ts:35` — `openAdminUsers`: applies the same route-specific readiness boundary to the catalogue contract.
- `tests/e2e/auth/role-catalogue-contract.e2e.spec.ts:52` — `waitForHydrated(rolesTab)`: waits for the catalogue tab interaction to be hydrated before clicking it.

### Diagnostic test output names the subject and outcome

The unit suites group their assertions under their subject, and integration labels describe the observable denial/error result.

- `tests/unit/server/authz/role-catalogue.test.ts:8` — `describe("role catalogue"`: groups the catalogue contract assertions.
- `tests/unit/server/authz/role-harness.test.ts:7` — `describe("role harness"`: groups harness fail-closed assertions.
- `tests/integration/commands/disabled-membership-no-access.int.test.ts:112` — `TENANT_MEMBERSHIP_REQUIRED`: names the observable inactive-membership outcome.
- `tests/integration/commands/server-error-vs-no-access.int.test.ts:135` — `SERVER_ERROR`: names the observable transient-read outcome.
