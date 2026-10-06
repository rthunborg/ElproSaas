import type { ConflictType, InstantRange, SchedulingConflict, SchedulingFacts } from "./types";
import { activeExistingBookings, bookingRange, dailyCapacity, validateSchedulingFacts } from "./capacity";
import { datesForRange, formatUtcInstant, intersectRanges, localDayRange, subtractRanges } from "./time-zone";

const sortedIds = (values: readonly string[]) => [...new Set(values)].sort();
/** Sole detector: candidate-based, with complete daily demand from frozen facts.
 * Whole-tenant orchestration invokes this over every current booking and dedupes
 * natural keys. No acceptance decisions, clock, filesystem or network occur.
 */
export function detectConflicts(input: SchedulingFacts): SchedulingConflict[] {
  validateSchedulingFacts(input);
  if (input.candidate.status === "cancelled") return [];
  const candidate = input.candidate; const range = bookingRange(candidate);
  const existing = activeExistingBookings(input); const people = sortedIds(candidate.assigneeIds);
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
    const overlap = intersectRanges(range, bookingRange(peer)); if (!overlap) continue;
    for (const id of people.filter((id) => peer.assigneeIds.includes(id))) emit("double_booking", [candidate.id, peer.id], [id], overlap);
  }
  for (const id of people) {
    const person = input.people.find((person) => person.id === id)!;
    const allowed: InstantRange[] = [];
    for (const date of datesForRange(range)) {
      const capacity = dailyCapacity(input, person, date); allowed.push(...capacity.workWindows);
      const day = localDayRange(date); const candidateDay = intersectRanges(range, day)!;
      if (candidateDay.end - candidateDay.start > capacity.availableMicroseconds) {
        const participants = [candidate.id, ...existing.filter((booking) => booking.assigneeIds.includes(id) && intersectRanges(bookingRange(booking), day)).map((booking) => booking.id)];
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
