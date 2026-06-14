---
date: 2026-06-11
project: ElproSaas
workflow: correct-course
mode: planning-correction-only
trigger: implementation-readiness-report-2026-06-11.md - Major Issue 3 (Epic 8 file sequencing)
scope_classification: Minor (docs-only planning edit)
status: approved-and-applied
approved_by: Rasmus
applied: 2026-06-11
constraints:
  - no code implementation
  - no migrations
  - no new dependencies
  - no .env changes
  - no deferred-scope activation
---

# Sprint Change Proposal - Epic 8 File Foundation Sequencing

## Section 1: Issue Summary

**Problem statement:** The Phase A epic order places the generic file/storage model (Epic 8, Story 8.1: `files`, `file_links`, private buckets, signed access) *after* three epics that need file behavior: Epic 5 (calculation attachments, FR26), Epic 6 (quote PDF storage in Story 6.3 and attachment snapshots in 6.1), and Epic 7 (acceptance evidence files). Story 6.3 currently hedges with "introduces only the minimal private file metadata/storage behavior ... if the generic file model does not exist yet," and Story 8.1 mirrors the hedge ("must reuse and extend it rather than create a competing model"). That conditional duality is a real risk: two file models, or a throwaway interim model that Story 8.1 must reconcile.

**Discovery:** Implementation readiness check (2026-06-11) returned READY with no critical blockers and 100% FR coverage, but flagged this as the single structural decision worth resolving before sprint planning (Major Issue 3, also reflected in forward-dependency notes for Epics 5/6/7).

**Evidence:** epics.md Story 6.3 Technical Notes, Story 8.1 Technical Notes, Story 6.1 Dependencies ("and Story 8.1 if attachment metadata is persisted"), and the Epic 5/6/7 dependency notes referencing Epic 8.

## Section 2: Impact Analysis

**Epic impact:**

- **Epic 8** — split into two waves. Wave 1: Story 8.1 becomes the early file foundation (bucket config, `files` base metadata, minimal `file_links`, tenant ownership/RLS, server-derived paths, signed-access command foundation, storage negative tests) and is sequenced before Epics 5-6. Wave 2: Stories 8.2-8.5 (validated uploads, entity file panels, lifecycle locks, limited file index) stay where they are, after Epics 5-7.
- **Epic 6** — Stories 6.1 and 6.3 gain an unconditional backward dependency on Story 8.1; the "minimal file slice" escape hatch in 6.3 is removed.
- **Epics 5 and 7** — dependency notes updated from "Epic 8" to "Story 8.1 foundation (Wave 1) / Story 8.2 upload UX (Wave 2)". Story 7.1's external-evidence-reference fallback remains valid.
- No epic is added, removed, renumbered, or invalidated. Story numbering is unchanged.

**Story impact:** 4 stories edited (6.1, 6.3, 8.1, 8.3), plus epic-level dependency/scope notes for Epics 5, 6, 7, 8. No stories created or deleted.

**Artifact conflicts:**

- **PRD:** None. No FR text changes; FR coverage map is untouched (FR26/FR34/FR49-FR54 keep their existing epic assignments).
- **Architecture:** None — this correction aligns the epics with the architecture, which already specifies a single file model (`files` + `file_links`, sections 6/14) and already lists the `createSignedFileAccess` command. No architecture edits required.
- **UX:** None. File UX requirements (entity panels, upload states, signed access) are unaffected; only build order changes.
- **Sprint status:** N/A — sprint planning has not run yet; this correction lands before it.

**Technical impact:** Docs-only. No code, migrations, dependencies, `.env` changes, or deferred-scope activation. Security guardrails are strengthened, not weakened: the single file model means private-bucket, server-derived-path, and RLS/storage negative-test requirements are implemented once, early, and reused.

## Section 3: Recommended Approach

**Direct Adjustment** (Option 1). Modify dependency declarations and four stories within the existing epic structure.

