/**
 * Story 14.1 ATDD red-phase UI scaffold. Selectors are deliberate implementation
 * contracts because the nav-less resource maintenance panel does not exist yet.
 */
import { expect, test } from "./support/resource-cdp-attachment";
import { readFileSync } from "node:fs";
import path from "node:path";

type RoleFixture = { readonly email: string; readonly password: string };
type Fixture = {
  readonly workRole: { readonly displayName: string };
  readonly adminUserManagement: {
    readonly tenantAdmin: RoleFixture;
    readonly resourceProfileMembershipId: string;
    readonly deactivatedResourceProfileMembershipId: string;
    readonly deactivatedResourceProfileWeekdayStart: string;
  };
};

function getFixture(): Fixture {
  return JSON.parse(readFileSync(path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"), "utf8"));
}

async function logIn(page: import("@playwright/test").Page, credentials: RoleFixture): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-post").fill(credentials.email);
  await page.getByLabel("Lösenord").fill(credentials.password);
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Settle this submit before another edit can race its action/form reset. */
async function submitResourceAndSettle(page: import("@playwright/test").Page): Promise<void> {
  const target = new URL(page.url());
  const save = page.getByTestId("resource-save");
  const button = await save.elementHandle();
  if (!button) throw new Error("Resource save control unavailable");
  type WitnessButton = HTMLButtonElement & { __resourcePendingWitness?: {
    sawPending: boolean; settled: boolean; observer: MutationObserver | null;
  } };
  // Acknowledge observer installation before clicking. Recording old values
  // preserves a fast true→false cycle even within one mutation callback.
  await button.evaluate((element) => {
    const control = element as WitnessButton;
    if (control.disabled) throw new Error("Previous resource submission is still pending");
    const witness = { sawPending: false, settled: false, observer: null as MutationObserver | null };
    witness.observer = new MutationObserver((records) => {
      if (control.disabled || records.some((record) => record.oldValue !== null)) witness.sawPending = true;
      if (witness.sawPending && !control.disabled) witness.settled = true;
    });
    witness.observer.observe(control, { attributes: true, attributeFilter: ["disabled"], attributeOldValue: true });
    control.__resourcePendingWitness = witness;
  });
  try {
    // Initial success/reload and every preceding invalid pending cycle settle
    // before registration, so an earlier action cannot satisfy this witness.
    const responsePromise = page.waitForResponse((response) => {
      const request = response.request();
      const url = new URL(response.url());
      return request.method() === "POST" && Boolean(request.headers()["next-action"])
        && url.origin === target.origin && url.pathname === target.pathname;
    }, { timeout: 15_000 });
    const [response] = await Promise.all([responsePromise, save.click()]);
    expect(response.ok()).toBe(true);
    // Whole RSC stream EOF can remain open after the action settles. Require
    // this control's observed pending cycle, never its initial enabled state.
    await expect.poll(() => button.evaluate((element) => {
      const control = element as WitnessButton;
      if (!control.isConnected || document.querySelector('[data-testid="resource-save"]') !== control) {
        throw new Error("Resource save control remounted during submission");
      }
      return control.__resourcePendingWitness?.settled === true && !control.disabled;
    }), { timeout: 15_000 }).toBe(true);
  } finally {
    if (!page.isClosed()) await button.evaluate((element) => {
      const control = element as WitnessButton;
      control.__resourcePendingWitness?.observer?.disconnect();
      delete control.__resourcePendingWitness;
    });
    await button.dispose();
  }
}

test("[P0] admin persists a same-tenant role and schedule inputs in the existing user-detail route, then reloads server state", async ({ resourcePage: page }) => {
  const fixture = getFixture();
  await logIn(page, fixture.adminUserManagement.tenantAdmin);
  await page.goto(`/admin/users/${fixture.adminUserManagement.resourceProfileMembershipId}`);

  await page.getByTestId("resource-default-work-role").selectOption({ label: fixture.workRole.displayName });
  await page.getByTestId("resource-weekday-1-start").fill("07:00");
  await page.getByTestId("resource-weekday-1-end").fill("16:00");
  await page.getByTestId("resource-break-1-start").fill("12:00");
  await page.getByTestId("resource-break-1-end").fill("12:30");
  await page.getByTestId("resource-exception-date").fill("2026-10-15");
  await page.getByTestId("resource-calendar-day-reduction").fill("50");
  await page.getByTestId("resource-person-exception-date").fill("2026-10-16");
  await page.locator('select[name="personExceptionKind"]').selectOption("blocked_time");
  await page.getByTestId("resource-save").click();

  await expect(page.getByTestId("resource-save-status")).toHaveText(/sparats/i);
  await page.reload();
  await expect(page.getByTestId("resource-weekday-1-start")).toHaveValue("07:00");
  await expect(page.getByTestId("resource-calendar-day-reduction")).toHaveValue("50");
  await expect(page.getByTestId("resource-person-exception-date")).toHaveValue("2026-10-16");

  await page.getByTestId("resource-weekday-1-start").fill("");
  await page.getByTestId("resource-weekday-1-end").fill("");
  await submitResourceAndSettle(page);
  await expect(page.getByTestId("resource-save-error")).toHaveText(/kontrollera/i);
  await page.getByTestId("resource-weekday-1-start").fill("07:00");
  await page.getByTestId("resource-weekday-1-end").fill("16:00");

  await page.getByTestId("resource-person-exception-date").fill("");
  await submitResourceAndSettle(page);
  await expect(page.getByTestId("resource-save-error")).toHaveText(/kontrollera/i);
  await page.getByTestId("resource-person-exception-date").fill("2026-10-16");

  await page.getByTestId("resource-calendar-day-reduction").fill("");
  await submitResourceAndSettle(page);
  await expect(page.getByTestId("resource-save-error")).toHaveText(/kontrollera/i);

  await page.getByTestId("resource-calendar-day-reduction").fill("50");
  await page.getByTestId("resource-weekday-1-start").fill("");
  await page.getByTestId("resource-weekday-1-end").fill("");
  await page.getByTestId("resource-break-1-start").fill("");
  await page.getByTestId("resource-break-1-end").fill("");
  await page.getByTestId("resource-exception-date").fill("");
  await page.getByTestId("resource-calendar-day-reduction").fill("");
  await page.locator('select[name="personExceptionKind"]').selectOption({ label: "Inget" });
  await expect(page.locator('select[name="personExceptionKind"]')).toHaveValue("");
  await page.getByTestId("resource-person-exception-date").fill("");
  await page.getByTestId("resource-save").click();
  await expect(page.getByTestId("resource-save-status")).toHaveText(/sparats/i);
  await page.reload();
  await expect(page.getByTestId("resource-weekday-1-start")).toHaveValue("");
  await expect(page.getByTestId("resource-break-1-start")).toHaveValue("");
  await expect(page.getByTestId("resource-calendar-day-reduction")).toHaveValue("");
  await expect(page.getByTestId("resource-person-exception-date")).toHaveValue("");
});

test("[P1] admin sees a deactivated profile as Inaktiverad without booking or reassignment affordances", async ({ resourcePage: page }) => {
  const fixture = getFixture();
  await logIn(page, fixture.adminUserManagement.tenantAdmin);
  await page.goto(`/admin/users/${fixture.adminUserManagement.deactivatedResourceProfileMembershipId}`);

  await expect(page.getByTestId("resource-profile-status")).toHaveText("Inaktiverad");
  await expect(page.getByTestId("resource-weekday-1-start")).toHaveValue(fixture.adminUserManagement.deactivatedResourceProfileWeekdayStart);
  await expect(page.getByTestId("resource-booking-action")).toHaveCount(0);
  await expect(page.getByTestId("resource-reassignment-action")).toHaveCount(0);
});

test("[P0] at 360×640 a server-observable transient save failure retains unsent input and succeeds only after retry", async ({ resourcePage: page }) => {
  const fixture = getFixture();
  await page.setViewportSize({ width: 360, height: 640 });
  await logIn(page, fixture.adminUserManagement.tenantAdmin);
  await page.goto(`/admin/users/${fixture.adminUserManagement.resourceProfileMembershipId}?resourceSaveFailure=once`);

  await page.getByTestId("resource-weekday-1-start").fill("08:00");
  await page.getByTestId("resource-weekday-1-end").fill("16:00");
  await page.getByTestId("resource-save").click();
  await expect(page.getByTestId("resource-save-error")).toHaveText(/försök igen/i);
  await expect(page.getByTestId("resource-save-status")).toHaveCount(0);
  await expect(page.getByTestId("resource-weekday-1-start")).toHaveValue("08:00");

  await page.getByTestId("resource-retry-save").click();
  await expect(page.getByTestId("resource-save-status")).toHaveText(/sparats/i);
  await page.reload();
  await expect(page.getByTestId("resource-weekday-1-start")).toHaveValue("08:00");
});

test("[P0] compact form preserves precise read-model values and a hidden split shift during partial edits", async ({ resourcePage: page }) => {
  const fixture = getFixture();
  const { adminExec, adminQuery } = await import("../factories/admin-sql");
  const [profile] = await adminQuery<{ id: string; tenant_id: string }>(
    "select id,tenant_id from public.person_profiles where membership_id=$1",
    [fixture.adminUserManagement.resourceProfileMembershipId],
  );
  if (!profile) throw new Error("resource profile fixture is unavailable");
  await adminExec("delete from public.person_work_hours where person_profile_id=$1", [profile.id]);
  await adminExec(
    "insert into public.person_work_hours(tenant_id,person_profile_id,entry_kind,weekday,starts_at,ends_at,local_date,exception_kind) values ($1,$2,'weekly_shift',1,'07:00:30.123456','10:00:30.123456',null,null),($1,$2,'weekly_break',1,'08:00:30.123456','08:15:30.123456',null,null),($1,$2,'weekly_shift',1,'13:00:30.123456','16:00:30.123456',null,null),($1,$2,'weekly_break',1,'14:00:30.123456','14:15:30.123456',null,null),($1,$2,'exception',null,'09:00:30.123456','10:00:30.123456','2026-10-16','blocked_time')",
    [profile.tenant_id, profile.id],
  );

  await logIn(page, fixture.adminUserManagement.tenantAdmin);
  await page.goto(`/admin/users/${fixture.adminUserManagement.resourceProfileMembershipId}`);
  await expect(page.getByTestId("resource-weekday-1-start")).toHaveValue("07:00");
  await page.locator('input[name="employmentPercentage"]').fill("81");
  await page.getByTestId("resource-save").click();
  await expect(page.getByTestId("resource-save-status")).toHaveText(/sparats/i);
  await page.reload();
  await expect(page.getByTestId("resource-weekday-1-start")).toHaveValue("07:00");

  const rowsAfterUnrelatedSave = await adminQuery<{ entry_kind: string; weekday: number | null; starts_at: string }>(
    "select entry_kind,weekday,starts_at::text from public.person_work_hours where person_profile_id=$1 order by entry_kind,weekday nulls first,starts_at",
    [profile.id],
  );
  expect(rowsAfterUnrelatedSave).toEqual([
    { entry_kind: "exception", weekday: null, starts_at: "09:00:30.123456" },
    { entry_kind: "weekly_break", weekday: 1, starts_at: "08:00:30.123456" },
    { entry_kind: "weekly_break", weekday: 1, starts_at: "14:00:30.123456" },
    { entry_kind: "weekly_shift", weekday: 1, starts_at: "07:00:30.123456" },
    { entry_kind: "weekly_shift", weekday: 1, starts_at: "13:00:30.123456" },
  ]);

  await page.getByTestId("resource-weekday-1-start").fill("");
  await page.getByTestId("resource-weekday-1-end").fill("");
  await page.getByTestId("resource-break-1-start").fill("");
  await page.getByTestId("resource-break-1-end").fill("");
  await page.getByTestId("resource-weekday-2-start").fill("07:00");
  await page.getByTestId("resource-weekday-2-end").fill("08:00");
  await page.getByTestId("resource-save").click();
  await expect(page.getByTestId("resource-save-status")).toHaveText(/sparats/i);
  await page.reload();
  await expect(page.getByTestId("resource-weekday-1-start")).toHaveValue("13:00");

  const rowsAfterPartialClear = await adminQuery<{ entry_kind: string; weekday: number | null; starts_at: string }>(
    "select entry_kind,weekday,starts_at::text from public.person_work_hours where person_profile_id=$1 order by entry_kind,weekday nulls first,starts_at",
    [profile.id],
  );
  expect(rowsAfterPartialClear).toEqual([
    { entry_kind: "exception", weekday: null, starts_at: "09:00:30.123456" },
    { entry_kind: "weekly_break", weekday: 1, starts_at: "14:00:30.123456" },
    { entry_kind: "weekly_shift", weekday: 1, starts_at: "13:00:30.123456" },
    { entry_kind: "weekly_shift", weekday: 2, starts_at: "07:00:00" },
  ]);
});
