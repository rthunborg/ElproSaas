/**
 * Story 2.1 — E2E acceptance (browser journeys), GREEN as of the Playwright runner
 * (TEA testarch-framework). Closes foundation gaps G-2 (UI active-tenant-context
 * display) and G-3 (anonymous route redirect).
 *
 * Seeded by `tests/e2e/global-setup.ts`: adminA has an active `tenant_admin` membership
 * in tenantA; orphanUser has none. The app runs against the local Supabase stack
 * (`playwright.config.ts` webServer).
 *
 * COVERAGE (test-design-epic-2-foundation-consolidated.md):
 *   AC3 → anonymous → protected route redirects to /login (G-3, P1)
 *   AC1 → tenant_admin signs in → lands in the (app) shell
 *   AC1 → top bar shows the resolved tenant/company context + current user (G-2, P1)
 *   AC2 → authenticated user WITHOUT active membership → user-safe no-access, zero tenant data
 *   round-trip → sign out → /login, and a protected route redirects again (AC1 + AC3)
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

interface FixtureCreds {
  readonly tenantA: { readonly name: string };
  readonly adminA: { readonly email: string; readonly password: string };
  readonly orphanUser: { readonly email: string; readonly password: string };
}

const fixture: FixtureCreds = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"),
    "utf8",
  ),
);

/**
 * Wait until a control is React-HYDRATED before interacting. The login form + sign-out
 * are client islands; clicking before hydration triggers the browser's NATIVE submit
 * (a GET that puts credentials in the URL) or a no-op, racing the JS handler. React
 * attaches `__reactFiber$`/`__reactProps$` keys to a DOM node once it has hydrated —
 * poll for that as a deterministic readiness signal (more reliable than networkidle,
 * which Next dev's HMR socket never reaches).
 */
async function waitForHydrated(locator: Locator): Promise<void> {
  await locator.waitFor({ state: "visible" });
  await locator.evaluate(
    (el) =>
      new Promise<void>((resolve) => {
        const ready = () =>
          Object.keys(el).some((k) => k.startsWith("__react"));
        const tick = () => (ready() ? resolve() : requestAnimationFrame(tick));
        tick();
      }),
  );
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  const submit = page.getByRole("button", { name: "Logga in" });
  await waitForHydrated(submit); // the whole form hydrates with its submit control
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Lösenord").fill(password);
  await submit.click();
}

test.describe("Login + tenant-context display (Story 2.1 E2E — G-2/G-3)", () => {
  test("AC3: an anonymous visitor to a protected (app) route is redirected to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("AC1: a tenant_admin can sign in with email + password and lands in the (app) shell", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("AC1/G-2: after sign-in, the top bar displays the resolved active tenant/company context and current user", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId("tenant-context")).toContainText(
      fixture.tenantA.name,
    );
    await expect(page.getByTestId("current-user")).toContainText(
      fixture.adminA.email,
    );
  });

  test("AC2: an authenticated user WITHOUT active membership sees a user-safe no-access state and ZERO tenant data", async ({
    page,
  }) => {
    await signIn(page, fixture.orphanUser.email, fixture.orphanUser.password);
    // Authenticated-but-no-membership renders NoTenantAccess (role="alert") INSTEAD of
    // the shell — a generic denial that never reveals whether a tenant/user exists.
    // Scope to user-facing application content: after a client navigation, Next injects
    // `#__next-route-announcer__` (also role="alert") beside the application root and
    // gives it the route title, so denial text alone is no longer unique.
    await expect(
      page.locator("main").getByRole("alert").filter({ hasText: "Ingen åtkomst" }),
    ).toBeVisible();
    // ZERO tenant data: the shell's tenant-context anchor must not be present at all.
    await expect(page.getByTestId("tenant-context")).toHaveCount(0);
  });

  test("login/logout loop: signing out returns to /login and a protected route again redirects (AC1 + AC3 round-trip)", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await expect(page).toHaveURL(/\/dashboard/);

    const signOut = page.getByRole("button", { name: "Logga ut" });
    await waitForHydrated(signOut); // client island — wait before clicking
    await signOut.click();
    await expect(page).toHaveURL(/\/login(\?|$)/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});