- **Rationale:** Nothing is implemented yet, so this is the cheapest possible moment to fix sequencing. The alternative (keeping the documented seams as binding constraints) leaves a conditional dual-model risk that every implementer of 6.1/6.3/8.1 must re-interpret. Splitting Epic 8 into waves keeps the epic intact (no renumbering, FR coverage map untouched) while making Story 8.1 an explicit prerequisite of quote/PDF work.
- **Effort:** Low — 11 targeted edits to epics.md.
- **Risk:** Low — no scope change, no new tables beyond what Story 8.1 already owned, no FR movement.
- **Timeline impact:** None negative; Story 8.1 moves earlier in the build order. Recommended story execution order becomes: Epics 1 → 2 → 3 → 4 → **Story 8.1** → Epic 5 → Epic 6 → Epic 7 → Stories 8.2-8.5 → Epic 9.
- **Rollback / MVP review:** Not applicable — no completed work exists; MVP scope unchanged.

## Section 4: Detailed Change Proposals (exact edits to epics.md)

### Edit 1 — Epic List, Epic 5 dependency note

OLD:
> **Natural dependencies:** Epics 1-4. File attachment behavior is completed by Epic 8 but calculation work remains functional without broad file-center behavior.

NEW:
> **Natural dependencies:** Epics 1-4 plus Story 8.1 (file foundation) for attachment metadata. Upload UX and entity file panels are completed by Story 8.2; calculation work remains functional without broad file-center behavior.

Rationale: Converts the forward reference into an explicit backward dependency on the early foundation.

### Edit 2 — Epic List, Epic 6 dependency note

OLD:
> **Natural dependencies:** Epics 1-5. Story 6.3 introduces only the minimal quote-PDF private storage slice needed for generated PDFs; Epic 8 later expands reusable file handling.

NEW:
> **Natural dependencies:** Epics 1-5 plus Story 8.1 (file foundation). Story 6.3 stores generated PDFs through the shared `files`/`file_links` foundation from Story 8.1; Stories 8.2-8.5 later expand file workflows.

Rationale: Removes the "minimal slice" escape hatch — the root of the dual-model risk.

### Edit 3 — Epic List, Epic 7 dependency note

OLD:
> **Natural dependencies:** Epics 1-6 and the Phase A subset of Epic 8 for acceptance evidence files.

NEW:
> **Natural dependencies:** Epics 1-6 plus Story 8.1 (file foundation). File-upload evidence UX is completed by Story 8.2; acceptance can use external evidence references until then.

Rationale: Replaces the vague "Phase A subset of Epic 8" with the concrete wave split.

### Edit 4 — Epic List, Epic 8 dependency note

OLD:
> **Natural dependencies:** Epics 1-3 for tenant/CRM context; integrates with Epics 5-7 as those workflows need attachments, PDFs, and evidence.

NEW:
> **Natural dependencies:** Split sequencing. Story 8.1 (file foundation) depends only on Epics 1-2 and must run before Epics 5-6. Stories 8.2-8.5 depend on Story 8.1 and integrate with Epics 5-7 as those workflows need uploads, attachment panels, locks, and evidence.

### Edit 5 — Epic 8 detailed header (Scope + Dependencies)

OLD (Scope):
> **Scope:** Private storage buckets, `files`, `file_links`, entity-scoped file panels, validated upload, signed access, quote PDF/attachment/evidence locks, archive/delete audit, and cross-tenant storage negative tests.

NEW (Scope):
> **Scope:** Two waves. Wave 1 (Story 8.1, runs before Epics 5-6): private storage bucket configuration, `files` base metadata, minimal `file_links`, tenant ownership, server-derived paths, signed-access command foundation, and RLS/storage negative tests. Wave 2 (Stories 8.2-8.5, run after Epics 5-7 owner workflows): validated uploads, entity-scoped file panels, quote PDF/attachment/evidence lifecycle locks, archive/delete audit, and the optional limited file index.

OLD (Dependencies):
> **Dependencies:** Epics 1-3. Integrates with Epics 5-7 as those workflows need attachments, PDFs, and evidence.

NEW (Dependencies):
> **Dependencies:** Story 8.1: Epics 1-2 only. Stories 8.2-8.5: Story 8.1 plus the owner-entity workflows from Epics 3, 5, 6, and 7.

### Edit 6 — Story 8.1 (title, acceptance criteria, technical notes, test requirements, dependencies)

Title OLD:
> ### Story 8.1: Private Storage Metadata, Links, And RLS

