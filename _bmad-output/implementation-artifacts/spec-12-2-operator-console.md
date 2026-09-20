---
title: 'Story 12.2: Operator Console'
type: 'feature'
created: '2026-09-20'
status: 'done'
baseline_revision: 'ed7e5785f7a96422fb2251c6cc0431a4442b1cc8'
baseline_commit: '661dfd33a2f9992254a521ac71b64ef885eda862'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '_bmad-output/project-context.md'
  - '_bmad-output/implementation-artifacts/epic-12-context.md'
  - '_bmad-output/planning-artifacts/architecture-phase-b.md'
  - '_bmad-output/test-artifacts/test-design-progress-epic-12.md'
  - 'docs/process/review-order.md'
warnings:
  - oversized
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 12.1 establishes the privileged, attested provisioning protocol but supplies no operator-facing surface to inspect its safe state or guide a platform operator through it. Reusing the tenant shell or exposing raw provisioning state would either deny valid operators or leak tenant/business and secret-adjacent facts.

**Approach:** Add an operator-only, Swedish console at `operator/**`, outside tenant context and navigation. It presents only an allow-listed tenant/provisioning projection and a three-step wizard that drives the existing preview, approved provision, reconciliation, and explicit retry contracts through server-only adapters.

## Boundaries & Constraints

**Always:** Authorize every page, read model, and server action against the live `is_platform_operator()` allow-list after revalidated cookie-bound identity; render generic denials with no data or side effects for every other identity. Keep the console projection to tenant name, canonical organisation identity, provisioning state, created timestamp, and first-Admin state only. Reuse Story 12.1 public commands and their strict decoder/hash/approval, never their dependency-injection seams or raw RPC payloads. The UI may display only server-projected, non-secret reconciliation/attempt facts; it must never serialize request/preview hashes, baseline internals beyond the preview confirmation, membership or reservation identifiers, token hashes, attestation material, audits, contact details not selected for the wizard, or tenant business data. Preserve the sole public provisioning writer, normal operator JWT plus attestation boundary, and the existing request/retry state machine.

**Block If:** Halt if the desired console behavior needs a tenant business read; grants direct browser access to base provisioning/tenant tables; adds a callable `SECURITY DEFINER` writer, service-role database path, tenant-grantable platform capability, public signup route/copy, or changes Story 12.1's request schema, identity/idempotency, catalogue, approval generation, token rotation, or provider-outcome contract.

**Never:** Put `operator/**` below `(app)`, resolve tenant context or mount `AppShell`/tenant navigation there, treat `Platform.Operator.Access` metadata as authorization, rely on layout-only access control, fetch raw `provision_tenant(..., reconcile)` output into the browser, claim provider acceptance means email delivery, auto-retry an `unknown` outcome, add offline/PWA behavior, or build Story 12.3's checklist/onboarding surface.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Operator opens console | Revalidated allow-listed operator | Isolated layout lists only exact identity/status/created/first-Admin fields; no tenant shell or nav | Read fault or unauthorized identity renders the same generic denial/empty-safe state without internal detail |
| Dry preview | Complete supported step-1 and step-3 values plus selected baseline | Server returns normalized identity, validation/warnings, exact migration-owned baseline ID/version/content hash, proposed values, and preview hash; no write, audit, Auth, or stored preview | Unsupported/deferred/malformed/stale inputs render a Swedish validation/error state and cannot reach approval |
| Explicit approval | Original request, unchanged preview hash, explicit confirmation | Server invokes existing provision command; created result progresses through durable state and initial handoff | `PREVIEW_STALE`, mismatch, conflict, and unexpected failure are sanitized; duplicate submit cannot present duplicate creation success |
| Reload or replay | Existing tenant/request in any durable provisioning state | Detail/resume derives display and next allowed action from safe server state; replay is reconciled before `ALREADY_PROVISIONED` | Never infer state from browser clicks or repeat provider work |
| Handoff retry | Explicit retry after provider-free reconciliation | Server uses existing fresh-token reservation/outcome protocol; visible attempt 1–3 outcome is requested, unknown, failed, or ready | `unknown` offers reconciliation, never blind resend; attempt 4 requires a fresh preview/approval/newer generation and explains older links are invalid |
| Non-operator access | Tenant Admin, other tenant role, orphan, anonymous, absent/forged claim | Generic denial, no console data, no tenant existence signal, and no writes | Identical user-safe response across denied identities |

