---
stepsCompleted:
  - step-01-init
  - lightweight-phase-a-ux-spec
inputDocuments:
  - C:\ElproSaas\AGENTS.md
  - C:\ElproSaas\_bmad-output\planning-artifacts\prd.md
  - C:\ElproSaas\_bmad-output\project-context.md
  - C:\ElproSaas\docs\planning\saas-rebuild-phased-plan-2026-06-07.md
  - C:\ElproSaas\docs\discovery\e0-domain-oracle-report.md
  - C:\ElproSaas\docs\security\security-guardrails.md
  - C:\ElproSaas\docs\quality\quality-gates.md
documentCounts:
  productBriefs: 0
  prd: 1
  projectContext: 1
  projectDocs: 5
classification:
  projectType: saas_b2b_admin_app
  domain: swedish_electrical_contracting
  phase: Phase A - Internal Pilot MVP
  scope: tenant_admin_ux_only
---

# UX Design Specification - Elpro Phase A Internal Pilot MVP

**Author:** Rasmus  
**Date:** 2026-06-09  
**Artifact type:** Lightweight UX specification, not a design system

## Purpose And Boundary

This UX specification defines the Phase A tenant-admin experience for Elpro. It covers the smallest useful internal pilot workflow: CRM/settings/pricing -> calculation -> quote version/PDF -> acceptance -> basic job/order -> required files, with migration/coexistence support where needed.

The provided dashboard snippet is used only as layout inspiration: a restrained admin web app with a persistent side navigation on normal desktop/laptop screens, a compact top bar, dense-but-readable content, and clear primary actions. It is not a visual-design target and should not pull deferred modules into Phase A.

Product UI should use Swedish business terminology where it helps tenant admins work naturally, for example `Kunder`, `Anläggningar`, `Kontakter`, `Kalkyler`, `Offerter`, `Jobb/Order`, `Filer`, and `Inställningar`.

## 1. Phase A Information Architecture

Primary IA is a tenant-admin operations app, not a public site and not a broad ERP.

| Area | Status | Scope |
| --- | --- | --- |
| Dashboard | IN | Pilot overview, warnings, quote follow-ups, draft calculations, recent lifecycle activity. |
| CRM | IN | `Kunder`, `Anläggningar`, and `Kontakter` needed for calculations, quotes, and jobs. |
| Settings/Pricing | IN | Company identity, quote terms, VAT defaults/display, work roles, hourly rates, optional minimal articles. |
| Calculations | IN | Sections, rows, totals, margin/tax warnings, options, quote visibility, attachments, create quote version. |
| Quotes | IN | Quote versions, PDF preview/render status, sent lifecycle, acceptance evidence, immutable version history. |
| Jobs/Orders | IN | Basic job/order created from an accepted quote version. No field execution UX. |
| Files | IN | Entity-scoped files for CRM, calculations, quote PDFs/attachments/evidence, and basic job/order evidence. |
| Migration/Coexistence | IN/SEAM | Internal pilot support screens or reports for legacy fixture comparison, record classification, and fallback notes. |
| Audit/Event History | IN | Shown inside relevant record detail screens; standalone audit admin is optional unless required by stories. |
| Fortnox/Billing | DEFERRED/SEAM | Future boundary only. No OAuth, sync, retry UI, or accounting screens. |
| Field Worker, Supplier, AI, HR, Rentals, Assets, DoU, Tender/FKU, Full RBAC | DEFERRED | No navigation, tables, forms, placeholder screens, or production UX. |

Recommended top-level navigation:

1. `Dashboard`
2. `Kunder`
3. `Kalkyler`
4. `Offerter`
5. `Jobb/Order`
6. `Filer`
7. `Inställningar`
8. `Pilotstöd` or `Migrering` only if migration/coexistence workflows need app UI

## 2. Navigation Model

Desktop and laptop layout:

- Use a persistent left sidebar for primary navigation, similar in structure to the provided snippet but reduced to Phase A modules only.
- Keep the sidebar compact, with text labels and recognizable icons. The active section must be visually obvious and exposed to assistive tech.
- Use a slim top bar for tenant context, current user, alerts, and page-level primary actions such as `Ny kalkyl`, `Ny kund`, or `Skapa offertversion`.
- Use breadcrumbs or compact record headers on detail pages so admins can move between customer -> calculation -> quote -> job without losing context.
- Avoid nested sidebars. Use tabs inside detail pages for secondary views such as `Översikt`, `Rader`, `Filer`, `Händelser`, and `Versioner`.

