import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";

export type ResourceProfileRead = { readonly id: string; readonly defaultWorkRoleId: string | null; readonly employmentPercentage: number | null; readonly shifts: readonly { readonly weekday: number; readonly start: string; readonly end: string; readonly breaks: readonly { readonly start: string; readonly end: string }[] }[]; readonly calendarDays: readonly { readonly date: string; readonly variant: string; readonly reductionPercent: number | null }[] };
export type ResourceReadResult = { readonly profile: ResourceProfileRead | null; readonly workRoles: readonly { readonly id: string; readonly name: string }[]; readonly error: string | null };
const ERROR = "Resursuppgifterna kunde inte läsas. Försök igen om en stund.";

/** Reads only RLS-visible tenant data; membership id is never treated as tenant authority. */
export async function readResourceForMembership(membershipId: string): Promise<ResourceReadResult> {
  try {
    const client = await createSupabaseServerClient(); const context = await resolveTenantContext({ client });
    if (!context.ok) return { profile:null, workRoles:[], error:ERROR };
    const [{ data: profile, error: profileError }, { data: roles, error: rolesError }, { data: days, error: daysError }] = await Promise.all([
      client.from("person_profiles").select("id, default_work_role_id, employment_percentage, person_work_hours(weekday, starts_at, ends_at, entry_kind)").eq("tenant_id", context.data.tenantId).eq("membership_id", membershipId).maybeSingle(),
      client.from("work_roles").select("id, display_name").eq("tenant_id", context.data.tenantId).eq("is_active", true).order("display_name", { ascending:true }),
      client.from("tenant_calendar_days").select("local_date, variant, reduction_percent").eq("tenant_id", context.data.tenantId).order("local_date", { ascending:true }),
    ]);
    if (profileError || rolesError || daysError) return { profile:null, workRoles:[], error:ERROR };
    const row = profile as { id?:unknown;default_work_role_id?:unknown;employment_percentage?:unknown;person_work_hours?:unknown } | null;
    const entries = (row?.person_work_hours ?? []) as { weekday?: unknown; starts_at?: unknown; ends_at?: unknown; entry_kind?: unknown }[];
    const shifts = entries.filter((entry) => entry.entry_kind === "weekly_shift" && typeof entry.weekday === "number" && typeof entry.starts_at === "string" && typeof entry.ends_at === "string").map((entry) => ({
      weekday: entry.weekday as number,
      start: entry.starts_at as string,
      end: entry.ends_at as string,
      breaks: entries.filter((candidate) => candidate.entry_kind === "weekly_break" && candidate.weekday === entry.weekday && typeof candidate.starts_at === "string" && typeof candidate.ends_at === "string").map((candidate) => ({ start: candidate.starts_at as string, end: candidate.ends_at as string })),
    }));
    return { profile: row && typeof row.id === "string" ? { id:row.id, defaultWorkRoleId:typeof row.default_work_role_id === "string" ? row.default_work_role_id : null, employmentPercentage:typeof row.employment_percentage === "number" ? row.employment_percentage : null, shifts, calendarDays:(days??[]).map((day:{local_date?:unknown;variant?:unknown;reduction_percent?:unknown})=>({date:String(day.local_date),variant:String(day.variant),reductionPercent:typeof day.reduction_percent==="number"?day.reduction_percent:null})) } : null, workRoles:(roles??[]).map((role:{id?:unknown;display_name?:unknown})=>({id:String(role.id),name:String(role.display_name)})), error:null };
  } catch { return { profile:null, workRoles:[], error:ERROR }; }
}
