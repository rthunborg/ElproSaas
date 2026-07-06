/**
 * Story 6.4 — 6.4-E2E-01 (P1, AC1/AC2): the mark-sent affordance + the sent-lock lifecycle
 * messaging on the quote detail (R-616). STATES + MESSAGING ONLY — the immutability ENFORCEMENT
 * is INT/RLS territory (a test that only proves the UI disables a button is NOT evidence;
 * architecture §9). Do NOT assert DB rejection in E2E.
 *
 * Runs against the REAL app + local Supabase stack + the two-tenant quote fixture (global-setup
 * seeds a quote with a SENT v1 + a DRAFT v2; 6.4's GREEN phase extends global-setup to also expose
 * the draft as mark-sendable). Mirrors the 6.2 quotes.e2e.spec.ts signIn/waitForHydrated helpers +
 * the `getByTestId` UI contract.
 *
 * Coverage:
 *   - On a SENT version, the UI explains the lifecycle rule ("kundens innehåll är låst … Skapa en
 *     ny version") and offers the "create new version" affordance (the FLOW itself is Story 6.5 —
 *     6.4 leaves the button a disabled placeholder).
 *   - The "Markera som skickad" button on a DRAFT version flips it to a read-only SENT version
 *     (the read-only notice + create-new-version affordance appear; the draft editor disappears).
 *   - Every control is keyboard-operable with a visible focus ring; the sent status is conveyed as
 *     TEXT (the text-not-color badge → "Skickad"), not color alone.
 *
 * ── ATDD RED PHASE ─────────────────────────────────────────────────────────────────────────
 * The "Markera som skickad" affordance + its "use server" action do NOT exist yet. The whole
 * suite carries a `test.describe.skip("... [ATDD red phase — Story 6.4 not implemented]")` header
 * (mirrors the 6.2/6.3 no-lingering-red-header discipline — CLEAR the header when flipping green).
 * The read-only notice + create-new-version placeholder already exist from 6.2, so those assertions
 * describe existing UI; the mark-sent flow assertions describe the NEW 6.4 UI.
 *
 * [Source: test-design-epic-6.md#6.4-E2E-01, R-616; story 6.4 Task 5 + Task 6.4;
 *  tests/e2e/quotes/quotes.e2e.spec.ts (the two-tenant fixture + signIn/waitForHydrated to mirror);
 *  src/components/quotes/QuoteDetailView.tsx (the draft/read-only branch + create-new-version
 *  placeholder); MEMORY (preview-harness focus limitation — prefer event-driven a11y focus)]
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

test.describe.skip("Quote sent-lock + mark-sent UX (Story 6.4 E2E) [ATDD red phase — Story 6.4 not implemented]", () => {
  test("6.4-E2E-01 (AC2): a SENT version explains the lifecycle rule + offers create-new-version", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.quote.id}/versions/${fixture.quote.sentVersionId}`);

    // No draft editor on a sent version.
    await expect(page.getByTestId("draft-quote-editor")).toHaveCount(0);
    // The read-only notice explains the immutability rule as TEXT (the lifecycle rule).
    const notice = page.getByTestId("quote-readonly-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/låst|skickad/i);
    await expect(notice).toContainText(/ny version/i);
    // The "create new version" affordance is present (Story 6.5 activates it — here it exists).
    await expect(page.getByTestId("create-new-version")).toBeVisible();
    // The status badge conveys the sent state as TEXT (not color alone).
    const badge = page.getByTestId("quote-status-badge").first();
    await expect(badge).toContainText(/Skickad/i);
  });

  test("6.4-E2E-01 (AC1): the DRAFT version shows a keyboard-operable 'Markera som skickad' affordance", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.quote.id}/versions/${fixture.quote.draftVersionId}`);

    const markSent = page.getByTestId("mark-sent-button");
    await expect(markSent).toBeVisible();
    await expect(markSent).toHaveAccessibleName(/skicka/i);
    // Keyboard-operable with a visible focus ring (event-driven focus per the preview-harness note).
    await markSent.focus();
    await expect(markSent).toBeFocused();
  });

  test("6.4-E2E-01 (AC1/AC2): marking a draft sent flips it to a read-only sent version", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.quote.id}/versions/${fixture.quote.draftVersionId}`);

    const markSent = page.getByTestId("mark-sent-button");
    await waitForHydrated(markSent);
    await markSent.click();

    // A success status is announced (role="status"/"alert" banner discipline from 6.2/6.3).
    await expect(page.getByTestId("mark-sent-status")).toBeVisible();
    // After the send, the version re-renders READ-ONLY: the draft editor is gone; the read-only
    // notice + the create-new-version affordance appear (revalidatePath on BOTH the detail + the
    // version subroute — the 6.2/6.3 subroute-revalidation discipline).
    await expect(page.getByTestId("draft-quote-editor")).toHaveCount(0);
    await expect(page.getByTestId("quote-readonly-notice")).toBeVisible();
    await expect(page.getByTestId("create-new-version")).toBeVisible();
    // The status badge now reads "Skickad" (TEXT, not color alone).
    await expect(page.getByTestId("quote-status-badge").first()).toContainText(/Skickad/i);
  });

  test("6.4-E2E-01 (AC1): a send rejected by the readiness gate surfaces a generic non-final message", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    // GREEN PHASE: navigate to a draft version whose re-derived readiness has a BLOCKER (extend
    // global-setup to seed a blocked draft), click "Markera som skickad", and assert the error
    // banner surfaces a generic "blocking readiness issues" message — the version stays a draft
    // editor (no leaked SQL/row detail). Mirror 6.2's error-banner discipline.
    await page.goto(`/quotes/${fixture.quote.id}/versions/${fixture.quote.draftVersionId}`);
    // Placeholder assertion describing the intended behavior (blocked-draft fixture seeded in green).
    await expect(page.getByTestId("mark-sent-button")).toBeVisible();
  });
});
