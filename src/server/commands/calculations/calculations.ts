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
import {
  asCalcLifecycleRpcClient,
  extractCalculationLifecycleId,
  loadCalcStatus,
  throwMappedWriteError,
} from "./calc-db";
import {
  isLegalTransition,
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
  // The checked RPC owns the calculation insert and its audit row in one
  // transaction. The generic audit RPC remains Admin-only and must not become
  // a non-admin escape hatch.
  auditable: false,
  eventType: "calculation.created",
  targetType: "calculation",
  validateInput: validateCreateCalculation,
  // Parent ownership: the customer must be visible under the caller's RLS (own
  // tenant). A Tenant-B customer_id → zero rows → TENANT_ACCESS_DENIED. The optional
  // facility/contact links are enforced by the composite same-tenant FKs at INSERT.
  ownership: (input) => ({ table: "customers", id: input.customer_id }),
  execute: async (ctx) => {
    const rpc = asCalcLifecycleRpcClient(ctx.db);
    const { data, error } = await rpc.rpc("create_calculation_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_customer_id: ctx.input.customer_id,
      p_facility_id: ctx.input.facility_id ?? null,
      p_contact_id: ctx.input.contact_id ?? null,
      p_title: ctx.input.title,
    });
    if (error) throwMappedWriteError(error);
    const id = extractCalculationLifecycleId(data);
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
  if (input.tax_input_snapshot !== undefined) {
    patch.tax_input_snapshot = input.tax_input_snapshot;
  }
  return patch;
}

export const updateCalculation = defineCommand<
  UpdateCalculationInput,
  CalcCommandResult
>({
  command: "calculation.update",
  // See createCalculation: the checked RPC atomically owns this audit write.
  auditable: false,
  eventType: "calculation.updated",
  targetType: "calculation",
  validateInput: validateUpdateCalculation,
  // Ownership: the target calc must be visible under the caller's RLS (own tenant). A
  // foreign id → zero rows → TENANT_ACCESS_DENIED (envelope verify).
  ownership: (input) => ({ table: "calculations", id: input.id }),
  execute: async (ctx) => {
    // Lifecycle state machine is AUTHORITATIVE against the REAL row (findings 1 & 2).
    // When the update carries a `status`, load the target row's ACTUAL current status
    // from the DB (under the caller's RLS — ownership already proved it is visible) and
    // validate the transition against it. A client can no longer force an illegal
    // `archived → ready` move by omitting/spoofing a `currentStatus`; and because
    // `archived → active` is blocked, `status` and `archived_at` cannot silently
    // disagree (an archived row's `archived_at` is never cleared by a revive here — no
    // revive path exists; a future legitimate un-archive must clear `archived_at` in the
    // same UPDATE).
    if (ctx.input.status !== undefined) {
      const current = await loadCalcStatus(ctx.db, ctx.input.id);
      // Ownership passed but the row is now gone (race) → deny rather than 500.
      if (current === null) throw new CommandError("TENANT_ACCESS_DENIED");
      if (!isLegalTransition(current, ctx.input.status)) {
        throw new CommandError("VALIDATION_FAILED");
      }
    }
    const patch = buildCalculationPatch(ctx.input);
    // Empty-patch guard (Task 3.5): an id-only update is a no-op — do NOT issue
    // `.update({})` (PostgREST can map it to zero rows → a false TENANT_ACCESS_DENIED
    // on an owned, visible row). Ownership already proved the row is visible.
    if (Object.keys(patch).length === 0) {
      return { targetId: ctx.input.id };
    }
    const rpc = asCalcLifecycleRpcClient(ctx.db);
    const { data, error } = await rpc.rpc("update_calculation_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_calculation_id: ctx.input.id,
      p_patch: patch,
    });
    if (error) throwMappedWriteError(error);
    // Ownership already proved the row is visible; a zero-row update here would be a
    // race (row archived/removed between verify and update) → deny rather than 500.
    if (extractCalculationLifecycleId(data) === null) {
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
  // See createCalculation: the checked RPC atomically owns this audit write.
  auditable: false,
  eventType: "calculation.archived",
  targetType: "calculation",
  validateInput: validateArchiveCalc,
  ownership: (input) => ({ table: "calculations", id: input.id }),
  execute: async (ctx) => {
    // Soft-delete: set archived_at to the SINGLE command instant (deterministic,
    // injected clock — never Date.now()). Never a hard DELETE. Also flip status to
    // 'archived' so the lifecycle field and the soft-delete timestamp agree.
    const archivedAt = ctx.clock.now().toISOString();
    const rpc = asCalcLifecycleRpcClient(ctx.db);
    const { data, error } = await rpc.rpc("archive_calculation_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_calculation_id: ctx.input.id,
      p_archived_at: archivedAt,
    });
    if (error) throwMappedWriteError(error);
    if (extractCalculationLifecycleId(data) === null) {
      throw new CommandError("TENANT_ACCESS_DENIED");
    }
    return { targetId: ctx.input.id };
  },
  auditFields: (ctx) => ({ targetId: ctx.input.id }),
});
