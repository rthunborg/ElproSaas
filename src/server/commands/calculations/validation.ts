/**
 * PURE calculation input validators (Story 5.1, Task 3.2; architecture §5 step 4).
 *
 * Each command's `validateInput` returns a `ValidationResult<I>` — the validated,
 * narrowed value or `VALIDATION_FAILED`. The raw invalid value is NEVER echoed (the
 * envelope maps the failure to a generic user-safe message). These are pure functions
 * (no I/O) so the row-type / quantity / unit / öre / VAT / lifecycle rules are
 * exhaustively unit-testable WITHOUT a database, mirroring `crm/validation.ts`.
 *
 * MONEY DISCIPLINE (architecture §10; test-design R-505/R-506): EVERY öre money field
 * is re-validated via the CANONICAL `isOreAmount` / `ORE_AMOUNT_MAX` from `@/lib/money`
 * (imported — NEVER a forked öre rule). The VAT rate is BASIS POINTS validated via the
 * CANONICAL `isVatRateBp` (a VAT rate is the same 0..10000 integer-bp discipline — no
 * fork). The cost→sell MARKUP is ALSO basis points but is NOT a VAT rate — it can exceed
 * 100%, so it uses the markup-specific `isMarkupBp` (integer bp, `[0, MARKUP_BP_MAX]`),
 * NOT `isVatRateBp` (which stays VAT-only). Quantities are finite non-negative decimals
 * via `isQuantity`,
 * with an ADDITIONAL `> 0` gate (a calc row must have a positive quantity). This story
 * STORES the row inputs; it does NOT compute any customer-visible total/VAT/deduction —
 * those route through the frozen `@/lib/money` engine in Story 5.2/5.4.
 *
 * Client-supplied `tenant_id` is NEVER read here — the resolved tenant from membership
 * is the only authority (the validators strip/ignore any `tenant_id`).
 */
import { isOreAmount, isQuantity, isVatRateBp } from "@/lib/money";
import type { ValidationResult } from "../envelope-core";

/**
 * The closed row-type union (architecture §7). A row_type outside this set is
 * rejected at the command layer (belt-and-braces with the DB CHECK). The single
 * source of truth for the union; the DB CHECK enumerates the same five values.
 */
export const ROW_TYPES = [
  "labor",
  "material",
  "subcontractor",
  "machinery",
  "other",
] as const;
export type RowType = (typeof ROW_TYPES)[number];

/**
 * The closed calculation lifecycle status set (Open Question 1 conservative default).
 * The DB CHECK enumerates the same three values; the STATE MACHINE (legal transitions)
 * is enforced here.
 */
export const CALC_STATUSES = ["draft", "ready", "archived"] as const;
export type CalcStatus = (typeof CALC_STATUSES)[number];

/**
 * The legal lifecycle transitions (Open Question 1 conservative default): forward-only
 * draft → ready, with `archived` reachable from any active state. A same-state no-op is
 * allowed. An UNKNOWN target status, or a transition not in this map, is rejected.
 * `archived → draft`/`ready` (reviving an archived calc) is NOT legal here.
 */
export const LEGAL_TRANSITIONS: Readonly<
  Record<CalcStatus, readonly CalcStatus[]>
> = {
  draft: ["draft", "ready", "archived"],
  ready: ["ready", "draft", "archived"],
  archived: ["archived"],
};

/** A runtime guard that a raw value is a known `CalcStatus`. */
export function isCalcStatus(v: unknown): v is CalcStatus {
  return (
    typeof v === "string" && (CALC_STATUSES as readonly string[]).includes(v)
  );
}

/**
 * True iff moving from `current` to `target` is a legal lifecycle transition. This is
 * the AUTHORITATIVE state-machine check — the caller (`updateCalculation.execute`) MUST
 * pass the target row's REAL current status loaded from the DB, NOT a client-supplied
 * value (a client cannot revive an `archived` calc by omitting/lying about its status).
 */
