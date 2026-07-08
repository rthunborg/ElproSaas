# Legacy Record Classification — Lovable → Phase A

> **Phase A · Internal Pilot MVP · docs-only.** This is a **classification decision
> register**, part of the migration/coexistence **control point**. It writes no code, no
> schema, no migration script, and mutates no production data. Its companion is the
> [migration runbook](./migration-runbook.md) (per-workflow source/treatment/fallback/
> cutover). Read the runbook for the workflow-level cutover mechanics; read this file for
> the record-group → bucket decisions.
>
> **Provenance:** authored by the Epic-9 legacy-record-classification-and-migration-runbook
> story. This one-time provenance line is the only plan-position reference; the durable body
> below references **architecture §16 (Migration And Coexistence)** and **§17 (Golden-Master
> Fixture Strategy)**, never "Epic N / Story X-Y" (evergreen-doc anchoring, R-922).

## 1. Purpose And Scope

The Lovable app carries a broad electrician-company workflow surface — the behavioral-oracle
inventory (`docs/oracle/initial-system-audit-2026-06-01.md`) detected **107 application
tables** across CRM, calculations, quotes, jobs/projects, time planning, rentals, assets,
electrical panels, articles/supplier data, service, warranties, documents/file index, DoU,
self-inspections, tenders/FKU, KNX, HR, notes/board, admin, notifications/email, and several
AI-parsing flows.

The new Phase A system ships a **deliberately narrower boundary**: exactly **twenty-four
tenant-owned tables** and **seven nav items** across the workflow
`CRM/settings/pricing → calculations → quote versions/PDF/acceptance → basic job/order →
required files`.

This register classifies the Lovable surface **down to that Phase A boundary — never up**.
It is the structural instrument that prevents the classic migration failure that architecture
§16 exists to block: treating the Lovable schema as the new blueprint, or importing more
history than the pilot needs.

**What this register is NOT:**

- It is **NOT** a schema import. The Lovable schema is a **behavioral oracle** (AR26); its
  column shapes are never copied. The new twenty-four-table set is authored independently.
- It is **NOT** a real-record selection. Which concrete Lovable rows (which customers, which
  quotes) are actually migrated is **owner-gated** (`8.1`/`8.2`, see §5) and is a **hard
  STOP** — this register decides the *structure* (which module → which bucket), not the
  *contents*.
