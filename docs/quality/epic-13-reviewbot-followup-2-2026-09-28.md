# Epic 13 ReviewBot Follow-up 2 — 2026-09-28

Scope: the five supplied ReviewBot findings and direct regressions only. This bounded post-completion remediation started from `a6c48250f21788dd42ef9dbf68bdfbb1fbb1462b`, settled runner source at `8b2093374b73a1b419b51be1068a2263e0e11f2f`, and the fixture-isolation evidence correction at `88eadaf9df5e26f753dfd1a3197f7124cb882208`. No broad Epic 13 audit was repeated.

## Disposition

1. **Runner continuation** — confirmed and fixed. Keyset cursors retain `nextTenantId`; named deletions resume at the next key and reset at producer zero. Follow-up source `04d709b938806d1991264cfd7b976130f3be5f36` added a carried-producer boundary so a newly due producer begins at tenant zero without replaying earlier carried work. Test-only `00ac840f27e5a43d9e48efd7c1ba3916faae5b4b` corrected that proof to use the static production registry across the real 12:55 → 13:00 crossover. Source `8b2093374b73a1b419b51be1068a2263e0e11f2f` records an exhausted numeric boundary when the final target was deleted, preventing a carried producer replay at the last remaining tenant. Due snapshots, scan-only state, legacy numeric compatibility, budgets, and fairness remain covered.
2. **Missing quote-PDF HMAC recovery** — confirmed and fixed. The signed authenticated recovery RPC remains unchanged for genuine attestation failures. Only an absent process HMAC uses the separate server-only, service-role-only configuration writer, which verifies active `Quotes.Send` membership and quote tenancy. The missing-secret success path is covered for tenant administrator, project manager, and salesperson; direct authenticated calls, cross-tenant calls, and spoofed actors remain denied.
3. **Bell false success** — confirmed and fixed. Failed mark-one/mark-all persistence followed by failed reload restores the known server snapshot, retains failure/retry copy, and never presents a false persisted acknowledgement. The later full-CI E2E failure was a shared-fixture state error: the prior finance mark-all test disabled the later action. `88eadaf` switches only that browser scenario to the unmutated project-manager fixture and asserts its enabled unread baseline before faulting the real POST and reconciliation reload. Product Bell source did not change.
4. **Job-run/audit split commit** — confirmed and fixed. The scheduler records each run and its system audit through one service-role-only transactional RPC. The fresh-schema test forces audit failure and asserts no `job_runs` row commits.
5. **UTC lexical notification date filtering** — confirmed and fixed. From-date filtering now compares `stockholmBusinessDate(createdAt)` with midnight/DST and invalid/empty-input coverage. The settled presentation source did not change in the runner convergence.

## Focused verification

- `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/server/jobs/runner.test.ts` — **23 passed, 0 failed, 0 skipped** at final source `8b209337`.
- Earlier focused follow-up command across runner, route, presentation, and recovery-attestation units — **37 passed, 0 failed, 0 skipped**.
- `pnpm typecheck` — passed.
- Changed-file ESLint — passed.
- `node scripts/verify/check-service-role-containment.mjs` — passed.
- Scoped cursor/UI post-fix review — PASS.
- Current full CI `36421169336` at `5a529b4` passed verify (1,923 tests, 0 skips), DB (1,208 tests, 1 explicit loader skip), isolated loader (1 test, 0 skips), and Vercel; E2E had 173 passes, 1 failed fixture-state scenario, and 4 skips.
- `pnpm exec eslint tests/e2e/notifications/notifications.atdd.e2e.spec.ts` — passed after `88eadaf`; `git diff --check` — passed.
- The external Luna CLI exited 1 with no review output. The authorised native Luna/xhigh fallback found the exhausted legacy-boundary replay; `8b209337` fixed it and the final focused runner suite verified the exact regression.

## Required CI evidence and limitation

`SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/jobs/job-runs.int.test.ts tests/integration/email/quote-delivery-finalization-failure.int.test.ts` executed locally: **8 total, 5 passed, 3 failed, 0 skipped**. The failures do not prove the new migrations because the existing local database lacks the new RPCs; `supabase db push --local --include-all` stopped at the older `email_outbox_delivery_identity_key` history inconsistency. No service was started, stopped, reset, or repaired. Fresh-schema migration/RLS verification remains required in full CI. The Bell fault-injection browser case also requires fresh CI after the fixture-isolation correction; its failed prior run is not coverage. The new non-admin missing-HMAC integration case was inspected but not rerun locally for that same reason.

## Completed-pass coverage

This completed bounded pass refreshed **specs 13.1, 13.2, and 13.4**. **Spec 13.3 did not receive this completed pass.** The completed Story 13.1 review order includes the carried boundary, static registry crossover, exhausted legacy target, atomic audit boundary, and 23/23 evidence. Story 13.2 retains settled Bell rollback and Stockholm business-date presentation; its later test-only fixture-isolation correction preserves the mark-all POST plus failed-reload assertion. Story 13.4 includes missing-secret recovery success for tenant administrator, project manager, and salesperson together with its authorization-denial boundaries.

## Review order

Review the authenticated jobs route and atomic persistence boundary, then runner keyset/carry/exhaustion behavior, then configuration-only recovery authorization, and finally the settled Bell/date source. The three affected story specs contain the final author rationale, verified stops, and evidence for this bounded follow-up.
