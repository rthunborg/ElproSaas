---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation-skipped
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
inputDocuments:
  - C:\ElproSaas\AGENTS.md
  - C:\ElproSaas\_bmad-output\project-context.md
  - C:\ElproSaas\docs\planning\saas-rebuild-phased-plan-2026-06-07.md
  - C:\ElproSaas\docs\discovery\e0-domain-oracle-report.md
  - C:\ElproSaas\docs\discovery\e0-owner-question-list.md
  - C:\ElproSaas\docs\security\security-guardrails.md
  - C:\ElproSaas\docs\quality\quality-gates.md
  - C:\ElproSaas\docs\decisions\ADR-0001-agentic-development-process.md
documentCounts:
  productBriefs: 0
  research: 0
  brainstorming: 0
  projectDocs: 8
  projectContext: 1
classification:
  projectType: saas_b2b
  domain: electrical_contracting_trade_services
  complexity: medium-high
  projectContext: brownfield
workflowType: 'prd'
---

# Product Requirements Document - Elpro

**Author:** Rasmus
**Date:** 2026-06-08T17:54:45.8603847+02:00

## Executive Summary

Elpro Phase A is an Internal Pilot MVP for rebuilding the current Lovable-generated electrical contracting app into a secure, maintainable, pooled multi-tenant SaaS foundation. The pilot scope is intentionally narrow: tenant-admin access, CRM, company settings/pricing, calculations, immutable quote versions/PDF/acceptance, basic job/order creation from accepted quotes, required files, and migration/coexistence using the current Lovable app as a behavioral oracle.

The product is not a complete commercial SaaS launch and not a full clone of the Lovable app. Phase A proves that one internal company can run selected quote-to-accepted-job work in the new system while the old app remains available as fallback. Feature breadth is secondary to tenant isolation, reproducible delivery, domain correctness, money/tax safety, immutable customer commitments, auditable acceptance evidence, and golden-master comparison against known legacy behavior.

Target users for Phase A are internal tenant administrators who manage customers, facilities, contacts, pricing, calculations, quote documents, quote acceptance, and the initial job/order record. Field-worker UX, finance integrations, supplier automation, AI workflows, HR, rentals, assets, DoU automation, tender/FKU RAG, and full RBAC are explicitly deferred.

### What Makes This Special

The core product insight is that the rebuild should preserve domain behavior without inheriting the old app's unsafe architecture or premature breadth. Lovable remains a requirements oracle for workflow shape, terminology, edge cases, PDFs, calculations, acceptance transitions, and fixture candidates; it is not a default code source.

The differentiator for the pilot is a trustworthy quote-to-accepted-job foundation for Swedish electrical contracting: integer öre money handling, snapshotted VAT/tax/pricing assumptions, immutable sent and accepted quote versions, server-side acceptance-to-job transactions, private tenant-owned files, and cross-tenant negative tests from day one. This creates an internal pilot that is operationally useful now and structurally ready for later SaaS expansion.

### Project Classification

- **Project Type:** B2B SaaS web application.
- **Domain:** Swedish electrical contracting and trade-services operations.
- **Complexity:** Medium-high because Phase A includes tenant isolation, money/VAT/ROT/grön teknik correctness, quote immutability, acceptance semantics, private files, and migration/coexistence.
- **Project Context:** Brownfield rebuild. Existing project documentation and Lovable behavior inform requirements, but Phase A is a narrow internal pilot rather than a full legacy replacement.

## Success Criteria

### User Success

Phase A succeeds for the internal tenant admin when the admin can complete a selected real quote-to-accepted-job workflow in the new system without relying on unsafe legacy behavior. The admin can maintain the customer, facility, contact, company settings, pricing inputs, calculation, quote version, PDF, acceptance evidence, and basic job/order record needed for the workflow.

User trust is the primary success signal. The admin can explain where totals, VAT, ROT/grön teknik assumptions, work-role prices, article prices, quote terms, accepted price, and attached files came from because they are snapshotted and visible in the appropriate lifecycle records. The admin can safely use the new system for selected pilot work while the old Lovable app remains available as fallback.

### Business Success

Phase A succeeds for the business when one internal company can run selected new quotes through the new system, compare the results against representative Lovable oracle fixtures, and approve continued pilot use without expanding scope into deferred modules.

The pilot is successful if it proves the SaaS foundation: pooled tenancy, tenant-admin access, core CRM/settings/pricing, calculations, immutable quote versions/PDF/acceptance, basic job/order creation, required files, and migration/coexistence. Commercial breadth is not a Phase A success criterion.

### Technical Success

Technical success requires a reproducible, secure, testable foundation. A fresh checkout can be installed and verified. Typecheck, lint, unit tests, integration tests, and build pass for Phase A product work. Supabase migrations can reset from an empty database once migrations exist. Tenant-owned business records are protected by RLS, and automated cross-tenant negative tests prove Tenant A cannot access Tenant B data.

No service-role key is reachable from browser/client paths. No unauthenticated privileged functions exist. Sensitive mutations run through authenticated, tenant-scoped, validated, audited server-side commands. Files are private, tenant-owned, MIME/size validated, and served through short-lived signed URLs.

### Measurable Outcomes

- A tenant admin can complete the pilot workflow: CRM/settings/pricing -> calculation -> quote version/PDF -> sent status -> acceptance evidence -> basic job/order creation.
- At least two tenants exist in test fixtures, and cross-tenant read/write/file access attempts fail.
- Money is stored as integer öre, and unit tests cover rounding, VAT, ROT, grön teknik, quote totals, accepted price, and immutable snapshots.
- Sent quote versions cannot be mutated. Accepted quote versions and acceptance evidence cannot be mutated except through an explicit audited correction workflow.
- Accepted-quote-to-job creation is transactional, idempotent, tenant-scoped, and auditable.
- Representative Lovable oracle fixtures exist for calculations, quote PDFs, acceptance transitions, required files, and migration/coexistence comparisons.
- Old app fallback and pilot coexistence steps are documented before real pilot use.

## Product Scope

### MVP - Minimum Viable Product

