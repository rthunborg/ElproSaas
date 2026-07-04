/**
 * PURE file lifecycle-state helpers (Story 8.1, Task 4/8.8; architecture §14).
 *
 * The closed `files.lifecycle_state` union + the access-eligibility decision the
 * signing funnel (`createSignedFileAccess`) applies BEFORE any `createSignedUrl` call
 * (AC5). Pulled into a pure `.ts` module (no I/O, no React/DOM) so the fast
 * `node --test` gate protects the eligibility rule (coverage-shape lesson).
 *
 * Access-eligible = a signed URL MAY be issued for the file:
 *   - `draft`  / `linked` / `locked`  → eligible (the file is live);
 *   - `archived` / `deleted`          → NOT eligible (the signing funnel rejects them
 *     with a file-specific denial before Storage is touched).
 */

/** The closed lifecycle-state union (mirrors the DB CHECK on files.lifecycle_state). */
export const FILE_LIFECYCLE_STATES = [
  "draft",
  "linked",
  "locked",
  "archived",
  "deleted",
] as const;
export type FileLifecycleState = (typeof FILE_LIFECYCLE_STATES)[number];

/** The lifecycle states from which a signed URL MAY be issued (access-eligible). */
const ACCESS_ELIGIBLE: ReadonlySet<FileLifecycleState> = new Set([
  "draft",
  "linked",
  "locked",
]);

/** A runtime guard that a raw value is a known `FileLifecycleState`. */
export function isFileLifecycleState(v: unknown): v is FileLifecycleState {
  return (
    typeof v === "string" &&
    (FILE_LIFECYCLE_STATES as readonly string[]).includes(v)
  );
}

/**
 * True iff a file in `state` is access-eligible (a signed URL may be issued). An
 * unknown value is NOT eligible (fail-closed). `archived`/`deleted` are rejected — the
 * AC5 lifecycle gate refuses signing on an OWNED file before any createSignedUrl call.
 */
export function isAccessEligibleLifecycle(
  state: FileLifecycleState | string,
): boolean {
  return isFileLifecycleState(state) && ACCESS_ELIGIBLE.has(state);
}