export function isLegalTransition(
  current: CalcStatus,
  target: CalcStatus,
): boolean {
  return LEGAL_TRANSITIONS[current].includes(target);
}

/** The section display-mode set (Open Question 2 conservative default). */
export const SECTION_DISPLAY_MODES = ["detailed", "summary", "text_only"] as const;
export type SectionDisplayMode = (typeof SECTION_DISPLAY_MODES)[number];

/**
 * The closed set of pricing-source kinds a CALC ROW can snapshot (Story 5.3). This is a
 * SUBSET of the Story 3.5 `SnapshotKind` union — only `work_role` (labor) / `article`
 * (material) apply to calc rows; `company_settings`/`quote_terms` are NOT row sources.
 * The single source of truth for the row-source union; the DB CHECK enumerates the same
 * two values. A kind outside this set is a `VALIDATION_FAILED` at the command layer.
 */
export const ROW_SOURCE_KINDS = ["work_role", "article"] as const;
export type RowSourceKind = (typeof ROW_SOURCE_KINDS)[number];

/** A runtime guard that a raw value is a known calc-row `RowSourceKind`. */
function isRowSourceKind(v: unknown): v is RowSourceKind {
  return (
    typeof v === "string" && (ROW_SOURCE_KINDS as readonly string[]).includes(v)
  );
}

/**
 * Upper bound for a row cost→sell MARKUP expressed in basis points (Open Question 3).
 * A markup is NOT a VAT rate: a VAT rate is genuinely capped at 100% (`isVatRateBp` → 10000),
 * but a cost→sell markup routinely exceeds 100% (e.g. 150% = 15000 bp). The DB column
 * `markup_bp integer` has no upper CHECK, so the validator must not be stricter than intent
 * or schema. This is a generous-but-safe ceiling (10000% = 1,000,000 bp) that rejects only
 * absurd/overflow values, NOT legitimate high markups. Kept in the calc domain (NOT a fork of
 * the money-engine `isVatRateBp` bp-validity rule, which stays VAT-only).
 */
export const MARKUP_BP_MAX = 1_000_000;

/**
 * True iff `v` is a valid non-negative INTEGER markup in basis points within
 * `[0, MARKUP_BP_MAX]`. Rejects float / non-finite / negative / over-range (mirrors the
 * integer-bp discipline of `isVatRateBp` but with the markup-appropriate upper bound — a
 * markup can exceed 100%, a VAT rate cannot).
 */
export function isMarkupBp(v: unknown): v is number {
  return (
    typeof v === "number" &&
    Number.isInteger(v) &&
    v >= 0 &&
    v <= MARKUP_BP_MAX
  );
}

/** Max length for a short free-text calc field (defensive bound). */
const MAX_TEXT = 256;
/** Max length for the longer note/description fields. */
const MAX_LONG_TEXT = 2000;

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

/** True iff `v` is a non-empty (trimmed), bounded, single-value string. */
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
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * Validate an OPTIONAL öre money field via the CANONICAL `isOreAmount`. Returns false
 * ONLY when the field is present but not a valid non-negative safe-integer öre
 * (float / negative / overflow / locale-comma / decimal-string all rejected — no fork).
 */
function optionalOreOk(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  return isOreAmount(v);
}

// ─────────────────────────────────────────────────────────────────────────────
// Calculation (header) commands
// ─────────────────────────────────────────────────────────────────────────────

/** Validated `createCalculation` input (tenant_id is NEVER part of it — derived). */
export interface CreateCalculationInput {
  readonly customer_id: string;
  readonly facility_id?: string;
  readonly contact_id?: string;
  readonly title: string;
}

/**
 * Validated `updateCalculation` input — `id` + the mutable fields. `status`, when
 * supplied, is validated here only for VALUE shape (a known `CalcStatus`); the lifecycle
 * TRANSITION legality is enforced authoritatively in `updateCalculation.execute` against
 * the target row's REAL current status loaded from the DB (findings 1 & 2) — never a
 * client-supplied `currentStatus`.
 */