</intent-contract>

## Code Map

- `src/app/(app)/layout.tsx:39` and `src/components/app-shell/RouteAccessBoundary.tsx:11` -- tenant-only boundaries that resolve memberships and mount `AppShell`; operator routes must not import either.
- `src/server/db/supabase-server-client.ts:18` -- fresh cookie-bound anon/RLS client and JWT revalidation transport required for the platform gate and console server entries.
- `supabase/migrations/20260919090000_tenant_provisioning.sql:19` and `supabase/migrations/20260919183425_provisioning_review_authority_fixes.sql:12` -- tenant/provisioning state source and the sole attested writer; its reconciliation payload is server-only and too broad for a UI DTO.
- `src/server/commands/provisioning/provision-tenant.ts:97`, `:130`, `:138`, and `:242` -- public provision, preview, and retry/reconcile boundaries; action adapters call these public exports only.
- `src/server/commands/provisioning/validation.ts:133` -- strict canonical request and preview construction authority; the wizard mirrors no identity/VAT/email rules in the client.
- `src/server/authz/permission-matrix.ts:18` and `src/scope/manifest.ts:214` -- platform capability is active, non-tenant-grantable classification metadata; `is_platform_operator()` remains the authorization authority.
- `src/features/admin-users/actions.ts:1`, `action-state.ts:1`, and `src/components/admin-users/UsersPage.tsx:9` -- server-action result, pending/retry, accessible feedback, and Swedish list/dialog conventions to adapt without importing tenant authorization.
- `tests/integration/rls/platform-operators.rls.test.ts:12`, `tests/integration/commands/provision-tenant.int.test.ts:14`, and `tests/factories/platform-operators.ts` -- operator/non-operator fixtures and Story 12.1 protocol assertions to extend.
- `_bmad-output/test-artifacts/test-design-progress-epic-12.md:191` -- required 12.2 unit, integration, static, browser-resume, and accessibility scenarios.

## Tasks & Acceptance

**Execution:**
- `src/app/operator/layout.tsx`, `src/app/operator/page.tsx`, and `src/server/auth/resolve-platform-operator.ts` -- create a force-dynamic platform boundary outside `(app)` that revalidates identity and independently gates page/read/action entry points with `is_platform_operator()`; use the established generic no-access posture and no tenant context/nav imports.
- `supabase/migrations/*_operator_console_projection.sql` and `src/server/read-models/operator-console.ts` -- add the minimum read-only, platform-authorized projection contract required for a list/detail state, with an exact DTO of name, canonical organisation identity, provisioning state, created time, and first-Admin state. It must grant neither base-table/browser traversal nor tenant-business fields, remain non-mutating, and preserve the sole Story 12.1 writer; the server model must project safe console data rather than relay raw RPC rows.
- `src/features/operator-console/wizard-state.ts`, `src/components/operator-console/OperatorConsole.tsx`, and `src/components/operator-console/ProvisioningWizard.tsx` -- add a small client wizard and list/detail presentation: `Företagsuppgifter`, preview-derived `Baslinje`, and `Bjud in första Admin`, followed by hash-bound approval. Derive resume/retry affordances from server state; show explicit pending/failure/retry and truthful requested/unknown/failed/ready labels with semantic text and focusable validation/status feedback.
- `src/features/operator-console/actions.ts` and `src/features/operator-console/action-state.ts` -- parse FormData narrowly, invoke only `previewTenantProvisioning`, `provisionTenant`, and `retryFirstAdminInvite`, project generic Swedish errors, preserve an operation/request identity until reconciliation, and revalidate the operator route after confirmed state changes. Keep preview zero-write and prevent client-supplied baseline values, retry identity, outcomes, or trust flags.
- `tests/unit/provisioning/operator-console.test.ts` and `tests/unit/provisioning/provisioning-contract.test.ts` -- pin exact DTO allow-list/field absence, deterministic server-state-to-wizard-step transitions, strict presentation of unsupported inputs, preview/approval binding, and no raw secret/protocol facts in UI-state projections.
- `tests/integration/rls/platform-operators.rls.test.ts`, `tests/integration/commands/provision-tenant.int.test.ts`, and `tests/integration/read-models/operator-console.int.test.ts` -- prove each server entry authorizes independently; operator reads exact fields only; tenant roles, orphan, anonymous, absent/forged claims, aliases/nested canaries, and direct base-table paths reveal no data or existence signal and have zero side effects.
- `tests/e2e/auth/operator-console.atdd.e2e.spec.ts`, `scripts/verify/check-operator-console-isolation.mjs`, and `tests/unit/scripts/verify/check-operator-console-isolation.test.ts` -- prove isolated direct-route access, three semantic wizard steps, zero-write preview, explicit approval, reload/replay recovery, provider-state truthfulness, keyboard/pending behavior, tenant/anonymous denials, and no `(app)`/AppShell/nav-registry imports below `operator/**`.

