---
title: 'Story 12.2: Operator Console'
type: 'feature'
created: '2026-09-20'
status: 'ready-for-dev'
baseline_revision: 'ed7e5785f7a96422fb2251c6cc0431a4442b1cc8'
review_loop_iteration: 0
followup_review_recommended: false
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

**Commands:**
- `pnpm vitest run tests/unit/provisioning/operator-console.test.ts tests/unit/provisioning/provisioning-contract.test.ts` -- expected: exact projection, state derivation, strict preview/action mapping, and token/hash absence cases pass.
- `SUPABASE_TEST_REQUIRED=1 pnpm vitest run tests/integration/rls/platform-operators.rls.test.ts tests/integration/commands/provision-tenant.int.test.ts tests/integration/read-models/operator-console.int.test.ts` -- expected: all operator/read/action negatives and Story 12.1 compatibility cases execute with zero skips.
- `pnpm run test:e2e -- tests/e2e/auth/operator-console.atdd.e2e.spec.ts` -- expected: isolated authorization, resumable wizard, and accessibility flows run against the configured production web server.
- `pnpm lint && pnpm typecheck && pnpm run verify:service-role-containment` -- expected: no tenant-shell or service-role boundary regression; report the established unrelated `tmp/private/**` and `tmp/worktrees/**` limitation separately if stock typecheck remains affected.

## Auto Run Result

Status: ready-for-dev
Blocking condition: none
Final result: Planning completed at `ed7e5785f7a96422fb2251c6cc0431a4442b1cc8`. The spec records the isolated platform route, exact read projection, existing provisioning-command integration, and required authorization, data-exposure, recovery, and accessibility evidence. No implementation or runtime verification ran in this planning-only pass.
