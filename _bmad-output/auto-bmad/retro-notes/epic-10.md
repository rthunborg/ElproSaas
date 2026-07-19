## Story epic-10
- [Phase 2 â€” epic test design] FÃ¶rlorad/AvbÃ¶jd lifecycle-token model under-specified in architecture Â§9.1/Â§14 (new status token vs rejected+quote_lost_reasons) â€” must be decided at 10.2 create-story; scopes R-1011 coverage.

## Story 10-1-phase-b-governance-re-baseline-and-scope-manifest
- [Phase 3 â€” create-story] Deny-list derivation is the sharpest risk: the 7 forbidden tokens mix pending-Phase-B modules and Phase-C hard-exclusions; reproducing exactly those 7 from the manifest vs flagging genuine drift is the main Stop-Condition trigger at dev/review.
- [Phase 4 â€” ATDD] testarch-atdd hard-wires Playwright API+E2E workers; for a pure-TS-unit governance story the right red-phase medium is node:test unit suites per repo convention â€” worth remembering for future TEA-on-governance stories.
- [Phase 5 â€” dev-story] All 7 deny-tokens map to genuine Phase-B pending modules (DoU/tenders manual cores are B3; only AI layers are C) â€” story Dev Notes' 'Phase C hard-exclusion' framing could have misled toward a wave:'C' schema extension; five-value wave union held.
- [Phase 5 â€” dev-story] Golden JSON fixtures not pinned eol=lf in .gitattributes â€” 9.2-REPEAT-01 fails on Windows autocrlf checkouts, passes CI; one-line fix exists, out of story scope.

## Story 10-2-forlorad-avbojd-status-and-lost-reason-lifecycle
- [Phase 3 â€” create-story] Lifecycle-token model settled: ONE new `lost` status+event token; Forlorad/Avbojd lives only in quote_lost_reasons.outcome. Deciding fact: shipped Epic-6 markQuoteVersionLifecycle writes reason-less `rejected` and is not UI-wired, so rejected-mapping would make 10.4's lost bucket dishonest; owner 4.3 names Forlorad/Avbojd as its own status.
