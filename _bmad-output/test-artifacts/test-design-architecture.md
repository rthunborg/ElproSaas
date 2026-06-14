---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-06-11'
workflowType: 'testarch-test-design'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
---

# Test Design for Architecture: Elpro Phase A (Internal Pilot MVP)

**Purpose:** Architectural concerns, testability gaps, and NFR requirements for review by Architecture/Dev. Serves as a contract between QA and Engineering on what must be addressed before test development begins.

**Date:** 2026-06-11
**Author:** Rasmus (TEA / Murat workflow)
**Status:** Architecture Review Pending
**Project:** ElproSaas
**PRD Reference:** `_bmad-output/planning-artifacts/prd.md`
**ADR Reference:** `_bmad-output/planning-artifacts/architecture.md` (ADR-A001..A008)

---

## Executive Summary

**Scope:** Phase A rebuild of the tenant-admin quote-to-accepted-job workflow as a pooled multi-tenant SaaS foundation: CRM, settings/pricing, calculations, immutable quote versions/PDF/acceptance, transactional job creation, private files, and Lovable golden-master coexistence. Repo is pre-code; this design is the Phase-3 contract for the test strategy built into E1–E9.

**Business Context** (from PRD): Internal pilot for one Swedish electrical contractor. Trust is the success signal — money (integer öre), VAT/ROT/grön teknik snapshots, and immutable customer commitments must be provably correct. No commercial launch pressure; tax/legal sign-off gates real pilot use.

**Architecture** (from ADRs):

- **ADR-A001/A002:** Next.js App Router + TypeScript on Supabase (Auth/Postgres/Storage), pooled tenancy with RLS.
- **ADR-A003:** Server-side command layer owns all sensitive mutations (headless-testable by design).
- **ADR-A004/A005:** Integer öre + basis-point VAT; sent/accepted quote versions immutable via snapshots.
- **ADR-A006/A007:** Private entity-scoped files with signed URLs; Lovable as behavioral oracle only.

**Expected Scale:** Pilot-sized (one real tenant, two-tenant test fixtures). No load targets in Phase A (NFR26).

**Risk Summary:**

- **Total risks:** 14
- **High-priority (≥6):** 8 risks requiring mitigation before pilot cutover
- **Test effort:** ~120–145 scenarios, ~100–150 hours embedded across E1–E9 stories (see QA doc)

---

## Quick Guide

### 🚨 BLOCKERS - Team Must Decide (Can't Proceed Without)

Pre-implementation critical path — these MUST be resolved before QA can build the integration/RLS harness:

1. **B1: Test-data seeding/factory contract** — Define how tests create tenants, auth users, memberships, and domain records (test-only seed scripts or DB-direct factories). Without it, integration/RLS tests are slow and serially coupled. (Owner: Dev, E1/E2)
2. **B2: Test-user auth method** — Pin password-based test users or admin-API token minting for the test environment. Magic-link-only auth would block automated command tests. (Owner: Dev, E2)
3. **B3: Transaction mechanism (AR21)** — Decide narrow Postgres RPC vs server-side transaction adapter for `acceptQuoteAndCreateJob` and `markQuoteVersionSent`. The integration-test harness shape depends on it; security-definer RPCs additionally trigger AR22 negative tests. (Owner: Architect + Dev, E2, latest E7)

**What we need from team:** Complete these 3 items pre-implementation or test development is blocked.

### ⚠️ HIGH PRIORITY - Team Should Validate (We Provide Recommendation, You Approve)

1. **H1: Injectable clock / time discipline** — Commands that produce `accepted_at`, quote numbers, audit timestamps, and signed-URL expiry should accept a time source or use DB `now()` consistently, so determinism is assertable. (Approve: Architect, E2 onward)
2. **H2: Configurable signed-URL TTL per environment** — "Short-lived" needs a concrete, test-controllable value so expiry negative tests don't sleep. Recommend env-configured TTL with a low test value. (Approve: Dev, E8)
3. **H3: PDF determinism acceptance criteria** — The E6 renderer story must require embedded fonts, injected render timestamp, stable layout, and locale-pinned formatting; otherwise golden-master PDF comparison will be flaky. Text extraction is the primary comparison; visual snapshots secondary. (Approve: Dev, E6)
4. **H4: RLS coverage enforcement mechanism** — Recommend a table-inventory check that fails CI when a tenant-owned table is not enrolled in the parameterized cross-tenant negative suite (mitigates R-SEC-1 structurally). (Approve: Dev, E2)
5. **H5: Per-worker tenant isolation rule** — Each test worker creates its own tenant(s) so `tenant_counters` allocation and fixtures are parallel-safe. (Approve: Dev + QA, E2)

