---
title: 'Story 12.1: Platform Operator Identity and the Provision-Tenant Command'
type: 'feature'
created: '2026-09-19'
status: 'in-progress'
baseline_revision: '6a21d4f29b46b9090850f715aa61d8ab1631e436'
baseline_commit: 'f1330d0319920d52120cabf9797288a6e46c4e9c'
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

**Approach:** Activate the platform-scoped provisioning manifest module and establish a DB allow-list, one attested and narrowly actioned provisioning RPC, a migration-owned execution catalogue, and a server-only Auth-invite handoff. The owner-approved v1 contract below fixes tenant eligibility, identity and idempotency, a stateless hash-bound preview/approval flow, strict request schema, the durable post-commit Auth reconciliation/retry model, invitation-token safety, exact readiness, and the non-granting platform permission row. Decision 8A binds every mutation to both the current operator JWT and a server-only HMAC attestation while removing legacy delegation, broad service-role DML, and TypeScript-only execution authority.

## Boundaries & Constraints

**Always:** Keep provisioning internal after contract signing; invoke the sole public `SECURITY DEFINER provision_tenant` RPC under the operator's normal Supabase Auth JWT; authorise the current `auth.uid()` through the platform allow-list; and require a valid server-minted provisioning attestation for every mutating action. Use an empty search path, schema-qualified references, dedicated least-privilege function ownership, generic denials, tenant-attributed nonsecret audit data, and manifest-derived scope/RLS inventories. Create the first Admin through the existing Epic 11 invitation identity-binding lifecycle; commit database provisioning before any Supabase Auth Admin call, and keep Auth administration server-only and outside the RPC. Prove the dry run has zero writes, transactional rollback covers every database write, dual idempotency survives sequential/concurrent replay, and the post-commit Auth handoff is truthfully reconcilable.

**Block If:** Halt if the design needs another callable SECURITY DEFINER writer; permits provisioning-table or catalogue DML to a runtime role; invokes provisioning with `service_role`, a custom provisioning JWT, an unsigned/invalid attestation, caller-supplied retry identity, or a legacy JSON delegate/fallback; accepts a tenant outside the v1 identity rules; writes during preview; derives the approver from caller input; silently ignores/downgrades/stores an unsupported field; silently updates an existing tenant; exposes a raw invitation token or attestation; performs provider work without the explicit retry action; or makes a platform capability tenant-grantable.

**Never:** Build public signup, operator UI or read model, a tenant-shell route, checklist/onboarding UI, tenant-business-data traversal, free-text/general SQL provisioning, AI database access, client-side platform-role authority, hardcoded commercial terms, a second provisioning write path, a new preview table, raw-token escrow, deterministic token derivation, a custom provisioning JWT, a second callable DEFINER writer, second-person approval, or any claim that the email was delivered merely because the Auth provider accepted an invite request.

## Owner-Approved V1 Contract

### Tenant eligibility, identity, and dual idempotency

- An ElPro tenant is a company/legal entity, never an individual. Provisioning v1 accepts Swedish non-personal legal entities only: `country_code = 'SE'` plus a Swedish organisation number.
- Swedish sole proprietorships (`enskild firma`) are unsupported because their organisation identity is the proprietor's `personnummer`. Reject personnummer-shaped identities even if their checksum is valid. This tenant restriction does not narrow the tenant's CRM: end customers may be companies or private individuals, and provisioning does not add personnummer capture for them.
- Normalize the organisation number by removing spaces and hyphens, require exactly ten digits, and validate the Swedish checksum. Normalize an optional VAT registration number by trimming, uppercasing, and removing spaces; accept only `SE` + the normalized ten-digit organisation number + `01`, require the embedded organisation number to match, and store that canonical form. VAT is never an alternative identity.
- Canonical identity is `(country_code, normalized_organization_number)`. Formatting and legal-name variations do not change identity. Archived or inactive tenants retain the reservation and must be reactivated through an authorised later path rather than duplicated. Enforce durable uniqueness across all tenants and statuses; the migration may not exempt pre-existing rows with an active-only or partial uniqueness rule.
- Idempotency has two independent keys: `(request_id UUID, canonical_request_hash)` and canonical organisation identity. The same `request_id` and hash retains the original tenant/result identity, reconciles first, and returns its current provisioning state; the same `request_id` with different content returns `IDEMPOTENCY_CONFLICT`; a different request ID for the same organisation returns `ALREADY_PROVISIONED` with the existing identity/status. None of these paths silently updates an existing tenant or implicitly calls the provider.

