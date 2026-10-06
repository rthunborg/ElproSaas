import type { BookingFacts, CreateBookingInput, UpdateBookingInput } from "@/features/resources/booking-types";
import type { ValidationResult } from "../envelope-core";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INSTANT = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const CONNECTIONS = ["workRoleId", "jobId", "customerId", "facilityId", "contactId"] as const;
const FIELDS = ["commandId", "startsAt", "endsAt", "allDay", ...CONNECTIONS, "description", "status", "assigneeIds", "seriesId", "occurrenceIndex", "isException"];
const stockholmClock = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
function normalizedUuid(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : null;
}
function normalizedInstant(value: unknown): string | null {
  if (typeof value !== "string" || !INSTANT.test(value)) return null;
  // Reject rolled calendar dates such as February 30 before Date.parse normalizes them.
  const date = value.slice(0, 10);
  const calendar = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== date) return null;
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return null;
  // Date resolves offsets at millisecond precision; preserve the remaining three
  // fractional digits explicitly so PostgreSQL microseconds are never rounded.
  const micros = (value.match(/\.(\d{1,6})(?:Z|[+-])/)?.[1] ?? "").padEnd(6, "0");
  const utc = instant.toISOString();
  if (!/^\d{4}-/.test(utc)) return null;
  return utc.replace(/\.\d{3}Z$/, `.${micros}Z`);
}
function validate(raw: unknown, update: boolean): ValidationResult<CreateBookingInput | UpdateBookingInput> {
  const invalid = { ok: false, code: "VALIDATION_FAILED" } as const;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return invalid;
  const value = raw as Record<string, unknown>;
  const allowed = new Set(update ? [...FIELDS, "bookingId"] : FIELDS);
  if (Object.keys(value).some((key) => !allowed.has(key))) return invalid;
  const commandId = normalizedUuid(value.commandId);
  const bookingId = update ? normalizedUuid(value.bookingId) : null;
  const startsAt = normalizedInstant(value.startsAt);
  const endsAt = normalizedInstant(value.endsAt);
  if (!commandId || (update && !bookingId) || !startsAt || !endsAt || endsAt <= startsAt) return invalid;
  if (value.allDay !== undefined && typeof value.allDay !== "boolean") return invalid;
  const allDay = value.allDay ?? false;
  if (allDay && [startsAt, endsAt].some((instant) => stockholmClock.format(new Date(instant)) !== "00:00:00" || !instant.endsWith(".000000Z"))) return invalid;
  if ((value.seriesId !== undefined && value.seriesId !== null) || (value.occurrenceIndex !== undefined && value.occurrenceIndex !== null) || (value.isException !== undefined && value.isException !== false)) return invalid;
  if (!Array.isArray(value.assigneeIds) || value.assigneeIds.length === 0) return invalid;
  const assigneeIds = value.assigneeIds.map(normalizedUuid);
  if (assigneeIds.some((id) => id === null) || new Set(assigneeIds).size !== assigneeIds.length) return invalid;
  const connections: Record<string, string | null> = {};
  for (const key of CONNECTIONS) {
    const supplied = value[key];
    const normalized = supplied === undefined || supplied === null ? null : normalizedUuid(supplied);
    if (supplied !== undefined && supplied !== null && normalized === null) return invalid;
    connections[key] = normalized;
  }
  if (value.description !== undefined && (typeof value.description !== "string" || [...value.description].length > 4000)) return invalid;
  if (value.status !== undefined && value.status !== "planned" && value.status !== "cancelled") return invalid;
  const facts: BookingFacts = { startsAt, endsAt, allDay: allDay as boolean,
    workRoleId: connections.workRoleId, jobId: connections.jobId, customerId: connections.customerId,
    facilityId: connections.facilityId, contactId: connections.contactId,
    description: value.description as string | undefined ?? "", status: value.status as BookingFacts["status"] | undefined ?? "planned",
    assigneeIds: (assigneeIds as string[]).sort(), seriesId: null, occurrenceIndex: null, isException: false };
  return { ok: true, data: { ...facts, commandId, ...(bookingId ? { bookingId } : {}) } };
}
export function validateCreateBooking(raw: unknown): ValidationResult<CreateBookingInput> {
  return validate(raw, false) as ValidationResult<CreateBookingInput>;
}
export function validateUpdateBooking(raw: unknown): ValidationResult<UpdateBookingInput> {
  return validate(raw, true) as ValidationResult<UpdateBookingInput>;
}
/** Stable pure identity used by callers/tests; SQL independently rebuilds its digest. */
export function canonicalBookingPayload(input: CreateBookingInput | UpdateBookingInput): string {
  return JSON.stringify({ operation: "bookingId" in input ? "update" : "create", bookingId: "bookingId" in input ? input.bookingId : null, payload: bookingPayload(input) });
}
export function bookingPayload(input: CreateBookingInput | UpdateBookingInput): BookingFacts {
  const { startsAt, endsAt, allDay, workRoleId, jobId, customerId, facilityId, contactId, description, status, assigneeIds, seriesId, occurrenceIndex, isException } = input;
  return { startsAt, endsAt, allDay, workRoleId, jobId, customerId, facilityId, contactId, description, status, assigneeIds, seriesId, occurrenceIndex, isException };
}
