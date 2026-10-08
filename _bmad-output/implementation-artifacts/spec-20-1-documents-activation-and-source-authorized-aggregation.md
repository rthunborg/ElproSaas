---
status: blocked
type: feature
created: "2026-10-08"
review_loop_iteration: 0
followup_review_recommended: false
warnings: [oversized]
deferred: []
story_id: "20.1"
canonical_story_key: null
epic: E20
title: Documents activation, source-authorized aggregation and minimal destination
base_sha: ab1ca0445b58f5f496be0d938906c744b6dff87e
baseline_revision: ab1ca0445b58f5f496be0d938906c744b6dff87e
branch: codex/story20-1-documents-preparation
implementation_authorized: false
context:
  - AGENTS.md
  - docs/process/review-order.md
  - docs/process/agent-model-routing.md
  - docs/process/parallel-auto-bmad.md
  - docs/process/parallel-auto-bmad-contract.md
  - _bmad-output/planning-artifacts/early-b2-documents-checkpoint-2026-10-07.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-10-07.md
  - _bmad-output/planning-artifacts/prd-phase-b.md
  - _bmad-output/planning-artifacts/epics-phase-b.md
  - _bmad-output/planning-artifacts/architecture-phase-b.md
  - _bmad-output/planning-artifacts/ux-design-specification-phase-b.md
  - docs/decisions/ADR-B008-quote-review-authority-and-derived-artifact-validity.md
  - _bmad-output/auto-bmad/preparation/story-20-1/source-authorization-design.md
---

# Story 20.1: Documents activation, source-authorized aggregation and minimal destination

## Preparation disposition

This is a complete reviewable preparation draft, not a canonical registered ready-for-dev spec. The integrated E20 entry identifies candidate 20.1 and links the early checkpoint, but `sprint-status.yaml` contains no matching story. Root's `story_plan.py --resolve 20.1` returned story-not-found. Auto-BMAD parallel P0 requires canonical resolution and forbids invented IDs. A coordinator must serialize canonical registration before this draft can become an admitted specification. This lane neither edits aggregate planning nor initializes a run or claim.

The owner authorized preparation only. The bounded sequencing amendment permits early FR109 expansion and E20 preparation; it does not close the B1b exit or the early Documents checkpoint. Unresolved live-oracle evidence and the direct Storage/source-authority decision below prevent ready-for-dev. No product implementation, migration, module activation, environment/dependency change, merge or deployment is performed by this package.

Author: `/root/documents_spec`, agent `01a11ae9-d2ac-7492-830b-edcc13c16b1b`, explicit `gpt-6.1-sol` High authorization/design route. Independent review identities and exact reviewed spec hash belong to the companion admission/review record; the author does not self-certify review.

<intent-contract>

## Intent summary

**Problem:** The limited `Filer` index does not enroll all active source owners or check current selected-source eligibility; Documents needs a usable aggregation destination under FR109 without widening source permissions.

**Approach:** Activate one `Dokument` destination over existing entity-scoped files, enroll all integrated active source owners, and compose current selected-link authority with the existing checked signing/audit primitives under an explicitly accepted Storage boundary.

As a tenant user with file and source access, I can open `Dokument` and discover eligible files across currently integrated active modules, then preview or download an eligible document through a checked current-source access action, so I do not have to remember which entity panel contains it.

Deliver FR109-AC1–AC5, the minimal checked-access portion of AC7, and the applicable AC12 evidence. Keep `/files` as the destination. Story20.1 activates `documents` in the same implementation PR as a usable destination and transfers the single nav entry from `files`; `files` remains active and owns `files`/`file_links`. Documents has zero new storage tables, zero new source owner types and zero public surfaces. Upload remains contextual and owner-required. Rich module/purpose/date filters, preview pane, archive/restore expansion and entity-panel cross-links remain 20.2/20.3 obligations. Existing name/type/owner narrowing and owner-required upload must survive the nav swap.

## Boundaries & Constraints

**Always:** Require current active membership, Documents.View, Files.View, enrolled source capability/RLS, exact live link/file and the explicit source-live matrix. Reuse the private existing file substrate; preserve commitment locks, ADR-B008 invalidation and checked attributable audit. Record the chosen direct Storage boundary and issued-URL expiry limits accurately.

