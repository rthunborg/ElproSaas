---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-07-03'
workflowType: testarch-atdd
storyId: 5-3-pricing-source-selection-and-row-snapshots
tddPhase: RED
inputDocuments:
  - _bmad-output/implementation-artifacts/5-3-pricing-source-selection-and-row-snapshots.md
  - _bmad-output/test-artifacts/test-design-epic-5.md
  - _bmad-output/test-artifacts/atdd-checklist-5-1-tenant-owned-calculation-schema-and-server-commands.md
  - _bmad/tea/config.yaml
  - src/lib/snapshots/types.ts
  - src/lib/snapshots/build.ts
  - src/server/snapshots/resolve-source.ts
  - src/server/commands/calculations/rows.ts
  - src/server/commands/calculations/validation.ts
  - src/server/commands/calculations/index.ts
  - tests/integration/commands/calculation-commands.int.test.ts
  - tests/integration/rls/calc-tables-migration-reset.int.test.ts
  - tests/unit/server/commands/calc-validation.test.ts
  - tests/e2e/calculations/calculations.e2e.spec.ts
  - tests/factories/tenants.ts
  - tests/factories/admin-sql.ts
---

# ATDD Checklist: Story 5.3 — Pricing Source Selection And Row Snapshots

**Role:** Master Test Architect · **Mode:** Create · **TDD Phase:** RED (failing scaffolds before implementation)
**Generated:** 2026-07-03

---

## Step 1 — Preflight & Context

**Stack detection (`test_stack_type: auto`):** Story 5.3 is a **fullstack** slice on top of finished
primitives — a backend half (an ADDITIVE `source_*` migration on `calculation_rows`; the
`createRow`/`updateRow` resolve→build→persist extension; pure source-pair validators) AND a frontend
half (the `RowEditor` source `<select>` + prefill + provenance line). So the ATDD deliverable is a
MIX: DB-backed Vitest INT (the R-507 freeze proof + R-502 both-layers spoof + explainability),
`node --test` pure UNIT (source-pair validation), and Playwright E2E (the editor source affordance).

**Prerequisite reality (the gating fact — by design, no HALT):** Story 5.3 inherits a COMPLETE
foundation and COMPOSES it — it does not invent. Already green in `main`: the Story 3.5 snapshot
CONTRACT (`src/lib/snapshots/types.ts`, the pure copy-by-value/`Object.freeze` builders
`buildWorkRoleSnapshot`/`buildArticleSnapshot` in `src/lib/snapshots/build.ts`, the RLS ownership
resolver `resolveSnapshotSource` in `src/server/snapshots/resolve-source.ts`); the Story 5.1
`calculation_rows` table + `createRow`/`updateRow` commands + the injectable `CommandClock` + the
frozen `@/lib/money` öre engine; the Story 5.2 editor (`RowEditor.tsx` — which explicitly DEFERRED
source selection to THIS story at its lines 11-12) + the calc read + the `oreToKronorString` money
boundary; the two-tenant fixture + `adminInsertWorkRole`/`adminInsertArticle`/`adminInsertCalculation/
Section/Row` seeds; the FROZEN migration-reset guards (`calc-tables-migration-reset.int.test.ts` —
every `%_ore` column MUST be bigint; the forbidden supplier/import/… column-name scan). What does NOT
exist yet is the Story 5.3 DEV work: the additive `source_*` columns (Task 1), the row-command
resolve+build+persist + validator extension (Task 2), the read/UI source affordance (Task 3). The
ATDD phase therefore writes only **failing acceptance scaffolds** that the dev phase un-skips and
greens — no migration, no `src/**`, no factory-body edits here.

