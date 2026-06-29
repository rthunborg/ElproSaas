// Service-role client-path containment guard (Story 2.1, Task 5 / R-002).
//
// The service-role key bypasses RLS and is SERVER-ONLY (architecture §6; project-context
// "Critical Don't-Miss Rules"). Until now that rule was prose-only with no automated
// enforcement (deferred-work.md → "Env-contract security rules are prose-only";
// epic-1-retro Technical Debt #2). This guard makes it bite: it FAILS when
//
//   1. any `NEXT_PUBLIC_`-prefixed service-role variable name appears anywhere
//      (a `NEXT_PUBLIC_` service-role key would be inlined into the browser bundle), or
//   2. `SUPABASE_SERVICE_ROLE_KEY` is referenced from a browser-reachable client path —
//      a module marked `"use client"` (Next.js client component).
//
// A legitimate SERVER-ONLY reference (no `"use client"`, not `NEXT_PUBLIC_`) is allowed:
// the guard targets client-path / browser leakage, not all usage. Story 2.1 itself uses
// NO service-role key (anon key + RLS), so the clean tree must yield zero violations.
//
// Dependency-free bare-Node `.mjs`, mirroring `scripts/verify/check-lockfiles.mjs`. It is
// BOTH a CLI (wired into CI via `verify:service-role-containment`) and a test-importable
// function (`scanForServiceRoleLeak`) so its bite is provable (Task 6.3).

import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SERVICE_ROLE_VAR = "SUPABASE_SERVICE_ROLE_KEY";
// The TEST-ONLY re-export symbol (tests/support/test-env.ts) under which the local
// service-role key is aliased. A `"use client"` module that transitively imported
// the test-env/factories would reference THIS symbol, not the literal env-var name,
// and slip past the bare-name check above (2-2 Round-2 LOW). Story 2.4 closes that
// gap here; the built-bundle grep (check-bundle-containment.mjs) is the authoritative
// catch for the JWT VALUE regardless of symbol.
const SERVICE_ROLE_REEXPORT_SYMBOL = "LOCAL_SUPABASE_SERVICE_ROLE_KEY";
// Any NEXT_PUBLIC_-prefixed variable whose name contains SERVICE_ROLE is forbidden
// outright: NEXT_PUBLIC_ exposure ships the value to the browser bundle.
const NEXT_PUBLIC_SERVICE_ROLE_RE = /NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE[A-Z0-9_]*/g;
const USE_CLIENT_RE = /^\s*['"]use client['"]\s*;?/m;

// Scanned source/config extensions. The threat is leakage into the BROWSER BUNDLE or the
// env contract — code and env files, NOT documentation. Markdown is deliberately excluded:
// docs (this story file, local-setup.md, etc.) MUST be free to describe the forbidden
// pattern as prose without tripping the guard (those strings never ship to a bundle).
const SCANNED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".example", // `.env.example`
]);
// `.env.example` has extension `.example`; also match bare `.env`-style names at a root.
const SCANNED_BASENAMES = new Set([".env.example"]);

// Roots that can reach the browser bundle / define the env contract. Documentation roots
// (`_bmad-output/`, `docs/`) and config-only trees are intentionally NOT walked. `app` is
// included so an App-Router `app/**` tree OUTSIDE `src/` (a valid Next.js layout) is
// covered too — this repo keeps `app` under `src/`, but the guard must not depend on that
// (2-1 deferred-work: scanned-roots scope). `walk` no-ops on a non-existent root.
const SCANNED_ROOTS = ["src", "app", "scripts", "tests"];
// Top-level files (relative to rootDir) scanned in addition to the roots above. The root
// `middleware.ts` runs on the edge in front of every request and CAN reach the env/bundle
// surface, so the guard must cover it (Story 2.1 review fix — session-refresh middleware).
// `next.config.*` is build-time config that can inline `env`/`NEXT_PUBLIC_` values into the
// client bundle, so it is covered too (2-1 deferred-work: root config scope).
const SCANNED_ROOT_FILES = [
  ".env.example",
  "middleware.ts",
  "next.config.ts",
  "next.config.mjs",
  "next.config.js",
  "next.config.cjs",
];

const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "out",
  "build",
  "coverage",
]);

