---
status: ready-for-dev
type: feature
created: "2026-10-08"
review_loop_iteration: 0
followup_review_recommended: false
warnings: [oversized]
deferred: []
story_id: "20.1"
canonical_story_key: "20-1-documents-activation-and-source-authorized-aggregation"
epic: E20
title: Documents activation, source-authorized aggregation and minimal destination
base_sha: a9d5269e0e3762255e1cc992bb2465883508dc21
baseline_revision: a9d5269e0e3762255e1cc992bb2465883508dc21
branch: codex/documents-oracle-disposition-readiness
implementation_authorized: false
readiness_review: accepted-targeted-high
oracle_requirement: not-required-owner-decision-2026-10-09
boundary_choice: A
boundary_decision_date: "2026-10-08"
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
  - _bmad-output/auto-bmad/preparation/story-20-1/owner-boundary-decision-2026-10-08.md
  - _bmad-output/auto-bmad/preparation/story-20-1/selected-link-contract-design.md
  - _bmad-output/auto-bmad/preparation/story-20-1/checkpoint-reconciliation.md
  - _bmad-output/auto-bmad/preparation/story-20-1/owner-oracle-disposition-2026-10-09.md
  - _bmad-output/auto-bmad/preparation/story-20-1/primary-guidance-2026-10-09.md
  - _bmad-output/auto-bmad/preparation/story-20-1/readiness-checkpoint-2026-10-09.md
---

# Story 20.1: Documents activation, source-authorized aggregation and minimal destination

## Preparation disposition

Complete canonical specification on integrated base`a9d5269e0e3762255e1cc992bb2465883508dc21`. All three registered E20 specs and their sensitive contracts are independently reviewed at historical pins; the bounded owner-disposition/readiness/path amendment received targeted independent High acceptance and coordinator-recorded checkpoint closure on2026-10-09. The canonical-not-found finding is historical and resolved. Specification readiness is distinct from actual worker admission; no run, claim or aggregate state is created here.

The owner approved optionA on2026-10-08 and explicitly disposed of exact Documents Lovable comparison on2026-10-09. Current official guidance supports the bounded patterns; actual oracle observations remain zero, with no legacy parity verification. Full20.1–20.3 preparation and reviewed requirements/schema/contracts exist; this amendment closes the former oracle gap, with targeted independent High acceptance and coordinator-recorded checkpoint closure on2026-10-09. OptionA retains baseline generic Files.View/direct Storage authority and issued-URL lifetime. No product implementation, migration, activation, dependency/environment change, merge or deployment is performed.

Author: `/root/documents_spec`, agent `01a11ae9-d2ac-7492-830b-edcc13c16b1b`, explicit `gpt-6.1-sol` High authorization/design route. Independent review identities and exact reviewed spec hash belong to the companion admission/review record; the author does not self-certify review.

<intent-contract>

## Intent summary

**Problem:** The limited `Filer` index does not enroll all active source owners or check current selected-source eligibility; Documents needs a usable aggregation destination under FR109 without widening source permissions.

**Approach:** Activate one `Dokument` destination over existing entity-scoped files, enroll all integrated active source owners, and compose current selected-link authority with the existing checked signing/audit primitives under an explicitly accepted Storage boundary.

As a tenant user with file and source access, I can open `Dokument` and discover eligible files across currently integrated active modules, then preview or download an eligible document through a checked current-source access action, so I do not have to remember which entity panel contains it.

Deliver FR109-AC1–AC5, the minimal checked-access portion of AC7, and the applicable AC12 evidence. Keep `/files` as the destination. Story20.1 activates `documents` in the same implementation PR as a usable destination and transfers the single nav entry from `files`; `files` remains active and owns `files`/`file_links`. Documents has zero new storage tables, zero new source owner types and zero public surfaces. Upload remains contextual and owner-required. Rich module/purpose/date filters, preview pane, archive/restore expansion and entity-panel cross-links remain 20.2/20.3 obligations. Existing name/type/owner narrowing and owner-required upload must survive the nav swap.

## Boundaries & Constraints

**Always:** Require current active membership, Documents.View, Files.View, enrolled source capability/RLS, exact live link/file and the explicit source-live matrix. Reuse the private existing file substrate; preserve commitment locks, ADR-B008 invalidation and checked attributable audit. Record the chosen direct Storage boundary and issued-URL expiry limits accurately.

