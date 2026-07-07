# auto-bmad epic report log — epic-8

## Report — 2026-07-07T16:07:21Z (final)

**Epic:** `8` — 5 stories.
**Branch:** `epic/8-required-files-and-private-storage` (HEAD `d17dc13`).
**Pipeline status:** ✅ clean completion — 4 stories landed on one epic branch; Tier-A thin reviews clean, Tier-B integration review converged in 2 iterations (0 open findings), trace gate PASS; PR opens non-draft (CI verdict resolves post-push and is reported in chat)
**Continues:** (none — first run)

**Summary:** Epic 8 'Required Files And Private Storage' completes the Phase A file domain on top of 8-1's shipped foundation: story 8-2 added the validated upload command (server-side MIME/size/owner/lifecycle gate, four distinct error states, archive-over-delete compensation) and EntityFilePanel across all six active owner types; 8-3 added the tenant-authorized preview/download affordance with an expiry→refresh loop that re-runs full command authorization on the proven 8.1 signing funnel; 8-4 delivered the file-side lock family — SQLSTATE FL823 joining the frozen QV409/AR704 family via three lock-apply and two immutability triggers plus the archive-only archiveFile command; 8-5 shipped the limited /files index (search, seven Phase A categories, display-safe rows), lock-aware panel affordances, and the read-only CommitmentFilesPanel. The Tier-B integration review's fix pass additionally hardened revalidation (client revalidate_path removed in favor of server-derived routes) and unified signed-link expiry across surfaces. No new tables/columns/policies; one additive migration (the FL823 triggers).

**Timing:** started 2026-07-07T10:02:38Z; completed in progress — elapsed 6h 04m (≈5h 39m AI-run, ≈25m human/idle wait).

**Stories:**
1. 8-2-validated-upload-and-entity-file-panels — landed (upload command + panels on six owner types; unit 1152→1172, INT 658 incl. 16 new upload tests). Tier-A: Changes Requested → fixed; Critical 0 / High 0 / Medium 3 / Low 1; security 0 findings; 1 Med Decision auto-resolved (fix); post-fix 0 open.
2. 8-3-tenant-authorized-signed-file-access — landed (preview/download + expiry→refresh reauth on the 8.1 funnel; unit 1189, signed-access/storage INT 19). Tier-A: Approve; Critical 0 / High 0 / Medium 0 / Low 3 (all deferred to ledger); security 0 findings; 0 auto-decisions.
3. 8-4-quote-pdf-attachment-and-acceptance-evidence-locks — landed (FL823 lock family: 3 lock-apply + 2 immutability triggers, additive migration, archiveFile archive-only-delete; 1896 tests, 0 skipped). Tier-A: Approve; Critical 0 / High 0 / Medium 2 / Low 2 (2 deferred); security 0 findings; 2 Med Decisions auto-resolved (1 fix — test-title honesty, 1 dismiss).
4. 8-5-limited-file-index-and-file-audit-within-phase-a-scope — landed (/files limited index + lock-aware affordances + CommitmentFilesPanel; unit 1237; RLS/audit INT live-verified). Tier-A: Approve; Critical 0 / High 0 / Medium 2 / Low 0 (2 Med Decisions auto-resolved, both dismiss); security 0 findings.

**Skipped (already done):** 8-1-file-storage-foundation-private-bucket-metadata-links-rls-and-signed-access-command — already done before this run (in main); skipped by E0 adopt, not in the batch-flip set