Responsive behavior:

- At medium widths, collapse the sidebar to an icon rail with tooltips and keep the page title plus primary action visible.
- At small widths, use a drawer navigation and stack detail panes vertically.
- Tables should support horizontal scroll or switch to compact row cards only when necessary.
- Sticky summary panels in calculation/quote screens should become inline summary blocks below the editor on narrow screens.
- Phase A does not target installer mobile UX, but tenant-admin workflows must remain usable on common laptop widths and not break on tablet-sized screens.

Cross-navigation rules:

- Records should link forward and backward across the lifecycle: customer -> calculation -> quote version -> acceptance -> job/order.
- Lists should preserve filters, search, and pagination state when returning from detail screens.
- Lifecycle state should be visible everywhere the record appears: `Draft`, `Ready`, `Sent`, `Accepted`, `Job created`, `Correction needed`.

## 3. Page And Screen Inventory

| Screen | Purpose | Core UX requirements |
| --- | --- | --- |
| Dashboard | Tenant-admin landing page. | Show active calculations, sent quotes needing follow-up, warnings, recent acceptances/jobs, and migration/coexistence notices. Keep it operational, not analytics-heavy. |
| Customer list | Find and manage customers. | Search by name, email, phone, city, organization/customer number where allowed. Filter by customer type. Primary action: `Ny kund`. |
| Customer detail | Customer record hub. | Show facilities, contacts, calculations, quotes, jobs, files, and event history related to the customer. |
| Facility detail/modal | Manage `anläggning`. | Capture site name/address/type and linked contacts. Show related calculations/quotes/jobs. |
| Contact detail/modal | Manage `kontakt`. | Capture name, role, phone, email, customer/facility relation, and primary-contact marker if enabled. |
| Company settings | Maintain tenant quote identity. | Company name, address, contact details, logo/branding if needed for PDF, default VAT display, default quote terms. |
| Pricing settings | Maintain pricing inputs. | Work roles, cost/sell rates, active state, optional articles. Show source data used by calculations. |
| Quote terms settings | Maintain reusable terms. | Ordered editable terms with approval status or clear "requires owner/legal sign-off" warning before pilot use. |
| Calculation list | Manage calculations. | Search/filter by customer, status, owner/admin, updated date, quote status, warnings. Primary action: `Ny kalkyl`. |
| Calculation editor | Build and review a calculation. | Section/row editor, totals, VAT/tax assumptions, margin warnings, quote visibility, attachments, readiness checks, create quote version. |
| Calculation readiness review | Pre-quote checkpoint. | Summarize blocking issues and warnings before quote version creation. |
| Quote list | Manage quotes and follow-ups. | Filter by status, customer, sent date, follow-up date, accepted/rejected state. Surface versions and latest status. |
| Quote detail | Quote lifecycle hub. | Version timeline, selected snapshot, PDF preview/status, sent lock state, acceptance state, files, events. |
| Quote PDF preview | Review customer-facing output. | Render from quote version snapshot only. Show generation state, failures, and selected attachments. |
| Mark sent confirmation | Commit customer-visible version. | Confirm that the version becomes immutable and capture sent timestamp/channel/reference if needed. |
| New quote version flow | Change after send. | Explain why a new version is required, prefill from revised calculation/snapshot, preserve old sent versions. |
| Acceptance capture | Record off-system acceptance. | Capture channel, timestamp, evidence, accepted price, adjustment reason if needed, notes, planned dates, and create job/order confirmation. |
| Job/order list | See accepted work records. | Show jobs created from accepted quotes, status, customer, planned dates, accepted value, source quote version. |
| Job/order detail | Basic accepted-work hub. | Show immutable source quote/acceptance, customer/facility/contact, planned dates, value, files, and event history. |
| Entity file panel | Manage files in context. | Upload, preview/download via signed URL, purpose, quote inclusion, evidence status, delete/archive audit. |
| Limited file index | Find Phase A files. | Optional. Only index CRM/calculation/quote/job files. Do not become a broad document center. |
| Pilot coexistence view/report | Support shadow comparison. | Show fixture comparison status, old/new deltas, legacy record classification, and fallback notes if required by pilot stories. |

## 4. End-To-End Tenant-Admin Workflow

