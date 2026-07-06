/**
 * Story 6.5 — 6.5-E2E-01 (P1, AC1/AC2): the ACTIVATED "Skapa ny version" affordance + the
 * multi-version timeline messaging on the quote detail (R-616). STATES + MESSAGING ONLY — the
 * prior-version-preservation ENFORCEMENT is INT/RLS territory (a test that only proves the UI
 * created a version is NOT evidence of byte-preservation; architecture §9). Do NOT assert DB
 * byte-equality in E2E.
 *
 * Runs against the REAL app + local Supabase stack + the two-tenant quote fixture (global-setup
 * seeds a quote with a SENT v1 and, where needed, a v2 — remember the 6.4 child-lock seeding order
 * for a sent-with-children version: draft → children → flip-to-sent). Mirrors the 6.2/6.4
 * quotes.e2e.spec.ts / quote-sent-lock.e2e.spec.ts signIn/waitForHydrated helpers + the
 * `getByTestId` UI contract.
 *
 * ── ATDD RED PHASE ─────────────────────────────────────────────────────────────────────────
 * Story 6.5 is NOT implemented: the "Skapa ny version" button is still the DISABLED placeholder
 * (`data-testid="create-new-version"`, `title="… Story 6.5"`) and the new-version action + the
 * `CreateNewVersionButton` client island do NOT exist. The suite carries a
 * `test.describe.skip("... [ATDD red phase — Story 6.5 not implemented]")` header so the E2E gate
 * stays GREEN until Task 4 lands. GREEN PHASE: activate the button (Task 4.1), add the action
 * (Task 4.2), extend global-setup with a sent-v1 (+ dedicated create-new-version quote), then
 * un-skip this suite.
 *
 * Coverage (STATES + MESSAGING only):
 *   - On a SENT version, the read-only branch offers a keyboard-operable "Skapa ny version" button
 *     (no longer disabled) and explains the lifecycle rule as TEXT ("kundens innehåll är låst …
 *     Skapa en ny version för att göra ändringar").
 *   - Clicking "Skapa ny version" on a read-only sent version creates a NEW draft version and lands
 *     the admin on the editable new draft (the DraftQuoteEditor + MarkSentButton branch renders;
 *     the read-only branch is gone).
 *   - The timeline preserves the PRIOR sent version (still visible with its snapshot/status) while
 *     the latest state is clear — the header/current-commitment logic resolves the newest version.
 *   - Every control has an accessible name + a visible focus ring; version/status conveyed as TEXT
 *     (the 6.2 text-not-color badge → "Utkast" / "Skickad", version N).
 *
 * [Source: test-design-epic-6.md#6.5-E2E-01, R-616; story 6.5 Task 4 + Task 5.4;
 *  src/components/quotes/QuoteDetailView.tsx:425-448 (the read-only branch + the disabled
 *  create-new-version button to activate) + MarkSentButton.tsx (the client-island precedent);
 *  src/features/quotes/actions.ts:187-224 (the markQuoteVersionSentAction BOTH-path revalidate to
 *  mirror); tests/e2e/quotes/quotes.e2e.spec.ts + quote-sent-lock.e2e.spec.ts (the fixture +
 *  signIn/waitForHydrated to mirror); tests/e2e/global-setup.ts (the two-tenant quote fixture to
 *  extend); epic-6 retro-notes#Story 6-2 (the disabled 'Skapa ny version' button 6.5 activates) +
 *  #Story 6-4 (sent-with-children seeding order); MEMORY (preview-harness focus limitation —
 *  prefer event-driven a11y focus)]
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
  /**
   * GREEN PHASE (Task 5.4): a DEDICATED quote whose only version is a SENT v1, consumed by the
   * "create a new version" flow test (creating a v2 permanently) so it does NOT mutate the shared
   * 6.2/6.4 quote the read-only-messaging + timeline tests rely on. Add this to global-setup's
   * fixture.json (seed the version draft → flip-to-sent per the 6.4 child-lock).
   */
  readonly newVersionQuote?: {
    readonly id: string;
    readonly sentVersionId: string;
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

test.describe.skip("Quote new-version UX (Story 6.5 E2E) [ATDD red phase — Story 6.5 not implemented]", () => {
  test("6.5-E2E-01 (AC1): a SENT version offers a keyboard-operable 'Skapa ny version' button + explains the lifecycle rule", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.quote.id}/versions/${fixture.quote.sentVersionId}`);

    // The read-only notice explains the rule as TEXT (kundens innehåll är låst … ny version).
    const notice = page.getByTestId("quote-readonly-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/låst|låses/i);
    await expect(notice).toContainText(/ny version/i);

    // The "Skapa ny version" button is now ACTIVE (no longer disabled) + keyboard-operable.
    const createNew = page.getByTestId("create-new-version");
    await expect(createNew).toBeVisible();
    await expect(createNew).toBeEnabled();
    await expect(createNew).toHaveAccessibleName(/ny version/i);
    await createNew.focus();
    await expect(createNew).toBeFocused();
  });

  test("6.5-E2E-01 (AC1/AC2): clicking 'Skapa ny version' on a sent version creates a NEW draft the admin can edit", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    // Consume the DEDICATED single-sent-version quote so the shared 6.2/6.4 quote is not mutated.
    const quote = fixture.newVersionQuote ?? fixture.quote;
    await page.goto(`/quotes/${quote.id}/versions/${quote.sentVersionId}`);

    const createNew = page.getByTestId("create-new-version");
    await waitForHydrated(createNew);
    await createNew.click();

    // After the create + revalidatePath on BOTH the detail + the new version subroute (the 6.2/6.3
    // subroute-revalidation discipline — do NOT repeat the 6.2 gap), the admin lands on the NEW
    // editable DRAFT version: the DraftQuoteEditor + MarkSentButton render; the read-only branch is
    // gone. Asserting the DURABLE re-rendered draft (not the transient success banner) is the robust
    // proof the new version was created.
    await expect(page.getByTestId("draft-quote-editor")).toBeVisible();
    await expect(page.getByTestId("mark-sent-button")).toBeVisible();
    await expect(page.getByTestId("quote-readonly-notice")).toHaveCount(0);
    // The new version's status is conveyed as TEXT (the text-not-color badge → "Utkast").
    const snapshot = page.getByTestId("quote-version-snapshot");
    await expect(snapshot).toHaveAttribute("data-status", "draft");
    await expect(snapshot.getByTestId("quote-status-badge")).toContainText(/Utkast/i);
  });

  test("6.5-E2E-01 (AC2): the timeline preserves the PRIOR sent version while the latest state is clear", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.quote.id}`);

    // The multi-version timeline still lists the PRIOR sent version (v1) with its status as TEXT —
    // creating a newer version never removes or mutates a prior one (the preservation is proven at
    // the INT layer; here we only assert it remains VISIBLE in the timeline).
    const timeline = page.getByTestId("quote-timeline");
    await expect(timeline).toBeVisible();
    const sentEntry = timeline.getByTestId(`quote-timeline-version-${fixture.quote.sentVersionId}`);
    await expect(sentEntry).toBeVisible();
    await expect(sentEntry).toContainText(/Skickad/i);
    // The header/current-commitment logic resolves the LATEST version as the current commitment
    // (the existing @/features/quotes/timeline helpers — reused, never forked).
    await expect(page.getByTestId("quote-current-version")).toBeVisible();
  });
});
