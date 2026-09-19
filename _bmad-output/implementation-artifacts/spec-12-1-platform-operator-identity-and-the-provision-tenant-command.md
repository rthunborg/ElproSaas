---
title: 'Story 12.1: Platform Operator Identity and the Provision-Tenant Command'
type: 'feature'
created: '2026-09-19'
status: 'blocked'
baseline_revision: '6a21d4f29b46b9090850f715aa61d8ab1631e436'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/project-context.md'
  - '_bmad-output/implementation-artifacts/epic-12-context.md'
  - '_bmad-output/planning-artifacts/architecture-phase-b.md'
  - 'docs/process/review-order.md'
warnings:
  - oversized
deferred: []
---

<intent-contract>

## Intent

**Problem:** ElproSaas has no narrowly authorised, auditable way to establish an independent company tenant and its first Admin without engineering intervention. Tenant-admin command paths cannot safely authorise a platform operator who is not yet a member of the tenant being created.

**Approach:** Activate the platform-scoped provisioning manifest module and establish a DB allow-list, hardened operator predicate, one narrowly actioned provisioning RPC, and a server-only Auth-invite handoff. The owner-approved v1 contract below fixes tenant eligibility, identity and idempotency, a stateless hash-bound preview/approval flow, an immutable baseline catalogue and strict request schema, the durable post-commit Auth reconciliation/retry model, invitation-token safety, exact readiness, and the non-granting platform permission row.

## Boundaries & Constraints

**Always:** Keep provisioning internal after contract signing; authenticate the caller request-bound and authorise inside the database through the platform allow-list; use empty search paths, schema-qualified SECURITY DEFINER references, revoked PUBLIC execution, generic denials, tenant-attributed nonsecret audit data, and manifest-derived scope/RLS inventories. Create the first Admin through the existing Epic 11 invitation identity-binding lifecycle; commit database provisioning before any Supabase Auth Admin call, and keep Auth administration server-only and outside the RPC. Prove the dry run has zero writes, transactional rollback covers every database write, dual idempotency survives sequential/concurrent replay, and the post-commit Auth handoff is truthfully reconcilable.

**Block If:** Halt if the design needs another SECURITY DEFINER surface, permits general service-role database mutation, accepts a tenant outside the v1 identity rules, writes during preview, derives the approver from caller input, silently ignores/downgrades/stores an unsupported field, silently updates an existing tenant, exposes a raw invitation token, performs provider work without the explicit retry action, or makes a platform capability tenant-grantable.

**Never:** Build public signup, operator UI or read model, a tenant-shell route, checklist/onboarding UI, tenant-business-data traversal, free-text/general SQL provisioning, AI database access, client-side platform-role authority, hardcoded commercial terms, a second provisioning write path, a new preview table, a second newly authorised DEFINER function, or any claim that the email was delivered merely because the Auth provider accepted an invite request.

## Owner-Approved V1 Contract

### Tenant eligibility, identity, and dual idempotency

- An ElPro tenant is a company/legal entity, never an individual. Provisioning v1 accepts Swedish non-personal legal entities only: `country_code = 'SE'` plus a Swedish organisation number.
- Swedish sole proprietorships (`enskild firma`) are unsupported because their organisation identity is the proprietor's `personnummer`. Reject personnummer-shaped identities even if their checksum is valid. This tenant restriction does not narrow the tenant's CRM: end customers may be companies or private individuals, and provisioning does not add personnummer capture for them.
- Normalize the organisation number by removing spaces and hyphens, require exactly ten digits, and validate the Swedish checksum. Normalize an optional VAT registration number by trimming, uppercasing, and removing spaces; accept only `SE` + the normalized ten-digit organisation number + `01`, require the embedded organisation number to match, and store that canonical form. VAT is never an alternative identity.
- Canonical identity is `(country_code, normalized_organization_number)`. Formatting and legal-name variations do not change identity. Archived or inactive tenants retain the reservation and must be reactivated through an authorised later path rather than duplicated. Enforce durable uniqueness across all tenants and statuses; the migration may not exempt pre-existing rows with an active-only or partial uniqueness rule.
- Idempotency has two independent keys: `(request_id UUID, canonical_request_hash)` and canonical organisation identity. The same `request_id` and hash retains the original tenant/result identity, reconciles first, and returns its current provisioning state; the same `request_id` with different content returns `IDEMPOTENCY_CONFLICT`; a different request ID for the same organisation returns `ALREADY_PROVISIONED` with the existing identity/status. None of these paths silently updates an existing tenant or implicitly calls the provider.

