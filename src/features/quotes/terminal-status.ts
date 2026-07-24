import type { QuoteVersionStatus } from "./timeline";

/**
 * The TERMINAL (decided) latest-version statuses whose OPEN follow-up must stop escalating **everywhere
 * it is surfaced** — the `/quotes` list flags (`read.ts`), the pipeline aggregate counts
 * (`quote-pipeline-aggregate.ts`), AND the quote-detail header chip (`QuoteDetailView`). This is the
 * SINGLE SOURCE so those surfaces can never drift (integration review F3 — the detail chip previously
 * kept showing an open follow-up on an accepted/lost quote where the panel that could clear it does not
 * render).
 *
 * Derived from the `QuoteVersionStatus` domain: a deal is dead (no longer worth chasing) once its LATEST
 * version is `accepted`, `lost`, `rejected`, or `expired`. `superseded` is intentionally EXCLUDED — a
 * superseded version always has a higher-numbered successor, so it is never a quote's LATEST version.
 *
 * Dependency-free (a Set of string literals + a pure guard) so it is safe to import into a client
 * component as well as the server read paths.
 */
export const LATEST_DECIDED_STATUSES: ReadonlySet<QuoteVersionStatus> = new Set([
  "accepted",
  "lost",
  "rejected",
  "expired",
]);

/** True when `status` is a terminal/decided LATEST-version status. Accepts null/undefined/any string. */
export function isLatestDecidedStatus(
  status: QuoteVersionStatus | string | null | undefined,
): boolean {
  return status != null && (LATEST_DECIDED_STATUSES as ReadonlySet<string>).has(status);
}
