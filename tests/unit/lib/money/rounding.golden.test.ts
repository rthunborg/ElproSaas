/**
 * Story 4.1 — GOLDEN rounding-mode PIN (4.1-GOLDEN-01, R-402). This is the LOAD-BEARING
 * policy assertion: the half-rounding mode is ROUND-HALF-AWAY-FROM-ZERO (line-level;
 * totals sum-of-rounded), and it is pinned so an accidental flip to half-to-even
 * (banker's) FAILS LOUD. Each fixture case carries an `origin` label; the `.5`-boundary
 * cases record the DIFFERENT value banker's rounding would produce, and this test asserts
 * the engine yields the half-up value and NOT the banker's value.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB. Fixture:
 * tests/fixtures/golden/money/rounding-mode.json (anonymized; money numbers only, NFR17).
 *
 * 🔴 RED PHASE — `@/lib/money` does NOT exist yet; the existence gate SKIPS the suite so
 * the green `test:unit` baseline is UNPERTURBED. The dev's GREEN phase DELETES the gate,
 * switches to a top-level `import { lineNetOre, sumOre } from "@/lib/money"`, and leaves
 * the assertions (the pinned expected values) UNCHANGED.
 *
 * POLICY STATUS: this rounding policy is a CONSERVATIVE PILOT ASSUMPTION pending
 * owner/accounting sign-off (architecture.md#10; test-design-epic-4 Sign-Off Q1). It is
 * recorded as an assumption — NOT hard-coded as accounting-final. STOP (needs-human) if
 * accounting requires DOCUMENT-LEVEL rounding instead of line-level.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as money from "@/lib/money";

// ── GREEN PHASE (Story 4.1 dev) ──────────────────────────────────────────────────
// `@/lib/money` now exists, so the engine is imported at the top level and the golden suite
// runs unconditionally. The red-phase existence gate was removed; the pinned expected values
// (the load-bearing rounding-mode policy) are UNCHANGED.

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = resolve(HERE, "../../../fixtures/golden/money");

interface LineNetCase {
  readonly id: string;
  readonly origin: "new-expected" | "documented-delta";
  readonly note: string;
  readonly quantity: number;
  readonly unitPriceOre: number;
  readonly expectedLineNetOre: number;
  readonly bankersWouldGive: number;
}
interface SumCase {
  readonly id: string;
  readonly origin: string;
  readonly note: string;
  readonly lines: ReadonlyArray<{ quantity: number; unitPriceOre: number }>;
  readonly expectedSumOfRoundedOre: number;
  readonly roundOfSumWouldGive: number;
}
interface RoundingFixture {
  readonly policy: {
    readonly level: string;
    readonly halfRoundingMode: string;
    readonly totals: string;
  };
  readonly lineNetCases: readonly LineNetCase[];
  readonly sumOfRoundedCase: SumCase;
}

function loadFixture(): RoundingFixture {
  return JSON.parse(readFileSync(resolve(GOLDEN_DIR, "rounding-mode.json"), "utf8")) as RoundingFixture;
}

type OkLike = { ok: true } & Record<string, unknown>;
function isOk(r: unknown): r is OkLike {
  return typeof r === "object" && r !== null && (r as { ok?: unknown }).ok === true;
}
function okOre(r: OkLike): number {
  const v = r.value ?? r.ore ?? r.data;
  assert.equal(typeof v, "number");
  return v as number;
}

type MoneyEngine = {
  lineNetOre: (quantity: number, unitPriceOre: number) => OkLike | { ok: false };
  sumOre: (values: readonly number[]) => OkLike | { ok: false };
};

// The engine is imported at the top level; `loadEngine()` stays a trivial async accessor so
// the assertions below (which `await loadEngine()`) remain UNCHANGED from the red scaffold.
async function loadEngine(): Promise<MoneyEngine> {
  return money as unknown as MoneyEngine;
}

describe("Story 4.1 — GOLDEN rounding-mode pin (4.1-GOLDEN-01, R-402)", () => {
  test("the fixture pins the conservative pilot policy (line-level, half-away-from-zero, sum-of-rounded)", () => {
    const fx = loadFixture();
    assert.equal(fx.policy.level, "line-level");
    assert.equal(fx.policy.halfRoundingMode, "half-away-from-zero");
    assert.equal(fx.policy.totals, "sum-of-rounded (never round-of-sum)");
  });

  test("[P0] every pinned lineNetOre case matches the half-away-from-zero expected value", async () => {
    const m = await loadEngine();
    const fx = loadFixture();
    for (const c of fx.lineNetCases) {
      const r = m.lineNetOre(c.quantity, c.unitPriceOre);
      assert.ok(isOk(r), `${c.id}: expected ok result`);
      assert.equal(
        okOre(r as OkLike),
        c.expectedLineNetOre,
        `${c.id} (${c.origin}): ${c.note}`,
      );
    }
  });

  test("[P0] the .5-boundary cases do NOT produce the banker's-rounding value (mode flip fails loud)", async () => {
    const m = await loadEngine();
    const fx = loadFixture();
    const boundaryCases = fx.lineNetCases.filter((c) => c.expectedLineNetOre !== c.bankersWouldGive);
    assert.ok(boundaryCases.length >= 2, "fixture must carry ≥2 distinguishing .5-boundary cases");
    for (const c of boundaryCases) {
      const r = m.lineNetOre(c.quantity, c.unitPriceOre);
      assert.ok(isOk(r));
      const got = okOre(r as OkLike);
      assert.notEqual(
        got,
        c.bankersWouldGive,
        `${c.id}: engine produced the banker's value ${c.bankersWouldGive} — the half-rounding mode has flipped to half-to-even`,
      );
      assert.equal(got, c.expectedLineNetOre);
    }
  });

  test("[P0] totals SUM the already-rounded line values (sum-of-rounded ≠ round-of-sum)", async () => {
    const m = await loadEngine();
    const fx = loadFixture();
    const c = fx.sumOfRoundedCase;
    const rounded: number[] = [];
    for (const line of c.lines) {
      const r = m.lineNetOre(line.quantity, line.unitPriceOre);
      assert.ok(isOk(r));
      rounded.push(okOre(r as OkLike));
    }
    const total = m.sumOre(rounded);
    assert.ok(isOk(total));
    assert.equal(okOre(total as OkLike), c.expectedSumOfRoundedOre, c.note);
    assert.notEqual(
      okOre(total as OkLike),
      c.roundOfSumWouldGive,
      "total equals round-of-sum — the engine is rounding the sum instead of summing the rounded lines",
    );
  });

  test("[P0] golden fixture is anonymized — money numbers only, no PII (R-411/NFR17)", () => {
    const raw = readFileSync(resolve(GOLDEN_DIR, "rounding-mode.json"), "utf8");
    const fx = loadFixture();
    // Scan the DATA payload (not the _doc prose, which legitimately names the rule).
    const dataOnly = JSON.stringify({
      policy: fx.policy,
      lineNetCases: fx.lineNetCases,
      sumOfRoundedCase: fx.sumOfRoundedCase,
    });
    const pii = [/\b\d{6}-\d{4}\b/, /\b\d{6}-\d{4}\b/, /@(?!example\.test\b)[a-z0-9.-]+\.[a-z]{2,}/i];
    for (const re of pii) {
      assert.ok(!re.test(dataOnly), `golden fixture data must be anonymized (matched ${re})`);
    }
    assert.ok(raw.includes("_doc"), "fixture carries a _doc provenance note");
  });
});
