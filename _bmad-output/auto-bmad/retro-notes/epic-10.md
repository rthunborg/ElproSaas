## Story epic-10
- [Phase 2 â€” epic test design] FÃ¶rlorad/AvbÃ¶jd lifecycle-token model under-specified in architecture Â§9.1/Â§14 (new status token vs rejected+quote_lost_reasons) â€” must be decided at 10.2 create-story; scopes R-1011 coverage.

## Story 10-1-phase-b-governance-re-baseline-and-scope-manifest
- [Phase 3 â€” create-story] Deny-list derivation is the sharpest risk: the 7 forbidden tokens mix pending-Phase-B modules and Phase-C hard-exclusions; reproducing exactly those 7 from the manifest vs flagging genuine drift is the main Stop-Condition trigger at dev/review.
- [Phase 4 â€” ATDD] testarch-atdd hard-wires Playwright API+E2E workers; for a pure-TS-unit governance story the right red-phase medium is node:test unit suites per repo convention â€” worth remembering for future TEA-on-governance stories.
- [Phase 5 â€” dev-story] All 7 deny-tokens map to genuine Phase-B pending modules (DoU/tenders manual cores are B3; only AI layers are C) â€” story Dev Notes' 'Phase C hard-exclusion' framing could have misled toward a wave:'C' schema extension; five-value wave union held.
- [Phase 5 â€” dev-story] Golden JSON fixtures not pinned eol=lf in .gitattributes â€” 9.2-REPEAT-01 fails on Windows autocrlf checkouts, passes CI; one-line fix exists, out of story scope.

## Story 10-2-forlorad-avbojd-status-and-lost-reason-lifecycle
- [Phase 3 â€” create-story] Lifecycle-token model settled: ONE new `lost` status+event token; Forlorad/Avbojd lives only in quote_lost_reasons.outcome. Deciding fact: shipped Epic-6 markQuoteVersionLifecycle writes reason-less `rejected` and is not UI-wired, so rejected-mapping would make 10.4's lost bucket dishonest; owner 4.3 names Forlorad/Avbojd as its own status.
- [Phase 4 â€” ATDD] A literal **/*.json glob inside a JSDoc block comment contains */ which closes the comment and breaks --experimental-strip-types parsing â€” keep */ out of block comments in scaffolds.
- [Phase 4 â€” ATDD] .gitattributes eol=lf pin for golden fixtures added here (retro gotcha closed in-branch).
- [Phase 5 â€” dev-story] Adding an active tenant table (24->25) trips Phase-A hard-pinned count guardrails; reconciliation pattern ratified: 10.1 pins bump to the new count, frozen Phase-A gate validators become floors (>=24). Every Phase B table-adding story will repeat this.
- [Phase 5 â€” dev-story] Sequential second-lost returns VALIDATION_FAILED (command guard primary); the DB belt fires only under the concurrent race â€” scaffold expectation corrected to spec-accurate layering.
- [Phase 5 â€” dev-story] Committed supabase/cli-profile.yaml lacks dashboard_url required by CLI 2.109.1 â€” db reset fails against it; temp profile used; one-line fix flagged.
- [Tier A â€” review] Two ATDD scaffolds shipped still describe.skip while the Change Log claimed 'all unskipped and green' â€” the unskip-or-delete finalize step needs a mechanical checklist gate in dev-story (echoes epic-9 self-documented!=done).
- [Tier A â€” review] Task 6.4 marked done but the named standing R-1015 scan glob was never widened (only a fixture-local check added) â€” marked-complete task whose standing control went untouched; fixed in review.

## Story 10-3-quote-follow-up-workflow
- [Phase 3 â€” create-story] Cross-story attribution conflict resolved: 10.3 ships functional follow-up filters + overdue badge (per 10.4 AC2's own 'from Stories 10.2-10.3' language); 10.2's Task-5.4 note loosely said '10.4, not here' â€” reviewer reading only 10.2 may misread scope creep.
- [Phase 3 â€” create-story] Auto-complete-on-lost is deliberately non-atomic (two-command orchestration; no RPC per architecture) rather than re-touching the frozen lost RPC â€” rare orphaned open follow-up is an accepted, audited, recoverable residual BY DESIGN.
