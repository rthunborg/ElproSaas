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
  - '_bmad-output/implementation-artifacts/6-4-mark-quote-version-sent-and-enforce-immutability.md'
  - '_bmad-output/test-artifacts/test-design-epic-6.md'
  - '_bmad/tea/config.yaml'
  - 'src/features/calculations/readiness.ts'
  - 'src/server/commands/command-errors.ts'
  - 'tests/integration/commands/update-draft-quote-version.int.test.ts'
  - 'tests/integration/commands/generate-quote-pdf-source-of-truth.int.test.ts'
  - 'tests/e2e/quotes/quotes.e2e.spec.ts'
  - 'tests/factories/tenants.ts'
  - 'tests/factories/audit-events.ts'
  - 'tests/integration/rls/tenant-table-inventory.ts'
---

# ATDD Checklist: Story 6.4 — Mark Quote Version Sent And Enforce Immutability

**TDD phase:** RED (failing/skipped acceptance scaffolds authored BEFORE implementation).
**Story:** `_bmad-output/implementation-artifacts/6-4-mark-quote-version-sent-and-enforce-immutability.md`
**Author:** Rasmus
**Primary Test Level:** Integration (the sent-transition + BOTH-layer immutability proofs are the
load-bearing deliverable; unit for the send-gate rule; E2E for the lock messaging only).
**Stack:** fullstack (Next.js 16 + Supabase). Runners: `node --test` (unit fast gate), Vitest
(integration, local Supabase stack), Playwright (E2E, CI-gated).
**Generation mode:** AI generation (backend/DB-heavy — trigger + narrow RPC + command + error-code;
clear AC). No live browser recording — the E2E scaffold reuses the existing 6.2/6.3 two-tenant
fixture pattern. Execution mode resolved to SEQUENTIAL (no subagent/agent-team runtime available in
this harness) — scaffolds authored directly and inline.

## Story Summary

As a tenant admin, I want to mark a draft quote version as sent and lock it, so that customer
commitments cannot be overwritten by accident. 6.4 is the FIRST DB-level immutability enforcement
of the epic: a `mark_quote_version_sent` narrow RPC (ADR-A009) + a `markQuoteVersionSent` command +
the NEW `QUOTE_VERSION_LOCKED` error code + a sent-lock DB trigger + a "Markera som skickad" UI
affordance. New-version-after-change is Story 6.5; acceptance is Epic 7.

## Acceptance Criteria

1. **AC1** — A DRAFT that passes the BLOCKING readiness checks can be marked sent: the system
   records the sent timestamp (an EXPLICIT RPC parameter from the injected command clock — no
   wall-clock), the optional channel/reference, a `quote_events` `sent` event, an `audit_events`
   record (allow-listed `{ targetId }` only), and flips `status` → `sent`, all through a narrow
   SECURITY INVOKER RPC. The send is gated by the SAME Story-5.4 readiness blocker classification
   (no forked rule table). `terms_approved_at`/`requires_sign_off` are re-derived as server truth.
2. **AC2** — A SENT (non-draft) version's customer-visible fields / selected attachments / PDF-source
   data are immutable, rejected at BOTH layers: (a) command validation → the stable typed
   `QUOTE_VERSION_LOCKED`, and (b) a DB trigger rejects a DIRECT own-tenant authenticated UPDATE.
   The DB lock EXEMPTS the derived PDF-render columns (`pdf_status`/`pdf_file_id`/`pdf_generated_at`)
   and the append-only lifecycle machinery (allowed status transitions, `archived_at`, `updated_at`).
   The quote-detail UI explains the lifecycle rule + offers a "create new version" affordance.
3. **AC3** — Cross-tenant send / mutation attempts are rejected by RLS AND command validation
   (a foreign version id → `TENANT_ACCESS_DENIED` before execute; no cross-tenant existence leak).

## Red-phase mechanism per runner

BMAD's canonical `test.skip()` red-phase idiom is adapted to each runner so the fast gate stays
GREEN (visible SKIP, never a failing red build) until each Task lands:

- **`node --test`** (unit): per-case `test("...", { skip: "ATDD red phase ..." }, () => {...})`.
  Assertions reference the not-yet-existent `canSendQuoteVersion` via a `declare` placeholder
  (deleted when the real `src/features/quotes/send-gate.ts` lands). Verified: 4 tests, 4 skipped,
  0 fail.
- **Vitest** (integration): whole-suite `describe.skip("... [ATDD red phase ...]")` per describe
  block (the command `markQuoteVersionSent`, the `QUOTE_VERSION_LOCKED` code, the RPC, and the
  sent-lock trigger do not exist yet). Bodies carry the real proof outline + `expect.fail(...)`
  sentinels so a stray un-skip fails LOUD rather than passing vacuously.