**Block If:** Actual worker dispatch lacks current exact path/shared ownership/resource/base admission or verified prior product handoffs. Release additionally requires the specified runtime checks. The specification checkpoint is closed after independent High acceptance; no readiness label replaces those execution gates. Exact Lovable comparison is not required. OptionA cannot expand to generic/global policyB.

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

1. **Canonical registration/full preparation:** All three E20 keys are registered and complete specs independently reviewed at historical pins. Retain all three approved/pinned specs before first E20 dispatch. This amendment has targeted High acceptance and coordinator-recorded checkpoint closure, with final LF pins retained in coordinator/review records, not a20.1-only exception. Later product implementation dependencies are separate.
2. **Boundary/contract resolved:** Owner-approved optionA and the independent High reviewed `selected-link-contract-design.md` fix exact command/RPC/HMAC/locking/ACL/schema scope. Baseline generic Files.View/direct Storage and issued-URL residuals remain accepted. Design approval is not implementation/runtime proof or actual shared-claim admission.
3. **Oracle disposition resolved:** Exact Documents Lovable terminology/interaction comparison is NOT REQUIRED by the direct-human2026-10-09 decision. See the exact quote in `owner-oracle-disposition-2026-10-09.md`; zero actual observations and no verified legacy parity. The historical711-second aborted request remains historical evidence, without a new browser probe.
4. **Preparation checkpoint:** Expanded FR109, schema/authorization contracts, full three-story review and explicit oracle disposition have evidence in `readiness-checkpoint-2026-10-09.md`. The coordinator confirmed targeted High acceptance and preparation-checkpoint closure on2026-10-09; final pins are retained in coordinator/review records. Worker admission and runtime/release evidence remain separate.
5. **Serialized conflicts:** release or reconcile the exact nav/manifest/permission/auth/storage/shared-test claims identified in admission evidence. Do not use unmerged Epic14 or Story19.1 code as prerequisites. Revalidate against a newer integrated base before eventual dispatch.

## Acceptance criteria

These are the complete build requirements with approved optionA fixed in AC8. The targeted readiness amendment is independently High-accepted and the preparation checkpoint recorded closed; current worker admission and product verification remain separate.

