/**
 * Story 5.3 — UNIT tests for the PURE pricing-source SELECT-value helpers
 * (`src/features/calculations/source-select.ts`). These pin the load-bearing `<select>`-value
 * ↔ `source_kind`/`source_id` round-trip and the row-type→source-list mapping WITHOUT a
 * browser (the E2E covers the wired affordance; this fast-gate suite covers the pure
 * encode/decode + mapping branches — including the malformed-value edge cases the E2E can't
 * easily drive). Runs under `node --test` (the fast gate on every PR).
 *
 * The editor encodes a pick as `"<kind>:<id>"` (empty = manual). On submit the decoded pair
 * becomes the hidden `source_kind`/`source_id` fields — so a malformed decode must fall back
 * to `null` (manual), never a half-formed pair that would confuse the server resolver.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MANUAL_SOURCE_VALUE,
  decodeSourceValue,
  encodeSourceValue,
  kindForRowType,
  sourcesForRowType,
} from "@/features/calculations/source-select";

const UUID = "33333333-3333-4333-8333-333333333333";

const LISTS = {
  workRoles: [
    { id: "r1", name: "Elektriker", priceOre: 85000 },
    { id: "r2", name: "Montör", priceOre: 70000 },
  ],
  articles: [{ id: "a1", name: "Kabel 3G1.5", priceOre: 1250 }],
} as const;

// ── encode/decode round-trip ──────────────────────────────────────────────────

test("encodeSourceValue → decodeSourceValue round-trips a work_role pair", () => {
  const encoded = encodeSourceValue("work_role", UUID);
  assert.equal(encoded, `work_role:${UUID}`);
  assert.deepEqual(decodeSourceValue(encoded), { kind: "work_role", id: UUID });
});

test("encodeSourceValue → decodeSourceValue round-trips an article pair", () => {
  const encoded = encodeSourceValue("article", "a1");
  assert.deepEqual(decodeSourceValue(encoded), { kind: "article", id: "a1" });
});

// ── decode: manual + malformed values all fall back to null (never a half-pair) ─

test("decodeSourceValue returns null for the MANUAL (empty) value", () => {
  assert.equal(decodeSourceValue(MANUAL_SOURCE_VALUE), null);
  assert.equal(MANUAL_SOURCE_VALUE, "");
});

test("decodeSourceValue returns null for a value with NO colon", () => {
  assert.equal(decodeSourceValue("work_role"), null);
  assert.equal(decodeSourceValue(UUID), null);
});

test("decodeSourceValue returns null for a LEADING colon (empty kind)", () => {
  assert.equal(decodeSourceValue(`:${UUID}`), null);
});

test("decodeSourceValue returns null for an UNKNOWN kind", () => {
  assert.equal(decodeSourceValue(`supplier:${UUID}`), null);
  assert.equal(decodeSourceValue(`company_settings:${UUID}`), null);
});

test("decodeSourceValue returns null for an EMPTY id (trailing colon)", () => {
  assert.equal(decodeSourceValue("work_role:"), null);
});

test("decodeSourceValue takes the WHOLE remainder as the id (id after the FIRST colon)", () => {
  // The id is sliced after the first colon, so a colon in the tail stays part of the id
  // (robustness — a UUID has none, but the split must not truncate at a second colon).
  assert.deepEqual(decodeSourceValue("work_role:ab:cd"), {
    kind: "work_role",
    id: "ab:cd",
  });
});

// ── sourcesForRowType: labor→work roles, material→articles, else manual ────────

test("sourcesForRowType offers WORK ROLES for a labor row", () => {
  assert.deepEqual(sourcesForRowType("labor", LISTS), LISTS.workRoles);
});

test("sourcesForRowType offers ARTICLES for a material row", () => {
  assert.deepEqual(sourcesForRowType("material", LISTS), LISTS.articles);
});

test("sourcesForRowType offers NOTHING (manual) for the other three row types", () => {
  for (const t of ["subcontractor", "machinery", "other"]) {
    assert.deepEqual(sourcesForRowType(t, LISTS), []);
  }
});

// ── kindForRowType: labor→work_role, material→article, else null ───────────────

test("kindForRowType maps labor→work_role, material→article, else null", () => {
  assert.equal(kindForRowType("labor"), "work_role");
  assert.equal(kindForRowType("material"), "article");
  assert.equal(kindForRowType("subcontractor"), null);
  assert.equal(kindForRowType("machinery"), null);
  assert.equal(kindForRowType("other"), null);
});
