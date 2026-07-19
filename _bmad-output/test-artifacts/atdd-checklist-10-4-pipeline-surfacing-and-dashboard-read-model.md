---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
  - 'step-04c-aggregate'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-07-19'
inputDocuments:
  - _bmad-output/implementation-artifacts/10-4-pipeline-surfacing-and-dashboard-read-model.md
  - _bmad-output/test-artifacts/test-design-epic-10.md
  - _bmad/tea/config.yaml
  - src/features/quotes/follow-up-dates.ts
  - src/features/quotes/follow-up-view.ts
  - src/features/quotes/read.ts
  - src/components/quotes/status.ts
  - src/lib/money/ore.ts
  - src/server/db/supabase-server-client.ts
  - src/scope/manifest.ts
  - tests/unit/components/quotes/status.test.ts
  - tests/unit/features/quotes/follow-up-view.test.ts
  - tests/integration/rls/quote-follow-ups.rls.test.ts
  - tests/factories/tenants.ts
  - tests/support/stack-gate.ts
---

# ATDD Checklist: Story 10.4 — Pipeline Surfacing and Dashboard Read-Model

**Date:** 2026-07-19
**Author:** Rasmus (TEA)
**Primary Test Level:** split — pure UNIT (node:test) + DB-backed INT/RLS (Vitest) + one consistency E2E (Playwright)

## Story Summary

Ships the FIRST `src/server/read-models` module — a quote-pipeline read-model returning the phase-defining
`{ data, entitlements }` contract — plus the sensitive-field withholding MECHANISM (entitlement descriptor
with a conservative single-role `tenant_admin` default; the N-4 per-role matrix is owner-gated / Epic 11),
the pure event-sourced aggregation (sent/accepted/lost counts, hit rate, open/overdue follow-up counts,
öre-derived accepted value) over deterministic Europe/Stockholm period windows, and the list/detail "render
consistently" pass that folds the 10.3 follow-up chip + overdue-badge tri-state tones into a shared
`status.ts` primitive (the named 10-3 deferred item). NO new nav/widget/analytics/email surface; NO new
migration/table (`TENANT_TABLES` stays 26).

**As a** Säljare and Projektledare **I want** pipeline data surfaced consistently in the quote list/detail
AND available as a server read-model **so that** the pipeline is visible now and E19 renders it later with
zero re-implementation.

## Preflight & Context (Step 1)

- **Stack detected:** `fullstack` (Next.js + Supabase). Story 10.4 spans THREE test surfaces — pure TS
  (entitlement descriptor + aggregation + period windows + the follow-up tone authority), DB-backed
  RLS-client-only isolation + list-filter integration + a non-scope guard, and one contract-consistency
  render surface — so the two-runner + Playwright split all apply, per surface.
- **Test framework:** already configured (no framework setup needed) —
  - `node --test` + `--experimental-strip-types` + the `@/*` alias hook (`tests/support/register.mjs`),
    run via `pnpm test:unit` (glob under `tests/unit`);
  - Vitest (`pnpm test:int`) for DB-backed INT/RLS against the LOCAL Supabase stack;
  - Playwright (`pnpm test:e2e`) for the render-consistency E2E.
- **Prerequisites:** story approved (`ready-for-dev`) with clear AC1–AC4; frameworks present. PASS.

## Generation Mode (Step 2)

- **Mode:** AI generation from the story spec + the mirrored 10.1/10.2/10.3 source/test patterns (the
  manifest-derivations red scaffold, the pure `status.ts`/`follow-up-view.ts` units, the
  `quote-follow-ups` RLS/INT scaffolds, the `read.ts` RLS-client + generic-error posture, the
  `@/lib/money` öre authority). **No browser recording** — the read-model, the entitlement seam, the
  aggregation, and the `status.ts` tone fold do not exist yet (Tasks 1–4 are dev); recording a
  non-existent surface is out of scope.
- **Skill adaptation (recorded — same override as 10.2/10.3):** the ATDD skill's Step 4 dispatches
  Playwright API + E2E red-phase workers. That split is WRONG for THIS repo's two-runner discipline
  (epic-10 retro 10-1 Phase-4) and was OVERRIDDEN by the task's ratified repo conventions: pure-logic
  red scaffolds on `node:test` under `tests/unit`; DB-backed integration/RLS on Vitest under
  `tests/integration`; UI on Playwright under `tests/e2e` as a skipped scaffold. Scaffolds were authored
  directly following the project's own red-phase idiom (collect-and-skip; local `notYetImplemented()`
  placeholders so files type-check today WITHOUT importing unimplemented modules; the `markdown-glob in
  JSDoc` gotcha avoided — no `*/`-forming sequences inside block comments). Placeholder params are
  `void`-referenced so lint stays 0/0.

