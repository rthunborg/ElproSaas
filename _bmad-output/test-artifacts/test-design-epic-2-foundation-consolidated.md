---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-06-29'
workflowType: testarch-test-design
designLevel: epic
epicNum: 2
mode: holistic-foundation-consolidation
supersedes: none
relatedTo:
  - _bmad-output/test-artifacts/test-design-epic-2.md (the original pre-implementation epic-2 design — NOT overwritten; this consolidates + extends it post-implementation)
  - _bmad-output/test-artifacts/traceability/epic-2-traceability-report.md (the post-implementation coverage authority — P0 100% / overall 89% / P1 80%)
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-2.md
  - _bmad-output/test-artifacts/traceability/epic-2-traceability-report.md
  - _bmad-output/implementation-artifacts/2-1-tenant-admin-login-and-tenant-context-resolution.md
  - _bmad-output/implementation-artifacts/2-2-tenant-membership-schema-rls-helpers-and-two-tenant-fixtures.md
  - _bmad-output/implementation-artifacts/2-3-server-command-envelope-and-minimal-audit-events.md
  - _bmad-output/implementation-artifacts/2-4-security-regression-harness-for-tenant-and-service-role-boundaries.md
  - _bmad-output/planning-artifacts/architecture.md (§5 command pattern, §6 auth/RLS, §9 RLS+test matrix, §15 audit, §18 test strategy, §19 CI, §20 security)
  - tests/** (39 live test files + tests/integration/rls/tenant-table-inventory.ts shared inventory)
---

# Test Design (Holistic, Consolidated): Epic 2 — The Tenant + Auth + RLS + Audit Foundation

**Date:** 2026-06-29
**Author:** Rasmus
**Status:** Draft (post-implementation consolidation)
**Design Level:** Epic-Level (Phase 4) — **HOLISTIC FOUNDATION view across Stories 2-1..2-4 treated as ONE consolidated security foundation, not four isolated stories**
**Mode:** Risk-based, evidence-backed (Master Test Architect)

> **What this document is.** A single holistic test design / risk matrix for the WHOLE multi-tenant
> foundation Epic 2 delivers — Supabase-Auth login + server-side tenant-context resolution (2-1),
> the `tenant_memberships` schema + RLS helpers (2-2), the server command envelope + append-only
> `audit_events` (2-3), and the standing security-regression harness (2-4) — read as one consolidated
> control surface. It **CONSOLIDATES and EXTENDS** the original pre-implementation
> `test-design-epic-2.md` and the post-implementation `epic-2-traceability-report.md` rather than
> starting blank: the original design predicted ~24-28 P0 / ~20-26 P1 scenarios against infra that did
> not yet exist; this document re-states the foundation's risks/scenarios against the **actually-shipped,
> green test suites** (131 unit + 89 DB-backed integration on a clean `supabase db reset` → `test:int`),
> ties every AC/requirement to the **real covering test file**, and produces a **ranked, closable gap
> list** tagged on-current-stack vs Playwright-blocked. It does NOT overwrite the per-story checklists
> or the original epic-2 design.

---

## Executive Summary

**Scope (one consolidated foundation):** The security/data foundation that makes tenant access
trustworthy *before* any business data exists. As one surface it is: the `(app)` server-layout auth
boundary (UNAUTHENTICATED → redirect `/login`; membership-required → `NoTenantAccess`; the
active-tenant/user top-bar indicator), the membership-derived `resolveTenantContext` authority,
the `tenants`/`tenant_memberships` schema with `SECURITY DEFINER` `is_active_tenant_member` /
`is_tenant_admin` helpers (fixed empty `search_path`), the GRANT+RLS deny-by-default write contract,
two-tenant per-worker factories, the reusable command envelope (resolve → membership → validate →
own → execute → audit → typed `Result`) with the `SERVER_ERROR`-vs-no-access taxonomy, append-only
`audit_events` (`record_audit_event` DEFINER write + `BEFORE UPDATE OR DELETE` trigger + metadata
allow-list sanitizer + `actor_user_id ON DELETE SET NULL`), and the standing harness (H4 RLS
table-inventory gate, built-bundle service-role containment, data-driven cross-tenant + anonymous
negatives over a single shared inventory).

**Why this matters (the whole-epic stake):** a defect here is **silently inherited by every later
tenant-owned table** (CRM, pricing, calculations, quotes, files, jobs — Epics 3-9). The foundation's
load-bearing deliverable is the **parameterized cross-tenant RLS negative suite + the H4 table-inventory
gate** — the standing regression mechanism that fails CI when any future epic ships a tenant table
without isolation coverage.

**Risk Summary (consolidated):**

- Total foundation risks tracked: **16** (the 13 from the original design + 3 newly surfaced here: R-014 SERVER_ERROR-vs-no-access taxonomy completeness, R-015 H4 introspection naming/shape bound, R-016 route-boundary redirect un-executed)
- High-priority (score ≥6): **8** (R-001..R-008) — all MITIGATED with green, mechanism-asserting tests
- Critical (score 9 / auto-FAIL): **0** — the architecture defines the controls; residual risk is implementation correctness + durable enforcement, which 2-4's harness polices
- Dominant categories: **SEC** (tenant isolation, service-role containment, anonymous privileged access, client tenant spoofing, self-grant), then **DATA** (audit append-only + metadata hygiene) and **TECH/OPS** (gate inertness, env readiness)

**Coverage Summary (as-shipped, from the trace report — the authority):**

- Requirements traced: **28** · Fully covered: **25 (89%)** · Partial: **2** · Uncovered: **1**
- **P0: 14/14 = 100%** ✅ · **P1: 8/10 = 80%** ⚠️ (target 90%) · **P2: 3/4 = 75%** ⚠️ (the 1 is by-design substrate-only) · P3: n/a
- Live suites: **131 unit (0 skipped) + 89 DB-backed integration (0 skipped)** on a clean `supabase db reset` → `test:int` (the exact CI sequence); the only standing gated suite is the browser E2E (`tests/e2e/auth/login-and-tenant-context.e2e.spec.ts`, `describe.skip` on a Playwright runner out of Epic 2 scope).

**Gate posture (consolidated):** **CONCERNS** — the load-bearing SEC properties are 100% FULL and
green and there is **no release blocker**; the two open P1 gaps are a **gated browser E2E** (UI
tenant-context display + `(app)` anonymous route-redirect) and a **DB-backed disabled-membership
fixture** (unit-proven today). Neither weakens tenant isolation, command authority, audit append-only,
or the H4 gate. (Detail + the ranked gap list below.)

**Headline:** This foundation is dominated by **RLS-negative** and **server-command integration**
coverage, not UI. The single highest-value asset is the **data-driven cross-tenant negative suite +
the H4 inventory gate proven to bite** (`tests/integration/rls/cross-tenant-isolation.rls.test.ts`,
`anon-path-isolation.rls.test.ts`, `rls-inventory-gate.int.test.ts` over the shared
`tenant-table-inventory.ts`). Treat its weakening as an epic release blocker.

---

## How This Consolidation Differs From the Two Source Artifacts

| Source artifact | What it gave | What this consolidation adds |
| --- | --- | --- |
| `test-design-epic-2.md` (original, 2026-06-21, pre-impl) | The risk register (R-001..R-013), P0/P1/P2 scenario counts, exit criteria — all written **before** the runner/stack/tables existed (it explicitly flags "Test Infrastructure Does Not Yet Exist"). | Re-states those risks **against shipped reality**: each risk now cites the actual green test file; adds R-014/R-015/R-016; converts the predicted scenario counts into a real AC→test coverage map. |
| `epic-2-traceability-report.md` (2026-06-29, post-impl) | The authoritative per-requirement coverage (P0 100% / P1 80% / overall 89%) and the deterministic CONCERNS gate. | Re-frames the 28 per-requirement rows as **one foundation control surface** (not four story silos), folds in the named gaps, and produces a **single RANKED, closable gap list** with on-current-stack vs Playwright-blocked tags + effort, which the trace report does not rank. |

This document is the place to look when planning the **next test-hardening pass** for the foundation
and when an Epic 3+ story needs to know which foundation properties are proven vs deferred.

---

## The Foundation As One Control Surface (Story → Control → Risk map)

| Foundation control (consolidated) | Delivered by | Primary risks it answers | Authoritative test(s) |
| --- | --- | --- | --- |
| `(app)` server-layout auth boundary (redirect / NoTenantAccess / shell) | 2-1 | R-003, R-004, R-016 | `resolve-tenant-context.int.test.ts` (DB authority); layout redirect = **gated E2E (R-016)** |
| Membership-derived `resolveTenantContext` (client `tenant_id` never authority; active-first selection; transient→`SERVER_ERROR`) | 2-1 (+2-2 surgical) | R-004, R-014 | `resolve-tenant-context.int.test.ts`, `resolve-tenant-context.test.ts`, `-core-edges.test.ts`, `-claims.test.ts`, `-tenant-name.test.ts` |
| Top-bar active-tenant/user indicator | 2-1 | R-004 (display) | **gated E2E only (P1-10)** — server authority driving it is INT-covered |
| `tenants`/`tenant_memberships` schema + role/status CHECK + GRANT deny-by-default + RLS enable/force | 2-2 | R-001, R-005, R-007 | `migration-reset.int.test.ts`, `membership-integrity.int.test.ts`, `membership-self-grant.rls.test.ts` |
| `SECURITY DEFINER` helpers, fixed empty `search_path`, anti-hijack | 2-2 | R-006 | `security-definer-search-path.rls.test.ts`, `helper-semantics.rls.test.ts` |
| Two-tenant per-worker factories (no shared mutable fixture) | 2-2 | R-012 | `factory-isolation.int.test.ts` + every INT suite consumes them |
| Command envelope (resolve→membership→validate→own→execute→audit→Result) + stable-code taxonomy | 2-3 | R-003, R-004, R-014 | `envelope-core.test.ts`, `envelope-core-edges.test.ts`, `envelope-failure-modes.int.test.ts`, `envelope-audit-write.int.test.ts` |
| Append-only `audit_events` (DEFINER write + trigger + `ON DELETE SET NULL` + index) | 2-3 | R-009, R-001 | `audit-append-only.int.test.ts`, `record-audit-event-search-path.int.test.ts`, `cross-tenant-isolation.rls.test.ts` (enrolled) |
| Audit metadata allow-list sanitizer + single command timestamp (H1) | 2-3 | R-010, R-011 | `audit-metadata.test.ts`, `audit-metadata-edges.test.ts`, `command-clock.test.ts`, `correlation.test.ts` |
| H4 RLS table-inventory gate (single shared inventory; proven to bite) | 2-4 | R-008, R-015 | `rls-inventory-gate.int.test.ts`, `inventory-gate-core.test.ts`, `tenant-table-inventory.ts` |
| Built-bundle + source service-role containment | 2-4 | R-002 | `check-bundle-containment.mjs` + `bundle-containment.test.ts`; `check-service-role-containment.mjs` + `service-role-containment.test.ts` |
| Data-driven cross-tenant + anonymous negatives over the inventory | 2-2/2-3/2-4 | R-001, R-003, R-005, R-009 | `cross-tenant-isolation.rls.test.ts`, `anon-path-isolation.rls.test.ts`, `audit-anon-isolation.int.test.ts` |

---

## Not in Scope (foundation-level)

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **Browser E2E for the `(app)` route boundary + UI tenant-context display** | Playwright browser runner is deferred (out of Epic 2 scope) | Gated scaffold exists (`tests/e2e/auth/login-and-tenant-context.e2e.spec.ts`, `describe.skip`); the **DB/command** anonymous + tenant-authority surface is fully INT-covered; only the browser-route assertion is deferred (Gap G-1 / G-3 below) |
| **Full RBAC / multi-admin least-privilege** (`*_select_own` tightening to `auth.uid()`) | Phase A is single-`tenant_admin`; intra-tenant co-member read is accepted, intended design (never crosses a tenant boundary) | Disclosed in 2-2/2-3/2-4 PR Security/RLS statements; the harness enforces the cross-**tenant** boundary that DOES hold; tightening owned by the RBAC seam |
| **Auth/RLS performance under many tenants/rows** | Premature for an internal pilot (single prod tenant initially); no SLA defined | R-013 DOCUMENT only; deferred to a later epic |
| **Storage isolation negatives** | No storage tables exist yet (Epic 8) | The storage-isolation row of the §9 matrix joins the harness in Epic 8 via the same inventory-gate mechanism |
| **Audit-history consumer UI / analytics** | 2-3 builds the append-only substrate only; AC7 defers the consumer | Positively asserted "no analytics module/route/nav item"; the substrate is field-asserted (P1-4) |
| **External security scanning services / network-only checks** | 2-4 keeps all checks local + bare-Node + built-bundle grep | Local grep/bundle-inspection covers the Phase A threat (service-role leakage) |

---

## Consolidated Risk Assessment

Scoring per `probability-impact.md`: Probability 1 (unlikely) / 2 (possible) / 3 (likely);
Impact 1 (minor) / 2 (degraded) / 3 (critical). Score = P × I. Thresholds: 1-3 DOCUMENT, 4-5
MONITOR, 6-8 MITIGATE (CONCERNS at gate), 9 BLOCK (auto-FAIL).

Isolation failures score **Impact 3** (a cross-tenant leak is a critical confidentiality exposure
silently inherited by every later table). Probability is held at **2** (not 3) because the
architecture specifies the correct controls and the shipped suites prove them — residual risk is
drift/regression, which the H4 gate exists to catch. **Status column reflects the as-shipped state.**

### High-Priority Risks (Score ≥6) — all MITIGATED + green

| Risk | Cat | Description | P | I | Score | Status (as-shipped) | Covering test (authority) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | SEC | Missing/wrong RLS on `tenants`/`tenant_memberships`/`audit_events` lets Tenant A read/write/spoof Tenant B | 2 | 3 | 6 | ✅ MITIGATED | `cross-tenant-isolation.rls.test.ts` (3 tables × 4 verbs, `42501` + BYPASSRLS re-read), enrolled via `tenant-table-inventory.ts` |
| R-002 | SEC | Service-role key leaks into browser bundle / public payload / logs | 2 | 3 | 6 | ✅ MITIGATED | `check-bundle-containment.mjs` (post-build `.next` grep, authoritative) + `bundle-containment.test.ts`; source guard `check-service-role-containment.mjs`. App uses NO service-role key (anon + RLS) |
| R-003 | SEC | Anonymous/unauthenticated caller invokes a privileged command/route/function | 2 | 3 | 6 | ✅ MITIGATED (DB/RPC) / ⚠️ route-redirect gated (R-016) | `envelope-failure-modes.int.test.ts` (anon→`UNAUTHENTICATED`, no audit), `audit-anon-isolation.int.test.ts`, `anon-path-isolation.rls.test.ts` (anon EXECUTE `42501` on all 3 helpers) |
| R-004 | SEC | Server trusts client-supplied `tenant_id` instead of membership-resolved tenant (spoofing) | 2 | 3 | 6 | ✅ MITIGATED | `resolve-tenant-context.int.test.ts` (forged id never widens), `envelope-failure-modes.int.test.ts` (cross-tenant target → `TENANT_ACCESS_DENIED`) |
| R-005 | SEC | Membership self-grant / role escalation via the app path | 2 | 3 | 6 | ✅ MITIGATED | `membership-self-grant.rls.test.ts` (self-insert + self-UPDATE role/status/tenant_id denied + re-read), `membership-integrity.int.test.ts` (CHECK `23514`) |
| R-006 | SEC | `SECURITY DEFINER` helper without fixed `search_path` → function hijack / privilege bypass | 2 | 3 | 6 | ✅ MITIGATED | `security-definer-search-path.rls.test.ts` + control; `record-audit-event-search-path.int.test.ts` for the audit DEFINER fn |
| R-007 | OPS/TECH | Runner + local Supabase stack not ready when the harness needs them → hollow security harness ships | 3 | 2 | 6 | ✅ SATISFIED | Dual runner (`node --test` + Vitest 4.1.9) + local stack + factories all delivered in 2-2; CI `db` job runs `supabase db reset` → `test:int` |
| R-008 | TECH | RLS inventory gate incomplete/unwired → a future tenant table ships with no cross-tenant test, unnoticed | 2 | 3 | 6 | ✅ MITIGATED (proven to bite) | `rls-inventory-gate.int.test.ts` (live shrunk-set BITES) + `inventory-gate-core.test.ts` (pure shrunk-inventory) + documented scratch-branch run (2-4 Dev Agent Record) |

### Medium-Priority Risks (Score 3-4)

| Risk | Cat | Description | P | I | Score | Status | Covering test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-009 | DATA | `audit_events` mutable/deletable through app paths → audit not trustworthy | 2 | 2 | 4 | ✅ MITIGATED | `audit-append-only.int.test.ts` (app-path UPDATE/DELETE `42501` before the `audit_events_append_only` trigger; trigger raises even on the privileged path; re-read proves no mutation) |
| R-010 | DATA | Audit metadata captures secrets/`.env`/raw file/broad PII | 2 | 2 | 4 | ✅ MITIGATED | `audit-metadata.test.ts` + `audit-metadata-edges.test.ts` (allow-list drops planted key/`.env`/raw body/long PII/control chars; only `reason`/`beforeHash`/`afterHash`/`targetVersion` survive) |
| R-011 | TECH | Non-deterministic command timestamps → flaky time-dependent assertions / sleeps | 2 | 2 | 4 | ✅ MITIGATED | `command-clock.test.ts` (fixed clock → identical `created_at`) + the INT audit-write timestamp assertion; no sleeps anywhere |
| R-012 | TECH | Shared mutable tenant fixtures → cross-test interference under parallel run | 2 | 2 | 4 | ✅ MITIGATED | `factory-isolation.int.test.ts` (unique per-call tenant pair; no shared mutable fixture) |
| **R-014 (NEW)** | TECH | The `SERVER_ERROR`-vs-no-access taxonomy is incompletely exercised at the layout/integration level — a transient DB/RPC fault could surface as a permanent "no access" instead of a retryable `SERVER_ERROR` | 2 | 2 | 4 | ⚠️ PARTIAL | Pure-core proven: `envelope-core-edges.test.ts` (transient throw → `SERVER_ERROR`; ownership error → `SERVER_ERROR` not masked-as-denial; Invalid-Date clock → `SERVER_ERROR`), `resolve-tenant-context.test.ts` (transient → `SERVER_ERROR`). **Gap:** the `(app)` layout's own try/catch → user-safe no-access render and the resolver's transient path are not DB-backed/route-executed (see Gap G-4) |
| **R-015 (NEW)** | TECH | H4 introspection's "tenant-owned" detection could miss a future table (view/matview exposing tenant rows, transitive FK to a non-`tenants` parent, a name-collision across schemas) → silent under-coverage | 2 | 2 | 4 | ⚠️ ACCEPTED (Phase A safe) | `inventory-gate-core.test.ts` covers tenant_id-carrier + differently-named-FK-to-`tenants` + tenants-root union + system-schema exclusion + unknown-schema fail-closed. Documented residual: views/matviews + transitive-FK chains not introspected (2-4 deferred Low). No current table is missed (all 3 are `public` base tables with direct `tenant_id`) |

### Low-Priority Risks (Score 1-2)

| Risk | Cat | Description | P | I | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| R-013 | PERF | Auth/RLS performance under many tenants/rows untested in Phase A | 1 | 2 | 2 | DOCUMENT — defer load testing to a later epic (single pilot tenant initially) |
| **R-016 (NEW)** | SEC | The single most security-critical line — the `(app)` layout `redirect("/login")` on UNAUTHENTICATED — has no EXECUTING assertion (only the gated `.skip` E2E) | 1 | 2 | 2 | MONITOR — the **DB/command** anonymous boundary is FULL (R-003); a regression dropping the redirect would pass the running suite but the user would still hit the server-resolved no-data state. Closed by the Playwright un-skip (Gap G-3) |

### Risk Category Legend

- **TECH**: Technical/Architecture (determinism, gate inertness, test-infra readiness, taxonomy completeness)
- **SEC**: Security (tenant isolation, auth boundary, service-role exposure, privilege escalation, spoofing)
- **DATA**: Data Integrity (audit append-only, metadata hygiene)
- **PERF**: Performance (SLA, scale) — out of Phase A scope
- **OPS**: Operations (environment readiness, CI wiring)
- **BUS**: Business Impact — minimal for this foundation epic

---

## AC / Requirement → Covering-Test Coverage Map (COVERED vs GAP)

Priorities are inherited from the original epic-2 design + the trace report. "COVERED" = a green,
mechanism-asserting test at the demanded level; "PARTIAL" = core property proven but a named
sub-dimension deferred; "GAP" = no executing test (gated scaffold only). Story column shows the
delivering story; **the foundation is judged as a whole**.

### P0 (Critical) — 14/14 COVERED (100%)

| # | Requirement (AC source) | Story | Status | Covering test file(s) |
| --- | --- | --- | --- | --- |
| P0-1 | Cross-tenant SELECT denied on all 3 tables (2.2 AC2 / 2.3 AC4) | 2-2/2-3 | ✅ COVERED | `cross-tenant-isolation.rls.test.ts`, `anon-path-isolation.rls.test.ts` (data-driven over `tenant-table-inventory.ts`) |
| P0-2 | Cross-tenant INSERT/UPDATE/DELETE denied, no spoofed ownership (2.2 AC2) | 2-2/2-3 | ✅ COVERED | `cross-tenant-isolation.rls.test.ts` (per-verb `42501` + `data===null` + BYPASSRLS re-read; fresh-UUID spoof → `42501` not `23505`) |
| P0-3 | Membership self-grant / role tampering denied (2.2 AC1/AC3) | 2-2 | ✅ COVERED | `membership-self-grant.rls.test.ts` |
| P0-4 | `tenant_admin`-only role CHECK + status CHECK enforced (2.2 AC1) | 2-2 | ✅ COVERED | `membership-self-grant.rls.test.ts`, `membership-integrity.int.test.ts` (`23514`) |
| P0-5 | DEFINER helpers fixed `search_path` + resist hijack (2.2 AC4) | 2-2/2-3 | ✅ COVERED | `security-definer-search-path.rls.test.ts`, `helper-semantics.rls.test.ts`, `record-audit-event-search-path.int.test.ts` |
| P0-6 | Anonymous cannot reach privileged command / function / DB surface (2.1 AC3 / 2.3 AC) | 2-1/2-3 | ✅ COVERED (DB/RPC) — route-redirect gated (G-1, does not reduce P0) | `envelope-failure-modes.int.test.ts`, `audit-anon-isolation.int.test.ts`, `anon-path-isolation.rls.test.ts` |
| P0-7 | Authenticated user without active membership denied; zero tenant data (2.1 AC2) | 2-1 | ✅ COVERED | `resolve-tenant-context.int.test.ts` (orphan → `TENANT_MEMBERSHIP_REQUIRED`, zero rows), `resolve-tenant-context.test.ts` |
| P0-8 | Command rejects client `tenant_id` mismatch / spoof (2.1/2.3) | 2-1/2-3 | ✅ COVERED | `resolve-tenant-context.int.test.ts`, `envelope-failure-modes.int.test.ts` |
| P0-9 | Command envelope happy path resolve→membership→validate→own→audit (2.3 AC1) | 2-3 | ✅ COVERED | `envelope-audit-write.int.test.ts` |
| P0-10 | `audit_events` append-only — app-path UPDATE/DELETE blocked (2.3 AC2/AC4) | 2-3 | ✅ COVERED | `audit-append-only.int.test.ts` |
| P0-11 | Cross-tenant audit read/write denied (2.3 SEC) | 2-3 | ✅ COVERED | `cross-tenant-isolation.rls.test.ts` (`audit_events` enrolled, seeded Tenant B row) |
| P0-12 | Service-role containment in built browser bundle (2.4 AC2) | 2-4 | ✅ COVERED | `check-bundle-containment.mjs` + `bundle-containment.test.ts` (clean→0; planted key-name/`NEXT_PUBLIC_*SERVICE_ROLE*`/demo-JWT/re-export→≥1; absent `.next`→throws) |
| P0-13 | H4 inventory gate fails CI on an unenrolled tenant table (2.4 AC3/AC4) | 2-4 | ✅ COVERED | `rls-inventory-gate.int.test.ts`, `inventory-gate-core.test.ts` + scratch-branch run recorded |
| P0-14 | Migration reset from empty succeeds; tables+helpers+CHECKs+RLS present (2.2 AC1) | 2-2 | ✅ COVERED | `migration-reset.int.test.ts` |

### P1 (High) — 8/10 COVERED (80%)

| # | Requirement (AC source) | Story | Status | Covering test / gap |
| --- | --- | --- | --- | --- |
| P1-1 | Active membership resolves correct tenant context server-side (2.1 AC1) | 2-1 | ✅ COVERED | `resolve-tenant-context.int.test.ts` + unit branches |
| P1-2 | Disabled/inactive membership = no-access, distinct from "no membership" (2.1) | 2-1/2-3 | ⚠️ **PARTIAL → GAP G-2** | Unit-only on the DB side: `resolve-tenant-context.test.ts` / `-core-edges.test.ts` (disabled/invited → `TENANT_MEMBERSHIP_REQUIRED`). **No DB-backed fixture creates a live disabled membership** |
| P1-3 | Envelope failure modes — auth/membership/validation/ownership each → typed code (2.3 AC1) | 2-3 | ✅ COVERED | `envelope-failure-modes.int.test.ts` + `envelope-core.test.ts` / `-core-edges.test.ts` (incl. `SERVER_ERROR` on transient throw) |
| P1-4 | Successful audit write records all fields incl. `created_at == injected ts` (2.3 AC2) | 2-3 | ✅ COVERED | `envelope-audit-write.int.test.ts` (field-by-field) |
| P1-5 | Audit metadata hygiene — secrets/.env/raw/PII never persisted (2.3) | 2-3 | ✅ COVERED | `audit-metadata.test.ts` + `audit-metadata-edges.test.ts` |
| P1-6 | Deterministic command timestamp; no sleeps (2.3 H1) | 2-3 | ✅ COVERED | `command-clock.test.ts` + INT timestamp assertion |
| P1-7 | Per-worker tenant-pair isolation under parallel run (2.2 H5) | 2-2 | ✅ COVERED | `factory-isolation.int.test.ts` |
| P1-8 | Harness fails on an intentionally weakened/mismatched access — proves the gate bites (2.4) | 2-4 | ✅ COVERED | `rls-inventory-gate.int.test.ts` (live shrunk) + `inventory-gate-core.test.ts` (pure shrunk) + scratch-branch |
| P1-9 | Anonymous privileged-function check across the DB/RPC inventory (2.4 AC1/AC5) | 2-4 | ✅ COVERED | `anon-path-isolation.rls.test.ts` (4 verbs × every enrolled table incl. `audit_events`; anon EXECUTE `42501` on all 3 RPCs) |
| P1-10 | Active tenant/company context displayed in the UI (2.1 AC1) | 2-1 | ❌ **GAP G-1 (NONE — gated E2E)** | `tests/e2e/auth/login-and-tenant-context.e2e.spec.ts` is `describe.skip` on a Playwright runner out of scope. Server authority that drives the display IS INT-covered (P1-1) |

### P2 (Medium) — 3/4 COVERED (1 by-design partial)

| # | Requirement (AC source) | Story | Status | Covering test / note |
| --- | --- | --- | --- | --- |
| P2-1 | Minimal lifecycle/audit events surface in record context; no analytics module (2.3 AC3) | 2-3 | ⚠️ PARTIAL **by design** | "No analytics module/route/nav item" positively asserted (nav-items still 7); the "events surface in record context" half has no consumer to assert against yet — substrate-only, intentional. Re-trace when the first audit-history consumer UI lands |
| P2-2 | User-safe error messages — no internal/stack/SQL/existence leakage | 2-1/2-3 | ✅ COVERED | generic Swedish messages in `tenant-context.ts`/`command-errors.ts`; envelope + resolver tests assert no raw value/stack/SQL/existence crosses the boundary |
| P2-3 | Factory contract extends to a CRM-shaped record without rework (2.2 B1) | 2-2/2-3 | ✅ COVERED (demonstrated) | `tests/factories/audit-events.ts` added additively alongside the two-tenant factories with no reshaping — the additive B1 contract in practice |
| P2-4 | `verify:lockfiles` guard failure-path regression test (epic-1 highest-priority deferred) | 2-2 | ✅ COVERED | `check-lockfiles.test.ts` (red on planted second lockfile / missing / invalid; green on a valid single `pnpm-lock.yaml`) |

### Coverage heuristics (blind-spot scan, consolidated)

- **Privileged-function/"endpoint" coverage:** Phase A exposes NO public privileged route/function/cron/webhook (architecture §20). The privileged surface = the DB + 3 RPCs (`is_active_tenant_member`, `is_tenant_admin`, `record_audit_event`) — all 3 carry anon-EXECUTE-`42501` negatives. **No uncovered endpoint.**
- **Auth/authz negative-path coverage:** every gate (unauthenticated, no-membership, disabled-membership, cross-tenant target, self-grant, role/status CHECK, anon EXECUTE) has a denial test. The single auth negative that is **unit-only on the DB side** is disabled-membership (P1-2 / G-2). **No missing auth negative-path class.**
- **Error-path coverage:** transient-infra → `SERVER_ERROR`, validation → `VALIDATION_FAILED`, ownership error → `SERVER_ERROR` (not masked as denial), Invalid-Date clock → `SERVER_ERROR`, non-UUID correlation/target id → reduced to safe value (no opaque `22P02`). **No happy-path-only P0/P1 criterion.**

---

## RANKED Coverage Gaps To Close

Ranked by (a) security/foundation weight, then (b) how cheaply closable. Each tagged
**[ON-CURRENT-STACK]** (closable today with `node --test` units / Vitest + local Supabase) or
**[PLAYWRIGHT-BLOCKED]** (needs the deferred browser runner). None is a release blocker — P0 is 100%
and every SEC property is FULL — but all should be closed in the next test-hardening / E2E-enablement
pass. The first two are the trace report's named P1 gaps; the rest are additional ones surfaced here.

| Rank | Gap | Priority | Stack tag | Effort | Closing action |
| --- | --- | --- | --- | --- | --- |
| **G-1** | **DB-backed disabled/inactive-membership → no-access behavior** (P1-2 / R-004). The distinct `disabled`/`invited` → `TENANT_MEMBERSHIP_REQUIRED` decision is pure-unit proven; no live fixture exercises a disabled membership against a real DB resolve/envelope. | P1 (HIGH) | **[ON-CURRENT-STACK]** | ~1-2h | Add a `disabled`-membership fixture to `tests/factories/tenants.ts` (additive, B1) + a DB-backed case in `envelope-failure-modes.int.test.ts` / `resolve-tenant-context.int.test.ts`. Promotes P1-2 PARTIAL→FULL → would move epic P1 to 90% (PASS). |
| **G-2** | **UI active-tenant-context display** (P1-10 / R-004). Only the `describe.skip` E2E asserts the top-bar tenant + user. Server authority is INT-covered; the UI-surface assertion is not executed. | P1 (HIGH) | **[PLAYWRIGHT-BLOCKED]** | ~2-4h after runner | Stand up the Playwright runner; un-skip `login-and-tenant-context.e2e.spec.ts`; assert the top-bar shows active tenant + current user. |
| **G-3** | **Anonymous `(app)` route-redirect to `/login`** (R-016; sub-dimension of P0-6). The DB/command anonymous boundary is FULL; only the `(app)`-layout browser redirect assertion is unexecuted (same gated suite as G-2). | P1 (HIGH; ride-along with G-2) | **[PLAYWRIGHT-BLOCKED]** | +~1h (same un-skip) | Same Playwright un-skip closes G-2 and G-3 together — assert anonymous request to a protected route redirects to `/login`. |
| **G-4** | **SERVER_ERROR-vs-no-access at the layout/integration level** (R-014). The taxonomy is proven in the pure core (transient→`SERVER_ERROR`, ownership-error→`SERVER_ERROR`-not-denial, Invalid-Date→`SERVER_ERROR`), but the `(app)` layout's own try/catch → user-safe no-access render and a live transient resolver fault are not DB-backed/route-executed. | P2 (MED) | **[ON-CURRENT-STACK]** (resolver/envelope transient) **+ [PLAYWRIGHT-BLOCKED]** (layout render) | ~1-2h (INT) | INT: inject a transient DB/RPC fault into a resolve/envelope run and assert `SERVER_ERROR` (not `TENANT_MEMBERSHIP_REQUIRED`/`TENANT_ACCESS_DENIED`). Layout-render-on-throw assertion rides the Playwright un-skip. |
| **G-5** | **`audit_events` not enrolled in the `anon-path-isolation.rls.test.ts` data-driven `TABLES` for anon UPDATE/DELETE** (2-3 iter-2 Low) — *now partially closed in 2-4* (audit_events enrolled in the anon suite). Verify all four anon verbs are data-driven over the shared inventory, not just SELECT/INSERT/EXECUTE. | P2 (MED) | **[ON-CURRENT-STACK]** | ~0.5h | Confirm/extend `anon-path-isolation.rls.test.ts` consumes `TENANT_TABLES` for anon UPDATE/DELETE on `audit_events` too (the privilege mechanism is identical; this is enumeration completeness). |
| **G-6** | **`actor_user_id ON DELETE SET NULL` FK behavior has zero test coverage** (2-3 Defer Low). The most-documented audit design decision (audit row survives a deleted actor by nulling the FK) is never exercised. | P2 (MED) | **[ON-CURRENT-STACK]** | ~0.5-1h | Privileged delete of an `auth.users` row → re-read asserts the audit row persists with `actor_user_id IS NULL` and all other columns intact. |
| **G-7** | **End-to-end R-010 metadata-hygiene assertion is near-vacuous on the happy path** (2-3 Defer Low). The strong proof is the pure-unit sanitizer suite; the INT happy-path command declares no `auditFields` so a smuggled secret was never on a metadata path regardless of the sanitizer. | P2 (MED) | **[ON-CURRENT-STACK]** | ~0.5-1h | Add a command whose `auditFields` routes caller-controlled metadata through `sanitizeAuditMetadata`, then assert forbidden content is dropped end-to-end (not only at the unit level). |
| **G-8** | **R-006 search-path hijack introspection assertion is over-fit + the disabled-path / H4 introspection shape gaps** (2-2/2-4 Defer Lows). `migration-reset.int.test.ts` `search_path` regex would pass a non-empty path; H4 introspection skips views/matviews + transitive-FK chains (R-015). The behavioral R-006 negative is the real proof; these are introspection-assertion-strength hardening. | P3 (LOW) | **[ON-CURRENT-STACK]** | ~1-2h | Parse the exact `search_path` proconfig entry and assert it is exactly empty; extend H4 introspection to views/matviews + transitive FK when the first such tenant table is proposed (no current table is missed). |
| **G-9** | **Auth/RLS performance under many tenants/rows** (R-013). | P3 (LOW) | **[ON-CURRENT-STACK]** (future) | deferred | Run `*nfr-assess` if/when auth/RLS performance is brought into scope (later epic). |

**Closing G-1 alone moves the epic P1 coverage from 80% → 90%, flipping the deterministic gate from
CONCERNS to PASS.** It is the single cheapest, highest-leverage on-current-stack action.

**Stack tally:** ON-CURRENT-STACK = G-1, G-4(part), G-5, G-6, G-7, G-8, G-9 (the substantive closable
set). PLAYWRIGHT-BLOCKED = G-2, G-3, G-4(layout-render part). The browser-runner enablement (one
un-skip) closes G-2 + G-3 together (and the layout-render slice of G-4).

---

## Consolidated Test Coverage Plan (as-shipped)

Test ID format `{EPIC}.{STORY}-{LEVEL}-{SEQ}`. Levels: UNIT (`node --test`), INT (Vitest server-command
integration), RLS (cross-tenant DB negative), E2E (Playwright — deferred). RLS is called out
separately from INT because it is the load-bearing coverage of this foundation and is parameterized
over the single shared `tenant-table-inventory.ts`.

### P0 (Critical) — run on every PR (the foundation's reason to exist)

All UNIT, INT, RLS-negative, the migration-reset + H4 inventory-gate + service-role containment checks.
14 requirement rows above → **~24-28 atomic scenarios** across the 39 live test files. **Status: all
green (131 unit + 89 INT on a clean reset).** These gate merges and map onto architecture CI §19
(typecheck → lint → unit → build → bundle-containment → migration reset → integration commands →
RLS/anon negatives + inventory gate).

### P1 (High) — run on PR to main

10 requirement rows → **~20-26 atomic scenarios**. **8/10 FULL** (envelope failure modes, audit
fields, determinism, parallel isolation, harness-bites, anon privileged-fn, active-membership resolve).
**2 open:** G-1 disabled-membership DB-backed (on-stack) and G-2 UI display (Playwright-blocked).

### P2 (Medium) — run in PR (fast) or nightly

4 rows → **~6-8 scenarios**. 3 FULL (message hygiene, factory extensibility, lockfile-guard
regression); 1 PARTIAL by design (audit surface in record context — no consumer yet). Plus the
on-stack hardening gaps G-4..G-8 land here when picked up.

### P3 (Low) — on-demand

Tenant-context copy/a11y polish (E2E, manual acceptable), harness DX (met — named-table failure
message), deferred-perf docs (R-013), introspection-assertion strength (G-8). **~4-6 scenarios.**

### Execution strategy (PR / Nightly / Weekly)

- **PR (every PR to main):** all UNIT + INT + RLS-negative + migration-reset + H4 inventory-gate +
  built-bundle containment. The dominant wall-clock cost is the one-time `supabase db reset`, not test
  volume; the RLS suite is parameterized over the inventory + per-worker tenant pairs so it scales to
  many tables in minutes. Maps onto the existing CI `verify` job (install → lockfiles →
  service-role-containment → typecheck → lint → unit → build → **bundle-containment**) + `db` job
  (`supabase start` → `db reset` → `test:int`).
- **Nightly:** full parallel run of the RLS suite across a larger worker count to surface
  parallel-isolation interference (R-012); periodic re-confirm of the H4 scratch-branch bite.
- **Weekly / on-demand:** P3 ergonomics + any future auth/RLS performance exploration (R-013, deferred).

---

## Resource Estimates (gap-closure pass — ranges only)

The foundation is **already implemented and green**; this estimate is for the **next hardening +
E2E-enablement pass** that closes the ranked gaps, not for re-building shipped coverage.

| Work item | Gap(s) | Stack | Effort |
| --- | --- | --- | --- |
| Disabled-membership DB-backed fixture + cases | G-1 | on-current-stack | ~1-2h |
| Transient-fault → `SERVER_ERROR` INT cases | G-4 (INT slice) | on-current-stack | ~1-2h |
| Anon UPDATE/DELETE data-driven enrollment verify (`audit_events`) | G-5 | on-current-stack | ~0.5h |
| `ON DELETE SET NULL` actor-delete persistence test | G-6 | on-current-stack | ~0.5-1h |
| End-to-end metadata-hygiene command + assertion | G-7 | on-current-stack | ~0.5-1h |
| Introspection-assertion strength (search_path exact; H4 views/transitive-FK) | G-8 | on-current-stack | ~1-2h |
| **On-current-stack subtotal** | G-1,4,5,6,7,8 | | **~5-9h** |
| Stand up Playwright runner + un-skip login/tenant-context E2E (closes G-2 + G-3 + G-4 layout slice) | G-2, G-3, G-4(render) | playwright-blocked | ~4-8h (first-time runner) + ~2-3h tests |
| **Playwright-enablement subtotal** | G-2,3,4(render) | | **~6-11h** |
| **Total gap-closure pass** | | | **~11-20h (~1.5-2.5 days)** |

---

## Quality Gate Criteria (consolidated)

### Pass/Fail thresholds

- **P0 pass rate:** 100% — **MET** (14/14) — tenant-isolation, auth-boundary, service-role containment, audit append-only, inventory gate.
- **P1 pass rate:** target ≥90% / minimum ≥80% — **currently 80%** (8/10; two surface/level gaps with named owners). Closing G-1 → 90% (PASS).
- **P2/P3 pass rate:** ≥90% (informational) — met (the one PARTIAL is by-design substrate-only).
- **High-risk mitigations (R-001..R-008):** 100% complete + green — **MET**.

### Non-negotiable requirements (foundation cannot ship without) — all MET

- [x] All P0 tests pass.
- [x] No high-risk (≥6) item unmitigated.
- [x] SEC-category tests pass 100%.
- [x] H4 RLS inventory gate **live in CI and proven to fail** on an uncovered table (R-008).
- [x] Built-bundle service-role containment green on a clean build, red on a planted token (R-002).
- [x] `audit_events` proven append-only through app paths + trigger backstop (R-009); metadata hygiene asserted (R-010).
- [x] Migration reset from empty succeeds; factories build the two-tenant fixture per worker.

### Deterministic gate decision (carried from the trace report)

Rule 5 (P1 80-89% with P0 100% and overall ≥80% → **CONCERNS**) is triggered: **CONCERNS — proceed,
no release blocker, close the two named P1 gaps soon.** Not a FAIL (P0 100%, overall 89%). Becomes PASS
on closing G-1 (P1 → 90%).

---

## Consolidated Mitigation Status (R-001..R-016)

| Risk | Score | Mitigation (as-shipped) | Status |
| --- | --- | --- | --- |
| R-001 cross-tenant RLS | 6 | data-driven cross-tenant suite (3 tables × 4 verbs) over shared inventory | ✅ green |
| R-002 service-role leak | 6 | built-bundle grep (authoritative) + source guard + bite units | ✅ green |
| R-003 anonymous privileged access | 6 | anon-path + envelope/audit anon suites (DB/RPC); route-redirect gated (R-016) | ✅ green (DB/RPC) |
| R-004 client tenant spoof | 6 | resolve-tenant-context + envelope-failure-modes | ✅ green |
| R-005 self-grant / escalation | 6 | membership-self-grant + integrity | ✅ green |
| R-006 DEFINER search_path | 6 | security-definer-search-path + record-audit-event-search-path | ✅ green |
| R-007 test-infra readiness | 6 | dual runner + local stack + factories (2-2) | ✅ satisfied |
| R-008 inventory gate inert | 6 | rls-inventory-gate + inventory-gate-core (bite proven) | ✅ green |
| R-009 audit append-only | 4 | audit-append-only + cross-tenant audit enrollment + trigger | ✅ green |
| R-010 audit metadata hygiene | 4 | audit-metadata(+edges) allow-list units | ✅ green |
| R-011 non-deterministic timestamp | 4 | command-clock + audit-write timestamp assertion | ✅ green |
| R-012 shared-fixture interference | 4 | factory-isolation (per-worker pair) | ✅ green |
| R-013 auth/RLS perf | 2 | DOCUMENT only — deferred | ✅ accepted |
| **R-014 SERVER_ERROR taxonomy at layout/INT** | 4 | pure-core proven; layout/transient INT slice = G-4 | ⚠️ partial → G-4 |
| **R-015 H4 introspection shape bound** | 4 | tenant_id + FK-to-`tenants` + root union + fail-closed unknown-schema; views/transitive-FK = G-8 | ⚠️ accepted (Phase A safe) |
| **R-016 route-redirect un-executed** | 2 | DB/command anon boundary FULL; browser redirect = G-3 | ⚠️ gated → G-3 |

**No high-priority risk (≥6) is unmitigated or unwaived.**

---

## Disclosed Phase A residuals (accepted, NOT gate gaps)

- `tenant_memberships_select_own` / `audit_events_select_own` scope reads by **tenant**
  (`is_tenant_admin(tenant_id)`), not by `user_id`/`actor_user_id = auth.uid()` — an intra-tenant
  co-member read in a (future) multi-admin tenant. Accepted, intended Phase A single-admin design; the
  `auth.uid()` least-privilege tightening is the RBAC-seam follow-up. The cross-**tenant** boundary
  (what the harness enforces) holds. Not a coverage gap.
- `record_audit_event` trusts caller-supplied `p_actor_user_id` (intra-tenant attribution; FK-bounded;
  single-admin Phase A) — deferred to the RBAC/multi-admin seam. Not a coverage gap.

---

## Interworking & Regression (the standing mechanism)

| Component | Impact | Regression scope |
| --- | --- | --- |
| **Every future tenant-owned table (Epics 3-9)** | Inherits the RLS pattern + must enroll in `tenant-table-inventory.ts` | The **H4 gate is the standing regression mechanism** — a future PR adding a tenant table without a negative test FAILS CI with a named message (`rls-inventory-gate.int.test.ts`) |
| **CI `verify` + `db` jobs** | New stages: bundle-containment (after build), inventory gate + generalized negatives (in `test:int`) | All existing gates must stay green + ordered; bundle scan REQUIRES a prior `next build` |
| **Command envelope + `writeAuditEvent`** | Every later sensitive mutation (Epics 3-8) plugs into the same envelope + audit | A regression in the envelope's gate ordering / audit append-only is caught by `envelope-*` + `audit-*` suites |
| **Pre-existing flake (logged, not an Epic 2 defect)** | `envelope-audit-write.int.test.ts` uses a hardcoded `correlationId` and accumulates rows across non-reset `test:int` runs | A single clean `db reset → test:int` (the CI sequence) is green; logged as a deferred test-hardening item (use a fresh per-run correlation id) |

---

## Assumptions and Dependencies

### Assumptions
1. Phase A product role is exactly `tenant_admin`; no other role exists to test.
2. Pooled multi-tenancy (one Supabase project, many tenants) per ADR-A002 — RLS, not separate DBs, is the isolation mechanism under test.
3. Automated tests run against **local Supabase only** (`assertLocalStack()` loopback-gated), never shared dev/staging/prod.
4. Test-user auth is password-based / admin-created (B2); magic-link-only is not used for command tests.
5. Two deliberately-separated runners: `node --test` (pure units) + Vitest 4.1.9 (DB-backed INT/RLS); `pnpm test` runs both via `scripts/run-tests.mjs`.
6. The two-tenant factory contract (B1) is the substrate every later tenant-owned table reuses (additive only).

### Dependencies
1. **Playwright browser runner** (deferred) — required to close G-2/G-3 and the layout-render slice of G-4. Owner: a later E2E enablement task.
2. **Local Supabase stack** (`supabase start` + `supabase db reset`) — required for all INT/RLS/migration tests; CI `db` job uses `SUPABASE_TEST_REQUIRED=1` so a missing stack is a hard failure (no false-green).

### Risks to plan
- **Risk:** the Playwright runner stays deferred indefinitely → G-2/G-3 (UI display + route redirect) never get an executing assertion.
  - **Impact:** a regression dropping the `(app)` redirect or the top-bar indicator passes the running suite.
  - **Contingency:** the DB/command anonymous + tenant-authority boundary is FULL today (R-003/R-016 mitigated at the DB layer); G-1 (on-stack) independently lifts the gate to PASS; schedule the Playwright un-skip in the next E2E pass.

---

## Follow-on Workflows (Manual)

- Run `*atdd` to scaffold the disabled-membership DB-backed case (G-1) and the transient-fault `SERVER_ERROR` INT case (G-4) — both on-current-stack, no runner needed.
- Run `*automate` after the Playwright runner lands to un-skip + broaden the browser E2E (G-2/G-3).
- Run `*trace` again after closing G-1 to confirm the gate flips CONCERNS → PASS (P1 80% → 90%).
- Run `*nfr-assess` if/when auth/RLS performance (R-013) is brought into scope.

---

## Appendix

### Knowledge Base References
- `risk-governance.md` — risk classification + gate decision framework
- `probability-impact.md` — 1-9 scoring methodology and DOCUMENT/MONITOR/MITIGATE/BLOCK thresholds
- `test-levels-framework.md` — UNIT/INT/RLS(integration)/E2E selection, duplicate-coverage guard
- `test-priorities-matrix.md` — P0-P3 prioritization and risk-to-priority mapping

### Related Documents
- Original epic-2 design (pre-impl, NOT overwritten): `_bmad-output/test-artifacts/test-design-epic-2.md`
- Epic-2 traceability + gate (post-impl authority): `_bmad-output/test-artifacts/traceability/epic-2-traceability-report.md`
- Stories: `_bmad-output/implementation-artifacts/2-1..2-4-*.md`
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (§5/§6/§9/§15/§18/§19/§20; ADR-A002/A003/A009)
- Shared inventory (the single enrollment source of truth): `tests/integration/rls/tenant-table-inventory.ts`

### Live test inventory (39 files — the as-shipped foundation coverage)
- **Units (`node --test`):** `tests/unit/server/auth/*` (resolve-tenant-context + edges/claims/tenant-name/core-edges), `tests/unit/resolve-tenant-context-core.test.ts`, `tests/unit/server/commands/*` (envelope-core(+edges), audit-metadata(+edges), command-clock, correlation), `tests/unit/rls/inventory-gate-core.test.ts`, `tests/unit/scripts/verify/*` (check-lockfiles, service-role-containment, bundle-containment), `tests/unit/server/db/supabase-env.test.ts`, `tests/unit/lib/result/result.test.ts`.
- **Integration (Vitest, local stack):** `tests/integration/rls/*` (cross-tenant-isolation, anon-path-isolation, membership-self-grant, membership-integrity, helper-semantics, security-definer-search-path, factory-isolation, migration-reset, rls-inventory-gate + the shared `tenant-table-inventory.ts`), `tests/integration/commands/*` (envelope-audit-write, envelope-failure-modes, audit-append-only, audit-anon-isolation, record-audit-event-search-path), `tests/integration/server/auth/resolve-tenant-context.int.test.ts`.
- **E2E (gated, `describe.skip`):** `tests/e2e/auth/login-and-tenant-context.e2e.spec.ts` — the single standing gap, Playwright-blocked (G-2/G-3).
- **Factories/support:** `tests/factories/{tenants,audit-events,admin-sql}.ts`, `tests/support/{test-env,global-setup}.ts`.

---

**Generated by**: BMad TEA Agent — Test Architect Module
**Workflow**: `bmad-testarch-test-design` (epic-level, holistic foundation consolidation)
**Version**: 4.0 (BMad v6)
