---
title: 'Story 11.3: Admin User Management'
type: 'feature'
created: '2026-09-10'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: '03b3c7568942ac984f0bfdd0f09d31f449b12cb8'
baseline_commit: '0f50cfe3b0f54dcdb0882e22db3321695fde5179'
context:
  - '_bmad-output/implementation-artifacts/epic-11-context.md'
  - '_bmad-output/implementation-artifacts/spec-11-2-non-admin-access-to-the-phase-a-surface-matrix-seed-role-aware-rls-nav-and-landing.md'
  - '_bmad-output/planning-artifacts/owner-decisions-applied-2026-09-10-story-11-3-admin-user-management.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Tenant Admins cannot manage their users without engineering help, and the current three-state membership model cannot safely represent invitation delivery, expiry, revocation, or preserved former-member history.

**Approach:** Activate the RBAC administration surface with server-authorized user lifecycle commands, durable Auth-operation reconciliation, an Admin-only users UI, and an auditable tenant-scoped invitation acceptance path.

## Boundaries & Constraints

**Always:** Treat the database membership state as the only tenant-access authority. Use the resolved `tenant_admin` capability, RLS, hardened authenticated DB wrappers, and append-only audit for every mutation. Preserve `is_tenant_admin()` and the existing role-set union: when `tenant_admin` is selected it remains the scalar compatibility role, and every selected role is represented in `membership_roles`. Require a non-empty explicit role set and a reason for role changes. An Admin cannot remove, disable, or downgrade the last active Admin. An `ended` row is retained immutable history; a fresh invite creates a new membership identity under a partial live-membership uniqueness constraint. Auth calls run only after an operation and audit record commit; all retries reuse the operation identity and record `succeeded`, `failed`, or `uncertain` without leaking Auth details. Invitation acceptance verifies the current opaque attempt token, Auth user, state, and expiry before activation.

**Block If:** Stop if the pinned Supabase Auth invite and existing-user magic-link APIs, configured redirect allow-list, and Auth-owned templates cannot preserve the per-attempt redirect through a verified authentication callback, or if the authenticated user cannot be bound to the operation. Do not substitute a less-bound email flow.

**Never:** Do not globally ban/delete Auth users, direct-DML membership/role tables, broaden raw audit or service-role access, expose the service credential or Auth response to a client, add custom email/background jobs, tenant-custom roles, a DB permission table, the Story 11.4 Roles/effective-permissions surface, or E14/E15 scheduling reassignment.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Invite and accept | Admin submits email, roles, and operation id | Durable operation/audit precedes a Supabase invite for a new Auth user or its standard magic-link delivery for an existing account; the final membership is `invited`; a current unexpired token activates it | Auth or finalization failure is recorded; reconciliation resumes without duplicating a membership mutation |
| Resend or revoke | Existing invited membership | Resend supersedes its old token; revoke denies the invite immediately | Old, revoked, expired, or superseded token cannot activate access |
| Lifecycle/roles | Active member with a valid operation id | Reset, disable, reactivate, re-role, or end changes only the tenant membership and writes audit/history | Last-active-Admin, cross-tenant, invalid transition, or missing role-change reason returns generic denial with no audit side effect |
| Repeated/recovered request | Existing pending, failed, or uncertain operation | Same operation is replayed/reconciled and returns its current result | No exactly-once email claim; access removal remains in force if Auth cleanup fails |

</intent-contract>

## Code Map

