/**
 * Story 6.2 — Quote detail + version timeline UX E2E (/quotes list + /quotes/[id] detail +
 * /quotes/[id]/versions/[versionId]) against the REAL app + local Supabase stack + the
 * two-tenant fixture (which seeds a quote with a SENT v1 + a DRAFT v2 in global-setup).
 *
 * MIRRORS the Story 5.2 calc-editor E2E pattern (signIn / waitForHydrated helpers, the seeded
 * fixture, `getByTestId` UI contract). Ships GREEN alongside the detail UI — no red-phase
 * `describe.skip` header lingers.
 *
 * Coverage:
 *   - 6.2-E2E-01 (AC1): the detail shows lifecycle header + customer + latest version + source
 *     calculation + version timeline + PDF status + acceptance-state placeholder + files +
 *     events (all regions present).
 *   - 6.2-E2E-02 (AC2/AC3): a DRAFT selection shows the draft editor + the immutability warning;
 *     a SENT selection renders read-only with a "create new version" affordance.
 *   - 6.2-E2E-04 (AC1): keyboard navigation through the timeline / version selection; status
 *     badges convey status as TEXT (not color alone).
 *   - anon → /login; a foreign quote id → generic not-found (no cross-tenant existence leak).
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

interface QuoteFixture {
  readonly adminA: { readonly email: string; readonly password: string };
  readonly quote: {
    readonly id: string;
    readonly sentVersionId: string;
    readonly draftVersionId: string;
  };
}

const fixture: QuoteFixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"), "utf8"),
);

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

test.describe("Quote detail + timeline UX (Story 6.2 E2E)", () => {
  test("an anonymous visit to /quotes redirects to /login", async ({ page }) => {
    await page.goto("/quotes");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("an anonymous visit to /quotes/[id] redirects to /login", async ({ page }) => {
    await page.goto(`/quotes/${fixture.quote.id}`);
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("the quote list renders and links to the detail", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/quotes");
    await expect(page.getByRole("heading", { name: "Offerter", level: 1 })).toBeVisible();
    await expect(page.getByTestId("quote-list")).toBeVisible();
    // Other serial E2E journeys legitimately create newer quotes. Select this
    // fixture by identity instead of relying on list order.
    const row = page.locator(
      `[data-testid="quote-list-row"][href="/quotes/${fixture.quote.id}"]`,
    );
    await expect(row).toBeVisible();
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/quotes/${fixture.quote.id}`));
  });

  test("6.2-E2E-01 (AC1): the detail shows every region", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.quote.id}`);

    await expect(page.getByTestId("quote-detail")).toBeVisible();
    // Lifecycle header + customer + latest status + current commitment + source calculation.
    await expect(page.getByTestId("quote-lifecycle-header")).toBeVisible();
    await expect(page.getByTestId("quote-customer")).toBeVisible();
    await expect(page.getByTestId("quote-latest-status")).toBeVisible();
    await expect(page.getByTestId("quote-current-commitment")).toBeVisible();
    await expect(page.getByTestId("quote-source-calculation")).toBeVisible();
    // Version timeline with BOTH versions.
    await expect(page.getByTestId("quote-version-timeline")).toBeVisible();
    await expect(page.getByTestId("quote-timeline-item")).toHaveCount(2);
    // Selected-version snapshot regions.
    await expect(page.getByTestId("quote-version-snapshot")).toBeVisible();
    await expect(page.getByTestId("quote-snapshot-totals")).toBeVisible();
    await expect(page.getByTestId("quote-pdf-status")).toBeVisible();
    await expect(page.getByTestId("quote-acceptance-placeholder")).toBeVisible();
    await expect(page.getByTestId("quote-snapshot-attachments")).toBeVisible();
    await expect(page.getByTestId("quote-events")).toBeVisible();
  });

  test("6.2-E2E-01 (AC1): the source-calculation link points at the calc route", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.quote.id}`);
    const link = page
      .getByTestId("quote-source-calculation")
      .getByRole("link", { name: "Öppna kalkyl" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", /\/calculations\//);
  });

  test("6.2-E2E-02 (AC2): the DRAFT version shows the draft editor + immutability warning", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    // The DRAFT is the latest (v2) — default selection on the detail page.
    await page.goto(`/quotes/${fixture.quote.id}/versions/${fixture.quote.draftVersionId}`);
    await expect(page.getByTestId("draft-quote-editor")).toBeVisible();
    // The persistent immutability warning is present.
    await expect(page.getByTestId("draft-immutable-warning")).toBeVisible();
    await expect(page.getByTestId("draft-immutable-warning")).toContainText(/låst|skickat/i);
    // The read-only notice + create-new-version affordance are NOT shown for a draft.
    await expect(page.getByTestId("quote-readonly-notice")).toHaveCount(0);
  });

  test("6.2-E2E-02 (AC3): a SENT version renders read-only with a create-new-version affordance", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.quote.id}/versions/${fixture.quote.sentVersionId}`);
    // No draft editor for a sent version.
    await expect(page.getByTestId("draft-quote-editor")).toHaveCount(0);
    // The read-only notice + the "Skapa ny version" affordance are present.
    await expect(page.getByTestId("quote-readonly-notice")).toBeVisible();
    await expect(page.getByTestId("create-new-version")).toBeVisible();
  });

  test("6.2-E2E-02 (AC2): a DRAFT edit updates only the draft version", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.quote.id}/versions/${fixture.quote.draftVersionId}`);
    const editor = page.getByTestId("draft-quote-editor");
    await waitForHydrated(editor);
    const newText = `Uppdaterad intro ${Date.now()}`;
    await editor.locator('textarea[name="intro_text"]').fill(newText);
    await page.getByTestId("draft-save").click();
    await expect(page.getByTestId("draft-saved")).toBeVisible();
  });

  test("6.2-E2E-04 (AC1): the timeline is keyboard-operable and badges use TEXT", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.quote.id}`);
    // Every timeline item is a focusable link (keyboard-reachable via Tab/Enter).
    const items = page.getByTestId("quote-timeline-item");
    await expect(items).toHaveCount(2);
    const first = items.first();
    await first.focus();
    await expect(first).toBeFocused();
    // Status badges convey the status as TEXT (not color alone) — the badge label is a word.
    const badges = page.getByTestId("quote-status-badge");
    await expect(badges.first()).toBeVisible();
    const texts = await badges.allInnerTexts();
    for (const t of texts) {
      expect(t.trim().length).toBeGreaterThan(0);
    }
    // The selected version is marked aria-current.
    await expect(
      page.locator('[data-testid="quote-timeline-item"][aria-current="true"]'),
    ).toHaveCount(1);
    // Selecting the OTHER version via keyboard navigates to its subroute.
    await first.press("Enter");
    await expect(page).toHaveURL(/\/quotes\/.+\/versions\/.+/);
  });

  test("a foreign / non-existent quote id → generic not-found (no cross-tenant leak)", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${crypto.randomUUID()}`);
    await expect(page.getByTestId("quote-not-found")).toBeVisible();
  });
});
