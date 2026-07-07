# Story 8.2: Validated Upload And Entity File Panels

Status: ready-for-dev

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

- [ ] **Task 1 — Owner-approved-conservative MIME/size upload policy (pure `.ts`)** (AC2, AC3; R-808, R-811, R-817)
  - [ ] 1.1 Create `src/server/storage/upload-policy.ts` (PURE, no I/O — `node --test` in `tests/unit/**`): a conservative dev-default MIME allow-list (e.g. `application/pdf`, common image types `image/png`/`image/jpeg`, and the document types the pilot needs — keep it MINIMAL and conservative) + a max size constant that respects the config.toml outer bound (`file_size_limit = "50MiB"` on `tenant-files`; the policy max MUST be ≤ that). Export `isAllowedMimeType(mime)`, `isWithinSizeLimit(sizeBytes)`, and the raw constants.
  - [ ] 1.2 Extract the FOUR distinct error-state decisions into a PURE `.ts` classifier (coverage-shape lesson — NOT inside a `.tsx`): map a rejection to one of `BLOCKED_TYPE` / `TOO_LARGE` / `NETWORK_OR_SERVER` / `PERMISSION` given the command result code + client-side pre-check outcome. Cross-tenant/permission failures MUST resolve to the generic `PERMISSION` state (never leak existence — R-809). Unit-test every branch.
  - [ ] 1.3 Do NOT hardcode the allow-list into a component or duplicate it client-side as the authority: the server validator is the authority (AC2). The client MAY pre-check to give fast feedback, but the SERVER re-validates identically (client bypass must still be rejected).

- [ ] **Task 2 — Upload validators (pure `.ts`, extend `files/validation.ts`)** (AC2; R-808)
  - [ ] 2.1 Add `validateUploadFile(raw)` to `src/server/commands/files/validation.ts` returning `ValidationResult<UploadFileInput>`. Validate: `owner_type` ∈ the closed `OWNER_TYPES` union, `owner_id` UUID-shape, `purpose` ∈ the closed `FILE_PURPOSES` union, `display_name` non-empty bounded string, `mime_type` present + on the Task-1 allow-list, `size_bytes` a non-negative integer within the Task-1 size limit. A blocked MIME / oversized value fails as `VALIDATION_FAILED` (the raw value is NEVER echoed). Client `tenant_id`/`object_path`/`bucket_id` are NEVER read (stripped/ignored — server-derived only).
  - [ ] 2.2 Reuse the existing `isOwnerType`/`isFilePurpose`/`isUuidLike`/`isActiveOwnerType` guards — do NOT reinvent them. An UNKNOWN owner type (deferred-module type) is the STOP-condition VALIDATION reject already modeled in 8.1.
  - [ ] 2.3 The `owner_type`↔`purpose` coupling (e.g. `calculation`→`calculation_attachment`, `quote_acceptance`→`acceptance_evidence`, `job`→`job_evidence`, `customer`/`facility`/`contact`→`crm_document`) SHOULD be validated so a mismatched pair is rejected. Keep this pure + unit-tested.

