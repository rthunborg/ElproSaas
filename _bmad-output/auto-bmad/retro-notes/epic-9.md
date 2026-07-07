## Story epic-9
- [E2 â€” epic test design] Golden `origin` discipline goes live this epic: all current goldens are origin:"new-expected"; 9.2/9.3 introduce first real documented-delta/old-lovable cases and must widen the numeric-only LABELLING guard to number|classification-code.
- [E2 â€” epic test design] Harness representativeness traps flagged as P0 controls (R-903/R-904): fictional ReadinessCode values pinned in fixtures + substring-token coverage manifests can green-pass a naive 9.3 harness â€” validate enums against the real union; ban vacuous-green/stale RED-PHASE banners/out-of-glob pins.

## Story 9-1-legacy-record-classification-and-migration-runbook
- [Phase 3 â€” create-story] Sign-off items 8.1/8.2 Ã¶ppen (mÃ¶te): 9.1 delivers the classification STRUCTURE with a deliberate STOP marker; real-record classification still needs the owner working session before real-pilot cutover (feeds 9.4/9.5).
- [Phase 3 â€” create-story] ReadinessCode representativeness trap corrected in-flight: project-context/test-design present 3 codes as the real set but the exported union has ~12 members â€” verify against readiness.ts, never treat the 3 as complete.
- [Phase 7 â€” Tier A review] dev-story output left stray tool-call artifact lines (</content>, </invoke>) in docs/migration/** â€” triage stripped them; doc-heavy stories (9-4, 9-5) should watch for write-tool artifacts.

## Story 9-2-anonymized-lovable-fixture-capture
- [Phase 3 â€” create-story] Existing golden fixture quote-version-source.json carries fictional ReadinessCode values REQUIRES_SIGN_OFF/DEDUCTION_ESTIMATE_UNAPPROVED (lines 48, 94); 9.2 bars propagating them into lovable/** and DEFERS aligning the existing fixture to story 9.3 (9.3-VALID-01) â€” flag if 9.3 doesn't pick that alignment up.
- [Phase 4 â€” ATDD] Node --experimental-strip-types prematurely closes block comments on any */ sequence (hit via a literal **/*.json glob in a doc comment) â€” avoid /*-containing globs inside block comments in tests/unit/** TS files.
- [Phase 4 â€” ATDD] .claude/hooks/guard.ps1 blocks rm -rf/-f even for scratchpad paths â€” temp probe files can't be deleted via bash; harmless but plan cleanup accordingly.
- [Phase 4 â€” ATDD] Red scaffolds are describe.skip surface-probe gated (Epic-4 precedent) â€” dev must land them genuinely running (probe satisfied), and the Tier-A auditor should verify no self-disabling gate remains (ledger non-regression: TAX/VAT_SURFACE_PRESENT describe.skip weakness).
