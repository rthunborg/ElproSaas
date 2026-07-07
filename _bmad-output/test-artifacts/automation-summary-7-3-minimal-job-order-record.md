---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-identify-targets'
  - 'step-03-generate-tests'
  - 'step-03c-aggregate'
  - 'step-04-validate-and-summarize'
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-07-07'
inputDocuments:
  - '_bmad-output/implementation-artifacts/7-3-minimal-job-order-record-and-tenant-admin-ux.md'
  - '_bmad-output/test-artifacts/test-design-epic-7.md'
  - 'src/features/jobs/read.ts'
  - 'src/features/jobs/types.ts'
  - 'src/server/commands/jobs/validation.ts'
  - 'src/server/commands/jobs/jobs-db.ts'
  - 'tests/unit/server/commands/quote-write-error-mapper.test.ts'
---

# Test Automation Expansion — Story 7.3 (Minimal Job/Order Record & Tenant-Admin UX)

## Mode & Context

- **Skill:** `bmad-testarch-automate` — Create mode, BMad-integrated, sequential execution.
- **Stack:** fullstack (Next.js + Supabase). Two-runner split: `node --test` (pure unit),
  Vitest (`tests/integration/**`, DB-backed + pure-with-injected-client), Playwright (E2E).
- **Starting state:** Story 7.3 already `review` with a full green gate (unit 1119 / INT 597 /
  E2E 93 / build). This run **expands** coverage for the code the story landed; it does not
  re-author existing ATDD scaffolds (`update-job.int`, `job-source-of-truth.int`, the two E2E
  specs, `update-job-validation.test`, the `job-non-scope` guardrail) which already cover the
  AC-mapped rows in `test-design-epic-7.md` (7.3-INT-01/02, 7.3-E2E-01/02/03/04).

## Gap Analysis — what the existing suite did NOT cover

The ATDD/dev tests are AC-shaped and (for INT/E2E) DB/stack-backed. Two bands of **pure,
deterministic logic** in the shipped source had no fast, unconditional coverage:

1. **`readJobList` projection + AC2 filters (`src/features/jobs/read.ts`)** — had **zero**
   dedicated coverage. The DB-backed source-of-truth INT suite exercises only `readJobDetail`.
   The list projection (embedded-relation array-vs-object normalization, string→number
   coercion of the quote number, the `status` default, the four AC2 filter branches incl. the
   "no planned start ⇒ excluded from a date-range filter" edge, and the generic-error path)
   was untested.
2. **`readJobDetail` mapping edge cases** — the DB proof asserts the source-of-truth invariant
   but does not discriminate the mapping BELOW it: the PostgREST embed-shape normalizers, the
   öre `?? 0` default on a missing acceptance row, the `owner_type === "job"` + `file_id`-present
   file-link surface-hygiene guard (R-711), event-order mapping, and the null-on-missing-job path.
3. **`throwMappedJobWriteError` (`src/server/commands/jobs/jobs-db.ts`)** — the SQLSTATE →
   stable `CommandError` mapper was only exercised (skippably) through the DB-backed
   `update-job.int` suite. Its branches (23503/42501 → TENANT_ACCESS_DENIED; 23505/23514/22P02
   → VALIDATION_FAILED; unmapped/absent → generic non-`CommandError` with **no raw-message
   leak**) are pure and belong on the fast gate — mirroring the existing
   `quote-write-error-mapper.test.ts` precedent.

## Coverage Plan (by level & priority)

| Target | Level | Runner | Priority | Rationale |
| --- | --- | --- | --- | --- |
| `throwMappedJobWriteError` SQLSTATE→code mapping + no-leak | Unit (pure) | `node --test` | P1 | AC3/AC4 error contract; pure branches pinned WITHOUT a DB (never skips) |
| `readJobList` projection, embed-shape normalization, öre/number coercion, 4 AC2 filters, generic-error path | Integration (pure, injected client) | Vitest | P1 | AC1/AC2 read layer; the list projection had zero coverage |
| `readJobDetail` mapping: embed shapes, öre `?? 0` default, `owner_type='job'` file guard, event order, not-found null | Integration (pure, injected client) | Vitest | P1 | AC1 mapping the DB source-of-truth proof does not discriminate |

**Scope justification:** *selective / surgical.* The story's AC-level behavior (source-of-truth
from immutable refs, audited allowed edits, tenant isolation, deferred-surface absence,
idempotency deep-link, a11y) is already proven by the landed INT/E2E/guardrail suites. This run
adds the missing **deterministic-mapping** band only — high value because it runs on the fast
gate (no local Supabase stack required), so a PostgREST shape change, an öre-coercion regression,
a file-link surface leak, or an error-contract leak is caught even when the stack is unavailable
(where the DB-backed suites silently skip).

## Files Created

- `tests/unit/server/commands/job-write-error-mapping.test.ts` — 5 `node --test` cases pinning
  every `throwMappedJobWriteError` branch + the no-raw-message-leak assertions.
- `tests/integration/features/jobs/job-read-mapping.int.test.ts` — 13 Vitest cases driving
  `readJobList` + `readJobDetail` through a hand-built **injected fake RLS client** (no DB, no
  stack, no PII/orgnr/clock). Runs unconditionally in the `test:int` gate.

No source files changed. No new fixtures/factories/helpers required (the fake client is
self-contained; existing types reused). No Playwright CLI sessions opened (source/doc analysis
only) — nothing to clean up.

## Verification

- `job-write-error-mapping.test.ts`: **5 passed** (`node --test`).
- `job-read-mapping.int.test.ts`: **13 passed** (Vitest, ran WITHOUT the local stack — pure).
- Full unit suite: **1124 passed** (was 1119; +5), 0 fail.
- `tsc --noEmit`: clean (exit 0).
- `eslint` on both new files: 0 errors, 0 warnings.

## Assumptions & Risks

- The Vitest read-mapping spec is DB-independent BY DESIGN (injected fake client) but lives under
  `tests/integration/**` because `read.ts` transitively imports `next/headers`, which the
  `node --test` runner cannot resolve. It does not gate on the Supabase stack and never skips.
- The fake client encodes the exact PostgREST call chains `read.ts` uses today; if the read layer
  changes its query shape, update the fake alongside it (the test is intentionally coupled to the
  projection contract it protects).
- No behavioral change to the app; this is additive test coverage only.

## Next Recommended Workflow

- `bmad-testarch-trace` — refresh the epic-7 traceability matrix / quality-gate decision so the
  new mapping coverage is reflected against the 7.3 AC rows before the epic gate.
