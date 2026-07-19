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
  - _bmad-output/implementation-artifacts/10-2-forlorad-avbojd-status-and-lost-reason-lifecycle.md
  - _bmad/tea/config.yaml
  - src/features/quotes/lifecycle.ts
  - src/features/quotes/timeline.ts
  - src/components/quotes/status.ts
  - tests/unit/features/quotes/lifecycle-transition.test.ts
  - tests/unit/components/quotes/status.test.ts
  - tests/unit/server/commands/mark-quote-version-sent-validation.test.ts
  - tests/unit/features/quotes/accept-quote-to-job-golden.test.ts
  - tests/integration/commands/mark-quote-version-sent.int.test.ts
  - tests/integration/rls/acceptance-tables-migration-reset.int.test.ts
  - tests/integration/rls/tenant-table-inventory.ts
  - tests/integration/commands/pricing-commands.int.test.ts
  - tests/e2e/quotes/quote-sent-lock.e2e.spec.ts
---

# ATDD Checklist: Story 10.2 — Förlorad/Avböjd Status and Lost-Reason Lifecycle

## Preflight & Context (Step 1)

- **Stack detected:** `fullstack` (Next.js + Supabase). Story 10.2 spans FOUR test surfaces — pure TS
  (transition token + reason validator), DB-backed migration/RPC/RLS, an insert-only RLS negative, and
  one browser dialog — so the two-runner + Playwright split ALL apply, per surface.
- **Test framework:** already configured (no framework setup needed) —
  - `node --test` + `--experimental-strip-types` + the `@/*` alias hook
    (`tests/support/register.mjs`), run via `pnpm test:unit` (glob `tests/unit/**/*.test.ts`);
  - Vitest (`pnpm test:int`, `vitest run`) for DB-backed INT/RLS against the LOCAL Supabase stack;
  - Playwright (`pnpm test:e2e`) for the dialog E2E.
- **Prerequisites:** story approved (`ready-for-dev`) with clear AC1–AC5; frameworks present. PASS.

## Generation Mode (Step 2)

- **Mode:** AI generation from the story spec + the mirrored source/test patterns
  (`lifecycle.ts`/`status.ts`/`timeline.ts`, the 6.4/6.5 mark-sent + lifecycle tests, the 7.1
  migration-reset scaffold, the 3.4 command red-phase scaffold, the 6.4 e2e spec). **No browser
  recording** — the dialog surface does not exist yet (Task 5 is dev); recording a non-existent surface
  is out of scope (task directive: do NOT force Playwright workers for surfaces that don't exist).
- **Skill adaptation (recorded):** the ATDD skill's Step 4 dispatches Playwright **API + E2E**
  red-phase workers. That split is wrong for this repo's **two-runner discipline** (epic-10 retro,
  Story 10-1 Phase-4): pure-logic red scaffolds land on `node:test` under `tests/unit/**`; DB-backed
  integration/RLS red scaffolds land on Vitest under `tests/integration/**`; only the dialog is
  Playwright E2E (authored as a skipped scaffold — no live worker). The scaffolds were therefore
  authored directly following the project's own red-phase idiom (`describe.skip` / `it.skip` +
  `{ skip }`, real contract assertions, local `notYetImplemented()`/introspection so files type-check
  today without importing unimplemented modules).

## Test Strategy (Step 3) — AC → level → priority

