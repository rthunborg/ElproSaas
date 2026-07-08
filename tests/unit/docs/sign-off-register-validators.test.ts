/**
 * ╔══════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║  RED-PHASE ATDD SCAFFOLD — Story 9.4 (Pilot Fallback, Cutover, And Sign-Off Register)          ║
 * ║  These acceptance validators are AUTHORED BEFORE the 9.4 docs + register + checklist model     ║
 * ║  exist. They are EXPECTED TO FAIL (TDD red phase) until the dev-story lands:                    ║
 * ║    (a) docs/migration/pilot-fallback-cutover.md  — fallback/cutover/rollback runbook           ║
 * ║    (b) the Sign-Off Register (a `## Sign-Off Register` section OR sign-off-register.md)         ║
 * ║    (c) the executable cutover-block checklist model these tests import + drive                  ║
 * ║  Do NOT weaken to green by disabling: surface-present checks are HARD assertions, NEVER         ║
 * ║  describe.skip (project Testing Rule — a self-disabling test is vacuous-green).                 ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════════════╝
 *
 * WHY these tests / what they gate (test-design-epic-9.md weights 9.4 as a decision/evidence
 * artifact whose "tests" are checklist + traceability validators + a fixture-privacy scan):
 *
 *   - 9.4-BLOCK-01 (P0, epic blocker, R-905/R-908): the checklist validator HARD-BLOCKS real-pilot
 *     cutover for any workflow carrying an unresolved blocking money/tax/immutability/acceptance/
 *     required-file/migration-classification item, and blocks removing that workflow's fallback
 *     (R-908) — while the DEMO track stays explicitly non-blocking (demo-data-only owner decision
 *     2026-07-03). PROVE the block FIRES on a SEEDED open blocking item (negative-path), so the
 *     guard is not structurally-unreachable machinery (the epic-5-ledgered dead-guard anti-pattern).
 *   - 9.4-REG-01 (P1, R-917): every AC2 decision item AND every BLOCKING question ID in the
 *     system-of-record `owner-signoff-questions.md` (the `öppen (möte)` / `partial (möte)` rows,
 *     read LIVE — never a hardcoded copy that drifts) appears in the register with a decision
 *     status. A blocking source-of-record ID missing from the register is a register-drift FAIL.
 *   - 9.4-FALLBACK-01 (P2, R-908): the fallback/cutover doc carries per-workflow fallback +
 *     cutover + rollback-decision-point sections (non-empty), stated as per-workflow-never-whole-
 *     company.
 *   - 9.4 PII scan (R-901/R-902/R-914): docs/migration/** stays clean of real personnummer / orgnr
 *     / email / phone / secret — REUSING the 9.1 scan regexes + masked-placeholder stripping.
 *
 * ── Runner-glob discipline (project Testing Rule, R-904) ──────────────────────────────────────
 * This lives under `tests/unit/**` and uses `node:test`/`node:assert` so `pnpm test:unit`
 * (glob `tests/unit/ ** / *.test.ts`) actually executes it. A file outside that glob would be
 * vacuous-green (never run) — the runner-glob trap. NOT `tests/golden/**` (never executed).
 *
 * ── Source-of-truth cross-checks (no fabricated / memorised facts) ────────────────────────────
 * The blocking sign-off IDs are read LIVE from `owner-signoff-questions.md`; any readiness code
 * reference is cross-checked against the REAL exported `READINESS_CODES` union
 * (`src/features/calculations/readiness.ts`) — never a hardcoded subset. This mirrors the 9.1
 * validator's live-source discipline (TENANT_TABLES + ReadinessCode loaded live).
 *
 * [Source: test-design-epic-9.md#9.4-BLOCK-01/REG-01/FALLBACK-01, R-901/R-902/R-905/R-908/R-914/
 *  R-917; owner-signoff-questions.md (system-of-record); src/features/calculations/readiness.ts
 *  (READINESS_CODES); tests/unit/docs/migration-runbook-validators.test.ts (the EXACT pattern +
 *  PII-scan regexes to reuse); architecture §16 (cutover-by-workflow) + §24 (open questions)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REPO = process.cwd();
const MIGRATION_DOCS_DIR = path.join(REPO, "docs", "migration");
const SIGNOFF_SOR = path.join(
  REPO,
  "_bmad-output",
  "planning-artifacts",
  "owner-signoff-questions.md",
);

/**
 * The 9.4 fallback/cutover/rollback doc — the register may live here as a `## Sign-Off Register`
 * section OR in a dedicated sign-off-register.md. We resolve the register text from whichever home
 * exists (so the dev story can pick ONE home + cross-link, per Task 2.1).
 */