### Database/Auth handoff, authority, and recovery

- `provision_tenant` is the sole public authenticated Epic 12 `SECURITY DEFINER` RPC. The server calls it with the operator's ordinary Supabase Auth JWT, so the RPC resolves the live `auth.uid()` itself; `authenticated` receives only `EXECUTE` on this exact RPC. `PUBLIC`, `anon`, `authenticator`, and `service_role` have no provisioning-RPC execution or provisioning-table/catalogue DML. No custom JWT caller role or service-role database client participates.
- Every mutating action requires two independent proofs inside the RPC: the live `auth.uid()` must currently be allow-listed by `is_platform_operator()`, and a short-lived domain-separated HMAC-SHA-256 attestation minted only by server provisioning code must verify. Missing, forged, expired, wrong-domain, wrong-key, replayed against different content, or tampered attestations fail generically before any write. Stateless preview remains write-free. Reconciliation remains provider-free and returns only sanitized durable state; if reconciliation needs to record a mutation, that action is attested too.
- The RPC is owned by a dedicated least-privilege `NOLOGIN NOINHERIT` function-owner role. That role receives only the table/sequence operations required by the approved action variants plus filtered read access to the named provisioning-attestation Vault secrets. It is never granted as a member to `authenticator`, `authenticated`, `service_role`, or any JWT role; callers cannot assume it, and it has no broad schema/database privilege.
- Use a dedicated 256-bit provisioning-attestation key, separate from JWT, service-role, and quote-PDF keys, with matching copies in the app secret store and Supabase Vault. Follow the established length-prefixed Node/Postgres HMAC protocol with a fixed versioned provisioning domain, explicit key/attestation IDs, constant-time verification, a maximum two-minute issuance-to-expiry window, and fail-closed current/previous-key lookup. Previous-key acceptance exists only for the bounded TTL during rotation. The attestation is internal ephemeral authority: never persist, log, audit, or return it to the browser.
- The canonical signed envelope binds the versioned domain and action/schema; current `auth.uid()` actor; request ID plus strict canonical request projection and hash; canonical organisation identity; preview hash and explicit approval; baseline ID/version/content hash; invitation token SHA-256 hash; exact invitation, membership, and reservation IDs; absolute dispatch and approval generations; expected current generation; sanitized provider outcome; attestation and key IDs; and issued/expiry timestamps. A mismatch in any bound field fails closed with zero writes.
- An attested initial-provision action commits the database tenant, approved DB-catalogue baseline, invited first-Admin membership, idempotency/identity facts, initial handoff state, and tenant-attributed audit data atomically. Supabase Auth Admin invitation occurs only after that commit and after a separate attested dispatch reservation; provider interaction never runs inside the RPC.
- Keep the RPC action allow-list narrow: initial atomic provisioning; `reserve_dispatch`; record invite `requested`, `unknown`, or `failed` for the exact reservation/generation; record attested reconciliation mutations when required; and audit each transition. Remove the legacy delegate/fallback and broad service-role provisioning-table DML. The existing Epic 11 invitation-acceptance path may mark the tenant `ready` when it activates the first-Admin membership; no second callable DEFINER writer is added.
- Persist exactly these provisioning/handoff states: `pending_first_admin_invite`, `first_admin_invite_unknown`, `first_admin_invite_requested`, `first_admin_invite_failed`, and `ready`. Provider acceptance sets `first_admin_invite_requested`; it does not assert email delivery. A timeout or lost provider response sets `first_admin_invite_unknown`, never `failed`. A definitive provider failure sets `first_admin_invite_failed` with a sanitized code and an explicit operator-retry affordance.
- `ready` is allowed only when atomic database provisioning completed; the approved baseline ID, monotonic version, and content hash are recorded; the first-Admin membership is active; that membership has a non-null Auth user ID; the bound Auth identity matches the normalized first-Admin email; and no definitive provisioning failure remains unresolved. Provider acceptance or a usable invitation alone is insufficient.
- Normalize first-Admin email by trimming and applying Unicode NFC, IDNA-normalizing and lowercasing the domain, and lowercasing the local part as an explicit product policy. Preserve plus-addressing and do not strip dots or tags. Reject display-name syntax, comments, malformed addresses, and multiple addresses. This canonical value is the reconciliation and Auth-identity comparison key.

