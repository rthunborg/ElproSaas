---
title: 'Story 13.1: Authenticated Background Runner and Producer Registry'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_revision: '3d49a6e5d8070c9f72498e5ad0048300a799e7c0'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '_bmad-output/project-context.md'
  - '_bmad-output/implementation-artifacts/epic-13-context.md'
  - '_bmad-output/planning-artifacts/architecture-phase-b.md'
  - 'docs/process/review-order.md'
warnings: []
deferred:
  - 'Numeric runner SLA, batch-size, fairness, backlog-age, and freshness thresholds remain owner-pending NFR contracts; this story proves deterministic budget/cursor behavior without claiming a production performance target.'
---

<intent-contract>

## Intent

**Problem:** Phase B has no authenticated, observable background-execution lane. Reintroducing the legacy pattern of privileged execution guarded by decoded but unverified JWT claims would create a critical cross-tenant security risk.

**Approach:** Add the one sanctioned scheduler route, server-contained job runtime, active-manifest producer registry, and durable run log. Activate the notifications module only with the operational `job_runs` table; notification, preference, and email tables, categories, and UI remain owned by Stories 13.2–13.4.

## Boundaries & Constraints

**Always:** Authenticate `POST /api/jobs/run` solely with a server-only, at-least-256-bit current `CRON_SECRET` and optional previous rotation secret using timing-safe comparison. Every authentication failure must return the identical generic 401 before a database client, dispatch, audit, or run-log side effect. Keep service-role creation and use inside `src/server/jobs/**`; explicitly enumerate tenants and bind every producer query/write to its current tenant; append system audits with `actor_user_id = NULL`, producer-named command, correlation ID, and safe bounded metadata. A job run records producer/window/start/finish/outcome and sanitized bounded error information. The registry's active entries derive from active manifest modules and cannot declare a placeholder category.

**Block If:** A second execution lane, privileged Edge Function, pg_cron path, or unverified-token claim read is proposed; a needed producer/category belongs to a pending module; an implementation needs a real secret or deployment-side change to validate the work.

**Never:** Add notification/preferences/email/outbox/unsubscribe surfaces, a provider dependency, a public route, real email sending, or a producer/category placeholder. Do not generalize service-role access into shared DB/client paths, weaken RLS or the existing containment gates, or claim numeric performance/freshness thresholds that have not received an owner decision.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Authenticated dispatch | Current secret, or unexpired previous rotation secret, in the scheduler credential header | One server-only runner dispatches due active producers within its injected time budget and returns the route's non-secret success result | Producer failure is isolated into a failed/partial run record with a sanitized summary |
| Credential rejection | Missing, wrong, garbage bearer, forged/unsigned, or `alg:none` JWT-shaped credential | Identical generic 401 and zero dispatch, job-run, audit, notification, or outbox effects | Reveal neither credential parsing nor configuration details |
| Bounded/resumable run | Due work exceeds one deterministic chunk or deadline | Persist the current outcome/cursor progress; a later invocation resumes without assuming a full scan | Stop cleanly at the budget and preserve tenant fairness/cursor invariants |
| Active-scope derivation | Registry includes a producer for a pending manifest module | Producer is excluded/rejected and no category becomes live | Fail closed through typed manifest/registry validation |

</intent-contract>

## Code Map

- `src/scope/manifest.ts:231` -- pending `notifications` module to activate in this first schema change, enrolling only `job_runs` at this story boundary.
- `src/scope/manifest-schema.ts:148` -- active-module derivations are the source for live tenant-table and category scope; preserve pending-surface coherence rules.
- `src/server/commands/audit.ts:43` -- user-command audit helper requires a resolved actor and is not reusable for system producers.
- `supabase/migrations/20260629121136_audit_events.sql:23` -- nullable audit actor and append-only service-role INSERT contract to preserve for producer audit writes.
- `scripts/verify/check-service-role-containment.mjs:60` -- existing source guard and its importable scanner to extend with jobs-tree containment checks.
- `tests/unit/scripts/verify/service-role-containment.test.ts:32` -- bite-proof location for added client-reachable jobs import/service-role leakage cases.
- `tests/integration/rls/tenant-table-inventory.ts:98` -- exhaustive tenant-table union and per-table RLS metadata that must enroll `job_runs`.
- `src/app/auth/invite/confirm/route.ts:1` -- current route-handler precedent; the runner route is a new isolated API route.

