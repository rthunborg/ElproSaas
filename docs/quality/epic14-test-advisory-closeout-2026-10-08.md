# Epic 14 test advisory closeout — 2026-10-08

Author: sensitive test-fix delegate, `gpt-6.1-sol` High.
Baseline: independently reviewed main merge `612ea4e4` on
`codex/epic14-closeout`. The owner explicitly authorized direct closeout after
the optional generated BMAD workflow could not be read. No generated workflow
source, database lifecycle, hosted target, production code, migration or
dependency was changed by this author.

## Disposition of all 48 advisory records

The original [quality review](../../_bmad-output/test-artifacts/epic-14-test-review-2026-10-07/test-review.md)
remains the immutable historical assessment: seven High and 41 Medium records.
Four consequential records have authored test repairs backed by actual affected
execution and independent High narrow review. The other 44 structural/maintenance records
remain retained advice, not repaired, rejected or waived. This report neither
recalculates the original score nor supplies a quality-score exception.

| Original records | Criterion | Count | Disposition and reason |
| --- | --- | ---: | --- |
| 1 | H3 conditional assertion | 1 High | Repaired: fixed committed oracle and independent facts/window checks executed in the 62-pass conflict suite; independent High review found no findings. |
| 2 | H2 Node-clock invitation lifetime | 1 High | Repaired: PostgreSQL initial expiry exercised by actual conflict and helper/replay suites; independent High review found no findings. |
| 3 | H2 expiry armed before observed wait | 1 High | Repaired: both observed expiry races executed in the 62-pass conflict suite; independent High review found no findings. |
| 4–19 | M4 ungrouped suites | 16 Medium | Retained structural advice to add subject grouping. No assertion defect is inferred from grouping alone. |
| 20 | H4 accumulating shared pipeline fixture | 1 High | Repaired: all nine isolated pipeline cases executed without skips; independent High review found no findings. |
| 21–23 | H5 oversized test/setup/inventory files | 3 High | Retained maintenance advice for global setup, quote-PDF validity and tenant-table inventory. No broad refactor is included. |
| 24–29 | M7 nesting | 6 Medium | Retained extraction advice. Existing lock, cleanup, authority and independent expectation contracts must remain explicit in any later refactor. |
| 30–47 | M2 repeated literal payloads | 18 Medium | Retained fresh-builder advice. Repeated literals alone do not establish a reachable defect, and expected results must remain independent. |
| 48 | M1 network-first observation | 1 Medium | Retained synchronization advice for the resource-profile browser test. No response observation or browser timeout change is included here. |

The three High size records concern `tests/e2e/global-setup.ts`,
`tests/integration/commands/quote-pdf-validity.int.test.ts` and
`tests/integration/rls/tenant-table-inventory.ts`. Their original locations and
recommended extraction boundaries remain in records 21–23. The complete
numbered original report supplies each of the 44 retained locations; grouping
here does not merge, delete or silently resolve those records.

## Exact repair decisions

### Fixed display-only writer oracle

The existing `work_role_upsert` fixture changes display text while retaining
the role's consumed ID/active state. The test now requires a committed result
regardless of what the finalizer returns; a stale regression cannot choose a
different passing branch. It asserts the expected empty warning windows and
that the actual role rename persisted. An independent current SQL facts query
removes only this command's known newly inserted booking and recomputes the
digest; the remainder must equal the pre-writer digest. This removes a known
command effect, not an unknown writer effect or a fabricated RPC response.

The separate `work_role_active` and other consumed-writer cases retain their
fixed stale result, different current digest and exact no-booking/assignment/
conflict mutation checks before the actual reattested retry. Existing real
first-gate/row-wait observations, outcome/audit assertions and foreign-state
checks remain. No production detector or SQL verifier was altered.

### Database-relative invitation validity and expiry

The initial invitation uses PostgreSQL `clock_timestamp() + interval '1 hour'`
formatted to UTC microseconds. Actual invitation preparation/finalization and
authenticated acceptance still invoke the checked production RPCs.

For the membership-row race, the test first observes acceptance blocked by the
held membership row, then sets its short database-relative deadline within the
lock owner's transaction. A positive witness requires both the request start
and the current database instant to precede expiry. Database polling proves
expiry before releasing the row; rejection, expired/unassigned membership and
the exact unchanged booking snapshot remain required.

The operation-row race needs an additional tenant-gate barrier because the
production function caches the membership expiry before waiting on its
operation row. Mutating that membership after the operation wait would either
block on its row lock or test a value the function did not consume. The test
therefore witnesses a real gate wait while the original invitation remains
valid, arms the deadline before the membership read, releases the gate, then
observes the actual operation-row wait. It requires a still-valid start/current
instant at that final barrier and an explicitly expired database instant before
releasing the operation row. Both transactions retain `finally` rollback.

This controls fixture lifetime rather than faking clocks or introducing grace.
No test timeout, runner concurrency, skip, production lifetime or assertion was
relaxed. The two-second poll deadline is exercised only after an observed
attempt; a missed still-valid barrier fails instead of claiming expiry coverage.

### Per-test pipeline facts and owned cleanup

Reachability is still probed once with the existing REQUIRED fail-closed gate.
Each test creates its own two-tenant fixture, clients and seller/Montör role
memberships. `afterEach` cleans the captured owned fixture even if later setup
or the assertion body fails; it clears the cleanup reference before awaiting
cleanup so a later test cannot reuse that ownership.

