---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - C:\ElproSaas\AGENTS.md
  - C:\ElproSaas\_bmad-output\project-context.md
  - C:\ElproSaas\_bmad-output\planning-artifacts\prd.md
  - C:\ElproSaas\_bmad-output\planning-artifacts\ux-design-specification.md
  - C:\ElproSaas\_bmad-output\planning-artifacts\architecture.md
  - C:\ElproSaas\docs\planning\saas-rebuild-phased-plan-2026-06-07.md
  - C:\ElproSaas\docs\discovery\e0-domain-oracle-report.md
  - C:\ElproSaas\docs\security\security-guardrails.md
  - C:\ElproSaas\docs\quality\quality-gates.md
  - C:\ElproSaas\docs\process\branching-and-pr-policy.md
  - C:\ElproSaas\docs\decisions\ADR-0001-agentic-development-process.md
phase: Phase A - Internal Pilot MVP
scope: docs-only epic and story planning
---

# Elpro - Epic Breakdown

## Overview

This document provides the Phase A Internal Pilot MVP epic and story breakdown for Elpro, decomposing requirements from the PRD, UX design specification, architecture, and project guardrails into implementation-ready stories.

Phase A is strictly limited to the internal tenant-admin pilot: clean platform foundation, pooled tenant foundation, `tenant_admin` access, CRM, company/settings/pricing, calculations, quote versions/PDF/acceptance, basic job/order creation from accepted quote, required files/documents, and migration/coexistence with golden-master fixtures.

Deferred modules are not implemented, not represented by placeholder UI/routes, and not represented by production tables.

## Requirements Inventory

### Functional Requirements

- FR1: Authenticated users can access Phase A app capabilities only when they have an active tenant membership.
- FR2: Tenant admins can work only inside tenants where they have active `tenant_admin` membership.
- FR3: Tenant admins can view the active tenant/company context used for all tenant-scoped records.
- FR4: Tenant admins can manage Phase A tenant/company settings needed for CRM, pricing, calculations, quotes, files, and jobs/orders.
- FR5: Tenant admins can view audit history for critical tenant-scoped actions.
- FR6: The system can reject cross-tenant reads, writes, lifecycle actions, and file access attempts.
- FR7: Tenant admins can create, view, update, archive, and search customers.
- FR8: Tenant admins can classify customers using Phase A-supported customer types.
- FR9: Tenant admins can create, view, update, archive, and search facilities linked to customers.
- FR10: Tenant admins can create, view, update, archive, and search contacts linked to customers and optionally facilities.
- FR11: Tenant admins can identify a primary contact according to the Phase A contact rule.
- FR12: Tenant admins can select customer, facility, and contact context when creating calculations and quotes.
- FR13: Tenant admins can maintain company identity fields required for quote PDFs.
- FR14: Tenant admins can maintain default quote terms for future quote drafts.
- FR15: Tenant admins can maintain default VAT display and VAT-rate assumptions for Phase A quote workflows.
- FR16: Tenant admins can maintain work roles with active/inactive status and labor pricing inputs.
- FR17: Tenant admins can maintain a minimal article/material catalog if required for pilot calculations.
- FR18: The system can snapshot work-role, article, VAT, and terms data when those values become customer-visible in quote versions.
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
- FR41: Tenant admins can record quote acceptance for a specific sent quote version.
- FR42: Tenant admins can capture acceptance channel, accepted timestamp, accepted-by/admin user, evidence reference, accepted price, notes, and planned dates when available.
- FR43: The system can require explicit reason/evidence when accepted price differs from the sent quote total.
- FR44: The system can make accepted quote version references and acceptance evidence immutable except through an explicit audited correction workflow.
- FR45: The system can create a basic job/order from an accepted quote version.
- FR46: The system can create the acceptance record and basic job/order transactionally.
- FR47: The system can prevent duplicate jobs/orders from repeated acceptance or create-job attempts.
- FR48: Tenant admins can view the source quote version, acceptance evidence, accepted price, and source totals on the resulting job/order.
- FR49: Tenant admins can upload files required for Phase A CRM, calculation, quote, acceptance, and job/order workflows.
- FR50: Tenant admins can view, download, replace where allowed, archive, or delete files according to lifecycle rules.
- FR51: The system can validate file type, size, tenant ownership, owning entity, and storage path before files become usable.
- FR52: The system can serve private files through tenant-authorized, short-lived access.
- FR53: The system can lock or snapshot quote PDFs, quote attachments, and acceptance evidence files when lifecycle rules require immutability.
- FR54: The system can audit file upload, access, delete/archive, and lifecycle-lock events.
- FR55: Pilot operators can classify legacy Lovable records as live, archive-only, excluded, or deferred for Phase A.
- FR56: Pilot operators can create anonymized fixture sets for representative CRM, calculation, quote, PDF, acceptance, file, and accepted-quote-to-job behavior.
- FR57: The system can support shadow comparison of new calculation totals, quote outputs, PDFs, acceptance transitions, and job/order creation against selected Lovable oracle fixtures.
- FR58: Pilot operators can document old/new behavior deltas and fallback decisions before pilot cutover.
- FR59: The system can keep old-app fallback explicit for selected workflows until pilot acceptance gates are met.
- FR60: The system can preserve documented seams for future Fortnox, supplier, field-worker, AI, and RBAC expansion without implementing deferred Phase A modules.
- FR61: Tenant admins cannot access Phase A UI or workflows for Fortnox sync, supplier APIs, AI jobs, HR, rentals, assets/QR, DoU automation, tender/FKU RAG, full field-worker UX, full RBAC, or public privileged endpoints.

### NonFunctional Requirements

- NFR1: Every Phase A business record must be tenant-owned directly or through a tenant-owned parent.
- NFR2: RLS must enforce tenant isolation for all tenant-owned business tables.
- NFR3: Automated tests must prove cross-tenant read/write attempts fail for at least two tenants.
- NFR4: No service-role key may be reachable from browser/client paths.
- NFR5: No unauthenticated privileged function, route, endpoint, webhook, or cron command may exist in Phase A.
- NFR6: Sensitive commands must verify authenticated user, tenant membership, input validity, tenant ownership, and authorization before mutation.
- NFR7: Critical business commands must write audit events with tenant, user, command, target record, lifecycle event, and timestamp.
- NFR8: File access must be tenant-authorized and must not trust client-supplied storage paths.
- NFR9: SEK money must be stored as integer öre, not floating-point kronor.
- NFR10: Quote versions must snapshot all customer-visible financial, tax, terms, attachment, and PDF content required to reproduce the sent commitment.
- NFR11: Sent quote versions must be immutable.
- NFR12: Accepted quote version references and acceptance evidence must be immutable except through explicit audited correction workflows.
- NFR13: Accepted-quote-to-job creation must be transactional and idempotent.
- NFR14: Rounding, VAT, ROT, grön teknik, option/tillval, hidden-row, and accepted-price behavior must be covered by tests before real pilot use.
- NFR15: ROT, grön teknik, VAT assumptions, quote terms, and customer-facing tax wording require owner plus accounting/legal sign-off before real pilot use.
- NFR16: The system must minimize personal data captured in Phase A, especially personnummer and sensitive free-text notes.
- NFR17: Anonymized fixtures must not contain real names, phone numbers, emails, addresses, personal numbers, organization numbers, secrets, or raw customer files unless explicitly approved.
- NFR18: Logs, prompts, screenshots, docs, and committed files must not include customer secrets, real personal data, service-role keys, or `.env` values.
- NFR19: Private files must be served through short-lived signed access and tenant-owned metadata.
- NFR20: Quote acceptance and job/order creation must not leave partial state if one part of the workflow fails.
- NFR21: Old app fallback must remain documented and available for selected workflows until Phase A pilot gates are approved.
- NFR22: Migration/coexistence runs must classify records as live, archive-only, excluded, or deferred before cutover.
- NFR23: Lifecycle correction workflows must preserve original records and record who changed what, when, and why.
- NFR24: Core tenant-admin workflows should remain responsive for pilot-sized data sets: CRM search, calculation editing, quote preview/PDF generation, file metadata retrieval, and job/order creation must not block normal internal use.
- NFR25: PDF generation and signed-file access may be asynchronous or wait-state flows if needed, but must expose completion/failure status to the tenant admin.
- NFR26: Performance targets beyond pilot-sized internal use are deferred until External Beta sizing is known.
- NFR27: The schema and access model must support many tenants in production even during a one-company pilot.
- NFR28: Phase A must not require one Supabase project per customer company.
- NFR29: Deferred modules must not be represented by placeholder production tables that increase migration or RLS surface area before validation.
- NFR30: Tenant-admin workflows must be usable in a standard modern browser with clear form validation, readable text, keyboard-reachable controls, and accessible error states.
- NFR31: Phase A does not require mobile-first installer UX, but the admin web app should avoid layouts that prevent use on common laptop/desktop viewports.
- NFR32: Lovable oracle comparisons must use anonymized fixtures and documented deltas rather than copied legacy code.
- NFR33: Fortnox, supplier, AI, field-worker, HR, rental, asset, DoU, tender/FKU, and full RBAC integrations must remain inactive unless a later ADR-backed scope change approves them.
- NFR34: Future integration seams must not expose credentials, public privileged entrypoints, or external IDs in Phase A production schema.
- NFR35: Clean install from a fresh checkout must be reproducible.
- NFR36: Typecheck, lint, unit tests, and build must pass for Phase A product work.
- NFR37: Unit tests must cover money, VAT, ROT, grön teknik, quote lifecycle, snapshotting, and immutability rules.
- NFR38: Integration tests must cover create calculation, create/send quote version, accept quote, create job/order, file access, and core server commands.
- NFR39: RLS and storage negative tests must prove cross-tenant isolation.
- NFR40: Supabase migration reset from an empty database must pass once migrations exist.
- NFR41: Docs/config-only work may use lighter verification, but skipped product gates must be explicitly stated.

### Additional Requirements

- AR1: Use a clean Next.js App Router application with TypeScript for the Phase A tenant-admin UI and server command surface.
- AR2: Choose exactly one package manager in the platform story; the architecture recommends `pnpm` through the target `pnpm-lock.yaml`.
- AR3: Establish a reproducible clean install, typecheck, lint, unit test, build, and CI baseline before product feature implementation proceeds.
- AR4: Use Supabase Auth, Postgres, Storage, and RLS with dev, staging, and prod Supabase projects and pooled tenancy in production.
- AR5: Implement server-side command handlers for sensitive mutations; browser/client code must never receive service-role credentials or authorize tenant ownership.
- AR6: Resolve tenant context from active `tenant_memberships`, not from trusted client-supplied `tenant_id`.
- AR7: Use `tenant_admin` as the only active Phase A role; full RBAC and role-management UI remain deferred.
- AR8: Every Phase A business table must include direct tenant ownership or enforce tenant ownership through a tenant-owned parent with composite constraints.
- AR9: Use RLS helper predicates such as `is_active_tenant_member(target_tenant_id uuid)` and `is_tenant_admin(target_tenant_id uuid)`.
- AR10: Cross-tenant negative tests must cover read, insert, update, delete/archive, command mismatch, storage access, unauthenticated access, and service-role containment.
- AR11: Phase A v0 schema may include `tenants`, `tenant_memberships`, `tenant_counters`, `audit_events`, `company_settings`, `quote_terms`, `customers`, `facilities`, `contacts`, `work_roles`, optional manual `articles`, calculations, quotes, jobs, `files`, and `file_links`.
- AR12: Phase A v0 schema must explicitly omit Fortnox, integration outbox, external mappings, supplier, AI, employee, rental, asset, DoU, tender, customer portal, broad document-center, and full permission-matrix tables.
- AR13: Monetary values must use integer öre (`bigint`); quantities use explicit decimal/numeric values plus unit; VAT rates use basis points.
- AR14: Apply the conservative pilot rounding assumption unless superseded by sign-off: line net rounded to öre, VAT per rounded line, totals sum rounded lines, exact öre preserved even if PDFs display whole kronor.
- AR15: Snapshot VAT, ROT, grön teknik, rates/caps profile, persons/count, schablon choice, warnings, customer-visible wording, work-role prices, article prices, and terms into quote versions.
- AR16: Do not capture personnummer in Phase A unless a later approved workflow explicitly requires it.
- AR17: Quote versions are customer-commitment snapshots; sent versions make customer-visible fields, selected attachments, and PDF source data immutable.
- AR18: Quote PDFs must be generated from `quote_versions`, `quote_version_lines`, `quote_version_attachments`, and file metadata snapshots, not mutable calculation/customer/settings rows.
- AR19: The exact PDF rendering library must be selected and pinned by the approved quote/PDF implementation story.
- AR20: `acceptQuoteAndCreateJob` is the highest-risk command and must use a single transaction, idempotency, tenant scoping, row locking, uniqueness constraints, and audit events.
- AR21: Transaction-sensitive commands must use an explicit transaction mechanism: a narrow Postgres RPC, a direct server DB transaction adapter, or an approved ADR.
- AR22: Postgres RPC functions default to security invoker; any security-definer function requires separate approval, fixed `search_path`, explicit membership checks, and negative tests.
- AR23: Files must use private buckets, server-derived paths, tenant-owned metadata, short-lived signed URLs, MIME/size validation, lifecycle locks, and generic cross-tenant access-denied messages.
- AR24: Audit logging is append-only operational/security traceability, not broad admin analytics.
- AR25: Migration/coexistence assets should primarily live in `tests/fixtures/golden/lovable/**`, `tests/golden/**`, `docs/migration/**`, and approved `scripts/migration/**`, not production tables unless story-approved.
- AR26: Lovable is a behavioral oracle and fixture source only; no code is copied by default.
- AR27: Product implementation PRs must include phase/scope, story/ADR/process link, changed files, checks run, security/RLS impact, data migration impact, and deferred-scope confirmation.
- AR28: Database migrations, dependency changes, product feature implementation, `.env` edits, network commands, and deferred-scope activation require explicit approval.

