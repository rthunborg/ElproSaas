---
title: Early B2 Documents checkpoint
status: prepared-pending-checkpoint-closure
date: 2026-10-07
scope: E20 / FR109 / P54-P55 only
wave: B2
implementation_authorized: false
---

# Early B2 Documents checkpoint

## Decision and authorization boundary

The owner authorized preparation of a concrete early E20 sequencing amendment and complete story preparation to make an independent Documents stream possible alongside Epic 14. This document records that bounded preparation. It does not certify B1b exit, approve all B2 work, mark E20 ready for implementation, or authorize a worker launch. The proposed exception changes E20's sequencing only: it remains a B2 module, and the complete B1b→B2 checkpoint and remaining B2 requirements retain their gates.

PB-D6 keeps Documents an aggregation layer over entity-scoped files. PB-D10 and AC-B2-8 normally require coarse-FR expansion and full story preparation at the full B1b→B2 checkpoint. The early exception must be recorded in the canonical PRD, epics and sequencing decision, explicitly identifying FR109 as expanded early while FR110–FR118 remain checkpoint-bound. Full B1b acceptance, mini-retro, next-wave re-validation, remaining FR/story expansion and re-estimate are not satisfied by this document. Historical migration-classification notes do not create a new E20 prerequisite: Cross-Epic Rule 4 records the owner's parallel-run cutover decision and expires that migration gate.

## Evidence inspected and limits

| Source | Consequence for this checkpoint |
| --- | --- |
| `AGENTS.md`; `_bmad-output/project-context.md` | Approved story/ADR and manifest governance required; sensitive file authorization/lifecycle work routes to Sol High with independent review. Historical context is checked against current implementation. |
| `prd-phase-b.md` FR109, AC-B2-2, AC-B2-8, P54–P55 | Searchable active-module aggregation, signed access, archive/restore; P55 is deliberately thinned to archive-over-delete. |
| `epics-phase-b.md` E20 and Cross-Epic Rules 1, 2, 6 | First story activates; oracle terminology precedes first story; normal wave checkpoint remains binding outside the bounded exception. |
| `architecture-phase-b.md` §§9.3, 12 | E20 adds zero storage tables. Nav swap belongs to activation. Existing private bucket and polymorphic `files`/`file_links` remain the substrate. |
| `ux-design-specification-phase-b.md` §§5.1–5.2, UXB-A13 | `Dokument`; module/owner/purpose/date filters, preview pane, contextual upload, no global folder tree. B2 screen details need deepening. |
| `src/scope/manifest.ts` | `documents` is pending with empty surfaces. Existing `files` owns the tables and `/files` nav route. Source owner types belong to their source modules. |
| `src/features/files/read.ts`, `file-index.ts`; files page and components | Current limited index has name/type/category narrowing. It lacks purpose in its projection and uses the command-creatable owner set, which excludes active `quote_version`. Current page also has a required-owner upload entry point. |
| `src/server/commands/files/*`; storage signed-access modules; role-aware policy migration | Existing signing is request-bound, lifecycle-gated and audit-attested. Archive uses checked attributable database authority; direct authenticated file updates are revoked. No restore command was found in the inspected paths. |
| `docs/oracle/initial-system-audit-2026-06-01.md`; `tests/fixtures/golden/lovable/files.json` | Historical capability inventory supports P54/P55. Fixture metadata is synthetic/new-expected; it is not current legacy UI parity evidence. |

No live Lovable session was inspected and no external oracle access was attempted. The `Dokument` vocabulary sanity check and current document-page interaction observation remain **unresolved**. Existing synthetic fixtures must not be reported as a completed oracle gate.

## Expanded FR109 contract

**FR109:** An authorized tenant user can discover files across every currently active module through one Documents center, narrow the authorized metadata by search and module/owner-type/purpose/date, open preview or download through short-lived tenant-authorized signed access, inspect eligible archived files, and archive/restore through audited source-authorized lifecycle transitions. The center aggregates the existing private entity-scoped file model; it does not create another document repository or widen source permissions.

