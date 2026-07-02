---
stepsCompleted:
  - step-01-load-context
  - step-02-define-thresholds
  - step-03-gather-evidence
  - step-04-evaluate-and-score
  - step-04e-aggregate-nfr
  - step-05-generate-report
lastStep: step-05-generate-report
lastSaved: '2026-07-02'
workflowType: testarch-nfr-assess
assessmentLevel: epic
epicNum: 4
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-4.md
  - _bmad-output/test-artifacts/traceability/epic-4-traceability-report.md
  - _bmad-output/test-artifacts/nfr-assessment-epic-3.md
  - _bmad-output/implementation-artifacts/4-1-integer-ore-money-and-rounding-primitives.md
  - _bmad-output/implementation-artifacts/4-2-vat-and-quote-total-calculation-primitives.md
  - _bmad-output/implementation-artifacts/4-3-rot-and-gron-teknik-estimate-engine-with-warnings.md
  - _bmad-output/implementation-artifacts/4-4-money-and-tax-golden-master-fixture-pack.md
  - _bmad-output/test-artifacts/automation-summary.md
  - _bmad-output/test-artifacts/automation-summary-4-3.md
  - _bmad-output/test-artifacts/automation-summary-4-4.md
  - src/lib/money/{ore,vat,tax,index}.ts
  - tests/unit/lib/money/** (12 node --test unit + golden files) + tests/fixtures/golden/money/*.json (5)
  - .github/workflows/ci.yml
  - package.json (scripts; no new runtime dependency this epic)
  - knowledge: adr-quality-readiness-checklist.md, ci-burn-in.md, test-quality.md, error-handling.md
---

# NFR Assessment - Epic 4: Money, Tax, Snapshot Primitives, And Golden Fixtures

**Date:** 2026-07-02
**Epic:** 4 (Stories 4.1–4.4) — integer-öre money + rounding (4.1), VAT + quote totals (4.2), ROT/grön-teknik estimate engine with warnings (4.3), money/tax golden-master fixture pack (4.4)
**Overall Status:** PASS (advisory) ✅ — with 2 forward-looking CONCERNS carried from Epics 2–3, plus 8 owner/accounting/legal money-tax sign-off items surfaced (non-gating)

---

Note: This assessment summarizes existing evidence; it does not run tests or CI workflows. (The money suite was, however, executed locally once to confirm the trace claim — 188/188 pass — see Reliability § CI Burn-In.)

## Executive Summary

**Assessment:** 6 PASS, 2 CONCERNS, 0 FAIL across the in-scope categories.

**Blockers:** 0. Every one of the six **Non-Negotiable epic blockers** in the Epic 4 test design is met and test-proven (integer öre off the presentation boundary; VAT rate as basis points with no hidden 25% literal; no ROT/grön output approvable without an explicit human sign-off flag; invalid ROT×grön mix blocked, not summed; no real PII/secret in any golden fixture; frozen assumption snapshots with no silent recompute). All ten high-priority risks (score ≥6) from the test design are mitigated and proven by running tests (epic-4-traceability-report.md, gate: PASS).

**High Priority Issues:** 0. No new HIGH-priority NFR issue introduced. Both remaining CONCERNS are LOW-priority, forward-looking, and identical to the two carried un-actioned across Epics 2–3.

**What changed vs Epic 3 (why the domain mix shifts again):** Epics 2–3 were dominated by **tenant isolation / RLS** on new *tables*. Epic 4 introduces **no new tenant table, no migration, no new dependency, no route/UI, no service-role path** — it is the **first computation engine** in the codebase (`src/lib/money/{ore,vat,tax,index}.ts`, pure functions). So the NFR headline moves from *isolation* to **algorithmic correctness + money/tax compliance posture**: money-integrity (integer öre / basis points, no float kronor), snapshot immutability (frozen-by-value, no silent recompute), and **tax sign-off gating** (unapproved constants can never render/persist as approved). Two domains remain **deliberately deferred N/A for Phase A**: runtime performance/load at scale (no SLA, single pilot tenant, pure in-memory quote-sized inputs — R-414) and availability/DR/MTTR (no deployed production runtime with an SLO yet). Inherited RLS/anon/service-role/audit gates are **untouched** by Epic 4 and remain green as standing regression.

**Recommendation:** **PASS (advisory).** Epic 4 lands the first money/VAT/ROT/grön-teknik calculation engine as **pure, exhaustively unit- and golden-tested logic** with the correct compliance posture: every tax/rounding/VAT constant ships as an **UNAPPROVED conservative profile + warning**, and the engine has **no code path** that marks output approved. The two remaining CONCERNS are the **same two forward items still un-actioned** — (a) no dependency-vulnerability scan gate (`pnpm audit`) in CI, and (b) no line-coverage reporter wired (priority-weighted trace coverage, now 100%, remains the governing metric). Neither weakens any Epic-4 exit criterion. Surface the 8 money-tax sign-off questions to the owner working session; they are **decision items, not coverage gaps** (the engine correctly ships nothing as approved).

---

## Findings Summary (ADR Quality Readiness Checklist — 8 categories)

| # | Category | Epic-4 evidence | Status |
| - | -------- | --------------- | ------ |
| 1 | Testability & Automation | Entire epic is pure `node --test` UNIT + data-driven GOLDEN; 12 test files under `tests/unit/lib/money/**`, 5 golden fixtures; every test-design test ID present in-source and green; runs in ~0.6 s | PASS ✅ |
| 2 | Test Data Strategy | Golden-master fixture pack (5 files) with each expected value labelled `old-lovable`/`new-expected`/`documented-delta`; anonymized shape-only; CI privacy scan over the data payload | PASS ✅ |
| 3 | Scalability & Availability (harness/schema) | No new DB/tenant surface; existing dual-runner + RLS/H4 harness absorbs the epic with zero rework. Product runtime scalability/availability = N/A/deferred (no SLA, single pilot tenant) | PASS ✅ (harness) / N/A (runtime) |
| 4 | Disaster Recovery | N/A this epic — no deployed production runtime / SLO; pure library adds no stateful runtime | N/A (deferred) ⚠️→✅ |
| 5 | Security | No new tenant table/command/RLS surface; **no PII enters `src/lib/money`** (engine takes a resolved eligibility posture, never a personnummer/orgnr); no service-role/DB/`process.env`/`fetch`; no hidden tax/VAT literal; unapproved-tax-as-fact structurally impossible | PASS ✅ |
| 6 | Monitorability / Debuggability / Manageability | Warnings + typed failure codes (`ROT_GRON_MIX_NOT_ALLOWED`, `UNKNOWN_DEDUCTION_TYPE`, `INVALID_VAT_RATE_BP`, `POSTURE_NOT_ELIGIBLE`, `DEDUCTION_CLAMPED_TO_CAP`, `ORE_OVERFLOW`) make every rejection/clamp observable; frozen assumption snapshot records the exact profile used | PASS ✅ |
| 7 | QoS / QoE (correctness = the money/tax "quality of service") | 188/188 money units+golden green; policy-level assertions (exact rounding step/order/mode, per-line VAT round → sum-of-rounded, cap at/above/below) — not just "≈25%"; no float drift | PASS ✅ |
| 8 | Deployability | No migration, no new dependency, no `.env` edit, no route/UI; verify-job CI gate (lockfile, service-role containment, typecheck, lint, unit, build, bundle-containment) unchanged and green; **dependency-scan gate still absent** | CONCERNS ⚠️ (carried — no `pnpm audit` gate) |

**Also standing:** **Vulnerability management** — 0 critical / 0 high is *asserted by exact pins + frozen-lockfile*, but there is still **no automated `pnpm audit` gate** in CI. Epic 4 added **no new runtime dependency**, so the dependency surface did not grow — but the concern is now carried across **three** epics unaddressed. This is the second standing CONCERNS.

---

## Performance Assessment

### Response Time (p95)

- **Status:** N/A (deferred) ⚠️→✅
- **Threshold:** UNKNOWN — no Phase-A SLA/SLO defined for money/tax calculation (test-design R-414: "Money/tax calc performance at scale untested — pure in-memory logic on quote-sized inputs; no SLA defined for Phase A").
- **Actual:** The engine is pure, synchronous, in-memory integer arithmetic over quote-sized inputs (no I/O, no DB, no network, no clock). The whole 188-test suite completes in ~0.57 s locally.
- **Evidence:** `src/lib/money/{ore,vat,tax}.ts` (pure — grep confirms no `fetch`/`supabase`/`Date.now`/`process.env` in compute paths); local suite run `duration_ms 567`.
- **Findings:** Correctly deferred. Functional correctness — not throughput/latency — is the Phase-A concern for a pure calculation primitive. No user-facing SLA exists to measure against yet.

### Throughput / Resource Usage / Scalability (runtime)

- **Status:** N/A (deferred) ⚠️→✅ — no threshold defined; calc-at-scale perf is R-414 (deferred to a later calc epic if an SLA emerges).
- **Findings:** No concern for Phase A. The pure functions have no allocation/connection footprint of note; there is nothing to load-test against a threshold. **Carried-forward action (post-pilot):** if a calc-at-scale SLA is set (e.g. large multi-section quotes), add a micro-benchmark for `vatBreakdown` / `estimateDeduction` / `sumOre` over large line counts.

---

## Security Assessment

### Authentication / Authorization Controls

- **Status:** PASS ✅ (N/A-by-design for Epic 4's own surface; inherited controls intact)
- **Threshold:** No new privileged surface may be introduced; inherited tenant-isolation/anon/service-role gates must remain green.
- **Actual:** Epic 4 adds **no endpoint, command, route, table, or RLS surface** (pure `src/lib/money` functions). The trace report's auth/authz heuristic is N/A for Epic 4's own deliverables; the inherited RLS/anon/service-role/audit gates (Stories 2.x/3.x) remain green as standing regression, untouched.
- **Evidence:** epic-4-traceability-report.md (Coverage Heuristics — auth/authz "N/A … inherited gates remain green"); `.github/workflows/ci.yml` `verify` + `db` jobs unchanged; source grep — no `service-role`/`supabase` reference in `src/lib/money/*`.
- **Findings:** No new attack surface. Correct: money/tax math is pure and should never touch auth or the DB client.

### Data Protection — No PII in the pure engine (R-411, R-412)

- **Status:** PASS ✅
- **Threshold:** No PII (personnummer, orgnr, name, email, address) may enter `src/lib/money`; the engine must take a resolved eligibility *posture*, never a personnummer.
- **Actual:** The tax engine takes a resolved eligibility **posture** (a customer-type-derived boolean/enum) — never a personnummer or any PII. Source grep confirms the only occurrences of `personnummer`/`orgnr`/`email` in `src/lib/money/*` are **doc-comments asserting their absence** (e.g. `ore.ts`: "No personnummer, orgnr, customer field, or clock read ever enters this module"; `tax.ts`: "ONLY A RESOLVED ELIGIBILITY POSTURE — NO PII / NO PERSONNUMMER (R-412)"). `4.3-UNIT-05` asserts no PII path into the module.
- **Evidence:** `tax.test.ts` 4.3-UNIT-05; `src/lib/money/tax.ts` (posture-only input), `index.ts`/`ore.ts` purity headers; epic-4-traceability-report.md R-412 reconciliation.
- **Findings:** Correct. The requirement-evolution note is handled cleanly: the **2026-06-18 owner decision** stores personnummer access-controlled for `private` customers **in the CRM**; the **pure engine reads none of it**. This is a corrected requirement, fully tested — not an uncovered item. GDPR/retention treatment of personnummer remains the disclosed Phase-A-deferred item (owner decision, internal pilot), unchanged.

### Fixture Privacy — No PII/secret in golden fixtures (R-411)

- **Status:** PASS ✅
- **Threshold:** No real names/emails/phones/addresses/personnummer/orgnr/secrets/`.env`/raw customer files in any committed golden fixture; a CI scan over the data payload.
- **Actual:** Pack-wide privacy scan runs over all 5 fixtures (personnummer/orgnr `\d{6}-\d{4}`, non-`example.test` email, `secret|password|api_key`, phone, address); the negative check is non-vacuous (verified). Fixtures are anonymized/shape-only; Lovable is an oracle for expected *values*, never a data source.
- **Evidence:** `golden-pack.test.ts` 4.4-UNIT-01 (pack-wide, non-vacuous); part of `pnpm test:unit` in the CI `verify` job.
- **Findings:** Strong. This is the SEC control that makes the golden pack safe to commit; it runs on every PR.

### Compliance Posture — Unapproved tax cannot render as approved (R-405, design-time near-blocker)

- **Status:** PASS ✅
- **Threshold:** No ROT/grön-teknik output may be rendered or persisted as approved without an explicit human sign-off flag; missing sign-off must be the structural default.
- **Actual:** The engine result AND its assumption snapshot always carry `requiresSignOff: true` as the **structural default**; the engine has **no parameter, branch, or field** that can emit `approved:true`/`isApproved:true` (source grep for `approved:true`/`isApproved:true` in `src/lib/money/*` returns **zero hits**). Constants live as named `*_PROFILE_UNAPPROVED` records with an explicit `approved: false` marker. Mirrors the Epic-3 `quote_terms.approved_at` "approval is structural, never a default string" discipline.
- **Evidence:** `tax.test.ts` 4.3-UNIT-03 (behavioral — serialized output asserts no `approved:true`); `src/lib/money/tax.ts` profile constants; epic-4-traceability-report.md Non-Negotiable blockers (MET).
- **Findings:** Excellent, and the highest-leverage compliance control in the epic. The sign-off gate is behavioral, not cosmetic.

### Input Validation / Vulnerability Management

- **Status (input validation):** PASS ✅ — typed failures for invalid money (float/neg/NaN/±Inf/overflow/locale-comma/decimal string), out-of-range/float `vatRateBp` (`INVALID_VAT_RATE_BP`), ROT×grön mix (`ROT_GRON_MIX_NOT_ALLOWED`), unknown deduction type (`UNKNOWN_DEDUCTION_TYPE`), non-private posture (`POSTURE_NOT_ELIGIBLE`); no raw value echoed in errors.
- **Status (vulnerability management):** CONCERNS ⚠️ (LOW priority; carried un-actioned across Epics 2–4)
- **Threshold:** 0 critical / 0 high dependency vulnerabilities, gated in CI.
- **Actual:** No `pnpm audit` / dependency-scan gate is wired into CI (confirmed: no `audit`/`snyk`/`dependabot` reference in `.github/workflows/ci.yml` or `package.json`). Epic 4 added **no new runtime dependency** (every story explicitly "NO new dependency"; git confirms the last change is a review-fix, no lockfile growth), so the dependency surface did not grow — but the auth + DB client libraries from Epic 2 remain unscanned by an automated gate.
- **Evidence:** `.github/workflows/ci.yml` (no audit step); `package.json` scripts; `ore-edges.test.ts`, `vat.coverage.test.ts`, `tax.test.ts` (typed-failure assertions).
- **Findings:** Input validation is a strength. Vulnerability management is acceptable for an internal pilot (exact pins + `--frozen-lockfile`), but this CONCERN is now **carried across three epics** — a `pnpm audit --audit-level=high` CI step remains the obvious quick win and should land before any external exposure.

---

## Reliability Assessment

### Assumption-Snapshot Immutability (R-409) — the reliability property of this epic

- **Status:** PASS ✅
- **Threshold:** A prior estimate/snapshot must NOT change when a source rate is mutated later; builders must inject `capturedAt` (no clock read).
- **Actual:** VAT and tax assumption snapshots use copy-by-value + `Object.freeze` + injected `capturedAt` (Epic-3 discipline reused, not forked). Units prove mutating the source rate after capture does not reach a prior snapshot; the snapshot captures STATE only (no recompute, no derived `isApproved`). Source grep confirms `Date.now()` appears only in comments asserting it is never called.
- **Evidence:** `vat.test.ts` 4.2-UNIT-03/05, `tax.test.ts` 4.3-UNIT-06 (frozen; mutate-source-after-capture is inert) — all green in the local run.
- **Findings:** This is the load-bearing reliability guarantee for downstream Epics 6–7 (a sent quote version is immutable): a frozen tax assumption cannot silently drift when a rate profile later changes.

### Error Handling / Fault Tolerance

- **Status:** PASS ✅
- **Threshold:** Every invalid/boundary path returns a typed, user-safe failure — never a silent wrong number.
- **Actual:** Closed-union `switch` + `assertNever` exhaustiveness makes an unhandled deduction type a compile error; every computed öre is re-checked with `isOreAmount` so overflow is a typed `ORE_OVERFLOW`, not a silently-unsafe integer; caps clamp with a `DEDUCTION_CLAMPED_TO_CAP` warning; the ROT×grön mix is a blocking typed failure with no combined-sum code path.
- **Evidence:** `tax.test.ts` 4.3-UNIT-02/07, `ore-edges.test.ts`, `tax.edges.test.ts`; error-handling knowledge fragment pattern (typed failures, no raw echo).
- **Findings:** Strong fault-isolation for a calculation engine. Failures are observable (typed codes + warnings), not swallowed.

### Availability / MTTR / Disaster Recovery

- **Status:** N/A (deferred) ⚠️→✅ — no deployed production runtime/SLO; a pure library introduces no stateful runtime to fail over.
- **Findings:** Correctly out of scope for Phase A, consistent with Epics 2–3.

### CI Burn-In (Stability)

- **Status:** PASS ✅
- **Threshold:** Deterministic, non-flaky suite; 100% pass on every run.
- **Actual:** **188/188** money units+golden pass locally (`node --experimental-strip-types --import ./tests/support/register.mjs --test "tests/unit/lib/money/**/*.test.ts"` → tests 188 / pass 188 / fail 0 / skipped 0), matching the trace claim; the wider unit suite is **612/612** per the story/automation records. The suite is pure (no DB/browser/network/clock), so there is no time-based flake surface. No `.skip`/`.only`/`xit` in executable code (the historical `describe.skip` ATDD gates all flipped true once `@/lib/money` landed).
- **Evidence:** local run 2026-07-02 (this assessment); automation-summary-4-4.md (`test:unit` 612 pass / 0 fail / 0 skipped); epic-4-traceability-report.md.
- **Findings:** Deterministic and fast — the fast unit gate genuinely protects money/tax correctness on every PR.

