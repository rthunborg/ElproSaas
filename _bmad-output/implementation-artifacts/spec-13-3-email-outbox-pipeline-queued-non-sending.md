---
title: 'Story 13.3: Email Outbox Pipeline (Queued, Non-Sending)'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_revision: 'cb0fb4ae799fcb5b636a3f380aeff53bcdf5fd4f'
review_loop_iteration: 0
followup_review_recommended: true
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

Status: done

Summary: Implemented the tenant-isolated, queued non-sending email outbox, dark scheduler processor, redacted Admin queue projection, manifest/RLS enrollment, and provider-containment guard. The follow-up review adds a deterministic 50-row bound to each dark tenant pass and prevents a terminal failure from advertising a future retry.

Files changed: Added outbox migrations, server email/read-model/UI paths, job registration and containment checks, and focused unit, integration/RLS, role-harness, manifest, and browser coverage. The follow-up also updates the shared RLS negative to recognize the deliberate direct-read revocation.

Review findings breakdown: This follow-up applied 4 patches (high 0, medium 3, low 1); deferred 0; rejected 14. The external diverse-model layer produced no output and was recorded as a failed review layer rather than a clean result.

Follow-up review recommendation: true (patched score 10: 3 × medium + 1 × low).

Verification performed: `pnpm typecheck` passed; `pnpm lint` passed; filtered unit suite passed 1,888 tests with 1 skipped and 0 failed; direct Story 13.3 unit/route/containment tests passed 15/15; required `SUPABASE_TEST_REQUIRED=1` integration/RLS/jobs run passed 578/578; Story 13.3 Playwright browser suite passed 4/4; service-role and built-bundle containment passed; production build passed.

Residual risks: The dark processor performs no delivery. Suppression evaluation and real transport remain Story 13.4 concerns; no provider, credential, public unsubscribe, or real-recipient path is present or authorized.

## Review Triage Log

### 2026-09-23 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 7 (high 1, medium 4, low 2)
- defer: 1 (medium 1)
- reject: 7
- addressed_findings:
  - `[high]` `[patch]` Revoked authenticated raw reads and routed Admin queue visibility through a redacted, capability-checked RPC.
  - `[medium]` `[patch]` Added claim/recovery delivery events and bound synthetic failures to active tenant/worker leases.
  - `[medium]` `[patch]` Added default scheduler-producer and provider-containment regression tests.
  - `[low]` `[patch]` Tightened recovery event selection and lease-field transition coverage.

### 2026-09-23 — Review pass

Pass: follow-up
- intent_gap: 0
- bad_spec: 0
- patch: 4 (high 0, medium 3, low 1)
- defer: 0
- reject: 14
- addressed_findings:
  - `[medium]` `[patch]` Bounded each tenant's dark render pass to 50 rows with a stable `created_at, id` order, and updated the affected mocks.
  - `[medium]` `[patch]` Omitted terminal `failed` and `suppressed` timestamps from the retry projection so the Admin UI never presents a terminal row as retryable.
  - `[medium]` `[patch]` Recognized the deliberate direct-read revocation for all three outbox tables in the shared cross-tenant negative suite.
  - `[low]` `[patch]` Restored the `notifications` module token in the intent contract.

## Final Convergence Disposition

The 2026-09-27 convergence check was limited to durable deduplication, suppression ordering, lease ownership, and the transition from the original dark queue to Story 13.4's synthetic delivery worker. Ordinary enqueue retries remain permanently deduplicated at delivery sequence 1; recipient correction is the only path that creates a later sequence. Suppression runs before release evaluation and before any claim/provider work. Queue authority remains tenant explicit and service-worker only, with an Administrator redacted projection. No consequential Story 13.3 defect remains.

## Suggested Review Order

Author: Story 13.3 implementation and final-convergence fix author.
Refreshed against code head `d770780` after Story 13.4 activation, recipient correction, and durable bounded runner convergence.

### Durable dedupe, claims, and outcomes

- `supabase/migrations/20260923175035_email_outbox_pipeline.sql:3` — defines the tenant-owned outbox, append-only delivery events, and suppression rows under forced RLS.
- `supabase/migrations/20260923175035_email_outbox_pipeline.sql:78` — `enqueue_email_outbox`: provides the original logical-subject dedupe contract.
- `supabase/migrations/20260924130000_quote_delivery_recipient_correction.sql:33` — adds positive `delivery_sequence`; `:63` makes the permanent dedupe key sequence aware; `:65` keeps ordinary replay fixed to sequence 1.
- `supabase/migrations/20260923175035_email_outbox_pipeline.sql:91` — `claim_email_outbox`: uses tenant-explicit `FOR UPDATE SKIP LOCKED` leasing.
- `supabase/migrations/20260923182954_email_outbox_security_and_state_fixes.sql` — binds retry/terminal outcomes to the active worker lease and keeps the authenticated projection redacted.
- `tests/integration/email/outbox.atdd.int.test.ts` — covers concurrent dedupe, disjoint claims, stale recovery, fixed-clock retry exhaustion, and suppression scope.

### Suppression before the active delivery seam

- `src/server/email/outbox.ts:93` — `processEmailOutbox`: applies `suppress_queued_email_outbox` before release evaluation, claiming, rendering, artifact access, or adapter submission.
- `src/server/jobs/producers.ts:28` — registers `notifications.email-outbox-delivery` as an operational producer derived from the active notifications module.
- `src/app/api/jobs/run/route.ts:96` — dispatches the producer only through the authenticated, deadline-bounded runner and keeps the normal release posture closed.
- `supabase/migrations/20260924120000_email_delivery_followup_fixes.sql:49` — consumes a valid public token into recipient/category suppression without a reactivation path.
- `tests/integration/email/email-delivery-activation.atdd.int.test.ts` — proves matching suppression prevents adapter work and that closed release leaves queued truth intact.

### Tenant isolation and presentation

- `src/server/read-models/email-outbox.ts` — checks `Notifications.View` and exposes status/retry/subject reference only.
- `tests/integration/rls/email-outbox.rls.atdd.int.test.ts` and `tests/integration/rls/role-harness.atdd.int.test.ts` — deny raw authenticated queue reads and prove own/foreign tenant projections.
- `tests/e2e/notifications/email-outbox.atdd.e2e.spec.ts` — shows truthful redacted queue states to Administrators with role and tenant denial.
- `tests/unit/scripts/verify/email-provider-containment.atdd.test.ts` — prevents alternate provider routes, credentials, and client imports.

### Evidence and limit

Base Epic 13 CI run `36339205329` passed the queue, RLS, activated suppression, and browser projection coverage within the recorded 1,896 unit, 1,205 database, and 172 browser passes. The final focused runner set passed with the email outbox producer still on the sole authenticated jobs lane. Exact-head convergence status is recorded in `docs/quality/epic-13-convergence-review-2026-09-27.md`. Real-recipient delivery, provider idempotency after acceptance, and provider-rendered unsubscribe URLs remain separately gated/deferred; the active adapter evidence is synthetic sandbox only.
