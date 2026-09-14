import { adminQuery } from "../admin-sql";
import { rethrowWithCode } from "./core";
export interface CalculationSeed {
  readonly tenant_id: string;
  readonly customer_id: string;
  readonly facility_id?: string | null;
  readonly contact_id?: string | null;
  readonly title?: string;
  readonly status?: "draft" | "ready" | "archived";
  /** Story 10.6: complete versioned tax input, stored as one atomic JSON document. */
  readonly tax_input_snapshot?: Readonly<Record<string, unknown>> | null;
}

/** A seed for a `calculation_sections` row (parent calc required, same tenant). */
export interface CalculationSectionSeed {
  readonly tenant_id: string;
  readonly calculation_id: string;
  readonly title?: string | null;
  readonly display_mode?: "detailed" | "summary" | "text_only";
  readonly sort_order?: number;
}

/** A seed for a `calculation_rows` row (parent section required, same tenant). */
export interface CalculationRowSeed {
  readonly tenant_id: string;
  readonly section_id: string;
  readonly row_type?: "labor" | "material" | "subcontractor" | "machinery" | "other";
  readonly quantity?: number;
  readonly unit?: string;
  readonly unit_cost_ore?: number | null;
  readonly unit_sell_ore?: number | null;
  readonly vat_rate_bp?: number | null;
  readonly included_in_invoice_total?: boolean;
  readonly deduction_classification?:
    | "NONE"
    | "ROT_LABOR"
    | "GREEN_SOLAR_LABOR"
    | "GREEN_SOLAR_MATERIAL"
    | "GREEN_STORAGE_LABOR"
    | "GREEN_STORAGE_MATERIAL"
    | "GREEN_CHARGING_LABOR"
    | "GREEN_CHARGING_MATERIAL";
  readonly vat_type?:
    | "STANDARD_VAT_25"
    | "REDUCED_VAT"
    | "ZERO_RATED"
    | "REVERSE_CHARGE_CONSTRUCTION";
  readonly is_hidden?: boolean;
  readonly is_optional?: boolean;
  readonly is_selected?: boolean | null;
  readonly label?: string | null;
  readonly sort_order?: number;
}

/** Canonical deduction-free Story 10.6 input for calculations not testing legacy/null behavior. */
export function story106FixtureTaxInput(): Record<string, unknown> {
  return {
    schemaVersion: 2,
    documentVatType: "STANDARD_VAT_25",
    buyerVatNumber: null,
    deductionChoice: "NONE",
    paymentDate: null,
    finalPaymentDate: null,
    personAllowanceSlots: [],
    greenBasisMethod: "ACTUAL_ELIGIBLE_COSTS",
    genuineFixedPrice: false,
    fixedPriceOre: null,
    fixedPriceCategorySplitOre: null,
    fixedPriceRowIds: null,
  };
}

/**
 * Seed ONE `calculations` row via the privileged superuser pg path (BYPASSRLS).
 * Returns the inserted id. THROWS (Postgres `code` preserved) on a DB error —
 * including the composite same-tenant FK `23503` if `customer_id`'s tenant differs.
 */