**Block If:** Canonical story registration, owner A/B policy decision, live oracle disposition, High review/checkpoint closure, exact schema/wrapper ownership or shared reservation reconciliation is unresolved. A blocked draft is not permission to build.

**Never:** Consume unmerged Epic14/19.1 APIs, infer new role entitlements, copy Lovable code, create a second file store, ship pending-source surfaces, introduce PhaseC flows, change secrets/dependencies/environment from this preparation lane, initialize claims, merge or deploy.

## I/O & Edge-Case Matrix

| Scenario | Input/state | Expected surface behavior | Error handling |
| --- | --- | --- | --- |
| Authorized context | Allowed user, live file/link/source | Safe contextual row and checked preview/download | URL only after current eligibility and audit finalize |
| Same file, distinct contexts | Two allowed links and one denied link | Two rows identified by linkId; denied context absent | Never substitute another link for selected-context denial |
| Source revocation/disappearance | Membership/role revoked, link/source/required parent archived or gone | Absent on next read; no new URL returned by Documents | Generic denial; already issued URL can survive to expiry |
| More than PostgREST cap | Mixed hidden/allowed candidates, equal timestamps | Complete bounded stable traversal | No hidden IDs/counts or false exhaustion |
| Quote PDF/attachments | Current generated PDF or live snapshot link | Exact quote source association checked; historical locks retained | Reserved/stale/archived/unknown records fail closed |
| Read/sign/audit outage | Transient backend failure | Honest retry state, no success URL | Do not collapse transient failure into permanent absence |

## Entry gates and exact blockers

1. **Canonical registration:** coordinator-owned serialized addition of the approved E20 story key to the sprint source; then resolve exact ID/epic with `story_plan.py`. Do not move/renumber candidate stories or claim that this draft supplies registration.
2. **Boundary choice:** accept and record option A or B in the companion design, with a reviewed checkpoint/ADR-backed decision where applicable. The draft recommends A for a bounded lane, but selects neither. A requires explicit acceptance that Documents selected-link actions enforce current source authority while baseline generic file/direct Storage access retains its wider authority. B requires an approved broader policy contract, additive security migration scope, direct Storage tests and reconciled shared claims. No source-sensitive global byte-revocation guarantee is inferred.
3. **Live oracle:** confirm current Swedish navigation/page terminology and minimum list/open/error interactions in an authorized Lovable session. The native browser-state request stalled for 711 seconds and was aborted without a document-page observation. Historical audit and synthetic fixtures are not live parity evidence. Browser-only retry may resolve access; otherwise retain this blocker, without claiming a gate pass or inventing a waiver.
4. **Checkpoint closure:** independent High authorization/design/spec audit, expanded FR109 and schema disposition, oracle disposition, owner decision and implementation admission recorded on the exact revision. Preparation approval alone is not checkpoint closure.
5. **Serialized conflicts:** release or reconcile the exact nav/manifest/permission/auth/storage/shared-test claims identified in admission evidence. Do not use unmerged Epic14 or Story19.1 code as prerequisites. Revalidate against a newer integrated base before eventual dispatch.

## Acceptance criteria

These are the proposed build contract under review. AC8 has a conditional policy branch pending the explicit boundary choice; that unresolved branch is a readiness blocker.

