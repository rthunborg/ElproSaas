/**
 * Story 19.1 production-server acceptance with local RLS fixtures and subject-bound read proxy.
 * Vanilla Playwright: configured utilities are absent (two-gate mandate).
 * Binding copy comes from the approved story; semantic names are provisional
 * accessible contracts, not an observed browser snapshot. No API route mocks.
 * The dedicated setup seeds isolated scenarios and filesystem-armed proxy plans.
 * Browser time is bounded against the real server completion instant; deterministic
 * period/completion-clock coverage is in unit tests. No production fault switch.
 */
import { test, expect } from "./guarded-test";
import type { Locator, Page } from "@playwright/test";
import { armReadPlan, releaseRead } from "./read-plan";
import { readFileSync } from "node:fs";
import path from "node:path";
import { adminQuery } from "../../factories/admin-sql";
import { aggregateQuotePipeline, resolvePipelinePeriod, type PipelineEventRow } from "../../../src/server/read-models/quote-pipeline-aggregate";
import { formatOreAsKronor } from "../../../src/lib/money";

type User = { id: string; email: string; password: string };
type Scenario = {
  user: User; tenantId: string; boundaryNow: string;
  plan: string;
  acceptedSentinelOre: number; frozenSentTotalOre: number;
};
type Fixture = {
  adminA: User; roleAware: { saljare: User; montor: User };
  notifications: { projectManager: User; finance: User };
  adminUserManagement: { sharedAccount: User };
  dashboard19?: Record<string, Scenario>;
};
function fixture(): Fixture {
  return JSON.parse(readFileSync(path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"), "utf8")) as Fixture;
}
function scenario(name: string): Scenario {
  const value = fixture().dashboard19?.[name];
  if (!value) throw new Error("Missing dashboard19." + name + " fixture and contained actual server-read harness; see ATDD fixture_needs");
  return value;
}
async function hydrated(locator: Locator) {
  await locator.waitFor({ state: "visible" });
  await locator.evaluate(element => new Promise<void>(resolve => {
    const tick = () => Object.keys(element).some(key => key.startsWith("__react")) ? resolve() : requestAnimationFrame(tick);
    tick();
  }));
}
async function login(page: Page, user: User) {
  await page.goto("/login");
  const submit = page.getByRole("button", { name: "Logga in", exact: true });
  await hydrated(submit);
  await page.getByLabel("E-post").fill(user.email);
  await page.getByLabel("Lösenord").fill(user.password);
  await submit.click();
  await page.waitForURL(/\/dashboard$/, { waitUntil: "commit" });
}
const card = (page: Page) => page.getByRole("region", { name: "Offertpipeline", exact: true });
async function source(data: Scenario) {
  // Trusted LOCAL test oracle only: the application's reads still use RLS.
  const events = await adminQuery<PipelineEventRow>(
    "select quote_version_id,event_type,occurred_at::text from public.quote_events where tenant_id=$1 and event_type in ('sent','accepted','lost') order by occurred_at,id", [data.tenantId]);
  const prices = await adminQuery<{ quote_version_id: string; accepted_price_ore: string }>(
    "select quote_version_id,accepted_price_ore::text from public.quote_acceptances where tenant_id=$1 order by quote_version_id,id", [data.tenantId]);
  return aggregateQuotePipeline({ events, acceptedVersions: prices.map(row => ({
    quote_version_id: row.quote_version_id, accepted_price_ore: Number(row.accepted_price_ore),
  })), followUps: [] }, resolvePipelinePeriod(data.boundaryNow), data.boundaryNow);
}
async function mutations(tenantId: string) {
  return adminQuery<{ table_name: string; rows: string }>(
    "select 'events' as table_name,coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb)::text as rows from public.quote_events e where tenant_id=$1 union all select 'acceptances',coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb)::text from public.quote_acceptances a where tenant_id=$1 union all select 'follow_ups',coalesce(jsonb_agg(to_jsonb(f) order by f.id),'[]'::jsonb)::text from public.quote_follow_ups f where tenant_id=$1 order by table_name", [tenantId]);
}
type PausedResponse = { requestId: string; responseStatusCode?: number;
  responseHeaders?: { name: string; value: string }[] };
/** Read real server bytes before the client can cancel/discard a consumed streamed response. */
async function observePayloads(page: Page) {
  const bodies: Promise<{ type: string; text: string; captureError: boolean }>[] = [];
  const session = await page.context().newCDPSession(page);
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL) throw new Error("Payload observation requires the configured application origin");
  session.on("Fetch.requestPaused", (paused: PausedResponse) => {
    bodies.push((async () => {
      const type = paused.responseHeaders?.find(header => header.name.toLowerCase() === "content-type")?.value ?? "";
      let text = "";
      let captureError = paused.responseStatusCode !== 200;
      try {
        const body = await session.send("Fetch.getResponseBody", { requestId: paused.requestId });
        text = body.base64Encoded ? Buffer.from(body.body, "base64").toString("utf8") : body.body;
      } catch { captureError = true; }
      finally {
        // Resume the original response without substituting bytes, headers, status or cookies.
        try { await session.send("Fetch.continueResponse", { requestId: paused.requestId }); }
        catch { captureError = true; }
      }
      return { type, text, captureError };
    })());
  });
  await session.send("Fetch.enable", { patterns: [{
    urlPattern: new URL("/dashboard", baseURL).href + "*", requestStage: "Response",
  }] });
  return { bodies, close: async () => {
    await Promise.all(bodies);
    await session.send("Fetch.disable");
    await session.detach();
  } };
}
test.describe("19.1-E2E-001 current roles and live card set", () => {
  for (const role of ["tenant_admin", "projektledare", "saljare", "multi-role"] as const) {
    // Contract: new card absent; uses EXISTING per-run role fixtures.
    test("[P0] " + role + " has one pipeline card and quotes deep link [AC2]", async ({ page }) => {
      const f = fixture();
      const users = { tenant_admin: f.adminA, projektledare: f.notifications.projectManager,
        saljare: f.roleAware.saljare, "multi-role": f.adminUserManagement.sharedAccount };
      await login(page, users[role]);
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
      await expect(card(page)).toHaveCount(1);
      await expect(card(page).getByRole("heading", { name: "Offertpipeline", exact: true })).toBeVisible();
      const link = card(page).getByRole("link", { name: "Visa offerter", exact: true });
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute("href", "/quotes");
      await expect(page.getByRole("region").filter({ hasText: /Kommer snart|Låst widget/ })).toHaveCount(0);
    });
  }
  for (const role of ["montor", "ekonomi"] as const) {
    // Contract: new eligibility contract; uses EXISTING per-run role fixtures.
    test("[P0] " + role + " has no pipeline, skeleton, false totals or deep link [AC2]", async ({ page }) => {
      const f = fixture();
      await login(page, role === "montor" ? f.roleAware.montor : f.notifications.finance);
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
      await expect(page.getByText("Detta är din operativa startvy.", { exact: false })).toBeVisible();
      await expect(card(page)).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Visa offerter", exact: true })).toHaveCount(0);
      await expect(page.getByText(/Kunde inte läsa offertpipeline|Inga offerthändelser under perioden/)).toHaveCount(0);
    });
  }
});

test.describe("19.1 actual source consistency and money delivery", () => {
  // Contract: card absent; pinned real source-history/clock fixture required.
  test("[P1] 19.1-E2E-002 source counts, adjusted commitment, dates, rate and read time [AC3,9]", async ({ page }) => {
    const startedAt = Date.now();
    const data = scenario("source-history");
    const expected = await source(data);
    await login(page, data.user);
    const pipeline = card(page);
    await expect(pipeline.getByLabel("Skickade", { exact: true })).toHaveText(String(expected.sentCount));
    await expect(pipeline.getByLabel("Accepterade", { exact: true })).toHaveText(String(expected.acceptedCount));
    await expect(pipeline.getByLabel("Förlorade", { exact: true })).toHaveText(String(expected.lostCount));
    await expect(pipeline.getByText(expected.period.from, { exact: false })).toBeVisible();
    await expect(pipeline.getByText(expected.period.to, { exact: false })).toBeVisible();
    await expect(pipeline.getByText("Accepterade / (accepterade + förlorade)", { exact: true })).toBeVisible();
    expect(expected.hitRate).not.toBeNull();
    const rate = await pipeline.getByLabel("Träffgrad", { exact: true }).innerText();
    expect(Number(rate.replace(/\s|%/g, "").replace(",", ".")) / 100).toBeCloseTo(expected.hitRate!, 2);
    await expect(pipeline.getByLabel("Accepterat värde", { exact: true })).toContainText(formatOreAsKronor(expected.acceptedValueOre));
    expect(expected.acceptedValueOre).toBe(data.acceptedSentinelOre);
    expect(expected.acceptedValueOre).not.toBe(data.frozenSentTotalOre);
    // Semantic <time datetime> is a proposed accessible presentation seam.
    const completed = Date.parse((await pipeline.locator("time").getAttribute("datetime"))!);
    expect(completed).toBeGreaterThanOrEqual(startedAt);
    expect(completed).toBeLessThanOrEqual(Date.now());
    await expect(pipeline.getByText(/^Hämtad /)).toBeVisible();
    await expect(pipeline.getByText(/realtid|senast ändrad/i)).toHaveCount(0);
  });
  // Contract: dedicated actual accepted-value sentinel + seller fixture required.
  test("[P0] 19.1-E2E-003 seller amount absent in initial HTML, RSC, DOM/attributes [AC4]", async ({ page }) => {
    const data = scenario("seller-sentinel");
    expect((await source(data)).acceptedValueOre).toBe(data.acceptedSentinelOre);
    expect(data.acceptedSentinelOre).toBeGreaterThan(0);
    const observed = await observePayloads(page);
    try {
      await login(page, data.user);
      const initialNavigationResponses = observed.bodies.length;
      const response = await page.goto("/dashboard");
      expect(response?.status()).toBe(200);
      const initialBodies = await Promise.all(observed.bodies);
      expect(initialBodies.every(body => !body.captureError), "Initial server bodies must be captured").toBe(true);
      const htmlBodies = initialBodies.filter(body => body.type.includes("text/html"));
      expect(htmlBodies.length, "Explicit HTML navigation must supply an observed document body").toBeGreaterThan(0);
      const initialHtml = htmlBodies.at(-1)!.text;
      await expect(card(page).getByText("Dold", { exact: true })).toBeVisible();
      await expect(card(page).getByText("Dolt för din roll", { exact: true })).toBeAttached();
      for (const html of [initialHtml, await page.content()]) {
        expect(html).not.toContain(String(data.acceptedSentinelOre));
        expect(html).not.toContain(formatOreAsKronor(data.acceptedSentinelOre));
        // A withheld LIST entry is permitted; a serialized money PROPERTY is not.
        expect(html).not.toMatch(/(?:\\?")acceptedValueOre(?:\\?")\s*:/);
      }
      await card(page).getByRole("link", { name: "Visa offerter", exact: true }).click();
      await expect(page).toHaveURL(/\/quotes$/);
      await page.getByRole("navigation", { name: "Huvudnavigation" }).first()
        .getByRole("link", { name: "Dashboard", exact: true }).click();
      await expect(card(page).getByText("Dold", { exact: true })).toBeVisible();
      const delivered = await Promise.all(observed.bodies);
      expect(delivered.slice(initialNavigationResponses).some(body => body.type.includes("text/x-component"))).toBe(true);
      console.info("19.1 seller payload evidence", { initialNavigationResponses, htmlResponses: htmlBodies.length,
        observedDashboardResponses: delivered.length, laterRscResponses: delivered.slice(initialNavigationResponses).filter(body => body.type.includes("text/x-component")).length });
      for (const body of delivered) {
        expect(body.captureError, "Every required dashboard response must be captured").toBe(false);
        expect(body.text).not.toContain(String(data.acceptedSentinelOre));
        expect(body.text).not.toContain(formatOreAsKronor(data.acceptedSentinelOre));
        expect(body.text).not.toMatch(/(?:\\?")acceptedValueOre(?:\\?")\s*:/);
      }
      const mask = card(page).getByRole("button", { name: "Dolt för din roll", exact: true });
      await mask.focus();
      await expect(mask).toBeFocused();
      await mask.hover();
      await expect(page.getByRole("tooltip", { name: "Din roll ser inte belopp", exact: true })).toBeVisible();
    } finally { await observed.close(); }
  });
  // Contract: equivalent entitled synthetic membership and new card required.
  test("[P0] 19.1-E2E-003 entitled control shows actual accepted sentinel [AC4]", async ({ page }) => {
    const data = scenario("entitled-sentinel");
    await login(page, data.user);
    await expect(card(page).getByLabel("Accepterat värde", { exact: true })).toContainText(formatOreAsKronor(data.acceptedSentinelOre));
    await expect(card(page).getByText("Dold", { exact: true })).toHaveCount(0);
  });
  for (const name of ["empty-entitled", "empty-withheld", "sent-only", "entitled-zero"] as const) {
    // Contract: state UI/isolated source fixture absent. Source is real, not route-stubbed.
    test("[P1] 19.1-E2E-004 " + name + " has honest period/zero/null-rate copy [AC4,5]", async ({ page }) => {
      const data = scenario(name);
      const expected = await source(data);
      await login(page, data.user);
      const pipeline = card(page);
      await expect(pipeline.getByText("Kunde inte läsa offertpipeline")).toHaveCount(0);
      await expect(pipeline.getByText("Ingen träffgrad ännu", { exact: true })).toBeVisible();
      await expect(pipeline.getByText(/inga offerter finns|0\s*%/i)).toHaveCount(0);
      await expect(pipeline.getByText("Inga offerthändelser under perioden", { exact: true })).toHaveCount(name.startsWith("empty") ? 1 : 0);
      await expect(pipeline.getByLabel("Skickade", { exact: true })).toHaveText(String(expected.sentCount));
      await expect(pipeline.getByText("Dold", { exact: true })).toHaveCount(name === "empty-withheld" ? 1 : 0);
      if (name !== "empty-withheld") {
        expect(expected.acceptedValueOre).toBe(0);
        await expect(pipeline.getByLabel("Accepterat värde", { exact: true })).toContainText(formatOreAsKronor(0));
      }
      await expect(pipeline.getByText(/^Hämtad /)).toBeVisible();
    });
  }
});

test.describe("19.1 real server-failure recovery and current authority", () => {
  // Contract: contained server-fault fixture absent; browser interception is not DB proof.
  test("[P0] 19.1-E2E-005 failure remains local and keeps heading/checklist usable [AC6]", async ({ page }) => {
    const data = scenario("failure-isolation");
    await login(page, data.user);
    const pipeline = card(page);
    await expect(pipeline.getByRole("alert")).toContainText("Kunde inte läsa offertpipeline");
    await expect(pipeline.getByRole("button", { name: "Försök igen", exact: true })).toBeEnabled();
    await expect(pipeline.getByText(/Hämtad|Inga offerthändelser|Skickade|Accepterat värde|0,00/)).toHaveCount(0);
    await expect(pipeline.getByText(/SQLSTATE|quote_acceptances|stack|PostgREST/i)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByRole("list", { name: "Kom igång-steg", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dölj tills vidare", exact: true })).toBeEnabled();
  });
  for (const outcome of ["recovery", "failure"] as const) {
    // Contract: harness must hold actual retry read through observable loading, then
    // release its prearmed result. Harness orchestration is still a setup gap.
    test("[P1] 19.1-E2E-006 retry " + outcome + " announces loading without side effects [AC7]", async ({ page }) => {
      const data = scenario("retry-" + outcome);
      const before = await mutations(data.tenantId);
      await login(page, data.user);
      await expect(card(page).getByRole("alert")).toContainText("Kunde inte läsa offertpipeline");
      const retry = card(page).getByRole("button", { name: "Försök igen", exact: true });
      await hydrated(retry);
      await retry.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
      await expect(card(page).getByRole("status")).toHaveAttribute("aria-live", "polite");
      await expect(card(page)).toHaveAttribute("aria-busy", "true");
      await expect(card(page).getByText(/^Hämtad /)).toHaveCount(0);
      const completedAfter = Date.now();
      releaseRead(data.plan);
      if (outcome === "recovery") {
        await expect(card(page).getByRole("alert")).toHaveCount(0);
        await expect(card(page).locator("time")).toBeVisible();
        expect(Date.parse((await card(page).locator("time").getAttribute("datetime"))!)).toBeGreaterThanOrEqual(completedAfter);
        await expect(card(page).getByLabel("Accepterat värde", { exact: true })).toContainText(formatOreAsKronor(data.acceptedSentinelOre));
      } else {
        await expect(card(page).getByRole("alert")).toContainText("Kunde inte läsa offertpipeline");
        await expect(card(page).getByText(/Hämtad|Skickade|0,00|Inga offerthändelser/)).toHaveCount(0);
      }
      expect(await mutations(data.tenantId)).toEqual(before);
    });
  }
  for (const revoked of ["quote", "money"] as const) {
    // Contract: success→real failure→retry plan and unique membership fixture required.
    test("[P0] 19.1-E2E-007 " + revoked + " revoked in same session before retry [AC7]", async ({ page }) => {
      const data = scenario("revoke-" + revoked);
      const memberships = await adminQuery<{ id: string; role: string }>(
        "select id,role from public.tenant_memberships where tenant_id=$1 and user_id=$2 and status='active'", [data.tenantId, data.user.id]);
      expect(memberships).toHaveLength(1);
      const roles = await adminQuery<{ role: string }>(
        "select role from public.membership_roles where tenant_id=$1 and membership_id=$2 order by role", [data.tenantId, memberships[0].id]);
      await login(page, data.user);
      await expect(card(page).getByLabel("Accepterat värde", { exact: true })).toContainText(formatOreAsKronor(data.acceptedSentinelOre));
      await page.reload(); // harness fails this actual read and discards prior success
      await expect(card(page).getByRole("alert")).toContainText("Kunde inte läsa offertpipeline");
      await expect(card(page).getByText(/^Hämtad /)).toHaveCount(0);
      const role = revoked === "quote" ? "montor" : "saljare";
      try {
        await adminQuery("update public.tenant_memberships set role=$3 where tenant_id=$1 and id=$2", [data.tenantId, memberships[0].id, role]);
        await adminQuery("delete from public.membership_roles where tenant_id=$1 and membership_id=$2", [data.tenantId, memberships[0].id]);
        await adminQuery("insert into public.membership_roles (tenant_id,membership_id,role) values ($1,$2,$3)", [data.tenantId, memberships[0].id, role]);
        const observed = await observePayloads(page);
        try {
          await card(page).getByRole("button", { name: "Försök igen", exact: true }).click();
          if (revoked === "quote") {
            await expect(card(page)).toHaveCount(0);
            await expect(page.getByRole("link", { name: "Visa offerter", exact: true })).toHaveCount(0);
          } else {
            await expect(card(page).getByText("Dold", { exact: true })).toBeVisible();
            await expect(card(page).getByText("Dolt för din roll", { exact: true })).toBeAttached();
          }
          const delivered = await Promise.all(observed.bodies);
          expect(delivered.length).toBeGreaterThan(0);
          for (const body of delivered) {
            expect(body.captureError, "Every required dashboard response must be captured").toBe(false);
            expect(body.text).not.toContain(String(data.acceptedSentinelOre));
            expect(body.text).not.toContain(formatOreAsKronor(data.acceptedSentinelOre));
          }
          expect(await page.content()).not.toContain(formatOreAsKronor(data.acceptedSentinelOre));
          await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
        } finally { await observed.close(); }
      } finally {
        await adminQuery("update public.tenant_memberships set role=$3 where tenant_id=$1 and id=$2", [data.tenantId, memberships[0].id, memberships[0].role]);
        await adminQuery("delete from public.membership_roles where tenant_id=$1 and membership_id=$2", [data.tenantId, memberships[0].id]);
        for (const row of roles) await adminQuery("insert into public.membership_roles (tenant_id,membership_id,role) values ($1,$2,$3)", [data.tenantId, memberships[0].id, row.role]);
      }
    });
  }
  // Contract: actual failure scenario required; invalidate actual browser session.
  test("[P0] 19.1-E2E-007 session lost before retry returns safely to login [AC7]", async ({ page, context }) => {
    const data = scenario("retry-session-lost");
    await login(page, data.user);
    await expect(card(page).getByRole("alert")).toContainText("Kunde inte läsa offertpipeline");
    await context.clearCookies();
    await card(page).getByRole("button", { name: "Försök igen", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(card(page)).toHaveCount(0);
    expect(await page.content()).not.toContain(String(data.acceptedSentinelOre));
  });
});

test.describe("19.1 onboarding composition and accessible responsive layout", () => {
  for (const outcome of ["success", "error"] as const) {
    for (const onboarding of ["undismissed", "dismissed", "completed", "non-admin", "invisible", "read-failure"] as const) {
      // Contract: isolated reader-state fixtures needed. Reuse existing full dismiss/
      // restore/completion regression, do not duplicate its mutation journey.
      test("[P1] 19.1-E2E-008 " + outcome + " preserves " + onboarding + " onboarding [AC8]", async ({ page }) => {
        const data = scenario("onboarding-" + onboarding + "-" + outcome);
        await login(page, data.user);
        await expect(card(page)).toHaveCount(1);
        await expect(card(page).getByText("Kunde inte läsa offertpipeline")).toHaveCount(outcome === "error" ? 1 : 0);
        await expect(page.getByRole("heading", { name: "Kom igång", exact: true })).toHaveCount(onboarding === "undismissed" ? 1 : 0);
        await expect(page.getByRole("button", { name: "Visa checklistan igen", exact: true })).toHaveCount(onboarding === "dismissed" ? 1 : 0);
        await expect(page.getByRole("list", { name: "Kom igång-steg", exact: true })).toHaveCount(onboarding === "undismissed" ? 1 : 0);
        await expect(page.getByText("Offertvillkoren är sparade men saknar fortfarande juridiskt godkännande.", { exact: true })).toHaveCount(onboarding === "undismissed" ? 1 : 0);
        await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
      });
    }
  }
  // Contract: new mask absent; only EXISTING seller credentials needed.
  test("[P1] 19.1-E2E-009 keyboard reaches mask explanation and authorized quotes [AC9]", async ({ page }) => {
    await login(page, fixture().roleAware.saljare);
    const mask = card(page).getByRole("button", { name: "Dolt för din roll", exact: true });
    await hydrated(mask);
    await mask.focus();
    await expect(mask).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tooltip", { name: "Din roll ser inte belopp", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    const link = card(page).getByRole("link", { name: "Visa offerter", exact: true });
    await expect(link).toHaveCount(1);
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/quotes$/);
    await expect(page.getByRole("heading", { name: "Offerter", exact: true })).toBeVisible();
  });
  test("[P1] 19.1-E2E-009 tooltip retains real pointer passage into its explanation [AC4,9]", async ({ page }) => {
    await login(page, fixture().roleAware.saljare);
    const mask = card(page).getByRole("button", { name: "Dolt för din roll", exact: true });
    await hydrated(mask);
    await mask.hover();
    const tooltip = page.getByRole("tooltip", { name: "Din roll ser inte belopp", exact: true });
    await expect(tooltip).toBeVisible();
    const from = (await mask.boundingBox())!;
    const to = (await tooltip.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.move(to.x + Math.min(from.width / 2, to.width / 2), to.y + to.height / 2, { steps: 12 });
    await expect(tooltip).toBeVisible();
    await page.mouse.move(0, 0, { steps: 12 });
    await expect(tooltip).toHaveCount(0);
  });
  test("[P1] 19.1-E2E-009 hover tooltip dismisses Escape while focus remains elsewhere [AC4,9]", async ({ page }) => {
    await login(page, fixture().roleAware.saljare);
    const elsewhere = card(page).getByRole("link", { name: "Visa offerter", exact: true });
    const mask = card(page).getByRole("button", { name: "Dolt för din roll", exact: true });
    await hydrated(mask);
    await elsewhere.focus();
    await expect(elsewhere).toBeFocused();
    await mask.hover();
    await expect(elsewhere).toBeFocused();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await expect(elsewhere).toBeFocused();
  });
  // Contract: new mask absent; clock controls gesture duration, not server read clock.
  test("[P1] 19.1-E2E-009 mobile long press shows role explanation [AC4,9]", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await login(page, fixture().roleAware.saljare);
    const mask = card(page).getByRole("button", { name: "Dolt för din roll", exact: true });
    await hydrated(mask);
    await page.clock.install();
    await mask.dispatchEvent("pointerdown", { pointerType: "touch", pointerId: 1, isPrimary: true, button: 0, buttons: 1 });
    await page.clock.fastForward(1000); // controlled user gesture timer, no sleep
    await mask.dispatchEvent("pointerup", { pointerType: "touch", pointerId: 1, isPrimary: true, button: 0, buttons: 0 });
    await expect(page.getByRole("tooltip", { name: "Din roll ser inte belopp", exact: true })).toBeVisible();
    await expect(card(page).getByText("Dold", { exact: true })).toBeVisible();
  });
  for (const viewport of [
    { name: "mobile", width: 360, height: 640 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
  ]) {
    // Contract: live widget absent; only EXISTING role credentials needed.
    test("[P1] 19.1-E2E-010 " + viewport.name + " live full-width row fits [AC9]", async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await login(page, fixture().roleAware.saljare);
      await expect(card(page)).toBeVisible();
      await expect(card(page).getByRole("link", { name: "Visa offerter", exact: true })).toBeVisible();
      const header = page.getByRole("banner");
      const controls = [header.getByRole("button", { name: /^Notiser/ }),
        header.getByRole("button", { name: "Profil", exact: true }),
        header.getByRole("button", { name: "Logga ut", exact: true })];
      if (viewport.name === "mobile") controls.push(header.getByRole("button", { name: "Öppna meny", exact: true }));
      for (const control of [...controls, header.getByTestId("tenant-context")]) {
        await expect(control).toBeVisible();
        const bounds = await control.boundingBox();
        expect(bounds!.width).toBeGreaterThan(0);
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      }
      const bell = header.getByRole("button", { name: /^Notiser/ });
      await hydrated(bell);
      await bell.click();
      const notifications = header.getByRole("dialog", { name: "Notiser", exact: true });
      await expect(notifications).toBeVisible();
      const notificationBounds = (await notifications.boundingBox())!;
      expect(notificationBounds.width).toBeGreaterThan(0);
      expect(notificationBounds.x).toBeGreaterThanOrEqual(0);
      expect(notificationBounds.x + notificationBounds.width).toBeLessThanOrEqual(viewport.width);
      const allNotifications = notifications.getByRole("link", { name: "Visa alla", exact: true });
      await expect(allNotifications).toBeVisible();
      await expect(allNotifications).toHaveAttribute("href", "/notifications");
      await allNotifications.click({ trial: true });
      await page.keyboard.press("Escape");
      await expect(notifications).toHaveCount(0);
      await expect(bell).toBeFocused();
      const profile = header.getByRole("button", { name: "Profil", exact: true });
      await profile.click();
      const preferences = header.getByRole("link", { name: "Notisinställningar", exact: true });
      await expect(preferences).toBeVisible();
      const menuBounds = (await preferences.boundingBox())!;
      expect(menuBounds.x).toBeGreaterThanOrEqual(0);
      expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(viewport.width);
      await profile.click();
      const box = await card(page).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
      const widths = await card(page).evaluate(element => ({
        card: element.getBoundingClientRect().width, grid: element.parentElement!.getBoundingClientRect().width }));
      expect(Math.abs(widths.grid - widths.card)).toBeLessThanOrEqual(2);
    });
    for (const state of ["loading", "error", "empty", "withheld"] as const) {
      // Contract: contained state fixture required, including a held actual loading read.
      test("[P1] 19.1-E2E-010 " + viewport.name + " " + state + " fits with useful dimensions [AC9]", async ({ page }) => {
        const data = scenario("layout-" + state);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await login(page, data.user);
        let heldPlan: string | undefined;
        if (state === "loading") {
          heldPlan = armReadPlan(data.user.id, { quote_events: [{ outcome: "pass", hold: true }] });
          await page.reload({ waitUntil: "commit" });
        }
        await expect(card(page)).toBeVisible();
        const box = await card(page).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThan(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
        await expect(card(page).getByText("Kunde inte läsa offertpipeline")).toHaveCount(state === "error" ? 1 : 0);
        await expect(card(page).getByText("Inga offerthändelser under perioden")).toHaveCount(state === "empty" ? 1 : 0);
        await expect(card(page).getByText("Dold", { exact: true })).toHaveCount(state === "withheld" ? 1 : 0);
        if (state === "loading") {
          await expect(card(page)).toHaveAttribute("aria-busy", "true");
          await expect(card(page).getByRole("status")).toHaveAttribute("aria-live", "polite");
          await expect(card(page).getByText(/^Hämtad /)).toHaveCount(0);
          releaseRead(heldPlan!);
          await expect(card(page).locator("time")).toBeVisible();
        }
      });
    }
  }
});

test("[P1] 19.1-E2E-011 successive failed retries recover in the same session [AC7]", async ({ page }) => {
  const data = scenario("retry-failure");
  const expected = await source(data);
  const before = await mutations(data.tenantId);
  // Fresh revisions make this independent of the earlier retry-failure case and repeat-each.
  armReadPlan(data.user.id, { quote_events: [{ outcome: "error" }] });
  try {
    await login(page, data.user);
    const pipeline = card(page);
    const retry = pipeline.getByRole("button", { name: "Försök igen", exact: true });
    await expect(pipeline.getByRole("alert")).toContainText("Kunde inte läsa offertpipeline");
    for (const outcome of ["error", "error", "pass"] as const) {
      await expect(retry).toBeEnabled();
      await hydrated(retry);
      // The root-owned proxy holds the actual server read, not a browser response mock.
      const revision = armReadPlan(data.user.id, { quote_events: [{ outcome, hold: true }] });
      let releasedAt = 0;
      try {
        await retry.click();
        await expect(pipeline).toHaveAttribute("aria-busy", "true");
        await expect(pipeline.getByRole("status")).toHaveAttribute("aria-live", "polite");
        await expect(pipeline.getByRole("status")).toContainText("Läser offertpipeline");
        await expect(pipeline.getByRole("alert")).toHaveCount(0);
        await expect(pipeline.getByRole("button", { name: "Försök igen", exact: true })).toHaveCount(0);
        await expect(pipeline.locator("time")).toHaveCount(0);
        await expect(pipeline.getByText(/Hämtad|Inga offerthändelser|Skickade|Accepterat värde/)).toHaveCount(0);
      } finally {
        releasedAt = Date.now();
        releaseRead(revision);
      }
      if (outcome === "error") {
        await expect(pipeline.getByRole("alert")).toContainText("Kunde inte läsa offertpipeline");
        await expect(retry).toBeEnabled();
        await expect(pipeline).not.toHaveAttribute("aria-busy", "true");
        await expect(pipeline.locator("time")).toHaveCount(0);
        await expect(pipeline.getByText(/Hämtad|Inga offerthändelser|Skickade|Accepterat värde|0,00/)).toHaveCount(0);
        await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
      } else {
        await expect(pipeline.getByRole("alert")).toHaveCount(0);
        await expect(retry).toHaveCount(0);
        await expect(pipeline).not.toHaveAttribute("aria-busy", "true");
        await expect(pipeline.getByLabel("Skickade", { exact: true })).toHaveText(String(expected.sentCount));
        await expect(pipeline.getByLabel("Accepterade", { exact: true })).toHaveText(String(expected.acceptedCount));
        await expect(pipeline.getByLabel("Förlorade", { exact: true })).toHaveText(String(expected.lostCount));
        await expect(pipeline.getByLabel("Accepterat värde", { exact: true })).toContainText(formatOreAsKronor(expected.acceptedValueOre));
        await expect(pipeline.getByText(/^Hämtad /)).toBeVisible();
        const completed = Date.parse((await pipeline.locator("time").getAttribute("datetime"))!);
        expect(completed).toBeGreaterThanOrEqual(releasedAt);
        expect(completed).toBeLessThanOrEqual(Date.now());
      }
    }
    expect(await mutations(data.tenantId)).toEqual(before);
  } finally {
    // Keep this synthetic subject unavailable for any later repeat without retaining a hold.
    armReadPlan(data.user.id, { quote_events: [{ outcome: "error" }] });
  }
});