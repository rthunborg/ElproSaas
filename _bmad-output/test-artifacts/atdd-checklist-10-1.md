---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
  - 'step-04c-aggregate'
lastStep: 'step-04c-aggregate'
lastSaved: '2026-07-19'
inputDocuments:
  - _bmad-output/implementation-artifacts/10-1-phase-b-governance-re-baseline-and-scope-manifest.md
  - _bmad/tea/config.yaml
  - src/features/calculations/readiness.ts
  - src/features/files/deferred-categories.ts
  - src/components/app-shell/nav-items.ts
  - src/server/commands/files/validation.ts
  - tests/integration/rls/tenant-table-inventory.ts
  - tests/unit/guardrails/job-non-scope.test.ts
  - tests/unit/docs/acceptance-gate-report-validators.test.ts
  - .claude/agents/phase-scope-reviewer.md
  - .codex/agents/phase-scope-reviewer.toml
  - .claude/settings.json
---

# ATDD Checklist: Story 10.1 — Phase B Governance Re-Baseline and Scope Manifest

## Preflight & Context (Step 1)

- **Stack detected:** `fullstack` (Next.js + Supabase), but Story 10.1 is a **pure-TS unit-test**
  story — no DB schema, no migration, no HTTP API surface, no browser UI. The acceptance surface is
  the `tests/unit/scope/` node:test suite the story's Testing Requirements mandate.
- **Test framework:** `node --test` with `--experimental-strip-types` + the `@/*` alias hook
  (`tests/support/register.mjs` → `alias-hook.mjs`), run via `pnpm test:unit`
  (glob `tests/unit/**/*.test.ts`). `@/scope/*` resolves through the existing `@/* → src/*` mapping —
  no new alias needed for tests (dev-story confirms the tsconfig `paths` entry).
- **Prerequisites:** story approved (`ready-for-dev`) with clear AC1–AC4; framework present. PASS.

## Generation Mode (Step 2)

- **Mode:** AI generation from the story spec + the current source of the four authored guardrail
  copies (deny-list, nav-items, tenant-table inventory, phase-scope-reviewer) and the proven
  `READINESS_CODES` `satisfies`-guard pattern. **No browser recording** — there is no UI in scope.
