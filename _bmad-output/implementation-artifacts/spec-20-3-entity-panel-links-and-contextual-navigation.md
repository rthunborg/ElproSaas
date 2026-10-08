---
title: Entity-panel links and contextual navigation
type: feature
created: "2026-10-08"
status: blocked
review_loop_iteration: 0
followup_review_recommended: false
warnings: [oversized]
deferred: []
story_id: "20.3"
canonical_story_key: "20-3-entity-panel-links-and-contextual-navigation"
epic: E20
baseline_revision: 8ba0150cc60ac17ac378edac5ad77405e907d3bf
preparation_branch: codex/documents-later-story-preparation
implementation_authorized: false
context:
  - AGENTS.md
  - docs/process/agent-model-routing.md
  - docs/process/review-order.md
  - _bmad-output/planning-artifacts/early-b2-documents-checkpoint-2026-10-07.md
  - _bmad-output/implementation-artifacts/spec-20-1-documents-activation-and-source-authorized-aggregation.md
  - _bmad-output/implementation-artifacts/spec-20-2-search-filters-preview-and-archive-restore.md
  - _bmad-output/auto-bmad/preparation/story-20-1/cross-story-handoffs.md
---

# Story20.3: Entity-panel links and contextual navigation

## Preparation disposition

Full canonical blocked specification draft on integrated preparation base`8ba0150cc60ac17ac378edac5ad77405e907d3bf`. Product build prerequisites are verified integrated20.1 and20.2, not merely merged preparation docs. All three specs require audit/pins and oracle/checkpoint closure before first E20 dispatch. This story neither activates Documents nor moves the nav swap from20.1. Author:`/root/documents_spec`, `gpt-6.1-sol` High, source/context authorization. No implementation, migration, new owner/table/capability, environment/dependency/service/run/claim/Git/merge/deploy action in preparation.

<intent-contract>

## Intent

**Problem:** Entity users need an authorized route from the file panel into the Documents center while preserving the selected entity context and avoiding forged-context authority or accidental uploads to a different owner.

**Approach:** Add`Visa i Dokument` only to integrated active entity-file surfaces. Resolve each source through the20.1 current-authority registry, build a fixed local context URL, and revalidate the source tuple at the20.2 center read boundary before contextual results/labels or return navigation are exposed.

## Boundaries & Constraints

**Always:** Current active membership, Documents.View, Files.View and source capability/RLS/live ancestry. URL/query parameters are navigation intent only, never authorization. Same selected-link signing and file-level lifecycle contracts apply after contextual navigation. Shipped owner-required entity uploads and the existing center owner picker remain intact.

**Block If:** Product20.1/20.2 handoffs are unintegrated, a currently active owner has no compatible adapter or actual panel path, independent High context review/oracle/checkpoint/shared admission is unresolved. A future activated source must add its own compatible adapter/tests before release.

**Never:** Add pending module panels/routes/owners, create public/customer-portal acceptance/login, introduce returnTo/open redirects or global upload, infer source access from a displayed name/route ID, turn unavailable context into an unfiltered list, widen quote_version generic upload eligibility or create a second nav destination.

## Exact context interface and validation

New`src/features/documents/context-navigation.ts` defines`DocumentContextRef={module:ActiveSourceModuleId,ownerType:ActiveOwnerType,ownerId:UUID}` and pure`buildDocumentsContextHref(ref,retainedFilters?)`. Generated href is fixed`/files?module=<registry-module>&ownerType=<known-owner>&ownerId=<UUID>` with URLSearchParams encoding and optional valid20.2 search/date/purpose/mode state. No arbitrary destination/returnTo parameter; normal browser navigation preserves prior history. Context changes reset pagination cursor and previous selected preview/URL.

New server`src/server/read-models/document-context.ts` exports`readDocumentContext(ref)` and`readEntityDocumentsLink(ref)`, using request-bound anon-key source RLS and20.1 adapter/live graph. Return typed`{data:null,entitlements:{canOpenDocuments:false},state:'unavailable'|'error'}` without denied labels/IDs/routes for unavailable/denied/archived/unknown source; transient backend failure is retryable error, not absence. Success has safe source label/ref and server-derived contextReturnHref only. Entry state has no signed URL, Storage identity, snapshot/economy fields or role matrix. No unscoped cached result.

The center server read parser treats ownerType+ownerId as an atomic tuple; ownerType alone remains the20.2 global filter. ownerId without ownerType, duplicate/unknown/malformed keys, wrong module/type mapping and invalid UUID are invalid context and produce generic unavailable/validation state, no unfiltered fallback. A syntactically valid unavailable source uses the same generic unavailable result whether missing, archived, inaccessible or wrong tenant. Independently validate optional purpose against type and active registry. Current authorized source label is derived afresh; never echo a client label or resolve an inaccessible parent for a breadcrumb. Authorized source with zero eligible links produces a meaningful contextual empty state without implying hidden file absence/counts.

