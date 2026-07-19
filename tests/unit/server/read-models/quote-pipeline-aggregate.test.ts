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
 * ── WHY SKIPPED (RED PHASE) ──────────────────────────────────────────────────────────────────────
 * `src/server/read-models/quote-pipeline-aggregate.ts` (the pure aggregation) does NOT exist yet
 * (Task 1 is the Story 10.4 DEV phase). The scaffold declares the intended surface via LOCAL
 * `notYetImplemented()` placeholders + local row/aggregate types so it TYPE-CHECKS today WITHOUT
 * importing a non-existent module, and keeps every `test(...)` `{ skip: true }`. `formatOreAsKronor`
 * IS imported (it exists today — the single öre→kronor authority) to prove the money aggregate rides
 * that one formatter, never a second.
 *
 * ── GREEN-PHASE HAND-OFF (Story 10.4 dev) ────────────────────────────────────────────────────────
 * After Task 1 lands:
 *   1. Delete the LOCAL placeholder + local types, replacing with real imports:
 *        import { aggregateQuotePipeline, resolvePipelinePeriod } from "@/server/read-models/quote-pipeline-aggregate";
 *        import type { PipelineEventRow, AcceptedVersionRow, FollowUpRow } from "@/server/read-models/quote-pipeline-aggregate";
 *      (If the period helper lands in `src/features/quotes/pipeline-period.ts`, import it from there.)
 *   2. Remove `{ skip: true }` from every test. The assertions are the CONTRACT — do NOT weaken them.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII.
 *
 * [Source: story 10.4 AC1 + Tasks 1.1-1.5 + SETTLED DESIGN DECISIONS 4/5/6; src/features/quotes/
 *  follow-up-dates.ts (classifyFollowUp, sv-SE injected clock); src/lib/money/ore.ts (formatOreAsKronor);
 *  test-design-epic-10.md#10.4-UNIT-02, R-1042]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatOreAsKronor } from "@/lib/money/ore";

// ── LOCAL red-phase declarations (green phase replaces with real imports; see hand-off) ──────────
function notYetImplemented(): never {
  throw new Error(
    "Story 10.4 not yet implemented — remove this placeholder and import aggregateQuotePipeline / " +
      "resolvePipelinePeriod from @/server/read-models/quote-pipeline-aggregate in the green phase.",
  );
}

/** A lifecycle event row (RLS-scoped) — the count source of truth (never the live status). */
interface PipelineEventRow {
  readonly quote_version_id: string;
  readonly event_type: "sent" | "accepted" | "lost";
  readonly occurred_at: string;
}
/** An accepted version's frozen accepted price (öre) — the money aggregate source. */
interface AcceptedVersionRow {
  readonly quote_version_id: string;
  readonly accepted_price_ore: number;
}
/** A follow-up row — open/overdue count source (10.3 shape). */
interface FollowUpRow {
  readonly id: string;
  readonly status: "open" | "completed";
  readonly due_date: string;
}
interface PipelinePeriod {
  readonly from: string;
  readonly to: string;
}
interface PipelineAggregate {
  readonly period: PipelinePeriod;
  readonly sentCount: number;
  readonly acceptedCount: number;
  readonly lostCount: number;
  readonly hitRate: number | null;
  readonly openFollowUpCount: number;
  readonly overdueFollowUpCount: number;
  readonly acceptedValueOre: number;
}
interface AggregateInput {
  readonly events: readonly PipelineEventRow[];
  readonly acceptedVersions: readonly AcceptedVersionRow[];
  readonly followUps: readonly FollowUpRow[];
}

// Green phase: import the real pure functions (see hand-off).
function aggregateQuotePipeline(
  input: AggregateInput,
  period: PipelinePeriod,
  now: string,
): PipelineAggregate {
  void input;
  void period;
  void now;
  return notYetImplemented();
}
function resolvePipelinePeriod(instant: string, months?: number): PipelinePeriod {
  void instant;
  void months;
  return notYetImplemented();
}

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

test("10.4-UNIT-02: counts derive from in-window quote_events (distinct versions per event_type)", { skip: true }, () => {
  const agg = aggregateQuotePipeline({ events: EVENTS, acceptedVersions: ACCEPTED_VERSIONS, followUps: FOLLOW_UPS }, JULY, NOW);
  assert.equal(agg.sentCount, 3, "three in-window sent versions (June sent excluded)");
  assert.equal(agg.acceptedCount, 1);
  assert.equal(agg.lostCount, 1);
});

test("10.4-UNIT-02: hit rate = accepted / (accepted + lost)", { skip: true }, () => {
  const agg = aggregateQuotePipeline({ events: EVENTS, acceptedVersions: ACCEPTED_VERSIONS, followUps: FOLLOW_UPS }, JULY, NOW);
  assert.equal(agg.hitRate, 1 / 2);
});

test("10.4-UNIT-02: ZERO decided ⇒ hitRate is null (never 0, never NaN)", { skip: true }, () => {
  const sentOnly: PipelineEventRow[] = [
    { quote_version_id: "v1", event_type: "sent", occurred_at: "2026-07-03T09:00:00.000Z" },
  ];
  const agg = aggregateQuotePipeline({ events: sentOnly, acceptedVersions: [], followUps: [] }, JULY, NOW);
  assert.equal(agg.hitRate, null);
  assert.notEqual(agg.hitRate, 0);
  assert.ok(!Number.isNaN(agg.hitRate as unknown as number));
});

test("10.4-UNIT-02: EMPTY input ⇒ all counts 0, hitRate null, acceptedValueOre 0", { skip: true }, () => {
  const agg = aggregateQuotePipeline({ events: [], acceptedVersions: [], followUps: [] }, JULY, NOW);
  assert.equal(agg.sentCount, 0);
  assert.equal(agg.acceptedCount, 0);
  assert.equal(agg.lostCount, 0);
  assert.equal(agg.hitRate, null);
  assert.equal(agg.openFollowUpCount, 0);
  assert.equal(agg.overdueFollowUpCount, 0);
  assert.equal(agg.acceptedValueOre, 0);
});

test("10.4-UNIT-02: acceptedValueOre is the INTEGER öre sum of frozen accepted prices (no new money path)", { skip: true }, () => {
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

test("10.4-UNIT-02: the accepted value formats for display via the single @/lib/money authority only", { skip: true }, () => {
  const agg = aggregateQuotePipeline({ events: EVENTS, acceptedVersions: ACCEPTED_VERSIONS, followUps: FOLLOW_UPS }, JULY, NOW);
  // Display formatting is formatOreAsKronor — never a second formatter, never a re-derived total.
  assert.equal(formatOreAsKronor(agg.acceptedValueOre), "12500,00");
});

test("10.4-UNIT-02: open/overdue follow-up counts (open only; overdue via classifyFollowUp on the Stockholm boundary)", { skip: true }, () => {
  const agg = aggregateQuotePipeline({ events: EVENTS, acceptedVersions: ACCEPTED_VERSIONS, followUps: FOLLOW_UPS }, JULY, NOW);
  assert.equal(agg.openFollowUpCount, 2, "two open follow-ups (completed excluded)");
  assert.equal(agg.overdueFollowUpCount, 1, "only the 2026-07-15 open row is overdue vs 2026-07-20 Stockholm");
});

// ── 10.4-UNIT-02: deterministic Europe/Stockholm period windows ────────────────────────────────────

test("10.4-UNIT-02: resolvePipelinePeriod is deterministic over an injected instant (no Date.now on the pure path)", { skip: true }, () => {
  const a = resolvePipelinePeriod(NOW);
  const b = resolvePipelinePeriod(NOW);
  assert.deepEqual(a, b, "same injected instant ⇒ identical window (pure/deterministic)");
  assert.match(a.from, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(a.to, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(a.from <= a.to, "window is ordered [from, to]");
});

test("10.4-UNIT-02: the period boundary is computed on the Europe/Stockholm calendar day of the injected instant", { skip: true }, () => {
  // 2026-07-19T23:30Z is already 2026-07-20 in Stockholm (UTC+2) — the window's upper bound reflects
  // the Stockholm calendar day, not the host/UTC day (the tz boundary R-1032 shares with 10.3).
  const period = resolvePipelinePeriod(NOW);
  assert.ok(period.to >= "2026-07-20", "upper bound reflects the Stockholm calendar day, not UTC");
});
