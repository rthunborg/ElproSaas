# Epic 12 — owner-approved follow-up

Owner decision: on 2026-09-21, the owner accepted all five recommended options for PR #72.

- Complete the missing independent cross-model review evidence. Preserve the historical external-CLI failures; assess one stable final snapshot and record the actual reviewer and delivery mechanism.
- Extract the Epic 12 browser seed from the shared setup and add stable Story 12.3 test IDs. Keep behavior unchanged and verify the affected tests.
- Require deployed security evidence before enabling real production provisioning; keep that release checkpoint separate from merge readiness.
- Assign operator-surface perimeter policy and evidence to the shared platform/security programme.
- Run the documented local pilot performance baseline before proposing numeric targets for owner approval.

Merge and production enablement are not authorized by this follow-up.

## Starting evidence

- PR: https://github.com/rthunborg/ElproSaas/pull/72 (draft).
- Starting commit: `183cfe56448aaaba4ae6a9a4108537e7582bd3ba`.
- Acceptance trace: PASS, 24/24 criteria (21 P0, 3 P1).
- Two completed broad review passes per story; independent external review evidence remains incomplete. The final automatic independent pass will cover the stable Epic 12 change. Later review is limited to findings and fix regressions.
- CI run `35623162582`: verification, browser tests and Vercel passed; database and recovery-storage-loader failed. The failures require diagnosis before readiness changes.
- The three sprint stories remain `review`; the prior retrospective is rejected with five open actions.

## Approved follow-up checkpoint

Implementation and audit work was delegated to separate Terra/high authors.

- QA: shared browser setup reduced to 959 lines through an Epic 12 seed helper; 22 Story 12.3 test titles now have stable identifiers. Unit suite: 1,836 passed, 0 failed, 1 pre-existing skip excluded from coverage. Focused lint: 0 errors, 2 pre-existing warnings.
- CI repairs: updated the exact policy inventory, derived active tenant-table expectations from the scope manifest, and added the hardened provisioning function owner to isolated recovery bootstrap. Targeted required local-DB verification: 17 passed, 0 failed, 0 skipped. Focused lint and static owner/grant invariant passed. Full recovery restore awaits fresh CI.
- Release security: [production-readiness procedure](../../../docs/security/tenant-provisioning-production-readiness.md) defines hosted evidence and explicit approval required before real production provisioning. Shared platform/security owns perimeter evidence. Deployed configuration is not yet verified by these artifacts.
- Performance: [local baseline](../../test-artifacts/epic-12-performance-baseline.md) executed 12 samples per RPC path. Provisioning P90: 16.65 ms; console list P90: 16.84 ms; console detail P90: 16.60 ms. List dataset: 456 observed rows (12 synthetic, 444 pre-existing). Each measured operation made one observed RPC; database-internal SQL query count was unobserved. Scoped cleanup was verified. Measurements exclude browser, hosted network and auth-provider work.
- NFR amendment retains advisory CONCERNS / MEDIUM. Recommendation: keep the local baseline non-gating and obtain representative hosted pilot evidence before an owner sets numeric production targets.

## Verification and remaining review

Clean-checkout verification passed against snapshot `ef1885a53f4aa00b56cde5be08430610cb3094e3`: typecheck; lint across 50 changed TypeScript files (0 errors, 7 pre-existing warnings); five required Story 12.3 database suites (13 passed, 0 failed, 0 skipped); 14 static asset references (0 missing); and operator-console/onboarding browser tests (6 passed, 0 failed, 0 skipped). The managed production server was released after verification; its stop request was accepted.

An independent focused test-quality audit closed both QA advisories, preserving the historical 96/A audit without inventing a rescore. The author refreshed each story's single Suggested Review Order; all three passed reference checks and canonical parsing.

The final independent Luna/xhigh review covers the complete stable Epic 12 diff at `fa76fedea678bd0455fce15906eb4c127da5f848`, delivered through an in-app subagent to recover the missing external-CLI evidence. Historical failures remain recorded. After this final automatic broad pass, review is limited to findings and fix regressions.

