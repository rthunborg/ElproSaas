---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-07-07'
workflowType: testarch-test-design
designLevel: epic
epicNum: 9
mode: epic-level
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md (Epic 9 summary lines 363-371; stories 9.1-9.5 lines 1755-1938; FR55-59; NFR/AR defs 119-172)
  - _bmad-output/planning-artifacts/prd.md (NFR17/21/22/32/37/38/39; PRD AC1-AC22 referenced by 9.5)
  - _bmad-output/planning-artifacts/owner-signoff-questions.md (the sign-off register system-of-record — Blocks A-D tax gates open/möte; 8.1/8.2 migration möte; 1.2/7.1/7.3 partial; Design note 5.4; Scope decisions 3.4/7.5)
  - _bmad-output/project-context.md (Lovable Oracle Policy; Testing Rules — golden runner-glob trap, NO real Lovable oracle so every calc golden is new-expected, fictional ReadinessCode representativeness trap, ORGNR 10-digit scan constraint, stale RED-PHASE banner class; Security Regression Harness Rules; demo-data-only decision 2026-07-03)
  - _bmad-output/implementation-artifacts/deferred-work.md (open Sign-Off Q residuals, per-person ROT cap, margin threshold, R-817 MIME sniffing, golden-pack representativeness hardening — 9.4/9.5 consolidation inputs)
  - .github/workflows/ci.yml + package.json scripts (verify → db(migration reset + int/RLS) → e2e gate chain that 9.5 consolidates; test:unit/test:int/test:e2e/verify:*)
  - IN-REPO golden infra: tests/fixtures/golden/{money,snapshots,quote-pdf,files}/*.json; tests/unit/**/*golden*.test.ts; the extended anonymization scan in tests/unit/lib/money/golden-pack.test.ts (the pattern 9.2 generalizes)
  - knowledge: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
---

# Test Design: Epic 9 - Migration, Coexistence, Golden Masters, And Pilot Readiness

**Date:** 2026-07-07
**Author:** Rasmus
**Status:** Draft — all five stories (9.1-9.5) `backlog`; Epics 1-8 `done` (full workflow exists to compare against)
**Design Level:** Epic-Level (Phase 4)
**Mode:** Risk-based, evidence-backed (Master Test Architect)

> **Reading note.** Epic 9 is the *readiness / evidence* epic, not a product-feature epic. Four of its
> five stories (9.1, 9.4, 9.5, and the docs half of 9.2) are **decision and evidence artifacts** — a
> migration runbook, a sign-off register, a fallback/cutover runbook, and an acceptance-gate report —
> whose "tests" are checklist/traceability validators and a fixture-privacy scan, not product behavior.
> Only **9.2 (fixture capture scripts)** and **9.3 (the golden-master comparison harness)** add executable
> machinery. This design therefore weights its risk toward the two failure modes that actually bite an
> evidence epic: **(1) a privacy leak** — real PII / raw customer files entering a committed fixture,
> doc, prompt, or log — and **(2) a false-green** — a comparison harness or gate report that *reports*
> coverage/parity it does not actually prove, so the team cuts over on evidence that is a mirage. Both
> are amplified by the standing project reality that **no anonymized Lovable oracle exists yet**: every
> golden case in the repo today is `origin: "new-expected"` (there is nothing to diverge from), so 9.2/9.3
> introduce the **first real `documented-delta` / `old-lovable` origins in the codebase** — the moment the
> three-way origin discipline stops being theoretical.

---

## Executive Summary

**Scope:** Epic-level test design for Epic 9 — the epic that prepares the internal pilot to run the new
system *safely alongside* the Lovable oracle and its fallback, and produces the evidence to decide
cutover. Five stories:

- **9.1 Legacy Record Classification And Migration Runbook** — classify Lovable records (live / archive-only /
  excluded / deferred) and document a per-workflow migration runbook with fallback path and manual-backfill
  risks. Docs-first (`docs/migration/**`); **no production data mutation**.
- **9.2 Anonymized Lovable Fixture Capture** — capture anonymized oracle fixtures preserving business shape
  for CRM / settings / pricing / calculations / quotes / PDFs / acceptance / files / accepted-quote→job,
  with real PII/secrets/raw-files removed; local/test-oriented capture scripts; **committed-fixture privacy
  checks that FAIL on real PII/secret patterns**.
- **9.3 Golden-Master Comparison Harness For Core Workflow** — automated old/new comparison across calculation
  totals, VAT/tax blocks, options/tillval, hidden rows, quote-visible lines, PDF text/visual, attachment
  selection, acceptance transition, accepted price, job source refs; each delta **classified as expected
  simplification / bug / unresolved business assumption**; two-tenant RLS/storage negatives where a workflow
  touches tenant-owned data or files.
- **9.4 Pilot Fallback, Cutover, And Sign-Off Register** — formalize old-app fallback, cutover-by-workflow
  plan, rollback decision points, and the **sign-off register** (quote numbering, sent-event semantics,
  acceptance channels, adjusted-price policy, required files, VAT, ROT, grön teknik, rounding, quote terms,
  tax wording) each marked *signed-off* or *blocking real pilot use*; the checklist **blocks pilot cutover**
  for any workflow with an unresolved blocking assumption.
- **9.5 Phase A Acceptance Gate Report** — summarize every Phase A gate (clean install, typecheck, lint, unit,
  build, migration reset, command-integration, RLS/storage negatives, golden comparisons, fixture-privacy,
  skipped-gates-with-reasons); **scan the implemented surface to confirm NO deferred module leaked in**; list
  unresolved stop conditions with decision owners and block real pilot use where required.

**Epic goal (from epics.md):** Prepare the internal pilot to use the new system safely alongside the Lovable
oracle and fallback — classify, anonymize, compare, document deltas, and preserve fallback *before* real
cutover. **Explicit non-scope:** full historical migration, automated production sync from Lovable, copying
Lovable code, deferred-module data activation, and external beta operations.

**Why this epic is risk-bearing.** Epic 9 is the last gate before real-customer money moves through the new
system. Its unique hazards are not new product surface but the **integrity of the evidence** the business
will trust:

1. **Privacy across a docs+fixtures+prompts+logs plane.** For the first time the epic deliberately reaches
   into *real Lovable data* to derive fixtures and classification. NFR17 forbids real names/emails/phones/
   addresses/personnummer/orgnr/secrets/raw-customer-files in any committed artifact unless explicitly
   approved. A single leaked personnummer or a raw customer PDF in `tests/fixtures/golden/lovable/**` or a
   migration doc is a full privacy breach — and the ORGNR/personnummer scan the repo already runs over money
   fixtures must now cover the *whole* Lovable fixture set, not just öre numbers.
2. **Comparison honesty (representativeness + no-false-green).** The comparison harness is only as good as its
   ability to *fail loudly* on a real divergence. The project-context already flags two live representativeness
   traps the harness inherits: golden fixtures that pin **fictional warning codes** the real `ReadinessCode`
   union will never emit, and a coverage manifest that proves categories by **raw substring token** rather than
   a behaviorally-driven pin. A harness built on a fixture that green-passes against a code the system never
   emits is a mirage of parity. The runner-glob trap (a test outside `tests/unit/**` is *never executed* =
   vacuous-green) and the stale "RED PHASE / describe.skip" banner class both apply here.
3. **Unsigned assumptions reaching real use.** Every money/tax number in the system today is a *conservative
   pilot assumption* carrying `requiresSignOff: "pending-owner-accounting-legal"`. The tax working session
   (Sign-Off Blocks A/B/C: rounding, VAT rate, ROT/grön rates/caps/basis) and the migration/golden-example
   session (Sign-Off 8.1/8.2) are **still open (`möte`)**. The sign-off register (9.4) and the gate report
   (9.5) exist precisely to make cutover on any of these *impossible without an explicit decision* — while
   the demo-data-only owner decision (2026-07-03) keeps those same items **non-blocking for the demo track**.
4. **Over-migration / fallback erosion.** The classic migration failure — importing more history than needed,
   treating the Lovable schema as the new blueprint, or removing the old-app fallback before the pilot gates
   pass (NFR21/NFR22) — is an OPS/BUS risk the runbook + register must structurally prevent, with a hard
   "stop for owner clarification" rather than silent import.

**Risk Summary:**

- Total risks identified: **22**
- High-priority risks (score ≥6): **11**
- Critical (score 9 / auto-BLOCK): **0** — but **five controls are epic blockers regardless of numeric
  score** (see *Non-Negotiable Requirements*): (a) any real PII / secret / raw-customer-file in a committed
  fixture, doc, prompt, or log; (b) any comparison golden that green-passes against a value the system can
  never emit (representativeness); (c) any Phase A gate reported "pass" in 9.5 that did not actually run
  (false-green / skipped-without-reason); (d) real-pilot cutover approved while a blocking money/tax/
  immutability/acceptance/migration-classification assumption is unresolved; (e) any deferred module appearing
  in implemented scope (9.5 scope scan).
- Critical categories: **SEC/DATA** (fixture/doc privacy — the dominant class) → **BUS** (unsigned assumptions,
  over-migration, cutover-without-sign-off) → **TECH** (harness representativeness / vacuous-green) → **OPS**
  (fallback erosion, gate-report reproducibility).

**Coverage Summary:**

- P0 scenarios: **18** (~22-38 hours)
- P1 scenarios: **15** (~14-26 hours)
- P2/P3 scenarios: **12** (~6-14 hours)
- **Total effort:** ~42-78 hours (~1-2 weeks, one engineer, with the golden/RLS harness already in place)

> **Priority = risk/criticality, NOT execution timing.** P0/P1/P2/P3 below classify *how much a failure
> hurts*; when each test runs is governed by the separate **Execution Strategy** section (nearly everything
> runs in the existing PR gate).

---

## Not in Scope

| Item | Reasoning | Mitigation |
| ---- | --------- | ---------- |
| **Full historical Lovable migration / production data import** | Epic-9 explicit non-scope; owner decision demo-data-only (2026-07-03); real customer export is a hard STOP condition (9.1/9.2). | 9.1 runbook classifies + defers history; any real export halts for owner sign-off. No test attempts a production mutation. |
| **Automated production sync from Lovable / copying Lovable code** | Non-scope + AR26 (Lovable is oracle + fixture source only, no code copied by default). | Anonymized fixtures only (9.2); comparison compares *behavior*, not ported code (9.3). A source-scan can assert no Lovable-origin code path is imported. |
| **Deferred-module data activation** (Fortnox, supplier, AI, HR, rentals, assets/QR, DoU, tender/FKU, full RBAC, customer portal, broad doc center, broad admin analytics) | Deferred-scope; would violate Phase A boundary. | 9.5 scope scan actively *fails* if any deferred module surface is detected — this is a positive test, not just an omission. |
| **Real tax/money sign-off numbers** (exact rounding rule, VAT rate, ROT/grön rates/caps/basis) | Owner deferred to the tax working session (Sign-Off Blocks A/B/C `möte`); demo-data-only decision defers the session to post-MVP. | 9.4 register records each as *blocking real pilot use* (non-blocking for demo); the `requiresSignOff` framing already threads through every golden fixture. NOT re-approved by any Epic-9 test. |
| **BankID / portal signing, live email send, customer online-accept** | Already deferred (Sign-Off 5.3, Scope decision 3.4, Roadmap 6). | Register keeps them on the roadmap; no Epic-9 test asserts them. |
| **Performance / load SLA for the comparison harness or migration scripts** | No Phase A perf SLA; harness is offline/local and small. | Harness runs in the PR/db gate at unit/int scale; no perf tier needed (documented assumption). |

---

## Risk Assessment

