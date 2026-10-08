/**
 * Story 19.1 ATDD — real authenticated RLS result-entry/dashboard composition.
 * No suite hooks launch a stack or provision skipped fixtures. Each activated case gates
 * through skipUnlessStack then owns a fresh UUID-backed fixture with paired cleanup.
 * Provisional adapter/result names match the companion unit contract; no HTTP API is invented.
 * Privileged factories arrange synthetic rows only. All app reads use anon-key authed clients.
 */
import { it, expect, type TestContext } from "vitest";
import {
  createRoleAwarePhaseAFixture, cleanupRoleAwarePhaseAFixture, makeAuthedServerClient,
  adminInsertCustomer, adminInsertCalculation, adminInsertQuote, adminInsertQuoteVersion,
  adminInsertQuoteEvent, adminInsertQuoteAcceptance,
  type RoleAwarePhaseAFixture, type TestServerClient,
} from "../../factories/tenants";
import { adminExec } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

type Descriptor = { data: Record<string, unknown>; entitlements: { withheld: readonly string[] } };
type PipelineResult =
  | { ok: true; data: { descriptor: Descriptor; completedAt: string } }
  | { ok: false; code: string; message: string };
type Reader = (
  period?: { from: string; to: string },
  entitlement?: { roles?: readonly string[]; moneyEntitled?: boolean },
  deps?: { client?: TestServerClient; now?: string },
) => Promise<PipelineResult>;
type Dashboard = { widgets: { id: string; result: PipelineResult }[] };
type ReadDashboard = (deps?: {
  client?: TestServerClient; now?: string; readPipeline?: Reader;
}) => Promise<Dashboard>;
const NOW = "2026-07-19T23:30:00.000Z";
const OCCURRED = "2026-07-10T12:00:00.000Z";
const A_ACCEPTED = 765432109;
const B_ACCEPTED = 987654321;

async function loadFunctions() {
  const pipelineName = "@/server/read-models/quote-pipeline";
  const dashboardName = "@/server/read-models/dashboard";
  const aggregateName = "@/server/read-models/quote-pipeline-aggregate";
  const { readQuotePipelineResult } = await import(pipelineName) as { readQuotePipelineResult: Reader };
  const { readDashboard } = await import(dashboardName) as { readDashboard: ReadDashboard };
  const { resolvePipelinePeriod } = await import(aggregateName);
  expect(typeof readQuotePipelineResult).toBe("function");
  expect(typeof readDashboard).toBe("function");
  return { readQuotePipelineResult, readDashboard, period: resolvePipelinePeriod(NOW) };
}
async function withFixture(ctx: TestContext, run: (fixture: RoleAwarePhaseAFixture) => Promise<void>) {
  const stackUp = await isLocalStackReachable();
  if (skipUnlessStack(ctx, stackUp)) return;
  const fixture = await createRoleAwarePhaseAFixture();
  try { await run(fixture); } finally { await cleanupRoleAwarePhaseAFixture(fixture); }
}
async function seedAccepted(tenantId: string, acceptedOre: number, extraSent = 0) {
  const customer = await adminInsertCustomer({
    tenant_id: tenantId, customer_type: "company", display_name: "Dashboard fixture " + crypto.randomUUID(),
  });
  const calculation = await adminInsertCalculation({ tenant_id: tenantId, customer_id: customer });
  const quote = await adminInsertQuote({ tenant_id: tenantId, customer_id: customer });
  const sourceSentOre = acceptedOre + 10000;
  const version = await adminInsertQuoteVersion({
    tenant_id: tenantId, quote_id: quote, calculation_id: calculation,
    status: "accepted", accepted_price_ore: sourceSentOre,
  });
  await adminInsertQuoteEvent({ tenant_id: tenantId, quote_id: quote, quote_version_id: version, event_type: "sent", occurred_at: OCCURRED });
  await adminInsertQuoteEvent({ tenant_id: tenantId, quote_id: quote, quote_version_id: version, event_type: "accepted", occurred_at: OCCURRED });
  await adminInsertQuoteAcceptance({
    tenant_id: tenantId, quote_id: quote, quote_version_id: version,
    accepted_price_ore: acceptedOre, source_sent_total_ore: sourceSentOre,
    adjustment_reason: "Synthetic adjusted acceptance", accepted_at: OCCURRED,
  });
  for (let n = 0; n < extraSent; n += 1) {
    const nextQuote = await adminInsertQuote({ tenant_id: tenantId, customer_id: customer });
    const nextVersion = await adminInsertQuoteVersion({ tenant_id: tenantId, quote_id: nextQuote, calculation_id: calculation, status: "sent" });
    await adminInsertQuoteEvent({ tenant_id: tenantId, quote_id: nextQuote, quote_version_id: nextVersion, event_type: "sent", occurred_at: OCCURRED });
  }
  return { version, quote, customer, calculation, sourceSentOre };
}
function card(result: Dashboard): PipelineResult {
  expect(result.widgets.map((widget) => widget.id)).toEqual(["quote-pipeline"]);
  return result.widgets[0].result;
}
function success(result: PipelineResult) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected successful result entry, got generic failure");
  return result.data;
}