### Database/Auth handoff, authority, and recovery

- `provision_tenant` commits the database tenant, approved baseline, invited first-Admin membership, idempotency/identity facts, initial handoff state, and tenant-attributed audit data atomically. Supabase Auth Admin invitation occurs afterward in the server-only command.
- Keep `provision_tenant` as the sole Epic 12 SECURITY DEFINER RPC and extend it only with narrowly validated action variants. It may perform only initial atomic provisioning; record invite `requested`, `unknown`, or `failed`; record reconciliation results; and audit each transition. It is not a general service-role write channel. The existing Epic 11 invitation-acceptance path may mark the tenant `ready` when it activates the first-Admin membership; no second DEFINER function is added.
- Persist exactly these provisioning/handoff states: `pending_first_admin_invite`, `first_admin_invite_unknown`, `first_admin_invite_requested`, `first_admin_invite_failed`, and `ready`. Provider acceptance sets `first_admin_invite_requested`; it does not assert email delivery. A timeout or lost provider response sets `first_admin_invite_unknown`, never `failed`. A definitive provider failure sets `first_admin_invite_failed` with a sanitized code and an explicit operator-retry affordance.
- `ready` is allowed only when atomic database provisioning completed; the approved baseline ID, monotonic version, and content hash are recorded; the first-Admin membership is active; that membership has a non-null Auth user ID; the bound Auth identity matches the normalized first-Admin email; and no definitive provisioning failure remains unresolved. Provider acceptance or a usable invitation alone is insufficient.
- Normalize first-Admin email by trimming and applying Unicode NFC, IDNA-normalizing and lowercasing the domain, and lowercasing the local part as an explicit product policy. Preserve plus-addressing and do not strip dots or tags. Reject display-name syntax, comments, malformed addresses, and multiple addresses. This canonical value is the reconciliation and Auth-identity comparison key.

### Invitation token and provider-attempt lifecycle

- Reuse Epic 11's invitation capability and acceptance validation/membership activation. Generate invitation tokens with a cryptographically secure server-side source, persist only their hashes, and never return raw tokens to the operator browser or include them in logs or audits. Bind each token to the invitation ID, tenant, membership, normalized email, `tenant_admin` role, and expiry.
- Reconciliation reuses an active token. Only an explicit resend revokes the old token and creates a new one; ordinary reconciliation or same-request replay never rotates it. Acceptance continues through Epic 11's existing token validation and membership activation.
- Same-request replay is reconciliation-first: return the existing tenant and current provisioning state, reconcile membership/invitation/Auth identity before deciding what is next, and never silently repeat provider work. A provider call requires the explicit command action `retry_first_admin_invite`; this is orchestration control, not a tenant schema-v1 field, and each command execution may make at most one provider call. `unknown` never triggers an automatic resend.
- Persist the provider dispatch-attempt counter and sanitized outcome. Allow at most three provider dispatch attempts for one invitation. After the third attempt, require a fresh hash-bound preview and explicit approval; that approved resend revokes the prior invitation token and creates a new one. Every result returns tenant ID, current provisioning state, attempt number, and reconciliation action.

### Stateless preview and approval

- Preview is stateless and server-hash-bound; there is no preview table. A dry run writes nothing at all, including no audit row and no Auth side effect.
- Every preview returns: `schema_version`, `request_id`, normalized identity, field validation and warnings, proposed action (`CREATE`, `ALREADY_PROVISIONED`, or `CONFLICT`), exact baseline profile ID, monotonic version, and content hash, every proposed tenant/company/commercial/module value, first-Admin name and normalized email, proposed audit events, unsupported/deferred fields, and a server-calculated `preview_hash`.
- Execution resubmits the original request, the same `request_id`, the `preview_hash`, and explicit approval. The server re-normalizes and re-hashes the request, reloads the exact baseline entry, and recalculates its content hash; a request/hash mismatch is rejected, while a missing or changed baseline returns `PREVIEW_STALE` and requires a new preview.
- The approver is derived only from the authenticated allow-listed platform operator's `auth.uid()`; caller-supplied approver identity is invalid. The same operator may preview and approve; v1 has no second-person/four-eyes requirement. Audit approver, approval time, request ID, preview hash, baseline ID/version/content hash, and any approved token rotation.

