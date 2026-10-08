export type ScheduleReadRow = {
  readonly weekday?: unknown;
  readonly starts_at?: unknown;
  readonly ends_at?: unknown;
  readonly entry_kind?: unknown;
};

export type ScheduleReadShift = {
  readonly weekday: number;
  readonly start: string;
  readonly end: string;
  readonly breaks: readonly { readonly start: string; readonly end: string }[];
};

function isWeeklyRange(entry: ScheduleReadRow, kind: "weekly_shift" | "weekly_break"): entry is ScheduleReadRow & { readonly weekday: number; readonly starts_at: string; readonly ends_at: string } {
  return entry.entry_kind === kind && typeof entry.weekday === "number" && typeof entry.starts_at === "string" && typeof entry.ends_at === "string";
}

/** Shapes PostgREST rows without assigning a same-weekday break to every split shift. */
export function buildScheduleReadShifts(source: readonly ScheduleReadRow[]): ScheduleReadShift[] {
  const shifts = source.filter((entry) => isWeeklyRange(entry, "weekly_shift"))
    .sort((left, right) => left.weekday - right.weekday || left.starts_at.localeCompare(right.starts_at));
  const breaks = source.filter((entry) => isWeeklyRange(entry, "weekly_break"));
  return shifts.map((shift) => ({
    weekday: shift.weekday,
    start: shift.starts_at,
    end: shift.ends_at,
    breaks: breaks
      .filter((pause) => pause.weekday === shift.weekday && pause.starts_at >= shift.starts_at && pause.ends_at <= shift.ends_at)
      .sort((left, right) => left.starts_at.localeCompare(right.starts_at))
      .map((pause) => ({ start: pause.starts_at, end: pause.ends_at })),
  }));
}