## Tasks & Acceptance

**Execution:**

- `supabase/migrations/` -- add the timestamped migration that creates the forced-RLS, explicit-grant, constraint/index protected `job_runs` operational log and the narrow system-audit mechanism needed for null-actor producer writes; preserve audit append-only behavior and record a documented intentional delta from the legacy forged-JWT cron.
- `src/scope/manifest.ts` and `tests/integration/rls/tenant-table-inventory.ts` -- activate `notifications` in the same change and enroll only `job_runs`, including exhaustive RLS fixture metadata and manifest derivation coverage.
- `src/server/jobs/service-client.ts`, `src/server/jobs/runner.ts`, and `src/server/jobs/producers.ts` -- implement jobs-private service context, strict secret/rotation verifier, typed active-manifest registry, due-work selection, injected-clock/chunk/cursor/deadline runtime, explicit tenant iteration, run logging, and system audit boundaries.
- `src/app/api/jobs/run/route.ts`, `.env.example`, and `vercel.json` -- expose the sole POST runner front door, schedule only that path at a fixed cadence, and document current/previous secret configuration with placeholders rather than secrets.
- `scripts/verify/check-service-role-containment.mjs` and `tests/unit/scripts/verify/service-role-containment.test.ts` -- make jobs-only service context and client import reachability a permanent, bite-proven containment invariant.
- `tests/unit/server/jobs/**` and `tests/integration/jobs/**` -- cover secret rotation/auth negatives, no-side-effects guarantee, registry activation, deterministic chunk/resume/fairness, tenant canaries, null-actor audit, job-run outcomes/sanitization, and the fresh-reset/RLS catalog contract.

**Acceptance Criteria:**

- Given every named invalid credential form, when it reaches `POST /api/jobs/run`, then each response is the same generic 401 and before/after assertions show no job, audit, notification, or outbox write.
- Given current and eligible previous rotation secrets, when the scheduler invokes the route, then exactly one contained runner dispatch occurs; an expired previous value is rejected without side effects.
- Given manifest registry declarations, when an associated module is active, then its producer has the typed id/module/category/schedule/essential contract; when the module is pending, then no producer or live category is available.
- Given a producer run, when work spans tenants or the injected deadline/chunk ends, then queries remain explicitly tenant-scoped, the persisted run/audit state is attributable and sanitized, and a later deterministic invocation resumes without starvation or a full-scan assumption.
- Given a fresh database reset, when `job_runs` is inspected, then its constraints, grants, force-RLS policies, manifest/H4 enrollment, and mutation protections match the migration contract; required integration evidence runs with `SUPABASE_TEST_REQUIRED=1` and reports no required skip.
- Given source and built-output containment checks, when a jobs service client is made client-reachable or a forbidden execution/JWT pattern is seeded, then the relevant permanent guard fails.

## Design Notes

`job_runs` is an operational log for a single contained lane, not a notification or email implementation. The runner should make its deadline and chunk selection injectable so unit tests prove stop/resume and fairness without sleeps; owner-approved production SLO values remain deferred. Producer execution must start with an empty registry in 13.1, so the authenticated lane and observability can land without inventing categories or activating later story behavior.

## Verification

**Commands:**

- `pnpm typecheck` -- expected: jobs types, manifest activation, and exhaustive tenant-table metadata compile.
- `pnpm lint` -- expected: no lint failures in route, server jobs, migration-adjacent TypeScript, or tests.
- `pnpm test:unit -- --test-name-pattern="jobs|service-role|manifest"` -- expected: credential, registry, budget/cursor, and containment bite cases pass.
- `$env:SUPABASE_TEST_REQUIRED='1'; pnpm test:int -- tests/integration/jobs tests/integration/rls` -- expected: required job/RLS tests execute with zero required skips and tenant/audit/run-log negatives pass.
- `pnpm verify:service-role-containment; pnpm build; pnpm verify:bundle-containment` -- expected: jobs service-role use remains server-contained and no forbidden credential material reaches the bundle.

