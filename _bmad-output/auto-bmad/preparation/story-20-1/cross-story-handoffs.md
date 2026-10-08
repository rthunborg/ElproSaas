# E20 cross-story contracts and path ownership

Date:2026-10-08. Preparation base:`8ba0150cc60ac17ac378edac5ad77405e907d3bf`. All interfaces below are future product handoffs, not implemented APIs. Existing20.1 spec remains LF pin`ad9ae965b3cadbe5def211a7e1adc2e2bd77ceab81986930444b05844f96bef0`; no hot edit or runtime proof.20.2/20.3 draft author:`/root/documents_spec`, `gpt-6.1-sol` High. Root owns admission/pins/Git/PR; reviewer owns independent audit.

##20.1→20.2

Required verified product contracts: documents manifest activation/single`/files` nav and Documents.View matrix bound to existing Files roles; current-source exhaustive seven-owner registry; safe per-link read DTO/entitlements; complete stable bounded pagination; exact`createDocumentSignedAccessAction`/`document.signedAccess.create`, checked prepare/finalize, distinct source/link/purpose HMAC, locked-graph reconciliation/SQL ACL and current authority at final audit commit.20.2 reuses those signing functions unchanged; adds no generic signer/Storage policy or quote broker permission.

20.2 extends read query with literal name/type search, active module/owner/purpose/local-date bounds, active/archived mode and authorized-only facets/counts. It may add archived metadata mode but never passes an archived selected context into20.1 signing as eligible. Current quotePDF artifact provenance branch remains durable-kind-based, not ordinary link purpose. Filter/selection changes clear stale preview URL; cursor schema includes normalized filter identity and authorized anchor only.

20.2 lifecycle is distinct from selected-link byte access: existing Files.Edit + Documents.View/Files.View/source authority, full affected-link graph and fileFORUPDATE membership/ancestry locks. `document.archive`/`document.restore` use new checked local atomic audit RPCs; unchanged generic file_id RPC alone is not proof. Capture only unlocked ordinary linked archive origin with DB-owned field, no capture update on oldlocked/qPDF/draft; preserve10.9 guard. Locked restoration derives from all retained immutable locked links including archived links; any quote_pdf restore denied; no domain-link resurrection. Historical identity of a committed CHANGED transition is consumed across opposite operations, bound to selected link by fixed beforeHash; SQLDLC20 maps existingCOMMAND_CONFLICT. Fresh same-state no-op writes no audit and is not durably consumed; after an opposite change its retry evaluates current locked authority/state and may perform a new allowed change. No all-operation exactly-once/no-op receipt guarantee; response-loss UI refreshes authorized state and explicitly reconfirms any new change. No new audit key/receipt table/role/storage table/retention program.

Preparation PRs supply design only.20.2 cannot import APIs from another worktree or begin until20.1 verified product implementation is integrated and root repins actual path/migration/resource claims.

##20.2→20.3

Required verified product contracts: DocumentFilters parser/type/purpose/module/date/mode schema and URL state, safe authorization-before-filter/faceting, complete pagination and preview reset, checked lifecycle/entitlement contract and preserved shipped upload picker.20.3 adds atomic ownerType+ownerId context; ownerType alone stays a global20.2 filter. Mismatched/forged/duplicate tuple fails closed with no unfiltered fallback or source label/return route.

`DocumentContextRef={module,ownerType,ownerId}` uses the existing active registry. New `readDocumentContext` and `readEntityDocumentsLink` request-bound projections require current source ancestry and both Docs/Files capabilities. Success contains safe source label and a server-derived closed local return template; missing/archived/denied share generic unavailable, transient lookup remains retryable. No returnTo parameter, signed capability or new public endpoint.20.3 contextual facets/results/selection use the same owner tuple and still invoke20.1/20.2 action authority, never scope mutation to only the currently filtered visible links.

EntityFilePanel source paths: customer/facility/contact nested customer page; calculation page; job page; acceptance server wrapper on quote/version detail with its existing upload. quote_version link uses only current non-draft sent-version CommitmentFilesPanel wrapper on quote detail; draft/no-files null behavior stays unchanged, no extra version-detail panel. Add adjacent server anchors, preserve existing props and lock/upload/preview contracts. Contexts not in the shipped center picker do not auto-select a different owner; use existing owner-required entity upload via validated return. Generic quote_version upload remains unavailable.

## Exact prospective product/test paths

20.2 writes:

