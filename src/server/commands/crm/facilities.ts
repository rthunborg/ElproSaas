/**
 * CRM facility commands (Story 3.1, Task 2; architecture §5 command table).
 *
 * `createFacility` / `updateFacility` / `archiveFacility`. Parent-ownership
 * enforcement (Task 2.3): the checked database wrapper verifies the parent customer
 * under the resolved tenant. The composite same-tenant FK
 * `facilities(customer_id, tenant_id) -> customers(id, tenant_id)` remains a second
 * database guard against a cross-tenant parent link.
 */
import { defineCommand } from "../envelope";
import { executeCrmAuditedMutation } from "./crm-db";
import type { CrmCommandResult } from "./customers";
import {
  validateArchive,
  validateCreateFacility,
  validateUpdateFacility,
  type ArchiveInput,
  type CreateFacilityInput,
  type UpdateFacilityInput,
} from "./validation";

export const createFacility = defineCommand<CreateFacilityInput, CrmCommandResult>({
  command: "facility.create",
  auditable: false,
  eventType: "facility.created",
  targetType: "facility",
  validateInput: validateCreateFacility,
  execute: async (ctx) => {
    const targetId = await executeCrmAuditedMutation(ctx.db, "create_facility_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_customer_id: ctx.input.customer_id,
      p_name: ctx.input.name,
      p_address_line1: ctx.input.address_line1 ?? null,
      p_address_line2: ctx.input.address_line2 ?? null,
      p_postal_code: ctx.input.postal_code ?? null,
      p_city: ctx.input.city ?? null,
    });
    return { targetId };
  },
});

function buildFacilityPatch(input: UpdateFacilityInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.address_line1 !== undefined) patch.address_line1 = input.address_line1;
  if (input.address_line2 !== undefined) patch.address_line2 = input.address_line2;
  if (input.postal_code !== undefined) patch.postal_code = input.postal_code;
  if (input.city !== undefined) patch.city = input.city;
  return patch;
}

export const updateFacility = defineCommand<UpdateFacilityInput, CrmCommandResult>({
  command: "facility.update",
  auditable: false,
  eventType: "facility.updated",
  targetType: "facility",
  validateInput: validateUpdateFacility,
  execute: async (ctx) => {
    const targetId = await executeCrmAuditedMutation(ctx.db, "update_facility_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_facility_id: ctx.input.id,
      p_patch: buildFacilityPatch(ctx.input),
    });
    return { targetId };
  },
});

export const archiveFacility = defineCommand<ArchiveInput, CrmCommandResult>({
  command: "facility.archive",
  auditable: false,
  eventType: "facility.archived",
  targetType: "facility",
  validateInput: validateArchive,
  execute: async (ctx) => {
    const targetId = await executeCrmAuditedMutation(ctx.db, "archive_facility_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_facility_id: ctx.input.id,
    });
    return { targetId };
  },
});
