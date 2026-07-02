/**
 * PURE pricing input validators (Story 3.4, Task 2.1; architecture §5 step 4).
 *
 * Each command's `validateInput` returns a `ValidationResult<I>` — the validated,
 * narrowed value or `VALIDATION_FAILED`. The raw invalid value is NEVER echoed (the
 * envelope maps the failure to a generic user-safe message). These are pure functions
 * (no I/O) so the INTEGER-ÖRE money discipline + the no-supplier-scope validated-shape
 * contract are exhaustively unit-testable without a database.
 *
 * MONEY discipline (architecture §10; epic-3 retro-note): cost/sell hourly RATES and
 * the article unit price are MONEY — stored as INTEGER ÖRE (`bigint`). The load-bearing
 * unit is `isOreAmount(v)`: it accepts ONLY a non-negative SAFE integer and REJECTS
 * floats, negatives, NaN/Infinity, overflow, locale-comma strings ("850,00"), decimal
 * strings ("850.00"), and any numeric/non-numeric string. The UI converts kronor→öre at
 * the boundary BEFORE the command; the command RE-VALIDATES the integer öre as the
 * authority (the UI parse is a UX nicety only). NO calculation is performed on the
 * rates (Epic 4 owns the money/VAT engine) — they are STORED as reusable prices only.
 *
 * HARD NON-NEGOTIABLE — NO SUPPLIER SCOPE (epic-3 retro-note; epics.md AC2): the
 * article validator's OUTPUT type carries ONLY the minimal manual columns — any
 * client-supplied supplier-ish key (supplier_id / vendor / sync / fortnox / api_key /
 * external_ref / import / edi / mapping) is simply NOT in the validated shape (stripped),
 * mirroring the CRM tenant_id-stripping discipline. The command can never write it.
 *
 * Client-supplied `tenant_id` is NEVER read here — the resolved tenant from membership
 * is the only authority (the validators strip/ignore any `tenant_id`).
 */
import type { ValidationResult } from "../envelope-core";
// The öre-validity authority lives in `@/lib/money` (Story 4.1 moved the canonical
// implementation there so the money engine and the pricing validators share ONE rule — no
// fork). It is re-exported below so this module remains the pricing validators' import site.
import {
  isOreAmount as isOreAmountCanonical,
  ORE_AMOUNT_MAX as ORE_AMOUNT_MAX_CANONICAL,
} from "@/lib/money";

/** Max length for a short free-text pricing field (defensive bound). */
const MAX_TEXT = 256;

/** A UUID-shape guard so an `id` the DB would reject (`22P02`) fails as VALIDATION. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuidLike(v: unknown): v is string {
  return typeof v === "string" && v.length <= 36 && UUID_RE.test(v);
}

/** True iff `v` is a non-empty (after trim), bounded string. */
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

/** Read a record's key as a trimmed string, or undefined when absent/empty. */
function str(rec: Record<string, unknown>, key: string): string | undefined {
  const v = rec[key];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return raw !== null && typeof raw === "object";
}

const fail = { ok: false as const, code: "VALIDATION_FAILED" as const };

/**
 * The safe upper bound for an integer-öre money amount (`Number.MAX_SAFE_INTEGER`, the
 * inclusive ceiling — beyond it JS integer arithmetic is unreliable and it fits a Postgres
 * `bigint` comfortably). CANONICAL definition now lives in `@/lib/money` (Story 4.1); this
 * is a RE-EXPORT so the pricing validators and the money engine share ONE ceiling. The DB
 * CHECK (>= 0) does belt-and-braces on the lower bound.
 */
export const ORE_AMOUNT_MAX = ORE_AMOUNT_MAX_CANONICAL;

/**
 * True iff `v` is a valid INTEGER-ÖRE money amount: a non-negative SAFE integer NUMBER
 * (accepts 0, 1, 85000, … up to `ORE_AMOUNT_MAX`; rejects floats, negatives, NaN/±Infinity,
 * overflow, locale-comma / decimal / numeric strings, null/undefined/object).
 *
 * CANONICAL implementation now lives in `@/lib/money` (Story 4.1 moved it there so the money
 * engine and these pricing validators share ONE rule — no fork). This is a RE-EXPORT; the
 * pricing-validation units and the `money-display` boundary continue to consume it here.
 */
