// Built-bundle service-role containment check (Story 2.4, Task 2.1 / R-002).
//
// The AUTHORITATIVE R-002 verification: the source-level guard
// (`check-service-role-containment.mjs`) is a fast PRE-BUILD smoke that keys on
// symbol names in `src`/`scripts`/`tests`; THIS check inspects the PRODUCED
// `next build` output (`.next/`) — the actual payload that ships to the browser
// and to route responses. It catches what the source scan misses by construction:
// the service-role JWT VALUE regardless of which symbol re-exported it, a
// transitively-bundled server module, and any `*SERVICE_ROLE*` token that survived
// minification. [architecture §9, §20; test-design-epic-2.md R-002]
//
// Today the app uses NO service-role key (anon key + RLS), so a clean `.next` build
// MUST yield ZERO violations. The check FAILS RED when a service-role reference is
// planted in any built artifact, and FAILS LOUD when `.next` is absent (never a
// vacuous green on an empty scan — an un-built tree is an operator error, not a
// pass).
//
// Dependency-free bare-Node `.mjs`, mirroring
// `scripts/verify/check-service-role-containment.mjs` and `check-lockfiles.mjs`. It
// is BOTH a CLI (wired into CI via `verify:bundle-containment`, AFTER `pnpm build`)
// and a test-importable function (`scanBuiltBundle`) so its bite is provable
// (tests/unit/scripts/verify/bundle-containment.test.ts).

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// The Next.js build output directory (the produced browser/server payloads).
const BUILD_DIR = ".next";

// ── Forbidden patterns ───────────────────────────────────────────────────────
//
// 1. ANY `*SERVICE_ROLE*` token. Covers the canonical `SUPABASE_SERVICE_ROLE_KEY`,
//    a `NEXT_PUBLIC_*SERVICE_ROLE*` name (browser-inlined), AND the Story 2.2
//    re-export symbol `LOCAL_SUPABASE_SERVICE_ROLE_KEY` the source guard misses by
//    symbol. The app's `src/` never references a service-role key (anon + RLS), so
//    no `SERVICE_ROLE` token should survive into the bundle.
const SERVICE_ROLE_TOKEN_RE = /[A-Z0-9_]*SERVICE_ROLE[A-Z0-9_]*/g;

// Known-BENIGN vendor `*SERVICE_ROLE*` substrings — a tight, EXPLICITLY DOCUMENTED
// allowlist. Rule 1 fires fail-closed on ANY `*SERVICE_ROLE*` token, so a future
// dependency bump that legitimately ships a `SERVICE_ROLE` enum/role-name constant
// in a vendored chunk would flip this authoritative R-002 gate red. When that
// happens, an operator must (1) CONFIRM the hit is a benign vendor string and NOT a
// real key leak, then (2) add the EXACT token here WITH a dated justification —
// rather than weakening the regex. This keeps the in-repo signal: the allowlist is a
// reviewed, greppable record of every accepted vendor `SERVICE_ROLE` string, so a
// real leak can never hide behind a blanket relaxation. EMPTY today — the real
// `.next` build ships no `SERVICE_ROLE` token (asserted by the standing
// `real-bundle-clean` test in bundle-containment.test.ts). [Review][Patch][Med] M1/M-3
const ALLOWLISTED_VENDOR_TOKENS = new Set([
  // e.g. "SUPABASE_SERVICE_ROLE" — add with: // <date> <reason> <pkg@version>
]);

// 2. The literal local-demo service-role JWT VALUE (issuer `supabase-demo`,
//    role `service_role`). This is the AUTHORITATIVE catch: it fires regardless of
//    which symbol re-exported the value, which is exactly the gap the symbol-keyed
//    source guard cannot close. NOT a real secret — but it must never ship in a
//    browser/route payload. (Matched as a substring; the JWT has no regex metachars.)
const LOCAL_DEMO_SERVICE_ROLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// 3. A generic service_role JWT shape — a BEST-EFFORT shape heuristic, not a
//    guarantee. It looks for the contiguous base64url substring
//    `InNlcnZpY2Vfcm9sZSI` (= `"service_role"`) inside a `eyJ...` JWT-shaped token.
//    Because base64url framing shifts with byte alignment, a real service-role JWT
//    whose payload serializes OTHER claims before `role` encodes `"service_role"` to a
//    DIFFERENT fragment and can slip past this rule. It catches the common ordering
//    (and the demo token), but it is NOT authoritative. The AUTHORITATIVE catches are
//    rule 1 (any `*SERVICE_ROLE*` token, incl. the env-var NAME Next never minifies)
//    and rule 2 (the literal demo-JWT VALUE). No behavioural change is required: this
//    app uses NO service-role key (anon + RLS), so there is no service-role surface.
const SERVICE_ROLE_JWT_RE =
  /eyJ[A-Za-z0-9_-]*InNlcnZpY2Vfcm9sZSI[A-Za-z0-9_-]*/g;

