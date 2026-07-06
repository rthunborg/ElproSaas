/**
 * Story 6.3 — 6.3-E2E-01 (P1, AC2) + 6.3-E2E-02 (P2, AC2/AC3): the PDF render-state UX.
 *
 * Against the REAL app + local Supabase stack + the two-tenant quote fixture (which
 * global-setup seeds; for a `generated`/`failed` state 6.3 EXTENDS the fixture to seed a
 * `pdf_status` + a stub PDF file). STATES ONLY — PDF CONTENT is golden/INT territory
 * (do NOT assert PDF content in E2E).
 *
 * Coverage:
 *   - 6.3-E2E-01 (AC2): the render states are VISIBLE + ACCESSIBLE — `not_generated`
 *     (Generate PDF action), `generating` (in-progress), `generated` (preview + download),
 *     `failed` (retry action). Every control is a real keyboard-operable button/link with an
 *     accessible name; status is conveyed by a NON-COLOR cue (a text label — WCAG 1.4.1).
 *   - 6.3-E2E-02 (AC2/AC3): the preview/download + generate/retry controls are Tab/Enter
 *     operable, have accessible names, expose the state as TEXT, and the preview surface has
 *     an accessible download fallback so a screen-reader/keyboard user can still obtain the PDF.
 *
 * ── ATDD RED PHASE ──────────────────────────────────────────────────────────────────
 * The six-state PDF panel + the generate/retry/preview/download actions do NOT exist yet
 * (the 6.2 `quote-pdf-status` region is a placeholder). This suite is `test.describe.skip`'d
 * with a red-phase header. When Task 5 (PDF-state UX) lands AND global-setup seeds the
 * `generated`/`failed` fixture states: adapt the fixture→selector references, remove `.skip`,
 * and flip GREEN — mirror the 6.2 E2E which ships green alongside its UI (no lingering
 * red-phase header). MEMORY: prefer event-driven a11y focus assertions; re-establish focus
 * with a real click (the preview-harness focus limitation).
 *
 * Runner: Playwright (`pnpm run test:e2e`), CI-gated (SUPABASE_TEST_REQUIRED=1).
 *
 * [Source: test-design-epic-6.md#6.3-E2E-01/02, R-613; story 6.3 Task 5 + Task 6.4;
 *  tests/e2e/quotes/quotes.e2e.spec.ts (the 6.2 signIn/waitForHydrated + getByTestId contract
 *  this mirrors); tests/e2e/global-setup.ts (the two-tenant quote fixture to extend);
 *  src/components/quotes/QuoteDetailView.tsx (the quote-pdf-status placeholder to extend);
 *  MEMORY (preview-harness focus limitation)]
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
    // RED PHASE: 6.3 extends global-setup to also seed a version in each render state so the
    // states below can be exercised deterministically, e.g.:
    //   readonly generatedVersionId: string;  // pdf_status='generated' + a stub PDF file
    //   readonly failedVersionId: string;     // pdf_status='failed'
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

test.describe.skip("Quote PDF render-state UX (Story 6.3 E2E) [ATDD red phase: PDF-state panel not implemented]", () => {
  test("6.3-E2E-01 (AC2): a not_generated version shows an accessible 'Generate PDF' action + a text status cue", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.quote.id}`);
    const panel = page.getByTestId("quote-pdf-status");
    await expect(panel).toBeVisible();
    // Status is conveyed as TEXT (non-color cue — WCAG 1.4.1), not color alone.
    await expect(panel).toContainText(/inte genererad|not generated/i);
    // A real keyboard-operable button with an accessible name.
    await expect(page.getByRole("button", { name: /generera pdf|generate pdf/i })).toBeVisible();
  });

  test("6.3-E2E-01 (AC2): a generated version shows accessible preview + download affordances", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    // RED PHASE: navigate to the seeded `generated` version subroute once global-setup seeds it,
    // e.g. `/quotes/${fixture.quote.id}/versions/${fixture.quote.generatedVersionId}`.
    await page.goto(`/quotes/${fixture.quote.id}`);
    const panel = page.getByTestId("quote-pdf-status");
    await expect(panel).toContainText(/genererad|generated/i);
    // Preview + download are real controls with accessible names; download via a signed URL
    // (never a public URL — proven at the INT level).
    await expect(page.getByRole("button", { name: /förhandsgranska|preview/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /ladda ner|download/i })).toBeVisible();
  });

  test("6.3-E2E-01 (AC2): a failed version offers an accessible retry action", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.quote.id}`);
    const panel = page.getByTestId("quote-pdf-status");
    await expect(panel).toContainText(/misslyckad|failed/i);
    await expect(page.getByRole("button", { name: /försök igen|retry/i })).toBeVisible();
  });

  test("6.3-E2E-02 (AC2/AC3): the preview/download controls are keyboard-operable with a download fallback", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.quote.id}`);
    // Tab/Enter operable: focus the download link via keyboard and assert it is focus-visible
    // and reachable (the accessible fallback for the inline preview surface). MEMORY: prefer
    // event-driven focus; re-establish focus with a real click if the harness drops it.
    const download = page.getByRole("link", { name: /ladda ner|download/i });
    await download.focus();
    await expect(download).toBeFocused();
    // The download link is the accessible fallback so a screen-reader/keyboard user can still
    // obtain the PDF even when the inline preview viewer is unavailable.
    await expect(download).toBeVisible();
  });
});
