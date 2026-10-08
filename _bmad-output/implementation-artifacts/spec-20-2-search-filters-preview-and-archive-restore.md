---
title: Search, filters, preview and archive/restore
type: feature
created: "2026-10-08"
status: blocked
review_loop_iteration: 0
followup_review_recommended: false
warnings: [oversized]
deferred: []
story_id: "20.2"
canonical_story_key: "20-2-search-filters-preview-and-archive-restore"
epic: E20
baseline_revision: 8ba0150cc60ac17ac378edac5ad77405e907d3bf
preparation_branch: codex/documents-later-story-preparation
implementation_authorized: false
context:
  - AGENTS.md
  - docs/process/agent-model-routing.md
  - docs/process/review-order.md
  - _bmad-output/planning-artifacts/early-b2-documents-checkpoint-2026-10-07.md
  - _bmad-output/planning-artifacts/ux-design-specification-phase-b.md
  - docs/decisions/ADR-B008-quote-review-authority-and-derived-artifact-validity.md
  - _bmad-output/implementation-artifacts/spec-20-1-documents-activation-and-source-authorized-aggregation.md
  - _bmad-output/auto-bmad/preparation/story-20-1/selected-link-contract-design.md
  - _bmad-output/auto-bmad/preparation/story-20-1/cross-story-handoffs.md
---

# Story20.2: Search, filters, preview and archive/restore

## Preparation disposition

Full canonical specification draft on integrated preparation base`8ba0150cc60ac17ac378edac5ad77405e907d3bf`(PR91 contract preparation integrated). This is future design, not implemented20.1 APIs or runtime proof. Build prerequisite:20.1 product implementation verified integrated with the handoff contracts below. All20.1–20.3 specs must be complete/audited/pinned before first E20 dispatch, and oracle/checkpoint admission remains open. Owner optionA is fixed: Documents selected-source access, unchanged baseline generic Files.View/direct Storage authority and issued-URL lifetime. No global policyB/retention/physical deletion/new storage store is authorized.

Author:`/root/documents_spec`, `gpt-6.1-sol` High, sensitive source-authority/lifecycle design. Independent review/pins are root/reviewer-owned. No product, SQL, migration, environment/dependency, service, claim, aggregate planning, merge or deploy action occurred in preparation.

<intent-contract>

## Intent

**Problem:** The minimally usable20.1 destination needs the FR109 search/filter/preview and audited archive/restore parity surface without widening file/source authority or undoing durable commitment/provenance guards.

**Approach:** Extend the existing authorized per-link read with deterministic URL-backed filters and a selection-safe preview pane. Add bounded Documents file-lifecycle commands whose checked database transaction validates every affected source link, retains immutable locks/identity/bytes and restores only proven ordinary-file states.

## Boundaries & Constraints

**Always:** Active membership, Documents.View, Files.View, source capability/RLS and current selected-link eligibility for reads/access. Mutations additionally require existing Files.Edit and all affected context authority; roles remain tenant_admin/projektledare from the existing matrix. Source mutability means permission for this sanctioned file operation, not permission to rewrite sent quote/acceptance content. Preserve20.1's exact selected-link signing contract, key domains, command mapping, locked-graph reconciliation and final-audit linearization.

**Block If:**20.1 product contracts are not integrated, exact migration/path/shared claims or mandatory DB/browser checks are unavailable, independent High review is unresolved, oracle/checkpoint is unclosed, or historical restore origin is unknown/inconsistent. Unknown restoration eligibility disables that record's restore, not a fabricated safe default.

**Never:** Restore a quote_pdf artifact, clear locks, change/recreate archived domain links, relink evidence, replace bytes/identity, restore deleted/unlinked reservations, introduce content search/folders/editor/AI/portal/retention or grant Montör/Säljare/Ekonomi new Files entitlements. No pending-owner facets or labels.

## Query and display contract

`/files` remains the sole destination. `DocumentFilters` has`q`, `module`, `ownerType`, `purpose`, `from`, `to`, `mode`(`active` default or`archived`) and`cursor`. Optional ownerId is reserved for20.3's validated ownerType+ownerId context, not a20.2 authority grant. Reject duplicated parameters, unknown mode/module/type/purpose and invalid combinations; never convert an invalid query into an unfiltered global list. Known active module/type/purpose values must match the registry and current capability; unknown/pending values fail closed without labels/results.

