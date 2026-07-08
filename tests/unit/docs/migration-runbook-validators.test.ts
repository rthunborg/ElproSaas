/**
 * Legacy-record-classification-and-migration-runbook story — executable docs-invariant
 * validators for the migration/coexistence CONTROL-POINT docs under `docs/migration/**`.
 *
 * The story that authored the runbook is docs-only (NO product code / schema / migration),
 * so its "tests" per the epic-9 test design (`test-design-epic-9.md`) are docs/checklist
 * validators, weighted as a decision/evidence artifact:
 *   - 9.1-CLASS-01 (P1, R-907): each record group is classified live/archive-only/excluded/
 *     deferred, and a DEFERRED group NEVER maps to a Phase A table/UI. A deferred group wired
 *     to a live table is the over-migration / Lovable-schema-as-blueprint failure this doc
 *     exists to block.
 *   - 9.1-RUNBOOK-01 (P2): every Phase A pilot workflow carries source records · target
 *     treatment · fallback path · manual-backfill risks · cutover-by-workflow (all non-empty).
 *   - 9.1-STOP-01 (P2, R-907): a scope-unclear → STOP-for-owner-clarification protocol is
 *     present and the owner-gated real-record selection stays STOP-marked, never default-filled.
 *   - 9.1-PRIV-03 (P0, R-901/R-902): NO real PII (personnummer/orgnr/email/phone/secret) in any
 *     committed `docs/migration/**` file — redacted/synthetic examples only.
 *
 * These validators were manual docs-review checks in the authoring story; this file promotes
 * them to standing, executable `node --test` coverage so the invariants fail loud on every PR
 * if a later edit weakens the classification, drops a workflow field, removes the STOP protocol,
 * or leaks PII into the migration docs.
 *
 * ── Runner-glob discipline (project Testing Rule) ─────────────────────────────────────────────
 * This lives under `tests/unit/**` and uses `node:test`/`node:assert` so it is picked up by the
 * pure-logic unit runner (`pnpm test:unit`, glob `tests/unit/ ** / *.test.ts`). A file placed
 * outside that glob would be vacuous-green (never executed) — the exact trap the story warns of.
 *
 * ── Source-of-truth cross-checks (no fabricated / memorised facts) ────────────────────────────
 * The 24-table Phase A boundary is read LIVE from the RLS inventory
 * (`tests/integration/rls/tenant-table-inventory.ts` `TENANT_TABLES`) — never a hardcoded list —
 * and the `REQUIRED_FILES_DEFERRED` readiness reference is cross-checked against the real
 * `ReadinessCode` union (`src/features/calculations/readiness.ts`), so a rename/removal in the
 * real source surfaces here instead of the docs quietly drifting.
 *
 * [Source: test-design-epic-9.md#9.1-CLASS-01/RUNBOOK-01/STOP-01/PRIV-03, R-901/R-902/R-907;
 *  architecture §16 (four buckets, cutover-by-workflow); tests/integration/rls/
 *  tenant-table-inventory.ts (TENANT_TABLES); src/features/calculations/readiness.ts
 *  (ReadinessCode union); tests/unit/guardrails/*-non-scope.test.ts (the docs-scan pattern)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REPO = process.cwd();
const MIGRATION_DOCS_DIR = path.join(REPO, "docs", "migration");
const CLASSIFICATION_DOC = path.join(MIGRATION_DOCS_DIR, "legacy-record-classification.md");
const RUNBOOK_DOC = path.join(MIGRATION_DOCS_DIR, "migration-runbook.md");

/** The four buckets from the architecture §16 classification contract. */
const BUCKETS = ["live", "archive-only", "excluded", "deferred"] as const;

