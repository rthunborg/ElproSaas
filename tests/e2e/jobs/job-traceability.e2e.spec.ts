/**
 * Story 7.3 — the job/order detail traceability UX (AC1), the repeated-attempt idempotency deep-link
 * (AC5), the allowed-edit affordance (AC4), and the a11y baseline (AC2/AC4). STATES + UI BEHAVIOR
 * ONLY — the source-of-truth-from-immutable-refs proof and the audited-command guarantees are INT
 * territory (`job-source-of-truth.int.test.ts` + `update-job.int.test.ts`); a test that only proves
 * the UI shows a field is NOT evidence of the server rule (architecture §9). Do NOT assert DB
 * source-of-truth / audit / idempotency in E2E.
 *
 *   - 7.3-E2E-01 (P1, AC1, UX-DR26, R-708): the `/jobs/[jobId]` detail shows the source quote version
 *     (a LINK + quote number), acceptance evidence (a signed evidence link OR the external reference),
 *     the accepted price + source sent total (öre → kronor), customer/facility/contact, title/status,
 *     planned dates, files, and the event history. The immutable source refs are DISPLAY-ONLY — NO
 *     edit control renders for the source version / acceptance / customer / accepted price / source
 *     total / evidence / accepted timestamp / channel.
 *   - 7.3-E2E-02 (P1, AC5, UX-DR24, R-712): from the accepted quote version, the deep link lands on
 *     the EXISTING single job — a repeat navigation shows the SAME job, NEVER a duplicate, a second
 *     create affordance, or an error.
 *   - 7.3-E2E-04 (P2, AC2/AC4): the edit dialog opens with predictable focus and restores focus on
 *     close; status/labels use TEXT not color alone (a11y baseline, epic-6 pattern).
 *   - allowed-edit affordance (AC4): the edit form exposes ONLY title / status / planned dates — NO
 *     edit control for any immutable source/commitment field.
 *
 * ── RED PHASE (Story 7.3 not yet implemented) ─────────────────────────────────────────────────
 * `/jobs/[jobId]` is a NEW route + `JobDetailView` is a NEW component — neither exists yet (the
 * `/jobs` index is still a PagePlaceholder). Every test is `test.skip`. GREEN PHASE: land the
 * detail page + view + the accepted-version deep link, then remove `.skip`. The `getByTestId`
 * contract below defines the UI hooks the implementation must provide (mirror the QuoteDetailView
 * testid discipline). These tests assert EXPECTED behavior — they FAIL until 7.3 lands.
 *
 * Runs against the REAL app + local Supabase stack + a DEDICATED accepted-job fixture: the E2E
 * global-setup (from 7.2) already drives the REAL `mark_quote_version_sent` → `accept_quote_and_
 * create_job` chain for the `acceptQuote` fixture — GREEN PHASE reuses that fixture's ONE created
 * job (extend global-setup to persist the created `jobId` + the `sourceVersionId` deep-link seam if
 * not already present). Never hand-insert a `jobs` row (the source refs must be authentic). Mirrors
 * `quote-accept-create-job.e2e.spec.ts` signIn/waitForHydrated + the `getByTestId` UI contract. NO
 * public/portal/webhook route (the `job-non-scope` guardrail scan owns the hard proof).
 *
 * [Source: test-design-epic-7.md#7.3-E2E-01/02/04, #Risk R-708/R-712, #Exit Criteria (Job
 *  traceability proven); story 7.3 AC1/AC4/AC5 + Tasks 2/3 + Testing section; src/components/quotes/
 *  QuoteDetailView.tsx (the read-detail testid shape + oreToKronorString money display + the
 *  accepted-section deep-link seam at lines 417-434 → make it a link to /jobs/[jobId]);
 *  tests/e2e/quotes/quote-accept-create-job.e2e.spec.ts (the signIn/fixture/testid pattern to mirror);
 *  tests/e2e/global-setup.ts (the acceptQuote fixture — extend to carry the created jobId)]
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

interface JobFixture {
  readonly adminA: { readonly email: string; readonly password: string };
  readonly acceptQuote: {
    readonly id: string;
    readonly sentVersionId: string;
    // RED PHASE: GREEN must extend global-setup to persist the job created by the acceptQuote chain.
    readonly jobId?: string;
  };
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

/** Open the job detail directly (the deep-link target the accepted version points at). */
async function openJobDetail(page: Page): Promise<void> {
  await signIn(page, fixture.adminA.email, fixture.adminA.password);
  const jobId = fixture.acceptQuote.jobId; // GREEN: guaranteed present once global-setup carries it.
  await page.goto(`/jobs/${jobId}`);
  await waitForHydrated(page.getByTestId("job-detail"));
}

