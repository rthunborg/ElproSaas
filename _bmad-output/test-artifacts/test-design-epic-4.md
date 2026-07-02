---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-07-01'
workflowType: testarch-test-design
designLevel: epic
epicNum: 4
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md (Epic 4, lines 871-1024)
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/project-context.md (Money/Tax/Quote Rules; Testing Rules)
  - _bmad-output/test-artifacts/test-design-epic-3.md
  - src/server/commands/pricing/validation.ts (isOreAmount / ORE_AMOUNT_MAX)
  - src/lib/snapshots/build.ts, src/lib/snapshots/types.ts
  - tests/unit/lib/snapshots/golden.test.ts
  - tests/fixtures/golden/snapshots/{work-role,article}-source.json
  - knowledge: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
---

# Test Design: Epic 4 - Money, Tax, Snapshot Primitives, And Golden Fixtures

**Date:** 2026-07-01
**Author:** Rasmus
**Status:** Draft
**Design Level:** Epic-Level (Phase 4)
**Mode:** Risk-based, evidence-backed (Master Test Architect)

---

## Executive Summary

**Scope:** Epic-level test design for Epic 4 — the epic that makes **money, VAT, ROT, grön
teknik, rounding, and assumption-snapshot behavior explicit and testable BEFORE any calculation
(Epic 5) or quote (Epic 6) depends on it**. It covers four pure-logic stories: integer-öre money +
rounding primitives (4.1), VAT + quote-total primitives (4.2), the ROT / grön teknik estimate
engine with warnings + sign-off flags (4.3), and the money/tax **golden-master fixture pack** (4.4)
that becomes the recurring oracle for every later money/tax/quote story.

**Epic goal (from epics.md):** Make money, VAT, ROT, grön teknik, rounding, and snapshot behavior
explicit and testable before calculations or quotes depend on them — without shipping unapproved
legal/tax constants as production fact.

**Why this epic is risk-bearing (and *differently* risk-bearing from Epics 2–3):** Epics 2–3 were
dominated by **tenant isolation / RLS** risk on new *tables*. Epic 4 introduces **almost no new
tenant data and no new table** (epics.md 4.1 tech notes: pure functions in `src/lib/money`; 4.4:
fixtures only). Its risk is a different class: **correctness of brand-new customer-visible money and
tax math**, and **compliance** — treating an unapproved legal/tax assumption as final. This is the
**first computation engine in the codebase** (project-context: *"NO money/VAT/ROT CALCULATION ENGINE
exists yet — Epic 4 owns it"*). Two failure classes dominate: (1) a **money/tax miscalculation**
(float drift, wrong rounding step, wrong VAT rounding order, wrong ROT/grön-teknik cap or
eligibility) that silently flows into every quote, PDF, and acceptance built on top of it; (2) a
**Phase-A guardrail / sign-off breach** — an unapproved ROT/grön-teknik constant, a legally-sensitive
disclaimer, or personnummer-based eligibility encoded as production-approved fact. Because the
surface is **pure logic with no DB**, it is ideal for exhaustive UNIT + GOLDEN coverage; the residual
risk is *correct math*, *a pinned & signed-off rounding/tax policy*, and *an oracle that can tell a
regression from an intended change* — not an unaddressed isolation gap.

**Risk Summary:**

- Total risks identified: **14**
- High-priority risks (score ≥6): **10**
- Critical (score 9 / auto-BLOCK at design time): **0** — but with a caveat: two compliance risks
  (R-405 unapproved-tax-as-fact, R-411 fixture PII leak) are held at score 6 **only because the
  epic's design makes the control mandatory** (engine emits "requires sign-off" + never auto-approves;
  fixtures are anonymized + CI-scanned). A build that lets a tax output be marked approved without the
  explicit flag, or commits a real personnummer/orgnr into a golden fixture, is an **epic blocker
  regardless of numeric score**.
- Critical categories: **DATA** (öre/float integrity, rounding policy, VAT rounding order,
  cap/eligible-basis math, assumption-snapshot recompute), then **BUS/compliance** (hardcoded VAT,
  unapproved ROT/grön-teknik constants, invalid ROT×grön mix, sign-off gating, fixture privacy), then
  **TECH** (golden oracle must distinguish old-Lovable vs new-expected vs documented delta).

**Coverage Summary:**

- P0 scenarios: **~24–38** (~20–34 hours)
- P1 scenarios: **~14–20** (~10–18 hours)
- P2/P3 scenarios: **~8–14** (~4–9 hours)
- **Total effort:** **~46–72 tests, ~34–61 hours (~1–1.5 weeks, 1 dev)** — the **lowest per-test
  setup tax of any epic so far** (pure `node --test` units, NO DB, NO factories, NO RLS harness), but
  the real cost moves to **golden-fixture authoring + anonymized Lovable-oracle delta capture +
  pinning a rounding/VAT/tax policy**. Note: the dev-hours estimate is gated by a **calendar-time
  dependency on owner/accounting/legal sign-off** (rounding policy + ROT/grön-teknik constants) that
  is NOT dev effort.

**Headline:** Epic 4 is dominated by **pure UNIT + data-driven GOLDEN** coverage — it is the epic with
the **least** integration/RLS/e2e footprint and the **most** algorithmic-correctness footprint. The
single highest-leverage deliverable is the **Story 4.4 golden-master fixture pack**: a structured,
anonymized oracle where every expected value is explicitly labelled **old-Lovable behavior**,
**new-expected behavior**, or **documented intentional delta**, so a future failure points at the
affected assumption rather than an unexplained diff. Treat two things as epic blockers, not
nice-to-haves: (a) any money value computed in **float kronor** instead of integer öre off the
presentation boundary; (b) any **ROT/grön-teknik output that can be rendered or persisted as
approved** without the explicit human sign-off flag.

---

## Inherited Foundation (what Epic 4 builds on, not rebuilds)

