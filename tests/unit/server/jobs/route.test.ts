import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

test("[P0] byte-length-mismatched bearer credentials always receive the generic 401 without side effects", async () => {
  const candidate = "é".repeat(32);
  for (const expiry of ["2020-01-01T00:00:00.000Z", "2030-01-01T00:00:00.000Z"]) {
    let clientCalls = 0;
    let runnerCalls = 0;
    const response = await handleJobsRunRequest(request(candidate), {
      authorize: (header) => isAuthorizedCronRequest(header, {
        CRON_SECRET: current,
        CRON_PREVIOUS_SECRET: "p".repeat(32),
        CRON_PREVIOUS_SECRET_EXPIRES_AT: expiry,
      }),
      createClient: () => { clientCalls += 1; throw new Error("must not construct client"); },
      run: async () => { runnerCalls += 1; return { outcome: "completed" as const }; },
    });
    assert.equal(response.status, 401);
    assert.equal(await response.text(), "Unauthorized");
    assert.equal(clientCalls, 0);
    assert.equal(runnerCalls, 0);
  }
});

test("[P0] Vercel's GET delivery accepts the current secret on the shared scheduler boundary", async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = current;
  try {
    const response = await handleJobsRunRequest(request(current, "GET"), { producers: [] });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { outcome: "completed", cursor: null });
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test("[P0] the authenticated route loads a persisted cursor and writes matching run/audit records", async () => {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    from(table: string) {
      if (table === "job_runs") {
        const cursorQuery = {
          eq: () => cursorQuery,
          in: () => cursorQuery,
          not: () => cursorQuery,
          order: () => cursorQuery,
          limit: () => cursorQuery,
          retry: (enabled: boolean) => { assert.equal(enabled, false); return cursorQuery; },
          abortSignal: async () => ({ data: [{ cursor: encodeCursor(1, 0, [producer.id]), outcome: "partial" }], error: null }),
        };
        return {
          select: () => cursorQuery,
        };
      }
      if (table === "tenants") return { select: () => ({ order: async () => ({ data: [{ id: "tenant-a" }, { id: "tenant-b" }], error: null }) }) };
      throw new Error(`unexpected table ${table}`);
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return { data: "00000000-0000-4000-8000-000000000002", error: null };
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
  assert.equal(rpcCalls.length, 2);
  assert.deepEqual(rpcCalls.map((call) => call.name), ["record_job_run_with_system_audit", "record_job_run_with_system_audit"]);
  assert.equal(rpcCalls[0]?.args.p_tenant_id, "tenant-b");
  assert.equal(rpcCalls[0]?.args.p_window_started_at, "2026-09-23T12:00:00.000Z");
  assert.equal(rpcCalls[0]?.args.p_started_at, "2026-09-23T12:00:00.000Z");
  assert.equal(rpcCalls[0]?.args.p_finished_at, "2026-09-23T12:00:00.000Z");
  assert.equal(rpcCalls[0]?.args.p_correlation_id, "00000000-0000-4000-8000-000000000001");
});

test("[P0] default registered outbox delivery producer reaches the scheduler suppression/evaluation seam", async () => {
  let suppressions = 0; let queueReads = 0;
  const client = {
    from(table: string) {
      if (table === "job_runs") { const query = { eq: () => query, in: () => query, order: () => query, limit: () => query, retry: () => query, abortSignal: async () => ({ data: [], error: null }) }; return { select: () => query }; }
      if (table === "email_outbox") return { select: () => {
        const query = { eq: () => query, order: () => query, limit: async () => { queueReads += 1; return { data: [], error: null }; } };
        return query;
      } };
      throw new Error(`unexpected table ${table}`);
    },
    rpc: async (name: string) => { assert.equal(name, "suppress_queued_email_outbox"); suppressions += 1; return { data: 0, error: null }; },
  } as unknown as SupabaseClient;
  const response = await handleJobsRunRequest(request(current), {
    authorize: () => true,
    createClient: () => client,
    run: async (dependencies, options) => {
      const delivery = (options?.producers ?? []).find((candidate) => candidate.id === "notifications.email-outbox-delivery");
      assert.ok(delivery);
      await dependencies.execute(delivery, "tenant-a");
      return { outcome: "completed" as const };
    },
  });
  assert.equal(response.status, 200); assert.equal(suppressions, 1); assert.equal(queueReads, 0);
});

test("[P0] the default follow-up dispatcher uses the Stockholm business date across winter, summer, and DST", async () => {
  const followUp = { id: "quotes.follow-up-reminders", module: "quotes", category: "quote.follow_up_due", schedule: "0 * * * *", essential: true };
  for (const [instant, expectedPeriod] of [
    ["2026-01-15T23:30:00.000Z", "2026-01-16"],
    ["2026-08-04T22:00:00.000Z", "2026-08-05"],
    ["2026-03-29T01:00:00.000Z", "2026-03-29"],
  ]) {
    let capturedPeriod: string | undefined;
    const client = {
      from(table: string) {
        if (table === "job_runs") {
          const query = { eq: () => query, in: () => query, order: () => query, limit: () => query, retry: () => query, abortSignal: async () => ({ data: [], error: null }) };
          return { select: () => query };
        }
        if (table === "quote_follow_ups") {
          const query = {
            select: () => query,
            eq: () => query,
            lte: (_column: string, value: string) => { capturedPeriod = value; return query; },
            order: () => query,
            limit: () => query,
            abortSignal: async () => ({ data: [], error: null }),
          };
          return query;
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as unknown as SupabaseClient;
    const response = await handleJobsRunRequest(request(current), {
      authorize: () => true,
      createClient: () => client,
      producers: [followUp],
      now: () => new Date(instant),
      run: async (dependencies, options) => {
        const candidate = options?.producers?.[0];
        assert.ok(candidate);
        await dependencies.execute(candidate, "tenant-a");
        return { outcome: "completed" as const };
      },
    });
    assert.equal(response.status, 200);
    assert.equal(capturedPeriod, expectedPeriod);
  }
});

test("[P0] the production route supplies an internal request deadline to the bounded runner", async () => {
  const started = new Date("2030-01-01T00:00:00.000Z");
  const cursorQuery = {
    eq: () => cursorQuery,
    in: () => cursorQuery,
    order: () => cursorQuery,
    limit: () => cursorQuery,
    retry: () => cursorQuery,
    abortSignal: async () => ({ data: [], error: null }),
  };
  const client = { from: () => ({ select: () => cursorQuery }) } as unknown as SupabaseClient;
  const response = await handleJobsRunRequest(request(current), {
    authorize: () => true,
    createClient: () => client,
    producers: [producer],
    now: () => started,
    runBudgetMs: 1_234,
    run: async (_dependencies, options) => {
      assert.equal(options?.windowStartedAt?.toISOString(), started.toISOString());
      assert.equal(options?.deadline?.toISOString(), "2030-01-01T00:00:01.234Z");
      return { outcome: "completed" };
    },
  });
  assert.equal(response.status, 200);
});

test("[P0] producer cursor lookup filters failure-only rows and retains a partial checkpoint", async () => {
  const client = {
    from(table: string) {
      assert.equal(table, "job_runs");
      let selectedProducer = "";
      const query = {
        eq: (column: string, value: string) => {
          if (column === "producer") selectedProducer = value;
          return query;
        },
        in: (column: string, values: string[]) => {
          assert.equal(column, "outcome");
          assert.deepEqual(values, ["completed", "partial"]);
          return query;
        },
        order: () => query,
        limit: () => query,
        retry: () => query,
        abortSignal: async () => ({
          data: selectedProducer === producer.id
            ? [{ cursor: "after-page-1", outcome: "partial" }]
            : [],
          error: null,
        }),
      };
      return { select: () => query };
    },
  } as unknown as SupabaseClient;

  const response = await handleJobsRunRequest(request(current), {
    authorize: () => true,
    createClient: () => client,
    producers: [producer],
    run: async (dependencies) => {
      assert.equal(await dependencies.loadProducerCursor?.(producer, "tenant-a"), "after-page-1");
      return { outcome: "completed" };
    },
  });
  assert.equal(response.status, 200);
});

type CursorRow = { tenant_id: string; producer: string; outcome: string; cursor: string | null; id: number; created_at: number };
function cursorClient(rows: CursorRow[] = [], onRead?: (key: string, attempt: number, signal: AbortSignal) => { data: null; error: unknown; status: number } | void, onOperation?: (operation: "enumerate" | "record") => void) {
  const writes: Record<string, unknown>[] = [];
  const reads = new Map<string, number>();
  const queries: Array<{ equals: Map<string, string>; orders: string[]; signal: AbortSignal }> = [];
  const client = {
    from(table: string) {
      if (table === "tenants") return { select: () => ({ order: async () => { onOperation?.("enumerate"); return { data: [{ id: "tenant-a" }, { id: "tenant-b" }], error: null }; } }) };
      assert.equal(table, "job_runs");
      const equals = new Map<string, string>(); const orders: string[] = [];
      let outcomes: string[] | undefined; let limit = 0;
      const query = {
        select: (fields: string) => { assert.equal(fields, "cursor,outcome"); return query; },
        eq: (field: string, value: string) => { equals.set(field, value); return query; },
        in: (field: string, values: string[]) => { assert.equal(field, "outcome"); outcomes = values; return query; },
        order: (field: string, options: { ascending: boolean }) => { assert.equal(options.ascending, false); orders.push(field); return query; },
        limit: (value: number) => { limit = value; return query; },
        retry: (enabled: boolean) => { assert.equal(enabled, false); return query; },
        abortSignal: async (signal: AbortSignal) => {
          queries.push({ equals, orders, signal });
          const key = `${equals.get("producer")}:${equals.get("tenant_id") ?? "global"}`;
          const attempt = (reads.get(key) ?? 0) + 1; reads.set(key, attempt);
          const failure = onRead?.(key, attempt, signal);
          if (failure) return failure;
          return { data: rows.filter((row) => [...equals].every(([field, value]) => row[field as "tenant_id" | "producer"] === value) && (!outcomes || outcomes.includes(row.outcome)))
            .sort((a, b) => b.created_at - a.created_at || b.id - a.id).slice(0, limit), error: null, status: 200 };
        },
      };
      return query;
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      assert.equal(name, "record_job_run_with_system_audit");
      // Latest deployed RPC allows a cursor exactly for partial outcomes.
      assert.equal(args.p_outcome === "partial", args.p_cursor !== null);
      assert.ok(String(args.p_finished_at) >= String(args.p_started_at));
      writes.push(args);
      const id = rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
      rows.push({ tenant_id: String(args.p_tenant_id), producer: String(args.p_producer), outcome: String(args.p_outcome), cursor: args.p_cursor as string | null, id, created_at: id });
      onOperation?.("record");
      return { data: "record-id", error: null };
    },
  } as unknown as SupabaseClient;
  return { client, writes, reads, queries, rows };
}
const dueStart = new Date("2030-01-01T12:00:00.000Z");

test("[P0] resume and tenant cursor 504 recovery execute the recovered checkpoint exactly once", async () => {
  const global = encodeCursor(1, 0, [producer.id], "tenant-b");
  const f = cursorClient([
    { tenant_id: "tenant-b", producer: "jobs.runner", outcome: "partial", cursor: global, id: 1, created_at: 1 },
    { tenant_id: "tenant-b", producer: producer.id, outcome: "partial", cursor: "saved-page", id: 2, created_at: 2 },
    { tenant_id: "tenant-b", producer: "jobs.runner", outcome: "partial", cursor: global, id: 3, created_at: 3 },
    { tenant_id: "tenant-b", producer: producer.id, outcome: "failed", cursor: null, id: 4, created_at: 4 },
    { tenant_id: "tenant-a", producer: producer.id, outcome: "partial", cursor: "other-tenant", id: 5, created_at: 5 },
    { tenant_id: "tenant-b", producer: "other.producer", outcome: "partial", cursor: "other-producer", id: 6, created_at: 6 },
  ], (_key, attempt) => attempt === 1 ? { data: null, error: { message: "sensitive upstream" }, status: 504 } : undefined);
  const calls: string[] = [];
  const response = await handleJobsRunRequest(request(current), {
    authorize: () => true, createClient: () => f.client, producers: [producer], now: () => dueStart,
    execute: async (_candidate, tenant, cursor) => { calls.push(`${tenant}:${cursor}`); },
  });
  assert.deepEqual(await response.json(), { outcome: "completed", cursor: null });
  assert.deepEqual(calls, ["tenant-b:saved-page"]);
  assert.equal(f.reads.get("jobs.runner:global"), 2);
  assert.equal(f.reads.get(`${producer.id}:tenant-b`), 2);
  assert.deepEqual(f.writes.map((row) => row.p_outcome), ["completed", "completed"]);
  for (const q of f.queries) {
    assert.deepEqual(q.orders, ["created_at", "id"]);
    assert.equal(q.signal.aborted, false);
    if (q.equals.get("producer") === producer.id) assert.equal(q.equals.get("tenant_id"), "tenant-b");
  }
  assert.equal(f.rows.filter((row) => row.outcome === "failed").length, 1);
});

test("[P0] exhausted producer lookups persist failure then recover prior partial without rewriting history", async () => {
  let fail = true;
  const f = cursorClient([
    { tenant_id: "tenant-a", producer: producer.id, outcome: "partial", cursor: "saved-page", id: 1, created_at: 1 },
  ], (key) => fail && key.startsWith(producer.id) ? { data: null, error: { message: "tenant secret cursor" }, status: 504 } : undefined);
  const calls: string[] = [];
  const dependencies = { authorize: () => true, createClient: () => f.client, producers: [producer], now: () => dueStart,
    execute: async (_candidate: unknown, tenant: string, cursor?: string) => { calls.push(`${tenant}:${cursor}`); } };
  const failed = await handleJobsRunRequest(request(current), dependencies);
  assert.deepEqual(await failed.json(), { outcome: "failed", cursor: null });
  assert.deepEqual(calls, []);
  assert.equal(f.reads.get(`${producer.id}:tenant-a`), 3);
  assert.equal(f.reads.get(`${producer.id}:tenant-b`), 3);
  assert.deepEqual(f.writes.map((row) => row.p_outcome), ["failed", "failed", "failed"]);
  assert.equal(f.writes[0]?.p_error_summary, "Cursor read failed (producer; transient_exhausted; HTTP 504)");
  const history = f.rows.filter((row) => row.outcome === "failed").map((row) => ({ ...row }));
  fail = false;
  const recovered = await handleJobsRunRequest(request(current), { ...dependencies, now: () => new Date("2030-01-01T12:01:00.000Z") });
  assert.deepEqual(await recovered.json(), { outcome: "completed", cursor: null });
  assert.deepEqual(calls, ["tenant-a:saved-page"]);
  assert.deepEqual(f.rows.filter((row) => row.outcome === "failed"), history);
});

test("[P0] terminal global failure clears old due authority without replaying completed tuples or masking producer progress", async () => {
  const hourly = { ...producer, schedule: "0 * * * *" };
  for (const status of [403, 504]) {
    let fail = true;
    const f = cursorClient([
      { tenant_id: "tenant-a", producer: "jobs.runner", outcome: "partial", cursor: encodeCursor(0, 0, [hourly.id], "tenant-a"), id: 1, created_at: 1 },
      { tenant_id: "tenant-b", producer: hourly.id, outcome: "partial", cursor: "saved-page-b", id: 2, created_at: 2 },
    ], (key) => fail && key === `${hourly.id}:tenant-b` ? { data: null, error: { message: "private upstream" }, status } : undefined);
    const calls: string[] = [];
    const dependencies = {
      authorize: () => true, createClient: () => f.client, producers: [hourly],
      execute: async (_candidate: unknown, tenant: string, cursor?: string) => { calls.push(`${tenant}:${cursor ?? "start"}`); },
    };
    const first = await handleJobsRunRequest(request(current), {
      ...dependencies, chunkSize: 2, now: () => new Date("2030-01-01T12:05:00.000Z"),
    });
    assert.deepEqual(await first.json(), { outcome: "failed", cursor: null });
    assert.deepEqual(calls, ["tenant-a:start"]);
    assert.deepEqual(f.writes.map((row) => row.p_outcome), ["completed", "failed", "failed"]);
    assert.ok(f.writes.every((row) => row.p_cursor === null));
    assert.equal(f.writes[1]?.p_error_summary, `Cursor read failed (producer; ${status === 504 ? "transient_exhausted" : "non_transient"}; HTTP ${status})`);
    assert.equal(f.writes[2]?.p_error_summary, "Background runner encountered producer failures");
    assert.equal(f.reads.get(`${hourly.id}:tenant-b`), status === 504 ? 3 : 1);
    const failures = f.rows.filter((row) => row.outcome === "failed").map((row) => ({ ...row }));

    fail = false;
    const second = await handleJobsRunRequest(request(current), {
      ...dependencies, chunkSize: 1, now: () => new Date("2030-01-01T12:10:00.000Z"),
    });
    assert.deepEqual(calls, ["tenant-a:start", "tenant-b:saved-page-b"], "terminal authority must not replay tenant-a and consume tenant-b's chunk");
    assert.deepEqual(await second.json(), { outcome: "completed", cursor: null });
    assert.deepEqual(f.writes.slice(3).map((row) => [row.p_producer, row.p_tenant_id, row.p_outcome]), [
      [hourly.id, "tenant-b", "completed"], ["jobs.runner", "tenant-b", "completed"],
    ]);
    assert.deepEqual(f.rows.filter((row) => row.outcome === "failed"), failures);
  }
});

test("[P0] completed null checkpoints clear earlier producer and global partial progress", async () => {
  const f = cursorClient([
    { tenant_id: "tenant-a", producer: producer.id, outcome: "partial", cursor: "stale-page", id: 1, created_at: 1 },
    { tenant_id: "tenant-a", producer: "jobs.runner", outcome: "partial", cursor: encodeCursor(0, 0, [producer.id]), id: 2, created_at: 2 },
    { tenant_id: "tenant-a", producer: producer.id, outcome: "completed", cursor: null, id: 3, created_at: 3 },
    { tenant_id: "tenant-a", producer: "jobs.runner", outcome: "completed", cursor: null, id: 4, created_at: 4 },
    { tenant_id: "tenant-a", producer: producer.id, outcome: "failed", cursor: null, id: 5, created_at: 5 },
  ]);
  const response = await handleJobsRunRequest(request(current), {
    authorize: () => true, createClient: () => f.client, producers: [producer], now: () => new Date("2030-01-01T12:01:00.000Z"),
    execute: async () => { assert.fail("completed checkpoints must clear off-schedule progress"); },
  });
  assert.deepEqual(await response.json(), { outcome: "completed", cursor: null });
  assert.deepEqual(f.writes, []);
});

test("[P0] permanent resume failures throw controlled evidence without runner or persistence dispatch", async () => {
  for (const status of [401, 403, 400, 0]) {
    const f = cursorClient([], () => ({ data: null, error: { message: "private upstream" }, status }));
    await assert.rejects(handleJobsRunRequest(request(current), {
      authorize: () => true, createClient: () => f.client, producers: [producer], now: () => dueStart,
      run: async () => { assert.fail("must not dispatch without resume lookup"); },
    }), /Cursor read failed \(resume; (non_transient|unknown)/);
    assert.equal(f.reads.get("jobs.runner:global"), 1); assert.deepEqual(f.writes, []);
  }
});

test("[P0] permanent producer errors receive one lookup and durable failed observations", async () => {
  for (const [status, code] of [[403, "42501"], [503, "22P02"]] as const) {
    const f = cursorClient([], (key) => key.startsWith(producer.id) ? { data: null, error: { code, message: "private upstream" }, status } : undefined);
    const response = await handleJobsRunRequest(request(current), {
      authorize: () => true, createClient: () => f.client, producers: [producer], now: () => dueStart,
      execute: async () => { assert.fail("permanent failures cannot dispatch"); },
    });
    assert.deepEqual(await response.json(), { outcome: "failed", cursor: null });
    assert.equal(f.reads.get(`${producer.id}:tenant-a`), 1);
    assert.equal(f.reads.get(`${producer.id}:tenant-b`), 1);
    assert.deepEqual(f.writes.map((row) => row.p_outcome), ["failed", "failed", "failed"]);
    assert.equal(f.writes[0]?.p_error_summary, `Cursor read failed (producer; non_transient; HTTP ${status})`);
  }
});

test("[P0] interrupted reads preserve the hourly tuple and elapsed RPC summaries across off-schedule resumption", async () => {
  const hourly = { ...producer, schedule: "0 * * * *" };
  for (const phase of ["cancel", "deadline"] as const) {
    const controller = new AbortController(); let elapsed = 0; let interrupt = true;
    const calls: string[] = [];
    const f = cursorClient([
      { tenant_id: "tenant-a", producer: hourly.id, outcome: "partial", cursor: "saved-page", id: 1, created_at: 1 },
    ], (key, _attempt, signal) => {
      assert.equal(signal.aborted, false);
      elapsed += key.startsWith(hourly.id) ? 30 : 10;
      if (interrupt && key.startsWith(hourly.id)) {
        if (phase === "cancel") controller.abort(); else elapsed = 1_000;
      }
    }, (operation) => { elapsed += operation === "enumerate" ? 20 : 50; });
    const cancellableRequest = new Request("https://example.test/api/jobs/run", { method: "POST", signal: controller.signal });
    const response = await handleJobsRunRequest(cancellableRequest, {
      authorize: () => true, createClient: () => f.client, producers: [hourly], runBudgetMs: 1_000,
      now: () => new Date(dueStart.getTime() + elapsed),
      execute: async () => { assert.fail("cannot execute after failed cursor boundary"); },
    });
    assert.deepEqual(await response.json(), { outcome: "partial", cursor: encodeCursor(0, 0, [hourly.id], "tenant-a") });
    assert.equal(f.reads.get(`${hourly.id}:tenant-a`), 1);
    assert.equal(f.reads.get(`${hourly.id}:tenant-b`), undefined);
    assert.equal(f.writes[0]?.p_outcome, "failed");
    assert.equal(f.writes[0]?.p_cursor, null);
    assert.match(String(f.writes[0]?.p_error_summary), phase === "cancel" ? /cancelled/ : /deadline/);
    assert.equal(f.writes[1]?.p_error_summary, "Background runner encountered producer failures");
    assert.equal(f.writes[1]?.p_started_at, dueStart.toISOString());
    assert.equal(f.writes[1]?.p_finished_at, new Date(dueStart.getTime() + (phase === "cancel" ? 110 : 1_050)).toISOString());
    assert.equal(elapsed, phase === "cancel" ? 160 : 1_100);

    interrupt = false; elapsed = 0;
    const resumedStart = new Date(dueStart.getTime() + 5 * 60_000);
    const resumed = await handleJobsRunRequest(request(current), {
      authorize: () => true, createClient: () => f.client, producers: [hourly], runBudgetMs: 1_000,
      now: () => new Date(resumedStart.getTime() + elapsed),
      execute: async (_candidate, tenant, cursor) => { calls.push(`${tenant}:${cursor ?? "start"}`); elapsed += 40; },
    });
    assert.deepEqual(await resumed.json(), { outcome: "completed", cursor: null });
    assert.deepEqual(calls, ["tenant-a:saved-page", "tenant-b:start"]);
    const terminal = f.writes.at(-1)!;
    assert.equal(terminal.p_producer, "jobs.runner");
    assert.equal(terminal.p_started_at, resumedStart.toISOString());
    assert.equal(terminal.p_finished_at, new Date(resumedStart.getTime() + 270).toISOString());
    assert.equal(terminal.p_cursor, null);
    assert.equal(elapsed, 320);
    assert.equal(f.rows.filter((row) => row.outcome === "failed").length, 1);
  }
});

test("[P0] the production composed budget timeout records deadline and retains the unread tuple", async () => {
  const writes: Record<string, unknown>[] = [];
  let reads = 0;
  let budgetReason: string | undefined;
  const hourly = { ...producer, schedule: "0 * * * *" };
  const client = {
    from(table: string) {
      if (table === "tenants") return { select: () => ({ order: async () => ({ data: [{ id: "tenant-a" }], error: null }) }) };
      let selectedProducer = "";
      const query = {
        select: () => query,
        eq: (field: string, value: string) => { if (field === "producer") selectedProducer = value; return query; },
        in: () => query, order: () => query, limit: () => query, retry: () => query,
        abortSignal: async (signal: AbortSignal) => {
          if (selectedProducer === "jobs.runner") return { data: [], error: null };
          reads += 1;
          return new Promise<{ data: null; error: unknown; status: number }>((resolve) => {
            signal.addEventListener("abort", () => {
              budgetReason = signal.reason?.name;
              resolve({ data: null, error: { message: "private timeout" }, status: 0 });
            }, { once: true });
          });
        },
      };
      return query;
    },
    rpc: async (_name: string, args: Record<string, unknown>) => {
      assert.equal(args.p_outcome === "partial", args.p_cursor !== null);
      writes.push(args); return { data: "synthetic-record", error: null };
    },
  } as unknown as SupabaseClient;
  const response = await handleJobsRunRequest(request(current), {
    authorize: () => true, createClient: () => client, producers: [hourly], runBudgetMs: 100,
    // Use the injected clock only to keep the hourly due window fixed. The real
    // composed AbortSignal.timeout controls interruption; no global clock change.
    now: () => dueStart,
    execute: async () => { assert.fail("timeout must not dispatch"); },
  });
  assert.deepEqual(await response.json(), { outcome: "partial", cursor: encodeCursor(0, 0, [hourly.id], "tenant-a") });
  assert.equal(reads, 1);
  assert.equal(budgetReason, "TimeoutError");
  assert.equal(writes[0]?.p_error_summary, "Cursor read failed (producer; deadline)");
  assert.equal(writes[0]?.p_cursor, null);
  assert.equal(writes[1]?.p_error_summary, "Background runner encountered producer failures");
});

test("[P0] installed Supabase transport performs exactly bounded cursor GETs and no SQL-code retries", async () => {
  for (const code of ["", "42501"]) {
    let fetches = 0;
    const client = createClient("https://synthetic.test", "synthetic-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input, init) => {
        fetches += 1;
        const url = new URL(String(input));
        assert.equal(url.pathname, "/rest/v1/job_runs");
        assert.equal(url.searchParams.get("producer"), "eq.jobs.runner");
        assert.equal(url.searchParams.get("outcome"), null);
        assert.equal(url.searchParams.get("order"), "created_at.desc,id.desc");
        assert.equal(init?.method, "GET");
        assert.ok(init?.signal instanceof AbortSignal);
        assert.equal(new Headers(init?.headers).get("X-Retry-Count"), null);
        return new Response(JSON.stringify({ message: "private upstream", code }), { status: 503, headers: { "Content-Type": "application/json" } });
      } },
    });
    await assert.rejects(handleJobsRunRequest(request(current), {
      authorize: () => true, createClient: () => client, producers: [producer], now: () => dueStart,
      run: async () => { assert.fail("failed cursor must not dispatch"); },
    }), code === "" ? /transient_exhausted; HTTP 503/ : /non_transient; HTTP 503/);
    assert.equal(fetches, code === "" ? 3 : 1);
  }
});
