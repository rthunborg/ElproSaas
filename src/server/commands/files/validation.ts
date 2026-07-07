/**
 * PURE file command input validators (Story 8.1, Task 5.1; architecture §5 step 4).
 *
 * Each command's `validateInput` returns a `ValidationResult<I>` — the validated,
 * narrowed value or `VALIDATION_FAILED`. The raw invalid value is NEVER echoed (the
 * envelope maps the failure to a generic user-safe message). Pure functions (no I/O)
 * so the owner-type / purpose closed-union rules are exhaustively unit-testable
 * WITHOUT a database, mirroring `calculations/validation.ts`.
 *
 * OWNER TYPES are the closed Phase A union (customer, facility, contact, calculation,
 * quote_version, quote_acceptance, job). The validator accepts them STRUCTURALLY — an
 * UNKNOWN owner type (a deferred-module type like supplier/asset) is a STOP condition
 * rejected here. Link creation for `quote_version` is still INACTIVE at the COMMAND layer
 * (the owner-resolution switch returns "not-yet-available"; the 6.1 RPC materializes
 * quote_version links directly) — that is an execute-layer decision, not a validation
 * one, so all seven values pass validation. `quote_acceptance` (7.1) and `job` (7.3) are
 * ACTIVE.
 *
 * Client-supplied `tenant_id` is NEVER read here — the resolved tenant from membership
 * is the only authority (the validators strip/ignore any `tenant_id`).
 */
import type { ValidationResult } from "../envelope-core";
import {
  isAllowedMimeType,
  isWithinSizeLimit,
} from "@/server/storage/upload-policy";

/**
 * The closed Phase A owner-type union (architecture §14 tech note). The DB CHECK
 * enumerates the same seven values. quote_version/quote_acceptance/job are structurally
 * valid but INACTIVE at the command layer (see the module header / owner-resolution).
 */
export const OWNER_TYPES = [
  "customer",
  "facility",
  "contact",
  "calculation",
  "quote_version",
  "quote_acceptance",
  "job",
] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];

/**
 * The owner types that are ACTIVE at the `createFileLink` COMMAND layer — their owner tables
 * exist so the command's own-tenant RLS SELECT (the R-802 owner-side check) can resolve them.
 * Story 7.1 ACTIVATES `quote_acceptance` (its `quote_acceptances` owner table lands in the 7.1
 * migration; the `acceptance_evidence` purpose is already in `FILE_PURPOSES`) so an evidence file
 * can be linked to an acceptance via `createFileLink`. `quote_version` links are materialized by
 * the 6.1 `create_quote_version_from_calculation` RPC directly (never through this command path),
 * so it stays out of this command-layer active set. Story 7.3 ACTIVATES `job` (the 7.1 `jobs` owner
 * table exists; the `job_evidence` purpose is already in `FILE_PURPOSES`) so a file can be
 * own-tenant-linked to a job via `createFileLink` — reusing the 8.1 signed-access + own-tenant
 * ownership funnel VERBATIM (no upload UX here — upload is Epic 8.2).
 */
export const ACTIVE_OWNER_TYPES = [
  "customer",
  "facility",
  "contact",
  "calculation",
  "quote_acceptance",
  "job",
] as const;
export type ActiveOwnerType = (typeof ACTIVE_OWNER_TYPES)[number];

/** The closed link-purpose union (architecture §14). The DB CHECK enumerates the same. */
export const FILE_PURPOSES = [
  "calculation_attachment",
  "quote_attachment_snapshot",
  "quote_pdf",
  "acceptance_evidence",
  "job_evidence",
  "crm_document",
] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];

/** A runtime guard that a raw value is a known `OwnerType`. */
export function isOwnerType(v: unknown): v is OwnerType {
  return typeof v === "string" && (OWNER_TYPES as readonly string[]).includes(v);
}

/** True iff `t` is an ACTIVE owner type (its owner table exists today). */
export function isActiveOwnerType(t: OwnerType): t is ActiveOwnerType {
  return (ACTIVE_OWNER_TYPES as readonly string[]).includes(t);
}

/** A runtime guard that a raw value is a known `FilePurpose`. */
export function isFilePurpose(v: unknown): v is FilePurpose {
  return (
    typeof v === "string" && (FILE_PURPOSES as readonly string[]).includes(v)
  );
}

const fail = { ok: false as const, code: "VALIDATION_FAILED" as const };

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return raw !== null && typeof raw === "object";
}

/** A UUID-shape guard so an `id` the DB would reject (`22P02`) fails as VALIDATION. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuidLike(v: unknown): v is string {
  return typeof v === "string" && v.length <= 36 && UUID_RE.test(v);
}

// ─────────────────────────────────────────────────────────────────────────────
// createSignedFileAccess input
// ─────────────────────────────────────────────────────────────────────────────

/** Validated `createSignedFileAccess` input — just the target file id. */
export interface SignedAccessInput {
  readonly file_id: string;
}

export function validateSignedAccess(
  raw: unknown,
): ValidationResult<SignedAccessInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.file_id)) return fail;
  return { ok: true, data: { file_id: raw.file_id as string } };
}

// ─────────────────────────────────────────────────────────────────────────────
// createFileLink input
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validated `createFileLink` input. `owner_type` ∈ the closed Phase A union (an
 * unknown type is rejected as VALIDATION_FAILED — the deferred-module STOP); `purpose`
 * ∈ the closed purpose union. The deferred quote_version/quote_acceptance/job owner
 * types pass validation but are rejected at the execute layer as "not-yet-available".
 */