**Scoring:** Probability (1 unlikely / 2 possible / 3 likely) × Impact (1 minor / 2 degraded / 3 critical);
score = P×I. 1-3 DOCUMENT, 4-5 MONITOR, 6-8 MITIGATE (CONCERNS at gate), 9 BLOCK (auto-FAIL).

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner | Timeline |
| ------- | -------- | ----------- | - | - | ----- | ---------- | ----- | -------- |
| R-901 | SEC/DATA | **Real PII/secret in a committed fixture.** A captured Lovable fixture (or its capture script output) retains a real personnummer, orgnr, email, phone, address, secret, or raw customer file (NFR17). Highest-impact risk in the epic; carried as an epic-blocker *control* regardless of numeric score. | 2 | 3 | **6** | Whole-fixture-set anonymization scan (generalize the existing money-pack scan: personnummer, orgnr 10-digit, non-`example.test` email, secret/password/api_key, SE phone, street-address heuristics) run over the DATA payload of EVERY committed Lovable fixture; scan is an epic blocker in CI. Capture scripts anonymize at source. | 9.2 | 9.2 |
| R-902 | SEC/DATA | **Real PII in a migration doc / prompt / log.** The 9.1 runbook or a capture-script log echoes a real customer name/number rather than a redacted example. | 2 | 3 | **6** | Runbook uses redacted/synthetic examples only; a docs-scan (same PII regexes) over `docs/migration/**` + committed logs; capture scripts log counts/ids, never raw values. | 9.1/9.2 | 9.1 |
| R-903 | TECH | **Comparison golden is a mirage — pins a value the system can never emit.** Fixture asserts a fictional warning code (`REQUIRES_SIGN_OFF`/`DEDUCTION_ESTIMATE_UNAPPROVED`) not in the real `ReadinessCode` union, so an old/new "match" proves nothing (project-context representativeness trap). | 3 | 2 | **6** | Every comparison code/enum value validated against the real exported union at harness build (fail the pack if a fixture pins an unknown code); align existing fictional-code fixtures as part of 9.3. | 9.3 | 9.3 |
| R-904 | TECH | **Vacuous-green harness.** A comparison test authored outside `tests/unit/**` (or left `describe.skip` / behind a `SURFACE_PRESENT` gate) never executes yet reads as green (runner-glob trap + stale-RED-PHASE-banner class). | 2 | 3 | **6** | Pin every comparison pin under `tests/unit/**` or the Vitest int glob; a manifest/count guard that fails if an expected comparison category has zero *executed* cases; grep-guard for `describe.skip`/`RED PHASE` banners on executing suites. | 9.3 | 9.3 |
| R-905 | BUS | **Cutover approved on an unresolved money/tax assumption.** Someone marks a real pilot workflow ready while Sign-Off Blocks A/B/C (rounding, VAT rate, ROT/grön rates/caps/basis) remain `möte`. | 2 | 3 | **6** | 9.4 sign-off register + a checklist validator that hard-BLOCKS cutover for any workflow whose blocking assumptions are not `signed-off`; traceable to the `requiresSignOff` markers already in the snapshots/goldens. | 9.4 | 9.4 |
| R-906 | BUS | **Delta silently misclassified.** A real old/new divergence (e.g. a hardcoded-25% Lovable gross vs the bp engine) is labelled "expected simplification" when it is actually a bug or an unresolved business assumption. | 2 | 3 | **6** | 9.3 forces every delta to a three-way `origin` (expected-simplification / bug / unresolved-assumption) with a non-empty note; a `documented-delta`/`old-lovable` case must carry the divergent old value it diverges from (extend the existing LABELLING guard to accept non-numeric/classification divergences). | 9.3 | 9.3 |
| R-907 | OPS/BUS | **Over-migration / Lovable-schema-as-blueprint.** Runbook imports more history than needed or treats Lovable schema as the new production blueprint (epic Risks). | 2 | 3 | **6** | 9.1 classification is mandatory-before-cutover (live/archive-only/excluded/deferred, NFR22); deferred-module records must NOT become Phase A tables/UI; runbook STOPS for owner clarification when scope is unclear (hard stop, not silent import). | 9.1 | 9.1 |
| R-908 | OPS | **Fallback removed before gates pass.** Old-app fallback (NFR21) is dropped for a workflow before its pilot acceptance gate is approved. | 2 | 3 | **6** | 9.4 runbook makes fallback documented+available per workflow until gates pass; the register/checklist blocks removing fallback while any blocking assumption is open. | 9.4 | 9.4 |
| R-909 | TECH/BUS | **Gate report false-green (skipped gate reported as pass).** 9.5 report claims a Phase A gate passed when it was skipped/absent (e.g. the storage-negative suite silently skipped when the storage stack was unreachable). | 2 | 3 | **6** | 9.5 must distinguish pass / fail / **skipped-with-reason**; a skipped mandatory gate without a reason fails the report; reconcile the report against the real CI gate list (`SUPABASE_TEST_REQUIRED=1` already forces the storage suite in CI). | 9.5 | 9.5 |
| R-910 | SEC/BUS | **Scope-scan miss lets a deferred module ship.** 9.5's implemented-surface scan fails to detect a deferred module (Fortnox/supplier/AI/…) that leaked in. | 2 | 3 | **6** | Positive scope scan over routes/nav/schema/commands driven by the deferred-module deny-list (reuse `deferred-categories.ts`); the scan itself is tested (a seeded deferred token must trip it). | 9.5 | 9.5 |
| R-911 | DATA/BUS | **Anonymization destroys the business shape it must preserve.** Over-anonymizing a fixture drops the very structure (calc rows, hidden-row flags, option selection, VAT posture, accepted-price delta) the comparison depends on, so the oracle is useless or wrong. | 2 | 3 | **6** | 9.2 fixture-schema validation asserts each category keeps its business shape (shape-guard mirrors the existing money-pack schema guard); STOP condition if anonymization cannot preserve required behavior (defer to owner). | 9.2 | 9.2 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner |
| ------- | -------- | ----------- | - | - | ----- | ---------- | ----- |
| R-912 | TECH | Comparison harness re-pins a value another golden already owns (duplicate numeric authority → two sources drift). | 2 | 2 | 4 | Reference existing money/calc/pdf/snapshot fixtures as the single authority per category; author fresh numbers only for genuinely-new comparison categories (project-context rule). | 9.3 |
| R-913 | TECH | `documented-delta` LABELLING guard requires a NUMERIC divergent value; a classification/section-mode delta (LOW_MARGIN, REQUIRED_FILES_DEFERRED, VAT posture) can't be expressed → forced to a bare number or fails schema (already ledgered from 5.5 review). | 2 | 2 | 4 | Widen the guard to a `number | classification-code` union when the first non-numeric Lovable delta is captured (this is the epic that captures it). | 9.3 |
| R-914 | SEC | ORGNR `\b\d{10}\b` privacy scan false-positives on a legitimate ≥10-digit öre/total in a Lovable quote fixture (large real quotes) — a real value trips a spurious PII flag, OR the scan is loosened and misses a real orgnr. | 2 | 2 | 4 | Scope the orgnr scan to string-typed leaves / exclude known numeric öre keys (ledgered hardening) rather than loosening the guard; document the constraint in the fixture author-note. | 9.2 |
| R-915 | DATA | Migration integration cases mutate/read tenant-owned data without the two-tenant RLS/storage negative (9.3 AC3) where a workflow touches tenant data or files. | 2 | 2 | 4 | Any 9.3 integration comparison that touches a tenant-owned table/file MUST enroll in `TENANT_TABLES` + include cross-tenant list/read/sign/spoof negatives (standing Epics 3-9 harness contract). | 9.3 |
| R-916 | OPS | 9.5 acceptance report is not reproducible — depends on a local-only state, so a re-run yields a different verdict. | 1 | 3 | 3 | Report is generated from the deterministic CI gate outputs + committed evidence; document its inputs; where automated, add a report-generation test. | 9.5 |
| R-917 | BUS | Sign-off register drifts from the system-of-record (`owner-signoff-questions.md`) — two lists disagree on what's blocking. | 2 | 2 | 4 | 9.4 register references `owner-signoff-questions.md` as the single source; a traceability check that every blocking question ID appears in the register with a decision status. | 9.4 |
| R-918 | TECH | Capture scripts require global/system changes or aren't repeatable (9.2 AC2), so a future re-capture can't reproduce the fixtures. | 1 | 2 | 2 | Scripts are local/test-oriented, documented, repeatable, no global changes; a lightweight golden-loader test proves a captured fixture round-trips. | 9.2 |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | P | I | Score | Action |
| ------- | -------- | ----------- | - | - | ----- | ------ |
| R-919 | OPS | Migration assets land outside the approved locations (`tests/fixtures/golden/lovable/**`, `tests/golden/**`, `docs/migration/**`, `scripts/migration/**`) — AR25. | 1 | 2 | 2 | Monitor — a path convention check; not a security risk, a hygiene one. |
| R-920 | BUS | 9.5 report over-claims completeness (lists PRD AC1-AC22 as "met" beyond what tests prove). | 1 | 2 | 2 | Monitor — report cites evidence per AC; manual review against quality gates. |
| R-921 | TECH | Golden coverage manifest asserts a category by raw substring token (incidental prose match), overstating coverage (standing ledgered weakness the harness inherits). | 1 | 2 | 2 | Monitor — prefer a structured per-category key match; already a standing golden-hardening item, don't regress it in 9.3. |
| R-922 | OPS | 9.1/9.4 docs go stale (reference plan positions instead of architecture sections; evergreen-doc staleness rule). | 1 | 1 | 1 | Monitor — reference architecture §-anchors, not "Epic N / Story X-Y". |

