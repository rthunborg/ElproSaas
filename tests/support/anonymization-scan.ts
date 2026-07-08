/**
 * Story 9.2 — the SHARED anonymization scanner (the SINGLE PII/secret authority for the golden estate).
 *
 * Extracted from the money golden-pack's pack-wide privacy scan (tests/unit/lib/money/golden-pack.test.ts:
 * 379-418) so 9.2 (and later 9.3/9.5) run ONE authoritative scan, not a copy-pasted regex set. The
 * money-pack scan stays byte-identical (it is NOT weakened) — this module is the reusable authority the
 * NEW Lovable pack consumes, and any future pack should import from here rather than fork a looser copy.
 *
 * ── WHAT IT DOES ──────────────────────────────────────────────────────────────────────────
 *   - Strips the `_doc` / `_comment` / `policy` PROVENANCE PROSE (which LEGITIMATELY names
 *     "personnummer"/"orgnr"/"address" as RULE TEXT) BEFORE scanning, then scans the DATA payload.
 *   - Runs each PII class as its OWN check so a violation names WHICH class tripped (Task 1.2/1.3).
 *   - Exposes two consumption shapes (the scaffold probes both): a non-throwing
 *     `scanFixtureData(obj) -> { violations }` AND a throwing `assertNoPii(obj, label)`.
 *
 * ── REGEX SET (ported EXACTLY from the money-pack scan — do NOT loosen; a looser regex that misses a
 *    real value is worse than the current guard, Task 1.3) ─────────────────────────────────────────
 *   PERSONNUMMER  /\b\d{6}-\d{4}\b/          YYMMDD-NNNN
 *   ORGNR         /\b\d{10}\b/               orgnr 10-digit no-dash — a DISTINCT guard, not a
 *                                            personnummer alias (R-411)
 *   NON_EXAMPLE_EMAIL /@(?!example\.test\b)[a-z0-9.-]+\.[a-z]{2,}/i
 *   SECRET        /secret|password|api_key/i
 *   PHONE         /(?:\+?46|0)\s?7\d(?:[\s-]?\d){7}\b/   SE mobile shape
 *   ADDRESS       /\b(gata|gatan|väg|vägen|street|road|avenue)\s+\d+/i   street-type + number
 *   RAW_FILE_BLOB `data:` URI OR a long unbroken base64 run in a STRING leaf — the AC1/R-901 raw-file
 *                 prohibition made an ASSERTED guard (a files fixture must be link/type/purpose
 *                 metadata only, never a smuggled base64/binary customer file). String-leaf scoped.
 *
 * ── P2 ORGNR HARDENING (Task 4.3 / R-914 / 9.2-ORGNR-01) ─────────────────────────────────────────
 *   The bare `\b\d{10}\b` orgnr guard flags ANY 10-digit run — including a legitimate ≥10-digit öre
 *   integer (the ledgered epic-4 iter-2 false-positive). Since 9.2 GENERALIZES the scan over the whole
 *   Lovable fixture set (far more öre values than the money pack), the ORGNR class is scoped to
 *   STRING-TYPED leaves only (a real orgnr is a STRING field; a numeric öre leaf is a JSON `number`,
 *   never a 10-digit token inside a string). This does NOT loosen the guard — a real 10-digit orgnr in
 *   ANY string field STILL trips it (the seeded positive control proves it) — it only stops a numeric
 *   öre value from spuriously reading as an orgnr leak. The öre-<10-digit fixture rule (9.2-SHAPE-01g)
 *   is the belt to this braces. Every OTHER class scans the full stringified DATA (the money-pack
 *   behavior) because those shapes never collide with a bare öre integer.
 *
 * NO PII in this file. This is a pure, dependency-free scanner (no DB, no clock, no network).
 * [Source: tests/unit/lib/money/golden-pack.test.ts:379-418; project-context.md#Testing Rules;
 *  test-design-epic-9.md 9.2-PRIV-01, R-901/R-914; deferred-work.md epic-4 iter-2 (ORGNR false-positive)]
 */
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The canonical home for the anonymized Lovable fixtures (architecture §16/§17). */
export const GOLDEN_LOVABLE_DIR = resolve(HERE, "../fixtures/golden/lovable");

// ── The EXACT PII/secret regex set (ported from golden-pack.test.ts:388-401 — do NOT loosen) ──
export const PERSONNUMMER = /\b\d{6}-\d{4}\b/; // YYMMDD-NNNN
export const ORGNR = /\b\d{10}\b/; // orgnr 10-digit no-dash — a distinct guard, not a personnummer alias
export const NON_EXAMPLE_EMAIL = /@(?!example\.test\b)[a-z0-9.-]+\.[a-z]{2,}/i;
export const SECRET = /secret|password|api_key/i;
export const PHONE = /(?:\+?46|0)\s?7\d(?:[\s-]?\d){7}\b/;
export const ADDRESS = /\b(gata|gatan|väg|vägen|street|road|avenue)\s+\d+/i;

/**
 * RAW_FILE_BLOB (AC1 / R-901 raw-file prohibition, 9.2-PRIV-02 raw-file arm) — the files fixture (and
 * any future files-shaped fixture) must carry link/type/purpose METADATA only, NEVER a raw customer
 * file smuggled in as a base64/binary/`data:` payload. This class detects a `data:` URI (with an
 * embedded encoded payload) OR a long unbroken base64 run in a STRING leaf — the shape a raw file blob
 * takes when embedded in JSON. Scoped to string leaves (like ORGNR) so it never trips on a numeric öre
 * value; the base64 threshold (>= 120 chars of unbroken base64) is far above any legitimate synthetic
 * id/label/hash a fixture carries, so a link/purpose metadata leaf cannot false-positive.
 */
