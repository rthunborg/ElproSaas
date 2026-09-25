---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-09-23'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/spec-13-3-email-outbox-pipeline-queued-non-sending.md'
  - '_bmad-output/implementation-artifacts/epic-13-context.md'
  - '_bmad-output/test-artifacts/test-design-epic-13.md'
  - '_bmad/tea/config.yaml'
  - 'playwright.config.ts'
  - 'tests/integration/notifications/notifications.atdd.int.test.ts'
  - 'tests/e2e/notifications/notifications.atdd.e2e.spec.ts'
  - 'tests/integration/rls/tenant-table-inventory.ts'
---

# ATDD Checklist — Epic 13, Story 13.3: Email Outbox Pipeline (Queued, Non-Sending)

**Date:** 2026-09-23  
**Primary test levels:** unit, required-stack integration/RLS, static containment, and E2E

## Preflight and generation mode

The approved story has explicit acceptance criteria. The repository is a full-stack Next.js application with Vitest integration coverage and Playwright configured for browser acceptance coverage. Existing two-tenant factories, the required-stack gate, the production-mode E2E server, and the notifications route establish the test patterns.

AI generation was selected. Browser recording was not used because no Story 13.3 queue UI or fixture exists yet, and this task neither starts local services nor creates application state. Pact utilities are configured but do not apply: the outbox, jobs route, read model, and database all deploy together and Story 13.3 forbids a provider boundary.

## Acceptance criteria coverage

| Acceptance criterion | Red-phase evidence |
| --- | --- |
| Tenant-local durable enqueue and reconciliation | `13.3-UNIT-001`, `13.3-INT-001` prove same-tenant dedupe, one queue event, and tenant independence. |
| Claims, leases, retry timing, and terminal failure | `13.3-UNIT-002`, `13.3-INT-002`, and `13.3-INT-003` require real Postgres `SKIP LOCKED`, a 15-minute lease, one stale recovery, fixed 5/10/20-minute retry deadlines, and sanitized exhaustion evidence. |
| Suppression precedes delivery and has precise scope | `13.3-UNIT-003`, `13.3-INT-004`, and `13.3-RLS-003` require a tenant + recipient-hash + category match, one append-only suppressed event, and zero delivery-seam calls. |
| Dark processing and recipient entitlement projection | `13.3-UNIT-004`, `13.3-INT-005`, and `13.3-GUARD-001` through `003` require projection-only inputs, an unsuppressed `queued` row, no false sent state, no provider package/credential/call, no alternate route, and no client-reachable outbox import. |
| Admin-only queue projection and isolation | `13.3-RLS-002`, `13.3-RLS-004`, plus the four browser journeys require no raw recipient/body/failure detail, no activation control, no non-Admin visibility, and tenant isolation. |
| Fresh schema, manifest, and H4 inventory | `13.3-RLS-001` requires all three tables to have forced RLS and to be enrolled in the tenant-table inventory; green implementation also runs manifest coherence and migration reset evidence with no required skip. |

## Failing tests created — RED phase

### Unit and static containment (7 tests)

- [outbox.atdd.test.ts](C:/DEV/ElproSaas/tests/unit/server/email/outbox.atdd.test.ts) — four P0 server-contract cases for idempotency, timing, suppression, dark processing, and entitlement projection.
- [email-provider-containment.atdd.test.ts](C:/DEV/ElproSaas/tests/unit/scripts/verify/email-provider-containment.atdd.test.ts) — two P0 and one P1 containment bite cases.

### Required-stack integration and RLS (9 tests)

- [outbox.atdd.int.test.ts](C:/DEV/ElproSaas/tests/integration/email/outbox.atdd.int.test.ts) — five P0 cases for queue persistence, concurrent claims, retry exhaustion, suppression, and dark queue truthfulness.
- [email-outbox.rls.atdd.int.test.ts](C:/DEV/ElproSaas/tests/integration/rls/email-outbox.rls.atdd.int.test.ts) — three P0 and one P1 case for forced RLS/H4, direct-write and cross-tenant denial, scoped suppression, and projection hygiene.

### E2E (4 tests)

- [email-outbox.atdd.e2e.spec.ts](C:/DEV/ElproSaas/tests/e2e/notifications/email-outbox.atdd.e2e.spec.ts) — four P0 Admin/non-Admin and cross-tenant queue-view journeys on the established `/notifications` route.

