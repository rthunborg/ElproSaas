"use server";

/**
 * Entity-file upload server action (Story 8.2, Task 4.2) — the ONLY write path the
 * `EntityFilePanel` upload form uses. This `"use server"` action wires the React 19
 * `useActionState` form pattern to the EXISTING `uploadFile` envelope command:
 *
 *   runCommand(uploadFile, { client: createSupabaseServerClient(), input })
 *
 *   - `client` is the per-request, cookie-bound RLS server client (anon key ONLY — NEVER a
 *     service-role key; the containment guards enforce this). It NEVER writes a files /
 *     file_links table directly — only the command writes, and only after the server-side
 *     MIME/size/owner/purpose/lifecycle gate.
 *   - The FormData file is parsed to bytes (`File.arrayBuffer()`); `size_bytes` is measured
 *     from the parsed bytes, and `mime_type` is the CLIENT-DECLARED `File.type` (the multipart
 *     `Content-Type` the browser set — NOT content-sniffed magic bytes). The server does NOT
 *     trust it as a proven content type: `mime_type` is validated against a FAIL-CLOSED
 *     allow-list (`ALLOWED_MIME_TYPES`) that excludes every active-content / XSS-capable type
 *     (`text/html`, `image/svg+xml`, `application/octet-stream`, executables), and the command
 *     re-runs that same gate server-side (a bypassed client is still rejected, R-808). The
 *     enforced guarantee is the closed allow-list, not byte-level sniffing; true magic-byte
 *     content sniffing is an owner-gated R-817 / Sign-Off residual (see deferred-work.md).
 *     owner_type / owner_id / purpose / display_name come from the form; a client path /
 *     bucket / tenant_id is NEVER read (server-derived only).
 *
 * The typed `Result` is mapped to an `UploadActionState` via the pure `classifyUploadError`
 * classifier (Task 1.2): `VALIDATION_FAILED` → BLOCKED_TYPE / TOO_LARGE (disambiguated by
 * the client pre-check), `TENANT_ACCESS_DENIED` / `FILE_ACCESS_DENIED` → generic PERMISSION
 * (no existence disclosure — R-809), `SERVER_ERROR` → NETWORK_OR_SERVER (retryable). On
 * success `revalidatePath` refreshes the entity route so the panel's existing-files list
 * re-renders. NO new auth/error/audit mechanism, NO direct table write.
 */
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { runCommand, type CommandDbClient } from "@/server/commands/envelope";
import { COMMAND_MESSAGES } from "@/server/commands/command-errors";
import {
  archiveFile,
  createSignedFileAccess,
  uploadFile,
} from "@/server/commands/files";
import {
  classifyUploadError,
  type UploadPrecheck,
} from "@/server/storage/upload-error-classifier";
import { parseUploadForm, precheckUpload } from "./form-parsing";
import {
  SIGNED_ACCESS_INITIAL,
  type SignedAccessState,
} from "./signed-access-state";
import {
  UPLOAD_ACTION_INITIAL,
  UPLOAD_ERROR_MESSAGES,
  type UploadActionState,
} from "./upload-action-state";
import {
  ARCHIVE_ACTION_INITIAL,
  ARCHIVE_ERROR_MESSAGES,
  classifyArchiveError,
  type ArchiveActionState,
} from "./archive-action-state";

/**
 * The entity route to revalidate on a successful upload, per owner type. `facility` /
 * `contact` render inside the parent customer hub, but the owner id is the facility/contact
 * id — the panel form carries a `revalidate_path` the action revalidates directly (so a
 * facility/contact panel refreshes the customer route it lives on). A missing/blank path
 * falls back to no-revalidate (the client re-fetches via router.refresh in the panel).
 */
function ownerRoute(ownerType: string, ownerId: string): string | null {
  switch (ownerType) {
    case "customer":
      return `/customers/${ownerId}`;
    case "calculation":
      return `/calculations/${ownerId}`;
    case "job":
      return `/jobs/${ownerId}`;
    default:
      // facility / contact / quote_acceptance render inside a parent detail route — the
      // panel supplies an explicit revalidate_path (handled in the action below).
      return null;
  }
}

/**
 * The upload action (React `useActionState` signature: (prevState, formData)). Wires the
 * panel's file `<input>` + submit to the `uploadFile` command. The server command is the
 * authority; the client pre-check is a UX nicety.
 */