export const DATA_URI_BLOB = /data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,/i;
export const BASE64_BLOB = /[A-Za-z0-9+/]{120,}={0,2}/;

/** A single detected PII/secret violation — the CLASS that tripped + the optional fixture label. */
export interface Violation {
  readonly class: string;
  readonly file?: string;
}

/** The result of scanning a fixture's DATA payload (post-prose-strip). */
export interface ScanResult {
  readonly violations: Violation[];
}

/**
 * Strip the provenance prose keys (they legitimately NAME the PII rules) before scanning the DATA.
 * The money-pack strips `_doc`; the Lovable pack additionally strips `_comment` (the alternate
 * provenance-string key the snapshot/file fixtures use) and the `policy` prose block.
 */
export function stripProse(obj: Record<string, unknown>): Record<string, unknown> {
  const dataOnly: Record<string, unknown> = { ...obj };
  delete dataOnly._doc;
  delete dataOnly._comment;
  delete dataOnly.policy;
  return dataOnly;
}

/** Recursively collect every STRING leaf (for the string-scoped ORGNR pass, R-914 hardening). */
function stringLeaves(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) for (const i of v) stringLeaves(i, out);
  else if (v && typeof v === "object") for (const val of Object.values(v as Record<string, unknown>)) stringLeaves(val, out);
  return out;
}

/**
 * Scan an already-prose-stripped DATA object for every PII/secret class. Returns the classes that
 * tripped (empty = clean). ORGNR is scoped to STRING leaves (R-914); all other classes scan the full
 * stringified DATA (the money-pack behavior).
 */
function scanClasses(dataOnly: Record<string, unknown>, file?: string): Violation[] {
  const dataJson = JSON.stringify(dataOnly);
  const violations: Violation[] = [];
  const hit = (cls: string) => violations.push(file ? { class: cls, file } : { class: cls });

  const leaves = stringLeaves(dataOnly);

  if (PERSONNUMMER.test(dataJson)) hit("PERSONNUMMER");
  // ORGNR: STRING leaves only (a real orgnr is a string field; a numeric öre leaf never appears as a
  // 10-digit token inside a string). Do NOT scan the full JSON — that would flag a legit ≥10-digit öre.
  if (leaves.some((s) => ORGNR.test(s))) hit("ORGNR");
  if (NON_EXAMPLE_EMAIL.test(dataJson)) hit("NON_EXAMPLE_EMAIL");
  if (SECRET.test(dataJson)) hit("SECRET");
  if (PHONE.test(dataJson)) hit("PHONE");
  if (ADDRESS.test(dataJson)) hit("ADDRESS");
  // RAW_FILE_BLOB: STRING leaves only — a raw customer file (base64/`data:` payload) is a string leaf;
  // a numeric öre value never is. Detect a `data:` URI OR a long unbroken base64 run (a smuggled blob).
  if (leaves.some((s) => DATA_URI_BLOB.test(s) || BASE64_BLOB.test(s))) hit("RAW_FILE_BLOB");
  return violations;
}

/**
 * NON-THROWING scan authority: strips prose, scans the DATA payload, returns per-class violations.
 * `label` (a fixture file name/path) is threaded onto each violation so a caller can report WHICH
 * fixture leaked. A privacy scan that never fails on planted PII is worthless — the seeded positive
 * control (9.2-PRIV-01d) drives THIS function and asserts >= 4 violations on planted PII.
 */
export function scanFixtureData(fixture: unknown, label?: string): ScanResult {
  const obj = fixture && typeof fixture === "object" ? (fixture as Record<string, unknown>) : {};
  return { violations: scanClasses(stripProse(obj), label) };
}

/**
 * THROWING scan authority: the same scan, but RAISES with a message naming the tripped class(es) so
 * the failure is loud + specific. The dev may wire either export shape into the suites.
 */
export function assertNoPii(fixture: unknown, label = "fixture"): void {
  const { violations } = scanFixtureData(fixture, label);
  if (violations.length > 0) {
    const classes = violations.map((v) => v.class).join(", ");
    throw new Error(`${label}: DATA payload leaked PII/secret class(es): ${classes}`);
  }
}

/**
 * Directory-glob backstop (Task 1.4): every committed `*.json` under the lovable dir, recursively.
 * A newly-added fixture the dev forgets to list in the explicit manifest is STILL caught here.
 */
export function listLovableFixtureFiles(): string[] {
  if (!existsSync(GOLDEN_LOVABLE_DIR)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".json")) out.push(full);
    }
  };
  walk(GOLDEN_LOVABLE_DIR);
  return out.sort();
}

/**
 * The EXPLICIT fixture manifest (Task 1.4): the authoritative list of every committed Lovable fixture,
 * one per AC1 business category. Paired with the `listLovableFixtureFiles()` glob backstop — the
 * privacy scan asserts the manifest MISSES no glob-discovered file (a bare hardcoded list a future
 * fixture escapes is the silent-miss trap). Filenames only (resolved against GOLDEN_LOVABLE_DIR).
 */
export const LOVABLE_FIXTURE_MANIFEST = [
  "crm.json",
  "settings-pricing.json",
  "calculations.json",
  "quotes.json",
  "pdfs.json",
  "acceptance.json",
  "files.json",
  "accepted-quote-to-job.json",
] as const;