### Invitation token and provider-attempt lifecycle

- Reuse Epic 11's invitation capability and acceptance validation/membership activation. The first authorised post-commit dispatch generates a fresh 32-byte CSPRNG application token server-side, keeps the raw value only in memory for that provider call, and persists only its SHA-256 hash. Never return a raw token to the operator browser or include one in storage, logs, or audits. Bind every current token generation to the invitation ID, tenant, membership, normalized email, `tenant_admin` role, and expiry.
- Initial dispatch and every authorised explicit `retry_first_admin_invite` resend use the same ordered protocol: database provisioning is already committed; the server generates a fresh 32-byte CSPRNG token in memory; a signed `reserve_dispatch` action atomically revokes the prior hash where present, installs only the fresh SHA-256 hash/current absolute dispatch generation, and returns the durable normalized email, membership ID, role, expiry, invitation ID, reservation ID, and generation facts; the server makes at most one Auth provider call from exactly those returned facts; then a separately signed outcome action records the sanitized result for that exact reservation and generation. Rotation invalidates every older link immediately; acceptance continues through Epic 11 validation and membership activation using only the current non-revoked binding and verified Auth identity.
- Same-request replay and ordinary reconciliation are observation-only for provider purposes: they return the existing tenant/current state after reconciling membership, invitation, and Auth identity, but never rotate a token and never call the provider. A resend requires the explicit authorised `retry_first_admin_invite` action after reconciliation; this is orchestration control, not a tenant schema-v1 field. `unknown` never triggers an automatic resend.
- Retry input identity comes only from the durable facts returned by the attested RPC reservation. Browser/caller values for email, membership, operation/reservation ID, role, expiry, token hash, dispatch generation, or provider outcome never become authority. Stale, out-of-order, duplicate-conflicting, wrong-reservation, or wrong-generation outcomes fail closed; an idempotent identical replay may only return the already-recorded result.
- Persist absolute dispatch and approval generations plus sanitized outcome. One approved provisioning snapshot authorises at most three total provider dispatch attempts: the initial dispatch plus at most two explicit resends, each with its own fresh token. Replace trusted `fresh_approval` booleans with server-signed monotonic approval-generation evidence. A fourth dispatch requires a new stateless preview, explicit approval, and attestation for a strictly newer approval generation, then begins a new invitation generation. Every result returns tenant ID, current provisioning state, attempt number/generation, and reconciliation action.
- V1 has no recoverable raw-token escrow, deterministic token derivation, or provider/callback redesign. This Decision 7C lifecycle explicitly supersedes the earlier wording that one active token was reused across multiple provider dispatch attempts; only reconciliation reuses the durable invitation facts without dispatching or rotating.

### Stateless preview and approval

