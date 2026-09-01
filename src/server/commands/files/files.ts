/**
 * File commands (Story 8.1, Task 5; architecture §5 command table).
 *
 * `createSignedFileAccess` — the SIGNING AUTHORIZATION FUNNEL — and `createFileLink` —
 * the polymorphic entity-link creation with the R-802 both-side ownership check + the
 * ADR-A009 atomic metadata+link RPC. Each a `defineCommand` through the EXISTING
 * envelope (resolve user → resolve active tenant_admin → validate typed input → verify
 * ownership → execute via the RLS client → append-only audit → typed Result). No
 * bespoke auth/error/audit mechanism.
 *
 * - The resolved tenant (`ctx.tenantContext.tenantId`) is the ONLY authority for the
 *   row's tenant_id AND the object-path tenant segment; a client-supplied tenant_id /
 *   path is NEVER read.
 * - Signing runs under the CALLER's request-bound anon-key RLS client (`ctx.db`) —
 *   NEVER a service-role key. `storage.objects` RLS re-checks the tenant path prefix.
 * - Metadata-first (R-810): the file metadata OWNERSHIP + LIFECYCLE gate always
 *   precedes any createSignedUrl call.
 * - Cross-tenant / not-found failures return the SAME generic shape (TENANT_ACCESS_DENIED)
 *   as each other — no existence disclosure (R-809). A file-specific denial on an
 *   OWNED file (lifecycle-ineligible / signing failed) is FILE_ACCESS_DENIED.
 * - Audit metadata carries ONLY allow-listed target-shaped fields — NO owner PII, NO
 *   bucket/object path, NO file contents, NO signed URL (§15).
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import { writeAuditEvent } from "../audit";
import type { CommandExecuteContext } from "../envelope-core";
import type { CommandDbClient } from "../envelope";
import { isAccessEligibleLifecycle } from "@/server/storage/lifecycle";
import {
  createSignedFileUrl,
  type StorageSigningClient,
} from "@/server/storage/signed-access";
import {
  uploadObjectWithMetadata,
  type UploadStorageClient,
} from "@/server/storage/upload-object";
import {
  asFileRpcClient,
  asFileWriteClient,
  loadFileForAccess,
  loadFileForArchive,
  ownerRecordVisible,
  ownerTableFor,
  throwMappedFileWriteError,
  type FileWriteClient,
} from "./file-db";
import { isActiveOwnerType } from "./validation";
import {
  validateArchiveFile,
  validateCreateFileLink,
  validateSignedAccess,
  validateUploadFile,
  type ArchiveFileInput,
  type CreateFileLinkInput,
  type SignedAccessInput,
  type UploadFileInput,
} from "./validation";

/** The bucket every Phase A file lives in (single private bucket). */
const TENANT_FILES_BUCKET = "tenant-files";

/** Result of `createSignedFileAccess` — the signed URL + its expiry + the file id. */
export interface SignedFileAccessResult {
  readonly targetId: string;
  readonly signedUrl: string;
  readonly expiresAt: string;
}

/**
 * `createSignedFileAccess` — the signing authorization funnel (AC5/AC6).
 *
 * Envelope gates: resolve user → active tenant_admin → validate → `verifyOwnership`
 * denies a cross-tenant/foreign/non-existent file id with TENANT_ACCESS_DENIED (zero
 * rows under RLS) BEFORE execute. In `execute`: load the file row under own-tenant RLS,
 * apply the LIFECYCLE gate (archived/deleted, or a reserved quote-PDF draft →
 * FILE_ACCESS_DENIED) BEFORE any storage call, then sign the SERVER-STORED object_path
 * under the caller's RLS client. Returns
 * `{ targetId, signedUrl, expiresAt }`. Every failure returns a stable generic code.
 */
export const createSignedFileAccess = defineCommand<
  SignedAccessInput,
  SignedFileAccessResult
