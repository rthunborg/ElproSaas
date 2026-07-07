# Story 8.2: Validated Upload And Entity File Panels

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tenant admin,
I want to upload files in the context where they are needed, with server-side validation and clear per-error feedback,
so that each file has a clear owner, purpose, and validation state — and no user ever controls a raw storage path or bypasses the MIME/size/ownership gate.

## Acceptance Criteria

**AC1 — Entity file panel + no raw path (from epics.md 8.2 AC1; R-803)**
**Given** an entity file panel (rendered on a CRM/calculation/quote/acceptance/job entity)
**When** the admin uploads a file
**Then** the UI shows allowed file types, size expectations, the owning entity, and the purpose
**And** the user never enters or controls raw storage paths (the object path is 100% server-derived).

**AC2 — Server-side upload validation gate (from epics.md 8.2 AC2; R-808)**
**Given** an upload request
**When** the server receives it
**Then** MIME type, size, tenant ownership, owning entity, purpose, and lifecycle state are validated server-side BEFORE the file becomes usable
**And** a blocked type / oversized / foreign-owner / wrong-lifecycle request is rejected server-side even when the client is bypassed (not client-only validation).

**AC3 — Four distinct user-safe error states + no existence disclosure (from epics.md 8.2 AC3; R-809, R-811)**
**Given** invalid upload cases
**When** file type is blocked, size is too large, a network/server failure occurs, or permission fails
**Then** the UI shows four DISTINCT user-safe error states (blocked-type, too-large, network/server-fail, permission-fail)
**And** cross-tenant / permission failures do not reveal whether another tenant's file exists (identical generic shape for not-found vs forbidden).

