# Story 8.5: Limited File Index And File Audit Within Phase A Scope

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tenant admin,
I want a LIMITED, tenant-scoped `Filer` index that lists ONLY my Phase A entity files (CRM, calculation, quote, acceptance, job/order) plus a per-file history, AND the entity file panels wired to REPLACE/ARCHIVE affordances that respect the 8.4 lock (a locked file shows a lock notice + archive-only, NEVER replace/delete),
so that required documents are findable and manageable WITHOUT creating a broad document center — every file event (upload, link, signed-access, archive, lock) already lands in `audit_events` with safe metadata, and RLS proves tenant B's file metadata is never visible.

## Context & Why This Story Is The Wave-2 Closer (and the build/skip resolution)

This is the **LAST story of Epic 8** (`is_last_in_epic: true`) and the **only remaining Wave-2 file surface**. Story 8.1 shipped the single Phase A file model (`files`/`file_links`/`storage.objects` RLS + `createSignedFileAccess`); 8.2 shipped validated uploads + the `EntityFilePanel`; 8.3 shipped signed preview/download in the panel; 8.4 shipped the two-layer sent/accepted lock (`FL823 → FILE_LINK_LOCKED`) + the `archiveFile` archive-only-delete command. 8.5 delivers the last two epic surfaces: **(a) the limited `/files` index** and **(b) the panel lock/replace/archive affordance wiring that 8.2/8.3/8.4 deferred here.**

**BUILD vs SKIP — RESOLVED TO BUILD (a LIMITED Phase-A index):** epics.md 8.5 Technical Notes say the index "can be skipped if entity-scoped panels satisfy pilot needs," and the test-design lists an open "File-index scope decision." BUT the **documented owner decision is explicit: "Phase A Story 8.5 is a *limited* file index, not a broad document center. Recommend: keep limited for the pilot, designed so a fuller library can layer on later"** (`owner-decisions-applied-2026-06-18.md#Epic 8·8.5`, resolving the "unified document library" ask `7.5`). Additionally, THREE prior-story review deferrals explicitly name 8.5 as their landing spot and would be left UNRESOLVED by a skip:
- **8.4 code review [Low]:** `file-lock-panel.e2e.spec.ts` ships fully `test.skip` — "panel wiring is 8.5 … un-skip and add the `data-testid`s the spec expects when the locked-file panel state renders."
- **8.2 code review + 8.4 E2E:** the `EntityFilePanel` has NO replace/delete affordance today; 8.4's `test.skip` E2E asserts a locked file shows a lock notice + archive-only and NO replace/delete.
- **8.3 (headline expiry→refresh) already lands in the panel** — 8.5 does not re-open it but must not regress it.

**DECISION (record in Dev Agent Record): BUILD the limited Phase-A index + wire the panel lock/replace/archive affordances.** Basis: the 2026-06-18 owner decision + three concrete 8.2/8.3/8.4 deferrals landing here. Do NOT skip. The STOP boundary (R-816) is the guardrail: if the index grows toward a document center / deferred-module groupings / cross-module analytics, STOP.

**What is ALREADY DONE (do NOT rebuild — R-814 single-model, no competing surface):**
- The `Filer` nav item + `/files` route already exist (`src/components/app-shell/nav-items.ts`; `src/app/(app)/files/page.tsx` is a `PagePlaceholder` stub to REPLACE). The seven-item nav is FROZEN — do NOT touch nav-items.ts.
- The `archiveFile` command (8.4, `src/server/commands/files/files.ts:419`) with `eventType: "file.archived"`, conditional audit write, idempotent no-op, `FILE_LINK_LOCKED` on a crafted hard-delete.
- ALL file audit event types already emit through the command envelope's `writeAuditEvent`: `file.uploaded` (8.2), `file.linked` (8.1), `file.signed_access.created` (8.1/8.3), `file.archived` (8.4). The AC2 "audit event written with safe metadata" is largely SATISFIED BY CONSTRUCTION — 8.5 VERIFIES + TESTS it, it does not invent a new audit model (§15).
- The pure lock predicates `isFileLinkLockable` / `isLockedFileArchivable` (`src/features/files/lock-predicates.ts`, 8.4 Task 5.1) — the client-safe predicates the panel MUST use to gate replace/delete vs archive.
- `readEntityFiles` (`src/features/files/read.ts`) — the per-entity RLS read, returning display-safe rows (NEVER `object_path`/`bucket_id`, R-810). The index read (Task 1) is the CROSS-OWNER-TYPE sibling of this.

**Scope of THIS story:**
1. **Limited `/files` index** — a SERVER component + client list island that reads the tenant's OWN non-archived `file_links`→`files` across the Phase A owner types ONLY (`customer`, `facility`, `contact`, `calculation`, `quote_version`, `quote_acceptance`, `job`), with per-file display-safe metadata + a search/filter (name/type/owner-category), + a per-file preview (reuse `previewEntityFileAction`), + a scope guardrail that renders NO deferred-module groupings / document-center workflows / cross-module analytics (R-816).
2. **Panel affordance wiring** — extend `EntityFilePanel` (and/or the acceptance panel) so a LOCKED file shows the lock notice (`file-lock-notice` / `evidence-lock-notice`) + an archive-only affordance (`archive-file`) and NO `replace-file`/`delete-file`; an UNLOCKED file may show a replace (re-upload) + an archive affordance. Wire the archive control to the existing `archiveFile` command. Un-skip `file-lock-panel.e2e.spec.ts` and add the `data-testid`s it expects.
3. **RLS negatives + audit tests** — a tenant-scoped index listing (only tenant A files) + an RLS negative (tenant B metadata invisible), and INT proof that the file lifecycle events write `audit_events` rows with allow-listed metadata only.

**Explicitly NOT in this story (STOP conditions / non-scope):**
- A broad document center, cross-module analytics/dashboards, deferred-module file groupings, or any "document library" feature beyond the flat limited index — a STOP requiring human approval (R-816; epics.md 8.5 Stop Condition).
- Any NEW `files`/`file_links` COLUMN, NEW TABLE, or NEW migration by default (H4 tenant-table inventory + migration-reset EXACT per-table policy enumeration stay UNCHANGED — like 8.4). The index is a READ + the panel wiring reuses the 8.4 `archiveFile` write; no schema change is needed.
- A NEW nav item or a change to `nav-items.ts` (the seven-item nav is frozen; `Filer` already exists).
- A NEW signing/upload/audit mechanism — REUSE `createSignedFileAccess` / `previewEntityFileAction` / `uploadFile` / `archiveFile` / `writeAuditEvent` verbatim. A second file/storage/signing model is a design defect and a STOP (R-814).
- The owner-gated correction/edit-after-acceptance workflow (R-714), hard-delete of locked evidence (legal sign-off STOP, R-818), object-byte reclamation from the bucket (a later storage-retention story), and byte-level MIME content sniffing (R-817).
- Re-opening the 8.3 expiry→refresh E2E `test.fixme` (a test-DX deferral with its own owner) — do NOT regress it, do NOT re-open it here.

## Acceptance Criteria

