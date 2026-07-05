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
