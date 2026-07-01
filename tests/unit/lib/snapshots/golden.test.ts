/**
 * Story 3.5 — ATDD RED-PHASE SCAFFOLD (gated `describe.skip`).
 *
 * GOLDEN-MASTER assertions (AC5): the work-role and optional-article golden
 * fixtures pin a STABLE serialized SnapshotSource shape. Feeding each fixture's
 * `sourceRow` + the FIXED `capturedAt` through the matching pure builder must
 * produce EXACTLY the fixture's `expectedSnapshot`. A future change to the
 * builder/contract that alters the captured shape FAILS this test loud (a visible
 * diff), which is the whole point of a golden — Epics 5-6 freeze this contract.
 *
 * RED PHASE: the builders do not exist yet, so this file is `describe.skip`-gated to
 * keep the green `node --test` baseline unperturbed until dev lands
 * `src/lib/snapshots/build.ts`.
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

// RED-PHASE imports — created by the dev in this story.
// import { buildWorkRoleSnapshot, buildArticleSnapshot } from "@/lib/snapshots/build";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = resolve(HERE, "../../../fixtures/golden/snapshots");

interface GoldenFixture {
  readonly capturedAt: string;
  readonly sourceRow: Record<string, unknown>;
  readonly expectedSnapshot: Record<string, unknown>;
}

function loadFixture(file: string): GoldenFixture {
  return JSON.parse(readFileSync(resolve(GOLDEN_DIR, file), "utf8")) as GoldenFixture;
}

describe.skip("Story 3.5 — golden snapshot fixtures (RED until src/lib/snapshots lands; AC5)", () => {
  test("[P0] work-role-source.json: builder output EXACTLY matches the pinned expectedSnapshot", () => {
    const fx = loadFixture("work-role-source.json");
    // const built = buildWorkRoleSnapshot(fx.sourceRow as never, { capturedAt: fx.capturedAt });
    // assert.deepEqual(built, fx.expectedSnapshot);
    void fx;
    assert.fail("RED: buildWorkRoleSnapshot not implemented yet (golden work-role)");
  });

  test("[P0] article-source.json: builder output EXACTLY matches the pinned expectedSnapshot", () => {
    const fx = loadFixture("article-source.json");
    // const built = buildArticleSnapshot(fx.sourceRow as never, { capturedAt: fx.capturedAt });
    // assert.deepEqual(built, fx.expectedSnapshot);
    void fx;
    assert.fail("RED: buildArticleSnapshot not implemented yet (golden article)");
  });

  test("[P0] golden fixtures are anonymized — no obvious real PII/secret tokens", () => {
    // Belt-and-braces NFR17 guard: the golden inputs/outputs must not smuggle a real
    // orgnr/personnummer/email/secret. Anonymized placeholder material only.
    const files = ["work-role-source.json", "article-source.json"];
    const pii = [/\b\d{6}-\d{4}\b/, /@(?!example\.test\b)[a-z0-9.-]+\.[a-z]{2,}/i, /secret|password|api[_-]?key/i];
    for (const file of files) {
      const raw = readFileSync(resolve(GOLDEN_DIR, file), "utf8");
      for (const re of pii) {
        assert.ok(!re.test(raw), `golden fixture ${file} must be anonymized (matched ${re})`);
      }
    }
  });
});
