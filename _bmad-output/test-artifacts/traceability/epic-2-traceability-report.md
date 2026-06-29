---
stepsCompleted:
  - 'step-01-load-context'
  - 'step-02-discover-tests'
  - 'step-03-map-criteria'
  - 'step-04-analyze-gaps'
  - 'step-05-gate-decision'
lastStep: 'step-05-gate-decision'
lastSaved: '2026-06-29'
workflowType: 'testarch-trace'
scope: 'epic-2'
gateType: 'epic'
decisionMode: 'deterministic'
gateDecision: 'CONCERNS'
inputDocuments:
  - '_bmad-output/test-artifacts/test-design-epic-2.md (priority/risk authority — P0/P1/P2 rows)'
  - '_bmad-output/implementation-artifacts/2-1-tenant-admin-login-and-tenant-context-resolution.md'
  - '_bmad-output/implementation-artifacts/2-2-tenant-membership-schema-rls-helpers-and-two-tenant-fixtures.md'
  - '_bmad-output/implementation-artifacts/2-3-server-command-envelope-and-minimal-audit-events.md'
  - '_bmad-output/implementation-artifacts/2-4-security-regression-harness-for-tenant-and-service-role-boundaries.md'
---

# Traceability Matrix & Gate Decision — Epic 2: Tenant Access, Admin Auth, RLS, And Audit Foundation

**Epic:** Epic 2 — Multi-Tenant Foundation (tenant-admin auth, membership schema + RLS, server command envelope + audit, security regression harness)
**Date:** 2026-06-29
**Evaluator:** TEA Agent (Master Test Architect)
**Gate Type:** epic
**Decision Mode:** deterministic

---

> Note: This workflow does not generate tests. Where gaps exist, run `*atdd` / `*automate`
> to create coverage. Priorities (P0/P1/P2/P3) are taken from the epic test-design
> authority (`test-design-epic-2.md` P0/P1/P2 coverage tables); each requirement row cites
> its AC source and Risk Link. Coverage is judged against the actually-present, green test
> suites discovered in `tests/unit/**` and `tests/integration/**` (dual runner: `node --test`
> units + Vitest DB-backed INT/RLS against the local Supabase stack after `supabase db reset`).

## Context

All four Epic 2 stories are implemented. Stories 2-1, 2-2, 2-3 are `done`; Story 2-4 is at
`review` (dev-story complete, code review converged after 3 iterations). Reported green test
totals at the close of Story 2-4: **131 unit (0 skipped) + 89 DB-backed integration (0 skipped)**
on a clean `supabase db reset` → `test:int` run (exactly the CI sequence). The browser E2E
suite (`tests/e2e/auth/login-and-tenant-context.e2e.spec.ts`) remains `describe.skip`-gated
on a Playwright browser runner — the single standing coverage gap, owned by a later E2E task.

---

## PHASE 1: REQUIREMENTS TRACEABILITY

### Coverage Summary

| Priority  | Total Criteria | FULL Coverage | Coverage % | Status   |
| --------- | -------------- | ------------- | ---------- | -------- |
| P0        | 14             | 14            | 100%       | ✅ PASS  |
| P1        | 10             | 8             | 80%        | ⚠️ WARN  |
| P2        | 4              | 3             | 75%        | ⚠️ WARN  |
| P3        | 0              | 0             | 100%       | ✅ n/a   |
| **Total** | **28**         | **25**        | **89%**    | **⚠️**   |

**Legend:** ✅ PASS = meets gate threshold · ⚠️ WARN = below target but non-blocking · ❌ FAIL = below minimum (blocker)

Coverage-status vocabulary: **FULL** = requirement proven by a green, mechanism-asserting
test at the level the test-design demands · **PARTIAL** = the core property is proven but a
named sub-dimension is deferred · **NONE** = no executing test (gated/skipped scaffold only).

---

### Detailed Mapping — P0 (Critical, 100% required)

#### P0-1: Cross-tenant SELECT denied on `tenants`/`tenant_memberships`/`audit_events` — 2.2 AC2 / 2.3 AC4 (R-001, R-009)
- **Coverage:** FULL ✅
- **Tests:** `tests/integration/rls/cross-tenant-isolation.rls.test.ts` (data-driven over the shared `tenant-table-inventory.ts` `TENANT_TABLES`), `tests/integration/rls/anon-path-isolation.rls.test.ts`
- Tenant A admin reading Tenant B rows → zero rows; asserted by the privilege/RLS mechanism, all three tables enrolled.

