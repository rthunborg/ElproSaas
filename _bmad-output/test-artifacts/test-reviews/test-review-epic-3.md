---
stepsCompleted:
  ['step-01-load-context', 'step-02-discover-tests', 'step-03-quality-evaluation', 'step-03f-aggregate-scores', 'step-04-generate-report']
lastStep: 'step-04-generate-report'
lastSaved: '2026-07-01'
review_scope: 'suite'
scope_detail: 'Epic 3 tests across all layers under tests/ (unit, integration, e2e)'
detected_stack: 'fullstack'
advisory_only: true
inputDocuments:
  - knowledge/test-quality.md
  - knowledge/test-levels-framework.md
  - _bmad/tea/config.yaml
---

# Test Quality Review — Epic 3 (CRM, Settings & Pricing, Snapshot-Source Contract)

**Reviewer:** Master Test Architect (TEA `test-review`)
**Date:** 2026-07-01
**Scope:** `suite` — all Epic-3 tests across unit (`node --test`), integration (`vitest` + local Supabase), and e2e (Playwright) layers.
**Nature:** ADVISORY — this review does NOT gate the epic. Coverage scoring is out of scope for `test-review` (route coverage/gates to `trace`).

---

## Overall Quality Score: **92 / 100 — Grade A**

| Dimension | Weight | Score | Grade |
| --- | --- | --- | --- |
| Determinism | 30% | 97 | A |
| Isolation | 30% | 95 | A |
| Maintainability | 25% | 86 | B |
| Performance | 15% | 85 | B |

Weighted overall = 0.30·97 + 0.30·95 + 0.25·86 + 0.15·85 = **91.85 → 92 (A)**.

### Violation summary

| Severity | Count |
| --- | --- |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 4 |
| **Total** | **6** |

**No critical (HIGH) findings. No blockers. No weakened, skipped, or vacuous mechanism-level tests.**

---

## Scope reviewed

Files assessed (representative depth across every Epic-3 story):

- **CRM (3.1/3.2):** `crm-customer-commands.int`, `crm-command-coverage.int`, `crm-parent-ownership.int`, `crm-tables-migration-reset.int`, `crm-validation` (unit), `customer-presentation` (unit component), `crm/customers.e2e`.
- **Settings + quote-terms/sign-off (3.3):** `settings-commands.int`, `settings-rls.int`, `settings-validation` (unit), `vat-display` (unit), `settings.e2e`.
- **Pricing / work-roles + articles (3.4):** `pricing-commands.int`, `pricing-tables-migration-reset.int`, `pricing-validation` (unit), `money-display` (unit), `pricing.e2e`.
- **Snapshot-source contract + golden fixtures (3.5):** `snapshots/build` (unit), `snapshots/golden` (unit golden-master), `snapshots/dispatch` (unit), `server/snapshots/resolve-source` (unit), `snapshots/source-ownership.int`, `fixtures/golden/snapshots/*.json`.

Verification of the task's specific quality concerns:

- **Assert-the-mechanism vs vacuous assertions** — PASS. Cross-tenant negatives seed CONCRETE foreign rows and add explicit vacuity guards that `throw` when a seed id is absent ("would pass vacuously"). Denials are proven with an independent BYPASSRLS re-read of the untouched foreign row. The only `expect(true).toBe(true)` hits are two clearly-labelled documentation/hand-off markers in pre-Epic-3 infra files (2.1/2.2), not Epic-3 mechanism coverage.
- **No test interdependence / order coupling** — PASS. Per-run unique ids + `correlationId` per write; no test reads state another test wrote by name.
- **Deterministic (injected clock, no real time/random)** — PASS. Command timestamps come from an injected `fixedClock` (`FIXED_ISO`); pure snapshot builders take `capturedAt` via opts (never wall-clock). `Date.now()`/`Math.random()`/`crypto.randomUUID()` appear only for unique test-data naming and correlation ids — never in assertions. No `waitForTimeout` in e2e (hydration is polled + `expect().toBeVisible()`).
- **Cross-tenant negatives that actually prove isolation** — PASS. Two-tenant fixture; Tenant-A command aimed at a real Tenant-B id yields `TENANT_ACCESS_DENIED`; RLS-layer half proven independently (direct RLS SELECT returns `[]`); non-existent id denied identically (no existence signal).
- **Golden-master discipline** — PASS. Pinned `expectedSnapshot` fixtures compared with `assert.deepEqual`; fixtures anonymized with an in-test PII/secret scan (NFR17); a builder/contract drift fails loud.
- **No weakened/skipped tests** — PASS. Grep confirms every `.skip`/`describePending`/`notYetImplemented` reference lives in comment prose only; all suites run as real `describe`/`test` with top-level imports.

