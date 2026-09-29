import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emitDueFollowUpNotifications } from "@/server/notifications/follow-up-producer";

function uuid(value: number): string {
  return `00000000-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;
}

test("[P0] a large tenant resumes every bounded follow-up and recipient page without dropping notification pairs", async () => {
  const followUps = Array.from({ length: 5 }, (_, index) => ({ id: uuid(index + 1), quote_id: uuid(index + 101) }));
  const memberships = Array.from({ length: 5 }, (_, index) => ({ user_id: uuid(index + 201), role: "tenant_admin", membership_roles: [] }));
  const emitted: Array<{ logical_subject_id: string; recipient_user_id: string }> = [];
  const limits: Array<{ table: string; limit: number }> = [];
  let largestPreferenceLookup = 0;
  let largestWrite = 0;

  const client = {
    from(table: string) {
      if (table === "notifications") {
        return {
          upsert(rows: Array<{ logical_subject_id: string; recipient_user_id: string }>) {
            largestWrite = Math.max(largestWrite, rows.length);
            emitted.push(...rows);
            return { abortSignal: async () => ({ error: null }) };
          },
        };
      }

      const filters = new Map<string, unknown>();
      let after: { column: string; value: string } | undefined;
      let queryLimit = Number.POSITIVE_INFINITY;
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => { filters.set(column, value); return query; },
        lte: () => query,
        gt: (column: string, value: string) => { after = { column, value }; return query; },
        in: (_column: string, values: readonly string[]) => { largestPreferenceLookup = Math.max(largestPreferenceLookup, values.length); return query; },
        order: () => query,
        limit: (value: number) => { queryLimit = value; limits.push({ table, limit: value }); return query; },
        abortSignal: async () => {
          if (table === "quote_follow_ups") {
            const rows = followUps.filter((row) => !after || row.id > after.value).slice(0, queryLimit);
            return { data: rows, error: null };
          }
          if (table === "tenant_memberships") {
            const rows = memberships.filter((row) => !after || row.user_id > after.value).slice(0, queryLimit);
            return { data: rows, error: null };
          }
          if (table === "quote_versions") {
            assert.equal(typeof filters.get("quote_id"), "string");
            return { data: [{ status: "sent" }], error: null };
          }
          if (table === "notification_preferences") return { data: [], error: null };
          throw new Error(`unexpected table ${table}`);
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;

  let cursor: string | undefined;
  let invocations = 0;
  do {
    const result = await emitDueFollowUpNotifications(client, uuid(999), "2026-09-27", {
      cursor,
      followUpBatchSize: 2,
      recipientBatchSize: 2,
    });
    cursor = result.cursor;
    invocations += 1;
    assert.ok(invocations < 20, "producer must converge instead of repeating a page");
  } while (cursor);

  assert.equal(invocations, 9);
  assert.equal(emitted.length, 25);
  assert.equal(new Set(emitted.map((row) => `${row.logical_subject_id}:${row.recipient_user_id}`)).size, 25);
  assert.ok(limits.filter((entry) => entry.table === "quote_follow_ups").every((entry) => entry.limit === 3));
  assert.ok(limits.filter((entry) => entry.table === "tenant_memberships").every((entry) => entry.limit === 3));
  assert.ok(limits.filter((entry) => entry.table === "quote_versions").every((entry) => entry.limit === 1));
  assert.equal(largestPreferenceLookup, 2);
  assert.equal(largestWrite, 4);
});
