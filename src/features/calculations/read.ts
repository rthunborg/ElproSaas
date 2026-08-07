/**
 * Server-side calculation reads for the editor + list (Story 5.2, Task 1) — the
 * RLS-scoped read path the `/calculations` pages call. SERVER-ONLY (no `"use server"`
 * action surface): these are plain async functions invoked from server components,
 * mirroring `src/features/crm/read.ts` EXACTLY.
 *
 * EVERY read runs on the per-request, cookie-bound RLS client (anon key — NEVER a
 * service-role key). RLS scopes every row to the caller's tenant with NO tenant id
 * passed (architecture §6); a cross-tenant/nonexistent id simply returns zero rows → a
 * GENERIC not-found (the page NEVER reveals whether the row exists in another tenant).
 * NO direct write, NO service-role client — reads only here; all writes go through the
 * 5.1 envelope commands (`src/features/calculations/actions.ts`).
 *
 * CRITICAL (private-data posture, inherited from epic-3): the customer-context block
 * selects ONLY display_name/type + facility/contact NAME fields — it NEVER selects
 * `personnummer` into this payload (owner decision 2026-06-18; the calc detail must not
 * repeat the epic-3 pnr-in-client-payload trap). The Story 5.3 `source_*` snapshot columns
 * ARE selected (the AC3 explainability surface — a role/article NAME + rate + version, no
 * PII) but NO supplier/import/deferred column exists to select. The provenance is read from
 * the FROZEN row columns, NEVER a live re-read of the mutable work_role/article source.
 */
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import type {
  DeductionClassification,
  TaxInputSnapshotV2,
  VatType,
} from "@/lib/money";

const GENERIC_READ_ERROR =
  "Ett tillfälligt fel inträffade. Försök igen om en stund.";

/** The lifecycle status of a calculation (mirrors the 5.1 closed set). */
export type CalcStatus = "draft" | "ready" | "archived";

/** A calc list row (the `/calculations` index projection). */
export interface CalculationListRow {
  readonly id: string;
  readonly title: string;
  readonly status: CalcStatus;
  readonly customer_display_name: string | null;
  readonly updated_at: string;
}

/** Result of the list read — rows OR a generic error message (never a leaked detail). */
export interface CalculationListReadResult {
  readonly rows: readonly CalculationListRow[];
  readonly error: string | null;
}

/**
 * Read the ACTIVE calculation list (archived rows excluded — `archived_at is null`),
 * ordered by `updated_at` desc. RLS scopes to the caller's tenant. The customer
 * display_name is joined via the embedded `customers(display_name)` relationship (a
 * tenant-scoped SELECT — RLS restricts the join to own-tenant customers). On a query
 * error returns a GENERIC Swedish message (the FAILED state) — never a leaked stack/SQL.
 */
export async function readCalculationList(): Promise<CalculationListReadResult> {
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client
      .from("calculations")
      .select("id, title, status, updated_at, customers(display_name)")
      .is("archived_at", null)
      .order("updated_at", { ascending: false });
    if (error) return { rows: [], error: GENERIC_READ_ERROR };
    const rows: CalculationListRow[] = (data ?? []).map((r) => {
      const rec = r as unknown as {
        id: string;
        title: string;
        status: CalcStatus;
        updated_at: string;
        // PostgREST returns an embedded to-one relationship as an object (or array
        // depending on the FK shape) — normalise either into a display_name string.
        customers: { display_name: string | null } | { display_name: string | null }[] | null;
      };
      const customer = Array.isArray(rec.customers) ? rec.customers[0] : rec.customers;
      return {
        id: rec.id,
        title: rec.title,
        status: rec.status,
        customer_display_name: customer?.display_name ?? null,
        updated_at: rec.updated_at,
      };
    });
    return { rows, error: null };
  } catch {
    return { rows: [], error: GENERIC_READ_ERROR };
  }
}

/** A calc header row for the editor (snake_case, camelCased where useful downstream). */
export interface CalculationHeaderRow {
  readonly id: string;
  readonly title: string;
  readonly status: CalcStatus;
  readonly customer_id: string;
  readonly facility_id: string | null;
  readonly contact_id: string | null;
  readonly archived_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly tax_input_snapshot: TaxInputSnapshotV2 | null;
}