export interface UpdateCalculationInput {
  readonly id: string;
  readonly title?: string;
  readonly status?: CalcStatus;
}

/** Validated `{ id }` input shared by the archive commands. */
export interface ArchiveCalcInput {
  readonly id: string;
}

export function validateCreateCalculation(
  raw: unknown,
): ValidationResult<CreateCalculationInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.customer_id)) return fail;
  if (isPresent(raw.facility_id) && !isUuidLike(raw.facility_id)) return fail;
  if (isPresent(raw.contact_id) && !isUuidLike(raw.contact_id)) return fail;
  if (!isNonEmptyText(raw.title)) return fail;
  return {
    ok: true,
    data: {
      customer_id: raw.customer_id as string,
      facility_id: isUuidLike(raw.facility_id)
        ? (raw.facility_id as string)
        : undefined,
      contact_id: isUuidLike(raw.contact_id)
        ? (raw.contact_id as string)
        : undefined,
      title: (raw.title as string).trim(),
    },
  };
}

export function validateUpdateCalculation(
  raw: unknown,
): ValidationResult<UpdateCalculationInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.id)) return fail;

  // title, when supplied, must be non-empty bounded text.
  if (isPresent(raw.title) && !isNonEmptyText(raw.title)) return fail;

  // status, when supplied, must be a known status VALUE (shape check only). The
  // TRANSITION LEGALITY is NOT decided here: the validator is pure and cannot read the
  // row's real current status, and a client-supplied `currentStatus` must never be
  // trusted (a caller could omit/spoof it to force an illegal archived → ready move).
  // `updateCalculation.execute` loads the target row's REAL status from the DB and
  // enforces the state machine (`isLegalTransition`) against it — that is the single
  // authoritative check (findings 1 & 2). When no status is supplied this is a
  // title-only edit (no transition at all).
  let status: CalcStatus | undefined;
  if (isPresent(raw.status)) {
    if (!isCalcStatus(raw.status)) return fail;
    status = raw.status;
  }

  return {
    ok: true,
    data: {
      id: raw.id as string,
      title: isPresent(raw.title) ? (raw.title as string).trim() : undefined,
      status,
    },
  };
}

export function validateArchiveCalc(
  raw: unknown,
): ValidationResult<ArchiveCalcInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.id)) return fail;
  return { ok: true, data: { id: raw.id as string } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Section commands
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateSectionInput {
  readonly calculation_id: string;
  readonly title?: string;
  readonly display_mode?: SectionDisplayMode;
}

export interface UpdateSectionInput {
  readonly id: string;
  readonly title?: string;
  readonly display_mode?: SectionDisplayMode;
}

function isDisplayMode(v: unknown): v is SectionDisplayMode {
  return (
    typeof v === "string" &&
    (SECTION_DISPLAY_MODES as readonly string[]).includes(v)
  );
}

export function validateCreateSection(
  raw: unknown,
): ValidationResult<CreateSectionInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.calculation_id)) return fail;
  // title is OPTIONAL for a section (a section may be untitled). When present it must
  // be bounded non-empty text.
  if (isPresent(raw.title) && !isNonEmptyText(raw.title)) return fail;
  if (isPresent(raw.display_mode) && !isDisplayMode(raw.display_mode)) return fail;
  return {
    ok: true,
    data: {
      calculation_id: raw.calculation_id as string,
      title: isPresent(raw.title) ? (raw.title as string).trim() : undefined,
      display_mode: isDisplayMode(raw.display_mode)
        ? raw.display_mode
        : undefined,
    },
  };
}