1. **Atomic usable activation.** Given an admitted activation story and an allowed tenant role, when its implementation PR is applied, then the active `documents` module owns exactly one `/files` nav destination labeled `Dokument` using `Documents.View`, `files` retains its existing table ownership, and the route serves the usable list in the same PR. No duplicate nav item, pending surface, placeholder destination or broader role entitlement appears. Direct navigation is gated by both Documents and Files capabilities.
2. **Complete active-source enrollment.** Given the accepted base manifest, when the center lists document contexts, then enrollment is exactly CRM `customer`/`facility`/`contact`, calculations `calculation`, quotes `quote_version`/`quote_acceptance`, and jobs `job`. Generic command upload eligibility is a separate set: `quote_version` remains listable despite being non-creatable there. Given a future active owner without an implemented adapter, when coherence/registry checks run, then they fail loudly before release rather than silently omitting it. Pending/unknown owners produce no rows, labels, facets or counts.
3. **Conjunctive current authority.** Given the request's current active membership, roles, Documents.View, Files.View and source capability, when a row is read, then its exact live link, file and source must be visible through the request-bound anon-key RLS client and pass the companion source eligibility matrix. Tenant IDs come only from resolved authority. Given a missing, archived, inaccessible or cross-tenant source/link or a revoked membership/role, when the next read runs, then no row, contextual ID/name/purpose, count or derived option reveals it. Archived source semantics follow the explicit matrix below, independently of historical detail-reader behavior.
4. **Safe contextual identity.** Given a file with two authorized links and one unauthorized link, when listed, then the two authorized contexts are distinct rows keyed by `linkId`; the unauthorized context is absent. Each row contains only approved display-safe fileId/linkId, enrolled module/ownerType/ownerId, safe owner label, purpose, display name, MIME/size, link-created timestamp, lifecycle and lock state. It contains no bucket/object path, auth data, price/cost fields, role matrix, privileged key or signed URL. Counts and existing filter options derive solely from authorized rows.
5. **Eligibility and commitments.** Given archived/deleted file metadata, an archived link, unlinked reservation, draft ordinary upload reservation or an unknown state/purpose, when listed, then it is absent. Given an active locked commitment, when listed, then the contextual row stays locked and exposes only permitted access/established archive presentation. Given a `quote_version` context, when its purposes are enrolled, then `quote_attachment_snapshot` (version-creation RPC) and `quote_pdf` (PDF-generation RPC) both participate under the live source/link contract; generic upload eligibility is not widened. Given a `quote_pdf`, when listed/opened, then exact generated-current PDF association, live quote-version link, artifact kind and storage existence satisfy the established quote-PDF target contract. Existing 10.9 invalidation is retained; no stale-fingerprint defect is assumed where invalidation already archives/unlinks it. Generic operations cannot turn reservations/stale PDFs or immutable evidence into usable draft content.
6. **Complete bounded traversal.** Given more eligible/hidden file_links than the PostgREST default cap and links sharing a timestamp, when an allowed user traverses results, then all authorized rows can be reached once in stable `created_at DESC, id DESC` link order through bounded server-controlled pagination. Source filtering must not create falsely complete/empty pages or silently truncate later authorized rows. Hidden candidates are skipped internally without exposing their IDs/counts or cursor contents. Rich 20.2 filters may remain deferred; stable traversal is part of20.1 complete aggregation.
7. **Checked open and refresh.** Given a selected row, when preview/download/refresh is requested with its linkId and fileId, then the server derives owner/module/storage identity and rechecks current route/file/source authority, exact link/file association and lifecycle before signing and before audit finalization. A different currently authorized link does not authorize the selected disappeared/revoked context. Failure returns no URL; ownership denial is generic, transient read/storage/audit faults are retryable, and success follows checked audit completion. A URL may be usable until its embedded expiry after subsequent revocation; no immediate cancellation promise is shown. Default TTL is300 seconds; existing configurable cap is86400 seconds and must be disclosed in evidence.
8. **Direct Storage boundary.** Given the recorded choice A, when baseline Files.View users call existing generic/direct Storage access, then evidence explicitly distinguishes its tenant-role/path scope from selected-source Documents access; no UI/help text or release claim promises global source-revocation byte enforcement. Given choice B, when authenticated direct Storage SELECT/download/sign and generic file signing are attempted after the last eligible source link is revoked/disappeared, then the new checked policy denies them, including direct Data API callers, while preserving owner-required upload reservations, quote sales broker and committed-history contracts. Tests follow the chosen contract; neither choice revokes already issued bearer URLs before expiry.
9. **Usable destination and preserved context.** Given an allowed desktop or connected360×640 user, when opening `/files`, then Swedish `Dokument` list/loading/authorized-empty/read-failure/retry states and keyboard-focusable preview/download controls are available. Supported formats retain existing inline preview; unsupported formats offer authorized download. Expired access has explicit refresh. Existing name/type/owner filtering and contextual owner-required upload continue; there is no global/orphan store, folder tree, offline queue, AI flow, portal or anonymous signer. Montör/Säljare/Ekonomi do not gain Files/View or Documents/View through activation.
10. **Required evidence.** Given the final implementation revision, when mandatory checks run, then all seven adapters, all relevant roles, two tenants, exact selected-link forging, missing/archived owners and parents, membership/role revocation, pagination beyond the cap, multi-linked files, quote lifecycle/invalidation and no-URL-on-sign/audit-fault paths pass. DB/RLS suites run with `SUPABASE_TEST_REQUIRED=1`, positive executed counts and zero skipped required tests. Browser evidence exercises the real `/files` destination and open/refresh flows at desktop and360×640. Pending-token, nav/matrix/manifest, service-role and bundle containment guards stay derived and pass.