The Phase A MVP includes only the Internal Pilot slice: pooled tenant foundation, `tenant_admin` access, CRM for kund/anläggning/kontakt, company settings and pricing, calculations, quote versions/PDF/acceptance, basic job/order creation from accepted quotes, required files/documents, and migration/coexistence with golden-master fixtures.

The MVP must preserve architecture seams for later SaaS expansion without creating production tables, UI, jobs, or integrations for deferred modules. The billing/Fortnox boundary may be documented as future domain language, but no Fortnox implementation is part of Phase A.

### Growth Features (Post-MVP)

External Beta may add validated non-admin roles, mobile/field workflow, manual billing-basis review/export if proven necessary, production observability, tenant operations, stronger audit/data-retention processes, and onboarding/offboarding runbooks. These features are not Phase A defaults and require separate approval.

### Vision (Future)

The future commercial SaaS may support multiple Swedish electrical contractors with full RBAC, Fortnox integration, supplier integrations, AI-governed workflows, DoU/tender/asset/rental/HR modules, and enterprise deployment options. Each future area requires its own approved epic, schema, tests, security model, and rollout plan.

## User Journeys

### User and Persona Assumptions

Phase A implements one authenticated product role: `tenant_admin`. The tenant admin is an internal office/project administration user for the current electrical contractor. The same role may configure tenant settings, maintain CRM records, create calculations, prepare quote versions, generate PDFs, record acceptance, create the basic job/order, and manage required files.

The end customer is an external recipient of quote PDFs and acceptance communication, but does not log in to the Phase A system. Customer acceptance is recorded by the tenant admin as evidence from an off-system channel such as email, phone note, meeting note, or signed PDF. The exact legally sufficient acceptance channels require owner confirmation before real pilot use.

Accounting/legal reviewers, pilot approvers, and implementation/support engineers are not separate app roles in Phase A. They influence sign-off, fixtures, runbooks, and verification, but product access remains `tenant_admin` unless a later approved phase adds roles.

### Journey 1: Tenant Admin Completes the Core Pilot Workflow

The tenant admin starts with a real customer request that is representative enough to prove the rebuild. They create or select the kund, add the relevant anläggning and kontakt, confirm company settings and work-role pricing, then create a calculation.

Inside the calculation, the admin structures work into sections and rows for labor, material, subcontractor, machinery, or other costs. They review margins, VAT display, optional ROT/grön teknik assumptions, quote-visible notes, and required attachments. When the calculation is ready, they create a quote version from a snapshot rather than from mutable live data.

The admin generates a PDF, marks the quote as sent, and the system makes the sent quote version immutable. When the customer accepts off-system, the admin records acceptance evidence, accepted price, channel, timestamp, and notes. The system creates a basic job/order from the accepted quote version in the same audited transaction.

The journey succeeds when the admin can trace the final job/order back to the immutable quote version and acceptance record, and can explain every customer-visible amount and file included in the commitment.

### Journey 2: Tenant Admin Changes a Quote After It Was Sent

The tenant admin discovers that a customer-visible item must change after a quote has already been sent: a price, VAT/tax assumption, attachment, terms section, quote-visible note, validity date, or included option.

The system prevents mutation of the sent quote version. The admin creates a new quote version from the revised calculation or quote draft. The previous sent version remains available for audit and comparison. The new version receives its own snapshot of customer-visible content, totals, VAT/tax assumptions, selected attachments, terms, PDF metadata, and sent lifecycle event.

The journey succeeds when the admin cannot accidentally overwrite a customer commitment, can send a corrected version, and can see which version was eventually accepted.

### Journey 3: Tenant Admin Handles Acceptance With Adjusted Price or Evidence

The tenant admin records acceptance and sees that the accepted price or evidence differs from the sent quote total or expected channel. The system requires an explicit reason/evidence note rather than silently changing the quote.

Acceptance records the accepted quote version, accepted_at, accepted_by/admin user, channel, evidence reference, agreed customer price, and planned dates if available. If the acceptance data is valid, the system creates the basic job/order transactionally and idempotently. If job creation fails, acceptance does not leave the system in a half-created state.

The journey succeeds when repeated accept/create attempts do not create duplicate jobs, adjusted acceptance data is auditable, and corrections require an explicit admin correction path.

### Journey 4: Pilot Operator Compares New Behavior Against Lovable Oracle

Before real pilot use, the pilot operator selects representative Lovable records for anonymized fixtures: CRM records, calculations, quote PDFs, acceptance transitions, files, and accepted quote-to-job examples. The old app remains the behavioral oracle and fallback, not a code source.

The operator runs shadow comparisons against the new implementation. Differences in totals, VAT/tax blocks, quote-visible rows, attachment handling, PDF text, acceptance fields, and job creation are documented as expected changes, bugs, or unresolved business assumptions.

The journey succeeds when the team has enough fixture evidence to approve selected pilot workflows, knows which legacy data is live/archive/excluded, and has a fallback path if the new system blocks real work.

### Journey 5: Internal Support Investigates a Tenant or File Access Issue

An internal support or implementation engineer investigates a suspected tenant isolation, file access, or lifecycle issue during pilot verification. They do not rely on browser-visible service-role access or client-trusted tenant IDs.

The system exposes enough audit and metadata to trace tenant, user, command, request, file owner, quote version, acceptance record, and job/order source. Tests prove cross-tenant reads, writes, and file access fail. Private files are resolved through tenant-owned metadata and short-lived signed URLs.

The journey succeeds when support can identify the record and command path involved, reproduce the issue safely, and verify that security controls prevent cross-tenant data leakage.

### Journey Requirements Summary

These journeys reveal Phase A capability requirements for:

