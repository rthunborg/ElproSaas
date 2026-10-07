import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
import { resolveCapability } from "@/server/authz/permission-matrix";
import { createHash } from "node:crypto";
import { formatUtcInstant, parseUtcInstant } from "@/features/scheduling/time-zone";
import type { BookingEditorOptions, BookingHostReadResult, BookingSummary } from "./booking-action-state";

const ERROR = "Bokningsuppgifterna kunde inte läsas. Försök igen om en stund.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOOKING_COLUMNS = "id,starts_at,ends_at,all_day,work_role_id,job_id,customer_id,facility_id,contact_id,description,status,booking_assignees(person_profile_id)";
type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Row = Record<string, unknown>;
type OpenConflictRow = { readonly booking_id: string; readonly related_booking_id: string | null; readonly affected_person_profile_id: string | null; readonly conflict_type: string; readonly starts_at: string; readonly ends_at: string; readonly natural_key: string; readonly status: string };

function emptyOptions(error: string | null = null): BookingEditorOptions {
  return { canManage: false, people: [], workRoles: [], jobs: [], customers: [], facilities: [], contacts: [], error };
}
function emptyHost(error: string | null = null): BookingHostReadResult {
  return { canView: false, canManage: false, bookings: [], openConflictCount: 0, error };
}
function nullable(value: unknown): string | null { return typeof value === "string" ? value : null; }
export function bookingPersonLabel(id: string, identity?: unknown): string { return typeof identity === "string" && identity.trim() ? identity.trim() : `Resursperson ${id.slice(0, 8)}`; }
/** The existing SQL management gate owns access to same-tenant staff identity. */
export async function readBookingPeople(client: Client, tenantId: string, actorId: string): Promise<Row[]> {
  const result = await client.rpc("booking_editor_people", { p_tenant_id: tenantId, p_actor_id: actorId });
  if (result.error || !Array.isArray(result.data)) throw new Error("booking picker read failed");
  return result.data as Row[];
}

/** Paged explicit projections avoid a silently truncated persistent count. */
async function readRows(client: Client, table: string, columns: string, tenantId: string,
  filters: readonly { readonly column: string; readonly value: string | null }[] = []): Promise<Row[]> {
  const result: Row[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = client.from(table).select(columns).eq("tenant_id", tenantId);
    for (const filter of filters) query = filter.value === null ? query.is(filter.column, null) : query.eq(filter.column, filter.value);
    const { data, error } = await query.order("id", { ascending: true }).range(offset, offset + 499);
    if (error) throw new Error("booking read failed");
    const rows = (data ?? []) as unknown as Row[];
    result.push(...rows);
    if (rows.length < 500) return result;
  }
}