| ID | Detailed acceptance requirement | Story |
| --- | --- | --- |
| FR109-AC1 | The first E20 PR atomically activates `documents`, records activation date/epic and matrix rows, transfers the single `/files` nav destination from `files` to `documents`, changes its visible label to `Dokument`, and serves a usable authorized list. `files` remains active and owns `files`/`file_links`; no duplicate nav entry or empty placeholder is shipped. | 20.1 |
| FR109-AC2 | The read model covers file owner types declared by **active source modules**, including domain-created `quote_version` links. It derives enrollment from the manifest rather than the upload command's narrower creatable-owner union. Pending/unknown owners fail closed and create no filter option, owner label, count or result. Documents declares no new owner type. | 20.1 |
| FR109-AC3 | List rows and every facet/count are narrowed by tenant, effective file capability and source entity visibility. Hidden source names, IDs, membership, purpose or existence are not disclosed. A manifest activation is eligibility, not authorization. Forged owner/module/file IDs cannot bypass source authorization. | 20.1 |
| FR109-AC4 | One result represents an authorized `file_link`, identified by `linkId`, with `fileId`, module, owner type/context, purpose, display name, MIME/size, created date and lifecycle/lock presentation. One file with several authorized links can produce several contextual rows. Unauthorized links remain absent; file-level actions make their broader impact explicit. Raw storage identity is absent from list DTOs. | 20.1 |
| FR109-AC5 | Default results exclude archived links/files, deleted metadata, unlinked reservations and other access-ineligible artifacts. Link creation and generic upload eligibility are not conflated with listing eligibility. Quote PDFs remain governed by ADR-B008 freshness, reservation, commitment and signing restrictions. | 20.1 |
| FR109-AC6 | Name/type search and module/owner-type/purpose/date filters compose deterministically over authorized metadata. Date means file-link `created_at`, using the displayed tenant/date convention; inclusive UI date bounds and empty/invalid/reversed bounds are specified in the final UX contract. Stable ordering and bounded result navigation prevent silent truncation or duplicate/missing rows. No file-content/full-text search is promised. | 20.2 |
| FR109-AC7 | Preview/download requests re-check current file/source authority and lifecycle and reuse the existing checked signed-access/audit funnel. Private bucket/path are server-derived; no public URL, service-role credential or alternative signer is introduced. Unsupported inline formats offer authorized download. Expired access has explicit refresh; denial and transient failure are distinct and produce no URL on failure. | 20.1, 20.2 |
| FR109-AC8 | Archived-mode metadata remains source-authorized; it never signs an archived file. Archive and restore are explicit server-confirmed operations with attributable atomic audit and retry/idempotency behavior. No physical object deletion, byte replacement, lock removal or historical attachment rewrite occurs. | 20.2 |
| FR109-AC9 | Restore validates current source/link eligibility and commitment/provenance constraints under checked database authority. A restored commitment remains locked. Generic restore cannot resurrect an invalidated/reserved/stale quote PDF, re-enable a removed domain link, or convert immutable evidence to editable draft/linked content. Unknown eligibility fails closed. The exact allowed transition matrix is a required finalization output, not delegated to UI inference. | 20.2 |
| FR109-AC10 | Entity-panel `Visa i Dokument` links carry validated contextual filters and use the same authorized center. Denied, archived and unknown targets produce honest states without disclosure. Upload remains owner-required and uses existing contextual commands; no orphan/global upload store or folder tree is introduced. | 20.3 |
| FR109-AC11 | Desktop and connected 360×640 journeys cover keyboard/focus, loading, authorized empty, filtered empty, explicit read/sign/mutation failure, retry and success only after persistence. The final UX contract defines Swedish labels and preview behavior; no PWA/offline queue is added. | 20.2, 20.3 |
| FR109-AC12 | Required unit, integration/RLS, browser and scope/security evidence covers all active enrolled source owners, negative roles, cross-tenant requests, archived/locked/PDF cases, multi-linked files and later source activation. Run database evidence with `SUPABASE_TEST_REQUIRED=1` and report executed/skipped counts; explicitly skipped preview coverage is not proof. | all |

## Story preparation

The following bounded descriptions and ACs are the preparation contract for canonical full story files. They are not a substitute for pinned `ready-for-dev` story artifacts, oracle resolution, lifecycle decisions and the read-only parallel plan.

### Story 20.1 — Documents activation, source-authorized aggregation and minimal destination

**User story:** As a tenant user with file and source access, I can open `Dokument` and discover eligible files across active modules so that I do not need to remember which entity panel holds a file.

**Prerequisites:** Bounded E20 sequencing decision recorded; E20 oracle terminology gate resolved; final read/source authorization design and documents permission rows reviewed. Existing file substrate and currently active sources are available. Completion of every B1b module is not a technical prerequisite: only integrated active sources participate.

**Acceptance criteria:**