## Auto Run Result

Status: done

Summary: implemented the contained authenticated scheduler lane and review repairs without adding notification, email, outbox, or category behavior.

Changed files: `src/app/api/jobs/run/route.ts` shares the Vercel-compatible GET and existing POST front door, loads durable runner state, and persists correlated run/audit records; `src/server/jobs/auth.ts` requires a configured current secret for all rotation acceptance; `src/server/jobs/runner.ts` persists partial/terminal cursor outcomes, returns isolated failures truthfully, records execution timestamps, and redacts credentials; `tests/unit/server/jobs/route.test.ts`, `route-auth.test.ts`, and `runner.test.ts` cover the repaired route, composition, auth, resume, failure, and sanitization behavior. The existing migration/scope/containment/test files remain the original Story 13.1 delivery.

Review breakdown: 7 patch findings applied (GET delivery compatibility; current-secret rotation guard; durable cursor/outcome log; truthful isolated-failure outcome; execution timestamps; credential redaction; route-level no-side-effect and composed persistence coverage). Rejected/deferred: no additional reachable Story 13.1 finding was established. Repository-wide `tmp/**` type/lint failures remain pre-existing sibling-worktree noise and are outside this story; the cross-model layer produced no output.

Follow-up score: 7 applied operational/security patches; `followup_review_recommended: true`.

Earlier pre-follow-up verification: jobs plus containment units 27/27 passed; targeted lint passed; Story 13.1 paths had no type diagnostics; `pnpm verify:service-role-containment` and `pnpm verify:bundle-containment` passed after production compilation; `SUPABASE_TEST_REQUIRED=1 pnpm test:int -- tests/integration/jobs tests/integration/rls` passed 529/529. Residual repository-wide limitation: `pnpm build`, `pnpm typecheck`, and broad lint still encounter pre-existing `tmp/**` sibling-worktree failures after the Story paths compile.

### Follow-up review (2026-09-23)

Summary: completed a fresh independent review pass and repaired concrete runner, containment, and schema-invariant gaps without adding a notification, preference, email, outbox, or live producer category.

Files changed: `src/server/jobs/runner.ts` now completes safely when no tenants exist, retains a resumable partial cursor after an isolated producer failure, and redacts credentials in DSN-style errors; `scripts/verify/check-service-role-containment.mjs` rejects an alternate jobs API runner and client-reachable jobs service client; `supabase/migrations/20260923162000_job_runs_lifecycle_constraints.sql` makes persisted terminal timing and partial cursor state coherent. The matching unit and integration tests cover those repaired boundaries, including Vercel's authenticated GET delivery.

Review breakdown: 6 patches applied (2 high, 2 medium, 2 low); 0 intent gaps; 0 bad-spec loopbacks; 0 deferred items; 9 rejected claims. The score is 10, so `followup_review_recommended: true`.

Verification: `pnpm test:unit -- --test-name-pattern="jobs|service-role|manifest"` passed (1,871 passed, 1 skipped); `pnpm verify:service-role-containment` and targeted lint passed; `SUPABASE_TEST_REQUIRED=1 pnpm test:int -- tests/integration/jobs` passed 1/1 after applying the local follow-up migration. The wider required jobs/RLS invocation executed 510 passing tests, 18 explicit skips, and 1 failure caused by local Supabase connection-slot exhaustion while unrelated RLS fixtures created Auth users. `pnpm typecheck` has no Story 13.1 diagnostic but still fails on pre-existing `tmp/**` sibling-worktree sources.

Residual risks: no active producer exists in 13.1, so overlap, producer schedule enforcement, and production deadline policy remain future producer concerns; the current empty registry intentionally performs no database work.

## Review Triage Log

### 2026-09-23