---

## Maintainability Assessment

### Test Coverage (priority-weighted)

- **Status:** PASS ✅ (trace-coverage) / CONCERNS ⚠️ (line-coverage reporter absent)
- **Threshold:** P0 100% / P1 ≥90% / overall ≥80% priority-weighted (test-design gate); money/tax business logic ≥90%; enumerated rounding/VAT-order/cap branches 100% golden-pinned.
- **Actual:** Priority-weighted trace coverage is **100%** (20/20 mapped requirements FULL; P0 15/15, P1 5/5). No line-coverage % is computed (no coverage reporter wired) — the same minor forward gap carried from Epics 2–3; priority-weighted trace coverage remains the governing metric.
- **Evidence:** epic-4-traceability-report.md (Coverage Summary, gate PASS); no `c8`/`nyc`/coverage step in `package.json`/CI.
- **Findings:** Coverage of the critical contract logic is exhaustive at the correct (unit+golden) level. The missing reporter is a low-priority ergonomics gap, not a correctness gap.

### Code Quality / Technical Debt

- **Status:** PASS ✅
- **Threshold:** typecheck 0 errors, lint clean, single-source-of-truth (no forked money/VAT/öre authority).
- **Actual:** typecheck 0 errors; lint clean (1 pre-existing unrelated warning in `vat.test.ts`); consolidation honored — ONE `isOreAmount`/`ORE_AMOUNT_MAX`, ONE `roundToOre` (half-away-from-zero), ONE öre→kronor formatter, ONE `isVatRateBp`; the tax engine reuses (never forks) 4.1/4.2 primitives + the 3.5 freeze discipline; profiles are DATA (`as const` frozen records) so a later sign-off swaps numbers with no code-shape change.
- **Evidence:** automation-summary-4-4.md (verify-job locally green, in order); 4.1–4.3 story records (consolidation tasks); `src/lib/money/index.ts` (single re-export root).
- **Findings:** Low technical debt; the single-authority discipline that dominated the story reviews prevents the classic "second rounding mode" / "hidden VAT literal" drift.

