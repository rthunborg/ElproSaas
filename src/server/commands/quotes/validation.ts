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
import { isOreAmount } from "@/lib/money/ore";

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

// ─────────────────────────────────────────────────────────────────────────────
// Story 6.4 — the mark-quote-version-sent input validator.
//
// The caller supplies ONLY the target `quote_version_id` (UUID-shaped) + OPTIONAL free-text
// `channel` / `reference` (recorded on the `sent` event — "if supported" per the epic; NEVER a
// send integration). tenant_id / status / totals are NEVER read (the resolved tenant from
// membership is the only authority; the sent timestamp is the INJECTED command clock, never a
// client value). A foreign/non-existent version id is caught by the envelope ownership gate
// (TENANT_ACCESS_DENIED before execute), not here.
// ─────────────────────────────────────────────────────────────────────────────

/** A coarse length bound for the optional channel/reference free-text fields. */
const SENT_FIELD_MAX = 200;

function isOptionalShortText(v: unknown): v is string | null | undefined {
  if (v === undefined || v === null) return true;
  return typeof v === "string" && v.length <= SENT_FIELD_MAX;
}

/**
 * Validated `markQuoteVersionSent` input — the target version id + optional recorded
 * channel/reference. An absent/empty channel/reference means "not recorded" (null).
 */
export interface MarkQuoteVersionSentInput {
  readonly quote_version_id: string;
  readonly channel?: string | null;
  readonly reference?: string | null;
}

export function validateMarkQuoteVersionSent(
  raw: unknown,
): ValidationResult<MarkQuoteVersionSentInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.quote_version_id)) return fail;
  if (!isOptionalShortText(raw.channel)) return fail;
  if (!isOptionalShortText(raw.reference)) return fail;

  const data: {
    quote_version_id: string;
    channel?: string | null;
    reference?: string | null;
  } = { quote_version_id: raw.quote_version_id as string };
  if ("channel" in raw) data.channel = (raw.channel as string | null) ?? null;
  if ("reference" in raw) data.reference = (raw.reference as string | null) ?? null;
  return { ok: true, data };
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 6.5 — the new-version + lifecycle-transition input validators.
//
// `validateCreateNewQuoteVersion` — the caller supplies the PARENT `quote_version_id` (the
// read-only sent version to base the new version on) + OPTIONAL re-selected `attachment_file_ids`
// (re-validated for ownership in execute). tenant_id / status / totals / lines are NEVER read (the
// resolved tenant from membership is the only authority; the fresh snapshot is RE-CAPTURED
// server-side from the CURRENT source calc). A foreign parent version id is caught by the envelope
// ownership gate (TENANT_ACCESS_DENIED before execute), not here.
//
// `validateMarkQuoteVersionLifecycle` — the caller supplies the target `quote_version_id` + a
// `transition` in the CLOSED set (`rejected` | `expired` | `superseded` — accepted is Epic 7;
// `sent` is the mark-sent command; `draft` reversal is illegal). Mirrors `validateMarkQuoteVersionSent`.
// ─────────────────────────────────────────────────────────────────────────────

/** The closed set of standalone lifecycle transitions the 6.5 command accepts. */
const LIFECYCLE_TRANSITIONS = new Set(["rejected", "expired", "superseded"]);

/**
 * Validated `createNewQuoteVersion` input — the parent version id + optional re-selected
 * attachment file ids. tenant_id is NEVER part of it (derived from the resolved membership).
 */
export interface CreateNewQuoteVersionInput {
  readonly quote_version_id: string;
  readonly attachment_file_ids: readonly string[];
}

export function validateCreateNewQuoteVersion(
  raw: unknown,
): ValidationResult<CreateNewQuoteVersionInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.quote_version_id)) return fail;
  // attachment_file_ids is OPTIONAL. When present it must be a bounded UUID array; an
  // absent/empty value means "keep no attachments" (an empty list — the admin re-selects).
  let attachmentFileIds: string[] = [];
  if (raw.attachment_file_ids !== undefined && raw.attachment_file_ids !== null) {
    if (!isUuidArray(raw.attachment_file_ids)) return fail;
    attachmentFileIds = [...(raw.attachment_file_ids as string[])];
  }
  return {
    ok: true,
    data: {
      quote_version_id: raw.quote_version_id as string,
      attachment_file_ids: attachmentFileIds,
    },
  };
}

