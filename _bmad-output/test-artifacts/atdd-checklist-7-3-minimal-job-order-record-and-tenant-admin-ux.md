---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-07-07'
workflowType: testarch-atdd
inputDocuments:
  - _bmad-output/implementation-artifacts/7-3-minimal-job-order-record-and-tenant-admin-ux.md
  - _bmad-output/test-artifacts/test-design-epic-7.md
  - _bmad/tea/config.yaml
  - _bmad/bmm/config.yaml
  - src/features/quotes/read.ts
  - src/server/commands/crm/customers.ts
  - src/components/app-shell/nav-items.ts
  - tests/unit/guardrails/acceptance-non-scope.test.ts
  - tests/e2e/quotes/quote-accept-create-job.e2e.spec.ts
  - tests/integration/commands/capture-quote-acceptance.int.test.ts
  - tests/integration/commands/accept-quote-and-create-job.int.test.ts
  - tests/integration/commands/crm-customer-commands.int.test.ts
  - tests/factories/tenants.ts
---

# ATDD Checklist - Epic 7, Story 7.3: Minimal Job/Order Record And Tenant-Admin UX

**Date:** 2026-07-07
**Author:** Rasmus (auto-bmad ATDD delegate)
**Detected stack:** `fullstack` (Next.js app + Playwright E2E + Vitest INT/RLS + `node --test` unit/guardrail)
**Generation mode:** AI generation, sequential (ACs are clear; scenarios mirror landed 7.1/7.2 patterns — no live browser recording needed)
**TDD Phase:** RED — all behavioral tests `.skip`/`it.skip` except the standing guardrail, which runs LIVE from red phase (it is TRUE today and must stay true as 7.3 lands).

---

## Story Summary

7.3 SURFACES the accepted-work record the 7.2 transaction creates: the `/jobs` list (replacing the
`PagePlaceholder`) + `/jobs/[jobId]` detail read UX over an RLS-scoped `readJobList`/`readJobDetail`,
the `updateJob` allowed-edit command (title/status/planned dates ONLY, audited), the `job`
file-owner-type activation, and the accepted-version→job deep link. No migration, no new table — a
read + an UPDATE-only command over the frozen 7.1 tables. The headline invariant: the detail
DISPLAYS accepted price / source total / evidence / commitment names from the IMMUTABLE
`quote_acceptances` / `quote_versions` refs and NEVER re-derives (R-708); source refs are
non-editable; NO field-worker/schedule/invoice/Fortnox surface anywhere.

---

## Acceptance Criteria → Test Coverage

| AC | Coverage | Level | Test ID(s) |
| --- | --- | --- | --- |
| AC1 — detail with full source traceability; source refs read-only | `job-traceability.e2e` (surfaces block + display-only refs) + `job-source-of-truth.int` (from-immutable-refs) | E2E + INT | 7.3-E2E-01, 7.3-INT-01 |
| AC2 — list filter/search; NO deferred surface | `job-list-deferred-surface.e2e` + `job-non-scope` scan | E2E + UNIT-guardrail | 7.3-E2E-03 |
| AC3 — tenant isolation on read AND allowed update | `update-job.int` (foreign id ⇒ TENANT_ACCESS_DENIED; anon ⇒ UNAUTHENTICATED) + `job-source-of-truth.int` (RLS-scoped read) | INT | AC3 live-path negatives |
| AC4 — allowed edits audited; immutable refs non-editable | `update-job.int` (one audit row, allow-listed metadata, job_events on status change, smuggle ⇒ VALIDATION_FAILED) + `job-traceability.e2e` (no edit control for immutable refs; edit form = 4 fields only) | INT + E2E | 7.3-INT-02, 7.3-E2E-01 |
| AC5 — repeated attempt shows the EXISTING job (idempotency mirror) | `job-traceability.e2e` (accepted-version deep link → the one job; repeat = same job, no duplicate/create/error) | E2E | 7.3-E2E-02 |
| AC6 — activate `job` file owner type + `job_evidence` purpose | (green-phase file-link INT reuse — see note) + `job-traceability.e2e` files block | INT (reuse 8.1) + E2E | see AC6 note |

