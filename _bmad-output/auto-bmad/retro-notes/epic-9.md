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
- [Phase 5 â€” dev-story] Non-src alias roots (@/tests-support/*, @/scripts-migration/*) need DUAL mapping: alias-hook.mjs AND tsconfig paths (longest-prefix-wins, probed before @/*) â€” any future test-support/script module imported under @/... needs both.
- [Phase 5 â€” dev-story] old-lovable origin exercised WITHOUT fabricating a real Lovable number: clearly-marked SYNTHETIC placeholder with machine-readable capturedFromRealLovable: false â€” real value backfills later (owner-gated 8.2) with no schema change.
- [Phase 6 â€” automate] ADDRESS regex only matches street-type words at a WORD BOUNDARY â€” compounds like 'Storgatan 12' do NOT trip it; 9.3 must not over-rely on the ADDRESS class (other PII classes unaffected). Recorded inline in lovable-scanner-unit.test.ts.

## Story 9-3-golden-master-comparison-harness-for-core-workflow
- [Phase 5 â€” dev-story] calculations.json#mixed-rows (9.2 fixture) pins MISSING_WORK_ROLE in readinessWarnings but the code is not structurally reachable from its rows â€” harness asserts the live-oracle truth and documents the divergence; fixture-vs-oracle representativeness gap for 9.2's owner (non-sensitive: warning classification).
- [Phase 5 â€” dev-story] node --test process isolation (one process per file) breaks any cross-file mutable registry â€” coverage manifests must re-drive shared live-drive functions in-process; trap for future golden packs assuming shared in-memory state.
- [Phase 6 â€” automate] quotes.json#quote-total-rounding-documented-delta: fixture LINES carry quantity:3 while totals.vatOre/_doc describe quantity-1 math â€” the totals block is captured SHAPE, not an engine re-pin of its own lines (driving the lines yields 50000, not 16666). Frozen fixture, not a defect, but a trap for tests assuming line->total derivation.

## Story 9-4-pilot-fallback-cutover-and-sign-off-register
- [Phase 4 â€” ATDD] testarch-atdd's step-04 assumes a Playwright/E2E stack with an API+E2E subagent split â€” N/A for docs-validator stories; the right red-phase deliverable is a single node --test scaffold mirroring the 9.1 validator (relevant for 9-5, also docs/validator-shaped).

## Story 9-5-phase-a-acceptance-gate-report
- [Phase 5 â€” dev-story] No-fictional-readiness-code heuristic false-positived on CI env var SUPABASE_TEST_REQUIRED (ends in _REQUIRED) â€” future SCREAMING_SNAKE-scanning validators must exclude infra env-var prefixes from readiness-code detection.
- [Phase 6 â€” automate] registerBlockingIds() regex only matches digit-led IDs (8.1/7.1) â€” dotted families A.1/A.2/B.1-B.4/C.1-C.3 in the 9.4 register are authored into report Â§6 but NOT machine-reconciled as blocking; epic-close decision needed on tightening the parser (pre-existing 9-4 ledger awareness item).
