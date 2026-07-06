/**
 * Story 6.5 — EXPANDED fast-gate coverage (bmad-testarch-automate) for the pure RPC-payload
 * serializers in the SHARED `snapshot-build.ts` helper: `snapshotToPayload`, `linesToPayload`,
 * `attachmentsToPayload`.
 *
 * WHY THIS EXISTS (coverage-gap fill): both `createQuoteVersionFromCalculation` (6.1) and
 * `createNewQuoteVersion` (6.5) hand these serializers' output to the narrow RPC, which reads the
 * frozen snapshot BY KEY. The serializers therefore ARE the wire contract between the pure
 * snapshot and the DB write — and they carry the R-607 customer-visible-ONLY invariant (a line
 * payload must NEVER leak `unitCostOre` / margin / markup / `internalNote`). That contract was
 * previously exercised ONLY implicitly through the DB-backed INT suite (which SKIPS without a
 * local Supabase stack). This pure `node --test` suite pins the exact key sets + the R-607
 * no-internal-key guarantee WITHOUT a database, so a drift (a renamed/dropped key, or an
 * accidental cost-field leak) fails the fast gate.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock.
 * [Source: src/server/commands/quotes/snapshot-build.ts (snapshotToPayload/linesToPayload/
 *  attachmentsToPayload); src/lib/quote-snapshot/types.ts (the frozen snapshot field list);
 *  story 6.5 Task 1.3 (the shared helper, anti-drift) + R-607; test-design-epic-6.md #6.5-INT-01]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  attachmentsToPayload,
  linesToPayload,
  snapshotToPayload,
} from "@/server/commands/quotes/snapshot-build";
import { buildQuoteVersionSnapshot } from "@/lib/quote-snapshot";

const CAPTURED_AT = "2026-07-06T09:00:00.000Z";

/** Build a representative frozen snapshot with one visible line + one attachment. */
function buildFixtureSnapshot() {
  return buildQuoteVersionSnapshot(
    {
      calculationId: "calc-6-5-payload",
      company: {
        company_name: "Elpro Test AB",
        org_nr: "556000-0000",
        address_line1: "Testvägen 1",
        address_line2: null,
        postal_code: "12345",
        city: "Teststad",
        email: "billing@elpro.test",
        phone: "+46000000000",
        logo_url: null,
      },
      customer: {
        customer_display_name: "Kund AB",
        customer_type: "company",
        facility_name: "Anläggning A",
        contact_name: "Kontakt A",
      },
      terms: { terms_text: "Betalningsvillkor 30 dagar.", approved_at: null, approved_by: null },
      totals: {
        baseTotalOre: 120000,
        optionTotalOre: 0,
        vatTotalOre: 30000,
        deductionTotalOre: 0,
        acceptedPriceOre: 150000,
      },
      assumptions: {
        vatRateBp: 2500,
        vatDisplay: "company_excl",
        deductionType: null,
        deductionRateBp: null,
        deductionCapOre: null,
        deductionPersons: null,
        requiresSignOff: true,
      },
      header: {
        quoteNumberDisplay: null,
        validUntil: null,
        introText: "Introtext",
        customerNotes: null,
        displayMode: "detailed",
      },
      lines: [
        {
          rowType: "material",
          sortOrder: 0,
          label: "Kabel",
          description: null,
          quoteNote: "kundnotis",
          quantity: 1,
          unit: "st",
          unitSellOre: 120000,
          lineNetOre: 120000,
          vatRateBp: 2500,
          isHidden: false,
          isOptional: false,
          isSelected: null,
        },
      ],
      attachments: [{ fileId: "file-a", displayName: "bilaga.pdf", sortOrder: 0 }],
      warnings: [{ code: "TAX_SIGN_OFF_REQUIRED", severity: "warning", message: "sign off" }],
    },
    { capturedAt: CAPTURED_AT },
  );
}

// ── snapshotToPayload — the header/totals/tax payload key contract ────────────────────────────

test("6.5-INT-01 (unit): snapshotToPayload emits the full frozen header/totals/tax key set the RPC reads", () => {
  const payload = snapshotToPayload(buildFixtureSnapshot());
  const expectedKeys = [
    "companyName", "companyOrgNr", "companyAddressLine1", "companyAddressLine2",
    "companyPostalCode", "companyCity", "companyEmail", "companyPhone", "companyLogoUrl",
    "customerDisplayName", "customerType", "facilityName", "contactName",
    "quoteNumberDisplay", "validUntil", "introText", "customerNotes",
    "termsText", "termsApprovedAt", "termsApprovedBy",
    "baseTotalOre", "optionTotalOre", "vatTotalOre", "deductionTotalOre", "acceptedPriceOre",
    "vatRateBp", "vatDisplay", "deductionType", "deductionRateBp", "deductionCapOre",
    "deductionPersons", "requiresSignOff", "displayMode", "warnings",
  ].sort();
  assert.deepEqual(Object.keys(payload).sort(), expectedKeys);
});

