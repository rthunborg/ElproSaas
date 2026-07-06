---
stepsCompleted:
  - step-01-load-context
  - step-02-define-thresholds
  - step-03-gather-evidence
  - step-04-evaluate-and-score
  - step-04e-aggregate-nfr
  - step-05-generate-report
lastStep: step-05-generate-report
lastSaved: '2026-07-06'
workflowType: testarch-nfr-assess
assessmentLevel: epic
epicNum: 6
executionMode: sequential
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-6.md (17 risks R-601..R-618; 11 high-priority ≥6; 10 non-negotiable epic blockers; P0-P3 test IDs; exit criteria)
  - _bmad-output/test-artifacts/traceability/epic-6-traceability-report.md (gate PASS; P0 100% / P1 ~92% / overall ~97%; suite 1016 unit / 520 int / 74 e2e)
  - _bmad-output/test-artifacts/nfr-assessment-epic-5.md (format + the two standing concerns carried Epics 2-5)
  - _bmad-output/implementation-artifacts/6-1..6-5-*.md (all Status: review; tasks complete; review findings resolved/deferred-Low)
  - supabase/migrations/20260705120000_quote_version_model.sql (6 quote tables + enable/force RLS + own-tenant policies + create RPC + tenant_counters)
  - supabase/migrations/20260706120000_quote_pdf_render_state.sql (pdf_status column + event-type widening)
  - supabase/migrations/20260707120000_quote_version_sent_lock.sql (sent-lock + child-lock + append-only triggers + mark_sent RPC)
  - supabase/migrations/20260708120000_quote_new_version.sql (create_new_quote_version + mark_quote_version_lifecycle RPCs)
  - src/server/quote-pdf/render.ts (hidden-row exclusion at line 202); src/features/quotes/**; src/lib/quote-snapshot/**; src/lib/quote-pdf/**
  - tests/integration/rls/tenant-table-inventory.ts (TENANT_TABLES: 6 quote tables enrolled)
  - tests/integration/commands/{quote-version,update-draft-quote-version,generate-quote-pdf-*,mark-quote-version-sent,create-new-quote-version}.int.test.ts
  - .github/workflows/ci.yml (verify + db + e2e jobs; pnpm audit --audit-level=high BLOCKING at lines 71-72 — R-617 resolved)
  - package.json (pdf-lib 1.17.1 + pdfjs-dist 4.10.38 pinned; no coverage reporter)
  - knowledge: adr-quality-readiness-checklist.md, ci-burn-in.md, test-quality.md, error-handling.md
---

# NFR Assessment - Epic 6: Quote Versions, PDF, And Lifecycle

**Date:** 2026-07-06
**Epic:** 6 (Stories 6.1-6.5) — quote snapshot schema + server-side version creation with race-safe tenant-scoped numbering (6.1), draft review + version timeline UX (6.2), PDF generation strictly from the snapshot stored privately via the 8.1 file foundation (6.3), mark-sent with DB-enforced immutability (6.4), new versions after customer-visible changes with prior sent versions preserved (6.5)
**Overall Status:** PASS (advisory) ✅ — with **one** remaining standing forward-looking CONCERNS (no line-coverage reporter). **The `pnpm audit` gate CONCERNS carried since Epic 2 is now RESOLVED this epic** (blocking CI step). Runtime performance/load and availability/DR remain deferred N/A for Phase A (no SLA, single pilot tenant, no production SLO); the demo-data-only tax/terms accept (R-610) is a dated, surfaced residual, not a coverage gap.

---

Note: This assessment summarizes existing evidence; it does not run tests or CI workflows. The Epic 6 unit/golden suite (1016/1016 pass) is per the 6.5 automation record and the epic-6 traceability report; INT/RLS/E2E are CI-gated (`SUPABASE_TEST_REQUIRED=1`, 520 int / 74 e2e). Several load-bearing source-level claims were re-verified directly for this audit — the six quote tables enrolled in `TENANT_TABLES`, the sent-lock/child-lock/append-only triggers in `20260707120000`, the hidden-row exclusion at `render.ts:202`, the pinned `pdf-lib 1.17.1`/`pdfjs-dist 4.10.38`, and the blocking `pnpm audit --audit-level=high` at `.github/workflows/ci.yml:71-72` — see each section's Evidence line.

## Executive Summary

**Assessment:** 7 PASS, 1 CONCERNS, 0 FAIL across the in-scope categories.

**Blockers:** 0. Every one of the **ten Non-Negotiable epic blockers** in the Epic 6 test design is met and test-proven (see the dedicated table below): all six new quote tables (incl. `tenant_counters`) carry direct `tenant_id` + enable+**force** RLS + own-tenant policies + `anon → none` + `TENANT_TABLES` enrollment; no cross-tenant calculation/attachment/version id accepted; sent versions are immutable at BOTH the command layer (`QUOTE_VERSION_LOCKED`) and the DATABASE (trigger `QV409`); the PDF reads snapshot tables only (regenerate-after-mutation proof green); quote numbers are allocated server-side, race-safe, tenant-scoped, inside the RPC transaction; blocking readiness gates mark-sent and tax content is framed estimate + `requiresSignOff`, never legally-final; v2 creation and lifecycle events leave prior sent versions byte-unchanged; no internal notes/cost/margin in customer-visible output; no real PII/secret in any quote/PDF fixture; **and R-617 (the `pnpm audit` hard mechanism) is RESOLVED as a blocking CI gate — NOT a fifth silent carry.** All eleven high-priority risks (score ≥6: R-601..R-609, R-611, R-615) are mitigated and proven by running tests (epic-6-traceability-report.md, gate PASS — P0 100% / P1 ~92% / overall ~97%, 34/35 FULL).

**High Priority Issues:** 0. No new HIGH-priority NFR issue introduced.

**What changed vs Epic 5 (why this is the most consequential epic yet):** Epic 5 built the *editable* money workspace; **Epic 6 is where the money becomes a customer-facing commitment** — the first epic whose output a customer can see and rely on. This upgrades three NFR classes to their most consequential form: (1) **isolation** on **six new tenant-owned tables** carrying customer identity + pricing in commitment form, plus a first-time tenant-scoped **counter** allocation that must not leak or collide; (2) **snapshot-integrity-by-composition** — the quote version must be a complete copy-by-value freeze so no later edit reaches a sent commitment, and the PDF must read ONLY the snapshot tables (the canonical Epic 6 bug is "PDF rendered from mutable data"); (3) **lifecycle safety** — "sent" means locked at the DATABASE (triggers), not just the command layer and never just the UI, plus the first DB-trigger immutability and the first PDF renderer. It is the **widest test surface of the project** — UNIT + INT + RLS + E2E + GOLDEN + DOCS across a full PDF pipeline. Two domains remain deliberately deferred N/A for Phase A: runtime performance/load at scale (no SLA, single pilot tenant, pilot-sized single-quote renders — R-618) and availability/DR/MTTR (no deployed production runtime with an SLO). Inherited RLS/anon/service-role/audit gates from Epics 2-5 remain green as standing regression, now **extended** (not forked) to the 6 quote tables via the shared `TENANT_TABLES` inventory + H4 gate.

**The standing-concern needle moved this epic.** Epic 5's NFR closed with **two** carried CONCERNS — (a) no `pnpm audit` dependency-scan gate, and (b) no line-coverage reporter. The Epic 5 retro escalated (a) to a **HARD MECHANISM** (R-617): resolve it in Epic 6 or record a dated owner-accept — "a fifth silent carry is a gate CONCERNS by definition." **It was resolved.** The CI `verify` job now carries a blocking `pnpm audit --audit-level=high` step (`.github/workflows/ci.yml:71-72`, owner decision 2026-07-03: high/critical fail the build; moderate/low logged). That leaves exactly **one** standing CONCERNS: the line-coverage reporter (`c8`/`nyc`), which remains absent and LOW-priority (priority-weighted trace coverage, ~97%, remains the governing metric).

**Recommendation:** **PASS (advisory).** Epic 6 lands the first customer-facing quote commitment with the correct posture on every axis: isolation is enforced structurally (enable+force RLS + own-tenant policies + `anon → none` + composite same-tenant FKs + mandatory `TENANT_TABLES` enrollment whose H4 gate FAILS CI on an unenrolled table); immutability is enforced at TWO independent layers (command `QUOTE_VERSION_LOCKED` + DB trigger `QV409`, fail-closed by allow-list with a legal-transition guard); the PDF is provably snapshot-only (mutate-every-source-then-regenerate ⇒ output unchanged) and deterministic (pinned `pdf-lib 1.17.1`, base-14 Helvetica, sv-SE locale, injected timestamp); numbering is race-safe inside the RPC transaction; and tax/readiness ships nothing legally-final. The one remaining CONCERNS — no line-coverage reporter — does not weaken any Epic-6 exit criterion. The demo-data-only tax/terms accept (R-610) and the four Low deferrals (quote_events INSERT-forgeability below the RPC, 6.3 PDF-metadata transactionality, quote-number-in-snapshot + §24 display, two 6.5 test-completeness gaps) are **surfaced-for-decision items with named owners, not coverage gaps.**

---

## Findings Summary (ADR Quality Readiness Checklist — 8 categories)

| # | Category | Epic-6 evidence | Status |
| - | -------- | --------------- | ------ |
| 1 | Testability & Automation | Full pyramid — UNIT (`node --test`) + INT/RLS (Vitest/local Supabase) + E2E (Playwright) + GOLDEN. Pure logic (`send-gate`/`timeline`/`view-model`/`lifecycle-transition`/snapshot builders/PDF view model) extracted OUT of client islands and unit-pinned. 1016/1016 unit+golden green (658→1016 across the epic); no active `.skip`/`.only`/`fixme` in executable Epic 6 code. Every test-design P0/P1 ID present in-source and behavior-asserting | PASS ✅ |
| 2 | Test Data Strategy | Two-tenant factory extended with quote/version/line/attachment/event seeds + cleanup; anonymized origin-labelled snapshot + PDF goldens (`quote-version-source.json`, `quote-version-v1-v2.json`, `quote-pdf-source.json`) with the extended PII/secret scan (personnummer/orgnr/email/secret/phone; öre < 10 digits to dodge the orgnr false-positive trap); count-asserting tests seed `crypto.randomUUID()`; goldens under `tests/unit/**` (avoids the runner-glob vacuous-green trap) | PASS ✅ |
| 3 | Scalability & Availability (harness/schema) | 6 new tenant tables absorbed by the existing dual-runner + RLS/H4 inventory with zero rework (enrollment mandatory, H4 CI-fatal on an unenrolled table). Race-safe numbering is DB-side inside the RPC txn (`tenant_counters` lock). Product runtime scalability/availability = N/A/deferred (no SLA, single pilot tenant, R-618) | PASS ✅ (harness) / N/A (runtime) |
| 4 | Disaster Recovery | N/A this epic — no deployed production runtime / SLO; the six new tables + generated PDFs add persisted state but no live runtime to fail over in Phase A | N/A (deferred) ⚠️→✅ |
| 5 | Security | 6 quote tables: direct `tenant_id` + enable+**force** RLS + own-tenant `is_tenant_admin` policies + no anon grant + `TENANT_TABLES` enrollment; composite same-tenant FKs + command re-validation reject foreign calc/attachment/version ids (`TENANT_ACCESS_DENIED`); PDF stored in the private `tenant-files` bucket via a server-derived tenant-first path, upload+signing on the RLS client (no service-role — containment guard), short-lived signed URL, no public URL; sent-lock/child-lock/append-only triggers `SECURITY INVOKER` + empty search_path + revoke-public/grant-authenticated; no internal notes/cost/margin in customer-visible output; no PII in any fixture | PASS ✅ |
| 6 | Monitorability / Debuggability / Manageability | Typed `QUOTE_VERSION_NOT_DRAFT`/`QUOTE_VERSION_LOCKED`/`VALIDATION_FAILED`/`TENANT_ACCESS_DENIED`; the write-error mapper maps QV409/23503/42501/23505/23514/22P02 with no raw pg message leak; `pdf_status` (not_generated/generating/generated/failed) makes render state observable + retryable; quote_events timeline + allow-listed `{ targetId }` audit rows on create/mark-sent/new-version | PASS ✅ |
| 7 | QoS / QoE (commitment integrity = the "quality of service") | Snapshot is a complete copy-by-value freeze (mutate-every-source-after-capture ⇒ byte-unchanged); PDF reads snapshot only (mutate-then-regenerate ⇒ text unchanged) + is deterministic (pinned renderer/fonts/sv-SE/injected instant); money/VAT/totals captured from engine state verbatim, never re-derived; hidden rows excluded from PDF line list but still count toward frozen totals (review fix, `render.ts:202`) | PASS ✅ |
| 8 | Deployability | New migrations reset cleanly with per-table policy enumeration + deferred-table absence; `verify` job (lockfile, **`pnpm audit --audit-level=high` — NEW this epic**, service-role containment, typecheck, lint, unit, build, bundle-containment) + `db` job (`test:int`, `SUPABASE_TEST_REQUIRED=1`) + `e2e` job all present and green | PASS ✅ (dependency-scan gate NOW present) |

**Also standing:** **Vulnerability management** — 0 critical / 0 high is now **enforced by an automated gate**, not merely asserted by pins + frozen-lockfile. The blocking `pnpm audit --audit-level=high` step in the CI `verify` job (`.github/workflows/ci.yml:71-72`) fails the build on any HIGH/CRITICAL advisory against the installed tree. **This closes the concern carried un-actioned across Epics 2-5** and satisfies the Epic 5 retro's HARD MECHANISM (R-617). The vulnerability-management category is now **PASS**, not CONCERNS.

---

## Performance Assessment

### Response Time (p95) / Throughput / Resource Usage / Scalability (runtime)

- **Status:** N/A (deferred) ⚠️→✅
- **Threshold:** UNKNOWN — no Phase-A SLA/SLO defined for quote-version creation or PDF generation (test-design R-618: "PDF render latency / generation at scale untested — pilot-sized load only, no SLA").
- **Actual:** Snapshot building and the PDF view model are pure, synchronous, in-memory integer-öre transforms over quote-sized inputs (single pilot tenant). Version creation, mark-sent, new-version, and lifecycle transitions run through narrow single-transaction RPCs under RLS. PDF generation renders one quote at a time via the pinned `pdf-lib 1.17.1` (base-14 Helvetica, no headless-browser dependency) — a deliberately lightweight renderer chosen partly for determinism, incidentally cheap. No load/latency SLA exists to measure against; no bulk-generation path is in scope (Epic 6 non-scope).
- **Evidence:** `src/lib/quote-snapshot/**`, `src/lib/quote-pdf/**` (pure, no I/O in the pure paths); narrow RPCs in migrations `20260705120000`/`20260707120000`/`20260708120000`; `package.json` (`pdf-lib 1.17.1`, no browser renderer); test-design R-618; epic-6 traceability "Residual (documented): PDF render performance / generation at scale untested — pilot-sized, no Phase A SLA."
- **Findings:** Correctly deferred. Functional correctness (isolation + snapshot freeze + PDF source-of-truth + determinism + immutability) — not throughput/latency — is the Phase-A concern. **Carried-forward action (post-pilot):** if a PDF-at-scale or bulk-generation SLA emerges, add a micro-benchmark for `buildQuotePdfViewModel` + the render path and a concurrency profile for the numbering RPC under a realistic tenant fan-out. Determinism is already pinned (see Reliability), so a perf harness would extend, not rework, the existing render tests.

---

## Security Assessment

### Tenant Isolation — 6 new quote tables incl. `tenant_counters` (R-601)

- **Status:** PASS ✅ — the headline control of this epic (six tables at once, the widest single-epic isolation surface of the project).
- **Threshold:** Every new quote table must carry direct `tenant_id` + enable+**force** RLS + own-tenant SELECT/INSERT/UPDATE policies + `anon → none` GRANT + **`TENANT_TABLES` enrollment** (H4 gate must green). `tenant_counters` is tenant-owned state and enrolls like any other table.
- **Actual:** Verified: all six tables (`tenant_counters`, `quotes`, `quote_versions`, `quote_version_lines`, `quote_version_attachments`, `quote_events`) carry the enable+force RLS + own-tenant `is_tenant_admin` policies (migration `20260705120000`) and are enrolled in `tenant-table-inventory.ts` (lines 143-148) with all four metadata seams (cross-tenant spoof/filter, cross-tenant mutation, anon row, anon mutation). The shared cross-tenant + anon suites + the compile-exhaustive H4 inventory gate therefore cover them automatically — an unenrolled tenant table FAILS CI by design (automated backstop, not reviewer diligence). `quote-tables-migration-reset.int.test.ts` (6.1-INT-01) enumerates per-table policies on a from-empty reset and asserts deferred-table absence (no Fortnox/invoice/portal/external-mapping tables).
- **Evidence:** `supabase/migrations/20260705120000_quote_version_model.sql`; `tests/integration/rls/tenant-table-inventory.ts:143-148`; 6.1-RLS-01/02 (cross-tenant + anon + H4 gate, data-driven); 6.1-INT-01 (per-table policy enumeration).
- **Findings:** Structurally correct and machine-enforced. Isolating another tenant's customers + prices *in commitment form* is the highest-impact control in the epic; it is proven, not asserted. `tenant_counters` — the "easy to forget" table the test design specifically flagged — is enrolled.

### Cross-Tenant Source-Id Rejection on Version Creation (R-602)

- **Status:** PASS ✅
- **Threshold:** No quote command may accept a foreign calculation id, or a foreign attachment/file id; a bare non-composite FK is a cross-tenant hole.
- **Actual:** Composite same-tenant FKs at the DB for every source reference, plus command-layer `verifyOwnership` re-validation under RLS (zero rows ⇒ `TENANT_ACCESS_DENIED`). The INT negative spoofs a foreign calculation id AND a foreign attachment/file id in one test, asserting no orphaned quote/version/number is left behind.
- **Evidence:** `quote-version.int.test.ts` 6.1-INT-02 (both spoofs → `TENANT_ACCESS_DENIED`; no orphan); composite same-tenant FK backstop in migration `20260705120000`; the 6.4/6.5 cross-tenant negatives (6.4-RLS-01, 6.5-RLS) extend the same discipline to send/new-version.
- **Findings:** Defense-in-depth (DB composite FK + command re-validation). No single-layer trust.

### Sent-Immutability at BOTH Layers (R-605) — the load-bearing security/data-integrity control

- **Status:** PASS ✅
- **Threshold:** A sent version's customer-visible fields, lines, and attachments must be immutable through ANY command path (⇒ `QUOTE_VERSION_LOCKED`) AND through a direct own-tenant authenticated SQL UPDATE (DB trigger/constraint reject) — UI-only locking is a story STOP.
- **Actual:** Proven at both layers. Command: `mark-quote-version-sent.int.test.ts` 6.4-INT-02 mutates a sent version via command → exact `QUOTE_VERSION_LOCKED`, message leak-free (no update/select/status/QV409 detail). Database: 6.4-INT-03 issues a DIRECT own-tenant authenticated UPDATE of `intro_text`/`base_total_ore` on a sent row → rejected by the `enforce_quote_version_sent_lock()` trigger via SQLSTATE `QV409`, while the EXEMPT `pdf_status`/`pdf_file_id`/`pdf_generated_at` columns stay mutable (6.3 render obligation). The trigger is fail-closed by construction (exempt allow-list; everything else — incl. identity/`quote_id` — locked-by-default) with a legal-transition guard (a `sent→draft` reversal RAISES). Child rows (`quote_version_lines`/`_attachments`) are locked by `enforce_quote_version_child_sent_lock()`; `quote_events` is append-only via `quote_events_append_only`.
- **Evidence:** migration `20260707120000_quote_version_sent_lock.sql` (three triggers, QV409); `mark-quote-version-sent.int.test.ts` 6.4-INT-02 (command) + 6.4-INT-03 (direct SQL + exempt-mutable + the two review-added negatives: `sent→draft` reversal AND `quote_id` re-parent).
- **Findings:** Excellent. This is the audit property every later epic (acceptance, jobs, migration sign-off) builds on. The two Med review findings during the 6.4 run — a `sent→draft` reversal disarming the lock, and an own-tenant `quote_id` re-parent slipping past the compared tuple — were **RESOLVED with a legal-transition guard + identity/parent columns added to both comparison tuples + two new 6.4-INT-03 negatives**, proven closed in-source. Not a residual.

### Private PDF-File Access (R-611)

- **Status:** PASS ✅
- **Threshold:** The generated PDF must be stored via the 8.1 foundation (private bucket, server-derived path, metadata-first authorization, signed access); cross-tenant + anon access to the file/metadata rejected; no public URL surface.
- **Actual:** The PDF is stored in the private `tenant-files` bucket via a server-derived tenant-first path; upload + signing run on the **RLS client — no service-role** (verified by the standing `verify:service-role-containment` + `verify:bundle-containment` gates); `files`/`file_links` (`quote_version`/`quote_pdf`) + a `quote_event` + an audit row record it; preview/download use a short-lived SIGNED URL (token/expiry), never a public/permanent object path. Cross-tenant + anon access to the file/metadata is rejected.
- **Evidence:** `generate-quote-pdf-storage-privacy.int.test.ts` 6.3-INT-02 (metadata + link + event; cross-tenant + anon rejected; no public URL); 8.1 file foundation (landed `20260704120000`, before Epic 6).
- **Findings:** Correct — reuses the 8.1 private-file foundation, does not invent a local storage model (the 6.3 STOP the test design guarded against). Full storage-negative breadth (MIME/size/spoofing matrix) is correctly deferred to Epic 8.

### Internal-Content Exclusion (R-607)

- **Status:** PASS ✅
- **Threshold:** No internal notes, `unit_cost_ore`/margin, or hidden-row internals may reach customer-visible snapshot fields or the PDF.
- **Actual:** `quote_version_lines` carries no cost/margin/internal columns by data model (first belt). The second belt is `toCustomerVisibleLine` (6.2-UNIT-01) and the pure `buildQuotePdfViewModel` type surface (6.3-UNIT-01), both driven with internal fields at the SOURCE and asserting absence in the output. The review-fixed hidden-row handling (`render.ts:202` filters `line.isHidden` out of the rendered line list while totals stay verbatim) closes the one place a hidden internal row could have printed.
- **Evidence:** `quotes/view-model.test.ts` 6.2-UNIT-01; `quote-pdf/view-model.test.ts` 6.3-UNIT-01; `src/server/quote-pdf/render.ts:202` (hidden-row exclusion, review fix); the golden `mustNotAppear` pins the hidden label.
- **Findings:** Leakage-by-construction, belt-and-braces. The hidden-row Med review finding is RESOLVED, not carried.

### Data Protection — No PII in fixtures (R-615)

- **Status:** PASS ✅
- **Threshold:** No personnummer/orgnr/name/email/phone/address/secret in any quote or PDF golden fixture or extracted-text asset.
- **Actual:** `quote-snapshot/golden-pack.test.ts` + `quote-pdf/pdf-text-golden.test.ts` (6.x-UNIT-01) run the extended PII/secret scan (personnummer `\d{6}-\d{4}`, orgnr `\d{10}`, non-`example.test` email, secret/password/api_key/bearer/service_role, phone) over the snapshot + PDF-text fixtures, keeping every öre value < 10 digits to avoid the orgnr false-positive trap. Fixtures are anonymized shape-only, origin-labelled.
- **Evidence:** `tests/unit/lib/quote-snapshot/golden-pack.test.ts`, `tests/unit/lib/quote-pdf/pdf-text-golden.test.ts` (part of `pnpm test:unit` in the CI `verify` job).
- **Findings:** Strong. The SEC control that makes the quote/PDF goldens safe to commit; it runs on every PR. Consistent with the Epic 4/5 fixture-privacy discipline, extended (not forked) to quote + PDF-extracted text.

### Input Validation / Vulnerability Management

- **Status (input validation):** PASS ✅ — typed `VALIDATION_FAILED` for a draft-parent on new-version, illegal lifecycle transitions, bad öre (canonical `isOreAmount`/`ORE_AMOUNT_MAX`, no fork); `QUOTE_VERSION_NOT_DRAFT` for draft-edit scope; the raw invalid value is never echoed; the write-error mapper maps QV409/23503/42501/23505/23514/22P02 with no raw pg message leak.
- **Status (vulnerability management):** **PASS ✅ — the standing CONCERNS carried Epics 2-5 is RESOLVED this epic.**
- **Threshold:** 0 critical / 0 high dependency vulnerabilities, **gated in CI**.
- **Actual:** The CI `verify` job carries a blocking `pnpm audit --audit-level=high` step (`.github/workflows/ci.yml:71-72`) that fails the build on any HIGH/CRITICAL advisory against the installed tree (owner decision 2026-07-03: high/critical fail; moderate/low logged). Epic 6 added the pinned `pdf-lib 1.17.1` + `pdfjs-dist 4.10.38` (devDependency) renderer/extraction pair — a new dependency surface — now covered by the automated gate on every PR.
- **Evidence:** `.github/workflows/ci.yml:71-72` ("Audit dependencies (blocking, high severity)"); `package.json` (`pdf-lib 1.17.1`, `pdfjs-dist 4.10.38`); the write-error mapper + `command-errors.ts` union (`QUOTE_VERSION_NOT_DRAFT` + `QUOTE_VERSION_LOCKED`); the two review-added negatives in 6.4-INT-03.
- **Findings:** Both a strength now. Input validation was already strong; vulnerability management is **no longer a carry** — the R-617 hard mechanism from the Epic 5 retro is satisfied by a real blocking gate, and it is the first PR to add a new runtime/dev dependency (the PDF renderer) covered by that gate from day one.

---

## Reliability Assessment

### Snapshot Freeze + PDF Source-of-Truth (R-603 / R-606) — the reliability properties of this epic

- **Status:** PASS ✅
- **Threshold:** (a) A quote version's snapshot must NOT change when any source (calc rows, pricing, settings, terms, CRM display) is mutated after creation — copy-by-value + `Object.freeze` + injected `capturedAt`. (b) The PDF must read ONLY the snapshot tables; mutating any mutable source after snapshot and regenerating must leave the output unchanged.
- **Actual:** (a) `quote-version.int.test.ts` 6.1-INT-04 mutates every mutable source AFTER version creation and asserts the snapshot is byte-unchanged (not merely field-exists); the pure builders (`quote-snapshot/build.test.ts` 6.1-UNIT-01) are copy-by-value, `Object.freeze`, injected clock, capture-not-compute. (b) `generate-quote-pdf-source-of-truth.int.test.ts` 6.3-INT-01 creates a version, generates the PDF, mutates every mutable source (`customers`/`company_settings`/`quote_terms`/`calculation_*`/`work_roles`/`articles`), regenerates, and asserts the extracted PDF text is UNCHANGED; the `buildQuotePdfViewModel` input surface is provably snapshot-only.
- **Evidence:** `quote-version.int.test.ts` 6.1-INT-04; `quote-snapshot/build.test.ts` + `build-edges.test.ts` 6.1-UNIT-01; `generate-quote-pdf-source-of-truth.int.test.ts` 6.3-INT-01; `quote-pdf/view-model.test.ts` 6.3-UNIT-01.
- **Findings:** The two behavioral proofs the test design demanded (freeze + source-of-truth), both proven behaviorally not structurally. This is the guarantee that a sent quote (and its PDF) cannot silently drift when a rate/setting later changes — reuses the three-times-proven copy-by-value freeze discipline (Epic 3 snapshot → Epic 4 golden → Epic 5 pricing-source) at composite-quote scale.

### Prior-Version Preservation on v2 + Lifecycle (R-609)

- **Status:** PASS ✅
- **Threshold:** Creating v2, or recording a rejected/expired/superseded event, must leave v1's full snapshot + lines + attachments + PDF metadata + prior events + status history byte-unchanged (only the sanctioned `status`→superseded flip + one appended event).
- **Actual:** `create-new-quote-version.int.test.ts` 6.5-INT-02 reads v1 before/after v2 creation and after a standalone lifecycle event and deep-equals the frozen columns; the `quote_events_append_only` trigger blocks any prior-event mutation. The v1/v2 golden (6.5-GOLDEN-01) pins what changed (v2) vs what was preserved (v1).
- **Evidence:** `create-new-quote-version.int.test.ts` 6.5-INT-02; `quote-snapshot/golden-v1-v2.test.ts` 6.5-GOLDEN-01; the append-only event trigger in `20260708120000`/`20260707120000`.
- **Findings:** Correct. New versions are additive; the historical record is immutable.

### PDF Determinism + Retry (R-612 / R-613)

- **Status:** PASS ✅
- **Threshold:** Same snapshot rendered twice ⇒ comparable output (pinned renderer/fonts/locale, injected timestamp); retry regenerates from the same snapshot without changing customer-visible data; a mid-pipeline failure leaves a consistent, retryable state.
- **Actual:** `generate-quote-pdf-determinism.int.test.ts` 6.3-INT-03 pins `pdf-lib 1.17.1`, base-14 Helvetica, sv-SE locale, and an injected `/CreationDate` instant → run-to-run text-comparable. `generate-quote-pdf-retry-consistency.int.test.ts` 6.3-INT-04 injects a mid-pipeline fault → `pdf_status='failed'`, retryable, customer-visible values unchanged; the E2E specs exercise the not_generated/generating/generated/failed/retry/preview/download states.
- **Evidence:** `generate-quote-pdf-determinism.int.test.ts` 6.3-INT-03; `generate-quote-pdf-retry-consistency.int.test.ts` 6.3-INT-04; `quote-pdf-states.e2e.spec.ts` 6.3-E2E-01/02; `package.json` renderer pins.
- **Findings:** Strong. Determinism is the property that makes the text golden meaningful and retry safe. The one Low residual — the 6.3 PDF metadata persisted via separate non-transactional RLS-client inserts rather than the `create_file_with_link` RPC — is AC-permitted (verified-compensated; `pdf_status='failed'` on any fault) and routed to reconcile with the Story 8.2 upload path.

### Error Handling / Fault Tolerance

- **Status:** PASS ✅
- **Threshold:** Every invalid/boundary path returns a typed, user-safe failure — never a silent wrong number; multi-step writes never partially apply; the sent-lock is fail-closed.
- **Actual:** Commands return typed `Result<T, CommandErrorCode>` (never throw); the sent-lock trigger is fail-closed by allow-list (everything not explicitly PDF-exempt is locked); the numbering RPC allocates inside the insertion transaction; the write-error mapper never leaks a raw pg message. Illegal lifecycle transitions are rejected at both layers (command `VALIDATION_FAILED` + DB `QV409`).
- **Evidence:** `mark-quote-version-sent.int.test.ts` 6.4-INT-02/03; `create-new-quote-version.int.test.ts` 6.5-INT-03; `lifecycle-transition.test.ts` (pure closed transition map); the error-handling knowledge fragment.
- **Findings:** Strong fault isolation for a full-stack epic. Failures are observable (typed codes + `pdf_status`), not swallowed; the immutability trigger defaults to locked, not open.

### Availability / MTTR / Disaster Recovery

- **Status:** N/A (deferred) ⚠️→✅ — no deployed production runtime/SLO in Phase A; the new tables + PDFs add persisted state but no live runtime to fail over.
- **Findings:** Correctly out of scope for Phase A, consistent with Epics 2-5.

### CI Burn-In (Stability)

- **Status:** PASS ✅
- **Threshold:** Deterministic, non-flaky suite; 100% pass; INT/RLS/E2E hard-fail on a missing stack (no silent false-green).
- **Actual:** **1016/1016** unit+golden pass (0 fail, 0 skip) per the 6.5 automation record + epic-6 traceability (658→929 after 6.2→979 after 6.4→**1016 after 6.5**); INT ~477→**520 pass** across 48 files; E2E ~66→**74 pass**. No active `.skip`/`.only`/`fixme`/`notYetImplemented` in executable Epic 6 code (the single skip-scan match is a comment-line explaining the red-phase clearing discipline). INT/RLS run under `SUPABASE_TEST_REQUIRED=1` (a missing stack is a HARD failure — the Kong→GoTrue 502 false-green trap avoided via `/auth/v1/health` 200 poll after `supabase db reset`). Count-asserting tests seed `crypto.randomUUID()`; goldens live under `tests/unit/**`.
- **Evidence:** automation-summary-6-5.md; epic-6-traceability-report.md (§ "Local run confirmation"); `.github/workflows/ci.yml` (`db` job `SUPABASE_TEST_REQUIRED: "1"`).
- **Findings:** Deterministic across the widest suite of the project. The single INT flake noted in the trace report (`storage-object-isolation.rls.test.ts`, a pre-existing signed-URL-expiry TIMING test unrelated to Epic 6) passes on isolated re-run and is not a regression.

---

## Maintainability Assessment

### Test Coverage (priority-weighted)

- **Status:** PASS ✅ (trace-coverage) / CONCERNS ⚠️ (line-coverage reporter absent)
- **Threshold:** P0 100% / P1 ≥90% / overall ≥80% priority-weighted (test-design gate); snapshot builders + view model + lifecycle/send-gate pure logic ≥90%; RLS negatives 100% of the 6 tables; freeze/immutability 100% of mutable-source classes; PDF source-of-truth 100% of forbidden sources; §11 snapshot field checklist 100%.
- **Actual:** Priority-weighted trace coverage is **~97%** (34/35 mapped FULL; P0 100% = 23/23, P1 ~92% = 11/12 FULL — the one non-FULL is the sanctioned never-gate visual-snapshot secondary golden 6.3-GOLDEN-02). No line-coverage % is computed (no `c8`/`nyc` reporter wired) — the same minor forward gap carried from Epics 2-5; priority-weighted trace coverage remains the governing metric.
- **Evidence:** epic-6-traceability-report.md (Coverage Summary + Gate Criteria, gate PASS); no `c8`/`nyc`/coverage step in `package.json`/CI (grep-confirmed absent).
- **Findings:** Coverage of the critical isolation + freeze + immutability + PDF-source-of-truth contract is exhaustive at the correct levels (RLS/INT for isolation & immutability; UNIT/GOLDEN for snapshot & view model; INT for PDF source-of-truth/determinism/retry; E2E for the journeys). The missing reporter is a low-priority ergonomics gap, not a correctness gap — **now the single remaining standing CONCERNS** (the `pnpm audit` twin was resolved this epic).

### Code Quality / Technical Debt

- **Status:** PASS ✅
- **Threshold:** typecheck 0 errors, lint clean; single-source-of-truth (no forked money/öre/VAT authority; the readiness classifier reused not forked for the send gate); snapshot/PDF/timeline/lifecycle logic extracted OUT of client islands into pure functions.
- **Actual:** typecheck/lint/build green per the story records + traceability. `send-gate.ts` consumes the SAME 5.4 `classifyReadiness` classification (no fork). PDF money/VAT/totals are captured snapshot values displayed through the single öre→kronor formatter, never re-derived. Pure functions (`send-gate`/`timeline`/`view-model`/`lifecycle-transition`/snapshot builders/PDF view model) are extracted from the `"use client"` islands and unit-pinned (coverage-shape lesson applied).
- **Evidence:** 6.1-6.5 implementation-artifacts (verify green); `src/features/quotes/send-gate.ts` (reuses 5.4 classifier); `src/lib/quote-pdf/view-model` (snapshot-only, single formatter); epic-6-traceability heuristics.
- **Findings:** Low technical debt. The single-authority discipline (one engine, one classifier, one öre-validity rule, one formatter) prevents the "second rounding mode / forked total / forked send-gate" drift the test design targets.

### Documentation Completeness

- **Status:** PASS ✅
- **Actual:** Each story's Dev Agent Record documents scope guardrails (no email-send/portal/public-acceptance surface, no Fortnox/invoice/portal tables, Epic 7 acceptance boundary), the narrow-RPC decisions (ADR-A009), the DB-trigger immutability design, the intentional Lovable delta (mutable versions vs Phase A immutability, recorded in the `20260707120000`/`20260708120000` migration headers), and reviewer-resolved findings. The test-design + traceability reports enumerate the sanctioned scope decisions and route the standing NFR items + owner residuals. Source headers document the freeze/source-of-truth/non-final-tax framing verbatim.
- **Evidence:** 6.1-6.5 implementation-artifacts; test-design-epic-6.md; epic-6-traceability-report.md; migration headers `20260707120000`/`20260708120000`.
- **Findings:** Complete and reconciled; deferred/owner-gated items are logged with owners, not lost.

### Test Quality (from trace/automation review)

- **Status:** PASS ✅
- **Actual:** Tests are mechanism-asserting: freeze proven behaviorally (mutate-every-source-after-capture ⇒ byte-unchanged); PDF source-of-truth proven behaviorally (mutate-then-regenerate ⇒ text unchanged); immutability proven at BOTH layers with exact error codes (`QUOTE_VERSION_LOCKED` + trigger `QV409`) INCLUDING the two review-added negatives (`sent→draft` reversal, `quote_id` re-parent); cross-tenant/anon negatives data-driven off the shared inventory (H4 = compile-exhaustive completeness backstop); numbering is a `Promise.all` concurrency test (sleep-free); goldens carry the origin-labelling discipline. No happy-path-only criterion detected; no vacuous-green trap (goldens under `tests/unit/**`, count tests seed random UUIDs, injected clocks).
- **Evidence:** epic-6-traceability-report.md (Coverage Heuristics — all COVERED, "Happy-path-only: NONE detected"); the INT/UNIT/GOLDEN test inventory.
- **Findings:** High test quality — negatives before positives, behavioral freeze/source-of-truth/immutability oracles, both-layer immutability proofs, no vacuous-green traps. The two Med review findings were closed with new negatives, tightening the suite rather than deferring.

---

## Custom NFR Assessments (Epic-6-specific)

### Commitment Immutability by Two Independent Layers (command + DB trigger)

- **Status:** PASS ✅
- **Threshold:** A sent version must be immutable through the command layer AND at the database, with the DB layer fail-closed (locked-by-default, only an explicit exempt allow-list mutable) and a legal-transition guard preventing lock disarmament.
- **Actual:** Command guard (`QUOTE_VERSION_LOCKED`) + DB triggers (`enforce_quote_version_sent_lock`, `enforce_quote_version_child_sent_lock`, `quote_events_append_only`, all `QV409`); the sent-lock is fail-closed by allow-list (only `pdf_status`/`pdf_file_id`/`pdf_generated_at` exempt; identity/`quote_id`/customer-visible columns locked); a `sent→draft` reversal RAISES. Both the command path (6.4-INT-02) and the direct-SQL path (6.4-INT-03, incl. reversal + re-parent) are proven.
- **Evidence:** migration `20260707120000_quote_version_sent_lock.sql`; `mark-quote-version-sent.int.test.ts` 6.4-INT-02/03.
- **Findings:** This is the defining NFR guarantee of Epic 6 — the audit property every later epic depends on. Proven at both layers, fail-closed, with the two review-hardened trigger holes closed. UI-only locking (a story STOP) was correctly avoided.

### PDF Source-of-Truth + Determinism (the "correctness of the customer-visible document")

- **Status:** PASS ✅ — covered in full under Reliability (R-606 source-of-truth + R-612 determinism). The PDF reads snapshot tables ONLY (mutate-then-regenerate ⇒ text unchanged), renders deterministically under a pinned renderer/fonts/locale/injected instant, excludes internal notes/cost/margin, and carries the non-final ROT/grön/VAT framing (`requiresSignOff`) — never presented as legally-final. A PDF that disagreed with its own snapshot, or that leaked internal data, would be a STOP; none introduced.

---

## Quick Wins

1 quick win identified for immediate implementation:

1. **Wire a coverage reporter (`c8`) over `test:unit`** (Maintainability) — LOW — ~1-2 h
   - Emit line-coverage for the pure `src/features/quotes/**` + `src/lib/quote-snapshot/**` + `src/lib/quote-pdf/**` surfaces so the ≥90% snapshot/view-model/lifecycle-logic target has a machine number alongside the (already-~97%) priority-weighted trace coverage. Report-only; do not gate on it initially. This is the sole remaining item from the two standing CONCERNS carried since Epic 2 — the other (`pnpm audit`) was closed this epic.

---

## Recommended Actions

### Immediate (Before Release) — CRITICAL/HIGH Priority

None. No CRITICAL/HIGH NFR issue; no release blocker for the Epic-6 deliverable. All ten Non-Negotiable epic blockers met and test-proven, including R-617 (`pnpm audit`) now resolved as a blocking CI gate.

### Short-term (Next Milestone) — MEDIUM Priority

1. **Keep the R-610 demo-data-only tax/terms accept visible** — MEDIUM — Owner
   - The tax/terms wording ships as UNAPPROVED placeholders with `requires_sign_off` + non-final framing (owner decision 2026-07-03; MVP demo-data-only). **Re-score R-610 to a blocker and reinstate the owner/accounting/legal sign-off session immediately if real-customer use is proposed before sign-off.** Keep the framing tests (6.3-GOLDEN-01 pins the framing). This is a decision/entry-condition, not a code fix.

### Long-term (Backlog) — LOW Priority

1. **Coverage reporter** — LOW — ~1-2 h — Dev (report-only; the single remaining standing CONCERNS).
2. **`quote_events` INSERT-forgeability below the RPC** — LOW — Dev — a later quote-events hardening pass / RBAC seam (the app derives authorization from `quote_versions.status`, not events, so this is an event-log integrity gap, not an auth hole).
3. **6.3 PDF-metadata transactionality** — LOW — Dev — reconcile the non-transactional RLS-client metadata inserts (currently AC-permitted verified-compensated, `pdf_status='failed'` on fault) with the Story 8.2 general-upload path; optionally add an `audit_events` row on the failed→retryable PDF transition.
4. **Quote number in the frozen snapshot JSON + §24 display format** — LOW/owner-gated — Dev + Owner — the raw integer `quote_number` is persisted on the row (the persisted truth); threading it into the frozen composite JSON is a later 6.x follow-up, and the §24 DISPLAY format is an open owner question. No AC break.
5. **Two 6.5 test-completeness tightenings** — LOW — Dev — 6.5-INT-01 mutates only the source calc price at INT (broader change-list breadth is proven value-level in 6.5-GOLDEN-01); 6.5-INT-02 re-reads PDF columns only on the v2-creation path (the standalone-lifecycle RPC touches only the exempt `status` column). Behavior is safe; tighten opportunistically.
6. **PDF-at-scale micro-benchmark (R-618)** — LOW — Dev — only if a Phase-A/post-pilot PDF or bulk-generation SLA emerges.

---

## Monitoring Hooks

Runtime monitoring is **N/A for Phase A** (no deployed runtime/SLO). The applicable "monitoring" is the CI full-pyramid gate + the quote/PDF golden oracle + the H4 inventory gate + the now-present dependency-scan gate:

- [x] **Snapshot + PDF-text golden pack (with v1/v2 comparison)** — the recurring regression oracle; a labelled failure points at the affected snapshot/PDF assumption. **Owner:** Dev. **Runs:** every PR (`test:unit`).
- [x] **H4 `TENANT_TABLES` inventory gate** — a new tenant table (incl. `tenant_counters`) left unenrolled FAILS CI (compile-exhaustive). **Owner:** Dev. **Runs:** every PR (`test:int`, `SUPABASE_TEST_REQUIRED=1`).
- [x] **Quote/PDF fixture PII/secret scan** — CI unit gate detects any PII/secret introduced into the snapshot/PDF fixtures + extracted text. **Owner:** Dev.
- [x] **`pnpm audit --audit-level=high` gate** — detects a newly-disclosed dependency CVE (incl. against the new `pdf-lib`/`pdfjs-dist`) before merge. **Owner:** Ops/Dev. **Runs:** every PR (`verify` job). *(NEW this epic — the previously-standing gap, now closed.)*

---

## Fail-Fast Mechanisms

- [x] **Isolation gates (Security):** enable+force RLS + own-tenant policies + composite same-tenant FKs + mandatory `TENANT_TABLES` enrollment (H4 gate) on all 6 quote tables — an unenrolled table fails CI. Present.
- [x] **Immutability gates (Data integrity):** sent-lock + child-lock + append-only triggers (`QV409`) fail-closed by allow-list + a legal-transition guard; command `QUOTE_VERSION_LOCKED` — a sent version is unmutable through any path. Present.
- [x] **Validation gates (Security):** typed `QUOTE_VERSION_NOT_DRAFT`/`QUOTE_VERSION_LOCKED`/`VALIDATION_FAILED`/`TENANT_ACCESS_DENIED` + the leak-free write-error mapper — no silent wrong number, raw value/pg message never echoed. Present.
- [x] **Dependency-scan gate (Deployability/Security):** blocking `pnpm audit --audit-level=high` in CI — a HIGH/CRITICAL advisory fails the build. Present *(NEW this epic)*.
- [x] **Smoke/fast gate (Maintainability):** the pure `test:unit` suite (1016 unit+golden) is the fast fail-fast gate on every PR; the snapshot/PDF-text goldens catch a commitment regression instantly. Present.
- [x] **Structural sign-off gate (Compliance):** snapshot/PDF carry `requiresSignOff` + non-final framing + no legally-final path — a fail-fast against shipping unapproved tax as final. Present.
- [ ] **Rate limiting / circuit breakers:** N/A — no external-facing runtime service surface in Epic 6 (no email/portal/public-acceptance path by design).

---

## Evidence Gaps

1 evidence gap identified — LOW priority, deliberately deferred (not action-required for the Epic-6 gate):

- [ ] **Line-coverage report** (Maintainability) — **Owner:** Dev — **Deadline:** backlog — **Suggested Evidence:** `c8` lcov over `test:unit` — **Impact:** LOW — priority-weighted trace coverage is ~97% (P0 100%); this is an ergonomics number, not a correctness gap. **This is the last of the two concerns carried since Epic 2** (the `pnpm audit` twin was closed this epic).

**Closed this epic (was an evidence gap Epics 2-5, now resolved):** dependency-vulnerability scan — the blocking `pnpm audit --audit-level=high` CI step (`.github/workflows/ci.yml:71-72`) now enforces 0 high/critical on every PR.

**Documented residual (not an evidence gap):** PDF render performance / generation at scale (R-618) — pilot-sized single-quote renders only, no Phase A SLA; add a micro-benchmark only if an SLA emerges.

**Documented, dated accept (not an evidence gap):** demo-data-only tax/terms wording (R-610) — surfaced above; re-score to a blocker + reinstate the sign-off session if real-customer use is proposed.

---

## Findings Summary

**Based on ADR Quality Readiness Checklist (8 categories)**

| Category | Overall Status |
| -------- | -------------- |
| 1. Testability & Automation | PASS ✅ |
| 2. Test Data Strategy | PASS ✅ |
| 3. Scalability & Availability | PASS ✅ (harness) / N/A runtime (deferred) |
| 4. Disaster Recovery | N/A (deferred) ⚠️→✅ |
| 5. Security | PASS ✅ |
| 6. Monitorability / Debuggability / Manageability | PASS ✅ |
| 7. QoS & QoE (commitment integrity) | PASS ✅ |
| 8. Deployability | PASS ✅ (dependency-scan gate NOW present) |
| **Vulnerability Management (cross-cutting)** | **PASS ✅ (RESOLVED this epic — was CONCERNS Epics 2-5)** |
| **Maintainability — line-coverage reporter** | **CONCERNS ⚠️ (sole remaining standing carry)** |
| **Overall** | **PASS (advisory) ✅ — 7 PASS, 1 CONCERNS, 0 FAIL** |

**Scoring:** In-scope categories: 7 PASS, 1 CONCERNS (no line-coverage reporter — LOW priority), 0 FAIL. Runtime performance/load (R-618) and availability/DR are N/A — deferred for the internal pilot (no SLA/production runtime yet). **The `pnpm audit` CONCERNS carried across Epics 2-5 is RESOLVED this epic** (blocking CI gate). No new HIGH-priority NFR issue.

---

## Non-Negotiable Epic Blockers (test-design gate) — all MET

| Blocker | Status | Proven by (verified in-source) |
| --- | --- | --- |
| Every new quote table (incl. `tenant_counters`): direct `tenant_id` + enable+force RLS + own-tenant policies + `anon → none` + `TENANT_TABLES` enrollment (H4 green) | MET | migration `20260705120000`; `tenant-table-inventory.ts:143-148` (6 tables, 4 seams each); 6.1-RLS-01/02 |
| No cross-tenant calculation/attachment/version id accepted | MET | composite same-tenant FKs; 6.1-INT-02; 6.4-RLS-01; 6.5-RLS |
| Sent versions immutable at the DATABASE (trigger/constraint), not just command/UI; command ⇒ `QUOTE_VERSION_LOCKED` | MET | triggers in `20260707120000` (QV409); 6.4-INT-02 (command) + 6.4-INT-03 (direct SQL + reversal + re-parent) |
| PDF reads snapshot tables only — regenerate-after-mutation proof green | MET | 6.3-INT-01 (mutate-source-then-regenerate ⇒ PDF text unchanged) |
| Quote numbers allocated server-side, race-safe, tenant-scoped, inside the RPC transaction | MET | 6.1-INT-05 (`Promise.all` concurrency); RPC counter lock + 6.5 parent-quote `FOR UPDATE` |
| Blocking readiness gates mark-sent; tax content framed estimate + `requiresSignOff`, never legally-final | MET | `send-gate.ts` reuses 5.4 classifier; 6.4-UNIT-01 + 6.4-INT-04; framing pinned (6.3-GOLDEN-01) |
| v2 creation and lifecycle events leave prior sent versions byte-unchanged | MET | 6.5-INT-02; 6.5-GOLDEN-01; append-only event trigger |
| No internal notes / cost / margin data in customer-visible snapshot fields or PDF output | MET | 6.2-UNIT-01 + 6.3-UNIT-01; hidden-row exclusion `render.ts:202`; data model carries no such columns |
| No real PII/secret in any quote/PDF fixture or committed artifact (CI scan green) | MET | 6.x-UNIT-01 extended PII scan over snapshot + PDF fixtures |
| **R-617 resolved: audit-gate PR landed OR dated owner-accept — not a fifth silent carry** | **MET** | `.github/workflows/ci.yml:71-72` blocking `pnpm audit --audit-level=high` (owner decision 2026-07-03) — the audit-gate landed, not a dated-accept fallback |

---

## Gate YAML Snippet

```yaml
nfr_assessment:
  date: '2026-07-06'
  epic: 6
  feature_name: 'Quote Versions, PDF, And Lifecycle'
  assessment_level: epic
  trace_coverage: '34/35 FULL (~97%; P0 23/23=100%, P1 11/12=~92%, P2 ~100%, P3 documented)'
  categories:
    testability_automation: PASS
    test_data_strategy: PASS
    scalability_availability: PASS # harness; runtime N/A (deferred)
    disaster_recovery: N/A # deferred (no production runtime/SLO)
    security: PASS # 6-table isolation + both-layer immutability + private PDF + no-PII + non-final tax
    monitorability: PASS
    qos_qoe: PASS # snapshot freeze + PDF source-of-truth + determinism + no internal leakage
    deployability: PASS # pnpm audit gate NOW present
    vulnerability_management: PASS # RESOLVED this epic (was CONCERNS Epics 2-5)
    maintainability_coverage_reporter: CONCERNS # no c8/nyc line-coverage reporter (sole remaining carry)
  overall_status: PASS_ADVISORY
  critical_issues: 0
  high_priority_issues: 0
  medium_priority_issues: 1 # keep R-610 demo-data-only tax accept visible (decision, not code)
  concerns: 1 # no line-coverage reporter
  blockers: false
  quick_wins: 1 # wire c8 coverage reporter
  evidence_gaps: 1 # line-coverage report
  resolved_this_epic: # closed a standing carry from Epics 2-5
    - pnpm_audit_dependency_scan_gate # R-617 hard mechanism satisfied (blocking CI step)
  documented_residuals: # not gaps — surfaced not silent
    - demo_data_only_tax_terms_accept # R-610; re-score to blocker if real-customer use proposed
    - quote_events_insert_forgeability_below_rpc # Low; later quote-events hardening / RBAC seam
    - pdf_metadata_non_transactional_inserts # Low; reconcile with Story 8.2 upload path
    - quote_number_not_in_frozen_snapshot_json_plus_s24_display # Low; later 6.x follow-up + owner question
    - two_6_5_int_test_completeness_tightenings # Low; behavior safe
  deferred_na: # not gaps — deferred by Phase-A design
    - runtime_pdf_performance_load_at_scale # R-618 (no SLA, pilot-sized single-quote renders)
    - availability_dr_mttr # no deployed production runtime/SLO
  recommendations:
    - 'Keep R-610 demo-data-only tax/terms accept visible — re-score to blocker + reinstate sign-off session if real-customer use is proposed'
    - 'Wire a coverage reporter (c8) over test:unit — report-only (the sole remaining standing CONCERNS)'
    - 'Route the four Low deferrals to their named owner follow-ups (quote_events INSERT-forgeability; PDF-metadata transactionality; quote-number-in-snapshot + §24 display; two 6.5 test-completeness gaps)'
```

---

## Related Artifacts

- **Test Design:** `_bmad-output/test-artifacts/test-design-epic-6.md`
- **Traceability + Gate (PASS):** `_bmad-output/test-artifacts/traceability/epic-6-traceability-report.md`
- **Prior NFR (format + the two standing concerns, one now resolved):** `_bmad-output/test-artifacts/nfr-assessment-epic-5.md`
- **Story records:** `_bmad-output/implementation-artifacts/6-{1,2,3,4,5}-*.md`
- **Automation summary:** `_bmad-output/test-artifacts/automation-summary-6-5.md`
- **Source under assessment:**
  - `src/features/quotes/**` (send-gate, timeline, view-model, lifecycle-transition); `src/lib/quote-snapshot/**`; `src/lib/quote-pdf/**`; `src/server/quote-pdf/render.ts` (hidden-row exclusion line 202); `src/server/commands/quotes/**`
  - `supabase/migrations/20260705120000_quote_version_model.sql`, `20260706120000_quote_pdf_render_state.sql`, `20260707120000_quote_version_sent_lock.sql`, `20260708120000_quote_new_version.sql`
- **Evidence Sources:**
  - Unit + golden: `tests/unit/lib/quote-snapshot/**`, `tests/unit/lib/quote-pdf/**`, `tests/unit/features/quotes/**`; fixtures `tests/fixtures/golden/snapshots/**`, `tests/fixtures/golden/quote-pdf/**`
  - INT + RLS: `tests/integration/commands/{quote-version,update-draft-quote-version,generate-quote-pdf-*,mark-quote-version-sent,create-new-quote-version}.int.test.ts`, `tests/integration/rls/**` (`tenant-table-inventory.ts` — 6 quote tables enrolled)
  - E2E: `tests/e2e/quotes/**` (4 Playwright specs)
  - CI: `.github/workflows/ci.yml` (`verify` incl. **blocking `pnpm audit --audit-level=high` at lines 71-72** + `db` (`SUPABASE_TEST_REQUIRED=1`) + `e2e` jobs; no `c8`/coverage step)
  - Suite: `pnpm run test:unit` → 1016 pass / 0 fail / 0 skip (per 6.5 automation record + trace report); `test:int` → 520 pass (48 files); `test:e2e` → 74 pass

---

## Recommendations Summary

**Release Blocker:** None. 0 FAIL, 0 blocker; all ten Non-Negotiable epic blockers met and test-proven — including R-617 (`pnpm audit`) now resolved as a blocking CI gate.

**High Priority:** None.

**Medium Priority:** Keep the R-610 demo-data-only tax/terms accept visible (decision/entry-condition, not a code fix) — re-score to a blocker + reinstate the sign-off session if real-customer use is proposed.

**Next Steps:** Epic 6's traceability gate is already **PASS**. This NFR assessment concurs: **PASS (advisory)**. Proceed to `*test-review` then epic close / `*retrospective`. **Notable improvement:** the two-concern standing carry is now down to one — the `pnpm audit` dependency-scan gate was resolved this epic (Epic 5 retro hard mechanism satisfied); only the LOW-priority line-coverage reporter remains. None of the residuals weaken any Epic-6 exit criterion.

---

## Sign-Off

**NFR Assessment:**

- Overall Status: PASS (advisory) ✅
- Critical Issues: 0
- High Priority Issues: 0
- Concerns: 1 (no line-coverage reporter — LOW-priority, carried forward; the `pnpm audit` twin was RESOLVED this epic)
- Evidence Gaps: 1 (line-coverage report — deferred)
- Resolved this epic: `pnpm audit` dependency-scan CI gate (R-617 hard mechanism satisfied)
- Documented Residuals (surfaced, not silent): demo-data-only tax/terms accept (R-610); quote_events INSERT-forgeability below the RPC; PDF-metadata non-transactional inserts; quote-number-in-snapshot + §24 display; two 6.5 test-completeness tightenings
- Deferred N/A (by Phase-A design): runtime PDF performance/load at scale (R-618); availability/DR/MTTR

**Gate Status:** PASS (advisory) ✅ — concurs with the epic-6 traceability gate (PASS)

**Next Actions:**

- PASS ✅: Proceed to `*test-review` / epic close / retrospective.
- Carry the 1 standing CONCERNS forward with an owner (line-coverage reporter — the last of the two-concern carry now that `pnpm audit` is resolved).
- Keep the R-610 demo-data-only tax/terms accept visible; re-score to a blocker + reinstate the owner/accounting/legal sign-off session if real-customer use is proposed.
- Route the four Low deferrals to their named owner follow-ups.

**Generated:** 2026-07-06
**Workflow:** testarch-nfr (epic-level evidence audit)

---

<!-- Powered by BMAD-CORE™ -->
