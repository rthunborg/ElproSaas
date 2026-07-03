# auto-bmad epic report log — epic-5

## Report — 2026-07-02T18:02:19Z (halted â€” dirty working tree on main)

**Epic:** `None` — stories.
**Branch:** `(unknown)` (HEAD `55484f0`).
**Pipeline status:** â›” Halted at E0 preflight â€” working tree dirty (2 untracked files) on 'main'. Nothing was run, committed, or branched.
**Continues:** (none â€” first run)

**Summary:** Epic 5 enumerated cleanly: 5 stories, all at backlog (next action create-story). No in-flight epic anchor; fresh run once the tree is clean.

**Timing:** (none — started_at not recorded).

**Stories:**
1. (none â€” halted before E1; no story entered the loop)

**Skipped (already done):** (none)

**Integration review:** (not reached)

**Epic gate:** (not reached)

**TEA:** (not reached â€” triage is per story in E5)

**UAT:** (none)

**Overrides:** none

**Open questions:** (none)

**Deferred work:** (none)

**Auto-decided (epic mode):** (none)

**Planning drift:** (none)

**⚠️ Needs human:**
1. Untracked files on 'main' block the preflight: ledger-review.txt and ledger-review2.txt (repo root). Commit, stash, or delete them, then re-run /auto-bmad epic --epic 5.

**Next:** /auto-bmad epic --epic 5 â€” starts at story 5-1-tenant-owned-calculation-schema-and-server-commands

## Report — 2026-07-03T12:11:18Z (final)

**Epic:** `5` — 5 stories.
**Branch:** `epic/5-calculation-workspace-and-quote-readiness` (HEAD `783869b`).
**Pipeline status:** âœ… clean completion â€” all 5 stories landed, Tier-B integration review converged clean (iter 2, exit-clean), trace gate PASS, security clean in every pass; one PR from the epic branch.
**Continues:** (none â€” first run; one mid-run session restart during story 5-1 dev, resumed on the same anchor)

**Summary:** Epic 5 'Calculation Workspace And Quote Readiness' â€” the tenant-owned calculation data model (3 RLS-forced tables + 2 atomic SECURITY INVOKER reorder RPCs), the /calculations list + section/row editor UI, frozen copy-by-value pricing-source snapshots, the readiness classifier + pre-quote preview (incl. resolving the tenant VAT-display posture), and the calc golden-test pack. 13 commits of product/test work across 5 stories plus 2 epic-review fix commits; unit suite grew 629 â†’ 855, INT 326 â†’ 337, E2E 46 â†’ 56.

**Timing:** started 2026-07-02T18:13:57Z; completed in progress — elapsed 17h 57m (≈6h 06m AI-run, ≈11h 50m human/idle wait); resumed 1×.

**Stories:**
1. 5-1 tenant-owned-calculation-schema-and-server-commands â€” landed (review): schema+commands+RPCs; Tier-A: Changes Requested, C0/H0/M3/L5, 3 Med fixed (authoritative lifecycle vs DB status, archived_at coupling, dedicated isMarkupBp), 1 dismissed, 4 deferred; security clean.
2. 5-2 calculation-editor-ux-for-sections-and-rows â€” landed (review): list+editor UI, 55 unit + 12 E2E; Tier-A: Changes Requested, C0/H0/M3/L2, 2 Med fixed (section reorder wired, no fabricated 0,00 kr), 1 Med decision deferred to 5-4 (delivered there), 2 deferred; security clean.
3. 5-3 pricing-source-selection-and-row-snapshots â€” landed (review): source_* snapshot columns (no FK â€” freeze survives archive), source select UI; Tier-A: Approve, C0/H0/M0/L1 deferred, 3 dismissed; security clean.
4. 5-4 calculation-readiness-review-and-snapshot-preview â€” landed (review): readiness classifier + PreQuotePreview + tenant VAT-posture resolution (closed both 5-2 deferrals); Tier-A: Changes Requested at Low only, 1 Low fixed (posture-aware preview totals), 1 deferred, 3 dismissed; security clean.
5. 5-5 calculation-golden-tests â€” landed (review): tests-only golden pack (17-case calc-rows.json + 14 live-oracle tests + 5 coverage companions); Tier-A: Approve, 1 Low record-fix, 2 deferred, 1 dismissed; security clean.

**Skipped (already done):** (none)

**Integration review:** Tier B (chunked: 5 story chunks + fixes chunk; 2 reviewers Ã— 3 lenses per chunk + 1 epic-wide security pass per iteration; 68 lens delegates total): iter 1 â€” ~300 raw â†’ 13 survivors (C0/H0/M3/L2 open + 8 Low deferred), all 5 fixed; iter 2 â€” ~90 raw â†’ 2 survivors (1 Med fixed: update-path source-kind cross-check; 1 Low deferred). Gate: exit-clean, converged, convergence_unverified=false. Security: 0 findings in both iterations.

