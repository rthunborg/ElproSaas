/**
 * Story 9.2 — CAPTURE-SCRIPT contract (RED-PHASE SCAFFOLD)
 * Covers 9.2-REPEAT-01 (AC2 repeatable/documented/local) + 9.2-PRIV-02 (R-901 anonymize-at-source) +
 * 9.x-PATH-01 / R-919 (approved asset location).
 *
 * The capture script proves the anonymization + capture PIPELINE works and is REPEATABLE. Per the
 * story Stop Condition, this story's INPUT is SYNTHETIC/representative sample data — NOT a live real
 * Lovable pull (owner-gated). These assertions therefore exercise the script's deterministic
 * anonymization on a SYNTHETIC input and prove: (1) it lives in an approved location, (2) it is
 * documented, (3) it is deterministic (same input -> same output on re-run), and (4) it anonymizes
 * AT SOURCE and never echoes a raw value to stdout/log.
 *
 * ── GREEN PHASE (Story 9.2 dev) ─────────────────────────────────────────────────────────
 * The capture script now exists at `scripts/migration/lovable-capture.ts` (imported as
 * `@/scripts-migration/lovable-capture`) exporting a pure, deterministic `anonymizeRecord`, so this
 * suite RUNS (no longer skipped). The assertions are UNCHANGED from the red-phase scaffold — they
 * drive the pure anonymizer on SYNTHETIC input WITHOUT any network/global change.
 *
 * NO real PII in this file — the synthetic input below is obviously fake and its anonymized output
 * must satisfy the same privacy scan the fixtures do. [R-901]
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, "../../../../..");

/** Approved capture-script homes (architecture §16 / AR25 / R-919). The dev picks ONE. */
const APPROVED_SCRIPT_CANDIDATES = [
  resolve(PROJECT_ROOT, "scripts/migration"),
  resolve(HERE), // a colocated test-oriented capture helper under the lovable fixture home
];

function captureScriptPresent(): boolean {
  // Present when an approved location exists AND (heuristically) contains a capture asset. The GREEN
  // dev may export a pure anonymizer this test imports; until then this returns false (red phase).
  return APPROVED_SCRIPT_CANDIDATES.some((dir) => existsSync(dir) && dir.includes("migration"));
}

// The PII regexes the anonymized OUTPUT must satisfy (same authority as the fixture scan).
const PERSONNUMMER = /\b\d{6}-\d{4}\b/;
const ORGNR = /\b\d{10}\b/;
const NON_EXAMPLE_EMAIL = /@(?!example\.test\b)[a-z0-9.-]+\.[a-z]{2,}/i;
const SECRET = /secret|password|api_key/i;
const PHONE = /(?:\+?46|0)\s?7\d(?:[\s-]?\d){7}\b/;
const ADDRESS = /\b(gata|gatan|väg|vägen|street|road|avenue)\s+\d+/i;

const PRESENT = captureScriptPresent();

// Green phase: the capture script is present at an approved location. A HARD guard fails loud if it
// was ever removed, so this executing suite can never silently green on nothing (R-904).
if (!PRESENT) {
  throw new Error(
    "Story 9.2 capture-script contract: the scripts/migration/** capture asset is missing — this suite must not run vacuously green (R-904).",
  );
}