it("[P0] 19.1-INT-001 AC5 B-only data gives A a successful empty dashboard, not B counts/identity/money", async (ctx) => {
  await withFixture(ctx, async (fixture) => {
    const { readQuotePipelineResult, readDashboard, period } = await loadFunctions();
    await seedAccepted(fixture.base.tenantB.id, B_ACCEPTED, 1);
    const client = await makeAuthedServerClient(fixture.base.adminA);
    const direct = success(await readQuotePipelineResult(period, { roles: ["tenant_admin"] }, { client, now: NOW }));
    const dashboard = await readDashboard({ client, now: NOW });
    const projected = success(card(dashboard)).descriptor;
    expect(projected.data.period).toEqual(period);
    expect(projected.data.sentCount).toBe(0);
    expect(projected.data.acceptedCount).toBe(0);
    expect(projected.data.lostCount).toBe(0);
    expect(projected.data.hitRate).toBeNull();
    expect(projected.data.acceptedValueOre).toBe(0);
    expect(projected.entitlements.withheld).toEqual([]);
    expect(direct.descriptor.data.acceptedValueOre).toBe(0);
    expect(JSON.stringify(dashboard)).not.toContain(String(B_ACCEPTED));
    expect(JSON.stringify(dashboard)).not.toContain(fixture.base.tenantB.id);
    expect(JSON.stringify(dashboard)).not.toContain(fixture.base.adminB.id);
  });
});

it("[P0] 19.1-INT-002 AC3 real new entry and default adapter show own exact adjusted accepted commitment", async (ctx) => {
  await withFixture(ctx, async (fixture) => {
    const { readQuotePipelineResult, readDashboard, period } = await loadFunctions();
    const own = await seedAccepted(fixture.base.tenantA.id, A_ACCEPTED);
    await seedAccepted(fixture.base.tenantB.id, B_ACCEPTED, 1);
    const clientA = await makeAuthedServerClient(fixture.base.adminA);
    const clientB = await makeAuthedServerClient(fixture.base.adminB);
    const directA = success(await readQuotePipelineResult(period, { roles: ["tenant_admin"] }, { client: clientA, now: NOW }));
    const dashboardA = await readDashboard({ client: clientA, now: NOW });
    const dtoA = success(card(dashboardA)).descriptor;
    expect(dtoA.data.sentCount).toBe(1);
    expect(dtoA.data.acceptedCount).toBe(1);
    expect(dtoA.data.lostCount).toBe(0);
    expect(dtoA.data.hitRate).toBe(1);
    expect(dtoA.data.acceptedValueOre).toBe(A_ACCEPTED);
    expect(dtoA.data.acceptedValueOre).not.toBe(own.sourceSentOre);
    expect(dtoA.data.acceptedValueOre).toBe(directA.descriptor.data.acceptedValueOre);
    const dtoB = success(card(await readDashboard({ client: clientB, now: NOW }))).descriptor;
    expect(dtoB.data.sentCount).toBe(2);
    expect(dtoB.data.acceptedValueOre).toBe(B_ACCEPTED);
    expect(JSON.stringify(dashboardA)).not.toContain(String(B_ACCEPTED));
    expect(Object.keys(dtoA.data).sort()).toEqual(["acceptedCount", "acceptedValueOre", "hitRate", "lostCount", "period", "sentCount"]);
  });
});

