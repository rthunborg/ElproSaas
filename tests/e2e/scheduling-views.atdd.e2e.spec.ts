/** Story 15.1 RED acceptance scaffolds. Skips confer no coverage. */
import { test, expect, type Host, type View, type Interval, type SchedulingViewsHarness } from "./support/scheduling-views-atdd";
import type { Locator, Page } from "@playwright/test";

async function center(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  if (!box) throw new Error("Actual host target has no pointer bounds");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function drag(page: Page, from: Locator, to: Locator) {
  const a = await center(from), b = await center(to);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up();
}
async function expectEditor(h: SchedulingViewsHarness, i: Interval) {
  await expect(h.editor).toBeVisible();
  await expect(h.editor.getByTestId("booking-start")).toHaveValue(i.startsLocal);
  await expect(h.editor.getByTestId("booking-end")).toHaveValue(i.endsLocal);
  // All options are checked against the exact set, so extra assignees fail too.
  const checked = await h.editor.getByRole("checkbox").evaluateAll(nodes => nodes
    .filter(node => (node as HTMLInputElement).checked)
    .map(node => node.getAttribute("data-testid"))
    .filter((id): id is string => !!id && id.startsWith("booking-assignee-option-"))
    .map(id => id.slice("booking-assignee-option-".length)).sort());
  expect(checked).toEqual([...i.assigneeIds].sort());
}
async function saveAndProve(h: SchedulingViewsHarness, i: Interval) {
  const before = await h.sqlBookings();
  await h.fillRequiredEditorFields();
  const save = await h.observeConfirmedSave();
  await h.editor.getByTestId("booking-save").click(); await save.confirmed;
  await expect(h.savedStatus()).toContainText(/sparad|sparats/i);
  const added = (await h.sqlBookings()).filter(row => !before.some(old => old.id === row.id));
  expect(added).toHaveLength(1);
  expect(added[0]).toMatchObject({ startsAt: i.startsAt, endsAt: i.endsAt, assigneeIds: [...i.assigneeIds].sort() });
  await h.reloadAndOpenBooking(added[0]!.id); await expectEditor(h, i);
}

for (const [host, kind, id] of [
  ["Schema", "click", "001"], ["Schema", "drag", "002"],
  ["Resurser", "click", "003"], ["Resurser", "drag", "004"],
] as const) {
  test.skip(`[P0] 15.1-E2E-${id} AC4 actual ${host} ${kind} persists selected person/start/end`, async ({ resourcePage: page, schedulingViews: h }) => {
    await h.seed(); await h.open(host, "week");
    const i = h.interval(host, kind);
    const person = host === "Resurser" ? h.rowPersonId() : i.assigneeIds[0];
    const start = h.emptySlot(host, i.startsLocal, person);
    if (kind === "click") {
      const point = await center(start); await page.mouse.click(point.x, point.y);
    } else {
      // Adapter binds the final included 30-minute slot, not an arbitrary pixel.
      await drag(page, start, h.emptySlot(host, h.dragEndSlotLocal(host), person));
    }
    await expectEditor(h, i); await saveAndProve(h, i);
  });
}
for (const host of ["Schema", "Resurser"] as const) {
  test.skip(`[P0] 15.1-E2E-005 AC5 ${host} keyboard and interval dialog cancel without writes and return focus`, async ({ schedulingViews: h }) => {
    await h.seed(); await h.open(host);
    const before = await h.sqlBookings(), i = h.interval(host, "click");
    const slot = h.emptySlot(host, i.startsLocal, host === "Resurser" ? h.rowPersonId() : i.assigneeIds[0]);
    await slot.focus(); await slot.press("Enter"); await expectEditor(h, i);
    await h.cancelEditor(); await expect(slot).toBeFocused();
    expect(await h.sqlBookings()).toEqual(before);
    const trigger = await h.openIntervalDialog(host), dialog = h.intervalDialog(host);
    await expect(dialog).toBeVisible(); await h.fillIntervalDialog(dialog, i);
    await h.confirmIntervalDialog(dialog).click(); await expectEditor(h, i);
    await h.cancelEditor(); await expect(trigger).toBeFocused();
    expect(await h.sqlBookings()).toEqual(before);
  });
}
test.skip("[P1] 15.1-E2E-006 AC1 five projections, periods, filters and toolbar editor agree", async ({ schedulingViews: h }) => {
  await h.seed();
  const periods: [View, ("day" | "week" | "month")[]][] = [
    ["Schema", ["day", "week", "month"]], ["Resurser", ["day", "week"]],
    ["Team", ["week"]], ["Beläggning", ["day", "week", "month"]], ["Min kalender", ["day", "week"]],
  ];
  for (const [view, ranges] of periods) for (const period of ranges) {
    await h.open(view, period); await h.applySharedFilters();
    expect([...new Set(await h.visibleIds(view))].sort()).toEqual([...h.expectedIds(view)].sort());
    if (view === "Beläggning") await expect(h.capacityNumbers()).toBeVisible();
    if (view === "Min kalender") {
      if (period === "week") await expect(h.personalWeekGrid()).toBeVisible();
      else await expect(h.agenda()).toBeVisible();
    }
    const before = await h.sqlBookings(), trigger = h.toolbarCreate();
    await trigger.click(); await expect(h.editor).toBeVisible();
    await h.cancelEditor(); await expect(trigger).toBeFocused(); expect(await h.sqlBookings()).toEqual(before);
  }
});
test.skip("[P1] 15.1-E2E-007 AC5 move/resize pointer and alternatives preserve detector review and cancellation", async ({ resourcePage: page, schedulingViews: h }) => {
  await h.seed();
  for (const host of ["Schema", "Resurser"] as Host[]) for (const operation of ["move", "resize"] as const) {
    for (const mode of ["pointer", "keyboard", "dialog"] as const) {
      await h.resetProposalFixture(); await h.open(host); const before = await h.sqlBookings(), i = h.proposal(host, operation);
      let trigger: Locator;
      if (mode === "pointer") {
        trigger = h.gestureSource(host, operation); await drag(page, trigger, h.gestureTarget(host, operation));
      } else trigger = await h.proposeByAlternative(host, operation, mode);
      await expectEditor(h, i); await expect(h.reviewRequired()).toBeVisible();
      await expect(h.editor.getByTestId("booking-save")).toBeDisabled();
      expect(before.some(row => row.id === h.conflictedBookingId())).toBe(true);
      await h.cancelEditor(); await expect(trigger).toBeFocused(); expect(await h.sqlBookings()).toEqual(before);
      // Repeat the same actual host proposal and accept through the current review UI.
      if (mode === "pointer") await drag(page, h.gestureSource(host, operation), h.gestureTarget(host, operation));
      else await h.proposeByAlternative(host, operation, mode);
      await expectEditor(h, i); await h.reviewAndAcceptCurrentProposal();
      const confirmation = await h.observeConfirmedSave();
      await h.editor.getByTestId("booking-save").click(); await confirmation.confirmed;
      const after = await h.sqlBookings(), id = h.conflictedBookingId();
      expect(after).toHaveLength(before.length);
      expect(after.filter(row => row.id !== id)).toEqual(before.filter(row => row.id !== id));
      const changed = after.find(row => row.id === id);
      expect(changed).toMatchObject({ startsAt: i.startsAt, endsAt: i.endsAt });
      expect([...(changed?.assigneeIds ?? [])].sort()).toEqual([...i.assigneeIds].sort());
      expect(new Set(changed?.assigneeIds).size).toBe(changed?.assigneeIds.length);
      for (const retained of h.originalOtherAssigneeIds(host)) expect(changed?.assigneeIds).toContain(retained);
      await h.reloadAndOpenBooking(id); await expectEditor(h, i); await h.cancelEditor();
    }
  }
});
test.skip("[P1] 15.1-E2E-008 AC6 arbetsroll lanes, multi-assignee rows and reassignment are faithful", async ({ schedulingViews: h }) => {
  await h.seed(); await h.open("Team");
  for (const role of [h.fixtureRoleLabel(), "Ingen arbetsroll"]) {
    const lane = h.roleLane(role); await expect(lane).toBeVisible();
    expect((await h.laneIds(lane)).sort()).toEqual([...h.expectedLaneIds(role)].sort());
  }
  await h.open("Resurser");
  const row = h.resourceRow(h.rowPersonId()); await expect(row).toBeVisible();
  expect((await h.laneIds(row)).sort()).toEqual([...h.expectedResourceIds(h.rowPersonId())].sort());
  const reassignment = h.reassignmentLane(); await expect(reassignment).toBeVisible();
  expect((await h.laneIds(reassignment)).sort()).toEqual([...h.expectedReassignmentIds()].sort());
});
test.skip("[P1] AC8 360x640 connected agenda/summary and failed save retry retain unsent input", async ({ resourcePage: page, schedulingViews: h }) => {
  await h.seed(); await page.setViewportSize({ width: 360, height: 640 });
  await h.open("Schema"); await h.applySharedFilters(); await expect(h.agenda()).toBeVisible();
  await h.open("Beläggning"); await expect(h.phoneCapacitySummary()).toBeVisible();
  const before = await h.sqlBookings(), trigger = h.toolbarCreate(); await trigger.click();
  await h.fillRequiredEditorFields(); const draft = "15.1 phone unsent input";
  await h.editor.getByTestId("booking-description").fill(draft);
  const fail = await h.failNextSaveOnce(); await h.editor.getByTestId("booking-save").click(); await fail.failed;
  await expect(h.editor.getByTestId("booking-description")).toHaveValue(draft);
  await expect(h.retrySave()).toBeVisible(); await expect(h.savedStatus()).not.toContainText(/sparad|sparats/i);
  expect(await h.sqlBookings()).toEqual(before);
  const save = await h.observeConfirmedSave(); await h.retrySave().click(); await save.confirmed;
  await expect(h.savedStatus()).toContainText(/sparad|sparats/i);
  expect((await h.sqlBookings()).length).toBe(before.length + 1);
});



test.skip("[P1] AC3 rendered toolbar preferences are isolated by user/tenant/view and reset safely", async ({ resourcePage: page, schedulingViews: h }) => {
  await h.seed(); await h.open("Schema"); await h.setToolbarPreference();
  expect(await h.toolbarState()).toEqual(h.expectedChangedToolbar());
  await page.reload(); expect(await h.toolbarState()).toEqual(h.expectedChangedToolbar());
  await h.open("Resurser"); expect(await h.toolbarState()).toEqual(h.expectedDefaultToolbar());
  await h.open("Schema"); expect(await h.toolbarState()).toEqual(h.expectedChangedToolbar());
  for (const identity of ["other-user", "other-tenant"] as const) {
    await h.switchFixtureIdentity(identity); await h.open("Schema");
    expect(await h.toolbarState()).toEqual(h.expectedDefaultToolbar());
    await h.switchFixtureIdentity("original"); await h.open("Schema");
    expect(await h.toolbarState()).toEqual(h.expectedChangedToolbar());
  }
  await h.corruptScopedPreferences(); await page.reload();
  expect(await h.toolbarState()).toEqual(h.expectedDefaultToolbar()); await expect(h.resetNotice()).toBeVisible();
  await h.setToolbarPreference(); await h.resetToolbar().click();
  expect(await h.toolbarState()).toEqual(h.expectedDefaultToolbar());
  await h.denyStorage(); await page.reload();
  expect(await h.toolbarState()).toEqual(h.expectedDefaultToolbar());
  expect([...new Set(await h.visibleIds("Schema"))].sort()).toEqual([...h.expectedIds("Schema")].sort());
});
test.skip("[P1] AC3 failed final-page read hides partial/stale data and false empty/count until retry", async ({ schedulingViews: h }) => {
  await h.seed(); await h.open("Schema"); await h.setToolbarPreference();
  const toolbar = await h.toolbarState(), failed = await h.failNextFinalReadPage();
  await h.open("Schema"); await failed.failed;
  await expect(h.readFailure()).toBeVisible(); await expect(h.readRetry()).toBeVisible();
  await expect(h.emptyState()).not.toBeVisible(); await expect(h.partialBookingList()).not.toBeVisible();
  await expect(h.conflictCount()).not.toBeVisible(); expect(await h.toolbarState()).toEqual(toolbar);
  await h.readRetry().click(); await expect(h.readFailure()).not.toBeVisible();
  expect([...new Set(await h.visibleIds("Schema"))].sort()).toEqual([...h.expectedIds("Schema")].sort());
  expect(await h.toolbarState()).toEqual(toolbar);
});
test.skip("[P1] AC7 capacity numbers and color explain zero budget and full-demand overbooking drilldown", async ({ schedulingViews: h }) => {
  await h.seed(); await h.open("Beläggning"); await h.applySharedFilters();
  for (const kind of ["zero-empty", "zero-positive", "overbooked"] as const) {
    const expected = h.capacityCase(kind), cell = h.capacityCell(expected.personId, expected.localDay);
    await expect(cell).toBeVisible();
    expect(await h.capacityCellNumbers(cell)).toEqual({ demand: expected.demand, budget: expected.budget, balance: expected.balance, occupancy: expected.occupancy });
    expect(await h.capacityColorMeaning(cell)).toBe(expected.colorMeaning);
    await expect(cell).not.toContainText(/Infinity|NaN/);
    if (kind !== "overbooked") await expect(cell).toContainText(/ingen kapacitet|noll kapacitet|0 min/i);
    if (kind !== "zero-empty") {
      expect(expected.demand).toBeGreaterThan(expected.budget);
      await h.drillCapacity(cell); expect(await h.activeRestrictiveFilters()).toEqual([]);
      expect([...new Set(await h.visibleIds("Schema"))].sort()).toEqual([...expected.fullDemandIds].sort());
      await h.open("Beläggning"); await h.applySharedFilters();
    }
  }
});
test.skip("[P1] COMP-003 AC8 month density drilldown and long multi-assignee labels remain usable at 360x640", async ({ resourcePage: page, schedulingViews: h }) => {
  await h.seed(); await h.open("Schema", "month"); await h.monthDensityDay().click();
  expect((await h.monthDayBookings()).sort()).toEqual([...h.expectedMonthDayIds()].sort());
  await page.setViewportSize({ width: 360, height: 640 }); await h.open("Schema");
  const booking = h.longMultiAssigneeBooking(); await expect(booking).toBeVisible();
  await expect(booking).toContainText(h.expectedLongLabel());
  for (const label of h.expectedMultiAssigneeLabels()) await expect(booking).toContainText(label);
  for (const control of h.phoneControls()) {
    await control.scrollIntoViewIfNeeded(); await expect(control).toBeVisible();
    const box = await control.boundingBox(); expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(360);
    await control.focus(); await expect(control).toBeFocused();
  }
});


