---
stepsCompleted:
  - step-01-load-context
  - step-02-define-thresholds
  - step-03-gather-evidence
  - step-04-evaluate-and-score
  - step-05-generate-report
lastStep: step-05-generate-report
lastSaved: '2026-06-29'
workflowType: testarch-nfr-assess
scope: epic-2
mode: advisory_non_blocking
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-2.md
  - _bmad-output/test-artifacts/traceability/epic-2-traceability-report.md
  - _bmad-output/implementation-artifacts/2-1-tenant-admin-login-and-tenant-context-resolution.md
  - _bmad-output/implementation-artifacts/2-2-tenant-membership-schema-rls-helpers-and-two-tenant-fixtures.md
  - _bmad-output/implementation-artifacts/2-3-server-command-envelope-and-minimal-audit-events.md
  - _bmad-output/implementation-artifacts/2-4-security-regression-harness-for-tenant-and-service-role-boundaries.md
  - .github/workflows/ci.yml
  - _bmad-output/test-artifacts/nfr-assessment.md (Epic 1, prior)
---

# NFR Assessment - Epic 2 (Multi-Tenant Foundation: Tenant Access, Admin Auth, RLS, Audit)

**Date:** 2026-06-29
**Epic:** Epic 2 — tenant-admin login + tenant-context resolution (2.1), tenant-membership schema + RLS helpers + two-tenant fixtures (2.2), server command envelope + minimal audit events (2.3), security regression harness for tenant + service-role boundaries (2.4)
**Overall Status:** PASS (advisory) ✅ with 3 forward-looking CONCERNS
**Mode:** ADVISORY / non-blocking (one tier below the blocking `*trace` gate, which returned **CONCERNS** — P0 100%, P1 80%, overall 89%; two P1 surface/level gaps with named owners, no tenant-isolation hole). Sequential single-assessor run (no subagents launched).

---

> Note: This assessment summarizes existing evidence; it does not run tests, builds, load tests, or CI workflows. Evidence was read from the four Epic-2 story files, the epic-2 test design, the epic-2 traceability report, the CI workflow, and prior-story records. The reported green totals (131 unit + 89 DB-backed integration, 0 skipped, on a clean `supabase db reset` → `test:int`) are taken from the Story 2-4 Dev Agent Record and the trace report, not re-executed here.

## Scope Statement (what changed since Epic 1)

Epic 1 was a foundation/infrastructure epic with no runtime surface, so most NFR domains were correctly N/A. **Epic 2 is the security/data-foundation epic** — it lands the first real runtime surface that NFRs can be measured against: Supabase Auth entry, server-side tenant-context resolution, the `tenants`/`tenant_memberships`/`audit_events` schema with RLS, the server command envelope, append-only audit, the two-tenant test factories, and the standing cross-tenant security regression harness. Three NFR domains move from N/A to **assessable and substantially satisfied**:

1. **Security** — this is the epic's reason to exist. Tenant isolation (RLS), auth/authz boundary, service-role containment, anonymous-access denial, privilege-escalation denial, audit append-only, and audit-metadata hygiene are all in-scope and verified by green mechanism-asserting tests.
2. **Reliability (data-integrity slice)** — append-only audit trail, deterministic command timestamps (no sleeps), per-worker test isolation, deterministic migration reset.
3. **Maintainability / Testability** — the placeholder `pnpm test` from Epic 1 is replaced by a real dual-runner suite (node --test units + Vitest DB-backed INT/RLS) wired into CI, plus the standing H4 inventory gate that protects every future epic.

Two domains remain **deliberately N/A / deferred for Phase A**: **runtime performance / load (R-013)** — explicitly out of scope for the internal pilot (single tenant initially, no SLA defined); and **availability / DR / MTTR** — no deployed production runtime with uptime SLOs yet (pilot stage). These are not failures; they are correctly-scoped deferrals with documented owners.

---

## Executive Summary

**Assessment:** 4 PASS, 3 CONCERNS, 0 FAIL across the in-scope categories. Runtime performance/load (R-013) and availability/DR are **N/A — deferred for the internal pilot, no SLA/runtime yet**.

**Blockers:** 0. Nothing in this advisory audit blocks the epic. The non-negotiable security exit criteria (cross-tenant isolation, service-role containment, anonymous-access denial, audit append-only, inventory gate proven to bite) are all satisfied at the running-test level.

**High-priority issues:** 0 new (beyond the two P1 coverage gaps the `*trace` gate already surfaced and owns — UI/E2E tenant-context display, and the DB-backed disabled-membership path).

