---
title: 'Creation entry points: Skapa ny offert / Skapa nytt jobb / Ladda upp fil'
type: 'feature'
baseline_commit: '6bf8fa28a0a5d479b4ada2241c4ca8b689e4101b'
created: '2026-07-14'
status: 'done'
context:
  - '_bmad-output/project-context.md'
  - 'docs/process/agent-workflow.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Offerter, Jobb/Order, and Filer list pages have no creation entry point — quotes can only be born via tests/direct command calls, jobs only via quote acceptance, and file upload only exists on entity detail panels.

**Approach:** Owner decision 2026-07-14: everything should be independently creatable and connectable. (1) Offerter: wire the existing `createQuoteVersionFromCalculation` command to a "Skapa ny offert" button with a calculation picker. (2) Jobb/Order: migration relaxing `jobs.quote_acceptance_id`/`quote_version_id` to nullable + new `createJob` command + "Skapa nytt jobb" form (customer required, title/planned dates optional). (3) Filer: "Ladda upp fil" button reusing `uploadFileAction` with an owner picker (customer/calculation/job).

## Boundaries & Constraints

**Always:** Follow the envelope command pattern (resolved tenant only, RLS anon client, never service-role); server action + `useActionState` + inline expanding form per `CalculationList` "Ny kalkyl" convention; Swedish labels; `data-testid` on new buttons; cross-tenant negative tests for the new command; integer-öre discipline untouched (no money fields here).

**Ask First:** Any change to the `jobs_source_ref_lock` trigger or to quote/acceptance immutability semantics; adding facility/contact pickers to the job form; any new file purpose or owner type.

**Never:** No standalone-job "connect to quote later" mechanism (locked tuple stays immutable — future audited workflow); no tenant-level/orphan files (owner stays required); no service-role paths; no delete affordances; no Fortnox/field-worker surface.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create quote | Picked own calculation | New quote version; navigate `/quotes/{quoteId}` | N/A |
| Create quote, foreign calc id | Crafted calc id from other tenant | Denied before execute | `TENANT_ACCESS_DENIED` generic message |
| No calculations exist | Empty picker | Button leads to hint linking `/calculations` | N/A |
| Create job | Own customer + optional title/dates | Job row (`status='created'`, NULL source refs) + `job_events` 'created' row; navigate `/jobs/{id}` | N/A |
| Create job, foreign customer | Other tenant's customer id | Denied before execute | `TENANT_ACCESS_DENIED` |
| Create job, inverted dates | end < start | Rejected | `VALIDATION_FAILED` |
| Acceptance-created jobs | Existing accept flow | Unchanged (source refs still populated) | N/A |
| Upload from Filer | Owner type+id + allowed file | File + link created; list refreshes | N/A |
| Upload, blocked type/too large | e.g. .exe / oversized | Rejected by existing validation | Existing four-state error mapping |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260709120000_acceptance_to_job_model.sql` -- jobs table: NOT NULL source refs to relax (new migration, never edit this one)
- `src/server/commands/jobs/{jobs.ts,validation.ts,index.ts,jobs-db.ts}` -- updateJob pattern to mirror for createJob
- `src/server/commands/quotes/quotes.ts:50` -- existing createQuoteVersionFromCalculation (returns targetId+quoteId)
- `src/features/quotes/actions.ts` -- action conventions (useActionState, revalidate discipline)
- `src/features/jobs/actions.ts` -- add createJobAction
- `src/features/files/actions.ts:98` -- uploadFileAction (reuse as-is; form fields owner_type/owner_id/purpose/file)
- `src/components/calculations/CalculationList.tsx:79-101` -- the inline-expanding create-form template
- `src/components/quotes/QuoteList.tsx`, `src/components/jobs/JobList.tsx`, `src/components/files/FileIndexList.tsx` -- list headers to extend
- `src/app/(app)/{quotes,jobs,files}/page.tsx` -- server components; add option fetches
- `src/components/crm/FormField.tsx` -- TextField/SelectField/FormErrorSummary primitives
- `tests/integration/rls/` + command unit/int tests -- coverage conventions to extend

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/<new>_standalone_job_creation.sql` -- `alter table public.jobs alter column quote_acceptance_id drop not null, alter column quote_version_id drop not null;` + comment updates -- standalone jobs (composite FKs/unique tolerate NULL; lock trigger untouched)
- [x] `src/server/commands/jobs/validation.ts` -- add `validateCreateJob` (closed key allow-list: customer_id required uuid; title/planned dates optional, reuse date+ordering rules) -- pure, unit-testable
- [x] `src/server/commands/jobs/create-job.ts` (+ export in `index.ts`) -- `createJob` defineCommand: ownership on `customers`, insert jobs row (resolved tenant, status 'created') + `job_events` 'created' row (clock-injected), envelope audit `job.created` -- mirrors updateJob/error mapping
- [x] `src/features/jobs/actions.ts` -- `createJobAction` (useActionState; revalidate `/jobs`) -- UI write path
- [x] `src/app/(app)/jobs/page.tsx` + `src/components/jobs/JobList.tsx` -- fetch customer options; header button "Skapa nytt jobb" (`data-testid="new-job-button"`) + inline form (customer select, title, planned dates); success → `router.push('/jobs/{id}')`; update empty-state text -- entry point
- [x] `src/features/quotes/actions.ts` (+ small action-state module) -- `createQuoteVersionFromCalculationAction` carrying `quoteId` in success state -- wire existing command
- [x] `src/app/(app)/quotes/page.tsx` + `src/components/quotes/QuoteList.tsx` -- fetch calculation options (id + label w/ customer name); header button "Skapa ny offert" (`data-testid="new-quote-button"`) + inline calc picker; success → `router.push('/quotes/{quoteId}')`; empty picker → hint linking `/calculations`; update empty-state text -- entry point
- [x] `src/app/(app)/files/page.tsx` + `src/components/files/FileIndexList.tsx` (or sibling `FileIndexUpload.tsx`) -- fetch owner options (customers, calculations, jobs); button "Ladda upp fil" (`data-testid="upload-file-button"`) + form: owner-type select → owner select → file input; purpose derived per owner type (customer→`crm_document`, calculation→`calculation_attachment`, job→`job_evidence`); submit via existing `uploadFileAction`; success → `router.refresh()` -- entry point
- [x] Tests -- unit: `validateCreateJob` edge cases (I/O matrix); integration: `createJob` happy path + cross-tenant customer deny + job_events row + audit row; check `tests/integration/rls/*migration-reset*` inventories for NOT NULL assertions on the two columns and update -- keep gates green (checked: the migration-reset/inventory suites assert NOT NULL only on `tenant_id`, never on the two source-ref columns — nothing to update; full int suite green post-migration)
- [x] `docs/process/demo-environment.md` NOT touched; note owner decision in `_bmad-output/implementation-artifacts/deferred-work.md` if "connect standalone items later" is deferred -- traceability