export function validateUpdateSection(
  raw: unknown,
): ValidationResult<UpdateSectionInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.id)) return fail;
  if (isPresent(raw.title) && !isNonEmptyText(raw.title)) return fail;
  if (isPresent(raw.display_mode) && !isDisplayMode(raw.display_mode)) return fail;
  return {
    ok: true,
    data: {
      id: raw.id as string,
      title: isPresent(raw.title) ? (raw.title as string).trim() : undefined,
      display_mode: isDisplayMode(raw.display_mode)
        ? raw.display_mode
        : undefined,
    },
  };
}

export function validateArchiveSection(
  raw: unknown,
): ValidationResult<ArchiveCalcInput> {
  return validateArchiveCalc(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Row commands
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateRowInput {
  readonly section_id: string;
  readonly row_type: RowType;
  readonly quantity: number;
  readonly unit: string;
  readonly unit_cost_ore?: number;
  readonly unit_sell_ore?: number;
  readonly markup_bp?: number;
  readonly vat_rate_bp: number;
  readonly is_hidden?: boolean;
  readonly is_optional?: boolean;
  readonly is_selected?: boolean;
  readonly label?: string;
  readonly description?: string;
  readonly internal_note?: string;
  readonly quote_note?: string;
  /**
   * OPTIONAL pricing SOURCE the caller selected (Story 5.3). The caller supplies ONLY the
   * kind + id — NEVER the captured name/rate/version (those are RESOLVED server-side from
   * the source row, never trusted from the client). Both-or-neither: a source_id with no
   * kind (or a kind with no id) is `VALIDATION_FAILED`. Absent = a manual/free-text row.
   */
  readonly source_kind?: RowSourceKind;
  readonly source_id?: string;
}

export interface UpdateRowInput {
  readonly id: string;
  readonly row_type?: RowType;
  readonly quantity?: number;
  readonly unit?: string;
  readonly unit_cost_ore?: number;
  readonly unit_sell_ore?: number;
  readonly markup_bp?: number;
  readonly vat_rate_bp?: number;
  readonly is_hidden?: boolean;
  readonly is_optional?: boolean;
  readonly is_selected?: boolean;
  readonly label?: string;
  readonly description?: string;
  readonly internal_note?: string;
  readonly quote_note?: string;
  /** OPTIONAL pricing source (Story 5.3) — same both-or-neither rule as create. */
  readonly source_kind?: RowSourceKind;
  readonly source_id?: string;
  /**
   * An EXPLICIT clear of a previously-set source (Story 5.3, Task 2.4): the admin switched
   * a row back to manual. When `true` (and no source pair is present), the execute maps ALL
   * `source_*` columns to null TOGETHER — never a half-cleared source (kind null but name/
   * rate stale). This companion flag is how an explicit clear survives the
   * `isPresent('')===false` convention (an empty-string source_id alone is merely ABSENT).
   */
  readonly source_clear?: boolean;
}

function isRowType(v: unknown): v is RowType {
  return typeof v === "string" && (ROW_TYPES as readonly string[]).includes(v);
}

/** A positive finite decimal quantity (a calc row must have a positive quantity). */
function isPositiveQuantity(v: unknown): v is number {
  return isQuantity(v) && v > 0;
}

function optionalBoolOk(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  return typeof v === "boolean";
}

/**
 * Validate the SHARED row money/flag fields (used by both create and update). Returns
 * `null` when all present fields are valid, or the `fail` result on the first bad field.
 * `vatRequired` toggles whether `vat_rate_bp` MUST be present (create) or is optional
 * (update patch).
 */
function validateRowCommonFields(
  raw: Record<string, unknown>,
  vatRequired: boolean,
): typeof fail | null {
  // Every öre money field re-validated via the CANONICAL isOreAmount (no fork).
  if (!optionalOreOk(raw.unit_cost_ore)) return fail;
  if (!optionalOreOk(raw.unit_sell_ore)) return fail;
  // markup, when present, is a non-negative integer in basis points that CAN exceed 100%
  // (a cost→sell markup is not a VAT rate) — validated by the markup-specific `isMarkupBp`,
  // NOT the VAT-only `isVatRateBp` (which would wrongly cap it at 10000 bp).
  if (isPresent(raw.markup_bp) && !isMarkupBp(raw.markup_bp)) return fail;
  // VAT assumption: required + integer basis-points-shaped on create; optional on
  // update but still bp-shaped when present.
  if (vatRequired) {
    if (!isVatRateBp(raw.vat_rate_bp)) return fail;
  } else if (isPresent(raw.vat_rate_bp) && !isVatRateBp(raw.vat_rate_bp)) {
    return fail;
  }
  if (!optionalBoolOk(raw.is_hidden)) return fail;
  if (!optionalBoolOk(raw.is_optional)) return fail;
  if (!optionalBoolOk(raw.is_selected)) return fail;
  if (!optionalTextOk(raw.label)) return fail;
  if (!optionalTextOk(raw.description, MAX_LONG_TEXT)) return fail;
  if (!optionalTextOk(raw.internal_note, MAX_LONG_TEXT)) return fail;
  if (!optionalTextOk(raw.quote_note, MAX_LONG_TEXT)) return fail;
  return null;
}

/**
 * Validate the OPTIONAL pricing-source PAIR (Story 5.3, Task 2.1). Both-or-neither:
 *   - neither present → `{ ok: true, kind: undefined, id: undefined }` (a manual row);
 *   - both present + valid (closed kind union + UUID-shaped id) → carries the pair;
 *   - exactly one present, an unknown kind, or a non-UUID id → `fail`.
 *
 * `isPresent('')===false` (epic-5 PINNED convention): an EMPTY-STRING source_kind/source_id
 * is treated as ABSENT (dropped — a manual/no-source row), NOT a validation error; a
 * WHITESPACE-ONLY value is present-but-bad and rejected (not a valid kind / not a UUID).
 * The caller supplies ONLY the pair — the captured name/rate/version are resolved
 * server-side (never trusted from the client), so they are NEVER read here.
 */
function validateSourcePair(
  raw: Record<string, unknown>,
):
  | typeof fail
  | { readonly ok: true; readonly kind?: RowSourceKind; readonly id?: string } {
  const kindPresent = isPresent(raw.source_kind);
  const idPresent = isPresent(raw.source_id);
  // Both absent (empty-string dropped) → a manual/no-source row.
  if (!kindPresent && !idPresent) return { ok: true };
  // Both-or-neither: exactly one present is a validation failure.
  if (kindPresent !== idPresent) return fail;
  // Both present — validate the closed kind union + the UUID-shaped id.
  if (!isRowSourceKind(raw.source_kind)) return fail;
  if (!isUuidLike(raw.source_id)) return fail;
  return { ok: true, kind: raw.source_kind, id: raw.source_id as string };
}

/** Number-or-undefined reader for a validated optional numeric field. */
function num(rec: Record<string, unknown>, key: string): number | undefined {
  const v = rec[key];
  return typeof v === "number" ? v : undefined;
}

function bool(rec: Record<string, unknown>, key: string): boolean | undefined {
  const v = rec[key];
  return typeof v === "boolean" ? v : undefined;
}

export function validateCreateRow(
  raw: unknown,
): ValidationResult<CreateRowInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.section_id)) return fail;
  if (!isRowType(raw.row_type)) return fail;
  if (!isPositiveQuantity(raw.quantity)) return fail;
  if (!isNonEmptyText(raw.unit)) return fail;
  const common = validateRowCommonFields(raw, /* vatRequired */ true);
  if (common) return common;
  const source = validateSourcePair(raw);
  if (!source.ok) return source;

  return {
    ok: true,
    data: {
      section_id: raw.section_id as string,
      row_type: raw.row_type,
      quantity: raw.quantity as number,
      unit: (raw.unit as string).trim(),
      unit_cost_ore: num(raw, "unit_cost_ore"),
      unit_sell_ore: num(raw, "unit_sell_ore"),
      markup_bp: num(raw, "markup_bp"),
      vat_rate_bp: raw.vat_rate_bp as number,
      is_hidden: bool(raw, "is_hidden"),
      is_optional: bool(raw, "is_optional"),
      is_selected: bool(raw, "is_selected"),
      label: str(raw, "label"),
      description: str(raw, "description"),
      internal_note: str(raw, "internal_note"),
      quote_note: str(raw, "quote_note"),
      source_kind: source.kind,
      source_id: source.id,
    },
  };
}

