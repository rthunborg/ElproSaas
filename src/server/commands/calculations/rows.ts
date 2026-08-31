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
import {
  asCalcWriteClient,
  loadActiveCalculationRowCountForSection,
  loadRowOptionState,
  loadRowTaxClassificationState,
  loadRowType,
  loadRowVatState,
  throwMappedWriteError,
} from "./calc-db";
import {
  kindForRowType,
  taxSummaryCategoryForRowType,
} from "./validation";
import { nextSortOrder } from "./sort-order";
import { resolveSnapshotSource } from "@/server/snapshots/resolve-source";
import {
  buildArticleSnapshot,
  buildWorkRoleSnapshot,
  type ArticleSourceRow,
  type WorkRoleSourceRow,
} from "@/lib/snapshots/build";
import type { CommandExecuteContext } from "../envelope-core";
import type { CommandDbClient } from "../envelope";
import { isDeductionClassificationCompatibleWithSummaryCategory } from "@/lib/money";
import { canAddCalculationRow } from "@/features/calculations/limits";
import {
  invoiceInclusionForNewRow,
  invoiceInclusionForOptionSelectionTransition,
} from "@/features/calculations/row-option-transition";
import { isEffectiveRowVatPairCoherent } from "@/features/calculations/row-vat-transition";
import type { CalcCommandResult } from "./calculations";
import {
  validateArchiveRow,
  validateCreateRow,
  validateUpdateRow,
  type ArchiveCalcInput,
  type CreateRowInput,
  type RowSourceKind,
  type UpdateRowInput,
} from "./validation";

/**
 * The `source_*` snapshot columns a resolved pricing source maps onto a row (Story 5.3).
 * A manual/no-source write is all-null; a resolved source is the frozen copy-by-value
 * payload the Story 3.5 builders produce. Every field is written TOGETHER (never a
 * half-cleared / half-set source).
 */
interface RowSourceColumns {
  readonly source_kind: RowSourceKind | null;
  readonly source_id: string | null;
  readonly source_name: string | null;
  readonly source_price_ore: number | null;
  readonly source_cost_ore: number | null;
  readonly source_updated_at: string | null;
  readonly source_captured_at: string | null;
  readonly source_sku: string | null;
  readonly source_unit: string | null;
}

/** The all-null source columns for a manual/no-source (or explicitly cleared) row. */
const NULL_SOURCE_COLUMNS: RowSourceColumns = {
  source_kind: null,
  source_id: null,
  source_name: null,
  source_price_ore: null,
  source_cost_ore: null,
  source_updated_at: null,
  source_captured_at: null,
  source_sku: null,
  source_unit: null,
};

/**
 * Resolve the chosen pricing source under the caller's RLS (Story 3.5 both-layers
 * cross-tenant rejection, layer 1) and BUILD the copy-by-value frozen snapshot (Story 3.5
 * builders), returning the `source_*` columns to persist. The resolver runs on `ctx.db`
 * (the SAME per-request anon-key RLS client — no service-role, no second client). A
 * foreign/nonexistent source id → zero rows → `TENANT_ACCESS_DENIED` (thrown as a
 * CommandError, no snapshot built). A transient resolver `SERVER_ERROR` re-throws a plain
 * Error so the envelope maps it to retryable `SERVER_ERROR` (NOT masked as a denial). The
 * `capturedAt` is the injected clock instant (`ctx.clock.now()`), never `Date.now()`.
 */
async function resolveRowSource(
  ctx: CommandExecuteContext<
    { readonly source_kind: RowSourceKind; readonly source_id: string },
    CommandDbClient
  >,
): Promise<RowSourceColumns> {
  const { source_kind: kind, source_id: sourceId } = ctx.input;
  const capturedAt = ctx.clock.now().toISOString();

  if (kind === "work_role") {
    const resolved = await resolveSnapshotSource({
      client: ctx.db,
      kind,
      sourceId,
    });
    if (!resolved.ok) {
      if (resolved.code === "TENANT_ACCESS_DENIED") {
        throw new CommandError("TENANT_ACCESS_DENIED");
      }
      // Transient resolver fault → plain throw → retryable SERVER_ERROR (never a denial).
      throw new Error(`resolveRowSource(work_role) failed: ${resolved.code}`);
    }
    const snap = buildWorkRoleSnapshot(resolved.data as WorkRoleSourceRow, {
      capturedAt,
    });
    return {
      source_kind: "work_role",
      source_id: snap.sourceId,
      source_name: snap.displayName,
      source_price_ore: snap.sellRateOre, // sell rate → price (prefills the row)
      source_cost_ore: snap.costRateOre, // cost rate → cost provenance
      source_updated_at: snap.sourceUpdatedAt,
      source_captured_at: snap.capturedAt,
      source_sku: null, // work-role-only row: article fields stay null
      source_unit: null,
    };
  }

  // kind === "article"
  const resolved = await resolveSnapshotSource({
    client: ctx.db,
    kind,
    sourceId,
  });
  if (!resolved.ok) {
    if (resolved.code === "TENANT_ACCESS_DENIED") {
      throw new CommandError("TENANT_ACCESS_DENIED");
    }
    throw new Error(`resolveRowSource(article) failed: ${resolved.code}`);
  }
  const snap = buildArticleSnapshot(resolved.data as ArticleSourceRow, {
    capturedAt,
  });
  return {
    source_kind: "article",
    source_id: snap.sourceId,
    source_name: snap.name,
    source_price_ore: snap.unitPriceOre, // unit price → price
    source_cost_ore: null, // an article has no cost rate
    source_updated_at: snap.sourceUpdatedAt,
    source_captured_at: snap.capturedAt,
    source_sku: snap.sku,
    source_unit: snap.unit,
  };
}

