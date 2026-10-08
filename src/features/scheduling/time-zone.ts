import type { InstantRange } from "./types";

const THOUSAND = BigInt(1000);
const MINUTE = BigInt(60000000);
const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Stockholm", calendar: "gregory", numberingSystem: "latn", hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

export function validateLocalDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith("0000") || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error("Invalid scheduling date");
}
export function nextLocalDate(date: string): string {
  validateLocalDate(date);
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
}
export function weekdayForDate(date: string): number {
  validateLocalDate(date); return new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
}

/** Parse offsets and fractions separately: Date never receives authoritative fractions. */
export function parseUtcInstant(value: string): bigint {
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,6}))?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (!match) throw new Error("Invalid scheduling instant");
  validateLocalDate(match[1]!);
  const millis = Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4]}${match[6]}`);
  if (!Number.isFinite(millis)) throw new Error("Invalid scheduling instant");
  return BigInt(millis) * THOUSAND + BigInt((match[5] ?? "").padEnd(6, "0"));
}
export function formatUtcInstant(instant: bigint): string {
  const seconds = instant >= BigInt(0) ? instant / BigInt(1000000) : (instant - BigInt(999999)) / BigInt(1000000);
  const fraction = instant - seconds * BigInt(1000000);
  return `${new Date(Number(seconds) * 1000).toISOString().slice(0, 19)}.${fraction.toString().padStart(6, "0")}Z`;
}
function localParts(millis: number): string {
  const parts = Object.fromEntries(formatter.formatToParts(new Date(millis)).map((part) => [part.type, part.value]));
  return `${parts.year!.padStart(4, "0")}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
function offsetAt(millis: number): number {
  const wholeSecond = Math.floor(millis / 1000) * 1000;
  return Date.parse(`${localParts(wholeSecond)}Z`) - wholeSecond;
}

/** Gap => transition's first valid instant; fold => earliest matching instant. */
export function stockholmLocalToUtc(local: string): string {
  const match = /^(\d{4}-\d{2}-\d{2}T[0-2]\d:[0-5]\d:[0-5]\d)(?:\.(\d{1,6}))?$/.exec(local);
  if (!match || Number(local.slice(11, 13)) > 23) throw new Error("Invalid Stockholm local time");
  validateLocalDate(local.slice(0, 10));
  const wall = Date.parse(`${match[1]}Z`);
  const offsets = [...new Set([-172800000, 0, 172800000].map((delta) => offsetAt(wall + delta)))];
  const matches = offsets.map((offset) => wall - offset).filter((millis) => localParts(millis) === match[1]).sort((a, b) => a - b);
  if (matches.length) return formatUtcInstant(BigInt(matches[0]!) * THOUSAND + BigInt((match[2] ?? "").padEnd(6, "0")));
  const candidates = offsets.map((offset) => wall - offset).sort((a, b) => a - b);
  let low = candidates[0]!; let high = candidates[candidates.length - 1]!;
  const before = offsetAt(low);
  if (low === high || before === offsetAt(high)) throw new Error("Unresolvable Stockholm local time");
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (offsetAt(middle) === before) low = middle; else high = middle;
  }
  return formatUtcInstant(BigInt(high) * THOUSAND);
}
export function localDateForInstant(instant: bigint): string {
  const millis = instant >= BigInt(0) ? instant / THOUSAND : (instant - BigInt(999)) / THOUSAND;
  return localParts(Number(millis)).slice(0, 10);
}
export function localDayRange(date: string): InstantRange {
  return { start: parseUtcInstant(stockholmLocalToUtc(`${date}T00:00:00`)), end: parseUtcInstant(stockholmLocalToUtc(`${nextLocalDate(date)}T00:00:00`)) };
}
export function datesForRange(range: InstantRange): string[] {
  const dates: string[] = [];
  for (let date = localDateForInstant(range.start); localDayRange(date).start < range.end; date = nextLocalDate(date)) dates.push(date);
  return dates;
}
export function intersectRanges(left: InstantRange, right: InstantRange): InstantRange | null {
  const start = left.start > right.start ? left.start : right.start;
  const end = left.end < right.end ? left.end : right.end;
  return start < end ? { start, end } : null;
}
export function unionRanges(ranges: readonly InstantRange[]): InstantRange[] {
  const result: { start: bigint; end: bigint }[] = [];
  for (const range of [...ranges].filter((r) => r.start < r.end).sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : a.end < b.end ? -1 : a.end > b.end ? 1 : 0)) {
    const last = result[result.length - 1];
    if (last && range.start <= last.end) { if (range.end > last.end) last.end = range.end; }
    else result.push({ ...range });
  }
  return result;
}
export function subtractRanges(source: readonly InstantRange[], removed: readonly InstantRange[]): InstantRange[] {
  let result = unionRanges(source);
  for (const cut of unionRanges(removed)) result = result.flatMap((range) => {
    const overlap = intersectRanges(range, cut); if (!overlap) return [range];
    return [{ start: range.start, end: overlap.start }, { start: overlap.end, end: range.end }].filter((r) => r.start < r.end);
  });
  return result;
}
export function minutesInRanges(ranges: readonly InstantRange[]): number {
  return Number(ranges.reduce((total, range) => total + range.end - range.start, BigInt(0))) / Number(MINUTE);
}
