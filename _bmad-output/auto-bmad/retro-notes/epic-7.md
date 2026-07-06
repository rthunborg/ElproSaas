## Story epic-7-test-design
- [Epic test design] Accepted-immutability is ONE model at three scopes across three epics â€” Epic 6 sent-freeze (R-605), Epic 7 accepted-lock (R-704), Epic 8.4 locked-evidence-file â€” design pins 'shared lock-code family, not a fork' as an explicit STOP so trace catches divergence

## Story epic-7
- [E2 - epic test design] Sent-lock trigger enforces a forward-only legal-transition allow-list AND rejects customer-visible column co-mutation in the same non-draft UPDATE - story 7-2 accept must transition status ALONE or it hits QUOTE_VERSION_LOCKED (design doc corrected).

## Story 7-1-acceptance-evidence-capture-for-sent-quote-versions
- [Phase 3 - create-story] Scope boundary pinned: 7.1 owns quote_acceptances single-row persistence + form; 7.2 owns accept_quote_and_create_job RPC/transaction/idempotency; 7.4 owns DB immutability lock - epic doc bundles these.
- [Phase 3 - create-story] ACCEPTANCE_ALREADY_RECORDED error code deliberately NOT built in 7.1 (sent-state gate covers it); reserved for 7.2 idempotent path - epic trace must not read its absence in 7.1 as a gap.
