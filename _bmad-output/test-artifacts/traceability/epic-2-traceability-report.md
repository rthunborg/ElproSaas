---
stepsCompleted:
  - 'step-01-load-context'
  - 'step-02-discover-tests'
  - 'step-03-map-criteria'
  - 'step-04-analyze-gaps'
  - 'step-05-gate-decision'
lastStep: 'step-05-gate-decision'
lastSaved: '2026-06-30'
workflowType: 'testarch-trace'
scope: 'epic-2'
gateType: 'epic'
decisionMode: 'deterministic'
gateDecision: 'PASS'
priorGateDecision: 'CONCERNS'
gateFlip: 'CONCERNS → PASS'
reGate: true
inputDocuments:
  - '_bmad-output/test-artifacts/test-design-epic-2-foundation-consolidated.md (consolidated design — P0/P1/P2 authority + the ranked G-1..G-9 gap list)'
  - '_bmad-output/test-artifacts/test-design-epic-2.md (original pre-implementation epic-2 design — risk register R-001..R-013)'
  - '_bmad-output/implementation-artifacts/2-1-tenant-admin-login-and-tenant-context-resolution.md'
  - '_bmad-output/implementation-artifacts/2-2-tenant-membership-schema-rls-helpers-and-two-tenant-fixtures.md'
  - '_bmad-output/implementation-artifacts/2-3-server-command-envelope-and-minimal-audit-events.md'
  - '_bmad-output/implementation-artifacts/2-4-security-regression-harness-for-tenant-and-service-role-boundaries.md'
evidenceVerifiedAgainstRepo: true
---

# Traceability Matrix & Gate Decision (RE-GATE) — Epic 2: Tenant Access, Admin Auth, RLS, And Audit Foundation

**Epic:** Epic 2 — Multi-Tenant Foundation (tenant-admin auth, membership schema + RLS, server command envelope + audit, security regression harness)
**Date:** 2026-06-30
**Evaluator:** TEA Agent (Master Test Architect)
**Gate Type:** epic
**Decision Mode:** deterministic
**Run type:** **RE-GATE** — re-built after the three previously-flagged P1 coverage gaps (G-1/G-2/G-3) were closed. Supersedes the 2026-06-29 CONCERNS run.

---

> **What changed since the prior run (2026-06-29, CONCERNS).** The prior epic-2 trace returned
> **CONCERNS** for one reason only: P1 coverage was exactly **80%** (target 90%), driven by THREE
> named P1 gaps — G-1 (DB-backed disabled/inactive-membership → no-access), G-2 (UI active-tenant-context
> display), G-3 (anonymous `(app)` route-redirect). All three are now **CLOSED with executing, green
> tests** verified against the live repo on 2026-06-30 (not merely asserted in a doc). With G-1 closed
> P1-2 moves PARTIAL→FULL; with G-2/G-3 closed by the live Playwright E2E, P1-10 moves NONE→FULL (and
> the formerly-gated anonymous route-redirect sub-dimension of P0-6 now executes too). **P1 coverage
> rises 80% → 100%, flipping the deterministic gate CONCERNS → PASS.**

> Note: This workflow does not generate tests. Priorities (P0/P1/P2/P3) are taken from the consolidated
> epic test-design authority (`test-design-epic-2-foundation-consolidated.md` + the original
> `test-design-epic-2.md`); each requirement row cites its AC source and Risk Link. Coverage is judged
> against the actually-present, **green** test suites discovered in `tests/unit/**`,
> `tests/integration/**`, and `tests/e2e/**` (triple runner: `node --test` units + Vitest DB-backed
> INT/RLS against the local Supabase stack after `supabase db reset` + Playwright browser E2E).

## Context

All four Epic 2 stories are implemented; Stories 2-1, 2-2, 2-3 `done`, Story 2-4 converged. Since the
prior gate, the test-hardening + E2E-enablement pass landed the three gap-closers. **Live, green test
totals verified for this re-gate (2026-06-30, against the running local Supabase stack):**

