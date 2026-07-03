/**
 * PURE ordering helpers (Story 5.2, Task 2.3 / AC2) — the ordering CONTRACT extracted as
 * pure functions so it is unit-testable (5.2-UNIT-02), NOT inline island state. Each helper
 * produces the new ordered-id ARRAY the atomic Story 5.1 `reorderRows`/`reorderSections`
 * command consumes (`ordered_row_ids` / `ordered_section_ids`). The ACTUAL persistence is
 * the server-owned atomic reorder RPC — this module never persists, it only computes the
 * order the command is handed (R-503: no client loop of single UPDATEs as the consistency
 * boundary).
 *
 * PURE / I/O-free (runs on `node --test`). Operates on plain id arrays; the caller maps its
 * section/row model to ids, applies a helper, and sends the result to the reorder command.
 */

/** Append a new id at the END of the current order (create → append). */
export function appendId(
  currentOrder: readonly string[],
  newId: string,
): string[] {
  return [...currentOrder, newId];
}

/**
 * Move the id at `index` one position toward the FRONT (move-up). A no-op when the id is
 * already first or the index is out of range. Returns a fresh array (never mutates input).
 */
export function moveUp(currentOrder: readonly string[], index: number): string[] {
  const next = [...currentOrder];
  if (index <= 0 || index >= next.length) return next;
  const tmp = next[index - 1];
  next[index - 1] = next[index];
  next[index] = tmp;
  return next;
}

/**
 * Move the id at `index` one position toward the END (move-down). A no-op when the id is
 * already last or the index is out of range. Returns a fresh array (never mutates input).
 */
export function moveDown(currentOrder: readonly string[], index: number): string[] {
  const next = [...currentOrder];
  if (index < 0 || index >= next.length - 1) return next;
  const tmp = next[index + 1];
  next[index + 1] = next[index];
  next[index] = tmp;
  return next;
}

/**
 * Remove an id from the order (delete/archive) and RE-SEQUENCE (the surviving ids keep
 * their relative order, contiguous). Returns a fresh array; a missing id is a no-op copy.
 */
export function removeId(
  currentOrder: readonly string[],
  removedId: string,
): string[] {
  return currentOrder.filter((id) => id !== removedId);
}

/**
 * Reorder to an EXPLICIT target position: move the id currently at `fromIndex` to
 * `toIndex`, shifting the rest. A no-op when either index is out of range. Returns a fresh
 * array. (Used by an explicit "move to position N" control; move-up/down are the common
 * verbs but a general reorder is available for a drag-to-position affordance.)
 */
export function reorderTo(
  currentOrder: readonly string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  const next = [...currentOrder];
  if (
    fromIndex < 0 ||
    fromIndex >= next.length ||
    toIndex < 0 ||
    toIndex >= next.length
  ) {
    return next;
  }
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/**
 * Build the ordered-id array a reorder command consumes from an ordered list of items that
 * carry an `id`. A thin helper so the island maps its model to `ordered_*_ids` without an
 * inline `.map` scattered through the component.
 */
export function toOrderedIds(
  items: ReadonlyArray<{ readonly id: string }>,
): string[] {
  return items.map((item) => item.id);
}