**Integration review:** Tier B ran chunked (epic diff 9683 lines > 6000 threshold): 2-reviewer roster (ab-deep primary + ab-alt-deep secondary) × 3 lenses × 4 story chunks + a single whole-epic security pass, joint triage. Iteration 1: ~170 raw findings deduped to 7 surviving (Critical 0 / High 1 / Med 2 / Low 4) — 1 Med Decision auto-resolved per triage recommendation (client revalidate_path removed; server-derived route allow-list), 1 Low Patch fixed (/files expiry re-open control), 5 deferred to the ledger (incl. the High acceptance-evidence upload-gate residual, owner-accepted under demo-data-only), 9 noise dismissed; 13 new tests. Iteration 2 (fresh pass over the changed tail chunk + fresh whole-epic security; unchanged chunks carried their iter-1 lens outputs): Approve — 0 new findings, both fixes independently re-verified by two auditors + security (0 HIGH/MED/LOW). Loop gate: exit-clean, converged, convergence_unverified=false. No halt (epic mode auto-continues).

**Epic gate:** Trace gate PASS — P0 100% (16/16), P1 100% (10/10), 26/26 ACs FULL across 8.1–8.5; all 11 high-priority risks mitigated. Advisory NFR: PASS (8 PASS / 1 CONCERNS — absent line-coverage reporter, standing R-821 carry since Epic 2). Advisory test-review: 93/100 Grade A (0 HIGH, 2 MED refinements noted).

**TEA:** Per-story triage: all four stories high-risk → atdd + automate each (trace-advisory dormant — 5-story epic below the 6-story long-epic gate). ATDD red scaffolds drove every implementation to green (8-2 with zero assertion changes). Epic-end gates as above; epic-level test design refreshed at E2 (22 risks, 7 controls reclassified MITIGATED by 8-1 evidence).

