/**
 * Story 19.1 ATDD — server authority and actual browser-bound dashboard DTO.
 * Provisional readDashboard(deps) uses current resolveTenantContext before readPipeline.
 * Dependency injection is server/test-only; unknown caller properties below are hostile input,
 * not a proposed public API. Adapt seam names after implementation, retain behavior.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

type ContextResult =
  | { ok: true; data: {
      userId: string; tenantId: string; role: string; roles: readonly unknown[];
      status: "active"; userEmail: string | null; tenantName: string | null;
    } }
  | { ok: false; code: string; message: string };
type Descriptor = {
  data: Record<string, unknown>;
  entitlements: { withheld: readonly string[] };
};
type PipelineResult =
  | { ok: true; data: { descriptor: Descriptor; completedAt: string } }
  | { ok: false; code: string; message: string };
type PipelineReader = (
  period?: { from: string; to: string },
  entitlements?: { roles?: readonly string[]; moneyEntitled?: boolean },
  deps?: { client?: unknown; now?: string },
) => Promise<PipelineResult>;
type Widget = { id: string; title?: string; href?: string; span?: number; result: PipelineResult };
type Dashboard = { widgets: Widget[] };
type Deps = {
  client?: unknown; now?: string;
  resolveContext?: (options?: { client?: unknown }) => Promise<ContextResult>;
  readPipeline?: PipelineReader;
};
type ReadDashboard = (deps?: Deps) => Promise<Dashboard>;
const NOW = "2026-07-19T23:30:00.000Z";
const COMPLETED = "2026-10-07T12:00:07.000Z";
const SECRET_ORE = 765432109;
const ERROR_DETAIL = "SQL tenant-private stack-fixture";
let headersResolved = false;

async function loadDashboard(): Promise<ReadDashboard> {
  if (!headersResolved) {
    register("data:text/javascript," + encodeURIComponent(
      "export async function resolve(s,c,n){if(s==='next/headers' && c.parentURL?.endsWith('/supabase-server-client.ts'))return n('next/headers.js',c);return n(s,c);}",
    ), import.meta.url);
    headersResolved = true;
  }
  const name = "@/server/read-models/dashboard";
  const source = await import(name) as { readDashboard: ReadDashboard };
  assert.equal(typeof source.readDashboard, "function", "dashboard must expose its actual server adapter");
  return source.readDashboard;
}
function contextFactory(roles: readonly unknown[] = ["tenant_admin"], tenantId = "tenant-unit-a"): ContextResult {
  return {
    ok: true,
    data: {
      userId: "user-unit-a", tenantId, role: String(roles[0] ?? ""),
      roles, status: "active", userEmail: "unit@example.test", tenantName: "Synthetic tenant",
    },
  };
}
async function resultFactory(
  roles: readonly string[] = ["tenant_admin"],
  overrides: Record<string, unknown> = {},
): Promise<PipelineResult> {
  const name = "@/server/read-models/entitlements";
  const { projectWithEntitlements } = await import(name);
  const full = {
    period: { from: "2026-07-01", to: "2026-07-31" },
    sentCount: 3, acceptedCount: 1, lostCount: 1, hitRate: 0.5,
    openFollowUpCount: 42, overdueFollowUpCount: 41, acceptedValueOre: SECRET_ORE,
  };
  return {
    ok: true,
    data: { descriptor: {
      ...projectWithEntitlements(full, { roles }),
      ...overrides,
    }, completedAt: COMPLETED },
  };
}
function pipeline(result: Dashboard): PipelineResult {
  assert.equal(result.widgets.length, 1);
  assert.equal(result.widgets[0].id, "quote-pipeline");
  return result.widgets[0].result;
}
function success(result: PipelineResult) {
  assert.equal(result.ok, true);
  assert.ok("data" in result);
  return result.data;
}
function assertUnavailable(result: PipelineResult) {
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result).sort(), ["code", "message", "ok"]);
  assert.doesNotMatch(JSON.stringify(result), /descriptor|sentCount|acceptedValueOre|completedAt|SQL|tenant-private|stack-fixture|765432109/);
}

for (const role of ["tenant_admin", "projektledare", "saljare"]) {
  test.skip("[P0] 19.1-UNIT-003/004 AC2/4 current server " + role + " loads one correctly projected widget", async () => {
    const readDashboard = await loadDashboard();
    const client = { marker: "request-bound-test-client" };
    let authorityReads = 0;
    const readerCalls: { roles?: readonly string[]; moneyEntitled?: boolean; client?: unknown }[] = [];
    const result = await readDashboard({
      client, now: NOW,
      resolveContext: async (options) => {
        authorityReads += 1;
        assert.equal(options?.client, client);
        return contextFactory([role]);
      },
      readPipeline: async (_period, entitlements, deps) => {
        readerCalls.push({ ...entitlements, client: deps?.client });
        assert.equal(authorityReads, 1, "authority must precede loader");
        return resultFactory(entitlements?.roles);
      },
    });
    assert.equal(authorityReads, 1);
    assert.equal(readerCalls.length, 1);
    assert.deepEqual(readerCalls[0].roles, [role]);
    assert.equal(readerCalls[0].moneyEntitled, undefined, "use existing sensitive matrix via current roles");
    assert.equal(readerCalls[0].client, client);
    const { descriptor } = success(pipeline(result));
    assert.equal(descriptor.data.sentCount, 3);
    if (role === "saljare") {
      assert.equal(Object.hasOwn(descriptor.data, "acceptedValueOre"), false);
      assert.deepEqual(descriptor.entitlements.withheld, ["acceptedValueOre"]);
      assert.doesNotMatch(JSON.stringify(result), /765432109/);
    } else {
      assert.equal(descriptor.data.acceptedValueOre, SECRET_ORE);
      assert.deepEqual(descriptor.entitlements.withheld, []);
    }
  });
}

for (const roles of [["montor"], ["ekonomi"], ["unknown-role"], []] as readonly (readonly string[])[]) {
  test.skip("[P0] 19.1-UNIT-003 AC2 no quote loader for current server roles " + JSON.stringify(roles), async () => {
    const readDashboard = await loadDashboard();
    let authorityReads = 0;
    let quoteReads = 0;
    const result = await readDashboard({
      now: NOW,
      resolveContext: async () => { authorityReads += 1; return contextFactory(roles); },
      readPipeline: async () => { quoteReads += 1; return resultFactory(["tenant_admin"]); },
    });
    assert.equal(authorityReads, 1);
    assert.equal(quoteReads, 0, "Dashboard.View or money entitlement cannot grant Quotes.View");
    assert.deepEqual(result.widgets, []);
    assert.doesNotMatch(JSON.stringify(result), /765432109|acceptedValueOre|sentCount|quotes/);
  });
}

for (const failure of [
  { ok: false as const, code: "UNAUTHENTICATED", message: "Generic session error" },
  { ok: false as const, code: "TENANT_MEMBERSHIP_REQUIRED", message: "Generic membership error" },
  { ok: false as const, code: "SERVER_ERROR", message: "Generic server error" },
]) {
  test.skip("[P0] 19.1-UNIT-003 AC2 authority " + failure.code + " blocks reads independently of page layout", async () => {
    const readDashboard = await loadDashboard();
    let quoteReads = 0;
    const result = await readDashboard({
      resolveContext: async () => failure,
      readPipeline: async () => { quoteReads += 1; return resultFactory(); },
    });
    assert.equal(quoteReads, 0);
    assert.deepEqual(result.widgets, []);
  });
}

test.skip("[P0] 19.1-UNIT-003 AC2 union normalizes valid roles and deduplicates the one actual widget", async () => {
  const readDashboard = await loadDashboard();
  let quoteReads = 0;
  const result = await readDashboard({
    resolveContext: async () => contextFactory(["unknown-role", "saljare", "ekonomi", "saljare"]),
    readPipeline: async (_period, entitlements) => {
      quoteReads += 1;
      assert.deepEqual([...entitlements?.roles ?? []].sort(), ["ekonomi", "saljare"]);
      return resultFactory(entitlements?.roles);
    },
  });
  assert.equal(quoteReads, 1, "capability union must not create a duplicate read/card per role");
  const { descriptor } = success(pipeline(result));
  assert.equal(descriptor.data.acceptedValueOre, SECRET_ORE, "existing field union grants money via Ekonomi only after quote capability via Säljare");
});

test.skip("[P0] 19.1-UNIT-003 AC2 omitted caller roles are irrelevant; current server resolver remains authority", async () => {
  const readDashboard = await loadDashboard();
  let authorityReads = 0;
  let quoteReads = 0;
  const result = await readDashboard({
    resolveContext: async () => { authorityReads += 1; return contextFactory(["saljare"]); },
    readPipeline: async (_period, entitlements) => {
      quoteReads += 1;
      assert.deepEqual(entitlements?.roles, ["saljare"]);
      return resultFactory(entitlements?.roles);
    },
  });
  assert.equal(authorityReads, 1);
  assert.equal(quoteReads, 1);
  assert.equal(Object.hasOwn(success(pipeline(result)).descriptor.data, "acceptedValueOre"), false);
});

test.skip("[P0] 19.1-UNIT-003/004 AC2/4 hostile caller role/tenant/money properties cannot widen current server authority", async () => {
  const readDashboard = await loadDashboard();
  let quoteReads = 0;
  const hostile = {
    roles: ["tenant_admin"], moneyEntitled: true, tenantId: "tenant-unit-b",
    resolveContext: async () => contextFactory(["montor"], "tenant-unit-a"),
    readPipeline: async () => { quoteReads += 1; return resultFactory(); },
  };
  const result = await readDashboard(hostile as Deps);
  assert.equal(quoteReads, 0);
  assert.deepEqual(result.widgets, []);
});

test.skip("[P0] 19.1-UNIT-004 AC4 browser DTO allowlist excludes follow-ups, raw rows, roles and private resolver metadata", async () => {
  const readDashboard = await loadDashboard();
  const input = await resultFactory(["saljare"]);
  assert.ok(input.ok);
  input.data.descriptor.data.rawAcceptedRows = [{ accepted_price_ore: SECRET_ORE }];
  input.data.descriptor.data.roles = ["tenant_admin"];
  input.data.descriptor.data.permissionMatrix = { dangerous: true };
  const result = await readDashboard({
    resolveContext: async () => contextFactory(["saljare"]),
    readPipeline: async () => input,
  });
  const data = success(pipeline(result)).descriptor.data;
  assert.deepEqual(Object.keys(data).sort(), ["acceptedCount", "hitRate", "lostCount", "period", "sentCount"]);
  assert.deepEqual(success(pipeline(result)).descriptor.entitlements.withheld, ["acceptedValueOre"]);
  assert.ok(Object.keys(result.widgets[0]).every((key) => ["id", "title", "href", "span", "result"].includes(key)));
  assert.doesNotMatch(JSON.stringify(result), /765432109|openFollowUpCount|overdueFollowUpCount|rawAcceptedRows|tenant-unit-a|user-unit-a|unit@example|tenant_admin|permissionMatrix|moneyEntitled/);
});

test.skip("[P0] 19.1-UNIT-011 AC4/6 absent money not listed as withheld rejects malformed descriptor", async () => {
  const readDashboard = await loadDashboard();
  const malformed = await resultFactory();
  assert.ok(malformed.ok);
  delete malformed.data.descriptor.data.acceptedValueOre;
  malformed.data.descriptor.entitlements = { withheld: [] };
  const result = await readDashboard({ resolveContext: async () => contextFactory(), readPipeline: async () => malformed });
  assertUnavailable(pipeline(result));
});

test.skip("[P0] 19.1-UNIT-011 AC4/6 contradictory present-and-withheld money cannot cross the DTO boundary", async () => {
  const readDashboard = await loadDashboard();
  const malformed = await resultFactory(["saljare"]);
  assert.ok(malformed.ok);
  malformed.data.descriptor.data.acceptedValueOre = SECRET_ORE;
  const result = await readDashboard({ resolveContext: async () => contextFactory(["saljare"]), readPipeline: async () => malformed });
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /765432109/);
  // It may discard the injected amount or reject the descriptor; neither may expose it.
  const widgetResult = pipeline(result);
  if (widgetResult.ok) {
    assert.equal(Object.hasOwn(widgetResult.data.descriptor.data, "acceptedValueOre"), false);
    assert.deepEqual(widgetResult.data.descriptor.entitlements.withheld, ["acceptedValueOre"]);
  } else {
    assertUnavailable(widgetResult);
  }
});

test.skip("[P0] 19.1-UNIT-011 AC6 malformed completion time cannot claim a fresh loaded result", async () => {
  const readDashboard = await loadDashboard();
  const malformed = await resultFactory();
  assert.ok(malformed.ok);
  malformed.data.completedAt = "not-a-time";
  const result = await readDashboard({ resolveContext: async () => contextFactory(), readPipeline: async () => malformed });
  assertUnavailable(pipeline(result));
});

test.skip("[P0] 19.1-UNIT-008 AC6 reader error remains card-local and sanitizes unexpected provider detail", async () => {
  const readDashboard = await loadDashboard();
  const result = await readDashboard({
    resolveContext: async () => contextFactory(),
    readPipeline: async () => ({ ok: false, code: "SERVER_ERROR", message: ERROR_DETAIL }),
  });
  assertUnavailable(pipeline(result));
  assert.equal(result.widgets.length, 1, "eligible failed card remains available for retry");
});

test.skip("[P0] 19.1-UNIT-008 AC6 thrown reader error becomes card-local unavailable", async () => {
  const readDashboard = await loadDashboard();
  const result = await readDashboard({
    resolveContext: async () => contextFactory(),
    readPipeline: async () => { throw new Error(ERROR_DETAIL); },
  });
  assertUnavailable(pipeline(result));
});

test.skip("[P0] 19.1-UNIT-003 AC2 thrown authority resolution blocks all quote reads", async () => {
  const readDashboard = await loadDashboard();
  let quoteReads = 0;
  const result = await readDashboard({
    resolveContext: async () => { throw new Error(ERROR_DETAIL); },
    readPipeline: async () => { quoteReads += 1; return resultFactory(); },
  });
  assert.equal(quoteReads, 0);
  assert.deepEqual(result.widgets, []);
  assert.doesNotMatch(JSON.stringify(result), /SQL|tenant-private|stack-fixture/);
});

test.skip("[P0] 19.1-UNIT-003/004 AC7 retry resolves revoked quote capability before a second loader", async () => {
  const readDashboard = await loadDashboard();
  let roles = ["tenant_admin"];
  let authorityReads = 0;
  let quoteReads = 0;
  const deps: Deps = {
    resolveContext: async () => { authorityReads += 1; return contextFactory(roles); },
    readPipeline: async (_period, entitlements) => { quoteReads += 1; return resultFactory(entitlements?.roles); },
  };
  assert.equal(success(pipeline(await readDashboard(deps))).descriptor.data.acceptedValueOre, SECRET_ORE);
  roles = ["montor"];
  const retry = await readDashboard(deps);
  assert.equal(authorityReads, 2);
  assert.equal(quoteReads, 1);
  assert.deepEqual(retry.widgets, []);
  assert.doesNotMatch(JSON.stringify(retry), /765432109|completedAt|sentCount/);
});

test.skip("[P0] 19.1-UNIT-004 AC7 retry retains quote access but immediately removes revoked money", async () => {
  const readDashboard = await loadDashboard();
  let roles = ["projektledare"];
  let authorityReads = 0;
  let quoteReads = 0;
  const deps: Deps = {
    resolveContext: async () => { authorityReads += 1; return contextFactory(roles); },
    readPipeline: async (_period, entitlements) => { quoteReads += 1; return resultFactory(entitlements?.roles); },
  };
  assert.equal(success(pipeline(await readDashboard(deps))).descriptor.data.acceptedValueOre, SECRET_ORE);
  roles = ["saljare"];
  const retry = await readDashboard(deps);
  assert.equal(authorityReads, 2);
  assert.equal(quoteReads, 2);
  assert.equal(Object.hasOwn(success(pipeline(retry)).descriptor.data, "acceptedValueOre"), false);
  assert.deepEqual(success(pipeline(retry)).descriptor.entitlements.withheld, ["acceptedValueOre"]);
  assert.doesNotMatch(JSON.stringify(retry), /765432109/);
});

test.skip("[P0] 19.1-UNIT-003 AC7 stale session on retry does not reuse a prior success", async () => {
  const readDashboard = await loadDashboard();
  let authenticated = true;
  let quoteReads = 0;
  const deps: Deps = {
    resolveContext: async () => authenticated ? contextFactory() : { ok: false, code: "UNAUTHENTICATED", message: "Generic session error" },
    readPipeline: async () => { quoteReads += 1; return resultFactory(); },
  };
  success(pipeline(await readDashboard(deps)));
  authenticated = false;
  const retry = await readDashboard(deps);
  assert.equal(quoteReads, 1);
  assert.deepEqual(retry.widgets, []);
  assert.doesNotMatch(JSON.stringify(retry), /765432109|completedAt|sentCount/);
});

test.skip("[P0] 19.1-UNIT-004 AC2/4 sequential request identities cannot share prior entitled data", async () => {
  const readDashboard = await loadDashboard();
  const adminResult = await readDashboard({
    resolveContext: async () => contextFactory(["tenant_admin"], "tenant-unit-a"),
    readPipeline: async () => resultFactory(),
  });
  assert.equal(success(pipeline(adminResult)).descriptor.data.acceptedValueOre, SECRET_ORE);
  const sellerResult = await readDashboard({
    resolveContext: async () => contextFactory(["saljare"], "tenant-unit-b"),
    readPipeline: async (_period, entitlements) => resultFactory(entitlements?.roles),
  });
  assert.equal(Object.hasOwn(success(pipeline(sellerResult)).descriptor.data, "acceptedValueOre"), false);
  assert.doesNotMatch(JSON.stringify(sellerResult), /765432109|tenant-unit-a/);
});

test.skip("[P1] 19.1-UNIT-015 AC7 repeated failed reads repeat authority without any success fallback", async () => {
  const readDashboard = await loadDashboard();
  let authorityReads = 0;
  let quoteReads = 0;
  const deps: Deps = {
    resolveContext: async () => { authorityReads += 1; return contextFactory(); },
    readPipeline: async () => { quoteReads += 1; return { ok: false, code: "SERVER_ERROR", message: "Generic read error" }; },
  };
  const first = await readDashboard(deps);
  const second = await readDashboard(deps);
  assert.equal(authorityReads, 2);
  assert.equal(quoteReads, 2);
  assertUnavailable(pipeline(first));
  assertUnavailable(pipeline(second));
});