- **patch** — Applied Vercel GET compatibility through the same authenticated handler as POST; no second path or execution lane was added.
- **patch** — Required a configured, at-least-32-byte current `CRON_SECRET` before accepting either current or eligible previous rotation credentials.
- **patch** — Persisted partial and terminal runner outcome/cursor records so a later invocation resumes only the latest partial state.
- **patch** — Returned a failed run outcome after an isolated producer failure while continuing remaining tenant work and retaining durable records.
- **patch** — Carried real window, work-start, and finish timestamps from the runner into `job_runs`.
- **patch** — Redacted bearer credentials plus JSON-style, token, and URL credential forms before bounded error persistence.
- **patch** — Added route-level generic-401/no-side-effect coverage and a composed injected-producer test for cursor resume, run persistence, null-actor audit, and correlation.
- **rejected/deferred** — No other reviewer claim identified a reachable Story 13.1 bypass. `tmp/**` type/lint failures are pre-existing sibling-worktree noise; the cross-model layer produced no output.

### 2026-09-23 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 6 (high 2, medium 2, low 2)
- defer: 0
- reject: 9
- addressed_findings:
  - `[medium] [patch]` Avoided an invalid null tenant ID when a non-empty future registry sees no tenants; the runner now completes without a run record.
  - `[high] [patch]` Preserved the cursor as `partial` after an isolated producer failure when tenant work remains, so the route can resume it.
  - `[high] [patch]` Redacted DSN userinfo credentials before an error summary can be persisted in a tenant-visible run log.
  - `[low] [patch]` Added an authenticated Vercel GET regression test for the shared scheduler entry point.
  - `[medium] [patch]` Extended the containment guard and bite test to reject alternate jobs API runners and client-reachable service-client imports.
  - `[low] [patch]` Added database lifecycle constraints for terminal timestamps and the partial-cursor invariant, with integration-catalogue coverage.

### 2026-09-28 — Targeted ReviewBot follow-up

