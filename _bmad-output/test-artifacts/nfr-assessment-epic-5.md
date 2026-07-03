---
stepsCompleted:
  - step-01-load-context
  - step-02-define-thresholds
  - step-03-gather-evidence
  - step-04-evaluate-and-score
  - step-04e-aggregate-nfr
  - step-05-generate-report
lastStep: step-05-generate-report
lastSaved: '2026-07-03'
workflowType: testarch-nfr-assess
assessmentLevel: epic
epicNum: 5
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-5.md
  - _bmad-output/test-artifacts/traceability/epic-5-traceability-report.md
  - _bmad-output/test-artifacts/nfr-assessment-epic-4.md
  - _bmad-output/implementation-artifacts/5-1-tenant-owned-calculation-schema-and-server-commands.md
  - _bmad-output/implementation-artifacts/5-2-calculation-editor-ux-for-sections-and-rows.md
  - _bmad-output/implementation-artifacts/5-3-pricing-source-selection-and-row-snapshots.md
  - _bmad-output/implementation-artifacts/5-4-calculation-readiness-review-and-snapshot-preview.md
  - _bmad-output/implementation-artifacts/5-5-calculation-golden-tests-for-options-hidden-rows-and-tax-warnings.md
  - _bmad-output/test-artifacts/automation-summary-5-1.md
  - _bmad-output/test-artifacts/automation-summary-5-3.md
  - _bmad-output/test-artifacts/automation-summary-5-4.md
  - _bmad-output/test-artifacts/automation-summary-5-5.md
  - supabase/migrations/20260702120000_calculation_data_model.sql (3 calc tables + enable/force RLS + own-tenant policies + 2 SECURITY INVOKER reorder RPCs)
  - supabase/migrations/20260703120000_calculation_row_pricing_source.sql (additive no-FK frozen source_* snapshot columns)
  - src/features/calculations/{totals,readiness,vat-posture,ordering,form-parsing,source-select,source-options,money-input,action-state}.ts
  - src/lib/money/** (Epic 4 engine — every calc total routes through it)
  - tests/unit/features/calculations/**, tests/unit/server/commands/calc*, tests/integration/commands/calculation*, tests/integration/rls/**, tests/e2e/calculations/**
  - tests/fixtures/golden/money/calc-rows.json (anonymized; extends the Epic 4 options-tillval.json inclusion pin)
  - tests/integration/rls/tenant-table-inventory.ts (TENANT_TABLES: 3 calc tables enrolled)
  - .github/workflows/ci.yml (verify + db + e2e jobs)
  - package.json (scripts; no new runtime dependency this epic)
  - knowledge: adr-quality-readiness-checklist.md, ci-burn-in.md, test-quality.md, error-handling.md
---

# NFR Assessment - Epic 5: Calculation Workspace And Quote Readiness

**Date:** 2026-07-03
**Epic:** 5 (Stories 5.1–5.5) — tenant-owned calc schema + server commands (5.1), calculation editor UX (5.2), pricing-source selection + frozen row snapshots (5.3), readiness review + snapshot preview (5.4), calc golden tests for options/hidden-rows/tax-warnings (5.5)
**Overall Status:** PASS (advisory) ✅ — with the same 2 standing forward-looking CONCERNS carried since Epic 2 (no `pnpm audit` gate, no coverage reporter), 1 documented sequencing deferral (required-file check gated on Story 8.1), and the standing owner/accounting/legal tax sign-off items (all non-gating)

---

Note: This assessment summarizes existing evidence; it does not run tests or CI workflows. The Epic 5 unit/golden suite (850/850 pass) is per the 5.5 automation record and the epic-5 traceability report; INT/RLS/E2E are CI-gated (`SUPABASE_TEST_REQUIRED=1`). Several load-bearing source-level claims were re-verified directly for this audit (RLS enable+force on all 3 calc tables, SECURITY INVOKER reorder RPCs with PUBLIC-execute revoked, no-FK frozen `source_*` columns, totals delegate to `@/lib/money`, calc-fixture PII scan present, CI gate contents) — see each section's Evidence line.

## Executive Summary

**Assessment:** 6 PASS, 2 CONCERNS, 0 FAIL across the in-scope categories.

**Blockers:** 0. Every one of the eight **Non-Negotiable epic blockers** in the Epic 5 test design is met and test-proven (all 3 calc tables carry direct `tenant_id` + enable+**force** RLS + own-tenant policies + `anon → none` + `TENANT_TABLES` enrollment; no cross-tenant customer/facility/contact/work-role/article link accepted; every customer-visible total/VAT/deduction routes through `@/lib/money` with no inline math; multi-row reorder/save is atomic via narrow `SECURITY INVOKER` RPCs; pricing-source row snapshots are frozen no-FK copy-by-value; hidden-row/selected-tillval totals match the 2026-06-18 inclusion pin; readiness blockers gate the create-quote affordance and tax warnings are framed estimate + `requiresSignOff` never legally-final; no real PII/secret in any calc golden fixture). All eleven high-priority risks (score ≥6) from the test design are mitigated and proven by running tests (epic-5-traceability-report.md, gate: PASS — P0 100% / P1 100% / overall 100%, 26/26 FULL).

**High Priority Issues:** 0. No new HIGH-priority NFR issue introduced. Both remaining CONCERNS are LOW-priority, forward-looking, and identical to the two carried un-actioned across Epics 2–4.

**What changed vs Epic 4 (why the domain mix shifts back to isolation):** Epic 4 was pure logic — no table, no UI, RLS "not the headline." **Epic 5 is the opposite: RLS is the headline again**, as in Epics 2–3, because it introduces **three new tenant-owned tables** (`calculations`, `calculation_sections`, `calculation_rows`) — the first calculation tables. Simultaneously it is the **first heavy CONSUMER of the Epic 4 money engine + the Epic 3 snapshot contract**, so a *second* class of NFR concern sits on top of isolation: **money-integrity-by-composition** (every customer-visible total must route through the frozen `@/lib/money` primitives and copy-by-value snapshot builders, never be re-derived inline). It is the **widest test surface since Epic 3** — UNIT + INT + RLS + E2E + GOLDEN. Two domains remain **deliberately deferred N/A for Phase A**: runtime performance/load at scale (no SLA, single pilot tenant, pure in-memory quote-sized inputs — R-510) and availability/DR/MTTR (no deployed production runtime with an SLO). Inherited RLS/anon/service-role/audit gates from Epics 2–3 remain green as standing regression, now **extended** to the 3 calc tables (not forked) via the shared `TENANT_TABLES` inventory + H4 gate.

**Recommendation:** **PASS (advisory).** Epic 5 lands the first tenant-owned calculation workspace with the correct posture on every axis: isolation is enforced structurally (enable+force RLS + own-tenant policies + `anon → none` + composite same-tenant FKs + mandatory `TENANT_TABLES` enrollment whose H4 gate FAILS CI on an unenrolled table — not reviewer diligence); atomicity is server-owned (narrow `SECURITY INVOKER` RPCs that commit-or-rollback, PUBLIC execute revoked — no client-side multi-step consistency boundary); money integrity is by-composition (totals delegate to `@/lib/money`; DB `CHECK (..._ore >= 0)` on every öre column); pricing-source snapshots are frozen no-FK copy-by-value (a later source archive/rate change cannot mutate a prior row); and tax/readiness ships nothing legally-final (tax warnings carry `requiresSignOff` + non-final framing; no deduction path renders approved). The two remaining CONCERNS are the **same two forward items still un-actioned** — (a) no dependency-vulnerability scan gate (`pnpm audit`) in CI, and (b) no line-coverage reporter wired (priority-weighted trace coverage, 100%, remains the governing metric). Neither weakens any Epic-5 exit criterion. The required-file readiness check is a **documented deferral** gated on Story 8.1 (surfaced as a fail-open `REQUIRED_FILES_DEFERRED` warning, never a silent omission), and the owner/accounting/legal tax sign-offs are **decision items, not coverage gaps** (the engine correctly ships all tax constants UNAPPROVED + warnings).

---

## Findings Summary (ADR Quality Readiness Checklist — 8 categories)

| # | Category | Epic-5 evidence | Status |
| - | -------- | --------------- | ------ |
| 1 | Testability & Automation | Full pyramid — UNIT (`node --test`) + INT/RLS (Vitest/local Supabase) + E2E (Playwright) + GOLDEN. Extracted pure functions (`totals`/`readiness`/`ordering`/`form-parsing`/`source-select`) unit-pin the logic OUT of the client island (coverage-shape lesson). 850/850 unit+golden green; no active `.skip`/`.only`/`fixme`. Every test-design ID present in-source | PASS ✅ |
| 2 | Test Data Strategy | Two-tenant factory extended with calc/section/row seed + cleanup; anonymized `calc-rows.json` golden extends the Epic 4 `options-tillval.json` inclusion pin (does not fork the rule); count-asserting tests seed `crypto.randomUUID()`; CI PII/secret scan over the data payload | PASS ✅ |
| 3 | Scalability & Availability (harness/schema) | 3 new tenant tables absorbed by the existing dual-runner + RLS/H4 inventory with zero rework (enrollment mandatory). Atomic multi-row writes are DB-side (narrow RPC). Product runtime scalability/availability = N/A/deferred (no SLA, single pilot tenant) | PASS ✅ (harness) / N/A (runtime) |
| 4 | Disaster Recovery | N/A this epic — no deployed production runtime / SLO; new tables add persisted state but no live runtime to fail over in Phase A | N/A (deferred) ⚠️→✅ |
| 5 | Security | 3 calc tables: direct `tenant_id` + enable+**force** RLS + own-tenant `is_tenant_admin` policies + no anon grant + no authenticated DELETE grant + `TENANT_TABLES` enrollment; composite same-tenant FKs + command re-validation reject foreign parent/source (`TENANT_ACCESS_DENIED`); reorder RPCs `SECURITY INVOKER` + fixed empty search_path + PUBLIC-execute revoked; no PII into engine/rows/fixtures | PASS ✅ |
| 6 | Monitorability / Debuggability / Manageability | Typed `VALIDATION_FAILED`/`TENANT_ACCESS_DENIED`; readiness emits typed codes (`TOTAL_UNCOMPUTABLE`, `MISSING_CUSTOMER`, `TAX_SIGN_OFF_REQUIRED`, `LOW_MARGIN`, `REQUIRED_FILES_DEFERRED`) with blocker-vs-warning severity; reorder RPC rejects the whole payload (23514) on a bad id; frozen `source_*` fields keep a row explainable after source archive | PASS ✅ |
| 7 | QoS / QoE (money/readiness correctness = the "quality of service") | Editor/readiness totals == `@/lib/money` engine totals (5.2-UNIT-01); inclusion pin matched (unselected never summed, hidden IS counted); calc golden pack (14) + coverage GAP tests (5) drive the real engine; readiness rule-table classifier pinned (45 unit cases) | PASS ✅ |
| 8 | Deployability | New migrations reset cleanly with exact per-table policy enumeration; `verify` job (lockfile, service-role containment, typecheck, lint, unit, build, bundle-containment) + `db` job (`test:int`, `SUPABASE_TEST_REQUIRED=1`) + `e2e` job all present; **dependency-scan gate still absent** | CONCERNS ⚠️ (carried — no `pnpm audit` gate) |

**Also standing:** **Vulnerability management** — 0 critical / 0 high is *asserted by exact pins + frozen-lockfile*, but there is still **no automated `pnpm audit` gate** in CI (confirmed: no `audit`/`snyk`/`dependabot` reference in `.github/workflows/ci.yml`). Epic 5 added **no new runtime dependency**, so the dependency surface did not grow — but the concern is now carried across **four** epics unaddressed. This is the second standing CONCERNS.

---

## Performance Assessment

### Response Time (p95)

- **Status:** N/A (deferred) ⚠️→✅
- **Threshold:** UNKNOWN — no Phase-A SLA/SLO defined for the calculation workspace (test-design R-510: "Calc-at-scale perf untested — pure in-memory logic on quote-sized inputs; no SLA defined for Phase A").
- **Actual:** The money/readiness logic is pure, synchronous, in-memory integer öre arithmetic over quote-sized inputs (single pilot tenant). DB writes go through narrow single-transaction RPCs and RLS-scoped commands (quote-sized payloads). No load/latency SLA exists to measure against.
- **Evidence:** `src/features/calculations/totals.ts`/`readiness.ts` (delegate to `@/lib/money`; no I/O in the pure paths); reorder RPCs are single DB-side transactions; test-design R-510.
- **Findings:** Correctly deferred. Functional correctness (isolation + math-via-engine + readiness classification) — not throughput/latency — is the Phase-A concern. No user-facing SLA yet.

### Throughput / Resource Usage / Scalability (runtime)

- **Status:** N/A (deferred) ⚠️→✅ — no threshold defined; calc-at-scale perf is R-510 (deferred to a later calc epic if an SLA emerges).
- **Findings:** No concern for Phase A. **Carried-forward action (post-pilot):** if a calc-at-scale SLA is set (e.g. very large multi-section quotes, or a reorder over hundreds of rows), add a micro-benchmark for `computeCalculationTotals` and the reorder RPC payload size.

---

## Security Assessment

### Tenant Isolation — 3 new calc tables (R-501)

- **Status:** PASS ✅ — the headline control of this epic.
- **Threshold:** Every new calc table must carry direct `tenant_id` + enable+**force** RLS + own-tenant SELECT/INSERT/UPDATE policies + `anon → none` GRANT + archive-over-delete + **`TENANT_TABLES` enrollment** (H4 gate must green).
- **Actual:** Verified in-migration: `calculations`, `calculation_sections`, `calculation_rows` each carry `enable row level security` AND `force row level security`, own-tenant `*_select_own`/`*_insert_own`/`*_update_own` policies, GRANTs `select, insert, update` to `authenticated` only (no anon grant), and `delete` granted **only** to `service_role` (no authenticated DELETE — archive-over-delete). All 3 are enrolled in `tenant-table-inventory.ts` with spoof/filter/mutation metadata, so the compile-exhaustive H4 gate FAILS CI on an unenrolled tenant table (automated backstop, not reviewer diligence).
- **Evidence:** `supabase/migrations/20260702120000_calculation_data_model.sql` (grep-confirmed enable+force RLS ×3, 9 own-tenant policies, no anon grant, DELETE→service_role only); `tests/integration/rls/tenant-table-inventory.ts`; `5.1-RLS-01/02` cross-tenant + anon + H4 gate; `5.1-INT-01` migration-reset per-table policy enumeration.
- **Findings:** Structurally correct and machine-enforced. The isolation of another tenant's pricing/estimate is the highest-impact control in the epic and it is proven, not asserted.

### Cross-Tenant Parent / Source Link Rejection (R-502)

- **Status:** PASS ✅
- **Threshold:** No command may accept a foreign customer/facility/contact (calc parent) or work-role/article (row source); a bare non-composite FK is a cross-tenant hole.
- **Actual:** Composite same-tenant FKs `(child, tenant_id) → parent(id, tenant_id)` at the DB for every parent and source reference, plus command-layer re-validation (`verifyOwnership` / `resolveSnapshotSource` → zero rows under RLS ⇒ `TENANT_ACCESS_DENIED`). Both-layer negatives spoof a foreign parent id AND a foreign source id.
- **Evidence:** `calculation-parent-ownership.int.test.ts` 5.1-INT-02 (foreign parent → `TENANT_ACCESS_DENIED`; client tenant_id ignored); `calculation-row-source.int.test.ts` 5.3-INT-03 (foreign source, both layers).
- **Findings:** Defense-in-depth (DB composite FK + command re-validation). No single-layer trust.

### Atomic Multi-Row Writes — server-owned consistency boundary (R-503)

- **Status:** PASS ✅ (security/data-integrity control)
- **Threshold:** Multi-row reorder/save must be atomic via a narrow RPC / server transaction (ADR-A009) — NO client-side multi-step persistence as the consistency boundary; a mid-transaction failure must roll back fully.
- **Actual:** Two narrow Postgres RPCs (`reorder_calculation_rows`, `reorder_calculation_sections`) are `SECURITY INVOKER` (run under the caller's RLS — own-tenant only, no service-role app path), have a fixed empty `search_path`, run as a single commit-or-rollback transaction, and reject the WHOLE payload (23514 check_violation) on any foreign/duplicate id so no partial order is committed; PUBLIC execute is revoked (granted only to `authenticated`/`service_role`).
- **Evidence:** migration `20260702120000` (grep-confirmed `security invoker`, `revoke execute … from public`, transaction body); `calculation-commands.int.test.ts` 5.1-INT-03 (reorder rows/sections commit + rollback).
- **Findings:** Correct architecture. The consistency boundary is in the database, not the browser — the exact prohibition R-503 targets.

### Data Protection — No PII in the engine / rows / fixtures (R-516)

- **Status:** PASS ✅
- **Threshold:** No personnummer/orgnr/name/email/phone/address/secret in any calc golden fixture; no personnummer into `@/lib/money` or a calc row/snapshot; the engine takes a resolved eligibility POSTURE only.
- **Actual:** `calc-golden-pack.test.ts` 5.5-UNIT-01 runs the extended PII/secret scan (personnummer `\d{6}-\d{4}`, orgnr `\d{10}`, non-`example.test` email, `secret|password|api_key`, phone, address) over `calc-rows.json`'s DATA payload; the scan is non-vacuous (every öre value kept < 10 digits to avoid the orgnr false-positive trap). ROT/grön readiness feeds a resolved POSTURE, never a personnummer (`readiness.ts` line 465 / R-516 comments).
- **Evidence:** `tests/unit/features/calculations/calc-golden-pack.test.ts` 5.5-UNIT-01; `src/features/calculations/readiness.ts` (posture-only, PII never routed); part of `pnpm test:unit` in the CI `verify` job.
- **Findings:** Strong — the SEC control that makes the calc golden pack safe to commit; it runs on every PR. Consistent with the Epic 4 fixture-privacy discipline, extended (not forked) to calc rows.

### Compliance Posture — Readiness never renders tax as legally-final (R-509)

- **Status:** PASS ✅
- **Threshold:** ROT/grön/VAT readiness copy must be framed as an ESTIMATE requiring sign-off (`requiresSignOff`), never approved/legally-final; readiness blockers must GATE the create-quote affordance.
- **Actual:** `readiness.ts` emits `TAX_SIGN_OFF_REQUIRED` as a WARNING with explicit non-final "estimate requiring sign-off" framing (module header + line 331 comments: "a deduction is NEVER rendered approved/legally-final"); the eligibility posture is the resolved posture, never a personnummer. Blockers (`TOTAL_UNCOMPUTABLE`, `MISSING_CUSTOMER`) gate the affordance; the classifier is fail-open to WARNING except the one genuine blocker (no customer), which is the conservative pilot default.
- **Evidence:** `src/features/calculations/readiness.ts` (grep-confirmed framing); `readiness.test.ts` 5.4-UNIT-01/02 (rule table + non-final framing, no `approved:true` path); `calculation-readiness.e2e.spec.ts` 5.4-E2E-01 (both gate states); `calc-golden-pack-coverage.test.ts` GAP-B/C (blocker + fail-open discipline).
- **Findings:** Excellent and behavioral, not cosmetic. Mirrors the Epic 4 sign-off gate at the readiness/UI layer.

### Input Validation / Vulnerability Management

- **Status (input validation):** PASS ✅ — typed `VALIDATION_FAILED` for invalid row type (closed union), non-positive qty, bad unit, float/negative/overflow öre (canonical `isOreAmount`/`ORE_AMOUNT_MAX`, no fork), missing/malformed VAT assumption, illegal lifecycle transition; the raw invalid value is never echoed; the reorder RPC rejects the whole payload on a bad id.
- **Status (vulnerability management):** CONCERNS ⚠️ (LOW priority; carried un-actioned across Epics 2–5)
- **Threshold:** 0 critical / 0 high dependency vulnerabilities, gated in CI.
- **Actual:** No `pnpm audit` / dependency-scan gate is wired into CI (confirmed: no `audit`/`snyk`/`dependabot` reference in `.github/workflows/ci.yml`). Epic 5 added **no new runtime dependency**, so the dependency surface did not grow — but the auth + DB client libraries from Epic 2 remain unscanned by an automated gate.
- **Evidence:** `.github/workflows/ci.yml` (no audit step); `src/server/commands/calculations/validation.ts`, `calc-validation-coverage.test.ts` (29 cases), `calc-source-validation.test.ts`; `calc-golden-pack.test.ts` öre-under-10-digits guard.
- **Findings:** Input validation is a strength. Vulnerability management is acceptable for an internal pilot (exact pins + `--frozen-lockfile`), but this CONCERN is now **carried across four epics** — a `pnpm audit --audit-level=high` CI step remains the obvious quick win and should land before any external exposure, or the owner should formally accept the residual.

---

## Reliability Assessment

### Pricing-Source Snapshot Immutability (R-507) — the reliability property of this epic

- **Status:** PASS ✅
- **Threshold:** A row's captured pricing-source snapshot must NOT change when the source work-role/article is mutated or archived later; the capture is copy-by-value + injected `capturedAt` (no clock read).
- **Actual:** The additive `source_*` columns are DELIBERATELY no-FK copy-by-value captures (`source_id` is a captured value, not a referential FK; migration header states this verbatim). `source_captured_at` is injected (no wall-clock read in the builder). Mutating/archiving the source AFTER capture does not reach a prior row; the row stays explainable from its own frozen fields.
- **Evidence:** `supabase/migrations/20260703120000_calculation_row_pricing_source.sql` (grep-confirmed additive no-FK `source_*` columns + `source_price_ore >= 0`/`source_cost_ore >= 0` CHECKs + explicit "no FK from source_id" comment); `calculation-row-source.int.test.ts` 5.3-INT-02 (mutate/archive after capture ⇒ prior row unchanged), 5.3-INT-04 (explainable from row after archive).
- **Findings:** This is the load-bearing reliability guarantee for downstream Epic 6 (a sent quote version is immutable): a frozen pricing source cannot silently drift when a rate later changes. Reuses (not forks) the Epic 3/4 copy-by-value + injected-`capturedAt` freeze discipline.

### Error Handling / Fault Tolerance

- **Status:** PASS ✅
- **Threshold:** Every invalid/boundary path returns a typed, user-safe failure — never a silent wrong number; multi-row writes never partially apply.
- **Actual:** Commands return typed `Result<T, CommandErrorCode>` (never throw); engine `{ok:false}` propagates through `totals.ts` as a typed failure (never NaN); `TOTAL_UNCOMPUTABLE` is a readiness blocker; the reorder RPC rolls back the whole transaction on any bad/duplicate id (23514); validation never echoes the raw value.
- **Evidence:** `totals.test.ts` 5.2-UNIT-01 (engine-failure propagation → typed `{ok:false}`); `calculation-commands.int.test.ts` 5.1-INT-03/04; `readiness.ts` `TOTAL_UNCOMPUTABLE` path; error-handling knowledge fragment.
- **Findings:** Strong fault-isolation for a full-stack epic. Failures are observable (typed codes + severities), not swallowed; multi-row writes are all-or-nothing.

### Availability / MTTR / Disaster Recovery

- **Status:** N/A (deferred) ⚠️→✅ — no deployed production runtime/SLO in Phase A; the new tables add persisted state but no live runtime to fail over.
- **Findings:** Correctly out of scope for Phase A, consistent with Epics 2–4.

### CI Burn-In (Stability)

- **Status:** PASS ✅
- **Threshold:** Deterministic, non-flaky suite; 100% pass; INT/RLS/E2E hard-fail on a missing stack (no silent false-green).
- **Actual:** **850/850** unit+golden pass (0 fail, 0 skip, 0 todo) per the 5.5 automation record (658 after 5.1 → 850 after 5.5); INT/RLS (Vitest, local Supabase) run under `SUPABASE_TEST_REQUIRED=1` so a missing stack is a HARD failure; E2E (Playwright) CI-gated. No active `.skip`/`.only`/`fixme` (the RED-phase `notYetImplemented()` placeholder in `calc-validation.test.ts` now binds the real validators; skip-scan matches are comments). Count-asserting tests seed `crypto.randomUUID()` (no collision under parallel/non-reset runs); goldens live under `tests/unit/**` (not the `tests/golden/**` runner-glob vacuous-green trap).
- **Evidence:** automation-summary-5-5.md; epic-5-traceability-report.md (§ "Local run confirmation"); `.github/workflows/ci.yml` (`db` job `SUPABASE_TEST_REQUIRED: "1"`).
- **Findings:** Deterministic across a full-pyramid suite. The `SUPABASE_TEST_REQUIRED=1` guard is the right defense against a silently-skipped DB gate.

---

## Maintainability Assessment

### Test Coverage (priority-weighted)

- **Status:** PASS ✅ (trace-coverage) / CONCERNS ⚠️ (line-coverage reporter absent)
- **Threshold:** P0 100% / P1 ≥90% / overall ≥80% priority-weighted (test-design gate); calc/readiness pure logic ≥90%; RLS negatives 100% of the 3 tables; math-via-engine 100%; inclusion/section-mode/row-type branches 100% golden-pinned.
- **Actual:** Priority-weighted trace coverage is **100%** (26/26 mapped requirements FULL; P0 15/15, P1 8/8, P2 2/2, P3 1/1). No line-coverage % is computed (no coverage reporter wired) — the same minor forward gap carried from Epics 2–4; priority-weighted trace coverage remains the governing metric.
- **Evidence:** epic-5-traceability-report.md (Coverage Summary + Gate Criteria, gate PASS); no `c8`/`nyc`/coverage step in `package.json`/CI (grep-confirmed absent).
- **Findings:** Coverage of the critical isolation + math + readiness contract is exhaustive at the correct levels (RLS/INT for isolation & atomicity; UNIT/GOLDEN for math & classification; E2E for the editor journey). The missing reporter is a low-priority ergonomics gap, not a correctness gap.

### Code Quality / Technical Debt

- **Status:** PASS ✅
- **Threshold:** typecheck 0 errors, lint clean; single-source-of-truth (no forked money/öre/VAT/inclusion authority); calc/display logic extracted OUT of the client island into pure functions.
- **Actual:** typecheck/lint/build green per the automation records. Money integrity is by-composition — `totals.ts` delegates every öre op to `@/lib/money` (`lineNetOre`/`lineVatOre`/`sumOre`/`sumVatOre`/`vatBreakdown`/`selectVatDisplay`); grep for inline money math in `src/features/calculations/**` + `src/server/commands/**` returns only `percent * 100` basis-point conversions (markup/margin `%`→bp integers) and a display-only `%` label — **no** öre `*1.25`/`*0.25`/`toFixed`/`parseFloat(price)` path. Pure functions (`totals`/`readiness`/`ordering`/`form-parsing`/`source-select`/`money-input`/`vat-posture`) are extracted from the `"use client"` island and unit-pinned (coverage-shape lesson applied).
- **Evidence:** automation-summary-5-{1,3,4,5}.md (verify green); `src/features/calculations/totals.ts` (engine delegation, header "NO inline `+`/`*`/`0.25`"); source grep (only `percent * 100` bp conversions).
- **Findings:** Low technical debt. The single-authority discipline (one engine, one inclusion pin, one öre-validity rule) prevents the "second rounding mode / forked total in a client island" drift that R-505 targets.

### Documentation Completeness

- **Status:** PASS ✅
- **Actual:** Each story's Dev Agent Record documents scope guardrails (no deferred job/project/field-worker table; no supplier field), the atomic-RPC decision (ADR-A009), the frozen-source discipline, and reviewer-resolved findings; the test-design and traceability reports enumerate the sanctioned scope decisions (required-file 8.1 deferral, `persons` flat-cap placeholder, no-Lovable-delta-yet) and route the standing NFR concerns + owner sign-offs. Source headers document the engine-delegation + non-final tax framing + no-FK freeze verbatim.
- **Evidence:** 5.1–5.5 implementation-artifacts; test-design-epic-5.md; epic-5-traceability-report.md.
- **Findings:** Complete and reconciled; deferred/owner-gated items are logged with owners, not lost.

### Test Quality (from trace/automation review)

- **Status:** PASS ✅
- **Actual:** Tests are mechanism-asserting: editor total == engine total incl. `{ok:false}` propagation (not "≈"); the inclusion pin proven by a non-vacuous negative oracle (unselected option NEVER summed, hidden row IS counted); source-freeze proven behaviorally (mutate/archive after capture ⇒ inert); cross-tenant/anon negatives are data-driven off the shared inventory (H4 gate = compile-exhaustive completeness backstop); readiness classified per an explicit rule table (45 cases). Golden expected values carry the three-way old-Lovable/new-expected/documented-delta labelling discipline (ready to absorb a real Lovable delta at Epic 9; none fabricated).
- **Evidence:** epic-5-traceability-report.md (Coverage Heuristics — all COVERED, "Happy-path-only: NONE detected"); `calc-golden-pack.test.ts`, `calc-golden-pack-coverage.test.ts` (GAP-A..E), `readiness.test.ts`, `readiness-inclusion.golden.test.ts`.
- **Findings:** High test quality — negatives before positives, behavioral freeze/inclusion oracles, no vacuous-green traps. This is the recurring calc oracle Epics 6–7 will extend.

---

## Custom NFR Assessments (Epic-5-specific)

### Money Integrity by Composition (route every total through `@/lib/money`; no inline math)

- **Status:** PASS ✅
- **Threshold:** No customer-visible total/VAT/net/gross/deduction re-derived inline in a command or client island; all öre columns integer with a DB `CHECK (..._ore >= 0)`; kronor only at the presentation formatter.
- **Actual:** `totals.ts`/`readiness.ts` delegate every öre op to `@/lib/money`; the only `* 100` occurrences in the calc feature are markup/margin **percent→basis-point** conversions and a `%` display label (not öre money math). DB `CHECK (..._ore >= 0)` on `unit_cost_ore`/`unit_sell_ore` (calc rows) and `source_price_ore`/`source_cost_ore` (frozen snapshot). Editor total proven byte-equal to the engine total (5.2-UNIT-01).
- **Evidence:** `src/features/calculations/totals.ts`; migration öre CHECKs (grep-confirmed); `totals.test.ts` 5.2-UNIT-01; `calc-golden-pack-coverage.test.ts` (drives the real engine).
- **Findings:** The foundational integrity guarantee for every downstream quote/PDF is proven and grep-verified: the calc workspace consumes the frozen engine, it does not fork it.

### Inclusion Pin Fidelity (hidden + selected COUNT; unselected NEVER summed)

- **Status:** PASS ✅ — covered under Reliability/QoS and R-508. The 2026-06-18 owner-decided pin (`options-tillval.json`) is MATCHED, not re-decided; `5.4-GOLDEN-01` + GAP-A prove an unselected option is never summed and a hidden row is counted. A divergent rule treated as production-approved is a STOP (needs-human) — none introduced.

---

## Quick Wins

2 quick wins identified for immediate implementation:

1. **Add a `pnpm audit --audit-level=high` CI step** (Deployability / Vulnerability mgmt) — MEDIUM — ~0.5–1 h
   - Wire a dependency-scan step into the `verify` job in `.github/workflows/ci.yml` (config only, no code change). Closes the CONCERNS carried across FOUR epics before any external exposure.
2. **Wire a coverage reporter (`c8`) over `test:unit`** (Maintainability) — LOW — ~1–2 h
   - Emit line-coverage for the pure `src/features/calculations/**` + `src/lib/money/**` surfaces so the ≥90% calc/readiness-logic target has a machine number alongside the (already-100%) priority-weighted trace coverage. Report-only; do not gate on it initially.

---

## Recommended Actions

### Immediate (Before Release) — CRITICAL/HIGH Priority

None. No CRITICAL/HIGH NFR issue; no release blocker for the Epic-5 deliverable. All eight Non-Negotiable epic blockers met and test-proven.

### Short-term (Next Milestone) — MEDIUM Priority

1. **Dependency-scan CI gate** — MEDIUM — ~0.5–1 h — Ops/Dev
   - Add `pnpm audit --audit-level=high` to the `verify` job. **This is the standing CONCERNS now carried across Epics 2–5** — schedule it, or have the owner formally accept the residual for the internal pilot (do not keep silently carrying it).
2. **Route the standing owner/accounting/legal tax sign-off items to the working session** — MEDIUM — Owner
   - Confirm the 2026-06-18 inclusion pin as pilot policy (R-508); confirm the readiness blocker-vs-warning split incl. "low margin" = warning and "missing customer" = blocker (R-509); approve the "new version required after send" copy (R-514) and the tax-warning non-final wording (R-509); plus the standing Epic 4 carry-overs (rounding mode, VAT display default, ROT/grön rates/caps/mix, eligibility disclaimer, personnummer scope, approval posture, accepted-price delta shape). The engine ships all of these as UNAPPROVED + `requiresSignOff` — these are **decisions**, not code fixes.

### Long-term (Backlog) — LOW Priority

1. **Coverage reporter** — LOW — ~1–2 h — Dev (report-only).
2. **Required-file readiness check (R-513)** — LOW/sequencing — Dev + PM — wire the `REQUIRED_FILES_DEFERRED` fail-open warning to real file metadata when Story 8.1 lands (no rule-shape change; currently a documented deferral, never a silent omission).
3. **`persons` per-person ROT cap multiplier (R-512)** — LOW/owner-gated — Dev + Owner — the deduction uses a single flat `capOre`; `persons` is threaded into fixtures but does not scale the cap. Deferred behind Epic 4 Sign-Off Q3; `readiness.test.ts` explicitly asserts NO per-person-cap implication is emitted (pinned placeholder, not a defect).
4. **Calc-at-scale micro-benchmark (R-510)** — LOW — Dev — only if a Phase-A/post-pilot SLA emerges for large multi-section quotes or large reorder payloads.

---

## Monitoring Hooks

Runtime monitoring is **N/A for Phase A** (no deployed runtime/SLO). The applicable "monitoring" is the CI full-pyramid gate + the calc golden oracle + the H4 inventory gate:

- [x] **Calc golden pack + inclusion pin** — the recurring regression oracle; a labelled failure points at the affected assumption. **Owner:** Dev. **Runs:** every PR (`test:unit`).
- [x] **H4 `TENANT_TABLES` inventory gate** — a new tenant table left unenrolled FAILS CI (compile-exhaustive). **Owner:** Dev. **Runs:** every PR (`test:int`, `SUPABASE_TEST_REQUIRED=1`).
- [x] **Calc fixture PII/secret scan** — CI unit gate detects any PII/secret introduced into `calc-rows.json`. **Owner:** Dev.
- [ ] **`pnpm audit` gate** — detect a newly-disclosed dependency CVE before merge. **Owner:** Ops/Dev. **Deadline:** before external exposure. *(the standing gap)*

---

## Fail-Fast Mechanisms

- [x] **Isolation gates (Security):** enable+force RLS + own-tenant policies + composite same-tenant FKs + mandatory `TENANT_TABLES` enrollment (H4 gate) — an unenrolled table fails CI. Present.
- [x] **Atomicity gate (Reliability):** narrow `SECURITY INVOKER` reorder RPCs roll back the whole payload on any bad/duplicate id (23514) — no partial order. Present.
- [x] **Validation gates (Security):** typed `VALIDATION_FAILED`/`TENANT_ACCESS_DENIED` reject invalid row/qty/unit/öre/VAT/lifecycle and foreign parent/source — no silent wrong number, raw value never echoed. Present.
- [x] **Smoke/fast gate (Maintainability):** the pure `test:unit` suite (850 unit+golden) is the fast fail-fast gate on every PR; the golden inclusion pin + calc oracle catch a money regression instantly. Present.
- [x] **Structural sign-off gate (Compliance):** readiness `TAX_SIGN_OFF_REQUIRED` warning + non-final framing + no `approved:true` path — a fail-fast against shipping unapproved tax as final. Present.
- [ ] **Rate limiting / circuit breakers:** N/A — no external-facing runtime service surface in Epic 5.

---

## Evidence Gaps

2 evidence gaps identified — both LOW priority, both deliberately deferred (not action-required for the Epic-5 gate):

- [ ] **Dependency-vulnerability scan** (Deployability / Security) — **Owner:** Ops/Dev — **Deadline:** before external exposure — **Suggested Evidence:** `pnpm audit --audit-level=high` CI step output — **Impact:** LOW for internal pilot (exact pins + frozen lockfile; no new dep this epic), but carried FOUR epics.
- [ ] **Line-coverage report** (Maintainability) — **Owner:** Dev — **Deadline:** backlog — **Suggested Evidence:** `c8` lcov over `test:unit` — **Impact:** LOW — priority-weighted trace coverage is 100%; this is an ergonomics number, not a correctness gap.

**Documented deferral (not an evidence gap):** required-file readiness check (R-513) is gated on Story 8.1 landing; it currently surfaces as a fail-open `REQUIRED_FILES_DEFERRED` warning (never silent). Wire to real file metadata when 8.1 ships.

---

## Findings Summary

**Based on ADR Quality Readiness Checklist (8 categories)**

| Category | Overall Status |
| -------- | -------------- |
| 1. Testability & Automation | PASS ✅ |
| 2. Test Data Strategy | PASS ✅ |
| 3. Scalability & Availability | PASS ✅ (harness) / N/A runtime (deferred) |
| 4. Disaster Recovery | N/A (deferred) ⚠️→✅ |
| 5. Security | PASS ✅ |
| 6. Monitorability / Debuggability / Manageability | PASS ✅ |
| 7. QoS & QoE (money/readiness correctness) | PASS ✅ |
| 8. Deployability | CONCERNS ⚠️ (no `pnpm audit` gate) |
| **Vulnerability Management (cross-cutting)** | **CONCERNS ⚠️ (carried Epics 2–5)** |
| **Overall** | **PASS (advisory) ✅ — 6 PASS, 2 CONCERNS, 0 FAIL** |

**Scoring:** In-scope categories: 6 PASS, 2 CONCERNS (Deployability/vuln-scan + line-coverage reporter), 0 FAIL. Runtime performance/load (R-510) and availability/DR are N/A — deferred for the internal pilot (no SLA/production runtime yet). No new HIGH-priority NFR issue.

---

## Gate YAML Snippet

```yaml
nfr_assessment:
  date: '2026-07-03'
  epic: 5
  feature_name: 'Calculation Workspace And Quote Readiness'
  assessment_level: epic
  trace_coverage: '26/26 FULL (100%; P0 15/15, P1 8/8, P2 2/2, P3 1/1)'
  categories:
    testability_automation: PASS
    test_data_strategy: PASS
    scalability_availability: PASS # harness; runtime N/A (deferred)
    disaster_recovery: N/A # deferred (no production runtime/SLO)
    security: PASS # 3-table isolation + atomic RPC + no-PII + non-final tax
    monitorability: PASS
    qos_qoe: PASS # money-via-engine + inclusion pin + readiness classification
    deployability: CONCERNS # no pnpm audit gate
    vulnerability_management: CONCERNS # carried Epics 2-5
  overall_status: PASS_ADVISORY
  critical_issues: 0
  high_priority_issues: 0
  medium_priority_issues: 2 # pnpm audit gate; route tax sign-off questions
  concerns: 2 # no dependency-scan gate; no coverage reporter
  blockers: false
  quick_wins: 2
  evidence_gaps: 2 # dependency scan; line-coverage report
  documented_deferrals: # not gaps — deferred by design, surfaced not silent
    - required_files_readiness_check # R-513, gated on Story 8.1
    - persons_per_person_rot_cap_multiplier # R-512, owner-gated (Epic 4 Q3)
    - no_lovable_calc_delta_yet # oracle discipline in place, awaits Epic 9 capture
  deferred_na: # not gaps — deferred by Phase-A design
    - runtime_performance_load_at_scale # R-510 (no SLA, pure in-memory, single pilot tenant)
    - availability_dr_mttr # no deployed production runtime/SLO
  owner_signoff_items_surfaced: standing # inclusion pin, blocker/warning split, new-version copy, tax non-final wording + Epic 4 carry-overs
  recommendations:
    - 'Add pnpm audit --audit-level=high CI gate (standing CONCERNS, carried Epics 2-5) — schedule or formally accept'
    - 'Route the standing owner/accounting/legal tax sign-off items to the working session (decision, not a code fix)'
    - 'Wire a coverage reporter (c8) over test:unit — report-only'
    - 'Wire the required-file readiness check to real file metadata when Story 8.1 lands (R-513)'
```

---

## Related Artifacts

- **Test Design:** `_bmad-output/test-artifacts/test-design-epic-5.md`
- **Traceability + Gate (PASS):** `_bmad-output/test-artifacts/traceability/epic-5-traceability-report.md`
- **Prior NFR (format + standing concerns):** `_bmad-output/test-artifacts/nfr-assessment-epic-4.md`
- **Story records:** `_bmad-output/implementation-artifacts/5-{1,2,3,4,5}-*.md`
- **Automation summaries:** `_bmad-output/test-artifacts/automation-summary-5-{1,3,4,5}.md`
- **Source under assessment:**
  - `src/features/calculations/{totals,readiness,vat-posture,ordering,form-parsing,source-select,source-options,money-input,action-state}.ts`
  - `src/lib/money/**` (Epic 4 engine — every calc total routes through it)
  - `supabase/migrations/20260702120000_calculation_data_model.sql`, `supabase/migrations/20260703120000_calculation_row_pricing_source.sql`
- **Evidence Sources:**
  - Unit + golden: `tests/unit/features/calculations/**`, `tests/unit/server/commands/calc*`; fixture `tests/fixtures/golden/money/calc-rows.json`
  - INT + RLS: `tests/integration/commands/calculation*`, `tests/integration/rls/**` (`tenant-table-inventory.ts` — 3 calc tables enrolled)
  - E2E: `tests/e2e/calculations/**` (3 Playwright specs)
  - CI: `.github/workflows/ci.yml` (`verify` + `db` (`SUPABASE_TEST_REQUIRED=1`) + `e2e` jobs; no `audit`/coverage step)
  - Suite: `pnpm run test:unit` → 850 pass / 0 fail / 0 skip (per 5.5 automation record + trace report)

---

## Recommendations Summary

**Release Blocker:** None. 0 FAIL, 0 blocker; all eight Non-Negotiable epic blockers met and test-proven.

**High Priority:** None.

**Medium Priority:** (1) Land the `pnpm audit` CI gate or have the owner formally accept the residual — do not keep silently carrying it (now four epics). (2) Route the standing owner/accounting/legal tax sign-off items to the working session.

**Next Steps:** Epic 5's gate (trace) is already **PASS**. This NFR assessment concurs: **PASS (advisory)**. Proceed to epic close / `*retrospective`. Carry the two standing CONCERNS (dependency-scan gate, coverage reporter) forward with named owners; wire the required-file readiness check when Story 8.1 lands. None of these weaken any Epic-5 exit criterion.

---

## Sign-Off

**NFR Assessment:**

- Overall Status: PASS (advisory) ✅
- Critical Issues: 0
- High Priority Issues: 0
- Concerns: 2 (no `pnpm audit` gate; no coverage reporter — both LOW-priority, carried forward)
- Evidence Gaps: 2 (dependency scan; line-coverage report — both deferred)
- Documented Deferrals (surfaced, not silent): required-file readiness check (R-513, Story 8.1); `persons` flat-cap placeholder (R-512); no Lovable calc delta yet
- Deferred N/A (by Phase-A design): runtime performance/load at scale (R-510); availability/DR/MTTR

**Gate Status:** PASS (advisory) ✅ — concurs with the epic-5 traceability gate (PASS)

**Next Actions:**

- PASS ✅: Proceed to epic close / retrospective / release-gate.
- Carry the 2 standing CONCERNS forward with owners (dependency-scan gate; coverage reporter).
- Route the standing owner/accounting/legal tax sign-off items to the working session (decision items; engine already ships them UNAPPROVED + `requiresSignOff` warnings).
- Wire the required-file readiness check to real file metadata when Story 8.1 lands (R-513, documented deferral).

**Generated:** 2026-07-03
**Workflow:** testarch-nfr (epic-level evidence audit)

---

<!-- Powered by BMAD-CORE™ -->
