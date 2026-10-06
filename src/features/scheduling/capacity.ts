import { validateWorkHoursInput } from "../resources/work-hours";
import { validateCapacityInputs } from "../resources/capacity-inputs";
import type { CapacityTerms, InstantRange, SchedulingBooking, SchedulingFacts, SchedulingPerson } from "./types";
import { isSwedishPublicHoliday } from "./swedish-holidays";
import { intersectRanges, localDayRange, parseUtcInstant, stockholmLocalToUtc, subtractRanges, unionRanges, validateLocalDate, weekdayForDate } from "./time-zone";

const MINUTE = BigInt(60000000);
const duration = (ranges: readonly InstantRange[]) => ranges.reduce((total, range) => total + range.end - range.start, BigInt(0));
const minutes = (microseconds: bigint) => Number(microseconds) / Number(MINUTE);
export function bookingRange(booking: Pick<SchedulingBooking, "startsAt" | "endsAt">): InstantRange {
  const range = { start: parseUtcInstant(booking.startsAt), end: parseUtcInstant(booking.endsAt) };
  if (range.start >= range.end) throw new Error("Scheduling range must be positive");
  return range;
}
function validateIds(ids: readonly string[]): void {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !id)) throw new Error("Invalid scheduling participants");
}
/** Fail loud instead of treating malformed required facts as empty availability. */
export function validateSchedulingFacts(input: SchedulingFacts): void {
  if (!input || !Array.isArray(input.people) || !Array.isArray(input.existingBookings) || !Array.isArray(input.calendarDays)) throw new Error("Invalid scheduling facts");
  const rules = input.rules;
  if (!rules || typeof rules.version !== "string" || !rules.version || rules.timeZone !== "Europe/Stockholm" || !Number.isFinite(rules.planningBufferMinutes) || rules.planningBufferMinutes < 0 || !Number.isSafeInteger(rules.planningBufferMinutes * 60000000) || !Number.isFinite(rules.acknowledgmentThresholdMinutes) || rules.acknowledgmentThresholdMinutes < 0 || !Array.isArray(rules.authorizedOvertime)) throw new Error("Invalid scheduling rules");
  const people = new Set<string>();
  for (const person of input.people) {
    if (!person.id || people.has(person.id) || !Number.isInteger(person.employmentPercentage) || !validateWorkHoursInput(person).ok || !Array.isArray(person.exceptions) || !validateCapacityInputs({ exceptions: person.exceptions }).ok) throw new Error("Invalid scheduling person");
    people.add(person.id); if (person.workRoleIds !== undefined) validateIds(person.workRoleIds);
    for (const exception of person.exceptions) validateLocalDate(exception.date);
  }
  const seen = new Map<string, string>();
  for (const booking of [input.candidate, ...input.existingBookings]) {
    if (!booking?.id || !["planned", "cancelled"].includes(booking.status) || typeof booking.allDay !== "boolean") throw new Error("Invalid scheduling booking");
    bookingRange(booking); validateIds(booking.assigneeIds);
    if (booking.assigneeIds.some((id: string) => !people.has(id))) throw new Error("Missing scheduling person");
    // The candidate deliberately replaces its prior state; all other IDs must agree.
    if (booking.id !== input.candidate.id) {
      const canonical = JSON.stringify([parseUtcInstant(booking.startsAt).toString(), parseUtcInstant(booking.endsAt).toString(), booking.allDay, booking.status, [...new Set(booking.assigneeIds)].sort()]);
      if (seen.has(booking.id) && seen.get(booking.id) !== canonical) throw new Error("Contradictory scheduling booking");
      seen.set(booking.id, canonical);
    }
  }
  const calendar = new Set<string>();
  for (const day of input.calendarDays) {
    if (!validateCapacityInputs({ calendarDay: day }).ok || calendar.has(day.date)) throw new Error("Invalid scheduling calendar");
    validateLocalDate(day.date); calendar.add(day.date);
  }
  for (const overtime of rules.authorizedOvertime) { if (!people.has(overtime.personId)) throw new Error("Missing overtime person"); bookingRange(overtime); }
  if (input.jobInputs !== null) {
    if (!input.jobInputs || typeof input.jobInputs !== "object") throw new Error("Invalid optional job facts");
    if (input.jobInputs.accessWindows !== undefined) {
      if (!Array.isArray(input.jobInputs.accessWindows)) throw new Error("Invalid access windows");
      for (const window of input.jobInputs.accessWindows) bookingRange(window);
    }
    if (input.jobInputs.requiredWorkRoleIds !== undefined) validateIds(input.jobInputs.requiredWorkRoleIds);
  }
}
export function activeExistingBookings(input: SchedulingFacts): SchedulingBooking[] {
  return [...new Map(input.existingBookings.filter((booking) => booking.id !== input.candidate.id && booking.status !== "cancelled").map((booking) => [booking.id, booking])).values()];
}
function localRange(date: string, start: string, end: string): InstantRange | null {
  const timed = (time: string) => `${date}T${time.length === 5 ? `${time}:00` : time}`;
  const range = { start: parseUtcInstant(stockholmLocalToUtc(timed(start))), end: parseUtcInstant(stockholmLocalToUtc(timed(end))) };
  // Both ends inside a gap can collapse to its first valid instant.
  return range.start < range.end ? range : null;
}
export type DailyCapacity = {
  readonly terms: CapacityTerms; readonly workWindows: readonly InstantRange[]; readonly availableMicroseconds: bigint;
};
/** Exact UTC intervals; numerical reductions never manufacture unavailable windows.
 * Overlapping layers charge in order: closure, absence, blocked, then reduction
 * on remaining working time. Explicit overtime adds only its distinct interval.
 * Demand is additive (not unioned), distinct from blocked calendar intervals.
 */