### UX Design Requirements

- UX-DR1: Use a restrained tenant-admin operations layout with persistent left sidebar on desktop/laptop, compact top bar, dense readable content, and clear primary actions.
- UX-DR2: Top-level navigation is limited to Dashboard, Kunder, Kalkyler, Offerter, Jobb/Order, Filer, Inställningar, and Pilotstöd/Migrering only if a story requires migration UI.
- UX-DR3: Deferred modules must not appear as navigation items, placeholder screens, dormant route groups, or empty UI.
- UX-DR4: The active navigation section must be visually obvious and accessible to assistive technology.
- UX-DR5: Record detail pages use breadcrumbs or compact headers so admins can move between customer, calculation, quote, and job without losing context.
- UX-DR6: Detail pages use tabs such as Översikt, Rader, Filer, Händelser, and Versioner instead of nested sidebars.
- UX-DR7: At medium widths, the sidebar collapses to an icon rail with tooltips while preserving page title and primary action.
- UX-DR8: At small widths, navigation uses a drawer and detail panes stack vertically; tenant-admin workflows remain usable but no installer mobile UX is implied.
- UX-DR9: Lists preserve filters, search, and pagination when returning from detail screens.
- UX-DR10: Lifecycle states such as Draft, Ready, Sent, Accepted, Job created, and Correction needed are visible everywhere records appear.
- UX-DR11: Calculation editor uses a work-focused layout with record header, customer context, status, section/row editor, and persistent totals/readiness summary on desktop.
- UX-DR12: Calculation rows support labor, material, subcontractor, machinery, and other row types with quantity, unit, unit cost/sell price, markup/margin, VAT, totals, quote-visible labels/notes, and internal notes.
- UX-DR13: Options/tillval must be visibly separate from base totals and show whether they are included in base total, quote display, and acceptance semantics.
- UX-DR14: Quote visibility controls cover detailed, summary, text-only, hidden, and optional/tillval behavior where stories approve those modes.
- UX-DR15: Calculation readiness separates blocking issues from warnings and includes warnings for margin, missing context, empty/zero rows, missing work role, unresolved tax assumptions, hidden rows, and missing required files.
- UX-DR16: Before quote version creation, present snapshot review covering CRM context, sections, visible/hidden handling, options, totals, VAT, tax assumptions, terms, selected attachments, and captured warnings.
- UX-DR17: Quote detail shows lifecycle header, version timeline, selected immutable snapshot, PDF status, acceptance state, files, and events.
- UX-DR18: PDF preview renders from the selected quote version snapshot and exposes not generated, generating, generated, failed, and retry states.
- UX-DR19: Marking sent requires confirmation that the selected version becomes immutable.
- UX-DR20: Sent version UI disables customer-visible editing and directs users to create a new version for customer-visible changes.
- UX-DR21: Internal notes remain visually separate from customer-visible quote snapshot content.
- UX-DR22: Acceptance capture collects channel, timestamp, admin user, evidence file/reference, accepted price, adjustment reason if needed, notes, and planned dates.
- UX-DR23: Acceptance confirmation states that acceptance evidence and accepted version become immutable except through audited correction.
- UX-DR24: Repeated acceptance/create-job attempts show the existing accepted state/job instead of creating duplicates.
- UX-DR25: Job/order UX exists only for work created from an accepted quote and must not include field-worker scheduling, time/material reporting, deviations, project analytics, ÄTA, or invoice workflows.
- UX-DR26: Job/order detail shows source quote version, acceptance evidence, customer/facility/contact, basic status, accepted value, planned dates, files, and event history.
- UX-DR27: File UI is entity-scoped first; a limited file index is optional and cannot become a broad document center.
- UX-DR28: Upload interactions show allowed file types, size expectations, owner/entity, and purpose, and never ask users to enter storage paths.
- UX-DR29: File errors distinguish blocked type, oversize, network/server failure, and permission/tenant failure without exposing cross-tenant record existence.
- UX-DR30: Validation errors appear next to fields and are summarized for blocking errors; warnings are separate.
- UX-DR31: Immutability errors explain the lifecycle rule and offer the correct next action, such as creating a new quote version.
- UX-DR32: The app is keyboard usable across sidebar, top actions, tabs, tables, row editors, dialogs, and file controls.
- UX-DR33: Icon-only controls have accessible names and visible tooltips or equivalent help.
- UX-DR34: Form controls have labels, helpful descriptions where needed, and programmatic error association.
- UX-DR35: Focus moves predictably when opening/closing dialogs, adding rows, creating versions, and completing acceptance.
- UX-DR36: Status badges include text, not only color; UI does not rely on color alone.
- UX-DR37: PDF preview/download controls remain accessible even if a preview canvas or embed is unavailable.
- UX-DR38: Responsive layouts prevent overlapping controls, clipped labels, and unreachable actions.

### FR Coverage Map

FR1: Epic 2 - Authenticated tenant membership is required for app access.
FR2: Epic 2 - Users can work only inside active `tenant_admin` memberships.
FR3: Epic 2 - Active tenant context is visible and authoritative.
FR4: Epic 3 - Tenant/company settings needed by Phase A workflows are manageable.
FR5: Epic 2 - Minimal audit history exists for critical tenant-scoped actions.
FR6: Epic 2 - Cross-tenant reads, writes, lifecycle actions, and file access are rejected.
FR7: Epic 3 - Tenant admins can manage customers.
FR8: Epic 3 - Tenant admins can classify customers using approved Phase A types.
FR9: Epic 3 - Tenant admins can manage facilities linked to customers.
FR10: Epic 3 - Tenant admins can manage contacts linked to customers/facilities.
FR11: Epic 3 - Tenant admins can identify a primary contact according to Phase A rules.
FR12: Epic 3 - Tenant admins can select customer/facility/contact context for calculations and quotes.
FR13: Epic 3 - Tenant admins can maintain quote PDF company identity fields.
FR14: Epic 3 - Tenant admins can maintain default quote terms.
FR15: Epic 3 - Tenant admins can maintain default VAT display and VAT assumptions.
FR16: Epic 3 - Tenant admins can maintain work roles and labor pricing inputs.
FR17: Epic 3 - Tenant admins can maintain optional minimal manual articles if pilot fixtures require them.
FR18: Epic 3 - Pricing, VAT, article, work-role, and terms values can be snapshotted when customer-visible.
FR19: Epic 5 - Tenant admins can create calculations linked to CRM context.
FR20: Epic 5 - Tenant admins can organize calculations into ordered sections.
FR21: Epic 5 - Tenant admins can add labor, material, subcontractor, machinery, and other rows.
FR22: Epic 5 - Tenant admins can enter quantity, unit, pricing, margin, and visibility data.
FR23: Epic 5 - Labor rows preserve selected work-role source/pricing.
FR24: Epic 5 - Material rows preserve selected article/pricing source when articles are included.
FR25: Epic 5 - Rows/sections support Phase A quote visibility and option modes.
FR26: Epic 8 - Calculation attachments are handled through the Phase A file model.
FR27: Epic 4 - Money/tax primitives calculate line, section, quote, margin, VAT, and customer totals.
FR28: Epic 4 - ROT/grön teknik estimates use snapshotted assumptions and warnings.
FR29: Epic 5 - Quote-readiness warnings surface incomplete customer, pricing, tax, margin, row, or attachment assumptions.
FR30: Epic 6 - Tenant admins can create draft quote versions from calculation snapshots.
FR31: Epic 6 - Tenant admins can edit draft quote content before sending.
FR32: Epic 6 - Quote numbers are generated server-side and tenant-scoped.
FR33: Epic 6 - Quote PDFs are generated from quote version snapshots.
FR34: Epic 6 - Tenant admins can select calculation attachments for quote output before send.
FR35: Epic 6 - Quote versions snapshot customer-visible content, lines, totals, tax, terms, attachments, and PDF metadata.
FR36: Epic 6 - Tenant admins can mark a quote version as sent.
FR37: Epic 6 - Sent quote versions are immutable.
FR38: Epic 6 - Tenant admins can create a new version for customer-visible changes after send.
FR39: Epic 6 - Tenant admins can view quote lifecycle history.
FR40: Epic 6 - Prior sent quote versions are preserved for audit and comparison.
FR41: Epic 7 - Tenant admins can record acceptance for a specific sent quote version.
FR42: Epic 7 - Acceptance captures channel, timestamp, admin, evidence, price, notes, and planned dates.
FR43: Epic 7 - Adjusted accepted price requires explicit reason/evidence.
FR44: Epic 7 - Accepted version references and evidence are immutable except audited correction.
FR45: Epic 7 - Basic job/order is created from accepted quote version.
FR46: Epic 7 - Acceptance and job/order creation are transactional.
FR47: Epic 7 - Duplicate job/order creation is prevented under repeated attempts.
FR48: Epic 7 - Job/order shows source quote version, acceptance evidence, price, and totals.
FR49: Epic 8 - Tenant admins can upload files for Phase A workflows.
FR50: Epic 8 - Tenant admins can view, download, replace where allowed, archive, or delete files by lifecycle rule.
FR51: Epic 8 - File type, size, tenant ownership, owning entity, and path are validated before use.
FR52: Epic 8 - Private files are served through tenant-authorized short-lived access.
FR53: Epic 8 - Quote PDFs, quote attachments, and acceptance evidence are locked/snapshotted by lifecycle rule.
FR54: Epic 8 - File upload, access, archive/delete, and lock events are audited.
FR55: Epic 9 - Pilot operators classify legacy Lovable records.
FR56: Epic 9 - Pilot operators create anonymized fixture sets.
FR57: Epic 9 - Shadow comparisons cover calculations, quotes, PDFs, acceptance, and job creation.
FR58: Epic 9 - Old/new deltas and fallback decisions are documented before cutover.
FR59: Epic 9 - Old-app fallback remains explicit until pilot acceptance gates pass.
FR60: Epic 1 - Future seams are documented without implementing deferred modules.
FR61: Epic 1 - Deferred modules have no Phase A UI, routes, tables, jobs, or public privileged endpoints.

## Epic List

### Epic 1: Platform Foundation And Scope Guardrails

Tenant admins and implementers get a reproducible, documented Phase A app foundation that can be installed, verified, and extended without pulling deferred modules into the rebuild.

**FRs covered:** FR60, FR61

**Primary NFR/AR coverage:** NFR29, NFR33, NFR34, NFR35, NFR36, NFR40, NFR41, AR1, AR2, AR3, AR12, AR26, AR27, AR28

**Natural dependencies:** None. This epic enables every later epic.

### Epic 2: Tenant Access, Admin Auth, RLS, And Audit Foundation

Tenant admins can authenticate, operate only inside their tenant, and rely on enforced tenant isolation, minimal audit traceability, and cross-tenant negative tests before any business workflow is trusted.

**FRs covered:** FR1, FR2, FR3, FR5, FR6

**Primary NFR/AR coverage:** NFR1, NFR2, NFR3, NFR4, NFR5, NFR6, NFR7, NFR27, NFR28, NFR39, AR4, AR5, AR6, AR7, AR8, AR9, AR10, AR22, AR24

**Natural dependencies:** Epic 1.

### Epic 3: CRM, Company Settings, And Pricing Foundation

Tenant admins can maintain the customer, facility, contact, company identity, quote terms, VAT defaults, work roles, and optional manual article data needed to start calculations and quote snapshots.

**FRs covered:** FR4, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR18

**Primary NFR/AR coverage:** NFR1, NFR2, NFR3, NFR6, NFR7, NFR15, NFR16, NFR18, NFR30, NFR31, AR11, AR15, AR16