- **149 unit** (`pnpm test:unit`, `node --test`) — 0 skipped (was 131; +18 from the new G-1 support + edges)
- **108 DB-backed integration** (`pnpm test:int`, Vitest, 22 files) — 0 skipped (was 89; includes the new `disabled-membership-no-access.int.test.ts`)
- **5 browser E2E** (`pnpm test:e2e`, Playwright/chromium) — **5 passed, 0 skipped** (was a single `describe.skip`-gated scaffold)

The previously-standing coverage gap (the `describe.skip`-gated browser E2E) is **gone**: the runner is
wired (`playwright.config.ts`, `pnpm test:e2e`, a CI `e2e` job at `.github/workflows/ci.yml:144`) and the
suite is live and green. **There is no longer any skipped/gated test in the Epic 2 foundation.**

### Evidence verification performed for this re-gate (repo, not doc)

| Gap | Closing artifact (verified to exist + assert + run green) | Result |
| --- | --- | --- |
| **G-1** DB-backed disabled/inactive-membership → no-access | `tests/integration/commands/disabled-membership-no-access.int.test.ts` (data-driven over `NON_ACTIVE_MEMBERSHIP_STATUSES = ['invited','disabled']`; live `seedMembership` inserts a real non-active `tenant_admin` row; asserts resolver → `TENANT_MEMBERSHIP_REQUIRED`, RLS zero-rows, envelope reject with NO audit row) + factory support `tests/factories/tenants.ts:181/200` | **6/6 green** (`vitest run` on the live stack) |
| **G-2** UI active-tenant-context display | `tests/e2e/auth/login-and-tenant-context.e2e.spec.ts` spec @ L79 asserts `getByTestId("tenant-context")` contains the tenant name + `getByTestId("current-user")` contains the admin email; anchors present in `src/components/app-shell/AppShell.tsx:277/285`; fed by the server-resolved context in `src/app/(app)/layout.tsx` | **green** (E2E run, 5/5) |
| **G-3** anonymous `(app)` route-redirect | same spec @ L65 (`/dashboard` anon → `/login`) + L108 round-trip (sign-out → `/login`, protected route re-redirects); backed by `src/app/(app)/layout.tsx:58` `redirect("/login")` on `UNAUTHENTICATED` | **green** (E2E run, 5/5) |

Supporting wiring confirmed in-repo: `package.json` `test:e2e` script; `playwright.config.ts` webServer
(prod build + start against the local stack, NEXT_PUBLIC_* inlined); `tests/e2e/global-setup.ts` seeds
adminA (active membership) + orphanUser (none) and writes `tests/e2e/.auth/fixture.json`; CI `e2e` job
installs chromium and runs `pnpm run test:e2e`.

---

## PHASE 1: REQUIREMENTS TRACEABILITY

### Coverage Summary (RE-GATE)

| Priority  | Total Criteria | FULL Coverage | Coverage % | Status   | Δ vs prior |
| --------- | -------------- | ------------- | ---------- | -------- | ---------- |
| P0        | 14             | 14            | 100%       | ✅ PASS  | = (100%, sub-dim of P0-6 now executes) |
| P1        | 10             | 10            | **100%**   | ✅ PASS  | ▲ from 80% (8/10) |
| P2        | 4              | 3             | 75%        | ⚠️ WARN  | = (P2-1 by-design substrate-only) |
| P3        | 0              | 0             | 100%       | ✅ n/a   | = |
| **Total** | **28**         | **27**        | **96%**    | **✅**   | ▲ from 89% (25/28) |

**Legend:** ✅ PASS = meets gate threshold · ⚠️ WARN = below target but non-blocking · ❌ FAIL = below minimum (blocker)

Coverage-status vocabulary: **FULL** = requirement proven by a green, mechanism-asserting test at the
level the test-design demands · **PARTIAL** = the core property is proven but a named sub-dimension is
deferred · **NONE** = no executing test (gated/skipped scaffold only).

---

