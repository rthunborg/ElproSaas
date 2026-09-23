---
title: 'Story 13.3: Email Outbox Pipeline (Queued, Non-Sending)'
type: 'feature'
created: '2026-09-23'
status: 'ready-for-dev'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/project-context.md'
  - '_bmad-output/implementation-artifacts/epic-13-context.md'
  - '_bmad-output/planning-artifacts/architecture-phase-b.md'
  - 'docs/decisions/ADR-B011-epic-13-email-release-and-quote-delivery.md'
  - 'docs/process/review-order.md'
warnings: []
deferred:
  - 'Story 13.4 owns the provider adapter, sandbox/mock queued-to-sent proof, release control, eligible live emitters, and all public unsubscribe capability. Real-recipient delivery remains separately owner-gated by ADR-B011.'
---

<intent-contract>

## Intent

**Problem:** The active notifications infrastructure has no durable, tenant-isolated email queue, so later approved mail flows would need to couple provider delivery to domain commands and could duplicate, leak, or lose delivery state.

**Approach:** Add a dark outbox, append-only delivery history, suppression authority, entitlement-projected template contract, and an Admin-only queue view. The existing authenticated job lane may evaluate suppressed work, but unsuppressed rows remain queued until Story 13.4 installs a provider and a separately authorized release control.

## Boundaries & Constraints

**Always:** Enroll `email_outbox`, `email_delivery_events`, and `email_suppressions` in the active `notifications` manifest module and the H4/RLS inventory in the same migration change. Deduplicate by tenant plus category, subject type/id, and period. Permit only `queued → sending → sent | failed | suppressed`; store immutable delivery events and sanitized failure detail. Model three delivery attempts, exponential retry delays of 5, 10, and 20 minutes, and a 15-minute sending lease; use an injected clock. Claims must use real PostgreSQL `FOR UPDATE SKIP LOCKED`, be tenant explicit, and recover one stale lease without another delivery attempt. Suppression is tenant + normalized recipient hash + category scoped, precedes any future delivery seam, and creates `suppressed` plus an event. Template input accepts only a recipient entitlement projection; raw source records and Admin-only data never enter params or audit metadata. Reuse the sole authenticated `/api/jobs/run` lane and the contained service client; add an operational producer kind that validates active manifest ownership without treating an outbox processor as a user-visible notification category.

**Block If:** A provider SDK, SMTP/API credential, real-recipient call, provider result, public unsubscribe route, public quote route, client-reachable service context, second scheduler lane, or a pending-module producer is needed.

**Never:** Mark dark work `sending`, `sent`, or `failed` during normal production runs; alter the inactive email-preference control; duplicate Supabase Auth invitation/security mail; add an invoice or marketing path; add unsubscribe-token schema or any public surface before Story 13.4; expose queue/event recipient detail to a non-admin; or treat merge, sandbox evidence, or configuration as real-recipient authorization.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Idempotent enqueue | Same tenant/category/subject/period replay or concurrent request | One queued row and deterministic reconciliation to it | Unique collision returns the existing row without a second event or attempted send |
| Dark job pass | Eligible queued row, delivery disabled | Render entitlement-safe DTO only; leave the row queued and create no provider call/event claiming delivery | Admin view truthfully reports queued state |
| Suppressed queued mail | Current recipient/category suppression exists | Atomically move queued row to `suppressed` and append one immutable event before any delivery seam | No retry, provider call, or recipient-content disclosure |
| Claim and retry contract | Concurrent claims, retryable synthetic outcome, or expired lease | SQL claims are disjoint; retries use the fixed clock schedule; stale lease returns once to eligible queued work | Third failed attempt becomes terminal `failed` with sanitized reason and event |

</intent-contract>

## Code Map

- `src/app/api/jobs/run/route.ts:65` -- sole authenticated scheduler front door; wire an active operational outbox producer here without another API route.
- `src/server/jobs/runner.ts:38` -- bounded tenant round-robin and sanitized job-run records to reuse for dark processing.
- `src/server/jobs/producers.ts:3` -- currently couples producers to user notification categories; extend the typed registry so an active-module operational producer cannot create a preference/category surface.
- `src/server/jobs/service-client.ts:4` and `scripts/verify/check-service-role-containment.mjs:187` -- preserve jobs-only elevated context and add a permanent no-provider/no-client-reachability guard.
- `supabase/migrations/20260923170000_in_app_notifications.sql:22` -- existing email preference check deliberately remains inactive in this story.
- `src/scope/manifest.ts:231` and `src/scope/manifest-schema.ts:173` -- active notifications module and derived tenant-table inventory authority.
- `tests/integration/rls/tenant-table-inventory.ts:98` -- exhaustive literal/switch metadata required for each new tenant table.
- `_bmad-output/test-artifacts/test-design-epic-13.md:185` -- required migration, concurrency, dark-posture, projection, retry, and Admin-view evidence.
- `docs/decisions/ADR-B011-epic-13-email-release-and-quote-delivery.md:9` -- provider and real-recipient activation boundary owned by Story 13.4 and a later owner record.

