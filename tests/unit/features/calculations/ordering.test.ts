/**
 * Story 5.2 — UNIT tests for the PURE ordering helpers
 * (`src/features/calculations/ordering.ts`). 5.2-UNIT-02 (P1, AC2): append/move/reorder/
 * delete-resequence produce the correct `ordered_*_ids` array the atomic reorder command
 * consumes (the ordering CONTRACT is a pure function, not inline island state). Runs under
 * `node --test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendId,
  moveDown,
  moveUp,
  removeId,
  reorderTo,
  toOrderedIds,
} from "@/features/calculations/ordering";

const ids = ["a", "b", "c", "d"];

test("5.2-UNIT-02: append adds a new id at the END", () => {
  assert.deepEqual(appendId(ids, "e"), ["a", "b", "c", "d", "e"]);
  // Original is not mutated.
  assert.deepEqual(ids, ["a", "b", "c", "d"]);
});

test("5.2-UNIT-02: moveUp swaps with the previous id", () => {
  assert.deepEqual(moveUp(ids, 2), ["a", "c", "b", "d"]);
});

test("5.2-UNIT-02: moveUp on the FIRST id is a no-op", () => {
  assert.deepEqual(moveUp(ids, 0), ["a", "b", "c", "d"]);
});

test("5.2-UNIT-02: moveUp with an out-of-range index is a no-op copy", () => {
  assert.deepEqual(moveUp(ids, 99), ["a", "b", "c", "d"]);
});

test("5.2-UNIT-02: moveDown swaps with the next id", () => {
  assert.deepEqual(moveDown(ids, 1), ["a", "c", "b", "d"]);
});

test("5.2-UNIT-02: moveDown on the LAST id is a no-op", () => {
  assert.deepEqual(moveDown(ids, 3), ["a", "b", "c", "d"]);
});

test("5.2-UNIT-02: removeId drops the id and RE-SEQUENCES (contiguous, order preserved)", () => {
  assert.deepEqual(removeId(ids, "b"), ["a", "c", "d"]);
  // A missing id is a no-op copy.
  assert.deepEqual(removeId(ids, "zzz"), ["a", "b", "c", "d"]);
});

test("5.2-UNIT-02: reorderTo moves an id to an explicit position, shifting the rest", () => {
  assert.deepEqual(reorderTo(ids, 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(reorderTo(ids, 3, 0), ["d", "a", "b", "c"]);
});

test("5.2-UNIT-02: reorderTo with an out-of-range index is a no-op copy", () => {
  assert.deepEqual(reorderTo(ids, -1, 2), ["a", "b", "c", "d"]);
  assert.deepEqual(reorderTo(ids, 1, 99), ["a", "b", "c", "d"]);
});

test("5.2-UNIT-02: toOrderedIds maps a model list to its ids", () => {
  assert.deepEqual(
    toOrderedIds([{ id: "x" }, { id: "y" }, { id: "z" }]),
    ["x", "y", "z"],
  );
});

test("5.2-UNIT-02: a delete-then-reorder round-trip keeps a stable, contiguous order", () => {
  // Delete 'c', then move the (now) last id up — the array the reorder command consumes.
  const afterDelete = removeId(ids, "c"); // ["a","b","d"]
  const afterMove = moveUp(afterDelete, 2); // ["a","d","b"]
  assert.deepEqual(afterMove, ["a", "d", "b"]);
});

test("5.2-UNIT-02: moveDown with a NEGATIVE index is a no-op copy", () => {
  assert.deepEqual(moveDown(ids, -1), ["a", "b", "c", "d"]);
});

test("5.2-UNIT-02: moveDown with an out-of-range index is a no-op copy", () => {
  assert.deepEqual(moveDown(ids, 99), ["a", "b", "c", "d"]);
});

test("5.2-UNIT-02: appendId to an EMPTY order yields a single-id list", () => {
  assert.deepEqual(appendId([], "a"), ["a"]);
});

test("5.2-UNIT-02: removeId on the ONLY element yields an empty order", () => {
  assert.deepEqual(removeId(["only"], "only"), []);
});

test("5.2-UNIT-02: moveDown swaps a first-of-two toward the end", () => {
  assert.deepEqual(moveDown(["x", "y"], 0), ["y", "x"]);
});

test("5.2-UNIT-02: reorderTo a same-position index is an identity copy (no reshuffle)", () => {
  assert.deepEqual(reorderTo(ids, 2, 2), ["a", "b", "c", "d"]);
});