### Strict request and baseline schema

- `schema_version = 1` is a strict allow-list. An unknown field yields a field-level `UNSUPPORTED_FIELD`; an unsupported version yields `UNSUPPORTED_SCHEMA_VERSION`. Never silently ignore, retain for later, or downgrade input.
- Required fields: `schema_version`; `request_id`; legal company name; country code and organisation number; first-Admin name and email; baseline profile ID and version; subscription plan identifier and status; included-user count; additional-user price in integer öre; and contract start date.
- Optional fields: VAT registration number; address; primary email and phone; contract or trial end; billing reference; structured commercial overrides; Reply-To; known manifest-active module IDs; approved feature flags; and already-supported tenant/company profile fields.
- The immutable, version-controlled server catalogue `TENANT_PROVISIONING_BASELINES` is the sole baseline authority. Each published entry has a baseline ID, monotonic version, and content hash; changing content creates a new version and published versions are never edited. Requests select ID/version and cannot supply arbitrary baseline values. Preview returns all three identity fields plus the exact proposed values; execution reloads the exact entry and recalculates its hash, with missing or changed content yielding `PREVIEW_STALE`.
- The selected catalogue entry previews and applies `sv-SE`, `Europe/Stockholm`, `SEK`, approved existing VAT/tax-profile references rather than raw rates, terms placeholders that preserve sign-off warnings, approved number-series defaults, and conservative display defaults.
- Reject from v1: logo/file uploads; Fortnox credentials or settings; base schedules/calendar configuration; initial users beyond the first Admin; initial data imports; pending/inactive modules; arbitrary feature flags; raw VAT/ROT/grön-teknik rates; final legal terms text; free-text agent instructions; and all secrets/credentials.
- A future field recognized as deferred may be listed in preview, but it blocks execution until removed. Supporting it requires a new schema version plus an approved story/module activation; never persist it for automatic later application.

### Platform permission classification

- Activate the platform module with the explicit non-granting capability `Platform.Operator.Access`: `scope: 'platform'`, `tenantGrantable: false`, and `tenantRoles: []`. The row classifies the platform route surface but grants no authority; authorization remains exclusively `is_platform_operator()`.
- Tenant role assignment, effective tenant entitlements, tenant navigation, and tenant module settings exclude platform-scoped rows. The operator route registry may consume this row separately. Manifest/permission coherence validators require the row for the active platform module without treating platform infrastructure as a tenant module or making it tenant-selectable.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Authorised dry run | Strict v1 request from an allow-listed operator | Return the complete stateless preview and `preview_hash` without tenant, membership, audit, preview-table, or Auth writes | Field-level validation; `UNSUPPORTED_FIELD` or `UNSUPPORTED_SCHEMA_VERSION`; no partial state |
| Approved execution | Original request + `request_id` + current `preview_hash` + explicit approval, with a unique canonical identity | Re-normalize/re-hash, reload and hash the immutable baseline entry, then atomically commit in `pending_first_admin_invite`; provider dispatch is a later explicit server action | Reject hash mismatch; return `PREVIEW_STALE` when the selected baseline entry is missing/changed; roll back every DB write on in-transaction failure |
| Request replay/conflict | Reused `request_id` | Same ID/hash reconciles first and returns tenant ID/current state/attempt/reconciliation action; same ID/different content returns `IDEMPOTENCY_CONFLICT` | Never mutate the tenant or call the provider implicitly |
| Identity replay/race | Different request ID or concurrent request for the same canonical identity | Exactly one tenant; the non-winning request returns `ALREADY_PROVISIONED` with identity/status | Archived/inactive identity remains reserved; never silently update or duplicate |
| Auth timeout/failure retry | Committed tenant in unknown, requested, or failed handoff state plus explicit `retry_first_admin_invite` | Reconcile by normalized email; reuse the active hashed-token invitation; make at most one provider call and persist the attempt/sanitized outcome | `unknown` never auto-resends; after attempt 3 require fresh preview/approval and rotate by revoke-and-create |
| Invitation acceptance/readiness | Epic 11 acceptance activates the bound first-Admin membership | Mark `ready` only when the full DB/baseline/membership/Auth-email/no-unresolved-failure predicate holds | Provider request acceptance alone remains `first_admin_invite_requested` |
| Unauthorised caller | Absent, forged, or non-operator claim/session | Return a generic denial with no effects and no tenant data | Do not reveal operator membership, tenant existence, SQL, or Auth detail |
</intent-contract>

