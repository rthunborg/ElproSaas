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

/**
 * Keeps stored, non-rendered shifts and breaks when the compact form edits its
 * first visible interval. A fully blank schedule remains an explicit clear.
 */
export function mergeRenderedSchedule(submitted: readonly WorkShift[], rawStored: unknown): readonly WorkShift[] {
  if (submitted.length === 0) return [];
  if (!Array.isArray(rawStored)) return submitted;
  const stored = rawStored.map(parseStoredShift).filter((shift): shift is WorkShift => shift !== null);
  if (!validateWorkHoursInput({ shifts: stored }).ok) return submitted;

  return submitted.flatMap((shift) => {
    const sameDay = stored.filter((candidate) => candidate.weekday === shift.weekday);
    const first = sameDay[0];
    if (!first) return [shift];
    const retainedBreaks = first.breaks.slice(1);
    const breaks = shift.breaks.length === 0 ? retainedBreaks : [shift.breaks[0]!, ...retainedBreaks];
    return [{ ...shift, breaks }, ...sameDay.slice(1)];
  });
}