**Acceptance Criteria:**
- Given an allow-listed operator opens `/operator`, when the server renders any console entry, then it independently verifies platform authority and renders an isolated operator layout with only tenant name, canonical organisation identity, provisioning status, created time, and first-Admin state; tenant navigation has no operator entry.
- Given a tenant Admin, other tenant user, orphan, anonymous request, or absent/forged operator identity targets a page, list/detail read, preview, provision, reconciliation, or retry action, when it executes, then it receives the same generic denial with no console/business data, existence signal, audit, provider call, or database mutation.
- Given `Provisionera ny tenant`, when the operator completes the three data-entry steps, then company identity/contact inputs, preview-derived exact baseline facts, and first-Admin name/normalized email are presented in Swedish; no baseline value is retyped or accepted from the browser outside the strict preview request.
- Given a valid dry run, when preview is requested, then its normalized values, warnings, proposed values, exact catalogue identity/hash, and confirmation basis render while database rows, audit, Auth, and preview storage remain unchanged; malformed, unsupported, deferred, stale, or changed input cannot advance to approval.
- Given explicit approval of the original request and preview hash, when provision is submitted, then the existing Story 12.1 command is the only writer and the resulting state is server-confirmed; a replay reconciles before showing `ALREADY_PROVISIONED` and cannot appear as a second successful create.
- Given a persisted handoff state after reload or a new browser context, when the operator resumes it, then the console derives status, attempt number, reconciliation action, and allowed next action from the safe server projection; it never derives state from browser history or click tracking.
- Given a requested, unknown, failed, or ready first-Admin handoff, when the finish/resume view renders, then it uses those durable labels and never claims email delivery. `unknown` requires reconciliation before an explicit retry, attempts one through three are distinct generations, and attempt four requires fresh preview/approval with an explanation that older links are invalid.
- Given console projection or browser response construction, when tenant A/B customer, quote, file, money, membership, raw hash, token, attestation, audit, and aliased/nested canary fields are present in backing rows or test fixtures, then none appears in DTO keys, values, errors, markup, or browser payload.

## Design Notes

The console is a platform surface, not a tenant feature. Its database-facing read contract is therefore a narrow, read-only boundary with a fixed projection, while its mutations stay entirely within the already-attested Story 12.1 protocol. This separation avoids both a privileged client-side query and a second provisioning writer.

The wizard has no client-authoritative state machine: preview is transient and write-free, while every post-provision screen is reconstructed from durable server state. Provider acceptance remains only a recorded request outcome; the UI must preserve that distinction in its Swedish status copy.

## Verification

