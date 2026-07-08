/**
 * Story 9.2 — SHARED ANONYMIZATION SCANNER unit coverage (automate-tier expansion).
 *
 * The story's four ATDD suites drive the fixtures + capture script through a LOCAL reference regex
 * set (a re-implemented `scanClasses`), so the SHARED scanner authority itself — `@/tests-support/
 * anonymization-scan` — is only exercised end-to-end (its `scanFixtureData`/`assertNoPii` are reached,
 * but its distinctive INTERNAL behaviors are not directly pinned). This suite closes those gaps by
 * asserting the shared module's own contract:
 *   - stripProse removes `_doc`/`_comment`/`policy` and preserves the DATA payload;
 *   - the P2 ORGNR STRING-LEAF hardening (R-914): a numeric 10-digit öre does NOT trip ORGNR, but a
 *     real 10-digit orgnr in a STRING field STILL does (the "hardened, not loosened" claim);
 *   - fail-closed detection of ALL SIX classes including PHONE + ADDRESS (the seeded control in the
 *     privacy-scan suite only covers 4 of 6);
 *   - scanFixtureData threads the `label` onto each violation (`file` field);
 *   - assertNoPii throws a per-class message and is a no-op on clean data;
 *   - the exported regex set is BYTE-IDENTICAL to the money-pack authority (not loosened).
 *
 * NO PII in this file — every seeded value is constructed INLINE for a positive control, never written
 * to a lovable/** fixture (that would trip the real scan). [R-901]
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  PERSONNUMMER,
  ORGNR,
  NON_EXAMPLE_EMAIL,
  SECRET,
  PHONE,
  ADDRESS,
  assertNoPii,
  scanFixtureData,
  stripProse,
} from "@/tests-support/anonymization-scan";

describe("Story 9.2 — shared anonymization scanner (module-direct unit coverage)", () => {
  // ── stripProse: provenance prose removed, DATA preserved ──
  test("[P0] stripProse removes _doc/_comment/policy and preserves every DATA key", () => {
    const obj = {
      _doc: "prose that legitimately names personnummer/orgnr/address as RULE text",
      _comment: "alt provenance prose",
      policy: "policy prose block",
      customer_type: "private",
      nested: { keep: "value", orgnr_rule_text: "unaffected data" },
    };
    const stripped = stripProse(obj);
    assert.ok(!("_doc" in stripped), "_doc must be stripped");
    assert.ok(!("_comment" in stripped), "_comment must be stripped");
    assert.ok(!("policy" in stripped), "policy must be stripped");
    assert.equal(stripped.customer_type, "private", "a DATA key must be preserved");
    assert.deepEqual(stripped.nested, { keep: "value", orgnr_rule_text: "unaffected data" }, "nested DATA must be preserved verbatim");
    // Purity: the original object is not mutated.
    assert.ok("_doc" in obj, "stripProse must not mutate its input (original _doc still present)");
  });

  test("[P1] scanning prose ALONE (no data) reports NO violation — prose naming the rules is not a leak", () => {
    // A fixture whose ONLY content is provenance prose naming 'personnummer'/'orgnr'/'address' must be
    // clean once prose is stripped — this is exactly why the scanner strips prose before scanning.
    const proseOnly = {
      _doc: "This fixture models a personnummer and orgnr and a street address rule.",
      _comment: "password api_key secret are named here as policy text.",
    };
    assert.deepEqual(scanFixtureData(proseOnly).violations, [], "prose-only fixture must scan clean once prose is stripped");
  });

  // ── P2 ORGNR string-leaf hardening (R-914 / 9.2-ORGNR-01): hardened, not loosened ──
  test("[P0] a numeric 10-digit öre integer does NOT trip ORGNR (hardened against the öre false-positive)", () => {
    // A legitimate ≥10-digit öre value as a JSON number must NOT read as an orgnr leak.
    const fixture = { total_ore: 1_234_567_890, rows: [{ unit_sell_ore: 9_999_999_999 }] };
    const { violations } = scanFixtureData(fixture);
    assert.ok(!violations.some((v) => v.class === "ORGNR"), "a numeric 10-digit öre must not trip ORGNR (R-914 hardening)");
  });

  test("[P0] a real 10-digit orgnr in a STRING field STILL trips ORGNR (guard hardened, NOT loosened)", () => {
    const fixture = { org_nr: "5560000001" };
    const { violations } = scanFixtureData(fixture);
    assert.ok(violations.some((v) => v.class === "ORGNR"), "a real orgnr in a string field must STILL trip ORGNR (not loosened)");
  });

  test("[P1] a 10-digit run embedded in a longer STRING trips ORGNR (string-leaf scan is not number-only)", () => {
    const fixture = { note: "reference id 5560000001 attached" };
    const { violations } = scanFixtureData(fixture);
    assert.ok(violations.some((v) => v.class === "ORGNR"), "a 10-digit token inside a string is still an orgnr leak");
  });

  // ── fail-closed detection of ALL SIX classes (privacy-scan seeded control only covers 4) ──
  test("[P0] PHONE + ADDRESS are ALSO detected fail-closed (the two classes the seeded control omits)", () => {
    const phoneHit = scanFixtureData({ contact_phone: "070-123 45 67" });
    assert.ok(phoneHit.violations.some((v) => v.class === "PHONE"), "a SE mobile phone shape must trip PHONE");
    // NB: the ported ADDRESS regex requires the street-type word at a WORD BOUNDARY + whitespace +
    // digits, so a compound like "Storgatan 12" (gatan not at a boundary) does NOT match — a standalone
    // street-type word followed by a number ("Main street 7", "Vägen 9") is the shape it catches.
    const addressHit = scanFixtureData({ street: "Main street 7" });
    assert.ok(addressHit.violations.some((v) => v.class === "ADDRESS"), "a standalone street-type word + number must trip ADDRESS");
  });

  test("[P0] all six classes seeded at once are each reported (no class masks another)", () => {
    const seeded = {
      pnr: "900101-1234",
      org: "5560000001",
      email: "real.person@gmail.com",
      cred: "api_key=abc",
      phone: "070-123 45 67",
      addr: "Vägen 9",
    };
    const classes = new Set(scanFixtureData(seeded).violations.map((v) => v.class));
    for (const cls of ["PERSONNUMMER", "ORGNR", "NON_EXAMPLE_EMAIL", "SECRET", "PHONE", "ADDRESS"]) {
      assert.ok(classes.has(cls), `class ${cls} must be reported when seeded (fail-closed, all six)`);
    }
  });

  test("[P1] @example.test email is NOT flagged (the sanctioned synthetic domain)", () => {
    const { violations } = scanFixtureData({ email: "user-11@example.test" });
    assert.ok(!violations.some((v) => v.class === "NON_EXAMPLE_EMAIL"), "@example.test is the sanctioned domain — must not trip");
  });

  // ── scanFixtureData: label threading ──
  test("[P1] scanFixtureData threads the label onto each violation as `file`", () => {
    const { violations } = scanFixtureData({ pnr: "900101-1234" }, "seeded-crm.json");
    assert.ok(violations.length >= 1, "seeded personnummer must produce a violation");
    assert.ok(violations.every((v) => v.file === "seeded-crm.json"), "the label must be threaded onto every violation");
  });

  test("[P1] scanFixtureData omits the file field when no label is passed", () => {
    const { violations } = scanFixtureData({ pnr: "900101-1234" });
    assert.ok(violations.length >= 1, "seeded personnummer must produce a violation");
    assert.ok(violations.every((v) => v.file === undefined), "no label -> no file field on the violation");
  });

  test("[P2] a non-object input scans clean (defensive: null/number/string are not fixtures)", () => {
    assert.deepEqual(scanFixtureData(null).violations, [], "null is not a fixture — scan clean");
    assert.deepEqual(scanFixtureData(42).violations, [], "a number is not a fixture — scan clean");
  });

  // ── assertNoPii: throwing authority ──
  test("[P0] assertNoPii THROWS naming the tripped class(es) on seeded PII", () => {
    assert.throws(
      () => assertNoPii({ pnr: "900101-1234", cred: "password: x" }, "seeded"),
      (err: Error) => {
        assert.match(err.message, /seeded/, "message must carry the label");
        assert.match(err.message, /PERSONNUMMER/, "message must name PERSONNUMMER");
        assert.match(err.message, /SECRET/, "message must name SECRET");
        return true;
      },
      "assertNoPii must throw a per-class message on seeded PII (fail-closed)",
    );
  });

  test("[P0] assertNoPii is a NO-OP on clean anonymized data (masked placeholders + @example.test)", () => {
    const clean = {
      _doc: "provenance naming personnummer/orgnr/address as rules",
      customer_type: "private",
      personnummer: "YYMMDD-XXXX",
      org_nr: "XXXXXX-XXXX",
      phone: "07X-XXX XX XX",
      address: "Sample plats A",
      email: "user-01@example.test",
      total_ore: 1_234_567_890,
    };
    assert.doesNotThrow(() => assertNoPii(clean, "clean"), "clean anonymized data must not throw");
  });

  // ── the exported regex set is the money-pack authority, not a loosened copy ──
  test("[P0] the exported regex set matches the money-pack authority byte-for-byte (not loosened)", () => {
    assert.equal(PERSONNUMMER.source, /\b\d{6}-\d{4}\b/.source, "PERSONNUMMER regex must be the exact ported form");
    assert.equal(ORGNR.source, /\b\d{10}\b/.source, "ORGNR regex must be the exact ported form");
    assert.equal(NON_EXAMPLE_EMAIL.source, /@(?!example\.test\b)[a-z0-9.-]+\.[a-z]{2,}/i.source, "NON_EXAMPLE_EMAIL regex must be exact");
    assert.equal(SECRET.source, /secret|password|api_key/i.source, "SECRET regex must be exact");
    assert.equal(PHONE.source, /(?:\+?46|0)\s?7\d(?:[\s-]?\d){7}\b/.source, "PHONE regex must be exact");
    assert.equal(ADDRESS.source, /\b(gata|gatan|väg|vägen|street|road|avenue)\s+\d+/i.source, "ADDRESS regex must be exact");
  });
});
