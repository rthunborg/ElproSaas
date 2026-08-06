/**
 * Story 4.2 — standing PURE-LOGIC unit tests for the VAT + quote-total
 * primitives that EXTEND the Story 4.1 `@/lib/money` engine (architecture §22). This is the
 * FIRST VAT computation in the repo. Money is INTEGER ÖRE end-to-end; the VAT rate is INTEGER
 * BASIS POINTS (2500 = 25.00%) — there is NO hidden 25% (0.25/25/1.25) constant. Runs under
 * `node --test` (`pnpm run test:unit`) — pure, NO DB, NO browser, NO network, NO clock read.
 *
 * Story 10.6 standing-control repair: the landed VAT exports are hard preconditions. Dropping an
 * export fails this file at load time; the suite can never silently self-disable.
 *
 * Expected engine surface (the dev implements this; names may be re-exported from `@/lib/money`):
 *   - lineVatOre(lineNetOre: number, vatRateBp: number): OreResult
 *       roundToOre(lineNetOre * vatRateBp / 10000) — PER-LINE VAT via the SINGLE Story 4.1
 *       half-away-from-zero rounding mode. Validates `isOreAmount(lineNetOre)` AND that
 *       `vatRateBp` is a valid basis-point rate (integer, [0..10000], via the ONE reused
 *       `isVatRateBp` authority — not a forked bp check). Re-checks the rounded VAT with
 *       `isOreAmount` (overflow -> typed `ORE_OVERFLOW`). `vatRateBp = 0` -> VAT 0 (not a bug).
 *       NO `0.25`/`25`/`1.25` literal — the rate flows in as basis points.
 *   - sumVatOre(lineVatValues: readonly number[]): OreResult   (or reuse `sumOre` directly)
 *       Section/quote VAT total = SUM of the already-rounded per-line VAT values
 *       (SUM-OF-ROUNDED, never round-of-sum). Guards against ORE_AMOUNT_MAX.
 *   - vatBreakdown(netOre: number, vatRateBp: number): { ok: true; value: { netOre, vatOre, grossOre } } | { ok: false; ... }
 *       Returns the three öre values for one line/section; `grossOre = netOre + vatOre` is
 *       DERIVED (guarded against ORE_AMOUNT_MAX), never an independent stored total.
 *   - a pure DISPLAY-MODE selector over `{ netOre, vatOre, grossOre }` + a VatDisplayMode /
 *       private-vs-company posture: `company_excl` -> net; `company_togglable` -> both;
 *       PRIVATE-customer INVARIANT -> always incl (gross). Presentation-only: re-derives from
 *       the same source öre, NEVER mutates them; a round-trip through any mode returns the
 *       identical stored öre. The private-always-incl rule is a documented CONSERVATIVE
 *       ASSUMPTION (Sign-Off Q2), NOT legally-approved fact.
 *   - buildVatAssumptionSnapshot(source, opts): a FROZEN VAT-assumption value that copies BY
 *       VALUE the exact `vatRateBp` + `defaultVatDisplay` (+ source id / `sourceUpdatedAt` if a
 *       row is passed) and returns `Object.freeze(...)`. Takes an INJECTED `capturedAt`
 *       (mirror `SnapshotBuildOptions` — NEVER `Date.now()`). Captures STATE, computes nothing
 *       (no VAT amount into itself, no derived `isApproved`); `vatRateBp` stays basis points.
 *       Reuses the Story 3.5 `src/lib/snapshots` freeze discipline; does NOT persist to a table.
 *
 * Typed failure shape: the Story 4.1 `OreResult` — `{ ok: true; value } | { ok: false; code }`.
 * The primitives NEVER throw, NEVER echo the raw invalid value, NEVER return NaN/Infinity. The
 * `isOk`/`isErr` helpers below accept the OreResult shape (and tolerate a `{ ok, value }` object
 * carrying the breakdown) so the dev picks the failure surface without rewriting the tests.
 *
 * Coverage → test IDs (test-design-epic-4, BINDING): 4.2-UNIT-01 (per-line VAT rounded; section
 * totals sum-of-rounded incl. sum-of-rounded ≠ round-of-sum), 4.2-UNIT-02 (excl/incl/both views
 * re-derive without mutating source totals), 4.2-UNIT-03 (VAT-assumption snapshot frozen; injected
 * capturedAt; no clock), 4.2-UNIT-04 (both-display does not mutate; display modes round-trip),
 * 4.2-UNIT-05/4.3-UNIT-06 (mutating the source rate after capture does NOT change a prior
 * snapshot), 4.2-UNIT-06 (zero-VAT / VAT-exempt rows). Risks: R-403 (VAT rounding order),
 * R-404 (hidden 25% constant), R-409 (assumption-snapshot recompute).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as money from "@/lib/money";

// The Story 4.1 typed-failure shape is `OreResult` = { ok:true; value } | { ok:false; code }.
type OkLike = { ok: true } & Record<string, unknown>;
type ErrLike = { ok: false } & Record<string, unknown>;
type TypedResult = OkLike | ErrLike;

function isOk(r: unknown): r is OkLike {
  return typeof r === "object" && r !== null && (r as { ok?: unknown }).ok === true;
}
function isErr(r: unknown): r is ErrLike {
  return typeof r === "object" && r !== null && (r as { ok?: unknown }).ok === false;
}
/** Extract a numeric öre value from an ok result regardless of field name (`value`/`ore`). */
function okOre(r: OkLike): number {
  const v = (r as Record<string, unknown>).value ?? (r as Record<string, unknown>).ore;
  assert.equal(typeof v, "number", "ok result must carry a numeric öre value");
  return v as number;
}
/** Extract the `{ netOre, vatOre, grossOre }` breakdown from an ok result (`value` or top-level). */
function okBreakdown(r: OkLike): { netOre: number; vatOre: number; grossOre: number } {
  const v = ((r as Record<string, unknown>).value ?? r) as Record<string, unknown>;
  assert.equal(typeof v.netOre, "number", "breakdown must carry a numeric netOre");
  assert.equal(typeof v.vatOre, "number", "breakdown must carry a numeric vatOre");
  assert.equal(typeof v.grossOre, "number", "breakdown must carry a numeric grossOre");
  return v as { netOre: number; vatOre: number; grossOre: number };
}
/** A failure must NOT echo the raw invalid input anywhere in its serialization. */
function assertNoRawEcho(r: ErrLike, rawInput: unknown): void {
  const serialized = JSON.stringify(r);
  const raw = String(rawInput);
  if (raw.length > 0 && raw !== "0" && raw !== "true" && raw !== "false") {
    assert.ok(
      !serialized.includes(raw),
      `typed failure must not echo the raw invalid value ${raw}: got ${serialized}`,
    );
  }
  assert.ok(!/NaN|Infinity/.test(serialized), "typed failure must not leak NaN/Infinity");
}

