/**
 * Story 8.4 — 8.4-UNIT-01 (P0 fast gate, R-822): PURE branch coverage for the client-safe lock
 * DECISION predicates extracted OUT of any `"use client"` component (the coverage-shape lesson —
 * a helper in a `.tsx` cannot be imported by the strip-types `node --test` runner). The 8.2/8.3
 * `EntityFilePanel` disabling a "replace/delete" affordance on a locked file is UX ONLY — NEVER the
 * guarantee (the command + DB trigger are). This test pins the predicate branches so the panel's
 * disabled state stays correct and testable without a DB.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * RED PHASE (ATDD) — the whole suite is `describe.skip`. The predicates `isFileLinkLockable` /
 * `isLockedFileArchivable` do not exist yet — Story 8.4 Task 5.1 EXTRACTS them to a pure sibling
 * `src/features/files/lock-predicates.ts` (or `src/server/storage/lifecycle.ts`). Remove `.skip` in
 * dev-story green phase. If dev names the helper/module differently, update the import + the two calls.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Runner: `node --test` (`pnpm run test:unit`) — PURE, NO DB, NO PII, NO clock, NO JSX. The module
 * under test must be a plain `.ts` with NO `next/*` or `"use client"` import so the strip-types runner
 * resolves it (the coverage-shape trap — a helper trapped in a `.tsx` is vacuous-green).
 *
 * Branches pinned (the lock-state decision table — mirrors the golden fixture):
 *   - draft-parent quote_version PDF/attachment link => NOT lockable (the 6.3 preview-on-draft stays
 *     re-pointable);
 *   - sent/accepted-parent quote_version PDF/attachment link => lockable;
 *   - committed quote_acceptance evidence link => lockable (AR704 has no draft state);
 *   - a non-lockable owner/purpose (e.g. crm_document) => NOT lockable regardless of parent state;
 *   - a locked file is archivable (locked => archived) but an ALREADY-archived/deleted file is NOT
 *     re-lockable/re-archivable (guard the transition — never force archived/deleted back to locked).
 *
 * [Source: story 8.4 Task 5.1 + AC1-AC4; project-context.md#171 (coverage-shape: pull lock DECISION
 *  logic OUT of `.tsx` into a pure `.ts`); tests/fixtures/golden/files/file-lock-lifecycle.json (the
 *  same decision table as a fixture oracle); intended helper src/features/files/lock-predicates.ts]
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
// GREEN (Story 8.4 dev): the predicates now exist in the pure sibling
// `src/features/files/lock-predicates.ts` (Task 5.1) — imported for real.
import {
  isFileLinkLockable,
  isLockedFileArchivable,
} from "@/features/files/lock-predicates";

describe("8.4-UNIT-01: file-link lock DECISION predicates (pure, client-safe) (R-822)", () => {
  test("isFileLinkLockable: a DRAFT-parent quote_version PDF/attachment link is NOT lockable", () => {
    assert.equal(
      isFileLinkLockable({ ownerType: "quote_version", purpose: "quote_pdf", parentState: "draft" }),
      false,
    );
    assert.equal(
      isFileLinkLockable({
        ownerType: "quote_version",
        purpose: "quote_attachment_snapshot",
        parentState: "draft",
      }),
      false,
    );
  });

  test("isFileLinkLockable: a SENT/ACCEPTED-parent quote_version PDF/attachment link IS lockable", () => {
    for (const parentState of ["sent", "accepted"]) {
      assert.equal(
        isFileLinkLockable({ ownerType: "quote_version", purpose: "quote_pdf", parentState }),
        true,
        `parentState='${parentState}' => lockable`,
      );
      assert.equal(
        isFileLinkLockable({
          ownerType: "quote_version",
          purpose: "quote_attachment_snapshot",
          parentState,
        }),
        true,
      );
    }
  });

  test("isFileLinkLockable: a committed quote_acceptance evidence link IS lockable (AR704 has no draft state)", () => {
    assert.equal(
      isFileLinkLockable({
        ownerType: "quote_acceptance",
        purpose: "acceptance_evidence",
        parentState: "committed",
      }),
      true,
    );
  });

  test("isFileLinkLockable: a non-lockable owner/purpose (crm_document) is NOT lockable regardless of parent state", () => {
    assert.equal(
      isFileLinkLockable({ ownerType: "customer", purpose: "crm_document", parentState: "sent" }),
      false,
    );
  });

  test("isLockedFileArchivable: a locked file IS archivable (locked => archived); an archived/deleted file is NOT", () => {
    assert.equal(isLockedFileArchivable("locked"), true);
    assert.equal(isLockedFileArchivable("archived"), false);
    assert.equal(isLockedFileArchivable("deleted"), false);
    // A draft/linked (unlocked) file is not in the locked-archive path (a different lifecycle rule).
    assert.equal(isLockedFileArchivable("draft"), false);
  });
});
