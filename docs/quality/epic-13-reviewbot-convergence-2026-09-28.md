# Epic 13 ReviewBot Convergence — 2026-09-28

## Scope and revisions

- Reviewed source: `a2d2d9afa5ab8395d85ed91b67259bc5097103bf`.
- ReviewBot source-fix commit: `b8b0241835a0836aa5bcbba047be23512faee723`.
- Final budget/cursor fix commit: `ed43933`.
- Scope: the three supplied ReviewBot findings, the remaining off-schedule cursor-scan budget uncertainty, and direct regressions introduced while repairing that uncertainty. This was not a broad Epic 13 review.

## Original ReviewBot dispositions

1. **Stockholm business date — resolved.** The route uses `stockholmBusinessDate` for the follow-up producer's `YYYY-MM-DD` period. Focused winter, summer, and DST coverage remains green.
2. **Due schedule and continuation authority — resolved.** The runner evaluates the registered five-field UTC cron forms against the captured injected clock and carries the union of current and prior due producer IDs across global deadlines. Partial and failed producer cursors remain resumable off-schedule without starving later tenants.
3. **Cron-secret byte comparison — resolved.** Authentication compares UTF-8 byte-buffer lengths before `timingSafeEqual`; malformed multibyte current and previous bearer candidates return the same generic 401 before privileged side effects.

These dispositions reuse the independent final-line confirmation supplied with the convergence task; they were not reopened as another broad review round.

## Budget disposition

**Confirmed production-reachable bypass, repaired.** An authorized delayed or manual GET/POST request could enter `runDueProducers` at a minute when no registered producer was freshly due. The route's `AbortSignal` was passed to the follow-up producer body, while tenant and producer-cursor discovery used ordinary client queries. In the runner, `loadProducerCursor` and the off-schedule `continue` preceded the deadline check. The internal 45-second containment invariant therefore did not stop a full tenant × producer cursor scan.

The repair checks the cooperative deadline around cursor discovery and serializes interrupted scan position with an explicit `dueProducerIds: []` snapshot. That snapshot is distinct from an older cursor lacking the field, so resuming a scan does not grant legacy tuple execution authority. Repeated bounded invocations advance to later saved partial/failed checkpoints. Non-empty due snapshots continue to preserve scheduled work and tenant fairness. If a new window becomes due while a scan-only cursor exists, the scheduled pass restarts at tenant zero so earlier tenants are not skipped. A completed fresh off-schedule scan with no work still produces no run record.

The narrowed post-fix review caught two intermediate direct regressions: dropping scan position could starve later producer checkpoints, and retaining scan position into a newly due window could skip earlier tenants. Both were repaired before the final narrow review returned PASS.

## Verification

- `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/server/jobs/route-auth.test.ts tests/unit/server/jobs/route.test.ts tests/unit/server/jobs/runner.test.ts` — 30 passed, 0 failed, 0 skipped.
- `pnpm typecheck` — passed.
- Changed-file ESLint for `src/server/jobs/runner.ts`, `tests/unit/server/jobs/runner.test.ts`, and `tests/unit/server/jobs/route.test.ts` — passed.
- `node scripts/verify/check-review-order.mjs "_bmad-output/implementation-artifacts/spec-13-1-authenticated-background-runner-and-producer-registry.md"` — passed with 12 references and 0 errors.
- Database and browser suites — not run; the convergence patch changes pure runner cursor/deadline behavior and unit-test fixtures, with no schema, RLS, or browser surface.

## Final disposition

PASS. The supplied consequential findings and the confirmed budget bypass are resolved, the final narrowed review found no remaining direct regression, and `followup_review_recommended` is `false`. The runner deadline remains a cooperative per-query containment bound and does not establish an owner-approved latency, throughput, freshness, backlog-age, or capacity SLO.