export const isOreAmount = isOreAmountCanonical;

// ─────────────────────────────────────────────────────────────────────────────
// work_roles — display_name + cost/sell öre rates (collection upsert: id optional).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validated `upsertWorkRole` input. `tenant_id` is NEVER part of it (derived from the
 * resolved membership). An OPTIONAL `id` discriminates UPDATE (present) from CREATE
 * (absent) — there is no one-row-per-tenant assumption (a collection, NOT a singleton).
 */
export interface UpsertWorkRoleInput {
  readonly id?: string;
  readonly display_name: string;
  readonly cost_rate_ore: number;
  readonly sell_rate_ore: number;
}

export function validateUpsertWorkRole(
  raw: unknown,
): ValidationResult<UpsertWorkRoleInput> {
  if (!isRecord(raw)) return fail;

  // OPTIONAL id (present → UPDATE). When present it must be UUID-shaped.
  let id: string | undefined;
  if (isPresent(raw.id)) {
    if (!isUuidLike(raw.id)) return fail;
    id = raw.id as string;
  }

  // display_name is REQUIRED, non-empty after trim, bounded.
  if (!isNonEmptyText(raw.display_name)) return fail;

  // Both rates are REQUIRED money fields, validated as non-negative integer öre.
  if (!isOreAmount(raw.cost_rate_ore)) return fail;
  if (!isOreAmount(raw.sell_rate_ore)) return fail;

  const value: UpsertWorkRoleInput = {
    ...(id !== undefined ? { id } : {}),
    display_name: (raw.display_name as string).trim(),
    cost_rate_ore: raw.cost_rate_ore as number,
    sell_rate_ore: raw.sell_rate_ore as number,
  };
  return { ok: true, data: value };
}

// ─────────────────────────────────────────────────────────────────────────────
// articles — name + optional sku/unit + unit_price_ore (collection upsert).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validated `upsertArticle` input — ONLY the minimal manual columns. `tenant_id` and
 * ANY supplier-ish key are NEVER part of it (stripped). An OPTIONAL `id` discriminates
 * UPDATE from CREATE.
 */
export interface UpsertArticleInput {
  readonly id?: string;
  readonly name: string;
  readonly sku?: string;
  readonly unit?: string;
  readonly unit_price_ore: number;
}

export function validateUpsertArticle(
  raw: unknown,
): ValidationResult<UpsertArticleInput> {
  if (!isRecord(raw)) return fail;

  let id: string | undefined;
  if (isPresent(raw.id)) {
    if (!isUuidLike(raw.id)) return fail;
    id = raw.id as string;
  }

  // name is REQUIRED, non-empty after trim, bounded.
  if (!isNonEmptyText(raw.name)) return fail;

  // Optional manual labels — validated only when present.
  if (!optionalTextOk(raw.sku)) return fail;
  if (!optionalTextOk(raw.unit)) return fail;

  // The unit price is a REQUIRED money field — non-negative integer öre.
  if (!isOreAmount(raw.unit_price_ore)) return fail;

  // HARD no-supplier-scope: the validated value is constructed from ONLY the minimal
  // manual columns. Any client-supplied supplier-ish key (supplier_id / vendor / sync /
  // fortnox / api_key / external_ref / import / edi / mapping) is simply NOT copied —
  // it cannot reach the command's write payload. (Mirrors the CRM tenant_id strip.)
  const value: UpsertArticleInput = {
    ...(id !== undefined ? { id } : {}),
    name: (raw.name as string).trim(),
    ...(str(raw, "sku") !== undefined ? { sku: str(raw, "sku") } : {}),
    ...(str(raw, "unit") !== undefined ? { unit: str(raw, "unit") } : {}),
    unit_price_ore: raw.unit_price_ore as number,
  };
  return { ok: true, data: value };
}

// ─────────────────────────────────────────────────────────────────────────────
// archive — id-only guard (work roles + articles share the shape).
// ─────────────────────────────────────────────────────────────────────────────

/** Validated archive input — the target row id ONLY (no smuggled fields survive). */
export interface ArchiveInput {
  readonly id: string;
}

export function validateArchive(raw: unknown): ValidationResult<ArchiveInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.id)) return fail;
  // ONLY the id survives — any smuggled is_active/tenant_id key is dropped.
  return { ok: true, data: { id: raw.id as string } };
}
