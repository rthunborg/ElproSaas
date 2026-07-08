/**
 * Phase-A-acceptance-gate-report story — executable docs-invariant validators for the FINAL Phase A
 * acceptance-gate CONSOLIDATION report under `docs/migration/**`.
 *
 * This story is docs + a `tests/unit/**` validator (NO product `src/**` code / schema / migration /
 * command / UI / nav item), so its "tests" per the epic-9 test design (`test-design-epic-9.md`) are
 * report-honesty + scope-scan + readiness-reconciliation + fixture-privacy validators, weighted as a
 * decision/evidence artifact:
 *
 *   - 9.5-GATE-01 (P0, epic blocker, R-909): the gate summary distinguishes pass / fail /
 *     skipped-with-reason and reconciles 1:1 with the REAL CI gate list; a mandatory gate reported
 *     `pass` that did not run, `skipped` with NO reason, or ABSENT is a false-green FAIL. Modeled as a
 *     PURE function `f(reportedGates, realGateList) => {missing, skippedWithoutReason}` driven with a
 *     clean report (positive) AND a seeded skipped-without-reason / missing-gate report (negative) — so
 *     the honesty guard is PROVEN to FIRE, not structurally-unreachable machinery (the epic-5 dead-guard
 *     anti-pattern).
 *   - 9.5-SCOPE-01 (P0, epic blocker, R-910): the scope-confirmation scan is driven by the REAL
 *     `FORBIDDEN_DEFERRED_CATEGORIES` deny-list (imported LIVE from `src/features/files/deferred-
 *     categories.ts`, never a hardcoded copy) and confirms the implemented surface (7 nav items, 24
 *     tenant-owned tables) carries none of it. Modeled as a PURE function `f(surface, denyList) =>
 *     violations` driven with a CLEAN surface (positive path passes) AND a SEEDED `fortnox`/`supplier`/…
 *     token surface (negative path FIRES) — so the scan is proven to trip on a real deferred token. The
 *     deny-list module itself is NEVER scanned as a violation (it holds the forbidden tokens by design —
 *     mirrors the 8.5 `file-index-non-scope.test.ts` exclusion).
 *   - 9.5-EVID-01 (P1, R-909/R-916): the report enumerates EVERY gate + the skipped-gates-with-reasons
 *     discipline, reproducible from the deterministic gate rows.
 *   - 9.5-READY-01 (P2, R-920): every open stop condition carries a NAMED decision owner, reconciled
 *     1:1 with the 9.4 sign-off register's `blocking` rows (read LIVE from `pilot-fallback-cutover.md`
 *     §4) — a register-blocking ID absent from the readiness section is a drift FAIL (R-917 extended).
 *   - PII scan (R-901/R-902/R-914): `docs/migration/**` stays clean of real personnummer / orgnr /
 *     email / phone / secret — REUSING the 9.1/9.4 scan regexes + masked-placeholder stripping.
 *
 * ── Runner-glob discipline (project Testing Rule, R-904) ──────────────────────────────────────────
 * This lives under `tests/unit/**` and uses `node:test`/`node:assert` so `pnpm test:unit`
 * (glob `tests/unit/ ** / *.test.ts`) actually executes it. A file outside that glob would be
 * vacuous-green (never run) — the runner-glob trap. NOT `tests/golden/**` (never executed).
 * Surface-present precondition checks are HARD assertions, NEVER a self-disabling `describe.skip`
 * (the epic-4-ledgered self-disabling-golden anti-pattern).
 *
 * ── Source-of-truth cross-checks (no fabricated / memorised facts) ────────────────────────────────
 * The CI gate list is read LIVE from `.github/workflows/ci.yml` + `package.json` (the `verify:*` +
 * `test:*` scripts); the deny-list is imported LIVE from `deferred-categories.ts`; the nav count from
 * `nav-items.ts`; the 24-table set from `tenant-table-inventory.ts`; the 9.4 register blocking IDs
 * from `pilot-fallback-cutover.md` §4; any readiness code from the REAL `READINESS_CODES` union
 * (`src/features/calculations/readiness.ts`). This mirrors the 9.1/9.4 validators' live-source
 * discipline — never a hardcoded copy that drifts.
 *
 * [Source: test-design-epic-9.md#9.5-GATE-01/SCOPE-01/EVID-01/READY-01, R-901/R-902/R-904/R-909/R-910/
 *  R-914/R-916/R-917/R-920; .github/workflows/ci.yml; package.json; architecture §19/§16/§24;
 *  src/features/files/deferred-categories.ts (FORBIDDEN_DEFERRED_CATEGORIES);
 *  src/components/app-shell/nav-items.ts (7 nav); tests/integration/rls/tenant-table-inventory.ts
 *  (24 TENANT_TABLES); docs/migration/pilot-fallback-cutover.md §4 (sign-off register);
 *  src/features/calculations/readiness.ts (READINESS_CODES);
 *  tests/unit/docs/migration-runbook-validators.test.ts + sign-off-register-validators.test.ts (the
 *  EXACT pattern + PII-scan regexes to reuse);
 *  tests/unit/guardrails/file-index-non-scope.test.ts (the seeded-token scan + deny-list exclusion)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REPO = process.cwd();
const MIGRATION_DOCS_DIR = path.join(REPO, "docs", "migration");
const REPORT_DOC = path.join(MIGRATION_DOCS_DIR, "phase-a-acceptance-gate.md");
const REGISTER_DOC = path.join(MIGRATION_DOCS_DIR, "pilot-fallback-cutover.md");
const CI_YML = path.join(REPO, ".github", "workflows", "ci.yml");
const PACKAGE_JSON = path.join(REPO, "package.json");

/** Read a required doc, failing LOUD (not skipping) when it is missing — the hard precondition. */
function readRequiredDoc(file: string): string {
  assert.equal(
    existsSync(file),
    true,
    `required doc is missing: ${path.relative(REPO, file)} — the acceptance-gate report / register must exist`,
  );
  return readFileSync(file, "utf8");
}

/** The acceptance-gate report text (hard-required for AC1/AC2/AC3 surface). */
function reportText(): string {
  return readRequiredDoc(REPORT_DOC);
}

/** Every committed *.md under docs/migration/** (for the whole-directory PII scan). */
function migrationDocFiles(): string[] {
  if (!existsSync(MIGRATION_DOCS_DIR)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".md")) out.push(full);
    }
  };
  walk(MIGRATION_DOCS_DIR);
  return out;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LIVE source-of-truth loaders — the CI gate list, the deny-list, the nav, the 24 tables, the
// register blocking IDs, the readiness union. Never a hardcoded copy that drifts.
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * The MANDATORY Phase A gate identifiers, derived LIVE from the real sources — the `verify:*` +
 * `test:*` scripts declared in `package.json` AND the job steps in `ci.yml`. We key on the STABLE
 * script/step tokens (`test:unit`, `test:int`, `test:e2e`, `verify:lockfiles`, `pnpm audit`,
 * `verify:service-role-containment`, `verify:bundle-containment`, `typecheck`, `lint`, `build`,
 * `db reset`, `install --frozen-lockfile`) so a renamed script surfaces here instead of the doc
 * quietly drifting. Returns the set of gate KEYS the gate summary must reconcile 1:1 against.
 */