- [ ] **Task 3 — `uploadFile` command + shared upload helper (server, reuses the envelope + 8.1 storage)** (AC2, AC4, AC5; R-807, R-808, R-814, ADR-A009)
  - [ ] 3.1 Add `uploadFile = defineCommand<UploadFileInput, UploadFileResult>` to `src/server/commands/files/files.ts`: `command: "file.upload"`, `auditable: true`, `eventType: "file.uploaded"`, `targetType: "file"`, `validateInput: validateUploadFile`. Envelope `ownership` verifies the OWNER record (the entity being attached to) is visible under the caller's RLS — reuse the `assertOwnerVisibleOrThrow` / `ownerRecordVisible` / `ownerTableFor` pattern from 8.1 (R-802 owner-side; a foreign owner id ⇒ zero rows ⇒ `TENANT_ACCESS_DENIED`). Only ACTIVE owner types resolve; a `quote_version` owner (materialized by the 6.1 RPC, not this command) is out of the upload path's active set.
  - [ ] 3.2 In `execute`, follow the 6.3 PDF pipeline's PROVEN ordering VERBATIM (`src/server/commands/quotes/generate-pdf.ts:215-307` is the canonical reference — do NOT invent a new shape): (a) `const fileId = crypto.randomUUID()` up front; (b) `objectPath = deriveObjectPath({ tenantId: ctx.tenantContext.tenantId, fileId, displayName })` (tenant-first, sanitized — NEVER a client path); (c) `ctx.db.storage.from("tenant-files").upload(objectPath, bytes, { contentType: mime, upsert: true })` on the CALLER's request-bound RLS client (NEVER service-role); (d) INSERT the `files` metadata row with the EXPLICIT `id: fileId` + `object_path`, `mime_type`, `size_bytes`, `uploaded_by: ctx.tenantContext.userId`, `lifecycle_state: "linked"`; (e) INSERT the `file_links` row (`owner_type`, `owner_id`, `purpose`) — or find-or-create if a same (tenant,file,owner,purpose) tuple could recur; (f) return `{ targetId: fileId, fileId, linkId }`.
  - [ ] 3.3 CONSTRAINT — the atomic `create_file_with_link` RPC self-allocates the file id (`returning id into v_file_id`; there is NO `p_file_id` parameter) and does NO MIME/size validation, so the object path cannot bind the file id through that RPC. This is EXACTLY why 6.3 bypassed it and did a direct explicit-id RLS-client insert. Reuse that same approach: direct explicit-id `files` insert + `file_links` insert on the RLS client, NOT `create_file_with_link`. Do NOT change the 8.1 RPC signature (a mechanism/signature change requires an ADR — STOP). Extract the shared "id-up-front → object write → verified-compensated metadata" logic into a small reusable helper (e.g. `src/server/storage/upload-object.ts` or a helper alongside `files.ts`) that BOTH this command and (later, optionally) the 6.3 PDF path could share — the epic-6 deferral explicitly asks 8.2 to reconcile a shared upload helper.
  - [ ] 3.4 VERIFIED-COMPENSATED CONSISTENCY (AC4, R-807 storage side): wrap the write sequence so a mid-pipeline fault does NOT leave a `files`/`file_links` row over a missing object, nor a stored object silently usable with no metadata. On a metadata-write failure AFTER a successful object upload, best-effort compensate (archive/mark the orphan; the archive-over-delete discipline stands — 8.1 has NO object-reclamation path, so an orphaned OBJECT is left/archived, never hard-deleted). The INT test (Task 6) MUST inject a DB failure AFTER the storage write and assert the state is consistent + retryable.
  - [ ] 3.5 Error mapping: reuse `throwMappedFileWriteError` (`23503`/`42501` → `TENANT_ACCESS_DENIED`, `23505`/`23514`/`22P02` → `VALIDATION_FAILED`, else a code-only `SERVER_ERROR`). A storage upload fault is a TRANSIENT `SERVER_ERROR` (retryable) — NEVER a permanent denial (mirror `signed-access.ts` transient-vs-permanent discipline). Audit metadata carries ONLY `{ targetId }`-shaped allow-listed fields — NO owner PII, NO bucket/object path, NO file contents, NO signed URL (§15).
  - [ ] 3.6 Export `uploadFile` from `src/server/commands/files/index.ts`.

- [ ] **Task 4 — Files read layer + server action (feature layer)** (AC1, AC3, AC5)
  - [ ] 4.1 Create `src/features/files/read.ts`: `readEntityFiles({ ownerType, ownerId })` — reads the own-tenant `file_links` (joined to `files`) for the entity via the per-request RLS client (anon key — NEVER service-role), filtered to non-archived links, returning display-safe fields (display_name, mime_type, size_bytes, lifecycle_state, created_at, file_id, link_id). NEVER return raw `object_path`/`bucket_id` to the UI (R-810). A read error degrades to a generic error signal (mirror the CRM read-error posture), never a cross-tenant leak.
  - [ ] 4.2 Create `src/features/files/actions.ts` (`"use server"`): an `uploadFileAction` wiring the React 19 `useActionState` form pattern to `runCommand(uploadFile, { client: createSupabaseServerClient(), input })` (the per-request cookie-bound RLS server client, anon key ONLY). Parse the `FormData` file (`File.arrayBuffer()` → bytes), read `mime_type`/`size_bytes` from the file itself server-side (do NOT trust a client-declared MIME as authority — re-derive/verify), and pass owner_type/owner_id/purpose/display_name. Map the typed `Result` to the four distinct error states via the Task-1.2 pure classifier: `VALIDATION_FAILED` → `BLOCKED_TYPE`/`TOO_LARGE` (disambiguate from the pre-check outcome), `TENANT_ACCESS_DENIED`/`FILE_ACCESS_DENIED` → generic `PERMISSION`, `SERVER_ERROR` → `NETWORK_OR_SERVER` (retryable). `revalidatePath` the entity route on success. NO new auth/error/audit mechanism, NO direct table write.
  - [ ] 4.3 Mirror the existing feature `actions.ts`/`form-parsing.ts` split (see `src/features/quotes/actions.ts`, `src/features/crm/form-parsing.ts`) — parsing helpers pure where practical.

