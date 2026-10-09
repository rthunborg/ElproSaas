/**
 * Story 19.1 ATDD — real result entry with an injected paginated PostgREST read transport.
 * Provisional shape: Result<{ descriptor: PipelineDescriptor; completedAt: string }>.
 * Adapt only callable/shape names after implementation; retain error, source and money assertions.
 * Synthetic malformed money supplements real schema constraints; it is not claimed DB reachability.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

type Row = Record<string, unknown>;
type Table = "quote_events" | "quote_acceptances" | "quote_follow_ups" | "quote_versions";
type Period = { from: string; to: string };
type Descriptor = {
  data: {
    period: Period; sentCount: number; acceptedCount: number; lostCount: number;
    hitRate: number | null; openFollowUpCount: number; overdueFollowUpCount: number;
    acceptedValueOre?: number;
  };
  entitlements: { withheld: readonly string[] };
};
type PipelineResult =
  | { ok: true; data: { descriptor: Descriptor; completedAt: string } }
  | { ok: false; code: string; message: string };
type Reader = (
  period?: Period, entitlement?: { roles?: readonly string[]; moneyEntitled?: boolean },
  deps?: { client?: unknown; now?: string },
) => Promise<PipelineResult>;
type LegacyReader = (
  period?: Period, entitlement?: { roles?: readonly string[]; moneyEntitled?: boolean },
  deps?: { client?: unknown; now?: string },
) => Promise<Descriptor>;
const NOW = "2026-07-19T23:30:00.000Z";
const WINDOW: Period = { from: "2026-07-01", to: "2026-07-31" };
const OCCURRED = "2026-07-10T12:00:00.000Z";
const RAW_FAILURE = "SQL secret-money 987654321 tenant-private stack-fixture";
const ADMIN = { roles: ["tenant_admin"] };
const PAGE_SIZE = 500;
const ID_BATCH_SIZE = 50; // ADR-B012 approved gateway-safe request limit, independent of fixture size.
const MULTI_BATCH_FIXTURE_IDS = 101;
let headersResolved = false;

async function loadReaders(): Promise<{ readQuotePipelineResult: Reader; readQuotePipeline: LegacyReader }> {
  // Node's strip runner cannot resolve Next's extensionless next/headers entry.
  // This narrowly maps the actual factory's import to the actual package file;
  // it does not replace the product reader, query core, cookies or DB client.
  if (!headersResolved) {
    register("data:text/javascript," + encodeURIComponent(
      "export async function resolve(s,c,n){if(s==='next/headers' && c.parentURL?.endsWith('/supabase-server-client.ts'))return n('next/headers.js',c);return n(s,c);}",
    ), import.meta.url);
    headersResolved = true;
  }
  const name = "@/server/read-models/quote-pipeline";
  const source = await import(name) as {
    readQuotePipelineResult: Reader; readQuotePipeline: LegacyReader;
  };
  assert.equal(typeof source.readQuotePipelineResult, "function", "new result entry must exist before card wiring");
  assert.equal(typeof source.readQuotePipeline, "function", "existing wrapper stays exported");
  return source;
}
function eventFactory(overrides: Row = {}): Row {
  return { id: "event-1", quote_version_id: "version-1", event_type: "accepted", occurred_at: OCCURRED, ...overrides };
}
function dataFactory(overrides: Partial<Record<Table, Row[]>> = {}): Record<Table, Row[]> {
  return {
    quote_events: [eventFactory()],
    quote_acceptances: [{ id: "acceptance-1", quote_version_id: "version-1", accepted_price_ore: "750000" }],
    quote_follow_ups: [{ id: "follow-up-1", quote_id: "quote-1", status: "open", due_date: "2026-07-15" }],
    quote_versions: [{ id: "version-1", quote_id: "quote-1", version_number: 1, status: "accepted", accepted_price_ore: 900000 }],
    ...overrides,
  };
}
type ReadCall = { table: Table; batch: number; from: number; to: number; selected: string; ids: readonly string[] };
type Fault = { table: Table; batch?: number; from?: number; mode: "error" | "throw" | "from-throw" };
function paginatedTransport(rows: Record<Table, Row[]>, fault?: Fault, onRead?: (call: ReadCall) => void) {
  const calls: ReadCall[] = [];
  const queryCounts = new Map<Table, number>();
  const client = {
    from(table: Table) {
      if (fault?.table === table && fault.mode === "from-throw") throw new Error(RAW_FAILURE);
      return {
        select(selected: string) {
          const batch = (queryCounts.get(table) ?? 0) + 1;
          queryCounts.set(table, batch);
          const predicates: ((row: Row) => boolean)[] = [];
          const orders: { column: string; ascending: boolean }[] = [];
          let ids: readonly string[] = [];
          const query = {
            in(column: string, values: readonly string[]) {
              if (column !== "event_type") ids = [...values];
              predicates.push((row) => values.includes(String(row[column])));
              return query;
            },
            eq(column: string, value: string) {
              predicates.push((row) => row[column] === value);
              return query;
            },
            gte(column: string, value: string) {
              predicates.push((row) => Date.parse(String(row[column])) >= Date.parse(value));
              return query;
            },
            lt(column: string, value: string) {
              predicates.push((row) => Date.parse(String(row[column])) < Date.parse(value));
              return query;
            },
            order(column: string, options?: { ascending?: boolean }) {
              orders.push({ column, ascending: options?.ascending !== false });
              return query;
            },
            async range(from: number, to: number) {
              const call: ReadCall = { table, batch, from, to, selected, ids };
              calls.push(call);
              onRead?.(call);
              if (fault?.table === table && (fault.batch ?? 1) === batch && (fault.from ?? 0) === from) {
                if (fault.mode === "throw") throw new Error(RAW_FAILURE);
                return { data: null, error: { code: "XX001", message: RAW_FAILURE, details: RAW_FAILURE } };
              }
              const filtered = rows[table].filter((row) => predicates.every((predicate) => predicate(row)));
              filtered.sort((a, b) => {
                for (const order of orders) {
                  const av = a[order.column] as string | number;
                  const bv = b[order.column] as string | number;
                  const delta = av < bv ? -1 : av > bv ? 1 : 0;
                  if (delta) return order.ascending ? delta : -delta;
                }
                return 0;
              });
              return { data: filtered.slice(from, to + 1), error: null };
            },
          };
          return query;
        },
      };
    },
  };
  return { client, calls };
}
function assertFailure(result: PipelineResult) {
  assert.equal(result.ok, false, "a fault cannot become a successful fresh zero descriptor");
  assert.deepEqual(Object.keys(result).sort(), ["code", "message", "ok"]);
  assert.equal(typeof (result as { code: unknown }).code, "string");
  assert.equal(typeof (result as { message: unknown }).message, "string");
  assert.doesNotMatch(JSON.stringify(result), /SQL|987654321|tenant-private|stack-fixture|descriptor|completedAt|sentCount|acceptedValueOre/);
}
function success(result: PipelineResult) {
  assert.equal(result.ok, true);
  assert.ok("data" in result);
  return result.data;
}

for (const table of ["quote_events", "quote_acceptances", "quote_follow_ups", "quote_versions"] as const) {
  for (const mode of ["error", "throw"] as const) {
    test("[P0] 19.1-UNIT-007/008 AC6 " + table + " " + mode + " never yields partial totals", async () => {
      const { readQuotePipelineResult } = await loadReaders();
      const transport = paginatedTransport(dataFactory(), { table, mode });
      const result = await readQuotePipelineResult(WINDOW, ADMIN, { client: transport.client, now: NOW });
      assert.ok(transport.calls.some((call) => call.table === table), "the named real reader query stage must be reached");
      assertFailure(result);
    });
  }
}

const lateCases: { label: string; table: Table; batch?: number; from?: number; rows: () => Record<Table, Row[]> }[] = [
  { label: "event second page", table: "quote_events", from: PAGE_SIZE, rows: () => dataFactory({
    quote_events: Array.from({ length: PAGE_SIZE + 1 }, (_, n) => eventFactory({ id: "event-" + n })),
  }) },
  { label: "follow-up second page", table: "quote_follow_ups", from: PAGE_SIZE, rows: () => dataFactory({
    quote_follow_ups: Array.from({ length: PAGE_SIZE + 1 }, (_, n) => ({
      id: "follow-up-" + n, quote_id: "quote-" + n, status: "open", due_date: "2026-07-15",
    })),
  }) },
  { label: "latest-version second page", table: "quote_versions", from: PAGE_SIZE, rows: () => dataFactory({
    quote_versions: Array.from({ length: PAGE_SIZE + 1 }, (_, n) => ({
      id: "version-" + n, quote_id: "quote-1", version_number: n + 1, status: "sent",
    })),
  }) },
  { label: "acceptance second ID batch", table: "quote_acceptances", batch: 2, rows: () => dataFactory({
    quote_events: Array.from({ length: MULTI_BATCH_FIXTURE_IDS }, (_, n) => eventFactory({
      id: "event-" + n, quote_version_id: "accepted-version-" + n,
    })),
    quote_acceptances: Array.from({ length: MULTI_BATCH_FIXTURE_IDS }, (_, n) => ({
      id: "acceptance-" + n, quote_version_id: "accepted-version-" + n, accepted_price_ore: 10000,
    })),
  }) },
  { label: "latest-version second ID batch", table: "quote_versions", batch: 2, rows: () => dataFactory({
    quote_follow_ups: Array.from({ length: MULTI_BATCH_FIXTURE_IDS }, (_, n) => ({
      id: "follow-up-" + n, quote_id: "quote-" + n, status: "open", due_date: "2026-07-15",
    })),
    quote_versions: Array.from({ length: MULTI_BATCH_FIXTURE_IDS }, (_, n) => ({
      id: "version-" + n, quote_id: "quote-" + n, version_number: 1, status: "sent",
    })),
  }) },
];
for (const scenario of lateCases) {
  for (const mode of ["error", "throw"] as const) {
    test("[P0] 19.1-UNIT-007 AC6 " + scenario.label + " " + mode + " discards already-read prefixes", async () => {
      const { readQuotePipelineResult } = await loadReaders();
      const transport = paginatedTransport(scenario.rows(), { ...scenario, mode });
      const result = await readQuotePipelineResult(WINDOW, ADMIN, { client: transport.client, now: NOW });
      assert.ok(transport.calls.some((call) => call.table === scenario.table &&
        call.batch === (scenario.batch ?? 1) && call.from === (scenario.from ?? 0)),
      "must reach the failing later page/batch after earlier successful reads");
      assertFailure(result);
    });
  }
}

test("[P0] 19.1-UNIT-008 AC6 synchronous query construction throws become generic failures", async () => {
  const { readQuotePipelineResult } = await loadReaders();
  const transport = paginatedTransport(dataFactory(), { table: "quote_events", mode: "from-throw" });
  assertFailure(await readQuotePipelineResult(WINDOW, ADMIN, { client: transport.client, now: NOW }));
});

test("[P0] 19.1-UNIT-008 AC6 actual cookie-client construction outside a request fails safely", async () => {
  const { readQuotePipelineResult } = await loadReaders();
  // No injected client: actual factory fails without request cookies (or missing public env).
  // It must not throw or serialize the Next/env error; no new factory bypass is introduced.
  assertFailure(await readQuotePipelineResult(WINDOW, ADMIN, { now: NOW }));
});

test("[P0] 19.1-UNIT-005 AC3 lifecycle history and adjusted accepted commitment equal the existing aggregate", async () => {
  const { readQuotePipelineResult } = await loadReaders();
  const aggregateName = "@/server/read-models/quote-pipeline-aggregate";
  const moneyName = "@/lib/money/ore";
  const { aggregateQuotePipeline } = await import(aggregateName);
  const { formatOreAsKronor } = await import(moneyName);
  const events = [
    eventFactory({ id: "sent-1", event_type: "sent" }),
    eventFactory({ id: "sent-again", event_type: "sent" }),
    eventFactory({ id: "accepted-1" }),
    eventFactory({ id: "sent-old", quote_version_id: "superseded-version", event_type: "sent" }),
    eventFactory({ id: "lost-old", quote_version_id: "superseded-version", event_type: "lost" }),
    eventFactory({ id: "june", quote_version_id: "outside-version", event_type: "sent", occurred_at: "2026-06-25T12:00:00.000Z" }),
  ];
  const transport = paginatedTransport(dataFactory({ quote_events: events, quote_follow_ups: [] }));
  const result = success(await readQuotePipelineResult(WINDOW, ADMIN, { client: transport.client, now: NOW }));
  const expected = aggregateQuotePipeline({
    events,
    acceptedVersions: [{ quote_version_id: "version-1", accepted_price_ore: 750000 }],
    followUps: [],
  }, WINDOW, NOW);
  assert.deepEqual(result.descriptor.data, expected);
  assert.equal(result.descriptor.data.sentCount, 2);
  assert.equal(result.descriptor.data.acceptedCount, 1);
  assert.equal(result.descriptor.data.lostCount, 1);
  assert.equal(result.descriptor.data.hitRate, 1 / 2);
  assert.equal(result.descriptor.data.acceptedValueOre, 750000);
  assert.notEqual(result.descriptor.data.acceptedValueOre, 900000, "frozen SENT total is not accepted commitment");
  assert.equal(formatOreAsKronor(result.descriptor.data.acceptedValueOre), "7500,00");
  assert.ok(transport.calls.find((call) => call.table === "quote_acceptances")?.selected.includes("accepted_price_ore"));
});

for (const roles of [["tenant_admin"], ["saljare"]]) {
  test("[P1] 19.1-UNIT-006 AC4/5 empty successful period remains successful for " + roles[0], async () => {
    const { readQuotePipelineResult } = await loadReaders();
    const transport = paginatedTransport(dataFactory({ quote_events: [], quote_follow_ups: [] }));
    const { descriptor, completedAt } = success(await readQuotePipelineResult(WINDOW, { roles }, { client: transport.client, now: NOW }));
    assert.equal(descriptor.data.sentCount, 0);
    assert.equal(descriptor.data.acceptedCount, 0);
    assert.equal(descriptor.data.lostCount, 0);
    assert.equal(descriptor.data.hitRate, null);
    assert.deepEqual(descriptor.data.period, WINDOW);
    assert.ok(Number.isFinite(Date.parse(completedAt)));
    if (roles[0] === "saljare") {
      assert.equal(Object.hasOwn(descriptor.data, "acceptedValueOre"), false);
      assert.deepEqual(descriptor.entitlements.withheld, ["acceptedValueOre"]);
    } else {
      assert.equal(descriptor.data.acceptedValueOre, 0);
      assert.deepEqual(descriptor.entitlements.withheld, []);
    }
  });
}

test("[P1] 19.1-UNIT-006 AC5 sent-only activity is loaded activity with null rate and entitled zero", async () => {
  const { readQuotePipelineResult } = await loadReaders();
  const transport = paginatedTransport(dataFactory({
    quote_events: [eventFactory({ event_type: "sent" })], quote_follow_ups: [],
  }));
  const { descriptor } = success(await readQuotePipelineResult(WINDOW, ADMIN, { client: transport.client, now: NOW }));
  assert.equal(descriptor.data.sentCount, 1);
  assert.equal(descriptor.data.acceptedCount, 0);
  assert.equal(descriptor.data.hitRate, null);
  assert.equal(descriptor.data.acceptedValueOre, 0);
  assert.deepEqual(descriptor.entitlements.withheld, []);
});

for (const invalid of [
  { label: "malformed clock", now: "not-an-instant", period: undefined },
  { label: "impossible clock calendar day", now: "2026-02-30T00:00:00.000Z", period: WINDOW },
  { label: "malformed clock with explicit valid period", now: "not-an-instant", period: WINDOW },
  { label: "impossible period day", now: NOW, period: { from: "2026-02-30", to: "2026-07-31" } },
  { label: "reversed period", now: NOW, period: { from: "2026-08-01", to: "2026-07-01" } },
  { label: "non-date period field", now: NOW, period: { from: "yesterday", to: "2026-07-31" } },
]) {
  test("[P0] 19.1-UNIT-009 AC6 " + invalid.label + " is unavailable, never fresh safe-date zeros", async () => {
    const { readQuotePipelineResult } = await loadReaders();
    const transport = paginatedTransport(dataFactory());
    assertFailure(await readQuotePipelineResult(invalid.period, ADMIN, { client: transport.client, now: invalid.now }));
  });
}

for (const invalid of [
  { label: "unsafe integer", value: Number.MAX_SAFE_INTEGER + 1 },
  { label: "fractional ore", value: 1.5 },
  { label: "malformed bigint string", value: "not-money" },
  { label: "non-finite ore", value: Infinity },
  { label: "missing accepted money", value: null },
]) {
  test("[P0] 19.1-UNIT-010 AC3/6 synthetic " + invalid.label + " cannot become a fresh accepted total", async () => {
    const { readQuotePipelineResult } = await loadReaders();
    const transport = paginatedTransport(dataFactory({
      quote_acceptances: [{ quote_version_id: "version-1", accepted_price_ore: invalid.value }],
    }));
    assertFailure(await readQuotePipelineResult(WINDOW, ADMIN, { client: transport.client, now: NOW }));
  });
}

test("[P0] 19.1-UNIT-010 AC6 aggregate overflow is unavailable after individually safe accepted rows", async () => {
  const { readQuotePipelineResult } = await loadReaders();
  const transport = paginatedTransport(dataFactory({
    quote_events: [eventFactory(), eventFactory({ id: "event-2", quote_version_id: "version-2" })],
    quote_acceptances: [
      { quote_version_id: "version-1", accepted_price_ore: Number.MAX_SAFE_INTEGER },
      { quote_version_id: "version-2", accepted_price_ore: 1 },
    ],
  }));
  assertFailure(await readQuotePipelineResult(WINDOW, ADMIN, { client: transport.client, now: NOW }));
});

test("[P0] 19.1-UNIT-010 AC3 exact safe integer ore boundary remains successful", async () => {
  const { readQuotePipelineResult } = await loadReaders();
  const transport = paginatedTransport(dataFactory({
    quote_acceptances: [{ quote_version_id: "version-1", accepted_price_ore: String(Number.MAX_SAFE_INTEGER) }],
  }));
  const { descriptor } = success(await readQuotePipelineResult(WINDOW, ADMIN, { client: transport.client, now: NOW }));
  assert.equal(descriptor.data.acceptedValueOre, Number.MAX_SAFE_INTEGER);
});

test("[P0] 19.1-UNIT-004 AC4 seller result is projected before return, not CSS-hidden", async () => {
  const { readQuotePipelineResult } = await loadReaders();
  const transport = paginatedTransport(dataFactory());
  const result = await readQuotePipelineResult(WINDOW, { roles: ["saljare"] }, { client: transport.client, now: NOW });
  const { descriptor } = success(result);
  assert.equal(descriptor.data.acceptedCount, 1);
  assert.equal(Object.hasOwn(descriptor.data, "acceptedValueOre"), false);
  assert.deepEqual(descriptor.entitlements.withheld, ["acceptedValueOre"]);
  assert.doesNotMatch(JSON.stringify(result), /750000|900000/);
});

for (const now of ["2024-02-29T09:00:00.000Z", "2026-03-29T00:30:00.000Z", "2026-07-19T23:30:00.000Z"]) {
  test("[P1] 19.1-UNIT-009 AC3 default period equals existing Stockholm authority at " + now, async () => {
    const { readQuotePipelineResult } = await loadReaders();
    const name = "@/server/read-models/quote-pipeline-aggregate";
    const { resolvePipelinePeriod } = await import(name);
    const transport = paginatedTransport(dataFactory({ quote_events: [], quote_follow_ups: [] }));
    const { descriptor } = success(await readQuotePipelineResult(undefined, ADMIN, { client: transport.client, now }));
    assert.deepEqual(descriptor.data.period, resolvePipelinePeriod(now));
  });
}

test("[P1] 19.1-UNIT-012 AC6 old wrapper signature/fallback stays compatible while new entry distinguishes faults", async () => {
  const { readQuotePipelineResult, readQuotePipeline } = await loadReaders();
  const good = paginatedTransport(dataFactory());
  const legacyGood = await readQuotePipeline(WINDOW, ADMIN, { client: good.client, now: NOW });
  const resultGood = success(await readQuotePipelineResult(WINDOW, ADMIN, { client: good.client, now: NOW }));
  assert.deepEqual(resultGood.descriptor, legacyGood);
  const legacyFailed = paginatedTransport(dataFactory(), { table: "quote_follow_ups", mode: "error" });
  const legacyFailure = await readQuotePipeline(WINDOW, ADMIN, { client: legacyFailed.client, now: NOW });
  assert.deepEqual(legacyFailure.data, {
    period: WINDOW, sentCount: 0, acceptedCount: 0, lostCount: 0, hitRate: null,
    openFollowUpCount: 0, overdueFollowUpCount: 0, acceptedValueOre: 0,
  });
  assert.deepEqual(legacyFailure.entitlements.withheld, []);
  const resultFailed = paginatedTransport(dataFactory(), { table: "quote_follow_ups", mode: "error" });
  assertFailure(await readQuotePipelineResult(WINDOW, ADMIN, { client: resultFailed.client, now: NOW }));
});

for (const { distinctAccepted, eventPageStarts, batchSizes } of [
  { distinctAccepted: MULTI_BATCH_FIXTURE_IDS, eventPageStarts: [0, 500], batchSizes: [50, 50, 1] },
  { distinctAccepted: 501, eventPageStarts: [0, 500, 1000], batchSizes: [...Array<number>(10).fill(50), 1] },
  { distinctAccepted: 1001, eventPageStarts: [0, 500, 1000, 1500], batchSizes: [...Array<number>(20).fill(50), 1] },
]) test("[P1] 19.1-UNIT-015 AC3/6 real result consumes all bounded pages/chunks with no health query: " + distinctAccepted + " IDs", async () => {
  const { readQuotePipelineResult } = await loadReaders();
  const rows = dataFactory({
    quote_events: [
      ...Array.from({ length: PAGE_SIZE }, (_, n) => eventFactory({ id: "duplicate-" + n, event_type: "sent" })),
      ...Array.from({ length: distinctAccepted }, (_, n) => eventFactory({ id: "accepted-" + n, quote_version_id: "v-" + n })),
      eventFactory({ id: "last-lost", event_type: "lost", quote_version_id: "lost-version" }),
    ],
    quote_acceptances: Array.from({ length: distinctAccepted }, (_, n) => ({ id: "a-" + n, quote_version_id: "v-" + n, accepted_price_ore: 10000 })),
    quote_follow_ups: [],
  });
  const transport = paginatedTransport(rows);
  const { descriptor } = success(await readQuotePipelineResult(WINDOW, ADMIN, { client: transport.client, now: NOW }));
  assert.equal(descriptor.data.sentCount, 1);
  assert.equal(descriptor.data.acceptedCount, distinctAccepted);
  assert.equal(descriptor.data.lostCount, 1);
  assert.equal(descriptor.data.acceptedValueOre, distinctAccepted * 10000);
  assert.deepEqual(transport.calls.filter((call) => call.table === "quote_events").map((call) => call.from), eventPageStarts);
  const acceptanceCalls = transport.calls.filter((call) => call.table === "quote_acceptances");
  assert.deepEqual(acceptanceCalls.map((call) => call.ids.length), batchSizes);
  assert.deepEqual(acceptanceCalls.map((call) => call.batch), batchSizes.map((_, index) => index + 1));
  const allRequestedIds = acceptanceCalls.flatMap((call) => call.ids);
  assert.equal(allRequestedIds.length, distinctAccepted);
  assert.deepEqual([...allRequestedIds].sort(), rows.quote_acceptances.map((row) => String(row.quote_version_id)).sort(), "every accepted ID appears exactly once");
  assert.deepEqual(transport.calls.map((call) => call.table), [
    ...eventPageStarts.map(() => "quote_events"), ...batchSizes.map(() => "quote_acceptances"), "quote_follow_ups",
  ], "only existing query core; no health preflight or repeated eager/poll reads");
  assert.ok(transport.calls.every((call) => call.to - call.from + 1 === PAGE_SIZE));
  assert.ok(acceptanceCalls.every((call) => call.from === 0 && call.ids.length <= ID_BATCH_SIZE));
});

test("[P1] 19.1-UNIT-013 AC9 completion instant is stamped after the final successful read", async (t) => {
  const { readQuotePipelineResult } = await loadReaders();
  const START = "2026-10-07T12:00:00.000Z";
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse(START) });
  t.after(() => t.mock.timers.reset());
  const transport = paginatedTransport(dataFactory(), undefined, (call) => {
    if (call.table === "quote_versions") t.mock.timers.tick(7000);
  });
  const { completedAt } = success(await readQuotePipelineResult(WINDOW, ADMIN, { client: transport.client, now: NOW }));
  assert.equal(completedAt, "2026-10-07T12:00:07.000Z");
  assert.notEqual(completedAt, NOW, "period/classification boundary is not completion freshness");
});
