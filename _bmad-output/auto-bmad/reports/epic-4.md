# auto-bmad epic report log — epic-4

## Report — 2026-07-02T11:20:42Z (halted — dirty working tree on main (E0 preflight)

**Epic:** `None` — stories.
**Branch:** `(unknown)` (HEAD `08e0baf`).
**Pipeline status:** Hard-stop at E0 preflight — working tree dirty (2 untracked files) on base branch `main`; no E-step ran, nothing committed.
**Continues:** (none — first run)

**Summary:** Epic 4 (money & tax calculation foundation) — 4 stories enumerated, all at backlog: 4-1-integer-ore-money-and-rounding-primitives, 4-2-vat-and-quote-total-calculation-primitives, 4-3-rot-and-gron-teknik-estimate-engine-with-warnings, 4-4-money-and-tax-golden-master-fixture-pack. Fresh run — no adoption, no in-flight anchor.

**Timing:** (none — started_at not recorded).

**Stories:**
1. (none — halted before E1; no story entered the loop)

**Skipped (already done):** (none)

**Integration review:** not reached

**Epic gate:** not reached

**TEA:** not reached (enabled in config; per-story triage would run in E5)

**UAT:** (none)

**Overrides:** none (epic mode, --epic 4)

**Open questions:** (none)

**Deferred work:** (none)

**Auto-decided (epic mode):** (none)

**Planning drift:** (none)

**⚠️ Needs human:**
1. Working tree dirty on `main`: 2 untracked files — `_bmad-output/test-artifacts/test-design-epic-4-progress.md` and `_bmad-output/test-artifacts/test-design-epic-4.md` (look like a prior/manual epic-4 test-design run). Commit or stash them, then re-run `/auto-bmad epic --epic 4`.

**Next:** Epic 4 story 4-1-integer-ore-money-and-rounding-primitives (first of 4) — once preflight passes.

## Report — 2026-07-02T15:25:53Z (final)

**Epic:** `4` — 4 stories.
**Branch:** `epic/4-money-tax-snapshot-primitives-and-golden-fixtures` (HEAD `3948a0d`).
**Pipeline status:** ✅ clean completion — all 4 stories landed on one epic branch; Tier-B integration review converged (2 iterations, exit-clean, convergence_unverified false); trace gate PASS; normal (non-draft) PR.
**Continues:** 2026-07-02T11:20:42Z (halted — dirty working tree on main (E0 preflight))

**Summary:** Epic 4 (Money, Tax, Snapshot Primitives, And Golden Fixtures): pure integer-öre money engine at src/lib/money (ore.ts/vat.ts/tax.ts) — rounding primitives, VAT + quote totals, ROT/grön teknik deduction engine with sign-off gating and blocking mix rule, plus the golden-master fixture pack as the recurring money/tax test oracle. No new deps, migrations, tables, routes, or UI. Unit suite grew 424 -> 613 (271-test vitest int suite unchanged).

**Timing:** started 2026-07-02T11:42:30Z; completed in progress — elapsed 3h 43m (≈3h 36m AI-run, ≈6m human/idle wait); resumed 1×.

**Stories:**
1. 4-1-integer-ore-money-and-rounding-primitives — landed clean: pure öre engine + canonical isOreAmount/formatter consolidation; ATDD red->green; +66 tests; Tier-A Approve (0 persisted, 6 noise dismissed); security 0/0/0
2. 4-2-vat-and-quote-total-calculation-primitives — landed clean: VAT engine (lineVatOre/sumVatOre/vatBreakdown/selectVatDisplay/snapshot builder), canonical isVatRateBp moved to @/lib/money; +54 tests; Tier-A: 2 Med Decisions auto-resolved fix + 1 Patch, post-fix 0 open; security 0/0/0
3. 4-3-rot-and-gron-teknik-estimate-engine-with-warnings — landed clean: UNAPPROVED ROT/grön profiles as data, estimateDeduction with requiresSignOff default + warnings + blocking mix; +51 tests; Tier-A Approve, 2 Decisions auto-resolved (persons cap -> defer Q3; snapshot guard -> dismiss); security 0/0/0
4. 4-4-money-and-tax-golden-master-fixture-pack — landed clean: pack-level oracle (coverage manifest, three-way origin labelling, privacy scan) + 2 new anonymized fixtures; +16 tests; Tier-A: 1 Med doc-accuracy Patch fixed; security 0/0/0

**Skipped (already done):** (none)