### Risk Category Legend

- **TECH** — harness correctness, representativeness, vacuous-green, duplicate authority
- **SEC** — privacy leakage of real PII/secrets/customer files; RLS/storage isolation on comparison integration
- **PERF** — n/a for Epic 9 (offline/local, small scale; no Phase A SLA)
- **DATA** — anonymization destroying business shape; migration-integration data integrity
- **BUS** — cutover on unsigned assumptions, over-migration, misclassified deltas, register drift, over-claim
- **OPS** — fallback erosion, gate-report reproducibility, asset-location hygiene, doc staleness

---

## Entry Criteria

- [ ] Epics 1-8 are `done` and green on the full Phase A gate (they are) — the new-side behavior to compare exists.
- [ ] The existing golden-master infra is available as the 9.2/9.3 foundation: `tests/fixtures/golden/**`,
      the `node --test` + Vitest split, the two-tenant RLS/storage negative harness, the money-pack anonymization scan.
- [ ] The local Supabase CLI stack is reachable for 9.3 DB-backed comparison integration cases (`SUPABASE_TEST_REQUIRED=1` in CI).
- [ ] `owner-signoff-questions.md` is current as the sign-off system-of-record (it is; 2026-06-18 reply logged).
- [ ] **Owner input available where a STOP condition fires** — a real Lovable capture selection (Sign-Off 8.1/8.2)
      and any anonymization that can't preserve business shape require owner clarification (these are `möte`-open;
      the demo-data-only decision keeps them non-blocking for the demo track but they gate real-pilot cutover).

## Exit Criteria

- [ ] All P0 tests passing (fixture-privacy scans, comparison correctness + delta classification, gate-report honesty, scope scan).
- [ ] All P1 tests passing or failures triaged.
- [ ] **Zero** real PII / secret / raw-customer-file in any committed fixture, doc, prompt, or log (epic blocker).
- [ ] Every comparison golden validated against the real exported enum/union (no fictional codes).
- [ ] The sign-off register (9.4) marks every blocking assumption `signed-off` or `blocking`, and the checklist
      demonstrably BLOCKS cutover for any workflow with an open blocking item.
- [ ] The 9.5 gate report reconciles 1:1 with the real CI gate list, distinguishes pass/fail/skipped-with-reason,
      and its deferred-scope scan trips on a seeded deferred token.
- [ ] No open high-priority (≥6) risk unmitigated (or an explicit, owner-approved waiver recorded).

## Project Team