</intent-contract>

## Code Map

| Current path | Responsibility / intended change after admission |
| --- | --- |
| `src/scope/manifest.ts` | Activation metadata and single nav ownership transfer; retain existing source owner/table partition. Shared serialized reservation. |
| `src/server/authz/permission-matrix.ts` | Add documents activation rows `Documents.View` for tenant_admin/projektledare only; Files.View remains required. Shared reservation. |
| `src/components/app-shell/nav-items.ts` | Existing `navItems` declares `Filer`/`/files`; display `Dokument` on that sole entry and retain capability-derived nav. Shared AppShell/navigation reservation. |
| `src/app/(app)/files/layout.tsx`, `page.tsx` | Route guard, server read and usable destination. No privileged client. |
| `src/features/files/read.ts`, `file-index.ts`, `deferred-categories.ts` | Preserve entity panels/legacy helpers and derive new aggregation enrollment from the active manifest, rather than command-owner union. |
| `src/server/read-models/documents.ts` (new) | Request-bound safe `{data, entitlements}` read; source adapters, complete bounded traversal, safe cursor and current-source labels. |
| `src/server/read-models/document-sources.ts` (new) | Exhaustive active-owner registry with source capability/table/live/parent/purpose checks. Server-only; no client role matrix. |
| `src/features/documents/actions.ts` (new) | Link-bound preview/download/refresh entry; validate IDs, never accept tenant/bucket/path/module authorization from clients. |
| `src/server/commands/documents/signed-access.ts` (new) | Current exact-source checks composed with the existing attested request-bound signing primitive; must not call unchanged file_id-only funnel and claim revocation enforcement. |
| `src/server/commands/files/files.ts`, `file-db.ts`; `src/server/storage/signed-access.ts`, `signed-access-attestation.ts` | Existing lifecycle/storage/error/attestation primitives; reconcile shared claims if wrappers or HMAC payloads change. Link identity must be bound to both prepare/finalization checks. |
| `src/server/commands/quotes/quote-pdf-signed-access.ts`; `supabase/migrations/20260907171252_role_aware_phase_a_policy_evolution.sql` | Existing reference contracts; do not edit historic migration. Quote-specific Sales broker must remain a narrow exception. |
| `src/components/files/FileIndexList.tsx`, `FilePreviewRow.tsx`, `FileIndexUpload.tsx` | Reuse list/open/upload user interactions; selected-link identity must reach action. Claims and frontend skill required before implementation. |
| `tests/unit/server/read-models/documents.test.ts`, `document-sources.test.ts` (new) | Exhaustive enrollment, authority, pagination, safe DTO and current-source decisions. |
| `tests/integration/rls/documents.rls.test.ts`, `tests/integration/commands/documents-signed-access.int.test.ts` (new) | Real anon-key read/action/checked DB authority; direct Data API/Storage tests forB. |
| `tests/e2e/files/documents.e2e.spec.ts` (new) | Actual nav/destination/open/error/expiry/mobile behavior. |

The current nav path and quote-version producer purposes were verified against the accepted base. Exact additive authority-wrapper/migration ownership depends on the unselected boundary contract. Canonical status and boundary choice remain unresolved, so this draft deliberately cannot meet the no-unresolved-gaps ready standard.

## Design Notes

The complete evidence and source matrix are in `source-authorization-design.md`. Selected source validity is independent of old detail readers and file-role eligibility. CRM children require live parents before their contextual parent labels can be used. Calculations require a live calculation header, not a live customer for byte access; a customer-derived label is withheld unless that referenced customer is independently live and visible. Jobs require a live job and Jobs.ViewAll on the accepted base; Jobs.ViewAssigned remains ungranted. A quote-version context requires live version and parent quote. Acceptance evidence requires live acceptance, version and quote. Immutable quote/job snapshots remain historical; this draft does not rewrite them.