Source matrix: customer/facility/contact require Customers.View and live CRM ancestry; calculation requires Calculations.View/live header; job requires Jobs.ViewAll/live job; quote_version requires Quotes.View/live version+quote; quote_acceptance additionally direct acceptance RLS/live acceptance/version/quote. All require Documents.View and Files.View; quote Sales-only visibility does not grant center access. Existing source properties determine authorization; a static module label is not authority.

## Integrated panel and return-route adapters

| Owner | Current compatible panel / containing route | Validated contextual return route |
| --- | --- | --- |
| customer | `src/app/(app)/customers/[customerId]/page.tsx`, EntityFilePanel customer | `/customers/<customerId>` |
| facility | Same customer page's facility EntityFilePanel, using live source parent | `/customers/<facility.customer_id>` |
| contact | Same customer page's contact EntityFilePanel, using live source ancestry | `/customers/<contact.customer_id>` |
| calculation | `src/app/(app)/calculations/[calculationId]/page.tsx`, EntityFilePanel | `/calculations/<calculationId>` |
| job | `src/app/(app)/jobs/[jobId]/page.tsx`, EntityFilePanel | `/jobs/<jobId>` |
| quote_version | `src/features/files/quote-files-panel.tsx` renders the integrated non-draft sent-version CommitmentFilesPanel into quote detail; empty/draft wrapper remains null | `/quotes/<validatedQuoteId>/versions/<versionId>` |
| quote_acceptance | `src/features/files/acceptance-panel.tsx` renders acceptance EntityFilePanel on quote/version details, retaining existing acceptance-evidence upload | `/quotes/<validatedQuoteId>/versions/<validatedVersionId>` |

`src/components/documents/EntityDocumentsLink.tsx` is a minimal server-rendered anchor taking a success projection from readEntityDocumentsLink, label`Visa i Dokument`; no client auth computation. Add optional server-computed documentsHref to compatible existing panel props or render adjacent in the containing server wrapper; choose the adjacent wrapper approach for CommitmentFilesPanel to preserve its specialized read-only lock contract. Customer/calculation/job pages compute links in their existing authorized server data flow. Render for compatible sources regardless of whether eligible files are currently empty, but only after source and center access checks. Unsupported/unavailable source renders no link and no fabricated source label.

Do not add a fake draft/empty quote panel or new quote document route just to satisfy an adapter row. quote_version coverage uses only the listed integrated non-draft sent-version wrapper and center registry; no additional version-detail panel is required. Adjacent server-wrapper anchors preserve sent wrapper's null/locked behavior and acceptance EntityFilePanel's existing upload. Every source adapter's actual listed insertion path is tested before claims.

## Navigation, selection and upload contract

On navigation, server validates context then restricts every query/result/facet and optional selected link to that same owner tuple. Same file in another authorized owner remains a separate context, not substitution for a selected unavailable link. Selecting a file signs only via20.1 current selected-link action; contextual URL does not carry a signed capability. Archive/restore use20.2 all-link checks even in a one-owner filtered view.

Back/browser history restores entity route/center filters through normal local navigation; use a server-derived return anchor only on success, never a caller-provided return URL. Selection/filter/back navigation clears stale preview and keeps keyboard focus predictable;360×640 context heading/return and list controls remain reachable. Missing/archived/denied context yields generic`Dokumentkontexten är inte tillgänglig` and neutral link to the authorized center root only as an explicit user choice, not automatic fallback; no denied entity label. Transient context lookup shows`Försök igen` and returns no results/return route until a fresh check succeeds.

Retain the shipped list owner picker and existing entity upload commands/forms. Only existing supported picker owners(customer/calculation/job) may be preselected after current-context validation; never substitute a facility/contact's customer as its upload owner. For source contexts not represented in the current picker, no automatic upload owner is chosen; the entity's existing owner-required upload remains reachable through the safe return route. quote_version remains non-creatable by generic commands. A manually chosen picker owner is shown explicitly and revalidated by existing upload authority; viewing one context never authorizes or silently redirects an upload to another. No new owners, bytes duplication, ownerless global upload or permission expansion.

Proposed labels/empty/navigation behavior require the existing unresolved live Lovable terminology/interaction check. No oracle observation is claimed; no new browser probe or waiver belongs to this lane.

## Acceptance criteria

