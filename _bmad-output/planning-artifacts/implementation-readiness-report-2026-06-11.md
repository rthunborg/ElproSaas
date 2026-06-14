---
stepsCompleted: ['step-01-document-discovery', 'step-02-prd-analysis', 'step-03-epic-coverage-validation', 'step-04-ux-alignment', 'step-05-epic-quality-review', 'step-06-final-assessment']
status: complete
documentsIncluded:
  prd: '_bmad-output/planning-artifacts/prd.md'
  architecture: '_bmad-output/planning-artifacts/architecture.md'
  epics: '_bmad-output/planning-artifacts/epics.md'
  ux: '_bmad-output/planning-artifacts/ux-design-specification.md'
---

# Implementation Readiness Assessment Report

**Date:** 2026-06-11
**Project:** ElproSaas

## Document Inventory

| Document Type | File | Size | Last Modified | Format |
| ------------- | ---- | ---- | ------------- | ------ |
| PRD | prd.md | 58 KB | 2026-06-08 | Whole |
| Architecture | architecture.md | 41 KB | 2026-06-09 | Whole |
| Epics & Stories | epics.md | 116 KB | 2026-06-09 | Whole |
| UX Design | ux-design-specification.md | 25 KB | 2026-06-09 | Whole |

**Duplicates:** None found — each document exists in exactly one (whole) format.
**Missing Documents:** None — all four required document types are present.

**Resolution:** No action required. All four whole documents confirmed for use in this assessment.

## PRD Analysis

### Functional Requirements

**Tenant Foundation and Access**

- FR1: Authenticated users can access Phase A app capabilities only when they have an active tenant membership.
- FR2: Tenant admins can work only inside tenants where they have active `tenant_admin` membership.
- FR3: Tenant admins can view the active tenant/company context used for all tenant-scoped records.
- FR4: Tenant admins can manage Phase A tenant/company settings needed for CRM, pricing, calculations, quotes, files, and jobs/orders.
- FR5: Tenant admins can view audit history for critical tenant-scoped actions.
- FR6: The system can reject cross-tenant reads, writes, lifecycle actions, and file access attempts.

**CRM: Kund, Anläggning, Kontakt**

- FR7: Tenant admins can create, view, update, archive, and search customers.
- FR8: Tenant admins can classify customers using Phase A-supported customer types.
- FR9: Tenant admins can create, view, update, archive, and search facilities linked to customers.
- FR10: Tenant admins can create, view, update, archive, and search contacts linked to customers and optionally facilities.
- FR11: Tenant admins can identify a primary contact according to the Phase A contact rule.
- FR12: Tenant admins can select customer, facility, and contact context when creating calculations and quotes.

**Company Settings and Pricing**

- FR13: Tenant admins can maintain company identity fields required for quote PDFs.
- FR14: Tenant admins can maintain default quote terms for future quote drafts.
- FR15: Tenant admins can maintain default VAT display and VAT-rate assumptions for Phase A quote workflows.
- FR16: Tenant admins can maintain work roles with active/inactive status and labor pricing inputs.
- FR17: Tenant admins can maintain a minimal article/material catalog if required for pilot calculations.
- FR18: The system can snapshot work-role, article, VAT, and terms data when those values become customer-visible in quote versions.

**Calculations**

- FR19: Tenant admins can create calculations linked to a customer and optionally a facility and contact.
- FR20: Tenant admins can organize calculations into ordered sections.
- FR21: Tenant admins can add calculation rows for labor, material, subcontractor, machinery, and other costs.
- FR22: Tenant admins can enter quantities, units, unit prices, cost categories, markup/margin inputs, and quote visibility choices on calculation rows.
- FR23: Tenant admins can use work-role pricing for labor rows while preserving the selected role/pricing source on the row.
- FR24: Tenant admins can use article pricing for material rows while preserving the selected article/pricing source on the row.
- FR25: Tenant admins can mark calculation rows or sections as quote-visible, hidden, detailed, summary, text-only, or optional/tillval according to Phase A rules.
- FR26: Tenant admins can attach quote-relevant files to calculations.
- FR27: The system can calculate line totals, section totals, quote totals, margin indicators, VAT amounts, and customer-facing totals from calculation data.
- FR28: The system can calculate and display ROT or grön teknik estimates only with snapshotted assumptions and warnings.
- FR29: The system can warn before quote creation when required customer, pricing, tax, margin, row, or attachment assumptions are incomplete.

**Quote Versions, PDF, and Lifecycle**

- FR30: Tenant admins can create a draft quote version from a calculation snapshot.
- FR31: Tenant admins can edit draft quote content before the quote is sent.
- FR32: The system can generate tenant-scoped quote numbers server-side.
- FR33: Tenant admins can generate a quote PDF from the quote version snapshot.
- FR34: Tenant admins can select calculation attachments for quote output before the quote version is sent.
- FR35: The system can snapshot customer-visible quote content, lines, totals, VAT, tax assumptions, terms, attachment selections, and PDF metadata into each quote version.
- FR36: Tenant admins can mark a quote version as sent.
- FR37: The system can make sent quote versions immutable.
- FR38: Tenant admins can create a new quote version when customer-visible content must change after send.
- FR39: Tenant admins can view quote lifecycle history across draft, sent, accepted, rejected, expired, and superseded states supported in Phase A.
- FR40: The system can preserve all prior sent quote versions for audit and comparison.

