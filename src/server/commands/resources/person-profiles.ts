import { defineCommand } from "../envelope";
import type { ValidationResult } from "../envelope-core";

type ProfileInput = { readonly membershipId: string; readonly defaultWorkRoleId?: string; readonly employmentPercentage?: number };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validate(raw: unknown): ValidationResult<ProfileInput> {
  if (!raw || typeof raw !== "object") return { ok: false, code: "VALIDATION_FAILED" };
  const value = raw as Record<string, unknown>;
  if (typeof value.membershipId !== "string" || !UUID.test(value.membershipId)) return { ok: false, code: "VALIDATION_FAILED" };
  if (value.defaultWorkRoleId !== undefined && (typeof value.defaultWorkRoleId !== "string" || !UUID.test(value.defaultWorkRoleId))) return { ok: false, code: "VALIDATION_FAILED" };
  if (value.employmentPercentage !== undefined && (!Number.isInteger(value.employmentPercentage) || Number(value.employmentPercentage) < 1 || Number(value.employmentPercentage) > 100)) return { ok: false, code: "VALIDATION_FAILED" };
  return { ok: true, data: { membershipId: value.membershipId, ...(typeof value.defaultWorkRoleId === "string" ? { defaultWorkRoleId: value.defaultWorkRoleId } : {}), ...(typeof value.employmentPercentage === "number" ? { employmentPercentage: value.employmentPercentage } : {}) } };
}
export const createOrUpdatePersonProfile = defineCommand<ProfileInput, { readonly targetId: string }>({
  command: "resource.person_profile.upsert", auditable: false, eventType: "resource.person_profile.saved", targetType: "person_profile", validateInput: validate,
  ownership: (input) => ({ table: "tenant_memberships", id: input.membershipId }),
  execute: async (ctx) => {
    const db = ctx.db as unknown as { rpc(name:string,args:unknown):Promise<{data:unknown;error:unknown}> };
    const { data, error } = await db.rpc("upsert_person_profile_with_audit", { p_tenant_id:ctx.tenantContext.tenantId,p_actor_user_id:ctx.tenantContext.userId,p_correlation_id:ctx.correlationId,p_membership_id:ctx.input.membershipId,p_work_role_id:ctx.input.defaultWorkRoleId??null,p_employment_percentage:ctx.input.employmentPercentage??null });
    if (error || typeof data !== "string") throw new Error("resource profile write failed"); return { targetId: data };
  },
  auditFields: (_ctx, result) => ({ targetId: result.targetId, metadata: { targetId: result.targetId } }),
});