**Inputs loaded:** the 5.3 story file (AC1-6, Tasks 1-5, the three Open Questions), `test-design-epic-5.md`
(P0 5.3-INT-01/02/03, P1 5.3-INT-04; risks R-507 freeze / R-502 cross-tenant; Not-in-Scope HARD
no-supplier-scope), the Story 5.1 ATDD checklist (the near-identical backend red-phase convention),
the Story 3.5 snapshot contract + builders + resolver (the exact composition point + field names),
the 5.1 `calculation-commands.int.test.ts` (the `runCommand`/two-tenant/`adminQuery`-readback shape),
the frozen `calc-tables-migration-reset.int.test.ts` guards, the `calc-validation.test.ts`
`node --test` `assertRejected`-no-echo shape, the 5.2 `calculations.e2e.spec.ts` (the
`signIn`/`waitForHydrated`/fixture/`getByTestId` E2E template), the `tenants.ts`/`admin-sql.ts`
factories, `tea/config.yaml`.

**Knowledge fragments (conceptual, applied):** data-factories (self-contained BYPASSRLS source
seed/mutate/readback via `adminQuery`; per-run unique ids), test-quality (assert the MECHANISM — the
freeze test proves BEHAVIOUR by mutating the source after capture, not field-presence; no vacuous
disjunctions; no `expect(true)`), test-levels-framework (INT freeze/spoof vs UNIT source-pair vs E2E
affordance — no duplicate coverage; the migration-reset column guards already own the schema half),
test-priorities-matrix (P0 freeze/spoof, P1 explainability), selector-resilience +
test-healing-patterns (E2E `getByTestId`/`getByLabel`, hydration poll — mirrors the 5.2 template).

---

## Step 2 — Generation Mode

**Mode: AI generation** (clear ACs; standard snapshot-freeze / cross-tenant-spoof / pure-validator /
editor-affordance scenarios). Recording mode **skipped** — the UI does not exist yet (red phase), so
there is nothing to record; the E2E scaffold MIRRORS the established 5.2 template rather than being
recorded. The skill's parallel API/E2E subagent dispatch presumes a live runner + browser; for this
pre-feature red-phase story the scaffolds were generated **sequentially and directly** (the documented
sequential resolution path Stories 5.1/5.2 used), honoring the red-phase contract.

---

## Step 3 — Test Strategy (AC → level → priority)

Test-level discipline (no duplicate coverage):

- **The SCHEMA half of AC2/AC5 (every `source_*_ore` is bigint; NO supplier/import/… column) is NOT a
  new suite.** The FROZEN `tests/integration/rls/calc-tables-migration-reset.int.test.ts` already
  scans EVERY column on the three calc tables — `:219-230` asserts every `%_ore` column is `bigint`,
  `:334-345` fails on any `supplier|credential|api_key|apikey|sync|import|external|fortnox|mapping`
  column name. The moment the Task-1 additive migration lands, those guards automatically cover the
  new `source_price_ore`/`source_cost_ore` (bigint) + all `source_*` names (clean). The ATDD
  deliverable for this AC half is therefore the **naming discipline pin** (KEEP money columns
  `_ore`-suffixed so BOTH the bigint guard and the inherited 5-1 name-suffix guard check them), not a
  duplicated suite.
- **The freeze/spoof/explainability BEHAVIOUR (AC1-AC4) is a NEW dedicated INT scaffold**
  (`calculation-row-source.int.test.ts`) — the headline R-507/R-502 proofs, DB-backed via the
  two-tenant fixture. Self-contained source seed/mutate/readback via `adminQuery` (BYPASSRLS) so it
  needs no factory-body extension as a prerequisite.
- **Source-PAIR validation (AC1/AC2/AC4) is a NEW `node --test` UNIT scaffold**
  (`calc-source-validation.test.ts`) — both-or-neither, closed `{work_role, article}` kind, UUID id,
  manual-stays-first-class, `isPresent('')===false`, no-echo. The fast gate on every PR.
- **The editor source AFFORDANCE (AC6) is a NEW Playwright E2E scaffold**
  (`calculation-source-selection.e2e.spec.ts`) — mirrors the 5.2 template exactly.