>({
  command: "file.signedAccess.create",
  auditable: true,
  eventType: "file.signed_access.created",
  targetType: "file",
  validateInput: validateSignedAccess,
  // Envelope ownership: the target file must be visible under the caller's RLS (own
  // tenant). A foreign / non-existent id → zero rows → TENANT_ACCESS_DENIED, BEFORE
  // execute — the SAME shape as not-found (no existence disclosure, R-809).
  ownership: (input) => ({ table: "files", id: input.file_id }),
  execute: async (ctx): Promise<SignedFileAccessResult> => {
    // Metadata-first (R-810): load the file's storage identity + lifecycle under the
    // caller's RLS. Ownership already proved visibility; a null here is a race → deny.
    const file = await loadFileForAccess(ctx.db, ctx.input.file_id);
    if (file === null) {
      throw new CommandError("TENANT_ACCESS_DENIED");
    }
    // LIFECYCLE gate (AC5): an archived/deleted OWNED file is refused a signed URL —
    // a file-specific denial BEFORE any createSignedUrl call.
    if (
      !isAccessEligibleLifecycle(file.lifecycle_state) ||
      (file.artifact_kind === "quote_pdf" && file.lifecycle_state === "draft")
    ) {
      throw new CommandError("FILE_ACCESS_DENIED");
    }
    // Sign the SERVER-STORED object_path under the caller's request-bound RLS client
    // (NEVER service-role). storage.objects RLS re-checks the tenant path prefix.
    const signed = await createSignedFileUrl({
      client: ctx.db as unknown as StorageSigningClient,
      bucket: file.bucket_id || TENANT_FILES_BUCKET,
      objectPath: file.object_path,
      nowIso: ctx.clock.now().toISOString(),
    });
    // A storage failure (RLS denial, missing object) is a file-specific denial — never
    // a raw storage error across the boundary, never a signed URL in a failure Result.
    if (signed === null) {
      throw new CommandError("FILE_ACCESS_DENIED");
    }
    return {
      targetId: file.id,
      signedUrl: signed.signedUrl,
      expiresAt: signed.expiresAt,
    };
  },
  // Audit metadata is EMPTY-shaped ({}): the sanitizer drops everything not on the
  // allow-list anyway, so NO bucket/object path, NO signed URL, NO PII can reach the row.
  auditFields: (_ctx, result) => ({ targetId: result.targetId }),
});

/** Result of `createFileLink` — the created link id (as targetId) + the file id. */
export interface CreateFileLinkResult {
  readonly targetId: string;
  readonly fileId: string;
}

/**
 * Resolve the owner-side visibility for a link, throwing the correct stable code:
 *   - a DEFERRED owner type (quote_version/quote_acceptance/job) → the owner table does
 *     not exist yet → "not-yet-available" → TENANT_ACCESS_DENIED (generic, user-safe);
 *   - an ACTIVE owner type whose record is NOT visible under the caller's RLS (cross-
 *     tenant / non-existent) → TENANT_ACCESS_DENIED (R-802 owner-side).
 */
async function assertOwnerVisibleOrThrow(
  db: CommandDbClient,
  input: CreateFileLinkInput,
): Promise<void> {
  if (!isActiveOwnerType(input.owner_type)) {
    // quote_version / quote_acceptance / job — INACTIVE until Epics 6/7 add the owner
    // table. A generic denial (no leak that the type is "coming later").
    throw new CommandError("TENANT_ACCESS_DENIED");
  }
  const ownerTable = ownerTableFor(input.owner_type);
  const visible = await ownerRecordVisible(db, ownerTable, input.owner_id);
  if (!visible) {
    throw new CommandError("TENANT_ACCESS_DENIED");
  }
}

/**
 * `createFileLink` — polymorphic entity-link creation (AC3/AC7).
 *
 * Envelope ownership verifies the FILE belongs to the resolved tenant (a foreign
 * file_id → zero rows → TENANT_ACCESS_DENIED, BEFORE execute). In `execute`, ALSO
 * verify the OWNER record belongs to the resolved tenant (the R-802 both-side check),
 * then insert a `file_links` row referencing the VERIFIED file directly via the narrow
 * `link_existing_file` RPC — the link points at the REAL file. NO phantom `files` row
 * is minted here (the real upload+object-write path is Story 8.2); Epic 6.1/6.3 can
 * therefore `createFileLink(existing file, owner)` and get that exact file attached
 * (R-814 reuse contract). The composite same-tenant FK re-enforces the same-tenant
 * file binding at the DB, so no client path/tenant is trusted.
 */
