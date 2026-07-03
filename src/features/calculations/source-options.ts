/**
 * PURE mapping of the ACTIVE pricing-source lists into the calc row editor's selection
 * options (Story 5.3, Task 3.2). I/O-free so it is exhaustively unit-testable.
 *
 * The editor offers a WORK-ROLE source on a labor row and an ARTICLE source on a material
 * row. Each option carries the id (submitted as `source_id`), the display name (the option
 * label + the provenance line), and the öre PRICE the selection PREFILLS into the row's
 * kronor price input (work role → SELL rate; article → unit price). The prefill flows
 * through the SAME `oreToKronorString` boundary the editor already uses — no inline money
 * math here (R-505). The price is a UX prefill only; the row's `unit_sell_ore` stays
 * authoritative and the source is RE-RESOLVED + frozen server-side (the client value is
 * never trusted).
 *
 * [Source: src/features/pricing/read.ts (readWorkRoles/readArticles); epics.md#Story 5.3
 *  AC1/AC2; ux-design-specification.md#5 (source-based rows).]
 */
import type { ArticleRow, WorkRoleRow } from "@/features/pricing/read";

/** One selectable pricing source (a work role OR an article). */
export interface SourceOption {
  /** The source row id — submitted as `source_id`. */
  readonly id: string;
  /** The display name — the `<option>` label + the provenance line. */
  readonly name: string;
  /** The öre price this option prefills into the row's kronor price input. */
  readonly priceOre: number;
}

/** The ACTIVE source lists the editor offers (work roles for labor, articles for material). */
export interface RowSourceLists {
  readonly workRoles: readonly SourceOption[];
  readonly articles: readonly SourceOption[];
}

/** Map the ACTIVE work-role rows into labor-source options (SELL rate prefills the price). */
export function workRoleOptions(
  rows: readonly WorkRoleRow[],
): readonly SourceOption[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.display_name,
    priceOre: r.sell_rate_ore,
  }));
}

/** Map the ACTIVE article rows into material-source options (unit price prefills). */
export function articleOptions(
  rows: readonly ArticleRow[],
): readonly SourceOption[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    priceOre: r.unit_price_ore,
  }));
}

/** Assemble both ACTIVE source lists from the pricing reads (server → client island props). */
export function toSourceOptions(
  workRoles: readonly WorkRoleRow[],
  articles: readonly ArticleRow[],
): RowSourceLists {
  return {
    workRoles: workRoleOptions(workRoles),
    articles: articleOptions(articles),
  };
}
