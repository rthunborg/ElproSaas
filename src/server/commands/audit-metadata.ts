/**
 * Audit metadata sanitizer (Story 2.3, AC5 / R-010; architecture §15).
 *
 * `audit_events.metadata` is an ALLOW-LIST, never free pass-through. This module
 * makes it IMPOSSIBLE BY CONSTRUCTION to persist forbidden content: only a narrow
 * set of pre-approved, bounded, SAFE scalar fields survive `sanitizeAuditMetadata`;
 * EVERYTHING else (a key it does not recognize, or a recognized field that fails
 * its type/length bound) is DROPPED. So real secrets, `.env` values, raw file
 * contents, service-role key material, full request bodies, and broad free-text PII
 * can never reach the audit row even if a caller smuggles them in.
 *
 * Adding a new safe field is a DELIBERATE, reviewable change here (extend
 * `SAFE_FIELDS`) — not a behaviour callers can opt into by passing extra keys.
 *
 * Forbidden examples this drops (proven by tests/unit/server/commands/audit-metadata):
 *   - `apiKey` / `serviceRoleKey` — unknown keys → dropped.
 *   - `env`, `fileContents`, `requestBody` — unknown keys → dropped.
 *   - `note` carrying a long free-text PII blob — not on the allow-list → dropped.
 */

/** Max length for a short safe string field (enum reasons / short hashes). */
const MAX_SHORT_STRING = 128;

/**
 * Matches ASCII control characters (NUL..0x1F incl. newlines/tabs, plus DEL 0x7F).
 * A safe scalar metadata field is single-line printable text; a value carrying
 * control chars (a leaked multi-line `.env`/file blob) is dropped. Built via
 * `String.fromCharCode` so the SOURCE file contains NO literal control characters
 * (and needs no `no-control-regex` eslint suppression).
 */
const CONTROL_CHARS = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(0x1f)}${String.fromCharCode(0x7f)}]`,
);

/**
 * The persisted, sanitized metadata shape. All fields optional and narrow. Extend
 * deliberately (and update `SAFE_FIELDS`) — never widen to arbitrary keys.
 */
export type SanitizedAuditMetadata = {
  /** A short enum-like reason for the lifecycle event (e.g. 'membership_disabled'). */
  readonly reason?: string;
  /** A content hash of the BEFORE state (e.g. 'sha256:...'), already non-secret. */
  readonly beforeHash?: string;
  /** A content hash of the AFTER state. */
  readonly afterHash?: string;
  /** A small numeric version of the target row (already tenant-scoped, not secret). */
  readonly targetVersion?: number;
};

/** A per-field validator: returns the safe value to keep, or `undefined` to DROP. */
type FieldValidator = (value: unknown) => unknown | undefined;

/** A bounded, single-line, non-empty string survives; anything else is dropped. */
const safeShortString: FieldValidator = (value) => {
  if (typeof value !== "string") return undefined;
  if (value.length === 0 || value.length > MAX_SHORT_STRING) return undefined;
  if (CONTROL_CHARS.test(value)) return undefined;
  return value;
};

/** A finite, safe-integer number survives; anything else is dropped. */
const safeNumber: FieldValidator = (value) => {
  if (typeof value !== "number") return undefined;
  if (!Number.isFinite(value) || !Number.isSafeInteger(value)) return undefined;
  return value;
};

/**
 * The ALLOW-LIST: the ONLY keys that may appear in persisted audit metadata, each
 * with its own validator. A key absent from this map is dropped unconditionally.
 */
const SAFE_FIELDS: Readonly<Record<keyof SanitizedAuditMetadata, FieldValidator>> = {
  reason: safeShortString,
  beforeHash: safeShortString,
  afterHash: safeShortString,
  targetVersion: safeNumber,
};

/**
 * Sanitize raw, caller-provided metadata into the narrow allow-listed shape.
 *
 * - Only keys in `SAFE_FIELDS` are considered; unknown keys are dropped.
 * - A recognized key whose value fails its validator (wrong type, too long,
 *   control chars) is dropped — never coerced or partially persisted.
 * - A null/undefined/non-object input yields a safe empty object.
 *
 * The result is always a plain JSON-safe object suitable for the `jsonb` column.
 */
export function sanitizeAuditMetadata(
  input: unknown,
): SanitizedAuditMetadata {
  const out: Record<string, unknown> = {};
  if (input === null || typeof input !== "object") {
    return out as SanitizedAuditMetadata;
  }
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(SAFE_FIELDS) as (keyof SanitizedAuditMetadata)[]) {
    if (!(key in record)) continue;
    const validated = SAFE_FIELDS[key](record[key]);
    if (validated !== undefined) {
      out[key] = validated;
    }
  }
  return out as SanitizedAuditMetadata;
}
