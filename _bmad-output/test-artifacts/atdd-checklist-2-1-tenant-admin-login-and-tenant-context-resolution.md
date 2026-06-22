---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-06-21'
workflowType: testarch-atdd
storyId: 2-1-tenant-admin-login-and-tenant-context-resolution
tddPhase: RED
inputDocuments:
  - _bmad-output/implementation-artifacts/2-1-tenant-admin-login-and-tenant-context-resolution.md
  - _bmad-output/test-artifacts/test-design-epic-2.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad/tea/config.yaml
  - package.json
  - src/app/(app)/layout.tsx
  - src/components/app-shell/AppShell.tsx
  - scripts/verify/check-lockfiles.mjs
---

# ATDD Checklist: Story 2.1 — Tenant Admin Login And Tenant Context Resolution

**Role:** Master Test Architect · **Mode:** Create · **TDD Phase:** RED (failing scaffolds before implementation)
**Generated:** 2026-06-21

---

## Step 1 — Preflight & Context

**Stack detection (`test_stack_type: auto`):** `package.json` carries Next 16 / React 19 →
**frontend** stack. (Server-action/pure-logic resolver logic is also in scope — exercised as
unit tests with a mocked Supabase client.)

**Prerequisite reality (the gating fact for this whole scaffold):**

- The hard prerequisite "test framework configured" (`playwright.config.ts` / `cypress.config.ts`,
  or a real `pnpm test`) is **NOT met by design**. `package.json` `test` is an honest placeholder;
  the runner is the TEA `testarch-framework` decision that lands in **Epic 2** (Story 2.2 or a
  dedicated pre-2.4 task), and the local Supabase stack + two-tenant factories land in **Story 2.2**.
- Per the orchestrating instruction (and `test-design-epic-2.md` "Critical Prerequisite"), the
  workflow does **not** HALT and does **not** invent a runner/framework. It produces the red-phase
  scaffolds appropriate to THIS state and clearly marks the ones gated on Story 2.2.

**Inputs loaded:** story file, `test-design-epic-2.md` (P0/P1 scenarios + risks R-002/R-003/R-004),
`architecture.md` §5 (command steps 1-4, error codes), `tea/config.yaml`, existing
`src/app/(app)/layout.tsx`, `AppShell.tsx` top-bar region (empty `data-slot="primary-action"`),
`scripts/verify/check-lockfiles.mjs` (guard pattern to mirror for Task 5).

**Knowledge fragments (conceptual, applied):** data-factories, component-tdd, test-quality,
test-healing-patterns, selector-resilience, test-levels-framework, test-priorities-matrix. (The
TEA Playwright-utils fragments are not materially applicable while no Playwright runner exists.)

---

## Step 2 — Generation Mode

**Mode: AI generation** (clear ACs; standard auth / context-resolution / navigation scenarios).
Recording mode **skipped** — there is no running app or live UI to record against (the `/login`
page, the auth boundary, and the top-bar context region do not exist yet; they are what Story 2.1
implements). E2E scenarios are authored as AI-generated Playwright-shaped specs, gated.

---

## Step 3 — Test Strategy (AC → level → priority)

Test-level discipline (no duplicate coverage): branch logic at **unit** (mocked Supabase);
DB-enforced isolation/RLS + real-session boundaries at **integration** (gated on 2.2); user
journeys at **E2E** (gated on framework + 2.2).

| AC | Scenario | Level | Priority | Risk | Status here |
| --- | --- | --- | --- | --- | --- |
| AC1 | Active `tenant_admin` membership → membership-derived tenant context | Unit | P1 | R-004 | **Scaffolded (unit)** |
| AC1 | Active membership resolves correct tenant server-side (real session/DB) | Integration | P1 | R-004 | Gated → 2.2 |
| AC1 | Active tenant/company context displayed in top bar + current user | E2E | P1 | R-004 | Gated → framework + 2.2 |
| AC2 | No membership row → `TENANT_MEMBERSHIP_REQUIRED`, no tenant data | Unit + Int | P0 | R-004 | **Scaffolded (unit)** + gated int |
| AC2 | `disabled` membership → no-access (distinct from no-row) | Unit + Int | P1 | R-004 | **Scaffolded (unit)** + gated int |
| AC2 | `invited` membership → no-access | Unit | P1 | R-004 | **Scaffolded (unit)** |
| AC2 | Non-`tenant_admin` role → rejected even if active | Unit | P0/P1 | R-005 | **Scaffolded (unit)** |
| AC2 | No-access UI state, zero tenant data, generic message (no leakage) | E2E | P0 | R-004 | Gated → framework + 2.2 |
| AC3 | No/invalid user (`getUser`/`getClaims`, never `getSession`) → `UNAUTHENTICATED` | Unit | P0 | R-003 | **Scaffolded (unit)** |
| AC3 | Anonymous → protected route redirect / command reject | Int + E2E | P0 | R-003 | Gated → framework + 2.2 |
| AC4 | Client-supplied `tenant_id` mismatch never widens access (ignore-or-verify) | Unit | P0 | R-004 | **Scaffolded (unit)** |
| AC4 | Matching client `tenant_id` accepted, still membership-derived | Unit | P0 | R-004 | **Scaffolded (unit)** |
| AC4 | Spoofed/mismatched `tenant_id` denied at the real DB boundary (no Tenant B read) | Integration | P0 | R-004 | Gated → 2.2 |
| Task5 | Service-role containment guard goes RED on `NEXT_PUBLIC_`/client-path leak, GREEN when clean | Unit | P0 | R-002 | **Scaffolded (unit)** |

