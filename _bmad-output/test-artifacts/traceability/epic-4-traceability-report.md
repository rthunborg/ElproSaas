---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-map-criteria
  - step-04-analyze-gaps
  - step-05-gate-decision
lastStep: step-05-gate-decision
lastSaved: '2026-07-02'
workflowType: testarch-trace
gateType: epic
epicNum: 4
decisionMode: deterministic
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-4.md
  - _bmad-output/planning-artifacts/epics.md (Epic 4, lines 871-1024)
  - _bmad-output/implementation-artifacts/4-1-integer-ore-money-and-rounding-primitives.md
  - _bmad-output/implementation-artifacts/4-2-vat-and-quote-total-calculation-primitives.md
  - _bmad-output/implementation-artifacts/4-3-rot-and-gron-teknik-estimate-engine-with-warnings.md
  - _bmad-output/implementation-artifacts/4-4-money-and-tax-golden-master-fixture-pack.md
  - src/lib/money/{ore,vat,tax,index}.ts (the pure engine under test)
  - tests/unit/lib/money/** (node --test units + golden) + tests/fixtures/golden/money/*.json
---

# Traceability Report — Epic 4: Money, Tax, Snapshot Primitives, And Golden Fixtures

**Date:** 2026-07-02
**Author:** Rasmus (via BMad TEA — Master Test Architect)
**Gate Type:** Epic-level (Phase 4, epic boundary)
**Decision Mode:** Deterministic (rule-based: P0 100% / P1 ≥90% PASS · 80–89% CONCERNS / overall ≥80%)

---

## Gate Decision: PASS

**Rationale:** P0 coverage is 100% (15/15 epic acceptance-criterion groups) and P1 coverage is 100%
(5/5), so overall coverage is 100% (20/20 mapped requirements FULL). All ten high-priority risks
(score ≥6: R-401, R-402, R-403, R-404, R-405, R-406, R-407, R-409, R-410, R-411) are mitigated and
proven by running tests, and every one of the six **Non-Negotiable epic blockers** in the Epic 4 test
design is met and test-proven: integer öre off the presentation boundary (no float kronor), VAT rate
consumed as basis points (no hidden 25% literal), no ROT/grön-teknik output approvable without an
explicit human sign-off flag, the invalid ROT×grön mix blocked (not silently summed), no real
PII/secret in any golden fixture (CI scan green), and frozen assumption snapshots (no silent
recompute). The full money suite runs green — **188/188 `node --test` money units + golden pass, 0
fail, 0 skipped** (verified locally via the project runner `tests/support/register.mjs`; the wider
unit suite is 612/612 per the story records). Verified against the actual test source and a live run,
not merely the story records. No P0/P1 gap and no open high-priority (≥6) risk is unmitigated. The two
standing NFR CONCERNS (no `pnpm audit` CI gate, no coverage reporter) and the 8 owner/accounting/legal
money-tax sign-off questions are **surfaced-for-decision items, not coverage gaps** — the engine ships
the tax/rounding/VAT constants as UNAPPROVED conservative assumptions + warnings, which is exactly what
the test design requires (they must NOT be treated as production-approved).

---

## Coverage Summary

- **Total requirements mapped:** 20 (4 stories × ~4 epic-relevant AC groups + heuristic checks)
- **Fully covered (FULL):** 20 (100%)
- **Partial / Unit-only / None:** 0
- **P0 coverage:** 100% (15/15 P0 items — every DATA/BUS-critical correctness + compliance criterion)
- **P1 coverage:** 100% (5/5 P1 items)
- **High-priority risks (score ≥6):** 10/10 mitigated + test-proven (R-401..R-407, R-409, R-410, R-411)

**Test inventory discovered** (all active — no `.skip`/`.only`/`xit` in executable code; the historical
`describe.skip` ATDD gates all flipped true once the `@/lib/money` surface landed):

- `node --test` money units + golden: **11 files** under `tests/unit/lib/money/**` —
  `ore.test.ts`, `ore-edges.test.ts`, `roundtrip.test.ts`, `rounding.golden.test.ts`, `vat.test.ts`,
  `vat.coverage.test.ts`, `vat.golden.test.ts`, `tax.test.ts`, `tax.edges.test.ts`,
  `tax.golden.test.ts`, `golden-pack.test.ts`, `golden-pack-coverage.test.ts`
- Golden fixtures: **5 files** under `tests/fixtures/golden/money/` — `rounding-mode.json`,
  `vat-rates.json`, `rot-gron-deductions.json`, `options-tillval.json`, `accepted-price-deltas.json`
- **No INT / RLS / E2E in Epic 4's own coverage** — the surface is pure logic; DB/UI consumers are
  Epics 5–6 (their trace owns that coverage). This is the deliberate emphasis shift from Epics 2–3:
  the inherited Vitest/RLS/Playwright suites remain green as standing regression, untouched by Epic 4.

**Local run confirmation:** `node --experimental-strip-types --import ./tests/support/register.mjs
--test "tests/unit/lib/money/**/*.test.ts"` → **tests 188 / pass 188 / fail 0 / skipped 0**. (A raw
`node --test` without the register hook fails on the `@/lib/money` alias — an environment/harness
detail, not a test-logic failure; every suite passes through the project runner that CI uses.)

