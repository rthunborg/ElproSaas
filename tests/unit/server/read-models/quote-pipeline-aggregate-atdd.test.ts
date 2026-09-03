/**
 * Story 10.5 ATDD RED scaffolds — guarded accepted-value aggregation.
 * The implementation replaces raw number addition with the canonical `sumOre` failure semantics.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateQuotePipeline,
  type PipelineEventRow,
  type PipelinePeriod,
} from "@/server/read-models/quote-pipeline-aggregate";

const PERIOD: PipelinePeriod = { from: "2026-07-01", to: "2026-07-31" };
const NOW = "2026-07-20T12:00:00.000Z";

test("[P0][10.5-UNIT-01] accepted commitments sum exactly at Number.MAX_SAFE_INTEGER", () => {
  const events: PipelineEventRow[] = [
    { quote_version_id: "max", event_type: "accepted", occurred_at: "2026-07-10T09:00:00.000Z" },
  ];

  const result = aggregateQuotePipeline(
    {
      events,
      acceptedVersions: [{ quote_version_id: "max", accepted_price_ore: Number.MAX_SAFE_INTEGER }],
      followUps: [],
    },
    PERIOD,
    NOW,
  );

  assert.equal(result.acceptedValueOre, Number.MAX_SAFE_INTEGER);
  assert.ok(Number.isSafeInteger(result.acceptedValueOre));
});

test("[P0][10.5-UNIT-02] overflow of accepted commitments fails closed and never returns rounded ore", () => {
  const events: PipelineEventRow[] = [
    { quote_version_id: "a", event_type: "accepted", occurred_at: "2026-07-10T09:00:00.000Z" },
    { quote_version_id: "b", event_type: "accepted", occurred_at: "2026-07-11T09:00:00.000Z" },
  ];

  assert.throws(
    () =>
      aggregateQuotePipeline(
        {
          events,
          acceptedVersions: [
            { quote_version_id: "a", accepted_price_ore: Number.MAX_SAFE_INTEGER },
            { quote_version_id: "b", accepted_price_ore: 1 },
          ],
          followUps: [],
        },
        PERIOD,
        NOW,
      ),
    /ORE_OVERFLOW|safe integer|overflow/i,
  );
});