**Natural dependencies:** Epics 1-2.

### Epic 4: Money, Tax, Snapshot Primitives, And Golden Fixtures

Tenant admins and reviewers can trust calculation and quote totals because money, VAT, ROT, grön teknik, rounding, snapshot builders, and golden-master fixtures are explicit, tested, and sign-off ready.

**FRs covered:** FR27, FR28

**Primary NFR/AR coverage:** NFR9, NFR10, NFR14, NFR15, NFR32, NFR37, AR13, AR14, AR15, AR26

**Natural dependencies:** Epics 1-3.

### Epic 5: Calculation Workspace And Quote Readiness

Tenant admins can build Phase A calculations with sections, rows, pricing sources, options/tillval, visibility rules, attachments, totals, tax warnings, and readiness checks before creating a quote version.

**FRs covered:** FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR29

**Primary NFR/AR coverage:** NFR1, NFR2, NFR3, NFR6, NFR7, NFR9, NFR14, NFR24, NFR30, NFR31, NFR37, NFR38, UX-DR11 through UX-DR16

**Natural dependencies:** Epics 1-4. File attachment behavior is completed by Epic 8 but calculation work remains functional without broad file-center behavior.

### Epic 6: Quote Versions, PDF, And Lifecycle

Tenant admins can create quote versions from calculation snapshots, generate PDFs, mark versions sent, preserve immutable customer commitments, and create new versions when customer-visible content changes.

**FRs covered:** FR30, FR31, FR32, FR33, FR34, FR35, FR36, FR37, FR38, FR39, FR40

**Primary NFR/AR coverage:** NFR10, NFR11, NFR14, NFR15, NFR23, NFR25, NFR37, NFR38, AR17, AR18, AR19, UX-DR17 through UX-DR21

**Natural dependencies:** Epics 1-5. Story 6.3 introduces only the minimal quote-PDF private storage slice needed for generated PDFs; Epic 8 later expands reusable file handling.

### Epic 7: Acceptance-To-Job Transaction

Tenant admins can record off-system acceptance for a sent quote and create or reuse a basic job/order in one idempotent, tenant-scoped, audited transaction with immutable source references.

**FRs covered:** FR41, FR42, FR43, FR44, FR45, FR46, FR47, FR48

**Primary NFR/AR coverage:** NFR12, NFR13, NFR20, NFR23, NFR37, NFR38, AR20, AR21, UX-DR22 through UX-DR26

**Natural dependencies:** Epics 1-6 and the Phase A subset of Epic 8 for acceptance evidence files.

### Epic 8: Required Files And Private Storage

Tenant admins can manage only the files needed by Phase A entities through private tenant-owned storage, validated uploads, signed access, lifecycle locks, and file-specific audit events.

**FRs covered:** FR26, FR34, FR49, FR50, FR51, FR52, FR53, FR54

**Primary NFR/AR coverage:** NFR1, NFR2, NFR3, NFR8, NFR18, NFR19, NFR39, AR23, UX-DR27 through UX-DR29, UX-DR37

**Natural dependencies:** Epics 1-3 for tenant/CRM context; integrates with Epics 5-7 as those workflows need attachments, PDFs, and evidence.

### Epic 9: Migration, Coexistence, Golden Masters, And Pilot Readiness

Pilot operators can classify legacy records, create anonymized Lovable oracle fixtures, compare new behavior with selected old behavior, document deltas, and preserve old-app fallback before real pilot cutover.

**FRs covered:** FR55, FR56, FR57, FR58, FR59

**Primary NFR/AR coverage:** NFR17, NFR21, NFR22, NFR32, NFR37, NFR38, NFR39, AR25, AR26

**Natural dependencies:** Epics 1-8 for full end-to-end comparison; fixture capture can begin earlier as docs/test data work.

## Epic 1: Platform Foundation And Scope Guardrails

**Epic goal:** Create a reproducible, documented Phase A app foundation that makes the pilot implementable without accidentally importing deferred modules.

**Scope:** Clean Next.js App Router foundation, TypeScript baseline, `pnpm`, local setup docs, `.env.example`, CI quality gates, route/navigation scope guardrails, and deferred-scope checks.

**Explicit non-scope:** Product business workflows, database business tables, Supabase migrations for domain data, deferred routes/UI/tables/jobs, `.env` edits, real secrets, and Lovable code copying.

**Dependencies:** None.

**Risks:** Package manager drift, hidden dependency changes, deferred module placeholders, non-reproducible local setup, and CI that does not reflect Phase A quality gates.

### Story 1.1: Choose Package Manager And Initialize App Baseline

As an implementation lead,
I want one reproducible application baseline using a single package manager,
So that every later Phase A story starts from the same install, type, and build assumptions.

**Acceptance Criteria:**

**Given** a fresh checkout
**When** the platform foundation is initialized
**Then** the project uses exactly one package manager: `pnpm`
**And** `package.json`, `pnpm-lock.yaml`, TypeScript, ESLint, App Router, Tailwind, and `@/*` imports are configured consistently with the architecture.

**Given** the app is initialized
**When** a developer runs documented install and verification commands
**Then** clean install, typecheck, lint, and build commands are available and reproducible
**And** no other lockfile or package-manager metadata is committed.

**Given** Phase A scope constraints
**When** initial route/app folders are created
**Then** no deferred module route, placeholder screen, navigation item, schema, job, or integration stub is added.

**Technical Notes:** Prefer the current architecture target of Next.js App Router, TypeScript, Tailwind, ESLint, and `pnpm`. Pin exact package versions during implementation. Do not copy Lovable code.

**Test Requirements:** Clean install, typecheck, lint, and build must pass. Include a repository check that fails on extra lockfiles.

**Security/RLS Impact:** No tenant-owned data yet. Confirm no service-role env name appears in browser/client code.

**Money/Tax/Quote Impact:** None.

**Migration/Coexistence Impact:** None.

**Dependencies:** None.

**Stop Conditions Requiring Human Approval:** Stop if a package manager other than `pnpm` is proposed, if a new runtime/dependency materially changes architecture, or if implementation adds deferred module structure.

### Story 1.2: Establish CI And Quality Gate Baseline

As an implementation lead,
I want CI to run the minimum Phase A verification gates,
So that every product story has a consistent definition of done.

**Acceptance Criteria:**

**Given** a pull request for Phase A product work
**When** CI runs
**Then** install, typecheck, lint, unit test, and build jobs execute using `pnpm`
**And** the PR template or checklist captures phase, story/ADR link, checks run, security/RLS impact, data migration impact, and deferred-scope confirmation.

**Given** no database migrations exist yet
**When** CI is configured
**Then** migration reset, integration, RLS, storage, and golden-master jobs are documented as required once the relevant stories introduce those surfaces
**And** skipped product gates must be explicitly stated for docs/config-only work.

**Technical Notes:** Keep CI small but expandable. Do not add production observability or external service integrations in this story.

**Test Requirements:** CI workflow syntax validates and the baseline local commands pass.

**Security/RLS Impact:** Establishes future security gate enforcement but does not create policies.

**Money/Tax/Quote Impact:** Establishes future unit/golden-master gate requirements.

**Migration/Coexistence Impact:** Establishes future migration reset and golden comparison gate placeholders without creating production migration code.

**Dependencies:** Story 1.1.

**Stop Conditions Requiring Human Approval:** Stop if CI requires secrets, external paid services, global machine changes, or deferred integration setup.

### Story 1.3: Build Phase A App Shell And Deferred-Scope Navigation Guardrails

As a tenant admin,
I want a focused operations app shell showing only Phase A modules,
So that I can navigate the pilot workflow without seeing unavailable or deferred product areas.

**Acceptance Criteria:**

**Given** the tenant-admin app shell
**When** the user views desktop/laptop navigation
**Then** the sidebar contains only Dashboard, Kunder, Kalkyler, Offerter, Jobb/Order, Filer, Inställningar, and Pilotstöd/Migrering only if an approved migration story requires it
**And** no Fortnox, field-worker, supplier, AI, HR, rentals, assets/QR, DoU, tender/FKU, full RBAC, customer portal, or analytics placeholder appears.

**Given** responsive layouts
**When** the viewport becomes medium or small
**Then** navigation collapses to an accessible icon rail or drawer
**And** page title and primary action remain reachable without clipped labels or overlapping controls.

**Given** an icon-only control
**When** it receives focus or hover
**Then** it has an accessible name and visible tooltip or equivalent help.

**Technical Notes:** Implement only shell-level UX and empty Phase A-owned route containers needed by approved stories. Avoid nested sidebars.

**Test Requirements:** Component/UI tests cover navigation items, active state, keyboard reachability, and absence of deferred labels/routes. Manual or automated responsive checks cover desktop, medium, and small widths.

**Security/RLS Impact:** No authorization boundary is created by navigation; later stories must enforce access server-side and through RLS.

**Money/Tax/Quote Impact:** None.

**Migration/Coexistence Impact:** Pilotstöd/Migrering is hidden unless an approved story activates it.

**Dependencies:** Story 1.1.

**Stop Conditions Requiring Human Approval:** Stop if a requested nav item belongs to deferred scope or if a placeholder route is proposed for a future module.

### Story 1.4: Document Local Setup, Environment Contract, And Repo Hygiene

As an implementation lead,
I want local setup and environment expectations documented without secrets,
So that agents and developers can run the pilot consistently and safely.

**Acceptance Criteria:**

**Given** a fresh developer machine
**When** the developer follows the README/local setup docs
**Then** install, dev, typecheck, lint, unit test, build, and future Supabase local commands are discoverable
**And** Docker/Supabase instructions follow the repository's Windows/WSL/Docker conventions.

**Given** environment configuration is needed
**When** `.env.example` is created or updated
**Then** it contains only placeholder values and documented variable names
**And** `.env` is gitignored.

**Given** the Lovable oracle policy
**When** docs describe reuse
**Then** they state that Lovable is a behavioral oracle only and code is not copied by default.

**Technical Notes:** Do not edit real `.env`. Do not make global Docker Desktop, daemon, WSL, or system-level changes.

**Test Requirements:** Lightweight docs review plus repo check that `.env` is ignored and no obvious secrets are committed.

**Security/RLS Impact:** Reduces secret-handling risk. No RLS yet.

**Money/Tax/Quote Impact:** None.

**Migration/Coexistence Impact:** Documents old-app oracle/fallback posture but does not capture fixtures.

**Dependencies:** Stories 1.1 and 1.2.

**Stop Conditions Requiring Human Approval:** Stop if real secrets are needed, if global Docker/system changes are requested, or if setup requires a new dependency outside the approved platform story.

## Epic 2: Tenant Access, Admin Auth, RLS, And Audit Foundation

**Epic goal:** Make tenant access trustworthy before business data exists.

**Scope:** Supabase Auth entry, active tenant context, tenant/membership tables, `tenant_admin` only, RLS helpers, command auth envelope, append-only audit basics, two-tenant test fixtures, and cross-tenant negative tests.

**Explicit non-scope:** Full RBAC, role-management UI, customer portal auth, public privileged endpoints, Fortnox/supplier/AI auth, and broad audit analytics.

**Dependencies:** Epic 1.

**Risks:** Client-trusted tenant IDs, missing RLS on new tables, service-role leakage, unauthenticated privileged routes, and audit tables turning into analytics scope.

### Story 2.1: Tenant Admin Login And Tenant Context Resolution

As a tenant admin,
I want to sign in and see the active tenant context,
So that all Phase A work is clearly scoped to the correct company.

**Acceptance Criteria:**

**Given** an authenticated Supabase user with active `tenant_admin` membership
**When** the user opens the app
**Then** the server resolves tenant context from membership
**And** the UI displays the active tenant/company context.

**Given** an authenticated user without active membership
**When** the user opens a protected app route
**Then** access is denied with a user-safe message
**And** no tenant-owned data is loaded.

**Given** an unauthenticated user
**When** the user opens a protected app route or server command
**Then** the user is redirected or rejected
**And** no privileged function or route is callable anonymously.

**Technical Notes:** Implement `resolveTenantContext` server-side. Client-supplied tenant IDs are ignored or verified against resolved membership.

**Test Requirements:** Auth integration tests cover active membership, missing membership, disabled membership, and anonymous access.

**Security/RLS Impact:** Establishes tenant context authority. Include negative tests for mismatched client-supplied tenant IDs.

**Money/Tax/Quote Impact:** None.

**Migration/Coexistence Impact:** None.

**Dependencies:** Epic 1.

**Stop Conditions Requiring Human Approval:** Stop if a service-role key is proposed for browser/client paths or if public privileged auth bypass is introduced.

### Story 2.2: Tenant Membership Schema, RLS Helpers, And Two-Tenant Fixtures