Search is trimmed, case-insensitive literal substring in file display_name or MIME type only; `%`, `_` and regex characters are literals, not SQL wildcards. No file-content/owner-PII/full-text indexing. Module/type/purpose/date constraints combine with AND; authorization precedes all filtering/count/faceting. Facet counts apply all other filters except that facet's own value, only over authorized metadata in the chosen lifecycle mode. Preserve selected known facet value when it has zero matches; no unauthorized source labels/counts/options are inferred.

Date is file_link.created_at displayed as Swedish dates in Europe/Stockholm, consistent with the recorded regional convention; no new per-tenant timezone setting. `from`/`to` are genuine Gregorian`YYYY-MM-DD`, independently optional. Inclusive dates convert to UTC `[local midnight(from), local midnight(day-after-to))`; use IANA rules, not adding24UTC hours. Empty means unbounded; impossible/reversed ranges yield explicit validation error and no read. DST23/25-hour days are unit-covered. Stable ordering is`created_at DESC,id DESC`; page size50, server bounded complete candidate traversal inherited from20.1. Cursor only represents the last authorized returned link tuple plus normalized filter identity; no hidden candidate IDs/counts. Validate schema/filter consistency/current authorized anchor without treating cursor values as authority. Revoked/changed anchors produce a generic refresh state, not hidden details or silent truncation. Counts/facets/results share the same current authorized projection; no auth-bearing cache across requests.

## Preview and state contract

`DocumentPreviewPane` selection identity is linkId+fileId. Each open/refresh uses20.1 `createDocumentSignedAccessAction` and its new checked prepare/finalize/HMAC contract unchanged. Selection/filter/mode/tenant change immediately clears prior URL/content/error; delayed responses update only the matching latest selection/request. Archived context never signs, even if the same file has another active context. Render supported image/PDF formats using established preview components; otherwise show authorized download. Expired URL shows`Åtkomsten har gått ut` with explicit`Förnya åtkomst`; denial shows neutral unavailable text, transient failure`Försök igen`. No automatic success or stale previous-file preview. Switched/hidden panes release object/browser references without deleting stored files.

Labels are proposed Swedish copy grounded in approved patterns:`Dokument`, `Sök dokument`, `Modul`, `Typ`, `Syfte`, `Från`, `Till`, `Aktiva`, `Arkiverade`, `Förhandsvisa`, `Ladda ned`, `Arkivera`, `Återställ`. Live oracle vocabulary/preview/archive interactions remain unobserved; these labels are not claimed legacy evidence. Desktop master/list-preview layout collapses to connected360×640 list/detail with reachable back, retained filters and keyboard focus. Loading, authorized-empty, filtered-empty, invalid filter, retry, unavailable selection and archive/restore pending/error/confirmed states are explicit. UI uses server-projected entitlements and confirms success only after persistence.

## File-level mutation and authority contract

Archive confirmation states`Filen arkiveras för alla sina kopplingar` without disclosing hidden owner names, IDs or link counts. Server-projected canArchive/canRestore are hints; checked command/RPC remains authority. Disabled action explains only generic unavailability or the already visible immutable artifact restriction. A visible link never authorizes a file-level change affecting another hidden/non-mutable/unknown source context.

Commands in`src/server/commands/documents/lifecycle.ts`: `archiveDocument` (`document.archive`, event`file.archived`) and`restoreDocument` (`document.restore`, event`file.restored`), target type`file`, auditable false(atomic checked SQL owns one success event). Add envelope command mapping for both to existing `{module:'files',capability:'Files.Edit'}`; additionally require current Documents.View/Files.View and checked source authority. Do not invent Documents.Edit/Restore or require/claim a new archive role. Actions`archiveDocumentAction`/`restoreDocumentAction` accept exactly`{link_id:UUID,file_id:UUID}`; reject all extra tenant/path/state/role/lock/reason/hard-delete parameters. Documents archive passes fixed null reason to the checked RPC; no new reason-input UI/policy. Server creates correlation; response-loss retry retains the same logical operation identity, never arbitrary client-selected state.

New authenticated checked RPCs are`archive_document_with_audit(p_tenant_id uuid,p_actor_user_id uuid,p_link_id uuid,p_file_id uuid,p_correlation_id uuid,p_reason text)` and`restore_document_with_audit(p_tenant_id uuid,p_actor_user_id uuid,p_link_id uuid,p_file_id uuid,p_correlation_id uuid)`, each returns`{file_id uuid,changed boolean,lifecycle_state text}`. SECURITY DEFINER follows existing checked audit/Vault-free command pattern, empty search_path, explicit auth.uid/actor/current membership/role/tenant/source predicates; revoke PUBLIC/anon/service_role EXECUTE, grant authenticated only. No raw file/link DML is re-granted. Reject unknown actor/tenant/context generically; lock/tax/provenance guards are not bypassed.