## Test Strategy (Step 3) — AC → level → priority

| AC | Scenario | Level | Priority | Test ID | Red mechanism |
| --- | --- | --- | --- | --- | --- |
| AC1 | Entitlement descriptor contract — withheld money field ABSENT from `data` (never null/0) AND listed in `withheld`; aggregate honesty (any withheld component ⇒ whole aggregate withheld); column omission (FieldPath list); counts/hitRate never withheld; conservative `tenant_admin` default ⇒ `withheld: []` | Unit (node:test) | **P0** | 10.4-UNIT-01 | `@/server/read-models/entitlements` absent → local `notYetImplemented()` placeholder (skipped) |
| AC1 | Pure aggregation — sent/accepted/lost counts from in-window `quote_events`; hit rate = accepted/(accepted+lost) incl. zero-decided ⇒ null; empty states; `acceptedValueOre` öre-derived via `@/lib/money`; open/overdue counts via `classifyFollowUp`; deterministic Europe/Stockholm period windows | Unit (node:test) | P1 | 10.4-UNIT-02 | aggregate + period module absent (placeholder; skipped); `formatOreAsKronor` imported (real) |
| AC2 | Follow-up TONE AUTHORITY on `status.ts` — labels/colors per `FollowUpDateClass` (upcoming/due-today/overdue); text-first; unknown-key neutral fallback (the named 10-3 deferred fold) | Unit (node:test) | P2 | 10.4-UNIT-02 (tone) | `status.ts` follow-up exports absent (placeholder; skipped) |
| AC4 | Read-model isolation floor — RLS-client-only + cross-tenant proof (A never sees B) + **structural assertion no service-role/unscoped client is imported on the read-model path** | Integration/RLS (Vitest) | **P0** | 10.4-INT-01 | `@/server/read-models/quote-pipeline` absent → placeholder + `existsSync`-guarded source scan (describe.skip) |
| AC2 | List-filter consistency — status filters incl. Förlorad/Avböjd, `Förlustorsak` column, `Har uppföljning`/`Försenad uppföljning` return correct rows over a mixed two-tenant lifecycle fixture | Integration (Vitest) | P1 | 10.4-INT-02 | injectable list read absent (placeholder; describe.skip) |
| AC3 | Non-scope guard — quotes module keeps `widgets: []` + one `/quotes` nav item; no new analytics page/nav/widget; `TENANT_TABLES` stays 26; no email-send path on the read-model surface | Integration (Vitest) | P2 | 10.4-INT-03 | manifest pins already true (regression guard) + read-model email scan (describe.skip) |
| AC2 | Render consistency — status filter / `Förlustorsak` column / follow-up filters / detail-header chip render via `StatusBadge` + the shared `status.ts` tone authority (UX-BDR4/BDR17 text-first) | E2E (Playwright) | P2 | 10.4-E2E-01 | tone fold + mixed pipeline fixture absent (test.describe.skip) |

**Deliberate non-duplication:** the generic cross-tenant row-visibility negatives for the underlying tables
(`quote_events`, `quote_follow_ups`, `quote_versions`) come from their EXISTING `TENANT_TABLES` enrolment +
the shared `cross-tenant-isolation.rls.test.ts` — NOT re-litigated in 10.4-INT-01 (Testability Note 5). The
read-model INT pins ONLY the read-model-level composition proof + the structural no-service-role assertion.
NO new tenant table is added (TENANT_TABLES stays 26), so nothing is enrolled. The pure descriptor + the
pure aggregation are kept DB-free (10.4-UNIT-01/02) so the contract is pinned without a stack; the query/
isolation layer is proven separately at INT (the epic-9/10 "extract pure logic to the fast unit gate"
lesson). Money is asserted through the single `@/lib/money` `formatOreAsKronor` authority — never a second
formatter, never a re-derived total (R-1042 STOP honored).

## Red Phase Generation (Step 4 / 4C) — files written

All suites are **skipped** (red phase) and assert EXPECTED behaviour (no placeholder assertions). Each file
type-checks today (local `notYetImplemented()` placeholders / `existsSync`-guarded source scans avoid
importing unimplemented modules) and carries a GREEN-PHASE HAND-OFF header block. TDD red-phase compliance:
verified.