- Preview is stateless and server-hash-bound; there is no preview table. A dry run writes nothing at all, including no audit row and no Auth side effect.
- Every preview returns: `schema_version`, `request_id`, normalized identity, field validation and warnings, proposed action (`CREATE`, `ALREADY_PROVISIONED`, or `CONFLICT`), exact baseline profile ID, monotonic version, and content hash, every proposed tenant/company/commercial/module value, first-Admin name and normalized email, proposed audit events, unsupported/deferred fields, and a server-calculated `preview_hash`.
- Execution resubmits the original request, the same `request_id`, the `preview_hash`, and explicit approval to server provisioning code. The server re-normalizes/re-hashes, loads the exact DB-catalogue entry, verifies DB/TypeScript coherence, derives the next monotonic approval generation, and mints the action-specific attestation; the browser never receives the attestation. A request/hash mismatch is rejected, while a missing/changed catalogue entry or mirror mismatch returns `PREVIEW_STALE` and requires a new preview.
- The approver is derived only from the authenticated allow-listed platform operator's `auth.uid()`; caller-supplied approver identity is invalid. The same operator may preview and approve; v1 has no second-person/four-eyes requirement. Audit approver, approval time, request ID, preview hash, baseline ID/version/content hash, monotonic approval generation, and any approved token rotation—but never the attestation or key material.

### Strict request and baseline schema

- `schema_version = 1` is a strict allow-list. An unknown field yields a field-level `UNSUPPORTED_FIELD`; an unsupported version yields `UNSUPPORTED_SCHEMA_VERSION`. Never silently ignore, retain for later, or downgrade input.
- Required fields: `schema_version`; `request_id`; legal company name; country code and organisation number; first-Admin name and email; baseline profile ID and version; subscription plan identifier and status; included-user count; additional-user price in integer öre; and contract start date.
- Optional fields: VAT registration number; address; primary email and phone; contract or trial end; billing reference; structured commercial overrides; Reply-To; known manifest-active module IDs; approved feature flags; and already-supported tenant/company profile fields.
- The authoritative execution catalogue is immutable, migration-owned, insert-only database data containing baseline ID, monotonic version, canonical content, and content hash. Published rows are never updated or deleted; changing content requires a new migration that inserts a new version. No runtime role has catalogue DML. `TENANT_PROVISIONING_BASELINES` in TypeScript remains a preview/build-time mirror only, with mandatory DB/TypeScript canonical-content and content-hash coherence tests. Requests select ID/version and cannot supply arbitrary baseline values. Preview returns ID/version/hash plus exact values; execution reloads and hashes the DB row, rejects any mirror mismatch, and returns `PREVIEW_STALE` when the selected version is missing or changed. This Decision 8A rule supersedes the earlier TypeScript-only execution-authority wording while preserving version-controlled immutability.
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
| Approved execution | Original request + `request_id` + current `preview_hash` + explicit approval, with a unique canonical identity | Server derives actor/approval generation, verifies DB/TS catalogue coherence, mints the internal attestation, and invokes the normal-JWT RPC; RPC revalidates all signed facts and atomically commits in `pending_first_admin_invite` | Missing/invalid attestation, hash/binding mismatch, legacy fallback, or stale catalogue fails generically with zero writes; `PREVIEW_STALE` requires a new preview |
| Request replay/conflict | Reused `request_id` | Same ID/hash reconciles first and returns tenant ID/current state/attempt/reconciliation action; same ID/different content returns `IDEMPOTENCY_CONFLICT` | Never mutate the tenant or call the provider implicitly |
| Identity replay/race | Different request ID or concurrent request for the same canonical identity | Exactly one tenant; the non-winning request returns `ALREADY_PROVISIONED` with identity/status | Archived/inactive identity remains reserved; never silently update or duplicate |
| Auth timeout/failure retry | Committed tenant in unknown, requested, or failed handoff state plus explicit `retry_first_admin_invite` | Provider-free reconciliation; fresh token in memory; signed reservation installs hash/generation and returns durable provider inputs; at most one Auth call; separately signed outcome binds exact reservation/generation | Caller retry identity/outcome is ignored; stale/conflicting outcome fails closed; dispatch 4 requires a strictly newer signed approval generation |
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
- Add a Story 12.1 enforcement migration that replaces the legacy delegate/fallback; creates the insert-only migration-owned baseline catalogue; removes runtime/service-role provisioning-table and catalogue DML; assigns the sole public RPC to a dedicated least-privilege `NOLOGIN NOINHERIT` owner; restricts Vault access to the provisioning-attestation keys; and enforces attestation, generation, reservation, outcome, grant, and audit invariants without introducing another callable DEFINER writer.
- `src/server/provisioning/baselines.ts` and `src/server/commands/provisioning/validation.ts` -- retain the strict v1 decoder, canonicalisers, request/preview hashing, transition table, readiness predicate, and TypeScript baseline preview mirror; add canonical DB/TS coherence evidence rather than treating TypeScript as execution authority.
- Add the server-only provisioning-attestation signer/verifier contract using the established length-prefixed Node/Postgres HMAC pattern and the dedicated app/Vault key pair. `src/server/commands/provisioning/provision-tenant.ts` and `src/server/commands/provisioning/provisioning-db.ts` use the operator's normal Auth session, mint action-specific attestations, consume only durable reservation-returned retry facts, and invoke Auth only between signed reservation and signed outcome.
- `src/server/auth/admin-user-service.ts`, `src/server/commands/admin-users/accept-invitation.ts`, and `supabase/migrations/20260914092606_admin_accept_membership_invitation_identity_binding.sql` -- preserve the protected callback token flow and make existing acceptance complete the `ready` transition without a new DEFINER function.
- `src/scope/manifest.ts`, `src/server/authz/permission-matrix.ts`, `src/server/authz/role-catalogue.ts`, `tests/support/authz/role-harness.ts`, `tests/unit/scope/manifest-invariants.test.ts`, `tests/unit/scope/manifest-coherence.test.ts`, and `tests/unit/scope/manifest-derivations.test.ts` -- activate the platform module with non-granting metadata and prove every tenant consumer excludes it.
- `tests/unit/provisioning/provisioning-contract.test.ts`, `tests/integration/commands/provision-tenant.int.test.ts`, `tests/integration/rls/platform-operators.rls.test.ts`, `tests/integration/rls/provisioning-migration-reset.int.test.ts`, and `tests/integration/rls/security-definer-search-path.rls.test.ts` -- implement 12.1-UNIT-001..003 and INT-001..013, including faults, races, zero-write, raw-token absence, catalog, and reset canaries.