export function dailyCapacity(input: SchedulingFacts, person: SchedulingPerson, date: string): DailyCapacity {
  const day = localDayRange(date);
  const ordinary = unionRanges(person.shifts.filter((shift) => shift.weekday === weekdayForDate(date)).flatMap((shift) => {
    const range = localRange(date, shift.start, shift.end); if (!range) return [];
    const breaks = shift.breaks.flatMap((pause) => { const range = localRange(date, pause.start, pause.end); return range ? [range] : []; });
    return subtractRanges([range], breaks);
  }));
  const overtime = unionRanges(input.rules.authorizedOvertime.filter((window) => window.personId === person.id).flatMap((window) => { const clipped = intersectRanges(bookingRange(window), day); return clipped ? [clipped] : []; }));
  const scheduled = unionRanges([...ordinary, ...overtime]);
  const calendar = input.calendarDays.find((entry) => entry.date === date);
  const closed = isSwedishPublicHoliday(date) || calendar?.variant === "closed";
  let work = closed ? overtime : scheduled;
  const closedMicros = duration(scheduled) - duration(work);
  const exceptions = (blocked: boolean) => person.exceptions.filter((exception) => exception.date === date && (exception.kind === "blocked_time") === blocked).flatMap((exception) => {
    if (!exception.start) return [day]; const range = localRange(date, exception.start, exception.end!); return range ? [range] : [];
  });
  const afterAbsence = subtractRanges(work, exceptions(false)); const absenceMicros = duration(work) - duration(afterAbsence);
  work = subtractRanges(afterAbsence, exceptions(true)); const blockedMicros = duration(afterAbsence) - duration(work);
  // Percent rules can produce sub-microsecond budgets. Keep hundredths of a
  // microsecond until comparison/terms, rather than silently rounding away loss.
  const reductionHundredths = calendar?.variant === "reduced_capacity" ? duration(work) * BigInt(calendar.reductionPercent!) : BigInt(0);
  const demand = activeExistingBookings(input).filter((booking) => booking.assigneeIds.includes(person.id)).reduce((total, booking) => {
    const overlap = intersectRanges(bookingRange(booking), day); return total + (overlap ? overlap.end - overlap.start : BigInt(0));
  }, BigInt(0));
  const buffer = BigInt(input.rules.planningBufferMinutes * 60000000);
  const availableHundredths = (duration(work) - demand - buffer) * BigInt(100) - reductionHundredths;
  // Demand is whole microseconds: comparison to the floored positive budget is
  // exact. Negative budgets always warn for any positive candidate duration.
  return { workWindows: work, availableMicroseconds: availableHundredths / BigInt(100), terms: {
    scheduledMinutes: minutes(duration(scheduled)), holidayClosedMinutes: Number(closedMicros * BigInt(100) + reductionHundredths) / 6000000000,
    absenceMinutes: minutes(absenceMicros), existingBookingMinutes: minutes(demand), blockedMinutes: minutes(blockedMicros),
    bufferMinutes: minutes(buffer), availableMinutes: Number(availableHundredths) / 6000000000,
  } };
}
/** Available capacity excludes the candidate and its old version. Can be negative. */
export function calculateCapacity(input: SchedulingFacts, personId: string, date: string): CapacityTerms {
  validateSchedulingFacts(input); validateLocalDate(date);
  const person = input.people.find((person) => person.id === personId); if (!person) throw new Error("Missing scheduling person");
  return dailyCapacity(input, person, date).terms;
}
