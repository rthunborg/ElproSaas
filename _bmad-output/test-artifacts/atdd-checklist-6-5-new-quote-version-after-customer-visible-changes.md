---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
  - 'step-04c-aggregate'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-07-06'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/6-5-new-quote-version-after-customer-visible-changes.md'
  - '_bmad-output/test-artifacts/test-design-epic-6.md'
  - '_bmad-output/auto-bmad/retro-notes/epic-6.md'
  - '_bmad/tea/config.yaml'
  - 'src/server/commands/command-errors.ts'
  - 'tests/integration/commands/mark-quote-version-sent.int.test.ts'
  - 'tests/integration/commands/quote-version.int.test.ts'
  - 'tests/e2e/quotes/quote-sent-lock.e2e.spec.ts'
  - 'tests/e2e/quotes/quotes.e2e.spec.ts'
  - 'tests/unit/features/quotes/send-gate.test.ts'
  - 'tests/factories/tenants.ts'
  - 'tests/factories/audit-events.ts'
  - 'tests/integration/rls/tenant-table-inventory.ts'
---

# ATDD Checklist: Story 6.5 — New Quote Version After Customer-Visible Changes

**TDD phase:** RED (failing/skipped acceptance scaffolds authored BEFORE implementation).
**Story:** `_bmad-output/implementation-artifacts/6-5-new-quote-version-after-customer-visible-changes.md`
**Author:** Rasmus
**Primary Test Level:** Integration (the new-version-with-parent-relationship proof, the
prior-version BYTE-PRESERVATION proof — the R-609 headline — and the lifecycle state machine at
both layers are the load-bearing deliverable; unit for the pure closed transition map + validator;
E2E for the activated "Skapa ny version" button + multi-version timeline messaging only).
**Stack:** fullstack (Next.js 16 + Supabase). Runners: `node --test` (unit fast gate), Vitest
(integration, local Supabase stack), Playwright (E2E, CI-gated).
**Generation mode:** AI generation (backend/DB-heavy — new-version RPC + two commands + validators
+ error mapping + a UI action; clear AC). No live browser recording — the E2E scaffold reuses the
existing 6.2/6.4 two-tenant fixture pattern. Execution mode resolved to SEQUENTIAL (no
subagent/agent-team runtime available in this harness) — scaffolds authored directly and inline.

## Story Summary

As a tenant admin, I want to create a NEW quote version when a sent quote needs customer-visible
changes, so that previous sent commitments stay available for audit and comparison. 6.5 is the LAST
story of Epic 6: a NEW-version RPC (`create_new_quote_version`, the 6.1 create-RPC's sibling for an
EXISTING quote — locks the parent quote, `version_number=max+1`, SHARES the parent `quote_number`,
optionally supersedes the prior sent version) + a `createNewQuoteVersion` command + a
`markQuoteVersionLifecycle` command (rejected/expired/superseded) + activating the disabled "Skapa
ny version" button. The sent version is NEVER edited — a change SPAWNS a new immutable draft version
while PRESERVING every prior version byte-for-byte. Acceptance is Epic 7.

## Acceptance Criteria

1. **AC1** — A customer-visible change on a SENT (or any non-draft) version creates a NEW DRAFT
   version on the SAME parent quote (`version_number = MAX + 1`, `status='draft'`, its OWN fresh
   frozen snapshot RE-CAPTURED from the CURRENT authoritative source, its OWN `quote_events 'created'`
   event) through a narrow SECURITY INVOKER RPC (ADR-A009) reusing the 6.1 version-creation
   transaction pattern with an EXPLICIT parent-quote relationship. The sent version is NEVER edited
   (the new version is the mutation surface). NO new `quote_number` is allocated — every version of
   the same quote SHARES it; only `version_number` increments.
2. **AC2** — With multiple versions on one quote, every PRIOR version remains available with its
   COMPLETE frozen state — its snapshot rows (`quote_versions` + `quote_version_lines` +
   `quote_version_attachments`), its PDF render metadata (`pdf_status`/`pdf_file_id`/
   `pdf_generated_at`), its `quote_events`, and its `status` history — BYTE-UNCHANGED by the v2
   creation, AND the latest state is clear (the existing `@/features/quotes/timeline` helpers resolve
   the current commitment). Creating v2 mutates NOTHING on v1.