Each cross-tenant case now seeds its own B lifecycle control. The seller case
seeds both its A lifecycle and the user's legitimate B admin control before
the first read, and asserts exact one sent/accepted count instead of relying
on earlier tests' rows. The omitted-entitlement case seeds its own accepted
commitment and confirms the entitled positive money value before asserting
the omitted field is structurally absent. Existing accepted-versus-sent price,
decided follow-up, multi-page and 101-ID batch assertions remain independent
of test order. Production query, RLS and money semantics are unchanged.

## Suggested Review Order

### Predetermined writer outcome with independent facts

Start with the explicit fixture branch and follow the independent SQL digest
and durable readbacks. Consumed writers keep their distinct stale expectation.

- `tests/integration/commands/booking-conflicts.int.test.ts:290` — `writer`: selects the known fixture, never the observed outcome.
- `tests/integration/commands/booking-conflicts.int.test.ts:306` — `unchanged.factDigest`: verifies the unchanged writer facts independently.

### Real authority clock and observed blocking stages

The fixture clock matches SQL authority. The operation-row case deliberately
arms expiry before the cached membership read, after witnessing the gate wait.

- `tests/support/booking-conflict-attestation.ts:185` — `window`: reads the authoritative initial expiry.
- `tests/integration/commands/booking-conflicts.int.test.ts:586` — `one-hour`: explains expiry arming after the row barrier.
- `tests/integration/commands/booking-conflicts.int.test.ts:619` — `Acceptance caches`: explains the additional gate barrier.
- `tests/integration/commands/booking-conflicts.int.test.ts:639` — `started.live_at_start`: requires a valid observed operation-row wait.

### Isolated quote facts and explicit entitlement controls

Each case owns its state and supplies the positive lifecycle/money facts needed
by its isolation and withholding assertions.

- `tests/integration/rls/quote-pipeline-read-model.rls.test.ts:89` — `beforeEach`: owns fresh fixture/client initialization per case.
- `tests/integration/rls/quote-pipeline-read-model.rls.test.ts:113` — `afterEach`: cleans only the captured owned fixture.
- `tests/integration/rls/quote-pipeline-read-model.rls.test.ts:164` — `seedAcceptedLifecycle`: provides this case's foreign positive control.
- `tests/integration/rls/quote-pipeline-read-model.rls.test.ts:240` — `entitled.data.acceptedValueOre`: proves a real money value exists before withholding.
- `tests/integration/rls/quote-pipeline-read-model.rls.test.ts:262` — `sellerResult.data.sentCount`: requires this case's exact seller-visible count.

## Verification and ownership limits

Parent-reported static verification: typecheck native 0; targeted ESLint for all
four changed test/helper files native 0. This author did not rerun those checks.
An earlier author's pnpm escalation call was interrupted without returned native
session IDs or results; it supplies no verification credit.

This author executed zero integration/browser assertions and issued no database
command. The exclusive test slot was handed back before any author integration
runner started. The parent then executed the normal parallel required integration
gate on the isolated local stack (API 58321, database 58322), with
`SUPABASE_TEST_REQUIRED=1` and explicit synthetic booking proof configuration.
Reported actual results from that run are:

| Execution boundary | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Authored booking-conflicts suite | 62 | 0 | 0 |
| Authored quote-pipeline read-model RLS suite | 9 | 0 | 0 |
| Shared helper booking-replay-authority coverage | 12 | 0 | 0 |
| Full required integration, 1,466 registered | 1,464 | 1 | 1 |

The full run returned native exit **1** after 218.348 seconds. Its sole failure
was the generated `tenant_admin` command-boundary case in
`role-harness.atdd.int.test.ts`, with `STACK_TRACE_ERROR`; the parent is diagnosing
it. The existing CI-only recovery-Storage physical-loader skip earns no coverage.
**Affected execution passes; the full gate has not passed.** No new focused
integration rerun is credited or needed merely to duplicate these actual bodies.

The parent also reported one focused toolbar browser case passing, native 0,
with a 233 ms preview. That narrow result does not replace full browser acceptance;
the large browser case and broader closeout evidence remain parent-owned.

Independent `gpt-6.1-sol` High narrow review completed with **no findings** against
the stable final three-file diff and downstream SQL. It checked the fixed outcome,
independent digest, both post-wait expiry proofs, fresh quote fixtures and positive
controls. This is a focused advisory repair and narrow inspection, not a new broad
Story 14.3 round; its recorded broad round count remains two. Story 14.1's
three-round cap remains binding. No completion state,
quality score, retrospective acceptance, merge/release decision or hosted
approval is inferred from this author report.

## Separate browser harness inspection

This author independently inspected only the other author's small diff in
`tests/e2e/support/booking-editor-atdd.ts`, with no browser execution. No
consequential regression was identified in the changed lines: fetch failures
abort the intercepted request and rethrow the original error; actual response
and durable-save checks and existing timeout values remain. Opt-in
`E2E_BOOKING_TRANSPORT_DIAGNOSTICS=1` reports stage/count/duration only, excluding
request/proof/identity values. Fixture cleanup moves into `finally` so page
closure/unroute failure cannot skip it, retaining tenant/token/owned-ID scoping.
This supplies narrow source inspection only, not product runtime proof or an
additional broad review round. The cause of prior preview fetch failures remains
unknown until the parent's new evidence establishes it.

Reference check: official [Supabase RPC documentation](https://supabase.com/docs/reference/javascript/rpc)
was consulted for the existing call boundary; no Supabase API feature was added.
The changelog Markdown request returned HTTP 503 and was not treated as evidence
of a relevant change. Decisions above are grounded in the current repository's
enforced RPC/SQL implementation.
