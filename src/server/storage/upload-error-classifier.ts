/**
 * PURE four-error-state upload classifier (Story 8.2, Task 1.2; architecture §5, §22;
 * R-809/R-811).
 *
 * Maps a typed command `Result` code + the client-side PRE-CHECK outcome to exactly ONE
 * of the FOUR distinct user-safe error states the entity file panel renders:
 *   - `BLOCKED_TYPE`       — the MIME is not on the allow-list;
 *   - `TOO_LARGE`          — the file exceeds the size limit;
 *   - `NETWORK_OR_SERVER`  — a transient/retryable infra fault (SERVER_ERROR);
 *   - `PERMISSION`         — a generic access denial (cross-tenant / foreign-owner /
 *     genuinely-not-found — collapsed to ONE shape, R-809).
 *
 * Pulled into a pure `.ts` module (no I/O, no React/DOM) so the fast `node --test` gate
 * protects every branch — the coverage-shape lesson: this decision must NEVER live inside
 * a `.tsx` (it escapes the fast gate otherwise — R-811).
 *
 * ── CRITICAL SECURITY BRANCH (R-809) ─────────────────────────────────────────────────
 * `TENANT_ACCESS_DENIED` and `FILE_ACCESS_DENIED` BOTH resolve to the SAME generic
 * `PERMISSION` state. The classifier can NEVER split a foreign-existing owner/file from a
 * genuinely-non-existent one — no "not found" vs "forbidden" signal ever reaches the UI.
 *
 * ── VALIDATION DISAMBIGUATION (no raw echo) ──────────────────────────────────────────
 * `VALIDATION_FAILED` is the server's generic reject (it NEVER echoes the raw MIME/size).
 * To render a SPECIFIC blocked-type vs too-large message, the classifier reads a
 * DISCRIMINANT — the client-side PRE-CHECK outcome (`blocked-type` / `too-large`), a
 * value the client computed from the SAME pure policy (`isAllowedMimeType` /
 * `isWithinSizeLimit`) BEFORE submit. This is a display nicety only: the server remains
 * the authority; a bypassed client that submits a blocked file with `precheck: "none"`
 * still gets a safe generic state (defaults to BLOCKED_TYPE for a validation failure).
 */
import type { CommandErrorCode } from "@/server/commands/command-errors";

/** The FOUR distinct user-safe error states the panel renders (AC3). */
export type UploadErrorState =
  | "BLOCKED_TYPE"
  | "TOO_LARGE"
  | "NETWORK_OR_SERVER"
  | "PERMISSION";

/**
 * The client-side pre-check outcome the classifier reads to DISAMBIGUATE a generic
 * `VALIDATION_FAILED` into blocked-type vs too-large. `none` = no client pre-check verdict
 * (the value the server-only path carries).
 */
export type UploadPrecheck = "blocked-type" | "too-large" | "none";

/** Input to {@link classifyUploadError}. */
export interface ClassifyUploadErrorInput {
  /** The typed command error code (or any string — an unknown code degrades safely). */
  readonly code: CommandErrorCode | string;
  /** The client-side pre-check discriminant (defaults to `none`). */
  readonly precheck: UploadPrecheck;
}

/**
 * Classify a failed upload into one of the FOUR distinct user-safe states.
 *
 * Branch table:
 *   - VALIDATION_FAILED + precheck 'too-large'    → TOO_LARGE
 *   - VALIDATION_FAILED + precheck 'blocked-type' → BLOCKED_TYPE
 *   - VALIDATION_FAILED + precheck 'none'         → BLOCKED_TYPE (safe default — a generic
 *       "the file was rejected" without disclosing which rule; blocked-type is the
 *       conservative label, never a leak of owner/existence)
 *   - TENANT_ACCESS_DENIED / FILE_ACCESS_DENIED   → PERMISSION (R-809 — one generic shape)
 *   - SERVER_ERROR                                → NETWORK_OR_SERVER (retryable)
 *   - any auth/membership denial                  → PERMISSION (generic, no leak)
 *   - anything else / unknown                     → NETWORK_OR_SERVER (generic retryable —
 *       never a more-informative state that would over-disclose)
 */
export function classifyUploadError(input: ClassifyUploadErrorInput): UploadErrorState {
  switch (input.code) {
    case "VALIDATION_FAILED":
      // Disambiguate via the pre-check discriminant (never the raw value). Default to the
      // conservative blocked-type label when the client offered no verdict.
      return input.precheck === "too-large" ? "TOO_LARGE" : "BLOCKED_TYPE";
    case "TENANT_ACCESS_DENIED":
    case "FILE_ACCESS_DENIED":
    // Auth/membership denials are ALSO generic permission failures (no existence leak).
    case "UNAUTHENTICATED":
    case "TENANT_MEMBERSHIP_REQUIRED":
      return "PERMISSION";
    case "SERVER_ERROR":
      return "NETWORK_OR_SERVER";
    default:
      // Defense-in-depth: an unmapped code degrades to a GENERIC retryable state — never a
      // blocked-type/too-large (which would over-disclose) and never a throw.
      return "NETWORK_OR_SERVER";
  }
}