### Documentation Completeness

- **Status:** PASS ✅
- **Actual:** Each story's Dev Agent Record documents scope guardrails (no migration/dep/UI), consolidation, and reviewer-resolved findings; the test-design and traceability reports enumerate the sanctioned scope decisions and 8 sign-off questions (not gaps); source headers document purity + the UNAPPROVED-profile posture verbatim.
- **Evidence:** 4.1–4.4 implementation-artifacts; test-design-epic-4.md; epic-4-traceability-report.md.
- **Findings:** Complete and reconciled; deferred/owner-gated items are logged with owners, not lost.

### Test Quality (from trace/automation review)

- **Status:** PASS ✅
- **Actual:** Tests are mechanism-asserting (policy-level: exact rounding step/order/mode via golden; per-line VAT round → sum-of-rounded; cap at/above/below; sum-of-rounded ≠ round-of-sum), with non-vacuous negative oracles (mutating a documented-delta `newExpectedOre` 69→70 fails the golden; unselected-option VAT not summed). Golden expected values are labelled `old-lovable`/`new-expected`/`documented-delta` so a failure points at the affected assumption, not an unexplained diff.
- **Evidence:** `rounding.golden.test.ts`, `vat.golden.test.ts`, `tax.golden.test.ts`, `golden-pack.test.ts`, `golden-pack-coverage.test.ts`; automation-summary-4-4.md (non-vacuous verification).
- **Findings:** High test quality — the golden pack is an explainable oracle, not an unlabelled snapshot trap. This is the recurring money/tax oracle Epics 5–7 will extend.