**Recommendation:** **PASS (advisory).** Epic 2 delivers a strong, test-enforced security foundation: tenant isolation is proven by mechanism-asserting RLS negatives (`42501`/`23514`) across all three tables × four verbs, the service-role-leak control is a built-bundle grep proven to bite, and the H4 inventory gate is live + proven to fail on an unenrolled table (the standing regression mechanism for Epics 3-9). The 3 CONCERNS are all **forward-looking and already owned**: (a) no runtime performance baseline (deliberately deferred, R-013); (b) no dependency-vulnerability scan gate in CI (carried from Epic 1); (c) UI-surface assertion gaps that ride a deferred Playwright runner (the same two P1 gaps from the trace gate). None weakens the tenant boundary.

---

## In-Scope NFR Matrix (categories + thresholds)

| # | Category (in scope) | Threshold / definition of done | Status |
| - | --- | --- | --- |
| 1 | Tenant isolation (RLS) | RLS enabled+forced on every tenant-owned table; cross-tenant SELECT/INSERT/UPDATE/DELETE denied by mechanism (`42501`), not vacuous; data-driven over the table inventory | PASS ✅ |
| 2 | Auth / authz boundary | Server-side auth authority; `getClaims()` re-validation (not `getSession()`); membership-derived tenant (client `tenant_id` never widens); typed user-safe errors; self-grant / role-escalation denied | PASS ✅ |
| 3 | Service-role containment | No service-role key name / JWT value / `NEXT_PUBLIC_*SERVICE_ROLE*` in the built `.next` bundle; check fails-loud if `.next` absent; proven red on a planted token | PASS ✅ |
| 4 | Audit integrity (append-only + metadata hygiene) | `audit_events` UPDATE/DELETE blocked at privilege layer + backstop trigger; metadata allow-list drops secrets/.env/raw-body/PII; deterministic single command timestamp, no sleeps | PASS ✅ |
| 5 | Testability / maintainability (standing gates) | Real dual-runner suite in CI; H4 inventory gate live + proven to bite; per-worker fixture isolation; deterministic migration reset | PASS ✅ |
| 6 | Vulnerability management | 0 critical / 0 high dependency vulns gated in CI | CONCERNS ⚠️ (carried from Epic 1 — no `pnpm audit` gate yet) |
| 7 | UI-surface / route-redirect NFR proof | Executing assertion that the tenant-context UI reflects server authority + anonymous route redirect | CONCERNS ⚠️ (gated E2E; same two P1 gaps the `*trace` gate owns) |
| 8 | Runtime performance / load (auth+RLS under many tenants/rows) | SLO/SLA + k6 load evidence | CONCERNS ⚠️ → effectively N/A this epic (R-013 deferred; no SLA defined; single pilot tenant) |

Runtime categories **N/A this epic:** response-time/throughput SLOs, availability/uptime, MTTR, disaster recovery (no deployed production runtime with an SLA yet — pilot stage).

---

## Performance Assessment

**Status:** N/A this epic (deferred by design) ⚠️→✅. No SLO/SLA is defined for auth/RLS in the PRD or architecture for Phase A, and the internal pilot runs a single tenant initially — there is nothing to load-test against a threshold yet.

### Response Time / Throughput / Resource Usage

- **Status:** N/A (deferred) — no threshold defined, no load test in scope.
- **Threshold:** UNDEFINED for Phase A (the test design lists this as Not-in-Scope: "Performance / load testing of auth & RLS — premature for internal pilot; no SLA defined yet").
- **Evidence:** `test-design-epic-2.md` Not-in-Scope table + R-013 (PERF, score 2 — "Auth/RLS performance under many tenants/rows untested in Phase A → Monitor; defer load testing to a later epic"). The trace report confirms R-013 as `✅ accepted` (DOCUMENT-only, deferred).
- **Findings:** Correctly deferred. The one performance-adjacent design decision worth noting *positively*: the command clock is a **single injectable timestamp (H1)** and tests assert on it deterministically **without sleeps** — so the test suite itself has no time-based flake or artificial latency. The dominant CI wall-clock cost is the one-time `supabase db reset` (~20-min boot bounded by `timeout-minutes: 20`), not per-test execution.

### Scalability (test-suite scalability, the only scalability surface this epic)

- **Status:** PASS ✅ (for the harness; product runtime scalability is N/A/deferred).
- **Evidence:** The cross-tenant RLS negative suite is **parameterized over the tenant-table inventory** and uses **per-worker tenant pairs** (no shared mutable fixture — R-012), so it scales to many tables in minutes and is parallel-safe (`factory-isolation.int.test.ts`). The H4 gate means a new tenant table enrolls by data (one edit), not a copy-pasted parallel suite.
- **Findings:** The test architecture is built to scale across Epics 3-9 without per-table rework. Product/runtime scalability under tenant/row count remains the deferred R-013 concern.