**Quote Acceptance and Basic Job/Order Creation**

- FR41: Tenant admins can record quote acceptance for a specific sent quote version.
- FR42: Tenant admins can capture acceptance channel, accepted timestamp, accepted-by/admin user, evidence reference, accepted price, notes, and planned dates when available.
- FR43: The system can require explicit reason/evidence when accepted price differs from the sent quote total.
- FR44: The system can make accepted quote version references and acceptance evidence immutable except through an explicit audited correction workflow.
- FR45: The system can create a basic job/order from an accepted quote version.
- FR46: The system can create the acceptance record and basic job/order transactionally.
- FR47: The system can prevent duplicate jobs/orders from repeated acceptance or create-job attempts.
- FR48: Tenant admins can view the source quote version, acceptance evidence, accepted price, and source totals on the resulting job/order.

**Files and Documents**

- FR49: Tenant admins can upload files required for Phase A CRM, calculation, quote, acceptance, and job/order workflows.
- FR50: Tenant admins can view, download, replace where allowed, archive, or delete files according to lifecycle rules.
- FR51: The system can validate file type, size, tenant ownership, owning entity, and storage path before files become usable.
- FR52: The system can serve private files through tenant-authorized, short-lived access.
- FR53: The system can lock or snapshot quote PDFs, quote attachments, and acceptance evidence files when lifecycle rules require immutability.
- FR54: The system can audit file upload, access, delete/archive, and lifecycle-lock events.

**Migration, Coexistence, and Golden-Master Fixtures**

- FR55: Pilot operators can classify legacy Lovable records as live, archive-only, excluded, or deferred for Phase A.
- FR56: Pilot operators can create anonymized fixture sets for representative CRM, calculation, quote, PDF, acceptance, file, and accepted-quote-to-job behavior.
- FR57: The system can support shadow comparison of new calculation totals, quote outputs, PDFs, acceptance transitions, and job/order creation against selected Lovable oracle fixtures.
- FR58: Pilot operators can document old/new behavior deltas and fallback decisions before pilot cutover.
- FR59: The system can keep old-app fallback explicit for selected workflows until pilot acceptance gates are met.

**Scope Boundaries**

- FR60: The system can preserve documented seams for future Fortnox, supplier, field-worker, AI, and RBAC expansion without implementing deferred Phase A modules.
- FR61: Tenant admins cannot access Phase A UI or workflows for Fortnox sync, supplier APIs, AI jobs, HR, rentals, assets/QR, DoU automation, tender/FKU RAG, full field-worker UX, full RBAC, or public privileged endpoints.

**Total FRs: 61**

### Non-Functional Requirements

**Security and Tenant Isolation**

- NFR1: Every Phase A business record must be tenant-owned directly or through a tenant-owned parent.
- NFR2: RLS must enforce tenant isolation for all tenant-owned business tables.
- NFR3: Automated tests must prove cross-tenant read/write attempts fail for at least two tenants.
- NFR4: No service-role key may be reachable from browser/client paths.
- NFR5: No unauthenticated privileged function, route, endpoint, webhook, or cron command may exist in Phase A.
- NFR6: Sensitive commands must verify authenticated user, tenant membership, input validity, tenant ownership, and authorization before mutation.
- NFR7: Critical business commands must write audit events with tenant, user, command, target record, lifecycle event, and timestamp.
- NFR8: File access must be tenant-authorized and must not trust client-supplied storage paths.

**Data Integrity and Domain Correctness**

- NFR9: SEK money must be stored as integer öre, not floating-point kronor.
- NFR10: Quote versions must snapshot all customer-visible financial, tax, terms, attachment, and PDF content required to reproduce the sent commitment.
- NFR11: Sent quote versions must be immutable.
- NFR12: Accepted quote version references and acceptance evidence must be immutable except through explicit audited correction workflows.
- NFR13: Accepted-quote-to-job creation must be transactional and idempotent.
- NFR14: Rounding, VAT, ROT, grön teknik, option/tillval, hidden-row, and accepted-price behavior must be covered by tests before real pilot use.
- NFR15: ROT, grön teknik, VAT assumptions, quote terms, and customer-facing tax wording require owner plus accounting/legal sign-off before real pilot use.

**Privacy and Data Handling**

- NFR16: The system must minimize personal data captured in Phase A, especially personnummer and sensitive free-text notes.
- NFR17: Anonymized fixtures must not contain real names, phone numbers, emails, addresses, personal numbers, organization numbers, secrets, or raw customer files unless explicitly approved.
- NFR18: Logs, prompts, screenshots, docs, and committed files must not include customer secrets, real personal data, service-role keys, or `.env` values.
- NFR19: Private files must be served through short-lived signed access and tenant-owned metadata.