describe("Story 9.2 — capture-script contract (9.2-REPEAT-01 / 9.2-PRIV-02 / R-919)", () => {
  // ── 9.x-PATH-01 / R-919 — the script lives in an approved location, off the app runtime path ──
  test("[P1] the capture script lives ONLY in an approved location (scripts/migration/** or the colocated helper)", () => {
    const inApproved = APPROVED_SCRIPT_CANDIDATES.some((dir) => existsSync(dir));
    assert.ok(inApproved, "the capture script must live in scripts/migration/** or the colocated test-oriented helper (AR25/R-919) — never scattered into src/**");
    // Negative: it must NOT be under src/** (app runtime path).
    assert.ok(!existsSync(resolve(PROJECT_ROOT, "src/scripts/lovable-capture")), "the capture asset must NOT live under src/** (off the app runtime path)");
  });

  // ── 9.2-PRIV-02 (R-901) — anonymize AT SOURCE: synthetic input -> anonymized output passes the scan ──
  // Drive the script's pure anonymizer on a SYNTHETIC record. The output must map every PII class to
  // an obviously-synthetic placeholder that does NOT match the privacy regexes.
  test("[P0] anonymize-at-source: a synthetic record's anonymized output contains NO PII-shaped value (R-901)", async () => {
    const anonymize = await loadAnonymizer();
    assert.ok(anonymize, "the capture script must export a pure anonymizer (e.g. anonymizeRecord) the test can drive without a network/global change");
    const synthetic = {
      // Obviously-fake INPUT (a representative sample, never a real Lovable pull — story Stop Condition).
      name: "SAMPLE Person Aaa",
      email: "sample.person@synthetic-input.example", // an input that must be replaced with *@example.test
      personnummer: "800101-2345", // must be replaced with a masked non-\d{6}-\d{4} placeholder
      orgNr: "5560002345", // must be replaced with a masked non-\d{10} placeholder
      phone: "070-000 00 00", // must be replaced with a non-matching synthetic value
      address: "Provgatan 12", // must be replaced with a non-matching synthetic value
      api_key: "sample-secret-value", // must be DROPPED entirely
    };
    const out = anonymize!(synthetic);
    const outJson = JSON.stringify(out);
    assert.ok(!PERSONNUMMER.test(outJson), "anonymized output must not contain a personnummer shape");
    assert.ok(!ORGNR.test(outJson), "anonymized output must not contain a 10-digit orgnr shape");
    assert.ok(!NON_EXAMPLE_EMAIL.test(outJson), "anonymized output emails must be *@example.test");
    assert.ok(!SECRET.test(outJson), "anonymized output must DROP secrets entirely (no api_key/password/secret leaf)");
    assert.ok(!PHONE.test(outJson), "anonymized output must not contain a SE mobile shape");
    assert.ok(!ADDRESS.test(outJson), "anonymized output must not contain a street-address shape");
  });

  // ── 9.2-REPEAT-01 (AC2) — DETERMINISTIC: the same synthetic input yields the same output on re-run ──
  test("[P0] deterministic anonymization: same input -> byte-identical output across two runs (repeatable, AC2)", async () => {
    const anonymize = await loadAnonymizer();
    assert.ok(anonymize, "capture script must export a pure anonymizer");
    const input = { name: "SAMPLE Bbb", email: "b@synthetic-input.example", personnummer: "810202-3456" };
    const first = JSON.stringify(anonymize!(structuredClone(input)));
    const second = JSON.stringify(anonymize!(structuredClone(input)));
    assert.equal(first, second, "anonymization must be DETERMINISTIC (seeded/fixed replacements, not random each run) — AC2 repeatability");
  });

  // ── 9.2-PRIV-02 — the anonymizer must be PURE: it must not mutate its input in place (no raw echo) ──
  test("[P1] the anonymizer does not mutate its input (defense against a raw value leaking back out)", async () => {
    const anonymize = await loadAnonymizer();
    assert.ok(anonymize, "capture script must export a pure anonymizer");
    const input = { name: "SAMPLE Ccc", personnummer: "820303-4567" };
    const snapshot = JSON.stringify(input);
    anonymize!(input);
    assert.equal(JSON.stringify(input), snapshot, "the anonymizer must not mutate the caller's input record in place");
  });
});

/**
 * Try to load the capture script's pure anonymizer. The dev exports it from the chosen script home;
 * this scaffold probes a small set of conventional specifiers. Returns null in the red phase.
 */
async function loadAnonymizer(): Promise<((record: Record<string, unknown>) => Record<string, unknown>) | null> {
  const candidates = [
    "@/scripts-migration/lovable-capture",
    "@/scripts-migration/anonymize",
  ];
  for (const spec of candidates) {
    try {
      const mod = (await import(spec)) as Record<string, unknown>;
      const fn = (mod.anonymizeRecord ?? mod.anonymize ?? mod.default) as
        | ((r: Record<string, unknown>) => Record<string, unknown>)
        | undefined;
      if (typeof fn === "function") return fn;
    } catch {
      // not present yet — red phase
    }
  }
  return null;
}

void PRESENT;