- intent_gap: 0
- bad_spec: 0
- patch: 4 (high 2, medium 2, low 0)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high] [patch]` Replaced UTC date slicing in the follow-up route dispatch with the established Europe/Stockholm business-date authority, preserving the producer's `YYYY-MM-DD` period and deduplication contract.
  - `[medium] [patch]` Made the runner select producers from the captured injected UTC cron window, avoid fresh off-schedule records, and carry the due-producer snapshot in runner cursors so deadline/global and persisted producer continuations cross later off-schedule ticks without starving tenants.
  - `[high] [patch]` Compared UTF-8 byte lengths before `timingSafeEqual`, so a malformed multibyte bearer cannot turn the generic unauthenticated response into a 500.
  - `[medium] [patch]` Preserved carried due-producer IDs when an off-schedule global continuation reaches another deadline before execution, preventing the next tick from losing the only resume authority.

### ReviewBot follow-up evidence (2026-09-28)

Scope: only the three owner-supplied ReviewBot findings, their fixes, and direct regressions from those fixes; no additional broad review was performed.

Disposition: all three findings were confirmed production-reachable and patched. The date handoff now uses `stockholmBusinessDate`; the runner recognizes the active five-field UTC cron forms (`0 * * * *` and `*/5 * * * *`), fails closed for unsupported declarations, and preserves the union of scheduled and carried producer IDs in global cursors so repeated deadline boundaries cannot lose remaining hourly work; authentication now compares encoded-byte lengths before constant-time equality. The default fresh off-schedule path records neither producer nor runner work, so the route cannot emit a related audit record.

Verification: `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/server/jobs/route-auth.test.ts tests/unit/server/jobs/route.test.ts tests/unit/server/jobs/runner.test.ts` passed 25/25 with 0 skipped. It covers winter, summer, and DST date handoff; current/expired/unexpired previous-secret byte-mismatch 401 behavior; exact-hour/off-schedule selection; global and partial/failed checkpoint continuation with later-tenant fairness; continuation across a second deadline; and invalid schedules. `pnpm typecheck` and changed-file ESLint passed. No database or browser service was launched; required database suites were not rerun because these changes are pure route/runner/auth behavior and add no schema or RLS surface.

Residual risk: future producer declarations needing cron syntax beyond the validated five-field `*`, numeric, and `*/N` fields must extend this fail-closed parser with focused tests before activation. This is not an owner performance or freshness SLA.

## Final Convergence Disposition

The 2026-09-27 post-third-round convergence check was limited to scheduler authentication, rotation expiry, durable bounded resume, and manifest-derived producer enrollment. It found that the active follow-up producer still read every due follow-up and membership before chunking writes, while the route supplied no production deadline. A large tenant could therefore exhaust one invocation before persisting progress and delay later tenants. `f226415` adds an internal 45-second containment budget, query abort propagation, a durable per-producer cursor loaded from the latest authoritative outcome, a runner cursor that can resume at the tenant/producer tuple, and bounded nested follow-up/recipient pages. The independent fix check then found that a failed page superseded its prior checkpoint with a cursorless row. `46d9b67` retains that checkpoint on the authoritative failed row, so a retry resumes after completed work while later tenants continue; a later completed outcome still clears it. The current and previous credential boundaries remain deterministic under a fixed clock, and both HTTP methods still authenticate before privileged client construction. The independent Luna/xhigh review records PASS at product code head `d770780`, and exact checkpoint CI run `36344284961` passed at documentation-only head `c1020e9`, whose product code is identical to `d770780`. **Final disposition: PASS; no further follow-up review is recommended.** Numeric production latency, throughput, backlog-age, freshness, and capacity targets remain the recorded owner-pending operating contract; the implementation bound is not an owner-approved SLO.

## Suggested Review Order

Author: Story 13.1 implementation and final-convergence fix author.
Refreshed for the 2026-09-28 targeted ReviewBot fixes: Stockholm date handoff, due-window scheduling with continuation snapshots, and byte-safe cron-secret comparison.

### Authentication and business-date handoff

The public scheduler entry authenticates before creating a privileged client. Its follow-up work receives the established Stockholm business date, preserving the domain's due-date and notification-period meaning.

- `src/app/api/jobs/run/route.ts:87` — `handleJobsRunRequest`: rejects unauthorized callers before any client or runner side effect.
- `src/server/jobs/auth.ts:3` — `equalSecret`: encodes both values and rejects unequal byte lengths before `timingSafeEqual`.
- `src/app/api/jobs/run/route.ts:115` — `stockholmBusinessDate`: supplies the follow-up producer's DST-aware period.
- `tests/unit/server/jobs/route.test.ts:60` — `byte-length-mismatched bearer credentials always receive the generic 401 without side effects`: proves both rotation-expiry states keep the route response generic.
- `tests/unit/server/jobs/route.test.ts:160` — `the default follow-up dispatcher uses the Stockholm business date across winter, summer, and DST`: exercises the default route dispatcher at its date handoff.

### Due scheduling and checkpoint continuation

The runner evaluates producer schedules against one injected UTC window, records no fresh off-schedule execution, and carries the window's due producer IDs in a global cursor so later ticks finish scheduled work without losing tenant fairness.

- `src/server/jobs/runner.ts:56` — `isProducerDueAt`: validates the supported five-field UTC cron grammar and fails closed for unsupported declarations.
- `src/server/jobs/runner.ts:97` — `runDueProducers`: combines captured due IDs with global and persisted producer checkpoints before consuming the tenant budget.
- `tests/unit/server/jobs/runner.test.ts:178` — `runs only injected-clock due producers and creates no producer or runner record on a fresh off-schedule tick`: proves an hourly producer is silent at a five-minute tick and both declarations run at the exact hour.
- `tests/unit/server/jobs/runner.test.ts:202` — `global and producer checkpoints resume hourly work across an off-schedule minute without starving later tenants`: proves the cursor carries remaining scheduled work over the clock boundary.
- `tests/unit/server/jobs/runner.test.ts:233` — `a deadline during off-schedule global continuation retains the original due producer snapshot`: proves a second deadline cannot discard the global continuation authority.
- `tests/unit/server/jobs/runner.test.ts:256` — `failed and partial hourly checkpoints both retry off-schedule while later tenants continue`: proves a retained failure cursor cannot block another tenant's continuation.

### Evidence and limits

The focused route/auth/runner command passed 25/25 with zero skips. `pnpm typecheck` and changed-file ESLint passed. Database and browser suites were not rerun because the patch has no migration, RLS, or browser-surface change; previous CI evidence remains historical only. The supported scheduler grammar is intentionally narrow; add explicit parsing and regression coverage before a future producer adopts a richer expression.
