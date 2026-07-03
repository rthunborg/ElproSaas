/**
 * Calculation row commands (Story 5.1, Task 3; architecture §5 command table).
 *
 * `createRow` / `updateRow` / `archiveRow`. Parent-ownership (Task 3.3): the envelope
 * `ownership` target for `createRow` is the parent SECTION — a Tenant-A command
 * supplying a Tenant-B `section_id` finds the section INVISIBLE under A's RLS → zero
 * rows → TENANT_ACCESS_DENIED. On INSERT the row's `tenant_id` is the RESOLVED tenant
 * (never client-supplied), so the composite same-tenant FK `calculation_rows(section_id,
 * tenant_id) -> calculation_sections(id, tenant_id)` is a DB-level backstop.
 *
 * Money discipline (architecture §10): the command STORES the öre inputs (validated by
 * the CANONICAL `isOreAmount` in the validator), the decimal quantity + unit, the VAT bp
 * assumption, and the visibility/option flags. It does NOT compute any customer-visible
 * total/VAT/deduction — those route through the frozen `@/lib/money` engine in later
 * stories. Row create/update/archive are HIGH-CHURN editor ops — NOT audited (only
 * calc-level lifecycle is, per architecture §15). The server owns `sort_order`.
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import { asCalcWriteClient, throwMappedWriteError } from "./calc-db";
import { nextSortOrder } from "./sort-order";
import type { CalcCommandResult } from "./calculations";
import {
  validateArchiveRow,
  validateCreateRow,
  validateUpdateRow,
  type ArchiveCalcInput,
  type CreateRowInput,
  type UpdateRowInput,
} from "./validation";

/** Build the INSERT payload for a row, scoped to the resolved tenant. */
function rowInsertValues(
  tenantId: string,
  sortOrder: number,
  input: CreateRowInput,
): Record<string, unknown> {
  return {
    tenant_id: tenantId, // resolved tenant — NEVER a client-supplied id
    section_id: input.section_id,
    row_type: input.row_type,
    quantity: input.quantity,
    unit: input.unit,
    unit_cost_ore: input.unit_cost_ore ?? null,
    unit_sell_ore: input.unit_sell_ore ?? null,
    markup_bp: input.markup_bp ?? null,
    vat_rate_bp: input.vat_rate_bp,
    is_hidden: input.is_hidden ?? false,
    is_optional: input.is_optional ?? false,
    is_selected: input.is_selected ?? null,
    label: input.label ?? null,
    description: input.description ?? null,
    internal_note: input.internal_note ?? null,
    quote_note: input.quote_note ?? null,
    sort_order: sortOrder,
  };
}

export const createRow = defineCommand<CreateRowInput, CalcCommandResult>({
  command: "calculation.row.create",
  auditable: false, // high-churn editor op; only calc-level lifecycle is audited
  eventType: "calculation.row.created",
  targetType: "calculation_row",
  validateInput: validateCreateRow,
  // Parent ownership: the section must be visible under the caller's RLS.
  ownership: (input) => ({ table: "calculation_sections", id: input.section_id }),
  execute: async (ctx) => {
    const db = asCalcWriteClient(ctx.db);
    const sortOrder = await nextSortOrder(
      ctx.db,
      "calculation_rows",
      "section_id",
      ctx.input.section_id,
    );
    const { data, error } = await db
      .from("calculation_rows")
      .insert(rowInsertValues(ctx.tenantContext.tenantId, sortOrder, ctx.input))
      .select("id")
      .single();
    if (error) throwMappedWriteError(error);
    const id = data?.id;
    if (typeof id !== "string") {
      throw new Error("createRow: no id returned");
    }
    return { targetId: id };
  },
});

/** Build the UPDATE patch for a row (only the supplied fields). */
function buildRowPatch(input: UpdateRowInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.row_type !== undefined) patch.row_type = input.row_type;
  if (input.quantity !== undefined) patch.quantity = input.quantity;
  if (input.unit !== undefined) patch.unit = input.unit;
  if (input.unit_cost_ore !== undefined) patch.unit_cost_ore = input.unit_cost_ore;
  if (input.unit_sell_ore !== undefined) patch.unit_sell_ore = input.unit_sell_ore;
  if (input.markup_bp !== undefined) patch.markup_bp = input.markup_bp;
  if (input.vat_rate_bp !== undefined) patch.vat_rate_bp = input.vat_rate_bp;
  if (input.is_hidden !== undefined) patch.is_hidden = input.is_hidden;
  if (input.is_optional !== undefined) patch.is_optional = input.is_optional;
  if (input.is_selected !== undefined) patch.is_selected = input.is_selected;
  if (input.label !== undefined) patch.label = input.label;
  if (input.description !== undefined) patch.description = input.description;
  if (input.internal_note !== undefined) patch.internal_note = input.internal_note;
  if (input.quote_note !== undefined) patch.quote_note = input.quote_note;
  return patch;
}

export const updateRow = defineCommand<UpdateRowInput, CalcCommandResult>({
  command: "calculation.row.update",
  auditable: false,
  eventType: "calculation.row.updated",
  targetType: "calculation_row",
  validateInput: validateUpdateRow,
  ownership: (input) => ({ table: "calculation_rows", id: input.id }),
  execute: async (ctx) => {
    const patch = buildRowPatch(ctx.input);
    // Empty-patch guard (Task 3.5): id-only update is a no-op — no `.update({})`.
    if (Object.keys(patch).length === 0) {
      return { targetId: ctx.input.id };
    }
    const db = asCalcWriteClient(ctx.db);
    const { data, error } = await db
      .from("calculation_rows")
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

export const archiveRow = defineCommand<ArchiveCalcInput, CalcCommandResult>({
  command: "calculation.row.archive",
  auditable: false,
  eventType: "calculation.row.archived",
  targetType: "calculation_row",
  validateInput: validateArchiveRow,
  ownership: (input) => ({ table: "calculation_rows", id: input.id }),
  execute: async (ctx) => {
    const db = asCalcWriteClient(ctx.db);
    const archivedAt = ctx.clock.now().toISOString();
    const { data, error } = await db
      .from("calculation_rows")
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
