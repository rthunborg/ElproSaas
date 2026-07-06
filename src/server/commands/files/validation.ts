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
 * rejected here. Link creation for quote_version/quote_acceptance/job is INACTIVE at
 * the COMMAND layer (the owner-resolution switch returns "not-yet-available") until
 * Epics 6/7 add those owner tables — that is an execute-layer decision, not a
 * validation one, so all seven values pass validation.
 *
 * Client-supplied `tenant_id` is NEVER read here — the resolved tenant from membership
 * is the only authority (the validators strip/ignore any `tenant_id`).
 */
import type { ValidationResult } from "../envelope-core";

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
 * so it stays out of this command-layer active set. `job` remains "not-yet-available" until
 * Story 7.3 wires the job-evidence surface.
 */
export const ACTIVE_OWNER_TYPES = [
  "customer",
  "facility",
  "contact",
  "calculation",
  "quote_acceptance",
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