test("6.5-INT-01 (unit): snapshotToPayload copies values verbatim + preserves integer öre / basis-points", () => {
  const payload = snapshotToPayload(buildFixtureSnapshot());
  assert.equal(payload.companyName, "Elpro Test AB");
  assert.equal(payload.baseTotalOre, 120000);
  assert.equal(payload.vatTotalOre, 30000);
  assert.equal(payload.acceptedPriceOre, 150000);
  assert.equal(payload.vatRateBp, 2500);
  assert.equal(payload.requiresSignOff, true);
  // öre stay integers (never a float/kr conversion).
  for (const k of ["baseTotalOre", "vatTotalOre", "acceptedPriceOre"] as const) {
    assert.equal(Number.isInteger(payload[k] as number), true, `${k} must be integer öre`);
  }
});

test("6.5-INT-01 (unit, R-607): snapshotToPayload carries NO cost/margin/internal key anywhere", () => {
  const payload = snapshotToPayload(buildFixtureSnapshot());
  const raw = JSON.stringify(payload).toLowerCase();
  for (const banned of ["unitcost", "cost_ore", "costore", "margin", "markup", "internalnote", "internal_note"]) {
    assert.ok(!raw.includes(banned), `payload leaked a forbidden internal token: ${banned} (R-607)`);
  }
});

// ── linesToPayload — the customer-visible line key contract (R-607) ────────────────────────────

test("6.5-INT-01 (unit): linesToPayload emits exactly the customer-visible line keys (no cost/internal) — R-607", () => {
  const lines = linesToPayload(buildFixtureSnapshot());
  assert.equal(lines.length, 1);
  const expected = [
    "rowType", "sortOrder", "label", "description", "quoteNote",
    "quantity", "unit", "unitSellOre", "lineNetOre", "vatRateBp",
    "isHidden", "isOptional", "isSelected",
  ].sort();
  const keys = Object.keys(lines[0] as Record<string, unknown>).sort();
  assert.deepEqual(keys, expected);
  // No cost/internal key smuggled onto the line.
  for (const k of keys) {
    const norm = k.toLowerCase().replace(/_/g, "");
    assert.ok(
      !["unitcostore", "markup", "markupbp", "margin", "internalnote"].includes(norm),
      `line payload must not carry internal key ${k} (R-607)`,
    );
  }
});

test("6.5-INT-01 (unit): linesToPayload preserves the customer-visible values + integer öre", () => {
  const [line] = linesToPayload(buildFixtureSnapshot()) as Array<Record<string, unknown>>;
  assert.equal(line.label, "Kabel");
  assert.equal(line.quoteNote, "kundnotis"); // the customer note IS carried
  assert.equal(line.unitSellOre, 120000);
  assert.equal(line.lineNetOre, 120000);
  assert.equal(line.vatRateBp, 2500);
});

test("6.5-INT-01 (unit): linesToPayload maps an empty snapshot to an empty array (never null)", () => {
  const empty = buildQuoteVersionSnapshot(
    {
      calculationId: "calc-empty",
      company: {
        company_name: null, org_nr: null, address_line1: null, address_line2: null,
        postal_code: null, city: null, email: null, phone: null, logo_url: null,
      },
      customer: { customer_display_name: null, customer_type: null, facility_name: null, contact_name: null },
      terms: null,
      totals: { baseTotalOre: 0, optionTotalOre: 0, vatTotalOre: 0, deductionTotalOre: 0, acceptedPriceOre: 0 },
      assumptions: {
        vatRateBp: null, vatDisplay: null, deductionType: null, deductionRateBp: null,
        deductionCapOre: null, deductionPersons: null, requiresSignOff: true,
      },
      header: { quoteNumberDisplay: null, validUntil: null, introText: null, customerNotes: null, displayMode: null },
      lines: [],
      attachments: [],
      warnings: [],
    },
    { capturedAt: CAPTURED_AT },
  );
  assert.deepEqual(linesToPayload(empty), []);
  assert.deepEqual(attachmentsToPayload(empty), []);
});

// ── attachmentsToPayload — the selected-attachment key contract ────────────────────────────────

test("6.5-INT-01 (unit): attachmentsToPayload emits exactly {fileId, displayName, sortOrder}", () => {
  const atts = attachmentsToPayload(buildFixtureSnapshot()) as Array<Record<string, unknown>>;
  assert.equal(atts.length, 1);
  assert.deepEqual(Object.keys(atts[0]).sort(), ["displayName", "fileId", "sortOrder"]);
  assert.equal(atts[0].fileId, "file-a");
  assert.equal(atts[0].displayName, "bilaga.pdf");
  assert.equal(atts[0].sortOrder, 0);
});