- Final focused unit/static suite: 30 passed, 0 failed, 0 skipped: `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/provisioning/operator-console.test.ts tests/unit/provisioning/provisioning-contract.test.ts tests/unit/scripts/verify/check-operator-console-isolation.test.ts`.
- Required local RLS/command/read-model suite: 22 passed, 0 failed, 0 skipped with `SUPABASE_TEST_REQUIRED=1`; migrations were applied with additive `supabase db push --local` only.
- Scoped ESLint passed with 0 errors; the four unused Server Action parameter warnings in `actions.ts` are pre-existing. `git diff --check` passed.
- Clean-checkout production build at `8185e681b338759e6bf846ba8f6421e03a7636c8` passed compilation and TypeScript; `/operator` and `/operator/[tenantId]` were emitted.
- The final guarded production-server inventory at loopback port 33122 returned HTTP 200 for `/operator` and found 12 rendered assets with 0 absent from that exact `.next` build.
- Final clean-checkout Playwright ran 5 tests with 5 passed, 0 failed, 0 skipped. It covers both positive operator identities (including no tenant membership), tenant-admin/anonymous generic denial, Swedish keyboard progression, hash-bound preview/approval, one-use replay denial, canonical list-link resolution, and reload/new-context unknown reconciliation followed by a confirmed retry.
- An intermediate production run exposed a reachable confirmation-feedback regression: the retry persisted `first_admin_invite_requested`, then the Server Action refresh unmounted the action component before its success message rendered. The final lifecycle fix keeps recovery feedback mounted while suppressing stale retry controls; the final five-case browser run verifies the confirmed message and durable post-retry state.
- `node scripts/verify/check-operator-console-isolation.mjs` passed. A fresh root `pnpm run verify:service-role-containment` invocation could not start because its bundled Node 20 pnpm resolver was denied `lstat C:\Users\Rasmus`; its earlier successful evidence is retained, but this invocation is unverified. Repository-root stock typecheck/lint remain limited by ignored `tmp/private/**` and `tmp/worktrees/**` material.

## Auto Run Result

Status: done
Blocking condition: none
Final result: Phase 7 completed a fresh follow-up review of the finished Story 12.2 change. It patched seven findings (four high, two medium, one low), rejected seven non-reachable claims and dismissed one test-only gap with no named bypass; no intent gaps, bad-spec findings, or deferrals remain. Final focused unit/static evidence is 30/30, required integration is 22/22 with zero skips, and the clean production browser suite is 5/5 with zero skips. Security review returned no findings. The configured external Luna review invocation ended without output, a session handle, or its expected artifact, so it remains an unverified failed-to-return layer rather than a no-findings result.

## Review Triage Log

### 2026-09-20 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 4 (high 3, medium 1, low 0)
- defer: 0
- dismissed:
  - none
- addressed_findings:
  - [high] [patch] Added the safe detail/resume projection, explicit unknown reconciliation, and server-bound retry identity; no browser form supplies a tenant id for recovery.
  - [medium] [patch] Rendered server-derived normalized identity, Admin email, baseline version/content hash, proposed action, and warnings before approval while keeping request and preview hashes out of markup.
  - [high] [patch] Corrected the generated browser fixture organisation number after the shared validator rejected a date-like identity; UNIT-004 now proves the exact closed request has a valid zero-write preview.
  - [high] [patch] Corrected a one-use opaque-grant replay: cookies created at `/operator` now delete at `/operator`; UNIT-005 and production browser replay prove the second approval is denied without a second provision.

Security Sol/xhigh found no production-reachable issue. The exact external Luna/xhigh invocation did not return output or create its expected artifact; it was not retried and remains a review limitation.

### 2026-09-20 — Follow-up review pass (Phase 7)

- intent_gap: 0
- bad_spec: 0
- patch: 7 (high 4, medium 2, low 1)
- defer: 0
- reject: 7
  - Server-bound resolved detail identity is a non-secret route fact and does not accept browser FormData; no authorization or tenant-isolation bypass was identified.
  - Durable unknown is derived from the lifecycle projection maintained by the provisioning RPC; no divergent persisted path was demonstrated.
  - Request identity scoped to organization number is the established Story 12.1 canonical/idempotency protocol; the reviewer identified no collision bypass.
  - The SE-only organization validator and single-invite-per-tenant primary key already enforce the two alleged input and multiplicity paths.
  - The existing resume-state storage has no demonstrated caller that bypasses the server-gated detail/recovery path.
  - The reconciliation target is server-resolved and action-bound; it is not an independently browser-supplied identity.
  - The review did not identify a stale retry control after the final component lifecycle design; production E2E proves it is absent when the handoff advances.
- dismissed: 1
  - Per-action direct HTTP invocation coverage was proposed without a reachable Server Action capability or a missing platform gate. Each action independently resolves the platform operator, so this is not a defect finding.