3. **AC3** — A Phase A lifecycle state change (rejected / expired / superseded) is tenant-scoped,
   audited (`{ targetId }` metadata only), and does NOT mutate prior sent content: a status
   transition on a NON-draft version is REJECTED unless it is a SANCTIONED forward transition (the
   6.4 sent-lock trigger allows `sent/accepted/rejected/expired/superseded`; a `superseded` mark on
   v1 when v2 is created is one such transition) and it changes ONLY the exempt `status` column.
   Illegal transitions (`sent→draft`, `superseded→sent`) are rejected below the command AND at the
   command layer.

## Red-phase mechanism per runner

BMAD's canonical `test.skip()` red-phase idiom is adapted to each runner so the fast gate stays
GREEN (visible SKIP, never a failing red build) until each Task lands:

- **`node --test`** (unit): per-case `test("...", { skip: "ATDD red phase ..." }, () => {...})`.
  Assertions reference the not-yet-existent `isLegalLifecycleTransition` +
  `validateMarkQuoteVersionLifecycle` via a `declare` placeholder (deleted when the real
  `src/features/quotes/lifecycle.ts` + `validation.ts` symbols land). Verified: 8 tests, 8 skipped,
  0 fail.
- **Vitest** (integration): whole-suite `describe.skip("... [ATDD red phase ...]")` per describe
  block (the `createNewQuoteVersion` + `markQuoteVersionLifecycle` commands, the
  `create_new_quote_version` RPC, and the lifecycle path do not exist yet). Bodies carry the real
  proof outline + `expect.fail(...)` sentinels so a stray un-skip fails LOUD rather than passing
  vacuously. Verified: 12 tests, 12 skipped, 0 fail.
- **Playwright** (E2E): `test.describe.skip("... [ATDD red phase — Story 6.5 not implemented]")`
  header (mirrors the 6.2/6.4 no-lingering-red-header discipline — clear the header when green).

## Acceptance-criteria coverage

| Test ID | Level (runner) | AC | P | Red-phase scaffold file |
| --- | --- | --- | --- | --- |
| 6.5-INT-03 (unit slice) | Unit (`node --test`) | AC3 | P0 | `tests/unit/features/quotes/lifecycle-transition.test.ts` |
| 6.5-INT-01 | Integration (Vitest) | AC1 | P0 | `tests/integration/commands/create-new-quote-version.int.test.ts` |
| 6.5-INT-02 | Integration (Vitest) | AC2 | P0 | `tests/integration/commands/create-new-quote-version.int.test.ts` |
| 6.5-INT-03 | Integration (Vitest) | AC3 | P0 | `tests/integration/commands/create-new-quote-version.int.test.ts` |
| 6.5-RLS | RLS (Vitest) | AC3 | P0 | *(command-layer negatives in the INT file + inventory-enrolled — see note)* |
| 6.5-GOLDEN-01 | Golden unit | AC2 | P1 | *(dev-story — see "Deliberately NOT authored" below)* |
| 6.5-E2E-01 | E2E (Playwright) | AC1/AC2 | P1 | `tests/e2e/quotes/quote-new-version.e2e.spec.ts` |

- **AC1 (new version with an explicit parent relationship):** 6.5-INT-01 (a customer-visible change
  on a SENT version ⇒ a NEW DRAFT version — shared `quote_number`, `version_number+1`, own `created`
  event + `{ targetId }` audit; the SENT version is NOT edited; v2 captures the NEW values, v1 keeps
  the OLD), plus the R-604 concurrency case (two concurrent new-version creations serialize on the
  parent-quote lock → DISTINCT version numbers) and the foreign-attachment negative
  (`TENANT_ACCESS_DENIED`).
- **AC2 (prior-version BYTE-PRESERVATION — the R-609 headline):** 6.5-INT-02 (read v1's full frozen
  state before/after v2 creation + after each lifecycle event; deep-equality on the frozen columns;
  the ONE sanctioned exception is a legal `status` flip sent→superseded that changes ONLY `status` +
  APPENDS a `superseded` event, never a customer-visible column or a prior event). A test that only
  proves v2 was created is NOT evidence.
