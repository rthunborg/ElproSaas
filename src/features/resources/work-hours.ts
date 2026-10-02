export type TimeRange = { readonly start: string; readonly end: string };
export type WorkShift = TimeRange & { readonly weekday: number; readonly breaks: readonly TimeRange[] };
export type WorkHoursInput = { readonly employmentPercentage?: number; readonly shifts: readonly WorkShift[] };
export type WorkHoursValidation = { readonly ok: true; readonly data: WorkHoursInput } | { readonly ok: false };

const TIME = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/;

/** PostgreSQL `time` read models may include seconds and microseconds. */
export function isStoredTime(value: string): boolean { return TIME.test(value); }

export function minutesForTime(time: string): number {
  const [hours, minutes, secondsWithFraction = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes) + Number(secondsWithFraction) / 60;
}

const validRange = (range: TimeRange) => isStoredTime(range.start) && isStoredTime(range.end) && minutesForTime(range.start) < minutesForTime(range.end);

/** Validates stored schedule inputs; employment percentage is descriptive and never produces shifts. */
export function validateWorkHoursInput(raw: unknown): WorkHoursValidation {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { shifts?: unknown }).shifts)) return { ok: false };
  const input = raw as WorkHoursInput;
  if (input.employmentPercentage !== undefined && (!Number.isInteger(input.employmentPercentage) || input.employmentPercentage < 1 || input.employmentPercentage > 100)) return { ok: false };
  const byDay = new Map<number, TimeRange[]>();
  for (const shift of input.shifts) {
    if (!Number.isInteger(shift.weekday) || shift.weekday < 1 || shift.weekday > 7 || !validRange(shift) || !Array.isArray(shift.breaks)) return { ok: false };
    const breaks = [...shift.breaks].sort((a, b) => minutesForTime(a.start) - minutesForTime(b.start));
    for (const [index, pause] of breaks.entries()) {
      if (!validRange(pause) || minutesForTime(pause.start) < minutesForTime(shift.start) || minutesForTime(pause.end) > minutesForTime(shift.end)) return { ok: false };
      if (index > 0 && minutesForTime(pause.start) < minutesForTime(breaks[index - 1]!.end)) return { ok: false };
    }
    const all = [...(byDay.get(shift.weekday) ?? []), { start: shift.start, end: shift.end }].sort((a, b) => minutesForTime(a.start) - minutesForTime(b.start));
    if (all.some((range, index) => index > 0 && minutesForTime(range.start) < minutesForTime(all[index - 1]!.end))) return { ok: false };
    byDay.set(shift.weekday, all);
  }
  return { ok: true, data: input };
}

/** Derives only the actual template minutes, preserving daily shape for later capacity code. */
export function scheduledAvailabilityForTemplate(raw: unknown): readonly { readonly weekday: number; readonly scheduledMinutes: number }[] {
  const result = validateWorkHoursInput(raw);
  if (!result.ok) return [];
  return result.data.shifts.map((shift) => ({ weekday: shift.weekday, scheduledMinutes: minutesForTime(shift.end) - minutesForTime(shift.start) - shift.breaks.reduce((total, pause) => total + minutesForTime(pause.end) - minutesForTime(pause.start), 0) }));
}

export const EIGHTY_PERCENT_EXAMPLES = {
  fourFullDays: [{ weekday: 1, start: "07:00", end: "16:00", breaks: [] }, { weekday: 2, start: "07:00", end: "16:00", breaks: [] }, { weekday: 3, start: "07:00", end: "16:00", breaks: [] }, { weekday: 4, start: "07:00", end: "16:00", breaks: [] }],
  fiveShortDays: [{ weekday: 1, start: "07:00", end: "14:12", breaks: [] }, { weekday: 2, start: "07:00", end: "14:12", breaks: [] }, { weekday: 3, start: "07:00", end: "14:12", breaks: [] }, { weekday: 4, start: "07:00", end: "14:12", breaks: [] }, { weekday: 5, start: "07:00", end: "14:12", breaks: [] }],
} as const;