1. FR109-AC1–AC5 are demonstrated, with the nav swap in this story's PR. Keep `/files` as the existing route unless an explicitly recorded route decision supersedes it; no second destination is required.
2. Documents uses dedicated activation matrix rows that preserve existing file-role bounds (`tenant_admin` and `projektledare`; Montör remains closed). The route capability, existing `Files.View` signing capability and source permissions all remain server-enforced. No new role entitlement is inferred from activation.
3. An active-source registry resolves each enrolled owner to its existing table/authorization path and safe labels. `quote_version` appears despite not being generic-command-creatable. Every active source is covered or reported as a blocking incompatible contract before dispatch; no silent drop or pending-source activation repairs coverage.
4. The read model exposes display-safe `{ data, entitlements }` information using the established server read-model convention. It rejects/withholds unauthorized source context and does not serialize storage identity, role matrices or privileged keys.
5. A minimal usable list and checked preview/download action survive the nav swap. Existing file functionality is preserved until the deeper 20.2 surface lands. Preview signing reuses the current audit-attested funnel and preserves ADR-B008 restrictions.
6. Two-tenant and denied-role integration tests exercise the real read/sign path; active quote links, missing/cross-tenant source IDs, archived links/files and a same-file/different-owner case are covered. Manifest/matrix/nav coherence and pending-token tests remain derived and green.

**Implementation boundaries:** Expected claims include `src/scope/manifest.ts`, app-shell nav resolution/labels, files route/read model, active-owner registration and authz rows, corresponding scope/RLS/browser tests. No new storage tables or owner types, no activation of resources/scheduling/rentals/other pending modules, no broadening of file-role access. Any necessary additive indexes/policies or checked helpers require a recorded justification and exact-policy/security evidence; zero tables does not imply zero possible migrations.

**Done evidence:** Approved pinned story, independent High authorization review, required executed database negatives, usable-list browser check, verify/scope/security gates and author-written Suggested Review Order with current rationale, verified stops and evidence.

### Story 20.2 — Search, filters, preview and archive/restore

**User story:** As an authorized Documents user, I can narrow files, inspect supported previews, and manage eligible archived files while preserving source permissions and immutable commitments.

**Prerequisites:** 20.1 integrated. Deepened E20 UX states and the archive/restore transition matrix recorded before implementation. Source authorization and multi-owner mutation behavior are reviewed at High effort.

**Acceptance criteria:**

1. FR109-AC6–AC9, AC11 and AC12 hold; search/facets/date bounds/result navigation operate solely on the authorized set and share the same semantics in UI and read-model tests.
2. The preview pane uses newly authorized signed access, explicit expiry/refresh and unsupported-format download. Failure is visible, safe and retryable where appropriate. Changing selection cannot display the preceding file's preview as the newly selected file.
3. Archived-mode results remain metadata-only until an eligible restore succeeds. Counts/facets are equally source-scoped. Archive communicates that it affects a file shared across links rather than merely removing the selected index row.
4. Archive/restore re-check all authority affected by a file-level mutation and prove the final multi-link rule in command and direct RPC tests. A hidden or non-mutable owner cannot be bypassed by selecting a different visible link. No new tenant-wide Montör access is introduced.
5. Restore runs through a narrow authenticated, checked, attributable database path because direct `files` UPDATE is revoked. Use the current file authority/audit conventions; do not re-enable direct DML to make restore work. Failed writes/audit produce no success; retries do not create duplicate state/audit effects.
6. The accepted transition matrix names generic ordinary files, locked commitment evidence, quote PDFs, independently archived domain links, orphaned/deleted sources and deleted metadata. It preserves lock fields, immutable identities and bytes; reconstructs a safe destination lifecycle; and blocks every reservation/provenance-invalid artifact. Generic restore cannot change quote PDF validity or relink domain-removed evidence.
7. Tests cover concurrent/repeated archive/restore, actor/tenant spoofing, denied and removed membership, cross-source permission differences, stale signed access refresh and archive/restore failures. Tests explicitly cover authorization changes between list display and mutation.

**Implementation boundaries:** Files search/filter UI and pure logic, preview components, minimal checked restore authority/migration if needed, existing archive command integration and their tests. No physical deletion/retention workflow, no new storage tables/buckets, content indexing, document editor, folders, AI, upload expansion or automatic relinking. Do not rewrite frozen migrations; add a bounded migration when needed.

**Done evidence:** Transition-matrix proof, independent High authorization/lifecycle review, required RLS/command evidence with no unreported skips, desktop/360×640 preview/search/archive/restore browser evidence and current Suggested Review Order.

### Story 20.3 — Entity-panel links and contextual navigation

**User story:** As a user viewing an entity's files, I can choose `Visa i Dokument` and reach that entity's authorized Documents results without losing context.

**Prerequisites:** 20.1 and 20.2 integrated; final active-source route adapter inventory recorded. Avoid entity panels currently claimed by another worker until ownership is reconciled.

**Acceptance criteria:**