---

## Custom NFR Assessments (Epic-4-specific)

### Money Integrity (integer öre / basis points; no float kronor)

- **Status:** PASS ✅
- **Threshold:** No money value is a float kronor off the presentation boundary; VAT/tax rates consumed as basis points (`/10000`), no percent literal in compute paths.
- **Actual:** Internal money is integer öre end-to-end; kronor formatting only at the single boundary formatter (`formatOreAsKronor`). Source grep confirms **no** `*1.25`/`*0.25`/`/0.25`/`*30`/`*50` literal in VAT/tax compute paths (the only match is a doc-comment warning against `*1.25`); the bp `/10000` pattern is used throughout (`vat.ts` 11 occurrences, `tax.ts` 8).
- **Evidence:** `ore.test.ts` 4.1-UNIT-01/05, `roundtrip.test.ts`, `vat.golden.test.ts` 4.2-GOLDEN-01 (0/6/12/25% + source-grep), `src/lib/money/{vat,tax}.ts`.
- **Findings:** The foundational integrity guarantee for every downstream quote/PDF/acceptance is proven and grep-verified.

### Tax Sign-Off Gating (behavioral)

- **Status:** PASS ✅ — covered under Security § Compliance Posture (R-405). No `approved:true`/`isApproved:true` path exists in the engine.