## Tasks & Acceptance

**Execution:**

- `supabase/migrations/` and `src/scope/manifest.ts` -- create the three forced-RLS, explicit-grant email tables; constrain state transitions, normalized recipient-hash/category suppression, tenant dedupe, claim lease, append-only event mutations, and same-change manifest enrollment. Document the Legacy P79 queue/log/suppression delta without claiming legacy equivalence.
- `src/server/email/outbox.ts`, `src/server/email/templates.ts`, and `src/server/jobs/producers.ts` -- add server-only enqueue, entitlement-projected template DTO, fixed retry/lease state machine, suppression-before-delivery evaluation, and active-scope operational producer declaration. The production dark branch leaves eligible mail queued; test-only injected outcomes exercise claim/retry transitions without a provider interface or dependency.
- `src/app/api/jobs/run/route.ts`, `src/server/jobs/**`, and `scripts/verify/check-service-role-containment.mjs` -- dispatch the bounded tenant-explicit dark processor only through the existing route; retain null-actor producer audits with hashes/sanitized metadata and make a seeded provider import, alternate route, or client import fail the guard.
- `src/server/read-models/**`, `src/server/authz/permission-matrix.ts`, `src/components/notifications/**`, and `src/app/(app)/notifications/**` -- expose a compact Admin-only queued/retry/failed/suppressed projection under existing `Notifications.View`, with no send activation control, no new navigation item, and no raw recipient/template body exposure.
- `tests/unit/server/email/**`, `tests/integration/email/**`, `tests/integration/rls/**`, `tests/unit/scripts/verify/**`, and `tests/e2e/notifications/**` -- prove DTO projection, dedupe reconciliation, state/lease/backoff timing, append-only and RLS constraints, real-Postgres SKIP LOCKED disjoint claims, suppression, dark no-send/source-graph guard bites, and truthful Admin isolation/view states. Required database suites run with `SUPABASE_TEST_REQUIRED=1` and report executed/skipped counts.

**Acceptance Criteria:**

- Given a qualified tenant-local emitter, when it enqueues a logical email, then exactly one row stores recipient, category, template key/version/entitlement-safe params, subject/period dedupe identity, and `queued` state; same-tenant replay/concurrency reconciles to it while another tenant remains independent.
- Given queue claims and the recorded 15-minute lease, when two workers or an interrupted worker contend, then PostgreSQL `SKIP LOCKED` assigns disjoint work and an expired claim recovers once; retries occur after 5, 10, and 20 minutes and terminal exhaustion is visible with a sanitized event.
- Given a suppression matching the tenant, recipient hash, and category, when dark processing evaluates a queued row, then it becomes `suppressed` with an append-only event before any delivery seam; a non-matching tenant/category suppression has no effect.
- Given pre-13.4 delivery posture, when the registered processor runs, then eligible unsuppressed rows remain `queued`, template rendering receives only the recipient projection, no provider package/import/credential/call path exists, and no status falsely reports sent.
- Given an authenticated Admin and every other role or tenant, when they request the queue projection, then only the Admin sees truthful queue/failure/retry/suppression state without recipient body/detail or an activation control; direct writes, cross-tenant access, event mutation, and non-admin reads fail.
- Given a fresh database, when migration, manifest coherence, and H4 inventory tests run, then all three tables have the required direct tenant key, RLS, grants, policies, indexes, and append-only/transition protections with no required integration skip.

## Design Notes

The delivery state machine is created now so the schema does not need reconstruction for Story 13.4, while its only production processor path is intentionally dark. An operational producer is distinct from a notification category: it is manifest-scoped for runner safety but must not enter the user preference matrix. `sending` and provider message IDs remain available only to Story 13.4's provider adapter and sandbox path.

## Verification

**Commands:**

- `pnpm typecheck && pnpm lint` -- expected: outbox, registry, manifest, authorization, and UI contracts compile and lint.
- `pnpm test:unit -- --test-name-pattern="email|outbox|producer|manifest|service-role"` -- expected: projection, state machine, fixed clock, registry, and static guard bite cases pass.
- `$env:SUPABASE_TEST_REQUIRED='1'; pnpm test:int -- tests/integration/email tests/integration/rls tests/integration/jobs` -- expected: required migration/RLS/claim/dedupe/suppression/append-only evidence executes without required skips.
- `pnpm test:e2e -- tests/e2e/notifications` -- expected: Admin-only truthful dark queue state and non-admin isolation pass through the configured production web server.
- `pnpm verify:service-role-containment; pnpm build; pnpm verify:bundle-containment` -- expected: no provider, credential, or jobs service context is reachable outside approved server paths.

## Auto Run Result

Status: ready-for-dev

Summary: Planning completed for the queued, non-sending email outbox. The specification fixes the retry, lease, suppression, dark-processing, Admin visibility, entitlement-projection, manifest/RLS, and provider-exclusion contracts required before implementation.
