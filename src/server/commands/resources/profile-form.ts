import { defineCommand } from "../envelope";
import type { ValidationResult } from "../envelope-core";
import { validateCapacityInputs } from "@/features/resources/capacity-inputs";
import { validateWorkHoursInput, type WorkHoursInput } from "@/features/resources/work-hours";

type ExceptionInput = { readonly kind: "absence" | "sick_leave" | "leave" | "training" | "blocked_time"; readonly date: string; readonly start?: string; readonly end?: string };
type CalendarDayInput = { readonly date: string; readonly variant: "reduced_capacity"; readonly reductionPercent: number } | { readonly date: string; readonly variant: "clear" };
type Input = { readonly membershipId: string; readonly defaultWorkRoleId?: string; readonly employmentPercentage?: number; readonly schedule: WorkHoursInput; readonly exceptions: readonly ExceptionInput[]; readonly calendarDay?: CalendarDayInput };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarClear(value: unknown): value is { readonly date: string; readonly variant: "clear" } {
  return !!value && typeof value === "object" && typeof (value as { date?: unknown }).date === "string" && ISO_DATE.test((value as { date: string }).date) && (value as { variant?: unknown }).variant === "clear";
}

function validate(raw: unknown): ValidationResult<Input> {
  if (!raw || typeof raw !== "object") return { ok: false, code: "VALIDATION_FAILED" };
  const value = raw as Record<string, unknown>;
  const schedule = validateWorkHoursInput(value.schedule);
  const exceptions = Array.isArray(value.exceptions) ? value.exceptions : null;
  const calendarDay = value.calendarDay;
  const calendarValid = calendarDay === undefined || isCalendarClear(calendarDay) || validateCapacityInputs({ calendarDay }).ok;
  if (typeof value.membershipId !== "string" || !UUID.test(value.membershipId) || (value.defaultWorkRoleId !== undefined && (typeof value.defaultWorkRoleId !== "string" || !UUID.test(value.defaultWorkRoleId))) || (value.employmentPercentage !== undefined && (!Number.isInteger(value.employmentPercentage) || Number(value.employmentPercentage) < 1 || Number(value.employmentPercentage) > 100)) || !schedule.ok || !exceptions || !validateCapacityInputs({ exceptions }).ok || !calendarValid) return { ok: false, code: "VALIDATION_FAILED" };
  return { ok: true, data: { membershipId: value.membershipId, ...(typeof value.defaultWorkRoleId === "string" ? { defaultWorkRoleId: value.defaultWorkRoleId } : {}), ...(typeof value.employmentPercentage === "number" ? { employmentPercentage: value.employmentPercentage } : {}), schedule: schedule.data, exceptions: exceptions as ExceptionInput[], ...(calendarDay && typeof calendarDay === "object" ? { calendarDay: calendarDay as CalendarDayInput } : {}) } };
}

export const saveResourceProfileForm = defineCommand<Input, { readonly targetId: string }>({
  command: "resource.profile_form.save", auditable: false, eventType: "resource.profile_form.saved", targetType: "person_profile", validateInput: validate,
  ownership: (input) => ({ table: "tenant_memberships", id: input.membershipId }),
  execute: async (ctx) => {
    const db = ctx.db as unknown as { rpc(name: string, args: unknown): Promise<{ data: unknown; error: unknown }> };
    const { data, error } = await db.rpc("save_resource_profile_form_with_audit", { p_tenant_id: ctx.tenantContext.tenantId, p_actor_user_id: ctx.tenantContext.userId, p_correlation_id: ctx.correlationId, p_membership_id: ctx.input.membershipId, p_work_role_id: ctx.input.defaultWorkRoleId ?? null, p_employment_percentage: ctx.input.employmentPercentage ?? null, p_schedule: ctx.input.schedule.shifts, p_exceptions: ctx.input.exceptions, p_calendar_day: ctx.input.calendarDay ?? null });
    if (error || typeof data !== "string") throw new Error("resource profile form write failed");
    return { targetId: data };
  },
  auditFields: (_ctx, result) => ({ targetId: result.targetId, metadata: { targetId: result.targetId } }),
});
