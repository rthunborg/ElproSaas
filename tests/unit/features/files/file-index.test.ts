/**
 * Story 8.5 — 8.5-UNIT-01 (P1 fast gate, AC1; R-816): PURE branch coverage for the limited-index
 * DECISION logic extracted OUT of the `"use client"` island (the coverage-shape lesson — a helper in a
 * `.tsx` cannot be imported by the strip-types `node --test` runner). The `FileIndexList` island's
 * owner-category mapping, its search/filter narrowing, and the forbidden-deferred-category guard list
 * are pinned here so they stay correct and testable WITHOUT a DB or a browser.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * RED PHASE (ATDD) — the whole suite is `describe.skip`. The pure module `src/features/files/file-index.ts`
 * does NOT exist yet — Story 8.5 Task 1.4 EXTRACTS the owner-category map + the search/filter predicate +
 * the forbidden-deferred-category guard into it. Remove `describe.skip` in dev-story green phase. If dev
 * names the helpers/module differently, update the import + the call sites. The module under test MUST be
 * a plain `.ts` with NO `next/*` / `"use client"` import so the strip-types runner resolves it (the
 * coverage-shape trap — a helper trapped in a `.tsx` is vacuous-green).
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Runner: `node --test` (`pnpm run test:unit`) — PURE, NO DB, NO PII, NO clock, NO JSX.
 *
 * Branches pinned (the limited-index decision table):
 *   - the owner-category map covers EXACTLY the seven ACTIVE Phase A owner types and maps each to its
 *     Swedish label (Kund/Anläggning/Kontakt/Kalkyl/Offert/Acceptans/Jobb) — and NO deferred module;
 *   - the client search/filter predicate narrows correctly: a name substring match, a type substring
 *     match, and an owner-category equality filter (mirrors JobList's in-memory useMemo narrowing);
 *   - the forbidden-deferred-category guard list is EXHAUSTIVE — the index can never surface a deferred
 *     grouping (the R-816 STOP encoded as a pure allow-list/deny-list check).
 *
 * [Source: story 8.5 AC1 + Task 1.3/1.4/3.3; test-design-epic-8.md#R-816 (index scope, the 8.5 STOP);
 *  src/server/commands/files/validation.ts (ACTIVE_OWNER_TYPES — the single source of truth for the map
 *  domain); src/components/jobs/JobList.tsx (the in-memory useMemo filter to mirror);
 *  tests/unit/features/files/file-lock-predicate.test.ts (the pure-predicate unit template);
 *  intended module src/features/files/file-index.ts]
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ACTIVE_OWNER_TYPES } from "@/server/commands/files/validation";

// RED PHASE: the pure index helpers do not exist yet (Story 8.5 Task 1.4 extracts them to a pure
// sibling `src/features/files/file-index.ts`). A STATIC import of a not-yet-existing module fails at
// MODULE-LOAD even under `describe.skip` (the strip-types runner resolves top-level imports before the
// skip takes effect — the runner-glob trap). So the green-phase import is documented here and the
// helpers are typed local stubs that THROW — the suite is `describe.skip`, so the stubs are never
// invoked. On green, DELETE the stub block and uncomment the real import below; align the export names
// with the landed module (dev's choice); the assertions are unchanged.
//
//   import {
//     ownerCategoryLabel,
//     filterFileIndexRows,
//     FORBIDDEN_DEFERRED_CATEGORIES,
//     type FileIndexRow,
//   } from "@/features/files/file-index";
//
interface FileIndexRow {
  readonly linkId: string;
  readonly fileId: string;
  readonly ownerType: string;
  readonly ownerId: string;
  readonly displayName: string;
  readonly mimeType: string | null;
  readonly sizeBytes: number | null;
  readonly createdAt: string;
}
const NOT_YET = "8.5 file-index pure helpers not implemented yet (red phase)";
const ownerCategoryLabel = (_ownerType: string): string | null => {
  throw new Error(NOT_YET);
};
const filterFileIndexRows = (
  _rows: readonly FileIndexRow[],
  _filter: { search?: string; ownerCategory?: string },
): FileIndexRow[] => {
  throw new Error(NOT_YET);
};
const FORBIDDEN_DEFERRED_CATEGORIES: readonly string[] = [];

/** A minimal display-safe row shape the pure filter operates over (NO object_path/bucket_id — R-810). */
function row(partial: Partial<FileIndexRow>): FileIndexRow {
  return {
    linkId: crypto.randomUUID(),
    fileId: crypto.randomUUID(),
    ownerType: "customer",
    ownerId: crypto.randomUUID(),
    displayName: "fil.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1234,
    createdAt: "2026-07-13T09:00:00.000Z",
    ...partial,
  } as FileIndexRow;
}