**Integration review:** Tier B (2 reviewers x 3 lenses + dedicated security, whole-epic diff ~5.5k lines): iter 1 — 51 raw -> 7 persisted (4 Decision auto-resolved: 3 fix + 1 defer; 2 Patch fixed; 1 Defer), 20 noise dismissed; iter 2 — 55 raw -> 8 new (2 Patch Low fixed, 6 Defer logged incl. 1 Med union-parity), ~24 dismissed incl. 6 iter-1 re-raises; gate exit-clean (2 non-deferred <= 3, 0 Crit/High, all 6 lenses ran); security clean both iterations; no halt (epic mode, auto-continued).

**Epic gate:** trace PASS (P0 15/15, P1 5/5, overall 20/20 FULL; 188/188 money units live-verified; 6/6 non-negotiable blockers MET); NFR PASS-advisory (6 PASS / 2 CONCERNS / 0 FAIL — no pnpm audit gate [now owner-assigned with deadline], no coverage reporter); test-review 93/100 Grade A Approve.

**TEA:** Per-story triage: 4.1/4.2/4.3 high -> [atdd, automate]; 4.4 med -> [automate]. All ATDD scaffolds flipped red->green unchanged; coverage expansions +27/+28/+24/+5. Trace advisory dormant (4-story epic < min 6). Epic gates: see epic gate line.

**UAT:**
1. Setup — pnpm run test:unit -> whole tests/unit/** suite GREEN (0 fail, 0 skipped) incl. money/vat/tax/golden-pack + pre-existing suites
2. Suite-run — node --test tests/unit/lib/money/**/*.test.ts -> all pass (VAT + tax ATDD gates flipped true, nothing skipped)
3. Öre core — lineNetOre(3,79000) -> 237000; lineNetOre(0.333,100000) -> 33300; lineNetOre(0,5000) and (2,0) -> 0 (fractional qty + zero valid, no float residue)
4. Rounding mode — lineNetOre(0.5,45) -> 23 (half-away-from-zero; bankers rounding would give 22); sumOre([23,23,23]) -> 69 (sum-of-rounded, not 68)
5. Öre rejections — float/locale-string/NaN/Infinity/null -> INVALID_ORE_AMOUNT; negative qty -> INVALID_QUANTITY; MAX_SAFE_INTEGER product -> ORE_OVERFLOW (stable codes, no throw)
6. Formatter — formatOreAsKronor: 85000 -> 850,00; 1 -> 0,01; 0 -> 0,00; NaN/Infinity -> empty string; === oreToKronorString (single authority, byte-identical)
7. Rounding golden — rounding-mode.json shows expectedLineNetOre vs bankersWouldGive on .5 boundaries; sumOfRoundedCase 69 vs 68
8. VAT no-hidden-constant — vat.ts rate literals only in comments; sole computational literal is / 10000 (R-404)
9. VAT per-line — lineVatOre(85000,2500) -> 21250; (33300,1200) -> 3996; (50000,600) -> 3000; (2,2500) -> 1; zero/exempt -> 0
10. VAT rejections + totals — 850.5 net -> INVALID_ORE_AMOUNT; 2500.5/10001 bp -> INVALID_VAT_RATE_BP; sumVatOre([1,1,1]) -> 3 not 2
11. VAT breakdown + display — vatBreakdown(85000,2500) -> {85000, 21250, 106250}; selectVatDisplay per posture (company_excl 85000/false, company_togglable 106250/true, private 106250/false); source unmutated
12. VAT unknown-posture fallback — conservative gross primary but returned posture ECHOES the original input (no private relabel; iter-2 fix)
13. VAT snapshot — frozen, mutation-proof; vatRateBp 2500.5 -> INVALID_VAT_RATE_BP; empty/non-string capturedAt -> INVALID_CAPTURED_AT (iter-2 fix)
14. VAT compose chain — lineNetOre(2.5,333) -> 833 -> lineVatOre 208 -> gross 1041
15. ROT/grön golden run — tax.golden.test.ts pins placeholder numbers (ROT 3000 bp, grön 2000 bp, caps 5 000 000 öre); no hidden percent literal grep
16. Deduction rates — rot/100000/private -> 30000 + requiresSignOff true + UNAPPROVED_PROFILE warning; gron_teknik/200000 -> 40000 (own rate); basis 0 -> ok 0
17. Cap clamp + multi-line basis — 30000000 -> 5000000 clamped + DEDUCTION_CLAMPED_TO_CAP; [60000,40000] hidden 2nd -> basis 100000/deduction 30000 (hidden rows count)
18. Deduction blocks + eligibility — ROT x grön mix -> ROT_GRON_MIX_NOT_ALLOWED (never summed); unknown type -> UNKNOWN_DEDUCTION_TYPE (no raw echo); company/brf/public -> POSTURE_NOT_ELIGIBLE warning, private clean
19. Deduction bad-input codes — bad basis -> typed money codes, no NaN/raw echo; malformed profile rate -> INVALID_DEDUCTION_RATE_BP (iter-2 fix); bad persons -> INVALID_QUANTITY
20. Sign-off + no-PII — every success JSON has requiresSignOff:true, never approved:true; profiles frozen approved:false pending-owner-accounting-legal; personnummer input never echoed
21. Tax snapshot — frozen, keeps captured bp, capturedAt = injected instant; empty capturedAt -> INVALID_CAPTURED_AT
22. Golden pack run — golden-pack + golden-pack-coverage 16/16; CATEGORY_MANIFEST maps all 10 AC1 categories to existing fixtures
23. Golden fixtures eyeball — options-tillval.json + accepted-price-deltas.json valid with _doc/policy(signOff pending)/cases; all three origins exercised with non-empty notes
24. Golden hand-check — options: base [50000,30000]+selected 20000 -> 100000 included, unselected 15000 not summed, hidden basis -> ROT 27000; deltas: recalculated - accepted === expectedDeltaOre for every case
25. Golden guards fail loud (temp-mutate then REVERT) — bogus origin -> labelling test fails naming case; deleted expectedDeltaOre/_doc -> shape guard fails; injected PII -> privacy scan fails naming file

