## Story epic-4
- [Phase 2 — epic test design] Epic 4 test design pre-existed (2026-07-01); delegate validated (PASS) instead of regenerating — validation report at test-artifacts/test-design-validation-report.md.
- [Phase 2 — epic test design] Gate-time reconcile needed: story 4.3 'personnummer not captured by default' vs 2026-06-18 owner decision to store personnummer for private customers (R-412); standing NFR concerns: no pnpm audit gate, no coverage reporter.
- [Phase 2 — epic test design] Design carries 8 owner/accounting sign-off questions (rounding mode, VAT display, ROT cap, gron-teknik rates/caps/mix, eligibility disclaimer, personnummer scope, approval posture, accepted-price delta) — human decisions, not plan gaps.

## Story 4-1-integer-ore-money-and-rounding-primitives
- [Phase 3 — create-story] Chose 'round half away from zero' as conservative pilot half-rounding default, golden-pinned; sits inside the owner's still-open rounding sign-off question — sign-off must confirm or override.
- [Phase 4 — atdd] Generic ATDD workers (API HTTP + E2E browser) don't fit pure-library stories; adapted to inline node --test UNIT+GOLDEN — other epic-4 primitive stories routed through ATDD need the same adaptation.
