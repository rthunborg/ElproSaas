---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-06-11'
inputDocuments:
  - C:\ElproSaas\_bmad-output\planning-artifacts\prd.md
  - C:\ElproSaas\_bmad-output\planning-artifacts\architecture.md
  - C:\ElproSaas\_bmad-output\planning-artifacts\epics.md
  - knowledge/risk-governance.md
  - knowledge/test-levels-framework.md
  - knowledge/test-quality.md
  - knowledge/adr-quality-readiness-checklist.md
  - knowledge/overview.md (playwright-utils)
  - knowledge/api-request.md (playwright-utils)
  - knowledge/auth-session.md (playwright-utils)
  - knowledge/recurse.md (playwright-utils)
---

# Test Design Progress

## Step 1: Mode Detection & Prerequisites

- **Mode selected:** System-Level Mode
- **Rationale:** No `_bmad-output/implementation-artifacts/sprint-status.yaml` exists (file-based detection → system-level). Full planning set is present (PRD + Architecture + Epics); per priority rules, system-level runs first.
- **Prerequisites confirmed:**
  - PRD: `_bmad-output/planning-artifacts/prd.md` ✅
  - Architecture/ADR: `_bmad-output/planning-artifacts/architecture.md` ✅
  - Epics (supporting context): `_bmad-output/planning-artifacts/epics.md` ✅

## Step 2: Context & Knowledge Base Loaded

- **Config:** `tea_use_playwright_utils=true`, `tea_use_pactjs_utils=false`, `tea_pact_mcp=none`, `tea_browser_automation=auto`, `test_stack_type=auto`, `risk_threshold=p1`
- **Detected stack:** `fullstack` (planned, from architecture: Next.js App Router + TypeScript + Supabase Auth/Postgres/Storage). Repo is pre-code (docs-only) — no package.json, no test files yet.
- **Playwright Utils profile:** API-only profile loaded (overview, api-request, auth-session, recurse) per detection rule — no test files with `page.goto`/`page.locator` exist yet.
- **Pact/contract testing:** Skipped — disabled in config; monolithic Next.js + Supabase architecture has no service-to-service contracts in Phase A.
- **Browser exploration:** Skipped — no running app exists yet (clean rebuild, pre-implementation).
- **Key extractions:**
  - Tech stack: Next.js App Router, TypeScript, Supabase (Auth/Postgres/Storage/RLS), pnpm (recommended), server-side command layer, PDF generation server-side (library TBD in E5/6 story).
  - Integration points: Supabase platform only; Lovable legacy app as read-only behavioral oracle (fixtures/shadow comparison); no external production integrations in Phase A.
  - NFRs: tenant isolation/RLS (NFR1-8), money/domain correctness (NFR9-15), privacy (NFR16-19), reliability (NFR20-23), performance pilot-sized (NFR24-26), scalability pooled tenancy (NFR27-29), accessibility (NFR30-31), coexistence (NFR32-34), test/quality gates (NFR35-41).
  - Epics: 9 epics, 41 stories (E1 platform, E2 tenant/auth/RLS/audit, E3 CRM/settings/pricing, E4 money/tax/golden fixtures, E5 calculations, E6 quote versions/PDF, E7 acceptance-to-job, E8 files/storage, E9 migration/golden masters/pilot readiness).

## Step 3: Testability Review & Risk Assessment

### 🚨 Testability Concerns (Actionable)

