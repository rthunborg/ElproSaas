---
title: 'Story 12.3: First-Admin Onboarding Checklist'
type: 'feature'
created: '2026-09-20'
status: 'done'
baseline_revision: '90bd4018bad03056a3ac1a9191c3488352809b55'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '_bmad-output/project-context.md'
  - '_bmad-output/implementation-artifacts/epic-12-context.md'
  - '_bmad-output/planning-artifacts/architecture-phase-b.md'
  - '_bmad-output/test-artifacts/test-design-epic-12.md'
  - 'docs/process/review-order.md'
warnings:
  - oversized
deferred: []
---

<intent-contract>

## Intent

**Problem:** A newly provisioned tenant's first Admin can sign in after Story 12.1 reaches `ready`, but the tenant dashboard has no truthful, resumable guide to the remaining existing configuration and user-invitation work required for the B1a working-state proof.

**Approach:** Add a tenant-admin `Kom igång` dashboard checklist whose five stable Swedish items and working-state aggregate are derived only from current RLS-scoped server facts. Persist only each Admin membership's presentation dismissal; reuse the existing settings, pricing, terms, and user-invitation surfaces as the actions that change completion.

## Boundaries & Constraints

**Always:** Render only for an active `tenant_admin` in a tenant whose durable provisioning state is `ready`; derive tenant and membership from the revalidated cookie/JWT context, never a client tenant or membership ID. Keep the fixed order, labels, and real deep links: `Företagsinställningar` (`/settings/company`), `Moms & visning` (`/settings/company`), `Offertvillkor` (`/settings/quote-terms`), `Arbetsroller & priser` (`/settings/pricing`), and `Bjud in användare` (`/admin/users`). Evaluate company identity from a persisted nonblank company-settings name and normalized organization number equal to the resolved tenant identity; accept persisted valid VAT display/rate defaults as configuration; treat nonblank persisted terms as complete while separately retaining the existing NULL-`approved_at` Phase-A warning; require at least one active work role; and require at least one additional, non-expired invited or active membership with an assigned role, excluding the current Admin. Treat read errors, pending/foreign state, and malformed rows as incomplete or unavailable, never green. Dismiss/restore changes only the current active membership's nullable dismissal timestamp and never changes item or tenant completion; all writes use the normal authenticated/RLS path with attributable audit treatment. The implementation author must add and validate exactly one final `## Suggested Review Order` after code and verification exist, following `docs/process/review-order.md`.

**Block If:** Halt if completion needs a new settings schema, checklist/onboarding table, client-supplied tenant/membership identity, a broad membership update grant/policy, an unapproved role/visibility rule, or a predicate that requires the deferred full-release legal/GDPR program. Halt if the implementation cannot keep `approved_at` as a visible sign-off warning rather than silently approving terms.

**Never:** Add public signup/registration copy, routes, APIs, or capability; build an onboarding wizard, a separate click-tracking or completion store, a new tenant module/nav item, a platform/operator surface, offline/PWA behavior, a service-role/client path, arbitrary user count, hardcoded commercial limits/prices, or changes to Stories 12.1/12.2 provisioning, invite-token, baseline, or operator-console contracts.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First Admin enters ready tenant | Active `tenant_admin`, `tenants.provisioning_state='ready'`, one or more incomplete real facts | Dashboard pins the ordered five-item checklist; each item links to its existing surface and the aggregate is working only when all are green | Read failure leaves no false green state and uses the established safe error posture |
| Baseline-default and warning facts | Provisioned company row contains valid default VAT values; terms are persisted but `approved_at` is NULL | Company/VAT can be green from persisted facts; terms can be green from nonblank text while the explicit Phase-A sign-off warning remains visible | No client click, UI fallback, or approval flag can alter completion |
| User-invitation boundary | Only current first Admin exists, or another membership is expired/revoked/roleless | `Bjud in användare` stays incomplete; it becomes green only for an additional invited/active, role-bearing membership | Foreign tenant or malformed membership never counts |
| Per-Admin dismissal and reminder | An incomplete checklist is dismissed, reloaded, then restored | Dismissal remains hidden only for that current membership; reminder restores the same derived state without changing any item | A member cannot dismiss, restore, or mutate another member's presentation state |
| Non-ready or non-admin request | Pending/failed tenant, anonymous user, or active non-admin membership | No onboarding card or sensitive state is exposed | Existing route/context authorization fails closed with no mutation |

</intent-contract>

## Code Map