- Tenant-admin authentication, membership, tenant scoping, RLS, and audit logging.
- CRM records for kund, anläggning, and kontakt.
- Company settings, quote terms, VAT defaults, work roles, and optional article pricing.
- Calculations with sections, rows, totals, margin warnings, VAT, ROT/grön teknik assumptions, options, hidden/visible quote rows, notes, and attachments.
- Quote lifecycle with draft editability, sent immutability, version snapshots, PDF rendering, attachment snapshots, quote numbering, and lifecycle events.
- Acceptance capture with immutable evidence, accepted price semantics, correction rules, and transactionally created basic job/order.
- Required files with private storage, tenant-owned metadata, MIME/size validation, signed URLs, deletion audit, and immutable quote/evidence snapshots.
- Migration/coexistence with anonymized golden-master fixtures, shadow comparison, old app fallback, and live/archive/excluded classification.
- Explicit non-requirement for Phase A customer portal, public acceptance endpoint, Fortnox implementation, supplier APIs, field-worker UX, AI jobs, HR, rentals, assets/QR, DoU automation, tender/FKU RAG, and full RBAC.

## Domain-Specific Requirements

### Compliance & Regulatory

Phase A must treat Swedish customer, contact, address, phone, email, photos, file metadata, and possible personal identity information as privacy-relevant data. IMY guidance describes personal data as information that can directly or indirectly identify a living person, including names, addresses, personal identity numbers, phone numbers, emails, photos, and some organization numbers for sole traders. Phase A must minimize personal data capture, avoid unnecessary personnummer handling, and keep anonymized fixtures free of real customer data.

ROT and grön teknik behavior must be treated as tax-sensitive. The PRD may define snapshotting, validation, warnings, and sign-off requirements, but must not present rates, caps, eligible bases, BRF eligibility, schablon handling, or customer-facing disclaimer text as production-approved until owner plus accounting/legal confirmation is complete. Official Skatteverket guidance is the external reference point for final sign-off.

Quote PDFs, terms, acceptance evidence, and accepted-price adjustments create customer-visible commitments. Phase A must preserve sent and accepted quote versions as immutable records and must make later corrections auditable rather than silent edits.

### Technical Constraints

All Phase A business data must be tenant-owned even if the pilot has only one real company. Tenant isolation must be enforced by RLS and tested with at least two tenants. Server-side commands must verify authentication and membership, ignore or verify client-supplied tenant identifiers, validate inputs, and write audit events for critical mutations.

Money must be represented in integer öre. VAT rate, VAT amount, tax deduction assumptions, work-role prices, article prices, quote terms, attachment selections, PDF metadata, and customer-visible quote content must be snapshotted into quote versions. Calculations may be editable before quote send, but sent and accepted customer commitments must not depend on mutable settings, article rows, work roles, or calculation rows.

Required files must use private storage, tenant-owned metadata, server-derived paths, MIME and size validation, short-lived signed URLs, and deletion audit. Quote attachment selections and acceptance evidence files must be snapshotted or locked according to quote lifecycle state.

### Integration Requirements

There are no active external production integrations in Phase A. Fortnox, supplier APIs, AI jobs, public privileged endpoints, webhook endpoints, and cron-style privileged automations are deferred. The only Phase A integration-like work is migration/coexistence with the existing Lovable app through anonymized fixtures, shadow comparison, and old-app fallback.

Future integration boundaries may be documented as seams, but Phase A must not create production tables, credentials, sync workers, retries, webhooks, or external ID mappings for deferred integrations.

### Risk Mitigations

- **Tax correctness risk:** Store full tax assumptions in quote snapshots, expose warnings before send, and require accounting/legal sign-off before real pilot use.
- **Quote commitment risk:** Make sent quote versions, accepted quote versions, acceptance evidence, and accepted-quote-to-job source references immutable except through explicit audited correction workflows.
- **Tenant leakage risk:** Use tenant-owned records, RLS, server-verified membership, private storage, and cross-tenant negative tests.
- **Legacy behavior drift risk:** Use Lovable only as a behavioral oracle, capture anonymized golden-master fixtures, and document old/new deltas before pilot cutover.
- **Scope creep risk:** Keep deferred modules out of Phase A schema, UI, jobs, and API surfaces unless re-approved by ADR-backed scope change.
- **Personal data risk:** Exclude unnecessary personnummer capture, anonymize fixtures, avoid real secrets/customer data in docs/prompts/logs, and document retention/deletion expectations before external beta.

Reference points for final sign-off include Skatteverket ROT/RUT and grön teknik guidance plus IMY GDPR/personuppgifter guidance. These references inform verification responsibilities; they do not replace owner/accounting/legal approval.

## B2B SaaS Specific Requirements

### Project-Type Overview

Elpro Phase A is a B2B SaaS web application rebuilt as an internal pilot. The product must be designed for pooled multi-tenancy from day one even though the pilot initially serves one internal company. The app should support a future commercial SaaS operating model without implementing commercial breadth in Phase A.

The Phase A SaaS value is not subscriptions, billing tiers, or broad team collaboration. The value is a secure tenant-owned workflow foundation for Swedish electrical contracting: CRM/settings/pricing, calculations, quote versions/PDF/acceptance, basic job/order creation, files, and migration/coexistence.

### Technical Architecture Considerations

The Phase A command layer should use authenticated server-side command handlers, consistent with the accepted backend command direction in the baseline planning docs. Sensitive mutations must not be performed as client-only multi-step sequences. Commands must verify user identity, tenant membership, and input validity; use database transactions where consistency matters; and write audit events for critical lifecycle changes.

Every business table introduced for Phase A must be tenant-owned. RLS must remain active and must be tested with cross-tenant negative cases. Client paths must not receive service-role access. Public privileged endpoints are not allowed.

### Tenant Model

- Use pooled multi-tenancy by default.
- Production is expected to contain many tenant companies in one production database/project.
- All Phase A business records must include tenant ownership directly or through a tenant-owned parent.
- Tenant context must come from authenticated membership and server-side verification, not from trusted client input.
- Tests must create at least two tenants and prove cross-tenant reads, writes, and file access fail.

### Permission Model

Phase A implements only `tenant_admin`. The tenant admin has full tenant-scoped access to Phase A modules and settings. Future roles may be schema-aware, but no role UX, broad RBAC matrix, project manager role, installer role, economy role, or subcontractor role is implemented in Phase A.

