/**
 * Work-role pricing commands (Story 3.4, Task 2.2; architecture §5 command table —
 * "upsertWorkRole: Labor pricing. Audit pricing change" / "archiveWorkRole").
 *
 * `upsertWorkRole` / `archiveWorkRole` — each a `defineCommand` through the EXISTING
 * envelope (resolve user → resolve active tenant_admin → validate typed input → verify
 * ownership → execute via the RLS client → append-only audit → typed Result). No
 * bespoke auth/error/audit mechanism. Reuses the CRM write surface (`asCrmWriteClient`)
 * and error mapping (`throwMappedWriteError`) — INSERT+select-single and UPDATE-by-id
 * are identical to the CRM collection commands.
 *
 * COLLECTION shape (NOT the settings singleton): work_roles are MANY-per-tenant, so
 * `upsertWorkRole` BRANCHES on `id` — CREATE (no id) INSERTs a NEW row; UPDATE (id
 * present) edits by id under an `ownership` pre-check. There is NO `unique (tenant_id)`
 * and NO `.upsert({ onConflict: "tenant_id" })`.
 *
 * - The resolved tenant (`ctx.tenantContext.tenantId`) is the ONLY authority for the
 *   row's `tenant_id`; a client-supplied tenant_id is ignored (the validator never
 *   reads it, and execute writes the resolved tenant).
 * - Mutations run on the request-bound RLS client (`ctx.db`); the own-tenant
 *   INSERT/UPDATE policies + the `is_tenant_admin` WITH CHECK keep them in-tenant.
 * - Audit metadata carries NO PII / rate value / name — the command passes only
 *   `{ targetId }`, and `sanitizeAuditMetadata` drops anything else by construction.
 * - NO calculation is performed on the rates (Epic 4 owns the money/VAT engine) — they
 *   are STORED as reusable integer-öre prices only.
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import { asCrmWriteClient, throwMappedWriteError } from "../crm/crm-db";
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
  auditable: true,
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
    const db = asCrmWriteClient(ctx.db);
    const { input } = ctx;

    if (!input.id) {
      // CREATE — INSERT a new row scoped to the resolved tenant.
      const { data, error } = await db
        .from("work_roles")
        .insert({
          tenant_id: ctx.tenantContext.tenantId, // resolved tenant — NEVER client-supplied
          display_name: input.display_name,
          cost_rate_ore: input.cost_rate_ore, // integer öre — never a float
          sell_rate_ore: input.sell_rate_ore,
        })
        .select("id")
        .single();
      if (error) throwMappedWriteError(error);
      const id = data?.id;
      if (typeof id !== "string") {
        throw new Error("upsertWorkRole: no id returned");
      }
      return { targetId: id };
    }

    // UPDATE — edit the role by id (ownership already verified). Only the editable
    // fields are written; the lifecycle flag is owned by the archive command.
    const { data, error } = await db
      .from("work_roles")
      .update({
        display_name: input.display_name,
        cost_rate_ore: input.cost_rate_ore,
        sell_rate_ore: input.sell_rate_ore,
      })
      .eq("id", input.id)
      .select("id");
    if (error) throwMappedWriteError(error);
    // Ownership already proved the row is visible; a zero-row update here would be a
    // race (row removed between verify and update) → deny rather than 500.
    if (!data || data.length === 0) {
      throw new CommandError("TENANT_ACCESS_DENIED");
    }
    return { targetId: input.id };
  },
  // Allow-listed audit metadata — ONLY the target id, NEVER the rate values / name.
  auditFields: (_ctx, result) => ({ targetId: result.targetId }),
});

export const archiveWorkRole = defineCommand<ArchiveInput, PricingCommandResult>({
  command: "work_role.archive",
  auditable: true,
  eventType: "work_role.archived",
  targetType: "work_role",
  validateInput: validateArchive,
  ownership: (input) => ({ table: "work_roles", id: input.id }),
  execute: async (ctx) => {
    const db = asCrmWriteClient(ctx.db);
    // Soft archive: flip is_active=false (the row STILL EXISTS). Never a hard DELETE.
    // The set_updated_at trigger stamps updated_at; the injected clock is used by the
    // audit row, never Date.now().
    const { data, error } = await db
      .from("work_roles")
      .update({ is_active: false })
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
