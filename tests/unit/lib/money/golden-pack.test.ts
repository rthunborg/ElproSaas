/**
 * Story 4.4 — the MONEY & TAX GOLDEN-MASTER PACK (4.4-GOLDEN-01 / 4.4-GOLDEN-02 / 4.4-UNIT-01 /
 * 4.4-UNIT-02, R-410 + R-411). This is the load-bearing 4.4 deliverable: a structured, anonymized
 * ORACLE where EVERY AC1 category is represented across the pack and EVERY expected value carries a
 * three-way `origin` label (`old-lovable` / `new-expected` / `documented-delta`) + a `note`, so a
 * future money/tax change produces a golden FAILURE that points at the affected assumption/delta
 * rather than an unexplained diff.
 *
 * The pack REUSES the three per-category oracle fixtures as the source of truth for their categories
 * (rounding-mode.json = rounding; vat-rates.json = regular VAT + fractional qty; rot-gron-
 * deductions.json = ROT / grön / caps / invalid mix / hidden rows / eligibility) and ADDS the two
 * not-yet-pinned categories as NEW fixtures — options/tillval inclusion (options-tillval.json) and
 * accepted-price deltas (accepted-price-deltas.json). It does NOT re-pin or contradict any 4.1/4.2/
 * 4.3 numeric value: there stays ONE numeric authority per category. It CONSUMES the frozen
 * `@/lib/money` primitives as the oracle (`sumOre` / `lineVatOre` / `vatBreakdown` / `estimateDeduction`)
 * — it adds NO exported engine symbol and forks NO primitive.
 *
 * This test provides the four pack-level guards:
 *   1. COVERAGE (4.4-GOLDEN-01) — a manifest/checklist that FAILS if any AC1 category has no
 *      representing case in the pack.
 *   2. LABELLING (4.4-GOLDEN-02) — every NEW case carries a valid `origin` + a non-empty `note`; a
 *      `documented-delta` case ALSO carries the divergent old-Lovable value it diverges from.
 *   3. BEHAVIORAL GOLDEN — the NEW numeric cases (options/tillval + accepted-price delta) drive the
 *      REAL engine so the fixtures are LIVE oracles, not static schema.
 *   4. SCHEMA-SHAPE GUARD (4.4-UNIT-02) — a contract-shape assertion so a malformed/half-authored
 *      fixture (missing `_doc`/`policy`/cases, missing `origin`, missing expected öre) FAILS loud.
 *   + EXTENDED PRIVACY SCAN (4.4-UNIT-01, R-411) — the reused + extended anonymization scan over the
 *      DATA payload of ALL money golden fixtures (personnummer, explicit orgnr, non-example.test
 *      email, secret/password/api_key, PHONE, ADDRESS heuristics), so the pack-wide privacy
 *      guarantee is one authority.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB. Fixtures under
 * tests/fixtures/golden/money/ (anonymized; money/öre/rate numbers only, NFR17). The `@/lib/money`
 * barrel resolves under `node --test` via the Story 4.1 alias-hook — imported at the top level; the
 * 4.1/4.2/4.3 engine surface already EXISTS, so the pack is authored + greened in ONE pass (no
 * red-phase gate; there was NO ATDD phase for 4.4).
 *
 * POLICY STATUS: every expected value in the NEW fixtures is a CONSERVATIVE PILOT ASSUMPTION
 * (`new-expected` / `documented-delta` / `old-lovable`) with `signOff: "pending-owner-accounting-
 * legal"` — the pack marks NOTHING production-approved and re-approves NONE of the 4.1/4.2/4.3
 * assumptions. The accepted-price-delta representation is a pilot assumption pending Sign-Off Q8.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as money from "@/lib/money";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = resolve(HERE, "../../../fixtures/golden/money");

// ── The frozen 4.1/4.2/4.3 engine surface consumed as the ORACLE (no new symbol, no fork) ──
type OkLike = { ok: true } & Record<string, unknown>;
function isOk(r: unknown): r is OkLike {
  return typeof r === "object" && r !== null && (r as { ok?: unknown }).ok === true;
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
/** Read the bare öre `value` off an OreResult ok arm. */
function okOre(r: OkLike): number {
  const v = (r as Record<string, unknown>).value;
  assert.equal(typeof v, "number", "ok OreResult must carry a numeric value");
  return v as number;
}

