# Migration Runbook — Phase A Pilot Coexistence

> **Phase A · Internal Pilot MVP · docs-only.** This runbook is the migration/coexistence
> **control point**. It writes no code, no schema, no migration script, and mutates no
> production data. It documents, **per pilot workflow**, the source records, target treatment,
> fallback path, manual-backfill risks, and the **cutover-by-workflow decision** — plus the
> fail-closed **scope-unclear → STOP** protocol. Its companion is the
> [legacy-record classification register](./legacy-record-classification.md) (the four-bucket
> record-group decisions).
>
> **Provenance:** authored by the Epic-9 legacy-record-classification-and-migration-runbook
> story. This one-time provenance line is the only plan-position reference; the durable body
> references **architecture §16 (Migration And Coexistence)** and **§17 (Golden-Master Fixture
> Strategy)**, never "Epic N / Story X-Y" (evergreen-doc anchoring, R-922).

## 1. How To Read This Runbook

- **§2** states the coexistence model and the demo-vs-real-pilot track split.
- **§3** is the per-workflow migration table — one row-group per Phase A pilot workflow, each
  carrying **source records · target treatment · fallback path · manual-backfill risks ·
  cutover-by-workflow decision**.
- **§4** records the Epic-8 pilot-readiness re-score triggers that bind specific workflows.
- **§5** points at the approved asset locations as **seams** for later migration/comparison
  work — without building them here.
- **§6** is the **scope-unclear → STOP for owner clarification** protocol (fail-closed).
- **§7** is the demo-data-only posture (do not conflate the two tracks).
- **§8** is the PII hygiene statement + verification self-check.

**Scope discipline:** cutover is **by workflow, never whole-company** (architecture §16). No
step here exports or imports real customer data — real export/import is a **hard STOP** (§6).

## 2. Coexistence Model

The old Lovable app remains, per architecture §16, the:

- **behavioral oracle** — inspected for behavioral SHAPE only, never quoted with real values,
  never a code/schema source (AR26, Lovable Oracle Policy);
- **fixture source** after anonymization (a later golden-fixture concern; not this doc);
- **fallback** for a selected workflow **until that workflow's pilot acceptance gate passes**
  (NFR21).

It is **not** a code source by default, **not** the schema blueprint for the new twenty-four
tenant-owned tables, and **not** a reason to activate a deferred module.

The new system ships the workflow
`CRM/settings/pricing → calculations → quote versions/PDF/acceptance → basic job/order →
required files` across twenty-four tenant-owned tables and seven nav items. Cutover happens
**one workflow at a time**, each gated independently; there is deliberately **no** "flip the
whole company" step.

## 3. Per-Workflow Migration Table

Each workflow below records the five required fields (AC2). "Live-rebuilt" means the workflow
is rebuilt fresh on the new tenant-owned tables (see the classification register §4.1);
"archive-only" continuity data stays read-only on the Lovable fallback (register §4.2).
**All concrete real-record selections are owner-pending (`8.1`) and STOP-marked (§6).**

### 3.1 CRM (customers · facilities · contacts)

- **Source records (Lovable):** `customers` (+ `customer_sensitive` personnummer),
  `facilities`, `customer_contacts`. Excluded: favorites, customer-360 rollups (register §4.3).
- **Target treatment:** **live-rebuilt** → `customers` / `facilities` / `contacts`.
  Personnummer for `private` customers is stored access-controlled on `customers.personnummer`
  (owner decision 2026-06-18; excluded from list, masked on detail, never in audit) — this
  reflects the CURRENT owner-decided state, not the stale "no personnummer" plan text (R-009).
- **Fallback path:** the Lovable CRM stays the fallback/oracle for customer lookup until the
  CRM workflow's pilot acceptance gate passes (NFR21).
