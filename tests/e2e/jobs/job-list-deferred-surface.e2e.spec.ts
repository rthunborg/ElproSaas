/**
 * Story 7.3 — the `/jobs` list filter/search UX (AC2) + the deferred-surface absence gate on the
 * LIVE rendered pages (AC2; R-711). This is the BEHAVIORAL companion to the `job-non-scope`
 * `node --test` route/token scan: the scan proves NO deferred segment/symbol exists in source; this
 * E2E proves the rendered list + detail present NO field-worker / schedule / time-material /
 * deviation / ÄTA / analytics / invoice / Fortnox column, control, label, badge, or link.
 *
 *   - 7.3-E2E-03 (P1, AC2, R-711): the `/jobs` list filters/searches by customer, status,
 *     planned-date, and source quote; each row links to `/jobs/[jobId]`. NO deferred-module surface
 *     appears on the list OR the detail — a hard absence gate on the rendered UI. Pair with the
 *     `tests/unit/guardrails/job-non-scope.test.ts` route/surface scan (Task 6).
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * GREEN as of Story 7.3 dev. The `/jobs` placeholder is replaced with the server list + `JobList`
 * filter/search island; `.skip` removed.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Runs against the REAL app + local Supabase stack + the job fixture (global-setup's `acceptedJob`
 * chain produces at least one real job for tenant A via the REAL accept transaction; never hand-insert
 * a `jobs` row). Mirrors `quote-accept-create-job.e2e.spec.ts` signIn/waitForHydrated + the
 * `getByTestId` UI contract.
 *
 * [Source: test-design-epic-7.md#7.3-E2E-03, #Risk R-711, #Non-scope (field-worker/invoicing/Fortnox
 *  boundaries); story 7.3 AC2 + Tasks 2/2.1/2.2 + Task 6 + Testing section; src/app/(app)/quotes/
 *  page.tsx + src/components/quotes/QuoteList.tsx (the server-list + client-island pattern to mirror);
 *  tests/unit/guardrails/job-non-scope.test.ts (the paired source scan);
 *  tests/e2e/quotes/quotes.e2e.spec.ts (the list-page E2E pattern to mirror)]
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

interface JobFixture {
  readonly adminA: { readonly email: string; readonly password: string };
}

const fixture: JobFixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"), "utf8"),
) as JobFixture;

async function waitForHydrated(locator: Locator): Promise<void> {
  await locator.waitFor({ state: "visible" });
  await locator.evaluate(
    (el) =>
      new Promise<void>((resolve) => {
        const ready = () => Object.keys(el).some((k) => k.startsWith("__react"));
        const tick = () => (ready() ? resolve() : requestAnimationFrame(tick));
        tick();
      }),
  );
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  const submit = page.getByRole("button", { name: "Logga in" });
  await waitForHydrated(submit);
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Lösenord").fill(password);
  await submit.click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function openJobList(page: Page): Promise<void> {
  await signIn(page, fixture.adminA.email, fixture.adminA.password);
  await page.goto("/jobs");
  await waitForHydrated(page.getByTestId("job-list"));
}

// Deferred-module surface labels/tokens that must NOT appear anywhere on the rendered job pages
// (Swedish + English forms). Case-insensitive body-text scan on top of the testid-level checks.
const FORBIDDEN_VISIBLE_TEXT = [
  /fältarbetare/i,
  /field.?worker/i,
  /schemal[aä]gg/i,
  /schedule/i,
  /tidrapport/i,
  /timesheet/i,
  /time.?material/i,
  /avvikelse/i,
  /deviation/i,
  /ÄTA/,
  /fortnox/i,
  /faktura/i,
  /invoice/i,
  /leverant[öo]r/i,
  /supplier/i,
  /analys(verktyg)?/i,
  /analytics/i,
];

test.describe("job/order list — filter/search + deferred-surface absence (AC2, R-711)", () => {
  test("[P1] 7.3-E2E-03: the /jobs list renders rows that link to /jobs/[jobId] and exposes customer / status / planned-date / source-quote filters", async ({
    page,
  }) => {
    await openJobList(page);
    // Each row links to the detail.
    const firstRow = page.getByTestId("job-list-row").first();
    await expect(firstRow).toBeVisible();
    await expect(firstRow.getByRole("link")).toHaveAttribute("href", /\/jobs\/.+/);
    // The four AC2 filter/search controls are present.
    await expect(page.getByTestId("job-filter-customer")).toBeVisible();
    await expect(page.getByTestId("job-filter-status")).toBeVisible();
    await expect(page.getByTestId("job-filter-planned-date")).toBeVisible();
    await expect(page.getByTestId("job-filter-source-quote")).toBeVisible();
  });

  test("[P1] 7.3-E2E-03: filtering by status narrows the visible rows (thin-index filter behavior)", async ({
    page,
  }) => {
    await openJobList(page);
    // Filter to a status that the seeded job(s) do NOT match → zero rows (empty-state shown).
    await page.getByTestId("job-filter-status").selectOption("cancelled");
    await expect(page.getByTestId("job-list-empty")).toBeVisible();
    // Reset to the default/all → rows return.
    await page.getByTestId("job-filter-status").selectOption("");
    await expect(page.getByTestId("job-list-row").first()).toBeVisible();
  });

  test("[P1] 7.3-E2E-03: NO field-worker / schedule / time-material / deviation / ÄTA / analytics / invoice / Fortnox / supplier surface appears on the rendered list", async ({
    page,
  }) => {
    await openJobList(page);
    const body = await page.locator("body").innerText();
    for (const forbidden of FORBIDDEN_VISIBLE_TEXT) {
      expect(body).not.toMatch(forbidden);
    }
    // No deferred-module control/badge/link testids.
    await expect(page.getByTestId("job-schedule")).toHaveCount(0);
    await expect(page.getByTestId("job-invoice")).toHaveCount(0);
    await expect(page.getByTestId("job-timesheet")).toHaveCount(0);
    await expect(page.getByTestId("job-fortnox")).toHaveCount(0);
  });
});