export const createFileLink = defineCommand<
  CreateFileLinkInput,
  CreateFileLinkResult
>({
  command: "file.link.create",
  auditable: true,
  eventType: "file.linked",
  targetType: "file_link",
  validateInput: validateCreateFileLink,
  // Envelope ownership: the FILE must be visible under the caller's RLS (own tenant).
  ownership: (input) => ({ table: "files", id: input.file_id }),
  execute: async (ctx): Promise<CreateFileLinkResult> => {
    // OWNER-side check (R-802 both-side): the owner record must belong to the resolved
    // tenant (deferred owner types are rejected as not-yet-available).
    await assertOwnerVisibleOrThrow(ctx.db, ctx.input);

    // Insert the link referencing the VERIFIED file directly (ownership already proved
    // the file is visible under the caller's RLS). The narrow `link_existing_file` RPC
    // writes EXACTLY ONE file_links row pointing at the real file — no phantom files row,
    // no synthetic object_path. The composite same-tenant FK re-enforces the same-tenant
    // file binding at the DB (a cross-tenant file/tenant fails 23503/42501).
    const rpc = asFileRpcClient(ctx.db);
    const { data, error } = await rpc.rpc("link_existing_file", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_file_id: ctx.input.file_id,
      p_owner_type: ctx.input.owner_type,
      p_owner_id: ctx.input.owner_id,
      p_purpose: ctx.input.purpose,
    });
    if (error) throwMappedFileWriteError(error);
    // The RPC returns rows of { file_id, link_id } (or a single object depending on the
    // PostgREST shape). Extract the link id defensively.
    const linkId = extractLinkId(data);
    if (linkId === null) {
      throw new Error("createFileLink: RPC returned no link id");
    }
    // The link points at the VERIFIED, caller-supplied file id — result.fileId agrees
    // with file_links.file_id (no phantom-file divergence).
    return { targetId: linkId, fileId: ctx.input.file_id };
  },
  auditFields: (_ctx, result) => ({ targetId: result.targetId }),
});

