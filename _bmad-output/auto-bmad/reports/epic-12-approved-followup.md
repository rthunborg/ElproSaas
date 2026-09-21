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

## Remaining verification

Clean-checkout verification is running against snapshot `ef1885a53f4aa00b56cde5be08430610cb3094e3`. The final independent Luna/xhigh review will cover the complete stable Epic 12 diff, delivered through an in-app subagent to recover the missing external-CLI evidence. Historical failures remain recorded. After this final automatic broad pass, review is limited to findings and fix regressions.

Sprint/retrospective readiness and PR draft status will be refreshed only after accepted review and CI evidence. No production deployment or database reset is included.
