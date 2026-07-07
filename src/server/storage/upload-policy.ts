/**
 * PURE upload MIME/size POLICY (Story 8.2, Task 1.1; architecture §6, §14; R-808/R-811/
 * R-817).
 *
 * The server-side upload gate's MIME/size AUTHORITY, pulled into a pure `.ts` module
 * (no I/O, no React/DOM) so the fast `node --test` gate protects the decision — the
 * coverage-shape lesson: a MIME/size rule buried in a `.tsx` escapes the fast gate
 * (R-811). The SERVER validator (`validateUploadFile`) + the `uploadFile` command are the
 * SOLE authority (AC2): a client MAY pre-check with the SAME `isAllowedMimeType` /
 * `isWithinSizeLimit` for fast feedback, but the server re-validates identically — a
 * bypassed client is still rejected.
 *
 * ── CONSERVATIVE DEV DEFAULTS (R-817, demo-data-only) ─────────────────────────────────
 * The allow-list is deliberately MINIMAL: the pilot's real needs (PDF + common image
 * types + the plain document types a demo needs). Executable / active-content / opaque
 * `application/octet-stream` are NOT on the list. The FINAL file-type/size policy is an
 * owner Sign-Off residual; under the demo-data-only posture (owner decision 2026-07-03)
 * a conservative default is not a real-pilot blocker.
 *
 * ── SIZE BOUND (R-817) ────────────────────────────────────────────────────────────────
 * `MAX_UPLOAD_SIZE_BYTES` is the policy max. It MUST be ≤ the config.toml `tenant-files`
 * bucket outer bound (`file_size_limit = "50MiB"`) — the server policy is the authority,
 * but the storage layer's hard cap is the outer wall it can never exceed. A conservative
 * 25 MiB keeps demo uploads well inside both.
 */

/**
 * The conservative dev MIME allow-list (a CLOSED, non-empty set). The pilot needs PDF +
 * common image types + plain office/text document types a demo attaches. NO executable /
 * active-content / opaque `application/octet-stream` type — those are the canonical
 * blocked class a bypassed client would try.
 */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** The set form for O(1) membership checks (built once from the closed list). */
const ALLOWED_MIME_SET: ReadonlySet<string> = new Set(ALLOWED_MIME_TYPES);

/**
 * The policy max upload size (bytes). 25 MiB — a conservative dev default that stays well
 * under the config.toml `tenant-files` 50 MiB bucket outer bound. The server policy is the
 * authority; this constant must NEVER exceed that bucket cap (unit-pinned in
 * upload-policy.test.ts against the 50 MiB config bound).
 */
export const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

/**
 * True iff `mime` is on the conservative allow-list. An empty / garbage / opaque value is
 * rejected (a bypassed client can send anything — the allow-list is closed, fail-closed).
 * The comparison is case-sensitive on the canonical lowercase MIME strings; the caller
 * normalizes (`.trim().toLowerCase()`) before checking if the source is untrusted.
 */
export function isAllowedMimeType(mime: string | null | undefined): boolean {
  if (typeof mime !== "string" || mime.length === 0) return false;
  return ALLOWED_MIME_SET.has(mime);
}

/**
 * True iff `sizeBytes` is a non-negative integer within {@link MAX_UPLOAD_SIZE_BYTES}
 * (inclusive at the limit). A zero-byte file passes; a negative / non-integer / NaN /
 * over-limit value fails (fail-closed). Boundary: exactly-at-limit passes, one-over fails.
 */
export function isWithinSizeLimit(sizeBytes: number): boolean {
  if (!Number.isInteger(sizeBytes)) return false;
  if (sizeBytes < 0) return false;
  return sizeBytes <= MAX_UPLOAD_SIZE_BYTES;
}

/**
 * A human-readable size expectation for the client display strings (the panel surfaces
 * this via `readUploadPolicyDisplay`). "25 MB" — the presentational rounded MiB→MB label.
 */
export const MAX_UPLOAD_SIZE_DISPLAY = `${Math.round(
  MAX_UPLOAD_SIZE_BYTES / (1024 * 1024),
)} MB`;
