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

Performance targets and representative volumes remain owner-pending and
unmeasured. Human manual accessibility/daylight evidence remains unexecuted;
automated focus/viewport assertions do not replace it. Contract D's actual
Schema/Resurser empty-slot click/drag, interval/person context and keyboard/dialog
parity remain mandatory in Story 15.1 before calendar exposure/completion. The
176 retained deferred obligations are not swept or silently resolved.