---

## Findings

### MEDIUM

1. **Stale RED-phase header comments on now-green suites** — *maintainability*
   Files: `crm-customer-commands.int`, `crm-parent-ownership.int`, `pricing-commands.int`, `settings-commands.int`, `crm-tables-migration-reset.int`, `pricing-tables-migration-reset.int`, `settings-rls.int`, `pricing-validation.test`, `money-display.test`, `settings.e2e`, `pricing.e2e`.
   The file headers still narrate the RED phase ("WHY `describe.skip`", "`notYetImplemented()` placeholder", "`describePending` gate", "the whole suite is `test.describe.skip(...)`") even though the code is fully green (real `describe`/`test`, top-level imports, no gate). A reader skimming the header can wrongly conclude the suite is skipped.
   **Fix:** Trim each RED-phase preamble to a one-line historical note now that the suite is green.

2. **e2e re-authenticates through the UI per test** — *performance*
   Files: `crm/customers.e2e`, `pricing/pricing.e2e`, `settings/settings.e2e`.
   Each test calls `signIn()` (goto `/login` → fill → submit → await `/dashboard`), repeating the login cost for every test rather than reusing a saved `storageState`.
   **Fix:** Persist auth once (an e2e `global-setup` already exists) and load it via Playwright `storageState`, so per-test UI login is skipped.

### LOW

3. **Documentation-marker assertions** — *maintainability* — `factory-isolation.int.test.ts:89`, `security-definer-search-path.rls.test.ts:121` use `expect(true).toBe(true)` as "decision recorded / hand-off done" markers. Harmless and labelled, but a passing tautology. **Fix:** convert to `test.skip` with a note, or assert on the recorded artifact.

4. **Duplicated e2e helpers** — *maintainability* — `waitForHydrated` + `signIn` + fixture-load are copy-pasted across the three e2e specs. **Fix:** extract to a shared `tests/e2e/support/*` module.

5. **Unbounded hydration poll** — *determinism* — `waitForHydrated` polls via `requestAnimationFrame` with no explicit timeout, relying on Playwright's outer action/expect timeout as the backstop. Acceptable; a `Promise.race` timeout would give a clearer failure message.

6. **Per-test parent seeding in CRM coverage** — *performance* — `crm-command-coverage.int` runs a full envelope command per lifecycle test (`createOwnCustomer`) to obtain a parent id, adding a few round-trips. Acceptable for correctness; a shared read-only parent could be reused where tests do not mutate it.

---

## Strengths (worth preserving as the project standard)

- **Injected-clock discipline** is uniform and load-bearing: the "captured ONCE, no `Date.now()` drift" invariant is directly asserted (`command-clock.test.ts`), and every command test pins `created_at`/`archived_at`/`approved_at` to `FIXED_ISO`.
- **Snapshot immutability (R-008)** is proven deeply: copy-by-value for every kind (mutate the source after build → prior snapshot byte-for-byte unchanged), `Object.isFrozen` on every kind, builder never mutates its source, and a runtime `assertNever` backstop on unknown kinds.
- **Money discipline** (integer öre / basis points) is exhaustively pinned at the pure-validator level AND re-checked at the DB layer (bigint returns as string → `^\d+$` assertion; `vat_rate_bp` integer + `[0,10000]` CHECK).
- **Sign-off stop-condition** (quote terms never silently approved; an edit resets approval; only `approveQuoteTerms` sets it) is asserted on the DB row across create/approve/edit sequences.
- **No-PII-in-audit** and **no-supplier-scope** guardrails are asserted by scanning serialized metadata / snapshot keys for forbidden substrings.
- **Migration-reset enumeration** stays an EXACT policy set (extended, not loosened) with an explicit "gate BITES" test that removes a table and asserts it resurfaces.

---

## Context references

- Knowledge base: `test-quality.md` (Definition of Done), `test-levels-framework.md`.
- The suites cite `test-design-epic-3.md` P0/P1 priorities and per-story ACs inline; traceability is embedded in test names (`[P0]/[P1]` + `AC#`).

**Coverage boundary note:** `test-review` does not score coverage. For a traceability matrix and any coverage gate, run `trace`.

---

## Recommended next workflow

`trace` — to produce the Epic-3 traceability matrix and confirm each AC/P0 risk maps to at least one of these (high-quality) tests. No `automate`/healing work is indicated; the suite is green, deterministic, and mechanism-asserting.