- **Manual-backfill risks:** a human re-enters customer/facility/contact records by hand →
  risk of a **mistyped or omitted personnummer** (blocks a downstream ROT estimate), a
  facility/contact not linked (a quote/job cannot bind to the required facility+contact per
  owner `1.5`), or a customer TYPE mis-set (drives VAT-display posture and ROT eligibility).
  Re-keying real personnummer by hand is a **PII-handling risk** and is a real-customer-data
  action → **STOP** (§6) outside the demo track.
- **Cutover-by-workflow decision:** cut CRM over first (it is upstream of every other
  workflow); the pilot operator creates the small demo customer/facility/contact set fresh in
  the new app. Whole-company customer export is **not** in scope — **STOP** for owner sign-off.

### 3.2 Settings / Pricing (company identity · quote terms · VAT default · work roles · articles)

- **Source records (Lovable):** company settings / VAT default / quote settings (colors,
  logos, terms templates), work roles & prices, own `articles`. Excluded: supplier-linked
  article data (deferred, register §4.4).
- **Target treatment:** **live-rebuilt** → `company_settings` + `quote_terms` + `work_roles` +
  `articles`. The new `articles` table carries **NO** supplier/vendor/sync/api/import/fortnox
  field (enforced by a column-name guard). Quote-terms sign-off is structural (`approved_at`,
  human-only approve path).
- **Fallback path:** Lovable settings/pricing remain the reference until the pricing workflow's
  gate passes.
- **Manual-backfill risks:** re-entering work-role rates or article unit prices by hand →
  risk of a **kronor↔öre or VAT-basis-point transcription error** (the engine stores integer
  öre and basis points; a decimal-comma paste is rejected but a wrong-magnitude value is not);
  a missed logo/terms-text field; a VAT default (`company_togglable`/`company_excl`) mis-set.
  **The tax/VAT numbers themselves are UNAPPROVED placeholders** — rounding (`A.1`), VAT rate
  (`A.2`), ROT/grön rates/caps/basis (Blocks B/C) are `öppen (möte)`; do not treat any migrated
  rate as accounting-final (see §4).
- **Cutover-by-workflow decision:** cut settings/pricing over with CRM (upstream of
  calculations). Demo pricing is entered fresh; real pricing migration waits on the tax
  working session sign-off (real-pilot blocker, demo-non-blocking).

### 3.3 Calculations (Kalkyl)

- **Source records (Lovable):** `calculations`, `calculation_sections`, `calculation_rows`,
  options/tillval, hidden-row and display-mode behavior, calc notes/attachments.
- **Target treatment:** **live-rebuilt** → `calculations` / `calculation_sections` /
  `calculation_rows` (option/hidden flags + `display_mode`). Historical calculations behind
  already-sent quotes are **archive-only** (register §4.2), served by the Lovable fallback,
  not re-imported as editable rows.
- **Fallback path:** Lovable calculations remain the oracle/fallback for a re-quote until the
  calculation workflow gate passes; the golden-master comparison (architecture §17) is the
  correctness evidence layer (a later concern — see §5).
- **Manual-backfill risks:** re-entering calc rows by hand → risk of a **row inclusion
  mistake** (the frozen 2026-06-18 pin: selected tillval + hidden rows COUNT, an unselected
  option does NOT — a human mis-flag changes the total), a **null cost** read (unknown cost is
  "no margin", never a fabricated 100% margin), or a pricing-SOURCE snapshot not frozen
  (copy-by-value, not an FK). Margins/readiness surface as WARNINGS, not blockers.
- **Cutover-by-workflow decision:** cut calculations over after CRM+pricing. Demo calcs are
  built fresh; a real calc is re-created (not bulk-imported) so its frozen source snapshots are
  authored by the new builders, not copied from Lovable shapes.

### 3.4 Quote Versions / PDF / Acceptance

- **Source records (Lovable):** `quotes` + quote versions/statuses, quote lines/attachments,
  terms templates, quote PDF/document generation, quote lifecycle events, quote acceptance
  (accept/reject/lost-reason). Historical sent/accepted quotes are **archive-only**
  (register §4.2). Quote follow-up history is archive-only.