1. **Atomic usable activation.** Given an admitted activation story and an allowed tenant role, when its implementation PR is applied, then the active `documents` module owns exactly one `/files` nav destination labeled `Dokument` using `Documents.View`, `files` retains its existing table ownership, and the route serves the usable list in the same PR. No duplicate nav item, pending surface, placeholder destination or broader role entitlement appears. Direct navigation is gated by both Documents and Files capabilities.
2. **Complete active-source enrollment.** Given the accepted base manifest, when the center lists document contexts, then enrollment is exactly CRM `customer`/`facility`/`contact`, calculations `calculation`, quotes `quote_version`/`quote_acceptance`, and jobs `job`. Generic command upload eligibility is a separate set: `quote_version` remains listable despite being non-creatable there. Given a future active owner without an implemented adapter, when coherence/registry checks run, then they fail loudly before release rather than silently omitting it. Pending/unknown owners produce no rows, labels, facets or counts.
3. **Conjunctive current authority.** Given the request's current active membership, roles, Documents.View, Files.View and source capability, when a row is read, then its exact live link, file and source must be visible through the request-bound anon-key RLS client and pass the companion source eligibility matrix. Tenant IDs come only from resolved authority. Given a missing, archived, inaccessible or cross-tenant source/link or a revoked membership/role, when the next read runs, then no row, contextual ID/name/purpose, count or derived option reveals it. Archived source semantics follow the explicit matrix below, independently of historical detail-reader behavior.
4. **Safe contextual identity.** Given a file with two authorized links and one unauthorized link, when listed, then the two authorized contexts are distinct rows keyed by `linkId`; the unauthorized context is absent. Each row contains only approved display-safe fileId/linkId, enrolled module/ownerType/ownerId, safe owner label, purpose, display name, MIME/size, link-created timestamp, lifecycle and lock state. It contains no bucket/object path, auth data, price/cost fields, role matrix, privileged key or signed URL. Counts and existing filter options derive solely from authorized rows.
5. **Eligibility and commitments.** Given archived/deleted file metadata, an archived link, unlinked reservation, draft ordinary upload reservation or an unknown state/purpose, when listed, then it is absent. Given an active locked commitment, when listed, then the contextual row stays locked and exposes only permitted access/established archive presentation. Given a `quote_version` context, when its purposes are enrolled, then `quote_attachment_snapshot` (version-creation RPC) and `quote_pdf` (PDF-generation RPC) both participate under the live source/link contract; generic upload eligibility is not widened. Given a `quote_pdf`, when listed/opened, then exact generated-current PDF association, live quote-version link, artifact kind and storage existence satisfy the established quote-PDF target contract. Existing 10.9 invalidation is retained; no stale-fingerprint defect is assumed where invalidation already archives/unlinks it. Generic operations cannot turn reservations/stale PDFs or immutable evidence into usable draft content.
6. **Complete bounded traversal.** Given more eligible/hidden file_links than the PostgREST default cap and links sharing a timestamp, when an allowed user traverses results, then all authorized rows can be reached once in stable `created_at DESC, id DESC` link order through bounded server-controlled pagination. Source filtering must not create falsely complete/empty pages or silently truncate later authorized rows. Hidden candidates are skipped internally without exposing their IDs/counts or cursor contents. Rich 20.2 filters may remain deferred; stable traversal is part of20.1 complete aggregation.
7. **Checked open and refresh.** Given a selected row, when preview/download/refresh is requested with its linkId and fileId, then the server derives owner/module/storage identity and rechecks current route/file/source authority, exact link/file association and lifecycle before signing and before audit finalization. A different currently authorized link does not authorize the selected disappeared/revoked context. Failure returns no URL; ownership denial is generic, transient read/storage/audit faults are retryable, and success follows checked audit completion. A URL may be usable until its embedded expiry after subsequent revocation; no immediate cancellation promise is shown. Default TTL is300 seconds; existing configurable cap is86400 seconds and must be disclosed in evidence.
8. **Approved residual Storage boundary.** Given owner-approved optionA, when baseline Files.View users call existing generic/direct Storage access, then evidence explicitly distinguishes its tenant-role/path scope from selected-source Documents access; no UI/help text or release claim promises global source-revocation byte enforcement. Given source/link disappearance or revocation, when a new Documents selected-link access/refresh request runs, then current source authority is checked and a denied context returns no URL, while existing generic/direct authority is preserved. Existing issued bearer URLs may remain usable until expiry. No generic metadata/Storage policy widening or source-sensitive global revocation implementation belongs to20.1 under this decision.
9. **Usable destination and preserved context.** Given an allowed desktop or connected360×640 user, when opening `/files`, then Swedish `Dokument` list/loading/authorized-empty/read-failure/retry states and keyboard-focusable preview/download controls are available. Supported formats retain existing inline preview; unsupported formats offer authorized download. Expired access has explicit refresh. Existing name/type/owner filtering and contextual owner-required upload continue; there is no global/orphan store, folder tree, offline queue, AI flow, portal or anonymous signer. Montör/Säljare/Ekonomi do not gain Files/View or Documents/View through activation.
10. **Required evidence.** Given the final implementation revision, when mandatory checks run, then all seven adapters, all relevant roles, two tenants, exact selected-link forging, missing/archived owners and parents, membership/role revocation, pagination beyond the cap, multi-linked files, quote lifecycle/invalidation and no-URL-on-sign/audit-fault paths pass. Evidence records baseline generic/direct Storage authority separately from Documents selected-source checks and does not label baseline access a source-revocation denial pass. DB/RLS suites run with `SUPABASE_TEST_REQUIRED=1`, positive executed counts and zero skipped required tests. Browser evidence exercises the real `/files` destination and open/refresh flows at desktop and360×640. Pending-token, nav/matrix/manifest, service-role and bundle containment guards stay derived and pass.

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
| `src/server/commands/documents/signed-access.ts`, `db.ts` (new) | `document.signedAccess.create` checked selected-link command and typed new RPC bridge per concrete contract; no unchanged file_id-only authorization funnel. |
| `src/server/commands/envelope.ts` | Enroll closed command mapping to documents/Documents.View; preserve current capability-before-validation enforcement. Shared command-registry claim. |
| `src/server/storage/document-signed-access-attestation.ts` (new) | Distinct selected-link/source/purpose canonical proof/key domain; existing generic and quote proofs cannot substitute. |
| `src/server/commands/files/files.ts`, `file-db.ts`; `src/server/storage/signed-access.ts`, `signed-access-attestation.ts` | Read-only generic reference/reuse contracts; use request-bound Storage primitive and URL validator without changing generic File HMAC/key/RPCs or baseline policy. |
| `src/server/commands/quotes/quote-pdf-signed-access.ts`; `supabase/migrations/20260907171252_role_aware_phase_a_policy_evolution.sql` | Existing reference contracts; do not edit historic migration. Quote-specific Sales broker must remain a narrow exception. |
| `src/components/files/FileIndexList.tsx`, `FilePreviewRow.tsx`, `FileIndexUpload.tsx` | Reuse list/open/upload user interactions; selected-link identity must reach action. Claims and frontend skill required before implementation. |
| `tests/unit/server/read-models/documents.test.ts`, `document-sources.test.ts` (new) | Exhaustive enrollment, authority, pagination, safe DTO and current-source decisions. |
| `tests/integration/rls/documents.rls.test.ts`, `tests/integration/commands/documents-signed-access.int.test.ts` (new) | Real anon-key read/action/checked DB authority; chosenA selected-source denial and preserved baseline direct Storage expectations. |
| `tests/unit/server/storage/document-signed-access-attestation.test.ts`, `tests/unit/server/commands/documents-signed-access.test.ts`, `tests/integration/commands/documents-signed-access-lock-races.int.test.ts` (new) | Exact canonical field tamper/domain/replay and command enrollment checks; two-connection nonkey source/role/archive/parent-reassignment race serialization and no-URL failure assertions. |
| `supabase/migrations/20261009091120_story_20_1_documents_selected_link_access.sql` | Reserved exact additive unit: reviewed internal target/payload/key helpers and checked Documents prepare/finalize functions/ACLs only. CLI-first empty/unapplied creation then verified local rename follows the readiness checkpoint; no historic migration or generic policy edit. |
| `tests/e2e/files/documents.e2e.spec.ts` (new) | Actual nav/destination/open/error/expiry/mobile behavior. |

