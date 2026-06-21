---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-06-21'
workflowType: testarch-test-design
designLevel: epic
epicNum: 2
---

# Test Design: Epic 2 - Tenant Access, Admin Auth, RLS, And Audit Foundation

**Date:** 2026-06-21
**Author:** Rasmus
**Status:** Draft
**Design Level:** Epic-Level (Phase 4)
**Mode:** Risk-based, evidence-backed (Master Test Architect)

---

## Executive Summary

**Scope:** Epic-level test design for Epic 2 — the security/data-foundation epic that makes
tenant access trustworthy *before* any business data exists. Covers Supabase Auth entry,
server-side tenant context resolution, `tenants`/`tenant_memberships` schema with RLS helpers,
the server command envelope, append-only `audit_events`, two-tenant test fixtures/factories,
and the recurring cross-tenant security regression harness.

**Epic goal (from epics.md):** Make tenant access trustworthy before business data exists.
This is the RLS and command-authority baseline that every later tenant-owned table (CRM, pricing,
calculations, quotes, files, jobs) inherits. A defect here is silently inherited by all of Phase A.

**Risk Summary:**

- Total risks identified: **13**
- High-priority risks (score ≥6): **8**
- Critical (score 9 / auto-BLOCK at design time): **0** (architecture defines the controls; risk
  is in correct implementation + durable enforcement, which Story 2.4's harness exists to police)
- Critical categories: **SEC** (tenant isolation, service-role containment, anonymous privileged
  access, client tenant spoofing), then **TECH/OPS** (test-environment readiness) and **DATA**
  (audit append-only integrity)

**Coverage Summary:**

- P0 scenarios: **~24-28** (~28-44 hours)
- P1 scenarios: **~20-26** (~22-32 hours)
- P2/P3 scenarios: **~12-18** (~6-14 hours)
- **Total effort**: **~56-90 hours (~1.5-2.5 weeks)** including first-time framework/local-Supabase setup

**Headline:** This epic is dominated by **Integration (server-command)** and **RLS-negative**
coverage, not UI. The single most important deliverable is the **parameterized cross-tenant RLS
negative suite + tenant-table inventory gate** (Story 2.4, ties to architecture H4), because it is
the regression mechanism that protects every future epic. Treat its absence or weakness as a
release blocker for the epic, not a nice-to-have.

---

## Critical Prerequisite: Test Infrastructure Does Not Yet Exist

Evidence: `package.json` line 15 is an honest placeholder (`pnpm test` prints "No unit test suite yet");
there is no `supabase/` directory; epic-1 retro Part 2 confirms the runner and local Supabase stack
land *inside* Epic 2. This is the gating reality for the whole plan:

| Capability | Status entering Epic 2 | Lands in | Blocks |
| --- | --- | --- | --- |
| Real test runner (`pnpm test` → Vitest or equivalent) | Placeholder only | TEA `testarch-framework`, run as/within Story 2.2 or a dedicated pre-2.4 task | All automated tests below; Story 2.4 hardest-blocked |
| Local Supabase stack (`supabase start` / `supabase db reset`) | `supabase/` absent | Story 2.2 (first migrations) | All Integration + RLS + migration-reset tests |
| Two-tenant factories (tenants, auth users, `tenant_admin` memberships) | None | Story 2.2 (blocker B1 contract) | Every cross-tenant negative test |
| Password / admin-created test users (B2) | Decided, not built | Story 2.1/2.2 | Authenticated command + auth-boundary tests |

**Consequence for sequencing (do not fight this):**

- Story **2.1** (auth UI + `resolveTenantContext`) can be implemented and partially tested at the
  UI/server-action layer, but its *authoritative* integration/RLS tests are gated on 2.2's local stack.
- Story **2.2** is the enabling story: it must establish the framework, local reset target, and the
  factory contract. Its own tests (migration reset, RLS negatives, role constraint) are the first
  real suites in the codebase.
- Story **2.4** cannot be written until the runner exists. Schedule `testarch-framework` *before* 2.4.

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **Full RBAC / role-management UI** | Phase A is `tenant_admin` only (epics.md explicit non-scope; AGENTS.md deferred list) | Role constrained to `tenant_admin` at the DB level (CHECK/constraint) + a test that proves any other role is rejected; no role-management surface exists to test |
| **Customer portal / public auth** | Deferred; no unauthenticated privileged surface in Phase A | Negative test: no anonymous/public privileged route or function is callable (R-003) |
| **Broad audit analytics module** | Audit is append-only traceability for critical events only (ADR/§20), not analytics | Test that only minimal lifecycle/audit events surface in record context; no analytics endpoint exists |
| **Fortnox / supplier / AI / field auth** | Deferred modules; no production auth surface | Scope-guard review + nav guardrail inherited from Epic 1; no auth code paths for these exist |
| **One-Supabase-project-per-customer** | Pooled tenancy is the chosen architecture (ADR-A002) | Stop-condition in Story 2.2; pooled-tenancy RLS is exactly what this epic tests |
| **Performance / load testing of auth & RLS** | Premature for internal pilot (single tenant in prod initially); no SLA defined yet | Deferred to a later epic; functional correctness of isolation is the Phase A concern. Documented as residual (R-013) |
| **External security scanning services** | Story 2.4 explicitly keeps checks local/CI-friendly | Local grep/bundle-inspection containment checks cover the Phase A threat (service-role leakage) |

---

## Risk Assessment

Scoring per `probability-impact.md`: Probability 1 (unlikely) / 2 (possible) / 3 (likely);
Impact 1 (minor) / 2 (degraded) / 3 (critical). Score = P × I. Thresholds: 1-3 DOCUMENT,
4-5 MONITOR, 6-8 MITIGATE (CONCERNS at gate), 9 BLOCK (auto-FAIL).

Impact rationale note: most isolation failures here are scored **Impact 3** because a cross-tenant
data leak is a critical confidentiality/regulatory exposure AND it is silently inherited by every
later tenant-owned table. Probability is held at 2 (not 3) because the architecture already
specifies the correct controls — the residual risk is implementation correctness and drift, not
an unaddressed design gap.

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Prob | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | SEC | RLS missing or wrong on `tenants`/`tenant_memberships`/`audit_events` lets Tenant A read/write Tenant B rows | 2 | 3 | 6 | Parameterized cross-tenant negative suite (SELECT/INSERT/UPDATE/DELETE) on every tenant-owned table; RLS enabled-and-forced assertion | Dev (2.2) | Story 2.2 |
| R-002 | SEC | Service-role key (RLS-bypassing) leaks into browser bundle, public route payload, or logs | 2 | 3 | 6 | Bundle/grep containment check (Story 2.4) for key names, secret placeholders, server-only internals; service-role used server-only and minimally | Dev (2.4) | Story 2.4 |
| R-003 | SEC | An unauthenticated/anonymous caller can invoke a privileged command, route, or function | 2 | 3 | 6 | Envelope rejects unauthenticated first; anonymous-access negative tests on every protected route/command; no public privileged endpoint exists | Dev (2.1/2.3) | Story 2.1-2.3 |
| R-004 | SEC | Server trusts a client-supplied `tenant_id` instead of membership-resolved tenant (spoofing) | 2 | 3 | 6 | `resolveTenantContext` is server authority; client `tenant_id` ignored or verified; mismatch negative tests (R-004 scenarios) | Dev (2.1/2.3) | Story 2.1-2.3 |
| R-005 | SEC | `tenant_memberships` self-grant / privilege escalation: a user inserts or updates their own membership/role | 2 | 3 | 6 | RLS on `tenant_memberships` forbids self-insert/role-change through app paths; role constrained to `tenant_admin`; negative tests for self-grant and role tampering | Dev (2.2) | Story 2.2 |
| R-006 | SEC | `SECURITY DEFINER` helper (`is_active_tenant_member`/`is_tenant_admin`) without fixed `search_path` enables function hijacking / privilege bypass | 2 | 3 | 6 | Helpers declared with fixed `search_path`; explicit review; negative test that a malicious schema/object on the path cannot alter helper behavior | Dev (2.2) | Story 2.2 |
| R-007 | OPS/TECH | Test runner + local Supabase stack not ready when Story 2.4 needs them → security harness is skipped or stubbed and ships hollow | 3 | 2 | 6 | Run TEA `testarch-framework` before 2.4; 2.2 establishes local reset + factories; gate Story 2.4 start on a working `pnpm test` + `supabase db reset` | SM/Dev | Before Story 2.4 |
| R-008 | TECH | RLS inventory gate is incomplete or not wired into CI → a future tenant-owned table ships with no cross-tenant test and nobody notices | 2 | 3 | 6 | Inventory gate (H4): harness diffs schema tenant-owned tables vs enrolled tables, CI fails on gap; verify by deliberately omitting a table on a scratch branch and confirming CI red | Dev (2.4) | Story 2.4 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Prob | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| R-009 | DATA | `audit_events` is mutable/deletable through normal app paths → audit trail is not trustworthy | 2 | 2 | 4 | Append-only enforced by trigger/constraint/command-only rule (not UI disabling); UPDATE/DELETE negative tests; cross-tenant audit read/write denial | Dev (2.3) |
| R-010 | DATA | Audit metadata captures secrets, `.env`, raw file contents, or broad free-text PII | 2 | 2 | 4 | Schema/contract limits metadata to safe fields; test asserts forbidden content is never persisted; review of metadata builder | Dev (2.3) |
| R-011 | TECH | Non-deterministic command timestamps (H1) make lifecycle/audit assertions flaky and time-dependent tests rely on sleeps | 2 | 2 | 4 | Single injectable command timestamp (clock or DB `now()` captured once); RPCs accept explicit timestamp params; tests assert on deterministic timestamp, never sleep | Dev (2.3) |
| R-012 | TECH | Shared mutable tenant fixtures cause cross-test interference under parallel execution (H5) → flaky/false-green security tests | 2 | 2 | 4 | Per-worker tenant-pair provisioning via factories; no shared mutable tenant fixture; run suite parallel in CI to surface interference | Dev (2.2) |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Prob | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| R-013 | PERF | Auth/RLS performance under many tenants/rows untested in Phase A | 1 | 2 | 2 | Monitor; defer load testing to a later epic (single pilot tenant initially) |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, test-infra readiness, determinism)
- **SEC**: Security (tenant isolation, auth, service-role exposure, privilege escalation)
- **PERF**: Performance (SLA, degradation, scale)
- **DATA**: Data Integrity (audit append-only, metadata hygiene)
- **BUS**: Business Impact (UX harm, logic errors) — minimal for this foundation epic
- **OPS**: Operations (deployment, environment readiness, CI wiring)

