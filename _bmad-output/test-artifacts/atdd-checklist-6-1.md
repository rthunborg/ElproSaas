---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-07-05'
story_id: '6-1'
story_file: '_bmad-output/implementation-artifacts/6-1-quote-snapshot-schema-and-server-side-version-creation.md'
detected_stack: 'fullstack (this story = backend/data-layer only — no browser UI in 6.1)'
generation_mode: 'AI generation (no browser recording — 6.1 renders nothing customer-facing)'
tdd_phase: 'RED'
inputDocuments:
  - '_bmad-output/implementation-artifacts/6-1-quote-snapshot-schema-and-server-side-version-creation.md'
  - '_bmad-output/implementation-artifacts/test-design-epic-6.md (referenced via story)'
  - 'tests/integration/rls/calc-tables-migration-reset.int.test.ts (template)'
  - 'tests/integration/commands/calculation-parent-ownership.int.test.ts (template)'
  - 'tests/unit/lib/snapshots/build.test.ts + golden.test.ts (templates)'
  - 'tests/unit/features/calculations/calc-golden-pack.test.ts (origin-label template)'
  - 'tests/integration/rls/tenant-table-inventory.ts (H4 enrollment contract)'
  - '_bmad/tea/config.yaml, _bmad/bmm/config.yaml'
---

# ATDD Red-Phase Checklist — Story 6.1: Quote Snapshot Schema & Server-Side Version Creation

**Role:** Master Test Architect · **TDD phase:** RED (failing/dormant scaffolds authored before implementation)
**Stack:** backend / data-layer (Vitest INT+RLS against local Supabase; `node --test` pure UNIT + GOLDEN). No E2E/Playwright — 6.1 ships no UI.
**Generation mode:** AI generation from the story ACs + epic test design + proven in-repo templates (no browser recording).

---

## 1. Acceptance criteria → test mapping

| AC | Behavior | Level | Priority | Scaffold(s) | Test-design id |
| --- | --- | --- | --- | --- | --- |
| AC1 | Six new tenant-owned tables created on reset with tenant ownership, composite same-tenant FKs, lifecycle/immutable fields, enable+force RLS + own-tenant policies + anon→none GRANTs; NO Fortnox/invoice/portal/external-mapping tables | INT (migration reset) | P0 | `quote-tables-migration-reset.int.test.ts` | 6.1-INT-01 |
| AC1 | Per-table cross-tenant read/write + anon-DML-empty negatives; H4 gate green | RLS (via `TENANT_TABLES`) | P0 | **dev-phase enrollment** (see §4) | 6.1-RLS-01/02 |
| AC2 | Foreign calculation id AND foreign attachment/file id → `TENANT_ACCESS_DENIED` | INT (command) | P0 | `quote-version.int.test.ts` | 6.1-INT-02 |
| AC2 | Snapshot captures the FULL §11 checklist incl. FULL company identity + terms sign-off + warnings + source refs | INT (command) | P0 | `quote-version.int.test.ts` | 6.1-INT-03 |
| AC2 | BEHAVIORAL FREEZE — mutate every source class after creation → snapshot byte-unchanged | INT (command) | P0 | `quote-version.int.test.ts` | 6.1-INT-04 |
| AC2 | Pure builder: copy-by-value + deep Object.freeze + injected clock + capture-not-compute + verbatim terms | UNIT (`node --test`) | P0 | `quote-snapshot/build.test.ts` | 6.1-UNIT-01 |
| AC2 | Öre discipline (canonical `isOreAmount`, integer öre, bp VAT) + internal-exclusion (no cost/margin/internal_note in customer-visible lines) | UNIT | P0/P1 | `quote-snapshot/build.test.ts` | 6.1-UNIT-02, 6.2-UNIT-01 (R-607) |
| AC2 | Snapshot content golden pack (origin-labelled, anonymized shape-only) + fixture PII/secret scan | GOLDEN (`node --test`) | P0 | `quote-snapshot/golden-pack.test.ts` + fixture | 6.1-GOLDEN-01, 6.x-UNIT-01 (R-615) |
| AC3 | Concurrent creations → unique tenant-scoped numbers inside the RPC txn; tenant B independent; atomic rollback | INT (concurrency, `Promise.all`, sleep-free) | P0 | `quote-version.int.test.ts` | 6.1-INT-05 |
| AC2/AC3 | Append-only audit row with allow-listed `{ targetId }` metadata only | INT (command) | P1 | `quote-version.int.test.ts` | 6.1-INT-06 |
| AC3 | Quote-number DISPLAY format recorded as an open owner question (allocation model unaffected) | DOCS | P2 | **dev-phase note** (see §4) | 6.1-DOCS-01 |