export function validateUpdateRow(raw: unknown): ValidationResult<UpdateRowInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.id)) return fail;
  if (isPresent(raw.row_type) && !isRowType(raw.row_type)) return fail;
  if (isPresent(raw.quantity) && !isPositiveQuantity(raw.quantity)) return fail;
  if (isPresent(raw.unit) && !isNonEmptyText(raw.unit)) return fail;
  const common = validateRowCommonFields(raw, /* vatRequired */ false);
  if (common) return common;
  const source = validateSourcePair(raw);
  if (!source.ok) return source;
  // A present-but-non-boolean source_clear is a validation failure; an absent one is
  // undefined (no clear). A clear + a source pair is contradictory → reject.
  if (!optionalBoolOk(raw.source_clear)) return fail;
  const sourceClear = bool(raw, "source_clear");
  if (sourceClear === true && (source.kind !== undefined || source.id !== undefined)) {
    return fail;
  }

  return {
    ok: true,
    data: {
      id: raw.id as string,
      row_type: isRowType(raw.row_type) ? raw.row_type : undefined,
      quantity: isPositiveQuantity(raw.quantity) ? raw.quantity : undefined,
      unit: isPresent(raw.unit) ? (raw.unit as string).trim() : undefined,
      unit_cost_ore: num(raw, "unit_cost_ore"),
      unit_sell_ore: num(raw, "unit_sell_ore"),
      markup_bp: num(raw, "markup_bp"),
      vat_rate_bp: num(raw, "vat_rate_bp"),
      is_hidden: bool(raw, "is_hidden"),
      is_optional: bool(raw, "is_optional"),
      is_selected: bool(raw, "is_selected"),
      label: str(raw, "label"),
      description: str(raw, "description"),
      internal_note: str(raw, "internal_note"),
      quote_note: str(raw, "quote_note"),
      source_kind: source.kind,
      source_id: source.id,
      source_clear: sourceClear === true ? true : undefined,
    },
  };
}