test.describe("job/order detail — traceability + allowed-edit + idempotency deep-link (AC1/AC4/AC5)", () => {
  test.skip("[P1] 7.3-E2E-01: the detail surfaces the full source-traceability block (version link, evidence, accepted price + source total, customer, planned dates, files, events)", async ({
    page,
  }) => {
    await openJobDetail(page);
    // Source quote version — a LINK (not plain text) to the version, showing the quote number.
    const versionLink = page.getByTestId("job-source-quote-version");
    await expect(versionLink).toBeVisible();
    await expect(versionLink).toHaveAttribute("href", /\/quotes\/.+\/versions\/.+/);
    // Acceptance evidence — a signed evidence link OR the external evidence reference text.
    await expect(page.getByTestId("job-acceptance-evidence")).toBeVisible();
    // Accepted price + source sent total — displayed öre→kronor (from the immutable acceptance row).
    await expect(page.getByTestId("job-accepted-price")).toBeVisible();
    await expect(page.getByTestId("job-source-sent-total")).toBeVisible();
    // Customer/facility/contact, title/status, planned dates, files, event history.
    await expect(page.getByTestId("job-customer")).toBeVisible();
    await expect(page.getByTestId("job-status")).toBeVisible();
    await expect(page.getByTestId("job-planned-dates")).toBeVisible();
    await expect(page.getByTestId("job-files")).toBeVisible();
    await expect(page.getByTestId("job-event-history")).toBeVisible();
  });

  test.skip("[P1] 7.3-E2E-01: the immutable source refs are DISPLAY-ONLY — NO edit control renders for version / acceptance / customer / accepted price / source total / evidence", async ({
    page,
  }) => {
    await openJobDetail(page);
    // UX-DR26: no edit affordance for any immutable commitment/source field.
    await expect(page.getByTestId("edit-job-accepted-price")).toHaveCount(0);
    await expect(page.getByTestId("edit-job-source-total")).toHaveCount(0);
    await expect(page.getByTestId("edit-job-customer")).toHaveCount(0);
    await expect(page.getByTestId("edit-job-source-quote-version")).toHaveCount(0);
    await expect(page.getByTestId("edit-job-evidence")).toHaveCount(0);
    await expect(page.getByTestId("edit-job-channel")).toHaveCount(0);
  });

  test.skip("[P1] 7.3-E2E-01: the allowed-edit affordance exposes ONLY title / status / planned dates (AC4)", async ({
    page,
  }) => {
    await openJobDetail(page);
    await page.getByTestId("job-edit-open").click();
    const dialog = page.getByTestId("job-edit-dialog");
    await expect(dialog).toBeVisible();
    // ONLY the four Phase-A-safe fields are editable here.
    await expect(dialog.getByTestId("job-edit-title")).toBeVisible();
    await expect(dialog.getByTestId("job-edit-status")).toBeVisible();
    await expect(dialog.getByTestId("job-edit-planned-start")).toBeVisible();
    await expect(dialog.getByTestId("job-edit-planned-end")).toBeVisible();
    // The status select offers ONLY the closed Phase-A order lifecycle (no field-worker states).
    const statusOptions = await dialog.getByTestId("job-edit-status").locator("option").allTextContents();
    const values = statusOptions.map((s) => s.trim().toLowerCase());
    for (const forbidden of ["scheduled", "dispatched", "on-site", "on site"]) {
      expect(values).not.toContain(forbidden);
    }
  });

  test.skip("[P1] 7.3-E2E-02: the deep link from the accepted quote version lands on the EXISTING single job — a repeat navigation shows the SAME job, no duplicate/create/error (idempotent UX mirror)", async ({
    page,
  }) => {
    // From the accepted version, the "a job was created" note is a LINK to /jobs/[jobId] (AC5 seam).
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(
      `/quotes/${fixture.acceptQuote.id}/versions/${fixture.acceptQuote.sentVersionId}`,
    );
    const jobLink = page.getByTestId("quote-accepted-job-link");
    await waitForHydrated(jobLink);
    await expect(jobLink).toBeVisible();
    await jobLink.click();
    await expect(page).toHaveURL(/\/jobs\/.+/);
    await expect(page.getByTestId("job-detail")).toBeVisible();
    const firstUrl = page.url();
    // Repeat the navigation — the SAME job, never a second create affordance or an error.
    await page.goto(
      `/quotes/${fixture.acceptQuote.id}/versions/${fixture.acceptQuote.sentVersionId}`,
    );
    await page.getByTestId("quote-accepted-job-link").click();
    await expect(page).toHaveURL(firstUrl);
    await expect(page.getByTestId("job-create-again")).toHaveCount(0);
    await expect(page.getByTestId("job-error")).toHaveCount(0);
  });

  test.skip("[P2] 7.3-E2E-04: the edit dialog moves focus in on open + restores it on close; status labels are TEXT not color-alone (a11y baseline)", async ({
    page,
  }) => {
    await openJobDetail(page);
    const openBtn = page.getByTestId("job-edit-open");
    await openBtn.click();
    const dialog = page.getByTestId("job-edit-dialog");
    await expect(dialog).toBeVisible();
    // Focus lands inside the dialog on open (predictable focus, epic-6 pattern).
    await expect(dialog).toContainText(""); // dialog mounted
    const focusInDialog = await dialog.evaluate((el) => el.contains(document.activeElement));
    expect(focusInDialog).toBe(true);
    // Closing restores focus to the trigger.
    await page.getByTestId("job-edit-cancel").click();
    await expect(dialog).toHaveCount(0);
    await expect(openBtn).toBeFocused();
    // Status is conveyed as TEXT (accessible name), not color alone.
    await expect(page.getByTestId("job-status")).not.toBeEmpty();
  });
});
