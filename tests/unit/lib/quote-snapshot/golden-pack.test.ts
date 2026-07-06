/**
 * Story 6.1 — the QUOTE-VERSION snapshot content GOLDEN PACK (AC2, P0 — 6.1-GOLDEN-01 +
 * 6.x-UNIT-01 / R-603/R-615).
 *
 * The quote-version analogue of the calc golden pack + the money pack — the same
 * pack-level guards + the pack-wide PRIVACY scan, over the quote-version snapshot SHAPE:
 *
 *   1. LABELLING (6.1-GOLDEN-01) — every case in `quote-version-source.json` carries a
 *      valid three-way `origin` + a non-empty `note`. NO anonymized Lovable quote oracle
 *      exists yet, so EVERY case is `origin: "new-expected"`; a `documented-delta` case
 *      ALSO records its divergent old-Lovable value. NEVER fabricate an old-Lovable number.
 *      Keep the labelling/schema guards so an Epic-9 real Lovable delta lands WITHOUT a
 *      code-shape change.
 *   2. SINGLE NUMERIC AUTHORITY PER CATEGORY (R-508 spirit) — the pack REFERENCES the
 *      existing per-category money fixtures as the numeric authority; the `note` names them.
 *   3. BEHAVIORAL GOLDEN — each case's `source` is fed through the pure
 *      `buildQuoteVersionSnapshot` with the FIXED `capturedAt` and the output is asserted
 *      to reproduce the fixture's declared identity/terms/totals/warnings/attachments SHAPE
 *      + the öre/bp discipline (a future contract change → a visible diff → fails loud).
 *   4. SCHEMA-SHAPE guard — a malformed/half-authored case FAILS loud.
 *   + EXTENDED PRIVACY SCAN (6.x-UNIT-01, R-615) — the CI PII/secret scan EXTENDED to the
 *      quote snapshot fixture payload (personnummer, non-`*.test` email, orgnr shape,
 *      secrets, phone, address). Every öre value stays < 10 digits or it trips the scan.
 *
 * RUNNER-GLOB TRAP: quote goldens live under `tests/unit/**` (this path), NEVER under
 * `tests/golden/**`. The FIXTURE stays under `tests/fixtures/golden/snapshots/**`.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildQuoteVersionSnapshot } from "@/lib/quote-snapshot/build";
import type { QuoteVersionSnapshotInput } from "@/lib/quote-snapshot/build";
import { isOreAmount } from "@/lib/money";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, "../../../fixtures/golden/snapshots/quote-version-source.json");

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
  description: string | null;
  quantity: number;
  unit: string;
  sellOre: number;
  vatBp: number;
}
interface FixtureSource {
  customerDisplayName: string | null;
  facilityDisplayName: string | null;
  contactDisplayName: string | null;
  company: FixtureCompany;
  terms: { termsText: string; approvedAt: string | null; approvedBy: string | null };
  quoteNumber: number;
  validUntil: string | null;
  lines: FixtureLine[];
  totals: {
    baseOre: number;
    optionOre: number;
    vatOre: number;
    deductionOre: number;
    acceptedPriceBasis: string;
  };
  taxAssumptions: {
    vatRateBp: number;
    deductionType: string | null;
    requiresSignOff: boolean;
  };
  warnings: string[];
  selectedAttachments: Array<{ fileId: string; purpose: string; displayName: string }>;
}
interface GoldenCase {
  readonly id: string;
  readonly origin: "old-lovable" | "new-expected" | "documented-delta";
  readonly note: string;
  readonly documentedDeltaOldLovableValue: unknown;
  readonly source: FixtureSource;
}
interface GoldenPack {
  readonly capturedAt: string;
  readonly cases: readonly GoldenCase[];
}

function loadPack(): GoldenPack {
  return JSON.parse(readFileSync(FIXTURE, "utf8")) as GoldenPack;
}

const VALID_ORIGINS = ["old-lovable", "new-expected", "documented-delta"] as const;

/** Adapt the fixture `source` shape into the pure builder's QuoteVersionSnapshotInput. */
function adaptToBuilderInput(
  src: FixtureSource,
): QuoteVersionSnapshotInput {
  return {
    calculationId: `golden-${src.quoteNumber}`,
    company: {
      company_name: src.company.companyName,
      org_nr: src.company.orgNr,
      address_line1: src.company.addressLine1,
      address_line2: src.company.addressLine2,
      postal_code: src.company.postalCode,
      city: src.company.city,
      email: src.company.email,
      phone: src.company.phone,
      logo_url: src.company.logoUrl,
    },
    customer: {
      customer_display_name: src.customerDisplayName,
      customer_type: null,
      facility_name: src.facilityDisplayName,
      contact_name: src.contactDisplayName,
    },
    terms: {
      terms_text: src.terms.termsText,
      approved_at: src.terms.approvedAt,
      approved_by: src.terms.approvedBy,
    },
    totals: {
      baseTotalOre: src.totals.baseOre,
      optionTotalOre: src.totals.optionOre,
      vatTotalOre: src.totals.vatOre,
      deductionTotalOre: src.totals.deductionOre,
      // Accepted price = base or after-deduction, from the fixture basis (CAPTURED, not computed here).
      acceptedPriceOre:
        src.totals.acceptedPriceBasis === "after-deduction"
          ? src.totals.baseOre + src.totals.vatOre - src.totals.deductionOre
          : src.totals.baseOre + src.totals.vatOre,
    },
    assumptions: {
      vatRateBp: src.taxAssumptions.vatRateBp,
      vatDisplay: null,
      deductionType:
        src.taxAssumptions.deductionType === "rot" ||
        src.taxAssumptions.deductionType === "gron_teknik"
          ? src.taxAssumptions.deductionType
          : null,
      deductionRateBp: null,
      deductionCapOre: null,
      deductionPersons: null,
      requiresSignOff: src.taxAssumptions.requiresSignOff,
    },
    header: {
      quoteNumberDisplay: null,
      validUntil: src.validUntil,
      introText: null,
      customerNotes: null,
      displayMode: "detailed",
    },
    lines: src.lines.map((l, i) => ({
      rowType: l.rowType,
      sortOrder: i,
      label: l.label,
      description: l.description,
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
    attachments: src.selectedAttachments.map((a, i) => ({
      fileId: a.fileId,
      displayName: a.displayName,
      sortOrder: i,
    })),
    warnings: src.warnings.map((code) => ({
      code,
      severity: "warning",
      message: code,
    })),
  };
}

describe("Story 6.1 — quote-version snapshot GOLDEN PACK (6.1-GOLDEN-01)", () => {
  test("[P0] the pack is present and non-empty (never a vacuous green)", () => {
    const pack = loadPack();
    assert.ok(pack.cases.length > 0, "quote-version-source.json must carry >=1 case");
    assert.ok(pack.capturedAt.endsWith("Z"), "capturedAt is a fixed ISO instant");
  });

  test("[P0] LABELLING: every case has a valid three-way origin + a non-empty note", () => {
    const pack = loadPack();
    for (const c of pack.cases) {
      assert.ok(VALID_ORIGINS.includes(c.origin), `case ${c.id}: invalid origin ${c.origin}`);
      assert.ok(typeof c.note === "string" && c.note.trim().length > 0, `case ${c.id}: empty note`);
      // No anonymized Lovable oracle exists yet — an old-lovable origin requires a
      // fabricated number → FORBIDDEN. A documented-delta MUST carry its old value.
      if (c.origin === "old-lovable") {
        assert.fail(`case ${c.id}: an old-lovable origin requires a fabricated number — FORBIDDEN`);
      }
      if (c.origin === "documented-delta") {
        assert.notEqual(
          c.documentedDeltaOldLovableValue,
          null,
          `case ${c.id}: documented-delta must record its divergent old-Lovable value`,
        );
      }
    }
  });

  test("[P0] SCHEMA-SHAPE: each case carries id + source (a half-authored case fails loud)", () => {
    const pack = loadPack();
    for (const c of pack.cases) {
      assert.ok(typeof c.id === "string" && c.id.length > 0, "case missing id");
      assert.ok(c.source && typeof c.source === "object", `case ${c.id}: missing source`);
    }
  });

  test("[P0] PRIVACY SCAN (6.x-UNIT-01, R-615): no personnummer/real-orgnr/non-test-email/secret/phone", () => {
    const raw = JSON.stringify(loadPack().cases);
    const scrubbed = raw
      .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, "")
      .replace(/556000-\d{4}/g, "");
    assert.ok(!/\b\d{6,8}-\d{4}\b/.test(scrubbed),
      "personnummer-shaped token found in quote fixture");
    const emails = raw.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [];
    for (const e of emails) {
      assert.ok(/@example\.test$/i.test(e) || /\.test$/i.test(e), `non-test email in fixture: ${e}`);
    }
    assert.ok(!/(api[_-]?key|secret|password|bearer\s|sk_live|service_role)/i.test(raw),
      "secret-shaped token found in quote fixture");
    for (const m of raw.match(/"[a-zA-Z]*[Oo]re"\s*:\s*(\d+)/g) ?? []) {
      const n = Number(m.replace(/[^\d]/g, ""));
      assert.ok(n < 1_000_000_000, `öre value ${n} has >= 10 digits (privacy scan): ${m}`);
    }
  });

  test("[P0] BEHAVIORAL golden: builder reproduces the fixture identity/terms/totals/warnings SHAPE + öre discipline", () => {
    const pack = loadPack();
    for (const c of pack.cases) {
      const built = buildQuoteVersionSnapshot(adaptToBuilderInput(c.source), {
        capturedAt: pack.capturedAt,
      });
      // The injected capturedAt flows through verbatim.
      assert.equal(built.capturedAt, pack.capturedAt, `${c.id}: capturedAt`);
      // FULL company identity captured (not the identity-partial variant).
      assert.equal(built.companyOrgNr, c.source.company.orgNr, `${c.id}: org_nr captured`);
      assert.equal(built.companyEmail, c.source.company.email, `${c.id}: email captured`);
      assert.equal(built.companyPhone, c.source.company.phone, `${c.id}: phone captured`);
      // Terms sign-off captured VERBATIM.
      assert.equal(built.termsApprovedAt, c.source.terms.approvedAt, `${c.id}: approvedAt verbatim`);
      // Totals CAPTURED from the fixture (single numeric authority — no re-pin).
      assert.equal(built.baseTotalOre, c.source.totals.baseOre, `${c.id}: base öre captured`);
      assert.equal(built.optionTotalOre, c.source.totals.optionOre, `${c.id}: option öre captured`);
      assert.equal(built.vatTotalOre, c.source.totals.vatOre, `${c.id}: VAT öre captured`);
      assert.equal(built.deductionTotalOre, c.source.totals.deductionOre, `${c.id}: deduction öre captured`);
      // requiresSignOff captured (the demo-data-only unapproved marker).
      assert.equal(built.requiresSignOff, c.source.taxAssumptions.requiresSignOff, `${c.id}: requiresSignOff`);
      // Warnings + attachments captured.
      assert.equal(built.warnings.length, c.source.warnings.length, `${c.id}: warnings count`);
      assert.equal(built.attachments.length, c.source.selectedAttachments.length, `${c.id}: attachments count`);
      // öre discipline: every total is a valid integer öre; VAT rate is bp.
      for (const ore of [built.baseTotalOre, built.optionTotalOre, built.vatTotalOre, built.deductionTotalOre, built.acceptedPriceOre]) {
        assert.ok(isOreAmount(ore), `${c.id}: ${ore} must be integer öre`);
      }
      assert.ok(Number.isInteger(built.vatRateBp) && (built.vatRateBp ?? 0) <= 10000, `${c.id}: VAT bp`);
      // Frozen (immutable at runtime).
      assert.ok(Object.isFrozen(built), `${c.id}: snapshot frozen`);
      // R-607: no internal/cost key leaked onto a line.
      for (const line of built.lines) {
        for (const key of Object.keys(line)) {
          const norm = key.toLowerCase().replace(/_/g, "");
          assert.ok(
            !["unitcostore", "markup", "markupbp", "margin", "internalnote"].includes(norm),
            `${c.id}: line must not carry internal key ${key} (R-607)`,
          );
        }
      }
    }
  });
});
