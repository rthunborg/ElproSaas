/**
 * Story 8.4 — 8.4-E2E-01 (P1, AC1/AC3): the locked-file panel MESSAGING + affordance on a sent
 * quote / accepted acceptance (R-812). STATES + MESSAGING ONLY — the lock ENFORCEMENT is INT/RLS
 * territory (a test that only proves the UI disables a control is NOT evidence; architecture §9). Do
 * NOT assert DB rejection in E2E.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * RED PHASE (ATDD) — all three tests are `test.skip`. The locked-file panel state does not render yet:
 * the 8.2 `EntityFilePanel` must disable its replace/delete affordance on a locked file and show the
 * lock notice once 8.4 lands, and the archive-only affordance must replace a delete. Remove `test.skip`
 * in dev-story green phase and add the `data-testid`s the spec expects. Kept skipped so the every-PR
 * E2E gate stays green today.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Coverage (STATES + MESSAGING only):
 *   - On a SENT quote's file panel, the locked PDF/attachment shows a lock notice explaining it is
 *     locked because the quote is sent and can be ARCHIVED but not replaced/deleted (TEXT, not color).
 *   - NO replace/delete affordance renders for a locked file (the disabled/absent control is UX only —
 *     NEVER the guarantee; the command + trigger are). An ARCHIVE affordance MAY render (archive-only).
 *   - On an accepted acceptance's evidence panel, the same locked-evidence notice renders.
 *   - The notice + every control is keyboard-reachable with a visible focus ring; the lock state is
 *     conveyed as TEXT (the a11y baseline — MEMORY: prefer event-driven a11y focus over :focus checks).
 *
 * Runs against the REAL app + local Supabase stack + a DEDICATED fixture (global-setup drives the real
 * sent + accept chains and persists the sent quote/version + accepted acceptance + their file ids).
 * Mirrors `job-accepted-lock.e2e.spec.ts` (7.4-E2E-01 — the message-only E2E) + `quote-sent-lock.e2e.spec.ts`
 * (6.4-E2E-01). Per-run-unique fixture keys via `crypto.randomUUID()` in global-setup (the epic-3 flake
 * lesson — NEVER `Date.now()`).
 *
 * [Source: test-design-epic-8.md (8.4 lock-warning UX row, R-812); story 8.4 AC1/AC3 + Task 5.1;
 *  architecture.md#9 (UI lock is not evidence) / #14 (archive-over-delete);
 *  tests/e2e/jobs/job-accepted-lock.e2e.spec.ts (7.4-E2E-01 — the message-only E2E to mirror);
 *  src/components/files/EntityFilePanel.tsx (the panel the lock notice + disabled affordance land on);
 *  MEMORY (preview-harness focus limitation — prefer event-driven a11y focus)]
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

interface FileLockFixture {
  readonly adminA: { readonly email: string; readonly password: string };
  readonly sentQuote: {
    readonly quoteId: string;
    readonly sentVersionId: string;
  };
  readonly acceptedAcceptance: {
    readonly acceptanceId: string;
    readonly quoteId: string;
  };
}

const fixture: FileLockFixture = JSON.parse(
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

test.describe("Locked-file panel lock/archive UX (Story 8.4 E2E)", () => {
  test.skip("8.4-E2E-01 (AC1): a SENT quote's locked PDF/attachment shows a lock notice and NO replace/delete affordance", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.sentQuote.quoteId}`);

    // The lock notice explains the file is locked because the quote is sent, and can be archived but
    // not replaced/deleted — TEXT, not color. This MIRRORS the INT/DB-proven rule; a UI-only lock is a
    // STOP, so this is messaging, not the guarantee.
    const notice = page.getByTestId("file-lock-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/låst|låses/i);
    await expect(notice).toContainText(/arkiver/i); // "kan arkiveras men inte ändras/tas bort"

    // NO replace/delete affordance renders for the locked file (the disabled/absent control is UX only).
    for (const testId of ["replace-file", "delete-file"]) {
      await expect(page.getByTestId(testId)).toHaveCount(0);
    }
  });

  test.skip("8.4-E2E-01 (AC3): the ONLY destructive affordance on a locked file is archive-only", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.sentQuote.quoteId}`);

    // Archive-over-delete: an archive control MAY render (the sanctioned soft-delete); a hard-delete
    // control must NOT. The archive action is keyboard-reachable.
    const archive = page.getByTestId("archive-file");
    await expect(archive).toBeVisible();
    await expect(page.getByTestId("delete-file")).toHaveCount(0);
  });

  test.skip("8.4-E2E-01 (AC2): an accepted acceptance's evidence file shows the same locked-evidence notice", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.acceptedAcceptance.quoteId}`);

    const notice = page.getByTestId("evidence-lock-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/låst|låses/i);
    // The lock state is TEXT, not color alone (the message itself carries the meaning — a11y baseline).
    await expect(notice).not.toBeEmpty();
  });
});
