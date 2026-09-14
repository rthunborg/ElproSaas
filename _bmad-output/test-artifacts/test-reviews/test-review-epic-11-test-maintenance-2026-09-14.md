---
workflowType: 'testarch-test-review'
status: 'focused-reassessment'
reviewDate: '2026-09-14'
baselineRevision: '5cc08d2b15b161e4742ddddc3283be4a3c03a059'
scope: 'bounded Epic 11 test-maintenance diff'
---

# Test Quality Reassessment: Epic 11 test-maintenance follow-up

This is a focused reassessment of the maintenance diff against the historical
[Epic 11 Wave B1a test-quality review](test-review-epic-11-wave-b1a-rbac.md).
It preserves the historical 75/100 score and checks each of that review's nine
ledger rows. Coverage analysis and runtime verification are outside this lens.

## Findings

No current P0–P3 finding remains in this bounded maintenance diff. The two
earlier P2 readiness findings and the P3 disabled-membership naming finding were
closed by the author's follow-up edits and verified by source inspection below.

No P0 or P1 production-reachable regression was found in the bounded diff. The
remaining historical concerns are advisory test-quality dispositions, with
runtime evidence recorded separately from this focused review.

## Historical nine-row disposition

| Historical row | Current result | Evidence |
| --- | --- | --- |
| H2 — live-clock retry fixture | **Resolved** | `tests/e2e/retry-fixture-clock.ts:8` owns the fixed `2099-01-31` input; `tests/e2e/global-setup.ts:770` supplies it to the retry-isolated completion fixture. |
| H5 — oversized `global-setup.ts` | **Resolved** | The file is 953 lines after extracting quote/file seeding; `tests/e2e/global-setup.ts:791` calls `seedQuoteFileFixtures`. |
| H5 — oversized `factories/tenants.ts` | **Resolved** | The compatibility facade is 13 lines at `tests/factories/tenants.ts:7`; the seven domain modules are 152–755 lines, all below the historical 1,000-line ceiling. |
| M1 — Roles readiness in admin-user spec | **Resolved** | `tests/e2e/auth/admin-user-management-roles.atdd.e2e.spec.ts:37` registers the successful document response and line 44 awaits it; the Roles tab, member interaction, and effective-permission interaction wait for the existing React hydration marker before clicking (`:54`, `:67`, `:70`). |
| M1 — Roles readiness in catalogue spec | **Resolved** | `tests/e2e/auth/role-catalogue-contract.e2e.spec.ts:35` registers the successful document response and line 42 awaits it; the Roles tab waits for the existing React hydration marker before clicking (`:52`). |
| M4 — ungrouped role catalogue unit suite | **Resolved** | `tests/unit/server/authz/role-catalogue.test.ts:8` adds the `role catalogue` subject group. |
| M4 — ungrouped role harness unit suite | **Resolved** | `tests/unit/server/authz/role-harness.test.ts:7` adds the `role harness` subject group. |
| L5 — disabled-membership name at historical line 112 | **Resolved** | `tests/integration/commands/disabled-membership-no-access.int.test.ts:112` now names the observable `TENANT_MEMBERSHIP_REQUIRED` result for an inactive membership; the separate line 141 case remains behavior-shaped as well. |
| L5 — transient membership-read name | **Resolved** | `tests/integration/commands/server-error-vs-no-access.int.test.ts:135` names the observable `SERVER_ERROR` outcome. |

## Focused semantic checks

The fixed retry date is a valid ISO calendar date and is far after the current
2026 run date. The production follow-up boundary rejects dates before the
current Europe/Stockholm date; it imposes no upper-bound date that would make
`2099-01-31` invalid. The fixture is input data only and does not freeze or
mock the application clock. The new unit test checks the exact date and its UTC
calendar components at `tests/unit/e2e/retry-fixture-clock.test.ts:5`.

The tenant-factory facade retains every export present in the baseline. Source
comparison found no missing legacy export; the four additional declarations
(`admin`, `rethrowWithCode`, `story106FixtureTaxInput`, and
`adminInsertStory106QuoteVersion`) are internal/shared helpers now exposed by
the modules. The extracted quote/file seed body is substantively identical to
the baseline body after removing the surrounding function wrapper and
indentation. Existing imports therefore keep the same public names and setup
sequence.

The author follow-up now covers both readiness boundaries: each admin helper
waits for the successful `/admin/users` document response, and every changed
admin interaction waits for the existing React hydration marker before clicking.
The admin-user spec applies that marker to the Roles tab, member interaction,
and effective-permission interaction; the catalogue spec applies it to the Roles
tab. The non-admin direct-route case remains document-only and asserts that the
Roles tab is absent, which is the appropriate readiness signal for that route.

The disabled-membership resolver assertion at the historical line 112 now names
the externally visible `TENANT_MEMBERSHIP_REQUIRED` outcome. The current
behavior-shaped names therefore cover both historical L5 rows without changing
the tested implementation contract.

## Follow-up verification

The bounded author follow-up changed exactly the two previously reported test
readiness areas and the one previously reported historical naming row. Source
inspection confirms the hydration waits occur before the relevant interactive
clicks and that the disabled-membership case now describes the returned error
code. No additional bounded finding was identified, and all nine historical
ledger rows are now closed.

## Verification evidence and limits

Source inspection was performed against the working tree at baseline
`5cc08d2`; no database, service, or managed test infrastructure was started in
this review. The implementation author reports `pnpm exec tsc --noEmit`,
targeted lint, review-order validation with 15 references and 0 errors, and the
focused unit command passing with 8 tests and 0 skips. Those are recorded
reports, not executions in this review. The coordinating agent reports the
final production Playwright maintenance run passing 13/13 with 0 skips (9
Admin/Roles scenarios plus 4 quote follow-up scenarios, including the fixed
clock completion flow). This is coordination evidence, not an execution by this
review lens. Full integration/RLS evidence remains pending and must report
actual executed and skipped counts.

The existing retry-isolation E2E scaffolds remain explicitly skipped in the
baseline suite; this maintenance diff does not enable them or claim their
coverage. No new database, cross-tenant RLS, golden-master, or browser runtime
evidence was added by this bounded maintenance patch.

## Reassessment result

All nine historical rows are resolved in the current bounded diff. The focused
advisory score is **100/100 (A+)** under the historical ledger's scoring
arithmetic. This score does not replace the historical 75/100 score and is not
a coverage, integration, browser, or production-readiness decision.

**Recommendation:** approve the focused test-maintenance assessment from this
review lens, subject to the coordinating agent recording the required full
integration/RLS counts and final review evidence. The three explicit historical
RED skips remain non-coverage and are not converted by the maintenance patch.

## Knowledge applied

- `test-quality.md`: deterministic, explicit, isolated test signal and honest
  treatment of skipped or unexecuted suites.
- `fixture-architecture.md`: preserve stable fixture interfaces while keeping
  domain setup modules focused.
- `network-first.md` and `timing-debugging.md`: register observable readiness
  before navigation and avoid timing sleeps.
- `data-factories.md`: stable, controlled factory inputs and explicit test
  assertions.
- `test-levels-framework.md`: keep database/RLS and user-journey evidence at
  their appropriate runtime levels.
