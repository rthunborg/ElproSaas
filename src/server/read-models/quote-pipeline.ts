/**
 * Story 10.4 — the first `src/server/read-models` DB module: the quote-pipeline read-model (Task 2.3;
 * AC1/AC4). It reads the RLS-scoped lifecycle rows, folds them through the PURE aggregation (Task 1)
 * and the PURE entitlement projection (Task 2.1/2.2), and returns the phase-defining
 * `{ data, entitlements }` descriptor E19 will consume later.
 *
 * ── RLS COOKIE-BOUND CLIENT ONLY (SETTLED DESIGN DECISION 1; R-1041 — the security floor) ────────
 * EVERY underlying query runs on the per-request, cookie-bound RLS client (`createSupabaseServerClient`
 * — the SAME client `src/features/quotes/read.ts` uses; anon key only). RLS scopes every row to the
 * caller's tenant with NO tenant id passed, so a crafted request that bypasses this descriptor still
 * hits the RLS floor. This module NEVER imports a privileged/unscoped client and never writes — the
 * read-model READS only. `deps.client` is an injectable seam the integration harness binds to a
 * tenant's authed client to prove cross-tenant isolation; production always resolves the request client.
 *
 * ── THIN QUERY LAYER (keep the contract-bearing logic PURE) ──────────────────────────────────────
 * The counts / hit rate / öre money aggregate / period window all live in the pure aggregate; the
 * withholding mechanism lives in the pure projection. This module only issues the reads + maps rows, so
 * 10.4-UNIT-01/02 pin the contract without a stack and 10.4-INT-01 proves ONLY the query/isolation layer.
 *
 * ── GENERIC-ERROR POSTURE (mirror read.ts) ───────────────────────────────────────────────────────
 * readQuotePipelineResult distinguishes unavailable reads from successful empty periods. The historical
 * readQuotePipeline wrapper retains its empty-descriptor fallback for existing callers. Neither leaks detail.
 *
 * [Source: story 10.4 AC1/AC4 + Task 2.3 + SETTLED DESIGN DECISION 1 + Dev Notes "The security floor
 *  is §3.6"; src/features/quotes/read.ts (RLS client + generic-error posture + öre coercion);
 *  src/server/db/supabase-server-client.ts (the anon-key RLS client); test-design-epic-10.md#10.4-INT-01,
 *  R-1041/R-1042]
 */
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import {
  aggregateQuotePipeline,
  resolvePipelinePeriod,
  type PipelinePeriod,
  type PipelineEventRow,
  type AcceptedVersionRow,
  type FollowUpRow,
  type PipelineAggregate,
} from "./quote-pipeline-aggregate";
import {
  projectWithEntitlements,
  type EntitlementInput,
  type PipelineDescriptor,
} from "./entitlements";
import { chunkValues, readAllPages } from "./pagination";

/** The request-bound RLS client type (the ONLY client this read-model queries). */
type PipelineServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Injectable dependencies — the RLS client (integration harness binds it) + the boundary clock. */
export interface QuotePipelineDeps {
  /** Bind a tenant's RLS-scoped client (integration harness); production resolves the request client. */
  readonly client?: PipelineServerClient;
  /** The injected boundary instant (ISO) for the period window + overdue classification (tests pin it). */
  readonly now?: string;
}

/**
 * The minimal own-tenant read surface the read-model queries (a documented boundary narrowing, mirror
 * the quote-command `asReadClient` cast). Every chain is a `.from(table).select(cols)` then a single
 * `.in`/`.eq` filter — all RLS-scoped.
 */
type PipelineReadResult = { data: unknown[] | null; error: unknown };
type PipelineReadQuery = {
  in(column: string, values: readonly string[]): PipelineReadQuery;
  eq(column: string, value: string): PipelineReadQuery;
  gte(column: string, value: string): PipelineReadQuery;
  lt(column: string, value: string): PipelineReadQuery;
  order(column: string, options?: { ascending?: boolean }): PipelineReadQuery;
  range(from: number, to: number): Promise<PipelineReadResult>;
};
type PipelineReadClient = {
  from(table: string): {
    select(columns: string): PipelineReadQuery;
  };
};

async function readPipelinePages(
  query: PipelineReadQuery,
): Promise<PipelineReadResult> {
  const result = await readAllPages((from, to) => query.range(from, to));
  return { data: [...result.data], error: result.error };
}

async function readPipelineBatches(
  ids: readonly string[],
  queryForIds: (ids: readonly string[]) => PipelineReadQuery,
): Promise<PipelineReadResult> {
  const rows: unknown[] = [];
  for (const idsPage of chunkValues(ids)) {
    const result = await readPipelinePages(queryForIds(idsPage));
    if (result.error) return result;
    rows.push(...(result.data ?? []));
  }
  return { data: rows, error: null };
}

