/**
 * PURE quote command input validators (Story 6.1, Task 3.2; architecture §5 step 4).
 *
 * `validateCreateQuoteVersionFromCalculation` returns a `ValidationResult<I>` — the
 * validated, narrowed value or `VALIDATION_FAILED`. The raw invalid value is NEVER
 * echoed (the envelope maps the failure to a generic user-safe message). Pure functions
 * (no I/O) so the shape rules are exhaustively unit-testable WITHOUT a database,
 * mirroring `calculations/validation.ts` / `files/validation.ts`.
 *
 * Client-supplied `tenant_id` is NEVER read here — the resolved tenant from membership
 * is the only authority (the validators strip/ignore any `tenant_id`). The caller
 * supplies ONLY the source calculation id + the OPTIONAL selected attachment file ids;
 * the full snapshot content (identity/terms/totals/warnings) is RESOLVED server-side
 * from the live rows (never trusted from the client) in the command `execute` body.
 */
import type { ValidationResult } from "../envelope-core";

const fail = { ok: false as const, code: "VALIDATION_FAILED" as const };

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return raw !== null && typeof raw === "object";
}

/** A UUID-shape guard so an `id` the DB would reject (`22P02`) fails as VALIDATION. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuidLike(v: unknown): v is string {
  return typeof v === "string" && v.length <= 36 && UUID_RE.test(v);
}

/** A bounded array of UUID-shaped ids (the selected attachment file ids — optional). */
function isUuidArray(v: unknown): v is string[] {
  return (
    Array.isArray(v) && v.length <= 100 && v.every((x) => isUuidLike(x))
  );
}

/**
 * Validated `createQuoteVersionFromCalculation` input. `calculation_id` is required +
 * UUID-shaped; `attachment_file_ids` is an OPTIONAL bounded array of own-tenant file ids
 * (re-validated for ownership in the command execute — a foreign id → TENANT_ACCESS_DENIED).
 * tenant_id is NEVER part of it (derived from the resolved membership).
 */
export interface CreateQuoteVersionInput {
  readonly calculation_id: string;
  readonly attachment_file_ids: readonly string[];
}

export function validateCreateQuoteVersionFromCalculation(
  raw: unknown,
): ValidationResult<CreateQuoteVersionInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.calculation_id)) return fail;
  // attachment_file_ids is OPTIONAL. When present it must be a bounded UUID array; an
  // absent/empty value means "no attachments selected" (an empty list).
  let attachmentFileIds: string[] = [];
  if (raw.attachment_file_ids !== undefined && raw.attachment_file_ids !== null) {
    if (!isUuidArray(raw.attachment_file_ids)) return fail;
    attachmentFileIds = [...(raw.attachment_file_ids as string[])];
  }
  return {
    ok: true,
    data: {
      calculation_id: raw.calculation_id as string,
      attachment_file_ids: attachmentFileIds,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 6.2 — the DRAFT-edit input validator.
//
// The allowed draft edits are scoped CONSERVATIVELY to genuinely customer-visible,
// PRESENTATIONAL draft fields (intro text, customer-visible notes, validity date, display
// mode) — NOT line/price/VAT/ROT re-derivation (that is a NEW version via Story 6.5's RPC,
// never a draft edit). A draft edit does NOT re-read/re-freeze the source calc — it edits the
// already-frozen draft row's presentational fields in place. The re-assert-draft ENFORCEMENT
// lives in the command execute (a status load), not here — this validator only shapes input.
// ─────────────────────────────────────────────────────────────────────────────

/** The closed set of display modes a draft may present as (mirrors the calc section modes). */
const DISPLAY_MODES = new Set(["detailed", "summary", "text_only"]);

/** A max length for the free-text presentational fields (a coarse bound, not a business rule). */
const TEXT_MAX = 5000;

function isOptionalBoundedText(v: unknown): v is string | null | undefined {
  if (v === undefined || v === null) return true;
  return typeof v === "string" && v.length <= TEXT_MAX;
}

/** An optional ISO-8601 date/timestamp string (or null to clear it). */
function isOptionalIsoDate(v: unknown): v is string | null | undefined {
  if (v === undefined || v === null) return true;
  if (typeof v !== "string") return false;
  if (v.length === 0 || v.length > 40) return false;
  const t = Date.parse(v);
  return Number.isFinite(t);
}

function isOptionalDisplayMode(v: unknown): v is string | null | undefined {
  if (v === undefined || v === null) return true;
  return typeof v === "string" && DISPLAY_MODES.has(v);
}

/**
 * Validated `updateDraftQuoteVersion` input. `quote_version_id` is required + UUID-shaped; the
 * allowed presentational fields are OPTIONAL (an absent field is left unchanged; a `null`
 * explicitly clears it). tenant_id / status / totals / lines are NEVER part of it — a draft
 * edit can only touch these presentational fields (line/price/VAT changes are Story 6.5).
 */
export interface UpdateDraftQuoteVersionInput {
  readonly quote_version_id: string;
  readonly intro_text?: string | null;
  readonly customer_notes?: string | null;
  readonly valid_until?: string | null;
  readonly display_mode?: string | null;
}

export function validateUpdateDraftQuoteVersion(
  raw: unknown,
): ValidationResult<UpdateDraftQuoteVersionInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.quote_version_id)) return fail;
  if (!isOptionalBoundedText(raw.intro_text)) return fail;
  if (!isOptionalBoundedText(raw.customer_notes)) return fail;
  if (!isOptionalIsoDate(raw.valid_until)) return fail;
  if (!isOptionalDisplayMode(raw.display_mode)) return fail;

  const data: {
    quote_version_id: string;
    intro_text?: string | null;
    customer_notes?: string | null;
    valid_until?: string | null;
    display_mode?: string | null;
  } = { quote_version_id: raw.quote_version_id as string };
  // Only carry a field when the caller actually supplied it (an absent field = unchanged; a
  // present `null` = clear it). This preserves the empty-patch guard semantics downstream.
  if ("intro_text" in raw) data.intro_text = (raw.intro_text as string | null) ?? null;
  if ("customer_notes" in raw)
    data.customer_notes = (raw.customer_notes as string | null) ?? null;
  if ("valid_until" in raw) data.valid_until = (raw.valid_until as string | null) ?? null;
  if ("display_mode" in raw) data.display_mode = (raw.display_mode as string | null) ?? null;
  return { ok: true, data };
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 6.3 — the generate-quote-PDF input validator.
//
// The caller supplies ONLY the target `quote_version_id` (UUID-shaped). tenant_id is NEVER
// read (the resolved tenant from membership is the only authority). The full snapshot content
// is READ server-side from the FROZEN version rows in the command execute — never trusted from
// the client (a PDF built from client-supplied data would defeat the copy-by-value freeze).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validated `generateQuotePdf` input — just the target version id. A foreign/non-existent id is
 * caught by the envelope ownership gate (TENANT_ACCESS_DENIED before execute), not here.
 */
export interface GenerateQuotePdfInput {
  readonly quote_version_id: string;
}

export function validateGenerateQuotePdf(
  raw: unknown,
): ValidationResult<GenerateQuotePdfInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.quote_version_id)) return fail;
  return { ok: true, data: { quote_version_id: raw.quote_version_id as string } };
}