Future role expansion must be server-enforced and tested. It must not be simulated only through client-side navigation or button hiding.

### Subscription Tiers

No subscription tiers, billing plans, commercial packaging, payment collection, or customer self-service tenant signup are included in Phase A. Internal Pilot success is measured by workflow correctness and SaaS foundation readiness, not monetization.

Any future subscription model belongs to External Beta or Commercial SaaS planning and requires separate product decisions.

### Integration List

Active Phase A integrations:

- Supabase Auth/Postgres/Storage as the application platform.
- Existing Lovable app as a read-only behavioral oracle and fallback during coexistence.
- Anonymized fixture exports and shadow comparisons for selected legacy records.

Deferred integrations:

- Fortnox OAuth, sync, retry UI, external mappings, invoice/accounting sync.
- Supplier APIs, supplier credentials, imports, EDI, live price sync.
- AI jobs, autonomous AI mutation, tender/FKU RAG.
- Public privileged endpoints, cron endpoints, webhooks, and unauthenticated automation.

### Compliance Requirements

Phase A compliance requirements are practical guardrails rather than a complete commercial compliance program:

- Privacy-aware handling of customer/contact/file data.
- No real customer secrets or personal data in prompts, docs, logs, fixtures, or committed files.
- Tenant isolation by design and by tests.
- Auditability for settings, money/tax records, quote lifecycle, acceptance, job creation, and file operations.
- Accounting/legal sign-off before real pilot use for ROT, grön teknik, VAT assumptions, quote terms, and customer-facing tax disclaimer text.

### Implementation Considerations

Implementation should be modular by Phase A workflow area, not by deferred future modules. The system should preserve extension seams for future Fortnox, field-worker UX, supplier APIs, AI jobs, and broader RBAC, but must not create production schema or UI for those modules during Phase A.

Server-side command handlers should be testable as plain TypeScript where possible, with integration tests for database, RLS, storage, lifecycle, and transaction behavior. Quote PDF generation must read from immutable quote version snapshots rather than mutable live settings or calculations.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Foundation-plus-workflow validation MVP. Phase A must prove the production SaaS foundation and one useful internal quote-to-accepted-job workflow, not maximize feature breadth.

**Resource Requirements:** Phase A requires product/domain ownership, TypeScript/Next.js/Supabase engineering, database/RLS competence, PDF/file handling competence, QA/test ownership, security review, and accounting/legal input for money/tax and quote terms before real pilot use.

### Phase A Goals

- Establish a clean, reproducible rebuild foundation.
- Implement pooled tenant architecture with tenant-owned business records.
- Implement `tenant_admin` access only.
- Support CRM records needed for pilot calculations and quotes: kund, anläggning, kontakt.
- Support company settings, quote terms, VAT defaults, work roles, and minimal pricing inputs.
- Support calculations with sections, rows, totals, margin/VAT/tax assumptions, notes, options, and attachments needed for quotes.
- Support quote versions, sent PDF output, lifecycle events, immutable sent/accepted snapshots, and acceptance evidence.
- Create a basic job/order from an accepted quote version transactionally and idempotently.
- Support required files/documents for CRM, calculations, quotes, acceptance evidence, and basic jobs/orders.
- Support migration/coexistence through anonymized fixtures, shadow comparison, old app fallback, and selected pilot cutover.

### Phase A Non-Goals

Phase A is not a complete commercial SaaS PRD, not a full Lovable clone, and not a production rollout for external companies. It does not implement field-worker workflows, broad finance/accounting automation, full project management, or public customer self-service.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**

- Tenant admin completes CRM/settings/pricing -> calculation -> quote version/PDF -> send -> acceptance -> basic job/order.
- Tenant admin creates a new immutable quote version when customer-visible content changes after send.
- Tenant admin records acceptance evidence and accepted price with auditability.
- Pilot operator compares representative new-system behavior against anonymized Lovable oracle fixtures.
- Internal support verifies audit, tenant isolation, and file access behavior during pilot validation.

**Must-Have Capabilities:**

- Authenticated app access with active tenant membership.
- Pooled tenants, tenant memberships, `tenant_admin`, RLS, and audit log.
- Tenant-scoped CRM, settings, pricing, calculations, quotes, jobs/orders, and files.
- Integer öre money storage and explicit rounding rules.
- VAT, ROT, grön teknik, pricing, terms, and file selections snapshotted into quote versions where customer-visible.
- Server-generated tenant-scoped quote numbers.
- Immutable sent quote versions.
- Immutable accepted quote version and acceptance evidence, except explicit audited correction workflow.
- Transactional accepted-quote-to-job creation.
- Private file storage and tenant-owned file metadata.
- Golden-master fixtures and coexistence runbook.

### Explicit Deferred Scope

The following are deferred and must not create Phase A production tables, UI, privileged endpoints, workers, credentials, or integrations unless re-approved:

- Fortnox implementation, OAuth, sync workers, retry UI, external mappings, invoices, and accounting sync.
- Field-worker/mobile installer UX.
- Supplier APIs, live supplier imports, supplier credentials, EDI, and automated price sync.
- AI jobs, autonomous AI mutation, tender/FKU RAG, and AI document processing.
- HR, rentals, assets/QR, DoU automation, service plans, warranties, notes/tickets, and full job/project analytics.
- Full RBAC and non-admin roles such as project manager, installer, economy, subcontractor, or external customer portal.
- Public privileged endpoints, unauthenticated webhooks, and public cron-style command surfaces.

### Post-MVP Features

**Phase 2 (Post-MVP / External Beta):**

External Beta may introduce validated non-admin roles, mobile field workflow, assigned jobs, time/material/deviation/photo reporting, manual billing-basis review/export if needed, observability, backup/restore runbooks, onboarding/offboarding, stricter audit, data retention/deletion documentation, and tenant support processes.

**Phase 3 (Expansion / Commercial SaaS):**

Commercial SaaS may add full permission matrices, Fortnox integration, supplier integrations, governed AI workflows, broader operational modules, enterprise deployment options, performance/load hardening, security scanning, customer documentation, and support SLAs.