1. **No test-data seeding/factory strategy defined.** Architecture defines `supabase/seed.sql` and two-tenant fixtures, but no per-test factory approach for tenants, auth users, memberships, CRM records, and calculations. Without API/SQL factories, integration and RLS tests will be slow and serially coupled. → Define a factory + seeding contract in the E1/E2 stories (test-only seed scripts or factory helpers using direct DB access in test env).
2. **Clock control is unspecified.** Quote numbering, `accepted_at`, signed-URL expiry, and audit timestamps are time-dependent. No injectable clock is defined in the command layer. → Require commands to take a time source (or DB `now()` discipline) so determinism is testable; expired-signed-URL negative tests need configurable TTL.
3. **PDF renderer undecided and determinism requirements unstated.** Golden-master PDF text/visual comparison requires deterministic rendering (embedded fonts, stable layout, injected timestamps, no locale drift). → E6 PDF story must add determinism acceptance criteria, not just library choice.
4. **Transaction mechanism undecided (AR21).** `acceptQuoteAndCreateJob` integration tests depend on whether it is a Postgres RPC or a server-side transaction adapter. Security-definer RPCs (if chosen) need dedicated negative tests (AR22). → Decide in E2/E7 before test harness is built.
5. **Signed-URL TTL not configurable per environment.** "Short-lived" needs a concrete, test-controllable value to assert expiry behavior without sleeping in tests.
6. **Auth method for test users unspecified.** Supabase Auth login flow (password vs magic link) is not pinned. Magic-link-only auth would significantly complicate automated tests. → Pin password-based test users (or admin API token minting) for the test environment in E2.
7. **Parallel-safety depends on per-test tenant isolation.** `tenant_counters` quote numbering and shared fixtures will collide under parallel workers unless each test/worker creates its own tenant. → Make "one tenant per test worker" an explicit harness rule.

### ✅ Testability Assessment Summary (Strengths)

- **Controllability:** Server-side command layer as plain TypeScript = headless, API-first testing of all business logic (no UI dependency). Pure money/tax logic isolated in `src/lib/money|tax` = fast unit coverage. Idempotency contract makes retry behavior directly assertable.
- **Observability:** Append-only `audit_events` with command/target/correlation fields provide a deterministic assertion surface. Stable error codes (`QUOTE_VERSION_LOCKED`, `TENANT_ACCESS_DENIED`, ...) enable exact negative assertions. Quote lifecycle events are explicit records.
- **Reliability/Reproducibility:** Migration reset from empty DB is a required gate (NFR40). Snapshot model makes quote/PDF content deterministic by design. Two-tenant fixture mandate is already architectural. RLS test matrix is pre-specified in architecture §9.

### Architecturally Significant Requirements (ASRs)

| ID | ASR | Source | Status |
| --- | --- | --- | --- |
| ASR-1 | Pooled multi-tenancy with RLS isolation on every tenant table | NFR1-3, ADR-A002 | ACTIONABLE |
| ASR-2 | Service-role containment; no unauthenticated privileged surface | NFR4-5 | ACTIONABLE |
| ASR-3 | Integer öre money + snapshotted VAT/ROT/grön teknik assumptions | NFR9-10, ADR-A004 | ACTIONABLE |
| ASR-4 | Sent/accepted immutability enforced at DB level (not UI-only) | NFR11-12, ADR-A005 | ACTIONABLE |
| ASR-5 | Transactional, idempotent acceptQuoteAndCreateJob | NFR13, NFR20, AR20 | ACTIONABLE |
| ASR-6 | Private files, server-derived paths, short-lived signed URLs | NFR8, NFR19, ADR-A006 | ACTIONABLE |
| ASR-7 | Golden-master parity vs anonymized Lovable oracle fixtures | NFR32, FR56-57 | ACTIONABLE |
| ASR-8 | Reproducible clean install + migration reset | NFR35, NFR40 | ACTIONABLE |
| ASR-9 | Append-only audit for critical commands and corrections | NFR7, NFR23 | ACTIONABLE |
| ASR-10 | Deferred-scope absence (no Fortnox/supplier/AI/RBAC surface) | FR60-61, NFR29 | ACTIONABLE (guardrail scan) |
| ASR-11 | Pilot-sized performance only; no load targets in Phase A | NFR24-26 | FYI |
| ASR-12 | Baseline accessibility for admin web app | NFR30-31 | FYI |

### Risk Assessment Matrix