**Acceptance Criteria:**
- Given a strict v1 request, when an allow-listed platform operator previews it, then the response contains every required preview field and server-calculated hash while DB, audit, preview storage, and Auth remain byte-for-byte unchanged.
- Given the original request, request ID, matching preview hash, and explicit approval, when server provisioning code executes it against a coherent DB/TypeScript baseline version, then it mints a maximum-two-minute action attestation and calls the sole RPC under the operator's normal Auth JWT; the RPC requires both live allow-list membership and valid exact-field attestation before atomically creating one eligible tenant, recording baseline canonical content/ID/version/hash and exact values, creating the invited first-Admin membership, storing idempotency/identity facts, `pending_first_admin_invite`, and nonsecret tenant-attributed audit before any Auth dispatch.
- Given a reused request ID, same organisation under a different request ID, archive/inactive collision, or concurrent race, when the command runs, then it produces the specified original-result / `IDEMPOTENCY_CONFLICT` / `ALREADY_PROVISIONED` behavior, preserves durable uniqueness, and never silently updates or duplicates the tenant.
- Given baseline drift, DB/TypeScript catalogue incoherence, a changed request, an unknown/unsupported field or schema version, a personnummer-shaped/invalid/non-SE identity, or a v1-rejected field, when preview or execution validates it, then the exact owner-approved error semantics apply and execution performs no write; execution never falls back to caller JSON or TypeScript-only baseline authority.
- Given provider acceptance, timeout, definitive failure, lost response, replay, or explicit retry, when the post-commit handoff runs, then reconciliation remains provider-free; signed `reserve_dispatch` returns the only authoritative email/membership/role/expiry/invitation/reservation/generation facts; the server performs at most one provider call; and the signed outcome must match that exact reservation, token hash, expected/current dispatch generation, approval generation, and sanitized result. Stale, out-of-order, conflicting, or caller-shaped outcomes fail closed, and dispatch 4 requires a new preview plus strictly newer signed approval generation.
- Given an Epic 11 invitation token, when the initial dispatch or an explicit resend is authorised, then a fresh 32-byte CSPRNG raw token exists only in memory for that provider call; the sole RPC atomically revokes the prior hash where present and persists only the new SHA-256 hash plus attempt reservation/outcome; the binding includes invitation, tenant, membership, canonical email, `tenant_admin`, and expiry; older links are invalid; acceptance requires the current binding and verified identity; and no raw token appears in storage, operator/browser output, logs, or audits.
- Given any transition toward `ready`, when readiness is evaluated, then it requires completed DB provisioning, recorded approved baseline ID/version/hash, active first-Admin membership, non-null Auth user ID, matching normalized Auth email, and no unresolved definitive failure; provider acceptance alone cannot satisfy it.
- Given provisioning module activation, when permission/manifest coherence and tenant-consumer tests run, then `Platform.Operator.Access` exists as `scope: platform`, `tenantGrantable: false`, `tenantRoles: []`, authorization remains solely `is_platform_operator()`, tenant entitlements/nav/settings omit it, and the operator registry may consume it without inventing a tenant module.
- Given a non-operator, forged/absent normal JWT, unsigned/forged/expired/wrong-domain/wrong-key/tampered attestation, hostile search path, custom caller role, direct service-role attempt, or cross-tenant probe, when it attempts provisioning, then it receives only a generic denial, performs zero writes, and observes no tenant business data, Vault secret, attestation, or authorization detail.
- Given the migration is reset and integration/RLS suites run with `SUPABASE_TEST_REQUIRED=1`, when function/catalogue ownership, grants, owner-role attributes, filtered Vault access, empty search path, action allow-list, absence of the legacy delegate, absence of runtime/service-role DML, DB/TS coherence, attestation field/domain/TTL/key rotation, generation ordering, audit metadata, and manifest-derived inventory are checked, then the sole approved provisioning authority and platform-only exception are enforced with zero skipped required suites.