### Risk Mitigation Strategy

**Technical Risks:** Use server-side command handlers, RLS, integration tests, immutable snapshots, transaction boundaries, private files, and migration reset verification. Avoid copying Lovable architecture or unsafe service-role patterns.

**Market Risks:** Validate usefulness through selected internal real-work pilot flows before external beta. Use Lovable shadow comparisons to distinguish intentional product simplification from missing business behavior.

**Resource Risks:** Keep Phase A admin-only and workflow-limited. If resources tighten, preserve tenant foundation, calculations, quote immutability, acceptance-to-job lifecycle, and golden-master tests before adding optional articles, advanced file browsing, or broader job details.

**Domain Risks:** Treat ROT, grön teknik, VAT, quote terms, acceptance evidence, quote numbering format, and accepted-price semantics as sign-off-sensitive before real pilot use.

## Functional Requirements

### Tenant Foundation and Access

- FR1: Authenticated users can access Phase A app capabilities only when they have an active tenant membership.
- FR2: Tenant admins can work only inside tenants where they have active `tenant_admin` membership.
- FR3: Tenant admins can view the active tenant/company context used for all tenant-scoped records.
- FR4: Tenant admins can manage Phase A tenant/company settings needed for CRM, pricing, calculations, quotes, files, and jobs/orders.
- FR5: Tenant admins can view audit history for critical tenant-scoped actions.
- FR6: The system can reject cross-tenant reads, writes, lifecycle actions, and file access attempts.

### CRM: Kund, Anläggning, Kontakt

- FR7: Tenant admins can create, view, update, archive, and search customers.
- FR8: Tenant admins can classify customers using Phase A-supported customer types.
- FR9: Tenant admins can create, view, update, archive, and search facilities linked to customers.
- FR10: Tenant admins can create, view, update, archive, and search contacts linked to customers and optionally facilities.
- FR11: Tenant admins can identify a primary contact according to the Phase A contact rule.
- FR12: Tenant admins can select customer, facility, and contact context when creating calculations and quotes.

### Company Settings and Pricing

- FR13: Tenant admins can maintain company identity fields required for quote PDFs.
- FR14: Tenant admins can maintain default quote terms for future quote drafts.
- FR15: Tenant admins can maintain default VAT display and VAT-rate assumptions for Phase A quote workflows.
- FR16: Tenant admins can maintain work roles with active/inactive status and labor pricing inputs.
- FR17: Tenant admins can maintain a minimal article/material catalog if required for pilot calculations.
- FR18: The system can snapshot work-role, article, VAT, and terms data when those values become customer-visible in quote versions.

### Calculations

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

### Quote Versions, PDF, and Lifecycle

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

### Quote Acceptance and Basic Job/Order Creation

- FR41: Tenant admins can record quote acceptance for a specific sent quote version.
- FR42: Tenant admins can capture acceptance channel, accepted timestamp, accepted-by/admin user, evidence reference, accepted price, notes, and planned dates when available.
- FR43: The system can require explicit reason/evidence when accepted price differs from the sent quote total.
- FR44: The system can make accepted quote version references and acceptance evidence immutable except through an explicit audited correction workflow.
- FR45: The system can create a basic job/order from an accepted quote version.
- FR46: The system can create the acceptance record and basic job/order transactionally.
- FR47: The system can prevent duplicate jobs/orders from repeated acceptance or create-job attempts.
- FR48: Tenant admins can view the source quote version, acceptance evidence, accepted price, and source totals on the resulting job/order.

### Files and Documents

- FR49: Tenant admins can upload files required for Phase A CRM, calculation, quote, acceptance, and job/order workflows.
- FR50: Tenant admins can view, download, replace where allowed, archive, or delete files according to lifecycle rules.
- FR51: The system can validate file type, size, tenant ownership, owning entity, and storage path before files become usable.
- FR52: The system can serve private files through tenant-authorized, short-lived access.
- FR53: The system can lock or snapshot quote PDFs, quote attachments, and acceptance evidence files when lifecycle rules require immutability.
- FR54: The system can audit file upload, access, delete/archive, and lifecycle-lock events.

### Migration, Coexistence, and Golden-Master Fixtures

- FR55: Pilot operators can classify legacy Lovable records as live, archive-only, excluded, or deferred for Phase A.
- FR56: Pilot operators can create anonymized fixture sets for representative CRM, calculation, quote, PDF, acceptance, file, and accepted-quote-to-job behavior.
- FR57: The system can support shadow comparison of new calculation totals, quote outputs, PDFs, acceptance transitions, and job/order creation against selected Lovable oracle fixtures.
- FR58: Pilot operators can document old/new behavior deltas and fallback decisions before pilot cutover.
- FR59: The system can keep old-app fallback explicit for selected workflows until pilot acceptance gates are met.

### Scope Boundaries

- FR60: The system can preserve documented seams for future Fortnox, supplier, field-worker, AI, and RBAC expansion without implementing deferred Phase A modules.
- FR61: Tenant admins cannot access Phase A UI or workflows for Fortnox sync, supplier APIs, AI jobs, HR, rentals, assets/QR, DoU automation, tender/FKU RAG, full field-worker UX, full RBAC, or public privileged endpoints.

## Non-Functional Requirements

### Security and Tenant Isolation

- NFR1: Every Phase A business record must be tenant-owned directly or through a tenant-owned parent.
- NFR2: RLS must enforce tenant isolation for all tenant-owned business tables.
- NFR3: Automated tests must prove cross-tenant read/write attempts fail for at least two tenants.
- NFR4: No service-role key may be reachable from browser/client paths.
- NFR5: No unauthenticated privileged function, route, endpoint, webhook, or cron command may exist in Phase A.
- NFR6: Sensitive commands must verify authenticated user, tenant membership, input validity, tenant ownership, and authorization before mutation.
- NFR7: Critical business commands must write audit events with tenant, user, command, target record, lifecycle event, and timestamp.
- NFR8: File access must be tenant-authorized and must not trust client-supplied storage paths.

### Data Integrity and Domain Correctness

