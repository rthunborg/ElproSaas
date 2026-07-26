/**
 * The forbidden deferred-module category deny-list (Story 8.5, R-816) — kept in a SEPARATE module
 * from `file-index.ts`/`FileIndexList.tsx` so the source-token guardrail
 * (`tests/unit/guardrails/file-index-non-scope.test.ts`, which scans those two index surfaces for
 * deferred-module tokens) does not trip on the deny-list's own tokens. This module is NOT scanned by
 * that guardrail; the deny-list is the R-816 STOP encoded as a pure allow-list check that the index
 * consults (via a re-export) — the limited `Filer` index can NEVER surface any of these as a
 * grouping / filter option (each is a deferred module whose file surface is out of Phase A scope).
 *
 * STORY 10.1 (ADR-B003 §5.3, derivation 1): this deny-list is no longer AUTHORED — it is DERIVED
 * from the scope manifest's `pending` modules' file-index deferred tokens (the union of every
 * `deferredFileToken`). This collapses one of the four independently-authored scope copies into the
 * single manifest source (the Epic 9 retro drift theme). The derived set is proven byte-equal to the
 * previously-authored 7 tokens against a PINNED literal (non-circular) in
 * `tests/unit/scope/manifest-derivations.test.ts`; the LIVE consumer scan
 * (`tests/unit/docs/acceptance-gate-report-validators.test.ts`, which imports this constant) stays
 * green transitively. When a deferred module's epic activates it (flips `pending → active`), its
 * token drops out of this derivation automatically — the FR129 same-PR activation guarantee.
 */
import { SCOPE_MANIFEST } from "@/scope/manifest";
import { deferredFileTokensFromManifest } from "@/scope/manifest-schema";

/**
 * The forbidden deferred-module categories (Fortnox, supplier, assets, rentals, HR, DoU, tender/FKU
 * = `upphandling`). Lowercase bare tokens; the index consults `isForbiddenDeferredCategory`. DERIVED
 * from the manifest's pending modules (Story 10.1) — equal to the 7 long-authored tokens, no drift.
 */
export const FORBIDDEN_DEFERRED_CATEGORIES: readonly string[] =
  deferredFileTokensFromManifest(SCOPE_MANIFEST);

/** True iff `category` is a forbidden deferred-module grouping (never allowed in the limited index). */
export function isForbiddenDeferredCategory(category: string): boolean {
  return FORBIDDEN_DEFERRED_CATEGORIES.includes(category.toLowerCase());
}
