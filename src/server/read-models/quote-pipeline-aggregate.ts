/**
 * Story 10.4 — the PURE quote-pipeline aggregation + deterministic Europe/Stockholm period windows
 * (Task 1; AC1; SETTLED DESIGN DECISIONS 4/5/6). This is the DB-free core beneath the first
 * `src/server/read-models` module: given the already-read rows (lifecycle events + accepted-version
 * öre + follow-up rows) and a resolved period window, it computes the full (pre-entitlement) aggregate.
 *
 * Keeping the aggregation PURE (no DB, no clock read on the classification path) is deliberate: the
 * contract is pinned by `node --test` UNIT (10.4-UNIT-02) on the fast gate — never Playwright — while
 * the thin query/isolation layer is proven separately at INT (the epic-9/10 "extract pure logic to the
 * fast unit gate" lesson; two-runner discipline).
 *
 * ── COUNTS ARE EVENT-SOURCED (FR65; SETTLED DECISION 4) ──────────────────────────────────────────
 * sent/accepted/lost counts = the number of DISTINCT versions carrying an in-window `quote_events`
 * row of the respective `event_type`, whose `occurred_at` falls inside the period window (on the
 * Stockholm calendar boundary). Deriving from EVENTS (not the live `status`) is what keeps a
 * superseded-then-lost or re-sent history honest.
 *
 * ── HIT RATE = accepted / (accepted + lost) (SETTLED DECISION 4) ─────────────────────────────────
 * The decided-deals win rate. ZERO decided (accepted + lost === 0) ⇒ `null` (never `0`, never `NaN` —
 * the empty-state honesty analog of the withheld rule). FR65 does not pin the denominator; this
 * `accepted / (accepted + lost)` assumption is carried in the story completion notes for E19/owner.
 *
 * ── MONEY = öre-derived integer SUM of EXISTING frozen values (SETTLED DECISION 5; R-1042 STOP) ──
 * `acceptedValueOre` = the plain INTEGER öre sum of the frozen `quote_acceptances.accepted_price_ore`
 * (the ACCEPTED commitment — what the customer actually accepted, already frozen integer öre; captured
 * at an ADJUSTED price where the acceptance adjusted the sent total) for the period's accepted versions.
 * NOT `quote_versions.accepted_price_ore` — that column is the frozen SOURCE SENT total the adjusted-
 * price delta is measured against (quote-db.ts), so summing it would report the QUOTED amount, not the
 * ACCEPTED amount (10.4 integration review, Decision reconciling SETTLED DECISION 5). NO new
 * money/VAT/ROT/rounding path — just integer addition of ALREADY-computed frozen öre. Any display
 * formatting uses `formatOreAsKronor` (`@/lib/money`) ONLY.
 *
 * ── PERIOD WINDOW + OVERDUE reuse the 10.3 date discipline (SETTLED DECISION 6) ──────────────────
 * The window `[from, to]` resolves on the Europe/Stockholm calendar boundary from an INJECTED instant
 * via the SAME `sv-SE` formatter (`calendarDayIn`) as `follow-up-dates.ts` — deterministic, never the
 * host default zone, never `Date.now()` on the pure path. Overdue follow-up counting calls
 * `classifyFollowUp` VERBATIM (do NOT fork the date logic).
 *
 * [Source: story 10.4 AC1 + Tasks 1.1-1.5 + SETTLED DESIGN DECISIONS 4/5/6; src/features/quotes/
 *  follow-up-dates.ts (classifyFollowUp, calendarDayIn); src/lib/money/ore.ts (formatOreAsKronor);
 *  test-design-epic-10.md#10.4-UNIT-02, R-1042]
 */
import { classifyFollowUp, calendarDayIn } from "@/features/quotes/follow-up-dates";
import { isLatestDecidedStatus } from "@/features/quotes/terminal-status";

/** The Europe/Stockholm zone — the ONE tz the whole pipeline period + overdue boundary reasons on. */
const STOCKHOLM_TZ = "Europe/Stockholm";