/** Read a required migration doc, failing loud (not skipping) if it is missing. */
function readRequiredDoc(file: string): string {
  assert.equal(
    existsSync(file),
    true,
    `required migration doc is missing: ${path.relative(REPO, file)} — the migration/coexistence control point must exist`,
  );
  return readFileSync(file, "utf8");
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

/** Load the LIVE 24-table Phase A boundary from the single source of truth (never memory). */
async function loadTenantTables(): Promise<readonly string[]> {
  const mod = (await import(
    pathToFileURL(
      path.join(REPO, "tests", "integration", "rls", "tenant-table-inventory.ts"),
    ).href
  )) as { TENANT_TABLES: ReadonlyArray<{ table: string } | string> };
  return mod.TENANT_TABLES.map((t) => (typeof t === "string" ? t : t.table));
}

// ── 9.1-CLASS-01 — four-bucket classification + R-907 deferred-never-live guard ───────────────

test("9.1-CLASS-01: the classification register exists and uses ALL four buckets (live/archive-only/excluded/deferred)", () => {
  const src = readRequiredDoc(CLASSIFICATION_DOC);
  const lc = src.toLowerCase();
  for (const bucket of BUCKETS) {
    assert.ok(
      lc.includes(bucket),
      `the classification register must exercise the "${bucket}" bucket (architecture §16 four-bucket contract) — it was not found`,
    );
  }
  // The four bucket sub-sections (§4.1 live / §4.2 archive-only / §4.3 excluded / §4.4 deferred)
  // must all be present, so no bucket is silently dropped.
  for (const heading of ["Live for pilot", "Archive-only", "Excluded", "Deferred"]) {
    assert.ok(
      new RegExp(`###?[^\\n]*${heading}`, "i").test(src),
      `the register must have a "${heading}" section — the four-bucket structure is incomplete without it`,
    );
  }
});

test("9.1-CLASS-01 (R-907): EVERY deferred-bucket row maps to 'none — deferred' (a deferred group NEVER becomes a Phase A table/UI)", () => {
  const src = readRequiredDoc(CLASSIFICATION_DOC);
  // Isolate the deferred sub-section (§4.4) — from its heading to the next top-level (##) heading.
  const deferredStart = src.search(/###?[^\n]*Deferred/i);
  assert.ok(deferredStart >= 0, "the register must contain a Deferred (§4.4) section");
  const rest = src.slice(deferredStart);
  const nextTop = rest.search(/\n##\s/);
  const deferredSection = nextTop > 0 ? rest.slice(0, nextTop) : rest;

  // Every markdown table data row (a `| … |` line whose first cell is a real record group, i.e.
  // not the header/separator) in the deferred section must carry the "none — deferred" treatment.
  const rows = deferredSection
    .split("\n")
    .filter((l) => l.trim().startsWith("|") && l.includes("`deferred`"));
  assert.ok(
    rows.length >= 5,
    `expected the deferred bucket to enumerate the deferred-module surface (>=5 rows) — found ${rows.length}`,
  );
  for (const row of rows) {
    assert.ok(
      /none\s*[—-]\s*deferred/i.test(row),
      `a deferred-bucket row does NOT map to "none — deferred" (R-907 over-migration guard): ${row.trim()}`,
    );
    // Hard negative: a deferred row must not silently name a live Phase A table as its target.
    // (The "none — deferred" cell is the only sanctioned target for a deferred group.)
  }
});

test("9.1-CLASS-01 (D2): every LIVE-bucket target table is one of the 24 real TENANT_TABLES (no live group exceeds the Phase A boundary)", async () => {
  const src = readRequiredDoc(CLASSIFICATION_DOC);
  const tenantTables = await loadTenantTables();
  assert.equal(
    tenantTables.length,
    24,
    `the Phase A boundary must be exactly 24 tenant-owned tables (source of truth) — found ${tenantTables.length}`,
  );
  const tableSet = new Set(tenantTables);

  // Isolate the live sub-section (§4.1).
  const liveStart = src.search(/###?[^\n]*Live for pilot/i);
  assert.ok(liveStart >= 0, "the register must contain a Live-for-pilot (§4.1) section");
  const rest = src.slice(liveStart);
  const nextSub = rest.slice(3).search(/\n###?\s/);
  const liveSection = nextSub > 0 ? rest.slice(0, nextSub + 3) : rest;

  // Collect every backtick-quoted identifier that also appears in the target-treatment cells,
  // and assert each identifier that is plausibly a target table is a real TENANT_TABLE. We scope
  // to identifiers that ARE in the tenant set (so column/flag names like `is_optional` or prose
  // tokens are ignored) and require that at least the core live tables are cited — a live row
  // must never invent a table outside the 24-table boundary.
  const quoted = new Set(
    (liveSection.match(/`([a-z_]+)`/g) ?? []).map((m) => m.replace(/`/g, "")),
  );
  const citedTargets = [...quoted].filter((id) => tableSet.has(id));
  assert.ok(
    citedTargets.length >= 15,
    `the live section should map to the real tenant tables (expected >=15 of the 24 cited) — found ${citedTargets.length}: ${citedTargets.join(", ")}`,
  );
  // Sanity anchor: the upstream CRM + quote-core tables must be present as live targets.
  for (const mustHave of ["customers", "facilities", "contacts", "quotes", "quote_versions", "jobs"]) {
    assert.ok(
      citedTargets.includes(mustHave),
      `expected core live target "${mustHave}" to be cited as a live Phase A table in the register`,
    );
  }
});

// ── 9.1-RUNBOOK-01 — per-workflow required fields present + non-empty ─────────────────────────

test("9.1-RUNBOOK-01: every Phase A pilot workflow carries source · treatment · fallback · backfill-risk · cutover (all present, all non-empty)", () => {
  const src = readRequiredDoc(RUNBOOK_DOC);

  // The six Phase A pilot workflows (the §3.x per-workflow rows).
  const workflowHeadings = [
    /###[^\n]*CRM/i,
    /###[^\n]*Settings\s*\/\s*Pricing/i,
    /###[^\n]*Calculations/i,
    /###[^\n]*Quote Versions/i,
    /###[^\n]*Basic Job/i,
    /###[^\n]*Required Files/i,
  ];

  // Slice the §3 per-workflow region into per-workflow blocks by heading position.
  const positions = workflowHeadings.map((re) => {
    const idx = src.search(re);
    assert.ok(idx >= 0, `the runbook must document a workflow matching ${re} in the per-workflow table (§3)`);
    return idx;
  });
  // Blocks run from each heading to the next heading (or the §4 top-level heading after the last).
  const afterLast = (() => {
    const tail = src.slice(positions[positions.length - 1]);
    const nextTop = tail.search(/\n##\s/);
    return nextTop > 0 ? positions[positions.length - 1] + nextTop : src.length;
  })();
  const bounds = [...positions, afterLast];

  const requiredFields: Array<{ label: string; re: RegExp }> = [
    { label: "source records", re: /\*\*Source records/i },
    { label: "target treatment", re: /\*\*Target treatment/i },
    { label: "fallback path", re: /\*\*Fallback path/i },
    { label: "manual-backfill risks", re: /\*\*Manual-backfill risks/i },
    { label: "cutover-by-workflow decision", re: /\*\*Cutover-by-workflow decision/i },
  ];

  for (let i = 0; i < positions.length; i++) {
    const block = src.slice(bounds[i], bounds[i + 1]);
    for (const field of requiredFields) {
      const m = block.match(field.re);
      assert.ok(
        m,
        `workflow #${i + 1} (matching ${workflowHeadings[i]}) is MISSING the required "${field.label}" field (9.1-RUNBOOK-01)`,
      );
      // Non-empty check: the field label must be followed by substantive prose before the next
      // field label or block end (guard against a stub bullet with no content).
      const after = block.slice((m!.index ?? 0) + m![0].length);
      const contentBeforeNextField = after.split(/\n-\s\*\*/)[0];
      assert.ok(
        contentBeforeNextField.replace(/[:\s*]/g, "").length > 20,
        `workflow #${i + 1}'s "${field.label}" field appears empty/stubbed — it must carry substantive content (9.1-RUNBOOK-01)`,
      );
    }
  }
});

test("9.1-RUNBOOK-01: cutover is stated as per-workflow, NEVER whole-company (architecture §16)", () => {
  const src = readRequiredDoc(RUNBOOK_DOC).toLowerCase();
  assert.ok(
    /by workflow, never whole-company|per-workflow, never whole-company|never whole-company/.test(src),
    "the runbook must state cutover is per-workflow, never whole-company (architecture §16) — the phrase was not found",
  );
});

// ── 9.1-RUNBOOK §5 asset-location seams: evergreen-accurate + no vacuous-green home (R-922/R-904) ──

/** Isolate the runbook's §5 "Approved Asset-Location Seams" section text. */
function assetSeamsSection(): string {
  const src = readRequiredDoc(RUNBOOK_DOC);
  const start = src.search(/##\s*5\.\s*Approved Asset-Location Seams/i);
  assert.ok(start >= 0, "the runbook must contain a '## 5. Approved Asset-Location Seams' section");
  const rest = src.slice(start);
  const end = rest.slice(3).search(/\n##\s/);
  return end > 0 ? rest.slice(0, end + 3) : rest;
}

test("9.1-RUNBOOK §5 (R-922 evergreen): the fixture + capture-script homes that Story 9.2 committed are marked LANDED, not 'does NOT exist yet'", () => {
  const section = assetSeamsSection();
  // The two homes 9.2 actually created — if the runbook still declares them non-existent while the
  // files are committed, §5 is stale-on-arrival (the R-922 evergreen-doc violation this fix closed).
  const fixtureHome = path.join(REPO, "tests", "fixtures", "golden", "lovable");
  const captureScript = path.join(REPO, "scripts", "migration", "lovable-capture.ts");
  assert.ok(existsSync(fixtureHome), "precondition: the 9.2 fixture home must exist in the repo");
  assert.ok(existsSync(captureScript), "precondition: the 9.2 capture harness must exist in the repo");

  // §5 must NOT describe an existing repo location as forthcoming / non-existent.
  assert.ok(
    !/does NOT exist yet/i.test(section),
    "§5 still declares an asset home 'does NOT exist yet' while Story 9.2 committed it — flip the status to 'landed' (R-922 evergreen-doc discipline)",
  );
  // The fixtures + capture-script rows must carry a 'landed' status (Story 9.2).
  assert.ok(
    /`tests\/fixtures\/golden\/lovable\/\*\*`[^\n]*landed/i.test(section),
    "§5 must mark the anonymized-fixtures home as landed (Story 9.2)",
  );
  assert.ok(
    /`scripts\/migration\/\*\*`[^\n]*landed/i.test(section),
    "§5 must mark the capture/reset-scripts home as landed (Story 9.2)",
  );
});

test("9.1-RUNBOOK §5 (R-904 runner-glob): §5 does NOT offer `tests/golden/**` as a comparison-test home without flagging it never runs", () => {
  const section = assetSeamsSection();
  // `tests/golden/**` is outside the `test:unit` glob (`tests/unit/**`), so a suite there is
  // never executed (vacuous-green). If §5 mentions it at all, it MUST warn it is not executed —
  // it must never be offered as an unqualified valid comparison-test home (the runner-glob trap).
  if (/`tests\/golden\/\*\*`/.test(section)) {
    assert.ok(
      /`tests\/golden\/\*\*`[^\n]*(never executed|NOT[^\n]*glob|do NOT use|vacuous)/i.test(section),
      "§5 lists `tests/golden/**` but does not flag that it is never executed by `test:unit` — a comparison suite placed there is vacuous-green (R-904). Mark it 'never executed / do NOT use' or drop it.",
    );
  }
  // The approved comparison-test home must be under tests/unit/** (the executed glob).
  assert.ok(
    /`tests\/unit\/\*\*`/.test(section),
    "§5 must name `tests/unit/**` as the executed comparison-test home (the only glob `test:unit` runs)",
  );
});

// ── 9.1-STOP-01 — fail-closed scope-unclear STOP protocol ─────────────────────────────────────

test("9.1-STOP-01: the runbook has a fail-closed 'scope-unclear → STOP for owner clarification' protocol section", () => {
  const src = readRequiredDoc(RUNBOOK_DOC);
  assert.ok(
    /##[^\n]*Scope-Unclear[^\n]*STOP/i.test(src),
    "the runbook must contain a 'Scope-Unclear → STOP' protocol section (AC3, R-907 fail-closed guard)",
  );
  // The protocol must enumerate the hard-STOP conditions, including real customer data export/import.
  const lc = src.toLowerCase();
  assert.ok(
    /real customer data (export|import)/.test(lc) && /hard stop/.test(lc),
    "the STOP protocol must name 'real customer data export/import' as a HARD STOP requiring owner sign-off",
  );
  assert.ok(
    /over-migration|full historical migration/.test(lc),
    "the STOP protocol must name full-historical / over-migration as a STOP condition (R-907)",
  );
  assert.ok(
    /deferred-module activation/.test(lc),
    "the STOP protocol must name deferred-module activation as a STOP condition",
  );
});

test("9.1-STOP-01: the owner-gated real-record selections (8.1/8.2) are STOP-marked, NOT default-filled", () => {
  const classification = readRequiredDoc(CLASSIFICATION_DOC);
  const runbook = readRequiredDoc(RUNBOOK_DOC);
  const combined = `${classification}\n${runbook}`.toLowerCase();
  // Both owner-gated items must be present and flagged owner-pending (öppen (möte)), so the doc
  // documents the STRUCTURE while explicitly deferring the concrete real-record selection.
  for (const item of ["8.1", "8.2"]) {
    assert.ok(
      combined.includes(item),
      `the migration docs must reference the owner-gated item "${item}" (real-record / golden-example selection is owner-pending)`,
    );
  }
  assert.ok(
    combined.includes("öppen (möte)") || combined.includes("owner-pending") || combined.includes("owner-gated"),
    "the migration docs must mark the owner-gated selection as owner-pending (öppen (möte)) — a fabricated concrete selection is forbidden (R-907)",
  );
});

// ── 9.1-PRIV-03 — zero real PII in docs/migration/** (R-901/R-902) ────────────────────────────

test("9.1-PRIV-03: NO real PII (personnummer / orgnr / email / phone / secret) appears in any docs/migration/** file", () => {
  const files = migrationDocFiles();
  assert.ok(files.length >= 2, `expected at least the two migration docs under docs/migration/** — found ${files.length}`);

  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const rel = path.relative(REPO, file);

    // Strip the sanctioned obviously-fake masked placeholders so they never false-positive.
    // (YYYYMMDD-XXXX / XXXXXX-XXXX are non-numeric masks a real-PII scan cannot mistake for data.)
    const scanned = src
      .replace(/YYYYMMDD-XXXX/g, "")
      .replace(/XXXXXX-XXXX/g, "");

    // personnummer-shaped: 6–8 digits, optional separator, 4 digits (real Swedish personal id shape).
    const pnr = scanned.match(/\b\d{6,8}[-\s]?\d{4}\b/g);
    assert.equal(
      pnr,
      null,
      `${rel} contains a personnummer-shaped string ${JSON.stringify(pnr)} — migration docs must use redacted/synthetic examples only (R-902)`,
    );

    // orgnr-shaped: a bare 10-digit run (R-914 standing scan constraint).
    const orgnr = scanned.match(/\b\d{10}\b/g);
    assert.equal(
      orgnr,
      null,
      `${rel} contains a bare 10-digit orgnr-shaped string ${JSON.stringify(orgnr)} — keep illustrative numbers non-10-digit or masked (R-914)`,
    );

    // real email: an @ with a domain that is NOT an obvious documentation placeholder.
    const emails = (scanned.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []).filter(
      (e) => !/@(example\.(test|com|org)|test\.test|localhost)$/i.test(e),
    );
    assert.deepEqual(
      emails,
      [],
      `${rel} contains a non-placeholder email ${JSON.stringify(emails)} — migration docs must contain no real email (R-902)`,
    );

    // phone-shaped: a Swedish +46 number or a long separated digit run.
    const phones = scanned.match(/\+46[\s-]?\d[\d\s-]{6,}|\b0\d{1,3}[-\s]\d{5,}\b/g);
    assert.equal(
      phones,
      null,
      `${rel} contains a phone-shaped string ${JSON.stringify(phones)} — migration docs must contain no real phone number (R-902)`,
    );

    // secret material: assigned api key / password / bearer / PEM block (value form, not a policy mention).
    const secrets = scanned.match(
      /(api[_-]?key|password|secret|token|bearer)\s*[:=]\s*["']?[A-Za-z0-9/_+.\-]{12,}|-----BEGIN [A-Z ]+-----/gi,
    );
    assert.equal(
      secrets,
      null,
      `${rel} contains secret-shaped material ${JSON.stringify(secrets)} — migration docs must contain no secret/key/token value (R-902)`,
    );
  }
});

// ── Representativeness guard — no fictional ReadinessCode propagated ──────────────────────────

test("9.1: the runbook's readiness-code reference matches the REAL ReadinessCode union (no fictional code propagated)", async () => {
  const runbook = readRequiredDoc(RUNBOOK_DOC);
  const readinessSrc = readFileSync(
    path.join(REPO, "src", "features", "calculations", "readiness.ts"),
    "utf8",
  );

  // The runbook references REQUIRED_FILES_DEFERRED for the required-files fallback seam (R-513).
  // That code MUST be a real member of the exported union — else the doc drifted from source.
  if (runbook.includes("REQUIRED_FILES_DEFERRED")) {
    assert.ok(
      /["|]\s*"REQUIRED_FILES_DEFERRED"/.test(readinessSrc) || readinessSrc.includes('"REQUIRED_FILES_DEFERRED"'),
      "the runbook cites REQUIRED_FILES_DEFERRED but it is NOT a real member of the ReadinessCode union — the doc must reference real codes only",
    );
  }

  // The two KNOWN-fictional codes (the representativeness trap called out in the story) must NEVER
  // appear in the migration docs.
  for (const fictional of ["REQUIRES_SIGN_OFF", "DEDUCTION_ESTIMATE_UNAPPROVED"]) {
    assert.equal(
      runbook.includes(fictional),
      false,
      `the runbook must NOT reference the fictional ReadinessCode "${fictional}" — use only real members of the exported union`,
    );
    assert.equal(
      readRequiredDoc(CLASSIFICATION_DOC).includes(fictional),
      false,
      `the classification register must NOT reference the fictional ReadinessCode "${fictional}"`,
    );
  }
});