The reviewed nav path, quote-version producer purposes and checked-signing/envelope boundaries remain the current integrated contracts. No sensitive authority/locking/HMAC change is made by this amendment. Historical High exact-pin acceptance plus the owner oracle disposition and exact migration reservation support preparation closure with targeted High acceptance/coordinator checkpoint closure; actual assignment, claims/resources and implementation checks remain future gates.

## Design Notes

The complete evidence and source matrix are in `source-authorization-design.md`. Selected source validity is independent of old detail readers and file-role eligibility. CRM children require live parents before their contextual parent labels can be used. Calculations require a live calculation header, not a live customer for byte access; a customer-derived label is withheld unless that referenced customer is independently live and visible. Jobs require a live job and Jobs.ViewAll on the accepted base; Jobs.ViewAssigned remains ungranted. A quote-version context requires live version and parent quote. Acceptance evidence requires live acceptance, version and quote. Immutable quote/job snapshots remain historical; this draft does not rewrite them.

Listing eligibility is `linked`/`locked` live file metadata with live selected file_link and known owner/purpose. File-level archive behavior affects all links and must be explicit if exposed; restore is not introduced in20.1. Existing archive control may be retained only through current source checks under the selected policy and without changing archive-over-delete/locked-history guarantees; otherwise do not offer a center-wide lifecycle mutation until20.2 defines it. An existing entity-panel archive path is not authority to invent restore or source resurrection.

AC5 provenance branch is explicit for both list and checked open: ordinary-file eligibility requires durable`files.artifact_kind IS NULL`. Every`artifact_kind='quote_pdf'` file must pass the strict exact-generated-association branch with selected`quote_version`/`quote_pdf` link and live quote ancestry, regardless of the selected link's apparent ordinary purpose. A quote-PDF artifact added through`link_file_with_audit` as CRM/calculation/snapshot/evidence content is denied on that context; a different valid PDF link is not substitute authority. Unknown nonnull artifact kinds and null-kind/quote_pdf-purpose mismatch fail closed. Required Documents unit/integration tests include the adversarial nonquote-purpose link; generic/direct Storage policy remains unchanged.