1. FR109-AC10–AC12 hold. Cross-links are added to compatible, integrated active entity panels only and open the center with module/owner context preselected.
2. Deep-link inputs are validated by the server read path; forged filters do not grant access. Deleted, archived, inaccessible or unsupported owners have explicit outcomes, without a fabricated owner label or existence leak.
3. Existing owner-required upload behavior remains available through the accepted contextual entry points and commands. The current list-page owner-picker affordance is either retained or changed only by a recorded UX decision; the candidate's sentence about entity-context upload is not permission to remove shipped behavior silently.
4. Owners added by later module activation have a documented adapter/registration extension contract. The story does not touch pending module panels, create their routes or finish their schema.
5. Browser tests exercise at least two materially different active source contexts, same-file/multiple-link context, denied source access, back/navigation behavior and the connected phone viewport.

**Implementation boundaries:** Entity-panel cross-links, route/filter adapters and tests. This story does **not** defer activation or the nav swap from 20.1. Keep shared file substrate changes in earlier stories; adding links to future operational panels belongs to the activating source story if that panel did not exist when E20 landed.

**Done evidence:** Adapter inventory and context tests, independent review, UX/browser evidence and current Suggested Review Order.

## Closure decisions and exact blockers

| Item | Classification | Exact closure action |
| --- | --- | --- |
| Early E20 exception in canonical governance | Dispatch blocker | Parent/coordinator records the E20-only sequencing amendment, links this checkpoint and states that full AC-B2-8/PB-D10 completion remains outstanding. Preparation authorization is already recorded; do not claim a full-wave decision. |
| E20 live oracle terminology and behavior | Dispatch blocker | Perform the authorized behavioral-only terminology observation; record `Dokument` label sanity, search/filter/preview/archive vocabulary and parity delta. Do not copy implementation or record real customer files/PII. If access is unavailable, retain the explicit unresolved gate and request only the missing access/owner resolution. |
| Source registry/permission contract | Dispatch blocker for 20.1 | Record every currently active owner and its existing enforced source read/mutation path, including domain-created quote links. Resolve gaps rather than widening source access; review the final authority path at High effort. |
| Detailed UX contract | Specification blocker for 20.2/20.3 | Record list row identity, safe display fields, search/date bounds, stable result navigation, keyboard/mobile states, Swedish text, and current owner-picker upload disposition. Choices within the ratified patterns can be finalized from context; a material conflict requires a concise owner decision. |
| Archive/restore lifecycle and multi-link impact | Specification blocker for 20.2 | Produce and accept the explicit allowed transition/authority matrix, including locked evidence and quote-PDF exceptions. Verify required historical state can be derived safely; if not, propose bounded metadata support without inventing a second storage model. Do not mark generic restore implemented or harmless. |
| Full canonical story files and review metadata | Dispatch blocker | Author complete 20.1–20.3 story files from this contract, record dependencies and verification stops, run story audit/test-gate process, pin them and update aggregate sprint state only through the coordinator. Maintain the author-written Suggested Review Order scaffold. |
| Epic 14 or runner-repair claims | Concurrency scheduling blocker when overlapping | Inspect current claims and source base; exclude their exact write scopes, shared governance/authz/envelope/migration changes and mutable test resources. Use separate worktrees and shared repository claims. No live loop is upgraded mid-phase. |
| Full B1b→B2 checkpoint and FR110–FR118 expansion | Remaining wave requirement | Complete at the normal checkpoint. This is not an E20 technical dependency after the bounded exception is recorded, and this document does not satisfy it. |
| Every future module emits compatible metadata | Activation requirement | Require the source module's activation story to register compatible owner/purpose/source authorization and extend E20 coverage. Its pending status is not an early E20 blocker. |
| Lovable data migration / new storage tables | Not an E20 requirement | No E20 migration of legacy records; no new storage tables. Needed bounded authorization/lifecycle/index migrations remain subject to normal review. |

## Concurrency and readiness verdict

E20 is a plausible independent workstream alongside E14 because it consumes the existing file substrate and does not require resources/scheduling/person schema. It is not safe to infer independence from epic numbers alone. Documents activation changes shared manifest/nav/matrix/read-model surfaces; lifecycle work may touch shared command authority and migrations; 20.3 can overlap entity-panel work. The coordinator must pin actual path and semantic claims, plan integration order and schedule isolated or exclusive mutable database verification.

20.1→20.2→20.3 is the proposed dependency chain. It creates cross-epic concurrency with E14; it does not authorize simultaneous implementation of these three dependent stories. Later active-module changes are integrated against the source registry contract and combined tests.

**Readiness: prepared, not ready to implement.** Close the dispatch/specification blockers above, then run the read-only parallel planner and obtain the appropriate assignment/implementation authorization. No app code, manifest activation, database migration, service launch, live oracle verification or worker launch is claimed by this preparation document.