const FALLBACK_DOC = path.join(MIGRATION_DOCS_DIR, "pilot-fallback-cutover.md");
const REGISTER_DOC = path.join(MIGRATION_DOCS_DIR, "sign-off-register.md");

/** The six Phase A pilot workflows (architecture §16 cutover-by-workflow). */
const PILOT_WORKFLOWS = [
  /CRM/i,
  /Settings\s*\/\s*Pricing/i,
  /Calculations/i,
  /Quote Versions/i,
  /Basic Job|Job\s*\/\s*Order/i,
  /Required Files/i,
] as const;

/**
 * The eleven AC2 decision items the register MUST enumerate with a signed-off | blocking status.
 * [Source: story AC2; owner-signoff-questions.md item→ID mapping]
 */
const AC2_ITEMS = [
  "quote numbering",
  "sent-event semantics",
  "acceptance channels",
  "adjusted-price policy",
  "required files",
  "VAT",
  "ROT",
  "grön teknik",
  "rounding",
  "quote terms",
  "tax wording",
] as const;

/** Read a required 9.4 doc, failing LOUD (not skipping) when it is missing — the RED signal. */
function readRequiredDoc(file: string): string {
  assert.equal(
    existsSync(file),
    true,
    `[RED] required 9.4 doc is missing: ${path.relative(REPO, file)} — author the fallback/cutover/rollback runbook + sign-off register`,
  );
  return readFileSync(file, "utf8");
}

/** The fallback/cutover doc text (hard-required for AC1/AC3 surface). */
function fallbackDocText(): string {
  return readRequiredDoc(FALLBACK_DOC);
}

/**
 * The register text — from the dedicated sign-off-register.md if present, else the `## Sign-Off
 * Register` section of the fallback doc. Fails LOUD if neither home carries a register.
 */