- **No new cross-tenant/anon RLS suite.** `calculation_rows` is ALREADY enrolled (Story 5.1); 5.3
  adds COLUMNS, not a table, so the inherited data-driven cross-tenant/anon suites + the H4 gate cover
  the (now-wider) row automatically — no enrollment edit, no new negative suite.

| AC | Scenario | Level | Priority | Test ID | Risk | Status here |
| --- | --- | --- | --- | --- | --- | --- |
| AC1 | work_role source → row stores frozen sell(=price)/cost/name/updated_at/captured_at, byte/öre-equal to source | INT | P0 | 5.3-INT-01 | R-507 | **Scaffolded (gated)** |
| AC2 | article source → row stores name/unit_price(=price)/sku/unit/updated_at; NO supplier/import value | INT | P0 | 5.3-INT-01 | R-507 | **Scaffolded (gated)** |
| AC3 | FREEZE PROOF — mutate+archive the source after capture → the row snapshot is UNCHANGED | INT | P0 | 5.3-INT-02 | R-507 | **Scaffolded (gated)** |
| AC4 | cross-tenant source spoof (create) → TENANT_ACCESS_DENIED + no foreign source_id persisted (both layers) | INT | P0 | 5.3-INT-03 | R-502 | **Scaffolded (gated)** |
| AC4 | cross-tenant source spoof (update) → TENANT_ACCESS_DENIED; row stays manual | INT | P0 | 5.3-INT-03 | R-502 | **Scaffolded (gated)** |
| AC3 | archived-source explainability — after archive, the row still surfaces captured name/rate | INT | P1 | 5.3-INT-04 | R-507 | **Scaffolded (gated)** |
| AC1/AC2/AC4 | source-pair validation: both-or-neither; closed kind; non-UUID id; manual accepted; `isPresent('')===false`; no-echo | UNIT | P1/P2 | R-504 | R-504 | **Scaffolded (gated)** |
| AC5 | every `source_*_ore` money column is bigint (never numeric/float); non-negative CHECK | INT (migration-reset) | P0 | R-506 | R-506 | **Covered by FROZEN guard (naming pin)** |
| AC2 | NO supplier/credential/api_key/sync/import/external/fortnox/mapping COLUMN name on any calc table | INT (migration-reset) | P0 | R-511 | R-511 | **Covered by FROZEN guard** |
| AC6 | select work role (labor)/article (material) → prefill + provenance line; manual row still saves | E2E | P1 | 5.3-E2E-01/02/03 | — | **Scaffolded (gated)** |
| AC6 | NO supplier/import/API/deferred-workflow label in the source affordance; nav stays seven | E2E | P1/P2 | 5.2-E2E-05 (holds) | R-511 | **Scaffolded (gated)** |

**Red-phase requirement confirmed:** every scenario asserts EXPECTED behaviour (no `expect(true)`);
the freeze test asserts the BEHAVIOUR (source changed after capture ⇒ row snapshot unchanged), not
just field presence; every command negative asserts the typed `TENANT_ACCESS_DENIED` MECHANISM plus a
BYPASSRLS re-read that no foreign source persisted (no vacuous empty-set disjunction); the UNIT
rejections assert `VALIDATION_FAILED` + `'data' in result === false` (raw value never echoed). All
scaffolds FAIL before the Story 5.3 dev migration + command extension + UI exist, and are kept
`describe.skip` / `test.describe.skip` / `node --test` `{ skip: true }` so they cannot false-red CI.

---

## Step 4 / 4C — Generated Scaffolds (RED PHASE)

**Placement (architecture §22):** INT under `tests/integration/commands/`; pure validators under
`tests/unit/server/commands/`; E2E under `tests/e2e/calculations/` — all already enrolled in
`typecheck` + the respective runners. Not scattered in UI/src modules.

