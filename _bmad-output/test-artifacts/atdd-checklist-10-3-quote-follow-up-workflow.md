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
  - _bmad-output/implementation-artifacts/10-3-quote-follow-up-workflow.md
  - _bmad/tea/config.yaml
  - tests/unit/server/commands/mark-lost-validation.test.ts
  - tests/unit/features/quotes/view-model.test.ts
  - tests/integration/rls/quote-lost-reasons-migration-reset.int.test.ts
  - tests/integration/commands/mark-quote-version-lost.int.test.ts
  - tests/integration/rls/quote-lost-reasons.rls.test.ts
  - tests/integration/rls/tenant-table-inventory.ts
  - tests/e2e/quotes/quote-lost-reason.e2e.spec.ts
  - src/server/commands/envelope.ts
  - tests/factories/tenants.ts
  - tests/factories/audit-events.ts
---

# ATDD Checklist: Story 10.3 — Quote Follow-Up Workflow

**Date:** 2026-07-19
**Author:** Rasmus (TEA)
**Primary Test Level:** split — pure UNIT (node:test) + DB-backed INT/RLS (Vitest) + one dialog E2E (Playwright)

## Story Summary

Ships the MANUAL quote follow-up workflow: plan / see / complete follow-ups on sent quotes so open
deals get worked and decided instead of going stale. New tenant table `quote_follow_ups` (UPDATE-able,
one-open-per-quote via a partial unique index), three envelope commands (plan / complete / annotate, NO
RPC), the plan dialog + completion sheet with the decide-here jumps + auto-complete-on-lost seam, the
next-follow-up chip, list filters, overdue badge, and a pure Europe/Stockholm due/overdue classifier.

**As a** Säljare **I want** to plan, see, and complete follow-ups on sent quotes **so that** open deals
get decided rather than silently going stale.

## Preflight & Context (Step 1)

- **Stack detected:** `fullstack` (Next.js + Supabase). Story 10.3 spans FOUR test surfaces — pure TS
  (Stockholm due/overdue + chip selection + 3 validators), DB-backed migration/commands, an
  updatable-table RLS profile, and one dialog/sheet/chip surface — so the two-runner + Playwright split
  ALL apply, per surface.
- **Test framework:** already configured (no framework setup needed) —
  - `node --test` + `--experimental-strip-types` + the `@/*` alias hook (`tests/support/register.mjs`),
    run via `pnpm test:unit` (glob under `tests/unit`);
  - Vitest (`pnpm test:int`) for DB-backed INT/RLS against the LOCAL Supabase stack;
  - Playwright (`pnpm test:e2e`) for the dialog/sheet E2E.
- **Prerequisites:** story approved (`ready-for-dev`) with clear AC1–AC4; frameworks present. PASS.

## Generation Mode (Step 2)

- **Mode:** AI generation from the story spec + the mirrored 10.2 source/test patterns (the lost
  validator/command/migration-reset/RLS/e2e scaffolds, the 6.2 pure view-model unit). **No browser
  recording** — the dialog/sheet/chip surfaces do not exist yet (Task 5 is dev); recording a
  non-existent surface is out of scope.
- **Skill adaptation (recorded — same as 10.2):** the ATDD skill's Step 4 dispatches Playwright API +
  E2E red-phase workers. That split is wrong for THIS repo's two-runner discipline (epic-10 retro,
  10-1 Phase-4) and was OVERRIDDEN by the task's ratified repo conventions: pure-logic red scaffolds on
  `node:test` under `tests/unit`; DB-backed integration/RLS on Vitest under `tests/integration`; only
  the dialog on Playwright under `tests/e2e` as a skipped scaffold. Scaffolds were authored directly
  following the project's own red-phase idiom (collect-and-skip; local `notYetImplemented()` /
  introspection so files type-check today without importing unimplemented modules; the `markdown-glob
  in JSDoc` gotcha avoided — no `*/`-forming sequences inside block comments).