---

## Quick Wins

2 quick wins identified for immediate implementation:

1. **Add a `pnpm audit --audit-level=high` CI step** (Deployability / Vulnerability mgmt) — MEDIUM — ~0.5–1 h
   - Wire a dependency-scan step into the `verify` job in `.github/workflows/ci.yml` (config only, no code change). Closes the CONCERNS carried across three epics before any external exposure.
2. **Wire a coverage reporter (`c8`) over `test:unit`** (Maintainability) — LOW — ~1–2 h
   - Emit line-coverage for the pure `src/lib/money` surface so the ≥90% money-logic target has a machine number alongside the (already-100%) priority-weighted trace coverage. Report-only; do not gate on it initially.

---

## Recommended Actions

### Immediate (Before Release) — CRITICAL/HIGH Priority

None. No CRITICAL/HIGH NFR issue; no release blocker for the Epic-4 pure-library deliverable.

### Short-term (Next Milestone) — MEDIUM Priority

1. **Dependency-scan CI gate** — MEDIUM — ~0.5–1 h — Ops/Dev
   - Add `pnpm audit --audit-level=high` to the `verify` job. **This is the standing CONCERNS now carried across Epics 2–4** — schedule it, or have the owner formally accept the residual for the internal pilot (do not keep silently carrying it).