**Carried-forward action:** when a tenant/row scale concern becomes real (post-pilot), run `*nfr-assess` with R-013 brought into scope and add a k6 baseline for the auth/RLS hot path.

---

## Security Assessment

This is the epic's core. Every SEC-category requirement (R-001..R-008) is FULL/green in the trace report; this NFR audit confirms the *evidence quality* (mechanism-asserting, not vacuous).

### Authentication Strength

- **Status:** PASS ✅
- **Threshold:** Server-side auth authority; user re-validated against the IdP (not trusting a client-readable session); no anonymous privileged access.
- **Actual / Evidence:** `resolveTenantContext` re-validates the user via **`getClaims()`** — explicitly **not `getSession()`** (Story 2-1 Completion Notes; the `getUser()`/`getClaims()`-vs-`getSession()` distinction is recorded against verified `@supabase/ssr@0.12.0` guidance). The `(app)/layout.tsx` is a **server** layout that redirects `UNAUTHENTICATED → /login` and is marked `force-dynamic` so protected routes are never statically prerendered. Anonymous callers are denied at the DB/RPC privilege layer (`42501`) across every enrolled table and all three privileged helpers (`anon-path-isolation.rls.test.ts`, `audit-anon-isolation.int.test.ts`, `envelope-failure-modes.int.test.ts` → `UNAUTHENTICATED`, no audit row).
- **Findings:** Strong for Phase A. **Disclosed residual (not a defect):** no automated brute-force/rate-limit/lockout test on `/login` — Supabase Auth provides platform-side throttling; no Phase A threshold is defined and this is appropriate for an internal pilot. Login is password-based per the test design (B2).

### Authorization Controls (tenant isolation + privilege escalation)

- **Status:** PASS ✅
- **Threshold:** Tenant A cannot read/mutate/spoof Tenant B; users cannot self-grant membership or tamper their own role/status; role constrained to `tenant_admin`; `SECURITY DEFINER` helpers resist search-path hijack.
- **Actual / Evidence:**
  - Cross-tenant SELECT/INSERT/UPDATE/DELETE denied on all three tables, asserted by the **denial MECHANISM** — `error.code === "42501"` + `data === null` + an independent BYPASSRLS re-read proving the target row is unchanged (`cross-tenant-isolation.rls.test.ts`). Spoof-INSERT uses a fresh `crypto.randomUUID()` so the denial is the privilege layer (`42501`), not a PK collision (`23505`). This is the hard-won "never a vacuous disjunction" discipline.
  - Self-grant / role-tampering denied (`membership-self-grant.rls.test.ts`); `tenant_admin`-only role + status CHECK enforced (`error.code === "23514"`, `membership-integrity.int.test.ts`).
  - `SECURITY DEFINER` helpers (`is_active_tenant_member`, `is_tenant_admin`) declared with fixed `search_path`; hijack negative proves an adversarial object on a tampered path cannot alter the result (`security-definer-search-path.rls.test.ts`, `helper-semantics.rls.test.ts`); `record_audit_event` hijack negative likewise.
  - Client-supplied `tenant_id` is **ignored entirely** — the tenant is always membership-derived, so a forged id never widens access (`resolve-tenant-context.int.test.ts`, `envelope-failure-modes.int.test.ts` → `TENANT_ACCESS_DENIED`).
- **Findings:** The non-negotiable isolation properties are all proven green by mechanism. **Disclosed, still-accepted Phase A residual (NOT a gap):** `tenant_memberships_select_own` / `audit_events_select_own` scope reads by **tenant** (`is_tenant_admin(tenant_id)`), not by `auth.uid()` — so a (future) multi-admin tenant's admins can read co-members' rows *within their own tenant*, never across a boundary. This is the intended single-admin Phase A design; the `auth.uid()` least-privilege tightening is the explicit RBAC-seam follow-up (deferred-work). The cross-**tenant** boundary the harness enforces holds.

### Data Protection (service-role containment + secret handling)