Both RPCs derive ALL persisted links for this tenant/file, not merely visible links or selected link. Require at least one live selected link; derive/lock all source ancestry and validate every affected owner/purpose against current active adapters, same-tenant/live source rules and operation mutability. Independently archived links stay archived, but still contribute immutable lock history and source authority to a file-level mutation; an unknown/gone/inaccessible/non-mutable owner denies the whole operation. Do not serialize denied contexts into read DTOs/errors. Durable artifact_kind selects provenance branch regardless of apparent link purpose; ordinarybranch requires null. Archive of current/reserved unsent quote_pdf is prohibited; locked quote_pdf may use the established archive-over-delete transition only when exact current quote authority permits and all other affected contexts are eligible. **Every quote_pdf restore is prohibited by existing10.9 irreversible archival guard**; no new trigger exception.

Serialize file-wide link population by taking file row`FOR UPDATE` BEFORE authoritative complete-link-set evaluation (same-tenant FK insertion's key-share conflicts), then gather full link/parent graph and acquire SHARE/UPDATE locks in deterministic table/ID order. Re-read the complete link set after locks and require equality; file FOR SHARE alone is insufficient. Membership/role changes serialize as in20.1. Reconcile every current ancestry reference to the exact locked graph; changed graph fails/retries acquisition, never authorizes an unlocked replacement. Existing writer lock order/deadlocks/timeouts require no-success retry, not skipped locks. Final eligibility/transition/update/audit commit atomically. Later revocation or generic postcommit link creation does not retroactively revoke the mutation; baseline generic link creation is not globally closed by this story.

Under the file lock, BEFORE any update, check historical audit identity for a **previously committed CHANGED transition**:`tenant+file+actor+command+correlation`, fixed event/target semantics. Such a transition is consumed across opposite changes: changed archive(C1)→changed restore(C2)→replay archive(C1) must NEVER archive again. If current state still matches the committed changed transition, return a checked reconciled changed=false result without duplicate audit; if an opposite transition intervened, reject with SQL`DLC20` mapped to existing`COMMAND_CONFLICT`, no update/audit. Never assume the private audit helper enforces correlation uniqueness. Bind selected link with DB-derived SHA256 of canonical`tenant,file,actor,command,correlation,link` identity in existing allow-listed`beforeHash`; compare the fixed digest, not arbitrary metadata. Concurrent same-identity calls serialize on file row/historical lookup. No new audit key/receipt table/source names/path/tokens.

A fresh same-state no-op returns changed=false and writes no audit, matching the existing generic archive convention; its correlation is **not durably consumed**. A later retry of that no-op after an opposite change performs a fresh locked current-authority/state evaluation and may become a newly committed changed transition. Example: no-op restore(C0) while linked→changed archive(C1)→restore(C0) can restore only if all current guards permit; it is not a replay of an audited changed restore. There is no all-operation exactly-once or no-op receipt guarantee. Response-loss UI refreshes current authorized state and requires explicit current confirmation before a retry that could change state; no blind/automatic lifecycle retry or stale success. A previously CHANGED transition retains the consumed-history guarantee above. Tests distinguish both cases and assert current source/role/provenance checks and truthful changed result.

## Explicit restore transition/provenance matrix

Add one nullable bounded provenance column on existing files:`archive_previous_state text CHECK(value='linked')`, not a new storage/history table. DB capture writes linked ONLY for ordinary/null-kind OLD linked file without persistent locked link history on a genuine linked→archived transition. Old locked ordinary rows keep the capture column unchanged and recover locked destination only from immutable retained link history; quote_pdf/unknown-kind/draft rows never get a capture update. Archived→archived retry preserves value; later genuine unlocked linked→archived captures linked again. No backfill invents old state; legacy NULL stays unknown. Generic/domain archive routes may gain this eligible ordinary history capture without changing authority/input/audit semantics. Direct files UPDATE remains revoked. Keep existing10.9 all-row immutability guard unchanged: capture modifies no extra field on OLD locked or any quote_pdf row.

The origin column is DB-owned: BEFORE INSERT forcibly initializes it toNULL regardless of a privileged writer's supplied value; on UPDATE, a nontransition/client-supplied change raises a constraint error, except the capture trigger's narrowly derived genuine unlocked ordinary linked→archived assignment. Reject attempts to insert/set/clear/forge it via raw authenticated DML or a checked RPC payload; no origin argument exists. Restores leave origin unchanged. No provenance from timestamps/audit guesses/missing locks. Adding a files column changes whole-row source-revision serialization: outstanding quote-review proofs may become stale and must fail closed/re-review under existing checks; do not claim identical source hash shape or weaken validation/PDF content fingerprint.

| State/context | Archive | Restore destination and rule |
| --- | --- | --- |
| Ordinary/null-kind linked, live authorized full graph | archived; origin linked captured | linked only if origin linked is proven and no retained locked link; preserve object identity/bytes and all links. |
| Ordinary locked commitment evidence | archive-over-delete; capture column unchanged under existing guard | locked only when persistent is_locked/locked_at link history proves it, INCLUDING independently archived links; never linked/draft. All affected source authority still required. |
| Legacy ordinary archived, unknown NULL origin | checked no-op | only locked when immutable retained lock history proves it; otherwise unavailable, no default linked. No fabricated historical backfill. |
| Ordinary draft/orphan/unlinked reservation | not eligible Documents operation | denied; origin draft never becomes linked. |
| quote_pdf, any archived artifact | archive only under existing locked/current-authority allowance | always denied; preserve10.9 guard, current pointer/fingerprint/render/provenance unchanged. |
| Unknown artifact kind/deleted metadata/missing bytes | denied | denied, no byte recreation or lifecycle resurrection. |
| Archived selected domain link | inspect metadata if source eligible | no center relink/restore; archived_at/is_locked/locked_at/owner/file identity remain unchanged. A different live context cannot restore that link. |
| Missing/archived/inaccessible source or required parent, hidden/non-mutable other link | denied whole file operation | denied whole file operation, without denied-context disclosure. |

Restore clears file.archived_at and sets only the safe proven lifecycle; it does not clear lock fields or modify file link archival. A successful restore does not return a signed URL; subsequent active-list selection must use fresh20.1 signing/current-source checks. Archived-mode rows are metadata-only and remain source-authorized, including eligible independently archived links. Their action entitlements follow the matrix; deleted/unlinked/unknown sources and invalidated artifacts do not gain a usable action or untrusted label.

## Acceptance criteria

1. Given authorized metadata across active modules, when name/type search and module/owner/purpose/date/mode filters combine, then only authorized matching per-link rows/facets/counts appear with exact documented semantics, stable complete50-row navigation, valid DST bounds and no hidden source leakage; invalid/duplicate/reversed input produces honest validation state.
2. Given selected active context, when preview/download/refresh runs, then unchanged20.1 checked signing is used; switch/late response/expiry/unsupported format/denial/transient failure never shows the prior selection as current, and archived mode returns no URL.
3. Given a file with multiple authorized and hidden/non-mutable contexts, when archive or restore is attempted through UI or direct authenticated RPC, then all affected current authority is checked and any denied context prevents the entire mutation/audit without exposing its identity. Selecting another visible link is no bypass.
4. Given eligible ordinary archive/restore, when persisted, then file lifecycle/origin and exactly one attributable fixed audit transition commit together, all bytes/identity/link/lock fields remain unchanged, and repeated same-state request is an audited-authority-checked no-op without duplicate effects.
5. Given locked evidence or legacy unknown archival origin, when restore is attempted, then persistent lock history including archived links restores locked; proven ordinary linked origin restores linked; unknown/draft/deleted/unlinked origin fails closed without defaulting or reconstructing history.
6. Given any quote_pdf artifact linked under ordinary-purpose or current/stale/reserved/locked quote context, when restore is attempted, then10.9 irreversible archival remains enforced and no restore, pointer/render/validity alteration or relink occurs. Generic/direct Storage residual remains unchanged; Documents signing remains source-selected and newly checked.
7. Given concurrent link creation/source reassignment/role revocation/nonkey archive and repeated opposite lifecycle requests, when RPC transactions interleave, then all-link and locked-graph eligibility is serialized, post-revocation attempts deny, deadlocks/errors return no success, and no hidden link or prior-state race bypass occurs.
8. Given desktop or connected360×640 user, when search/preview/archive/restore journeys run, then loading/empty/filtered/error/retry/expired/pending/confirmed states, keyboard/focus/back navigation and server-confirmed success work; contextual upload remains owner-required and shipped list owner picker is retained. Live oracle confirmation remains a release gate, not simulated evidence.

</intent-contract>

## Code Map and exact future paths

`src/features/documents/filters.ts` and`date-bounds.ts`(new pure parsing/filter/DST contract); `src/server/read-models/documents.ts`/`document-sources.ts`(20.1 provided, extend authorized mode/facets/paging/all-source operation eligibility); `src/components/documents/DocumentFilters.tsx`, `DocumentPreviewPane.tsx`, `DocumentLifecycleActions.tsx`(new UI); `src/app/(app)/files/page.tsx`; `src/features/documents/actions.ts`(20.1 provided, lifecycle actions); `src/server/commands/documents/lifecycle.ts` and`lifecycle-db.ts`(new typed checked commands/RPC mapping); `src/server/commands/envelope.ts`(closed capability entries). Reuse existing FilePreviewRow/FileIndexUpload and20.1 HMAC/prepare/finalize unchanged; no blanket ownership of files commands, security matrix, AppShell or generic Storage.

Future migration logical basename:`story_20_2_documents_lifecycle_origin_and_restore.sql` under`supabase/migrations/`, physical CLI-generated timestamp pinned before claims. Contents bounded files ordinary-origin column/DB-owned capture and checked Documents lifecycle helpers/RPCs/ACLs only; existing10.9 guard stays unchanged, no frozen migration edits/new table/bucket/policy/role. Exact schema/migration semantic domain and shared lifecycle trigger writers must be serialized. Current10.9 quote guards are read-only invariants, not permission to weaken them.

## Tasks & Acceptance

- [ ]1. Consume verified20.1 product handoff and complete independent High lifecycle/schema/UX review; root records oracle/full-spec/checkpoint/shared admission. No dispatch from this blocked draft.
- [ ]2. Implement pure query/date contract in the exact filter files and extend safe server read/facets/mode pagination; unit/RLS coverage for AC1.
- [ ]3. Implement preview/filter components against unchanged20.1 signed-access action; selection token/URL lifecycle/focus/mobile tests for AC2,8.
- [ ]4. Add bounded origin capture and checked all-link archive/restore migration/typed commands; preserve generic authority and10.9 trigger constraints; deterministic race/authority/origin/atomic-audit tests for AC3–7 before UI wiring.
- [ ]5. Wire lifecycle confirmation/undo-toast only through checked restore when eligible, errors/retry/confirmed state and current-source read refresh. An undo affordance cannot promise a forbidden/unknown restore.
- [ ]6. Run exact checks and independent High review on final result; implementation author adds one verified Suggested Review Order after real code/evidence exists. Root owns integration/aggregate state; no fabricated planning trail.

## Verification

Future required checks (none executed):

- documents20-2-filter-unit:`node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/features/documents/filters.test.ts tests/unit/features/documents/date-bounds.test.ts tests/unit/features/documents/preview-state.test.ts tests/unit/server/commands/documents-lifecycle.test.ts`.
- documents20-2-lifecycle-integration:`pnpm exec vitest run tests/integration/commands/documents-lifecycle.int.test.ts tests/integration/commands/documents-lifecycle-lock-races.int.test.ts tests/integration/rls/documents-filter-archive.rls.test.ts`; `SUPABASE_TEST_REQUIRED=1`, positive executed/zero skipped; raw origin spoof/INSERT/nontransition/generic archive/retry tests; oldlocked/qPDF/draft capture field unchanged; all-link FK-insert-before-linearization blocking/recheck and generic-link-create-after-commit residual; role/ancestry races; audit rollback; unknown/locked-history restore including archived links; ordinary-purpose quotePDF denial; archive(C1)/restore(C2)/replay(C1) and inverse histories/concurrent sameidentity/linkmismatch; whole-row source-revision stale-review-proof rejection and unchanged10.9/generic authority.
- documents20-2-browser:`pnpm exec playwright test tests/e2e/files/documents-search-preview-lifecycle.e2e.spec.ts`; production Playwright server, desktop/360×640, real preview/refresh/selection/race/retry, metadata-only archived mode and confirmed lifecycle success.
- unit/typecheck/lint/build/scope/service-role/bundle/lockfile checks as20.1; command enrollment, immutable lock and quote invalidation suites remain green. Required evidence binds full exact result revision/command/environment/executed/failed/skipped counts; mocks/source inspection are labeled separately.

## Spec Change Log

2026-10-08: Full20.2 blocked preparation draft. Concrete filters/date/preview/current-authority/all-link lifecycle interfaces and safe ordinary origin/locked-history restore matrix; preserve every archived quotePDF prohibition and no domain relink. No runtime proof or owner waiver.

## Auto Run Result

Status: blocked
Blocking condition: live Documents oracle disposition and full checkpoint closure unavailable; independent exact20.2 lifecycle/schema/spec review and pinned cross-story admission pending;20.1 product implementation not integrated. No ready-for-dev or implementation authorization claimed.