2. **Route the 8 money-tax sign-off questions to the owner/accounting/legal working session** — MEDIUM — Owner
   - Rounding policy (line vs document; half-away-from-zero vs banker's); VAT display (excl/incl/both; private→always-incl); ROT cap/rate/labour-basis/multi-owner; grön-teknik category rates/caps/schablon + whether it may ever combine with ROT; BRF/private/company eligibility + disclaimer wording; personnummer reconciliation; overall approval posture; accepted-price-delta representation (feeds Epic 7). The engine ships all of these as UNAPPROVED + warnings — this is a **decision**, not a code fix.

### Long-term (Backlog) — LOW Priority

1. **Coverage reporter** — LOW — ~1–2 h — Dev (report-only).
2. **Calc-at-scale micro-benchmark (R-414)** — LOW — Dev — only if a Phase-A/post-pilot SLA emerges for large multi-section quotes.
3. **Per-person ROT cap multiplier (`persons`)** — LOW/owner-gated — Dev + Owner — the deduction currently uses a single flat `capOre`; `persons` is validated + snapshotted but does not yet scale the cap. Deferred behind Sign-Off Q3 (logged to `deferred-work.md`), a sanctioned placeholder — not a defect.

---

## Monitoring Hooks

Runtime monitoring is **N/A for a pure library** in Phase A (no deployed runtime/SLO). The applicable "monitoring" is the CI fast gate + the golden oracle:

- [x] **Money/tax golden pack** — the recurring regression oracle; a labelled failure points at the affected assumption. **Owner:** Dev. **Runs:** every PR (`test:unit`).
- [x] **Fixture privacy scan** — CI unit gate detects any PII/secret introduced into a fixture. **Owner:** Dev.
- [ ] **`pnpm audit` gate** — detect a newly-disclosed dependency CVE before merge. **Owner:** Ops/Dev. **Deadline:** before external exposure. *(the standing gap)*

---

## Fail-Fast Mechanisms

- [x] **Validation gates (Security):** typed failures reject invalid money/VAT-bp/deduction inputs at the boundary — no silent wrong number. Present.
- [x] **Smoke tests (Maintainability):** the pure `test:unit` suite (188 money + 612 total) is the fast fail-fast gate on every PR. Present.
- [x] **Structural sign-off gate (Compliance):** `requiresSignOff:true` default + no `approved:true` path — a fail-fast against shipping unapproved tax as final. Present.
- [ ] **Rate limiting / circuit breakers:** N/A — no runtime service surface in Epic 4.

---

## Evidence Gaps

2 evidence gaps identified — both LOW priority, both deliberately deferred (not action-required for the Epic-4 gate):

- [ ] **Dependency-vulnerability scan** (Deployability / Security) — **Owner:** Ops/Dev — **Deadline:** before external exposure — **Suggested Evidence:** `pnpm audit --audit-level=high` CI step output — **Impact:** LOW for internal pilot (exact pins + frozen lockfile; no new dep this epic), but carried three epics.
- [ ] **Line-coverage report** (Maintainability) — **Owner:** Dev — **Deadline:** backlog — **Suggested Evidence:** `c8` lcov over `test:unit` — **Impact:** LOW — priority-weighted trace coverage is 100%; this is an ergonomics number, not a correctness gap.

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
| 7. QoS & QoE (money/tax correctness) | PASS ✅ |
| 8. Deployability | CONCERNS ⚠️ (no `pnpm audit` gate) |
| **Vulnerability Management (cross-cutting)** | **CONCERNS ⚠️ (carried Epics 2–4)** |
| **Overall** | **PASS (advisory) ✅ — 6 PASS, 2 CONCERNS, 0 FAIL** |

**Scoring:** In-scope categories: 6 PASS, 2 CONCERNS (Deployability/vuln-scan + line-coverage reporter), 0 FAIL. Runtime performance/load (R-414) and availability/DR are N/A — deferred for the internal pilot (no SLA/production runtime yet). No new HIGH-priority NFR issue.

---

## Gate YAML Snippet

```yaml
nfr_assessment:
  date: '2026-07-02'
  epic: 4
  feature_name: 'Money, Tax, Snapshot Primitives, And Golden Fixtures'
  assessment_level: epic
  trace_coverage: '20/20 FULL (100%; P0 15/15, P1 5/5)'
  categories:
    testability_automation: PASS
    test_data_strategy: PASS
    scalability_availability: PASS # harness; runtime N/A (deferred)
    disaster_recovery: N/A # deferred (no production runtime/SLO)
    security: PASS
    monitorability: PASS
    qos_qoe: PASS # money/tax correctness
    deployability: CONCERNS # no pnpm audit gate
    vulnerability_management: CONCERNS # carried Epics 2-4
  overall_status: PASS_ADVISORY
  critical_issues: 0
  high_priority_issues: 0
  medium_priority_issues: 2 # pnpm audit gate; route sign-off questions
  concerns: 2 # no dependency-scan gate; no coverage reporter
  blockers: false
  quick_wins: 2
  evidence_gaps: 2 # dependency scan; line-coverage report
  deferred_na: # not gaps — deferred by Phase-A design
    - runtime_performance_load_at_scale # R-414 (no SLA, pure in-memory, single pilot tenant)
    - availability_dr_mttr # no deployed production runtime/SLO
  owner_signoff_items_surfaced: 8 # money-tax rounding/VAT/ROT/grön/eligibility/personnummer/approval/accepted-delta
  recommendations:
    - 'Add pnpm audit --audit-level=high CI gate (standing CONCERNS, carried Epics 2-4) — schedule or formally accept'
    - 'Route the 8 money-tax sign-off questions to the owner working session (decision, not a code fix)'
    - 'Wire a coverage reporter (c8) over test:unit — report-only'
```

---

## Related Artifacts

- **Test Design:** `_bmad-output/test-artifacts/test-design-epic-4.md`
- **Traceability + Gate (PASS):** `_bmad-output/test-artifacts/traceability/epic-4-traceability-report.md`
- **Prior NFR (format + standing concerns):** `_bmad-output/test-artifacts/nfr-assessment-epic-3.md`
- **Story records:** `_bmad-output/implementation-artifacts/4-{1,2,3,4}-*.md`
- **Automation summaries:** `_bmad-output/test-artifacts/automation-summary.md`, `automation-summary-4-3.md`, `automation-summary-4-4.md`
- **Source under assessment:** `src/lib/money/{ore,vat,tax,index}.ts`
- **Evidence Sources:**
  - Unit + golden tests: `tests/unit/lib/money/**` (12 files) + `tests/fixtures/golden/money/*.json` (5 files)
  - CI: `.github/workflows/ci.yml` (`verify` job runs `test:unit`; no `audit` step)
  - Local run: `node --experimental-strip-types --import ./tests/support/register.mjs --test "tests/unit/lib/money/**/*.test.ts"` → 188/188 pass

---

## Recommendations Summary

**Release Blocker:** None. 0 FAIL, 0 blocker; all six Non-Negotiable epic blockers met and test-proven.

**High Priority:** None.

**Medium Priority:** (1) Land the `pnpm audit` CI gate or have the owner formally accept the residual — do not keep silently carrying it. (2) Route the 8 money-tax sign-off questions to the owner working session.

**Next Steps:** Epic 4's gate (trace) is already **PASS**. This NFR assessment concurs: **PASS (advisory)**. Proceed to epic close / `*retrospective`. Carry the two standing CONCERNS (dependency-scan gate, coverage reporter) forward with named owners; they do not weaken any Epic-4 exit criterion.

---

## Sign-Off

**NFR Assessment:**

- Overall Status: PASS (advisory) ✅
- Critical Issues: 0
- High Priority Issues: 0
- Concerns: 2 (no `pnpm audit` gate; no coverage reporter — both LOW-priority, carried forward)
- Evidence Gaps: 2 (dependency scan; line-coverage report — both deferred)
- Deferred N/A (by Phase-A design): runtime performance/load at scale (R-414); availability/DR/MTTR

**Gate Status:** PASS (advisory) ✅ — concurs with the epic-4 traceability gate (PASS)

**Next Actions:**

- PASS ✅: Proceed to epic close / retrospective / release-gate.
- Carry the 2 standing CONCERNS forward with owners (dependency-scan gate; coverage reporter).
- Route the 8 money-tax sign-off items to the owner/accounting/legal working session (decision items, engine already ships them UNAPPROVED + warnings).

**Generated:** 2026-07-02
**Workflow:** testarch-nfr (epic-level evidence audit)

---

<!-- Powered by BMAD-CORE™ -->
