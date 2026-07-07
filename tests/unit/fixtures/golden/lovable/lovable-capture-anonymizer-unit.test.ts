/**
 * Story 9.2 — CAPTURE-SCRIPT anonymizer unit coverage (automate-tier expansion).
 *
 * The story's `lovable-capture-script.test.ts` drives `anonymizeRecord` on FLAT synthetic records and
 * checks the output against a LOCAL regex set. Several load-bearing behaviors of the actual module
 * (`@/scripts-migration/lovable-capture`) are therefore unexercised. This suite closes those gaps:
 *   - DEEP recursion: nested objects + arrays are anonymized, secrets DROPPED at any depth;
 *   - BUSINESS-SHAPE preservation: öre integers / booleans / null / non-PII scalars pass verbatim
 *     (the R-911 "do not over-anonymize the load-bearing shape" contract at the SOURCE);
 *   - anonymizeUnhintedString (defense-in-depth): a free-form string carrying a PII SHAPE under a
 *     NON-PII key is still masked (a mislabeled field cannot smuggle a raw value);
 *   - captureLog emits COUNTS/IDS only and NEVER echoes a raw value (R-901/R-902);
 *   - MODULE COMPOSITION: the anonymizer's output passes the SHARED scanner authority
 *     (`assertNoPii`) — the capture pipeline and the CI backstop are proven consistent end-to-end.
 *
 * NO real PII — every input below is obviously-fake synthetic sample data (story Stop Condition:
 * synthetic input only; no live Lovable pull). [R-901]
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import anonymizeDefault, { anonymizeRecord, captureLog } from "@/scripts-migration/lovable-capture";
import { assertNoPii, scanFixtureData } from "@/tests-support/anonymization-scan";

describe("Story 9.2 — capture-script anonymizer (module-direct unit coverage)", () => {
  // ── DEEP recursion + secret drop at depth ──
  test("[P0] anonymizeRecord recurses nested objects AND arrays, dropping secrets at any depth", () => {
    const input = {
      customer: {
        name: "SAMPLE Real Name",
        email: "real@synthetic-input.example",
        contacts: [
          { contact_name: "SAMPLE Contact", phone: "070-000 00 00", api_key: "nested-secret" },
          { contact_name: "SAMPLE Other", personnummer: "800101-2345" },
        ],
        credentials: { password: "top-secret", access_key: "AKIA-not-real" },
      },
    };
    const out = anonymizeRecord(input);
    const customer = (out as Record<string, unknown>).customer as Record<string, unknown>;
    const credentials = customer.credentials as Record<string, unknown> | undefined;
    const contacts = customer.contacts as Record<string, unknown>[];
    // Secrets dropped at every depth.
    assert.ok(!credentials || Object.keys(credentials).length === 0, "nested secret object keys must be dropped");
    assert.ok(!("api_key" in contacts[0]), "a secret key inside an array element must be dropped");
    // Output carries no PII shape at all — via the SHARED scanner authority.
    assert.doesNotThrow(() => assertNoPii(out, "capture-deep"), "deep-anonymized output must pass the shared scanner");
  });

  // ── BUSINESS-SHAPE preservation (R-911 at source) ──
  test("[P0] non-PII scalars pass verbatim — öre integers, booleans, null, ids (business shape preserved)", () => {
    const input = {
      id: "row-0001",
      row_type: "labor",
      unit_cost_ore: 45000,
      unit_sell_ore: 79000,
      quantity: 2.5,
      is_hidden: true,
      is_selected: false,
      source_kind: null,
      readinessWarnings: ["LOW_MARGIN", "HIDDEN_ROWS_INCLUDED"],
    };
    const out = anonymizeRecord(input) as Record<string, unknown>;
    assert.equal(out.id, "row-0001", "a non-PII id string must pass verbatim");
    assert.equal(out.row_type, "labor", "row_type must pass verbatim");
    assert.equal(out.unit_cost_ore, 45000, "an öre integer must pass verbatim (business shape)");
    assert.equal(out.quantity, 2.5, "a fractional quantity must pass verbatim");
    assert.equal(out.is_hidden, true, "a boolean flag must pass verbatim");
    assert.equal(out.is_selected, false, "a false flag must pass verbatim");
    assert.equal(out.source_kind, null, "null must pass verbatim");
    assert.deepEqual(out.readinessWarnings, ["LOW_MARGIN", "HIDDEN_ROWS_INCLUDED"], "a readiness-code array must pass verbatim");
  });

  // ── anonymizeUnhintedString: defense-in-depth for a PII shape under a NON-PII key ──
  test("[P0] a PII-shaped value under a NON-PII (free-form) key is STILL masked (no raw smuggling)", () => {
    // A `notes`/`label` field carries no PII key hint, but a raw personnummer/orgnr/email/phone/address
    // typed into it must still be masked so a mislabeled field cannot leak a raw value.
    const input = {
      notes: "customer 900101-1234 called from 070-123 45 67",
      label: "invoice to real.person@gmail.com re: Sample road 5",
      ref: "org 5560000001",
    };
    const out = anonymizeRecord(input);
    const outJson = JSON.stringify(out);
    assert.ok(!/\b\d{6}-\d{4}\b/.test(outJson), "an unhinted personnummer must be masked");
    assert.ok(!/(?:\+?46|0)\s?7\d(?:[\s-]?\d){7}\b/.test(outJson), "an unhinted SE phone must be masked");
    assert.ok(!/@(?!example\.test\b)[a-z0-9.-]+\.[a-z]{2,}/i.test(outJson), "an unhinted non-example email must be masked");
    assert.ok(!/\b(gata|gatan|väg|vägen|street|road|avenue)\s+\d+/i.test(outJson), "an unhinted street address must be masked");
    assert.ok(!/\b\d{10}\b/.test(outJson), "an unhinted 10-digit orgnr must be masked");
    // And via the shared authority end-to-end.
    assert.doesNotThrow(() => assertNoPii(out, "capture-unhinted"), "unhinted-masked output must pass the shared scanner");
  });

  test("[P1] a clean unhinted string (no PII shape) passes through unchanged", () => {
    const input = { notes: "Standard labour row", label: "Cabling" };
    const out = anonymizeRecord(input) as Record<string, unknown>;
    assert.equal(out.notes, "Standard labour row", "a benign note must be untouched");
    assert.equal(out.label, "Cabling", "a benign label must be untouched");
  });

  // ── captureLog: counts/ids only, never a raw value ──
  test("[P0] captureLog emits COUNTS only and NEVER a raw value (R-901/R-902)", () => {
    const line = captureLog({ customers: 12, facilities: 3, contacts: 20 });
    assert.match(line, /anonymized/, "the log line must be a count summary");
    assert.match(line, /12 customers/, "counts must be present");
    assert.match(line, /3 facilities/, "counts must be present");
    // No raw value could appear — assert it contains only the count vocabulary we passed.
    assert.ok(!/@/.test(line) && !/\d{6}-\d{4}/.test(line), "the log line must carry no email/personnummer shape");
  });

  test("[P1] captureLog on an empty count map produces a bare 'anonymized' line (no crash, no raw)", () => {
    assert.equal(captureLog({}), "anonymized ", "an empty count map yields the bare prefix (no raw value)");
  });

  // ── the default export mirrors anonymizeRecord (scaffold probes mod.default) ──
  test("[P1] the default export is the same anonymizer as the named anonymizeRecord", () => {
    const input = { name: "SAMPLE Dd", personnummer: "830404-5678" };
    assert.equal(
      JSON.stringify(anonymizeDefault(structuredClone(input))),
      JSON.stringify(anonymizeRecord(structuredClone(input))),
      "the default export must behave identically to the named export",
    );
  });

  // ── MODULE COMPOSITION: capture output <-> shared scanner consistency ──
  test("[P0] the FULL synthetic record's anonymized output passes the SHARED scanner (pipeline<->backstop consistency)", () => {
    const synthetic = {
      customer_type: "private",
      customer_display_name: "SAMPLE Private Customer",
      name: "SAMPLE Real Person",
      email: "person@synthetic-input.example",
      personnummer: "800101-2345",
      org_nr: "5560002345",
      phone: "070-000 00 00",
      address: "Provgatan 12",
      api_key: "sample-secret",
      facilities: [{ id: "facility-0001", address: "Testvägen 3" }],
      unit_sell_ore: 79000,
      is_primary: true,
    };
    const out = anonymizeRecord(synthetic);
    // The pipeline's output must satisfy the SAME authority the committed fixtures are held to.
    const { violations } = scanFixtureData(out, "capture-full");
    assert.deepEqual(violations, [], `capture output must be scan-clean; leaked: ${violations.map((v) => v.class).join(", ")}`);
    assert.doesNotThrow(() => assertNoPii(out, "capture-full"));
  });
});
