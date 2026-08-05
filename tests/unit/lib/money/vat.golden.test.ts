/**
 * Story 4.2 — GOLDEN VAT + quote-total PIN (4.2-GOLDEN-01, R-403/R-404/R-410/R-411). This is
 * the load-bearing VAT policy pin: the VAT rate flows in as BASIS POINTS from the fixture (0 /
 * 600 / 1200 / 2500 bp = 0% / 6% / 12% / 25%), per-line VAT = roundToOre(net * bp / 10000) under
 * the SINGLE Story 4.1 half-away-from-zero mode, and section/quote VAT totals SUM the already-
 * rounded per-line VAT (sum-of-rounded, never round-of-sum). The `sumOfRoundedVsRoundOfSum` case
 * pins the divergence so an accidental round-at-end FAILS LOUD. The fixture carries the RATE, so
 * a hidden `0.25`/`25`/`1.25` VAT literal cannot pass (R-404, epic blocker) — this test ALSO
 * greps the VAT engine source to assert no such literal exists by construction. Each case carries
 * an `origin` label (new-expected / documented-delta). Money/rate numbers only — NO PII (R-411).
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB. Fixture:
 * tests/fixtures/golden/money/vat-rates.json (anonymized; money/rate numbers only, NFR17).
 *
 * Story 10.6 standing-control repair: the landed VAT exports are hard preconditions. Dropping an
 * export fails this golden immediately; the policy pin can never silently self-disable.
 *
 * POLICY STATUS: the per-line VAT rounding policy, the excl/incl/both display views, and the
 * 'private customer → always incl-VAT' presentation invariant are CONSERVATIVE PILOT ASSUMPTIONS
 * pending owner/accounting/legal sign-off (Sign-Off Q1/Q2, test-design-epic-4). Recorded as
 * assumptions, NOT accounting/legally-final. STOP (needs-human) if accounting requires DOCUMENT-
 * LEVEL VAT rounding, or a different VAT display / customer-facing VAT wording is required.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as money from "@/lib/money";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = resolve(HERE, "../../../fixtures/golden/money");
// The VAT engine source (Story 4.2 dev creates it); grepped for a no-hidden-literal assertion.
const VAT_SOURCE = resolve(HERE, "../../../../src/lib/money/vat.ts");

interface LineVatCase {
  readonly id: string;
  readonly origin: "new-expected" | "documented-delta";
  readonly note: string;
  readonly lineNetOre: number;
  readonly vatRateBp: number;
  readonly expectedLineVatOre: number;
  readonly expectedGrossOre: number;
  readonly bankersWouldGive?: number;
}
interface FractionalChainCase {
  readonly id: string;
  readonly origin: string;
  readonly note: string;
  readonly quantity: number;
  readonly unitPriceOre: number;
  readonly vatRateBp: number;
  readonly expectedLineNetOre: number;
  readonly expectedLineVatOre: number;
  readonly expectedGrossOre: number;
}
interface SectionCase {
  readonly id: string;
  readonly origin: string;
  readonly note: string;
  readonly lines: ReadonlyArray<{ lineNetOre: number; vatRateBp: number }>;
  readonly expectedSectionNetOre: number;
  readonly expectedSectionVatOre: number;
  readonly expectedSectionGrossOre: number;
}
interface SumVsRoundCase {
  readonly id: string;
  readonly origin: string;
  readonly note: string;
  readonly lines: ReadonlyArray<{ lineNetOre: number; vatRateBp: number }>;
  readonly expectedSumOfRoundedVatOre: number;
  readonly roundOfSummedVatWouldGive: number;
}
interface VatFixture {
  readonly policy: Record<string, string>;
  readonly lineVatCases: readonly LineVatCase[];
  readonly fractionalQuantityChainCase: FractionalChainCase;
  readonly sectionTotalCase: SectionCase;
  readonly sumOfRoundedVsRoundOfSumCase: SumVsRoundCase;
}

function loadFixture(): VatFixture {
  return JSON.parse(readFileSync(resolve(GOLDEN_DIR, "vat-rates.json"), "utf8")) as VatFixture;
}

type OkLike = { ok: true } & Record<string, unknown>;
function isOk(r: unknown): r is OkLike {
  return typeof r === "object" && r !== null && (r as { ok?: unknown }).ok === true;
}
function okOre(r: OkLike): number {
  const v = (r as Record<string, unknown>).value ?? (r as Record<string, unknown>).ore;
  assert.equal(typeof v, "number");
  return v as number;
}
function okGross(r: OkLike): number {
  const v = ((r as Record<string, unknown>).value ?? r) as Record<string, unknown>;
  assert.equal(typeof v.grossOre, "number", "breakdown must carry a numeric grossOre");
  return v.grossOre as number;
}

type VatEngine = {
  lineVatOre: (lineNetOre: number, vatRateBp: number) => OkLike | { ok: false };
  vatBreakdown: (netOre: number, vatRateBp: number) => OkLike | { ok: false };
  lineNetOre: (quantity: number, unitPriceOre: number) => OkLike | { ok: false };
  sumVatOre?: (values: readonly number[]) => OkLike | { ok: false };
  sumOre?: (values: readonly number[]) => OkLike | { ok: false };
};
const engine = money as unknown as VatEngine & Record<string, unknown>;

assert.equal(typeof engine.lineVatOre, "function", "lineVatOre export is a hard golden precondition");
assert.equal(typeof engine.vatBreakdown, "function", "vatBreakdown export is a hard golden precondition");

function sumVat(values: readonly number[]): OkLike | { ok: false } {
  const fn = engine.sumVatOre ?? engine.sumOre;
  assert.equal(typeof fn, "function", "engine must expose sumVatOre or reuse sumOre for VAT totals");
  return fn!(values);
}

describe("Story 4.2 — GOLDEN VAT + quote-total pin (4.2-GOLDEN-01, R-403/R-404)", () => {
  test("the fixture pins the conservative pilot VAT policy (basis-points, per-line, sum-of-rounded)", () => {
    const fx = loadFixture();
    assert.equal(fx.policy.vatRateUnit, "basis-points");
    assert.equal(fx.policy.totals, "sum-of-rounded (never round-of-sum)");
    assert.ok(fx.policy.privateCustomerInvariant.includes("always incl-VAT"));
  });

  test("[P0] every pinned per-line VAT case matches roundToOre(net * bp / 10000)", () => {
    const fx = loadFixture();
    for (const c of fx.lineVatCases) {
      const r = engine.lineVatOre(c.lineNetOre, c.vatRateBp);
      assert.ok(isOk(r), `${c.id}: expected ok result`);
      assert.equal(okOre(r as OkLike), c.expectedLineVatOre, `${c.id} (${c.origin}): ${c.note}`);
    }
  });

  test("[P0] vatBreakdown derives grossOre = net + VAT for every pinned case", () => {
    const fx = loadFixture();
    for (const c of fx.lineVatCases) {
      const r = engine.vatBreakdown(c.lineNetOre, c.vatRateBp);
      assert.ok(isOk(r), `${c.id}: expected ok breakdown`);
      assert.equal(okGross(r as OkLike), c.expectedGrossOre, `${c.id}: gross = net + VAT`);
    }
  });

  test("[P0] the .5-boundary VAT case does NOT produce the banker's value (mode flip fails loud)", () => {
    const fx = loadFixture();
    const boundary = fx.lineVatCases.filter((c) => typeof c.bankersWouldGive === "number");
    assert.ok(boundary.length >= 1, "fixture must carry ≥1 distinguishing .5-boundary VAT case");
    for (const c of boundary) {
      const r = engine.lineVatOre(c.lineNetOre, c.vatRateBp);
      assert.ok(isOk(r));
      const got = okOre(r as OkLike);
      assert.notEqual(got, c.bankersWouldGive, `${c.id}: engine produced the banker's VAT value — the half-mode has flipped`);
      assert.equal(got, c.expectedLineVatOre);
    }
  });

  test("[P0] the fractional-quantity → line-net → VAT chain matches the pinned öre at each stage", () => {
    const fx = loadFixture();
    const c = fx.fractionalQuantityChainCase;
    const net = engine.lineNetOre(c.quantity, c.unitPriceOre);
    assert.ok(isOk(net), `${c.id}: expected ok lineNetOre`);
    assert.equal(okOre(net as OkLike), c.expectedLineNetOre, `${c.id}: line net stage`);
    const vat = engine.lineVatOre(okOre(net as OkLike), c.vatRateBp);
    assert.ok(isOk(vat));
    assert.equal(okOre(vat as OkLike), c.expectedLineVatOre, `${c.id}: VAT stage — ${c.note}`);
  });

  test("[P0] section VAT total = SUM of the rounded per-line VAT (mixed rates)", () => {
    const fx = loadFixture();
    const c = fx.sectionTotalCase;
    const perLineVat = c.lines.map((l) => {
      const r = engine.lineVatOre(l.lineNetOre, l.vatRateBp);
      assert.ok(isOk(r));
      return okOre(r as OkLike);
    });
    const total = sumVat(perLineVat);
    assert.ok(isOk(total));
    assert.equal(okOre(total as OkLike), c.expectedSectionVatOre, c.note);
  });

  test("[P0][LOAD-BEARING] section VAT is sum-of-rounded, NOT round-of-summed-VAT", () => {
    const fx = loadFixture();
    const c = fx.sumOfRoundedVsRoundOfSumCase;
    const perLineVat = c.lines.map((l) => {
      const r = engine.lineVatOre(l.lineNetOre, l.vatRateBp);
      assert.ok(isOk(r));
      return okOre(r as OkLike);
    });
    const total = sumVat(perLineVat);
    assert.ok(isOk(total));
    assert.equal(okOre(total as OkLike), c.expectedSumOfRoundedVatOre, c.note);
    assert.notEqual(
      okOre(total as OkLike),
      c.roundOfSummedVatWouldGive,
      "total equals round-of-summed-VAT — the engine is rounding the summed VAT instead of summing rounded lines",
    );
  });

  test("[P0] no hidden VAT FRACTION literal — the VAT engine source contains no 0.25/1.25 constant + is bp-driven (R-404)", () => {
    // The rate MUST flow from the fixture/settings as basis points; a percent-fraction literal in the
    // VAT computation path is a NON-NEGOTIABLE epic blocker. Once src/lib/money/vat.ts exists,
    // assert the multiplier is basis-point-driven (`/ 10000`) and carries no percent-fraction constant.
    assert.ok(existsSync(VAT_SOURCE), "src/lib/money/vat.ts must exist in the green phase");
    const src = readFileSync(VAT_SOURCE, "utf8");
    // Strip block/line comments so documentation that legitimately mentions "25%" is not scanned.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    // Scans ONLY the percent-as-FRACTION forms (0.25, 1.25) — NOT the bare integer `25`, which is
    // impractically noisy to grep (it matches line refs / öre values). A real hidden path is already
    // structurally blocked by the `/ 10000` basis-point denominator asserted below.
    for (const literal of [/(^|[^.\d])0\.25([^\d]|$)/, /(^|[^.\d])1\.25([^\d]|$)/]) {
      assert.ok(!literal.test(code), `VAT engine must contain no hidden percent literal (matched ${literal})`);
    }
    assert.ok(code.includes("10000"), "VAT computation must divide by 10000 (basis-point denominator)");
  });

  test("[P0] golden fixture is anonymized — money/rate numbers only, no PII (R-411/NFR17)", () => {
    const raw = readFileSync(resolve(GOLDEN_DIR, "vat-rates.json"), "utf8");
    const fx = loadFixture();
    // Scan the DATA payload (not the _doc prose, which legitimately names the rule).
    const dataOnly = JSON.stringify({
      policy: fx.policy,
      lineVatCases: fx.lineVatCases,
      fractionalQuantityChainCase: fx.fractionalQuantityChainCase,
      sectionTotalCase: fx.sectionTotalCase,
      sumOfRoundedVsRoundOfSumCase: fx.sumOfRoundedVsRoundOfSumCase,
    });
    const pii = [/\b\d{6}-\d{4}\b/, /@(?!example\.test\b)[a-z0-9.-]+\.[a-z]{2,}/i, /secret|password|api_key/i];
    for (const re of pii) {
      assert.ok(!re.test(dataOnly), `golden fixture data must be anonymized (matched ${re})`);
    }
    assert.ok(raw.includes("_doc"), "fixture carries a _doc provenance note");
  });
});