/** Extract the created link id from the RPC result (row array or single object). */
function extractLinkId(data: unknown): string | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (row && typeof row === "object" && "link_id" in row) {
    const id = (row as { link_id: unknown }).link_id;
    if (typeof id === "string") return id;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// uploadFile (Story 8.2, Task 3) — the generic user-facing upload path.
// ─────────────────────────────────────────────────────────────────────────────

/** Result of `uploadFile` — the file id (also targetId) + the created link id. */
export interface UploadFileResult {
  readonly targetId: string;
  readonly fileId: string;
  readonly linkId: string;
}

/** Assert an ACTIVE owner record is visible under the caller's RLS (R-802 owner-side). */
async function assertUploadOwnerVisibleOrThrow(
  db: CommandDbClient,
  input: UploadFileInput,
): Promise<void> {
  // `validateUploadFile` already narrowed owner_type to an ACTIVE owner type, so
  // `ownerTableFor` always resolves. A foreign / non-existent owner id ⇒ zero rows ⇒
  // TENANT_ACCESS_DENIED — the SAME generic shape as not-found (no existence disclosure,
  // R-809). A quote_version owner (materialized by the 6.1 RPC) never reaches here.
  const ownerTable = ownerTableFor(input.owner_type);
  const visible = await ownerRecordVisible(db, ownerTable, input.owner_id);
  if (!visible) {
    throw new CommandError("TENANT_ACCESS_DENIED");
  }
}

/**
 * `uploadFile` — the generic user-facing upload command (AC1-AC5).
 *
 * Envelope gates: resolve user → active tenant_admin → validate typed input (MIME/size/
 * owner_type/purpose/owner-shape — the SERVER is the authority; a bypassed client is still
 * rejected, R-808). In `execute`: verify the OWNER record is own-tenant-visible (R-802
 * owner-side — a foreign owner ⇒ TENANT_ACCESS_DENIED, the SAME shape as not-found),
 * then follow the 6.3 PROVEN ordering through the shared upload helper: id-up-front →
 * `deriveObjectPath` (tenant-first, server-derived — NEVER a client path) → object write on
 * the CALLER's RLS client (NEVER service-role) → explicit-id `files` insert
 * (`lifecycle_state='linked'` — 8.2 owns the draft→linked transition) → `file_links` insert.
 * Verified-compensated consistency: a metadata failure after the object write archives any
 * written `files` row (archive-over-delete — no reclamation) and surfaces a retryable
 * SERVER_ERROR (never a false success, never a permanent denial for a transient fault).
 *
 * Audit metadata carries ONLY `{ targetId }`-shaped allow-listed fields — NO owner PII, NO
 * bucket/object path, NO file contents, NO signed URL (§15).
 */
export const uploadFile = defineCommand<UploadFileInput, UploadFileResult>({
  command: "file.upload",
  auditable: true,
  eventType: "file.uploaded",
  targetType: "file",
  validateInput: validateUploadFile,
  // NO envelope `ownership` target: the file does not exist yet (it is created here), and
  // the OWNER record is polymorphic. The R-802 owner-side check runs in execute (below).
  execute: async (ctx): Promise<UploadFileResult> => {
    const db = ctx.db;
    const tenantId = ctx.tenantContext.tenantId;
    const input = ctx.input;

    // OWNER-side check (R-802 both-side): the entity being attached to must belong to the
    // resolved tenant (a foreign / non-existent owner ⇒ TENANT_ACCESS_DENIED, BEFORE any
    // object/metadata write).
    await assertUploadOwnerVisibleOrThrow(db, input);

    // The payload must be present (the real action → runCommand path always carries it; the
    // pure metadata-validation path never reaches execute). A missing payload is a client-
    // shaped VALIDATION_FAILED, never a silent empty write.
    const bytes = input.bytes;
    if (bytes === undefined) {
      throw new CommandError("VALIDATION_FAILED");
    }

    // The file id is generated UP FRONT so the object path binds to the same id (the 6.3
    // pattern — `create_file_with_link` self-allocates the id, so it cannot bind the path).
    const fileId = crypto.randomUUID();
    const writer = asFileWriteClient(db);

    const result = await uploadObjectWithMetadata({
      client: db as unknown as UploadStorageClient,
      tenantId,
      fileId,
      displayName: input.display_name,
      mimeType: input.mime_type,
      bytes,
      // (d) INSERT the files metadata row (explicit id = the object-path segment). RLS
      // WITH CHECK narrows to own tenant; a forged tenant_id fails 42501. lifecycle_state
      // 'linked' — a file created WITH a link is linked by construction (8.2 owns this).
      insertFileRow: async (objectPath: string) => {
        const { error } = await writer
          .from("files")
          .insert({
            id: fileId,
            tenant_id: tenantId,
            bucket_id: TENANT_FILES_BUCKET,
            object_path: objectPath,
            display_name: input.display_name,
            mime_type: input.mime_type,
            size_bytes: input.size_bytes,
            uploaded_by: ctx.tenantContext.userId,
            lifecycle_state: "linked",
          })
          .select("id")
          .single();
        if (error) throwMappedFileWriteError(error);
      },
      // (e) INSERT the file_links row pointing at the verified file (owner already checked).
      insertLinkRow: async (linkedFileId: string) => {
        const { data, error } = await writer
          .from("file_links")
          .insert({
            tenant_id: tenantId,
            file_id: linkedFileId,
            owner_type: input.owner_type,
            owner_id: input.owner_id,
            purpose: input.purpose,
          })
          .select("id")
          .single();
        if (error) throwMappedFileWriteError(error);
        if (!data || typeof data.id !== "string") {
          throw new Error("uploadFile: file_links insert returned no id");
        }
        return data.id;
      },
      // COMPENSATION (R-807): a metadata failure AFTER the object write archives a written
      // files row so no committed-usable row survives over the object. The orphaned OBJECT
      // is left/archived (8.1 has no reclamation) — best-effort; swallows its own faults.
      archiveFileRow: (writtenFileId: string) =>
        archiveOrphanFile(writer, writtenFileId),
    });

    return { targetId: result.fileId, fileId: result.fileId, linkId: result.linkId };
  },
  // Audit metadata is EMPTY-shaped: the sanitizer drops everything not on the allow-list, so
  // NO owner PII, NO bucket/object path, NO file contents can reach the row.
  auditFields: (_ctx, result) => ({ targetId: result.targetId }),
});

/**
 * Best-effort ARCHIVE of an orphaned `files` row (compensation). Sets
 * `lifecycle_state='archived'` so no committed-usable row points at the stored object
 * (archive-over-delete — 8.1 has no object-reclamation path). Swallows its own secondary
 * fault: the ORIGINAL error is what the caller must see (never a false success).
 */
async function archiveOrphanFile(
  writer: FileWriteClient,
  fileId: string,
): Promise<void> {
  await writer
    .from("files")
    .update({ lifecycle_state: "archived" })
    .eq("id", fileId)
    .select("id");
}

// ─────────────────────────────────────────────────────────────────────────────
// archiveFile (Story 8.4, Task 3.3) — the ARCHIVE-ONLY-DELETE command (AC3).
// ─────────────────────────────────────────────────────────────────────────────

/** Result of `archiveFile` — the file id (also targetId) + whether it was a fresh archive. */
export interface ArchiveFileResult {
  readonly targetId: string;
  /** True when this call actually flipped the file to archived; false on an idempotent no-op. */
  readonly archived: boolean;
}

/** The audit event type + command/target for the archive-only-delete of a file (allow-listed metadata). */
const ARCHIVE_FILE_EVENT_TYPE = "file.archived";
const ARCHIVE_FILE_COMMAND = "file.archive";
const ARCHIVE_FILE_TARGET_TYPE = "file";

/**
 * `archiveFile` — the archive-only-delete command (AC3, §14, R-813).
 *
 * A locked file (or any own-tenant file) is ARCHIVED, never hard-deleted: the `enforce_file_lock`
 * DB trigger PERMITS the sanctioned `locked → archived` transition (an `archived_at` +
 * `lifecycle_state='archived'` UPDATE) but RAISES `FL823` on a hard DELETE. Deletion of a locked
 * file is archive-only unless a later approved retention workflow says otherwise (architecture §14;
 * a hard-delete retention rule for locked customer evidence is a STOP requiring legal sign-off,
 * R-818 — NOT built here).
 *
 * Envelope gates: resolve user → active tenant_admin → validate → `ownership` verifies the file is
 * own-tenant-visible (a foreign / non-existent id → zero rows → TENANT_ACCESS_DENIED, the SAME
 * generic shape as not-found — no existence disclosure, R-809; an anon caller → UNAUTHENTICATED).
 * In `execute`: load the file's current lifecycle; an ALREADY-archived file is a CLEAN IDEMPOTENT
 * NO-OP (no write, no audit row — AC4 retryable consistency). A CRAFTED `hardDelete` intent issues
 * a DELETE that the trigger RAISES on a locked file → mapped to the stable `FILE_LINK_LOCKED` code
 * (never a raw SQLSTATE or SERVER_ERROR). Otherwise flip to archived via an UPDATE on the caller's
 * RLS client (NEVER a DELETE, NEVER service-role) and write EXACTLY ONE append-only audit row.
 *
 * NOT envelope-auditable: the command writes the audit row ITSELF, and ONLY on a fresh archive — an
 * idempotent re-entry (already archived) produced no state change and must write NO audit row
 * (mirrors `acceptQuoteAndCreateJob`'s conditional-audit shape). Audit metadata is `{ reason? }`-shaped
 * allow-listed ONLY (the `reason` allow-list field survives `sanitizeAuditMetadata`) — NO bucket/object
 * path, NO PII, NO file contents (§15).
 */
export const archiveFile = defineCommand<ArchiveFileInput, ArchiveFileResult>({
  command: ARCHIVE_FILE_COMMAND,
  // Conditional audit (written in execute only on a fresh archive) — see the module note above.
  auditable: false,
  eventType: ARCHIVE_FILE_EVENT_TYPE,
  targetType: ARCHIVE_FILE_TARGET_TYPE,
  validateInput: validateArchiveFile,
  // Envelope ownership: the file must be visible under the caller's RLS (own tenant). A foreign /
  // non-existent id → zero rows → TENANT_ACCESS_DENIED BEFORE execute (no existence disclosure).
  ownership: (input) => ({ table: "files", id: input.id }),
  execute: async (ctx): Promise<ArchiveFileResult> => {
    const db = ctx.db;
    const fileId = ctx.input.id;
    const writer = asFileWriteClient(db);

    // Load the file's current lifecycle (ownership proved visibility; a null here is a race → deny).
    const file = await loadFileForArchive(db, fileId);
    if (file === null) throw new CommandError("TENANT_ACCESS_DENIED");

    // A CRAFTED hard-delete intent: the archive-over-delete rule forbids a hard DELETE of a locked
    // file. A LOCKED file surfaces the stable `FILE_LINK_LOCKED` code directly (the two-layer lock —
    // the `enforce_file_lock` DB trigger is the below-the-command backstop, proven by the RLS suite;
    // at the command layer we fail-closed on the loaded lifecycle so the hard-delete intent never
    // even reaches a DELETE). NOTE: `authenticated` has NO delete grant on `files` (archive-over-
    // delete by construction — 8.1), so a DELETE would fail 42501 → TENANT_ACCESS_DENIED anyway; the
    // command-layer lock check makes a locked-file hard-delete surface the CORRECT lock code, not an
    // opaque access denial. An UNLOCKED file's hard-delete is ALSO not the sanctioned path (archive
    // is the discipline) — surface the same lock code so a hard-delete intent never removes a row.
    if (ctx.input.hardDelete === true) {
      throw new CommandError("FILE_LINK_LOCKED");
    }

    // IDEMPOTENT NO-OP (AC4): an already-archived file is not re-archived and writes NO audit row.
    if (file.lifecycle_state === "archived") {
      return { targetId: fileId, archived: false };
    }

    // Flip to archived via an UPDATE (NEVER a DELETE). The `enforce_file_lock` trigger PERMITS the
    // sanctioned `locked → archived` transition; a `draft`/`linked` file archives freely too.
    const { data, error } = await writer
      .from("files")
      .update({
        lifecycle_state: "archived",
        archived_at: ctx.clock.now().toISOString(),
      })
      .eq("id", fileId)
      .select("id");
    if (error) throwMappedFileWriteError(error);
    if (!data || data.length === 0) {
      // Visible under ownership but gone now (race) → deny rather than a false success.
      throw new CommandError("TENANT_ACCESS_DENIED");
    }

    // Write EXACTLY ONE append-only audit row on the FRESH archive. `{ reason? }` allow-listed ONLY
    // (the sanitizer drops everything not on the allow-list — NO bucket/object path / PII / contents).
    await writeAuditEvent(
      ctx as CommandExecuteContext<unknown, CommandDbClient>,
      ARCHIVE_FILE_COMMAND,
      {
        eventType: ARCHIVE_FILE_EVENT_TYPE,
        targetType: ARCHIVE_FILE_TARGET_TYPE,
        targetId: fileId,
        metadata: ctx.input.reason !== undefined ? { reason: ctx.input.reason } : {},
      },
    );

    return { targetId: fileId, archived: true };
  },
  // No envelope auditFields: the command owns its (conditional) audit write above.
});
