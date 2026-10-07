/**
 * Story 14.4 ATDD RED: every case is intentionally skipped.
 * Planned selectors are test-owned contracts from AC1..6 / Contract D, UNVERIFIED.
 * No calendar/nav/recurrence host is scaffolded. Empty-slot click/drag belongs
 * to 15.1 actual Schema/Resurser before their entry exposure and completion.
 * Library gate exception: playwright-utils=true but package is absent; use
 * established resourcePage fixture with typed production transport binding.
 */
import { test, expect, type Scenario } from "./support/booking-editor-atdd";
import type { Locator, Page } from "@playwright/test";
import { bookingSnapshot, type BookingSnapshot, type DurableRow } from "../support/bookings-atdd";

async function signIn(page: Page, scenario: Scenario): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-post").fill(scenario.credentials.email);
  await page.getByLabel("Lösenord").fill(scenario.credentials.password);
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
const editor = (page: Page) => page.getByTestId("booking-editor");
const summary = (page: Page, id: string) => page.getByTestId("booking-summary-" + id);
async function openToolbar(page: Page): Promise<void> {
  await page.goto("/jobs");
  await page.getByTestId("booking-entry-toolbar").getByRole("button", { name: "Ny bokning" }).click();
  await expect(editor(page)).toHaveAttribute("role", "dialog");
  await expect(editor(page)).toHaveAttribute("aria-modal", "true");
}
async function fillDraft(page: Page, scenario: Scenario): Promise<void> {
  const sheet = editor(page);
  await sheet.getByTestId("booking-description").fill(scenario.description);
  await sheet.getByTestId("booking-start").fill(scenario.startsLocal);
  await sheet.getByTestId("booking-end").fill(scenario.endsLocal);
  await sheet.getByTestId("booking-work-role").selectOption(scenario.workRoleId);
  await sheet.getByTestId("booking-status").selectOption("planned");
  for (const label of scenario.assigneeLabels) {
    await sheet.getByRole("checkbox", { name: label, exact: true }).check();
  }
  await expect(sheet.getByTestId("booking-availability")).toBeVisible();
}
function added(before: readonly DurableRow[], after: readonly DurableRow[]): DurableRow[] {
  const priorIds = new Set(before.map((row) => row.id));
  return after.filter((row) => !priorIds.has(row.id));
}
function expectOneCreate(
  before: BookingSnapshot, after: BookingSnapshot, scenario: Scenario,
  connections: { jobId: string | null; customerId: string | null },
): DurableRow {
  const created = added(before.bookings, after.bookings);
  expect(created).toHaveLength(1);
  const row = created[0]!;
  expect(row).toMatchObject({
    tenant_id: scenario.tenantId, description: scenario.description,
    starts_at: scenario.expectedStartsAt, ends_at: scenario.expectedEndsAt,
    status: "planned", all_day: false,
    work_role_id: scenario.workRoleId,
    job_id: connections.jobId, customer_id: connections.customerId,
    series_id: null, occurrence_index: null, is_exception: false,
  });
  expect(after.assignees.filter((item) => item.booking_id === row.id)
    .map((item) => item.person_profile_id).sort()).toEqual([...scenario.assigneeIds].sort());
  const audits = added(before.audit, after.audit);
  expect(audits).toHaveLength(1);
  expect(audits[0]).toMatchObject({ tenant_id: scenario.tenantId, actor_user_id: scenario.actorUserId });
  expect(row.create_command_id).toEqual(expect.any(String));
  expect(row.create_result).toMatchObject({ bookingId: row.id });
  return row;
}
async function expectTarget(locator: Locator, minHeight = 44): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
  expect(bounds!.height).toBeGreaterThanOrEqual(minHeight);
}
async function saveConfirmed(page: Page, confirmed: Promise<void>): Promise<void> {
  await editor(page).getByTestId("booking-save").click();
  await confirmed;
  await expect(page.getByTestId("booking-save-status")).toHaveText(/sparats/i);
  await expect(page.getByTestId("booking-save-status")).toHaveAttribute("role", "status");
}