type MoneyOracle = {
  sumOre: (values: readonly number[]) => OkLike | { ok: false };
  lineVatOre: (lineNetOre: number, vatRateBp: number) => OkLike | { ok: false };
  vatBreakdown: (netOre: number, vatRateBp: number) => OkLike | { ok: false };
  estimateDeduction: (input: Record<string, unknown>) => OkLike | ({ ok: false } & Record<string, unknown>);
};
const engine = money as unknown as MoneyOracle & Record<string, unknown>;

const CAPTURED_AT = "2026-07-02T00:00:00.000Z";
const ORIGINS = ["old-lovable", "new-expected", "documented-delta"] as const;
type Origin = (typeof ORIGINS)[number];
function isValidOrigin(v: unknown): v is Origin {
  return typeof v === "string" && (ORIGINS as readonly string[]).includes(v);
}

// ── Fixture typings for the two NEW 4.4 fixtures ───────────────────────────────────
interface InclusionCase {
  readonly id: string;
  readonly origin: Origin;
  readonly note: string;
  readonly baseLinesOre?: readonly number[];
  readonly selectedOptionOre?: number;
  readonly unselectedOptionOre?: number;
  readonly includedLinesOre?: readonly number[];
  readonly expectedIncludedNetOre?: number;
  readonly excludedWouldGive?: number;
  readonly vatRateBp?: number;
  readonly expectedPerLineVatOre?: readonly number[];
  readonly expectedSectionVatOre?: number;
  readonly unselectedOptionVatWouldAdd?: number;
  readonly deductionType?: string;
  readonly eligibleBasisLines?: readonly number[];
  readonly posture?: string;
  readonly persons?: number;
  readonly expectedEligibleBasisOre?: number;
  readonly expectedDeductionOre?: number;
  readonly expectRequiresSignOff?: boolean;
}
interface OptionsFixture {
  readonly _doc?: string;
  readonly policy: Record<string, string>;
  readonly inclusionCases: readonly InclusionCase[];
}
interface DeltaCase {
  readonly id: string;
  readonly origin: Origin;
  readonly note: string;
  readonly acceptedTotalOre: number;
  readonly recalculatedTotalOre: number;
  readonly expectedDeltaOre: number;
  readonly oldLovableWouldGive?: number;
  readonly newExpectedOre?: number;
  readonly recalcNetOre?: number;
  readonly recalcVatRateBp?: number;
}
interface DeltaFixture {
  readonly _doc?: string;
  readonly policy: Record<string, string>;
  readonly deltaCases: readonly DeltaCase[];
}

function readJson(name: string): unknown {
  return JSON.parse(readFileSync(resolve(GOLDEN_DIR, name), "utf8"));
}
function loadOptions(): OptionsFixture {
  return readJson("options-tillval.json") as OptionsFixture;
}
function loadDeltas(): DeltaFixture {
  return readJson("accepted-price-deltas.json") as DeltaFixture;
}

// ── The pack manifest: every AC1 category -> the fixture(s) that pin it ──────────────
// The reused 4.1/4.2/4.3 fixtures own their categories; the pack REFERENCES them (asserting they
// exist + carry the category) rather than re-encoding the numbers. The two NEW fixtures add the
// not-yet-pinned categories.
const AC1_CATEGORIES = [
  "regular-vat",
  "rot",
  "gron-teknik",
  "caps",
  "invalid-mix",
  "options-tillval",
  "hidden-rows",
  "fractional-quantities",
  "rounding",
  "accepted-price-deltas",
] as const;

/** For each AC1 category: the fixture file that pins it + a token that MUST appear in that file. */
const CATEGORY_MANIFEST: Record<
  (typeof AC1_CATEGORIES)[number],
  { readonly file: string; readonly token: string }
> = {
  "regular-vat": { file: "vat-rates.json", token: "lineVatCases" },
  rot: { file: "rot-gron-deductions.json", token: "\"deductionType\": \"rot\"" },
  "gron-teknik": { file: "rot-gron-deductions.json", token: "gron_teknik" },
  caps: { file: "rot-gron-deductions.json", token: "capHit" },
  "invalid-mix": { file: "rot-gron-deductions.json", token: "ROT_GRON_MIX_NOT_ALLOWED" },
  "options-tillval": { file: "options-tillval.json", token: "inclusionCases" },
  "hidden-rows": { file: "rot-gron-deductions.json", token: "hidden-row" },
  "fractional-quantities": { file: "vat-rates.json", token: "fractionalQuantityChainCase" },
  rounding: { file: "rounding-mode.json", token: "halfRoundingMode" },
  "accepted-price-deltas": { file: "accepted-price-deltas.json", token: "deltaCases" },
};

