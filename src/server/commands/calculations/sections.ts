/**
 * Calculation section commands (Story 5.1, Task 3; architecture §5 command table).
 *
 * `createSection` / `updateSection` / `archiveSection`. Parent-ownership (Task 3.3):
 * the envelope `ownership` target for `createSection` is the parent CALCULATION — a
 * Tenant-A command supplying a Tenant-B `calculation_id` finds the calc INVISIBLE under
 * A's RLS → zero rows → TENANT_ACCESS_DENIED. On INSERT the section's `tenant_id` is the
 * RESOLVED tenant (never client-supplied), so the composite same-tenant FK
 * `calculation_sections(calculation_id, tenant_id) -> calculations(id, tenant_id)` is a
 * DB-level backstop against a cross-tenant parent link.
 *
 * Section create/update/archive are HIGH-CHURN editor operations — they are NOT
 * audited (auditable: false). Only calc-LEVEL lifecycle is audited (calculations.ts),
 * per architecture §15 (audit calc lifecycle, not every keystroke). The server owns the
 * `sort_order` — it is computed from the existing siblings, never client-supplied.
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import { asCalcWriteClient, throwMappedWriteError } from "./calc-db";
import { nextSortOrder } from "./sort-order";
import type { CalcCommandResult } from "./calculations";
import {
  validateArchiveSection,
  validateCreateSection,
  validateUpdateSection,
  type ArchiveCalcInput,
  type CreateSectionInput,
  type UpdateSectionInput,
} from "./validation";

export const createSection = defineCommand<CreateSectionInput, CalcCommandResult>({
  command: "calculation.section.create",
  auditable: false, // high-churn editor op; only calc-level lifecycle is audited
  eventType: "calculation.section.created",
  targetType: "calculation_section",
  validateInput: validateCreateSection,
  // Parent ownership: the calculation must be visible under the caller's RLS.
  ownership: (input) => ({ table: "calculations", id: input.calculation_id }),
  execute: async (ctx) => {
    const db = asCalcWriteClient(ctx.db);
    // Server-owned ordering: append after the existing siblings of this calc.
    const sortOrder = await nextSortOrder(
      ctx.db,
      "calculation_sections",
      "calculation_id",
      ctx.input.calculation_id,
    );
    const { data, error } = await db
      .from("calculation_sections")
      .insert({
        tenant_id: ctx.tenantContext.tenantId, // resolved tenant, never client id
        calculation_id: ctx.input.calculation_id,
        title: ctx.input.title ?? null,
        display_mode: ctx.input.display_mode ?? "detailed",
        sort_order: sortOrder,
      })
      .select("id")
      .single();
    if (error) throwMappedWriteError(error);
    const id = data?.id;
    if (typeof id !== "string") {
      throw new Error("createSection: no id returned");
    }
    return { targetId: id };
  },
});

function buildSectionPatch(input: UpdateSectionInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.display_mode !== undefined) patch.display_mode = input.display_mode;
  return patch;
}

export const updateSection = defineCommand<UpdateSectionInput, CalcCommandResult>({
  command: "calculation.section.update",
  auditable: false,
  eventType: "calculation.section.updated",
  targetType: "calculation_section",
  validateInput: validateUpdateSection,
  ownership: (input) => ({ table: "calculation_sections", id: input.id }),
  execute: async (ctx) => {
    const patch = buildSectionPatch(ctx.input);
    // Empty-patch guard (Task 3.5): id-only update is a no-op — no `.update({})`.
    if (Object.keys(patch).length === 0) {
      return { targetId: ctx.input.id };
    }
    const db = asCalcWriteClient(ctx.db);
    const { data, error } = await db
      .from("calculation_sections")
      .update(patch)
      .eq("id", ctx.input.id)
      .select("id");
    if (error) throwMappedWriteError(error);
    if (!data || data.length === 0) {
      throw new CommandError("TENANT_ACCESS_DENIED");
    }
    return { targetId: ctx.input.id };
  },
});

export const archiveSection = defineCommand<ArchiveCalcInput, CalcCommandResult>({
  command: "calculation.section.archive",
  auditable: false,
  eventType: "calculation.section.archived",
  targetType: "calculation_section",
  validateInput: validateArchiveSection,
  ownership: (input) => ({ table: "calculation_sections", id: input.id }),
  execute: async (ctx) => {
    const db = asCalcWriteClient(ctx.db);
    const archivedAt = ctx.clock.now().toISOString();
    const { data, error } = await db
      .from("calculation_sections")
      .update({ archived_at: archivedAt })
      .eq("id", ctx.input.id)
      .select("id");
    if (error) throwMappedWriteError(error);
    if (!data || data.length === 0) {
      throw new CommandError("TENANT_ACCESS_DENIED");
    }
    return { targetId: ctx.input.id };
  },
});