### Detailed Mapping — P0 (Critical, 100% required)

All 14 P0 rows remain FULL ✅ (unchanged from the prior run — see that report for per-mechanism detail).
The **only** P0 movement is positive: the formerly-gated anonymous **route-redirect** sub-dimension of
P0-6 now has an executing assertion (it never reduced the P0 score, because the privileged surface P0-6
scopes is the DB/RPC surface, which was already FULL).

| # | P0 requirement (AC / Risk) | Status | Authoritative test(s) |
| --- | --- | --- | --- |
| P0-1 | Cross-tenant SELECT denied on all 3 tables — 2.2 AC2 / 2.3 AC4 (R-001, R-009) | ✅ FULL | `cross-tenant-isolation.rls.test.ts`, `anon-path-isolation.rls.test.ts` (data-driven over `tenant-table-inventory.ts`) |
| P0-2 | Cross-tenant INSERT/UPDATE/DELETE denied, no spoof — 2.2 AC2 (R-001) | ✅ FULL | `cross-tenant-isolation.rls.test.ts` (`42501` + `data===null` + BYPASSRLS re-read; fresh-UUID spoof → `42501`) |
| P0-3 | Membership self-grant / role tampering denied — 2.2 AC1/AC3 (R-005) | ✅ FULL | `membership-self-grant.rls.test.ts` |
| P0-4 | `tenant_admin`-only role CHECK + status CHECK — 2.2 AC1 (R-005) | ✅ FULL | `membership-self-grant.rls.test.ts`, `membership-integrity.int.test.ts` (`23514`) |
| P0-5 | DEFINER helpers fixed `search_path` + resist hijack — 2.2 AC4 (R-006) | ✅ FULL | `security-definer-search-path.rls.test.ts`, `helper-semantics.rls.test.ts`, `record-audit-event-search-path.int.test.ts` |
| P0-6 | Anonymous cannot reach privileged command/function/DB surface — 2.1 AC3 / 2.3 (R-003) | ✅ FULL (DB/RPC **and** route-redirect now executing) | `envelope-failure-modes.int.test.ts`, `audit-anon-isolation.int.test.ts`, `anon-path-isolation.rls.test.ts` **+ `login-and-tenant-context.e2e.spec.ts` L65/L108 (anon→/login)** |
| P0-7 | Authed user without active membership denied; zero tenant data — 2.1 AC2 (R-004) | ✅ FULL | `resolve-tenant-context.int.test.ts` (orphan → `TENANT_MEMBERSHIP_REQUIRED`, zero rows) + unit |
| P0-8 | Command rejects client `tenant_id` mismatch / spoof — 2.1/2.3 (R-004) | ✅ FULL | `resolve-tenant-context.int.test.ts`, `envelope-failure-modes.int.test.ts` |
| P0-9 | Command envelope happy path resolve→membership→validate→own→audit — 2.3 AC1 (R-003,R-004) | ✅ FULL | `envelope-audit-write.int.test.ts` |
| P0-10 | `audit_events` append-only — app-path UPDATE/DELETE blocked — 2.3 AC2/AC4 (R-009) | ✅ FULL | `audit-append-only.int.test.ts` |
| P0-11 | Cross-tenant audit read/write denied — 2.3 SEC (R-001,R-009) | ✅ FULL | `cross-tenant-isolation.rls.test.ts` (`audit_events` enrolled) |
| P0-12 | Service-role containment in built browser bundle — 2.4 AC2 (R-002) | ✅ FULL | `check-bundle-containment.mjs` + `bundle-containment.test.ts` |
| P0-13 | H4 inventory gate fails CI on an unenrolled tenant table — 2.4 AC3/AC4 (R-008) | ✅ FULL | `rls-inventory-gate.int.test.ts`, `inventory-gate-core.test.ts` + scratch-branch run |
| P0-14 | Migration reset from empty succeeds; tables+helpers+CHECKs+RLS present — 2.2 AC1 (R-007) | ✅ FULL | `migration-reset.int.test.ts` |

