---
stepsCompleted:
  - 'step-01-load-context'
  - 'step-02-discover-tests'
  - 'step-03-map-criteria'
  - 'step-04-analyze-gaps'
  - 'step-05-gate-decision'
lastStep: 'step-05-gate-decision'
lastSaved: '2026-06-21'
workflowType: 'testarch-trace'
scope: 'epic-1'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md (Epic 1)'
  - '_bmad-output/implementation-artifacts/1-1-choose-package-manager-and-initialize-app-baseline.md'
  - '_bmad-output/implementation-artifacts/1-2-establish-ci-and-quality-gate-baseline.md'
  - '_bmad-output/implementation-artifacts/1-3-build-phase-a-app-shell-and-deferred-scope-navigation-guardrails.md'
  - '_bmad-output/implementation-artifacts/1-4-document-local-setup-environment-contract-and-repo-hygiene.md'
---

# Traceability Matrix & Gate Decision — Epic 1: Platform Foundation And Scope Guardrails

**Epic:** Epic 1 — Platform Foundation And Scope Guardrails
**Date:** 2026-06-21
**Evaluator:** TEA Agent (Master Test Architect)
**Gate Type:** epic
**Decision Mode:** deterministic

---

> **Coverage philosophy for an infrastructure epic.** Epic 1 is foundational/infra: it
> ships toolchain, CI quality gates, an app shell, and documentation — not domain logic.
> Its verification is intentionally via the CI quality gates (typecheck / lint / unit-test
> placeholder / build), config/schema-parse checks, repo-hygiene/secret checks, and
> documentation review, NOT via a unit-test suite (no test harness exists yet by design —
> it is owned by TEA `testarch-framework`, landing in Epic 2). Per this epic's own
> "Test Requirements" sections, a green CI gate, a build/parse check, a repo check, or a
> documented manual responsive/a11y verification IS valid covering evidence. Coverage is
> judged on that basis.

---

## PHASE 1: REQUIREMENTS TRACEABILITY

### Coverage Summary

| Priority  | Total Criteria | FULL Coverage | Coverage % | Status   |
| --------- | -------------- | ------------- | ---------- | -------- |
| P0        | 6              | 6             | 100%       | ✅ PASS  |
| P1        | 4              | 4             | 100%       | ✅ PASS  |
| P2        | 1              | 1             | 100%       | ✅ PASS  |
| P3        | 0              | 0             | 100%       | ✅ PASS  |
| **Total** | **11**         | **11**        | **100%**   | **✅ PASS** |

**Legend:** ✅ PASS — meets gate threshold · ⚠️ WARN — below target, not critical · ❌ FAIL — below minimum (blocker)

**Story status note:** Stories 1.1, 1.2, 1.3 are `done`; Story 1.4 is `review` (dev-story
complete, gates green, in code review — not yet `done`). All ACs across all four stories
carry accepted covering evidence (see below). One tracked residual exists (automated app-shell
component-test backfill, deferred to Epic 2) — it does not leave any AC uncovered.

---

### Detailed Mapping

#### 1.1-AC1: Single package manager (pnpm) + TS/ESLint/App Router/Tailwind/`@/*` configured per architecture (P0)

- **Coverage:** FULL ✅
- **Verification evidence:**
  - CI gate `verify:lockfiles` (`scripts/verify/check-lockfiles.mjs`) — asserts only `pnpm-lock.yaml` is present and valid (non-empty, has `lockfileVersion`). Passes locally and in CI (`.github/workflows/ci.yml:54-55`).
  - `package.json` declares `packageManager: pnpm@10.24.0` + `engines.node >=20.9.0`; pinned exact dependency versions (no `^`/`~`).
  - Config parse/build evidence: `pnpm typecheck` (tsc, exit 0), `pnpm lint` (eslint flat config, exit 0), `pnpm build` (Next 16 App Router, exit 0) — proves `tsconfig.json` (`@/*` → `src/*`), `eslint.config.mjs`, `next.config.ts`, `postcss.config.mjs`, Tailwind v4 CSS-config all parse and are internally consistent with the architecture target tree.
