---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-identify-targets'
  - 'step-03-generate-tests'
  - 'step-03c-aggregate'
lastStep: 'step-03c-aggregate'
lastSaved: '2026-07-08'
inputDocuments:
  - '_bmad-output/implementation-artifacts/9-4-pilot-fallback-cutover-and-sign-off-register.md'
  - '_bmad-output/test-artifacts/test-design-epic-9.md'
  - '_bmad-output/planning-artifacts/owner-signoff-questions.md'
  - 'docs/migration/pilot-fallback-cutover.md'
  - 'tests/unit/docs/sign-off-checklist-model.ts'
  - 'tests/unit/docs/sign-off-register-validators.test.ts'
  - 'tests/unit/docs/migration-runbook-validators.test.ts'
---

# Test Automation Expansion — Story 9.4 (Pilot Fallback, Cutover, And Sign-Off Register)

## Preflight & Context

- **Stack detected:** fullstack (Next.js/React + Supabase/pg). Frameworks present: Playwright (e2e),
  vitest (integration), `node --test` (unit gate). No `framework` workflow needed — HALT not triggered.
- **Mode:** BMad-Integrated (story + implementation artifacts present, status `review`).
- **Target tier:** Unit only. Story 9.4 is a DOCS + `tests/unit/**` validator story — it ships
  `docs/migration/pilot-fallback-cutover.md` (fallback/cutover/rollback runbook + `## Sign-Off
  Register`) plus one pure, I/O-free TypeScript model (`sign-off-checklist-model.ts`,
  `evaluateCutover(...)`). NO product `src/**` code, no route, no schema, no migration, no UI — so
  E2E/API generation and the browser-exploration subagents are **not applicable**. Execution mode:
  sequential (author directly), the deterministic fallback for a pure-logic/docs target.
- **Baseline unit gate:** 1336 pass / 0 fail (story-recorded); re-confirmed the 9.4 validator green
  at 13/13 before expansion.

## Coverage Gap Analysis (Step 2)

The story's ATDD scaffold (`sign-off-register-validators.test.ts`, 13 tests) proves the three ACs at
a **happy-path + single-negative** level: one seeded open item blocks real-pilot cutover, one blocks
fallback removal, one demo case stays open, one clean case allows. That leaves the epic-blocker guard
(9.4-BLOCK-01, P0) under-exercised on the axes below, and — most importantly — leaves the **register
(decision doc) and the executable model (guard) untied**: nothing asserted they agree on the blocking
set. Gaps identified against `evaluateCutover(...)` and the register↔model relationship:

1. **Multi-item attribution.** Only a single open item was seeded; `blockedBy` completeness with
   SEVERAL open items was untested (a partial attribution would give a caller an incomplete
   remediation set).
2. **R-908 fallback-erosion symmetry.** Cutover-block and fallback-removal-block were each tested with
   a DIFFERENT single item; the invariant that ONE open item denies BOTH axes with a matching
   `blockedBy` was not pinned together.
3. **Clean real-pilot completeness.** The positive path asserted only `cutoverAllowed === true`; it did
   NOT assert `fallbackRemovalAllowed === true` nor an EMPTY `blockedBy` (a model fabricating a phantom
   blocker on a clean workflow would pass the old test).
4. **Demo-track totality.** The demo case asserted only `cutoverAllowed`; `fallbackRemovalAllowed` on
   the demo track and the "many open items still non-blocking" case were untested (the two tracks must
   be non-conflated on BOTH decision axes).
5. **Input purity.** `evaluateCutover` was not asserted to leave the caller's `openBlockingItems`
   array unmutated (a shared-state side effect would corrupt a caller iterating the same list).
6. **Register↔model consistency (highest-value, R-905/R-908/R-917).** No test tied the live
   system-of-record's blocking ID set to the guard's behavior. The register (§4) enumerates the
   blocking IDs and 9.4-REG-01 proves no doc-drift — but nothing asserted that feeding each of those
   IDs to `evaluateCutover` actually BLOCKS real-pilot and does NOT block demo. A register marking an
   item blocking paired with a guard that lets it through would be undetected.

## Tests Generated (Step 3 / 3C)

Six standing `node --test` cases appended to `tests/unit/docs/sign-off-register-validators.test.ts`
(colocated with the ATDD scaffold, under the `pnpm test:unit` glob — never the vacuous-green
runner-glob trap, R-904). All import the REAL `evaluateCutover` model and read the blocking IDs LIVE
from `owner-signoff-questions.md` (no hardcoded drifting copy):

| ID | Level | Pri | Gap closed |
| --- | --- | --- | --- |
| 9.4-BLOCK-01 (multi-item) | Unit | P0 | `blockedBy` names EVERY open item, not just the first |
| 9.4-BLOCK-01 (R-908 symmetry) | Unit | P0 | one open item denies BOTH cutover + fallback removal, matching `blockedBy` |
| 9.4-BLOCK-01 (clean real-pilot) | Unit | P0 | resolved workflow allows both axes with EMPTY `blockedBy` (no phantom blocker) |
| 9.4-BLOCK-01 (demo totality) | Unit | P0 | demo never blocks on either axis, even with 8 open items |
| 9.4-BLOCK-01 (purity) | Unit | P1 | `evaluateCutover` does not mutate the caller's input array |
| 9.4-REG-01 (register↔model consistency) | Unit | P0 | every LIVE blocking question ID blocks real-pilot + does not block demo |

No new fixtures, helpers, or dependencies were needed — the tests reuse the existing
`loadCutoverModel()` / `blockingSignoffIds()` helpers already in the file. No product `src/**` code,
no schema, no migration, no `owner-signoff-questions.md` edit, no golden fixture touched.

## Verification

- **9.4 validator:** 19/19 green (13 pre-existing + 6 new).
- **Full unit gate (`pnpm test:unit`):** 1342 pass / 0 fail (was 1336; +6). No regression — the 9.1
  `migration-runbook-validators.test.ts` and every golden pin stay green.
- **`pnpm run typecheck` (`tsc --noEmit`):** clean.
- **`pnpm run lint` (eslint):** 0 errors (1 pre-existing unrelated warning in
  `tests/unit/lib/money/vat.test.ts`, not touched by this expansion).
- **Gate posture:** typecheck / lint / unit apply and pass; migration-reset / int / RLS / storage /
  e2e are not applicable (no product code, schema, command, or UI) — SKIPPED-WITH-REASON.

## Residual Coverage Notes (intentionally not expanded)

- `evaluateCutover` is a total pure function over `{workflow, track, openBlockingItems}`; `workflow` is
  carried as a label only (it does not branch on the workflow name), so per-workflow branch cases would
  be redundant. The register-derived blocking set is exercised live instead of enumerating synthetic IDs.
- The docs-invariant surface (per-workflow fallback/cutover/rollback sections, PII scan,
  fictional-ReadinessCode guard, tool-artifact hygiene) is already covered by the scaffold at hard-assert
  strength — no self-disabling `describe.skip`, no vacuous-green.