---

### Detailed Mapping — P1 (High, ≥90% target / ≥80% minimum) — now 10/10 = 100%

#### P1-1: Active membership resolves correct tenant context server-side — 2.1 AC1 (R-004)
- **Coverage:** FULL ✅ — `resolve-tenant-context.int.test.ts` (active `tenant_admin` → membership-derived tenant) + unit branches.

#### P1-2: Disabled/inactive membership treated as no-access (distinct from "no membership") — 2.1 test req (R-004) — ⬆ PARTIAL → FULL (G-1 CLOSED)
- **Coverage:** FULL ✅ — **promoted this re-gate.**
- **Now covered by (verified green, 6/6):** `tests/integration/commands/disabled-membership-no-access.int.test.ts` — a LIVE `disabled`/`invited` `tenant_admin` membership row (seeded via the new `seedMembership` factory) is exercised at **both** layers:
  1. `resolveTenantContext` → `TENANT_MEMBERSHIP_REQUIRED` (no-access), proving the resolver keys on `status='active'`, not on row existence — distinct from the no-row orphan case;
  2. RLS — the inactive member reads **zero** `tenants`/`tenant_memberships` rows (active-only USING clause); and
  3. the command envelope rejects at the membership gate with **NO audit row written**.
- The decision is **data-driven** over `NON_ACTIVE_MEMBERSHIP_STATUSES` (`invited`,`disabled`), so a future non-active status (or a regression letting one through) is caught.
- **Prior gap (now closed):** "the disabled-membership failure path is only unit-proven, not DB-backed" (Story 2-3 deferred Low; consolidated design G-1).

#### P1-3: Envelope failure modes — auth/membership/validation/ownership each → typed user-safe code — 2.3 AC1 (R-003)
- **Coverage:** FULL ✅ — `envelope-failure-modes.int.test.ts` + `envelope-core.test.ts` / `-core-edges.test.ts`.

#### P1-4: Successful audit write records all fields (tenant/actor/command/event/target/correlation/metadata/timestamp) — 2.3 AC2 (R-009,R-010)
- **Coverage:** FULL ✅ — `envelope-audit-write.int.test.ts` (field-by-field incl. `created_at == injected ts`).

#### P1-5: Audit metadata hygiene — secrets/.env/raw-file/broad-PII never persisted — 2.3 test req (R-010)
- **Coverage:** FULL ✅ — `audit-metadata.test.ts` + `audit-metadata-edges.test.ts` (allow-list sanitizer).

#### P1-6: Deterministic command timestamp; no sleeps — 2.3 H1 (R-011)
- **Coverage:** FULL ✅ — `command-clock.test.ts` + INT audit-write timestamp assertion.

#### P1-7: Per-worker tenant-pair isolation under parallel run — 2.2 H5 (R-012)
- **Coverage:** FULL ✅ — `factory-isolation.int.test.ts`.

#### P1-8: Harness fails on an intentionally weakened/mismatched access (gate bites) — 2.4 test req (R-001,R-008)
- **Coverage:** FULL ✅ — `rls-inventory-gate.int.test.ts` (live shrunk) + `inventory-gate-core.test.ts` + documented scratch-branch run.

#### P1-9: Anonymous privileged-endpoint check across the DB/RPC inventory — 2.4 AC1 (R-003)
- **Coverage:** FULL ✅ — `anon-path-isolation.rls.test.ts` (4 verbs × every enrolled table; anon-EXECUTE `42501` on all 3 RPCs).

#### P1-10: Active tenant/company context is displayed in the UI — 2.1 AC1 (R-004) — ⬆ NONE → FULL (G-2 CLOSED)
- **Coverage:** FULL ✅ — **promoted this re-gate.**
- **Now covered by (verified green):** `tests/e2e/auth/login-and-tenant-context.e2e.spec.ts` L79 — after a real browser sign-in as the active `tenant_admin`, the top bar's `data-testid="tenant-context"` contains the tenant name and `data-testid="current-user"` contains the admin email. The display is fed by the server-resolved context (`src/app/(app)/layout.tsx` → `AppShell` props; anchors at `AppShell.tsx:277/285`). The server authority that drives it remains INT-covered (P1-1).
- **Prior gap (now closed):** the only test was a `describe.skip`-gated scaffold; the Playwright runner is now wired and the suite is live (5/5 green).

