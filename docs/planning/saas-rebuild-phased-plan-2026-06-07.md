# ElPro SaaS Rebuild: Revised Phased Plan

Date: 2026-06-07  
Status: planning artifact  
Reference posture: the existing Lovable app is a behavioral oracle and requirements reference only.

**Phase B course-correction amendment (2026-09-03):** Phase B delivers responsive, phone-usable connected field workflows at the 360×640 viewport floor. It does not deliver PWA installation/manifest, service-worker caching, durable offline storage, offline reads/writes, local queues, replay/synchronization/conflict states, or background/reconnect-driven offline synchronization. ADR-B009 is current; the 2026-07-26 N-3/ADR-B007 direction remains historical. The complete PWA/offline package and its unresolved storage, retention, attachment, signature/legal, authorization, surface, conflict, platform, security, and test decisions move to Phase C. Native mobile remains outside Phase B.

## Decision Summary

| Decision | Current plan |
| --- | --- |
| Current usage | Existing Lovable app is used by one electrician company today. |
| Tenant strategy | Pooled multi-tenant SaaS by default: dev, staging, and prod Supabase projects; many tenant companies inside prod. |
| Dedicated instances | Deferred enterprise option only, not default architecture. |
| Internal Pilot access model | Implement `tenant_admin` only. Future roles are schema-aware but not implemented in UX or full permission matrix. |
| Fortnox | Not implemented in Internal Pilot. Keep billing-basis concept and future integration boundary only. |
| Existing code reuse | No copying by default. Reuse only exact, reviewed, tested, decoupled functions. |
| Priority | Security, maintainability, reproducible delivery, and domain correctness before breadth. |

Status labels used below:

| Label | Meaning |
| --- | --- |
| IN | Implement in the named phase. |
| DEFERRED | Do not implement or create production tables yet. |
| SEAM | Preserve a documented architecture boundary, but no production integration implementation. |

## 1. Phased Product Scope

### Phase A: Internal Pilot MVP

Goal: rebuild the smallest useful system for the current company while proving the production foundation for later SaaS use.

| Area | Status | Internal Pilot scope |
| --- | --- | --- |
| New repo/platform | IN | Clean install, typed app, CI, documented local setup, migration reset from empty DB. |
| Pooled tenant foundation | IN | Tenant/company table, memberships, `tenant_admin`, tenant-scoped RLS, cross-tenant negative tests. |
| Admin-only app access | IN | All authenticated app users are tenant admins during pilot. No field-worker UX yet. |
| CRM | IN | Kund, anläggning, kontakt. Enough data for calculation, quote, and job creation. |
| Company/settings/pricing | IN | Company identity, VAT defaults, quote terms, work roles, hourly rates, optional minimal article catalog. |
| Calculations | IN | Sections, rows, labor/material/subcontractor/other, margin/totals, VAT, ROT/green-tech assumptions, attachments if needed for quotes. |
| Quotes | IN | Quote versions, sent PDF, status lifecycle, acceptance evidence, immutable sent/accepted snapshots. |
| Basic order/job | IN | Create basic order/project from accepted quote, with source quote snapshot reference. |
| Documents/files | IN | Only files needed by CRM, calculations, quotes, and accepted-job evidence. |
| Migration/coexistence | IN | Data capture from current app, anonymized fixtures, shadow comparison, old app fallback. |
| Billing basis | SEAM | Domain language and future object boundary only. No Fortnox, no sync, no retry UI. |
| Fortnox | DEFERRED | No OAuth, workers, external mappings, retries, webhooks, or customer/article sync. |
| Field-worker workflow | DEFERRED | No installatör UX, mobile reporting, or time/material/deviation workflow in pilot. |
| Supplier API | DEFERRED | No live supplier API. Optional manual article seed only if needed for calculations. |
| AI jobs | DEFERRED | No production AI job tables or autonomous AI mutation. |
| HR/rentals/assets/DoU/tender RAG | DEFERRED | Do not create tables "just in case." |

Pilot success means one company can run selected quote-to-accepted-job work in the new system while the old system remains available as fallback.

### Phase B: External Beta

Goal: validate the SaaS operating model with a small number of external companies.