- **AC3 (the lifecycle state machine at BOTH layers, R-608):** 6.5-INT-03 unit slice (the pure
  closed transition map + validator), 6.5-INT-03 integration (a DIRECT own-tenant authed reversal to
  `draft` rejected by the 6.4 sent-lock trigger with QV409; the command rejects an illegal transition
  with `VALIDATION_FAILED`; a LEGAL transition succeeds + appends the matching event + a `{ targetId }`
  audit; the QV409 RAISE maps to `QUOTE_VERSION_LOCKED`).
- **AC3 cross-tenant (6.5-RLS, R-601/R-609):** command-layer negatives in the INT file (Tenant A
  cannot create a new version off / transition Tenant B's version → `TENANT_ACCESS_DENIED`) + the
  shared inventory (see note).

### 6.5-RLS — enrollment, NOT a hand-written ad-hoc test (intentional)

`quote_versions` / `quote_events` / `quote_version_lines` / `quote_version_attachments` are ALREADY
enrolled in the shared `TENANT_TABLES` inventory (`tests/integration/rls/tenant-table-inventory.ts`)
since Story 6.1, so cross-tenant SELECT/UPDATE/INSERT + anon isolation are covered by the shared
`cross-tenant-isolation.rls.test.ts` / anon-path suites. Per the story's Task 5.3 guidance
("enrollment is the completeness guarantee — do NOT bypass the inventory"), NO new standalone RLS
file is authored here. This migration adds NO table (only an RPC + optional trigger-fn) → the H4
inventory gate is untouched. GREEN-PHASE obligations for 6.5-RLS:

1. Add the command-layer cross-tenant negatives to `create-new-quote-version.int.test.ts` (already
   scaffolded as the `describe.skip("... cross-tenant isolation ...")` block): adminA creating a new
   version off / transitioning a REAL Tenant-B version → `TENANT_ACCESS_DENIED`.
2. If `quote-tables-migration-reset.int.test.ts` enumerates functions/triggers or the EXACT per-table
   policy set, EXTEND it (add the new `create_new_quote_version` / lifecycle function — a function-only
   migration leaves the table policy set unchanged) — never LOOSEN the exact enumeration.

## Deliberately NOT authored here (belongs to `dev-story`, not ATDD red-phase scaffolds)

- **6.5-GOLDEN-01** (v1/v2 comparison goldens pinning WHAT CHANGED vs WHAT PRESERVED) — a
  data-driven UNIT over ORIGIN-LABELLED fixtures under `tests/fixtures/golden/**`. The fixtures do
  not exist yet and depend on the real re-captured snapshot shape (produced in green); authoring
  fabricated fixtures now would violate the origin-labelled discipline. GREEN-PHASE MUST use REAL
  `ReadinessCode` union values in any warning codes (`TAX_SIGN_OFF_REQUIRED` / `REQUIRED_FILES_DEFERRED`
  / `HIDDEN_ROWS_INCLUDED` / `MISSING_CUSTOMER` / `TOTAL_UNCOMPUTABLE`) — NEVER the fictional 6.1
  strings (`REQUIRES_SIGN_OFF` / `DEDUCTION_ESTIMATE_UNAPPROVED`) — and extend the CI golden
  PII/secret scan to the new fixtures (R-615, a blocker regardless of score).
- **6.5-DOCS-01** (the documented intentional delta vs Lovable's MUTABLE quote versions — Phase A
  creates a NEW immutable version instead of mutating the sent one) — a Dev Agent Record /
  migration-comment doc obligation (Task 5.5), not a runnable test scaffold. It EXTENDS the
  6.4-DOCS-01 oracle delta.
- The **standalone rejected/expired lifecycle UI affordance** (Task 4.2 OPTIONAL) — if surfaced, an
  E2E case is added in green; the auto-supersede-on-new-version path is the primary lifecycle flow
  and is proven at the INT layer regardless.

## Fixtures / infrastructure the GREEN phase must add (referenced, not yet created)

- **`src/features/quotes/lifecycle.ts`** — the PURE `isLegalLifecycleTransition(from, to)` closed
  transition map (the single source of truth the command guard consults; conceptually the SAME set
  the 6.4 DB trigger enforces). Un-skips the unit map cases; delete the `declare` placeholder.
- **`validateMarkQuoteVersionLifecycle`** + **`validateCreateNewQuoteVersion`** in
  `src/server/commands/quotes/validation.ts` (mirror `validateMarkQuoteVersionSent` /
  `validateCreateQuoteVersionFromCalculation`); export from the barrel `index.ts`. Un-skips the unit
  validator cases.
- **`createNewQuoteVersion`** command (`src/server/commands/quotes/new-version.ts`) +
  **`markQuoteVersionLifecycle`** command (`src/server/commands/quotes/lifecycle.ts`) + register both
  in `index.ts`. REUSE `throwMappedQuoteWriteError` UNCHANGED (QV409→`QUOTE_VERSION_LOCKED`,
  23503/42501→`TENANT_ACCESS_DENIED`, 23505/23514/22P02→`VALIDATION_FAILED`) — NO new error code.
  EXTRACT the 6.1 execute-body snapshot-build sequence into a SHARED helper so
  `createQuoteVersionFromCalculation` and `createNewQuoteVersion` cannot drift.
- **The additive migration** (`supabase/migrations/20260708120000_quote_new_version.sql`) — the
  narrow `create_new_quote_version` RPC (SECURITY INVOKER, empty search_path, schema-qualified;
  row-locks the parent quote `FOR UPDATE`, `version_number = max+1` under the lock, SHARES the parent
  `quote_number`, NO `tenant_counters` touch, optional `p_supersede_prior`). NO new table (H4
  untouched). RELIES on the 6.4 sent-lock/append-only triggers — does NOT modify them.
- **Factory (additive, reuse — do NOT invent a new fixture):** `adminInsertQuoteVersion` +
  `adminInsertQuoteVersionLine` + `adminInsertQuoteVersionAttachment` already exist; the INT scaffold
  seeds a sent-with-children version draft → children → flip-to-sent (the 6.4 child-lock order). GREEN
  phase: add a small BYPASSRLS `adminUpdateQuoteVersionStatus(id, "sent")` helper (additive) if not
  present, to flip the seeded draft to sent AFTER its children exist.
- **E2E `global-setup.ts`:** extend the two-tenant quote fixture with a SENT v1 (draft → children →
  flip-to-sent) + a DEDICATED single-sent-version quote (`newVersionQuote`) the create-new-version
  flow test consumes; add the `create-new-version` (now ACTIVE) + `quote-timeline` /
  `quote-current-version` testids to `QuoteDetailView`.

## Required data-testid attributes (E2E UI contract for the GREEN phase)

### QuoteDetailView (read-only branch — the button ACTIVATED by 6.5)

- `create-new-version` — the "Skapa ny version" affordance, now ENABLED + keyboard-operable
  (accessible name matching /ny version/i, visible focus ring). Extract a `CreateNewVersionButton.tsx`
  client island mirroring `MarkSentButton.tsx`.
- `quote-readonly-notice` — explains the lifecycle rule (låst/låses … skapa ny version) — ALREADY
  exists from 6.2/6.4, asserted here.

### QuoteDetailView (draft branch — the NEW version renders here after creation)

- `draft-quote-editor` + `mark-sent-button` — ALREADY exist from 6.2/6.4; asserted to render on the
  new draft after the admin lands on it.
- `quote-status-badge` — the text-not-color status badge ("Utkast" for the new draft).

### Quote timeline

- `quote-timeline` + `quote-timeline-version-<id>` — the multi-version timeline entries (the prior
  sent version remains visible with its status as TEXT).
- `quote-current-version` — the header/current-commitment resolution (the latest state is clear).

## Implementation Checklist (map each failing test to the tasks that make it pass)

### 6.5-INT-03 unit slice — lifecycle transition map + validator (`tests/unit/features/quotes/lifecycle-transition.test.ts`)

- [ ] Author `isLegalLifecycleTransition` in `src/features/quotes/lifecycle.ts` as the single closed
      transition map (sent → accepted/rejected/expired/superseded; any reversal to draft ILLEGAL;
      draft → sent only; terminal states terminal). Mirror the 6.4 DB trigger's legal set.
- [ ] Author `validateMarkQuoteVersionLifecycle` + `validateCreateNewQuoteVersion` in `validation.ts`
      (uuid + closed `transition` set / bounded UUID attachment array); export from `index.ts`.
- [ ] Delete the `declare` placeholders; import from `@/features/quotes/lifecycle` +
      `@/server/commands/quotes/validation`. Remove `{ skip: ... }` from each case.
- [ ] Run: `pnpm run test:unit`.

### 6.5-INT-01/02/03 — new version + preservation + lifecycle (`tests/integration/commands/create-new-quote-version.int.test.ts`)

- [ ] Add the additive migration: `create_new_quote_version` RPC (SECURITY INVOKER, empty
      search_path, `p_captured_at` injected parameter; parent-quote `FOR UPDATE` lock; `version_number
      = max+1`; SHARED `quote_number`; NO `tenant_counters` touch; optional `p_supersede_prior`).
- [ ] Author `createNewQuoteVersion` (re-capture fresh snapshot via the SHARED 6.1 helper; ownership
      gate on the parent version; re-validate attachments own-tenant; RLS client / no service-role;
      `{ targetId }` audit) + `markQuoteVersionLifecycle` (load status → command-layer legal-transition
      guard → status-only UPDATE + matching event + `{ targetId }` audit) + register both.
- [ ] Import both commands; replace the `expect.fail(...)` sentinels with the real command calls +
      uncomment the readback assertions; add a BYPASSRLS `adminUpdateQuoteVersionStatus` helper (or
      equivalent) so the seed flips draft → sent AFTER children exist; remove the `describe.skip`.
- [ ] Run after `supabase db reset` + POLL `/auth/v1/health` to 200 (Kong 502 false-green): `pnpm run test:int`.

### 6.5-E2E-01 — new-version UX (`tests/e2e/quotes/quote-new-version.e2e.spec.ts`)

- [ ] Activate the `create-new-version` button (swap the disabled placeholder for
      `CreateNewVersionButton`); add the `"use server"` new-version action (revalidate BOTH
      `/quotes/[id]` AND the new version subroute — do NOT repeat the 6.2 subroute-revalidation gap).
- [ ] Add the `quote-timeline` / `quote-timeline-version-<id>` / `quote-current-version` testids.
- [ ] Extend `global-setup.ts` (a SENT v1 + a dedicated `newVersionQuote`); update the E2E
      `QuoteFixture` interface with `newVersionQuote`.
- [ ] Remove the `test.describe.skip(...)` header (clear the red-phase header when green).
- [ ] Run: `pnpm run test:e2e`.

## Running Tests

```bash
# Unit (fast gate) — lifecycle transition map + validator
node --experimental-strip-types --import ./tests/support/register.mjs --test "tests/unit/features/quotes/lifecycle-transition.test.ts"
pnpm run test:unit

# Integration (local Supabase; after `supabase db reset` + /auth/v1/health 200 poll)
pnpm run test:int
npx vitest run tests/integration/commands/create-new-quote-version.int.test.ts

# E2E (CI-gated; global-setup seeds the two-tenant quote fixture)
pnpm run test:e2e
npx playwright test tests/e2e/quotes/quote-new-version.e2e.spec.ts
```

## Red-phase verification evidence

- `npx tsx --test tests/unit/features/quotes/lifecycle-transition.test.ts`
  → `tests 8 / pass 0 / fail 0 / skipped 8` (fast gate stays green).
- `npx tsc --noEmit` → 0 errors across all three new scaffold files (type-clean red phase; the
  `declare` placeholders + commented green-phase assertions keep it compiling).
- `npx eslint <all three files>` → exit 0, 0 errors, 0 warnings.
- `npx vitest run tests/integration/commands/create-new-quote-version.int.test.ts`
  → `Test Files 1 skipped / Tests 12 skipped` (whole-describe `.skip` — collects without executing
  the not-yet-existent commands/RPC).
- `npx playwright test tests/e2e/quotes/quote-new-version.e2e.spec.ts --list` → the module-scope
  gitignored `fixture.json` load errors locally IDENTICALLY to the existing 6.2/6.4 specs (seeded by
  global-setup in CI) — not a scaffold defect; the `test.describe.skip` header keeps it inert in green
  until Task 4 lands.

## Notes / key risks & assumptions

- **The canonical 6.5 correctness property is prior-version BYTE-PRESERVATION (R-609 — the headline
  6.5 bug).** 6.5-INT-02 (read v1 before/after v2 AND each lifecycle event; deep-equality on the
  frozen columns) is MANDATORY. The ONE sanctioned exception is a legal `status` flip sent→superseded
  that changes ONLY `status` + APPENDS a `superseded` event. A test that only proves v2 was created is
  NOT evidence. The 6.4 sent-lock + `quote_events` append-only triggers are the below-command
  backstops that make an accidental prior-version mutation RAISE.
- **REUSE the 6.1 narrow RPC pattern — do NOT fork the version-creation transaction (ADR-A009).** The
  new-version RPC is the 6.1 create RPC's SIBLING for an EXISTING quote (lock the parent, version+1,
  share quote_number, no counter increment, optional supersede). EXTRACT the 6.1 snapshot-build
  sequence into a SHARED helper. A mechanism change without an ADR = STOP.
