## Story epic-7-test-design
- [Epic test design] Accepted-immutability is ONE model at three scopes across three epics â€” Epic 6 sent-freeze (R-605), Epic 7 accepted-lock (R-704), Epic 8.4 locked-evidence-file â€” design pins 'shared lock-code family, not a fork' as an explicit STOP so trace catches divergence

## Story epic-7
- [E2 - epic test design] Sent-lock trigger enforces a forward-only legal-transition allow-list AND rejects customer-visible column co-mutation in the same non-draft UPDATE - story 7-2 accept must transition status ALONE or it hits QUOTE_VERSION_LOCKED (design doc corrected).

## Story 7-1-acceptance-evidence-capture-for-sent-quote-versions
- [Phase 3 - create-story] Scope boundary pinned: 7.1 owns quote_acceptances single-row persistence + form; 7.2 owns accept_quote_and_create_job RPC/transaction/idempotency; 7.4 owns DB immutability lock - epic doc bundles these.
- [Phase 3 - create-story] ACCEPTANCE_ALREADY_RECORDED error code deliberately NOT built in 7.1 (sent-state gate covers it); reserved for 7.2 idempotent path - epic trace must not read its absence in 7.1 as a gap.
- [Phase 4 - ATDD] The 6.2 non-scope guardrail (tests/unit/guardrails/quote-non-scope.test.ts) forbids acceptQuote tokens in src/server/commands/quotes - the exact dir where 7.1 must add the sanctioned command; dev MUST narrow the guardrail or 7.1 fails loud. Not a scope violation.
- [Phase 5 - dev-story] Epic-5 calc-tables-migration-reset test forbade the jobs table (deferred then, sanctioned now) - removed jobs from its forbidden list; future epics landing a previously-forbidden table should expect and fix this schema-wide guard.
- [Phase 5 - dev-story] Decision: non-sent + delta-without-reason both surface as generic VALIDATION_FAILED (no new error code in 7.1); idempotency codes reserved for 7.2.

## Story 7-2-idempotent-accept-quote-and-create-job-command
- [Phase 5 - dev-story] RPC must read customer_id/facility_id/contact_id off the parent quotes row, NOT quote_versions (version snapshot holds only display names) - non-obvious schema split; 7.3 job UX must expect this.
- [Phase 5 - dev-story] Command sent-state gate relaxed to let an already-accepted version reach the RPC idempotent short-circuit; a strict status==sent gate breaks retry idempotency - 7.4 immutability must preserve this path.
- [Phase 5 - dev-story] ACCEPTANCE_ALREADY_RECORDED added but reserved (row lock resolves concurrency into idempotent return); shared error mapper keeps 23505 -> VALIDATION_FAILED so 7.1 behavior unchanged.
- [Phase 7 - Tier A review] p_command_at was computed and unit-asserted but never passed to the RPC (no matching SQL param) - removed; future timestamp-injection assertions must verify the arg reaches the DB call, not just the adapter output.