| Area | Status | External Beta scope |
| --- | --- | --- |
| Minimal roles | IN | Introduce validated roles only, likely admin plus limited field/project roles. |
| Connected mobile-width field workflow | IN | Responsive assigned jobs, time, material, deviations, photos, self-inspection basics at 360×640; connectivity required, transient form protection and honest retry, no PWA/offline promise. |
| Invoice/billing basis | IN if needed | Manual billing-basis review/export without Fortnox sync unless re-approved. |
| Observability | IN | Production logging, alerts, job/error dashboards, audit expansion. |
| Tenant operations | IN | Onboarding/offboarding, backup/restore runbooks, support process. |
| Data governance | IN | Retention/deletion docs, audit events, stricter file controls. |
| Fortnox | SEAM or DEFERRED | Keep future design unless explicitly promoted to active epic. |
| Full RBAC | DEFERRED | Expand only after real role needs are validated. |
| Broad AI/supplier/DoU/tender | DEFERRED | Not beta default scope. |

### Phase C: Commercial SaaS V1+

Goal: production SaaS for multiple Swedish electrician firms.

| Area | Status | Commercial V1+ scope |
| --- | --- | --- |
| Full permission model | IN | Admin, projektledare, installatör, ekonomi, optional subcontractor, tested by module. |
| Fortnox integration | IN when epic active | OAuth, outbox, retries, error UI, external ID mappings, idempotency. |
| Supplier integrations | IN when epic active | Provider adapters, price imports/API, discount agreements, possibly EDI. |
| AI governance | IN when epic active | Async jobs, cost limits, audit, human review, golden extraction tests. |
| DoU/tender/HR/rentals/assets | Optional | Implement only as separate commercially justified epics. |
| Enterprise dedicated instances | Optional | Separate deployment model for large customers only. |
| PWA installability + genuine offline field capability | Deferred package | Manifest/installability, service-worker/data caching, durable device storage, offline reads/writes, local operation/attachment queues, sync/replay/conflicts, reconnect/background behavior, retention/purge, authorization changes, attachment limits, signature/legal posture, platform support, and offline security/recovery tests; concrete design waits for Phase C decisions. |

## 2. Revised Product Assumptions and Open Questions

### Assumptions

| ID | Assumption |
| --- | --- |
| A1 | Internal Pilot can be admin-only without blocking later role expansion. |
| A2 | The current company can tolerate side-by-side operation during the pilot. |
| A3 | The smallest useful internal slice is CRM -> calculation -> quote -> accepted basic job. |
| A4 | Fortnox can remain a future integration without changing core quote/job domain semantics. |
| A5 | Pooled tenancy is the correct default; schema must assume many tenant companies in production. |
| A6 | Historical data can be selectively migrated or archived; not all Lovable data must become live v0 data. |

### Open Questions

| Area | Question |
| --- | --- |
| Pilot workflow | Which real jobs/quotes should be run in the new system first? |
| Historical migration | How many years of customers, calculations, quotes, and files must be live vs archived? |
| Article catalog | Does the pilot require reusable articles, or are free-text/material rows enough initially? |
| Quote sending | Is the system responsible for sending email, or only generating PDFs for manual send? |
| Acceptance evidence | What counts as accepted: email, phone note, signed PDF, customer portal, or all of these? |
| Job terminology | Does the owner distinguish order and projekt operationally in phase A? |
| Billing basis | Is a manual faktureringsunderlag export needed in pilot, or can accepted quote/job data be enough? |
| Tax rules | Who signs off ROT/grön teknik assumptions and legal text before pilot use? |

## 3. Core Domain Model By Phase

### Internal Pilot Domain

| Domain | Included entities |
| --- | --- |
| Tenant/security | Tenant/company, user, tenant_membership, tenant_role assignment, audit_log. |
| CRM | Customer, facility/anläggning, contact. |
| Settings/pricing | Company settings, work_role, optional article. |
| Calculation | Calculation, calculation_section, calculation_row, calculation_attachment. |
| Quote | Quote, quote_version, quote_version_line, quote_attachment, quote_event, quote_acceptance. |
| Basic job | Job/order, job_event, job_source_quote_snapshot. |
| Files | File_object/file_metadata linked to included domains. |