| Name | Role | Testing Responsibilities |
| ---- | ---- | ------------------------ |
| Rasmus | Implementation lead / QA | Authors 9.1-9.5, the fixture-privacy + comparison + gate-report + scope-scan tests; owns the register traceability. |
| Owner (co-owner) | Business / accounting decisions | Resolves Sign-Off Blocks A/B/C (tax) + 8.1/8.2 (migration classification, golden-example selection); approves any real Lovable capture; signs cutover per workflow. |

---

## Test Coverage Plan

> P0/P1/P2/P3 = **priority / risk**, not execution timing (see Execution Strategy). Test levels favour the
> **Unit** gate (deterministic, offline, fast) for docs/fixture/report validators and golden comparisons, and
> **Integration** only where a comparison touches tenant-owned data/files (RLS/storage negatives). E2E is
> reserved for the near-zero net-new UI (there is essentially none in this epic).

### P0 (Critical)

**Criteria:** Blocks core evidence-integrity + high risk (≥6) + no workaround (a leaked-PII fixture, a mirage
golden, a false-green gate report, or a cutover-on-unsigned-assumption cannot be caught any other way).

| ID | Requirement (Story · AC) | Test Level | Risk Link | Count | Owner | Notes |
| -- | ------------------------ | ---------- | --------- | ----- | ----- | ----- |
| 9.2-PRIV-01 | Whole-fixture-set anonymization scan fails on real personnummer/orgnr/email/secret/phone/address in ANY committed Lovable fixture DATA (9.2 AC3) | Unit | R-901,R-914 | 6 | QA | Generalize the money-pack scan over `tests/fixtures/golden/lovable/**`; scan DATA payload separately from `_doc` prose; each PII class its own assertion. |
| 9.2-PRIV-02 | Raw customer files / secrets are removed-or-replaced in every fixture unless explicitly approved (9.2 AC1) | Unit | R-901 | 2 | QA | Assert no raw binary/base64 customer file blob; approved exceptions carry an explicit marker. |
| 9.1-PRIV-03 | Migration runbook + committed capture logs contain no real PII (9.1 tech note, R-902) | Unit | R-902 | 2 | QA | Docs-scan (same regexes) over `docs/migration/**` + committed logs; redacted/synthetic examples only. |
| 9.2-SHAPE-01 | Every captured category preserves business shape for CRM/settings/pricing/calc/quotes/PDF/acceptance/files/job (9.2 AC1) | Unit | R-911 | 3 | QA | Schema-shape guard mirroring the money-pack contract guard; a half-authored/over-anonymized fixture fails loud. |
| 9.3-CMP-01 | Golden comparison covers calc totals + VAT/tax blocks + options/tillval + hidden rows across old/new (9.3 AC1) | Unit | R-903,R-904,R-912 | 4 | QA | Drive the REAL engine as the new-side oracle; reference existing money/calc fixtures as single authority; NO re-pin. |
| 9.3-CMP-02 | Golden comparison covers quote-visible lines + PDF text/visual + attachment selection (9.3 AC1) | Unit | R-903,R-904 | 3 | QA | Reuse the 6.3 text-extraction golden pattern; leakage-sensitive PDF cases carry a NON-EMPTY `mustNotAppear`. |
| 9.3-CMP-03 | Golden comparison covers acceptance transition + accepted price + job source references (9.3 AC1) | Unit | R-903,R-906 | 3 | QA | Reuse the 7.2 accept→job golden + accepted-price-delta fixture; delta recomputed via the bp engine (explainable). |
| 9.3-DELTA-01 | Every comparison delta is classified expected-simplification / bug / unresolved-assumption with a non-empty note; `documented-delta`/`old-lovable` carries the divergent old value (9.3 AC2) | Unit | R-906,R-913 | 3 | QA | The FIRST real `documented-delta`/`old-lovable` origins in the repo; widen LABELLING guard to `number \| classification-code`. |
| 9.3-VALID-01 | Every comparison code/enum value validated against the real exported union (no fictional `ReadinessCode`) (representativeness) | Unit | R-903 | 2 | QA | Align the fictional-code fixtures (`REQUIRES_SIGN_OFF`/`DEDUCTION_ESTIMATE_UNAPPROVED`) to the real `ReadinessCode` union as part of 9.3. |
| 9.5-GATE-01 | Acceptance-gate report distinguishes pass / fail / **skipped-with-reason** and fails on a skipped mandatory gate without a reason (9.5 AC1) | Unit | R-909 | 3 | QA | Report generated from deterministic CI gate outputs; reconciles 1:1 with the real gate list. |
| 9.5-SCOPE-01 | Implemented-surface scan CONFIRMS no deferred module leaked in AND trips on a seeded deferred token (9.5 AC2) | Unit | R-910 | 3 | QA | Positive test: seed a `fortnox`/`supplier`/… token → scan must fail; reuse `deferred-categories.ts` deny-list. |
| 9.4-BLOCK-01 | Sign-off checklist BLOCKS real-pilot cutover for any workflow with an unresolved blocking assumption (9.4 AC3) | Unit | R-905,R-908 | 2 | QA | Checklist validator: an open blocking money/tax/immutability/acceptance/migration-classification item → cutover blocked; demo track stays non-blocking. |

**Total P0:** ~18 scenario groups / ~36 cases, ~22-38 hours.

### P1 (High)

**Criteria:** Important evidence completeness + medium risk (3-4) + common workflows.