**Reliability and Operational Safety**

- NFR20: Quote acceptance and job/order creation must not leave partial state if one part of the workflow fails.
- NFR21: Old app fallback must remain documented and available for selected workflows until Phase A pilot gates are approved.
- NFR22: Migration/coexistence runs must classify records as live, archive-only, excluded, or deferred before cutover.
- NFR23: Lifecycle correction workflows must preserve original records and record who changed what, when, and why.

**Performance**

- NFR24: Core tenant-admin workflows should remain responsive for pilot-sized data sets: CRM search, calculation editing, quote preview/PDF generation, file metadata retrieval, and job/order creation must not block normal internal use.
- NFR25: PDF generation and signed-file access may be asynchronous or wait-state flows if needed, but must expose completion/failure status to the tenant admin.
- NFR26: Performance targets beyond pilot-sized internal use are deferred until External Beta sizing is known.

**Scalability**

- NFR27: The schema and access model must support many tenants in production even during a one-company pilot.
- NFR28: Phase A must not require one Supabase project per customer company.
- NFR29: Deferred modules must not be represented by placeholder production tables that increase migration or RLS surface area before validation.

**Accessibility and Usability**

- NFR30: Tenant-admin workflows must be usable in a standard modern browser with clear form validation, readable text, keyboard-reachable controls, and accessible error states.
- NFR31: Phase A does not require mobile-first installer UX, but the admin web app should avoid layouts that prevent use on common laptop/desktop viewports.

**Integration and Coexistence**

- NFR32: Lovable oracle comparisons must use anonymized fixtures and documented deltas rather than copied legacy code.
- NFR33: Fortnox, supplier, AI, field-worker, HR, rental, asset, DoU, tender/FKU, and full RBAC integrations must remain inactive unless a later ADR-backed scope change approves them.
- NFR34: Future integration seams must not expose credentials, public privileged entrypoints, or external IDs in Phase A production schema.

**Test and Quality Requirements**

- NFR35: Clean install from a fresh checkout must be reproducible.
- NFR36: Typecheck, lint, unit tests, and build must pass for Phase A product work.
- NFR37: Unit tests must cover money, VAT, ROT, grön teknik, quote lifecycle, snapshotting, and immutability rules.
- NFR38: Integration tests must cover create calculation, create/send quote version, accept quote, create job/order, file access, and core server commands.
- NFR39: RLS and storage negative tests must prove cross-tenant isolation.
- NFR40: Supabase migration reset from an empty database must pass once migrations exist.
- NFR41: Docs/config-only work may use lighter verification, but skipped product gates must be explicitly stated.

**Total NFRs: 41**

### Additional Requirements

**Acceptance Criteria (AC1-AC22):** The PRD defines 22 Phase A acceptance criteria covering tenant/multi-tenant testability (AC1-AC2), the end-to-end pilot workflow (AC3), settings/pricing (AC4), calculations (AC5), integer öre money + tests (AC6), server-side quote numbering (AC7), PDF-from-snapshot (AC8), sent immutability (AC9), new-version-on-change (AC10), acceptance immutability (AC11-AC12), adjusted-price reason/evidence (AC13), transactional idempotent job creation (AC14), file security (AC15), migration runbook (AC16), oracle fixtures (AC17), old-app fallback (AC18), quality gates (AC19), deferred-scope exclusion (AC20), owner sign-off (AC21), and accounting/legal sign-off (AC22).

**Money/Tax Constraints:** Integer öre storage; explicit snapshotted VAT rates; rounding policy defined and tested before real pilot use; full ROT/grön teknik assumption snapshots; no ROT + grön teknik mixing without explicit approval; exact öre preserved in snapshots even when PDFs display rounded kronor; human admin confirmation before sending quotes with ROT/grön teknik assumptions.

**Quote Lifecycle Constraints:** Draft editable before send; tenant-scoped server-generated quote numbers (display format needs owner confirmation); sent = immutable; customer-visible changes require a new version (with explicit list of what counts as customer-visible); internal notes do not force a new version; acceptance data immutable post-acceptance; corrections only via explicit audited correction workflow.

**File Constraints:** Private-by-default storage; full metadata (tenant, owning entity, purpose, MIME/type, size, uploader, lifecycle state, timestamps, deletion/archive audit); server-derived/validated paths; short-lived signed URLs; lifecycle locking; no broad document-center in Phase A.

**Migration/Coexistence Constraints:** Lovable as behavioral oracle only; anonymized fixtures; shadow comparisons before real pilot use; deltas documented as expected simplification / bug / unresolved assumption; cutover by workflow, not whole company.

**Assumption Register:** 29 assumptions (A1-A29): 9 accepted for PRD, 9 needing owner confirmation before real pilot use, 5 needing accounting/legal confirmation, 6 deferred.

**Owner Questions:** 12 blocking before real pilot use, 14 non-blocking before prototype/demo, 9 deferred until External Beta or later.

### PRD Completeness Assessment