1. Given a currently authorized compatible active source panel, when opened, then`Visa i Dokument` links to the sole center with its exact validated module/owner tuple; denied roles/pending/unknown sources render no link and no extra route/owner. Activation/nav remain20.1.
2. Given direct or forged context query, when the center reads, then malformed, mismatched, duplicate, missing, cross-tenant, archived or inaccessible source produces generic unavailable/validation/no-results state without owner label/return-route leakage or unfiltered fallback; transient error remains retryable.
3. Given authorized source and same-file links to multiple owners, when contextual results are shown or an optional selection is requested, then only exact matching current-authorized links appear; opening/refresh and archive/restore retain20.1/20.2 authority and no alternate-link bypass.
4. Given entity→center→back/return flow at desktop and360×640, when filters/selection/history change, then source context/valid filters and focus remain coherent and stale preview URL is cleared; every return route derives from authorized source ancestry and stays a fixed local app path.
5. Given facility/contact/quote_version or other context not in the shipped picker, when upload is offered, then no different owner is auto-selected or newly made creatable; current entity owner-required upload and center owner picker remain available under existing authority.
6. Given later source activation, when its files are enrolled, then its story must provide current-authority/context/panel/route/purpose adapters and source tests; this story touches no pending panels/schema and coherence fails loudly for missing active adapter.
7. Given actual final browser/integration evidence, when reviewed, then at least CRM child and locked quote/acceptance contexts, job/calculation paths, same-file/multiple links, denied source/role, source revocation, direct forged query, back navigation and phone viewport are exercised through real surfaces with no skipped required coverage or fabricated oracle proof.

</intent-contract>

## Code Map and tasks

Exact future writes: `src/features/documents/context-navigation.ts`; `src/server/read-models/document-context.ts`; `src/components/documents/EntityDocumentsLink.tsx`; `src/app/(app)/files/page.tsx`;20.2 filters/serverread context integration; `src/app/(app)/customers/[customerId]/page.tsx`; `src/app/(app)/calculations/[calculationId]/page.tsx`; `src/app/(app)/jobs/[jobId]/page.tsx`; `src/features/files/quote-files-panel.tsx`; `src/features/files/acceptance-panel.tsx`. Prefer adjacent server wrapper links, so generic EntityFilePanel/CommitmentFilesPanel internals are read-only unless a verified prop change is explicitly claimed. No new migration, signing wrapper, capability matrix or manifest activation.

- [ ]1. Verify integrated20.1/20.2 contracts and final adapter/panel inventory; root reconciles actual shared panel claims and oracle/checkpoint admission before implementation.
- [ ]2. Implement pure context URL/validation contract and server current-authority read using exact paths; unit/real RLS proof for malformed, hidden and archived ancestors; AC1–3,6.
- [ ]3. Render safe server anchor in the listed compatible source pages/wrappers; preserve lock/preview/upload contracts and role gates; no unapproved version panel creation; AC1,5.
- [ ]4. Wire center context parser/query/facet/return state and stale selection reset into20.2 filters/read/page; normal history/local safe returns/mobile/focus tests; AC2–4.
- [ ]5. Run required checks/independent High review on exact result. Implementation author adds one verified Suggested Review Order only after actual code and evidence; root owns aggregate state/integration.

## Verification

Future required checks (none executed):

- documents20-3-context-unit:`node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/features/documents/context-navigation.test.ts tests/unit/server/read-models/document-context.test.ts tests/unit/components/documents/entity-documents-link.test.ts`.
- documents20-3-context-integration:`pnpm exec vitest run tests/integration/rls/documents-context.rls.test.ts`; `SUPABASE_TEST_REQUIRED=1`, positive executed/zero skipped; all seven sources/role sets/two tenants/required ancestors, stale context, forged tuples/return URLs, exact filtered link and unchanged upload authority.
- documents20-3-browser:`pnpm exec playwright test tests/e2e/files/documents-context-navigation.e2e.spec.ts`; production web server, actual customer child/calculation/job/quote/acceptance panels, center read/open/history/return/phone flows. Supplied mocked href alone is not browser evidence.
- existing20.1 selected-link signing and20.2 lifecycle/filter/browser regression suites remain required for changed shared read/page boundaries; unit/typecheck/lint/build/scope/security/bundle/lockfile checks retained. Exact result/environment/executed/failed/skipped records required; source inspection is not execution.

## Spec Change Log

2026-10-08: Full20.3 blocked preparation draft; explicit current-source tuple/URL/return/panel/upload adapters and exact checks. No new route/owner/portal/signing policy and no oracle/readiness claim.

## Auto Run Result

Status: blocked
Blocking condition: live Documents oracle disposition/full checkpoint closure unavailable; independent exact20.3 context/spec review and cross-story admission pending;20.1/20.2 product implementations not integrated. No ready-for-dev or implementation authorization claimed.