**Runner/skip idiom:** the skill's Playwright `test.skip()` red-phase idiom maps to this project's
established conventions — `describe.skip(...)` for the Vitest INT file, `test.describe.skip(...)` for
the Playwright E2E file, and `test(name, { skip: true }, …)` for the `node --test` unit file. Each
scaffold imports the EXISTING factories + envelope + commands + snapshot contract (so it type-checks
today). The INT scaffold's source seed/mutate/readback is self-contained via `adminQuery` (BYPASSRLS)
so no factory-body edit is a prerequisite. The `createRow`/`updateRow` `input` is typed `unknown` at
the `runCommand` boundary, so the not-yet-existing `{source_kind, source_id}` keys type-check today —
the dev phase adds them to the validated input type + the resolve/build/persist path.

### Files created

| File | Level | Suite state | Gating |
| --- | --- | --- | --- |
| `tests/integration/commands/calculation-row-source.int.test.ts` | INT — 5.3-INT-01 (work_role + article capture-by-value), 5.3-INT-02 (freeze proof: mutate+archive source ⇒ row unchanged), 5.3-INT-03 (cross-tenant spoof on create AND update ⇒ TENANT_ACCESS_DENIED + no foreign source persisted), 5.3-INT-04 (archived-source explainability) | `describe.skip` (6 tests) | Dev Task 1 (`source_*` migration) + Task 2 (resolve+build+persist on `createRow`/`updateRow`). |
| `tests/unit/server/commands/calc-source-validation.test.ts` | UNIT (`node --test`) — 1 UNSKIPPED guard (real validators reachable; manual row accepted today) + 9 gated source-pair tests (both-or-neither, closed kind, UUID id, both-present accept, empty-string-dropped, update path) | 1 run + `{ skip: true }` (9 tests) | Dev Task 2.1 (`source_kind`/`source_id` on the validators + input type). |
| `tests/e2e/calculations/calculation-source-selection.e2e.spec.ts` | E2E (Playwright) — 5.3-E2E-01 (work role prefill + provenance), 5.3-E2E-02 (article prefill + provenance), 5.3-E2E-03 (manual row still saves), 5.3-E2E-04 (no supplier/import/deferred label), 5.3-E2E-05 (nav stays seven) | `test.describe.skip` (5 tests) | Dev Task 3 (RowEditor source `<select>` + prefill + provenance; page passes active lists) + a fixture seed of one active work role + article. |

**Verified state:** `pnpm typecheck` clean; `pnpm lint` clean (the single pre-existing warning is the
unrelated `tests/unit/lib/money/vat.test.ts`); the INT scaffold reports **1 file / 6 tests skipped**
(0 failed/errored); the `node --test` unit scaffold reports **1 pass / 9 skipped / 0 fail**; the E2E
scaffold **collects 5 tests under `test.describe.skip`** (proven via `--list` with a temporary stub
fixture, then the stub removed — the same top-level-fixture-read pattern the green 5.2 spec uses). The
scaffolds compile and register as red-phase pending without perturbing the green baseline.

### NOT created here (deliberate — see Step 3 rationale)

- **No new migration-reset assertions** for the `source_*_ore` bigint / no-supplier column-name
  discipline — the FROZEN `calc-tables-migration-reset.int.test.ts` guards already cover EVERY calc
  column and pick the new columns up automatically once the migration lands. Duplicating them here
  would be redundant coverage.
- **No migration, no `src/**` (validators/commands/read/RowEditor), no factory-body edit, no
  `TENANT_TABLES` edit, no fixture-seed edit, no `tsconfig`/`.env`/dependency change** — all DEV-phase
  / gated work. `nav-items.ts` untouched (stays seven); `src/lib/snapshots/**` +
  `src/server/snapshots/resolve-source.ts` untouched (CONSUME the 3.5 contract, do NOT edit);
  `src/lib/money/**` untouched (consume); the frozen 5.1 migration untouched.

### Dev-phase hand-off recipe (pin so the green transition is mechanical)