At current base, metadata file/link SELECT and generic Storage access are tenant-role-wide. List-only filtering does not make the generic file_id signer source-aware. The concrete new contract uses `document.signedAccess.create`, separate Documents prepare/finalize RPCs and a distinct source/link/purpose-bound proof with locked current-authority revalidation; generic command/proof/policies remain unchanged. Checked definer wrappers explicitly validate actor/live roles/same-tenant source ancestry, because nested invoker calls do not confer caller RLS. Finalization uses SHARE locks and reconciles current parent references to the exact locked graph before validation/audit commit; current authority is linearized there, not at HTTP delivery or later bearer consumption. The contract fixes signatures, canonical fields, replay identity, ACL and race tests. The additive function-only migration requires `schema:migrations` and auth claims before implementation. Zero new storage tables or global policyB expansion.

## Tasks & Acceptance

All tasks are deferred until admission; no box below certifies execution.

- [ ]1. Coordinator carries forward all three approved/pinned canonical specs, optionA and the explicit2026-10-09 oracle disposition; record targeted High delta review/checkpoint closure and fresh exact reserved migration/path/resource/shared admission before dispatch. AC1–10; readiness-checkpoint companion supplies the distinction from implementation evidence.
- [ ]2. Implement exhaustive server source registry and safe read in `src/server/read-models/document-sources.ts` and `documents.ts`; derive active-owner enrollment, use existing source RLS/capabilities/live-parent rules, enforce complete keyset traversal and safe facets/cursor. Add unit and real RLS tests. AC2–6.
- [ ]3. Implement the contract's link-bound action/command/RPC bridge and new Documents HMAC helper in the exact listed files; add the fixed function-only migration unit with checked prepare/finalize/current-source helper, explicit ACLs and SHARE lock order/locked-graph reconciliation. Preserve generic/Sales signer boundaries. Negative proof/race/audit/forgery and enrollment tests must precede UI wiring. AC3,5,7,8.
- [ ]4. Atomically update manifest/permission/nav and `/files` server route/layout, retaining private contextual upload and usable existing interactions via `src/components/files/`. Add exact link payload wiring and loading/empty/denial/retry/expiry states. AC1,4,9.
- [ ]5. Run Documents selected-source, baseline generic/direct Storage regression, lifecycle and role tests under approved optionA; run all required scope/security/type/lint/unit/integration/browser checks on exact result revision. Do not claim source-sensitive global/direct Storage denial. Add real browser fixture ownership without editing reserved shared fixtures until serialized. AC10.
- [ ]6. Implementation author adds and verifies one `## Suggested Review Order` only after code/evidence exists; independent High review audits actual entry-to-storage flow and exact result; coordinator verifies combined integrated revision before aggregate status changes. This preparation intentionally has no fabricated final review trail.

## Required checks and evidence contract

Future required check names and argv are explicit; these are obligations, not execution results. Root may map package manager to the repository-pinned executable without changing check identity.

| Check | Required argv / coverage |
| --- | --- |
| documents-source-unit | `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/server/read-models/documents.test.ts tests/unit/server/read-models/document-sources.test.ts` |
| documents-selected-link-unit | `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/server/storage/document-signed-access-attestation.test.ts tests/unit/server/commands/documents-signed-access.test.ts`; canonical vectors/tamper/proof domains/envelope enrollment. |
| documents-integration-rls | `pnpm exec vitest run tests/integration/rls/documents.rls.test.ts tests/integration/commands/documents-signed-access.int.test.ts`; `SUPABASE_TEST_REQUIRED=1`; two tenants, all seven owners, all five roles, revoked/missing/archived source, exact link, presign/finalization races. |
| documents-selected-link-lock-races-integration | `pnpm exec vitest run tests/integration/commands/documents-signed-access-lock-races.int.test.ts`; `SUPABASE_TEST_REQUIRED=1`; deterministic transaction barriers prove membership/role/link/nonkey archival/parent reassignment serialization and final-audit linearization. |
| files-signed-access-integration | `pnpm exec vitest run tests/integration/commands/file-signed-access.int.test.ts tests/integration/commands/file-signed-access-refresh.int.test.ts`; `SUPABASE_TEST_REQUIRED=1`; preserve checked audit and request-bound primitives. |
| documents-baseline-storage-boundary | `pnpm exec vitest run tests/integration/rls/documents.rls.test.ts tests/integration/commands/documents-signed-access.int.test.ts tests/integration/commands/file-signed-access.int.test.ts tests/integration/commands/file-signed-access-refresh.int.test.ts`; `SUPABASE_TEST_REQUIRED=1`; assert Documents selected-link denial and preserved generic/direct baseline authority as distinct expectations, with issued-URL expiry limits. Extend the assigned Documents suites with the explicit baseline boundary case; do not report source-sensitive global/direct Storage denial. Preserve Sales broker/upload/commitment contracts. |
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