The PRD is unusually complete and disciplined for an internal pilot MVP:

- **Strengths:** All FRs/NFRs explicitly numbered and grouped by capability area. Scope boundaries are aggressively explicit (FR60-FR61, AC20, deferred list). Sign-off-sensitive items (tax, rounding, quote numbering, acceptance semantics) are flagged with an assumption register rather than silently assumed. Five user journeys map cleanly onto the FR groups. Acceptance criteria (AC1-AC22) provide a verifiable definition of done for Phase A.
- **Observations to verify downstream:** (1) Several FRs depend on owner decisions that are "blocking before real pilot use" but not blocking for build — epics must not hard-code unconfirmed values (quote number format, rounding rule, acceptance channels, customer types). (2) FR55-FR59 (migration/coexistence) are partially process/runbook requirements rather than system features — epic coverage needs to clarify what is built vs. documented. (3) FR61/FR60 are negative/boundary requirements — coverage means absence plus seam documentation, which is harder to trace to stories.


## Epic Coverage Validation

The epics document restates all 61 PRD FRs verbatim in its Requirements Inventory and provides an explicit FR Coverage Map. The PRD FR list and the epics FR list are textually identical — no drift between documents.

### Coverage Matrix

| FR | Requirement (abbreviated) | Epic Coverage | Status |
| --- | --- | --- | --- |
| FR1 | Access requires active tenant membership | Epic 2 (Story 2.1) | ✓ Covered |
| FR2 | Work only inside active `tenant_admin` memberships | Epic 2 (Story 2.1) | ✓ Covered |
| FR3 | View active tenant/company context | Epic 2 (Story 2.1) | ✓ Covered |
| FR4 | Manage Phase A tenant/company settings | Epic 3 (Story 3.3) | ✓ Covered |
| FR5 | View audit history for critical actions | Epic 2 (Story 2.3) | ✓ Covered |
| FR6 | Reject cross-tenant reads/writes/lifecycle/file access | Epic 2 (Stories 2.2, 2.4) | ✓ Covered |
| FR7 | CRUD + archive + search customers | Epic 3 (Stories 3.1, 3.2) | ✓ Covered |
| FR8 | Classify customers by Phase A types | Epic 3 (Story 3.1) | ✓ Covered |
| FR9 | CRUD + archive + search facilities | Epic 3 (Stories 3.1, 3.2) | ✓ Covered |
| FR10 | CRUD + archive + search contacts | Epic 3 (Stories 3.1, 3.2) | ✓ Covered |
| FR11 | Identify primary contact per Phase A rule | Epic 3 (Story 3.1) | ✓ Covered |
| FR12 | Select customer/facility/contact context | Epic 3 / Epic 5 (Story 5.1) | ✓ Covered |
| FR13 | Maintain company identity for quote PDFs | Epic 3 (Story 3.3) | ✓ Covered |
| FR14 | Maintain default quote terms | Epic 3 (Story 3.3) | ✓ Covered |
| FR15 | Maintain default VAT display/rate assumptions | Epic 3 (Story 3.3) | ✓ Covered |
| FR16 | Maintain work roles with pricing | Epic 3 (Story 3.4) | ✓ Covered |
| FR17 | Maintain minimal article catalog (optional) | Epic 3 (Story 3.4) | ✓ Covered |
| FR18 | Snapshot work-role/article/VAT/terms when customer-visible | Epic 3 (Story 3.5) | ✓ Covered |
| FR19 | Create calculations linked to CRM context | Epic 5 (Story 5.1) | ✓ Covered |
| FR20 | Organize calculations into ordered sections | Epic 5 (Stories 5.1, 5.2) | ✓ Covered |
| FR21 | Add rows: labor/material/subcontractor/machinery/other | Epic 5 (Stories 5.1, 5.2) | ✓ Covered |
| FR22 | Enter quantities/units/prices/margins/visibility | Epic 5 (Story 5.2) | ✓ Covered |
| FR23 | Work-role pricing with preserved source on row | Epic 5 (Story 5.3) | ✓ Covered |
| FR24 | Article pricing with preserved source on row | Epic 5 (Story 5.3) | ✓ Covered |
| FR25 | Row/section visibility and option/tillval modes | Epic 5 (Stories 5.2, 5.4, 5.5) | ✓ Covered |
| FR26 | Attach quote-relevant files to calculations | Epic 8 (Stories 8.1, 8.2) | ✓ Covered |
| FR27 | Calculate line/section/quote totals, margins, VAT | Epic 4 (Stories 4.1, 4.2) | ✓ Covered |
| FR28 | ROT/grön teknik estimates with snapshotted assumptions | Epic 4 (Story 4.3) | ✓ Covered |
| FR29 | Pre-quote readiness warnings | Epic 5 (Story 5.4) | ✓ Covered |
| FR30 | Create draft quote version from calculation snapshot | Epic 6 (Story 6.1) | ✓ Covered |
| FR31 | Edit draft quote content before send | Epic 6 (Story 6.2) | ✓ Covered |
| FR32 | Server-side tenant-scoped quote numbers | Epic 6 (Story 6.1) | ✓ Covered |
| FR33 | Generate quote PDF from version snapshot | Epic 6 (Story 6.3) | ✓ Covered |
| FR34 | Select calculation attachments for quote output | Epic 6 (Story 6.1) + Epic 8 | ✓ Covered |
| FR35 | Snapshot customer-visible content into versions | Epic 6 (Story 6.1) | ✓ Covered |
| FR36 | Mark quote version as sent | Epic 6 (Story 6.4) | ✓ Covered |
| FR37 | Sent quote versions immutable | Epic 6 (Story 6.4) | ✓ Covered |
| FR38 | New version for customer-visible changes after send | Epic 6 (Story 6.5) | ✓ Covered |
| FR39 | View quote lifecycle history | Epic 6 (Stories 6.2, 6.5) | ✓ Covered |
| FR40 | Preserve prior sent versions for audit | Epic 6 (Story 6.5) | ✓ Covered |
| FR41 | Record acceptance for specific sent version | Epic 7 (Story 7.1) | ✓ Covered |
| FR42 | Capture acceptance channel/timestamp/evidence/price/dates | Epic 7 (Story 7.1) | ✓ Covered |
| FR43 | Require reason/evidence for adjusted accepted price | Epic 7 (Story 7.1) | ✓ Covered |
| FR44 | Acceptance immutable except audited correction | Epic 7 (Story 7.4) | ✓ Covered |
| FR45 | Create basic job/order from accepted version | Epic 7 (Story 7.2) | ✓ Covered |
| FR46 | Acceptance + job creation transactional | Epic 7 (Story 7.2) | ✓ Covered |
| FR47 | Prevent duplicate jobs on repeated attempts | Epic 7 (Story 7.2) | ✓ Covered |
| FR48 | Job shows source version/evidence/price/totals | Epic 7 (Story 7.3) | ✓ Covered |
| FR49 | Upload files for Phase A workflows | Epic 8 (Story 8.2) | ✓ Covered |
| FR50 | View/download/replace/archive/delete files per lifecycle | Epic 8 (Stories 8.2, 8.3, 8.5) | ✓ Covered |
| FR51 | Validate type/size/ownership/entity/path before use | Epic 8 (Story 8.2) | ✓ Covered |
| FR52 | Serve private files via short-lived authorized access | Epic 8 (Story 8.3) | ✓ Covered |
| FR53 | Lock/snapshot PDFs/attachments/evidence per lifecycle | Epic 8 (Story 8.4) | ✓ Covered |
| FR54 | Audit file upload/access/delete/lock events | Epic 8 (Story 8.5) | ✓ Covered |
| FR55 | Classify legacy records live/archive/excluded/deferred | Epic 9 (Story 9.1) | ✓ Covered |
| FR56 | Create anonymized fixture sets | Epic 9 (Story 9.2) | ✓ Covered |
| FR57 | Shadow comparison against Lovable oracle fixtures | Epic 9 (Story 9.3) | ✓ Covered |
| FR58 | Document old/new deltas and fallback decisions | Epic 9 (Stories 9.1, 9.4) | ✓ Covered |
| FR59 | Keep old-app fallback explicit until gates met | Epic 9 (Story 9.4) | ✓ Covered |
| FR60 | Preserve seams without implementing deferred modules | Epic 1 (Stories 1.1, 1.3) | ✓ Covered |
| FR61 | No deferred-module UI/workflows accessible | Epic 1 (Story 1.3) + Story 9.5 scope scan | ✓ Covered |