**Overrides:** none (epic mode, --epic 4)

**Open questions:**
1. 8 owner/accounting/legal sign-off questions (Q1-Q8): rounding mode, VAT display default (incl. company_togglable-defaults-to-gross), ROT cap/rate/per-person multiplier, grön-teknik rates/caps/schablon, eligibility disclaimer, personnummer scope, approval posture, accepted-price-delta representation — engine ships everything as UNAPPROVED conservative placeholders + warnings
2. Coverage reporter (c8) still unowned — flagged for Epic 5 retro if it remains unowned

**Deferred work:**
1. persons per-person ROT cap unmodelled (flat conservative placeholder) — owner Sign-Off Q3 [ledger]
2. company_togglable default primary = gross — owner Sign-Off Q2 [ledger]
3. Schablon on/off for grön teknik not modelled — owner Sign-Off Q4
4. 6 iter-2 hardening defers: ORGNR 10-digit false-positive trap; union parity/drift test (Med); snapshot ok-absence discriminant; golden describe.skip self-disable gates; alias-hook robustness; coverage-manifest substring tokens [ledger]
Reconcile marked 0 missed-completions (all open items re-verified genuinely open on code evidence); archived 6 fully-resolved epic-2 hardening entries -> deferred-work-resolved.md

**Auto-decided (epic mode):**
1. defaultVatDisplay typed as bare string, widening the VatDisplayMode enum [Med] -> fix: closed VatDisplayMode union exported from @/lib/money (Tier A, 4-2)
2. buildVatAssumptionSnapshot no vatRateBp validation [Med] -> fix: isVatRateBp guard at builder entry, typed failure (Tier A, 4-2)
3. persons not applied to per-person ROT cap [Med] -> defer: owner-gated Sign-Off Q3, logged to ledger (Tier A, 4-3)
4. buildTaxAssumptionSnapshot lacks isVatRateBp guard [Low] -> dismiss: intentional per state-capture-only builder contract (Tier A, 4-3)
5. Deduction rate leaks VAT-named error code [Med] -> fix: INVALID_DEDUCTION_RATE_BP added (E_review, epic-4)
6. selectVatDisplay falsifies posture to private on unknown input [Med] -> fix: echo original posture (E_review, epic-4)
7. company_togglable default = gross for company customer [Med] -> defer: Sign-Off Q2, logged to ledger (E_review, epic-4)
8. capturedAt never validated before freezing [Low] -> fix: non-empty guard + INVALID_CAPTURED_AT in both builders (E_review, epic-4)

**Planning drift:** (none) — retro confirmed the build matched epics.md scope exactly; R-412 personnummer reconciled in-code

**⚠️ Needs human:** (none)

**Next:** Epic 5 story 5-1-tenant-owned-calculation-schema-and-server-commands (backlog) — via /auto-bmad epic --epic 5 after this PR merges