The accepted base is integrated`42f5cf60d1ded6d814c2c0f61b70b312144ce10e`; root records upstream PR86/87/88/89/90 integrated. Available contracts include PhaseA file substrate, E10/ADR-B008 quote invalidation/provenance, E11 matrix/policies, E12 membership, E13 checked signing/delivery, E14 resource foundation, E19 dashboard, E20 preparation/optionA/backlog registration and dependency security repair. Source inspection confirms the new base's envelope and file signing paths; no runtime test evidence is manufactured by this preparation.

Historical reservations covered Epic14 PR86, Story19.1 PR87 and security repair9cd1 while those changes were unmerged. Their upstream changes are now integrated; that does not prove retained maintenance sessions released all claims. Before dispatch root refreshes actual sessions/claims and reconciles Documents manifest/nav/AppShell, permission/envelope registries, checked signing/SQL authority, schema:migrations, shared fixtures and mutable test resources. Pending maintenance overlap remains a blocker until reconciled; idle state alone is not release. No package/environment or future scheduling/person scope belongs to this lane.

## Verification performed during preparation

Read integrated manifest, file index/entity read and owner table helpers, generic signing/storage/attestation path, quote-scoped signing contract, permission matrix, role-aware SQL policy, early Documents checkpoint, integrated sequencing amendment and parallel workflow/contract. Rendered `bmad-build-auto` workflow successfully via `uv run --no-cache ...render_skill.py`. Its canonical P0 resolution blocker prevents normal build/claim progression; this is bounded draft preparation under the owner's specific request. No Git mutation by author. No tests/services/background workload launched. Computer-use initialized and enumerated apps; subsequent Chrome state call stalled711 seconds and was aborted. No live oracle page or customer data captured into this package.

## Spec Change Log

- 2026-10-08: Prepared blocked20.1 draft on accepted integrated base. Kept canonical-registration, oracle and source/direct Storage boundary decisions explicit; added exact-link authority, disappearance/revocation, parent/archive matrix, complete pagination and downstream-issued-URL limits. No implementation started.
- 2026-10-08: Independent High draft audit of LF revision`beae28b39b52901ac03fca6b02db9d59b9b0e10e1e8f2dc9d28cc08b36df3ced` reported no additional material authorization/design defects. Consolidated author accuracy/template corrections add verified nav path, both actual quote-version purposes, required frontmatter and frozen intent scaffold. KEEP unresolved owner boundary/oracle/canonical admission; no readiness promotion. Final exact-revision follow-up is recorded separately by root.

## Review Triage Log

Preparation audit received from root: no new material authorization/design finding on the first pinned draft. Author corrected deterministic template/path/purpose accuracy for final pinned follow-up; owner intent gaps remain explicit blockers. This is a preparation/spec audit, not an implementation code-review completion or passing runtime test.

- 2026-10-08 owner-decision amendment: the owner replied “Follow your recommendation” to optionA. Record bounded Documents selected-source enforcement and explicit residual generic/direct Storage authority and issued-URL lifetime; remove the A/B intent-gap blocker while retaining canonical/oracle/checkpoint/design/shared-claim gates. Historical review entries above remain unchanged; targeted independent review of this amendment is root-owned.
- 2026-10-08 selected-link contract preparation: refresh source base to integrated42f5 and record now-resolved canonical registration. Add exact new command/RPC/proof/ACL/current-source lock/locked-graph contract and test/migration unit; retain full20.1–20.3 specification preparation gate per authoritative checkpoint. No product implementation or readiness promotion; independent High review of the new contract remains required.

2026-10-09: Record direct-human Documents-only oracle disposition, current primary guidance, complete historical High preparation acceptance and exact path reservation. No sensitive product contract change; targeted High readiness-delta acceptance and coordinator checkpoint closure recorded; final LF pin updated. Specification approval is separate from worker dispatch.

## Auto Run Result

Status: ready-for-dev
Blocking condition: none for specification preparation; targeted independent High acceptance and coordinator checkpoint closure recorded2026-10-09. Worker dispatch still requires fresh integrated-base/path/shared/resource admission and the story-specific verified product dependencies. No implementation or runtime proof is claimed.
Outcome: approved ready-for-dev specification; implementation_authorized:false, no worker assignment or product evidence.
