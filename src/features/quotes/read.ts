/**
 * Server-side quote reads for the list + detail (Story 6.2, Task 1) — the RLS-scoped read
 * path the `/quotes` pages call. SERVER-ONLY (no `"use server"` action surface): plain async
 * functions invoked from server components, mirroring `src/features/calculations/read.ts`
 * EXACTLY.
 *
 * EVERY read runs on the per-request, cookie-bound RLS client (anon key — NEVER a service-role
 * key). RLS scopes every row to the caller's tenant with NO tenant id passed (architecture §6);
 * a cross-tenant/nonexistent id simply returns zero rows → a GENERIC not-found (the page NEVER
 * reveals whether the row exists in another tenant). NO direct write, NO service-role client.
 *
 * ── DISPLAY THE FROZEN SNAPSHOT — NEVER RECOMPUTE (R-616; AC1 Money/Tax HIGH) ─────────────
 * Every money/VAT/total/line value the detail surfaces is read VERBATIM from the frozen
 * `quote_versions` / `quote_version_lines` snapshot rows the 6.1 command wrote. This read layer
 * NEVER re-reads the live calc/settings/pricing/terms to re-derive a total — the whole
 * copy-by-value freeze the epic is built on would be defeated otherwise.
 *
 * `pg`/PostgREST returns `bigint` öre as STRINGS — coerce (`Number(...)`) at THIS read boundary
 * so displayed öre are numbers downstream; DB snake_case → TS camelCase happens here too.
 *
 * PRIVATE-DATA posture (inherited epic-3): the customer context on the frozen snapshot is
 * DISPLAY fields only (customer_display_name/type + facility/contact NAME) — NEVER a
 * personnummer (the 6.1 snapshot carries display fields only; no pnr is ever selected here).
 */
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import type { QuoteVersionStatus } from "./timeline";

const GENERIC_READ_ERROR =
  "Ett tillfälligt fel inträffade. Försök igen om en stund.";

/** Coerce a `bigint` öre that PostgREST may return as a STRING into a JS number (or null). */
function oreNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Coerce a plain numeric/quantity field (may arrive as a string) into a number (or null). */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quote LIST projection (the `/quotes` Offerter index).
// ─────────────────────────────────────────────────────────────────────────────

/** A quote list row — the `/quotes` index projection (latest-version status + count). */
export interface QuoteListRow {
  readonly id: string;
  readonly customer_display_name: string | null;
  /** The status of the LATEST (highest version_number) version. */
  readonly latest_status: QuoteVersionStatus | null;
  /** The allocated quote number of the latest version (null when no versions yet). */
  readonly latest_quote_number: number | null;
  /** How many versions the quote has (the timeline length). */
  readonly version_count: number;
  readonly updated_at: string;
}

/** Result of the list read — rows OR a generic error message (never a leaked detail). */
export interface QuoteListReadResult {
  readonly rows: readonly QuoteListRow[];
  readonly error: string | null;
}

/**
 * Read the ACTIVE quote list (`archived_at is null`), ordered by `updated_at` desc. RLS scopes
 * to the caller's tenant. The customer display_name is joined via the embedded
 * `customers(display_name)` relationship (RLS restricts the join to own-tenant customers). The
 * latest-version status + quote number + version count come from the embedded
 * `quote_versions(...)` relationship, resolved by highest `version_number`. On a query error
 * returns a GENERIC Swedish message (the FAILED state) — never a leaked stack/SQL.
 */