## Test Strategy (Step 3) — AC → level → priority

| AC | Scenario | Level | Priority | Test ID | Red mechanism |
| --- | --- | --- | --- | --- | --- |
| AC2 | Europe/Stockholm due/overdue classification over an injected instant (due-today, just-overdue, upcoming, the after-midnight-Stockholm boundary, determinism/no-Date.now) | Unit (node:test) | P0 | 10.3-UNIT-01 | `follow-up-dates.ts` absent → local `notYetImplemented()` placeholder (skipped) |
| AC1/AC2 | next-follow-up chip + overdue-badge selection (single open picked; empty/all-completed → null; overdue/due-today/completed chip state) | Unit (node:test) | P1 | 10.3-UNIT-02 | `follow-up-view.ts` absent (placeholder; skipped) |
| AC1/AC3 | plan/complete/annotate input validators (uuid ids, ISO due_date, required outcome, bounded notes, server-owned keys stripped, never echo raw) | Unit (node:test) | P0 | 10.3-UNIT (validators) | validators absent (placeholder; skipped) |
| AC1/AC3/AC4 | migration reset: table shape + composite same-tenant FKs + **partial unique index (quote_id) WHERE status='open'** + fail-closed completed-shape CHECK + force RLS + EXACTLY SELECT+INSERT+UPDATE policies (NO DELETE) + SELECT+INSERT+UPDATE grant (NO delete) + anon none + scope guards (no money/notification/updated_at) | Integration (Vitest) | P0 | 10.3-INT-02 | migration absent → introspection empty (describe.skip) |
| AC1/AC3/AC4 | commands: one-open positive; second-open → clear `VALIDATION_FAILED`; new-open after complete; complete-with-outcome + injected `completed_at`; already-completed no-op-reject; annotate open-only; **auto-complete-on-lost seam** (lost-first, both audited, no open survivor); each command 1 audit `{ targetId }` only; cross-tenant → `TENANT_ACCESS_DENIED` | Integration (Vitest) | P0 | 10.3-INT-01/03 | follow-up commands + table absent (local placeholders; describe.skip) |
| AC4 | UPDATABLE `rls-invisible` profile: own-tenant UPDATE ALLOWED; cross-tenant UPDATE zero-rows + byte-unchanged (BYPASSRLS re-read); own-tenant DELETE rejected | RLS (Vitest) | P0 | 10.3-RLS-01 | table + enrolment absent (describe.skip); cross-tenant/anon come from TENANT_TABLES enrolment |
| AC1/AC2/AC3 | dialog: Planera uppföljning (due date + note) → next-follow-up chip; overdue badge escalation; Klarmarkera sheet (outcome note) → planera nästa / Markera som förlorad/avböjd / Ny version jumps; list `Har uppföljning` + `Försenad uppföljning` filters + overdue row badge | E2E (Playwright) | P1 | 10.3-E2E-01 | dialog/sheet/chip/filters + fixture absent (test.describe.skip) |

**Deliberate non-duplication:** the cross-tenant read/write + anon negatives for `quote_follow_ups` come
from **enrolment** in `tenant-table-inventory.ts` (Task 2.3, `updateDenialKind → "rls-invisible"`), NOT a
hand-written parallel suite (test-design Testability Note 5). The RLS scaffold pins ONLY the distinctive
UPDATABLE-profile proof (own-tenant UPDATE allowed / cross-tenant hidden / own-tenant DELETE rejected).
The partial-unique-index one-open rule is asserted structurally in 10.3-INT-02 (index def) and
behaviorally in 10.3-INT-01 (second-open rejected) — not re-litigated in UNIT. The auto-complete-on-lost
happy path is proven in 10.3-INT-03 by composing the REAL shipped 10.2 `markQuoteVersionLost` with the
new `completeQuoteFollowUp`; the accepted non-atomicity residual is documented (Story Dev Notes), not
tested. Do NOT re-touch the frozen `mark_quote_version_lost` RPC / migration.

