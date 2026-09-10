/**
 * Work-role pricing commands (Story 3.4, Task 2.2; architecture §5 command table —
 * "upsertWorkRole: Labor pricing. Audit pricing change" / "archiveWorkRole").
 *
 * `upsertWorkRole` / `archiveWorkRole` — each a `defineCommand` through the EXISTING
 * envelope (resolve user → resolve active tenant_admin → validate typed input → verify
 * ownership → execute through a checked database wrapper → atomic audit → typed Result). No
 * bespoke auth/error/audit mechanism. Reuses the shared mapped write errors and
 * uses a command-specific checked RPC so the pricing mutation and audit insert
 * are one transaction for Projektledare as well as Admin.
 *
 * COLLECTION shape (NOT the settings singleton): work_roles are MANY-per-tenant, so
 * `upsertWorkRole` BRANCHES on `id` — CREATE (no id) INSERTs a NEW row; UPDATE (id
 * present) edits by id under an `ownership` pre-check. There is NO `unique (tenant_id)`
 * and NO `.upsert({ onConflict: "tenant_id" })`.
 *
 * - The resolved tenant (`ctx.tenantContext.tenantId`) is the ONLY authority for the
 *   row's `tenant_id`; a client-supplied tenant_id is ignored (the validator never
 *   reads it, and execute writes the resolved tenant).
 * - Mutations use the request-bound client to invoke an authenticated-only,
 *   command-specific wrapper. The wrapper rechecks tenant/actor role authority and
 *   owns target scope plus the mutation/audit transaction.
 * - Audit metadata carries NO PII / rate value / name — the command passes only
 *   `{ targetId }`, and `sanitizeAuditMetadata` drops anything else by construction.
 * - NO calculation is performed on the rates (Epic 4 owns the money/VAT engine) — they
 *   are STORED as reusable integer-öre prices only.
 */
import { defineCommand } from "../envelope";
import {
  asPricingAuditRpcClient,
  throwMappedWriteError,
} from "./pricing-db";
import {
  validateArchive,
  validateUpsertWorkRole,
  type ArchiveInput,
  type UpsertWorkRoleInput,
} from "./validation";

/** Every pricing lifecycle command returns the affected row id under `targetId`. */
export interface PricingCommandResult {
  readonly targetId: string;
}

export const upsertWorkRole = defineCommand<
  UpsertWorkRoleInput,
  PricingCommandResult
>({
  command: "work_role.upsert",
  // The checked RPC owns both the write and its bound audit event in one DB
  // transaction. Keeping this false prevents the generic, Admin-only audit RPC
  // from duplicating the event after the RPC commits.
  auditable: false,
  eventType: "work_role.upserted",
  targetType: "work_role",
  validateInput: validateUpsertWorkRole,
  // Ownership applies ONLY to an UPDATE (id present): the target row must be visible
  // under the caller's RLS (own tenant). A foreign id → zero rows → TENANT_ACCESS_DENIED
  // (envelope verify). A CREATE (no id) has no pre-existing row, so it returns null and
  // the INSERT WITH CHECK keeps the new row in-tenant.
  ownership: (input) =>
    input.id ? { table: "work_roles", id: input.id } : null,
  execute: async (ctx) => {
    const db = asPricingAuditRpcClient(ctx.db);
    const { input } = ctx;

    const { data, error } = await db.rpc("upsert_work_role_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_work_role_id: input.id ?? null,
      p_display_name: input.display_name,
      p_cost_rate_ore: input.cost_rate_ore,
      p_sell_rate_ore: input.sell_rate_ore,
    });
    if (error) throwMappedWriteError(error);
    if (typeof data !== "string") {
      throw new Error("upsertWorkRole: no id returned");
    }
    return { targetId: data };
  },
  // Allow-listed audit metadata — ONLY the target id, NEVER the rate values / name.
  auditFields: (_ctx, result) => ({ targetId: result.targetId }),
});

export const archiveWorkRole = defineCommand<ArchiveInput, PricingCommandResult>({
  command: "work_role.archive",
  auditable: false,
  eventType: "work_role.archived",
  targetType: "work_role",
  validateInput: validateArchive,
  ownership: (input) => ({ table: "work_roles", id: input.id }),
  execute: async (ctx) => {
    const db = asPricingAuditRpcClient(ctx.db);
    const { data, error } = await db.rpc("set_work_role_active_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_work_role_id: ctx.input.id,
      p_is_active: false,
    });
    if (error) throwMappedWriteError(error);
    if (typeof data !== "string") {
      throw new Error("archiveWorkRole: no id returned");
    }
    return { targetId: data };
  },
  auditFields: (ctx) => ({ targetId: ctx.input.id }),
});

/**
 * REACTIVATE — the inverse of archive: flip `is_active` back to `true` so an archived role
 * returns to the active list (Story 3.4 AC2 "creates / updates / archives / REACTIVATES a
 * role"). Same shape as `archiveWorkRole` (id-only input, ownership pre-check, ONE audit row
 * with allow-listed `{ targetId }`), so archive is a REVERSIBLE door — never a one-way delete.
 */
export const reactivateWorkRole = defineCommand<
  ArchiveInput,
  PricingCommandResult
>({
  command: "work_role.reactivate",
  auditable: false,
  eventType: "work_role.reactivated",
  targetType: "work_role",
  validateInput: validateArchive,
  ownership: (input) => ({ table: "work_roles", id: input.id }),
  execute: async (ctx) => {
    const db = asPricingAuditRpcClient(ctx.db);
    const { data, error } = await db.rpc("set_work_role_active_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_work_role_id: ctx.input.id,
      p_is_active: true,
    });
    if (error) throwMappedWriteError(error);
    if (typeof data !== "string") {
      throw new Error("reactivateWorkRole: no id returned");
    }
    return { targetId: data };
  },
  auditFields: (ctx) => ({ targetId: ctx.input.id }),
});