- addressed_findings:
  - [high] [patch] Mounted unknown handoff recovery whenever reconciliation is required, rather than only when retry was already permitted.
  - [high] [patch] Removed direct retry action variants that accepted browser FormData tenant identity; recovery now uses only server-bound detail identity or an opaque reconciliation grant.
  - [medium] [patch] Strengthened the positive projection/identity integration evidence and a per-journey organization number so test setup cannot take an idempotent shortcut.
  - [high] [patch] Decoded the canonical `SE:` list-link route identifier before its server read, retaining generic denial for malformed encoding.
  - [medium] [patch] Made the unknown-handoff browser fixture protocol-complete and executed reconciliation before retry.
  - [high] [patch] Retained confirmed recovery feedback through the Server Action refresh while withholding retry controls after durable state advances.

Security Sol/xhigh found no production-reachable issue. The recovered edge-case and verification-gap layers completed against the frozen review snapshot. The exact external Luna/xhigh invocation returned no output, session handle, or artifact and remains unverified rather than a clean result.

## Suggested Review Order

Author: implementation/fix author.
Refreshed against the final Story 12.2 source tree from `399f8e59b94cfe17ad591df0a626c0aeae5dc487`.

### Isolated platform entry and read boundary

Every console entry independently resolves the live allow-list and projects only the approved data shape. The route remains outside the tenant shell.

- `src/server/auth/resolve-platform-operator.ts:13` — `resolvePlatformOperator`: revalidates the authenticated user and live operator status.
- `src/app/operator/layout.tsx:7` — `resolvePlatformOperator`: denies before operator UI renders.
- `src/server/read-models/operator-console.ts:16` — `resolvePlatformOperator`: independently gates projection reads.
- `supabase/migrations/20260920100000_operator_console_projection.sql:2` — `operator_console_projection`: defines the fixed read-only projection.

### Preview, approval, and durable recovery

The browser submits a closed request for a zero-write preview, then carries only an opaque per-preview handle. Recovery paths stay server-bound and preserve the existing Story 12.1 writer.

- `src/features/operator-console/provisioning-request.ts:20` — `requestFromOperatorConsoleForm`: fixes all catalogue/commercial facts on the server.
- `src/features/operator-console/actions.ts:29` — `previewOperatorProvisioningAction`: gates before preview and writes only the opaque approval grant.
- `src/server/provisioning/operator-preview-grant.ts:40` — `store.delete`: consumes the preview grant at its `/operator` path.
- `src/server/provisioning/operator-reconciliation-grant.ts:34` — `store.delete`: applies the same one-use path rule to reconciliation retry grants.
- `src/features/operator-console/actions.ts:88` — `retryReconciledOperatorFirstAdminInviteAction`: consumes the opaque retry grant and reports only after the persisted command result.
- `src/app/operator/[tenantId]/page.tsx:30` and `src/components/operator-console/HandoffRecovery.tsx:12` — retain confirmed retry feedback across the Server Action refresh while rendering a retry control only for a currently actionable durable state.

### Acceptance evidence and operational limits

The tests exercise the disclosure boundary, closed preview, cookie consumption, required RLS suites, and a production browser journey. The external provider remains a local fixture boundary; browser assertions prove recorded state and never email delivery.

- `tests/unit/provisioning/operator-console.test.ts:172` — `12.2-UNIT-009`: retains recovery feedback while durable state advances.
- `tests/integration/read-models/operator-console.int.test.ts:40` — exercises the exact safe list and canonical-identity projection path.
- `tests/e2e/auth/operator-console.atdd.e2e.spec.ts:45` — follows the canonical list link and proves opaque approval, replay denial, reload/new-context recovery, reconciliation, retry confirmation, and keyboard behavior.

Evidence: focused unit/static 30/30; required integration 22/22 with `SUPABASE_TEST_REQUIRED=1`; final clean production build passed; served inventory 12/12; final production Playwright 5/5, all zero skipped.
Limits: stock root lint/typecheck remain affected by ignored scratch/worktree files. The external Luna review failed to return a session handle or artifact, so follow-up review remains recommended; it is not recorded as a clean review.