- **RE-CAPTURE FRESH — v2 freezes the CURRENT source, not a clone of v1.** "Customer-visible content
  must change" means the admin edited the source (calc/settings/terms) then spawns a version that
  captures the NEW state (6.5-INT-01 mutate-source-then-create), while v1 stays byte-unchanged
  (6.5-INT-02). A verbatim clone is only for a pure lifecycle-supersede with no content change.
- **The `superseded` forward transition is ALREADY sanctioned by the 6.4 sent-lock trigger — 6.5 USES
  it (do NOT re-open the trigger).** Auto-superseding the prior SENT version on v2 creation is the
  RECOMMENDED default (Task 2.1); do NOT supersede an `accepted` version (Epic 7). The state-machine
  REVERSAL (sent→draft, superseded→sent) is rejected at BOTH layers (the 6-4 retro review lesson).
- **The new version SHARES the parent `quote_number`; only `version_number` increments.** No new
  `tenant_counters` allocation; the parent-quote `FOR UPDATE` lock serializes concurrent creations
  (R-604); the `(quote_id, version_number)` unique is the belt-and-braces backstop (23505→VALIDATION_FAILED).
- **Demo-data-only accept stands** (owner 2026-07-03): the new version carries the SAME inert
  deduction/VAT + `requires_sign_off` framing as 6.1; do NOT wire a real ROT/grön assumption. STOP →
  needs-human (re-score R-610 to a blocker) if real-customer use is proposed.
- **STOP conditions:** if the VERSIONING RULES conflict with an owner-approved quote-correction policy
  or accepted-price semantics (e.g. superseding an accepted version), or the lifecycle/immutability
  model materially changes → `needs-human`.
- **6.5 is the LAST story of Epic 6** — the epic-boundary trace/NFR/test-review + retro run AFTER this
  story; surface any residual R-609/R-608 gaps for the gate.

## Next steps (recommended workflow)

1. `dev-story` (green phase): implement Tasks 1–6, un-skip each scaffold in priority order (UNIT →
   INT → E2E), delete every `declare` placeholder / `expect.fail` sentinel / red-phase header.
2. Add the 6.5-GOLDEN-01 v1/v2 fixtures (REAL `ReadinessCode` codes; PII/secret-scanned) and the
   6.5-DOCS-01 Lovable-delta note during dev-story.
3. Run the FULL CI gate in order (typecheck → lint → test:unit → build → test:int → test:e2e); verify
   every scaffold flips GREEN (or is a documented, justified skip). Clear ALL red-phase headers when green.
4. `automate` (given `tea_selected: [atdd, automate]` for 6.5) to expand coverage after green — then the
   epic-boundary trace/NFR/test-review + retrospective (6.5 is the last story of Epic 6).