/**
 * A lifecycle event row (RLS-scoped, read by the query layer) — the count source of truth. `sent` /
 * `accepted` / `lost` are the three lifecycle event types the pipeline counts (other event types are
 * ignored by the caller's select). `occurred_at` is a timestamptz ISO string.
 */
export interface PipelineEventRow {
  readonly quote_version_id: string;
  readonly event_type: "sent" | "accepted" | "lost";
  readonly occurred_at: string;
}

/**
 * An accepted version's FROZEN ACCEPTED price (integer öre) — the money aggregate source. Sourced from
 * `quote_acceptances.accepted_price_ore` (the accepted commitment, adjusted-price-aware), NOT the
 * version's frozen sent total (10.4 integration review).
 */
export interface AcceptedVersionRow {
  readonly quote_version_id: string;
  readonly accepted_price_ore: number;
}

/**
 * A follow-up row — the open/overdue count source (the 10.3 shape; `due_date` is a YYYY-MM-DD date).
 * `quoteLatestVersionStatus` is the status of the follow-up's quote's LATEST version: an OPEN follow-up
 * whose quote has already been DECIDED (its latest version is a terminal status — `accepted`/`lost`/
 * `rejected`/`expired`) is EXCLUDED from the open/overdue counts (10.4 integration review — a decided
 * quote must not keep escalating a stale follow-up). Absent/null ⇒ not decided ⇒ counted (the query
 * layer supplies it).
 */
export interface FollowUpRow {
  readonly id: string;
  readonly status: "open" | "completed";
  readonly due_date: string;
  readonly quoteLatestVersionStatus?: string | null;
}


/** The resolved period window — inclusive `[from, to]` YYYY-MM-DD Europe/Stockholm calendar dates. */
export interface PipelinePeriod {
  readonly from: string;
  readonly to: string;
}

/** The full (pre-entitlement) pipeline aggregate — counts/rate/follow-up counts + the öre money leaf. */
export interface PipelineAggregate {
  readonly period: PipelinePeriod;
  readonly sentCount: number;
  readonly acceptedCount: number;
  readonly lostCount: number;
  /** accepted / (accepted + lost); zero-decided ⇒ null (never 0/NaN). */
  readonly hitRate: number | null;
  readonly openFollowUpCount: number;
  readonly overdueFollowUpCount: number;
  /** The öre-derived accepted value (integer sum of frozen accepted prices) — the money leaf. */
  readonly acceptedValueOre: number;
}

/** The already-read rows the pure aggregation folds into a `PipelineAggregate`. */
export interface AggregateInput {
  readonly events: readonly PipelineEventRow[];
  readonly acceptedVersions: readonly AcceptedVersionRow[];
  readonly followUps: readonly FollowUpRow[];
}

/** Two-digit zero-pad for the YYYY-MM-DD assembly (never a locale-formatted string). */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Is `occurredAt` inside the period window, judged on the Europe/Stockholm calendar day? The event's
 * instant is folded to its Stockholm calendar day (the SAME sv-SE discipline as the follow-up dates),
 * then compared as YYYY-MM-DD strings (lexicographic = calendar-correct) against the inclusive window.
 */
function isInWindow(occurredAt: string, period: PipelinePeriod): boolean {
  const day = calendarDayIn(occurredAt, STOCKHOLM_TZ);
  return day >= period.from && day <= period.to;
}

/**
 * Fold the already-read rows into the full pipeline aggregate. Counts derive from the in-window
 * lifecycle events (DISTINCT versions per `event_type`); the money aggregate sums the frozen accepted
 * prices of the in-window accepted versions; open/overdue counts derive from the follow-up rows on the
 * Stockholm boundary from the injected `now`. PURE + deterministic over its inputs.
 */
