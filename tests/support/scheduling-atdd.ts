/** Provisional ATDD source contracts: align actual typed exports before activation.
 * Helpers contain data/fail-loud imports only, never detector implementations.
 * Preserve every expected domain assertion when changing provider bindings.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
export const PERSON = "10000000-0000-4000-8000-000000000001";
export const OTHER = "10000000-0000-4000-8000-000000000002";
export const THIRD = "10000000-0000-4000-8000-000000000003";
export const BOOKING = "20000000-0000-4000-8000-000000000001";
export const PEER = "20000000-0000-4000-8000-000000000002";
export const ROLE = "30000000-0000-4000-8000-000000000001";
export type Booking = { id: string; startsAt: string; endsAt: string; allDay: boolean;
  status: "planned" | "cancelled"; assigneeIds: string[] };
export type Person = { id: string; employmentPercentage: number;
  shifts: { weekday: number; start: string; end: string; breaks: { start: string; end: string }[] }[];
  exceptions: { kind: string; date: string; start?: string; end?: string }[]; workRoleIds?: string[] };
export type Facts = { candidate: Booking; existingBookings: Booking[]; people: Person[];
  calendarDays: { date: string; variant: string; reductionPercent?: number }[];
  jobInputs: null | { accessWindows?: { startsAt: string; endsAt: string }[]; requiredWorkRoleIds?: string[] };
  rules: { version: string; timeZone: "Europe/Stockholm"; planningBufferMinutes: number;
    acknowledgmentThresholdMinutes: number; authorizedOvertime: { personId: string; startsAt: string; endsAt: string }[] } };
export type Conflict = { naturalKey: string; conflictType: string; bookingIds: string[];
  affectedPersonIds: string[]; startsAt: string; endsAt: string };
export type Terms = { scheduledMinutes: number; holidayClosedMinutes: number; absenceMinutes: number;
  existingBookingMinutes: number; blockedMinutes: number; bufferMinutes: number; availableMinutes: number };
export function candidate(patch: Partial<Booking> = {}): Booking {
  return { id: BOOKING, startsAt: "2026-10-12T08:00:00.000000Z", endsAt: "2026-10-12T09:00:00.000000Z",
    allDay: false, status: "planned", assigneeIds: [PERSON], ...patch };
}
export function facts(patch: Partial<Facts> = {}): Facts {
  return { candidate: candidate(), existingBookings: [], people: [{ id: PERSON, employmentPercentage: 100,
    shifts: Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, start: "07:00", end: "17:00", breaks: [] })), exceptions: [] }],
    calendarDays: [], jobInputs: null, rules: { version: "new-expected-v1", timeZone: "Europe/Stockholm",
      planningBufferMinutes: 0, acknowledgmentThresholdMinutes: 60, authorizedOvertime: [] }, ...patch };
}
export function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export async function golden<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(new URL(`../fixtures/golden/scheduling/${name}.json`, import.meta.url), "utf8")) as T;
}
export type Scenario = { name: string; input: Facts; expected: Omit<Conflict, "naturalKey">[] };
/** Only the opaque identity is omitted; tests independently assert stability/uniqueness. */
export function domain(rows: readonly Conflict[]) {
  return rows.map(({ naturalKey, ...fields }) => { assert.ok(naturalKey); return fields; });
}
export async function engine() {
  const path = new URL("../../src/features/scheduling/conflicts.ts", import.meta.url).href;
  const module = await import(path) as { detectConflicts?: (input: Facts) => Conflict[] };
  assert.equal(typeof module.detectConflicts, "function", "Bind sole actual detector export before activation");
  return module.detectConflicts!;
}
export async function capacity() {
  const path = new URL("../../src/features/scheduling/capacity.ts", import.meta.url).href;
  const module = await import(path) as { calculateCapacity?: (input: Facts, personId: string, date: string) => Terms };
  assert.equal(typeof module.calculateCapacity, "function", "Bind actual calendar helper before activation");
  return module.calculateCapacity!;
}
export async function localTime() {
  const path = new URL("../../src/features/scheduling/time-zone.ts", import.meta.url).href;
  const module = await import(path) as { stockholmLocalToUtc?: (local: string) => string };
  assert.equal(typeof module.stockholmLocalToUtc, "function", "Bind actual gap/fold helper before activation");
  return module.stockholmLocalToUtc!;
}