export async function readQuoteList(): Promise<QuoteListReadResult> {
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client
      .from("quotes")
      .select(
        "id, updated_at, customers(display_name), quote_versions(version_number, status, quote_number)",
      )
      .is("archived_at", null)
      .order("updated_at", { ascending: false });
    if (error) return { rows: [], error: GENERIC_READ_ERROR };
    const rows: QuoteListRow[] = (data ?? []).map((r) => {
      const rec = r as unknown as {
        id: string;
        updated_at: string;
        customers:
          | { display_name: string | null }
          | { display_name: string | null }[]
          | null;
        quote_versions:
          | {
              version_number: number | string;
              status: QuoteVersionStatus;
              quote_number: number | string | null;
            }[]
          | null;
      };
      const customer = Array.isArray(rec.customers)
        ? rec.customers[0]
        : rec.customers;
      const versions = rec.quote_versions ?? [];
      // The LATEST version = the highest version_number (never a live recompute).
      let latest: (typeof versions)[number] | null = null;
      for (const v of versions) {
        if (latest === null || Number(v.version_number) > Number(latest.version_number)) {
          latest = v;
        }
      }
      return {
        id: rec.id,
        customer_display_name: customer?.display_name ?? null,
        latest_status: latest?.status ?? null,
        latest_quote_number: latest ? num(latest.quote_number) : null,
        version_count: versions.length,
        updated_at: rec.updated_at,
      };
    });
    return { rows, error: null };
  } catch {
    return { rows: [], error: GENERIC_READ_ERROR };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Quote DETAIL projection (the `/quotes/[quoteId]` Offert view).
// ─────────────────────────────────────────────────────────────────────────────

/** The quote header (the logical quote root + display context via the frozen version snapshot). */
export interface QuoteHeaderRow {
  readonly id: string;
  readonly customer_id: string;
  readonly customer_display_name: string | null;
  readonly facility_name: string | null;
  readonly contact_name: string | null;
  /** The source calculation id (for the "source calculation" link — from the latest version). */
  readonly calculation_id: string | null;
  readonly updated_at: string;
}

/** A single frozen quote-version snapshot row (the timeline entry + selected-version detail). */
export interface QuoteVersionRow {
  readonly id: string;
  readonly version_number: number;
  readonly quote_number: number | null;
  readonly quote_number_display: string | null;
  readonly status: QuoteVersionStatus;
  readonly calculation_id: string;
  readonly customer_display_name: string | null;
  readonly customer_type: string | null;
  readonly facility_name: string | null;
  readonly contact_name: string | null;
  readonly valid_until: string | null;
  readonly intro_text: string | null;
  readonly customer_notes: string | null;
  readonly terms_text: string | null;
  readonly terms_approved_at: string | null;
  readonly display_mode: string | null;
  // Totals in INTEGER ÖRE — read VERBATIM from the frozen row (never recomputed).
  readonly base_total_ore: number;
  readonly option_total_ore: number;
  readonly vat_total_ore: number;
  readonly deduction_total_ore: number;
  readonly accepted_price_ore: number;
  // VAT / tax assumptions (basis points / flags), frozen at snapshot time.
  readonly vat_rate_bp: number | null;
  readonly vat_display: string | null;
  readonly deduction_type: string | null;
  readonly deduction_rate_bp: number | null;
  readonly deduction_cap_ore: number | null;
  readonly deduction_persons: number | null;
  readonly requires_sign_off: boolean;
  // PDF status (Story 6.3 fills them — 6.2 DISPLAYS the frozen values).
  readonly pdf_file_id: string | null;
  readonly pdf_generated_at: string | null;
  /** The PDF render state (Story 6.3): not_generated | generating | generated | failed. */
  readonly pdf_status: string;
  readonly warnings_snapshot: readonly {
    readonly code: string;
    readonly severity: string;
    readonly message: string;
  }[];
  readonly created_at: string;
}

/** A frozen customer-visible line snapshot row (NO cost/margin/internal — R-607). */
export interface QuoteVersionLineRow {
  readonly id: string;
  readonly row_type: string;
  readonly sort_order: number;
  readonly label: string | null;
  readonly description: string | null;
  readonly quote_note: string | null;
  readonly quantity: number | null;
  readonly unit: string | null;
  readonly unit_sell_ore: number | null;
  readonly line_net_ore: number | null;
  readonly vat_rate_bp: number | null;
  readonly is_hidden: boolean;
  readonly is_optional: boolean;
  readonly is_selected: boolean | null;
}

/** A frozen selected-attachment snapshot row. */
export interface QuoteVersionAttachmentRow {
  readonly id: string;
  readonly file_id: string;
  readonly display_name: string | null;
  readonly sort_order: number;
}

/** A quote lifecycle event (the append-friendly event log — READ only in 6.2). */
export interface QuoteEventRow {
  readonly id: string;
  readonly event_type: string;
  readonly occurred_at: string;
  readonly channel: string | null;
  readonly reference: string | null;
  readonly quote_version_id: string | null;
}

/** The assembled quote-detail read (header + all versions + selected-version children + events). */
export interface QuoteDetail {
  readonly header: QuoteHeaderRow;
  /** ALL versions (the timeline — the caller orders by version_number). */
  readonly versions: readonly QuoteVersionRow[];
  /** The id of the version whose children (lines/attachments) are included. */
  readonly selectedVersionId: string;
  /** The selected version's frozen customer-visible lines (ordered by sort_order). */
  readonly selectedLines: readonly QuoteVersionLineRow[];
  /** The selected version's frozen selected-attachment metadata (ordered by sort_order). */
  readonly selectedAttachments: readonly QuoteVersionAttachmentRow[];
  /** The quote's lifecycle events (ordered occurred_at asc). */
  readonly events: readonly QuoteEventRow[];
  /**
   * Story 7.3 (AC5 deep-link seam): the created job id per accepted version id — the ONE job the
   * 7.2 acceptance transaction created off that version (`unique (quote_acceptance_id)` guarantees
   * exactly one). RLS-scoped (own-tenant). Empty when no version has been accepted yet. The
   * accepted-section deep link uses this to point at `/jobs/[jobId]` (never a duplicate/create).
   */
  readonly acceptedJobIdByVersionId: Readonly<Record<string, string>>;
  /**
   * Story 8.2 (AC5): the acceptance id per accepted version id — for the acceptance-evidence
   * file panel on the accepted section. RLS-scoped (own-tenant); at most one acceptance per
   * version (`unique (quote_version_id)`). Empty when no version has been accepted yet.
   */
  readonly acceptanceIdByVersionId: Readonly<Record<string, string>>;
}

/** Result of the quote-detail read — the detail OR null (not-found) + a generic error. */
export interface QuoteDetailReadResult {
  readonly detail: QuoteDetail | null;
  readonly error: string | null;
}

const QUOTE_HEADER_COLUMNS =
  "id, customer_id, updated_at, customers(display_name)";

// SELECT ONLY the frozen snapshot columns (no cost/margin/internal — none exist on the row).
const VERSION_COLUMNS =
  "id, version_number, quote_number, quote_number_display, status, calculation_id, customer_display_name, customer_type, facility_name, contact_name, valid_until, intro_text, customer_notes, terms_text, terms_approved_at, display_mode, base_total_ore, option_total_ore, vat_total_ore, deduction_total_ore, accepted_price_ore, vat_rate_bp, vat_display, deduction_type, deduction_rate_bp, deduction_cap_ore, deduction_persons, requires_sign_off, pdf_file_id, pdf_generated_at, pdf_status, warnings_snapshot, created_at";

const LINE_COLUMNS =
  "id, row_type, sort_order, label, description, quote_note, quantity, unit, unit_sell_ore, line_net_ore, vat_rate_bp, is_hidden, is_optional, is_selected";

const ATTACHMENT_COLUMNS = "id, file_id, display_name, sort_order";

const EVENT_COLUMNS =
  "id, event_type, occurred_at, channel, reference, quote_version_id";

/** Normalise a raw version row from PostgREST into the typed camel/coerced shape. */
function toVersionRow(raw: Record<string, unknown>): QuoteVersionRow {
  const warnings = Array.isArray(raw.warnings_snapshot)
    ? (raw.warnings_snapshot as unknown[]).map((w) => {
        const rec = (w ?? {}) as Record<string, unknown>;
        return {
          code: String(rec.code ?? ""),
          severity: String(rec.severity ?? ""),
          message: String(rec.message ?? ""),
        };
      })
    : [];
  return {
    id: String(raw.id),
    version_number: Number(raw.version_number),
    quote_number: num(raw.quote_number),
    quote_number_display: (raw.quote_number_display as string | null) ?? null,
    status: raw.status as QuoteVersionStatus,
    calculation_id: String(raw.calculation_id),
    customer_display_name: (raw.customer_display_name as string | null) ?? null,
    customer_type: (raw.customer_type as string | null) ?? null,
    facility_name: (raw.facility_name as string | null) ?? null,
    contact_name: (raw.contact_name as string | null) ?? null,
    valid_until: (raw.valid_until as string | null) ?? null,
    intro_text: (raw.intro_text as string | null) ?? null,
    customer_notes: (raw.customer_notes as string | null) ?? null,
    terms_text: (raw.terms_text as string | null) ?? null,
    terms_approved_at: (raw.terms_approved_at as string | null) ?? null,
    display_mode: (raw.display_mode as string | null) ?? null,
    base_total_ore: oreNumber(raw.base_total_ore) ?? 0,
    option_total_ore: oreNumber(raw.option_total_ore) ?? 0,
    vat_total_ore: oreNumber(raw.vat_total_ore) ?? 0,
    deduction_total_ore: oreNumber(raw.deduction_total_ore) ?? 0,
    accepted_price_ore: oreNumber(raw.accepted_price_ore) ?? 0,
    vat_rate_bp: num(raw.vat_rate_bp),
    vat_display: (raw.vat_display as string | null) ?? null,
    deduction_type: (raw.deduction_type as string | null) ?? null,
    deduction_rate_bp: num(raw.deduction_rate_bp),
    deduction_cap_ore: oreNumber(raw.deduction_cap_ore),
    deduction_persons: num(raw.deduction_persons),
    requires_sign_off: raw.requires_sign_off === true,
    pdf_file_id: (raw.pdf_file_id as string | null) ?? null,
    pdf_generated_at: (raw.pdf_generated_at as string | null) ?? null,
    pdf_status: (raw.pdf_status as string | null) ?? "not_generated",
    warnings_snapshot: warnings,
    created_at: String(raw.created_at),
  };
}

/** Normalise a raw line row (coerce öre/quantity; snake_case in the type). */
function toLineRow(raw: Record<string, unknown>): QuoteVersionLineRow {
  return {
    id: String(raw.id),
    row_type: String(raw.row_type),
    sort_order: Number(raw.sort_order ?? 0),
    label: (raw.label as string | null) ?? null,
    description: (raw.description as string | null) ?? null,
    quote_note: (raw.quote_note as string | null) ?? null,
    quantity: num(raw.quantity),
    unit: (raw.unit as string | null) ?? null,
    unit_sell_ore: oreNumber(raw.unit_sell_ore),
    line_net_ore: oreNumber(raw.line_net_ore),
    vat_rate_bp: num(raw.vat_rate_bp),
    is_hidden: raw.is_hidden === true,
    is_optional: raw.is_optional === true,
    is_selected: raw.is_selected === null || raw.is_selected === undefined
      ? null
      : raw.is_selected === true,
  };
}

/**
 * Read one quote by id: the header (customer/facility/contact display), ALL its versions (the
 * timeline), and — for the resolved selected version (default: the latest, or a supplied id) —
 * that version's frozen lines + attachments, plus the quote's events. A foreign/other-tenant id
 * is invisible under RLS → zero rows → `detail: null` (a GENERIC not-found, no cross-tenant
 * existence leak). A query error returns the generic FAILED message.
 *
 * Money/VAT/totals are read VERBATIM from the frozen version/line rows — NEVER recomputed.
 */
export async function readQuoteDetail(
  quoteId: string,
  selectedVersionId?: string,
): Promise<QuoteDetailReadResult> {
  try {
    const client = await createSupabaseServerClient();

    // ── The quote header (own-tenant RLS; customer display via the embedded relationship). ──
    const { data: quoteRows, error: quoteError } = await client
      .from("quotes")
      .select(QUOTE_HEADER_COLUMNS)
      .eq("id", quoteId)
      .is("archived_at", null)
      .limit(1);
    if (quoteError) return { detail: null, error: GENERIC_READ_ERROR };
    const quoteRaw = (quoteRows?.[0] ?? null) as
      | (Record<string, unknown> & {
          customers:
            | { display_name: string | null }
            | { display_name: string | null }[]
            | null;
        })
      | null;
    if (!quoteRaw) {
      // Invisible under RLS (or genuinely absent) → generic not-found, no leakage.
      return { detail: null, error: null };
    }

    // ── ALL versions for the quote (the timeline; ordered by version_number asc). ──
    const { data: versionData, error: versionError } = await client
      .from("quote_versions")
      .select(VERSION_COLUMNS)
      .eq("quote_id", quoteId)
      .is("archived_at", null)
      .order("version_number", { ascending: true });
    if (versionError) return { detail: null, error: GENERIC_READ_ERROR };
    const versions = ((versionData ?? []) as Record<string, unknown>[]).map(
      toVersionRow,
    );

    // A quote with zero versions is a degenerate/racing state — treat as not-found rather
    // than render an empty detail (the 6.1 create always writes version 1).
    if (versions.length === 0) {
      return { detail: null, error: null };
    }

    // Resolve the SELECTED version: the supplied id when it belongs to the timeline, else the
    // LATEST (highest version_number). A supplied foreign id falls back silently (no leak).
    let selected = versions[versions.length - 1]; // latest (versions are asc-ordered)
    if (selectedVersionId) {
      const match = versions.find((v) => v.id === selectedVersionId);
      if (match) selected = match;
    }
    const selectedId = selected.id;

    // The lifecycle-header customer name is the LIVE own-tenant CRM display (per ux §6 the
    // header shows the current customer identity), preferring the quote root's own-tenant
    // `customers` join and falling back to the frozen snapshot display only when the join is
    // absent — see the header assembly below. This is intentional and is NOT a snapshot
    // violation: AC1's read-verbatim rule is scoped to money/VAT/totals, which ALWAYS stay
    // snapshot-verbatim (never recomputed). Facility/contact for the header context come from
    // the LATEST version's frozen display.
    const latest = versions[versions.length - 1];

    // ── The selected version's frozen children + the quote events (parallel, own-tenant RLS). ──
    // Plus (Story 7.3, AC5 seam) the jobs created off this quote's versions — the deep-link target.
    const [linesRes, attachmentsRes, eventsRes, jobsRes, acceptancesRes] =
      await Promise.all([
      client
        .from("quote_version_lines")
        .select(LINE_COLUMNS)
        .eq("quote_version_id", selectedId)
        .order("sort_order", { ascending: true }),
      client
        .from("quote_version_attachments")
        .select(ATTACHMENT_COLUMNS)
        .eq("quote_version_id", selectedId)
        .order("sort_order", { ascending: true }),
      client
        .from("quote_events")
        .select(EVENT_COLUMNS)
        .eq("quote_id", quoteId)
        .order("occurred_at", { ascending: true }),
      // The job(s) created off any version of THIS quote (RLS-scoped; own-tenant only). `jobs` has
      // NO quote_id column (it links via quote_version_id + quote_acceptance_id), so read the
      // tenant's active jobs and filter to THIS quote's version ids in memory. One job per accepted
      // version — the 7.2 transaction's `unique (quote_acceptance_id)` guarantees exactly one.
      client
        .from("jobs")
        .select("id, quote_version_id")
        .is("archived_at", null),
      // The acceptance(s) recorded off any version of THIS quote (RLS-scoped; own-tenant only).
      // Story 8.2 (AC5): the acceptance-evidence file panel needs the acceptance id per accepted
      // version. `unique (quote_version_id)` guarantees at most one acceptance per version.
      client
        .from("quote_acceptances")
        .select("id, quote_version_id"),
    ]);

    if (linesRes.error) return { detail: null, error: GENERIC_READ_ERROR };
    if (attachmentsRes.error) return { detail: null, error: GENERIC_READ_ERROR };
    if (eventsRes.error) return { detail: null, error: GENERIC_READ_ERROR };
    // A jobs read error is NON-FATAL to the quote detail — the deep link is a convenience, not the
    // quote's core data. Degrade to an empty map rather than fail the whole quote read.
    const versionIdSet = new Set(versions.map((v) => v.id));
    const acceptedJobIdByVersionId: Record<string, string> = {};
    if (!jobsRes.error) {
      for (const raw of (jobsRes.data ?? []) as Record<string, unknown>[]) {
        const vId = raw.quote_version_id;
        const jId = raw.id;
        if (
          typeof vId === "string" &&
          typeof jId === "string" &&
          versionIdSet.has(vId)
        ) {
          acceptedJobIdByVersionId[vId] = jId;
        }
      }
    }
    // Story 8.2 — the acceptance id per accepted version (for the acceptance-evidence file
    // panel). A read fault is NON-FATAL to the quote detail (the panel is a convenience).
    const acceptanceIdByVersionId: Record<string, string> = {};
    if (!acceptancesRes.error) {
      for (const raw of (acceptancesRes.data ?? []) as Record<string, unknown>[]) {
        const vId = raw.quote_version_id;
        const aId = raw.id;
        if (
          typeof vId === "string" &&
          typeof aId === "string" &&
          versionIdSet.has(vId)
        ) {
          acceptanceIdByVersionId[vId] = aId;
        }
      }
    }

    const selectedLines = ((linesRes.data ?? []) as Record<string, unknown>[]).map(
      toLineRow,
    );
    const selectedAttachments = (
      (attachmentsRes.data ?? []) as Record<string, unknown>[]
    ).map((raw) => ({
      id: String(raw.id),
      file_id: String(raw.file_id),
      display_name: (raw.display_name as string | null) ?? null,
      sort_order: Number(raw.sort_order ?? 0),
    }));
    const events = ((eventsRes.data ?? []) as Record<string, unknown>[]).map(
      (raw) => ({
        id: String(raw.id),
        event_type: String(raw.event_type),
        occurred_at: String(raw.occurred_at),
        channel: (raw.channel as string | null) ?? null,
        reference: (raw.reference as string | null) ?? null,
        quote_version_id: (raw.quote_version_id as string | null) ?? null,
      }),
    );

    const customer = Array.isArray(quoteRaw.customers)
      ? quoteRaw.customers[0]
      : quoteRaw.customers;

    const header: QuoteHeaderRow = {
      id: String(quoteRaw.id),
      customer_id: String(quoteRaw.customer_id),
      // The header name is the LIVE own-tenant customer display (the quote root's own-tenant
      // join), falling back to the frozen snapshot display when the join is absent. Money/VAT/
      // totals stay snapshot-verbatim elsewhere; only this identity label reflects current CRM.
      customer_display_name:
        customer?.display_name ?? latest.customer_display_name ?? null,
      facility_name: latest.facility_name,
      contact_name: latest.contact_name,
      calculation_id: latest.calculation_id,
      updated_at: String(quoteRaw.updated_at),
    };

    return {
      detail: {
        header,
        versions,
        selectedVersionId: selectedId,
        selectedLines,
        selectedAttachments,
        events,
        acceptedJobIdByVersionId,
        acceptanceIdByVersionId,
      },
      error: null,
    };
  } catch {
    return { detail: null, error: GENERIC_READ_ERROR };
  }
}