function nextCalendarDay(day: string): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** PostgREST bigint conversion: strict result reads reject unsafe/malformed money; legacy reads retain coercion. */
function oreNumber(v: unknown, strict: boolean): number {
  if (strict && (v === null || v === undefined ||
    (typeof v !== "number" && (typeof v !== "string" || !/^-?\d+$/.test(v))) ||
    !Number.isSafeInteger(Number(v)))) throw new Error("Invalid accepted money");
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** A generic EMPTY aggregate for a period — the degrade target on any query fault (never a leak). */
function emptyAggregate(period: PipelinePeriod): PipelineAggregate {
  return {
    period,
    sentCount: 0,
    acceptedCount: 0,
    lostCount: 0,
    hitRate: null,
    openFollowUpCount: 0,
    overdueFollowUpCount: 0,
    acceptedValueOre: 0,
  };
}

/**
 * Read the quote pipeline for `period` (default: the trailing-year window resolved from `now`) and
 * project it through the entitlement descriptor. Queries `quote_events` (the count source),
 * `quote_acceptances.accepted_price_ore` for the accepted versions (the ACCEPTED-commitment money
 * source — adjusted-price-aware, NOT the version's frozen sent total), and the OPEN `quote_follow_ups`
 * joined to their quote's latest version status (the follow-up counts, EXCLUDING decided quotes) — all
 * on the RLS client. Returns the `{ data, entitlements }` descriptor.
 */
async function readPipelineCore(
  period?: PipelinePeriod,
  entitlementInput?: EntitlementInput,
  deps: QuotePipelineDeps = {},
  strict = false,
): Promise<PipelineDescriptor> {
  const now = deps.now ?? new Date().toISOString();

  try {
    // Result reads validate even an explicit-period clock before any query; the legacy wrapper retains its fallback.
    if (strict && !validPipelineInstant(now)) throw new Error("Invalid clock");
    const resolvedPeriod = period ?? resolvePipelinePeriod(now);
    if (strict && !validPipelinePeriod(resolvedPeriod)) throw new Error("Invalid period");

    const base = deps.client ?? (await createSupabaseServerClient());
    const client = base as unknown as PipelineReadClient;

    // ── Lifecycle events (the count source of truth — never the live status). RLS scopes to tenant. ──
    // Read ALL sent/accepted/lost events and let the PURE aggregate window-filter them on the
    // Stockholm calendar boundary (ONE date convention; no second DB-side date rule).
    // The fixed +02/+01 bounds safely cover either Stockholm DST offset; the pure aggregate makes
    // the final Stockholm-calendar inclusion decision. The database still eliminates the vast
    // majority of out-of-period rows before bounded pagination.
    const eventsRes = await readPipelinePages(
      client
        .from("quote_events")
        .select("quote_version_id, event_type, occurred_at")
        .in("event_type", ["sent", "accepted", "lost"])
        .gte("occurred_at", `${resolvedPeriod.from}T00:00:00+02:00`)
        .lt("occurred_at", `${nextCalendarDay(resolvedPeriod.to)}T00:00:00+01:00`)
        .order("occurred_at", { ascending: true })
        .order("id", { ascending: true }),
    );
    if (eventsRes.error) throw new Error("Pipeline query unavailable");

    const events: PipelineEventRow[] = [];
    const acceptedVersionIds = new Set<string>();
    for (const raw of (eventsRes.data ?? []) as Record<string, unknown>[]) {
      const versionId = raw.quote_version_id;
      const type = raw.event_type;
      if (typeof versionId !== "string") continue;
      if (type !== "sent" && type !== "accepted" && type !== "lost") continue;
      events.push({
        quote_version_id: versionId,
        event_type: type,
        occurred_at: String(raw.occurred_at),
      });
      if (type === "accepted") acceptedVersionIds.add(versionId);
    }

    // ── The accepted versions' ACCEPTED commitment öre (the money aggregate source) — read from
    // `quote_acceptances.accepted_price_ore` (what the customer ACTUALLY accepted, adjusted-price-aware),
    // NOT `quote_versions.accepted_price_ore` (that is the frozen SOURCE SENT total the delta is measured
    // against). Only the versions with an accepted event are read; skip the query when none exist. ──
    const acceptedVersions: AcceptedVersionRow[] = [];
    if (acceptedVersionIds.size > 0) {
      const acceptancesRes = await readPipelineBatches(
        [...acceptedVersionIds],
        (ids) => client
          .from("quote_acceptances")
          .select("quote_version_id, accepted_price_ore")
          .in("quote_version_id", ids)
          .order("quote_version_id", { ascending: true })
          .order("id", { ascending: true }),
      );
      if (acceptancesRes.error) throw new Error("Pipeline query unavailable");
      for (const raw of (acceptancesRes.data ?? []) as Record<string, unknown>[]) {
        const vId = raw.quote_version_id;
        if (typeof vId !== "string") continue;
        acceptedVersions.push({
          quote_version_id: vId,
          accepted_price_ore: oreNumber(raw.accepted_price_ore, strict),
        });
      }
    }

    // ── The OPEN follow-ups (open/overdue count source). Read the quote_id too so an OPEN follow-up on
    // an already-DECIDED quote (its latest version is a terminal status: accepted/lost/rejected/expired)
    // is EXCLUDED from the counts — a decided deal must not keep escalating a stale follow-up (10.4 +
    // iteration-2 review). The overdue subset is derived in the pure aggregate via classifyFollowUp on
    // the Stockholm boundary. ──
    const followUpsRes = await readPipelinePages(
      client
        .from("quote_follow_ups")
        .select("id, status, due_date, quote_id")
        .eq("status", "open")
        .order("due_date", { ascending: true })
        .order("id", { ascending: true }),
    );
    if (followUpsRes.error) throw new Error("Pipeline query unavailable");

    const rawFollowUps = (followUpsRes.data ?? []) as Record<string, unknown>[];

    // Resolve each open follow-up's quote's LATEST version status (highest version_number) so the pure
    // aggregate can exclude follow-ups on decided quotes. One RLS-scoped read over the involved quotes.
    const followUpQuoteIds = new Set<string>();
    for (const raw of rawFollowUps) {
      if (typeof raw.quote_id === "string") followUpQuoteIds.add(raw.quote_id);
    }
    const latestStatusByQuoteId = new Map<string, { versionNumber: number; status: string }>();
    if (followUpQuoteIds.size > 0) {
      const versionsRes = await readPipelineBatches(
        [...followUpQuoteIds],
        (ids) => client
          .from("quote_versions")
          .select("quote_id, version_number, status")
          .in("quote_id", ids)
          .order("quote_id", { ascending: true })
          .order("version_number", { ascending: true })
          .order("id", { ascending: true }),
      );
      if (versionsRes.error) throw new Error("Pipeline query unavailable");
      for (const raw of (versionsRes.data ?? []) as Record<string, unknown>[]) {
        const quoteId = raw.quote_id;
        if (typeof quoteId !== "string") continue;
        const versionNumber = Number(raw.version_number);
        if (!Number.isFinite(versionNumber)) continue;
        const status = String(raw.status ?? "");
        const prev = latestStatusByQuoteId.get(quoteId);
        if (!prev || versionNumber > prev.versionNumber) {
          latestStatusByQuoteId.set(quoteId, { versionNumber, status });
        }
      }
    }

    const followUps: FollowUpRow[] = [];
    for (const raw of rawFollowUps) {
      const id = raw.id;
      if (typeof id !== "string") continue;
      const quoteId = typeof raw.quote_id === "string" ? raw.quote_id : null;
      followUps.push({
        id,
        status: raw.status === "completed" ? "completed" : "open",
        due_date: String(raw.due_date),
        quoteLatestVersionStatus: quoteId ? latestStatusByQuoteId.get(quoteId)?.status ?? null : null,
      });
    }

    const aggregate = aggregateQuotePipeline(
      { events, acceptedVersions, followUps },
      resolvedPeriod,
      now,
    );
    return projectWithEntitlements(aggregate, entitlementInput);
  } catch {
    throw new Error("Pipeline unavailable");
  }
}

/** Result entry used by dashboard: no partial values, empty fallback or raw errors. */
export type QuotePipelineResult =
  | { readonly ok: true; readonly data: { readonly descriptor: PipelineDescriptor; readonly completedAt: string } }
  | { readonly ok: false; readonly code: "SERVER_ERROR"; readonly message: string };

export async function readQuotePipelineResult(
  period?: PipelinePeriod,
  entitlementInput?: EntitlementInput,
  deps: QuotePipelineDeps = {},
): Promise<QuotePipelineResult> {
  try {
    const descriptor = await readPipelineCore(period, entitlementInput, deps, true);
    return { ok: true, data: { descriptor, completedAt: new Date().toISOString() } };
  } catch {
    return { ok: false, code: "SERVER_ERROR", message: "Kunde inte läsa offertpipeline" };
  }
}

/** Compatible E10 descriptor entry; dashboard must use the result entry above. */
export async function readQuotePipeline(
  period?: PipelinePeriod,
  entitlementInput?: EntitlementInput,
  deps: QuotePipelineDeps = {},
): Promise<PipelineDescriptor> {
  try {
    return await readPipelineCore(period, entitlementInput, deps);
  } catch {
    let fallback = period;
    if (!fallback) {
      try { fallback = resolvePipelinePeriod(deps.now ?? new Date().toISOString()); }
      catch { fallback = safePeriodFromInstant(deps.now ?? new Date().toISOString()); }
    }
    return projectWithEntitlements(emptyAggregate(fallback), entitlementInput);
  }
}

function validPipelineInstant(value: string): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    return false;
  return Number.isFinite(Date.parse(value)) && validPipelineDay(value.slice(0, 10));
}

function validPipelineDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) &&
    new Date(day).toISOString().slice(0, 10) === day;
}

function validPipelinePeriod(period: PipelinePeriod): boolean {
  return validPipelineDay(period.from) && validPipelineDay(period.to) && period.from <= period.to;
}

/** A same-day fallback window from a raw ISO instant — string-only (never throws), for the degrade path. */
function safePeriodFromInstant(now: string): PipelinePeriod {
  const day = typeof now === "string" && now.length >= 10 ? now.slice(0, 10) : "1970-01-01";
  return { from: day, to: day };
}
