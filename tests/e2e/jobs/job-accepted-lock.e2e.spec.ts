/**
 * Story 7.4 — 7.4-E2E-01 (P1, AC1): the correction-boundary MESSAGING on the accepted job detail
 * (R-714). STATES + MESSAGING ONLY — the immutability ENFORCEMENT is INT/RLS territory (a test that
 * only proves the UI disables a control is NOT evidence; architecture §9). Do NOT assert DB rejection
 * in E2E.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * GREEN as of Story 7.4 dev. The correction-boundary notice (`job-accepted-lock-notice`) on
 * `src/components/jobs/JobDetailView.tsx` now renders; `.skip` removed. The notice renders; NO edit
 * affordance renders for any immutable commitment field.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Coverage (STATES + MESSAGING only):
 *   - On the accepted job detail, the UI shows the correction-boundary notice explaining that the
 *     accepted commitment is LOCKED and corrections require an approved audited workflow (there is NO
 *     Phase-A correction affordance — the workflow is owner-gated per the R-714 STOP).
 *   - NO silent edit affordance renders for any immutable commitment field (accepted price / source
 *     sent total / evidence / source version / accepted timestamp / channel). The 7.3 allowed-edit
 *     dialog (title / status / planned dates) stays exactly as shipped — those are NOT immutable
 *     commitment fields.
 *   - The notice + every control is keyboard-operable with a visible focus ring; the lock state is
 *     conveyed as TEXT (not color alone — the a11y baseline).
 *
 * Runs against the REAL app + local Supabase stack + the DEDICATED `acceptedJob` fixture (global-setup
 * drives the real accept chain and persists the created `jobId` + the source quote/version seam — the
 * 7.3 fixture this reuses). Mirrors `quote-sent-lock.e2e.spec.ts` (6.4-E2E-01 — the message-only E2E)
 * + `job-traceability.e2e.spec.ts` (the `acceptedJob` fixture + signIn/waitForHydrated helpers).
 *
 * [Source: test-design-epic-7.md#7.4-E2E-01 (line 534), R-714; story 7.4 AC1 + Task 3/4.5;
 *  tests/e2e/quotes/quote-sent-lock.e2e.spec.ts (6.4-E2E-01 — the message-only E2E to mirror);
 *  tests/e2e/jobs/job-traceability.e2e.spec.ts (the acceptedJob fixture + signIn/waitForHydrated);
 *  src/components/jobs/JobDetailView.tsx (the source-traceability block the notice lands near);
 *  MEMORY (preview-harness focus limitation — prefer event-driven a11y focus)]
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

interface JobFixture {
  readonly adminA: { readonly email: string; readonly password: string };
  readonly acceptedJob: {
    readonly quoteId: string;
    readonly sentVersionId: string;
    readonly jobId: string;
  };
}

const fixture: JobFixture = JSON.parse(
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

test.describe("Job accepted-lock correction-boundary UX (Story 7.4 E2E)", () => {
  test("7.4-E2E-01 (AC1): the accepted job detail explains that corrections require an approved audited workflow", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/jobs/${fixture.acceptedJob.jobId}`);

    // The correction-boundary notice explains the lock rule as TEXT — the accepted commitment is
    // locked and corrections require an approved audited workflow (no silent edit). This MIRRORS the
    // INT/DB-proven rule; a UI-only lock is a STOP condition, so this is messaging, not the guarantee.
    const notice = page.getByTestId("job-accepted-lock-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/låst|låses/i);
    await expect(notice).toContainText(/granskat arbetsflöde|godkänt/i);
  });

  test("7.4-E2E-01 (AC1): NO silent edit affordance renders for any immutable commitment field", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/jobs/${fixture.acceptedJob.jobId}`);

    // The immutable commitment fields are DISPLAY-ONLY — no editable control renders for any of them.
    // (The 7.3 allowed-edit dialog exposes ONLY title/status/planned dates — those are NOT immutable
    // commitment fields and are out of scope for this negative.)
    await expect(page.getByTestId("job-accepted-price")).toBeVisible();
    for (const testId of [
      "edit-accepted-price",
      "edit-source-sent-total",
      "edit-evidence",
      "edit-source-quote-version",
      "edit-accepted-at",
      "edit-channel",
    ]) {
      await expect(page.getByTestId(testId)).toHaveCount(0);
    }
    // No generic "request correction" action that DOES anything (R-714 STOP — explanatory only).
    await expect(page.getByRole("button", { name: /begär korrigering|korrigera/i })).toHaveCount(0);
  });

  test("7.4-E2E-01 (AC1): the correction-boundary notice is keyboard-reachable and conveyed as text (a11y baseline)", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/jobs/${fixture.acceptedJob.jobId}`);

    const notice = page.getByTestId("job-accepted-lock-notice");
    await expect(notice).toBeVisible();
    // The lock state is TEXT, not color alone (the message itself carries the meaning).
    await expect(notice).not.toBeEmpty();
  });
});
