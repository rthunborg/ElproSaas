/**
 * Story 2.4 — the R-002 built-bundle service-role containment check "bite" proof
 * (AC2, P0). Runs under `node --test` (`pnpm run test:unit`). Mirrors
 * service-role-containment.test.ts (RED-on-planted / GREEN-on-clean).
 *
 * Proves `scanBuiltBundle` (scripts/verify/check-bundle-containment.mjs):
 *   - GREEN on a clean built tree → ZERO violations;
 *   - RED on a planted service-role key NAME / the re-export symbol
 *     `LOCAL_SUPABASE_SERVICE_ROLE_KEY` / a `NEXT_PUBLIC_*SERVICE_ROLE*` name / the
 *     literal local-demo service-role JWT VALUE (symbol-independent, the
 *     authoritative catch the source guard misses);
 *   - FAILS LOUDLY (throws) when `.next` is absent — never a vacuous green.
 *
 * Today the app uses NO service-role key (anon + RLS), so the REAL `.next` scan
 * (the `verify:bundle-containment` CLI, after `pnpm build`) is clean.
 *
 * COVERAGE (test-design-epic-2.md R-002, P0).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanBuiltBundle } from "../../../../scripts/verify/check-bundle-containment.mjs";

// The universal local-demo service-role JWT (NOT a real secret — see
// tests/support/test-env.ts). The built-bundle grep must catch its literal VALUE
// regardless of which symbol re-exports it.
const LOCAL_DEMO_SERVICE_ROLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

function withTempRoot(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "elpro-bundle-guard-"));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** Build a minimal `.next`-shaped tree under `root`. */
function makeNextTree(root: string, chunkContents: string): void {
  mkdirSync(join(root, ".next", "static", "chunks"), { recursive: true });
  writeFileSync(join(root, ".next", "static", "chunks", "app.js"), chunkContents);
}

test("[P0] GREEN: a clean built bundle (no service-role anything) yields ZERO violations", () => {
  withTempRoot((root) => {
    makeNextTree(root, "export const x = 1; // no secrets here\n");
    const { violations } = scanBuiltBundle(root);
    assert.deepEqual(violations, []);
  });
});

test("[P0] RED: a service-role key NAME planted in a chunk is flagged", () => {
  withTempRoot((root) => {
    makeNextTree(root, 'const k="SUPABASE_SERVICE_ROLE_KEY";\n');
    const { violations } = scanBuiltBundle(root);
    assert.ok(violations.length > 0, "expected at least one violation");
    assert.match(violations.join("\n"), /SUPABASE_SERVICE_ROLE_KEY/);
  });
});

test("[P0] RED: the LOCAL_SUPABASE_SERVICE_ROLE_KEY re-export symbol planted in a chunk is flagged", () => {
  withTempRoot((root) => {
    // The 2-2 Round-2 LOW the source guard misses by symbol — the bundle grep
    // catches any `*SERVICE_ROLE*` token.
    makeNextTree(root, "export const k=LOCAL_SUPABASE_SERVICE_ROLE_KEY;\n");
    const { violations } = scanBuiltBundle(root);
    assert.ok(violations.length > 0, "expected at least one violation");
    assert.match(violations.join("\n"), /SERVICE_ROLE/);
  });
});

test("[P0] RED: a NEXT_PUBLIC_-prefixed service-role var name in a chunk is flagged", () => {
  withTempRoot((root) => {
    makeNextTree(root, 'const k="NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY";\n');
    const { violations } = scanBuiltBundle(root);
    assert.ok(violations.length > 0, "expected at least one violation");
    assert.match(violations.join("\n"), /NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/);
  });
});

test("[P0] RED: the literal local-demo service-role JWT VALUE leaked into a chunk is flagged (symbol-independent)", () => {
  withTempRoot((root) => {
    makeNextTree(root, `const t="${LOCAL_DEMO_SERVICE_ROLE_JWT}";\n`);
    const { violations } = scanBuiltBundle(root);
    assert.ok(violations.length > 0, "expected at least one violation");
  });
});