#### P0-2: Cross-tenant INSERT/UPDATE/DELETE denied (no spoofed ownership) — 2.2 AC2 (R-001)
- **Coverage:** FULL ✅
- **Tests:** `cross-tenant-isolation.rls.test.ts` — per-verb, per-table; asserts `error.code === "42501"` + `data === null` + independent BYPASSRLS re-read proves the target row unchanged. Spoof-INSERT uses a fresh `crypto.randomUUID()` id so the denial is the privilege layer (`42501`), not a PK collision (`23505`).

#### P0-3: Membership self-grant / role tampering denied — 2.2 AC1/AC3 (R-005)
- **Coverage:** FULL ✅
- **Tests:** `tests/integration/rls/membership-self-grant.rls.test.ts` — app-path (anon-key authenticated) user cannot insert own membership, cannot UPDATE own `role`/`status`/`tenant_id`; denial asserted + independent re-read.

#### P0-4: `tenant_admin`-only role constraint + status CHECK enforced — 2.2 AC1 (R-005)
- **Coverage:** FULL ✅
- **Tests:** `membership-self-grant.rls.test.ts`, `tests/integration/rls/membership-integrity.int.test.ts` — non-`tenant_admin` role and out-of-enum `status` rejected by the DB CHECK (`error.code === "23514"`).

#### P0-5: `SECURITY DEFINER` helpers have fixed `search_path` and resist path hijack — 2.2 AC4 (R-006)
- **Coverage:** FULL ✅
- **Tests:** `tests/integration/rls/security-definer-search-path.rls.test.ts`, `tests/integration/rls/helper-semantics.rls.test.ts` — hijack negative (adversarial object on a tampered `search_path` cannot alter `is_active_tenant_member`/`is_tenant_admin`) + control case; `record_audit_event` hijack negative in `tests/integration/commands/record-audit-event-search-path.int.test.ts`.

#### P0-6: Anonymous cannot reach protected command / privileged function / DB surface — 2.1 AC3 / 2.3 AC (R-003)
- **Coverage:** FULL ✅ (DB + command surface) — route-redirect E2E gated (see Gap G-1; does not reduce P0)
- **Tests:** `tests/integration/commands/envelope-failure-modes.int.test.ts` (anon → `UNAUTHENTICATED`, no audit row), `tests/integration/commands/audit-anon-isolation.int.test.ts` (anon SELECT/INSERT + anon NO-EXECUTE on `record_audit_event`, `42501`), `anon-path-isolation.rls.test.ts` (anon SELECT/INSERT/UPDATE/DELETE on every enrolled table + anon-EXECUTE on all three privileged helpers, `42501`). Per architecture §20 there are NO public privileged routes/functions in Phase A, so the P0 "protected surface" reduces to the DB + RPC surface, which is fully covered. The `(app)`-layout redirect for an anonymous browser request is the gated-E2E sub-dimension only.

#### P0-7: Authenticated user without active membership is denied; no tenant data loaded — 2.1 AC2 (R-004)
- **Coverage:** FULL ✅
- **Tests:** `tests/integration/server/auth/resolve-tenant-context.int.test.ts` (orphan user → `TENANT_MEMBERSHIP_REQUIRED`, zero tenant rows under RLS) + `tests/unit/server/auth/resolve-tenant-context.test.ts`.

#### P0-8: Command rejects client-supplied `tenant_id` mismatch (spoofing) — 2.1/2.3 (R-004)
- **Coverage:** FULL ✅
- **Tests:** `resolve-tenant-context.int.test.ts` (forged client `tenant_id` never reads/widens to Tenant B — tenant is always membership-derived) + `envelope-failure-modes.int.test.ts` ("a client-supplied tenant_id in the input NEVER widens authority — the resolved tenant wins"; cross-tenant target id → `TENANT_ACCESS_DENIED`).

#### P0-9: Command envelope happy path (user→membership→validation→ownership→audit) — 2.3 AC1 (R-003, R-004)
- **Coverage:** FULL ✅
- **Tests:** `tests/integration/commands/envelope-audit-write.int.test.ts` — canonical success: authenticated active admin → membership resolved → valid input → ownership ok → audit row written → typed `ok`.