Listing eligibility is `linked`/`locked` live file metadata with live selected file_link and known owner/purpose. File-level archive behavior affects all links and must be explicit if exposed; restore is not introduced in20.1. Existing archive control may be retained only through current source checks under the selected policy and without changing archive-over-delete/locked-history guarantees; otherwise do not offer a center-wide lifecycle mutation until20.2 defines it. An existing entity-panel archive path is not authority to invent restore or source resurrection.

At current base, metadata file/link SELECT and generic Storage access are tenant-role-wide. List-only filtering does not make the generic file_id signer source-aware. The stronger selected-link open contract therefore needs an audited checked authority extension; SQL attestation cannot be called complete while its challenge/finalizer checks only tenant/file/lifecycle. OptionA can preserve Storage primitive and generic baseline policy while adding narrow checked wrappers for Documents. Any additive wrapper migration is an implementation change requiring declared `schema:migrations` and auth domains, not work performed by preparation. A new table is unnecessary. OptionB expands generic policies and requires owner/ADR and shared-claim reconciliation.

## Tasks & Acceptance

All tasks are deferred until admission; no box below certifies execution.

- [ ]1. Coordinator registers and resolves canonical story, records owner choice/oracle closure/High audit, assigns verified nav and exact chosen-wrapper/migration paths, pins LF SHA and reconciles shared claims. Artifacts: this spec, companion design/admission, coordinator sprint/plan record. AC1–10.
- [ ]2. Implement exhaustive server source registry and safe read in `src/server/read-models/document-sources.ts` and `documents.ts`; derive active-owner enrollment, use existing source RLS/capabilities/live-parent rules, enforce complete keyset traversal and safe facets/cursor. Add unit and real RLS tests. AC2–6.
- [ ]3. Implement link-bound action/checked signer in `src/features/documents/actions.ts` and `src/server/commands/documents/signed-access.ts`; compose current authority, existing lifecycle/attestation and request-bound Storage primitives. Introduce only reviewed additive checked SQL wrappers if required by selected contract; do not edit historical migrations or extend Sales broker. Negative race/audit/forgery tests must precede UI wiring. AC3,5,7,8.
- [ ]4. Atomically update manifest/permission/nav and `/files` server route/layout, retaining private contextual upload and usable existing interactions via `src/components/files/`. Add exact link payload wiring and loading/empty/denial/retry/expiry states. AC1,4,9.
- [ ]5. Run chosen policy's current-source/direct Storage, lifecycle and role tests; run all required scope/security/type/lint/unit/integration/browser checks on exact result revision. Add real browser fixture ownership without editing reserved shared fixtures until serialized. AC10.
- [ ]6. Implementation author adds and verifies one `## Suggested Review Order` only after code/evidence exists; independent High review audits actual entry-to-storage flow and exact result; coordinator verifies combined integrated revision before aggregate status changes. This preparation intentionally has no fabricated final review trail.

## Required checks and evidence contract

Future required check names and argv are explicit; these are obligations, not execution results. Root may map package manager to the repository-pinned executable without changing check identity.

| Check | Required argv / coverage |
| --- | --- |
| documents-source-unit | `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/server/read-models/documents.test.ts tests/unit/server/read-models/document-sources.test.ts` |
| documents-integration-rls | `pnpm exec vitest run tests/integration/rls/documents.rls.test.ts tests/integration/commands/documents-signed-access.int.test.ts`; `SUPABASE_TEST_REQUIRED=1`; two tenants, all seven owners, all five roles, revoked/missing/archived source, exact link, presign/finalization races. |
| files-signed-access-integration | `pnpm exec vitest run tests/integration/commands/file-signed-access.int.test.ts tests/integration/commands/file-signed-access-refresh.int.test.ts`; `SUPABASE_TEST_REQUIRED=1`; preserve checked audit and request-bound primitives. |
| documents-direct-storage-integration | Required forB; selected policy tests authenticated Storage sign/download/metadata enumeration and generic RPC access; preserve Sales broker/upload/commitment contracts. ForA record unchanged baseline as measured limitation, not source-revocation pass. Concrete suite path must be assigned when owner choice is pinned. |
| documents-browser | `pnpm exec playwright test tests/e2e/files/documents.e2e.spec.ts tests/e2e/files/file-index-scope.e2e.spec.ts tests/e2e/files/entity-file-preview.e2e.spec.ts`; real production Playwright web server, desktop/360×640, actual open/refresh and failure state. |
| unit | `pnpm run test:unit`; manifest/matrix/nav/pending token and file lifecycle/locks goldens remain derived. |
| typecheck | `pnpm run typecheck` |
| lint | `pnpm run lint` |
| production-build | `pnpm run build` |
| service-role-containment | `pnpm run verify:service-role-containment` |
| bundle-containment | `pnpm run verify:bundle-containment` after production build |
| lockfiles | `pnpm run verify:lockfiles`; package/Next remediation is separately reserved. |

