/**
 * Story 4.1 — 4.1-UNIT-07 (P3, EXPLORATORY, non-gating): a small property/round-trip check
 * over the presentation boundary. The calculation engine formats öre→kronor via
 * `@/lib/money` `formatOreAsKronor`; the pricing-UI seam parses kronor→öre via
 * `@/features/pricing/money-display` `kronorStringToOre`. For a representative valid öre
 * value, formatting then parsing must ROUND-TRIP back to the same integer öre — evidence
 * that the two directions agree on the Swedish comma-decimal encoding (one formatting
 * authority; no divergent second formatter). Also re-pins the `lineNetOre(1, x) === x`
 * identity from the engine side.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB. Exploratory: it guards the
 * boundary agreement, not a gating acceptance criterion.
 *
 * [Source: story Task 5.3; test-design-epic-4.md 4.1-UNIT-07 (property/round-trip; exploratory,
 *  not a gate); Task 4.2 (one öre→kronor formatting authority; byte-identical output).]
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatOreAsKronor, lineNetOre } from "@/lib/money";
import { kronorStringToOre, oreToKronorString } from "@/features/pricing/money-display";

describe("4.1-UNIT-07 — presentation-boundary round-trip (P3, exploratory)", () => {
  test("formatOreAsKronor ∘ kronorStringToOre round-trips a valid öre value", () => {
    for (const ore of [0, 1, 50, 99, 1250, 85000, 100000099, 12345678]) {
      const display = formatOreAsKronor(ore);
      const parsed = kronorStringToOre(display);
      assert.deepEqual(
        parsed,
        { ok: true, ore },
        `round-trip failed for ${ore} (formatted "${display}")`,
      );
    }
  });

  test("the engine formatter agrees byte-for-byte with the pricing-UI seam (one authority)", () => {
    // `oreToKronorString` (pricing-UI seam) now DELEGATES to `formatOreAsKronor` (the engine's
    // presentation boundary). Assert they emit the identical string across the öre domain the UI
    // may hand it — including the defensive negative / non-integer cases the existing edge suite
    // pins — so the single-formatting-authority consolidation cannot silently diverge.
    for (const ore of [0, 1, 1250, 85000, -1, -85000, 100000099, 1250.9, Number.NaN]) {
      assert.equal(
        oreToKronorString(ore),
        formatOreAsKronor(ore),
        `formatter divergence at ${ore}`,
      );
    }
  });

  test("lineNetOre(1, x) === x for representative valid öre x (engine-side identity)", () => {
    for (const x of [0, 1, 99, 85000, 12345678]) {
      const r = lineNetOre(1, x);
      assert.ok(r.ok, `expected ok for x=${x}`);
      if (r.ok) assert.equal(r.value, x, `identity failed for x=${x}`);
    }
  });
});