### Deferred Domains

Do not create production tables in v0 for HR, rentals, assets, DoU automation, tender/FKU RAG, AI jobs, supplier APIs, Fortnox, full field reporting, service plans, warranties, notes, tickets, KNX, or panel AI.

## 4. Core Schema v0

Core rule: create only tables needed by Internal Pilot. No deferred-module placeholders unless explicitly approved.

| Table | Purpose | Notes |
| --- | --- | --- |
| `tenants` | Pooled company/tenant root | One production DB contains many tenants. |
| `tenant_memberships` | User-to-tenant membership | Supports future multiple users and future roles. |
| `tenant_roles` or enum | Pilot role support | Only `tenant_admin` active in phase A. |
| `audit_log` | Security/business audit | Append-only for critical events. |
| `company_settings` | Tenant settings | Quote branding, VAT defaults, quote terms defaults. |
| `customers` | Kund | Tenant-scoped. |
| `facilities` | Anläggning | Belongs to customer and tenant. |
| `contacts` | Kontakt | Can link to customer and optionally facility. |
| `work_roles` | Labor pricing foundation | Prices snapshotted into calculation rows. |
| `articles` | Optional simple article catalog | Only if needed for pilot calculations; no supplier API tables. |
| `calculations` | Kalkyl header | Draft/live calculation state. |
| `calculation_sections` | Kalkyl grouping | Ordered sections. |
| `calculation_rows` | Money/tax rows | Stores snapshotted price, VAT, tax basis fields. |
| `calculation_attachments` | Calculation files | Can be replaced by generic file links if cleaner. |
| `quotes` | Offert logical record | Current status and customer relation. |
| `quote_versions` | Immutable sent/accepted versions | Full snapshot of customer-visible content. |
| `quote_version_lines` | Immutable quote line snapshot | No recalculation from mutable calculation rows. |
| `quote_events` | Lifecycle history | Drafted, sent, accepted, rejected, expired. |
| `quote_acceptances` | Acceptance evidence | Immutable once recorded except admin correction flow. |
| `jobs` | Basic order/projekt from accepted quote | Minimal status and source quote version. |
| `job_events` | Job lifecycle history | Created from quote, status changes. |
| `files` | File metadata | Tenant-owned; points to private storage path. |

Explicitly absent in v0: `fortnox_*`, `integration_outbox`, `external_mappings`, `ai_jobs`, `supplier_credentials`, `supplier_sync`, `employee_*`, `rental_*`, `asset_*`, `dou_*`, `tender_*`.

Small exception: a future integration boundary may be represented in documentation and service interfaces only. Do not create Fortnox production tables until E10 is active.

## 5. Tenant and RLS Strategy

| Topic | Phase A decision |
| --- | --- |
| Model | Pooled multi-tenant tables with `tenant_id` on all business records. |
| Environments | Separate Supabase projects for dev, staging, prod. |
| Production layout | Many tenant companies inside prod. |
| Access | `tenant_admin` only in pilot. |
| Membership | Every app user must have active `tenant_memberships` row. |
| RLS baseline | Tenant rows readable/writable only by active `tenant_admin` membership in same tenant. |
| Future roles | Schema can add role rows/policies later; no role UX or broad matrix in pilot. |
| Service role | Never exposed to client. Server-only use must be minimal, logged, and tested. |
| Public functions | No unauthenticated privileged functions. |

Even with one tenant in pilot, tests must create at least two tenants and prove cross-tenant reads/writes fail.

## 6. Simplified RBAC Plan

### Internal Pilot

| Role | Implemented? | Permissions |
| --- | --- | --- |
| `tenant_admin` | Yes | Full tenant-scoped CRUD for pilot modules, plus user/settings/audit visibility. |
| `projektledare` | No | Schema-aware future role only. |
| `installatör` | No | Deferred until field workflow is validated. |
| `ekonomi` | No | Deferred until finance workflow requirements are validated. |
| `external/subcontractor` | No | Deferred. |

### External Beta

Introduce the smallest validated non-admin roles. Do not implement the full matrix until there are real beta workflows proving the boundaries.