| AC | Scenario | Level | Priority | Test ID | Red mechanism |
| --- | --- | --- | --- | --- | --- |
| AC2 | `lost` token coherent across the PURE layers: `sent→lost` legal, `lost` terminal, no other transition changed, union admits `lost`, badge label "Förlorad/Avböjd" with a color DISTINCT from accepted green, read-only | Unit (node:test) | P0 | 10.2-UNIT-01 | `lost` absent from map/union/labels → assertions fail (skipped) |
| AC1 | Reason validator: outcome∈{forlorad,avbojd}, category∈strawman, note required (trimmed) on `annat`, uuid-shaped id, never echoes raw values, strips server-owned keys | Unit (node:test) | P0 | 10.2-UNIT-02 | `validateMarkQuoteVersionLost` absent (local placeholder) |
| AC2/AC3 | Golden: lost version = append-only `lost` event + one reason; sent snapshot byte-unchanged; anonymized, no PII, öre < 10 digits | Unit/Golden (node:test) | P1 | 10.2-GOLDEN-01 | fixture not authored (guarded read → empty; skipped) |
| AC2/AC3/AC5 | Migration reset: table shape + composite same-tenant FKs + `unique(quote_version_id)` + insert-only (SELECT+INSERT policies/grants ONLY, no UPDATE/DELETE) + status/event_type CHECKs widened with `lost` + `mark_quote_version_lost` RPC (SECURITY INVOKER) | Integration (Vitest) | P0 | 10.2-INT-04 | migration absent → introspection empty (skipped) |
| AC1/AC2/AC3/AC5 | Command+RPC: one-txn flip status-only + one event + one reason + one audit (`{targetId}` only); status-only before/after read (closes 6-5 gap); illegal transition rejected at command (VALIDATION_FAILED) AND DB belt (QV409→QUOTE_VERSION_LOCKED); duplicate/double-submit → unique; cross-tenant → TENANT_ACCESS_DENIED | Integration (Vitest) | P0 | 10.2-INT-01/02/03/05/06 | command+RPC absent (local placeholder) |
| AC5 | Insert-only enforcement: own-tenant authenticated UPDATE/DELETE of a reason row REJECTED (byte-unchanged) | RLS (Vitest) | P0 | 10.2-RLS-01 | table absent (skipped); cross-tenant/anon come from TENANT_TABLES enrolment |
| AC1/AC2/AC4 | Dialog requires outcome + structured reason (note-on-Annat), confirm copy (append-only / snapshot-unchanged / revive-via-new-version), terminal badge distinct from Accepterad, reason on card + in Händelser, list status-filter + Förlustorsak column | E2E (Playwright) | P1 | 10.2-E2E-01 | dialog surface + fixture absent (skipped) |

**Deliberate non-duplication:** the DB layers of the 5-layer widening (status/event_type CHECKs, the
sent-lock trigger allow-set, the RPC guard) are pinned in 10.2-INT-04/03 — NOT re-asserted in the pure
UNIT layer. The full sent-immutability regression suite (10.2-INT-01 headline) is a **re-run** of the
existing Epic 6/7 suite (`mark-quote-version-sent.int.test.ts`), extended in green with the lost path +
the PDF-column before/after read — do NOT fork it. Cross-tenant read/write + anon for
`quote_lost_reasons` come from **enrolment** in `tenant-table-inventory.ts` (Task 2.2), not a
hand-written parallel suite; the RLS scaffold pins only the distinctive insert-only negative.

## Red Phase Generation (Step 4 / 4C) — files written

All suites are **skipped** (red phase) and assert EXPECTED behaviour (no placeholder assertions). Each
file type-checks today (local `notYetImplemented()` / introspection avoids importing unimplemented
modules) and carries a GREEN-PHASE HAND-OFF block. TDD red-phase compliance: verified.

| Test ID(s) | File | Runner |
| --- | --- | --- |
| 10.2-UNIT-01 | `tests/unit/features/quotes/lost-transition-coherence.test.ts` | node:test |
| 10.2-UNIT-02 | `tests/unit/server/commands/mark-quote-version-lost-validation.test.ts` | node:test |
| 10.2-GOLDEN-01 | `tests/unit/features/quotes/lost-version-golden.test.ts` | node:test |
| 10.2-INT-04 | `tests/integration/rls/quote-lost-reasons-migration-reset.int.test.ts` | Vitest |
| 10.2-INT-01/02/03/05/06 | `tests/integration/commands/mark-quote-version-lost.int.test.ts` | Vitest |
| 10.2-RLS-01 | `tests/integration/rls/quote-lost-reasons.rls.test.ts` | Vitest |
| 10.2-E2E-01 | `tests/e2e/quotes/quote-lost-reason.e2e.spec.ts` | Playwright |
| infra | `.gitattributes` (golden-fixtures `*.json text eol=lf` pin — epic-10 retro gotcha) | — |

**Verification run (this step):**
- `node --test` (the 3 unit/golden files): 3 suites, **0 fail, all skipped**.
- `vitest run` (the 3 int/rls files): **20 skipped, 0 fail**.
- `tsc --noEmit`: **exit 0** (whole project, scaffolds included).
- `eslint` (all 7 files): **0 errors**.

## Acceptance Criteria Coverage

- **AC1** (dialog outcome + structured reason, note-on-Annat, confirm copy) → 10.2-UNIT-02 (validator)
  + 10.2-E2E-01 (dialog). Covered.
