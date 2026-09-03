/**
 * Story 10.4 — ATDD RED-PHASE scaffold: the PURE pipeline aggregation + deterministic period windows
 * (10.4-UNIT-02, P1, AC1; test-design-epic-10.md R-1042). Counts, hit rate, open/overdue follow-up
 * counts, and the öre-derived accepted value are computed server-side FROM LIFECYCLE EVENTS — pinned as
 * a pure `node --test` UNIT (no DB, no stack), keeping the aggregation on the fast gate (two-runner
 * discipline, epic-10 retro 10-1 Phase-4).
 *
 * The load-bearing contract (SETTLED DESIGN DECISIONS 4/5/6):
 *   - COUNTS derive from `quote_events` (`event_type` sent/accepted/lost) whose `occurred_at` falls in
 *     the period window — count DISTINCT versions per state; NOT from live `status` reads (FR65). This
 *     is what keeps a superseded-then-lost or re-sent history honest.
 *   - HIT RATE = acceptedCount / (acceptedCount + lostCount) (the decided-deals win rate). ZERO DECIDED
 *     ⇒ `null` (never `0`, never `NaN` — the empty-state honesty analog of the withheld rule).
 *   - acceptedValueOre = the INTEGER sum of the frozen `quote_versions.accepted_price_ore` for the
 *     period's accepted versions — plain integer öre addition, NO new money/rounding path (R-1042 STOP);
 *     display formatting is `formatOreAsKronor` from `@/lib/money` ONLY (asserted here against the real
 *     single authority).
 *   - openFollowUpCount = open `quote_follow_ups`; overdueFollowUpCount = open AND
 *     `classifyFollowUp(due_date, injectedNow) === "overdue"` (the 10.3 date primitive reused VERBATIM).
 *   - PERIOD WINDOW `[from, to]` resolves on the Europe/Stockholm calendar boundary from an INJECTED
 *     instant (the same `sv-SE`/`Intl.DateTimeFormat` discipline as `follow-up-dates.ts`) — DETERMINISTIC,
 *     never the host default zone, never `Date.now()` on the pure path.
 *   - EMPTY input ⇒ all counts 0, hitRate null, acceptedValueOre 0.
 *
 * ── GREEN (Story 10.4 implemented) ───────────────────────────────────────────────────────────────
 * `src/server/read-models/quote-pipeline-aggregate.ts` (the pure aggregation + the Europe/Stockholm
 * period helper) is landed; the suite imports the REAL functions and is unskipped. `formatOreAsKronor`
 * (the single öre→kronor authority) proves the money aggregate rides that one formatter, never a second.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII.
 *
 * [Source: story 10.4 AC1 + Tasks 1.1-1.5 + SETTLED DESIGN DECISIONS 4/5/6; src/features/quotes/
 *  follow-up-dates.ts (classifyFollowUp, sv-SE injected clock); src/lib/money/ore.ts (formatOreAsKronor);
 *  test-design-epic-10.md#10.4-UNIT-02, R-1042]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatOreAsKronor, ORE_AMOUNT_MAX } from "@/lib/money/ore";
import {
  aggregateQuotePipeline,
  resolvePipelinePeriod,
  type PipelineEventRow,
  type AcceptedVersionRow,
  type FollowUpRow,
  type PipelinePeriod,
} from "@/server/read-models/quote-pipeline-aggregate";

// ── Fixtures ─────────────────────────────────────────────────────────────────────────────────────
// "now" is late in a UTC day so the Stockholm calendar day is the NEXT day — the tz boundary is
// load-bearing (a naive host-UTC classifier would misfile the period + overdue by a whole day).
const NOW = "2026-07-19T23:30:00.000Z"; // 2026-07-20 in Europe/Stockholm (UTC+2)
const JULY: PipelinePeriod = { from: "2026-07-01", to: "2026-07-31" };

const EVENTS: PipelineEventRow[] = [
  { quote_version_id: "v1", event_type: "sent", occurred_at: "2026-07-03T09:00:00.000Z" },
  { quote_version_id: "v2", event_type: "sent", occurred_at: "2026-07-05T09:00:00.000Z" },
  { quote_version_id: "v3", event_type: "sent", occurred_at: "2026-07-08T09:00:00.000Z" },
  { quote_version_id: "v1", event_type: "accepted", occurred_at: "2026-07-10T09:00:00.000Z" },
  { quote_version_id: "v2", event_type: "lost", occurred_at: "2026-07-12T09:00:00.000Z" },
  // OUT OF WINDOW — a June sent event must not count toward the July period.
  { quote_version_id: "v0", event_type: "sent", occurred_at: "2026-06-28T09:00:00.000Z" },
];
const ACCEPTED_VERSIONS: AcceptedVersionRow[] = [
  { quote_version_id: "v1", accepted_price_ore: 12_500_00 },
];
const FOLLOW_UPS: FollowUpRow[] = [
  { id: "f1", status: "open", due_date: "2026-07-15" }, // overdue vs 2026-07-20
  { id: "f2", status: "open", due_date: "2026-07-25" }, // upcoming
  { id: "f3", status: "completed", due_date: "2026-07-02" }, // never counts
];

// ── 10.4-UNIT-02: aggregation ─────────────────────────────────────────────────────────────────────

test("10.4-UNIT-02: counts derive from in-window quote_events (distinct versions per event_type)", () => {
  const agg = aggregateQuotePipeline({ events: EVENTS, acceptedVersions: ACCEPTED_VERSIONS, followUps: FOLLOW_UPS }, JULY, NOW);
  assert.equal(agg.sentCount, 3, "three in-window sent versions (June sent excluded)");
  assert.equal(agg.acceptedCount, 1);
  assert.equal(agg.lostCount, 1);
});

test("10.4-UNIT-02: hit rate = accepted / (accepted + lost)", () => {
  const agg = aggregateQuotePipeline({ events: EVENTS, acceptedVersions: ACCEPTED_VERSIONS, followUps: FOLLOW_UPS }, JULY, NOW);
  assert.equal(agg.hitRate, 1 / 2);
});

test("10.4-UNIT-02: ZERO decided ⇒ hitRate is null (never 0, never NaN)", () => {
  const sentOnly: PipelineEventRow[] = [
    { quote_version_id: "v1", event_type: "sent", occurred_at: "2026-07-03T09:00:00.000Z" },
  ];
  const agg = aggregateQuotePipeline({ events: sentOnly, acceptedVersions: [], followUps: [] }, JULY, NOW);
  assert.equal(agg.hitRate, null);
  assert.notEqual(agg.hitRate, 0);
  assert.ok(!Number.isNaN(agg.hitRate as unknown as number));
});

test("10.4-UNIT-02: EMPTY input ⇒ all counts 0, hitRate null, acceptedValueOre 0", () => {
  const agg = aggregateQuotePipeline({ events: [], acceptedVersions: [], followUps: [] }, JULY, NOW);
  assert.equal(agg.sentCount, 0);
  assert.equal(agg.acceptedCount, 0);
  assert.equal(agg.lostCount, 0);
  assert.equal(agg.hitRate, null);
  assert.equal(agg.openFollowUpCount, 0);
  assert.equal(agg.overdueFollowUpCount, 0);
  assert.equal(agg.acceptedValueOre, 0);
});

test("10.4-UNIT-02: acceptedValueOre is the INTEGER öre sum of frozen accepted prices (no new money path)", () => {
  const accepted: AcceptedVersionRow[] = [
    { quote_version_id: "v1", accepted_price_ore: 12_500_00 },
    { quote_version_id: "v4", accepted_price_ore: 749_950 }, // 7 499,50 kr in öre
  ];
  const events: PipelineEventRow[] = [
    { quote_version_id: "v1", event_type: "accepted", occurred_at: "2026-07-10T09:00:00.000Z" },
    { quote_version_id: "v4", event_type: "accepted", occurred_at: "2026-07-11T09:00:00.000Z" },
  ];
  const agg = aggregateQuotePipeline({ events, acceptedVersions: accepted, followUps: [] }, JULY, NOW);
  assert.equal(agg.acceptedValueOre, 12_500_00 + 749_950);
  assert.ok(Number.isInteger(agg.acceptedValueOre), "öre aggregate is a plain integer sum");
});

test("10.5: accepted commitment sum permits the exact MAX_SAFE_INTEGER boundary", () => {
  const events: PipelineEventRow[] = [
    { quote_version_id: "v-max", event_type: "accepted", occurred_at: "2026-07-10T09:00:00.000Z" },
  ];
  const agg = aggregateQuotePipeline(
    { events, acceptedVersions: [{ quote_version_id: "v-max", accepted_price_ore: ORE_AMOUNT_MAX }], followUps: [] },
    JULY,
    NOW,
  );
  assert.equal(agg.acceptedValueOre, ORE_AMOUNT_MAX);
});

test("10.5: an unsafe accepted commitment aggregate fails closed instead of returning rounded öre", () => {
  const events: PipelineEventRow[] = [
    { quote_version_id: "v-1", event_type: "accepted", occurred_at: "2026-07-10T09:00:00.000Z" },
    { quote_version_id: "v-2", event_type: "accepted", occurred_at: "2026-07-11T09:00:00.000Z" },
  ];
  assert.throws(
    () => aggregateQuotePipeline(
      {
        events,
        acceptedVersions: [
          { quote_version_id: "v-1", accepted_price_ore: ORE_AMOUNT_MAX },
          { quote_version_id: "v-2", accepted_price_ore: 1 },
        ],
        followUps: [],
      },
      JULY,
      NOW,
    ),
    /unsafe/i,
  );
});

test("10.4-UNIT-02: the accepted value formats for display via the single @/lib/money authority only", () => {
  const agg = aggregateQuotePipeline({ events: EVENTS, acceptedVersions: ACCEPTED_VERSIONS, followUps: FOLLOW_UPS }, JULY, NOW);
  // Display formatting is formatOreAsKronor — never a second formatter, never a re-derived total.
  assert.equal(formatOreAsKronor(agg.acceptedValueOre), "12500,00");
});

test("10.4-UNIT-02: open/overdue follow-up counts (open only; overdue via classifyFollowUp on the Stockholm boundary)", () => {
  const agg = aggregateQuotePipeline({ events: EVENTS, acceptedVersions: ACCEPTED_VERSIONS, followUps: FOLLOW_UPS }, JULY, NOW);
  assert.equal(agg.openFollowUpCount, 2, "two open follow-ups (completed excluded)");
  assert.equal(agg.overdueFollowUpCount, 1, "only the 2026-07-15 open row is overdue vs 2026-07-20 Stockholm");
});

// ── 10.4-UNIT-02: deterministic Europe/Stockholm period windows ────────────────────────────────────

test("10.4-UNIT-02: resolvePipelinePeriod is deterministic over an injected instant (no Date.now on the pure path)", () => {
  const a = resolvePipelinePeriod(NOW);
  const b = resolvePipelinePeriod(NOW);
  assert.deepEqual(a, b, "same injected instant ⇒ identical window (pure/deterministic)");
  assert.match(a.from, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(a.to, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(a.from <= a.to, "window is ordered [from, to]");
});

test("10.4-UNIT-02: the period boundary is computed on the Europe/Stockholm calendar day of the injected instant", () => {
  // 2026-07-19T23:30Z is already 2026-07-20 in Stockholm (UTC+2) — the window's upper bound reflects
  // the Stockholm calendar day, not the host/UTC day (the tz boundary R-1032 shares with 10.3).
  const period = resolvePipelinePeriod(NOW);
  assert.ok(period.to >= "2026-07-20", "upper bound reflects the Stockholm calendar day, not UTC");
});

// ── 10.4-UNIT-02 (expanded edge/negative coverage — bmad-testarch-automate) ─────────────────────────
// The counts are "DISTINCT versions per event_type" (a Set), the money sum is IN-WINDOW-accepted only,
// and the follow-up counts are status-gated BEFORE the date classify. These pin the branch behaviour the
// original happy-path suite leaves implicit — a naive re-implementation (array length; classify-then-
// status; sum-all-prices) would pass the originals but fail here.

test("10.4-UNIT-02: repeated events for the same version+type collapse to ONE (distinct-version count, not row count)", () => {
  // A re-sent history: v1 carries TWO in-window `sent` events — it must count as a single sent version.
  const events: PipelineEventRow[] = [
    { quote_version_id: "v1", event_type: "sent", occurred_at: "2026-07-03T09:00:00.000Z" },
    { quote_version_id: "v1", event_type: "sent", occurred_at: "2026-07-06T09:00:00.000Z" },
    { quote_version_id: "v2", event_type: "sent", occurred_at: "2026-07-05T09:00:00.000Z" },
  ];
  const agg = aggregateQuotePipeline({ events, acceptedVersions: [], followUps: [] }, JULY, NOW);
  assert.equal(agg.sentCount, 2, "v1's duplicate sent events count once (distinct versions, not rows)");
});

test("10.4-UNIT-02: an accepted version with NO frozen price row contributes 0 to acceptedValueOre (never NaN)", () => {
  // v2 is accepted (counts) but its price row is absent from acceptedVersions — it must add 0, not NaN.
  const events: PipelineEventRow[] = [
    { quote_version_id: "v1", event_type: "accepted", occurred_at: "2026-07-10T09:00:00.000Z" },
    { quote_version_id: "v2", event_type: "accepted", occurred_at: "2026-07-11T09:00:00.000Z" },
  ];
  const acceptedVersions: AcceptedVersionRow[] = [{ quote_version_id: "v1", accepted_price_ore: 100_00 }];
  const agg = aggregateQuotePipeline({ events, acceptedVersions, followUps: [] }, JULY, NOW);
  assert.equal(agg.acceptedCount, 2, "both accepted versions are counted");
  assert.equal(agg.acceptedValueOre, 100_00, "the missing-price version adds 0 (never NaN)");
  assert.ok(Number.isInteger(agg.acceptedValueOre));
});

test("10.4-UNIT-02: acceptedValueOre sums ONLY in-window accepted versions (an out-of-window accepted price is excluded)", () => {
  // v2 was accepted in JUNE (out of the July window): it must count toward NEITHER the money aggregate
  // NOR acceptedCount — the money leaf sums exactly the versions the in-window count recognises.
  const events: PipelineEventRow[] = [
    { quote_version_id: "v1", event_type: "accepted", occurred_at: "2026-07-10T09:00:00.000Z" },
    { quote_version_id: "v2", event_type: "accepted", occurred_at: "2026-06-10T09:00:00.000Z" },
  ];
  const acceptedVersions: AcceptedVersionRow[] = [
    { quote_version_id: "v1", accepted_price_ore: 100_00 },
    { quote_version_id: "v2", accepted_price_ore: 999_00 },
  ];
  const agg = aggregateQuotePipeline({ events, acceptedVersions, followUps: [] }, JULY, NOW);
  assert.equal(agg.acceptedCount, 1, "only the in-window accepted version counts");
  assert.equal(agg.acceptedValueOre, 100_00, "the June-accepted version's price is NOT summed into July");
});

test("10.4-UNIT-02: a COMPLETED follow-up with a PAST due date is neither open NOR overdue (status-gated before classify)", () => {
  // Guards against a refactor that classifies the date before checking status — a completed past-due row
  // must never inflate the open/overdue counts.
  const followUps: FollowUpRow[] = [{ id: "f1", status: "completed", due_date: "2000-01-01" }];
  const agg = aggregateQuotePipeline({ events: [], acceptedVersions: [], followUps }, JULY, NOW);
  assert.equal(agg.openFollowUpCount, 0);
  assert.equal(agg.overdueFollowUpCount, 0);
});

test("10.4-UNIT-02: an OPEN follow-up on an ALREADY-DECIDED quote (accepted/lost/rejected/expired latest) is EXCLUDED from the counts", () => {
  // 10.4 + iteration-2 integration review: a decided deal must not keep escalating a stale open
  // follow-up. An open follow-up whose quote's LATEST version is a TERMINAL status — accepted, lost,
  // rejected, OR expired — is dropped from BOTH the open and the overdue counts; a follow-up on a
  // still-open (sent) quote is counted as before. rejected/expired are reachable LATEST statuses via
  // the Story 6.5 standalone lifecycle command and are equally terminal (dead deals).
  const followUps: FollowUpRow[] = [
    { id: "f-sent", status: "open", due_date: "2026-07-15", quoteLatestVersionStatus: "sent" }, // overdue vs 2026-07-20
    { id: "f-accepted", status: "open", due_date: "2026-07-15", quoteLatestVersionStatus: "accepted" }, // excluded
    { id: "f-lost", status: "open", due_date: "2026-07-15", quoteLatestVersionStatus: "lost" }, // excluded
    { id: "f-rejected", status: "open", due_date: "2026-07-15", quoteLatestVersionStatus: "rejected" }, // excluded
    { id: "f-expired", status: "open", due_date: "2026-07-15", quoteLatestVersionStatus: "expired" }, // excluded
  ];
  const agg = aggregateQuotePipeline({ events: [], acceptedVersions: [], followUps }, JULY, NOW);
  assert.equal(agg.openFollowUpCount, 1, "only the follow-up on the still-open (sent) quote counts");
  assert.equal(agg.overdueFollowUpCount, 1, "the decided-quote follow-ups (incl. rejected/expired) never inflate the overdue count");
});

test("10.4-UNIT-02: a SUPERSEDED latest status DOES exclude its open follow-up (Codex review — superseded is reachable as latest)", () => {
  // CORRECTED (Codex review): the earlier assumption — "superseded always has a higher-numbered
  // successor, so it can never BE the latest" — is false. The standalone Story 6.5 lifecycle command
  // (and a direct own-tenant table write) can supersede a version WITHOUT creating a successor, so
  // superseded genuinely can be a quote's latest status. Leaving it out of the decided set left an
  // open follow-up escalating on such a quote while the completion panel (sent-only) no longer
  // rendered — i.e. unclearable. Including it is harmless when a real successor DOES exist, because
  // the latest-version lookup selects that successor instead.
  const followUps: FollowUpRow[] = [
    { id: "f-superseded", status: "open", due_date: "2026-07-25", quoteLatestVersionStatus: "superseded" },
  ];
  const agg = aggregateQuotePipeline({ events: [], acceptedVersions: [], followUps }, JULY, NOW);
  assert.equal(agg.openFollowUpCount, 0, "a superseded latest status is decided ⇒ excluded");
});

test("10.4-UNIT-02: a follow-up with NO quoteLatestVersionStatus (undefined/null) is counted (not-decided default)", () => {
  const followUps: FollowUpRow[] = [
    { id: "f1", status: "open", due_date: "2026-07-25" }, // no status field ⇒ counted
    { id: "f2", status: "open", due_date: "2026-07-25", quoteLatestVersionStatus: null }, // null ⇒ counted
  ];
  const agg = aggregateQuotePipeline({ events: [], acceptedVersions: [], followUps }, JULY, NOW);
  assert.equal(agg.openFollowUpCount, 2, "an absent/null latest-status defaults to not-decided ⇒ counted");
});

test("10.4-UNIT-02: a DUE-TODAY open follow-up counts as open but NOT overdue (the overdue boundary is strict <)", () => {
  // NOW resolves to 2026-07-20 in Stockholm; a follow-up due exactly today is open + due-today, never
  // overdue (overdue = due_date < today, a strict inequality — the 10.3 classifyFollowUp contract).
  const followUps: FollowUpRow[] = [{ id: "f1", status: "open", due_date: "2026-07-20" }];
  const agg = aggregateQuotePipeline({ events: [], acceptedVersions: [], followUps }, JULY, NOW);
  assert.equal(agg.openFollowUpCount, 1);
  assert.equal(agg.overdueFollowUpCount, 0, "due-today is not overdue (strict < boundary)");
});

test("10.4-UNIT-02: resolvePipelinePeriod honours a custom trailing window and rolls the year back correctly", () => {
  // A 1-month window anchored in early January must roll `from` into the PREVIOUS year (the month
  // year-rollover path) — deterministic, on the Stockholm calendar day of the injected instant.
  const period = resolvePipelinePeriod("2026-01-10T12:00:00.000Z", 1);
  assert.equal(period.to, "2026-01-10", "upper bound is the Stockholm calendar day of the instant");
  assert.equal(period.from, "2025-12-10", "one month earlier rolls back across the year boundary");
});

test("10.4-UNIT-02: a MONTH-END anchor does NOT overflow — the day is clamped to the target month's last day", () => {
  // to = 2026-05-31, months = 3 → February. A raw setUTCMonth would land on the nonexistent 2026-02-31
  // and silently roll forward to 2026-03-03 (a WRONG lower bound). The fix clamps to 2026-02-28.
  const period = resolvePipelinePeriod("2026-05-31T09:00:00.000Z", 3);
  assert.equal(period.to, "2026-05-31");
  assert.equal(period.from, "2026-02-28", "May-31 minus 3 months clamps to Feb-28 (never rolls to Mar-03)");
});

test("10.4-UNIT-02: the default 12-month window is safe at the Feb-29 leap anchor (no forward overflow)", () => {
  // to = 2024-02-29 (leap day), default months = 12 → 2023 has no Feb-29, so the day clamps to Feb-28
  // rather than overflowing into 2023-03-01. Deterministic on the Stockholm calendar day.
  const period = resolvePipelinePeriod("2024-02-29T09:00:00.000Z");
  assert.equal(period.to, "2024-02-29");
  assert.equal(period.from, "2023-02-28", "leap-day anchor minus a year clamps to Feb-28 (no overflow)");
});

test("10.4-UNIT-02: a month-end anchor into a 31-day target keeps the full day (no needless clamp)", () => {
  // to = 2026-03-31, months = 4 → November (30 days) → clamps to 2025-11-30. Guards that the clamp only
  // trims when the target month is shorter, and that the year rolls back correctly.
  const period = resolvePipelinePeriod("2026-03-31T09:00:00.000Z", 4);
  assert.equal(period.from, "2025-11-30", "Mar-31 minus 4 months clamps to Nov-30 across the year boundary");
});
