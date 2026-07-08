---
stepsCompleted:
  - step-01-load-context
  - step-02-define-thresholds
  - step-03-gather-evidence
  - step-04-evaluate-and-score
  - step-04e-aggregate-nfr
  - step-05-generate-report
lastStep: step-05-generate-report
lastSaved: '2026-07-08'
workflowType: testarch-nfr-assess
assessmentLevel: epic
epicNum: 9
executionMode: sequential
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-9.md (22 risks R-901..R-922; 11 high-priority ≥6; 5 non-negotiable epic controls; P0-P3 coverage plan; PERF explicitly N/A — offline/local, no Phase A SLA)
  - _bmad-output/test-artifacts/traceability/epic-9-traceability-report.md (gate PASS; P0 100% 8/8, P1 100% 6/6, P2 100% 1/1, overall 100% 16/16; live unit gate 1371 pass / 0 fail / 0 skipped / 0 todo / 86 suites; epic-9 subset 121 pass / 0 skipped)
  - _bmad-output/test-artifacts/nfr-assessment-epic-8.md (format + the single standing CONCERNS carried since Epic 2; pnpm audit gate resolved Epic 6)
  - _bmad-output/planning-artifacts/epics.md (Epic 9, Stories 9.1-9.5, lines 1755-1938; FR55-59; NFR17/21/22/32/37/38/39; AR25/AR26)
  - _bmad-output/auto-bmad/state/epic/epic-9.yaml (5 stories landed 9.1-9.5; auto_decisions all defer/dismiss Low; gate_decision PASS)
  - _bmad-output/implementation-artifacts/9-1..9-5 story files (all five `review`; all tasks [x]; Review Findings resolved/dispositioned; the leaked real SAAB orgnr removed in 9.5 code review)
  - _bmad-output/implementation-artifacts/deferred-work.md (Epic-9 residuals: 9.2 approved-PII-exception marker, 9.3 shallow attachment coverage + one-armed classifyDelta, 9.4/9.5 per-item register traceability strictness — all Low, owner-gated / test-hardening, none gating)
  - tests/support/anonymization-scan.ts (the SHARED PII/secret scanner — ported byte-exact from the money-pack scan, NOT loosened; PERSONNUMMER/ORGNR/NON_EXAMPLE_EMAIL/SECRET/PHONE/ADDRESS + RAW_FILE_BLOB; ORGNR + RAW_FILE_BLOB string-leaf-scoped R-914 hardening; scanFixtureData + assertNoPii + glob backstop + explicit 8-fixture manifest)
  - scripts/migration/lovable-capture.ts (deterministic, pure, I/O-free anonymizeRecord — anonymize AT SOURCE; secrets DROPPED not masked; captureLog counts/ids only; connects to NOTHING; SYNTHETIC-input-only STOP; real capture owner-gated 8.1/8.2 möte) + scripts/migration/README.md
  - tests/fixtures/golden/lovable/*.json (8 anonymized oracle fixtures — first old-lovable/documented-delta origins in the repo; readinessWarnings pin ONLY real ReadinessCode union members; every öre < 10 digits orgnr-scan-safe; ZERO PII)
  - tests/unit/docs/sign-off-checklist-model.ts (evaluateCutover — pure guard: real-pilot ANY open blocking item → BLOCKS cutover AND fallback removal with traceable blockedBy; demo track non-blocking by construction, never conflated)
  - src/features/files/deferred-categories.ts (FORBIDDEN_DEFERRED_CATEGORIES deny-list the 9.5 scope scan consumes) ; src/features/calculations/readiness.ts (the real ReadinessCode union the fixtures/goldens validate against)
  - tests/unit/fixtures/golden/lovable/*.test.ts (scanner/shape/loader + comparison/delta/guard suites) + tests/unit/docs/*.test.ts (9.1/9.4/9.5 docs-invariant validators + models)
  - docs/migration/{legacy-record-classification,migration-runbook,pilot-fallback-cutover,phase-a-acceptance-gate}.md (the four Epic-9 decision/evidence docs under test)
  - .github/workflows/ci.yml (verify job: pnpm audit --audit-level=high BLOCKING at :72; source + built-bundle service-role containment :74/:94; db job SUPABASE_TEST_REQUIRED=1 :113; e2e job :196; no c8/coverage step) + package.json scripts (test:unit/test:int/test:e2e/verify:*)
  - knowledge: adr-quality-readiness-checklist.md, ci-burn-in.md, test-quality.md, error-handling.md, playwright-config.md
---

# NFR Assessment - Epic 9: Migration, Coexistence, Golden Masters, And Pilot Readiness

**Date:** 2026-07-08
**Epic:** 9 (Stories 9.1-9.5) — the **readiness / evidence** epic that prepares the internal pilot to run the new system safely *alongside* the Lovable oracle and its fallback: **legacy-record classification + a per-workflow migration runbook** (9.1 — docs-first, no production data mutation); **anonymized Lovable fixture capture** with committed-fixture privacy scans that FAIL on real PII/secrets/raw-files (9.2 — the first `old-lovable`/`documented-delta` origins in the repo); the **golden-master comparison harness** driving the REAL engine as the new-side oracle with three-way delta classification (9.3); the **pilot fallback / cutover-by-workflow runbook + sign-off register** with an executable cutover-BLOCK guard (9.4); and the **Phase A acceptance-gate report** with a false-green-proof gate honesty model + deferred-module scope scan (9.5).

**Overall Status:** PASS (advisory) ✅ — with **one** remaining standing forward-looking CONCERNS (no line-coverage reporter — LOW, carried since Epic 2). Runtime performance/load, availability/DR/MTTR remain deferred N/A for Phase A — and for Epic 9 uniquely, PERF is **N/A by design** (the whole epic is offline/local docs + fixture + comparison machinery, no runtime surface, no Phase A SLA; test-design R-920/"Not in Scope" records this explicitly). The `pnpm audit --audit-level=high` gate remains present and blocking (`.github/workflows/ci.yml:72`); Epic 9 adds **no new runtime dependency** (the scanner/anonymizer/comparison/validators are pure TypeScript test assets under `tests/**` + `scripts/migration/**`; no `src/**` product code, no migration, no package), so it needs no extension and stays green.

---

Note: This assessment summarizes existing evidence; it does not re-run the whole CI matrix. The Epic 9 recorded suite state was **re-verified live this session** — `pnpm run test:unit` = **1371 pass / 0 fail / 0 skipped / 0 todo / 86 suites** (matching the epic-9 traceability record byte-for-byte); the Epic-9 subset (golden/lovable comparison + docs validators) = **121 pass / 0 skipped** per the same report. The standing INT/RLS/STORAGE-NEG/E2E gates are CI-gated (`SUPABASE_TEST_REQUIRED=1`) and unaffected — Epic 9 touches **no tenant-owned table, no storage object, no route** (9.3-AC3 satisfied-by-non-applicability). Several load-bearing source-level claims were re-verified directly for this audit: the shared `anonymization-scan.ts` is ported byte-exact from the money-pack scan and NOT loosened (ORGNR/RAW_FILE_BLOB string-leaf-scoped so a legit ≥10-digit öre does not false-positive, while a real string orgnr still trips); `scripts/migration/lovable-capture.ts` anonymizes AT SOURCE, DROPS secrets (never masks in place), logs counts/ids only, and connects to nothing; `evaluateCutover` in `sign-off-checklist-model.ts` hard-blocks real-pilot cutover AND fallback removal for any open blocking item while the demo track is non-blocking by construction; the `deferred-categories.ts` deny-list the 9.5 scope scan consumes; the real `ReadinessCode` union in `readiness.ts` the fixtures pin against (no fictional `REQUIRES_SIGN_OFF`/`DEDUCTION_ESTIMATE_UNAPPROVED` survives as a data value anywhere in `tests/fixtures/**` or `src/**`); and the blocking `pnpm audit --audit-level=high` at `ci.yml:72` with no `c8`/coverage step — see each section's Evidence line.

## Executive Summary

**Assessment:** 8 PASS, 1 CONCERNS, 0 FAIL across the in-scope ADR categories. **Domain risk (security / performance / reliability / scalability): LOW across all four** — 0 HIGH, 0 MEDIUM.

**Blockers:** 0. Every one of the **five Non-Negotiable epic controls** in the Epic 9 test design is met and test-proven (dedicated table below), each verified against the actual scanner module, the anonymized fixtures, the live `ReadinessCode` union, the `evaluateCutover` guard, the `owner-signoff-questions.md` blocking set, and the `deferred-categories.ts` deny-list — not the story prose:
(1) **zero real PII / secret / raw-customer-file** in any committed fixture, doc, prompt, or log (the shared scanner scans the DATA payload of all 8 fixtures + the whole `docs/migration/**` tree and *fires* on seeded personnummer/orgnr/email/SE-phone/secret — a live tripwire, not a today-is-clean snapshot; a real SAAB orgnr that leaked into one 9.5 test sample was removed in code review);
(2) **no mirage golden** — every comparison code/enum validated against the real exported `ReadinessCode` union at pack build (the previously-fictional codes were aligned as part of 9.3; quote-snapshot golden consumers stay green);
(3) **no false-green / no vacuous-green** — every pin lives under `tests/unit/**` inside the real `pnpm test:unit` glob (0 skipped / 0 todo / no `describe.skip` in the live run); `evaluateGateHonesty` distinguishes pass/fail/**skipped-with-reason** and rejects a bare `skipped`; the comparison suites DRIVE the real engine and PROVE each documented delta genuinely diverges from the recorded old value;
(4) **no cutover on an open blocking assumption** — `evaluateCutover` blocks real-pilot cutover AND fallback removal for any workflow with an unresolved blocking item (demo track non-blocking);
(5) **no deferred module in implemented scope** — the 9.5 scope scan trips on a seeded `fortnox`/`supplier`/… token, does not false-positive on benign tokens brushing short category names.
All eleven high-priority Epic 9 risks (score ≥6: R-901..R-911) are mitigated and proven by real, in-source, *executed* tests (epic-9-traceability-report.md, gate PASS — P0 100% 8/8, P1 100% 6/6, P2 100% 1/1, overall 100% 16/16, all mapped ACs FULL).

**High Priority Issues:** 0. No new HIGH-priority NFR issue introduced.

**What changed vs Epic 8 (why this epic is a different NFR shape).** Epic 8 crossed the object-storage boundary — its NFR weight was two-plane tenant isolation + storage↔DB atomicity + lifecycle locks, all runtime data-plane security/reliability. **Epic 9 introduces no product surface at all** (no route, no table, no migration, no `src/**` runtime code, no dependency). Its NFR profile therefore shifts from *data-plane security* to **evidence-integrity**: the two failure modes that bite a readiness epic are (a) a **privacy leak** — real PII / raw customer files entering a committed fixture, doc, prompt, or log — and (b) a **false-green** — a comparison harness or gate report that *reports* parity/coverage it does not actually prove, so the team cuts over on a mirage. Both are amplified by the standing reality that **no anonymized Lovable oracle existed before this epic** — every prior golden was `origin: "new-expected"`, so 9.2/9.3 introduce the *first* real `old-lovable`/`documented-delta` origins in the codebase, the moment the three-way origin discipline stops being theoretical. The classic security class (RLS/anon/service-role/storage isolation) is here only as **standing regression** (unchanged, green) because Epic 9 touches no tenant-owned data; the novel controls are all *test/evidence* controls (the scanner, the union-validation guard, the runner-glob/vacuous-green guard, the cutover-block guard, the scope scan) — and every one is proven by an *executed* negative/tripwire assertion, not asserted.

**The standing-concern posture is unchanged and stable at one.** Epic 6 closed the `pnpm audit --audit-level=high` dependency-scan gate as a blocking CI step; Epics 7 and 8 added no new dependency; **Epic 9 adds no new dependency either** (pure TypeScript test assets + Markdown docs). That leaves exactly **one** standing CONCERNS unchanged: the line-coverage reporter (`c8`/`nyc`), still absent and LOW-priority (priority-weighted trace coverage — **100%** this epic — remains the governing metric). Verified: no `c8`/`nyc`/coverage step in CI or `package.json` (grep-confirmed absent).

**Recommendation:** **PASS (advisory).** Epic 9 lands the pilot-readiness evidence with the correct posture on every evidence-integrity axis. Privacy is enforced by a **single shared scanner** (`tests/support/anonymization-scan.ts`) ported byte-exact from the money-pack authority — NOT a looser fork — run over the DATA payload of every committed Lovable fixture AND the whole `docs/migration/**` tree, as an epic blocker regardless of numeric score, with a live positive control (seeded PII of each class fires), ORGNR + RAW_FILE_BLOB scoped to string leaves so a legitimate large öre integer cannot spuriously read as a leak while a real string orgnr still trips, and the capture script anonymizing AT SOURCE (secrets DROPPED, logs counts-only, connects to nothing). Comparison honesty is enforced structurally: every comparison code is validated against the real exported `ReadinessCode` union (the fictional-code fixtures were aligned in 9.3), every pin lives under `tests/unit/**` (no runner-glob vacuous-green), the manifest is derived-count / per-category structured (no substring token), and the comparison DRIVES the real engine (`computeSectionTotal`, `resolveVatDisplayPosture`, `classifyReadiness`, the 6.3 PDF text path) as the new-side oracle to PROVE each documented delta genuinely diverges from the recorded old value. Cutover is structurally impossible on an open assumption: `evaluateCutover` hard-blocks real-pilot cutover AND fallback removal for any open blocking item with a traceable `blockedBy`, and honestly records the open tax sign-offs (VAT `A.2`, rounding `A.1`, ROT/grön `B/C`) as **blocking real-pilot use** while keeping the demo track non-blocking (owner demo-data-only decision 2026-07-03). The 9.5 gate report distinguishes pass/fail/skipped-with-reason and fails a bare skipped; the scope scan trips on any deferred-module token. The one remaining CONCERNS — no line-coverage reporter — does not weaken any Epic-9 exit criterion. The four Epic-9 deferred residuals (9.2 approved-PII-exception marker, 9.3 shallow attachment-set coverage + one-armed `classifyDelta`, 9.4/9.5 per-row register-traceability strictness) are all **Low, owner-gated or test-hardening, dated + owner-named in the deferred-work ledger — not coverage gaps** that change the Phase-A verdict; each is unblockable only by the owner-gated first-real-capture story (8.1/8.2 `möte`) or a future authoring edit.

---

## Findings Summary (ADR Quality Readiness Checklist — 8 categories)

| # | Category | Epic-9 evidence | Status |
| - | -------- | --------------- | ------ |
| 1 | Testability & Automation | Pure-unit dominant (`node --test`): the whole epic is deterministic, offline, I/O-free test assets — the scanner (`anonymization-scan.ts`), the anonymizer (`lovable-capture.ts`), the comparison harness (`comparison-support.ts`), the docs-invariant validators, and the `evaluateCutover`/`evaluateGateHonesty` models. Every P0/P1 test present in-source, under `tests/unit/**`, behavior-asserting, negative-first. Live re-run this session: **1371 unit pass / 0 fail / 0 skipped / 0 todo / 86 suites**; epic-9 subset 121 pass / 0 skipped. No `describe.skip`/`.only`/`test.fixme` on any Epic-9 suite (the runner-glob + stale-RED-PHASE traps actively avoided) | PASS ✅ |
| 2 | Test Data Strategy | The **first** `old-lovable`/`documented-delta` fixtures in the repo (`tests/fixtures/golden/lovable/**`, 8 category files) — anonymized shape-only, ZERO PII, every öre integer < 10 digits (orgnr-scan-safe), `readinessWarnings` pinning ONLY real `ReadinessCode` union members. The money-pack PII/secret + ORGNR scan is EXTENDED (not forked) via the shared `anonymization-scan.ts` over the whole Lovable fixture set + `docs/migration/**`; existing money/calc/quote-pdf/snapshot fixtures referenced as the single numeric authority (no re-pin — R-912). Explicit 8-fixture manifest + a directory-glob backstop so a forgotten new fixture is still caught | PASS ✅ |
| 3 | Scalability & Availability (harness/schema) | The comparison harness is offline/local, static-fixture-driven, unit-scale — it absorbs into the existing `node --test` runner with zero rework and no new level. Product runtime scalability/availability = N/A (no route/table/runtime this epic; no SLA; single pilot tenant). The standing RLS/H4 inventory + storage-neg harness (Epics 2-8) is unaffected — Epic 9 enrolls no new table | PASS ✅ (harness) / N/A (runtime) |
| 4 | Disaster Recovery | N/A this epic — no deployed production runtime / SLO; Epic 9 persists no state (docs + test fixtures only). Consistent with Epics 2-8 | N/A (deferred) ⚠️→✅ |
| 5 | Security | Evidence-plane privacy is the security class here: the shared scanner (ported byte-exact, NOT loosened) scans every committed fixture DATA payload + `docs/migration/**` for personnummer/orgnr/email/secret/SE-phone/address/raw-file-blob as a CI epic blocker, with a live positive control (seeded PII of each class fires) + string-leaf ORGNR/RAW_FILE_BLOB scoping (no öre false-positive, real orgnr still trips); capture anonymizes AT SOURCE (secrets dropped, counts-only logs, connects to nothing). No service-role / no client-path change (no `src/**` runtime code). Standing tenant-isolation/anon/service-role gates unchanged + green (no new surface) | PASS ✅ |
| 6 | Monitorability / Debuggability / Manageability | Every guard is a *loud, specific, traceable* failure: a scanner violation names WHICH PII class tripped + WHICH fixture (`Violation.class`/`file`); `evaluateCutover` returns a `blockedBy` naming the exact open items that stopped cutover (never an opaque `false`); `evaluateGateHonesty` rejects a bare `skipped` and names `invalidStatus`; the scope scan reports the offending deferred token. No swallowed / silent failure mode in the evidence machinery | PASS ✅ |
| 7 | QoS / QoE (evidence integrity = the "quality of service") | The "service" this epic delivers is *trustworthy cutover evidence*. Every quality property is asserted by a negative: a leaked PII fixture FAILS the scan, a mirage golden (bogus `ReadinessCode`) FAILS the pack, a false-green gate (bare `skipped`) FAILS the honesty model, a deferred module leak TRIPS the scope scan, an open blocking item BLOCKS cutover, a dropped register-blocking ID FAILS reconciliation. The register HONESTLY records the open tax sign-offs as blocking real-pilot (non-blocking demo) — the gate rewards honest recording of blockers, which is present, not their resolution (correctly deferred) | PASS ✅ |
| 8 | Deployability | Epic 9 is additive-by-omission: NO migration, NO new table/column/policy, NO route, NO dependency, NO `src/**` runtime change — nothing to deploy or reset. The `verify` job (lockfile, **blocking `pnpm audit --audit-level=high`**, source + built-bundle service-role containment, typecheck, lint, unit, build) + `db` job (`SUPABASE_TEST_REQUIRED=1`) + `e2e` job all present and green; the new evidence assets ride the existing `pnpm test:unit` gate | PASS ✅ |

**Also standing:** **Vulnerability management** — 0 critical / 0 high is enforced by the blocking `pnpm audit --audit-level=high` step in the CI `verify` job (`.github/workflows/ci.yml:72`, resolved Epic 6). Epic 9 adds **no new dependency** (pure TypeScript test assets + Markdown), so the gate needs no extension and stays green. The vulnerability-management category remains **PASS**.

---

## Domain Risk Breakdown (4-domain scoring)

| Domain | Risk Level | Rationale |
| ------ | ---------- | --------- |
| **Security** | LOW | Evidence-plane privacy proven by a live tripwire scanner (seeded PII of each class fires) over all fixtures + migration docs; anonymize-at-source capture; no new runtime surface / no service-role / no client path; standing tenant-isolation gates unchanged + green. 0 FAIL / 0 CONCERN. |
| **Performance** | LOW (N/A by design) | No runtime surface, no route, no SLA; offline/local unit-scale test assets only. Correctly deferred N/A (test-design "Not in Scope" + R-920). No latency/throughput obligation exists to breach. |
| **Reliability** | LOW | Deterministic, non-flaky suite (1371 pass / 0 skipped, re-verified live); every evidence guard is fail-closed + traceable (`blockedBy`, `invalidStatus`, named PII class); no vacuous-green trap (all pins under `tests/unit/**`). |
| **Scalability** | LOW (N/A runtime) | Harness is static-fixture unit-scale, absorbs into the existing runner with zero rework; no product scalability obligation this epic (no table/route/runtime). |

**Overall Risk Level: LOW.** Cross-domain risks: **0** (no perf+scale interaction — both N/A runtime; no security-FAIL to cascade into reliability). Compliance: GDPR posture is *strengthened* this epic (the anonymization + privacy-scan discipline is precisely the data-minimization control that keeps real customer PII out of committed artifacts); SOC2/PCI/HIPAA — N/A for a Phase A internal-pilot evidence epic with no production runtime.

---

## Performance Assessment

### Response Time (p95) / Throughput / Resource Usage / Scalability (runtime)

- **Status:** N/A (deferred, and N/A *by design* for this epic) ⚠️→✅
- **Threshold:** UNKNOWN — no Phase-A SLA/SLO, and Epic 9 introduces **no runtime surface** to which any latency/throughput threshold could attach. The comparison harness, scanner, anonymizer, and docs validators are all offline/local, static-fixture-driven, unit-scale (test-design "Not in Scope": *"Performance / load SLA for the comparison harness or migration scripts — no Phase A perf SLA; harness is offline/local and small"*).
- **Actual:** The whole epic runs inside `pnpm test:unit` in **~8.6 s for the full 1371-test suite** (the 121-test epic-9 subset is a fraction of that) — the comparison harness is pure synchronous transforms over small committed JSON fixtures; the scanner is a dependency-free regex pass over stringified fixtures; `evaluateCutover`/`evaluateGateHonesty` are I/O-free decision functions. No network, no DB, no clock, no filesystem in the decision logic. There is no production request path, no signed-URL minting, no query — nothing to benchmark.
- **Evidence:** `tests/support/anonymization-scan.ts` (pure, dependency-free — "no DB, no clock, no network"); `tests/unit/docs/sign-off-checklist-model.ts` (pure decision function); `scripts/migration/lovable-capture.ts` ("connects to NOTHING"); live `pnpm test:unit` duration 8636 ms / 1371 tests; test-design "Not in Scope" + R-920.
- **Findings:** Correctly N/A. Evidence *integrity* — not throughput/latency — is the entire Phase-A concern of this epic. **Carried-forward action (post-pilot):** if a real Lovable-capture pipeline or a migration data-import path is ever built (owner-gated, currently a HARD STOP), a capture/anonymization throughput budget + a large-fixture-set scan micro-benchmark would attach then; the pure-function seams extend without rework.

---

## Security Assessment

### Committed-Artifact Privacy — the shared scanner over fixtures + docs (R-901/R-902/R-914) — the headline control of this epic

- **Status:** PASS ✅ — the dominant risk class of this epic (the first deliberate reach into real Lovable data to derive fixtures; a single leaked personnummer or raw customer file in a committed fixture/doc is a full privacy breach, NFR17).
- **Threshold:** No real personnummer / orgnr / name / email / phone / address / secret / raw-customer-file in the DATA payload of ANY committed Lovable fixture, migration doc, capture-script log, or prompt (unless explicitly approved). Öre integers under the 10-digit orgnr-scan boundary. The scan must be a live tripwire (FIRES on planted PII), not merely clean-today, and must NOT be a looser fork of the money-pack authority.
- **Actual:** Verified at the source. `tests/support/anonymization-scan.ts` is the **single shared scanner**, ported byte-exact from the money golden-pack's pack-wide scan (`golden-pack.test.ts:379-418`) — the module header states explicitly it is NOT weakened; every regex (`PERSONNUMMER /\b\d{6}-\d{4}\b/`, `ORGNR /\b\d{10}\b/`, `NON_EXAMPLE_EMAIL`, `SECRET`, `PHONE` SE-mobile, `ADDRESS` street-type+number, `RAW_FILE_BLOB` `data:` URI / long base64) matches the authority. It strips `_doc`/`_comment`/`policy` provenance prose (which legitimately NAMES the PII rules) BEFORE scanning the DATA, runs each class as its own check so a violation names WHICH class tripped, and scopes ORGNR + RAW_FILE_BLOB to STRING leaves only (R-914 hardening) — a legitimate ≥10-digit öre integer (a JSON `number`) cannot spuriously trip, while a real orgnr in any string field STILL trips (the seeded positive control proves it). `lovable-privacy-scan.test.ts` scans all 8 fixture DATA payloads (with an explicit manifest + a glob backstop for a forgotten fixture); `migration-runbook-validators.test.ts` scans the whole `docs/migration/**` tree; `lovable-scanner-unit.test.ts` + the 9.5 PII-scan section seed personnummer/orgnr/email/SE-phone/address/secret and assert each FIRES. A real SAAB orgnr that had leaked into one 9.5 test sample was caught + removed in code review (replaced with a non-registered placeholder). The capture script (`lovable-capture.ts`) anonymizes AT SOURCE — `anonymizeRecord` is pure + deterministic (byte-identical re-run), DROPS secret keys entirely (never masks in place — a masked secret still reads as a leak), and `captureLog` logs counts/ids only ("anonymized 12 customers"), never a raw value; it connects to nothing (no network/DB/real-Lovable), with a SYNTHETIC-input-only STOP and the real-capture selection owner-gated (Sign-Off 8.1/8.2 `möte`).
- **Evidence:** `tests/support/anonymization-scan.ts` (the shared authority — byte-exact port, string-leaf ORGNR/RAW_FILE_BLOB, `scanFixtureData`/`assertNoPii`, manifest + glob backstop); `tests/unit/fixtures/golden/lovable/{lovable-privacy-scan,lovable-scanner-unit,lovable-capture-anonymizer-unit}.test.ts`; `tests/unit/docs/{migration-runbook-validators,acceptance-gate-report-validators}.test.ts` (docs + report PII scans); `scripts/migration/lovable-capture.ts` + `README.md` (anonymize-at-source, synthetic-only STOP); the 8 fixtures (ZERO PII, öre < 10 digits).
- **Findings:** Strong and machine-enforced. The SEC control that keeps the *first* Lovable-derived fixtures + migration docs safe to commit runs on every PR as a CI epic blocker, is a live tripwire (not a clean-today snapshot), reuses (not forks) the money-pack authority, and is belt-and-braces (anonymize-at-source in the capture pipeline + scan-on-commit). The one dated residual — an **approved-PII-exception machine-readable marker** (AC1 auditability clause) — is Low + owner-gated (zero approved exceptions exist today; the marker key + scanner recognition are defined by the owner-gated first-real-capture story, itself a documented HARD STOP), not a coverage gap.

### Comparison Representativeness — no mirage golden, real `ReadinessCode` union only (R-903)

- **Status:** PASS ✅
- **Threshold:** Every comparison code/enum value must be a REAL member of the exported `ReadinessCode` union — a fixture pinning a fictional code (`REQUIRES_SIGN_OFF`/`DEDUCTION_ESTIMATE_UNAPPROVED`) makes an old/new "match" prove nothing (project-context representativeness trap). The known fictional-code fixtures must be aligned to the real union as part of 9.3, without forking.
- **Actual:** Verified. `readiness.ts` exports the CLOSED `ReadinessCode` union (`MISSING_CUSTOMER`, `TOTAL_UNCOMPUTABLE`, `LOW_MARGIN`, `MISSING_FACILITY`, `MISSING_CONTACT`, `EMPTY_SECTION`, `ZERO_PRICE_ROW`, `MISSING_WORK_ROLE`, `UNRESOLVED_VAT`, `TAX_SIGN_OFF_REQUIRED`, `HIDDEN_ROWS_INCLUDED`). `lovable-shape-guard.test.ts` + `lovable-comparison-guards.test.ts` assert every fixture code is a real union member; the Lovable fixtures' `readinessWarnings` pin only real members (e.g. `LOW_MARGIN`/`HIDDEN_ROWS_INCLUDED`/`MISSING_WORK_ROLE`, per the `calculations.json` `_doc`) — NEVER the fictional codes. A grep of `tests/fixtures/**` + `src/**` confirms `REQUIRES_SIGN_OFF`/`DEDUCTION_ESTIMATE_UNAPPROVED` survive only as *prose naming what NOT to use*, never as a data value; the quote-snapshot golden consumers stay green after the alignment.
- **Evidence:** `src/features/calculations/readiness.ts` (the real union); `tests/unit/fixtures/golden/lovable/{lovable-shape-guard,lovable-comparison-guards}.test.ts` (9.2-SHAPE / 9.3-VALID-01); the 8 fixtures (real-code `readinessWarnings`); grep-confirmed no fictional code as a data value.
- **Findings:** Correct. A golden that green-passes against a code the system can never emit is impossible — the pack fails on any unknown code. This is the control that makes the *first* comparison goldens trustworthy rather than a parity mirage.

### Deferred-Module Scope Scan (R-910)

- **Status:** PASS ✅
- **Threshold:** The 9.5 implemented-surface scan must CONFIRM no deferred module (Fortnox/supplier/AI/HR/rentals/assets/DoU/tender…) leaked into implemented scope AND positively TRIP on a seeded deferred token — a positive test, not mere omission — without false-positiving on benign tokens that brush short category names.
- **Actual:** Verified. `acceptance-gate-report-validators.test.ts` (9.5-SCOPE-01) scans the implemented surface parametrically over the live `deferred-categories.ts` `FORBIDDEN_DEFERRED_CATEGORIES` deny-list (`fortnox`, `supplier`, `asset`, `rental`, `hr`, `dou`, `upphandling`), word-boundary + case-insensitive; it trips on seeded `/Fortnox`, `HR_Report`, `SUPPLIER_APIS`, and does NOT false-positive on benign tokens (`chars`/`threshold`/`assessment`/real table names) that brush the short `hr`/`dou` category strings. The deny-list module is deliberately kept out of the scanned surface so it doesn't self-trip (the R-816 arrangement).
- **Evidence:** `src/features/files/deferred-categories.ts` (the deny-list); `tests/unit/docs/acceptance-gate-report-validators.test.ts` (9.5-SCOPE-01 parametric + benign-token no-false-positive); traceability 9.5-AC2.
- **Findings:** Correct and self-tested. The scan is driven by the live deny-list (not a hardcoded copy that could drift) and proves its own teeth via a seeded token, so a deferred module leaking into Phase A scope cannot pass silently.

### Standing Tenant-Isolation / Service-Role / Vulnerability Management (regression)

- **Status:** PASS ✅ (standing, unchanged)
- **Threshold:** No new tenant-owned table without RLS enrollment; no service-role in client paths; 0 critical/high dependency vulnerabilities gated in CI.
- **Actual:** Epic 9 introduces **no tenant-owned table, no storage object, no route, no `src/**` runtime code, no dependency** — so the entire runtime security class is *standing regression, not net-new*. The RLS/H4 inventory (`TENANT_TABLES`), the cross-tenant/anon/spoof negatives, the source + built-bundle service-role containment guards (`ci.yml:74`/`:94`), and the blocking `pnpm audit --audit-level=high` (`ci.yml:72`) all remain present and green with nothing to extend. 9.3-AC3 (RLS/storage negatives where a comparison touches tenant data) is **satisfied-by-non-applicability** — the harness is pure-unit over static anonymized fixtures, touching no tenant table or storage object — documented SKIPPED-WITH-REASON, with the standing negatives unaffected.
- **Evidence:** `.github/workflows/ci.yml:72/74/94/113` (audit + service-role containment + `SUPABASE_TEST_REQUIRED=1`); `tests/integration/rls/**` (standing suite, unchanged); traceability 9.3-AC3 (satisfied-by-non-applicability).
- **Findings:** The runtime security posture is inherited intact and unweakened. Epic 9's only *new* security control is evidence-plane privacy (covered above), which is proven.

---

## Reliability Assessment

### Cutover-Block Guard — no cutover / no fallback erosion on an open assumption (R-905/R-908) — the headline reliability property of this epic

- **Status:** PASS ✅
- **Threshold:** The sign-off checklist must HARD-BLOCK real-pilot cutover for any workflow with an unresolved blocking money/tax/immutability/acceptance/required-file/migration-classification item, AND block removing that workflow's Lovable fallback while any blocking item is open (fallback-erosion guard, NFR21). The demo track must stay non-blocking (never conflated). The block must be traceable (name the offending items), and the guard must be proven reachable (fires on an open item) AND not a permanent deny (a clean workflow IS cutover-ready).
- **Actual:** Proven by an executable pure guard. `evaluateCutover` (`sign-off-checklist-model.ts`) returns `{cutoverAllowed, fallbackRemovalAllowed, blockedBy}`: on the `real-pilot` track ANY open blocking item sets both `cutoverAllowed` and `fallbackRemovalAllowed` to `false` and names the exact items in `blockedBy` (a traceable block, never an opaque `false`); the `demo` track short-circuits to allowed regardless of open items. `sign-off-register-validators.test.ts` (9.4-BLOCK-01) seeds an open blocking item on a real-pilot workflow and asserts the block FIRES, seeds a clean workflow and asserts it IS cutover-ready (the guard gates on OPEN items, not a blanket deny), asserts the demo track stays unblocked with the SAME 8 open items, and proves the cutover+fallback symmetry (R-908). `9.4-REG-01` feeds every LIVE blocking ID read from `owner-signoff-questions.md` through the guard and proves each blocks real-pilot; the register honestly records the open tax sign-offs (VAT `A.2`, rounding `A.1`, ROT/grön `B/C`) + migration `8.1`/`8.2` as blocking real-pilot / non-blocking demo.
- **Evidence:** `tests/unit/docs/sign-off-checklist-model.ts` (`evaluateCutover` — pure, I/O-free, traceable `blockedBy`, demo non-blocking by construction); `tests/unit/docs/sign-off-register-validators.test.ts` (9.4-BLOCK-01 fires + no-phantom-block + demo totality + fallback symmetry; 9.4-REG-01 live blocking-ID feed); `owner-signoff-questions.md` (the system-of-record); traceability 9.4-AC2/AC3.
- **Findings:** Excellent — cutover on an unsigned assumption is structurally impossible, and the guard is proven reachable (not the epic-5-ledgered structurally-unreachable dead-guard anti-pattern). The two tracks are never conflated: demo proceeds on disposable fake data while real-pilot stays blocked until the owner tax/migration session resolves — the intended Phase A split. The one dated residual — per-item register-traceability *strictness* (the validator asserts substring presence of each item + status token rather than a structural per-row owning-ID/owner/workflow-column assertion) — is Low test-hardening (the §4 rows DO carry all three, auditor-verified; a future column-dropping edit would be the only thing it misses), owner-named for a future format revision.

### Gate-Report Honesty — no false-green, no skipped-without-reason (R-909/R-904/R-916)

- **Status:** PASS ✅
- **Threshold:** The 9.5 acceptance-gate report must distinguish pass / fail / **skipped-with-reason**, FAIL on a skipped mandatory gate without a reason (false-green guard), reconcile 1:1 against the real CI gate list, and be reproducible from deterministic gate outputs. No comparison pin may be vacuous-green (authored outside `tests/unit/**` or `describe.skip`'d).
- **Actual:** Proven. `evaluateGateHonesty` carries the full status vocabulary and rejects a bare `skipped` (no reason) even when the report otherwise looks complete, naming `invalidStatus`; `parseReportedGates` extracts the real §2 gate rows and reconciles against `ci.yml` + `package.json` (all 12 real CI gates appear); `9.5-GATE-01` seeds a MISSING-gate report and a SKIPPED-WITHOUT-REASON report and asserts each FAILS. Vacuous-green is structurally excluded: every Epic-9 pin lives under `tests/unit/**` inside the real `pnpm test:unit` glob (confirmed 0 skipped / 0 todo / no `describe.skip` in the live 1371-pass run), and the comparison suites DRIVE the real engine (`computeSectionTotal`/`resolveVatDisplayPosture`/`classifyReadiness`/6.3 PDF text path) rather than a static schema, PROVING each documented delta genuinely diverges from the recorded old value (VAT posture, quote-rounding 16666-vs-16667, job status created-vs-open).
- **Evidence:** `tests/unit/docs/acceptance-gate-report-validators.test.ts` (`evaluateGateHonesty` full vocabulary + `invalidStatus`; `parseReportedGates`; seeded MISSING + SKIPPED-WITHOUT-REASON negatives; READINESS no-drift `reconcileReadinessBlocking`); the comparison suites (`lovable-comparison-{calc-quote-pdf,acceptance-job,classification-deltas,delta-classification}.test.ts`); `.github/workflows/ci.yml`; traceability 9.5-AC1/AC3.
- **Findings:** Strong. A gate reported "pass" that did not run, or a mandatory gate silently skipped, cannot survive the honesty model; a comparison pin that never executes cannot read as green. The report is generated from deterministic CI gate outputs (reproducible, R-916). The one dated residual — the READINESS-drift regex hardening — was already applied in 9.5 code review (`registerBlockingIds` now captures the dotted `A.1`/`A.2`/`B.1-B.4`/`C.1-C.3` money/tax families, with a seeded-drop negative proving the reconciliation fails on drift).

### Delta Classification + Three-Way Origin Discipline (R-906/R-913)

- **Status:** PASS ✅ — with a dated, owner-gated residual (one-armed `classifyDelta`).
- **Threshold:** Every comparison delta must be classified expected-simplification / bug / unresolved-assumption with a non-empty note; a `documented-delta`/`old-lovable` case must carry the divergent old value it diverges from (number | classification-code — the LABELLING guard widened for the first non-numeric Lovable delta).
- **Actual:** Proven for the deltas that exist today. `lovable-comparison-delta-classification.test.ts` exercises the widened LABELLING guard (`number | classification-code`); `lovable-comparison-classification-deltas.test.ts` drives the real oracle to PROVE the new value diverges from the recorded old value across VAT posture, quote-rounding, and job status. The LABELLING guard FIRES on a seeded malformed documented-delta (a documented delta must carry a divergent old value). The honest, dated residual: `classifyDelta` currently hard-returns `expected-simplification` for every documented delta — the `bug`/`unresolved-assumption` arms are not yet *producible* because **no real `old-lovable` capture exists yet** (owner-gated 8.1/8.2 `möte`), so no divergence can currently be a genuine bug/unresolved-assumption. The three-way vocabulary + guards ship EXERCISED by synthetic cases; the first real captured delta backfills the missing arms with no schema change (the origin already accommodates it).
- **Evidence:** `tests/unit/fixtures/golden/lovable/{lovable-comparison-delta-classification,lovable-comparison-classification-deltas,comparison-support}.ts/.test.ts`; deferred-work.md (9.3 one-armed `classifyDelta` — Low, owner-gated to the first-real-capture story); traceability 9.3-AC2.
- **Findings:** Correct for the current state. The discipline is real and proven against synthetic divergences; the one-armed classifier is a *no-input-yet* condition (there is nothing to classify as a bug until a real Lovable delta is captured), dated + owner-named, not a defect. A second, related residual — the `attachment-selection` comparison category is proven only as an empty attachment set (`attachmentCount: 0`) because the base fixture carries no selected attachment — is Low coverage-thinness (the projection path RUNS; the manifest is non-vacuous), owner-named for a hardening pass or the fixture that lands a selected attachment.

### CI Burn-In (Stability)

- **Status:** PASS ✅
- **Threshold:** Deterministic, non-flaky suite; 100% pass; 0 skipped / 0 todo; no `describe.skip`/`test.fixme` on Epic-9 suites; count-asserting tests seeded deterministically.
- **Actual:** Re-verified live this session: `pnpm run test:unit` = **1371 pass / 0 fail / 0 skipped / 0 todo / 86 suites** in ~8.6 s (matching the epic-9 traceability record exactly); the epic-9 subset = 121 pass / 0 skipped. Every guard is a pure, deterministic, I/O-free function (no DB/clock/network/filesystem in the decision logic); the anonymizer is byte-identical on re-run; the scanner is dependency-free. No `describe.skip`/`.only`/`test.fixme` on any Epic-9 suite (the runner-glob + stale-RED-PHASE-banner traps actively avoided — every pin under `tests/unit/**`).
- **Evidence:** live `pnpm test:unit` (1371 pass / 0 skipped / 8636 ms); epic-9-traceability-report.md ("LIVE suite state"); the pure-function module headers.
- **Findings:** Fully deterministic. The evidence machinery is exactly the class of test that should never flake (no runtime, no I/O, no clock), and it doesn't; the live re-run reproduces the recorded state byte-for-byte.

### Error Handling / Fault Tolerance

- **Status:** PASS ✅
- **Threshold:** Every guard returns a loud, specific, traceable failure rather than a silent pass or an opaque boolean; no swallowed error mode in the evidence machinery.
- **Actual:** `scanFixtureData` returns per-class `Violation`s naming WHICH class + WHICH fixture; `assertNoPii` throws with the tripped classes; `evaluateCutover` returns a `blockedBy` naming the exact open items; `evaluateGateHonesty` names `invalidStatus`; the scope scan reports the offending deferred token; `reconcileReadinessBlocking` fails on a dropped ID. No guard returns a bare `false` a caller could misread.
- **Evidence:** `anonymization-scan.ts` (`Violation.class`/`file`, `assertNoPii` throw); `sign-off-checklist-model.ts` (`blockedBy`); `acceptance-gate-report-validators.test.ts` (`invalidStatus`, `reconcileReadinessBlocking`).
- **Findings:** Strong. Every failure mode in the evidence plane is observable + attributable — the exact property a readiness epic needs so a broken guard is loud, not silently green.

### Availability / MTTR / Disaster Recovery

- **Status:** N/A (deferred) ⚠️→✅ — no deployed production runtime / SLO; Epic 9 persists no state (docs + test fixtures only).
- **Findings:** Correctly out of scope for Phase A, consistent with Epics 2-8.

---

## Maintainability Assessment

### Test Coverage (priority-weighted)

- **Status:** PASS ✅ (trace-coverage) / CONCERNS ⚠️ (line-coverage reporter absent)
- **Threshold:** P0 100% / P1 ≥90% / overall ≥80% priority-weighted (test-design gate); the five non-negotiable epic controls 100% proven by executed tests.
- **Actual:** Priority-weighted trace coverage is **100%** (16/16 mapped ACs FULL; P0 100% = 8/8, P1 100% = 6/6, P2 100% = 1/1) — above every deterministic threshold (epic-9-traceability-report.md, gate PASS). Every test-design P0/P1 row is closed by an active, in-source, executed test. No line-coverage % is computed (no `c8`/`nyc` reporter wired) — the same minor forward gap carried since Epics 2-8; priority-weighted trace coverage remains the governing metric.
- **Evidence:** epic-9-traceability-report.md (Coverage Summary + Gate Decision, PASS — 16/16 FULL); no `c8`/`nyc`/coverage step in `package.json`/CI (grep-confirmed absent).
- **Findings:** Coverage of the five evidence-integrity controls (privacy scan / no-mirage-golden / no-false-green / no-cutover-on-open-assumption / no-deferred-module) is exhaustive at the correct level (pure UNIT, negative-first). The missing reporter is a low-priority ergonomics gap, not a correctness gap — **the single remaining standing CONCERNS**, unchanged since Epic 2 (the `pnpm audit` twin was resolved Epic 6 and stays green).

### Code Quality / Technical Debt

- **Status:** PASS ✅
- **Threshold:** typecheck 0 errors, lint clean; single-source-of-truth (ONE shared scanner — no looser fork; reference existing fixtures as single authority — no re-pin; assets in the approved locations AR25); pure functions, no I/O in decision logic.
- **Actual:** typecheck/lint/build green per the story records + traceability. The scanner is the **single shared authority** (`tests/support/anonymization-scan.ts`) that the money pack and the new Lovable pack both consume — reuse, not a looser fork (the money-pack scan stays byte-identical). Existing money/calc/quote-pdf/snapshot fixtures are referenced as the single numeric authority (no re-pin — R-912). All Epic-9 assets live only in the approved locations (`tests/fixtures/golden/lovable/**`, `tests/unit/**`, `tests/support/**`, `docs/migration/**`, `scripts/migration/**` — AR25). Every decision function is pure + I/O-free. Epic 9 writes NO `src/**` product code, NO migration, NO dependency.
- **Evidence:** 9.1-9.5 implementation-artifacts (verify green); `anonymization-scan.ts` (single authority, byte-exact port); `sign-off-checklist-model.ts` + `comparison-support.ts` (pure); the approved asset locations.
- **Findings:** Low technical debt. The single-authority discipline (one shared scanner, existing fixtures as the numeric authority, one deny-list, one union) prevents the fork/drift the test design targets. The residuals are test-hardening / owner-gated, not debt in the delivered assets.

### Documentation Completeness

- **Status:** PASS ✅
- **Actual:** The four Epic-9 decision/evidence docs (`legacy-record-classification.md`, `migration-runbook.md`, `pilot-fallback-cutover.md`, `phase-a-acceptance-gate.md`) are complete + validator-asserted (four-bucket classification, six-workflow runbook with all five fields, per-workflow fallback/cutover/rollback, sign-off register with every blocking ID, gate report reconciling 1:1 with CI). Each story's Dev Agent Record documents the scope guardrails (synthetic-input-only STOP, real-capture owner-gate 8.1/8.2, demo-data-only 2026-07-03, no deferred module), the three-way origin discipline, and the reviewer-resolved/dispositioned findings. The scanner + capture-script module headers document the anonymize-at-source + string-leaf-scoping + secret-drop design and the KNOWN LIMITATION (free-form personal names not auto-anonymized — manual redaction before any real capture).
- **Evidence:** `docs/migration/**` (the four docs); 9.1-9.5 implementation-artifacts; `anonymization-scan.ts` + `lovable-capture.ts` + `scripts/migration/README.md` headers; deferred-work.md (dated residuals with owners).
- **Findings:** Complete and reconciled; the owner-gated / test-hardening residuals (9.2 exception marker, 9.3 shallow attachment coverage + one-armed classifier, 9.4/9.5 register-row strictness) are logged with owners in the deferred-work ledger, not lost.

### Test Quality (from trace/automation review)

- **Status:** PASS ✅
- **Actual:** Tests are mechanism-asserting and negative-dominated: seeded PII of each class must FIRE the scan, a bogus `ReadinessCode` must FAIL the pack, a bare `skipped` gate must FAIL the honesty model, a seeded deferred token must TRIP the scope scan, an open blocking item must BLOCK cutover, a dropped register-blocking ID must FAIL reconciliation, a malformed documented-delta must trip the LABELLING guard. No happy-path-only criterion; no vacuous-green trap (all pins under `tests/unit/**`, 0 skipped in the live run, the comparison drives the real engine not a static schema). The guards are proven REACHABLE (fire on an open/bad input) AND not permanent denies (a clean input passes).
- **Evidence:** epic-9-traceability-report.md (Coverage Heuristics — "error-path / negative coverage: STRONG … No requirement is happy-path-only"); the negative/tripwire assertions across the scanner/guard/comparison suites.
- **Findings:** High test quality — negatives before positives, live-tripwire privacy scanning, real-engine-driven comparison oracles, reachable-not-permanent guard proofs, no vacuous-green traps. The dated residuals are coverage-*depth* / owner-gated-input items, not quality defects in the delivered tests.

---

## Custom NFR Assessments (Epic-9-specific)

### Evidence Integrity Across the Fixtures + Docs + Prompts + Logs Plane (the defining NFR of Epic 9)

- **Status:** PASS ✅
- **Why it matters:** Epic 9 is the last gate before real-customer money would move through the new system. Its unique hazard is not new product surface but the **integrity of the evidence** the business will trust to decide cutover. A leaked personnummer in a committed fixture, a golden that green-passes against a code the system never emits, a gate reported "pass" that never ran, or a cutover approved while a tax assumption is open — each is an *evidence mirage* that would let the team cut over on a false signal.
- **Actual:** All four mirage classes are structurally excluded by executed guards: (1) privacy — the shared byte-exact scanner over all fixtures + `docs/migration/**`, a live tripwire, anonymize-at-source capture; (2) representativeness — every comparison code validated against the real `ReadinessCode` union; (3) false-green — `evaluateGateHonesty` + every pin under `tests/unit/**` + real-engine-driven comparison; (4) cutover-on-open-assumption — `evaluateCutover` hard-blocks real-pilot cutover + fallback removal, demo non-blocking. Plus the scope scan excludes a deferred-module leak. The gate rewards *honest recording of the open blockers* (present), not their resolution (correctly deferred to the owner tax/migration session).
- **Findings:** The defining NFR is met. Epic 9 makes an evidence mirage impossible without changing the real-world truth it must NOT change (it does not resolve the open tax/migration sign-offs — those stay recorded as blocking real-pilot, non-blocking demo). This is the intended Phase A landing: the demo pilot proceeds on disposable data; real-customer cutover still requires the owner sign-off session.

### Three-Way Origin Discipline — the first `old-lovable` / `documented-delta` origins land exercised (Epic-9-specific)

- **Status:** PASS ✅ (exercised by synthetic cases; real arms backfill later without schema change)
- **Actual:** Before this epic every golden was `origin: "new-expected"` — there was nothing to diverge from. 9.2/9.3 introduce the first `old-lovable`/`documented-delta` fixtures + the widened `number | classification-code` LABELLING guard, all shipped EXERCISED by synthetic-representative cases (the real record SELECTION is owner-gated 8.1/8.2 `möte`). The `classifyDelta` `bug`/`unresolved-assumption` arms are not yet producible (no real divergence exists to classify as such); they backfill when the owner selects the golden examples, with no fixture-schema or guard-shape change (the origin already accommodates it).
- **Findings:** Correctly landed. The discipline ships proven, and the not-yet-producible arms are a *no-input-yet* condition dated + owner-named — the intended contingency (author the machinery now, backfill real numbers when the owner unblocks capture) is exactly what happened.

---

## Gate-Ready YAML Snippet

```yaml
nfr_assessment:
  epic: 9
  date: '2026-07-08'
  overall_status: PASS   # advisory
  overall_risk: LOW
  domains:
    security: LOW         # evidence-plane privacy proven by live-tripwire scanner; no new runtime surface
    performance: N/A      # offline/local test assets only, no runtime, no Phase A SLA (by design)
    reliability: LOW      # deterministic 1371 pass/0 skipped; fail-closed traceable evidence guards
    scalability: N/A      # unit-scale harness; no product scalability obligation this epic
  adr_categories:
    testability_automation: PASS
    test_data_strategy: PASS
    scalability_availability: PASS   # harness; runtime N/A
    disaster_recovery: N/A
    security: PASS
    monitorability: PASS
    qos_qoe: PASS
    deployability: PASS
  vulnerability_management: PASS   # pnpm audit --audit-level=high blocking (ci.yml:72); no new dependency
  standing_concerns:
    - id: line-coverage-reporter
      severity: LOW
      note: 'No c8/nyc reporter wired; priority-weighted trace coverage 100% is the governing metric. Carried since Epic 2.'
  non_negotiable_epic_controls:   # all five MET + test-proven
    zero_pii_secret_rawfile: MET
    no_mirage_golden: MET
    no_false_green_gate: MET
    no_cutover_on_open_assumption: MET
    no_deferred_module_in_scope: MET
  deferred_residuals:   # all Low; owner-gated or test-hardening; none gate this epic
    - '9.2 approved-PII-exception machine-readable marker (owner-gated first-real-capture story)'
    - '9.3 attachment-selection comparison proven only as empty set (hardening pass / selected-attachment fixture)'
    - '9.3 classifyDelta one-armed — bug/unresolved-assumption arms backfill on first real old-lovable capture'
    - '9.4/9.5 per-row register-traceability strictness (structural per-row assertion on next format revision)'
  blockers: []
  recommendation: 'PASS (advisory) — release approved from the NFR perspective. Open owner/accounting/legal tax sign-offs remain recorded as blocking real-pilot cutover (non-blocking demo); NOT resolved by this gate — the intended Phase A split.'
```

---

## Remediation Actions

**None required for this epic.** No FAIL, no HIGH/MEDIUM domain risk, no unmitigated ≥6 risk, no open epic-blocker control.

**Carried forward (non-gating, dated + owner-named in `deferred-work.md`):**
1. **Line-coverage reporter** (LOW, standing since Epic 2) — optionally wire `c8`/`nyc`; priority-weighted trace coverage (100%) remains the governing metric.
2. **Approved-PII-exception marker** (9.2, LOW, owner-gated) — the owner-gated first-real-capture story defines the marker key + scanner recognition when the first exception appears (zero exist today; that story is itself a documented HARD STOP).
3. **Attachment-selection comparison depth** (9.3, LOW) — add a snapshot case carrying a SELECTED attachment so the category asserts a non-empty projected set, not just an empty one.
4. **`classifyDelta` `bug`/`unresolved-assumption` arms** (9.3, LOW, owner-gated) — backfill when the first real `old-lovable` capture lands (owner-gated 8.1/8.2 `möte`); no schema change needed.
5. **Per-row register-traceability strictness** (9.4/9.5, LOW test-hardening) — assert each register row carries its owning-question-ID / owner / affected-workflow cell on the next register-format revision.
6. **PII-scan file-set** (belt-and-braces) — optionally extend the whole-directory scan's file-set to the seeded negative-control samples under `tests/unit/**` (the real orgnr that leaked into one such sample was already removed in code review).

---

## Completion Summary

- **Overall NFR status:** PASS (advisory) — 8 ADR categories PASS, 1 CONCERNS (line-coverage reporter, LOW, standing since Epic 2), 0 FAIL; overall domain risk LOW (security/reliability LOW; performance/scalability N/A by design).
- **Critical blockers / waivers needed:** None. All five non-negotiable epic controls MET + test-proven; all eleven ≥6 risks (R-901..R-911) mitigated by executed tests; live unit gate 1371 pass / 0 fail / 0 skipped re-verified this session.
- **Explicit Phase A split (not a defect):** the open owner/accounting/legal tax sign-offs (VAT `A.2`, rounding `A.1`, ROT/grön `B/C`) + migration `8.1`/`8.2` remain recorded as **blocking real-pilot cutover** (non-blocking for the demo track) and are NOT resolved by this gate — the demo pilot proceeds; real-customer cutover still requires the owner sign-off session.
- **Next recommended workflow:** `test-review` (Epic-9 validator quality, scheduled at the epic boundary) → epic release gate / retrospective. No `atdd`/`automate` remediation required (0 P0/P1 gaps).

---

**Generated by:** BMad TEA Agent — Test Architect Module
**Workflow:** `bmad-testarch-nfr` (epic-level assessment)
**Execution mode:** sequential (4 NFR domains: security / performance / reliability / scalability)
**Version:** 4.0 (BMad v6)