### Missing Requirements

None. Every PRD FR (FR1-FR61) is claimed by exactly one primary epic in the FR Coverage Map, and the per-epic "FRs covered" lists are consistent with the map. No FRs exist in the epics document that are absent from the PRD.

**Consistency notes (non-blocking):**

- FR34 (attachment selection) is mapped to Epic 6 in the coverage map but also appears in Epic 8's "FRs covered" list — intentional dual coverage since Story 6.3 introduces the minimal quote-PDF file slice and Epic 8 expands it. The dependency note in Epic 6 explicitly manages this seam.
- FR12 (select CRM context) is mapped to Epic 3 but is functionally exercised in Epic 5 Story 5.1 (calculations linked to CRM context). Coverage is real in both places.
- FR55-FR59 are largely process/runbook deliverables (docs, fixtures, harness) — Epic 9 stories correctly frame them as docs/test artifacts rather than production features.

### Coverage Statistics

- Total PRD FRs: 61
- FRs covered in epics: 61
- Coverage percentage: **100%**
- FRs in epics but not in PRD: 0

## UX Alignment Assessment

### UX Document Status

**Found:** `ux-design-specification.md` (lightweight Phase A UX spec, dated 2026-06-09). The architecture document lists the UX spec as an input, and the epics document distills it into 38 numbered UX design requirements (UX-DR1-UX-DR38) mapped to specific epics/stories — a strong traceability chain.

### UX ↔ PRD Alignment