- **Status:** PASS ✅
- **Threshold:** No service-role key name / secret placeholder / server-only internal in any browser-reachable bundle; the app uses no service-role key in any client path.
- **Actual / Evidence:** The **authoritative R-002 check is the built-bundle grep** `scripts/verify/check-bundle-containment.mjs` (`verify:bundle-containment`), which scans the produced `.next/` for any `*SERVICE_ROLE*` token, the local-demo JWT value, `NEXT_PUBLIC_*SERVICE_ROLE*` names, and a `service_role` JWT shape — and **fails loud if `.next` is absent** (never false-greens). It runs in the CI `verify` job **after `pnpm build`** (order is load-bearing). Proven to bite on planted fixtures (clean → 0; key-name / re-export-symbol / `NEXT_PUBLIC_` / demo-JWT → ≥1; absent `.next` → throws). The source-level pre-build guard `check-service-role-containment.mjs` was broadened (scans `app/**` outside `src/`, `next.config.*` incl. `.cjs`, catches the `LOCAL_SUPABASE_SERVICE_ROLE_KEY` re-export symbol from a `"use client"` path). The app uses **NO service-role key (anon + RLS)**, so the real clean scan is green. User-safe errors are generic Swedish strings with no stack/SQL/value/existence leakage (`tenant-context.ts`, `command-errors.ts`; P2-2 FULL).
- **Findings:** This closes the Epic-1 forward-looking CONCERN (service-role guard was prose-only / source-only in Epic 1) — Epic 2 turns it into an enforced, bite-proven built-bundle gate. **Disclosed best-effort limitation (documented, not a defect):** the rule-3 `service_role`-JWT-shape regex is a best-effort heuristic that a differently-ordered JWT payload can evade by base64url framing; the authoritative catches are the token-name rule and the literal demo-JWT-value rule, and there is no service-role surface in the app to leak. Honestly documented in code + `ci.md` + `quality-gates.md`.

### Vulnerability Management

- **Status:** CONCERNS ⚠️ (low priority; carried forward from Epic 1)
- **Threshold (future):** 0 critical / 0 high dependency vulnerabilities gated in CI.
- **Actual:** No `pnpm audit` / dependency-scan gate is wired into CI. The dependency surface grew modestly in Epic 2 (`@supabase/ssr@0.12.0`, `@supabase/supabase-js@2.108.2`, `pg@8.22.0`, Vitest) — all exact-pinned, no `^`/`~`, frozen-lockfile-installed. Still no automated audit.
- **Findings:** Acceptable for an internal pilot given exact pins + frozen install, but this CONCERN is now **larger than in Epic 1** because the dependency surface includes the auth + DB client libraries. A `pnpm audit` CI gate is the obvious quick win and should land before external exposure.

### Compliance

- **Status:** N/A this epic. Multi-tenant data + RLS now exist, but no PII / regulated-data processing or retention policy is in scope yet (CRM/business data lands Epic 3+). The audit-metadata sanitizer (below) is a forward-positive control for when PII arrives.

---

## Reliability Assessment

Runtime availability/MTTR/DR are N/A (no production runtime/SLA yet). The **data-integrity slice** of reliability IS in scope this epic and is strong.

### Data Integrity — Audit Append-Only

- **Status:** PASS ✅
- **Threshold:** `audit_events` cannot be mutated/deleted through app paths; trustworthy append-only trail.
- **Evidence:** `audit-append-only.int.test.ts` — app-path UPDATE/DELETE denied at the privilege layer (`42501`) **before** the `audit_events_append_only` `BEFORE UPDATE OR DELETE` trigger; the trigger raises even on the privileged path (defense in depth); independent re-read proves no mutation. Cross-tenant audit read/write denied (`audit_events` enrolled in the data-driven inventory). (R-009 green.)
- **Findings:** Both the privilege layer and the trigger backstop are proven — a strong two-layer append-only guarantee.

### Data Integrity — Audit Metadata Hygiene

- **Status:** PASS ✅
- **Threshold:** Secrets / `.env` / raw file contents / raw request bodies / broad free-text PII never persisted; allow-list, not free-form pass-through.
- **Evidence:** `audit-metadata.test.ts` + `audit-metadata-edges.test.ts` — the allow-list sanitizer drops a planted key, an `.env` blob, a raw body, long PII, and control chars; only `reason`/`beforeHash`/`afterHash`/`targetVersion` survive. (R-010 green.)
- **Findings:** Correct allow-list posture — the audit trail cannot become a secret/PII sink.

### Determinism / Non-Flakiness

- **Status:** PASS ✅ (with one disclosed pre-existing flake, owned)
- **Evidence:** Single injectable command timestamp (H1) used for all lifecycle/event/audit fields; `command-clock.test.ts` asserts identical `created_at` across fields under a fixed clock; **no sleep-based timing anywhere** (R-011 green). Per-worker tenant-pair isolation holds under parallel run (R-012 green). Migration reset from empty is deterministic and green (`migration-reset.int.test.ts`, R-007).
- **Disclosed pre-existing flake (NOT an Epic-2/2.4 defect, owned):** re-running `test:int` **multiple times against the same DB without an intervening `supabase db reset`** fails `envelope-audit-write.int.test.ts` ("expected 3 to be 1") — a Story 2.3 test using a **hardcoded `correlationId`** that accumulates rows across non-reset runs. The CI sequence (`db reset → test:int`) is always green. Logged as a NEW deferral with an owner (test-hardening pass) in the Story 2-4 record.
- **Findings:** Determinism is sound. The one flake is non-CI (offends only the repeat-without-reset local workflow) and already owned — worth a quick fix (per-run `crypto.randomUUID()` correlation id) to keep the local dev loop friction-free.