---

## Entry Criteria

- [ ] Epic 1 merged (CI gates green, `.env.example` present, local-setup docs available)
- [ ] **Real test runner wired** (`pnpm test` runs a real suite, not the placeholder) — TEA `testarch-framework` complete
- [ ] **Local Supabase stack operational** (`supabase start` + `supabase db reset` work locally and in CI) — delivered by Story 2.2
- [ ] Two-tenant factories available (tenants, auth users, `tenant_admin` memberships) — Story 2.2 (blocker B1)
- [ ] Password/admin-created test-user auth method available (blocker B2); test-setup keys confirmed test-only
- [ ] Windows/WSL Docker conventions for Supabase Compose confirmed (no global Docker changes, no fixed `container_name`, configurable ports — epic-1 retro item 4)
- [ ] Requirements/assumptions agreed by Dev/QA/PM (epic acceptance criteria are the contract)

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing or each failure explicitly triaged/waived
- [ ] **Cross-tenant RLS negative suite green for `tenants`, `tenant_memberships`, `audit_events`** (all of SELECT/INSERT/UPDATE/DELETE)
- [ ] **RLS table-inventory gate live in CI** and proven to fail on an uncovered tenant-owned table (scratch-branch verification done)
- [ ] **Service-role containment check green** (no key names/secret placeholders/server-only internals in browser bundle, public payloads, or logs)
- [ ] **Anonymous-access negatives green** for every protected route/command
- [ ] `audit_events` append-only proven (UPDATE/DELETE blocked through app paths) and metadata hygiene asserted
- [ ] Migration reset from empty DB succeeds; factories build the two-tenant fixture per worker
- [ ] No open high-priority (≥6) risk unmitigated or unwaived
- [ ] `verify:lockfiles` guard failure path has a regression unit test (epic-1 retro HIGHEST-PRIORITY deferred item — first unit test when harness lands)

