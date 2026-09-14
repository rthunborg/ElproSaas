---
title: 'Story 11.3 corrective remediation: invitation identity binding'
type: 'bugfix'
created: '2026-09-14'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: '25fafa5dcd926c16ff39f8df27bc7911d9e21fbc'
context:
  - 'docs/process/review-order.md'
  - 'docs/process/local-setup.md'
  - '_bmad-output/implementation-artifacts/spec-11-3-admin-user-management.md'
---

<frozen-after-approval reason="user-authorized security remediation">

## Intent

**Problem:** The authenticated SECURITY DEFINER invitation-acceptance RPC compares an invitation to caller-supplied email. A different authenticated account with valid invitation credentials can activate the invitation for itself.

**Approach:** Preserve the established token and lifecycle checks, while resolving the caller's confirmed Auth email and user ID inside the database procedure before any membership mutation.

## Boundaries & Constraints

**Always:** Use `auth.uid()` and `auth.users` as the identity authority at the SECURITY DEFINER boundary; require a confirmed email; retain current token, expiry, supersession, tenant, audit, and generic-denial behavior; use a new migration.

**Ask First:** None.

**Never:** Do not trust RPC email or metadata, alter applied migration history, grant new roles, broaden the RPC grant, or change unrelated invitation lifecycle behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Intended user accepts | Confirmed Auth user owns the invited email and presents the current unexpired token | Exactly that membership becomes active for that Auth user and writes its existing audit event | N/A |
| Different authenticated user presents credentials | Confirmed Auth user owns a different email but supplies the invited email and valid token | RPC returns false; membership, roles, and audit remain unchanged | Generic false response |
| Expired or superseded attempt | Invited membership has an expired or superseded current attempt | RPC refuses activation as before | Existing expiry or token refusal applies |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260910165124_admin_user_management.sql` -- applied original invitation-acceptance procedure and existing safeguards.
- `supabase/migrations/20260914092606_admin_accept_membership_invitation_identity_binding.sql` -- corrective function replacement.
- `tests/integration/commands/admin-user-management.int.test.ts` -- real authenticated direct-RPC invitation acceptance regression lane.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260914092606_admin_accept_membership_invitation_identity_binding.sql` -- replace the applied function through a corrective migration, sourcing confirmed identity from Auth.
- [x] `tests/integration/commands/admin-user-management.int.test.ts` -- exercise direct authenticated RPC misuse, legitimate acceptance, and cross-tenant side-effect isolation against the local database.
- [x] This spec -- record focused verification and the author-written review order after implementation.

**Acceptance Criteria:**
- Given a different authenticated account has a valid tenant-A invitation ID and token and supplies tenant-A's invited email, when it calls the direct RPC, then it receives false and neither membership, role access, nor audit state changes.
- Given the confirmed invited account calls the direct RPC with the same valid attempt, when it accepts, then its tenant-A membership becomes active and the existing audit event is recorded.
- Given an unconfirmed or mismatched Auth identity, when it calls the RPC, then user-controlled identity fields cannot cause activation.

## Spec Change Log

### 2026-09-14 — Focused remediation review

- Independent review of the corrective migration, direct-RPC regression, and review trail found no consequential product defects.

## Verification

**Commands:**
- `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/commands/admin-user-management.int.test.ts` -- expected: direct-RPC regression executes with zero skips after the corrective migration is applied.
- `node scripts/verify/check-review-order.mjs "_bmad-output/implementation-artifacts/spec-11-3-invitation-identity-binding-remediation.md"` -- expected: final review stops resolve after authoring.

## Suggested Review Order

Author: implementation author.
Refreshed against the final uncommitted working tree based on `25fafa5dcd926c16ff39f8df27bc7911d9e21fbc`.

### Trusted identity at the privileged acceptance boundary

The RPC keeps its established signature for application compatibility, but only `auth.uid()` and the current confirmed `auth.users` row establish the activating identity. The unchanged token, lifecycle, and audit checks remain after that boundary is proven.

- `supabase/migrations/20260914092606_admin_accept_membership_invitation_identity_binding.sql:13` — `v_authenticated_user_id`: derives the activating user from the session.
- `supabase/migrations/20260914092606_admin_accept_membership_invitation_identity_binding.sql:26` — `email_confirmed_at`: requires the current Auth identity to have a confirmed email.
- `supabase/migrations/20260914092606_admin_accept_membership_invitation_identity_binding.sql:38` — `v_authenticated_email`: compares the invitation to the trusted Auth email instead of `p_email`.
- `supabase/migrations/20260914092606_admin_accept_membership_invitation_identity_binding.sql:63` — `update public.tenant_memberships`: performs activation only after identity, lifecycle, and attempt-token checks.

### Direct-RPC misuse and legitimate acceptance evidence

The required database test uses real authenticated Supabase clients. It proves a tenant-B account cannot activate tenant-A's invitation by supplying the invitee's email, snapshots invitation roles and operation state for no-side-effect evidence, and then proves only the intended confirmed account can activate once.

- `tests/integration/commands/admin-user-management.int.test.ts:89` — `mismatchedClient.rpc`: exercises the production RPC with valid credentials from a different authenticated account.
- `tests/integration/commands/admin-user-management.int.test.ts:123` — `afterMismatch`: asserts the invitation remains unbound; nearby assertions preserve roles, operation state, audit count, and tenant-B state.
- `tests/integration/commands/admin-user-management.int.test.ts:132` — `caller-controlled@example.test`: proves the matching confirmed identity can accept even when its caller email argument is false.
- `tests/integration/commands/admin-user-management.int.test.ts:145` — `replay.data`: verifies one activation audit and no replay activation.
- `tests/integration/commands/admin-user-management.int.test.ts:160` — `email_confirmed_at=null`: keeps a real authenticated session while test-only setup revokes its current confirmation, proving the database re-reads Auth identity state before activation.

Evidence: pre-fix required command-file run returned 3 passed / 1 failed / 0 skips, with the mismatched direct RPC returning `true`; after the corrective SQL was applied, `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/commands/admin-user-management.int.test.ts` passed 4 / 4 / 0 skips. A separate root-run adjacent command-plus-RLS proof passed 2 files / 6 tests / 0 skips; it is supporting evidence, not the result of the one-file command above. A broader required local database run recorded 96 files / 1,010 passed / 1 failed / 0 skips; its only failure was the unchanged `update-job.int.test.ts` accepted-price-smuggle fixture, and an immediate focused rerun of that file passed 10 / 10 / 0 skips. It is not claimed as a green whole-suite result; clean CI migration-reset evidence remains the whole-suite authority. `pnpm exec eslint tests/integration/commands/admin-user-management.int.test.ts`, `pnpm exec tsc --noEmit --pretty false`, and `git diff --check` passed.
Limits: this focused repair does not exercise email delivery or the separately tracked invitation lifecycle follow-up. The unconfirmed-identity case uses test-only local admin SQL to revoke `email_confirmed_at` after a real sign-in, so it can prove current database-bound Auth state without forging a JWT or changing Auth configuration.