| ID | Category | Risk | P | I | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-SEC-1 | SEC | RLS gap on a new/changed tenant table lets Tenant A read/write Tenant B data | 2 | 3 | **6** | RLS policy checklist per migration; cross-tenant negative suite auto-covering every tenant table; CI gate | Dev + QA | E2 onward, every migration |
| R-SEC-2 | SEC | Service-role key reachable from client path or leaked in bundle/logs | 2 | 3 | **6** | Server-only key usage; bundle/env static scan; containment tests; no `.env` in git | Dev | E1-E2 |
| R-SEC-3 | SEC | Cross-tenant file access via storage path spoofing or signed-URL misuse | 2 | 3 | **6** | Server-derived paths; metadata-first authorization; spoofing + expired-URL negative tests | Dev + QA | E8 |
| R-DATA-1 | DATA | Money/VAT/ROT/grön teknik rounding or calculation errors in customer commitments | 2 | 3 | **6** | Pure-function unit suites; property-style rounding tests; golden-master fixtures vs Lovable; accounting sign-off gate | Dev + QA + Accounting | E4, gate before pilot |
| R-DATA-2 | DATA | Sent/accepted quote version mutated (immutability bypass at DB or command level) | 2 | 3 | **6** | DB triggers/constraints + command guards; immutability negative tests incl. direct-update attempts | Dev + QA | E6-E7 |
| R-DATA-3 | DATA | Partial acceptance-to-job state or duplicate jobs on retry | 2 | 3 | **6** | Single transaction + uniqueness constraints; idempotency tests incl. fault injection mid-transaction | Dev + QA | E7 |
| R-DATA-4 | DATA | Real PII/secrets leak into anonymized fixtures, docs, or logs (GDPR) | 2 | 3 | **6** | Anonymization checklist + review step; secret/PII scan in CI; fixture approval before commit | QA + Owner | E9, every fixture PR |
| R-BUS-1 | BUS | Unapproved tax assumptions (ROT/grön teknik/VAT) used for real customer quotes | 2 | 3 | **6** | Estimates labeled + warnings; admin confirmation before send; sign-off register blocks real pilot use | Owner + Accounting | Before pilot cutover |
| R-BUS-2 | BUS | Undetected behavior deltas vs Lovable oracle erode pilot trust | 2 | 2 | 4 | Golden-master comparison harness; documented delta register (expected/bug/unresolved) | QA + Pilot operator | E9 |
| R-TECH-1 | TECH | PDF rendering nondeterminism breaks golden tests; PDF drifts from snapshot | 2 | 2 | 4 | Renderer determinism ACs; text-extraction comparison primary, visual snapshot secondary | Dev | E6 |
| R-TECH-2 | TECH | Security-definer RPC misconfiguration (search_path/privilege escalation) | 1 | 3 | 3 | AR22 approval rule; fixed search_path; membership checks; negative tests per RPC | Dev | E2/E7 |
| R-TECH-3 | TECH | Quote number collision/gaps under concurrent allocation | 2 | 2 | 4 | DB-level counter with row lock; concurrency test; per-tenant scoping | Dev | E6 |
| R-OPS-1 | OPS | Local Supabase/migration-reset flakiness blocks CI gates (Windows/Docker variance) | 2 | 2 | 4 | Pin CLI versions; CI as source of truth; documented local setup; reset gate in CI | Dev | E1 |
| R-OPS-2 | OPS | Audit coverage gaps make corrections/incidents untraceable | 2 | 2 | 4 | Audit-event assertions in every critical-command integration test | Dev + QA | E2 onward |

**High-risk summary (score ≥ 6):** 8 risks — all SEC/DATA/BUS, concentrated on tenant isolation (R-SEC-1..3), customer-commitment integrity (R-DATA-1..3), PII in fixtures (R-DATA-4), and tax sign-off (R-BUS-1). No score-9 blockers. Mitigation priority: RLS/negative-test harness (E2) and money/tax unit+golden coverage (E4) come first because every later epic builds on them.

## Step 4: Coverage Plan & Execution Strategy

### Test Levels Used

- **Unit** — pure TypeScript logic (`src/lib/money`, `src/lib/tax`, snapshot builders, lifecycle guards). No DB.
- **Integration (command/API)** — server commands against local Supabase (migration-reset DB), asserting results, DB state, audit events, error codes.
- **RLS/Storage negative** — parameterized cross-tenant suite running as Tenant A against Tenant B data, for every tenant-owned table and storage bucket.
- **Golden-master** — fixture comparison vs anonymized Lovable oracle (totals, tax blocks, quote lines, PDF text, acceptance/job transitions).
- **E2E (UI)** — Playwright browser tests for the core tenant-admin journeys only; business logic is never validated through UI alone.