- **Target treatment:** **live-rebuilt** → `quotes` + `quote_versions` (+ `tenant_counters`
  numbering) + `quote_version_lines` / `quote_version_attachments` + `quote_events` +
  `quote_acceptances`; PDF rendered fresh from the frozen snapshot into `files`/`file_links`
  (`purpose='quote_pdf'`), never a copied Lovable PDF. A **sent** version is DB-immutable; a
  change requires a NEW version. Owner-confirmed statuses: Utkast/Skickad/Accepterad/
  Förlorad-Avböjd/Arkiverad (`4.3`).
- **Fallback path:** an already-sent/accepted Lovable quote stays the authoritative commitment
  on the Lovable fallback (read-only) — the pilot does **not** re-open or edit an old sent
  commitment; it re-versions forward for new work. Fallback stays until the quote workflow gate
  passes.
- **Manual-backfill risks:** re-entering a quote by hand → risk of a **frozen-snapshot mismatch**
  (the new version freezes company identity + VAT posture + totals; a hand-typed total that
  disagrees with the calc is a silent divergence the golden comparison exists to catch); an
  **acceptance-evidence gap** (evidence is a file OR external reference — a prose OR-convention,
  no DB XOR); a **zero-frozen accepted price** silently skipping the adjusted-price reason gate.
  The **acceptance-evidence UPLOAD lifecycle** is a known unwired end-to-end path (§4) — a
  manual/fallback consideration for this workflow.
- **Cutover-by-workflow decision:** cut the quote workflow over after calculations. Demo quotes
  are created + sent + accepted fresh. A real quote migration is a **STOP** — sent/accepted
  commitments carry legal/financial weight and their real-record selection is owner-gated
  (`8.1`), and any real-customer quote export requires owner sign-off (§6).

### 3.5 Basic Job / Order

- **Source records (Lovable):** `jobs` (the basic order record) + job created/updated events.
  The extended project surface (work orders, material, diary, deviations, photos, chat, risks,
  reports, schedule phases, job members, project upgrade) is **deferred** (register §4.4) — it
  does NOT migrate.
- **Target treatment:** **live-rebuilt** → `jobs` + `job_events`. A job is auto-created on
  acceptance (`7.2`); its source refs (`quote_acceptance_id`/`quote_version_id`/`customer_id`)
  are immutable; only title/status/planned dates are editable. Job structure (order/arbetsorder/
  projekt relationship) and the first-job-card required fields are **owner-pending** (`7.1`
  `partial (möte)` — the job name is answered, only the structure is pending; `7.3` `öppen (möte)`)
  — a **STOP** for those specifics (§6).
- **Fallback path:** completed Lovable jobs stay read-only on the fallback; the pilot creates
  new jobs from new acceptances. Fallback stays until the job workflow gate passes.
- **Manual-backfill risks:** re-keying a job by hand risks an **immutable-source-ref mismatch**
  (the job must trace to a real acceptance + version — a hand-created job with no acceptance
  breaks the accept→job idempotency backstop); the deferred field-worker fields tempt
  over-scope (do **not** add them — R-907). Because the job model's structure is owner-pending,
  a real backfill is premature.
- **Cutover-by-workflow decision:** cut the job workflow over after the quote workflow, and
  **only after** the owner working session resolves the job model (`7.1`/`7.3`). Demo jobs are
  auto-created fresh; real job migration is a **STOP**.

### 3.6 Required Files

- **Source records (Lovable):** file index / documents attached to the seven Phase A owner
  categories (customer/facility/contact/calculation/quote_version/quote_acceptance/job). The
  broad Lovable document center is **deferred** (`7.5` — kept LIMITED, register §4.4).