1. Tenant admin signs in and lands on `Dashboard`.
2. Admin confirms `Inställningar`: company identity, quote terms, VAT display, work roles, and optional articles.
3. Admin creates or selects a `Kund`.
4. Admin adds or selects an `Anläggning` and `Kontakt` where needed.
5. Admin creates a `Kalkyl` from customer context.
6. Admin edits calculation sections and rows, including labor, material, subcontractor, machinery, other costs, options, visibility, notes, and attachments.
7. Admin resolves blocking calculation readiness issues and reviews warnings for margin, missing CRM context, VAT, ROT/grön teknik, hidden rows, and required files.
8. Admin creates a quote version from a snapshot and reviews PDF output.
9. Admin marks the quote version as sent. The UI must make the immutability consequence explicit.
10. If customer-visible content changes after send, admin creates a new quote version instead of editing the sent one.
11. When the customer accepts off-system, admin records acceptance evidence and accepted price. The system creates the basic `Jobb/Order` from the accepted quote version.
12. Admin can trace the job/order back to the immutable accepted quote version, acceptance evidence, files, and event history.

## 5. Calculation Editor UX Requirements

Core layout:

- Use a work-focused editor with a record header, customer context, status, and primary actions.
- The main workspace should support sectioned line editing and a persistent totals/readiness summary on desktop.
- Recommended desktop layout: left or top section index, central row editor, right summary panel. On narrower screens, section index and summary stack above/below the row editor.
- Keep money, margin, VAT, and tax deduction feedback visible without forcing admins to leave the editor.

Row and section behavior:

- Support section create, rename, reorder, duplicate if useful, and delete with confirmation where rows would be removed.
- Support row types: labor, material, subcontractor, machinery, and other.
- Support manual rows and source-based rows from work roles/articles where articles are included in Phase A.
- Show quantity, unit, unit cost/sell price, markup or margin, VAT rate/display, total, quote-visible label/description, internal note, and quote-visible note where applicable.
- Support options/tillval as explicitly separate from base total. The editor must show whether options are included in base total, quote display, and acceptance semantics.
- Support quote visibility controls for rows/sections, including detailed, summary, and text-only display if stories confirm those modes.

Readiness and safety:

- Show blocking issues separately from warnings.
- Blocking issues should prevent quote version creation only where they would create unsafe or incomplete customer commitments.
- Warnings should cover low margin, missing customer/facility/contact where relevant, empty sections, zero-price rows, missing work role on labor rows, unresolved VAT/tax assumptions, ROT/grön teknik confirmation, hidden rows included in totals, and missing required files.
- Use integer-money and rounding concepts in labels and review summaries only where admins need to understand them; do not expose internal implementation jargon in everyday row editing.
- Before quote version creation, show a snapshot review: customer/facility/contact, sections, visible lines, hidden-in-quote handling, options, totals, VAT, tax deduction assumptions, terms, selected attachments, and warnings captured at snapshot time.

Change model:

- Draft calculations remain editable.
- Creating a quote version does not freeze the calculation, but the quote version must show that it is a snapshot.
- If a sent quote already exists, calculation changes should clearly indicate that customer-visible changes require a new quote version.

## 6. Quote Version, PDF, And Acceptance UX Requirements

Quote detail layout:

- Show a lifecycle header with quote status, customer, latest version, sent/accepted state, and source calculation.
- Show a version timeline with `Draft`, `Sent`, `Accepted`, `Rejected/Lost`, and `Superseded` states as applicable.
- Selecting a version should show its immutable snapshot: lines, totals, VAT/tax assumptions, terms, attachments, PDF metadata, and lifecycle events.

PDF requirements:

- PDF preview must render from the selected quote version snapshot, not mutable customer/settings/calculation data.
- Show generation status: not generated, generating, generated, failed, stale draft preview if applicable.
- For generated PDFs, expose preview/download and file metadata.
- Attachment selections must be visible before send, including inline vs appendix behavior where supported.
- If PDF generation fails, show the failure state and retry action without changing lifecycle state.

Sending/versioning requirements:

- Marking a quote as sent requires confirmation that the selected version becomes immutable.
- Sent version UI must disable customer-visible editing and direct users to `Create new version` for changes.
- New version creation should explain what changed and preserve the previous sent version for comparison.
- Internal notes can remain editable if they do not affect customer-visible commitments, but the UI must visually separate them from quote snapshot content.

Acceptance requirements:

- Acceptance is recorded by tenant admin from an off-system channel. There is no customer portal or public acceptance endpoint in Phase A.
- Capture acceptance channel, accepted timestamp, admin user, evidence file/reference, accepted price, optional adjustment amount/reason, notes, and planned dates if available.
- If accepted price differs from sent quote total, require explicit reason/evidence and show the delta before confirmation.
- Acceptance confirmation should state that acceptance evidence and accepted version become immutable except through an audited correction workflow.
- Successful acceptance should create or link a basic job/order in the same user-facing flow.
- Repeating acceptance/create-job should show the existing accepted state/job instead of creating duplicates.

Correction requirements:

- Corrections after acceptance are not normal edits. UX should route them through a clearly labeled audited correction path once stories define the policy.
- Until correction policy exists, show accepted records as locked with a note that corrections require approved admin workflow.

## 7. Basic Job/Order UX Requirements

Scope:

- Phase A job/order UX exists only to represent work created from an accepted quote.
- It is not a field-worker schedule, time report, material report, deviation, project analytics, ÄTA, or invoice workflow.

Creation:

- Job/order creation should happen from acceptance, not as an unrelated manual workflow unless a story explicitly requires manual creation.
- The creation confirmation should show source quote version, accepted price, customer, facility/contact, planned dates, and files/evidence carried forward.
- If job/order already exists for the accepted quote version, show the existing record and prevent duplicate creation.

Detail screen:

- Show source quote version and acceptance evidence prominently.
- Show customer, facility, contact, title, basic status, accepted value, planned start/end, files, and event history.
- Allow only Phase A-safe edits, such as basic title/status/planned dates if stories approve. Never allow edits that rewrite accepted quote evidence.
- Provide navigation back to quote, calculation, and customer.

List screen:

- Filter by customer, status, planned date, and source quote.
- Surface records with missing planned dates or missing required job evidence if those become Phase A checks.

## 8. File And Attachment UX Requirements

Model:

- Files are managed primarily in entity context: customer, facility, calculation, quote version, acceptance, and job/order.
- A limited file index can exist for tenant-admin findability, but broad document-center behavior is not Phase A unless re-approved.

Upload and metadata:

- Every upload interaction must show allowed file types, size expectations, owner/entity, and purpose.
- File metadata should expose display name, purpose, MIME/type, size, uploaded by, uploaded at, lifecycle state, and owning record.
- Upload errors must distinguish blocked type, oversize, network/server failure, and permission/tenant access failure.
- The UI must not ask users to enter storage paths.

Quote and acceptance files:

- Calculation attachments can be selected for quote output.
- Quote attachment selections must be snapshotted or locked when the quote version is sent.
- Quote PDFs should appear as generated files tied to the quote version.
- Acceptance evidence files/references must become immutable after acceptance except through audited correction.

Access and deletion:

- Downloads/previews should use short-lived access links. Expired links should refresh through normal UI action.
- Deleting or archiving files should require confirmation where the file is linked to a quote/job lifecycle.
- Deletion/archive state must be visible in the event history.
- Cross-tenant access failures should produce a generic permission error, not reveal whether another tenant's file exists.

## 9. Validation, Error, Empty, And Loading States

Global patterns:

- Put validation errors next to the field and summarize blocking errors at the top of forms or review panels.
- Separate blocking errors from warnings.
- Use plain language, with enough detail for the admin to resolve the issue.
- Do not rely on color alone. Pair status color with icon/text.
- Preserve unsaved form data when validation fails.

Key states:

| Area | Required states |
| --- | --- |
| Dashboard | Empty pilot state, no follow-ups, warnings present, loading cards, failed summary load. |
| CRM | No customers, no search results, duplicate-like customer warning, invalid email/phone/org number format, missing required display name. |
| Settings/Pricing | Missing company identity, unapproved quote terms, inactive work role used by old rows, invalid price/margin, VAT/tax sign-off warning. |
| Calculation editor | Autosave/saved/unsaved indicators, row validation, empty section, low margin warning, zero total warning, missing CRM context, unresolved tax assumptions. |
| Quote version | Draft, ready, PDF generating, PDF failed, sent locked, superseded, accepted locked, new version available. |
| Acceptance | Missing evidence, invalid accepted price, adjusted price reason required, duplicate acceptance/job detected, transaction failed with no partial job created. |
| Job/order | Created from quote, missing planned dates, source quote locked, job already exists, unsupported edit blocked. |
| Files | Uploading, virus/security validation pending if implemented later, invalid type, oversize, signed URL expired, deleted/archived, permission denied. |
| Migration/coexistence | No fixtures yet, comparison pending, delta found, fallback required, record classified live/archive/excluded/deferred. |

