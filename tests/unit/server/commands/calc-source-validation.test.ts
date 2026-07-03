/**
 * Story 5.3 — ATDD RED-PHASE scaffold: PURE source-PAIR validation (AC1/AC2/AC4, P1/P2
 * UNIT — R-504/R-502; test-design-epic-5.md 5.1-UNIT-01 style).
 *
 * Pins the load-bearing source-selection VALIDATION contract WITHOUT a DB or a browser,
 * mirroring `tests/unit/server/commands/calc-validation.test.ts`. The caller supplies ONLY
 * `{ source_kind, source_id }` (never the captured name/rate/version — those are RESOLVED
 * server-side, never trusted from the client). The validator's job:
 *   - BOTH-OR-NEITHER: a `source_id` with no `source_kind` (and vice-versa) → VALIDATION_FAILED;
 *   - a `source_kind` outside the closed `{work_role, article}` calc-row subset → rejected;
 *   - a non-UUID `source_id` → rejected;
 *   - a both-present valid pair → ACCEPTED (and the narrowed data carries the pair);
 *   - a both-ABSENT (manual/free-text) row → ACCEPTED (source selection is OPTIONAL);
 *   - `isPresent('')===false`: an EMPTY-STRING source_id/source_kind is treated as ABSENT
 *     (dropped — a manual row), NOT a validation error (epic-5 retro PINNED convention);
 *   - a rejection is the `VALIDATION_FAILED` shape and NEVER echoes the raw invalid value.
 *
 * ── WHY THE SOURCE-PAIR TESTS ARE `{ skip: true }` (RED PHASE) ────────────────────
 * `validateCreateRow`/`validateUpdateRow` EXIST and are green (Story 5.1), but they do NOT
 * yet know the `source_kind`/`source_id` pair (Story 5.3 dev Task 2.1). Today they neither
 * reject a lone `source_kind` (both-or-neither) nor carry the pair on the accepted data, so
 * these assertions FAIL until the dev phase extends the validators. `node --test` has no
 * `describe.skip`, so each NEW source-pair test is gated with the `{ skip: true }` option;
 * the dev phase removes those options in the SAME green run (the lingering-skip trap).
 *
 * The two GUARD tests at the top (real validators reachable; a manual row with no source
 * is accepted TODAY) run UNSKIPPED — they document the inherited baseline the source rules
 * extend and confirm this file imports the real surface.
 *
 * ── GREEN-PHASE HAND-OFF (Story 5.3 dev) ─────────────────────────────────────────
 *   1. Extend `CreateRowInput`/`UpdateRowInput` + `validateCreateRow`/`validateUpdateRow`
 *      with the optional `source_kind: 'work_role'|'article'` + `source_id` (UUID) pair,
 *      both-or-neither, `isPresent('')===false` respected (Task 2.1).
 *   2. Delete the `{ skip: true }` option on each source-pair test below.
 *   3. Keep the assertions — they are the CONTRACT (both-or-neither; closed kind; UUID id;
 *      manual stays first-class; raw value never echoed).
 *
 * Pure logic, no I/O — runs under the dependency-free `node --test` runner
 * (`pnpm run test:unit`), the fast gate protecting validation on every PR.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateCreateRow,
  validateUpdateRow,
} from "@/server/commands/calculations/validation";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const ROW_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_ID = "33333333-3333-4333-8333-333333333333";

function baseRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    section_id: SECTION_ID,
    row_type: "labor",
    quantity: 1.5,
    unit: "h",
    unit_cost_ore: 45000,
    unit_sell_ore: 85000,
    vat_rate_bp: 2500,
    ...overrides,
  };
}

/** Assert a result is the VALIDATION_FAILED shape (and NEVER echoes the raw value). */
function assertRejected(result: { ok: boolean }, label: string): void {
  assert.equal(result.ok, false, `expected VALIDATION_FAILED: ${label}`);
  const r = result as { ok: false; code?: string; data?: unknown };
  assert.equal(r.code, "VALIDATION_FAILED", `wrong code: ${label}`);
  assert.equal("data" in r, false, `rejection must not carry data: ${label}`);
}

/** Assert a result is accepted and return the narrowed data record. */
function assertAccepted(result: { ok: boolean }, label: string): Record<string, unknown> {
  assert.equal(result.ok, true, `expected accepted: ${label}`);
  return (result as { ok: true; data: Record<string, unknown> }).data;
}

