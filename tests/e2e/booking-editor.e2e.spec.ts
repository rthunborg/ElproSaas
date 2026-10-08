/**
 * Story 14.4 retained browser acceptance against actual Next actions and SQL readback.
 * No calendar/nav/recurrence host is scaffolded. Empty-slot click/drag belongs
 * to 15.1 actual Schema/Resurser before their entry exposure and completion.
 * Library gate exception: playwright-utils=true but package is absent; use
 * established resourcePage fixture with typed production transport binding.
 */
import { test, expect, type Scenario } from "./support/booking-editor-atdd";
import type { Locator, Page } from "@playwright/test";
import { bookingSnapshot, type BookingSnapshot, type DurableRow } from "../support/bookings-atdd";
import { adminQuery } from "../factories/admin-sql";

async function signIn(page: Page, scenario: Scenario): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-post").fill(scenario.credentials.email);
  await page.getByLabel("Lösenord").fill(scenario.credentials.password);
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
const editor = (page: Page) => page.getByRole("dialog");
const summary = (page: Page, id: string) => page.getByTestId("booking-summary-" + id);
async function openToolbar(page: Page): Promise<void> {
  await page.goto("/jobs");
  await page.getByTestId("booking-entry-toolbar").click();
  await expect(editor(page)).toHaveAttribute("role", "dialog");
  await expect(editor(page)).toHaveAttribute("aria-modal", "true");
  await expect(editor(page).getByTestId("booking-work-role-filter")).toBeFocused();
}
async function fillDraft(page: Page, scenario: Scenario, waitForPreview = true): Promise<void> {
  const sheet = editor(page);
  await sheet.getByTestId("booking-description").fill(scenario.description);
  await sheet.getByTestId("booking-start").fill(scenario.startsLocal);
  await sheet.getByTestId("booking-end").fill(scenario.endsLocal);
  await sheet.getByTestId("booking-work-role").selectOption(scenario.workRoleId);
  await sheet.getByTestId("booking-status").selectOption("planned");
  for (let i=0;i<scenario.assigneeIds.length;i++) {const input=sheet.getByTestId("booking-assignee-option-"+scenario.assigneeIds[i]);
    await expect(input.locator("..")).toContainText(scenario.assigneeLabels[i]!); await input.check();}
  if (waitForPreview) await expect(sheet.getByTestId("booking-availability")).toBeVisible();
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
  await expect(page.getByTestId("booking-save-status")).toHaveText(/sparad|sparats/i);
  await expect(page.getByTestId("booking-save-status")).toHaveAttribute("role", "status");
  expect(await page.evaluate(()=>!!document.activeElement?.closest('[role="dialog"]') && !document.activeElement.matches(":disabled"))).toBe(true);
}