[CI run 35626408299](https://github.com/rthunborg/ElproSaas/actions/runs/35626408299) passed verification and the isolated recovery job. The full database suite reported 1,075 passes, one failure and one skip: fault-injection fixture DDL deadlocked under concurrent test execution. The browser suite reported 143 passes, one failure and four skips: the preview-success assertion failed. A demonstrable random organisation-number validation problem was found; the precise CI input/alert was not logged, so that rejection branch remains inferred.

Two bounded test repairs followed. The database fixture now runs temporary trigger DDL and the authenticated production RPC in one rolled-back transaction, locking mutable relations in write order and rethrowing unexpected failures. The browser fixture preserves its six-digit random candidate space and Luhn checksum while validating candidates through the production organisation-number validator. No production code or migration changed. The local database became unavailable, so no new local runtime pass is claimed for these repairs; fresh isolated CI must supply that evidence.

Clean snapshot `e59914f8b60e983a273a1ee23cd93c8a7245d203` passed typecheck and focused lint for the two repaired files. Playwright resolved the new validator import, then stopped at the absent generated auth fixture before test discovery; this is not a browser-test pass. The author refreshed and checked affected review-order references.

[CI run 35628727745](https://github.com/rthunborg/ElproSaas/actions/runs/35628727745), at `3a985fef5b11d47916cf0299cc5d397d85ef088e`, passed verification, all browser checks, and recovery. Database results were 1,075 passed, one failed, one skipped: the revised fault helper needed an explicit text cast in a polymorphic SQL argument. The author applied that narrowly scoped correction; runtime evidence for the corrected helper remains pending.

## Independent review and focused remediation

The [independent review](../../test-artifacts/reviews/epic-12-independent-review-2026-09-21.md) completed over all three stories: two P1 production findings and two P2 fixture findings. The original broad report and historical failed CLI attempts remain intact. A focused review of `fa76fed..3a985fe` found no regression in the first two fixture repairs.

- Concurrent same-request/different-content handling: author confirmed that the unique-violation handler lacked request/hash precedence. An append-only migration and deterministic concurrency regression are being prepared.
- Organisation-number validation: author confirmed false rejection of valid legal-entity identifiers. The original claim of accepting ordinary YYMMDD personal identities was overstated; the existing unprefixed alternative already rejected them. The repair follows the authoritative structural organisation-number rule and will retain personal-identity rejection coverage.
- Browser fixture input: repaired at `3a985fe`, retaining the candidate space and validating generated identifiers; browser CI passed.
- Synthetic cleanup: orphan provisioning requests were confirmed. The fix removes only the target tenant's protocol records and preserves established replica cleanup for complex financial fixture graphs. An isolated regression also checks that unrelated tenant/request data survives.

These are focused findings/fix reviews after the third broad pass; no fourth broad pass is being opened. Sprint/retrospective readiness and PR draft status will be refreshed only after accepted closure and CI evidence. No production deployment or database reset is included.

## Production-fix checkpoint

The author completed the organisation-number structural repair and append-only request/hash race repair. A real concurrency regression reproduced the old incorrect ALREADY_PROVISIONED response on the pre-migration loopback database; no migration/reset was applied to that shared database. Green runtime evidence will come from isolated CI applying the new migration.

Clean source snapshot `acf6625fc1a0073aba8396ed05cf57d584f7eaef` passed typecheck, focused lint across seven changed TypeScript files (0 errors/warnings), and the full unit suite (1,837 passed, 0 failed, 1 existing skip excluded from coverage). Independent focused review already closed the cleanup finding and SQL cast correction at tree `bf017460d4b8049d2c57925721cf47a121062726`, with zero regressions. The final focused production review is in progress against the stable source snapshot.

## Accepted review and CI closure

This closure supersedes the pending statuses in the historical checkpoints above. Final source commit: `6edbd2d9021310b202ab0e4fc828522d4bcf20b5`. Its eight production-fix, migration and test paths match the independently reviewed frozen tree `acf6625fc1a0073aba8396ed05cf57d584f7eaef`.

The independent in-app Luna/xhigh review and its focused follow-ups closed all four findings (two P1, two P2). The final focused production review reported zero new findings and zero regressions. Historical failed external-CLI attempts remain recorded; they are not represented as completed reviews.

[Final source CI](https://github.com/rthunborg/ElproSaas/actions/runs/35631411549) passed verification, database, browser and recovery jobs:

| Suite | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Unit | 1,838 | 0 | 0 |
| Required database | 1,078 | 0 | 1 |
| Browser | 144 | 0 | 4 |
| Separate recovery-storage loader | 1 | 0 | 0 |

Skipped cases are excluded from coverage. The database skip concerns recovery-storage immutability, exercised separately by the recovery job. The new deterministic request/hash concurrency regression and scoped fixture-cleanup regression both executed and passed. Browser runtime was 171.65 seconds against the 300-second limit.

All three canonical spec parses are `done`, with `followup_review_recommended: false`, no blocking condition and no deferred entries. Each author refreshed the single Suggested Review Order: 25, 17 and 21 validated references respectively, with zero errors. Existing oversized-spec warnings remain recorded.

The canonical finalize predicate reports clean completion, no draft clauses, PASS acceptance trace (24/24), and passing CI. Root advanced all three sprint stories and Epic 12 to `done`, closed the independent-review action, and retained the two already-completed QA actions. Two Epic 12 action items remain: production security evidence is open, and the performance action is in progress pending representative hosted pilot measurements and an owner decision on numeric targets. NFR assessment remains advisory CONCERNS / MEDIUM.

Merge and production enablement remain separate decisions. The final metadata-only commit may trigger another CI run; the passing source evidence above is explicitly pinned to `6edbd2d`.

The refreshed [retrospective](../../implementation-artifacts/epic-12-retro-2026-09-21.md) is `accepted-with-open-items` (headless, two open action items). Canonical detection found all three stories done with no pending stories; canonical verdict parsing returned no warnings or errors. The prior rejected verdict and its lifecycle reason remain in the historical record. All five approved follow-up recommendations have been carried out within their stated scope.