Lifecycle errors:

- When an action is blocked by immutability, explain the lifecycle rule and offer the correct next action, such as `Create new quote version`.
- When an action is blocked by tenant/security policy, show a generic access message and avoid exposing cross-tenant record details.
- When a command fails after confirmation, the UI should state whether no changes were saved or whether a retry is safe.

## 10. Accessibility And Usability Requirements

- The app must be usable with keyboard navigation across sidebar, top actions, tabs, tables, row editors, dialogs, and file controls.
- Every icon-only control needs an accessible name and visible tooltip or equivalent help.
- Form controls require labels, helpful descriptions where needed, and programmatic error association.
- Focus must move predictably when opening/closing dialogs, adding rows, creating versions, and completing acceptance.
- Text should remain readable on laptop screens; avoid cramped row controls that hide money/tax values.
- Tables and editors must not require horizontal precision dragging for core work.
- Status badges must include text, not only color.
- PDF preview/download controls must remain accessible even if the preview canvas or embed is unavailable.
- Responsive layouts must prevent overlapping controls, clipped labels, and unreachable actions.
- Use clear Swedish domain labels in the product UI while keeping validation messages concise and operational.
- Avoid mobile-first installer assumptions; this is a tenant-admin browser workflow.

## 11. Explicit Non-Goals

The Phase A UX must not include:

- Fortnox OAuth, sync status, retry UI, external accounting mappings, or invoice workflows.
- Field-worker/mobile installer UX.
- Supplier APIs, supplier credentials, automated supplier imports, or live price sync.
- AI jobs, autonomous AI mutation, tender/FKU RAG, or AI document workflows.
- HR, rentals, assets/QR, DoU automation, service-plan automation, warranties, or broad project analytics.
- Full RBAC, role-management UI, installer/project-manager/economy portals, or permission matrix UX beyond `tenant_admin`.
- Customer portal, public quote acceptance page, public privileged endpoints, or unauthenticated lifecycle actions.
- High-fidelity visual design, brand system, component library, or final PDF visual layout.
- Broad document center across deferred modules.
- Placeholder screens or navigation items for deferred modules.

## 12. Questions And Assumptions For Architecture Or Stories

Conservative UX assumptions:

- Phase A has one product role: `tenant_admin`.
- The first-screen app layout uses a left side navigation on desktop/laptop, inspired by the provided dashboard snippet but reduced to Phase A scope.
- Quote sending is manual PDF/status tracking unless a later story approves email sending.
- Acceptance is recorded by tenant admin from off-system evidence; there is no customer portal.
- Files are entity-scoped by default; a limited file index is optional.
- The basic accepted-work record is labeled `Jobb/Order` until owner chooses final terminology.
- `Anläggning` and `Kontakt` should be encouraged in the workflow but not treated as universally mandatory until owner confirms requiredness.
- Articles remain optional/minimal unless pilot calculations prove reusable material rows are needed.
- Migration/coexistence support can be a report or internal support view, not necessarily a full product module.

Questions to pass forward:

1. What final UI term should Phase A use for the accepted work record: `jobb`, `order`, `projekt`, `arbetsorder`, or another label?
2. Which customer types must appear in Phase A CRM on day one?
3. Is `anläggning` required for every quote/job, or optional for small work?
4. Should contacts be customer-wide, facility-specific, or both? Is one primary contact required?
5. Are reusable articles required for the pilot, or are manual material rows enough?
6. Should hidden quote rows remain included in totals, VAT, ROT, and grön teknik calculations?
7. Should options/tillval be accepted separately or only displayed as optional additions?
8. What exact event makes a quote `sent`, and should sent timestamp/channel/reference be captured?
9. What quote number display format should be shown in UI/PDF?
10. Which acceptance channels are sufficient for real pilot use: email, phone note, signed PDF, meeting note, or other?
11. Can accepted price differ from the sent quote total, and what evidence/reason is required?
12. What required files must exist before quote send, quote acceptance, and job/order creation?
13. Should PDF generation be synchronous for pilot-sized quotes, or should UX assume an async wait/retry state?
14. Which VAT, ROT, grön teknik, rounding, caps, eligibility, and customer-facing disclaimer rules have owner/accounting/legal sign-off?
15. Which legacy records are live, archive-only, excluded, or deferred for the internal pilot?
16. Which Lovable examples are the golden-master UX/behavior fixtures for calculation, quote PDF, acceptance, files, and job creation?