Title NEW:
> ### Story 8.1: File Storage Foundation - Private Bucket, Metadata, Links, RLS, And Signed-Access Command

Acceptance criteria — ADD two blocks after the existing three:

> **Given** private storage configuration
> **When** the file foundation is provisioned
> **Then** Phase A buckets are private by default with server-derived object paths
> **And** no public bucket or client-controlled storage path exists.
>
> **Given** a tenant-owned file with metadata
> **When** a server command requests access on behalf of a tenant admin
> **Then** `createSignedFileAccess` verifies tenant membership, file metadata ownership, and lifecycle state before issuing a short-lived signed URL
> **And** anonymous and cross-tenant signing attempts are rejected with generic user-safe errors.

Technical Notes OLD:
> **Technical Notes:** Owner types are limited to Phase A entities: customer, facility, contact, calculation, quote_version, quote_acceptance, and job. If Story 6.3 already introduced minimal quote-PDF file metadata, this story must reuse and extend it rather than create a competing model. For metadata plus link creation that must be atomic, use a narrow Postgres RPC or approved direct server DB transaction adapter.

Technical Notes NEW:
> **Technical Notes:** Owner types are limited to Phase A entities: customer, facility, contact, calculation, quote_version, quote_acceptance, and job. This story is the single Phase A file model; later stories (6.3, 8.2-8.5) must reuse and extend it and must not create a competing model. `file_links` uses polymorphic owner type/id with command-level ownership validation; link creation for an owner type activates only once that owner table exists. No upload UI, entity file panels, lifecycle locks, or file index in this story. For metadata plus link creation that must be atomic, use a narrow Postgres RPC or approved direct server DB transaction adapter.

Test Requirements OLD:
> **Test Requirements:** Migration reset, RLS negative tests for `files` and `file_links`, owner spoof tests, lifecycle state validation tests.

Test Requirements NEW:
> **Test Requirements:** Migration reset, RLS negative tests for `files` and `file_links`, owner spoof tests, lifecycle state validation tests, and signed-access authorization tests (anonymous rejection, cross-tenant rejection, storage path spoof rejection).

Dependencies OLD:
> **Dependencies:** Epic 2 and relevant owner tables from Epics 3, 5, 6, or 7.

Dependencies NEW:
> **Dependencies:** Epic 2 only. Must complete before Story 6.3 (quote PDF storage). Owner-entity link validation activates per entity as Epics 3, 5, 6, and 7 introduce owner tables.

Rationale: Story 8.1 becomes the early foundation exactly as scoped: bucket config, base metadata, minimal links, tenant ownership, RLS/storage negatives, server-derived paths, signed-access command foundation — and nothing more (no panels, uploads, locks, or index; no deferred owner types; no document-center UI).

### Edit 7 — Story 8.3 technical notes (signed-access command now founded in 8.1)

OLD:
> **Technical Notes:** File access always resolves metadata first, storage second. Do not expose raw bucket/path details unnecessarily in UI.

NEW:
> **Technical Notes:** Builds on the `createSignedFileAccess` command foundation from Story 8.1; this story delivers the tenant-admin preview/download UX, expiry/refresh behavior, and the full storage negative matrix. File access always resolves metadata first, storage second. Do not expose raw bucket/path details unnecessarily in UI.

Rationale: Keeps 8.3's user-facing scope intact while acknowledging the command primitive already exists.

### Edit 8 — Story 6.1 dependencies

OLD:
> **Dependencies:** Epics 2-5 and Story 8.1 if attachment metadata is persisted.

NEW:
> **Dependencies:** Epics 2-5 and Story 8.1 (file foundation) for persisted attachment metadata.

Rationale: Removes the conditional — the foundation now always exists before Epic 6.

### Edit 9 — Story 6.3 technical notes + dependencies

Technical Notes OLD:
> **Technical Notes:** The exact PDF renderer must be selected and pinned in this story implementation. This story introduces only the minimal private file metadata/storage behavior needed for generated quote PDFs if the generic file model does not exist yet; Epic 8 must reuse and expand that model rather than duplicate it. Retry may regenerate the file from the same immutable snapshot without changing customer-visible data.

