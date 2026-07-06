/**
 * Story 6.3 — 6.3-GOLDEN-01 (P0, AC1, PRIMARY — text extraction) + 6.x-UNIT-01 (R-615).
 *
 * The PDF TEXT-EXTRACTION golden: representative quote PDFs (options/tillval, hidden rows,
 * ROT/grön warnings, attachment sets) — render the PDF from the frozen snapshot, EXTRACT the
 * text, and assert the totals, VAT/tax blocks (with the non-final ROT/grön framing +
 * requiresSignOff), terms, attachment list, and customer-visible warnings MATCH the snapshot.
 * The pixel/visual snapshot (6.3-GOLDEN-02) is a P1 stability check only and NEVER gates.
 *
 * Guards carried over from the 6.1 golden pack (do NOT loosen):
 *   1. LABELLING — every fixture case carries a valid three-way `origin`
 *      (`old-lovable`/`new-expected`/`documented-delta`) + a non-empty `note`. NO anonymized
 *      Lovable quote-PDF oracle exists yet, so EVERY case is `origin: "new-expected"`; NEVER
 *      fabricate an old-Lovable number. Keep the labelling/schema guards so an Epic-9 real
 *      Lovable delta lands WITHOUT a code-shape change.
 *   2. SINGLE NUMERIC AUTHORITY — reference the existing per-category money fixtures as the
 *      numeric authority; do NOT re-pin the same öre value.
 *   3. PRIVACY SCAN (6.x-UNIT-01) — anonymized shape-only fixtures: no personnummer /
 *      real-orgnr / non-`.test` email / secret / phone; every öre value < 10 digits
 *      (< 1,000,000,000) or it trips the pack-wide scan. Warning codes use the REAL
 *      `ReadinessCode` union — NEVER the fictional 6.1 codes.
 *
 * RUNNER-GLOB TRAP: this golden lives under `tests/unit/**` (this path), NEVER
 * `tests/golden/**`. The FIXTURE lives under `tests/fixtures/golden/quote-pdf/**`.
 *
 * ── GREEN (Story 6.3, Tasks 2/3/6.3) ────────────────────────────────────────────────
 * The deterministic renderer (`src/server/quote-pdf/render.ts`), the pure view model
 * (`src/lib/quote-pdf/**`), the pinned text-extraction devDependency (`pdfjs-dist`), and the
 * origin-labelled fixture pack (`tests/fixtures/golden/quote-pdf/quote-pdf-source.json`) have
 * landed; this golden drives them end-to-end.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO clock (the render timestamp
 * is INJECTED, mirroring the snapshot builder's `capturedAt`).
 *
 * [Source: test-design-epic-6.md#6.3-GOLDEN-01/02, R-606/R-610/R-612/R-615; story 6.3
 *  Task 3 + Task 6.3; epic-6 retro-notes#Story 6-1 (golden warning-code representativeness);
 *  deferred-work.md#6-1 (fictional golden codes); src/features/calculations/readiness.ts
 *  (the REAL ReadinessCode union); tests/unit/lib/quote-snapshot/golden-pack.test.ts (the
 *  6.1 pack-guard precedent this mirrors)]
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildQuotePdfViewModel } from "@/lib/quote-pdf/view-model";
import { renderQuotePdf } from "@/server/quote-pdf/render";
import { extractPdfText } from "../../../support/pdf-text";

// GREEN (Story 6.3, Tasks 2/3/6.3): the pure view model, the deterministic renderer, the pinned
// text-extraction devDependency (`pdfjs-dist`), and the fixture pack have landed. Each fixture
// case's `snapshot` is fed → buildQuotePdfViewModel → renderQuotePdf({ viewModel, renderedAt:
// FIXED_ISO }) → extractPdfText(bytes) → assert the declared text blocks appear.

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(
  HERE,
  "../../../fixtures/golden/quote-pdf/quote-pdf-source.json",
);

const GREEN = {} as const;

const VALID_ORIGINS = ["old-lovable", "new-expected", "documented-delta"] as const;
const FIXED_ISO = "2026-07-05T12:00:00.000Z"; // the INJECTED render instant (determinism, R-612)

describe("Story 6.3 — quote PDF text-extraction GOLDEN (6.3-GOLDEN-01)", () => {
  test("[P0] the pack is present and non-empty (never a vacuous green)", GREEN, () => {
    const pack = loadPack();
    assert.ok(pack.cases.length > 0, "quote-pdf-source.json must carry >=1 representative case");
  });

  test("[P0] LABELLING: every case has a valid three-way origin + a non-empty note", GREEN, () => {
    const pack = loadPack();
    for (const c of pack.cases) {
      assert.ok(VALID_ORIGINS.includes(c.origin), `case ${c.id}: invalid origin ${c.origin}`);
      assert.ok(typeof c.note === "string" && c.note.trim().length > 0, `case ${c.id}: empty note`);
      // No anonymized Lovable PDF oracle exists yet — an old-lovable origin needs a fabricated
      // number → FORBIDDEN. A documented-delta MUST record its divergent old-Lovable value.
      assert.notEqual(c.origin, "old-lovable", `case ${c.id}: an old-lovable origin requires a fabricated number — FORBIDDEN`);
      if (c.origin === "documented-delta") {
        assert.notEqual(c.documentedDeltaOldLovableValue, null, `case ${c.id}: documented-delta must record its old-Lovable value`);
      }
    }
  });

  test("[P0] PRIVACY SCAN (6.x-UNIT-01, R-615): no personnummer/real-orgnr/non-test-email/secret; öre < 10 digits", GREEN, () => {
    const raw = JSON.stringify(loadPack().cases);
    const scrubbed = raw
      .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, "")
      .replace(/556000-\d{4}/g, "");
    assert.ok(!/\b\d{6,8}-\d{4}\b/.test(scrubbed), "personnummer-shaped token found in quote-PDF fixture");
    const emails = raw.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [];
    for (const e of emails) {
      assert.ok(/\.test$/i.test(e), `non-test email in fixture: ${e}`);
    }
    assert.ok(!/(api[_-]?key|secret|password|bearer\s|sk_live|service_role)/i.test(raw), "secret-shaped token found in quote-PDF fixture");
    for (const m of raw.match(/"[a-zA-Z]*[Oo]re"\s*:\s*(\d+)/g) ?? []) {
      const n = Number(m.replace(/[^\d]/g, ""));
      assert.ok(n < 1_000_000_000, `öre value ${n} has >= 10 digits (privacy scan): ${m}`);
    }
  });

  test("[P0] TEXT GOLDEN: the extracted PDF text reproduces the snapshot totals/VAT/terms/attachments/warnings", GREEN, async () => {
    const pack = loadPack();
    for (const c of pack.cases) {
      const viewModel = buildQuotePdfViewModel(c.snapshot as never);
      const bytes = await renderQuotePdf({ viewModel, renderedAt: FIXED_ISO });
      const text = await extractPdfText(bytes);

      // TOTALS — the customer-visible kronor totals appear in the extracted text.
      for (const expected of c.expectText.totals) {
        assert.ok((text as string).includes(expected), `${c.id}: total "${expected}" missing from extracted PDF text`);
      }
      // TERMS + intro/customer notes text present.
      for (const expected of c.expectText.terms) {
        assert.ok((text as string).includes(expected), `${c.id}: terms text "${expected}" missing`);
      }
      // ATTACHMENT LIST — each selected attachment display name appears.
      for (const name of c.expectText.attachments) {
        assert.ok((text as string).includes(name), `${c.id}: attachment "${name}" missing from PDF text`);
      }
      // CUSTOMER-VISIBLE WARNINGS — the REAL ReadinessCode messages appear with non-final framing.
      for (const warn of c.expectText.warnings) {
        assert.ok((text as string).includes(warn), `${c.id}: warning "${warn}" missing`);
      }
      // NON-FINAL FRAMING — a requiresSignOff case renders an estimate/sign-off cue, never a
      // legally-final document (demo-data-only, R-610).
      if (c.snapshot.requiresSignOff) {
        assert.ok(
          c.expectText.nonFinalCue && (text as string).includes(c.expectText.nonFinalCue),
          `${c.id}: a requiresSignOff PDF must render the non-final "estimate / requires sign-off" cue`,
        );
      }
      // INTERNAL-FIELD ABSENCE — no cost/margin/internal-note text ever reaches the PDF (R-607).
      for (const forbidden of c.expectText.mustNotAppear ?? []) {
        assert.equal((text as string).includes(forbidden), false, `${c.id}: forbidden internal text "${forbidden}" leaked into the PDF`);
      }
    }
  });
});

// ── Fixture-pack loader + shape (GREEN — reads the real origin-labelled fixture pack). ──
interface GoldenCase {
  readonly id: string;
  readonly origin: (typeof VALID_ORIGINS)[number];
  readonly note: string;
  readonly documentedDeltaOldLovableValue: unknown;
  readonly snapshot: { readonly requiresSignOff: boolean } & Record<string, unknown>;
  readonly expectText: {
    readonly totals: readonly string[];
    readonly terms: readonly string[];
    readonly attachments: readonly string[];
    readonly warnings: readonly string[];
    readonly nonFinalCue?: string;
    readonly mustNotAppear?: readonly string[];
  };
}
interface GoldenPack {
  readonly renderedAt: string;
  readonly cases: readonly GoldenCase[];
}

/** Load + parse the origin-labelled quote-PDF golden fixture pack. */
function loadPack(): GoldenPack {
  return JSON.parse(readFileSync(FIXTURE, "utf8")) as GoldenPack;
}