#### P0-10: `audit_events` append-only — app-path UPDATE/DELETE blocked — 2.3 AC2/AC4 (R-009)
- **Coverage:** FULL ✅
- **Tests:** `tests/integration/commands/audit-append-only.int.test.ts` — app-path UPDATE/DELETE denied at the privilege layer (`42501`) before the `audit_events_append_only` `BEFORE UPDATE OR DELETE` trigger; the trigger raises even on the privileged path; independent re-read proves no mutation.

#### P0-11: Cross-tenant audit read/write denied — 2.3 SEC (R-001, R-009)
- **Coverage:** FULL ✅
- **Tests:** `cross-tenant-isolation.rls.test.ts` with `audit_events` enrolled in the data-driven `TENANT_TABLES`; a seeded Tenant B audit row is denied to Tenant A across all four verbs.

#### P0-12: Service-role containment — no key name / secret / server internal in the built browser bundle — 2.4 AC2 (R-002)
- **Coverage:** FULL ✅
- **Tests:** `scripts/verify/check-bundle-containment.mjs` (`verify:bundle-containment`, CI `verify` job AFTER `pnpm build`) + bite-proof unit `tests/unit/scripts/verify/bundle-containment.test.ts` (clean `.next` → 0 violations; planted key-name / `NEXT_PUBLIC_*SERVICE_ROLE*` / local-demo JWT value / re-export symbol → ≥1; absent `.next` → throws, never false-greens). Broadened source guard `scripts/verify/check-service-role-containment.mjs` + `service-role-containment.test.ts`. The app uses NO service-role key (anon + RLS), so the real clean scan is expected green.

#### P0-13: RLS table-inventory gate fails CI when a tenant-owned table is unenrolled (H4) — 2.4 AC3/AC4 (R-008)
- **Coverage:** FULL ✅
- **Tests:** `tests/integration/rls/rls-inventory-gate.int.test.ts` (live schema tenant-owned set == `{tenants, tenant_memberships, audit_events}`; set-difference against the shared inventory with a named-table failure message; live shrunk-enrolled-set BITES case) + pure-comparison unit `tests/unit/rls/inventory-gate-core.test.ts`. The `tenants` no-`tenant_id` edge case is handled explicitly; `_realtime.tenants` excluded by `public` schema-qualification. Manual scratch-branch verification recorded in the Story 2-4 Dev Agent Record (removing `audit_events` from `TENANT_TABLES` produced a red gate with the exact named message).

#### P0-14: Migration reset from empty DB succeeds; required tables + helpers present — 2.2 AC1 (R-007)
- **Coverage:** FULL ✅
- **Tests:** `tests/integration/rls/migration-reset.int.test.ts` — `supabase db reset` from empty applies the two migrations cleanly; introspection confirms tables, helpers, role/status CHECKs, RLS enabled+forced, the three SELECT-only policies.

---

### Detailed Mapping — P1 (High, ≥90% target / ≥80% minimum)

#### P1-1: Active membership resolves correct tenant context server-side — 2.1 AC1 (R-004)
- **Coverage:** FULL ✅ — `resolve-tenant-context.int.test.ts` (active `tenant_admin` → membership-derived tenant) + unit branches.

#### P1-2: Disabled/inactive membership treated as no-access (distinct from "no membership") — 2.1 test req (R-004)
- **Coverage:** PARTIAL ⚠️
- **Tests (present):** `tests/unit/server/auth/resolve-tenant-context.test.ts` / `resolve-tenant-context-core-edges.test.ts` — `disabled`/`invited` status → `TENANT_MEMBERSHIP_REQUIRED` (distinct case), pure-unit proven; envelope core has the same gate.
- **Gap:** No DB-backed integration fixture creates a user with a `disabled`/`inactive` membership and runs a live `resolveTenantContext`/envelope against it — the integration suite covers only the no-membership (`orphanUser`) variant. The disabled path is unit-only on the DB side.
- **Source:** Story 2-3 Review Findings — `[Review][Defer][Low]` "The disabled-membership failure path is only unit-proven, not DB-backed" (owner: a future test pass).
- **Recommendation:** Add a `disabled`-membership fixture to the two-tenant factory and a DB-backed failure-mode case in `envelope-failure-modes.int.test.ts` / `resolve-tenant-context.int.test.ts`.