## Spec Change Log

- 2026-09-19: Applied owner Decision 8A. Bound every mutation to the live allow-listed operator JWT plus a maximum-two-minute server-only HMAC attestation; moved execution baseline authority to an insert-only migration-owned DB catalogue with a TypeScript preview mirror; required least-privilege function ownership, signed dispatch reservation/outcome binding, monotonic approval generations, removal of the legacy delegate/service-role DML, and a key-first coordinated rollout. Marked the spec `in-progress`; implementation and verification remain incomplete.
- 2026-09-19: Applied owner Decision 7C. Replaced the unrecoverable same-token-across-dispatches assumption with fresh 32-byte CSPRNG token generations for the initial dispatch and every explicit resend, SHA-256-only persistence, atomic prior-hash revocation through the sole RPC, a three-dispatch approval budget, and fresh approval before dispatch four. Marked the spec `in-progress` so Phase 5 can resume; implementation is not complete.
- 2026-09-19: Re-derived after supplemental owner decisions. Replaced placeholder task paths with concrete migration, server, scope, and test targets while preserving the binding intent contract and historical halt evidence.

## Review Triage Log

### 2026-09-19 — Review pass
- intent_gap: 1 (high 1)
- bad_spec: 0
- patch: 12 (high 9, medium 3)
- defer: 0
- reject: 5 (low 5)
- addressed_findings:
  - none — the high-severity authority-boundary finding requires an owner-approved replacement of the caller-controlled legacy `provision` protocol; preserving the current shared implementation is required while that decision is pending.

## Design Notes

