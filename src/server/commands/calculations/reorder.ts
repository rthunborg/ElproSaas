/**
 * Atomic reorder commands (Story 5.1, Task 2/3; architecture ADR-A009).
 *
 * `reorderRows` (and `reorderSections`) are the transaction-sensitive multi-record
 * commands. The Next.js server command handles auth/session/membership/validation via
 * the EXISTING envelope, THEN calls the NARROW SECURITY INVOKER Postgres RPC
 * (`reorder_calculation_rows`) which owns the transaction boundary, the row ordering,
 * and the FULL rollback — NOT client-side multi-step persistence (the explicit 5.1
 * tech-note prohibition + R-503). A mid-transaction failure (a supplied id that is not a
 * same-section row visible under the caller's RLS, or a duplicate id) aborts the WHOLE
 * reorder: the RPC raises `23514` (mapped to VALIDATION_FAILED), and NO partial ordering
 * is committed. The RPC runs under the CALLER's RLS, so there is no service-role app path.
 *
 * Reorder is a HIGH-CHURN editor op — NOT audited (only calc-level lifecycle is, per
 * architecture §15).
 */
import { defineCommand } from "../envelope";
import { asCalcWriteClient, throwMappedReorderError } from "./calc-db";
import type { CalcCommandResult } from "./calculations";
import {
  validateReorderRows,
  validateReorderSections,
  type ReorderRowsInput,
  type ReorderSectionsInput,
} from "./validation";

export const reorderRows = defineCommand<ReorderRowsInput, CalcCommandResult>({
  command: "calculation.rows.reorder",
  auditable: false, // high-churn editor op; only calc-level lifecycle is audited
  eventType: "calculation.rows.reordered",
  targetType: "calculation_section",
  validateInput: validateReorderRows,
  // Parent ownership: the section must be visible under the caller's RLS. A Tenant-B
  // section_id → zero rows → TENANT_ACCESS_DENIED before the RPC ever runs.
  ownership: (input) => ({ table: "calculation_sections", id: input.section_id }),
  execute: async (ctx) => {
    const db = asCalcWriteClient(ctx.db);
    // The narrow ADR-A009 RPC owns the transaction boundary + ordering + rollback. It
    // runs under the caller's RLS (SECURITY INVOKER) so it can only touch own-tenant
    // rows. A bad payload (foreign/nonexistent id or duplicate) raises 23514 → the
    // whole reorder rolls back → VALIDATION_FAILED (no partial order committed, R-503).
    const { error } = await db.rpc("reorder_calculation_rows", {
      p_section_id: ctx.input.section_id,
      p_ordered_row_ids: ctx.input.ordered_row_ids,
    });
    if (error) throwMappedReorderError(error);
    return { targetId: ctx.input.section_id };
  },
});

export const reorderSections = defineCommand<
  ReorderSectionsInput,
  CalcCommandResult
>({
  command: "calculation.sections.reorder",
  auditable: false, // high-churn editor op; only calc-level lifecycle is audited
  eventType: "calculation.sections.reordered",
  targetType: "calculation",
  validateInput: validateReorderSections,
  // Parent ownership: the calculation must be visible under the caller's RLS. A
  // Tenant-B calculation_id → zero rows → TENANT_ACCESS_DENIED before the RPC runs.
  ownership: (input) => ({ table: "calculations", id: input.calculation_id }),
  execute: async (ctx) => {
    const db = asCalcWriteClient(ctx.db);
    // The symmetric ADR-A009 section-level reorder RPC. Same INVOKER + transaction +
    // rollback discipline as reorder_calculation_rows; a bad payload → 23514 →
    // VALIDATION_FAILED, no partial order (R-503).
    const { error } = await db.rpc("reorder_calculation_sections", {
      p_calculation_id: ctx.input.calculation_id,
      p_ordered_section_ids: ctx.input.ordered_section_ids,
    });
    if (error) throwMappedReorderError(error);
    return { targetId: ctx.input.calculation_id };
  },
});