function registerText(): string {
  if (existsSync(REGISTER_DOC)) return readFileSync(REGISTER_DOC, "utf8");
  const fb = existsSync(FALLBACK_DOC) ? readFileSync(FALLBACK_DOC, "utf8") : "";
  const m = fb.search(/##[^\n]*Sign-Off Register/i);
  assert.ok(
    m >= 0,
    `[RED] no sign-off register found — expected either docs/migration/sign-off-register.md OR a "## Sign-Off Register" section in pilot-fallback-cutover.md (Task 2.1)`,
  );
  return fb.slice(m);
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

/**
 * Parse the BLOCKING sign-off question IDs LIVE from the system-of-record. A row is blocking when
 * its Status cell is `öppen (möte)` or `partial (möte)` (owner-pending). We extract the leading ID
 * cell(s) — including ranged IDs like `B.1-B.4` and `C.1-C.3` — so the register-traceability check
 * cross-references the REAL open set, never a hardcoded copy that drifts (R-917).
 */
function blockingSignoffIds(): string[] {
  const src = readFileSync(SIGNOFF_SOR, "utf8");
  const ids = new Set<string>();
  for (const line of src.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    // cells[0] is the empty pre-pipe cell; cells[1] is the ID; last non-empty cell is the status.
    const id = cells[1];
    const status = cells[cells.length - 2] ?? "";
    if (!id || id === "ID" || id.startsWith("---")) continue;
    if (/öppen \(möte\)|partial \(möte\)/i.test(status)) {
      ids.add(id);
    }
  }
  return [...ids];
}

/** Load the REAL exported ReadinessCode runtime union LIVE (never a hardcoded subset). */
async function loadReadinessCodes(): Promise<readonly string[]> {
  const mod = (await import(
    pathToFileURL(
      path.join(REPO, "src", "features", "calculations", "readiness.ts"),
    ).href
  )) as { READINESS_CODES: readonly string[] };
  return mod.READINESS_CODES;
}

/**
 * The cutover-block checklist MODEL the dev story must author + export (Task 3.2). This scaffold
 * DRIVES it: it must expose a pure function that, given a workflow's blocking-item states + a track,
 * decides whether real-pilot cutover / fallback-removal is permitted. We resolve it from the module
 * the validator authors so the guard is EXECUTABLE, not prose. Fails LOUD (RED) until it exists.
 *
 * Expected shape (dev story finalizes exact names — this is the acceptance contract):
 *   evaluateCutover({ workflow, track: "real-pilot" | "demo", openBlockingItems: string[] })
 *     => { cutoverAllowed: boolean; fallbackRemovalAllowed: boolean; blockedBy: string[] }
 */
async function loadCutoverModel(): Promise<{
  evaluateCutover: (input: {
    workflow: string;
    track: "real-pilot" | "demo";
    openBlockingItems: readonly string[];
  }) => { cutoverAllowed: boolean; fallbackRemovalAllowed: boolean; blockedBy: readonly string[] };
}> {
  // Colocated with the register doc's home under tests/unit — the model is a small pure module the
  // validator + dev story share. Any of these resolution paths satisfying the contract is accepted.
  const candidates = [
    path.join(REPO, "tests", "unit", "docs", "sign-off-checklist-model.ts"),
    path.join(REPO, "tests", "support", "sign-off-checklist-model.ts"),
    path.join(REPO, "src", "features", "migration", "sign-off-checklist.ts"),
  ];
  const found = candidates.find((c) => existsSync(c));
  assert.ok(
    found,
    `[RED] the executable cutover-block checklist model is missing — expected one of:\n  ${candidates
      .map((c) => path.relative(REPO, c))
      .join(
        "\n  ",
      )}\nauthor a pure evaluateCutover(...) that HARD-BLOCKS real-pilot cutover on any open blocking item (9.4-BLOCK-01) while leaving the demo track unblocked.`,
  );
  const mod = (await import(pathToFileURL(found!).href)) as {
    evaluateCutover: (input: {
      workflow: string;
      track: "real-pilot" | "demo";
      openBlockingItems: readonly string[];
    }) => {
      cutoverAllowed: boolean;
      fallbackRemovalAllowed: boolean;
      blockedBy: readonly string[];
    };
  };
  assert.equal(
    typeof mod.evaluateCutover,
    "function",
    `[RED] ${path.relative(REPO, found!)} must export an evaluateCutover(...) function (the cutover-block teeth)`,
  );
  return mod;
}

// ══ 9.4-BLOCK-01 (P0, epic blocker, R-905/R-908) — the cutover-block teeth ═════════════════════

test("9.4-BLOCK-01: a real-pilot workflow with a SEEDED open blocking item CANNOT be marked cutover-ready (the block FIRES)", async () => {
  const { evaluateCutover } = await loadCutoverModel();
  // Seed one open blocking money/tax item on a real-pilot workflow — the negative path that proves
  // the guard is reachable (no structurally-unreachable machinery — epic-5 dead-guard anti-pattern).
  const result = evaluateCutover({
    workflow: "Calculations",
    track: "real-pilot",
    openBlockingItems: ["A.2"], // VAT rate — öppen (möte)
  });
  assert.equal(
    result.cutoverAllowed,
    false,
    "a real-pilot workflow with an open blocking item MUST NOT be cutover-ready — the checklist must HARD-BLOCK (9.4-BLOCK-01)",
  );
  assert.ok(
    result.blockedBy.includes("A.2"),
    "the block must attribute WHICH open blocking item stopped cutover (traceable block, not an opaque false)",
  );
});

test("9.4-BLOCK-01 (R-908): fallback CANNOT be removed for a workflow while any of its blocking items is open", async () => {
  const { evaluateCutover } = await loadCutoverModel();
  const result = evaluateCutover({
    workflow: "Required Files",
    track: "real-pilot",
    openBlockingItems: ["8.1"], // migration-klassning — öppen (möte)
  });
  assert.equal(
    result.fallbackRemovalAllowed,
    false,
    "fallback removal MUST be gated by the same open-blocking-item state that gates cutover (fallback-erosion guard, R-908/NFR21)",
  );
});

test("9.4-BLOCK-01: the DEMO track stays UNBLOCKED with the SAME open blocking items (two tracks never conflated)", async () => {
  const { evaluateCutover } = await loadCutoverModel();
  const result = evaluateCutover({
    workflow: "Calculations",
    track: "demo",
    openBlockingItems: ["A.2", "8.1"], // the same items that block real-pilot
  });
  assert.equal(
    result.cutoverAllowed,
    true,
    "the demo track (disposable fake data, nothing migrated) MUST stay non-blocking even with open items — owner decision 2026-07-03",
  );
});

test("9.4-BLOCK-01: a real-pilot workflow with NO open blocking items IS cutover-ready (the block is not a blanket deny)", async () => {
  const { evaluateCutover } = await loadCutoverModel();
  const result = evaluateCutover({
    workflow: "CRM",
    track: "real-pilot",
    openBlockingItems: [],
  });
  assert.equal(
    result.cutoverAllowed,
    true,
    "a real-pilot workflow with all blocking items resolved MUST be cutover-ready — the guard gates on OPEN items, it is not a permanent deny",
  );
});

// ══ 9.4-REG-01 (P1, R-917) — register traceability, no drift from the system-of-record ════════

test("9.4-REG-01: EVERY AC2 decision item appears in the register with a signed-off | blocking status", () => {
  const reg = registerText();
  const lc = reg.toLowerCase();
  for (const item of AC2_ITEMS) {
    assert.ok(
      lc.includes(item.toLowerCase()),
      `[RED] the sign-off register is MISSING the AC2 decision item "${item}" — every AC2 item must be a register row (9.4-REG-01)`,
    );
  }
  // Each item row must carry a status token — the register is not just a list of names.
  assert.ok(
    /signed-off/i.test(reg) && /blocking/i.test(reg),
    "[RED] the register must mark items `signed-off` or `blocking` — a status-less list cannot gate cutover (9.4-REG-01)",
  );
});

test("9.4-REG-01 (R-917): EVERY blocking question ID in owner-signoff-questions.md appears in the register (no register drift)", () => {
  const reg = registerText();
  const blocking = blockingSignoffIds();
  assert.ok(
    blocking.length >= 6,
    `[RED] expected the live system-of-record to carry the known open blocking IDs (>=6; A.1/A.2/B.1-B.4/C.1-C.3/7.1/7.3/8.1/8.2) — parsed ${blocking.length}: ${blocking.join(", ")}`,
  );
  const missing = blocking.filter((id) => !reg.includes(id));
  assert.deepEqual(
    missing,
    [],
    `[RED] register drift (R-917): these BLOCKING question IDs from owner-signoff-questions.md are absent from the register: ${missing.join(", ")} — the register REFERENCES the system-of-record, it must not fork a divergent copy`,
  );
});

test("9.4-REG-01: the register records the demo-vs-real-pilot track split (every blocking item non-blocking for demo)", () => {
  const lc = registerText().toLowerCase();
  assert.ok(
    /demo/.test(lc) && /real[- ]pilot/.test(lc),
    "[RED] the register must record BOTH tracks explicitly — real-pilot (blocking) vs demo (non-blocking)",
  );
  assert.ok(
    /non-blocking|not blocking|does not block/.test(lc),
    "[RED] the register must state the demo track is non-blocking (demo-data-only owner decision 2026-07-03) — do NOT conflate the two tracks",
  );
});

// ══ 9.4-FALLBACK-01 (P2, R-908) — per-workflow fallback + cutover + rollback docs ═════════════

test("9.4-FALLBACK-01: the fallback/cutover doc carries per-workflow fallback + cutover + rollback-decision-point sections (non-empty)", () => {
  const src = fallbackDocText();
  for (const wf of PILOT_WORKFLOWS) {
    assert.ok(
      src.search(wf) >= 0,
      `[RED] the fallback/cutover doc must document a per-workflow section matching ${wf} (AC1 — cutover-by-workflow)`,
    );
  }
  const lc = src.toLowerCase();
  for (const field of ["fallback", "cutover", "rollback"]) {
    assert.ok(
      lc.includes(field),
      `[RED] the fallback/cutover doc must carry the "${field}" layer (AC1 — old-app fallback / cutover-by-workflow / rollback decision points)`,
    );
  }
  // The NEW 9.4 layer specifically: explicit rollback DECISION POINTS.
  assert.ok(
    /rollback decision point/i.test(src),
    "[RED] the doc must state explicit ROLLBACK DECISION POINTS (the new 9.4 layer over the 9.1 runbook) — a failed acceptance gate / discovered blocking assumption / golden-comparison divergence reverting a workflow to fallback",
  );
});

test("9.4-FALLBACK-01: cutover AND rollback are stated as per-workflow, NEVER whole-company (architecture §16)", () => {
  const lc = fallbackDocText().toLowerCase();
  assert.ok(
    /per-workflow, never whole-company|by workflow, never whole-company|never whole-company/.test(lc),
    "[RED] the doc must state cutover/rollback are per-workflow, never whole-company (architecture §16) — reverting one workflow must not require reverting the whole company",
  );
});

test("9.4-FALLBACK-01: fallback MUST NOT be removed while a workflow's blocking assumption is open (NFR21/R-908 fallback-erosion guard)", () => {
  const lc = fallbackDocText().toLowerCase();
  assert.ok(
    /fallback[^.\n]*not[^.\n]*remov|not[^.\n]*remove[^.\n]*fallback|until[^.\n]*gate[^.\n]*pass/.test(lc),
    "[RED] the doc must state fallback is NOT removed for a workflow while any of its blocking assumptions is open (NFR21, R-908)",
  );
});

// ══ 9.4 PII scan (R-901/R-902/R-914) — reuse the 9.1 whole-directory scan ═════════════════════

test("9.4-PRIV: NO real PII (personnummer / orgnr / email / phone / secret) in any docs/migration/** file (incl. the new 9.4 doc)", () => {
  const files = migrationDocFiles();
  // >=3 because 9.4 ADDS at least one doc to the two 9.1 docs already present.
  assert.ok(
    files.length >= 3,
    `[RED] expected the two 9.1 docs PLUS the new 9.4 fallback/cutover doc under docs/migration/** — found ${files.length}`,
  );

  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const rel = path.relative(REPO, file);
    // Strip the sanctioned obviously-fake masked placeholders (same as the 9.1 scan).
    const scanned = src.replace(/YYYYMMDD-XXXX/g, "").replace(/XXXXXX-XXXX/g, "");

    const pnr = scanned.match(/\b\d{6,8}[-\s]?\d{4}\b/g);
    assert.equal(pnr, null, `${rel} contains a personnummer-shaped string ${JSON.stringify(pnr)} (R-902)`);

    const orgnr = scanned.match(/\b\d{10}\b/g);
    assert.equal(orgnr, null, `${rel} contains a bare 10-digit orgnr-shaped string ${JSON.stringify(orgnr)} (R-914)`);

    const emails = (scanned.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []).filter(
      (e) => !/@(example\.(test|com|org)|test\.test|localhost)$/i.test(e),
    );
    assert.deepEqual(emails, [], `${rel} contains a non-placeholder email ${JSON.stringify(emails)} (R-902)`);

    const phones = scanned.match(/\+46[\s-]?\d[\d\s-]{6,}|\b0\d{1,3}[-\s]\d{5,}\b/g);
    assert.equal(phones, null, `${rel} contains a phone-shaped string ${JSON.stringify(phones)} (R-902)`);

    const secrets = scanned.match(
      /(api[_-]?key|password|secret|token|bearer)\s*[:=]\s*["']?[A-Za-z0-9/_+.\-]{12,}|-----BEGIN [A-Z ]+-----/gi,
    );
    assert.equal(secrets, null, `${rel} contains secret-shaped material ${JSON.stringify(secrets)} (R-902)`);
  }
});

// ══ Representativeness guard — no fictional ReadinessCode propagated into the 9.4 doc ═════════

test("9.4: any readiness code the 9.4 doc references is a REAL member of the exported union (no fictional code)", async () => {
  const doc = existsSync(FALLBACK_DOC) ? readFileSync(FALLBACK_DOC, "utf8") : "";
  assert.ok(
    doc.length > 0,
    "[RED] the fallback/cutover doc must exist before its readiness-code references can be validated",
  );
  const real = new Set(await loadReadinessCodes());
  // The two KNOWN-fictional codes (the representativeness trap) must NEVER appear.
  for (const fictional of ["REQUIRES_SIGN_OFF", "DEDUCTION_ESTIMATE_UNAPPROVED"]) {
    assert.equal(
      doc.includes(fictional),
      false,
      `the 9.4 doc must NOT reference the fictional ReadinessCode "${fictional}" — use only real members of the exported union`,
    );
  }
  // Any SCREAMING_SNAKE token that looks like a readiness code AND is referenced as one must be real.
  const cited = new Set(
    (doc.match(/\b[A-Z]{2,}(?:_[A-Z]+)+\b/g) ?? []).filter((t) => /_(?:REQUIRED|DEFERRED|SIGN_OFF|VAT|MARGIN|CUSTOMER|FACILITY|CONTACT|SECTION|PRICE|ROLE|INCLUDED|UNCOMPUTABLE)\b/.test(t)),
  );
  for (const token of cited) {
    if (real.has(token)) continue;
    assert.fail(
      `the 9.4 doc references "${token}" as a readiness code, but it is NOT a real member of READINESS_CODES — reference the exported union only`,
    );
  }
});

// ══ Doc hygiene — no stray write-tool artifact lines (9.1 Tier-A caught these) ════════════════

test("9.4: the fallback/cutover doc has NO stray tool-call artifact lines (write-tool emission tokens)", () => {
  const src = fallbackDocText();
  const artifacts = ["</content>", "</invoke>", "<invoke", "<parameter", "</parameter>"];
  for (const artifact of artifacts) {
    assert.equal(
      src.includes(artifact),
      false,
      `the fallback/cutover doc contains a stray tool-call artifact line "${artifact}" — doc-heavy output can leak these; each file must end cleanly at its last real section (9.1 Tier-A hygiene)`,
    );
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// COVERAGE EXPANSION (testarch-automate) — deeper edge/negative coverage of the epic-blocker teeth
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// The RED-phase scaffold above proves the ACs at a happy-path + single-negative level. This block
// hardens the P0 cutover-block guard (9.4-BLOCK-01) against edge cases the single-item tests leave
// open, and — the highest-value new invariant — ties the register (the DECISION doc) to the
// executable model (the GUARD) so the two artifacts cannot silently disagree about what blocks:
//
//   - multi-item attribution: `blockedBy` must carry EVERY offending open item, not just one;
//   - full real-pilot block symmetry: an open item denies BOTH cutover AND fallback removal, with
//     `blockedBy` reflecting the exact set (R-908 fallback-erosion, not just cutover);
//   - clean-path completeness: a resolved real-pilot workflow allows cutover AND fallback removal
//     with an EMPTY `blockedBy` (the guard is not a blanket deny, and does not fabricate blockers);
//   - demo-track totality: the demo track never blocks — even with many open items, and its
//     `fallbackRemovalAllowed` is likewise unblocked (the two tracks are never conflated, on BOTH
//     decision axes, not just `cutoverAllowed`);
//   - input purity: the model must not mutate the caller's `openBlockingItems` (a pure gate);
//   - register↔model consistency (the load-bearing new coverage, R-905/R-908/R-917): EVERY
//     `blocking` question ID the live system-of-record carries — the exact set the register must
//     enumerate — when fed to `evaluateCutover` on the real-pilot track MUST block cutover, and on
//     the demo track MUST NOT. This wires the decision doc's blocking set to the guard's behavior so
//     a register that lists an item as blocking cannot be paired with a guard that lets it through.
//
// [Source: testarch-automate coverage expansion; test-design-epic-9.md 9.4-BLOCK-01/REG-01,
//  R-905/R-908/R-917; sign-off-checklist-model.ts (the pure evaluateCutover gate); the 9.1 pattern
//  of promoting docs/decision invariants to standing node --test coverage]

test("9.4-BLOCK-01 (multi-item): a real-pilot workflow with SEVERAL open blocking items is blocked, and blockedBy names ALL of them", async () => {
  const { evaluateCutover } = await loadCutoverModel();
  const open = ["A.1", "A.2", "B.1-B.4", "8.1"];
  const result = evaluateCutover({
    workflow: "Calculations",
    track: "real-pilot",
    openBlockingItems: open,
  });
  assert.equal(
    result.cutoverAllowed,
    false,
    "any open blocking item blocks real-pilot cutover — a workflow with several open items is not cutover-ready",
  );
  // Attribution must be COMPLETE — every offending item is named, so a caller can report the full
  // remediation set, not just the first blocker.
  for (const id of open) {
    assert.ok(
      result.blockedBy.includes(id),
      `blockedBy must name EVERY open blocking item that stopped cutover — "${id}" is missing (traceable, complete block)`,
    );
  }
});

test("9.4-BLOCK-01 (R-908 symmetry): an open item denies BOTH cutover AND fallback removal, with matching blockedBy", async () => {
  const { evaluateCutover } = await loadCutoverModel();
  const result = evaluateCutover({
    workflow: "Quote Versions",
    track: "real-pilot",
    openBlockingItems: ["8.2"], // facit-exempel — öppen (möte)
  });
  assert.equal(result.cutoverAllowed, false, "cutover blocked while a blocking item is open");
  assert.equal(
    result.fallbackRemovalAllowed,
    false,
    "fallback removal MUST be gated by the SAME open-item state as cutover (R-908/NFR21 fallback-erosion) — the two decision axes move together",
  );
  assert.deepEqual(
    [...result.blockedBy],
    ["8.2"],
    "the block attributes exactly the open item(s) — no phantom blockers, no dropped ones",
  );
});

test("9.4-BLOCK-01 (clean real-pilot): a resolved workflow allows cutover AND fallback removal with an EMPTY blockedBy", async () => {
  const { evaluateCutover } = await loadCutoverModel();
  const result = evaluateCutover({
    workflow: "CRM",
    track: "real-pilot",
    openBlockingItems: [],
  });
  assert.equal(result.cutoverAllowed, true, "no open items → cutover-ready (the guard is not a blanket deny)");
  assert.equal(
    result.fallbackRemovalAllowed,
    true,
    "no open items → fallback may be removed (the fallback-erosion guard releases once every blocking assumption is resolved)",
  );
  assert.deepEqual(
    [...result.blockedBy],
    [],
    "a clean workflow must report NO blockers — the model must not fabricate a blocker where none is open",
  );
});

test("9.4-BLOCK-01 (demo totality): the demo track NEVER blocks — cutover AND fallback removal both allowed even with many open items", async () => {
  const { evaluateCutover } = await loadCutoverModel();
  const result = evaluateCutover({
    workflow: "Basic Job / Order",
    track: "demo",
    openBlockingItems: ["A.1", "A.2", "B.1-B.4", "C.1-C.3", "7.1", "7.3", "8.1", "8.2"],
  });
  assert.equal(result.cutoverAllowed, true, "demo cutover proceeds regardless of open items (disposable fake data, nothing migrated)");
  assert.equal(
    result.fallbackRemovalAllowed,
    true,
    "the demo track is non-blocking on BOTH axes — fallback removal is not gated on the demo track either (the two tracks are never conflated)",
  );
  assert.deepEqual(
    [...result.blockedBy],
    [],
    "the demo track attributes no blockers — its open items never gate demo work (owner decision 2026-07-03)",
  );
});

test("9.4-BLOCK-01 (purity): evaluateCutover does NOT mutate the caller's openBlockingItems array", async () => {
  const { evaluateCutover } = await loadCutoverModel();
  const open = ["A.2", "8.1"];
  const snapshot = [...open];
  evaluateCutover({ workflow: "Calculations", track: "real-pilot", openBlockingItems: open });
  assert.deepEqual(
    open,
    snapshot,
    "the cutover gate must be a PURE function — it must not mutate the caller's input array (a shared-state side effect would corrupt a caller iterating the same list)",
  );
});

test("9.4-REG-01 (register↔model consistency): EVERY live blocking question ID blocks real-pilot cutover and does NOT block demo", async () => {
  const { evaluateCutover } = await loadCutoverModel();
  const blocking = blockingSignoffIds();
  assert.ok(
    blocking.length >= 6,
    `expected the live system-of-record to carry the known open blocking IDs (>=6) — parsed ${blocking.length}: ${blocking.join(", ")}`,
  );
  // The register (§4) enumerates exactly this blocking set (9.4-REG-01 above proves no drift). Here
  // we tie that DECISION set to the GUARD's behavior: feeding each blocking ID to the model must
  // HARD-BLOCK the real-pilot track and leave the demo track open — so the doc's blocking marks and
  // the executable gate cannot silently disagree.
  for (const id of blocking) {
    const realPilot = evaluateCutover({
      workflow: "Calculations",
      track: "real-pilot",
      openBlockingItems: [id],
    });
    assert.equal(
      realPilot.cutoverAllowed,
      false,
      `the system-of-record marks "${id}" blocking, but evaluateCutover let a real-pilot cutover through — the register and the guard MUST agree (9.4-REG-01/9.4-BLOCK-01)`,
    );
    assert.ok(
      realPilot.blockedBy.includes(id),
      `the block for "${id}" must attribute that exact ID (traceable register→guard mapping)`,
    );

    const demo = evaluateCutover({
      workflow: "Calculations",
      track: "demo",
      openBlockingItems: [id],
    });
    assert.equal(
      demo.cutoverAllowed,
      true,
      `blocking item "${id}" must NOT gate the demo track — demo stays non-blocking for every real-pilot blocker (two tracks never conflated)`,
    );
  }
});