**UAT:**
1. (Setup) Bring up the local stack and seed: supabase start && supabase db reset (kong 502 → docker restart supabase_kong_ElproSaas); seed via Playwright global-setup (e.g. pnpm test:e2e --grep file-lock-panel) which writes adminA creds + sent-quote/accepted-acceptance/CRM-file ids to tests/e2e/.auth/fixture.json; then pnpm dev (no signup UI or standalone seed script exists)
2. (Setup) Sign in at /login with fixture.adminA email/password → redirected into the app shell (/dashboard), no auth error
3. (Upload) Open /customers/{customerId} → 'Filer' panel shows owner name, purpose 'Kunddokument', allowed types (PDF, PNG/JPEG/WebP/GIF, text/CSV, Word, Excel), max 25 MB, a file input — and NO path/bucket/tenant field
4. (Upload) Select a valid PDF < 25 MB, click 'Ladda upp fil' → green 'Filen laddades upp.' and the file appears under 'Uppladdade filer' with name and size
5. (Upload) Reload the customer page → the uploaded file persists in the list (own-tenant only)
6. (Upload) Select a blocked-type file (.exe or .html) → distinct blocked-type alert (testid file-error-blocked-type) 'Filtypen stöds inte…' immediately on selection, before any upload
7. (Upload) Select an allowed-type file > 25 MB → distinct too-large alert (testid file-error-too-large) 'Filen är för stor…'
8. (Upload) On a customer with facilities/contacts → each renders its own 'Filer' panel; upload on one facility panel → the file appears under that facility's list only
9. (Upload) Open /calculations/{calculationId} → 'Filer' panel with purpose 'Kalkylbilaga'; upload a valid PDF → success + listed
10. (Upload) Open /jobs/{jobId} → 'Filer' panel with purpose 'Jobbunderlag'; upload a valid PNG/JPEG → success + listed
11. (Upload) Open an ACCEPTED quote version at /quotes/{quoteId}/versions/{versionId} → acceptance-evidence 'Filer' panel (purpose 'Acceptansunderlag'); upload a valid PDF → success + listed; a non-accepted version renders no acceptance panel
12. (Preview) Any panel row shows the file by display name with an 'Öppna fil' button and NO raw storage path / object_path / bucket_id anywhere
13. (Preview) Click 'Öppna fil' → brief 'Öppnar…' then an 'Öppna fil (tidsbegränsad länk)' link; clicking opens the file in a new tab; the row button now reads 'Öppna igen'
14. (Preview) Inspect the signed-link href → a Supabase signed storage URL with a token/expiry param (never a public bucket URL or client-supplied path)
15. (Preview) Let the link age past TTL (default 300s; SUPABASE_SIGNED_URL_TTL_SECONDS=5 to observe fast) → row flips to 'Länken har gått ut.' with a re-open control; the stale link element is gone
16. (Preview) Click the re-open control → a fresh link with a NEW token (retry re-ran full authorization, not a re-served URL)
17. (Preview) Archive a listed file mid-flight (SQL: set files.lifecycle_state='archived' without reloading), then re-open → link NOT re-issued; generic role=alert error, no raw storage error or path
18. (Preview) Devtools: edit a row's hidden file_id to another tenant's id, then a random non-existent UUID → IDENTICAL generic Swedish denial either way (no existence disclosure, no path leak)
19. (Preview) Confirm identical per-file 'Öppna fil' behavior on a calculation, a job, and an accepted quote version (shared row on every surface)
20. (Index) Click 'Filer' in the nav (→ /files) → page renders; the seeded CRM file appears with a category badge, mime/size line, and 'Uppladdad:' date
21. (Index) Rows show ONLY display-safe metadata (name, category, MIME, size, date) — no storage path, bucket id, or object key
22. (Index) Type part of a file name into 'Sök' → list narrows in real time; clearing restores
23. (Index) 'Kategori' dropdown lists ONLY the seven Phase A categories + 'Alla kategorier' — no Fortnox/HR/uthyrning/tillgångar/DoU/upphandling grouping
24. (Index) Category 'Offert' → only quote-linked files; 'Kund' → only customer files; empty category → 'Inga filer matchar…'
25. (Index) 'Förhandsgranska' on a row → signed time-limited link opens in a new tab; if the link ages out while mounted, the row flips to 'Länken har gått ut.' + a re-open control (same expiry contract as entity rows)
26. (Lock/Archive) On /customers/{companyId}, the UNLOCKED CRM document row shows preview + 'Ersätt (ladda upp ny fil)' + 'Arkivera fil' — and NO delete control
27. (Lock/Archive) Click 'Arkivera fil' on the unlocked file → 'Arkiverar…' then disabled 'Arkiverad'; after refresh the file is gone from both the panel and /files
28. (Lock/Archive) Open /quotes/{sentQuote.quoteId} (sent version selected) → 'Offertfiler (låsta)' panel with the amber lock notice (text, not color alone: låst because the offer is sent — archivable, not replaceable/deletable); the locked PDF row shows 'Arkivera fil' and NO replace/delete
29. (Lock/Archive) Open /quotes/{acceptedAcceptance.quoteId} (accepted version) → evidence file shows the evidence-lock-notice (låst — acceptance registered); archive-only, no replace/delete
30. (Cross-cutting) Keyboard-only pass on /files and the locked panels → Tab reaches search/filter/preview/archive with visible focus rings; Enter/Space activates
31. (Cross-cutting) Cross-tenant isolation: /files shows ONLY tenant-A files as adminA; a crafted foreign file_id through a preview/archive form → generic Swedish permission error, no existence leak; an orphan user (no membership) sees no tenant-A files
32. (Cross-cutting) Server-bypass gate: POST an upload form directly with an oversized allow-listed file or a foreign/crafted owner_id → rejected server-side (object never becomes a listed file); foreign owner_id and non-existent UUID both return the identical generic permission alert (testid file-error-permission). Note: the client revalidate_path field no longer exists — revalidation routes are server-derived (DB-layer 8-4 lock checks are suite-verified: SUPABASE_TEST_REQUIRED=1 pnpm test:int + pnpm test:unit)

**Overrides:** none