| ID | Requirement (Story · AC) | Test Level | Risk Link | Count | Owner | Notes |
| -- | ------------------------ | ---------- | --------- | ----- | ----- | ----- |
| 9.1-CLASS-01 | Each selected record group is classified live / archive-only / excluded / deferred; deferred records do NOT become Phase A tables/UI (9.1 AC1) | Unit | R-907 | 3 | QA | Classification-checklist validator over the runbook; a deferred group mapped to a live table fails. |
| 9.1-RUNBOOK-01 | Runbook documents source records, target treatment, fallback path, manual-backfill risks, cutover-by-workflow (9.1 AC2) | Unit | R-907,R-908 | 2 | QA | Docs-structure validator (required sections present + non-empty). |
| 9.1-STOP-01 | Runbook STOPS for owner clarification when scope is unclear rather than silently importing extra history (9.1 AC3) | Unit | R-907 | 2 | QA | A "scope-unclear" marker in the runbook maps to a STOP, not a default-import. |
| 9.3-RLS-01 | Comparison integration cases that touch tenant data/files include two-tenant RLS/storage negatives (9.3 AC3) | Integration | R-915 | 4 | QA | Enroll any touched table in `TENANT_TABLES`; cross-tenant list/read/sign/spoof negatives (standing harness contract). |
| 9.2-REPEAT-01 | Capture scripts are local/test-oriented, documented, repeatable, no global changes; a captured fixture round-trips via the golden loader (9.2 AC2) | Unit | R-918 | 2 | QA | Lightweight golden-loader test proving re-capture reproducibility. |
| 9.4-REG-01 | Sign-off register marks quote numbering / sent semantics / acceptance channels / adjusted-price / required files / VAT / ROT / grön / rounding / terms / tax wording as signed-off or blocking (9.4 AC2) | Unit | R-917 | 3 | QA | Traceability: every blocking question ID from `owner-signoff-questions.md` appears with a decision status. |
| 9.5-EVID-01 | Report summarizes clean install / typecheck / lint / unit / build / migration reset / command-int / RLS-storage negatives / golden comparisons / fixture-privacy / skipped-gates-with-reasons (9.5 AC1) | Unit | R-909,R-916 | 3 | QA | Report inputs are the deterministic gate outputs; reproducible. |

**Total P1:** ~15 scenario groups / ~19 cases, ~14-26 hours.

### P2 (Medium)

**Criteria:** Secondary evidence + low risk (1-2) + edge cases.

| ID | Requirement | Test Level | Risk Link | Count | Owner | Notes |
| -- | ----------- | ---------- | --------- | ----- | ----- | ----- |
| 9.5-READY-01 | Report lists unresolved stop conditions with owner/accounting/legal/security decision owners (9.5 AC3) | Unit | R-920 | 2 | QA | Every open Sign-Off item carries a named decision owner. |
| 9.4-FALLBACK-01 | Runbook documents old-app fallback + rollback decision points per workflow (9.4 AC1) | Unit | R-908 | 2 | QA | Docs-structure validator. |
| 9.2-ORGNR-01 | ORGNR scan scoped to string leaves / excludes numeric öre keys so a legitimate large öre value can't trip a spurious PII flag (R-914 hardening) | Unit | R-914 | 2 | QA | Ledgered hardening — apply as 9.2 touches the scan. |
| 9.3-MANIFEST-01 | Comparison coverage manifest proves each category by a structured key match, not a raw substring token (R-921 hardening) | Unit | R-921 | 2 | QA | Don't regress the standing golden-manifest weakness in 9.3. |

**Total P2:** ~8 cases, ~4-9 hours.

### P3 (Low)

**Criteria:** Nice-to-have + hygiene + exploratory.

| ID | Requirement | Test Level | Count | Owner | Notes |
| -- | ----------- | ---------- | ----- | ----- | ----- |
| 9.x-PATH-01 | Migration/comparison assets live only in approved locations (AR25) | Unit | 2 | QA | Path-convention check. |
| 9.x-DOC-01 | Evergreen 9.1/9.4 docs reference architecture §-anchors, not plan positions (staleness rule) | Manual/Unit | 1 | QA | Lightweight grep or review. |
| 9.5-VISUAL-01 | PDF visual/pixel comparison (9.3 PDF category) is stability-only and NEVER gates | Unit | 1 | QA | Mirror the 6.3-GOLDEN-02 non-gating posture. |

**Total P3:** ~4 cases, ~2-5 hours.

---

## Execution Order (Priority View)

> This is the *priority/risk* ordering for authoring and triage. Actual CI timing is in **Execution Strategy**.

### Smoke (<2 min) — author first, fail fast
- [ ] 9.2-PRIV-01 fixture-set anonymization scan (any leaked PII → immediate hard fail)
- [ ] 9.5-SCOPE-01 deferred-module scope scan (seeded token trips it)
- [ ] 9.3-VALID-01 no-fictional-code validation

### P0 (<8 min)
- [ ] Fixture privacy + shape (9.2-PRIV-01/02, 9.1-PRIV-03, 9.2-SHAPE-01)
- [ ] Golden comparison correctness + delta classification (9.3-CMP-01/02/03, 9.3-DELTA-01)
- [ ] Gate-report honesty + cutover-block (9.5-GATE-01, 9.4-BLOCK-01)

### P1 (<20 min)
- [ ] Classification/runbook/register validators (9.1-CLASS-01, 9.1-RUNBOOK-01, 9.1-STOP-01, 9.4-REG-01)
- [ ] Repeatability + evidence summary (9.2-REPEAT-01, 9.5-EVID-01)
- [ ] Comparison RLS/storage negatives (9.3-RLS-01) — DB-backed (db job)

### P2/P3 (<10 min)
- [ ] Readiness/fallback docs, orgnr+manifest hardening, path/doc hygiene, non-gating visual.

---

## Resource Estimates

| Priority | Count (groups) | Hours/group (range) | Total Hours | Notes |
| -------- | -------------- | ------------------- | ----------- | ----- |
| P0 | 12 | 1.5-3 | ~22-38 | Fixture scans + golden comparison + report honesty; reuses existing scan/golden/RLS scaffolding. |
| P1 | 7 | 1.5-3 | ~14-26 | Docs/register validators + repeatability + one DB-backed RLS negative set. |
| P2 | 4 | 1-2 | ~4-9 | Ledgered hardening + docs validators. |
| P3 | 3 | 0.5-1.5 | ~2-5 | Hygiene / non-gating. |
| **Total** | **26** | **-** | **~42-78** | **~1-2 weeks, one engineer** (harness/goldens/RLS already exist). |

### Prerequisites

**Test Data / Fixtures**
- Anonymized Lovable oracle fixtures under `tests/fixtures/golden/lovable/**` (9.2 output) — the FIRST fixtures
  carrying real `old-lovable` / `documented-delta` origins.
