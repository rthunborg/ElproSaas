import { validateWorkHoursInput } from "./work-hours";
export type CapacityInputValidation = { readonly ok: true } | { readonly ok: false };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

/** Input seam for Swedish holidays. Interpretation/subtraction is later capacity-engine work. */
export const SWEDISH_HOLIDAY_RULE_SOURCE = "swedish-public-holiday-rule-input" as const;
export function validateCapacityInputs(raw: unknown): CapacityInputValidation {
  if (!raw || typeof raw !== "object") return { ok: false };
  const input = raw as { timeZone?: unknown; exceptions?: unknown; calendarDay?: unknown; shifts?: unknown };
  if (input.timeZone !== undefined && input.timeZone !== "Europe/Stockholm") return { ok: false };
  if (input.shifts !== undefined && !validateWorkHoursInput({ shifts: input.shifts }).ok) return { ok: false };
  if (input.exceptions !== undefined) {
    if (!Array.isArray(input.exceptions)) return { ok: false };
    for (const exception of input.exceptions as { kind?: unknown; date?: unknown; start?: unknown; end?: unknown }[]) {
      if (!exception || typeof exception !== "object") return { ok: false };
      if (!["absence", "sick_leave", "leave", "training", "blocked_time"].includes(String(exception.kind)) || typeof exception.date !== "string" || !DATE.test(exception.date)) return { ok: false };
      const timed = exception.start !== undefined || exception.end !== undefined;
      if (timed && (typeof exception.start !== "string" || typeof exception.end !== "string" || !TIME.test(exception.start) || !TIME.test(exception.end) || toMinutes(exception.start) >= toMinutes(exception.end))) return { ok: false };
    }
  }
  if (input.calendarDay !== undefined) {
    const day = input.calendarDay as { date?: unknown; variant?: unknown; reductionPercent?: unknown };
    if (typeof day.date !== "string" || !DATE.test(day.date) || !["closed", "reduced_capacity"].includes(String(day.variant))) return { ok: false };
    if (day.variant === "closed" && day.reductionPercent !== undefined) return { ok: false };
    if (day.variant === "reduced_capacity" && (!Number.isInteger(day.reductionPercent) || Number(day.reductionPercent) < 1 || Number(day.reductionPercent) > 100)) return { ok: false };
  }
  return { ok: true };
}