function realMandatoryGateKeys(): string[] {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as {
    scripts: Record<string, string>;
  };
  const ci = readFileSync(CI_YML, "utf8");
  const keys = new Set<string>();

  // (a) The `verify:*` + `test:*` scripts that CI runs (read from package.json, cross-checked in ci.yml).
  for (const script of Object.keys(pkg.scripts)) {
    if (/^(verify:|test:(unit|int|e2e))/.test(script)) {
      // Only count a script the CI actually invokes (guard against an orphan script).
      if (ci.includes(script)) keys.add(script);
    }
  }

  // (b) The non-script CI steps that are still mandatory gates (install / audit / typecheck / lint /
  // build / migration reset). Keyed on the stable command token present in ci.yml.
  const stepTokens: Array<{ key: string; token: RegExp }> = [
    { key: "install", token: /pnpm install --frozen-lockfile/ },
    { key: "audit", token: /pnpm audit --audit-level=high/ },
    { key: "typecheck", token: /pnpm typecheck/ },
    { key: "lint", token: /\n\s*run:\s*pnpm lint/ },
    { key: "build", token: /\n\s*run:\s*pnpm build/ },
    { key: "db-reset", token: /supabase db reset/ },
  ];
  for (const { key, token } of stepTokens) {
    if (token.test(ci)) keys.add(key);
  }
  return [...keys];
}

/** Load the REAL exported `FORBIDDEN_DEFERRED_CATEGORIES` deny-list LIVE (never a hardcoded copy). */
async function loadDenyList(): Promise<readonly string[]> {
  const mod = (await import(
    pathToFileURL(
      path.join(REPO, "src", "features", "files", "deferred-categories.ts"),
    ).href
  )) as { FORBIDDEN_DEFERRED_CATEGORIES: readonly string[] };
  return mod.FORBIDDEN_DEFERRED_CATEGORIES;
}

/** Load the LIVE seven-item nav from the single source of truth (never memory). */
async function loadNavItems(): Promise<readonly { href: string; label: string }[]> {
  const mod = (await import(
    pathToFileURL(
      path.join(REPO, "src", "components", "app-shell", "nav-items.ts"),
    ).href
  )) as { navItems: readonly { href: string; label: string }[] };
  return mod.navItems;
}

/** Load the LIVE 24-table Phase A boundary from the single source of truth (never memory). */
async function loadTenantTables(): Promise<readonly string[]> {
  const mod = (await import(
    pathToFileURL(
      path.join(REPO, "tests", "integration", "rls", "tenant-table-inventory.ts"),
    ).href
  )) as { TENANT_TABLES: readonly string[] };
  return mod.TENANT_TABLES;
}

/** Load the REAL exported `READINESS_CODES` runtime union LIVE (never a hardcoded subset). */
async function loadReadinessCodes(): Promise<readonly string[]> {
  const mod = (await import(
    pathToFileURL(
      path.join(REPO, "src", "features", "calculations", "readiness.ts"),
    ).href
  )) as { READINESS_CODES: readonly string[] };
  return mod.READINESS_CODES;
}

/**
 * Parse the BLOCKING sign-off IDs LIVE from the 9.4 register (`pilot-fallback-cutover.md` §4). A §4
 * row is blocking when its status cell contains `blocking`. We extract every owning-question ID cell
 * token (including ranged IDs like `B.1-B.4` / `C.1-C.3`) from the blocking rows, so the readiness
 * reconciliation cross-references the REAL blocking set, never a hardcoded copy that drifts (R-917).
 */