- Reuse existing single-authority fixtures (money / calc / quote-pdf / snapshot / file) — reference, never re-pin.
- The two-tenant factory + RLS/storage negative harness (`TENANT_TABLES`, `tests/factories/**`) for 9.3-RLS-01.

**Tooling**
- `node --test` (unit golden + doc/fixture validators) + Vitest (DB-backed comparison integration) — the existing split.
- The anonymization scan regex set (personnummer / orgnr / email / secret / phone / address) — generalized from the money pack.
- `deferred-categories.ts` deny-list for the 9.5 scope scan.

**Environment**
- Local Supabase CLI stack for 9.3-RLS-01 (`SUPABASE_TEST_REQUIRED=1` in CI forces it; local-only, never shared/prod).
- **No external service, no real Lovable connection in CI** — fixtures are captured locally/offline and committed anonymized.

---

## Quality Gate Criteria

### Pass/Fail Thresholds
- **P0 pass rate:** 100% (no exceptions).
- **P1 pass rate:** ≥95% (waivers required for failures, triaged).
- **P2/P3 pass rate:** ≥90% (informational).
- **High-risk (≥6) mitigations:** 100% complete or an explicit owner-approved waiver.

### Coverage Targets
- **Fixture-privacy scan:** 100% of committed Lovable fixtures + migration docs + committed logs.
- **Comparison categories:** 100% of the nine 9.3 AC1 categories represented AND behaviorally driven (no substring-only "coverage").
- **Deferred-scope scan:** 100% of the deny-list surfaces (routes/nav/schema/commands).
- **Sign-off register:** 100% of blocking question IDs from `owner-signoff-questions.md` mapped to a decision status.

### Non-Negotiable Requirements (epic blockers — hold regardless of numeric score)
- [ ] **Zero** real PII / secret / raw-customer-file in any committed fixture, doc, prompt, or log (R-901/R-902).
- [ ] **No mirage golden** — every comparison code/enum validated against the real exported union (R-903).
- [ ] **No false-green gate** — no Phase A gate reported "pass" in 9.5 that did not actually run (R-909); no vacuous-green comparison (R-904).
- [ ] **No cutover on an open blocking assumption** — the 9.4 checklist blocks real-pilot cutover for any unresolved money/tax/immutability/acceptance/migration-classification item (R-905/R-908).
- [ ] **No deferred module in implemented scope** — 9.5 scope scan trips on any deferred-module surface (R-910).

---

## Mitigation Plans

### R-901: Real PII/secret in a committed fixture (effective 8 — treated as epic blocker)
**Strategy:** (1) Generalize the existing money-pack anonymization scan into a shared scanner run over the DATA
payload of EVERY committed Lovable fixture (personnummer, orgnr 10-digit, non-`example.test` email,
secret/password/api_key, SE phone, street-address). (2) Capture scripts anonymize at source and never emit raw
values to disk/logs. (3) The scan is a CI epic-blocker (fail the build on any hit). (4) Approved exceptions
carry an explicit marker so "unless explicitly approved" is auditable, not implicit.
**Owner:** 9.2 · **Timeline:** 9.2 · **Status:** Planned · **Verification:** 9.2-PRIV-01/02 green; a seeded
personnummer/orgnr/secret in a test fixture fails the scan.

### R-903 / R-904: Comparison mirage + vacuous-green (score 6 each)
**Strategy:** (1) Validate every comparison code/enum against the real exported union at pack build — a fixture
pinning an unknown code fails the pack (align the known fictional-code fixtures as part of 9.3). (2) Pin every
comparison under `tests/unit/**` (or the Vitest int glob) so nothing is silently un-run; a manifest/count guard
fails when a category has zero *executed* cases. (3) Grep-guard bans `describe.skip` / "RED PHASE" banners on
executing suites. (4) Drive the REAL new-side engine as the oracle (live comparison, not static schema).
**Owner:** 9.3 · **Timeline:** 9.3 · **Status:** Planned · **Verification:** 9.3-VALID-01 + 9.3-CMP-* green;
a fixture with a bogus code fails; a `describe.skip`'d pin trips the guard.

### R-905 / R-908: Cutover on unsigned assumption / fallback erosion (score 6 each)
**Strategy:** (1) 9.4 sign-off register references `owner-signoff-questions.md` as system-of-record and marks
every blocking assumption `signed-off` / `blocking`. (2) A checklist validator hard-BLOCKS real-pilot cutover
for any workflow with an open blocking money/tax/immutability/acceptance/migration-classification item, and
blocks removing fallback while any blocking item is open. (3) Demo track stays explicitly non-blocking
(2026-07-03 owner decision), so the two tracks never conflate.
**Owner:** 9.4 · **Timeline:** 9.4 · **Status:** Planned · **Verification:** 9.4-BLOCK-01 green; a seeded open
blocking item blocks cutover; the demo track remains unblocked.

### R-909 / R-910: Gate-report false-green + scope-scan miss (score 6 each)
**Strategy:** (1) 9.5 report distinguishes pass / fail / **skipped-with-reason**; a skipped mandatory gate
without a reason fails the report; the report reconciles 1:1 against the real CI gate list. (2) The
implemented-surface scan is driven by the deferred-module deny-list and is itself tested — a seeded deferred
token must trip it (positive test, not mere omission).
**Owner:** 9.5 · **Timeline:** 9.5 · **Status:** Planned · **Verification:** 9.5-GATE-01 + 9.5-SCOPE-01 green;
a skipped-without-reason gate fails the report; a seeded `fortnox` token fails the scope scan.

---

## Assumptions and Dependencies

### Assumptions
1. **Demo-data-only through MVP (owner decision 2026-07-03).** The tax/terms sign-off working session is
   deferred to post-MVP; Epic 9 tests keep the `requiresSignOff` framing and mark tax/migration sign-offs as
   *blocking real-pilot use* but *non-blocking for the demo track*. Re-open if real-customer use is proposed.