As an implementation lead,
I want tenant ownership and membership enforced in the database,
So that later CRM, quote, file, and job data cannot leak across tenants.

**Acceptance Criteria:**

**Given** Phase A migrations for tenant foundation
**When** the database is reset from empty
**Then** `tenants`, `tenant_memberships`, and required helper functions are created
**And** membership role is constrained to `tenant_admin` for Phase A.

**Given** two tenants and two users in test fixtures
**When** tenant A user queries tenant B membership or tenant rows
**Then** RLS denies access
**And** tests prove Tenant A cannot insert, update, delete, or spoof Tenant B ownership.

**Given** a business table is added in a later story
**When** that story is implemented
**Then** it must reuse the tenant helper pattern and add table-specific RLS negative tests.

**Technical Notes:** Use `is_active_tenant_member(target_tenant_id uuid)` and `is_tenant_admin(target_tenant_id uuid)` helpers or documented equivalents. Any security-definer helper requires fixed `search_path`, explicit review, and negative tests.

**Test Requirements:** Supabase migration reset, RLS select/insert/update/delete negatives, and role constraint tests.

**Security/RLS Impact:** High. This is the baseline RLS foundation for all tenant-owned data.

**Money/Tax/Quote Impact:** None.

**Migration/Coexistence Impact:** Two-tenant fixture shape should later support golden-master isolation cases.

**Dependencies:** Story 2.1.

**Stop Conditions Requiring Human Approval:** Stop if a migration is not approved by this story, if full RBAC tables/UI are proposed, or if one-Supabase-project-per-customer architecture is introduced.

### Story 2.3: Server Command Envelope And Minimal Audit Events

As an implementation lead,
I want sensitive mutations wrapped in a consistent command envelope with audit events,
So that later lifecycle changes are authenticated, tenant-scoped, validated, and traceable.

**Acceptance Criteria:**

**Given** a server-side command
**When** it handles a sensitive mutation
**Then** it resolves authenticated user, active tenant membership, validates input, verifies tenant ownership, writes audit where required, and returns typed user-safe errors.

**Given** critical events occur
**When** audit logging is invoked
**Then** `audit_events` records tenant, actor, command, event type, target type/id, request/correlation id, safe metadata, and timestamp
**And** audit events are append-only through normal app paths.

**Given** a tenant admin views record context later
**When** audit history is shown
**Then** only minimal relevant lifecycle/audit events are surfaced
**And** no broad audit analytics module is created.

**Technical Notes:** Create the command envelope and `audit_events` only. Audit metadata must not include secrets, `.env`, raw file contents, or broad free-text PII.

**Test Requirements:** Command unit/integration tests cover auth failure, membership failure, validation failure, successful audit write, append-only behavior, and cross-tenant audit denial.

**Security/RLS Impact:** High. RLS negative tests must prove tenant A cannot read or write tenant B audit events.

**Money/Tax/Quote Impact:** Establishes audit foundation for later money/quote lifecycle events.

**Migration/Coexistence Impact:** Later migration/coexistence approvals can use audit events if represented in app.

**Dependencies:** Stories 2.1 and 2.2.

**Stop Conditions Requiring Human Approval:** Stop if audit scope expands into broad analytics, if service-role usage is proposed without documented purpose/test coverage, or if command handlers trust client tenant IDs.

### Story 2.4: Security Regression Harness For Tenant And Service-Role Boundaries

As an implementation lead,
I want automated security regression checks for tenant isolation and privileged boundaries,
So that later stories cannot silently weaken Phase A security.

**Acceptance Criteria:**

**Given** the security harness
**When** RLS tests run
**Then** they include read, insert, update, delete/archive, command mismatch, anonymous access, and service-role containment checks for current tenant-owned tables.

**Given** browser/client build output
**When** containment checks run
**Then** no service-role key names, secret placeholders, or server-only command internals are exposed to browser bundles, public route payloads, or logs.

**Given** new tenant-owned tables are added later
**When** a product PR touches them
**Then** the PR must add or update cross-tenant negative tests before merge.

**Technical Notes:** Keep checks local/CI-friendly. Do not require external security services in Phase A.

**Test Requirements:** Harness must fail on an intentionally mismatched tenant access attempt. Include anonymous privileged endpoint checks.

**Security/RLS Impact:** High. This story enforces the recurring security acceptance criteria for tenant data stories.

**Money/Tax/Quote Impact:** None directly, but later money/quote tables must join the harness.

**Migration/Coexistence Impact:** Fixture anonymization checks can build on the same no-secrets posture later.

**Dependencies:** Stories 2.1 through 2.3.

**Stop Conditions Requiring Human Approval:** Stop if checks require secrets, network-only services, or changes to global machine configuration.

## Epic 3: CRM, Company Settings, And Pricing Foundation

**Epic goal:** Give tenant admins the tenant-owned customer, facility, contact, settings, terms, VAT, and pricing inputs needed to start quote-producing work.

**Scope:** Customers, facilities, contacts, company identity, quote terms, VAT defaults/display assumptions, work roles, optional manual articles, tenant-admin UX, server commands, RLS, audit, and snapshot source metadata.

**Explicit non-scope:** Supplier APIs/imports, Fortnox customer/article sync, personnummer capture, full RBAC, broad CRM analytics, and deferred-module document center behavior.

**Dependencies:** Epics 1-2.

**Risks:** Capturing unnecessary personal data, making facility/contact rules too rigid before owner sign-off, accidentally activating supplier scope through articles, and failing to snapshot mutable pricing/settings inputs.

### Story 3.1: Tenant-Owned CRM Data Model And Commands

As a tenant admin,
I want to manage customers, facilities, and contacts,
So that calculations and quotes can use the correct customer context.

**Acceptance Criteria:**

**Given** tenant-owned CRM tables
**When** migrations run from empty
**Then** `customers`, `facilities`, and `contacts` are created with tenant ownership, archive status, timestamps, and parent tenant consistency constraints
**And** no personnummer field is included by default.

**Given** a tenant admin
**When** the admin creates, views, updates, archives, or searches CRM records
**Then** server commands verify tenant membership, validate inputs, enforce parent ownership, and write audit events for critical changes.

**Given** tenant A and tenant B fixtures
**When** tenant A attempts to read/write tenant B CRM records or link to tenant B parent IDs
**Then** RLS and command validation reject the attempt.

**Technical Notes:** Treat facility/contact requiredness and customer-type list as configurable business rules requiring owner sign-off before real pilot use. Use archive over hard delete by default.

**Test Requirements:** Command integration tests, RLS negative tests for all CRM tables, validation tests for required display name/email/phone formats where implemented.

**Security/RLS Impact:** High. CRM tables are tenant-owned and must include cross-tenant negative tests.

**Money/Tax/Quote Impact:** CRM context will be snapshotted into later quote versions.

**Migration/Coexistence Impact:** Fields should support anonymized Lovable CRM fixtures without importing deferred data.

**Dependencies:** Epic 2.

**Stop Conditions Requiring Human Approval:** Stop if personnummer capture is requested, if customer type/requiredness decisions materially change the data model, or if deferred CRM-adjacent modules are introduced.

### Story 3.2: CRM Tenant-Admin UX And Lifecycle Context

As a tenant admin,
I want a focused CRM interface for customers, facilities, and contacts,
So that I can find or create the right context before building a calculation.

**Acceptance Criteria:**

**Given** the CRM list
**When** the admin searches or filters
**Then** customers can be found by approved Phase A fields
**And** empty, loading, failed, no-results, and duplicate-like warning states are clear.

**Given** a customer detail screen
**When** the admin views it
**Then** facilities, contacts, related calculations/quotes/jobs placeholders for Phase A-owned records, files, and event history areas are visible only where supported by completed stories
**And** no deferred modules are shown.

**Given** facility/contact dialogs or detail views
**When** they open and close
**Then** focus moves predictably and validation errors are programmatically associated with fields.

**Technical Notes:** Use Swedish domain labels where helpful: Kunder, Anläggningar, Kontakter. Encourage facility/contact context but do not make universal requiredness stricter than approved assumptions.

**Test Requirements:** UI tests for search/filter state, keyboard navigation, validation states, no deferred navigation labels, and route authorization.

**Security/RLS Impact:** UI cannot be the security boundary; server commands and RLS from Story 3.1 must enforce isolation.

**Money/Tax/Quote Impact:** None directly.

**Migration/Coexistence Impact:** UI fields should be compatible with anonymized Lovable CRM fixtures.

**Dependencies:** Story 3.1.

**Stop Conditions Requiring Human Approval:** Stop if UI requires final customer-type/primary-contact policy beyond conservative assumptions or asks for broad CRM analytics.

### Story 3.3: Company Identity, Quote Terms, And VAT Defaults

As a tenant admin,
I want to maintain company quote identity, default terms, and VAT display assumptions,
So that quote snapshots can use approved tenant-owned defaults.

**Acceptance Criteria:**

**Given** tenant-owned settings tables
**When** the admin updates company identity, default VAT display, VAT assumptions, or quote terms
**Then** changes are validated, tenant-scoped, audited, and visible in settings UI.

**Given** quote terms are edited
**When** the admin marks them usable for pilot quotes
**Then** the UI shows owner/legal sign-off status or warning
**And** customer-facing text is not silently approved by implementation.

**Given** tenant A and tenant B settings
**When** tenant A attempts to read/write tenant B settings or terms
**Then** RLS and command tests reject access.

**Technical Notes:** Default quote terms from Lovable may be used only as an anonymized/content-shape reference after owner approval. Store values needed for later snapshotting.

**Test Requirements:** Settings command integration tests, RLS negative tests, audit tests, form validation tests, and sign-off warning tests.

**Security/RLS Impact:** High. Settings/terms are tenant-owned.

**Money/Tax/Quote Impact:** VAT defaults and quote terms become quote snapshot inputs; quote terms and tax wording need sign-off before real pilot use.

**Migration/Coexistence Impact:** Support fixture capture of settings/terms without real company/person-specific text unless approved.

**Dependencies:** Epic 2.

**Stop Conditions Requiring Human Approval:** Stop if final VAT/rounding/tax wording is treated as approved without owner/accounting/legal sign-off.

### Story 3.4: Work Roles And Optional Manual Articles

As a tenant admin,
I want to maintain labor roles and optional manual material articles,
So that calculations can use reusable prices without supplier integration scope.

**Acceptance Criteria:**

**Given** work role management
**When** the admin creates, updates, archives, or reactivates a role
**Then** cost/sell hourly rates, active state, display name, and source timestamps are tenant-owned and audited.

**Given** articles are enabled by the implementation story
**When** the admin manages article/material records
**Then** articles are manual, minimal, tenant-owned, and contain no supplier credentials, supplier sync fields, imports, APIs, or external mappings.

**Given** tenant A and tenant B pricing data
**When** tenant A attempts cross-tenant access or parent spoofing
**Then** RLS and command validation reject the attempt.

**Technical Notes:** `articles` are optional and should be included only if pilot fixtures or owner decision require reusable material rows. Work role and article values must be snapshottable when used.

**Test Requirements:** Pricing command integration tests, RLS negative tests, money input validation tests using integer öre, and audit tests for pricing changes.

**Security/RLS Impact:** High. Pricing data is tenant-owned and customer-visible downstream.

**Money/Tax/Quote Impact:** Prices are source inputs for calculation rows and quote snapshots; unit/golden tests must cover source snapshot behavior when used.

**Migration/Coexistence Impact:** Supports work-role/article fixture capture from Lovable only after anonymization.

**Dependencies:** Stories 3.1 and 3.3.

**Stop Conditions Requiring Human Approval:** Stop if article work expands into supplier APIs/imports/credentials or if article inclusion is not needed by pilot fixtures.

### Story 3.5: Snapshot Source Contract For Settings And Pricing Inputs

As an implementation lead,
I want a shared snapshot contract for mutable settings and pricing inputs,
So that later calculations and quotes can explain exactly where customer-visible values came from.

**Acceptance Criteria:**

**Given** mutable sources such as work roles, articles, VAT defaults, and quote terms
**When** a calculation row or quote snapshot uses them
**Then** the source ID, display name/content, monetary values in öre, VAT assumptions, source timestamp/version, and tenant ownership are captured according to a documented contract.

**Given** a source value later changes
**When** a previously created row or quote version is viewed
**Then** the previous snapshot remains explainable and does not silently recalculate from the mutable source.

**Given** tenant-owned source records
**When** tests run
**Then** cross-tenant use of source IDs is rejected by command validation and RLS.

**Technical Notes:** This story defines and tests the contract; concrete quote snapshot persistence is completed in Epics 5-6. Keep the contract small and aligned with actual Phase A fields.

