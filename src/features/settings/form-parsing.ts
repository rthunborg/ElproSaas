/**
 * PURE FormData → command-input parsing + UX-side field validation for the settings
 * forms (Story 3.3, Task 4.2/4.3). I/O-free so it is exhaustively unit-testable.
 *
 * CRITICAL boundary note: this is a UX NICETY, not the security/validation boundary.
 * The authority is the 3.3 command's `validateInput` on the server (architecture §5).
 * This mirrors the 3.3 input contracts so a near-miss surfaces as a field-associated
 * message INSTEAD of a generic VALIDATION_FAILED, and so the percent→basis-points
 * conversion happens at the boundary (the stored value is never a float). The server
 * still re-validates everything.
 *
 * It returns BOTH the raw `input` (handed verbatim to `runCommand`) AND a map of
 * client-detected `fieldErrors` (empty when the form looks well-formed).
 */
import { percentStringToBp } from "./vat-display";

/** A parsed form: the raw command input + any client-detected field messages. */
export interface ParsedSettingsForm {
  readonly input: Record<string, unknown>;
  readonly fieldErrors: Readonly<Record<string, string>>;
  /** The submitted text values, echoed back so the form preserves input on failure. */
  readonly values: Readonly<Record<string, string>>;
}

const REQUIRED_MSG = "Fältet är obligatoriskt.";
const VAT_RATE_MSG =
  "Ange en giltig momssats mellan 0 och 100 % (t.ex. 25).";

/** Read a FormData entry as a trimmed string, or undefined when absent/blank. */
function field(form: FormData, name: string): string | undefined {
  const raw = form.get(name);
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Collect the raw (string) values for echo-back. */
function collectValues(
  form: FormData,
  names: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of names) {
    const raw = form.get(name);
    if (typeof raw === "string") out[name] = raw;
  }
  return out;
}

const COMPANY_FIELDS = [
  "company_name",
  "org_nr",
  "address_line1",
  "address_line2",
  "postal_code",
  "city",
  "email",
  "phone",
  "logo_url",
  "default_vat_display",
  "vat_rate_percent",
] as const;

/**
 * Parse the company-settings form. The VAT rate is entered as a PERCENT and converted
 * to INTEGER basis points at the boundary (`vat_rate_bp`); a malformed/out-of-range
 * percent is a field-associated error (and never silently coerced). `default_vat_display`
 * is forwarded verbatim (the server validates the enum). `company_name` is required.
 */
export function parseCompanySettingsForm(form: FormData): ParsedSettingsForm {
  const fieldErrors: Record<string, string> = {};
  const values = collectValues(form, COMPANY_FIELDS);

  const companyName = field(form, "company_name");
  if (!companyName) fieldErrors.company_name = REQUIRED_MSG;

  const rawPercent = form.get("vat_rate_percent");
  const percentStr = typeof rawPercent === "string" ? rawPercent : "";
  const parsedBp = percentStringToBp(percentStr);
  if (!parsedBp.ok) fieldErrors.vat_rate_percent = VAT_RATE_MSG;

  const input: Record<string, unknown> = {
    company_name: companyName,
    org_nr: field(form, "org_nr"),
    address_line1: field(form, "address_line1"),
    address_line2: field(form, "address_line2"),
    postal_code: field(form, "postal_code"),
    city: field(form, "city"),
    email: field(form, "email"),
    phone: field(form, "phone"),
    logo_url: field(form, "logo_url"),
    default_vat_display: field(form, "default_vat_display"),
  };
  // Only attach a well-formed basis-points value; on a malformed percent the field
  // error already blocks the round-trip, so the server never sees a coerced float.
  if (parsedBp.ok) input.vat_rate_bp = parsedBp.bp;

  return { input, fieldErrors, values };
}

const QUOTE_TERMS_FIELDS = ["terms_text"] as const;

/** Parse the quote-terms edit form. `terms_text` is required + non-blank. NEVER reads
 * an approval field — saving terms NEVER approves them (the STOP-CONDITION). */
export function parseQuoteTermsForm(form: FormData): ParsedSettingsForm {
  const fieldErrors: Record<string, string> = {};
  const values = collectValues(form, QUOTE_TERMS_FIELDS);
  const termsText = field(form, "terms_text");
  if (!termsText) fieldErrors.terms_text = REQUIRED_MSG;
  return { input: { terms_text: termsText }, fieldErrors, values };
}

/** Parse the approve-terms form (the deliberate sign-off action — id only). */
export function parseApproveTermsForm(form: FormData): ParsedSettingsForm {
  const fieldErrors: Record<string, string> = {};
  const id = field(form, "id");
  if (!id) fieldErrors.id = REQUIRED_MSG;
  return { input: { id }, fieldErrors, values: collectValues(form, ["id"]) };
}
