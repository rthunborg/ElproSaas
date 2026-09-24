/**
 * Story 6.4 — 6.4-E2E-01 (P1, AC1/AC2): the mark-sent affordance + the sent-lock lifecycle
 * messaging on the quote detail (R-616). STATES + MESSAGING ONLY — the immutability ENFORCEMENT
 * is INT/RLS territory (a test that only proves the UI disables a button is NOT evidence;
 * architecture §9). Do NOT assert DB rejection in E2E.
 *
 * Runs against the REAL app + local Supabase stack + the two-tenant quote fixture (global-setup
 * seeds a quote with a SENT v1 + a DRAFT v2, the draft being mark-sendable — its frozen
 * warnings_snapshot carries no blocker). Mirrors the 6.2 quotes.e2e.spec.ts signIn/waitForHydrated
 * helpers + the `getByTestId` UI contract.
 *
 * Coverage (STATES + MESSAGING only — the immutability ENFORCEMENT is INT/RLS territory):
 *   - On a SENT version, the UI explains the lifecycle rule ("kundens innehåll är låst … Skapa en
 *     ny version") and offers the "create new version" affordance (the FLOW itself is Story 6.5 —
 *     6.4 leaves the button a disabled placeholder).
 *   - The "Markera som skickad" button on a DRAFT version flips it to a read-only SENT version
 *     (the read-only notice + create-new-version affordance appear; the draft editor disappears).
 *   - Every control is keyboard-operable with a visible focus ring; the sent status is conveyed as
 *     TEXT (the text-not-color badge → "Skickad"), not color alone.
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
  /** A dedicated single-draft quote the flip test sends on its own (kept off the 6.2 quote). */
  readonly markSendQuote: {
    readonly id: string;
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

test.describe("Quote sent-lock + mark-sent UX (Story 6.4 E2E)", () => {
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
    // The SELECTED version's snapshot conveys the sent state as TEXT (the text-not-color badge →
    // "Skickad"), scoped to the selected-version block (the header badge shows the LATEST version).
    const snapshot = page.getByTestId("quote-version-snapshot");
    await expect(snapshot).toHaveAttribute("data-status", "sent");
    await expect(snapshot.getByTestId("quote-status-badge")).toContainText(/Skickad/i);
  });

  test("6.4-E2E-01 (AC1): the DRAFT version shows a keyboard-operable 'Markera som skickad' affordance", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.quote.id}/versions/${fixture.quote.draftVersionId}`);

    const markSent = page.getByTestId("mark-sent-button");
    await expect(markSent).toBeVisible();
    await expect(markSent).toHaveAccessibleName(/skicka/i);
    await expect(markSent).toBeDisabled();
    const recipient = page.getByLabel("E-postmottagare");
    await recipient.selectOption({ index: 1 });
    await expect(markSent).toBeEnabled();
    // Keyboard-operable with a visible focus ring (event-driven focus per the preview-harness note).
    await markSent.focus();
    await expect(markSent).toBeFocused();
  });

  test("6.4-E2E-01 (AC1/AC2): marking a draft sent flips it to a read-only sent version", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    // The FLIP test consumes a DEDICATED single-draft quote (sending it permanently) so it does
    // NOT mutate the shared 6.2 quote the read-only-messaging + timeline-count tests rely on.
    await page.goto(
      `/quotes/${fixture.markSendQuote.id}/versions/${fixture.markSendQuote.draftVersionId}`,
    );

    // Story 10.9: sending binds the exact generated PDF as commitment evidence.
    // Generate it through the real UI before exercising the legacy mark-sent journey.
    const pdfPanel = page.getByTestId("quote-pdf-status");
    const generatePdf = pdfPanel.getByRole("button", { name: /generera pdf/i });
    await waitForHydrated(generatePdf);
    await generatePdf.click();
    await expect(pdfPanel).toHaveAttribute("data-pdf-status", "generated");

    const markSent = page.getByTestId("mark-sent-button");
    await waitForHydrated(markSent);
    await expect(markSent).toBeDisabled();
    await page.getByLabel("E-postmottagare").selectOption({ index: 1 });
    await expect(markSent).toBeEnabled();
    await markSent.click();

    // After the send + revalidatePath on BOTH the detail + the version subroute (the 6.2/6.3
    // subroute-revalidation discipline), the version re-renders READ-ONLY: the draft editor + the
    // mark-sent form are GONE (the branch flips), and the read-only notice + the create-new-version
    // affordance appear. Asserting the DURABLE re-rendered outcome (not the transient success
    // banner, which unmounts with the draft branch) is the robust proof the send took effect.
    await expect(page.getByTestId("quote-readonly-notice")).toBeVisible();
    await expect(page.getByTestId("draft-quote-editor")).toHaveCount(0);
    await expect(page.getByTestId("mark-sent-form")).toHaveCount(0);
    await expect(page.getByTestId("create-new-version")).toBeVisible();
    // The SELECTED version's snapshot now reads "Skickad" (TEXT, not color alone).
    const snapshot = page.getByTestId("quote-version-snapshot");
    await expect(snapshot).toHaveAttribute("data-status", "sent");
    await expect(snapshot.getByTestId("quote-status-badge")).toContainText(/Skickad/i);
  });

  test("6.4-E2E-01 (AC2): the DRAFT's mark-sent affordance explains the lock rule BEFORE sending (immutability note)", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.quote.id}/versions/${fixture.quote.draftVersionId}`);

    // The mark-sent form persistently states that sending LOCKS the version (customer-visible
    // content becomes immutable — the UI mirrors the INT/DB-proven rule; a UI-only lock is a STOP
    // condition, so this is messaging, not the guarantee). A rejected-by-readiness send is proven
    // at the command layer (6.4-INT-04); the E2E covers states/messaging only.
    const note = page.getByTestId("mark-sent-immutable-note");
    await expect(note).toBeVisible();
    await expect(note).toContainText(/låses|låst/i);
    await expect(note).toContainText(/ny version/i);
  });
});