test("[P0] RED: a service_role-minting JWT in a route payload (.rsc/.json) is flagged even with a non-demo key", () => {
  withTempRoot((root) => {
    // A different (non-demo) service-role JWT: same `"role":"service_role"` payload
    // shape, different signature — caught by the generic JWT-shape rule, proving the
    // check is not over-fit to the one demo literal.
    const nonDemoServiceRoleJwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJvdGhlci1wcm9qZWN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MjAwMDAwMDAwMH0.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    mkdirSync(join(root, ".next", "server", "app"), { recursive: true });
    writeFileSync(
      join(root, ".next", "server", "app", "page.rsc"),
      `{"token":"${nonDemoServiceRoleJwt}"}`,
    );
    const { violations } = scanBuiltBundle(root);
    assert.ok(violations.length > 0, "expected at least one violation");
  });
});

test("[P0] FAILS LOUDLY: scanning a root with NO `.next` dir throws (never a vacuous green)", () => {
  withTempRoot((root) => {
    // An absent build must be a hard error, not an empty (passing) scan that
    // false-greens R-002.
    assert.throws(() => scanBuiltBundle(root), /\.next/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// File-selection branch coverage (shouldScanFile / SCANNED_EXTENSIONS /
// SCANNED_BASENAMES). The scanner deliberately SKIPS binaries (fonts/images) and
// only scans known extensions + a few extensionless manifest/build basenames. None
// of that selection logic was asserted — a future regression that narrowed the
// scanned extensions, or one that scanned binaries (and false-positived on a token
// that merely happens to appear in a font blob), would pass silently.
// [Story 2.4 Task 2.1; gap: file-selection branches untested]
// ─────────────────────────────────────────────────────────────────────────────

test("[P1] SKIPS binary/non-source extensions: a SERVICE_ROLE token in a `.woff`/`.png` is NOT flagged", () => {
  withTempRoot((root) => {
    mkdirSync(join(root, ".next", "static", "media"), { recursive: true });
    // A font/image is never a browser-readable JS/JSON payload; a byte sequence that
    // happens to read as `SERVICE_ROLE` must NOT trip the scanner (avoids noise).
    writeFileSync(
      join(root, ".next", "static", "media", "font.woff"),
      "garbage SUPABASE_SERVICE_ROLE_KEY garbage\n",
    );
    writeFileSync(
      join(root, ".next", "static", "media", "logo.png"),
      "SUPABASE_SERVICE_ROLE_KEY\n",
    );
    const { violations } = scanBuiltBundle(root);
    assert.deepEqual(violations, []);
  });
});

test("[P1] SCANS extensionless build manifests by basename: a token in `BUILD_ID` IS flagged", () => {
  withTempRoot((root) => {
    // `BUILD_ID` / `trace` have no extension but ARE build artifacts the harness must
    // inspect — covered via SCANNED_BASENAMES, not SCANNED_EXTENSIONS.
    mkdirSync(join(root, ".next"), { recursive: true });
    writeFileSync(
      join(root, ".next", "BUILD_ID"),
      "SUPABASE_SERVICE_ROLE_KEY\n",
    );
    const { violations } = scanBuiltBundle(root);
    assert.ok(violations.length > 0, "a token in BUILD_ID must be flagged");
    assert.match(violations.join("\n"), /BUILD_ID/);
  });
});

test("[P1] recurses into nested build dirs and AGGREGATES violations across multiple files", () => {
  withTempRoot((root) => {
    // Proves walk() descends into nested .next/server/... and that the result
    // accumulates one entry per offending file (not just the first).
    mkdirSync(join(root, ".next", "static", "chunks"), { recursive: true });
    mkdirSync(join(root, ".next", "server", "app"), { recursive: true });
    writeFileSync(
      join(root, ".next", "static", "chunks", "a.js"),
      'const x="SUPABASE_SERVICE_ROLE_KEY";\n',
    );
    writeFileSync(
      join(root, ".next", "server", "app", "b.js"),
      'const y="NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY";\n',
    );
    const { violations } = scanBuiltBundle(root);
    const joined = violations.join("\n");
    assert.match(joined, /static\/chunks\/a\.js/);
    assert.match(joined, /server\/app\/b\.js/);
  });
});