**Test Requirements:** Unit tests for snapshot builders, integration tests for source ownership validation, and golden fixture examples for work role and optional article source data.

**Security/RLS Impact:** Medium-high. Prevents cross-tenant source spoofing.

**Money/Tax/Quote Impact:** High. This is the bridge between mutable settings/pricing and immutable quote commitments.

**Migration/Coexistence Impact:** Supports Lovable comparison of pricing source behavior without copying code.

**Dependencies:** Stories 3.3 and 3.4.

**Stop Conditions Requiring Human Approval:** Stop if the snapshot contract requires unapproved tax/legal wording or additional tables for deferred modules.

## Epic 4: Money, Tax, Snapshot Primitives, And Golden Fixtures

**Epic goal:** Make money, VAT, ROT, grön teknik, rounding, and snapshot behavior explicit and testable before calculations or quotes depend on them.

**Scope:** Integer öre primitives, rounding policy, VAT calculations, ROT/grön teknik estimate logic, warnings/sign-off flags, snapshot builders, and golden-master fixtures for representative money/tax cases.

**Explicit non-scope:** Production approval of legal/tax constants, customer-facing tax disclaimer approval, Fortnox/accounting integration, invoicing, personnummer capture, and final commercial tax advisory behavior.

**Dependencies:** Epics 1-3.

**Risks:** Floating-point drift, hardcoded VAT/tax constants, unapproved ROT/grön teknik assumptions, hidden-row/tillval ambiguity, and weak tests around accepted price behavior.

### Story 4.1: Integer Ore Money And Rounding Primitives

As a tenant admin,
I want money totals to be calculated consistently in exact öre,
So that customer-visible amounts can be reproduced and trusted.

**Acceptance Criteria:**

**Given** monetary inputs
**When** calculations are performed
**Then** internal money values use integer öre and never floating-point kronor
**And** formatting to Swedish kronor happens only at presentation/PDF boundaries.

**Given** fractional quantities and unit prices
**When** line totals are calculated
**Then** line net is rounded to nearest öre according to the conservative pilot policy
**And** totals preserve exact öre even if a UI/PDF later displays whole kronor.

**Given** invalid money input
**When** validation runs
**Then** negative or malformed values are rejected where not explicitly allowed by a story
**And** errors are user-safe and testable.

**Technical Notes:** Implement pure functions in `src/lib/money` or equivalent. No database schema beyond test fixtures unless implementation needs typed persistence in a later story.

**Test Requirements:** Unit tests for integer conversion, rounding, fractional quantity, large values, formatting boundaries, and regression examples from golden fixtures.

**Security/RLS Impact:** None directly; no tenant data required for pure unit tests.

**Money/Tax/Quote Impact:** High. Establishes base money behavior for calculations, quotes, acceptance, and golden masters.

**Migration/Coexistence Impact:** Golden fixture expected values must document old Lovable number-kronor differences where they exist.

**Dependencies:** Epic 1.

**Stop Conditions Requiring Human Approval:** Stop if accounting requires document-level rounding instead of line-level rounding or if negative/discount semantics require a new data model decision.

### Story 4.2: VAT And Quote Total Calculation Primitives

As a tenant admin,
I want VAT and quote totals to be calculated from explicit assumptions,
So that draft calculations and quote snapshots show explainable customer-facing totals.

**Acceptance Criteria:**

**Given** a line with net amount and VAT basis points
**When** VAT is calculated
**Then** VAT amount is rounded per line under the conservative pilot policy
**And** section/quote totals sum rounded line values.

**Given** VAT display modes
**When** totals are rendered for admin review
**Then** excl. VAT, incl. VAT, and both-display assumptions are represented without changing stored source totals.

**Given** VAT defaults from tenant settings
**When** calculation/quote code consumes them
**Then** the exact VAT rate and source assumption are snapshotted before becoming customer-visible.

**Technical Notes:** Keep VAT primitives pure and typed. Store VAT rates as basis points. Do not rely on hidden 25% constants.

**Test Requirements:** Unit tests for VAT rates, display modes, rounding, totals, zero rows, fractional quantities, and golden-master VAT cases.

**Security/RLS Impact:** None directly for pure primitives; tenant-owned setting access is tested in Epic 3/Epic 5.

**Money/Tax/Quote Impact:** High. VAT behavior must be covered by unit and golden-master tests before real pilot use.

**Migration/Coexistence Impact:** Compare Lovable hardcoded 25% behavior against new explicit VAT assumptions and document intentional deltas.

**Dependencies:** Stories 4.1 and 3.3.

**Stop Conditions Requiring Human Approval:** Stop if the pilot requires a different rounding policy, VAT display policy, or legally approved customer-facing VAT wording.

### Story 4.3: ROT And Grön Teknik Estimate Engine With Warnings

As a tenant admin,
I want ROT and grön teknik estimates to show assumptions and warnings,
So that tax-sensitive quotes are not sent as if unapproved rules were final.

**Acceptance Criteria:**

**Given** a calculation with tax deduction assumptions
**When** ROT or grön teknik estimates are calculated
**Then** the engine produces deduction amount, eligible basis, warnings, and assumption snapshot data
**And** ROT and grön teknik cannot be mixed unless a later approved rule explicitly supports it.

**Given** owner/accounting/legal sign-off is missing
**When** the admin reviews tax deduction output
**Then** the UI and snapshot data indicate assumptions require sign-off before real pilot use.

**Given** BRF/private/company-like fixture cases
**When** validation runs
**Then** warnings and blocking errors match the conservative Phase A policy
**And** personnummer is not captured by default.

**Technical Notes:** Treat Lovable tax functions as behavior-oracle candidates only. Use integer öre and explicit rates/caps profiles. Do not encode legal approval as implementation fact.

**Test Requirements:** Unit tests for no deduction, ROT, grön teknik categories, caps, schablon on/off if supported, invalid mixes, customer eligibility warnings, hidden row inclusion assumptions, and golden fixtures.

**Security/RLS Impact:** None directly for pure engine; tenant-owned assumptions are tested where persisted.

**Money/Tax/Quote Impact:** High and sign-off sensitive.

**Migration/Coexistence Impact:** Use anonymized Lovable examples for comparison and document deltas from legal/sign-off changes.

**Dependencies:** Stories 4.1, 4.2, and 3.3.

**Stop Conditions Requiring Human Approval:** Stop if legal constants, eligibility, BRF handling, schablon handling, disclaimer wording, or personnummer capture must be treated as production-approved.

### Story 4.4: Money And Tax Golden-Master Fixture Pack

As a pilot operator,
I want representative money and tax fixtures,
So that calculation and quote behavior can be compared against known old/new expectations.

**Acceptance Criteria:**

**Given** anonymized fixture data
**When** golden tests run
**Then** they cover regular VAT, ROT, grön teknik, caps, invalid mixes, options/tillval, hidden rows, fractional quantities, rounding, and accepted-price deltas
**And** expected values are stored as explicit old Lovable behavior, new expected behavior, or documented intentional delta.

**Given** fixture source material
**When** it is committed
**Then** it contains no real names, emails, phone numbers, addresses, personnummer, organization numbers, secrets, `.env` values, or raw customer files unless explicitly approved.

**Given** a future money/tax implementation changes behavior
**When** tests run
**Then** golden failures point to the affected assumption or expected delta.

**Technical Notes:** Store under `tests/fixtures/golden/lovable/**` and `tests/golden/**` or approved equivalents. Keep fixtures structured and reviewable.

**Test Requirements:** Golden tests plus fixture privacy/no-secret checks.

**Security/RLS Impact:** Fixture privacy is required; no live tenant data.

**Money/Tax/Quote Impact:** High. This story establishes the recurring test oracle for money/tax/quote stories.

**Migration/Coexistence Impact:** High. This is the first golden-master fixture foundation.

**Dependencies:** Stories 4.1 through 4.3.

**Stop Conditions Requiring Human Approval:** Stop if real customer data or unapproved legal/tax assumptions are needed to produce fixtures.

## Epic 5: Calculation Workspace And Quote Readiness

**Epic goal:** Let tenant admins build Phase A calculations that are tenant-owned, testable, and ready to become immutable quote snapshots.

**Scope:** Calculation headers, sections, rows, row types, pricing source selection, options/tillval, visibility modes, totals, margin/tax warnings, readiness review, and calculation editor UX.

**Explicit non-scope:** Full project planning, field-worker scheduling, time/material reporting, ÄTA/deviation workflows, supplier APIs/imports, AI estimation, and broad analytics.

**Dependencies:** Epics 1-4. Calculation attachments depend on Epic 8 for full file behavior.

**Risks:** Letting editable calculations become the source of truth for sent quotes, under-testing hidden row/tillval behavior, and making tax warnings look legally final.

### Story 5.1: Tenant-Owned Calculation Schema And Server Commands

As a tenant admin,
I want to create and edit calculations linked to CRM context,
So that I can estimate work before creating a quote version.

**Acceptance Criteria:**

**Given** calculation migrations
**When** the database is reset from empty
**Then** `calculations`, `calculation_sections`, and `calculation_rows` are created with tenant ownership, parent tenant consistency, lifecycle/status fields, ordering, and integer öre money fields
**And** no deferred job/project/field-worker tables are created.

**Given** a tenant admin
**When** the admin creates or edits a calculation, section, or row
**Then** server commands validate tenant membership, CRM parent ownership, row type, quantity/unit, money values, VAT assumptions, and lifecycle state.

**Given** tenant A and tenant B fixtures
**When** tenant A attempts to read/write tenant B calculations or link tenant B customer/facility/contact IDs
**Then** RLS and command validation reject the attempt.

**Technical Notes:** Use archive/soft delete where needed. Keep calculations editable until quote lifecycle rules constrain downstream snapshots. For multi-record section/row saves or reorders that must be atomic, use a narrow Postgres RPC or an approved direct server DB transaction adapter; do not implement client-side multi-step persistence as the consistency boundary.

**Test Requirements:** Migration reset, command integration tests, RLS negative tests for all calculation tables, and unit tests for row validation.

**Security/RLS Impact:** High. All calculation records are tenant-owned.

**Money/Tax/Quote Impact:** High. Calculation rows use integer öre and feed quote snapshots.

**Migration/Coexistence Impact:** Schema should support anonymized Lovable calculation fixtures without importing deferred fields.

**Dependencies:** Epics 2-4 and Story 3.1.

**Stop Conditions Requiring Human Approval:** Stop if calculation scope expands into field work, supplier imports, AI estimation, or unapproved deferred tables.

### Story 5.2: Calculation Editor UX For Sections And Rows

As a tenant admin,
I want a focused calculation editor with sections, rows, totals, and warnings,
So that I can prepare a quote-ready estimate efficiently.

**Acceptance Criteria:**

**Given** a calculation
**When** the admin opens the editor
**Then** the screen shows record header, customer context, status, section/row workspace, and a totals/readiness summary on desktop
**And** the layout stacks safely on narrower screens without overlapping controls.

**Given** section and row editing
**When** the admin creates, renames, reorders, duplicates where supported, or deletes sections/rows
**Then** destructive actions require confirmation when rows would be removed
**And** validation errors preserve unsaved input.

**Given** row fields
**When** the admin edits labor, material, subcontractor, machinery, or other rows
**Then** quantity, unit, unit cost/sell price, markup/margin, VAT, total, quote-visible label/description, internal note, and quote-visible note are available as approved.

**Technical Notes:** Keep implementation work-focused. Use Swedish labels where useful, but do not expose internal jargon such as integer öre except in review summaries where needed.

**Test Requirements:** UI tests for keyboard editing, validation states, responsive layout, section/row ordering, totals refresh, and absence of deferred workflow labels.

**Security/RLS Impact:** UI must call tenant-scoped server commands; include route authorization and command-level negative tests from Story 5.1.

**Money/Tax/Quote Impact:** High. Totals shown in UI must use Epic 4 primitives.

**Migration/Coexistence Impact:** Editor should be able to display fixture-backed calculations for comparison later.

**Dependencies:** Stories 5.1 and Epic 4.

**Stop Conditions Requiring Human Approval:** Stop if editor scope requires field-worker UX, project analytics, or owner decisions that materially change row/section data model.

### Story 5.3: Pricing Source Selection And Row Snapshots

As a tenant admin,
I want calculation rows to use work-role or optional article pricing while preserving the chosen source,
So that later quote snapshots can explain where prices came from.

**Acceptance Criteria:**

**Given** a labor row
**When** the admin selects a work role
**Then** role ID, role name, cost/sell rate in öre, source timestamp/version, and tenant ownership are stored on the row snapshot fields.

**Given** articles are enabled for Phase A
**When** the admin selects a manual article/material source
**Then** article ID, number/name/unit, price in öre, source timestamp/version, and tenant ownership are stored
**And** no supplier IDs, import metadata, API behavior, credentials, or external mappings are introduced.

