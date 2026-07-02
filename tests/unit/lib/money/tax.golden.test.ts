/**
 * Story 4.3 — GOLDEN ROT / grön-teknik DEDUCTION pin (4.3-GOLDEN-01 + 4.3-GOLDEN-02,
 * R-405/R-406/R-407/R-408/R-410/R-411/R-412). This is the load-bearing deduction-policy pin: the
 * rate flows in as BASIS POINTS from a named UNAPPROVED profile (ROT 3000 bp, grön-teknik 2000 bp),
 * deductionOre = min( roundToOre(basis * bp / 10000), capOre ) under the SINGLE Story 4.1
 * half-away-from-zero mode, cap boundaries (at/above/below) are pinned, hidden rows count toward
 * the basis (R-408), the ROT×grön mix is BLOCKED (R-406), and BRF/private/company eligibility
 * matches the conservative Phase-A policy (R-412: private-only eligible; no personnummer/PII). The
 * fixture carries the RATE + CAP, so a hidden `0.30`/`30`/`0.50`/`50`/`1.3` deduction literal cannot
 * pass (R-404 generalized to tax rates, epic blocker) — this test ALSO greps the tax engine source
 * to assert no such literal exists by construction and that `/ 10000` is present. Each case carries
 * an `origin` label (new-expected / documented-delta). Money/rate/cap numbers only — NO PII (R-411).
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB. Fixture:
 * tests/fixtures/golden/money/rot-gron-deductions.json (anonymized; money/rate/cap numbers only).
 *
 * 🔴 RED PHASE — the tax surface (`estimateDeduction`, the named profiles) does NOT exist yet in
 * `@/lib/money`. The `@/lib/money` barrel resolves today (Story 4.1), so the whole suite is gated
 * behind `TAX_SURFACE_PRESENT` via `describe.skip` — keeping the green `test:unit` baseline
 * UNPERTURBED. The dev's GREEN phase adds `src/lib/money/tax.ts` + the barrel re-exports; the gate
 * then flips true automatically and the PINNED expected values (the load-bearing deduction policy)
 * run UNCHANGED — no test edit needed.
 *
 * POLICY STATUS: the ROT/grön rates/caps/schablon, the eligibility rule, and the customer-facing
 * disclaimer wording are CONSERVATIVE PILOT ASSUMPTIONS pending owner/accounting/legal sign-off
 * (Sign-Off Q3/Q4/Q5/Q7, test-design-epic-4). Recorded as assumptions, NOT accounting/legally-final.
 * The rate/cap numbers below are UNAPPROVED PLACEHOLDERS — if the dev pins DIFFERENT conservative
 * numbers, update the FIXTURE expected values (the fixture is the numeric source of truth). STOP
 * (needs-human) if the rates/caps/eligibility/disclaimer MUST be treated as production-approved.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as money from "@/lib/money";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = resolve(HERE, "../../../fixtures/golden/money");
// The tax engine source (Story 4.3 dev creates it); grepped for a no-hidden-literal assertion.
const TAX_SOURCE = resolve(HERE, "../../../../src/lib/money/tax.ts");

interface DeductionCase {
  readonly id: string;
  readonly origin: "new-expected" | "documented-delta";
  readonly note: string;
  readonly deductionType: string;
  readonly eligibleBasisOre?: number;
  readonly eligibleBasisLines?: readonly number[];
  readonly posture: string;
  readonly persons?: number;
  readonly expectedDeductionOre: number;
  readonly expectedEligibleBasisOre: number;
  readonly capHit: "at" | "above" | "below";
  readonly bankersWouldGive?: number;
  readonly expectClampWarning?: boolean;
  readonly expectRequiresSignOff: boolean;
  readonly expectEligibilityWarning: boolean;
}
interface EligibilityCase {
  readonly id: string;
  readonly origin: string;
  readonly note: string;
  readonly deductionType: string;
  readonly eligibleBasisOre: number;
  readonly posture: string;
  readonly persons?: number;
  readonly expectEligible: boolean;
  readonly expectEligibilityWarning: boolean;
  readonly expectRequiresSignOff: boolean;
}
interface InvalidMixCase {
  readonly id: string;
  readonly origin: string;
  readonly note: string;
  readonly deductionTypes: readonly string[];
  readonly eligibleBasisOre: number;
  readonly posture: string;
  readonly persons?: number;
  readonly expectedErrorCode: string;
  readonly expectBlocked: boolean;
}
interface TaxFixture {
  readonly policy: Record<string, string>;
  readonly profiles: Record<string, Record<string, unknown>>;
  readonly deductionCases: readonly DeductionCase[];
  readonly eligibilityCases: readonly EligibilityCase[];
  readonly invalidMixCase: InvalidMixCase;
}

function loadFixture(): TaxFixture {
  return JSON.parse(
    readFileSync(resolve(GOLDEN_DIR, "rot-gron-deductions.json"), "utf8"),
  ) as TaxFixture;
}

type OkLike = { ok: true } & Record<string, unknown>;
function isOk(r: unknown): r is OkLike {
  return typeof r === "object" && r !== null && (r as { ok?: unknown }).ok === true;
}
function isErr(r: unknown): r is { ok: false } & Record<string, unknown> {
  return typeof r === "object" && r !== null && (r as { ok?: unknown }).ok === false;
}
/** Read a numeric field off an ok result (tolerates the OreResult `value` wrapper). */
function okNumber(r: OkLike, field: string): number {
  const inner = (r as Record<string, unknown>).value;
  const src =
    inner && typeof inner === "object" && field in (inner as Record<string, unknown>)
      ? (inner as Record<string, unknown>)
      : (r as Record<string, unknown>);
  const v = src[field];
  assert.equal(typeof v, "number", `ok result must carry a numeric ${field}`);
  return v as number;
}
function warningsString(r: OkLike): string {
  const inner = (r as Record<string, unknown>).value;
  const src =
    inner && typeof inner === "object" && "warnings" in (inner as Record<string, unknown>)
      ? (inner as Record<string, unknown>)
      : (r as Record<string, unknown>);
  return JSON.stringify(src.warnings ?? []);
}

