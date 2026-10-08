import type { WorkShift } from "../resources/work-hours";

/** Frozen, authoritative facts only. No workflow acceptance or inferred job data. */
export type SchedulingBooking = {
  readonly id: string; readonly startsAt: string; readonly endsAt: string;
  readonly allDay: boolean; readonly status: "planned" | "cancelled"; readonly assigneeIds: readonly string[];
};
export type SchedulingPerson = {
  readonly id: string; readonly employmentPercentage: number; readonly shifts: readonly WorkShift[];
  readonly exceptions: readonly { readonly kind: string; readonly date: string; readonly start?: string; readonly end?: string }[];
  readonly workRoleIds?: readonly string[];
};
export type SchedulingRules = {
  readonly version: string; readonly timeZone: "Europe/Stockholm";
  readonly planningBufferMinutes: number; readonly acknowledgmentThresholdMinutes: number;
  readonly authorizedOvertime: readonly { readonly personId: string; readonly startsAt: string; readonly endsAt: string }[];
};
export const SCHEDULING_RULES_VERSION = "stockholm-capacity-v1";
export const DEFAULT_SCHEDULING_RULES: SchedulingRules = Object.freeze({
  version: SCHEDULING_RULES_VERSION, timeZone: "Europe/Stockholm", planningBufferMinutes: 0,
  acknowledgmentThresholdMinutes: 60, authorizedOvertime: Object.freeze([]),
});
export type SchedulingFacts = {
  readonly candidate: SchedulingBooking; readonly existingBookings: readonly SchedulingBooking[];
  readonly people: readonly SchedulingPerson[];
  readonly calendarDays: readonly { readonly date: string; readonly variant: string; readonly reductionPercent?: number }[];
  /** null and absent optional fields mean unavailable, never verified compliance. */
  readonly jobInputs: null | { readonly accessWindows?: readonly { readonly startsAt: string; readonly endsAt: string }[]; readonly requiredWorkRoleIds?: readonly string[] };
  readonly rules: SchedulingRules;
};
export type ConflictType = "double_booking" | "over_capacity" | "outside_work_hours" | "outside_access_window" | "competence_missing";
export type SchedulingConflict = {
  readonly naturalKey: string; readonly conflictType: ConflictType; readonly bookingIds: readonly string[];
  readonly affectedPersonIds: readonly string[]; readonly startsAt: string; readonly endsAt: string;
};
export type CapacityTerms = {
  readonly scheduledMinutes: number; readonly holidayClosedMinutes: number; readonly absenceMinutes: number;
  readonly existingBookingMinutes: number; readonly blockedMinutes: number; readonly bufferMinutes: number; readonly availableMinutes: number;
};
export type InstantRange = { readonly start: bigint; readonly end: bigint };
