/** Actual engine contracts with mutable fixture builders, never test detectors. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { CapacityTerms, SchedulingBooking, SchedulingConflict, SchedulingFacts, SchedulingPerson } from "../../src/features/scheduling/types";
export const PERSON = "10000000-0000-4000-8000-000000000001";
export const OTHER = "10000000-0000-4000-8000-000000000002";
export const THIRD = "10000000-0000-4000-8000-000000000003";
export const BOOKING = "20000000-0000-4000-8000-000000000001";
export const PEER = "20000000-0000-4000-8000-000000000002";
export const ROLE = "30000000-0000-4000-8000-000000000001";
type Mutable<T> = T extends object ? { -readonly [Key in keyof T]: Mutable<T[Key]> } : T;
export type Booking = Mutable<SchedulingBooking>;
export type Person = Mutable<SchedulingPerson>;
export type Facts = Mutable<SchedulingFacts>;
export type Conflict = SchedulingConflict;
export type Terms = CapacityTerms;
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
  const provider = await import(path) as { detectConflicts?: (input: Facts) => Conflict[] };
  assert.equal(typeof provider.detectConflicts, "function", "Sole actual detector export exists");
  return provider.detectConflicts!;
}
export async function capacity() {
  const path = new URL("../../src/features/scheduling/capacity.ts", import.meta.url).href;
  const provider = await import(path) as { calculateCapacity?: (input: Facts, personId: string, date: string) => Terms };
  assert.equal(typeof provider.calculateCapacity, "function", "Actual calendar helper export exists");
  return provider.calculateCapacity!;
}
export async function localTime() {
  const path = new URL("../../src/features/scheduling/time-zone.ts", import.meta.url).href;
  const provider = await import(path) as { stockholmLocalToUtc?: (local: string) => string };
  assert.equal(typeof provider.stockholmLocalToUtc, "function", "Actual gap/fold helper export exists");
  return provider.stockholmLocalToUtc!;
}