export function validateArchiveRow(
  raw: unknown,
): ValidationResult<ArchiveCalcInput> {
  return validateArchiveCalc(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Atomic reorder commands (ADR-A009 narrow RPC)
// ─────────────────────────────────────────────────────────────────────────────

export interface ReorderRowsInput {
  readonly section_id: string;
  readonly ordered_row_ids: readonly string[];
}

export interface ReorderSectionsInput {
  readonly calculation_id: string;
  readonly ordered_section_ids: readonly string[];
}

/** Validate a non-empty array of UUID-shaped ids (bounded). */
function isUuidArray(v: unknown): v is string[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.length <= 1000 &&
    v.every((x) => isUuidLike(x))
  );
}

export function validateReorderRows(
  raw: unknown,
): ValidationResult<ReorderRowsInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.section_id)) return fail;
  if (!isUuidArray(raw.ordered_row_ids)) return fail;
  return {
    ok: true,
    data: {
      section_id: raw.section_id as string,
      ordered_row_ids: [...(raw.ordered_row_ids as string[])],
    },
  };
}

export function validateReorderSections(
  raw: unknown,
): ValidationResult<ReorderSectionsInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.calculation_id)) return fail;
  if (!isUuidArray(raw.ordered_section_ids)) return fail;
  return {
    ok: true,
    data: {
      calculation_id: raw.calculation_id as string,
      ordered_section_ids: [...(raw.ordered_section_ids as string[])],
    },
  };
}