1. **Land the additive migration (Task 1):** `supabase/migrations/<ts>_calculation_row_pricing_source.sql`
   — `alter table public.calculation_rows add column` the nullable `source_kind text check (source_kind
   in ('work_role','article'))`, `source_id uuid`, `source_name text`, `source_price_ore bigint check
   (source_price_ore is null or source_price_ore >= 0)`, `source_cost_ore bigint check (... >= 0)`,
   `source_updated_at timestamptz`, `source_captured_at timestamptz`, `source_sku text`, `source_unit
   text`. KEEP every money column `_ore`-suffixed (both the bigint guard AND the inherited 5-1
   name-suffix guard key on it). Do NOT edit the frozen 5.1 migration; NO composite FK to
   `work_roles`/`articles` (a snapshot is copy-by-value — a live FK breaks the freeze). Then
   `supabase db reset` (+ poll `/auth/v1/health` to 200 before Vitest/Playwright — a false-green trap
   otherwise) → the frozen migration-reset guards stay green with the new columns.
2. **Extend the validators (Task 2.1):** add optional `source_kind: 'work_role'|'article'` +
   `source_id` (UUID) to `CreateRowInput`/`UpdateRowInput` + `validateCreateRow`/`validateUpdateRow`,
   both-or-neither, `isPresent('')===false` respected → remove the `{ skip: true }` options in
   `calc-source-validation.test.ts`, make GREEN.
3. **Extend the write path (Task 2.2):** in `createRow`/`updateRow.execute`, when the pair is present,
   `resolveSnapshotSource({ client: ctx.db, kind, sourceId })` → on `err` map to the typed
   `CommandError`; on `ok` call `buildWorkRoleSnapshot`/`buildArticleSnapshot` with `{ capturedAt:
   ctx.clock.now().toISOString() }`, then map the frozen fields onto `rowInsertValues`/`buildRowPatch`
   (`source_name` = displayName/name, `source_price_ore` = sellRateOre/unitPriceOre, `source_cost_ore`
   = costRateOre|null, `source_updated_at` = sourceUpdatedAt, `source_captured_at` = capturedAt,
   `source_sku`/`source_unit` for an article; a cleared source maps ALL `source_*` to null together)
   → remove `describe.skip` in `calculation-row-source.int.test.ts`, make GREEN.
4. **Land the read/UI (Task 3) + fixture seed:** extend the calc read `source_*` columns, pass active
   `readWorkRoles()`/`readArticles()` into `RowEditor`, add the `<select>` + `oreToKronorString`
   prefill + provenance line; seed one active work role + article for `adminA`'s tenant in the E2E
   global-setup and expose their names on `fixture.json` (`workRole.displayName` / `article.name`) →
   remove `test.describe.skip` in `calculation-source-selection.e2e.spec.ts`, make GREEN.

**TDD red-phase compliance check (Step 4C validation):**

- [x] All new INT/E2E suites use `describe.skip`/`test.describe.skip`; the unit source-pair tests use
      `node --test` `{ skip: true }` — none can fail CI before the dev migration + command extension +
      UI exist. (One UNSKIPPED unit GUARD runs green today to prove the real validator surface is
      reachable and the manual baseline is preserved.)
- [x] All assertions encode expected behaviour — no `expect(true).toBe(true)` placeholder. The freeze
      test asserts BEHAVIOUR (mutate+archive source after capture ⇒ row snapshot bytes unchanged).
- [x] Every command negative asserts the typed `TENANT_ACCESS_DENIED` MECHANISM AND a BYPASSRLS
      re-read that no foreign source id persisted — no vacuous empty-set/null disjunction.
- [x] Every UNIT rejection asserts `VALIDATION_FAILED` + `'data' in result === false` (no raw echo).
- [x] All scaffolds are expected-to-fail (the `source_*` columns, the resolve/build/persist path, the
      source-pair validators, and the RowEditor source affordance do not exist yet).