Red-phase requirement confirmed: every scaffold asserts EXPECTED post-implementation behavior and is dormant (skipped/gated) until the migration + RPC + command + pure builder land. No scaffold passes vacuously — the pure/golden guards that CAN run today (schema, labelling, privacy) run GREEN now over the committed fixture.

---

## 2. Scaffolds authored (files created)

| File | Kind | Red-phase mechanism | Verified |
| --- | --- | --- | --- |
| `tests/integration/rls/quote-tables-migration-reset.int.test.ts` | Vitest INT | `describe.skip` (project idiom; dev un-skips + relabels "green") | Collects + skips cleanly (13 tests) |
| `tests/integration/commands/quote-version.int.test.ts` | Vitest INT | `describe.skip` × 5 blocks; `expect.fail` bodies + TODO(dev) markers; command import commented until Task 3.2 | Collects + skips cleanly (11 tests) |
| `tests/unit/lib/quote-snapshot/build.test.ts` | `node --test` UNIT | `RED_PHASE` boolean gate (`if (RED_PHASE) return`) + one always-on meta assertion | Runs green (gated assertions dormant) |
| `tests/unit/lib/quote-snapshot/golden-pack.test.ts` | `node --test` GOLDEN | Schema/labelling/PRIVACY guards live NOW; behavioral-golden gated by `RED_PHASE` | Runs green (5 live guards pass) |
| `tests/fixtures/golden/snapshots/quote-version-source.json` | Fixture (data) | Anonymized shape-only; origin-labelled (`new-expected`); every öre < 10 digits | Loaded + privacy-scanned green |

Verification run:
- `pnpm test:unit` scope (`tests/unit/lib/quote-snapshot/**`): **14 pass, 0 fail**.
- `vitest run` scope (both new INT files): **24 skipped, 0 fail** (red-phase dormant).
- `tsc --noEmit`: **exit 0** (whole project typechecks with the new scaffolds).

---

## 3. Design decisions & rationale

- **Red-phase idiom per runner.** Vitest DB-backed suites use `describe.skip` (the exact Story 3.1/5.1 precedent) so the green tree is preserved; the dev phase removes `.skip`. `node --test` has no skip-that-stays-green for an unresolved import, so the pure/golden scaffolds use a `RED_PHASE` boolean gate + commented imports — the intended assertions stay visible and reviewable, and the fixture PRIVACY scan is LIVE from day one to protect the committed fixture.
- **The behavioral FREEZE (6.1-INT-04) is the headline proof** and is scaffolded as MUTATE-then-re-read, not field-exists — matching the three-epic precedent the story flags as load-bearing.
- **Numbering (6.1-INT-05) is a CONCURRENCY test** (`Promise.all`, sleep-free) plus an atomic-rollback case — never a unit test, never timing-based.
- **Golden pack: every case is `origin: "new-expected"`** (no anonymized Lovable quote oracle exists yet). The labelling guard FAILS a fabricated `old-lovable` origin and REQUIRES a `documented-delta` to carry its old value — so an Epic-9 real delta lands without a code-shape change. Numbers REFERENCE the existing per-category money fixtures (single numeric authority) and re-pin nothing.
- **Privacy scan corrected during authoring:** UUID placeholder ids and the dummy `556000-NNNN` orgnr shape are scrubbed before the personnummer regex; the scan runs over the DATA `cases` (not the meta `_comment`, which legitimately names the scanned classes). Fixture emails are constrained to `*.test`.

