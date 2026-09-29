/**
 * Story 13.3 browser acceptance coverage.
 *
 * This suite drives the existing authenticated notifications route. It introduces
 * no navigation expectation or delivery/release control: Story 13.3 is queued and
 * non-sending. Database transition, append-only, RLS, and SKIP LOCKED guarantees
 * belong to the required integration/RLS suites.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

type Credentials = { readonly email: string; readonly password: string };
type OutboxFixture = {
  readonly emailOutbox: {
    readonly administrator: Credentials;
    readonly nonAdmin: Credentials;
    readonly otherTenantAdministrator: Credentials;
    readonly queueReferences: {
      readonly queued: string;
      readonly retry: string;
      readonly failed: string;
      readonly suppressed: string;
      readonly otherTenant: string;
    };
  };
};

let cachedFixture: OutboxFixture | undefined;

function fixture(): OutboxFixture {
  cachedFixture ??= JSON.parse(
    readFileSync(path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"), "utf8"),
  ) as OutboxFixture;
  return cachedFixture;
}

async function waitForHydrated(locator: Locator): Promise<void> {
  await locator.waitFor({ state: "visible" });
  await locator.evaluate(
    (element) =>
      new Promise<void>((resolve) => {
        const tick = () =>
          Object.keys(element).some((key) => key.startsWith("__react"))
            ? resolve()
            : requestAnimationFrame(tick);
        tick();
      }),
  );
}

async function signIn(page: Page, credentials: Credentials): Promise<void> {
  await page.goto("/login");
  const submit = page.getByRole("button", { name: "Logga in" });
  await waitForHydrated(submit);
  await page.getByLabel("E-post").fill(credentials.email);
  await page.getByLabel("Lösenord").fill(credentials.password);
  await submit.click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function openNotifications(page: Page, credentials: Credentials): Promise<void> {
  await signIn(page, credentials);
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "Notiser" })).toBeVisible();
}

test.describe("Story 13.3 E-postutkö — Admin-projektion", () => {
  test("[P0] Admin sees truthful queued, retry, failed, and suppressed outbox states without delivery activation", async ({ page }) => {
    await openNotifications(page, fixture().emailOutbox.administrator);
    const queue = page.getByTestId("email-outbox-queue");
    await expect(queue).toBeVisible();
    await expect(queue.getByRole("heading", { name: "E-postutkö" })).toBeVisible();
    for (const [reference, state] of [
      [fixture().emailOutbox.queueReferences.queued, "Köad"],
      [fixture().emailOutbox.queueReferences.retry, "Försök igen"],
      [fixture().emailOutbox.queueReferences.failed, "Misslyckad"],
      [fixture().emailOutbox.queueReferences.suppressed, "Undertryckt"],
    ] as const) {
      const row = queue.getByRole("row").filter({ hasText: reference });
      await expect(row).toBeVisible();
      await expect(row).toContainText(state);
    }
    const retryRow = queue.getByRole("row").filter({ hasText: fixture().emailOutbox.queueReferences.retry });
    await expect(retryRow).toContainText(/nästa försök/i);
    const failedRow = queue.getByRole("row").filter({ hasText: fixture().emailOutbox.queueReferences.failed });
    await expect(failedRow).toContainText("Misslyckad — kunde inte levereras");
    await expect(failedRow).not.toContainText(/nästa försök/i);
    await expect(queue.getByRole("button", { name: /skicka|aktivera|leverera/i })).toHaveCount(0);
    await expect(queue.getByRole("link", { name: /skicka|aktivera|leverera/i })).toHaveCount(0);
  });

  test("[P0] Admin queue projection withholds recipient, template body, and raw failure detail", async ({ page }) => {
    await openNotifications(page, fixture().emailOutbox.administrator);
    const queue = page.getByTestId("email-outbox-queue");
    await expect(queue).toBeVisible();
    await expect(queue.getByText(/admin-only|kundens e-post|rått providerfel/i)).toHaveCount(0);
    await expect(queue.getByRole("columnheader", { name: /mottagare|e-postadress|malltext|innehåll/i })).toHaveCount(0);
    const failedRow = queue.getByRole("row").filter({ hasText: fixture().emailOutbox.queueReferences.failed });
    await expect(failedRow).toContainText(/kunde inte levereras/i);
    await expect(failedRow).not.toContainText(/api[_ -]?key|authorization|recipient/i);
  });

  test("[P0] non-Admin cannot read the email outbox projection through the existing notifications route", async ({ page }) => {
    await openNotifications(page, fixture().emailOutbox.nonAdmin);
    await expect(page.getByTestId("email-outbox-queue")).toHaveCount(0);
    await expect(page.getByText(fixture().emailOutbox.queueReferences.queued)).toHaveCount(0);
    await expect(page.getByText(fixture().emailOutbox.queueReferences.failed)).toHaveCount(0);
  });

  test("[P0] an Admin in another tenant never sees this tenant’s queue references", async ({ page }) => {
    await openNotifications(page, fixture().emailOutbox.otherTenantAdministrator);
    const queue = page.getByTestId("email-outbox-queue");
    await expect(queue).toBeVisible();
    await expect(queue.getByText(fixture().emailOutbox.queueReferences.otherTenant)).toBeVisible();
    for (const foreignReference of [
      fixture().emailOutbox.queueReferences.queued,
      fixture().emailOutbox.queueReferences.retry,
      fixture().emailOutbox.queueReferences.failed,
      fixture().emailOutbox.queueReferences.suppressed,
    ]) {
      await expect(queue.getByText(foreignReference)).toHaveCount(0);
    }
  });
});