**AC4 — Storage↔DB compensation, no orphan (epics.md 8.2 Technical Notes; R-807 storage side)**
**Given** an upload flow that spans object storage and database metadata
**When** the object write succeeds but the metadata/link write fails (or vice-versa) mid-flow
**Then** the flow leaves a CONSISTENT, retryable state (no `files`/`file_links` row pointing at a missing object; no committed-usable state over a failed write)
**And** a compensating cleanup/archive path handles the storage-success / DB-failure case (mirroring the 6.3 PDF pipeline's verified-compensated discipline).

**AC5 — File becomes attachable to its entity (the R-814 reuse contract in action)**
**Given** a validated, uploaded, own-tenant file
**When** the upload completes for an entity + purpose
**Then** the file is persisted with `lifecycle_state` advanced to `linked` and a `file_links` row bound to the owning entity (via the shared 8.1 file model — NO competing model)
**And** the panel lists the entity's existing linked files (own-tenant only), never a cross-tenant file.

## Tasks / Subtasks

- [x] **Task 1 — Owner-approved-conservative MIME/size upload policy (pure `.ts`)** (AC2, AC3; R-808, R-811, R-817)
  - [x] 1.1 Create `src/server/storage/upload-policy.ts` (PURE, no I/O — `node --test` in `tests/unit/**`): a conservative dev-default MIME allow-list (e.g. `application/pdf`, common image types `image/png`/`image/jpeg`, and the document types the pilot needs — keep it MINIMAL and conservative) + a max size constant that respects the config.toml outer bound (`file_size_limit = "50MiB"` on `tenant-files`; the policy max MUST be ≤ that). Export `isAllowedMimeType(mime)`, `isWithinSizeLimit(sizeBytes)`, and the raw constants.
  - [x] 1.2 Extract the FOUR distinct error-state decisions into a PURE `.ts` classifier (coverage-shape lesson — NOT inside a `.tsx`): map a rejection to one of `BLOCKED_TYPE` / `TOO_LARGE` / `NETWORK_OR_SERVER` / `PERMISSION` given the command result code + client-side pre-check outcome. Cross-tenant/permission failures MUST resolve to the generic `PERMISSION` state (never leak existence — R-809). Unit-test every branch.
  - [x] 1.3 Do NOT hardcode the allow-list into a component or duplicate it client-side as the authority: the server validator is the authority (AC2). The client MAY pre-check to give fast feedback, but the SERVER re-validates identically (client bypass must still be rejected).

- [x] **Task 2 — Upload validators (pure `.ts`, extend `files/validation.ts`)** (AC2; R-808)
  - [x] 2.1 Add `validateUploadFile(raw)` to `src/server/commands/files/validation.ts` returning `ValidationResult<UploadFileInput>`. Validate: `owner_type` ∈ the closed `OWNER_TYPES` union, `owner_id` UUID-shape, `purpose` ∈ the closed `FILE_PURPOSES` union, `display_name` non-empty bounded string, `mime_type` present + on the Task-1 allow-list, `size_bytes` a non-negative integer within the Task-1 size limit. A blocked MIME / oversized value fails as `VALIDATION_FAILED` (the raw value is NEVER echoed). Client `tenant_id`/`object_path`/`bucket_id` are NEVER read (stripped/ignored — server-derived only).
  - [x] 2.2 Reuse the existing `isOwnerType`/`isFilePurpose`/`isUuidLike`/`isActiveOwnerType` guards — do NOT reinvent them. An UNKNOWN owner type (deferred-module type) is the STOP-condition VALIDATION reject already modeled in 8.1.
  - [x] 2.3 The `owner_type`↔`purpose` coupling (e.g. `calculation`→`calculation_attachment`, `quote_acceptance`→`acceptance_evidence`, `job`→`job_evidence`, `customer`/`facility`/`contact`→`crm_document`) SHOULD be validated so a mismatched pair is rejected. Keep this pure + unit-tested.

- [x] **Task 3 — `uploadFile` command + shared upload helper (server, reuses the envelope + 8.1 storage)** (AC2, AC4, AC5; R-807, R-808, R-814, ADR-A009)
  - [x] 3.1 Add `uploadFile = defineCommand<UploadFileInput, UploadFileResult>` to `src/server/commands/files/files.ts`: `command: "file.upload"`, `auditable: true`, `eventType: "file.uploaded"`, `targetType: "file"`, `validateInput: validateUploadFile`. Envelope `ownership` verifies the OWNER record (the entity being attached to) is visible under the caller's RLS — reuse the `assertOwnerVisibleOrThrow` / `ownerRecordVisible` / `ownerTableFor` pattern from 8.1 (R-802 owner-side; a foreign owner id ⇒ zero rows ⇒ `TENANT_ACCESS_DENIED`). Only ACTIVE owner types resolve; a `quote_version` owner (materialized by the 6.1 RPC, not this command) is out of the upload path's active set.
  - [x] 3.2 In `execute`, follow the 6.3 PDF pipeline's PROVEN ordering VERBATIM (`src/server/commands/quotes/generate-pdf.ts:215-307` is the canonical reference — do NOT invent a new shape): (a) `const fileId = crypto.randomUUID()` up front; (b) `objectPath = deriveObjectPath({ tenantId: ctx.tenantContext.tenantId, fileId, displayName })` (tenant-first, sanitized — NEVER a client path); (c) `ctx.db.storage.from("tenant-files").upload(objectPath, bytes, { contentType: mime, upsert: true })` on the CALLER's request-bound RLS client (NEVER service-role); (d) INSERT the `files` metadata row with the EXPLICIT `id: fileId` + `object_path`, `mime_type`, `size_bytes`, `uploaded_by: ctx.tenantContext.userId`, `lifecycle_state: "linked"`; (e) INSERT the `file_links` row (`owner_type`, `owner_id`, `purpose`) — or find-or-create if a same (tenant,file,owner,purpose) tuple could recur; (f) return `{ targetId: fileId, fileId, linkId }`.
  - [x] 3.3 CONSTRAINT — the atomic `create_file_with_link` RPC self-allocates the file id (`returning id into v_file_id`; there is NO `p_file_id` parameter) and does NO MIME/size validation, so the object path cannot bind the file id through that RPC. This is EXACTLY why 6.3 bypassed it and did a direct explicit-id RLS-client insert. Reuse that same approach: direct explicit-id `files` insert + `file_links` insert on the RLS client, NOT `create_file_with_link`. Do NOT change the 8.1 RPC signature (a mechanism/signature change requires an ADR — STOP). Extract the shared "id-up-front → object write → verified-compensated metadata" logic into a small reusable helper (e.g. `src/server/storage/upload-object.ts` or a helper alongside `files.ts`) that BOTH this command and (later, optionally) the 6.3 PDF path could share — the epic-6 deferral explicitly asks 8.2 to reconcile a shared upload helper.
  - [x] 3.4 VERIFIED-COMPENSATED CONSISTENCY (AC4, R-807 storage side): wrap the write sequence so a mid-pipeline fault does NOT leave a `files`/`file_links` row over a missing object, nor a stored object silently usable with no metadata. On a metadata-write failure AFTER a successful object upload, best-effort compensate (archive/mark the orphan; the archive-over-delete discipline stands — 8.1 has NO object-reclamation path, so an orphaned OBJECT is left/archived, never hard-deleted). The INT test (Task 6) MUST inject a DB failure AFTER the storage write and assert the state is consistent + retryable.
  - [x] 3.5 Error mapping: reuse `throwMappedFileWriteError` (`23503`/`42501` → `TENANT_ACCESS_DENIED`, `23505`/`23514`/`22P02` → `VALIDATION_FAILED`, else a code-only `SERVER_ERROR`). A storage upload fault is a TRANSIENT `SERVER_ERROR` (retryable) — NEVER a permanent denial (mirror `signed-access.ts` transient-vs-permanent discipline). Audit metadata carries ONLY `{ targetId }`-shaped allow-listed fields — NO owner PII, NO bucket/object path, NO file contents, NO signed URL (§15).
  - [x] 3.6 Export `uploadFile` from `src/server/commands/files/index.ts`.

- [x] **Task 4 — Files read layer + server action (feature layer)** (AC1, AC3, AC5)
  - [x] 4.1 Create `src/features/files/read.ts`: `readEntityFiles({ ownerType, ownerId })` — reads the own-tenant `file_links` (joined to `files`) for the entity via the per-request RLS client (anon key — NEVER service-role), filtered to non-archived links, returning display-safe fields (display_name, mime_type, size_bytes, lifecycle_state, created_at, file_id, link_id). NEVER return raw `object_path`/`bucket_id` to the UI (R-810). A read error degrades to a generic error signal (mirror the CRM read-error posture), never a cross-tenant leak.
  - [x] 4.2 Create `src/features/files/actions.ts` (`"use server"`): an `uploadFileAction` wiring the React 19 `useActionState` form pattern to `runCommand(uploadFile, { client: createSupabaseServerClient(), input })` (the per-request cookie-bound RLS server client, anon key ONLY). Parse the `FormData` file (`File.arrayBuffer()` → bytes), read `mime_type`/`size_bytes` from the file itself server-side (do NOT trust a client-declared MIME as authority — re-derive/verify), and pass owner_type/owner_id/purpose/display_name. Map the typed `Result` to the four distinct error states via the Task-1.2 pure classifier: `VALIDATION_FAILED` → `BLOCKED_TYPE`/`TOO_LARGE` (disambiguate from the pre-check outcome), `TENANT_ACCESS_DENIED`/`FILE_ACCESS_DENIED` → generic `PERMISSION`, `SERVER_ERROR` → `NETWORK_OR_SERVER` (retryable). `revalidatePath` the entity route on success. NO new auth/error/audit mechanism, NO direct table write.
  - [x] 4.3 Mirror the existing feature `actions.ts`/`form-parsing.ts` split (see `src/features/quotes/actions.ts`, `src/features/crm/form-parsing.ts`) — parsing helpers pure where practical.

- [x] **Task 5 — Entity file panel component + wire into entity pages** (AC1, AC3)
  - [x] 5.1 Create `src/components/files/EntityFilePanel.tsx` (client island): renders the allowed types + size expectation (from the Task-1 policy, surfaced to the client as display strings), the owning entity + purpose, the existing-files list (from `readEntityFiles`), a file `<input>` upload control, and the FOUR distinct error states as `role="alert"` regions with `data-testid`s. NO raw path field, NO client-entered bucket/path. Follow the epic-6 timeline a11y pattern (text status, not color-only; keyboard-reachable controls; accessible names).
  - [x] 5.2 Wire the panel into at least the entity pages whose owner types are ACTIVE and whose upload the pilot needs — minimum: `customer`, `facility`, `contact` (CRM `crm_document`), `calculation` (`calculation_attachment`), `quote_acceptance` (`acceptance_evidence`), and `job` (`job_evidence`). Render via the SERVER entity page passing `readEntityFiles(...)` results as props (mirror the `CustomerDetailPage` server-fetch → client-component prop pattern). Do NOT add/remove/reorder `nav-items.ts` (it already has the 7 items incl. "Filer" → `/files`). Do NOT build out the `/files` index LISTING — `src/app/(app)/files/page.tsx` is a `PagePlaceholder` stub today and the limited file-index behavior stays Story 8.5 (optional). Leave the placeholder as-is; the entity PANELS (not a central index) are this story's UI surface.
  - [x] 5.3 The panel's list surfaces `readEntityFiles` results only — own-tenant, never a cross-tenant file (RLS enforces; the UI adds no cross-tenant read).

- [x] **Task 6 — Integration tests (INT, DB-backed, `SUPABASE_TEST_REQUIRED=1`)** (AC2, AC4, AC5; R-807/R-808/R-809)
  - [x] 6.1 `tests/integration/commands/file-upload.int.test.ts`: valid upload succeeds (own-tenant, file+link persisted, `lifecycle_state = 'linked'`, object present); blocked MIME rejected `VALIDATION_FAILED` server-side even with a client-bypassed request; oversized rejected `VALIDATION_FAILED`; foreign-owner id (Tenant-B owner) rejected `TENANT_ACCESS_DENIED` (R-802 owner-side, both-side); parametrize across the ACTIVE owner types (customer/facility/contact/calculation/quote_acceptance/job) mirroring `file-link-ownership.int.test.ts`'s `describe.each`.
  - [x] 6.2 Compensation case (R-807 storage side): inject a DB failure AFTER a successful object upload and assert NO usable `files`/`file_links` row survives over a stored object (or the orphan is archived/compensated), and the state is retryable — reuse the 6.3 retry/compensation test shape (`generate-quote-pdf-retry-consistency.int.test.ts`).
  - [x] 6.3 No-existence-disclosure (R-809): a cross-tenant owner id and a genuinely non-existent owner id return the SAME generic `TENANT_ACCESS_DENIED` shape (no signal distinguishing them).
  - [x] 6.4 EXTEND the fixture/factory support: add valid / blocked-MIME / oversized dev fixture BYTES generated at TEST TIME (never committed as customer data). Reuse/extend `tests/factories/tenants.ts` (it already has `adminUploadStorageObject`/`adminInsertFile`). Keep the golden PII/secret+ORGNR scan green over any new file fixtures (R-819 — anonymized metadata only, no raw customer file).

- [x] **Task 7 — Pure unit tests + E2E** (AC1, AC2, AC3; R-811)
  - [x] 7.1 `tests/unit/**` node-test units for the Task-1 upload-policy (`isAllowedMimeType`/`isWithinSizeLimit` boundaries incl. exactly-at-limit / one-over), the Task-1.2 four-state error classifier (every branch, incl. cross-tenant→generic PERMISSION), and the Task-2 `validateUploadFile` (blocked-MIME/oversized/foreign-shape/owner-purpose-mismatch reject; valid accept). Goldens/units live under `tests/unit/**` (runner-glob trap — never a `.tsx`).
  - [x] 7.2 E2E (`tests/e2e/files/` new dir, Playwright): the entity-panel upload UX shows allowed types/size/owner/purpose and NO raw-path field (R-803/R-811); the four distinct error states each render as a distinct `role="alert"` with its `data-testid` (blocked-type, too-large, network/server-fail, permission-fail). Use `crypto.randomUUID()` for unique fixture names (NOT `Date.now()` — the epic-3 flake lesson).

- [x] **Task 8 — Docs + non-regression guards**
  - [x] 8.1 `.env.example` / config.toml: if a `allowed_mime_types` is set on the `tenant-files` bucket, keep it consistent with the Task-1 server allow-list; document that the server policy is the authority and config.toml is the outer bound. Note the demo-data-only posture (final policy is an owner Sign-Off residual, R-817).
  - [x] 8.2 Do NOT weaken any existing 8.1 assertion (migration-reset EXACT policy enumeration, storage-object isolation, `createSignedFileAccess` matrix). The service-role containment guards MUST stay green — the upload path is anon+RLS client only.
  - [x] 8.3 Do NOT wire the calc `readiness.ts` `REQUIRED_FILES_DEFERRED` warning to real file reads in THIS story unless it is a trivial read-only surface of the new `file_links` — the readiness classifier change is a separate concern; if touched, keep it purely additive and unit-pinned. (See Deferred-work overlap below.)

## Dev Notes

### Context & why this story

This is **Wave 2, Story 8.2** — the FIRST story that adds the generic **user-facing upload path** (choose a file → server-validate MIME/size/owner/purpose/lifecycle → write the private object → persist metadata+link with verified-compensated consistency) and the **entity file panels**. Story 8.1 shipped the file MODEL (schema, RLS, signed-access funnel, atomic link RPC) as **metadata-only** — there is NO upload gate and NO object-byte upload path except 6.3's PDF pipeline. 8.2 generalizes 6.3's proven object-write discipline into the reusable upload path. [Source: test-design-epic-8.md §Wave-2 reality; epics.md 8.2]

**The single Phase A file model (R-814) is a STANDING CONTRACT + STOP condition.** 8.1's `files`/`file_links` (private `tenant-files` bucket, server-derived paths) is the ONLY model; 6.3 and 7.x already consume it. **A second/competing file or storage model appearing in this story is a design defect and a STOP.** REUSE + EXTEND only. [Source: test-design-epic-8.md; epics.md 8.1 Technical Notes]

### Architecture patterns & constraints (MUST follow)

- **Reuse the EXISTING command envelope** (`src/server/commands/envelope.ts`, `defineCommand`/`runCommand`): resolve user → resolve active `tenant_admin` → validate typed input → `verifyOwnership` (owner record) → execute on the RLS client → append-only audit → typed `Result<T, CommandErrorCode>`. NO bespoke auth/error/audit mechanism. [Source: architecture.md#5; src/server/commands/files/files.ts]
- **Anon+RLS client ONLY — NO service-role key on any path.** The upload uploads the object via `ctx.db.storage.from("tenant-files").upload(...)` on the caller's request-bound RLS client; `storage.objects` RLS re-checks the tenant path prefix. The service-role containment guards (source + built-bundle) must stay green. [Source: architecture.md#5, ADR-A002; scripts/verify/check-service-role-containment.mjs]
- **Object path is 100% server-derived** via `deriveObjectPath({ tenantId, fileId, displayName })` — tenant-first (`{tenantId}/{fileId}/{sanitizedName}`), traversal-sanitized, NFC-normalized. `tenantId` = `ctx.tenantContext.tenantId` (never client input). A client-supplied path/bucket/tenant_id is NEVER read (R-803/R-810). [Source: src/server/storage/object-path.ts]
- **Metadata-first / storage-second for ACCESS; for UPLOAD the ordering is object-write-then-metadata** with verified-compensation (the 6.3 pattern): id up front binds the object path; a metadata failure after the object write compensates rather than leaving a usable orphan. [Source: src/server/commands/quotes/generate-pdf.ts:215-319; test-design-epic-8.md §"Storage↔DB consistency"]
- **The `create_file_with_link` RPC self-allocates the file id and does NO content validation** — it CANNOT bind the object-path-id up front, which is why 6.3 used a direct explicit-id RLS-client insert. 8.2 reuses THAT approach (direct explicit-id `files` insert + `file_links` insert on the RLS client). Do NOT change the RPC signature (ADR gate). [Source: supabase/migrations/20260704120000_file_storage_foundation.sql:383-442; deferred-work.md §6-3 "real object-BYTE upload path is Story 8.2"]
- **`throwMappedFileWriteError` is the write-error mapper** — reuse it; never throw a raw Postgres/storage message across the boundary (it can embed object_path/tenant_id). [Source: src/server/commands/files/file-db.ts:174-195]
- **Lifecycle: advance `draft`→`linked` on upload+link** (8.1's `link_existing_file` deliberately does NOT — 8.1 review flagged this and named 8.2 as the owner of the transition). The upload command inserts the `files` row already `lifecycle_state = "linked"` (a file created WITH a link is linked by construction, matching the RPC default). [Source: deferred-work.md §8-1 iter-2 "link_existing_file never transitions draft→linked → Owner: Story 8.2"; supabase migration 20260704120000]
- **Pure-`.ts` coverage-shape lesson:** pull the upload-policy (MIME/size), the four-error-state classifier, and the upload validators into pure `.ts` modules under `src/server/**` / `src/lib` with `node --test` units in `tests/unit/**` — NEVER bury these decisions in a `.tsx` (they escape the fast gate otherwise). [Source: test-design-epic-8.md §"Coverage-shape lesson"; 8.1 Task 8.8]
- **Tenant-table pattern is already applied to `files`/`file_links`** — this story adds NO new tenant table (Wave 2 default). If (unlikely) one were needed, it reuses the verbatim pattern + `TENANT_TABLES` enrollment. [Source: test-design-epic-8.md]

### Epic-8 retro-note constraints (from `_bmad-output/auto-bmad/retro-notes/epic-8.md`)

- **R-814 single-file-model is a STOP condition** — 6.1/6.3/7.x all consume 8.1's bucket/paths/file_links with no competing model; 8.2 must too. A competing model = STOP. [retro epic-8 / 8-1]
- **Storage suites need the reachability probe:** `SUPABASE_TEST_REQUIRED=1` FORCES the storage-negative class to execute (closes the R-2 false-green gap) — run the new upload INT suite with it set; it will NOT false-green-skip. The storage suites run against the LOCAL Supabase CLI stack only. [retro 8-1 Phase 5]
- **Local-stack gotcha:** `supabase db reset` can intermittently leave kong 502 on `/auth/v1/*` only (auth container healthy) — `docker restart supabase_kong_ElproSaas` clears it; can false-fail local reachability probes. A wedged AF_UNIX socket (Docker/WSL2) can stall DB-backed verification — a Docker Desktop update + stale-file cleanup fixes it (purely environmental, not an implementation problem). [retro 8-1 Phase 5 / Phase 7]
- **Coverage-inversion check:** when a fix rewires production off one RPC onto another, the old RPC's negatives silently stop covering the live surface — verify the negative-test TARGETS point at the RPC/path production actually calls after any entry-point swap. (Relevant because 8.2 introduces a new upload write path.) [retro 8-1 Phase 7]
- **8.4 lock is the next-story sibling of QV409/AR704 (R-822)** — NOT this story, but do NOT pre-empt or fork a lock mechanism here; 8.2 persists no new lock. [retro epic-8 test-design]

### Deferred-work items that overlap this story (from `_bmad-output/implementation-artifacts/deferred-work.md`)

These earlier-story deferrals explicitly name **Story 8.2** as owner OR overlap this story's files/ACs. Address or knowingly work around each:

- **[8.1 iter-2 → 8.2] `link_existing_file` never advances `draft`→`linked`.** 8.2's real upload+link path OWNS the `draft`→`linked` transition. **ADDRESS:** insert the `files` row `lifecycle_state = "linked"` on upload (Task 3.2). Also decide whether the link command should refuse archived/deleted files — for the UPLOAD path the file is freshly created `linked`, so N/A here; do not weaken the existing `createFileLink` path. [deferred-work.md §8-1 iter-2]
- **[6.3 → 8.2] Reconcile a shared upload helper.** 6.3 broke ground on the object-byte upload (`generate-pdf.ts`): id-up-front + object write + verified-compensated metadata via a DIRECT explicit-id RLS insert (because `create_file_with_link` self-allocates the id). **ADDRESS:** extract that logic into a shared upload helper 8.2 uses (Task 3.3); optionally have 6.3 reuse it later (do not refactor 6.3 destructively in this story — a shared helper both CAN call is enough). [deferred-work.md §6-3 "recorded for 8.2 reconcile"]
- **[7.3 → 8.2] `createFileLink(owner_type:'job')` write path has no live INT/E2E proof (R-802 both-side).** The `job` owner branch is activated but only the read side is covered; no INT proves an own-tenant job-owned link resolves (or a foreign job owner ⇒ `TENANT_ACCESS_DENIED`). **ADDRESS:** the Task-6.1 parametrized upload INT (which materializes a `job_evidence` link for an own-tenant job, and asserts a foreign job owner is denied) closes this for the upload path. [deferred-work.md §7-3]
- **[7.3 → 8.2 area] Job-detail evidence-file label degradation (7.1↔7.3 owner_type mismatch).** `readJobDetail` resolves the evidence file name only from `owner_type='job'` links, so an acceptance-evidence file (`owner_type='quote_acceptance'`) shows "Bifogad fil". This is a JOB-DETAIL read concern, NOT the upload path — do NOT fix it here unless trivially adjacent; note it so the panel's own list (`readEntityFiles`) resolves the display name from the file itself, not from a hard-coded owner_type filter. [deferred-work.md §epic-7 iter-2]
- **[5.4 → 8.x] Required-file readiness is a `REQUIRED_FILES_DEFERRED` placeholder pending the file panels.** `src/features/calculations/readiness.ts` still surfaces the deferred warning. Wiring the REAL required-file check needs the calc↔file link reads this story lands. **WORK AROUND (do NOT block on it):** this story delivers the calc file panel + `readEntityFiles`; wiring `readiness.ts` to a real file-presence check is a separate, still-owner-gated concern (required-file RULES are an owner Sign-Off residual). Do NOT change `readiness.ts` behavior here beyond, at most, a purely-additive read; leave the documented warning unless a trivial read-only surface is in scope. [deferred-work.md §5-4]
- **[8.1 → later] No object-reclamation / DELETE path — orphans are archived, never hard-deleted.** 8.2's compensation MUST honor archive-over-delete: a storage-success/DB-failure orphan is left/archived, never hard-deleted (8.1 has no object-reclamation path; a retention story owns cleanup). [deferred-work.md §8-1]
- **[R-817 residual] Conservative dev MIME/size defaults are fine under demo-data-only; final policy is an owner Sign-Off residual.** Use conservative defaults (Task 1). STOP only if a FINAL file type/size policy or required-file rules materially affect real pilot data — under demo-data-only (owner decision 2026-07-03) this is not a real-pilot blocker. [test-design-epic-8.md R-817; epics.md 8.2 Stop Conditions; MEMORY: MVP demo-data-only]

### Persistent facts (reuse points — do not reinvent)

- `deriveObjectPath` / `sanitizeNameSegment` — `src/server/storage/object-path.ts` (tenant-first, traversal-safe, NFC).
- `createSignedFileUrl` / `resolveSignedUrlTtlSeconds` — `src/server/storage/signed-access.ts` (transient-vs-permanent discipline).
- `isAccessEligibleLifecycle` / `FILE_LIFECYCLE_STATES` — `src/server/storage/lifecycle.ts`.
- `OWNER_TYPES` / `ACTIVE_OWNER_TYPES` / `FILE_PURPOSES` / `isOwnerType` / `isActiveOwnerType` / `isFilePurpose` / `isUuidLike` — `src/server/commands/files/validation.ts`.
- `ownerTableFor` / `ownerRecordVisible` / `loadFileForAccess` / `throwMappedFileWriteError` / `asFileRpcClient` — `src/server/commands/files/file-db.ts`.
- `createSignedFileAccess` / `createFileLink` + `assertOwnerVisibleOrThrow` — `src/server/commands/files/files.ts` (the envelope + R-802 both-side pattern to mirror).
- **The canonical object-byte upload reference:** `src/server/commands/quotes/generate-pdf.ts:205-322` (id-up-front → `deriveObjectPath` → `.storage.upload(upsert:true)` → explicit-id `files` insert → `file_links` find-or-create/repoint → verified-compensated `tryCompensateFailed`). COPY this ordering.
- Server-action pattern: `src/features/quotes/actions.ts` (`"use server"`, `runCommand` on `createSupabaseServerClient()`, `useActionState`, `revalidatePath`).
- Entity page pattern: `src/app/(app)/customers/[customerId]/page.tsx` (server-fetch via `read.ts` → generic no-leak not-found → client component props).
- Command codes: `VALIDATION_FAILED`, `TENANT_ACCESS_DENIED`, `FILE_ACCESS_DENIED`, `SERVER_ERROR` — `src/server/commands/command-errors.ts` (+ `COMMAND_MESSAGES`).
- Config: `tenant-files` bucket private, `file_size_limit = "50MiB"`, `allowed_mime_types` deferred to 8.2 — `supabase/config.toml:127-144`.
- Factories: `tests/factories/tenants.ts` (`adminUploadStorageObject`, `adminInsertFile`), `admin-sql.ts`, `audit-events.ts`.

### Project structure notes

- New: `src/server/storage/upload-policy.ts`, `src/server/storage/upload-object.ts` (shared helper), `src/features/files/read.ts`, `src/features/files/actions.ts`, `src/components/files/EntityFilePanel.tsx`. Extend: `src/server/commands/files/{validation.ts,files.ts,index.ts}`.
- Tests: `tests/integration/commands/file-upload.int.test.ts`, `tests/unit/**` (policy/classifier/validator), `tests/e2e/files/` (new dir).
- `src/features/files/` and `src/components/files/` are the architecture-sanctioned homes (architecture §3 folder tree includes `components/files/` and `features/files/`). The nav already has 7 items incl. "Filer" → `/files`; do NOT change `nav-items.ts`. `src/app/(app)/files/page.tsx` is a `PagePlaceholder` stub ("Den här modulen byggs i Epic 8") — leave it; the central file-index listing stays optional Story 8.5. This story's UI is the per-ENTITY panels, not the `/files` index.

### Testing standards summary

- Two-runner: pure `.ts` units via `node --test` under `tests/unit/**`; DB-backed INT via Vitest (`SUPABASE_TEST_REQUIRED=1` hard-fails a missing stack, forces the storage class to run). E2E via Playwright. Goldens under `tests/unit/**` (runner-glob trap). [Source: project-context Testing Rules; test-design-epic-8.md §Execution]
- **P0 for this story (from test-design-epic-8.md §P0):** upload MIME/size/owner/lifecycle server-side validation with the client bypassed (R-808); cross-tenant failure = generic no-existence-disclosure error (R-809, upload path). **P1:** entity-panel upload UX (allowed types/size/owner/purpose, no raw path — R-803/R-811); four distinct user-safe error states (R-811, error-state logic in pure `.ts`); storage-success/DB-failure compensation, no orphan (R-807).
- Fixture BYTES (valid / blocked-MIME / oversized) generated at TEST TIME — never committed as customer data; keep the PII/secret+ORGNR scan green (R-819).
- Use `crypto.randomUUID()` (not `Date.now()`) for unique test fixture names.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.2] (AC, Technical Notes, Stop Conditions)
- [Source: _bmad-output/test-artifacts/test-design-epic-8.md] (R-807/R-808/R-809/R-810/R-811/R-817/R-819; P0/P1 tables; coverage-shape + storage-consistency lessons)
- [Source: _bmad-output/planning-artifacts/architecture.md#5,#6,#14,#15, ADR-A009] (command flow, storage rules, file/storage model, audit, narrow RPC)
- [Source: src/server/commands/quotes/generate-pdf.ts:205-322] (canonical object-byte upload + compensation reference)
- [Source: src/server/commands/files/{files.ts,file-db.ts,validation.ts,index.ts}; src/server/storage/{object-path.ts,signed-access.ts,lifecycle.ts}] (8.1 reuse surface)
- [Source: supabase/migrations/20260704120000_file_storage_foundation.sql] (schema, CHECKs, `create_file_with_link` id-self-allocation, `link_existing_file`)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] (§8-1, §6-3, §7-3, §5-4, §epic-7 overlaps)
- [Source: _bmad-output/auto-bmad/retro-notes/epic-8.md] (R-814 STOP, reachability probe, local-stack gotchas, coverage-inversion)

## Open Questions (non-blocking — sensible defaults chosen)

1. **Final MIME allow-list + max size** are an owner Sign-Off residual (R-817). Default: conservative dev allow-list (`application/pdf` + common image/document types), max ≤ 50MiB config bound. Under demo-data-only this is not a real-pilot blocker. STOP only if a FINAL policy or required-file rules materially affect real pilot data.
2. **Which entity pages get the panel first.** Default: all ACTIVE owner types the pilot needs (customer/facility/contact/calculation/quote_acceptance/job). `quote_version` attachments are materialized by the 6.1 RPC, not this upload command.
3. **Whether to wire `readiness.ts` required-file check now.** Default: NO behavior change to `readiness.ts` in this story (required-file RULES are owner-gated); this story lands the panels + `readEntityFiles` the future wiring needs. [deferred-work.md §5-4]

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — auto-bmad dev-story delegate.

### Debug Log References

- Local Supabase stack + Docker were down at start; started Docker Desktop + `supabase start` + `supabase db reset` (all migrations applied) to run the DB/browser-backed suites. Kong 502-on-auth intermittency (epic-8 retro note) cleared with `docker restart supabase_kong_ElproSaas`.
- `SUPABASE_TEST_REQUIRED=1 vitest run tests/integration/commands/file-upload.int.test.ts` → 16/16 pass (incl. the R-807 compensation case, R-808 blocked-MIME/oversized server-side rejects, R-809 no-existence-disclosure, and the `describe.each` across all six active owner types).
- Full INT suite (57 files, 658 tests) green — no regressions to the 8.1 file model, 6.3 PDF pipeline, CRM, quotes, jobs, or acceptance.
- `test:unit` 1152/1152 pass; Playwright: entity-file-panel (3) + CRM/calc/jobs (45) + quotes (29) all green. `tsc --noEmit`, `lint`, `build`, service-role + bundle containment all clean.

### Completion Notes List

- **Task 1** — `src/server/storage/upload-policy.ts` (conservative dev MIME allow-list: pdf/png/jpeg/webp/gif/txt/csv/doc(x)/xls(x); `MAX_UPLOAD_SIZE_BYTES = 25 MiB` ≤ the 50 MiB config bucket bound) + `src/server/storage/upload-error-classifier.ts` (`classifyUploadError` — maps `VALIDATION_FAILED`+precheck→BLOCKED_TYPE/TOO_LARGE, `TENANT_ACCESS_DENIED`/`FILE_ACCESS_DENIED`→generic PERMISSION per R-809, `SERVER_ERROR`→NETWORK_OR_SERVER, unknown→safe generic). Both pure; scaffolded units green (13).
- **Task 2** — `validateUploadFile` added to `files/validation.ts` (reuses `isOwnerType`/`isActiveOwnerType`/`isFilePurpose`/`isUuidLike`; owner_type↔purpose coupling via `OWNER_TYPE_PURPOSE`; strips client tenant_id/object_path/bucket_id; a spoofed size vs bytes-length disagreement is rejected). `bytes` is OPTIONAL on the validated shape so the pure metadata-validation scaffold (no bytes) and the real command path (with bytes) share one validator; `execute` guards bytes presence. Scaffolded units green (9).
- **Task 3** — shared `src/server/storage/upload-object.ts` (`uploadObjectWithMetadata` — the extracted 6.3 "id-up-front → object write → verified-compensated metadata" seam BOTH the command and a future 6.3 reuse can call) + `uploadFile` command in `files.ts` (direct explicit-id RLS `files` insert + `file_links` insert via `asFileWriteClient`; NOT `create_file_with_link` — it self-allocates the id and can't bind the path; the 8.1 RPC signature is unchanged, no ADR needed). Compensation ARCHIVES a written `files` row on a later metadata fault (archive-over-delete — no reclamation) and surfaces a retryable `SERVER_ERROR`. `lifecycle_state='linked'` on insert (8.2 owns the draft→linked transition). Exported from `files/index.ts`.
- **Task 4** — `src/features/files/read.ts` (`readEntityFiles` — own-tenant `file_links`⋈`files`, non-archived, display-safe fields ONLY, never `object_path`/`bucket_id` — R-810; display name resolved from the file itself, avoiding the epic-7 owner_type-filter label degradation) + `actions.ts` (`uploadFileAction` — parses the FormData file to bytes, RE-DERIVES mime/size from the file server-side, maps the Result via the pure classifier, `revalidatePath`s the entity route) + `form-parsing.ts` + `upload-action-state.ts`.
- **Task 5** — `src/components/files/EntityFilePanel.tsx` (client island: allowed-types + size + owner + purpose display, file `<input>`, four distinct `role="alert"` error regions, own-tenant existing-files list, NO raw-path field; a11y text-not-color; `testIdSuffix` namespaces secondary panels so a multi-panel page keeps ONE canonical `entity-file-panel`). Wired into customer / calculation / job detail pages, plus per-facility + per-contact panels inside the customer hub, plus an acceptance-evidence panel on the accepted quote-version section (via `renderAcceptanceFilesPanel` server helper). `readQuoteDetail` extended with `acceptanceIdByVersionId` (additive) to feed the acceptance panel. `nav-items.ts` untouched; `/files` placeholder left as-is (index is Story 8.5).
- **Task 6/7** — the pre-existing ATDD scaffolds (`file-upload.int.test.ts`, `upload-policy.test.ts`, `upload-error-classifier.test.ts`, `validate-upload-file.test.ts`, `entity-file-panel.e2e.spec.ts`) drove the impl and all went GREEN with no assertion changes (only two mechanical fixes: a scaffold cast through `unknown`, and the submit-enable so the E2E can click submit after the client pre-check verdict renders).
- **Task 8** — `config.toml` comment updated (server upload-policy is the MIME/size AUTHORITY; the 50 MiB bucket cap is the outer bound; no bucket `allowed_mime_types` to avoid a second divergable authority). No `.env` change (policy is conservative constants). `readiness.ts` NOT touched (deferred-work §5-4 — required-file RULES stay owner-gated; this story only lands the panels + `readEntityFiles` the future wiring needs). 8.1 assertions + service-role/bundle containment stay green.

### File List

**New (source):**
- `src/server/storage/upload-policy.ts`
- `src/server/storage/upload-error-classifier.ts`
- `src/server/storage/upload-object.ts`
- `src/features/files/read.ts`
- `src/features/files/actions.ts`
- `src/features/files/form-parsing.ts`
- `src/features/files/upload-action-state.ts`
- `src/features/files/acceptance-panel.tsx`
- `src/components/files/EntityFilePanel.tsx`

**Modified (source):**
- `src/server/commands/files/validation.ts` (add `validateUploadFile` + `UploadFileInput` + `OWNER_TYPE_PURPOSE`)
- `src/server/commands/files/files.ts` (add `uploadFile` command + `archiveOrphanFile`)
- `src/server/commands/files/file-db.ts` (add `FileWriteClient` + `asFileWriteClient`)
- `src/server/commands/files/index.ts` (export `uploadFile` + new types/const)
- `src/features/quotes/read.ts` (additive `acceptanceIdByVersionId`)
- `src/components/crm/CustomerDetail.tsx` (customer/facility/contact file panels)
- `src/components/calculations/CalculationEditor.tsx` (`filesPanel` prop)
- `src/components/jobs/JobDetailView.tsx` (`filesPanel` prop)
- `src/components/quotes/QuoteDetailView.tsx` (`acceptanceFilesPanel` prop)
- `src/app/(app)/customers/[customerId]/page.tsx`
- `src/app/(app)/calculations/[calculationId]/page.tsx`
- `src/app/(app)/jobs/[jobId]/page.tsx`
- `src/app/(app)/quotes/[quoteId]/page.tsx`
- `src/app/(app)/quotes/[quoteId]/versions/[versionId]/page.tsx`
- `supabase/config.toml` (upload-policy-authority comment)

**Modified (tests — mechanical scaffold fixes only):**
- `tests/unit/server/commands/files/validate-upload-file.test.ts` (cast through `unknown`)

**Test scaffolds exercised (unchanged assertions):**
- `tests/integration/commands/file-upload.int.test.ts`
- `tests/unit/server/storage/upload-policy.test.ts`
- `tests/unit/server/storage/upload-error-classifier.test.ts`
- `tests/e2e/files/entity-file-panel.e2e.spec.ts`

**New (coverage-expansion units — testarch-automate, 2026-07-07):**
- `tests/unit/features/files/upload-form-parsing.test.ts` (8.2-UNIT-04 — `parseUploadForm` trim/null + R-803 path/bucket/tenant strip; `precheckUpload` blocked-type/too-large/none + blocked-type precedence)
- `tests/unit/features/files/upload-action-state.test.ts` (8.2-UNIT-05 — four DISTINCT non-empty `UPLOAD_ERROR_MESSAGES`; `isRetryableUploadError` only NETWORK_OR_SERVER; `UPLOAD_ACTION_INITIAL` pristine)
- `tests/unit/server/storage/upload-object.test.ts` (8.2-UNIT-06 — `uploadObjectWithMetadata` branch table: happy path/tenant-first path, storage-fault-before-metadata, link-fault→archive→rethrow-original, archive-secondary-fault swallowed, files-insert-fault no-archive)

### Review Findings

- [x] [Review][Decision][Med] Server "re-derives" upload MIME from the client-declared `File.type`, not from the file bytes — the comments overstate the guarantee [src/features/files/actions.ts:1046-1049] — RESOLVED (2026-07-07): corrected the misleading "re-derived from the file itself" wording in `actions.ts` / `form-parsing.ts` / `validation.ts` to state the truth (MIME is the client-declared `File.type` gated against the fail-closed `ALLOWED_MIME_TYPES` allow-list that excludes active-content types; size is measured from the parsed bytes; byte-level content sniffing is an owner-gated R-817 follow-up). Did NOT add magic-byte sniffing (security review cleared the exploit path). Logged the byte-sniffing hardening as an owner-gated R-817 follow-up in deferred-work.md. Comment/doc-only behavior change — no new runtime behavior to test. — `actions.ts` sets `mimeType = (fileEntry.type || "").trim().toLowerCase()`, and `form-parsing.ts`/`validation.ts` carry the same "RE-DERIVED FROM THE FILE ITSELF" wording, but `File.type` on a `FormData` part is the browser-set multipart `Content-Type`, not content-sniffed magic bytes; `validateUploadFile` checks only `isAllowedMimeType(mimeType)` against that client-influenced string, and `bytes` are cross-checked for LENGTH only, never content type. AC2/Task 4.2 assert genuine server re-derivation / bypass-resistance, so the literal wording is not met. The dedicated security review examined this exact surface and cleared it as NOT a reachable exploit (0 HIGH/MED/LOW): `ALLOWED_MIME_TYPES` is a closed allow-list that excludes every active-content/XSS-capable type (`text/html`, `image/svg+xml`, `application/octet-stream`, executables), files live in a private bucket, and the download/signed-access path is out of this diff — so the only real issue is documentation drift, and the story flags this as an accepted R-817 demo-data-only residual. Coverage gap: INT `8.2-INT-02` only tests an honestly-declared blocked MIME, never the inverse (allowed declared MIME + disallowed real bytes). Recommended: fix: correct the misleading "re-derived from the file itself" comments in actions.ts/form-parsing.ts/validation.ts to state the truth (MIME is the client-declared `File.type` validated against a fail-closed allow-list that excludes active-content types; true byte-sniffing is an R-817/Sign-Off residual) — do NOT add magic-byte sniffing now (security cleared the exploit path; the allow-list is the enforced guarantee), and note the byte-sniffing hardening as owner-gated follow-up.
- [x] [Review][Patch][Med] `EntityFilePanel` `ownerType` prop is a hand-written literal union not derived from `ACTIVE_OWNER_TYPES`, so it can silently drift from the `ActiveOwnerType`-typed `readEntityFiles` [src/components/files/EntityFilePanel.tsx] — RESOLVED (2026-07-07): the panel prop now imports and uses `ActiveOwnerType` (the single source of truth derived from `ACTIVE_OWNER_TYPES`) instead of the hand-written literal union, matching `readEntityFiles`. Added a compile-time drift pin `tests/unit/components/files/entity-file-panel-owner-type.test.ts` (`TypeEqual<EntityFilePanelProps["ownerType"], ActiveOwnerType>` — fails `tsc --noEmit` if the two drift; verified it catches a deliberately-widened prop). Typecheck + unit test green. — `readEntityFiles(opts: { ownerType: ActiveOwnerType; ... })` is strongly typed off the source-of-truth union, but the panel prop duplicates the literal union (`"customer"|"facility"|"contact"|"calculation"|"quote_acceptance"|"job"`); if `ACTIVE_OWNER_TYPES` changes, the panel union and the read type drift with no compile error. Task 2.2 says to reuse the existing guards/unions rather than reinvent them. Fix: source the panel prop type from `ActiveOwnerType` (import the closed union) instead of a hand-written literal.
- [x] [Review][Defer][Med] Acceptance-evidence uploads are unbounded on an already-accepted (7.4-locked) acceptance — no lifecycle-state gate on the upload [src/server/commands/files/files.ts] — deferred, pre-existing (knowingly deferred to Story 8.4 / R-822). `uploadFile.execute` validates owner-visibility but performs no accepted/locked-state check on the owner entity; the 7.4 lock is a BEFORE-UPDATE trigger on `quote_acceptances` that does NOT fire on a NEW `file_links` insert, so a user can keep attaching evidence files to a locked acceptance. AC2's "wrong-lifecycle rejected" clause is not satisfied for the acceptance owner path. The panel header comment documents the deferral ("the evidence-file LOCK … is Story 8.4 — not enforced here … Under Phase A demo-data-only this addition is safe; 8.4 hardens it").
- [x] [Review][Defer][Low] A `files`-insert failure (object upload succeeded, metadata insert failed) leaves a bare storage-only orphan with no DB row and no archive record [src/server/storage/upload-object.ts] — deferred, pre-existing (relies on the future retention story, deferred-work §8-1). `fileRowWritten` stays false so `archiveFileRow` is not called, leaving the object in storage untracked. This is spec-compliant per the story's own archive-over-delete / no-object-reclamation posture (8.1 has no reclamation path; a retention story owns cleanup); INT `8.2-INT-05` correctly asserts no usable `files`/`file_links` row survives. Recorded because the storage-only orphan is untracked until the future retention story lands.

## Change Log

- 2026-07-07 — Story 8.2 implemented: generic user-facing upload path (`uploadFile` command + server-side MIME/size/owner/purpose gate + verified-compensated storage↔DB consistency reusing the 6.3 ordering via a shared `upload-object.ts` helper) and the entity file panels (customer/facility/contact/calculation/job/quote_acceptance). All ACs satisfied; unit 1152, INT 658 (full suite), E2E (files+CRM+calc+jobs+quotes) green. Status → review.