/** The standalone lifecycle transition the 6.5 command owns (accepted is Epic 7). */
export type QuoteLifecycleTransition = "rejected" | "expired" | "superseded";

/**
 * Validated `markQuoteVersionLifecycle` input — the target version id + a transition in the
 * closed set. tenant_id / status are NEVER read (resolved server-side; the injected clock stamps
 * `occurred_at`). A transition outside the closed set (or a malformed id) → VALIDATION_FAILED.
 */
export interface MarkQuoteVersionLifecycleInput {
  readonly quote_version_id: string;
  readonly transition: QuoteLifecycleTransition;
}

export function validateMarkQuoteVersionLifecycle(
  raw: unknown,
): ValidationResult<MarkQuoteVersionLifecycleInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.quote_version_id)) return fail;
  if (typeof raw.transition !== "string" || !LIFECYCLE_TRANSITIONS.has(raw.transition)) {
    return fail;
  }
  return {
    ok: true,
    data: {
      quote_version_id: raw.quote_version_id as string,
      transition: raw.transition as QuoteLifecycleTransition,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 10.2 — the mark-quote-version-lost input validator (AC1/AC2/AC5).
//
// The caller supplies the target `quote_version_id` (UUID-shaped) + the structured Förlorad/Avböjd
// reason: an `outcome` in the closed set {forlorad, avbojd}, a `category` in the strawman closed set
// {pris, konkurrent, tidplan, uteblivet_svar, annat}, and an OPTIONAL free-text `note` that is
// REQUIRED (non-empty trimmed) when the category is `annat`. tenant_id / status are NEVER read (the
// resolved tenant is the only authority; the injected clock stamps `occurred_at`). The raw invalid
// value is NEVER echoed — a shape/closed-set violation → VALIDATION_FAILED. A foreign/non-existent
// version id is caught by the envelope ownership gate (TENANT_ACCESS_DENIED before execute), not here.
// ─────────────────────────────────────────────────────────────────────────────

/** The closed set of Förlorad/Avböjd outcomes (the flavour stored in quote_lost_reasons.outcome). */
const LOST_OUTCOMES = new Set(["forlorad", "avbojd"]);

/** The closed strawman category set (UXB-A5; tenant-tunable in a later story — hard-coded here). */
const LOST_CATEGORIES = new Set([
  "pris",
  "konkurrent",
  "tidplan",
  "uteblivet_svar",
  "annat",
]);

/** A coarse length bound for the optional/required lost-reason note free-text field. */
const LOST_NOTE_MAX = 2000;

/** The Förlorad/Avböjd outcome — the flavour stored solely in quote_lost_reasons.outcome. */
export type QuoteLostOutcome = "forlorad" | "avbojd";

/** The strawman lost-reason category (ASCII machine token; Swedish UI label resolved in the UI). */
export type QuoteLostCategory =
  | "pris"
  | "konkurrent"
  | "tidplan"
  | "uteblivet_svar"
  | "annat";

/**
 * Validated `markQuoteVersionLost` input — the target version id + the structured reason (outcome +
 * category + optional/required note). `note` is required (non-empty trimmed) when `category==='annat'`,
 * else optional + bounded. tenant_id / status are NEVER part of it (resolved server-side).
 */
export interface MarkQuoteVersionLostInput {
  readonly quote_version_id: string;
  readonly outcome: QuoteLostOutcome;
  readonly category: QuoteLostCategory;
  readonly note?: string | null;
}

export function validateMarkQuoteVersionLost(
  raw: unknown,
): ValidationResult<MarkQuoteVersionLostInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.quote_version_id)) return fail;
  if (typeof raw.outcome !== "string" || !LOST_OUTCOMES.has(raw.outcome)) return fail;
  if (typeof raw.category !== "string" || !LOST_CATEGORIES.has(raw.category)) return fail;

  // The note: bounded free text. When present it must be a string within the length bound; when the
  // category is `annat` it is REQUIRED (a non-empty trimmed value). Otherwise it is optional.
  let note: string | null = null;
  if (raw.note !== undefined && raw.note !== null) {
    if (typeof raw.note !== "string" || raw.note.length > LOST_NOTE_MAX) return fail;
    note = raw.note;
  }
  if (raw.category === "annat") {
    if (note === null || note.trim().length === 0) return fail;
  }

  const data: {
    quote_version_id: string;
    outcome: QuoteLostOutcome;
    category: QuoteLostCategory;
    note?: string | null;
  } = {
    quote_version_id: raw.quote_version_id as string,
    outcome: raw.outcome as QuoteLostOutcome,
    category: raw.category as QuoteLostCategory,
  };
  // Only carry a note when the caller supplied one (an absent note = null downstream).
  if (raw.note !== undefined) data.note = note;
  return { ok: true, data };
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 7.1 — the capture-quote-acceptance input validator (AC1/AC2/AC5).
//
// The caller supplies the target sent `quote_version_id` + the acceptance-capture fields:
// the accepted price in INTEGER ÖRE (`accepted_price_ore`, öre-shape guarded here), the
// EXPLICIT `accepted_at` instant (H1 — the accepted moment is a real input, NEVER derived
// from a wall-clock), the OPTIONAL channel / adjustment_reason / evidence_file_id (UUID-shaped)
// / evidence_reference / notes / planned start/end dates. tenant_id / accepted user / source
// sent total are NEVER read from the client — the resolved tenant is the only tenant authority,
// the accepted user is the resolved session user, and the source sent total is loaded
// server-side from the FROZEN version row. The adjusted-price REASON gate is a SERVER-SIDE
// re-validation in the command execute (the client cannot bypass it) — this validator only
// shapes input. A foreign/non-existent version/evidence id is caught by the envelope ownership
// gate / the command's evidence-ownership re-validation, not here.
// ─────────────────────────────────────────────────────────────────────────────

