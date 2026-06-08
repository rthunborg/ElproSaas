# E0 Domain-Oracle Report

Date: 2026-06-08

Mode: read-only discovery. This report treats the existing Lovable app as a behavioral oracle only. It does not recommend copying Lovable code into the rebuild.

Scope: Phase A / Internal Pilot MVP only.

Out of scope unless re-approved: Fortnox implementation, field-worker/mobile installer UX, supplier APIs/import automation, AI jobs, HR, rentals, assets/QR, DoU automation, tender/FKU RAG, full RBAC, and public privileged endpoints.

## 1. Executive Summary

The Lovable app contains useful Phase A behavior for CRM, settings/pricing, calculations, quote/PDF generation, quote acceptance, basic job creation, and required files. It also contains large deferred areas and security patterns that must not be ported.

The strongest reusable input is not implementation code. It is the workflow shape, terminology, edge cases, and golden-master fixture candidates. The rebuild should capture representative anonymized fixtures from the Lovable behavior, then implement Phase A with a smaller pooled-tenant model, `tenant_admin` only, server-side commands for sensitive mutations, integer öre money, immutable quote versions, and private tenant-owned file metadata.

Key E0 conclusions:

- Current tenancy is based on `profiles.company_id` and broad `user_roles`; Phase A needs a tenant membership model with `tenant_admin` only.
- Current money/tax behavior uses JS `number`, database `numeric` kronor values, hardcoded 25% VAT, and code constants for ROT/grön teknik. Phase A needs integer öre storage, explicit rounding policy, snapshotted tax assumptions, and owner/accounting approval.
- Current quote versions are mutable rows, and acceptance evidence lives on a mutable quote row. Phase A needs immutable sent/accepted quote versions and immutable acceptance evidence with correction/audit rules.
- Current accepted-quote-to-job behavior is useful as a workflow oracle but is client-side and non-transactional. Phase A should implement it as one server-side, audited transaction.
- Current file behavior is useful for attachment selection and PDF appendix/inline behavior, but storage/file metadata must be redesigned around private buckets, tenant-owned metadata, and negative RLS/storage tests.
- Deferred modules are present throughout routing, schema, Edge Functions, and file indexing. E0 fixtures and Phase A PRD inputs must explicitly exclude them.

Subagent coverage:

- `legacy-oracle-explorer`: completed.
- `money-tax-reviewer`: completed.
- `security-rls-reviewer`: completed.
- `test-gap-reviewer`: completed.
- `phase-scope-reviewer`: not spawned due agent thread limit; scope review was performed locally while drafting this report.

## 2. Phase A Workflow Map

Recommended Phase A workflow map from the Lovable oracle:

1. Tenant admin signs in and works inside one pooled tenant.
2. Tenant admin configures company identity, default VAT display, minimum margin warning, quote follow-up default, work roles, optional articles, and quote terms.
3. Tenant admin creates or selects a kund, optional anläggning, and optional kontakt.
4. Tenant admin creates a calculation from CRM entities.
5. Tenant admin adds calculation sections, rows, labor roles, articles/manual rows, options/tillval, quote visibility choices, notes, and required attachments.
6. Calculation totals, margin warnings, VAT display, ROT/grön teknik estimates, and quote-readiness warnings are computed and shown.
7. Tenant admin creates a quote version from a calculation snapshot.
8. Quote version renders PDF using snapshot terms, company/customer context, selected rows, options, attachments, and tax deduction breakdown.
9. Tenant admin sends or marks the quote sent. From this point Phase A should make the sent quote version immutable.
10. Tenant admin records quote acceptance with channel, timestamp, evidence reference, agreed customer price, optional adjustment reason, and planned dates.
11. The system creates a basic job/order from the accepted quote version in the same transaction.
12. Required files remain attached to the relevant calculation/quote/job through tenant-owned file metadata and private storage.
13. Migration/coexistence uses anonymized golden-master fixtures and shadow comparison before pilot cutover.

## 3. Current Lovable Files/Modules Inspected

Required baseline and guardrail docs:

- `AGENTS.md`
- `_bmad-output/project-context.md`
- `docs/planning/saas-rebuild-phased-plan-2026-06-07.md`
- `docs/security/security-guardrails.md`
- `docs/initial-system-audit-2026-06-01.md`