- `src/features/documents/filters.ts`
- `src/features/documents/date-bounds.ts`
- `src/features/documents/actions.ts`(20.1 provided; lifecycle actions only)
- `src/server/read-models/documents.ts`(20.1 provided; filters/mode/facets)
- `src/server/read-models/document-sources.ts`(20.1 provided; operation eligibility)
- `src/server/commands/documents/lifecycle.ts`
- `src/server/commands/documents/lifecycle-db.ts`
- `src/server/commands/envelope.ts`(two closed existing Files.Edit mappings)
- `src/components/documents/DocumentFilters.tsx`
- `src/components/documents/DocumentPreviewPane.tsx`
- `src/components/documents/DocumentLifecycleActions.tsx`
- `src/app/(app)/files/page.tsx`
- `supabase/migrations/` CLI-allocated basename`story_20_2_documents_lifecycle_origin_and_restore.sql`(actual timestamp path pinned before claims)
- `tests/unit/features/documents/filters.test.ts`
- `tests/unit/features/documents/date-bounds.test.ts`
- `tests/unit/features/documents/preview-state.test.ts`
- `tests/unit/server/commands/documents-lifecycle.test.ts`
- `tests/integration/commands/documents-lifecycle.int.test.ts`
- `tests/integration/commands/documents-lifecycle-lock-races.int.test.ts`
- `tests/integration/rls/documents-filter-archive.rls.test.ts`
- `tests/e2e/files/documents-search-preview-lifecycle.e2e.spec.ts`

20.3 writes:

- `src/features/documents/context-navigation.ts`
- `src/server/read-models/document-context.ts`
- `src/components/documents/EntityDocumentsLink.tsx`
- `src/features/documents/filters.ts`(20.2 provided; atomic context parser)
- `src/server/read-models/documents.ts`(20.1/20.2 provided; authorized context projection)
- `src/components/documents/DocumentFilters.tsx`(20.2 provided; context preservation/reset)
- `src/app/(app)/files/page.tsx`
- `src/app/(app)/customers/[customerId]/page.tsx`
- `src/app/(app)/calculations/[calculationId]/page.tsx`
- `src/app/(app)/jobs/[jobId]/page.tsx`
- `src/features/files/quote-files-panel.tsx`
- `src/features/files/acceptance-panel.tsx`
- `tests/unit/features/documents/context-navigation.test.ts`
- `tests/unit/server/read-models/document-context.test.ts`
- `tests/unit/components/documents/entity-documents-link.test.ts`
- `tests/integration/rls/documents-context.rls.test.ts`
- `tests/e2e/files/documents-context-navigation.e2e.spec.ts`

Generic EntityFilePanel/CommitmentFilesPanel/FileIndexUpload,20.1 HMAC/RPC signing, generic Storage/policy/matrix and historical migrations are read-only reuse boundaries unless a material contract change is reported for new reviewed scope. No wildcard whole-feature ownership by inference. Spec/provenance preparatory artifact paths belong to their author; aggregate state/admission is root-only.20.3 has no migration or schema claim.

## Semantic serialization

20.1→20.2→20.3 implementation dependencies are strict, despite all three specifications being prepared before first dispatch. Shared Documents read/page/filters/actions must be sequential; same permission/envelope registry, schema:migrations, files lifecycle/provenance/source-revision, quote review proof shape, existing entity-panel APIs and test-fixture/resource domains require actual reconciled claims.20.2 origin column invalidates whole-row source-revision proof shape safely; test stale-proof rejection, never alter authoritative quote fingerprint/10.9 guards to hide it. No unverified copied upstream changes or reused mutable DB/browser resource ownership.20.3 new-source adapters belong to each future activation story, never to pending scope in this release.

## Exact required check handoff

20.2 required names: `documents20-2-filter-unit`, `documents20-2-lifecycle-integration`, `documents20-2-browser` plus `unit`,`typecheck`,`lint`,`production-build`,`service-role-containment`,`bundle-containment`,`lockfiles` and20.1 selected-link/quote/lock regressions.20.3 names: `documents20-3-context-unit`,`documents20-3-context-integration`,`documents20-3-browser` plus the same general gates and changed20.1/20.2 boundary regressions. Exact argv is in each spec Verification section; mandatory DB/RLS use SUPABASE_TEST_REQUIRED=1 and report positive executed/zero skipped. Actual passing evidence must bind exact product result and combined integration revision; none is claimed by these docs.