it("[P0] 19.1-INT-003 AC2/4 actual seller membership keeps counts while browser DTO omits accepted-value sentinel", async (ctx) => {
  await withFixture(ctx, async (fixture) => {
    const { readDashboard } = await loadFunctions();
    await seedAccepted(fixture.base.tenantA.id, A_ACCEPTED);
    const seller = await makeAuthedServerClient(fixture.users.saljare);
    const result = await readDashboard({ client: seller, now: NOW });
    const descriptor = success(card(result)).descriptor;
    expect(descriptor.data.sentCount).toBe(1);
    expect(descriptor.data.acceptedCount).toBe(1);
    expect(Object.hasOwn(descriptor.data, "acceptedValueOre")).toBe(false);
    expect(descriptor.entitlements.withheld).toEqual(["acceptedValueOre"]);
    expect(JSON.stringify(result)).not.toContain(String(A_ACCEPTED));
    expect(JSON.stringify(result)).not.toMatch(/openFollowUpCount|overdueFollowUpCount|accepted_price_ore|tenantId|roles|moneyEntitled/);
  });
});

for (const role of ["montor", "ekonomi"] as const) {
  it("[P0] 19.1-INT-003 AC2 real " + role + " membership invokes no result reader despite dashboard grant", async (ctx) => {
    await withFixture(ctx, async (fixture) => {
      const { readQuotePipelineResult, readDashboard } = await loadFunctions();
      await seedAccepted(fixture.base.tenantA.id, A_ACCEPTED);
      const client = await makeAuthedServerClient(fixture.users[role]);
      let readerCalls = 0;
      const result = await readDashboard({
        client, now: NOW,
        readPipeline: async (...args) => { readerCalls += 1; return readQuotePipelineResult(...args); },
      });
      expect(readerCalls).toBe(0);
      expect(result.widgets).toEqual([]);
      expect(JSON.stringify(result)).not.toContain(String(A_ACCEPTED));
    });
  });
}

it("[P0] 19.1-INT-003 AC2 current membership_roles union yields one card/one actual read", async (ctx) => {
  await withFixture(ctx, async (fixture) => {
    const { readQuotePipelineResult, readDashboard } = await loadFunctions();
    await seedAccepted(fixture.base.tenantA.id, A_ACCEPTED);
    const client = await makeAuthedServerClient(fixture.roleUnionUser);
    let readerCalls = 0;
    const result = await readDashboard({
      client, now: NOW,
      readPipeline: async (...args) => { readerCalls += 1; return readQuotePipelineResult(...args); },
    });
    expect(readerCalls).toBe(1);
    expect(success(card(result)).descriptor.data.acceptedValueOre).toBe(A_ACCEPTED);
  });
});

it("[P0] 19.1-INT-004 AC2 forged runtime role/tenant/money properties cannot replace actual seller authority", async (ctx) => {
  await withFixture(ctx, async (fixture) => {
    const { readDashboard } = await loadFunctions();
    await seedAccepted(fixture.base.tenantA.id, A_ACCEPTED);
    await seedAccepted(fixture.base.tenantB.id, B_ACCEPTED, 1);
    const client = await makeAuthedServerClient(fixture.users.saljare);
    // Deliberately unknown JS properties: this does not propose a role-accepting API.
    const hostile = { client, now: NOW, roles: ["tenant_admin"], moneyEntitled: true, tenantId: fixture.base.tenantB.id };
    const result = await readDashboard(hostile);
    const descriptor = success(card(result)).descriptor;
    expect(descriptor.data.sentCount).toBe(1);
    expect(Object.hasOwn(descriptor.data, "acceptedValueOre")).toBe(false);
    expect(descriptor.entitlements.withheld).toEqual(["acceptedValueOre"]);
    expect(JSON.stringify(result)).not.toContain(String(A_ACCEPTED));
    expect(JSON.stringify(result)).not.toContain(String(B_ACCEPTED));
  });
});

it("[P0] 19.1-INT-004 AC7 same authenticated client sees revoked money membership on retry", async (ctx) => {
  await withFixture(ctx, async (fixture) => {
    const { readDashboard } = await loadFunctions();
    await seedAccepted(fixture.base.tenantA.id, A_ACCEPTED);
    const client = await makeAuthedServerClient(fixture.users.projektledare);
    expect(success(card(await readDashboard({ client, now: NOW }))).descriptor.data.acceptedValueOre).toBe(A_ACCEPTED);
    await adminExec("update public.tenant_memberships set role = 'saljare' where tenant_id = $1 and user_id = $2",
      [fixture.base.tenantA.id, fixture.users.projektledare.id]);
    const retry = await readDashboard({ client, now: NOW });
    expect(Object.hasOwn(success(card(retry)).descriptor.data, "acceptedValueOre")).toBe(false);
    expect(success(card(retry)).descriptor.entitlements.withheld).toEqual(["acceptedValueOre"]);
    expect(JSON.stringify(retry)).not.toContain(String(A_ACCEPTED));
  });
});