- **Heuristics:** No API endpoints / auth / error paths in scope. N/A.
- **Gaps:** None.

#### 1.1-AC2: Reproducible install/typecheck/lint/build commands available; no foreign lockfile/PM metadata committed (P0)

- **Coverage:** FULL ✅
- **Verification evidence:**
  - Reproducibility proven: `rm node_modules && pnpm install --frozen-lockfile` (exit 0) recorded in Dev Agent Record (Story 1.1, Debug Log).
  - Documented gate sequence runs green in CI order; the same five gates wired into CI by Story 1.2.
  - `verify:lockfiles` repo check fails on any non-pnpm lockfile (`package-lock.json`, `yarn.lock`, `bun.lockb`, `bun.lock`, `deno.lock`, `npm-shrinkwrap.json`) — this IS the "repository check that fails on extra lockfiles" required by the AC's Test Requirements.
- **Gaps:** None.

#### 1.1-AC3: No deferred-module route/placeholder/nav/schema/job/integration stub added at init (P0 — scope guardrail, AR27)

- **Coverage:** FULL ✅
- **Verification evidence:**
  - Scope guardrail sweep (Story 1.1 Task 5, re-verified in Round-1 review): `src/app/` held only scaffold default; zero references to deferred modules (Fortnox, supplier, AI, HR, rentals, assets, DoU, tender, RBAC, portal); zero service-role env names in client/app code; `.gitignore` covers `.env*`/`node_modules/`/`.next/`.
  - Adversarial code review (Round 1, 2026-06-14) independently re-ran the sweep — confirmed no deferred-module references.
- **Gaps:** None.

#### 1.2-AC1: CI runs install/typecheck/lint/unit-test/build via pnpm; PR template captures phase/story-or-ADR/checks/security-RLS/data-migration/deferred-scope (P0 — DoD enforcement)