The database is deliberately DB-first and provider-second: a provider outcome cannot create a false database claim. The public RPC is callable under a normal authenticated operator session but cannot mutate without the second, server-only attestation proof. Only its attested action allow-list and the existing Epic 11 acceptance path may mutate provisioning state; the command module is signer/orchestrator, never a service-role database privilege path.

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

Historical planning status (before implementation): ready-for-dev — the then-approved contract resolved the first two intent gaps and the implementation/test map had concrete targets. Planning halted before that implementation run.

Historical implementation result (2026-09-19, before recovery and Decision 7C):

Status: blocked
Blocking condition: implementation verification failed
Verification failure: `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run --config vitest.config.ts tests/integration/rls/platform-operators.rls.test.ts tests/integration/rls/provisioning-migration-reset.int.test.ts` cannot execute Story 12.1 assertions because the existing user-owned local stack lacks the unapplied provisioning migration (`platform_operators`, `is_platform_operator`, and `provision_tenant` are absent). The repository has no isolated Compose path, and the resource policy forbids adopting or resetting that existing stack. `pnpm typecheck` also remains blocked by unrelated tracked `tmp/private/**` and `tmp/worktrees/**` errors.

Historical implementation recovery (2026-09-19): the authorized local disposable stack received the pending repository migrations through SQL-only `pnpm exec supabase migration up --local`; the next run then resumed focused required-suite verification without resetting or otherwise managing the stack lifecycle.

Historical implementation result (2026-09-19, recovery, before Decision 7C):

Status: blocked
Blocking condition: matrix ambiguity
Evidence gathered: focused Node contracts passed (10/10); the required `SUPABASE_TEST_REQUIRED=1` four-file provisioning command/RLS/reset/search-path suite passed (18/18, zero skipped); existing admin-user compatibility tests passed (14/14); focused ESLint, `git diff --check`, review-order validation, and a bounded 674-file TypeScript check excluding only unrelated `tmp/private/**` and `tmp/worktrees/**` paths passed. The platform authority, initial atomic write, zero-write preview, durable replay/race, hostile search-path, and acceptance-to-ready coverage were made executable against the migrated local stack.
Resolved historical owner decision: this run exposed that a non-reversible stored hash cannot recover one raw token for reuse across provider attempts. Owner Decision 7C selected rotation: the initial dispatch and every explicit resend use a fresh in-memory token, the sole RPC atomically revokes/replaces the persisted hash, and no escrow, derivation, or provider/callback redesign is introduced.

Historical planning status (after Decision 7C, before Decision 8A review): in-progress — Decision 7C closed the token-lifecycle matrix ambiguity, but the subsequent review exposed an unresolved database authority/protocol gap.

Historical review result (2026-09-19, after Decision 7C and before Decision 8A):

Status: blocked
Blocking condition: intent gap
Evidence gathered: focused Node provisioning and permission-matrix contracts passed (11/11); the required `SUPABASE_TEST_REQUIRED=1` four-file provisioning/RLS suite passed (18/18, zero skipped). The Decision 7C additive migration reserves fresh token-hash generations and the local test stack applied that migration without reset.
Resolved historical owner decision: Decision 8A selects normal operator-JWT invocation plus a server-minted, domain-separated HMAC attestation for every mutation; a migration-owned insert-only database catalogue; a dedicated least-privilege function owner; signed dispatch reservations and exact-generation outcomes; and removal of the legacy delegate, broad service-role provisioning-table DML, caller-supplied retry identity, and trusted `fresh_approval` booleans. Initial provider dispatch and retry production-command evidence must be re-derived from this authority design, not simulated by fixtures.

Current planning status: in-progress — Decision 8A closes the live authority/protocol gap and Auto-BMAD may resume Phase 5 against the superseding contract. The build is not complete; implementation, migration, tests, secret provisioning, coordinated rollout, and verification still must prove the dual-proof boundary, database/TypeScript catalogue coherence, signed reservation/outcome ordering, and Decision 7C token rotation.

## Suggested Review Order

