---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
  - 'step-04c-aggregate'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-06-29'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/2-4-security-regression-harness-for-tenant-and-service-role-boundaries.md'
  - '_bmad/tea/config.yaml'
  - 'tests/integration/rls/cross-tenant-isolation.rls.test.ts'
  - 'tests/integration/rls/anon-path-isolation.rls.test.ts'
  - 'tests/integration/rls/migration-reset.int.test.ts'
  - 'scripts/verify/check-service-role-containment.mjs'
  - 'tests/unit/scripts/verify/service-role-containment.test.ts'
  - 'tests/factories/admin-sql.ts'
  - 'tests/factories/audit-events.ts'
  - 'tests/support/test-env.ts'
  - 'tests/e2e/auth/login-and-tenant-context.e2e.spec.ts'
  - 'knowledge: data-factories.md, test-quality.md, test-levels-framework.md, test-priorities-matrix.md'
---

# ATDD Checklist — Epic 2, Story 2.4: Security Regression Harness For Tenant And Service-Role Boundaries

**Date:** 2026-06-29
**Author:** Rasmus
**Primary Test Level:** Backend Integration (DB-backed RLS) + pure Unit (`node --test`). No E2E (backend story; browser-redirect E2E is explicitly deferred to a later E2E task).

---

## Story Summary

Story 2.4 builds the standing security-regression harness that prevents later Phase A stories from silently weakening tenant isolation or leaking the service-role key. It (a) GENERALIZES the existing data-driven cross-tenant + anonymous RLS negatives over ONE shared tenant-table inventory, (b) adds the **H4 RLS table-inventory gate** that fails CI when a tenant-owned table is not enrolled, and (c) adds the **R-002 built-bundle service-role containment check** (the authoritative payload grep over `.next`).

**As an** implementation lead
**I want** automated security regression checks for tenant isolation and privileged boundaries
**So that** later stories cannot silently weaken Phase A security.

---

## Stack & Mode (Steps 1-2)

- **Detected stack:** `backend` — Next.js 16.2.9 app with a DB-backed test harness (Vitest 4.1.9 `pnpm run test:int`; `node --test` `pnpm run test:unit`; bare-Node `scripts/verify/*.mjs`). No `playwright.config.ts` / `cypress.config.ts` — and none is in scope (the browser E2E for the `(app)` redirect is deferred). Prerequisite test config (Vitest + node --test + local Supabase via `supabase db reset`) EXISTS → preflight prerequisites satisfied.
- **Generation mode:** **AI generation** (backend → always AI generation; no browser recording). Tests authored to the project's red-phase convention rather than Playwright `test.skip()`.
- **Red-phase convention (this repo):** new suites that depend on not-yet-built modules are carried as `describe.skip(...)` (Vitest) / `t.skip(...)` (`node --test`) scaffolds with a fenced GATED header, REAL assertions written out (commented for the live/import paths), and a `gated()`/`GATED` guard — mirroring `tests/e2e/auth/login-and-tenant-context.e2e.spec.ts`. They collect green (skipped) until the dev removes the gate in the GREEN phase.

---

## Acceptance Criteria → Test Strategy (Step 3)

