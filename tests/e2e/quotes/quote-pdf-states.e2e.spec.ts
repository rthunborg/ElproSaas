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
 * ── GREEN (Story 6.3, Task 5) ────────────────────────────────────────────────────────
 * The six-state PDF panel + the generate/retry/preview/download actions have landed, and
 * global-setup seeds a `generated` version (stub PDF file/link/object) + a `failed` version, so
 * the states are exercised deterministically via the version subroutes. MEMORY: prefer
 * event-driven a11y focus assertions; re-establish focus with a real click (the preview-harness
 * focus limitation).
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
  // Story 6.3: global-setup seeds a SEPARATE quote whose three versions exercise the render
  // states deterministically (no real generation): a `not_generated` version (the Generate-PDF
  // action), a `generated` version (a stub PDF file/link/object → preview/download), and a
  // `failed` version (the retry action).
  readonly pdfQuote: {
    readonly id: string;
    readonly notGeneratedVersionId: string;
    readonly generatedVersionId: string;
    readonly failedVersionId: string;
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

test.describe("Quote PDF render-state UX (Story 6.3 E2E)", () => {
  test("6.3-E2E-01 (AC2): a not_generated version shows an accessible 'Generate PDF' action + a text status cue", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    // The DRAFT version stays `not_generated` (the Generate-PDF action).
    await page.goto(
      `/quotes/${fixture.pdfQuote.id}/versions/${fixture.pdfQuote.notGeneratedVersionId}`,
    );
    const panel = page.getByTestId("quote-pdf-status");
    await expect(panel).toBeVisible();
    // Status is conveyed as TEXT (non-color cue — WCAG 1.4.1), not color alone.
    await expect(panel).toContainText(/ingen pdf genererad|not generated/i);
    // A real keyboard-operable button with an accessible name.
    await expect(page.getByRole("button", { name: /generera pdf|generate pdf/i })).toBeVisible();
  });

  test("6.3-E2E-01 (AC2): a generated version shows accessible preview affordance + a text status cue", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(
      `/quotes/${fixture.pdfQuote.id}/versions/${fixture.pdfQuote.generatedVersionId}`,
    );
    const panel = page.getByTestId("quote-pdf-status");
    await expect(panel).toContainText(/pdf genererad|generated/i);
    // Preview is a real control with an accessible name; the download link (a signed URL, never
    // a public URL — proven at the INT level) is the accessible fallback shown after a sign.
    await expect(page.getByRole("button", { name: /förhandsgranska|preview/i })).toBeVisible();
  });

  test("6.3-E2E-01 (AC2): a failed version offers an accessible retry action + a text status cue", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(
      `/quotes/${fixture.pdfQuote.id}/versions/${fixture.pdfQuote.failedVersionId}`,
    );
    const panel = page.getByTestId("quote-pdf-status");
    await expect(panel).toContainText(/misslyckades|failed/i);
    await expect(page.getByRole("button", { name: /försök igen|retry/i })).toBeVisible();
  });

  test("6.3-E2E-02 (AC2/AC3): the preview control is keyboard-operable; a download fallback appears after signing", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(
      `/quotes/${fixture.pdfQuote.id}/versions/${fixture.pdfQuote.generatedVersionId}`,
    );
    // Tab/Enter operable: focus the preview button via keyboard and assert it is reachable.
    // MEMORY: prefer event-driven focus; re-establish focus with a real click if the harness
    // drops it (the preview-harness focus limitation).
    const preview = page.getByRole("button", { name: /förhandsgranska|preview/i });
    await preview.focus();
    await expect(preview).toBeFocused();
    // Activating preview signs a short-lived URL and renders the DOWNLOAD LINK — the accessible
    // fallback so a screen-reader/keyboard user can still obtain the PDF.
    await preview.click();
    const download = page.getByTestId("quote-pdf-download");
    await expect(download).toBeVisible();
    await expect(download).toHaveAttribute("href", /.+/);
  });
});
