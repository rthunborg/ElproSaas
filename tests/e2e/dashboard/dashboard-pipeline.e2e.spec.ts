/**
 * 19.1 RED: remove skips only when the card and named prerequisites exist.
 * Vanilla Playwright: configured utilities are absent (two-gate mandate).
 * Binding copy comes from the approved story; semantic names are provisional
 * accessible contracts, not an observed browser snapshot. No API route mocks.
 * New dashboard19 fixture metadata below is an explicit SETUP NEED. It cannot
 * itself inject a server fault. A contained test harness must arm the real
 * readQuotePipelineResult dependency/clock per unique scenario user, retain its
 * actual query/aggregation/projection, and sequence failure/held/success reads.
 * Never implement this as a production env flag or publicly callable endpoint.
 */
import { test, expect, type Locator, type Page, type Response } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { adminQuery } from "../../factories/admin-sql";
import { aggregateQuotePipeline, resolvePipelinePeriod, type PipelineEventRow } from "../../../src/server/read-models/quote-pipeline-aggregate";
import { formatOreAsKronor } from "../../../src/lib/money";

type User = { id: string; email: string; password: string };
type Scenario = {
  user: User; tenantId: string; boundaryNow: string;
  completionInstants: readonly string[];
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
  await page.waitForURL(/\/dashboard$/);
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
function observePayloads(page: Page) {
  const bodies: Promise<{ type: string; text: string }>[] = [];
  const listener = (response: Response) => {
    const type = response.headers()["content-type"] ?? "";
    if (new URL(response.url()).origin === new URL(page.url()).origin &&
        new URL(response.url()).pathname === "/dashboard" &&
        /text\/html|text\/x-component|application\/json/.test(type))
      bodies.push(response.text().then(text => ({ type, text })));
  };
  page.on("response", listener); // before tested navigation/refresh
  return { bodies, close: () => page.off("response", listener) };
}

test.describe("19.1-E2E-001 current roles and live card set", () => {
  for (const role of ["tenant_admin", "projektledare", "saljare", "multi-role"] as const) {
    // RED: new card absent; uses EXISTING per-run role fixtures.
    test.skip("[P0] " + role + " has one pipeline card and quotes deep link [AC2]", async ({ page }) => {
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
    // RED: new eligibility contract; uses EXISTING per-run role fixtures.
    test.skip("[P0] " + role + " has no pipeline, skeleton, false totals or deep link [AC2]", async ({ page }) => {
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
  // RED: card absent; pinned real source-history/clock fixture required.
  test.skip("[P1] 19.1-E2E-002 source counts, adjusted commitment, dates, rate and read time [AC3,9]", async ({ page }) => {
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
    await expect(pipeline.locator("time")).toHaveAttribute("datetime", data.completionInstants[0]);
    await expect(pipeline.getByText(/^Hämtad /)).toBeVisible();
    await expect(pipeline.getByText(/realtid|senast ändrad/i)).toHaveCount(0);
  });
  // RED: dedicated actual accepted-value sentinel + seller fixture required.
  test.skip("[P0] 19.1-E2E-003 seller amount absent in initial HTML, RSC, DOM/attributes [AC4]", async ({ page }) => {
    const data = scenario("seller-sentinel");
    expect((await source(data)).acceptedValueOre).toBe(data.acceptedSentinelOre);
    expect(data.acceptedSentinelOre).toBeGreaterThan(0);
    await login(page, data.user);
    const observed = observePayloads(page);
    try {
      const response = await page.goto("/dashboard");
      expect(response?.status()).toBe(200);
      const initialHtml = await response!.text();
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
      expect(delivered.some(body => body.type.includes("text/x-component"))).toBe(true);
      for (const body of delivered) {
        expect(body.text).not.toContain(String(data.acceptedSentinelOre));
        expect(body.text).not.toContain(formatOreAsKronor(data.acceptedSentinelOre));
        expect(body.text).not.toMatch(/(?:\\?")acceptedValueOre(?:\\?")\s*:/);
      }
      const mask = card(page).getByRole("button", { name: "Dolt för din roll", exact: true });
      await mask.focus();
      await expect(mask).toBeFocused();
      await mask.hover();
      await expect(page.getByRole("tooltip", { name: "Din roll ser inte belopp", exact: true })).toBeVisible();
    } finally { observed.close(); }
  });
  // RED: equivalent entitled synthetic membership and new card required.
  test.skip("[P0] 19.1-E2E-003 entitled control shows actual accepted sentinel [AC4]", async ({ page }) => {
    const data = scenario("entitled-sentinel");
    await login(page, data.user);
    await expect(card(page).getByLabel("Accepterat värde", { exact: true })).toContainText(formatOreAsKronor(data.acceptedSentinelOre));
    await expect(card(page).getByText("Dold", { exact: true })).toHaveCount(0);
  });
  for (const name of ["empty-entitled", "empty-withheld", "sent-only", "entitled-zero"] as const) {
    // RED: state UI/isolated source fixture absent. Source is real, not route-stubbed.
    test.skip("[P1] 19.1-E2E-004 " + name + " has honest period/zero/null-rate copy [AC4,5]", async ({ page }) => {
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
  // RED: contained server-fault fixture absent; browser interception is not DB proof.
  test.skip("[P0] 19.1-E2E-005 failure remains local and keeps heading/checklist usable [AC6]", async ({ page }) => {
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
    // RED: harness must hold actual retry read through observable loading, then
    // release its prearmed result. Harness orchestration is still a setup gap.
    test.skip("[P1] 19.1-E2E-006 retry " + outcome + " announces loading without side effects [AC7]", async ({ page }) => {
      const data = scenario("retry-" + outcome);
      const before = await mutations(data.tenantId);
      await login(page, data.user);
      await expect(card(page).getByRole("alert")).toContainText("Kunde inte läsa offertpipeline");
      const retry = card(page).getByRole("button", { name: "Försök igen", exact: true });
      await hydrated(retry);
      await retry.dblclick();
      await expect(card(page).getByRole("status")).toHaveAttribute("aria-live", "polite");
      await expect(card(page)).toHaveAttribute("aria-busy", "true");
      await expect(card(page).getByText(/^Hämtad /)).toHaveCount(0);
      if (outcome === "recovery") {
        await expect(card(page).getByRole("alert")).toHaveCount(0);
        await expect(card(page).locator("time")).toHaveAttribute("datetime", data.completionInstants[1]);
        await expect(card(page).getByLabel("Accepterat värde", { exact: true })).toContainText(formatOreAsKronor(data.acceptedSentinelOre));
      } else {
        await expect(card(page).getByRole("alert")).toContainText("Kunde inte läsa offertpipeline");
        await expect(card(page).getByText(/Hämtad|Skickade|0,00|Inga offerthändelser/)).toHaveCount(0);
      }
      expect(await mutations(data.tenantId)).toEqual(before);
    });
  }
  for (const revoked of ["quote", "money"] as const) {
    // RED: success→real failure→retry plan and unique membership fixture required.
    test.skip("[P0] 19.1-E2E-007 " + revoked + " revoked in same session before retry [AC7]", async ({ page }) => {
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
        const observed = observePayloads(page);
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
            expect(body.text).not.toContain(String(data.acceptedSentinelOre));
            expect(body.text).not.toContain(formatOreAsKronor(data.acceptedSentinelOre));
          }
          expect(await page.content()).not.toContain(formatOreAsKronor(data.acceptedSentinelOre));
          await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
        } finally { observed.close(); }
      } finally {
        await adminQuery("update public.tenant_memberships set role=$3 where tenant_id=$1 and id=$2", [data.tenantId, memberships[0].id, memberships[0].role]);
        await adminQuery("delete from public.membership_roles where tenant_id=$1 and membership_id=$2", [data.tenantId, memberships[0].id]);
        for (const row of roles) await adminQuery("insert into public.membership_roles (tenant_id,membership_id,role) values ($1,$2,$3)", [data.tenantId, memberships[0].id, row.role]);
      }
    });
  }
  // RED: actual failure scenario required; invalidate actual browser session.
  test.skip("[P0] 19.1-E2E-007 session lost before retry returns safely to login [AC7]", async ({ page, context }) => {
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
      // RED: isolated reader-state fixtures needed. Reuse existing full dismiss/
      // restore/completion regression, do not duplicate its mutation journey.
      test.skip("[P1] 19.1-E2E-008 " + outcome + " preserves " + onboarding + " onboarding [AC8]", async ({ page }) => {
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
  // RED: new mask absent; only EXISTING seller credentials needed.
  test.skip("[P1] 19.1-E2E-009 keyboard reaches mask explanation and authorized quotes [AC9]", async ({ page }) => {
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
  // RED: new mask absent; clock controls gesture duration, not server read clock.
  test.skip("[P1] 19.1-E2E-009 mobile long press shows role explanation [AC4,9]", async ({ page }) => {
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
    // RED: live widget absent; only EXISTING role credentials needed.
    test.skip("[P1] 19.1-E2E-010 " + viewport.name + " live full-width row fits [AC9]", async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await login(page, fixture().roleAware.saljare);
      await expect(card(page)).toBeVisible();
      await expect(card(page).getByRole("link", { name: "Visa offerter", exact: true })).toBeVisible();
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
      // RED: contained state fixture required, including a held actual loading read.
      test.skip("[P1] 19.1-E2E-010 " + viewport.name + " " + state + " fits with useful dimensions [AC9]", async ({ page }) => {
        const data = scenario("layout-" + state);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await login(page, data.user);
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
        }
      });
    }
  }
});