### Commercial V1

Expand to full module/action permissions: create, read, update, delete, approve, export, with automated tests per role and tenant.

## 7. Source-of-Truth Notes

| Data | Phase A source of truth |
| --- | --- |
| Auth identity | Supabase Auth. |
| Tenant membership/roles | New app Postgres. |
| Customers/facilities/contacts | New app after cutover for selected pilot workflow; old app remains fallback. |
| Calculations/quotes/jobs in pilot | New app for selected pilot records; old app remains reference/fallback. |
| Historical Lovable records | Old app/export archive unless explicitly migrated. |
| Invoice/accounting | Manual/current company process. Fortnox is not integrated in Phase A. |
| Future Fortnox invoice/accounting IDs | Future Fortnox integration will own external accounting identifiers. |
| Files | Private storage plus new app file metadata for migrated/pilot files. |

## 8. Money, Tax, and Quote Snapshot Design

### Money Representation

| Topic | Decision |
| --- | --- |
| Currency | Store currency code, default `SEK`. |
| Money storage | Store monetary amounts as integer minor units: `amount_ore bigint`. |
| Quantities | Store quantities as decimal/numeric with explicit unit, for example hours, pieces, meters. |
| Unit prices | Store unit prices in öre plus quantity. |
| Display | Format for Swedish locale at presentation/PDF layer. Do not use display strings as source data. |

### Rounding

Proposed pilot rule, requiring owner/accounting sign-off before production use:

| Rounding point | Rule |
| --- | --- |
| Line subtotal | Calculate from quantity and unit price, then round to nearest öre. |
| VAT per line | Calculate from line net and snapshotted VAT rate, round to nearest öre. |
| Quote totals | Sum rounded line amounts, not floating point recalculation. |
| PDF whole kronor display | If whole kronor are shown, retain exact öre in stored snapshot. |

Open question: confirm whether the business wants line-level VAT rounding or document-total VAT rounding for all quote PDFs.

### VAT Snapshot

| Field | Design |
| --- | --- |
| VAT rate | Store as basis points, for example `2500` for 25.00%. |
| VAT mode | Store whether quote displays excl., incl., or both. |
| VAT source | Snapshot tenant default or row-specific VAT at row creation/versioning time. |
| Sent quote | Sent quote version stores VAT rate and VAT amount per line and total. |

### ROT and Grön Teknik

| Topic | Design |
| --- | --- |
| Representation | Store `tax_deduction_type`, eligible basis, assumptions, persons/count, caps/rates profile, calculated deduction. |
| Legal constants | Do not rely on hardcoded hidden constants without owner/legal/accounting sign-off. |
| Snapshot | Quote version stores the full tax calculation inputs and outputs used in the PDF. |
| Warnings | Store validation warnings shown at send time. |
| Responsibility | Human admin confirms assumptions before quote is sent. |

### Price Snapshotting

| Source | Snapshot rule |
| --- | --- |
| Work role | Calculation row stores work role ID, name, hourly rate, cost/sell rate, and source timestamp. |
| Article | Row stores article ID if used, article number/name/unit/current price, and source timestamp. |
| Manual row | Row stores entered text, unit, quantity, cost, margin, sell price. |
| Quote version | Stores full customer-visible snapshot; never depends on mutable work role/article/calculation data. |

### Quote Immutability and Versioning

| Event | Immutable data |
| --- | --- |
| Quote sent | Version content, lines, totals, VAT, tax deduction assumptions, terms, attachments list, PDF render metadata. |
| Quote accepted | Accepted version ID, accepted_at, accepted_by/admin user, channel/evidence, accepted price, acceptance notes. |
| Job created from quote | Source quote version and acceptance record. |

Changes requiring a new quote version:

- Any customer-visible line, section, price, discount, VAT, ROT/grön teknik, terms, validity, attachment selection, intro text, or project/customer/facility display change after send.
- Any accepted price change after sent quote differs from sent total.

Changes not requiring a new quote version:

- Internal notes not shown to customer.
- Draft edits before first send.
- Admin-only metadata that does not affect customer-visible commitment.