- `src/app/(app)/dashboard/page.tsx:1` and `src/app/(app)/dashboard/layout.tsx:1` -- current dashboard placeholder behind the tenant route boundary; mount the checklist here without a new route or nav item.
- `src/server/auth/resolve-tenant-context.ts:86` and `src/server/db/supabase-server-client.ts:18` -- authoritative cookie/JWT tenant and current-membership resolution plus RLS transport; onboarding reads/writes must not accept browser identity selectors.
- `src/features/settings/read.ts:24` and `src/features/pricing/read.ts:25` -- existing RLS-scoped company, quote-terms, and active-work-role read seams; distinguish persisted row facts from page fallbacks.
- `src/server/commands/settings/validation.ts:113` and `src/server/commands/settings/quote-terms.ts:9` -- company name is the existing required identity fact; terms edits deliberately reset approval and only the explicit approval command sets `approved_at`.
- `src/features/admin-users/read-model.ts:35`, `src/server/commands/admin-users/invite.ts:15`, and `src/app/(app)/admin/users/page.tsx:1` -- current tenant-scoped membership/role facts and the existing invitation destination; no new invitation mechanism.
- `supabase/migrations/20260625122433_tenant_foundation.sql:66` and `supabase/migrations/20260919090000_tenant_provisioning.sql:93` -- `tenant_memberships` is the durable per-user/tenant record, while `ready` is the first-Admin provisioning gate; add only the narrowly protected dismissal column required by the architecture.
- `supabase/migrations/20260630130000_company_settings_and_quote_terms.sql:86` and `supabase/migrations/20260630140000_work_roles_and_articles.sql:92` -- authoritative existing settings/defaults, explicit terms sign-off representation, and active-role lifecycle; no settings schema expansion.
- `src/scope/manifest.ts:214` and `_bmad-output/implementation-artifacts/epic-12-context.md` -- provisioning is already active/platform-scoped; Story 12.3 introduces neither a module activation nor a tenant table.
- `_bmad-output/test-artifacts/test-design-epic-12.md:195` and `docs/process/review-order.md` -- required predicate, isolation, dismissal, end-to-end, static-scope, and author-owned final review-trail evidence.

## Tasks & Acceptance

**Execution:**
- `supabase/migrations/*_first_admin_onboarding_dismissal.sql` and `tests/integration/rls/tenant-table-inventory.ts` -- add only the nullable per-membership dismissal field and the least-privilege self-only authenticated update path, preserving active-membership, user, tenant, role/status, and cross-tenant protections; update the manifest-derived H4/RLS inventory only if the touched-table metadata requires it.
- `src/server/read-models/onboarding-checklist.ts` and `src/features/onboarding/checklist-state.ts` -- implement one server-authorized, fixed-shape checklist projection and pure five-predicate evaluator with stable IDs/Swedish labels/hrefs, aggregate working state, explicit legal-warning presentation, and no persisted completion state.
- `src/features/onboarding/actions.ts`, `src/features/onboarding/action-state.ts`, and `src/app/(app)/dashboard/page.tsx` -- expose only current-membership dismiss/restore server actions and render the pinned, accessible dashboard card/reminder from fresh server state; revalidate only after confirmed persistence and retain explicit failure/retry feedback.
- `src/components/onboarding/OnboardingChecklist.tsx` and `src/components/onboarding/OnboardingReminder.tsx` -- present semantic item state, warning, progress, dismissal, restoration, and existing deep links without local completion authority or inaccessible controls for non-admins.
- `tests/unit/onboarding/checklist-state.test.ts` and `tests/unit/onboarding/onboarding-actions.test.ts` -- cover each red/green predicate boundary, all-five aggregate, fixed outward DTO, warning separation, foreign/pending exclusion, and dismissal-as-presentation-only behavior.
- `tests/integration/read-models/onboarding-checklist.int.test.ts`, `tests/integration/commands/onboarding-checklist.int.test.ts`, and `tests/integration/rls/*onboarding*.test.ts` -- prove two-tenant isolation, self-only per-membership updates, two-Admin independent dismissal, no role/status/item mutation, and RLS denial for anonymous, non-admin, foreign, inactive, or forged contexts with `SUPABASE_TEST_REQUIRED=1`.
- `tests/e2e/onboarding/first-admin-checklist.e2e.spec.ts` and `scripts/verify/check-first-admin-onboarding-scope.mjs` -- prove the provisioned-first-Admin working-state path, reload/reminder/deep links/no-click-forging, existing-tenant preservation, and absence of signup, onboarding table, new settings schema, or deferred surface.
- `_bmad-output/implementation-artifacts/spec-12-3-first-admin-onboarding-checklist.md` -- after implementation and evidence, author the single `## Suggested Review Order` using verified final-file stops, AC-to-test evidence, and limitations; validate it with `node scripts/verify/check-review-order.mjs`.