/** A calc row (line) for the editor — the 1:1 mapping of the 5.1 row input fields. */
export interface CalculationRowRow {
  readonly id: string;
  readonly section_id: string;
  readonly row_type: "labor" | "material" | "subcontractor" | "machinery" | "other";
  readonly quantity: number;
  readonly unit: string;
  readonly unit_cost_ore: number | null;
  readonly unit_sell_ore: number | null;
  readonly markup_bp: number | null;
  readonly vat_rate_bp: number | null;
  readonly included_in_invoice_total: boolean;
  readonly deduction_classification: DeductionClassification;
  readonly vat_type: VatType | null;
  readonly is_hidden: boolean;
  readonly is_optional: boolean;
  readonly is_selected: boolean | null;
  readonly label: string | null;
  readonly description: string | null;
  readonly internal_note: string | null;
  readonly quote_note: string | null;
  readonly sort_order: number;
  // Story 5.3 — the FROZEN pricing-source snapshot columns (the AC3 explainability
  // surface). The row is explainable from its OWN captured fields; the editor renders
  // provenance from THESE, never a live re-read of the (possibly changed/archived)
  // work_role/article. No PII — only a role/article name + rate + version.
  readonly source_kind: "work_role" | "article" | null;
  readonly source_id: string | null;
  readonly source_name: string | null;
  readonly source_price_ore: number | null;
  readonly source_cost_ore: number | null;
  readonly source_updated_at: string | null;
  readonly source_captured_at: string | null;
  readonly source_sku: string | null;
  readonly source_unit: string | null;
}

/** A calc section for the editor, with its ordered active rows. */
export interface CalculationSectionRow {
  readonly id: string;
  readonly title: string | null;
  readonly display_mode: "detailed" | "summary" | "text_only";
  readonly sort_order: number;
  readonly rows: readonly CalculationRowRow[];
}

/**
 * The customer-context block for the editor header — display fields ONLY. NEVER carries
 * `personnummer` (private-data posture). `facility_name`/`contact_name` are present only
 * when the calc links a facility/contact.
 */
export interface CalculationCustomerContext {
  readonly customer_id: string;
  readonly customer_display_name: string | null;
  readonly customer_type: string | null;
  readonly facility_name: string | null;
  readonly contact_name: string | null;
}

/** The assembled calc-detail read (header + ordered sections/rows + customer context). */
export interface CalculationDetail {
  readonly header: CalculationHeaderRow;
  readonly sections: readonly CalculationSectionRow[];
  readonly customer: CalculationCustomerContext;
}

/** Result of the calc-detail read — the detail OR null (not-found) + a generic error. */
export interface CalculationDetailReadResult {
  readonly detail: CalculationDetail | null;
  readonly error: string | null;
}

const HEADER_COLUMNS =
  "id, title, status, customer_id, facility_id, contact_id, archived_at, created_at, updated_at, tax_input_snapshot";

const SECTION_COLUMNS = "id, title, display_mode, sort_order";

const ROW_COLUMNS =
  "id, section_id, row_type, quantity, unit, unit_cost_ore, unit_sell_ore, markup_bp, vat_rate_bp, included_in_invoice_total, deduction_classification, vat_type, is_hidden, is_optional, is_selected, label, description, internal_note, quote_note, sort_order, source_kind, source_id, source_name, source_price_ore, source_cost_ore, source_updated_at, source_captured_at, source_sku, source_unit";

/**
 * Read one calculation by id with its ACTIVE sections (ordered by `sort_order`), each
 * with its ACTIVE rows (ordered by `sort_order`), PLUS the customer display context. A
 * foreign/other-tenant id is invisible under RLS → zero rows → `detail: null` (the page
 * renders a GENERIC not-found, never revealing cross-tenant existence). A query error
 * returns the generic FAILED message.
 *
 * NO personnummer enters this payload (only display_name/type/name), and NO
 * deferred/supplier/source-snapshot column is selected (those do not exist until 5.3).
 */