**Epic gate:** trace PASS (26/26 requirements FULL, P0 15/15, P1 8/8; all 11 high-priority risks mitigated, all 8 non-negotiable blockers met); NFR PASS advisory (6 PASS / 2 standing CONCERNS: no pnpm-audit CI gate + no coverage reporter â€” a FOUR-epic carry flagged for forced schedule-or-accept); test-review 90/100 (A, Approve; 0 HIGH violations).

**TEA:** epic test design (16 risks, 38 test IDs) at E2; per-story triage high/med/high/med/high; ATDD red scaffolds for 5-1/5-3/5-5 (5-5 as sanctioned no-skip structural scaffold), automate expansion on all 5 stories (+~90 tests); epic-end gates as above. Trace advisory dormant (5-story epic < min 6).

**UAT:**
1. SETUP: tenant with customer(+facility/contact), active work role + article, quote terms configured; sign in as tenant_admin
2. Signed out: /calculations and /calculations/<id> redirect to /login, no data flash
3. Nav shows exactly seven Phase A items (no field-worker/project/ATA/supplier/AI); Kalkyler -> /calculations
4. List shows Kalkyler heading, Ny kalkyl button, rows with title/customer/status pill
5. Ny kalkyl with blank Titel -> field error, input preserved; with unique Titel + customer -> lands on the new editor
6. Unknown calc id -> generic 'hittades inte/ej atkomst' (never reveals cross-tenant existence)
7. Spara titel -> 'Kalkylen har sparats.', title survives refresh
8. Editor shows header (title+status pill), customer context, section cards, Summering panel
9. Summering shows Netto/Moms/Totalt in kronor (Swedish comma) + Standardvy caption; no ore/bp jargon anywhere in row editing
10. Wide window -> sticky right panel; narrow -> stacks inline, no overlap
11. Row form: Radtyp/Antal/Enhet/Kostnad/Pris/Paslag/Moms/3 flags/Etikett/Beskrivning/Intern notering/Notering i offert
12. Add Material row 3 x 100,00 kr, 25% -> 'Raden har sparats.', Radsumma 375,00 kr
13. Pris -50 -> validation error, input preserved; Paslag 150% ACCEPTED (markup validator allows >100%), invalid Paslag rejected
14. Dold rad on->save->off->save -> flag genuinely off after refresh
15. Edit Antal/Pris -> Summering + Sektionssumma refresh
16. Radsumma qualifier posture-aware: '(inkl. moms)' private/togglable, '(exkl. moms)' company_excl tenant
17. Ta bort rad -> removed without confirm
18. Labor row 'Prislista (arbetsroll)' offers Manuell + seeded role, NO supplier/import/Fortnox option; select -> price prefills (editable) + provenance line
19. Overtype prefilled price 900 -> typed value saved (prefill-not-lock)
20. Radtyp Arbete -> Maskin -> source select disappears; back -> returns (stale pick resets to manual)
21. Material row 'Prislista (artikel)' -> seeded article, prefill + provenance
22. Source back to Manuell -> saves, provenance gone (fully cleared); fresh manual row saves with no provenance
23. Rename/re-rate the source work role, reopen calc -> row provenance UNCHANGED (frozen copy-by-value)
24. Page scan: no leverantor/supplier/fortnox/import/synk/API/credential/faltarbetare/ATA/AI label
25. Lagg till sektion -> new card; sections + rows reorder via arrows (ends disabled), order survives refresh
26. Ta bort sektion with rows -> confirm dialog (Avbryt keeps / Ta bort deletes); empty section deletes without confirm
27. Set Visningslage Sammanfattad / Endast text per section (drives preview modes)
28. Readiness 'Kontroll infor offert' panel: red blockers separated from amber warnings
29. Healthy calc -> no blocker group, 'Skapa offertversion' ENABLED, warnings still listed
30. Warning wording: no-price row / labor without role / cost-set margin <15% (blank cost = unknown, NO false low-margin) / empty section / counted hidden row disclosure / always-on required-files deferral
31. Engine-overflow total -> Summering shows 'Totalsumman kunde inte beraknasâ€¦' (NOT 0,00 kr), red blocker group, button DISABLED
32. 'Skapa offertversion' toggles the preview open/closed (no quote created)
33. Preview: Kund block (customer + Anlaggning/Kontakt or â€”); Sektioner per display mode (text_only note / summary note / detailed rows)
34. Preview detailed rows: 'dold (raknas med)' and 'tillval (vald)/(ej vald)' badges match state
35. Preview Summering: Netto/Moms/Totalt + Momsvisning caption; company_excl emphasizes Netto, else Totalt
36. Preview Skatteantaganden: 'Inga ROT-/gron teknik-antaganden pa kalkylen.'
37. Preview Offertvillkor: terms text (+ amber not-approved note) or 'Inga offertvillkor angivna annuâ€¦'
38. Preview Bifogade filer: files-deferred note; Anmarkningar repeats the readiness warnings
39. 'Skapa offert' panel always shows the new-version-after-send note
40. Arkivera kalkyl -> gone from active list, editor id -> generic not-found (archive-over-delete)
41. NOT UI-reachable (server/tests only, intentionally excluded): material-row-with-work-role-source rejection (INT-tested), MISSING_CUSTOMER blocker, ROT/gron TAX_SIGN_OFF warning (unit-pinned; Epic 6 owns the inputs)