## Code Map

- `supabase/migrations/20260625122433_tenant_foundation.sql:45` -- extend the established tenant/membership security foundation; do not create an ungoverned tenant surface.
- `supabase/migrations/20260910165124_admin_user_management.sql:29` and `supabase/migrations/20260914092606_admin_accept_membership_invitation_identity_binding.sql:7` -- compatible invited-membership, hashed-token, and acceptance/activation seams.
- `src/server/commands/envelope.ts:202` and `src/server/commands/envelope-core.ts:171` -- tenant envelope resolves membership first and is not a platform-command boundary.
- `src/server/auth/resolve-tenant-context.ts:83`, `src/server/auth/admin-user-service.ts:16`, `src/server/commands/admin-users/invite.ts:19`, `src/server/commands/admin-users/lifecycle.ts:45`, and `src/server/commands/admin-users/accept-invitation.ts:20` -- request-bound identity, server-only provider dispatch, token callback, reconciliation, and acceptance precedents.
- `src/scope/manifest.ts:213`, `src/scope/manifest-schema.ts:178`, `src/server/authz/permission-matrix.ts:11`, `src/server/authz/role-catalogue.ts:48`, and `tests/support/authz/role-harness.ts:95` -- activate the platform module and prevent its classification from becoming a tenant entitlement.
- `tests/integration/rls/security-definer-search-path.rls.test.ts:56`, `tests/integration/commands/admin-user-management.int.test.ts:46`, and `_bmad-output/test-artifacts/test-design-epic-12.md:173` -- P0 hardening, retry, and required 12.1 evidence anchors.

## Tasks & Acceptance

**Execution:**
- `supabase/migrations/20260919090000_tenant_provisioning.sql` -- add the platform allow-list, hardened operator helper, sole action-allow-listed `provision_tenant` RPC, and additive identity, baseline, request, commercial, handoff, and attempt facts; create compatible Epic 11 invitation records and acceptance-to-`ready` projection with exact RLS, constraints, indexes, grants, and audit writes.
- `src/server/provisioning/baselines.ts` and `src/server/commands/provisioning/validation.ts` -- make the immutable baseline catalogue, strict v1 decoder, canonicalisers, request/preview hashing, transition table, and readiness predicate pure authorities.
- `src/server/commands/provisioning/provision-tenant.ts` and `src/server/commands/provisioning/provisioning-db.ts` -- implement the request-bound platform command for preview, approved initial provision, replay reconciliation, and explicit bounded retry; invoke Auth only after commit and never expose raw tokens, credentials, provider detail, or business data.
- `src/server/auth/admin-user-service.ts`, `src/server/commands/admin-users/accept-invitation.ts`, and `supabase/migrations/20260914092606_admin_accept_membership_invitation_identity_binding.sql` -- preserve the protected callback token flow and make existing acceptance complete the `ready` transition without a new DEFINER function.
- `src/scope/manifest.ts`, `src/server/authz/permission-matrix.ts`, `src/server/authz/role-catalogue.ts`, `tests/support/authz/role-harness.ts`, `tests/unit/scope/manifest-invariants.test.ts`, `tests/unit/scope/manifest-coherence.test.ts`, and `tests/unit/scope/manifest-derivations.test.ts` -- activate the platform module with non-granting metadata and prove every tenant consumer excludes it.
- `tests/unit/provisioning/provisioning-contract.test.ts`, `tests/integration/commands/provision-tenant.int.test.ts`, `tests/integration/rls/platform-operators.rls.test.ts`, `tests/integration/rls/provisioning-migration-reset.int.test.ts`, and `tests/integration/rls/security-definer-search-path.rls.test.ts` -- implement 12.1-UNIT-001..003 and INT-001..013, including faults, races, zero-write, raw-token absence, catalog, and reset canaries.