---

### Detailed Mapping — P2 (Medium, informational)

#### P2-1: Minimal relevant lifecycle/audit events surface in record context; no analytics module — 2.3 AC3 (R-010)
- **Coverage:** PARTIAL ⚠️ (by design — unchanged). Story 2-3 builds the append-only audit **substrate** only; the consumer/history UI is explicitly deferred to its own record-context story (Epic 3+). The "no analytics module/route/nav item" half is positively asserted (nav-items still exactly seven); the "events surface in record context" half has no consumer to assert against yet — intentional, not a defect. Re-trace when the first audit-history consumer UI lands.

#### P2-2: User-safe error messages contain no internal/stack leakage — (R-002)
- **Coverage:** FULL ✅ — generic Swedish messages in `tenant-context.ts` / `command-errors.ts`; envelope + resolver tests assert no raw value/stack/SQL/existence crosses the boundary. (The E2E AC2 no-access spec additionally confirms the generic "Ingen åtkomst" render leaks nothing about whether a tenant/user exists.)

#### P2-3: Factory contract extensibility (extends to a CRM-shaped record without rework) — 2.2 B1 (R-012)
- **Coverage:** FULL ✅ (demonstrated). The new `seedMembership` capability (G-1) was added **additively** to `tests/factories/tenants.ts` alongside the existing handles with no reshaping of the two-tenant fixture — a second in-practice demonstration of the additive B1 contract.

#### P2-4: `verify:lockfiles` guard failure-path regression test — (R-007)
- **Coverage:** FULL ✅ — `check-lockfiles.test.ts` (red on planted second lockfile / missing / invalid; green on a valid single `pnpm-lock.yaml`).

#### P3 (Low — tenant-context copy/a11y polish, harness DX, deferred-perf docs)
- Not gate-bearing (cosmetic/DX/docs). No P3 blocks the gate.

---

## Coverage Heuristics (endpoint / auth / error-path blind-spot scan)

- **Privileged-function / "endpoint" coverage:** Phase A exposes NO public privileged route/function/cron/webhook (architecture §20). The privileged surface = the DB + 3 RPCs (`is_active_tenant_member`, `is_tenant_admin`, `record_audit_event`) — all 3 carry anon-EXECUTE-denied (`42501`) negatives. The anonymous **browser route** boundary (`(app)` → `/login`) now ALSO has an executing E2E assertion. **No uncovered endpoint.**
- **Auth/authz negative-path coverage:** every gate (unauthenticated, no-membership, **disabled/invited-membership — now DB-backed**, cross-tenant target, self-grant, role/status CHECK, anon EXECUTE) has a denial test. **No auth negative-path class is unit-only anymore** — the formerly unit-only disabled-membership DB path is now live-INT covered (G-1). **No missing auth negative-path class.**
- **Error-path coverage:** transient-infra → `SERVER_ERROR`, validation → `VALIDATION_FAILED`, ownership error → `SERVER_ERROR` (not masked as denial), Invalid-Date clock → `SERVER_ERROR`, non-UUID correlation/target id → reduced to a safe value. **No happy-path-only P0/P1 criterion.**

---

## PHASE 1 SUMMARY

- **Total requirements:** 28 · **Fully covered:** 27 (96%) · **Partially covered:** 1 · **Uncovered:** 0
- **Priority coverage:** P0 14/14 (100%) · P1 **10/10 (100%)** · P2 3/4 (75%) · P3 n/a
- **Gaps:** Critical (P0) 0 · High (P1) **0** · Medium (P2) 1 (by design)
- **Heuristics:** endpoints-without-tests 0 · auth-missing-negative-paths 0 · happy-path-only-criteria 0