| Test ID(s) | File | Runner |
| --- | --- | --- |
| 10.4-UNIT-01 | `tests/unit/server/read-models/entitlements.test.ts` | node:test |
| 10.4-UNIT-02 | `tests/unit/server/read-models/quote-pipeline-aggregate.test.ts` | node:test |
| 10.4-UNIT-02 (tone) | `tests/unit/components/quotes/follow-up-tone.test.ts` | node:test |
| 10.4-INT-01 | `tests/integration/rls/quote-pipeline-read-model.rls.test.ts` | Vitest |
| 10.4-INT-02 | `tests/integration/features/quotes/quote-pipeline-list-filters.int.test.ts` | Vitest |
| 10.4-INT-03 | `tests/integration/features/quotes/quote-pipeline-non-scope-guard.int.test.ts` | Vitest |
| 10.4-E2E-01 | `tests/e2e/quotes/quote-pipeline-consistency.e2e.spec.ts` | Playwright |

**Verification run (this step):**
- `node --test` (the 3 unit files): **21 tests, 0 fail, all 21 skipped**.
- `vitest run` (the 3 int/rls files): **3 files skipped, 13 skipped, 0 fail**.
- `playwright test --list` (the e2e file): 4 tests listed (skipped at runtime via `test.describe.skip`).
- `tsc --noEmit`: **exit 0** (whole project, scaffolds included).
- `eslint` (all 7 files): **0 errors, 0 warnings**.

## Acceptance Criteria Coverage

- **AC1** (read-model `{ data, entitlements }` + entitlement mechanism) → 10.4-UNIT-01 (the precedent
  descriptor contract: withheld ABSENT + listed, never null/0; aggregate honesty; column omission;
  `tenant_admin` conservative default ⇒ `withheld: []`; counts/hitRate never withheld) + 10.4-UNIT-02
  (event-sourced counts, hit rate incl. zero-decided ⇒ null, empty states, öre-derived accepted value via
  `@/lib/money`, deterministic Stockholm period windows). Covered at the pure level; the DB projection is
  proven by 10.4-INT-01.
- **AC2** (list/detail render consistently + the 10-3 tone fold) → 10.4-UNIT-02 (tone) (the `status.ts`
  follow-up tone authority) + 10.4-INT-02 (list-filter correctness over a mixed lifecycle fixture) +
  10.4-E2E-01 (StatusBadge + `status.ts` render consistency). Covered.
- **AC3** (no new analytics surface) → 10.4-INT-03 (manifest widgets/nav pins unchanged; TENANT_TABLES 26;
  no email-send path on the read-model surface). Covered.
- **AC4** (read-model isolation floor — RLS-client-only, cross-tenant proof) → 10.4-INT-01 (cross-tenant:
  A never sees B; the STRUCTURAL assertion that no service-role/unscoped client is imported on the
  read-model path — R-1041). Covered.

## Next Steps (TDD Green Phase — Story 10.4 dev)