### Coverage Matrix (system-level, by capability area)

| # | Area (Epic) | ASR/Risk | Scenario groups | Level(s) | Priority | ~Count |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | Platform reproducibility (E1) | ASR-8, R-OPS-1 | Clean install; typecheck/lint/build; migration reset from empty DB; seed creates 2 tenants | CI gates | P0 | 4 |
| C2 | Tenant access & RLS isolation (E2) | ASR-1, R-SEC-1 | Read/insert/update/delete/command-mismatch/unauthenticated negatives per tenant table (parameterized); membership resolution; tenant context | RLS negative + Integration | P0 | 24+ (8 cases × table groups) |
| C3 | Service-role & privileged-surface containment (E1/E2) | ASR-2, R-SEC-2 | No service key in client bundle/env/logs; no unauthenticated privileged route; route inventory scan | Static scan + Integration | P0 | 4 |
| C4 | Auth & command envelope (E2) | ASR-9, R-OPS-2 | Login, session resolution, command envelope validation, audit event written per critical command (assertion embedded in every command test) | Integration + E2E smoke | P0/P1 | 6 |
| C5 | CRM commands & search (E3) | FR7-12 | CRUD/archive/search for customers, facilities, contacts; primary-contact rule; tenant scoping | Integration | P1 | 12 |
| C6 | Settings & pricing (E3) | FR13-18 | Company identity, terms, VAT defaults, work roles, optional articles; snapshot source contract | Integration + Unit | P1 | 8 |
| C7 | Money/rounding primitives (E4) | ASR-3, R-DATA-1 | Integer öre arithmetic, rounding policy per line/VAT/totals, basis-point VAT, edge values (0, negative, fractional qty) | Unit | P0 | 15 |
| C8 | VAT/ROT/grön teknik engine (E4) | ASR-3, R-BUS-1 | Estimate calculation, caps/rates profile, persons/count, schablon, invalid mixes blocked, warnings emitted, snapshot completeness | Unit + Golden | P0 | 12 |
| C9 | Calculation totals & visibility (E5) | FR19-29 | Section/row totals, margin indicators, hidden rows in totals, options/tillval separation, readiness warnings | Unit + Integration | P0/P1 | 14 |
| C10 | Calculation workspace UX (E5) | UX-DR11-16 | Editor flows, readiness review, snapshot preview | E2E | P2 | 5 |
| C11 | Quote snapshot & numbering (E6) | ASR-4, R-TECH-3 | Version creation snapshot completeness, server-side tenant-scoped numbering, concurrent allocation | Integration | P0/P1 | 8 |
| C12 | Sent immutability & versioning (E6) | ASR-4, R-DATA-2 | Mark-sent locks customer-visible fields/attachments; direct DB update blocked; new version after change; prior versions preserved | Integration + RLS negative | P0 | 8 |
| C13 | PDF generation (E6) | R-TECH-1 | Renders only from snapshot tables; deterministic output; text-extraction golden compare; status states + retry | Integration + Golden | P1 | 6 |
| C14 | Acceptance-to-job transaction (E7) | ASR-5, R-DATA-3 | Happy path; idempotent repeat; duplicate prevention (uniqueness); adjusted price requires reason; mid-transaction fault leaves no partial state; correction boundary | Integration | P0 | 10 |
| C15 | Files & storage security (E8) | ASR-6, R-SEC-3 | MIME/size/entity validation; signed URL authorized + expiry; cross-tenant object access/path spoofing; lifecycle locks; deletion audit | Integration + Storage negative | P0/P1 | 12 |
| C16 | Golden-master parity (E9) | ASR-7, R-BUS-2 | Lovable oracle comparison: calc totals, tax blocks, quote lines, PDF text, acceptance transitions, quote-to-job | Golden | P1 | 10 |
| C17 | Fixture anonymization (E9) | R-DATA-4 | PII/secret scan on fixtures and committed files | Static scan (CI) | P0 | 2 |
| C18 | Core pilot journey (cross-epic) | AC3 | Full CRM→settings→calc→quote→PDF→sent→acceptance→job journey; sent-then-new-version journey; adjusted-price acceptance journey | E2E | P0 (first) / P1 | 3 |
| C19 | Deferred-scope guardrails | ASR-10 | No deferred routes/nav/tables exist (schema + route inventory assertions) | Static scan | P2 | 2 |
| C20 | Accessibility smoke | ASR-12 | Keyboard reachability + accessible error states on core forms | E2E (axe smoke) | P3 | 3 |