Phase A source files inspected as behavior oracle:

- Auth/tenant: `src/contexts/AuthContext.tsx`, `src/App.tsx`, `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`
- CRM: `src/pages/Customers.tsx`, `src/pages/CustomerDetail.tsx`, `src/pages/FacilityDetail.tsx`, `src/components/customers/QuickCreateCustomerDialog.tsx`, `src/components/customers/CustomerTypeBadge.tsx`, `src/components/facilities/EditFacilityDialog.tsx`, `src/components/facilities/QuickFacilityDialog.tsx`, `src/components/contacts/EditContactDialog.tsx`, `src/components/contacts/QuickContactDialog.tsx`
- Settings/pricing: `src/pages/Admin.tsx`, `src/pages/Articles.tsx`, `src/components/QuoteTermsEditor.tsx`, `src/lib/quote-defaults.ts`
- Calculations: `src/pages/Calculations.tsx`, `src/pages/CalculationDetail.tsx`, `src/lib/tax-deductions.ts`, `src/components/quotes/TaxDeductionBreakdown.tsx`
- Quotes/PDF/acceptance: `src/pages/Quotes.tsx`, `src/pages/QuoteDetail.tsx`, `src/components/QuotePreview.tsx`, `src/components/QuoteDocument.tsx`, `src/lib/quote-pdf.ts`, `src/lib/quote-acceptance.ts`, `src/components/quotes/AcceptQuoteDialog.tsx`, `src/components/quotes/AcceptanceCard.tsx`, `src/components/quotes/QuoteAttachmentsSelector.tsx`
- Jobs/orders: `src/pages/Jobs.tsx`, `src/pages/JobDetail.tsx`, `src/components/jobs/CreateJobDialog.tsx`, `src/lib/jobStatus.ts`
- Files/documents: `src/components/AttachmentsPanel.tsx`, `src/lib/attachments.ts`, `src/pages/Documents.tsx`

Phase A relevant database and function files inspected as behavior/risk oracle:

- `supabase/config.toml`
- `supabase/migrations/20260505113101_bf7c2574-0476-432a-8da8-c978fc404dd0.sql`
- `supabase/migrations/20260505121017_962f2608-87b3-4b43-ba67-4c05e671824e.sql`
- `supabase/migrations/20260505121029_445835da-0009-42b9-b76d-f724f143439b.sql`
- `supabase/migrations/20260505123552_5fe03a55-3bd7-499f-9c0d-8db17d423c6c.sql`
- `supabase/migrations/20260511065918_e0bf889b-47e2-433b-8406-c52a349f5052.sql`
- `supabase/migrations/20260505122000_89b61be4-9ee9-4f5f-8cc8-b6d761cb5c5a.sql`
- `supabase/migrations/20260513081829_888d53d3-8a1b-4c5a-9b69-c9931cfeba3a.sql`
- `supabase/migrations/20260513090528_e667f965-0a48-4091-95d7-9fe27de26e10.sql`
- `supabase/migrations/20260513092633_7fd2e3fd-e821-4401-8a27-b4325191cd90.sql`
- `supabase/migrations/20260513093945_16077f84-3e6f-47e5-aabb-ddb7248f02a3.sql`
- `supabase/migrations/20260513103720_a4f01996-c888-4cb6-a4d2-511b9fe343e3.sql`
- `supabase/migrations/20260513180954_302b63a4-474b-4e94-853a-e774a0f8ead3.sql`
- `supabase/migrations/20260513184116_927a94e4-b9a4-46d1-b0eb-782f01e0ff7d.sql`
- `supabase/migrations/20260526162147_2e43e95b-9138-46d7-86c8-9a6c062c3c1b.sql`
- `supabase/migrations/20260526164140_51b02bcb-4a9f-44f7-99df-dda790a13e24.sql`
- `supabase/migrations/20260526170016_eafda7bc-3f82-4f66-86b6-71212a6a448a.sql`
- `supabase/migrations/20260527112933_e5f7c610-e671-45d9-a218-6aadb24afc88.sql`
- `supabase/functions/_shared/cronAuth.ts`
- `supabase/functions/manage-users/index.ts`
- `supabase/functions/customer-personnummer/index.ts`
- `supabase/functions/convert-tender/index.ts`