**Given** a source is archived or changed later
**When** an existing row is viewed
**Then** the row remains explainable from its preserved source snapshot.

**Technical Notes:** Use the snapshot contract from Story 3.5. Manual/free-text rows remain supported.

**Test Requirements:** Integration tests for source selection, archived/inactive source behavior, cross-tenant source spoof rejection, and golden examples for source snapshots.

**Security/RLS Impact:** High. Source IDs must be tenant-owned and validated.

**Money/Tax/Quote Impact:** High. Pricing source snapshots become quote snapshot inputs.

**Migration/Coexistence Impact:** Supports Lovable work-role/article comparison fixtures where anonymized.

**Dependencies:** Stories 3.4, 3.5, and 5.1.

**Stop Conditions Requiring Human Approval:** Stop if reusable articles are not approved/needed or if supplier automation appears in requirements.

### Story 5.4: Calculation Readiness Review And Snapshot Preview

As a tenant admin,
I want calculation readiness warnings and a snapshot preview before creating a quote,
So that I can catch unsafe customer commitments before they are versioned.

**Acceptance Criteria:**

**Given** a calculation with missing or risky data
**When** readiness checks run
**Then** blocking issues are separated from warnings
**And** warnings cover low margin, missing customer/facility/contact where relevant, empty sections, zero-price rows, missing work role on labor rows, unresolved VAT/tax assumptions, ROT/grön teknik sign-off, hidden rows included in totals, and missing required files.

**Given** the admin chooses to create a quote version
**When** the pre-quote review opens
**Then** it shows customer/facility/contact, sections, visible/hidden handling, options/tillval, totals, VAT, tax assumptions, terms, selected attachments, and warnings captured at snapshot time.

**Given** a sent quote already exists
**When** calculation changes affect customer-visible content
**Then** the UI explains that a new quote version is required rather than mutating the sent version.

**Technical Notes:** This story prepares quote snapshot inputs but does not create quote versions; that command belongs to Epic 6.

**Test Requirements:** Unit tests for readiness rule classification, UI tests for warnings/blockers, and golden tests for hidden row/tillval assumptions.

**Security/RLS Impact:** Uses tenant-owned calculation/CRM/settings data; include command/query RLS negative tests where new reads are added.

**Money/Tax/Quote Impact:** High. Readiness relies on Epic 4 money/tax primitives and feeds quote snapshot creation.

**Migration/Coexistence Impact:** Warning output should support old/new delta documentation for Lovable fixtures.

**Dependencies:** Stories 5.1 through 5.3 and Epic 4.

**Stop Conditions Requiring Human Approval:** Stop if hidden-row/tillval/required-file rules materially change quote totals or acceptance semantics without owner decision.

### Story 5.5: Calculation Golden Tests For Options, Hidden Rows, And Tax Warnings

As a pilot operator,
I want calculation golden tests for representative edge cases,
So that changes to totals, visibility, and warning behavior are caught before pilot use.

**Acceptance Criteria:**

**Given** calculation fixture cases
**When** golden tests run
**Then** they cover labor, material, subcontractor, machinery, other rows, fractional quantities, margins, options/tillval, hidden rows, detailed/summary/text-only section modes, VAT display, ROT/grön teknik warnings, and attachment readiness flags.

**Given** an intentional old/new delta
**When** the fixture is compared
**Then** the delta is documented as expected simplification, bug fix, or unresolved assumption.

**Given** fixture data is committed
**When** privacy checks run
**Then** no real customer personal data, secrets, or raw customer files are present.

**Technical Notes:** Build on Epic 4 fixture structure. Do not depend on final PDF rendering.

**Test Requirements:** Golden comparison tests, unit tests for visibility/option calculations, and fixture privacy checks.

**Security/RLS Impact:** Fixture privacy only; no live tenant data.

**Money/Tax/Quote Impact:** High. Required for money/tax/calculation correctness.

**Migration/Coexistence Impact:** High. This supplies shadow comparison inputs.

**Dependencies:** Stories 4.4 and 5.1 through 5.4.

**Stop Conditions Requiring Human Approval:** Stop if real Lovable customer data is required or if owner decisions on hidden rows/options block expected values.

## Epic 6: Quote Versions, PDF, And Lifecycle

**Epic goal:** Let tenant admins create, review, send, and preserve immutable quote versions and PDFs generated from snapshots.

**Scope:** Quotes, quote versions, tenant-scoped quote numbers, version snapshots, PDF generation from snapshots, sent immutability, lifecycle events, version timeline, new versions after customer-visible changes, and quote-related audit.

**Explicit non-scope:** Email sending, public/customer portal acceptance, Fortnox/invoicing, customer-facing web acceptance, broad document center, final high-fidelity PDF design, and accepted-to-job transaction.

**Dependencies:** Epics 1-5. Minimal quote-PDF private storage is included in this epic where PDF generation first needs it; broader upload/evidence/entity file management remains Epic 8.

**Risks:** Race-prone quote numbering, PDF rendering from mutable data, mutable sent quote versions, unclear sent event semantics, and unapproved tax/terms wording.

### Story 6.1: Quote Snapshot Schema And Server-Side Version Creation

As a tenant admin,
I want to create a draft quote version from a calculation snapshot,
So that customer-visible quote content is preserved independently from mutable calculation/settings data.

**Acceptance Criteria:**

**Given** quote migrations
**When** the database resets from empty
**Then** `quotes`, `quote_versions`, `quote_version_lines`, `quote_version_attachments`, and `quote_events` are created with tenant ownership, parent consistency, lifecycle state, and immutable snapshot fields
**And** no Fortnox, invoice, customer portal, or external mapping tables are created.

**Given** a quote version is created from a calculation
**When** `createQuoteVersionFromCalculation` runs
**Then** it snapshots customer/facility/contact display data, company identity, terms, line/section display model, totals, VAT/tax assumptions, selected attachment metadata, warnings, and source calculation references.

**Given** quote numbering is needed
**When** the draft version is created
**Then** tenant-scoped quote number allocation is server-side and race-safe.

**Technical Notes:** Transaction mechanism: use a narrow Postgres RPC for quote number allocation plus quote/version/line/event insertion, invoked only by an authenticated server command that verifies tenant membership and input ownership. RPC should be security invoker unless a separately approved security-definer design is required.

**Test Requirements:** Integration tests for snapshot creation, quote number race/idempotency behavior as applicable, RLS negative tests for all quote tables, and golden tests for snapshot content.

**Security/RLS Impact:** High. Quote tables are tenant-owned and must reject cross-tenant source IDs.

**Money/Tax/Quote Impact:** High. Quote snapshot is the customer commitment source.

**Migration/Coexistence Impact:** Supports Lovable quote snapshot comparisons.

**Dependencies:** Epics 2-5 and Story 8.1 if attachment metadata is persisted.

**Stop Conditions Requiring Human Approval:** Stop if quote number display format becomes a data model blocker or if transaction mechanism changes without ADR approval.

### Story 6.2: Draft Quote Version Review And Timeline UX

As a tenant admin,
I want to review draft and historical quote versions in a timeline,
So that I can understand the current customer commitment and prior versions.

**Acceptance Criteria:**

**Given** a quote detail screen
**When** the admin opens it
**Then** it shows lifecycle header, customer, latest version, source calculation, version timeline, PDF status, acceptance state, files, and events.

**Given** a draft quote version
**When** the admin edits customer-visible draft content before send
**Then** allowed edits update only the draft version
**And** warnings make clear that sent versions become immutable.

**Given** a sent or accepted version
**When** the admin selects it
**Then** customer-visible fields are read-only and the UI directs changes to a new version path.

**Technical Notes:** Separate internal notes from customer-visible snapshot content. Use status badges with text, not color alone.

**Test Requirements:** UI tests for timeline states, keyboard navigation, draft edit validation, immutable view state, and no customer portal/public acceptance routes.

**Security/RLS Impact:** Quote screens read tenant-owned data; include route authorization and RLS negative coverage.

**Money/Tax/Quote Impact:** High. UI must display snapshot values, not mutable recalculations.

**Migration/Coexistence Impact:** Version timeline should support old/new lifecycle comparison fixtures.

**Dependencies:** Story 6.1.

**Stop Conditions Requiring Human Approval:** Stop if draft edit scope would let customer-visible sent content be mutated or if email/customer portal behavior is requested.

### Story 6.3: Quote PDF Generation From Snapshot

As a tenant admin,
I want to generate and preview a quote PDF from the selected quote version snapshot,
So that the customer-facing document matches the immutable version data.

**Acceptance Criteria:**

**Given** a quote version
**When** PDF generation runs
**Then** it reads only quote version, quote line, quote attachment snapshot, and file metadata snapshot data
**And** it does not read mutable customer, settings, terms, calculation rows, work roles, or articles as source of truth.

**Given** PDF generation states
**When** the admin views the quote
**Then** not generated, generating, generated, failed, retry, and preview/download states are visible and accessible.

**Given** a generated PDF
**When** it is stored
**Then** it is stored as a private file tied to the quote version with file metadata, event, and audit record.

**Technical Notes:** The exact PDF renderer must be selected and pinned in this story implementation. This story introduces only the minimal private file metadata/storage behavior needed for generated quote PDFs if the generic file model does not exist yet; Epic 8 must reuse and expand that model rather than duplicate it. Retry may regenerate the file from the same immutable snapshot without changing customer-visible data.

**Test Requirements:** Unit tests for `QuotePdfViewModel`, integration tests for PDF metadata/event/audit writes, golden text extraction and stable visual snapshot for representative quotes, accessibility fallback test for preview/download controls.

**Security/RLS Impact:** High. PDF file access is tenant-owned and private; include RLS/storage negative tests.

**Money/Tax/Quote Impact:** High. PDF must match quote snapshot totals, VAT/tax blocks, terms, attachments, and warnings where customer-visible.

**Migration/Coexistence Impact:** Supports Lovable PDF text/visual golden comparison.

**Dependencies:** Stories 6.1 and 6.2.

**Stop Conditions Requiring Human Approval:** Stop if renderer choice adds a major dependency without approval or if final customer-facing tax/legal wording lacks sign-off for real pilot use.

### Story 6.4: Mark Quote Version Sent And Enforce Immutability

As a tenant admin,
I want to mark a quote version as sent and lock it,
So that customer commitments cannot be overwritten by accident.

**Acceptance Criteria:**

**Given** a draft quote version that passes blocking readiness checks
**When** the admin confirms `mark sent`
**Then** the system records sent timestamp/channel/reference if supported, quote event, audit event, and immutable lifecycle state
**And** customer-visible fields, selected attachments, and PDF source data cannot be updated through normal app paths.

**Given** a sent version
**When** a user or command attempts to mutate customer-visible content
**Then** command validation and database constraints/triggers reject the change
**And** the UI explains the lifecycle rule and offers create new version.

**Given** tenant A and tenant B quote versions
**When** cross-tenant send/mutation attempts occur
**Then** RLS and command validation reject them.

**Technical Notes:** Transaction mechanism: use a narrow Postgres RPC or explicit approved transaction adapter for lock/event/audit updates. Locking must be enforced below the UI layer.

**Test Requirements:** Integration tests for sent transition, immutability rejection, RLS negative tests, audit/event tests, and golden lifecycle fixture tests.

**Security/RLS Impact:** High. Tenant-scoped lifecycle command.

**Money/Tax/Quote Impact:** High. Sent snapshot becomes immutable customer commitment.

**Migration/Coexistence Impact:** Compare against Lovable mutable quote-version behavior and document intentional delta.

**Dependencies:** Stories 6.1 through 6.3.

**Stop Conditions Requiring Human Approval:** Stop if the exact sent event/channel semantics materially affect data model or if locking cannot be enforced outside UI.

### Story 6.5: New Quote Version After Customer-Visible Changes

As a tenant admin,
I want to create a new quote version when a sent quote needs customer-visible changes,
So that previous sent commitments stay available for audit and comparison.

**Acceptance Criteria:**

**Given** a sent quote version
**When** customer-visible lines, sections, price, discount, VAT, ROT/grön teknik, terms, validity, intro text, facility/customer display, attachment selection, or quote-visible notes must change
**Then** the system creates a new draft version instead of editing the sent version.

**Given** multiple versions exist
**When** the admin views the quote timeline
**Then** prior sent versions remain available with their snapshot, PDF metadata, events, and status
**And** the latest draft/sent/accepted state is clear.

**Given** a rejected, expired, or superseded state is used in Phase A
**When** the lifecycle changes
**Then** the event is tenant-scoped, audited, and does not mutate prior sent content.

**Technical Notes:** New version creation must reuse the same narrow Postgres RPC or approved direct server DB transaction adapter pattern as Story 6.1 with an explicit parent quote/version relationship and event.