**Red-phase requirement confirmed:** every scenario asserts EXPECTED behavior and is designed to
fail before the Story 2.1 implementation exists.

---

## Step 4 / 4C — Generated Scaffolds (RED PHASE)

Execution note: the skill's parallel API/E2E subagent dispatch presumes a configured runner with a
live app; with no runner and no app yet, scaffolds were generated **sequentially and directly** to
honor the red-phase contract (`describe.skip`, expected-behavior assertions, no placeholder
`expect(true).toBe(true)`) without standing up a framework. This is the documented "sequential"
resolution path, adapted to a pre-runner project.

### Files created

| File | Level | Suite state | Gating |
| --- | --- | --- | --- |
| `tests/unit/server/auth/resolve-tenant-context.test.ts` | Unit (mocked Supabase) | `describe.skip` | Runner only (testarch-framework). Runnable once runner + resolver exist. |
| `tests/unit/scripts/verify/service-role-containment.test.ts` | Unit (R-002 guard proof) | `describe.skip` | Runner + Task 5 guard implementation. |
| `tests/integration/server/auth/resolve-tenant-context.int.test.ts` | Integration (DB-backed) | `describe.skip` | **Story 2.2** local Supabase stack + two-tenant factories + runner. Authoritative; owned/enrolled in 2.2. |
| `tests/e2e/auth/login-and-tenant-context.e2e.spec.ts` | E2E (browser) | `describe.skip` | **Playwright (framework step) + Story 2.2** seeded users. |
| `tests/README.md` | docs | — | Explains runner-absence, layout, red-phase convention. |

**TDD red-phase compliance check (Step 4C validation):**

- [x] All suites use `.skip` — cannot fail CI before dependencies exist.
- [x] All assertions encode expected behavior — no `expect(true).toBe(true)` placeholders.
- [x] All scaffolds are expected-to-fail (the resolver, guard, login page, auth boundary, and
      top-bar context region do not exist yet).
- [x] Gated DB/E2E files are clearly marked and kept skipped (not stubbed into a hollow green).

**Fixtures:** intentionally NOT created here. The authoritative fixtures are the two-tenant
factories owned by **Story 2.2** (blocker B1); fabricating a parallel fixture now would create
drift. The unit scaffolds use inline fakes only.

---

## Acceptance Criteria Coverage Summary

- **AC1** (authenticated `tenant_admin` → server-resolved tenant context + UI display): unit
  branch covered now; authoritative server-side + UI display gated on 2.2/framework.
- **AC2** (no active membership → denied, no tenant data; `disabled`/`invited` distinct): unit
  branches covered now (no-row, disabled, invited, wrong-role); DB-backed + UI gated on 2.2.
- **AC3** (anonymous → redirect/reject; `getUser`/`getClaims` not `getSession`): unit covered now;
  route/command boundary gated on 2.2/framework.
- **AC4** (client `tenant_id` never widens access): unit covered now (ignore-or-verify, match path);
  real cross-tenant DB negative gated on 2.2.
- **Task 5 / R-002** service-role containment guard proof: unit scaffold covers red/green bite.

---

## Step 5 — Validation & Completion

**Validation checklist:**

- [x] Prerequisites assessed; framework-absence handled per instruction (no HALT, no invented runner).
- [x] Test files created in the architecture-aligned tree (`tests/unit|integration|e2e`, mirroring
      `src/server/auth`), not scattered in UI modules (architecture §22).
- [x] Checklist maps every AC (and Task 5) to a level + priority + risk + current status.
- [x] All tests designed to fail before implementation (red phase) and kept `.skip`.
- [x] No CLI/browser sessions opened (no runner); no orphaned browsers.
- [x] Checklist stored under `{test_artifacts}/` (this file); scaffolds under `tests/`.
- [x] No dependency added, no framework configured, no `.env` touched, no app/product code modified.

**Key assumptions / risks:**

- Vitest-style API assumed for unit/integration and Playwright for E2E (the documented likely
  choices). If `testarch-framework` selects otherwise, these files are the spec to port — the
  assertions are the contract.
- The authoritative DB-backed AC tests are **deferred to Story 2.2 by design** (not a gap): Story
  2.1 cannot prove DB-level isolation without 2.2's stack. Recorded for the Task 6.2 hand-off.
- Selector resilience: E2E targets `data-testid` anchors the implementer must add to the top-bar
  region (Task 4) and `/login` (Task 3) — flagged in the E2E scaffold so green-phase wiring is clean.

## Next Steps (TDD Green Phase)

1. **Runner:** land the TEA `testarch-framework` decision (Epic 2) — wire `pnpm test` to a real
   runner. Do NOT do this as a side effect of these scaffolds; it is a separate gated step.
2. **Story 2.1 implementation:** build `resolveTenantContext`, the `(auth)/login` page, the `(app)`
   auth boundary, the top-bar context region (Task 4), and the service-role guard (Task 5). Then
   remove `.skip` from the two **unit** scaffolds, wire the real imports, and make them GREEN.
3. **Story 2.2 hand-off:** the `integration/` and `e2e/` scaffolds enroll into Story 2.2's stack
   (factories + local Supabase + Playwright). Remove their `.skip` there, make GREEN, and record in
   the 2.2 Dev Agent Record that the 2.1-AC DB/UI scenarios are now covered.
4. **Recommended follow-on workflows:** `*automate` to broaden coverage after the envelope/tables
   land; `*trace` at the Epic 2 boundary for the traceability matrix + gate decision.

---

**Generated by:** BMad TEA Agent — `bmad-testarch-atdd` (Create mode) · TDD RED PHASE