**Acceptance Criteria:**
- Given a tenant admin on /quotes with ≥1 calculation, when they pick it and submit, then a draft quote version exists and they land on its detail page.
- Given a tenant admin on /jobs, when they submit the form with an own-tenant customer, then a job with `status='created'`, NULL source refs, and a `job_events` 'created' row exists and they land on `/jobs/{id}`.
- Given the existing acceptance flow, when a sent quote is accepted, then job creation behaves exactly as before the migration.
- Given a tenant admin on /files, when they upload a valid file against a picked owner, then the file appears in the index without navigating away.
- Given tenant B ids (calculation or customer), when tenant A submits them, then the command denies with `TENANT_ACCESS_DENIED` and no row is written.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint` -- expected: clean
- `pnpm test` -- expected: all pass incl. new unit/integration tests (integration runs against local Supabase stack)
- `supabase db reset` (local) -- expected: migrations replay clean incl. the new one

**Manual checks (if no CLI):**
- Local app: all three buttons render, create/upload succeed, empty states updated.

## Suggested Review Order

**Standalone jobs — the data-model decision + new command (start here)**

- The one schema change: source refs become nullable per the 2026-07-14 owner decision.
  [`20260714095225_standalone_job_creation.sql:19`](../../supabase/migrations/20260714095225_standalone_job_creation.sql#L19)

- New envelope command: customer ownership check, resolved tenant, NULL refs, 'created' event, audited.
  [`create-job.ts:38`](../../src/server/commands/jobs/create-job.ts#L38)

- Closed key allow-list validator — source refs/status/tenant cannot be smuggled.
  [`validation.ts:109`](../../src/server/commands/jobs/validation.ts#L109)

**Job read/detail with NULL source refs**

- Both-NULL = standalone branch; exactly-one-NULL still throws as a broken ref.
  [`read.ts:246`](../../src/features/jobs/read.ts#L246)

- Standalone origin note instead of a commitment block; no fabricated money.
  [`JobDetailView.tsx:100`](../../src/components/jobs/JobDetailView.tsx#L100)

- Null money renders an em dash, never 0 kr (R-708 never-mask).
  [`JobDetailView.tsx:164`](../../src/components/jobs/JobDetailView.tsx#L164)

**Jobb/Order entry point**

- "Skapa nytt jobb" inline form (customer required); double-submit guarded.
  [`JobList.tsx:141`](../../src/components/jobs/JobList.tsx#L141)

- Server action: list+detail revalidation, useActionState contract.
  [`actions.ts:111`](../../src/features/jobs/actions.ts#L111)

- Standalone jobs stay filterable: "Utan källoffert" sentinel option.
  [`JobList.tsx:45`](../../src/components/jobs/JobList.tsx#L45)

**Offerter entry point**

- First UI wiring of the pre-existing createQuoteVersionFromCalculation command.
  [`actions.ts:403`](../../src/features/quotes/actions.ts#L403)

- Calc picker form; success navigates to the new quote's detail.
  [`QuoteList.tsx:78`](../../src/components/quotes/QuoteList.tsx#L78)

**Filer upload entry point**

- Owner picker → derived purpose → existing validated uploadFileAction, verbatim.
  [`FileIndexUpload.tsx:102`](../../src/components/files/FileIndexUpload.tsx#L102)

- Key-remount on success resets the form (avoids setState-in-effect lint).
  [`FileIndexUpload.tsx:113`](../../src/components/files/FileIndexUpload.tsx#L113)

- Options fetched server-side; load errors surfaced, not masked as empty states.
  [`page.tsx:34`](../../src/app/(app)/files/page.tsx#L34)

**Peripherals (tests, artifacts)**

- Command integration proof: happy path, cross-tenant deny writes nothing, event + audit rows.
  [`create-job.int.test.ts:51`](../../tests/integration/commands/create-job.int.test.ts#L51)

- Standalone detail read proven by poisoning the acceptance/version tables.
  [`job-read-mapping.int.test.ts:291`](../../tests/integration/features/jobs/job-read-mapping.int.test.ts#L291)

- Validator edge cases (smuggle matrix, dates, bounds).
  [`create-job-validation.test.ts:1`](../../tests/unit/server/commands/create-job-validation.test.ts#L1)

- Review-sourced deferred items (atomic create RPC, readiness gating, archived-customer rule).
  [`deferred-work.md:1`](deferred-work.md#L1)
