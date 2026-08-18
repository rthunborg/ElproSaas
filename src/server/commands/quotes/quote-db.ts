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
import { adaptQuoteTaxSnapshot } from "@/lib/quote-snapshot";

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
  /** Untrusted calculation JSONB; fresh quote creation validates it through the money domain. */
  readonly tax_input_snapshot: unknown;
}

/** A calc section (with its display mode + ordering) for the snapshot. */
export interface CalcSectionRow {
  readonly id: string;
  readonly title: string | null;
  readonly display_mode: string;
  readonly sort_order: number;
}

/**
 * A calc row used to build the customer-visible snapshot. Cost/source-kind are read only
 * for reviewed-readiness parity and are never copied into the frozen line payload.
 */
export interface CalcRowRow {
  readonly id: string;
  readonly section_id: string;
  readonly row_type: string;
  readonly quantity: number;
  readonly unit: string;
  readonly unit_cost_ore: number | null;
  readonly unit_sell_ore: number | null;
  readonly vat_rate_bp: number | null;
  readonly included_in_invoice_total: boolean;
  readonly deduction_classification: string;
  readonly vat_type: string;
  readonly is_hidden: boolean;
  readonly is_optional: boolean;
  readonly is_selected: boolean | null;
  readonly label: string | null;
  readonly description: string | null;
  readonly quote_note: string | null;
  readonly sort_order: number;
  readonly source_kind: string | null;
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
  "id, customer_id, facility_id, contact_id, title, status, tax_input_snapshot";
const CALC_SECTION_COLUMNS = "id, title, display_mode, sort_order";
// unit_cost/source_kind affect customer-visible readiness warnings but are never snapshotted.
// internal_note and markup_bp remain excluded (R-607).
const CALC_ROW_COLUMNS =
  "id, section_id, row_type, quantity, unit, unit_cost_ore, unit_sell_ore, vat_rate_bp, included_in_invoice_total, deduction_classification, vat_type, is_hidden, is_optional, is_selected, label, description, quote_note, sort_order, source_kind";
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
        order(
          column: string,
          opts: { ascending: boolean },
        ): Promise<{ data: unknown[] | null; error: unknown }>;
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

// ─────────────────────────────────────────────────────────────────────────────
// Story 7.1 — the acceptance-capture reads + the own-tenant quote_acceptances INSERT.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The frozen fields the acceptance-capture command reads off the target version row (under the
 * caller's RLS): the lifecycle `status` (the sent-state gate — acceptance is legal ONLY on
 * `status = 'sent'`), the parent `quote_id` (the acceptance's parent-quote FK), and the frozen
 * customer-commitment gross the version snapshot froze (Story 10.6 V2 `payable_ore`, falling back
 * to V1 `accepted_price_ore` — the SOURCE SENT TOTAL the adjusted-price delta is measured against;
 * captured, never re-derived).
 */
export interface QuoteVersionAcceptanceSourceRow {
  readonly status: string;
  readonly quote_id: string;
  readonly snapshot_schema_version: number | null;
  readonly payable_ore: number | null;
  readonly source_sent_total_ore: number;
}

/**
 * Load the acceptance-capture source fields for the target version under the caller's RLS
 * (ownership already proved it visible). Returns null when the row is not visible (a race → the
 * command denies). The `source_sent_total_ore` reads the frozen V2 `payable_ore` when present, and
 * falls back to V1 `accepted_price_ore`; bigint öre may arrive as a STRING, coerced here.
 */
export async function loadQuoteVersionAcceptanceSource(
  db: CommandDbClient,
  quoteVersionId: string,
): Promise<QuoteVersionAcceptanceSourceRow | null> {
  const { data, error } = await asReadClient(db)
    .from("quote_versions")
    .select("status, quote_id, snapshot_schema_version, tax_rule_version, tax_answer_snapshot, buyer_vat_number, calculated_deduction_ore, claim_deduction_ore, payable_ore, vat_total_ore, deduction_total_ore, accepted_price_ore")
    .eq("id", quoteVersionId)
    .limit(1);
  throwOnReadError("loadQuoteVersionAcceptanceSource", error);
  const raw = (data?.[0] ?? null) as Record<string, unknown> | null;
  if (raw === null) return null;
  const payableOre = oreOf(raw.payable_ore);
  const acceptedPriceOre = oreOf(raw.accepted_price_ore);
  const vatOre = oreOf(raw.vat_total_ore);
  const deductionOre = oreOf(raw.deduction_total_ore);
  if (acceptedPriceOre === null || vatOre === null || deductionOre === null) {
    throw new CommandError("VALIDATION_FAILED");
  }
  const tax = adaptQuoteTaxSnapshot({
    snapshotSchemaVersion: numOf(raw.snapshot_schema_version),
    taxRuleVersion: (raw.tax_rule_version as string | null) ?? null,
    taxAnswerSnapshot: raw.tax_answer_snapshot,
    buyerVatNumber: (raw.buyer_vat_number as string | null) ?? null,
    calculatedDeductionOre: oreOf(raw.calculated_deduction_ore),
    claimDeductionOre: oreOf(raw.claim_deduction_ore),
    payableOre,
    vatOre,
    deductionOre,
    acceptedPriceOre,
  });
  if (!tax.ok) throw new CommandError("VALIDATION_FAILED");
  return {
    status: String(raw.status),
    quote_id: String(raw.quote_id),
    snapshot_schema_version: numOf(raw.snapshot_schema_version),
    payable_ore: payableOre,
    source_sent_total_ore: tax.value.payableOre,
  };
}

/** The minimal quote_acceptances INSERT surface of the request-bound RLS client. */
export type QuoteAcceptanceWriteClient = {
  from(table: "quote_acceptances"): {
    insert(values: Record<string, unknown>): {
      select(columns: string): Promise<{
        data: unknown[] | null;
        error: { code?: string; message?: string } | null;
      }>;
    };
  };
};

/** Narrow the envelope client to the quote-acceptance write surface (single documented cast). */
export function asQuoteAcceptanceWriteClient(
  db: CommandDbClient,
): QuoteAcceptanceWriteClient {
  return db as unknown as QuoteAcceptanceWriteClient;
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

// ─────────────────────────────────────────────────────────────────────────────
// Story 6.4 — the send-gate read + the narrow mark_quote_version_sent RPC surface.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The FROZEN gate fields the mark-sent send gate reads off the target version row (under
 * the caller's RLS): the status (the not-draft short-circuit), the captured
 * `warnings_snapshot` (the SAME 5.4 classifier codes+severity frozen at create time — the
 * send gate consumes its BLOCKER state, it does NOT re-classify or fork the rule table),
 * and `requires_sign_off` / `terms_approved_at` (RE-DERIVED as server truth at send time —
 * not trusted blindly from the persisted snapshot).
 */
export interface QuoteVersionSendGateRow {
  readonly status: string;
  readonly requires_sign_off: boolean;
  readonly terms_approved_at: string | null;
  readonly warnings_snapshot: readonly {
    readonly code: string;
    readonly severity: string;
    readonly message: string;
  }[];
}

/**
 * Load the frozen send-gate fields for the target version under the caller's RLS (ownership
 * already proved it visible). Returns null when the row is not visible (a race → the command
 * denies). The `warnings_snapshot` blocker severities are the send gate's SAME-classifier
 * input (never a re-read of the live calc).
 */
export async function loadQuoteVersionSendGate(
  db: CommandDbClient,
  quoteVersionId: string,
): Promise<QuoteVersionSendGateRow | null> {
  const { data, error } = await asReadClient(db)
    .from("quote_versions")
    .select("status, requires_sign_off, terms_approved_at, warnings_snapshot")
    .eq("id", quoteVersionId)
    .limit(1);
  throwOnReadError("loadQuoteVersionSendGate", error);
  const raw = (data?.[0] ?? null) as Record<string, unknown> | null;
  if (raw === null) return null;
  const warnings = Array.isArray(raw.warnings_snapshot)
    ? (raw.warnings_snapshot as unknown[]).map((w) => {
        const rec = (w ?? {}) as Record<string, unknown>;
        return {
          code: String(rec.code ?? ""),
          severity: String(rec.severity ?? ""),
          message: String(rec.message ?? ""),
        };
      })
    : [];
  return {
    status: String(raw.status),
    requires_sign_off: raw.requires_sign_off === true,
    terms_approved_at: (raw.terms_approved_at as string | null) ?? null,
    warnings_snapshot: warnings,
  };
}

/** The minimal RPC surface for the narrow `mark_quote_version_sent` call. */
export type MarkQuoteVersionSentRpcClient = {
  rpc(
    fn: "mark_quote_version_sent",
    args: {
      readonly p_tenant_id: string;
      readonly p_quote_version_id: string;
      readonly p_sent_at: string;
      readonly p_channel: string | null;
      readonly p_reference: string | null;
    },
  ): Promise<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
};

/** Narrow the envelope client to the mark-sent RPC surface (single documented cast). */
export function asMarkSentRpcClient(
  db: CommandDbClient,
): MarkQuoteVersionSentRpcClient {
  return db as unknown as MarkQuoteVersionSentRpcClient;
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
      readonly p_reviewed_snapshot_digest: string;
      readonly p_reviewed_quote_capture_date: string;
      readonly p_reviewed_readiness_rows: unknown;
      readonly p_reviewed_calculation_status: string;
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

// ─────────────────────────────────────────────────────────────────────────────
// Story 6.5 — the new-version + lifecycle-transition RPC surfaces + the parent-version read.
// ─────────────────────────────────────────────────────────────────────────────

/** The parent-version fields the new-version command reads to derive the RPC args. */
export interface QuoteVersionParentRow {
  readonly id: string;
  readonly quote_id: string;
  readonly calculation_id: string;
  readonly status: string;
  readonly quote_number: number | null;
  readonly snapshot_schema_version: number | null;
}

const PARENT_VERSION_COLUMNS =
  "id, quote_id, calculation_id, status, quote_number, snapshot_schema_version";

/**
 * Load the PARENT quote-version's identity fields under the caller's RLS (ownership already proved
 * it visible). Returns the quote_id / calculation_id / status / quote_number / snapshot schema the
 * new-version command uses, or null when the row is not visible (a race → the command denies).
 */
export async function loadQuoteVersionParent(
  db: CommandDbClient,
  quoteVersionId: string,
): Promise<QuoteVersionParentRow | null> {
  const { data, error } = await asReadClient(db)
    .from("quote_versions")
    .select(PARENT_VERSION_COLUMNS)
    .eq("id", quoteVersionId)
    .limit(1);
  throwOnReadError("loadQuoteVersionParent", error);
  const raw = (data?.[0] ?? null) as Record<string, unknown> | null;
  if (raw === null) return null;
  return {
    id: String(raw.id),
    quote_id: String(raw.quote_id),
    calculation_id: String(raw.calculation_id),
    status: String(raw.status),
    quote_number: numOf(raw.quote_number),
    snapshot_schema_version: numOf(raw.snapshot_schema_version),
  };
}

/** The minimal RPC surface for the narrow `create_new_quote_version` call. */
export type NewQuoteVersionRpcClient = {
  rpc(
    fn: "create_new_quote_version",
    args: {
      readonly p_tenant_id: string;
      readonly p_quote_id: string;
      readonly p_source_quote_version_id: string;
      readonly p_calculation_id: string;
      readonly p_captured_at: string;
      readonly p_customer_id: string;
      readonly p_facility_id: string | null;
      readonly p_contact_id: string | null;
      readonly p_snapshot: unknown;
      readonly p_lines: unknown;
      readonly p_attachments: unknown;
      readonly p_supersede_prior: boolean;
    },
  ): Promise<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
};

/** Narrow the envelope client to the new-version RPC surface (single documented cast). */
export function asNewQuoteVersionRpcClient(
  db: CommandDbClient,
): NewQuoteVersionRpcClient {
  return db as unknown as NewQuoteVersionRpcClient;
}

/** The minimal RPC surface for the narrow `mark_quote_version_lifecycle` call. */
export type QuoteLifecycleRpcClient = {
  rpc(
    fn: "mark_quote_version_lifecycle",
    args: {
      readonly p_tenant_id: string;
      readonly p_quote_version_id: string;
      readonly p_transition: string;
      readonly p_occurred_at: string;
    },
  ): Promise<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
};

/** Narrow the envelope client to the lifecycle-transition RPC surface (single documented cast). */
export function asQuoteLifecycleRpcClient(
  db: CommandDbClient,
): QuoteLifecycleRpcClient {
  return db as unknown as QuoteLifecycleRpcClient;
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 10.2 — the narrow mark_quote_version_lost RPC surface (§14 widening).
// ─────────────────────────────────────────────────────────────────────────────

/** The minimal RPC surface for the narrow `mark_quote_version_lost` call (Story 10.2). */
export type QuoteLostRpcClient = {
  rpc(
    fn: "mark_quote_version_lost",
    args: {
      readonly p_tenant_id: string;
      readonly p_quote_version_id: string;
      readonly p_outcome: string;
      readonly p_category: string;
      readonly p_note: string | null;
      readonly p_occurred_at: string;
    },
  ): Promise<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
};

/** Narrow the envelope client to the mark-lost RPC surface (single documented cast). */
export function asQuoteLostRpcClient(db: CommandDbClient): QuoteLostRpcClient {
  return db as unknown as QuoteLostRpcClient;
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 10.3 — the follow-up anchor read + the direct quote_follow_ups write surfaces.
//
// The plan/complete/annotate commands are single-row ENVELOPE commands (architecture-phase-b §14 —
// NO RPC): they issue direct RLS-client table writes on quote_follow_ups. The anchor read loads the
// version's status + quote_id so the plan command can (a) assert the anchor is `sent` and (b) DERIVE
// quote_id from the loaded row (never trust a client-supplied quote_id — SETTLED DESIGN DECISION 3).
// ─────────────────────────────────────────────────────────────────────────────

/** The anchor-version fields the plan command reads: the lifecycle `status` + the parent `quote_id`. */
export interface QuoteVersionAnchorRow {
  readonly status: string;
  readonly quote_id: string;
}

/**
 * Load the anchor version's `status` + `quote_id` under the caller's RLS (ownership already proved it
 * visible). Returns null when the row is not visible (a race → the command denies). The plan command
 * DERIVES quote_id from THIS loaded row — never from client input.
 */
export async function loadQuoteVersionAnchor(
  db: CommandDbClient,
  quoteVersionId: string,
): Promise<QuoteVersionAnchorRow | null> {
  const { data, error } = await asReadClient(db)
    .from("quote_versions")
    .select("status, quote_id")
    .eq("id", quoteVersionId)
    .limit(1);
  throwOnReadError("loadQuoteVersionAnchor", error);
  const raw = (data?.[0] ?? null) as Record<string, unknown> | null;
  if (raw === null) return null;
  return { status: String(raw.status), quote_id: String(raw.quote_id) };
}

/** A chainable RLS UPDATE filter (multiple `.eq()` then a terminal `.select()`). */
type FollowUpUpdateFilter = {
  eq(column: string, value: string): FollowUpUpdateFilter;
  select(columns: string): Promise<{
    data: unknown[] | null;
    error: { code?: string; message?: string } | null;
  }>;
};

/** The minimal quote_follow_ups INSERT + UPDATE surface of the request-bound RLS client. */
export type QuoteFollowUpWriteClient = {
  from(table: "quote_follow_ups"): {
    insert(values: Record<string, unknown>): {
      select(columns: string): Promise<{
        data: unknown[] | null;
        error: { code?: string; message?: string } | null;
      }>;
    };
    update(values: Record<string, unknown>): {
      eq(column: string, value: string): FollowUpUpdateFilter;
    };
  };
};

/** Narrow the envelope client to the quote-follow-up write surface (single documented cast). */
export function asQuoteFollowUpWriteClient(
  db: CommandDbClient,
): QuoteFollowUpWriteClient {
  return db as unknown as QuoteFollowUpWriteClient;
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 7.2 — the narrow accept_quote_and_create_job RPC surface + its result shape.
// ─────────────────────────────────────────────────────────────────────────────

/** The args the narrow `accept_quote_and_create_job` RPC accepts (all resolved server-side). */
export interface AcceptAndCreateJobRpcArgs {
  readonly p_tenant_id: string;
  readonly p_quote_version_id: string;
  readonly p_accepted_at: string;
  readonly p_accepted_price_ore: number;
  readonly p_source_sent_total_ore: number;
  readonly p_channel: string | null;
  readonly p_adjustment_reason: string | null;
  readonly p_evidence_file_id: string | null;
  readonly p_evidence_reference: string | null;
  readonly p_notes: string | null;
  readonly p_planned_start_date: string | null;
  readonly p_planned_end_date: string | null;
  readonly p_title: string | null;
  readonly p_fault_inject: string | null;
}

/** The minimal RPC surface for the narrow `accept_quote_and_create_job` call. */
export type AcceptAndCreateJobRpcClient = {
  rpc(
    fn: "accept_quote_and_create_job",
    args: AcceptAndCreateJobRpcArgs,
  ): Promise<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
};

/** Narrow the envelope client to the accept-and-create-job RPC surface (single documented cast). */
export function asAcceptAndCreateJobRpcClient(
  db: CommandDbClient,
): AcceptAndCreateJobRpcClient {
  return db as unknown as AcceptAndCreateJobRpcClient;
}

/** The parsed result of the accept-and-create-job RPC (the returned single row). */
export interface AcceptAndCreateJobResult {
  readonly acceptanceId: string;
  readonly jobId: string;
  readonly wasExisting: boolean;
}

/**
 * Extract the accept-and-create-job RPC result (row array or single object) into a typed shape.
 * Exported for the fast-gate unit suite: the raw pg / PostgREST layer can return the result as
 * either a single object or a one-row array, and `was_existing` as a boolean or a string — so this
 * coercion/normalization is pure branch logic worth pinning WITHOUT a database.
 */
export function extractAcceptAndCreateJobResult(
  data: unknown,
): AcceptAndCreateJobResult | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const r = row as {
    acceptance_id?: unknown;
    job_id?: unknown;
    was_existing?: unknown;
  };
  if (typeof r.acceptance_id !== "string") return null;
  if (typeof r.job_id !== "string") return null;
  const wasExisting = r.was_existing === true || r.was_existing === "true";
  return {
    acceptanceId: r.acceptance_id,
    jobId: r.job_id,
    wasExisting,
  };
}

/**
 * Postgres error codes the quote mutation can surface that are DETERMINISTIC outcomes
 * (not transient infra faults):
 *   - `QV409` — the Story 6.4 sent-lock trigger / the mark-sent RPC's not-draft assertion
 *     (a custom SQLSTATE, DISTINCT from the standard classes below) → QUOTE_VERSION_LOCKED.
 *   - `23503` foreign_key_violation — a composite same-tenant FK rejected a cross-tenant
 *     / wrong-parent link (a foreign calc/file id) → TENANT_ACCESS_DENIED.
 *   - `42501` insufficient_privilege / RLS WITH CHECK violation → TENANT_ACCESS_DENIED.
 *   - `23505` unique_violation → VALIDATION_FAILED. (The Story 7.2 accept transaction
 *     does NOT rely on this branch for its idempotency conflict: its narrow RPC row-locks
 *     the version + parent quote, so a concurrent loser re-runs the existing-record
 *     short-circuit under the lock and IDEMPOTENT-RETURNS the winner's records — it never
 *     reaches a raced 23505 here. `ACCEPTANCE_ALREADY_RECORDED` is defined for the
 *     genuinely-unresolvable race but is not emitted on this path, matching AC2's
 *     "returns the existing" primary behavior. The 7.1 capture command's duplicate-
 *     capture case keeps its shipped generic VALIDATION_FAILED here.)
 *   - `23514` check_violation (öre non-negative / status / event_type CHECK) → VALIDATION_FAILED.
 *   - `22P02` invalid_text_representation (malformed uuid/number in the jsonb) → VALIDATION_FAILED.
 *   - `QV703` — the Story 7.2 accept-RPC TEST-ONLY fault-injection RAISE (atomicity/
 *     rollback proof) → SERVER_ERROR (a transient-shaped failure that rolled the txn back).
 * Any other error is a transient fault — re-thrown as a plain Error so the envelope maps
 * it to SERVER_ERROR (retryable). Throw the CODE only — never the raw Postgres message,
 * which can embed row values / customer identity.
 */
export function throwMappedQuoteWriteError(error: {
  readonly code?: string;
  readonly message?: string;
}): never {
  switch (error.code) {
    // The Story 6.4 sent-lock RAISE (trigger + RPC not-draft assertion) — a distinguishable
    // custom SQLSTATE the mapper branches on WITHOUT colliding with the standard classes.
    case "QV409":
      throw new CommandError("QUOTE_VERSION_LOCKED");
    // The Story 7.2 accept-RPC test-only fault-injection RAISE — a deliberately-injected
    // mid-transaction failure that rolled the whole txn back (no partial state). Surface as
    // a transient SERVER_ERROR (the command did not succeed; nothing committed).
    case "QV703":
      throw new Error("quote write failed: injected fault (QV703)");
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

// ─────────────────────────────────────────────────────────────────────────────
// Story 6.3 — the frozen quote-version snapshot READ + the PDF-render write surface.
//
// The generateQuotePdf command reads ONLY the frozen snapshot rows (the quote_versions row
// + its quote_version_lines + quote_version_attachments), NEVER any mutable source — the
// canonical Epic-6 source-of-truth rule (R-606). It then uploads the rendered object on the
// RLS-client storage surface, persists the files/file_links metadata (find-or-create the PDF
// link — R-814), writes a quote_events row, and updates the PDF-render columns. All on the
// caller's request-bound RLS client (anon key — NEVER service-role).
// ─────────────────────────────────────────────────────────────────────────────

/** The frozen quote_versions snapshot row the PDF reads (customer-visible fields only). */
export interface QuoteVersionSnapshotRow {
  readonly id: string;
  readonly quote_id: string;
  readonly status: string;
  readonly calculation_id: string;
  readonly captured_at: string | null;
  readonly company_name: string | null;
  readonly company_org_nr: string | null;
  readonly company_address_line1: string | null;
  readonly company_address_line2: string | null;
  readonly company_postal_code: string | null;
  readonly company_city: string | null;
  readonly company_email: string | null;
  readonly company_phone: string | null;
  readonly company_logo_url: string | null;
  readonly customer_display_name: string | null;
  readonly customer_type: string | null;
  readonly facility_name: string | null;
  readonly contact_name: string | null;
  readonly quote_number: number | null;
  readonly quote_number_display: string | null;
  readonly valid_until: string | null;
  readonly intro_text: string | null;
  readonly customer_notes: string | null;
  readonly terms_text: string | null;
  readonly terms_approved_at: string | null;
  readonly terms_approved_by: string | null;
  readonly base_total_ore: number;
  readonly option_total_ore: number;
  readonly vat_total_ore: number;
  readonly deduction_total_ore: number;
  readonly accepted_price_ore: number;
  readonly snapshot_schema_version: number | null;
  readonly tax_rule_version: string | null;
  /** Untrusted JSONB at the DB boundary; downstream must parse it fail-closed before use. */
  readonly tax_answer_snapshot: unknown;
  readonly buyer_vat_number: string | null;
  readonly calculated_deduction_ore: number | null;
  readonly claim_deduction_ore: number | null;
  readonly payable_ore: number | null;
  readonly vat_rate_bp: number | null;
  readonly vat_display: string | null;
  readonly deduction_type: string | null;
  readonly deduction_rate_bp: number | null;
  readonly deduction_cap_ore: number | null;
  readonly deduction_persons: number | null;
  readonly requires_sign_off: boolean;
  readonly display_mode: string | null;
  readonly warnings_snapshot: readonly {
    readonly code: string;
    readonly severity: string;
    readonly message: string;
  }[];
}

/** A frozen quote_version_lines snapshot row (NO cost/margin/internal — R-607). */
export interface QuoteVersionLineSnapshotRow {
  readonly source_calculation_row_id: string | null;
  readonly row_type: string;
  readonly sort_order: number;
  readonly label: string | null;
  readonly description: string | null;
  readonly quote_note: string | null;
  readonly quantity: number | null;
  readonly unit: string | null;
  readonly unit_sell_ore: number | null;
  readonly line_net_ore: number | null;
  readonly vat_rate_bp: number | null;
  readonly included_in_invoice_total: boolean | null;
  readonly deduction_classification: string | null;
  readonly vat_type: string | null;
  readonly is_hidden: boolean;
  readonly is_optional: boolean;
  readonly is_selected: boolean | null;
}

/** A frozen quote_version_attachments snapshot row (display name by value). */
export interface QuoteVersionAttachmentSnapshotRow {
  readonly file_id: string;
  readonly display_name: string | null;
  readonly sort_order: number;
}

const VERSION_SNAPSHOT_COLUMNS =
  "id, quote_id, status, calculation_id, captured_at, company_name, company_org_nr, company_address_line1, company_address_line2, company_postal_code, company_city, company_email, company_phone, company_logo_url, customer_display_name, customer_type, facility_name, contact_name, quote_number, quote_number_display, valid_until, intro_text, customer_notes, terms_text, terms_approved_at, terms_approved_by, base_total_ore, option_total_ore, vat_total_ore, deduction_total_ore, accepted_price_ore, snapshot_schema_version, tax_rule_version, tax_answer_snapshot, buyer_vat_number, calculated_deduction_ore, claim_deduction_ore, payable_ore, vat_rate_bp, vat_display, deduction_type, deduction_rate_bp, deduction_cap_ore, deduction_persons, requires_sign_off, display_mode, warnings_snapshot";

const LINE_SNAPSHOT_COLUMNS =
  "source_calculation_row_id, row_type, sort_order, label, description, quote_note, quantity, unit, unit_sell_ore, line_net_ore, vat_rate_bp, included_in_invoice_total, deduction_classification, vat_type, is_hidden, is_optional, is_selected";

const ATTACHMENT_SNAPSHOT_COLUMNS = "file_id, display_name, sort_order";

/** Coerce a `bigint` öre (may return as a STRING) into a JS number, or null. */
function oreOf(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Coerce a plain numeric field (may arrive as a string) into a number, or null. */
function numOf(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Load the FROZEN quote_versions snapshot row under the caller's RLS (null = not visible/race). */
export async function loadQuoteVersionSnapshot(
  db: CommandDbClient,
  quoteVersionId: string,
): Promise<QuoteVersionSnapshotRow | null> {
  const { data, error } = await asReadClient(db)
    .from("quote_versions")
    .select(VERSION_SNAPSHOT_COLUMNS)
    .eq("id", quoteVersionId)
    .limit(1);
  throwOnReadError("loadQuoteVersionSnapshot", error);
  const raw = (data?.[0] ?? null) as Record<string, unknown> | null;
  if (raw === null) return null;
  const warnings = Array.isArray(raw.warnings_snapshot)
    ? (raw.warnings_snapshot as unknown[]).map((w) => {
        const rec = (w ?? {}) as Record<string, unknown>;
        return {
          code: String(rec.code ?? ""),
          severity: String(rec.severity ?? ""),
          message: String(rec.message ?? ""),
        };
      })
    : [];
  return {
    id: String(raw.id),
    quote_id: String(raw.quote_id),
    status: String(raw.status),
    calculation_id: String(raw.calculation_id),
    captured_at: (raw.captured_at as string | null) ?? null,
    company_name: (raw.company_name as string | null) ?? null,
    company_org_nr: (raw.company_org_nr as string | null) ?? null,
    company_address_line1: (raw.company_address_line1 as string | null) ?? null,
    company_address_line2: (raw.company_address_line2 as string | null) ?? null,
    company_postal_code: (raw.company_postal_code as string | null) ?? null,
    company_city: (raw.company_city as string | null) ?? null,
    company_email: (raw.company_email as string | null) ?? null,
    company_phone: (raw.company_phone as string | null) ?? null,
    company_logo_url: (raw.company_logo_url as string | null) ?? null,
    customer_display_name: (raw.customer_display_name as string | null) ?? null,
    customer_type: (raw.customer_type as string | null) ?? null,
    facility_name: (raw.facility_name as string | null) ?? null,
    contact_name: (raw.contact_name as string | null) ?? null,
    quote_number: numOf(raw.quote_number),
    quote_number_display: (raw.quote_number_display as string | null) ?? null,
    valid_until: (raw.valid_until as string | null) ?? null,
    intro_text: (raw.intro_text as string | null) ?? null,
    customer_notes: (raw.customer_notes as string | null) ?? null,
    terms_text: (raw.terms_text as string | null) ?? null,
    terms_approved_at: (raw.terms_approved_at as string | null) ?? null,
    terms_approved_by: (raw.terms_approved_by as string | null) ?? null,
    base_total_ore: oreOf(raw.base_total_ore) ?? 0,
    option_total_ore: oreOf(raw.option_total_ore) ?? 0,
    vat_total_ore: oreOf(raw.vat_total_ore) ?? 0,
    deduction_total_ore: oreOf(raw.deduction_total_ore) ?? 0,
    accepted_price_ore: oreOf(raw.accepted_price_ore) ?? 0,
    snapshot_schema_version: numOf(raw.snapshot_schema_version),
    tax_rule_version: (raw.tax_rule_version as string | null) ?? null,
    tax_answer_snapshot: raw.tax_answer_snapshot ?? null,
    buyer_vat_number: (raw.buyer_vat_number as string | null) ?? null,
    calculated_deduction_ore: oreOf(raw.calculated_deduction_ore),
    claim_deduction_ore: oreOf(raw.claim_deduction_ore),
    payable_ore: oreOf(raw.payable_ore),
    vat_rate_bp: numOf(raw.vat_rate_bp),
    vat_display: (raw.vat_display as string | null) ?? null,
    deduction_type: (raw.deduction_type as string | null) ?? null,
    deduction_rate_bp: numOf(raw.deduction_rate_bp),
    deduction_cap_ore: oreOf(raw.deduction_cap_ore),
    deduction_persons: numOf(raw.deduction_persons),
    requires_sign_off: raw.requires_sign_off === true,
    display_mode: (raw.display_mode as string | null) ?? null,
    warnings_snapshot: warnings,
  };
}

/** Load the FROZEN customer-visible line snapshot rows (ordered by sort_order) under RLS. */
export async function loadQuoteVersionLineSnapshots(
  db: CommandDbClient,
  quoteVersionId: string,
): Promise<QuoteVersionLineSnapshotRow[]> {
  const { data, error } = await asReadClient(db)
    .from("quote_version_lines")
    .select(LINE_SNAPSHOT_COLUMNS)
    .eq("quote_version_id", quoteVersionId)
    .order("sort_order", { ascending: true });
  throwOnReadError("loadQuoteVersionLineSnapshots", error);
  return ((data ?? []) as Record<string, unknown>[]).map((raw) => ({
    source_calculation_row_id:
      (raw.source_calculation_row_id as string | null) ?? null,
    row_type: String(raw.row_type),
    sort_order: Number(raw.sort_order ?? 0),
    label: (raw.label as string | null) ?? null,
    description: (raw.description as string | null) ?? null,
    quote_note: (raw.quote_note as string | null) ?? null,
    quantity: numOf(raw.quantity),
    unit: (raw.unit as string | null) ?? null,
    unit_sell_ore: oreOf(raw.unit_sell_ore),
    line_net_ore: oreOf(raw.line_net_ore),
    vat_rate_bp: numOf(raw.vat_rate_bp),
    included_in_invoice_total:
      raw.included_in_invoice_total === null || raw.included_in_invoice_total === undefined
        ? null
        : raw.included_in_invoice_total === true,
    deduction_classification:
      (raw.deduction_classification as string | null) ?? null,
    vat_type: (raw.vat_type as string | null) ?? null,
    is_hidden: raw.is_hidden === true,
    is_optional: raw.is_optional === true,
    is_selected:
      raw.is_selected === null || raw.is_selected === undefined
        ? null
        : raw.is_selected === true,
  }));
}

/** Load the FROZEN selected-attachment snapshot rows (ordered by sort_order) under RLS. */
export async function loadQuoteVersionAttachmentSnapshots(
  db: CommandDbClient,
  quoteVersionId: string,
): Promise<QuoteVersionAttachmentSnapshotRow[]> {
  const { data, error } = await asReadClient(db)
    .from("quote_version_attachments")
    .select(ATTACHMENT_SNAPSHOT_COLUMNS)
    .eq("quote_version_id", quoteVersionId)
    .order("sort_order", { ascending: true });
  throwOnReadError("loadQuoteVersionAttachmentSnapshots", error);
  return ((data ?? []) as Record<string, unknown>[]).map((raw) => ({
    file_id: String(raw.file_id),
    display_name: (raw.display_name as string | null) ?? null,
    sort_order: Number(raw.sort_order ?? 0),
  }));
}

/**
 * The storage + files/file_links + events write surface the PDF pipeline drives on the
 * caller's request-bound RLS client (anon key — NEVER service-role). storage.objects RLS +
 * the composite same-tenant FKs enforce that no cross-tenant object/metadata is reachable.
 */
export type QuotePdfWriteClient = {
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        body: Uint8Array,
        options: { contentType: string; upsert: boolean },
      ): Promise<{ data: unknown; error: { message?: string } | null }>;
    };
  };
  from(table: "files"): {
    insert(values: Record<string, unknown>): {
      select(columns: string): Promise<{
        data: unknown[] | null;
        error: { code?: string; message?: string } | null;
      }>;
    };
  };
  from(table: "file_links"): {
    insert(values: Record<string, unknown>): {
      select(columns: string): Promise<{
        data: unknown[] | null;
        error: { code?: string; message?: string } | null;
      }>;
    };
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
  from(table: "quote_events"): {
    insert(values: Record<string, unknown>): {
      select(columns: string): Promise<{
        data: unknown[] | null;
        error: { code?: string; message?: string } | null;
      }>;
    };
  };
};

/** Narrow the envelope client to the PDF write surface (single documented cast). */
export function asQuotePdfWriteClient(db: CommandDbClient): QuotePdfWriteClient {
  return db as unknown as QuotePdfWriteClient;
}

/** An existing PDF file_link row (for the find-or-create-or-repoint retry semantics — R-814). */
export interface ExistingPdfLinkRow {
  readonly id: string;
  readonly file_id: string;
}

/**
 * Find an EXISTING `quote_pdf` file_link for the version under the caller's RLS (own tenant).
 * Returns the link id + its current file_id, or null when none exists (first generation). Used
 * for the R-814 find-or-create: a retry re-points this ONE link rather than duplicating it.
 */
export async function findExistingPdfLink(
  db: CommandDbClient,
  quoteVersionId: string,
): Promise<ExistingPdfLinkRow | null> {
  const { data, error } = await (
    db as unknown as {
      from(table: "file_links"): {
        select(columns: string): {
          eq(
            column: string,
            value: string,
          ): {
            eq(
              column: string,
              value: string,
            ): {
              eq(
                column: string,
                value: string,
              ): {
                limit(n: number): Promise<{ data: unknown[] | null; error: unknown }>;
              };
            };
          };
        };
      };
    }
  )
    .from("file_links")
    .select("id, file_id")
    .eq("owner_type", "quote_version")
    .eq("owner_id", quoteVersionId)
    .eq("purpose", "quote_pdf")
    .limit(1);
  throwOnReadError("findExistingPdfLink", error);
  const raw = (data?.[0] ?? null) as Record<string, unknown> | null;
  if (raw === null) return null;
  return { id: String(raw.id), file_id: String(raw.file_id) };
}