**Test Requirements:** Integration tests for new version creation, prior version immutability, lifecycle events, RLS negatives, and golden tests for v1/v2 comparison.

**Security/RLS Impact:** High. Version creation and lifecycle events are tenant-owned.

**Money/Tax/Quote Impact:** High. New customer-visible commitments require new snapshots.

**Migration/Coexistence Impact:** Supports Lovable version behavior comparison and documents safer Phase A differences.

**Dependencies:** Stories 6.1 through 6.4.

**Stop Conditions Requiring Human Approval:** Stop if versioning rules conflict with owner-approved quote correction policy or accepted-price semantics.

## Epic 7: Acceptance-To-Job Transaction

**Epic goal:** Record quote acceptance and create the basic job/order from the accepted quote in one safe, idempotent, audited workflow.

**Scope:** Acceptance capture, immutable acceptance records, adjusted accepted price handling, narrow transactional acceptance-to-job command, minimal job/order record, job source references, duplicate prevention, and acceptance/job lifecycle tests.

**Explicit non-scope:** Customer portal/public acceptance, field-worker workflow, schedule depth, time/material/deviation reporting, invoice/Fortnox workflows, full project analytics, and normal post-acceptance correction editing.

**Dependencies:** Epics 1-6. Acceptance can record an external evidence reference in this epic; file-upload evidence integration is completed by Epic 8.

**Risks:** Partial acceptance/job state, duplicate jobs on retry, mutable acceptance evidence, adjusted price ambiguity, and unapproved correction policy.

### Story 7.1: Acceptance Evidence Capture For Sent Quote Versions

As a tenant admin,
I want to record off-system acceptance for a specific sent quote version,
So that customer commitment evidence is preserved before a job/order is created.

**Acceptance Criteria:**

**Given** a sent quote version
**When** the admin opens acceptance capture
**Then** the form captures channel, accepted timestamp, admin user, evidence file/reference, accepted price in öre, notes, and planned start/end dates when available
**And** no customer portal or public acceptance endpoint is created.

**Given** accepted price differs from the sent quote total
**When** the admin attempts to confirm acceptance
**Then** explicit adjustment reason/evidence is required
**And** the delta is shown before confirmation.

**Given** a draft, rejected, expired, or cross-tenant quote version
**When** acceptance is attempted
**Then** command validation rejects it with a user-safe error.

**Technical Notes:** Acceptance can record an external evidence reference without waiting for file upload support. File-based evidence is integrated by Epic 8. Until correction policy is approved, accepted records are locked and corrections require a future audited workflow.

**Test Requirements:** UI/form validation tests, command integration tests for valid/invalid lifecycle states, adjusted price tests, and RLS negative tests.

**Security/RLS Impact:** High. Acceptance is tenant-owned and tied to quote version ownership.

**Money/Tax/Quote Impact:** High. Accepted price and source sent total must be stored in öre and covered by unit/golden tests.

**Migration/Coexistence Impact:** Acceptance fields should support Lovable transition fixtures without copying client-side mutation code.

**Dependencies:** Epic 6.

**Stop Conditions Requiring Human Approval:** Stop if accepted price adjustment policy, accepted evidence channels, or correction semantics materially differ from conservative assumptions.

### Story 7.2: Idempotent Accept Quote And Create Job Command

As a tenant admin,
I want acceptance and job/order creation to happen together safely,
So that the system never leaves a half-accepted quote or duplicate job.

**Acceptance Criteria:**

**Given** a valid sent quote version and acceptance input
**When** `acceptQuoteAndCreateJob` runs
**Then** it records acceptance, updates quote/version lifecycle, creates a minimal job/order, writes quote/job/audit events, and commits all changes together.

**Given** the same acceptance request is retried
**When** an acceptance/job already exists for the quote version
**Then** the command returns the existing acceptance and job/order idempotently
**And** it does not create duplicates.

**Given** any transaction step fails
**When** the command returns an error
**Then** no partial acceptance, lifecycle update, job/order, or event remains committed.

**Technical Notes:** Transaction mechanism: implement a narrow Postgres RPC `accept_quote_and_create_job` or equivalent approved name, invoked only from an authenticated server command after membership/input pre-validation. The RPC must lock the quote version and parent quote row, verify sent state and tenant ownership, insert acceptance/job/events/audit in one transaction, and rely on uniqueness constraints for one acceptance per quote version and one job per acceptance. Prefer security invoker; any security-definer variant requires fixed `search_path`, explicit membership checks, and separate approval.

**Test Requirements:** Integration tests for success, retry idempotency, duplicate prevention, rollback on injected failure, cross-tenant rejection, anonymous rejection, adjusted price reason requirement, and audit/event writes.

**Security/RLS Impact:** Critical. Tenant scoping and command validation are mandatory; no client-side multi-step mutation sequence.

**Money/Tax/Quote Impact:** Critical. Accepted price, source quote total, accepted version ID, and evidence reference are immutable commitment data.

**Migration/Coexistence Impact:** Golden fixtures must compare Lovable accepted-quote-to-job behavior and document safer transactional delta.

**Dependencies:** Story 7.1 and Epic 6.

**Stop Conditions Requiring Human Approval:** Stop if the transaction mechanism changes, if acceptance/job lifecycle policy is unresolved, or if public/customer acceptance is requested.

### Story 7.3: Minimal Job/Order Record And Tenant-Admin UX

As a tenant admin,
I want to view the basic job/order created from an accepted quote,
So that accepted work is traceable without entering field-worker scope.

**Acceptance Criteria:**

**Given** an accepted quote has created a job/order
**When** the admin views the job/order detail
**Then** it shows source quote version, acceptance evidence, accepted price, customer/facility/contact, basic title/status, planned dates, files, and event history
**And** source quote/acceptance references cannot be edited.

**Given** the job/order list
**When** the admin filters or searches
**Then** results can be filtered by customer, status, planned date, and source quote
**And** no field-worker schedule, time/material, deviation, ÄTA, project analytics, invoice, or Fortnox UI is shown.

**Given** tenant A and tenant B jobs
**When** tenant A attempts to read/update tenant B job/order records
**Then** RLS and command validation reject access.

**Technical Notes:** Use the working label `Jobb/Order` until owner chooses final terminology. Allow only Phase A-safe edits, such as title/status/planned dates, if approved by this story.

**Test Requirements:** UI tests for source traceability and no deferred labels; integration/RLS tests for job reads/updates; audit tests for any allowed job metadata changes.

**Security/RLS Impact:** High. Jobs are tenant-owned and source-linked to accepted quote/acceptance.

**Money/Tax/Quote Impact:** High. Accepted value and source totals are displayed from immutable snapshot references.

**Migration/Coexistence Impact:** Supports accepted quote -> job golden fixtures and old/new transition comparison.

**Dependencies:** Story 7.2.

**Stop Conditions Requiring Human Approval:** Stop if job/order terminology or allowed edit scope materially changes data model, or if field-worker/project management scope is requested.

### Story 7.4: Accepted State Immutability And Correction Boundary

As a tenant admin,
I want accepted quote and job source data to be locked,
So that mistakes require an explicit audited correction path instead of silent edits.

**Acceptance Criteria:**

**Given** a quote version has been accepted
**When** a user attempts to edit accepted version reference, acceptance evidence, accepted price, accepted timestamp, channel, source quote total, or job source reference
**Then** command validation and database constraints/triggers reject the mutation
**And** UI explains that corrections require approved audited workflow.

**Given** a legitimate correction need arises
**When** the user attempts normal edit paths
**Then** no normal edit path changes immutable accepted data
**And** the event is not hidden or silently overwritten.

**Given** tests run
**When** accepted records are attacked through tenant A/B or direct command attempts
**Then** cross-tenant access and immutable-field updates fail.

**Technical Notes:** This story enforces the boundary. It does not implement a broad correction workflow until owner policy is approved.

**Test Requirements:** Integration tests for immutable fields, RLS negatives, command validation, audit/error behavior, and regression tests against accidental update paths.

**Security/RLS Impact:** High. Accepted records are tenant-owned and lifecycle-locked.

**Money/Tax/Quote Impact:** Critical. Accepted financial/evidence data must not mutate silently.

**Migration/Coexistence Impact:** Documents delta from Lovable mutable acceptance evidence if present.

**Dependencies:** Stories 7.1 through 7.3.

**Stop Conditions Requiring Human Approval:** Stop if implementing correction workflow becomes required; that needs explicit owner-approved policy/story.

## Epic 8: Required Files And Private Storage

**Epic goal:** Manage only Phase A-required files through private, tenant-owned, validated, lifecycle-aware storage.

**Scope:** Private storage buckets, `files`, `file_links`, entity-scoped file panels, validated upload, signed access, quote PDF/attachment/evidence locks, archive/delete audit, and cross-tenant storage negative tests.

**Explicit non-scope:** Broad document center, deferred module file indexing, public buckets, client-entered storage paths, virus scanning unless separately approved, and external document integrations.

**Dependencies:** Epics 1-3. Integrates with Epics 5-7 as those workflows need attachments, PDFs, and evidence.

**Risks:** Storage path spoofing, public file exposure, MIME/size bypass, locked evidence replacement, and broad file-index scope creep.

### Story 8.1: Private Storage Metadata, Links, And RLS

As a tenant admin,
I want files represented by tenant-owned metadata and entity links,
So that documents can be managed safely in CRM, calculation, quote, acceptance, and job contexts.

**Acceptance Criteria:**

**Given** file migrations
**When** the database resets from empty
**Then** `files` and `file_links` are created or extended with tenant ownership, storage bucket/path metadata, display name, MIME type, size, uploader, lifecycle state, timestamps, owner type/id, purpose, and lock fields
**And** no broad deferred-module file index is created.

**Given** tenant A and tenant B files
**When** tenant A attempts to read, link, update, archive, or delete tenant B file metadata or links
**Then** RLS and command validation reject access.

**Given** a file link targets an owner entity
**When** the link is created
**Then** the command verifies tenant ownership of both file and owner record.

**Technical Notes:** Owner types are limited to Phase A entities: customer, facility, contact, calculation, quote_version, quote_acceptance, and job. If Story 6.3 already introduced minimal quote-PDF file metadata, this story must reuse and extend it rather than create a competing model. For metadata plus link creation that must be atomic, use a narrow Postgres RPC or approved direct server DB transaction adapter.

**Test Requirements:** Migration reset, RLS negative tests for `files` and `file_links`, owner spoof tests, lifecycle state validation tests.

**Security/RLS Impact:** Critical. Files are tenant-owned and private by default.

**Money/Tax/Quote Impact:** Supports quote PDFs, selected attachments, and acceptance evidence.

**Migration/Coexistence Impact:** Supports anonymized file metadata fixtures without raw customer files unless approved.

**Dependencies:** Epic 2 and relevant owner tables from Epics 3, 5, 6, or 7.

**Stop Conditions Requiring Human Approval:** Stop if broad document-center indexing or deferred module owner types are requested.

### Story 8.2: Validated Upload And Entity File Panels

As a tenant admin,
I want to upload files in the context where they are needed,
So that each file has a clear owner, purpose, and validation state.

**Acceptance Criteria:**

**Given** an entity file panel
**When** the admin uploads a file
**Then** the UI shows allowed file types, size expectations, owner/entity, and purpose
**And** the user never enters or controls raw storage paths.

**Given** an upload request
**When** the server receives it
**Then** MIME type, size, tenant ownership, owning entity, purpose, and lifecycle state are validated before the file becomes usable.

**Given** invalid upload cases
**When** file type is blocked, size is too large, network/server failure occurs, or permission fails
**Then** the UI shows distinct user-safe error states
**And** cross-tenant failures do not reveal whether another tenant's file exists.

**Technical Notes:** Storage paths are server-derived. Initial allowed file types/size limits require owner approval before real pilot use but can use conservative defaults for development. For upload flows that span object storage and database metadata, define compensating cleanup/archive behavior for storage-success/database-failure cases; DB metadata/link writes that must be atomic use a narrow Postgres RPC or approved direct server DB transaction adapter.

**Test Requirements:** Upload integration tests, MIME/size validation tests, owner spoof tests, UI error-state tests, and RLS/storage negative tests.

**Security/RLS Impact:** Critical. Prevents path spoofing and cross-tenant file ownership.

**Money/Tax/Quote Impact:** Relevant where files become quote attachments or acceptance evidence.

**Migration/Coexistence Impact:** Supports fixture metadata for required files; raw customer files remain excluded unless approved.

**Dependencies:** Story 8.1 and owner entity stories.

**Stop Conditions Requiring Human Approval:** Stop if final file type/size policy, required-file rules, or raw legacy file migration materially affects pilot data.