---

## Test Coverage Plan

Test ID format `{EPIC}.{STORY}-{LEVEL}-{SEQ}`. Levels: UNIT, INT (server-command integration),
RLS (cross-tenant DB negative), E2E. RLS is called out separately from INT because it is the
load-bearing coverage of this epic and is parameterized over the tenant-table inventory.

### P0 (Critical) — Run on every commit/PR

**Criteria**: Blocks the trust foundation + high risk (≥6) + no workaround.

| Requirement (AC source) | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| Cross-tenant SELECT denied on `tenants`/`tenant_memberships`/`audit_events` (2.2 AC2, 2.3 AC) | RLS | R-001, R-009 | 3-4 | Dev | Parameterized over tenant-table inventory |
| Cross-tenant INSERT/UPDATE/DELETE denied (Tenant A cannot mutate/spoof Tenant B) (2.2 AC2) | RLS | R-001 | 4-6 | Dev | One per verb × table; proves no spoofed ownership |
| Membership self-grant / role tampering denied (2.2 AC1, escalation) | RLS | R-005 | 2-3 | Dev | User cannot insert own membership or change own role |
| `tenant_admin`-only role constraint enforced (any other role rejected) (2.2 AC1) | RLS/UNIT | R-005 | 1-2 | Dev | DB CHECK/constraint + negative |
| `SECURITY DEFINER` helpers have fixed `search_path` and resist path hijack (2.2 tech notes) | INT | R-006 | 2 | Dev | Malicious-path object cannot alter helper result |
| Anonymous user cannot reach protected route/command/function (2.1 AC3, 2.3 AC) | INT/E2E | R-003 | 3-4 | Dev | Redirect/reject; no privileged anon call |
| Authenticated user without active membership is denied; no tenant data loaded (2.1 AC2) | INT/E2E | R-004 | 2-3 | Dev | User-safe message; zero tenant rows returned |
| Command rejects client-supplied `tenant_id` mismatch (spoofing) (2.1/2.3 tech notes) | INT | R-004 | 2-3 | Dev | Server authority; ignored-or-verified path |
| Command envelope: full happy path resolves user→membership→validation→ownership→audit (2.3 AC1) | INT | R-003, R-004 | 2 | Dev | The canonical envelope success scenario |
| `audit_events` append-only: UPDATE/DELETE blocked through app paths (2.3 AC2) | INT | R-009 | 2 | Dev | Trigger/constraint, not UI-only |
| Cross-tenant audit read/write denied (Tenant A cannot read Tenant B audit) (2.3 SEC impact) | RLS | R-001, R-009 | 2 | Dev | Audit table joins the tenant inventory |
| Service-role containment: no key names/secret placeholders/server internals in browser bundle, public payloads, logs (2.4 AC2) | INT/UNIT | R-002 | 2-3 | Dev | Grep/inspect built bundle + route payloads |
| RLS table-inventory gate fails CI when a tenant-owned table is unenrolled (2.4 AC4, H4) | INT | R-008 | 2 | Dev | Schema-vs-suite diff; scratch-branch verification |
| Migration reset from empty DB succeeds; required tables+helpers created (2.2 AC1) | INT | R-007 | 1-2 | Dev | `supabase db reset` green; objects present |

