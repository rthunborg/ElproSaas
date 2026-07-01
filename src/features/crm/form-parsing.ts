/**
 * PURE FormData → command-input parsing + UX-side field validation for the CRM forms
 * (Story 3.2, Task 3.3 / 4.1). I/O-free so it is exhaustively unit-testable.
 *
 * CRITICAL boundary note: this is a UX NICETY, not the security/validation boundary.
 * The authority is the 3.1 command's `validateInput` on the server (architecture §5).
 * This module mirrors the 3.1 input contracts so the client never sends a shape the
 * validator rejects for a trivial reason, and so a near-miss surfaces as a
 * field-associated message INSTEAD of a generic VALIDATION_FAILED. The server still
 * re-validates everything.
 *
 * It returns BOTH the raw `input` (handed verbatim to `runCommand`) AND a map of
 * client-detected `fieldErrors` (empty when the form looks well-formed). It NEVER
 * routes personnummer into anything but the customer create input — and personnummer
 * is only collected on a `private` create.
 */
import {
  CUSTOMER_TYPES,
  type CustomerType,
} from "@/server/commands/crm/validation";

/** A parsed form: the raw command input + any client-detected field messages. */
export interface ParsedForm {
  readonly input: Record<string, unknown>;
  readonly fieldErrors: Readonly<Record<string, string>>;
  /** The submitted text values, echoed back so the form preserves input on failure. */
  readonly values: Readonly<Record<string, string>>;
}

