import { defineCommand } from "../envelope";
import type { ValidationResult } from "../envelope-core";
import { validateWorkHoursInput, type WorkHoursInput } from "@/features/resources/work-hours";
type Input = { readonly personProfileId: string; readonly schedule: WorkHoursInput };
const UUID = /^[0-9a-f-]{36}$/i;
function validate(raw: unknown): ValidationResult<Input> { if (!raw || typeof raw !== "object") return { ok: false, code: "VALIDATION_FAILED" }; const row=raw as { personProfileId?: unknown; schedule?: unknown }; const schedule=validateWorkHoursInput(row.schedule); return typeof row.personProfileId === "string" && UUID.test(row.personProfileId) && schedule.ok ? { ok: true, data: { personProfileId: row.personProfileId, schedule: schedule.data } } : { ok: false, code: "VALIDATION_FAILED" }; }
export const savePersonWorkHours = defineCommand<Input, { readonly targetId: string }>({ command: "resource.work_hours.save", auditable: false, eventType: "resource.work_hours.saved", targetType: "person_profile", validateInput: validate, ownership: (input) => ({ table: "person_profiles", id: input.personProfileId }), execute: async (ctx) => {
  const db=ctx.db as unknown as { rpc(name:string,args:unknown):Promise<{data:unknown;error:unknown}> };
  const {data,error}=await db.rpc("save_person_schedule_with_audit", { p_tenant_id:ctx.tenantContext.tenantId, p_actor_user_id:ctx.tenantContext.userId, p_correlation_id:ctx.correlationId, p_person_profile_id:ctx.input.personProfileId, p_schedule:ctx.input.schedule.shifts });
  if(error || typeof data!=="string") throw new Error("resource hours write failed"); return {targetId:data};
}, auditFields: (_ctx,result)=>({targetId:result.targetId,metadata:{targetId:result.targetId}}) });