#### P1-3: Envelope failure modes — auth / membership / validation / ownership each return a typed user-safe code — 2.3 AC1 (R-003)
- **Coverage:** FULL ✅ — `envelope-failure-modes.int.test.ts` (DB-backed `UNAUTHENTICATED`/`TENANT_MEMBERSHIP_REQUIRED`/`VALIDATION_FAILED`/`TENANT_ACCESS_DENIED`, no audit row on failure) + `envelope-core.test.ts` / `envelope-core-edges.test.ts` (pure gate ordering, `SERVER_ERROR` on transient throw, no-raw-throw at the core boundary).

#### P1-4: Successful audit write records all fields (tenant/actor/command/event/target/correlation/metadata/timestamp) — 2.3 AC2 (R-009, R-010)
- **Coverage:** FULL ✅ — `envelope-audit-write.int.test.ts` field-by-field assertion incl. `created_at == injected command timestamp`.

#### P1-5: Audit metadata hygiene — secrets/.env/raw-file/broad-PII never persisted — 2.3 test req (R-010)
- **Coverage:** FULL ✅ — `tests/unit/server/commands/audit-metadata.test.ts` + `audit-metadata-edges.test.ts` (allow-list sanitizer drops planted key / `.env` blob / raw body / long PII / control chars; only `reason`/`beforeHash`/`afterHash`/`targetVersion` survive).

#### P1-6: Deterministic command timestamp used for lifecycle/event/audit; no sleeps — 2.3 H1 (R-011)
- **Coverage:** FULL ✅ — `tests/unit/server/commands/command-clock.test.ts` (fixed clock → identical `created_at` across fields) + the integration audit-write timestamp assertion; no sleep-based timing anywhere.

#### P1-7: Per-worker tenant-pair isolation holds under parallel run — 2.2 H5 (R-012)
- **Coverage:** FULL ✅ — `tests/integration/rls/factory-isolation.int.test.ts` (unique per-call tenant pair, no shared mutable fixture).

#### P1-8: Harness fails on an intentionally mismatched/weakened access (proves the gate bites) — 2.4 test req (R-001, R-008)
- **Coverage:** FULL ✅ — `rls-inventory-gate.int.test.ts` live shrunk-enrolled-set case + `inventory-gate-core.test.ts` pure shrunk-inventory case + documented manual scratch-branch run (Story 2-4 Dev Agent Record).

#### P1-9: Anonymous privileged-endpoint check across the DB/RPC inventory — 2.4 AC1 (R-003)
- **Coverage:** FULL ✅ — `anon-path-isolation.rls.test.ts` (all four verbs × every enrolled table incl. `audit_events`; anon-EXECUTE `42501` on `is_active_tenant_member`/`is_tenant_admin`/`record_audit_event`).

#### P1-10: Active tenant/company context is displayed in the UI — 2.1 AC1 (R-004)
- **Coverage:** NONE ❌ (no executing test)
- **Tests (present, but gated):** `tests/e2e/auth/login-and-tenant-context.e2e.spec.ts` is `describe.skip(...)` — gated on a Playwright browser runner that is out of Epic 2 scope.
- **Mitigating evidence (not a substitute):** the top-bar render is wired from the server-resolved context (Story 2-1 Task 4), confirmed to render HTTP 200 with the tenant/user region (`data-testid="tenant-context"` / `"current-user"`) via the dev server; the server-side authority that *drives* the display is fully INT-covered (P1-1). What is missing is an executing assertion that the **UI surface** reflects it.
- **Source:** Story 2-1 Completion Notes + deferred-work.md — the login/logout-loop + tenant-context-display E2E is gated on the browser runner (owner: a later E2E enablement task).
- **Recommendation:** Stand up the Playwright runner (a later E2E task) and un-skip `login-and-tenant-context.e2e.spec.ts`; assert the top-bar shows the active tenant + current user, and the `(app)`-layout anonymous redirect to `/login` (closes G-1 too).

---

### Detailed Mapping — P2 (Medium, informational)