export interface CreateFileLinkInput {
  readonly file_id: string;
  readonly owner_type: OwnerType;
  readonly owner_id: string;
  readonly purpose: FilePurpose;
}

export function validateCreateFileLink(
  raw: unknown,
): ValidationResult<CreateFileLinkInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.file_id)) return fail;
  if (!isOwnerType(raw.owner_type)) return fail;
  if (!isUuidLike(raw.owner_id)) return fail;
  if (!isFilePurpose(raw.purpose)) return fail;
  return {
    ok: true,
    data: {
      file_id: raw.file_id as string,
      owner_type: raw.owner_type,
      owner_id: raw.owner_id as string,
      purpose: raw.purpose,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// uploadFile input (Story 8.2, Task 2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The DEFAULT purpose EACH owner type expects (the owner_type↔purpose coupling, Task 2.3).
 * The upload path is scoped to the ACTIVE owner types; `quote_version` links are
 * materialized by the 6.1 RPC (never this command), so it is out of the active upload set.
 * A submitted purpose that does not match its owner type is a VALIDATION reject (a
 * mismatched pair — e.g. `calculation` + `acceptance_evidence` — is rejected).
 */
export const OWNER_TYPE_PURPOSE: Readonly<Record<ActiveOwnerType, FilePurpose>> = {
  customer: "crm_document",
  facility: "crm_document",
  contact: "crm_document",
  calculation: "calculation_attachment",
  quote_acceptance: "acceptance_evidence",
  job: "job_evidence",
};

/** The max display-name length (bounds the presentational segment; sanitized server-side). */
const MAX_DISPLAY_NAME = 255;

/**
 * Validated `uploadFile` input — the generic user-facing upload gate's typed surface.
 *
 * Validates: `owner_type` ∈ the closed union, `owner_id` UUID-shape, `purpose` ∈ the
 * closed union AND coupled to its owner type, `display_name` a non-empty bounded string,
 * `mime_type` present + on the Task-1 allow-list, `size_bytes` a non-negative integer
 * within the Task-1 size limit, and `bytes` the actual upload payload.
 *
 * A blocked MIME / oversized value fails as VALIDATION_FAILED — the raw value is NEVER
 * echoed (the envelope maps the failure to a generic message). Client
 * `tenant_id`/`object_path`/`bucket_id` are NEVER read (server-derived only) — they are
 * stripped by omission from the validated shape.
 */
export interface UploadFileInput {
  readonly owner_type: ActiveOwnerType;
  readonly owner_id: string;
  readonly purpose: FilePurpose;
  readonly display_name: string;
  readonly mime_type: string;
  readonly size_bytes: number;
  /**
   * The actual bytes to write to the private object (server-derived path). Present when the
   * command is fed a real payload (the action → `runCommand` path); the pure metadata
   * validation accepts input WITHOUT bytes (the action parses the FormData file to bytes and
   * re-derives mime/size from the file itself — the metadata gate is orthogonal to the
   * payload). The `execute` body guards that bytes are present before writing the object.
   */
  readonly bytes?: Uint8Array;
}

function isUint8Array(v: unknown): v is Uint8Array {
  return v instanceof Uint8Array;
}

export function validateUploadFile(raw: unknown): ValidationResult<UploadFileInput> {
  if (!isRecord(raw)) return fail;
  // owner_type: the closed union AND an ACTIVE owner type (the upload path serves only the
  // active owner types; an unknown/deferred-module type is the STOP-condition reject).
  if (!isOwnerType(raw.owner_type)) return fail;
  if (!isActiveOwnerType(raw.owner_type)) return fail;
  const ownerType = raw.owner_type; // narrowed ActiveOwnerType
  if (!isUuidLike(raw.owner_id)) return fail;
  if (!isFilePurpose(raw.purpose)) return fail;
  // owner_type↔purpose coupling (Task 2.3): a mismatched pair is rejected.
  if (OWNER_TYPE_PURPOSE[ownerType] !== raw.purpose) return fail;
  // display_name: non-empty, bounded string.
  if (typeof raw.display_name !== "string") return fail;
  const displayName = raw.display_name.trim();
  if (displayName.length === 0 || displayName.length > MAX_DISPLAY_NAME) return fail;
  // mime_type: present + on the Task-1 allow-list (the raw value is never echoed on reject).
  if (typeof raw.mime_type !== "string") return fail;
  const mimeType = raw.mime_type.trim().toLowerCase();
  if (!isAllowedMimeType(mimeType)) return fail;
  // size_bytes: a non-negative integer within the Task-1 size limit.
  if (typeof raw.size_bytes !== "number" || !isWithinSizeLimit(raw.size_bytes)) {
    return fail;
  }
  // bytes (OPTIONAL): when a real payload is present it MUST be a Uint8Array whose length
  // agrees with size_bytes — so a client cannot understate the declared size to slip an
  // oversized payload past the gate. Absent for the pure metadata-validation path.
  let bytes: Uint8Array | undefined;
  if (raw.bytes !== undefined) {
    if (!isUint8Array(raw.bytes)) return fail;
    if (raw.bytes.byteLength !== raw.size_bytes) return fail;
    bytes = raw.bytes;
  }
  return {
    ok: true,
    data: {
      owner_type: ownerType,
      owner_id: raw.owner_id as string,
      purpose: raw.purpose,
      display_name: displayName,
      mime_type: mimeType,
      size_bytes: raw.size_bytes,
      // Only carry bytes when a real payload was supplied (server-derived path; NEVER a
      // client tenant_id/object_path/bucket_id — those are omitted by construction).
      ...(bytes !== undefined ? { bytes } : {}),
    },
  };
}