**Overrides:** none

**Open questions:**
1. Owner sign-off backlog (8 Epic-4 tax items + Epic-5 calc items: inclusion pin as pilot policy, blocker-vs-warning split, persons flat cap R-512, new-version copy, margin threshold value) â€” route to a working session BEFORE Epic 6 ships customer-visible quotes
2. Margin threshold ships as PILOT_LOW_MARGIN_THRESHOLD=0.15 constant â€” confirm value + whether to add the company_settings column (gated migration)
3. 5-1 conservative defaults taken: lifecycle status set draft/ready/archived, section display_mode set, markup stored as markup_bp â€” confirm at the epic session

**Deferred work:**
1. 10 review deferrals logged this epic (4 from 5-1, 2 from 5-2, 1 from 5-3, 1 from 5-4, 2 from 5-5) + 9 from the epic integration review (8 iter-1 + 1 iter-2) â€” all Low except 3 Med (numeric-only oldLovableWouldGive guard; epic-4 carryovers), each with a named owner in deferred-work.md
2. required-file readiness check gated on Story 8.1 (ships as REQUIRED_FILES_DEFERRED warning, R-513)
3. configurable per-tenant margin threshold (settings column, gated migration)
4. calc tax-context forward-seam (hasDeductionAssumption:false) â€” Epic 6
5. explicit section/row duplicate verb + markup-derived sell â€” future editor polish
reconcile marked 3 missed-completions with file evidence (tsconfig INT/E2E re-enrollment â€” typecheck green with excludes gone; tenant default_vat_display posture resolution â€” vat-posture.ts via 5-4; posture-aware row line-total label â€” RowEditor via 5-4); archive moved those 3 to deferred-work-resolved.md (ledger 74 â†’ 71 entries)

**Auto-decided (epic mode):**
1. Lifecycle state machine not authoritative (currentStatus never loaded from DB) [Med] â†’ fix: validate transition against the row's real DB status in updateCalculation (Tier A, 5-1)
2. status/archived_at can silently disagree [Med] â†’ fix: resolved with the state-machine fix â€” archivedâ†’active blocked (Tier A, 5-1)
3. markup_bp capped at 100% by reusing isVatRateBp [Med] â†’ fix: dedicated isMarkupBp + updated pinning test (Tier A, 5-1)
4. updateCalculation cannot re-point facility/contact [Low] â†’ dismiss: Phase-A narrowing; composite FK backstops INSERT; 5.2+ can add re-pointing (Tier A, 5-1)
5. Tenant default_vat_display ignored; posture hard-coded to company_togglable [Med] â†’ defer: full posture resolution is Story 5.4's surface â€” DELIVERED by 5-4 (Tier A, 5-2)
6. readCalculationDetail swallows customer/facility/contact read errors [Med] â†’ fix: check .error and return the generic read-error state (E_review iter 1, epic-5)
7. rowMarginRatio null-cost = 100% margin + redundant *quantity [Med] â†’ fix: cost-unknown returns null, no false margin (E_review iter 1, epic-5)
8. Source-kind cross-check incomplete on update path [Med] â†’ fix: loadRowType under caller RLS + kindForRowType re-check in updateRow.execute (E_review iter 2, epic-5)

**Planning drift:** (none â€” architecture held exactly as planned for a third consecutive epic; the Story 8.1 dependency is pre-existing sequencing, not drift)

**⚠️ Needs human:**
1. (optional) merge the open epic PR on your own time â€” the epic is already done at BMAD level
2. (optional, flagged by the retro) force the pnpm-audit CI-gate decision to resolution (land the gate or a dated accept) before Epic 6 closes â€” fourth consecutive carry
3. (optional) schedule the owner/accounting/legal sign-off working session before Epic 6

**Next:** Epic 6 (quote versions/PDF/acceptance) per the approved plan â€” /auto-bmad epic --epic 6; preview only, not started
