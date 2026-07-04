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
import type { CommandDbClient } from "../envelope";
import { isAccessEligibleLifecycle } from "@/server/storage/lifecycle";
import {
  createSignedFileUrl,
  type StorageSigningClient,
} from "@/server/storage/signed-access";
import {
  asFileRpcClient,
  loadFileForAccess,
  ownerRecordVisible,
  ownerTableFor,
  throwMappedFileWriteError,
} from "./file-db";
import { isActiveOwnerType } from "./validation";
import {
  validateCreateFileLink,
  validateSignedAccess,
  type CreateFileLinkInput,
  type SignedAccessInput,
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
 * apply the LIFECYCLE gate (archived/deleted → FILE_ACCESS_DENIED) BEFORE any storage
 * call, then sign the SERVER-STORED object_path under the caller's RLS client. Returns
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
    if (!isAccessEligibleLifecycle(file.lifecycle_state)) {
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