#### P2-1: Minimal relevant lifecycle/audit events surface in record context; no analytics module — 2.3 AC3 (R-010)
- **Coverage:** PARTIAL ⚠️ (by design)
- Story 2-3 builds the append-only audit **substrate** only; AC7 explicitly defers the audit-history consumer UI to its own record-context stories. The "no analytics module/dashboard/route/nav item" half is positively asserted by the Story 2-3 scope sweep (`nav-items.ts` still exactly seven; no analytics surface). The "minimal events surface in record context" half has no consumer to assert against yet — intentional, not a defect.
- **Recommendation:** Re-trace when the first audit-history consumer UI story lands (Epic 3+).

#### P2-2: User-safe error messages contain no internal/stack leakage — (R-002)
- **Coverage:** FULL ✅ — generic Swedish messages in `tenant-context.ts` / `command-errors.ts`; envelope + resolver tests assert no raw value / stack / SQL / existence signal crosses the boundary.

#### P2-3: Factory contract extensibility (extends to a CRM-shaped record without rework) — 2.2 B1 (R-012)
- **Coverage:** FULL ✅ (demonstrated) — the Story 2-3 `tests/factories/audit-events.ts` helper was added alongside the two-tenant factories with no reshaping of existing handles, demonstrating the additive B1 contract in practice.

#### P2-4: `verify:lockfiles` guard failure-path regression test (epic-1 highest-priority deferred) — (R-007)
- **Coverage:** FULL ✅ — `tests/unit/scripts/verify/check-lockfiles.test.ts` (red on a planted second lockfile / missing / invalid, green on a valid single `pnpm-lock.yaml`).

#### P3 (Low — tenant-context copy/a11y polish, harness DX, deferred-perf docs)
- Not gate-bearing (cosmetic/DX/docs); harness DX is met (named-table failure message, P3 row). No P3 blocks the gate.

---

## Coverage Heuristics (endpoint / auth / error-path blind-spot scan)

- **Privileged-function / "endpoint" coverage:** Phase A exposes NO public privileged route, function, cron, or webhook (architecture §20). The privileged surface is the DB + three RPCs (`is_active_tenant_member`, `is_tenant_admin`, `record_audit_event`) — all three carry anon-EXECUTE-denied (`42501`) negatives. **No uncovered endpoint.**
- **Auth/authz negative-path coverage:** every gate (unauthenticated, no-membership, disabled-membership, cross-tenant target, self-grant, role/status CHECK, anon EXECUTE) has a denial-path test. The single auth negative that is unit-only on the DB side is the **disabled-membership DB-backed** path (P1-2). **No missing auth negative-path class.**
- **Error-path coverage:** transient-infra → `SERVER_ERROR`, validation → `VALIDATION_FAILED`, ownership error → `SERVER_ERROR` (not masked as denial), Invalid-Date clock → `SERVER_ERROR`, non-UUID correlation/target id → reduced to a safe value (no opaque `22P02` → `SERVER_ERROR`). Error paths are not happy-path-only. **No happy-path-only P0/P1 criterion.**

---

## PHASE 1 SUMMARY

- **Total requirements:** 28 · **Fully covered:** 25 (89%) · **Partially covered:** 2 · **Uncovered:** 1
- **Priority coverage:** P0 14/14 (100%) · P1 8/10 (80%) · P2 3/4 (75%) · P3 n/a
- **Gaps:** Critical (P0) 0 · High (P1) 2 (one NONE + one PARTIAL) · Medium (P2) 1 (by design)
- **Heuristics:** endpoints-without-tests 0 · auth-missing-negative-paths 0 · happy-path-only-criteria 0

### Gap Analysis

#### Critical Gaps (BLOCKER) ❌
**0 gaps.** No P0 requirement is uncovered. P0 = 100%; the epic's load-bearing tenant-isolation,
auth-boundary, append-only-audit, service-role-containment, and inventory-gate properties are all
proven by green, mechanism-asserting tests, and the H4 gate is proven to bite.

#### High Priority Gaps (address before/with epic close) ⚠️
**2 gaps (both High/P1; neither is a security-isolation hole — both are surface/level gaps with named future owners):**

