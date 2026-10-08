import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeRenderedException, normalizeStoredExceptions } from "../../../../src/features/resources/resource-form-inputs";
import { validateCapacityInputs } from "../../../../src/features/resources/capacity-inputs";

test("[P0] accepts read-model serialized full-day exception history for a subsequent form save", () => {
  const normalized = normalizeStoredExceptions([{ kind: "blocked_time", date: "2026-10-16", start: null, end: null }]);
  assert.deepEqual(normalized, [{ kind: "blocked_time", date: "2026-10-16" }]);
  assert.equal(validateCapacityInputs({ exceptions: normalized }).ok, true);
});

test("[P0] retains malformed persisted exception entries so command validation rejects them", () => {
  const normalized = normalizeStoredExceptions([null]);
  assert.deepEqual(normalized, [null]);
  assert.equal(validateCapacityInputs({ exceptions: normalized }).ok, false);
});

test("[P0] preserves seconds and microseconds when the compact rendered exception is unchanged", () => {
  const existing = [{ kind: "blocked_time", date: "2026-10-16", start: "09:00:30.123456", end: "12:00:30.123456" }];
  assert.deepEqual(mergeRenderedException({ kind: "blocked_time", date: "2026-10-16", start: "09:00", end: "12:00" }, existing), existing);
});