// ── The expected Story 4.2 VAT surface (dev implements; names re-exported from @/lib/money) ──
type VatEngine = {
  lineVatOre: (lineNetOre: number, vatRateBp: number) => TypedResult;
  sumVatOre?: (lineVatValues: readonly number[]) => TypedResult;
  sumOre?: (values: readonly number[]) => TypedResult; // Story 4.1 primitive, may be reused directly
  vatBreakdown: (netOre: number, vatRateBp: number) => TypedResult;
  // The display-mode selector — dev's exact name may vary; the assertions probe the common shapes.
  selectVatDisplay?: (
    mode: unknown,
    breakdown: { netOre: number; vatOre: number; grossOre: number },
  ) => unknown;
  buildVatAssumptionSnapshot?: (source: unknown, opts: { capturedAt: string }) => Record<string, unknown>;
};

const engine = money as unknown as VatEngine & Record<string, unknown>;

assert.equal(typeof engine.lineVatOre, "function", "lineVatOre export is a hard standing precondition");
assert.equal(typeof engine.vatBreakdown, "function", "vatBreakdown export is a hard standing precondition");

describe("Story 4.2 — @/lib/money VAT + quote-total primitives (standing regression)", () => {
  // ── 4.2-UNIT-01: per-line VAT rounded; section totals SUM rounded line VAT (AC1, R-403) ──
  describe("4.2-UNIT-01 — per-line VAT rounding + sum-of-rounded totals (R-403, R-404)", () => {
    test("lineVatOre computes roundToOre(net * vatRateBp / 10000) at standard 25% (2500 bp)", () => {
      const r = engine.lineVatOre(85000, 2500); // 850,00 kr @ 25%
      assert.ok(isOk(r), `expected ok, got ${JSON.stringify(r)}`);
      assert.equal(okOre(r as OkLike), 21250, "VAT of 85000 öre @ 2500 bp is 21250 öre");
    });

    test("lineVatOre honours reduced rates 6% (600 bp) and 12% (1200 bp) from basis-point input", () => {
      assert.equal(okOre(assertOk(engine.lineVatOre(50000, 600))), 3000);
      assert.equal(okOre(assertOk(engine.lineVatOre(33300, 1200))), 3996);
    });

    test("lineVatOre rounds PER LINE under the SINGLE half-away-from-zero mode (x.5 → x+1)", () => {
      // net 2 öre @ 2500 bp = 0.5 öre exactly → half-away-from-zero → 1 (banker's would give 0).
      assert.equal(okOre(assertOk(engine.lineVatOre(2, 2500))), 1);
      // net 1 öre @ 2500 bp = 0.25 öre → below the boundary → 0.
      assert.equal(okOre(assertOk(engine.lineVatOre(1, 2500))), 0);
      // net 12345 öre @ 2500 bp = 3086.25 → 3086.
      assert.equal(okOre(assertOk(engine.lineVatOre(12345, 2500))), 3086);
    });

    test("section VAT total SUMS the already-rounded per-line VAT values (sum-of-rounded)", () => {
      // Mixed-rate section: 85000@2500→21250, 33300@1200→3996, 50000@600→3000.
      const perLine = [
        okOre(assertOk(engine.lineVatOre(85000, 2500))),
        okOre(assertOk(engine.lineVatOre(33300, 1200))),
        okOre(assertOk(engine.lineVatOre(50000, 600))),
      ];
      const total = sumVat(perLine);
      assert.ok(isOk(total));
      assert.equal(okOre(total as OkLike), 28246, "section VAT = sum of the rounded line VAT values");
    });

    test("[LOAD-BEARING] section VAT is sum-of-rounded, NOT round-of-summed-VAT", () => {
      // Three lines net 2 öre @ 2500 bp: each VAT = round(0.5) = 1 → sum-of-rounded = 3.
      // Round-of-summed-VAT would be round((2+2+2)*2500/10000) = round(1.5) = 2.
      const perLine = [2, 2, 2].map((n) => okOre(assertOk(engine.lineVatOre(n, 2500))));
      assert.deepEqual(perLine, [1, 1, 1]);
      const total = sumVat(perLine);
      assert.ok(isOk(total));
      assert.equal(
        okOre(total as OkLike),
        3,
        "totals SUM the rounded per-line VAT (3), never round the summed VAT (2)",
      );
      assert.notEqual(okOre(total as OkLike), 2, "engine must not round-at-end the summed VAT");
    });

    test("lineVatOre rejects an out-of-range or non-integer basis-point rate as a typed failure", () => {
      for (const badBp of [-1, 10001, 25.5, Number.NaN, "2500", null, undefined]) {
        const r = engine.lineVatOre(85000, badBp as number);
        assert.ok(isErr(r), `expected typed failure for vatRateBp=${String(badBp)}`);
        assertNoRawEcho(r as ErrLike, badBp);
      }
    });

    test("lineVatOre rejects a non-öre net (float/negative/string) as a typed failure", () => {
      for (const badNet of [850.5, -1, "85000", Number.POSITIVE_INFINITY, null]) {
        const r = engine.lineVatOre(badNet as number, 2500);
        assert.ok(isErr(r), `expected typed failure for lineNetOre=${String(badNet)}`);
        assertNoRawEcho(r as ErrLike, badNet);
      }
    });

    function assertOk(r: TypedResult): OkLike {
      assert.ok(isOk(r), `expected ok result, got ${JSON.stringify(r)}`);
      return r as OkLike;
    }
    /** Sum rounded per-line VAT via `sumVatOre` if present, else the Story 4.1 `sumOre`. */
    function sumVat(values: readonly number[]): TypedResult {
      const fn = engine.sumVatOre ?? engine.sumOre;
      assert.equal(typeof fn, "function", "engine must expose sumVatOre or reuse sumOre for VAT totals");
      return fn!(values);
    }
  });

  // ── 4.2-UNIT-02 / 4.2-UNIT-06: excl/incl/both views + zero-VAT rows (AC2, AC1) ──
  describe("4.2-UNIT-02 — vatBreakdown derives gross; source net+VAT immutable (R-403)", () => {
    test("vatBreakdown returns { netOre, vatOre, grossOre } with grossOre = netOre + vatOre", () => {
      const b = okBreakdown(assertOk(engine.vatBreakdown(85000, 2500)));
      assert.equal(b.netOre, 85000);
      assert.equal(b.vatOre, 21250);
      assert.equal(b.grossOre, 106250, "gross is DERIVED as net + VAT, never a separate stored total");
      assert.equal(b.grossOre, b.netOre + b.vatOre);
    });

    test("4.2-UNIT-06 — a zero-VAT / VAT-exempt row (vatRateBp = 0) yields VAT 0 cleanly", () => {
      const b = okBreakdown(assertOk(engine.vatBreakdown(85000, 0)));
      assert.equal(b.vatOre, 0, "0 bp is not a special-case bug — the same formula yields 0");
      assert.equal(b.grossOre, 85000, "gross equals net when VAT is 0");
    });

    test("a zero-net row yields all-zero (net 0, VAT 0, gross 0), not a rejection", () => {
      const b = okBreakdown(assertOk(engine.vatBreakdown(0, 2500)));
      assert.deepEqual([b.netOre, b.vatOre, b.grossOre], [0, 0, 0]);
    });

    function assertOk(r: TypedResult): OkLike {
      assert.ok(isOk(r), `expected ok result, got ${JSON.stringify(r)}`);
      return r as OkLike;
    }
  });

  // ── 4.2-UNIT-04: display modes re-derive; both-display does not mutate; round-trip (AC2) ──
  describe("4.2-UNIT-04 — display-mode views are presentation-only + round-trip (R-403)", () => {
    test("the display-mode selector re-derives from the same net+VAT öre and NEVER mutates them", () => {
      const b = okBreakdown(assertOk(engine.vatBreakdown(85000, 2500)));
      const frozenView = { netOre: b.netOre, vatOre: b.vatOre, grossOre: b.grossOre };
      const selector = engine.selectVatDisplay;
      assert.equal(typeof selector, "function", "engine must expose a display-mode selector");

      // Selecting across excl / togglable / private-incl must NOT change the source breakdown.
      for (const mode of ["company_excl", "company_togglable", "private"] as const) {
        selector!(mode, { ...b });
      }
      assert.deepEqual(
        { netOre: b.netOre, vatOre: b.vatOre, grossOre: b.grossOre },
        frozenView,
        "switching display mode is presentation-only — it must not mutate the source öre",
      );
    });

    test("company_excl shows net (excl); the PRIVATE invariant always shows gross (incl)", () => {
      const b = okBreakdown(assertOk(engine.vatBreakdown(85000, 2500)));
      const selector = engine.selectVatDisplay!;
      const excl = selector("company_excl", { ...b });
      const priv = selector("private", { ...b });
      // The selector's exact return shape is dev's choice; the load-bearing invariant is that the
      // excl posture surfaces the NET öre and the private posture surfaces the GROSS öre.
      assert.ok(
        JSON.stringify(excl).includes(String(b.netOre)),
        "company_excl must surface the net (excl-VAT) öre",
      );
      assert.ok(
        JSON.stringify(priv).includes(String(b.grossOre)),
        "the private-customer invariant must surface the gross (incl-VAT) öre — Sign-Off Q2 conservative assumption",
      );
    });

    test("a round-trip through any display mode returns the identical stored source öre", () => {
      const b = okBreakdown(assertOk(engine.vatBreakdown(50000, 600)));
      const selector = engine.selectVatDisplay!;
      for (const mode of ["company_excl", "company_togglable", "private"] as const) {
        selector(mode, { ...b });
      }
      // Re-deriving the breakdown from the same inputs yields the identical öre (no drift).
      const again = okBreakdown(assertOk(engine.vatBreakdown(50000, 600)));
      assert.deepEqual(again, b, "the stored source öre are stable across display-mode selection");
    });

    function assertOk(r: TypedResult): OkLike {
      assert.ok(isOk(r), `expected ok result, got ${JSON.stringify(r)}`);
      return r as OkLike;
    }
  });

  // ── 4.2-UNIT-03 / 4.2-UNIT-05: VAT-assumption snapshot FROZEN; injected capturedAt (AC3) ──
  describe("4.2-UNIT-03/05 — frozen VAT-assumption snapshot, no recompute (R-409)", () => {
    const CAPTURED_AT = "2026-07-02T00:00:00.000Z";
    // A minimal mutable VAT source (mirrors the company_settings VAT half: rate + display mode).
    function makeSource(): { vatRateBp: number; defaultVatDisplay: string } {
      return { vatRateBp: 2500, defaultVatDisplay: "company_togglable" };
    }

    test("buildVatAssumptionSnapshot copies the exact vatRateBp + display mode BY VALUE", () => {
      const build = engine.buildVatAssumptionSnapshot;
      assert.equal(typeof build, "function", "engine must expose buildVatAssumptionSnapshot");
      const snap = build!(makeSource(), { capturedAt: CAPTURED_AT });
      assert.equal(snap.vatRateBp, 2500, "vatRateBp stays basis points, copied verbatim (no percent math)");
      assert.equal(snap.defaultVatDisplay, "company_togglable");
      assert.equal(snap.capturedAt, CAPTURED_AT, "capturedAt is the INJECTED instant, never a clock read");
    });

    test("the snapshot is FROZEN — Object.isFrozen and a write does not take effect", () => {
      const snap = engine.buildVatAssumptionSnapshot!(makeSource(), { capturedAt: CAPTURED_AT });
      assert.equal(Object.isFrozen(snap), true, "the VAT-assumption snapshot must be Object.freeze'd");
      try {
        (snap as Record<string, unknown>).vatRateBp = 9999;
      } catch {
        /* strict-mode throw is acceptable; the value must remain unchanged either way */
      }
      assert.equal(snap.vatRateBp, 2500, "a frozen snapshot's captured rate cannot be overwritten");
    });

    test("mutating the SOURCE rate AFTER capture does NOT change a prior snapshot (no live ref)", () => {
      const source = makeSource();
      const snap = engine.buildVatAssumptionSnapshot!(source, { capturedAt: CAPTURED_AT });
      // Change the tenant setting after the assumption was captured…
      source.vatRateBp = 600;
      source.defaultVatDisplay = "company_excl";
      // …the prior snapshot must still carry the captured 25% assumption.
      assert.equal(snap.vatRateBp, 2500, "a later tenant-rate change must NOT retroactively alter a captured assumption");
      assert.equal(snap.defaultVatDisplay, "company_togglable");
    });

    test("the snapshot captures STATE only — it does NOT compute a VAT amount or an isApproved flag", () => {
      const snap = engine.buildVatAssumptionSnapshot!(makeSource(), { capturedAt: CAPTURED_AT });
      assert.equal(
        (snap as Record<string, unknown>).isApproved,
        undefined,
        "the assumption snapshot never derives an approval flag (mirrors Story 3.5)",
      );
      // It freezes the RATE + display assumption; the VAT AMOUNT is computed at calc time (Task 1),
      // reproducible from the frozen rate — the snapshot must not bake an amount into itself.
      assert.equal(
        (snap as Record<string, unknown>).vatOre ?? (snap as Record<string, unknown>).vatAmountOre,
        undefined,
        "the snapshot freezes the assumption, not a computed VAT amount",
      );
    });
  });
});
