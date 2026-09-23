/**
 * Story 13.2 browser acceptance coverage.
 *
 * The assertions drive the authenticated production-mode app against per-recipient
 * local fixture rows. Database authority and raw-write negatives belong to the
 * integration/RLS suite.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

type Credentials = { readonly email: string; readonly password: string };
type NotificationFixture = {
  readonly notifications: {
    readonly administrator: Credentials;
    readonly projectManager: Credentials;
    readonly salesperson: Credentials;
    readonly installer: Credentials;
    readonly finance: Credentials;
    readonly empty: Credentials;
    readonly storedRoute: string;
  };
};
type NotificationRole = keyof Omit<NotificationFixture["notifications"], "storedRoute">;

const FIXTURE_PATH = path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json");

let cachedFixture: NotificationFixture | undefined;

function fixture(): NotificationFixture {
  cachedFixture ??= JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as NotificationFixture;
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

async function openBell(page: Page): Promise<Locator> {
  const bell = page.getByRole("button", { name: /notiser/i });
  await expect(bell).toBeVisible();
  await bell.click();
  const popover = page.getByRole("dialog", { name: /notiser/i });
  await expect(popover).toBeVisible();
  return popover;
}

test.describe("Story 13.2 In-app-notiser — bell, center och inställningar (ATDD RED)", () => {
  const validRoles: ReadonlyArray<readonly [string, NotificationRole]> = [
    ["Företagsadmin", "administrator"],
    ["Projektledare", "projectManager"],
    ["Säljare", "salesperson"],
    ["Montör", "installer"],
    ["Ekonomi", "finance"],
  ];

  for (const [roleName, role] of validRoles) {
    test(`[P0] ${roleName} sees the personal bell with a capped 9+ unread count`, async ({ page }) => {
      await signIn(page, fixture().notifications[role]);
      const bell = page.getByRole("button", { name: /notiser.*9\+/i });
      await expect(bell).toBeVisible();
      await expect(bell).toHaveAccessibleName(/9\+.*olästa notiser/i);
      await expect(page.getByRole("navigation", { name: "Huvudnavigation" }).getByRole("link", { name: /notiser/i })).toHaveCount(0);
    });
  }

  test("[P0] Bell popover lists the latest personal notifications and opens the personal center", async ({ page }) => {
    await signIn(page, fixture().notifications.administrator);
    const popover = await openBell(page);
    await expect(popover.getByRole("list").getByRole("listitem")).toHaveCount(10);
    await expect(popover.getByRole("button", { name: "Markera alla som lästa" })).toBeVisible();
    await popover.getByRole("link", { name: "Visa alla" }).click();
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(page.getByRole("heading", { name: "Notiser" })).toBeVisible();
  });

  test("[P0] A stored notification link marks the item read and opens its entitled destination", async ({ page }) => {
    const data = fixture().notifications;
    await signIn(page, data.administrator);
    const popover = await openBell(page);
    const notification = popover.getByRole("listitem").filter({ hasText: /uppföljning/i }).first();
    await notification.getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`${data.storedRoute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    await page.goBack();
    await expect(page.getByRole("button", { name: /notiser.*olästa notiser/i })).not.toHaveAccessibleName(/9\+.*olästa notiser/i);
  });

  test("[P0] Notification center applies module/category, read-state, and date filters together", async ({ page }) => {
    await signIn(page, fixture().notifications.projectManager);
    await page.goto("/notifications");
    await page.getByLabel("Modul eller kategori").selectOption("quotes");
    await page.getByLabel("Lässtatus").selectOption("unread");
    await page.getByLabel("Från datum").fill("2026-09-01");
    const rows = page.getByRole("main").getByRole("listitem");
    await expect(rows.first()).toContainText(/uppföljning/i);
    await expect(rows).toHaveCount(10);
    for (let index = 0; index < 10; index += 1) {
      await expect(rows.nth(index)).toHaveAccessibleName("oläst");
    }
  });

  test("[P1] Marking one notification as read updates the bell and row state", async ({ page }) => {
    await signIn(page, fixture().notifications.salesperson);
    await page.goto("/notifications");
    const row = page.getByRole("listitem", { name: "oläst", exact: true }).filter({ hasText: /uppföljning/i }).first();
    await row.getByRole("button", { name: "Markera som läst" }).click();
    await expect(row).toHaveAccessibleName("läst");
    await expect(page.getByRole("button", { name: /notiser/i })).toHaveAccessibleName(/olästa notiser/i);
  });

  test("[P1] Mark all read updates the popover and persists after reload", async ({ page }) => {
    await signIn(page, fixture().notifications.finance);
    const popover = await openBell(page);
    await popover.getByRole("button", { name: "Markera alla som lästa" }).click();
    await expect(popover.getByText("Inga olästa notiser")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: /notiser/i })).not.toHaveAccessibleName(/olästa notiser/i);
  });

  test("[P1] Failed optimistic mark-read restores persisted state and offers recovery after reload", async ({ page }) => {
    await signIn(page, fixture().notifications.administrator);
    await page.goto("/notifications");
    // Intentional fault injection: it must exercise rollback, never manufacture a successful UI response.
    await page.route("**/api/notifications/*/read", (route) => route.fulfill({ status: 500, body: "{}" }));
    const row = page.getByRole("listitem", { name: "oläst", exact: true }).filter({ hasText: /uppföljning/i }).first();
    await row.getByRole("button", { name: "Markera som läst" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /kunde inte markera.*försök igen/i })).toBeVisible();
    await expect(row).toHaveAccessibleName(/oläst/i);
    await page.unroute("**/api/notifications/*/read");
    await page.reload();
    await expect(row).toHaveAccessibleName(/oläst/i);
  });

  test("[P0] Profile preferences group the active category by module", async ({ page }) => {
    await signIn(page, fixture().notifications.projectManager);
    await page.getByRole("button", { name: /profil/i }).click();
    await page.getByRole("link", { name: "Notisinställningar" }).click();
    await expect(page.getByRole("heading", { name: "Notisinställningar" })).toBeVisible();
    const quotesGroup = page.getByRole("group", { name: /offerter/i });
    await expect(quotesGroup.getByText("Viktig uppföljning av offert", { exact: true })).toBeVisible();
    await expect(quotesGroup.getByRole("switch", { name: "Viktig uppföljning av offert i appen", exact: true })).toBeDisabled();
  });

  test("[P0] Essential in-app notification preference is visibly required and cannot be disabled", async ({ page }) => {
    await signIn(page, fixture().notifications.administrator);
    await page.goto("/settings/notifications");
    const essential = page.getByRole("switch", { name: /viktig.*i appen/i });
    await expect(essential).toBeChecked();
    await expect(essential).toBeDisabled();
    await expect(page.getByText(/obligatorisk notis/i)).toBeVisible();
  });

  test("[P1] Email preference controls are inactive with the Swedish future-delivery explanation", async ({ page }) => {
    await signIn(page, fixture().notifications.salesperson);
    await page.goto("/settings/notifications");
    const emailColumn = page.getByRole("columnheader", { name: "E-post" });
    await expect(emailColumn).toBeVisible();
    await expect(page.getByText("e-postutskick aktiveras senare")).toBeVisible();
    await expect(page.getByRole("switch", { name: "Viktig uppföljning av offert e-post", exact: true })).toBeDisabled();
  });

  test("[P2] Bell popover supports keyboard activation, semantic labels, and focus return", async ({ page }) => {
    await signIn(page, fixture().notifications.installer);
    const bell = page.getByRole("button", { name: /notiser/i });
    await bell.focus();
    await page.keyboard.press("Enter");
    const popover = page.getByRole("dialog", { name: /notiser/i });
    await expect(popover).toBeVisible();
    await expect(popover.getByRole("listitem").first()).toHaveAccessibleName(/oläst|läst/i);
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await expect(bell).toBeFocused();
  });

  test("[P2] Empty and never-run states are explicit and make no real-time delivery claim", async ({ page }) => {
    await signIn(page, fixture().notifications.empty);
    await page.goto("/notifications");
    await expect(page.getByText("Du har inga notiser ännu")).toBeVisible();
    await expect(page.getByText(/ingen tidigare skanning/i)).toBeVisible();
    await expect(page.getByText(/realtid/i)).toHaveCount(0);
  });

  test("[P2] Stale producer state exposes elapsed scan information without claiming current delivery", async ({ page }) => {
    await signIn(page, fixture().notifications.administrator);
    await page.goto("/notifications");
    await expect(page.getByText(/skannad för \d+ tim sedan/i)).toBeVisible();
    await expect(page.getByRole("status")).toContainText(/senaste skanning/i);
    await expect(page.getByText(/uppdateras i realtid/i)).toHaveCount(0);
  });
});
