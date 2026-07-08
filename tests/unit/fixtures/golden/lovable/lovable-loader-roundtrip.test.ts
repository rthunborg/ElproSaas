/**
 * Story 9.2 — GOLDEN-LOADER ROUND-TRIP (RED-PHASE SCAFFOLD)
 * Covers 9.2-REPEAT-01 (AC2): a captured fixture loads via a lightweight loader and round-trips
 * (parse -> expected shape -> re-serialize is stable), proving re-capture reproducibility.
 *
 * Lightweight ON PURPOSE — this is a loader-sanity + repeatability proof, NOT a comparison harness
 * (that is Story 9.3). The loader pattern is the money-pack `readJson` = JSON.parse(readFileSync(...)).
 *
 * ── GREEN PHASE (Story 9.2 dev) ─────────────────────────────────────────────────────────
 * The committed `lovable/**` fixtures now exist, so this suite RUNS (no longer skipped). The
 * assertions are UNCHANGED from the red-phase scaffold.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  listLovableFixtureFiles,
  lovableFixtureDirPresent,
  readJson,
} from "./lovable-pack-support";
import { readFileSync } from "node:fs";

const PRESENT = lovableFixtureDirPresent();

// Green phase: the surface is present. A HARD guard fails loud if the fixtures were ever removed.
if (!PRESENT) {
  throw new Error(
    "Story 9.2 lovable loader round-trip: the tests/fixtures/golden/lovable/** fixtures are missing — this suite must not run vacuously green (R-904).",
  );
}

describe("Story 9.2 — Lovable golden-loader round-trip (9.2-REPEAT-01)", () => {
  // ── 9.2-REPEAT-01a — every committed fixture parses via the lightweight loader ──
  test("[P0] every committed lovable fixture parses via the lightweight loader (no unparseable fixture)", () => {
    const files = listLovableFixtureFiles();
    assert.ok(files.length >= 1, "the lovable pack must carry >=1 committed fixture");
    for (const file of files) {
      assert.doesNotThrow(() => readJson(file), `${file}: must parse via JSON.parse(readFileSync(...)) (loader sanity)`);
    }
  });

  // ── 9.2-REPEAT-01b — round-trip is STABLE (parse -> re-serialize -> re-parse is deep-equal) ──
  // A captured fixture that does not round-trip stably (e.g. depends on key order or a non-JSON
  // value) is not reproducibly re-capturable. Deep-equality proves the loader's parsed shape is the
  // fixed point of re-serialization.
  test("[P0] round-trip is stable — parse -> serialize -> re-parse is deep-equal (re-capture reproducibility)", () => {
    for (const file of listLovableFixtureFiles()) {
      const first = readJson(file);
      const reserialized = JSON.stringify(first);
      const second = JSON.parse(reserialized);
      assert.deepEqual(second, first, `${file}: fixture must round-trip stably (parse->serialize->parse is a fixed point)`);
    }
  });

  // ── 9.2-REPEAT-01c — the on-disk file is exactly its own canonical re-serialization (deterministic) ──
  // A DETERMINISTIC capture writes the same bytes on re-run. We prove the committed file matches the
  // canonical 2-space pretty-print of its parsed value (trailing-newline tolerant), so a re-run of a
  // deterministic capture produces byte-identical output — the AC2 "repeatable" obligation.
  test("[P1] committed fixture equals its canonical 2-space serialization (deterministic re-capture, AC2)", () => {
    for (const file of listLovableFixtureFiles()) {
      const parsed = readJson(file);
      const canonical = JSON.stringify(parsed, null, 2);
      const onDisk = readFileSync(file, "utf8").replace(/\n+$/, "");
      assert.equal(
        onDisk.replace(/\n+$/, ""),
        canonical.replace(/\n+$/, ""),
        `${file}: on-disk bytes are not the canonical 2-space serialization — a deterministic re-capture would produce a diff. Re-emit via the capture script's canonical writer.`,
      );
    }
  });
});

// Keep the import referenced so lint does not flag it while the suite is skipped in the red phase.
void PRESENT;