export async function adminInsertCalculation(
  seed: CalculationSeed,
): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.calculations
         (tenant_id, customer_id, facility_id, contact_id, title, status, tax_input_snapshot)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb)
       returning id`,
      [
        seed.tenant_id,
        seed.customer_id,
        seed.facility_id ?? null,
        seed.contact_id ?? null,
        seed.title ?? "tenant-calc-seed",
        seed.status ?? "draft",
        seed.tax_input_snapshot === undefined
          ? story106FixtureTaxInput()
          : seed.tax_input_snapshot,
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertCalculation: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/**
 * Seed ONE `calculation_sections` row via the privileged superuser pg path (BYPASSRLS).
 * Returns the inserted id. THROWS (Postgres `code` preserved) on a DB error.
 */
export async function adminInsertSection(
  seed: CalculationSectionSeed,
): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.calculation_sections
         (tenant_id, calculation_id, title, display_mode, sort_order)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [
        seed.tenant_id,
        seed.calculation_id,
        seed.title ?? "tenant-section-seed",
        seed.display_mode ?? "detailed",
        seed.sort_order ?? 0,
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertSection: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/**
 * Seed ONE `calculation_rows` row via the privileged superuser pg path (BYPASSRLS).
 * Returns the inserted id. THROWS (Postgres `code` preserved) on a DB error. Only the
 * closed-union / integer-öre / bp columns are written — NO supplier scope of any kind.
 */
export async function adminInsertRow(seed: CalculationRowSeed): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.calculation_rows
         (tenant_id, section_id, row_type, quantity, unit,
          unit_cost_ore, unit_sell_ore, vat_rate_bp,
          included_in_invoice_total, deduction_classification, vat_type,
          is_hidden, is_optional, is_selected, label, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8,
               $9, $10, $11, $12, $13, $14, $15, $16)
       returning id`,
      [
        seed.tenant_id,
        seed.section_id,
        seed.row_type ?? "labor",
        seed.quantity ?? 1,
        seed.unit ?? "h",
        seed.unit_cost_ore ?? null,
        seed.unit_sell_ore ?? null,
        seed.vat_rate_bp ?? 2500,
        seed.included_in_invoice_total ?? true,
        seed.deduction_classification ?? "NONE",
        seed.vat_type ?? "STANDARD_VAT_25",
        seed.is_hidden ?? false,
        seed.is_optional ?? false,
        seed.is_selected ?? null,
        seed.label ?? null,
        seed.sort_order ?? 0,
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertRow: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/** A calc row as read back independently (BYPASSRLS) — proves persisted state. */
export interface CalcRowReadback {
  readonly id: string;
  readonly tenant_id: string;
  readonly title?: string | null;
  readonly status?: string | null;
  readonly archived_at: string | null;
}

/**
 * Read ONE calc row back via the privileged superuser pg path (BYPASSRLS), independent
 * of the app/RLS path. Returns `null` if the row does not exist (so a "soft-delete, not
 * hard-delete" negative can prove the row STILL EXISTS). `table` is one of the three
 * calc tables (a closed union, never client input, so the interpolation is safe). Only
 * `calculations` carries `title`/`status`; sections/rows have neither, so those are read
 * as null via a CASE-free per-table projection.
 */
export async function adminSelectCalcRowById(
  table: "calculations" | "calculation_sections" | "calculation_rows",
  id: string,
): Promise<CalcRowReadback | null> {
  const labelSelect =
    table === "calculations"
      ? "title, status"
      : "null::text as title, null::text as status";
  const rows = await adminQuery<CalcRowReadback>(
    `select id, tenant_id, ${labelSelect}, archived_at
       from public.${table}
      where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Read ONE calc row's rls-invisible label column back via the privileged superuser pg
 * path (BYPASSRLS), independent of the app/RLS path. Used by the cross-tenant UPDATE
 * negative to prove the foreign calc row is UNCHANGED (its label was NOT overwritten by
 * Tenant A's denied UPDATE). `table`/`labelColumn` are a closed/inventory-supplied set
 * (calculations.title / calculation_sections.title / calculation_rows.label), never
 * client input. Returns `null` if the row does not exist.
 */
export async function adminSelectCalcLabel(
  table: "calculations" | "calculation_sections" | "calculation_rows",
  labelColumn: string,
  id: string,
): Promise<{ id: string; label: string | null } | null> {
  const rows = await adminQuery<{ id: string; label: string | null }>(
    `select id, ${labelColumn} as label from public.${table} where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// File seed/read/upload helpers (Story 8.1, Task 7.3) — ADDITIVE (B1: add ALONGSIDE
// the existing handles; the two-tenant fixture shape is unchanged).
//
// Seed REAL `files`/`file_links` rows via the loopback-gated superuser `pg` pool
// (BYPASSRLS) so the cross-tenant/anon negatives can target a CONCRETE Tenant B file
// row (never a non-existent id that would deny vacuously), the command tests can seed
// an own-tenant file to sign/link, and the atomicity re-read can prove zero orphans.
// Also seed a REAL storage OBJECT (via the service-role storage API) so the
// storage-plane isolation suite has a concrete Tenant-B object to be denied. Mirror
// `adminInsertCustomer`: THROW on a DB error with the Postgres `code` preserved.
//
// File tables are `tenant_id … on delete cascade`, so the EXISTING `cleanupFixture`
// tenant-delete cascades the seeded metadata rows away. Seeded storage OBJECTS are NOT
// cascaded by the tenant delete (they live in `storage.objects`); tests seed under
// unique per-fixture paths so they do not collide across runs, and the local stack is
// reset between CI runs.
//
// File fixtures carry METADATA SHAPE only — anonymized display names, NO raw file
// content, NO real names/addresses/personnummer/orgnr, NO PII (Task 9, R-819).
// ─────────────────────────────────────────────────────────────────────────────

/** A seed for a `files` row (the snake_case columns the negatives/commands target). */