function registerBlockingIds(): string[] {
  const reg = readRequiredDoc(REGISTER_DOC);
  // Isolate §4 (the sign-off register) — from its heading to §5.
  const start = reg.search(/##\s*4\.\s*Sign-Off Register/i);
  assert.ok(start >= 0, "the 9.4 register must contain a '## 4. Sign-Off Register' section");
  const rest = reg.slice(start);
  const end = rest.search(/\n##\s*5\./);
  const section = end > 0 ? rest.slice(0, end) : rest;

  const ids = new Set<string>();
  // ID pattern (alternation, most-specific families FIRST so the whole token is captured):
  //   (a) letter-dot-digit, optionally a `-<same>` range     — `A.1`, `A.2`, `B.1-B.4`, `C.1-C.3`
  //   (b) letter-then-digits + a `-<facet>` register-local sub-ID — `A22-tax` (MUST precede bare
  //       `[A-Z]\d+` so `A22-tax` is captured WHOLE, not split into a stray bare `A22`)
  //   (c) letter-then-digits (no dot)                          — `A20`, `A21`, `A22`
  //   (d) digit-dot-digit, optionally a range                  — `7.1`, `7.3`, `8.1`, `8.2`
  // The letter-then-dot families were previously DROPPED because a leading `[A-Z]?\d+` requires a
  // digit immediately after the optional letter — `A.1` never matched (R-917 no-drift hole).
  // The `A22-tax` sub-ID isolates the parked tax-wording facet from the answered quote-terms `A22`
  // (opposite gate statuses); capturing it whole keeps the two facets distinct in the blocking set.
  const idRe =
    /\b([A-Z]\.\d+(?:-[A-Z]\.\d+)?|[A-Z]\d+-[a-z]+|[A-Z]\d+|\d+\.\d+(?:-\d+\.\d+)?)\b/g;
  for (const line of section.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    if (/^\s*\|\s*Blocking item\s*\|/i.test(line) || /^\s*\|\s*Decision item\s*\|/i.test(line)) continue;
    // Both §4.1 and §4.2 tables share the column shape `| item | Status | Owning ID(s) | Owner |
    // Affected | Notes |`, so after splitting on `|`: cell[2]=Status, cell[3]=Owning ID(s). Scope the
    // ID extraction to the OWNING-ID cell only — never the whole line — so an ID mentioned in prose
    // (e.g. a Notes-cell reference to the answered `A22` explaining the `A22-tax` split) cannot leak
    // into the blocking set. A blocking row is one whose STATUS cell carries `blocking`.
    const cells = line.split("|").map((c) => c.trim());
    const statusCell = cells[2] ?? "";
    if (!/blocking/i.test(statusCell)) continue;
    const idCell = cells[3] ?? "";
    // Pull IDs from the owning-question-ID cell only. Restrict to ID-shaped tokens.
    for (const m of idCell.matchAll(idRe)) {
      const id = m[1];
      // Owner-signoff IDs look like `A.1`/`A.2`/`B.1-B.4`/`C.1-C.3`, `A20`, `A22-tax`, `7.1`, `8.2`.
      // Exclude bare section refs like `4.1`/`4.2`/`5` and pure prose numbers by requiring the
      // letter-prefixed (dotted, bare, or `-facet` sub-ID) or 7/8-prefixed families that the register
      // actually uses as blocking owning IDs.
      if (/^[A-C]\.\d/.test(id) || /^[A-C]\d+(?:-[a-z]+)?$/.test(id) || /^[78]\.\d$/.test(id)) {
        ids.add(id);
      }
    }
  }
  return [...ids];
}

/**
 * PURE readiness-reconciliation model (9.5-READY-01, R-920/R-917). A blocking owning ID from the 9.4
 * register drifts iff it is NOT present in the report's readiness section text. Returns the missing set
 * (empty === reconciled 1:1). Extracted so the validator drives it with the REAL readiness slice
 * (positive) AND with a seeded slice that OMITS a dotted money/tax ID (negative — proves the guard fires).
 */
function reconcileReadinessBlocking(blockingIds: readonly string[], readinessSection: string): string[] {
  return blockingIds.filter((id) => !readinessSection.includes(id));
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// The GATE-HONESTY pure model (9.5-GATE-01, R-909) — f(reportedGates, realGateList) =>
// {missing, skippedWithoutReason}. Driven with a clean report (positive) AND seeded negatives.
// ══════════════════════════════════════════════════════════════════════════════════════════════

type GateStatus = "pass" | "fail" | "skipped-with-reason" | "skipped";
interface ReportedGate {
  readonly key: string; // the gate KEY it maps to (matched against realMandatoryGateKeys)
  readonly status: GateStatus;
  readonly hasReason: boolean; // for a skipped gate, whether a substantive reason is present
}
interface GateHonestyResult {
  readonly missing: string[]; // mandatory gate keys with NO reported row
  readonly skippedWithoutReason: string[]; // reported gates skipped with no reason
  readonly invalidStatus: string[]; // reported gates whose status is not pass/fail/skipped-with-reason
}

/**
 * PURE gate-honesty gate. A report is honest iff (a) every mandatory gate key is reported; (b) every
 * reported gate status is one of pass/fail/skipped-with-reason; (c) no reported gate is `skipped`
 * without a reason. This is the R-909 false-green teeth as an executable function — the validator
 * drives it with the REAL report (positive) and with seeded false-green reports (negative).
 */
function evaluateGateHonesty(
  reportedGates: readonly ReportedGate[],
  realGateKeys: readonly string[],
): GateHonestyResult {
  const reportedKeys = new Set(reportedGates.map((g) => g.key));
  const missing = realGateKeys.filter((k) => !reportedKeys.has(k)).sort();
  const skippedWithoutReason = reportedGates
    .filter((g) => (g.status === "skipped" || g.status === "skipped-with-reason") && !g.hasReason)
    .map((g) => g.key)
    .sort();
  const invalidStatus = reportedGates
    .filter((g) => g.status !== "pass" && g.status !== "fail" && g.status !== "skipped-with-reason")
    .map((g) => g.key)
    .sort();
  return { missing, skippedWithoutReason, invalidStatus };
}

/**
 * Parse the report's §2 gate-summary + §3 skipped-gates section into {key,status,hasReason} rows.
 * The §2 tables have a `| Gate | Status | CI job / step | Notes |` shape; a status cell holds one of
 * `pass` / `fail` / `skipped-with-reason` (backtick-quoted). The §3 skipped list is prose. We map each
 * parsed gate's descriptive name to a stable KEY (test:unit, verify:lockfiles, …) so the honesty model
 * can reconcile against `realMandatoryGateKeys()`.
 */
function parseReportedGates(report: string): ReportedGate[] {
  const rows: ReportedGate[] = [];
  // Each gate maps a descriptive-name regex → its stable KEY, and how a "reason" is detected.
  const gateMap: Array<{ key: string; name: RegExp }> = [
    { key: "install", name: /Clean install|frozen-lockfile/i },
    { key: "verify:lockfiles", name: /verify:lockfiles/i },
    { key: "audit", name: /pnpm audit --audit-level=high/i },
    { key: "verify:service-role-containment", name: /verify:service-role-containment/i },
    { key: "typecheck", name: /Typecheck/i },
    { key: "lint", name: /^\s*\|\s*Lint\b/im },
    { key: "test:unit", name: /Unit tests \(`pnpm test:unit`\)/i },
    { key: "build", name: /^\s*\|\s*Build\b/im },
    { key: "verify:bundle-containment", name: /verify:bundle-containment/i },
    { key: "db-reset", name: /Migration reset from empty DB/i },
    { key: "test:int", name: /Integration \+ RLS \/ storage negative tests/i },
    { key: "test:e2e", name: /Browser E2E \(`pnpm test:e2e`\)/i },
  ];
  // Grab every markdown table data row in §2.
  const g2Start = report.search(/##\s*2\.\s*Gate Summary/i);
  const g2End = report.search(/##\s*3\./i);
  const gateSection = report.slice(g2Start, g2End > g2Start ? g2End : undefined);
  const tableRows = gateSection.split("\n").filter((l) => l.trim().startsWith("|"));

  for (const { key, name } of gateMap) {
    const row = tableRows.find((r) => name.test(r));
    if (!row) continue; // absent → the honesty model's `missing` set catches it
    const statusCell = row.split("|")[2] ?? "";
    const status: GateStatus = /skipped-with-reason/i.test(statusCell)
      ? "skipped-with-reason"
      : /`?skipped`?/i.test(statusCell)
        ? "skipped"
        : /`?fail`?/i.test(statusCell)
          ? "fail"
          : "pass";
    // A reason is present when the Notes cell (cell[4]) carries substantive prose (> 20 chars).
    const notesCell = row.split("|")[4] ?? "";
    const hasReason = status === "pass" || status === "fail"
      ? true
      : notesCell.replace(/[\s`*]/g, "").length > 20;
    rows.push({ key, status, hasReason });
  }
  return rows;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// The SCOPE-SCAN pure model (9.5-SCOPE-01, R-910) — f(surface, denyList) => violations. Driven with
// a CLEAN surface (positive path passes) AND a SEEDED-token surface (negative path FIRES).
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * PURE scope scan. A "surface" is the set of implemented-surface tokens (nav labels/hrefs, table
 * names, route segments). A violation is a surface token whose lowercased form contains a deny-list
 * category as a WHOLE-WORD token (word-boundary, so `assets`/`hr` do not false-positive on unrelated
 * substrings like `chars` or `share`). Returns the list of {token, category} violations. The deny-list
 * MODULE itself is never part of the surface (it holds the forbidden tokens by design).
 */
function scanSurfaceForDeferred(
  surface: readonly string[],
  denyList: readonly string[],
): Array<{ token: string; category: string }> {
  const violations: Array<{ token: string; category: string }> = [];
  for (const token of surface) {
    const lc = token.toLowerCase();
    for (const category of denyList) {
      // Whole-word match on the category (word boundary either side) so unrelated substrings do not trip.
      const re = new RegExp(`(^|[^a-z])${category}([^a-z]|$)`, "i");
      if (re.test(lc)) violations.push({ token, category });
    }
  }
  return violations;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// The PII-scan pure model (R-901/R-902/R-914) — f(text) => violations. Extracted from the inline
// whole-directory scan so it can be driven BOTH over the real docs (positive: clean) AND over a
// seeded-PII string (negative: FIRES) — proving the scan is not vacuous-green machinery (R-904). The
// regexes + masked-placeholder stripping are the 9.1/9.4 scan verbatim (never a looser fork).
// ══════════════════════════════════════════════════════════════════════════════════════════════

interface PiiViolation {
  readonly kind: "personnummer" | "orgnr" | "email" | "phone" | "secret";
  readonly matches: string[];
}

/**
 * PURE PII scan. Strips the sanctioned obviously-fake masked placeholders first, then matches each
 * PII family. Returns one {kind, matches} entry per family that fired (empty array = clean). Mirrors
 * the 9.1/9.4 whole-directory scan exactly so the report/docs cannot carry a real personnummer /
 * orgnr / email / SE phone / secret.
 */
function scanTextForPii(text: string): PiiViolation[] {
  const scanned = text.replace(/YYYYMMDD-XXXX/g, "").replace(/XXXXXX-XXXX/g, "");
  const violations: PiiViolation[] = [];

  const pnr = scanned.match(/\b\d{6,8}[-\s]?\d{4}\b/g);
  if (pnr) violations.push({ kind: "personnummer", matches: pnr });

  const orgnr = scanned.match(/\b\d{10}\b/g);
  if (orgnr) violations.push({ kind: "orgnr", matches: orgnr });

  const emails = (scanned.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []).filter(
    (e) => !/@(example\.(test|com|org)|test\.test|localhost)$/i.test(e),
  );
  if (emails.length > 0) violations.push({ kind: "email", matches: emails });

  const phones = scanned.match(/\+46[\s-]?\d[\d\s-]{6,}|\b0\d{1,3}[-\s]\d{5,}\b/g);
  if (phones) violations.push({ kind: "phone", matches: phones });

  const secrets = scanned.match(
    /(api[_-]?key|password|secret|token|bearer)\s*[:=]\s*["']?[A-Za-z0-9/_+.\-]{12,}|-----BEGIN [A-Z ]+-----/gi,
  );
  if (secrets) violations.push({ kind: "secret", matches: secrets });

  return violations;
}

// ══ 9.5-GATE-01 (P0, epic blocker, R-909) — the gate-honesty teeth ════════════════════════════

test("9.5-GATE-01: the report's gate summary reports EVERY mandatory Phase A gate (reconciled 1:1 with the real CI gate list)", () => {
  const report = reportText();
  const reported = parseReportedGates(report);
  const realKeys = realMandatoryGateKeys();
  // Sanity: the live parse of ci.yml/package.json must have found the core gate keys.
  for (const mustHave of ["test:unit", "test:int", "test:e2e", "typecheck", "lint", "build", "db-reset", "audit", "install"]) {
    assert.ok(
      realKeys.includes(mustHave),
      `the live CI-gate parse must include the mandatory gate "${mustHave}" — parsed: ${realKeys.join(", ")}`,
    );
  }
  const result = evaluateGateHonesty(reported, realKeys);
  assert.deepEqual(
    result.missing,
    [],
    `the report is MISSING mandatory Phase A gate rows (false-green by omission, R-909): ${result.missing.join(", ")} — every gate in the real CI list must appear in §2 with a status`,
  );
  assert.deepEqual(
    result.invalidStatus,
    [],
    `these gate rows have a status that is NOT pass/fail/skipped-with-reason (R-909): ${result.invalidStatus.join(", ")}`,
  );
});

test("9.5-GATE-01: every reported gate status is one of pass / fail / skipped-with-reason (no bare `skipped`, no over-claim)", () => {
  const reported = parseReportedGates(reportText());
  const result = evaluateGateHonesty(reported, realMandatoryGateKeys());
  assert.deepEqual(
    result.skippedWithoutReason,
    [],
    `these gates are SKIPPED with NO reason (R-909 false-green): ${result.skippedWithoutReason.join(", ")} — a skipped mandatory gate must carry its reason`,
  );
});

test("9.5-GATE-01 (the honesty guard FIRES): a seeded MISSING-gate report FAILS the honesty model (negative path)", () => {
  const realKeys = realMandatoryGateKeys();
  // Seed a report that OMITS the mandatory `test:int` gate — the model must flag it missing.
  const seeded: ReportedGate[] = realKeys
    .filter((k) => k !== "test:int")
    .map((key) => ({ key, status: "pass" as const, hasReason: true }));
  const result = evaluateGateHonesty(seeded, realKeys);
  assert.ok(
    result.missing.includes("test:int"),
    "the honesty model MUST flag a mandatory gate absent from the report (missing-gate false-green) — the guard is not structurally-unreachable",
  );
});

test("9.5-GATE-01 (the honesty guard FIRES): a seeded SKIPPED-WITHOUT-REASON gate FAILS the honesty model (negative path)", () => {
  const realKeys = realMandatoryGateKeys();
  // Seed a full report where `test:e2e` is marked skipped with NO reason — the model must flag it.
  const seeded: ReportedGate[] = realKeys.map((key) =>
    key === "test:e2e"
      ? { key, status: "skipped" as const, hasReason: false }
      : { key, status: "pass" as const, hasReason: true },
  );
  const result = evaluateGateHonesty(seeded, realKeys);
  assert.ok(
    result.skippedWithoutReason.includes("test:e2e"),
    "the honesty model MUST flag a gate skipped without a reason (skipped-as-pass false-green) — the R-909 teeth fire on the negative path",
  );
});

test("9.5-GATE-01: the report distinguishes pass / fail / skipped-with-reason as explicit status vocabulary", () => {
  const report = reportText();
  for (const token of ["`pass`", "`fail`", "`skipped-with-reason`"]) {
    assert.ok(
      report.includes(token),
      `the report must use the explicit status token ${token} in its gate-honesty vocabulary (AC1) — it was not found`,
    );
  }
});

// ══ 9.5-SCOPE-01 (P0, epic blocker, R-910) — the scope-scan teeth ═════════════════════════════

test("9.5-SCOPE-01: the report's scope confirmation names EVERY deny-list category (driven by the REAL live deny-list)", async () => {
  const report = reportText().toLowerCase();
  const denyList = await loadDenyList();
  assert.ok(denyList.length >= 5, `expected the real deny-list to carry >=5 categories — found ${denyList.length}`);
  for (const category of denyList) {
    assert.ok(
      report.includes(category.toLowerCase()),
      `the scope-confirmation section must name the deferred-module category "${category}" from the LIVE deny-list — it was not found (R-910)`,
    );
  }
  // The prose deny-list names must also be present (the human-readable superset).
  for (const name of ["fortnox", "supplier", "customer portal", "public privileged", "document center"]) {
    assert.ok(report.includes(name), `the scope confirmation must name the deferred surface "${name}"`);
  }
});

test("9.5-SCOPE-01: the implemented surface is CLEAN — the scope scan finds NO deferred-module violation (positive path)", async () => {
  const denyList = await loadDenyList();
  const nav = await loadNavItems();
  const tables = await loadTenantTables();
  // Model the REAL implemented surface: nav labels + hrefs + tenant-owned table names + route segments.
  const surface = [
    ...nav.map((n) => n.label),
    ...nav.map((n) => n.href),
    ...tables,
  ];
  const violations = scanSurfaceForDeferred(surface, denyList);
  assert.deepEqual(
    violations,
    [],
    `a deferred-module token leaked into the IMPLEMENTED surface (a REAL scope leak — this is a STOP, not just a seeded token): ${JSON.stringify(violations)}`,
  );
});

test("9.5-SCOPE-01 (the scan FIRES): a SEEDED deferred-module token trips the scope scan (negative path)", async () => {
  const denyList = await loadDenyList();
  const nav = await loadNavItems();
  // Seed a deferred-module token onto an otherwise-clean surface — the scan MUST fire.
  const seededSurface = [
    ...nav.map((n) => n.label),
    "/fortnox", // a forged Fortnox route segment
    "supplier_invoices", // a forged supplier table
  ];
  const violations = scanSurfaceForDeferred(seededSurface, denyList);
  assert.ok(
    violations.some((v) => v.category === "fortnox"),
    "the scope scan MUST trip on a seeded `fortnox` token — a scan that only asserts today's surface is clean without proving it CAN fire is the vacuous-green trap (R-910)",
  );
  assert.ok(
    violations.some((v) => v.category === "supplier"),
    "the scope scan MUST trip on a seeded `supplier` token too (the seeded-token proof is mandatory)",
  );
});

test("9.5-SCOPE-01: the deny-list MODULE itself is NOT treated as a scope violation (it holds the tokens by design)", async () => {
  const denyList = await loadDenyList();
  // The deny-list module's own contents (the forbidden tokens) must NOT be part of the scanned surface.
  // We prove the exclusion structurally: scanning the deny-list's own tokens as if they were surface
  // WOULD trip — which is exactly why the surface never includes them. This documents the 8.5-style
  // exclusion (mirror of file-index-non-scope's deny-list exclusion).
  const asIfSurface = [...denyList];
  const violations = scanSurfaceForDeferred(asIfSurface, denyList);
  assert.ok(
    violations.length > 0,
    "sanity: the deny-list tokens WOULD trip the scan if scanned as surface — which is why the deny-list module is excluded from the implemented-surface scan (the 8.5 guardrail exclusion)",
  );
});

test("9.5-SCOPE-01: the surface anchors are the LIVE counts — exactly 7 nav items and 24 tenant-owned tables", async () => {
  const nav = await loadNavItems();
  const tables = await loadTenantTables();
  assert.equal(nav.length, 7, `the nav must be EXACTLY seven items (the frozen Phase A shell) — found ${nav.length}`);
  assert.equal(tables.length, 24, `the tenant-owned set must be EXACTLY 24 tables — found ${tables.length}`);
  const report = reportText();
  // The report must cite the live counts (7 nav / 24 tables) — the scope confirmation anchors.
  assert.ok(/seven nav|7 nav|exactly seven/i.test(report), "the report must cite the seven-item nav anchor");
  assert.ok(/twenty-four|24 tenant-owned|exactly twenty-four/i.test(report), "the report must cite the 24-table anchor");
});

// ══ 9.5-READY-01 (P2, R-920) — readiness reconciliation, no drift from the 9.4 register ═══════

// Isolate the report's readiness section (§6) so a blocking ID mentioned elsewhere does not falsely satisfy.
function readinessSection(report: string): string {
  const start = report.search(/##\s*6\.\s*Readiness/i);
  assert.ok(start >= 0, "the report must contain a '## 6. Readiness' section");
  const rest = report.slice(start);
  const end = rest.search(/\n##\s*7\./);
  return end > 0 ? rest.slice(0, end) : rest;
}

test("9.5-READY-01: every 9.4-register BLOCKING id appears in the report's readiness section (no drift, R-917 extended)", () => {
  const report = reportText();
  const blocking = registerBlockingIds();
  assert.ok(
    blocking.length >= 6,
    `expected the live 9.4 register §4 to carry the known open blocking IDs (>=6; A.1/A.2/B.1-B.4/C.1-C.3/7.1/7.3/8.1/8.2) — parsed ${blocking.length}: ${blocking.join(", ")}`,
  );
  // The dotted money/tax families MUST be in the reconciled set — this is the R-917 hole the extraction
  // fix closes: a blocking ID the parser can't see could never be enforced 1:1 against §6.
  for (const dotted of ["A.1", "A.2", "B.1-B.4", "C.1-C.3"]) {
    assert.ok(
      blocking.includes(dotted),
      `the reconciliation must cover the dotted money/tax blocking ID "${dotted}" — parsed: ${blocking.join(", ")}`,
    );
  }
  const readiness = readinessSection(report);
  const missing = reconcileReadinessBlocking(blocking, readiness);
  assert.deepEqual(
    missing,
    [],
    `readiness drift (R-920/R-917): these BLOCKING IDs from the 9.4 register §4 are absent from the report's readiness section: ${missing.join(", ")} — the readiness list REFERENCES the register, it must not fork a divergent copy`,
  );
});

test("9.5-READY-01: PROVE the no-drift guard FIRES — a dotted money/tax blocking ID missing from §6 fails reconciliation (negative path)", () => {
  const report = reportText();
  const blocking = registerBlockingIds();
  const readiness = readinessSection(report);

  // Positive control: the REAL §6 reconciles clean (no missing blocking IDs).
  assert.deepEqual(
    reconcileReadinessBlocking(blocking, readiness),
    [],
    "sanity: the real readiness section must reconcile 1:1 before the negative case is meaningful",
  );

  // Seed a §6 that DROPS a dotted money/tax blocker (`B.1-B.4`) — every occurrence removed so a stray
  // mention elsewhere in §6 cannot mask the drift. The guard MUST now report it missing.
  const dropped = "B.1-B.4";
  assert.ok(blocking.includes(dropped), `the negative case requires the dotted blocking ID "${dropped}" to be in the parsed set`);
  const seededReadiness = readiness.split(dropped).join("〈removed〉");
  const missing = reconcileReadinessBlocking(blocking, seededReadiness);
  assert.ok(
    missing.includes(dropped),
    `the no-drift reconciliation FAILED to fire on a seeded §6 that omits the dotted blocking ID "${dropped}" — the R-917 guard is not enforcing the dotted money/tax families (missing set: ${missing.join(", ")})`,
  );
});

test("9.5-READY-01: every readiness stop-condition row carries a NAMED decision owner (owner/accounting/legal/security)", () => {
  const report = reportText();
  const start = report.search(/##\s*6\.\s*Readiness/i);
  const rest = report.slice(start);
  const end = rest.search(/\n##\s*7\./);
  const readiness = end > 0 ? rest.slice(0, end) : rest;

  // Every data row in the §6 tables must name a decision owner from the sanctioned owner vocabulary.
  const ownerRe = /\b(Owner|Accounting|Legal|Security)\b/i;
  const dataRows = readiness
    .split("\n")
    .filter((l) => l.trim().startsWith("|") && /blocking|re-score/i.test(l))
    .filter((l) => !/Stop condition|Re-score \/ stop item|Blocks real-pilot/i.test(l)); // drop headers
  assert.ok(dataRows.length >= 9, `expected >=9 readiness stop-condition rows — found ${dataRows.length}`);
  for (const row of dataRows) {
    assert.ok(
      ownerRe.test(row),
      `a readiness stop-condition row is MISSING a named decision owner (owner/accounting/legal/security) — every stop condition must attribute a decision owner (AC3, 9.5-READY-01): ${row.trim()}`,
    );
  }
});

test("9.5-READY-01: the report records the demo track as explicitly NON-BLOCKING (two tracks never conflated)", () => {
  const lc = reportText().toLowerCase();
  assert.ok(/demo track/.test(lc) && /real-pilot/.test(lc), "the report must record BOTH tracks explicitly");
  assert.ok(
    /non-blocking/.test(lc),
    "the report must state the demo track is non-blocking (demo-data-only owner decision 2026-07-03) — do NOT conflate the two tracks",
  );
});

test("9.5-EVID-01: the §2 golden-master evidence row NAMES the real Story 9.3 old/new Lovable-comparison suites (the epic's headline AC1 artifact)", () => {
  const report = reportText();
  // Isolate §2 so a mention elsewhere in prose (line 213) does not satisfy the gate-evidence row.
  const g2Start = report.search(/##\s*2\.\s*Gate Summary/i);
  const g2End = report.search(/##\s*3\./i);
  const gateSection = report.slice(g2Start, g2End > g2Start ? g2End : undefined);

  // The four (of five) load-bearing 9.3 comparison suites the golden-master evidence row must cite —
  // these are the artifact that answers AC1's "old/new comparisons ... evidence instead of memory."
  // Each named suite must ALSO exist in the repo (no citing a suite that isn't there).
  const suites = [
    "lovable-comparison-guards.test.ts",
    "lovable-comparison-calc-quote-pdf.test.ts",
    "lovable-comparison-acceptance-job.test.ts",
    "lovable-comparison-delta-classification.test.ts",
  ];
  for (const suite of suites) {
    assert.ok(
      gateSection.includes(suite),
      `the §2 golden-master evidence row must name the Story 9.3 comparison suite "${suite}" — the old/new comparison artifact must be cited AS gate evidence, not only pre-Epic-9 new-side packs (AC1)`,
    );
    assert.ok(
      existsSync(path.join(REPO, "tests", "unit", "fixtures", "golden", "lovable", suite)),
      `precondition: the cited 9.3 comparison suite "${suite}" must exist under tests/unit/fixtures/golden/lovable/** (no citing a non-existent suite)`,
    );
  }
});

test("9.5-READY-01: the §6 'reconciled 1:1' claim is QUALIFIED — it states only `blocking` rows are live-reconciled and signed-off rows are hand-authored (no over-claim)", () => {
  const report = reportText();
  const start = report.search(/##\s*6\.\s*Readiness/i);
  assert.ok(start >= 0, "the report must contain a '## 6. Readiness' section");
  const rest = report.slice(start);
  const end = rest.search(/\n##\s*7\./);
  const readiness = end > 0 ? rest.slice(0, end) : rest;
  const lc = readiness.toLowerCase();

  // The reconciliation guard scans only `blocking`-status register rows — the §6 claim must scope its
  // "1:1" to the blocking rows and disclose that the signed-off rows are hand-authored, not
  // live-reconciled. An unqualified "reconciled 1:1 with §4" oversells the executable guard's reach.
  assert.ok(
    /1:1[^\n]*blocking|blocking[^\n]*1:1/.test(lc),
    "the §6 reconciliation claim must scope its 1:1 guarantee to the `blocking` rows (the only rows the guard live-reconciles)",
  );
  assert.ok(
    /(hand-authored|not live-reconciled|not.{0,20}reconciled)/.test(lc),
    "the §6 claim must disclose that the `signed-off` register rows are hand-authored / NOT live-reconciled — the guard scans only blocking-status rows (no over-claim vs the R-917/R-920 no-drift discipline)",
  );
});

// ══ 9.5-EVID-01 (P1) + docs-structure — the report carries all required sections non-empty ═════

test("9.5-EVID-01: the report carries the required sections (gate summary, scope confirmation, readiness), each non-empty", () => {
  const report = reportText();
  const sections: Array<{ label: string; re: RegExp }> = [
    { label: "gate summary (§2)", re: /##\s*2\.\s*Gate Summary/i },
    { label: "skipped-gates discipline (§3)", re: /##\s*3\.\s*Skipped-Gates/i },
    { label: "scope confirmation (§4)", re: /##\s*4\.\s*Scope Confirmation/i },
    { label: "security/money/migration evidence (§5)", re: /##\s*5\.\s*Security \/ Money \/ Migration/i },
    { label: "readiness / stop conditions (§6)", re: /##\s*6\.\s*Readiness/i },
  ];
  const positions = sections.map((s) => {
    const idx = report.search(s.re);
    assert.ok(idx >= 0, `the report is MISSING the required section: ${s.label}`);
    return idx;
  });
  // Each section must carry substantive content before the next section heading.
  for (let i = 0; i < positions.length; i++) {
    const nextPos = i + 1 < positions.length ? positions[i + 1] : report.length;
    const body = report.slice(positions[i], nextPos);
    assert.ok(
      body.replace(/[\s#|*`-]/g, "").length > 200,
      `the section "${sections[i].label}" appears empty/stubbed — it must carry substantive content (9.5-EVID-01)`,
    );
  }
});

test("9.5-EVID-01: the report states its phase + scope + mode at the top (BMAD Output Discipline)", () => {
  const head = reportText().slice(0, 1200).toLowerCase();
  assert.ok(/phase a/.test(head), "the report must state 'Phase A' at the top");
  assert.ok(/docs \+ a `tests\/unit\/\*\*` validator|docs \+.*validator/.test(head), "the report must state its docs + validator mode at the top");
  // Evergreen anchoring: it must reference architecture §-anchors, not recurring 'Epic N / Story X-Y'.
  assert.ok(/§16|§19|§24/.test(reportText()), "the report body must reference architecture §-anchors (§16/§19/§24), not plan positions (R-922)");
});

// ══ Representativeness guard — no fictional ReadinessCode propagated ═══════════════════════════

test("9.5: any readiness code the report references is a REAL member of the exported union (no fictional code)", async () => {
  const report = reportText();
  const real = new Set(await loadReadinessCodes());
  // The two KNOWN-fictional codes (the representativeness trap) must NEVER appear.
  for (const fictional of ["REQUIRES_SIGN_OFF", "DEDUCTION_ESTIMATE_UNAPPROVED"]) {
    assert.equal(
      report.includes(fictional),
      false,
      `the report must NOT reference the fictional ReadinessCode "${fictional}" — use only real members of the exported union`,
    );
  }
  // Any SCREAMING_SNAKE token referenced as a readiness code must be real. Restrict to the
  // readiness-code naming families AND exclude known NON-readiness infrastructure tokens (CI env
  // vars like SUPABASE_TEST_REQUIRED end in _REQUIRED but are not readiness codes) so the
  // representativeness guard does not false-positive on unrelated constants.
  const NON_READINESS_INFRA = /^(SUPABASE|NEXT|NODE|CI|GITHUB|PNPM|VERCEL)_/;
  const cited = new Set(
    (report.match(/\b[A-Z]{2,}(?:_[A-Z]+)+\b/g) ?? [])
      .filter((t) => !NON_READINESS_INFRA.test(t))
      .filter((t) =>
        /_(?:REQUIRED|DEFERRED|SIGN_OFF|VAT|MARGIN|CUSTOMER|FACILITY|CONTACT|SECTION|PRICE|ROLE|INCLUDED|UNCOMPUTABLE)\b/.test(t),
      ),
  );
  for (const token of cited) {
    if (real.has(token)) continue;
    assert.fail(
      `the report references "${token}" as a readiness code, but it is NOT a real member of READINESS_CODES — reference the exported union only`,
    );
  }
});

// ══ Doc hygiene — no stray write-tool artifact lines (9.1 Tier-A caught these) ═════════════════

test("9.5: the report has NO stray tool-call artifact lines (write-tool emission tokens)", () => {
  const src = reportText();
  const artifacts = ["</content>", "</invoke>", "<invoke", "<parameter", "</parameter>"];
  for (const artifact of artifacts) {
    assert.equal(
      src.includes(artifact),
      false,
      `the report contains a stray tool-call artifact line "${artifact}" — doc-heavy output can leak these; each file must end cleanly at its last real section (9.1 Tier-A hygiene)`,
    );
  }
});

// ══ PII scan (R-901/R-902/R-914) — reuse the 9.1/9.4 whole-directory scan verbatim ════════════

test("9.5-PRIV: NO real PII (personnummer / orgnr / email / phone / secret) in any docs/migration/** file (incl. the new report)", () => {
  const files = migrationDocFiles();
  // >=4 because 9.5 ADDS the acceptance-gate report to the two 9.1 docs + the 9.4 doc already present.
  assert.ok(
    files.length >= 4,
    `expected the two 9.1 docs + the 9.4 doc + the new 9.5 report under docs/migration/** — found ${files.length}`,
  );

  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const rel = path.relative(REPO, file);
    const violations = scanTextForPii(src);
    assert.deepEqual(
      violations,
      [],
      `${rel} contains real-PII-shaped material (R-901/R-902/R-914): ${JSON.stringify(violations)}`,
    );
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// COVERAGE EXPANSION (testarch-automate) — edge cases + negative-path proofs the initial red-phase
// scaffold did not exercise. These strengthen the exact anti-patterns the epic-9 retro constraints
// flag: the substring-token trap (R-903), vacuous-green guards (R-904), and the honesty model's
// full status vocabulary. Each added case is unit-level, pure-logic, P0/P1 (the models are the
// epic-blocker teeth). No new source, no DB, no browser — the docs-validator shape (single
// node --test file), per the story's own Testing Standards.
// ══════════════════════════════════════════════════════════════════════════════════════════════

// ── PII scan: prove the guard FIRES (R-904 vacuous-green teeth) ────────────────────────────────

test("9.5-PRIV (the PII scan FIRES): a seeded personnummer / orgnr / email / phone / secret each trips the scan (negative path)", () => {
  // Each seeded synthetic string must be caught by its family — a scan that only asserts today's docs
  // are clean without proving it CAN fire is the vacuous-green trap the epic ledgers (R-904).
  const cases: Array<{ kind: PiiViolation["kind"]; sample: string }> = [
    { kind: "personnummer", sample: "born 19850101-1234 in the record" },
    // Fake, NON-registered 10-digit placeholder (R-914): the orgnr scan is a bare `\b\d{10}\b` match
    // with no Luhn/registry check, so any 10-digit token fires it — never commit a real registered orgnr
    // even as negative-path test data (this file sits outside the docs/migration/** scan that would catch it).
    { kind: "orgnr", sample: "org 1234567890 on file" },
    { kind: "email", sample: "contact anna.andersson@realcompany.se today" },
    { kind: "phone", sample: "call +46 70 123 45 67 now" },
    { kind: "secret", sample: 'api_key: "sk_live_ABCDEF0123456789"' },
  ];
  for (const { kind, sample } of cases) {
    const violations = scanTextForPii(sample);
    assert.ok(
      violations.some((v) => v.kind === kind),
      `the PII scan MUST fire on a seeded ${kind} ("${sample}") — the R-902 teeth are proven reachable, not dead machinery`,
    );
  }
});

test("9.5-PRIV: the PII scan does NOT false-positive on the sanctioned masked placeholders (YYYYMMDD-XXXX / XXXXXX-XXXX) or test-domain emails", () => {
  const clean =
    "Illustrative personnummer YYYYMMDD-XXXX and orgnr XXXXXX-XXXX; reach us at qa@example.test — all synthetic.";
  assert.deepEqual(
    scanTextForPii(clean),
    [],
    "the sanctioned masked placeholders + test-domain emails must NOT be flagged (they are the approved synthetic forms)",
  );
});

// ── evaluateGateHonesty: full status vocabulary + invalidStatus teeth ──────────────────────────

test("9.5-GATE-01: a clean report (every mandatory gate present, valid status, reasons on skips) passes the honesty model with ZERO findings", () => {
  const realKeys = realMandatoryGateKeys();
  const clean: ReportedGate[] = realKeys.map((key, i) => {
    // Mix the full valid vocabulary: pass / fail / skipped-with-reason (reason present) — all honest.
    if (i % 3 === 0) return { key, status: "pass" as const, hasReason: true };
    if (i % 3 === 1) return { key, status: "fail" as const, hasReason: true };
    return { key, status: "skipped-with-reason" as const, hasReason: true };
  });
  const result = evaluateGateHonesty(clean, realKeys);
  assert.deepEqual(result, { missing: [], skippedWithoutReason: [], invalidStatus: [] });
});

test("9.5-GATE-01 (the honesty guard FIRES): a gate with a status OUTSIDE pass/fail/skipped-with-reason is flagged invalidStatus (negative path)", () => {
  const realKeys = realMandatoryGateKeys();
  // A bare `skipped` (no `-with-reason` suffix) is NOT a valid status token — even if it carries a
  // reason it must surface as invalidStatus, because the report vocabulary is strictly the three.
  const seeded: ReportedGate[] = realKeys.map((key) =>
    key === "build"
      ? { key, status: "skipped" as const, hasReason: true }
      : { key, status: "pass" as const, hasReason: true },
  );
  const result = evaluateGateHonesty(seeded, realKeys);
  assert.ok(
    result.invalidStatus.includes("build"),
    "a bare `skipped` (not `skipped-with-reason`) must be flagged invalidStatus — the honesty vocabulary is exactly pass/fail/skipped-with-reason",
  );
});

test("9.5-GATE-01: a `skipped-with-reason` gate WITH a reason is honest; the SAME gate with NO reason is flagged (the reason is load-bearing)", () => {
  const realKeys = realMandatoryGateKeys();
  const withReason: ReportedGate[] = realKeys.map((key) =>
    key === "test:e2e" ? { key, status: "skipped-with-reason" as const, hasReason: true } : { key, status: "pass" as const, hasReason: true },
  );
  assert.deepEqual(
    evaluateGateHonesty(withReason, realKeys).skippedWithoutReason,
    [],
    "a skipped-with-reason gate that carries its reason is honest — it must NOT be flagged",
  );
  const withoutReason = withReason.map((g) =>
    g.key === "test:e2e" ? { ...g, hasReason: false } : g,
  );
  assert.ok(
    evaluateGateHonesty(withoutReason, realKeys).skippedWithoutReason.includes("test:e2e"),
    "the SAME gate with its reason removed MUST be flagged — proving the reason is the load-bearing honesty signal, not decoration",
  );
});

// ── scanSurfaceForDeferred: substring-token trap (R-903) + every-category proof ─────────────────

test("9.5-SCOPE-01: the scope scan uses WHOLE-WORD matching — benign tokens that merely CONTAIN a deny-list substring do NOT false-positive (R-903 substring trap)", async () => {
  const denyList = await loadDenyList();
  // Real-shaped surface tokens whose substrings brush the short deny-list categories (hr/dou/asset/…)
  // but are NOT deferred modules. A naive `includes` scan would false-positive; the word-boundary scan
  // must stay silent — the R-903 substring-token trap the epic explicitly ledgers.
  const benignSurface = [
    "characters", // contains ...har... — must NOT trip `hr`
    "threshold", // contains ...hr... inside — must NOT trip `hr` (no word boundary)
    "shredder", // ...hr... mid-word — must NOT trip `hr`
    "assessment", // contains `asses` not `asset` — must NOT trip `asset`
    "doubt", // contains `dou` mid-word — must NOT trip `dou`
    "rentalize_nothing_here", // whole-word `rental` WOULD trip; kept out below
    "quote_version_attachments", // a REAL table — must stay clean
    "calculation_sections",
  ].filter((t) => t !== "rentalize_nothing_here"); // exclude the intentional positive
  const violations = scanSurfaceForDeferred(benignSurface, denyList);
  assert.deepEqual(
    violations,
    [],
    `the scope scan false-positived on a benign substring (R-903 substring-token trap): ${JSON.stringify(violations)} — matching must be whole-word, not naive includes`,
  );
});

test("9.5-SCOPE-01: EVERY deny-list category (not just fortnox/supplier) trips the scan when seeded as a whole-word surface token", async () => {
  const denyList = await loadDenyList();
  // Drive the seeded-token proof across the ENTIRE live deny-list, not a hardcoded subset — so a newly
  // added category is automatically covered (never a drifting subset). Each seeded token is the bare
  // category as a standalone surface token, which must match its own category.
  for (const category of denyList) {
    const violations = scanSurfaceForDeferred([`/${category}`, `${category}_table`], denyList);
    assert.ok(
      violations.some((v) => v.category === category),
      `the scope scan MUST trip on a seeded "${category}" surface token — every deny-list category must be reachable, not just the two named in the scaffold`,
    );
  }
});

test("9.5-SCOPE-01: the scope scan is case-insensitive — an UPPERCASE deferred token (e.g. `/Fortnox`, `HR_Report`) still trips", async () => {
  const denyList = await loadDenyList();
  const violations = scanSurfaceForDeferred(["/Fortnox", "HR_Report", "SUPPLIER_APIS"], denyList);
  assert.ok(violations.some((v) => v.category === "fortnox"), "an uppercase `/Fortnox` must trip the case-insensitive scan");
  assert.ok(violations.some((v) => v.category === "hr"), "an uppercase `HR_Report` must trip the case-insensitive scan");
  assert.ok(violations.some((v) => v.category === "supplier"), "an uppercase `SUPPLIER_APIS` must trip the case-insensitive scan");
});

// ── parseReportedGates + registerBlockingIds: parser fidelity (the models are only as honest as their input) ──

test("9.5-GATE-01: parseReportedGates reads the REAL report and yields the mandatory core gates each with a VALID parsed status", () => {
  const rows = parseReportedGates(reportText());
  const byKey = new Map(rows.map((r) => [r.key, r]));
  // The parser must actually find the core gate rows in the real §2 (else the honesty model runs on air).
  for (const key of ["test:unit", "test:int", "test:e2e", "typecheck", "lint", "build", "db-reset"]) {
    const row = byKey.get(key);
    assert.ok(row, `parseReportedGates did not extract the mandatory gate row "${key}" from the real report §2`);
    assert.ok(
      ["pass", "fail", "skipped-with-reason"].includes(row.status),
      `the parsed status for "${key}" ("${row.status}") must be a valid honesty-vocabulary token`,
    );
  }
});

test("9.5-READY-01: registerBlockingIds parses EVERY blocking owning ID from the 9.4 register §4 — dotted money/tax families included — and excludes section-reference tokens", () => {
  const ids = registerBlockingIds();
  // The parser must extract the FULL blocking set: the dotted money/tax families (`A.1`/`A.2`/
  // `B.1-B.4`/`C.1-C.3`), the tax-wording family (`A20`/`A21`/`A22-tax`), and the migration/job-model
  // families (`7.1`/`7.3`/`8.1`/`8.2`). The dotted `[A-C].\d` families were previously dropped by the
  // extraction regex (letter-then-dot never matched), so the no-drift reconciliation could not enforce
  // them 1:1 against §6 — the R-917 hole this closes.
  for (const id of ["A.1", "A.2", "B.1-B.4", "C.1-C.3", "A20", "A21", "A22-tax", "8.1", "8.2", "7.1", "7.3"]) {
    assert.ok(ids.includes(id), `registerBlockingIds must include the known blocking owning ID "${id}" — parsed: ${ids.join(", ")}`);
  }
  // The disclaimer-wording facet is carried under the register-local sub-ID `A22-tax`, isolating it
  // from the answered quote-terms `A22` (signed-off). The blocking set must therefore carry `A22-tax`
  // WHOLE and NOT emit a stray bare `A22` (which would re-conflate the two opposite-status facets).
  assert.ok(!ids.includes("A22"), `registerBlockingIds must carry the tax-wording facet as the whole sub-ID "A22-tax", never a stray bare "A22" (facet disambiguation) — parsed: ${ids.join(", ")}`);
  // The answered (non-blocking) `D.1`/`D.2`/`D.3` eligibility tokens riding in the ROT blocking row must
  // NOT leak in — they sit outside the `[A-C]` money/tax family filter.
  for (const nonId of ["D.1", "D.2", "D.3"]) {
    assert.ok(!ids.includes(nonId), `registerBlockingIds must NOT treat the answered eligibility token "${nonId}" as a blocking owning ID`);
  }
  // Section-reference tokens (§4.1 / §4.2 / §5) must NOT leak in as blocking IDs (parser scoping).
  for (const nonId of ["4.1", "4.2", "5"]) {
    assert.ok(!ids.includes(nonId), `registerBlockingIds must NOT treat the section reference "${nonId}" as a blocking owning ID`);
  }
  // Every parsed ID must be a real ID-shaped token, never stray prose (parser fidelity).
  for (const id of ids) {
    assert.ok(/^[A-C]?\d|^[A-C]\.\d/.test(id), `registerBlockingIds returned a non-ID-shaped token "${id}"`);
  }
});