/** A coarse length bound for the optional channel/reason/reference/notes free-text fields. */
const ACCEPTANCE_TEXT_MAX = 2000;

function isOptionalAcceptanceText(v: unknown): v is string | null | undefined {
  if (v === undefined || v === null) return true;
  return typeof v === "string" && v.length <= ACCEPTANCE_TEXT_MAX;
}

/** A required non-empty ISO-8601 date/timestamp string (the accepted / planned instants). */
function isIsoDateString(v: unknown): v is string {
  if (typeof v !== "string") return false;
  if (v.length === 0 || v.length > 40) return false;
  return Number.isFinite(Date.parse(v));
}

/** An OPTIONAL ISO date string (planned start/end) — absent/null means "not set". */
function isOptionalIsoDateString(v: unknown): v is string | null | undefined {
  if (v === undefined || v === null) return true;
  return isIsoDateString(v);
}

/**
 * Cross-field ordering guard for the planned window: when BOTH `planned_start_date` and
 * `planned_end_date` are present (non-empty ISO strings), the end must NOT precede the start (an
 * inverted range is a nonsensical planning window that would persist on the acceptance AND the job).
 * Absent/null on either side ⇒ no ordering to enforce. Compared via `Date.parse` so it is correct
 * across the calendar-date / full-ISO-timestamp shapes `isIsoDateString` accepts.
 */
function plannedDatesOrdered(
  start: string | null | undefined,
  end: string | null | undefined,
): boolean {
  if (typeof start !== "string" || typeof end !== "string") return true;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return true; // shape already validated
  return endMs >= startMs;
}

/**
 * Validated `captureQuoteAcceptance` input. `quote_version_id` is required + UUID-shaped;
 * `accepted_price_ore` is a canonical öre amount (`isOreAmount`); `accepted_at` is a required
 * ISO instant (H1 — an explicit input). The optional fields carry channel / adjustment reason /
 * evidence file id (UUID-shaped) / external evidence reference / notes / planned dates. The
 * adjusted-price REASON requirement is enforced SERVER-SIDE in the command (not here). tenant_id
 * / accepted user / source sent total are NEVER part of it.
 */
export interface CaptureQuoteAcceptanceInput {
  readonly quote_version_id: string;
  readonly accepted_price_ore: number;
  readonly accepted_at: string;
  readonly channel?: string | null;
  readonly adjustment_reason?: string | null;
  readonly evidence_file_id?: string | null;
  readonly evidence_reference?: string | null;
  readonly notes?: string | null;
  readonly planned_start_date?: string | null;
  readonly planned_end_date?: string | null;
}