**Acceptance Criteria:**
- Given a strict v1 request, when an allow-listed platform operator previews it, then the response contains every required preview field and server-calculated hash while DB, audit, preview storage, and Auth remain byte-for-byte unchanged.
- Given the original request, request ID, matching preview hash, and explicit approval, when the allow-listed operator executes it against an unchanged immutable catalogue entry, then the RPC atomically creates exactly one eligible tenant, records baseline ID/version/content hash and exact values, creates the invited first-Admin membership, stores idempotency/identity facts, `pending_first_admin_invite` state, and nonsecret tenant-attributed audit record before any explicit server-side Auth dispatch.
- Given a reused request ID, same organisation under a different request ID, archive/inactive collision, or concurrent race, when the command runs, then it produces the specified original-result / `IDEMPOTENCY_CONFLICT` / `ALREADY_PROVISIONED` behavior, preserves durable uniqueness, and never silently updates or duplicates the tenant.
- Given baseline drift, a changed request, an unknown/unsupported field or schema version, a personnummer-shaped/invalid/non-SE identity, or a v1-rejected field, when preview or execution validates it, then the exact owner-approved error semantics apply and execution performs no write.
- Given provider acceptance, timeout, definitive failure, lost response, replay, or explicit retry, when the post-commit handoff runs, then the sole RPC's narrow action variant persists/audits only the approved transition, reconciliation precedes every decision, `unknown` never auto-resends, each execution makes at most one provider call, the attempt number/sanitized outcome are persisted and returned, and attempt 4 requires fresh preview/approval plus invitation-token rotation.
- Given an Epic 11 invitation token, when it is generated, reconciled, resent, logged, audited, or accepted, then only its hash is stored; its binding includes invitation, tenant, membership, canonical email, `tenant_admin`, and expiry; reconciliation reuses it; explicit resend revokes and replaces it; and the raw token is absent from operator/browser/log/audit surfaces.
- Given any transition toward `ready`, when readiness is evaluated, then it requires completed DB provisioning, recorded approved baseline ID/version/hash, active first-Admin membership, non-null Auth user ID, matching normalized Auth email, and no unresolved definitive failure; provider acceptance alone cannot satisfy it.
- Given provisioning module activation, when permission/manifest coherence and tenant-consumer tests run, then `Platform.Operator.Access` exists as `scope: platform`, `tenantGrantable: false`, `tenantRoles: []`, authorization remains solely `is_platform_operator()`, tenant entitlements/nav/settings omit it, and the operator registry may consume it without inventing a tenant module.
- Given a non-operator, forged/absent claim, hostile search path, or cross-tenant probe, when it attempts provisioning or reads the allow-list, then it receives only a generic denial and observes no tenant business data or side effects.
- Given the migration is reset and integration/RLS suites run with `SUPABASE_TEST_REQUIRED=1`, when catalog, grants, owner, search path, PUBLIC execution, audit metadata, and manifest-derived inventory are checked, then the sole approved provisioning authority and platform-only exception are enforced with zero skipped required suites.

## Spec Change Log

- 2026-09-19: Re-derived after supplemental owner decisions. Replaced placeholder task paths with concrete migration, server, scope, and test targets while preserving the binding intent contract and historical halt evidence.

## Review Triage Log

No review pass has run.

## Design Notes

The database is deliberately DB-first and provider-second: a provider outcome cannot create a false database claim. Only the action allow-list and existing acceptance function may mutate provision state after initial provisioning; the parallel command module is server orchestration, never a client privilege path.

Epic 11 retrospective actions on retry-fixture clocks, support-file size, Roles readiness signals, backup evidence, monitoring evidence, and `story_plan.py` YAML parsing remain context only. They do not add a Story 12.1 surface or implementation task.

## Verification

