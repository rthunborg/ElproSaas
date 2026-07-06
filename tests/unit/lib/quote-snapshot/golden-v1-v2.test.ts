/**
 * Story 6.5 — the v1/v2 comparison GOLDEN PACK (6.5-GOLDEN-01, P0 — R-609/R-615).
 *
 * The new-version analogue of the 6.1 quote-version golden pack: representative versioning cycles
 * (a price change, an added tillval, a terms change, an attachment re-selection) pinning WHAT
 * CHANGED (the v2 customer-visible fields) vs WHAT PRESERVED (v1's frozen snapshot is byte-
 * identical, unchanged by v2 creation). Both v1 and v2 are fed through the SAME pure
 * `buildQuoteVersionSnapshot` (with the respective injected `capturedAt`) — the DB-backed 6.5-INT-02
 * proof owns the LIVE preservation; this fast unit pins the value-level v1-vs-v2 contract.
 *
 *   1. LABELLING — every case is `origin: "new-expected"` (NO fabricated old-Lovable oracle) +
 *      a non-empty note. A documented-delta MUST record its old value.
 *   2. WARNING-CODE REPRESENTATIVENESS (epic-6 standing golden-hardening item) — every warning
 *      code in the fixture is a REAL `ReadinessCode` union value, NEVER a free string (the 6.1
 *      fixtures shipped fictional codes like REQUIRES_SIGN_OFF — do NOT copy them).
 *   3. CHANGED vs PRESERVED — each case's `changedFields` differ between v1 and v2; each case's
 *      `preservedFields` are byte-identical between v1 and v2 (the frozen prior commitment).
 *   4. FREEZE + öre discipline + R-607 (no cost/internal key leaked onto a line).
 *   + EXTENDED PRIVACY SCAN (R-615) — the CI PII/secret scan over the new fixture payload.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock.
 * [Source: test-design-epic-6.md#6.5-GOLDEN-01, R-609/R-615; tests/unit/lib/quote-snapshot/
 *  golden-pack.test.ts (the 6.1 pack to mirror); src/features/calculations/readiness.ts (the real
 *  ReadinessCode union); deferred-work.md#6-1 code review [Low] (golden warning-code representativeness)]
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildQuoteVersionSnapshot } from "@/lib/quote-snapshot/build";
import type { QuoteVersionSnapshotInput } from "@/lib/quote-snapshot/build";
import type { QuoteVersionSnapshot } from "@/lib/quote-snapshot";
import { isOreAmount } from "@/lib/money";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, "../../../fixtures/golden/snapshots/quote-version-v1-v2.json");

/** The REAL ReadinessCode union values (kept in lockstep with readiness.ts) — the closed vocabulary. */
const REAL_READINESS_CODES = new Set([
  "MISSING_CUSTOMER",
  "TOTAL_UNCOMPUTABLE",
  "LOW_MARGIN",
  "MISSING_FACILITY",
  "MISSING_CONTACT",
  "EMPTY_SECTION",
  "ZERO_PRICE_ROW",
  "MISSING_WORK_ROLE",
  "UNRESOLVED_VAT",
  "TAX_SIGN_OFF_REQUIRED",
  "HIDDEN_ROWS_INCLUDED",
  "REQUIRED_FILES_DEFERRED",
]);

interface FixtureCompany {
  companyName: string | null;
  orgNr: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  logoUrl: string | null;
}
interface FixtureLine {
  rowType: string;
  label: string | null;
  quantity: number;
  unit: string;
  sellOre: number;
  vatBp: number;
}
interface FixtureSide {
  company: FixtureCompany;
  customerDisplayName: string | null;
  facilityDisplayName: string | null;
  contactDisplayName: string | null;
  terms: { termsText: string; approvedAt: string | null; approvedBy: string | null };
  validUntil: string | null;
  introText: string | null;
  lines: FixtureLine[];
  totals: { baseOre: number; optionOre: number; vatOre: number; deductionOre: number };
  taxAssumptions: { vatRateBp: number; deductionType: string | null; requiresSignOff: boolean };
  warnings: string[];
  attachments?: Array<{ displayName: string }>;
}
interface GoldenCase {
  readonly id: string;
  readonly origin: "old-lovable" | "new-expected" | "documented-delta";
  readonly note: string;
  readonly documentedDeltaOldLovableValue: unknown;
  readonly changedFields: string[];
  readonly preservedFields: string[];
  readonly v1: FixtureSide;
  readonly v2: FixtureSide;
}
interface GoldenPack {
  readonly capturedAtV1: string;
  readonly capturedAtV2: string;
  readonly cases: readonly GoldenCase[];
}