---

## Traceability Matrix

Coverage status legend: **FULL** = criterion covered at the appropriate level(s) with
mechanism-asserting tests; test IDs cite the covering file. All test IDs below were verified present
in-source and green in the local run.

### Story 4.1 — Integer Öre Money And Rounding Primitives

| AC / Requirement | Risk | Priority | Coverage | Covering tests (verified) |
| --- | --- | --- | --- | --- |
| AC1 Internal money is integer öre end-to-end; kronor formatting ONLY at the single presentation boundary (no float kronor off boundary) | R-401 | P0 | FULL | `ore.test.ts` 4.1-UNIT-01 (öre-in/öre-out through `lineNetOre`/`sumOre`), 4.1-UNIT-05 (`formatOreAsKronor` preserves exact öre); `roundtrip.test.ts` 4.1-UNIT-07 |
| AC2 Line net = round(qty × unitPriceÖre) to nearest öre, line-level, half-away-from-zero pinned; totals sum-of-rounded; mode golden-pinned | R-402, R-403 | P0 | FULL | `ore.test.ts` 4.1-UNIT-02 (fractional qty, large values, sum-of-rounded ≠ round-of-sum); `rounding.golden.test.ts` 4.1-GOLDEN-01 (`.5`-boundary half-up vs banker's — accidental mode flip fails loud) |
| AC3 Invalid money/quantity rejected (float/neg/NaN/±Inf/overflow/locale-comma/decimal string); user-safe typed failure, no raw echo | R-401, R-413 | P0 | FULL | `ore.test.ts` 4.1-UNIT-03; `ore-edges.test.ts` 4.1-UNIT-03; 4.1-UNIT-04 (negative rejected, zero line net valid), 4.1-UNIT-06 (`ORE_AMOUNT_MAX` overflow guard) |
| AC4 Pure `src/lib/money` foundation only — no DB/migration/dep/UI; ONE `isOreAmount` + ONE öre→kronor formatter authority | — | P0 | FULL | Scope-guard (dev-record git-verified; no migration/dep); consolidation-affected suites green together (pricing-validation, money-display, snapshots golden) |

### Story 4.2 — VAT And Quote-Total Calculation Primitives

| AC / Requirement | Risk | Priority | Coverage | Covering tests (verified) |
| --- | --- | --- | --- | --- |
| AC1 VAT per line = `roundToOre(net × bp / 10000)` (no `*1.25`/`0.25`/`25` literal); totals sum rounded per-line VAT (sum-of-rounded); rate flows in as basis points | R-403, R-404 | P0 | FULL | `vat.test.ts` 4.2-UNIT-01 (per-line round + sum-of-rounded ≠ round-of-sum); `vat.golden.test.ts` 4.2-GOLDEN-01 (0/6/12/25% + zero rows + fractional qty; no hidden literal — source-grep); `vat.coverage.test.ts` |
| AC2 excl/incl/both display modes are pure derived views; source net/VAT öre immutable; round-trip returns identical öre; private→always-incl invariant | R-403 | P0 | FULL | `vat.test.ts` 4.2-UNIT-02 (presentation only; source immutable), 4.2-UNIT-04 (display-mode round-trip, never mutates); `vat.coverage.test.ts` |
| AC3 Exact VAT rate + source assumption snapshotted (copy-by-value + `Object.freeze` + injected `capturedAt`) before customer-visible; no recompute | R-409, R-404 | P0 | FULL | `vat.test.ts` 4.2-UNIT-03 / 4.2-UNIT-05 (frozen; mutating source rate after capture does NOT change a prior snapshot; captures STATE, no `isApproved`); `tax.test.ts` 4.2-UNIT-05/4.3-UNIT-06 |
| AC4 Pure additive `@/lib/money` VAT surface; ONE bp-validity rule (`isVatRateBp`); reuses 4.1 primitives + 3.5 freeze; no DB/dep/UI; existing suites green | — | P1 | FULL | `vat.coverage.test.ts` (re-export parity, invalid-`vatRateBp`→`INVALID_VAT_RATE_BP`); settings-validation suite green with consolidated `isVatRateBp` (dev record); scope-guard git-verified |

### Story 4.3 — ROT And Grön Teknik Estimate Engine With Warnings

| AC / Requirement | Risk | Priority | Coverage | Covering tests (verified) |
| --- | --- | --- | --- | --- |
| AC1 Engine returns deduction öre + eligible basis + warnings + assumption snapshot; integer öre via single `roundToOre`/`sumOre`; ROT×grön mix BLOCKED (`ROT_GRON_MIX_NOT_ALLOWED`), never summed | R-405, R-406, R-407 | P0 | FULL | `tax.test.ts` 4.3-UNIT-01 (shape+values), **4.3-UNIT-02** (mix returns blocking typed failure; no combined `deductionOre` — verified in-source, not a silent sum); `tax.golden.test.ts` 4.3-GOLDEN-01 |
| AC2 Missing sign-off ⇒ `requiresSignOff:true` is the STRUCTURAL default; engine has NO path that renders/persists `approved:true`/`isApproved:true`; profiles are named UNAPPROVED data | R-405 | P0 | FULL | `tax.test.ts` **4.3-UNIT-03** (behavioral: every ok estimate carries `requiresSignOff:true`; serialized output asserts NO `approved:true`/`isApproved:true`; snapshot also carries the unapproved marker — verified in-source) |
| AC3 BRF/private/company eligibility warnings match conservative Phase-A policy (only `private` eligible); NO personnummer/PII enters `src/lib/money` (engine takes a resolved posture) | R-405, R-412 | P0 | FULL | `tax.golden.test.ts` 4.3-GOLDEN-02 (per-customer-class warnings); `tax.test.ts` 4.3-UNIT-05 (engine takes a POSTURE, never PII; non-private → `POSTURE_NOT_ELIGIBLE` warning); 4.3-UNIT-04 (hidden-row/tillval basis inclusion, R-408) |
| AC4 Pure additive `@/lib/money` tax surface; reuses 4.1/4.2 primitives + 3.5 freeze; caps clamp; unknown-type typed error; frozen tax-assumption snapshot; no DB/dep/UI | R-407, R-409 | P1 | FULL | `tax.test.ts` 4.3-UNIT-07 (`UNKNOWN_DEDUCTION_TYPE`), 4.3-UNIT-06 (frozen snapshot, no recompute); `tax.golden.test.ts` 4.3-GOLDEN-01 (at/above/below cap, per category); `tax.edges.test.ts` |

### Story 4.4 — Money And Tax Golden-Master Fixture Pack

| AC / Requirement | Risk | Priority | Coverage | Covering tests (verified) |
| --- | --- | --- | --- | --- |
| AC1 Pack covers every category (VAT 0/6/12/25, ROT, grön teknik, caps, invalid mix, options/tillval, hidden rows, fractional qty, rounding, accepted-price deltas); each value labelled `old-lovable`/`new-expected`/`documented-delta` | R-410, R-408 | P0 | FULL | `golden-pack.test.ts` 4.4-GOLDEN-01 (category manifest/checklist — every category represented), 4.4-GOLDEN-02 (labelling); `golden-pack-coverage.test.ts` (live-oracle: options/tillval inclusion, hidden-row basis, delta reproduction) |
| AC2 Committed fixtures carry NO real names/emails/phones/addresses/personnummer/orgnr/secrets/`.env`/raw files; CI privacy scan over the DATA payload (extended with orgnr + phone + address) | R-411 | P0 | FULL | `golden-pack.test.ts` 4.4-UNIT-01 (pack-wide privacy scan over all 5 fixtures; personnummer/orgnr `\d{6}-\d{4}`, non-`example.test` email, `secret\|password\|api_key`, phone, address; non-vacuous negative-check confirmed) |
| AC3 Golden failure points to the affected assumption/delta; fixtures structured + reviewable; schema-shape guard fails a malformed fixture (missing `origin`/expected/note) | R-410 | P1 | FULL | `golden-pack.test.ts` 4.4-UNIT-02 (contract-shape guard); `golden-pack-coverage.test.ts` 4.4-UNIT-02 (old/new/delta internal-consistency invariant; malformed fixture fails loud — negative-check verified) |
| AC4 Pure test/fixture story — CONSUMES frozen 4.1/4.2/4.3 primitives (no engine change/fork), no DB/dep/UI; accepted-price delta is a fixture SHAPE only (feeds Epic 7) | — | P1 | FULL | Scope-guard git-verified (no engine/migration/dep change); `golden-pack-coverage.test.ts` drives the real `@/lib/money` engine as oracle; accepted-price delta = plain integer arithmetic on fixture öre (no new surface) |

### Coverage Heuristics (Step 2/4 blind-spot checks)

| Heuristic | Result |
| --- | --- |
| API endpoint coverage | N/A — Epic 4 adds NO endpoint/command/route (pure `src/lib/money` functions); no endpoint-without-test gap possible |
| Auth/authz negative paths | N/A for Epic 4's own deliverables — no new tenant table/command/RLS surface; inherited RLS/anon/service-role gates remain green as standing regression (H4 inventory gate not exercised by Epic 4) |
| Error-path (validation / rejection) coverage | COVERED — typed failures asserted for invalid money (`ore-edges`), out-of-range/float `vatRateBp` (`INVALID_VAT_RATE_BP`), ROT×grön mix (`ROT_GRON_MIX_NOT_ALLOWED`), unknown deduction type (`UNKNOWN_DEDUCTION_TYPE`), non-private posture (`POSTURE_NOT_ELIGIBLE`); no raw value echoed |
| Happy-path-only criteria | NONE detected — every correctness criterion carries boundary/negative cases (cap at/above/below, sum-of-rounded ≠ round-of-sum, `.5`-boundary mode pin, zero-rate/zero-basis, overflow, unselected-option-not-summed negative oracle) |
| Determinism / clock | COVERED — assumption-snapshot builders take injected `capturedAt` (no `Date.now()`); goldens are stable |

---

## Gaps & Uncovered Requirements

**None.** No P0, P1, or P2 acceptance criterion is uncovered, partial, or unit-only where a higher
level is warranted. Epic 4 is pure logic, so UNIT + GOLDEN is the correct and sufficient level per the
test design (`test-levels-framework`: pure calculation with high branch complexity ⇒ unit, not
integration/E2E). Every test-design test ID (`4.1-UNIT-01..07`, `4.1-GOLDEN-01`, `4.2-UNIT-01..06`,
`4.2-GOLDEN-01`, `4.3-UNIT-01..07`, `4.3-GOLDEN-01/02`, `4.4-GOLDEN-01/02`, `4.4-UNIT-01/02`) is
present in-source and green; every high-priority risk (R-401..R-407, R-409, R-410, R-411) has an
executable mitigation test.

### Documented, sanctioned scope decisions (NOT coverage gaps)

These were triaged in-story as accepted/deferred and do not change the gate:

- **4.3 `persons`-not-applied-to-per-person-ROT-cap (`[Review][Defer][Med]`):** the deduction uses a
  single flat `capOre`; `persons` is validated + snapshotted but does not yet scale the cap. The exact
  multi-owner/per-person arithmetic is **owner-gated under Sign-Off Q3** and Task 1.2 explicitly
  sanctions a conservative UNAPPROVED placeholder + warning. Logged to `deferred-work.md` for the Q3
  working session — a deferred-arithmetic item behind a surfaced sign-off, not an untested criterion.
- **4.3 `buildTaxAssumptionSnapshot` does not `isVatRateBp`-guard `deductionPercentBp`
  (`[Review][Decision][Low]`, dismissed):** the engine path (`estimateDeduction`) validates the rate
  before any computation, so no computed deduction can carry a bad rate; Task 3.2 scopes the standalone
  builder to pure by-value state capture (no validation). Won't-fix by design.
- **4.4 DOCS residuals (4.4-DOCS-01/02):** old-Lovable number-kronor deltas (round-at-end vs
  sum-of-rounded +1 öre; Lovable's hardcoded-25% gross) are captured as `documented-delta`/`old-lovable`
  fixture labels and awareness notes, not gating tests — appropriate for a migration-delta / awareness
  residual.

### Requirement-evolution note (not a gap)

- **R-412 (personnummer):** the Epic 4 test design carries "personnummer not captured by default" while
  the **2026-06-18 owner decision** stores personnummer access-controlled for `private` customers in the
  CRM (needed for ROT eligibility). Reconciled correctly in code: the **pure engine reads NO PII** — it
  takes a resolved eligibility *posture* — and `4.3-UNIT-05` asserts no personnummer/orgnr/name path
  enters `src/lib/money`. The CRM stores it; the engine does not read it. A corrected requirement, fully
  tested — not an uncovered item. (Sign-Off Q6 surfaced.)

---

## High-Priority Risk → Mitigation Verification (score ≥6)

| Risk | Mitigation proven by |
| --- | --- |
| R-401 float-öre / mixed units | `ore.test.ts` 4.1-UNIT-01/05 (öre-in/öre-out; kronor string only at the boundary formatter) + `roundtrip.test.ts` |
| R-402 rounding policy wrong/ambiguous | `rounding.golden.test.ts` 4.1-GOLDEN-01 (line-level, half-away-from-zero pinned at the `.5` boundary; banker's-flip fails loud) + `ore.test.ts` 4.1-UNIT-02 (totals preserve exact öre) |
| R-403 VAT rounding order | `vat.test.ts` 4.2-UNIT-01 (per-line round → sum rounded lines; sum-of-rounded ≠ round-of-sum case) |
| R-404 hidden 25% VAT constant | `vat.golden.test.ts` 4.2-GOLDEN-01 (0/6/12/25% from basis points; source-grep asserts no `0.25`/`25`/`1.25` literal in the VAT path) |
| R-405 unapproved tax as approved fact | `tax.test.ts` 4.3-UNIT-03 (behavioral — engine never emits `approved:true`; `requiresSignOff:true` is the structural default in result AND snapshot) |
| R-406 ROT×grön mix | `tax.test.ts` 4.3-UNIT-02 (blocking `ROT_GRON_MIX_NOT_ALLOWED`; no combined `deductionOre`; no sum path) |
| R-407 caps / eligible-basis math | `tax.golden.test.ts` 4.3-GOLDEN-01 (at/above/below cap, per category; above-cap clamped + `DEDUCTION_CLAMPED_TO_CAP` warning; zero basis → 0) |
| R-409 assumption-snapshot recompute | `vat.test.ts` 4.2-UNIT-03/05 + `tax.test.ts` 4.3-UNIT-06 (copy-by-value + `Object.freeze` + injected `capturedAt`; mutating source after capture does not reach a prior snapshot) |
| R-410 golden oracle ambiguous | `golden-pack.test.ts` 4.4-GOLDEN-02 + 4.4-UNIT-02 (each value labelled `old-lovable`/`new-expected`/`documented-delta`; `documented-delta` carries the divergent old value; malformed fixture fails loud) |
| R-411 fixture PII/secret leak | `golden-pack.test.ts` 4.4-UNIT-01 (pack-wide privacy scan over all 5 fixtures; personnummer/orgnr/email/secret/phone/address; non-vacuous negative-check) |

**Medium/Low risks:** R-408 (hidden-row/tillval inclusion) covered by `tax.test.ts` 4.3-UNIT-04 +
`golden-pack-coverage.test.ts`; R-412 (personnummer/PII in engine) covered by 4.3-UNIT-05; R-413
(negative/zero semantics) by 4.1-UNIT-03/04. **R-414** (calc-at-scale perf untested + the two standing
NFR CONCERNS) is a documented residual the test design explicitly defers — surfaced below for
schedule-or-accept, not a gate blocker.

---

## Non-Negotiable Epic Blockers (test-design gate) — all MET

| Blocker | Status | Proven by |
| --- | --- | --- |
| No money value is a **float kronor** off the presentation boundary | MET | 4.1-UNIT-01/05, `roundtrip` |
| No **hidden VAT literal** — rate consumed as basis points | MET | 4.2-GOLDEN-01 (0/6/12/25% + source-grep) |
| No **ROT/grön output approvable** without the explicit human sign-off flag | MET | 4.3-UNIT-03 (behavioral) |
| **Invalid ROT×grön mix blocked**, not silently summed | MET | 4.3-UNIT-02 |
| **No real PII/secret** in any golden fixture (CI scan green) | MET | 4.4-UNIT-01 (pack-wide, non-vacuous) |
| Assumption snapshots **frozen** (no silent recompute) | MET | 4.2-UNIT-03/05, 4.3-UNIT-06 |

---

## Gate Criteria Evaluation (deterministic)

| Criterion | Required | Actual | Status |
| --- | --- | --- | --- |
| P0 coverage | 100% | 100% (15/15) | MET |
| P1 coverage | ≥90% (PASS), 80–89% (CONCERNS) | 100% (5/5) | MET |
| Overall coverage | ≥80% | 100% (20/20) | MET |
| High-risk (≥6) mitigations | 100% complete/waived | 10/10 complete | MET |
| Integer öre off presentation boundary | yes | proven (4.1-UNIT-01/05) | MET |
| VAT rate as basis points (no hidden 25%) | yes | proven (4.2-GOLDEN-01) | MET |
| No tax output approvable without sign-off flag | yes | proven (4.3-UNIT-03) | MET |
| Invalid ROT×grön mix blocked | yes | proven (4.3-UNIT-02) | MET |
| No real PII/secret in golden fixtures | yes | proven (4.4-UNIT-01) | MET |
| Assumption snapshots frozen / no recompute | yes | proven (4.2/4.3 freeze units) | MET |
| Money-suite tests green | 100% pass | 188/188 pass (0 fail, 0 skipped) | MET |

→ **Decision Rule matched:** P0 = 100% AND overall ≥ 80% AND P1 ≥ 90% ⇒ **PASS**.

---

## Next Actions

- **PASS — epic may proceed.** No remediation required for the gate. All four stories (4.1–4.4) are in
  `review` with tasks complete, code reviews resolved, and the full money suite green.
- **Sprint-status hygiene (non-gating, orchestrator note):** `sprint-status.yaml` lists
  `4-1-integer-ore-money-and-rounding-primitives: ready-for-dev`, but the 4.1 story file is
  `Status: review` with a green dev record (463→ units) and its primitives are consumed by 4.2/4.3/4.4.
  The `ready-for-dev` entry is stale; align it to `review` (then `done` at epic close). Does not affect
  coverage.
- **Owner/accounting/legal sign-off items (non-blocking — route to the working session; the engine
  ships these as UNAPPROVED assumptions + warnings, nothing is approved in code):**
  1. **Q1 Rounding:** line-level vs document-level; half-up vs half-to-even (pilot = line-level +
     half-away-from-zero, golden-pinned).
  2. **Q2 VAT display:** excl/incl/both; private→always-incl presentation rule.
  3. **Q3 ROT:** per-person cap / rate / labour-only basis / multi-owner (placeholder 30.00% / 50 000 kr
     per person; the per-person cap multiplier is deferred to this session).
  4. **Q4 Grön teknik:** category rates/caps / schablon on-off / whether it may ever combine with ROT
     (placeholder 20.00% / 50 000 kr per category; schablon not modelled).
  5. **Q5 Eligibility & disclaimer:** BRF/private/company rules + customer-facing disclaimer wording.
  6. **Q6 Personnummer:** reconcile "not captured by default" with the 2026-06-18 CRM store-for-`private`
     decision (the pure engine reads NO PII regardless — resolved in code).
  7. **Q7 Approval posture:** confirm ALL of the above stay "unapproved assumption + warning" for the
     pilot (nothing production-approved).
  8. **Q8 Accepted-price delta:** the golden-fixture representation of accepted vs recalculated price
     (feeds Epic 7; encoded as a defensible pilot assumption, not Epic-7-final).
- **Standing NFR CONCERNS (surface for schedule-or-accept — NOT a gate blocker):** no `pnpm audit`
  dependency-scan CI gate; no coverage reporter. Owner-pending across audits; this epic's gate is the
  natural place to schedule or formally accept them.
- **Residual (documented):** calc-at-scale performance untested (R-414) — pure in-memory logic, no
  Phase-A SLA; deferred to a later calc epic per the test design.

---

**Generated by:** BMad TEA Agent — Test Architect Module
**Workflow:** `bmad-testarch-trace` (v5.0 step-file architecture)
**Phase 1 (coverage matrix) + Phase 2 (gate decision):** complete