- **Playwright** (E2E): `test.describe.skip("... [ATDD red phase — Story 6.4 not implemented]")`
  header (mirrors the 6.2/6.3 no-lingering-red-header discipline — clear the header when green).

## Acceptance-criteria coverage

| Test ID | Level (runner) | AC | P | Red-phase scaffold file |
| --- | --- | --- | --- | --- |
| 6.4-UNIT-01 | Unit (`node --test`) | AC1 | P0 | `tests/unit/features/quotes/send-gate.test.ts` |
| 6.4-INT-01 | Integration (Vitest) | AC1 | P0 | `tests/integration/commands/mark-quote-version-sent.int.test.ts` |
| 6.4-INT-02 | Integration (Vitest) | AC2 | P0 | `tests/integration/commands/mark-quote-version-sent.int.test.ts` |
| 6.4-INT-03 | Integration (Vitest) | AC2 | P0 | `tests/integration/commands/mark-quote-version-sent.int.test.ts` |
| 6.4-INT-04 | Integration (Vitest) | AC1 | P0 | `tests/integration/commands/mark-quote-version-sent.int.test.ts` |
| 6.4-RLS-01 | RLS (Vitest) | AC3 | P1 | *(inventory-enrolled — see note below)* |
| 6.4-E2E-01 | E2E (Playwright) | AC1/AC2 | P1 | `tests/e2e/quotes/quote-sent-lock.e2e.spec.ts` |

- **AC1 (mark-sent transition + send gate):** 6.4-UNIT-01 (the send-gate rule pinned against the
  5.4 classifier — blockers block, warnings don't), 6.4-INT-01 (records sent timestamp/channel/ref
  + `sent` event + `{ targetId }` audit + `status='sent'`; injected clock, no wall-clock),
  6.4-INT-04 (a blocked draft is unsendable via the SAME classifier — no forked rule).
- **AC2 (BOTH-layer immutability):** 6.4-INT-02 (command guard → `QUOTE_VERSION_LOCKED`, distinct
  from `QUOTE_VERSION_NOT_DRAFT`), 6.4-INT-03 (DB trigger rejects a DIRECT own-tenant authed UPDATE
  of a customer-visible column AND proves the EXEMPT PDF-render columns + allowed lifecycle
  transitions still mutate on a sent version; the child line/attachment snapshot is locked too;
  the trigger does NOT fire on a draft), 6.4-E2E-01 (UI explains the rule + create-new-version
  affordance + the mark-sent flow flips draft → read-only sent).
- **AC3 (cross-tenant isolation):** 6.4-RLS-01 — see the enrollment note; the command-layer
  cross-tenant negative (`TENANT_ACCESS_DENIED`) is added to the 6.4-INT suite in the green phase.

### 6.4-RLS-01 — enrollment, NOT a hand-written ad-hoc test (intentional)

`quote_versions` / `quote_events` / `quote_version_lines` / `quote_version_attachments` are ALREADY
enrolled in the shared `TENANT_TABLES` inventory
(`tests/integration/rls/tenant-table-inventory.ts`), so cross-tenant SELECT/UPDATE/INSERT + anon
isolation are covered by the shared `cross-tenant-isolation.rls.test.ts` / `anon-path-isolation`
suites for these tables since Story 6.1. Per the story's Task 6.3 guidance ("do NOT hand-write an
ad-hoc isolation test that bypasses the inventory — enrollment is the completeness guarantee"), NO
new standalone RLS file is authored here. GREEN-PHASE obligations for 6.4-RLS-01:

1. Confirm the NEW sent-lock/append-only triggers do NOT break the shared inventory's generic
   UPDATE probes on a DRAFT row (the trigger only fires when `OLD.status <> 'draft'`; the inventory
   probes seed draft rows). 6.4-INT-03's "does NOT fire on a draft" case pins this directly.
2. Add the command-layer cross-tenant negative to `mark-quote-version-sent.int.test.ts`: adminA
   marking a REAL Tenant-B version → `TENANT_ACCESS_DENIED` (mirror the `TENANT_ACCESS_DENIED` case
   already in `update-draft-quote-version.int.test.ts`), and adminA mutating Tenant-B's sent version.
3. If `migration-reset.int.test.ts` enumerates triggers or the exact per-table policy set, EXTEND
   it (add the new sent-lock/append-only triggers; adjust the `quote_events` policy enumeration only
   if Task 1.4 changes it) — never LOOSEN the exact enumeration.

## Deliberately NOT authored here (belongs to `dev-story`, not ATDD red-phase scaffolds)

