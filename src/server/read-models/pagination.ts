/**
 * Small, RLS-neutral PostgREST pagination primitives.
 *
 * PostgREST applies its configured max-row cap to every request, including reads
 * which look unbounded in application code. Callers must therefore collect every
 * visible page before deriving a tenant projection; filtering a capped prefix is
 * not correct. This helper deliberately knows nothing about tables, tenants, or
 * authorization: callers retain their cookie-bound RLS client and predicates.
 */

/** Keep each request comfortably below the usual PostgREST max_rows ceiling. */
export const RLS_PAGE_SIZE = 500;

/** Keep `.in()` URLs and query-planner lists materially smaller than a read page. */
export const RLS_ID_BATCH_SIZE = 100;

export interface PageResult<T> {
  readonly data: T[] | null;
  readonly error: unknown | null;
}

export interface AllPagesResult<T> {
  readonly data: T[];
  readonly error: unknown | null;
}

/** Read every RLS-visible page, stopping only after a short final page. */
export async function readAllPages<T>(
  readPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<AllPagesResult<T>> {
  const rows: T[] = [];
  for (let from = 0; ; from += RLS_PAGE_SIZE) {
    const result = await readPage(from, from + RLS_PAGE_SIZE - 1);
    if (result.error !== null) return { data: [], error: result.error };
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < RLS_PAGE_SIZE) return { data: rows, error: null };
  }
}

/** Split a PostgREST `.in()` predicate into bounded, URL-safe groups. */
export function chunkValues<T>(values: readonly T[], chunkSize = RLS_ID_BATCH_SIZE): readonly T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < values.length; start += chunkSize) {
    chunks.push(values.slice(start, start + chunkSize));
  }
  return chunks;
}