Per file, the GREEN-PHASE HAND-OFF header block is authoritative. In summary:
1. Land Task 1 (`src/server/read-models/quote-pipeline-aggregate.ts` — pure aggregation + the
   Europe/Stockholm period helper reusing `follow-up-dates.ts`'s `sv-SE`/injected-clock discipline) →
   replace the placeholders in `quote-pipeline-aggregate.test.ts` with real imports; remove `{ skip: true }`.
2. Land Task 2 (`src/server/read-models/entitlements.ts` — `projectWithEntitlements` + the conservative
   `tenant_admin` resolver; `src/server/read-models/quote-pipeline.ts` — `readQuotePipeline` on the RLS
   client ONLY, generic-error posture mirroring `read.ts`) → replace the placeholders in
   `entitlements.test.ts` + `quote-pipeline-read-model.rls.test.ts`; remove `{ skip: true }` / `.skip`.
   **Do NOT** create `permission-matrix.ts` or enumerate roles (Epic 11 / EB-A4).
3. Land Task 4 (the `status.ts` follow-up tone authority + `FollowUpChip.tsx` / `QuoteList.tsx` consuming
   it, deleting the bespoke inline tones — the named 10-3 deferral) → replace the placeholders in
   `follow-up-tone.test.ts`; remove `{ skip: true }`. Preserve the `data-testid`s + text-first labels so
   10.3's E2E + the new 10.4-E2E-01 stay green.
4. Land Task 3 (list/detail consistency proof — reuse the 10.2/10.3 `read.ts` projection, do NOT rebuild)
   → wire the injectable list read against the harness client; seed the mixed-lifecycle two-tenant fixture
   (accepted version + lost version with a reason + an OPEN OVERDUE follow-up) via the existing factories;
   remove `.skip` on `quote-pipeline-list-filters.int.test.ts`.
5. Land Task 5 guard → remove `.skip` on `quote-pipeline-non-scope-guard.int.test.ts` (the manifest pins
   must stay green with NO pin change; the email scan must find none).
6. Extend `global-setup.ts` with the mixed pipeline fixture + `crypto.randomUUID()` seeds; remove `.skip`
   on `quote-pipeline-consistency.e2e.spec.ts`. Run against a freshly `supabase db reset` LOCAL stack
   (`SUPABASE_TEST_REQUIRED=1` in CI hard-fails on an unreset/unreachable stack; use a complete TEMP CLI
   profile for the local reset — do NOT commit a cli-profile change).

**Unskip-or-delete finalize (epic-10 Tier-A + 10-2/10-3 review lesson):** the dev phase MUST end with EVERY
scaffold above either unskipped-and-green OR deleted — never a `describe.skip` / `test.describe.skip` /
`{ skip: true }` shipped as if it were coverage, never a throwing-placeholder next to the real test. Any
"all unskipped and green" Change-Log claim must be literally true (three separate 10.2 Patches were exactly
this failure mode). Every assertion is the CONTRACT — do NOT weaken them when removing the skips.

## Key Risks / Assumptions

- **Precedent contract (R-1040/R-1041):** the `{ data, entitlements }` shape is pinned as a pure UNIT spec
  (10.4-UNIT-01) — a withheld field is ABSENT + listed (never null/0), any withheld component withholds the
  whole aggregate, and the conservative `tenant_admin` default is `withheld: []`. A wrong shape or an
  RLS-client bypass propagates to EVERY later Phase B read-model, so the descriptor is DB-free and the
  query layer thin, with the structural no-service-role import assertion (10.4-INT-01) as the security
  floor.
- **N-4 seed is a flagged conservative default, NEVER the confirmed matrix (R-1046):** the scaffolds drive
  an UNENTITLED input to prove the withholding path; under B1a everyone is `tenant_admin` (money-entitled),
  so runtime `withheld` is `[]` today. Carry the seed as `[gated: N-4]` in the completion notes; the
  mechanism is ungated per the sprint-status OWNER-GATE WATCHLIST. Do NOT hard-code the per-role matrix
  (Epic 11 owns `permission-matrix.ts`) — a STOP if the mechanism appears to require it (10.4-DOCS-01).
- **No new money path (R-1042 STOP):** `acceptedValueOre` is a plain INTEGER öre sum of the frozen
  `quote_versions.accepted_price_ore`, formatted via `formatOreAsKronor` (`@/lib/money`) ONLY — the unit
  asserts this. If aggregation appears to need VAT/ROT/rounding/summation-of-non-öre, that is a STOP.
- **Hit-rate denominator assumption:** FR65 says "hit rate" without pinning the denominator; the story
  fixes `accepted / (accepted + lost)` (the decided-deals win rate, zero-decided ⇒ null). The unit tests
  encode this; flag it in completion notes for E19/owner confirmation.
- **Two-runner discipline maintained:** no Playwright worker was spun up for not-yet-existing surfaces;
  pure descriptor/aggregation/period/tone assertions stay on node:test, DB-backed isolation/list-filter on
  Vitest, only the rendered filters/column/chip are Playwright (skipped).
- **No new tenant table / manifest pin change:** Migration/Coexistence Impact is None — `TENANT_TABLES`
  stays 26; the non-scope guard asserts the manifest count and the empty widget/one-nav-item quotes module
  are unchanged. No PII fixture was authored in this red phase (prefer factory-built rows); if a pipeline
  golden fixture is added in dev, extend the STANDING `anonymization-scan.ts` control, not a fixture-local
  check (R-1015).

## Recommended next workflow

`bmad-dev-story` for Story 10.4 (implement Tasks 1–6, un-skip each suite as its surface lands). After green,
optionally `bmad-testarch-trace` to refresh the epic-10 traceability matrix (this is the FINAL story of
Epic 10 — a full-epic trace + retro follows).

**Generated by BMad TEA Agent** - 2026-07-19