Deferred modules were inspected only enough to classify them as out of scope or unsafe to port.

## 4. Domain Entities and Terminology Observed

| Observed term | Meaning in Lovable oracle | Phase A treatment |
| --- | --- | --- |
| Company | Current tenant-like owner of data; stored as `companies` and reached through `profiles.company_id`. | Replace with pooled `tenants` or equivalent approved tenant model. |
| User roles | `admin`, `projektledare`, `installatör`, `ekonomi`. | Do not port full RBAC. Phase A is `tenant_admin` only. |
| Kund | Customer account; types include private, company, BRF, foundation, public sector. | In scope, but owner must confirm exact customer types needed for pilot. |
| Anläggning | Customer facility/site with address and type. | In scope for calculations/quotes/jobs. |
| Kontakt | Customer or facility contact, optional primary contact. | In scope. |
| Artikel | Internal article/pricing item. | Optional/minimal in Phase A. Supplier import/API behavior is deferred. |
| Work role | Labor role with cost and sell hourly rate. | In scope as pricing input, but calculation/quote must snapshot rates. |
| Kalkyl | Calculation with sections, rows, options, tax deduction choice, notes, attachments. | In scope. |
| Sektion | Calculation/quote grouping. Quote display modes include detailed, summary, text-only. | In scope if owner confirms value. |
| Rad | Calculation line with quantity, unit, cost type, price, markup, visibility, option flag. | In scope, with integer money and tests. |
| Tillval | Option rows excluded from base quote total and displayed separately. | In scope if owner confirms quoting behavior. |
| Offert | Quote generated from calculation snapshot. | In scope, but Phase A needs immutable quote versions. |
| Quote version | Current Lovable uses repeated `quotes` rows with `version` and `parent_quote_id`. | Redesign as immutable version/snapshot model. |
| Acceptance | Channel/evidence/agreed price/planned dates on quote row. | In scope, but acceptance evidence should be immutable/audited. |
| Job/order/projekt | Basic job created from accepted quote; full job UX is broad. | Only basic accepted-quote-to-job creation is in scope. |
| Required file/document | Attachments, quote selections, PDF appendices, file index. | In scope only for Phase A entities and private tenant-owned metadata. |
| ROT/grön teknik | Tax deduction estimates and validation. | In scope only after owner/accounting confirmation and golden tests. |

## 5. CRM Behavior Summary

Observed CRM behavior:

- Customer list supports search by name, organization number, email, city, phone, and favorite ordering.
- Customer types include private, company, BRF, foundation, and public sector.
- Customer fields include name, organization number where applicable, address, postal code, city, phone, email, notes, favorite, and created-by user.
- The current app has a sensitive personal-number flow for private/BRF customers through an Edge Function. The value is not displayed in normal UI. Phase A should not include this by default unless owner/accounting approves it as necessary.
- A customer can have multiple facilities.
- Facility fields include name, address, postal code, city, facility type, and description.
- A customer can have contacts. A contact can be customer-level or associated to a facility.
- Contact fields include name, phone, email, role, optional facility, and primary-contact flag.
- When one contact is marked primary, the current dialog unsets other primary contacts for that customer.
- Calculations and quotes can reference customer, facility, and contact.

CRM owner decisions needed:

- Which customer types are needed in Phase A?
- Is an anläggning required for every quote/job, or optional for small private jobs?
- Should contacts be customer-wide, facility-specific, or both?
- Should any personal-number capture be excluded until invoicing/SKV work?

## 6. Settings/Pricing Behavior Summary

Observed settings/pricing behavior:

- Company settings include name, organization number, address, postal code, city, phone, email, website, logo, and brand colors.
- Calculation settings include minimum margin percent, default VAT display preference, and quote follow-up days.
- Work roles have name, cost hourly price, sell hourly price, active flag, and derived margin display.
- Articles have article number, name, description, unit, price excluding VAT, and supplier label.
- Quote terms are editable ordered sections with title and content.
- Default quote terms exist in source. They contain company/person-specific text and must not be reused without anonymization and owner approval.
- Supplier import/automation surfaces exist but are deferred.

Phase A implications:

- Company/settings/pricing is in scope, but it should be small and tied to exact calculation/quote needs.
- Prices used in calculations and quotes must be snapshotted when used.
- Work role and article source metadata should be captured enough to explain where a quoted price came from.
- Quote terms should be tenant-owned and versioned/snapshotted into each sent quote version.

## 7. Calculation Behavior Summary

Observed calculation behavior:

- A calculation is created from name, customer, optional facility, optional contact, and tax deduction type.
- Statuses include draft/active/quoted/won/lost/archived in current behavior.
- Sections group calculation rows.
- Rows support cost types: material, labor, subcontractor, machinery, and other.
- Row total cost is quantity multiplied by unit price. Row sell total is total cost plus markup percent.
- Margin/TG conversion is shown in UI.
- Labor rows can be populated from work roles. The current row stores role id and prices, but not a full immutable source snapshot.
- Material/article rows can be populated from articles. The current row stores article id and prices, but not a full immutable source snapshot.
- Options/tillval are excluded from the base quote total and tracked separately.
- Rows can be hidden in quote output while still being included in the base total.
- Quote display mode per section can be detailed, summary, or text-only.
- Notes can be internal or quote-visible.
- Attachments can be added to the calculation and selected later for quote output.
- Warnings include missing customer/facility, low margin, empty sections, zero-price rows, and labor rows without work role.
- VAT display is a UI/display setting, but current computations use hardcoded 25%.

Phase A implications:

- Calculation totals need unit and golden-master tests before implementation is considered safe.
- Money should be represented as integer öre, not JS number kronor.
- VAT rate, tax deduction assumptions, work role rates, article prices, terms, and customer-facing display settings should be snapshotted for quote versions.
- Owner must decide whether hidden quote rows should remain included in totals and deductions.

## 8. Quote/PDF/Acceptance Behavior Summary

Observed quote behavior:

- Quotes are created from calculation snapshots.
- Current quote number generation is client-side and date/count based. This is a race risk; Phase A should generate tenant-scoped quote numbers server-side.
- Quote content stores section and row snapshots, option totals, tax deduction amount, terms, intro/notes, display VAT mode, and row category visibility toggles.
- Quote PDF/document output includes company identity, customer/facility/contact block, section output, hidden-row filtering, cost-type visibility filtering, options, totals, tax deduction breakdown, terms, and attachments.
- VAT display modes include excluding VAT, including VAT, or both.
- Quote attachments are selected from calculation attachments, with inline or appendix display.
- Current quote versions are additional mutable rows in `quotes` with `version` and `parent_quote_id`.
- New version creation recalculates some totals from content but carries forward the old deduction amount, which can create inconsistent tax totals.
- Quote acceptance records accepted timestamp, accepted-by, channel, notes, evidence URL/file name, agreed customer price, discount/reason, and planned dates.
- Acceptance can create/update a linked job and optional first schedule phase.

Phase A implications:

- Draft quote can remain editable, but sent and accepted quote versions should be immutable.
- PDF output should be generated from a quote version snapshot, not current mutable calculation/customer/settings state.
- Acceptance evidence should be immutable after initial capture, with a deliberate correction flow if needed.
- Quote acceptance and job creation should be a single audited transaction.
- Quote terms and any customer-facing tax disclaimer need owner approval and fixture coverage.

## 9. Basic Accepted-Quote-To-Job Behavior Summary

Observed job behavior:

- A job can be created manually as order or project.
- Accepted quote flow creates or updates a job tied to the quote through `auto_created_from_quote_id`.
- Job fields include type, status, title, customer, facility, contact, calculation, quote, project manager, planned dates, budget totals, and created-by metadata.
- Current job schema and UI are much broader than Phase A, including members, work orders, schedule, economy, diary, deviations, photos, risk, reports, analytics, ÄTA, and project upgrades.

Phase A treatment:

- Include only basic job/order creation from an accepted quote.
- Source the job from an immutable accepted quote version and acceptance event.
- Preserve agreed customer price and source quote budget as a snapshot.
- Prevent duplicate jobs from repeated accept/create attempts.
- Defer full job/project/field-worker UX, ÄTA workflows, time/material, scheduling depth, and analytics.

## 10. Required File/Document Behavior Summary

Observed file/document behavior:

- Calculation attachments support image/PDF file types, labels, display modes, sort order, signed URL preview/download, upload, soft delete, and quote selection.
- Quote attachment selection can include/exclude calculation attachments and override display mode.
- Images can be displayed inline in quote/PDF output; PDFs can be appended as appendices.
- Quote attachment edits are locked only when quote status is accepted in current behavior.
- A broad `file_index` table indexes files across many modules, including deferred modules.
- Current file center includes broader document browsing and module groupings.

Phase A treatment:

- Required files should be limited to Phase A entities: calculation, quote version/PDF/evidence, basic job/order, and CRM references if needed.
- Storage buckets should be private.
- File paths should be server-derived and tenant-owned, not trusted from client input.
- File metadata should include tenant, owning entity, display purpose, MIME/type, size, version/current flag if needed, uploader, timestamps, and deletion audit.
- Sent/accepted quote files and attachment selections should be immutable or captured as snapshot evidence.
- Broad file center features and deferred module indexing should not be ported unless approved.

## 11. Money/Tax/ROT/Grön Teknik Rules Observed

Observed money and tax behavior:

- Current calculations and quotes use JS `number` and database `numeric` values that appear to be kronor, not integer öre.
- VAT is hardcoded at 25% in calculation, quote, PDF, and tax deduction paths despite company VAT settings existing.
- Base quote totals exclude option rows.
- Customer price is total including VAT minus deduction amount.
- Hidden quote rows and cost-type visibility affect rendering, but hidden rows can still remain in totals.
- ROT uses labor rows only.
- ROT observed formula: labor excluding VAT -> labor including VAT at 25% -> 30% deduction -> cap at 50,000 SEK per person.
- Grön teknik groups rows by category: solar, battery, charging point.
- Grön teknik observed rates: solar 15%, battery 50%, charging point 50%.
- Grön teknik observed cap: 50,000 SEK per person.
- Grön teknik has optional 3% schablon reduction before applying category rate.
- ROT and grön teknik cannot be mixed.
- Current validation allows private/BRF customer paths and warns around BRF green-tech behavior.

Phase A requirements before relying on these rules:

- Owner/accounting must confirm current legal rates, caps, eligible bases, customer eligibility, BRF handling, and disclosure language.
- Store money as integer öre.
- Define line-level vs document-level rounding.
- Snapshot VAT rate, deduction rates, caps, number of persons, schablon choice, customer eligibility assumptions, and display language into the quote version.
- Add golden-master fixtures for regular VAT, ROT, grön teknik, caps, missing categories, invalid mixes, options, hidden rows, fractional quantities, and rounding.

## 12. Golden-Master Fixture Candidates

Recommended anonymized Phase A fixture set:

- Two tenants with similarly shaped CRM data to prove tenant isolation.
- Customer fixture with private customer, company customer, BRF customer, multiple facilities, customer-level contacts, facility-level contacts, and one primary contact.
- Settings fixture with company identity, VAT display default, minimum margin, follow-up days, work role, article, and approved quote terms.
- Basic calculation fixture with material, labor, subcontractor, other, fractional quantity, decimal price, margin, section grouping, internal note, quote-visible note, and attachment.
- Work-role calculation fixture proving cost/sell rate snapshot.
- Article calculation fixture proving source article snapshot.
- Option/tillval fixture proving base total excludes options and customer-facing option output is stable.
- Hidden-row fixture proving whether hidden rows remain in totals and tax deductions.
- Section display fixture covering detailed, summary, and text-only sections.
- ROT fixture with labor-only rows, mixed labor/material, zero labor, cap exceeded, multiple persons, customer-type validation, and rounding.
- Grön teknik fixture with solar, battery, charging point, schablon on/off, cap exceeded, missing categories, BRF warning, and invalid ROT mix.
- Quote PDF fixture covering VAT display modes, terms, intro text, options, attachment inline image, attachment appendix PDF, tax deduction block, and customer price.
- Quote lifecycle fixture covering draft, sent immutable v1, changed calculation, v2, rejected/lost reason, accepted quote, and evidence capture.
- Accepted-quote-to-job fixture covering unchanged price, adjusted accepted price with reason, planned dates, idempotency, and rollback on failure.
- File fixture covering allowed MIME, blocked MIME, oversize file, signed URL expiry, deleted file, cross-tenant path spoofing, and immutable quote evidence.
- Migration/coexistence fixture covering anonymized legacy CRM, active/draft calculation, sent quote, accepted quote, job transition, selected attachments, and old/new totals comparison.