**Acceptance Criteria:**
- Given a fresh tenant whose first Admin has completed the existing ready predicate, when that active tenant Admin loads the dashboard, then the ordered Swedish `Kom igång` card is pinned until every server-derived item is green and every item reaches its real existing settings/user surface.
- Given persisted provisioned company/VAT data, nonblank terms, active work roles, and a role-bearing additional invitation are changed independently, when the checklist is read, then only the corresponding fixed predicate changes; defaults count as configured, a NULL terms approval remains a visible warning rather than an automatic approval, and no browser click can forge green state.
- Given all five predicates are green, when the aggregate is evaluated and the first Admin reloads, then it reports the B1a working state from fresh server data and the recorded automated or scripted provisioning-to-working-state proof leaves the existing tenant unchanged.
- Given an incomplete card is dismissed by one active tenant Admin, when either Admin reloads or the reminder is used, then the first Admin's presentation state persists independently, restore reveals current derived completion, and neither dismissal nor restore changes any tenant, membership role/status, invitation, or item fact.
- Given another tenant, a non-admin, anonymous visitor, non-ready tenant, or malformed/foreign row, when it reaches an onboarding read or action, then it sees no checklist state or existence signal and cannot make any mutation or contribution to completion.
- Given static scope validation, when shipped routes, schema, imports, and copy are scanned, then no public registration/signup surface, onboarding table, new settings schema, service-role/client path, operator surface, arbitrary user-count rule, or Phase-C capability exists.

## Design Notes

The checklist records only a user's choice to hide an incomplete guide. Completion remains a pure projection of existing tenant records, so a change made in another browser or by another Admin appears after the next server read. The invitation predicate intentionally requires one additional role-bearing membership but no numeric team-size target: it implements the story's `Bjud in användare` action without elevating the illustrative five-user Journey B5 into a product rule.

`approved_at` is not an onboarding switch. A nonblank terms record makes its configuration item complete, while the established sign-off warning remains truthful and continues to be enforced by the existing quote-terms command path.

## Verification

**Commands:**
- `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/onboarding/checklist-state.test.ts tests/unit/onboarding/onboarding-actions.test.ts` -- expected: all predicate, aggregate, warning, and presentation-only cases pass.
- `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/read-models/onboarding-checklist.int.test.ts tests/integration/rls/onboarding-checklist.rls.test.ts` -- expected: tenant/RLS and independent-dismissal cases execute with zero skips.
- `pnpm run test:e2e -- tests/e2e/onboarding/first-admin-checklist.e2e.spec.ts` -- expected: configured production web server proves the persisted first-Admin flow, reload/reminder, deep links, and no click-forged completion.
- `node scripts/verify/check-first-admin-onboarding-scope.mjs` -- expected: no forbidden signup, schema, table, or deferred-surface token is introduced.
- `node scripts/verify/check-review-order.mjs "_bmad-output/implementation-artifacts/spec-12-3-first-admin-onboarding-checklist.md"` -- expected after implementation: one valid author-written review trail with verified stops.

**Trace-gate remediation evidence:** Applied verification tree `3a781267f407251f83283b6503acdca70eebc0e7` executed the two new required-DB integration tests with `SUPABASE_TEST_REQUIRED=1`: 2/2 passed, 0 failed, 0 skipped. The repaired manifest suite executed 8/8 tests with 0 failed and 0 skipped. `pnpm run typecheck`, focused ESLint over the changed factory/tests, and `git diff --check` all passed in that tree. The independent trace rerun remains pending; this evidence does not claim a post-remediation gate verdict.

## Auto Run Result

Status: done
Blocking condition: null
Summary: The follow-up review added evidence for fail-closed non-ready reads, self-only attributable dismissal/restore, action input and retry states, and the completed-dashboard hide branch.
Files: `src/features/onboarding/action-state.ts` and `actions.ts` expose and consume tested input/error authority; focused unit, RLS/read-model, and production-browser tests prove the repaired boundaries; this spec records the final review trail.
Review findings: 4 medium patches, 0 deferred, 11 rejected after downstream schema/policy and reachability checks. The configured diverse Luna command ran once, stayed live until exit, and failed with exit code 1 (`The system cannot find the file specified.`) without an artifact.
Follow-up review recommendation: true — patched counts high 0, medium 4, low 0; score 12.
Verification: focused units 8/8 passed; required `SUPABASE_TEST_REQUIRED=1` RLS/read-model integration 10/10 passed with 0 skips; scope check passed; targeted ESLint passed; clean-checkout production build passed; exact-build HTML chunk validation 14/0 missing; production onboarding E2E 1/0/0 passed on port 33122.
Review: review findings fixed the cross-tenant fact-query boundary, ready-state direct-write policy gate, malformed dismissal input, and persisted RLS/read-model/browser evidence gaps. Unsupported/noise claims were rejected. The configured Luna review command was attempted once but produced no verifiable output artifact, so `followup_review_recommended` remains true.
Residual risks: the diverse Luna layer is unverified because its configured command produced no output artifact. The main worktree-wide TypeScript command remains noisy from pre-existing ignored `tmp/**` worktrees; the clean production build completed TypeScript successfully.

