/**
 * PURE FormData → command-input parsing + UX-side field validation for the pricing
 * forms (Story 3.4, Task 4.2/4.3). I/O-free so it is exhaustively unit-testable.
 *
 * CRITICAL boundary note: this is a UX NICETY, not the security/validation boundary.
 * The authority is the 3.4 command's `validateInput` on the server (architecture §5).
 * This mirrors the 3.4 input contracts so a near-miss surfaces as a field-associated
 * message INSTEAD of a generic VALIDATION_FAILED, and so the kronor→öre conversion
 * happens at the boundary (the stored value is never a float). The server still
 * re-validates everything.
 *
 * It returns BOTH the raw `input` (handed verbatim to `runCommand`) AND a map of
 * client-detected `fieldErrors` (empty when the form looks well-formed). NO supplier
 * field is parsed or forwarded — the article form has no supplier control, and a
 * smuggled supplier key would be stripped by the command validator regardless.
 */
import { kronorStringToOre } from "./money-display";

/** A parsed pricing form: the raw command input + any client-detected field messages. */
export interface ParsedPricingForm {
  readonly input: Record<string, unknown>;
  readonly fieldErrors: Readonly<Record<string, string>>;
  /** The submitted text values, echoed back so the form preserves input on failure. */
  readonly values: Readonly<Record<string, string>>;
}

const REQUIRED_MSG = "Fältet är obligatoriskt.";
const PRICE_MSG =
  "Ange ett giltigt pris (t.ex. 850,00). Negativa eller ogiltiga värden tillåts inte.";

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

const WORK_ROLE_FIELDS = [
  "id",
  "display_name",
  "cost_rate_kronor",
  "sell_rate_kronor",
] as const;

/**
 * Parse the work-role form. The cost + sell rates are entered as kronor (Swedish comma
 * decimal) and converted to INTEGER öre at the boundary (`cost_rate_ore`/
 * `sell_rate_ore`); a malformed/negative price is a field-associated error (and never
 * silently coerced). An optional `id` makes it an UPDATE; absent → CREATE.
 */
export function parseWorkRoleForm(form: FormData): ParsedPricingForm {
  const fieldErrors: Record<string, string> = {};
  const values = collectValues(form, WORK_ROLE_FIELDS);

  const id = field(form, "id");
  const displayName = field(form, "display_name");
  if (!displayName) fieldErrors.display_name = REQUIRED_MSG;

  // The SELL rate ("Pris (kr/tim)") is the required customer-facing hourly price.
  const sell = parsePriceField(form, "sell_rate_kronor", fieldErrors, true);
  // The COST rate ("Kostnad (kr/tim)") is OPTIONAL in the UI — it defaults to 0 öre
  // when blank (a tenant that prices only by a sell rate is valid for the pilot). When
  // PROVIDED it is still validated (negative/float → field error). Both are stored as
  // non-negative integer öre and re-validated by the command (the authority).
  const cost = parsePriceField(form, "cost_rate_kronor", fieldErrors, false);

  const input: Record<string, unknown> = {
    ...(id ? { id } : {}),
    display_name: displayName,
  };
  // Only attach well-formed integer-öre values; on a malformed price the field error
  // already blocks the round-trip, so the server never sees a coerced float.
  if (sell !== undefined) input.sell_rate_ore = sell;
  // Cost defaults to 0 öre when omitted (and no field error was recorded for it).
  if (cost !== undefined) {
    input.cost_rate_ore = cost;
  } else if (!fieldErrors.cost_rate_kronor) {
    input.cost_rate_ore = 0;
  }

  return { input, fieldErrors, values };
}

const ARTICLE_FIELDS = ["id", "name", "sku", "unit", "unit_price_kronor"] as const;

/**
 * Parse the article form. `name` is required; `sku`/`unit` are optional manual labels;
 * the unit price is entered as kronor and converted to INTEGER öre at the boundary
 * (`unit_price_ore`). NO supplier field is read. An optional `id` → UPDATE.
 */
export function parseArticleForm(form: FormData): ParsedPricingForm {
  const fieldErrors: Record<string, string> = {};
  const values = collectValues(form, ARTICLE_FIELDS);

  const id = field(form, "id");
  const name = field(form, "name");
  if (!name) fieldErrors.name = REQUIRED_MSG;

  const price = parsePriceField(form, "unit_price_kronor", fieldErrors, true);

  const input: Record<string, unknown> = {
    ...(id ? { id } : {}),
    name,
    sku: field(form, "sku"),
    unit: field(form, "unit"),
  };
  if (price !== undefined) input.unit_price_ore = price;

  return { input, fieldErrors, values };
}

/** Parse an archive form (work role or article) — the target id only. */
export function parseArchiveForm(form: FormData): ParsedPricingForm {
  const fieldErrors: Record<string, string> = {};
  const id = field(form, "id");
  if (!id) fieldErrors.id = REQUIRED_MSG;
  return { input: { id }, fieldErrors, values: collectValues(form, ["id"]) };
}

/**
 * Parse a kronor price field into integer öre at the boundary. Records a
 * field-associated error (and returns undefined) when the value is malformed — or, for a
 * REQUIRED field, when it is missing — so the server never sees a coerced float and the
 * form can re-render the field invalid. A blank OPTIONAL field returns undefined with NO
 * error (the caller supplies a default).
 */
function parsePriceField(
  form: FormData,
  name: string,
  fieldErrors: Record<string, string>,
  required: boolean,
): number | undefined {
  const raw = form.get(name);
  const str = typeof raw === "string" ? raw : "";
  if (str.trim().length === 0) {
    if (required) fieldErrors[name] = REQUIRED_MSG;
    return undefined;
  }
  const parsed = kronorStringToOre(str);
  if (!parsed.ok) {
    fieldErrors[name] = PRICE_MSG;
    return undefined;
  }
  return parsed.ore;
}