**Commands:**
- `pnpm vitest run tests/unit/provisioning/provisioning-contract.test.ts tests/unit/server/authz/permission-matrix.test.ts` -- expected: strict-schema, canonicalisation, state, baseline, and non-granting metadata cases pass.
- `SUPABASE_TEST_REQUIRED=1 pnpm vitest run tests/integration/commands/provision-tenant.int.test.ts tests/integration/rls/platform-operators.rls.test.ts tests/integration/rls/provisioning-migration-reset.int.test.ts tests/integration/rls/security-definer-search-path.rls.test.ts` -- expected: required suites execute with zero skips and prove 12.1-INT-001..013.
- `pnpm vitest run tests/unit/admin-users/admin-user-service.test.ts tests/integration/commands/admin-user-management.int.test.ts` -- expected: existing callback, retry, and acceptance semantics remain compatible.
- `pnpm lint && pnpm typecheck` -- expected: platform metadata cannot leak into tenant-only consumers.

## Auto Run Result

Historical result (2026-09-17, before owner decisions):

Status: blocked
Blocking condition: intent gap
Unanswered questions: Define the organisation identity normalization and durable uniqueness/replay key; define the durable provisioning and invite-handoff state machine, including lost-response and post-commit Auth-failure reconciliation under the one-RPC/two-DEFINER limit; define the dry-run preview, approval input, and approver identity; define the supported v1 baseline/request schema and rejection or deferral of unsupported future template fields.

Historical result (2026-09-17, before supplemental owner decisions):

Status: blocked
Blocking condition: intent gap
Evidence gathered: Existing Epic 11 invitation prepare/finalize/reconcile RPCs require an active tenant administrator, so they cannot write the first-Admin handoff state for a platform operator who is not a tenant member. The draft also does not define the opaque invitation-token lifecycle required by the existing acceptance binding, the exact retry versus replay behavior, the baseline catalogue/version authority, email and VAT canonicalisation, the `ready` predicate, or the platform-module activation changes required by manifest/permission coherence.
Unanswered questions: Which operation(s) of the sole `provision_tenant` authority persist and audit post-provider outcomes, reconciliation, and first-Admin readiness without adding another SECURITY DEFINER surface; how are opaque invite attempt tokens generated, held only server-side, reused or replaced on reconciliation, and bound to redirect/acceptance; whether a same request-id replay may initiate provider work or is reconciliation-only, including its result/attempt policy; what authoritative baseline catalogue/version and persisted projection define `PREVIEW_STALE`; what email and VAT canonicalisation/validation contract applies; what durable invitation/Auth facts make `ready`; and how platform activation supplies a non-granting permission-matrix row while preventing the active platform module from being selected as a tenant entitlement.

Current planning status: ready-for-dev — the owner-approved contract resolves both historical intent gaps and the implementation/test map has concrete targets. Halted after planning; no implementation was run.

Implementation result (2026-09-19):

Status: blocked
Blocking condition: implementation verification failed
Verification failure: `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run --config vitest.config.ts tests/integration/rls/platform-operators.rls.test.ts tests/integration/rls/provisioning-migration-reset.int.test.ts` cannot execute Story 12.1 assertions because the existing user-owned local stack lacks the unapplied provisioning migration (`platform_operators`, `is_platform_operator`, and `provision_tenant` are absent). The repository has no isolated Compose path, and the resource policy forbids adopting or resetting that existing stack. `pnpm typecheck` also remains blocked by unrelated tracked `tmp/private/**` and `tmp/worktrees/**` errors.

Implementation recovery (2026-09-19): the authorized local disposable stack has received the pending repository migrations through SQL-only `pnpm exec supabase migration up --local`; resume focused required-suite verification from this in-progress state without resetting or otherwise managing the stack lifecycle.

Implementation result (2026-09-19, recovery):