Privacy requirement: fixtures must contain anonymized structure only. Do not include real names, phone numbers, emails, addresses, personal numbers, organization numbers, secrets, or raw customer files.

## 13. Migration/Coexistence Candidates

Recommended Phase A migration/coexistence candidates:

- Export anonymized structures for active pilot customers, facilities, contacts, settings, pricing roles, articles if used, active calculations, sent/accepted quotes, required files, and basic accepted-quote jobs.
- Classify legacy records as live, archive-only, or excluded/deferred.
- Produce shadow comparison reports for calculation totals, quote totals, tax deduction estimates, PDF text blocks, accepted price, and job creation outcome.
- Maintain old app fallback until selected Phase A workflows pass golden-master and owner sign-off.
- Use migration dry runs with empty target database reset once Phase A migrations exist.
- Keep deferred module data out of Phase A v0 schema unless explicitly re-approved by ADR.
- Treat Lovable PDFs/quotes as oracle artifacts for comparison, not as code templates.

Deferred/excluded migration areas unless re-approved:

- Fortnox records and integrations.
- Field-worker/mobile UX data.
- Supplier import/API records.
- AI/tender/FKU/RAG flows.
- HR and anonymous suggestion/GDPR flows.
- Rentals, assets/QR, DoU automation, service-plan automation, full job/project analytics, and full RBAC.

## 14. Risks and Anti-Patterns Not To Port

Do not port these Lovable patterns into Phase A:

- Full legacy role model (`admin`, `projektledare`, `installatör`, `ekonomi`) instead of Phase A `tenant_admin`.
- Client-only route/admin gating.
- Client-supplied `company_id` as the authority for tenant ownership.
- `profiles.company_id` as the only tenant membership source.
- Browser-invoked privileged Edge Functions using service-role behavior.
- `verify_jwt = false` privileged/public functions without ADR-backed design.
- JWT role decoding without signature verification for cron/service-role authorization.
- Anon-callable tenant bootstrap that trusts a client-supplied user id.
- Public or bucket-only storage policies for calculation/quote files.
- Service-role code paths reachable from public or weakly authenticated endpoints.
- Client-side accepted-quote-to-job mutation sequence.
- Mutable sent/accepted quote rows as the source of customer-facing truth.
- Mutable acceptance evidence without correction/audit rules.
- Client-derived quote numbering.
- Money stored/calculated as JS `number` kronor without integer öre and rounding policy.
- Hardcoded VAT/tax assumptions without snapshotting and owner/accounting approval.
- Broad `file_index` trigger surface across deferred modules.
- Default quote terms containing company/person-specific text without anonymization and owner approval.
- Deferred routes/schema/functions for rentals, HR, assets, DoU, supplier imports, AI, tender/FKU, service-plan automation, and field-worker UX.

## 15. Candidate Reusable Functions

Reuse stance: no Lovable code should be copied by default. The items below are candidates for behavior extraction or test-oracle comparison only. Any reuse requires tests, typing, security review, owner approval where business/legal rules apply, and adaptation to Phase A architecture.