describe.skip("8.5-UNIT-01: limited file-index pure DECISION logic (owner-category map + filter + guard) (AC1, R-816)", () => {
  test("ownerCategoryLabel: maps EXACTLY the seven ACTIVE owner types to their Swedish labels", () => {
    const expected: Record<string, string> = {
      customer: "Kund",
      facility: "Anläggning",
      contact: "Kontakt",
      calculation: "Kalkyl",
      quote_version: "Offert",
      quote_acceptance: "Acceptans",
      job: "Jobb",
    };
    // Every Phase A owner type the index lists has a label (the map domain is exactly the index set).
    for (const ot of Object.keys(expected)) {
      assert.equal(ownerCategoryLabel(ot), expected[ot], `owner_type='${ot}' → '${expected[ot]}'`);
    }
    // Every ACTIVE command-layer owner type is covered by the map (no gap for a listable owner).
    for (const ot of ACTIVE_OWNER_TYPES) {
      assert.ok(ownerCategoryLabel(ot), `ACTIVE owner_type='${ot}' has a category label`);
    }
  });

  test("ownerCategoryLabel: a DEFERRED-module owner type maps to NO Phase A category (never a deferred grouping)", () => {
    for (const deferred of ["supplier", "asset", "rental", "hr_document"]) {
      // A deferred owner type is not a listable category — the label maps to null/undefined, never a
      // fabricated deferred grouping (the R-816 STOP: the index cannot surface a deferred module).
      assert.equal(
        Boolean(ownerCategoryLabel(deferred)) &&
          !FORBIDDEN_DEFERRED_CATEGORIES.includes(deferred),
        false,
        `deferred owner_type='${deferred}' must NOT produce a Phase A category label`,
      );
    }
  });

  test("filterFileIndexRows: a NAME substring narrows the set", () => {
    const rows = [
      row({ displayName: "offert-april.pdf" }),
      row({ displayName: "kalkyl-2026.xlsx" }),
    ];
    const out = filterFileIndexRows(rows, { search: "offert" });
    assert.equal(out.length, 1);
    assert.equal(out[0]?.displayName, "offert-april.pdf");
  });

  test("filterFileIndexRows: a TYPE substring narrows the set (mime/type match)", () => {
    const rows = [
      row({ displayName: "a.pdf", mimeType: "application/pdf" }),
      row({ displayName: "b.png", mimeType: "image/png" }),
    ];
    const out = filterFileIndexRows(rows, { search: "png" });
    assert.equal(out.length, 1);
    assert.equal(out[0]?.mimeType, "image/png");
  });

  test("filterFileIndexRows: an owner-CATEGORY equality filter narrows to one category", () => {
    const rows = [
      row({ ownerType: "customer" }),
      row({ ownerType: "job" }),
      row({ ownerType: "calculation" }),
    ];
    const out = filterFileIndexRows(rows, { ownerCategory: "job" });
    assert.equal(out.length, 1);
    assert.equal(out[0]?.ownerType, "job");
  });

  test("filterFileIndexRows: an EMPTY filter returns every row (identity narrowing)", () => {
    const rows = [row({}), row({}), row({})];
    assert.equal(filterFileIndexRows(rows, {}).length, 3);
  });

  test("FORBIDDEN_DEFERRED_CATEGORIES: the guard list is exhaustive — every known deferred module is denied", () => {
    // The index can NEVER surface any of these as a grouping (the R-816 STOP encoded as a deny-list).
    for (const deferred of ["fortnox", "supplier", "asset", "rental", "hr", "dou", "upphandling"]) {
      assert.equal(
        FORBIDDEN_DEFERRED_CATEGORIES.includes(deferred),
        true,
        `the forbidden-deferred-category guard must include "${deferred}" (R-816 exhaustive deny-list)`,
      );
    }
  });
});
