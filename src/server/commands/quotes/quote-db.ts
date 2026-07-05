/**
 * Quote command DB-surface helpers (Story 6.1, Task 3.1/3.2; architecture §5, §11).
 *
 * The envelope's `CommandDbClient` declares only the read/ownership/audit surface
 * (`.from().select().eq().limit()` + the `record_audit_event` `.rpc()`). The quote
 * `execute` body also needs:
 *   - to READ the SNAPSHOT SOURCE rows under the caller's RLS (the calc header/sections/
 *     rows, the FULL company identity, the terms row) — all own-tenant;
 *   - to VERIFY each selected attachment file belongs to the resolved tenant (an
 *     own-tenant RLS SELECT — the cross-tenant re-validation);
 *   - to call the narrow atomic `create_quote_version_from_calculation` RPC (ADR-A009).
 * All run through the SAME request-bound, RLS-protected client (`ctx.db`) — NO
 * service-role client, NO direct audit INSERT. Postgres/PostgREST error codes map to
 * the stable command codes (mirroring `calculations/calc-db.ts` / `files/file-db.ts`).
 *
 * NO personnummer is ever selected into any snapshot-source read here — the customer
 * context takes display fields + a TYPE only (the epic-3 pnr-in-payload trap).
 */
import type { CommandDbClient } from "../envelope";
import { CommandError } from "../command-errors";

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot-source row shapes (read under the caller's RLS).
// ─────────────────────────────────────────────────────────────────────────────

/** The calc header the snapshot references (display fields only; no PII). */
export interface CalcHeaderRow {
  readonly id: string;
  readonly customer_id: string;
  readonly facility_id: string | null;
  readonly contact_id: string | null;
  readonly title: string;
  readonly status: string;
}

/** A calc section (with its display mode + ordering) for the snapshot. */
export interface CalcSectionRow {
  readonly id: string;
  readonly title: string | null;
  readonly display_mode: string;
  readonly sort_order: number;
}

/** A calc row — the CUSTOMER-VISIBLE fields (NO internal_note/unit_cost_ore/markup_bp read). */
export interface CalcRowRow {
  readonly id: string;
  readonly section_id: string;
  readonly row_type: string;
  readonly quantity: number;
  readonly unit: string;
  readonly unit_sell_ore: number | null;
  readonly vat_rate_bp: number | null;
  readonly is_hidden: boolean;
  readonly is_optional: boolean;
  readonly is_selected: boolean | null;
  readonly label: string | null;
  readonly description: string | null;
  readonly quote_note: string | null;
  readonly sort_order: number;
}

/** The FULL company identity row (all PDF fields — the identity-FULL capture). */
export interface CompanyIdentityRow {
  readonly company_name: string | null;
  readonly org_nr: string | null;
  readonly address_line1: string | null;
  readonly address_line2: string | null;
  readonly postal_code: string | null;
  readonly city: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly logo_url: string | null;
  readonly default_vat_display: string | null;
  readonly vat_rate_bp: number | null;
}

/** The terms + sign-off row (captured VERBATIM; NULL approved_at = not-approved). */
export interface QuoteTermsRow {
  readonly terms_text: string | null;
  readonly approved_at: string | null;
  readonly approved_by: string | null;
}

/** The customer display context (display fields + a TYPE only — NEVER a personnummer). */
export interface CustomerContextRow {
  readonly customer_display_name: string | null;
  readonly customer_type: string | null;
  readonly facility_name: string | null;
  readonly contact_name: string | null;
}

const CALC_HEADER_COLUMNS =
  "id, customer_id, facility_id, contact_id, title, status";
const CALC_SECTION_COLUMNS = "id, title, display_mode, sort_order";
// CUSTOMER-VISIBLE fields only — NO internal_note, NO unit_cost_ore, NO markup_bp (R-607).
const CALC_ROW_COLUMNS =
  "id, section_id, row_type, quantity, unit, unit_sell_ore, vat_rate_bp, is_hidden, is_optional, is_selected, label, description, quote_note, sort_order";
const COMPANY_IDENTITY_COLUMNS =
  "company_name, org_nr, address_line1, address_line2, postal_code, city, email, phone, logo_url, default_vat_display, vat_rate_bp";
const QUOTE_TERMS_COLUMNS = "terms_text, approved_at, approved_by";

/** The minimal read surface (`.from().select()` chain) the source reads drive. */
type ReadClient = {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        limit(n: number): Promise<{ data: unknown[] | null; error: unknown }>;
        is(
          column: string,
          value: null,
        ): {
          order(
            column: string,
            opts: { ascending: boolean },
          ): Promise<{ data: unknown[] | null; error: unknown }>;
        };
      };
      in(
        column: string,
        values: readonly string[],
      ): {
        is(
          column: string,
          value: null,
        ): {
          order(
            column: string,
            opts: { ascending: boolean },
          ): Promise<{ data: unknown[] | null; error: unknown }>;
        };
      };
      limit(n: number): Promise<{ data: unknown[] | null; error: unknown }>;
    };
  };
};