| Candidate | Source reference | Reuse possibility | Tests/changes required before reuse |
| --- | --- | --- | --- |
| ROT calculation behavior | `src/lib/tax-deductions.ts:39` | Pure business-rule candidate. Useful as oracle for fixture generation. | Confirm legal/accounting assumptions, convert to integer öre, define rounding, test caps/persons/customer eligibility, snapshot assumptions in quote version. |
| Grön teknik calculation behavior | `src/lib/tax-deductions.ts:85` | Pure business-rule candidate. Useful as oracle for fixture generation. | Confirm rates/caps/schablon/eligibility, convert to integer öre, test category grouping, missing categories, BRF warning, cap and rounding behavior. |
| Tax deduction mix validation | `src/lib/tax-deductions.ts:147` | Candidate validation behavior. | Confirm owner workflow, test invalid ROT+green mix, private/company/BRF paths, warnings vs blocking errors. |
| Combined deduction summary | `src/lib/tax-deductions.ts:198` | Candidate aggregator behavior. | Needs tests for no deduction, ROT, green tech, options/hidden rows, line inclusion rules, integer money. |
| Attachment display mode helper | `src/lib/attachments.ts:50` | Pure UI/file classification candidate. | Test MIME/type combinations, inline vs appendix defaults, quote snapshot immutability. |
| Attachment image helper | `src/lib/attachments.ts:58` | Pure classification candidate. | Test allowed MIME extensions and unknown types. |
| File validation constants | `src/lib/attachments.ts:62` | Candidate if owner approves file size/type policy. | Test allowed/blocked MIME, max size, security implications; enforce server-side too. |
| Attachment numbering | `src/lib/attachments.ts:161` | Pure ordering candidate. | Test stable sorting, null sort order, duplicate ids, deterministic numbering. |
| Quote attachment merge | `src/lib/attachments.ts:191` | Candidate behavior for quote attachment selection. | Test include/exclude, display override, sort order, immutable sent/accepted quote version behavior. |
| Default quote terms | `src/lib/quote-defaults.ts:6` | Content shape only, not direct reuse. | Remove person/company-specific content, owner approve customer-facing wording, snapshot into quote version, fixture PDF comparison. |
| Quote PDF generation | `src/lib/quote-pdf.ts:611` | PDF structure oracle only. | Do not copy by default. Build Phase A PDF from quote version snapshot; compare against golden text/visual fixtures. |
| Acceptance workflow | `src/lib/quote-acceptance.ts:22` | Workflow oracle only. | Replace with server-side transaction, tenant checks, immutable quote version/evidence, idempotency, audit, rollback tests. |

## 16. Open Owner Questions for My Electrician Friend

Highest-priority owner questions:

- Which workflows must be usable on the first internal pilot day: CRM, calculation, quote PDF, acceptance, basic job, files?
- Is anläggning required for every customer job, or can small jobs quote directly against a customer?
- Which customer types must Phase A support: private, company, BRF, foundation, public sector?
- Should personnummer be omitted entirely until invoicing/SKV handling?
- Are work roles enough for labor pricing, or are articles/material price lists required in Phase A?
- Should options/tillval be quoted separately, accepted separately, or just shown as optional additions?
- Should hidden rows remain included in totals and deductions?
- Does quote immutability start when quote is sent, or only after acceptance?
- What acceptance evidence is sufficient: phone note, email, signed PDF, meeting note, or portal action?
- Should accepted quote price be editable at acceptance, and what evidence/reason is required?
- What is the desired quote numbering format?
- What should the basic job be called in the pilot: order, project, jobb, arbetsorder, or something else?
- Are required files entity-scoped only, or is a standalone document center needed in Phase A?
- Confirm VAT, ROT, grön teknik, caps, schablon, eligible bases, and disclosure language with accounting/legal input.
- Which legacy records should migrate live, which should archive, and which should remain only in the old app?

## 17. Recommended Inputs for the Phase A PRD

The Phase A PRD should include:

- Explicit in-scope workflows: tenant admin, CRM, settings/pricing, calculation, quote version/PDF/acceptance, basic accepted-quote job, required files, migration/coexistence.
- Explicit non-goals matching the deferred list in AGENTS and planning docs.
- Tenant model requirements: pooled tenancy, `tenant_admin` only, server-derived tenant context, no client-trusted tenant id, and RLS negative tests.
- CRM data model and terminology decisions from owner questions.
- Calculation model with integer öre, rounding policy, VAT/deduction snapshots, section/row/option visibility rules, and fixture requirements.
- Quote lifecycle model: draft editability, sent immutability, versioning, PDF snapshot, acceptance evidence, correction rules, and audit.
- Accepted-quote-to-job command requirements: server-side transaction, idempotency, immutable source quote version, agreed price, planned dates, and audit log.
- Required-file requirements: private storage, tenant-owned metadata, MIME/size/path validation, signed URLs, delete audit, immutable quote evidence.
- Migration/coexistence plan: anonymized oracle fixtures, shadow comparison, live/archive/excluded classification, fallback, and cutover criteria.
- Quality gates: unit tests, integration tests, RLS negative tests, storage negative tests, golden-master fixtures, migration reset once migrations exist, and explicit skipped-check documentation for process-only work.