- **Skill adaptation (recorded):** the ATDD skill's Step 4 dispatches Playwright **API + E2E**
  red-phase workers. That split is inapplicable to a pure-TS-unit story with no HTTP/browser surface,
  so the equivalent red-phase acceptance scaffolds were authored directly as `node:test` unit suites
  (the project's own guardrail convention — see `tests/unit/guardrails/*-non-scope.test.ts`).

## Test Strategy (Step 3) — AC → level → priority

| AC | Scenario | Level | Priority | Red mechanism |
| --- | --- | --- | --- | --- |
| AC2 | Typed manifest shape; Phase A active set = 7 nav / 24 tables / 7 owner types; every Phase B module pending; public surfaces ≤ 3; cross-module uniqueness | Unit | P0 | `@/scope/manifest` absent → import throws |
| AC4 | Coherence validator: positive (real manifest coherent) + one biting negative per rule (missing epic; orphan nav/table/widget; pending w/ live surface; public surface > 3); EB-A5 matrix-row rule NOT implemented | Unit | P0 | `@/scope/manifest-schema` absent → import throws |
| AC3 | Four derivations reproduce PINNED Phase-A literals (deny-list 7 tokens, nav 7 routes, tenant 24 tables) + fail-loud (unlisted surface never admitted) | Unit | P0 | `@/scope/manifest` + `@/scope/nav-registry` selectors absent |
| AC1 | Governance docs re-baselined to Phase B + manifest reference; frozen "Phase A" enforcement statements gone; deny-set/hook NOT weakened (stop-condition guard) | Unit (docs scan) | P1 | AGENTS.md/CLAUDE.md/reviewer still say Phase A |

Non-circular grounding applied throughout (Dev Notes "circular-derivation trap"): every derivation is
proven equal to an **independent** pinned Phase-A literal (and the still-authored `navItems` /
`FORBIDDEN_DEFERRED_CATEGORIES` live exports), never against another manifest-derived value.

## TDD Red Phase — status

Suite run (`node --test tests/unit/scope/**/*.test.ts`): **26 tests — 24 fail (RED), 2 pass (standing guards).**

The 2 intentionally-green tests are NOT AC targets — they are grounding/safety guards that must stay
green before AND after implementation:

- `10.1-DOCS-05` — Stop-Condition guard: `.claude/settings.json` deny set unweakened.
- `10.1-UNIT-DERIVE-02` — grounding pin: the LIVE `FORBIDDEN_DEFERRED_CATEGORIES` export equals the
  pinned 7 tokens (no-drift anchor; stays green across the refactor).

All 24 AC-bearing tests are red because `src/scope/manifest.ts`, `src/scope/manifest-schema.ts`, and
`src/scope/nav-registry.ts` do not exist yet, and the governance docs still declare Phase A. This is
the intended red state — no `.skip`, no placeholder assertions (each asserts the real AC contract).

### Generated files (all RED except the two standing guards)

- `tests/unit/scope/manifest-shape.test.ts` — AC2 + Task 1.3 uniqueness (8 tests)
- `tests/unit/scope/manifest-coherence.test.ts` — AC4 positive + biting negatives + EB-A5 carve-out (7 tests)
- `tests/unit/scope/manifest-derivations.test.ts` — AC3 four derivations + fail-loud (6 tests)
- `tests/unit/scope/governance-rebaseline.test.ts` — AC1 docs re-baseline + stop-condition guard (5 tests)

## Acceptance Criteria Coverage

- **AC1** — covered by `governance-rebaseline.test.ts` (DOCS-01..04 red; DOCS-05 guard green).
- **AC2** — covered by `manifest-shape.test.ts` (SHAPE-01..08).
- **AC3** — covered by `manifest-derivations.test.ts` (DERIVE-01..06); grounding pin DERIVE-02 green.
- **AC4** — covered by `manifest-coherence.test.ts` (COH-00 positive, COH-01..05 negatives, COH-06 EB-A5 carve-out).

## Next Steps (TDD Green Phase — dev-story)

1. Create `src/scope/manifest-schema.ts` (types + `validateManifestCoherence` + the pure selectors
   `activeModules` / `pendingModules` / `navRoutesFromManifest` / `tenantTablesFromManifest` /
   `deferredFileTokensFromManifest` the scaffolds import).
2. Create `src/scope/manifest.ts` (`SCOPE_MANIFEST`, `satisfies ScopeManifest`-guarded; Phase A
   active partition per the story's verified 24/7/7 table).
3. Create `src/scope/nav-registry.ts` (`EXPECTED_NAV_ROUTES` derived from the manifest).
4. Refactor the four consumers to derive from the manifest (`deferred-categories.ts`,
   nav guardrail expected set, H4 `TENANT_TABLES`, the deferred-token scans).
5. Re-baseline `AGENTS.md`, `CLAUDE.md`, `.claude/agents/phase-scope-reviewer.md` +
   `.codex/agents/phase-scope-reviewer.toml`, `docs/process/*` to Phase B + the manifest (Task 7),
   WITHOUT weakening the deny set / hook and WITHOUT editing historical/record docs (Task 7.4).
6. Run `pnpm test:unit` → the 24 red tests go green (the 2 guards remain green). Then the DB-backed
   H4 inventory + RLS suites (need the local Supabase stack) to confirm the derived `TENANT_TABLES`
   equals the live 24-table schema.

## Implementation Guidance — intended contract the scaffolds pin

- `validateManifestCoherence(manifest) => CoherenceViolation[]` with `rule` values:
  `active-module-missing-epic`, `orphan-surface`, `pending-module-live-surface`,
  `public-surface-exceeds-closed-set`, plus `duplicate-surface` (uniqueness). **Do NOT** implement
  `active-module-missing-permission-matrix` (EB-A5 → Story 11.1).
- Pinned Phase-A literals the derivations must reproduce (order-insensitive):
  - deny tokens: `fortnox, supplier, asset, rental, hr, dou, upphandling`
  - nav routes: `/dashboard, /customers, /calculations, /quotes, /jobs, /files, /settings`
  - file owner types: `customer, facility, contact, calculation, quote_version, quote_acceptance, job`
  - 24 tenant tables: the exact `TENANT_TABLES` set in `tests/integration/rls/tenant-table-inventory.ts`.