- **6.4-DOCS-01** (the documented intentional delta vs Lovable's MUTABLE quote versions) — a Dev
  Agent Record / migration-comment doc obligation (Task 6.5), not a runnable test scaffold.
- The **command-layer cross-tenant negative** for 6.4-RLS-01 — added to the INT suite in green
  (it needs the real `markQuoteVersionSent` command to exist; the pattern is the existing
  `TENANT_ACCESS_DENIED` case in `update-draft-quote-version.int.test.ts`).
- The **non-scope guardrail scan** (no email/customer-portal/public quote-send route) — if added,
  it is a `node --test` route/surface presence-scan (the 6.2 retro tier), not a Playwright test.

## Fixtures / infrastructure the GREEN phase must add (referenced, not yet created)

- **`src/features/quotes/send-gate.ts`** — the PURE `canSendQuoteVersion` adapter over
  `classifyReadiness` (resolved values passed IN; NO `src/lib`→`src/server` inversion). Un-skips
  6.4-UNIT-01; delete the `declare` placeholder + import the real symbol.
- **`markQuoteVersionSent`** command (`src/server/commands/quotes/mark-sent.ts`) + register in
  `index.ts`; the `QUOTE_VERSION_LOCKED` code in `command-errors.ts` (union + `COMMAND_MESSAGES`);
  the write-error mapper branch in `quote-db.ts`; the validator in `validation.ts`. Un-skips the
  Vitest suite; delete the `expect.fail(...)` sentinels + uncomment the real assertions.
- **The additive migration** (`supabase/migrations/2026070712...._quote_version_sent_lock.sql`) — the
  `mark_quote_version_sent` RPC + the sent-lock trigger on `quote_versions` (+ line/attachment
  children) + the `quote_events` append-only reconciliation. The trigger's EXEMPT set MUST include
  `pdf_status`/`pdf_file_id`/`pdf_generated_at` + allowed lifecycle fields (6.4-INT-03 pins this).
- **Factory (additive, reuse — do NOT invent a new fixture):** `adminInsertQuoteVersion` already
  carries `status`/`pdf_status`/`intro_text`/`customer_display_name` seed cols (6.2/6.3). If Task
  2.1 adds a `sent_*` column, add it to the factory + the trigger's EXEMPT set ADDITIVELY.
- **E2E `global-setup.ts`:** already seeds a SENT v1 + a DRAFT v2. GREEN phase: expose the draft as
  mark-sendable and (for the rejected-send case) seed a BLOCKED draft; add the `mark-sent-button` /
  `mark-sent-status` testids to `QuoteDetailView`.

## Required data-testid attributes (E2E UI contract for the GREEN phase)

### QuoteDetailView (draft branch — NEW for 6.4)

- `mark-sent-button` — the "Markera som skickad" affordance on a DRAFT version (keyboard-operable,
  accessible name matching /skicka/i, visible focus ring).
- `mark-sent-status` — the `role="status"`/`role="alert"` banner announcing send success/failure.

### QuoteDetailView (read-only branch — ALREADY EXIST from 6.2, asserted here)

- `quote-readonly-notice` — explains the lifecycle rule (låst/skickad … skapa ny version).
- `create-new-version` — the affordance Story 6.5 activates (a disabled placeholder in 6.4).
- `quote-status-badge` — the text-not-color status badge ("Skickad" for a sent version).

## Implementation Checklist (map each failing test to the tasks that make it pass)

### 6.4-UNIT-01 — send-gate rule (`tests/unit/features/quotes/send-gate.test.ts`)

- [ ] Author `canSendQuoteVersion` in `src/features/quotes/send-gate.ts` consuming `classifyReadiness`
      (or a snapshot-shaped adapter yielding the IDENTICAL blocker set) — `sendable === blockers.length === 0`.
- [ ] Delete the `declare function canSendQuoteVersion` placeholder; import from `@/features/quotes/send-gate`.
- [ ] Remove the `{ skip: ... }` from each case.
- [ ] Run: `pnpm run test:unit` (or `node --experimental-strip-types --import ./tests/support/register.mjs --test "tests/unit/features/quotes/send-gate.test.ts"`).

### 6.4-INT-01/02/03/04 — mark-sent + immutability (`tests/integration/commands/mark-quote-version-sent.int.test.ts`)

- [ ] Add the additive migration: `mark_quote_version_sent` RPC (SECURITY INVOKER, empty search_path,
      explicit `p_sent_at` parameter) + the sent-lock trigger (locked customer-visible set; EXEMPT
      `pdf_status`/`pdf_file_id`/`pdf_generated_at` + allowed lifecycle fields) + child-table locks +
      the `quote_events` append-only reconciliation.
- [ ] Add `QUOTE_VERSION_LOCKED` to `CommandErrorCode` + `COMMAND_MESSAGES` (generic Swedish; distinct
      from `QUOTE_VERSION_NOT_DRAFT`).
- [ ] Author `markQuoteVersionSent` (injected clock, resolved-tenant authority, ownership gate,
      RLS client / no service-role, `{ targetId }` audit) + register it; extend `throwMappedQuoteWriteError`.
- [ ] Import `markQuoteVersionSent`; replace the `expect.fail(...)` sentinels with the real command
      calls + uncomment the readback assertions; remove the `describe.skip`.
- [ ] Run after `supabase db reset` + POLL `/auth/v1/health` to 200 (Kong 502 false-green): `pnpm run test:int`.

### 6.4-E2E-01 — sent-lock UX (`tests/e2e/quotes/quote-sent-lock.e2e.spec.ts`)

- [ ] Add the `mark-sent-button` + `mark-sent-status` testids + the "use server" action (revalidate
      BOTH `/quotes/[id]` AND the version subroute).
- [ ] Extend `global-setup.ts` (mark-sendable draft + a blocked draft for the rejected-send case).
- [ ] Remove the `test.describe.skip(...)` header (clear the red-phase header when green).
- [ ] Run: `pnpm run test:e2e`.

## Running Tests

```bash
# Unit (fast gate) — send-gate rule
node --experimental-strip-types --import ./tests/support/register.mjs --test "tests/unit/features/quotes/send-gate.test.ts"
pnpm run test:unit

# Integration (local Supabase; after `supabase db reset` + /auth/v1/health 200 poll)
pnpm run test:int
npx vitest run tests/integration/commands/mark-quote-version-sent.int.test.ts

# E2E (CI-gated; global-setup seeds the two-tenant quote fixture)
pnpm run test:e2e
npx playwright test tests/e2e/quotes/quote-sent-lock.e2e.spec.ts
```

## Red-phase verification evidence

- `node --experimental-strip-types --import ./tests/support/register.mjs --test "tests/unit/features/quotes/send-gate.test.ts"`
  → `tests 4 / pass 0 / fail 0 / skipped 4` (fast gate stays green).
- `npx tsc --noEmit` → 0 errors across all three new scaffold files (type-clean red phase; the
  `declare` placeholder + commented green-phase assertions keep it compiling).
- `npx vitest list tests/integration/commands/mark-quote-version-sent.int.test.ts` → exit 0, no
  active tests listed (whole-describe `.skip` — collects without executing the not-yet-existent
  command/trigger).
- `npx playwright test tests/e2e/quotes/quote-sent-lock.e2e.spec.ts --list` → parses; the
  module-scope gitignored `fixture.json` load errors locally IDENTICALLY to the existing 6.2/6.3
  specs (seeded by global-setup in CI) — not a scaffold defect.

## Notes / key risks & assumptions

- **The canonical 6.4 correctness property is BOTH-layer immutability (R-605).** 6.4-INT-02
  (command → `QUOTE_VERSION_LOCKED`) AND 6.4-INT-03 (a DIRECT own-tenant AUTHENTICATED UPDATE
  rejected by the DB trigger) are BOTH mandatory — a test that only proves the UI disables the
  button is NOT evidence (architecture §9). 6.4-INT-03 uses the anon-key RLS client (`a`), NOT the
  BYPASSRLS admin pool, so the trigger RAISE — not RLS invisibility — is what rejects it.
- **The PDF-render-column exemption is the load-bearing 6.3→6.4 handoff.** 6.4-INT-03 asserts BOTH
  that a customer-visible UPDATE on a sent version is rejected AND that `pdf_status` (etc.) stays
  mutable (the 6.3 retry path). If the trigger over-locks the PDF columns, 6.3's retry-on-sent breaks.
- **Send gate reuses the 5.4 classifier — no forked rule (R-608).** 6.4-UNIT-01 pins the gate against
  `classifyReadiness`; blockers block, warnings (incl. `TAX_SIGN_OFF_REQUIRED`/`requires_sign_off`)
  never gate — the demo-data-only accepted posture. The send does NOT hard-block on unapproved terms.
- **Demo-data-only accept stands** (owner 2026-07-03): re-open (STOP → needs-human, re-score R-610 to
  a blocker) if real-customer use is proposed. No hard terms-approval gate is introduced here.
- **`QUOTE_VERSION_LOCKED` is introduced by THIS story** — distinct from 6.2's `QUOTE_VERSION_NOT_DRAFT`.
  Both codes co-exist; the INT negatives assert on the EXACT code.

## Next steps (recommended workflow)

1. `dev-story` (green phase): implement Tasks 1–5, un-skip each scaffold in priority order (UNIT → INT
   → E2E), delete every `declare` placeholder / `expect.fail` sentinel / red-phase header.
2. Add the command-layer cross-tenant negative + the 6.4-DOCS-01 delta note during dev-story.
3. Run the FULL CI gate in order (typecheck → lint → test:unit → build → test:int → test:e2e); verify
   every scaffold flips GREEN (or is a documented, justified skip). Clear ALL red-phase headers when green.
4. `automate` (given `tea_selected: [atdd, automate]` for 6.4) to expand coverage after green.