| AC | Criterion (condensed) | Level | Priority | Red-phase scaffold |
| --- | --- | --- | --- | --- |
| AC1 | Cross-tenant negatives cover read/insert/update/delete/command-mismatch/anon/service-role for every tenant-owned table, data-driven over ONE inventory | INT (RLS) | P0 | Generalize existing `cross-tenant-isolation.rls.test.ts` onto shared inventory (GREEN-phase refactor — assertions already exist, do not rewrite) |
| AC2 | Built `.next` bundle exposes NO service-role name/JWT value/`NEXT_PUBLIC_*SERVICE_ROLE*`; check FAILS red on a planted token; FAILS loud if `.next` absent | Unit | P0 | **`tests/unit/scripts/verify/bundle-containment.test.ts`** (NEW) |
| AC3 | A future PR adding a tenant-owned table without enrolling it → CI FAILS with a clear "table not covered" naming the table (H4 gate) | INT (DB) | P0 | **`tests/integration/rls/rls-inventory-gate.int.test.ts`** (NEW) |
| AC4 | The gate actually BITES — a deliberately-shrunk enrolled set surfaces the omitted table (pure-fn) + documented scratch-branch run; harness fails on an injected weakened access path | Unit + INT | P0/P1 | **`tests/unit/rls/inventory-gate-core.test.ts`** (NEW, pure) + the BITES case in the INT gate |
| AC5 | Anonymous negatives cover every tenant-owned table SELECT/INSERT/UPDATE/DELETE AND EXECUTE on `is_active_tenant_member`/`is_tenant_admin`/`record_audit_event`, asserted by mechanism (`42501`) | INT (RLS) | P0/P1 | Generalize `anon-path-isolation.rls.test.ts` onto shared inventory; enroll `audit_events` (4 verbs) + add `record_audit_event` to anon-EXECUTE (GREEN-phase) |
| AC6 | Local + CI, NO external service / secrets / global machine change; wired into `ci.yml` without weakening/reordering gates | CI wiring | P0 | GREEN-phase: add `verify:bundle-containment` after `build`; inventory gate rides `db` job `test:int` |

**No-duplicate-coverage note:** AC1/AC5 negatives are NOT rewritten — the existing data-driven suites already assert the `42501` mechanism + independent re-read; Story 2.4 only EXTRACTS their `TABLES` array into the shared inventory and points the gate at it. New RED scaffolds are authored ONLY for the genuinely-new surfaces: the inventory gate (AC3/AC4) and the built-bundle check (AC2).

---

## Failing Tests Created (RED Phase)

### Integration / DB-backed Tests (Vitest — 4 tests, all skipped)

**File:** `tests/integration/rls/rls-inventory-gate.int.test.ts` (NEW)

- **Test:** live-schema tenant-owned set is EXACTLY `{tenants, tenant_memberships, audit_events}`
  - **Status:** RED — `describe.skip`, `gated()` throws; needs `tenant-table-inventory.ts#introspectTenantOwnedTables`.
  - **Verifies:** AC3 — the gate's `public`-qualified introspection, including the literal `tenants` (no `tenant_id` column) and excluding `_realtime.tenants`.
- **Test:** every live tenant-owned table is ENROLLED (set difference empty) — the H4 gate proper
  - **Status:** RED — needs `findUnenrolledTenantTables` + `TENANT_TABLES`.
  - **Verifies:** AC3 — CI fails when a tenant-owned table is unenrolled.
- **Test:** the gate BITES — a shrunk enrolled set surfaces the omitted table by name
  - **Status:** RED — needs the pure comparison.
  - **Verifies:** AC4 — the gate is not inert/vacuous, without a scratch branch.
- **Test:** the unenrolled-table failure message names the table AND points at the inventory module
  - **Status:** RED — needs the gate's message shape.
  - **Verifies:** AC3/AC4 (P3 DX) — actionable failure output.

### Unit Tests (`node --test` — 10 tests, all skipped)

**File:** `tests/unit/rls/inventory-gate-core.test.ts` (NEW — 4 tests)

- **BITES: shrunk enrolled set surfaces the omitted table** — RED (`GATED`) — AC4 bite proof (pure, no DB).
- **GREEN: fully-enrolled set → ZERO unenrolled** — RED — the gate's happy path.
- **A new schema table absent from enrollment is reported** — RED — the Epics 3-9 standing regression.
- **Over-enrollment is NOT reported as unenrolled** — RED — guards the `owned ⊆ enrolled` direction only.

**File:** `tests/unit/scripts/verify/bundle-containment.test.ts` (NEW — 6 tests)