**What we need from team:** Review recommendations and approve (or suggest changes).

### 📋 INFO ONLY - Solutions Provided (Review, No Decisions Needed)

1. **Test strategy:** Unit (pure money/tax/snapshot logic) + command integration against local Supabase + parameterized RLS/storage negative suite + golden-master comparison + thin E2E journeys. Business logic is never proven via UI.
2. **Coverage:** ~120–145 scenarios prioritized P0–P3, risk-linked (see QA doc).
3. **Execution:** PR runs everything functional (<15 min target); nightly runs full golden/E2E/storage suites; weekly runs clean-install and pre-cutover checks.
4. **FYI ASRs:** Performance is pilot-sized only (ASR-11, NFR24-26) — no load testing in Phase A. Accessibility is a P3 smoke concern (ASR-12, NFR30).

---

## For Architects and Devs - Open Topics

### Risk Assessment

**Total risks identified:** 14 (8 high-priority ≥6, 5 medium, 1 low)

#### High-Priority Risks (Score ≥6) - IMMEDIATE ATTENTION

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **R-SEC-1** | **SEC** | RLS gap on a new/changed tenant table lets Tenant A read/write Tenant B data | 2 | 3 | **6** | RLS policy checklist per migration; parameterized cross-tenant negative suite over every tenant table; CI inventory gate (H4) | Dev + QA | E2 onward, every migration |
| **R-SEC-2** | **SEC** | Service-role key reachable from client path or leaked in bundle/env/logs | 2 | 3 | **6** | Server-only key usage; bundle/env static scan; containment tests; `.env` out of git | Dev | E1–E2 |
| **R-SEC-3** | **SEC** | Cross-tenant file access via storage path spoofing or signed-URL misuse | 2 | 3 | **6** | Server-derived paths; metadata-first authorization; spoofing + expired-URL negatives | Dev + QA | E8 |
| **R-DATA-1** | **DATA** | Money/VAT/ROT/grön teknik rounding or calculation errors in customer commitments | 2 | 3 | **6** | Pure-function unit suites; rounding-policy tests; golden masters vs Lovable; accounting sign-off gate | Dev + QA + Accounting | E4; gate before pilot |
| **R-DATA-2** | **DATA** | Sent/accepted quote version mutated (immutability bypass at DB or command level) | 2 | 3 | **6** | DB triggers/constraints + command guards; negatives include direct-update attempts | Dev + QA | E6–E7 |
| **R-DATA-3** | **DATA** | Partial acceptance-to-job state or duplicate jobs on retry | 2 | 3 | **6** | Single transaction + uniqueness constraints; idempotency and mid-transaction fault tests | Dev + QA | E7 |
| **R-DATA-4** | **DATA** | Real PII/secrets leak into anonymized fixtures, docs, or logs (GDPR) | 2 | 3 | **6** | Anonymization checklist + review; PII/secret scan in CI; fixture approval before commit | QA + Owner | E9; every fixture PR |
| **R-BUS-1** | **BUS** | Unapproved tax assumptions (ROT/grön teknik/VAT) used for real customer quotes | 2 | 3 | **6** | Estimates labeled + warnings; admin confirmation before send; sign-off register blocks pilot use | Owner + Accounting | Before pilot cutover |

#### Medium-Priority Risks (Score 3-5)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-BUS-2 | BUS | Undetected behavior deltas vs Lovable oracle erode pilot trust | 2 | 2 | 4 | Golden-master harness; delta register (expected/bug/unresolved) | QA + Pilot operator |
| R-TECH-1 | TECH | PDF rendering nondeterminism breaks golden tests | 2 | 2 | 4 | Determinism ACs (H3); text extraction primary | Dev |
| R-TECH-3 | TECH | Quote number collision/gaps under concurrent allocation | 2 | 2 | 4 | DB-level counter with row lock; concurrency test | Dev |
| R-OPS-1 | OPS | Local Supabase/migration-reset flakiness blocks CI gates (Windows/Docker variance) | 2 | 2 | 4 | Pin CLI versions; CI as source of truth; reset gate in CI | Dev |
| R-OPS-2 | OPS | Audit coverage gaps make corrections/incidents untraceable | 2 | 2 | 4 | Audit-event assertion embedded in every critical-command test | Dev + QA |

#### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| R-TECH-2 | TECH | Security-definer RPC misconfiguration (search_path/privilege escalation) | 1 | 3 | 3 | Monitor; AR22 rules + negative tests per RPC if that path is chosen (B3) |

#### Risk Category Legend

TECH: technical/architecture · SEC: security · PERF: performance · DATA: data integrity · BUS: business impact · OPS: operations

---

### Testability Concerns and Architectural Gaps

#### 1. Blockers to Fast Feedback (WHAT WE NEED FROM ARCHITECTURE)

| Concern | Impact | What Architecture Must Provide | Owner | Timeline |
| --- | --- | --- | --- | --- |
| **No seeding/factory contract (B1)** | Integration/RLS tests slow, serially coupled, not parallel-safe | Test-only seed scripts or DB-direct factory helpers creating tenants/users/memberships/domain records | Dev | E1/E2, pre-implementation |
| **Auth method unpinned (B2)** | Cannot mint authenticated test sessions programmatically | Password-based test users or admin-API token minting in test env | Dev | E2 |
| **Transaction mechanism undecided (B3)** | Acceptance-to-job harness shape unknown; AR22 negatives may be required | AR21 decision: narrow RPC vs server transaction adapter | Architect + Dev | E2, latest E7 |

#### 2. Architectural Improvements Needed

1. **Injectable clock (H1)** — Current problem: time-dependent outputs (quote numbers, `accepted_at`, expiry, audit timestamps) have no controllable source. Required change: time-source parameter or consistent DB `now()` discipline. Impact if not fixed: nondeterministic assertions, sleep-based tests. Owner: Dev. Timeline: E2 onward.
2. **Configurable signed-URL TTL (H2)** — Current problem: "short-lived" undefined. Required change: env-configured TTL. Impact: expiry negatives impossible without waiting. Owner: Dev. Timeline: E8.
3. **PDF determinism requirements (H3)** — Current problem: renderer undecided, determinism unstated. Required change: determinism ACs in the E6 story. Impact: flaky golden masters. Owner: Dev. Timeline: E6.

---

### Testability Assessment Summary

#### What Works Well

- Server-side command layer as plain TypeScript: 100% of business logic headless-testable without UI (architecture §5).
- Pure money/tax logic isolated in `src/lib/money|tax`: fast unit coverage of the highest-impact domain (§10, §22).
- Append-only `audit_events` with command/target/correlation fields plus stable error codes: deterministic assertion surface (§5, §15).
- Migration reset from empty DB is already a required gate; two-tenant fixtures and the RLS negative matrix are pre-specified architecturally (§9, §18).
- Snapshot model makes quote/PDF content reproducible by design (§11–12).

#### Accepted Trade-offs (No Action Required)

- **No load/performance testing in Phase A** — pilot-sized internal use only (NFR24-26); revisit at External Beta sizing.
- **No contract testing** — monolithic Next.js + Supabase, no service-to-service contracts in Phase A.
- **Manual migration/coexistence steps (E9)** — classification and delta review are human workflows by design; only fixture comparison is automated.

---

### Risk Mitigation Plans (High-Priority Risks ≥6)

#### R-SEC-1: RLS gap on tenant table (Score: 6) - CRITICAL PATH

1. Add RLS policy checklist to the migration PR template (E2).
2. Build parameterized cross-tenant negative suite (read/insert/update/delete/command-mismatch/unauthenticated) that iterates a tenant-table inventory.
3. Add CI inventory check: new tenant-owned table not enrolled in the suite fails the build (H4).

**Owner:** Dev + QA · **Timeline:** E2, then every migration · **Status:** Planned · **Verification:** suite fails when a policy is deliberately dropped on a scratch branch.

#### R-SEC-2: Service-role exposure (Score: 6)

1. Server-only Supabase admin client module; lint/import rule prevents client-path import.
2. CI static scan of client bundle and committed files for service-role markers; `.env` excluded from git.
3. Integration assertion: no privileged route responds unauthenticated.

**Owner:** Dev · **Timeline:** E1–E2 · **Status:** Planned · **Verification:** scan catches a seeded canary key in a test branch.

#### R-SEC-3: Cross-tenant file access (Score: 6)

