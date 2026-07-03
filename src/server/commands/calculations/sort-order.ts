/**
 * Server-owned sort_order helper (Story 5.1, Task 3).
 *
 * A new section/row is APPENDED after its existing siblings: its `sort_order` is
 * `max(existing sibling sort_order) + 1` (0 when there are none). The SERVER owns the
 * ordering — the client never supplies a sort_order (architecture §5; the reorder RPC
 * owns bulk reordering). This reads the siblings under the caller's RLS via the
 * request-bound client (own-tenant only), so it can never observe a foreign parent's
 * rows.
 *
 * It uses the narrow envelope read surface (`.from().select().eq().limit()`) and
 * computes the max in JS — a bounded read (LIMIT) sufficient for Phase A calc sizes;
 * ordering integrity is a UX nicety here, not a correctness invariant (the composite FK
 * + RLS are the isolation guards).
 */
import type { CommandDbClient } from "../envelope";

/** How many sibling rows to scan for the current max sort_order (bounded read). */
const MAX_SIBLING_SCAN = 10000;

/**
 * Return the next `sort_order` for a child appended under `parentColumn = parentId` in
 * `table`, scoped to the caller's RLS. `max(sort_order) + 1`, or 0 when no siblings.
 */
export async function nextSortOrder(
  db: CommandDbClient,
  table: string,
  parentColumn: string,
  parentId: string,
): Promise<number> {
  const { data, error } = await db
    .from(table)
    .select("sort_order")
    .eq(parentColumn, parentId)
    .limit(MAX_SIBLING_SCAN);
  // A read error here is transient — let the caller's execute surface it (a throw maps
  // to SERVER_ERROR). Defensive: on no rows / null data, start at 0.
  if (error) {
    throw new Error("nextSortOrder: sibling read failed");
  }
  if (!data || data.length === 0) return 0;
  let max = -1;
  for (const row of data) {
    const so = (row as { sort_order?: unknown }).sort_order;
    if (typeof so === "number" && Number.isFinite(so) && so > max) {
      max = so;
    }
  }
  return max + 1;
}
