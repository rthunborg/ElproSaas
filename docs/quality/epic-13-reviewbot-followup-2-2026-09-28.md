# Epic 13 ReviewBot Follow-up 2 — 2026-09-28

Scope: the five supplied ReviewBot findings and direct regressions only. This was a bounded post-completion remediation against source head `a6c48250f21788dd42ef9dbf68bdfbb1fbb1462b`; no broad Epic 13 audit was performed.

## Disposition

1. **Runner continuation** — confirmed. The cron-authenticated route rereads a sorted tenant list while runner cursors held only a numeric offset, so inserts/deletes could repeat or skip tenants. Cursors now carry `nextTenantId`; legacy numeric records remain accepted. A deleted target resumes at the next key and resets its producer index, while carried due IDs, scan-only state, newly due tenant-zero restart, budget checks, and fairness remain covered.
2. **Missing quote-PDF HMAC recovery** — confirmed. The normal catch path needed the same absent HMAC and silently lost recovery evidence. The existing signed authenticated recovery RPC is unchanged. A separate server-only, service-role-only RPC records only the configuration failure after actor membership and quote-tenant checks; direct authenticated calls, cross-tenant actors, and spoofed actors are denied.
3. **Bell false success** — confirmed. Failed mark-one/mark-all followed by a swallowed reload failure left optimistic `readAt` values visible. The bell restores its captured server snapshot when reconciliation fails, retains failure/retry copy, and accepts successful reload as authority.
4. **Job-run/audit split commit** — confirmed. Two PostgREST inserts could leave an operational row without its system audit. The scheduler now calls a single service-role-only transactional RPC. The fresh-schema regression forces the audit insert to fail and asserts no `job_runs` row commits.
5. **UTC lexical notification date filtering** — confirmed. `createdAt >= fromDate` used the UTC day. The filter now compares `stockholmBusinessDate(createdAt)` to the date input, with midnight/DST and invalid/empty-input coverage.

## Verification

- `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/server/jobs/runner.test.ts tests/unit/server/jobs/route.test.ts tests/unit/components/notifications/notification-presentation.test.ts tests/unit/server/email/recovery-attestation.test.ts` — 37 passed, 0 failed, 0 skipped.
- `pnpm typecheck` — passed.
- Changed-file ESLint — passed.
- `node scripts/verify/check-service-role-containment.mjs` — passed.
- Scoped post-fix review for cursor/UI — PASS.
- Scoped security/RLS review found one missing service-role cross-tenant/spoofed-actor negative; it was added before the final checks.

## Required CI evidence

`SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/jobs/job-runs.int.test.ts tests/integration/email/quote-delivery-finalization-failure.int.test.ts` executed locally but cannot prove this migration: 5 tests passed, 3 failed, 0 skipped because the existing local database lacks the new RPCs. `supabase db push --local --include-all` then stopped at an older history inconsistency (`email_outbox_delivery_identity_key` already exists). No service was started, stopped, reset, or repaired. The new integration/RLS checks and Bell fault-injection E2E checks require the fresh migration/browser CI lanes.

## Review order

Start with the runner cursor and atomic persistence migration, then the configuration-only recovery writer and its access boundaries, then the Bell rollback/date selector. The four affected story specs contain refreshed `Suggested Review Order` stops and per-story triage for this pass.