- **GREEN: clean built bundle → ZERO violations** — RED (`GATED`) — AC2 clean tree.
- **RED: service-role key NAME planted in a chunk is flagged** — AC2.
- **RED: `LOCAL_SUPABASE_SERVICE_ROLE_KEY` re-export symbol flagged** — AC2 + closes 2-2 Round-2 LOW (symbol the source guard misses).
- **RED: `NEXT_PUBLIC_*SERVICE_ROLE*` name flagged** — AC2.
- **RED: literal local-demo service-role JWT VALUE flagged (symbol-independent)** — AC2 — why the bundle grep is authoritative over the source guard.
- **FAILS LOUD: scanning a root with no `.next` throws** — AC2 — never false-greens an empty scan.

### E2E Tests

None — backend story. The `(app)` layout anonymous-redirect E2E is deferred to a later E2E enablement task (DB/privileged-function surface is covered by the harness; route-redirect rides the gated E2E).

---

## Data Factories / Fixtures (reuse — additive only, B1)

No NEW factories. The GREEN phase reuses existing, loopback-gated TEST-ONLY helpers:

- `tests/factories/admin-sql.ts` — `adminQuery` for the gate's live-schema introspection (mirrors `migration-reset.int.test.ts`).
- `tests/factories/tenants.ts` / `tests/factories/audit-events.ts` — two-tenant fixtures + audit seed for the generalized negatives.
- `tests/support/test-env.ts` — `isLocalStackReachable()` / `assertLocalStack()` / `STACK_REQUIRED` + the `LOCAL_SUPABASE_SERVICE_ROLE_KEY` re-export symbol the bundle grep must catch.

The bundle-containment unit builds its own throwaway `.next`-shaped temp tree (`mkdtempSync`) — no fixture needed.

---

## Mock Requirements

None. DB-backed tests run against the LOCAL Supabase stack after `supabase db reset` (no network mocks; CI sets `SUPABASE_TEST_REQUIRED=1` so a missing stack is a HARD failure). The bundle check is pure filesystem over a temp tree.

---

## Implementation Checklist (RED → GREEN)

### AC3/AC4 — H4 inventory gate

- [ ] Create `tests/integration/rls/tenant-table-inventory.ts` — extract `TENANT_TABLES` + `spoofedRowFor`/`tenantBFilter`/mutation metadata from `cross-tenant-isolation.rls.test.ts`; add `introspectTenantOwnedTables(adminQuery)` (public-qualified; union tenant_id-carriers with literal `tenants`); add PURE `findUnenrolledTenantTables(owned, enrolled)`.
- [ ] Point `rls-inventory-gate.int.test.ts` at the module, remove `describe.skip` + `gated()`; assert set-difference is `[]` with a table-naming message.
- [ ] Point `inventory-gate-core.test.ts` at `findUnenrolledTenantTables`, flip `GATED=false`.
- [ ] Document the scratch-branch verification (omit a real table → CI red) in the Dev Agent Record.
- [ ] Run `pnpm run test:int` + `pnpm run test:unit` → GREEN.

### AC2 — built-bundle containment

- [ ] Create `scripts/verify/check-bundle-containment.mjs` — bare-Node `scanBuiltBundle(root)` (CLI + importable), scans `.next/`; catches service-role NAMES (incl. `LOCAL_SUPABASE_SERVICE_ROLE_KEY`), local-demo JWT VALUE, `NEXT_PUBLIC_*SERVICE_ROLE*`, secret placeholders, server-only command internals; FAILS LOUD if `.next` absent.
- [ ] Add `verify:bundle-containment` npm script (bare-Node, no `&&` chaining — Windows PATH).
- [ ] Point `bundle-containment.test.ts` at `scanBuiltBundle`, flip `GATED=false` → GREEN (clean) / RED-on-planted.
- [ ] Broaden `check-service-role-containment.mjs` (Task 2.2): catch the re-export symbol from a `"use client"` path; confirm `app/**`/`middleware.ts`/`next.config.*` roots.

### AC1/AC5 — generalized negatives (refactor, do NOT rewrite assertions)

- [ ] Point `cross-tenant-isolation.rls.test.ts` + `anon-path-isolation.rls.test.ts` at `TENANT_TABLES`.
- [ ] Enroll `audit_events` in the anon suite (SELECT/INSERT/UPDATE/DELETE) + add `record_audit_event` to the anon-EXECUTE list (assert `error.code === "42501"`, not `data === false`).