- NFR9: SEK money must be stored as integer öre, not floating-point kronor.
- NFR10: Quote versions must snapshot all customer-visible financial, tax, terms, attachment, and PDF content required to reproduce the sent commitment.
- NFR11: Sent quote versions must be immutable.
- NFR12: Accepted quote version references and acceptance evidence must be immutable except through explicit audited correction workflows.
- NFR13: Accepted-quote-to-job creation must be transactional and idempotent.
- NFR14: Rounding, VAT, ROT, grön teknik, option/tillval, hidden-row, and accepted-price behavior must be covered by tests before real pilot use.
- NFR15: ROT, grön teknik, VAT assumptions, quote terms, and customer-facing tax wording require owner plus accounting/legal sign-off before real pilot use.

### Privacy and Data Handling

- NFR16: The system must minimize personal data captured in Phase A, especially personnummer and sensitive free-text notes.
- NFR17: Anonymized fixtures must not contain real names, phone numbers, emails, addresses, personal numbers, organization numbers, secrets, or raw customer files unless explicitly approved.
- NFR18: Logs, prompts, screenshots, docs, and committed files must not include customer secrets, real personal data, service-role keys, or `.env` values.
- NFR19: Private files must be served through short-lived signed access and tenant-owned metadata.

### Reliability and Operational Safety

- NFR20: Quote acceptance and job/order creation must not leave partial state if one part of the workflow fails.
- NFR21: Old app fallback must remain documented and available for selected workflows until Phase A pilot gates are approved.
- NFR22: Migration/coexistence runs must classify records as live, archive-only, excluded, or deferred before cutover.
- NFR23: Lifecycle correction workflows must preserve original records and record who changed what, when, and why.

### Performance

- NFR24: Core tenant-admin workflows should remain responsive for pilot-sized data sets: CRM search, calculation editing, quote preview/PDF generation, file metadata retrieval, and job/order creation must not block normal internal use.
- NFR25: PDF generation and signed-file access may be asynchronous or wait-state flows if needed, but must expose completion/failure status to the tenant admin.
- NFR26: Performance targets beyond pilot-sized internal use are deferred until External Beta sizing is known.

### Scalability

- NFR27: The schema and access model must support many tenants in production even during a one-company pilot.
- NFR28: Phase A must not require one Supabase project per customer company.
- NFR29: Deferred modules must not be represented by placeholder production tables that increase migration or RLS surface area before validation.

### Accessibility and Usability

- NFR30: Tenant-admin workflows must be usable in a standard modern browser with clear form validation, readable text, keyboard-reachable controls, and accessible error states.
- NFR31: Phase A does not require mobile-first installer UX, but the admin web app should avoid layouts that prevent use on common laptop/desktop viewports.

### Integration and Coexistence

- NFR32: Lovable oracle comparisons must use anonymized fixtures and documented deltas rather than copied legacy code.
- NFR33: Fortnox, supplier, AI, field-worker, HR, rental, asset, DoU, tender/FKU, and full RBAC integrations must remain inactive unless a later ADR-backed scope change approves them.
- NFR34: Future integration seams must not expose credentials, public privileged entrypoints, or external IDs in Phase A production schema.

### Test and Quality Requirements

- NFR35: Clean install from a fresh checkout must be reproducible.
- NFR36: Typecheck, lint, unit tests, and build must pass for Phase A product work.
- NFR37: Unit tests must cover money, VAT, ROT, grön teknik, quote lifecycle, snapshotting, and immutability rules.
- NFR38: Integration tests must cover create calculation, create/send quote version, accept quote, create job/order, file access, and core server commands.
- NFR39: RLS and storage negative tests must prove cross-tenant isolation.
- NFR40: Supabase migration reset from an empty database must pass once migrations exist.
- NFR41: Docs/config-only work may use lighter verification, but skipped product gates must be explicitly stated.

## Data and Domain Assumptions

Phase A uses conservative assumptions where owner answers are not required to draft the PRD. These assumptions are valid for planning and prototype/demo work, but some require owner or accounting/legal confirmation before real pilot use.

- Customers may be private persons, companies, BRFs, foundations, or public-sector entities, but the exact Phase A customer-type list needs owner confirmation before real pilot use.
- A customer can have multiple facilities. A calculation or quote can reference a customer and may reference a facility/contact when applicable.
- Contacts can be customer-level and may optionally be facility-specific.
- One authenticated role exists in product UX: `tenant_admin`.
- The end customer does not log in during Phase A.
- The old Lovable app remains the behavioral oracle and operational fallback during coexistence.
- Historical records are not all migrated by default; records are classified as live, archive-only, excluded, or deferred.
- Articles are optional/minimal unless pilot calculations prove they are required.
- Job/order terminology is treated as a Phase A label decision; the required lifecycle is accepted quote -> basic job/order.

## Money, Tax, ROT, and Grön Teknik Assumptions

Money/tax requirements are sign-off sensitive. The PRD defines storage, snapshotting, validation, and audit behavior; it does not approve production tax constants or customer-facing legal wording.

- Store SEK money as integer öre.
- Store VAT rates as explicit snapshotted values, not hidden constants.
- Define and test the rounding policy before real pilot use.
- Snapshot VAT rate, VAT amount, tax deduction type, eligible basis, rates/caps profile, persons/count, schablon choice if used, warnings, customer-visible wording, and resulting totals into quote versions.
- Treat ROT and grön teknik as estimates until accounting/legal confirms rates, caps, eligible bases, customer eligibility, BRF handling, schablon handling, and disclaimer text.
- Do not mix ROT and grön teknik unless owner/accounting/legal explicitly approves a supported rule.
- Preserve exact öre in stored snapshots even if PDFs display rounded kronor.
- Require human admin confirmation before sending quotes that include ROT or grön teknik assumptions.

External reference points for sign-off:

- [Skatteverket ROT and RUT work](https://www.skatteverket.se/servicelankar/otherlanguages/englishengelska/businessesandemployers/startingandrunningaswedishbusiness/declaringtaxesbusinesses/rotandrutwork.4.8dcbbe4142d38302d793f.html)
- [Skatteverket grön teknik](https://www.skatteverket.se/privat/fastigheterochbostad/gronteknik/gronteknikideklarationen.4.676f4884175c97df419292e.html)
- [IMY personuppgifter guidance](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/introduktion-till-gdpr/personuppgifter/)

## Quote Lifecycle and Immutability Requirements

- Draft quote versions can be edited before send.
- Quote numbers must be tenant-scoped and generated server-side.
- Exact quote-number display format requires owner confirmation before real pilot use.
- A quote version becomes immutable when marked sent.
- Customer-visible changes after send require a new quote version.
- Customer-visible changes include lines, sections, price, discount, VAT, ROT/grön teknik, terms, validity, intro text, project/customer/facility display, attachment selection, and quote-visible notes.
- Internal notes and admin-only metadata do not require a new quote version if they do not alter customer-visible commitment.
- Accepted quote version reference, acceptance evidence, accepted price, accepted timestamp, accepted channel, and source snapshot become immutable after acceptance.
- Any correction after acceptance requires an explicit audited correction workflow.
- Basic job/order creation from acceptance must reference the accepted quote version and acceptance record.

## File and Document Requirements

- Phase A files are limited to CRM, calculations, quote versions/PDFs, quote attachments, acceptance evidence, and basic job/order evidence.
- Storage must be private by default.
- File metadata must include tenant, owning entity, purpose, MIME/type, size, uploader, lifecycle state, timestamps, and deletion/archive audit.
- File paths must be server-derived or server-validated; client-supplied paths are not trusted.
- Upload validation must check MIME/type, size, tenant ownership, and owning entity.
- Signed URLs must be short-lived.
- Quote PDF files, selected quote attachments, and acceptance evidence files must be locked or snapshotted once lifecycle rules require immutability.
- Standalone broad document-center behavior is not required in Phase A unless it is limited to Phase A-owned files.

## Migration and Coexistence Requirements

- Use the Lovable app as a behavioral oracle only.
- Export or capture anonymized fixtures for representative CRM, calculation, quote, PDF, acceptance, job/order, and file cases.
- Preserve calculation structure, quantities, rates, discounts, VAT/tax inputs, quote terms, attachment selections, PDF text structure, acceptance shape, and job/order transition shape in fixtures.
- Remove real names, emails, phone numbers, addresses, personnummer, organization numbers where required, sensitive notes, secrets, and raw customer files from fixtures unless explicitly approved.
- Run shadow comparisons before real pilot use.
- Document old/new deltas as expected simplification, bug, or unresolved business assumption.
- Keep the old Lovable app available as fallback until selected Phase A workflows pass acceptance gates.
- Cut over by workflow, not by whole company at once.

## Security and Tenant Requirements

- Use pooled multi-tenancy by default.
- All future business tables introduced in Phase A must be tenant-owned.
- RLS must protect tenant-owned records.
- The app must never trust client-supplied tenant IDs as the authority for ownership.
- No service-role key may be reachable from browser/client paths.
- No unauthenticated privileged functions or public privileged endpoints are allowed.
- Sensitive mutations must be authenticated, tenant-scoped, validated, audited, and transactional where consistency matters.
- Cross-tenant negative tests are mandatory even if there is only one real pilot tenant.

## Test and Quality Requirements

- Clean install from a fresh checkout must be documented and reproducible.
- Typecheck, lint, unit tests, and build must pass for Phase A product work.
- Money, rounding, VAT, ROT, grön teknik, quote lifecycle, immutability, and accepted-price behavior require unit tests.
- Core command integration tests must cover create calculation, create quote version, send quote, accept quote, create job/order, file access, and correction/audit paths.
- RLS and storage tests must include cross-tenant negative cases.
- Supabase migration reset from empty database must pass once migrations exist.
- Golden-master comparisons must cover representative Lovable calculation totals, quote/PDF output, acceptance transitions, and accepted-quote-to-job behavior.

## Acceptance Criteria for Phase A

- AC1: The app supports one internal tenant with at least one authenticated `tenant_admin` and can be tested with at least two tenants.
- AC2: Tenant-owned records and files cannot be read, written, or accessed across tenants in automated negative tests.
- AC3: Tenant admin can complete CRM/settings/pricing -> calculation -> quote version/PDF -> sent status -> acceptance -> basic job/order for a selected pilot case.
- AC4: Company settings, quote terms, VAT defaults, work roles, and optional article/pricing inputs are available for pilot calculations and quotes.
- AC5: Calculations support required Phase A row types, sections, totals, margin indicators, VAT, ROT/grön teknik assumptions, options/tillval, quote visibility, notes, and attachments.
- AC6: SEK amounts are stored in integer öre and money/tax calculations have unit tests for representative cases.
- AC7: Quote numbers are generated server-side and scoped per tenant.
- AC8: Quote PDFs are generated from quote version snapshots, not mutable live data.
- AC9: Sent quote versions are immutable.
- AC10: Customer-visible changes after send create a new quote version.
- AC11: Accepted quote version reference and acceptance evidence are immutable except through explicit audited correction workflow.
- AC12: Acceptance capture supports accepted timestamp, admin user, channel, evidence reference, accepted price, notes, and planned dates when available.
- AC13: Acceptance with adjusted price requires explicit reason/evidence.
- AC14: Accepted-quote-to-job creation is transactional, idempotent, and auditable.
- AC15: Required files use private storage, tenant-owned metadata, validated uploads, signed access, deletion/archive audit, and lifecycle locking where required.
- AC16: Migration/coexistence runbook exists with live/archive/excluded/deferred classification.
- AC17: Representative anonymized Lovable oracle fixtures exist and cover calculations, quote PDFs, acceptance, files, and accepted-quote-to-job behavior.
- AC18: Old app fallback remains documented for selected pilot workflows.
- AC19: Clean install, typecheck, lint, unit tests, integration tests, build, RLS/storage negative tests, and migration reset gates pass as applicable.
- AC20: No Phase A implementation includes Fortnox, supplier APIs, AI jobs, HR, rentals, assets/QR, DoU automation, tender/FKU RAG, field-worker UX, full RBAC, or public privileged endpoints.
- AC21: Owner sign-off exists for quote numbering format, acceptance semantics, required file rules, and pilot cutover scope before real pilot use.
- AC22: Accounting/legal sign-off exists for VAT, ROT, grön teknik, rounding policy, quote terms, and customer-facing tax wording before real pilot use.

## Owner Questions

### Blocking Before Real Pilot Use

- What quote number display format should Phase A use?
- What exact event makes a quote sent, and who may mark it sent?
- Which acceptance evidence channels are sufficient for real pilot use: phone note, email, signed PDF, meeting note, or another channel?
- Can accepted price differ from sent quote total, and what reason/evidence is required?
- Should repeated acceptance be blocked, idempotent, or handled as correction?
- What rounding rule should be used for line totals, VAT, quote totals, and PDF display?
- Confirm VAT, ROT, grön teknik rates/caps, eligible bases, customer eligibility, BRF handling, schablon handling, and disclaimer text.
- Should hidden quote rows remain included in totals and tax deductions?
- What quote terms should be customer-visible, and who approves the wording?
- Which files are required before quote send and before quote acceptance?
- Which legacy records are live for pilot, archive-only, excluded, or deferred?
- Which Lovable examples are the golden-master fixtures for pilot cutover?

### Non-Blocking Before Prototype/Demo

- Which exact customer types should appear in Phase A UI?
- Is an anläggning required for every quote/job, or optional for small jobs?
- Should contacts be customer-wide, facility-specific, or both?
- Should one primary contact be enforced per customer, per facility, or not enforced?
- Are reusable articles required for pilot calculations, or are manual rows enough?
- Which calculation row types are essential on the first demo path?
- Should calculation sections support detailed, summary, and text-only display from the first prototype?
- Should options/tillval be accepted separately or only shown as optional additions?
- What margin warnings are useful enough for prototype/demo?
- Should quote sending be manual PDF/status tracking only, or should email sending be considered later?
- What should the basic accepted-quote record be called in UI: job, order, projekt, arbetsorder, or another term?
- Are planned start/end dates needed at acceptance time for prototype/demo?
- Is a standalone document center needed, or are entity-scoped files enough?
- What file types and size limits are acceptable for prototype/demo?

### Deferred Until External Beta or Later

- Which non-admin roles should exist beyond `tenant_admin`?
- What field-worker/mobile installer workflow is needed?
- What time/material/deviation/photo reporting is required?
- Is manual faktureringsunderlag review/export needed before Fortnox?
- When should Fortnox become active scope?
- Which supplier integrations are commercially necessary?
- Which AI, DoU, tender/FKU RAG, HR, rental, asset/QR, service-plan, warranty, or analytics modules are commercially justified?
- What external customer portal or public acceptance workflow is needed?
- What commercial subscription tiers, onboarding, offboarding, support, retention, backup/restore, and SLA model should exist?

## Assumption Register

| ID | Assumption | Status |
| --- | --- | --- |
| A1 | Phase A is Internal Pilot MVP only, not full commercial SaaS. | accepted for PRD |
| A2 | The Lovable app is a behavioral oracle only; code is not copied by default. | accepted for PRD |
| A3 | Pooled multi-tenancy is the default architecture. | accepted for PRD |
| A4 | Phase A implements `tenant_admin` only. | accepted for PRD |
| A5 | The old app remains fallback during coexistence. | accepted for PRD |
| A6 | Customer portal and public acceptance endpoints are out of Phase A. | accepted for PRD |
| A7 | Customers can have multiple facilities and contacts. | accepted for PRD |
| A8 | Articles are optional/minimal unless pilot calculations prove they are required. | accepted for PRD |
| A9 | Quote sending is manual PDF/status tracking unless owner promotes email sending. | accepted for PRD |
| A10 | The exact Phase A customer-type list needs owner confirmation. | needs owner confirmation before real pilot use |
| A11 | Facility/contact requiredness for quotes and jobs needs owner confirmation. | needs owner confirmation before real pilot use |
| A12 | Primary contact rule needs owner confirmation. | needs owner confirmation before real pilot use |
| A13 | Quote numbering display format needs owner confirmation. | needs owner confirmation before real pilot use |
| A14 | Acceptance channel/evidence semantics need owner confirmation. | needs owner confirmation before real pilot use |
| A15 | Accepted price adjustment policy needs owner confirmation. | needs owner confirmation before real pilot use |
| A16 | Job/order/projekt terminology needs owner confirmation. | needs owner confirmation before real pilot use |
| A17 | Required file rules before send/acceptance need owner confirmation. | needs owner confirmation before real pilot use |
| A18 | Live/archive/excluded legacy migration scope needs owner confirmation. | needs owner confirmation before real pilot use |
| A19 | VAT rate, VAT display, and rounding policy need accounting/legal confirmation. | needs accounting/legal confirmation before real pilot use |
| A20 | ROT rates, caps, eligible basis, persons/count, and customer eligibility need accounting/legal confirmation. | needs accounting/legal confirmation before real pilot use |
| A21 | Grön teknik rates, caps, categories, schablon handling, and BRF handling need accounting/legal confirmation. | needs accounting/legal confirmation before real pilot use |
| A22 | Customer-facing tax disclaimer text and quote terms need accounting/legal confirmation. | needs accounting/legal confirmation before real pilot use |
| A23 | Personnummer capture is excluded unless a later approved workflow proves it is necessary. | needs accounting/legal confirmation before real pilot use |
| A24 | Fortnox implementation is deferred. | deferred |
| A25 | Field-worker/mobile installer UX is deferred. | deferred |
| A26 | Supplier APIs are deferred. | deferred |
| A27 | AI jobs and tender/FKU RAG are deferred. | deferred |
| A28 | HR, rentals, assets/QR, DoU automation, service plans, warranties, notes/tickets, and full job/project analytics are deferred. | deferred |
| A29 | Full RBAC and non-admin roles are deferred. | deferred |
