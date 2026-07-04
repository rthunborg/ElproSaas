/**
 * Server-derived storage OBJECT PATH derivation (Story 8.1, Task 4.1; architecture
 * §6, §14, R-810).
 *
 * PURE + unit-tested (no I/O, no Supabase SDK) so the load-bearing tenant-first
 * invariant and the display-name sanitization are protected by the fast `node --test`
 * gate (coverage-shape lesson — path derivation lives in pure `.ts`, never a `.tsx`).
 *
 * The object path is ALWAYS `{tenantId}/{fileId}/{sanitizedName}`. The FIRST segment
 * is ALWAYS the RESOLVED tenant id — the segment `storage.objects` RLS keys on. The
 * `tenantId` comes ONLY from `ctx.tenantContext.tenantId` (never client input); the
 * helper uses it VERBATIM and never re-derives or trusts a client-supplied path.
 *
 * The display-name segment is SANITIZED so no path traversal is possible: any `/`,
 * `\`, `..`, or control character is stripped/replaced, and the result is bounded and
 * never empty (a fully-sanitized-away name falls back to a fixed token). So a
 * malicious `../../etc/passwd` display name can never escape the tenant prefix.
 */

/** Fallback name segment when the sanitized display name would otherwise be empty. */
const FALLBACK_NAME = "file";

/** Max length of the sanitized name segment (defensive bound). */
const MAX_NAME_SEGMENT = 128;

/**
 * Matches ASCII control characters (NUL..0x1F incl. newlines/tabs, plus DEL 0x7F).
 * Built via `String.fromCharCode` so the SOURCE file contains NO literal control
 * characters (and needs no `no-control-regex` eslint suppression) — mirrors the
 * audit-metadata sanitizer's approach.
 */
const CONTROL_CHARS = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(0x1f)}${String.fromCharCode(0x7f)}]`,
  "g",
);

/**
 * Sanitize a display name into a SINGLE safe path segment: no `/`, no `\`, no `..`, no
 * control characters, no leading/trailing dots or whitespace. This guarantees the
 * result contributes exactly ONE segment to the object path — no traversal escapes the
 * `{tenantId}/{fileId}/` prefix. Exported for direct unit testing.
 */
export function sanitizeNameSegment(displayName: string): string {
  let name = String(displayName ?? "");

  // Drop ASCII control characters (NUL..0x1F and DEL 0x7F). The regex is built via
  // char codes (CONTROL_CHARS) so the source carries no literal control chars.
  name = name.replace(CONTROL_CHARS, "");

  // Replace path separators with a safe underscore so no embedded slash/backslash can
  // introduce an extra segment.
  name = name.replace(/[/\\]/g, "_");

  // Collapse any run of dots (which includes the `..` traversal token) to a single
  // dot, then strip a leading/trailing dot so `..`/`...`/`.` cannot survive as a
  // traversal or a hidden-file marker.
  name = name.replace(/\.{2,}/g, ".");

  // Trim leading/trailing whitespace and dots.
  name = name.replace(/^[\s.]+/, "").replace(/[\s.]+$/, "");

  // Bound the length (deterministic prefix bound).
  if (name.length > MAX_NAME_SEGMENT) {
    name = name.slice(0, MAX_NAME_SEGMENT);
    // Re-strip a trailing dot the slice may have exposed.
    name = name.replace(/[\s.]+$/, "");
  }

  // Never empty: a name that sanitized entirely away (e.g. "../..") falls back to a
  // fixed token so the object still has a stable third segment.
  if (name.length === 0) return FALLBACK_NAME;
  return name;
}

/** Input for {@link deriveObjectPath}. All ids come from the resolved tenant context. */
export interface DeriveObjectPathInput {
  /** The RESOLVED tenant id (ctx.tenantContext.tenantId) — NEVER client input. */
  readonly tenantId: string;
  /** The file id (server-generated uuid). */
  readonly fileId: string;
  /** The presentational display name (client-supplied — sanitized into ONE segment). */
  readonly displayName: string;
}

/**
 * Derive the SERVER-OWNED storage object path `{tenantId}/{fileId}/{sanitizedName}`.
 *
 * The tenant id is used VERBATIM as the FIRST segment (the RLS-keyed segment); the
 * file id is the SECOND segment; the sanitized display name is the THIRD. No client
 * path is ever read or trusted — the caller passes only the resolved tenant id + the
 * server-generated file id + the raw display name (which is sanitized here).
 */
export function deriveObjectPath(input: DeriveObjectPathInput): string {
  const { tenantId, fileId, displayName } = input;
  const safeName = sanitizeNameSegment(displayName);
  return `${tenantId}/${fileId}/${safeName}`;
}
