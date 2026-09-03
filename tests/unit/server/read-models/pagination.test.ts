import assert from "node:assert/strict";
import { test } from "node:test";

import { RLS_PAGE_SIZE, readAllPages } from "@/server/read-models/pagination";

test("[P1][10.5] readAllPages requests contiguous ranges and retains every row across a full-page boundary", async () => {
  const values = Array.from({ length: RLS_PAGE_SIZE * 2 + 1 }, (_, index) => ({ id: `row-${index}` }));
  const requestedRanges: Array<readonly [number, number]> = [];
  const result = await readAllPages(async (from, to) => {
    requestedRanges.push([from, to]);
    return { data: values.slice(from, to + 1), error: null };
  });
  assert.equal(result.error, null);
  assert.deepEqual(result.data, values);
  assert.deepEqual(requestedRanges, [[0, RLS_PAGE_SIZE - 1], [RLS_PAGE_SIZE, RLS_PAGE_SIZE * 2 - 1], [RLS_PAGE_SIZE * 2, RLS_PAGE_SIZE * 3 - 1]]);
});

test("[P1][10.5] readAllPages fails closed and does not return an accumulated prefix after a later-page query error", async () => {
  let callCount = 0;
  const failure = { message: "database unavailable" };
  const result = await readAllPages(async () => {
    callCount += 1;
    return callCount === 1
      ? { data: Array.from({ length: RLS_PAGE_SIZE }, (_, index) => ({ id: `row-${index}` })), error: null }
      : { data: null, error: failure };
  });
  assert.equal(callCount, 2);
  assert.deepEqual(result, { data: [], error: failure });
});