- **User journeys:** All five PRD journeys are represented in the UX spec — the end-to-end workflow (UX section 4 mirrors Journey 1 step-for-step), new-version-after-send (sections 5-6 / Journey 2), acceptance with adjusted price (section 6 / Journey 3), migration/coexistence support views (sections 1, 3 / Journey 4), and audit/event history in record context (sections 1, 3 / Journey 5).
- **Scope discipline:** UX section 11 (Explicit Non-Goals) matches the PRD's deferred-scope list item-for-item: no Fortnox, field-worker UX, supplier, AI, HR, rentals, assets/QR, DoU, tender/FKU, full RBAC, customer portal, or placeholder screens.
- **Assumptions:** UX conservative assumptions align with the PRD assumption register (tenant_admin only = A4, manual quote sending = A9, optional articles = A8, Jobb/Order working label = A16, facility/contact encouraged-not-mandatory = A11).
- **Open questions:** The UX spec's 16 forward questions are a superset-consistent restatement of the PRD owner questions — no contradictions, same blocking items (quote numbering, sent semantics, acceptance channels, adjusted price, hidden rows, required files).
- **NFR support:** Accessibility/usability NFR30-NFR31 are fully elaborated in UX section 10. PDF async/status NFR25 is reflected in PDF generation states. Responsiveness NFR24 is reflected in laptop/tablet layout rules.

### UX ↔ Architecture Alignment

- **Navigation/routes:** The architecture route table (`/dashboard`, `/customers`, `/calculations`, `/quotes`, `/jobs`, `/files`, `/settings/company|pricing|quote-terms`, optional `/pilot`) matches the UX top-level navigation one-to-one, including the conditional Pilotstöd/Migrering item.
- **PDF states:** UX requires not-generated/generating/generated/failed/retry states; architecture section 12 records render status with exactly those states and a snapshot-only source rule matching the UX requirement.
- **Acceptance flow:** UX duplicate-acceptance behavior ("show existing accepted state/job") is supported by the architecture's idempotent `acceptQuoteAndCreateJob` design returning existing records.
- **Files:** UX entity-scoped file panels, signed URL refresh, generic cross-tenant errors, and lifecycle locks all map to architecture sections 6 and 14 (`files`, `file_links`, private buckets, short-lived signed URLs, lock fields).
- **Settings:** UX company/pricing/quote-terms screens map to `company_settings`, `work_roles`, optional `articles`, and `quote_terms` tables, including the branding-for-PDF fields the UX calls out.
- **Immutability UX:** UX "explain lifecycle rule and offer next action" pattern is supported by the architecture's stable error codes (e.g. `QUOTE_VERSION_LOCKED`) and command-level enforcement below the UI layer.

### Alignment Issues

No blocking misalignments found. Minor observations (story-level, non-blocking):

1. **Quote follow-up date:** The UX quote list specifies filtering by "follow-up date," but no follow-up field appears in the architecture's `quotes`/`quote_versions` schema or the epics' Story 6.2 ACs. Either the field should be added in Story 6.1/6.2 implementation or the filter dropped — small decision for the story author.
2. **Dashboard content:** UX defines dashboard content (warnings, follow-ups, recent activity); the epics cover the app shell (Story 1.3) but no story explicitly owns dashboard data assembly. Acceptable for a pilot (dashboard can stay thin), but worth noting so it doesn't appear by surprise inside another story.
3. **Duplicate-like customer warning:** UX CRM states include a "duplicate-like customer warning"; Story 3.2 mentions it in its states list, so it is covered — flagged here only because it is an easy-to-miss detail with no PRD FR behind it.

### Warnings

None. UX documentation exists, is current (generated against this PRD), and both Architecture and Epics demonstrably consumed it (input lists + UX-DR mapping). The UI implied by the PRD is fully specified for Phase A scope.

## Epic Quality Review

Scope reviewed: 9 epics, 41 stories (Epic 1: 4, Epic 2: 4, Epic 3: 5, Epic 4: 4, Epic 5: 5, Epic 6: 5, Epic 7: 4, Epic 8: 5, Epic 9: 5).

### Epic Structure Validation

**User value focus:**

| Epic | User-value verdict |
| --- | --- |
| 1 - Platform Foundation And Scope Guardrails | Mostly technical (greenfield setup), justified — see Major Issue 2. Story 1.3 (app shell) is user-facing; FR60/FR61 give it requirement traceability. |
| 2 - Tenant Access, Admin Auth, RLS, And Audit | Borderline-acceptable. Covers genuine user FRs (FR1-FR3, FR5): login, tenant context, audit visibility. Tenant isolation is an explicit PRD success criterion, not gold-plating. |
| 3 - CRM, Company Settings, And Pricing | ✓ Clear user value. |
| 4 - Money, Tax, Snapshot Primitives, And Golden Fixtures | ✗ Technical epic — see Major Issue 1. |
| 5 - Calculation Workspace And Quote Readiness | ✓ Clear user value. |
| 6 - Quote Versions, PDF, And Lifecycle | ✓ Clear user value. |
| 7 - Acceptance-To-Job Transaction | ✓ Clear user value. |
| 8 - Required Files And Private Storage | ✓ User value (file management), positioned late — see Major Issue 3. |
| 9 - Migration, Coexistence, Golden Masters, Pilot Readiness | ✓ Operator value; correctly framed as docs/fixtures/runbook rather than product features. |