**Open questions:**
1. Final owner-approved MIME/size upload policy (R-817) — deferred to Wave-2 create-story (demo-data-only decision); conservative defaults shipped
2. Optional file-index build/skip call (R-816) — resolved in-run: BUILT the limited Phase-A index per the documented 2026-06-18 owner decision + three 8.2–8.4 deferrals landing there
3. Acceptance-evidence upload lifecycle gate (High, demo-data-accepted) — needs an owned follow-up or explicit re-score at Epic 9's pilot-readiness gate (epic retro)
4. Epic-7 carries: DB-level evidence-exclusivity XOR constraint still untouched; draft→linked lifecycle-state gap + non-transactional PDF-metadata insert closure unconfirmed (no story record reports them fixed)

**Deferred work:**
1. [High] Acceptance-evidence upload gate — new evidence can still be attached to a committed acceptance; owner-accepted under demo-data-only, ledgered at 'epic review of epic-8' (the 8-2→8-4 deferral hop failure)
2. [Med] N+1 file-panel read fan-out on the customer page — pilot-scale accepted, ledgered
3. [Low] R-817 magic-byte content sniffing (client-declared MIME today; fail-closed allow-list is the enforced guarantee) — owner-gated
4. [Low] archiveFile(hardDelete:true) returns FILE_LINK_LOCKED even for an unlocked file — crafted-request-only; distinct code later
5. [Low] 8.3 expiry→refresh E2E stays test.fixme — needs a low-TTL E2E env or deterministic clock seam (INT/unit-proven)
6. Per-story Tier-A deferrals recorded in each story's Review Findings + the ledger (8-3: three test-teeth follow-ups; 8-4: byte reclamation R-818, correction workflow R-714; 8-5: minimal replace-anchor)
Phase 8 reconcile marked 1 missed completion (8.4 file-lock-panel E2E test.skip — resolved in Story 8.5's un-skip, evidence: FilePreviewRow/CommitmentFilesPanel testids green); archived 1 resolved entry → deferred-work-resolved.md. 24 other resolved-hints judged false positives ('auto-resolved …: defer' phrasing) and kept.

**Auto-decided (epic mode):**
1. Server 're-derives' MIME from client-declared File.type, not bytes [Med] → fix: correct the misleading comments (client-declared File.type + fail-closed allow-list); no magic-byte sniffing now; byte-sniffing logged as owner-gated R-817 follow-up (Tier A, 8-2)
2. AC4 'mid-flow fault' asserted by over-titled test [Med] → fix: rename to lock-precision + cite 8.4-RLS-04 as the atomic-by-construction AC4 proof; no fabricated fault-injection (Tier A, 8-4)
3. AC3 literal target_type='file_link' not implemented [Med] → dismiss: file-only archive satisfies AC3's file_link/file disjunction (links cascade on file archive, deviation documented); standalone archiveFileLink is 8.5 scope (Tier A, 8-4)
4. AC4 gates on DB file.isLocked instead of the AC-named pure predicates [Med] → dismiss: DB is_locked is the story's own PREFERRED authoritative lock source (Task 2.1); keep as-is (Tier A, 8-5)
5. archive-file affordance renders on every listed file incl. unlocked [Med] → dismiss: AC4's MAY permits unlocked-file archive; command gates own-tenant only; reasonable safe UX (Tier A, 8-5)
6. Client-supplied revalidate_path [Med] → fix: derive the revalidation route server-side from resolved ownerType/ownerId and ignore the client field (implemented as structured UUID-validated parent-id fields + closed route allow-list) (E_review, epic-8)
7. Note: all Tier-A decisions were resolved with per-story context only; no Critical/High auto-decision occurred (no draft forced)

**Planning drift:** none — the retrospective's significant-discovery check confirmed Epic 8's scope, dependencies, and architecture matched epics.md (single-file-model, two-plane-RLS, dual-layer-lock all held); the acceptance-evidence gap is a within-epic deferral-routing failure, not planning drift

**⚠️ Needs human:** (none)

**Next:** Epic 9 — its dependency set (per the retro) is now genuinely complete; a fresh /auto-bmad run would pick epic 9's first actionable story
