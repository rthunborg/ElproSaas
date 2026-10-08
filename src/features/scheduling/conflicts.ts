import type { ConflictType, InstantRange, SchedulingBooking, SchedulingConflict, SchedulingFacts, SchedulingPerson } from "./types";
import { activeExistingBookings, bookingRange, dailyCapacity, prepareDailyCapacity, validateSchedulingFacts, type DailyCapacity } from "./capacity";
import { datesForRange, formatUtcInstant, intersectRanges, localDateForInstant, localDayRange, nextLocalDate, subtractRanges } from "./time-zone";

const sortedIds = (values: readonly string[]) => [...new Set(values)].sort();
/** Sole detector: candidate-based, with complete daily demand from frozen facts.
 * Whole-tenant orchestration invokes this over every current booking and dedupes
 * natural keys. No acceptance decisions, clock, filesystem or network occur.
 */
export function detectConflicts(input: SchedulingFacts): SchedulingConflict[] {
  validateSchedulingFacts(input);
  return detectPreparedConflicts(input, { bookings: activeExistingBookings(input), range: bookingRange,
    dates: datesForRange, day: localDayRange, capacity: (person, date) => dailyCapacity(input, person, date) });
}
type ConflictContext = {
  readonly bookings: readonly SchedulingBooking[];
  readonly range: (booking: SchedulingBooking) => InstantRange;
  readonly dates: (range: InstantRange) => readonly string[];
  readonly day: (date: string) => InstantRange;
  readonly capacity: (person: SchedulingPerson, date: string, candidate: SchedulingBooking) => DailyCapacity;
};
/** Complete post-overlay tenant detection through the same rule loop. Validation,
 * temporal normalization and work terms are reused only within this invocation.
 * Cancelled/history facts are still validated before excluding them from demand.
 */
export function detectAllBookingConflicts(input: SchedulingFacts): SchedulingConflict[] {
  validateSchedulingFacts(input);
  const bookings = [...activeExistingBookings(input), input.candidate].filter((booking) => booking.status !== "cancelled");
  const ranges = new Map(bookings.map((booking) => [booking, bookingRange(booking)]));
  const days = new Map<string, InstantRange>();
  const dates = new Map<InstantRange, readonly string[]>();
  const capacities = new Map<SchedulingPerson, Map<string, { prepare: (demand: bigint) => DailyCapacity; demand: bigint }>>();
  const range = (booking: SchedulingBooking) => ranges.get(booking)!;
  const day = (date: string) => {
    if (!days.has(date)) days.set(date, localDayRange(date));
    return days.get(date)!;
  };
  const context: ConflictContext = { bookings, range, day,
    dates: (range) => {
      if (!dates.has(range)) {
        const values: string[] = [];
        for (let date = localDateForInstant(range.start); day(date).start < range.end; date = nextLocalDate(date)) values.push(date);
        dates.set(range, values);
      }
      return dates.get(range)!;
    },
    capacity: (person, date, candidate) => {
      if (!capacities.has(person)) capacities.set(person, new Map());
      const personDays = capacities.get(person)!;
      if (!personDays.has(date)) {
        const window = day(date);
        const demand = bookings.filter((booking) => booking.assigneeIds.includes(person.id)).reduce((total, booking) => {
          const overlap = intersectRanges(range(booking), window);
          return total + (overlap ? overlap.end - overlap.start : BigInt(0));
        }, BigInt(0));
        personDays.set(date, { prepare: prepareDailyCapacity(input, person, date), demand });
      }
      const prepared = personDays.get(date)!;
      const own = intersectRanges(range(candidate), day(date))!;
      return prepared.prepare(prepared.demand - (own.end - own.start));
    },
  };
  const output = new Map<string, SchedulingConflict>();
  for (const candidate of bookings) {
    for (const conflict of detectPreparedConflicts({ ...input, candidate }, context)) output.set(conflict.naturalKey, conflict);
  }
  return [...output.values()].sort((a, b) => a.naturalKey < b.naturalKey ? -1 : a.naturalKey > b.naturalKey ? 1 : 0);
}
function detectPreparedConflicts(input: SchedulingFacts, context: ConflictContext): SchedulingConflict[] {
  if (input.candidate.status === "cancelled") return [];
  const candidate = input.candidate; const range = context.range(candidate);
  const existing = context.bookings; const people = sortedIds(candidate.assigneeIds);
  const output = new Map<string, SchedulingConflict>();
  function emit(type: ConflictType, bookings: readonly string[], persons: readonly string[], window: InstantRange): void {
    if (window.start >= window.end) return;
    const bookingIds = sortedIds(bookings); const affectedPersonIds = sortedIds(persons);
    if (!affectedPersonIds.length) return;
    const startsAt = formatUtcInstant(window.start); const endsAt = formatUtcInstant(window.end);
    // Structured encoding prevents delimiter ambiguity. Workflow identity excludes
    // config version: an identical type/participants/window retains acceptance.
    const naturalKey = JSON.stringify([type, bookingIds, affectedPersonIds, startsAt, endsAt]);
    output.set(naturalKey, { naturalKey, conflictType: type, bookingIds, affectedPersonIds, startsAt, endsAt });
  }
  for (const peer of existing) {
    if (peer.id === candidate.id) continue;
    const overlap = intersectRanges(range, context.range(peer)); if (!overlap) continue;
    for (const id of people.filter((id) => peer.assigneeIds.includes(id))) emit("double_booking", [candidate.id, peer.id], [id], overlap);
  }
  for (const id of people) {
    const person = input.people.find((person) => person.id === id)!;
    const allowed: InstantRange[] = [];
    for (const date of context.dates(range)) {
      const capacity = context.capacity(person, date, candidate); allowed.push(...capacity.workWindows);
      const day = context.day(date); const candidateDay = intersectRanges(range, day)!;
      if (candidateDay.end - candidateDay.start > capacity.availableMicroseconds) {
        const participants = [candidate.id, ...existing.filter((booking) => booking.id !== candidate.id && booking.assigneeIds.includes(id) && intersectRanges(context.range(booking), day)).map((booking) => booking.id)];
        emit("over_capacity", participants, [id], day);
      }
    }
    for (const outside of subtractRanges([range], allowed)) emit("outside_work_hours", [candidate.id], [id], outside);
    const required = input.jobInputs?.requiredWorkRoleIds;
    if (required?.some((role) => !person.workRoleIds?.includes(role))) emit("competence_missing", [candidate.id], [id], range);
  }
  if (input.jobInputs?.accessWindows !== undefined) {
    for (const outside of subtractRanges([range], input.jobInputs.accessWindows.map(bookingRange))) emit("outside_access_window", [candidate.id], people, outside);
  }
  return [...output.values()].sort((a, b) => a.naturalKey < b.naturalKey ? -1 : a.naturalKey > b.naturalKey ? 1 : 0);
}
