"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { runCommand, type CommandDbClient } from "@/server/commands/envelope";
import { createOrUpdatePersonProfile } from "@/server/commands/resources/person-profiles";
import { savePersonWorkHours } from "@/server/commands/resources/work-hours";
import { saveTenantCalendarDay } from "@/server/commands/resources/calendar-days";
export type ResourceActionState = { readonly status: "idle" | "success" | "error"; readonly message: string };
export const RESOURCE_INITIAL: ResourceActionState = { status: "idle", message: "" };
export async function saveResourceProfileAction(_: ResourceActionState, form: FormData): Promise<ResourceActionState> {
  // Browser verification may request one deterministic, server-observable transient failure.
  // It is checked before any command so the retained form is never mistaken for persisted data.
  if (form.get("resourceSaveFailureOnce") === "true" && form.get("resourceFailureAttempt") !== "retry") {
    return { status: "error", message: "Kunde inte spara resurspersonen. Försök igen." };
  }
  const client = (await createSupabaseServerClient()) as unknown as CommandDbClient;
  const start = form.get("mondayStart"); const end = form.get("mondayEnd"); const breakStart=form.get("mondayBreakStart"); const breakEnd=form.get("mondayBreakEnd");
  const breaks = typeof breakStart === "string" && typeof breakEnd === "string" && breakStart && breakEnd ? [{start:breakStart,end:breakEnd}] : [];
  const shift = typeof start === "string" && typeof end === "string" && start && end ? [{ weekday: 1, start, end, breaks }] : [];
  const result = await runCommand(createOrUpdatePersonProfile, { client, input: { membershipId: form.get("membershipId"), defaultWorkRoleId: form.get("defaultWorkRoleId") || undefined, employmentPercentage: form.get("employmentPercentage") ? Number(form.get("employmentPercentage")) : undefined } });
  if (!result.ok) return { status: "error", message: "Kunde inte spara resurspersonen. Försök igen." };
  if (shift.length > 0) { const hours = await runCommand(savePersonWorkHours, { client, input: { personProfileId: result.data.targetId, schedule: { shifts: shift } } }); if (!hours.ok) return { status:"error", message:"Kunde inte spara schemat. Försök igen." }; }
  const reduction = form.get("calendarReduction"); const date = form.get("exceptionDate");
  if (typeof reduction === "string" && reduction && typeof date === "string" && date) { const calendar=await runCommand(saveTenantCalendarDay,{client,input:{date,variant:"reduced_capacity",reductionPercent:Number(reduction)}}); if(!calendar.ok)return{status:"error",message:"Kunde inte spara kalenderdagen. Försök igen."}; }
  revalidatePath(`/admin/users/${form.get("membershipId")}`);
  return { status: "success", message: "Resurspersonen har sparats." };
}