**Total P0**: ~24-28 tests

### P1 (High) — Run on PR to main

**Criteria**: Important lifecycle/feature + medium risk (3-4) + common workflows.

| Requirement (AC source) | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| Active membership resolves correct tenant context server-side (2.1 AC1) | INT | R-004 | 2 | Dev | `resolveTenantContext` returns membership-derived tenant |
| Disabled/inactive membership is treated as no-access (2.1 test req) | INT | R-004 | 2 | Dev | Distinct from "no membership at all" |
| Command envelope failure modes: auth failure, membership failure, validation failure each return typed user-safe error (2.3 AC1, test req) | INT | R-003 | 4-6 | Dev | Stable codes: UNAUTHENTICATED / TENANT_MEMBERSHIP_REQUIRED / TENANT_ACCESS_DENIED / VALIDATION_FAILED |
| Successful audit write records tenant/actor/command/event-type/target/correlation-id/safe-metadata/timestamp (2.3 AC2) | INT | R-009, R-010 | 2-3 | Dev | Field-by-field assertion |
| Audit metadata hygiene: secrets/.env/raw-file/broad-PII never persisted (2.3 tech notes) | INT/UNIT | R-010 | 2-3 | Dev | Forbidden-content assertion |
| Deterministic command timestamp used for lifecycle/event/audit; no sleep-based timing (2.3 H1) | INT/UNIT | R-011 | 2 | Dev | Injectable clock or single DB `now()` |
| Per-worker tenant-pair isolation holds under parallel run (2.2 H5) | INT | R-012 | 1-2 | Dev | Run suite parallel; no cross-test interference |
| Harness fails on an intentionally mismatched tenant access attempt (2.4 test req) | INT | R-001, R-008 | 1-2 | Dev | Proves the harness actually bites |
| Anonymous privileged-endpoint check across the route inventory (2.4 AC1) | INT | R-003 | 2-3 | Dev | Read/insert/update/delete/command-mismatch dimensions |
| Active tenant/company context is displayed in the UI (2.1 AC1) | E2E | R-004 | 1-2 | Dev | UI reflects server-resolved tenant |

