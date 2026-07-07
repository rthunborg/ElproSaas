## Story epic-7-test-design
- [Epic test design] Accepted-immutability is ONE model at three scopes across three epics â€” Epic 6 sent-freeze (R-605), Epic 7 accepted-lock (R-704), Epic 8.4 locked-evidence-file â€” design pins 'shared lock-code family, not a fork' as an explicit STOP so trace catches divergence

## Story epic-7
- [E2 - epic test design] Sent-lock trigger enforces a forward-only legal-transition allow-list AND rejects customer-visible column co-mutation in the same non-draft UPDATE - story 7-2 accept must transition status ALONE or it hits QUOTE_VERSION_LOCKED (design doc corrected).
- [E8a - trace gate] PASS 100% P0/P1. Design routes new-table RLS/H4 coverage through the shared TENANT_TABLES inventory, so a literal test-ID diff shows 7.1-RLS-01/02 missing when they are covered by design intent - future trace runs must not mis-score inventory-driven coverage as a gap.
- [E_review] Tier-B converged in 2 iterations (Approve, 0 Crit/High across ~190 raw iter-1 + ~150 iter-2 findings; security 0/0/0 twice). Two process notes: fix commits should carry their own test coverage; a review recommendation reusing an existing SQLSTATE for a distinct condition carries the mislabel into code - specify a distinct code in the recommendation.
- [E_review] Chunked-review seam: per-chunk lenses missed the 7.1<->7.3 evidence-file owner_type label mismatch until an iter-2 epic auditor caught it - cross-chunk integration gaps are real; the epic auditor lens is what catches them.

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

## Story 7-3-minimal-job-order-record-and-tenant-admin-ux
- [Phase 5 - dev-story] ATDD scaffolds were authored against a drifted API (nonexistent runCommand actor param, camelCase factory seeds, wrong audit filter shape) and had to be rewritten to the real APIs preserving assertion intent - recurring scaffold-vs-real-API reconcile cost for future ATDD passes.
- [Phase 5 - dev-story] Client/server boundary: JOB_STATUSES/labels split into pure types.ts because a client island importing from read.ts pulled the server-only RLS client into the client bundle (build failure) - apply the type/const-split discipline to any feature module whose read.ts imports the server client.
- [Phase 6 - automate] src/features/jobs/read.ts cannot be imported under node --test (static next/headers import) - pure read-layer mapping tests must live in the Vitest suite even with no DB dependency.

## Story 7-4-accepted-state-immutability-and-correction-boundary
- [Phase 5 - dev-story] Pattern: story-N tests that assert story-N+k artifacts are ABSENT (planted forward-references like no-7.4-trigger-yet guards) create a required, sanctioned edit in story N+k - happened twice this epic (7.2 RPC assertion, 7.4 trigger assertion).
- [Phase 5 - dev-story] Lock design: quote_acceptances locks everything except archived_at/updated_at; jobs leaves facility_id/contact_id unlocked so ON DELETE SET NULL cascade works - a full-tuple lock would have broken the cascade.