export async function uploadFileAction(
  _prev: UploadActionState,
  form: FormData,
): Promise<UploadActionState> {
  const parsed = parseUploadForm(form);
  const fileEntry = form.get("file");

  // A missing / non-file entry is a client-shaped validation failure (never a silent no-op).
  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    return {
      ...UPLOAD_ACTION_INITIAL,
      status: "error",
      errorState: "BLOCKED_TYPE",
      formError: UPLOAD_ERROR_MESSAGES.BLOCKED_TYPE,
    };
  }

  // Measure size from the parsed bytes; take mime from the CLIENT-DECLARED `File.type` (the
  // browser-set multipart Content-Type, NOT sniffed magic bytes). It is not trusted as a
  // proven content type — it is validated against the fail-closed `ALLOWED_MIME_TYPES` list
  // (which excludes every active-content/XSS type) both here (pre-check) and, authoritatively,
  // inside the command. Byte-level content sniffing is an R-817 / Sign-Off follow-up.
  const arrayBuffer = await fileEntry.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const mimeType = (fileEntry.type || "").trim().toLowerCase();
  const sizeBytes = bytes.byteLength;
  // The display name is the form's display_name or the file's own name (sanitized server-side
  // into the object path; never a client path).
  const displayName = parsed.displayName ?? fileEntry.name;

  // The CLIENT-SIDE pre-check discriminant (from the SAME pure policy the server re-checks) —
  // lets a VALIDATION_FAILED disambiguate into blocked-type vs too-large for the UI.
  const precheck: UploadPrecheck = precheckUpload(mimeType, sizeBytes);

  const input: Record<string, unknown> = {
    owner_type: parsed.ownerType,
    owner_id: parsed.ownerId,
    purpose: parsed.purpose,
    display_name: displayName,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    bytes,
  };

  const client = (await createSupabaseServerClient()) as unknown as CommandDbClient;
  const result = await runCommand(uploadFile, { client, input });

  if (result.ok) {
    // Revalidate the entity route so the panel's existing-files list re-renders. An explicit
    // `revalidate_path` (facility/contact/acceptance panels living in a parent route) wins.
    const explicit =
      typeof form.get("revalidate_path") === "string"
        ? String(form.get("revalidate_path"))
        : null;
    const route =
      explicit && explicit.startsWith("/")
        ? explicit
        : parsed.ownerType && parsed.ownerId
          ? ownerRoute(parsed.ownerType, parsed.ownerId)
          : null;
    if (route) revalidatePath(route);
    return {
      ...UPLOAD_ACTION_INITIAL,
      status: "success",
      fileId: result.data.fileId,
    };
  }

  // Map the typed Result to one of the FOUR distinct user-safe error states (pure classifier).
  const errorState = classifyUploadError({ code: result.code, precheck });
  return {
    ...UPLOAD_ACTION_INITIAL,
    status: "error",
    errorState,
    formError: UPLOAD_ERROR_MESSAGES[errorState],
  };
}

/**
 * The entity-file preview/download action (Story 8.3, Task 2 — React `useActionState`
 * signature: (prevState, formData)). Mints a SHORT-LIVED SIGNED URL for one own-tenant file
 * listed in an `EntityFilePanel` row, via the EXISTING `createSignedFileAccess` command —
 * the 8.1 signing funnel REUSED VERBATIM. There is NO competing signing path (R-814 STOP);
 * this is the panel's twin of `previewJobEvidenceAction` (7.3) and the quote-PDF preview
 * (6.3).
 *
 *   runCommand(createSignedFileAccess, { client: createSupabaseServerClient(), input })
 *
 *   - `client` is the per-request, cookie-bound RLS server client (anon key ONLY — NEVER a
 *     service-role key; the containment guards enforce this). `storage.objects` RLS re-checks
 *     the tenant path prefix on the sign.
 *   - The action carries ONLY `file_id` (read from the row's form). It NEVER accepts/reads
 *     `owner_type`/`owner_id`/`object_path`/`bucket_id` from the client for signing — the
 *     command's own-tenant `ownership` gate re-verifies the id belongs to the caller's tenant,
 *     so a hand-crafted foreign `file_id` is denied `TENANT_ACCESS_DENIED` (the SAME generic
 *     shape as not-found — no existence disclosure, R-809; the epic-6 "preview accepts any
 *     own-tenant file id" residual is BOUNDED to own-tenant by the command — do NOT widen it).
 *   - EVERY call re-runs the WHOLE funnel (membership → ownership → lifecycle → sign), so an
 *     expiry-refresh reauthorization is achieved by calling this action AGAIN — never by
 *     re-issuing a cached URL (metadata-first ordering, R-810/AC2). No explicit `ttlSeconds`
 *     is passed (the command uses the clamped env default — never the clamp-bypass path).
 *
 * The typed `Result` maps to a `SignedAccessState`: `ok` → { status: "success", signedUrl,
 * expiresAt }; a failure → { status: "error", code, formError } (a generic Swedish message —
 * `TENANT_ACCESS_DENIED`/`FILE_ACCESS_DENIED` are user-safe with NO existence disclosure; a
 * `SERVER_ERROR` is RETRYABLE). The signed URL lives ONLY in the returned state (NEVER logged,
 * NEVER a public URL). NO new command, NO direct table write, NO signed URL in any log.
 */