**Total P1**: ~20-26 tests

### P2 (Medium) — Run nightly/weekly (or in PR if fast)

**Criteria**: Secondary behavior + low risk (1-2) + edge cases.

| Requirement (AC source) | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| Minimal relevant lifecycle/audit events surface in record context; no analytics module (2.3 AC3) | INT | R-010 | 2 | Dev | Asserts narrow surface, not breadth |
| User-safe error messages contain no internal/stack detail leakage | INT | R-002 | 1-2 | Dev | Message hygiene |
| Factory contract extensibility: factories cleanly extend to a CRM-shaped record without rework (2.2 B1) | UNIT/INT | R-012 | 1-2 | Dev | Forward-compatibility smoke for Epic 3 |
| `verify:lockfiles` guard failure path regression test (epic-1 retro highest-priority deferred) | UNIT | R-007 | 1-2 | Dev | First unit test when harness lands |

**Total P2**: ~6-8 tests

### P3 (Low) — Run on-demand

| Requirement | Test Level | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- |
| Tenant-context display copy / a11y polish | E2E | 1-2 | Dev | Cosmetic; manual acceptable |
| Harness developer-ergonomics (clear failure output when a table is unenrolled) | UNIT | 1-2 | Dev | DX, not correctness |
| Documented limitation notes for deferred perf testing (R-013) | docs | 1 | Dev | Awareness only |

**Total P3**: ~4-6 tests

---

## Execution Strategy (PR / Nightly / Weekly)

Philosophy: **run everything in PRs if the suite is under ~15 minutes**; defer only genuinely
expensive/long-running work. For Epic 2 the heavy cost is environment startup (local Supabase),
not test volume.

- **PR (every PR to main):** All UNIT, INT, RLS-negative, and the migration-reset + inventory-gate
  + service-role containment checks. These are the epic's reason to exist and must gate merges.
  Map directly onto the architecture CI stages §19 (typecheck → lint → unit → build → migration
  reset → integration commands → RLS/storage negatives). E2E smoke (tenant-context display,
  anonymous redirect) runs in PR if the headed/browser cost stays modest.
- **Nightly:** Full parallel run of the RLS suite across a larger worker count to surface
  parallel-isolation interference (R-012), plus the scratch-branch inventory-gate verification as
  a periodic guard.
- **Weekly / on-demand:** P3 ergonomics + any future auth/RLS performance exploration (R-013,
  deferred). No performance/chaos suite is in scope for this epic.

Playwright/Vitest parallelization note: the RLS negative suite is parameterized over the
tenant-table inventory and per-worker tenant pairs, so it scales to many tables in minutes;
the dominant wall-clock cost is the one-time `supabase db reset`, not per-test execution.

---

## Resource Estimates

Ranges only (no false precision). Estimates **include first-time setup**: the test runner and
local Supabase stack do not exist yet, so Epic 2 pays the framework-initialization tax once.

