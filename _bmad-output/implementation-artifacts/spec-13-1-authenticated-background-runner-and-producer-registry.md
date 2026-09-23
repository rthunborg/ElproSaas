---
title: 'Story 13.1: Authenticated Background Runner and Producer Registry'
type: 'feature'
created: '2026-09-23'
status: 'ready-for-dev'
review_loop_iteration: 0
followup_review_recommended: false
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

Status: ready-for-dev
Blocking condition: none