test.describe("Story 14.4 booking editor retained browser acceptance (RED)", () => {
  test.skip("[P0] E2E-006 toolbar creates a standalone booking through the desktop sheet", async ({ resourcePage: page, bookingEditor: h }) => {
    const s = await h.seed("conflict-free");
    await page.setViewportSize({ width: 1280, height: 800 });
    const observer = await h.observeNextConfirmedSave(); // network first
    const before = await bookingSnapshot(s.tenantIds);
    await signIn(page, s);
    await openToolbar(page);
    const bounds = await editor(page).boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThan(0);
    expect(Math.abs(bounds!.x + bounds!.width - 1280)).toBeLessThanOrEqual(1);
    for (const field of ["booking-job", "booking-customer", "booking-facility", "booking-contact"]) {
      await expect(editor(page).getByTestId(field)).toHaveValue("");
    }
    await fillDraft(page, s);
    await expect(editor(page).getByTestId("booking-all-day")).not.toBeChecked();
    await saveConfirmed(page, observer.confirmed);
    const row = expectOneCreate(before, await bookingSnapshot(s.tenantIds), s, { jobId: null, customerId: null });
    expect(row.facility_id).toBeNull();
    expect(row.contact_id).toBeNull();
  });

  for (const host of ["job", "customer"] as const) {
    test.skip("[P0] E2E-006 " + host + " entry persists preconnection then reopens and edits", async ({ resourcePage: page, bookingEditor: h }) => {
      const s = await h.seed("conflict-free");
      const before = await bookingSnapshot(s.tenantIds);
      const createObserver = await h.observeNextConfirmedSave();
      await signIn(page, s);
      await page.goto(host === "job" ? "/jobs/" + s.jobId : "/customers/" + s.customerId);
      await page.getByTestId("booking-entry-" + host).getByRole("button", { name: /^(Boka|Ny bokning)$/ }).click();
      await expect(editor(page).getByTestId(host === "job" ? "booking-job" : "booking-customer"))
        .toHaveValue(host === "job" ? s.jobId : s.customerId);
      await fillDraft(page, s);
      // Bind compatible connection options, then deliberately clear optional links.
      await editor(page).getByTestId("booking-customer").selectOption(s.customerId);
      await editor(page).getByTestId("booking-facility").selectOption(s.facilityId);
      await editor(page).getByTestId("booking-contact").selectOption(s.contactId);
      await editor(page).getByTestId("booking-contact").selectOption("");
      await editor(page).getByTestId("booking-facility").selectOption("");
      await saveConfirmed(page, createObserver.confirmed);
      const committed = await bookingSnapshot(s.tenantIds);
      const row = expectOneCreate(before, committed, s, { jobId: host === "job" ? s.jobId : null, customerId: s.customerId });
      expect(row.facility_id).toBeNull();
      expect(row.contact_id).toBeNull();
      await page.reload();
      await summary(page, row.id).getByTestId("booking-edit").click();
      await expect(editor(page).getByTestId("booking-description")).toHaveValue(s.description);
      await expect(editor(page).getByTestId("booking-start")).toHaveValue(s.startsLocal);
      const updateObserver = await h.observeNextConfirmedSave(); // before edit/save
      await editor(page).getByTestId("booking-description").fill(s.description + " edited");
      await saveConfirmed(page, updateObserver.confirmed);
      const updated = await bookingSnapshot(s.tenantIds);
      expect(updated.bookings.filter((item) => item.id === row.id)).toHaveLength(1);
      expect(updated.bookings.find((item) => item.id === row.id)).toMatchObject({
        description: s.description + " edited", starts_at: row.starts_at, ends_at: row.ends_at,
        job_id: row.job_id, customer_id: row.customer_id,
      });
      expect(added(committed.bookings, updated.bookings)).toHaveLength(0);
      expect(added(committed.audit, updated.audit)).toHaveLength(1);
      await page.reload();
      await summary(page, row.id).getByTestId("booking-edit").click();
      await expect(editor(page).getByTestId("booking-description")).toHaveValue(s.description + " edited");
    });
  }

  test.skip("[P1] E2E-001/007 360x640 fullscreen editor scrolls without overflow and keeps actions reachable", async ({ resourcePage: page, bookingEditor: h }) => {
    const s = await h.seed("conflict-free");
    await page.setViewportSize({ width: 360, height: 640 });
    await signIn(page, s);
    await openToolbar(page);
    await fillDraft(page, s);
    const bounds = await editor(page).boundingBox();
    expect(bounds).not.toBeNull();
    expect(Math.abs(bounds!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(bounds!.y)).toBeLessThanOrEqual(1);
    expect(bounds!.width).toBe(360);
    expect(bounds!.height).toBe(640);
    const scroll = editor(page).getByTestId("booking-editor-scroll-body");
    expect(await scroll.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    expect(await editor(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const target of ["booking-start", "booking-end", "booking-status", "booking-work-role", "booking-close"]) {
      await expectTarget(editor(page).getByTestId(target));
    }
    for (const id of s.assigneeIds) {
      await expectTarget(editor(page).getByTestId("booking-assignee-option-" + id));
    }
    await expectTarget(editor(page).getByTestId("booking-save"), 48);
    const saveBounds = await editor(page).getByTestId("booking-save").boundingBox();
    expect(saveBounds!.y).toBeGreaterThanOrEqual(0);
    expect(saveBounds!.y + saveBounds!.height).toBeLessThanOrEqual(640);
  });

  test.skip("[P1] E2E-002 reload chip counts persisted OPEN logical conflicts only", async ({ resourcePage: page, bookingEditor: h }) => {
    const s = await h.seed("persisted-conflict-states");
    const durable = await bookingSnapshot(s.tenantIds);
    const rows = durable.conflicts.filter((row) => row.booking_id === s.persistedBookingId || row.related_booking_id === s.persistedBookingId);
    expect(rows.filter((row) => row.status === "open")).toHaveLength(s.expectedOpenRowCount);
    expect(rows.filter((row) => row.status === "accepted").length).toBeGreaterThan(0);
    expect(rows.filter((row) => row.status === "resolved").length).toBeGreaterThan(0);
    expect(s.expectedOpenLogicalCount).toBeGreaterThan(0);
    await signIn(page, s);
    await page.goto("/jobs/" + s.jobId);
    const chip = summary(page, s.persistedBookingId).getByTestId("booking-open-conflict-count");
    await expect(chip).toHaveAccessibleName(s.expectedOpenLogicalCount + " öppna konflikter");
    await page.reload();
    await expect(chip).toHaveAccessibleName(s.expectedOpenLogicalCount + " öppna konflikter");
    expect(await bookingSnapshot(s.tenantIds)).toEqual(durable);
  });

  for (const dismissal of ["Escape", "close", "back"] as const) {
    test.skip("[P1] E2E-003/007 dirty " + dismissal + " cancel retains draft and discard restores entry focus", async ({ resourcePage: page, bookingEditor: h }) => {
      const s = await h.seed("conflict-free");
      const before = await bookingSnapshot(s.tenantIds);
      await signIn(page, s);
      await openToolbar(page);
      await editor(page).getByTestId("booking-description").fill(s.description);
      const requestDismissal = async () => {
        if (dismissal === "Escape") await page.keyboard.press("Escape");
        else if (dismissal === "close") await editor(page).getByTestId("booking-close").click();
        else await page.goBack();
      };
      await requestDismissal();
      const guard = page.getByTestId("booking-discard-confirmation");
      await expect(guard).toHaveAttribute("role", "alertdialog");
      await guard.getByTestId("booking-keep-editing").click();
      await expect(editor(page).getByTestId("booking-description")).toHaveValue(s.description);
      await expect(editor(page)).toBeVisible();
      await requestDismissal();
      await guard.getByTestId("booking-discard").click();
      await expect(editor(page)).toBeHidden();
      await expect(page.getByTestId("booking-entry-toolbar").getByRole("button", { name: "Ny bokning" })).toBeFocused();
      expect(await bookingSnapshot(s.tenantIds)).toEqual(before);
      await page.getByTestId("booking-entry-toolbar").getByRole("button", { name: "Ny bokning" }).click();
      await expect(editor(page).getByTestId("booking-description")).toHaveValue("");
    });
  }

  test.skip("[P1] E2E-003 in-flight save blocks Escape close and back until confirmed", async ({ resourcePage: page, bookingEditor: h }) => {
    const s = await h.seed("conflict-free");
    const gate = await h.holdNextSave();
    const observer = await h.observeNextConfirmedSave();
    const before = await bookingSnapshot(s.tenantIds);
    try {
      await signIn(page, s);
      await openToolbar(page);
      await fillDraft(page, s);
      await editor(page).getByTestId("booking-save").click();
      await gate.started;
      await expect(editor(page)).toHaveAttribute("aria-busy", "true");
      await expect(editor(page).getByTestId("booking-close")).toBeDisabled();
      await expect(editor(page).getByTestId("booking-save")).toBeDisabled();
      await page.keyboard.press("Escape");
      await page.goBack();
      await expect(editor(page)).toBeVisible();
      await expect(editor(page).getByTestId("booking-description")).toHaveValue(s.description);
      await expect(page.getByTestId("booking-discard-confirmation")).toHaveCount(0);
      expect(await bookingSnapshot(s.tenantIds)).toEqual(before);
      await gate.release();
      await observer.confirmed;
      await expect(page.getByTestId("booking-save-status")).toHaveText(/sparats/i);
      expectOneCreate(before, await bookingSnapshot(s.tenantIds), s, { jobId: null, customerId: null });
    } finally { await gate.release(); }
  });

  test.skip("[P0] E2E-004/005 phone failure keeps unsent draft and explicit retry confirms one durable save",
    { annotation: [{ type: "skipNetworkMonitoring", description: "Expected transient save failure is the subject of the test" }] },
    async ({ resourcePage: page, bookingEditor: h }) => {
      const s = await h.seed("conflict-free");
      await page.setViewportSize({ width: 360, height: 640 });
      const failure = await h.failNextSaveOnce();
      const before = await bookingSnapshot(s.tenantIds);
      await signIn(page, s);
      await openToolbar(page);
      await fillDraft(page, s);
      await editor(page).getByTestId("booking-save").click();
      await failure.failed;
      await expect(editor(page).getByTestId("booking-save-error")).toHaveAttribute("role", "alert");
      await expect(editor(page).getByTestId("booking-save-error")).toContainText(/försök igen/i);
      await expect(editor(page).getByTestId("booking-unsent")).toBeVisible();
      await expect(page.getByTestId("booking-save-status")).toHaveCount(0);
      await expect(editor(page).getByTestId("booking-description")).toHaveValue(s.description);
      await expect(editor(page).getByTestId("booking-start")).toHaveValue(s.startsLocal);
      await expect(editor(page).getByTestId("booking-end")).toHaveValue(s.endsLocal);
      for (const label of s.assigneeLabels) await expect(editor(page).getByRole("checkbox", { name: label, exact: true })).toBeChecked();
      expect(await bookingSnapshot(s.tenantIds)).toEqual(before);
      const observer = await h.observeNextConfirmedSave();
      await expectTarget(editor(page).getByTestId("booking-retry"), 48);
      await editor(page).getByTestId("booking-retry").click();
      await observer.confirmed;
      await expect(page.getByTestId("booking-save-status")).toHaveText(/sparats/i);
      expectOneCreate(before, await bookingSnapshot(s.tenantIds), s, { jobId: null, customerId: null });
    });

  test.skip("[P0] E2E-005 phone lost committed response replays one booking assignments conflicts and attributable audit",
    { annotation: [{ type: "skipNetworkMonitoring", description: "Lose only the response after real atomic commit" }] },
    async ({ resourcePage: page, bookingEditor: h }) => {
      const s = await h.seed("conflicted");
      await page.setViewportSize({ width: 360, height: 640 });
      const lost = await h.loseNextCommittedSaveResponseOnce();
      const before = await bookingSnapshot(s.tenantIds);
      await signIn(page, s);
      await openToolbar(page);
      await fillDraft(page, s);
      await expect(editor(page).getByTestId("booking-conflict-panel")).toBeVisible();
      await editor(page).getByTestId("booking-review-current-warnings").check();
      await editor(page).getByTestId("booking-select-logical-" + s.selectedLogicalId).check();
      const reason = "Samordnat tillfälligt arbete";
      await editor(page).getByTestId("booking-override-reason").fill(reason);
      await editor(page).getByTestId("booking-save").click();
      await lost.committed; // adapter must await actual SQL outcome before dropping response
      await expect(editor(page).getByTestId("booking-save-error")).toBeVisible();
      await expect(page.getByTestId("booking-save-status")).toHaveCount(0);
      await expect(editor(page).getByTestId("booking-description")).toHaveValue(s.description);
      await expect(editor(page).getByTestId("booking-override-reason")).toHaveValue(reason);
      const committed = await bookingSnapshot(s.tenantIds);
      const row = expectOneCreate(before, committed, s, { jobId: null, customerId: null });
      const conflicts = committed.conflicts.filter((item) => item.booking_id === row.id || item.related_booking_id === row.id);
      expect(conflicts).toHaveLength(s.expectedConflictRowCount);
      expect(conflicts.filter((item) => item.status === "accepted")).toHaveLength(s.expectedAcceptedRowCount);
      expect(conflicts.filter((item) => item.status === "open")).toHaveLength(s.expectedOpenRowCount);
      expect(s.expectedAcceptedRowCount).toBeGreaterThan(0);
      expect(s.expectedOpenRowCount).toBeGreaterThan(0);
      for (const conflict of conflicts.filter((item) => item.status === "accepted")) {
        expect(conflict).toMatchObject({ acceptance_reason: reason, accepted_by_membership_id: s.actorMembershipId });
        expect(conflict.accepted_at).toEqual(expect.any(String));
      }
      const observer = await h.observeNextConfirmedSave();
      await editor(page).getByTestId("booking-retry").click();
      await observer.confirmed;
      await expect(page.getByTestId("booking-save-status")).toHaveText(/sparats/i);
      expect(await bookingSnapshot(s.tenantIds)).toEqual(committed); // exact outcome/audit/no duplicate identity
    });

  test.skip("[P1] AC2/ E2E-007 latest warning wins and preview failure remains visibly unknown",
    { annotation: [{ type: "skipNetworkMonitoring", description: "Expected preview failure is the subject of the test" }] },
    async ({ resourcePage: page, bookingEditor: h }) => {
      const s = await h.seed("conflicted");
      const race = await h.raceNextPreviews(); // arm before navigation/action
      await signIn(page, s);
      await openToolbar(page);
      await fillDraft(page, s);
      await race.olderStarted;
      await editor(page).getByTestId("booking-end").fill("2026-10-12T17:00");
      await race.newerStarted;
      await race.releaseNewerAndWaitForRender();
      const panel = editor(page).getByTestId("booking-conflict-panel");
      await expect(panel).toContainText(s.newerWarning.text);
      for (const detail of [s.newerWarning.rule, s.newerWarning.person, s.newerWarning.window, s.newerWarning.collision]) {
        await expect(panel).toContainText(detail);
      }
      await expect(panel.getByRole("img", { name: s.newerWarning.timelineName })).toBeVisible();
      await race.releaseOlderAndWaitForSettlement();
      await expect(panel).toContainText(s.newerWarning.text);
      await expect(panel.getByText(s.olderWarning.text, { exact: true })).toHaveCount(0);
      await editor(page).getByTestId("booking-review-current-warnings").check();
      const failure = await h.failNextPreviewOnce();
      await editor(page).getByTestId("booking-end").fill("2026-10-12T18:00");
      await failure.failed;
      await expect(editor(page).getByTestId("booking-review-current-warnings")).not.toBeChecked();
      await expect(editor(page).getByTestId("booking-preview-error")).toHaveAttribute("role", "alert");
      await expect(editor(page).getByTestId("booking-preview-unknown")).toBeVisible();
      await expect(editor(page).getByTestId("booking-conflict-free")).toHaveCount(0);
      await expect(editor(page).getByTestId("booking-end")).toHaveValue("2026-10-12T18:00");
    });

  test.skip("[P1] E2E-007 keyboard focus remains in sheet and warnings announce explanatory timeline", async ({ resourcePage: page, bookingEditor: h }) => {
    const s = await h.seed("conflicted");
    await signIn(page, s);
    await openToolbar(page);
    expect(await editor(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await fillDraft(page, s);
    const warnings = editor(page).getByTestId("booking-conflict-panel");
    await expect(warnings).toHaveAttribute("aria-live", "polite");
    await expect(warnings).toContainText(s.olderWarning.text);
    await expect(warnings.getByRole("img", { name: s.olderWarning.timelineName })).toBeVisible();
    await editor(page).getByTestId("booking-close").focus();
    await page.keyboard.press("Shift+Tab");
    expect(await editor(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Tab");
    expect(await editor(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    const guard = page.getByTestId("booking-discard-confirmation");
    expect(await guard.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await guard.getByTestId("booking-keep-editing").press("Enter");
    expect(await editor(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
  });
});