**AC6 note:** the `job` owner-type activation is a MINIMAL edit to `src/server/commands/files/{validation.ts,file-db.ts}` that reuses `createFileLink` + the 8.1 signed-access funnel VERBATIM. Its behavioral proof rides on the existing `file-link-ownership.int.test.ts` / `file-signed-access.int.test.ts` patterns (own-tenant `job` owner resolves; a foreign job owner ⇒ `TENANT_ACCESS_DENIED`). GREEN PHASE should add a `job` owner-type case to that existing suite rather than a new file (no competing store — R-814). The `job-traceability.e2e` files block (`job-files` testid) covers the read/link surface. Not scaffolded as a separate red file here to avoid a competing evidence-store affordance.

---

## Generated Test Files (RED phase)

| File | Level | IDs | Skipped? | Notes |
| --- | --- | --- | --- | --- |
| `tests/unit/guardrails/job-non-scope.test.ts` | UNIT guardrail | 7.3-E2E-03 (scan) | **LIVE (not skipped)** | Route/token scan + nav-count-7. Passes GREEN today; the standing gate 7.3 must not violate. |
| `tests/integration/commands/job-source-of-truth.int.test.ts` | INT (Vitest, DB) | 7.3-INT-01 | `it.skip` | Headline R-708 proof — rename live customer ⇒ frozen commitment name + accepted price UNCHANGED. |
| `tests/integration/commands/update-job.int.test.ts` | INT (Vitest, DB) | 7.3-INT-02 + AC3 | `it.skip` | Allowed edits audited (one row, allow-listed `{ targetId }`, job_events on status change); smuggle ⇒ VALIDATION_FAILED; foreign id ⇒ TENANT_ACCESS_DENIED; anon ⇒ UNAUTHENTICATED; empty-patch short-circuit. |
| `tests/e2e/jobs/job-traceability.e2e.spec.ts` | E2E (Playwright) | 7.3-E2E-01/02/04 | `test.skip` | Traceability block; display-only immutable refs; edit form = 4 fields only; accepted-version deep link idempotency; a11y focus + text-not-color. |
| `tests/e2e/jobs/job-list-deferred-surface.e2e.spec.ts` | E2E (Playwright) | 7.3-E2E-03 | `test.skip` | List rows link to detail; 4 filters; rendered-UI deferred-surface absence (Swedish+English text + testids). |

---

## Red-Phase Verification

- **Guardrail (`job-non-scope`)** — RAN LIVE, 3/3 PASS (`node --test`): no forbidden route segment, no forbidden surface token, nav count == 7 with `/jobs` present. This is the intended red-phase state (it is a standing invariant, not a to-be-implemented behavior).
- **INT + E2E scaffolds** — will FAIL at import/collection until 7.3 lands `@/features/jobs/read`, `@/server/commands/jobs` (`updateJob`), the `/jobs` list + `/jobs/[jobId]` detail pages, and the `JobList`/`JobDetailView` components + testid hooks. This is the correct RED phase. Not executed here (they require the local Supabase stack for INT and the built app + `acceptQuote` fixture for E2E).

---

## UI Contract the GREEN phase must provide (testids)