- **Target treatment:** **live-rebuilt** → `files` / `file_links` (private bucket, polymorphic
  join, per-entity panels + the LIMITED `Filer` index over the seven owner categories ONLY,
  R-816). Locked/committed files are archive-only (a hard delete is DB-blocked, `FL823`).
- **Fallback path:** Lovable file access remains the fallback for a workflow's documents until
  that workflow's gate passes; required-file checking on the calc side is a **documented live
  seam** — the calc readiness classifier surfaces `REQUIRED_FILES_DEFERRED` because the
  calc→required-file check is not yet wired (R-513), so required-file handling is **manual** in
  the pilot (a fallback/manual-backfill row, not a resolved capability).
- **Manual-backfill risks:** re-uploading required files by hand risks a **wrong owner-category
  link** (a file linked to the wrong owner type/purpose), a **MIME/size-policy rejection**
  (25 MiB, closed allow-list — a real customer file type outside the allow-list is rejected),
  and — for real customer files — a **raw-file privacy exposure** (real customer files are
  never committed; §8). Upload is demo-data-only (client-declared MIME, no content-sniffing,
  R-817) — re-open on real-customer files.
- **Cutover-by-workflow decision:** cut required files over alongside their parent workflows;
  the required-file gate stays manual until the calc→file wiring lands. Real customer-file
  migration is a **STOP** (raw-file privacy + retention, R-818).

## 4. Epic-8 Pilot-Readiness Re-Score Triggers (reference — resolved elsewhere)

Epic 8's close named owner-gated residuals that must be **re-scored at the pilot-readiness
gate when real/pilot data flows**. This runbook **notes** them as workflow-level fallback/
blocking considerations; their **consolidation** into the sign-off register + acceptance gate
is owned by the fallback/cutover/sign-off-register work and the acceptance-gate report
(architecture §16) — **not resolved here**.

- **Acceptance-evidence-upload lifecycle gate** — a demo-data-accepted High AC-miss (the
  lock-apply on evidence links is proven, but the end-to-end upload-then-lock UX path is
  unwired). Binds the **Quote/Acceptance** (§3.4) and **Required Files** (§3.6) workflows'
  fallback rows.
- **R-817 (MIME / byte-sniffing on uploads)** — cleared under demo-data-only; a re-score
  trigger the moment real customer files flow. Binds **Required Files** (§3.6).
- **R-818 (locked-evidence retention / hard-delete for locked customer evidence)** — a STOP
  requiring legal sign-off. Binds **Required Files** (§3.6) and **Quote/Acceptance** (§3.4).

Also carried as a real-pilot blocker (demo-non-blocking): the **tax/money numbers**
(rounding `A.1`, VAT rate `A.2`, ROT/grön rates/caps/basis Blocks B/C) are `öppen (möte)` —
a real quote/calc cutover cannot claim accounting-finality until the tax working session signs
them off. The `requiresSignOff` framing threads through the snapshots/goldens already.

## 5. Approved Asset-Location Seams (do NOT build here)

Architecture §16 fixes where each migration/comparison asset lives. This runbook is the evergreen
control point for those asset homes: it names the approved location for each and its current status
in the repo (landing an asset in the wrong place is R-919). Most of these seams have since **landed**
within Epic 9 (Stories 9.2/9.3) — the status column below reflects the repo at merge, per the
runbook's own R-922 evergreen-doc discipline:

| Asset | Approved location | Status |
| --- | --- | --- |
| Classification / delta / fallback **docs** | `docs/migration/**` | **Landed** (this file + the classification register; the 9.4 fallback/cutover register + the 9.5 acceptance-gate report). |
| Anonymized structured **fixtures** | `tests/fixtures/golden/lovable/**` | **Landed (Story 9.2)** — the 8 anonymized Lovable fixtures live here (`crm.json`, `settings-pricing.json`, `calculations.json`, `quotes.json`, `pdfs.json`, `acceptance.json`, `accepted-quote-to-job.json`, `files.json`). Add to this home; do NOT relocate. |
| Golden-master **comparison tests** | `tests/unit/**` (executed by `test:unit`) — the existing `tests/unit/**` golden pins + the 9.3 Lovable-comparison suites under `tests/unit/fixtures/golden/lovable/**` | **Landed (Story 9.3).** NOTE: `tests/golden/**` is **NOT** in the `test:unit` glob — a suite placed there is **never executed** (vacuous-green, R-904). Comparison suites MUST live under `tests/unit/**` (9.3 correctly placed them under `tests/unit/fixtures/golden/lovable/**`). Do NOT use `tests/golden/**`. |
| Approved **capture/reset scripts** | `scripts/migration/**` | **Landed (Story 9.2)** — the anonymized capture harness (`lovable-capture.ts` + `README.md`) lives here. Add approved capture/reset scripts to this home; a real historical-data export/import remains an owner-gated STOP (§6). |

The golden-master fixture strategy (architecture §17) governs the delta-documentation framing:
preserve **business shape, not real customer data**; remove/replace all real PII unless
explicitly approved; keep **Lovable-expected** and **new-expected** behavior SEPARATE where an
intentional delta exists. **No Lovable oracle number is fabricated in this runbook** — today
every committed golden is `origin: "new-expected"`; the real `old-lovable` golden examples are
owner-pending (`8.2`) and land in the forthcoming fixture/harness work, never as invented
values here.

## 6. Scope-Unclear → STOP Protocol (fail-closed, AC3)

**The runbook fails closed on ambiguity.** An unclear or owner-pending item is a **STOP for
owner clarification**, **never a silent default-import.** This is the R-907 over-migration
guard made operational.

**Hard STOP conditions — halt and request owner/human approval before proceeding:**

1. **Any real customer data export or import.** Real names, personnummer, org numbers, emails,
   phones, addresses, quotes, calculations, jobs, or files leaving Lovable into the new system
   (or into any committed doc/log/fixture) is a **hard STOP requiring owner sign-off.** The
   pilot runs on demo data (§7); a real export is out of the demo track.
2. **Full historical migration.** Bulk-importing history rather than the classified, per-workflow
   minimum is a STOP (over-migration, R-907).
3. **Deferred-module activation.** Any request to migrate or wire a deferred-module surface
   (Fortnox, supplier, AI, HR, rentals, assets/QR, panels/KNX, service/warranties, DoU,
   tender/FKU, notifications/email, full RBAC, customer portal, broad doc center/analytics) is
   a STOP — a deferred group maps to **no** Phase A table/UI (classification register §4.4).
4. **Materially ambiguous scope.** If what to migrate is ambiguous in a way that changes the
   outcome, STOP for clarification rather than picking a default that silently imports extra
   history.

**Owner-gated items currently STOP-marked (owner-pending — `öppen (möte)`, except `7.1` which is `partial (möte)`):**

- **`8.1` migration-klassning** — the concrete real-record selection per live/archive bucket
  (which customers/quotes/jobs actually migrate). This runbook documents the STRUCTURE; the
  concrete selection is **owner-clarification-required**.
- **`8.2` facit-exempel** — which quotes/calculations become the golden-master examples. Also
  owner-clarification-required; no Lovable number fabricated (§5).
- **`7.1` (`partial (möte)` — structure pending) / `7.3` (`öppen (möte)`)** — the job model
  (order/arbetsorder/projekt relationship) and first-job-card required fields, gating a real
  §3.5 backfill.
- **Tax Blocks A/B/C** — rounding/VAT/ROT/grön numbers, gating real-pilot claims of
  accounting-finality on §3.2–§3.4.

**Protocol:** when any of the above is reached, the runbook **STOPS** and routes the decision
to the owner working session (agenda item **D. Migration & facit** in the sign-off register).
It does **not** invent, assume, or default-fill the decision to "complete" the migration.