### Gap Analysis

#### Critical Gaps (BLOCKER) ❌
**0 gaps.** P0 = 100%; every load-bearing tenant-isolation, auth-boundary, append-only-audit,
service-role-containment, and inventory-gate property is proven by green, mechanism-asserting tests, and
the H4 gate is proven to bite.

#### High Priority Gaps (P1) ⚠️
**0 gaps.** All three previously-named P1 gaps are CLOSED with executing green tests:
- **G-1** (disabled/inactive-membership DB-backed no-access) → `disabled-membership-no-access.int.test.ts` — P1-2 PARTIAL→FULL.
- **G-2** (UI active-tenant-context display) → `login-and-tenant-context.e2e.spec.ts` L79 — P1-10 NONE→FULL.
- **G-3** (anonymous `(app)` route-redirect) → `login-and-tenant-context.e2e.spec.ts` L65/L108 — closes the P0-6 route sub-dimension.

#### Medium Gaps (informational) ⚠️
1. **P2-1 — minimal audit events surface in record context — PARTIAL by design** (substrate-only; consumer UI deferred to its own story). Not actionable in Epic 2.

#### Still-open lower-priority hardening (from the consolidated design's ranked list — NONE gate-bearing)
- **G-4** (P2): SERVER_ERROR-vs-no-access at the **layout/integration** level — pure-core proven; an INT transient-fault injection + the layout-render-on-throw assertion remain. On-current-stack (INT slice) + ride-along E2E (render slice).
- **G-5** (P2): confirm `audit_events` anon UPDATE/DELETE are data-driven over the shared inventory (enumeration completeness; mechanism already proven).
- **G-6** (P2): `actor_user_id ON DELETE SET NULL` FK behavior has no test (audit row survives a deleted actor).
- **G-7** (P2): end-to-end metadata-hygiene assertion routed through a command with `auditFields` (the strong proof is the unit sanitizer suite).
- **G-8** (P3): introspection-assertion strength (exact-empty `search_path` parse; H4 views/matviews + transitive-FK).
- **G-9** (P3): auth/RLS performance under many tenants/rows (R-013, deferred to a later epic — run `*nfr-assess` if brought into scope).

These were never gate gaps and are unchanged by this re-gate; they are the next test-hardening backlog, all P2/P3.

---

## PHASE 2: QUALITY GATE DECISION

### Deterministic Gate Math (per the skill's decision tree)

| Criterion | Required | Actual | Status |
| --- | --- | --- | --- |
| P0 coverage | 100% | **100%** (14/14) | MET |
| Overall coverage | ≥ 80% | **96%** (27/28) | MET |
| P1 coverage | ≥ 90% target / ≥ 80% minimum | **100%** (10/10) | MET (≥ target) |

