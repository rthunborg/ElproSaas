---
title: 'Story 10.5: Quote-Table DB Hardening and Read-Model Pagination (post-review follow-up)'
type: 'feature'
created: '2026-09-02'
status: 'done'
review_loop_iteration: 1
followup_review_recommended: false
baseline_revision: 'ea8d32963731032e9451bb46b26e3b306fb5fe47'
context:
  - 'AGENTS.md'
  - '_bmad-output/project-context.md'
  - '_bmad-output/implementation-artifacts/epic-10-context.md'
warnings: [oversized]
deferred:
  - summary: 'Manifest EpicRef closed-union/range validation is governance polish, not quote-table or pagination work.'
    evidence: '_bmad-output/implementation-artifacts/deferred-work.md:480'
    severity: low
  - summary: 'Reconciliation of stranded open follow-ups after accepted/lost transitions needs an explicit lifecycle product decision.'
    evidence: '_bmad-output/implementation-artifacts/deferred-work.md:469'
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Direct own-tenant table writes can still violate follow-up anchoring/lifecycle rules, while several quote and pipeline reads silently stop at PostgREST's `max_rows` cap. The pipeline's unchecked JavaScript addition can also lose integer-öre precision.

**Approach:** Add additive database backstops for the follow-up relationship and state machine, then make the RLS read paths complete through bounded database filtering/pagination and the canonical guarded öre sum. Preserve the already-delivered Story 10.8 command-only event/audit boundary rather than recreating it.

## Boundaries & Constraints

**Always:** Keep all reads RLS-client scoped; preserve `quote_versions` sent-lock and deferred lost-reason coherence triggers; use Europe/Stockholm calendar semantics for a follow-up due-date backstop; preserve the one-open-per-quote rule and command contracts. An authorised acceptance or successor/supersession command must atomically close any open follow-up before making its sent quote version terminal, while preserving that authorised transition's successful outcome. Direct client DML remains blocked. If either the follow-up closure or terminal transition fails, the entire authorised transition rolls back. New migration work is additive, replay-safe, force-RLS/least-privilege compatible, and must not add a table, dependency, nav item, widget, RPC, money/VAT computation, or service-role app path. `sumOre`/its failure semantics remain the sole safe-integer authority.

**Block If:** A database constraint/trigger cannot keep the sanctioned follow-up commands and Story 10.8 hardened quote wrappers working; enforcing an invariant would weaken an existing Epic-10 guard; or pagination/filter requirements require a changed list API or customer-visible product choice not defined here.

