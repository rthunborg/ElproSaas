/**
 * PURE settings input validators (Story 3.3, Task 2.1; architecture §5 step 4).
 *
 * Each command's `validateInput` returns a `ValidationResult<I>` — the validated,
 * narrowed value or `VALIDATION_FAILED`. The raw invalid value is NEVER echoed (the
 * envelope maps the failure to a generic user-safe message). These are pure
 * functions (no I/O) so the VAT-display enum / basis-points range / optional
 * text/email/phone rules are exhaustively unit-testable without a database.
 *
 * MONEY/VAT discipline (architecture §10; epic-3 retro-note): `vat_rate_bp` is an
 * INTEGER in BASIS POINTS ([0, 10000]; 2500 = 25.00%) — a float / non-integer is
 * rejected here (basis points are integers, NEVER a float). NO VAT/ROT calculation
 * is performed (Epic 4 owns the engine) — this only validates the stored default.
 *
 * SIGN-OFF discipline (epics.md AC2; epic-3 HARD STOP-CONDITION): the quote-terms
 * validators NEVER read or accept an `approved`/`approved_at`/`status` field — a
 * terms record is not-approved by construction, and approval is set ONLY by the
 * deliberate `approveQuoteTerms` command. A client-supplied approval flag is simply
 * ignored (the validators strip it).
 *
 * Client-supplied `tenant_id` is NEVER read here — the resolved tenant from
 * membership is the only authority (the validators strip/ignore any `tenant_id`).
 */
import { isVatRateBp, VAT_RATE_BP_MAX, VAT_RATE_BP_MIN } from "@/lib/money";
import type { ValidationResult } from "../envelope-core";

/**
 * The owner-approved DEFAULT VAT DISPLAY modes (owner decision 2026-06-18). These
 * capture the company-customer togglability ("company_togglable" = incl-VAT display
 * togglable, the default; "company_excl" = default to excl-VAT display). The
 * private-customer rule (ALWAYS incl-VAT, not togglable) is an invariant the later
 * VAT presentation honours regardless of this setting (Epic 4) — it is NOT an option
 * here. Mirrors the DB CHECK `company_settings_default_vat_display_valid`.
 */
export const VAT_DISPLAY_MODES = ["company_togglable", "company_excl"] as const;
export type VatDisplayMode = (typeof VAT_DISPLAY_MODES)[number];

/** The legacy default VAT rate in basis points (25.00%). Owner 2026-06-18. */
export const DEFAULT_VAT_RATE_BP = 2500;
/**
 * Inclusive bounds for a VAT rate in basis points (0%..100.00%). RE-EXPORTED from the canonical
 * `@/lib/money` VAT engine (Story 4.2 moved them there, mirroring the Story 4.1 `isOreAmount`
 * consolidation) so there is exactly ONE basis-point range in the codebase. Existing consumers
 * (`src/features/settings/vat-display.ts`) import these from here unchanged.
 */
export { VAT_RATE_BP_MIN, VAT_RATE_BP_MAX };

/** Max length for a short free-text settings field (defensive bound). */
const MAX_TEXT = 256;
/** Max length for the longer address-ish / url fields. */
const MAX_LONG_TEXT = 512;
/** Max length for the customer-facing terms wording (bounded but generous). */
const MAX_TERMS_TEXT = 20000;

/** A pragmatic email shape (single line, bounded). Mirrors the CRM validator. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** A pragmatic phone shape (digits/spaces/+/-/() bounded, >= 5 chars). */
const PHONE_RE = /^[+()\-\s\d]{5,32}$/;

/** A UUID-shape guard so an `id` the DB would reject (`22P02`) fails as VALIDATION. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuidLike(v: unknown): v is string {
  return typeof v === "string" && v.length <= 36 && UUID_RE.test(v);
}

/** True iff `v` is a non-empty, bounded string. */
function isNonEmptyText(v: unknown, max = MAX_TEXT): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}

/** True iff `v` is a present (non-undefined, non-null, non-empty-string) value. */
function isPresent(v: unknown): boolean {
  return v !== undefined && v !== null && !(typeof v === "string" && v === "");
}

/** Validate an OPTIONAL bounded text field. Returns false only if present-but-bad. */
function optionalTextOk(v: unknown, max = MAX_TEXT): boolean {
  if (!isPresent(v)) return true;
  return typeof v === "string" && v.length > 0 && v.length <= max;
}

/** Validate an OPTIONAL email field (only when present). */
function optionalEmailOk(v: unknown): boolean {
  if (!isPresent(v)) return true;
  return typeof v === "string" && v.length <= MAX_TEXT && EMAIL_RE.test(v);
}

/** Validate an OPTIONAL phone field (only when present). */
function optionalPhoneOk(v: unknown): boolean {
  if (!isPresent(v)) return true;
  return typeof v === "string" && PHONE_RE.test(v);
}