## 7. Demo-Data-Only Posture (do NOT conflate the two tracks)

The pilot runs on **disposable, obviously-fake demo data through MVP** (owner decision
2026-07-03; `docs/process/demo-environment.md`: Vercel `enhancior/elpro-saas` + Supabase
`elprosaas-demo`, demo data disposable and obviously fake, CI/tests local-only).

There are **two distinct tracks — never conflated:**

| | **Demo track** (now, through MVP) | **Real-pilot track** (future, gated) |
| --- | --- | --- |
| Data | Disposable, obviously fake, entered fresh | Real customer data |
| Migration decisions here | **Non-blocking** (demo entered fresh, no import) | **Gate cutover** (classification, fallback, sign-off) |
| Tax/money sign-off (`A/B/C`) | Non-blocking (placeholders, `requiresSignOff`) | **Blocking** until owner working session |
| Real data export/import | Not applicable (no real data) | **Hard STOP** requiring owner sign-off (§6) |

The classification/fallback/cutover decisions in this runbook and the register **gate the
real-pilot track**. On the demo track they are **non-blocking** — demo data is created fresh in
the new app, nothing is migrated, so no STOP fires for routine demo work. **Do not conflate**:
a demo-track task never needs a real export, and a real-track task never proceeds on demo-track
non-blocking assumptions.

## 8. PII / Privacy Hygiene + Verification Self-Check

### PII hygiene (epic blocker, R-901/R-902)

**Zero real PII in this runbook.** Every example is structural/synthetic — no real name,
email, phone, address, personnummer, org number, secret, or raw customer value appears. Any
identifier referenced is a **module/column name**, never a value. Illustrative personnummer/
orgnr placeholders, where ever needed, use obviously-fake masked forms (`YYYYMMDD-XXXX`,
`XXXXXX-XXXX`) kept non-10-digit or clearly masked so the standing bare-10-digit orgnr scan
(R-914) does not false-positive. The manual PII scan proving this file clean is recorded in the
story's Dev Agent Record.

### Verification self-check (docs review, AC1/AC2/AC3)

Re-read as a fresh pilot operator:

- **All four buckets are exercised** — via the classification register (live/archive-only/
  excluded/deferred), cross-linked here. ✔
- **Every deferred group maps to "no Phase A table/UI"** — register §4.4; §6 STOP condition 3
  reinforces it. ✔ (AC1 hard constraint, R-907)
- **Every pilot workflow (§3.1–§3.6) carries source · treatment · fallback · backfill-risk ·
  cutover** — six workflows, all five fields present and non-empty. ✔ (AC2)
- **The scope-unclear → STOP protocol is present and unambiguous** — §6, with explicit hard
  STOP conditions and the owner-gated items. ✔ (AC3)
- **Cutover is per-workflow, never whole-company** — §2 and each §3 cutover row. ✔
- **Demo vs real-pilot tracks are not conflated** — §7. ✔

## 9. References

- Architecture §16 (Migration And Coexistence) — coexistence model, four buckets, asset
  locations, cutover-by-workflow, Lovable-is-oracle-not-blueprint.
- Architecture §17 (Golden-Master Fixture Strategy) — preserve business shape not real data;
  keep old-expected vs new-expected separate.
- Companion: [legacy-record-classification.md](./legacy-record-classification.md) — the
  four-bucket record-group register.
- `docs/oracle/initial-system-audit-2026-06-01.md` — the Lovable behavioral-oracle inventory.
- `project-context.md` — Product Boundary; twenty-four tables; seven nav items; demo-data-only
  decision; Lovable Oracle Policy; calc-workspace readiness rules.
- `owner-signoff-questions.md` — sign-off system-of-record; `8.1`/`8.2`/`7.1`/`7.3`/Blocks
  A/B/C statuses; working session agenda item D (Migration & facit).
- `docs/process/demo-environment.md` — demo-data-only posture; CI/tests local-only.