- [ ] **Task 5 — Entity file panel component + wire into entity pages** (AC1, AC3)
  - [ ] 5.1 Create `src/components/files/EntityFilePanel.tsx` (client island): renders the allowed types + size expectation (from the Task-1 policy, surfaced to the client as display strings), the owning entity + purpose, the existing-files list (from `readEntityFiles`), a file `<input>` upload control, and the FOUR distinct error states as `role="alert"` regions with `data-testid`s. NO raw path field, NO client-entered bucket/path. Follow the epic-6 timeline a11y pattern (text status, not color-only; keyboard-reachable controls; accessible names).
  - [ ] 5.2 Wire the panel into at least the entity pages whose owner types are ACTIVE and whose upload the pilot needs — minimum: `customer`, `facility`, `contact` (CRM `crm_document`), `calculation` (`calculation_attachment`), `quote_acceptance` (`acceptance_evidence`), and `job` (`job_evidence`). Render via the SERVER entity page passing `readEntityFiles(...)` results as props (mirror the `CustomerDetailPage` server-fetch → client-component prop pattern). Do NOT add/remove/reorder `nav-items.ts` (it already has the 7 items incl. "Filer" → `/files`). Do NOT build out the `/files` index LISTING — `src/app/(app)/files/page.tsx` is a `PagePlaceholder` stub today and the limited file-index behavior stays Story 8.5 (optional). Leave the placeholder as-is; the entity PANELS (not a central index) are this story's UI surface.
  - [ ] 5.3 The panel's list surfaces `readEntityFiles` results only — own-tenant, never a cross-tenant file (RLS enforces; the UI adds no cross-tenant read).

- [ ] **Task 6 — Integration tests (INT, DB-backed, `SUPABASE_TEST_REQUIRED=1`)** (AC2, AC4, AC5; R-807/R-808/R-809)
  - [ ] 6.1 `tests/integration/commands/file-upload.int.test.ts`: valid upload succeeds (own-tenant, file+link persisted, `lifecycle_state = 'linked'`, object present); blocked MIME rejected `VALIDATION_FAILED` server-side even with a client-bypassed request; oversized rejected `VALIDATION_FAILED`; foreign-owner id (Tenant-B owner) rejected `TENANT_ACCESS_DENIED` (R-802 owner-side, both-side); parametrize across the ACTIVE owner types (customer/facility/contact/calculation/quote_acceptance/job) mirroring `file-link-ownership.int.test.ts`'s `describe.each`.
  - [ ] 6.2 Compensation case (R-807 storage side): inject a DB failure AFTER a successful object upload and assert NO usable `files`/`file_links` row survives over a stored object (or the orphan is archived/compensated), and the state is retryable — reuse the 6.3 retry/compensation test shape (`generate-quote-pdf-retry-consistency.int.test.ts`).
  - [ ] 6.3 No-existence-disclosure (R-809): a cross-tenant owner id and a genuinely non-existent owner id return the SAME generic `TENANT_ACCESS_DENIED` shape (no signal distinguishing them).
  - [ ] 6.4 EXTEND the fixture/factory support: add valid / blocked-MIME / oversized dev fixture BYTES generated at TEST TIME (never committed as customer data). Reuse/extend `tests/factories/tenants.ts` (it already has `adminUploadStorageObject`/`adminInsertFile`). Keep the golden PII/secret+ORGNR scan green over any new file fixtures (R-819 — anonymized metadata only, no raw customer file).

- [ ] **Task 7 — Pure unit tests + E2E** (AC1, AC2, AC3; R-811)
  - [ ] 7.1 `tests/unit/**` node-test units for the Task-1 upload-policy (`isAllowedMimeType`/`isWithinSizeLimit` boundaries incl. exactly-at-limit / one-over), the Task-1.2 four-state error classifier (every branch, incl. cross-tenant→generic PERMISSION), and the Task-2 `validateUploadFile` (blocked-MIME/oversized/foreign-shape/owner-purpose-mismatch reject; valid accept). Goldens/units live under `tests/unit/**` (runner-glob trap — never a `.tsx`).
  - [ ] 7.2 E2E (`tests/e2e/files/` new dir, Playwright): the entity-panel upload UX shows allowed types/size/owner/purpose and NO raw-path field (R-803/R-811); the four distinct error states each render as a distinct `role="alert"` with its `data-testid` (blocked-type, too-large, network/server-fail, permission-fail). Use `crypto.randomUUID()` for unique fixture names (NOT `Date.now()` — the epic-3 flake lesson).

- [ ] **Task 8 — Docs + non-regression guards**
  - [ ] 8.1 `.env.example` / config.toml: if a `allowed_mime_types` is set on the `tenant-files` bucket, keep it consistent with the Task-1 server allow-list; document that the server policy is the authority and config.toml is the outer bound. Note the demo-data-only posture (final policy is an owner Sign-Off residual, R-817).
  - [ ] 8.2 Do NOT weaken any existing 8.1 assertion (migration-reset EXACT policy enumeration, storage-object isolation, `createSignedFileAccess` matrix). The service-role containment guards MUST stay green — the upload path is anon+RLS client only.
  - [ ] 8.3 Do NOT wire the calc `readiness.ts` `REQUIRED_FILES_DEFERRED` warning to real file reads in THIS story unless it is a trivial read-only surface of the new `file_links` — the readiness classifier change is a separate concern; if touched, keep it purely additive and unit-pinned. (See Deferred-work overlap below.)

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

### Debug Log References

### Completion Notes List

### File List