- [x] `pnpm typecheck` clean; `pnpm lint` clean; INT run = 6 skipped / 0 failed; unit run = 1 pass /
      9 skipped / 0 failed; E2E lists 5 tests under a skipped describe (green baseline unperturbed).

---

## Acceptance Criteria Coverage Summary

- **AC1** (work_role source captured by value — role id/name/cost+sell öre/updated_at/tenant, frozen;
  manual rows supported): `calculation-row-source.int.test.ts` 5.3-INT-01 (work_role) + the UNSKIPPED
  manual-baseline guard in `calc-source-validation.test.ts` (gated INT).
- **AC2** (article source captured — id/name/sku/unit/unit_price öre/updated_at; NO supplier/import
  field): `calculation-row-source.int.test.ts` 5.3-INT-01 (article, incl. a value-level
  no-supplier-token assertion) + the FROZEN migration-reset column-name guard for the schema half.
- **AC3** (freeze — the row stays explainable from its OWN captured fields even after the source is
  mutated/archived): 5.3-INT-02 (freeze proof — the headline behavioural test) + 5.3-INT-04
  (archived-source explainability), gated.
- **AC4** (source-selection write path routes ONLY through the extended 5.1 commands on the anon-key
  RLS client; cross-tenant source rejected at BOTH layers): 5.3-INT-03 (spoof on create AND update ⇒
  `TENANT_ACCESS_DENIED` + BYPASSRLS proof no foreign source persisted) + the source-pair validators
  (`calc-source-validation.test.ts`), gated.
- **AC5** (every new `source_*_ore` money column is bigint INTEGER ÖRE with a non-negative CHECK;
  ADDITIVE migration): covered by the FROZEN `calc-tables-migration-reset.int.test.ts` bigint-öre
  guard once the migration lands — pinned as the naming/additive-DDL discipline in the dev recipe (no
  duplicated suite).
- **AC6** (editor source affordance — select work role/article, prefill + provenance; manual saves; NO
  supplier/import/deferred label; nav stays seven): `calculation-source-selection.e2e.spec.ts`
  5.3-E2E-01/02/03/04/05, gated (mirrors the 5.2 template).

---

## Step 5 — Validation & Completion

**Validation checklist:**

- [x] Prerequisites assessed; the inherited foundation (snapshot contract/builders/resolver, 5.1 row
      commands + envelope + clock, 5.2 editor + money boundary, two-tenant fixture + pricing/calc
      seeds, frozen migration-reset guards) confirmed present — only the Story 5.3 migration + command
      extension + UI are absent, so scaffolds are gated on the dev phase (no HALT, no invented runner,
      no migration/`src` written here).
- [x] Test files created in the architecture-aligned tree (`tests/integration/commands/`,
      `tests/unit/server/commands/`, `tests/e2e/calculations/`), not scattered in UI/src modules (§22).
- [x] Checklist maps every AC (1-6) to a level + priority + test ID + risk + current status.
- [x] All tests designed to fail before implementation (red phase) and kept skipped (one unit guard
      runs green to prove reachability + the preserved manual baseline).
- [x] No browser/CLI sessions opened during authoring (the E2E is a static scaffold; `--list` used a
      temporary stub fixture that was removed — no orphaned browser, no artifact left behind).
- [x] Checklist stored under `{test_artifacts}/` (this file); scaffolds under `tests/`.
- [x] **No migration, no `src/**`, no factory-body edit, no `TENANT_TABLES` edit, no fixture-seed edit,
      no `tsconfig.json`, no `.env`, no dependency, no `nav-items.ts` change, no edit of the 3.5
      snapshot contract / resolver.** Verified — all are DEV-phase/gated.
- [x] Gate sweep on the scaffolds: `pnpm typecheck` clean, `pnpm lint` clean, INT = 6 skipped, unit =
      1 pass / 9 skipped, E2E lists 5 tests skipped — 0 failed/errored (green baseline unperturbed).

