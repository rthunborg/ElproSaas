---
title: 'Story 12.1: Platform Operator Identity and the Provision-Tenant Command'
type: 'feature'
created: '2026-09-17'
status: 'blocked'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/project-context.md'
  - '_bmad-output/implementation-artifacts/epic-12-context.md'
  - '_bmad-output/planning-artifacts/architecture-phase-b.md'
  - 'docs/process/review-order.md'
warnings:
  - 'intent-gap'
deferred: []
---

<intent-contract>

## Intent

**Problem:** ElproSaas has no narrowly authorised, auditable way to establish an independent company tenant and its first Admin without engineering intervention. Tenant-admin command paths cannot safely authorise a platform operator who is not yet a member of the tenant being created.

**Approach:** Activate the platform-scoped provisioning manifest module and establish a DB allow-list, hardened operator predicate, one atomic provisioning RPC, and a server-only Auth-invite handoff. The implementation must be constrained by an explicit v1 provisioning request, identity/idempotency contract, approval/dry-run semantics, and recovery model.

## Boundaries & Constraints

**Always:** Keep provisioning internal after contract signing; authenticate the caller request-bound and authorise inside the database through the platform allow-list; use empty search paths, schema-qualified SECURITY DEFINER references, revoked PUBLIC execution, generic denials, tenant-attributed nonsecret audit data, and manifest-derived scope/RLS inventories. Create the first Admin through the existing invitation identity-binding lifecycle; keep Supabase Auth Admin calls server-only and outside the RPC. Prove dry-run has zero writes, transactional rollback, sequential/concurrent idempotency, cross-tenant isolation, hostile-search-path resistance, and service-role containment.

**Block If:** Halt for owner decisions on the normalized organisation identity and uniqueness/replay key; the durable state machine and exact retry/reconciliation authority after Auth delivery failure or lost response; the exact dry-run preview and approval/approver inputs; and the v1 baseline/request fields and treatment of unsupported future template fields. Halt if the design needs another SECURITY DEFINER function or a service-role database write outside `provision_tenant`.

**Never:** Build public signup, operator UI or read model, a tenant-shell route, checklist/onboarding UI, tenant-business-data traversal, free-text/general SQL provisioning, AI database access, client-side platform-role authority, hardcoded commercial terms, a second provisioning write path, or a second newly authorised DEFINER function.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Authorised dry run | Valid, structured and approved-for-preview request | Return the fully specified creation preview without tenant, membership, audit, or Auth writes | Generic validation error for invalid fields; no partial state |
| First execution | Authorised request with an approved, unique normalised organisation identity | Atomically persist the defined tenant baseline, invited first-Admin membership, durable provisioning state, and tenant-attributed audit record; then perform the server-only invite handoff | Roll back all database writes on an induced database failure; make post-commit Auth uncertainty reconcilable without disclosure |
| Replay or concurrent execution | Same durable identity/replay key after success, response loss, or concurrent submission | Return the same stable already-provisioned/reconciliation result and do not create duplicate tenants, memberships, audits, or invitations | Preserve exactly-once semantics defined by the owner-approved state machine |
| Unauthorised caller | Absent, forged, or non-operator claim/session | Return a generic denial with no effects and no tenant data | Do not reveal operator membership, tenant existence, SQL, or Auth detail |
</intent-contract>

## Code Map

- `src/scope/manifest.ts:213` -- pending, platform-scoped `provisioning` module; this story's first schema change activates it without nav or tenant-table enrollment.
- `src/scope/manifest-schema.ts:66` -- platform-scope validation and manifest-derived table invariants to preserve when activating the module.
- `supabase/migrations/20260625122433_tenant_foundation.sql:45` -- tenant/membership baseline and hardened tenant-membership DEFINER helper/grant pattern.
- `supabase/migrations/20260910165124_admin_user_management.sql:90` -- durable invited-membership and replay pattern; its tenant-admin-gated invitation RPC cannot bootstrap the first Admin directly.
- `src/server/commands/envelope.ts:202` and `src/server/commands/envelope-core.ts:171` -- tenant-context envelope must remain tenant-only; a parallel server-only platform boundary is required.
- `src/server/auth/admin-user-service.ts:16` -- existing durable database-preparation versus server-side Auth invitation delivery/reconciliation seam.
- `src/server/auth/resolve-tenant-context.ts:83` -- request-bound `getClaims()` revalidation convention; never trust a client-supplied platform role.
- `supabase/migrations/20260629121136_audit_events.sql:150` -- ordinary audit writer requires an active tenant member, so the sanctioned provisioning transaction must create its own tenant-bound audit row.
- `tests/integration/rls/security-definer-search-path.rls.test.ts:56` -- hostile schema/search-path control and successful-control proof to extend.
- `tests/integration/commands/admin-user-management.int.test.ts:46` and `tests/unit/admin-users/admin-user-service.test.ts:68` -- invitation replay, provider uncertainty, and cross-tenant test precedents.
- `_bmad-output/test-artifacts/test-design-epic-12.md:173` -- required 12.1 atomicity, idempotency, Auth-boundary, isolation, audit-hygiene, and reset/catalog evidence.

