## Story epic-5
- [E2 â€” test-design] Standing NFR CONCERNS (no pnpm-audit CI gate, no coverage reporter) carried un-actioned since Epic 2 â€” the epic-5 gate should force an explicit schedule-or-accept decision rather than carry them a fourth time.

## Story 5-1-tenant-owned-calculation-schema-and-server-commands
- [Phase 3 â€” create-story] contacts has NO unique(id, tenant_id) (only customers/facilities got one in 3-1); 5-1's migration must additively add contacts_id_tenant_unique before any composite same-tenant FK to contacts â€” any later story adding such a FK hits the same wall.
- [Phase 5 â€” dev-story] Resumed-run trap: ATDD command-int scaffolds were left describe.skip with throwing placeholders while everything else was green â€” check for lingering describe.skip/notYetImplemented before trusting a resumed run ('typecheck + partial green' is not done).
- [Phase 5 â€” dev-story] Env gotcha: right after supabase db reset, Kongâ†’GoTrue 502s for ~10s, flipping isLocalStackReachable() false and silently SKIPPING all DB-backed tests locally (exit 0); poll /auth/v1/health to 200 first. CI (SUPABASE_TEST_REQUIRED=1) fails hard instead.
- [Phase 6 â€” automate] Calc update validators: EMPTY-STRING title/unit = absent (dropped, empty-patch-friendly) but WHITESPACE-ONLY = present-but-blank (rejected) â€” intentional isPresent('')===false convention; 5-2 editor UI/tests must respect it (both branches now pinned).

## Story 5-3-pricing-source-selection-and-row-snapshots
- [Phase 5 â€” dev-story] Order-asserting E2E specs on the shared serial calc fixture must not assume a fixed section count (5.2-E2E-06 broke when a sibling spec added a section; fixed to loop move-up-to-front) â€” keep future order assertions fixture-count-robust.
- [Phase 5 â€” dev-story] Raw pg pool returns bigint ore columns as strings and timestamptz as Date objects â€” INT readbacks must coerce (Number(...) / ISO string) or .toBe fails on representation despite byte-correct storage.
- [Phase 6 â€” automate] Pure helpers embedded in a 'use client' .tsx escape the node:test fast gate (can't import JSX) â€” extract them to a sibling .ts module at DEV time (the source-options.ts split is the standing pattern).

## Story 5-4-calculation-readiness-review-and-snapshot-preview
- [Phase 3 â€” create-story] Owner decision 'margin warning = TB% vs global threshold in settings' has NO backing DB column â€” 5-4 ships a constant-threshold default; the configurable settings column is a gated migration needing one-line owner confirmation at the epic session.
- [Phase 3 â€” create-story] Story 8.1 not landed â†’ 5-4's required-file readiness check is a sanctioned documented deferral (R-513), expected under the approved Epic-5-before-Epic-8 sequencing, not a gap.
- [Phase 5 â€” dev-story] E2E 'missing customer' blocker unseedable (customer_id FK-NOT-NULL) â€” proved the blocker gate via an ore-overflow TOTAL_UNCOMPUTABLE row + a separate healthy calc instead of in-test mutation.
- [Phase 5 â€” dev-story] ROT/gron readiness path unit-pinned but fed hasDeductionAssumption:false â€” no calc schema field carries a deduction assumption until Epic 6; documented forward-seam, not dead code.