describe("Story 4.4 — money & tax golden-master PACK (4.4-GOLDEN-01/02, R-410/R-411)", () => {
  // ────────────────────────────────────────────────────────────────────────────────
  // 1) COVERAGE (4.4-GOLDEN-01) — the pack collectively covers EVERY AC1 category.
  // ────────────────────────────────────────────────────────────────────────────────
  test("[P0] the pack COVERS every AC1 category (manifest checklist fails if a category is unpinned)", () => {
    for (const category of AC1_CATEGORIES) {
      const entry = CATEGORY_MANIFEST[category];
      const path = resolve(GOLDEN_DIR, entry.file);
      assert.ok(existsSync(path), `AC1 category '${category}' -> fixture ${entry.file} must exist`);
      const raw = readFileSync(path, "utf8");
      assert.ok(
        raw.includes(entry.token),
        `AC1 category '${category}' must be represented in ${entry.file} (token '${entry.token}' not found)`,
      );
    }
    // Guard the manifest itself: every declared category is mapped (no silent gap).
    assert.equal(
      Object.keys(CATEGORY_MANIFEST).length,
      AC1_CATEGORIES.length,
      "every AC1 category must have a manifest entry",
    );
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // 2) LABELLING (4.4-GOLDEN-02) — every NEW case carries origin + note; documented-delta
  //    additionally carries the divergent old-Lovable value it diverges from.
  // ────────────────────────────────────────────────────────────────────────────────
  test("[P0] every NEW options/tillval case carries a valid origin + a non-empty note", () => {
    const fx = loadOptions();
    assert.ok(fx.inclusionCases.length >= 1, "options fixture must carry >=1 case");
    for (const c of fx.inclusionCases) {
      assert.ok(isValidOrigin(c.origin), `${c.id}: origin must be one of old-lovable/new-expected/documented-delta (got ${String(c.origin)})`);
      assert.ok(typeof c.note === "string" && c.note.trim().length > 0, `${c.id}: a non-empty note is required (an unlabelled/note-less golden is a silent-regression trap)`);
    }
  });

  test("[P0] every NEW accepted-price-delta case carries a valid origin + a non-empty note; documented-delta carries the divergent old-Lovable value", () => {
    const fx = loadDeltas();
    assert.ok(fx.deltaCases.length >= 1, "delta fixture must carry >=1 case");
    for (const c of fx.deltaCases) {
      assert.ok(isValidOrigin(c.origin), `${c.id}: origin must be a valid three-way label (got ${String(c.origin)})`);
      assert.ok(typeof c.note === "string" && c.note.trim().length > 0, `${c.id}: a non-empty note is required`);
      if (c.origin === "documented-delta") {
        // A documented-delta MUST record the value it diverges FROM so a failing golden is explainable.
        assert.equal(
          typeof c.oldLovableWouldGive,
          "number",
          `${c.id}: a documented-delta case must carry the divergent old-Lovable value (oldLovableWouldGive)`,
        );
      }
      if (c.origin === "old-lovable") {
        // An old-lovable case documents the Lovable-origin number explicitly.
        assert.equal(
          typeof c.oldLovableWouldGive,
          "number",
          `${c.id}: an old-lovable case must document the captured Lovable value (oldLovableWouldGive)`,
        );
      }
    }
    // The pack must EXERCISE all three origin labels so the three-way union is genuinely used
    // (not just typed): at least one old-lovable, one new-expected, and one documented-delta case.
    const origins = new Set(fx.deltaCases.map((c) => c.origin));
    for (const required of ORIGINS) {
      assert.ok(origins.has(required), `the delta fixture must exercise the '${required}' origin label`);
    }
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // 3) BEHAVIORAL GOLDEN — the NEW cases drive the REAL engine (live oracle).
  // ────────────────────────────────────────────────────────────────────────────────
  test("[P0] options/tillval — a SELECTED option COUNTS toward the included net; an UNSELECTED option does NOT (R-408)", () => {
    const fx = loadOptions();
    const selected = fx.inclusionCases.find((c) => c.id === "selected-option-counts-toward-net");
    const unselected = fx.inclusionCases.find((c) => c.id === "unselected-option-excluded-from-net");
    assert.ok(selected?.includedLinesOre && typeof selected.expectedIncludedNetOre === "number", "selected-option case must be present + numeric");
    assert.ok(unselected?.includedLinesOre && typeof unselected.expectedIncludedNetOre === "number", "unselected-option case must be present + numeric");

    // Selected option counts: the included set (base + selected option) sums to the pinned net.
    const selectedNet = engine.sumOre(selected!.includedLinesOre!);
    assert.ok(isOk(selectedNet));
    assert.equal(okOre(selectedNet as OkLike), selected!.expectedIncludedNetOre, selected!.note);

    // Unselected option excluded: the included set (base only) sums to the pinned net, and NOT to
    // the value it would be if the unselected option were wrongly summed in.
    const unselectedNet = engine.sumOre(unselected!.includedLinesOre!);
    assert.ok(isOk(unselectedNet));
    assert.equal(okOre(unselectedNet as OkLike), unselected!.expectedIncludedNetOre, unselected!.note);
    if (typeof unselected!.excludedWouldGive === "number") {
      assert.notEqual(
        okOre(unselectedNet as OkLike),
        unselected!.excludedWouldGive,
        `${unselected!.id}: the unselected option was summed in — inclusion rule violated`,
      );
    }
  });

  test("[P0] options/tillval — the SELECTED option's per-line VAT is included in the section VAT total (sum-of-rounded)", () => {
    const fx = loadOptions();
    const c = fx.inclusionCases.find((x) => x.id === "selected-option-counts-toward-vat");
    assert.ok(c?.includedLinesOre && typeof c.vatRateBp === "number" && typeof c.expectedSectionVatOre === "number", "VAT-inclusion case must be present + numeric");
    const perLine = c!.includedLinesOre!.map((net) => {
      const r = engine.lineVatOre(net, c!.vatRateBp!);
      assert.ok(isOk(r), `lineVatOre(${net}, ${c!.vatRateBp}) must be ok`);
      return okOre(r as OkLike);
    });
    if (c!.expectedPerLineVatOre) {
      assert.deepEqual(perLine, [...c!.expectedPerLineVatOre], `${c!.id}: per-line VAT must match the pinned öre`);
    }
    const total = engine.sumOre(perLine);
    assert.ok(isOk(total));
    assert.equal(okOre(total as OkLike), c!.expectedSectionVatOre, c!.note);
  });

  test("[P0] options/tillval — a HIDDEN row COUNTS toward the ROT deduction basis (R-408, owner decision 2026-06-18)", () => {
    const fx = loadOptions();
    const c = fx.inclusionCases.find((x) => x.id === "hidden-row-counts-toward-deduction-basis");
    assert.ok(c?.eligibleBasisLines && typeof c.expectedDeductionOre === "number", "hidden-row deduction case must be present + numeric");
    const r = engine.estimateDeduction({
      deductionType: c!.deductionType,
      eligibleBasisOre: c!.eligibleBasisLines,
      posture: c!.posture,
      persons: c!.persons,
      capturedAt: CAPTURED_AT,
    });
    assert.ok(isOk(r), `${c!.id}: expected ok estimate, got ${JSON.stringify(r)}`);
    assert.equal(okNumber(r as OkLike, "eligibleBasisOre"), c!.expectedEligibleBasisOre, `${c!.id}: hidden row must be INCLUDED in the eligible basis`);
    assert.equal(okNumber(r as OkLike, "deductionOre"), c!.expectedDeductionOre, c!.note);
    if (c!.expectRequiresSignOff) {
      assert.equal((r as Record<string, unknown>).requiresSignOff, true, `${c!.id}: the UNAPPROVED profile still requires sign-off`);
    }
  });

  test("[P0] accepted-price delta — delta öre = recalculated − accepted, recomputed on the fixture öre (shape-only, feeds Epic 7)", () => {
    const fx = loadDeltas();
    for (const c of fx.deltaCases) {
      assert.equal(typeof c.acceptedTotalOre, "number", `${c.id}: acceptedTotalOre must be a number`);
      assert.equal(typeof c.recalculatedTotalOre, "number", `${c.id}: recalculatedTotalOre must be a number`);
      // Plain integer arithmetic on the fixture öre (no new engine surface) — the delta is a SHAPE.
      const delta = c.recalculatedTotalOre - c.acceptedTotalOre;
      assert.equal(delta, c.expectedDeltaOre, `${c.id} (${c.origin}): ${c.note}`);
    }
  });

  test("[P0] accepted-price delta — the old-lovable hardcoded-25% recalc reproduces the frozen gross via the basis-point engine (explainable)", () => {
    const fx = loadDeltas();
    const c = fx.deltaCases.find((x) => x.id === "old-lovable-hardcoded-25pct-gross");
    assert.ok(c?.recalcNetOre !== undefined && c.recalcVatRateBp !== undefined, "the old-lovable recalc case must carry the net + bp to recompute");
    const r = engine.vatBreakdown(c!.recalcNetOre!, c!.recalcVatRateBp!);
    assert.ok(isOk(r), `${c!.id}: vatBreakdown must be ok`);
    assert.equal(okNumber(r as OkLike, "grossOre"), c!.recalculatedTotalOre, `${c!.id}: the new engine reproduces the frozen gross — the delta (0) is explainable, not an unexplained diff`);
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // 4) SCHEMA-SHAPE GUARD (4.4-UNIT-02) — a malformed/half-authored NEW fixture fails loud.
  // ────────────────────────────────────────────────────────────────────────────────
  test("[P1] fixture schema-shape guard — required top-level keys + every case's required fields (4.4-UNIT-02)", () => {
    // options-tillval.json contract shape.
    const optRaw = readJson("options-tillval.json") as Record<string, unknown>;
    assert.equal(typeof optRaw._doc, "string", "options fixture must carry a _doc provenance string");
    assert.equal(typeof optRaw.policy, "object", "options fixture must carry a policy block");
    assert.ok(Array.isArray(optRaw.inclusionCases), "options fixture must carry an inclusionCases array");
    for (const c of loadOptions().inclusionCases) {
      assert.equal(typeof c.id, "string", "each inclusion case needs an id");
      assert.ok(isValidOrigin(c.origin), `${c.id}: missing/invalid origin`);
      assert.ok(typeof c.note === "string" && c.note.length > 0, `${c.id}: missing note`);
      // Each case must carry AT LEAST one expected numeric öre value (no vacuous case).
      const expectedNumbers = [c.expectedIncludedNetOre, c.expectedSectionVatOre, c.expectedDeductionOre, c.expectedEligibleBasisOre].filter(
        (v) => typeof v === "number",
      );
      assert.ok(expectedNumbers.length >= 1, `${c.id}: a case must carry at least one expected öre value (missing expected value = half-authored)`);
    }

    // accepted-price-deltas.json contract shape.
    const deltaRaw = readJson("accepted-price-deltas.json") as Record<string, unknown>;
    assert.equal(typeof deltaRaw._doc, "string", "delta fixture must carry a _doc provenance string");
    assert.equal(typeof deltaRaw.policy, "object", "delta fixture must carry a policy block");
    assert.ok(Array.isArray(deltaRaw.deltaCases), "delta fixture must carry a deltaCases array");
    for (const c of loadDeltas().deltaCases) {
      assert.equal(typeof c.id, "string", "each delta case needs an id");
      assert.ok(isValidOrigin(c.origin), `${c.id}: missing/invalid origin`);
      assert.ok(typeof c.note === "string" && c.note.length > 0, `${c.id}: missing note`);
      assert.equal(typeof c.acceptedTotalOre, "number", `${c.id}: missing acceptedTotalOre`);
      assert.equal(typeof c.recalculatedTotalOre, "number", `${c.id}: missing recalculatedTotalOre`);
      assert.equal(typeof c.expectedDeltaOre, "number", `${c.id}: missing expected value (expectedDeltaOre)`);
      // Öre must be integers (the money discipline — no fractional öre in a fixture).
      assert.ok(Number.isInteger(c.acceptedTotalOre), `${c.id}: acceptedTotalOre must be an integer öre`);
      assert.ok(Number.isInteger(c.recalculatedTotalOre), `${c.id}: recalculatedTotalOre must be an integer öre`);
      assert.ok(Number.isInteger(c.expectedDeltaOre), `${c.id}: expectedDeltaOre must be an integer öre`);
    }
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // + EXTENDED PRIVACY SCAN (4.4-UNIT-01, R-411) — the pack-wide anonymization authority.
  //   Reuses the existing scan (personnummer, non-example.test email, secret/password/api_key) and
  //   EXTENDS it with an explicit ORGNR assertion + PHONE + ADDRESS heuristics AC2 names. Scans the
  //   DATA payload (NOT the _doc prose, which legitimately names the PII rules) of ALL money golden
  //   fixtures so the pack-wide privacy guarantee is one authority.
  // ────────────────────────────────────────────────────────────────────────────────
  test("[P0] extended privacy scan — no real PII/secret in ANY money golden fixture DATA payload (R-411, epic blocker)", () => {
    const files = [
      "rounding-mode.json",
      "vat-rates.json",
      "rot-gron-deductions.json",
      "options-tillval.json",
      "accepted-price-deltas.json",
    ];
    // Reused + extended PII/secret classes. Each fixture's DATA is scanned WITHOUT its `_doc` prose.
    const PERSONNUMMER = /\b\d{6}-\d{4}\b/; // YYMMDD-NNNN
    // Swedish orgnr is a genuinely DISTINCT shape from the dashed personnummer: the 10-digit no-dash
    // form (`5560000000`). Scanning it separately delivers real added detection coverage (a bare
    // 10-digit orgnr is caught by neither the dashed personnummer nor the money öre fixtures, which
    // carry no 10-digit runs) rather than a byte-identical duplicate of the personnummer guard.
    const ORGNR = /\b\d{10}\b/; // orgnr 10-digit no-dash shape — a distinct guard, not a personnummer alias (R-411)
    const NON_EXAMPLE_EMAIL = /@(?!example\.test\b)[a-z0-9.-]+\.[a-z]{2,}/i;
    const SECRET = /secret|password|api_key/i;
    // Swedish mobile phone shapes (+46 7X … / 07X …) — a conservative guard; money öre integers do
    // not match (no leading 07/+46 grouping with the 7-digit tail).
    const PHONE = /(?:\+?46|0)\s?7\d(?:[\s-]?\d){7}\b/;
    // Address heuristic: a street-type word followed by a number (a real address shape). The fixtures
    // carry ONLY öre/rate numbers + policy prose in the DATA, never a street address.
    const ADDRESS = /\b(gata|gatan|väg|vägen|street|road|avenue)\s+\d+/i;

    for (const file of files) {
      const path = resolve(GOLDEN_DIR, file);
      assert.ok(existsSync(path), `${file} must exist for the pack-wide privacy scan`);
      const parsed = readJson(file) as Record<string, unknown>;
      // Strip the _doc prose (it legitimately names personnummer/orgnr/phone/address as RULES).
      const { _doc, ...dataOnly } = parsed;
      assert.equal(typeof _doc, "string", `${file}: must carry a _doc note (scanned SEPARATELY from the data)`);
      const data = JSON.stringify(dataOnly);
      assert.ok(!PERSONNUMMER.test(data), `${file}: DATA must contain no personnummer shape (\\d{6}-\\d{4})`);
      assert.ok(!ORGNR.test(data), `${file}: DATA must contain no organization-number shape (orgnr, \\d{6}-\\d{4})`);
      assert.ok(!NON_EXAMPLE_EMAIL.test(data), `${file}: DATA must contain no non-example.test email`);
      assert.ok(!SECRET.test(data), `${file}: DATA must contain no secret/password/api_key`);
      assert.ok(!PHONE.test(data), `${file}: DATA must contain no phone number`);
      assert.ok(!ADDRESS.test(data), `${file}: DATA must contain no street address`);
    }
  });

  // Sanity: the two NEW fixtures re-approve NONE of the pending assumptions (labels stay pending).
  test("[P1] the NEW fixtures mark nothing production-approved — signOff stays pending (Q8 open)", () => {
    for (const fx of [loadOptions(), loadDeltas()] as { policy: Record<string, string> }[]) {
      assert.equal(fx.policy.signOff, "pending-owner-accounting-legal", "the pack must not silently re-approve any assumption");
    }
  });
});
