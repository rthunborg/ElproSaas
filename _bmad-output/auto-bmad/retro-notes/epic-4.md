## Story epic-4
- [Phase 2 — epic test design] Epic 4 test design pre-existed (2026-07-01); delegate validated (PASS) instead of regenerating — validation report at test-artifacts/test-design-validation-report.md.
- [Phase 2 — epic test design] Gate-time reconcile needed: story 4.3 'personnummer not captured by default' vs 2026-06-18 owner decision to store personnummer for private customers (R-412); standing NFR concerns: no pnpm audit gate, no coverage reporter.
- [Phase 2 — epic test design] Design carries 8 owner/accounting sign-off questions (rounding mode, VAT display, ROT cap, gron-teknik rates/caps/mix, eligibility disclaimer, personnummer scope, approval posture, accepted-price delta) — human decisions, not plan gaps.

## Story 4-1-integer-ore-money-and-rounding-primitives
- [Phase 3 — create-story] Chose 'round half away from zero' as conservative pilot half-rounding default, golden-pinned; sits inside the owner's still-open rounding sign-off question — sign-off must confirm or override.
- [Phase 4 — atdd] Generic ATDD workers (API HTTP + E2E browser) don't fit pure-library stories; adapted to inline node --test UNIT+GOLDEN — other epic-4 primitive stories routed through ATDD need the same adaptation.
- [Phase 5 — dev-story] Test alias-hook couldn't resolve bare directory imports (@/lib/money); fixed to resolve a directory to its index.ts barrel — future src/lib/<dir> barrel imports via @/* in node --test now work.
- [Phase 5 — dev-story] isOreAmount/ORE_AMOUNT_MAX now canonical in @/lib/money, re-exported from server pricing validation; oreToKronorString delegates to formatOreAsKronor — one money authority, no signature changes.

## Story 4-2-vat-and-quote-total-calculation-primitives
- [Phase 3 — create-story] isVatRateBp in settings validator is module-private though its VAT_RATE_BP_MIN/MAX bounds are exported — story spells out export/move/reconstruct options so dev keeps ONE bp-validity rule.
- [Phase 5 — dev-story] isVatRateBp + VAT_RATE_BP_MIN/MAX moved canonical into @/lib/money (settings validator re-exports) — mirrors 4.1 isOreAmount move; MoneyErrorCode widened additively with INVALID_VAT_RATE_BP.
- [Phase 5 — dev-story] private -> always incl-VAT built as documented conservative assumption (Sign-Off Q2), not legally final; VAT views are pure ore-selection, no second kronor formatter added.
