/**
 * PURE limited-file-index DECISION logic (Story 8.5, Task 1.4; architecture §14, R-816).
 *
 * The owner-category map + the client search/filter predicate + the forbidden-deferred-category
 * guard the limited `Filer` index (`FileIndexList`) relies on — extracted OUT of the `"use client"`
 * island into a plain `.ts` (NO React/DOM/`"use client"`/`next/*` import) so the fast strip-types
 * `node --test` gate covers every branch (the coverage-shape lesson — a helper trapped in a `.tsx`
 * is vacuous-green).
 *
 * SCOPE DISCIPLINE (R-816 — the 8.5 STOP): the index is a LIMITED Phase-A list, NEVER a broad
 * document center. The owner-category map covers EXACTLY the seven Phase A owner types and maps NO
 * deferred module; the filter is a flat name/type/category narrowing (no cross-module analytics, no
 * document-library grouping). The forbidden-deferred-category deny-list encodes the STOP boundary
 * as a pure allow-list check so a drift toward a deferred grouping fails loud.
 *
 * [Source: story 8.5 AC1 + Task 1.3/1.4/3.3; test-design-epic-8.md#R-816;
 *  src/server/commands/files/validation.ts (OWNER_TYPES — the map domain);
 *  src/components/jobs/JobList.tsx (the in-memory useMemo filter to mirror)]
 */

/** A display-safe file-index row (NO object_path/bucket_id — R-810). The pure filter operates over it. */
export interface FileIndexRow {
  readonly linkId: string;
  readonly fileId: string;
  readonly ownerType: string;
  readonly ownerId: string;
  readonly displayName: string;
  readonly mimeType: string | null;
  readonly sizeBytes: number | null;
  readonly ownerCategory: string;
  readonly createdAt: string;
}

/**
 * The Swedish OWNER-CATEGORY label per Phase A owner type — a FIXED map over the closed Phase A
 * owner set ONLY (the seven owner types the DB CHECK enumerates), never a deferred module. Every
 * key is a legitimate Phase A owner; a lookup for a deferred/unknown owner type returns null.
 */
const OWNER_CATEGORY_LABELS: Readonly<Record<string, string>> = {
  customer: "Kund",
  facility: "Anläggning",
  contact: "Kontakt",
  calculation: "Kalkyl",
  quote_version: "Offert",
  quote_acceptance: "Acceptans",
  job: "Jobb",
};

/** The seven Phase A owner categories, in display order — the ONLY grouping/filter options (R-816). */
export const OWNER_CATEGORY_ORDER: readonly string[] = [
  "customer",
  "facility",
  "contact",
  "calculation",
  "quote_version",
  "quote_acceptance",
  "job",
];

/**
 * Map an owner_type to its Swedish Phase A category label. Returns null for a DEFERRED / unknown
 * owner type (supplier/asset/rental/hr/… ) — the index can NEVER fabricate a deferred grouping
 * (R-816 STOP). Fail-closed: an unrecognized owner type is not a listable category.
 */
export function ownerCategoryLabel(ownerType: string): string | null {
  return OWNER_CATEGORY_LABELS[ownerType] ?? null;
}

// The forbidden deferred-module deny-list (the R-816 STOP encoded as a deny-list) lives in a SEPARATE
// module (`deferred-categories.ts`) so the source-token guardrail (`file-index-non-scope.test.ts`,
// which scans THIS file + `FileIndexList.tsx`) does not trip on the deny-list's own tokens. Re-exported
// here so callers/tests import the single `@/features/files/file-index` surface.
export {
  FORBIDDEN_DEFERRED_CATEGORIES,
  isForbiddenDeferredCategory,
} from "./deferred-categories";

/** The client filter over the server-fetched rows: an optional name/type substring + a category equality. */
export interface FileIndexFilter {
  readonly search?: string;
  readonly ownerCategory?: string;
}

/**
 * Narrow the tenant-scoped rows in-memory (mirrors JobList's `useMemo` narrowing — the thin Phase-A
 * index pattern). A `search` matches the display name OR the mime/type substring (case-insensitive);
 * an `ownerCategory` is an owner_type equality filter. An empty filter returns every row (identity).
 *
 * PURE — no DB, no DOM, no wall clock — so `node --test` covers every branch.
 */
export function filterFileIndexRows(
  rows: readonly FileIndexRow[],
  filter: FileIndexFilter,
): FileIndexRow[] {
  const search = (filter.search ?? "").trim().toLowerCase();
  const ownerCategory = (filter.ownerCategory ?? "").trim();
  return rows.filter((r) => {
    if (ownerCategory && r.ownerType !== ownerCategory) return false;
    if (search) {
      const name = (r.displayName ?? "").toLowerCase();
      const type = (r.mimeType ?? "").toLowerCase();
      if (!name.includes(search) && !type.includes(search)) return false;
    }
    return true;
  });
}
