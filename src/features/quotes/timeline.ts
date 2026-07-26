/**
 * PURE quote-version timeline ordering + current-version selection (Story 6.2, Task 1.4 /
 * 6.2-UNIT-02). Framework-agnostic, no I/O, no JSX — EXTRACTED into a sibling `.ts` (never
 * buried in a `"use client"` `.tsx`) so it runs under the `node --test` fast gate (the
 * JSX-can't-import-into-node:test coverage-shape lesson from the epic-5/6 retro).
 *
 * The three rules pinned by 6.2-UNIT-02:
 *   1. ORDER the timeline by `version_number` ascending (the version history order).
 *   2. Resolve the "current commitment" version = the LATEST sent/accepted version, else
 *      the LATEST draft (a customer's real current commitment is the last thing they were
 *      shown/accepted; before any send it is the working draft).
 *   3. Resolve the SELECTED version by id when supplied (and own to the timeline), else
 *      default to the LATEST version.
 *
 * These are presentation-selection helpers ONLY — they never recompute money/VAT/totals
 * (those are read VERBATIM from the frozen snapshot rows; R-616) and never mutate a version.
 * [Source: test-design-epic-6.md#6.2-UNIT-02; architecture.md#4/#11; story Task 1.4/2.4]
 */

/** The closed set of quote-version lifecycle statuses (mirrors the 6.1 schema check + the 10.2 `lost` token). */
export type QuoteVersionStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "superseded"
  | "lost";

/** The minimal per-version shape the timeline logic needs (a subset of the read row). */
export interface TimelineVersion {
  readonly id: string;
  readonly versionNumber: number;
  readonly status: QuoteVersionStatus;
}

/** A version's status counts as a "commitment" once it has been sent (or accepted). */
function isCommitment(status: QuoteVersionStatus): boolean {
  return status === "sent" || status === "accepted";
}

/**
 * Order versions by `version_number` ASCENDING (the timeline order). Returns a NEW sorted
 * array — never mutates the input. A stable numeric compare (no NaN surprises: the caller's
 * read boundary already coerced `version_number` to a number).
 */
export function orderVersionsByNumber<T extends TimelineVersion>(
  versions: readonly T[],
): T[] {
  return [...versions].sort((a, b) => a.versionNumber - b.versionNumber);
}

/**
 * The LATEST version by `version_number` (the highest number), or null when empty. The
 * default the detail page selects when no explicit version id is supplied.
 */
export function latestVersion<T extends TimelineVersion>(
  versions: readonly T[],
): T | null {
  if (versions.length === 0) return null;
  return orderVersionsByNumber(versions)[versions.length - 1] ?? null;
}

/**
 * The "current commitment" version — the LATEST sent/accepted version, else the LATEST
 * (highest-numbered) version of any status (a pre-send quote's commitment is its working
 * draft). Null only when there are no versions at all.
 */
export function currentCommitmentVersion<T extends TimelineVersion>(
  versions: readonly T[],
): T | null {
  if (versions.length === 0) return null;
  const ordered = orderVersionsByNumber(versions);
  // Walk from the highest number down; the first commitment wins.
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const v = ordered[i];
    if (v && isCommitment(v.status)) return v;
  }
  // No sent/accepted version → the latest (working) version is the commitment.
  return ordered[ordered.length - 1] ?? null;
}

/**
 * Resolve the SELECTED version: the version whose id matches `selectedVersionId` when it is
 * supplied AND belongs to the timeline, else the LATEST version (the page default). Returns
 * null only for an empty timeline. A supplied id that is NOT in the timeline (foreign / gone)
 * falls back to the latest — the page never leaks that the id belongs to another tenant.
 */
export function resolveSelectedVersion<T extends TimelineVersion>(
  versions: readonly T[],
  selectedVersionId?: string | null,
): T | null {
  if (versions.length === 0) return null;
  if (selectedVersionId) {
    const match = versions.find((v) => v.id === selectedVersionId);
    if (match) return match;
  }
  return latestVersion(versions);
}