| Priority | Count | Hours/Test (incl. setup share) | Total Hours | Notes |
| --- | --- | --- | --- | --- |
| P0 | ~24-28 | ~1.2-1.6 | ~28-44 | Security-critical; RLS/containment setup-heavy |
| P1 | ~20-26 | ~1.0-1.3 | ~22-32 | Envelope failure modes, audit fields, determinism |
| P2 | ~6-8 | ~0.5-1.0 | ~4-8 | Secondary/edge + lockfile-guard regression |
| P3 | ~4-6 | ~0.25-0.5 | ~2-6 | Exploratory/cosmetic/docs |
| **Total** | **~54-68** | **-** | **~56-90** | **~1.5-2.5 weeks** (1 dev), framework setup included |

One-time setup line items folded into the above (do not double-count):

- TEA `testarch-framework` runner initialization (Vitest or equivalent) wired into `pnpm test`/CI: ~4-8h
- Local Supabase CLI stack + first migration + `db reset` target + CI service: ~6-12h
- Two-tenant factory layer (tenants, auth users, `tenant_admin` memberships) with per-worker isolation: ~6-10h

### Prerequisites

**Test Data:**

- Two-tenant factory (tenants, auth users, `tenant_admin` memberships) — faker-based, per-worker, auto-cleanup; `seed.sql` stays a minimal deterministic baseline only (B1)
- Password-based or admin-created test users (B2); test-setup admin/service key is test-only and never imported into app/client code

**Tooling:**

- Test runner (Vitest assumed; TEA `testarch-framework` decides) for UNIT/INT
- Supabase CLI local stack for INT/RLS/migration-reset (local only, never shared dev/staging/prod — architecture §18)
- Bundle/grep inspection for service-role containment (no external security service required)
- Optional Playwright for the small E2E surface (tenant-context display, anonymous redirect)

**Environment:**

- Local Supabase via Docker honoring Windows/WSL conventions (no global Docker changes, no fixed `container_name`, no DB bind mounts to Windows paths, configurable ports — epic-1 retro item 4)
- CI runs the same `supabase db reset` + suite; tests target local Supabase exclusively

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions) — these are tenant-isolation, auth-boundary, service-role
  containment, audit append-only, and inventory-gate tests
- **P1 pass rate**: ≥95% (failures require an explicit, owned waiver)
- **P2/P3 pass rate**: ≥90% (informational)
- **High-risk mitigations (R-001..R-008)**: 100% complete or an approved, expiring waiver

### Coverage Targets

- **Cross-tenant isolation scenarios**: 100% — every tenant-owned table in the schema enrolled in the negative suite (enforced by the H4 inventory gate, not by reviewer diligence)
- **Security scenarios (SEC category)**: 100% pass
- **Server-command envelope paths** (auth/membership/validation/ownership/audit): ≥90%
- **Audit append-only + metadata hygiene**: 100% of the defined assertions

### Non-Negotiable Requirements (epic cannot ship without)

- [ ] All P0 tests pass
- [ ] No high-risk (≥6) item unmitigated/unwaived
- [ ] SEC-category tests pass 100%
- [ ] RLS inventory gate is **live in CI and proven to fail** on an uncovered table (R-008)
- [ ] Service-role containment check is green (R-002)
- [ ] `audit_events` proven append-only through app paths (R-009)

---

## Mitigation Plans

### R-001: Missing/incorrect RLS on foundation tables (Score: 6)

**Mitigation Strategy:** Enable (and force) RLS on `tenants`, `tenant_memberships`, `audit_events`.
Implement a single parameterized cross-tenant negative suite covering SELECT/INSERT/UPDATE/DELETE,
driven by the tenant-table inventory so coverage is data-driven, not copy-paste. Each verb proves
Tenant A cannot read, mutate, or spoof ownership of Tenant B rows.
**Owner:** Dev (Story 2.2). **Timeline:** Story 2.2. **Status:** Planned.
**Verification:** Suite green for all three tables × four verbs; an intentionally weakened policy on
a scratch branch turns a test red.

### R-002: Service-role key / secret leakage to client (Score: 6)

