import { beforeEach, describe, expect, test, vi } from "vitest";
import { createHash } from "node:crypto";
import { CommandError } from "@/server/commands/command-errors";
import { previewBookingAction, saveBookingAction } from "@/features/resources/booking-actions";
import { openBookingConflictCounts, readBookingEditorDefault, readBookingEditorOptions, readBookingHost } from "@/features/resources/bookings-read";

const harness = vi.hoisted(() => ({ client: {} as unknown, resolve: vi.fn(), preview: vi.fn(), command: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/server/db/supabase-server-client", () => ({ createSupabaseServerClient: async () => harness.client }));
vi.mock("@/server/auth/resolve-tenant-context", () => ({ resolveTenantContext: harness.resolve }));
vi.mock("@/server/bookings/editor-preview", () => ({ previewBookingEditor: harness.preview }));
vi.mock("next/cache", () => ({ revalidatePath: harness.revalidate }));
vi.mock("@/server/commands/envelope", async (original) => ({ ...await original<typeof import("@/server/commands/envelope")>(), runCommand: harness.command }));

const ID = "00000000-0000-4000-8000-000000000001";
const PERSON = "00000000-0000-4000-8000-000000000002";
const PEER = "00000000-0000-4000-8000-000000000003";
const THIRD = "00000000-0000-4000-8000-000000000004";
const TENANT = "00000000-0000-4000-8000-000000000005";
const JOB = "00000000-0000-4000-8000-000000000006";
const CUSTOMER = "00000000-0000-4000-8000-000000000007";
const START = "2026-10-12T06:00:00.123456+00:00";
const END = "2026-10-12T07:00:00.654321+00:00";
type Row = Record<string, unknown>;
let reads: { table: string; columns: string; filters: [string, unknown][] }[];
let rpc: ReturnType<typeof vi.fn>;
function fakeClient(data: Record<string, Row[]> = {}, errorTable?: string) {
  rpc = vi.fn(async () => ({ data: [{ id: PERSON, default_work_role_id: ID }], error: null }));
  return { rpc, from(table: string) {
    const request = { table, columns: "", filters: [] as [string, unknown][] };
    reads.push(request);
    const rows = () => (data[table] ?? []).filter((row) => request.filters.every(([column, value]) => row[column] === value));
    const query = {
      select(columns: string) { request.columns = columns; return query; },
      eq(column: string, value: unknown) { request.filters.push([column, value]); return query; },
      is(column: string, value: unknown) { request.filters.push([column, value]); return query; },
      order() { return query; },
      async range(from: number, to: number) { return { data: rows().slice(from, to + 1), error: errorTable === table ? { message: "private failure" } : null }; },
      async maybeSingle() { return { data: rows()[0] ?? null, error: errorTable === table ? {} : null }; },
    };
    return query;
  } };
}
function context(role = "tenant_admin") {
  harness.resolve.mockResolvedValue({ ok: true, data: { tenantId: TENANT, userId: PERSON, role, roles: [role], status: "active" } });
}
function candidate(extra: Row = {}) {
  return { commandId: ID, proposedBookingId: THIRD, startsAt: START, endsAt: END, allDay: false,
    assigneeIds: [PERSON], workRoleId: null, jobId: null, customerId: null, facilityId: null, contactId: null,
    description: "Arbete", status: "planned", seriesId: null, occurrenceIndex: null, isException: false, ...extra };
}
function booking(extra: Row = {}) {
  return { id: ID, tenant_id: TENANT, starts_at: START, ends_at: END, all_day: false, work_role_id: null,
    job_id: JOB, customer_id: CUSTOMER, facility_id: null, contact_id: null, description: "Arbete", status: "planned",
    booking_assignees: [{ person_profile_id: PERSON }], ...extra };
}
beforeEach(() => {
  vi.clearAllMocks(); reads = []; context(); harness.client = fakeClient();
});

describe("booking browser read/action boundaries (mocked transport)", () => {
  test("CRM host access alone cannot query bookings or editor pickers", async () => {
    context("saljare");
    expect((await readBookingHost({ customerId: CUSTOMER })).canView).toBe(false);
    expect((await readBookingEditorOptions()).canManage).toBe(false);
    expect(reads).toEqual([]); expect(rpc).not.toHaveBeenCalled();
  });
  test("Montör cannot mint preview or read tenant-wide picker; visible bookings retain own assignees", async () => {
    context("montor"); harness.client = fakeClient({ bookings: [booking()] });
    expect((await previewBookingAction(candidate())).status).toBe("error");
    expect(harness.preview).not.toHaveBeenCalled();
    expect((await readBookingEditorOptions()).people).toEqual([]);
    const result = await readBookingHost();
    expect(result.canManage).toBe(false); expect(result.canView).toBe(true);
    expect(result.bookings[0]!.assigneeIds).toEqual([PERSON]);
    expect(await readBookingEditorDefault(ID)).toBeNull();
  });
  test("pickers have current tenant filters and display-only projections, including checked active people", async () => {
    harness.client = fakeClient({
      work_roles: [{ id: ID, tenant_id: TENANT, display_name: "Elektriker", is_active: "true", hourly_rate: "private" }],
      customers: [{ id: CUSTOMER, tenant_id: TENANT, display_name: "Kund", archived_at: null, personnummer: "private" }],
      contacts: [{ id: PEER, tenant_id: TENANT, name: "Kontakt", customer_id: CUSTOMER, facility_id: null, archived_at: null, email: "private" }],
    });
    const result = await readBookingEditorOptions();
    expect(result.canManage).toBe(true); expect(result.people[0]!.workRoleIds).toEqual([ID]);
    expect(rpc).toHaveBeenCalledWith("booking_editor_people", { p_tenant_id: TENANT, p_actor_id: PERSON });
    expect(reads.every((row) => row.filters.some(([key, value]) => key === "tenant_id" && value === TENANT))).toBe(true);
    expect(reads.map((row) => row.columns).join(";")).not.toMatch(/personnummer|email|phone|org_nr|rate|price|cost/);
    expect(JSON.stringify(result)).not.toContain("private");
  });
  test("host defaults preserve PostgreSQL microseconds and expose only scoped rows", async () => {
    harness.client = fakeClient({ bookings: [booking(), booking({ id: PEER, job_id: THIRD }), booking({ id: THIRD, tenant_id: PEER })] });
    const result = await readBookingHost({ jobId: JOB });
    expect(result.bookings).toHaveLength(1);
    expect(result.bookings[0]!.startsAt).toBe(START); expect(result.bookings[0]!.endsAt).toBe(END);
    expect(JSON.stringify(result)).not.toMatch(/tenant_id|create_payload_digest|update_outcomes/);
  });
  test("read failure never reports an empty conflict-free state as known", async () => {
    harness.client = fakeClient({ bookings: [booking()] }, "booking_conflicts");
    const result = await readBookingHost();
    expect(result.error).toBeTruthy(); expect(result.canManage).toBe(false); expect(result.bookings).toEqual([]);
    expect(result.error).not.toContain("private");
  });
  test("preview uses current authority and stable proposed UUID, stripping internal proof fields", async () => {
    harness.preview.mockResolvedValue({ receipt: "opaque", bookingId: THIRD,
      warnings: [{ logicalId: "group", ruleLabel: "Dubbelbokning", personId: PERSON, bookingIds: [PEER, THIRD], startsAt: START, endsAt: END, privateProof: "private" }],
      availability: [{ personId: PERSON, available: false }], canonicalFacts: "private", signature: "private" });
    const result = await previewBookingAction(candidate());
    expect(result.status).toBe("success");
    expect(harness.preview.mock.calls[0]![1]).toMatchObject({ p_tenant_id: TENANT, p_actor_id: PERSON, p_proposed_id: THIRD, p_command_id: ID });
    expect(JSON.stringify(result)).not.toMatch(/private|canonicalFacts|signature/);
    if (result.status === "success") expect(result.preview.warnings[0]!.bookingLabels).toContain("Den här bokningen");
  });
  test("preview denies hidden update targets and requires stable create identity", async () => {
    const { proposedBookingId: _, ...input } = candidate(); void _;
    expect((await previewBookingAction(input)).status).toBe("error");
    expect((await previewBookingAction({ ...input, bookingId: ID })).status).toBe("error");
    expect(harness.preview).not.toHaveBeenCalled();
  });
  test("stale preview exposes only a typed safe retry state", async () => {
    harness.preview.mockRejectedValue(new CommandError("PREVIEW_STALE"));
    expect(await previewBookingAction(candidate())).toMatchObject({ status: "error", code: "PREVIEW_STALE" });
  });
  test("failed save retains error and cannot revalidate hosts", async () => {
    harness.command.mockResolvedValue({ ok: false, code: "SERVER_ERROR", message: "private failure" });
    const result = await saveBookingAction(candidate({ jobId: JOB, customerId: CUSTOMER }));
    expect(result).toMatchObject({ status: "error", code: "SERVER_ERROR" });
    expect(JSON.stringify(result)).not.toContain("private"); expect(harness.revalidate).not.toHaveBeenCalled();
  });
  test("only confirmed success revalidates current jobs and customer hosts", async () => {
    harness.command.mockResolvedValue({ ok: true, data: { bookingId: THIRD } });
    expect(await saveBookingAction(candidate({ jobId: JOB, customerId: CUSTOMER }))).toMatchObject({ status: "success", bookingId: THIRD });
    expect(harness.revalidate.mock.calls).toEqual([["/jobs"], [`/jobs/${JOB}`], [`/customers/${CUSTOMER}`]]);
  });
  test("confirmed update clears former connected host summaries as well", async () => {
    harness.command.mockResolvedValue({ ok: true, data: { bookingId: ID } });
    const { proposedBookingId: _, ...input } = candidate({ bookingId: ID }); void _;
    expect((await saveBookingAction(input)).status).toBe("success");
    expect(harness.revalidate.mock.calls).toEqual([["/jobs"], ["/jobs/[jobId]", "page"], ["/customers/[customerId]", "page"]]);
  });
  test("open counts verify whole aggregate identities while preserving unrelated/person groups", () => {
    const starts = "2026-10-11T22:00:00.000000Z", ends = "2026-10-12T22:00:00.000000Z";
    const natural = JSON.stringify(["over_capacity", [ID, PEER, THIRD].sort(), [PERSON], starts, ends]);
    const hash = (parts: unknown[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");
    const base = { booking_id: ID, related_booking_id: PEER, affected_person_profile_id: PERSON,
      conflict_type: "over_capacity", starts_at: starts, ends_at: ends, status: "open", natural_key: `v1:${hash([natural, PERSON])}` };
    const association = { ...base, booking_id: THIRD, related_booking_id: ID, natural_key: `v2:${hash([natural, PERSON, THIRD])}` };
    const counts = openBookingConflictCounts([base, association, { ...base, natural_key: "different-key", status: "accepted" },
      { ...base, booking_id: JOB, related_booking_id: null, conflict_type: "outside_work_hours", natural_key: "unrelated" }], [ID, PEER, THIRD]);
    expect(counts.count).toBe(1); expect([...counts.byBooking.values()]).toEqual([1, 1, 1]);
    const mismatched = openBookingConflictCounts([{ ...base, natural_key: "opaque-1" }, { ...association, natural_key: "opaque-2" }], [ID, PEER, THIRD]);
    expect(mismatched.count).toBe(2);
    expect(openBookingConflictCounts([{ ...base, status: "resolved" }, { ...association, status: "accepted" }], [ID]).count).toBe(0);
  });
});
