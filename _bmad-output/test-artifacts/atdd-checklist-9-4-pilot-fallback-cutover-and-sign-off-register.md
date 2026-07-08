---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-07-08'
story: '9.4 — Pilot Fallback, Cutover, And Sign-Off Register'
story_file: '_bmad-output/implementation-artifacts/9-4-pilot-fallback-cutover-and-sign-off-register.md'
detected_stack: 'backend'
generation_mode: 'AI generation (node --test docs-invariant validators)'
inputDocuments:
  - '_bmad-output/implementation-artifacts/9-4-pilot-fallback-cutover-and-sign-off-register.md'
  - '_bmad-output/planning-artifacts/owner-signoff-questions.md'
  - '_bmad-output/test-artifacts/test-design-epic-9.md'
  - 'tests/unit/docs/migration-runbook-validators.test.ts'
  - 'src/features/calculations/readiness.ts'
scaffold_file: 'tests/unit/docs/sign-off-register-validators.test.ts'
---

# ATDD Checklist — Story 9.4 (Pilot Fallback, Cutover, And Sign-Off Register)

**TDD phase:** RED. All acceptance validators are authored BEFORE the 9.4 docs +
register + checklist model exist, and are EXPECTED TO FAIL until dev-story lands
them. Verified red: 12/12 fail with clear `[RED]` messages naming the missing
deliverable; the existing 9.1 validator stays green (9/9), so the scaffold does
not regress the migration-doc invariants.

## Step 1 — Preflight & Context

**Stack detection.** `test_stack_type` auto → **backend**. This project's unit
gate is a pure-logic `node --test` TypeScript runner
(`pnpm test:unit`, glob `tests/unit/**/*.test.ts`, via
`node --experimental-strip-types`), NOT Playwright/Cypress. Story 9.4 is a
**docs + `tests/unit/**` validator** story (no product `src/**` code, no schema,
no UI, no command) — so there is **no E2E / browser surface**. The ATDD
deliverable is therefore a red-phase `node --test` docs-invariant + executable
cutover-block validator, mirroring the 9.1 pattern
(`tests/unit/docs/migration-runbook-validators.test.ts`) exactly, not a
Playwright spec. The step-04 API/E2E subagent split is **N/A** for a
docs-validator backend story and was collapsed to a single sequential
`node --test` scaffold.

**Prerequisites.** Story is `ready-for-dev` with three clear ACs + non-AC epic
blockers. Unit framework configured (`test:unit` in `package.json`). Dev env
available. PASS.

**Framework & existing patterns.** The 9.1 validator is the exact template:
`node:test` + `node:assert/strict`, `readFileSync` over `docs/migration/**`,
live source-of-truth cross-checks (`TENANT_TABLES`, `ReadinessCode`), a
whole-directory PII scan with masked-placeholder stripping. The 9.4 scaffold
reuses its shape and its PII-scan regexes verbatim.

## Step 2 — Generation Mode

**AI generation** (backend → always AI generation; no browser recording).
Acceptance criteria are clear and machine-assertable against the live
system-of-record (`owner-signoff-questions.md`) and the real `READINESS_CODES`
union. Recording mode skipped (no UI).

## Step 3 — Test Strategy (AC → level → priority)

Levels available for this backend/docs story: **Unit** (`node --test`
docs-invariant + pure-function checklist model). No integration/RLS/storage/e2e
level applies — 9.4 touches no tenant-owned table, command, migration, or UI.

| AC / Blocker | Scenario | Level | Priority | Red-phase test id (in scaffold) |
| --- | --- | --- | --- | --- |
| AC3 / 9.4-BLOCK-01 (R-905/R-908) | Seeded open blocking item on a real-pilot workflow → cutover HARD-BLOCKED, block is attributed | Unit | **P0** | `9.4-BLOCK-01: … the block FIRES` |
| AC3 / R-908 | Fallback removal gated by same open-item state (fallback-erosion guard) | Unit | **P0** | `9.4-BLOCK-01 (R-908): fallback CANNOT be removed …` |
| AC3 / Two-track | Demo track UNBLOCKED with the same open items (tracks never conflated) | Unit | **P0** | `9.4-BLOCK-01: the DEMO track stays UNBLOCKED …` |
| AC3 / positive path | No open items → real-pilot workflow IS cutover-ready (guard is not a blanket deny) | Unit | **P1** | `9.4-BLOCK-01: … NO open blocking items IS cutover-ready` |
| AC2 / 9.4-REG-01 | Every AC2 item present in register with signed-off\|blocking status | Unit | **P1** | `9.4-REG-01: EVERY AC2 decision item …` |
| AC2 / R-917 | Every BLOCKING question ID from live `owner-signoff-questions.md` present in register (no drift) | Unit | **P1** | `9.4-REG-01 (R-917): EVERY blocking question ID …` |
| AC2 / two-track | Register records demo-vs-real-pilot split; demo non-blocking | Unit | **P1** | `9.4-REG-01: … demo-vs-real-pilot track split` |
| AC1 / 9.4-FALLBACK-01 | Per-workflow fallback + cutover + rollback-decision-point sections (non-empty) | Unit | **P2** | `9.4-FALLBACK-01: … per-workflow fallback + cutover + rollback …` |
| AC1 / arch §16 | Cutover AND rollback stated per-workflow, never whole-company | Unit | **P2** | `9.4-FALLBACK-01: cutover AND rollback are … per-workflow …` |
| AC1 / NFR21 R-908 | Fallback not removed while a blocking assumption open (doc statement) | Unit | **P2** | `9.4-FALLBACK-01: fallback MUST NOT be removed …` |
| Epic blocker / R-901/R-902/R-914 | Zero real PII across all `docs/migration/**` (incl. new 9.4 doc) | Unit | **P0** | `9.4-PRIV: NO real PII …` |
| Representativeness | No fictional ReadinessCode in the 9.4 doc; cited codes are real union members | Unit | **P1** | `9.4: any readiness code the 9.4 doc references is a REAL member …` |
| Doc hygiene | No stray write-tool artifact lines in the doc | Unit | **P2** | `9.4: … NO stray tool-call artifact lines …` |

