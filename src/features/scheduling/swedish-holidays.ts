import { nextLocalDate, validateLocalDate, weekdayForDate } from "./time-zone";

/** Central rules: SFS 1989:253 §§1–2, including Sundays; eves are tenant rules.
 * https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1989253-om-allmanna-helgdagar_sfs-1989-253/
 */
export const SWEDISH_HOLIDAY_RULE_VERSION = "sfs-1989-253-v1";
function easterSunday(year: number): string {
  const a = year % 19; const b = Math.floor(year / 100); const c = year % 100;
  const d = Math.floor(b / 4); const e = b % 4; const f = Math.floor((b + 8) / 25); const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30; const i = Math.floor(c / 4); const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7; const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); const day = (h + l - 7 * m + 114) % 31 + 1;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}
export function isSwedishPublicHoliday(date: string): boolean {
  validateLocalDate(date);
  if (weekdayForDate(date) === 7 || ["01-01", "01-06", "05-01", "06-06", "12-25", "12-26"].includes(date.slice(5))) return true;
  const year = Number(date.slice(0, 4)); const easter = Date.parse(`${easterSunday(year)}T00:00:00Z`);
  if ([-2, 1, 39].some((offset) => new Date(easter + offset * 86400000).toISOString().slice(0, 10) === date)) return true;
  if (weekdayForDate(date) !== 6) return false;
  return (date >= `${year}-06-20` && date < nextLocalDate(`${year}-06-26`)) || (date >= `${year}-10-31` && date <= `${year}-11-06`);
}