## Tasks & Acceptance

**Execution (blocked pending owner decisions):**
- `supabase/migrations/<new-e12-migration>.sql` -- add only the owner-approved platform allow-list, additive provisioning schema, constrained identity/idempotency storage, hardened predicate, and sole provisioning RPC -- establish the bounded database authority.
- `src/server/commands/provisioning/<new-platform-command>.ts` -- implement the owner-approved server-only orchestration and Auth-invite reconciliation contract -- keep service credentials and Auth administration out of clients and RPCs.
- `src/scope/manifest.ts` and `tests/unit/scope/*.test.ts` -- activate the platform provisioning module in the same PR and prove all derived guardrails remain coherent -- prevent an unlisted live surface.
- `tests/integration/**` and `tests/unit/**` -- encode the approved I/O matrix and E12 test-design identifiers -- prove atomicity, zero-write dry run, exact replay, generic denial, isolation, audit hygiene, catalog hardening, and reset behavior.

**Acceptance Criteria:**
- Given an owner-approved v1 request contract, when an allow-listed platform operator previews it, then the response lists exactly the owner-approved prospective records and makes no DB, audit, or Auth write.
- Given an allow-listed platform operator executes an approved unique request, when the provisioning transaction succeeds, then it creates exactly one tenant, approved baseline, invited first-Admin membership, durable handoff state, and nonsecret tenant-attributed audit record atomically.
- Given a replay, race, Auth-delivery failure, or lost response, when the caller retries under the owner-approved recovery contract, then no duplicate tenant or invitation is created and the result is stable and reconcilable.
- Given a non-operator, forged/absent claim, hostile search path, or cross-tenant probe, when it attempts provisioning or reads the allow-list, then it receives only a generic denial and observes no tenant business data or side effects.
- Given the migration is reset and integration/RLS suites run with `SUPABASE_TEST_REQUIRED=1`, when catalog, grants, owner, search path, PUBLIC execution, audit metadata, and manifest-derived inventory are checked, then the sole approved provisioning authority and platform-only exception are enforced with zero skipped required suites.

## Design Notes

The specification is intentionally blocked rather than selecting an identity normalisation, approval token, baseline field set, or post-commit invite reconciliation design by implication. These are observable contracts that the authoritative Epic 12 test-design material identifies as undecided; choosing them in an implementation spec would create product and security policy without owner authority.

Epic 11 retrospective actions on retry-fixture clocks, support-file size, Roles readiness signals, backup evidence, monitoring evidence, and `story_plan.py` YAML parsing remain context only. They do not add a Story 12.1 surface or implementation task.

## Verification

**Commands:**
- `SUPABASE_TEST_REQUIRED=1 pnpm vitest run tests/integration/rls/security-definer-search-path.rls.test.ts` -- expected: required suite executes with no skips and proves hardened function/catalog controls.
- `SUPABASE_TEST_REQUIRED=1 pnpm vitest run tests/integration/commands/admin-user-management.int.test.ts` -- expected: existing invitation lifecycle remains compatible with the first-Admin handoff.
- `pnpm vitest run tests/unit/admin-users/admin-user-service.test.ts` -- expected: provider uncertainty/retry semantics remain covered after approved orchestration changes.

## Auto Run Result

Status: blocked
Blocking condition: intent gap
Unanswered questions: Define the organisation identity normalization and durable uniqueness/replay key; define the durable provisioning and invite-handoff state machine, including lost-response and post-commit Auth-failure reconciliation under the one-RPC/two-DEFINER limit; define the dry-run preview, approval input, and approver identity; define the supported v1 baseline/request schema and rejection or deferral of unsupported future template fields.
