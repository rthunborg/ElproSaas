/**
 * ATDD RED-PHASE SCAFFOLD — Story 2.4, the R-002 built-bundle service-role
 * containment check "bite" proof (AC2, P0). Runs under `node --test`
 * (`pnpm run test:unit`). Mirrors service-role-containment.test.ts.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  GATED — DOES NOT RUN UNTIL Story 2.4 implementation.                     ║
 * ║                                                                          ║
 * ║  Needs the NEW dependency-free bare-Node check                            ║
 * ║    `scripts/verify/check-bundle-containment.mjs`                          ║
 * ║  exporting a test-importable `scanBuiltBundle(rootDir)` (mirrors          ║
 * ║  scanForServiceRoleLeak in check-service-role-containment.mjs): scans a    ║
 * ║  `.next/`-shaped tree for service-role key NAMES (`SUPABASE_SERVICE_ROLE_  ║
 * ║  KEY`, any `*SERVICE_ROLE*` token incl. the Story 2.2 re-export symbol     ║
 * ║  `LOCAL_SUPABASE_SERVICE_ROLE_KEY`), the literal local-demo service-role   ║
 * ║  JWT VALUE, `NEXT_PUBLIC_`-prefixed service-role names, secret-placeholder ║
 * ║  patterns, and server-only command internals. Until it lands every test    ║
 * ║  `t.skip(...)`s; keep them skipped.                                        ║
 * ║                                                                          ║
 * ║  GREEN-PHASE: implement scanBuiltBundle, import it, drop the `GATED`        ║
 * ║  guard, run `pnpm run test:unit`, make GREEN. Today the app uses NO        ║
 * ║  service-role key (anon + RLS), so the REAL `.next` scan (the              ║
 * ║  `verify:bundle-containment` CLI, after `pnpm build`) must be CLEAN.       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * COVERAGE (test-design-epic-2.md R-002, P0 "Service-role containment …
 * Grep/inspect built bundle + route payloads"):
 *   AC2 → clean built tree → ZERO violations; a PLANTED service-role token /
 *         local-demo JWT VALUE / `NEXT_PUBLIC_*SERVICE_ROLE*` name → NON-zero.
 *   AC2 → the check FAILS LOUDLY when `.next` is absent (never false-greens an
 *         empty scan).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// GREEN-PHASE: import the scan once it exists (Task 2.1 / 2.3).
// import { scanBuiltBundle } from "../../../../scripts/verify/check-bundle-containment.mjs";

const GATED = true; // flip to false in GREEN-PHASE once the script exists.

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

test("[P0] GREEN: a clean built bundle (no service-role anything) yields ZERO violations", (t) => {
  if (GATED) return t.skip("GATED: scanBuiltBundle not implemented yet");
  withTempRoot((root) => {
    makeNextTree(root, "export const x = 1; // no secrets here\n");
    // GREEN-PHASE:
    //   const { violations } = scanBuiltBundle(root);
    //   assert.deepEqual(violations, []);
  });
});

test("[P0] RED: a service-role key NAME planted in a chunk is flagged", (t) => {
  if (GATED) return t.skip("GATED: scanBuiltBundle not implemented yet");
  withTempRoot((root) => {
    makeNextTree(root, 'const k="SUPABASE_SERVICE_ROLE_KEY";\n');
    // GREEN-PHASE:
    //   const { violations } = scanBuiltBundle(root);
    //   assert.ok(violations.length > 0);
    //   assert.match(violations.join("\n"), /SUPABASE_SERVICE_ROLE_KEY/);
  });
});

test("[P0] RED: the LOCAL_SUPABASE_SERVICE_ROLE_KEY re-export symbol planted in a chunk is flagged", (t) => {
  if (GATED) return t.skip("GATED: scanBuiltBundle not implemented yet");
  withTempRoot((root) => {
    // The 2-2 Round-2 LOW the source guard misses by symbol — the bundle grep
    // catches any `*SERVICE_ROLE*` token.
    makeNextTree(root, 'export const k=LOCAL_SUPABASE_SERVICE_ROLE_KEY;\n');
    // GREEN-PHASE:
    //   const { violations } = scanBuiltBundle(root);
    //   assert.ok(violations.length > 0);
    //   assert.match(violations.join("\n"), /SERVICE_ROLE/);
  });
});

test("[P0] RED: a NEXT_PUBLIC_-prefixed service-role var name in a chunk is flagged", (t) => {
  if (GATED) return t.skip("GATED: scanBuiltBundle not implemented yet");
  withTempRoot((root) => {
    makeNextTree(root, 'const k="NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY";\n');
    // GREEN-PHASE:
    //   const { violations } = scanBuiltBundle(root);
    //   assert.ok(violations.length > 0);
    //   assert.match(violations.join("\n"), /NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/);
  });
});

test("[P0] RED: the literal local-demo service-role JWT VALUE leaked into a chunk is flagged (symbol-independent)", (t) => {
  if (GATED) return t.skip("GATED: scanBuiltBundle not implemented yet");
  withTempRoot((root) => {
    makeNextTree(root, `const t="${LOCAL_DEMO_SERVICE_ROLE_JWT}";\n`);
    // GREEN-PHASE — the VALUE check is what makes the bundle grep authoritative
    // over the source guard (which keys on symbol names):
    //   const { violations } = scanBuiltBundle(root);
    //   assert.ok(violations.length > 0);
  });
  void LOCAL_DEMO_SERVICE_ROLE_JWT;
});

test("[P0] FAILS LOUDLY: scanning a root with NO `.next` dir throws/errors (never a vacuous green)", (t) => {
  if (GATED) return t.skip("GATED: scanBuiltBundle not implemented yet");
  withTempRoot((root) => {
    // GREEN-PHASE — an absent build must be a hard error, not an empty (passing)
    // scan that false-greens R-002:
    //   assert.throws(() => scanBuiltBundle(root), /\.next/);
    void root;
  });
});

void assert;