function loadPack(): GoldenPack {
  return JSON.parse(readFileSync(FIXTURE, "utf8")) as GoldenPack;
}

const VALID_ORIGINS = ["old-lovable", "new-expected", "documented-delta"] as const;

/** Adapt a fixture side into the pure builder's input (attachments/lines get a sortOrder). */
function adapt(side: FixtureSide): QuoteVersionSnapshotInput {
  return {
    calculationId: `golden-v1v2`,
    company: {
      company_name: side.company.companyName,
      org_nr: side.company.orgNr,
      address_line1: side.company.addressLine1,
      address_line2: side.company.addressLine2,
      postal_code: side.company.postalCode,
      city: side.company.city,
      email: side.company.email,
      phone: side.company.phone,
      logo_url: side.company.logoUrl,
    },
    customer: {
      customer_display_name: side.customerDisplayName,
      customer_type: null,
      facility_name: side.facilityDisplayName,
      contact_name: side.contactDisplayName,
    },
    terms: {
      terms_text: side.terms.termsText,
      approved_at: side.terms.approvedAt,
      approved_by: side.terms.approvedBy,
    },
    totals: {
      baseTotalOre: side.totals.baseOre,
      optionTotalOre: side.totals.optionOre,
      vatTotalOre: side.totals.vatOre,
      deductionTotalOre: side.totals.deductionOre,
      acceptedPriceOre: side.totals.baseOre + side.totals.optionOre + side.totals.vatOre,
    },
    assumptions: {
      vatRateBp: side.taxAssumptions.vatRateBp,
      vatDisplay: null,
      deductionType:
        side.taxAssumptions.deductionType === "rot" ||
        side.taxAssumptions.deductionType === "gron_teknik"
          ? side.taxAssumptions.deductionType
          : null,
      deductionRateBp: null,
      deductionCapOre: null,
      deductionPersons: null,
      requiresSignOff: side.taxAssumptions.requiresSignOff,
    },
    header: {
      quoteNumberDisplay: null,
      validUntil: side.validUntil,
      introText: side.introText,
      customerNotes: null,
      displayMode: "detailed",
    },
    lines: side.lines.map((l, i) => ({
      rowType: l.rowType,
      sortOrder: i,
      label: l.label,
      description: null,
      quoteNote: null,
      quantity: l.quantity,
      unit: l.unit,
      unitSellOre: l.sellOre,
      lineNetOre: l.sellOre * l.quantity,
      vatRateBp: l.vatBp,
      isHidden: false,
      isOptional: false,
      isSelected: null,
    })),
    attachments: (side.attachments ?? []).map((a, i) => ({
      fileId: `golden-file-${i}`,
      displayName: a.displayName,
      sortOrder: i,
    })),
    warnings: side.warnings.map((code) => ({ code, severity: "warning", message: code })),
  };
}

/** Serialize the comparison-relevant fields of a built snapshot into a flat record. */
function fieldsOf(s: QuoteVersionSnapshot): Record<string, unknown> {
  return {
    companyName: s.companyName,
    companyOrgNr: s.companyOrgNr,
    customerDisplayName: s.customerDisplayName,
    termsText: s.termsText,
    quoteNumberDisplay: s.quoteNumberDisplay,
    validUntil: s.validUntil,
    introText: s.introText,
    baseTotalOre: s.baseTotalOre,
    optionTotalOre: s.optionTotalOre,
    vatTotalOre: s.vatTotalOre,
    acceptedPriceOre: s.acceptedPriceOre,
    capturedAt: s.capturedAt,
    lines: JSON.stringify(s.lines),
    attachments: JSON.stringify(s.attachments),
  };
}