**Out of ATDD scope (dev-phase / other-story work — intentionally NOT scaffolded here):**

- The `source_*` additive migration, the row-command resolve+build+persist extension, the source-pair
  validators, the calc read + RowEditor source affordance, and the E2E fixture source seed (Story 5.3
  dev Tasks 1-3) — the scaffolds' green-phase counterparts (recipe above).
- The migration-reset `%_ore`-bigint + no-supplier-column-name assertions (already FROZEN and green —
  they cover the new columns automatically once the migration lands; do NOT duplicate).
- The calc GOLDEN pack incl. source-snapshot fixtures (Story 5.5 — `5.5-GOLDEN-01`); the readiness
  classifier + VAT-display posture + snapshot preview (Story 5.4); the money ARITHMETIC (Epic 4 pinned
  it — this story asserts capture/routing/provenance, not totals); the quote-version freeze (Epic 6).

**Key assumptions / risks:**

- **Command / input shapes** — the scaffolds assume `createRow`/`updateRow` accept an OPTIONAL
  `{ source_kind: 'work_role'|'article', source_id: uuid }` pair (the caller supplies ONLY kind+id;
  the name/rate/version are RESOLVED server-side, never trusted). If the dev phase chooses different
  literals, the input keys / assertion strings are the only edit — the behaviour contract (capture by
  value, freeze survives source mutation/archive, both-layers cross-tenant deny, manual stays
  first-class) is unchanged.
- **Persisted column names (Open Question 1)** — the scaffolds assume `source_price_ore` = the SELL
  rate (work role) / unit price (article) and `source_cost_ore` = the cost rate (work role, else
  null) — the conservative "capture both for margin explainability" default. If the owner wants
  sell-only, `source_cost_ore` and its two assertions drop; the rest stands.
- **Prefill authority (Open Question 2)** — the E2E asserts PREFILL-editable (the row price stays
  authoritative; the snapshot only explains provenance), matching "manual/free-text rows remain
  supported" + the row-price-authoritative money model. A LOCKED source-priced row is a materially
  different data model → a `needs-human` STOP, not a silent test rewrite.
- **Row-type → source mapping (Open Question 3)** — the E2E offers work-role selection on labor rows
  and article selection on material rows; the other three row types stay manual. The `source_kind`
  column supports either kind at the DB level, so extending the UI mapping later is additive.
- **Freeze is a DATA-LAYER guarantee** — the INT freeze proof mutates + archives the source via the
  BYPASSRLS admin path AFTER capture and re-reads the ROW's frozen columns; it does NOT re-read the
  live source (a live re-read would re-introduce the exact R-507 recompute risk the snapshot prevents).

## Next Steps (TDD Green Phase — Story 5.3 dev)

1. **Land the additive migration (Task 1)** → `supabase db reset` (+ health-poll) → the frozen
   migration-reset guards stay green with the new `source_*` columns.
2. **Extend the validators (Task 2.1)** → remove `{ skip: true }` in `calc-source-validation.test.ts`,
   make GREEN.
3. **Extend `createRow`/`updateRow` resolve+build+persist (Task 2.2/2.3/2.4)** → remove `describe.skip`
   in `calculation-row-source.int.test.ts`, make GREEN (the R-507 freeze + R-502 spoof proofs).
4. **Land the read + RowEditor source affordance (Task 3) + the E2E fixture source seed** → remove
   `test.describe.skip` in `calculation-source-selection.e2e.spec.ts`, make GREEN.
5. **Recommended follow-on workflows:** `*automate` after the schema + command + UI land to broaden
   coverage (e.g. the source-clear round-trip parser unit + the both-present margin-explainability
   read); `*trace` at the Epic 5 boundary for the traceability matrix + gate decision (and surface the
   two standing NFR concerns — dependency-scan gate + coverage reporter — as schedule-or-accept).

---

**Generated by:** BMad TEA Agent — `bmad-testarch-atdd` (Create mode) · TDD RED PHASE