/** Read a record's key as a string, or undefined when absent/empty. */
function str(rec: Record<string, unknown>, key: string): string | undefined {
  const v = rec[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return raw !== null && typeof raw === "object";
}

const fail = { ok: false as const, code: "VALIDATION_FAILED" as const };

// ─────────────────────────────────────────────────────────────────────────────
// company_settings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validated `updateCompanySettings` input (tenant_id is NEVER part of it —
 * derived). `company_name` is REQUIRED (non-empty after trim — the migration's
 * stated command-layer contract / AC1); the other identity fields are optional;
 * `default_vat_display` must be an allowed enum value; `vat_rate_bp` must be an
 * INTEGER in [0, 10000].
 */
export interface UpdateCompanySettingsInput {
  readonly company_name: string;
  readonly org_nr?: string;
  readonly address_line1?: string;
  readonly address_line2?: string;
  readonly postal_code?: string;
  readonly city?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly logo_url?: string;
  readonly default_vat_display: VatDisplayMode;
  readonly vat_rate_bp: number;
}

// The basis-point-validity rule `isVatRateBp` is the CANONICAL `@/lib/money` VAT authority
// (imported above; Story 4.2 moved it there mirroring the 4.1 `isOreAmount` move). There is
// exactly ONE `isVatRateBp` implementation — the settings command layer and the VAT engine
// share it; a forked bp check here would be a review-caught anti-pattern.

export function validateUpdateCompanySettings(
  raw: unknown,
): ValidationResult<UpdateCompanySettingsInput> {
  if (!isRecord(raw)) return fail;

  // default_vat_display must be one of the allowed enum values.
  const display = raw.default_vat_display;
  if (
    typeof display !== "string" ||
    !(VAT_DISPLAY_MODES as readonly string[]).includes(display)
  ) {
    return fail;
  }

  // vat_rate_bp must be an INTEGER in [0, 10000] (basis points, never a float).
  if (!isVatRateBp(raw.vat_rate_bp)) return fail;

  // company_name is the ONLY REQUIRED identity field at the command layer (AC1;
  // the migration header states this contract). Reject an absent / blank /
  // whitespace-only company name so a direct/bypassed-client command invocation
  // cannot persist a settings row with no company name (the DB column is nullable
  // and the UX `required` attribute is not the authority — `validateInput` is).
  // Trim before the empty check, mirroring `isNonEmptyText`.
  if (!isNonEmptyText(raw.company_name)) return fail;

  // Optional identity fields — validated only when present.
  if (!optionalTextOk(raw.org_nr)) return fail;
  if (!optionalTextOk(raw.address_line1, MAX_LONG_TEXT)) return fail;
  if (!optionalTextOk(raw.address_line2, MAX_LONG_TEXT)) return fail;
  if (!optionalTextOk(raw.postal_code)) return fail;
  if (!optionalTextOk(raw.city)) return fail;
  if (!optionalEmailOk(raw.email)) return fail;
  if (!optionalPhoneOk(raw.phone)) return fail;
  if (!optionalTextOk(raw.logo_url, MAX_LONG_TEXT)) return fail;

  const value: UpdateCompanySettingsInput = {
    default_vat_display: display as VatDisplayMode,
    vat_rate_bp: raw.vat_rate_bp as number,
    company_name: (raw.company_name as string).trim(),
    org_nr: str(raw, "org_nr"),
    address_line1: str(raw, "address_line1"),
    address_line2: str(raw, "address_line2"),
    postal_code: str(raw, "postal_code"),
    city: str(raw, "city"),
    email: str(raw, "email"),
    phone: str(raw, "phone"),
    logo_url: str(raw, "logo_url"),
  };
  return { ok: true, data: value };
}

// ─────────────────────────────────────────────────────────────────────────────
// quote_terms
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validated `updateQuoteTerms` input — ONLY the wording (tenant_id derived). NO
 * approval field is read here: a terms record is not-approved by construction and
 * approval is set ONLY by `approveQuoteTerms` (the sign-off STOP-CONDITION).
 */
export interface UpdateQuoteTermsInput {
  readonly terms_text: string;
}

export function validateUpdateQuoteTerms(
  raw: unknown,
): ValidationResult<UpdateQuoteTermsInput> {
  if (!isRecord(raw)) return fail;
  if (!isNonEmptyText(raw.terms_text, MAX_TERMS_TEXT)) return fail;
  return {
    ok: true,
    data: { terms_text: (raw.terms_text as string).trim() },
  };
}

/** Validated `approveQuoteTerms` input — the target terms row id only. */
export interface ApproveQuoteTermsInput {
  readonly id: string;
}

export function validateApproveQuoteTerms(
  raw: unknown,
): ValidationResult<ApproveQuoteTermsInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.id)) return fail;
  return { ok: true, data: { id: raw.id as string } };
}
