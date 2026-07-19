/**
 * Story 10.2 — ATDD RED-PHASE scaffold: the lifecycle golden fixture EXTENDED with a `lost` version
 * (10.2-GOLDEN-01, P1, AC2/AC3, R-1010/R-1014).
 *
 * A LIVE oracle over an anonymized, shape-only golden fixture that pins the Förlorad/Avböjd lifecycle
 * shape so a mis-stated fixture value fails LOUD rather than drifting:
 *   1. APPEND-ONLY — the `lost` version carries a NEW `lost` event appended to its event log; the
 *      prior events (created/sent) are byte-unchanged (nothing is rewritten — ADR-A005 / FR63).
 *   2. ONE reason — exactly one lost-reason record, `outcome ∈ {forlorad, avbojd}` +
 *      `category ∈ strawman`, `note` present iff the case is an `annat` case.
 *   3. SENT SNAPSHOT BYTE-UNCHANGED (AC3) — the version's customer-visible snapshot block
 *      (intro/terms/lines/attachments/öre totals) is IDENTICAL to its pre-lost `sentSnapshot`
 *      baseline; the ONLY delta between the two states is `status: sent → lost`.
 *   4. PRIVACY (R-1014) — NO real PII/secret anywhere in the fixture (personnummer/orgnr/email/phone
 *      shapes), and every öre value stays < 10 digits (orgnr-scan safe). The CI PII/secret scan
 *      (10.x-UNIT-01) is extended to this fixture.
 *
 * ── EOL PIN (epic-10 retro, Story 10-1 Phase-5 — the 9.2-REPEAT-01 class) ─────────────────────────
 * The new golden JSON MUST be pinned `text eol=lf` in `.gitattributes` (a golden fixture not pinned
 * LF fails on a Windows `autocrlf` checkout while passing CI). A broad
 * `text eol=lf` entry for the golden-fixtures JSON glob is added in this same PR.
 *
 * ── WHY the top `describe` is skipped (RED PHASE) ─────────────────────────────────────────────────
 * The fixture does NOT exist yet (Task 6.4 authors `tests/fixtures/golden/quotes/lost-lifecycle.json`
 * in the DEV phase). The read is guarded so an absent fixture does not throw at module load; the whole
 * suite is `describe(..., { skip })` until the fixture is authored + the `lost` shape lands. GREEN
 * phase: author the fixture (anonymized), add the `.gitattributes` LF pin, remove `{ skip }`. The
 * assertions are the CONTRACT — do not weaken them.
 *
 * Runner: `node --test` (`pnpm test:unit`) — PURE, NO DB, NO PII, NO clock. Mirrors
 * `accept-quote-to-job-golden.test.ts` (7.2) + `tests/unit/lib/money/golden-pack.test.ts`.
 *
 * [Source: story 10.2 AC2/AC3 + Task 6.4 + Dev Notes "Testing"; test-design-epic-10.md#10.2-GOLDEN-01,
 *  R-1010/R-1014; ADR-A005 (immutable sent snapshot); _bmad-output/auto-bmad/retro-notes/epic-10.md]
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
// GREEN: Task 6.4 authors this anonymized fixture (extends the lifecycle oracle with a lost version).
const FIXTURE_PATH = resolve(HERE, "../../../fixtures/golden/quotes/lost-lifecycle.json");

interface LostEvent {
  readonly type: string;
  readonly occurredAt: string;
}
interface LostReason {
  readonly outcome: "forlorad" | "avbojd";
  readonly category: "pris" | "konkurrent" | "tidplan" | "uteblivet_svar" | "annat";
  readonly note?: string;
}
interface Snapshot {
  readonly introText: string;
  readonly termsText: string;
  readonly baseTotalOre: number;
  readonly lines: readonly { readonly label: string; readonly unitSellOre: number }[];
}
interface LostCase {
  readonly id: string;
  readonly sentSnapshot: Snapshot;
  readonly lostSnapshot: Snapshot; // MUST equal sentSnapshot except status
  readonly status: string; // "lost"
  readonly events: readonly LostEvent[];
  readonly reason: LostReason;
}
interface Fixture {
  readonly lostCases?: readonly LostCase[];
}

// Guarded read — an absent fixture (RED phase) yields an empty case set; the suite stays skipped.
const fixture: Fixture = existsSync(FIXTURE_PATH)
  ? (JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as Fixture)
  : {};
const cases = fixture.lostCases ?? [];

const ORE_MAX_DIGITS = 10;
const PII_PATTERNS: readonly RegExp[] = [
  /\b\d{6,8}[-+]\d{4}\b/, // personnummer / orgnr
  /\b[\w.+-]+@(?!example\.test)[\w.-]+\.[a-z]{2,}\b/i, // non-example.test email
  /\b(?:\+46|0)\d[\d\s-]{6,}\b/, // phone
];

describe(
  "10.2-GOLDEN-01: lost-version lifecycle golden (RED — fixture not authored)",
  { skip: "ATDD red phase — Story 10.2 lost-lifecycle golden fixture not authored" },
  () => {
    test("the fixture carries at least one lost case incl. an `annat` case (note required)", () => {
      assert.ok(cases.length > 0, "expected authored lostCases");
      assert.ok(
        cases.some((c) => c.reason.category === "annat" && (c.reason.note?.trim().length ?? 0) > 0),
        "expected an annat case with a non-empty note",
      );
    });

    test("each lost case is terminal `lost` with EXACTLY ONE reason in the strawman vocabulary", () => {
      const outcomes = new Set(["forlorad", "avbojd"]);
      const categories = new Set(["pris", "konkurrent", "tidplan", "uteblivet_svar", "annat"]);
      for (const c of cases) {
        assert.equal(c.status, "lost", `${c.id} must be terminal lost`);
        assert.ok(outcomes.has(c.reason.outcome), `${c.id} outcome must be forlorad|avbojd`);
        assert.ok(categories.has(c.reason.category), `${c.id} category must be strawman`);
        if (c.reason.category === "annat") {
          assert.ok((c.reason.note?.trim().length ?? 0) > 0, `${c.id} annat requires a note`);
        }
      }
    });

    test("APPEND-ONLY: a `lost` event is appended after the prior events, none rewritten", () => {
      for (const c of cases) {
        const types = c.events.map((e) => e.type);
        assert.equal(types[types.length - 1], "lost", `${c.id} last event must be lost`);
        assert.equal(types.filter((t) => t === "lost").length, 1, `${c.id} exactly one lost event`);
        // The pre-lost log (created/sent …) is preserved ahead of the appended lost event.
        assert.ok(types.slice(0, -1).includes("sent"), `${c.id} keeps its prior sent event`);
      }
    });

    test("SENT SNAPSHOT BYTE-UNCHANGED (AC3): the lost state differs ONLY by status", () => {
      for (const c of cases) {
        assert.deepEqual(
          c.lostSnapshot,
          c.sentSnapshot,
          `${c.id}: the lost flip must change ONLY status — the customer-visible snapshot is frozen`,
        );
      }
    });

    test("PRIVACY (R-1014): NO real PII/secret; every öre value < 10 digits", () => {
      const blob = JSON.stringify(fixture);
      for (const re of PII_PATTERNS) {
        assert.doesNotMatch(blob, re, `fixture must not contain a ${re} shape`);
      }
      for (const c of cases) {
        for (const ore of [c.sentSnapshot.baseTotalOre, ...c.sentSnapshot.lines.map((l) => l.unitSellOre)]) {
          assert.ok(
            String(Math.abs(ore)).length < ORE_MAX_DIGITS,
            `${c.id}: öre value ${ore} must be < ${ORE_MAX_DIGITS} digits`,
          );
        }
      }
    });
  },
);