**Mitigation Strategy:** Keep service-role usage server-only and minimal (ADR-A003). Story 2.4
containment check inspects the built browser bundle, public route payloads, and logs for key names,
secret placeholders, and server-only command internals. Carry forward the epic-1 deferred lint-rule
idea (client-path service-role import guard) where feasible.
**Owner:** Dev (Story 2.4). **Timeline:** Story 2.4. **Status:** Planned.
**Verification:** Containment check green on a clean build; planting a service-role reference in a
client path on a scratch branch turns the check red.

### R-003: Anonymous / unauthenticated privileged access (Score: 6)

**Mitigation Strategy:** Envelope rejects unauthenticated callers before any tenant work (§5 step 1).
Anonymous-access negatives across the protected route/command inventory; no public privileged
endpoint, function, cron, or webhook exists in Phase A (§20).
**Owner:** Dev (Stories 2.1-2.3). **Timeline:** through Story 2.3. **Status:** Planned.
**Verification:** Every protected route/command returns redirect/reject for an anonymous caller; no
privileged anon path returns data.

### R-004: Client tenant-ID spoofing (Score: 6)

**Mitigation Strategy:** `resolveTenantContext` is the server authority; client-supplied `tenant_id`
is ignored or verified against resolved membership (§5 step 4). Mismatch and no-membership negatives.
**Owner:** Dev (Stories 2.1/2.3). **Timeline:** Stories 2.1-2.3. **Status:** Planned.
**Verification:** Command with a spoofed/mismatched client `tenant_id` is denied; no tenant data loads
for a user without active membership.

### R-005: Membership self-grant / role escalation (Score: 6)

**Mitigation Strategy:** RLS on `tenant_memberships` forbids a user inserting their own membership or
changing their own role through app paths; role constrained to `tenant_admin` at the DB level.
**Owner:** Dev (Story 2.2). **Timeline:** Story 2.2. **Status:** Planned.
**Verification:** Self-insert and self-role-change attempts are denied; a non-`tenant_admin` role
value is rejected by constraint.

### R-006: SECURITY DEFINER helper without fixed search_path (Score: 6)

**Mitigation Strategy:** `is_active_tenant_member` / `is_tenant_admin` declared with fixed
`search_path` and explicit review; negative test proves a malicious schema/object on the path cannot
change helper behavior.
**Owner:** Dev (Story 2.2). **Timeline:** Story 2.2. **Status:** Planned.
**Verification:** Helper returns correct authorization with an adversarial object on the search path.

### R-007: Test infrastructure not ready for Story 2.4 (Score: 6)

**Mitigation Strategy:** Run TEA `testarch-framework` before Story 2.4; Story 2.2 delivers the local
reset target + factories; explicitly gate Story 2.4's start on a working `pnpm test` and
`supabase db reset`.
**Owner:** SM/Dev. **Timeline:** before Story 2.4. **Status:** Planned (known deferred decision from
Epic 1 — needs an explicit owner).
**Verification:** `pnpm test` runs a real suite and `supabase db reset` succeeds in CI before 2.4 work begins.

### R-008: Incomplete / unwired RLS inventory gate (Score: 6)

**Mitigation Strategy:** Harness compares schema tenant-owned tables against tables enrolled in the
parameterized negative suite and fails CI on any gap (H4). New tenant tables enroll via data, not
copy-paste.
**Owner:** Dev (Story 2.4). **Timeline:** Story 2.4. **Status:** Planned.
**Verification:** Deliberately exclude one tenant-owned table on a scratch branch → CI fails with a
clear "table not covered" error.

---

## Assumptions and Dependencies

### Assumptions

1. Phase A product role is exactly `tenant_admin`; no other role exists to test (epics.md non-scope).
2. Pooled multi-tenancy (one Supabase project, many tenants) per ADR-A002 — RLS, not separate DBs, is the isolation mechanism under test.
3. Automated tests run against **local Supabase only** (CLI stack + reset), never shared dev/staging/prod (architecture §18).
4. Test-user auth is password-based or admin-created (B2); magic-link-only is not used for automated command tests.
5. A real test runner (Vitest or TEA `testarch-framework` choice) replaces the `pnpm test` placeholder within this epic.
6. The two-tenant factory contract (B1) established in Story 2.2 is the substrate every later tenant-owned table reuses.

### Dependencies

