/**
 * CRM contact commands (Story 3.1, Task 2; architecture §5 command table).
 *
 * `createContact` / `updateContact` / `archiveContact`. A contact references BOTH a
 * customer (always) and OPTIONALLY a facility. The checked database wrappers bind
 * the resolved tenant and verify parent ownership; their composite same-tenant FKs
 * remain a second guard against cross-tenant links.
 */
import { defineCommand } from "../envelope";
import { executeCrmAuditedMutation } from "./crm-db";
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
  auditable: false,
  eventType: "contact.created",
  targetType: "contact",
  validateInput: validateCreateContact,
  execute: async (ctx) => {
    const targetId = await executeCrmAuditedMutation(ctx.db, "create_contact_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_customer_id: ctx.input.customer_id,
      p_facility_id: ctx.input.facility_id ?? null,
      p_name: ctx.input.name,
      p_email: ctx.input.email ?? null,
      p_phone: ctx.input.phone ?? null,
      p_role_label: ctx.input.role_label ?? null,
      p_is_primary: ctx.input.is_primary ?? false,
    });
    return { targetId };
  },
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
  auditable: false,
  eventType: "contact.updated",
  targetType: "contact",
  validateInput: validateUpdateContact,
  execute: async (ctx) => {
    const targetId = await executeCrmAuditedMutation(ctx.db, "update_contact_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_contact_id: ctx.input.id,
      p_patch: buildContactPatch(ctx.input),
    });
    return { targetId };
  },
});

export const archiveContact = defineCommand<ArchiveInput, CrmCommandResult>({
  command: "contact.archive",
  auditable: false,
  eventType: "contact.archived",
  targetType: "contact",
  validateInput: validateArchive,
  execute: async (ctx) => {
    const targetId = await executeCrmAuditedMutation(ctx.db, "archive_contact_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_contact_id: ctx.input.id,
    });
    return { targetId };
  },
});