/**
 * Build the INSERT payload for a row, scoped to the resolved tenant. `source` carries the
 * frozen copy-by-value pricing-source columns (all-null for a manual/no-source row, or the
 * resolved snapshot for a source-priced row — Story 5.3).
 */
function rowInsertValues(
  tenantId: string,
  sortOrder: number,
  input: CreateRowInput,
  source: RowSourceColumns,
): Record<string, unknown> {
  const isOptional = input.is_optional ?? false;
  const isSelected = input.is_selected ?? null;
  const includedInInvoiceTotal = invoiceInclusionForNewRow({
    isOptional,
    isSelected,
    includedInInvoiceTotal: input.included_in_invoice_total,
  });
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
    included_in_invoice_total: includedInInvoiceTotal,
    deduction_classification: input.deduction_classification ?? "NONE",
    vat_type: input.vat_type ?? "STANDARD_VAT_25",
    is_hidden: input.is_hidden ?? false,
    is_optional: isOptional,
    is_selected: isSelected,
    label: input.label ?? null,
    description: input.description ?? null,
    internal_note: input.internal_note ?? null,
    quote_note: input.quote_note ?? null,
    sort_order: sortOrder,
    // The frozen pricing-source snapshot columns (Story 5.3) — the RESOLVED source's
    // captured values (server-side; never client-supplied name/rate/version), or all-null.
    ...source,
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
    const activeRowCount = await loadActiveCalculationRowCountForSection(
      ctx.db,
      ctx.input.section_id,
    );
    if (activeRowCount === null) throw new CommandError("TENANT_ACCESS_DENIED");
    if (!canAddCalculationRow(activeRowCount)) {
      throw new CommandError("VALIDATION_FAILED");
    }

    // Resolve + freeze the chosen pricing source (Story 5.3) BEFORE the insert, on the
    // SAME per-request RLS client (`ctx.db`). A foreign/nonexistent source → the resolver
    // throws TENANT_ACCESS_DENIED (no row inserted). A manual row → all-null source cols.
    const source =
      ctx.input.source_kind !== undefined && ctx.input.source_id !== undefined
        ? await resolveRowSource(
            ctx as CommandExecuteContext<
              { readonly source_kind: RowSourceKind; readonly source_id: string },
              CommandDbClient
            >,
          )
        : NULL_SOURCE_COLUMNS;

    const db = asCalcWriteClient(ctx.db);
    const sortOrder = await nextSortOrder(
      ctx.db,
      "calculation_rows",
      "section_id",
      ctx.input.section_id,
    );
    const { data, error } = await db
      .from("calculation_rows")
      .insert(
        rowInsertValues(ctx.tenantContext.tenantId, sortOrder, ctx.input, source),
      )
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

/**
 * Build the UPDATE patch for a row (only the supplied fields). `source` — when provided —
 * is the resolved-source columns (a freshly captured snapshot) OR the all-null clear; it is
 * spread into the patch so ALL `source_*` columns move TOGETHER (never a half-set/half-
 * cleared source). When `source` is undefined the source columns are left untouched (a
 * source-less update stays empty-patch-safe — Story 5.3, Task 2.4).
 */
function buildRowPatch(
  input: UpdateRowInput,
  source?: RowSourceColumns,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.row_type !== undefined) patch.row_type = input.row_type;
  if (input.quantity !== undefined) patch.quantity = input.quantity;
  if (input.unit !== undefined) patch.unit = input.unit;
  if (input.unit_cost_ore !== undefined) patch.unit_cost_ore = input.unit_cost_ore;
  if (input.unit_sell_ore !== undefined) patch.unit_sell_ore = input.unit_sell_ore;
  if (input.markup_bp !== undefined) patch.markup_bp = input.markup_bp;
  if (input.vat_rate_bp !== undefined) patch.vat_rate_bp = input.vat_rate_bp;
  if (input.included_in_invoice_total !== undefined) {
    patch.included_in_invoice_total = input.included_in_invoice_total;
  }
  if (input.deduction_classification !== undefined) {
    patch.deduction_classification = input.deduction_classification;
  }
  if (input.vat_type !== undefined) patch.vat_type = input.vat_type;
  if (input.is_hidden !== undefined) patch.is_hidden = input.is_hidden;
  if (input.is_optional !== undefined) patch.is_optional = input.is_optional;
  if (input.is_selected !== undefined) patch.is_selected = input.is_selected;
  if (input.label !== undefined) patch.label = input.label;
  if (input.description !== undefined) patch.description = input.description;
  if (input.internal_note !== undefined) patch.internal_note = input.internal_note;
  if (input.quote_note !== undefined) patch.quote_note = input.quote_note;
  if (source !== undefined) Object.assign(patch, source);
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
    const changesRowType = ctx.input.row_type !== undefined;
    const changesClassification = ctx.input.deduction_classification !== undefined;
    if (changesRowType !== changesClassification) {
      const persisted = await loadRowTaxClassificationState(ctx.db, ctx.input.id);
      if (persisted === null) throw new CommandError("TENANT_ACCESS_DENIED");
      const effectiveRowType = ctx.input.row_type ?? persisted.rowType;
      const effectiveClassification =
        ctx.input.deduction_classification ?? persisted.deductionClassification;
      if (
        !isDeductionClassificationCompatibleWithSummaryCategory(
          effectiveClassification,
          taxSummaryCategoryForRowType(effectiveRowType),
        )
      ) {
        throw new CommandError("VALIDATION_FAILED");
      }
    }

    const changesVatType = ctx.input.vat_type !== undefined;
    const changesVatRate = ctx.input.vat_rate_bp !== undefined;
    if (changesVatType !== changesVatRate) {
      const persisted = await loadRowVatState(ctx.db, ctx.input.id);
      if (persisted === null) throw new CommandError("TENANT_ACCESS_DENIED");
      if (persisted.reconciliationRequired) {
        // Quarantined legacy ambiguity may be resolved only by an explicit complete pair; do not
        // silently treat its old numeric rate as an owner classification decision.
        throw new CommandError("VALIDATION_FAILED");
      }
      if (
        !isEffectiveRowVatPairCoherent(
          {
            vatType: ctx.input.vat_type,
            vatRateBp: ctx.input.vat_rate_bp,
          },
          persisted,
        )
      ) {
        throw new CommandError("VALIDATION_FAILED");
      }
    }

    let inclusionFromSelectionTransition: boolean | undefined;
    if (ctx.input.is_selected !== undefined) {
      const persisted = await loadRowOptionState(ctx.db, ctx.input.id);
      if (persisted === null) throw new CommandError("TENANT_ACCESS_DENIED");
      inclusionFromSelectionTransition = invoiceInclusionForOptionSelectionTransition(
        {
          isOptional: ctx.input.is_optional,
          isSelected: ctx.input.is_selected,
          includedInInvoiceTotal: ctx.input.included_in_invoice_total,
        },
        persisted,
      );
    }

    // Resolve the pricing-source change (Story 5.3), if any, on the SAME per-request RLS
    // client. A source pair → resolve + freeze the captured columns (a foreign source →
    // TENANT_ACCESS_DENIED, no write). An explicit clear (`source_clear`) → all-null
    // source columns TOGETHER (switch back to manual). Otherwise the source columns are
    // left untouched (undefined) so a source-less update stays empty-patch-safe.
    let source: RowSourceColumns | undefined;
    if (ctx.input.source_kind !== undefined && ctx.input.source_id !== undefined) {
      // ROW-TYPE CROSS-CHECK on the UPDATE path (integration review, iter-2 — closes the
      // residual of iter-1 Finding #3). `validateSourcePair` can only cross-check the
      // `row_type ↔ source_kind` contract when `row_type` is in the SAME payload; a
      // SOURCE-ONLY update omits it, so a crafted `{ id, source_kind:"work_role", source_id }`
      // against a persisted material row would otherwise persist a work-role snapshot on a
      // material row (or any source on a no-source subcontractor/machinery/other row). Load
      // the row's REAL persisted `row_type` under the caller's RLS (ownership already proved
      // the row is visible — mirrors how `updateCalculation` loads the real `status` via
      // `loadCalcStatus`), preferring an in-payload `row_type` when the update also changes it,
      // and re-run the cross-check against the AUTHORITATIVE type, rejecting a mismatch.
      const effectiveRowType = ctx.input.row_type ?? (await loadRowType(ctx.db, ctx.input.id));
      // Ownership passed but the row is now gone (race) → deny rather than 500.
      if (effectiveRowType === null) throw new CommandError("TENANT_ACCESS_DENIED");
      if (kindForRowType(effectiveRowType) !== ctx.input.source_kind) {
        throw new CommandError("VALIDATION_FAILED");
      }
      source = await resolveRowSource(
        ctx as CommandExecuteContext<
          { readonly source_kind: RowSourceKind; readonly source_id: string },
          CommandDbClient
        >,
      );
    } else if (ctx.input.source_clear === true) {
      source = NULL_SOURCE_COLUMNS;
    }

    const patch = buildRowPatch(ctx.input, source);
    if (changesVatType && changesVatRate) {
      // An explicit, validator-approved complete pair is the owner remediation action for a
      // quarantined legacy VAT row. Clear both closed metadata halves atomically with the pair.
      patch.tax_reconciliation_required = false;
      patch.tax_reconciliation_reason = null;
    }
    if (
      inclusionFromSelectionTransition !== undefined &&
      ctx.input.included_in_invoice_total === undefined
    ) {
      patch.included_in_invoice_total = inclusionFromSelectionTransition;
    }
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