Decision-tree evaluation:
- Rule 1 (P0 < 100 → FAIL): **not triggered** — P0 is 100%.
- Rule 2 (overall < 80 → FAIL): **not triggered** — overall is 96%.
- Rule 3 (P1 < 80 → FAIL): **not triggered** — P1 is 100%.
- Rule 4 (P1 ≥ 90 with P0 100% and overall ≥ 80% → **PASS**): **triggered.**
- Rule 5 (P1 80–89 → CONCERNS): **not triggered** (no longer applies — this was the prior run's rule).

### Gate Decision: **PASS** ✅  (flipped **CONCERNS → PASS**)

**Rationale:** P0 coverage is 100%, P1 coverage is 100% (target 90%), and overall coverage is 96%
(minimum 80%). The single reason the prior run was CONCERNS — P1 at exactly 80% — is resolved: all three
P1 gaps (G-1/G-2/G-3) are closed with executing, green tests verified against the live repo. There is no
release blocker and no remaining P1 gap. The only sub-100% priority is P2 (75%), whose single PARTIAL row
(P2-1) is a by-design substrate-only deferral with no consumer to assert against yet — informational, not
gate-bearing.

### CONCERNS → PASS determination (explicit)
- **Prior gate (2026-06-29): CONCERNS** — P1 80% (8/10), driven entirely by G-1 (PARTIAL), G-2 (NONE), G-3 (gated route-redirect).
- **This re-gate (2026-06-30): PASS** — P1 100% (10/10). **Gate has flipped CONCERNS → PASS.**
- **Which tests now cover the three gaps:**
  - **G-1** → `tests/integration/commands/disabled-membership-no-access.int.test.ts` (6/6 green; resolver + RLS + envelope, data-driven over `invited`/`disabled`).
  - **G-2** → `tests/e2e/auth/login-and-tenant-context.e2e.spec.ts` L79 (top bar `tenant-context` + `current-user`; green).
  - **G-3** → `tests/e2e/auth/login-and-tenant-context.e2e.spec.ts` L65 (anon `/dashboard` → `/login`) + L108 (sign-out round-trip re-redirect); green.

### Standing-gate / harness health (epic-specific exit criteria) — all green
- ✅ Cross-tenant RLS negative suite green for `tenants`/`tenant_memberships`/`audit_events` (all four verbs).
- ✅ RLS table-inventory gate (H4) live in CI and **proven to bite** (pure-fn + live-shrunk + manual scratch-branch).
- ✅ Service-role containment green on a clean build, proven red on a planted token (built-bundle grep = authoritative R-002).
- ✅ Anonymous-access negatives green for every protected DB/RPC path (`42501`) **and** the browser route-redirect (E2E).
- ✅ `audit_events` proven append-only; metadata hygiene asserted.
- ✅ Migration reset from empty succeeds; factories build the two-tenant fixture per worker.
- ✅ **Disabled/inactive-membership → no-access now DB-backed** (resolver + RLS + envelope).
- ✅ **UI active-tenant-context display + anonymous route-redirect now executing E2E** (no skipped suite remains).

### Uncovered / under-covered requirements (for human summary)
1. **P2-1 (2.3 AC3) minimal audit surface in record context — PARTIAL by design.** Substrate-only; re-trace when the first audit-history consumer UI lands (Epic 3+). Not actionable in Epic 2.
   (No P0 or P1 requirement is uncovered.)

### Recommended Next Actions
1. **[NONE BLOCKING]** Epic 2 PASSES — no `*atdd`/`*automate` run is required for any P0/P1; all are complete.
2. **[P2, optional hardening]** Pick up G-4..G-7 (transient-fault SERVER_ERROR INT, anon UPDATE/DELETE enumeration, `ON DELETE SET NULL` persistence, end-to-end metadata-hygiene) in the next test-hardening pass — all on-current-stack, none gate-bearing.
3. **[P3]** G-8 introspection-assertion strength; G-9/`*nfr-assess` if auth/RLS performance is brought into scope.
4. **[INFO]** Re-trace P2-1 when the first audit-history consumer UI story lands.

---

## Risk → Coverage Confirmation (R-001..R-016)

| Risk | Score | Mitigation covered by | Status |
| --- | --- | --- | --- |
| R-001 cross-tenant RLS | 6 | cross-tenant-isolation suite (3 tables × 4 verbs) | ✅ green |
| R-002 service-role leak | 6 | check-bundle-containment + source guard + bite units | ✅ green |
| R-003 anonymous privileged access | 6 | anon-path-isolation + envelope/audit anon suites + **E2E route-redirect** | ✅ green (DB/RPC **and** route) |
| R-004 client tenant spoof | 6 | resolve-tenant-context + envelope-failure-modes + **disabled-membership-no-access** | ✅ green |
| R-005 self-grant / escalation | 6 | membership-self-grant + integrity | ✅ green |
| R-006 DEFINER search_path | 6 | security-definer-search-path + record-audit-event-search-path | ✅ green |
| R-007 test-infra readiness | 6 | dual-runner + local stack + factories (2.2) **+ Playwright runner now live** | ✅ satisfied |
| R-008 inventory gate inert | 6 | rls-inventory-gate + inventory-gate-core (bite proven) | ✅ green |
| R-009 audit append-only | 4 | audit-append-only + cross-tenant audit enrollment | ✅ green |
| R-010 audit metadata hygiene | 4 | audit-metadata(+edges) sanitizer units | ✅ green |
| R-011 non-deterministic timestamp | 4 | command-clock + audit-write timestamp assertion | ✅ green |
| R-012 shared-fixture interference | 4 | factory-isolation (per-worker pair) | ✅ green |
| R-013 auth/RLS perf | 2 | DOCUMENT only — deferred to a later epic | ✅ accepted |
| R-014 SERVER_ERROR-vs-no-access taxonomy at layout/INT | 4 | pure-core proven; layout/transient INT slice = G-4 | ⚠️ partial (P2, non-gate) |
| R-015 H4 introspection shape bound | 4 | tenant_id + FK-to-`tenants` + root union + fail-closed; views/transitive-FK = G-8 | ⚠️ accepted (Phase A safe) |
| R-016 route-redirect un-executed | 2 | **CLOSED** — `login-and-tenant-context.e2e.spec.ts` L65/L108 now executes the redirect (G-3) | ✅ green |

**No high-priority risk (≥6) is unmitigated or unwaived.** R-016 (the formerly un-executed route-redirect)
is now closed by an executing E2E. R-014/R-015 remain accepted P2/P3 hardening items (never gate-bearing).

---

## Notes on accepted Phase A residuals (disclosed, not gate gaps)
- `tenant_memberships_select_own` / `audit_events_select_own` scope reads by **tenant** (`is_tenant_admin(tenant_id)`), not by `user_id`/`actor_user_id = auth.uid()` — an intra-tenant co-member read in a (future) multi-admin tenant. Accepted, intended Phase A single-admin design; the `auth.uid()` least-privilege tightening is the RBAC-seam follow-up. The cross-**tenant** boundary (what the harness enforces) holds. Not a coverage gap.
- `record_audit_event` trusts caller-supplied `p_actor_user_id` (intra-tenant attribution; FK-bounded; single-admin Phase A) — deferred to the RBAC/multi-admin seam. Not a coverage gap.

---

## RE-GATE DECISION SUMMARY

```
🚨 GATE DECISION: PASS   (re-gate — flipped CONCERNS → PASS)

📊 Coverage Analysis:
- P0 Coverage:      100% (14/14)  (Required: 100%)            → MET
- P1 Coverage:      100% (10/10)  (PASS target: 90%, min 80%) → MET   ▲ from 80%
- Overall Coverage:  96% (27/28)  (Minimum: 80%)              → MET   ▲ from 89%

✅ Decision Rationale:
P0 100%, P1 100% (target 90%), overall 96% (min 80%). The three previously-flagged P1
gaps are closed with executing green tests verified against the live repo:
  G-1 → disabled-membership-no-access.int.test.ts (6/6)
  G-2 → login-and-tenant-context.e2e.spec.ts L79 (top-bar tenant + user)
  G-3 → login-and-tenant-context.e2e.spec.ts L65/L108 (anon → /login)
Rule 4 (P1 ≥ 90, P0 100%, overall ≥ 80%) → PASS.

⚠️ Critical Gaps (P0): 0    High Gaps (P1): 0    Medium (P2, by-design): 1

✅ GATE: PASS — Release approved, coverage meets standards.
```

---

**Generated by:** BMad TEA Agent — Test Architect Module · Workflow `bmad-testarch-trace` · v4.0 (BMad v6)
**Run type:** RE-GATE (supersedes the 2026-06-29 CONCERNS run)
**Gate decision:** **PASS** (deterministic) — P0 100%, P1 100%, overall 96%; 0 critical gaps, 0 P1 gaps. Flipped CONCERNS → PASS. Verified against live green suites (149 unit + 108 integration + 5 E2E, 0 skipped) on 2026-06-30.
