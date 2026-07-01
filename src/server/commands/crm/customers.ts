/**
 * CRM customer commands (Story 3.1, Task 2; architecture §5 command table).
 *
 * `createCustomer` / `updateCustomer` / `archiveCustomer` — each a `defineCommand`
 * through the EXISTING envelope (resolve user → resolve active tenant_admin →
 * validate typed input → verify ownership → execute via the RLS client → append-only
 * audit → typed Result). No bespoke auth/error/audit mechanism.
 *
 * - The resolved tenant (`ctx.tenantContext.tenantId`) is the ONLY authority for the
 *   row's `tenant_id`; a client-supplied tenant_id is ignored (the validators never
 *   read it, and execute writes the resolved tenant).
 * - Mutations run on the request-bound RLS client (`ctx.db`); the own-tenant
 *   INSERT/UPDATE policies + the `is_tenant_admin` WITH CHECK keep them in-tenant.
 * - Audit metadata carries NO PII (personnummer / org_nr / name / email / address):
 *   the command passes only the narrow SAFE_FIELDS allow-list shape ({} here), and
 *   `sanitizeAuditMetadata` drops anything else by construction.
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import { asCrmWriteClient, throwMappedWriteError } from "./crm-db";
import {
  validateArchive,
  validateCreateCustomer,
  validateUpdateCustomer,
  type ArchiveInput,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from "./validation";

/** Every CRM lifecycle command returns the affected row id under `targetId`. */
export interface CrmCommandResult {
  readonly targetId: string;
}

/** Build the INSERT payload for a customer, scoped to the resolved tenant. */
function customerInsertValues(
  tenantId: string,
  input: CreateCustomerInput,
): Record<string, unknown> {
  return {
    tenant_id: tenantId, // resolved tenant — NEVER a client-supplied id
    customer_type: input.customer_type,
    display_name: input.display_name,
    personnummer: input.personnummer ?? null,
    org_nr: input.org_nr ?? null,
    contact_name: input.contact_name ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    address_line1: input.address_line1 ?? null,
    address_line2: input.address_line2 ?? null,
    postal_code: input.postal_code ?? null,
    city: input.city ?? null,
  };
}

export const createCustomer = defineCommand<CreateCustomerInput, CrmCommandResult>({
  command: "customer.create",
  auditable: true,
  eventType: "customer.created",
  targetType: "customer",
  validateInput: validateCreateCustomer,
  // No ownership target — a create has no pre-existing row; the INSERT WITH CHECK
  // (is_tenant_admin on the resolved tenant) keeps the new row in-tenant.
  execute: async (ctx) => {
    const db = asCrmWriteClient(ctx.db);
    const { data, error } = await db
      .from("customers")
      .insert(customerInsertValues(ctx.tenantContext.tenantId, ctx.input))
      .select("id")
      .single();
    if (error) throwMappedWriteError(error);
    const id = data?.id;
    if (typeof id !== "string") {
      throw new Error("createCustomer: no id returned");
    }
    return { targetId: id };
  },
  auditFields: (_ctx, result) => ({ targetId: result.targetId }),
});

export const updateCustomer = defineCommand<UpdateCustomerInput, CrmCommandResult>({
  command: "customer.update",
  auditable: true,
  eventType: "customer.updated",
  targetType: "customer",
  validateInput: validateUpdateCustomer,
  // Ownership: the target customer must be visible under the caller's RLS (own
  // tenant). A foreign id → zero rows → TENANT_ACCESS_DENIED (envelope verify).
  ownership: (input) => ({ table: "customers", id: input.id }),
  execute: async (ctx) => {
    const db = asCrmWriteClient(ctx.db);
    const patch = buildCustomerPatch(ctx.input);
    const { data, error } = await db
      .from("customers")
      .update(patch)
      .eq("id", ctx.input.id)
      .select("id");
    if (error) throwMappedWriteError(error);
    // Ownership already proved the row is visible; a zero-row update here would be a
    // race (row archived/removed between verify and update) → deny rather than 500.
    if (!data || data.length === 0) {
      throw new CommandError("TENANT_ACCESS_DENIED");
    }
    return { targetId: ctx.input.id };
  },
  auditFields: (ctx) => ({ targetId: ctx.input.id }),
});

/** Build the UPDATE patch for a customer (only the supplied fields). */
function buildCustomerPatch(input: UpdateCustomerInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.display_name !== undefined) patch.display_name = input.display_name;
  if (input.personnummer !== undefined) patch.personnummer = input.personnummer;
  if (input.org_nr !== undefined) patch.org_nr = input.org_nr;
  if (input.contact_name !== undefined) patch.contact_name = input.contact_name;
  if (input.email !== undefined) patch.email = input.email;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.address_line1 !== undefined) patch.address_line1 = input.address_line1;
  if (input.address_line2 !== undefined) patch.address_line2 = input.address_line2;
  if (input.postal_code !== undefined) patch.postal_code = input.postal_code;
  if (input.city !== undefined) patch.city = input.city;
  return patch;
}

export const archiveCustomer = defineCommand<ArchiveInput, CrmCommandResult>({
  command: "customer.archive",
  auditable: true,
  eventType: "customer.archived",
  targetType: "customer",
  validateInput: validateArchive,
  ownership: (input) => ({ table: "customers", id: input.id }),
  execute: async (ctx) => {
    const db = asCrmWriteClient(ctx.db);
    // Soft-delete: set archived_at to the SINGLE command instant (deterministic,
    // injected clock — never Date.now()). Never a hard DELETE.
    const archivedAt = ctx.clock.now().toISOString();
    const { data, error } = await db
      .from("customers")
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