---

## 4. Dev-phase handoff — intentionally deferred to implementation (NOT authored as red scaffolds)

These are dev-phase obligations that CANNOT be pre-authored as red scaffolds without breaking the green tree (they require the migration/types to exist first). They are called out here so the dev phase does not miss them:

- [ ] **H4 enrollment (6.1-RLS-01/02) — `TENANT_TABLES` extension.** Enroll all SIX new tables (incl. the easy-to-forget `tenant_counters`) in `tests/integration/rls/tenant-table-inventory.ts` with BOTH metadata seams (cross-tenant `spoofedRowFor`/`tenantBFilter`/`hijackMutationFor` + anon-path `anonRowFor`/`anonFilterFor`/`anonMutationFor`) and extend the `switch(table)`/`assertNever`. NOT pre-scaffolded: the `assertNever` exhaustiveness would make a half-enrolled table a TYPECHECK error (red tree) the moment a table string is added without the migration. The shared cross-tenant + anon suites + the H4 gate then run the per-table negatives automatically — do NOT hand-write ad-hoc isolation tests. The H4 gate will fail-loud the moment the migration lands until enrollment is complete — that is EXPECTED.
- [ ] **`migration-reset.int.test.ts` EXACT-policy enumeration extension.** Add the six new tables × SELECT/INSERT/UPDATE (NO DELETE) to the EXACT expected policy set + the exists/RLS-forced checks. Keep it EXACT — never loosen to a superset. Assert deferred-table ABSENCE there too.
- [ ] **Two-tenant factory seeds.** Extend `tests/factories/tenants.ts` with quote/version/line/attachment/event/counter insert+readback helpers so the cross-tenant negatives point at REAL Tenant-B parents (never vacuous). The `quote-version.int.test.ts` scaffold's `beforeAll` already assumes `adminInsertCalculation`/`adminInsertCustomer` (exist) + TODO markers for the new seeds.
- [ ] **6.1-DOCS-01.** Record the quote-number DISPLAY format as an open owner question (architecture §24). The allocation model (server-side tenant-scoped integer counter) is unaffected; a display-format demand that requires a schema change is a STOP → `needs-human`.
- [ ] **Un-skip / flip on implementation.** Remove `describe.skip` from the two INT files (relabel "green"); flip `RED_PHASE = false` in both `node --test` scaffolds and wire the real `@/lib/quote-snapshot/build` + `@/server/commands/quotes` imports; fill the TODO(dev) bodies; add the frozen `expectedSnapshot` to each golden case.

---

## 5. Local execution reminders (from the story)

- DB-backed suites run against the LOCAL Supabase CLI stack ONLY. After `supabase db reset`, **poll `/auth/v1/health` to 200** before Vitest (Kong→GoTrue 502s ~10s and SILENTLY SKIPS DB-backed suites — a false green that would hide the migration-reset + freeze + numbering proofs). CI (`SUPABASE_TEST_REQUIRED=1`) fails hard.
- Raw `pg` pool readbacks: coerce `bigint` öre (`Number(...)`) and `timestamptz` (`.toISOString()`); seed per-run unique ids (`crypto.randomUUID()`) for count assertions.
- Golden runner-glob trap: quote goldens live under `tests/unit/**` (done), NEVER `tests/golden/**`.

---

## Summary

10 test-design ids covered: 8 as authored red-phase scaffolds (6.1-INT-01/02/03/04/05/06, 6.1-UNIT-01/02+6.2-UNIT-01, 6.1-GOLDEN-01+6.x-UNIT-01) across 5 new files; 2 explicitly handed to the dev phase (6.1-RLS-01/02 H4 enrollment, 6.1-DOCS-01) because pre-authoring them would break the green tree before the migration exists. All authored scaffolds verified: unit green (14/14), INT skip-clean (24/24), typecheck exit 0.