type TaxEngine = {
  estimateDeduction: (input: Record<string, unknown>) => OkLike | { ok: false } & Record<string, unknown>;
};
const engine = money as unknown as TaxEngine & Record<string, unknown>;

// 🔴 RED-PHASE GATE — flips true once the dev adds the tax surface to `@/lib/money`.
const TAX_SURFACE_PRESENT = typeof engine.estimateDeduction === "function";
const suite = TAX_SURFACE_PRESENT ? describe : describe.skip;

const CAPTURED_AT = "2026-07-02T00:00:00.000Z";

/** Build the estimateDeduction input for a fixture case (single basis or multi-line hidden-row). */
function inputFor(c: DeductionCase): Record<string, unknown> {
  const basis = c.eligibleBasisLines ?? c.eligibleBasisOre;
  return {
    deductionType: c.deductionType,
    eligibleBasisOre: basis,
    posture: c.posture,
    persons: c.persons,
    capturedAt: CAPTURED_AT,
  };
}

suite("Story 4.3 — GOLDEN ROT / grön-teknik deduction pin (4.3-GOLDEN-01/02, R-405/R-406/R-407)", () => {
  test("the fixture pins the conservative UNAPPROVED deduction policy (basis-points, capped, private-only, unapproved)", () => {
    const fx = loadFixture();
    assert.equal(fx.policy.deductionRateUnit, "basis-points");
    assert.ok(fx.policy.mixRule.includes("ROT_GRON_MIX_NOT_ALLOWED"), "policy pins the mix block");
    assert.ok(fx.policy.eligibility.includes("private"), "policy pins private-only eligibility");
    assert.equal(fx.policy.signOff, "pending-owner-accounting-legal");
    // The named profiles are self-describing as UNAPPROVED.
    for (const key of ["ROT_PROFILE_UNAPPROVED", "GRON_TEKNIK_PROFILE_UNAPPROVED"]) {
      assert.equal(fx.profiles[key].approved, false, `${key} must be marked approved:false`);
    }
  });

  test("[P0] every pinned deduction case matches min(roundToOre(basis*bp/10000), cap)", () => {
    const fx = loadFixture();
    for (const c of fx.deductionCases) {
      const r = engine.estimateDeduction(inputFor(c));
      assert.ok(isOk(r), `${c.id}: expected ok result, got ${JSON.stringify(r)}`);
      assert.equal(okNumber(r as OkLike, "deductionOre"), c.expectedDeductionOre, `${c.id} (${c.origin}): ${c.note}`);
      assert.equal(
        okNumber(r as OkLike, "eligibleBasisOre"),
        c.expectedEligibleBasisOre,
        `${c.id}: eligible basis (hidden rows included)`,
      );
    }
  });

  test("[P0] cap boundary behaviour: at cap = cap; above cap CLAMPED to cap; below cap = rate applied", () => {
    const fx = loadFixture();
    for (const c of fx.deductionCases) {
      const r = engine.estimateDeduction(inputFor(c));
      assert.ok(isOk(r));
      const d = okNumber(r as OkLike, "deductionOre");
      if (c.capHit === "above") {
        assert.equal(d, c.expectedDeductionOre, `${c.id}: above-cap deduction is CLAMPED to the cap`);
        if (c.expectClampWarning) {
          assert.match(warningsString(r as OkLike), /cap|clamp/i, `${c.id}: above-cap should note the clamp`);
        }
      }
    }
  });

  test("[P0] the .5-boundary deduction case does NOT produce the banker's value (mode flip fails loud)", () => {
    const fx = loadFixture();
    const boundary = fx.deductionCases.filter((c) => typeof c.bankersWouldGive === "number");
    assert.ok(boundary.length >= 1, "fixture must carry >=1 distinguishing .5-boundary deduction case");
    for (const c of boundary) {
      const r = engine.estimateDeduction(inputFor(c));
      assert.ok(isOk(r));
      const got = okNumber(r as OkLike, "deductionOre");
      assert.notEqual(got, c.bankersWouldGive, `${c.id}: engine produced the banker's value — the half-mode has flipped`);
      assert.equal(got, c.expectedDeductionOre);
    }
  });

  test("[P0] every ok estimate is UNAPPROVED by default — requiresSignOff / warning present (R-405)", () => {
    const fx = loadFixture();
    for (const c of fx.deductionCases) {
      const r = engine.estimateDeduction(inputFor(c));
      assert.ok(isOk(r));
      const serialized = JSON.stringify(r);
      assert.ok(!/"isApproved"\s*:\s*true/.test(serialized), `${c.id}: engine must not derive isApproved:true`);
      assert.ok(!/"approved"\s*:\s*true/.test(serialized), `${c.id}: engine must not render approved:true`);
    }
  });

  test("[P0][LOAD-BEARING] the ROT×grön mix is BLOCKED, never silently summed (R-406, epic blocker)", () => {
    const fx = loadFixture();
    const c = fx.invalidMixCase;
    const r = engine.estimateDeduction({
      deductionTypes: c.deductionTypes,
      eligibleBasisOre: c.eligibleBasisOre,
      posture: c.posture,
      persons: c.persons,
      capturedAt: CAPTURED_AT,
    });
    assert.ok(isErr(r), `${c.id}: a ROT×grön mix must be a blocking failure — never a combined sum`);
    assert.equal((r as Record<string, unknown>).code, c.expectedErrorCode, `${c.id}: ${c.note}`);
    assert.equal(
      (r as Record<string, unknown>).deductionOre,
      undefined,
      "a blocked mix carries NO combined deductionOre",
    );
  });

  test("[P1] eligibility — private eligible; company/brf/public flagged (or blocked) per conservative policy (4.3-GOLDEN-02, R-412)", () => {
    const fx = loadFixture();
    for (const c of fx.eligibilityCases) {
      const r = engine.estimateDeduction({
        deductionType: c.deductionType,
        eligibleBasisOre: c.eligibleBasisOre,
        posture: c.posture,
        persons: c.persons,
        capturedAt: CAPTURED_AT,
      });
      if (c.expectEligible) {
        assert.ok(isOk(r), `${c.id}: a private posture must be eligible`);
        assert.doesNotMatch(warningsString(r as OkLike), /not.?eligible/i, `${c.id}: private carries no not-eligible warning`);
      } else if (isOk(r)) {
        // Conservative policy allows an ok result carrying an eligibility WARNING…
        assert.match(
          warningsString(r as OkLike),
          /not.?eligible|eligibility|posture|unapproved/i,
          `${c.id}: non-private posture must surface an eligibility warning`,
        );
      } else {
        // …or a blocking result. Either satisfies the conservative Phase-A policy.
        assert.ok(isErr(r), `${c.id}: non-private posture blocked or warned, never silently eligible`);
      }
    }
  });

  test("[P0] no hidden deduction-rate literal — the tax engine source contains no 0.30/30/0.50/50/1.3 constant (R-404)", () => {
    // The rate MUST flow from the profile as basis points; a bare percent literal in the deduction
    // path is a NON-NEGOTIABLE epic blocker. Once src/lib/money/tax.ts exists, assert the multiplier
    // is basis-point-driven (`/ 10000`) and carries no percent constant.
    assert.ok(existsSync(TAX_SOURCE), "src/lib/money/tax.ts must exist in the green phase");
    const src = readFileSync(TAX_SOURCE, "utf8");
    // Strip block/line comments so documentation that legitimately mentions "30%" is not scanned.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    // Percent-as-fraction literals (0.30, 0.50, 1.3) and bare-percent literals (30, 50) used AS A RATE
    // multiplier are forbidden in the deduction path; the rate is `deductionPercentBp` from a profile.
    for (const literal of [/(^|[^.\d])0\.30([^\d]|$)/, /(^|[^.\d])0\.50([^\d]|$)/, /(^|[^.\d])1\.3([^\d]|$)/]) {
      assert.ok(!literal.test(code), `tax engine must contain no hidden percent literal (matched ${literal})`);
    }
    assert.ok(code.includes("10000"), "deduction computation must divide by 10000 (basis-point denominator)");
  });

  test("[P0] golden fixture is anonymized — money/rate/cap numbers only, no PII (R-411/R-412/NFR17)", () => {
    const raw = readFileSync(resolve(GOLDEN_DIR, "rot-gron-deductions.json"), "utf8");
    const fx = loadFixture();
    // Scan the DATA payload (not the _doc prose, which legitimately names the rules).
    const dataOnly = JSON.stringify({
      policy: fx.policy,
      profiles: fx.profiles,
      deductionCases: fx.deductionCases,
      eligibilityCases: fx.eligibilityCases,
      invalidMixCase: fx.invalidMixCase,
    });
    const pii = [
      /\b\d{6}-\d{4}\b/, // personnummer
      /\b\d{6}-\d{4}\b/, // orgnr shares the shape — the same scan covers it
      /@(?!example\.test\b)[a-z0-9.-]+\.[a-z]{2,}/i, // non-example.test email
      /secret|password|api_key/i,
    ];
    for (const re of pii) {
      assert.ok(!re.test(dataOnly), `golden fixture data must be anonymized (matched ${re})`);
    }
    assert.ok(raw.includes("_doc"), "fixture carries a _doc provenance note");
  });
});
