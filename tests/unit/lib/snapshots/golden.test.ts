/**
 * Story 3.5 — GOLDEN-MASTER assertions (AC5): the work-role and optional-article
 * golden fixtures pin a STABLE serialized SnapshotSource shape. Feeding each fixture's
 * `sourceRow` + the FIXED `capturedAt` through the matching pure builder must produce
 * EXACTLY the fixture's `expectedSnapshot`. A future change to the builder/contract that
 * alters the captured shape FAILS this test loud (a visible diff), which is the whole
 * point of a golden — Epics 5-6 freeze this contract.
 *
 * GREEN PHASE: `src/lib/snapshots/build.ts` now exists, so the gate is removed and the
 * builders run against the pinned fixtures for real.
 *
 * Runner: `node --test` with TS strip-types (`pnpm test:unit`) — pure, NO DB. The
 * fixtures live under `tests/fixtures/golden/snapshots/**` (architecture §25; AR25).
 * Fixtures are anonymized — NO real names/orgnr/personnummer/emails/secrets (NFR17).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  buildWorkRoleSnapshot,
  buildArticleSnapshot,
  type WorkRoleSourceRow,
  type ArticleSourceRow,
} from "@/lib/snapshots/build";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = resolve(HERE, "../../../fixtures/golden/snapshots");

interface GoldenFixture {
  readonly capturedAt: string;
  readonly sourceRow: Record<string, unknown>;
  readonly expectedSnapshot: Record<string, unknown>;
}

function loadFixture(file: string): GoldenFixture {
  return JSON.parse(
    readFileSync(resolve(GOLDEN_DIR, file), "utf8"),
  ) as GoldenFixture;
}

describe("Story 3.5 — golden snapshot fixtures (AC5)", () => {
  test("[P0] work-role-source.json: builder output EXACTLY matches the pinned expectedSnapshot", () => {
    const fx = loadFixture("work-role-source.json");
    const built = buildWorkRoleSnapshot(fx.sourceRow as unknown as WorkRoleSourceRow, {
      capturedAt: fx.capturedAt,
    });
    // A frozen instance deep-equals a plain object with the same enumerable keys.
    assert.deepEqual({ ...built }, fx.expectedSnapshot);
  });

  test("[P0] article-source.json: builder output EXACTLY matches the pinned expectedSnapshot", () => {
    const fx = loadFixture("article-source.json");
    const built = buildArticleSnapshot(fx.sourceRow as unknown as ArticleSourceRow, {
      capturedAt: fx.capturedAt,
    });
    assert.deepEqual({ ...built }, fx.expectedSnapshot);
  });

  test("[P0] golden fixtures are anonymized — no obvious real PII/secret tokens", () => {
    // Belt-and-braces NFR17 guard: the golden DATA (sourceRow + expectedSnapshot) must
    // not smuggle a real orgnr/personnummer/email/secret. Anonymized placeholder material
    // only. Scans the data payload — NOT the human-facing `_doc` prose, which legitimately
    // mentions the word "secrets" while DESCRIBING the anonymization rule (scanning the
    // prose would false-positive on its own documentation, not on real PII).
    const files = ["work-role-source.json", "article-source.json"];
    const pii = [
      /\b\d{6}-\d{4}\b/,
      /@(?!example\.test\b)[a-z0-9.-]+\.[a-z]{2,}/i,
      /secret|password|api[_-]?key/i,
    ];
    for (const file of files) {
      const fx = loadFixture(file);
      const dataOnly = JSON.stringify({
        capturedAt: fx.capturedAt,
        sourceRow: fx.sourceRow,
        expectedSnapshot: fx.expectedSnapshot,
      });
      for (const re of pii) {
        assert.ok(
          !re.test(dataOnly),
          `golden fixture ${file} data must be anonymized (matched ${re})`,
        );
      }
    }
  });
});