// The guard itself and its tests deliberately mention the forbidden patterns as string
// literals; scanning them would be a guaranteed false positive. The Story 2.4 built-bundle
// containment check + its bite-proof unit do the same (they carry the demo JWT VALUE and a
// `NEXT_PUBLIC_*SERVICE_ROLE*` literal as DETECTION patterns / planted fixtures), so they
// self-exclude here for the identical reason.
const SELF_FILES = new Set([
  "scripts/verify/check-service-role-containment.mjs",
  "scripts/verify/check-bundle-containment.mjs",
  "tests/unit/scripts/verify/service-role-containment.test.ts",
  "tests/unit/scripts/verify/bundle-containment.test.ts",
]);

function shouldScanFile(absPath) {
  const base = absPath.split(/[\\/]/).pop() ?? "";
  if (SCANNED_BASENAMES.has(base)) return true;
  return SCANNED_EXTENSIONS.has(extname(absPath));
}

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

/**
 * Scan a project tree for service-role client-path / NEXT_PUBLIC_ leakage. The
 * bundle-reachable / env-contract roots are scanned: the `SCANNED_ROOTS` trees
 * (`src`, `app`, `scripts`, `tests`) plus the `SCANNED_ROOT_FILES` top-level files
 * (`.env.example`, `middleware.ts`, and every `next.config.*` form). Documentation
 * roots (`_bmad-output/`, `docs/`) are intentionally out of scope.
 * @returns {{ violations: string[] }} human-readable violation messages (empty = clean).
 */
export function scanForServiceRoleLeak(rootDir) {
  const violations = [];

  const files = [];
  for (const rootName of SCANNED_ROOTS) {
    for (const file of walk(join(rootDir, rootName))) files.push(file);
  }
  for (const rootFile of SCANNED_ROOT_FILES) {
    files.push(join(rootDir, rootFile));
  }

  for (const file of files) {
    const rel = relative(rootDir, file).replace(/\\/g, "/");
    if (SELF_FILES.has(rel)) continue;
    if (!shouldScanFile(file)) continue;

    let contents;
    try {
      contents = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    // 1. NEXT_PUBLIC_-prefixed service-role variable name anywhere.
    const publicMatches = contents.match(NEXT_PUBLIC_SERVICE_ROLE_RE);
    if (publicMatches) {
      for (const match of new Set(publicMatches)) {
        violations.push(
          `${rel}: forbidden NEXT_PUBLIC_ service-role variable \`${match}\` ` +
            `— a NEXT_PUBLIC_ value is exposed to the browser bundle.`,
        );
      }
    }

    // 2. Service-role key referenced from a "use client" (browser-reachable) module —
    //    either the literal env-var name OR the TEST-ONLY re-export symbol
    //    `LOCAL_SUPABASE_SERVICE_ROLE_KEY` (2-2 Round-2 LOW — the symbol the bare-name
    //    check missed). A legitimate SERVER-ONLY reference (no "use client") is allowed;
    //    the test-env module that DECLARES the symbol is not a client module, so it does
    //    not trip this.
    if (USE_CLIENT_RE.test(contents)) {
      if (contents.includes(SERVICE_ROLE_VAR)) {
        violations.push(
          `${rel}: \`${SERVICE_ROLE_VAR}\` referenced from a "use client" module ` +
            `— the service-role key must never be reachable from a client path.`,
        );
      }
      if (contents.includes(SERVICE_ROLE_REEXPORT_SYMBOL)) {
        violations.push(
          `${rel}: the test-only re-export symbol \`${SERVICE_ROLE_REEXPORT_SYMBOL}\` ` +
            `referenced from a "use client" module — the local service-role key must ` +
            `never be reachable from a client path, even via its alias.`,
        );
      }
    }
  }

  return { violations };
}

// CLI behavior: when run directly (not imported by a test), scan the repo root and exit
// non-zero on any violation. Compare normalized paths so Windows back/forward slashes and
// drive-letter casing don't break the main-module check.
function normalize(p) {
  return String(p).replace(/\\/g, "/").toLowerCase();
}
const invokedDirectly =
  process.argv[1] &&
  normalize(fileURLToPath(import.meta.url)) === normalize(process.argv[1]);

if (invokedDirectly) {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const { violations } = scanForServiceRoleLeak(repoRoot);
  if (violations.length > 0) {
    console.error(
      `❌ Service-role containment guard failed (${violations.length} violation(s)):\n` +
        violations.map((v) => `   - ${v}`).join("\n") +
        `\n   The service-role key is SERVER-ONLY (architecture §6). Never NEXT_PUBLIC_ it ` +
        `and never reference it from a "use client" path.`,
    );
    process.exit(1);
  }
  console.log(
    "✅ Service-role containment guard passed: no NEXT_PUBLIC_ service-role var and no " +
      "service-role reference in any client path.",
  );
}