## Red Phase Generation (Step 4 / 4C) — files written

All suites are **skipped** (red phase) and assert EXPECTED behaviour (no placeholder assertions). Each
file type-checks today (local `notYetImplemented()` / introspection avoids importing unimplemented
modules) and carries a GREEN-PHASE HAND-OFF header block. TDD red-phase compliance: verified.

| Test ID(s) | File | Runner |
| --- | --- | --- |
| 10.3-UNIT-01 | `tests/unit/features/quotes/follow-up-dates.test.ts` | node:test |
| 10.3-UNIT-02 | `tests/unit/features/quotes/follow-up-view.test.ts` | node:test |
| 10.3-UNIT (validators) | `tests/unit/server/commands/follow-up-validation.test.ts` | node:test |
| 10.3-INT-02 | `tests/integration/rls/quote-follow-ups-migration-reset.int.test.ts` | Vitest |
| 10.3-INT-01/03 | `tests/integration/commands/quote-follow-ups.int.test.ts` | Vitest |
| 10.3-RLS-01 | `tests/integration/rls/quote-follow-ups.rls.test.ts` | Vitest |
| 10.3-E2E-01 | `tests/e2e/quotes/quote-follow-up.e2e.spec.ts` | Playwright |

**Verification run (this step):**
- `node --test` (the 3 unit files): 19 tests, **0 fail, all 19 skipped**.
- `vitest run` (the 3 int/rls files): 3 files skipped, **21 skipped, 0 fail**.
- `tsc --noEmit`: **exit 0** (whole project, scaffolds included).
- `eslint` (all 7 files): **0 errors, 0 warnings**.

## Acceptance Criteria Coverage

- **AC1** (plan a follow-up; one open per quote) → 10.3-UNIT (plan validator) + 10.3-INT-02
  (partial unique index structure) + 10.3-INT-01 (positive plan; second-open clear reject;
  new-open-after-complete) + 10.3-E2E-01 (dialog → chip). Covered.
- **AC2** (list filters + overdue escalation on Stockholm boundary) → 10.3-UNIT-01 (date classifier)
  + 10.3-UNIT-02 (chip/badge selection) + 10.3-E2E-01 (filters + overdue badge). Covered (UI-level; the
  read-model/aggregation beyond this is Story 10.4, out of scope).
- **AC3** (complete + jumps + auto-complete-on-lost) → 10.3-UNIT (complete/annotate validators)
  + 10.3-INT-03 (complete-with-outcome/injected clock; already-completed reject; annotate open-only; the
  lost-from-follow-up seam, both audited, no open survivor) + 10.3-E2E-01 (sheet + jumps). Covered.
- **AC4** (cross-tenant isolation + manifest/H4 enrolment) → 10.3-INT-01 (cross-tenant command
  TENANT_ACCESS_DENIED) + 10.3-INT-02 (force RLS + 3 policies + anon none) + 10.3-RLS-01 (own-tenant
  UPDATE allowed / cross-tenant hidden / own-tenant DELETE rejected) + the `TENANT_TABLES` enrolment
  shared suites (green-phase, Task 2.3). Covered.

## Next Steps (TDD Green Phase — Story 10.3 dev)

Per file, the GREEN-PHASE HAND-OFF header block is authoritative. In summary:
1. Land Task 1 migration (`quote_follow_ups` + partial unique index + full SELECT/INSERT/UPDATE RLS, NO
   DELETE), then **remove `.skip`** on 10.3-INT-02 and **extend `migration-reset.int.test.ts`** with the
   three new quote_follow_ups policies (keep the enumeration EXACT — never a superset).