Epic 3 already shipped the money-*storage* discipline and the immutability primitive Epic 4 now
computes on. Verified in-repo; Epic 4 must **reuse**, not re-invent, these:

| Inherited asset | Where | Epic 4 obligation |
| --- | --- | --- |
| Integer-öre money validator `isOreAmount(v)` + `ORE_AMOUNT_MAX` (= `Number.MAX_SAFE_INTEGER`) — rejects floats/negatives/NaN/∞/overflow/locale-comma/decimal strings | `src/server/commands/pricing/validation.ts` | The `src/lib/money` primitives REUSE/extend this exact öre discipline; a new money field is validated by the same unit, not a fork. No float-kronor value survives off the presentation boundary. |
| Snapshot-source contract: **copy-by-value + `Object.freeze`**, **pure + deterministic** (build instant injected via `opts.capturedAt`, never `Date.now()`), captures STATE / computes nothing | `src/lib/snapshots/build.ts`, `types.ts` | The 4.2/4.3 **assumption snapshot** (VAT rate + source assumption; ROT/grön-teknik rates/caps profile) reuses this freeze-by-value + injected-instant discipline so an estimate NEVER silently recomputes when a source rate later changes, and is golden-pinnable. |
| Golden-master fixture pattern: `tests/fixtures/golden/**/*.json` (`{capturedAt, sourceRow, expectedSnapshot}`) run by `node --test`, plus a **PII/secret scan guard** over the data payload | `tests/unit/lib/snapshots/golden.test.ts`, `tests/fixtures/golden/snapshots/*.json` | Story 4.4 extends this exact shape/harness to money/tax cases and reuses the anonymization scan (`\d{6}-\d{4}` personnummer, non-`example.test` emails, `secret|password|api_key`). Fixtures live under `tests/fixtures/golden/**` (+ `tests/golden/**` per epics.md 4.4). |
| VAT rate stored as **basis points** (`company_settings.vat_rate_bp`, 2500 = 25.00%, default 2500, **NEVER a code literal**); `default_vat_display` enum stored AS-IS | Epic 3 (project-context Money/Tax rules) | Epic 4 is the **first consumer** of `vat_rate_bp` as a computation input. VAT math reads the basis-point rate from settings/snapshot — there is **no hidden 25% constant** in the engine. |
| Quote-terms sign-off encoded **structurally** (`quote_terms.approved_at` nullable, human-only approve path, edit resets to null) | Epic 3 (`quote_terms`) | Epic 4 mirrors the "approval is structural, never a default string" discipline for **tax** assumptions: a missing sign-off is a NULL/absent flag surfaced as a warning; the engine never derives `isApproved`. |
| Two deliberately-separated runners: `node --test` for pure units `tests/unit/**` (`pnpm test:unit`); Vitest for DB-backed `tests/integration/**`; Playwright e2e | project-context Testing Rules; `scripts/run-tests.mjs` | Epic 4 lands **almost entirely in `tests/unit/**` (`node --test`)** — pure logic ⇒ unit + golden, no DB. Do NOT push money/tax math through Vitest/DB or the UI. |

**Epic 4 creates essentially no tenant-owned table.** The primitives are pure functions over inputs;
the only tenant-scoped touch is *reading* an already-tenant-owned `vat_rate_bp` / pricing snapshot
that Epic 3 secured. Therefore the H4 RLS inventory gate, cross-tenant negatives, and factory work
that dominated Epics 2–3 are **N/A for Epic 4's own deliverables** (they remain green as inherited
regression). This is the first epic where **RLS is not the headline** — algorithmic correctness and
tax sign-off are.

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **Calculation editor UX, sections/rows, row visibility/options (tillval) UI, readiness review** | Epic 5 owns the calculation workspace; Epic 4 is primitives only (epics.md Epic 5) | Epic 4 provides the *pure* basis/inclusion primitive; the *UI* semantics of hidden rows/tillval are Epic 5 test-design. R-408 scoped to "which inputs count toward basis," documented in fixtures. |
| **Quote snapshot persistence, quote PDF, version immutability/send** | Epic 6 owns quote versions/PDF/lifecycle (epics.md Epic 6; project-context) | Epic 4 freezes the *assumption* snapshot (VAT rate, tax rates/caps) as a pure builder; the concrete quote-version freeze + immutability-on-send is an Epic 6 trace concern (cross-ref). |
| **Acceptance → job, accepted-price immutability** | Epic 7 owns acceptance (epics.md Epic 7) | Epic 4 only supplies the golden "accepted-price delta" fixture *shape* (4.4 AC1); enforcement of accepted-state immutability is Epic 7. |
| **Production approval of legal/tax constants; customer-facing tax disclaimer wording approval** | epics.md Epic 4 explicit non-scope + 4.2/4.3 stop-conditions: needs owner/accounting/legal sign-off | Engine emits assumptions + **warnings** and NEVER marks output approved (R-405); constants live as *conservative unapproved profiles*; sign-off questions escalated to human (see Sign-Off section). |
| **Personnummer CAPTURE by the tax engine; personnummer-based ROT eligibility as production fact** | epics.md 4.3: "personnummer is not captured by default"; owner decision 2026-06-18 stores it access-controlled for `private` customers only (CRM), a known plan-vs-code divergence | The pure engine does NOT read/require personnummer; personnummer-based eligibility is a flagged **unapproved assumption** (R-412) pending sign-off. No PII enters `src/lib/money`. |
| **Fortnox / accounting / invoicing integration; final commercial tax advisory behavior** | epics.md Epic 4 explicit non-scope; AGENTS.md deferred | No integration surface built or tested; golden expected values are pilot-internal, not accounting-authoritative. |
| **Document-level rounding** | 4.1 assumes conservative **line-level** rounding; document-level is a stop-condition requiring a data-model decision | Line-level rounding is the tested assumption; a documented residual + stop-condition escalates if accounting requires document-level (R-402). |
| **Real Lovable money/tax data import** | Lovable is a behavioral oracle only; fixtures are anonymized (AGENTS.md) | Golden fixtures are anonymized/shape-only; deltas from Lovable are captured as *documented expected values*, never copied data (R-411). |
| **Money/tax calculation performance at scale** | Pure in-memory logic on quote-sized inputs; no SLA defined for Phase A | Functional correctness is the Phase-A concern; perf deferred. Documented residual (R-414). |

