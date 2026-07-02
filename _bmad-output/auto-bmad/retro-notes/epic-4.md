## Story epic-4
- [Phase 2 — epic test design] Epic 4 test design pre-existed (2026-07-01); delegate validated (PASS) instead of regenerating — validation report at test-artifacts/test-design-validation-report.md.
- [Phase 2 — epic test design] Gate-time reconcile needed: story 4.3 'personnummer not captured by default' vs 2026-06-18 owner decision to store personnummer for private customers (R-412); standing NFR concerns: no pnpm audit gate, no coverage reporter.
- [Phase 2 — epic test design] Design carries 8 owner/accounting sign-off questions (rounding mode, VAT display, ROT cap, gron-teknik rates/caps/mix, eligibility disclaimer, personnummer scope, approval posture, accepted-price delta) — human decisions, not plan gaps.
- [Phase 8 — gates] Trace gate PASS (100% P0/P1 coverage, 188/188 money units green); NFR PASS-advisory with pnpm-audit CONCERNS now carried un-actioned across epics 2-4 — needs explicit schedule-or-accept at retro; test-review 93/100 (A) with P2/P3 polish backlog (split >300-line test files, extract shared helpers).
- [Phase 8 — gates] Trace noted sprint-status.yaml 4-1 entry stale at ready-for-dev while story file is review — self-heals at E_final batch flip; dev-story's sprint sync missed it (worth a retro line).

## Story 4-1-integer-ore-money-and-rounding-primitives
- [Phase 3 — create-story] Chose 'round half away from zero' as conservative pilot half-rounding default, golden-pinned; sits inside the owner's still-open rounding sign-off question — sign-off must confirm or override.
- [Phase 4 — atdd] Generic ATDD workers (API HTTP + E2E browser) don't fit pure-library stories; adapted to inline node --test UNIT+GOLDEN — other epic-4 primitive stories routed through ATDD need the same adaptation.
- [Phase 5 — dev-story] Test alias-hook couldn't resolve bare directory imports (@/lib/money); fixed to resolve a directory to its index.ts barrel — future src/lib/<dir> barrel imports via @/* in node --test now work.
- [Phase 5 — dev-story] isOreAmount/ORE_AMOUNT_MAX now canonical in @/lib/money, re-exported from server pricing validation; oreToKronorString delegates to formatOreAsKronor — one money authority, no signature changes.

## Story 4-2-vat-and-quote-total-calculation-primitives
- [Phase 3 — create-story] isVatRateBp in settings validator is module-private though its VAT_RATE_BP_MIN/MAX bounds are exported — story spells out export/move/reconstruct options so dev keeps ONE bp-validity rule.
- [Phase 5 — dev-story] isVatRateBp + VAT_RATE_BP_MIN/MAX moved canonical into @/lib/money (settings validator re-exports) — mirrors 4.1 isOreAmount move; MoneyErrorCode widened additively with INVALID_VAT_RATE_BP.
- [Phase 5 — dev-story] private -> always incl-VAT built as documented conservative assumption (Sign-Off Q2), not legally final; VAT views are pure ore-selection, no second kronor formatter added.
- [Phase 6 — automate] lineVatOre output-overflow branch unreachable from valid inputs (VAT <= net <= max for bp <= 10000); the reachable overflow is vatBreakdown's derived-gross guard — the two guards differ in reachability.

## Story 4-3-rot-and-gron-teknik-estimate-engine-with-warnings
- [Phase 5 — dev-story] Story Dev Notes claimed 'no ATDD scaffold exists for 4.3' but the scaffold was already committed (Phase 4 ran between create-story and dev) — create-story's claim was stale by dev time; epic retro should note the sequencing so future story contexts don't assert scaffold absence.
- [Phase 5 — dev-story] Schablon on/off for gron teknik NOT modelled in placeholder profile — deferred to Sign-Off Q4 as conservative placeholder + unapproved warning.

## Story 4-4-money-and-tax-golden-master-fixture-pack
- [Phase 3 — create-story] Runner-glob trap: epics.md says fixtures may live under tests/golden/** but test:unit glob is tests/unit/**/*.test.ts — a test under tests/golden/** would be vacuous green; 4.4 context pins the golden-pack test to tests/unit/lib/money/.
- [Phase 5 — dev-story] Pack references existing fixtures as single numeric authority per category (no re-pinning); only genuinely-new categories (options/tillval, accepted-price delta) authored fresh.
- [Phase 5 — dev-story] Accepted-price delta encoded shape-only (deltaOre = recalculated - accepted), pilot assumption pending Sign-Off Q8; old-Lovable numbers captured only where genuinely known — no fabricated deltas.
- [Phase 5 — dev-story] Surfaced for gate: document-level rounding deferred (R-402 stop-condition), calc-at-scale perf untested (R-414), pnpm audit + coverage reporter still owner-pending.