1. **P1-10 — "Active tenant/company context is displayed in the UI" (2.1 AC1) — coverage NONE.**
   - The only test (`tests/e2e/auth/login-and-tenant-context.e2e.spec.ts`) is `describe.skip`-gated on a Playwright browser runner not in Epic 2 scope. The server-side authority that drives the display IS fully INT-covered (P1-1); what is unproven by an executing test is the UI surface assertion (and, on the same gated suite, the `(app)`-layout anonymous→`/login` redirect, tracked as G-1 below).
   - **Owner:** a later E2E enablement task (per deferred-work.md / Story 2-1 Completion Notes).
   - **Recommend:** `2.1-E2E-001` (Playwright) — un-skip the suite, assert top-bar tenant + user render and the anonymous redirect.

2. **P1-2 — "Disabled/inactive membership treated as no-access" (2.1) — coverage PARTIAL (unit-only on the DB side).**
   - The distinct disabled/invited → `TENANT_MEMBERSHIP_REQUIRED` decision is pure-unit proven; no DB-backed fixture exercises a live disabled membership.
   - **Owner:** a future test-hardening pass (Story 2-3 deferred Low).
   - **Recommend:** `2.x-INT-001` — add a disabled-membership fixture + a DB-backed failure-mode case.

#### Medium Gaps (informational) ⚠️
1. **P2-1 — minimal audit events surface in record context — PARTIAL by design** (substrate-only; consumer UI deferred to its own story). Not actionable in Epic 2.

---

## PHASE 2: QUALITY GATE DECISION

### Deterministic Gate Math (per the skill's decision tree)

| Criterion | Required | Actual | Status |
| --- | --- | --- | --- |
| P0 coverage | 100% | **100%** (14/14) | MET |
| Overall coverage | ≥ 80% | **89%** (25/28) | MET |
| P1 coverage | ≥ 90% target / ≥ 80% minimum | **80%** (8/10) | PARTIAL (≥ min, < target) |

Decision-tree evaluation:
- Rule 1 (P0 < 100 → FAIL): **not triggered** — P0 is 100%.
- Rule 2 (overall < 80 → FAIL): **not triggered** — overall is 89%.
- Rule 3 (P1 < 80 → FAIL): **not triggered** — P1 is exactly 80%, not below it.
- Rule 4 (P1 ≥ 90 → PASS): **not met** — P1 is 80%.
- Rule 5 (P1 80–89 with P0 100% and overall ≥ 80% → **CONCERNS**): **triggered.**

### Gate Decision: **CONCERNS** ⚠️

**Rationale:** P0 coverage is 100% and overall coverage is 89% (minimum 80%), so the epic's
load-bearing security and isolation properties are fully proven and there is **no release
blocker** — but P1 coverage is 80% (target 90%), driven by one un-executed UI/E2E criterion
and one DB-backed-disabled-membership sub-dimension, both already owned by named future tasks.
CONCERNS = proceed, but address the two P1 gaps soon (they are surface/level gaps, not
tenant-isolation holes).

### What CONCERNS means here (not a FAIL)
- Every **SEC-category** requirement (R-001..R-008 isolation, auth-boundary, service-role
  containment, audit append-only, inventory gate) is FULL and green → the epic's non-negotiable
  security exit criteria are satisfied at the running-test level.
- The two P1 gaps are a **gated browser E2E** (no runner in scope) and a **DB-backed disabled
  fixture** (unit-proven today). Neither weakens tenant isolation, the command authority, the
  audit append-only invariant, or the standing H4 gate.