1. **Epic 1 merged** — CI gates, `.env.example`, local-setup docs — required before any Epic 2 story.
2. **Test runner initialization** (TEA `testarch-framework`) — required before Story 2.4; recommended within Story 2.2.
3. **Local Supabase stack** (Story 2.2 migrations + `db reset`) — required for all INT/RLS/migration tests; Story 2.1 only partially testable without it.
4. **Story ordering 2.1 → 2.2 → 2.3 → 2.4** — 2.3 depends on 2.1+2.2; 2.4 depends on 2.1-2.3.

### Risks to Plan

- **Risk**: Story 2.4 begins before the runner/local stack exist, forcing stubbed or skipped security tests.
  - **Impact**: A hollow security harness ships and silently fails to protect later epics — the worst outcome for this epic.
  - **Contingency**: Hard-gate 2.4 on green `pnpm test` + `supabase db reset` (R-007); if not ready, run `testarch-framework` as a dedicated pre-2.4 task before 2.4 is picked up.
- **Risk**: Windows/WSL Docker friction with the Supabase CLI stack (epic-1 retro flagged Windows-specific setup pain).
  - **Impact**: Local/CI environment instability delays all INT/RLS tests.
  - **Contingency**: Follow `docs/process/local-setup.md` Docker conventions; verify the Compose setup early in Story 2.2, not at 2.4.

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| **Epic 1 CI pipeline** (`.github/workflows/ci.yml`) | New stages added: migration reset, integration commands, RLS/storage negatives (§19) | All five existing Epic 1 gates must remain green; new gates added, not replacing |
| **`pnpm test` gate** | Placeholder replaced by a real runner | The gate must stay wired and now actually executes suites |
| **`verify:lockfiles` guard** | First regression test lands here (epic-1 retro highest-priority deferred item) | Guard failure path covered by a new unit test |
| **Every future tenant-owned table (Epics 3-9)** | Inherits the RLS pattern + must enroll in the inventory gate | The H4 gate is the standing regression mechanism for all later epics — a future PR adding a tenant table without a negative test must fail CI |

---

## Follow-on Workflows (Manual)

- Run `*atdd` to scaffold failing P0 tests (cross-tenant RLS negatives, anonymous-access, service-role containment) once the runner + local stack exist — this is the natural first move inside Story 2.2/2.4.
- Run `*automate` to broaden coverage after the envelope and tables are implemented.
- Run `*trace` at epic boundary to produce the traceability matrix + gate decision (PASS/CONCERNS/FAIL) against these P0/P1 scenarios.
- Run `*nfr-assess` if/when auth/RLS performance (R-013) is brought into scope.

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager: ______ Date: ______
- [ ] Tech Lead: ______ Date: ______
- [ ] QA Lead: ______ Date: ______

**Comments:**

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — risk classification + gate decision framework
- `probability-impact.md` — 1-9 scoring methodology and DOCUMENT/MONITOR/MITIGATE/BLOCK thresholds
- `test-levels-framework.md` — UNIT/INT/RLS(integration)/E2E selection, duplicate-coverage guard
- `test-priorities-matrix.md` — P0-P3 prioritization and risk-to-priority mapping

### Related Documents

- Epic: `_bmad-output/planning-artifacts/epics.md` (Epic 2, lines 525-684)
- PRD: `_bmad-output/planning-artifacts/prd.md`
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (ADR-A002/A003/A009, §5/§6/§8/§9/§18/§19/§20)
- Prior system-level test design: `_bmad-output/test-artifacts/test-design-progress.md` (blockers B1/B2/B3, recommendations H1/H4/H5)
- NFR assessment: `_bmad-output/test-artifacts/nfr-assessment.md`
- Epic 1 retrospective (Epic 2 prep + deferred carry-forward): `_bmad-output/implementation-artifacts/epic-1-retro-2026-06-21.md`

### Traceability Note

Acceptance-criteria → risk → test-level → priority links are embedded in the coverage tables above
(each row cites its AC source and Risk Link). A formal traceability matrix + gate decision is the
job of the `*trace` workflow at the epic boundary and is intentionally not duplicated here.

---

**Generated by**: BMad TEA Agent — Test Architect Module
**Workflow**: `bmad-testarch-test-design`
**Version**: 4.0 (BMad v6)
