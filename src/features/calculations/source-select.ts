/**
 * PURE pricing-source SELECT-value helpers for the calc row editor (Story 5.3, Task 3.3).
 * I/O-free (no React, no DOM) so they run under the dependency-free `node --test` fast gate.
 *
 * The row editor encodes a chosen source as the `<select>` value `"<kind>:<id>"` (empty =
 * the "manual / no source" option). On submit the decoded pair becomes the hidden
 * `source_kind`/`source_id` fields the form parser reads; the server RE-RESOLVES + freezes
 * the source (the client value is never trusted for name/rate — only the id + kind).
 *
 * These helpers were extracted OUT of the `"use client"` `RowEditor.tsx` component precisely
 * so the `<select>`-value round-trip + the row-type→source mapping are unit-pinned at the
 * fast gate (JSX in a `.tsx` cannot be imported by the strip-types `node --test` runner).
 *
 * [Source: src/components/calculations/RowEditor.tsx (the row form that consumes these);
 *  src/features/calculations/source-options.ts (RowSourceLists/SourceOption); epics.md#Story
 *  5.3 AC1 (labor→work role) / AC2 (material→article).]
 */
import type {
  RowSourceLists,
  SourceOption,
} from "@/features/calculations/source-options";

/** The calc-row source kinds a `<select>` value can carry (labor→work_role, material→article). */
export type RowSourceKind = "work_role" | "article";

/** The empty (manual / no source) select value — an empty string (isPresent('')===false). */
export const MANUAL_SOURCE_VALUE = "";

/** A decoded source pick (or `null` for the manual option / any malformed value). */
export interface DecodedSource {
  readonly kind: RowSourceKind;
  readonly id: string;
}

/** Encode a source pick as the `<select>` value `"<kind>:<id>"` (empty = manual). */
export function encodeSourceValue(kind: RowSourceKind, id: string): string {
  return `${kind}:${id}`;
}

/**
 * Decode a `"<kind>:<id>"` select value into its pair (or `null` for the manual option / any
 * malformed value). Uses `indexOf(":")` (NOT a naive split) so the id is the WHOLE remainder
 * after the first colon — robust even if an id were to contain a colon. Rejects an empty
 * value, a value with no colon, a leading colon (empty kind), an unknown kind, or an empty id.
 */
export function decodeSourceValue(value: string): DecodedSource | null {
  if (value === MANUAL_SOURCE_VALUE) return null;
  const idx = value.indexOf(":");
  if (idx <= 0) return null; // no colon, or a leading colon (empty kind)
  const kind = value.slice(0, idx);
  const id = value.slice(idx + 1);
  if ((kind !== "work_role" && kind !== "article") || id.length === 0) return null;
  return { kind, id };
}

/**
 * The active source list offered for a given row_type (labor → work roles, material →
 * articles). Every OTHER row type is manual (no source offered) → an empty list.
 */
export function sourcesForRowType(
  rowType: string,
  sources: RowSourceLists,
): readonly SourceOption[] {
  if (rowType === "labor") return sources.workRoles;
  if (rowType === "material") return sources.articles;
  return []; // other row types stay manual (no source offered)
}

/** The source-kind a given row_type maps to (labor → work_role, material → article; else null). */
export function kindForRowType(rowType: string): RowSourceKind | null {
  if (rowType === "labor") return "work_role";
  if (rowType === "material") return "article";
  return null;
}