- **Detail:** `job-detail`, `job-source-quote-version` (an `<a href=/quotes/.../versions/...>`), `job-acceptance-evidence`, `job-accepted-price`, `job-source-sent-total`, `job-customer`, `job-status`, `job-planned-dates`, `job-files`, `job-event-history`.
- **Edit affordance:** `job-edit-open`, `job-edit-dialog`, `job-edit-title`, `job-edit-status` (select, closed set), `job-edit-planned-start`, `job-edit-planned-end`, `job-edit-cancel`. NO `edit-job-accepted-price`/`-source-total`/`-customer`/`-source-quote-version`/`-evidence`/`-channel` (must be ABSENT).
- **List:** `job-list`, `job-list-row` (each with a row link to `/jobs/[jobId]`), `job-list-empty`, `job-filter-customer`, `job-filter-status`, `job-filter-planned-date`, `job-filter-source-quote`.
- **Deep link (on the accepted quote version):** `quote-accepted-job-link` (an `<a href=/jobs/[jobId]>` — the AC5 seam replacing QuoteDetailView's plain "a job was created" note). `job-create-again` / `job-error` must be ABSENT on a repeat.
- **Read view-model (`readJobDetail`):** `acceptedPriceOre`, `sourceSentTotalOre` (numbers, öre-coerced), `commitmentCustomerName` (frozen, from version snapshot), `currentCustomerName` (live, via `jobs.customer_id` join), `quoteVersionId`, `quoteAcceptanceId`, `evidenceReference`.

---

## Key Assumptions / Risks (for GREEN-phase implementer)

1. **Fixture extension (E2E):** the `job-traceability` + `job-list-deferred-surface` specs assume the E2E global-setup persists the `jobId` created by the existing `acceptQuote` sent→accept chain (and the source `sentVersionId` deep-link seam). GREEN must extend `tests/e2e/global-setup.ts` to carry `acceptQuote.jobId`. Never hand-insert a `jobs` row (source refs must be authentic).
2. **Factory helper needed (INT):** `job-source-of-truth.int` uses `adminUpdateCustomerDisplayName(customerId, name)` to mutate the live customer. Confirm this helper exists in `tests/factories/tenants.ts`; if not, add it (a BYPASSRLS admin UPDATE on `customers.display_name`) alongside the existing `adminSelectJob*` helpers from 7.2.
3. **`commitmentCustomerName` vs `currentCustomerName`:** per the 7.2 retro-note, `jobs.customer_id` is the AUTHORITATIVE live-CRM link (current display name), while the FROZEN commitment name comes from the `quote_versions` snapshot. The INT proof asserts the frozen name does NOT move on a live rename while the live-link name DOES — the two must be distinct fields in the view-model.
4. **`updateJob` input shape is the smuggle backstop:** the immutable/commitment fields are NOT valid input keys, so a smuggle ⇒ `VALIDATION_FAILED` (unknown field). Keep the patch to the four Phase-A-safe columns so the coming 7.4 `jobs` immutability trigger does not fire on an allowed edit.
5. **Empty-patch guard:** `updateJob` with id-only must short-circuit (return target id unchanged) — the epic-3/epic-5 `.update({})` false-`TENANT_ACCESS_DENIED` fix; and it must NOT write an audit row for the no-op.
6. **Money discipline:** öre are `bigint` (PostgREST STRING) — coerce with the `oreNumber` helper at the read boundary; display via `oreToKronorString`; never float/kronor math; never re-derive.
7. **PII/R-717:** job fixtures carry NO personnummer/orgnr/PII; öre values < 10 digits (`SOURCE_SENT_TOTAL_ORE = 125_000`).

---

## Next Steps (TDD Green Phase)

1. Implement 7.3 Tasks 1-6 (read layer, `/jobs` list + `/jobs/[jobId]` detail, `updateJob` command + action, `job` file-owner activation, deep link, guardrail already landed).
2. Provide the testid hooks above in `JobList` / `JobDetailView` / the acceptance section deep link.
3. Extend `tests/e2e/global-setup.ts` to persist `acceptQuote.jobId`; add `adminUpdateCustomerDisplayName` factory helper if absent.
4. Remove `it.skip` / `test.skip` from the four behavioral files; run `pnpm test` (unit → INT on local stack → E2E within the 15-min bar). Poll `/auth/v1/health` to 200 after any `supabase db reset` before trusting INT.
5. Confirm the guardrail stays GREEN (it already is) and the AC6 `job` owner-type case is added to the existing `file-link-ownership.int.test.ts` rather than a new store.

**Recommended follow-on workflow:** `bmad-dev-story` (implement 7.3), then `bmad-testarch-trace` to confirm the 7.3 coverage rows close, then `bmad-code-review`.
