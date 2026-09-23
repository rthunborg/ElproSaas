import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GET, POST, handleJobsRunRequest } from "@/app/api/jobs/run/route";
import { isAuthorizedCronRequest } from "@/server/jobs/auth";
import { encodeCursor } from "@/server/jobs/runner";

const current = "c".repeat(32);
const producer = { id: "notifications.reminder", module: "notifications", category: "quote.reminder", schedule: "*/5 * * * *", essential: false };

function request(secret: string | null, method = "POST") {
  return new Request("https://example.test/api/jobs/run", { method, headers: secret ? { authorization: `Bearer ${secret}` } : {} });
}

test("[P0] GET and POST reject every named invalid credential before client or runner side effects", async () => {
  let clientCalls = 0;
  let runnerCalls = 0;
  const dependencies = {
    authorize: (header: string | null) => isAuthorizedCronRequest(header, { CRON_SECRET: current }),
    createClient: () => { clientCalls += 1; throw new Error("must not construct client"); },
    run: async () => { runnerCalls += 1; return { outcome: "completed" as const }; },
  };
  for (const credential of [null, "wrong", "eyJhbGciOiJub25lIn0.e30.", "forged.jwt.token"]) {
    const response = await handleJobsRunRequest(request(credential), dependencies);
    assert.equal(response.status, 401);
    assert.equal(await response.text(), "Unauthorized");
  }
  assert.equal((await GET(request(null, "GET"))).status, 401);
  assert.equal((await POST(request(null))).status, 401);
  assert.equal(clientCalls, 0);
  assert.equal(runnerCalls, 0);
});

test("[P0] an expired previous CRON_SECRET is rejected before client or runner side effects", async () => {
  const previous = "p".repeat(32);
  let clientCalls = 0;
  let runnerCalls = 0;
  const response = await handleJobsRunRequest(request(previous), {
    authorize: (header) =>
      isAuthorizedCronRequest(header, {
        CRON_SECRET: current,
        CRON_PREVIOUS_SECRET: previous,
        CRON_PREVIOUS_SECRET_EXPIRES_AT: "2020-01-01T00:00:00.000Z",
      }),
    createClient: () => {
      clientCalls += 1;
      throw new Error("must not construct client");
    },
    run: async () => {
      runnerCalls += 1;
      return { outcome: "completed" as const };
    },
  });
  assert.equal(response.status, 401);
  assert.equal(await response.text(), "Unauthorized");
  assert.equal(clientCalls, 0);
  assert.equal(runnerCalls, 0);
});

test("[P0] Vercel's GET delivery accepts the current secret on the shared scheduler boundary", async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = current;
  try {
    const response = await GET(request(current, "GET"));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { outcome: "completed", cursor: null });
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test("[P0] the authenticated route loads a persisted cursor and writes matching run/audit records", async () => {
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const client = {
    from(table: string) {
      if (table === "job_runs") {
        const cursorQuery = {
          eq: () => cursorQuery,
          not: () => cursorQuery,
          order: () => cursorQuery,
          limit: async () => ({ data: [{ cursor: encodeCursor(1), outcome: "partial" }], error: null }),
        };
        return {
          select: () => cursorQuery,
          insert: async (row: Record<string, unknown>) => { inserts.push({ table, row }); return { error: null }; },
        };
      }
      if (table === "audit_events") return { insert: async (row: Record<string, unknown>) => { inserts.push({ table, row }); return { error: null }; } };
      if (table === "tenants") return { select: () => ({ order: async () => ({ data: [{ id: "tenant-a" }, { id: "tenant-b" }], error: null }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;
  const response = await handleJobsRunRequest(request(current), {
    authorize: (header) => isAuthorizedCronRequest(header, { CRON_SECRET: current }),
    createClient: () => client,
    producers: [producer],
    correlationId: () => "00000000-0000-4000-8000-000000000001",
    now: () => new Date("2026-09-23T12:00:00.000Z"),
    execute: async (_producer, tenantId) => { assert.equal(tenantId, "tenant-b"); },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { outcome: "completed", cursor: null });
  assert.equal(inserts.length, 4);
  assert.equal(inserts[0]?.row.tenant_id, "tenant-b");
  assert.equal(inserts[0]?.row.window_started_at, "2026-09-23T12:00:00.000Z");
  assert.equal(inserts[0]?.row.started_at, "2026-09-23T12:00:00.000Z");
  assert.equal(inserts[0]?.row.finished_at, "2026-09-23T12:00:00.000Z");
  assert.equal(inserts[0]?.row.correlation_id, inserts[1]?.row.correlation_id);
  assert.equal(inserts[1]?.row.actor_user_id, null);
});