## Suggested Review Order

Author: implementation author (follow-up review-fix delegate).
Refreshed against applied verification tree `3a781267f407251f83283b6503acdca70eebc0e7` and the original baseline `90bd4018bad03056a3ac1a9191c3488352809b55`.

### Fresh, server-derived dashboard guidance

The dashboard renders only the server projection and pins the card only while a ready tenant has unfinished facts. The fixed five-item DTO is kept pure so no browser interaction can create a green item.

- `src/app/(app)/dashboard/page.tsx:10` — `showChecklist`: mounts the card only for visible, incomplete, non-dismissed server state.
- `src/server/read-models/onboarding-checklist.ts:24` — `tenant_admin`: fails closed before exposing a projection.
- `src/features/onboarding/checklist-state.ts:53` — `complete`: maps each fixed predicate without a client completion input.

### Self-only dismissal boundary

The sole persisted onboarding fact is a nullable timestamp on the current membership. Column-level privilege plus the RLS policy preserves role, status, and tenant identity while the trigger records attributable presentation changes.

- `supabase/migrations/20260920110000_first_admin_onboarding_dismissal.sql:6` — `grant update`: limits authenticated updates to the dismissal column.
- `supabase/migrations/20260920110000_first_admin_onboarding_dismissal.sql:13` — `user_id`: restricts the update policy to the authenticated active Admin.
- `src/features/onboarding/actions.ts:26` — `onboarding_checklist_dismissed_at`: writes only the server-resolved current membership and revalidates after confirmed persistence.

### Predicate and static-scope evidence

The pure tests exercise fixed labels/links, each independent false boundary, malformed or foreign organization identities, the separate terms warning, and the all-green aggregate. The scope script checks the shipped sources for privileged/public-surface tokens and confirms the migration adds a column rather than an onboarding table.

- `tests/unit/onboarding/checklist-state.test.ts:21` — `each server fact independently`: exercises the five predicate boundaries and non-working aggregate.
- `tests/unit/onboarding/checklist-state.test.ts:58` — `persisted terms`: exercises configuration completion independently of the NULL approval warning.
- `tests/integration/read-models/onboarding-checklist.int.test.ts:179` — `facts from another tenant`: exercises the multi-tenant fact-isolation invariant under the selected tenant context.
- `scripts/verify/check-first-admin-onboarding-scope.mjs:20` — `onboarding_checklist_dismissed_at`: checks the only permitted schema addition.

Earlier evidence: 23/23 focused units, 10/10 required local integration/RLS tests, clean production build, 13/0 served chunks, and 6/0/0 combined browser journeys passed.
Current limits: the configured Luna review exited 1 without an artifact; follow-up review remains recommended.

### Phase 7 completion and boundary evidence

The follow-up fixes make the action’s accepted input and error states explicit, prove the non-ready read gate and attributable audit records, and drive the ready fixture to a complete dashboard state. The clean-checkout production build and browser run validate the same files that shipped.

- `src/features/onboarding/action-state.ts:7` — `parseOnboardingDismissal`: accepts only the two browser values that the server action can persist.
- `tests/integration/read-models/onboarding-checklist.int.test.ts:109` — `non-ready tenant Admin`: proves the projection fails closed before dashboard rendering.
- `tests/integration/rls/onboarding-checklist.rls.test.ts:11` — `onboarding_checklist_dismissed_at`: proves an authenticated dismissal and restore create attributable audit metadata.
- `tests/e2e/onboarding/first-admin-checklist.e2e.spec.ts:45` — `onboarding-complete`: completes the disposable tenant’s final invitation fact and verifies both onboarding affordances disappear.

Evidence: 8/8 focused units, 10/10 required local integration/RLS tests with zero skips, clean production build, 14/0 missing HTML-referenced chunks, and 1/0/0 production onboarding E2E passed. The configured Luna reviewer exited 1 without an artifact; follow-up review remains recommended.