### Standing-gate / harness health (epic-specific exit criteria)
- ✅ Cross-tenant RLS negative suite green for `tenants`/`tenant_memberships`/`audit_events` (all four verbs).
- ✅ RLS table-inventory gate (H4) live in CI and **proven to bite** (pure-fn + live-shrunk + manual scratch-branch).
- ✅ Service-role containment green on a clean build, proven red on a planted token (built-bundle grep = authoritative R-002).
- ✅ Anonymous-access negatives green for every protected DB/RPC path (`42501` mechanism).
- ✅ `audit_events` proven append-only (app path can't UPDATE/DELETE; trigger backstops the privileged path); metadata hygiene asserted.
- ✅ Migration reset from empty succeeds; factories build the two-tenant fixture per worker.
- ⚠️ Anonymous-access **route-redirect** + tenant-context **UI display** E2E is gated (G-1 / P1-10) — the DB/command anonymous coverage holds; only the browser-route assertion is deferred.

### Uncovered / under-covered requirements (for human summary + remediation targeting)
1. **2.1 AC1 (UI display) — P1, NONE.** UI tenant/company-context display is only asserted by a skipped E2E. → un-skip under a Playwright runner (later E2E task).
2. **2.1 AC2 (disabled membership) — P1, PARTIAL.** Disabled/inactive → no-access is unit-only on the DB side. → add a DB-backed disabled-membership fixture + case.
3. **2.1 AC3 (anonymous route redirect) — sub-dimension of P0-6, gated-E2E only (G-1).** The anonymous **command/DB/RPC** boundary is FULL; only the `(app)`-layout browser redirect assertion is gated. → same Playwright un-skip closes it. (Does not reduce the P0 score — the privileged surface that P0-6 scopes is the DB/RPC surface, which is fully covered.)

### Recommended Next Actions
1. **[HIGH]** Stand up the gated Playwright E2E runner (later E2E enablement task) and un-skip `tests/e2e/auth/login-and-tenant-context.e2e.spec.ts` — closes P1-10 (UI display) and G-1 (anonymous route redirect) together.
2. **[MEDIUM]** Add a DB-backed disabled-membership fixture + failure-mode case — promotes P1-2 from PARTIAL to FULL.
3. **[LOW]** Re-trace P2-1 (minimal audit surface) when the first audit-history consumer UI lands.
4. **[INFO]** No `*atdd`/`*automate` run is required for any P0 — P0 is complete.

---

## Risk → Coverage Confirmation (R-001..R-013)

| Risk | Score | Mitigation covered by | Status |
| --- | --- | --- | --- |
| R-001 cross-tenant RLS | 6 | cross-tenant-isolation suite (3 tables × 4 verbs) | ✅ green |
| R-002 service-role leak | 6 | check-bundle-containment + source guard + bite units | ✅ green |
| R-003 anonymous privileged access | 6 | anon-path-isolation + envelope/audit anon suites | ✅ green (DB/RPC); route-redirect E2E gated |
| R-004 client tenant spoof | 6 | resolve-tenant-context + envelope-failure-modes | ✅ green |
| R-005 self-grant / escalation | 6 | membership-self-grant + integrity | ✅ green |
| R-006 DEFINER search_path | 6 | security-definer-search-path + record-audit-event-search-path | ✅ green |
| R-007 test-infra readiness | 6 | dual runner + local stack + factories all delivered (2.2) | ✅ satisfied |
| R-008 inventory gate inert | 6 | rls-inventory-gate + inventory-gate-core (bite proven) | ✅ green |
| R-009 audit append-only | 4 | audit-append-only + cross-tenant audit enrollment | ✅ green |
| R-010 audit metadata hygiene | 4 | audit-metadata(+edges) sanitizer units | ✅ green |
| R-011 non-deterministic timestamp | 4 | command-clock + audit-write timestamp assertion | ✅ green |
| R-012 shared-fixture interference | 4 | factory-isolation (per-worker pair) | ✅ green |
| R-013 auth/RLS perf | 2 | DOCUMENT only — deferred to a later epic | ✅ accepted |

**No high-priority risk (≥6) is unmitigated or unwaived.**

---

## Notes on accepted Phase A residuals (disclosed, not gate gaps)
- `tenant_memberships_select_own` / `audit_events_select_own` scope reads by **tenant** (`is_tenant_admin(tenant_id)`), not by `user_id`/`actor_user_id = auth.uid()` — an intra-tenant co-member read in a (future) multi-admin tenant. Accepted, intended Phase A single-admin design; the `auth.uid()` least-privilege tightening is the RBAC-seam follow-up. The cross-**tenant** boundary (the thing the harness enforces) holds. Not a coverage gap.
- `record_audit_event` trusts caller-supplied `p_actor_user_id` (intra-tenant attribution; FK-bounded; single-admin Phase A) — deferred to the RBAC/multi-admin seam. Not a coverage gap.

---

**Generated by:** BMad TEA Agent — Test Architect Module · Workflow `bmad-testarch-trace` · v4.0 (BMad v6)
**Gate decision:** CONCERNS (deterministic) — P0 100%, P1 80%, overall 89%; 0 critical gaps, 2 P1 surface/level gaps with named owners.