**Negative/edge coverage** (the epic teeth): the BLOCK-01 P0 seeds an *open*
blocking item and asserts the guard FIRES (negative path) AND a positive path
where a clean workflow IS cutover-ready — so the guard is proven reachable, not
structurally-unreachable machinery (the epic-5 dead-guard anti-pattern the story
calls out).

**Red-phase confirmation.** Every test asserts EXPECTED post-implementation
behavior and fails today because (a) `docs/migration/pilot-fallback-cutover.md`
does not exist, (b) no sign-off register exists in either sanctioned home, and
(c) the executable `evaluateCutover(...)` checklist model has not been authored.
Surface-present checks are HARD assertions (never `describe.skip`) per the
project Testing Rule.

## Step 4 — Generated Failing Tests (RED)

**Scaffold file:** `tests/unit/docs/sign-off-register-validators.test.ts`
(colocated with the 9.1 validator; under the `tests/unit/**` runner glob — NOT
`tests/golden/**`, which is never executed: the runner-glob trap R-904).

**Live source-of-truth wiring (no memorised facts):**

- Blocking sign-off IDs parsed LIVE from `owner-signoff-questions.md` — the
  parser resolves all 8 open rows today
  (`7.1, 7.3, 8.1, 8.2, A.1, A.2, B.1-B.4, C.1-C.3`), so the register-drift check
  (R-917) does real work once the register lands.
- Any readiness code cross-checked against the REAL exported `READINESS_CODES`
  union (`src/features/calculations/readiness.ts`), imported live — never a
  hardcoded subset. The two known-fictional codes
  (`REQUIRES_SIGN_OFF`, `DEDUCTION_ESTIMATE_UNAPPROVED`) are hard-forbidden.
- PII scan reuses the 9.1 regexes + masked-placeholder stripping verbatim over
  the whole `docs/migration/**` tree.

**Contract the dev story must satisfy (what green requires):**

1. **`docs/migration/pilot-fallback-cutover.md`** — per-workflow (CRM, Settings/
   Pricing, Calculations, Quote Versions, Basic Job/Order, Required Files)
   fallback + cutover + explicit **rollback decision points**; per-workflow,
   never whole-company; fallback-not-removed-while-blocking statement.
2. **A sign-off register** — either a `## Sign-Off Register` section in that doc
   OR `docs/migration/sign-off-register.md` (pick one home, cross-link). Every
   AC2 item as a row with `signed-off | blocking` status + owning question ID +
   owner + affected workflow(s); every live blocking ID from the SoR present;
   demo-vs-real-pilot split recorded (demo non-blocking).
3. **An executable checklist model** exporting
   `evaluateCutover({ workflow, track, openBlockingItems }) =>
   { cutoverAllowed, fallbackRemovalAllowed, blockedBy }` — resolvable from one
   of: `tests/unit/docs/sign-off-checklist-model.ts`,
   `tests/support/sign-off-checklist-model.ts`, or
   `src/features/migration/sign-off-checklist.ts`. It HARD-BLOCKS real-pilot
   cutover + fallback removal on any open blocking item and leaves the demo
   track unblocked.

> **Note (dev-story flexibility):** the scaffold resolves the register from
> either home and the checklist model from any of three sanctioned paths, so the
> dev story keeps the Task-2.1 "pick one home" freedom without the acceptance
> test dictating a single filename. The `evaluateCutover` field names ARE the
> acceptance contract — keep them, or adjust the scaffold in lockstep during
> dev-story if a better shape emerges (it is a red-phase scaffold, not frozen).

## Step 5 — Validate & Complete

- [x] Prerequisites satisfied (story ready-for-dev, unit framework configured)
- [x] Test file created under the correct runner glob (`tests/unit/**`)
- [x] Checklist maps 1:1 to ACs + epic blockers (AC1 fallback/rollback, AC2
      register traceability, AC3 cutover-block, PII, representativeness, hygiene)
- [x] Tests designed to FAIL before implementation — **verified 12/12 red** with
      clear `[RED]` messages naming the missing deliverable
- [x] No regression: existing 9.1 `migration-runbook-validators.test.ts` stays
      green (9/9)
- [x] No orphaned browsers / CLI sessions (backend story — no browser used)
- [x] Temp artifacts: none written outside `_bmad-output/` / `tests/`

### Assumptions / risks

- **Backend/docs story — no E2E surface.** The ATDD workflow's API/E2E subagent
  split does not apply; a single `node --test` docs-invariant + pure-function
  scaffold is the correct red-phase deliverable. This is the same shape the 9.1
  story used and the TEA `automate` pass later promoted to standing coverage.
- **`evaluateCutover` shape is a proposed contract**, not a frozen API. If the
  dev story lands a materially better model shape, update the scaffold in
  lockstep during green phase (it is red-phase scaffolding).
- **Register home is left open** (section vs dedicated file) — the scaffold
  accepts either, matching Task 2.1's "pick one, cross-link" instruction.
- **Do NOT green by disabling.** Surface-present checks are hard assertions; the
  runner-glob (R-904) and no-`describe.skip` rules mean a skipped test is
  vacuous-green and forbidden.

### Next recommended workflow

`bmad-dev-story` on `9-4-…` to author the docs + register + `evaluateCutover`
checklist model and turn these 12 red tests green; then the TEA `automate` pass
can confirm/promote the scaffold to standing coverage (as it did for 9.1).