// ─────────────────────────────────────────────────────────────────────────────
// GUARD (unskipped) — the real validator surface + the inherited manual baseline.
// ─────────────────────────────────────────────────────────────────────────────

test("GUARD: the real calc validators are reachable and accept a manual (no-source) row today", () => {
  // A manual/free-text row (no source pair) is first-class in the inherited 5.1 contract —
  // Story 5.3 must NOT regress this. This runs GREEN against the current validators.
  assertAccepted(validateCreateRow(baseRow()), "manual create row (no source)");
  assertAccepted(
    validateUpdateRow({ id: ROW_ID, unit_sell_ore: 90000 }),
    "manual update row (no source)",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Source pair: both-or-neither (5.3 dev Task 2.1) — RED until validators extended.
// ─────────────────────────────────────────────────────────────────────────────

test(
  "validateCreateRow rejects a source_id with NO source_kind (both-or-neither)",
  { skip: true },
  () => {
    assertRejected(
      validateCreateRow(baseRow({ source_id: SOURCE_ID })),
      "source_id without source_kind",
    );
  },
);

test(
  "validateCreateRow rejects a source_kind with NO source_id (both-or-neither)",
  { skip: true },
  () => {
    assertRejected(
      validateCreateRow(baseRow({ source_kind: "work_role" })),
      "source_kind without source_id",
    );
  },
);

test(
  "validateCreateRow rejects an unknown source_kind (closed work_role|article subset)",
  { skip: true },
  () => {
    // company_settings/quote_terms are valid SnapshotKinds but NOT calc-row sources.
    for (const kind of ["company_settings", "quote_terms", "supplier", "widget"]) {
      assertRejected(
        validateCreateRow(baseRow({ source_kind: kind, source_id: SOURCE_ID })),
        `unknown source_kind ${kind}`,
      );
    }
  },
);

test(
  "validateCreateRow rejects a non-UUID source_id",
  { skip: true },
  () => {
    assertRejected(
      validateCreateRow(baseRow({ source_kind: "work_role", source_id: "not-a-uuid" })),
      "non-uuid source_id",
    );
  },
);

test(
  "validateCreateRow ACCEPTS a valid both-present work_role pair and carries it on data",
  { skip: true },
  () => {
    const data = assertAccepted(
      validateCreateRow(baseRow({ source_kind: "work_role", source_id: SOURCE_ID })),
      "valid work_role pair",
    );
    assert.equal(data.source_kind, "work_role");
    assert.equal(data.source_id, SOURCE_ID);
  },
);

test(
  "validateCreateRow ACCEPTS a valid both-present article pair",
  { skip: true },
  () => {
    const data = assertAccepted(
      validateCreateRow(
        baseRow({ row_type: "material", source_kind: "article", source_id: SOURCE_ID }),
      ),
      "valid article pair",
    );
    assert.equal(data.source_kind, "article");
    assert.equal(data.source_id, SOURCE_ID);
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// isPresent('')===false — an empty-string source is DROPPED (manual), not an error.
// ─────────────────────────────────────────────────────────────────────────────

test(
  "validateCreateRow treats an EMPTY-STRING source pair as ABSENT (manual row, not an error)",
  { skip: true },
  () => {
    // Per the epic-5 PINNED convention `isPresent('')===false`: empty-string source fields
    // are dropped → the row is manual/no-source → ACCEPTED, and no source is carried.
    const data = assertAccepted(
      validateCreateRow(baseRow({ source_kind: "", source_id: "" })),
      "empty-string source pair → manual",
    );
    assert.equal(data.source_kind ?? null, null);
    assert.equal(data.source_id ?? null, null);
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// updateRow — the same source-pair rules apply on the edit path.
// ─────────────────────────────────────────────────────────────────────────────

test(
  "validateUpdateRow rejects a lone source_kind on the update path (both-or-neither)",
  { skip: true },
  () => {
    assertRejected(
      validateUpdateRow({ id: ROW_ID, source_kind: "article" }),
      "update: source_kind without source_id",
    );
  },
);

test(
  "validateUpdateRow ACCEPTS a valid both-present pair on the update path",
  { skip: true },
  () => {
    const data = assertAccepted(
      validateUpdateRow({ id: ROW_ID, source_kind: "work_role", source_id: SOURCE_ID }),
      "update: valid work_role pair",
    );
    assert.equal(data.source_kind, "work_role");
    assert.equal(data.source_id, SOURCE_ID);
  },
);
