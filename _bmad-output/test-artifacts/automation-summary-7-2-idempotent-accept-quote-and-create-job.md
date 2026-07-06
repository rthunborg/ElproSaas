---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-identify-targets'
  - 'step-03-generate-tests'
  - 'step-03c-aggregate'
  - 'step-04-validate-and-summarize'
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-07-06'
workflowType: testarch-automate
story: 7.2 Idempotent Accept Quote And Create Job Command
detectedStack: fullstack
executionMode: sequential (pure fast-gate coverage expansion)
inputDocuments:
  - _bmad-output/implementation-artifacts/7-2-idempotent-accept-quote-and-create-job-command.md
  - _bmad-output/test-artifacts/test-design-epic-7.md
  - _bmad/tea/config.yaml
  - src/server/commands/quotes/accept-and-create-job.ts
  - src/server/commands/quotes/quote-db.ts
  - src/server/commands/command-errors.ts
  - tests/unit/server/commands/quote-write-error-mapper.test.ts
  - tests/integration/commands/accept-quote-and-create-job.int.test.ts
---

# Test Automation Expansion — Story 7.2 (Idempotent Accept Quote And Create Job Command)

## Context

Story 7.2 landed the highest-stakes Phase-A command: the narrow atomic idempotent
`accept_quote_and_create_job` RPC (ADR-A009) + the `acceptQuoteAndCreateJob` command, the
acceptance-UI re-point, and the accepted-affordance gating. The story arrived at status `review`
with a **comprehensive, GREEN** suite already authored during dev-story:

- **INT (DB-backed, vitest):** `accept-quote-and-create-job.int.test.ts` — 7.2-INT-01..08
  (happy path, retry idempotency, DB uniqueness backstops, atomicity/rollback via fault injection,
  cross-tenant/anon/non-sent rejection, concurrent-accept row-lock proof, event/audit completeness +
  no-dup-on-retry, already-accepted idempotent edge).
- **UNIT (fast gate, node --test):** the timestamp-injection adapter (7.2-UNIT-01), the
  input-validator + RPC-result-extractor coverage, and the accepted-quote-to-job golden oracle
  (7.2-GOLDEN-01).
- **E2E:** repeated-attempt-shows-existing.

This automate pass therefore targets **genuine residual gaps at the pure/fast-gate level** — the
7.2-introduced boundary branches that the DB-backed INT suite would SKIP when the local Supabase
stack is unreachable, and that no pure test yet pinned. No duplication of the DB-backed transaction
proofs (idempotency / atomicity / concurrency remain owned by the INT suite).

## Coverage Plan (targets, levels, priorities)

| Target (7.2-introduced) | Gap | Level | Priority | Justification |
| --- | --- | --- | --- | --- |
| `throwMappedQuoteWriteError` — the `QV703` branch | The Epic-6 mapper unit test predates 7.2; the injected-fault SQLSTATE `QV703` branch (→ generic non-CommandError → envelope SERVER_ERROR, no raw-fault leak) was unpinned at the pure level | Unit (`node --test`) | P1 | Load-bearing for AC3/NFR20 rollback signalling; pure, DB-free, protects the "rolled-back fault must not masquerade as a stable outcome + must not leak pg text" contract unconditionally (INT skips when stack down) |
| `ACCEPTANCE_ALREADY_RECORDED` code + `COMMAND_MESSAGES` entry | The one NEW stable error code 7.2 adds (Task 3.2) had no pure contract test: real union member, non-empty user-safe Swedish message, no SQL/SQLSTATE/PII leak, distinct from the reserved generic `COMMAND_CONFLICT` | Unit (`node --test`) | P1 | AC2/R-707/R-710 boundary discipline; INT only asserts the code is *one of* the allowed concurrency outcomes — never pins the message contract |

Scope justification: **selective** — the suite is already comprehensive; this pass adds only the
two high-confidence pure-boundary gaps left after an RPC-swap-heavy story. All additions are pure
(no DB, no PII, no clock), so they run in the fast `node --test` gate on every PR and never
silently skip.

## Files Created / Updated

- **Updated:** `tests/unit/server/commands/quote-write-error-mapper.test.ts` — +2 tests for the 7.2
  `QV703` injected-fault branch (non-CommandError / SERVER_ERROR mapping + no-leak).
- **Created:** `tests/unit/server/commands/command-errors-acceptance-conflict.test.ts` — 5 tests
  pinning the `ACCEPTANCE_ALREADY_RECORDED` code + message contract (union membership, code-as-message
  no-leak, non-empty user-safe Swedish message, no SQL/SQLSTATE/PII leak, distinct from
  `COMMAND_CONFLICT`).

## Validation

- Both target files run under `node --test` (fast gate): **13 pass, 0 fail** (2 new QV703 + 5 new
  ACCEPTANCE_ALREADY_RECORDED + 6 pre-existing mapper cases).
- `pnpm run typecheck` — clean.
- `eslint` on the two changed files — clean (no violations).
- No new fixtures/factories/helpers needed (both additions reuse existing pure imports:
  `throwMappedQuoteWriteError`, `CommandError`, `isCommandError`, `COMMAND_MESSAGES`).
- No CLI/browser sessions opened; no orphaned temp artifacts.

## Key Assumptions & Risks

- The DB-backed transaction proofs (idempotency, behavioral rollback, concurrent-accept row lock)
  remain the authority for AC2/AC3/NFR20; this pass deliberately does NOT re-prove them at the unit
  level (they require the real RPC + row locks). Assumption: the local Supabase INT gate stays
  enforced in CI (`SUPABASE_TEST_REQUIRED=1`) so the transaction behaviour is never silently skipped.
- The `QV703` branch is TEST-ONLY infrastructure; the new tests assert its *mapping contract*, not
  that it is reachable in production (it is not — `__faultInject` is never read from the action).

## Next Recommended Workflow

- `trace` (traceability matrix) to confirm the 7.2 AC → test mapping now includes the pure-boundary
  additions, and/or `test-review` for a quality pass over the full 7.2 suite before the epic gate.
