# Story 10.8: Quote Review Provenance, Authority, and Audit

Status: review

## Story

As an authenticated tenant business user, I want a bounded attestation to exact server-validated quote content, so that quote creation, successor creation, and send have accountable authority without claiming that a UI proves attention.

## Scope

**IN:** ADR-B008 Option A; one-time 15-minute non-HMAC review authorization; source/attachment/customer-visible-change invalidation; initial/successor/final-send authority; atomic successful-mutation actor/correlation audit; and removal of direct DML/bypass and the obsolete digest overload. Until Epic 11, `tenant_admin` is the authority.

**SEAM:** Epic 11 maps `Quotes.Create`, `Quotes.Approve`, and `Quotes.Send`; one actor may hold all. This is final supporting infrastructure, not an Epic 11 implementation. Story 10.9/shared ADR-B008 owns the separate server-side HMAC PDF-byte attestation prerequisite/consumer; it is not 10.8 review authority.
**DEFERRED:** second-person approval and UI-attention inference.

## Acceptance Criteria

> **No Design Gate Criteria for this story.** This is a backend/security boundary story; the canonical Epic 10 criteria contain no design gate, intentionally.

### AC1 — Authenticated, content-bound attestation
**Given** a user performs initial creation, successor creation, final review, or send
**When** review authority is required
**Then** the server validates the exact content and records the authenticated actor's explicit attestation
**And** the system neither treats a browser interaction as proof of attention nor requires a second reviewer.

### AC2 — One-time authority with change invalidation
**Given** a review authorization was issued
**When** it is reused, older than 15 minutes, or source/attachment/customer-visible content changes
**Then** it is rejected and a fresh review is required.

### AC3 — Server boundary and atomic audit
**Given** a quote lifecycle mutation succeeds
**When** the mutation commits
**Then** actor and correlation audit evidence commits atomically with it
**And** authenticated direct DML/bypass and the obsolete digest overload cannot substitute for this authority.

## Dependencies

Stories 10.1–10.6.

## Tasks / Subtasks

Checked tasks indicate the implementation is present. Round 3/final automatic convergence and hosted verify/database/Playwright CI are complete; status remains `review` only for post-merge remote-demo provisioning.

- [x] Task 1 — Authorize and persist one-time review authority (AC1, AC2).
  - [x] Enforce authenticated actor identity and exact server-validated content binding.
  - [x] Enforce expiry, single use, and every specified invalidation input.
- [x] Task 2 — Enforce lifecycle authority and atomic audit (AC3).
  - [x] Remove/revoke direct authenticated DML/bypass and obsolete digest-overload paths.
  - [x] Make successful lifecycle mutation plus actor/correlation audit atomic through narrow hardened `SECURITY DEFINER` boundaries.
- [x] Task 3 — Add authority and atomicity negatives (AC1–AC3).
  - [x] Cover expiry, reuse, altered content, cross-tenant, unauthorized actor, direct-DML denial, and audit rollback.
- [x] Task 4 — Document the Epic 11 permission replacement seam (final supporting infrastructure, not a direct AC: preserves the approved `Quotes.*` transition without implementing Epic 11).

## Files

### Files Created

- `supabase/migrations/20260831124310_story_10_8_quote_review_authorization.sql`
- `tests/integration/commands/quote-review-authorization.int.test.ts`
- `tests/integration/commands/quote-audit-rollback.int.test.ts`
- `tests/integration/rls/quote-review-authorization-migration-reset.int.test.ts`
- `tests/unit/server/commands/quote-review-authorization-result.test.ts`

### Files Modified