describe("Story 6.5 — v1/v2 comparison GOLDEN PACK (6.5-GOLDEN-01)", () => {
  test("[P0] the pack is present and non-empty (never a vacuous green)", () => {
    const pack = loadPack();
    assert.ok(pack.cases.length > 0, "quote-version-v1-v2.json must carry >=1 case");
    assert.ok(pack.capturedAtV1.endsWith("Z") && pack.capturedAtV2.endsWith("Z"));
  });

  test("[P0] LABELLING: every case has a valid three-way origin + a non-empty note (no fabricated oracle)", () => {
    const pack = loadPack();
    for (const c of pack.cases) {
      assert.ok(VALID_ORIGINS.includes(c.origin), `case ${c.id}: invalid origin ${c.origin}`);
      assert.ok(typeof c.note === "string" && c.note.trim().length > 0, `case ${c.id}: empty note`);
      if (c.origin === "old-lovable") {
        assert.fail(`case ${c.id}: an old-lovable origin requires a fabricated number — FORBIDDEN`);
      }
      if (c.origin === "documented-delta") {
        assert.notEqual(c.documentedDeltaOldLovableValue, null, `case ${c.id}: documented-delta must record its old value`);
      }
    }
  });

  test("[P0] WARNING CODES are REAL ReadinessCode union values (NEVER the fictional 6.1 codes)", () => {
    const pack = loadPack();
    for (const c of pack.cases) {
      for (const side of [c.v1, c.v2]) {
        for (const code of side.warnings) {
          assert.ok(
            REAL_READINESS_CODES.has(code),
            `case ${c.id}: warning code "${code}" is NOT a real ReadinessCode (REQUIRES_SIGN_OFF etc. are fictional — align to the classifier vocabulary)`,
          );
        }
      }
    }
  });

  test("[P0] CHANGED fields differ between v1 and v2; PRESERVED fields are byte-identical", () => {
    const pack = loadPack();
    for (const c of pack.cases) {
      const v1 = fieldsOf(buildQuoteVersionSnapshot(adapt(c.v1), { capturedAt: pack.capturedAtV1 }));
      const v2 = fieldsOf(buildQuoteVersionSnapshot(adapt(c.v2), { capturedAt: pack.capturedAtV2 }));

      // Every declared changed field MUST differ between v1 and v2 (the customer-visible change v2
      // captured). capturedAt is always changed (v2 re-captures at a later instant).
      for (const field of c.changedFields) {
        assert.notDeepEqual(v1[field], v2[field], `case ${c.id}: changed field "${field}" must differ v1 vs v2`);
      }
      // Every declared preserved field MUST be byte-identical (the frozen prior commitment is
      // unchanged by the new version — the value-level R-609 property).
      for (const field of c.preservedFields) {
        assert.deepEqual(v1[field], v2[field], `case ${c.id}: preserved field "${field}" must be identical v1 vs v2`);
      }
      // capturedAt always advances (the new version freezes a later instant).
      assert.notEqual(v1.capturedAt, v2.capturedAt, `case ${c.id}: v2 capturedAt must advance`);
    }
  });

  test("[P0] FREEZE + öre discipline + R-607 (no cost/internal key on a line)", () => {
    const pack = loadPack();
    for (const c of pack.cases) {
      for (const [label, side, capturedAt] of [
        ["v1", c.v1, pack.capturedAtV1],
        ["v2", c.v2, pack.capturedAtV2],
      ] as const) {
        const built = buildQuoteVersionSnapshot(adapt(side), { capturedAt });
        assert.ok(Object.isFrozen(built), `${c.id}/${label}: snapshot frozen`);
        for (const ore of [built.baseTotalOre, built.optionTotalOre, built.vatTotalOre, built.deductionTotalOre, built.acceptedPriceOre]) {
          assert.ok(isOreAmount(ore), `${c.id}/${label}: ${ore} must be integer öre`);
        }
        for (const line of built.lines) {
          for (const key of Object.keys(line)) {
            const norm = key.toLowerCase().replace(/_/g, "");
            assert.ok(
              !["unitcostore", "markup", "markupbp", "margin", "internalnote"].includes(norm),
              `${c.id}/${label}: line must not carry internal key ${key} (R-607)`,
            );
          }
        }
      }
    }
  });

  test("[P0] PRIVACY SCAN (R-615): no personnummer/real-orgnr/non-test-email/secret", () => {
    const raw = JSON.stringify(loadPack().cases);
    const scrubbed = raw
      .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, "")
      .replace(/556000-\d{4}/g, "");
    assert.ok(!/\b\d{6,8}-\d{4}\b/.test(scrubbed), "personnummer-shaped token found in v1/v2 fixture");
    const emails = raw.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [];
    for (const e of emails) {
      assert.ok(/@example\.test$/i.test(e) || /\.test$/i.test(e), `non-test email in fixture: ${e}`);
    }
    assert.ok(
      !/(api[_-]?key|secret|password|bearer\s|sk_live|service_role)/i.test(raw),
      "secret-shaped token found in v1/v2 fixture",
    );
    for (const m of raw.match(/"[a-zA-Z]*[Oo]re"\s*:\s*(\d+)/g) ?? []) {
      const n = Number(m.replace(/[^\d]/g, ""));
      assert.ok(n < 1_000_000_000, `öre value ${n} has >= 10 digits (privacy scan): ${m}`);
    }
  });
});
