/**
 * Story 14.4 actual browser transport and scoped local fixtures. No service launch.
 * library gate exception: playwright-utils flag=true, package absent.
 * Reuse the project's guarded resourcePage and per-run .auth/fixture.json.
 * The default library framework workflow may establish playwright-utils later;
 * no missing dependency import is generated in this RED contract.
 */
import { test as base, expect } from "./resource-cdp-attachment";
import type { Page, TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { admin, adminInsertContact, adminInsertCustomer, adminInsertFacility, deleteAuthUser, makeAuthedServerClient, type FixtureUser } from "../../factories/tenants";
import { adminQuery, adminSession } from "../../factories/admin-sql";
import { bookingInput } from "../../support/bookings-atdd";
import { createBooking } from "@/server/commands/bookings/create-booking";
import { runCommand } from "@/server/commands/envelope";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
import { previewBookingEditor } from "@/server/bookings/editor-preview";
import { bookingPayload, validateCreateBooking } from "@/server/commands/bookings/validation";
import { formatBookingTime } from "@/components/resources/BookingConflictPanel";

export type Scenario = {
  readonly credentials: { readonly email: string; readonly password: string };
  readonly tenantIds: string[];
  readonly tenantId: string;
  readonly actorMembershipId: string;
  readonly actorUserId: string;
  readonly assigneeIds: readonly string[];
  readonly assigneeLabels: readonly string[];
  readonly description: string;
  readonly startsLocal: string;
  readonly endsLocal: string;
  readonly expectedStartsAt: string;
  readonly expectedEndsAt: string;
  readonly jobId: string;
  readonly customerId: string;
  readonly facilityId: string;
  readonly contactId: string;
  readonly workRoleId: string;
  readonly persistedBookingId: string;
  readonly expectedOpenLogicalCount: number;
  readonly expectedConflictRowCount: number;
  readonly expectedAcceptedRowCount: number;
  readonly expectedOpenRowCount: number;
  readonly selectedLogicalId: string;
  readonly olderWarning: { readonly text: string; readonly timelineName: string; readonly rule: string; readonly person: string; readonly window: string; readonly collision: string };
  readonly newerWarning: { readonly text: string; readonly timelineName: string; readonly rule: string; readonly person: string; readonly window: string; readonly collision: string };
};
export type SaveGate = {
  /** Actual matching request has reached the adapter's hold point. */
  readonly started: Promise<void>;
  readonly release: () => Promise<void>;
};
export type PreviewRace = {
  readonly olderStarted: Promise<void>;
  readonly newerStarted: Promise<void>;
  /** Release captured real production responses; never synthesize detector facts. */
  readonly releaseNewerAndWaitForRender: () => Promise<void>;
  readonly releaseOlderAndWaitForSettlement: () => Promise<void>;
};
export interface BookingEditorHarness {
  /**
   * Use scoped local adminQuery/adminExec helpers only at test execution.
   * Read credentials from tests/e2e/.auth/fixture.json; provision dedicated
   * per-test person/job/customer rows under that authenticated tenant.
   * Fixed Stockholm 2026-10-12 fixtures; no Date.now-derived booking boundaries.
   * Unique description and IDs per test; no broad seed/reset or unrelated edits.
   * Capture affected existing rows and restore only owned changes in dispose.
   */
  seed(mode: "conflict-free" | "conflicted" | "persisted-conflict-states" | "large-review"): Promise<Scenario>;
  /** Register actual production save observation BEFORE navigation/action. */
  observeNextConfirmedSave(): Promise<{ readonly confirmed: Promise<void> }>;
  /** Hold actual request before writes; release is idempotent and always cleaned. */
  holdNextSave(): Promise<SaveGate>;
  /** Observe a real transient SERVER_ERROR before any durable writes. */
  failNextSaveOnce(): Promise<{ readonly failed: Promise<void> }>;
  /**
   * Run real save to durable completion, then lose only its response.
   * committed resolves from actual SQL outcome/readback, not request sent/200 mock.
   * Retry must preserve original business command, create UUID and review decision.
   */
  loseNextCommittedSaveResponseOnce(): Promise<{ readonly committed: Promise<void> }>;
  /**
   * Capture real preview responses for changed candidates. Next queues actions,
   * so release obsolete transport before the queued newest request can start.
   * Component tests separately exercise reversed response delivery.
   * Binding must identify actual Next action transport, not guess an /api URL.
   */
  raceNextPreviews(): Promise<PreviewRace>;
  failNextPreviewOnce(): Promise<{ readonly failed: Promise<void> }>;
  failNextOptionsReadOnce(): Promise<{ readonly failed: Promise<void> }>;
  observeNextSaveTransport(timeoutMs?: number): Promise<{ readonly observed: Promise<{bodyBytes: number;status: number}> }>;
  /** Remove routes/holds/listeners and only per-test SQL rows; never stop browser. */
  dispose(): Promise<void>;
}

/** Actual Next action requests and responses; durable assertions use SQL readback. */
async function bindBookingEditorHarness(
  page: Page,
  testInfo: TestInfo,
): Promise<BookingEditorHarness> {
  void testInfo;
  const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => { resolve = done; });
    return { promise, resolve };
  };
  const fixture = JSON.parse(readFileSync(path.join(process.cwd(), "tests/e2e/.auth/fixture.json"), "utf8")) as {
    adminA: FixtureUser; tenantA: { id: string }; tenantB: { id: string };
  };
  const tenantId = fixture.tenantA.id;
  const token = `booking-e2e-${randomUUID()}`;
  const users: string[] = [], profiles: string[] = [], memberships: string[] = [], labels: string[] = [];
  const owned = { jobId: "", customerId: "", facilityId: "", contactId: "", workRoleId: "" };
  let scenario: Scenario | undefined;
  const releases: (() => void)[] = [];
  const pendingRoutes = new Set<Promise<void>>();
  const confirmations: (() => void)[] = [];
  const transports: ((value: {bodyBytes:number;status:number}) => void)[] = [];
  let observedSaveTimeout: number | undefined;
  let optionsFailure: (() => void) | undefined;
  let saveHold: { started: () => void; wait: Promise<void> } | undefined;
  let saveFailure: (() => void) | undefined;
  let saveLoss: (() => void) | undefined;
  let previewFailure: (() => void) | undefined;
  let previewRace: { older: ReturnType<typeof deferred>; newer: ReturnType<typeof deferred>;
    releaseOlder: ReturnType<typeof deferred>; releaseNewer: ReturnType<typeof deferred>;
    olderDone: ReturnType<typeof deferred>; newerDone: ReturnType<typeof deferred>; index: number } | undefined;
  const saveCommitted = async (input: Record<string, unknown>, response: import("@playwright/test").APIResponse) => {
    const [row] = await adminQuery<{ committed: boolean }>(`select exists(select 1 from public.bookings
      where tenant_id=$1 and ((create_command_id=$2 and id=$3) or (id=$4 and update_outcomes ? $2::text))) as committed`,
      [tenantId, input.commandId, input.proposedBookingId ?? null, input.bookingId ?? null]);
    if (!row.committed) {
      const code = (await response.text()).match(/"code":"([A-Z_]+)"/)?.[1] ?? "NO_SAFE_CODE";
      await response.dispose();
      throw new Error(`Actual booking action returned without durable command outcome: ${code}`);
    }
  };
  const actionInput = (body: string | null): Record<string, unknown> | null => {
    try {
      const value = JSON.parse(body ?? "null");
      const input = Array.isArray(value) ? value[0] : null;
      return input && typeof input === "object" && typeof input.commandId === "string" && Array.isArray(input.assigneeIds) ? input : null;
    } catch { return null; }
  };
  const routeWork = async (route: import("@playwright/test").Route) => {
    const request = route.request();
    if (request.method() !== "POST" || !request.headers()["next-action"]) { await route.continue(); return; }
    const input = actionInput(request.postData());
    if (!input && request.postData() === "[]" && optionsFailure) {const done=optionsFailure; optionsFailure=undefined; await route.abort("failed"); done(); return;}
    if (!input) { await route.continue(); return; }
    const save = "editorReview" in input;
    if (save && saveFailure) { const done = saveFailure; saveFailure = undefined; await route.abort("failed"); done(); return; }
    if (!save && previewFailure) { const done = previewFailure; previewFailure = undefined; await route.abort("failed"); done(); return; }
    if (save && saveHold) { const gate = saveHold; saveHold = undefined; gate.started(); await gate.wait; }
    // The response is obtained from the actual Next action; no facts/results are fabricated.
    const fetchTimeout = save ? observedSaveTimeout : undefined;
    if (save) observedSaveTimeout = undefined;
    const response = await route.fetch(fetchTimeout ? {timeout: fetchTimeout} : undefined);
    if (save) {
      for (const observe of transports.splice(0)) observe({bodyBytes:Buffer.byteLength(request.postData() ?? ""),status:response.status()});
      // A denied replay/413 is an actual error response, not confirmation of an existing row.
      if (response.ok() && /"status":"success"/.test(await response.text())) {
        await saveCommitted(input, response);
        for (const confirm of confirmations.splice(0)) confirm();
        if (saveLoss) { const done = saveLoss; saveLoss = undefined; await route.abort("failed"); done(); return; }
      }
    } else if (previewRace && scenario && input.description === scenario.description && input.workRoleId === scenario.workRoleId &&
      (input.assigneeIds as string[]).length === scenario.assigneeIds.length) {
      const race = previewRace; const index = race.index++;
      if (index === 0) { race.older.resolve(); await race.releaseOlder.promise; await route.fulfill({ response }); race.olderDone.resolve(); return; }
      if (index === 1) { race.newer.resolve(); await race.releaseNewer.promise; await route.fulfill({ response }); race.newerDone.resolve(); return; }
    }
    await route.fulfill({ response });
  };
  const routeHandler = async (route: import("@playwright/test").Route) => {
    const pending = routeWork(route); pendingRoutes.add(pending);
    try { await pending; } finally { pendingRoutes.delete(pending); }
  };
  await page.route("**/*", routeHandler);
  const createReviewed = async (input: ReturnType<typeof bookingInput> & { proposedBookingId: string }, selectedRule?: string) => {
    const client = await makeAuthedServerClient(fixture.adminA);
    const authority = await resolveTenantContext({ client: client as never });
    if (!authority.ok || authority.data.tenantId !== tenantId) throw new Error("Browser fixture current booking authority unavailable");
    const validated = validateCreateBooking(input);
    if (!validated.ok) throw new Error("Browser fixture candidate invalid");
    const preview = await previewBookingEditor(client, { p_tenant_id: tenantId, p_actor_id: fixture.adminA.id,
      p_command_id: input.commandId, p_correlation_id: randomUUID(), p_proposed_id: input.proposedBookingId, p_payload: bookingPayload(validated.data) });
    const result = await runCommand(createBooking, { client: client as never, input: { ...input,
      editorReview: { receipt: preview.receipt, decision: { acknowledged: preview.warnings.length > 0,
        reviewedLogicalIds: preview.warnings.map((warning) => warning.logicalId),
        selectedLogicalIds: preview.warnings.filter((warning) => warning.ruleLabel === selectedRule).map((warning) => warning.logicalId),
        reason: preview.warnings.length ? "Synthetic browser fixture reviewed warnings" : "" } },
    } });
    if (!result.ok) throw new Error(`Browser fixture real command failed: ${result.code}`);
    return { id: result.data.bookingId, preview };
  };
  return {
    async seed(mode) {
      const [actor] = await adminQuery<{ id: string }>("select id from public.tenant_memberships where tenant_id=$1 and user_id=$2", [tenantId, fixture.adminA.id]);
      const workRoleId = randomUUID();
      owned.workRoleId = workRoleId;
      await adminQuery("insert into public.work_roles(id,tenant_id,display_name,cost_rate_ore,sell_rate_ore) values($1,$2,$3,20000,40000)", [workRoleId, tenantId, token]);
      for (let index = 0; index < 2; index++) {
        const { data, error } = await admin().auth.admin.createUser({ email: `${token}-${index}@example.test`, password: `Synthetic-${randomUUID()}-Aa1!`, email_confirm: true });
        if (error || !data.user) throw new Error("Dedicated browser resource user setup failed");
        labels.push(data.user.email!); users.push(data.user.id); const member = randomUUID(), profile = randomUUID(); memberships.push(member); profiles.push(profile);
        await adminQuery("insert into public.tenant_memberships(id,tenant_id,user_id,role,status) values($1,$2,$3,'montor','active')", [member, tenantId, data.user.id]);
        await adminQuery("insert into public.person_profiles(id,tenant_id,membership_id,default_work_role_id) values($1,$2,$3,$4)", [profile, tenantId, member, workRoleId]);
        for (let weekday = 1; weekday <= 5; weekday++) await adminQuery("insert into public.person_work_hours(tenant_id,person_profile_id,entry_kind,weekday,starts_at,ends_at) values($1,$2,'weekly_shift',$3,'08:00','16:00')", [tenantId, profile, weekday]);
      }
      const customerId = await adminInsertCustomer({ tenant_id: tenantId, customer_type: "company", display_name: token });
      owned.customerId = customerId;
      const facilityId = await adminInsertFacility({ tenant_id: tenantId, customer_id: customerId, name: token });
      owned.facilityId = facilityId;
      const contactId = await adminInsertContact({ tenant_id: tenantId, customer_id: customerId, facility_id: facilityId, name: token });
      owned.contactId = contactId;
      const jobId = randomUUID();
      owned.jobId = jobId;
      await adminQuery("insert into public.jobs(id,tenant_id,customer_id,title) values($1,$2,$3,$4)", [jobId, tenantId, customerId, token]);
      const conflicted = mode === "conflicted" || mode === "persisted-conflict-states";
      const start = conflicted ? "2026-10-12T13:00:00.000000Z" : "2026-10-12T07:00:00.000000Z";
      const end = conflicted ? "2026-10-12T14:30:00.000000Z" : "2026-10-12T08:00:00.000000Z";
      const person = labels[0]!;
      const warning = (startsAt: string, endsAt: string) => ({ text: `Utanför arbetstid · ${person}`,
        timelineName: `Utanför arbetstid: ${person}, ${formatBookingTime(startsAt)} till ${formatBookingTime(endsAt)}`,
        rule: "Utanför arbetstid", person, window: `${formatBookingTime(startsAt)} – ${formatBookingTime(endsAt)}`, collision: "Den här bokningen" });
      scenario = { credentials: { email: fixture.adminA.email, password: fixture.adminA.password }, tenantIds: [tenantId, fixture.tenantB.id],
        tenantId, actorMembershipId: actor.id, actorUserId: fixture.adminA.id, assigneeIds: profiles,
        assigneeLabels: labels, description: token,
        startsLocal: conflicted ? "2026-10-12T15:00" : "2026-10-12T09:00", endsLocal: conflicted ? "2026-10-12T16:30" : "2026-10-12T10:00",
        expectedStartsAt: start.replace(".000000Z", "+00:00"), expectedEndsAt: end.replace(".000000Z", "+00:00"),
        jobId, customerId, facilityId, contactId, workRoleId, persistedBookingId: "", expectedOpenLogicalCount: 1,
        expectedConflictRowCount: 3, expectedAcceptedRowCount: 1, expectedOpenRowCount: mode === "persisted-conflict-states" ? 1 : 2,
        selectedLogicalId: "", olderWarning: warning("2026-10-12T14:00:00Z", end), newerWarning: warning("2026-10-12T14:00:00Z", "2026-10-12T15:00:00Z") };
      (scenario.olderWarning as { text: string }).text = scenario.olderWarning.window;
      if (mode === "large-review") {
        await adminQuery(`insert into public.bookings(id,tenant_id,starts_at,ends_at,description,create_command_id,create_payload_digest,create_result)
          select id,$1,'2026-10-12T07:00:00Z'::timestamptz+n*interval '1 second',
          '2026-10-12T07:00:00Z'::timestamptz+(n+1)*interval '1 second',$2,gen_random_uuid(),repeat('a',64),jsonb_build_object('bookingId',id::text)
          from (select gen_random_uuid() id,generate_series(0,999) n) peers`,[tenantId,`${token} large peer`]);
        await adminQuery("insert into public.booking_assignees(tenant_id,booking_id,person_profile_id) select tenant_id,id,$3 from public.bookings where tenant_id=$1 and description=$2",[tenantId,`${token} large peer`,profiles[0]]);
        scenario={...scenario,endsLocal:"2026-10-12T09:20",expectedEndsAt:"2026-10-12T07:20:00+00:00",expectedConflictRowCount:1000,expectedAcceptedRowCount:1,expectedOpenRowCount:999};
      }
      if (conflicted) {
        await createReviewed({ ...bookingInput([profiles[0]!], { startsAt: "2026-10-12T13:15:00.000000Z", endsAt: "2026-10-12T13:45:00.000000Z", description: `${token}-peer` }), proposedBookingId: randomUUID() });
      }
      if (mode === "persisted-conflict-states") {
        const saved = await createReviewed({ ...bookingInput(profiles, { startsAt: start, endsAt: end, description: token, jobId, customerId, workRoleId }), proposedBookingId: randomUUID() }, "Dubbelbokning");
        (scenario as { persistedBookingId: string }).persistedBookingId = saved.id;
        await adminQuery("update public.booking_conflicts set status='resolved',resolution_outcome='Synthetic fixture resolved',resolved_by_membership_id=$3,resolved_at=statement_timestamp() where tenant_id=$1 and booking_id=$2 and affected_person_profile_id=$4 and conflict_type='outside_work_hours'", [tenantId, saved.id, actor.id, profiles[1]]);
      }
      return scenario;
    },
    async observeNextConfirmedSave() { const done = deferred(); confirmations.push(done.resolve); return { confirmed: done.promise }; },
    async holdNextSave() { const started = deferred(), gate = deferred(); releases.push(gate.resolve); saveHold = { started: started.resolve, wait: gate.promise }; return { started: started.promise, release: async () => gate.resolve() }; },
    async failNextSaveOnce() { const done = deferred(); saveFailure = done.resolve; return { failed: done.promise }; },
    async loseNextCommittedSaveResponseOnce() { const done = deferred(); saveLoss = done.resolve; return { committed: done.promise }; },
    async failNextPreviewOnce() { const done = deferred(); previewFailure = done.resolve; return { failed: done.promise }; },
    async failNextOptionsReadOnce() { const done = deferred(); optionsFailure = done.resolve; return { failed: done.promise }; },
    async observeNextSaveTransport(timeoutMs?: number) { observedSaveTimeout=timeoutMs; let resolve!: (value:{bodyBytes:number;status:number})=>void;
      const observed=new Promise<{bodyBytes:number;status:number}>(done=>{resolve=done;}); transports.push(resolve); return {observed}; },
    async raceNextPreviews() {
      const race = { older: deferred(), newer: deferred(), releaseOlder: deferred(), releaseNewer: deferred(), olderDone: deferred(), newerDone: deferred(), index: 0 };
      previewRace = race; releases.push(race.releaseOlder.resolve, race.releaseNewer.resolve);
      return { olderStarted: race.older.promise, newerStarted: race.newer.promise,
        releaseNewerAndWaitForRender: async () => { race.releaseNewer.resolve(); await race.newerDone.promise; await expect(page.getByTestId("booking-conflict-panel")).toContainText(scenario!.newerWarning.window); },
        releaseOlderAndWaitForSettlement: async () => { race.releaseOlder.resolve(); await race.olderDone.promise; await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))); } };
    },
    async dispose() {
      for (const release of releases) release();
      await Promise.allSettled([...pendingRoutes]);
      if (!page.isClosed()) await page.unroute("**/*", routeHandler);
      if (owned.workRoleId) await adminSession(async ({ query }) => {
        await query("begin");
        try {
          await query("set local session_replication_role=replica");
          await query("delete from public.audit_events where tenant_id=$1 and target_id in(select id from public.bookings where tenant_id=$1 and description like $2)", [tenantId, `${token}%`]);
          await query("delete from public.booking_conflicts where tenant_id=$1 and (booking_id in(select id from public.bookings where tenant_id=$1 and description like $2) or related_booking_id in(select id from public.bookings where tenant_id=$1 and description like $2))", [tenantId, `${token}%`]);
          await query("delete from public.booking_assignees where tenant_id=$1 and booking_id in(select id from public.bookings where tenant_id=$1 and description like $2)", [tenantId, `${token}%`]);
          await query("delete from public.bookings where tenant_id=$1 and description like $2", [tenantId, `${token}%`]);
          await query("delete from public.jobs where tenant_id=$1 and id=$2", [tenantId, owned.jobId || null]);
          await query("delete from public.contacts where tenant_id=$1 and id=$2", [tenantId, owned.contactId || null]);
          await query("delete from public.facilities where tenant_id=$1 and id=$2", [tenantId, owned.facilityId || null]);
          await query("delete from public.customers where tenant_id=$1 and id=$2", [tenantId, owned.customerId || null]);
          await query("delete from public.person_work_hours where tenant_id=$1 and person_profile_id=any($2::uuid[])", [tenantId, profiles]);
          await query("delete from public.person_profiles where tenant_id=$1 and id=any($2::uuid[])", [tenantId, profiles]);
          await query("delete from public.membership_roles where tenant_id=$1 and membership_id=any($2::uuid[])", [tenantId, memberships]);
          await query("delete from public.tenant_memberships where tenant_id=$1 and id=any($2::uuid[])", [tenantId, memberships]);
          await query("delete from public.work_roles where tenant_id=$1 and id=$2", [tenantId, owned.workRoleId]);
          await query("commit");
        } catch (error) { await query("rollback"); throw error; }
      });
      for (const id of users) await deleteAuthUser(id);
    },
  };
}

export const test = base.extend<{ bookingEditor: BookingEditorHarness }>({
  bookingEditor: async ({ resourcePage }, provide, testInfo) => {
    const harness = await bindBookingEditorHarness(resourcePage, testInfo);
    try { await provide(harness); }
    finally { await harness.dispose(); }
  },
});
export { expect };