Author: implementation author.
Refreshed against the current shared working tree after the Decision 7C rotation migration.

### Platform authority and atomic provisioning

The platform allow-list is deliberately separate from tenant roles, and the one RPC checks it before accepting any action. Initial provisioning writes the tenant, first-admin invitation facts, idempotency record, and nonsecret audit event in one transaction.

- `supabase/migrations/20260919090000_tenant_provisioning.sql:13` — `is_platform_operator`: hardened platform-only predicate.
- `supabase/migrations/20260919090000_tenant_provisioning.sql:50` — `provision_tenant`: sole provisioning DEFINER command with an action allow-list.
- `supabase/migrations/20260919090000_tenant_provisioning.sql:83` — `audit_events`: records the approval boundary without raw invitation material.

### Stateless preview and bounded provider orchestration

Preview construction is pure and performs no database or Auth work. The server command reuses that preview hash for the approved write and reconciles before its explicit, one-call provider retry path.

- `src/server/commands/provisioning/validation.ts:79` — `createProvisioningPreview`: hash-bound zero-write preview authority.
- `src/server/commands/provisioning/provision-tenant.ts:30` — `previewTenantProvisioning`: does not construct a database client.
- `src/server/commands/provisioning/provision-tenant.ts:38` — `retryFirstAdminInvite`: reconciles before the provider attempt and records only a sanitized outcome.

### Per-dispatch token rotation

Decision 7C requires an explicit reservation before each provider call. The additive wrapper preserves the original RPC actions privately, while the public RPC atomically replaces a hash, supersedes the old Epic 11 capability, and records a new generation without exposing raw token material.

- `supabase/migrations/20260919100000_provisioning_dispatch_generation_rotation.sql:19` — `reserve_dispatch`: delegates unchanged actions and authorizes the bounded reservation action.
- `supabase/migrations/20260919100000_provisioning_dispatch_generation_rotation.sql:45` — `superseded_at`: invalidates the prior Epic 11 capability before the fresh generation is inserted.
- `supabase/migrations/20260919100100_provisioning_previous_token_hash.sql:6` — `capture_provisioning_revoked_token_hash`: retains only the superseded hash for durable revocation evidence.
- `tests/integration/commands/provision-tenant.int.test.ts:146` — `12.1-INT-008`: verifies token rotation, bounded attempt four, and no delivery claim.
- `tests/integration/commands/provision-tenant.int.test.ts:175` — `12.1-INT-009`: verifies timeout stays unknown and the callback binding contains no raw token.

### Platform classification and executed boundaries

The active provisioning module has a non-granting permission row, so no tenant role can obtain platform authority. The required RLS/reset tests exercise the migrated local stack, including the hardened database-object and grant canary.

- `src/server/authz/permission-matrix.ts:21` — `Platform.Operator.Access`: explicit platform-only, non-granting row.
- `tests/unit/provisioning/provisioning-contract.test.ts:23` — `12.1-UNIT-001`: strict v1 field and deferred-scope rejection.
- `tests/integration/rls/platform-operators.rls.test.ts:13` — `12.1-INT-001`: own-row-only platform allow-list read.
- `tests/integration/rls/provisioning-migration-reset.int.test.ts:7` — `12.1-INT-013`: hardened object/grant/reset canary.
- `tests/factories/platform-operators.ts:112` — `withProvisioningWriteFault`: temporary local-test triggers induce each transactional write failure without expanding production RPC input.

Evidence: this run passed the Node provisioning contracts (6/6), the required provisioning/RLS suite with `SUPABASE_TEST_REQUIRED=1` (18/18, zero skipped), and the existing admin-user integration suite (6/6). It applied the two additive migrations to the authorised local stack before the required suite. `git diff --check` passed.
Limits: this is a local-stack provider-boundary simulation; provider acceptance is not evidence that email was delivered. A full repository typecheck remains affected by unrelated tracked temporary paths, so only focused TypeScript-bearing test execution is reported here.
