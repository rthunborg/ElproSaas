---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
workflowType: architecture
lastStep: 8
status: complete
project_name: Elpro
user_name: Rasmus
date: 2026-06-09
completedAt: 2026-06-09
phase: Phase A - Internal Pilot MVP
mode: docs-only
inputDocuments:
  - C:\ElproSaas\AGENTS.md
  - C:\ElproSaas\_bmad-output\planning-artifacts\prd.md
  - C:\ElproSaas\_bmad-output\planning-artifacts\ux-design-specification.md
  - C:\ElproSaas\_bmad-output\project-context.md
  - C:\ElproSaas\docs\planning\saas-rebuild-phased-plan-2026-06-07.md
  - C:\ElproSaas\docs\discovery\e0-domain-oracle-report.md
  - C:\ElproSaas\docs\security\security-guardrails.md
  - C:\ElproSaas\docs\quality\quality-gates.md
  - C:\ElproSaas\docs\decisions\ADR-0001-agentic-development-process.md
  - C:\ElproSaas\docs\process\agent-workflow.md
  - C:\ElproSaas\docs\process\branching-and-pr-policy.md
---

# Phase A Architecture - Elpro Internal Pilot MVP

## 1. Executive Architecture Summary

Elpro Phase A is a clean rebuild of the smallest operationally useful tenant-admin workflow: CRM/settings/pricing -> calculations -> quote versions/PDF/acceptance -> basic job/order -> required files, with migration/coexistence against the current Lovable app as behavioral oracle only.

The architecture is a pooled multi-tenant SaaS foundation from day one, even though the pilot starts with one internal company. Supabase Auth, Postgres, Storage, and RLS provide identity, data, file, and tenant-isolation primitives. A Next.js/Node server command layer owns sensitive mutations, tenant resolution, validation, transactions, idempotency, and audit logging.

The highest-risk design points are tenant isolation, quote immutability, money/tax correctness, private files, and acceptance-to-job consistency. Phase A therefore favors explicit snapshots, integer öre, server-side lifecycle commands, private storage metadata, cross-tenant negative tests, and golden-master fixtures over feature breadth.

Phase A must not create production schema, UI, jobs, routes, credentials, workers, or integrations for deferred modules. Fortnox, field workflow, supplier APIs, AI jobs, HR, rentals, assets/QR, DoU automation, tender/FKU RAG, full RBAC, public privileged endpoints, customer portal, and broad admin analytics remain out of scope.

## 2. Technology Choices And ADRs

### Version Verification Notes

Version-sensitive choices were checked on 2026-06-09 against primary sources:

- Next.js installation docs recommend `create-next-app@latest` and the default setup with TypeScript, Tailwind CSS, ESLint, App Router, Turbopack, and `@/*` imports; the docs list Node.js 20.9+ as the minimum. Source: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation).
- Next.js upgrade docs describe the latest-version path as `next@latest react@latest react-dom@latest`. Source: [Next.js upgrading](https://nextjs.org/docs/app/getting-started/upgrading).
- React docs identify React 19.2 as the current documented React major/minor family. Source: [React versions](https://react.dev/versions).
- Node.js release docs identify Node 24 and Node 22 as LTS lines, with production apps advised to use Active or Maintenance LTS. Source: [Node.js releases](https://nodejs.org/en/about/previous-releases).
- Supabase docs require RLS on exposed schemas, document service keys as RLS-bypassing and not for browsers, and describe Storage access control through RLS on `storage.objects`. Sources: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started/).

Exact package patch versions must be pinned by the first approved implementation story. This architecture does not add dependencies.

### ADR-A001: Clean Next.js App Router Rebuild

**Decision:** Use a clean Next.js App Router application with TypeScript for the Phase A web app and server command surface.

**Rationale:** The baseline plan already selected Next.js/Node API routes as the primary command layer. Next.js keeps the tenant-admin UI, server-side route handlers, PDF orchestration, tests, and future integration adapters in one TypeScript codebase during the pilot.

**Scope status:** IN for Phase A platform foundation. No app code is created by this architecture artifact.

### ADR-A002: Supabase Platform With Pooled Multi-Tenancy

**Decision:** Use Supabase Auth, Postgres, Storage, and RLS with separate dev, staging, and prod Supabase projects. Production contains many tenant companies in one project/database.

**Rationale:** Pooled tenancy is required by the PRD and planning docs. Supabase gives the fastest path to Auth, Postgres, private storage, local reset, and RLS negative tests while preserving future SaaS expansion.

**Scope status:** IN. One Supabase project per customer is not the Phase A architecture.

### ADR-A003: Server-Side Command Layer For Sensitive Mutations

**Decision:** All sensitive business mutations go through authenticated server-side command handlers. Browser/client code never receives a service-role key and never acts as the authority for tenant ownership.

**Rationale:** The Lovable oracle shows useful workflow behavior but unsafe client-side and privileged patterns. Phase A commands must verify session, membership, tenant ownership, input validity, lifecycle state, idempotency, and audit behavior.

**Scope status:** IN. Client-only multi-step acceptance/job creation is forbidden.

### ADR-A004: Integer Ore Money And Snapshotted Tax Assumptions

**Decision:** Store SEK monetary values as integer öre (`bigint`), VAT rates as explicit basis points, and ROT/grön teknik assumptions as snapshotted inputs/outputs on quote versions.

**Rationale:** Customer-visible commitments must be reproducible and testable. Floating-point kronor, hidden VAT constants, and mutable tax assumptions are not safe for Phase A.

**Scope status:** IN. Accounting/legal sign-off remains required before real pilot use for VAT, ROT, grön teknik, rounding policy, quote terms, and tax wording.

### ADR-A005: Immutable Quote Version And Acceptance Model

**Decision:** Quote versions become immutable when marked sent. Accepted quote version reference, acceptance evidence, accepted price, and source-to-job linkage become immutable after acceptance, except through an explicit audited correction workflow.

**Rationale:** Sent and accepted quotes are customer commitments. Later customer-visible changes require a new quote version, not mutation of the prior version.

**Scope status:** IN.

### ADR-A006: Entity-Scoped Private File Model

**Decision:** Files are managed through tenant-owned metadata and private Supabase Storage. File UI is entity-scoped, with only an optional limited Phase A file index.

**Rationale:** Phase A needs attachments, quote PDFs, acceptance evidence, and job evidence, not a broad document center across deferred modules.

**Scope status:** IN for Phase A files only.

### ADR-A007: Lovable Oracle And Golden-Master Coexistence

**Decision:** Use Lovable as a behavioral oracle for anonymized fixtures, comparison, terminology, edge cases, and fallback only. Do not copy code by default.

**Rationale:** The rebuild should preserve validated behavior without inheriting unsafe architecture or deferred breadth.

**Scope status:** IN for migration/coexistence.

### ADR-A008: Future Expansion Through Documented Boundaries Only

**Decision:** Preserve explicit boundaries for Fortnox, field workflow, supplier pricing, AI, and RBAC, but do not create Phase A production tables, routes, jobs, credentials, or UI for them.

**Rationale:** Future SaaS expansion should not increase Phase A RLS, migration, or security surface before validation.

**Scope status:** SEAM only.

## 3. Repo And App Structure

The target clean rebuild repo should be initialized by the first approved platform story. Until then, this architecture is the source of truth.

Recommended target structure:

```text
elpro/
  AGENTS.md
  README.md
  package.json
  pnpm-lock.yaml
  tsconfig.json
  next.config.ts
  eslint.config.mjs
  postcss.config.mjs
  tailwind.config.ts
  .env.example
  .gitignore
  .github/
    workflows/
      ci.yml
  docs/
    architecture/
    migration/
    quality/
    security/
  src/
    app/
      (auth)/
      (app)/
      api/
      layout.tsx
      globals.css
    components/
      app-shell/
      ui/
      forms/
      crm/
      calculations/
      quotes/
      jobs/
      files/
      settings/
      pilot/
    features/
      crm/
      settings/
      pricing/
      calculations/
      quotes/
      jobs/
      files/
      tenant/
      audit/
      migration/
    server/
      auth/
      commands/
      db/
      pdf/
      storage/
      audit/
      validation/
      errors/
    lib/
      money/
      tax/
      snapshots/
      ids/
      dates/
      result/
    types/
  supabase/
    config.toml
    migrations/
    seed.sql
    tests/
      rls/
      storage/
  tests/
    unit/
    integration/
    golden/
    e2e/
    fixtures/
      golden/
      tenants/
  scripts/
    migration/
    verify/
```

Local Docker/Supabase work must follow the repository Docker conventions: project-local Compose files only if needed, no fixed `container_name`, no global Docker/daemon changes, no database data bind mounts to Windows paths, configurable localhost ports, and `.env` kept out of git.

## 4. Frontend Route And Module Structure

The product is a tenant-admin operations app, not a marketing site and not a broad ERP.

Routes use English path names for maintainability and Swedish business labels in UI where useful:

| Route | UI label | Scope |
| --- | --- | --- |
| `/login` | Logga in | Supabase Auth entry. |
| `/dashboard` | Dashboard | Pilot operational overview, warnings, follow-ups, recent lifecycle activity. Not admin analytics. |
| `/customers` | Kunder | Customer search/list/create. |
| `/customers/[customerId]` | Kund | Customer hub with facilities, contacts, calculations, quotes, jobs, files, events. |
| `/customers/[customerId]/facilities/[facilityId]` | Anläggning | Facility detail where story requires full page; modal is acceptable for simple edits. |
| `/calculations` | Kalkyler | Calculation list and filters. |
| `/calculations/[calculationId]` | Kalkyl | Section/row editor, money/tax summary, readiness checks, files, create quote version. |
| `/quotes` | Offerter | Quote list, statuses, follow-ups. |
| `/quotes/[quoteId]` | Offert | Version timeline, selected version snapshot, PDF status, acceptance state, events. |
| `/quotes/[quoteId]/versions/[versionId]` | Offertversion | Immutable sent/accepted snapshot view and draft edit view before send. |
| `/jobs` | Jobb/Order | Basic accepted-work list only. |
| `/jobs/[jobId]` | Jobb/Order | Source quote/acceptance, basic status/planned dates/files/events. No field-worker UX. |
| `/files` | Filer | Optional limited Phase A file index. Entity panels remain primary. |
| `/settings/company` | Företagsinställningar | Quote identity, company details, VAT defaults. |
| `/settings/pricing` | Prissättning | Work roles and optional minimal articles. |
| `/settings/quote-terms` | Offertvillkor | Tenant-owned quote terms with sign-off warning. |
| `/pilot` or `/migration` | Pilotstod | Optional migration/coexistence status if an approved story needs UI. |

Deferred modules must not appear as navigation items, placeholder screens, empty route groups, or dormant UI.

## 5. Server-Side Command Pattern

Commands live under `src/server/commands/<domain>/<command>.ts` and are invoked by App Router route handlers or thin server actions. Sensitive mutations use route handlers by default; server actions may only delegate to the same command functions.

Each command follows this shape:

1. Resolve authenticated Supabase user from server-side cookies/session.
2. Resolve active tenant membership from `tenant_memberships`.
3. Reject unauthenticated users and users without active `tenant_admin` membership.
4. Validate input with a typed schema. Client-supplied `tenant_id` is ignored or verified against membership.
5. Load target records by tenant and lifecycle state.
6. Execute mutation through RLS-protected queries or a narrow Postgres RPC where a transaction is required.
7. Enforce idempotency for commands that can be retried.
8. Write an append-only audit event for critical lifecycle changes.
9. Return typed result data plus user-safe error codes.

Critical Phase A commands:

| Command | Purpose | Transaction/idempotency requirement |
| --- | --- | --- |
| `resolveTenantContext` | Current user and active tenant membership. | No mutation. |
| `createCustomer`, `updateCustomer`, `archiveCustomer` | CRM customer lifecycle. | Tenant-scoped audit. |
| `createFacility`, `updateFacility`, `archiveFacility` | Facility lifecycle. | Tenant/customer ownership validation. |
| `createContact`, `updateContact`, `archiveContact` | Contact lifecycle. | Tenant/customer/facility validation. |
| `updateCompanySettings` | Tenant quote identity and defaults. | Audit settings change. |
| `upsertWorkRole`, `archiveWorkRole` | Labor pricing. | Audit pricing change. |
| `upsertArticle` | Optional minimal articles if fixtures require them. | No supplier behavior. |
| `createCalculation`, `updateCalculationRows` | Calculation editing. | Validate money/tax row data. |
| `createQuoteVersionFromCalculation` | Snapshot calculation/customer/settings into draft quote version. | Transactional snapshot creation. |
| `markQuoteVersionSent` | Lock customer-visible version. | Transactional lock, event, audit. |
| `generateQuotePdf` | Render/store PDF from quote version snapshot. | File metadata, storage object, event. |
| `acceptQuoteAndCreateJob` | Record acceptance and create basic job/order. | Mandatory single transaction, idempotent, audited. |
| `createSignedFileAccess` | Short-lived preview/download. | Tenant/file ownership validation. |
| `archiveFile` | Delete/archive metadata and storage object where allowed. | Lifecycle validation and audit. |

Errors use stable codes such as `UNAUTHENTICATED`, `TENANT_MEMBERSHIP_REQUIRED`, `TENANT_ACCESS_DENIED`, `VALIDATION_FAILED`, `QUOTE_VERSION_LOCKED`, `ACCEPTANCE_ALREADY_RECORDED`, `FILE_ACCESS_DENIED`, and `COMMAND_CONFLICT`.

## 6. Supabase Auth, Postgres, Storage, And RLS Strategy

### Auth

- Supabase Auth is the identity source.
- Product access requires an active `tenant_memberships` row.
- Phase A product role is only `tenant_admin`.
- End customers do not authenticate in Phase A.
- No public quote acceptance route, customer portal, webhook, cron, or privileged unauthenticated function exists in Phase A.

### Postgres

- Every Phase A business table has direct `tenant_id` unless it is a global enum/reference or an auth-owned table.
- Child records duplicate `tenant_id` for RLS clarity and use composite constraints to ensure child tenant matches parent tenant.
- Server commands must not trust client-selected tenant ownership.
- Transaction-sensitive commands use explicit transactions or narrow Postgres RPC functions.
- Postgres RPC functions default to security invoker. Any security-definer function must be separately approved, have fixed `search_path`, perform explicit membership checks, and be covered by negative tests.

### Storage

- Buckets are private by default.
- Storage object paths are server-derived.
- File metadata is tenant-owned in Postgres.
- Signed URLs are short-lived and created only after tenant authorization.
- Uploads validate MIME, size, owning entity, purpose, and lifecycle state server-side.
- Cross-tenant storage path spoofing is a required negative test.

### RLS Policy Strategy

Use helper predicates for consistency:

- `is_active_tenant_member(target_tenant_id uuid)`
- `is_tenant_admin(target_tenant_id uuid)`

Baseline table policies:

- SELECT: authenticated users can read rows only for tenants where they have active `tenant_admin` membership.
- INSERT: authenticated users can insert rows only with tenant ownership matching active membership.
- UPDATE: authenticated users can update mutable rows only within active tenant membership and lifecycle constraints.
- DELETE: prefer archive/soft delete. Hard delete is allowed only for mutable non-locked records and must still be tenant-scoped.

Immutable lifecycle tables (`quote_versions` when sent, `quote_acceptances`, locked file snapshots, audit events) should block normal updates through triggers, constraints, or command-only rules, not just UI disabling.

## 7. Core Schema v0 Table List

Core rule: create only tables needed for Phase A. Do not create tables for deferred modules.

| Table | Status | Purpose |
| --- | --- | --- |
| `tenants` | IN | Pooled tenant/company root. |
| `tenant_memberships` | IN | User-to-tenant membership with active `tenant_admin` role. |
| `tenant_counters` | IN | Tenant-scoped quote number allocation and other future counters. |
| `audit_events` | IN | Append-only critical command and lifecycle audit. Not analytics. |
| `company_settings` | IN | Tenant quote identity, VAT defaults, default terms references, branding fields needed for PDF. |
| `quote_terms` | IN | Tenant-owned reusable quote terms, snapshotted into quote versions. |
| `customers` | IN | Kund. Tenant-owned. No personnummer by default. |
| `facilities` | IN | Anläggning linked to customer. |
| `contacts` | IN | Kontakt linked to customer and optionally facility. |
| `work_roles` | IN | Labor pricing source; selected values are snapshotted in rows/quotes. |
| `articles` | OPTIONAL | Minimal manual article/material catalog only if pilot fixtures require it. No supplier IDs, credentials, imports, or APIs. |
| `calculations` | IN | Calculation header and lifecycle. |
| `calculation_sections` | IN | Ordered grouping. |
| `calculation_rows` | IN | Labor/material/subcontractor/machinery/other rows with integer öre pricing and source snapshots. |
| `quotes` | IN | Logical quote record across versions. |
| `quote_versions` | IN | Draft/sent/accepted quote version snapshot. |
| `quote_version_lines` | IN | Normalized immutable customer-visible line snapshot. |
| `quote_version_attachments` | IN | Immutable selected attachment snapshot for sent/accepted quote versions. |
| `quote_events` | IN | Quote lifecycle events: draft, sent, accepted, rejected, expired, superseded. |
| `quote_acceptances` | IN | Immutable acceptance evidence and accepted price. |
| `jobs` | IN | Minimal basic job/order from accepted quote. |
| `job_events` | IN | Basic job lifecycle history. |
| `files` | IN | Tenant-owned file metadata pointing to private storage objects. |
| `file_links` | IN | Entity-scoped file ownership/purpose links for CRM, calculation, quote, acceptance, and job/order. |

Explicitly absent in v0:

- `fortnox_*`
- `integration_outbox`
- `external_mappings`
- `supplier_*`
- `ai_jobs`
- `employee_*`
- `rental_*`
- `asset_*`
- `dou_*`
- `tender_*`
- customer portal tables
- broad document-center tables
- full permission-matrix tables

## 8. Tenant Model And Membership Model

`tenants` is the company root for pooled SaaS. All business records belong to one tenant.

`tenant_memberships` is the authorization source:

- `tenant_id`
- `user_id` referencing Supabase Auth user id
- `role` constrained to `tenant_admin` in Phase A
- `status` such as `active`, `invited`, `disabled`
- audit timestamps

Phase A does not implement full RBAC. Future role expansion can add roles and permissions, but must be server-enforced and RLS-tested. Do not simulate roles through navigation hiding or client-only checks.

Tenant context rules:

- A server command resolves tenant context from membership, not from trusted client input.
- If a UI allows tenant switching later, switching only selects among memberships already available to the authenticated user.
- Test fixtures must include at least two tenants and two users even if pilot production has one tenant.

## 9. RLS Policy Strategy And Test Strategy

RLS must be enabled for every table in exposed schemas containing tenant-owned data.

Test matrix:

| Test category | Required negative cases |
| --- | --- |
| Read isolation | Tenant A user cannot select Tenant B customers, calculations, quotes, jobs, files, or audit events. |
| Insert isolation | Tenant A user cannot insert rows with Tenant B tenant id or parent ids. |
| Update isolation | Tenant A user cannot update Tenant B rows or locked quote/acceptance rows. |
| Delete/archive isolation | Tenant A user cannot archive/delete Tenant B files or records. |
| Command isolation | Commands reject mismatched tenant/parent ids even if the client submits them. |
| Storage isolation | Tenant A cannot list/read/download/sign Tenant B storage objects or spoof paths. |
| Unauthenticated access | Anonymous users cannot access privileged data or commands. |
| Service role containment | No browser bundle, route payload, logs, or env example exposes service-role secrets. |

RLS tests should run against local Supabase with migration reset once migrations exist.

## 10. Money And Tax Model

### Storage

- Currency defaults to `SEK`.
- Monetary values use integer öre (`bigint`), never floating-point kronor.
- Quantities use explicit decimal/numeric quantity plus unit.
- VAT rates use basis points, for example `2500` for 25.00%.
- Calculated line, section, quote, VAT, deduction, and accepted totals store exact öre values.

### Rounding

Conservative Phase A assumption:

- Calculate line net amount from quantity and unit price, then round to nearest öre.
- Calculate VAT per line from rounded line net and snapshotted VAT basis points, then round to nearest öre.
- Sum rounded line values for section and quote totals.
- Preserve exact öre in storage even if PDFs display whole kronor.

This assumption requires owner/accounting sign-off before real pilot use.

### VAT, ROT, And Gron Teknik

- VAT defaults are tenant settings, but quote versions snapshot exact VAT rates and amounts.
- ROT and grön teknik are estimates until owner/accounting/legal sign-off.
- Quote versions snapshot deduction type, eligible basis, rates/caps profile, persons/count, schablon choice if used, warnings, customer-visible wording, and resulting totals.
- Do not mix ROT and grön teknik unless a later approved rule explicitly supports it.
- Do not capture personnummer in Phase A unless explicitly approved later.

## 11. Quote Version Snapshot Model

`quotes` is the logical quote. `quote_versions` is the customer-commitment snapshot.

A quote version snapshot includes:

- tenant, quote, version number, lifecycle status
- source calculation id and snapshot timestamp
- tenant/company display identity
- customer/facility/contact display snapshot
- quote number and validity fields
- intro text, customer-visible notes, terms
- line/section display model
- base totals, option/tillval totals, VAT totals, deduction totals, accepted-price basis
- VAT and tax deduction assumptions
- selected attachments and display mode
- PDF render metadata and generated file reference
- warnings captured at snapshot time

Draft quote versions can be edited before send. Once sent:

- Customer-visible fields are immutable.
- Selected attachments are immutable.
- PDF source data is immutable.
- Customer-visible changes require a new quote version.

Accepted versions add immutable acceptance and job source references.

## 12. Quote PDF Generation Approach

PDF generation is a server-side command that reads only `quote_versions`, `quote_version_lines`, `quote_version_attachments`, and file metadata snapshots. It must not read mutable calculation rows, company settings, terms, customer records, or work-role/article prices as source of truth.

Recommended approach:

1. Build a deterministic `QuotePdfViewModel` from the quote version snapshot.
2. Render preview UI from the same view model where feasible.
3. Generate PDF server-side in Node.
4. Store the generated PDF in private Supabase Storage.
5. Write `files`, `file_links`, `quote_events`, and `audit_events` records.
6. Record render status: `not_generated`, `generating`, `generated`, or `failed`.
7. Allow retry for draft/sent versions without mutating snapshot content.

The exact PDF rendering library should be selected and pinned in the approved E5 quote/PDF implementation story. The architecture decision is the source-of-truth rule: PDF content comes from immutable quote version snapshots only.

Golden-master verification should include extracted PDF text and stable visual snapshots for representative quotes.

## 13. Acceptance-To-Job Transaction Design

`acceptQuoteAndCreateJob` is the highest-risk Phase A command and must be server-side, transactional, idempotent, tenant-scoped, and audited.

Inputs:

- sent `quote_version_id`
- acceptance channel
- `accepted_at`
- accepted price in öre
- adjustment reason/evidence if accepted price differs from sent total
- evidence file id or external reference
- notes
- planned start/end dates when available

Transaction steps:

1. Resolve user and active `tenant_admin` membership.
2. Lock the quote version and parent quote row.
3. Verify the quote version belongs to the tenant and is sent.
4. If acceptance/job already exists for this quote version, return existing records idempotently.
5. Validate accepted price and require reason/evidence for adjusted price.
6. Insert `quote_acceptances`.
7. Update quote/version lifecycle to accepted where applicable.
8. Insert minimal `jobs` record with immutable source quote version and acceptance references.
9. Insert `job_events`, `quote_events`, and `audit_events`.
10. Commit or roll back all changes together.

Uniqueness constraints should prevent duplicate acceptance/job records:

- one acceptance per accepted quote version
- one job source per quote acceptance

If any part fails, no acceptance or job should remain partially created.

## 14. File And Storage Model

Files are entity-scoped. A limited file index may exist for Phase A findability, but broad document-center behavior is not Phase A.

`files` metadata includes:

- tenant id
- storage bucket and object path
- display name
- MIME type
- size
- checksum/hash when available
- uploaded by
- lifecycle state: draft, linked, locked, archived, deleted
- created/updated timestamps

`file_links` includes:

- tenant id
- file id
- owner type: customer, facility, contact, calculation, quote_version, quote_acceptance, job
- owner id
- purpose: calculation_attachment, quote_attachment_snapshot, quote_pdf, acceptance_evidence, job_evidence, crm_document
- lifecycle lock fields

Storage rules:

- Private buckets only.
- Server-derived object paths.
- Short-lived signed URLs.
- MIME and size validation before usability.
- Generic access-denied messages for cross-tenant failures.
- Locked quote PDFs, selected quote attachments, and acceptance evidence cannot be replaced silently.
- Deletion of locked files is archive-only unless a later approved retention workflow says otherwise.

## 15. Audit Logging Model

Use `audit_events` as an append-only operational/security audit table, not as broad admin analytics.

Audit event fields:

- tenant id
- actor user id
- command name
- event type
- target type and target id
- request/correlation id
- before/after hashes or narrow metadata where useful
- user-safe reason/comment
- created at

Audit critical events:

- tenant membership changes
- settings and pricing changes
- calculation readiness overrides
- quote version creation
- quote sent
- PDF generated/failed
- acceptance recorded
- accepted price adjustment
- job created from quote
- file uploaded, linked, locked, archived/deleted, signed access created
- migration/coexistence comparison approval where represented in app

Do not store real secrets, `.env` values, raw file contents, broad free-text PII, or service-role details in audit metadata.

## 16. Migration And Coexistence Architecture

The old Lovable app remains:

- behavioral oracle
- fixture source after anonymization
- fallback for selected workflows until pilot gates pass

It is not:

- a code source by default
- the schema blueprint for v0
- a reason to activate deferred modules

Migration/coexistence assets should live primarily outside production app tables:

- `tests/fixtures/golden/lovable/**` for anonymized structured fixtures
- `tests/golden/**` for comparison tests
- `docs/migration/**` for classification, deltas, and fallback notes
- `scripts/migration/**` for approved, testable data capture/reset scripts when a migration story exists

Legacy records are classified as:

- live for pilot
- archive-only
- excluded
- deferred

Cutover is by workflow, not by whole company.

## 17. Golden-Master Fixture Strategy

Fixture principles:

- Preserve business shape, not real customer data.
- Remove or replace real names, phone numbers, emails, addresses, personnummer, organization numbers, sensitive notes, secrets, and raw customer files unless explicitly approved.
- Keep Lovable expected behavior and new-system expected behavior separate when an intentional delta exists.

Required fixture categories:

- two tenants with similarly shaped data for isolation tests
- CRM with private/company/BRF-like anonymized customers, facilities, contacts
- settings/pricing with work roles and optional article if needed
- calculation with labor, material, subcontractor, machinery, other, fractional quantity, margin, notes, attachments
- option/tillval behavior
- hidden row behavior
- VAT display modes
- ROT and grön teknik estimates, caps, invalid mixes, warnings
- quote version and PDF output
- sent immutability and new version after change
- acceptance with unchanged and adjusted accepted price
- idempotent accepted-quote-to-job
- file upload/type/size/signed URL/cross-tenant cases
- migration live/archive/excluded/deferred classification

Golden tests should compare money totals, tax blocks, quote-visible lines, PDF text, attachment selection, acceptance transition, and job source references.

## 18. Test Strategy

| Layer | Required coverage |
| --- | --- |
| Unit | Money arithmetic, rounding, VAT, ROT, grön teknik, quote totals, option/tillval, hidden rows, snapshot builders, lifecycle guards. |
| Server command integration | CRM commands, settings/pricing, calculation edits, quote version creation, mark sent, PDF metadata, acceptance-to-job, file commands. |
| RLS negative | Cross-tenant select/insert/update/delete for all tenant tables. |
| Storage negative | Cross-tenant object access, path spoofing, expired signed URLs, blocked MIME/size. |
| Golden-master | Lovable oracle calculations, quote/PDF output, acceptance transitions, accepted quote-to-job behavior. |
| Migration reset | Empty DB reset succeeds once migrations exist; seed fixtures create two tenants. |
| E2E | Tenant admin core workflow through UI for selected pilot case after product stories exist. |
| Docs/config-only | Lightweight file review and explicit skipped product gates. |

Product implementation PRs must not skip relevant gates silently.

## 19. CI And Quality Gates

Recommended CI stages for Phase A product work:

1. Install with the chosen package manager.
2. Typecheck.
3. Lint.
4. Unit tests.
5. Build.
6. Supabase migration reset from empty DB once migrations exist.
7. Integration command tests.
8. RLS/storage negative tests.
9. Golden-master comparison tests for money/tax/quote/PDF/acceptance where touched.
10. Secret scan or equivalent lightweight check before external beta hardening.

Docs-only PRs may run lighter checks but must state skipped product gates.

Every PR must include:

- scope statement and phase
- story/ADR/process link
- changed files
- checks run
- security/RLS impact
- data migration impact
- deferred-scope confirmation

## 20. Security Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Service-role leakage | No service-role key in browser/client paths; server-only minimal use; grep/test for public exposure. |
| Client tenant spoofing | Resolve tenant from membership; ignore or verify client tenant ids; RLS with tenant membership predicates. |
| RLS gaps | Enable RLS on every tenant table; cross-tenant negative tests for all modules. |
| Storage path spoofing | Server-derived paths, tenant-owned metadata, private buckets, signed URL command checks. |
| Public privileged endpoints | No unauthenticated privileged routes, functions, cron, webhooks, or public acceptance portal. |
| Mutable customer commitments | Sent quote versions, accepted references, acceptance evidence, and locked files immutable except audited correction. |
| Partial acceptance/job state | Single transaction and uniqueness constraints. |
| Money/tax drift | Integer öre, snapshotted assumptions, tests, golden masters, accounting/legal sign-off. |
| Personnummer/privacy creep | Exclude personnummer by default; minimize free-text PII; anonymize fixtures. |
| Deferred-scope schema creep | No production tables/routes/UI for Fortnox, supplier, AI, field, HR, rentals, assets, DoU, tender/FKU, full RBAC. |
| Audit becoming analytics | Audit is append-only traceability for critical events, surfaced in record context; no broad admin analytics module in Phase A. |

## 21. Explicit Architecture Seams For Future Expansion

These are documented extension boundaries only. They do not create Phase A production tables, jobs, credentials, routes, or UI.

### Fortnox

- Boundary: future billing/accounting adapter consumes accepted job/order or billing-basis domain events.
- Phase A: record accepted quote/job source data clearly enough for later billing-basis derivation.
- Not in Phase A: OAuth, external mappings, invoice sync, outbox, retries, webhooks, customer/article sync.

### Field Workflow

- Boundary: future field workflow can attach child work orders, time, materials, deviations, photos, and self-inspection to `jobs`.
- Phase A: `jobs` is a minimal accepted-work record from quote acceptance.
- Not in Phase A: installer mobile UX, schedule depth, reports, deviations, field photos, project analytics.

### Supplier Pricing

- Boundary: future pricing provider can update approved article/material price sources.
- Phase A: `articles` is optional/minimal and manual only if fixtures require it.
- Not in Phase A: supplier credentials, supplier IDs, APIs, imports, EDI, sync jobs.

### AI

- Boundary: future AI services may propose extraction, quote assistance, or document processing through reviewed server commands.
- Phase A: no AI mutation, no AI job tables, no autonomous agents.
- Not in Phase A: tender/FKU RAG, AI jobs, AI document mutation, public AI endpoints.

### RBAC

- Boundary: `tenant_memberships.role` can evolve beyond `tenant_admin`; command authorization and RLS helper functions isolate role checks.
- Phase A: only `tenant_admin` is active.
- Not in Phase A: full permission matrix, role management UI, installer/project-manager/economy/subcontractor roles.

## 22. Implementation Patterns And Consistency Rules

### Naming

- Database tables and columns use `snake_case`.
- TypeScript variables and functions use `camelCase`.
- React components use `PascalCase`.
- Route paths use lowercase kebab-case or simple nouns.
- IDs are named `<entity>Id` in TypeScript and `<entity>_id` in SQL.
- Tenant id is always `tenant_id` in SQL and `tenantId` in TypeScript.

### Data Formats

- API JSON uses camelCase.
- Database uses snake_case.
- Timestamps are stored as `timestamptz` and serialized as ISO strings.
- Money responses include integer öre fields and formatted display strings only at presentation boundaries.
- Errors use stable codes plus user-safe messages.

### Structure

- Domain command handlers live in `src/server/commands`.
- Money and tax pure logic lives in `src/lib/money` and `src/lib/tax`.
- Snapshot builders live in `src/lib/snapshots` or the relevant feature module.
- UI components are feature-scoped unless reused across domains.
- Tests are either co-located for small pure units or under `tests/` for integration/RLS/golden flows. Do not scatter RLS tests inside UI modules.

### Process

- Blocking validation and warnings are separate concepts.
- Lifecycle-locked records fail through command validation and database constraints, not just disabled buttons.
- File access always goes through metadata first, storage second.
- Internal notes are separate from customer-visible snapshot content.
- Corrections after acceptance are explicit audited workflows, not edits.

## 23. Requirements Coverage Validation

| Requirement area | Architecture coverage |
| --- | --- |
| Pooled multi-tenant foundation | `tenants`, `tenant_memberships`, RLS helpers, two-tenant tests. |
| `tenant_admin` only | Membership role constrained to `tenant_admin`; future RBAC documented only. |
| CRM | Customers, facilities, contacts, routes, commands, RLS. |
| Company/settings/pricing | Company settings, quote terms, work roles, optional minimal articles. |
| Calculations | Calculation tables, money/tax logic, sections/rows/options/visibility/files. |
| Quote versions/PDF/acceptance | Snapshot model, PDF command, immutable lifecycle, acceptance evidence. |
| Basic job/order | Transactional accepted-quote-to-job command and minimal job tables. |
| Required files | Entity-scoped files, private storage, signed URLs, lifecycle locks. |
| Migration/coexistence | Anonymized fixtures, docs/scripts, old app fallback, classification. |
| Golden masters | Fixture categories and test strategy. |
| Deferred modules | Explicitly absent from v0 schema/routes/UI. |

**Validation result:** READY FOR PHASE A IMPLEMENTATION STORIES, subject to story approval and sign-off questions below.

## 24. Open Architecture Questions

These questions should not block the architecture artifact. They must be answered before the relevant real pilot workflow is used.

| Area | Conservative Phase A assumption | Question |
| --- | --- | --- |
| Quote numbering | Tenant-scoped server counter. | What exact display format should quote numbers use? |
| Rounding | Line net and VAT rounded per line, totals sum rounded lines. | Should accounting require document-level VAT rounding instead? |
| VAT/ROT/grön teknik | Snapshot assumptions and treat deductions as estimates. | Which rates, caps, eligibility rules, schablon handling, BRF handling, and disclaimer text are approved? |
| Acceptance evidence | Admin records off-system evidence. | Which channels are sufficient for real pilot use: email, phone note, signed PDF, meeting note, other? |
| Accepted price changes | Allowed only with explicit reason/evidence. | Are adjusted accepted prices allowed operationally, and what proof is required? |
| Corrections | Locked after acceptance; audited correction path later. | What exact correction workflow is approved for accepted quote/job mistakes? |
| Required files | Entity-scoped required files only. | Which files are mandatory before quote send and before acceptance/job creation? |
| Articles | Excluded unless pilot fixtures require a minimal manual catalog. | Are reusable articles required for the first pilot calculations? |
| Customer/facility/contact requiredness | Facility/contact encouraged but not universally mandatory. | Which customer types and required CRM fields must Phase A enforce? |
| Job terminology | Use `Jobb/Order` until owner chooses. | Should the UI call the accepted-work record job, order, projekt, arbetsorder, or something else? |
| PDF renderer | Server-side snapshot renderer; exact library pinned in E5 story. | Which renderer best satisfies pilot PDF fidelity and deployment constraints after a small spike? |
| Legacy migration | Cut over selected workflows only. | Which Lovable records are live, archive-only, excluded, or deferred? |

## 25. Handoff Guidance

Implementation must proceed through approved Phase A stories or ADR-backed tasks. Recommended first stories:

1. Platform foundation: initialize clean Next.js/Supabase repo, package manager, CI, `.env.example`, local setup docs.
2. Tenant/Auth/RLS foundation with two-tenant negative tests.
3. CRM/settings/pricing schema and commands.
4. Money/tax pure logic and golden fixtures.
5. Calculations.
6. Quote versions/PDF/acceptance.
7. Accepted-quote-to-job transaction.
8. Required files/storage.
9. Migration/coexistence fixtures and fallback runbook.

Before any product implementation PR merges, confirm it does not include deferred modules, public privileged endpoints, service-role client access, unapproved migrations, unapproved dependencies, `.env` edits, or real secrets/customer data.