- `src/scope/manifest.ts`, `manifest-schema.ts`, `src/components/app-shell/nav-items.ts`, and `src/server/authz/phase-a-surface.ts` -- activate `rbac` with `/admin/users` and its Admin capability in the same change; keep existing foundation tables there and enroll only the new operation table in `rbac`.
- `src/server/authz/permission-matrix.ts`, `require-capability.ts`, `src/server/commands/envelope.ts`, and `envelope-core.ts` -- extend the closed Admin-only capability vocabulary and retain pre-validation generic denial.
- `supabase/migrations/20260625122433_tenant_foundation.sql`, `20260904120000_role_storage_and_permission_matrix.sql`, and `20260907171252_role_aware_phase_a_policy_evolution.sql` -- preserve the scalar-role compatibility, multi-role composite FK, self-read/Admin-list RLS, and no direct app-path membership mutation.
- `src/server/auth/resolve-tenant-context.ts`, `tenant-context.ts`, `middleware.ts`, and `src/server/storage/quote-pdf-signer.ts` -- reuse active-membership semantics and the documented server-only credential containment pattern; do not generalize the quote signer.
- `supabase/config.toml`, `supabase/templates/invite.html`, `supabase/templates/magic-link.html`, `src/app/auth/invite/confirm/route.ts`, and `src/app/(auth)/invite/accept/page.tsx` -- configure the existing Supabase Auth invitation and magic-link deliveries with their permitted redirect; exchange only the Auth token in the callback before an authenticated, attempt-bound acceptance command.
- `src/components/crm/Dialog.tsx`, `FormField.tsx`, `src/features/*/actions.ts`, and `src/components/app-shell/RouteAccessBoundary.tsx` -- existing accessible dialog, server-action, and generic direct-route-denial patterns for the new Users surface.
- `tests/factories/tenants.ts`, `tests/integration/rls/{membership-self-grant,membership-roles,has-tenant-role,role-storage-grants}.int.test.ts`, `tests/integration/commands/disabled-membership-no-access.int.test.ts`, `tests/e2e/auth/role-aware-phase-a-surface.atdd.e2e.spec.ts`, and containment tests -- extend established tenant/role, RLS, browser, and service-role proof lanes.

## Tasks & Acceptance

**Execution:**
- `supabase/migrations/20260910120000_admin_user_management.sql`, `tests/integration/rls/admin-user-management.rls.test.ts`, and `tests/integration/commands/admin-user-management.int.test.ts` -- add lifecycle timestamps and canonical invited-email storage; permit a null `user_id` only while an invitation awaits authenticated binding; replace the current single-membership uniqueness with a partial live-membership constraint so retained `ended` history cannot be revived; add `membership_admin_operations` plus hashed per-attempt invitation-token storage; activate/enroll `rbac`; use narrow hardened wrappers that serialize the tenant for last-Admin protection, bind actor/target/action/audit, and persist/reconcile operations without direct authenticated table writes.
- `src/server/auth/admin-user-service.ts`, `src/server/commands/admin-users/{invite,resend,revoke,lifecycle,reconcile}.ts`, `src/features/admin-users/read.ts`, and `src/features/admin-users/actions.ts` -- create the only Auth-admin client, prepare/finalize/reconcile each operation, map failures generically, project only tenant-owned user identity/status/history after database authorization. Use `inviteUserByEmail` for a new Auth user; after its documented confirmed-user response, use Supabase's standard `signInWithOtp` delivery with user creation disabled for an existing account. Extend service-credential containment/build checks with this exact server-only exception and no client reachability.
- `src/app/(app)/admin/users/page.tsx`, `src/app/(app)/admin/users/[membershipId]/page.tsx`, `src/components/admin-users/UsersPage.tsx`, and `src/components/admin-users/UserDetailPanel.tsx` -- add the Admin-only `Användare & roller` Users list, filters, invite dialog, lifecycle/role confirmations, and `Händelser` detail panel; say access is removed for this company and preserve the E14/E15 reassignment note as a seam.
- `supabase/config.toml`, `supabase/templates/invite.html`, `supabase/templates/magic-link.html`, `src/app/auth/invite/confirm/route.ts`, `src/app/(auth)/invite/accept/page.tsx`, and `docs/process/local-setup.md` -- configure the existing Supabase Auth invite and magic-link templates plus URL allow-list to carry the opaque attempt value; the callback exchanges only an Auth token/session and invokes no privileged tenant command before verification; accept only the current stored token/database lifecycle. Document the hosted redirect/template prerequisite without adding custom email infrastructure.
- `tests/unit/admin-users/admin-user-service.test.ts`, `tests/unit/admin-users/accept-invitation.test.ts`, `tests/integration/commands/admin-user-management.int.test.ts`, `tests/integration/rls/admin-user-management.rls.test.ts`, `tests/e2e/auth/admin-user-management.atdd.e2e.spec.ts`, `tests/factories/tenants.ts`, and the existing service-role/bundle containment tests -- prove every action/audit/outcome, retries, expiry/revoke/supersession, last-Admin serialization, cross-tenant/no-direct-DML negatives, token-bound acceptance, and Admin-only navigation/direct-route behavior.

