"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { runCommand, type CommandDbClient } from "@/server/commands/envelope";
import { saveResourceProfileForm } from "@/server/commands/resources/profile-form";
import { validateWorkHoursInput } from "@/features/resources/work-hours";
import { validateCapacityInputs } from "@/features/resources/capacity-inputs";
import { mergeRenderedSchedule } from "@/features/resources/schedule-form-merge";
import { normalizeStoredExceptions } from "@/features/resources/resource-form-inputs";
import { shouldInjectResourceE2eSaveFailure } from "@/server/resources/e2e-save-failure";
export type ResourceActionState = { readonly status: "idle" | "success" | "error"; readonly message: string };
function isPartiallyFilled(start: FormDataEntryValue | null, end: FormDataEntryValue | null): boolean {
  return (typeof start === "string" && start.length > 0) !== (typeof end === "string" && end.length > 0);
}
export async function saveResourceProfileAction(_: ResourceActionState, form: FormData): Promise<ResourceActionState> {
  // Browser verification may request one deterministic, server-observable transient failure.
  // It is checked before any command so the retained form is never mistaken for persisted data.
  if (shouldInjectResourceE2eSaveFailure({
    requested: form.get("resourceSaveFailureOnce"),
    attempt: form.get("resourceFailureAttempt"),
  })) {
    return { status: "error", message: "Kunde inte spara resurspersonen. Försök igen." };
  }
  const client = (await createSupabaseServerClient()) as unknown as CommandDbClient;
  let hasPartialWorkTime = false;
  const shifts = Array.from({ length: 7 }, (_, offset) => {
    const weekday = offset + 1;
    const start = form.get(`weekday${weekday}Start`);
    const end = form.get(`weekday${weekday}End`);
    const breakStart = form.get(`weekday${weekday}BreakStart`);
    const breakEnd = form.get(`weekday${weekday}BreakEnd`);
    const hasShift = typeof start === "string" && typeof end === "string" && Boolean(start) && Boolean(end);
    const hasBreak = (typeof breakStart === "string" && Boolean(breakStart)) || (typeof breakEnd === "string" && Boolean(breakEnd));
    if (isPartiallyFilled(start, end) || isPartiallyFilled(breakStart, breakEnd) || (hasBreak && !hasShift)) hasPartialWorkTime = true;
    if (typeof start !== "string" || typeof end !== "string" || !start || !end) return null;
    const breaks = typeof breakStart === "string" && typeof breakEnd === "string" && breakStart && breakEnd
      ? [{ start: breakStart, end: breakEnd }]
      : [];
    return { weekday, start, end, breaks };
  }).filter((shift): shift is NonNullable<typeof shift> => shift !== null);
  const rawExistingSchedule = typeof form.get("existingSchedule") === "string" ? (() => { try { return JSON.parse(String(form.get("existingSchedule"))); } catch { return []; } })() : [];
  const schedule = { shifts: mergeRenderedSchedule(shifts, rawExistingSchedule) };
  const reduction = form.get("calendarReduction"); const date = form.get("exceptionDate"); const existingCalendarDate = form.get("existingCalendarDate");
  const exceptionDate = form.get("personExceptionDate"); const exceptionKind = form.get("personExceptionKind"); const exceptionStart = form.get("personExceptionStart"); const exceptionEnd = form.get("personExceptionEnd");
  const existingExceptions = typeof form.get("existingExceptions") === "string" ? (() => { try { return normalizeStoredExceptions(JSON.parse(String(form.get("existingExceptions")))); } catch { return []; } })() : [];
  const hasExceptionKind = typeof exceptionKind === "string" && Boolean(exceptionKind);
  const hasExceptionDate = typeof exceptionDate === "string" && Boolean(exceptionDate);
  const hasExceptionTime = (typeof exceptionStart === "string" && Boolean(exceptionStart)) || (typeof exceptionEnd === "string" && Boolean(exceptionEnd));
  const hasPartialException = hasExceptionKind !== hasExceptionDate || isPartiallyFilled(exceptionStart, exceptionEnd) || (hasExceptionTime && !(hasExceptionKind && hasExceptionDate));
  const exception = hasExceptionKind && hasExceptionDate ? { kind: exceptionKind, date: exceptionDate, ...(typeof exceptionStart === "string" && exceptionStart ? { start: exceptionStart } : {}), ...(typeof exceptionEnd === "string" && exceptionEnd ? { end: exceptionEnd } : {}) } : null;
  const exceptions = exception ? [exception, ...existingExceptions.slice(1)] : existingExceptions.slice(1);
  const hasPartialCalendar = isPartiallyFilled(date, reduction);
  const calendarDay = typeof reduction === "string" && reduction && typeof date === "string" && date
    ? { date, variant: "reduced_capacity" as const, reductionPercent: Number(reduction) }
    : typeof existingCalendarDate === "string" && existingCalendarDate && !date && !reduction
      ? { date: existingCalendarDate, variant: "clear" as const }
      : undefined;
  if (hasPartialWorkTime || hasPartialException || hasPartialCalendar || !validateWorkHoursInput(schedule).ok ||
      !validateCapacityInputs({ exceptions, ...(calendarDay?.variant === "reduced_capacity" ? { calendarDay } : {}) }).ok) {
    return { status: "error", message: "Kontrollera arbetstider och kalenderunderlag och försök igen." };
  }
  const result = await runCommand(saveResourceProfileForm, { client, input: { membershipId: form.get("membershipId"), defaultWorkRoleId: form.get("defaultWorkRoleId") || undefined, employmentPercentage: form.get("employmentPercentage") ? Number(form.get("employmentPercentage")) : undefined, schedule, exceptions, ...(calendarDay ? { calendarDay } : {}) } });
  if (!result.ok) return { status: "error", message: "Kunde inte spara resurspersonen. Försök igen." };
  revalidatePath(`/admin/users/${form.get("membershipId")}`);
  return { status: "success", message: "Resurspersonen har sparats." };
}
