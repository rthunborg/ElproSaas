# Post-Phase-A Plan: Near-Term Work + Phase B/C Direction

Date: 2026-07-08
Status: owner-directed (this document records the owner's 2026-07-08 direction); Phase B shaping pending ratification in a `/bmad-party-mode` working session (agenda + kickoff prompt in Appendix A).
Supersedes nothing; extends [saas-rebuild-phased-plan-2026-06-07.md](saas-rebuild-phased-plan-2026-06-07.md) past Phase A.

**Amended 2026-09-03:** the later 2026-07-26 N-3 choice of Phase B PWA/offline capability is preserved in its dated answer and ADR-B007, but has been superseded by ADR-B009. Phase B field workflows are responsive and usable at 360×640 with connectivity; the complete PWA/installability and genuine offline-operation package is deferred to Phase C. Story 10.7 records this governance alignment and is not a technical prerequisite for E14–E18.

---

## 1. Where we stand

- **Phase A / Internal Pilot MVP is complete.** All nine epics done; epic 9 merged to `main` via [PR #32](https://github.com/rthunborg/ElproSaas/pull/32) (2026-07-08), all CI gates green, epic trace gate PASS, NFR PASS, test-review Grade A. Unit gate: 1378 tests / 0 fail / 0 skipped.
- **Stakeholders have accepted the pilot** and want to move forward (owner, 2026-07-08).
- Canonical current-state artifacts: [phase-a-acceptance-gate.md](../migration/phase-a-acceptance-gate.md) (gate report), [pilot-fallback-cutover.md](../migration/pilot-fallback-cutover.md) §4 (sign-off register), `_bmad-output/implementation-artifacts/epic-9-retro-2026-07-08.md` (retro + carried debt), `_bmad-output/auto-bmad/reports/epic-9.md` (epic report incl. 43-item UAT checklist).
- **Still-gating owner items (unchanged by this plan):** the `möte`-open sign-offs — tax blocks A (rounding/VAT) / B (ROT) / C (grön teknik), hidden-row mechanics `2.2`, job model `7.1`/`7.3`, migration classification `8.1` / golden examples `8.2`. Email sent to owner 2026-07-08; these block *real-pilot cutover* (demo track unaffected) — and `7.1`/`7.3` now ALSO gate Phase B's Jobs & Projects design. System of record: `_bmad-output/planning-artifacts/owner-signoff-questions.md`.

## 2. Near-term workstreams (can run now, independent of Phase B planning)

### W1 — Consolidation & tech-debt cleanup (docs/tests only; no product code; no new story needed)
From the epic-9 retrospective action items. One branch → one PR; exit criteria: unit gate ≥ 1378 green, all doc-validator suites green, typecheck/lint clean, zero behavior change.

1. Docs consolidation — extract the shared demo-vs-real-pilot table, STOP protocol, and PII-hygiene prose into one canonical section referenced by the four migration control-point docs (retro TD#5).
2. Test-helper consolidation — one shared register-ID extraction helper replacing the three forked regexes (`blockingSignoffIds`, `ac2RegisterRows` `idRe`, `registerBlockingIds`), with a fail-loud unexpected-token assertion (TD#3).
3. `READINESS_CODES` single-source — remove the hand-copied `REAL_READINESS_CODES` test array; import the runtime export; add the uniqueness guard (TD#4).
4. Runbook §5 — reference the live fixture manifest instead of a hardcoded filename enumeration.
5. PII hygiene sweep of `tests/unit/**` for seeded real-identifiable values (TD#2).
6. Stale-skip-banner lint (CI check for `describe.skip`/RED-PHASE banners on un-skipped bodies) — Epic-8 action item, two epics overdue.
7. Postgres in-transaction lock-trigger timing write-up (`transaction_timestamp` vs wall time; OLD vs NEW in UPDATE arms) — Epic-8 action item, two epics overdue.

### W2 — Demo-track pilot dry-run
Walk the 43-item single-session UAT checklist (`_bmad-output/auto-bmad/reports/epic-9.md`) against the running app on demo data. Divergences become findings. No owner sign-offs needed (demo track is non-blocking by design).

## 3. Legacy-gap inventory (current app vs the Lovable original)

Full inventory: [initial-system-audit-2026-06-01.md](../oracle/initial-system-audit-2026-06-01.md); oracle analysis: [e0-domain-oracle-report.md](../discovery/e0-domain-oracle-report.md). Condensed:

**Gaps inside Phase A's own areas (small, visible, candidates for early Phase B or interstitial work):**
- Roles beyond `tenant_admin` (legacy: admin / projektledare / installatör / ekonomi) + admin user management (invite/reset/remove) + self-serve company registration.
- Operational KPI dashboard (ours is a stub).
- Quote declined/lost status + lost-reason lifecycle (owner answer `4.3` names Förlorad/Avböjd; we ship draft/sent/accepted/archived).
- Quote follow-up *workflow* (we store only the default setting).
- Customer 360 overview, favorites, classification tools; duplicate-calculation flow; supplier article references; email-from-app (`3.4`, seam only).

**Entire modules absent (deliberately deferred out of Phase A):**
- Jobs & Projects depth: my-jobs, order→project upgrade, job members/roles, tabs (work orders, schedule, material, economy, diary, deviations, photos, chat, risks, reports, analytics), material usage/requests, payment plan, completion→warranty, job→DoU seed.
- Time planning & scheduling: schedule/resource/team/capacity/personal views, bookings (+recurring), conflict resolver, work hours, time reports, calendar feeds.
- Rentals; Assets (+public QR route); Electrical panels; Service; Warranties; DoU documentation; Self-inspections; Tenders/FKU; KNX tooling; HR/personnel; Notes/notice board; Supplier master data + price-list file imports.
- Global documents center + cross-module file index (ours is a limited entity-scoped index by design).
- Notifications (+bell UI, reminders, expiry alerts) and email queue/delivery-log infrastructure.
- Fortnox / any accounting integration (legacy had none either — but billing basis was flagged "behövs" by the owner).

## 4. Phase B — owner direction (decided 2026-07-08)

- **Goal:** feature parity with the legacy Lovable app — "basically everything it did, but better" — on the Phase A architecture (tenant isolation + RLS, integer-öre money, immutable snapshots, server-side audited commands, golden/regression test discipline).
- **Emphasis:** Jobs & Projects depth and Time planning & scheduling for available employees/teams are the headline capabilities.
- **Connectivity:** modules must be built inter-connected (jobs ↔ scheduling ↔ people ↔ materials ↔ economy ↔ documents), not as siloed pages.
- **Field connectivity posture (owner amendment 2026-09-03):** field workflows require connectivity. Protect suitable unsent input from transient failures with component state, `sessionStorage`, in-memory photo retention where appropriate, clear connection/failure messaging, and explicit retry. A local draft is not submitted; success requires server-confirmed persistence. No PWA manifest/installability, service worker, durable offline storage, offline reads/writes, local queue, replay/synchronization/offline conflict state, or background/reconnect-driven offline synchronization is in Phase B.
- **Fortnox integration is IN Phase B** (billing basis precedes it — owner: "faktureringsunderlag före Fortnox: ja, behövs").
- **Multi-company delivery:** the product must remain deliverable to many independent companies (multi-tenant SaaS); Phase B must cover tenant provisioning/onboarding and full RBAC.
- **AI flows are OUT of Phase B** → Phase C. For AI-entangled legacy modules, Phase B builds the manual/deterministic core only (see §5.3).

## 5. Proposed Phase B shaping (to be challenged/ratified in the party session)

### 5.1 One phase, staged waves — not more formal phases
Recommendation: keep **one Phase B** (one PRD + one architecture pass + one epics doc), internally sequenced into **three waves**. Formal phases carry governance overhead (scope guardrails, gate reports, AGENTS.md scope statements) that we should not triplicate; waves give the sequencing benefit and natural review checkpoints at wave boundaries. Rough size honestly stated: on the order of **15–20+ epics — roughly twice Phase A** (epics continue numbering at Epic 10+; delivery continues via the established per-epic pipeline).

- **Wave B1 — Operational core (the emphasis):** full RBAC + roles + admin user management + tenant onboarding; non-admin (field-worker) app access as a foundation; Jobs & Projects depth; Time planning & scheduling; notifications + email infrastructure (cross-cutting dependency for scheduling/service); operational dashboard; quote lifecycle completion (declined/lost + follow-up workflow).
- **Wave B2 — Asset & service operations:** Rentals; Assets (+QR); Service; Warranties; Electrical panels (manual core); global documents center + cross-module file index; material/supplier price-list file imports.
- **Wave B3 — Content, compliance & money-out:** DoU (manual core); Self-inspections (manual core); Tenders/FKU (manual core); KNX (manual tables); HR/personnel; Notes; billing basis + **Fortnox integration**; CRM completions (360, favorites, classification).

### 5.2 Sequencing facts the waves must respect
- **Full RBAC + field-worker access are prerequisites, not features:** "my jobs", job members, bookings, time reporting are meaningless with `tenant_admin` as the only role. Phase A deferred both; Phase B pulls both in at the front. This partially reverses a Phase A scope decision and needs an explicit ADR.
- **Notifications/email infra precedes** scheduling reminders, service scanning, expiry alerts.
- **Billing basis precedes Fortnox**; Fortnox needs jobs/economy data → late B, after B1 job economy exists.
- **Job model `7.1`/`7.3` (owner möte) gates B1 design** — the jobb/order/arbetsorder/projekt structure question is now on Phase B's critical path, not just the pilot's.
- **Warranty creation hangs off job completion; DoU seeds hang off jobs** — B2/B3 items depending on B1 shapes.

### 5.3 AI-entangled modules — Phase B core vs Phase C layer
| Module | Phase B (manual/deterministic core) | Phase C (AI layer) |
| --- | --- | --- |
| DoU | Templates, folder/document structure, upload, versioning, lock, package export, material-list sync | AI classification, PDF splitting, list parsing, narrative generation, validation |
| Self-inspections | Templates, sections, items, measurements, attachments, manual creation, export | AI generation from PDFs/documents |
| Tenders/FKU | Upload/unzip, file storage, manual summary fields, manual conversion to calc/quote | Analysis, OCR extraction, chunks/facts, RAG chat, auto-summaries |
| Electrical panels | List/detail, circuit schedule, RCD data, bulk edit, print/PDF | AI image import (`analyze-panel-schedule`) |
| KNX | Group-address projects, rooms/functions tables | AI parsing of ETS PDFs |
| Supplier data | Master data, price lists, deterministic file import | (live vendor APIs → Phase C, see §6) |

### 5.4 Guardrail re-scoping — Phase B's mandatory first step
Phase A scope is **actively enforced in code and docs**; Phase B begins by consciously re-scoping, not by ignoring failures:
- `src/features/files/deferred-categories.ts` (`FORBIDDEN_DEFERRED_CATEGORIES`) — the deny-list feeding file-index checks and the 9.5 scope scan.
- Acceptance-gate/report validators pinning the surface (7 nav items, 24 tenant tables, deferred-token scans) in `tests/unit/docs/**`.
- Nav-item guardrails from Story 1.3; `AGENTS.md` Phase A scope + deferral list; `phase-scope-reviewer` agent definition; `docs/process` scope statements.
Each module Phase B activates must be removed from the deny-list/guardrails in the same change that introduces it, with the guardrail tests updated to the new approved surface (fail-loud remains the design).

## 6. Phase C — outline (not now)
- The complete PWA/installability and genuine offline-field package: service-worker/application/data caching, durable device storage, offline reads/writes, local record and attachment queues, synchronization/replay/idempotency/conflict UX, reconnect/foreground/app-open/background behavior, retention/purge/device-loss posture, authorization after access change, attachment limits, signature/legal implications, browser/platform support, and offline security/recovery testing. Exact Phase C surfaces and architecture remain undecided until these questions are resolved.
- All AI flows (§5.3 right column) across DoU, self-inspections, tenders/FKU, panels, KNX + AI job/document features.
- Bookkeeping integrations beyond Fortnox.
- Live supplier vendor APIs (Ahlsell, Rexel, Solar, Sonepar — roadmap item; legacy had file import only).
- Customer portal / online acceptance (BankID/portal signing), plus other net-new features.
- Full-release legal/GDPR items parked in Phase A (disclaimer wording `A22-tax`, retention, authoritative tax-number ownership NFR15).

## 7. Governance & document updates required for Phase B

| Artifact | Action | When |
| --- | --- | --- |
| Product brief | Update or new Phase B brief | After party session |
| PRD (`_bmad-output/planning-artifacts/prd.md`) | **Supersede** with a Phase B PRD (keep Phase A PRD immutable as the pilot record) | First planning artifact |
| UX design spec | Major additions: field-worker surfaces, scheduling views, job workspace | After/with PRD |
| Architecture (`architecture.md`) | Major extension: RBAC model, scheduling/booking model, notifications/email, documents center, Fortnox integration layer, tenant onboarding | After PRD/UX |
| Epics (`epics.md`) | New Phase B epics doc (Epic 10+), wave-sequenced | After architecture |
| `AGENTS.md` + `docs/process` | Rewrite Phase statement + deferral list; update hard gates if needed | With PRD ratification (ADR) |
| Scope guardrails in code (§5.4) | Per-module re-scoping as modules activate | Per epic |
| `project-context.md` | Refresh after architecture lands | Before first Phase B story |
| Phased plan (`saas-rebuild-phased-plan-2026-06-07.md`) | Append Phase B/C section or supersede | With PRD |

## 8. Open decisions for the party session (then the owner where marked)
1. Ratify or amend the wave structure (§5.1) and the RBAC/field-access front-loading (§5.2).
2. Per-module manual-vs-AI split boundaries (§5.3) — anything that can't ship a useful manual core in B?
3. Where dashboards land (B1 single dashboard vs per-module analytics later).
4. ~~Mobile posture for field workers in B1~~ — **resolved 2026-07-26, then superseded 2026-09-03:** connected responsive web at 360×640 is the current Phase B posture (ADR-B009); PWA/offline is Phase C.
5. Business model / per-company pricing & provisioning flow (Roadmap 7 — "gemensamt beslut efter möte"). **(owner)**
6. Whether quote lifecycle completion (declined/lost, follow-up) ships as a small pre-B interstitial or inside B1.
7. Job model structure `7.1`/`7.3` — already on the owner email; party session should prepare the *options* to present. **(owner)**
8. Migration expansion: legacy tables for B modules (rentals, assets, service…) were classified archive-only/deferred in `docs/migration/legacy-record-classification.md` — Phase B needs a classification round 2. 

## 9. Process roadmap (session sequence)
1. **Party-mode session** (`/bmad-party-mode`) — ratify direction using Appendix A; output a written session summary to `_bmad-output/planning-artifacts/`.
2. `/bmad-product-brief` (update intent) → `/bmad-prd` (create, Phase B) → validate.
3. UX design update (`/bmad-create-ux-design` or WDS flow) for the new surfaces.
4. `/bmad-create-architecture` (extend) + ADRs (RBAC reversal, field access, Fortnox layer, guardrail re-scope policy).
5. `/bmad-create-epics-and-stories` (Epic 10+, wave-tagged) → `/bmad-sprint-planning`.
6. Delivery resumes with the established pipeline: `/auto-bmad epic --epic 10`, etc.
7. In parallel, anytime: W1 cleanup PR; W2 UAT dry-run; owner email follow-ups as answers arrive.

---

## Appendix A — Kickoff prompt for the Phase B party-mode session

Start a fresh session in `C:\ElproSaas` and paste:

```text
/bmad-party-mode

Topic: ratify and shape Phase B. Read docs/planning/post-phase-a-plan-2026-07-08.md first — §4 is decided owner direction (treat as fixed), §5 is a proposal to challenge, §8 lists the open questions. Also load for context: docs/oracle/initial-system-audit-2026-06-01.md (full legacy feature inventory), docs/discovery/e0-domain-oracle-report.md (reusable-vs-forbidden analysis), _bmad-output/implementation-artifacts/epic-9-retro-2026-07-08.md (current state + carried debt), and the Phase A prd.md/architecture.md/epics.md in _bmad-output/planning-artifacts/ (the baseline Phase B supersedes).

Decided context (owner, 2026-07-08; field posture amended 2026-09-03): stakeholders accept the pilot; Phase B is green-lit. Phase B = feature parity with the legacy Lovable app ("everything it did, but better") on the Phase A architecture; headline emphasis on Jobs & Projects depth and Time planning & scheduling for employees/teams; modules built inter-connected, not siloed; field workflows are responsive at 360×640 and require connectivity; Fortnox integration included (billing basis first); product stays deliverable to many independent companies (multi-tenant SaaS). Phase C (excluded from B): the complete PWA/offline package, all AI flows, bookkeeping integrations beyond Fortnox, live supplier APIs, customer portal, net-new features.

Have the full team (PM, architect, UX, dev, QA/test-architect, analyst, SM) debate and settle:
1. The wave structure (B1 operational core / B2 asset & service / B3 content, compliance & Fortnox) — resequence, split, or merge as argued.
2. The prerequisite claim that full RBAC + non-admin field-worker access must front-load B1 (this reverses a Phase A deferral and needs an ADR).
3. The per-module manual-vs-AI split (§5.3) — confirm each Phase B manual core is independently valuable.
4. Cross-cutting foundations placement: notifications/email infra, documents center, dashboards.
5. The guardrail re-scoping step (§5.4) — agree the mechanism by which each activated module exits the deny-list/nav/scope validators.
6. The document plan (§7): supersede-vs-update per artifact, and order.
7. Collect every owner-decision question (business model/pricing, mobile posture, job model 7.1/7.3 options, migration classification round 2) into one list — note the Phase A möte items are still open and now also gate B1 design.
8. Rough epic count + wave boundaries sanity check against team capacity.

End state: write the ratified direction + wave/epic candidate list + dependency map + doc-update order + consolidated owner-question list to _bmad-output/planning-artifacts/phase-b-party-session-2026-07-XX.md so the next session can run /bmad-product-brief and /bmad-prd against it. Do not start the PRD in this session.
```