### Story 8.3: Tenant-Authorized Signed File Access

As a tenant admin,
I want to preview and download private files through short-lived links,
So that files remain private while still usable in the pilot workflow.

**Acceptance Criteria:**

**Given** a tenant-owned file
**When** the admin requests preview/download
**Then** the server verifies tenant membership, file metadata ownership, lifecycle state, and purpose before creating a short-lived signed URL.

**Given** an expired signed URL
**When** the admin retries through normal UI
**Then** a fresh authorization check is performed and a new signed URL is issued if allowed.

**Given** tenant A attempts to sign, list, read, or spoof a tenant B storage path
**When** storage negative tests run
**Then** access is denied with generic user-safe errors.

**Technical Notes:** File access always resolves metadata first, storage second. Do not expose raw bucket/path details unnecessarily in UI.

**Test Requirements:** Signed URL integration tests, expiry/refresh tests, storage path spoof tests, cross-tenant read/list/sign negatives, anonymous access tests.

**Security/RLS Impact:** Critical. This is the main private-file access boundary.

**Money/Tax/Quote Impact:** Supports private quote PDFs, attachments, and acceptance evidence.

**Migration/Coexistence Impact:** Enables pilot fixture validation for signed URL behavior without real files.

**Dependencies:** Stories 8.1 and 8.2.

**Stop Conditions Requiring Human Approval:** Stop if public buckets or unauthenticated file access are proposed.

### Story 8.4: Quote, PDF, Attachment, And Acceptance Evidence Locks

As a tenant admin,
I want quote and acceptance files locked when lifecycle rules require it,
So that sent and accepted commitments cannot be silently changed.

**Acceptance Criteria:**

**Given** a quote version is sent
**When** selected quote attachments and generated PDF metadata are linked
**Then** those file links are locked or snapshotted according to lifecycle rules
**And** replacing or deleting them through normal paths is blocked.

**Given** acceptance evidence is recorded
**When** acceptance is committed
**Then** evidence file/reference becomes immutable except through an approved audited correction workflow.

**Given** a locked file is archived
**When** deletion is requested
**Then** deletion is blocked or converted to archive-only according to lifecycle rules
**And** an audit event records who, what, when, why, and target record.

**Technical Notes:** Locking must be enforced by command validation and database constraints/triggers where appropriate, not only disabled buttons.

**Test Requirements:** Integration tests for lock behavior, archive/delete restrictions, cross-tenant locked-file attacks, and quote/acceptance lifecycle golden tests.

**Security/RLS Impact:** Critical. Tenant-owned files and lifecycle locks.

**Money/Tax/Quote Impact:** High. Quote PDFs/attachments/evidence are part of customer commitment snapshots.

**Migration/Coexistence Impact:** Compare Lovable attachment locking behavior and document safer Phase A delta.

**Dependencies:** Stories 8.1 through 8.3 plus Epics 6-7.

**Stop Conditions Requiring Human Approval:** Stop if retention/deletion policy for locked customer evidence requires legal decision beyond archive-only.

### Story 8.5: Limited File Index And File Audit Within Phase A Scope

As a tenant admin,
I want a limited way to find Phase A files and see file history,
So that required documents are manageable without creating a broad document center.

**Acceptance Criteria:**

**Given** a file index is approved for Phase A
**When** the admin opens `Filer`
**Then** it lists only CRM, calculation, quote, acceptance, and job/order files
**And** no deferred module groupings, broad document-center workflows, or cross-module analytics are shown.

**Given** a file event occurs
**When** upload, link, signed access creation, archive/delete, or lifecycle lock happens
**Then** a tenant-scoped audit event is written with safe metadata.

**Given** file search/filter is used
**When** tenant A searches
**Then** only tenant A file metadata appears
**And** RLS negative tests prove tenant B file metadata is not visible.

**Technical Notes:** Entity panels remain primary. The file index can be skipped if entity-scoped panels satisfy pilot needs.

**Test Requirements:** UI tests for limited scope, RLS negative tests, audit event tests, and no deferred file category labels.

**Security/RLS Impact:** High. File metadata is tenant-owned and audit logged.

**Money/Tax/Quote Impact:** Supports findability for quote PDFs and evidence without changing snapshots.

**Migration/Coexistence Impact:** Helps classify file metadata for migration/coexistence if approved.

**Dependencies:** Stories 8.1 through 8.4.

**Stop Conditions Requiring Human Approval:** Stop if this becomes a broad document center or indexes deferred module files.

## Epic 9: Migration, Coexistence, Golden Masters, And Pilot Readiness

**Epic goal:** Prepare the internal pilot to use the new system safely alongside the Lovable oracle and fallback.

**Scope:** Legacy record classification, anonymized fixture capture, golden-master comparison harness, old/new delta documentation, fallback/cutover runbook, pilot acceptance gates, and sign-off register.

**Explicit non-scope:** Full historical migration, automated production sync from Lovable, copying Lovable code, deferred module migration, Fortnox/supplier/AI/HR/rentals/assets/DoU/tender data activation, and external beta operations.

**Dependencies:** Epics 1-8 for full workflow comparison. Some docs/fixture work can start earlier.

**Risks:** Importing real personal data, over-migrating history, treating Lovable schema as the new blueprint, and cutting over without owner/accounting/legal sign-off.

### Story 9.1: Legacy Record Classification And Migration Runbook

As a pilot operator,
I want to classify Lovable records by Phase A treatment,
So that the pilot migrates only what is needed and keeps old-app fallback explicit.

**Acceptance Criteria:**

**Given** legacy Lovable records
**When** classification is performed
**Then** each selected record group is classified as live for pilot, archive-only, excluded, or deferred
**And** deferred module records do not become Phase A production tables or UI.

**Given** the migration runbook
**When** a pilot workflow is prepared
**Then** it documents source records, target treatment, fallback path, manual backfill risks, and cutover-by-workflow decision.

**Given** the runbook is reviewed
**When** scope is unclear
**Then** it stops for owner clarification rather than silently importing extra history.

**Technical Notes:** Keep this primarily in `docs/migration/**` until approved migration scripts are needed. Do not run production data mutations in this story.

**Test Requirements:** Docs review, classification checklist validation, and deferred-scope review.

**Security/RLS Impact:** Avoids exposing real customer data in docs/prompts/logs.

**Money/Tax/Quote Impact:** Identifies which quote/calculation examples need golden coverage.

**Migration/Coexistence Impact:** High. This is the migration/coexistence control point.

**Dependencies:** Epic 1 and domain docs.

**Stop Conditions Requiring Human Approval:** Stop if full historical migration, real customer data export, or deferred module activation is requested.

### Story 9.2: Anonymized Lovable Fixture Capture

As a pilot operator,
I want anonymized Lovable oracle fixtures,
So that new behavior can be tested against representative legacy examples without leaking customer data.

**Acceptance Criteria:**

**Given** selected Lovable examples
**When** fixtures are captured
**Then** they preserve business shape for CRM, settings/pricing, calculations, quotes, PDFs, acceptance, files, and accepted-quote-to-job behavior
**And** real names, emails, phone numbers, addresses, personnummer, organization numbers, secrets, and raw customer files are removed or replaced unless explicitly approved.

**Given** fixture capture scripts are introduced
**When** they run
**Then** they are local/test-oriented, documented, repeatable, and do not require global system changes.

**Given** fixtures are committed
**When** privacy checks run
**Then** they fail on obvious real PII/secrets patterns.

**Technical Notes:** Store fixtures under `tests/fixtures/golden/lovable/**` or approved equivalent. Lovable code is not copied by default.

**Test Requirements:** Fixture privacy checks, fixture schema validation, and lightweight golden-loader tests.

**Security/RLS Impact:** High privacy concern; no secrets or real customer data.

**Money/Tax/Quote Impact:** Captures calculation, quote, tax, PDF, acceptance, and job examples for golden tests.

**Migration/Coexistence Impact:** High.

**Dependencies:** Stories 4.4 and 5.5 for money/calculation fixture shape; relevant workflow stories as fixtures expand.

**Stop Conditions Requiring Human Approval:** Stop if anonymization cannot preserve required behavior or if raw customer files/PII are requested.

### Story 9.3: Golden-Master Comparison Harness For Core Workflow

As a pilot operator,
I want automated old/new comparisons for the core pilot workflow,
So that the team can approve selected workflows based on evidence instead of memory.

**Acceptance Criteria:**

**Given** anonymized fixtures
**When** golden-master comparisons run
**Then** they compare calculation totals, VAT/tax blocks, option/tillval behavior, hidden row behavior, quote-visible lines, PDF text/visual output, attachment selection, acceptance transition, accepted price, and job source references.

**Given** a comparison difference
**When** the report is generated
**Then** the delta is classified as expected simplification, bug, or unresolved business assumption.

**Given** a workflow touches tenant-owned data or files
**When** the comparison harness runs integration cases
**Then** it includes two-tenant RLS/storage negative cases where applicable.

**Technical Notes:** Keep expected Lovable behavior and new expected behavior separate where intentional deltas exist.

**Test Requirements:** Golden tests for money/tax/quote/PDF/acceptance/job/file categories, RLS/storage negatives, and report generation tests.

**Security/RLS Impact:** High for integration comparisons; fixture privacy remains mandatory.

**Money/Tax/Quote Impact:** Critical. This is the final domain correctness evidence layer.

**Migration/Coexistence Impact:** High.

**Dependencies:** Epics 4-8 and Story 9.2.

**Stop Conditions Requiring Human Approval:** Stop if unresolved deltas affect money/tax behavior, quote immutability, acceptance semantics, quote numbering, or accepted-quote-to-job lifecycle.

### Story 9.4: Pilot Fallback, Cutover, And Sign-Off Register

As a pilot operator,
I want fallback, cutover, and sign-off decisions documented,
So that real pilot use starts only when the business accepts remaining assumptions.

**Acceptance Criteria:**

**Given** selected pilot workflows
**When** readiness is reviewed
**Then** the runbook documents old-app fallback, cutover-by-workflow plan, manual backfill risks, and rollback decision points.

**Given** owner/accounting/legal questions remain
**When** sign-off register is reviewed
**Then** quote numbering, sent event semantics, acceptance channels, adjusted price policy, required files, VAT, ROT, grön teknik, rounding, quote terms, and tax wording are clearly marked as signed off or blocking real pilot use.

**Given** a blocking assumption is unresolved
**When** someone tries to approve real pilot cutover
**Then** the checklist blocks pilot use for the affected workflow.

**Technical Notes:** This is a decision artifact, not a product analytics dashboard.

**Test Requirements:** Docs review, checklist validation, and traceability to PRD/architecture/quality gates.

**Security/RLS Impact:** Confirms no public privileged endpoints, service-role client paths, or deferred-scope activation before pilot use.

**Money/Tax/Quote Impact:** High. Captures required business/legal/accounting sign-offs.

**Migration/Coexistence Impact:** High. Governs cutover and fallback.

**Dependencies:** Stories 9.1 through 9.3.

**Stop Conditions Requiring Human Approval:** Stop if a real pilot workflow depends on unresolved money/tax, quote immutability, acceptance, required-file, or migration classification decisions.

### Story 9.5: Phase A Acceptance Gate Report

As an implementation lead,
I want a final Phase A acceptance gate report,
So that the team can decide whether selected quote-to-job workflows are ready for internal pilot use.

**Acceptance Criteria:**

**Given** Phase A implementation stories are complete
**When** the acceptance gate report is generated
**Then** it summarizes clean install, typecheck, lint, unit tests, build, migration reset, command integration tests, RLS/storage negative tests, golden-master comparisons, fixture privacy checks, and skipped gates with reasons.

**Given** the report checks scope
**When** it scans the implemented surface
**Then** it confirms no Fortnox, supplier APIs, AI jobs, HR, rentals, assets/QR, DoU automation, tender/FKU RAG, full RBAC, customer portal, public privileged endpoints, broad admin analytics, or broad document center was implemented.

**Given** the report checks readiness
**When** unresolved stop conditions remain
**Then** it lists them with owner/accounting/legal/security decision owners and blocks real pilot use where required.

**Technical Notes:** This story produces readiness evidence. It does not implement new product behavior.

**Test Requirements:** Report generation/checklist tests where automated, plus manual review against quality gates and PRD AC1-AC22.

**Security/RLS Impact:** Consolidates security evidence and remaining risks.

**Money/Tax/Quote Impact:** Consolidates money/tax/quote lifecycle evidence and sign-offs.

**Migration/Coexistence Impact:** Confirms old-app fallback and fixture coverage before cutover.

**Dependencies:** Epics 1-8 and Stories 9.1 through 9.4.

**Stop Conditions Requiring Human Approval:** Stop if any required Phase A gate fails or if a deferred module appears in implemented scope.