export async function readCalculationDetail(
  calculationId: string,
): Promise<CalculationDetailReadResult> {
  try {
    const client = await createSupabaseServerClient();

    const { data: headerRows, error: headerError } = await client
      .from("calculations")
      .select(HEADER_COLUMNS)
      .eq("id", calculationId)
      .is("archived_at", null)
      .limit(1);
    if (headerError) return { detail: null, error: GENERIC_READ_ERROR };
    const header = (headerRows?.[0] ?? null) as CalculationHeaderRow | null;
    if (!header) {
      // Invisible under RLS (or genuinely absent) → generic not-found, no leakage.
      return { detail: null, error: null };
    }

    // Sections + rows + the customer-context reads run in parallel (all own-tenant RLS).
    const [sectionsRes, rowsRes, customerRes] = await Promise.all([
      client
        .from("calculation_sections")
        .select(SECTION_COLUMNS)
        .eq("calculation_id", calculationId)
        .is("archived_at", null)
        .order("sort_order", { ascending: true }),
      // Rows are scoped by their parent sections (same tenant under RLS). Reading rows by
      // an `in (section_ids)` filter requires the section ids first; instead read all
      // active rows for the calc's sections via a nested filter is not possible in one
      // PostgREST call, so read rows scoped to the calc's sections after we have them.
      Promise.resolve(null),
      // Customer context (display fields ONLY — never personnummer).
      client
        .from("customers")
        .select("id, display_name, customer_type")
        .eq("id", header.customer_id)
        .limit(1),
    ]);

    if (sectionsRes.error) return { detail: null, error: GENERIC_READ_ERROR };
    // A failed customer read must NOT silently resolve `customer_type` to null (which the VAT
    // display posture would treat as a non-private customer → the less-safe company posture) —
    // surface it as the generic read-error state instead (mirrors the header/sections reads).
    if (customerRes.error) return { detail: null, error: GENERIC_READ_ERROR };
    void rowsRes;

    const sectionRows = (sectionsRes.data ?? []) as unknown as Array<{
      id: string;
      title: string | null;
      display_mode: "detailed" | "summary" | "text_only";
      sort_order: number;
    }>;
    const sectionIds = sectionRows.map((s) => s.id);

    // Read the active rows for this calc's sections (own-tenant under RLS). An empty
    // section set means there are no rows to fetch.
    let allRows: CalculationRowRow[] = [];
    if (sectionIds.length > 0) {
      const { data: rowData, error: rowError } = await client
        .from("calculation_rows")
        .select(ROW_COLUMNS)
        .in("section_id", sectionIds)
        .is("archived_at", null)
        .order("sort_order", { ascending: true });
      if (rowError) return { detail: null, error: GENERIC_READ_ERROR };
      allRows = (rowData ?? []) as unknown as CalculationRowRow[];
    }

    const rowsBySection = new Map<string, CalculationRowRow[]>();
    for (const row of allRows) {
      const bucket = rowsBySection.get(row.section_id) ?? [];
      bucket.push(row);
      rowsBySection.set(row.section_id, bucket);
    }

    const sections: CalculationSectionRow[] = sectionRows.map((s) => ({
      id: s.id,
      title: s.title,
      display_mode: s.display_mode,
      sort_order: s.sort_order,
      rows: rowsBySection.get(s.id) ?? [],
    }));

    const customerRow = (customerRes.data?.[0] ?? null) as {
      id: string;
      display_name: string | null;
      customer_type: string | null;
    } | null;

    // OPTIONAL facility/contact context — only fetched when the calc links one. Kept as
    // sequential lookups (they are at most one each) selecting only the display NAME.
    let facilityName: string | null = null;
    if (header.facility_id) {
      const { data: fac, error: facError } = await client
        .from("facilities")
        .select("name")
        .eq("id", header.facility_id)
        .limit(1);
      // A read fault must surface as the generic error, not a silent blank name (which would
      // be indistinguishable from a genuinely absent facility).
      if (facError) return { detail: null, error: GENERIC_READ_ERROR };
      facilityName = (fac?.[0] as { name: string | null } | undefined)?.name ?? null;
    }
    let contactName: string | null = null;
    if (header.contact_id) {
      const { data: con, error: conError } = await client
        .from("contacts")
        .select("name")
        .eq("id", header.contact_id)
        .limit(1);
      if (conError) return { detail: null, error: GENERIC_READ_ERROR };
      contactName = (con?.[0] as { name: string | null } | undefined)?.name ?? null;
    }

    const customer: CalculationCustomerContext = {
      customer_id: header.customer_id,
      customer_display_name: customerRow?.display_name ?? null,
      customer_type: customerRow?.customer_type ?? null,
      facility_name: facilityName,
      contact_name: contactName,
    };

    return { detail: { header, sections, customer }, error: null };
  } catch {
    return { detail: null, error: GENERIC_READ_ERROR };
  }
}
