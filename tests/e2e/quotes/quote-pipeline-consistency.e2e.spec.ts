/**
 * Story 10.4 — the render-consistency E2E (10.4-E2E-01, P2, AC2; test-design-epic-10.md R-1044). The
 * status filters (incl. Förlorad/Avböjd), the `Förlustorsak` column, the `Har uppföljning` /
 * `Försenad uppföljning` follow-up filters, and the detail-header follow-up chip render CONSISTENTLY
 * via `StatusBadge` + the SHARED `status.ts` tone authority (the UX-BDR4 / UX-BDR17 text-first
 * contract). This proves the 10.4 "render consistently" pass — the follow-up chip (`FollowUpChip.tsx`)
 * and the `QuoteList.tsx` overdue row badge consume the folded `status.ts` primitive with NO behavioural
 * change to the (already-correct) filters.
 *
 * SURFACES + TEXT-FIRST MESSAGING ONLY — the aggregation, the entitlement descriptor, and the
 * RLS-client-only isolation are UNIT/INT territory (a test that only drives the UI is NOT enforcement
 * evidence; architecture §9). Two-runner discipline (epic-10 retro 10-1 Phase-4): pure tone/aggregation
 * logic is node:test UNIT, the isolation/list-projection is Vitest INT — ONLY the rendered
 * filters/column/chip are Playwright E2E here.
 *
 * ── GREEN (Story 10.4 implemented) ───────────────────────────────────────────────────────────────
 * The `status.ts` tone fold (Tasks 4.1-4.3) is landed and `global-setup.ts` seeds a dedicated LOST
 * pipeline quote (Förlustorsak column + terminal StatusBadge) alongside the existing 10.3
 * overdueFollowUpQuote (the overdue chip + list badge). The suite signs in as adminA (mirroring the
 * 10.2/10.3 quote specs) and is unskipped. Run against a freshly `supabase db reset` LOCAL stack
 * (`SUPABASE_TEST_REQUIRED=1`). The `data-testid`s + Swedish text are the CONTRACT — do NOT weaken.
 *
 * [Source: story 10.4 AC2 + Task 4 + the ⚑ 10-3 DEFERRED ITEM section; src/components/quotes/
 *  {FollowUpChip.tsx (next-follow-up-chip / data-overdue),QuoteList.tsx (quote-status-filter /
 *  quote-filter-has-follow-up / quote-filter-overdue-follow-up / quote-list-lost-reason /
 *  quote-row-overdue-follow-up-badge),StatusBadge.tsx}; test-design-epic-10.md#10.4-E2E-01, R-1044]
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface QuoteFixture {
  readonly adminA: { readonly email: string; readonly password: string };
  /** A sent quote with an OVERDUE open follow-up — the overdue chip + the list badge tone (10.3). */
  readonly overdueFollowUpQuote?: { readonly id: string; readonly sentVersionId: string };
  /** A dedicated already-LOST quote — the Förlustorsak column + the terminal StatusBadge (10.4). */
  readonly pipelineLostQuote?: { readonly id: string; readonly lostVersionId: string };
}

// Guarded read — an absent fixture (before global-setup seeds the pipeline quotes) must not throw at
// collection.
const FIXTURE_PATH = path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json");
const fixture: QuoteFixture = existsSync(FIXTURE_PATH)
  ? (JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as QuoteFixture)
  : ({ adminA: { email: "", password: "" } } as QuoteFixture);

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

test.describe("10.4-E2E-01: quote list/detail render consistently via StatusBadge + status.ts", () => {
  test("the status filter offers the terminal Förlorad/Avböjd option and filters the list", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/quotes");
    const statusFilter = page.getByTestId("quote-status-filter");
    await waitForHydrated(statusFilter);
    // Selecting the terminal lost status narrows the list to lost rows (StatusBadge text-first).
    await statusFilter.selectOption("lost");
    await expect(page.getByTestId("quote-list-lost-row").first()).toBeVisible();
  });

  test("the Förlustorsak column shows the Swedish reason label on a lost row (text-first)", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/quotes");
    const statusFilter = page.getByTestId("quote-status-filter");
    await waitForHydrated(statusFilter);
    await statusFilter.selectOption("lost");
    const reasonCell = page.getByTestId("quote-list-lost-reason").first();
    await expect(reasonCell).toBeVisible();
    await expect(reasonCell).not.toBeEmpty(); // the label is the primary signal, not color
  });

  test("the `Har uppföljning` and `Försenad uppföljning` filters render and narrow the list", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/quotes");
    await expect(page.getByTestId("quote-filter-has-follow-up")).toBeVisible();
    const overdueFilter = page.getByTestId("quote-filter-overdue-follow-up");
    await waitForHydrated(overdueFilter);
    await overdueFilter.click();
    // The overdue row badge uses the SHARED status.ts tone (folded from the bespoke inline rose tone).
    const badge = page.getByTestId("quote-row-overdue-follow-up-badge").first();
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("Försenad uppföljning");
  });

  test("the detail-header follow-up chip renders text-first with the escalation attribute", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(
      `/quotes/${fixture.overdueFollowUpQuote!.id}/versions/${fixture.overdueFollowUpQuote!.sentVersionId}`,
    );
    const chip = page.getByTestId("next-follow-up-chip");
    await expect(chip).toBeVisible();
    // The chip is escalated overdue — the escalation is exposed as an attribute + text (WCAG 1.4.1),
    // its tone drawn from the shared status.ts authority (not a bespoke inline literal).
    await expect(chip).toHaveAttribute("data-overdue", "true");
    await expect(chip).toContainText("Försenad uppföljning");
  });
});