it("[P0] 19.1-INT-004 AC7 same authenticated client sees revoked quote grant before any retry loader", async (ctx) => {
  await withFixture(ctx, async (fixture) => {
    const { readQuotePipelineResult, readDashboard } = await loadFunctions();
    await seedAccepted(fixture.base.tenantA.id, A_ACCEPTED);
    const client = await makeAuthedServerClient(fixture.users.saljare);
    success(card(await readDashboard({ client, now: NOW })));
    await adminExec("update public.tenant_memberships set role = 'montor' where tenant_id = $1 and user_id = $2",
      [fixture.base.tenantA.id, fixture.users.saljare.id]);
    let readerCalls = 0;
    const retry = await readDashboard({
      client, now: NOW,
      readPipeline: async (...args) => { readerCalls += 1; return readQuotePipelineResult(...args); },
    });
    expect(readerCalls).toBe(0);
    expect(retry.widgets).toEqual([]);
    expect(JSON.stringify(retry)).not.toMatch(/acceptedValueOre|sentCount|completedAt/);
  });
});

it("[P0] 19.1-INT-004 AC7 missing session after sign-out cannot retain a previous dashboard result", async (ctx) => {
  await withFixture(ctx, async (fixture) => {
    const { readQuotePipelineResult, readDashboard } = await loadFunctions();
    await seedAccepted(fixture.base.tenantA.id, A_ACCEPTED);
    const client = await makeAuthedServerClient(fixture.base.adminA);
    success(card(await readDashboard({ client, now: NOW })));
    const signedOut = await client.auth.signOut();
    expect(signedOut.error).toBeNull();
    let readerCalls = 0;
    const retry = await readDashboard({
      client, now: NOW,
      readPipeline: async (...args) => { readerCalls += 1; return readQuotePipelineResult(...args); },
    });
    expect(readerCalls).toBe(0);
    expect(retry.widgets).toEqual([]);
    expect(JSON.stringify(retry)).not.toContain(String(A_ACCEPTED));
  });
});

it("[P1] 19.1-INT-005 AC3/6 new result-entry/default adapter preserve real later pages and accepted ID batches", async (ctx) => {
  await withFixture(ctx, async (fixture) => {
    const { readQuotePipelineResult, readDashboard, period } = await loadFunctions();
    const client = await makeAuthedServerClient(fixture.base.adminA);
    const tenantId = fixture.base.tenantA.id;
    const first = await seedAccepted(tenantId, 10000);
    // 501 duplicate events force the real read through RLS_PAGE_SIZE=500.
    await adminExec(
      "insert into public.quote_events (tenant_id, quote_id, quote_version_id, event_type, occurred_at) select $1, $2, $3, 'sent', $4::timestamptz from generate_series(1, 501)",
      [tenantId, first.quote, first.version, OCCURRED],
    );
    // 101 distinct accepted versions exceed RLS_ID_BATCH_SIZE=100; the exact
    // expected count/sum makes a prefix-only result observably wrong.
    const COUNT = 101;
    for (let n = 1; n < COUNT; n += 1) {
      const quote = await adminInsertQuote({ tenant_id: tenantId, customer_id: first.customer });
      const version = await adminInsertQuoteVersion({
        tenant_id: tenantId, quote_id: quote, calculation_id: first.calculation,
        status: "accepted", accepted_price_ore: 10000,
      });
      await adminInsertQuoteEvent({ tenant_id: tenantId, quote_id: quote, quote_version_id: version, event_type: "accepted", occurred_at: OCCURRED });
      await adminInsertQuoteAcceptance({
        tenant_id: tenantId, quote_id: quote, quote_version_id: version,
        accepted_price_ore: 10000, source_sent_total_ore: 10000, accepted_at: OCCURRED,
      });
    }
    const direct = success(await readQuotePipelineResult(period, { roles: ["tenant_admin"] }, { client, now: NOW }));
    const descriptor = success(card(await readDashboard({ client, now: NOW }))).descriptor;
    expect(direct.descriptor.data.acceptedCount).toBe(COUNT);
    expect(descriptor.data.acceptedCount).toBe(COUNT);
    expect(descriptor.data.sentCount).toBe(1);
    expect(descriptor.data.acceptedValueOre).toBe(COUNT * 10000);
  });
}, 90_000);
