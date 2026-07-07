# Story 9.1: Legacy Record Classification And Migration Runbook

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a pilot operator,
I want to classify Lovable records by Phase A treatment,
so that the pilot migrates only what is needed and keeps old-app fallback explicit.

## Acceptance Criteria

1. **Given** legacy Lovable records, **when** classification is performed, **then** each selected record group is classified as **live for pilot**, **archive-only**, **excluded**, or **deferred**, **and** deferred-module records do NOT become Phase A production tables or UI. [Source: epics.md#Story 9.1; architecture.md#16; PRD FR55/NFR22; test-design-epic-9.md 9.1-CLASS-01]
2. **Given** the migration runbook, **when** a pilot workflow is prepared, **then** it documents **source records**, **target treatment**, **fallback path**, **manual-backfill risks**, and a **cutover-by-workflow decision** (cutover is per-workflow, never whole-company). [Source: epics.md#Story 9.1; architecture.md#16; PRD FR58/NFR21; test-design-epic-9.md 9.1-RUNBOOK-01]
3. **Given** the runbook is reviewed, **when** scope is unclear, **then** it **STOPS for owner clarification** (an explicit "scope-unclear → STOP" marker) rather than silently importing extra history. [Source: epics.md#Story 9.1; PRD NFR22; test-design-epic-9.md 9.1-STOP-01; R-907]

**Non-AC hard constraint (epic blocker, R-902 / 9.1-PRIV-03):** No real PII — real names, emails, phone numbers, addresses, personnummer, organization numbers, secrets, or raw customer data — may appear in `docs/migration/**` or any committed log/prompt. Use redacted/synthetic examples only. [Source: PRD NFR17; project-context.md#Lovable Oracle Policy; test-design-epic-9.md R-901/R-902, 9.1-PRIV-03]

## Tasks / Subtasks

- [x] Task 1: Create the `docs/migration/` home and the migration runbook skeleton (AC: 1, 2, 3)
  - [x] 1.1 Create `docs/migration/` (it does NOT exist yet — architecture §16 names it as the canonical home for "classification, deltas, and fallback notes"). Author the primary runbook doc there (e.g. `docs/migration/migration-runbook.md`) plus a classification register (e.g. `docs/migration/legacy-record-classification.md`), OR a single well-sectioned file — pick one home and cross-link, do NOT duplicate the same content in two places. Keep everything **docs-only** — this story writes NO migration script, NO `scripts/migration/**` asset, NO `supabase/migration`, and runs NO production data mutation (Technical Note; architecture §16 reserves `scripts/migration/**` for "approved, testable data capture/reset scripts WHEN a migration story exists" — this is NOT that story). [Source: architecture.md#16; epics.md#Story 9.1 Technical Notes]
  - [x] 1.2 State phase + scope + mode at the top per the BMAD Output Discipline: **Phase A, docs-only**, migration/coexistence control point. Mark every classification decision as `live` / `archive-only` / `excluded` / `deferred` and every treatment item as `IN` / `DEFERRED` / `SEAM` where relevant; separate assumptions from decisions; link back to the baseline plan + architecture §16/§17. [Source: project-context.md#BMAD Output Discipline]
  - [x] 1.3 Reference **architecture §-anchors** (architecture §16 Migration And Coexistence, §17 Golden-Master Fixture Strategy), NOT plan positions like "Epic 9 / Story 9.2", in the evergreen doc body — hardcoding plan numbers into durable docs is a known staleness risk (R-922). A one-time provenance line ("authored by the 9.1 migration story") is fine; recurring in-body "Epic N/Story X-Y" cross-refs are not. [Source: project-context.md#Code Quality Rules; test-design-epic-9.md R-922, 9.x-DOC-01]
- [x] Task 2: Classify the legacy Lovable record groups (AC: 1)
  - [x] 2.1 Enumerate the Lovable legacy module/record groups from the behavioral-oracle inventory (`docs/oracle/initial-system-audit-2026-06-01.md` — 107 detected application tables across customers/CRM, calculations, quotes, jobs/projects, time planning, rentals, assets, electrical panels, articles/supplier data, service, warranties, documents/file_index, DoU, self-inspections, tenders/FKU, KNX, HR, notes/board, admin, notifications/email, AI-parsing flows). Do NOT copy Lovable code or import its schema — it is a behavioral oracle only (AR26). [Source: docs/oracle/initial-system-audit-2026-06-01.md; project-context.md#Lovable Oracle Policy; AGENTS.md]
  - [x] 2.2 Classify each group into exactly one of the four buckets, aligned to the Phase A product boundary:
    - **live for pilot** — the Phase A workflow surface that is actually rebuilt and pilot-usable: CRM (customers/facilities/contacts), company settings + quote terms + pricing (work_roles/articles), calculations, quote versions/PDF/acceptance, basic job/order, required files. These map to the twenty-four IN-scope tenant-owned tables the new system already ships.
    - **archive-only** — historical records kept for reference/fallback but NOT actively edited in the pilot (read-only historical quotes/jobs for continuity).
    - **excluded** — record groups intentionally not carried at all.
    - **deferred** — every deferred-module surface (Fortnox, field-worker UX, supplier APIs/integrations, AI/document-parsing jobs, HR/personnel, rentals, assets/QR, electrical panels/KNX, service/warranties, DoU automation, tender/FKU RAG, notifications/email infra, full RBAC, customer portal, broad document center/analytics). **A deferred group MUST NOT be mapped to a live Phase A table or UI** — this is the AC1 hard constraint and the R-907 over-migration guard. [Source: AGENTS.md; project-context.md#Product Boundary; architecture.md#16; epics.md#Epic 9 Explicit non-scope; test-design-epic-9.md R-907, 9.1-CLASS-01]
  - [x] 2.3 For each classified group, record: source-record description (redacted/synthetic, never a real value), target treatment (which Phase A table/workflow OR "none — deferred/excluded"), and a one-line rationale tying to the product boundary. A group whose real record selection is owner-gated (the pending `8.1`/`8.2` möte items) is classified STRUCTURALLY (bucket + rationale) but its concrete record selection is marked owner-pending (see Task 3.2 / Task 4). [Source: owner-signoff-questions.md#8.1/8.2; architecture.md#16]
- [x] Task 3: Author the per-workflow migration runbook + fallback + cutover decisions (AC: 2, 3)
  - [x] 3.1 For each Phase A pilot workflow (CRM → settings/pricing → calculations → quote versions/PDF/acceptance → job/order → required files), document: **source records** (which Lovable data feeds it), **target treatment** (live-rebuilt vs archive-only), **fallback path** (the Lovable app stays the behavioral oracle + fallback for that workflow until its pilot acceptance gate passes — NFR21), **manual-backfill risks** (what a human would have to re-enter by hand and where that can go wrong), and a **cutover-by-workflow decision** (cutover is per-workflow, never whole-company — architecture §16). [Source: architecture.md#16; PRD FR58/NFR21; epics.md#Story 9.1 AC2; test-design-epic-9.md 9.1-RUNBOOK-01, 9.4-FALLBACK-01]
  - [x] 3.2 Add an explicit **"scope-unclear → STOP for owner clarification"** protocol section AND inline STOP markers wherever a real decision is owner-gated. The runbook must fail-closed on ambiguity: an unclear/owner-pending item is a STOP, NOT a silent default-import. Concretely, the **real migration classification (`8.1`) and golden-example selection (`8.2`) are BOTH owner-pending (`öppen (möte)`)** in the sign-off register — the runbook documents the classification STRUCTURE and buckets but marks the concrete real-record selection as owner-clarification-required, and states plainly that any **real customer data export/import is a hard STOP requiring owner sign-off**. [Source: owner-signoff-questions.md#8.1/8.2, Working session agenda D; epics.md#Story 9.1 AC3 + Stop Conditions; test-design-epic-9.md 9.1-STOP-01, R-907]
  - [x] 3.3 Record the demo-data-only posture explicitly: the pilot runs on disposable, obviously-fake demo data through MVP (owner decision 2026-07-03); the migration/classification/fallback decisions gate REAL-customer/real-pilot cutover but are non-blocking for the demo track. Do NOT conflate the two tracks. [Source: MEMORY (demo-data-only, tax sign-off deferred); project-context.md#Development Workflow Rules; test-design-epic-9.md Assumptions #1, R-905]
  - [x] 3.4 Point the runbook at the approved asset locations (architecture §16) as SEAMS for the later Epic-9 stories WITHOUT building them here: anonymized structured fixtures → `tests/fixtures/golden/lovable/**` (9.2); comparison tests → `tests/golden/**` / the existing `tests/unit/**` golden pins (9.3); classification/delta/fallback docs → `docs/migration/**` (this story); approved capture/reset scripts → `scripts/migration/**` (only when a real migration story lands, NOT here). Note that `tests/fixtures/golden/lovable/**` and `scripts/migration/**` do NOT exist yet — reference them as forthcoming, do not scaffold them. [Source: architecture.md#16; test-design-epic-9.md R-919, 9.x-PATH-01]
- [x] Task 4: PII / privacy hygiene sweep on the authored docs (AC: 1, 2, 3; epic blocker R-902)
  - [x] 4.1 Every example in `docs/migration/**` MUST be redacted or synthetic — NO real name, email, phone, address, personnummer, organization number, secret, or raw customer value. Where a personnummer/orgnr example is illustratively needed, use an obviously-fake placeholder (e.g. `YYYYMMDD-XXXX`, `XXXXXX-XXXX`) that a PII scan cannot mistake for real data. Note the standing scan constraint: a bare 10-digit run reads as an orgnr to the anonymization scan (R-914) — keep illustrative numeric strings non-10-digit or clearly masked. [Source: PRD NFR17; project-context.md#Lovable Oracle Policy + Testing Rules (ORGNR 10-digit scan); test-design-epic-9.md R-901/R-902/R-914, 9.1-PRIV-03]
  - [x] 4.2 Self-verify: grep the new docs for personnummer-shaped (`\d{6,8}[-\s]?\d{4}`), orgnr-shaped (bare `\d{10}`), email (`@` non-`example.test`), phone, and secret/`api_key`/`password` patterns; confirm zero real hits. Record the check in the Dev Agent Record. (No new automated privacy-scan test is built HERE — the whole-fixture-set scan is Story 9.2's deliverable, 9.2-PRIV-01; 9.1's obligation is that its OWN docs are clean, proven by the manual scan.) [Source: test-design-epic-9.md 9.1-PRIV-03 (docs-scan over `docs/migration/**`), 9.2-PRIV-01 (the automated scanner is 9.2)]
- [x] Task 5: Verify (docs-only; AC: 1, 2, 3)
  - [x] 5.1 Docs review: re-read the runbook as a fresh pilot operator — every one of the four buckets is used, every deferred group maps to "no Phase A table/UI", every pilot workflow has source/treatment/fallback/backfill-risk/cutover fields, and the scope-unclear STOP protocol is present and unambiguous. [Source: epics.md#Story 9.1 Test Requirements; test-design-epic-9.md 9.1-CLASS-01/RUNBOOK-01/STOP-01]
  - [x] 5.2 Scope-guardrail sweep: confirm NO product code touched (`git diff src/ supabase/ package.json pnpm-lock.yaml` empty), NO dependency added, NO `.env` edited, NO `scripts/migration/**` or `supabase/migration` created, NO deferred-module table/route/nav item introduced (nav-items.ts still exactly seven), NO real customer data exported. [Source: epics.md#Story 9.1 Stop Conditions; AGENTS.md; project-context.md#Critical Don't-Miss Rules]
  - [x] 5.3 State the skipped product gates: this is a **docs-only** PR — typecheck/lint/unit/build/migration-reset/int/RLS gates are not applicable (no product code, no schema) and are explicitly SKIPPED-WITH-REASON in the PR body per the quality-gate convention. Do NOT claim a product-gate green run that was not needed. [Source: docs/quality/ci.md; architecture.md#19; project-context.md#Development Workflow Rules]
  - [x] 5.4 Do NOT modify `owner-signoff-questions.md`, the deferred-work ledger, or any golden fixture in this story — the sign-off register is Story 9.4's system-of-record and the fixtures are Story 9.2/9.3's; 9.1 only REFERENCES them. (Sprint-status tracking update is expected and allowed.) [Source: test-design-epic-9.md 9.4-REG-01, Interworking table; scope discipline]

## Dev Notes

### Critical Constraints (read first)

- **Docs-only story — the migration/coexistence CONTROL POINT.** This story produces ONLY documentation under a NEW `docs/migration/` directory (the runbook + a classification register). It writes NO business logic, NO schema/migration, NO `scripts/migration/**` capture script, NO fixture, and runs NO production data mutation. Migration/Coexistence Impact is HIGH (this is where over-migration is structurally prevented), but the artifact is a decision doc, not product code. [Source: epics.md#Story 9.1 Technical Notes + Migration Impact; architecture.md#16]
- **`docs/migration/` does not exist yet — this story creates it.** Architecture §16 names it as the canonical home; the repo has no `docs/migration/` and no `scripts/migration/` today. Create the docs home; do NOT create the scripts home (reserved for a real, approved migration-script story that this is explicitly NOT). [Source: repo audit; architecture.md#16]
- **The four-bucket classification is a HARD contract — a deferred group MUST NOT become a Phase A table or UI.** This is AC1's second clause and the R-907 over-migration / Lovable-schema-as-blueprint guard. The new system ships exactly TWENTY-FOUR tenant-owned tables and SEVEN nav items; the runbook classifies Lovable's ~107-table surface DOWN to that Phase A boundary, never UP. Treating the Lovable schema as the new blueprint, or importing more history than the pilot needs, is the classic migration failure this doc exists to block. [Source: architecture.md#16; project-context.md#Architecture Rules (24 tables) + Framework Rules (7 nav items); epics.md#Epic 9 Risks; test-design-epic-9.md R-907]
- **Fail-closed on ambiguity — scope-unclear STOPS for owner clarification, never silent-imports (AC3, R-907).** The real classification (`8.1`) and golden-example (`8.2`) selections are BOTH owner-gated (`öppen (möte)`) and unanswered. The runbook must document the STRUCTURE and buckets while marking the concrete real-record selection owner-pending. **Any real customer data export/import is a hard STOP requiring human/owner approval** — do NOT invent or assume a real record selection to "complete" the doc; the deliverable-completing default here is a runbook whose owner-gated slots are explicitly STOP-marked, not filled in with fabricated decisions. [Source: owner-signoff-questions.md#8.1/8.2; epics.md#Story 9.1 Stop Conditions; test-design-epic-9.md R-907, 9.1-STOP-01]
- **Zero real PII in any committed doc/log/prompt (epic blocker, R-901/R-902).** Redacted/synthetic examples ONLY. A single real personnummer, orgnr, email, phone, address, or secret in `docs/migration/**` is a full privacy breach and an epic-blocker control regardless of numeric risk score. The Lovable oracle is inspected for BEHAVIORAL SHAPE, never quoted with real values. [Source: PRD NFR17; project-context.md#Lovable Oracle Policy; test-design-epic-9.md R-901/R-902]
- **Lovable is a behavioral oracle only — no code copy, no schema import (AR26).** Inspect screens/schema/behavior; classify; cite candidate reuse — but do NOT copy coupled React/Supabase code, import its generated architecture, or treat its 107-table schema as the target. [Source: AGENTS.md; project-context.md#Lovable Oracle Policy]
- **Stop Conditions (this story):** STOP and request human approval if full historical migration, real customer data export, or deferred-module activation is requested; or if the scope of what to migrate is materially ambiguous in a way that changes the outcome. [Source: epics.md#Story 9.1 Stop Conditions]

### Epic-9 retro constraints that apply to THIS story

Folded from `_bmad-output/auto-bmad/retro-notes/epic-9.md` (the epic-level test-design surfaced these; only the parts that bind 9.1 directly are pulled in — the numeric-guard-widening itself is a 9.2/9.3 code obligation, not 9.1's):

- **Golden `origin` discipline goes live this epic; NEVER fabricate an old-Lovable oracle value.** Today every committed golden is `origin: "new-expected"` (no anonymized Lovable oracle exists). 9.1 is docs-only and writes NO golden, but where the runbook references expected old/new behavior or golden examples it must NOT invent a Lovable oracle number — the real golden-example selection (`8.2`) is owner-pending, and fabricating a Lovable number is forbidden (AGENTS.md). Frame golden examples as forthcoming (9.2/9.3, owner-gated), never as concrete captured values. [Source: retro-notes/epic-9.md#epic-9 (golden origin discipline); project-context.md#Testing Rules; deferred-work.md 5-5 review (numeric LABELLING guard)]
- **Representativeness traps are P0 harness controls for 9.2/9.3 — 9.1 must not seed one.** Fictional `ReadinessCode` values and substring-token coverage manifests can green-pass a naive harness (R-903/R-904). 9.1 builds no harness, but if the runbook enumerates readiness/warning codes it must quote them from the REAL exported `ReadinessCode` union (`src/features/calculations/readiness.ts` — the real members include `TAX_SIGN_OFF_REQUIRED`, `REQUIRED_FILES_DEFERRED`, `HIDDEN_ROWS_INCLUDED`, plus the blocker/warning set `MISSING_CUSTOMER`/`TOTAL_UNCOMPUTABLE`/`LOW_MARGIN`/`UNRESOLVED_VAT`/…) — verify against that file, do NOT trust memory or a fixture — and NEVER use the fictional `REQUIRES_SIGN_OFF` / `DEDUCTION_ESTIMATE_UNAPPROVED` codes the quote-version golden fixture currently mis-pins, so the migration doc does not propagate a known representativeness trap. [Source: src/features/calculations/readiness.ts (ReadinessCode union); retro-notes/epic-9.md#epic-9 (R-903/R-904); project-context.md#Testing Rules (fictional ReadinessCode trap); deferred-work.md 6-1 review]

### Deferred-work items relevant to THIS story

Folded from `_bmad-output/implementation-artifacts/deferred-work.md` (only entries whose SUBJECT overlaps 9.1's migration/classification/pilot-readiness area — the rest of the ledger is out of scope and must NOT be reopened or re-deferred here):

- **Epic-8 pilot-readiness re-score triggers — REFERENCE (do not resolve here; they land in 9.4/9.5).** Epic 8's close named three owner-gated residuals that must be explicitly re-scored at Epic 9's pilot-readiness gate when real/pilot data flows: the acceptance-evidence-upload lifecycle gate (a demo-data-accepted High AC-miss), R-817 (MIME/byte-sniffing on uploads), and R-818 (locked-evidence retention). 9.1's runbook should NOTE these as workflow-level fallback/blocking considerations for the affected workflows (files/acceptance), but the CONSOLIDATION into the sign-off register + acceptance-gate is Story 9.4/9.5's job — 9.1 references them, does not close them. [Source: deferred-work.md (8-1 review; iteration-3 storage retention); epic-8 retro Documentation/Decisions #1; test-design-epic-9.md R-905/R-908]
- **R-513 required-file readiness is a documented placeholder pending real file wiring — REFERENCE for the required-files workflow's fallback row.** The calc readiness classifier surfaces `REQUIRED_FILES_DEFERRED` because the calc→required-file check is not yet wired. When the runbook documents the required-files workflow's target treatment + manual-backfill risk, note this as a live seam (manual required-file handling in the pilot), not a resolved capability. Do NOT wire anything — this is a docs reference only. [Source: deferred-work.md 5-4 (REQUIRED_FILES_DEFERRED); project-context.md#Calc-workspace rules]
- **Stale test-design "no personnummer" (R-009) vs the shipped access-controlled personnummer schema — awareness only.** The Epic-3 test-design still asserts personnummer-absence, but the owner decision (2026-06-18) is that private customers DO carry an access-controlled `customers.personnummer` (ROT requires it). If the runbook touches CRM classification, reflect the CURRENT owner-decided state (personnummer present for private, access-controlled, excluded from list, masked on detail, never in audit) — not the stale plan text. Do NOT edit the Epic-3 test-design (that reconcile is separately owned). [Source: deferred-work.md epic-3 review (R-009 divergence); owner-signoff-questions.md#Assumption change personnummer; project-context.md#Money/Tax/Quote Rules]

Everything ELSE in the ledger (money-engine hardening, calc/quote/file command hardening, golden-pack substring/manifest hardening, RLS-gate DX) is out of 9.1's scope — do NOT fold it in or reopen it.

### What already exists (reference, do not recreate)

- **The Lovable behavioral-oracle inventory** — `docs/oracle/initial-system-audit-2026-06-01.md` is the authoritative static audit of the Lovable app: 107 detected application tables across the full module list (CRM, calculations, quotes, jobs, time planning, rentals, assets, panels, articles/supplier, service, warranties, documents/file_index, DoU, self-inspections, tenders/FKU, KNX, HR, notes, admin, notifications/email, AI flows). Use it as the classification SOURCE (behavioral shape), never a code/schema source. [Source: docs/oracle/initial-system-audit-2026-06-01.md]
- **The Phase A product boundary + IN-scope surface** — the new system ships exactly the CRM/settings/pricing → calculations → quote versions/PDF/acceptance → job/order → required-files workflow across TWENTY-FOUR tenant-owned tables and SEVEN nav items. This is the "live for pilot" target the classification maps to. [Source: project-context.md#Product Boundary + Architecture Rules (24 tables) + Framework Rules (7 nav items); AGENTS.md]
- **The sign-off register** — `owner-signoff-questions.md` is the system-of-record. Items `8.1` (migration-klassning) and `8.2` (facit-exempel) are BOTH `öppen (möte)` (owner-pending). The tax Blocks A/B/C (rounding, VAT, ROT/grön rates/caps) are also `möte`-open. 9.1 REFERENCES these; 9.4 owns the register. [Source: owner-signoff-questions.md]
- **The demo environment** — `docs/process/demo-environment.md`: the live demo (Vercel `enhancior/elpro-saas` + Supabase `elprosaas-demo`) runs disposable, obviously-fake demo data; CI/tests stay local-only. The runbook's demo-data-only posture references this. [Source: docs/process/demo-environment.md; project-context.md#Development Workflow Rules]
- **The Lovable Oracle Policy** — canonical text lives in `AGENTS.md`, `project-context.md#Lovable Oracle Policy`, and `docs/process/agent-workflow.md`. Link/summarize; do not fork a divergent version. [Source: those files]

### Architecture Compliance

- **Asset locations (architecture §16):** classification/deltas/fallback docs → `docs/migration/**` (this story's output); anonymized structured fixtures → `tests/fixtures/golden/lovable/**` (9.2, forthcoming — do NOT create); comparison tests → `tests/golden/**` / existing `tests/unit/**` pins (9.3); approved capture/reset scripts → `scripts/migration/**` (only when a real migration story lands — NOT here). Landing an asset in the wrong place is R-919. [Source: architecture.md#16; test-design-epic-9.md R-919, 9.x-PATH-01]
- **Four-bucket classification (architecture §16):** live for pilot / archive-only / excluded / deferred. Cutover is by workflow, not by whole company. [Source: architecture.md#16; PRD NFR22]
- **Golden-master fixture strategy (architecture §17):** preserve business shape, not real customer data; remove/replace all real PII unless explicitly approved; keep Lovable-expected and new-expected behavior SEPARATE where an intentional delta exists. 9.1 references this strategy for the runbook's delta-documentation framing (the delta HARNESS is 9.3). [Source: architecture.md#17]
- **BMAD Output Discipline:** state phase + scope explicitly; mark items IN/DEFERRED/SEAM; separate assumptions from decisions; convert ambiguous Swedish business terms into explicit owner questions; do NOT smuggle deferred modules into an implementation plan. [Source: project-context.md#BMAD Output Discipline]
- **Evergreen-doc anchoring:** reference architecture §-anchors, not "Epic N / Story X-Y", in the durable doc body (R-922). [Source: project-context.md#Code Quality Rules]

### Previous Story Intelligence

This is the FIRST story of Epic 9 (no prior Epic-9 story to inherit from). The immediately-preceding work is the **Epic-9 epic-level test design** (`test-design-epic-9.md`, commit `9e421a6`) — the authoritative test/risk source for this story (R-901/R-902/R-907/R-908/R-919/R-922 and cases 9.1-PRIV-03/CLASS-01/RUNBOOK-01/STOP-01). Read it as the primary test spec. The **Epic-8 retrospective** (`epic-8-retro-2026-07-07.md`) explicitly named "Create Epic 9 Story 9.1 (legacy record classification and migration runbook)" as the next step and flagged the acceptance-evidence-upload gap + R-817/R-818 as pilot-readiness re-score items for Epic 9 — folded into the deferred-work section above. The closest STRUCTURAL precedent for a docs-only, guardrail-heavy story is **Story 1.4** (`1-4-document-local-setup-...md`, done) — mirror its discipline: explicit phase/scope/mode header, an owned-vs-not-this-story deferred-work section, a redacted-examples-only posture, and an explicit skipped-product-gate statement in the PR. [Source: test-design-epic-9.md; epic-8-retro-2026-07-07.md#Next Steps; 1-4-document-local-setup-environment-contract-and-repo-hygiene.md]

### Git Intelligence

Established cadence: conventional commits scoped per story, one branch per epic → PR to `main`, CI green as the merge gate, with a Round-1 code-review hardening pass. This story is on the epic branch `epic/9-migration-coexistence-golden-masters-and-pilot-readiness` (already created; `chore(story-9-1): start auto-bmad pipeline` is the current tip). Use a `docs(story-9-1): …` commit scope for the runbook. Do NOT run git yourself — the orchestrator owns all git/PR work; this note is for the commit-message convention only. [Source: recent commit log; project-context.md#Development Workflow Rules; branching-and-pr-policy.md]

### Testing Standards

- **This story's "tests" are docs/checklist validators, not product tests** (test-design-epic-9.md weights 9.1 as a decision/evidence artifact): (a) docs review that all four buckets are used and every deferred group maps to no-Phase-A-table (9.1-CLASS-01); (b) docs-structure review that every pilot workflow carries source/treatment/fallback/backfill-risk/cutover (9.1-RUNBOOK-01); (c) the scope-unclear→STOP marker is present (9.1-STOP-01); (d) a docs PII scan proving `docs/migration/**` is clean (9.1-PRIV-03). No new automated test file is required by THIS story — the automated whole-fixture-set privacy scanner (9.2-PRIV-01), the classification-checklist validator, and the runbook-structure validator can land as executable checks in a later Epic-9 story (9.2/9.4/9.5) per the test design; 9.1's obligation is the clean, complete, STOP-marked docs. If the dev chooses to add a lightweight docs-structure/PII validator now, keep it under `tests/unit/**` (the runner-glob trap — anything outside `tests/unit/**` is vacuous-green, never executed) and reference the real `ReadinessCode` union, never a fictional code. [Source: test-design-epic-9.md P0/P1 tables + R-904; project-context.md#Testing Rules]
- Point NOTHING at a remote/demo Supabase project or any real Lovable connection — no data is touched (test-design Environment note: "No external service, no real Lovable connection"). [Source: test-design-epic-9.md#Environment; architecture.md#18]

### Project Structure Notes

- **New:** `docs/migration/` (directory) + the runbook doc(s) (e.g. `docs/migration/migration-runbook.md` and/or `docs/migration/legacy-record-classification.md`).
- **Modified:** `_bmad-output/implementation-artifacts/sprint-status.yaml` (tracking → this story's status) and this story file (tasks/Dev Agent Record/status).
- **Do NOT touch:** `src/**`, `supabase/**`, `package.json`/`pnpm-lock.yaml` (no dep/migration/code change); `scripts/migration/**` (do NOT create — reserved for an approved migration-script story); `tests/fixtures/golden/lovable/**` (do NOT create — Story 9.2); `owner-signoff-questions.md` (Story 9.4 owns it); the deferred-work ledger and any golden fixture (referenced only); `nav-items.ts` / any route (still exactly seven nav items, no deferred module).
- **PR must follow `docs/process/branching-and-pr-policy.md`:** phase/scope statement (**Phase A, docs-only** — migration/coexistence control point), story link (this file), changed-files list, checks run (**docs-only: product gates SKIPPED-WITH-REASON** — no product code/schema), security/RLS impact (**reduces privacy risk; no RLS/tenant data touched; no real customer data or PII in any committed doc**), data-migration impact (**none — no production data mutation, no migration script**), deferred-scope confirmation (**no deferred module introduced; deferred groups explicitly classified as `deferred` and mapped to no Phase A table/UI**). Merge gate: CI green (the doc PR runs the non-product path). [Source: docs/process/branching-and-pr-policy.md; project-context.md#Development Workflow Rules]

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.1] — story statement, ACs, technical notes, test requirements, security/migration impact, dependencies, stop conditions
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 9] — epic goal, scope (classification, fixtures, golden masters, fallback/cutover runbook, pilot gates), explicit non-scope, risks
- [Source: _bmad-output/planning-artifacts/architecture.md#16 (Migration And Coexistence Architecture)] — the four buckets, asset locations (`docs/migration/**`, `tests/fixtures/golden/lovable/**`, `scripts/migration/**`), cutover-by-workflow, Lovable-is-oracle-not-blueprint
- [Source: _bmad-output/planning-artifacts/architecture.md#17 (Golden-Master Fixture Strategy)] — preserve business shape not real data; keep old-expected vs new-expected separate; required fixture categories (incl. migration live/archive/excluded/deferred classification)
- [Source: _bmad-output/planning-artifacts/architecture.md#18 (Test Strategy)] — local-only test environment; docs/config-only lighter checks
- [Source: _bmad-output/test-artifacts/test-design-epic-9.md] — the authoritative Epic-9 risk/test source: R-901/R-902/R-907/R-908/R-919/R-922; cases 9.1-PRIV-03, 9.1-CLASS-01, 9.1-RUNBOOK-01, 9.1-STOP-01; Non-Negotiable epic blockers
- [Source: _bmad-output/planning-artifacts/prd.md] — FR55 (classification), FR58 (deltas/fallback), FR59 (fallback explicit); NFR17 (no real PII in fixtures/docs), NFR21 (fallback until gates pass), NFR22 (classify before cutover), NFR32 (anonymized comparisons, no copied code); AC16 (migration runbook with classification)
- [Source: _bmad-output/planning-artifacts/owner-signoff-questions.md] — sign-off system-of-record; `8.1`/`8.2` migration classification + golden-example selection are `öppen (möte)` (owner-pending → STOP markers)
- [Source: _bmad-output/project-context.md] — Product Boundary; Lovable Oracle Policy; Architecture Rules (24 tables); Framework Rules (7 nav items); Testing Rules (golden runner-glob trap, no real Lovable oracle → new-expected, fictional ReadinessCode representativeness trap, ORGNR 10-digit scan constraint); BMAD Output Discipline; demo-data-only workflow rule
- [Source: docs/oracle/initial-system-audit-2026-06-01.md] — the Lovable behavioral-oracle inventory (107 tables, full module list) — the classification SOURCE
- [Source: docs/process/demo-environment.md] — demo-data-only posture; CI/tests local-only
- [Source: _bmad-output/auto-bmad/retro-notes/epic-9.md] — epic-9 golden-origin discipline + representativeness-trap constraints
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — Epic-8 pilot-readiness re-score triggers (acceptance-evidence-upload gap, R-817, R-818), R-513 required-files placeholder, R-009 personnummer doc-divergence (all REFERENCE-only for 9.1)
- [Source: _bmad-output/implementation-artifacts/epic-8-retro-2026-07-07.md] — Epic 9 readiness; the "create Story 9.1" next-step; re-score triggers
- [Source: _bmad-output/implementation-artifacts/1-4-document-local-setup-environment-contract-and-repo-hygiene.md] — the docs-only-story structural precedent (phase/scope header, skipped-gate statement, redacted-examples discipline)
- [Source: AGENTS.md / CLAUDE.md] — Lovable-oracle-only policy; Phase A boundary; deferred-module list; no-migration/no-dep/no-.env for process-only tasks

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (claude-opus-4-8[1m]) — BMAD dev-story workflow (auto-bmad delegate).

### Debug Log References

- **PII / privacy self-scan (Task 4.2, 9.1-PRIV-03)** — ran the five documented scans over
  `docs/migration/*.md`; **zero real hits** on every class:
  - personnummer-shaped `\d{6,8}[-\s]?\d{4}` → no matches
  - bare 10-digit orgnr run (R-914) → no matches
  - email non-`example.test`/`example.com` → no matches
  - phone-ish `+46`/separated long digit runs → no matches
  - `api_key`/`password:`/`secret:`/`bearer`/`-----BEGIN` → no matches
  - context check of the words personnummer/orgnr/secret/org-number confirmed all are
    module/column-name or policy-rationale mentions, never values; the only placeholders are
    the obviously-fake masked forms `YYYYMMDD-XXXX` / `XXXXXX-XXXX` (non-10-digit).
- **Scope-guardrail sweep (Task 5.2)** — `git status --porcelain src/ supabase/ package.json
  pnpm-lock.yaml` **empty** (no product code/schema/deps touched); `scripts/migration/` and
  `supabase/migration/` **do not exist** (not created); `tests/fixtures/golden/lovable/` **does
  not exist** (not scaffolded — 9.2's job); `nav-items.ts` unchanged, **exactly seven** nav
  href destinations; `owner-signoff-questions.md`, the deferred-work ledger, and `tests/fixtures/`
  **untouched** (Task 5.4). Working tree diff limited to `docs/migration/**` + this story file +
  `sprint-status.yaml` + auto-bmad state.
- **ReadinessCode verification** — verified the real `ReadinessCode` union against
  `src/features/calculations/readiness.ts` (12 members incl. `TAX_SIGN_OFF_REQUIRED`,
  `REQUIRED_FILES_DEFERRED`, `HIDDEN_ROWS_INCLUDED`, `LOW_MARGIN`, `MISSING_CUSTOMER`,
  `TOTAL_UNCOMPUTABLE`, `UNRESOLVED_VAT`, …). The docs deliberately reference readiness
  codes only in-passing (`REQUIRED_FILES_DEFERRED` for the required-files fallback seam) and
  never invent a code; the fictional `REQUIRES_SIGN_OFF`/`DEDUCTION_ESTIMATE_UNAPPROVED` codes
  are NOT used.

### Completion Notes List

- **Docs-only story complete.** Created the new `docs/migration/` home (architecture §16's
  canonical location, which did not exist before) with two cross-linked files: a
  **classification register** (`legacy-record-classification.md`) and the **per-workflow
  migration runbook** (`migration-runbook.md`). Content is NOT duplicated across the two — the
  register owns the four-bucket record-group decisions, the runbook owns the per-workflow
  source/treatment/fallback/backfill/cutover mechanics; each cross-links the other.
- **AC1 (classification):** every one of the four buckets is used — **live** (18 groups →
  the twenty-four IN-scope tenant-owned tables), **archive-only** (4 historical-continuity
  groups → Lovable fallback, no active table), **excluded** (4 groups), **deferred** (18
  deferred-module groups). **Every deferred group maps to "none — deferred"** (no Phase A
  table/UI) — the R-907 hard constraint, self-checked in register §6. No live group exceeds
  the twenty-four-table boundary.
- **AC2 (runbook):** all six Phase A pilot workflows (CRM, settings/pricing, calculations,
  quote versions/PDF/acceptance, basic job/order, required files) each carry the five required
  fields — source records, target treatment, fallback path, manual-backfill risks, and a
  cutover-by-workflow decision (per-workflow, never whole-company).
- **AC3 (STOP):** an explicit fail-closed **"scope-unclear → STOP for owner clarification"**
  protocol (runbook §6) plus inline STOP markers wherever a decision is owner-gated. The
  concrete real-record selection (`8.1`) and golden-example selection (`8.2`) are both
  `öppen (möte)` and are STOP-marked, not fabricated; any real customer data export/import is
  stated as a **hard STOP requiring owner sign-off**.
- **Epic-blocker R-901/R-902 (zero real PII):** confirmed clean by the manual five-class scan
  (see Debug Log). Redacted/synthetic examples only; obviously-fake masked placeholders where
  ever illustratively needed.
- **Retro/deferred constraints honored:** current owner-decided personnummer state reflected
  (private-only, access-controlled — supersedes stale R-009 text); the required-files
  `REQUIRED_FILES_DEFERRED` seam noted as a live manual-fallback consideration (R-513); the
  Epic-8 pilot-readiness re-score triggers (acceptance-evidence-upload gate, R-817, R-818)
  **referenced** as workflow-level considerations, **not resolved** (their consolidation is
  the fallback/cutover/sign-off-register + acceptance-gate work). No golden/Lovable oracle
  number fabricated (golden examples framed as forthcoming, owner-gated).
- **No new automated test authored in the initial dev pass** — per the test design (9.1's
  "tests" are the docs-review / classification-checklist / STOP-marker / docs-PII-scan
  validators; the automated whole-fixture privacy scanner is 9.2-PRIV-01, the executable
  classification/runbook validators may land in a later Epic-9 story). 9.1's obligation —
  clean, complete, STOP-marked docs — is met and proven by the manual scan above.
- **Automated-coverage expansion (TEA `testarch-automate`, 2026-07-07).** The story's manual
  docs-review "tests" were PROMOTED to standing executable `node --test` coverage:
  `tests/unit/docs/migration-runbook-validators.test.ts` (9 cases) implements the four
  test-design validators over `docs/migration/**` — 9.1-CLASS-01 (four buckets used; every
  DEFERRED row → `none — deferred`; every LIVE target ∈ the real 24 `TENANT_TABLES` loaded
  live from `tests/integration/rls/tenant-table-inventory.ts`), 9.1-RUNBOOK-01 (all six
  workflows carry source/treatment/fallback/backfill-risk/cutover, non-empty; per-workflow
  cutover), 9.1-STOP-01 (fail-closed scope-unclear → STOP protocol + owner-gated `8.1`/`8.2`
  STOP-marked), 9.1-PRIV-03 (whole-directory PII scan) — plus a representativeness guard that
  the docs cite only the REAL `ReadinessCode` union (`REQUIRED_FILES_DEFERRED`), never the
  fictional `REQUIRES_SIGN_OFF`/`DEDUCTION_ESTIMATE_UNAPPROVED`. The file lives under
  `tests/unit/**` so it is picked up by the real `pnpm test:unit` glob (NOT vacuous-green).
  All 9 pass; full unit suite 1259/1259 green; mutation-tested (breaking the STOP heading,
  wiring a deferred group to a live table, and injecting a bare-10-digit orgnr each fail the
  matching validator; docs restored byte-identical). Summary:
  `_bmad-output/test-artifacts/automation-summary-9-1-legacy-record-classification-and-migration-runbook.md`.
- **Skipped product gates (docs-only, Task 5.3):** typecheck / lint / unit / build /
  migration-reset / integration / RLS gates are **not applicable** (no product code, no schema,
  no deps) and are explicitly SKIPPED-WITH-REASON — to be stated in the PR body per the
  quality-gate convention. No product-gate green run is claimed.

### File List

- `docs/migration/legacy-record-classification.md` (new) — the four-bucket classification register.
- `docs/migration/migration-runbook.md` (new) — the per-workflow migration/coexistence runbook.
- `tests/unit/docs/migration-runbook-validators.test.ts` (new) — 9 executable `node --test` validators over `docs/migration/**` (9.1-CLASS-01 / RUNBOOK-01 / STOP-01 / PRIV-03 + a real-ReadinessCode representativeness guard); added by the TEA `testarch-automate` coverage-expansion pass.
- `_bmad-output/test-artifacts/automation-summary-9-1-legacy-record-classification-and-migration-runbook.md` (new) — TEA automation summary (coverage plan, generation, mutation-test evidence).
- `_bmad-output/implementation-artifacts/9-1-legacy-record-classification-and-migration-runbook.md` (modified) — tasks checked, Dev Agent Record, Change Log, status.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) — story status tracking.

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-07 | Story 9.1 implemented (docs-only). Created `docs/migration/` with the legacy-record classification register (four buckets: live/archive-only/excluded/deferred; every deferred group → no Phase A table/UI) and the per-workflow migration runbook (six workflows × source/treatment/fallback/backfill/cutover; scope-unclear→STOP protocol; demo-data-only posture; approved-asset-location seams). Zero real PII (manual five-class scan clean). No product code/schema/deps touched; scope-guardrail sweep clean. Status → review. |
| 2026-07-07 | TEA `testarch-automate` — expanded automated coverage: added `tests/unit/docs/migration-runbook-validators.test.ts` (9 executable `node --test` validators over `docs/migration/**`) promoting the story's manual docs-review checks to standing coverage (9.1-CLASS-01/RUNBOOK-01/STOP-01/PRIV-03 + real-ReadinessCode guard). Cross-checks the live 24-table `TENANT_TABLES` and `ReadinessCode` union. All 9 pass; full unit suite 1259/1259; mutation-tested. Docs unchanged. |

## Review Findings

Tier-A review (Acceptance Auditor @ primary + dedicated security review). Security review: clean, no findings. Acceptance Auditor: no Critical/High/Med — all ACs + the PII hard constraint pass; two minor Low accuracy nits (patched in place), one Low dismissed as a factually-correct awareness note. No open Decision items.

- [x] [Review][Patch][Low] Stray `</content>`/`</invoke>` tool-emission artifact lines literally committed at the tail of both authored docs — removed so each file ends cleanly at its `## References` section [docs/migration/legacy-record-classification.md:244; docs/migration/migration-runbook.md:587] — fixed: verified via `od -c` that both files now end with a single trailing newline after the References section and grep for the tokens returns none.
- [x] [Review][Patch][Low] Runbook labeled `7.1` as `öppen (möte)` but the sign-off register records it as `partial (möte)` (job name "Jobb" answered; only the structure is pending) — the blanket `öppen` overstates its openness [docs/migration/migration-runbook.md:157, :266] — fixed: §3.5 and §6 now cite `7.1` as `partial (möte)` (structure pending) and `7.3` as `öppen (möte)` separately; verified against `owner-signoff-questions.md:89/91`.
