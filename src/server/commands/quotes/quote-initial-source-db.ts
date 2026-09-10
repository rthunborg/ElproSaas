import { CommandError } from "../command-errors";
import type { CommandDbClient } from "../envelope";
import type {
  CustomerVisibleQuoteSnapshotSource,
  SnapshotCustomerSource,
} from "./snapshot-build";
import type {
  CalcHeaderRow,
  CalcRowRow,
  CalcSectionRow,
  CompanyIdentityRow,
  QuoteTermsRow,
} from "./quote-db";
import type { QuoteAttachmentSource } from "@/lib/quote-snapshot";
import { buildCustomerVisibleQuoteReviewDigest } from "./review-token";
import type { QuoteSnapshotBuildResult } from "./snapshot-build";

/** The Seller-only source is a checked RPC, never a reusable calculation read. */
export type QuoteInitialCustomerVisibleSourceRpcClient = {
  rpc(
    fn: "read_quote_initial_customer_visible_source",
    args: {
      readonly p_tenant_id: string;
      readonly p_calculation_id: string;
      readonly p_requested_attachment_ids: readonly string[];
      readonly p_actor_user_id: string;
    },
  ): Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

export type QuoteInitialCustomerVisibleAuthorizationRpcClient = {
  rpc(
    fn: "authorize_quote_initial_customer_visible_review",
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
      readonly p_reviewed_quote_capture_date: string;
      readonly p_reviewed_calculation_status: string;
      readonly p_actor_user_id: string;
      readonly p_correlation_id: string;
    },
  ): Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

export function asQuoteInitialCustomerVisibleSourceRpcClient(
  db: CommandDbClient,
): QuoteInitialCustomerVisibleSourceRpcClient {
  return db as unknown as QuoteInitialCustomerVisibleSourceRpcClient;
}

export function asQuoteInitialCustomerVisibleAuthorizationRpcClient(
  db: CommandDbClient,
): QuoteInitialCustomerVisibleAuthorizationRpcClient {
  return db as unknown as QuoteInitialCustomerVisibleAuthorizationRpcClient;
}

export interface QuoteInitialCustomerVisibleSource {
  readonly source: CustomerVisibleQuoteSnapshotSource;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberOrNull(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseHeader(value: unknown): CalcHeaderRow | null {
  const row = record(value);
  const id = requiredString(row?.id);
  const customerId = requiredString(row?.customer_id);
  const title = requiredString(row?.title);
  const status = requiredString(row?.status);
  if (!row || !id || !customerId || !title || !status) return null;
  return { id, customer_id: customerId, facility_id: stringOrNull(row.facility_id), contact_id: stringOrNull(row.contact_id), title, status, tax_input_snapshot: row.tax_input_snapshot ?? null };
}

function parseSections(value: unknown): CalcSectionRow[] | null {
  if (!Array.isArray(value)) return null;
  const parsed: CalcSectionRow[] = [];
  for (const item of value) {
    const row = record(item);
    const id = requiredString(row?.id);
    const displayMode = requiredString(row?.display_mode);
    const sortOrder = numberOrNull(row?.sort_order);
    if (!row || !id || !displayMode || sortOrder === null) return null;
    parsed.push({ id, title: stringOrNull(row.title), display_mode: displayMode, sort_order: sortOrder });
  }
  return parsed;
}

function parseRows(value: unknown): Omit<CalcRowRow, "unit_cost_ore">[] | null {
  if (!Array.isArray(value)) return null;
  const parsed: Omit<CalcRowRow, "unit_cost_ore">[] = [];
  for (const item of value) {
    const row = record(item);
    const id = requiredString(row?.id); const sectionId = requiredString(row?.section_id);
    const rowType = requiredString(row?.row_type); const unit = requiredString(row?.unit);
    const deduction = requiredString(row?.deduction_classification); const vat = requiredString(row?.vat_type);
    const quantity = numberOrNull(row?.quantity); const sortOrder = numberOrNull(row?.sort_order);
    const sell = numberOrNull(row?.unit_sell_ore); const rate = numberOrNull(row?.vat_rate_bp);
    if (!row || !id || !sectionId || !rowType || !unit || !deduction || !vat || quantity === null || sortOrder === null || typeof row.included_in_invoice_total !== "boolean" || typeof row.is_hidden !== "boolean" || typeof row.is_optional !== "boolean") return null;
    parsed.push({ id, section_id: sectionId, row_type: rowType, quantity, unit, unit_sell_ore: sell, vat_rate_bp: rate, included_in_invoice_total: row.included_in_invoice_total, deduction_classification: deduction, vat_type: vat, is_hidden: row.is_hidden, is_optional: row.is_optional, is_selected: typeof row.is_selected === "boolean" ? row.is_selected : null, label: stringOrNull(row.label), description: stringOrNull(row.description), quote_note: stringOrNull(row.quote_note), sort_order: sortOrder, source_kind: stringOrNull(row.source_kind) });
  }
  return parsed;
}

function parseSource(data: unknown): QuoteInitialCustomerVisibleSource | null {
  const raw = record(Array.isArray(data) ? data[0] : data);
  const calculation = parseHeader(raw?.calculation);
  const sections = parseSections(raw?.sections);
  const rows = parseRows(raw?.rows);
  const customer = record(raw?.customer);
  const lowMarginWarning = record(raw?.low_margin_warning);
  const lowMarginPresent = lowMarginWarning?.present;
  const thresholdPercent = numberOrNull(lowMarginWarning?.threshold_percent);
  if (!raw || !calculation || !sections || !rows || !customer || typeof lowMarginPresent !== "boolean" || (thresholdPercent !== null && (!Number.isInteger(thresholdPercent) || thresholdPercent < 0 || thresholdPercent > 100))) return null;
  const customerSource: SnapshotCustomerSource = { display_name: stringOrNull(customer.display_name), customer_type: stringOrNull(customer.customer_type), facility_name: stringOrNull(customer.facility_name), contact_name: stringOrNull(customer.contact_name) };
  const companyRaw = raw.company === null ? null : record(raw.company);
  const termsRaw = raw.terms === null ? null : record(raw.terms);
  const identity: CompanyIdentityRow | null = companyRaw === null ? null : { company_name: stringOrNull(companyRaw.company_name), org_nr: stringOrNull(companyRaw.org_nr), address_line1: stringOrNull(companyRaw.address_line1), address_line2: stringOrNull(companyRaw.address_line2), postal_code: stringOrNull(companyRaw.postal_code), city: stringOrNull(companyRaw.city), email: stringOrNull(companyRaw.email), phone: stringOrNull(companyRaw.phone), logo_url: stringOrNull(companyRaw.logo_url), default_vat_display: stringOrNull(companyRaw.default_vat_display), vat_rate_bp: numberOrNull(companyRaw.vat_rate_bp) };
  const terms: QuoteTermsRow | null = termsRaw === null ? null : { terms_text: stringOrNull(termsRaw.terms_text), approved_at: stringOrNull(termsRaw.approved_at), approved_by: stringOrNull(termsRaw.approved_by) };
  const attachmentsRaw = raw.attachments;
  if (!Array.isArray(attachmentsRaw)) return null;
  const attachments: QuoteAttachmentSource[] = [];
  for (const attachment of attachmentsRaw) { const item = record(attachment); const fileId = requiredString(item?.file_id); const order = numberOrNull(item?.sort_order); if (!item || !fileId || order === null) return null; attachments.push({ fileId, displayName: stringOrNull(item.display_name), sortOrder: order }); }
  return { source: { header: calculation, sections, rows, identity, terms, customer: customerSource, attachments, lowMarginWarning: { present: lowMarginPresent, thresholdPercent } } };
}

export async function loadQuoteInitialCustomerVisibleSource(
  db: CommandDbClient,
  args: QuoteInitialCustomerVisibleSourceRpcClient["rpc"] extends (fn: infer _Fn, args: infer Args) => unknown ? Args : never,
): Promise<QuoteInitialCustomerVisibleSource> {
  const { data, error } = await asQuoteInitialCustomerVisibleSourceRpcClient(db).rpc("read_quote_initial_customer_visible_source", args);
  if (error?.code === "42501" || error?.code === "QV409") throw new CommandError("TENANT_ACCESS_DENIED");
  if (error) throw new Error("read quote initial customer-visible source failed");
  const parsed = parseSource(data);
  if (parsed === null) throw new Error("read quote initial customer-visible source returned an invalid projection");
  return parsed;
}

/** Build the preview-only token from visible facts and canonical visible warnings. */
export function buildQuoteInitialCustomerVisibleReviewDigest(
  source: CustomerVisibleQuoteSnapshotSource,
  built: QuoteSnapshotBuildResult,
): string {
  return buildCustomerVisibleQuoteReviewDigest({
    quoteCaptureDate: built.quoteCaptureDate,
    calculation: { id: source.header.id, status: source.header.status, customerId: source.header.customer_id, facilityId: source.header.facility_id, contactId: source.header.contact_id, taxInput: source.header.tax_input_snapshot },
    sections: source.sections.map((section) => ({ id: section.id, title: section.title, displayMode: section.display_mode, sortOrder: section.sort_order })),
    rows: source.rows.map((row) => ({ id: row.id, sectionId: row.section_id, rowType: row.row_type, quantity: row.quantity, unit: row.unit, unitCostOre: null, sourceKind: row.source_kind, unitSellOre: row.unit_sell_ore, vatRateBp: row.vat_rate_bp, includedInInvoiceTotal: row.included_in_invoice_total, deductionClassification: row.deduction_classification, vatType: row.vat_type, isHidden: row.is_hidden, isOptional: row.is_optional, isSelected: row.is_selected, label: row.label, description: row.description, quoteNote: row.quote_note, sortOrder: row.sort_order })),
    customer: { displayName: source.customer?.display_name ?? null, customerType: source.customer?.customer_type ?? null, facilityName: source.customer?.facility_name ?? null, contactName: source.customer?.contact_name ?? null },
    company: source.identity === null ? null : { companyName: source.identity.company_name, orgNr: source.identity.org_nr, addressLine1: source.identity.address_line1, addressLine2: source.identity.address_line2, postalCode: source.identity.postal_code, city: source.identity.city, email: source.identity.email, phone: source.identity.phone, logoUrl: source.identity.logo_url, defaultVatDisplay: source.identity.default_vat_display, vatRateBp: source.identity.vat_rate_bp },
    terms: source.terms === null ? null : { text: source.terms.terms_text, approvedAt: source.terms.approved_at, approvedBy: source.terms.approved_by },
    attachments: source.attachments.map((attachment) => ({ fileId: attachment.fileId, displayName: attachment.displayName, sortOrder: attachment.sortOrder })),
  }, built.snapshot.warnings);
}