**Epic independence (Epic N must not require Epic N+1):**

- Epics 1, 2, 3, 4, 5, 6, 7 form a clean backward-only chain — each functions on prior outputs.
- **Three references to Epic 8 from earlier epics** (Epics 5, 6, 7) — detailed under Major Issue 3. Each is explicitly mitigated in the document, but they are technically forward references in the declared epic order.
- No circular dependencies found.

### Story Quality Assessment

**Acceptance criteria:** All 41 stories use proper Given/When/Then BDD structure. ACs are specific and testable, and — unusually strong — nearly every story includes negative/error scenarios (cross-tenant rejection, invalid lifecycle state, rollback on failure, anonymous access). Recurring per-story sections (Test Requirements, Security/RLS Impact, Money/Tax/Quote Impact, Migration Impact, Stop Conditions) far exceed baseline standards.

**Database/entity creation timing:** ✓ Correct pattern throughout. Tables are created in the story that first needs them (tenants/memberships in 2.2, audit_events in 2.3, CRM in 3.1, calculation tables in 5.1, quote tables in 6.1, files/file_links in 8.1). No big-bang schema story exists.

**Starter template check:** ✓ Architecture specifies a clean Next.js App Router baseline; Story 1.1 is exactly the required "initialize project baseline" first story (pnpm, TypeScript, ESLint, Tailwind, App Router).

**Greenfield/brownfield indicators:** ✓ Both present and appropriate — greenfield setup (Stories 1.1-1.4, CI in 1.2) plus brownfield coexistence (Epic 9 classification, fixtures, fallback, cutover).

**Within-epic dependency order:** ✓ All stories depend only on earlier stories in their own epic or earlier epics, with one conditional exception (Major Issue 3, Story 6.1).

### Findings by Severity

#### 🔴 Critical Violations

None.

#### 🟠 Major Issues

1. **Epic 4 is a technical milestone, not a user-value epic.** "Money, Tax, Snapshot Primitives, And Golden Fixtures" delivers pure library code (`src/lib/money`, `src/lib/tax`) and test fixtures; no tenant admin can use anything from it until Epic 5 exists. Its FRs (FR27, FR28) are system-calculation requirements that users only experience through the calculation editor.
   - *Mitigating context:* Domain correctness before workflow implementation is an explicit PRD success criterion (NFR9, NFR14, NFR37), and the PRD risk strategy says to preserve money/tax foundations over breadth. The epic is small (4 stories) and sits immediately before its consumer.
   - *Recommendation:* Accept as a deliberate enabler epic OR fold Stories 4.1-4.3 into Epic 5 as its first stories and keep 4.4 (fixture pack) with the Epic 9 fixture stream. If accepted as-is, no story changes are needed — but the team should consciously accept that Epic 4 alone produces no demonstrable user outcome.

2. **Epic 1 is predominantly technical.** Stories 1.1, 1.2, 1.4 (baseline, CI, setup docs) have no direct user value.
   - *Mitigating context:* This is the standard, recommended greenfield pattern — this checklist itself requires an initial-setup story and early CI/CD for greenfield projects. Story 1.3 (app shell with deferred-scope guardrails) is user-facing and carries FR61.
   - *Recommendation:* Accept. No change needed; flagged for the record.

3. **[RESOLVED 2026-06-11]** — Addressed via approved sprint-change-proposal-2026-06-11.md: Epic 8 split into two waves; Story 8.1 (file foundation) now depends only on Epics 1-2 and runs before Epics 5-6; Stories 6.1/6.3 depend unconditionally on 8.1; all "minimal file slice"/"competing model" hedge language removed from epics.md. Original finding preserved below.
   **Forward references to Epic 8 (files) from Epics 5, 6, and 7.** The declared epic order places file infrastructure after three epics that need file behavior: Epic 5 (FR26 calculation attachments), Epic 6 Story 6.1 ("Dependencies: ... and Story 8.1 if attachment metadata is persisted") and Story 6.3 (PDF storage), Epic 7 (acceptance evidence files).
   - *Mitigating context:* Every seam is explicitly managed in the document — Epic 5 "remains functional without broad file behavior," Story 6.3 introduces a minimal quote-PDF storage slice that Epic 8 must reuse, and Story 7.1 records external evidence references without uploads. This is deliberate, documented sequencing, not an oversight.
   - *Risk:* FR26/full FR34 are not actually deliverable until Epic 8 completes, and the Story 6.3 "minimal file slice" risks creating a competing file model that Story 8.1 must reconcile (the document acknowledges this in both stories).
   - *Recommendation:* Strongly consider resequencing Story 8.1 (file metadata schema + RLS) to run between Epics 4 and 5 — it depends only on Epic 2 plus owner tables. That converts all three forward references into backward ones and removes the dual-model risk in 6.3/8.1. Alternatively, keep the current order and treat the documented seams as binding implementation constraints during story creation.