### AC6 — CI wiring

- [ ] Add `verify:bundle-containment` to the `verify` job AFTER `pnpm build`; confirm `rls-inventory-gate.int.test.ts` is picked up by Vitest's glob in the `db` job. No gate weakened/reordered.
- [ ] Document the standing PR contract (new tenant table ⇒ enroll or CI red) in `docs/quality/quality-gates.md` (cite architecture §9/§18/§19, NOT plan numbers).

### Pre-existing (verify, do not duplicate)

- [ ] Confirm `tests/unit/scripts/verify/check-lockfiles.test.ts` exists and is green (landed in 2.2) — author only if genuinely missing.

---

## Running Tests

```bash
# Pure units (incl. the new inventory-core + bundle-containment scaffolds)
pnpm run test:unit

# DB-backed INT/RLS (incl. the new inventory gate) — needs local Supabase
supabase start && supabase db reset && pnpm run test:int

# Just the new INT scaffold
npx vitest run tests/integration/rls/rls-inventory-gate.int.test.ts

# The new built-bundle CLI (GREEN phase, after `pnpm build`)
pnpm run verify:bundle-containment
```

---

## Test Execution Evidence — RED Phase Verification

- `pnpm run test:unit` → **127 tests, 117 pass, 0 fail, 10 skipped** (the 10 skips = 4 inventory-core + 6 bundle-containment scaffolds). ✅
- `npx vitest run tests/integration/rls/rls-inventory-gate.int.test.ts` → **1 file skipped, 4 tests skipped**. ✅
- `pnpm typecheck` (`tsc --noEmit`) → clean. ✅
- `eslint` on all three new files → 0 errors, 0 warnings. ✅

**Status:** ✅ RED phase verified — scaffolds collect green-by-skip, assert EXPECTED behavior (no placeholder `expect(true)`), and fail with explicit `gated()`/`GATED` reasons once enabled, due to missing implementation (the inventory module + bundle-containment script), not test bugs.

---

## Notes / Assumptions / Risks

- **Convention deviation from the generic ATDD orchestrator (intentional):** the skill's step-04 assumes a Playwright API+E2E `test.skip()` split. This is a backend security-harness story with NO browser surface, so the scaffolds use the repo's established `describe.skip`/`t.skip` + fenced-GATED-header convention (per `login-and-tenant-context.e2e.spec.ts`) under Vitest / `node --test`. Same red-phase guarantee, project-native runner.
- **Do NOT rewrite the passing AC1/AC5 negative assertions** — Story 2.4 GENERALIZES them onto one shared inventory; the `42501`-mechanism + independent-re-read discipline already exists and is load-bearing. New RED scaffolds cover only the genuinely-new gate + bundle surfaces.
- **`tenants` is the load-bearing edge case** for "tenant-owned": no `tenant_id` column but IS tenant-owned/enrolled. The gate must union tenant_id-carriers with the literal `tenants` and schema-qualify to `public`.
- **Out of scope (do not pull forward):** any new migration/schema/policy change; tightening `*_select_own` to `auth.uid()` (RBAC seam, accepted Phase A); the `tests/e2e/**` Playwright runner + `(app)` redirect E2E; the other deferred 2-3 test-DX Lows.
- **No new dependency** (gate = existing `pg` admin pool; bundle check = bare-Node). Any dep would be approval-gated + exact-pinned.

---

## Next Steps

1. Hand off these RED scaffolds + checklist to `dev-story` for Story 2.4 GREEN-phase implementation.
2. Build `tenant-table-inventory.ts` + `check-bundle-containment.mjs` first (they unblock every scaffold), then remove the `.skip`/`GATED` guards one test at a time.
3. Run the full active CI gate sequence in order (Task 5.1) and record the scratch-branch bite verification in the Dev Agent Record.

---

**Generated by BMad TEA Agent** — 2026-06-29