- `src/server/commands/quotes/quote-db.ts`
- `src/server/commands/quotes/validation.ts`
- `src/server/commands/quotes/accept.ts`
- `src/server/commands/quotes/accept-and-create-job.ts`
- `src/server/commands/quotes/lifecycle.ts`
- `src/server/commands/quotes/lost.ts`
- `src/server/commands/quotes/mark-sent.ts`
- `src/server/commands/quotes/new-version.ts`
- `src/server/commands/quotes/quotes.ts`
- `src/server/commands/quotes/review-token.ts`
- `src/server/commands/quotes/snapshot-build.ts`
- `src/server/commands/quotes/update-draft.ts`
- `src/scope/manifest.ts` — quote-review authorization inventory declaration.
- `tests/integration/rls/tenant-table-inventory.ts` — H4 inventory derivation/coverage.
- `tests/integration/commands/record-audit-event-search-path.int.test.ts` — forged-actor attribution negative.
- `scripts/verify/check-local-supabase-reset.mjs` — bounded reset recovery now requires the complete local audit table/function/trigger fixture.
- `tests/unit/scripts/verify/local-supabase-reset.test.ts` and `tests/integration/rls/migration-reset.int.test.ts` — partial-seed rejection plus exact post-reset catalog proof.
- `supabase/seed.sql` and `tests/factories/tenants.ts` — reset/fixture support for `quote_review_authorizations`.
- Existing quote creation and compatibility seams necessary to remove the obsolete overload.

### Files Not Created

- No client service-role helper, public route, nav item, or new scope module. Story 10.8 does not own the HMAC helper or attestation tests: those are Story 10.9/shared ADR-B008 PDF-byte activation work, not review authority.

## References