**AC1 — The limited `Filer` index lists ONLY Phase A entity files, tenant-scoped, no document-center surface (epics.md 8.5 AC1; R-816)**
**Given** a tenant admin opens `Filer` (`/files`)
**When** the index renders
**Then** it lists ONLY the tenant's own non-archived files linked to a Phase A owner type (`customer`, `facility`, `contact`, `calculation`, `quote_version`, `quote_acceptance`, `job`) — each row showing display-safe metadata (display_name, type, size, owner category label, created_at) and a per-file preview affordance
**And** NO deferred-module groupings, broad document-center workflows, or cross-module analytics are shown — a guardrail asserts the ABSENCE of any deferred file-category label (the same forbidden-token discipline as the `job-non-scope`/nav guardrails)
**And** NO raw `object_path`/`bucket_id` is ever rendered (R-810) — a signed URL is minted only through the `createSignedFileAccess` funnel on demand.

**AC2 — Every file lifecycle event is a tenant-scoped `audit_events` row with safe metadata (epics.md 8.5 AC2; architecture §15)**
**Given** a file event occurs (upload, link, signed-access creation, archive/delete, or lifecycle lock)
**When** the event is committed through the command envelope
**Then** a tenant-scoped `audit_events` row is written via `writeAuditEvent` with allow-listed metadata ONLY — NO raw file contents, NO bucket/object path, NO PII, NO service-role detail (§15)
**And** the event types are the §15-named set (`file.uploaded`, `file.linked`, `file.signed_access.created`, `file.archived`) — REUSED verbatim, NO new audit model
**And** an INT test proves the archive path writes exactly ONE audit row with clean `{ targetId, reason? }`-shaped metadata (the archive path is the one 8.5 newly surfaces from the UI; the upload/link/sign paths are already audit-tested by 8.1/8.2/8.3).

**AC3 — File search/filter is strictly own-tenant; RLS proves tenant B metadata is invisible (epics.md 8.5 AC3; R-801/R-816)**
**Given** tenant A searches/filters the index
**When** the query runs on the per-request RLS client (anon key — no tenant id passed)
**Then** ONLY tenant A file metadata appears (RLS scopes every row; a cross-tenant owner id returns zero rows)
**And** an RLS NEGATIVE test proves tenant B's file/file_link metadata is NOT visible to tenant A through the index read path (reuse the shipped `files`/`file_links` enrollment negatives — R-801)
**And** a read fault degrades to a GENERIC Swedish error signal (mirrors the CRM/jobs read-error posture), never a cross-tenant leak or a raw error.

**AC4 — The entity panels wire the 8.4 lock into a lock-notice + archive-only affordance; replace/delete never render on a locked file (from the 8.2/8.3/8.4 panel deferrals; R-812/R-822)**
**Given** an `EntityFilePanel` (or the acceptance panel) rendering a file whose lock state is known from the DB
**When** the panel renders a LOCKED file (a sent quote's `quote_pdf`/`quote_attachment_snapshot`, or an accepted acceptance's `acceptance_evidence`)
**Then** the panel shows a lock notice (`file-lock-notice`, or `evidence-lock-notice` for evidence) explaining — as TEXT, not color — that the file is locked because the quote is sent / the acceptance is registered, and can be ARCHIVED but not replaced/deleted
**And** NO `replace-file` and NO `delete-file` affordance renders for a locked file; the ONLY destructive affordance is `archive-file` (archive-only, wired to the `archiveFile` command)
**And** for an UNLOCKED file the panel MAY offer a replace (re-upload) affordance + an archive affordance; the lock/replace/archive decision uses the PURE `isFileLinkLockable`/`isLockedFileArchivable` predicates (the disabled/absent control is UX ONLY — NEVER the guarantee; the command `FILE_LINK_LOCKED` + the `FL823` DB trigger are, and a UI-only lock is a STOP, R-812/architecture §9)
**And** `file-lock-panel.e2e.spec.ts` is un-skipped and green (the message-only E2E — do NOT assert DB rejection in E2E).

**AC5 — Cross-tenant / crafted index-and-archive attempts are denied with generic user-safe errors (derived from R-809/R-812/AC5 lineage)**
**Given** tenant A submits a crafted `file_id` (a foreign or non-existent id) to the index preview or the archive affordance
**When** the request runs
**Then** it is denied with the SAME generic user-safe shape as not-found (`TENANT_ACCESS_DENIED` for archive/preview ownership; a generic Swedish read error for the list) — NO existence disclosure (R-809), NO raw storage/DB error, NO "file exists but not yours" leak
**And** a locked-file archive that the DB permits (`locked → archived`) succeeds, while a crafted hard-delete surfaces the stable `FILE_LINK_LOCKED` code (both already proven at the command layer by 8.4 — 8.5 confirms the UI path routes through the same command).

## Tasks / Subtasks