function asReadClient(db: CommandDbClient): ReadClient {
  return db as unknown as ReadClient;
}

/** Re-throw a transient read error as a plain Error → SERVER_ERROR (never masked as denial). */
function throwOnReadError(where: string, error: unknown): void {
  if (error) {
    throw new Error(
      `${where} failed: ${(error as { code?: string }).code ?? "?"}`,
    );
  }
}

/** Load the calc header under the caller's RLS. Returns null when not visible (race). */
export async function loadCalcHeader(
  db: CommandDbClient,
  calculationId: string,
): Promise<CalcHeaderRow | null> {
  const { data, error } = await asReadClient(db)
    .from("calculations")
    .select(CALC_HEADER_COLUMNS)
    .eq("id", calculationId)
    .limit(1);
  throwOnReadError("loadCalcHeader", error);
  const row = (data?.[0] ?? null) as CalcHeaderRow | null;
  return row;
}

/** Load the active calc sections (ordered) under the caller's RLS. */
export async function loadCalcSections(
  db: CommandDbClient,
  calculationId: string,
): Promise<CalcSectionRow[]> {
  const { data, error } = await asReadClient(db)
    .from("calculation_sections")
    .select(CALC_SECTION_COLUMNS)
    .eq("calculation_id", calculationId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  throwOnReadError("loadCalcSections", error);
  return (data ?? []) as CalcSectionRow[];
}

/** Load the active calc rows for a set of sections (ordered) under the caller's RLS. */
export async function loadCalcRows(
  db: CommandDbClient,
  sectionIds: readonly string[],
): Promise<CalcRowRow[]> {
  if (sectionIds.length === 0) return [];
  const { data, error } = await asReadClient(db)
    .from("calculation_rows")
    .select(CALC_ROW_COLUMNS)
    .in("section_id", sectionIds)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  throwOnReadError("loadCalcRows", error);
  return (data ?? []) as CalcRowRow[];
}

/** Load the FULL company identity row under the caller's RLS (ONE row per tenant). */
export async function loadCompanyIdentity(
  db: CommandDbClient,
): Promise<CompanyIdentityRow | null> {
  const { data, error } = await asReadClient(db)
    .from("company_settings")
    .select(COMPANY_IDENTITY_COLUMNS)
    .limit(1);
  throwOnReadError("loadCompanyIdentity", error);
  return (data?.[0] ?? null) as CompanyIdentityRow | null;
}

/** Load the terms + sign-off row under the caller's RLS (ONE row per tenant). */
export async function loadQuoteTerms(
  db: CommandDbClient,
): Promise<QuoteTermsRow | null> {
  const { data, error } = await asReadClient(db)
    .from("quote_terms")
    .select(QUOTE_TERMS_COLUMNS)
    .limit(1);
  throwOnReadError("loadQuoteTerms", error);
  return (data?.[0] ?? null) as QuoteTermsRow | null;
}

/** Load the customer display fields (display + a TYPE only — NEVER a personnummer). */
export async function loadCustomerDisplay(
  db: CommandDbClient,
  customerId: string,
): Promise<{ display_name: string | null; customer_type: string | null } | null> {
  const { data, error } = await asReadClient(db)
    .from("customers")
    .select("display_name, customer_type")
    .eq("id", customerId)
    .limit(1);
  throwOnReadError("loadCustomerDisplay", error);
  return (data?.[0] ?? null) as {
    display_name: string | null;
    customer_type: string | null;
  } | null;
}

/** Load a facility/contact display NAME under the caller's RLS. */
export async function loadNameById(
  db: CommandDbClient,
  table: "facilities" | "contacts",
  id: string,
): Promise<string | null> {
  const { data, error } = await asReadClient(db)
    .from(table)
    .select("name")
    .eq("id", id)
    .limit(1);
  throwOnReadError(`loadNameById(${table})`, error);
  const row = (data?.[0] ?? null) as { name: string | null } | null;
  return row?.name ?? null;
}

/**
 * Load the target quote version's REAL current lifecycle `status` from the DB, under the
 * caller's RLS (ownership already proved it is visible). The load-bearing re-assert-draft
 * check for the Story 6.2 draft-edit command: a sent/accepted/… version is never mutable
 * through the draft-edit path. Returns null when the row is not visible (a race).
 */
export async function loadQuoteVersionStatus(
  db: CommandDbClient,
  quoteVersionId: string,
): Promise<string | null> {
  const { data, error } = await asReadClient(db)
    .from("quote_versions")
    .select("status")
    .eq("id", quoteVersionId)
    .limit(1);
  throwOnReadError("loadQuoteVersionStatus", error);
  const row = (data?.[0] ?? null) as { status?: string } | null;
  return row?.status ?? null;
}

/** The minimal quote_versions UPDATE surface of the request-bound RLS client. */
export type QuoteWriteClient = {
  from(table: "quote_versions"): {
    update(values: Record<string, unknown>): {
      eq(
        column: string,
        value: string,
      ): {
        select(columns: string): Promise<{
          data: unknown[] | null;
          error: { code?: string; message?: string } | null;
        }>;
      };
    };
  };
};

/** Narrow the envelope client to the quote-version write surface (single documented cast). */
export function asQuoteWriteClient(db: CommandDbClient): QuoteWriteClient {
  return db as unknown as QuoteWriteClient;
}

/** The display name of an attachment file (for the by-value metadata snapshot). */
export interface AttachmentFileRow {
  readonly id: string;
  readonly display_name: string | null;
}

/**
 * Verify a selected attachment file is visible under the caller's RLS (own tenant) AND
 * return its display name for the by-value snapshot. Returns null when the file is not
 * visible (cross-tenant / non-existent → TENANT_ACCESS_DENIED at the caller).
 */
export async function loadOwnedAttachmentFile(
  db: CommandDbClient,
  fileId: string,
): Promise<AttachmentFileRow | null> {
  const { data, error } = await asReadClient(db)
    .from("files")
    .select("id, display_name")
    .eq("id", fileId)
    .limit(1);
  throwOnReadError("loadOwnedAttachmentFile", error);
  return (data?.[0] ?? null) as AttachmentFileRow | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// The narrow atomic RPC surface.
// ─────────────────────────────────────────────────────────────────────────────

/** The minimal RPC surface for the narrow `create_quote_version_from_calculation` call. */
export type QuoteRpcClient = {
  rpc(
    fn: "create_quote_version_from_calculation",
    args: {
      readonly p_tenant_id: string;
      readonly p_calculation_id: string;
      readonly p_captured_at: string;
      readonly p_customer_id: string;
      readonly p_facility_id: string | null;
      readonly p_contact_id: string | null;
      readonly p_snapshot: unknown;
      readonly p_lines: unknown;
      readonly p_attachments: unknown;
    },
  ): Promise<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
};

/** Narrow the envelope client to the quote-RPC surface (single documented cast). */
export function asQuoteRpcClient(db: CommandDbClient): QuoteRpcClient {
  return db as unknown as QuoteRpcClient;
}

/**
 * Postgres error codes the quote mutation can surface that are DETERMINISTIC outcomes
 * (not transient infra faults):
 *   - `23503` foreign_key_violation — a composite same-tenant FK rejected a cross-tenant
 *     / wrong-parent link (a foreign calc/file id) → TENANT_ACCESS_DENIED.
 *   - `42501` insufficient_privilege / RLS WITH CHECK violation → TENANT_ACCESS_DENIED.
 *   - `23505` unique_violation → VALIDATION_FAILED.
 *   - `23514` check_violation (öre non-negative / status / event_type CHECK) → VALIDATION_FAILED.
 *   - `22P02` invalid_text_representation (malformed uuid/number in the jsonb) → VALIDATION_FAILED.
 * Any other error is a transient fault — re-thrown as a plain Error so the envelope maps
 * it to SERVER_ERROR (retryable). Throw the CODE only — never the raw Postgres message,
 * which can embed row values / customer identity.
 */
export function throwMappedQuoteWriteError(error: {
  readonly code?: string;
  readonly message?: string;
}): never {
  switch (error.code) {
    case "23503":
    case "42501":
      throw new CommandError("TENANT_ACCESS_DENIED");
    case "23505":
    case "23514":
    case "22P02":
      throw new CommandError("VALIDATION_FAILED");
    default:
      throw new Error(`quote write failed: ${error.code ?? "?"}`);
  }
}