- `AGENTS.md`
- `_bmad-output/project-context.md`
- `_bmad-output/planning-artifacts/epics-phase-b.md` — canonical Story 10.8 acceptance criteria
- `_bmad-output/planning-artifacts/architecture-phase-b.md` — ADR-B008 entry
- `_bmad-output/planning-artifacts/ux-design-specification-phase-b.md` — ADR-B008 quote correction delta
- `docs/decisions/ADR-B008-quote-review-authority-and-derived-artifact-validity.md`
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-31-story-10-6-followups.md`

## Test Gate

Verification status: current local and hosted-CI evidence is recorded below. Round 3/final automatic convergence is complete; the story remains `review`, not done, because post-merge remote-demo provisioning is explicitly unclaimed.

### Required full project gates

1. `pnpm audit --audit-level=high`.
2. Lockfile guard and service-role source containment.
3. Full TypeScript, full ESLint, and full `pnpm test:unit`.
4. Production build.
5. Service-role bundle containment and HMAC secret/bundle containment.
6. Empty-DB `supabase db reset`, local DB lint, and focused integration/RLS contracts.
7. Browser E2E/Playwright.

### Evidence actually run

- **Dependency audit:** passed — the project-scoped pnpm override schema moved from its obsolete `package.json` placement to `pnpm-workspace.yaml`; the lockfile resolves `brace-expansion` 5.0.9, `js-yaml` 4.3.1, and `nanoid` 3.3.18; `pnpm audit --audit-level=high` exits 0 with `No known vulnerabilities found`. Frozen lockfile-only regeneration and the bundled-Node lockfile guard passed. Existing `node_modules` was deliberately not broadly reinstalled, so focused `pnpm why` still observes its stale pre-lockfile graph; CI's frozen install will materialize the patched graph.
- Lockfile guard and service-role source containment passed. Full TypeScript passed. Changed-file ESLint and full ESLint passed: the bundled Node ran `node_modules/eslint/bin/eslint.js .` and exited 0 with no findings after `eslint.config.mjs` explicitly ignored non-product `.agents/**` skill resources and generated `supabase/.temp/**`; application, tests, scripts, and real Supabase sources remain in scope. After the human-triaged PR fixes, the full unit suite passed 94 suites / 1,678 tests.
- Next build, service-role bundle containment, and HMAC secret/bundle containment passed.
- Empty-DB local `supabase db reset` completed successfully twice; local DB lint and tenant-table inventory (27) passed. Focused migration/authority/PDF/audit contracts passed 48/48, the parallel-safe rollback contract passed 7/7, the complete changed integration surface passed 28 unique files / 388 tests, and the post-PR-fix required full integration/RLS suite passed 85 files / 906 tests. The bounded recovery verifier also passed against the borrowed local stack while requiring the exact audit table, function, and enabled trigger. **Additional supporting verification, not the canonical CI migration-ledger contract:** both 10.8/10.9 migrations are replay-safe and passed real replay against an already-migrated local database; the canonical migration proof remains empty-DB `supabase db reset`.
- **Round-3 delta:** a fresh local reset applied the complete migration/seed chain; both 10.8 and 10.9 real replays passed; DB lint was clean; the four focused migration/authority/PDF/audit files passed 48/48; and the production mark-sent plus forced-audit-rollback files initially passed 24/24. A later parallel run exposed and fixed a test-only trigger-DDL deadlock: seed now installs one local-only, unexposed, correlation-scoped audit-failure trigger/control table, while cases use DML only. After a fresh reset, the rollback file passed 7/7 and all 28 changed integration files passed 388/388. Final TypeScript, full ESLint, Next build, full unit (94 suites / 1,673 tests), DB lint, lock/source/bundle/HMAC containment, and diff hygiene passed.
- Hosted GitHub Actions run [33495807115](https://github.com/rthunborg/ElproSaas/actions/runs/33495807115) passed verify, database, and Playwright: 121 passed and 1 skipped, with the Playwright report uploaded. Local Playwright was deliberately **NOT RUN** inside Codex because it would require a persistent app server.
- **Human-triaged post-Round-3 PR fix (not a fourth automatic review):** reset recovery no longer accepts the control table alone; it requires the exact SECURITY DEFINER trigger function and enabled `BEFORE INSERT FOR EACH ROW` trigger bound to `public.audit_events`. Pure partial-evidence negatives and a real post-reset catalog assertion are green.

`git diff --check` passed. The prohibited Auto-BMAD self-test and broad wrappers were not run. Remote demo Vault/Vercel secret provisioning is not attested, and demo migrations flow only after merge; no pre-merge demo mutation was attempted.

### Review Findings

**Round 1 of 3**

- Fixed the missing atomic-audit failure proof by adding forced-audit rollback coverage across initial/successor creation, send, lifecycle/lost, acceptance/job, and the PDF lifecycle.
- Reconciled `quote_review_authorizations` across the manifest, H4 derivation, architecture, epics, and project context; current tenant-table inventory is 27.

**Round 2 of 3**

- Fixed the remaining compatibility bypass: `captureQuoteAcceptance` now uses the authoritative atomic accept-and-create-job RPC, authenticated direct acceptance DML is revoked, and an own-tenant direct INSERT is expected to fail with `42501`.
- Added a paired-job assertion for the compatibility result and retained exactly one atomic audit row.
- Story 10.9/shared ADR-B008 owns the required server-side HMAC-SHA256 PDF-byte attestation, verified by PostgreSQL/`pgcrypto` against Vault. It is distinct from non-HMAC review authorization, binds the ADR-B008 fields and expiry window, is never returned/logged/persisted, and fails closed.
- Required recovery proof: correlation-idempotent start uses a five-minute lease; a completion response lost after commit reconciles rather than archives the current generated PDF.
- The pre-Round-3 migration/RLS, grant-boundary, and attestation-failure evidence is recorded in the Test Gate above; final convergence is resolved by Round 3 below.

**Round 3 of 3 — final automatic review**

- Fixed accountable audit attribution at the shared boundary: `record_audit_event` now requires `auth.uid()` to equal the persisted actor, retains the active-tenant membership check, and is no longer executable by `service_role`. A focused forged-actor negative was added.
- Preserved the cross-story separation: Story 10.8 final-send review authority remains a one-time, 15-minute, non-HMAC record. Story 10.9's server-only PDF-byte HMAC is a separate prerequisite consumed in the same atomic send transaction.
- Fixed the CI-parallel rollback harness without changing production behavior: the shared `audit_events` table is no longer repeatedly schema-locked by per-case trigger DDL. The local seed installs one inaccessible correlation-scoped trigger, and tests activate it through isolated control-table DML.
- Final evidence is green: fresh reset, both real migration replays, focused DB/grant/behavior coverage (48/48), rollback 7/7, all 28 changed integration files 388/388, full integration/RLS 85 files/905 tests, TypeScript, full ESLint, Next build, full unit (94 suites / 1,673 tests), DB lint, lock/source/bundle/HMAC containment, diff hygiene, and hosted Playwright (121 passed, 1 skipped). Final automatic convergence is verified; no fourth automatic review is permitted, so any later concern requires human triage.

**Human-triaged post-Round-3 PR comments — not an automatic review round**

- Accepted and fixed the reset-recovery false-green: complete table/function/trigger evidence is mandatory, with 906/906 full integration/RLS tests and the current 1,678/1,678 unit tests green locally.