/** Read a FormData entry as a trimmed string, or undefined when absent/blank. */
function field(form: FormData, name: string): string | undefined {
  const raw = form.get(name);
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Collect the raw (untrimmed-but-string) values for echo-back. */
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

const REQUIRED_MSG = "Fältet är obligatoriskt.";
const TYPE_MSG = "Välj en giltig kundtyp.";

const CUSTOMER_FIELDS = [
  "customer_type",
  "display_name",
  "personnummer",
  "org_nr",
  "contact_name",
  "email",
  "phone",
  "address_line1",
  "address_line2",
  "postal_code",
  "city",
] as const;

/**
 * Parse a customer CREATE form. Enforces (client-side, mirroring 3.1) the
 * identifier-by-type rule: a `private` customer carries a personnummer (and no
 * org_nr); a non-private carries an org_nr (and no personnummer). The identifier
 * field is driven by the selected type in the UI, so the opposite field is simply not
 * submitted — but we defensively drop a wrong-type identifier here too.
 */
export function parseCreateCustomerForm(form: FormData): ParsedForm {
  const fieldErrors: Record<string, string> = {};
  const values = collectValues(form, CUSTOMER_FIELDS);

  const rawType = field(form, "customer_type");
  const isType = (v: string | undefined): v is CustomerType =>
    typeof v === "string" && (CUSTOMER_TYPES as readonly string[]).includes(v);
  if (!isType(rawType)) {
    fieldErrors.customer_type = TYPE_MSG;
  }
  const displayName = field(form, "display_name");
  if (!displayName) fieldErrors.display_name = REQUIRED_MSG;

  const type = isType(rawType) ? rawType : undefined;
  const personnummer = field(form, "personnummer");
  const orgNr = field(form, "org_nr");

  // Identifier-by-type requiredness (only checkable once the type is valid).
  if (type === "private") {
    if (!personnummer) fieldErrors.personnummer = REQUIRED_MSG;
  } else if (type) {
    if (!orgNr) fieldErrors.org_nr = REQUIRED_MSG;
  }

  const input: Record<string, unknown> = {
    customer_type: rawType,
    display_name: displayName,
    contact_name: field(form, "contact_name"),
    email: field(form, "email"),
    phone: field(form, "phone"),
    address_line1: field(form, "address_line1"),
    address_line2: field(form, "address_line2"),
    postal_code: field(form, "postal_code"),
    city: field(form, "city"),
  };
  // Only attach the identifier that matches the type (drives the DB CHECK + 3.1 rule).
  if (type === "private") {
    if (personnummer) input.personnummer = personnummer;
  } else if (type) {
    if (orgNr) input.org_nr = orgNr;
  }

  return { input, fieldErrors, values };
}

/**
 * Parse a customer UPDATE form. `customer_type` is NOT mutable (the 3.1 validator
 * edits within-type fields only — no type switch), so it is never read here. The
 * identifier field stays consistent with the existing type (the UI shows only the
 * relevant one); whichever identifier field is present is forwarded.
 */
export function parseUpdateCustomerForm(form: FormData): ParsedForm {
  const fieldErrors: Record<string, string> = {};
  const id = field(form, "id");
  const values = collectValues(form, ["id", ...CUSTOMER_FIELDS]);

  if (!id) fieldErrors.id = REQUIRED_MSG;
  const displayName = field(form, "display_name");
  // display_name is optional on update, but if the field is present-and-blank the
  // user likely cleared a required value — surface it next to the field.
  if (form.has("display_name") && !displayName) {
    fieldErrors.display_name = REQUIRED_MSG;
  }

  const input: Record<string, unknown> = {
    id,
    display_name: displayName,
    personnummer: field(form, "personnummer"),
    org_nr: field(form, "org_nr"),
    contact_name: field(form, "contact_name"),
    email: field(form, "email"),
    phone: field(form, "phone"),
    address_line1: field(form, "address_line1"),
    address_line2: field(form, "address_line2"),
    postal_code: field(form, "postal_code"),
    city: field(form, "city"),
  };
  return { input, fieldErrors, values };
}

const FACILITY_FIELDS = [
  "name",
  "address_line1",
  "address_line2",
  "postal_code",
  "city",
] as const;

/** Parse a facility CREATE form (requires customer_id + name). */
export function parseCreateFacilityForm(form: FormData): ParsedForm {
  const fieldErrors: Record<string, string> = {};
  const values = collectValues(form, ["customer_id", ...FACILITY_FIELDS]);
  const customerId = field(form, "customer_id");
  const name = field(form, "name");
  if (!name) fieldErrors.name = REQUIRED_MSG;

  const input: Record<string, unknown> = {
    customer_id: customerId,
    name,
    address_line1: field(form, "address_line1"),
    address_line2: field(form, "address_line2"),
    postal_code: field(form, "postal_code"),
    city: field(form, "city"),
  };
  return { input, fieldErrors, values };
}

/** Parse a facility UPDATE form (requires id; name optional but non-blank if given). */
export function parseUpdateFacilityForm(form: FormData): ParsedForm {
  const fieldErrors: Record<string, string> = {};
  const values = collectValues(form, ["id", ...FACILITY_FIELDS]);
  const id = field(form, "id");
  const name = field(form, "name");
  if (!id) fieldErrors.id = REQUIRED_MSG;
  if (form.has("name") && !name) fieldErrors.name = REQUIRED_MSG;

  const input: Record<string, unknown> = {
    id,
    name,
    address_line1: field(form, "address_line1"),
    address_line2: field(form, "address_line2"),
    postal_code: field(form, "postal_code"),
    city: field(form, "city"),
  };
  return { input, fieldErrors, values };
}

const CONTACT_FIELDS = [
  "name",
  "facility_id",
  "email",
  "phone",
  "role_label",
  "is_primary",
] as const;

/** Read a checkbox/boolean form field ("on"/"true"/"1" → true). */
function bool(form: FormData, name: string): boolean | undefined {
  const raw = form.get(name);
  if (typeof raw !== "string") return undefined;
  return raw === "on" || raw === "true" || raw === "1";
}

/** Parse a contact CREATE form (requires customer_id + name; facility optional). */
export function parseCreateContactForm(form: FormData): ParsedForm {
  const fieldErrors: Record<string, string> = {};
  const values = collectValues(form, ["customer_id", ...CONTACT_FIELDS]);
  const customerId = field(form, "customer_id");
  const name = field(form, "name");
  if (!name) fieldErrors.name = REQUIRED_MSG;

  const input: Record<string, unknown> = {
    customer_id: customerId,
    name,
    facility_id: field(form, "facility_id"),
    email: field(form, "email"),
    phone: field(form, "phone"),
    role_label: field(form, "role_label"),
  };
  const isPrimary = bool(form, "is_primary");
  if (isPrimary !== undefined) input.is_primary = isPrimary;
  return { input, fieldErrors, values };
}

/** Parse a contact UPDATE form (requires id; name optional but non-blank if given). */
export function parseUpdateContactForm(form: FormData): ParsedForm {
  const fieldErrors: Record<string, string> = {};
  const values = collectValues(form, ["id", ...CONTACT_FIELDS]);
  const id = field(form, "id");
  const name = field(form, "name");
  if (!id) fieldErrors.id = REQUIRED_MSG;
  if (form.has("name") && !name) fieldErrors.name = REQUIRED_MSG;

  const input: Record<string, unknown> = {
    id,
    name,
    facility_id: field(form, "facility_id"),
    email: field(form, "email"),
    phone: field(form, "phone"),
    role_label: field(form, "role_label"),
  };
  const isPrimary = bool(form, "is_primary");
  if (isPrimary !== undefined) input.is_primary = isPrimary;
  return { input, fieldErrors, values };
}

/** The id-only form parse shared by the archive actions. */
export function parseArchiveForm(form: FormData): ParsedForm {
  const fieldErrors: Record<string, string> = {};
  const id = field(form, "id");
  if (!id) fieldErrors.id = REQUIRED_MSG;
  return { input: { id }, fieldErrors, values: collectValues(form, ["id"]) };
}
