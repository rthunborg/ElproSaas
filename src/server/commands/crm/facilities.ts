/**
 * CRM facility commands (Story 3.1, Task 2; architecture §5 command table).
 *
 * `createFacility` / `updateFacility` / `archiveFacility`. Parent-ownership
 * enforcement (Task 2.3): the envelope `ownership` target is the parent CUSTOMER —
 * a Tenant-A command supplying a Tenant-B `customer_id` finds the customer INVISIBLE
 * under A's RLS → zero rows → TENANT_ACCESS_DENIED (R-002/R-004). On INSERT the
 * facility's `tenant_id` is the RESOLVED tenant (never client-supplied), so the
 * composite same-tenant FK `facilities(customer_id, tenant_id) -> customers(id,
 * tenant_id)` is a second, DB-level guard against a cross-tenant parent link.
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import { asCrmWriteClient, throwMappedWriteError } from "./crm-db";
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
  auditable: true,
  eventType: "facility.created",
  targetType: "facility",
  validateInput: validateCreateFacility,
  // Parent ownership: the customer must be visible under the caller's RLS (own
  // tenant). A Tenant-B customer_id → zero rows → TENANT_ACCESS_DENIED.
  ownership: (input) => ({ table: "customers", id: input.customer_id }),
  execute: async (ctx) => {
    const db = asCrmWriteClient(ctx.db);
    const { data, error } = await db
      .from("facilities")
      .insert({
        tenant_id: ctx.tenantContext.tenantId, // resolved tenant, never client id
        customer_id: ctx.input.customer_id,
        name: ctx.input.name,
        address_line1: ctx.input.address_line1 ?? null,
        address_line2: ctx.input.address_line2 ?? null,
        postal_code: ctx.input.postal_code ?? null,
        city: ctx.input.city ?? null,
      })
      .select("id")
      .single();
    if (error) throwMappedWriteError(error);
    const id = data?.id;
    if (typeof id !== "string") {
      throw new Error("createFacility: no id returned");
    }
    return { targetId: id };
  },
  auditFields: (_ctx, result) => ({ targetId: result.targetId }),
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
  auditable: true,
  eventType: "facility.updated",
  targetType: "facility",
  validateInput: validateUpdateFacility,
  ownership: (input) => ({ table: "facilities", id: input.id }),
  execute: async (ctx) => {
    const db = asCrmWriteClient(ctx.db);
    const { data, error } = await db
      .from("facilities")
      .update(buildFacilityPatch(ctx.input))
      .eq("id", ctx.input.id)
      .select("id");
    if (error) throwMappedWriteError(error);
    if (!data || data.length === 0) {
      throw new CommandError("TENANT_ACCESS_DENIED");
    }
    return { targetId: ctx.input.id };
  },
  auditFields: (ctx) => ({ targetId: ctx.input.id }),
});

export const archiveFacility = defineCommand<ArchiveInput, CrmCommandResult>({
  command: "facility.archive",
  auditable: true,
  eventType: "facility.archived",
  targetType: "facility",
  validateInput: validateArchive,
  ownership: (input) => ({ table: "facilities", id: input.id }),
  execute: async (ctx) => {
    const db = asCrmWriteClient(ctx.db);
    const archivedAt = ctx.clock.now().toISOString();
    const { data, error } = await db
      .from("facilities")
      .update({ archived_at: archivedAt })
      .eq("id", ctx.input.id)
      .select("id");
    if (error) throwMappedWriteError(error);
    if (!data || data.length === 0) {
      throw new CommandError("TENANT_ACCESS_DENIED");
    }
    return { targetId: ctx.input.id };
  },
  auditFields: (ctx) => ({ targetId: ctx.input.id }),
});