export function validateCaptureQuoteAcceptance(
  raw: unknown,
): ValidationResult<CaptureQuoteAcceptanceInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.quote_version_id)) return fail;
  // Accepted price MUST be a canonical integer öre (float/negative/NaN/overflow ⇒ VALIDATION_FAILED).
  if (!isOreAmount(raw.accepted_price_ore)) return fail;
  // The accepted moment is an EXPLICIT input (H1 determinism) — a required ISO instant.
  if (!isIsoDateString(raw.accepted_at)) return fail;
  // Optional free-text + evidence + planned-date fields.
  if (!isOptionalAcceptanceText(raw.channel)) return fail;
  if (!isOptionalAcceptanceText(raw.adjustment_reason)) return fail;
  if (raw.evidence_file_id !== undefined && raw.evidence_file_id !== null) {
    if (!isUuidLike(raw.evidence_file_id)) return fail;
  }
  if (!isOptionalAcceptanceText(raw.evidence_reference)) return fail;
  if (!isOptionalAcceptanceText(raw.notes)) return fail;
  if (!isOptionalIsoDateString(raw.planned_start_date)) return fail;
  if (!isOptionalIsoDateString(raw.planned_end_date)) return fail;
  // Cross-field ordering: a both-present planned window must not have the end before the start.
  if (
    !plannedDatesOrdered(
      raw.planned_start_date as string | null | undefined,
      raw.planned_end_date as string | null | undefined,
    )
  ) {
    return fail;
  }

  const data: {
    quote_version_id: string;
    accepted_price_ore: number;
    accepted_at: string;
    channel?: string | null;
    adjustment_reason?: string | null;
    evidence_file_id?: string | null;
    evidence_reference?: string | null;
    notes?: string | null;
    planned_start_date?: string | null;
    planned_end_date?: string | null;
  } = {
    quote_version_id: raw.quote_version_id as string,
    accepted_price_ore: raw.accepted_price_ore as number,
    accepted_at: raw.accepted_at as string,
  };
  if ("channel" in raw) data.channel = (raw.channel as string | null) ?? null;
  if ("adjustment_reason" in raw)
    data.adjustment_reason = (raw.adjustment_reason as string | null) ?? null;
  if ("evidence_file_id" in raw)
    data.evidence_file_id = (raw.evidence_file_id as string | null) ?? null;
  if ("evidence_reference" in raw)
    data.evidence_reference = (raw.evidence_reference as string | null) ?? null;
  if ("notes" in raw) data.notes = (raw.notes as string | null) ?? null;
  if ("planned_start_date" in raw)
    data.planned_start_date = (raw.planned_start_date as string | null) ?? null;
  if ("planned_end_date" in raw)
    data.planned_end_date = (raw.planned_end_date as string | null) ?? null;
  return { ok: true, data };
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 7.2 — the accept-and-create-job input validator (AC1/AC4/AC5).
//
// EXTENDS the 7.1 capture shape with an OPTIONAL job `title` (a sensible default is derived
// server-side when absent) and a TEST-ONLY `__faultInject` field (the atomicity/rollback proof
// hook — 7.2-INT-04). tenant_id / accepted user / source sent total are NEVER read from the client
// (the resolved tenant is the only authority; the source sent total is loaded server-side from the
// FROZEN version row; the accepted user is the resolved session user). The sent-state gate + the
// adjusted-price REASON gate are SERVER-SIDE re-validations in the command execute (the client
// cannot bypass them) — this validator only shapes input.
//
// `__faultInject` is NOT client-reachable: the acceptance ACTION never reads it from form data, so a
// real HTTP request can never set it — only a direct `runCommand` test call (7.2-INT-04) supplies it
// to drive a controlled mid-transaction failure. It is validated as a closed set so a stray value is
// a VALIDATION_FAILED rather than an unexpected passthrough.
// ─────────────────────────────────────────────────────────────────────────────

/** The closed set of TEST-ONLY fault-injection boundaries the accept transaction exposes. */
const FAULT_INJECT_POINTS = new Set(["job-insert", "event-write"]);

/**
 * Validated `acceptQuoteAndCreateJob` input — the 7.1 capture fields + an optional job `title`.
 * `quote_version_id` is required + UUID-shaped; `accepted_price_ore` is a canonical öre amount;
 * `accepted_at` is a required ISO instant (H1). `__faultInject` is TEST-ONLY (see above).
 */
