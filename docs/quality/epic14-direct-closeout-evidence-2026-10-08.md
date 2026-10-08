# Epic 14 direct closeout evidence

The owner authorized direct closeout after the optional BMAD Build renderer
could not write its immutable generated workflow on Windows. This record
supplements the historical story, trace, quality and retrospective artifacts;
it does not replace their recorded execution or authorize merge/deployment.

## Source and review scope

PR [86](https://github.com/rthunborg/ElproSaas/pull/86) started closeout at
`eef577cadffaf1b67fdff362081127d77a814beb`. The isolated branch
`codex/epic14-closeout` reconciled main
`ab1ca0445b58f5f496be0d938906c744b6dff87e` in merge commit
`612ea4e43c3138e3fe20a606aa5b790c79f65d4e`, published by a fast-forward push to
the existing PR branch. Eight governance/workflow conflicts were resolved by
the Sol 6.1 High implementation delegate and independently inspected by the
Sol 6.1 High review delegate. Routing/parallel contract checks passed 63/63;
the merge handoff's review-order validator verified 12 stops.

The bounded independent follow-up inspection found no unresolved consequential
defect in the retained source fixes for 14.1, 14.2 and 14.4. Its scope covered
precision and hidden schedule data, post-wait membership authority and booking
transaction invariants, and exact editor retry, proof-size, whole-group review,
current eligibility and focus behavior. This clears the source-fix concerns
within that scope, not the remaining runtime or CI gates. It is not a new broad
review round. The historical broad-round counts remain 14.1: three; 14.2: two;
14.4: two, irrespective of stale frontmatter counters.

## Fresh local execution

All runtime work targets a dedicated synthetic local Compose stack, API 58321
and PostgreSQL 58322, with a separate production app on 58300 and a guard-owned
Chrome profile. Story 19.1's stack, browser and worktree are excluded. Hosted
demo data and credentials are not used. The saved diagnostics live in ignored
`tmp/epic14-closeout-stack/`; they contain local-only fixture configuration and
are retained for diagnosis, not published wholesale.

| Check | Observed result | Limit |
| --- | --- | --- |
| Empty application database | 0 public tables; no application migration ledger | Auth/Storage infrastructure initialized before the application chain |
| SQL migration chain and seed | Native 0; exact 99/99 version/name ledger match; expected resource tables, bucket and synthetic booking key present | `supabase db push --db-url ... --include-seed --skip-vault --yes`; this is not a CLI reset or GitHub CI substitute |
| Production build | Native 0 on Next 16.3.6; browser bundle contains the isolated API URL | Build success does not clear dependency audit |
| Typecheck | Native 0, repeated successfully after all four test/helper edits | Static evidence |
| Lint | Native 0, 0 errors, 13 pre-existing warnings | Before the closeout test-only edits |
| Unit tests | 2036 total, 2035 passed, 0 failed, 1 existing Windows xattr skip | Skip is not coverage |
| Lockfile and source/bundle containment | Native 0 for all three checks | Dependency versions unchanged |
| First browser diagnostic | Native 1; 7 passed, 16 failed, 0 skipped | Incorrect local app environment formatting was identified and corrected; no acceptance credit |
| Corrected-environment browser run | Native 1; 10 passed, 13 failed, 0 skipped, 0 flaky; 622.598 seconds | Nine preview transport timeouts and four real fixture command denials; failed run, not acceptance or HTTP performance evidence |
| REQUIRED full integration/RLS, first closeout attempt | Native 1; 1466 total, 1464 passed, 1 failed, 1 existing CI-only Storage skip; 218.348 seconds | The sole failure is the tenant-admin role harness at its unchanged 30-second per-test budget |
| Affected repaired cases in that full run | Booking conflicts 62/62, quote read-model 9/9, replay authority 12/12; no failures/skips | Actual execution, with independent High source review; does not turn the failed full run into PASS |
| Isolated tenant-admin timeout diagnosis | Native 0; 1 passed, 0 failed; 8 cases excluded by name filter; 4.576 seconds for the executed case | Separate diagnostic, not a replacement full run |
| Booking-create browser after harness repair | Native 0; 1 passed, 0 failed/skipped; 7.870 seconds test elapsed; preview fetch completed in 233 ms | Focused case only |
| Original large-review fixture after harness repair | Native 1; 0 passed, 1 failed, 0 skipped; preview fetch timed out at 15.009 seconds | Failure reproduced alone, without the teardown error; no acceptance credit |
| REQUIRED full integration/RLS, confirmation attempt | Native 1; 1466 total, 1464 passed, 1 failed, 1 existing CI-only Storage skip; 202.995 seconds | The original role harness passed; a different booking-conflict case failed during Auth fixture creation before its assertions |
| Final kernel/Next 16.3.8 static checks | Build, typecheck, lockfile and source/bundle containment native 0; lint native 0 with the same 13 warnings | Current implementation; not CI |
| Final full unit run | 2042 total, 2041 passed, 0 failed, 1 existing Windows xattr skip; 10.527 seconds | Skip is not coverage |
| Genuine 1,000-group HTTP save after kernel fix | Native 0; 1 passed, 0 failed/skipped; preview fetch 476 ms; actual action body 1,120,245 bytes; HTTP 200 | Actual unchanged 1,000 articles, one create/audit, accepted 1/open 999 assertions passed; full browser pack and integration/CI still separate |
| Final complete resource/browser pack | Native 0; 23 passed, 0 failed/skipped/flaky; 101.032 seconds | One complete run of both booking-editor and person-profile specs; no sum of separate passes |
| REQUIRED full integration/RLS after kernel/security fixes | Native 1; 1466 total, 1461 passed, 4 failed, 1 existing CI-only Storage skip; 163.289 seconds | Preview fixture actor unavailable; one existing pricing command returned failure; notification/onboarding Auth creation failed. No complete local PASS is claimed |

The corrected browser diagnostic left previews pending after `route.fetch`
timed out. Installed Playwright source establishes that the harness must
explicitly settle an intercepted route after a fetch exception; rethrowing alone
does not settle it. The page-unroute/page-close race also bypassed owned fixture
cleanup. These harness defects were repaired without increasing timeouts,
fabricating responses or changing durable assertions. They do not yet establish
the cause of the original fetch timeout. Independent High inspection found no
regression in that small repair. A provisional overlapping-peer hypothesis was
disproved against both HEAD and current source: the genuine 1,000-group fixture
already uses disjoint one-second peers, with 1,000 candidate-related pair groups.
No interval edit was made. Repeated whole-tenant validation/scanning and actual
transport stages remain under bounded diagnosis; no production performance
verdict is established.
A read-only database snapshot found no
active PostgREST query or ungranted lock, and a separate clock sample found an
approximately 2 ms database/Node difference; neither proves a general absence
of transport, clock or authorization problems.

The full integration failure's 30,015.8 ms duration matches the configured
30,000 ms role-test timeout. Installed Vitest timeout handling preserves its
registration `STACK_TRACE_ERROR`, explaining the opaque JSON report. No failed
permission assertion or underlying command exception was recorded. The isolated
case passed at the unchanged budget. The second complete normal-configuration
run also failed, at a different case: a synthetic seller Auth user could not be
created. Its recorded 1.206-second failure is fixture setup, not an observed
booking/proof assertion failure. The initial role case passed on that run. Both
native-1 runs and the filtered diagnostic remain recorded; combining their
passes does not create a full PASS. The local infrastructure failure is under
bounded diagnosis, with no timeout or parallelism waiver.

The independent High infrastructure check found one Auth admin-create POST 500
at 10:54:05 UTC, reporting PostgreSQL deadlock `40P01` / `unexpected_failure`
within the failing suite's window. The competing lock cycle was not identified.
This supports a local Auth fixture-creation deadlock, not a booking signature or
authorization failure. Services were healthy afterward, with 17/100 database
connections and no active waits. No pool-capacity, gateway-timeout or oversized
header evidence was found. Numerous DELETE cleanup 500s were separately present
and are not substituted for the one failed create request. No broad fixture
retry or infrastructure change was made from that observation alone.

The post-fix complete run has four failures in different fixture/command
surfaces. It remains failed. The actual browser pack, independent kernel byte
equivalence and repaired-case execution do not override those failures. The
owned-stack Auth/database errors are under further bounded diagnosis; the
reviewed changes will be published as draft for fresh authoritative CI, including
an empty-database chain and all required integration, browser and recovery jobs.

## Kernel diagnosis and repair route

One CPU-isolated, database-free execution of the real kernel with the actual
disjoint 1,000-peer geometry returned exactly 1,000 double-booking rows, 1,000
candidate groups and zero peer-only rows. Kernel work took 22,036.006 ms;
kernel plus serialization/HMAC/receipt work took 22,051.552 ms. The genuine
serialized save input was 1,120,180 bytes. This establishes that pure synchronous
work alone can exceed the unchanged 15-second preview fetch deadline on this
host; it does not attribute every earlier failure or certify performance targets.

The ignored benchmark and sanitized result under `test-results/` preserve
arguments, source hashes and limitations. The earlier 30/100/250 diagnostic
ran concurrently with integration; those timings are qualified accordingly.
The 1,000 run was performed once with no integration/browser runner active.
No hypothetical 1,000-overlap case was executed.

Before implementation dispatch, the narrow kernel repair was routed explicitly
to a separate Sol 6.1 High worker because full-tenant conflict completeness and
identity bind transactional review/audit behavior. Ownership covers the existing
scheduling kernel, its booking orchestration, meaningful unit equivalence and an
author review handoff. The implementation must retain complete outputs, exact
natural/group identities, microsecond precision, capacity/rounding rules,
malformed-input rejection and candidate-third aggregate associations. Reuse is
limited to one invocation; candidate-only shortcuts, smaller fixtures, shared
mutable caches and timeout changes are excluded. Independent High review and
fresh exact-source execution remain required.

The authored invocation-local batch reuse subsequently measured 76.827 ms for
the same 1,000-row/group geometry and 83.562 ms including proof work. All byte
counts stayed unchanged. A separate source-bound baseline captured directly
from 612ea4e ran native 0 and produced identical complete output and group hashes:
`b118b548a8599465d0fdfdbd1bd970bd0812fa795e6a72d549a91948650f9f0e`
and `a7434887356adf913fe6ccd2ac9d2fe4bac87eccb0deb80de7935d0dea14ea7a`.
This is bounded kernel equivalence/diagnosis, not an approved representative
performance baseline or a substitute for the genuine HTTP save.

Independent Sol 6.1 High review found no consequential defect in the stable
kernel, capacity, orchestration and meaningful equivalence tests. A final narrow
check covered added same-object invocation-isolation/malformed-mutation assertions
and indentation-only changes. No broad review round was added. The implementation
author's review trail and final static/runtime/CI checks remain separate gates.

## CI and retained gates

The PR run on merge commit 612ea4e,
[37761845641](https://github.com/rthunborg/ElproSaas/actions/runs/37761845641),
failed its blocking high-severity dependency audit. Database, browser and
isolated recovery jobs were skipped. They receive no execution credit.
The separate maintenance [PR 89](https://github.com/rthunborg/ElproSaas/pull/89)
owns the dependency upgrade; this closeout does not duplicate that lane.

PR 89 was subsequently verified merged at
`23c48b34c8a6c9158eeaf0edfca74e628d575cbc` (reviewed head
`8ba353320687adbd476ba750144ddee03e040dcb`). That main baseline was carried
forward in a clean merge, independently checked without findings and committed
as `333d05240a8ca61a42dc6c75646fb19c25e0f03d`. Its four paths
are the maintenance spec, package manifest, frozen lockfile and workspace
overrides; no conflicting closeout edits were staged with it. Frozen install
completed native 0. The canonical CI command `pnpm audit --audit-level=high`
completed native 0: zero High/Critical and two Moderate advisories. A separate
JSON audit invocation returned native 1 while reporting the same severity
inventory; it is not substituted for the canonical command. A new build and
fresh PR-head CI are required after the kernel repair.

The four sprint stories remain `review`, the epic remains `in-progress`, the
retrospective remains rejected, and PR 86 remains draft until completion gates
are supported by actual evidence. Required full integration/RLS, the browser
failure diagnosis, final CI and isolated recovery proof are still outstanding
at this record's initial publication.

### Fresh published-head CI — e1e663ce

[Run 37769139173](https://github.com/rthunborg/ElproSaas/actions/runs/37769139173)
completed with verification and isolated Storage recovery passing. The database
job failed: 1,437 passed, 28 failed and one preserved isolated-recovery skip
(1,466 total). Twenty-four failures assert historical direct authenticated
privileges absent from the fresh migration baseline. Four booking-editor
rollback cases fail during shared fault-trigger installation with PostgreSQL
`40P01`, before booking saves or rollback assertions; the rejected bootstrap
promise repeats the first error. The global DDL touches `bookings`,
`booking_conflicts` and `audit_events`, so runner isolation must account for
all interfering writers, including the separate job-runs suite.

The browser job failed with 193 passed, four failed and four existing skips. All four failures occur during
test-side review-proof setup with “booking detection is not configured.” The
production app receives the synthetic booking key through Playwright's server
environment, while the Playwright worker lacks it. This is a bounded CI
configuration repair; the local 23-case resource pack remains separate evidence.
No failed run is converted to PASS, and neither failure permits weaker
assertions, larger timeouts, restored direct grants or skipped cases.

The ACL follow-up is routed to a Sol 6.1 High author and independent High review.
Its expected privileges must derive from repository migration/caller contracts,
not observed mutation outcomes. ADR-B012's retained local authenticated grants
remain historical evidence: stricter fresh-baseline tests can fail on that
retained stack without authorizing grant changes or erasing the earlier result.
The shared runner configuration is reserved to the Coordinator lane; this
closeout does not duplicate its patch. The app and dedicated Chrome consumers
received accepted Stop requests after browser execution, preserving saved state.

### Retained local infrastructure diagnosis

The post-fix local failed run recorded Auth/database `53300` errors (connection
capacity exhausted). This host exposes 32 CPUs; the installed Vitest default
permits 31 workers, each with an admin SQL pool maximum of four, while the
dedicated PostgreSQL stack allows 100 connections before accounting for Auth,
REST and Storage. This establishes a concrete local capacity concern; it does
not attribute every opaque command failure or justify weakening required CI.
The private stack's PostgreSQL/Auth/Storage image tuple also differs from the
CLI-pinned CI tuple. Its causal contribution remains unproven.

A separate read-only fixture-cleanup inspection found orphaned tenant-owned
rows after replica-mode root deletion and ignored Auth deletion errors. A
general cleanup rewrite would need verified child ordering and ownership,
including cross-tenant actor references and global operators. No broad purge,
production change or new cleanup contract was made as part of this diagnosis.
The three failed full local executions remain recorded individually above.

The strict ACL follow-up's first five-file required diagnostic failed with
244 total, 198 passed, 46 failed and zero skips. Extending independent snapshots
exposed an assumed `id` column and nonempty assertions on privilege-only paths
without seeded targets; those test regressions were corrected before publication.
The corrected complete five-file run failed with 244 total, 220 passed, 24 failed
and zero skips. All remaining failures correspond to the retained direct ACLs
(17 DELETE and two UPDATE inventory expectations, four effective-grant matrices
and the settings DELETE case). No snapshot regression remains in that run.
It is failed retained-baseline evidence, not fresh-schema acceptance. Fresh
canonical CI remains required. The dedicated database also received an accepted
Stop request after these consumers finished, preserving its state.

Independent Sol 6.1 High review found no consequential defect in the final
worker-environment repair or corrected ACL tests. Its scope verified fixed
per-table effective matrices, preserved service-role and calculation edit
paths, strict fresh-schema denials, original concrete-row controls and
deterministic full-row snapshots. It adds no broad review round and supplies
no runtime PASS. The shared DDL runner repair and fresh exact-head CI remain
open; completion and acceptance records remain unchanged.

### Fresh ACL/worker fixes published — 1cd4ec02

[Run 37772147075](https://github.com/rthunborg/ElproSaas/actions/runs/37772147075)
completed on `1cd4ec028ffc7f0ec8ef77638950930d16612441`. Verification and isolated
Storage recovery passed. The browser job passed with **196 passed, one flaky
retry and four existing skips** (5.5 minutes). The flaky first attempt was the
person-profile save test at line 81, where the saved-status element was absent;
the retry passed. Its cause remains under bounded diagnosis. The four skips
are the existing expired-file-link case and three quote follow-up/lost-reason
retry-safety cases, and receive no coverage credit.

The REQUIRED database job failed with **1,466 total, 1,461 passed, four failed
and one existing isolated-recovery skip**, 253.89 seconds for the invocation.
All 24 earlier ACL failures are gone. The remaining four failures reproduce
the editor fault-trigger installation deadlock before assertions, so the pilot
command after the integration suite did not execute. This failed full run is
preserved; successful neighboring jobs do not make it PASS.

### Editor fault hooks follow the existing seed lifecycle

Actual root source already seeds correlation-scoped booking/conflict fault hooks
before tests. The owned editor helper is being repaired to follow that pattern:
install its three hooks during seeding and mutate only its own UUID/stage marker
during each case. Runtime hook DDL and its rejected cached bootstrap are removed.
This supersedes the proposed shared-runner repair for this Epic 14 failure; the
Coordinator-owned configuration stays untouched. No cross-chat message was sent.

The guard validated reuse of the same dedicated project and saved data under
usage resource `23f9d9fe-372f-4ec5-8f75-170b72ae5f0a`; application migrations
were not reset or reapplied. The complete current seed applied twice, native 0.
Three hooks remained installed, marker count was zero, all control-table DML
and both hook-function EXECUTE privileges were denied to anon/authenticated/
service_role, and the 99-entry migration ledger count/digest stayed unchanged.
The stage CHECK is created only for a fresh marker table; retained tables are
not relabeled or silently altered. Current helper stage/argument and actual-key
assertions retain the restricted fault behavior.

A mistyped filter first executed two accepted-identity cases, native 0, with
56 excluded cases; these are not rollback credit. The corrected filter executed
all four create/update × fault-stage rollback cases, native 0, with 54 excluded
cases. One complete six-file REQUIRED resource command run then passed **153/153,
zero failed/skipped**, 111.286 seconds measured from JSON run start to last file
end. This includes all 58 editor and 62 conflict cases plus the related round-two,
review-fix, booking and replay suites. It does not replace full fresh-schema CI.

Independent Sol 6.1 High source review found no consequential defect in the
seed/helper repair, with the retained CHECK limitation explicitly qualified.
Post-pack SQL proved zero remaining markers and all three hooks still present.
The resource received an accepted Stop request with saved state preserved.
Fresh exact-head CI for the harness repair, the profile flaky-attempt diagnosis
and completion-record reconciliation remain open. No additional broad review
round, performance/daylight certification or calendar acceptance is credited.

### Profile sequencing and current complete browser execution

The downloaded `1cd4ec02` report binds the failed first profile attempt to a
snapshot with its panel present, save enabled and a validation alert. The
exception date is blank while its kind remains `blocked_time`, despite an
earlier empty-kind assertion. The server correctly refuses this shape. Three
consecutive identical validation assertions could accept an earlier action's
status; installed React source supports a delayed form reset, but the exact
interleaving remains untraced. The repair is test-only: settle each invalid
submission's real matching Next-action response before the next edit.

The first patch unnecessarily awaited body completion for successful saves
too. Its four-profile run failed, native 1: three passed, one timeout, zero
skipped/flaky; JSON duration 81.658 seconds. The final save blocked at response
completion until the existing 60-second test timeout. That error artifact has
no page snapshot, so neither its UI state nor the precise EOF/CDP cause is
claimed. The correction limits the added barrier to the three invalid submits;
both successful submits retain their original saved-status and reload assertions.
Timeouts, retry policy, data and all original validation/persistence checks remain.

The corrected four-profile run passed, native 0: **four passed, zero failed,
skipped or flaky**, JSON duration 6.675 seconds. One complete run of the current
booking/profile pack then passed, native 0: **23 passed, zero failed, skipped
or flaky**, JSON duration 65.835 seconds. This is one actual complete run,
separate from the earlier 23-case pass and failed profile diagnostic.
The same Next 16.3.8 production build was reused because product source is
unchanged by these harness fixes. Independent High review found no consequential
defect in the corrected test, its real response witnesses or author trail.

The dedicated Chrome start request returned a broker response timeout.
No duplicate launch was attempted: List subsequently proved the new owned
registration active with verified startup evidence. After the current browser
consumers finished, SQL again proved zero editor markers and three hooks; the
app, browser and database usage registrations received accepted Stop requests,
preserving saved state. Fresh CI for the combined harness fixes remains required.

### Current main integration before final CI

The combined harness fixes were committed as
`59fce3afb591eb325bb95ad45324473b994cfe57`. Main then included verified merged
Story 19.1 [PR 87](https://github.com/rthunborg/ElproSaas/pull/87), final head
`2c768b0b52e96dfcf7615eef8ff321ff744c6150`, all five required jobs passing in
[37772222858](https://github.com/rthunborg/ElproSaas/actions/runs/37772222858),
and merge `7db3ded1e903131122eedbf9abd27548bc9c3375`. Its finished dashboard
and Documents-preparation baseline was integrated in merge commit
`cb6716a26591d66da9dbb85425de8439e4b44c34`.

The sole conflict was the sprint timestamp. A separate Sol 6.1 High author
resolved it, and an independent High reviewer verified the staged result:
all Epic 14 story/epic states and action items are preserved, and Story 19.1
remains done. The auto-merged CI keeps the booking worker pair and adds the
required dashboard job; resource activation and pending scheduling/Documents
surfaces remain coherent. The incoming runner partition is compatible with
the owned seeded hooks and retains exact-once discovery. No unfinished checkout
or another chat's services were used.

The combined tree passed TypeScript checking and all three installed-Vitest
partition discovery/order regressions. The resolved sprint/handoff diff check
and all 11 author review stops passed. A generic whole incoming diff check
reports existing Markdown hard-break/EOF whitespace in two already-merged
Epic 19 TEA documents; those authored upstream files were retained unchanged.
These checks are limited evidence, not a combined full CI PASS.

The reviewed docs-only handoff `f800692175a514cf74eef5d5cb3d19960d1b6e00`
was carried as `14dc2677256e55a0d64a9db3091d58d066492fba`, changing only
Story 19.1's actual merge/CI fields and its coordination plan. Its GitHub facts
were independently verified. The next published head requires all **five**
current CI jobs, including the dedicated dashboard browser job. Completion
records and the rejected historical retrospective remain pending that evidence.

Performance targets and representative volumes remain owner-pending and
unmeasured. Human manual accessibility/daylight evidence remains unexecuted;
automated focus/viewport assertions do not replace it. Contract D's actual
Schema/Resurser empty-slot click/drag, interval/person context and keyboard/dialog
parity remain mandatory in Story 15.1 before calendar exposure/completion. The
176 retained deferred obligations are not swept or silently resolved.

### Combined-main unit expectation repair

[CI 37777002683](https://github.com/rthunborg/ElproSaas/actions/runs/37777002683)
on `b7ac3504e357d16f3bc120ce317f164db4285429` failed verification:
2,151 unit cases, 2,150 passed, one failed, zero skipped. The four downstream
database, general browser, recovery and dashboard jobs were skipped and receive
no acceptance credit. Incoming Story 19.1's complete 101-ID query test expected
two batches using an obsolete 100-ID assumption; the approved shared 50-ID
limit correctly issued three. Production behavior and limits are unchanged.

The bounded test repair preserves every original 101/501-row fixture and pins
50 independently. Complete 101/501/1,001-ID results now require exact chunk
sizes, all IDs exactly once, exact counts/money and the complete query sequence.
The focused file passed all 46 cases, and local full units passed: **2,153 total,
2,152 passed, zero failed, one existing Windows xattr skip**, native 0, 9.589
seconds. Focused lint and typecheck also passed. These pure-reader tests do not
replace live database/browser gates. See the
[author handoff](epic14-main-query-batch-closeout-2026-10-08.md).
Fresh five-job CI remains required before official completion.

Independent Sol 6.1 High bounded review found no consequential defect in this
repair or its author trail. All seven handoff and 47 existing Story 19.1 review
stops validate; bytes outside its existing review-order section are preserved.
This follow-up adds no broad review round or status transition.

### Fresh combined-main CI exposes a seeded-hook role boundary

[CI 37778091816](https://github.com/rthunborg/ElproSaas/actions/runs/37778091816)
on `992df83b37d9831333d2fc288d3d94abc30580e3` passed verification: **2,153
units passed, zero failed or skipped**, 27.678 seconds. Isolated Storage recovery
passed its one test, and the dedicated dashboard browser job passed **57 tests**
in 1.6 minutes. The empty database migration-and-seed reset passed.

The REQUIRED database command nevertheless failed: **1,477 total / 1,463
passed / 13 failed / one preserved skip**, 268.14 seconds. All 13 failures are
in provisioning/onboarding tests; their shared `42501` error identifies private
`test_support.editor_faults` access (one reports schema access). The newly
seeded editor hook is reached by audit insertion under the restricted
provisioning role. This fresh role-context regression requires a bounded
fixture repair and independent High review; no completion is inferred from
neighboring passing jobs. The pilot command after the failed suite did not run.
The general browser job also failed: **191 passed / six failed / four existing
skips**, 7.3 minutes. Five operator-console cases reach the same restricted
provisioning hook error. The profile persistence case times out at
`response.finished()` on its first invalid submission in both attempts,
exhausting the unchanged 60-second test budget. The precise stream/EOF cause
remains unproved; earlier local helper passes do not negate this CI failure.

The private fault lookup now follows the seed's existing SECURITY DEFINER
pattern, retaining its empty search path, unchanged correlation/stage logic and
revoked control/function privileges. The marker function remains invoker. The
helper requires matching private-table/function ownership, expected execution
mode and empty search path before inserting any marker. Independent High
review found no consequential defect. Current seed application twice passed
with three hooks, zero markers, unchanged 99-entry migration history and no
API-role control access. One complete REQUIRED three-file pack passed **72/72,
zero failures/skips**, native 0, 126.964 seconds: 58 editor cases, 13 provisioning
cases and one first-admin onboarding journey. Post-pack SQL reports zero
markers/three hooks. The combined production build passes natively.

The profile helper is receiving a separate bounded repair: observe its own
registered POST response and the form's actual pending-to-settled cycle rather
than waiting for whole-stream EOF. Current runtime and independent review for
that repair, followed by fresh five-job CI, remain pending. No official status
transition has been made.

The corrected profile pending-cycle witness received independent High review
with no consequential findings. Its complete test bodies are preserved, and
the existing 15-second barrier and 60-second case budgets remain. One complete
two-file production browser pack passed **12 tests / zero failures, skips or
flakiness**, native 0, 28.741 seconds: four resource-profile cases and eight
operator-console cases. Post-pack SQL again reports zero markers/three hooks.
This is current local evidence for both repaired contexts; the earlier 23-case
run and failed EOF-based helper attempts remain separate historical evidence.
Fresh full CI is still required.

### Four passing gates and one unresolved concurrent-create case

[CI 37780712377](https://github.com/rthunborg/ElproSaas/actions/runs/37780712377)
on `abff9615b6a5b6540953f2efb28454076f007deb` passed verification (**2,153
units, zero failures/skips**, 37.878 seconds), isolated recovery (**one test**),
dashboard browser (**57 passed**, 1.3 minutes), and general browser (**197
passed, zero failed/flaky, four existing skips**, 4.3 minutes). The earlier
provisioning and profile failures are resolved in this actual full run.

Empty migration/seed reset passed, but REQUIRED integration failed: **1,477
total / 1,475 passed / one failed / one preserved skip**, 267.56 seconds.
The sole failure is the existing four-way identical booking-create case at
`tests/integration/commands/bookings.int.test.ts:244`: at least one result is
not successful. Its boolean assertion does not expose the rejection code.
The pilot command consequently did not execute. A bounded High diagnosis is
checking the helper's per-call review preparation against actual downstream
authorization, review and idempotency guards before deciding a repair. No
production defect or passing full gate is inferred from this evidence, and
official completion remains pending.

The first isolated diagnostic passed one case with 15 excluded, so it did not
reproduce or clear that CI failure. A temporary diagnostic then forced four
real preview requests to arrive before any completed, and delayed the fourth
until the first actual finalization reported committed. All replies remained
real and unchanged. The original success assertion failed with three successes
and one `COMMAND_CONFLICT`. A second diagnostic captured both actual ordering
witnesses and `BK409` from late preview preparation and the real command
snapshot. Both diagnostics failed natively, one failed case/15 excluded each;
the latter affected case took 925.7382 ms. These prove a reachable helper race,
without claiming the original CI's undisclosed result code was traced.

The permanent test repair prepares one actual signed, acknowledged review with
nonempty reviewed groups and empty selected groups before dispatching all four
real command calls concurrently. Their equality and exact one-booking,
two-assignee, one-audit and stored-outcome assertions are retained. Temporary
ordering controls are removed. The fixture's existing opt-in diagnostics now
recognize current editor RPCs and emit only bounded SQL codes/reasons and
nonsecret timing witnesses. Production SQL, replay, authority, caches, grants,
timeouts, retries and worker configuration are unchanged.

Independent High source review found no consequential defect. One complete
REQUIRED booking-command file passed **16/16, zero failures/skips**, native 0,
26.487 seconds; post-pack SQL reports zero markers/three hooks. Fresh full CI
remains required, and the failed original/controlled runs remain evidence.

The independently verified one-file planning handoff `c64832f3c47722a5601f83f04ca6b35dde6f646f`
was carried separately as `0b68dca0`, preserving its author. Its dated checkpoint
matches PR 86's draft state and the actual four-pass/one-failed `abff9615` CI
result; it carries no product edits or takeover of another writer. The root
state now records that failed run explicitly and retains review-unverified,
unfinished sprint entries and the historical rejected retrospective. Author
trails for the fixture repair and fresh five-job CI remain the next gates.