**Duplicate-coverage guard:** money/tax logic is unit + golden only (never re-proven via E2E); immutability is integration + DB-constraint negative (UI disabling is not test evidence); E2E covers journeys, not calculations.

**Totals by priority (approx.):** P0 ≈ 55–65 scenarios · P1 ≈ 50–60 · P2 ≈ 12–15 · P3 ≈ 3–5.

### Execution Strategy (PR / Nightly / Weekly)

- **PR (target < 15 min):** unit suites, affected command integration tests, full RLS negative suite (parameterized, fast), static scans (service-role, PII/secrets, deferred-scope). Migration reset runs in CI per PR once migrations exist.
- **Nightly:** full integration suite, full golden-master comparison pack, all E2E journeys, storage negative suite incl. signed-URL expiry, burn-in for new/changed specs.
- **Weekly / pre-cutover:** full regression incl. clean-install-from-scratch verification on a fresh environment, fixture anonymization deep review, pilot acceptance gate report (E9.5).

### Resource Estimates (ranges, test design + implementation effort across epics)

- P0: ~45–65 hours (RLS harness + money/tax suites + acceptance transaction are the bulk)
- P1: ~40–60 hours
- P2: ~10–20 hours
- P3: ~3–6 hours
- **Total: ~100–150 hours**, distributed across E1–E9 story implementation (test-first per story), not a separate phase. Harness setup (factories, two-tenant fixtures, merged Playwright fixtures, CI wiring) accounts for ~20–30 hours of the P0 estimate and lands in E1/E2.

### Quality Gates

| Gate | Threshold |
| --- | --- |
| P0 pass rate | 100% — no exceptions, blocks merge |
| P1 pass rate | ≥ 95% — failures triaged within the story |
| RLS negative coverage | 100% of tenant-owned tables enrolled in the parameterized suite (enforced by table-inventory check) |
| Audit assertions | Every critical command integration test asserts its audit event |
| Unit coverage | ≥ 80% line coverage for `src/lib/money`, `src/lib/tax`, snapshot builders, lifecycle guards |
| High risks (score ≥ 6) | All mitigations implemented and verified before pilot cutover; R-BUS-1 additionally requires owner + accounting/legal sign-off (NFR15) |
| Golden masters | Representative fixture pack passing for calc/quote/PDF/acceptance/job before real pilot use (AC17) |
| Test quality DoD | No hard waits, no conditionals in tests, < 300 lines, < 1.5 min per test, parallel-safe (per-test tenants), self-cleaning |

## Step 5: Outputs Generated & Validated

- **Execution mode:** sequential (single writer chosen for cross-document consistency; subagent capability available but unnecessary for two tightly-coupled documents)
- **Outputs:**
  - `_bmad-output/test-artifacts/test-design-architecture.md` (concerns contract: blockers B1–B3, recommendations H1–H5, risk register, mitigation plans)
  - `_bmad-output/test-artifacts/test-design-qa.md` (execution recipe: dependencies, coverage plan P0–P3, execution strategy, estimates)
  - `_bmad-output/test-artifacts/test-design/ElproSaas-handoff.md` (BMAD integration: risk-to-story mapping, AC requirements, workflow sequence)
- **Checklist validation:** passed — risk IDs unique and consistent across docs; P/I values in range and scores correct; estimates as ranges; execution strategy PR/Nightly/Weekly; architecture doc has no test code or recipe sections; QA doc omits banned bloat sections (gate thresholds folded into Exit Criteria); handoff fully populated; no browser sessions opened; all artifacts under test_artifacts.
- **Open assumptions:** conservative rounding policy until accounting sign-off; password-based test auth pending B2; transaction mechanism pending B3; Lovable fixture access pending E9.