// The scanned artifact extensions inside `.next/`. The browser/route payloads are
// JS/JSON/HTML/CSS/source-maps/manifests; binaries (fonts/images) are skipped.
const SCANNED_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".html",
  ".css",
  ".map",
  ".txt",
  ".rsc", // React Server Components payload files
]);
// Extensionless build/log artifacts at known names are scanned too (manifests,
// trace, build logs). Anything else extensionless is skipped to avoid binaries.
const SCANNED_BASENAMES = new Set([
  "trace",
  "BUILD_ID",
  "build-manifest.json",
  "routes-manifest.json",
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
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

/**
 * Scan a PRODUCED build tree (a directory CONTAINING a `.next/` dir) for
 * service-role leakage into any browser/route/build artifact.
 *
 * @param {string} rootDir a project root that must contain a `.next/` build dir.
 * @returns {{ violations: string[] }} human-readable violation messages (empty = clean).
 * @throws if `rootDir/.next` does not exist — an un-built tree is a hard error,
 *         never a vacuous (passing) empty scan that would false-green R-002.
 */
export function scanBuiltBundle(rootDir) {
  const buildDir = join(rootDir, BUILD_DIR);
  if (!existsSync(buildDir) || !statSync(buildDir).isDirectory()) {
    throw new Error(
      `Built-bundle containment check requires a prior \`next build\`: no ` +
        `\`${BUILD_DIR}/\` directory found under "${rootDir}". Run \`pnpm build\` ` +
        `first — an absent build must NOT be reported as a clean scan (R-002).`,
    );
  }

  const violations = [];

  for (const file of walk(buildDir)) {
    if (!shouldScanFile(file)) continue;

    let contents;
    try {
      contents = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    const rel = relative(rootDir, file).replace(/\\/g, "/");

    // 1. Any `*SERVICE_ROLE*` token (key name / NEXT_PUBLIC_ name / re-export symbol),
    //    EXCEPT a documented known-benign vendor string in ALLOWLISTED_VENDOR_TOKENS.
    const tokenMatches = contents.match(SERVICE_ROLE_TOKEN_RE);
    if (tokenMatches) {
      for (const match of new Set(tokenMatches)) {
        if (ALLOWLISTED_VENDOR_TOKENS.has(match)) continue;
        violations.push(
          `${rel}: service-role token \`${match}\` present in a built artifact ` +
            `— the service-role key/name must never ship to the browser or a route payload. ` +
            `If this is a confirmed-benign vendor string, add it (dated, justified) to ` +
            `ALLOWLISTED_VENDOR_TOKENS in scripts/verify/check-bundle-containment.mjs.`,
        );
      }
    }

    // 2. The literal local-demo service-role JWT VALUE (symbol-independent).
    if (contents.includes(LOCAL_DEMO_SERVICE_ROLE_JWT)) {
      violations.push(
        `${rel}: the local-demo service-role JWT VALUE leaked into a built ` +
          `artifact — a service-role token must never appear in a browser/route payload.`,
      );
    }

    // 3. A generic service_role-minting JWT shape (non-demo service-role keys too).
    const jwtMatches = contents.match(SERVICE_ROLE_JWT_RE);
    if (jwtMatches) {
      violations.push(
        `${rel}: a JWT encoding \`"role":"service_role"\` leaked into a built ` +
          `artifact — service-role credentials must never ship to the browser/route payload.`,
      );
    }
  }

  return { violations };
}

// CLI behavior: when run directly (not imported by a test), scan the repo root's
// `.next` build and exit non-zero on any violation (or on an absent build).
// Compare normalized paths so Windows back/forward slashes and drive-letter casing
// don't break the main-module check.
function normalize(p) {
  return String(p).replace(/\\/g, "/").toLowerCase();
}
const invokedDirectly =
  process.argv[1] &&
  normalize(fileURLToPath(import.meta.url)) === normalize(process.argv[1]);

if (invokedDirectly) {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  let result;
  try {
    result = scanBuiltBundle(repoRoot);
  } catch (err) {
    console.error(`❌ Built-bundle containment check could not run:\n   ${err.message}`);
    process.exit(1);
  }
  const { violations } = result;
  if (violations.length > 0) {
    console.error(
      `❌ Built-bundle service-role containment FAILED (${violations.length} violation(s)):\n` +
        violations.map((v) => `   - ${v}`).join("\n") +
        `\n   The service-role key is SERVER-ONLY (architecture §9/§20). It must never ` +
        `appear in any \`${BUILD_DIR}\` browser/server/route payload. This app uses NO ` +
        `service-role key (anon + RLS) — a hit here means a leak was introduced.`,
    );
    process.exit(1);
  }
  console.log(
    `✅ Built-bundle containment passed: no service-role key name, JWT value, or ` +
      `NEXT_PUBLIC_ service-role var in any \`${BUILD_DIR}\` artifact.`,
  );
}
