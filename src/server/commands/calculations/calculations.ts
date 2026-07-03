/**
 * Calculation header commands (Story 5.1, Task 3; architecture §5 command table).
 *
 * `createCalculation` / `updateCalculation` / `archiveCalculation` — each a
 * `defineCommand` through the EXISTING envelope (resolve user → resolve active
 * tenant_admin → validate typed input → verify ownership → execute via the RLS client →
 * append-only audit → typed Result). No bespoke auth/error/audit mechanism.
 *
 * - The resolved tenant (`ctx.tenantContext.tenantId`) is the ONLY authority for the
 *   row's `tenant_id`; a client-supplied tenant_id is ignored (the validators never read
 *   it, and execute writes the resolved tenant).
 * - Parent-ownership (Task 3.3): the envelope `ownership` verifies the parent CUSTOMER
 *   belongs to the resolved tenant (a Tenant-B customer_id → invisible under A's RLS →
 *   TENANT_ACCESS_DENIED). The OPTIONAL facility/contact links are enforced at the DB
 *   layer — the INSERT writes the RESOLVED tenant_id, so the composite same-tenant FKs
 *   reject a cross-tenant facility/contact (`23503` → TENANT_ACCESS_DENIED via
 *   `throwMappedWriteError`, never a raw throw).
 * - Audit metadata carries NO PII/money/customer values: the command passes only the
 *   narrow SAFE_FIELDS allow-list shape ({} here), and `sanitizeAuditMetadata` drops
 *   anything else by construction. Calc lifecycle (create/update/archive) is audited;
 *   section/row churn is not (see sections.ts / rows.ts).
 * - Empty-patch guard (inherited epic-3 deferral, Task 3.5): an id-only
 *   updateCalculation short-circuits to a no-op returning the target id rather than
 *   issuing `.update({})`, which PostgREST can turn into a false TENANT_ACCESS_DENIED on
 *   an owned, visible row.
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import { asCalcWriteClient, throwMappedWriteError } from "./calc-db";
import {
  validateArchiveCalc,
  validateCreateCalculation,
  validateUpdateCalculation,
  type ArchiveCalcInput,
  type CreateCalculationInput,
  type UpdateCalculationInput,
} from "./validation";

/** Every calc lifecycle command returns the affected row id under `targetId`. */
export interface CalcCommandResult {
  readonly targetId: string;
}

export const createCalculation = defineCommand<
  CreateCalculationInput,
  CalcCommandResult
>({
  command: "calculation.create",
  auditable: true,
  eventType: "calculation.created",
  targetType: "calculation",
  validateInput: validateCreateCalculation,
  // Parent ownership: the customer must be visible under the caller's RLS (own
  // tenant). A Tenant-B customer_id → zero rows → TENANT_ACCESS_DENIED. The optional
  // facility/contact links are enforced by the composite same-tenant FKs at INSERT.
  ownership: (input) => ({ table: "customers", id: input.customer_id }),
  execute: async (ctx) => {
    const db = asCalcWriteClient(ctx.db);
    const { data, error } = await db
      .from("calculations")
      .insert({
        tenant_id: ctx.tenantContext.tenantId, // resolved tenant, never client id
        customer_id: ctx.input.customer_id,
        facility_id: ctx.input.facility_id ?? null,
        contact_id: ctx.input.contact_id ?? null,
        title: ctx.input.title,
        // status defaults to 'draft' at the DB.
      })
      .select("id")
      .single();
    if (error) throwMappedWriteError(error);
    const id = data?.id;
    if (typeof id !== "string") {
      throw new Error("createCalculation: no id returned");
    }
    return { targetId: id };
  },
  auditFields: (_ctx, result) => ({ targetId: result.targetId }),
});

/** Build the UPDATE patch for a calculation (only the supplied fields). */
function buildCalculationPatch(
  input: UpdateCalculationInput,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.status !== undefined) patch.status = input.status;
  return patch;
}

export const updateCalculation = defineCommand<
  UpdateCalculationInput,
  CalcCommandResult
>({
  command: "calculation.update",
  auditable: true,
  eventType: "calculation.updated",
  targetType: "calculation",
  validateInput: validateUpdateCalculation,
  // Ownership: the target calc must be visible under the caller's RLS (own tenant). A
  // foreign id → zero rows → TENANT_ACCESS_DENIED (envelope verify).
  ownership: (input) => ({ table: "calculations", id: input.id }),
  execute: async (ctx) => {
    const patch = buildCalculationPatch(ctx.input);
    // Empty-patch guard (Task 3.5): an id-only update is a no-op — do NOT issue
    // `.update({})` (PostgREST can map it to zero rows → a false TENANT_ACCESS_DENIED
    // on an owned, visible row). Ownership already proved the row is visible.
    if (Object.keys(patch).length === 0) {
      return { targetId: ctx.input.id };
    }
    const db = asCalcWriteClient(ctx.db);
    const { data, error } = await db
      .from("calculations")
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

export const archiveCalculation = defineCommand<
  ArchiveCalcInput,
  CalcCommandResult
>({
  command: "calculation.archive",
  auditable: true,
  eventType: "calculation.archived",
  targetType: "calculation",
  validateInput: validateArchiveCalc,
  ownership: (input) => ({ table: "calculations", id: input.id }),
  execute: async (ctx) => {
    const db = asCalcWriteClient(ctx.db);
    // Soft-delete: set archived_at to the SINGLE command instant (deterministic,
    // injected clock — never Date.now()). Never a hard DELETE. Also flip status to
    // 'archived' so the lifecycle field and the soft-delete timestamp agree.
    const archivedAt = ctx.clock.now().toISOString();
    const { data, error } = await db
      .from("calculations")
      .update({ archived_at: archivedAt, status: "archived" })
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