2. **No anonymized Lovable oracle exists yet** — every current golden is `origin: "new-expected"`. 9.2/9.3
   introduce the first real `old-lovable` / `documented-delta` origins; the LABELLING/schema guards already
   accommodate the three-way origin so a real delta lands without a code-shape change (widen the numeric-only
   guard to `number | classification-code` when the first non-numeric delta is captured).
3. **The comparison harness is offline/local and small** — no Phase A perf SLA; it runs in the PR/db gate at
   unit/int scale, no nightly/weekly tier.
4. **Lovable is oracle + fixture source only (AR26)** — no Lovable code is copied; comparisons compare behavior.
5. **The existing security harness is a standing contract (Epics 3-9)** — any tenant-owned table touched by a
   9.3 integration comparison enrolls in `TENANT_TABLES` before merge.

### Dependencies
1. **Epics 1-8 done + green** — required (satisfied) for the new-side behavior to compare.
2. **Owner clarification for real Lovable capture** (Sign-Off 8.1/8.2 `möte`) — required *only* if a real
   (vs synthetic-representative) capture is proposed; a STOP condition otherwise.
3. **Local Supabase stack** — required for 9.3-RLS-01 (CI provides it; `SUPABASE_TEST_REQUIRED=1`).
4. **`owner-signoff-questions.md`** — the 9.4 register's single source of truth.

### Risks to Plan
- **Risk:** Real Lovable capture selection stays `möte`-open, so 9.2 can only ship synthetic-representative
  fixtures (no *real* `old-lovable` numbers). **Impact:** the three-way origin machinery ships exercised by
  synthetic cases; a real delta lands later without a code change. **Contingency:** author `new-expected` +
  synthetic `documented-delta` cases now (the guards prove the discipline); backfill real `old-lovable`
  numbers when the owner selects the golden examples — no schema change needed.
- **Risk:** Over-anonymization destroys business shape (R-911). **Impact:** the oracle is useless.
  **Contingency:** STOP for owner sign-off (9.2 stop condition) rather than shipping a wrong-shape fixture.

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests for the highest-risk scenarios (fixture-privacy scan, comparison
  correctness + delta classification, gate-report honesty, scope scan) — separate workflow, not auto-run.
- Run `*automate` for the remaining coverage once 9.2/9.3 machinery exists.
- Risk assessment here feeds the `*trace` / `*nfr` / `*test-review` epic-boundary gates for Epic 9.

---

## Approval

**Test Design Approved By:**
- [ ] Product Manager / Owner: ______ Date: ______ (also gates Sign-Off Blocks A/B/C + 8.1/8.2)
- [ ] Tech Lead: Rasmus Date: 2026-07-07
- [ ] QA Lead: Rasmus Date: 2026-07-07

**Comments:** Draft — all stories `backlog`. The two executable stories (9.2 fixture capture, 9.3 comparison
harness) carry the epic's real risk; 9.1/9.4/9.5 are decision/evidence artifacts validated by checklist +
traceability + a fixture-privacy scan. Every P0 exists to make an *evidence mirage* impossible.

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| ----------------- | ------ | ---------------- |
| **`@/lib/money` engine (Epic 4)** | 9.3 drives it as the new-side oracle | Existing money/tax golden pins must stay green; 9.3 references, never re-pins. |
| **Calc / quote-snapshot / quote-PDF (Epics 5-6)** | 9.3 compares totals, readiness codes, quote-visible lines, PDF text | The `ReadinessCode` union alignment (R-903) touches the existing fictional-code fixtures — align, don't fork; 6.3 text-golden `mustNotAppear` discipline preserved. |
| **accept→job + accepted-immutability (Epic 7)** | 9.3 compares acceptance transition, accepted price, job source refs | Accepted-lock (`AR704`) + accept-and-create-job atomicity must stay green; 9.3 reuses the 7.2 golden. |
| **File storage + locks (Epic 8)** | 9.3 attachment-selection comparison + 9.2 raw-file anonymization | `FL823` lock family + storage-object isolation must stay green; 9.2 must NOT commit any raw customer file. |
| **RLS/storage negative harness + `TENANT_TABLES` (Epics 2-8)** | 9.3-RLS-01 extends it to comparison integration | Any touched table enrolled before merge; cross-tenant negatives stay green (standing contract). |
| **Deferred-module deny-list (`deferred-categories.ts`)** | 9.5 scope scan consumes it | The deny-list module stays out of the token-scanned surfaces (existing R-816 arrangement). |
| **CI gate chain (`ci.yml`)** | 9.5 report reconciles against it | Report must track the real gate list; a new gate added to CI must appear in the report. |

---

## Appendix

### Knowledge Base References
- `risk-governance.md` — risk classification framework
- `probability-impact.md` — P×I scoring (1-9; 6-8 MITIGATE, 9 BLOCK)
- `test-levels-framework.md` — Unit vs Integration vs E2E selection (favour Unit here; Integration only for RLS/storage negatives)
- `test-priorities-matrix.md` — P0-P3 (security/compliance/data-integrity → P0; risk-score alignment)

### Related Documents
- Epic: `_bmad-output/planning-artifacts/epics.md` (Epic 9, stories 9.1-9.5, lines 1755-1938)
- PRD: `_bmad-output/planning-artifacts/prd.md` (FR55-59; NFR17/21/22/32/37/38/39; AC1-AC22)
- Sign-off register system-of-record: `_bmad-output/planning-artifacts/owner-signoff-questions.md`
- Project context: `_bmad-output/project-context.md` (Lovable Oracle Policy; Testing Rules; Security Harness Rules; demo-data-only decision)
- Consolidation inputs: `_bmad-output/implementation-artifacts/deferred-work.md`
- Prior epic designs (house style): `test-design-epic-7.md`, `test-design-epic-8.md`
- Existing golden infra: `tests/fixtures/golden/**`; `tests/unit/**/*golden*.test.ts`; anonymization scan in `tests/unit/lib/money/golden-pack.test.ts`

---

**Generated by:** BMad TEA Agent — Test Architect Module
**Workflow:** `bmad-testarch-test-design` (epic-level, Phase 4)
**Version:** 4.0 (BMad v6)
