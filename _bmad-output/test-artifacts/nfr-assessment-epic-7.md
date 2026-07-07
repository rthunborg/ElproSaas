---
stepsCompleted:
  - step-01-load-context
  - step-02-define-thresholds
  - step-03-gather-evidence
  - step-04-evaluate-and-score
  - step-04e-aggregate-nfr
  - step-05-generate-report
lastStep: step-05-generate-report
lastSaved: '2026-07-07'
workflowType: testarch-nfr-assess
assessmentLevel: epic
epicNum: 7
executionMode: sequential
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-7.md (19 risks R-701..R-719; 11 high-priority ≥6; 5 non-negotiable epic blockers; P0-P3 test IDs; exit criteria)
  - _bmad-output/test-artifacts/traceability/epic-7-traceability-report.md (gate PASS; P0 100% 15/15, P1 100% 8/8, overall 100% 23/23; suite 1126 unit / 641 int / 93 e2e)
  - _bmad-output/test-artifacts/nfr-assessment-epic-6.md (format + the single standing CONCERNS carried since Epic 2; pnpm audit resolved Epic 6)
  - _bmad-output/planning-artifacts/epics.md (Epic 7, Stories 7.1-7.4; FR41-FR48; AR20-AR21; NFR12/NFR20)
  - _bmad-output/auto-bmad/state/epic/epic-7.yaml (4 stories landed; trace_gate done; gate_decision PASS)
  - supabase/migrations/20260709120000_acceptance_to_job_model.sql (quote_acceptances/jobs/job_events + direct tenant_id + enable/force RLS + own-tenant is_tenant_admin policies + composite same-tenant FKs + öre bigint CHECK>=0 + unique(quote_version_id)/unique(quote_acceptance_id) duplicate-prevention backstops)
  - supabase/migrations/20260710120000_accept_quote_and_create_job.sql (narrow ADR-A009 RPC; SECURITY INVOKER + empty search_path; FOR UPDATE row locks on version + parent quote; explicit p_accepted_at H1, no now(); idempotent short-circuit; one-transaction rollback NFR20; 23505→ACCEPTANCE_ALREADY_RECORDED)
  - supabase/migrations/20260711120000_accepted_record_lock.sql (enforce_quote_acceptance_lock + jobs source-ref lock triggers; fail-closed by construction; AR704→ACCEPTED_RECORD_LOCKED; SECURITY INVOKER + empty search_path)
  - src/server/commands/command-errors.ts (stable codes live: TENANT_ACCESS_DENIED, COMMAND_CONFLICT reserved, ACCEPTANCE_ALREADY_RECORDED, ACCEPTED_RECORD_LOCKED)
  - src/server/commands/quotes/** ; src/features/jobs/** ; src/features/quotes/acceptance-price.ts
  - tests/integration/rls/tenant-table-inventory.ts (TENANT_TABLES — quote_acceptances/jobs/job_events enrolled; quote_events Epic 6)
  - tests/integration/commands/{accept-quote-and-create-job,capture-quote-acceptance,acceptance-evidence-link,accepted-record-lock,job-source-of-truth,update-job}.int.test.ts
  - tests/unit/lib/money/golden-pack.test.ts (extended PII/ORGNR privacy scan over accepted-price-deltas.json — R-717/R-411 lineage)
  - _bmad-output/test-artifacts/automation-summary-7-2/7-3/7-4-*.md (recorded: unit 1126 pass / 0 fail; full INT 56 files / 641 tests / 0 fail; accepted-record-lock 31 pass on live stack; E2E 93)
  - .github/workflows/ci.yml (verify job: pnpm audit --audit-level=high BLOCKING at line 72; no c8/coverage step)
  - knowledge: adr-quality-readiness-checklist.md, ci-burn-in.md, test-quality.md, error-handling.md, playwright-config.md
---

# NFR Assessment - Epic 7: Acceptance-To-Job Transaction

**Date:** 2026-07-07
**Epic:** 7 (Stories 7.1-7.4) — off-system acceptance evidence capture for a sent quote version with adjusted-price handling (7.1); the idempotent, transactional `acceptQuoteAndCreateJob` command — architecture §13's highest-risk Phase A command (7.2); the minimal job/order record + tenant-admin traceability UX (7.3); accepted-state immutability enforced at command AND database level with an explicit audited-correction boundary (7.4)
**Overall Status:** PASS (advisory) ✅ — with **one** remaining standing forward-looking CONCERNS (no line-coverage reporter — LOW, carried since Epic 2). The `pnpm audit --audit-level=high` gate remains present and blocking (confirmed `.github/workflows/ci.yml:72`). Runtime performance/load, availability/DR/MTTR remain deferred N/A for Phase A (no SLA, single pilot tenant, no production SLO); the owner-gated adjusted-price policy (R-713) and correction-workflow (R-714) residuals are dated, surfaced items — not coverage gaps.

---

Note: This assessment summarizes existing evidence; it does not run tests or CI workflows. The Epic 7 unit/golden suite (1126/1126 pass) is per the 7.4 automation record and the epic-7 traceability report; INT/RLS/E2E are CI-gated (`SUPABASE_TEST_REQUIRED=1`, 56 files / 641 int / 93 e2e; the 7.4 accepted-record-lock suite verified RUN not skipped — 31 pass on the live Supabase stack). Several load-bearing source-level claims were re-verified directly for this audit — the three new commitment tables enrolled in `TENANT_TABLES`; the composite same-tenant FKs + öre `bigint CHECK >= 0` + `unique(quote_version_id)`/`unique(quote_acceptance_id)` backstops in `20260709120000`; the `FOR UPDATE` row locks + `SECURITY INVOKER` + empty `search_path` + explicit `p_accepted_at` (H1, no `now()`) + one-transaction rollback in the `accept_quote_and_create_job` RPC (`20260710120000`); the fail-closed-by-construction `enforce_quote_acceptance_lock()` + jobs source-ref lock triggers (`AR704`, `20260711120000`); the `ACCEPTANCE_ALREADY_RECORDED` / `ACCEPTED_RECORD_LOCKED` stable codes in `command-errors.ts`; and the blocking `pnpm audit --audit-level=high` at `.github/workflows/ci.yml:72` (with no `c8`/coverage step) — see each section's Evidence line.

## Executive Summary

**Assessment:** 7 PASS, 1 CONCERNS, 0 FAIL across the in-scope categories.

**Blockers:** 0. Every one of the **five Non-Negotiable epic blockers** in the Epic 7 test design is met and test-proven (see the dedicated table below): (1) all three new commitment tables (`quote_acceptances`/`jobs`/`job_events`) carry direct `tenant_id` + enable+**force** RLS + own-tenant `is_tenant_admin` policies + `anon → none` GRANT + `TENANT_TABLES` enrollment (H4 gate CI-fatal otherwise); (2) no duplicate acceptance or duplicate job is creatable on retry/double-submit/concurrency (DB uniqueness backstops + row-locking narrow RPC); (3) no partial acceptance/job state survives a mid-transaction failure (NFR20 behavioral rollback proof); (4) accepted immutable fields are immutable at BOTH the command layer (`ACCEPTED_RECORD_LOCKED`) and the DATABASE (trigger `AR704`), fail-closed by construction; (5) fixture privacy is enforced by the CI PII/secret + ORGNR scan over the acceptance golden. All eleven high-priority Epic 7 risks (score ≥6: R-701..R-710, R-717) are mitigated and proven by running tests (epic-7-traceability-report.md, gate PASS — P0 100% 15/15 / P1 100% 8/8 / overall 100% 23/23, all 23 FULL).

**High Priority Issues:** 0. No new HIGH-priority NFR issue introduced.

**What changed vs Epic 6 (why this is the transaction the whole plan feared):** Epic 6 made the money a customer-facing commitment by *freezing a single artifact* (a quote version snapshot, a PDF, a file). **Epic 7 is the first — and only — Phase A epic that must atomically create MULTIPLE immutable records across MULTIPLE tables in ONE transaction, AND be safe to call twice.** Architecture §13 and AR20 name `acceptQuoteAndCreateJob` the single highest-risk command in the entire plan for exactly this reason. This upgrades four NFR classes to their most consequential form, three of them new in their most severe shape: (1) **idempotency at the database** — a double-submit, retry, or create-job-after-acceptance-exists must return the EXISTING acceptance + job, never a second job/acceptance/lifecycle transition (enforced by row locks + uniqueness constraints INSIDE the RPC, not a client check); (2) **atomicity / no-partial-state (NFR20)** — acceptance + quote/version lifecycle update + job insert + quote/job/audit events commit OR roll back together, proven behaviorally by injected mid-transaction fault; (3) **accepted-state immutability + correction boundary (ADR-A005/NFR12)** — once accepted, seven commitment fields become immutable at command AND DB, with Phase A intentionally implementing only the BOUNDARY (no correction workflow — a 7.4 STOP); (4) **isolation across three new tenant-owned commitment tables** carrying another tenant's accepted prices and commitments. Two domains remain deliberately deferred N/A for Phase A: acceptance/job transaction latency + concurrent-accept throughput at scale (no SLA, pilot-sized — R-718) and availability/DR/MTTR (no deployed production runtime with an SLO). Inherited RLS/anon/service-role/audit/money gates from Epics 2-6 remain green as standing regression, now **extended** (not forked) to the three new commitment tables via the shared `TENANT_TABLES` inventory + H4 gate.

**The standing-concern posture is unchanged and now stable at one.** Epic 6 closed the second-to-last standing carry — the `pnpm audit --audit-level=high` dependency-scan gate (R-617 hard mechanism) — as a blocking CI step. Epic 7 adds **no new runtime dependency** (the acceptance-to-job transaction is pure Postgres RPC + existing `@/lib/money`), so that gate needs no extension and stays green. That leaves exactly **one** standing CONCERNS unchanged: the line-coverage reporter (`c8`/`nyc`), which remains absent and LOW-priority (priority-weighted trace coverage, **100%** this epic, remains the governing metric). Verified: no `c8`/`nyc`/coverage step in CI (`.github/workflows/ci.yml`, grep-confirmed absent).

**Recommendation:** **PASS (advisory).** Epic 7 lands the riskiest transaction of the whole plan with the correct posture on every axis. Isolation is enforced structurally (enable+force RLS + own-tenant policies + composite same-tenant FKs + mandatory `TENANT_TABLES` enrollment whose H4 gate FAILS CI on an unenrolled table). Idempotency + duplicate-prevention are enforced at the DATABASE (`unique(quote_version_id)` = one acceptance per version, `unique(quote_acceptance_id)` = one job per acceptance) plus `FOR UPDATE` row locks on the version + parent quote inside the narrow RPC, with an idempotent short-circuit that returns existing ids and appends NO duplicate events on retry. Atomicity is proven behaviorally (injected mid-transaction fault ⇒ end state empty — no acceptance, no lifecycle change, no job, no event). Accepted-state immutability is enforced at TWO independent layers (command `ACCEPTED_RECORD_LOCKED` + DB trigger `AR704`), fail-closed by construction (only `archived_at`/`updated_at` exempt; every commitment/identity/money column locked-by-default). The RPC is deterministic (explicit `p_accepted_at`, no wall-clock — H1) and containment-safe (`SECURITY INVOKER`, runs under the caller's RLS, no service-role app path). Money is integer öre (`bigint CHECK >= 0`), the adjusted-price delta computed with `@/lib/money` never at the DB. The one remaining CONCERNS — no line-coverage reporter — does not weaken any Epic-7 exit criterion. The owner-gated adjusted-price policy (R-713) and audited-correction workflow (R-714) are **surfaced-for-decision residuals with named owners under the demo-data-only decision (2026-07-03), not coverage gaps.**

---

## Findings Summary (ADR Quality Readiness Checklist — 8 categories)

| # | Category | Epic-7 evidence | Status |
| - | -------- | --------------- | ------ |
| 1 | Testability & Automation | Full pyramid — UNIT (`node --test`) + INT/RLS (Vitest/local Supabase) + E2E (Playwright) + GOLDEN. Pure logic (acceptance-price delta, job read projection/filters, timestamp-injection adapter, RPC-result extractor) extracted OUT of client islands and unit-pinned. 1126/1126 unit+golden green; full INT 56 files / 641 tests / 0 fail; E2E 93; the 7.4 accepted-record-lock 31 pass verified RUN (not skipped) on the live stack. No active `.skip`/`.only`/`fixme` remains in executable Epic 7 code (all red-phase ATDD scaffolds flipped green). Every test-design P0/P1 ID present in-source and behavior-asserting | PASS ✅ |
| 2 | Test Data Strategy | Two-tenant factory extended with acceptance/job/event seeds + cleanup; anonymized origin-labelled `accepted-price-deltas.json` golden REUSED (not forked) from Story 4.4 with the extended PII/secret + ORGNR scan (personnummer/orgnr/email/secret; öre < 10 digits to dodge the orgnr false-positive trap); count-asserting tests seed `crypto.randomUUID()`; goldens under `tests/unit/**` (avoids the runner-glob vacuous-green trap) | PASS ✅ |
| 3 | Scalability & Availability (harness/schema) | 3 new tenant commitment tables absorbed by the existing dual-runner + RLS/H4 inventory with zero rework (enrollment mandatory, H4 CI-fatal on an unenrolled table). Duplicate-prevention + idempotency are DB-side inside the narrow RPC txn (uniqueness backstops + `FOR UPDATE` locks). Product runtime scalability/availability = N/A/deferred (no SLA, single pilot tenant, R-718) | PASS ✅ (harness) / N/A (runtime) |
| 4 | Disaster Recovery | N/A this epic — no deployed production runtime / SLO; the three new tables add persisted commitment state but no live runtime to fail over in Phase A | N/A (deferred) ⚠️→✅ |
| 5 | Security | 3 commitment tables: direct `tenant_id` + enable+**force** RLS + own-tenant `is_tenant_admin` policies + no anon grant + `TENANT_TABLES` enrollment; composite same-tenant FKs (job → acceptance → version → quote; acceptance → evidence file) + command re-validation reject foreign version/acceptance/evidence ids (`TENANT_ACCESS_DENIED`, generic — no existence disclosure); the RPC is `SECURITY INVOKER` + empty search_path (runs under caller RLS, no service-role); accepted-record lock triggers `SECURITY INVOKER` + empty search_path; no public/portal/webhook/cron acceptance surface; allow-listed audit metadata (targetId-only, no raw price PII); no PII in any fixture | PASS ✅ |
| 6 | Monitorability / Debuggability / Manageability | Typed `ACCEPTANCE_ALREADY_RECORDED`/`ACCEPTED_RECORD_LOCKED`/`VALIDATION_FAILED`/`TENANT_ACCESS_DENIED`/`COMMAND_CONFLICT` (reserved); the job/quote write-error mappers map `AR704`/`23505`/`23503`/`42501`/`22P02` with no raw pg message leak; `quote_events` + `job_events` timelines + a single allow-listed `{ targetId }` audit row per command on accept/create/update make the transaction observable; idempotent retry appends NO duplicate audit row | PASS ✅ |
| 7 | QoS / QoE (commitment integrity = the "quality of service") | The accepted price, source sent total, accepted version reference, and evidence reference are captured-by-value commitment data (7.2 money impact CRITICAL) — stored immutable, displayed on the job detail from those immutable references, never re-derived (UX-DR26, R-708); the accepted-quote-to-job golden pins the transaction shape + Lovable transactional delta; adjusted-price delta computed with `@/lib/money`, öre discipline re-enforced in the transaction; repeated acceptance/create-job shows the EXISTING job (UX-DR24), not a duplicate or an error | PASS ✅ |
| 8 | Deployability | Three new migrations reset cleanly with per-table policy enumeration + deferred-table absence (no field-worker/schedule/time-material/deviation/ÄTA/invoice/Fortnox table); `verify` job (lockfile, **blocking `pnpm audit --audit-level=high`**, service-role containment, typecheck, lint, unit, build, bundle-containment) + `db` job (`test:int`, `SUPABASE_TEST_REQUIRED=1`) + `e2e` job all present and green; Epic 7 adds NO new runtime dependency | PASS ✅ |

**Also standing:** **Vulnerability management** — 0 critical / 0 high is enforced by the blocking `pnpm audit --audit-level=high` step in the CI `verify` job (`.github/workflows/ci.yml:72`, resolved Epic 6). Epic 7 adds **no new runtime dependency** (pure Postgres RPC + existing `@/lib/money`/`@supabase/*`), so the gate needs no extension and stays green. The vulnerability-management category remains **PASS**.

---

## Performance Assessment

### Response Time (p95) / Throughput / Resource Usage / Scalability (runtime)

- **Status:** N/A (deferred) ⚠️→✅
- **Threshold:** UNKNOWN — no Phase-A SLA/SLO defined for the acceptance-to-job transaction or concurrent-accept throughput (test-design R-718: "acceptance/job transaction latency / concurrent-accept throughput untested — pilot-sized load only, no SLA").
- **Actual:** The acceptance-to-job transaction is a single narrow Postgres RPC over pilot-sized inputs (one quote version → one acceptance + one job + a handful of events) for a single pilot tenant. The adjusted-price delta + acceptance validation are pure synchronous integer-öre transforms in the command layer (`@/lib/money`, `src/features/quotes/acceptance-price.ts`) before the RPC. The RPC's cost is dominated by two `FOR UPDATE` row locks (target version + parent quote) and a small fixed set of inserts inside one transaction — deliberately narrow (ADR-A009), incidentally cheap. No load/latency SLA exists to measure against; no bulk-acceptance path is in scope (Epic 7 non-scope). The concurrency **correctness** proof exists (7.2-INT-06 drives two parallel `Promise.all` accepts ⇒ exactly one job, sleep-free) — but that proves idempotency under contention, not a throughput SLO.
- **Evidence:** `supabase/migrations/20260710120000_accept_quote_and_create_job.sql` (narrow single-txn RPC, `FOR UPDATE` locks); `src/features/quotes/acceptance-price.ts` + `@/lib/money` (pure, no I/O); test-design R-718; epic-7-traceability "Residual (documented): acceptance/job transaction latency / concurrent-accept throughput untested — pilot-sized, no Phase A SLA."
- **Findings:** Correctly deferred. Functional correctness (isolation + idempotency + atomicity + accepted-state immutability + öre discipline) — not throughput/latency — is the Phase-A concern. **Carried-forward action (post-pilot):** if an acceptance-throughput or bulk-acceptance SLA emerges, add a concurrency profile for `accept_quote_and_create_job` under a realistic tenant fan-out and a micro-benchmark for the pure adjusted-price path. The concurrency-correctness test (7.2-INT-06) is already row-lock-based, so a perf harness would extend, not rework, the existing coverage.

---

## Security Assessment

### Tenant Isolation — 3 new commitment tables (`quote_acceptances`/`jobs`/`job_events`) (R-701)

- **Status:** PASS ✅ — a headline control of this epic (three tables carrying another tenant's accepted prices + commitments).
- **Threshold:** Every new commitment table must carry direct `tenant_id` + enable+**force** RLS + own-tenant SELECT/INSERT/UPDATE policies + `anon → none` GRANT + **`TENANT_TABLES` enrollment** (H4 gate must green). Composite same-tenant FKs so a child cannot point at another tenant's parent.
- **Actual:** Verified: `20260709120000_acceptance_to_job_model.sql` creates all three with a DIRECT `tenant_id`, enable+force RLS + own-tenant `is_tenant_admin(tenant_id)` SELECT/INSERT/UPDATE policies (no delete — archive via `archived_at`), and composite same-tenant FKs on BOTH `(id, tenant_id)` (acceptance → `quotes`/`quote_versions`/optional evidence `files`; job → `quote_acceptances`/`quote_versions` + customer/facility/contact). `tenant-table-inventory.ts` enrolls all three (plus the reused Epic-6 `quote_events`) with cross-tenant spoof/filter + anon metadata; the shared cross-tenant + anon suites + the compile-exhaustive H4 inventory gate (`rls-inventory-gate.int.test.ts`) therefore cover them automatically — an unenrolled tenant table FAILS CI by design. `acceptance-tables-migration-reset.int.test.ts` (all `describe.skip` removed → green) proves the schema/policy/öre/uniqueness contract per table on a from-empty reset.
- **Evidence:** `supabase/migrations/20260709120000_acceptance_to_job_model.sql`; `tests/integration/rls/tenant-table-inventory.ts`; 7.1-INT-01, 7.1-RLS-01/02, 7.4-RLS-01; shared `cross-tenant-isolation.rls.test.ts` + `anon-path-isolation.rls.test.ts`.
- **Findings:** Structurally correct and machine-enforced. Isolating another tenant's accepted prices + commitments is the highest-impact control in the epic; it is proven, not asserted. The event table (`job_events`) — the "easy to forget" tenant-owned state the test design flagged — is enrolled.

### Cross-Tenant Source-Id Rejection into the Transaction (R-707)

- **Status:** PASS ✅
- **Threshold:** `acceptQuoteAndCreateJob` must not accept a foreign `quote_version_id`, and the evidence link must not accept a foreign file id; a bare non-composite FK is a cross-tenant hole. Cross-tenant failures return the GENERIC code — no existence disclosure.
- **Actual:** Composite same-tenant FKs at the DB (acceptance → version, job → acceptance/version, acceptance → evidence file) plus command-layer `verifyOwnership` re-validation under RLS (zero rows ⇒ `TENANT_ACCESS_DENIED`). The RPC's `FOR UPDATE` on the target version is itself RLS-narrowed — a foreign id resolves to 0 rows and RAISES `QV409`, which the command maps below the generic denial. INT negatives spoof a foreign quote-version id AND a foreign evidence file id; a random/foreign file id into the evidence link produces a generic error, acceptance NOT recorded (no existence disclosure — a UAT-verified path).
- **Evidence:** `accept-quote-and-create-job.int.test.ts` 7.2-INT-05; `acceptance-evidence-link.int.test.ts` 7.1-INT-04; composite same-tenant FK backstops in `20260709120000`; RPC RLS-narrowed `FOR UPDATE` in `20260710120000`.
- **Findings:** Defense-in-depth (DB composite FK + RPC row-lock under RLS + command re-validation). No single-layer trust; no existence disclosure on a foreign id.

### Accepted-State Immutability at BOTH Layers (R-704) — the load-bearing security/data-integrity control

- **Status:** PASS ✅
- **Threshold:** The accepted version reference, acceptance evidence, accepted price, accepted timestamp, channel, source quote total, and job source reference must be immutable through ANY command path (⇒ stable lock code `ACCEPTED_RECORD_LOCKED`) AND through a direct own-tenant authenticated SQL UPDATE (DB trigger/constraint reject) — UI-only locking is a story STOP. Must AGREE with Epic 6 sent-immutability (R-605) and Epic 8.4.
- **Actual:** Proven at both layers, fail-closed by construction. Command: `accepted-record-lock.int.test.ts` 7.4-INT-01 mutates an accepted record via command → exact `ACCEPTED_RECORD_LOCKED`, message leak-free. Database: 7.4-INT-02 issues DIRECT own-tenant authenticated UPDATEs on 6 acceptance + 3 job columns (incl. the deliberately-locked operational columns) → rejected by the `enforce_quote_acceptance_lock()` + jobs source-ref triggers via SQLSTATE `AR704`, while the EXEMPT `archived_at`/`updated_at` stay mutable. The acceptance lock is fail-closed BY CONSTRUCTION — everything except the enumerated exempt set (`archived_at` soft-delete, `updated_at` trigger-owned) is locked-by-default, including identity (`id`/`tenant_id`/`quote_id`/`quote_version_id`), money (`accepted_price_ore`/`source_sent_total_ore`), and channel/timestamp/evidence/reason. Unlike the 6.4 sent-lock there is NO status early-return (an acceptance is always immutable once it exists). 7.4-INT-03 proves accidental-update paths (id-only / empty-patch / bulk) do not mutate, and 7.2 idempotent-retry preserves the record.
- **Evidence:** `supabase/migrations/20260711120000_accepted_record_lock.sql` (`enforce_quote_acceptance_lock` + jobs source-ref lock triggers, `AR704`, `SECURITY INVOKER` + empty search_path, fail-closed comment); `accepted-record-lock.int.test.ts` 7.4-INT-01/02/03 (31 pass, verified RUN not skipped on the live stack); `command-errors.ts` (`ACCEPTED_RECORD_LOCKED` in the union; `AR704`→`ACCEPTED_RECORD_LOCKED` sibling of 6.4 `QV409`→`QUOTE_VERSION_LOCKED`).
- **Findings:** Excellent. This is the audit property migration sign-off and any future correction workflow build on. Proven at both layers, fail-closed by allow-list, verified RUN not skipped on the live Supabase stack. The 7.4 automation expansion deliberately went BEYOND the AC-headline column subset (6/15 acceptance + 3/6 job) toward the full fail-closed tuple — a tightening, not a deferral. AGREES with Epic 6 (R-605 sent-lock) and Epic 8.4 (locked evidence file) — one immutability model at three scopes, as the standing contract requires. UI-only locking (a story STOP) was correctly avoided.

### Acceptance-Evidence File Access / 8.1 Model Activation (R-709)

- **Status:** PASS ✅
- **Threshold:** Activating the `quote_acceptance` owner type on the 8.1 file model must not link a foreign file, the evidence file must not be reachable cross-tenant/anon, and NO competing evidence model may be invented (R-814 single-file-model contract STOP).
- **Actual:** Epic 7 REUSES the 8.1 `files`/`file_links` model + command-layer ownership validation to activate the `quote_acceptance` owner type + `acceptance_evidence` purpose (external reference now; file-upload UX is Epic 8.2) and the `job`/`job_evidence` types (7.3). The evidence link uses the raw `link_existing_file` RPC (a deliberate manual path — single audit row + foreign-file rejection preserved, ratified in the 7.1 review). Evidence-link creation rejects a foreign file id; the job-detail "Öppna bevis" produces a time-limited signed link via the 8.1 signed-access funnel, never a public URL. An acceptance can carry an OPTIONAL file (`evidence_file_id`, composite same-tenant FK) OR a free-text `evidence_reference` (exclusive per capture).
- **Evidence:** `acceptance-evidence-link.int.test.ts` 7.1-INT-04 (foreign file id rejected); `job-read-mapping.int.test.ts` 7.3-INT-01 (own-type links only); `20260709120000` composite same-tenant FK to `files (id, tenant_id)`; the 8.1 file foundation (`20260704120000`, landed before Epic 7).
- **Findings:** Correct — reuses the 8.1 private-file foundation, does not invent a competing evidence-storage model (the R-814 STOP). Full storage-negative breadth (MIME/size/spoofing matrix) is correctly deferred to Epic 8.

### No Public / Unauthenticated Acceptance Surface (7.x-GUARDRAIL)

- **Status:** PASS ✅
- **Threshold:** No public/unauthenticated acceptance endpoint, portal route, webhook, or cron exists (epics.md 7.x explicit non-scope; architecture §5).
- **Actual:** The acceptance-non-scope guardrail (7.x-E2E-01) asserts no public/portal/webhook/cron acceptance route exists; the acceptance UI is reachable only by an authenticated tenant_admin (a logged-out request to `/quotes/<id>` redirects to `/login` — UAT-verified). The RPC is `SECURITY INVOKER` (runs under the caller's RLS, no privileged unauthenticated function).
- **Evidence:** 7.x-E2E-01 (acceptance-non-scope guardrail); `20260710120000` (RPC `SECURITY INVOKER`, "NO service-role app path"); epic-7 state UAT items (logged-out redirect).
- **Findings:** Correct. Mirrors the Epic 6 "no public acceptance endpoint" guardrail; acceptance is an authenticated tenant-admin server command only.

### Data Protection — No PII in fixtures (R-717)

- **Status:** PASS ✅
- **Threshold:** No personnummer/orgnr/name/email/phone/address/secret in any acceptance/job golden fixture; öre values under the 10-digit orgnr-scan boundary.
- **Actual:** `tests/unit/lib/money/golden-pack.test.ts` extends the 4.4 anonymization scan (personnummer `\d{6}-\d{4}`, orgnr `\d{10}`, non-`example.test` email, secret/password/api_key/bearer) over `accepted-price-deltas.json` — the Epic 7 acceptance golden — as an epic blocker regardless of numeric score, REUSING (not forking) the 4.4 scan exactly as the design mandated. Fixtures are anonymized shape-only, origin-labelled.
- **Evidence:** `tests/unit/lib/money/golden-pack.test.ts` (7.x-UNIT-01; part of `pnpm test:unit` in the CI `verify` job); `tests/fixtures/golden/money/accepted-price-deltas.json`.
- **Findings:** Strong. The SEC control that makes the acceptance golden safe to commit; it runs on every PR. Consistent with the Epic 4/5/6 fixture-privacy discipline, extended (not forked) to the acceptance-to-job golden.

### Input Validation / Vulnerability Management

- **Status (input validation):** PASS ✅ — typed `VALIDATION_FAILED` for a missing adjustment reason on a non-zero price delta (re-validated server-side; the client disable is only a mirror — UAT-verified via crafted POST), `ACCEPTANCE_ALREADY_RECORDED` for the idempotency conflict surface, `ACCEPTED_RECORD_LOCKED` for a locked-record mutation; the raw invalid value is never echoed; the write-error mappers map `AR704`/`23505`/`23503`/`42501`/`22P02` with no raw pg message leak.
- **Status (vulnerability management):** PASS ✅ — the blocking `pnpm audit --audit-level=high` gate (resolved Epic 6) remains present; Epic 7 adds NO new runtime dependency, so the gate needs no extension.
- **Threshold:** 0 critical / 0 high dependency vulnerabilities, gated in CI; every invalid/boundary path returns a typed, user-safe failure.
- **Actual:** The CI `verify` job carries the blocking `pnpm audit --audit-level=high` step (`.github/workflows/ci.yml:72`). Epic 7's new surface is pure Postgres (three migrations + one RPC + two lock triggers) and existing TypeScript libraries — no new dependency. Server-side re-validation of the adjustment reason and the sent-state precondition is proven (a crafted POST with a blanked reason + non-zero delta ⇒ generic `VALIDATION_FAILED`).
- **Evidence:** `.github/workflows/ci.yml:72`; `command-errors.ts` union (`ACCEPTANCE_ALREADY_RECORDED`, `ACCEPTED_RECORD_LOCKED`, `COMMAND_CONFLICT` reserved); `capture-quote-acceptance-validation` + `command-errors-acceptance-conflict` + `job-write-error-mapping` unit tests; 7.2-INT-05 (server re-validation).
- **Findings:** Both a strength. Input validation is strong (server truth, client disable is a mirror, no raw-value/pg-message leak); vulnerability management remains covered by the Epic-6 blocking gate with no new dependency to worry about this epic.

---

## Reliability Assessment

### Idempotency + Duplicate Prevention (R-702) — the headline reliability property of this epic

- **Status:** PASS ✅
- **Threshold:** A retried `acceptQuoteAndCreateJob`, a double-submit, or a create-job-after-acceptance-exists must return the EXISTING acceptance + job (never a second acceptance/job/lifecycle transition), enforced by DB uniqueness constraints (one acceptance per version, one job per acceptance) + row locks inside the RPC — a client-only idempotency check is a STOP. Two forms: sequential retry AND true concurrency.
- **Actual:** Enforced at the DATABASE. `quote_acceptances.unique(quote_version_id)` = one acceptance per accepted version; `jobs.unique(quote_acceptance_id)` = one job per acceptance. The narrow RPC row-locks the target version (`FOR UPDATE`, RLS-narrowed) + the parent quote (`FOR UPDATE`), then short-circuits: an existing acceptance for the version RETURNS the existing acceptance + job with no second insert or lifecycle write. Under a concurrency race, one path INSERTs and the other either takes the short-circuit or hits the unique constraint (`23505` → `ACCEPTANCE_ALREADY_RECORDED`) — NEVER two jobs. 7.2-INT-02 (retry returns existing ids, no second row + NO duplicate audit row), 7.2-INT-03 (direct second insert violates the DB constraint), 7.2-INT-06 (two parallel `Promise.all` accepts ⇒ exactly one job, sleep-free), 7.2-INT-08 (closed-transition idempotency edges) — all present and green.
- **Evidence:** `supabase/migrations/20260709120000` (both unique backstops); `20260710120000` (`FOR UPDATE` locks + idempotent short-circuit + `23505`→`ACCEPTANCE_ALREADY_RECORDED`); `accept-quote-and-create-job.int.test.ts` 7.2-INT-02/03/06/08.
- **Findings:** The headline proof, in both its forms — sequential retry AND true concurrency — enforced where it must be (the database), not by a client check (the STOP the design guarded against). A retried accept appends NO duplicate event/audit row (idempotent re-entry short-circuits before insert). This is the property that keeps a customer commitment from silently forking.

### Atomicity / No Partial State (R-703, NFR20)

- **Status:** PASS ✅
- **Threshold:** Acceptance + quote/version lifecycle update + job insert + quote/job/audit events must commit OR roll back together; a mid-transaction failure must leave NOTHING (no orphaned acceptance, no half-accepted quote, no job with no acceptance, no dangling event). Behavioral rollback proof, not a field-exists check.
- **Actual:** ALL of acceptance + lifecycle update + job insert + `quote_events`/`job_events` writes happen in ONE narrow-RPC transaction (ADR-A009); the command-envelope `audit_events` row mirrors mark-sent/create/pdf (single audit row per command). `7.2-INT-04` injects a mid-transaction fault via a test-only `__faultInject` at step boundaries and asserts the end state is empty — no acceptance, no lifecycle change, no job, no event — a behavioral rollback proof below the command layer, matching architecture §13 step 10 "commit or roll back all changes together." `7.2-INT-07` + `7.2-INT-01` assert every expected event/audit row is present on success.
- **Evidence:** `20260710120000` (one-transaction RPC, "the WHOLE txn — no orphaned acceptance/job/event — NFR20"); `accept-quote-and-create-job.int.test.ts` 7.2-INT-04 (rollback), 7.2-INT-01/07 (event/audit completeness).
- **Findings:** NFR20 satisfied behaviorally. The rollback is proven by fault injection at step boundaries, not inferred from a field-exists check — a half-accepted quote that no later epic could trust is provably impossible.

### Job Source-of-Truth (R-708)

- **Status:** PASS ✅
- **Threshold:** The job detail must DISPLAY accepted price / source totals / evidence / source quote version from the IMMUTABLE accepted references, never re-derive or re-read mutable upstream data; source refs non-editable (7.3 AC).
- **Actual:** The job stores immutable source references (accepted version id, acceptance id) at creation; the detail reads accepted price / source totals / evidence from those references (`readJobDetail` projection). `job-source-of-truth.int.test.ts` 7.3-INT-01 mutates mutable upstream source after job creation and asserts the job-detail data is unchanged; the source-version link navigates to the source `/quotes/[quoteId]/versions/[versionId]` (UAT-verified); source refs are display-only.
- **Evidence:** `job-source-of-truth.int.test.ts` 7.3-INT-01; `job-read-mapping.int.test.ts` (list + detail projection); `src/features/jobs/read.ts`.
- **Findings:** Correct. Reuses the three-times-proven capture-by-value / display-not-re-derive discipline (Epic 3 snapshot → Epic 6 quote snapshot) at job scope; the job cannot disagree with the commitment it was created from.

### Deterministic Lifecycle (H1 — no wall-clock) (R-715)

- **Status:** PASS ✅
- **Threshold:** The RPC must take explicit `accepted_at` + command-timestamp parameters, not read `now()` internally, for lifecycle determinism.
- **Actual:** `accepted_at` is an EXPLICIT input (`p_accepted_at`) on both the `quote_acceptances` column and the RPC — "never a wall-clock derivation"; the `accepted` quote event, the `created` job event, and the acceptance all derive their instant from `p_accepted_at`. During the 7.2 dev-story a review finding removed a dead `p_command_at` param + its unit assertion (persisted instants already derive from `p_accepted_at`/`occurred_at` + the audit clock) — a tightening, not a gap.
- **Evidence:** `20260709120000` (`accepted_at` EXPLICIT input, "never a wall-clock derivation"); `20260710120000` (`occurred_at = p_accepted_at`, "the EXPLICIT injected p_accepted_at, H1 — never now()"); 7.2-UNIT-01 (timestamp-injection adapter); epic-7 state `auto_decisions` (dead `p_command_at` removed).
- **Findings:** Deterministic and testable — mirrors Epic 6 mark-sent's injected timestamp. INT drives deterministic timestamps; no internal wall-clock.

### Error Handling / Fault Tolerance

- **Status:** PASS ✅
- **Threshold:** Every invalid/boundary path returns a typed, user-safe failure; multi-step writes never partially apply; the accepted-lock is fail-closed.
- **Actual:** Commands return typed `Result<T, CommandErrorCode>` (never throw); the acceptance-lock trigger is fail-closed by construction (everything not explicitly exempt is locked); the transaction is all-or-nothing (7.2-INT-04); the write-error mappers never leak a raw pg message. Non-sent / cross-tenant / anon accepts return a generic user-safe rejection (7.2-INT-05); the idempotency conflict surface is `ACCEPTANCE_ALREADY_RECORDED`.
- **Evidence:** `accept-quote-and-create-job.int.test.ts` 7.2-INT-04/05; `accepted-record-lock.int.test.ts` 7.4-INT-01/02/03; `command-errors.ts`; the error-handling knowledge fragment.
- **Findings:** Strong fault isolation for the riskiest command in the plan. Failures are observable (typed codes + events), not swallowed; the immutability trigger defaults to locked, not open; the transaction is provably atomic.

### Availability / MTTR / Disaster Recovery

- **Status:** N/A (deferred) ⚠️→✅ — no deployed production runtime/SLO in Phase A; the three new tables add persisted commitment state but no live runtime to fail over.
- **Findings:** Correctly out of scope for Phase A, consistent with Epics 2-6.

### CI Burn-In (Stability)

- **Status:** PASS ✅
- **Threshold:** Deterministic, non-flaky suite; 100% pass; INT/RLS/E2E hard-fail on a missing stack (no silent false-green).
- **Actual:** **1126/1126** unit+golden pass (0 fail) per the 7.4 automation record; full INT **56 files / 641 tests / 0 fail**; E2E **93**; the 7.4 accepted-record-lock suite **31 pass** verified RUN (not skipped) against the live Supabase stack with `/auth/v1/health` polled to 200 (the Kong→GoTrue 502 false-green trap avoided). No active `.skip`/`.only`/`fixme` remains in any Epic 7 test file (all red-phase ATDD scaffolds flipped green). INT/RLS run under `SUPABASE_TEST_REQUIRED=1` (a missing stack is a HARD failure). Count-asserting tests seed `crypto.randomUUID()`; goldens live under `tests/unit/**`.
- **Evidence:** `automation-summary-7-2/7-3/7-4-*.md`; epic-7-traceability-report.md ("Recorded suite state"); `.github/workflows/ci.yml` (`db` job `SUPABASE_TEST_REQUIRED: "1"`).
- **Findings:** Deterministic across the suite. The explicit "verified RUN not skipped on the live stack" evidence for the 7.4 accepted-record-lock suite is exactly the guard the epic-8 retro's post-reset-false-green lesson called for; no false-green.

---

## Maintainability Assessment

### Test Coverage (priority-weighted)

- **Status:** PASS ✅ (trace-coverage) / CONCERNS ⚠️ (line-coverage reporter absent)
- **Threshold:** P0 100% / P1 ≥90% / overall ≥80% priority-weighted (test-design gate); RLS negatives 100% of the 3 new tables; idempotency/atomicity/immutability 100% of their classes.
- **Actual:** Priority-weighted trace coverage is **100%** (23/23 mapped FULL; P0 100% = 15/15, P1 100% = 8/8) — above every deterministic threshold. 39 design test IDs; 34 present as literal labels + 2 extra E2E; the 7 without a same-named file are each covered by another mechanism or explicitly non-gating (see Gaps). No line-coverage % is computed (no `c8`/`nyc` reporter wired) — the same minor forward gap carried since Epics 2-6; priority-weighted trace coverage remains the governing metric.
- **Evidence:** epic-7-traceability-report.md (Coverage Summary + Gate Decision, PASS); no `c8`/`nyc`/coverage step in `package.json`/CI (grep-confirmed absent).
- **Findings:** Coverage of the critical isolation + idempotency + atomicity + accepted-immutability + öre-discipline contract is exhaustive at the correct levels (RLS/INT for isolation & idempotency & atomicity & immutability; UNIT/GOLDEN for the adjusted-price delta & job projection; E2E for the journeys). The missing reporter is a low-priority ergonomics gap, not a correctness gap — **the single remaining standing CONCERNS**, unchanged from Epic 6 (the `pnpm audit` twin was resolved Epic 6 and stays green here).

### Code Quality / Technical Debt

- **Status:** PASS ✅
- **Threshold:** typecheck 0 errors, lint clean; single-source-of-truth (no forked money/öre/VAT authority; reuse the 8.1 file model, the Epic 6 lifecycle machine, the shared RLS inventory); RPC/immutability/projection logic extracted OUT of client islands into pure functions.
- **Actual:** typecheck/lint/build green per the story records + traceability. The adjusted-price delta is computed with `@/lib/money` (no forked total); the acceptance reuses the frozen Epic 6 `draft/sent/accepted/...` state machine (`sent→accepted` flows through the existing sent-lock allow-list unmodified, status transitioned ALONE); the evidence link reuses the 8.1 file model (no competing model); the three tables enroll in the shared `TENANT_TABLES` inventory (no ad-hoc isolation tests). Pure functions (acceptance-price delta, job read projection/filters, timestamp-injection adapter, RPC-result extractor) are extracted from the client islands and unit-pinned (coverage-shape lesson applied).
- **Evidence:** 7.1-7.4 implementation-artifacts (verify green); `src/features/quotes/acceptance-price.ts`; `src/features/jobs/read.ts`; `command-errors.ts` (`AR704`→`ACCEPTED_RECORD_LOCKED` a sibling of the 6.4 lock-code FAMILY, not a fork); epic-7-traceability.
- **Findings:** Low technical debt. The single-authority discipline (one money engine, one lifecycle machine, one file model, one RLS inventory, one lock-code family) prevents the fork/drift the test design targets. The `AR704`/`ACCEPTED_RECORD_LOCKED` code is deliberately a sibling of the 6.4 `QV409`/`QUOTE_VERSION_LOCKED` family — reuse-with-distinct-scope, not a fork.

### Documentation Completeness

- **Status:** PASS ✅
- **Actual:** Each story's Dev Agent Record documents scope guardrails (no public/portal/webhook acceptance; no field-worker/schedule/time-material/deviation/ÄTA/analytics/invoice/Fortnox surface; the correction-boundary STOP), the narrow-RPC decisions (ADR-A009), the DB-trigger immutability design (fail-closed-by-construction, in the migration header verbatim), the intentional Lovable delta (mutable acceptance evidence / client-side multi-step accept vs Phase A's immutable single-transaction model), and reviewer-resolved findings. The test-design + traceability reports enumerate the sanctioned scope decisions and route the owner-gated residuals. Migration headers document the immutability/öre/H1/idempotency framing verbatim.
- **Evidence:** 7.1-7.4 implementation-artifacts; test-design-epic-7.md; epic-7-traceability-report.md; migration headers `20260709120000`/`20260710120000`/`20260711120000`.
- **Findings:** Complete and reconciled; deferred/owner-gated items (R-713 adjusted-price policy, R-714 correction workflow) are logged with owners, not lost.

### Test Quality (from trace/automation review)

- **Status:** PASS ✅
- **Actual:** Tests are mechanism-asserting: idempotency proven at the DB in both forms (sequential retry ⇒ same ids, no second row, no dup audit; concurrency ⇒ `Promise.all` two accepts, one job, sleep-free); atomicity proven behaviorally (injected mid-transaction fault ⇒ empty end state); immutability proven at BOTH layers with exact codes (`ACCEPTED_RECORD_LOCKED` + trigger `AR704`) INCLUDING the accidental-update regressions (id-only / empty-patch / bulk) AND beyond the AC-headline column subset toward the full fail-closed tuple; cross-tenant/anon negatives data-driven off the shared inventory (H4 = compile-exhaustive completeness backstop); the accepted-quote-to-job golden carries the origin-labelling discipline. No happy-path-only criterion detected; no vacuous-green trap (goldens under `tests/unit/**`, count tests seed random UUIDs, injected clocks, live-stack RUN-not-skipped verified).
- **Evidence:** epic-7-traceability-report.md (Traceability Matrix — all FULL; Gaps table); the INT/UNIT/GOLDEN/E2E test inventory; the 7.4 automation expansion (fail-closed tuple beyond the AC subset).
- **Findings:** High test quality — negatives before positives, behavioral idempotency/atomicity/immutability oracles, both-layer immutability proofs, live-stack RUN-not-skipped verification, no vacuous-green traps. The 7.4 expansion tightened the suite (full fail-closed tuple) rather than stopping at the AC subset.

---

## Custom NFR Assessments (Epic-7-specific)

### Database-Level Idempotency + Atomicity of a Multi-Record Transaction (the defining NFR of Epic 7)

- **Status:** PASS ✅
- **Threshold:** A single command must atomically create MULTIPLE immutable records across MULTIPLE tables (acceptance + job + quote/job/audit events + lifecycle transition) and be safe to call twice — idempotency + duplicate-prevention enforced at the DATABASE (uniqueness + row locks), atomicity all-or-nothing (NFR20). This is architecture §13's highest-risk Phase A command.
- **Actual:** Enforced inside one narrow `SECURITY INVOKER` RPC (`accept_quote_and_create_job`): `FOR UPDATE` locks on the target version (RLS-narrowed) + parent quote; sent-state + tenant re-check below the command (race-safe); an idempotent short-circuit that returns the existing acceptance + job on re-entry; `unique(quote_version_id)` + `unique(quote_acceptance_id)` backstops (one acceptance/version, one job/acceptance); multi-row insert (acceptance + job + `quote_events` + `job_events`) all-or-nothing; the audit row written once by the command envelope; explicit `p_accepted_at` (H1); full rollback on any fault (7.2-INT-04). Proven by 7.2-INT-01..08 (happy path, retry, DB-constraint backstop, rollback, cross-tenant/anon/non-sent rejection, concurrency, event/audit completeness + no-dup, closed-transition edges).
- **Evidence:** `supabase/migrations/20260710120000_accept_quote_and_create_job.sql`; `accept-quote-and-create-job.int.test.ts` 7.2-INT-01..08.
- **Findings:** This is the defining NFR guarantee of Epic 7 — the first Phase A transaction to create multiple immutable records atomically AND idempotently under retry. Enforced at the database (uniqueness + row locks), all-or-nothing (NFR20), deterministic (H1), containment-safe (SECURITY INVOKER, no service-role). A client-only idempotency check (the STOP) was correctly avoided.

### Accepted-Commitment Immutability by Two Independent Layers + Correction Boundary

- **Status:** PASS ✅
- **Threshold:** An accepted record must be immutable through the command layer AND at the database (fail-closed, locked-by-default), and Phase A must implement only the BOUNDARY — no correction workflow (a 7.4 STOP); the boundary must not leak a silent-edit back door.
- **Actual:** Command guard (`ACCEPTED_RECORD_LOCKED`) + DB triggers (`enforce_quote_acceptance_lock` + jobs source-ref lock, `AR704`), fail-closed by construction (only `archived_at`/`updated_at` exempt; every commitment/identity/money column locked-by-default; NO status early-return — an acceptance is always immutable once it exists). No normal edit path mutates immutable data (7.4-INT-03 id-only/empty-patch/bulk regressions); the allowed-edit job path (title/status/planned dates) does NOT fight the lock (exempt path). The UI carries a `role=note` lock notice explaining corrections require a "godkänt granskat arbetsflöde", with NO action affordance (explanatory only, R-714 boundary) — verified in 7.4-E2E-01 + UAT. The correction workflow itself is a STOP (owner-gated, R-714).
- **Evidence:** `20260711120000_accepted_record_lock.sql`; `accepted-record-lock.int.test.ts` 7.4-INT-01/02/03; `job-accepted-lock.e2e.spec.ts` 7.4-E2E-01.
- **Findings:** The audit property migration sign-off depends on. Proven at both layers, fail-closed by construction, no silent-edit back door; the boundary explains-but-does-not-offer a correction path (the R-714 STOP honored). AGREES with Epic 6 (R-605) and Epic 8.4 — one immutability model at three scopes.

---

## Quick Wins

1 quick win identified for immediate implementation:

1. **Wire a coverage reporter (`c8`) over `test:unit`** (Maintainability) — LOW — ~1-2 h
   - Emit line-coverage for the pure `src/features/quotes/acceptance-price.ts` + `src/features/jobs/**` + `src/server/commands/quotes/**` surfaces so the pure-logic target has a machine number alongside the (already-100%) priority-weighted trace coverage. Report-only; do not gate on it initially. This is the sole remaining item from the two standing CONCERNS carried since Epic 2 — the other (`pnpm audit`) was closed in Epic 6.

---

## Recommended Actions

### Immediate (Before Release) — CRITICAL/HIGH Priority

None. No CRITICAL/HIGH NFR issue; no release blocker for the Epic-7 deliverable. All five Non-Negotiable epic blockers met and test-proven, including two-layer accepted-immutability verified RUN (not skipped) on the live stack.

### Short-term (Next Milestone) — MEDIUM Priority

1. **Keep the R-713 / R-714 owner-gated residuals visible** — MEDIUM — Owner
   - The exact adjusted-price adjustment policy + accepted-evidence channel set (R-713) and the audited-correction workflow (R-714 — Phase A implements the BOUNDARY only) ship with conservative dev defaults, acceptable under the demo-data-only decision (2026-07-03). **Re-confirm both at any move away from demo-data-only**; both are documented, not silent. Keep the 7.x guardrail + adjusted-price + correction-boundary tests. This is a decision/entry-condition, not a code fix.

### Long-term (Backlog) — LOW Priority

1. **Coverage reporter** — LOW — ~1-2 h — Dev (report-only; the single remaining standing CONCERNS).
2. **Author the two P3 items** — LOW — Dev — the exploratory concurrent-accept fuzz (`7.2-INT-09`) and the DX typed-error unit (`7.x-UNIT-02`); neither gates (core concurrency is proven by 7.2-INT-06, DX substantially covered by the validation + error-mapper units).
3. **Acceptance-throughput / bulk-accept micro-benchmark (R-718)** — LOW — Dev — only if a Phase-A/post-pilot acceptance-throughput or bulk-acceptance SLA emerges; the concurrency-correctness test (7.2-INT-06) is already row-lock-based, so a perf harness would extend, not rework.
4. **`file_links` dedupe on evidence re-link** — LOW — Dev — 8.1 has no `file_links` dedupe uniqueness, so an idempotent retry appends no duplicate link by short-circuiting; if find-or-create-vs-constraint semantics are later wanted, decide with the Story 8.2 upload path (carried 8.1 deferral, not an Epic-7 gap).

---

## Monitoring Hooks

Runtime monitoring is **N/A for Phase A** (no deployed runtime/SLO). The applicable "monitoring" is the CI full-pyramid gate + the acceptance-to-job golden oracle + the H4 inventory gate + the dependency-scan gate:

- [x] **Accepted-quote-to-job golden pack (`accepted-price-deltas.json`)** — the recurring regression oracle; a labelled failure points at the affected accepted-price/transaction assumption. **Owner:** Dev. **Runs:** every PR (`test:unit`).
- [x] **H4 `TENANT_TABLES` inventory gate** — a new commitment table (`quote_acceptances`/`jobs`/`job_events`) left unenrolled FAILS CI (compile-exhaustive). **Owner:** Dev. **Runs:** every PR (`test:int`, `SUPABASE_TEST_REQUIRED=1`).
- [x] **Acceptance/job fixture PII/secret + ORGNR scan** — CI unit gate detects any PII/secret introduced into the acceptance golden. **Owner:** Dev.
- [x] **`pnpm audit --audit-level=high` gate** — detects a newly-disclosed dependency CVE before merge. **Owner:** Ops/Dev. **Runs:** every PR (`verify` job). *(Resolved Epic 6; no new Epic-7 dependency to cover.)*

---

## Fail-Fast Mechanisms

- [x] **Isolation gates (Security):** enable+force RLS + own-tenant policies + composite same-tenant FKs + mandatory `TENANT_TABLES` enrollment (H4 gate) on all 3 new commitment tables — an unenrolled table fails CI. Present.
- [x] **Idempotency + duplicate-prevention gates (Data integrity):** DB `unique(quote_version_id)` + `unique(quote_acceptance_id)` backstops + `FOR UPDATE` row locks + idempotent short-circuit inside the narrow RPC — a duplicate acceptance/job is impossible on retry/double-submit/concurrency. Present.
- [x] **Atomicity gate (Data integrity):** the whole acceptance+job+events+lifecycle in ONE transaction (NFR20) — a mid-transaction fault rolls back everything (7.2-INT-04 behavioral proof). Present.
- [x] **Immutability gates (Data integrity):** accepted-record lock triggers (`AR704`) fail-closed by construction + command `ACCEPTED_RECORD_LOCKED` — an accepted record is unmutable through any path. Present.
- [x] **Validation gates (Security):** typed `VALIDATION_FAILED`/`ACCEPTANCE_ALREADY_RECORDED`/`ACCEPTED_RECORD_LOCKED`/`TENANT_ACCESS_DENIED` + the leak-free write-error mappers — no silent wrong number, raw value/pg message never echoed; adjustment reason re-validated server-side. Present.
- [x] **Dependency-scan gate (Deployability/Security):** blocking `pnpm audit --audit-level=high` in CI. Present *(resolved Epic 6; no new dependency this epic)*.
- [x] **Smoke/fast gate (Maintainability):** the pure `test:unit` suite (1126 unit+golden) is the fast fail-fast gate on every PR. Present.
- [ ] **Rate limiting / circuit breakers:** N/A — no external-facing runtime service surface in Epic 7 (no public/portal/webhook/cron acceptance path by design).

---

## Evidence Gaps

1 evidence gap identified — LOW priority, deliberately deferred (not action-required for the Epic-7 gate):

- [ ] **Line-coverage report** (Maintainability) — **Owner:** Dev — **Deadline:** backlog — **Suggested Evidence:** `c8` lcov over `test:unit` — **Impact:** LOW — priority-weighted trace coverage is 100% (P0 100%); this is an ergonomics number, not a correctness gap. **This is the last of the two concerns carried since Epic 2** (the `pnpm audit` twin was closed in Epic 6 and stays green).

**Still resolved (carried-closed from Epic 6):** dependency-vulnerability scan — the blocking `pnpm audit --audit-level=high` CI step (`.github/workflows/ci.yml:72`) enforces 0 high/critical on every PR; Epic 7 adds no new runtime dependency, so nothing to extend.

**Documented residual (not an evidence gap):** acceptance/job transaction latency + concurrent-accept throughput (R-718) — pilot-sized only, no Phase A SLA; add a concurrency profile + micro-benchmark only if an SLA emerges.

**Documented, dated owner-gated residuals (not evidence gaps):** adjusted-price adjustment policy + accepted-evidence channel set (R-713) and the audited-correction workflow (R-714 — Phase A implements the BOUNDARY only) — conservative dev defaults acceptable under demo-data-only (2026-07-03); re-confirm at any move to real-customer use. Per-person ROT cap carry (R-716) does not affect acceptance (the accepted price is stored as given, not re-derived).

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
| 7. QoS & QoE (commitment integrity) | PASS ✅ |
| 8. Deployability | PASS ✅ |
| **Vulnerability Management (cross-cutting)** | **PASS ✅ (resolved Epic 6; no new dependency this epic)** |
| **Maintainability — line-coverage reporter** | **CONCERNS ⚠️ (sole remaining standing carry, unchanged)** |
| **Overall** | **PASS (advisory) ✅ — 7 PASS, 1 CONCERNS, 0 FAIL** |

**Scoring:** In-scope categories: 7 PASS, 1 CONCERNS (no line-coverage reporter — LOW priority), 0 FAIL. Runtime performance/load (R-718) and availability/DR are N/A — deferred for the internal pilot (no SLA/production runtime yet). No new HIGH-priority NFR issue.

---

## Non-Negotiable Epic Blockers (test-design gate) — all MET

| Blocker | Status | Proven by (verified in-source) |
| --- | --- | --- |
| Every new commitment table (`quote_acceptances`/`jobs`/`job_events`): direct `tenant_id` + enable+force RLS + own-tenant policies + `anon → none` + `TENANT_TABLES` enrollment (H4 green) | MET | migration `20260709120000`; `tenant-table-inventory.ts` (3 tables enrolled); 7.1-INT-01, 7.1-RLS-01/02; shared cross-tenant/anon suites |
| No duplicate acceptance or duplicate job creatable on retry / double-submit / concurrency | MET | DB `unique(quote_version_id)` + `unique(quote_acceptance_id)` + `FOR UPDATE` locks + idempotent short-circuit (`20260710120000`); 7.2-INT-02/03/06/08 |
| No partial acceptance/job state survives a mid-transaction failure (NFR20) | MET | one-transaction RPC (`20260710120000`); 7.2-INT-04 (injected-fault behavioral rollback proof) |
| Accepted immutable fields immutable at BOTH command AND DB layer, fail-closed | MET | `enforce_quote_acceptance_lock` + jobs source-ref lock (`AR704`, `20260711120000`); 7.4-INT-01 (command) + 7.4-INT-02 (direct SQL, 6+3 columns) + 7.4-INT-03 (accidental-update regressions); 31 pass RUN-not-skipped on live stack |
| Fixture privacy enforced by the CI PII/secret + ORGNR scan over the acceptance golden | MET | `golden-pack.test.ts` extended over `accepted-price-deltas.json` (7.x-UNIT-01), REUSING (not forking) the 4.4 scan |

---

## Gate YAML Snippet

```yaml
nfr_assessment:
  date: '2026-07-07'
  epic: 7
  feature_name: 'Acceptance-To-Job Transaction'
  assessment_level: epic
  trace_coverage: '23/23 FULL (100%; P0 15/15=100%, P1 8/8=100%)'
  categories:
    testability_automation: PASS
    test_data_strategy: PASS
    scalability_availability: PASS # harness; runtime N/A (deferred)
    disaster_recovery: N/A # deferred (no production runtime/SLO)
    security: PASS # 3-table isolation + both-layer accepted-immutability + evidence-file reuse + no-public-surface + no-PII
    monitorability: PASS
    qos_qoe: PASS # capture-by-value commitment + display-not-re-derive + idempotent-UX
    deployability: PASS
    vulnerability_management: PASS # resolved Epic 6; no new dependency this epic
    maintainability_coverage_reporter: CONCERNS # no c8/nyc line-coverage reporter (sole remaining carry)
  overall_status: PASS_ADVISORY
  critical_issues: 0
  high_priority_issues: 0
  medium_priority_issues: 1 # keep R-713/R-714 owner-gated residuals visible (decision, not code)
  concerns: 1 # no line-coverage reporter
  blockers: false
  quick_wins: 1 # wire c8 coverage reporter
  evidence_gaps: 1 # line-coverage report
  documented_residuals: # not gaps — surfaced not silent
    - adjusted_price_policy_and_evidence_channels # R-713; re-confirm if real-customer use proposed
    - audited_correction_workflow # R-714; Phase A implements the boundary only (STOP)
    - per_person_rot_cap_carry # R-716; does not affect stored accepted price
    - file_links_no_dedupe_on_evidence_relink # 8.1 carry; decide with Story 8.2
  deferred_na: # not gaps — deferred by Phase-A design
    - runtime_acceptance_transaction_latency_and_concurrency_throughput # R-718 (no SLA, pilot-sized)
    - availability_dr_mttr # no deployed production runtime/SLO
  high_priority_risks_mitigated: # score >=6, proven by active tests
    - R-701 # 3-table isolation + enrollment
    - R-702 # DB idempotency + duplicate-prevention
    - R-703 # atomicity / no-partial-state (NFR20)
    - R-704 # accepted-immutability both layers
    - R-705 # adjusted-price reason + öre discipline
    - R-706 # sent-precondition + cross-tenant rejection
    - R-707 # cross-tenant source-id rejection
    - R-708 # job source-of-truth
    - R-709 # acceptance-evidence file access / 8.1 reuse
    - R-710 # partial event/audit write
    - R-717 # acceptance golden PII scan
  recommendations:
    - 'Keep R-713 (adjusted-price policy) + R-714 (correction workflow) owner-gated residuals visible — re-confirm at any move to real-customer use'
    - 'Wire a coverage reporter (c8) over test:unit — report-only (the sole remaining standing CONCERNS)'
    - 'Author the two P3 items (7.2-INT-09 concurrency fuzz; 7.x-UNIT-02 DX typed error) — neither gates'
    - 'Add an acceptance-throughput / bulk-accept micro-benchmark only if a Phase-A SLA emerges (R-718)'
```

---

## Related Artifacts

- **Test Design:** `_bmad-output/test-artifacts/test-design-epic-7.md`
- **Traceability + Gate (PASS):** `_bmad-output/test-artifacts/traceability/epic-7-traceability-report.md`
- **Prior NFR (format + the single standing concern; pnpm audit resolved there):** `_bmad-output/test-artifacts/nfr-assessment-epic-6.md`
- **Story records:** `_bmad-output/implementation-artifacts/7-{1,2,3,4}-*.md`
- **Automation summaries:** `_bmad-output/test-artifacts/automation-summary-7-{2,3,4}-*.md`
- **Source under assessment:**
  - `src/server/commands/quotes/**` (accept-and-create-job, capture-quote-acceptance, quote-db); `src/features/jobs/**` (read projection, types); `src/features/quotes/acceptance-price.ts`; `src/server/commands/command-errors.ts` + jobs/quotes write-error mappers
  - `supabase/migrations/20260709120000_acceptance_to_job_model.sql`, `20260710120000_accept_quote_and_create_job.sql`, `20260711120000_accepted_record_lock.sql`
- **Evidence Sources:**
  - Unit + golden: `tests/unit/features/quotes/**`, `tests/unit/server/commands/**`, `tests/unit/guardrails/**`; golden `tests/fixtures/golden/money/accepted-price-deltas.json` + the extended scan in `tests/unit/lib/money/golden-pack.test.ts`
  - INT + RLS: `tests/integration/commands/{accept-quote-and-create-job,capture-quote-acceptance,acceptance-evidence-link,accepted-record-lock,job-source-of-truth,update-job}.int.test.ts`, `tests/integration/features/jobs/job-read-mapping.int.test.ts`, `tests/integration/rls/**` (`tenant-table-inventory.ts` — 3 commitment tables enrolled + H4 gate)
  - E2E: `tests/e2e/quotes/{quote-acceptance-capture,quote-accept-create-job}.e2e.spec.ts`, `tests/e2e/jobs/{job-traceability,job-list-deferred-surface,job-accepted-lock}.e2e.spec.ts`
  - CI: `.github/workflows/ci.yml` (`verify` incl. **blocking `pnpm audit --audit-level=high` at line 72** + `db` (`SUPABASE_TEST_REQUIRED=1`) + `e2e` jobs; no `c8`/coverage step)
  - Suite: `pnpm run test:unit` → 1126 pass / 0 fail (per 7.4 automation record + trace report); `test:int` → 56 files / 641 pass; `test:e2e` → 93; the 7.4 accepted-record-lock suite → 31 pass RUN-not-skipped on the live stack

---

## Recommendations Summary

**Release Blocker:** None. 0 FAIL, 0 blocker; all five Non-Negotiable epic blockers met and test-proven — including two-layer accepted-immutability verified RUN (not skipped) on the live Supabase stack.

**High Priority:** None.

**Medium Priority:** Keep the R-713 (adjusted-price policy / accepted-evidence channels) and R-714 (audited-correction workflow — Phase A implements the boundary only) owner-gated residuals visible (decision/entry-condition, not a code fix) — re-confirm at any move to real-customer use.

**Next Steps:** Epic 7's traceability gate is already **PASS** (P0 100% / P1 100% / overall 100%). This NFR assessment concurs: **PASS (advisory)**. Proceed to `*test-review` then epic close / `*retrospective`. The standing carry is stable at one — the LOW-priority line-coverage reporter (the `pnpm audit` twin was resolved Epic 6 and stays green, with no new Epic-7 dependency). None of the residuals weaken any Epic-7 exit criterion.

---

## Sign-Off

**NFR Assessment:**

- Overall Status: PASS (advisory) ✅
- Critical Issues: 0
- High Priority Issues: 0
- Concerns: 1 (no line-coverage reporter — LOW-priority, carried since Epic 2; the `pnpm audit` twin was RESOLVED in Epic 6)
- Evidence Gaps: 1 (line-coverage report — deferred)
- Documented Residuals (surfaced, not silent): adjusted-price policy / accepted-evidence channels (R-713); audited-correction workflow (R-714 — boundary only); per-person ROT cap carry (R-716, no acceptance impact); file_links dedupe on evidence re-link (8.1 carry)
- Deferred N/A (by Phase-A design): runtime acceptance-transaction latency / concurrent-accept throughput (R-718); availability/DR/MTTR

**Gate Status:** PASS (advisory) ✅ — concurs with the epic-7 traceability gate (PASS)

**Next Actions:**

- PASS ✅: Proceed to `*test-review` / epic close / retrospective.
- Carry the 1 standing CONCERNS forward with an owner (line-coverage reporter — unchanged from Epic 6).
- Keep the R-713 / R-714 owner-gated residuals visible; re-confirm at any move to real-customer use.
- Author the two P3 items (7.2-INT-09 concurrency fuzz; 7.x-UNIT-02 DX typed error) if desired — neither gates.

**Generated:** 2026-07-07
**Workflow:** testarch-nfr (epic-level evidence audit)

---

<!-- Powered by BMAD-CORE™ -->