- **AC2** (append-only flip: status-only + one event + one reason + terminal badge distinct from
  Accepterad) → 10.2-UNIT-01 (badge/token) + 10.2-INT-02 (one-txn) + 10.2-GOLDEN-01 + 10.2-E2E-01. Covered.
- **AC3** (sent-immutability preserved; flip is status-only) → 10.2-INT-01 (before/after all
  customer-visible + PDF columns) + 10.2-GOLDEN-01 (sent snapshot byte-unchanged). Covered. NOTE: the
  headline is a RE-RUN of the existing sent-immutability suite — green phase extends that suite, does
  not fork it.
- **AC4** (list Förlorad/Avböjd filter value + Förlustorsak column) → 10.2-E2E-01 (list). Covered
  (UI-level; the list read-model beyond this is Story 10.4, out of scope).
- **AC5** (cross-tenant isolation + insert-only) → 10.2-INT-06 (cross-tenant command) + 10.2-INT-04
  (insert-only policies/grants) + 10.2-RLS-01 (own-tenant UPDATE/DELETE rejected) + TENANT_TABLES
  enrolment (cross-tenant/anon shared suites). Covered.

## Next Steps (TDD Green Phase — Story 10.2 dev)

Per file, the GREEN-PHASE HAND-OFF header block is authoritative. In summary:
1. Land Task 1 migration (`quote_lost_reasons` + insert-only RLS + status/event_type CHECK widening +
   sent-lock allow-set + `mark_quote_version_lost` RPC), then **remove `.skip`** on 10.2-INT-04 and
   **extend `migration-reset.int.test.ts`** with the two new SELECT/INSERT policies (keep the
   enumeration EXACT — never a superset).
2. Land Task 2 (manifest enrolment 24→25 + `TENANT_TABLES` enrolment with an **insert-only** mutation
   profile). This is what makes 10.2-RLS-01's own-tenant-UPDATE-rejected pass and the H4 gate green.
3. Land Task 3 (widen `LEGAL_TRANSITIONS`/union/labels) → drop the `LOST` cast in 10.2-UNIT-01
   (a bare `"lost"` literal then satisfies the union); remove `{ skip }`.
4. Land Task 4 (validator + command + RPC call) → replace the `notYetImplemented()` placeholders with
   real imports in 10.2-UNIT-02 + the command INT; remove `{ skip }`/`.skip`.
5. Land Task 5 (dialog + action + card/list surfacing) + extend `global-setup.ts` with a
   `markLostQuote` sent version on `fixture.json`; remove `.skip` on 10.2-E2E-01.
6. Author `tests/fixtures/golden/quotes/lost-lifecycle.json` (anonymized, no PII); the
   `.gitattributes` LF pin is already in place; remove `{ skip }` on 10.2-GOLDEN-01.
7. Run against a freshly `supabase db reset` LOCAL stack (`SUPABASE_TEST_REQUIRED=1` in CI hard-fails
   on an unreset/unreachable stack — the post-reset false-green trap).

Every assertion is the CONTRACT — do NOT weaken them when removing the skips.

## Key Risks / Assumptions

- **Settled design honored:** the ONE-new-`lost`-token model (Förlorad-vs-Avböjd stored only in
  `quote_lost_reasons.outcome`) is baked into every scaffold. A different token model is out of scope
  (story ⚑) — the scaffolds would need re-authoring if that decision is reversed (a story STOP).
- **DB-layer rejection of an illegal lost transition** (10.2-INT-03 belt) is proven via the RPC's
  `assert v_status='sent'` (a double-lost → QV409→QUOTE_VERSION_LOCKED), NOT via a raw-SQL forward
  transition (the sent-lock trigger's allow-set intentionally admits `lost` for the legal `sent→lost`
  move, so a raw accepted→lost is not the DB proof point). The command guard is the primary rejection.
- **Two-runner discipline maintained:** no Playwright worker was spun up for the not-yet-existing
  dialog; the E2E is a skipped scaffold only. Pure-TS assertions stay on `node:test`, not the E2E gate.

## Recommended next workflow

`bmad-dev-story` for Story 10.2 (implement Tasks 1–6, un-skip each suite as its surface lands). After
green, optionally `bmad-testarch-trace` to refresh the epic-10 traceability matrix.
