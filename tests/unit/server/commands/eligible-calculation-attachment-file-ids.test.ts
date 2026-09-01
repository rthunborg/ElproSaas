/**
 * Story 10.9 — fast coverage for the current-calculation attachment eligibility read used by
 * `createNewQuoteVersion`. This stays pure/in-memory: it pins the active file-link query (including
 * `archived_at is null`) and PostgREST's object-or-array embedded `files` response shape without a
 * local Supabase stack.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadEligibleCalculationAttachmentFileIds } from "@/server/commands/quotes/quote-db";

test("10.9: only active calculation links with access-eligible files are returned", async () => {
  const calls: Array<readonly [string, string, string | null]> = [];
  const rows = [
    { file_id: "object-linked", files: { lifecycle_state: "linked", archived_at: null } },
    { file_id: "array-locked", files: [{ lifecycle_state: "locked", archived_at: null }] },
    { file_id: "archived-file", files: { lifecycle_state: "archived", archived_at: null } },
    { file_id: "soft-archived-file", files: { lifecycle_state: "linked", archived_at: "2026-01-01T00:00:00Z" } },
    { file_id: "unknown-shape", files: null },
  ];
  const query = {
    eq(column: string, value: string) {
      calls.push(["eq", column, value]);
      return query;
    },
    is(column: string, value: null) {
      calls.push(["is", column, value]);
      return Promise.resolve({ data: rows, error: null });
    },
  };
  const db = {
    from(table: string) {
      assert.equal(table, "file_links");
      return {
        select(columns: string) {
          assert.equal(columns, "file_id, files!inner(lifecycle_state, archived_at)");
          return query;
        },
      };
    },
  };

  const result = await loadEligibleCalculationAttachmentFileIds(db as never, "calc-id");

  assert.deepEqual(result, ["object-linked", "array-locked"]);
  assert.deepEqual(calls, [
    ["eq", "owner_type", "calculation"],
    ["eq", "owner_id", "calc-id"],
    ["eq", "purpose", "calculation_attachment"],
    ["is", "archived_at", null],
  ]);
});
