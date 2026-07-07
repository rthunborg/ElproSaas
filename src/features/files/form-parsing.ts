/**
 * PURE FormData → upload-command-input parsing for the entity file panel (Story 8.2,
 * Task 4.3). I/O-free where practical so it is unit-testable and mirrors the CRM
 * `form-parsing.ts` split.
 *
 * CRITICAL boundary note: this is the ACTION seam, NOT the security/validation boundary —
 * the authority is the `uploadFile` command's `validateInput` on the server. This module
 * reads owner_type/owner_id/purpose/display_name from the form and computes the CLIENT-SIDE
 * pre-check discriminant (blocked-type / too-large) from the SAME pure policy the server
 * re-validates with, so a near-miss surfaces as a SPECIFIC state instead of a generic
 * reject. The size AUTHORITY is measured from the parsed bytes server-side; the mime is the
 * client-declared `File.type` (browser-set Content-Type, NOT sniffed magic bytes) gated by a
 * fail-closed allow-list (active-content types excluded) both client-side and, authoritatively,
 * in the command. This parse never trusts a client path/bucket/tenant.
 */
import {
  isAllowedMimeType,
  isWithinSizeLimit,
} from "@/server/storage/upload-policy";
import type { UploadPrecheck } from "@/server/storage/upload-error-classifier";

/** The owner/purpose/name fields parsed from the panel form (never a path/bucket/tenant). */
export interface ParsedUploadForm {
  readonly ownerType: string | null;
  readonly ownerId: string | null;
  readonly purpose: string | null;
  readonly displayName: string | null;
}

/** Read a trimmed string form field, or null when absent/blank. */
function field(form: FormData, name: string): string | null {
  const raw = form.get(name);
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Parse the OWNER/PURPOSE/NAME fields the panel submits. NEVER reads a client-supplied
 * object_path / bucket_id / tenant_id (server-derived only — those form fields do not exist
 * in the panel and are ignored even if injected).
 */
export function parseUploadForm(form: FormData): ParsedUploadForm {
  return {
    ownerType: field(form, "owner_type"),
    ownerId: field(form, "owner_id"),
    purpose: field(form, "purpose"),
    displayName: field(form, "display_name"),
  };
}

/**
 * Compute the CLIENT-SIDE pre-check discriminant from the file's declared mime (`File.type`,
 * the browser-set Content-Type — NOT sniffed magic bytes) + its measured size. `too-large`
 * wins over `blocked-type` only after the type is allowed — a blocked type is the more
 * specific signal to show when both fail. Returns `none` when the file passes both pre-checks
 * (a later reject is then a server-side coupling/owner issue, not a type/size one). The
 * allow-list is fail-closed and excludes active-content types; byte-level content sniffing is
 * an R-817 / Sign-Off follow-up.
 */
export function precheckUpload(mimeType: string, sizeBytes: number): UploadPrecheck {
  if (!isAllowedMimeType(mimeType)) return "blocked-type";
  if (!isWithinSizeLimit(sizeBytes)) return "too-large";
  return "none";
}