Technical Notes NEW:
> **Technical Notes:** The exact PDF renderer must be selected and pinned in this story implementation. Generated PDFs are stored through the Story 8.1 file foundation (`files`/`file_links`, private bucket, server-derived paths, signed access); this story must not introduce its own file metadata or storage model. Retry may regenerate the file from the same immutable snapshot without changing customer-visible data.

Dependencies OLD:
> **Dependencies:** Stories 6.1 and 6.2.

Dependencies NEW:
> **Dependencies:** Stories 6.1, 6.2, and 8.1 (file foundation).

Rationale: This is the core fix — 6.3 reuses, never creates, the file model.

### Edit 10 — Epic 5 detailed header dependencies

OLD:
> **Dependencies:** Epics 1-4. Calculation attachments depend on Epic 8 for full file behavior.

NEW:
> **Dependencies:** Epics 1-4. Calculation attachment metadata uses the Story 8.1 file foundation; upload UX and entity file panels are completed by Story 8.2.

### Edit 11 — Epic 7 detailed header dependencies

OLD:
> **Dependencies:** Epics 1-6. Acceptance can record an external evidence reference in this epic; file-upload evidence integration is completed by Epic 8.

NEW:
> **Dependencies:** Epics 1-6 plus Story 8.1 (file foundation). Acceptance can record an external evidence reference in this epic; file-upload evidence UX is completed by Story 8.2.

## Updated Story Dependency Summary

| Story | Old dependency | New dependency |
| --- | --- | --- |
| 8.1 | Epic 2 + owner tables from Epics 3/5/6/7 | Epic 2 only; must precede Story 6.3 |
| 6.1 | Epics 2-5 + Story 8.1 *if* attachments persisted | Epics 2-5 + Story 8.1 (unconditional) |
| 6.3 | Stories 6.1, 6.2 | Stories 6.1, 6.2, 8.1 |
| 8.2 | Story 8.1 + owner entity stories | unchanged |
| 8.3 | Stories 8.1, 8.2 | unchanged (notes reference 8.1 command foundation) |
| 8.4 | Stories 8.1-8.3 + Epics 6-7 | unchanged |
| 8.5 | Stories 8.1-8.4 | unchanged |

**Recommended story execution order:** Epic 1 → Epic 2 → Epic 3 → Epic 4 → **Story 8.1** → Epic 5 → Epic 6 → Epic 7 → Stories 8.2-8.5 → Epic 9.

## Alignment Confirmation

- **PRD:** Intact. No FR added, removed, or reworded. FR coverage map unchanged (FR26, FR34, FR49-FR54 keep existing epic assignments; coverage remains 100%).
- **Architecture:** Intact and now better honored — architecture sections 6 and 14 already define exactly one file model and list `createSignedFileAccess`; the epics now build it once, early.
- **UX:** Intact. Entity file panels, upload states, signed access UX, and lifecycle-lock UX are unchanged in content; only build order moves.
- **Security guardrails:** Strengthened — private buckets, server-derived paths, tenant-owned metadata, and storage negative tests are established once before any file-consuming workflow.
- **Scope boundaries:** No Fortnox, supplier, AI, field-worker, HR, rentals, assets, DoU, tender/FKU, full RBAC, public endpoints, or broad document center introduced. No deferred owner types added to `file_links`.

## Implementation-Readiness Rerun?

**A full rerun is not required.** This correction changes sequencing and dependency declarations only — FR coverage (100%), UX alignment, and story quality are unaffected, and the change resolves the report's Major Issue 3 exactly as recommended. Suggested lightweight action instead: annotate the 2026-06-11 readiness report (Major Issue 3 → resolved via this proposal). Rerun the full IR check only if further structural edits are made to epics.md before sprint planning.

## Section 5: Implementation Handoff

- **Scope classification:** Minor — docs-only planning edit, directly implementable.
- **Executor:** Scrum Master (this session) applies the 11 edits to `_bmad-output/planning-artifacts/epics.md` upon approval. No other artifact requires changes.
- **Success criteria:** All 11 edits applied verbatim; no other epics.md content altered; FR coverage map untouched; Story 6.3 and Story 8.1 contain no remaining "competing model" hedge language; sprint planning can consume the updated dependency graph.
- **Next step after application:** Run `bmad-sprint-planning` (fresh context), which will sequence Story 8.1 before Epic 5 based on the updated dependencies.