test.describe("Story 14.4 booking editor retained browser acceptance", () => {
  test("Round2 archived role clears explicitly and failed options retry retains the mounted draft",{annotation:[{type:"skipNetworkMonitoring",description:"Actual options-read transport failure"}]},async({resourcePage:page,bookingEditor:h})=>{
    const s=await h.seed("conflict-free"), before=await bookingSnapshot(s.tenantIds);
    await signIn(page,s); await openToolbar(page); await fillDraft(page,s);
    const create=await h.observeNextConfirmedSave(); await saveConfirmed(page,create.confirmed);
    const row=expectOneCreate(before,await bookingSnapshot(s.tenantIds),s,{jobId:null,customerId:null});
    await editor(page).getByTestId("booking-close").click();
    await adminQuery("update public.work_roles set is_active=false where id=$1 and tenant_id=$2",[s.workRoleId,s.tenantId]);
    await page.reload(); await summary(page,row.id).getByTestId("booking-edit").click();
    const role=editor(page).getByTestId("booking-work-role"); await expect(role).toHaveValue(s.workRoleId);
    await expect(role.locator("option:checked")).toContainText("Nuvarande arbetsroll");await expect(role.locator("option:checked")).toHaveAttribute("disabled","");
    await role.selectOption(""); await editor(page).getByTestId("booking-description").fill(s.description+" refreshed draft");
    const failure=await h.failNextOptionsReadOnce(); await editor(page).getByTestId("booking-options-retry").click(); await failure.failed;
    await expect(editor(page).getByTestId("booking-options-error")).toBeVisible();await expect(editor(page).getByTestId("booking-save")).toBeDisabled();
    await expect(editor(page).getByTestId("booking-description")).toHaveValue(s.description+" refreshed draft");
    await adminQuery("update public.work_roles set is_active=true where id=$1 and tenant_id=$2",[s.workRoleId,s.tenantId]);
    await editor(page).getByTestId("booking-options-retry").click(); await expect(editor(page).getByTestId("booking-options-error")).toHaveCount(0);
    await expect(role.locator(`option[value="${s.workRoleId}"]`)).toContainText(s.description);await expect(role).toHaveValue("");
    const save=await h.observeNextConfirmedSave();await saveConfirmed(page,save.confirmed);
    expect((await bookingSnapshot(s.tenantIds)).bookings.find(r=>r.id===row.id)).toMatchObject({work_role_id:null,description:s.description+" refreshed draft"});
  });
  test("Round2 facility-only contact choice and same-customer facility change retain compatible links",async({resourcePage:page,bookingEditor:h})=>{
    const s=await h.seed("conflict-free"), extra=crypto.randomUUID();
    try {
      await adminQuery("insert into public.facilities(id,tenant_id,customer_id,name) values($1,$2,$3,$4)",[extra,s.tenantId,s.customerId,s.description+" second facility"]);
      await adminQuery("update public.contacts set facility_id=null where id=$1 and tenant_id=$2",[s.contactId,s.tenantId]);
      const before=await bookingSnapshot(s.tenantIds); await signIn(page,s); await openToolbar(page); await fillDraft(page,s);
      await editor(page).getByTestId("booking-facility").selectOption(s.facilityId); const create=await h.observeNextConfirmedSave();await saveConfirmed(page,create.confirmed);
      const row=expectOneCreate(before,await bookingSnapshot(s.tenantIds),s,{jobId:null,customerId:s.customerId});await editor(page).getByTestId("booking-close").click();
      await adminQuery("update public.bookings set customer_id=null where id=$1 and tenant_id=$2",[row.id,s.tenantId]);
      await page.reload();await summary(page,row.id).getByTestId("booking-edit").click();await expect(editor(page).getByTestId("booking-customer")).toHaveValue("");
      await editor(page).getByTestId("booking-contact").selectOption(s.contactId);await expect(editor(page).getByTestId("booking-facility")).toHaveValue(s.facilityId);
      await editor(page).getByTestId("booking-facility").selectOption(extra);await expect(editor(page).getByTestId("booking-contact")).toHaveValue(s.contactId);
      const save=await h.observeNextConfirmedSave();await saveConfirmed(page,save.confirmed);
      expect((await bookingSnapshot(s.tenantIds)).bookings.find(r=>r.id===row.id)).toMatchObject({facility_id:extra,customer_id:s.customerId,contact_id:s.contactId,job_id:null});
    } finally {await adminQuery("update public.bookings set facility_id=null where tenant_id=$1 and facility_id=$2",[s.tenantId,extra]);await adminQuery("delete from public.facilities where id=$1 and tenant_id=$2",[extra,s.tenantId]);}
  });
  test("Round2 authorization-denied retry preserves a lost committed attempt until authority returns",{annotation:[{type:"skipNetworkMonitoring",description:"Lost response followed by real current authorization denial"}]},async({resourcePage:page,bookingEditor:h})=>{
    const s=await h.seed("conflict-free"), loss=await h.loseNextCommittedSaveResponseOnce(), before=await bookingSnapshot(s.tenantIds);
    try {
      await signIn(page,s);await openToolbar(page);await fillDraft(page,s);await editor(page).getByTestId("booking-save").click();await loss.committed;
      await expect(editor(page).getByTestId("booking-unresolved-save")).toBeVisible();const committed=await bookingSnapshot(s.tenantIds);expectOneCreate(before,committed,s,{jobId:null,customerId:null});
      await adminQuery("update public.tenant_memberships set status='disabled' where id=$1 and tenant_id=$2",[s.actorMembershipId,s.tenantId]);
      const denied=await h.observeNextSaveTransport();await editor(page).getByTestId("booking-retry").click();await denied.observed;
      await expect(editor(page).getByTestId("booking-save-error")).toBeVisible();await expect(editor(page).getByTestId("booking-unresolved-save")).toBeVisible();
      await expect(editor(page).getByTestId("booking-description")).toBeDisabled();await expect(editor(page).getByTestId("booking-close")).toBeDisabled();await expect(page.getByTestId("booking-save-status")).toHaveCount(0);
      expect(await bookingSnapshot(s.tenantIds)).toEqual(committed);
      await adminQuery("update public.tenant_memberships set status='active' where id=$1 and tenant_id=$2",[s.actorMembershipId,s.tenantId]);
      const confirm=await h.observeNextConfirmedSave();await editor(page).getByTestId("booking-retry").click();await confirm.confirmed;
      await expect(page.getByTestId("booking-save-status")).toHaveText(/sparad/i);expect(await bookingSnapshot(s.tenantIds)).toEqual(committed);
    } finally {await adminQuery("update public.tenant_memberships set status='active' where id=$1 and tenant_id=$2",[s.actorMembershipId,s.tenantId]);}
  });
  test("Round2 genuine 1000-group issued review exceeds 1 MiB and saves through actual bounded HTTP action", async ({resourcePage:page,bookingEditor:h},testInfo)=>{
    testInfo.setTimeout(180000);
    const s=await h.seed("large-review"); await signIn(page,s); await openToolbar(page); await fillDraft(page,s);
    const articles=editor(page).getByTestId("booking-conflict-panel").locator("article"); await expect(articles).toHaveCount(1000);
    await articles.getByRole("checkbox").evaluateAll(inputs=>inputs.slice(0,1).forEach(input=>(input as HTMLInputElement).click()));
    await editor(page).getByTestId("booking-review-current-warnings").check();
    await editor(page).getByTestId("booking-override-reason").fill("Reviewed all genuine groups; selected one complete collision");
    const before=await bookingSnapshot(s.tenantIds), transport=await h.observeNextSaveTransport(90000);
    await editor(page).getByTestId("booking-save").click(); const measured=await transport.observed;
    expect(measured.bodyBytes).toBeGreaterThan(1024*1024); expect(measured.bodyBytes).toBeLessThan(3*1024*1024); expect(measured.status).toBe(200);
    await expect(page.getByTestId("booking-save-status")).toHaveText(/sparad/i);
    const after=await bookingSnapshot(s.tenantIds), row=expectOneCreate(before,after,s,{jobId:null,customerId:null});
    const conflicts=after.conflicts.filter(c=>c.booking_id===row.id||c.related_booking_id===row.id);
    expect(conflicts).toHaveLength(1000); expect(conflicts.filter(c=>c.status==="accepted")).toHaveLength(1); expect(conflicts.filter(c=>c.status==="open")).toHaveLength(999);
    await testInfo.attach("actual-save-transport-measurement",{body:JSON.stringify({...measured,groups:1000,selected:1}),contentType:"application/json"});
  });
  test("Round1 endpoint-only mounted edits preserve the other PostgreSQL instant exactly", async ({resourcePage:page,bookingEditor:h})=>{
    const s=await h.seed("conflict-free"); const before=await bookingSnapshot(s.tenantIds);
    await signIn(page,s); await openToolbar(page); await fillDraft(page,s);
    const create=await h.observeNextConfirmedSave(); await saveConfirmed(page,create.confirmed);
    const row=expectOneCreate(before,await bookingSnapshot(s.tenantIds),s,{jobId:null,customerId:null});
    await editor(page).getByTestId("booking-close").click();
    await adminQuery("update public.bookings set starts_at='2026-10-12T07:00:00.123456Z',ends_at='2026-10-12T08:00:00.654321Z' where id=$1 and tenant_id=$2",[row.id,s.tenantId]);
    await page.reload(); await summary(page,row.id).getByTestId("booking-edit").click();
    await editor(page).getByTestId("booking-end").fill("2026-10-12T10:30");
    const end=await h.observeNextConfirmedSave(); await saveConfirmed(page,end.confirmed);
    expect((await bookingSnapshot(s.tenantIds)).bookings.find(r=>r.id===row.id)).toMatchObject({starts_at:"2026-10-12T07:00:00.123456+00:00",ends_at:"2026-10-12T08:30:00+00:00"});
    await editor(page).getByTestId("booking-close").click();
    await adminQuery("update public.bookings set ends_at='2026-10-12T08:30:00.654321Z' where id=$1 and tenant_id=$2",[row.id,s.tenantId]);
    await page.reload(); await summary(page,row.id).getByTestId("booking-edit").click();
    await editor(page).getByTestId("booking-start").fill("2026-10-12T09:15");
    const start=await h.observeNextConfirmedSave(); await saveConfirmed(page,start.confirmed);
    expect((await bookingSnapshot(s.tenantIds)).bookings.find(r=>r.id===row.id)).toMatchObject({starts_at:"2026-10-12T07:15:00+00:00",ends_at:"2026-10-12T08:30:00.654321+00:00"});
  });
  test("Round1 compatible customer contact retains facility; archived current links remain visible and deliberately clearable", async ({resourcePage:page,bookingEditor:h})=>{
    const s=await h.seed("conflict-free"), duplicate=crypto.randomUUID();
    try {
      await adminQuery("update public.contacts set facility_id=null where id=$1 and tenant_id=$2",[s.contactId,s.tenantId]);
      await adminQuery("update public.jobs set title=null,facility_id=$3,contact_id=$4 where id=$1 and tenant_id=$2",[s.jobId,s.tenantId,s.facilityId,s.contactId]);
      await adminQuery("insert into public.jobs(id,tenant_id,customer_id,title) values($1,$2,$3,null)",[duplicate,s.tenantId,s.customerId]);
      const before=await bookingSnapshot(s.tenantIds);
      await signIn(page,s); await openToolbar(page); await fillDraft(page,s);
      const jobOptions=editor(page).getByTestId("booking-job");
      const first=await jobOptions.locator(`option[value="${s.jobId}"]`).textContent(), second=await jobOptions.locator(`option[value="${duplicate}"]`).textContent();
      expect(first).toContain(s.description); expect(first).toContain(s.jobId); expect(second).toContain(duplicate); expect(first).not.toBe(second);
      await editor(page).getByTestId("booking-customer").selectOption(s.customerId);
      await editor(page).getByTestId("booking-facility").selectOption(s.facilityId);
      await editor(page).getByTestId("booking-contact").selectOption(s.contactId);
      await expect(editor(page).getByTestId("booking-facility")).toHaveValue(s.facilityId);
      await jobOptions.selectOption(s.jobId);
      const save=await h.observeNextConfirmedSave(); await saveConfirmed(page,save.confirmed);
      const row=expectOneCreate(before,await bookingSnapshot(s.tenantIds),s,{jobId:s.jobId,customerId:s.customerId});
      expect(row).toMatchObject({facility_id:s.facilityId,contact_id:s.contactId});
      await editor(page).getByTestId("booking-close").click();
      for(const [table,id] of [["jobs",s.jobId],["customers",s.customerId],["facilities",s.facilityId],["contacts",s.contactId]])
        await adminQuery(`update public.${table} set archived_at=statement_timestamp() where id=$1 and tenant_id=$2`,[id,s.tenantId]);
      await page.reload(); await summary(page,row.id).getByTestId("booking-edit").click();
      for(const [field,id] of [["job",s.jobId],["customer",s.customerId],["facility",s.facilityId],["contact",s.contactId]]) {
        const select=editor(page).getByTestId(`booking-${field}`); await expect(select).toHaveValue(id);
        await expect(select.locator("option:checked")).toContainText("Nuvarande koppling"); await expect(select.locator("option:checked")).toHaveAttribute("disabled", "");
      }
      await editor(page).getByTestId("booking-customer").selectOption("");
      const clear=await h.observeNextConfirmedSave(); await saveConfirmed(page,clear.confirmed);
      expect((await bookingSnapshot(s.tenantIds)).bookings.find(r=>r.id===row.id)).toMatchObject({job_id:null,customer_id:null,facility_id:null,contact_id:null});
      await editor(page).getByTestId("booking-close").click(); await summary(page,row.id).getByTestId("booking-edit").click();
      await expect(editor(page).getByTestId("booking-customer")).toHaveValue("");
    } finally {await adminQuery("delete from public.jobs where id=$1 and tenant_id=$2",[duplicate,s.tenantId]);}
  });
  test("[P0] E2E-006 toolbar creates a standalone booking through the desktop sheet", async ({ resourcePage: page, bookingEditor: h }) => {
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
    await editor(page).getByTestId("booking-close").click();
    await summary(page,row.id).getByTestId("booking-edit").click();
    await expect(editor(page).getByTestId("booking-description")).toHaveValue(s.description);
    await expect(editor(page).getByTestId("booking-job")).toHaveValue("");
    await expect(editor(page).getByTestId("booking-customer")).toHaveValue("");
  });

  for (const host of ["job", "customer"] as const) {
    test("[P0] E2E-006 " + host + " entry persists preconnection then reopens and edits", async ({ resourcePage: page, bookingEditor: h }) => {
      const s = await h.seed("conflict-free");
      const before = await bookingSnapshot(s.tenantIds);
      const createObserver = await h.observeNextConfirmedSave();
      await signIn(page, s);
      await page.goto(host === "job" ? "/jobs/" + s.jobId : "/customers/" + s.customerId);
      await page.getByTestId("booking-entry-" + host).click();
      await expect(editor(page).getByTestId(host === "job" ? "booking-job" : "booking-customer"))
        .toHaveValue(host === "job" ? s.jobId : s.customerId);
      await fillDraft(page, s);
      // Bind compatible connection options, then deliberately clear optional links.
      await editor(page).getByTestId("booking-customer").selectOption(s.customerId);
      await editor(page).getByTestId("booking-facility").selectOption(s.facilityId);
      await editor(page).getByTestId("booking-contact").selectOption(s.contactId);
      await editor(page).getByTestId("booking-contact").selectOption("");
      await editor(page).getByTestId("booking-facility").selectOption("");
      if (host === "job") await editor(page).getByTestId("booking-job").selectOption(s.jobId);
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
      const clear=await h.observeNextConfirmedSave();
      await editor(page).getByTestId("booking-customer").selectOption("");
      await saveConfirmed(page,clear.confirmed);
      await editor(page).getByTestId("booking-close").click();
      await page.goto("/jobs");
      await summary(page,row.id).getByTestId("booking-edit").click();
      await expect(editor(page).getByTestId("booking-job")).toHaveValue("");
      await expect(editor(page).getByTestId("booking-customer")).toHaveValue("");
      expect((await bookingSnapshot(s.tenantIds)).bookings.find(item=>item.id===row.id)).toMatchObject({job_id:null,customer_id:null});
    });
  }

  test("[P1] E2E-001/007 360x640 fullscreen editor scrolls without overflow and keeps actions reachable", async ({ resourcePage: page, bookingEditor: h }) => {
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
    const scroll = editor(page).locator(".overflow-y-auto");
    expect(await scroll.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    expect(await editor(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const target of ["booking-start", "booking-end", "booking-status", "booking-work-role", "booking-close"]) {
      await expectTarget(editor(page).getByTestId(target));
    }
    for (const id of s.assigneeIds) {
      await expectTarget(editor(page).getByTestId("booking-assignee-option-" + id).locator(".."));
    }
    await expectTarget(editor(page).getByTestId("booking-save"), 48);
    const saveBounds = await editor(page).getByTestId("booking-save").boundingBox();
    expect(saveBounds!.y).toBeGreaterThanOrEqual(0);
    expect(saveBounds!.y + saveBounds!.height).toBeLessThanOrEqual(640);
  });

  test("[P1] E2E-002 reload chip counts persisted OPEN logical conflicts only", async ({ resourcePage: page, bookingEditor: h }) => {
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
    test("[P1] E2E-003/007 dirty " + dismissal + " cancel retains draft and discard restores entry focus", async ({ resourcePage: page, bookingEditor: h }) => {
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
      await expect(page.getByTestId("booking-entry-toolbar")).toBeFocused();
      expect(await bookingSnapshot(s.tenantIds)).toEqual(before);
      await page.getByTestId("booking-entry-toolbar").click();
      await expect(editor(page).getByTestId("booking-description")).toHaveValue("");
    });
  }

  test("[P1] E2E-003 in-flight save blocks Escape close and back until confirmed", async ({ resourcePage: page, bookingEditor: h }) => {
    const s = await h.seed("conflict-free");
    const gate = await h.holdNextSave();
    const observer = await h.observeNextConfirmedSave();
    const before = await bookingSnapshot(s.tenantIds);
    try {
      await signIn(page, s);
      await openToolbar(page);
      await fillDraft(page, s);
      await editor(page).getByTestId("booking-close").click();
      await expect(page.getByTestId("booking-discard-confirmation")).toBeVisible();
      await expect(editor(page).getByTestId("booking-save")).toBeDisabled();
      await editor(page).getByTestId("booking-editor").evaluate(form=>(form as HTMLFormElement).requestSubmit());
      expect(await bookingSnapshot(s.tenantIds)).toEqual(before);
      await expect(editor(page).getByTestId("booking-editor")).toHaveAttribute("aria-busy","false");
      await editor(page).getByTestId("booking-keep-editing").click();
      await editor(page).getByTestId("booking-save").click();
      await gate.started;
      await expect(editor(page).getByTestId("booking-editor")).toHaveAttribute("aria-busy", "true");
      await expect(editor(page).getByTestId("booking-close")).toBeDisabled();
      await expect(editor(page).getByTestId("booking-save")).toBeDisabled();
      await page.keyboard.press("Escape");
      for(const key of ["Tab","Shift+Tab","Tab","Shift+Tab"]) {await page.keyboard.press(key);
        expect(await page.evaluate(()=>!!document.activeElement?.closest('[role="dialog"]')&&!document.activeElement.matches(":disabled"))).toBe(true);}
      await page.goBack();
      await expect(editor(page)).toBeVisible();
      await expect(editor(page).getByTestId("booking-description")).toHaveValue(s.description);
      await expect(page.getByTestId("booking-discard-confirmation")).toHaveCount(0);
      expect(await bookingSnapshot(s.tenantIds)).toEqual(before);
      await gate.release();
      await observer.confirmed;
      await expect(page.getByTestId("booking-save-status")).toHaveText(/sparad|sparats/i);
      expectOneCreate(before, await bookingSnapshot(s.tenantIds), s, { jobId: null, customerId: null });
    } finally { await gate.release(); }
  });

  test("[P0] E2E-004/005 phone failure keeps unsent draft and explicit retry confirms one durable save",
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
      for (const id of s.assigneeIds) await expect(editor(page).getByTestId("booking-assignee-option-" + id)).toBeChecked();
      expect(await bookingSnapshot(s.tenantIds)).toEqual(before);
      const observer = await h.observeNextConfirmedSave();
      await expectTarget(editor(page).getByTestId("booking-retry"), 48);
      await editor(page).getByTestId("booking-retry").click();
      await observer.confirmed;
      await expect(page.getByTestId("booking-save-status")).toHaveText(/sparad|sparats/i);
      expectOneCreate(before, await bookingSnapshot(s.tenantIds), s, { jobId: null, customerId: null });
    });

  test("[P0] E2E-005 phone lost committed response replays one booking assignments conflicts and attributable audit",
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
      await editor(page).getByTestId("booking-conflict-panel").locator("article").filter({ hasText: "Dubbelbokning" }).getByRole("checkbox").check();
      const reason = "Samordnat tillfälligt arbete";
      await editor(page).getByTestId("booking-override-reason").fill(reason);
      await editor(page).getByTestId("booking-save").click();
      await lost.committed; // adapter must await actual SQL outcome before dropping response
      await expect(editor(page).getByTestId("booking-save-error")).toBeVisible();
      await expect(page.getByTestId("booking-save-status")).toHaveCount(0);
      await expect(editor(page).getByTestId("booking-description")).toHaveValue(s.description);
      await expect(editor(page).getByTestId("booking-override-reason")).toHaveValue(reason);
      await expect(editor(page).getByTestId("booking-unresolved-save")).toBeVisible();
      await expect(editor(page).getByTestId("booking-description")).toBeDisabled();
      await expect(editor(page).getByTestId("booking-override-reason")).toBeDisabled();
      const blockedEdit=await editor(page).getByTestId("booking-description").fill(s.description+" changed",{timeout:300}).then(()=>false,()=>true);
      expect(blockedEdit).toBe(true);
      await expect(editor(page).getByTestId("booking-description")).toHaveValue(s.description);
      await expect(editor(page).getByTestId("booking-close")).toBeDisabled();
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
      await expect(page.getByTestId("booking-save-status")).toHaveText(/sparad|sparats/i);
      expect(await bookingSnapshot(s.tenantIds)).toEqual(committed); // exact outcome/audit/no duplicate identity
      await editor(page).getByTestId("booking-close").click();
      await summary(page,row.id).getByTestId("booking-edit").click();
      await expect(editor(page)).toHaveAccessibleName("Redigera bokning");
      await expect(editor(page).getByTestId("booking-description")).toHaveValue(s.description);
      await expect(editor(page).getByTestId("booking-conflict-panel")).toBeVisible();
      expect(await bookingSnapshot(s.tenantIds)).toEqual(committed);
    });

  test("[P1] AC2/ E2E-007 latest warning wins and preview failure remains visibly unknown",
    { annotation: [{ type: "skipNetworkMonitoring", description: "Expected preview failure is the subject of the test" }] },
    async ({ resourcePage: page, bookingEditor: h }) => {
      const s = await h.seed("conflicted");
      const race = await h.raceNextPreviews(); // arm before navigation/action
      await signIn(page, s);
      await openToolbar(page);
      await fillDraft(page, s, false);
      await race.olderStarted;
      await editor(page).getByTestId("booking-end").fill("2026-10-12T17:00");
      const panel = editor(page).getByTestId("booking-conflict-panel");
      await expect(panel).toContainText("Okänd");
      await expect(panel.getByText(s.olderWarning.text, { exact: true })).toHaveCount(0);
      // Actual Next action transport serializes requests. Release obsolete work,
      // verify it cannot restore warnings, then deliver the queued newest result.
      await race.releaseOlderAndWaitForSettlement();
      await race.newerStarted;
      await expect(panel).toContainText("Okänd");
      await expect(panel.getByText(s.olderWarning.text, { exact: true })).toHaveCount(0);
      await race.releaseNewerAndWaitForRender();
      await expect(panel).toContainText(s.newerWarning.text);
      for (const detail of [s.newerWarning.rule, s.newerWarning.person, s.newerWarning.window, s.newerWarning.collision]) {
        await expect(panel).toContainText(detail);
      }
      await expect(panel.getByRole("img", { name: s.newerWarning.timelineName })).toBeVisible();
      await expect(panel).toContainText(s.newerWarning.text);
      await expect(panel.getByText(s.olderWarning.text, { exact: true })).toHaveCount(0);
      await editor(page).getByTestId("booking-review-current-warnings").check();
      const failure = await h.failNextPreviewOnce();
      await editor(page).getByTestId("booking-end").fill("2026-10-12T18:00");
      await failure.failed;
      await expect(editor(page).getByTestId("booking-review-current-warnings")).toHaveCount(0);
      await expect(editor(page).getByTestId("booking-preview-error")).toHaveAttribute("role", "alert");
      await expect(editor(page).getByTestId("booking-preview-unknown")).toBeVisible();
      await expect(editor(page).getByTestId("booking-conflict-free")).toHaveCount(0);
      await expect(editor(page).getByTestId("booking-end")).toHaveValue("2026-10-12T18:00");
    });

  test("[P1] E2E-007 keyboard focus remains in sheet and warnings announce explanatory timeline", async ({ resourcePage: page, bookingEditor: h }) => {
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
