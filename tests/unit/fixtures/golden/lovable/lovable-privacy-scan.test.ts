/**
 * Story 9.2 — LOVABLE-PACK PRIVACY SCAN (RED-PHASE SCAFFOLD)
 * Covers 9.2-PRIV-01 (AC3) + the R-901/R-902 epic blocker + the seeded-PII positive control.
 *
 * This is the load-bearing 9.2 privacy guard: the shared anonymization scanner run over the DATA
 * payload of EVERY committed `tests/fixtures/golden/lovable/**` fixture, wired into the UNIT gate so
 * a seeded real PII/secret FAILS CI. The scan enumerates fixtures by an EXPLICIT manifest AND a
 * directory-glob backstop (Task 1.4) so a newly-added fixture cannot silently escape the scan.
 *
 * ── GREEN PHASE (Story 9.2 dev) ─────────────────────────────────────────────────────────
 * The shared scanner module (`@/tests-support/anonymization-scan`) AND the committed `lovable/**`
 * fixtures now exist, so the surface-present probe is TRUE and this suite RUNS (no longer skipped).
 * The assertions are UNCHANGED from the red-phase scaffold. Do NOT weaken the regexes — a looser
 * regex that misses a real value is worse than the current guard (Task 1.3). This is a HARD-asserting
 * suite (it fails if the scanner export or a required fixture is absent) — NOT a self-disabling gate
 * that green-passes on an absent surface (the vacuous-green trap, R-904).
 *
 * NO PII in this file. The seeded PII in the negative control is constructed INLINE (never written
 * to a lovable/** fixture — that would trip the real scan). [R-901]
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  GOLDEN_LOVABLE_DIR,
  listLovableFixtureFiles,
  loadScanner,
  lovableFixtureDirPresent,
  readJson,
} from "./lovable-pack-support";
import { existsSync } from "node:fs";

// The EXACT regex set ported from the money-pack scan (golden-pack.test.ts:388-401). This scaffold
// pins them here as the authority the GREEN shared scanner MUST match (do NOT invent looser ones).
const PERSONNUMMER = /\b\d{6}-\d{4}\b/; // YYMMDD-NNNN
const ORGNR = /\b\d{10}\b/; // orgnr 10-digit no-dash — distinct guard, not a personnummer alias
const NON_EXAMPLE_EMAIL = /@(?!example\.test\b)[a-z0-9.-]+\.[a-z]{2,}/i;
const SECRET = /secret|password|api_key/i;
const PHONE = /(?:\+?46|0)\s?7\d(?:[\s-]?\d){7}\b/;
const ADDRESS = /\b(gata|gatan|väg|vägen|street|road|avenue)\s+\d+/i;

/** Strip provenance prose keys (they legitimately NAME the PII rules) before scanning the DATA. */
function stripProse(obj: Record<string, unknown>): Record<string, unknown> {
  const dataOnly: Record<string, unknown> = { ...obj };
  delete dataOnly._doc;
  delete dataOnly._comment;
  delete dataOnly.policy;
  return dataOnly;
}

/** Local reference scan used both to assert the fixtures AND as the seeded-PII positive control. */
function scanClasses(dataJson: string): string[] {
  const hits: string[] = [];
  if (PERSONNUMMER.test(dataJson)) hits.push("PERSONNUMMER");
  if (ORGNR.test(dataJson)) hits.push("ORGNR");
  if (NON_EXAMPLE_EMAIL.test(dataJson)) hits.push("NON_EXAMPLE_EMAIL");
  if (SECRET.test(dataJson)) hits.push("SECRET");
  if (PHONE.test(dataJson)) hits.push("PHONE");
  if (ADDRESS.test(dataJson)) hits.push("ADDRESS");
  return hits;
}

const PRESENT = lovableFixtureDirPresent();

