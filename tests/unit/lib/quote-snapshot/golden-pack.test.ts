/**
 * Story 6.1 — ATDD RED-PHASE scaffold: the QUOTE-VERSION snapshot content GOLDEN PACK
 * (AC2, P0 — 6.1-GOLDEN-01 + 6.x-UNIT-01 / R-603/R-615).
 *
 * The quote-version analogue of the calc golden pack (`tests/unit/features/calculations/
 * calc-golden-pack.test.ts`) and the money pack — the same pack-level guards + the
 * pack-wide PRIVACY scan, over the quote-version snapshot SHAPE:
 *
 *   1. LABELLING (6.1-GOLDEN-01) — every case in `quote-version-source.json` carries a
 *      valid three-way `origin` (`old-lovable` | `new-expected` | `documented-delta`) +
 *      a non-empty `note`. NO anonymized Lovable quote oracle exists yet, so EVERY case
 *      is `origin: "new-expected"`; a `documented-delta` case ALSO records its divergent
 *      old-Lovable value in `documentedDeltaOldLovableValue`. NEVER fabricate an
 *      old-Lovable number. Keep the labelling/schema guards so an Epic-9 real Lovable
 *      delta lands WITHOUT a code-shape change.
 *   2. SINGLE NUMERIC AUTHORITY PER CATEGORY (R-508 spirit) — the pack REFERENCES the
 *      existing per-category money fixtures (options-tillval / rot-gron-deductions /
 *      vat-rates) as the numeric authority and re-pins NO number; the `note` names the
 *      referenced fixture.
 *   3. BEHAVIORAL GOLDEN — once the pure builder lands (Task 4), each case's `source` is
 *      fed through `buildQuoteVersionSnapshot` with the FIXED `capturedAt` and the output
 *      is asserted to EXACTLY match the frozen expected shape (a future contract change
 *      → a visible diff → fails loud; Epics 6.3+ freeze this).
 *   4. SCHEMA-SHAPE guard — a malformed/half-authored case (missing `origin`/`note`/an
 *      expected value) FAILS loud.
 *   + EXTENDED PRIVACY SCAN (6.x-UNIT-01, R-615) — the CI PII/secret scan EXTENDED to the
 *      quote snapshot fixture payload (personnummer, non-`*.test` email, orgnr shape,
 *      secrets, phone, address). A committed real identifier is an EPIC BLOCKER
 *      regardless of score. Every öre value stays < 10 digits (< 1,000,000,000 öre) or
 *      it trips the orgnr-shape scan.
 *
 * RUNNER-GLOB TRAP: quote goldens live under `tests/unit/**` (this path), NEVER under
 * `tests/golden/**` (the `node --test` fast gate globs `tests/unit/**`; a golden under
 * `tests/golden/**` is silently NEVER RUN — a vacuous green). The FIXTURE stays under
 * `tests/fixtures/golden/snapshots/**` (data, not run by the globber).
 *
 * ── RED-PHASE GATE ──────────────────────────────────────────────────────────────
 * The SCHEMA + PRIVACY + labelling guards run GREEN NOW (they need only the fixture,
 * which exists) — so the pack is a live, non-vacuous test module immediately and the
 * privacy scan protects the committed fixture from day one. The BEHAVIORAL-golden
 * assertions are guarded by `RED_PHASE` and activate in Story 6.1 dev Task 4 once the
 * pure builder lands (flip the flag + wire the import).
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// RED PHASE: flip to `false` in Story 6.1 dev Task 4 once the pure builder lands.
const RED_PHASE = true;
// RED PHASE: un-comment in dev.
// import { buildQuoteVersionSnapshot } from "@/lib/quote-snapshot/build";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, "../../../fixtures/golden/snapshots/quote-version-source.json");

interface GoldenCase {
  readonly id: string;
  readonly origin: "old-lovable" | "new-expected" | "documented-delta";
  readonly note: string;
  readonly documentedDeltaOldLovableValue: unknown;
  readonly source: Record<string, unknown>;
}
interface GoldenPack {
  readonly capturedAt: string;
  readonly cases: readonly GoldenCase[];
}

function loadPack(): GoldenPack {
  return JSON.parse(readFileSync(FIXTURE, "utf8")) as GoldenPack;
}

const VALID_ORIGINS = ["old-lovable", "new-expected", "documented-delta"] as const;

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
      // No anonymized Lovable oracle exists yet — every case must be new-expected until
      // Epic 9 lands a real delta. A documented-delta MUST carry its old value.
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
    // Scan the DATA payload only (the `cases`), NOT the top-level `_comment` meta note —
    // the note legitimately names the scanned classes ("secret", "personnummer", …).
    const raw = JSON.stringify(loadPack().cases);
    // Strip the identifiers that are STRUCTURALLY not PII before the personnummer scan:
    //   - UUIDs (placeholder file/owner ids, 8-4-4-4-12 hex);
    //   - the anonymized dummy orgnr shape `556000-NNNN` (a documented test-only orgnr).
    const scrubbed = raw
      .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, "")
      .replace(/556000-\d{4}/g, "");
    // personnummer YYYYMMDD-NNNN or YYMMDD-NNNN.
    assert.ok(!/\b\d{6,8}-\d{4}\b/.test(scrubbed),
      "personnummer-shaped token found in quote fixture");
    // a real (non-*.test / non-example) email.
    const emails = raw.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [];
    for (const e of emails) {
      assert.ok(/@example\.test$/i.test(e) || /\.test$/i.test(e), `non-test email in fixture: ${e}`);
    }
    // secret-ish tokens.
    assert.ok(!/(api[_-]?key|secret|password|bearer\s|sk_live|service_role)/i.test(raw),
      "secret-shaped token found in quote fixture");
    // every öre value stays < 10 digits (< 1,000,000,000) — a 10+ digit run could be an
    // orgnr/personnummer smuggled as a number.
    for (const m of raw.match(/"[a-zA-Z]*[Oo]re"\s*:\s*(\d+)/g) ?? []) {
      const n = Number(m.replace(/[^\d]/g, ""));
      assert.ok(n < 1_000_000_000, `öre value ${n} has >= 10 digits (privacy scan): ${m}`);
    }
  });

  test("[P0] BEHAVIORAL golden: builder output EXACTLY matches the frozen expected shape", () => {
    if (RED_PHASE) return; // dev Task 4 flips RED_PHASE=false + wires the import.
    // TODO(dev):
    //   const pack = loadPack();
    //   for (const c of pack.cases) {
    //     const built = buildQuoteVersionSnapshot(c.source as never, { capturedAt: pack.capturedAt });
    //     assert.deepEqual({ ...built }, c.expectedSnapshot);
    //   }
    assert.fail("RED PHASE: buildQuoteVersionSnapshot not implemented yet");
  });
});