## 9. Data Migration and Coexistence Plan

### Migration Categories

| Category | Phase A treatment |
| --- | --- |
| Must migrate live | Company settings, quote terms, active customers/facilities/contacts needed for pilot, work roles/prices, active/draft calculations selected for pilot, sent/accepted quotes selected for pilot, files needed for those records. |
| Migrate if needed | Common articles, recent won/lost quote history for comparison, basic accepted-job records. |
| Archive/read-only | Older calculations/quotes/jobs, non-pilot documents, historical dashboard data. |
| Do not migrate to v0 | HR, rentals, assets, DoU, tenders/FKU RAG, AI outputs, service plans, warranties, notes/tickets unless explicitly selected later. |

### Coexistence

| Step | Decision |
| --- | --- |
| Discovery | Export and inspect current Lovable schema/data for MVP modules only. |
| Fixture creation | Create anonymized fixtures from real calculations, quotes, PDFs, and acceptance flows. |
| Shadow mode | Run new calculations/quotes against old examples without making the new app business-critical. |
| Limited pilot | Use new app for selected new quotes while old app remains available. |
| Fallback | If pilot blocker appears, continue operational work in old app and record delta/backfill needs. |
| Cutover | Cut over by workflow, not by whole company at once. |
| Archive | Keep old app/exported data as read-only reference until retention decision is made. |

### Anonymized Fixtures

Anonymized exports should preserve:

- Calculation structure, quantities, rates, discounts, VAT, ROT/grön teknik inputs.
- Quote terms, line display mode, attachment selection metadata.
- PDF text structure and total blocks.
- Acceptance event data shape.
- Job/order creation result shape.

Anonymization must replace names, emails, phone numbers, addresses, personnummer, org numbers where required, free-text sensitive notes, and file contents unless explicitly approved.

### Oracle Comparisons

| Comparison | Method |
| --- | --- |
| Calculation totals | Golden-master fixtures comparing old totals to new totals. |
| Quote output | Compare line visibility, sections, totals, VAT/tax blocks, terms, and customer-visible fields. |
| PDF | Text extraction plus stable visual snapshot for representative quotes. |
| Acceptance transition | Compare accepted quote -> job/order fields and lifecycle events. |
| Edge cases | Include discounts, options/tillval, hidden rows, ROT, grön teknik, attachments, changed accepted price. |

## 10. Swedish Domain Glossary

| Term | Working definition |
| --- | --- |
| kund | The buying customer: private person, company, BRF, public sector, or similar. |
| anläggning | Physical site/property/facility where work is performed. Usually belongs to a customer. |
| kontakt | Person connected to a customer and/or anläggning. |
| kalkyl | Internal estimate/calculation with costs, sell prices, margins, sections, and assumptions. |
| offert | Customer-facing offer generated from a calculation or manual quote data. |
| order | Confirmed work after acceptance; may be smaller/simpler than projekt depending on owner definition. |
| projekt | Larger or managed job with planning, phases, budget, or project lead responsibility. |
| arbetsorder | Concrete work package/task assignment under an order/projekt. |
| egenkontroll | Self-inspection/control checklist for performed electrical work. |
| avvikelse | Deviation from plan, scope, quality, safety, material, time, or agreement. |
| tidrapport | Reported worked time, usually by person/job/date/work role. |
| materialrapport | Reported material usage for a job/order/projekt. |
| faktureringsunderlag | Reviewed basis for invoicing, not necessarily the invoice itself. |
| DoU | Drift och underhåll documentation/package. |
| ROT | Swedish tax deduction category for certain labor work. Requires validated assumptions. |
| grön teknik | Swedish tax deduction category for eligible green technology such as solar/battery/charging, subject to validated assumptions. |

Ambiguous terms requiring owner definition:

| Term | Ambiguity |
| --- | --- |
| order vs projekt | Is this size/complexity, lifecycle, accounting, responsibility, or only a label? |
| arbetsorder | Is it a field assignment, checklist, phase, or customer-facing order document? |
| faktureringsunderlag | Should it include accepted quote only, approved deviations, time/material, payment plan, or all of these? |
| egenkontroll | Which templates are mandatory by job type, and who approves completion? |
| avvikelse | Is this only contractual ÄTA/change work, or also quality/safety/internal deviations? |
| anläggning | Can one customer have many facilities and one facility many contacts? |
| DoU | Is basic document storage enough before full DoU automation? |

