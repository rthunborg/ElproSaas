/** Story 10.5 DB hardening and PostgREST max_rows regression coverage. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminInsertCalculation, adminInsertCustomer, adminInsertQuote, adminInsertQuoteVersion, cleanupFixture, createTwoTenantFixture, makeAuthedServerClient, type TestServerClient, type TwoTenantFixture } from "../../factories/tenants";
import { adminExec, adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { calendarDayIn } from "@/features/quotes/follow-up-dates";
import { runCommand } from "@/server/commands/envelope";
import { completeQuoteFollowUp, markQuoteVersionLost, planQuoteFollowUp } from "@/server/commands/quotes";
import { readQuoteDetail } from "@/features/quotes/read";
import { readQuotePipeline } from "@/server/read-models/quote-pipeline";
import { resolvePipelinePeriod } from "@/server/read-models/quote-pipeline-aggregate";

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient;
const NOW = new Date().toISOString();
const TODAY = calendarDayIn(NOW, "Europe/Stockholm");
function dayOffset(days: number): string { const value = new Date(`${TODAY}T12:00:00.000Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }
beforeAll(async () => { stackUp = await isLocalStackReachable(); if (!stackUp) return; fixture = await createTwoTenantFixture(); a = await makeAuthedServerClient(fixture.adminA); });
afterAll(async () => { if (stackUp && fixture) await cleanupFixture(fixture); });
async function seedVersion(status: "draft" | "sent" = "sent") {
  const tenantId = fixture.tenantA.id;
  const customerId = await adminInsertCustomer({ tenant_id: tenantId, customer_type: "company", display_name: `hardening-${crypto.randomUUID()}` });
  const calculationId = await adminInsertCalculation({ tenant_id: tenantId, customer_id: customerId, title: `hardening-${crypto.randomUUID()}` });
  const quoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
  const versionId = await adminInsertQuoteVersion({ tenant_id: tenantId, quote_id: quoteId, calculation_id: calculationId, status });
  return { tenantId, quoteId, versionId };
}

describe("[P0][10.5] quote-table hardening and paginated read-model contracts", () => {
  it("10.5-INT-01/02 closes authenticated follow-up DML while the checked command derives the only valid anchor", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const sent = await seedVersion();
    const planned = await runCommand(planQuoteFollowUp, {
      client: a as never,
      input: { quote_version_id: sent.versionId, due_date: dayOffset(1) },
      correlationId: crypto.randomUUID(),
    });
    expect(planned.ok).toBe(true); if (!planned.ok) return;
    const rawInsert = await a.from("quote_follow_ups").insert({
      tenant_id: sent.tenantId, quote_id: sent.quoteId, quote_version_id: sent.versionId,
      due_date: dayOffset(2), status: "open",
    }).select("id");
    expect(rawInsert.error?.code).toBe("42501");
    const rawUpdate = await a.from("quote_follow_ups").update({ note: "bypass" })
      .eq("id", planned.data.targetId).select();
    expect(rawUpdate.error?.code).toBe("42501");
    expect((await a.from("quote_follow_ups").delete().eq("id", planned.data.targetId).select()).error?.code).toBe("42501");
  });

  it("10.5-INT-05 preserves the Story 10.8 direct event/lost-reason DML denial boundary", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const seeded = await seedVersion();
    const beforeEvents = await adminQuery<{ count: string }>("select count(*)::text as count from public.quote_events where quote_version_id = $1", [seeded.versionId]);
    const event = await a.from("quote_events").insert({ tenant_id: seeded.tenantId, quote_id: seeded.quoteId, quote_version_id: seeded.versionId, event_type: "lost", occurred_at: NOW }).select();
    expect(event.error?.code).toBe("42501");
    const reason = await a.from("quote_lost_reasons").insert({ tenant_id: seeded.tenantId, quote_id: seeded.quoteId, quote_version_id: seeded.versionId, outcome: "forlorad", category: "pris" }).select();
    expect(reason.error?.code).toBe("42501");
    expect((await adminQuery<{ count: string }>("select count(*)::text as count from public.quote_events where quote_version_id = $1", [seeded.versionId]))[0]?.count).toBe(beforeEvents[0]?.count);
    expect((await adminQuery<{ count: string }>("select count(*)::text as count from public.quote_lost_reasons where quote_version_id = $1", [seeded.versionId]))[0]?.count).toBe("0");
  });

  it("10.5-INT-03 blocks a terminal transition while an open follow-up anchors the sent version", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const seeded = await seedVersion();
    const planned = await runCommand(planQuoteFollowUp, { client: a as never, input: { quote_version_id: seeded.versionId, due_date: dayOffset(1) }, correlationId: crypto.randomUUID() });
    expect(planned.ok).toBe(true); if (!planned.ok) return;
    const followUpId = planned.data.targetId;
    expect((await runCommand(markQuoteVersionLost, { client: a as never, input: { quote_version_id: seeded.versionId, outcome: "forlorad", category: "pris" }, correlationId: crypto.randomUUID() })).ok).toBe(false);
    expect((await adminQuery<{ status: string }>("select status from public.quote_versions where id = $1", [seeded.versionId]))[0]?.status).toBe("sent");
    if (typeof followUpId !== "string") return;
    expect((await runCommand(completeQuoteFollowUp, { client: a as never, input: { follow_up_id: followUpId, outcome: "klart" }, correlationId: crypto.randomUUID() })).ok).toBe(true);
    expect((await runCommand(markQuoteVersionLost, { client: a as never, input: { quote_version_id: seeded.versionId, outcome: "forlorad", category: "pris" }, correlationId: crypto.randomUUID() })).ok).toBe(true);
  });

  it("10.5-INT-03 race: planning and loss leave either a sent open plan or a terminal version, never both", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const seeded = await seedVersion();
    const [planned, lost] = await Promise.all([
      runCommand(planQuoteFollowUp, { client: a as never, input: { quote_version_id: seeded.versionId, due_date: dayOffset(1), note: "race" }, correlationId: crypto.randomUUID() }),
      runCommand(markQuoteVersionLost, { client: a as never, input: { quote_version_id: seeded.versionId, outcome: "forlorad", category: "pris" }, correlationId: crypto.randomUUID() }),
    ]);
    expect(Number(planned.ok) + Number(lost.ok)).toBe(1);
    const status = (await adminQuery<{ status: string }>("select status from public.quote_versions where id = $1", [seeded.versionId]))[0]?.status;
    const open = await adminQuery<{ count: string }>("select count(*)::text as count from public.quote_follow_ups where quote_version_id = $1 and status = 'open'", [seeded.versionId]);
    if (planned.ok) {
      expect(status).toBe("sent");
      expect(open[0]?.count).toBe("1");
    } else {
      expect(status).toBe("lost");
      expect(open[0]?.count).toBe("0");
    }
  });

  it("10.5-INT-04 reads an in-window lifecycle event beyond PostgREST's first 1,000 rows", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const seeded = await seedVersion();
    const before = await readQuotePipeline(resolvePipelinePeriod(NOW), { roles: ["tenant_admin"] }, { client: a as never, now: NOW });
    const beforeEventCount = await adminQuery<{ count: string }>("select count(*)::text as count from public.quote_events where quote_version_id = $1", [seeded.versionId]);
    await adminExec(`insert into public.quote_events (tenant_id, quote_id, quote_version_id, event_type, occurred_at) select $1, $2, $3, 'sent', $4::timestamptz from generate_series(1, 1001)`, [seeded.tenantId, seeded.quoteId, seeded.versionId, NOW]);
    await adminExec(`insert into public.quote_events (tenant_id, quote_id, quote_version_id, event_type, occurred_at) values ($1, $2, $3, 'lost', $4::timestamptz)`, [seeded.tenantId, seeded.quoteId, seeded.versionId, NOW]);
    const result = await readQuotePipeline(resolvePipelinePeriod(NOW), { roles: ["tenant_admin"] }, { client: a as never, now: NOW });
    // The lost event is deliberately inserted after 1,001 rows. The fixture
    // suite may already have a lost event for this tenant, so assert its delta.
    expect(result.data.lostCount).toBe(before.data.lostCount + 1);
    const detail = await readQuoteDetail(seeded.quoteId, seeded.versionId, { client: a as never, now: new Date(NOW) });
    expect(detail.error).toBeNull();
    expect(detail.detail?.events).toHaveLength(Number(beforeEventCount[0]?.count) + 1002);
    expect(detail.detail?.events.some((event) => event.event_type === "lost")).toBe(true);
  });
});
