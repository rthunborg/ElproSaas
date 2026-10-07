---
title: 'Runner cursor lookup resilience and truthful failure evidence'
type: 'bugfix'
created: '2026-10-07'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'aa60da251308a7fadd58c2a81ac24b2bfd058d98'
context: ['docs/process/review-order.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The owner approved fixing the failures identified by the seven-day review. One September 29 incident produced a producer cursor lookup failure and a runner failure; official diagnostics established Data API HTTP 504 with origin_time 8035ms, but the deeper cause is unconfirmed. Current code has no bounded retry for cursor reads, can classify all cursor-read failures as completed, and writes runner summaries with identical start/finish timestamps.

**Approach:** Repair the existing Story 13.1 runner under architecture ADR-B002 and ADR-B011. Retry only readonly cursor SELECTs after recognized transient HTTP errors within the existing invocation budget, retain safe status/category diagnostics, and make runner failure outcomes and elapsed timing truthful.

## Boundaries & Constraints

**Always:** Authenticate before privileged client construction. Preserve explicit tenant and producer filters, stable tenant continuation, schedule decisions, the existing single runner lane, atomic run/audit RPC persistence, and disabled real email. A failed read must throw, never become an undefined cursor. Retry only readonly cursor reads, never producer mutations or run persistence. Honor the injected clock/deadline and AbortSignal; bound attempts and waits. Record only controlled categories and allow-listed numeric HTTP statuses, never raw upstream messages/codes, credentials, IDs, customer data, or cursors in error summaries. Preserve historical incident records and unconfirmed causation.

**Ask First:** Any hosted rollout, schema change, release activation, new external telemetry or operations owner decision outside this approved fix.

**Never:** New module, dashboard, migration, index inferred from one 504, provider activation, credentials/.env changes, database cleanup, global infrastructure changes, or a claim that retries fix the external root cause. No commits/push/PR by the implementation author; root owns Git operations. You are not alone; preserve root routing and other authors' changes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Recovery | Cursor SELECT receives 504 then success with checkpoint | Bounded retry; exactly one execution using recovered checkpoint | No failure row from recovered read |
| Permanent error | HTTP 401/403, validation or unknown error | One read attempt, no execution for tuple | Controlled diagnostic, durable failure |
| Exhaustion | Repeated allow-listed transient HTTP failures | Fixed attempt bound; no cursor fallback or execution | Producer and runner failed, atomic record seam unchanged |
| Budget/cancel | Deadline exhausted or signal aborted before/during wait/read | No additional attempt; no producer mutation after failed lookup | Controlled deadline/cancel failure |
| Empty successful read | Successful SELECT without checkpoint | Existing due/schedule behavior | Normal empty state only after success |
| Summary timing | Synthetic clock advances during read/execute | Summary starts at supplied invocation start; ends at summary preparation | Duration reflects elapsed work, not audit completion |

</frozen-after-approval>

## Code Map

- `src/app/api/jobs/run/route.ts` — `handleJobsRunRequest` authenticates first, creates budget/deadline/signal, loads runner cursor then injects tenant-specific cursor lookup; neither cursor SELECT uses cancellation/retry. `recordRun` calls the atomic RPC.
- `src/server/jobs/runner.ts` — `runDueProducers` catches lookup failures into producer records. The `!executedProducer` return ignores `hadFailure`; `persistCursor` and `persistTerminal` set both timestamps to the current time.
- `tests/unit/server/jobs/route.test.ts` — fake fluent client queries currently return a Promise from limit; update fakes to support real abortSignal chaining when needed.
- `tests/unit/server/jobs/runner.test.ts` — pure runner scheduling/cursor coverage, no stack required.
- `supabase/migrations/20260923160000_authenticated_job_runner.sql` — readonly evidence for atomic run/audit RPC and grants; do not edit.
- `_bmad-output/implementation-artifacts/spec-13-1-authenticated-background-runner-and-producer-registry.md` — approved completed foundation, readonly trace.
- `docs/decisions/ADR-B011-epic-13-email-release-and-quote-delivery.md` and architecture-phase-b §§4.2–4.3 — bounds, containment, failure visibility and closed release posture.
- Seven-day source evidence is at `C:/Users/Rasmus/.codex/worktrees/epic13-release-decisions/ElproSaas/docs/process/epic-13-seven-day-operating-review-2026-10-07.md`; absent from this baseline. Use as readonly evidence; do not copy historical review or change it.

## Tasks & Acceptance

**Execution:**
- [x] `src/server/jobs/` and `src/app/api/jobs/run/route.ts` — implement reusable bounded cursor-read handling with signal/deadline and controlled errors; preserve query semantics.
- [x] `src/server/jobs/runner.ts` — repair all-read-failure outcome and summary elapsed timestamps; retain meaningful failures through continuation/partial paths.
- [x] `tests/unit/server/jobs/route.test.ts`, `tests/unit/server/jobs/runner.test.ts`, optionally a dedicated cursor-read unit file — cover every matrix row with deterministic mocks, including both resume and producer reads and retry wait cancellation.
- [x] This spec — record implementation verification and one author-written Suggested Review Order with verified stops.

**Acceptance Criteria:**
- Given an authorized scheduled invocation, when its readonly cursor read recovers from a 504, then execution uses the recovered checkpoint exactly once without replaying a mutation.
- Given exhausted or permanent cursor failure, when no producer executes, then producer and runner outcomes remain failed; a subsequent success must not rewrite historical failure.
- Given request cancellation or budget expiry, when a retry would occur, then it does not launch another read or dispatch work.
- Given advancing invocation time, when partial or terminal summaries are prepared, then their elapsed time starts at the invocation start and includes earlier cursor/enumeration work, while excluding their own persistence round trip.

## Spec Change Log

- 2026-10-07 implementation: preserved frozen intent. Root clarified that the approved checkpoint/audit repair includes selecting latest completed/partial progress while excluding failure-only rows; completed null still clears progress. No RPC validator or migration was changed. Independent review remains pending.
- 2026-10-07 Round 1 fix: preserve the unread tuple after pre-execution cancellation/deadline, classify composed `TimeoutError` as deadline, and prove route RPC timing across partial/terminal invocations. Frozen intent and the RPC validator remain unchanged.
- 2026-10-07 necessary CI follow-up: scoped dependency remediation for PR 83 audit failure, with installed Next lint/image compatibility evidence. Runner code and frozen intent remain unchanged; focused dependency review is pending.

## Design Notes

This is an owner-approved freeform corrective task, not a new epic story; leave sprint status and historical completed specs untouched. Root already authorized this bounded repair and independent High review. Readonly investigation: the latest atomic RPC in migration 20260928110819 permits a cursor exactly for partial outcomes. Model that contract in test RPC mocks; terminal failed summaries must have null cursors. Existing failed-plus-checkpoint execution persistence mismatch and checkpoint masking are outside this readonly-failure repair unless resolved without validator relaxation or additional approved scope. Do not change migrations. Supabase skill loaded; official changelog fetched on October 7, no relevant client breaking change found. Use installed client types/source and official abortSignal documentation to verify chaining. New managed resources require the resource guard; this repair needs only bounded mock unit commands. All nested Codex handoffs use gpt-6.1-sol High because this repair touches service-context cursor and durable failure integrity.

## Verification

Use the existing node:test loader for targeted jobs units, targeted ESLint, TypeScript noEmit, service-role containment, and the review-order checker. Install frozen dependencies with existing pnpm cache if necessary. Do not claim integration, external gateway recovery, hosted runtime SLO, or nonempty workload coverage from mocks. Capture executed/failed/skipped counts and native codes. Root performs independent review and Git publication.

### Implementation choices and executed evidence — 2026-10-07

Implemented in the uncommitted `runner-cursor-resilience` worktree against baseline `aa60da251308a7fadd58c2a81ac24b2bfd058d98`. The reusable readonly handler allows three total attempts and fixed 100/200ms waits for HTTP 408/429/500/502/503/504. An absent/empty or matching numeric HTTP error code is required: SQL, auth, validation and unknown PostgREST codes do not acquire retry semantics from a 5xx status. Diagnostics contain only the controlled scope/category and an allow-listed HTTP status. Both queries retain their producer predicates, the producer query retains its tenant predicate, and descending `created_at,id` selection is deterministic. Selecting only completed/partial rows protects previous progress from failure-only observations; a selected completed null cursor clears earlier partial progress.

Installed `@supabase/postgrest-js` 2.108.2 source inspection showed SELECT retries enabled by default and `.retry(false)` returning the fluent builder. Both cursor queries disable those retries so the handler owns the attempt bound and SQL-code classification. `.abortSignal(signal)` returns the builder and forwards the signal to fetch. Each attempt also races cancellation/deadline, so even a mock or transport that ignores its signal cannot hold the read boundary indefinitely. Request cancellation, injected cancellation, and the existing budget signal are combined. Mutations and atomic run/audit persistence are outside this retry handler.

Runner summaries now start at the supplied invocation start and finish when the summary is prepared. Earlier resume reads, enumeration and producer work are included; the summary's own RPC round trip is excluded. Permanent/exhausted failed lookups produce failed producer and terminal runner observations with null cursors. Pre-execution interruption produces a null-cursor failed producer observation followed by a partial runner observation at the same unread tuple, including carried hourly work during an off-schedule continuation. Partial summaries retain controlled failure evidence, and the late no-work deadline branch cannot relabel an earlier failure as completed. Composed abort reasons named `TimeoutError` map to deadline; ordinary caller cancellation remains cancelled. The pre-existing failed-plus-checkpoint execution persistence mismatch remains deferred; execution failures were not given relaxed RPC validation. A failed resume lookup throws before tenant enumeration/dispatch: there is no trusted tenant at that point for an atomic tenant-scoped failure row.

| Command | Executed result |
| --- | --- |
| `pnpm install --frozen-lockfile --offline` | Native 0; 413 packages reused, zero downloaded; lockfile unchanged. |
| `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/server/jobs/*.test.ts` | Native 0 after Round 1 fix; 58 executed, 58 passed, 0 failed, 0 skipped, 0 cancelled. |
| `node node_modules/eslint/bin/eslint.js src/server/jobs/cursor-read.ts src/server/jobs/runner.ts src/app/api/jobs/run/route.ts tests/unit/server/jobs/cursor-read.test.ts tests/unit/server/jobs/route.test.ts tests/unit/server/jobs/runner.test.ts` | Native 0. |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | Native 0. |
| `node scripts/verify/check-service-role-containment.mjs` | Native 0; containment passed. |
| `node scripts/verify/check-review-order.mjs _bmad-output/implementation-artifacts/spec-runner-cursor-resilience.md` | Native 0; exactly one section, 16 verified references, zero errors. |

The initial test run passed 54/55: the existing exact-record assertion detected an added `errorSummary: undefined` field. The author corrected summary construction to omit the field when no failure exists; all later runs passed. Initial pnpm check wrappers returned native 1 because of a denied package-manager store lock, and the first direct typecheck returned native 1 only because its incremental cache write was denied outside the sandbox. Installed Node entry points and `--incremental false` completed the checks without that write. These command failures are not application incidents.

Evidence limits: route query/RPC tests use synthetic in-memory rows and explicitly enforce the latest RPC's cursor-only-for-partial contract; the installed-client transport test replaces fetch. Clock/backoff tests use injected time, with focused real timer cancellation/transport deadline probes. No database, RLS integration, browser, hosted deployment, external gateway, nonempty workload, SLO or external root-cause recovery was tested. Historical incident records, migrations, email release closure and completed foundation specs were preserved. Root owns independent review and any Git publication or separately authorized hosted rollout.

## Dependency CI Follow-up

The parent authorized this necessary follow-up for PR 83 after CI run `37606280766` failed its high-severity audit. The full current HEAD baseline for this delta is `e8eb3e349bc23dc574087e3498b4e2f9574e5b8a`; the previously approved runner intent and its two completed review rounds remain intact. Owned changes are only `pnpm-workspace.yaml`, `pnpm-lock.yaml`, one Next lint package patch, two dependency compatibility test files and this non-frozen evidence/trail. No application code, schema, environment, release, infrastructure or audit policy changed.

### Dependency rationale and source evidence

- GitHub's [braces advisory GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists versions through 3.0.3 as affected and no patched version. The sole installed path was Next's ESLint plugin → fast-glob → micromatch → braces. The version-scoped `@next/eslint-plugin-next@16.3.6>fast-glob` override aliases that consumer to `tinyglobby@0.2.17`; the installed lockfile removes the obsolete fast-glob/micromatch/braces graph. A minimal package patch sets `expandDirectories: false` and derives `absolute` from `isAbsolute(rootDir)`, preserving the helper's root-directory behavior under tinyglobby's defaults. The exact patch and physical installed-helper/rule tests were ported from approved source commit `079e10531fe0751ffee666e9ef945b4c87b1453b` in the `epic14-scheduling` worktree, without its app/schema/other tests. The local fixture cleanup additionally verifies its absolute temp parent and generated prefix before deleting only that fixture.
- GitHub's [source-map-js advisory GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) identifies 1.2.2 as patched. Pinning exactly 1.2.2 replaces 1.2.1 in the Tailwind node and PostCSS paths without changing their parent versions or application styling.
- GitHub's [Sharp/librsvg advisory GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) and [published Sharp 0.35.5 release](https://github.com/lovell/sharp/releases/tag/v0.35.5) support the narrow native dependency update. The existing override already used the 0.35 family and resolved 0.35.4; it now pins exactly 0.35.5. Installed Next-local Sharp reports `sharp=0.35.5`, `rsvg=2.63.2`, `vips=8.18.7`. Native platform packages and libvips snapshots update with Sharp; no unrelated versions changed. Installed `next/dist/server/image-optimizer` still calls the same Sharp constructor, rotation, resize and encoder APIs. Actual optimizer fixtures verify PNG→WebP output with dimensions and pixel tolerance, and trusted synthetic SVG→PNG output through librsvg with exact pixels.

These primary advisory/release pages were fetched on 2026-10-07. No audit waiver, suppression, package audit exemption or threshold change was introduced.

### Executed follow-up gates

All commands first selected `C:/Users/Rasmus/.codex/worktrees/runner-cursor-resilience/ElproSaas`. Escalated host permissions were needed for this worktree/cache ACL; no managed resource was launched.

| Command | Native result and evidence |
| --- | --- |
| `pnpm install --no-frozen-lockfile` | 0; scoped resolution installed; 1 download, +4/-20 packages. Existing ESLint 9.39.4 deprecation warning retained. |
| `pnpm install --frozen-lockfile` | 0; up to date, resolution skipped. |
| `pnpm audit --audit-level=high` | 0; 2 moderate findings remain. No high/critical finding or waiver; this is not a zero-vulnerability claim. |
| `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/dependencies/next-lint-root-globs.test.ts tests/unit/dependencies/next-image-optimizer.test.ts` | 0; 4 executed, 4 passed, 0 failed/skipped/cancelled. Actual installed Next helper/rule and optimizer/native decoder; no replacements of their implementations. |
| `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/server/jobs/*.test.ts` | 0; one post-resolution run, 58 executed, 58 passed, 0 failed/skipped/cancelled. |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | 0. |
| `pnpm lint` | 0; 0 errors, 13 warnings in unchanged files. No warning in either new compatibility file. |
| `node scripts/verify/check-service-role-containment.mjs` | 0; existing containment guard passed. |
| `node scripts/verify/check-review-order.mjs _bmad-output/implementation-artifacts/spec-runner-cursor-resilience.md` | 0; one authored section, 20 verified references, zero errors. |

Limits: physical lint fixtures and trusted synthetic image buffers exercise the real installed Windows native libraries and Next utility paths. They do not exercise a full production build, Linux native execution, browser image requests, hosted deployment or adversarial payload exploitation. Earlier runner tests retain their synthetic query/RPC/fetch and clock limits. Lower-severity audit findings, the pre-existing deferred failed-plus-cursor execution mismatch and unconfirmed historical external timeout causation remain explicitly recorded. Root owns focused High dependency review as Round 3 and Git/PR operations. This handoff is in-review.

## Suggested Review Order

Author: cursor-resilience implementation author (`cursor_author`).
Refreshed against the dependency-follow-up working tree based on HEAD `e8eb3e349bc23dc574087e3498b4e2f9574e5b8a`, retaining the runner baseline `aa60da251308a7fadd58c2a81ac24b2bfd058d98` and completed Round 1/2 fixes/review. Focused High Round 3 dependency review completed without consequential findings. Code, dependencies, verified stops and recorded evidence limits remain unchanged after review.

### Authenticate and recover authoritative progress

Authentication still precedes privileged client construction. Both cursor SELECTs now choose the latest completed/partial state, preserving checkpoint progress across failure-only rows while letting completed null clear progress; tenant and producer boundaries remain explicit.

- `src/app/api/jobs/run/route.ts:81` — `handleJobsRunRequest`: shared authenticated scheduler entry.
- `src/app/api/jobs/run/route.ts:32` — `loadProducerCursor`: retains explicit tenant and producer predicates.
- `src/app/api/jobs/run/route.ts:48` — `loadResumeCursor`: deterministic global progress selection.
- `tests/unit/server/jobs/route.test.ts:323` — `resume and tenant cursor 504 recovery`: recovery AC executes the recovered checkpoint once.

### Bound only readonly retries and control diagnostics

The three-attempt handler owns status/code classification, signal propagation and deadline/backoff checks. Installed-client retries are disabled on these SELECTs so permanent errors cannot bypass that classification or multiply actual fetches; upstream messages and codes never enter diagnostics. Abort reasons distinguish a real composed budget timeout from caller cancellation.

- `src/server/jobs/cursor-read.ts:43` — `readCursor`: reusable readonly attempt boundary.
- `src/server/jobs/cursor-read.ts:78` — `isHttpError`: SQL/auth/validation codes cannot authorize retries.
- `tests/unit/server/jobs/cursor-read.test.ts:53` — `deadline expiry before reads`: fake-time budget AC covers reads and waits.
- `tests/unit/server/jobs/route.test.ts:512` — `installed Supabase transport`: actual client observes bounded GETs and no SQL-code retry.

### Keep failure outcomes and elapsed summaries truthful

Permanent/exhausted all-read failures now remain failed even when no producer executes. Interrupted reads preserve the current tuple in a partial continuation with controlled failure evidence and no failed cursor. Route-level synthetic RPC assertions prove that hourly tenant A then tenant B execute in the next off-schedule invocation, and that partial/terminal timestamps include earlier work while excluding their own persistence.

- `src/server/jobs/runner.ts:296` — `if (!executionStarted`: interrupted unread tuples retain their continuation.
- `src/server/jobs/runner.ts:310` — `if (!executedProducer)`: terminal outcome respects failed lookups.
- `tests/unit/server/jobs/runner.test.ts:589` — `all cursor lookup failures`: failure AC checks producer and runner outcomes with null cursors.
- `tests/unit/server/jobs/route.test.ts:416` — `interrupted reads preserve the hourly tuple`: continuation and timing ACs traverse the route RPC mapping.

### Check checkpoint clearing, cancellation and evidence limits

The route fake models filtered checkpoint selection and the existing atomic RPC validator. Completed-null clearing and permanent-error durability exercise failure edges. The real budget probe asserts that the composed transport signal carries `TimeoutError` while the persisted category remains deadline; continuation tests ensure partial summaries do not hide failures. The verification table above records executed commands, native codes and limits.

- `tests/unit/server/jobs/route.test.ts:374` — `completed null checkpoints`: completed state clears producer and global progress.
- `tests/unit/server/jobs/route.test.ts:401` — `permanent producer errors`: one read and durable failed observations.
- `tests/unit/server/jobs/route.test.ts:466` — `production composed budget timeout`: timeout AC persists deadline and preserves the unread tuple.
- `tests/unit/server/jobs/runner.test.ts:606` — `partial continuation retains failure evidence`: resumable state retains the earlier failure.

### Restore the audit gate while preserving Next consumers

The version-scoped lint alias removes the unpatched braces path; the small consumer patch preserves root expansion/absolute-path semantics. Exact source-map-js and Sharp pins take the published patched versions, with real installed lint and optimizer fixtures proving the exercised API boundaries. See Dependency CI Follow-up for advisory links, provenance, commands and remaining moderate findings.

- `pnpm-workspace.yaml:4` — `sharp: 0.35.5`: narrow native pin beside the source-map fix.
- `patches/@next__eslint-plugin-next@16.3.6.patch:11` — `expandDirectories: false`: preserves root-only glob results with the alias.
- `tests/unit/dependencies/next-lint-root-globs.test.ts:55` — `patched Next no-html-link-for-pages`: actual rule still diagnoses page-route anchors.
- `tests/unit/dependencies/next-image-optimizer.test.ts:30` — `installed Next optimizer decodes a synthetic SVG`: actual native SVG decoding preserves output dimensions and pixels.

Evidence: 58/58 jobs tests plus 4/4 installed dependency fixtures, zero failed/skipped; frozen install, unsuppressed high-level audit, full lint, TypeScript, containment and the refreshed 20-reference review-order checker native 0. Limits: synthetic rows/RPC/fetch and injected clocks, plus a focused real composed timeout; trusted image/lint fixtures run on Windows native libraries. No local integration, Linux native, full production build or hosted recovery claim. Two moderate audit findings and 13 lint warnings remain; the historical failed-plus-cursor execution mismatch remains deferred, and hosted rollout remains separately authorized.


### Review Findings

**Round 1 of 3**

Three independent Build review layers completed against the frozen implementation. Blind review returned two actionable patches: High consequence for advancing past an interrupted unread tuple, and Medium consequence for classifying a budget `TimeoutError` as cancellation. Verification review requested route-level elapsed-summary RPC coverage. Edge-case review returned no findings.

The author applied one scoped patch batch: typed interruption categories and abort-reason classification; same-tuple partial persistence after the null-cursor failed producer observation; and a two-invocation hourly route fixture asserting recovery order plus partial/terminal RPC timestamps. Permanent/exhausted reads with budget remaining retain their failed terminal semantics. The real composed-timeout test asserts the upstream signal reason is `TimeoutError` and the durable diagnostic category is deadline. No migration, RPC validator, release, frozen intent, root routing or historical artifact was changed.

Post-fix evidence: targeted jobs command native 0 with 58 executed/58 passed/0 failed/skipped/cancelled. Targeted ESLint, TypeScript `--noEmit --incremental false`, containment and the refreshed review-order checker returned native 0. Synthetic query/RPC/fetch and injected-clock limitations remain as recorded above; completed focused re-review is recorded below.


**Round 2 of 3 — focused accepted-fix verification**

Reused independent High blind reviewer confirmed both accepted fixes resolved: interrupted lookup retains the same tuple across off-schedule resumption, and composed budget timeout records deadline while caller cancellation records cancelled. Reused independent High verification reviewer confirmed route RPC timestamp assertions cover partial and terminal elapsed timing and the second invocation resumes the interrupted checkpoint. Neither reviewer found a consequential regression; these were readonly focused checks, with no test rerun or broad pass. No open review findings remain. Latest author execution: 58/58 targeted jobs tests, zero failures/skips/cancellations; ESLint, TypeScript noEmit with incremental disabled, service-role containment and 16-reference review-order checker native 0. Historical external timeout causation remains unconfirmed. No hosted recovery or full-invocation SLO claim; tests are synthetic/mocked.


**Round 3 of 3 — dependency CI security follow-up only**

Independent High reviewer found no concrete consequential defect in the dependency delta against e8eb3e349bc23dc574087e3498b4e2f9574e5b8a. Confirmed the version-scoped lint alias removes the braces chain, exact patched source-map-js and Sharp resolutions remain in the lockfile, no audit waiver exists, and all four actual installed Next consumer compatibility tests are included by the default unit-test glob and loader. This was readonly focused review; it did not repeat the runner review or tests. Evidence remains Windows fixtures, with no Linux native, production build, hosted or adversarial-payload claim. No open findings remain. This completes the final automatic round; further review is limited to newly changed-line regressions or unresolved consequential findings.