- **Coverage:** FULL ✅
- **Verification evidence:**
  - `.github/workflows/ci.yml`: single `verify` job, ordered steps `checkout → pnpm/action-setup → setup-node(.nvmrc, cache pnpm) → install --frozen-lockfile → verify:lockfiles → typecheck → lint → test → build`. Five active Phase A gates wired (verified by file inspection + the workflow executing on the PR branch — the authoritative syntax validation per the AC's Test Requirements).
  - `pnpm test` honest placeholder (exits 0, self-documenting) keeps the unit-test gate wired without front-running the test-framework decision (owner-flagged; accepted).
  - PR template (`.github/pull_request_template.md`) verified (not recreated) to contain all six AC1 fields: Phase/Scope, Linked Work (story/ADR), Tests/Checks Run, Security/RLS Impact, Data Migration Impact, Deferred-Scope Confirmation.
- **Gaps:** None. (Residual: unit-test gate is a placeholder — by design; real suites land Epic 2+. Not an AC gap.)

#### 1.2-AC2: Deferred CI gates (migration reset/integration/RLS/storage/golden-master) documented as required-once-introduced; skipped-gate convention for docs/config-only (P1)

- **Coverage:** FULL ✅
- **Verification evidence:**
  - `docs/quality/ci.md`: active-gates table (gate → command); deferred-gates table mapping each future gate to its activating story (migration reset → 2.2; integration → 2.3; RLS negative → 2.2/2.4; storage negative → 8.1; golden-master → 4.4/5.5/9.3; secret scan → external beta); test-environment ground rules (local Supabase only; `seed.sql` minimal baseline; test-only factories from Story 2.2); docs/config-only skipped-gate convention.
  - One-line pointer added from `docs/quality/quality-gates.md` Gate 2 → `ci.md`.
- **Gaps:** None.

#### 1.3-AC1: Sidebar contains only the 7 in-scope modules; no deferred-module placeholder anywhere in the shell (P0 — scope guardrail)

- **Coverage:** FULL ✅
- **Verification evidence:**
  - Single nav source of truth `src/components/app-shell/nav-items.ts` lists exactly the 7 in-scope items (Dashboard, Kunder, Kalkyler, Offerter, Jobb/Order, Filer, Inställningar); Pilotstöd/Migrering intentionally omitted with a code comment (no approved migration story).
  - Documented in-browser DOM scan (Story 1.3 Task 6.2) found zero deferred-module terms across all routes; 7 empty route containers each name only their owning in-scope epic.
  - Adversarial code review (Round 1, 2026-06-16) Acceptance Auditor confirmed AC1; scope-guardrail sweep confirmed no deferred nav item/route/placeholder/stub and no new dependency.
- **Gaps:** None.

#### 1.3-AC2: Responsive nav collapses to icon rail (md) / drawer (sm); page title + primary-action slot stay reachable without clipping/overlap (P1)

- **Coverage:** FULL ✅ (manual-verification evidence; automated regression test deferred)
- **Verification evidence:**
  - Documented manual responsive verification at desktop (≥1024px), medium (~768px), small (375px) recorded in Dev Agent Record (Story 1.3 Task 6.2): full sidebar → 64px icon rail → hamburger drawer; title + action slot reachable; no horizontal overflow / clipping.
  - `pnpm build` gate green (all routes incl. `(app)` route group + `usePathname` client boundary prerender).
  - Code review Round 1 caught and FIXED a MEDIUM "drawer-open-across-resize state leak" defect against this AC.
- **Gaps:** No automated component/responsive regression test (test harness not yet initialized). The story's own Test Requirements explicitly permit "manual or automated responsive checks," so manual verification is accepted covering evidence. **Residual** (not an AC gap): automated app-shell component tests are deferred to Epic 2, tracked in `_bmad-output/implementation-artifacts/deferred-work.md`.

#### 1.3-AC3: Icon-only controls have an accessible name AND a visible tooltip/equivalent on focus or hover (P1)

- **Coverage:** FULL ✅ (manual-verification evidence; automated regression test deferred)
- **Verification evidence:**
  - Icon-rail links carry `aria-label` (accessible name) + CSS-driven tooltip revealed on hover and `focus-visible`; hamburger toggle has `aria-label`/`aria-expanded`/`aria-controls`. Documented in-browser verification (Story 1.3 Task 6.2).
  - **Defect actively validated:** Round-1 code review caught a HIGH defect — the icon-rail tooltip was clipped by the scroll container at `md`, so "visible tooltip" failed in paint (the dev's first check measured `opacity`, a false-green). This was fixed and re-verified in-browser. AC3 thus has had its key failure mode found and closed.
  - Supporting a11y fixes applied in review: `role="tooltip"` orphan removed + `aria-hidden`; `lang="sv"` set; drawer focus-trap hardened; skip-link CSS `:focus` fallback added.
- **Gaps:** Same residual as 1.3-AC2 — no automated a11y regression test yet (deferred to Epic 2, tracked in deferred-work.md). Not an AC gap given the spec's manual-check allowance.

#### 1.4-AC1: README/setup docs make install/dev/typecheck/lint/test/build + future Supabase-local commands discoverable; Win/WSL/Docker conventions followed (P1)

- **Coverage:** FULL ✅
- **Verification evidence:**
  - Lightweight docs review (Story 1.4 Task 5.1): every command named in README/`docs/process/local-setup.md` exists in `package.json`; Supabase-local commands labeled "forthcoming/Epic 2"; gate sequence presented in CI order.
  - `docs/process/local-setup.md` states the Windows/WSL/Docker conventions verbatim-in-spirit (no global Docker/WSL/daemon changes; project-local Compose only; no fixed `container_name`; no DB bind mounts to Windows paths; configurable ports; `.env` out of git).
  - Code review Rounds 1–2 corrected doc accuracy (frozen-lockfile vs day-to-day install; "commands" vs "scripts"; PowerShell `Copy-Item` alongside `cp`).
- **Gaps:** None.

#### 1.4-AC2: `.env.example` placeholder-only with documented variable names; `.env` gitignored (P0 — secret hygiene, NFR18)

- **Coverage:** FULL ✅
- **Verification evidence:**
  - Repo secret/scope check (Story 1.4 Task 5.2): `git check-ignore .env` → ignored; `.env.*` ignored; `!.env.example` whitelisted (`.gitignore:10-12`, re-verified by this trace run). `git status` surfaces no `.env`/`.env.local`.
  - `.env.example` contains placeholder-only values (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, server-only `SUPABASE_SERVICE_ROLE_KEY` with a never-client-paths warning). Grep for key-/JWT-/real-URL-shaped strings → no matches (zero secrets).
- **Gaps:** None. (Deferred-Low residual: env-contract rules are prose-only with no lint/CI enforcement yet — enforcement owned by Epic 2 when env consumption lands. Not an AC gap.)

#### 1.4-AC3: Docs state Lovable is a behavioral oracle only; code not copied by default (P2)

- **Coverage:** FULL ✅
- **Verification evidence:**
  - README one-liner + `docs/process/local-setup.md` Lovable-oracle section state oracle-only / no-copy-by-default, linking canonical sources (`AGENTS.md`, `project-context.md`, `agent-workflow.md`). Old-app fallback / no-fixtures / no-migration-assets (Epic 9) posture documented.
- **Gaps:** None.

---

### Gap Analysis

#### Critical Gaps (BLOCKER) ❌

**0 gaps.** No uncovered P0 acceptance criterion. Release not blocked on coverage.

#### High Priority Gaps (PR BLOCKER) ⚠️

**0 gaps.** No uncovered P1 acceptance criterion.

#### Medium / Low Priority Gaps ⚠️ / ℹ️

**0 uncovered criteria.** All P2 criteria covered.

#### Tracked Residuals (do NOT leave any AC uncovered — recorded for follow-up)

1. **Automated app-shell component/a11y regression tests** (covers 1.3-AC2 + 1.3-AC3 with automation rather than the current accepted manual verification). Deferred to Epic 2 when the TEA test harness lands. Tracked in `_bmad-output/implementation-artifacts/deferred-work.md`. Severity: LOW (manual verification + build gate + review-caught/fixed defects provide present-day assurance).
2. **Env-contract enforcement** (lint/CI guard against `NEXT_PUBLIC_`-prefixed service-role / client-side service-role import). Prose-only today; enforcement owned by the Epic 2 auth/tenant-context story. Severity: LOW (no code reads these vars until Epic 2).
3. **Non-hermetic `next/font/google` fetch in the `build` gate.** Pre-existing scaffold trait; documented and accepted as "expected to pass on networked CI." Tracked in deferred-work.md. Severity: LOW.

---

### Coverage Heuristics Findings

- **Endpoint coverage gaps:** N/A — Epic 1 introduces no API endpoints (Supabase/server commands land Epic 2+). 0 gaps.
- **Auth/authz negative-path gaps:** N/A — the app shell explicitly creates **no** authorization boundary (presentation only; auth/RLS are Epic 2). No auth/authz AC exists in Epic 1. 0 gaps.
- **Happy-path-only criteria:** The infra ACs are configuration/guardrail assertions whose "negative path" is itself encoded as a failing gate (e.g. `verify:lockfiles` fails on a foreign lockfile; the scope-guardrail sweep fails on a deferred-module reference; `git check-ignore` proves `.env` exclusion). Error-path coverage is therefore present-by-construction for the guardrail ACs. 0 happy-path-only gaps of concern.

---

### Coverage by Verification Level (infra-adapted)

| Verification Level                       | Mechanisms                                                                 | Criteria Covered |
| ---------------------------------------- | ------------------------------------------------------------------------- | ---------------- |
| CI quality gate (typecheck/lint/build)   | `pnpm typecheck`, `pnpm lint`, `pnpm build`                                | 1.1-AC1/AC2, 1.3-AC2, 1.4-AC1 |
| Repo/config check                        | `verify:lockfiles`, scope-guardrail sweep, `git check-ignore .env`, secret grep | 1.1-AC2/AC3, 1.2-AC1 (PR template), 1.4-AC2 |
| CI workflow parse/execution              | `.github/workflows/ci.yml` runs on PR; ordered-gate inspection            | 1.2-AC1          |
| Documentation review                     | `ci.md`, README, `local-setup.md`, deferred-gate mapping                  | 1.2-AC2, 1.4-AC1/AC3 |
| Documented manual responsive/a11y verify | In-browser checks at 3 widths + keyboard (Dev Agent Record)               | 1.3-AC1/AC2/AC3  |
| Unit/Component/E2E automated suite        | None yet — harness owned by TEA `testarch-framework` (Epic 2)             | 0 (by design)    |

---

## PHASE 2: QUALITY GATE DECISION

**Gate Type:** epic
**Decision Mode:** deterministic

### Decision Criteria Evaluation

#### P0 Criteria (Must ALL Pass)

| Criterion             | Threshold | Actual | Status   |
| --------------------- | --------- | ------ | -------- |
| P0 Coverage           | 100%      | 100%   | ✅ PASS  |
| Security issues       | 0         | 0      | ✅ PASS  |
| Critical NFR failures | 0         | 0      | ✅ PASS  |
| Scope-guardrail breaches | 0      | 0      | ✅ PASS  |

**P0 Evaluation:** ✅ ALL PASS

#### P1 Criteria (Required for PASS)

| Criterion        | Threshold | Actual | Status   |
| ---------------- | --------- | ------ | -------- |
| P1 Coverage      | ≥90%      | 100%   | ✅ PASS  |
| Overall Coverage | ≥80%      | 100%   | ✅ PASS  |

**P1 Evaluation:** ✅ ALL PASS

#### Evidence Summary

- **Test execution:** active CI gate sequence green in CI order across all four stories
  (`install --frozen-lockfile` → `verify:lockfiles` → `typecheck` → `lint` → `test`
  placeholder → `build`). No automated unit/component/E2E suite exists yet by design.
- **Coverage:** 11/11 ACs carry accepted covering evidence (P0 100%, P1 100%, overall 100%).
- **Security:** No secrets committed; `.env*` gitignored; no service-role names in client/app
  code; security review of Story 1.4 found no exploitable vulnerabilities. ✅
- **Code review:** All four stories passed adversarial review; notably a HIGH tooltip-clipping
  defect (1.3-AC3) and a MEDIUM drawer-resize state-leak (1.3-AC2) were caught and fixed,
  strengthening confidence in the manually-verified shell ACs.

---

### GATE DECISION: ✅ PASS

### Rationale

Epic 1 is a foundational/infrastructure epic; its acceptance criteria are correctly verified
through CI quality gates, repo/config/parse checks, secret-hygiene checks, and documentation
review rather than a unit-test suite (the test harness is intentionally deferred to Epic 2 via
TEA `testarch-framework`). Judged on that infra-appropriate basis, **all 11 acceptance criteria
across Stories 1.1–1.4 carry accepted covering verification evidence**: P0 coverage 100%, P1
coverage 100%, overall coverage 100%. No security issues, no scope-guardrail breaches, no
critical NFR failures. Two UI ACs (1.3-AC2 responsive, 1.3-AC3 icon tooltip/accessible name)
are covered by the spec-sanctioned documented manual responsive/a11y verification plus the
build gate; their key failure modes were independently caught and fixed in adversarial review,
giving real present-day assurance. The deterministic gate logic (P0=100%, P1≥90%, overall≥80%)
yields **PASS**.

**Caveats (do not change the verdict):**

1. **Story 1.4 is still in `review`, not `done`.** Dev-story is complete with gates green and
   two review rounds resolved; it is awaiting final review sign-off. The gate is a *coverage*
   gate (every AC is covered); final close-out of 1.4's review is an orchestrator/owner action.
2. **One LOW residual carries automation forward:** automated app-shell component/a11y
   regression tests are deferred to Epic 2 (tracked in `deferred-work.md`). This does not leave
   any AC uncovered today, but Epic 2's test harness should backfill it so the shell ACs gain
   automated regression protection.

### Residual Risks (tracked, non-blocking)

| Risk | Priority | Probability | Impact | Mitigation | Remediation |
| --- | --- | --- | --- | --- | --- |
| Shell ACs (1.3-AC2/AC3) lack automated regression tests | P1 | Low | Low | Manual verification + build gate + review-caught/fixed defects | Backfill component/a11y tests when TEA harness lands (Epic 2) |
| Env-contract rules prose-only (no lint/CI guard) | P1 | Low | Med | No code reads the vars until Epic 2 | Add client-side service-role exposure guard in Epic 2 auth story |
| `build` gate non-hermetic (Google-font fetch) | P2 | Low | Low | Documented; passes on networked CI | Revisit if CI must run network-restricted |

**Overall residual risk:** LOW.

---

### Next Steps

**Immediate (orchestrator / owner):**
1. Close out Story 1.4 review → move to `done` (no coverage blocker; review-round items resolved).
2. Mark Epic 1 ready to transition `in-progress → done` once 1.4 is `done`.

**Follow-up (Epic 2):**
1. Initialize the test framework (TEA `testarch-framework`) and backfill automated app-shell
   component/a11y regression tests (residual #1).
2. Add a lint/CI guard against client-side service-role exposure when env consumption lands
   (residual #2).

---

## Related Artifacts

- **Epic source:** `_bmad-output/planning-artifacts/epics.md` (Epic 1, lines 373–523)
- **Story files:** `_bmad-output/implementation-artifacts/1-1…1-4-*.md`
- **CI workflow:** `.github/workflows/ci.yml`
- **Lockfile guard:** `scripts/verify/check-lockfiles.mjs`
- **CI docs:** `docs/quality/ci.md`; quality gates: `docs/quality/quality-gates.md`
- **Setup docs:** `README.md`, `docs/process/local-setup.md`
- **Env contract:** `.env.example`; `.gitignore:10-12`
- **PR template:** `.github/pull_request_template.md`
- **Deferred-work ledger:** `_bmad-output/implementation-artifacts/deferred-work.md`
- **Test-design (epic):** `_bmad-output/test-artifacts/test-design/`

---

## Integrated YAML Snippet (CI/CD)

```yaml
traceability_and_gate:
  traceability:
    epic_id: "1"
    date: "2026-06-21"
    coverage:
      overall: 100%
      p0: 100%
      p1: 100%
      p2: 100%
      p3: 100%
    gaps:
      critical: 0
      high: 0
      medium: 0
      low: 0
    residuals_tracked: 3
  gate_decision:
    decision: "PASS"
    gate_type: "epic"
    decision_mode: "deterministic"
    criteria:
      p0_coverage: 100
      p1_coverage: 100
      overall_coverage: 100
      security_issues: 0
      critical_nfrs_fail: 0
      scope_guardrail_breaches: 0
    thresholds:
      min_p0_coverage: 100
      min_p1_coverage: 90
      min_coverage: 80
    evidence:
      test_results: "local + CI active-gate sequence green (all four stories)"
      traceability: "_bmad-output/test-artifacts/traceability/epic-1-traceability-report.md"
    caveats:
      - "Story 1.4 in 'review' (not 'done') — review close-out is an owner action, no coverage blocker"
      - "Automated app-shell component/a11y tests deferred to Epic 2 (tracked, LOW)"
```

---

**Generated:** 2026-06-21
**Workflow:** testarch-trace (Requirements Traceability & Quality Gate)

<!-- Powered by BMAD-CORE™ -->
