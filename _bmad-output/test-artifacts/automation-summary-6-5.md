---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests']
lastStep: 'step-03-generate-tests'
lastSaved: '2026-07-06'
inputDocuments:
  - _bmad-output/implementation-artifacts/6-5-new-quote-version-after-customer-visible-changes.md
  - _bmad-output/test-artifacts/test-design-epic-6.md
  - src/server/commands/quotes/new-version.ts
  - src/server/commands/quotes/snapshot-build.ts
  - src/features/quotes/lifecycle.ts
---

# Test Automation Expansion — Story 6.5 (new quote version after customer-visible changes)

## Mode & stack

- Mode: **BMad-Integrated** (story + test-design artifacts present). Create mode.
- Stack: **fullstack** (Playwright + Vitest + `node --test`). Framework verified present.
- `tea_selected: [atdd, automate]` — ATDD scaffolds already flipped green in dev-story; this run
  EXPANDS coverage (does not re-author the headline proofs).

## Existing coverage (dev-story, verified — not duplicated)

- INT (`create-new-quote-version.int.test.ts`): 6.5-INT-01/02/03 + 6.5-RLS + R-604 concurrency (12 proofs, DB-gated).
- GOLDEN (`golden-v1-v2.test.ts`): 6.5-GOLDEN-01 v1/v2 comparison pack + R-615 privacy scan.
- UNIT: `lifecycle-transition.test.ts` (transition map + `validateMarkQuoteVersionLifecycle`),
  `create-new-quote-version-validation.test.ts` (`validateCreateNewQuoteVersion`).
- E2E (`quote-new-version.e2e.spec.ts`): 6.5-E2E-01 multi-version timeline + activated button.

## Coverage gaps identified & filled (this run — pure fast-gate, level UNIT, P1)

The DB-backed INT suite SKIPS when the local Supabase stack is unreachable, leaving these PURE
helper branches unprotected on the fast (`pnpm run test:unit`) gate. Added deterministic unit
coverage — no DB, no PII, no clock:

1. **`extractNewVersionResult`** (`src/server/commands/quotes/new-version.ts`) — the RPC-result
   normalizer. New file `tests/unit/server/commands/extract-new-version-result.test.ts` (8 tests):
   single-object vs one-row-array unwrap; bigint-as-STRING → number coercion (R-604); large safe-int;
   null/empty/non-object → null; missing/mistyped `quote_version_id` → null (defends the audit
   target); unparseable version_number → null; documents the `Number(null) === 0` finiteness quirk
   (unreachable in prod given the `version_number CHECK (>=1)`, pinned so a future guard tightening
   is deliberate). Helper exported (minimal, sanctioned) to enable the fast gate.

2. **`snapshotToPayload` / `linesToPayload` / `attachmentsToPayload`** (`snapshot-build.ts`) — the
   RPC wire contract both the 6.1 and 6.5 create commands share. New file
   `tests/unit/server/commands/snapshot-payload-serializers.test.ts` (7 tests): exact key sets;
   verbatim value copy + integer-öre / basis-point preservation; **R-607 no-cost/margin/internal-key
   leak** on the header payload AND the line payload; empty snapshot → `[]` (never null).

## Result

- New: 15 unit tests across 2 files. Unit gate **1031 pass / 0 fail / 0 skip** (was 1016).
- `pnpm typecheck` clean; `pnpm lint` 0 errors (1 pre-existing unrelated warning in
  `tests/unit/lib/money/vat.test.ts`, already logged in the story Debug Log).
- INT/E2E unchanged (additions are pure unit; no stack/browser required).