describe("Story 9.2 — Lovable-pack privacy scan (9.2-PRIV-01 / R-901)", () => {
  // ── 9.2-PRIV-01a — the shared scanner exists and is a SINGLE authority (Task 1.2) ──
  test("[P0] the shared anonymization scanner module exists (extracted, not copy-pasted)", async () => {
    const mod = await loadScanner();
    assert.ok(mod, "the shared scanner module must exist — extract golden-pack.test.ts:379-418 into it");
    // The scanner must expose a callable that reports per-class violations (a throwing assertNoPii,
    // OR a scanFixtureData -> { violations }). The dev picks one; assert one of the two is present.
    const hasCallable =
      typeof (mod as Record<string, unknown>).assertNoPii === "function" ||
      typeof (mod as Record<string, unknown>).scanFixtureData === "function";
    assert.ok(hasCallable, "the scanner must export assertNoPii(...) or scanFixtureData(...) — a per-class authority");
  });

  // ── 9.2-PRIV-01b (AC3, epic blocker) — no real PII in ANY committed lovable fixture DATA ──
  test("[P0] no real PII/secret in ANY committed lovable fixture DATA payload (R-901 epic blocker)", () => {
    const files = listLovableFixtureFiles();
    assert.ok(files.length >= 1, "the lovable pack must carry >=1 committed fixture to scan");
    for (const file of files) {
      const parsed = readJson(file) as Record<string, unknown>;
      // Prose keys are scanned SEPARATELY — they legitimately name personnummer/orgnr/address as rules.
      const hasProse =
        typeof parsed._doc === "string" ||
        typeof parsed._comment === "string";
      assert.ok(hasProse, `${file}: must carry a _doc/_comment provenance string (scanned separately from data)`);
      const dataJson = JSON.stringify(stripProse(parsed));
      const hits = scanClasses(dataJson);
      assert.deepEqual(hits, [], `${file}: DATA payload leaked PII/secret class(es): ${hits.join(", ")}`);
    }
  });

  // ── 10.2 / R-1015 (10.x-UNIT-01) — the STANDING scan also covers the quotes golden estate ──
  // The lost-reason golden fixture (tests/fixtures/golden/quotes/lost-lifecycle.json) must be gated by
  // the SAME shared authority as the lovable pack — not only by the weaker fixture-local PII_PATTERNS
  // in lost-version-golden.test.ts. A new quotes golden fixture carrying real PII must FAIL CI here.
  test("[P0] no real PII/secret in ANY committed quotes golden fixture DATA payload (R-1015 / 10.2)", async () => {
    const mod = await loadScanner();
    assert.ok(mod, "the shared anonymization scanner module must exist");
    const lister = (mod as Record<string, unknown>).listGoldenQuotesFixtureFiles as
      | (() => string[])
      | undefined;
    const scan = (mod as Record<string, unknown>).scanFixtureData as
      | ((o: unknown, label?: string) => { violations: { class: string }[] })
      | undefined;
    assert.ok(typeof lister === "function", "the scanner must export listGoldenQuotesFixtureFiles()");
    assert.ok(typeof scan === "function", "the scanner must export scanFixtureData()");
    const files = lister!();
    assert.ok(files.length >= 1, "the quotes golden estate must carry >=1 committed fixture to scan");
    for (const file of files) {
      const parsed = readJson(file) as Record<string, unknown>;
      const { violations } = scan!(parsed, file);
      assert.deepEqual(
        violations.map((v) => v.class),
        [],
        `${file}: DATA payload leaked PII/secret class(es): ${violations.map((v) => v.class).join(", ")}`,
      );
    }
  });

  // ── 9.2-PRIV-01c — the EXPLICIT manifest and the glob backstop agree (Task 1.4) ──
  // A bare hardcoded file list a future fixture is not added to is a silent-miss trap. The scan must
  // cover the glob-discovered set; assert the manifest (if the dev ships one) is a SUPERSET-or-equal
  // of the glob set so nothing escapes.
  test("[P0] every glob-discovered fixture is covered by the scan (no silent-miss escape)", async () => {
    const globFiles = listLovableFixtureFiles();
    assert.ok(globFiles.length >= 1, "glob backstop must discover >=1 fixture");
    // The GREEN manifest may live in the scanner module or a co-located manifest. If the dev exports
    // a `LOVABLE_FIXTURE_MANIFEST`, assert it does not MISS any glob-discovered file.
    const mod = await loadScanner();
    const manifest = mod?.LOVABLE_FIXTURE_MANIFEST as string[] | undefined;
    if (Array.isArray(manifest)) {
      for (const g of globFiles) {
        const base = g.replace(/\\/g, "/").split("/").pop()!;
        const listed = manifest.some((m) => m.replace(/\\/g, "/").endsWith(base));
        assert.ok(listed, `${base}: discovered by glob but MISSING from the explicit manifest (silent-miss trap)`);
      }
    }
  });

  // ── 9.2-PRIV-01d — POSITIVE CONTROL (Task 1.5): the scan FAILS-CLOSED on seeded PII ──
  // A privacy scan that never fails on planted PII is worthless. Feed a SEEDED fixture object with a
  // real-shaped personnummer, orgnr, non-example.test email, and secret; assert the scanner REPORTS a
  // violation per class. Values are constructed INLINE — NEVER written to a lovable/** fixture.
  test("[P0] seeded PII trips the scan — personnummer/orgnr/email/secret each detected (fail-closed proof)", async () => {
    const seeded = {
      _doc: "SEEDED positive-control object — NOT a committed fixture. Proves the scan fails-closed.",
      customer: {
        name: "Seeded Realname",
        personnummer: "900101-1234", // seeded real-shaped personnummer — MUST trip PERSONNUMMER
        orgNr: "5560000001", // seeded 10-digit orgnr — MUST trip ORGNR
        email: "real.person@gmail.com", // non-example.test — MUST trip NON_EXAMPLE_EMAIL
        api_key: "sk-seeded-not-a-real-key", // secret token — MUST trip SECRET
      },
    };
    const dataJson = JSON.stringify(stripProse(seeded));
    const hits = scanClasses(dataJson);
    for (const cls of ["PERSONNUMMER", "ORGNR", "NON_EXAMPLE_EMAIL", "SECRET"]) {
      assert.ok(hits.includes(cls), `seeded ${cls} was NOT detected — the scan is not fail-closed`);
    }

    // The SHARED scanner (the real authority) must ALSO trip on the seeded object. The dev wires
    // whichever export shape they chose; assert a violation is reported through it.
    const mod = await loadScanner();
    if (mod) {
      if (typeof (mod as Record<string, unknown>).scanFixtureData === "function") {
        const scan = (mod as { scanFixtureData: (o: unknown) => { violations: unknown[] } }).scanFixtureData;
        const result = scan(seeded);
        assert.ok(Array.isArray(result.violations) && result.violations.length >= 4, "shared scanner must report >=4 seeded violations (fail-closed)");
      } else if (typeof (mod as Record<string, unknown>).assertNoPii === "function") {
        const assertNoPii = (mod as { assertNoPii: (o: unknown, label?: string) => void }).assertNoPii;
        assert.throws(() => assertNoPii(seeded, "seeded"), "shared scanner assertNoPii must THROW on seeded PII (fail-closed)");
      }
    }
  });

  // ── 9.2-PRIV-02 (AC1 / R-901 raw-file arm) — POSITIVE CONTROL: the scan FAILS-CLOSED on a raw blob ──
  // A files fixture must be link/type/purpose METADATA only — never a raw customer file smuggled in as
  // a base64/`data:` payload. Feed a SEEDED object carrying a `data:` URI AND a long base64 run; assert
  // the shared scanner reports a RAW_FILE_BLOB violation for each. Constructed INLINE — never committed.
  test("[P0] seeded raw file blob trips the scan — data: URI and long base64 each detected (raw-file fail-closed)", async () => {
    const mod = await loadScanner();
    assert.ok(mod, "the shared scanner module must exist");
    const scan =
      typeof (mod as Record<string, unknown>).scanFixtureData === "function"
        ? (mod as { scanFixtureData: (o: unknown, label?: string) => { violations: { class: string }[] } }).scanFixtureData
        : null;
    assert.ok(scan, "the shared scanner must export scanFixtureData for the raw-blob positive control");

    // A `data:` URI payload — the shape a raw customer file takes when embedded in JSON.
    const dataUriBlob = {
      _doc: "SEEDED raw-file positive control — NOT a committed fixture. Proves the raw-file arm fails-closed.",
      fileLinks: [{ purpose: "acceptance_evidence", type: "application/pdf", payload: "data:application/pdf;base64,JVBERi0xLjc=" }],
    };
    const dataUriHits = scan!(dataUriBlob).violations.map((v) => v.class);
    assert.ok(dataUriHits.includes("RAW_FILE_BLOB"), "a data: URI raw-file payload was NOT detected — the raw-file arm is not fail-closed");

    // A long unbroken base64 run (a raw blob without the data: prefix).
    const base64Blob = {
      _doc: "SEEDED raw-file positive control — NOT a committed fixture.",
      fileLinks: [{ purpose: "acceptance_evidence", type: "image/png", payload: "A".repeat(160) }],
    };
    const base64Hits = scan!(base64Blob).violations.map((v) => v.class);
    assert.ok(base64Hits.includes("RAW_FILE_BLOB"), "a long base64 raw-file run was NOT detected — the raw-file arm is not fail-closed");

    // Negative: the CLEAN files metadata (link/type/purpose, short synthetic ids) must NOT trip it.
    const cleanMetadata = {
      _doc: "clean files metadata — link/type/purpose only, no blob.",
      fileLinks: [{ purpose: "acceptance_evidence", type: "application/pdf", url: "https://storage.example.test/file-01" }],
    };
    const cleanHits = scan!(cleanMetadata).violations.map((v) => v.class);
    assert.ok(!cleanHits.includes("RAW_FILE_BLOB"), "clean link/type/purpose metadata must NOT trip RAW_FILE_BLOB (no false positive)");
  });
});

// Belt-and-braces: the surface is now PRESENT (green phase). A HARD top-level guard fails loud if the
// fixture dir/fixtures were ever removed, so this executing suite can never silently green on nothing.
if (!PRESENT || !existsSync(GOLDEN_LOVABLE_DIR)) {
  throw new Error(
    "Story 9.2 lovable privacy scan: the tests/fixtures/golden/lovable/** surface is missing — this suite must not run vacuously green (R-904).",
  );
}
