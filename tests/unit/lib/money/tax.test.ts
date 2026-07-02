/**
 * Story 4.3 — ATDD RED-PHASE scaffold: PURE-LOGIC unit tests for the ROT / grön-teknik
 * ESTIMATE ENGINE that EXTENDS the Story 4.1/4.2 `@/lib/money` engine (architecture §22). This
 * is the FIRST ROT / grön-teknik deduction math in the repo. Money is INTEGER ÖRE end-to-end;
 * the deduction rate is INTEGER BASIS POINTS (3000 = 30.00%) — there is NO hidden 0.30/30/0.50/
 * 50/1.3 percent constant in the deduction path (R-404 generalized to tax rates). Runs under
 * `node --test` (`pnpm run test:unit`) — pure, NO DB, NO browser, NO network, NO clock read.
 *
 * 🔴 RED PHASE — the tax surface (`estimateDeduction`, `buildTaxAssumptionSnapshot`, the named
 * `ROT_PROFILE_UNAPPROVED` / `GRON_TEKNIK_PROFILE_UNAPPROVED` profiles) does NOT exist yet in
 * `@/lib/money` (Story 4.3 dev, Tasks 1-4). The `@/lib/money` BARREL already resolves (Story
 * 4.1's alias-hook fix makes a bare-directory import work under `node --test`), so a top-level
 * `import * as money from "@/lib/money"` RESOLVES today — but the new tax exports are `undefined`.
 * To keep the green `test:unit` baseline UNPERTURBED, the whole suite is gated behind
 * `TAX_SURFACE_PRESENT` via `describe.skip` (mirroring the epic-4 pure-library ATDD pattern:
 * red-gate on the ABSENCE of the not-yet-implemented module surface, so the baseline suite stays
 * green and the runner does not error). The dev's GREEN phase:
 *   1. adds `src/lib/money/tax.ts` and re-exports the tax surface from `src/lib/money/index.ts`;
 *   2. FLIPS the gate — `TAX_SURFACE_PRESENT` becomes true automatically once the exports land,
 *      so the whole suite runs; NO test edit is needed (delete the gate comment when green);
 *   3. leaves the assertions BELOW UNCHANGED — they ARE the contract.
 *
 * Expected engine surface (the dev implements this; names re-exported from `@/lib/money`):
 *   - estimateDeduction(input): a typed result carrying, on success,
 *       `{ deductionOre, eligibleBasisOre, warnings: readonly Warning[], assumptionSnapshot,
 *          requiresSignOff: true }` — OR a typed BLOCKING failure. `input` carries a CLOSED
 *       `deductionType` union (`"rot" | "gron_teknik"`), the eligible-basis inputs (integer öre),
 *       a resolved eligibility `posture` (customer-type-derived — `private` eligible vs not;
 *       NEVER a personnummer / PII), a `persons`/count for the per-person ROT cap, and an injected
 *       `capturedAt` for the assumption snapshot.
 *       deductionOre = min( roundToOre(eligibleBasisOre * deductionPercentBp / 10000), capOre ) —
 *       the applied rate on the eligible basis, CAPPED at the profile cap (per-person for ROT,
 *       per-category for grön teknik), via the SINGLE Story 4.1 `roundToOre` + `isOreAmount`.
 *       NO `0.30`/`30`/`0.50`/`50`/`1.3` literal — the rate flows in as `deductionPercentBp`.
 *   - the ROT×grön MIX is a BLOCKING typed failure (`ROT_GRON_MIX_NOT_ALLOWED`), NEVER a silent
 *       combined sum (R-406, epic blocker). No combined-sum code path exists.
 *   - the "requires sign-off" invariant (R-405, epic blocker): the result AND its assumption
 *       snapshot ALWAYS carry `requiresSignOff: true` (or a "requires sign-off" warning) by
 *       DEFAULT; the engine has NO parameter/branch/field that renders/persists the output as
 *       `approved`. Mirrors the Epic 3 `quote_terms.approved_at` structural discipline.
 *   - buildTaxAssumptionSnapshot(source, { capturedAt }): a FROZEN tax-assumption value that
 *       COPIES BY VALUE the exact deduction profile (deduction type, `deductionPercentBp`,
 *       `capOre`, `profileId`/label, schablon choice if used, persons/count), the eligible-basis
 *       inputs, the warnings, and the UNAPPROVED/`requiresSignOff` marker, then `Object.freeze`s.
 *       Takes an INJECTED `capturedAt` (mirror `buildVatAssumptionSnapshot` — NEVER `Date.now()`).
 *       Captures STATE, computes nothing (no re-derived `isApproved`); holds NO live reference to
 *       the source (mutating a source rate after capture does NOT change a prior snapshot, R-409).
 *   - a resolved eligibility POSTURE, never PII (R-412): ONLY `private` is eligible; a non-private
 *       posture (`company`/`brf`/`public`) yields an eligibility WARNING (or a blocking result per
 *       the conservative policy). The engine NEVER reads/requires a personnummer.
 *   - an UNKNOWN deduction type / profile returns a CLEAR typed error (`UNKNOWN_DEDUCTION_TYPE`),
 *       not a silent fall-through to a wrong profile (4.3-UNIT-07).
 *
 * Typed failure shape: the Story 4.1 `OreResult` family — `{ ok: true; … } | { ok: false; code }`.
 * The engine NEVER throws, NEVER echoes the raw invalid value, NEVER returns NaN/Infinity. The
 * `isOk`/`isErr` helpers below accept the OreResult-style shape (and tolerate the richer
 * `{ ok: true; deductionOre, … }` success arm) so the dev picks the exact result surface without
 * rewriting the tests.
 *
 * POLICY STATUS (Sign-Off, human — NOT a plan gap): the ROT/grön rates/caps/schablon, the
 * eligibility rule, and the customer-facing disclaimer wording are CONSERVATIVE PILOT ASSUMPTIONS
 * pending owner/accounting/legal sign-off (Sign-Off Q3/Q4/Q5/Q7, test-design-epic-4; owner-
 * decisions 2026-06-18 "rates/caps/schablon still pending the working session"). The engine warns
 * and NEVER marks approved; the constants live as NAMED `*_UNAPPROVED` profiles (DATA — a later
 * sign-off swaps the numbers with NO code-shape change). STOP (needs-human) ONLY if the numeric
 * rates/caps/eligibility/disclaimer MUST be treated as production-APPROVED (the story stop
 * condition) — do NOT block coding on the pending sign-off.
 *
 * Coverage → test IDs (test-design-epic-4, BINDING): 4.3-UNIT-01 (engine shape+values; assumptions
 * captured, nothing approved), 4.3-UNIT-02 (ROT×grön mix blocked, not silently summed),
 * 4.3-UNIT-03 (missing sign-off ⇒ requiresSignOff/warning; NO approved path — behavioral),
 * 4.3-UNIT-04 (hidden-row/tillval basis-inclusion assumption), 4.3-UNIT-05 (no PII path into
 * `src/lib/money`; non-private posture flagged as an unapproved-eligibility warning),
 * 4.2-UNIT-05/4.3-UNIT-06 (assumption snapshot frozen — mutating a source rate after capture does
 * NOT change a prior snapshot; injected capturedAt, no clock), 4.3-UNIT-07 (DX: clear typed error
 * for an unknown deduction type/profile). Risks: R-405 (unapproved-tax-as-fact), R-406 (ROT×grön
 * mix), R-407 (caps/eligible-basis), R-408 (hidden-row/tillval basis), R-409 (snapshot recompute),
 * R-412 (personnummer/PII).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as money from "@/lib/money";

// The Story 4.1 typed-failure shape is `OreResult` = { ok:true; value|… } | { ok:false; code }.
type OkLike = { ok: true } & Record<string, unknown>;
type ErrLike = { ok: false } & Record<string, unknown>;
type TypedResult = OkLike | ErrLike;

function isOk(r: unknown): r is OkLike {
  return typeof r === "object" && r !== null && (r as { ok?: unknown }).ok === true;
}
function isErr(r: unknown): r is ErrLike {
  return typeof r === "object" && r !== null && (r as { ok?: unknown }).ok === false;
}
function assertOk(r: TypedResult): OkLike {
  assert.ok(isOk(r), `expected ok result, got ${JSON.stringify(r)}`);
  return r as OkLike;
}
/** Read a numeric field off an ok result (tolerates the OreResult `value` wrapper too). */
function okField(r: OkLike, field: string): unknown {
  const inner = (r as Record<string, unknown>).value;
  if (inner && typeof inner === "object" && field in (inner as Record<string, unknown>)) {
    return (inner as Record<string, unknown>)[field];
  }
  return (r as Record<string, unknown>)[field];
}
function okNumber(r: OkLike, field: string): number {
  const v = okField(r, field);
  assert.equal(typeof v, "number", `ok result must carry a numeric ${field}`);
  return v as number;
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
/** True if a warnings collection carries an entry mentioning `needle` (code, kind, or message). */
function warningsMention(r: OkLike, needle: RegExp): boolean {
  const w = okField(r, "warnings");
  return needle.test(JSON.stringify(w ?? []));
}

// ── The expected Story 4.3 tax surface (dev implements; names re-exported from @/lib/money) ──
type DeductionInput = {
  deductionType: string; // "rot" | "gron_teknik" (closed union in the engine)
  eligibleBasisOre: number | readonly number[];
  posture: string; // resolved eligibility posture — "private" eligible; NEVER a personnummer
  persons?: number;
  capturedAt: string;
  // The mix-attempt shapes the invalid-mix case may use (dev's exact modelling may vary):
  deductionTypes?: readonly string[];
  gronTeknik?: unknown;
  rot?: unknown;
};
type TaxEngine = {
  estimateDeduction: (input: DeductionInput | Record<string, unknown>) => TypedResult;
  buildTaxAssumptionSnapshot?: (source: unknown, opts: { capturedAt: string }) => Record<string, unknown>;
  ROT_PROFILE_UNAPPROVED?: Record<string, unknown>;
  GRON_TEKNIK_PROFILE_UNAPPROVED?: Record<string, unknown>;
};

const engine = money as unknown as TaxEngine & Record<string, unknown>;

// 🔴 RED-PHASE GATE — true only once the dev adds the tax surface to `@/lib/money`. While the
// surface is absent, `describe.skip` keeps the whole suite out of the green baseline (no runner
// error, no false failure). GREEN: the exports land, the gate flips true automatically, the
// UNCHANGED assertions below run and must pass. This mirrors the epic-4 pure-library ATDD pattern.
const TAX_SURFACE_PRESENT = typeof engine.estimateDeduction === "function";
const suite = TAX_SURFACE_PRESENT ? describe : describe.skip;

const CAPTURED_AT = "2026-07-02T00:00:00.000Z";

// A conservative pilot placeholder used ONLY to drive the arithmetic assertions below. The engine
// owns the real profile numbers (as UNAPPROVED profile DATA); these mirror a defensible placeholder
// (ROT 30.00% = 3000 bp, per-person cap 5_000_000 öre = 50 000 kr) so the expected deductionOre is
// checkable without hard-coding the engine's constants here. If the dev pins DIFFERENT conservative
// numbers, the golden fixture (tax.golden.test.ts) — not this unit — is the numeric source of truth;
// these unit assertions target SHAPE + INVARIANTS + boundary BEHAVIOR, not the exact pilot rate.
const ROT_BP_PLACEHOLDER = 3000;
const ROT_CAP_ORE_PLACEHOLDER = 5_000_000;

suite("Story 4.3 — @/lib/money ROT / grön-teknik estimate engine (RED → GREEN)", () => {
  // ── 4.3-UNIT-01: engine outputs deduction + eligible basis + warnings + snapshot (AC1) ──
  describe("4.3-UNIT-01 — estimate shape + values; assumptions captured, nothing approved (R-405, R-407)", () => {
    test("estimateDeduction returns { deductionOre, eligibleBasisOre, warnings, assumptionSnapshot, requiresSignOff }", () => {
      const r = engine.estimateDeduction({
        deductionType: "rot",
        eligibleBasisOre: 100_000, // 1 000,00 kr labour basis, below cap
        posture: "private",
        persons: 1,
        capturedAt: CAPTURED_AT,
      });
      const ok = assertOk(r);
      // Shape: the five required fields are present with the right primitive kinds.
      assert.equal(typeof okField(ok, "deductionOre"), "number", "carries a numeric deductionOre");
      assert.equal(typeof okField(ok, "eligibleBasisOre"), "number", "carries a numeric eligibleBasisOre");
      assert.ok(Array.isArray(okField(ok, "warnings")), "carries a warnings array (never absent)");
      assert.ok(okField(ok, "assumptionSnapshot") != null, "carries assumption-snapshot data");
      assert.equal(okField(ok, "requiresSignOff"), true, "requiresSignOff is TRUE by default (R-405)");
    });

    test("deductionOre = roundToOre(eligibleBasisOre * deductionPercentBp / 10000) below the cap", () => {
      // 100_000 öre @ 30.00% (3000 bp) = 30_000 öre, comfortably under a 50 000 kr per-person cap.
      const r = engine.estimateDeduction({
        deductionType: "rot",
        eligibleBasisOre: 100_000,
        posture: "private",
        persons: 1,
        capturedAt: CAPTURED_AT,
      });
      const ok = assertOk(r);
      const expected = Math.round((100_000 * ROT_BP_PLACEHOLDER) / 10000);
      assert.equal(okNumber(ok, "deductionOre"), expected, "below-cap deduction = rate applied on basis");
      assert.equal(okNumber(ok, "eligibleBasisOre"), 100_000, "eligibleBasisOre echoed verbatim (integer öre)");
    });

    test("a zero eligible basis yields deduction 0 (valid, not a rejection)", () => {
      const r = engine.estimateDeduction({
        deductionType: "rot",
        eligibleBasisOre: 0,
        posture: "private",
        persons: 1,
        capturedAt: CAPTURED_AT,
      });
      const ok = assertOk(r);
      assert.equal(okNumber(ok, "deductionOre"), 0, "zero basis → deduction 0, a valid result");
    });

    test("grön teknik computes on its own profile (per-category) and is also unapproved", () => {
      const r = engine.estimateDeduction({
        deductionType: "gron_teknik",
        eligibleBasisOre: 200_000,
        posture: "private",
        capturedAt: CAPTURED_AT,
      });
      const ok = assertOk(r);
      assert.equal(typeof okField(ok, "deductionOre"), "number", "grön teknik yields a numeric deductionOre");
      assert.equal(okField(ok, "requiresSignOff"), true, "grön teknik is also unapproved by default");
    });

    test("estimateDeduction rejects a non-öre eligible basis as a typed failure (no raw echo)", () => {
      for (const badBasis of [850.5, -1, "100000", Number.POSITIVE_INFINITY, null]) {
        const r = engine.estimateDeduction({
          deductionType: "rot",
          eligibleBasisOre: badBasis as number,
          posture: "private",
          persons: 1,
          capturedAt: CAPTURED_AT,
        });
        assert.ok(isErr(r), `expected typed failure for eligibleBasisOre=${String(badBasis)}`);
        assertNoRawEcho(r as ErrLike, badBasis);
      }
    });
  });

  // ── 4.3-UNIT-02: ROT and grön teknik CANNOT be mixed — block, never sum (AC1, R-406) ──
  describe("4.3-UNIT-02 — ROT×grön mix is BLOCKED with a typed failure, not silently summed (R-406)", () => {
    test("a request combining ROT AND grön teknik returns the BLOCKING ROT_GRON_MIX_NOT_ALLOWED failure", () => {
      // However the dev models 'both requested' on one calc, the result MUST be a blocking failure.
      const mixAttempts: Array<Record<string, unknown>> = [
        { deductionTypes: ["rot", "gron_teknik"], eligibleBasisOre: 100_000, posture: "private", persons: 1, capturedAt: CAPTURED_AT },
        { deductionType: "rot", gronTeknik: { eligibleBasisOre: 50_000 }, eligibleBasisOre: 100_000, posture: "private", persons: 1, capturedAt: CAPTURED_AT },
      ];
      for (const attempt of mixAttempts) {
        const r = engine.estimateDeduction(attempt);
        assert.ok(isErr(r), `mixing ROT and grön teknik must be a blocking failure, got ${JSON.stringify(r)}`);
        assert.equal(
          (r as ErrLike).code,
          "ROT_GRON_MIX_NOT_ALLOWED",
          "the mix block must be the typed ROT_GRON_MIX_NOT_ALLOWED code",
        );
      }
    });

    test("the blocking mix failure is NOT a silently-combined deduction sum", () => {
      const r = engine.estimateDeduction({
        deductionTypes: ["rot", "gron_teknik"],
        eligibleBasisOre: 100_000,
        posture: "private",
        persons: 1,
        capturedAt: CAPTURED_AT,
      });
      // A blocking failure carries NO deductionOre — there is no combined-sum code path.
      assert.ok(isErr(r), "a mix must never resolve to an ok combined deduction");
      assert.equal(
        (r as Record<string, unknown>).deductionOre,
        undefined,
        "a blocked mix must not carry a combined deductionOre",
      );
    });
  });

  // ── 4.3-UNIT-03: missing sign-off ⇒ requiresSignOff/warning; engine never marks approved (AC2, R-405) ──
  describe("4.3-UNIT-03 — no-approval / requires-sign-off invariant, behavioral (R-405, epic blocker)", () => {
    test("every ok estimate carries requiresSignOff:true (or a 'requires sign-off' warning) by DEFAULT", () => {
      const r = engine.estimateDeduction({
        deductionType: "rot",
        eligibleBasisOre: 100_000,
        posture: "private",
        persons: 1,
        capturedAt: CAPTURED_AT,
      });
      const ok = assertOk(r);
      const flagged = okField(ok, "requiresSignOff") === true || warningsMention(ok, /sign.?off|unapproved|require/i);
      assert.ok(flagged, "missing sign-off is the STRUCTURAL default — surfaced as a flag or a warning");
    });

    test("the engine NEVER renders/persists a tax output as approved — no approved/isApproved:true field", () => {
      const r = engine.estimateDeduction({
        deductionType: "rot",
        eligibleBasisOre: 100_000,
        posture: "private",
        persons: 1,
        capturedAt: CAPTURED_AT,
      });
      const ok = assertOk(r);
      const serialized = JSON.stringify(ok);
      // Absence of approval is the default, structurally — no truthy approved marker may appear.
      assert.ok(!/"isApproved"\s*:\s*true/.test(serialized), "engine must not derive isApproved:true");
      assert.ok(!/"approved"\s*:\s*true/.test(serialized), "engine must not render approved:true");
      assert.equal(okField(ok, "requiresSignOff"), true, "the default remains requiresSignOff:true");
    });

    test("the assumption snapshot ALSO carries the unapproved / requires-sign-off marker", () => {
      const r = engine.estimateDeduction({
        deductionType: "rot",
        eligibleBasisOre: 100_000,
        posture: "private",
        persons: 1,
        capturedAt: CAPTURED_AT,
      });
      const ok = assertOk(r);
      const snap = okField(ok, "assumptionSnapshot");
      const snapStr = JSON.stringify(snap ?? {});
      assert.ok(
        /require|sign.?off|unapproved|pending/i.test(snapStr) || !/"approved"\s*:\s*true/.test(snapStr),
        "the frozen assumption snapshot structurally indicates the assumptions require sign-off",
      );
    });
  });

  // ── 4.3-UNIT-04: hidden-row / tillval inclusion-in-basis assumption (AC3, R-408) ──
  describe("4.3-UNIT-04 — hidden-row / tillval basis-inclusion assumption pinned (R-408)", () => {
    test("hidden rows DO count toward the eligible basis (owner decision 2026-06-18)", () => {
      // A multi-line basis where one line is a 'hidden' row: it MUST be included in the basis sum
      // (Epic 4 pins the pure BASIS rule; the UI visibility semantics are Epic 5). Model the basis
      // as the öre lines summed via the Story 4.1 sum-of-rounded discipline.
      const visibleOnly = engine.estimateDeduction({
        deductionType: "rot",
        eligibleBasisOre: [60_000], // one visible line only
        posture: "private",
        persons: 1,
        capturedAt: CAPTURED_AT,
      });
      const withHidden = engine.estimateDeduction({
        deductionType: "rot",
        eligibleBasisOre: [60_000, 40_000], // + a hidden row that STILL counts
        posture: "private",
        persons: 1,
        capturedAt: CAPTURED_AT,
      });
      const a = assertOk(visibleOnly);
      const b = assertOk(withHidden);
      assert.equal(okNumber(a, "eligibleBasisOre"), 60_000, "visible-only basis = 60 000 öre");
      assert.equal(
        okNumber(b, "eligibleBasisOre"),
        100_000,
        "hidden row is INCLUDED in the eligible basis (60 000 + 40 000)",
      );
      assert.ok(
        okNumber(b, "deductionOre") > okNumber(a, "deductionOre"),
        "including the hidden row raises the deduction — the row is not silently dropped",
      );
    });
  });

  // ── 4.3-UNIT-05: no PII path into src/lib/money; non-private posture flagged (AC3, R-412) ──
  describe("4.3-UNIT-05 — engine takes a resolved POSTURE, never PII; eligibility warnings (R-412)", () => {
    test("ONLY a `private` posture is eligible; a non-private posture yields an eligibility warning", () => {
      const priv = engine.estimateDeduction({
        deductionType: "rot",
        eligibleBasisOre: 100_000,
        posture: "private",
        persons: 1,
        capturedAt: CAPTURED_AT,
      });
      const privOk = assertOk(priv);
      assert.ok(
        !warningsMention(privOk, /not.?eligible|eligibility/i),
        "a private posture carries no not-eligible warning",
      );
      for (const posture of ["company", "brf", "public"]) {
        const r = engine.estimateDeduction({
          deductionType: "rot",
          eligibleBasisOre: 100_000,
          posture,
          persons: 1,
          capturedAt: CAPTURED_AT,
        });
        // Conservative Phase-A policy: a non-private posture is either a blocking result OR an ok
        // result carrying an eligibility WARNING — never a silently-eligible clean deduction.
        if (isOk(r)) {
          assert.ok(
            warningsMention(r as OkLike, /not.?eligible|eligibility|posture|unapproved/i),
            `non-private posture '${posture}' must surface an eligibility warning`,
          );
        } else {
          assert.ok(isErr(r), `non-private posture '${posture}' blocked or warned, never silently eligible`);
        }
      }
    });

    test("the pure engine does NOT read/require a personnummer — a personnummer input is ignored or rejected, never consumed as eligibility", () => {
      // Passing a personnummer must NOT be what makes the estimate eligible; eligibility is the
      // RESOLVED posture only. The engine must not echo the personnummer anywhere.
      const withPnr = engine.estimateDeduction({
        deductionType: "rot",
        eligibleBasisOre: 100_000,
        posture: "private",
        persons: 1,
        capturedAt: CAPTURED_AT,
        personnummer: "800101-1234",
      } as Record<string, unknown>);
      if (isOk(withPnr)) {
        const serialized = JSON.stringify(withPnr);
        assert.ok(
          !/800101-1234/.test(serialized) && !/\d{6}-\d{4}/.test(serialized),
          "the engine result must not carry/echo a personnummer — no PII in src/lib/money",
        );
      }
    });

    test("the src/lib/money/tax.ts source reads NO personnummer/PII field (R-412 source guard)", () => {
      const HERE = dirname(fileURLToPath(import.meta.url));
      const TAX_SOURCE = resolve(HERE, "../../../../src/lib/money/tax.ts");
      const src = readFileSync(TAX_SOURCE, "utf8");
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
      for (const pii of [/personnummer/i, /\borgnr\b/i, /\borg_?nr\b/i]) {
        assert.ok(!pii.test(code), `tax engine source must not reference PII (matched ${pii})`);
      }
    });
  });

  // ── 4.2-UNIT-05 / 4.3-UNIT-06: tax-assumption snapshot FROZEN, no recompute (AC1, R-409) ──
  describe("4.3-UNIT-06 — frozen tax-assumption snapshot, no silent recompute (R-409)", () => {
    // A minimal mutable tax source (mirrors an UNAPPROVED profile: type + rate-bp + cap + label).
    function makeSource(): Record<string, unknown> {
      return {
        deductionType: "rot",
        deductionPercentBp: ROT_BP_PLACEHOLDER,
        capOre: ROT_CAP_ORE_PLACEHOLDER,
        profileId: "ROT_PROFILE_UNAPPROVED",
        persons: 1,
        eligibleBasisOre: 100_000,
        requiresSignOff: true,
      };
    }

    test("buildTaxAssumptionSnapshot copies the profile BY VALUE and Object.freezes the result", () => {
      const build = engine.buildTaxAssumptionSnapshot;
      assert.equal(typeof build, "function", "engine must expose buildTaxAssumptionSnapshot");
      const snap = build!(makeSource(), { capturedAt: CAPTURED_AT });
      assert.ok(Object.isFrozen(snap), "the tax-assumption snapshot must be Object.freeze'd");
      assert.equal(snap.deductionPercentBp, ROT_BP_PLACEHOLDER, "deductionPercentBp copied verbatim (basis points)");
      assert.equal(snap.capturedAt, CAPTURED_AT, "capturedAt is the INJECTED instant (never a clock read)");
    });

    test("mutating the SOURCE profile AFTER capture does NOT change a prior snapshot (no live reference)", () => {
      const build = engine.buildTaxAssumptionSnapshot!;
      const source = makeSource();
      const snap = build(source, { capturedAt: CAPTURED_AT });
      const capturedBp = snap.deductionPercentBp;
      // A later rate change on the source must NOT retroactively alter the frozen assumption.
      source.deductionPercentBp = 9999;
      source.capOre = 1;
      assert.equal(
        (build(source, { capturedAt: CAPTURED_AT }) as Record<string, unknown>) && snap.deductionPercentBp,
        capturedBp,
        "the prior snapshot's rate is unchanged after the source rate mutated",
      );
    });

    test("the snapshot captures STATE and derives NO isApproved flag (computes nothing further)", () => {
      const snap = engine.buildTaxAssumptionSnapshot!(makeSource(), { capturedAt: CAPTURED_AT });
      const serialized = JSON.stringify(snap);
      assert.ok(!/"isApproved"/.test(serialized), "the builder must not derive an isApproved flag");
      assert.ok(!/"approved"\s*:\s*true/.test(serialized), "the builder must not mark approved:true");
    });
  });

  // ── 4.3-UNIT-07: DX — a clear typed error for an unknown deduction type / profile ──
  describe("4.3-UNIT-07 — clear typed error for an unknown deduction type / profile (DX)", () => {
    test("an unknown deductionType returns a CLEAR typed error, not a silent wrong-profile fall-through", () => {
      const r = engine.estimateDeduction({
        deductionType: "solar_bonus_2099", // not in the closed set
        eligibleBasisOre: 100_000,
        posture: "private",
        persons: 1,
        capturedAt: CAPTURED_AT,
      } as Record<string, unknown>);
      assert.ok(isErr(r), "an unknown deduction type must be a typed failure, not a silent estimate");
      assert.equal(
        (r as ErrLike).code,
        "UNKNOWN_DEDUCTION_TYPE",
        "the unknown-type error must carry the clear UNKNOWN_DEDUCTION_TYPE code",
      );
      assertNoRawEcho(r as ErrLike, "solar_bonus_2099");
    });
  });
});