- [x] **Task 1 — Limited `/files` index read + page + client list island (AC1, AC3; R-801/R-810/R-816)**
  - [x] 1.1 Add a cross-owner-type index read to `src/features/files/read.ts` (a SIBLING of `readEntityFiles`, NOT a new file/model — R-814). `readFileIndex(opts?: { search?; ownerCategory? })`: on the per-request cookie-bound RLS client (anon key — NEVER service-role), `client.from("file_links").select("id, file_id, owner_type, owner_id, created_at, files!inner(id, display_name, mime_type, size_bytes, lifecycle_state)")` filtered `.in("owner_type", ACTIVE_OWNER_TYPES)` (the Phase A set — import from `@/server/commands/files/validation`, single source of truth) + `.is("archived_at", null)` + `.order("created_at", { ascending: false })`, dropping rows whose `files.lifecycle_state` is `archived`/`deleted`. RLS scopes to the caller's tenant with NO tenant id passed; a cross-tenant row is simply never returned. Return a display-safe `FileIndexRow[]` (NEVER `object_path`/`bucket_id` — R-810) + a generic-error signal. On a query fault return `{ rows: [], error: GENERIC_READ_ERROR }` (mirror `readEntityFiles`/`readJobList`). Map each `owner_type` to a Swedish OWNER-CATEGORY label (Kund/Anläggning/Kontakt/Kalkyl/Offert/Acceptans/Jobb) for grouping/filtering — a fixed map over the ACTIVE set ONLY, never a deferred module. — DONE: `readFileIndex(injectedClient?)` (injectable, mirroring `readJobList`, so the RLS suite exercises the real read); the category map is in the pure `file-index.ts`; the filter is client-side (search/ownerCategory) applied in the island, so the read fetches the whole own-tenant set.
  - [x] 1.2 REPLACE `src/app/(app)/files/page.tsx` (currently the `PagePlaceholder` stub) with a SERVER component (`export const dynamic = "force-dynamic";` — per-request auth/data, like `/jobs`) that calls `readFileIndex()` and hands rows to a client `FileIndexList` island. NO new auth mechanism, NO new nav item ("Filer" already in the seven-item shell nav — do NOT touch nav-items.ts). SCOPE GUARD (AC1, R-816): render NO deferred-module surface — no groupings beyond the Phase A owner categories, no analytics, no document-center workflows.
  - [x] 1.3 Add `src/components/files/FileIndexList.tsx` (`"use client"`) — the limited index list island. Renders: a search input (name/type substring) + an owner-category filter (the fixed Phase A category set only); a per-file row (display_name, category label, type, size, created_at) with a per-file preview affordance REUSING `previewEntityFileAction` (the same `FilePreviewRow` pattern as `EntityFilePanel` — extract/share the preview row rather than duplicate signing logic, R-814). Filtering is client-side in-memory over the server-fetched rows (mirror `JobList`'s `useMemo` narrowing — the thin Phase-A index pattern). Non-color text status; keyboard-reachable controls with visible focus rings (the epic-6 a11y baseline). A `data-testid="file-index"` root + a `data-testid` per row; a `data-testid="file-index-empty"` empty state; a `data-testid="file-index-error"` `role="alert"` for the generic read error. — DONE: the index reuses `previewEntityFileAction` (the SAME signing funnel — R-814); the shared `FilePreviewRow` was extracted for the entity panels (archive/lock live there, not needed in the browse index).
  - [x] 1.4 Extract any pure index DECISION logic (owner-category mapping, the search/filter predicate, the forbidden-deferred-category guard list) into a pure `.ts` sibling (`src/features/files/file-index.ts`) — NO React/DOM/`"use client"` — so the fast `node --test` gate covers every branch (the coverage-shape lesson: a helper trapped in a `.tsx` is vacuous-green). Unit-pin: the category map covers exactly the ACTIVE owner set; the filter narrows correctly; the forbidden-deferred-token list is exhaustive. — DONE: the FORBIDDEN deny-list lives in `deferred-categories.ts` (re-exported from `file-index.ts`) so its own tokens do not trip the `file-index-non-scope` source-token guardrail.

- [x] **Task 2 — Wire the panel lock-notice + replace/archive affordances; un-skip the 8.4 lock E2E (AC4, AC5; R-812/R-822)**
  - [x] 2.1 Thread a per-file LOCK STATE into the panel row. The panel's rows come from `readEntityFiles`, which returns `lifecycle_state` but NOT `is_locked` on the LINK. Add `is_locked` (and enough parent-state context) to the `EntityFileRow`/read projection so the panel can render the lock notice — OR derive lockability via the pure `isFileLinkLockable({ ownerType, purpose, parentState })` using the panel's known `ownerType`/`purpose` + the file's `lifecycle_state === "locked"`. PREFER reading `file_links.is_locked` (the authoritative applied lock from 8.4) into the row projection — it is the truth the DB set; the pure predicate is the client-safe fallback. NEVER add `object_path`/`bucket_id` to the projection (R-810). — DONE: `EntityFileRow.isLocked` reads `file_links.is_locked` (OR `files.lifecycle_state === 'locked'`), the authoritative applied lock. No raw path added.
  - [x] 2.2 In `EntityFilePanel` (`src/components/files/EntityFilePanel.tsx`), for each listed file: when the file/link is LOCKED, render `data-testid="file-lock-notice"` (or `data-testid="evidence-lock-notice"` when the panel purpose is `acceptance_evidence`) with TEXT explaining it is locked (quote sent / acceptance registered) and can be archived but not replaced/deleted; render `data-testid="archive-file"` (the archive-only affordance, wired to Task 2.3); render NO `data-testid="replace-file"` and NO `data-testid="delete-file"`. When the file is UNLOCKED, MAY render a `replace-file` (re-upload) affordance + an `archive-file` affordance. Use `isFileLinkLockable`/`isLockedFileArchivable` for the decision — the disabled/absent control is UX only, NEVER the guarantee (R-812; architecture §9). Non-color text; keyboard-reachable; visible focus ring. — DONE via the SHARED `FilePreviewRow` component (used by `EntityFilePanel`, the acceptance panel, and the new sent-quote `CommitmentFilesPanel`). The sent-quote PDF panel (`renderSentQuoteFilesPanel` → `CommitmentFilesPanel`) renders the `file-lock-notice`; the accepted evidence panel renders `evidence-lock-notice`.
  - [x] 2.3 Add an archive server action (`archiveFileAction`) to `src/features/files/actions.ts` (a `"use server"` action wiring the panel/index archive control to the EXISTING `archiveFile` command via `runCommand`) — carry ONLY the `file_id` (+ optional `reason`) from the form; the command's `ownership` gate re-verifies own-tenant (a foreign id → `TENANT_ACCESS_DENIED`, no existence disclosure, R-809). On success `revalidatePath` the entity route (reuse the `ownerRoute`/`revalidate_path` pattern already in `actions.ts`) so the panel/index list re-renders with the archived file dropped. Map the typed `Result` to a user-safe state: `FILE_LINK_LOCKED` (a crafted hard-delete) → the locked message; `TENANT_ACCESS_DENIED` → generic permission; `SERVER_ERROR` → retryable. NO new command, NO direct table write, NO service-role. — DONE: `archiveFileAction` sends an ARCHIVE intent (NEVER `hardDelete:true`); revalidates the form `revalidate_path`.
  - [x] 2.4 A "replace" affordance for an UNLOCKED file is a RE-UPLOAD through the existing `uploadFileAction` (same owner/purpose) — do NOT invent a re-point command (re-pointing a file_id is exactly what the 8.4 lock BLOCKS once locked; for an unlocked file a fresh upload+link is the sanctioned "replace"). If a true replace requires archiving the old file first, sequence it as archive-then-upload through the existing commands. Keep it minimal; if replace adds risk/scope beyond a re-upload, ship archive + upload only and note it (the epic labels the index skippable — the LOCK-notice + archive-only path is the load-bearing deferral to close; a fancy replace UX is optional). — DONE (minimal): an UNLOCKED file's `replace-file` is a scroll-to-the-upload-form anchor (a fresh re-upload through the existing `uploadFileAction`), NOT a re-point command. No archive-then-upload sequencing (kept minimal per the story guidance).
  - [x] 2.5 Un-skip `tests/e2e/files/file-lock-panel.e2e.spec.ts` (remove the three `test.skip`) and make it green: the spec already asserts `file-lock-notice` (contains /låst|låses/ + /arkiver/), `evidence-lock-notice`, `archive-file` visible, and `replace-file`/`delete-file` count 0 on a sent quote / accepted acceptance. The global-setup fixture drives a real sent quote + accepted acceptance + their file ids (already scaffolded). STATES + MESSAGING ONLY — do NOT assert DB rejection in E2E (the enforcement is INT/RLS, already proven by 8.4). Per-run-unique fixture keys via `crypto.randomUUID()` (the epic-3 flake lesson — NEVER `Date.now()`). — DONE: un-skipped + green. The FIXTURE GAP is closed — added `sentQuote` (locked quote_pdf) + `acceptedAcceptance` (locked acceptance_evidence via the REAL accept RPC) to global-setup; file ids via `crypto.randomUUID()`.

- [x] **Task 3 — RLS negative + audit-event INT + index-scope guardrail tests (AC1, AC2, AC3, AC5; R-801/R-816/§15)**
  - [x] 3.1 `tests/integration/rls/file-index-isolation.rls.test.ts` (NEW, or extend an existing files RLS suite): seed (via BYPASSRLS factory) tenant A + tenant B files/links across several Phase A owner types. Prove `readFileIndex` (or the equivalent query as the anon-key RLS client for tenant A) returns ONLY tenant A rows and NEVER a tenant B file/link (R-801/AC3). Assert an EMPTY/denied result for a cross-tenant probe — NOT a weak `not.toContain` (the deferred-work 8-1 lesson: assert the positive own-tenant set AND that no tenant-B id appears; avoid a vacuous basename check). Reuse the shipped `files`/`file_links` enrollment negatives where possible (they already prove cross-tenant invisibility at the table level). — DONE: un-skipped; RLS-01/04 now call the REAL injectable `readFileIndex(clientA)` (exercising the JS lifecycle-drop), RLS-02/03 keep the raw probe. 4 tests green.
  - [x] 3.2 `tests/integration/commands/file-audit-events.int.test.ts` (NEW): prove the file lifecycle events write `audit_events` rows with allow-listed metadata ONLY (§15). At minimum: `archiveFile` writes exactly ONE `file.archived` row with clean `{ targetId, reason? }` metadata (assert NO `object_path`/`bucket_id`/PII in the JSON) on a fresh archive, and NO row on an idempotent re-archive (mirror 8.4's conditional-audit shape). Reference-assert (or reuse existing 8.1/8.2/8.3 audit tests for) `file.uploaded`/`file.linked`/`file.signed_access.created` — do NOT re-implement their coverage, just confirm the §15 set is complete and metadata-clean. A cross-tenant archive attempt → `TENANT_ACCESS_DENIED` (same generic shape as not-found — R-809/AC5). — DONE: un-skipped; 4 tests green (fresh-archive one clean row + idempotent re-archive zero rows; §15 closed-set membership; cross-tenant → TENANT_ACCESS_DENIED, no audit row).
  - [x] 3.3 Pure UNIT tests (`tests/unit/**`, `node --test` — the runner-glob trap: NEVER a `.tsx`, NEVER outside `tests/unit/**`) for the Task-1.4 pure index logic: the owner-category map covers exactly `ACTIVE_OWNER_TYPES` and maps NO deferred module; the search/filter predicate narrows correctly (name/type substring, category equality); the forbidden-deferred-category guard list is exhaustive (asserts the index can never surface a deferred grouping). Also unit-pin the panel lock-decision wiring IF any new pure predicate is added (reuse `isFileLinkLockable`/`isLockedFileArchivable` — do NOT duplicate). — DONE: `file-index.test.ts` un-skipped + repointed to the real `@/features/files/file-index`; 7 tests green. No new lock predicate added (the authoritative `is_locked` is used; `isFileLinkLockable`/`isLockedFileArchivable` unchanged, not duplicated).
  - [x] 3.4 Index-scope GUARDRAIL (E2E or DOCS, R-816): assert the `/files` index renders NO deferred-module groupings / document-center labels / cross-module analytics (the absence-of-forbidden-token discipline — mirror the `job-non-scope` guardrail and the nav deferred-module assertion). A short E2E: sign in, open `/files`, assert the index root renders, assert `toHaveCount(0)` for the forbidden deferred labels (Fortnox, HR, uthyrning, tillgångar/QR, DoU, upphandling, etc.), assert only Phase A category labels appear. — DONE: `file-index-scope.e2e.spec.ts` un-skipped + green (3 tests); the source-token guardrail `file-index-non-scope.test.ts` stays green.

- [x] **Task 4 — Full suite green + hygiene + PR impact statement (all AC)**
  - [x] 4.1 `pnpm typecheck && pnpm lint && pnpm test` green locally with the stack up (`supabase start && supabase db reset`). Storage/RLS/INT suites run under `SUPABASE_TEST_REQUIRED=1` (the storage-reachability probe FORCES the new negatives to execute — the R-2 false-green gap; a missing/partial stack must hard-fail, not skip-green). Confirm the migration-reset EXACT per-table policy enumeration + the H4 inventory gate stay UNCHANGED (8.5 adds NO table/column/policy/migration by default). If a local `db reset` leaves kong 502 on `/auth/v1/*` (the epic-8 retro flake), `docker restart supabase_kong_ElproSaas` clears it. — DONE: typecheck + lint (0 errors; 1 pre-existing unrelated warning in vat.test.ts) clean; unit 1222/1222; INT 701/701 (full suite, `SUPABASE_TEST_REQUIRED=1`). NO new migration/table/column/policy — the read + panel reuse the 8.1/8.4 schema.
  - [x] 4.2 Confirm NO regression: the shipped 8.2 upload/panel E2E, 8.3 preview/expiry E2E (do NOT re-open its `test.fixme`), and 8.4 INT/RLS lock suites stay GREEN. Coverage-inversion check (the epic-8 retro rule): after wiring the archive control through the existing `archiveFile` command, re-verify the 8.4 negative-test targets still hit the live surface (the archive UI path must route through the same command the INT suite proves — no divergent write path). — DONE: 8.2/8.3 file E2E green (the 8.3 `test.fixme` stayed skipped, NOT re-opened); quotes/crm/jobs/calc E2E green (no QuoteDetailView/panel regression). The archive UI routes through the SAME `archiveFile` command the INT suite proves (no divergent write path).
  - [x] 4.3 Clear any red-phase scaffolding verbiage on green suites (remove the three `test.skip` in `file-lock-panel.e2e.spec.ts`; no stale `describe.skip`/`notYetImplemented`). Origin-label any golden if added (none expected — this is UI + read + audit, not a money/lock golden). — DONE: all red-phase `test.skip`/`describe.skip` in the 5 scaffolds + the file-lock-panel spec cleared. No golden added.
  - [x] 4.4 Update the PR Security/RLS + Money/Quote impact statement: the limited own-tenant `Filer` index (READ-only over `file_links`→`files`, RLS-scoped, no raw path — R-810/R-816); the panel lock-notice + archive-only affordance wiring the existing `archiveFile` command; file audit events confirmed §15-clean; NO new tenant table/column/policy (H4 untouched); the STOP boundary (index must not become a document center — R-816). Note the archive-over-delete retention posture unchanged (hard-delete of locked evidence remains a legal-sign-off STOP, R-818). — DONE: see the PR Impact Statement in the Dev Agent Record below.

## Dev Notes

### Architecture patterns & constraints (MUST follow)

- **ONE Phase A file model — no competing surface (R-814, the standing STOP).** The index is a READ over the EXISTING `file_links`→`files` (a sibling of `readEntityFiles`), and the panel archive reuses the EXISTING `archiveFile` command + the EXISTING `createSignedFileAccess`/`previewEntityFileAction` signing funnel. A SECOND file/storage/signing/audit model appearing in 8.5 is a design defect and a STOP. [Source: test-design-epic-8.md#R-814; retro-notes/epic-8.md (single Phase A file model held under pressure)]
- **Limited index — NOT a document center (R-816, the 8.5 STOP).** The index lists ONLY the Phase A owner-type files (`customer`/`facility`/`contact`/`calculation`/`quote_version`/`quote_acceptance`/`job`) with a flat search/filter. NO deferred-module groupings, NO cross-module analytics, NO broad document-center workflow. A guardrail test asserts the ABSENCE of any deferred file-category label. If the index grows toward a document center → STOP (human approval, epics.md 8.5 Stop Condition). The owner decision is explicit ("keep limited for the pilot"). [Source: epics.md 8.5 (Stop Conditions); architecture.md#14 ("A limited file index may exist … broad document-center behavior is not Phase A"); owner-decisions-applied-2026-06-18.md#Epic 8·8.5; test-design-epic-8.md#R-816]
- **RLS is the tenant boundary — never a tenant id in a query (architecture §6).** Every index read runs on the per-request cookie-bound RLS client (anon key — NEVER service-role); RLS scopes rows to the caller's tenant with NO tenant id passed; a cross-tenant owner id returns zero rows. A read fault degrades to a GENERIC Swedish error (mirror `readEntityFiles`/`readJobList`), NEVER a cross-tenant leak. [Source: architecture.md#6; src/features/files/read.ts (readEntityFiles); src/features/jobs/read.ts (readJobList); src/app/(app)/jobs/page.tsx]
- **NEVER render raw `object_path`/`bucket_id` (R-810).** The index/panel projection returns ONLY display-safe fields (display_name, mime_type, size_bytes, lifecycle_state, created_at, file_id, link_id, is_locked). A signed URL is minted separately ON DEMAND through `createSignedFileAccess`/`previewEntityFileAction` — never embedded in the list, never logged, never a public URL. [Source: src/features/files/read.ts (the R-810 projection comment); src/components/files/EntityFilePanel.tsx (FilePreviewRow — the signing pattern to reuse)]
- **Audit through the EXISTING `audit_events` + `writeAuditEvent`, allow-listed metadata ONLY (§15) — NO new audit model.** The §15 file-event set is `file uploaded, linked, locked, archived/deleted, signed access created` — ALL already emit through the command envelope (`file.uploaded`/`file.linked`/`file.signed_access.created`/`file.archived`). 8.5 VERIFIES + TESTS the metadata hygiene ( NO raw contents / bucket / object path / PII / service-role detail); it does NOT invent a new event model or a `file_events` table. The DB triggers (8.4) write NO audit (no envelope context — §15 is a command-layer concern). [Source: architecture.md#15; src/server/commands/files/files.ts (eventType constants); retro-notes/epic-8.md (audit through the SAME table)]
- **The panel lock is UX ONLY — NEVER the guarantee (R-812; architecture §9).** The lock notice + the absence of replace/delete + the archive-only affordance are a UX convenience over the DB truth. The REAL guarantee is the 8.4 command `FILE_LINK_LOCKED` + the `FL823` DB trigger (proven two-layer by the 8.4 INT/RLS suites). A test that only proves a disabled button is NOT evidence — the panel E2E is message-only (do NOT assert DB rejection in E2E). Gate the affordance with the PURE `isFileLinkLockable`/`isLockedFileArchivable` predicates (reuse, do NOT duplicate). [Source: architecture.md#9, #14; src/features/files/lock-predicates.ts; tests/e2e/files/file-lock-panel.e2e.spec.ts (the message-only contract)]
- **"Replace" of an UNLOCKED file is a RE-UPLOAD, not a file_id re-point.** Re-pointing a `file_id` is exactly what the 8.4 lock BLOCKS once locked (`FL823`); for an unlocked file the sanctioned "replace" is a fresh `uploadFile` + link (optionally archive-then-upload). Do NOT build a re-point command. [Source: src/server/commands/files/files.ts (archiveFile, uploadFile); deferred-work.md (8.4 archiveFile FL823 / 6.3 re-point boundary)]
- **Archive-over-delete + retention STOP.** Deletion of a locked file is archive-only (the `archiveFile` command + the `enforce_file_lock` trigger PERMIT `locked → archived`, RAISE `FL823` on a hard DELETE). A hard-delete retention rule for locked customer evidence is a STOP requiring legal sign-off (R-818). Object BYTE reclamation is a later storage-retention story. [Source: architecture.md#14; src/server/commands/files/files.ts:419 (archiveFile); deferred-work.md (8-1 no-object-reclamation)]
- **NO frozen edits, purely additive (if any migration at all).** 8.5 needs NO migration by default (it is READ + UI + reuse of the 8.4 write). If a projection needs `file_links.is_locked` surfaced, that column ALREADY exists (8.1 persisted it, 8.4 applies it) — no schema change. Do NOT edit any frozen migration/RPC; do NOT add a table/column/policy (H4 inventory + migration-reset EXACT enumeration stay UNCHANGED, like 6.4/7.4/8.4). [Source: retro-notes/epic-8.md (R-822 additive discipline); test-design-epic-8.md#Stories 8.2-8.5 (add NO new tenant table by default)]

### Retro-notes constraints surfaced by earlier Epic 8 stories (apply directly)

- **[epic-8 / 8.4] The `file-lock-panel.e2e.spec.ts` is 8.5's to un-skip.** The 8.4 code-review deferral names Story 8.5 as the owner: "un-skip and add the `data-testid`s the spec expects when the locked-file panel state renders." Task 2.5 closes this. [Source: deferred-work.md (8-4 code review, file-lock-panel.e2e.spec.ts); retro-notes/epic-8.md]
- **[epic-8 / R-814] The single Phase A file model held under real pressure** (6.3 PDF + 7.x evidence both consume 8.1). 8.5 must NOT introduce a competing model — the index is a read, the archive is the 8.4 command. Kept as the standing reviewer checkpoint for 8.5. [Source: retro-notes/epic-8.md (test-design R-814)]
- **[epic-8 / 8.1] The storage-reachability probe (`SUPABASE_TEST_REQUIRED=1`) FORCES the storage-negative class to execute** — the R-2 false-green gap. 8.5's RLS/index-isolation suite must run under it, not skip-green locally. [Source: retro-notes/epic-8.md (Task-8.6 storage-reachability probe); test-design-epic-8.md#Execution Strategy]
- **[epic-8 / 8.1] Local `db reset` can leave kong 502 on `/auth/v1/*` only** (stale upstream; auth container healthy) — `docker restart supabase_kong_ElproSaas` clears it; can false-fail local reachability probes. [Source: retro-notes/epic-8.md (Phase 7 code review)]
- **[epic-8 / 8.1] Coverage-inversion check** — after any change that rewires a privileged write path, re-verify the negative-test targets still hit the LIVE surface. 8.5 wires the archive UI through the existing `archiveFile` command; confirm the 8.4 negatives still cover the live archive surface (Task 4.2). [Source: retro-notes/epic-8.md (Phase 7 code review — RPC swap coverage inversion)]
- **[epic-3 flake lesson] E2E unique keys via `crypto.randomUUID()`, NEVER `Date.now()`** (two parallel workers in the same millisecond collide). The `file-lock-panel` fixture and any new index E2E must follow this. [Source: deferred-work.md (epic-3 iter-2 reactivate E2E); tests/e2e/files/file-lock-panel.e2e.spec.ts header]
- **[deferred-work 8-1 lesson] RLS negatives must assert a positive own-tenant set AND absence of the foreign id — NOT a vacuous `not.toContain` basename check** (the storage-object-isolation weak-assertion note). Task 3.1 follows this. [Source: deferred-work.md (8-1 iter-2 "weak/possibly-vacuous property")]

### Deferred-work items that LAND in this story (address or knowingly work around)

- **[8.4 code review, Low] `file-lock-panel.e2e.spec.ts` fully `test.skip` — panel replace/delete + locked-file panel state is unbuilt; wiring is 8.5.** ADDRESS in Task 2.2/2.5 (un-skip, add `file-lock-notice`/`evidence-lock-notice`/`archive-file` testids; assert `replace-file`/`delete-file` absent on a locked file). [Source: deferred-work.md — "Deferred from: code review of 8-4 …"]
- **[8.2 code review, implied] The `EntityFilePanel` has NO replace/delete affordance today.** ADDRESS in Task 2.2/2.4 — a locked file gets archive-only + a lock notice; an unlocked file MAY get a re-upload "replace" + archive. [Source: src/components/files/EntityFilePanel.tsx (no replace/delete control today); the 8.4 E2E asserting their absence]
- **[8.4 code review, Low] `archiveFile(hardDelete:true)` returns `FILE_LINK_LOCKED` even for an UNLOCKED file — a misleading code.** WORK AROUND, do NOT re-open: the 8.5 UI issues an ARCHIVE (not a hard-delete), so the `hardDelete` path is not on the panel's happy path; leave the code-nuance to its owner (a follow-up refinement). Just ensure the archive control sends an ARCHIVE intent, never `hardDelete:true`. [Source: deferred-work.md — 8-4 archiveFile hardDelete code]
- **[8.3 code review, Low] AC2 expiry→refresh E2E is `test.fixme` (skipped); the client re-open wiring is unproven E2E.** DO NOT re-open — it has its own test-DX owner. 8.5 reuses `previewEntityFileAction` in the index; do NOT regress the panel expiry→refresh behavior. [Source: deferred-work.md — 8-3 code review; retro-notes/epic-8.md (8.3 expiry→refresh E2E deferred)]
- **[8.3 code review, Low] `previewEntityFileAction` (the NEW action entry point) is never directly INT-tested (cookie-bound, not injectable) — proven by equivalence.** ACCEPTED Phase-A posture; the index reuses the SAME action, so it inherits the same equivalence-based coverage. Do NOT try to add an action-level negative here (out of scope). [Source: deferred-work.md — 8-3 code review]
- **[NOT this story] 8.2 R-817 byte-level MIME sniffing, 8.1 object-reclamation/GDPR-delete, 8.1 `file_links` uniqueness, storage-object EXACT-policy enumeration** — all storage-hardening items whose subject does NOT overlap the index/panel-wiring/audit scope of 8.5. Do NOT re-open or address. [Source: deferred-work.md — 8-1/8-2 code reviews]

### Files being modified/created (read these first)

- **REPLACE `src/app/(app)/files/page.tsx`** — currently a `PagePlaceholder` stub ("Den här modulen byggs i Epic 8"). Replace with a `force-dynamic` SERVER component that calls `readFileIndex()` → `FileIndexList`. Model on `src/app/(app)/jobs/page.tsx` (the thin server-list pattern). Do NOT add a nav item.
- **UPDATE `src/features/files/read.ts`** — add `readFileIndex()` as a SIBLING of `readEntityFiles` (same RLS-client discipline, same display-safe projection, same generic-error posture). What must be preserved: the R-810 no-raw-path projection; the RLS-client-only (no tenant id, no service-role) discipline; the archived/deleted drop filter.
- **NEW `src/components/files/FileIndexList.tsx`** (`"use client"`) — the index list island. Model the row/preview on `EntityFilePanel`'s `FilePreviewRow` (reuse the signing action; consider extracting a shared `FilePreviewRow`). Model the client filter/`useMemo` on `src/components/jobs/JobList.tsx`.
- **NEW `src/features/files/file-index.ts`** — pure owner-category map + search/filter predicate + forbidden-deferred-category guard (unit-tested).
- **UPDATE `src/components/files/EntityFilePanel.tsx`** — add the lock-notice + archive-only + (unlocked) replace affordances per file, gated by `isFileLinkLockable`/`isLockedFileArchivable`. The `data-testid`s the 8.4 E2E expects: `file-lock-notice`, `evidence-lock-notice`, `archive-file`, and the ABSENCE of `replace-file`/`delete-file` on a locked file. Preserve: the existing upload form, the four error states, the `FilePreviewRow`, the `testIdSuffix` namespacing.
- **UPDATE `src/features/files/actions.ts`** — add `archiveFileAction` (`"use server"`) wiring the archive control to the EXISTING `archiveFile` command via `runCommand`. Preserve: the `ownerRoute`/`revalidate_path` revalidation pattern; the RLS-server-client + typed-Result mapping; NO direct table write, NO service-role.
- **UN-SKIP `tests/e2e/files/file-lock-panel.e2e.spec.ts`** — remove the three `test.skip`; the spec's assertions define the panel contract. Read it first — it IS the acceptance contract for Task 2.
- **REUSE (do NOT modify) `src/server/commands/files/files.ts` (`archiveFile`), `src/features/files/lock-predicates.ts`, `src/server/commands/files/validation.ts` (`ACTIVE_OWNER_TYPES`), `src/features/files/signed-access-state.ts`** — read them; they are the reuse surface.

### Testing standards summary

- Two-runner discipline: pure logic → `tests/unit/**` (`node --test`, NEVER a `.tsx`, NEVER outside `tests/unit/**` — the runner-glob trap); DB-backed → `tests/integration/**` (Vitest, `SUPABASE_TEST_REQUIRED=1`); UI flows → `tests/e2e/**` (Playwright). [Source: project-context Testing Rules; scripts/run-tests.mjs]
- The PII/secret + ORGNR scan is ALREADY extended to file-metadata fixtures — keep it green (anonymized metadata-only fixtures; no real PII/raw file). [Source: test-design-epic-8.md (R-819 scan extended); retro-notes/epic-8.md (8.1 Task 9)]
- RLS negatives run under the storage-reachability probe; a missing/partial local stack HARD-FAILS (no false-green). Assert positive own-tenant set + absence of foreign ids (not a vacuous basename check). [Source: retro-notes/epic-8.md; deferred-work.md 8-1]
- The panel/index E2E is MESSAGE/STATE only (a UI-only lock is not evidence); enforcement is the 8.4 INT/RLS suites (do NOT re-prove DB rejection in E2E). Per-run-unique fixture keys via `crypto.randomUUID()`. [Source: architecture.md#9; tests/e2e/files/file-lock-panel.e2e.spec.ts]

### Project Structure Notes

- Aligns with the established file-domain layout: `src/features/files/` (reads + actions + pure logic), `src/components/files/` (client islands), `src/server/commands/files/` (commands — REUSED, not extended), `src/app/(app)/files/` (route). The index is a new page over the existing route; no new route/nav.
- No conflict with the seven-item nav (frozen) — "Filer"/`/files` already exists as a stub to replace.
- No new migration expected — `file_links.is_locked`/`locked_at` and `files.lifecycle_state` already exist (8.1) and are applied (8.4); the index/panel READ them. If a projection genuinely needs a new read column that doesn't exist, that is a scope surprise → surface it as an open question, do NOT silently add a migration.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.5 (lines 1719-1753) — ACs, Technical Notes (skippable), Test Requirements, Security/RLS Impact High, Stop Conditions]
- [Source: _bmad-output/planning-artifacts/architecture.md#14 (File And Storage Model — limited index sanctioned, not a document center; archive-over-delete) / #15 (Audit Logging Model — file event set, metadata prohibitions)]
- [Source: _bmad-output/planning-artifacts/owner-decisions-applied-2026-06-18.md#Epic 8·8.5 — "Phase A Story 8.5 is a limited file index, not a broad document center" (the BUILD decision basis)]
- [Source: _bmad-output/test-artifacts/test-design-epic-8.md — R-801 (isolation), R-810 (no raw path), R-816 (index scope creep, OPEN, Dev 8.5 + Rasmus), R-814 (single model STOP); P1 rows "(8.5) Limited-index tenant-scoped listing + RLS negative" and "(8.5) File audit events with safe metadata"; index-absence guardrail (P2)]
- [Source: _bmad-output/auto-bmad/retro-notes/epic-8.md — R-814 single model, R-822 lock family additive discipline, storage-reachability probe, kong-502 flake, coverage-inversion check]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — 8-4 (file-lock-panel.e2e.spec.ts un-skip → owner Story 8.5; archiveFile hardDelete code), 8-3 (expiry→refresh test.fixme, previewEntityFileAction equivalence), 8-2 (EntityFilePanel replace/delete), 8-1 (weak RLS assertion lesson; object-reclamation NOT this story)]
- [Source: src/app/(app)/files/page.tsx (stub to replace); src/features/files/read.ts (readEntityFiles sibling); src/components/files/EntityFilePanel.tsx (panel to extend + FilePreviewRow to reuse); src/features/files/lock-predicates.ts (reuse); src/server/commands/files/files.ts (archiveFile reuse); src/features/files/actions.ts (action patterns); src/app/(app)/jobs/page.tsx + src/features/jobs/read.ts (thin-index server-list pattern); src/components/app-shell/nav-items.ts (frozen — do NOT touch)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M) — bmad-dev-story workflow.

### Debug Log References

- 8.5-RLS-04 red first run: the raw scaffold query mirrored only the SQL (`.is('archived_at', null)`),
  not the read's JS `lifecycle_state === 'archived'` drop — so an archived FILE (whose LINK has no
  `archived_at`) still returned. RESOLVED by making `readFileIndex` INJECTABLE (mirroring
  `readJobList`) and repointing RLS-01/04 at the REAL read (exercising the JS lifecycle-drop). The
  scaffold explicitly anticipated this ("if dev exposes an injectable read, swap the direct query").
- `file-index-non-scope.test.ts` red first run: my `FORBIDDEN_DEFERRED_CATEGORIES` deny-list literally
  contained `"fortnox"`, which the source-token guardrail scans `file-index.ts` for. RESOLVED by moving
  the deny-list to `src/features/files/deferred-categories.ts` (re-exported from `file-index.ts`) — the
  re-export line carries no forbidden token, so the guardrail passes and the pure unit test still imports
  from `@/features/files/file-index`.

### Completion Notes List

**BUILD DECISION (recorded per the story's instruction):** BUILT the limited Phase-A `Filer` index +
wired the panel lock/replace/archive affordances (did NOT skip). Basis: the 2026-06-18 owner decision
("keep limited for the pilot") + the three concrete 8.2/8.3/8.4 deferrals that named 8.5 as their
landing spot (the `file-lock-panel.e2e.spec.ts` un-skip, the panel replace/delete affordance, the
locked-file panel state). The R-816 STOP boundary is enforced by the source-token guardrail + the
rendered-page E2E guardrail (both green).

- **AC1 (limited index):** `readFileIndex` (RLS-scoped, `.in(ACTIVE_OWNER_TYPES)`, archived/deleted
  dropped, display-safe projection — NO `object_path`/`bucket_id`) → `/files` server page → the
  `FileIndexList` island (search + the seven-category filter; per-file preview via the SAME
  `previewEntityFileAction` signing funnel). Pure decision logic (owner-category map + filter +
  deny-list) lives in `file-index.ts`/`deferred-categories.ts`.
- **AC2 (audit §15-clean):** VERIFIED by construction + the new INT suite — the archive path writes
  EXACTLY ONE `file.archived` row with clean `{ targetId, reason? }` metadata (no path/bucket/PII),
  an idempotent re-archive writes none, and the §15 file-event set stays the closed four
  (`file.uploaded`/`file.linked`/`file.signed_access.created`/`file.archived`). No new audit model.
- **AC3 (own-tenant only + RLS negative):** the new RLS suite proves tenant A's index lists ONLY A's
  files across owner types (positive set + concrete absence of the B ids), a cross-tenant owner-id
  probe returns zero rows, the projection is display-safe, and an archived file drops out.
- **AC4 (panel lock notice + archive-only):** the SHARED `FilePreviewRow` renders `file-lock-notice`
  (`evidence-lock-notice` for evidence) + `archive-file` on a LOCKED file and NO `replace-file`/
  `delete-file`; an UNLOCKED file may show `replace-file` (a re-upload anchor) + `archive-file`. The
  sent-quote PDF surfaces via a new `CommitmentFilesPanel` (read-only, no upload form) on the quote
  detail's non-draft version; the accepted-acceptance evidence via the existing acceptance panel. The
  8.4 E2E is un-skipped + green.
- **AC5 (crafted deny):** the archive UI routes through the EXISTING `archiveFile` command (its
  `ownership` gate → `TENANT_ACCESS_DENIED` on a foreign id, no existence disclosure); the archive
  action NEVER sends `hardDelete:true`. Proven by the new INT cross-tenant test.

**Key decisions / deviations:**
- **Extracted the per-file row to a SHARED `FilePreviewRow` component** (from `EntityFilePanel`) so the
  index/entity-panel/commitment-panel share one preview + lock-notice + archive-only row (R-814 —
  no duplicated signing logic). This is the story's stated preference ("extract/share the preview row").
- **The sent-quote locked PDF renders via a new read-only `CommitmentFilesPanel`** (not `EntityFilePanel`)
  because `quote_version` is NOT an ACTIVE upload owner type and the panel `ownerType` prop is pinned to
  `ActiveOwnerType` by a compile-time test (`entity-file-panel-owner-type.test.ts`). The commitment panel
  has no upload form and reuses the SAME shared row + signing + archive command — no competing model.
- **`readFileIndex` is INJECTABLE** (optional client, mirroring `readJobList`) so the RLS suite exercises
  the real read path (incl. the JS lifecycle-drop) rather than a raw query that misses it.
- **`readEntityFiles` owner type widened `ActiveOwnerType` → `OwnerType`** (reads are RLS-scoped
  regardless) so the sent-quote panel can read `quote_version` files. The panel prop stays `ActiveOwnerType`.
- **The 8.3 expiry→refresh E2E `test.fixme` was NOT re-opened** (its own test-DX owner) — it stayed skipped.

**PR Impact Statement (Task 4.4):**
- **Security/RLS:** a new LIMITED own-tenant `Filer` index — READ-ONLY over `file_links`→`files`,
  RLS-scoped on the anon-key client (NO tenant id passed, NEVER service-role), display-safe projection
  (NO raw `object_path`/`bucket_id` — R-810). A cross-tenant row is never returned (RLS); an RLS
  negative + a cross-tenant owner-id probe prove it. The panel archive routes through the EXISTING
  `archiveFile` command (own-tenant `ownership` gate; a foreign id → `TENANT_ACCESS_DENIED`, no
  existence disclosure). File audit events confirmed §15-clean (allow-listed metadata only).
- **Money/Quote:** none — no money/tax/quote-total code touched; the quote detail change is presentational
  (a read-only locked-file panel on a non-draft version).
- **Schema:** NO new tenant table / column / policy / migration (H4 inventory + the migration-reset EXACT
  per-table policy enumeration UNCHANGED). The index is a READ; the panel reuses the 8.4 `archiveFile`
  write + the 8.1 `createSignedFileAccess` signing funnel.
- **STOP boundary (R-816):** the index must NOT become a broad document center — enforced by the
  source-token guardrail (`file-index-non-scope.test.ts`) + the rendered-page E2E guardrail
  (`file-index-scope.e2e.spec.ts`). Archive-over-delete retention posture unchanged (a hard-delete of
  locked evidence remains a legal-sign-off STOP, R-818 — NOT built here).

**No breaking change to any public/shipped interface.** `EntityFileRow` gained a required `isLocked`
field, but it is produced only by the read layer (`readEntityFiles`/the file feature) and consumed by
the panels — no external caller constructs it. `readEntityFiles`'s `ownerType` param was WIDENED
(`ActiveOwnerType` → `OwnerType`, strictly more permissive — no existing call breaks).

### ATDD Red-Phase Scaffolds (bmad-testarch-atdd, 2026-07-07)

Red-phase acceptance scaffolds generated before implementation (all inert until 8.5 lands; the
checklist is `_bmad-output/test-artifacts/atdd-checklist-8-5.md`):

- `tests/e2e/files/file-index-scope.e2e.spec.ts` (NEW, 3 `test.skip`) — AC1/R-816 index scope guardrail.
- `tests/integration/rls/file-index-isolation.rls.test.ts` (NEW, 4 `describe.skip`) — AC1/AC3 tenant isolation.
- `tests/integration/commands/file-audit-events.int.test.ts` (NEW, 4 `describe.skip`) — AC2/AC5 §15 audit.
- `tests/unit/features/files/file-index.test.ts` (NEW, 7 `describe.skip` + throwing stubs) — AC1 pure index logic.
- `tests/unit/guardrails/file-index-non-scope.test.ts` (NEW, 3 LIVE, green now) — AC1/R-816 source-tree STOP guardrail.
- `tests/e2e/files/file-lock-panel.e2e.spec.ts` (EXISTS) — the AC4 contract; dev un-skips in Task 2.5.

RED-PHASE GAP dev must close (Task 2.5): `file-lock-panel.e2e.spec.ts` reads
`fixture.sentQuote`/`fixture.acceptedAcceptance`, which `tests/e2e/global-setup.ts` does NOT currently
emit — add those keys (with file ids) or repoint the spec at existing fixture keys.

### File List

**NEW (source):**
- `src/features/files/file-index.ts` — pure owner-category map + `filterFileIndexRows` + the deny-list re-export.
- `src/features/files/deferred-categories.ts` — the FORBIDDEN deferred-module deny-list (kept out of the guardrail-scanned index sources).
- `src/features/files/archive-action-state.ts` — the archive `useActionState` state contract + error messages.
- `src/features/files/quote-files-panel.tsx` — `renderSentQuoteFilesPanel` server helper (non-draft version's locked PDF).
- `src/components/files/FileIndexList.tsx` — the `"use client"` limited-index island (search + category filter + per-file preview).
- `src/components/files/FilePreviewRow.tsx` — the SHARED per-file preview + lock-notice + archive-only row (extracted from `EntityFilePanel`).
- `src/components/files/CommitmentFilesPanel.tsx` — the read-only locked-commitment-files panel (sent-quote PDF/attachment).

**MODIFIED (source):**
- `src/app/(app)/files/page.tsx` — REPLACED the `PagePlaceholder` stub with the `force-dynamic` server component → `readFileIndex()` → `FileIndexList`.
- `src/features/files/read.ts` — added `readFileIndex` (injectable), the `FileIndexRow`/`FileIndexReadResult` types + re-export, `isLocked` on `EntityFileRow`, `readEntityFiles` projects `is_locked` + widened owner-type param to `OwnerType`.
- `src/features/files/actions.ts` — added `archiveFileAction` (`"use server"`) wiring the archive control to the existing `archiveFile` command.
- `src/components/files/EntityFilePanel.tsx` — imports the shared `FilePreviewRow` (local copy removed); passes `purpose`/`revalidatePath`/`uploadInputId` down.
- `src/app/(app)/quotes/[quoteId]/page.tsx` — renders `renderSentQuoteFilesPanel` (in parallel with the acceptance panel) and passes it to the view.
- `src/components/quotes/QuoteDetailView.tsx` — accepts + renders `sentQuoteFilesPanel` on a non-draft version's snapshot section.

**TESTS (un-skipped/repointed to green):**
- `tests/unit/features/files/file-index.test.ts` — repointed to the real `@/features/files/file-index`; un-skipped (7 pass).
- `tests/integration/rls/file-index-isolation.rls.test.ts` — un-skipped; RLS-01/04 call the injectable `readFileIndex` (4 pass).
- `tests/integration/commands/file-audit-events.int.test.ts` — un-skipped (3 pass).
- `tests/e2e/files/file-index-scope.e2e.spec.ts` — un-skipped (3 pass).
- `tests/e2e/files/file-lock-panel.e2e.spec.ts` — un-skipped (3 pass; AC4 contract).
- `tests/e2e/global-setup.ts` — added the `sentQuote` (locked quote_pdf) + `acceptedAcceptance` (locked acceptance_evidence via the real accept RPC) fixtures.

**TRACKING:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 8.5 → `review`.

### Change Log

- 2026-07-07 — Story 8.5 implemented (dev-story): limited `Filer` index (RLS-scoped read + search/category-filter island + pure decision logic), panel lock-notice + archive-only affordance (shared `FilePreviewRow`, sent-quote `CommitmentFilesPanel`, `archiveFileAction`), §15 audit + RLS-isolation + index-scope tests un-skipped and green. NO new migration/table/column/policy. Status → review.

### Review Findings

Triaged from the Tier-A thin review (Acceptance Auditor lens `primary` + a dedicated security review — 0 security findings). 2 findings survived (both Decisions); 4 Low findings dismissed as noise (cosmetic/label/wording nits and disclosed-safe deviations, all framed by the auditor as acceptable/spec-consistent).

- [x] [Review][Decision][Med] (won't-fix — auto-resolved per triage recommendation: dismiss) AC4 lock/replace/archive decision reads the DB `file.isLocked` instead of the pure `isFileLinkLockable`/`isLockedFileArchivable` predicates AC4/Task 2.2/Dev Notes name — `FilePreviewRow` gates the lock notice + replace/archive purely on `const isLocked = file.isLocked` (`src/components/files/FilePreviewRow.tsx:680,787,833`); neither pure predicate is imported anywhere, and `lock-predicates.ts` is now imported by nothing on the panel path. The dev record discloses this as deliberate: `EntityFileRow.isLocked` reads `file_links.is_locked` — the authoritative applied DB lock, which is arguably stronger than the client-safe predicate and is the option Task 2.1 offers as "PREFER". A literal departure from the AC/Task wording that named the predicates as the gate, so a human call on whether the AC text or the stronger DB-truth source governs. (source: Acceptance Auditor / primary) Recommended: dismiss: the DB `is_locked` is the story's own PREFERRED authoritative lock source (Task 2.1), stronger than the client-safe predicates and satisfying AC4 intent; keep as-is.
- [x] [Review][Decision][Med] (won't-fix — auto-resolved per triage recommendation: dismiss) `archive-file` affordance renders on EVERY listed entity-panel file, including unlocked non-lockable CRM/calculation/job files — the archive `<form>` in `FilePreviewRow` is outside any `isLocked` guard (`src/components/files/FilePreviewRow.tsx:801-818`), so an ordinary unlocked `crm_document` (never a lock-family member) now shows "Arkivera fil". AC4 frames archive as the LOCKED-file affordance, though its "MAY" clause permits an unlocked-file archive, so this is not a hard violation; the `archiveFile` command safely permits archiving any own-tenant file. Flagged because the story's mental model ("archive-only affordance for a LOCKED file") did not obviously intend a universal archive button on every uploaded file — needs an owner call on whether archiving arbitrary unlocked files is the desired UX. (source: Acceptance Auditor / primary) Recommended: dismiss: AC4's "MAY" permits an unlocked-file archive, the command gates own-tenant only, and a universal archive control on a file-management surface is reasonable, safe UX; keep as-is.