### Trace-gate remediation coverage

The remediation composes the previously separate operator and onboarding proofs without seeding past their claimed transitions. The final QA maintenance extracts the shared operator/onboarding seed without altering its ordering, fixture values, or cleanup owner, and gives every Story 12.3 test a stable level identifier. It also drives the production denial boundaries directly and restores the provisioning manifest invariant to an executed P0 assertion.

- `tests/factories/platform-operators.ts:565` — `createAcceptedProvisionedFirstAdminFixture`: retains the authenticated first Admin only after real operator provisioning and invitation acceptance, with scoped teardown for the provisioned tenant.
- `tests/e2e/seed-epic-12-browser-fixtures.ts:30` — `seedEpic12BrowserFixtures`: owns the ready tenant-B onboarding facts while retaining tenant-A operator handoff state in the original fixture.
- `tests/e2e/global-setup.ts:86` — `seedEpic12BrowserFixtures`: calls the focused seed before the shared fixture is serialized for browser consumers.
- `tests/integration/journeys/first-admin-onboarding-lifecycle.int.test.ts:40` — `12.3-INT-AC3`: captures the existing tenant before provisioning, executes five real configuration/user operations, reloads the production projection, and compares the protected rows afterward.
- `tests/integration/read-models/onboarding-authorization-boundaries.int.test.ts:104` — `12.3-AC5`: exercises real active-non-admin and anonymous clients through read plus dismiss/restore, requiring indistinguishable no-data results and zero mutation.
- `tests/e2e/onboarding/first-admin-checklist.e2e.spec.ts:8` — `12.3-E2E-001`: keeps the browser completion/dismiss/restore scenario traceable to Story 12.3.
- `tests/unit/scope/manifest-invariants.test.ts:139` — `12.1-STATIC-001`: executes the combined active/platform/non-granting invariant for every tenant role.

Earlier trace evidence: `SUPABASE_TEST_REQUIRED=1` executed 2/2 new integration tests with 0 failures and 0 skips; the manifest suite executed 8/8 with 0 failures and 0 skips. Clean-checkout typecheck, focused lint, and diff check passed on `3a781267f407251f83283b6503acdca70eebc0e7`.
Final maintenance evidence on clean checkout `ef1885a53f4aa00b56cde5be08430610cb3094e3`: the full unit suite passed 1,836/0/1, where the existing skip is excluded from coverage; clean typecheck passed; changed-TypeScript lint had 0 errors and 7 existing warnings; required local Story 12.3 DB suites passed 13/0/0; the CI-repair required-DB suite passed 17/0/0; and the shared operator/onboarding browser run passed 6/0/0. The existing production build had 14 HTML-referenced static assets with 0 missing.
Limits: no external email provider or browser server was needed because the missing proof sits at the real authenticated RPC, command, read-model, server-action, and database boundaries. The historical Luna failure remains unverified, and the current Luna review of frozen `fa76fedea678bd0455fce15906eb4c127da5f848` has no result; no post-remediation independent-review PASS is claimed and the existing follow-up recommendation remains unchanged.

## Review Triage Log

### 2026-09-21 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 6: (high 2, medium 4, low 0)
- defer: 0
- dismissed:
  - Unsupported or noise claims: no concrete production-reachable invariant bypass was identified.

Patched the two reachable boundary defects (cross-tenant fact selection and non-ready direct dismissal), malformed dismiss input handling, and the persisted RLS, read-model, and browser evidence gaps. The configured Luna review command was attempted once without a verifiable output artifact; follow-up review remains recommended and this is not a product defect.
### 2026-09-21 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 4: (high 0, medium 4, low 0)
- defer: 0
- reject: 11
- addressed_findings:
  - `[medium]` `[patch]` Added a non-ready tenant read-model assertion that returns no onboarding projection.
  - `[medium]` `[patch]` Added authenticated dismissal/restore audit-event assertions, including actor, target, and dismissal metadata.
  - `[medium]` `[patch]` Made the two accepted action values and distinct input/retry feedback explicit and unit-tested.
  - `[medium]` `[patch]` Completed the disposable ready-tenant invitation fact in production E2E and asserted that both onboarding affordances disappear.
- rejected_findings:
  - Performance, clock-boundary, and completed-dismissal speculation had no demonstrated user-visible invariant bypass.
  - Role and approval-value claims are already constrained by the persisted schema or authorized workflow.
  - Redundant static/RLS test-form proposals and broader coverage requests did not identify an untested reachable Story 12.3 branch after the four patches.