## 11. Tightened Salvage Policy

Default: do not copy code from the Lovable repo into the new repo.

Reusable code must pass all conditions:

1. Exact source file and function are identified.
2. Behavior is captured in tests before reuse.
3. Function is pure or can be made pure without importing generated architecture.
4. Weak typing, `any`, `as any`, and framework-coupled assumptions are removed.
5. Security-sensitive code is not reused unless rewritten and independently tested.
6. Golden-master fixtures prove behavior is preserved where preservation is intended.

### Candidate Salvage

| Source | Candidate | Decision |
| --- | --- | --- |
| `src/lib/tax-deductions.ts` | `calcRot`, `calcGreenTech`, `validateDeductionMix`, `computeDeductionSummary` | Possible reuse after legal/business validation and money/rounding tests. |
| `src/lib/attachments.ts` | `numberAttachments`, `effectiveDisplayMode`, `mergeQuoteSelections` | Possible reuse after decoupling from Supabase/toast and adding tests. |
| `src/lib/quote-defaults.ts` | Default quote terms content | Reuse as owner-approved seed data, not necessarily code. |
| `src/lib/quote-acceptance.ts` | Acceptance behavior | Use as requirements/golden transition only; do not copy client-side mutation code. |
| `src/lib/quote-pdf.ts` | PDF structure | Use as PDF golden-master reference; avoid copying coupled PDF implementation by default. |
| Supabase Edge Functions | Any privileged function | Rewrite. Existing service-role and auth patterns are not safe enough to port. |

## 12. ADR-001: Backend Command Implementation For Internal Pilot

Decision: use Next.js/Node API routes as the primary command layer for Internal Pilot, backed by Supabase Auth, Postgres, Storage, and RLS. Use small Postgres functions only where a single database transaction is required and clearer than application orchestration.

### Options Compared

| Option | Pros | Cons | Pilot fit |
| --- | --- | --- | --- |
| Supabase Edge Functions | Close to Supabase, deployable per function, useful for webhooks/cron later. | Deno/runtime split, weaker local/test ergonomics, observability friction, existing prototype already has unsafe service-role patterns. | Not primary for pilot commands. |
| Next.js/Node API routes | Strong TypeScript ecosystem, good tests, shared validation, easier local dev, easier future Fortnox/provider SDKs, better observability options. | Requires app/backend discipline; RLS and transaction boundaries must be designed deliberately. | Recommended. |
| Postgres RPC | Strong transactions, close to data, can enforce invariants. | Business logic in SQL can become hard to test/version; poor fit for PDFs/integrations; easy to overuse. | Use sparingly for atomic DB invariants. |
| Separate backend service | Best long-term isolation and observability for complex SaaS. | More infrastructure and operational burden before pilot value is proven. | Defer until scale/complexity demands it. |

### Tradeoff Decisions

| Concern | Pilot approach |
| --- | --- |
| Auth | API routes verify Supabase session/JWT and tenant membership. |
| RLS | RLS remains active and tested; commands pass tenant/user context explicitly. |
| Transactions | Use database transactions or narrow Postgres functions for accept quote -> create job. |
| Testability | Command handlers tested as plain TypeScript plus integration DB tests. |
| Local development | One app runtime plus local Supabase is simpler than many Edge Functions. |
| Observability | API routes emit structured logs with tenant, user, command, request ID. |
| Future integrations | Fortnox/supplier integrations can be added as server-side workers/routes later. |
| Service role | Server-only, minimal, audited; never reachable from client paths. |

## 13. Revised Implementation Backlog