Every listed case uses `test.skip()` and has behavior assertions rather than placeholders. The suite contains **20 tests: 18 P0 and 2 P1**.

## Required fixture and contract work for green phase

- Add server-only outbox dependency seams with an injected clock and test-only synthetic outcomes. Never add a provider interface or a live-send path in Story 13.3.
- Extend the tenant factories and admin SQL helpers for `email_outbox`, `email_delivery_events`, and `email_suppressions`; seed unique logical identity values and clean every fixture through the established teardown.
- Use two independent database connections around the real PostgreSQL claim statement to prove `FOR UPDATE SKIP LOCKED` gives disjoint work. Required suites set `SUPABASE_TEST_REQUIRED=1` and report executed/skipped counts.
- Extend the role-aware browser fixture with harmless queue-reference tokens for Tenant A Admin, Tenant A non-Admin, and Tenant B Admin. Browser assertions must never seed or display an email address, template body, provider payload, or raw failure data.
- Implement the static containment checker as a deterministic source graph scan with seeded forbidden provider import, credential, alternate API route, and client import bite fixtures.

## Stable UI contracts for green phase

- The existing authenticated `/notifications` route contains an Admin-only `data-testid="email-outbox-queue"` projection; it adds no navigation item.
- The compact Admin view shows truthful queued, retry, failed, and suppressed state using non-PII reference information; retry has next-attempt information and terminal failure has a sanitized summary.
- The view has no send, activate, or deliver control and does not present `sent` for unsuppressed dark work.
- Non-Admins and another tenant’s Admin cannot see foreign queue-reference rows.

## Green-phase implementation checklist

- [ ] Add the three forced-RLS tables, grants, policies, direct tenant keys, indexes, transition/append-only enforcement, and manifest/H4 enrollment in the same migration change.
- [ ] Add the server-only outbox contract: dedupe reconciliation, state transition authority, injected time, retry/lease behavior, stale recovery, immutable delivery events, and suppression-before-delivery.
- [ ] Extend the active jobs registry with an operational producer that validates active manifest ownership without becoming a notification category or preference surface; invoke it only from `/api/jobs/run`.
- [ ] Retain dark production processing: eligible unsuppressed rows stay `queued`; suppressed rows become `suppressed`; no provider dependency, credential, recipient call, public unsubscribe route, or second scheduler lane exists.
- [ ] Add the entitlement-projected template DTO and a compact Admin-only read model that excludes recipient/body/raw failure detail and activation controls.
- [ ] Wire the factory, database, static-guard, and browser fixtures; remove only the relevant skips after each implementation seam exists.

## Focused verification after implementation

```powershell
pnpm typecheck
pnpm lint
pnpm test:unit -- --test-name-pattern="email|outbox|producer|manifest|service-role"
$env:SUPABASE_TEST_REQUIRED='1'; pnpm test:int -- tests/integration/email tests/integration/rls tests/integration/jobs
pnpm test:e2e -- tests/e2e/notifications
pnpm verify:service-role-containment
pnpm build
pnpm verify:bundle-containment
```

## Red-green-refactor status

**RED complete:** the two worker handoff JSON documents validate successfully; their five intended TypeScript files exist; all 20 cases are individually skipped; and no placeholder `expect(true).toBe(true)` assertion exists. They were not executed because skipped red scaffolds would only report skips, and database/browser coverage requires project resources this authoring task must not start or adopt.

**GREEN next:** implement the migration and server seams, then remove skips selectively and run the focused required-stack evidence. **REFACTOR:** simplify only after focused tests pass while retaining the state-transition, tenant-isolation, and provider-containment negatives.

## Assumptions and deferred work

- Swedish labels and the exact read-model field names can be finalized with the UI implementation; the semantic role/name contracts and safe queue-reference behavior remain required.
- Story 13.4 owns provider SDKs, sandbox/mock queued-to-sent proof, release control, eligible live emitters, and the public unsubscribe capability. No test here authorizes delivery to a real recipient.
- Numeric runner fairness, backlog, freshness, alerting, and retention thresholds remain owner-pending; this scaffold verifies fixed per-row retry/lease mechanics without inventing broader operational thresholds.

## Knowledge applied

The strategy uses factory-based isolation, database-first setup, resilient browser role and test-id selectors, deterministic injected time, test-level selection, P0-first risk coverage, and red-phase skipping. No consumer contract was generated because this is an in-process application/database boundary and the story deliberately excludes a provider integration.