/** Match the sole engine's aggregate associations without exposing stored workflow evidence. */
export function openBookingConflictCounts(rows: readonly OpenConflictRow[], visibleBookingIds: readonly string[]): {
  readonly count: number; readonly byBooking: ReadonlyMap<string, number>;
} {
  const visible = new Set(visibleBookingIds);
  const groups = new Map<string, Set<string>>();
  const aggregateRows = new Map<string, OpenConflictRow[]>();
  const aggregateKey = (row: OpenConflictRow) => JSON.stringify([row.conflict_type, row.affected_person_profile_id,
    formatUtcInstant(parseUtcInstant(row.starts_at)), formatUtcInstant(parseUtcInstant(row.ends_at))]);
  for (const row of rows) if (row.conflict_type === "over_capacity") {
    const key = aggregateKey(row);
    aggregateRows.set(key, [...(aggregateRows.get(key) ?? []), row]);
  }
  for (const row of rows) {
    if (row.status !== "open") continue;
    let key = row.natural_key;
    if (row.conflict_type === "over_capacity") {
      const peers = aggregateRows.get(aggregateKey(row))!;
      const participants = [...new Set(peers.flatMap((peer) => [peer.booking_id, peer.related_booking_id]).filter((id): id is string => id !== null))].sort();
      const naturalIdentity = JSON.stringify([row.conflict_type, participants, [row.affected_person_profile_id],
        formatUtcInstant(parseUtcInstant(row.starts_at)), formatUtcInstant(parseUtcInstant(row.ends_at))]);
      const hash = (parts: unknown[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");
      const base = `v1:${hash([naturalIdentity, row.affected_person_profile_id])}`;
      const association = `v2:${hash([naturalIdentity, row.affected_person_profile_id, row.booking_id])}`;
      // Verify the complete identity before collapsing opaque v1/v2 associations.
      if (row.natural_key === base || row.natural_key === association) key = base;
    }
    const bookings = groups.get(key) ?? new Set<string>();
    for (const id of [row.booking_id, row.related_booking_id]) if (id && visible.has(id)) bookings.add(id);
    if (bookings.size) groups.set(key, bookings);
  }
  const byBooking = new Map<string, number>();
  for (const bookings of groups.values()) for (const id of bookings) byBooking.set(id, (byBooking.get(id) ?? 0) + 1);
  return { count: groups.size, byBooking };
}

function summary(row: Row, openConflictCount: number): BookingSummary {
  return { id: String(row.id), startsAt: String(row.starts_at), endsAt: String(row.ends_at), allDay: row.all_day === true,
    workRoleId: nullable(row.work_role_id), jobId: nullable(row.job_id), customerId: nullable(row.customer_id),
    facilityId: nullable(row.facility_id), contactId: nullable(row.contact_id), description: String(row.description ?? ""),
    status: row.status === "cancelled" ? "cancelled" : "planned",
    assigneeIds: ((row.booking_assignees ?? []) as { person_profile_id: string }[]).map((item) => item.person_profile_id).sort(),
    seriesId: null, occurrenceIndex: null, isException: false, openConflictCount };
}

/** Host access never grants booking entitlement; Montör data remains own-joined under RLS. */
export async function readBookingHost(scope: { readonly jobId?: string; readonly customerId?: string; readonly bookingId?: string } = {}): Promise<BookingHostReadResult> {
  try {
    if (Object.values(scope).some((id) => typeof id !== "string" || !UUID.test(id))) return emptyHost(ERROR);
    const client = await createSupabaseServerClient();
    const context = await resolveTenantContext({ client });
    if (!context.ok) return emptyHost(ERROR);
    const roles = context.data.roles ?? [context.data.role];
    const canView = resolveCapability({ roles, module: "resources", capability: "Bookings.View" }).granted;
    const canManage = resolveCapability({ roles, module: "resources", capability: "Bookings.Manage" }).granted;
    if (!canView) return emptyHost();
    const filters = Object.entries(scope).map(([field, value]) => ({ column: field === "bookingId" ? "id" : field === "jobId" ? "job_id" : "customer_id", value: value! }));
    const tenantId = context.data.tenantId;
    const bookings = await readRows(client, "bookings", BOOKING_COLUMNS, tenantId, filters);
    const conflicts = bookings.length ? await readRows(client, "booking_conflicts", "booking_id,related_booking_id,affected_person_profile_id,conflict_type,starts_at,ends_at,natural_key,status", tenantId) : [];
    const counts = openBookingConflictCounts(conflicts as unknown as OpenConflictRow[], bookings.map((row) => String(row.id)));
    return { canView, canManage, bookings: bookings.map((row) => summary(row, counts.byBooking.get(String(row.id)) ?? 0)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)), openConflictCount: counts.count, error: null };
  } catch { return emptyHost(ERROR); }
}

export async function readBookingEditorDefault(bookingId: string): Promise<BookingSummary | null> {
  const result = await readBookingHost({ bookingId });
  return result.canManage && !result.error ? result.bookings[0] ?? null : null;
}

/** Manager-only, current-tenant options omit price, CRM identifiers and contact details. */
export async function readBookingEditorOptions(): Promise<BookingEditorOptions> {
  try {
    const client = await createSupabaseServerClient(); const context = await resolveTenantContext({ client });
    if (!context.ok) return emptyOptions(ERROR);
    if (!resolveCapability({ roles: context.data.roles ?? [context.data.role], module: "resources", capability: "Bookings.Manage" }).granted) return emptyOptions();
    const tenantId = context.data.tenantId;
    const [profiles, workRoles, jobs, customers, facilities, contacts] = await Promise.all([
      readBookingPeople(client, tenantId, context.data.userId),
      readRows(client, "work_roles", "id,display_name", tenantId, [{ column: "is_active", value: "true" }]),
      readRows(client, "jobs", "id,title,customer_id,facility_id,contact_id", tenantId, [{ column: "archived_at", value: null }]),
      readRows(client, "customers", "id,display_name", tenantId, [{ column: "archived_at", value: null }]),
      readRows(client, "facilities", "id,name,customer_id", tenantId, [{ column: "archived_at", value: null }]),
      readRows(client, "contacts", "id,name,customer_id,facility_id", tenantId, [{ column: "archived_at", value: null }]),
    ]);
    const roleIds = new Set(workRoles.map((row) => row.id));
    const sort = <T extends { label: string }>(rows: T[]) => rows.sort((a, b) => a.label.localeCompare(b.label, "sv"));
    return { canManage: true,
      people: sort(profiles.map((row) => { const roleId = nullable(row.default_work_role_id); return { id: String(row.id), label: bookingPersonLabel(String(row.id), row.label), defaultWorkRoleId: roleId, workRoleIds: roleId && roleIds.has(roleId) ? [roleId] : [] }; })),
      workRoles: sort(workRoles.map((row) => ({ id: String(row.id), label: String(row.display_name) }))),
      jobs: sort(jobs.map((row) => ({ id: String(row.id), label: nullable(row.title) || `Arbetsorder · ${customers.find(customer => customer.id === row.customer_id)?.display_name ?? "Kund"} · ${row.id}`, customerId: String(row.customer_id), facilityId: nullable(row.facility_id), contactId: nullable(row.contact_id) }))),
      customers: sort(customers.map((row) => ({ id: String(row.id), label: String(row.display_name) }))),
      facilities: sort(facilities.map((row) => ({ id: String(row.id), label: String(row.name), customerId: String(row.customer_id) }))),
      contacts: sort(contacts.map((row) => ({ id: String(row.id), label: String(row.name), customerId: String(row.customer_id), facilityId: nullable(row.facility_id) }))), error: null };
  } catch { return emptyOptions(ERROR); }
}