1. All file access resolves metadata-first (tenant-owned `files` row) before storage.
2. Negative tests: Tenant A signs/downloads Tenant B object; path spoofing; expired signed URL (needs H2).
3. Generic access-denied responses asserted (no information leak).

**Owner:** Dev + QA · **Timeline:** E8 · **Status:** Planned · **Verification:** storage negative suite green incl. spoofing cases.

#### R-DATA-1: Money/tax errors (Score: 6)

1. Unit suites for öre arithmetic, rounding policy (per line, VAT, totals), basis-point VAT, ROT/grön teknik caps/persons/schablon, invalid mixes.
2. Golden-master fixture pack vs anonymized Lovable totals/tax blocks (E4.4).
3. Accounting/legal sign-off gate before real pilot use (NFR15) — tests label deductions as estimates until then.

**Owner:** Dev + QA + Accounting · **Timeline:** E4; sign-off before cutover · **Status:** Planned · **Verification:** golden pack green; sign-off register entry exists.

#### R-DATA-2: Immutability bypass (Score: 6)

1. DB triggers/constraints block updates to sent/accepted `quote_versions`, `quote_acceptances`, locked file snapshots — independent of command guards.
2. Negative tests attempt mutation through commands AND direct authenticated table updates.
3. Correction workflow tests prove originals preserved + audited (NFR23).

**Owner:** Dev + QA · **Timeline:** E6–E7 · **Status:** Planned · **Verification:** direct-update negatives fail at the database layer, not only in app code.

#### R-DATA-3: Partial acceptance/duplicate jobs (Score: 6)

1. Single transaction for acceptance + job creation (per B3 decision) with row locking.
2. Uniqueness constraints: one acceptance per quote version, one job per acceptance.
3. Tests: idempotent repeat returns existing records; injected mid-transaction failure leaves zero partial rows.

**Owner:** Dev + QA · **Timeline:** E7 · **Status:** Planned · **Verification:** fault-injection test shows full rollback.

#### R-DATA-4: PII in fixtures (Score: 6)

1. Anonymization checklist applied at fixture capture (E9.2); reviewer approval required.
2. CI PII/secret scan over `tests/fixtures/**` and committed docs.
3. No raw legacy exports committed; only anonymized structured fixtures.

**Owner:** QA + Owner · **Timeline:** E9, every fixture PR · **Status:** Planned · **Verification:** scan flags seeded fake-PII canary.

#### R-BUS-1: Unapproved tax assumptions (Score: 6)

1. Deductions rendered as estimates with warnings until sign-off register entries exist (NFR15, PRD assumptions A19–A22).
2. Admin confirmation required before sending quotes containing ROT/grön teknik.
3. Pilot cutover gate (E9.5) blocks real use without owner + accounting/legal sign-off.

**Owner:** Owner + Accounting · **Timeline:** Before pilot cutover · **Status:** Planned · **Verification:** E9.5 acceptance gate report.

---

### Assumptions and Dependencies

#### Assumptions

1. Local Supabase (CLI) is the integration-test substrate locally and in CI; dev/staging/prod Supabase projects are not used for automated tests.
2. The conservative rounding policy (line-level rounding, summed rounded lines — architecture §10) holds until accounting sign-off changes it; tests encode it as the expected policy.
3. Phase A stays admin-only and deferred modules stay absent — the guardrail scan (ASR-10) assumes FR60/61 remain in force.
4. Lovable oracle fixtures can be captured and anonymized with owner cooperation during E9 (fixtures are the only source of golden expectations).

#### Dependencies

1. B1–B3 blocker resolutions — required pre-implementation (E1/E2).
2. Lovable access for fixture capture — required by E9.2.
3. Owner + accounting/legal sign-off (quote numbering, acceptance semantics, VAT/ROT/grön teknik, rounding) — required before pilot cutover (AC21/AC22).

#### Risks to Plan

- **Risk:** Sign-off answers (rounding, accepted-price policy) change after tests encode conservative assumptions.
  - **Impact:** Unit/golden expectations need revision late.
  - **Contingency:** Policy constants isolated in one module + fixture metadata records the assumed policy version, so re-baselining is mechanical.

---

**End of Architecture Document**

**Next Steps for Architecture Team:** resolve B1–B3, approve H1–H5, assign owners/timelines per mitigation plans.
**Next Steps for QA Team:** see companion `test-design-qa.md`; begin harness setup once B1/B2 land.
