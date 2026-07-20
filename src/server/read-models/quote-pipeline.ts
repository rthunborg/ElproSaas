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
 * On any query fault the module degrades to a generic EMPTY descriptor for the resolved period (all-zero
 * counts, hitRate null, money 0/withheld per entitlement) — it NEVER leaks a SQL/stack detail.
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
type PipelineReadClient = {
  from(table: string): {
    select(columns: string): {
      in(column: string, values: readonly string[]): Promise<PipelineReadResult>;
      eq(column: string, value: string): Promise<PipelineReadResult>;
    };
  };
};

/** Coerce a `bigint` öre that PostgREST may return as a STRING into a JS number (0 when absent/invalid). */
function oreNumber(v: unknown): number {
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
export async function readQuotePipeline(
  period?: PipelinePeriod,
  entitlementInput?: EntitlementInput,
  deps: QuotePipelineDeps = {},
): Promise<PipelineDescriptor> {
  const now = deps.now ?? new Date().toISOString();

  try {
    // Resolve the period INSIDE the try: a malformed injected clock throws from `resolvePipelinePeriod`,
    // and this module's contract is to degrade to a generic empty descriptor — never leak a stack. A
    // resolution outside the try would escape that posture (10.4 review patch).
    const resolvedPeriod = period ?? resolvePipelinePeriod(now);

    const base = deps.client ?? (await createSupabaseServerClient());
    const client = base as unknown as PipelineReadClient;

    // ── Lifecycle events (the count source of truth — never the live status). RLS scopes to tenant. ──
    // Read ALL sent/accepted/lost events and let the PURE aggregate window-filter them on the
    // Stockholm calendar boundary (ONE date convention; no second DB-side date rule).
    const eventsRes = await client
      .from("quote_events")
      .select("quote_version_id, event_type, occurred_at")
      .in("event_type", ["sent", "accepted", "lost"]);
    if (eventsRes.error) return projectWithEntitlements(emptyAggregate(resolvedPeriod), entitlementInput);

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
      const acceptancesRes = await client
        .from("quote_acceptances")
        .select("quote_version_id, accepted_price_ore")
        .in("quote_version_id", [...acceptedVersionIds]);
      if (acceptancesRes.error) return projectWithEntitlements(emptyAggregate(resolvedPeriod), entitlementInput);
      for (const raw of (acceptancesRes.data ?? []) as Record<string, unknown>[]) {
        const vId = raw.quote_version_id;
        if (typeof vId !== "string") continue;
        acceptedVersions.push({
          quote_version_id: vId,
          accepted_price_ore: oreNumber(raw.accepted_price_ore),
        });
      }
    }

    // ── The OPEN follow-ups (open/overdue count source). Read the quote_id too so an OPEN follow-up on
    // an already-DECIDED quote (its latest version is a terminal status: accepted/lost/rejected/expired)
    // is EXCLUDED from the counts — a decided deal must not keep escalating a stale follow-up (10.4 +
    // iteration-2 review). The overdue subset is derived in the pure aggregate via classifyFollowUp on
    // the Stockholm boundary. ──
    const followUpsRes = await client
      .from("quote_follow_ups")
      .select("id, status, due_date, quote_id")
      .eq("status", "open");
    if (followUpsRes.error) return projectWithEntitlements(emptyAggregate(resolvedPeriod), entitlementInput);

    const rawFollowUps = (followUpsRes.data ?? []) as Record<string, unknown>[];

    // Resolve each open follow-up's quote's LATEST version status (highest version_number) so the pure
    // aggregate can exclude follow-ups on decided quotes. One RLS-scoped read over the involved quotes.
    const followUpQuoteIds = new Set<string>();
    for (const raw of rawFollowUps) {
      if (typeof raw.quote_id === "string") followUpQuoteIds.add(raw.quote_id);
    }
    const latestStatusByQuoteId = new Map<string, { versionNumber: number; status: string }>();
    if (followUpQuoteIds.size > 0) {
      const versionsRes = await client
        .from("quote_versions")
        .select("quote_id, version_number, status")
        .in("quote_id", [...followUpQuoteIds]);
      if (versionsRes.error) return projectWithEntitlements(emptyAggregate(resolvedPeriod), entitlementInput);
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
    // Generic degrade — never leak a SQL/stack detail (mirror read.ts's FAILED posture). Resolve a
    // period WITHOUT re-running a possibly-throwing clock: prefer the caller's window, else a safe
    // same-day window from the raw instant slice (string ops never throw).
    return projectWithEntitlements(
      emptyAggregate(period ?? safePeriodFromInstant(now)),
      entitlementInput,
    );
  }
}

/** A same-day fallback window from a raw ISO instant — string-only (never throws), for the degrade path. */
function safePeriodFromInstant(now: string): PipelinePeriod {
  const day = typeof now === "string" && now.length >= 10 ? now.slice(0, 10) : "1970-01-01";
  return { from: day, to: day };
}