export interface AcceptQuoteAndCreateJobInput {
  readonly quote_version_id: string;
  readonly accepted_price_ore: number;
  readonly accepted_at: string;
  readonly channel?: string | null;
  readonly adjustment_reason?: string | null;
  readonly evidence_file_id?: string | null;
  readonly evidence_reference?: string | null;
  readonly notes?: string | null;
  readonly planned_start_date?: string | null;
  readonly planned_end_date?: string | null;
  readonly title?: string | null;
  /** TEST-ONLY fault-injection boundary (never set by the acceptance action / a real request). */
  readonly __faultInject?: string;
}

export function validateAcceptQuoteAndCreateJob(
  raw: unknown,
): ValidationResult<AcceptQuoteAndCreateJobInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.quote_version_id)) return fail;
  if (!isOreAmount(raw.accepted_price_ore)) return fail;
  if (!isIsoDateString(raw.accepted_at)) return fail;
  if (!isOptionalAcceptanceText(raw.channel)) return fail;
  if (!isOptionalAcceptanceText(raw.adjustment_reason)) return fail;
  if (raw.evidence_file_id !== undefined && raw.evidence_file_id !== null) {
    if (!isUuidLike(raw.evidence_file_id)) return fail;
  }
  if (!isOptionalAcceptanceText(raw.evidence_reference)) return fail;
  if (!isOptionalAcceptanceText(raw.notes)) return fail;
  if (!isOptionalIsoDateString(raw.planned_start_date)) return fail;
  if (!isOptionalIsoDateString(raw.planned_end_date)) return fail;
  // Cross-field ordering: a both-present planned window must not have the end before the start.
  if (
    !plannedDatesOrdered(
      raw.planned_start_date as string | null | undefined,
      raw.planned_end_date as string | null | undefined,
    )
  ) {
    return fail;
  }
  if (!isOptionalAcceptanceText(raw.title)) return fail;
  // TEST-ONLY: an explicit __faultInject must be a known boundary (a stray value is rejected).
  if (raw.__faultInject !== undefined) {
    if (typeof raw.__faultInject !== "string" || !FAULT_INJECT_POINTS.has(raw.__faultInject)) {
      return fail;
    }
  }

  const data: {
    quote_version_id: string;
    accepted_price_ore: number;
    accepted_at: string;
    channel?: string | null;
    adjustment_reason?: string | null;
    evidence_file_id?: string | null;
    evidence_reference?: string | null;
    notes?: string | null;
    planned_start_date?: string | null;
    planned_end_date?: string | null;
    title?: string | null;
    __faultInject?: string;
  } = {
    quote_version_id: raw.quote_version_id as string,
    accepted_price_ore: raw.accepted_price_ore as number,
    accepted_at: raw.accepted_at as string,
  };
  if ("channel" in raw) data.channel = (raw.channel as string | null) ?? null;
  if ("adjustment_reason" in raw)
    data.adjustment_reason = (raw.adjustment_reason as string | null) ?? null;
  if ("evidence_file_id" in raw)
    data.evidence_file_id = (raw.evidence_file_id as string | null) ?? null;
  if ("evidence_reference" in raw)
    data.evidence_reference = (raw.evidence_reference as string | null) ?? null;
  if ("notes" in raw) data.notes = (raw.notes as string | null) ?? null;
  if ("planned_start_date" in raw)
    data.planned_start_date = (raw.planned_start_date as string | null) ?? null;
  if ("planned_end_date" in raw)
    data.planned_end_date = (raw.planned_end_date as string | null) ?? null;
  if ("title" in raw) data.title = (raw.title as string | null) ?? null;
  if (raw.__faultInject !== undefined) data.__faultInject = raw.__faultInject as string;
  return { ok: true, data };
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 10.3 — the plan / complete / annotate follow-up input validators (AC1/AC3).
//
// The caller supplies ONLY the shape below; tenant_id / status / quote_id are NEVER read onto the
// validated data (the plan command DERIVES quote_id from the loaded anchor version — SETTLED DESIGN
// DECISION 3 — and tenant/status are server-resolved). The raw invalid value is NEVER echoed — a
// shape violation → VALIDATION_FAILED. A foreign/non-existent version/follow-up id is caught by the
// envelope ownership gate (TENANT_ACCESS_DENIED before execute), not here.
// ─────────────────────────────────────────────────────────────────────────────