| Epic | Phase | Scope | Acceptance focus |
| --- | --- | --- | --- |
| E0 Discovery and data capture from current app | A | Inventory MVP data, export fixtures, identify golden-master cases, owner sign-off on terms/tax assumptions. | Fixture set covers representative calculations, quotes, PDFs, acceptance transitions. |
| E1 New repo/platform foundation/CI | A | New repo, package manager, TypeScript strict baseline, lint, tests, build, env docs, migration reset. | Clean install and CI green from empty checkout. |
| E2 Tenant model, admin auth, memberships, baseline RLS | A | Pooled tenants, `tenant_admin`, membership, RLS, audit basics. | Cross-tenant negative tests pass. |
| E3 Core CRM/settings/pricing foundations | A | Customers, facilities, contacts, company settings, quote terms, work roles, optional articles. | Admin can maintain data needed for calculations and quotes. |
| E4 Calculations with money/tax golden tests | A | Sections/rows/totals/VAT/ROT/green-tech snapshots. | Golden money/tax fixtures pass. |
| E5 Quote versions/PDF/acceptance evidence | A | Quote lifecycle, immutable sent versions, PDF render, acceptance event/evidence. | Sent/accepted quote version cannot be mutated. |
| E6 Basic job/order creation from accepted quote | A | Minimal job/order from accepted quote version. | Acceptance command creates auditable job source record transactionally. |
| E7 Documents/files needed for the above | A | Private file storage, metadata, signed URLs, quote attachments. | Cross-tenant file access denied. |
| E8 Internal pilot migration/coexistence | A | Shadow mode, selective migration, fallback process, cutover plan. | Old system remains fallback; comparison report documented. |
| E9 External beta hardening | B | Minimal roles, connected responsive field workflow, observability, runbooks, audit/data retention. | Beta readiness checklist green; field flows pass at 360×640 and never imply offline submission. |
| E10 Fortnox integration | C or re-approved B | OAuth, outbox, idempotency, retries, error UI, external mappings. | Sync failures visible/retryable; no duplicate external records. |
| E11 Supplier/AI/DoU/tender expansions | C+ | Separate epics only after commercial justification. | Each has its own schema, tests, governance, rollout plan. |

## 14. Acceptance Criteria By Phase

### Internal Pilot

Required before using the new system for real pilot work:

- Clean install from fresh checkout.
- Typecheck passes.
- Lint passes.
- Unit tests for money, VAT, ROT/grön teknik, quote lifecycle, and snapshot rules.
- Integration tests for core commands: create calculation, send quote version, accept quote, create job.
- Basic RLS cross-tenant negative tests, even with only one real tenant.
- Supabase migration reset from empty DB.
- Documented local setup and required environment variables.
- No service-role access from client paths.
- No unauthenticated privileged functions.
- Migration/coexistence runbook exists.
- Old app fallback path is documented.

### External Beta

Required before onboarding external companies:

- Role matrix tests for implemented roles.
- Connected field-workflow tests at the 360×640 viewport floor, including connection-required, transient-failure retention, explicit retry, and server-confirmed success states.
- Production observability: errors, logs, uptime, command metrics.
- Backup and restore runbooks tested.
- Tenant onboarding/offboarding process.
- Stricter audit logging for settings, users, money records, files, and approvals.
- Data retention/deletion documentation.
- Support triage process and incident response checklist.
- Security review of public routes, storage policies, and server commands.

### Commercial SaaS V1+

Required before broad commercial launch:

- Full RBAC/permission matrix implemented and tested.
- Fortnox outbox/sync if the accounting workflow is sold as part of the product.
- Load/performance testing for multi-tenant production use.
- Dependency/security scanning in CI.
- Customer-facing onboarding docs and support SLAs.
- Operational dashboards for integrations and background work.
- Privacy, DPA, subprocessors, retention, and AI governance docs where applicable.

## 15. Explicit Deferrals

The following are not Internal Pilot scope and must not create production tables or UI unless re-approved:

- Fortnox OAuth, sync workers, retry UI, external mappings.
- Full invoice generation/accounting.
- Project-manager/installer/economy/subcontractor UX.
- Mobile field workflow.
- Time/material/deviation/photo reporting.
- Full self-inspection workflow beyond quote/job document needs.
- HR.
- Rentals.
- Assets/QR.
- DoU automation.
- Tender/FKU RAG.
- AI jobs and AI document mutation.
- Live supplier APIs.
- Service plans and proactive cron.
- Public privileged endpoints.