export function aggregateQuotePipeline(
  input: AggregateInput,
  period: PipelinePeriod,
  now: Date | string,
): PipelineAggregate {
  // ── Event-sourced counts: distinct versions per in-window event_type (never the live status). ──
  const sentVersions = new Set<string>();
  const acceptedVersions = new Set<string>();
  const lostVersions = new Set<string>();
  for (const e of input.events) {
    if (!isInWindow(e.occurred_at, period)) continue;
    if (e.event_type === "sent") sentVersions.add(e.quote_version_id);
    else if (e.event_type === "accepted") acceptedVersions.add(e.quote_version_id);
    else if (e.event_type === "lost") lostVersions.add(e.quote_version_id);
  }
  const sentCount = sentVersions.size;
  const acceptedCount = acceptedVersions.size;
  const lostCount = lostVersions.size;

  // ── Hit rate: decided-deals win rate. Zero decided ⇒ null (never 0/NaN). ──
  const decided = acceptedCount + lostCount;
  const hitRate = decided === 0 ? null : acceptedCount / decided;

  // ── Money: INTEGER öre sum of the frozen accepted_price_ore for the in-window accepted versions. ──
  // A plain integer addition of EXISTING frozen values — NO new money/rounding path (R-1042 STOP).
  const priceByVersion = new Map<string, number>();
  for (const v of input.acceptedVersions) {
    priceByVersion.set(v.quote_version_id, v.accepted_price_ore);
  }
  let acceptedValueOre = 0;
  for (const versionId of acceptedVersions) {
    acceptedValueOre += priceByVersion.get(versionId) ?? 0;
  }

  // ── Follow-up counts: open only, AND the follow-up's quote is NOT already decided (its latest
  // version is not a terminal status: accepted/lost/rejected/expired) — a decided quote's stale open
  // follow-up must not inflate the open/overdue counts (10.4 + iteration-2 integration review).
  // overdue = counted AND classifyFollowUp === "overdue".
  let openFollowUpCount = 0;
  let overdueFollowUpCount = 0;
  for (const f of input.followUps) {
    if (f.status !== "open") continue;
    if (isLatestDecidedStatus(f.quoteLatestVersionStatus)) continue;
    openFollowUpCount += 1;
    if (classifyFollowUp(f.due_date, now) === "overdue") overdueFollowUpCount += 1;
  }

  return {
    period,
    sentCount,
    acceptedCount,
    lostCount,
    hitRate,
    openFollowUpCount,
    overdueFollowUpCount,
    acceptedValueOre,
  };
}

/**
 * Resolve the pipeline period `[from, to]` on the Europe/Stockholm calendar boundary from an INJECTED
 * instant. `to` is "today in Stockholm"; `from` is `months` calendar months earlier (default 12 — a
 * trailing-year window). DETERMINISTIC over the injected instant: the Stockholm day is derived via the
 * shared `calendarDayIn` (sv-SE) discipline, then the lower bound is pure calendar month math —
 * never `Date.now()`, never the host default zone (SETTLED DESIGN DECISION 6).
 *
 * Month subtraction CLAMPS the day to the target month's last valid day, so a month-end/leap anchor
 * never OVERFLOWS forward (e.g. `to = 2026-05-31`, `months = 3` ⇒ `from = 2026-02-28`, never a rolled
 * `2026-03-03`; `to = 2024-02-29`, `months = 12` ⇒ `from = 2023-02-28`). A raw `Date.setUTCMonth` on a
 * day-31 anchor would land on a nonexistent day and silently roll into the next month — a wrong lower
 * bound that skews the window.
 *
 * When the DB read-model is called WITHOUT an explicit period, this default window is used; callers
 * that need a specific window (E19 widgets later) pass their own `PipelinePeriod`.
 */
export function resolvePipelinePeriod(
  instant: Date | string,
  months: number = 12,
): PipelinePeriod {
  const to = calendarDayIn(instant, STOCKHOLM_TZ);
  const [y, m, d] = to.split("-").map(Number);
  // Subtract `months` on the calendar WITHOUT day overflow: compute the target year+month, then clamp
  // the day to that month's last valid day (Date.UTC(year, month+1, 0) = the month's final day). This
  // keeps a month-end/leap anchor on the intended boundary instead of rolling it forward.
  const zeroBasedMonth = m - 1 - months;
  const targetYear = y + Math.floor(zeroBasedMonth / 12);
  const targetMonth = ((zeroBasedMonth % 12) + 12) % 12; // normalise to 0..11
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDayOfTargetMonth);
  const from = `${targetYear}-${pad2(targetMonth + 1)}-${pad2(day)}`;
  return { from, to };
}
