import { validateWorkHoursInput, type WorkShift } from "./work-hours";

function parseStoredShift(value: unknown): WorkShift | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { weekday?: unknown; start?: unknown; end?: unknown; breaks?: unknown };
  if (!Array.isArray(candidate.breaks)) return null;
  const breaks = candidate.breaks.map((pause) => {
    if (!pause || typeof pause !== "object") return null;
    const item = pause as { start?: unknown; end?: unknown };
    return typeof item.start === "string" && typeof item.end === "string" ? { start: item.start, end: item.end } : null;
  });
  if (breaks.some((pause) => pause === null) || !Number.isInteger(candidate.weekday) || typeof candidate.start !== "string" || typeof candidate.end !== "string") return null;
  return { weekday: candidate.weekday as number, start: candidate.start, end: candidate.end, breaks: breaks as { start: string; end: string }[] };
}

function renderedTime(value: string): string { return value.slice(0, 5); }

function matchesRenderedFirstShift(submitted: WorkShift, stored: WorkShift): boolean {
  if (renderedTime(submitted.start) !== renderedTime(stored.start) || renderedTime(submitted.end) !== renderedTime(stored.end)) return false;
  if (stored.breaks.length === 0) return submitted.breaks.length === 0;
  return submitted.breaks.length === 1
    && renderedTime(submitted.breaks[0]!.start) === renderedTime(stored.breaks[0]!.start)
    && renderedTime(submitted.breaks[0]!.end) === renderedTime(stored.breaks[0]!.end);
}

/**
 * Keeps stored, non-rendered shifts and breaks when the compact form edits its
 * first visible interval. A fully blank schedule remains an explicit clear.
 */
export function mergeRenderedSchedule(submitted: readonly WorkShift[], rawStored: unknown): readonly WorkShift[] | null {
  if (submitted.length === 0) return [];
  if (!Array.isArray(rawStored)) return submitted;
  const parsed = rawStored.map(parseStoredShift);
  if (parsed.some((shift) => shift === null)) return null;
  const stored = (parsed as WorkShift[]).toSorted((left, right) => left.weekday - right.weekday || left.start.localeCompare(right.start));
  if (!validateWorkHoursInput({ shifts: stored }).ok) return null;

  const merged = submitted.flatMap((shift) => {
    const sameDay = stored.filter((candidate) => candidate.weekday === shift.weekday);
    const first = sameDay[0];
    if (!first) return [shift];
    if (matchesRenderedFirstShift(shift, first)) return [first, ...sameDay.slice(1)];
    const retainedBreaks = first.breaks.slice(1);
    const breaks = shift.breaks.length === 0 ? retainedBreaks : [shift.breaks[0]!, ...retainedBreaks];
    return [{ ...shift, breaks }, ...sameDay.slice(1)];
  });
  const submittedDays = new Set(submitted.map((shift) => shift.weekday));
  const firstStoredDay = new Set<number>();
  const retainedHiddenShifts = stored.filter((shift) => {
    const firstForDay = !firstStoredDay.has(shift.weekday);
    firstStoredDay.add(shift.weekday);
    return !firstForDay && !submittedDays.has(shift.weekday);
  });
  return [...merged, ...retainedHiddenShifts].toSorted((left, right) => left.weekday - right.weekday || left.start.localeCompare(right.start));
}