2. Land Task 2 (manifest enrolment 25 → 26 + `TENANT_TABLES` enrolment with mutation profile
   `"rls-invisible"` — mirror `quote_acceptances`, NOT the 10.2 `"privilege"` case). Bump the live-count
   pins in `manifest-shape.test.ts` + `manifest-derivations.test.ts` 25 → 26 (frozen Phase-A gate
   validators stay `>= 24` FLOORS — do NOT re-touch). This is what makes 10.3-RLS-01 + the H4 gate green.
3. Land Task 3 (validators + the three commands, no RPC) → replace the `notYetImplemented()` placeholders
   with real imports in `follow-up-validation.test.ts` + the command INT; remove `{ skip }` / `.skip`.
4. Land Task 4 (`follow-up-dates.ts` + `follow-up-view.ts`) → replace the UNIT placeholders with real
   imports; remove `{ skip: true }`.
5. Land Task 5 (dialog + sheet + chip + list filters/badge + the auto-complete-on-lost action seam) +
   extend `global-setup.ts` with a `followUpQuote` (sent version + an OVERDUE open follow-up seed) on
   `fixture.json`; remove `.skip` on 10.3-E2E-01.
6. Run against a freshly `supabase db reset` LOCAL stack (`SUPABASE_TEST_REQUIRED=1` in CI hard-fails on
   an unreset/unreachable stack — the post-reset false-green trap; use a complete TEMP CLI profile for
   the local reset, do NOT commit a cli-profile change).

**Unskip-or-delete finalize (epic-10 Tier-A + 10-2 review lesson):** the dev phase MUST end with EVERY
scaffold above either unskipped-and-green OR deleted — never a `describe.skip` / `{ skip: true }` shipped
as if it were coverage, never a duplicate throwing-placeholder next to the real test. Any "all unskipped
and green" Change-Log claim must be literally true. Every assertion is the CONTRACT — do NOT weaken them
when removing the skips.

## Key Risks / Assumptions

- **Settled design honored:** the one-open-per-quote model (partial unique index; complete-then-plan-next)
  and the UPDATABLE table (SELECT+INSERT+UPDATE, no DELETE, `rls-invisible` profile) are baked into every
  scaffold. If the oracle/owner turns out to REQUIRE parallel open follow-ups per quote (reverses
  UXB-A6), that is a documented STOP (R-1034) — the scaffolds would need re-authoring; do NOT silently
  drop the partial unique index.
- **NO RPC (architecture §14):** the commands are plain envelope writes; the one-open rule is DB-enforced
  (23505 → mapped clear `VALIDATION_FAILED`). No new `CommandErrorCode`. The auto-complete-on-lost seam is
  a TWO-command action-layer orchestration (lost-first) — NOT a widened RPC; the accepted, recoverable
  non-atomicity residual is documented in the story, not tested.
- **Scope guards enforced by the migration-reset scaffold:** no money/öre column, no
  notification/reminder/email column (Epic 13 owns reminders — EB-A8), no supplier/Fortnox/sync/portal
  column, no `updated_at` trigger. The list surfacing stays UI-only (read-model/aggregation is 10.4).
- **PII discipline:** all follow-up-note fixtures (E2E seeds + any factory seeds) must be anonymized
  shape-only. IF a follow-up golden fixture is added in dev, extend the STANDING scan via the shared
  authority (`tests/support/anonymization-scan.ts` + the standing privacy-scan test) — not a weaker
  fixture-local check (10.2 review Patch, R-1015). No golden fixture was authored in this red phase.
- **Two-runner discipline maintained:** no Playwright worker was spun up for not-yet-existing surfaces;
  pure-TS assertions stay on node:test, DB-backed on Vitest, only the dialog/sheet is Playwright (skipped).

## Recommended next workflow

`bmad-dev-story` for Story 10.3 (implement Tasks 1–6, un-skip each suite as its surface lands). After
green, optionally `bmad-testarch-trace` to refresh the epic-10 traceability matrix.

**Generated by BMad TEA Agent** - 2026-07-19