### Fault Tolerance / Health Checks / Circuit Breakers / Retries

- **Status:** N/A this epic. No deployed service, no `/api/health`, no external dependency to retry/break against. The envelope's error taxonomy *is* a graceful-degradation control (transient infra → `SERVER_ERROR`, never masked as a denial; no raw throw crosses the boundary) — but classic reliability mechanisms (circuit breakers, retries, health endpoints) have no runtime surface to apply to yet. Becomes assessable when a deployed runtime + external integrations land (Epic 4+).

### Availability / MTTR / Disaster Recovery

- **Status:** N/A this epic. No production deployment with an uptime SLO; no incident history; no backup/restore drill in scope for the internal pilot. Supabase platform provides managed backups, but no Phase A RTO/RPO threshold is defined to assess against.

---

## Maintainability Assessment

### Test Coverage (the Epic-1 CONCERN is now resolved)

- **Status:** PASS ✅
- **Threshold:** Real automated suite executing in CI (the Epic-1 deferred item).
- **Evidence:** The honest `pnpm test` placeholder from Epic 1 is **replaced** by a real **dual runner**: pure-logic units under `node --test` (`test:unit`) + DB-backed INT/RLS under Vitest 4.1.9 (`test:int`), orchestrated by `scripts/run-tests.mjs`. Reported green: **131 unit + 89 DB-backed integration, 0 skipped** on a clean `supabase db reset → test:int` (exactly the CI sequence). Both runners are wired into `.github/workflows/ci.yml` (`verify` job runs units after lint; `db` job runs INT after `supabase db reset`, gated behind `verify` so a fast type/lint failure doesn't waste the ~20-min Supabase boot). `SUPABASE_TEST_REQUIRED=1` makes a missing stack a HARD CI failure (can never false-green).
- **Findings:** This is the single biggest maintainability advance of the epic and **closes the Epic-1 "automated test coverage" CONCERN**. Coverage is judged by the trace gate at P0 100% / overall 89% (CONCERNS only on two named P1 surface gaps, below). No line-coverage % is computed (no coverage reporter wired) — a minor forward gap, not a defect, since the priority-weighted trace coverage is the governing metric here.

### Standing Regression Mechanism (H4 inventory gate)

- **Status:** PASS ✅
- **Evidence:** The H4 RLS table-inventory gate (`rls-inventory-gate.int.test.ts` + pure `inventory-gate-core.test.ts`) compares the live-schema tenant-owned set against the enrolled `TENANT_TABLES` and **fails CI on any unenrolled table**. **Proven to bite** three ways: a pure-fn unit on a shrunk inventory, a live INT case on a shrunk enrolled set, and a documented manual scratch-branch run (removing `audit_events` → CI red with the exact named message pointing at the inventory module). The per-table metadata helpers were converted to an exhaustive `switch` + `assertNever`, so a future enrollee that forgets its metadata is a **typecheck error**, not a silently-wrong row — making the "enrolls by data" contract compile-safe.
- **Findings:** This is the load-bearing deliverable for the whole rebuild — the standing regression mechanism that forces every later tenant-owned table (Epics 3-9) to enroll or fail CI. It is live, bite-proven, and compile-safe. Excellent.

### Code Quality / Static Analysis

- **Status:** PASS ✅
- **Evidence:** `typecheck` (strict, `isolatedModules`, `@/*`) + `lint` (eslint-config-next) enforced on every PR; exact-pinned toolchain (no `^`/`~`); the dual-runner orchestrator and verify scripts are bare-Node `.mjs` (Windows-safe, no `pnpm run X && Y` chaining). Pure-core extraction pattern (`resolve-tenant-context-core`, `inventory-gate-core`) keeps decision logic unit-testable off-DB.
- **Findings:** Clean, consistent with the Epic-1 posture, extended to the new server/auth/DB code.

### Test Quality

- **Status:** PASS ✅
- **Evidence:** The defining quality signal is the **mechanism-asserting discipline**: DB negatives assert SQLSTATE (`42501` permission denied, `23514` check violation) + independent BYPASSRLS re-read, never a vacuous `error !== null || data.length === 0` disjunction (the most-repeated Story 2.2 review lesson, preserved when 2.4 generalized the suites). Bite-proof units exist for every standing gate (inventory gate, bundle containment, lockfile guard). Code review converged over 3 iterations on Story 2.4 with a clean 0-finding dedicated security review.
- **Findings:** High test quality. Disclosed forward test-hardening items (all owned, none blocking): the `42501`-exact pin is brittle across future Postgres/PostgREST versions (could surface `42883`); the H4 introspection's `tenant_id`-name + FK-to-`public.tenants` heuristic does not yet cover views/materialized views, transitively-tenant-scoped tables, or non-`public` app schemas (no Phase A table is missed — all three are `public` base tables with a direct `tenant_id`); the cross-tenant `audit_events` test could go vacuous if the seed ever returned no id (add a guard). These are gate-DX hardening follow-ups with owners.

### Documentation Completeness

- **Status:** PASS ✅
- **Evidence:** The standing PR contract ("a product PR adding/touching a tenant-owned table MUST enroll it or CI goes red") is documented in `docs/quality/quality-gates.md` (Gate 4) and `docs/quality/ci.md`, citing architecture §9/§18/§19 (not plan numbers, per the Epic-1 action item). The CI active/deferred gate tables are reconciled; the deferred-work ledger is actively maintained (4 items RESOLVED with dates + 1 new logged with owner in Story 2.4 alone). `tests/README.md` documents the dual-runner contract.

### Security-Guardrail Enforcement (the Epic-1 CONCERN is now resolved)

- **Status:** PASS ✅
- **Evidence:** The Epic-1 forward-looking CONCERN ("env-security rules are prose-only; add an automated client-side service-role guard when Epic 2 introduces env consumption") is **directly resolved** by Story 2.1's source guard (CI-wired, bite-proven) + Story 2.4's authoritative built-bundle grep. The rule can no longer silently rot.
- **Findings:** The two Epic-1 forward CONCERNS (automated test coverage; automated service-role guard) are both closed by Epic 2 — exactly as the Epic-1 assessment's carry-forward plan intended.

---

## Custom NFR Assessments

### UI-Surface / Route-Redirect NFR Proof (gated)

- **Status:** CONCERNS ⚠️ (the two P1 gaps the `*trace` gate already owns; non-blocking)
- **Threshold:** An executing assertion that the tenant-context UI reflects the server-resolved tenant, and that an anonymous browser request to an `(app)` route redirects to `/login`.
- **Actual:** The server authority that *drives* the display is FULL/INT-covered (P1-1); the top-bar render is wired (`data-testid="tenant-context"`/`"current-user"`, confirmed HTTP 200 via the dev server). But the only executing UI assertion (`tests/e2e/auth/login-and-tenant-context.e2e.spec.ts`) is `describe.skip`-gated on a Playwright browser runner that is out of Epic-2 scope. Likewise the DB-backed **disabled-membership** failure path is unit-proven only (no live fixture).
- **Findings:** These are **surface/level gaps, not tenant-isolation holes** — identical to the trace gate's two P1 findings, with the same named owners. They are why the blocking trace gate is CONCERNS (not PASS) and why this advisory NFR audit mirrors that as a CONCERN rather than a PASS on the UI-surface dimension.

---

## Quick Wins

3 low-effort, high-leverage items (none required for epic sign-off — all forward-looking):

1. **Add a `pnpm audit` dependency-vulnerability gate to CI** (Security/Maintainability) — LOW priority — small. Cheap; closes the vulnerability-management CONCERN now that the auth + DB client libraries are in the dependency surface. Carried from Epic 1 and now more relevant.
2. **Fix the non-CI flake in `envelope-audit-write.int.test.ts`** (Reliability/Test-quality) — LOW priority — small. Replace the hardcoded `correlationId` with a per-run `crypto.randomUUID()` so repeat-without-reset local runs stay green. Already logged with an owner.
3. **Wire a coverage reporter** (Maintainability) — LOW priority — small. The priority-weighted trace coverage governs gate decisions, but a line/branch coverage number (e.g. via the Vitest coverage provider) would make the maintainability signal quantitative.

---

## Recommended Actions

### Immediate (Before Release) - CRITICAL/HIGH Priority

**None.** No CRITICAL/HIGH NFR action blocks the epic. The two HIGH items below are the trace gate's already-owned P1 gaps, carried at their existing priority — not new blockers.

### Short-term (Next Milestone) - MEDIUM/HIGH Priority

1. **Stand up the gated Playwright E2E runner and un-skip `login-and-tenant-context.e2e.spec.ts`** — HIGH — owner: a later E2E enablement task. Closes the UI-surface CONCERN (P1-10) + the anonymous route-redirect sub-dimension (G-1) together.
2. **Add a DB-backed disabled-membership fixture + failure-mode case** — MEDIUM — owner: a future test-hardening pass. Promotes P1-2 from PARTIAL to FULL.
3. **Add the `pnpm audit` CI gate** — MEDIUM — owner: a near-term CI-hardening step. Closes the vulnerability-management CONCERN.

### Long-term (Backlog) - LOW Priority

1. **Bring R-013 (auth/RLS performance) into scope post-pilot** — LOW — owner: a later epic. Define an SLO and add a k6 baseline for the auth/RLS hot path once tenant/row counts grow.
2. **Gate-DX hardening on the H4 introspection** — LOW — owner: gate-DX follow-up. Cover views/materialized views, transitive FK tenant-scoping, non-`public` app schemas; soften the `42501`-exact pin to tolerate `42883`.

---

## Monitoring Hooks

(Forward-looking — no production runtime to instrument yet; recommended as the pilot deploys.)

### Security Monitoring

- [ ] CI alert on a red `verify:bundle-containment` / `verify:service-role-containment` run — **Owner:** CI-hardening — **Deadline:** at pilot deploy. (The gate already fails the build; an alert surfaces it loudly.)
- [ ] CI alert on a red H4 inventory gate (a tenant table shipped unenrolled) — **Owner:** CI-hardening — **Deadline:** at pilot deploy.

### Reliability Monitoring

- [ ] Audit-write success-rate + append-only-trigger-violation counter (once a runtime exists) — **Owner:** Epic 4+ — **Deadline:** first production runtime.

---

## Fail-Fast Mechanisms

### Validation Gates (Security) — already in place ✅

- [x] H4 RLS inventory gate — fails CI on an unenrolled tenant-owned table (live, bite-proven).
- [x] Built-bundle service-role containment — fails CI on a service-role leak in `.next` (fails-loud if `.next` absent).
- [x] `SUPABASE_TEST_REQUIRED=1` — a missing local stack is a HARD CI failure (no silent false-green).

### Rate Limiting (Performance/Security)

- [ ] No application-level rate limit on `/login` or commands — **Owner:** Epic 4+ / external-beta hardening — relies on Supabase platform throttling for the pilot.

---

## Evidence Gaps (forward-looking; none block Epic 2)

- [ ] **Runtime performance baseline (auth/RLS under load)** — **Owner:** later epic (R-013 deferred). **Suggested evidence:** k6 SLO run. **Impact:** no load characterization for the pilot (single tenant initially).
- [ ] **Dependency vulnerability scan** — **Owner:** near-term CI-hardening. **Suggested evidence:** `pnpm audit` CI job. **Impact:** unscanned (but exact-pinned) dependency surface incl. auth/DB clients.
- [ ] **UI-surface / route-redirect executing assertion** — **Owner:** later E2E enablement task. **Suggested evidence:** un-skipped Playwright E2E. **Impact:** UI tenant-context display + anonymous redirect proven only by wiring + a skipped scaffold (server authority IS INT-covered).
- [ ] **DB-backed disabled-membership path** — **Owner:** future test-hardening pass. **Suggested evidence:** live disabled-membership fixture + failure-mode case. **Impact:** the distinct disabled→no-access decision is unit-proven on the DB side only.
- [ ] **Line/branch coverage number** — **Owner:** CI-hardening. **Suggested evidence:** Vitest coverage report. **Impact:** maintainability coverage is priority-weighted (trace), not quantified as a %.

These are deliberately-deferred follow-ons, each already owned — carried forward, not charged against Epic 2.

---

## Findings Summary (ADR Quality Readiness Checklist lens)

| Category | In scope this epic? | Status |
| --- | --- | --- |
| 1. Testability & Automation | Yes — dual runner live in CI, H4 gate bite-proven, per-worker isolation | PASS ✅ (Epic-1 CONCERN resolved) |
| 2. Test Data Strategy | Yes — two-tenant factories, per-worker pairs, minimal `seed.sql`, local-Supabase-only | PASS ✅ |
| 3. Scalability & Availability | Partial — test-suite scalability PASS; runtime availability N/A (no SLO/deploy) | PASS (harness) / N/A (runtime) |
| 4. Disaster Recovery | No runtime/SLA yet | N/A |
| 5. Security | Yes — isolation, auth boundary, service-role containment, escalation denial all green | PASS ✅ |
| 6. Monitorability / Debuggability / Manageability | Partial — typed error taxonomy + audit trail + CI bite-signals; no runtime APM yet | PASS (in-scope slice) / N/A (runtime APM) |
| 7. QoS / QoE | No runtime SLO/load in scope (R-013 deferred) | N/A (deferred) |
| 8. Deployability | Yes — CI gate sequence extended (migration reset + INT/RLS + bundle grep) without weakening existing gates | PASS ✅ |

**Interpretation:** Every category that *can* be satisfied at this stage is PASS. The two Epic-1 CONCERNS (automated test coverage; automated service-role-guard enforcement) are now **resolved**. The remaining advisory CONCERNS (vulnerability-scan gate, runtime performance, UI-surface proof) are forward-looking with owners and align exactly with the blocking trace gate's CONCERNS posture.

---

## Gate YAML Snippet

```yaml
nfr_assessment:
  date: '2026-06-29'
  epic_id: '2'
  feature_name: 'Multi-Tenant Foundation (tenant-admin auth, membership schema + RLS, command envelope + audit, security regression harness)'
  mode: advisory_non_blocking
  relationship_to_blocking_gate: 'one tier below *trace (which returned CONCERNS: P0 100%, P1 80%, overall 89%); this advisory NFR audit mirrors that posture'
  scope_note: 'Security/data-foundation epic — runtime perf/load (R-013) and availability/DR are deferred N/A for the internal pilot (no SLA/production runtime yet)'
  categories:
    tenant_isolation_rls: PASS
    auth_authz_boundary: PASS
    service_role_containment: PASS
    audit_integrity_append_only_metadata: PASS
    testability_standing_gates: PASS
    vulnerability_management: CONCERNS # no pnpm audit gate yet (carried from Epic 1)
    ui_surface_route_redirect_proof: CONCERNS # gated Playwright E2E (the two P1 trace gaps)
    runtime_performance_load: CONCERNS # R-013 deferred → effectively N/A this epic
    runtime_availability_dr: N/A # no production runtime/SLA yet
  overall_status: PASS # advisory
  blockers: false
  critical_issues: 0
  high_priority_issues: 0 # beyond the two P1 trace gaps already owned
  concerns: 3
  quick_wins: 3
  evidence_gaps: 5
  recommendations:
    - 'PASS (advisory): tenant isolation, auth boundary, service-role containment, audit append-only, and the H4 inventory gate are all green and bite-proven. No epic blockers.'
    - 'Both Epic-1 forward CONCERNS (automated test coverage; automated service-role guard) are now resolved by Epic 2.'
    - 'Carry forward: pnpm audit CI gate; un-skip the Playwright E2E (UI display + anon redirect); DB-backed disabled-membership fixture; bring R-013 perf into scope post-pilot.'
```

---

## Related Artifacts

- **Story Files:** `_bmad-output/implementation-artifacts/2-1…2-4-*.md`
- **Test Design:** `_bmad-output/test-artifacts/test-design-epic-2.md` (risks R-001..R-013, P0/P1/P2 coverage, Not-in-Scope incl. perf/load)
- **Traceability + Gate:** `_bmad-output/test-artifacts/traceability/epic-2-traceability-report.md` (CONCERNS — P0 100%, P1 80%, overall 89%)
- **CI workflow:** `.github/workflows/ci.yml` (`verify` job + `db` job; bundle-containment after build; INT after `supabase db reset`)
- **Prior NFR assessment:** `_bmad-output/test-artifacts/nfr-assessment.md` (Epic 1 — its two carry-forward CONCERNS are resolved here)
- **Key tests/scripts (evidence):** `tests/integration/rls/*` (cross-tenant, anon-path, security-definer, inventory-gate), `tests/integration/commands/*` (envelope, audit append-only, metadata), `scripts/verify/check-bundle-containment.mjs`, `scripts/verify/check-service-role-containment.mjs`
- **Quality/CI docs:** `docs/quality/quality-gates.md` (Gate 4 standing PR contract), `docs/quality/ci.md`

---

## Recommendations Summary

**Release Blocker:** None. The non-negotiable security exit criteria are satisfied at the running-test level.

**High Priority:** Un-skip the gated Playwright E2E (UI tenant-context display + anonymous route redirect) — the two P1 gaps the blocking trace gate already owns.

**Medium Priority:** Add a `pnpm audit` CI gate; add a DB-backed disabled-membership fixture.

**Next Steps:** Proceed past the Epic-2 boundary. The advisory CONCERNS are forward-looking and owned; none weakens the tenant boundary. When the pilot deploys / scales, bring R-013 (auth/RLS performance) into scope and re-run `*nfr-assess` with a k6 baseline.

---

## Sign-Off

**NFR Assessment (advisory, non-blocking):**

- Overall Status: PASS ✅ (advisory)
- Critical Issues: 0 · High Priority: 0 (beyond the two owned P1 trace gaps) · Concerns: 3 (all forward-looking, owned) · Evidence Gaps: 5 (all forward-looking, owned)
- Gate Status: PASS ✅ (advisory) — consistent with, and one tier below, the blocking `*trace` CONCERNS gate

**Next Actions:**

- Proceed past the Epic-2 boundary. Address the two P1 trace gaps (Playwright E2E + DB-backed disabled-membership) and add the `pnpm audit` gate in the next milestone.
- Re-run `*nfr-assess` with R-013 in scope once the pilot deploys / tenant counts grow.

**Generated:** 2026-06-29
**Workflow:** testarch-nfr (advisory mode)

<!-- Powered by BMAD-CORE™ -->