#### 🟡 Minor Concerns

1. **Conditional acceptance criteria pending owner sign-off.** Many ACs contain qualifiers — "where stories approve those modes," "if articles are enabled," "only if an approved migration story requires it," "if supported." This correctly reflects the PRD assumption register, but each conditional must be resolved into a concrete decision at story-creation time or implementers will face ambiguity. The sign-off register (Story 9.4) is the right control; ensure story authors consult it.
2. **Story 6.1 is large.** One story carries five new tables, the snapshot builder, race-safe tenant-scoped quote numbering, and an RPC transaction. It is completable but at the upper bound of story sizing; quote-number allocation could split into its own story if implementation stalls.
3. **Dashboard has no owning story.** Navigation includes Dashboard (Story 1.3 shell), and the UX spec defines its content, but no story owns dashboard data assembly (also noted in UX alignment). Acceptable if the pilot dashboard stays an empty/thin landing page — make that decision explicit.
4. **FR12 mapping imprecision.** FR12 (select CRM context when creating calculations/quotes) is mapped to Epic 3 in the coverage map but is functionally implemented by Story 5.1. Cosmetic; coverage is real.
5. **Epic 9 Stories 9.1/9.4 are docs/runbook deliverables** with docs-review "tests" — acceptable per NFR41 (docs-only work uses lighter verification), but they will not produce code-verifiable DoD.

### Best Practices Compliance Summary

| Check | Result |
| --- | --- |
| Epics deliver user value | ⚠️ 7 of 9 yes; Epics 1 and 4 technical (both defensible) |
| Epic independence (no forward needs) | ⚠️ Yes except managed Epic 8 seams |
| Stories appropriately sized | ✓ Yes (6.1 at upper bound) |
| No forward story dependencies | ⚠️ One conditional (6.1 to 8.1), documented |
| DB tables created when needed | ✓ Yes |
| Clear acceptance criteria | ✓ Yes, BDD with negative cases |
| FR traceability maintained | ✓ Yes, explicit per epic + coverage map |

## Summary and Recommendations

### Overall Readiness Status

**READY** — Phase A planning artifacts are implementation-ready. No critical violations were found in any step. The three major issues are all either deliberate, documented trade-offs (Epics 1 and 4 as enabler epics) or carry an explicit recommended fix (Epic 8 sequencing). Implementation of Epic 1 can begin immediately.

### Critical Issues Requiring Immediate Action

None. No issue found in this assessment blocks the start of implementation.

The closest items to "critical" are governance gates the PRD itself already defines — they block **real pilot use**, not implementation:

- Owner sign-off: quote number format, sent-event semantics, acceptance channels, adjusted-price policy, required-file rules, legacy record classification (Assumptions A10-A18).
- Accounting/legal sign-off: VAT, ROT, grön teknik, rounding policy, quote terms, customer-facing tax wording (Assumptions A19-A23).

These are correctly tracked in the assumption register and enforced by Story 9.4's sign-off register and per-story Stop Conditions.

### Recommended Next Steps

1. ~~**Decide the Epic 8 sequencing question before sprint planning** (Major Issue 3)~~ **DONE 2026-06-11** — resolved via approved sprint-change-proposal-2026-06-11.md (Epic 8 wave split; Story 8.1 foundation sequenced before Epics 5-6).
2. **Consciously accept or restructure Epic 4** (Major Issue 1): confirm the team accepts a non-user-facing enabler epic, or fold Stories 4.1-4.3 into Epic 5. Either choice is fine; make it explicit.
3. **Run sprint planning** (`bmad-sprint-planning`) and begin story creation with Story 1.1. At create-story time, resolve each conditional AC ("if articles are enabled," "where stories approve those modes") against the assumption register so implementers receive unambiguous specs.
4. **Start collecting owner answers to the 12 blocking questions in parallel with Epics 1-2**, since none of them block platform/tenant foundation work but several block Epics 3-7 details (customer types, primary contact rule, quote numbering display, acceptance semantics).
5. **Decide the dashboard scope** (Minor Concern 3): thin landing page for the pilot, or add a small dashboard story to Epic 1/late backlog.

### Final Note

This assessment identified **11 issues across 3 categories** (3 major epic-structure issues, 5 minor epic concerns, 3 minor UX-alignment observations) and **0 critical blockers**. Requirements traceability is exceptional: 61/61 FRs (100%) trace from PRD to epics with a consistent coverage map, the UX spec is fully consumed by both architecture and epics (38 UX-DRs mapped to stories), and all 41 stories use testable BDD acceptance criteria with negative cases. The findings above can be used to tighten the artifacts, or you may proceed as-is with the noted decisions made explicitly.

**Assessor:** Implementation Readiness workflow (BMad), facilitated by Claude
**Assessment date:** 2026-06-11