- It is **NOT** a green light for any data export. See the runbook's
  [Scope-Unclear STOP protocol](./migration-runbook.md#6-scope-unclear--stop-protocol).

## 2. The Four-Bucket Contract (architecture §16)

Every Lovable record group is classified into **exactly one** of four buckets:

| Bucket | Meaning | Phase A mapping |
| --- | --- | --- |
| **live for pilot** | The Phase A workflow surface actually rebuilt and pilot-usable. | Maps to one of the twenty-four IN-scope tenant-owned tables. |
| **archive-only** | Historical records kept read-only for reference/fallback, **not actively edited** in the pilot. | No new active table; served by the Lovable-app fallback (architecture §16) or a future read-only archive. |
| **excluded** | Record groups intentionally **not carried at all**. | None. |
| **deferred** | A deferred-module surface (per the AGENTS.md deferred list). | **NONE — MUST NOT map to any Phase A table or UI.** |

**HARD CONSTRAINT (AC1 second clause, R-907 over-migration guard):** a **deferred** group
**MUST NOT** be mapped to a live Phase A table or UI. This is the single most important rule
in this register. A deferred module classified `deferred` and then wired into a Phase A table
would silently reintroduce out-of-scope surface — the exact Lovable-schema-as-blueprint
failure architecture §16 forbids. Every row in the deferred bucket below maps target
treatment to **"none — deferred"**.

Cutover is **by workflow, never whole-company** (architecture §16) — see the runbook.

## 3. Assumptions vs Decisions

Per the BMAD Output Discipline, decisions and assumptions are kept separate.

### Decisions (this register)

- **D1.** The four-bucket assignment of each Lovable module below is a **decision** derived
  mechanically from the Phase A product boundary (`project-context.md#Product Boundary`,
  `AGENTS.md`): a module IS live iff its workflow is one of the seven IN-scope nav
  destinations and it maps to one of the twenty-four tenant-owned tables; a module IS
  deferred iff it appears on the AGENTS.md deferred list; historical continuity data for a
  live workflow is archive-only; everything else is excluded.
- **D2.** The Phase A target-table set is **twenty-four** tenant-owned tables (enumerated in
  `tests/integration/rls/tenant-table-inventory.ts` `TENANT_TABLES` — count from the live
  array, never memory). No classification below adds to that set.
- **D3.** Personnummer for `private` customers is **in-scope, access-controlled** (owner
  decision 2026-06-18 — private ROT requires it), stored on `customers.personnummer`,
  excluded from list projections, masked on detail, never in audit. This SUPERSEDES the stale
  "no personnummer" plan text (R-009 is a doc-only divergence, not a code defect). CRM
  classification below reflects the current owner-decided state.

### Assumptions (carried, not decided here)

- **A1.** The pilot runs on **disposable, obviously-fake demo data through MVP** (owner
  decision 2026-07-03). The classification/fallback decisions **gate real-customer/real-pilot
  cutover** but are **non-blocking for the demo track**. The two tracks are never conflated
  (see runbook §7).
- **A2.** The concrete **real-record selection** per live/archive group is **owner-pending**
  (`8.1`/`8.2` `öppen (möte)`). This register is structurally complete; the concrete selection
  is STOP-marked (§5).

## 4. Classification Register

Each row records: the Lovable module/record group (behavioral-oracle inventory), its bucket,
the Phase A target treatment (a specific tenant-owned table/workflow OR "none — deferred/
excluded/archive"), and a one-line rationale tied to the product boundary.

**Source-record note:** descriptions below are **structural/synthetic only** — no real name,
number, or customer value appears (see the [PII hygiene section](#7-pii--privacy-hygiene)).

### 4.1 Live for pilot

These map to the twenty-four IN-scope tenant-owned tables and the seven nav destinations.

| Lovable record group (oracle) | Bucket | Phase A target treatment | Rationale |
| --- | --- | --- | --- |
| Customers (`customers`) + sensitive (`customer_sensitive`) | `live` | `customers` (personnummer access-controlled, private-only) | CRM is IN-scope; the new `customers` table subsumes the sensitive-personnummer split into one access-controlled column (D3). |
| Facilities (`facilities`) | `live` | `facilities` | CRM facility surface is IN-scope; quote/job must bind to a facility. |
| Customer contacts (`customer_contacts`) | `live` | `contacts` | CRM contact surface is IN-scope; quote/job binds to a specific contact. |
| Company settings / VAT defaults / quote settings, colors, logos | `live` | `company_settings` + `quote_terms` | Settings + quote-terms sign-off + VAT default are IN-scope (settings nav). |
| Work roles & prices | `live` | `work_roles` | Pricing (work roles) is IN-scope. |
| Own article register (`articles`) | `live` | `articles` (NO supplier/vendor/sync/import/api field) | Own manual articles are IN-scope; supplier-linked columns are stripped (deferred, see §4.4). |
| Calculations (`calculations`, `calculation_sections`, `calculation_rows`) | `live` | `calculations` / `calculation_sections` / `calculation_rows` | The calculation workspace is the IN-scope Kalkyl surface. |
| Calculation options/tillval, hidden-row, display-mode behavior | `live` | `calculation_rows` flags (`is_optional`/`is_selected`/`is_hidden`) + `calculation_sections.display_mode` | Option/hidden-row behavior is IN-scope (frozen inclusion pin 2026-06-18). |
| Quotes (`quotes`) + quote versions/statuses | `live` | `quotes` + `quote_versions` (+ `tenant_counters` for numbering) | Quote-version lifecycle (draft/sent/accepted/superseded) is IN-scope. |
| Quote lines / attachments / terms templates | `live` | `quote_version_lines` / `quote_version_attachments` / `quote_terms` | Frozen copy-by-value quote children are IN-scope. |
| Quote PDF / document generation | `live` | `quote_versions.pdf_*` + `files`/`file_links` (`purpose='quote_pdf'`) | PDF-from-snapshot is IN-scope (rendered fresh, never a copied Lovable PDF). |
| Quote lifecycle events (sent/accepted timeline) | `live` | `quote_events` | The append-friendly quote timeline is IN-scope. |
| Quote acceptance (accept/reject/lost-reason) | `live` | `quote_acceptances` | Acceptance-evidence capture is IN-scope (channel + accepted price + evidence). |
| Jobs (basic order record) | `live` | `jobs` | Basic job/order creation on accept is IN-scope. |
| Job timeline (created/updated events) | `live` | `job_events` | The append-friendly job timeline is IN-scope. |
| File index / documents attached to the seven Phase A owner categories | `live` | `files` / `file_links` (limited index, seven owner categories) | Required files + per-entity file panels + the LIMITED `Filer` index (R-816) are IN-scope. |
| Audit / activity log (tenant-scoped, for the above) | `live` | `audit_events` (append-only) | The command-envelope audit trail is IN-scope substrate for every live table. |
| Tenancy / auth / roles → **`tenant_admin` only** | `live` (narrowed) | `tenants` / `tenant_memberships` | Pooled multi-tenant + `tenant_admin` is IN-scope; the Lovable multi-role set (projektledare/installatör/ekonomi) is **deferred** (full RBAC, see §4.4). |

### 4.2 Archive-only

Historical continuity for a live workflow — kept read-only, **not actively edited** in the
pilot; served by the Lovable-app fallback until the workflow's pilot gate passes.

| Lovable record group (oracle) | Bucket | Phase A target treatment | Rationale |
| --- | --- | --- | --- |
| Historical quotes/versions already sent/accepted in Lovable | `archive-only` | none — read-only via Lovable fallback (architecture §16) | Continuity/reference; the pilot re-versions forward, it does not edit old sent commitments. |
| Historical calculations behind those quotes | `archive-only` | none — read-only via Lovable fallback | Reference for a re-quote; not re-imported as editable calc rows. |
| Historical jobs/orders already completed in Lovable | `archive-only` | none — read-only via Lovable fallback | Completed-work reference; the pilot creates new jobs from new acceptances. |
| Quote follow-up history (`quote_followups`) | `archive-only` | none — read-only via Lovable fallback | Follow-up history is reference; the pilot's dashboard/follow-up surface is not in the Phase A minimum. |

> **Concrete archive record selection is OWNER-PENDING (`8.1`).** This bucket documents the
> *structure* (which groups are archive-only). Exactly which historical rows are exported to
> any archive is a **hard STOP** requiring owner sign-off — see §5 and the runbook.

### 4.3 Excluded

Intentionally not carried at all — not live, not archived.

| Lovable record group (oracle) | Bucket | Phase A target treatment | Rationale |
| --- | --- | --- | --- |
| Favorite customers, customer-360 rollups, dashboard KPI aggregates | `excluded` | none | Derived/convenience surface; recomputed fresh in the new system if/when the dashboard is built, never migrated. |
| Data-quality / admin cleanup tooling, internal product backlog, customer-classification tools | `excluded` | none | Lovable-internal ops tooling; not a Phase A record group. |
| Personnummer cleanup tooling (`customer-personnummer` edge function flow) | `excluded` | none | The new system stores personnummer access-controlled by construction (D3); no cleanup-migration record group is carried. |
| Lovable `profiles` / `user_invitations` / signup flow | `excluded` | none | The pilot provisions `tenant_admin` users manually (no signup flow); the invitation/profile records are not migrated. |

### 4.4 Deferred — **MUST map to NO Phase A table or UI (AC1 hard constraint, R-907)**

Every group here is a deferred-module surface (AGENTS.md deferred list). Target treatment is
**"none — deferred"** for all of them. None becomes a Phase A table, route, or nav item.

| Lovable record group (oracle) | Bucket | Phase A target treatment | Rationale |
| --- | --- | --- | --- |
| Time planning / bookings / scheduling (`bookings`, `booking_participants`, `time_reports`, `user_work_hours`, `user_calendar_tokens`, `public_holidays`) | `deferred` | **none — deferred** | Field-worker/scheduling UX is deferred. |
| Rentals (`rental_items`, `rental_orders`, `rentals`, `rental_billing`, delivery notes) | `deferred` | **none — deferred** | Rentals module is deferred. |
| Assets / QR (`assets`, `asset_assignments`, `asset_events`, `asset_documents`, `asset_fault_reports`, `asset_mileage_log`, `asset_label_jobs`) | `deferred` | **none — deferred** | Assets/QR module is deferred. |
| Electrical panels + AI panel import (`analyze-panel-schedule`) | `deferred` | **none — deferred** | Electrical-panels + AI import are deferred. |
| KNX group-address tooling + AI parse (`parse-knx-buildings`) | `deferred` | **none — deferred** | KNX tooling is deferred. |
| Articles supplier data (`suppliers`, `supplier_articles`, `supplier_price_lists`, `supplier_discount_agreements`, `article_categories`, supplier file import) | `deferred` | **none — deferred** | Supplier APIs/integration are deferred; the new `articles` table carries NO supplier/vendor/sync/api/import/fortnox field. |
| Service (`service_records`, `service_plans`, `service_agreements`, `service_job_suggestions`) + background service scans | `deferred` | **none — deferred** | Service module is deferred. |
| Warranties (`warranties`) | `deferred` | **none — deferred** | Warranties module is deferred. |
| DoU documentation (`dou_projects`, `dou_documents`, `dou_material_lists`, `dou_project_versions`) + all DoU AI flows | `deferred` | **none — deferred** | DoU automation + tender/FKU RAG are deferred. |
| Self-inspections (`self_inspections`, sections/items/templates/attachments) + AI generation | `deferred` | **none — deferred** | Self-inspections module is deferred. |
| Tenders / FKU (`tenders`, `tender_files`, `tender_chunks`, `tender_facts`, `tender_quantities`, `tender_chat_messages`, `ai_usage_log`) + RAG/chat/convert flows | `deferred` | **none — deferred** | Tender/FKU RAG is deferred. |
| HR / personnel (`employee_profiles`, competencies, certifications, training plans, employee docs, `incident_reports`, `improvement_suggestions`, `data_deletion_requests`) | `deferred` | **none — deferred** | HR module is deferred (note: GDPR/deletion flows re-scope with any real-customer decision). |
| Extended jobs/projects surface (work orders, material usage/requests, payment plan, diary, deviations, photos, chat, risks, report exports, schedule phases, project upgrade, job members) | `deferred` | **none — deferred** | Only the **basic** job/order record is IN-scope; the field-worker project surface is deferred. |
| Notes / notice board (`notes`, categories, mentions) | `deferred` | **none — deferred** | Internal notice board is deferred. |
| Notifications / email infra (`notifications`, `notification_settings`, `user_notification_prefs`, `email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails`) + proactive scans | `deferred` | **none — deferred** | Notifications/email infra is deferred; direct email-from-app is a scope-decision seam (`3.4`), built later, not migrated. |
| Full RBAC (roles beyond `tenant_admin`: projektledare/installatör/ekonomi, route/sidebar gating, job members' operational roles) | `deferred` | **none — deferred** | Full RBAC is deferred; Phase A is `tenant_admin` only. |
| Fortnox / accounting integration | `deferred` | **none — deferred** | Fortnox integration is deferred (and was never implemented in Lovable — a P1 audit gap). |
| Broad document center / analytics / customer portal / online-accept | `deferred` | **none — deferred** | Broad doc center (`7.5` scope decision — kept LIMITED), analytics, customer portal, and online/BankID accept (`5.3`, Roadmap 6) are deferred. |

## 5. Owner-Pending Concrete Selection — STOP Marker

**`8.1` (migration-klassning) and `8.2` (facit-exempel) are BOTH `öppen (möte)`** in the
sign-off register (`owner-signoff-questions.md`, the system-of-record owned by the fallback/
cutover/sign-off register work, architecture §16). This register delivers the classification
**STRUCTURE** (the buckets above). The **concrete real-record selection** — exactly which
Lovable customers/quotes/jobs are actually migrated into each live/archive bucket, and which
quotes/calculations become golden examples — is **owner-clarification-required**.

> **⛔ SCOPE-UNCLEAR → STOP.** Any **real customer data export or import** is a **hard STOP
> requiring owner sign-off**. Do NOT fabricate, assume, or "complete" a concrete record
> selection to close this register. An owner-gated slot stays STOP-marked; it is never
> filled with an invented decision. This feeds the fallback/cutover/sign-off register and
> the acceptance-gate report (architecture §16).

The golden-example selection (`8.2`) is likewise owner-pending: the golden-master comparison
harness (architecture §17) will carry a real `old-lovable` oracle only once the owner selects
the examples. **No Lovable oracle number is fabricated here** — today every committed golden is
`origin: "new-expected"`; framing any golden example as a concrete captured Lovable value is
forbidden (AGENTS.md, Lovable Oracle Policy).

## 6. Verification Self-Check

- **All four buckets are used:** live (§4.1), archive-only (§4.2), excluded (§4.3),
  deferred (§4.4). ✔
- **Every deferred group maps to "none — deferred":** every row in §4.4 has target treatment
  **none — deferred**; none maps to a Phase A table/UI. ✔ (AC1 hard constraint, R-907)
- **No live group exceeds the twenty-four-table boundary:** every §4.1 target is one of the
  twenty-four `TENANT_TABLES`; no new table introduced. ✔ (D2)
- **Concrete real-record selection is STOP-marked, not fabricated:** §5. ✔ (AC3, R-907)

## 7. PII / Privacy Hygiene

**Zero real PII in this doc (epic blocker, R-901/R-902).** Every source-record description
above is structural/synthetic — no real name, email, phone, address, personnummer, org number,
secret, or raw customer value appears. Where an identifier is illustratively referenced it is a
**module/column name**, never a value. Personnummer/orgnr example placeholders, if ever needed,
use obviously-fake masked forms (e.g. `YYYYMMDD-XXXX`, `XXXXXX-XXXX`) that a PII scan cannot
mistake for real data — and illustrative numeric strings are kept non-10-digit or clearly
masked so the standing bare-10-digit orgnr scan (R-914) does not false-positive. The manual PII
scan proving this file clean is recorded in the story's Dev Agent Record.

## 8. References

- Architecture §16 (Migration And Coexistence) — the four buckets, asset locations,
  cutover-by-workflow, Lovable-is-oracle-not-blueprint.
- Architecture §17 (Golden-Master Fixture Strategy) — preserve business shape not real data;
  keep old-expected vs new-expected separate.
- `docs/oracle/initial-system-audit-2026-06-01.md` — the Lovable behavioral-oracle inventory
  (107 tables, full module list) — the classification SOURCE (behavioral shape, never schema).
- `project-context.md` — Product Boundary; twenty-four tenant-owned tables; seven nav items;
  Lovable Oracle Policy; demo-data-only decision.
- `AGENTS.md` — Lovable-oracle-only policy; Phase A boundary; deferred-module list.
- `owner-signoff-questions.md` — sign-off system-of-record; `8.1`/`8.2` `öppen (möte)`.
- Companion: [migration-runbook.md](./migration-runbook.md).
