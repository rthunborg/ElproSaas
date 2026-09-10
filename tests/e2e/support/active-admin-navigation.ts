import { expect, type Locator } from "@playwright/test";
import { navItems } from "../../../src/components/app-shell/nav-items";
import { EXPECTED_NAV_ROUTES } from "../../../src/scope/nav-registry";

const ACTIVE_ADMIN_NAV_ITEMS = navItems.filter((item) => EXPECTED_NAV_ROUTES.includes(item.href));

/**
 * The tenant-admin shell must render exactly the navigation routes declared by active manifest
 * modules. Labels and presentation order remain owned by the authored app-shell registry.
 */
export async function expectActiveAdminNavigation(nav: Locator): Promise<void> {
  const expectedRoutes = [...EXPECTED_NAV_ROUTES].sort();
  const authoredRoutes = ACTIVE_ADMIN_NAV_ITEMS.map((item) => item.href).sort();
  expect(authoredRoutes).toEqual(expectedRoutes);

  const links = nav.getByRole("link");
  await expect(links).toHaveCount(expectedRoutes.length);
  await expect(links.evaluateAll((items) => items.map((item) => item.getAttribute("href")).sort())).resolves.toEqual(expectedRoutes);

  for (const { label } of ACTIVE_ADMIN_NAV_ITEMS) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
}