**Acceptance Criteria:**
- Given an Admin opens `Användare & roller`, when they invite, resend, revoke, reset, disable/reactivate, re-role, or end a tenant membership, then the Users UI confirms the server result and the detail `Händelser` panel shows the auditable lifecycle outcome.
- Given an invitation is expired, revoked, or superseded, when its recipient follows any delivered link, then database acceptance refuses it and no tenant access is granted.
- Given an active member is the tenant's last Admin, when a disabling, ending, or role-downgrade command is attempted, then the serialized database command rejects it and preserves active Admin access.
- Given a shared Auth account belongs to several tenants, when one tenant disables or ends its membership, then only that tenant loses access and its history remains visible; a later return requires a new invitation and selected roles.
- Given a repeated, failed, or uncertain Auth operation, when it is retried or reconciled, then membership mutations remain single-effect, the durable outcome is visible, and no duplicate-delivery guarantee is claimed.

## Spec Change Log

## Review Triage Log

### 2026-09-10 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 9 (high 6, medium 3)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high] [patch]` Added Auth callback support for both PKCE codes and GoTrue token-hash links, with recovery routed to password update.
  - `[high] [patch]` Added the confirmed-account magic-link fallback, durable uncertain-outcome handling, lifecycle operation replay, and lock-then-authorize checks.
  - `[high] [patch]` Preserved and displayed all membership roles when editing a user.
  - `[medium] [patch]` Projected and persisted expired invitations, required a configured production app origin, and exposed password setup from invitation acceptance.

## Auto Run Result

Story implementation is complete: the RBAC module is activated with tenant-scoped membership lifecycle records, an Admin-only Users surface, an Auth-bound invitation acceptance flow, and RLS inventory coverage. The Auth adapter delivers standard invites or an existing-account magic link only after the durable operation/audit boundary; reset operations, callbacks, role unions, and replay outcomes are guarded server-side.

Implemented files include the admin-user migration, server commands/Auth adapter, callback and invitation/password routes, admin pages/components/read model, Auth templates/configuration, and Story 11.3 RLS, command, unit, inventory, and browser evidence. Scope/nav/permission and containment documentation/guards were updated for the active RBAC surface.

Review findings: 9 patches applied, 0 deferred, 0 rejected. The independent Luna/xhigh full-diff review found nine concrete issues; all were repaired. Follow-up review recommendation: `true` (6 high, 3 medium; score 21). A later latest-fix regression check repaired reset-operation terminal replay without reopening broad review.

Verification performed: typecheck and lint passed; unit tests passed 1,724/1,724; required local integration passed 1,011/1,011 with 0 skips; focused Story RLS/command suite passed 123/123; service-role and built-bundle containment passed; final guarded-production browser smoke passed 2/2.

Residual risk: browser evidence covers Admin list/detail and non-Admin denial. Lifecycle buttons retain command/RLS coverage but no end-to-end Auth-email delivery test, because the disposable local SMTP is not a user mailbox assertion harness.

## Design Notes

The operation row is the narrow outbox-shaped boundary for this story, not a generic runner. It is committed before the external call so the database can safely reconcile response loss. A cryptographically random per-attempt token is stored only as a hash and included only in the Auth redirect; acceptance checks that exact current attempt, preventing a late old email from activating a newly resent or revoked invitation. A new Auth account uses the standard Supabase invite email. An already confirmed shared Auth account cannot use that API, so it receives a standard Supabase magic-link email with user creation disabled; neither path uses a custom sender. The Auth callback may only exchange the Supabase token for a session; it performs no membership lookup or mutation until the authenticated acceptance command validates the nonce, authenticated user, canonical invited email, tenant, state, and expiry. This keeps the callback outside the closed privileged-public-surface set.

## Verification

**Commands:**
- `pnpm run typecheck` and `pnpm run lint` -- lifecycle types, route/nav authority, server-only imports, and exhaustive inventory compile cleanly.
- `pnpm run test:unit` -- operation state, capability, acceptance-token, presentation, and containment tests pass.
- `supabase db reset --local`; then `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` -- migration, RLS/ACL, Auth-operation adapter, last-Admin race, audit, and cross-tenant suites execute without skips.
- `pnpm run test:e2e` -- Admin user lifecycle and denied direct route pass without client-visible service credentials.
- `pnpm run verify:service-role-containment`; `pnpm build`; `pnpm run verify:bundle-containment` -- the Auth-admin client remains server-only and no credential/token leaks into built artifacts.
