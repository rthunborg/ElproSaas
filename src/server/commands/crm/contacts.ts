/**
 * CRM contact commands (Story 3.1, Task 2; architecture §5 command table).
 *
 * `createContact` / `updateContact` / `archiveContact`. A contact references BOTH a
 * customer (always) and OPTIONALLY a facility. Per Task 2.3 the envelope `ownership`
 * verifies the CUSTOMER (always present): a Tenant-B `customer_id` is invisible
 * under A's RLS → TENANT_ACCESS_DENIED. The OPTIONAL facility link is verified at the
 * DB layer: the INSERT/UPDATE writes the RESOLVED `tenant_id`, so the composite
 * same-tenant FK `contacts(facility_id, tenant_id) -> facilities(id, tenant_id)`
 * rejects a cross-tenant (or wrong-tenant) facility with `23503`, which
 * `throwMappedWriteError` maps to TENANT_ACCESS_DENIED — never a raw throw / 500.
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import { asCrmWriteClient, throwMappedWriteError } from "./crm-db";
import type { CrmCommandResult } from "./customers";
import {
  validateArchive,
  validateCreateContact,
  validateUpdateContact,
  type ArchiveInput,
  type CreateContactInput,
  type UpdateContactInput,
} from "./validation";

export const createContact = defineCommand<CreateContactInput, CrmCommandResult>({
  command: "contact.create",
  auditable: true,
  eventType: "contact.created",
  targetType: "contact",
  validateInput: validateCreateContact,
  // Parent ownership: the customer must be visible under the caller's RLS. A
  // Tenant-B customer_id → zero rows → TENANT_ACCESS_DENIED. The optional facility
  // link is enforced by the composite same-tenant FK at INSERT (see file header).
  ownership: (input) => ({ table: "customers", id: input.customer_id }),
  execute: async (ctx) => {
    const db = asCrmWriteClient(ctx.db);
    const { data, error } = await db
      .from("contacts")
      .insert({
        tenant_id: ctx.tenantContext.tenantId, // resolved tenant, never client id
        customer_id: ctx.input.customer_id,
        facility_id: ctx.input.facility_id ?? null,
        name: ctx.input.name,
        email: ctx.input.email ?? null,
        phone: ctx.input.phone ?? null,
        role_label: ctx.input.role_label ?? null,
        is_primary: ctx.input.is_primary ?? false,
      })
      .select("id")
      .single();
    if (error) throwMappedWriteError(error);
    const id = data?.id;
    if (typeof id !== "string") {
      throw new Error("createContact: no id returned");
    }
    return { targetId: id };
  },
  auditFields: (_ctx, result) => ({ targetId: result.targetId }),
});

function buildContactPatch(input: UpdateContactInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.facility_id !== undefined) patch.facility_id = input.facility_id;
  if (input.email !== undefined) patch.email = input.email;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.role_label !== undefined) patch.role_label = input.role_label;
  if (input.is_primary !== undefined) patch.is_primary = input.is_primary;
  return patch;
}

export const updateContact = defineCommand<UpdateContactInput, CrmCommandResult>({
  command: "contact.update",
  auditable: true,
  eventType: "contact.updated",
  targetType: "contact",
  validateInput: validateUpdateContact,
  ownership: (input) => ({ table: "contacts", id: input.id }),
  execute: async (ctx) => {
    const db = asCrmWriteClient(ctx.db);
    const { data, error } = await db
      .from("contacts")
      .update(buildContactPatch(ctx.input))
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

export const archiveContact = defineCommand<ArchiveInput, CrmCommandResult>({
  command: "contact.archive",
  auditable: true,
  eventType: "contact.archived",
  targetType: "contact",
  validateInput: validateArchive,
  ownership: (input) => ({ table: "contacts", id: input.id }),
  execute: async (ctx) => {
    const db = asCrmWriteClient(ctx.db);
    const archivedAt = ctx.clock.now().toISOString();
    const { data, error } = await db
      .from("contacts")
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