export async function previewEntityFileAction(
  _prev: SignedAccessState,
  form: FormData,
): Promise<SignedAccessState> {
  const fileId = form.get("file_id");
  const input: Record<string, unknown> = { file_id: fileId };

  const client = (await createSupabaseServerClient()) as unknown as CommandDbClient;
  const result = await runCommand(createSignedFileAccess, { client, input });

  if (result.ok) {
    return {
      ...SIGNED_ACCESS_INITIAL,
      status: "success",
      signedUrl: result.data.signedUrl,
      expiresAt: result.data.expiresAt,
    };
  }

  return {
    ...SIGNED_ACCESS_INITIAL,
    status: "error",
    code: result.code,
    formError: result.message || COMMAND_MESSAGES[result.code],
  };
}

/**
 * The entity-file ARCHIVE server action (Story 8.5, Task 2.3 — React `useActionState` signature:
 * (prevState, formData)). Wires the panel/index ARCHIVE-ONLY affordance to the EXISTING `archiveFile`
 * command — the 8.4 archive-over-delete write REUSED VERBATIM (no new command, no direct table write,
 * no service-role, R-814).
 *
 *   runCommand(archiveFile, { client: createSupabaseServerClient(), input })
 *
 *   - `client` is the per-request, cookie-bound RLS server client (anon key ONLY — NEVER a
 *     service-role key). The command's `ownership` gate re-verifies own-tenant: a foreign / crafted
 *     `file_id` → zero rows → `TENANT_ACCESS_DENIED` (the SAME generic shape as not-found — no
 *     existence disclosure, R-809/AC5).
 *   - The action carries ONLY the row's `file_id` (+ an optional bounded `reason`). It issues an
 *     ARCHIVE intent — NEVER `hardDelete:true` (the crafted hard-delete path is a command-layer test
 *     surface, never the UI's happy path). An idempotent re-archive is a clean no-op at the command.
 *   - On success `revalidatePath` the entity route (the form's `revalidate_path`, mirroring
 *     `uploadFileAction`) so the panel/index re-renders with the archived file dropped.
 *
 * The typed `Result` maps to a user-safe `ArchiveActionState`: `FILE_LINK_LOCKED` → the locked
 * message (defensive — the archive intent shouldn't trip it); `TENANT_ACCESS_DENIED` → generic
 * permission; everything else (`SERVER_ERROR`/…) → retryable.
 */
export async function archiveFileAction(
  _prev: ArchiveActionState,
  form: FormData,
): Promise<ArchiveActionState> {
  const fileId = form.get("file_id");
  const rawReason = form.get("reason");
  const reason =
    typeof rawReason === "string" && rawReason.trim().length > 0
      ? rawReason.trim()
      : undefined;

  // Carry ONLY the file id (+ optional reason). NEVER hardDelete — the UI always ARCHIVES (the
  // archive-over-delete discipline; a locked file may be archived, never hard-deleted).
  const input: Record<string, unknown> = {
    id: fileId,
    ...(reason !== undefined ? { reason } : {}),
  };

  const client = (await createSupabaseServerClient()) as unknown as CommandDbClient;
  const result = await runCommand(archiveFile, { client, input });

  if (result.ok) {
    const explicit =
      typeof form.get("revalidate_path") === "string"
        ? String(form.get("revalidate_path"))
        : null;
    if (explicit && explicit.startsWith("/")) revalidatePath(explicit);
    return { ...ARCHIVE_ACTION_INITIAL, status: "success" };
  }

  // Map the typed Result to a user-safe error state via the PURE classifier (unit-covered at every
  // branch — no existence disclosure, no raw detail, R-809).
  const errorState = classifyArchiveError(result.code);
  return {
    ...ARCHIVE_ACTION_INITIAL,
    status: "error",
    errorState,
    formError: ARCHIVE_ERROR_MESSAGES[errorState],
  };
}