/** A coarse length bound for the follow-up free-text note/outcome fields. */
const FOLLOW_UP_TEXT_MAX = 4000;

/**
 * A valid ISO calendar date (YYYY-MM-DD) that names a REAL day — rejects an impossible month
 * (2026-13-01) or day (2026-02-30) via a UTC round-trip, and any non-`date`-shaped string/number.
 */
function isIsoCalendarDate(v: unknown): v is string {
  if (typeof v !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map((p) => Number(p));
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

/**
 * Validate an OPTIONAL bounded note. Absent/null ⇒ "no note" (undefined out). A present value must
 * be a string within the length bound; it is TRIMMED (an all-whitespace note collapses to null).
 */
function validatedOptionalNote(v: unknown): { ok: true; value?: string | null } | { ok: false } {
  if (v === undefined || v === null) return { ok: true };
  if (typeof v !== "string" || v.length > FOLLOW_UP_TEXT_MAX) return { ok: false };
  const trimmed = v.trim();
  return { ok: true, value: trimmed.length > 0 ? trimmed : null };
}

/**
 * Validated `planQuoteFollowUp` input — the anchor version id + a due date + an optional note.
 * `quote_version_id` is required + UUID-shaped; `due_date` a valid ISO calendar date; `note`
 * optional + bounded + trimmed. tenant_id / quote_id / status are NEVER part of it.
 */
export interface PlanQuoteFollowUpInput {
  readonly quote_version_id: string;
  readonly due_date: string;
  readonly note?: string | null;
}

export function validatePlanQuoteFollowUp(
  raw: unknown,
): ValidationResult<PlanQuoteFollowUpInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.quote_version_id)) return fail;
  if (!isIsoCalendarDate(raw.due_date)) return fail;
  const note = validatedOptionalNote(raw.note);
  if (!note.ok) return fail;

  const data: {
    quote_version_id: string;
    due_date: string;
    note?: string | null;
  } = {
    quote_version_id: raw.quote_version_id as string,
    due_date: raw.due_date as string,
  };
  // Only carry a note when the caller supplied one (server-owned keys quote_id/tenant_id/status are
  // never read — the command derives quote_id from the loaded version, tenant/status are resolved).
  if (raw.note !== undefined) data.note = note.value ?? null;
  return { ok: true, data };
}

/**
 * Validated `completeQuoteFollowUp` input — the target follow-up id + a REQUIRED outcome note.
 * `follow_up_id` is required + UUID-shaped; `outcome` is required, non-empty (trimmed), bounded.
 */
export interface CompleteQuoteFollowUpInput {
  readonly follow_up_id: string;
  readonly outcome: string;
}

export function validateCompleteQuoteFollowUp(
  raw: unknown,
): ValidationResult<CompleteQuoteFollowUpInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.follow_up_id)) return fail;
  if (typeof raw.outcome !== "string" || raw.outcome.length > FOLLOW_UP_TEXT_MAX) {
    return fail;
  }
  const outcome = raw.outcome.trim();
  if (outcome.length === 0) return fail; // REQUIRED — a whitespace-only outcome is rejected
  return {
    ok: true,
    data: { follow_up_id: raw.follow_up_id as string, outcome },
  };
}

/**
 * Validated `annotateQuoteFollowUp` input — the target follow-up id + a bounded note.
 * `follow_up_id` is required + UUID-shaped; `note` is optional + bounded + trimmed.
 */
export interface AnnotateQuoteFollowUpInput {
  readonly follow_up_id: string;
  readonly note?: string | null;
}

export function validateAnnotateQuoteFollowUp(
  raw: unknown,
): ValidationResult<AnnotateQuoteFollowUpInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.follow_up_id)) return fail;
  const note = validatedOptionalNote(raw.note);
  if (!note.ok) return fail;

  const data: { follow_up_id: string; note?: string | null } = {
    follow_up_id: raw.follow_up_id as string,
  };
  if (raw.note !== undefined) data.note = note.value ?? null;
  return { ok: true, data };
}
