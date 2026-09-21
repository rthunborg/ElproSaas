import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { adminQuery } from "../../factories/admin-sql";

const fixture = JSON.parse(readFileSync(path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"), "utf8")) as { onboarding: { id: string; email: string; password: string } };

test("[P0] ready first Admin sees a server-derived checklist, can dismiss and restore it", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-post").fill(fixture.onboarding.email);
  await page.getByLabel("Lösenord").fill(fixture.onboarding.password);
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Kom igång" })).toBeVisible();
  const checklist = page.getByRole("list", { name: "Kom igång-steg" });
  await expect(checklist.getByRole("link")).toHaveCount(5);
  await expect(checklist.getByRole("link", { name: "Öppna" })).toHaveCount(1);
  await expect(checklist.getByRole("link", { name: "Granska" })).toHaveCount(4);
  expect(await checklist.getByRole("link").evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).getAttribute("href")))).toEqual([
    "/settings/company", "/settings/company", "/settings/quote-terms", "/settings/pricing", "/admin/users",
  ]);
  await expect(page.getByText("Offertvillkoren är sparade men saknar fortfarande juridiskt godkännande.")).toBeVisible();
  await page.getByRole("button", { name: "Dölj tills vidare" }).click();
  await expect(page.getByRole("button", { name: "Visa checklistan igen" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Visa checklistan igen" })).toBeVisible();
  await page.getByRole("button", { name: "Visa checklistan igen" }).click();
  await expect(page.getByRole("heading", { name: "Kom igång" })).toBeVisible();

  // Complete the final existing user-invitation fact in the disposable ready-tenant fixture.
  // This drives the same server projection used by the dashboard without changing shared Tenant A.
  const [onboardingTenant] = await adminQuery<{ tenant_id: string }>(
    "select tenant_id from public.tenant_memberships where user_id=$1 and role='tenant_admin' and status='active'",
    [fixture.onboarding.id],
  );
  if (!onboardingTenant) throw new Error("missing onboarding tenant fixture");
  await adminQuery(
    `with membership as (
       insert into public.tenant_memberships (id, tenant_id, role, status, invited_email, invitation_expires_at)
       values ($1, $2, 'saljare', 'invited', $3, statement_timestamp() + interval '1 hour')
       returning id
     )
     insert into public.membership_roles (tenant_id, membership_id, role)
     select $2, id, 'saljare' from membership`,
    [crypto.randomUUID(), onboardingTenant.tenant_id, `onboarding-complete-${crypto.randomUUID()}@example.test`],
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Kom igång" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Visa checklistan igen" })).toHaveCount(0);
});
