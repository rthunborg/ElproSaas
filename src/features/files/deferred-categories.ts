/**
 * The forbidden deferred-module category deny-list (Story 8.5, R-816) — kept in a SEPARATE module
 * from `file-index.ts`/`FileIndexList.tsx` so the source-token guardrail
 * (`tests/unit/guardrails/file-index-non-scope.test.ts`, which scans those two index surfaces for
 * deferred-module tokens) does not trip on the deny-list's own tokens. This module is NOT scanned by
 * that guardrail; the deny-list is the R-816 STOP encoded as a pure allow-list check that the index
 * consults (via a re-export) — the limited `Filer` index can NEVER surface any of these as a
 * grouping / filter option (each is a deferred module whose file surface is out of Phase A scope).
 */

/**
 * The forbidden deferred-module categories (Fortnox, supplier, assets, rentals, HR, DoU automation,
 * tender/FKU). Lowercase bare tokens; the index consults `isForbiddenDeferredCategory`.
 */
export const FORBIDDEN_DEFERRED_CATEGORIES: readonly string[] = [
  "fortnox",
  "supplier",
  "asset",
  "rental",
  "hr",
  "dou",
  "upphandling",
];

/** True iff `category` is a forbidden deferred-module grouping (never allowed in the limited index). */
export function isForbiddenDeferredCategory(category: string): boolean {
  return FORBIDDEN_DEFERRED_CATEGORIES.includes(category.toLowerCase());
}