Final epic gates remain coordinator-owned and are not replaced by this slice: full E20 story expansion20.2/20.3, test design/ATDD when triaged, independent reviews, combined integration checks, trace/NFR/test-review/retrospective and checkpoint gates according to Auto-BMAD. Final plan must explicitly enumerate them; no invented one-story full-epic finalization plan is emitted here. Actual implementation check records bind command, executed/failed/skipped counts, environment and full Git result SHA; zero skipped required tests. Planning source inspection and hypothetical tests are not passing check evidence.

## Semantic conflicts and upstream contracts

The accepted base is integrated `ab1ca0445b58f5f496be0d938906c744b6dff87e`; no newer verified integration was identified by root. Available contracts are PhaseA file substrate, E10/ADR-B008 quote invalidation/provenance, integrated E11 role matrix/policies, E12 active membership, E13 checked signing/delivery and the merged2026-10-07 sequencing amendment/parallel adapter. Preparation does not certify product gates for an unmerged result.

Reserve Epic14 PR86 (b3cc and retained epic14-scheduling worktree): scheduling/person/schema/permissions/shared APIs/shared test fixtures. Reserve Story19.1 PR87 (story19-1-dashboard): dashboard/widget registry/manifest/quote readers/AppShell/NotificationBell/CI/shared tests. Its Next audit CI blocker is not Documents implementation coverage. Reserve security repair session `01a11aeb-9946-7af3-b2ee-865c34db6c24`, worktree9cd1, as sole Next/package/lock writer. Idle chat state never releases ownership. Before implementation, serialize Documents manifest, nav/AppShell, permission matrix, checked signing/SQL authority, schema:migrations and fixture ownership against these reservations. No import from another checkout, copied unmerged APIs or speculative dependency chain.

## Verification performed during preparation

Read integrated manifest, file index/entity read and owner table helpers, generic signing/storage/attestation path, quote-scoped signing contract, permission matrix, role-aware SQL policy, early Documents checkpoint, integrated sequencing amendment and parallel workflow/contract. Rendered `bmad-build-auto` workflow successfully via `uv run --no-cache ...render_skill.py`. Its canonical P0 resolution blocker prevents normal build/claim progression; this is bounded draft preparation under the owner's specific request. No Git mutation by author. No tests/services/background workload launched. Computer-use initialized and enumerated apps; subsequent Chrome state call stalled711 seconds and was aborted. No live oracle page or customer data captured into this package.

## Spec Change Log

- 2026-10-08: Prepared blocked20.1 draft on accepted integrated base. Kept canonical-registration, oracle and source/direct Storage boundary decisions explicit; added exact-link authority, disappearance/revocation, parent/archive matrix, complete pagination and downstream-issued-URL limits. No implementation started.
- 2026-10-08: Independent High draft audit of LF revision`beae28b39b52901ac03fca6b02db9d59b9b0e10e1e8f2dc9d28cc08b36df3ced` reported no additional material authorization/design defects. Consolidated author accuracy/template corrections add verified nav path, both actual quote-version purposes, required frontmatter and frozen intent scaffold. KEEP unresolved owner boundary/oracle/canonical admission; no readiness promotion. Final exact-revision follow-up is recorded separately by root.

## Review Triage Log

Preparation audit received from root: no new material authorization/design finding on the first pinned draft. Author corrected deterministic template/path/purpose accuracy for final pinned follow-up; owner intent gaps remain explicit blockers. This is a preparation/spec audit, not an implementation code-review completion or passing runtime test.

## Auto Run Result

Status: blocked
Blocking condition: canonical story20.1 not found; owner source/direct Storage boundary decision unresolved; live Documents oracle observation unavailable; exact reviewed checkpoint and serialized claims pending.
Outcome: reviewable preparation draft; not ready-for-dev and not admitted for implementation.
