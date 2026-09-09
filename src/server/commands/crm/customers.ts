/**
 * CRM customer commands (Story 3.1, Task 2; architecture §5 command table).
 *
 * `createCustomer` / `updateCustomer` / `archiveCustomer` — each a `defineCommand`
 * through the existing envelope (resolve user → resolve active membership →
 * capability gate → validate typed input → verify ownership → execute → typed
 * Result). Audited operations persist their audit event through either the envelope
 * or a checked, transaction-atomic command RPC.
 *
 * - The resolved tenant (`ctx.tenantContext.tenantId`) is the ONLY authority for the
 *   row's `tenant_id`; a client-supplied tenant_id is ignored (the validators never
 *   read it, and execute writes the resolved tenant).
 * - Mutations run on the request-bound client (`ctx.db`). `customer.create` uses a
 *   role-checked RPC that binds the resolved tenant and actor; remaining customer
 *   writes continue through RLS while their Story 11.2 wrappers are migrated.
 * - Audit metadata carries NO PII (personnummer / org_nr / name / email / address):
 *   the command passes only the narrow SAFE_FIELDS allow-list shape ({} here), and
 *   `sanitizeAuditMetadata` drops anything else by construction.
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import {
  asCreateCustomerWithAuditRpcClient,
  asCrmWriteClient,
  throwMappedWriteError,
} from "./crm-db";
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

export const createCustomer = defineCommand<CreateCustomerInput, CrmCommandResult>({
  command: "customer.create",
  // The checked RPC owns the customer INSERT and audit INSERT in one database
  // transaction. A second envelope audit would duplicate the event and would
  // reintroduce the non-admin raw-audit authority conflict.
  auditable: false,
  eventType: "customer.created",
  targetType: "customer",
  validateInput: validateCreateCustomer,
  // No ownership target — a create has no pre-existing row. The checked RPC binds
  // the resolved tenant/actor and enforces the Customers.Create role set itself.
  execute: async (ctx) => {
    const db = asCreateCustomerWithAuditRpcClient(ctx.db);
    const { data, error } = await db.rpc("create_customer_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_customer_type: ctx.input.customer_type,
      p_display_name: ctx.input.display_name,
      p_personnummer: ctx.input.personnummer ?? null,
      p_org_nr: ctx.input.org_nr ?? null,
      p_contact_name: ctx.input.contact_name ?? null,
      p_email: ctx.input.email ?? null,
      p_phone: ctx.input.phone ?? null,
      p_address_line1: ctx.input.address_line1 ?? null,
      p_address_line2: ctx.input.address_line2 ?? null,
      p_postal_code: ctx.input.postal_code ?? null,
      p_city: ctx.input.city ?? null,
    });
    if (error) throwMappedWriteError(error);
    const id = typeof data === "string" ? data : null;
    if (typeof id !== "string") {
      throw new Error("createCustomer: no id returned");
    }
    return { targetId: id };
  },
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