**Never:** Do not re-grant direct authenticated DML on `quote_events` or `quote_lost_reasons`; do not reintroduce post-commit audit writes (AC7/AC8 are already satisfied by Story 10.8's checked wrappers and atomic `record_audit_event`); do not derive metrics from a forgeable log, truncate to the first 1,000 rows, silently coerce an unsafe öre total, or implement the unrelated manifest/EpicRef or decided-follow-up reconciliation ledger items.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Direct follow-up write | Same-tenant draft/mismatched anchor, past Stockholm date, completed-row reopen, or prefilled completion fields | DB rejects it; only an open row on its own sent version may be created, and only open → completed or open-note edit is legal | Stable SQL failure; command maps its expected paths without exposing internals |
| Concurrent terminal transition | Plan has loaded a sent anchor while acceptance/loss races | Insert cannot leave an open follow-up on a terminal version | Transaction rolls back/rejects atomically |
| Authorised terminal transition with open follow-up | Acceptance or successor/supersession command targets a sent version with an open follow-up | The command closes the follow-up and makes the version terminal in one transaction, retaining the authorised transition's success | A failure in either operation rolls back both; direct client DML remains denied |
| Large tenant read | More than 1,000 events, versions, quotes, lost reasons, or follow-ups | Pipeline counts/value and quote-list/detail status, lost reason, filters, badges and open row are complete | Query faults retain existing generic-error posture; no partial-success result |
| Extreme commitment sum | Valid accepted prices exceed `Number.MAX_SAFE_INTEGER` in aggregate | No rounded number is returned | Canonical guarded öre failure is surfaced/fails closed |

</intent-contract>

## Code Map

- `supabase/migrations/20260719120000_quote_lost_reasons_and_lost_status.sql` -- original independent same-tenant lost-reason FKs, deferred coherence trigger, and `mark_quote_version_lost`; do not weaken it. Story 10.8 now revokes authenticated DML on this table.
- `supabase/migrations/20260719130000_quote_follow_ups.sql` -- follow-up schema, partial one-open index, direct authenticated INSERT/UPDATE grants and permissive RLS; the additive hardening migration must constrain this surface and add the detail-read index.
- `supabase/migrations/20260831124310_story_10_8_quote_review_authorization.sql` -- authoritative post-review boundary: direct lifecycle/event/lost-reason DML revoked and mutation plus audit unified. Regression-test, do not duplicate AC7/AC8.
- `src/server/commands/quotes/follow-ups.ts` -- sanctioned plan/complete/annotate envelope writes; plan derives `quote_id`, checks `sent`, and uses injected Stockholm time. Keep its API/error mappings compatible with DB enforcement.
- `src/server/read-models/quote-pipeline.ts` -- current unbounded event, acceptance, follow-up, and latest-version reads; introduce reusable bounded pagination and push exact period/id predicates to the database without changing `{ data, entitlements }`.
- `src/server/read-models/quote-pipeline-aggregate.ts` -- pure event/count/date aggregation currently performs unchecked `number` addition; reuse `@/lib/money` `sumOre` and make an unsafe aggregate fail closed.
- `src/features/quotes/read.ts` -- quote list has unbounded quotes/lost-reasons/open-follow-ups reads; detail has unbounded version/event/follow-up histories. Preserve its Swedish generic-error/degradation policy while fetching complete, query-scoped data.
- `src/lib/money/ore.ts` and `src/lib/money/index.ts` -- `sumOre` and `ORE_AMOUNT_MAX` are the canonical safe-integer öre contract; no local arithmetic fork.
- `tests/integration/commands/quote-follow-ups.int.test.ts`, `tests/integration/rls/quote-follow-ups.rls.test.ts`, `tests/integration/rls/quote-lost-reasons.rls.test.ts` -- extend DB/RLS direct-write and concurrent-transition negatives.
- `tests/integration/rls/quote-pipeline-read-model.rls.test.ts`, `tests/integration/features/quotes/quote-pipeline-list-filters.int.test.ts`, `tests/unit/server/read-models/quote-pipeline-aggregate.test.ts` -- prove multi-page completeness, safe aggregate failure, and tenant isolation.
- `tests/e2e/quotes/quote-lost-reason.e2e.spec.ts` and `tests/e2e/quotes/quote-follow-up.e2e.spec.ts` -- make shared seeded lifecycle flows retry-safe without hiding a genuine failed assertion.

## Tasks & Acceptance

**Execution:**

- `supabase/migrations/20260902120000_story_10_5_quote_table_hardening_and_pagination.sql` -- add relationship/state/Stockholm-date database enforcement for `quote_follow_ups`, with an anchor lock/recheck that closes plan-time TOCTOU; add the `(quote_id, created_at)` detail-read index. Keep historical rows and valid command transitions compatible.
- `src/server/commands/quotes/follow-ups.ts` -- adjust only where the new database error/atomicity contract requires it; retain RLS client, injected clock, derived anchor quote, audited envelope behavior, and typed public results.
- `src/server/read-models/quote-pipeline.ts` and `src/features/quotes/read.ts` -- create/reuse a bounded RLS pagination helper; push period, quote-id, version-id and open-status narrowing to PostgREST before mapping, so every described pipeline/list/detail projection is complete beyond 1,000 rows.
- `src/server/read-models/quote-pipeline-aggregate.ts` -- replace raw accepted-value addition with `sumOre`; on invalid/overflow input make the read model fail closed through its existing generic descriptor behavior, never a rounded value.
- `tests/unit/server/read-models/quote-pipeline-aggregate.test.ts` -- pin `MAX_SAFE_INTEGER` boundary and overflow failure alongside existing period/count tests.
- `tests/integration/commands/quote-follow-ups.int.test.ts`, `tests/integration/rls/quote-follow-ups.rls.test.ts`, and `tests/integration/rls/quote-lost-reasons.rls.test.ts` -- prove direct same-tenant bypasses, mismatched anchors, invalid lifecycle transitions, past due dates, and race-safe terminal transition rejection; retain cross-tenant negatives and verify no authenticated event/lost-reason write grant returns.
- `tests/integration/rls/quote-pipeline-read-model.rls.test.ts` and `tests/integration/features/quotes/quote-pipeline-list-filters.int.test.ts` -- seed more than one page with per-run UUIDs and prove counts/hit rate/value, latest terminal status, lost reasons, list filters/badges, and quote-detail open follow-up remain correct and tenant-isolated.
- `tests/e2e/quotes/quote-lost-reason.e2e.spec.ts` and `tests/e2e/quotes/quote-follow-up.e2e.spec.ts` -- make retry setup/state assertions idempotent or per-attempt isolated; do not convert the business assertion into a skip/tolerance.

**Acceptance Criteria:**

- Given an authenticated same-tenant caller bypasses commands, when it writes a lost reason or follow-up with a mismatched/draft/non-sent anchor, invalid Stockholm due date, completion shape, identity mutation, or reopen, then the database rejects it and cannot consume a legitimate lifecycle slot.
- Given planning races an authoritative transition away from `sent`, when both transactions resolve, then no open stranded follow-up is committed on that terminal quote.
- Given an authorised acceptance or successor/supersession command targets a sent version with an open follow-up, when it succeeds, then the follow-up is closed and the version is terminal atomically; when either operation fails, neither change commits, and direct client DML remains denied.
- Given any relevant tenant dataset exceeds 1,000 rows, when pipeline, list, or detail reads execute, then their metrics and displayed/filterable lifecycle facts are complete rather than a silently truncated prefix.
- Given accepted commitments overflow the safe JavaScript öre range, when aggregation executes, then it fails closed using the canonical money guard and never returns rounded money.
- Given the Story 10.8 lifecycle boundary, when a direct authenticated event/lost-reason mutation or an audit-write fault is attempted, then direct mutation remains denied and a committed checked transition includes its audit evidence atomically.

## Design Notes

The current AC7/AC8 wording predates Story 10.8. Treat that migration as resolved authoritative behavior and add regressions only; reopening its grants, wrappers, or audit design is forbidden. The new DB checks must be narrow: a follow-up is mutable only for the documented open-note and open→completed paths, while quote snapshot lifecycle guards stay the source of truth.

Pagination is a correctness boundary, not an optional performance tuning: pagination must terminate only after all RLS-visible pages are read, and in-memory filtering must never operate on a capped tenant-wide prefix. Prefer predicates that narrow secondary reads to IDs already selected, in bounded chunks compatible with PostgREST.

## Verification

**Commands:**

- `pnpm run typecheck` -- expected: new pagination/error types and query chains compile.
- `pnpm run lint` -- expected: no lint errors.
- `pnpm run test:unit -- tests/unit/server/read-models/quote-pipeline-aggregate.test.ts` -- expected: guarded öre and pagination-helper units pass without skips.
- `SUPABASE_TEST_REQUIRED=1 pnpm run test:int -- tests/integration/commands/quote-follow-ups.int.test.ts tests/integration/rls/quote-follow-ups.rls.test.ts tests/integration/rls/quote-lost-reasons.rls.test.ts tests/integration/rls/quote-pipeline-read-model.rls.test.ts tests/integration/features/quotes/quote-pipeline-list-filters.int.test.ts` -- expected: fresh local migration/reset-backed DB, RLS, race and multi-page proofs pass.
- `pnpm run test:e2e -- tests/e2e/quotes/quote-lost-reason.e2e.spec.ts tests/e2e/quotes/quote-follow-up.e2e.spec.ts` -- expected: lifecycle flows pass when retry configuration reruns them.

## Review Triage Log

### 2026-09-02 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 9 (high 1, medium 8)
- defer: 0
- reject: 7
- addressed_findings:
  - `[high] [patch]` Made the follow-up trigger authorization-first so a foreign direct write reaches ordinary RLS denial before any privileged lifecycle lookup.
  - `[medium] [patch]` Added retry-safe loss-action refresh behavior after pre-completing an open follow-up.
  - `[medium] [patch]` Added stable paginated ordering, conservative ID batches, archived-version filtering, and comprehensive large-data read-model coverage.
  - `[medium] [patch]` Completed direct-write state-machine and Story 10.8 boundary regressions, including terminal-race coverage.

### 2026-09-02 — Follow-up review pass
- intent_gap: 1 (high 1)
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 0
- addressed_findings:
  - none — the new terminal-state trigger prevents an open follow-up from reaching a terminal version, but the intent does not define whether authorised acceptance and successor flows must automatically complete the open follow-up, reject the business action, or use another lifecycle resolution. The existing Story 10.5 diff was preserved pending that product decision; `story-10-5-review-intent-gap-2026-09-02.patch` records the reviewed change set.

### 2026-09-02 — Owner decision
- Resolved the prior intent gap: authorised acceptance and successor/supersession commands atomically close an open follow-up before making the sent quote version terminal; the authorised transition remains successful, direct client DML stays blocked, and failure of either operation rolls back the entire transition.

### 2026-09-02 — Resumed follow-up review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2 (high 2)
- defer: 0
- reject: 12
- addressed_findings:
  - `[high] [patch]` Replaced the blanket terminal-follow-up rejection with an atomic database closure for the existing authorised `accepted` and `superseded` transitions; transaction rollback preserves all-or-nothing behavior and direct client DML grants remain unchanged.
  - `[high] [patch]` Added an authorised acceptance regression that proves an anchored open follow-up is completed as the sent version becomes accepted.

### 2026-09-02 — Round 2 local DB verification follow-up
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 0
- addressed_findings:
  - Added focused acceptance and successor/supersession transaction proofs, including audit-failure rollback coverage for anchored follow-ups.

## Auto Run Result

Status: done

### Local-stack verification continuation — Round 2 overall

Round 1 was completed in Phase 5. This is the completed Round 2 continuation in Phase 7 after the owner-approved terminal-transition rule; it is not a new review round and did not perform a broad review.

The approved additive migration closes an anchored open follow-up inside the same PostgreSQL transaction when the authorised acceptance command transitions a sent version to `accepted` or the authorised successor command transitions it to `superseded`. The normal terminal guard still rejects other terminal transitions with an open follow-up, and direct authenticated table DML remains denied.

Focused local-stack evidence:
- Acceptance succeeds with the source version `accepted` and its open follow-up `completed` with outcome `accepted`.
- Authorised successor creation succeeds with the source version `superseded` and its open follow-up `completed` with outcome `superseded`.
- Forced audit failures after each authorised transition leave the source version non-terminal and its follow-up open, proving the closure and terminal transition roll back together.
- Existing RLS/hardening regressions confirm direct authenticated quote/follow-up/event/lost-reason DML denial remains intact.

Summary: The owner-approved lifecycle rule is implemented as an additive database migration: authorised accepted and superseded transitions complete an anchored open follow-up in the same transaction, and the existing terminal guard continues to reject other terminal transitions with an open follow-up.

Files changed:
- `supabase/migrations/20260902123000_story_10_5_authorized_terminal_follow_up_closure.sql` — additive authorised acceptance/supersession closure backstop with transaction rollback semantics.
- `tests/integration/commands/capture-quote-acceptance.int.test.ts` — asserts successful acceptance terminal state as well as follow-up closure.
- `tests/integration/commands/create-new-quote-version.int.test.ts` — adds authorised successor/supersession closure coverage.
- `tests/integration/commands/quote-audit-rollback.int.test.ts` — includes anchored follow-ups in acceptance and successor forced-audit rollback snapshots.
- `_bmad-output/implementation-artifacts/spec-10-5-quote-table-db-hardening-and-read-model-pagination.md` — records the completed Round 2 verification.

Review findings breakdown: 0 new findings; 0 deferred; 0 dismissed. The focused pass verified only the approved fixes and their consequential regressions.

Follow-up review recommendation: false — the approved fixes and their DB-backed proof obligations are complete.

Verification performed:
- `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/commands/capture-quote-acceptance.int.test.ts tests/integration/commands/create-new-quote-version.int.test.ts tests/integration/commands/quote-audit-rollback.int.test.ts tests/integration/rls/quote-table-db-hardening.atdd.int.test.ts tests/integration/rls/quote-review-authorization-migration-reset.int.test.ts --reporter=dot` — 5 files, 42 tests passed.
- `pnpm exec eslint tests/integration/commands/capture-quote-acceptance.int.test.ts tests/integration/commands/create-new-quote-version.int.test.ts tests/integration/commands/quote-audit-rollback.int.test.ts` — passed.
- `pnpm run typecheck` — passed.
- `git diff --check` — passed.

Residual risks: none for the approved Round 2 terminal-follow-up fix; the existing two-command loss flow remains deliberately non-atomic under its established contract.