Status: blocked
Blocking condition: matrix ambiguity
Evidence gathered: focused Node contracts passed (10/10); the required `SUPABASE_TEST_REQUIRED=1` four-file provisioning command/RLS/reset/search-path suite passed (18/18, zero skipped); existing admin-user compatibility tests passed (14/14); focused ESLint, `git diff --check`, review-order validation, and a bounded 674-file TypeScript check excluding only unrelated `tmp/private/**` and `tmp/worktrees/**` paths passed. The platform authority, initial atomic write, zero-write preview, durable replay/race, hostile search-path, and acceptance-to-ready coverage were made executable against the migrated local stack.
Unresolved owner decision: the intent requires the provider callback after the DB-first commit to reuse the active invitation token, while allowing only its non-reversible hash to persist. A later retry cannot recover that raw token from its hash, and the configured provider cannot resend an application-owned callback token. Choose either (1) an owner-approved secure server-side token escrow/envelope design that keeps the raw token out of all forbidden surfaces while permitting bounded reuse, or (2) an owner-approved rotation-based retry lifecycle and callback contract that replaces the token for every explicit provider attempt. The current implementation does not claim durable retry/token-rotation coverage.

## Suggested Review Order

Author: implementation author.
Refreshed against the current shared working tree (uncommitted Story 12.1 changes).

### Platform authority and atomic provisioning

The platform allow-list is deliberately separate from tenant roles, and the one RPC checks it before accepting any action. Initial provisioning writes the tenant, first-admin invitation facts, idempotency record, and nonsecret audit event in one transaction.

- `supabase/migrations/20260919090000_tenant_provisioning.sql:13` — `is_platform_operator`: hardened platform-only predicate.
- `supabase/migrations/20260919090000_tenant_provisioning.sql:50` — `provision_tenant`: sole provisioning DEFINER command with an action allow-list.
- `supabase/migrations/20260919090000_tenant_provisioning.sql:83` — `audit_events`: records the approval boundary without raw invitation material.

### Stateless preview and bounded provider orchestration

Preview construction is pure and performs no database or Auth work. The server command reuses that preview hash for the approved write and reconciles before its explicit, one-call provider retry path.

- `src/server/commands/provisioning/validation.ts:77` — `createProvisioningPreview`: hash-bound zero-write preview authority.
- `src/server/commands/provisioning/provision-tenant.ts:30` — `previewTenantProvisioning`: does not construct a database client.
- `src/server/commands/provisioning/provision-tenant.ts:38` — `retryFirstAdminInvite`: reconciles before the provider attempt and records only a sanitized outcome.

### Platform classification and executed boundaries

The active provisioning module has a non-granting permission row, so no tenant role can obtain platform authority. The required RLS/reset tests exercise the migrated local stack, including the hardened database-object and grant canary.

- `src/server/authz/permission-matrix.ts:21` — `Platform.Operator.Access`: explicit platform-only, non-granting row.
- `tests/unit/provisioning/provisioning-contract.test.ts:22` — `12.1-UNIT-001`: strict v1 field and deferred-scope rejection.
- `tests/integration/rls/platform-operators.rls.test.ts:13` — `12.1-INT-001`: own-row-only platform allow-list read.
- `tests/integration/rls/provisioning-migration-reset.int.test.ts:7` — `12.1-INT-013`: hardened object/grant/reset canary.
- `tests/factories/platform-operators.ts:112` — `withProvisioningWriteFault`: temporary local-test triggers induce each transactional write failure without expanding production RPC input.

Evidence: this working tree passed the focused Node contracts (10/10: Story 12.1 plus permission-matrix regressions) and `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/commands/provision-tenant.int.test.ts tests/integration/rls/platform-operators.rls.test.ts tests/integration/rls/provisioning-migration-reset.int.test.ts tests/integration/rls/security-definer-search-path.rls.test.ts` (18 passed, zero skipped). The run now executes the hostile platform search-path negative, DB-counted preview zero-write probe, real concurrent-row count probe, and actual Epic 11 acceptance-to-ready projection. A prior temporary derived repository `tsc --noEmit` configuration excluded only the known `tmp/private/**` and `tmp/worktrees/**` additions. `git diff --check` passed and the review-order reference checker passed. The normal `pnpm typecheck` remains blocked by those unrelated tracked temporary paths.
Limits: no local reset was performed; the suite ran against the authorized stack after its pending migrations were applied. One unrelated security-definer suite assertion was skipped by its existing gate. No provider acceptance is treated as evidence of actual email delivery.
