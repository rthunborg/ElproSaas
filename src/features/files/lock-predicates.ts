/**
 * PURE file-link LOCK DECISION predicates (Story 8.4, Task 5.1; architecture §14).
 *
 * The client-safe lock-state predicates the 8.2/8.3 `EntityFilePanel` uses to DISABLE a
 * "replace/delete" affordance on a locked file — a UX convenience ONLY, NEVER the guarantee
 * (the command `FILE_LINK_LOCKED` + the DB triggers `FL823` are). Pulled into a pure `.ts`
 * module (no I/O, no React/DOM, no `"use client"`) so the fast `node --test` gate protects
 * every branch (the coverage-shape lesson — a helper trapped in a `.tsx` is vacuous-green).
 *
 * These MIRROR the DB `apply_file_link_lock` / `enforce_file_lock` decision table:
 *   - a `quote_version` PDF/attachment link is LOCKABLE once the parent version is non-draft;
 *   - a `quote_acceptance` evidence link is LOCKABLE once the acceptance exists (AR704 has no
 *     draft state — always immutable);
 *   - every other owner/purpose (calculation_attachment / crm_document / job_evidence) is NOT
 *     a lock-family member (the file stays freely re-attachable/replaceable);
 *   - a locked file is ARCHIVABLE (the sanctioned `locked → archived` soft-delete); an
 *     already-archived/deleted (or an unlocked draft/linked) file is NOT in the locked-archive
 *     path.
 */

/** The owner/purpose pairs whose link locks once the parent commitment is frozen. */
const LOCKABLE_OWNER_PURPOSES: ReadonlyArray<{
  readonly ownerType: string;
  readonly purpose: string;
}> = [
  { ownerType: "quote_version", purpose: "quote_pdf" },
  { ownerType: "quote_version", purpose: "quote_attachment_snapshot" },
  { ownerType: "quote_acceptance", purpose: "acceptance_evidence" },
];

/** The parent lifecycle states that are NOT yet frozen (the link stays re-pointable). */
const UNFROZEN_PARENT_STATES: ReadonlySet<string> = new Set(["draft"]);

/** Input to {@link isFileLinkLockable} — the owner/purpose + the parent's lifecycle state. */
export interface FileLinkLockInput {
  readonly ownerType: string;
  readonly purpose: string;
  /**
   * The parent's lifecycle state:
   *   - a quote_version parent → its `status` (draft/sent/accepted/…);
   *   - a quote_acceptance parent → `committed` (it exists — AR704 has no draft state).
   */
  readonly parentState: string;
}

/**
 * True iff the file-link should be LOCKED given its owner/purpose + parent state. Mirrors
 * the DB `apply_file_link_lock` decision:
 *   - a lockable owner/purpose (quote PDF/attachment or acceptance evidence) whose parent is
 *     PAST the unfrozen state (a quote_version whose status <> 'draft', or an acceptance that
 *     exists — any non-'draft' parentState) → lockable;
 *   - a draft-parent quote link (the 6.3 preview-on-draft) → NOT lockable (stays re-pointable);
 *   - a non-lockable owner/purpose (crm_document / calculation_attachment / job_evidence) →
 *     NEVER lockable regardless of parent state.
 */
export function isFileLinkLockable(input: FileLinkLockInput): boolean {
  const isLockablePair = LOCKABLE_OWNER_PURPOSES.some(
    (p) => p.ownerType === input.ownerType && p.purpose === input.purpose,
  );
  if (!isLockablePair) return false;
  return !UNFROZEN_PARENT_STATES.has(input.parentState);
}

/**
 * True iff a file in `lifecycleState` is in the locked-archive path (a locked file MAY be
 * archived — the sanctioned `locked → archived` soft-delete, AC3). An already-archived /
 * deleted file is NOT re-archivable, and an unlocked (draft/linked) file follows a different
 * lifecycle rule (not the locked-archive path). Fail-closed: an unknown state is NOT archivable.
 */
export function isLockedFileArchivable(lifecycleState: string): boolean {
  return lifecycleState === "locked";
}