---

## Risk Assessment

Scoring per `probability-impact.md`: Probability 1 (unlikely) / 2 (possible) / 3 (likely);
Impact 1 (minor) / 2 (degraded) / 3 (critical). Score = P × I. Thresholds: 1–3 DOCUMENT,
4–5 MONITOR, 6–8 MITIGATE (CONCERNS at gate), 9 BLOCK (auto-FAIL).

**Impact rationale (why so many Impact 3):** nearly every Epic 4 primitive produces a
**customer-visible money or tax figure** that is later snapshotted into a quote and PDF and cannot be
silently corrected after send (project-context: a sent quote version is immutable). A wrong öre, a
wrong rounding step, a wrong VAT rate, or an over-stated ROT deduction is therefore **Impact 3**
(customer-visible financial +, for tax, regulatory exposure). **Probability is held at 2** for most —
not 3 — because the math is *pure, isolated, and highly testable* and the öre/freeze disciplines
already exist; the residual is correct implementation of genuinely new logic, not an unaddressed
design gap. Probability rises to **3** only where the *policy itself is ambiguous/undecided*
(rounding mode, ROT/grön-teknik constants pending sign-off). Impact drops to **2** where the concern
is degraded-not-critical (negative/discount edge semantics; hidden-row inclusion, which is largely
Epic 5's).

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Prob | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-401 | DATA | Money computed in **float kronor** or mixed units (kr vs öre) instead of integer öre → non-reproducible, drifting customer-visible totals | 2 | 3 | 6 | All internal money is integer öre (reuse `isOreAmount`/`ORE_AMOUNT_MAX`); kronor formatting ONLY at presentation/PDF boundary; UNIT + GOLDEN over large values, fractional qty × unit price, formatting boundary | Dev (4.1) | Story 4.1 |
| R-402 | DATA/BUS | **Rounding policy** wrong or ambiguous — line-level vs document-level, and half-rounding mode (half-up vs half-to-even) unpinned → öre-level customer-visible discrepancies + accounting mismatch | 2 | 3 | 6 | Implement the conservative **line-level** policy with an explicitly-pinned half-rounding mode; GOLDEN-pin the mode; totals preserve exact öre; **stop-condition** if accounting needs document-level (escalate, don't guess) | Dev (4.1) + Owner sign-off | Story 4.1 |
| R-403 | DATA | **VAT rounding order** wrong — per-line VAT rounding vs round-at-end; totals must SUM rounded line values, not round the sum → totals diverge by öre and from Lovable | 2 | 3 | 6 | 4.2 AC: VAT rounded **per line** under the policy; section/quote totals **sum rounded line values**; UNIT + GOLDEN incl. the sum-of-rounded ≠ round-of-sum case | Dev (4.2) | Story 4.2 |
| R-404 | BUS | **Hidden 25% VAT constant** baked into the engine instead of consuming tenant `vat_rate_bp` (basis points) → wrong VAT whenever a tenant configures a non-25% rate, silently | 2 | 3 | 6 | No code literal (project-context rule); VAT rate flows in as basis points from settings/snapshot; UNIT + GOLDEN for 0 / 6 / 12 / 25% (Swedish rates) + zero rows | Dev (4.2) | Story 4.2 |
| R-405 | BUS | **Unapproved ROT/grön-teknik constants/eligibility encoded as production-approved fact** (no owner/accounting/legal sign-off) → tax-sensitive quote treated as final | 2 | 3 | 6 | Engine ALWAYS emits deduction + eligible basis + **warnings + assumption snapshot**; NEVER derives/renders/persists "approved"; missing sign-off ⇒ explicit "requires sign-off" flag; **design-time near-blocker** — gate fails if any tax output is approvable without the explicit human flag | Dev (4.3) + Owner/legal sign-off | Story 4.3 |
| R-406 | BUS | **ROT and grön teknik mixed** on one calculation when no approved rule supports it → invalid combined deduction | 2 | 3 | 6 | Engine blocks the mix (4.3 AC); UNIT + GOLDEN invalid-mix cases assert a blocking error, not a silent sum | Dev (4.3) | Story 4.3 |
| R-407 | DATA | **Deduction caps / eligible-basis math wrong** (per-person ROT cap, grön-teknik category rates/caps, schablon on/off) → over/under-stated deduction | 2 | 3 | 6 | Rates/caps as explicit **profiles** (not literals); UNIT + GOLDEN at/above/below cap, per category, schablon on/off if supported, eligible-basis boundaries | Dev (4.3) | Story 4.3 |
| R-409 | DATA | **Assumption snapshot recomputes** — the estimate holds a live reference to mutable rates/settings (or reads a clock) → a prior estimate silently changes when a rate changes later | 2 | 3 | 6 | Reuse Epic 3 copy-by-value + `Object.freeze` + injected `capturedAt`; UNIT proves mutating the source after capture does NOT change a prior snapshot; no `Date.now()` in the pure engine | Dev (4.2/4.3) | Stories 4.2/4.3 |
| R-410 | TECH/DATA | **Golden oracle ambiguous** — fixtures don't distinguish old-Lovable behavior vs new-expected vs documented intentional delta → a golden failure can't tell a regression from an intended change, and later money/tax regressions slip through | 2 | 3 | 6 | 4.4: each expected value LABELLED old-Lovable / new-expected / documented-delta; a failing golden points to the affected assumption/delta; structured, reviewable fixtures | Dev (4.4) | Story 4.4 |
| R-411 | SEC/BUS | **Fixture PII/secret leak** — a golden fixture commits a real name/email/phone/address/**personnummer/orgnr**/secret/`.env` value/raw customer file | 2 | 3 | 6 | Anonymized/shape-only fixtures; reuse + extend the golden PII/secret scan (personnummer `\d{6}-\d{4}`, non-`example.test` email, `secret|password|api_key`, add orgnr shape); scan runs in CI unit gate; no raw customer data | Dev (4.4) | Story 4.4 |

### Medium-Priority Risks (Score 3–4)

| Risk ID | Category | Description | Prob | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| R-408 | DATA/BUS | **Hidden-row / tillval (options) inclusion ambiguity** — whether hidden rows and optional tillval count toward the deduction basis / totals is unclear → wrong basis | 2 | 2 | 4 | Epic 4 documents which inputs count toward the basis and GOLDEN-pins a representative options/hidden-row case; the *UI* visibility semantics are Epic 5's (cross-ref). Monitor for scope bleed into Epic 5. | Dev (4.3/4.4) |
| R-412 | BUS/SEC | **Personnummer-based ROT eligibility** encoded/required by the engine — 4.3 says "not captured by default", but owner decision 2026-06-18 stores personnummer for `private` customers (a plan-vs-code divergence) | 1 | 3 | 3 | Pure engine does NOT read/require personnummer; personnummer-based eligibility is a flagged **unapproved assumption** with a warning; UNIT asserts no PII enters `src/lib/money`; sign-off question escalated (reconcile 4.3 text with the 2026-06-18 decision) | Dev (4.3) + Owner |
| R-413 | DATA | **Negative / discount / zero-row semantics** inconsistent — negatives rejected where not allowed (4.1 AC3), discounts (if in scope) and zero rows handled ad-hoc | 2 | 2 | 4 | Explicit reject/allow per story; UNIT for negative (rejected, user-safe error), zero row, discount only if a story allows it; **stop-condition** if discount semantics need a new data model | Dev (4.1) |

### Low-Priority Risks (Score 1–2)

| Risk ID | Category | Description | Prob | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- |
| R-414 | PERF/OPS | Money/tax calc performance at scale untested (pure in-memory, no SLA) **+** standing NFR CONCERNS (no `pnpm audit` CI gate, no coverage reporter) carry into the first golden-heavy epic | 1 | 2 | 2 | Monitor; correctness (not perf) is the Phase-A concern. Surface the two standing NFR concerns to owner in this epic's gate — schedule or formally accept, don't keep silently carrying them (project-context). |

### Risk Category Legend

- **TECH**: Technical/Architecture (golden-oracle labelling, primitive reuse vs fork)
- **SEC**: Security (fixture PII/secret leak, PII entering the pure engine)
- **PERF**: Performance (calc at scale)
- **DATA**: Data Integrity (öre/float, rounding, VAT rounding order, cap/basis math, snapshot recompute)
- **BUS**: Business/Compliance Impact (hardcoded VAT, unapproved tax constants, invalid ROT×grön mix, sign-off gating, fixture privacy, personnummer/eligibility)
- **OPS**: Operations (standing NFR gates) — minimal for this epic

---

## Testability Notes (Epic-Level)

Epic 4 has the **strongest inherited testability of any epic so far** — the surface is pure logic
with no DB, so nearly every scenario is a fast `node --test` UNIT or data-driven GOLDEN. Five concerns
worth flagging:

1. **Keep money/tax math at the UNIT + GOLDEN level — never through DB or UI.** `test-levels-framework`:
   pure calculation with high branch complexity ⇒ unit, not integration/E2E. Epic 4 should add zero
   Vitest/DB and zero Playwright tests for its own primitives; the DB/UI consumers arrive in Epics 5–6.
2. **Rounding & VAT-order correctness is a *policy* assertion, not just a math assertion.** A test that
   only checks "VAT ≈ 25%" is worthless; the load-bearing tests pin the **exact rounding step and
   order** (per-line round → sum rounded lines) and the **half-rounding mode** via a golden, so an
   accidental round-at-end or half-to-even flip fails loud.
3. **Sign-off/approval is a *behavioral* assertion (mirrors Epic 3 R-011).** R-405's test must prove
   the engine does not *render or persist* a tax output as approved without the explicit human flag —
   not merely that a warning field exists. Absence of approval must be the default, structurally.
4. **The golden pack is only as good as its labelling.** R-410's tests must assert each expected value
   carries an `origin` (old-Lovable / new-expected / documented-delta) so a diff is *explainable*. An
   unlabelled golden is a silent-regression trap.
5. **Determinism: inject the capture instant.** Any assumption-snapshot builder must take `capturedAt`
   (never read a clock), reusing the Epic 3 discipline, so goldens are stable across machines/time.

---

## Entry Criteria

- [ ] Epic 3 merged and green — `isOreAmount`/`ORE_AMOUNT_MAX`, the `src/lib/snapshots` copy-by-value +
      `Object.freeze` builder, the `tests/fixtures/golden/**` pattern + PII scan, and the two-runner
      stack (`node --test` + Vitest + Playwright) all live in `main`
- [ ] `pnpm test:unit` runs the pure `node --test` suite (no DB required for Epic 4 primitives)
- [ ] **Rounding policy confirmed as a conservative pilot assumption pending sign-off** — line-level +
      a specific half-rounding mode — recorded as an assumption, NOT hard-coded as accounting-final
      (4.1 stop-condition)
- [ ] **VAT rates sourced as basis points from tenant settings/snapshot** (no literal); the set of
      pilot VAT rates to cover (0/6/12/25%) agreed
- [ ] **ROT / grön-teknik rate & cap profiles agreed as conservative UNAPPROVED assumptions** (rates,
      per-person cap, category caps, schablon handling, mix rule) — explicitly NOT production-approved
      (4.3 stop-condition)
- [ ] Anonymized Lovable oracle examples available for delta capture (via `legacy-oracle-explorer`;
      no real data copied)
- [ ] Requirements/assumptions agreed by Dev/QA/PM (the epic acceptance criteria are the contract)

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing or each failure explicitly triaged/waived
- [ ] **Integer-öre proven**: no money value is a float kronor off the presentation boundary;
      float/negative/overflow/locale-comma inputs rejected (reusing `isOreAmount`)
- [ ] **Rounding policy pinned by golden**: line-level rounding + the agreed half-rounding mode; totals
      preserve exact öre
- [ ] **VAT correctness proven**: per-line VAT rounding + totals = sum of rounded lines; rate consumed
      as basis points (no hidden 25%); 0/6/12/25% + zero-row cases green
- [ ] **ROT/grön-teknik engine proven**: outputs deduction + eligible basis + warnings + a **frozen**
      assumption snapshot; **invalid ROT×grön mix blocked**; caps/eligible-basis golden-pinned
- [ ] **Sign-off gating proven**: no tax output is rendered or persisted as approved without the
      explicit human sign-off flag; missing sign-off surfaces a "requires sign-off" warning
- [ ] **Assumption snapshots frozen**: mutating a source rate after capture does NOT change a prior
      snapshot (copy-by-value/freeze; no clock read)
- [ ] **Golden pack complete + labelled**: covers regular VAT, ROT, grön teknik, caps, invalid mixes,
      options/tillval, hidden rows, fractional quantities, rounding, and accepted-price deltas; each
      expected value labelled old-Lovable / new-expected / documented-delta; a failure points to the
      affected assumption
- [ ] **Fixture privacy green**: no real names/emails/phones/addresses/personnummer/orgnr/secrets/
      `.env`/raw files (CI scan)
- [ ] **No PII in the pure engine**: personnummer never read/required by `src/lib/money`
- [ ] No open high-priority (≥6) risk unmitigated or unwaived; standing NFR concerns (no `pnpm audit`
      gate, no coverage reporter) surfaced to owner for schedule-or-accept

---

## Test Coverage Plan

> **P0/P1/P2/P3 = priority / risk classification, NOT execution timing.** Execution timing is defined
> separately in the Execution Strategy section below.

Test ID format `{EPIC}.{STORY}-{LEVEL}-{SEQ}`. Levels for Epic 4: **UNIT** (pure `node --test`),
**GOLDEN** (data-driven UNIT over `tests/fixtures/golden/**`), and **DOCS** (documented residual/
assumption). There is **no INT / RLS / E2E** in Epic 4's own coverage — the surface is pure logic;
DB/UI consumers are Epics 5–6 (their test designs own that coverage). This is the deliberate emphasis
shift from Epics 2–3.

### P0 (Critical)

**Criteria**: Blocks the trustworthy money/tax foundation OR a compliance/sign-off breach + high risk
(≥6) + no workaround.

| Test ID | Requirement (AC source) | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 4.1-UNIT-01 | Internal money is integer öre, never float kronor; formatting to kr only at presentation boundary (4.1 AC1) | UNIT | R-401 | 3–4 | Dev | Assert öre in, öre out; kr string only via a boundary formatter |
| 4.1-UNIT-02 | Line net = round(quantity × unit_price) to nearest öre under the conservative line-level policy; fractional quantities (4.1 AC2) | UNIT | R-401, R-402 | 4–6 | Dev | Fractional qty, large values; totals preserve exact öre |
| 4.1-GOLDEN-01 | Rounding mode pinned — half-rounding mode (half-up vs half-to-even) is fixed and golden-pinned (4.1 AC2) | GOLDEN | R-402 | 2–3 | Dev | The load-bearing policy pin; an accidental mode flip fails loud |
| 4.1-UNIT-03 | Invalid money rejected: negative/malformed rejected where not allowed; errors user-safe + testable (4.1 AC3) | UNIT | R-401, R-413 | 3–4 | Dev | Reuse `isOreAmount` rejects; no raw value echoed |
| 4.2-UNIT-01 | VAT rounded **per line** under the policy; section/quote totals **sum rounded line values** (4.2 AC1) | UNIT | R-403 | 4–6 | Dev | Includes the sum-of-rounded ≠ round-of-sum case |
| 4.2-GOLDEN-01 | VAT rate consumed as **basis points** (no hidden 25%): 0 / 6 / 12 / 25% + zero rows + fractional qty (4.2 tech notes) | GOLDEN | R-404 | 4–6 | Dev | Rate flows from settings/snapshot; no literal in engine |
| 4.2-UNIT-02 | Display modes excl / incl / both represented **without changing stored source totals** (4.2 AC2) | UNIT | R-403 | 2–3 | Dev | Presentation only; source total immutable |
| 4.2-UNIT-03 | Exact VAT rate + source assumption **snapshotted (frozen)** before customer-visible (4.2 AC3) | UNIT | R-409, R-404 | 2–3 | Dev | Copy-by-value/freeze; injected `capturedAt` |
| 4.3-UNIT-01 | Engine outputs deduction amount + eligible basis + warnings + assumption-snapshot data (4.3 AC1) | UNIT | R-405, R-407 | 4–6 | Dev | Shape + values; assumptions captured, nothing approved |
| 4.3-UNIT-02 | ROT and grön teknik **cannot be mixed** unless an approved rule supports it — invalid mix blocked (4.3 AC1) | UNIT / GOLDEN | R-406 | 2–3 | Dev | Blocking error, not a silent combined sum |
| 4.3-UNIT-03 | Missing owner/accounting/legal sign-off ⇒ output + snapshot indicate assumptions **require sign-off**; engine never marks approved (4.3 AC2) | UNIT | R-405 | 2–3 | Dev | Behavioral: not rendered/persisted approved without the flag |
| 4.3-GOLDEN-01 | Caps / eligible-basis math: at / above / below cap; per category; schablon on/off if supported (4.3 test req) | GOLDEN | R-407 | 4–6 | Dev | Explicit rate/cap profiles; boundary values |
| 4.4-GOLDEN-01 | Golden pack covers regular VAT, ROT, grön teknik, caps, invalid mixes, options/tillval, hidden rows, fractional qty, rounding, accepted-price deltas (4.4 AC1) | GOLDEN | R-410 | 8–12 | Dev | The fixture set — the recurring money/tax oracle |
| 4.4-GOLDEN-02 | Each expected value labelled old-Lovable / new-expected / documented-delta; a golden failure points to the affected assumption/delta (4.4 AC1/AC3) | GOLDEN / UNIT | R-410 | 1–2 | Dev | Oracle is explainable, not an unlabelled diff |
| 4.4-UNIT-01 | Fixture privacy: no real names/emails/phones/addresses/personnummer/orgnr/secrets/`.env`/raw files (4.4 AC2) | UNIT | R-411 | 2–3 | Dev | Reuse + extend the golden PII/secret scan; runs in CI |

**Total P0**: ~24–38 tests

### P1 (High)

**Criteria**: Important correctness/behavior + medium risk (3–4) + common cases.

| Test ID | Requirement (AC source) | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 4.1-UNIT-04 | Negative / discount / zero-row semantics per story (reject where not allowed; zero row valid) (4.1 AC3) | UNIT | R-413 | 2–3 | Dev | Discount only if a story allows; stop-condition otherwise |
| 4.2-UNIT-04 | "Both-display" assumption does not mutate stored source totals; display modes round-trip (4.2 AC2) | UNIT | R-403 | 2–3 | Dev | Guards presentation-vs-source separation |
| 4.3-GOLDEN-02 | Customer eligibility warnings — BRF / private / company-like fixture cases: warnings + blocking match the conservative Phase-A policy (4.3 AC3) | GOLDEN | R-405 | 3–4 | Dev | One case per customer class; warnings assert-on |
| 4.3-UNIT-04 | Hidden-row / tillval inclusion assumption documented + tested (which inputs count toward basis) (4.3 test req) | UNIT | R-408 | 2–3 | Dev | Epic 4 pins the basis rule; UI visibility is Epic 5 |
| 4.3-UNIT-05 | Personnummer NOT required/encoded by the pure engine; personnummer-based eligibility flagged as unapproved assumption (4.3 AC3) | UNIT | R-412 | 1–2 | Dev | Asserts no PII path into `src/lib/money` |
| 4.4-UNIT-02 | Fixtures structured (old/new/delta) + reviewable; contract-shape assertions on the fixture schema (4.4 tech notes) | UNIT | R-410 | 2–3 | Dev | Schema/shape guard so a malformed fixture fails |
| 4.2-UNIT-05 / 4.3-UNIT-06 | Assumption snapshot frozen — mutating a source rate after capture does NOT change a prior snapshot (4.2 AC3 / 4.3 AC1) | UNIT | R-409 | 2–3 | Dev | Mirrors Epic 3 snapshot-freeze test for tax rates |

**Total P1**: ~14–20 tests

### P2 (Medium)

**Criteria**: Secondary behavior + low risk (1–2) + edge cases.

| Test ID | Requirement (AC source) | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 4.1-UNIT-05 | Formatting boundary: kr display (whole-kr / sv-SE) preserves exact öre internally (4.1 AC1/AC2) | UNIT | R-401 | 2–3 | Dev | Presentation format; internal öre unchanged |
| 4.1-UNIT-06 | Large-value / overflow guard at `ORE_AMOUNT_MAX` (4.1 test req) | UNIT | R-401 | 1–2 | Dev | Reuse the existing overflow ceiling |
| 4.2-UNIT-06 | Zero-VAT / VAT-exempt rows handled (rate = 0 bp) | UNIT | R-404 | 1–2 | Dev | Zero-rate is not a special-case bug |
| 4.4-DOCS-01 | Documented old-Lovable number-kronor deltas noted where they exist (4.4 / migration impact) | DOCS | R-410 | 1 | Dev | Migration-delta documentation, not a gate |

**Total P2**: ~5–9 tests

### P3 (Low)

**Criteria**: Nice-to-have + exploratory + benchmarks.

| Test ID | Requirement | Test Level | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| 4.1-UNIT-07 | Property/fuzz: öre↔kronor round-trip and qty×price invariants (exploratory) | UNIT | 1–2 | Dev | Exploratory; not a gate |
| 4.3-UNIT-07 | DX: clear error when an unknown tax category/rate profile is requested | UNIT | 1 | Dev | Developer ergonomics |
| 4.4-DOCS-02 | Residual notes: deferred document-level rounding, calc-at-scale perf, standing NFR gaps (R-414) | DOCS | 1 | Dev | Awareness only |

**Total P3**: ~3–5 tests

---

## Execution Strategy

**Philosophy: run everything in every PR.** Epic 4's entire suite is pure `node --test` UNIT + GOLDEN
with **no DB, no browser, no network** — it runs in **seconds**, far under the 15-minute bar. There is
nothing expensive or long-running to defer.

- **Every PR:** all Epic 4 UNIT + GOLDEN tests (`pnpm test:unit`, part of `pnpm test`). This is the
  fast gate that protects money/tax correctness on every change (project-context "coverage-shape
  lesson": critical contract logic lives in pure, unit-testable functions so the fast gate protects
  it). The inherited Vitest integration + RLS suites and Playwright e2e run as usual but are
  **untouched by Epic 4** (no new DB/UI surface).
- **Nightly / Weekly:** nothing Epic-4-specific. (Calc-at-scale perf is deferred, R-414 — add later
  only if an SLA emerges.)

There is deliberately **no smoke/P0/P1 execution tiering** for Epic 4 — the whole suite is cheap
enough to always run.

---

## Resource Estimates

Ranges, not false precision. Epic 4 has the **lowest per-test setup tax** of any epic (pure functions,
no DB/factory/RLS harness), so the cost concentrates in **golden-fixture authoring**, **anonymized
Lovable-oracle delta capture**, and **pinning rounding/VAT/tax policy** — not in test plumbing.

| Priority | Count (range) | Effort (range) | Notes |
| --- | --- | --- | --- |
| P0 | ~24–38 | ~20–34 h | Golden fixture authoring + rounding/VAT/tax-policy pinning dominate |
| P1 | ~14–20 | ~10–18 h | Eligibility/warnings + snapshot-freeze + fixture-schema guards |
| P2 | ~5–9 | ~3–6 h | Formatting/overflow/zero-rate edges |
| P3 | ~3–5 | ~1–3 h | Exploratory/DX/residual docs |
| **Total** | **~46–72** | **~34–61 h (~1–1.5 weeks, 1 dev)** | Pure-logic, low plumbing cost |

**Prerequisites**

- **Test data:** anonymized money/tax golden fixtures under `tests/fixtures/golden/**` (+
  `tests/golden/**` per 4.4) following the existing `{capturedAt, sourceRow, expectedSnapshot}` /
  old-new-delta shape. NO factories/DB needed.
- **Tooling:** `node --test` (existing `pnpm test:unit`); the golden PII/secret scan (existing,
  extend with an orgnr shape). No new runner.
- **Environment:** none beyond Node — pure logic, no Supabase stack, no browser.

**Non-effort dependency (calendar time):** owner/accounting/legal **sign-off** on rounding policy +
ROT/grön-teknik constants gates *approval* of the numbers, not the dev work. Build against conservative
unapproved assumptions + warnings; do not block coding on sign-off, but do not ship the constants as
approved either.

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate:** 100% (no exceptions)
- **P1 pass rate:** ≥95% (waivers required for failures)
- **P2/P3 pass rate:** ≥90% (informational)
- **High-risk (≥6) mitigations:** 100% complete or approved waivers

### Coverage Targets

- **Money/tax business logic (pure):** ≥90% (this IS the epic; the fast unit gate must protect it)
- **Rounding + VAT-order + cap/eligible-basis branches:** 100% of enumerated policy cases golden-pinned
- **Golden pack:** covers every 4.4 AC1 category, each expected value labelled old/new/delta
- **Edge cases (negative/zero/overflow/zero-rate):** ≥50%

### Non-Negotiable (epic blockers regardless of numeric score)

- [ ] No money value is a **float kronor** off the presentation boundary
- [ ] No **hidden VAT literal** — rate consumed as basis points
- [ ] No **ROT/grön-teknik output approvable** without the explicit human sign-off flag
- [ ] **Invalid ROT×grön mix blocked**, not silently summed
- [ ] **No real PII/secret** in any golden fixture (CI scan green)
- [ ] Assumption snapshots are **frozen** (no silent recompute)

---

## Mitigation Plans (High-Priority, Score ≥6)

### R-402: Rounding policy wrong/ambiguous (Score 6)

**Strategy:** (1) Implement the conservative **line-level** rounding with an explicitly-chosen
half-rounding mode. (2) GOLDEN-pin the mode so an accidental flip (e.g. half-to-even) fails loud.
(3) Record the policy as a *conservative pilot assumption pending sign-off*; escalate the
document-level-vs-line-level question to accounting (stop-condition). **Owner:** Dev (4.1) + Owner
sign-off. **Timeline:** Story 4.1. **Verification:** `4.1-GOLDEN-01` + totals-preserve-öre unit.

### R-404: Hidden 25% VAT constant (Score 6)

**Strategy:** Engine takes the VAT rate as a **basis-point input** from settings/snapshot; a repo grep
in review confirms no `0.25`/`25`/`1.25` literal in the VAT path. **Owner:** Dev (4.2). **Timeline:**
Story 4.2. **Verification:** `4.2-GOLDEN-01` across 0/6/12/25%.

### R-405: Unapproved ROT/grön-teknik constants as production fact (Score 6, design-time near-blocker)

**Strategy:** (1) Engine ALWAYS returns `{deduction, eligibleBasis, warnings[], assumptionSnapshot}`
and has **no code path** that derives/sets "approved". (2) Missing sign-off ⇒ a "requires sign-off"
warning + a NULL/absent approval flag (mirror `quote_terms.approved_at`). (3) Constants live as named
*unapproved profiles*. **Owner:** Dev (4.3) + Owner/legal. **Timeline:** Story 4.3. **Verification:**
`4.3-UNIT-03` behavioral (not rendered/persisted approved) + `4.3-GOLDEN-02` eligibility warnings.

### R-406: ROT × grön teknik mixed (Score 6)

**Strategy:** Engine rejects a mixed request with a blocking error; no combined sum path exists.
**Owner:** Dev (4.3). **Timeline:** Story 4.3. **Verification:** `4.3-UNIT-02` + invalid-mix golden.

### R-407: Caps / eligible-basis math wrong (Score 6)

**Strategy:** Rates/caps as explicit profiles; boundary tests at/above/below cap, per category,
schablon on/off. **Owner:** Dev (4.3). **Timeline:** Story 4.3. **Verification:** `4.3-GOLDEN-01`.

### R-401 / R-403 / R-409 / R-410 / R-411

Covered inline above (integer öre — reuse `isOreAmount`; VAT per-line-round-then-sum; freeze-by-value
assumption snapshot; labelled golden oracle; anonymized + CI-scanned fixtures). Verification tests:
`4.1-UNIT-01/02`, `4.2-UNIT-01`, `4.2-UNIT-03`/`4.3-UNIT-06`, `4.4-GOLDEN-02`, `4.4-UNIT-01`.

---

## Owner / Accounting / Legal Sign-Off Questions (money-tax gate)

These are **tax/money assumptions** the implementation must NOT silently treat as approved. Surface to
the human owner; the engine encodes them as *conservative unapproved profiles + warnings* until signed
off (epics.md 4.1/4.2/4.3 stop-conditions).

1. **Rounding:** line-level vs document-level rounding; and the half-rounding mode (half-up vs
   half-to-even / banker's)? *(4.1 stop-condition; R-402.)*
2. **VAT display policy:** excl / incl / both; and the "private customer → always incl-VAT"
   presentation rule (project-context assigns this to Epic 4)? *(4.2 stop-condition; R-403/R-404.)*
3. **ROT:** per-person annual cap, deduction %, labour-only basis, multiple-owner handling? *(4.3
   stop-condition; R-407.)*
4. **Grön teknik:** category rates/caps, schablon handling, and whether it may ever combine with ROT?
   *(4.3 stop-condition; R-406/R-407.)*
5. **Eligibility & disclaimer:** BRF / private / company eligibility rules and customer-facing
   disclaimer wording approval? *(4.3 stop-condition; R-405.)*
6. **Personnummer:** is personnummer-based ROT eligibility in Phase-A scope? Reconcile 4.3's
   "not captured by default" with the **2026-06-18 owner decision** that stores personnummer for
   `private` customers. The pure engine must not read PII regardless. *(R-412.)*
7. **Approval posture:** are ANY of the above production-approved for the pilot, or are ALL of them
   "unapproved assumption + warning" until a later sign-off? *(R-405.)*
8. **Accepted-price delta (4.4):** how is an accepted price vs a later recalculated price represented
   in the golden fixtures (documented delta semantics)? *(Feeds Epic 7.)*

---

## Assumptions and Dependencies

### Assumptions

1. Epic 4 primitives are **pure** (`src/lib/money`, tax engine, assumption-snapshot builders) with no
   DB/tenant-data dependency — so UNIT + GOLDEN is the correct and sufficient level.
2. Line-level rounding + a fixed half-rounding mode is the conservative pilot policy (pending sign-off).
3. VAT rate is always available as **basis points** from tenant settings/snapshot; there is no scenario
   where the engine must invent a rate.
4. ROT/grön-teknik constants are **unapproved conservative profiles** for the pilot; the engine warns
   and never marks approved.
5. Golden fixtures are anonymized shape-only; Lovable is an oracle for *expected values*, not a data
   source.

### Dependencies

1. Epic 3 primitives (`isOreAmount`, `src/lib/snapshots` freeze discipline, golden pattern + PII scan,
   two-runner stack) — **live in `main`** (verified).
2. Tenant `vat_rate_bp` / `default_vat_display` from Epic 3 `company_settings` — consumed as input.
3. Owner/accounting/legal **sign-off** on rounding + ROT/grön-teknik constants — required before those
   numbers are treated as approved (calendar dependency, not dev effort).
4. Anonymized Lovable oracle examples (via `legacy-oracle-explorer`) for delta capture.

### Risks to Plan

- **Risk:** Sign-off on tax constants is slow. **Impact:** the numbers stay "unapproved assumption"
  and cannot be used for real pilot quotes. **Contingency:** ship the engine + tests against
  conservative profiles + warnings now; swap constants + flip approval flags when sign-off lands
  (no code-shape change — profiles are data).
- **Risk:** Lovable oracle reveals a rounding/VAT delta that contradicts the assumed policy.
  **Impact:** re-pin a golden. **Contingency:** the old/new/delta labelling makes the change explicit
  and reviewable rather than a silent break.

---

## Interworking & Regression

| Component | Impact | Regression Scope |
| --- | --- | --- |
| **`src/lib/money` (new, Epic 4)** | Consumed by Epic 5 calculations, Epic 6 quote snapshot/PDF, Epic 7 acceptance | The 4.4 golden pack must stay green across Epics 5–7; those epics extend, not fork, the primitives |
| **`src/lib/snapshots` (Epic 3)** | Epic 4 reuses copy-by-value + `Object.freeze` + injected `capturedAt` for tax-assumption snapshots | Existing `tests/unit/lib/snapshots/golden.test.ts` must stay green; the new tax-assumption freeze tests mirror it |
| **`src/server/commands/pricing/validation.ts` (`isOreAmount`)** | Epic 4 money primitives reuse/extend the same öre validator | The existing pricing validation units must stay green; no forked money-validity rule |
| **`company_settings.vat_rate_bp` / `default_vat_display` (Epic 3)** | Epic 4 is the first *computation* consumer | Epic 3 storage semantics unchanged; Epic 4 adds no migration |
| **Inherited RLS / anon / service-role / audit gates** | **Untouched** by Epic 4 (no new tenant table/command) | Remain green as standing regression; H4 inventory gate not exercised by Epic 4's own deliverables |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — risk classification framework
- `probability-impact.md` — P×I scoring methodology (thresholds 1–3 DOCUMENT / 4–5 MONITOR / 6–8
  MITIGATE / 9 BLOCK)
- `test-levels-framework.md` — pure calculation ⇒ UNIT; avoid DB/E2E for business logic
- `test-priorities-matrix.md` — financial calculations / compliance ⇒ P0; P0 = blocks core + high risk
  + no workaround

### Related Documents

- Epic: [epics.md — Epic 4 (lines 871–1024)](../planning-artifacts/epics.md)
- PRD: [prd.md](../planning-artifacts/prd.md)
- Architecture: [architecture.md](../planning-artifacts/architecture.md)
- Project rules: [project-context.md — Money/Tax/Quote Rules; Testing Rules](../project-context.md)
- Prior epic design (house style + inherited money/snapshot notes): [test-design-epic-3.md](test-design-epic-3.md)
- Inherited code: `src/server/commands/pricing/validation.ts`, `src/lib/snapshots/build.ts`,
  `tests/unit/lib/snapshots/golden.test.ts`, `tests/fixtures/golden/snapshots/*.json`

### Follow-on Workflows (Manual)

- Run `*atdd` to generate the red-phase **P0** money/tax scenarios above (separate workflow; not
  auto-run) — target the P0 UNIT + GOLDEN rows.
- Run `*automate` for broader coverage once the `src/lib/money` + tax engine implementation exists.
- Run `*trace` at the epic boundary to build the traceability matrix + gate decision; feed R-401–R-411
  into the gate.

---

**Generated by**: BMad TEA Agent — Test Architect Module
**Workflow**: `bmad-testarch-test-design`
**Version**: 4.0 (BMad v6)
